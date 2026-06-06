import { ethers } from 'ethers';
import { prisma } from './prisma';
import { BSC_CHAIN_ID, BSC_RPC_URL, TREASURY_ADDRESS, PAYMENT_ASSET, GRADUATION_DEPLOYER_ADDRESS } from './bsc';

const CENTRAL_TREASURY_ABI = [
  'function predictedDepositVault(address user, address asset) external view returns (address)',
  'function getOrCreateDepositVault(address user, address asset) external returns (address)',
  'function sweepVault(address user, uint256 amount) external returns (uint256)',
  'function processWithdrawal(address to, uint256 amount) external',
];

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
];

const DEPLOYER_ABI = [
  'function deployAndGraduate(string name, string symbol, uint256 totalSupply, uint256 liquidityUsdt) external returns (address)',
  'event TokenGraduated(address indexed token, address indexed dexPoolAddress, uint256 liquidityUsdt, uint256 tokenAmount)',
];

function internalUsdtToOnChainUnits(amount: bigint): bigint {
  // Internal balances are stored with 6 decimals; the BSC test USDT flow uses 18 decimals on-chain.
  return amount * 1_000_000_000_000n;
}

function onChainUsdtToInternalUnits(amount: bigint): bigint {
  return amount / 1_000_000_000_000n;
}

function isInsufficientVaultBalance(error: unknown): boolean {
  const err = error as { reason?: string; shortMessage?: string; message?: string };
  return [err.reason, err.shortMessage, err.message]
    .filter(Boolean)
    .some((message) => message!.includes('INSUFFICIENT_VAULT_BALANCE'));
}

async function failWithdrawalWithRefund(
  withdrawalId: string,
  error: string,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal || withdrawal.status === 'failed' || withdrawal.status === 'completed') {
      return false;
    }

    await tx.withdrawalRequest.update({
      where: { id: withdrawal.id },
      data: { status: 'failed', error },
    });

    await tx.userBalance.upsert({
      where: {
        walletAddress_chainId_asset: {
          walletAddress: withdrawal.userWallet,
          chainId: BSC_CHAIN_ID,
          asset: withdrawal.asset,
        },
      },
      update: {
        available: { increment: withdrawal.amount },
      },
      create: {
        userId: withdrawal.userId ?? undefined,
        walletAddress: withdrawal.userWallet,
        chainId: BSC_CHAIN_ID,
        asset: withdrawal.asset,
        available: withdrawal.amount,
      },
    });

    return true;
  });
}

async function reconcileWithdrawalVaultBalance(
  withdrawalId: string,
  error: string,
  vaultInternalBalance: bigint,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal || withdrawal.status === 'completed') {
      return false;
    }

    await tx.withdrawalRequest.update({
      where: { id: withdrawal.id },
      data: {
        status: 'failed',
        error: `${error}\n[reconciled vault balance: ${vaultInternalBalance}]`,
      },
    });

    await tx.userBalance.upsert({
      where: {
        walletAddress_chainId_asset: {
          walletAddress: withdrawal.userWallet,
          chainId: BSC_CHAIN_ID,
          asset: withdrawal.asset,
        },
      },
      update: {
        available: vaultInternalBalance,
      },
      create: {
        userId: withdrawal.userId ?? undefined,
        walletAddress: withdrawal.userWallet,
        chainId: BSC_CHAIN_ID,
        asset: withdrawal.asset,
        available: vaultInternalBalance,
      },
    });

    return true;
  });
}

