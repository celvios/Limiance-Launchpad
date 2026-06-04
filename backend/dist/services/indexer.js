"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runIndexer = runIndexer;
const ethers_1 = require("ethers");
const prisma_1 = require("./prisma");
const bsc_1 = require("./bsc");
// Standard ERC20 ABI for Transfer event
const ERC20_ABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)'
];
const provider = new ethers_1.ethers.JsonRpcProvider(bsc_1.BSC_RPC_URL);
const paymentContract = new ethers_1.ethers.Contract(bsc_1.PAYMENT_ASSET, ERC20_ABI, provider);
async function runIndexer() {
    console.log(`[Indexer] Starting BSC Deposit Indexer on ${bsc_1.BSC_RPC_URL}`);
    console.log(`[Indexer] Listening for ${bsc_1.PAYMENT_ASSET} transfers`);
    // Simple polling mechanism
    let lastProcessedBlock = await provider.getBlockNumber();
    // Look up last processed block from DB if we have a state tracker
    const state = await prisma_1.prisma.indexerState.findUnique({ where: { id: 'deposit_indexer' } });
    if (state) {
        lastProcessedBlock = Number(state.lastBlockProcessed);
        console.log(`[Indexer] Resuming from block ${lastProcessedBlock}`);
    }
    setInterval(async () => {
        try {
            const currentBlock = await provider.getBlockNumber();
            if (currentBlock <= lastProcessedBlock)
                return; // Wait for new blocks
            const targetBlock = Math.min(currentBlock, lastProcessedBlock + 500); // Batch size 500
            // console.log(`[Indexer] Syncing blocks ${lastProcessedBlock + 1} to ${targetBlock}`);
            const filter = paymentContract.filters.Transfer(null, null);
            const logs = await paymentContract.queryFilter(filter, lastProcessedBlock + 1, targetBlock);
            for (const log of logs) {
                if (!('args' in log))
                    continue; // Ensure it's an EventLog
                const toAddress = (0, bsc_1.normalizeAddress)(log.args[1]);
                const amountWei = BigInt(log.args[2]);
                // Check if the recipient 'toAddress' is one of our tracked DepositVaults
                const vault = await prisma_1.prisma.depositAddress.findFirst({
                    where: { vaultAddress: toAddress },
                });
                if (vault) {
                    console.log(`[Indexer] Detected deposit! ${amountWei} USDT to Vault ${toAddress} (User: ${vault.userWallet})`);
                    // Ensure we haven't already processed this tx Hash (Idempotency)
                    const existingDeposit = await prisma_1.prisma.deposit.findUnique({
                        where: { txHash_logIndex: { txHash: log.transactionHash, logIndex: log.index } },
                    });
                    if (!existingDeposit) {
                        await prisma_1.prisma.$transaction(async (tx) => {
                            // 1. Record the Deposit
                            await tx.deposit.create({
                                data: {
                                    depositAddressId: vault.id,
                                    userWallet: vault.userWallet,
                                    vaultAddress: toAddress,
                                    chainId: vault.chainId,
                                    asset: vault.asset,
                                    amount: amountWei,
                                    txHash: log.transactionHash,
                                    logIndex: log.index,
                                    confirmations: 1,
                                    credited: true,
                                },
                            });
                            // 2. Credit UserBalance
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
                    }
                }
            }
            // Update state
            lastProcessedBlock = targetBlock;
            await prisma_1.prisma.indexerState.upsert({
                where: { id: 'deposit_indexer' },
                update: { lastBlockProcessed: lastProcessedBlock },
                create: { id: 'deposit_indexer', lastBlockProcessed: lastProcessedBlock },
            });
        }
        catch (err) {
            console.error(`[Indexer] Error syncing blocks:`, err);
        }
    }, 3000); // Poll every 3 seconds (BSC block time is ~3s)
}
//# sourceMappingURL=indexer.js.map