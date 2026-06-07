import { ethers } from 'ethers';
import { prisma } from './prisma';
import { BSC_RPC_URL, PAYMENT_ASSET, normalizeAddress } from './bsc';

// Standard ERC20 ABI for Transfer event
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)'
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

  // Ensure we haven't already processed this tx hash + log index.
  const existingDeposit = await prisma.deposit.findUnique({
    where: { txHash_logIndex: { txHash, logIndex } },
  });

  if (existingDeposit) return false;

  await prisma.$transaction(async (tx) => {
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
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock <= lastProcessedBlock) return; // Wait for new blocks

      const targetBlock = Math.min(currentBlock, lastProcessedBlock + INDEXER_BLOCK_BATCH_SIZE);
      // console.log(`[Indexer] Syncing blocks ${lastProcessedBlock + 1} to ${targetBlock}`);

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