export async function runHotWalletWorker() {
  console.log(`[HotWallet] Starting worker on ${BSC_RPC_URL}`);
  const privateKey = process.env.TREASURY_PRIVATE_KEY;

  if (!privateKey) {
    console.warn(`[HotWallet] TREASURY_PRIVATE_KEY not set. Worker will not process withdrawals or graduations.`);
    return;
  }

  const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);
  const treasuryContract = new ethers.Contract(TREASURY_ADDRESS, CENTRAL_TREASURY_ABI, wallet);

  const reconcileVaultBalance = async (withdrawalId: string, error: string) => {
    const withdrawal = await prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });
    if (!withdrawal) return false;

    const vaultAddress = await treasuryContract.predictedDepositVault(withdrawal.userWallet, withdrawal.asset);
    const assetContract = new ethers.Contract(withdrawal.asset, ERC20_ABI, wallet);
    const vaultBalance = await assetContract.balanceOf(vaultAddress);
    const vaultInternalBalance = onChainUsdtToInternalUnits(BigInt(vaultBalance));

    return reconcileWithdrawalVaultBalance(
      withdrawal.id,
      error,
      vaultInternalBalance,
    );
  };

  setInterval(async () => {
    // ── WITHDRAWALS ──────────────────────────────────────────────────────────
    try {
      const pending = await prisma.withdrawalRequest.findFirst({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
      });

      if (pending) {
        await prisma.withdrawalRequest.update({
          where: { id: pending.id },
          data: { status: 'processing' },
        });

        console.log(`[HotWallet] Processing withdrawal ${pending.id} of ${pending.amount} to ${pending.destination}`);

        try {
          const internalAmount = BigInt(pending.amount);
          const onChainAmount = internalUsdtToOnChainUnits(internalAmount);

          const vaultTx = await treasuryContract.getOrCreateDepositVault(pending.userWallet, pending.asset);
          console.log(`[HotWallet] Ensuring deposit vault exists: ${vaultTx.hash}`);
          await vaultTx.wait(1);

          const sweepTx = await treasuryContract.sweepVault(pending.userWallet, onChainAmount);
          console.log(`[HotWallet] Sweeping ${onChainAmount} from vault: ${sweepTx.hash}`);
          await sweepTx.wait(1);

          const tx = await treasuryContract.processWithdrawal(pending.destination, onChainAmount);
          console.log(`[HotWallet] Withdrawal Tx Sent: ${tx.hash}`);
          await tx.wait(1);

          await prisma.withdrawalRequest.update({
            where: { id: pending.id },
            data: { status: 'completed', txHash: tx.hash },
          });
          console.log(`[HotWallet] Withdrawal ${pending.id} completed!`);
        } catch (err: any) {
          console.error(`[HotWallet] Withdrawal failed:`, err);
          if (isInsufficientVaultBalance(err)) {
            const reconciled = await reconcileVaultBalance(
              pending.id,
              err.message ?? String(err),
            );
            console.log(
              `[HotWallet] Withdrawal ${pending.id} marked failed${reconciled ? ' and reconciled to vault balance' : ''}.`,
            );
          } else {
            const refunded = await failWithdrawalWithRefund(
              pending.id,
              err.message ?? String(err),
            );
            console.log(
              `[HotWallet] Withdrawal ${pending.id} marked failed${refunded ? ' and refunded' : ''}.`,
            );
          }
        }
      }

      const unreconciledFailed = await prisma.withdrawalRequest.findFirst({
        where: {
          status: 'failed',
          error: {
            contains: 'INSUFFICIENT_VAULT_BALANCE',
            not: { contains: '[reconciled vault balance:' },
          },
        },
        orderBy: { updatedAt: 'asc' },
      });

      if (unreconciledFailed) {
        const reconciled = await reconcileVaultBalance(
          unreconciledFailed.id,
          unreconciledFailed.error ?? 'INSUFFICIENT_VAULT_BALANCE',
        );
        console.log(
          `[HotWallet] Historical failed withdrawal ${unreconciledFailed.id}${reconciled ? ' reconciled to vault balance' : ' skipped'}.`,
        );
      }
    } catch (err) {
      console.error(`[HotWallet] Withdrawal loop error:`, err);
    }

    // ── GRADUATIONS ──────────────────────────────────────────────────────────
    try {
      if (!GRADUATION_DEPLOYER_ADDRESS || GRADUATION_DEPLOYER_ADDRESS === '0x0000000000000000000000000000000000000000') {
        return;
      }

      const graduatingToken = await prisma.token.findFirst({
        where: { status: 'graduating' },
        orderBy: { updatedAt: 'asc' },
      });

      if (!graduatingToken) return;

      console.log(`[HotWallet] Graduating token ${graduatingToken.symbol} (${graduatingToken.id})`);

      // Mark as 'graduating_in_progress' to avoid double-processing across intervals
      await prisma.token.update({
        where: { id: graduatingToken.id },
        data: { status: 'graduating_in_progress' },
      });

      try {
        const deployer = new ethers.Contract(GRADUATION_DEPLOYER_ADDRESS, DEPLOYER_ABI, wallet);
        const usdt = new ethers.Contract(PAYMENT_ASSET, ERC20_ABI, wallet);

        // Calculate liquidity: use accumulated USDT from all internal trades for this token
        // For safety, use the token's market cap as a proxy. 
        // The actual USDT to send = total USDT paid in by all buyers.
        const trades = await prisma.trade.aggregate({
          where: { tokenMint: graduatingToken.mint, type: 'buy' },
          _sum: { paymentAmount: true },
        });
        const totalUsdtIn = BigInt(trades._sum.paymentAmount?.toString() ?? '0');
        const liquidityUsdt = totalUsdtIn > 0n ? totalUsdtIn : 15000_000000n; // fallback $15k

        console.log(`[HotWallet] Sending ${liquidityUsdt} USDT to deployer for liquidity`);

        // Step 1: Transfer USDT from treasury hot wallet to the deployer contract
        // (The hot wallet must hold the USDT or the treasury must have approved it)
        const hotWalletBalance = await usdt.balanceOf(wallet.address);
        if (hotWalletBalance < liquidityUsdt) {
          console.warn(`[HotWallet] Hot wallet has insufficient USDT (${hotWalletBalance} < ${liquidityUsdt}). Resetting to graduating.`);
          await prisma.token.update({
            where: { id: graduatingToken.id },
            data: { status: 'graduating' },
          });
          return;
        }

        const transferTx = await usdt.transfer(GRADUATION_DEPLOYER_ADDRESS, liquidityUsdt);
        console.log(`[HotWallet] USDT transfer tx: ${transferTx.hash}`);
        await transferTx.wait(1);

        // Step 2: Call deployAndGraduate
        const tx = await deployer.deployAndGraduate(
          graduatingToken.name,
          graduatingToken.symbol,
          BigInt(graduatingToken.supplyCap.toString()),
          liquidityUsdt,
          { gasLimit: 5_000_000 }
        );
        console.log(`[HotWallet] Graduation Tx Sent: ${tx.hash}`);
        const receipt = await tx.wait(1);

        // Step 3: Parse the TokenGraduated event to get the deployed token address.
        // Declare as explicit string — mint is always non-null on a token record.
        const deployerInterface = new ethers.Interface(DEPLOYER_ABI);
        let deployedTokenAddress: string = graduatingToken.tokenAddress || graduatingToken.mint;
        let dexPoolAddress: string = graduatingToken.tokenAddress || graduatingToken.mint;

        for (const log of receipt.logs) {
          try {
            const parsed = deployerInterface.parseLog(log);
            if (parsed?.name === 'TokenGraduated') {
              deployedTokenAddress = String(parsed.args.token);
              dexPoolAddress = String(parsed.args.dexPoolAddress);
              break;
            }
          } catch {
            // not our event
          }
        }

        await prisma.token.update({
          where: { id: graduatingToken.id },
          data: {
            status: 'graduated',
            tokenAddress: deployedTokenAddress.toLowerCase(),
            dexPoolAddress: dexPoolAddress.toLowerCase(),
          },
        });

        console.log(`[HotWallet] Token ${graduatingToken.symbol} fully graduated! On-chain: ${deployedTokenAddress}`);
      } catch (err: any) {
        console.error(`[HotWallet] Graduation failed for ${graduatingToken.symbol}:`, err.message ?? err);
        // Reset back to 'graduating' so it retries next cycle
        await prisma.token.update({
          where: { id: graduatingToken.id },
          data: { status: 'graduating' },
        });
      }
    } catch (err) {
      console.error(`[HotWallet] Graduation loop error:`, err);
    }
  }, 15_000); // Check every 15 seconds
}
