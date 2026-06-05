import { ethers } from 'ethers';
import { prisma } from './prisma';
import { BSC_RPC_URL, TREASURY_ADDRESS, PAYMENT_ASSET, GRADUATION_DEPLOYER_ADDRESS } from './bsc';

const CENTRAL_TREASURY_ABI = [
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
          const tx = await treasuryContract.processWithdrawal(pending.destination, BigInt(pending.amount));
          console.log(`[HotWallet] Withdrawal Tx Sent: ${tx.hash}`);
          await tx.wait(1);

          await prisma.withdrawalRequest.update({
            where: { id: pending.id },
            data: { status: 'completed', txHash: tx.hash },
          });
          console.log(`[HotWallet] Withdrawal ${pending.id} completed!`);
        } catch (err: any) {
          console.error(`[HotWallet] Withdrawal failed:`, err);
          await prisma.withdrawalRequest.update({
            where: { id: pending.id },
            data: { status: 'failed', error: err.message ?? String(err) },
          });
        }
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
