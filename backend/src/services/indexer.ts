import { ethers } from 'ethers';
import { prisma } from './prisma';
import { BSC_RPC_URL, PAYMENT_ASSET, normalizeAddress } from './bsc';

// Standard ERC20 ABI for Transfer event
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function balanceOf(address account) external view returns (uint256)',
];

const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
const paymentContract = new ethers.Contract(PAYMENT_ASSET, ERC20_ABI, provider);
const erc20Interface = new ethers.Interface(ERC20_ABI);
const MAX_FREE_TIER_LOG_RANGE = 10;
const configuredBlockBatchSize = Number(process.env.INDEXER_BLOCK_BATCH_SIZE ?? String(MAX_FREE_TIER_LOG_RANGE));
const INDEXER_BLOCK_BATCH_SIZE = Number.isFinite(configuredBlockBatchSize)
  ? Math.max(1, Math.min(configuredBlockBatchSize, MAX_FREE_TIER_LOG_RANGE))
  : MAX_FREE_TIER_LOG_RANGE;
const INDEXER_BACKFILL_TX_HASHES = (process.env.INDEXER_BACKFILL_TX_HASHES ?? '')
  .split(',')
  .map((hash) => hash.trim())
  .filter(Boolean);
const VAULT_RECONCILE_INTERVAL_MS = Number(process.env.VAULT_RECONCILE_INTERVAL_MS ?? '30000');
const VAULT_RECONCILE_LIMIT = Number(process.env.VAULT_RECONCILE_LIMIT ?? '5');

function onChainUsdtToInternalUnits(amount: bigint): bigint {
  return amount / 1000000000000n;
}

function describeRpcError(error: unknown): string {
  const err = error as { code?: string; shortMessage?: string; reason?: string; message?: string; info?: { error?: { message?: string } } };
  return err.shortMessage ?? err.reason ?? err.info?.error?.message ?? err.message ?? String(error);
}

/**
 * Credit a deposit identified by a unique (txHash, logIndex) pair.
 *
 * IMPORTANT: The deposit.create is inside a DB transaction and we rely on the
 * unique constraint on (txHash, logIndex) to prevent double-credits. If two
 * concurrent calls race through here with the same key, the second will throw
 * a Prisma P2002 (unique constraint) error which we catch and silently ignore.
 * This is safer than a pre-check + create pattern which has a TOCTOU gap.
 */
async function creditDepositTransfer(txHash: string, logIndex: number, toAddress: string, amountRaw: bigint) {
  const normalizedToAddress = normalizeAddress(toAddress);
  // BSC USDT is 18 decimals, but our internal DB uses 6 decimals.
  const amountWei = amountRaw / 1000000000000n;

  // Check if the recipient is one of our tracked DepositVaults.
  const vault = await prisma.depositAddress.findFirst({
    where: { vaultAddress: normalizedToAddress },
  });

  if (!vault) return false;

  console.log(`[Indexer] Detected deposit! ${amountWei} USDT to Vault ${normalizedToAddress} (User: ${vault.userWallet})`);

  try {
    await prisma.$transaction(async (tx) => {
      // Attempt to create the deposit record first.
      // If a duplicate (txHash, logIndex) already exists, Prisma will throw P2002
      // which will roll back the entire transaction — preventing any double-credit.
      await tx.deposit.create({
        data: {
          depositAddressId: vault.id,
          userWallet: vault.userWallet,
          vaultAddress: normalizedToAddress,
          chainId: vault.chainId,
          asset: vault.asset,
          amount: amountWei,
          txHash,
          logIndex,
          confirmations: 1,
          credited: true,
        },
      });

      await tx.userBalance.upsert({
        where: {
          walletAddress_chainId_asset: {
            walletAddress: vault.userWallet,
            chainId: vault.chainId,
            asset: vault.asset,
          },
        },
        update: {
          available: { increment: amountWei },
        },
        create: {
          userId: vault.userId,
          walletAddress: vault.userWallet,
          chainId: vault.chainId,
          asset: vault.asset,
          available: amountWei,
          consumed: 0n,
        },
      });
    });
  } catch (err: any) {
    // P2002 = unique constraint violation — deposit already processed. Safe to ignore.
    if (err?.code === 'P2002') {
      console.log(`[Indexer] Skipping duplicate deposit ${txHash}[${logIndex}] — already credited.`);
      return false;
    }
    throw err; // re-throw unexpected errors
  }

  console.log(`[Indexer] Successfully credited ${amountWei} to ${vault.userWallet}`);
  return true;
}

async function backfillDepositTransactions(txHashes: string[]) {
  if (txHashes.length === 0) return;

  console.log(`[Indexer] Backfilling ${txHashes.length} deposit transaction(s) by receipt`);

  for (const txHash of txHashes) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) {
        console.log(`[Indexer] Backfill skipped ${txHash}: receipt not found yet`);
        continue;
      }

      for (const log of receipt.logs) {
        if (normalizeAddress(log.address) !== normalizeAddress(PAYMENT_ASSET)) continue;

        const parsed = erc20Interface.parseLog({
          topics: [...log.topics],
          data: log.data,
        });
        if (!parsed || parsed.name !== 'Transfer') continue;

        const toAddress = String(parsed.args.to ?? parsed.args[1]);
        const amountRaw = BigInt(parsed.args.value ?? parsed.args[2]);
        await creditDepositTransfer(receipt.hash, log.index, toAddress, amountRaw);
      }
    } catch (err) {
      console.error(`[Indexer] Error backfilling tx ${txHash}:`, err);
    }
  }
}

/**
 * Reconcile vault balances as a fallback safety net.
 *
 * This compares the total on-chain balance with the sum of all CREDITED deposits
 * already recorded for that vault. This way, the reconciler only acts when
 * actual funds are on-chain but NO deposit record exists for them — it won't
 * double-count amounts already credited by the log-polling loop.
 */
async function reconcileActiveVaultBalances() {
  const limit = Number.isFinite(VAULT_RECONCILE_LIMIT) && VAULT_RECONCILE_LIMIT > 0
    ? VAULT_RECONCILE_LIMIT
    : 50;

  const vaults = await prisma.depositAddress.findMany({
    where: {
      status: 'active',
      asset: normalizeAddress(PAYMENT_ASSET),
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
  });

  for (const vault of vaults) {
    try {
      const onChainBalance = onChainUsdtToInternalUnits(
        BigInt(await paymentContract.balanceOf(vault.vaultAddress)),
      );

      if (onChainBalance === 0n) continue;

      // Sum all deposits already recorded for this vault in the DB.
      // This is the source-of-truth: only credit what isn't already recorded.
      const creditedAggregate = await prisma.deposit.aggregate({
        where: {
          vaultAddress: vault.vaultAddress,
          credited: true,
        },
        _sum: { amount: true },
      });
      const alreadyCredited = BigInt(creditedAggregate._sum?.amount ?? 0n);

      if (onChainBalance <= alreadyCredited) continue;

      const missingAmount = onChainBalance - alreadyCredited;

      // Use a deterministic synthetic txHash that includes `alreadyCredited`
      // so it's unique per "gap" we're filling, not per absolute balance.
      const txHash = ethers.keccak256(
        ethers.toUtf8Bytes(`vault-reconcile:${vault.chainId}:${vault.vaultAddress}:credited=${alreadyCredited}:gap=${missingAmount}`),
      );

      console.log(`[Indexer] Reconcile gap for vault ${vault.vaultAddress}: on-chain=${onChainBalance}, credited=${alreadyCredited}, gap=${missingAmount}`);

      // creditDepositTransfer handles the duplicate-key guard atomically
      await creditDepositTransfer(txHash, 0, vault.vaultAddress, missingAmount * 1000000000000n);

    } catch (err) {
      console.warn(`[Indexer] Skipped vault ${vault.vaultAddress}: ${describeRpcError(err)}`);
    } finally {
      await prisma.depositAddress.update({
        where: { id: vault.id },
        data: { status: vault.status },
      });
    }
  }
}

export async function runIndexer() {
  console.log(`[Indexer] Starting BSC Deposit Indexer on ${BSC_RPC_URL}`);
  console.log(`[Indexer] Listening for ${PAYMENT_ASSET} transfers`);
  console.log(`[Indexer] Using ${INDEXER_BLOCK_BATCH_SIZE}-block log batches`);

  // Simple polling mechanism
  let lastProcessedBlock = await provider.getBlockNumber();

  // Look up last processed block from DB if we have a state tracker
  const state = await prisma.indexerState.findUnique({ where: { id: 'deposit_indexer' } });
  if (state) {
    lastProcessedBlock = Number(state.lastBlockProcessed);
    console.log(`[Indexer] Resuming from block ${lastProcessedBlock}`);
  }

  await backfillDepositTransactions(INDEXER_BACKFILL_TX_HASHES);

  setInterval(async () => {
    try {
      await reconcileActiveVaultBalances();
    } catch (err) {
      console.error(`[Indexer] Vault reconciliation loop error:`, err);
    }
  }, Number.isFinite(VAULT_RECONCILE_INTERVAL_MS) && VAULT_RECONCILE_INTERVAL_MS > 0
    ? VAULT_RECONCILE_INTERVAL_MS
    : 15000);

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock <= lastProcessedBlock) return; // Wait for new blocks

      const targetBlock = Math.min(currentBlock, lastProcessedBlock + INDEXER_BLOCK_BATCH_SIZE);

      const filter = paymentContract.filters.Transfer(null, null);
      const logs = await paymentContract.queryFilter(filter, lastProcessedBlock + 1, targetBlock);

      for (const log of logs) {
        if (!('args' in log)) continue; // Ensure it's an EventLog
        await creditDepositTransfer(log.transactionHash, log.index, log.args[1], BigInt(log.args[2]));
      }

      // Update state
      lastProcessedBlock = targetBlock;
      await prisma.indexerState.upsert({
        where: { id: 'deposit_indexer' },
        update: { lastBlockProcessed: lastProcessedBlock },
        create: { id: 'deposit_indexer', lastBlockProcessed: lastProcessedBlock },
      });

    } catch (err) {
      console.error(`[Indexer] Error syncing blocks:`, err);
    }
  }, 3000); // Poll every 3 seconds (BSC block time is ~3s)
}
