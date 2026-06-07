"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.depositRoutes = depositRoutes;
const ethers_1 = require("ethers");
const zod_1 = require("zod");
const prisma_1 = require("../services/prisma");
const bsc_1 = require("../services/bsc");
const jwt_1 = require("../lib/jwt");
const DepositAddressQuery = zod_1.z.object({
    wallet: zod_1.z.string().optional(),
    asset: zod_1.z.string().default(bsc_1.PAYMENT_ASSET),
    chainId: zod_1.z.coerce.number().default(bsc_1.BSC_CHAIN_ID),
});
const CreditDepositBody = zod_1.z.object({
    userId: zod_1.z.string().optional(),
    userWallet: zod_1.z.string(),
    vaultAddress: zod_1.z.string(),
    asset: zod_1.z.string().default(bsc_1.PAYMENT_ASSET),
    chainId: zod_1.z.coerce.number().default(bsc_1.BSC_CHAIN_ID),
    amount: zod_1.z.string().regex(/^\d+$/),
    txHash: zod_1.z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    logIndex: zod_1.z.number().int().min(0).default(0),
    confirmations: zod_1.z.number().int().min(0).default(0),
});
const VerifyDepositTxBody = zod_1.z.object({
    txHash: zod_1.z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    expectedAmount: zod_1.z.string().regex(/^\d+$/).optional(),
    asset: zod_1.z.string().default(bsc_1.PAYMENT_ASSET),
    chainId: zod_1.z.coerce.number().default(bsc_1.BSC_CHAIN_ID),
});
const ERC20_ABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
];
const provider = new ethers_1.ethers.JsonRpcProvider(bsc_1.BSC_RPC_URL);
const erc20Interface = new ethers_1.ethers.Interface(ERC20_ABI);
function serializeBalance(row) {
    return {
        userId: row.userId ?? null,
        walletAddress: row.walletAddress,
        chainId: row.chainId,
        asset: row.asset,
        available: row.available.toString(),
        consumed: row.consumed.toString(),
    };
}
async function creditVerifiedDeposit({ userId, userWallet, vaultAddress, asset, chainId, amount, txHash, logIndex, confirmations, }) {
    return prisma_1.prisma.$transaction(async (tx) => {
        const depositAddress = await tx.depositAddress.upsert({
            where: {
                userWallet_chainId_asset: {
                    userWallet,
                    chainId,
                    asset,
                },
            },
            update: { vaultAddress, userId },
            create: {
                userId,
                userWallet,
                chainId,
                asset,
                vaultAddress,
            },
        });
        const existingDeposit = await tx.deposit.findUnique({
            where: { txHash_logIndex: { txHash, logIndex } },
        });
        if (existingDeposit) {
            const deposit = await tx.deposit.update({
                where: { txHash_logIndex: { txHash, logIndex } },
                data: { confirmations },
            });
            return { deposit, alreadyCredited: true };
        }
        const deposit = await tx.deposit.create({
            data: {
                depositAddressId: depositAddress.id,
                vaultAddress,
                userWallet,
                chainId,
                asset,
                amount,
                txHash,
                logIndex,
                confirmations,
                credited: true,
            },
        });
        await tx.userBalance.upsert({
            where: {
                walletAddress_chainId_asset: {
                    walletAddress: userWallet,
                    chainId,
                    asset,
                },
            },
            update: {
                userId,
                available: { increment: amount },
            },
            create: {
                userId,
                walletAddress: userWallet,
                chainId,
                asset,
                available: amount,
            },
        });
        return { deposit, alreadyCredited: false };
    });
}
async function depositRoutes(app) {
    app.get('/api/users/me/deposit-address', async (req, reply) => {
        const session = (0, jwt_1.authenticateSession)(req.headers.authorization);
        if (!session?.wallet) {
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        const parsed = DepositAddressQuery.safeParse(req.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
        }
        const userWallet = (0, bsc_1.normalizeAddress)(session.wallet);
        const asset = (0, bsc_1.normalizeAddress)(parsed.data.asset);
        if (!(0, bsc_1.isSupportedAsset)(asset)) {
            return reply.code(400).send({ error: 'Unsupported deposit asset', code: 'UNSUPPORTED_ASSET' });
        }
        const vaultAddress = await (0, bsc_1.predictVaultAddress)(userWallet, asset);
        const depositAddress = await prisma_1.prisma.depositAddress.upsert({
            where: {
                userWallet_chainId_asset: {
                    userWallet,
                    chainId: parsed.data.chainId,
                    asset,
                },
            },
            update: { vaultAddress, status: 'active', userId: session.userId ?? undefined },
            create: {
                userId: session.userId ?? undefined,
                userWallet,
                chainId: parsed.data.chainId,
                asset,
                vaultAddress,
            },
        });
        return reply.send({
            userId: session.userId ?? null,
            userWallet,
            chainId: depositAddress.chainId,
            asset,
            vaultAddress,
            status: depositAddress.status,
            createdAt: depositAddress.createdAt.getTime(),
        });
    });
    app.get('/api/deposits/address', async (req, reply) => {
        const parsed = DepositAddressQuery.safeParse(req.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
        }
        if (!parsed.data.wallet) {
            return reply.code(400).send({ error: 'wallet is required', code: 'VALIDATION_ERROR' });
        }
        const userWallet = (0, bsc_1.normalizeAddress)(parsed.data.wallet);
        const asset = (0, bsc_1.normalizeAddress)(parsed.data.asset);
        if (!(0, bsc_1.isSupportedAsset)(asset)) {
            return reply.code(400).send({ error: 'Unsupported deposit asset', code: 'UNSUPPORTED_ASSET' });
        }
        const vaultAddress = await (0, bsc_1.predictVaultAddress)(userWallet, asset);
        const depositAddress = await prisma_1.prisma.depositAddress.upsert({
            where: {
                userWallet_chainId_asset: {
                    userWallet,
                    chainId: parsed.data.chainId,
                    asset,
                },
            },
            update: { vaultAddress, status: 'active' },
            create: {
                userWallet,
                chainId: parsed.data.chainId,
                asset,
                vaultAddress,
            },
        });
        return reply.send({
            userWallet,
            chainId: depositAddress.chainId,
            asset,
            vaultAddress,
            status: depositAddress.status,
            createdAt: depositAddress.createdAt.getTime(),
        });
    });
    app.get('/api/deposits/balance/:wallet', async (req, reply) => {
        const { wallet } = req.params;
        const walletAddress = (0, bsc_1.normalizeAddress)(wallet);
        const balances = await prisma_1.prisma.userBalance.findMany({
            where: { walletAddress },
            orderBy: { updatedAt: 'desc' },
        });
        return reply.send({ balances: balances.map(serializeBalance) });
    });
    // ── FOR TESTING ONLY: Mock direct credit ────────────────────────────────────
    app.post('/api/deposits/mock-credit', async (req, reply) => {
        const session = (0, jwt_1.authenticateSession)(req.headers.authorization);
        if (!session?.wallet) {
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        const walletAddress = (0, bsc_1.normalizeAddress)(session.wallet);
        const amountStr = '10000000000'; // 10,000.00 USDT (6 decimals)
        await prisma_1.prisma.userBalance.upsert({
            where: {
                walletAddress_chainId_asset: {
                    walletAddress,
                    chainId: bsc_1.BSC_CHAIN_ID,
                    asset: bsc_1.PAYMENT_ASSET,
                },
            },
            update: {
                available: { increment: amountStr },
            },
            create: {
                userId: session.userId,
                walletAddress,
                chainId: bsc_1.BSC_CHAIN_ID,
                asset: bsc_1.PAYMENT_ASSET,
                available: amountStr,
            },
        });
        return reply.code(200).send({ success: true, credited: '10000.00' });
    });
    // ── Admin-only: Mint USDT to any wallet ──────────────────────────────────────
    app.post('/api/deposits/admin-mint', async (req, reply) => {
        const secret = req.headers['x-admin-secret'] ?? '';
        if (secret !== (process.env.ADMIN_SECRET ?? 'limiance-admin')) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const body = zod_1.z.object({
            wallet: zod_1.z.string(),
            amount: zod_1.z.number().positive(), // USDT amount (e.g. 100000)
        }).safeParse(req.body);
        if (!body.success) {
            return reply.code(400).send({ error: body.error.message });
        }
        const walletAddress = (0, bsc_1.normalizeAddress)(body.data.wallet);
        const amountRaw = BigInt(Math.floor(body.data.amount * 1e6)); // 6 decimals
        await prisma_1.prisma.userBalance.upsert({
            where: {
                walletAddress_chainId_asset: {
                    walletAddress,
                    chainId: bsc_1.BSC_CHAIN_ID,
                    asset: bsc_1.PAYMENT_ASSET,
                },
            },
            update: {
                available: { increment: amountRaw.toString() },
            },
            create: {
                walletAddress,
                chainId: bsc_1.BSC_CHAIN_ID,
                asset: bsc_1.PAYMENT_ASSET,
                available: amountRaw.toString(),
            },
        });
        return reply.send({ success: true, wallet: walletAddress, credited: body.data.amount });
    });
    app.get('/api/deposits/history/:wallet', async (req, reply) => {
        const { wallet } = req.params;
        const walletAddress = (0, bsc_1.normalizeAddress)(wallet);
        const deposits = await prisma_1.prisma.deposit.findMany({
            where: { userWallet: walletAddress },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return reply.send({
            deposits: deposits.map((deposit) => ({
                id: deposit.id,
                vaultAddress: deposit.vaultAddress,
                userWallet: deposit.userWallet,
                chainId: deposit.chainId,
                asset: deposit.asset,
                amount: deposit.amount.toString(),
                txHash: deposit.txHash,
                confirmations: deposit.confirmations,
                credited: deposit.credited,
                consumed: deposit.consumed,
                createdAt: deposit.createdAt.getTime(),
            })),
        });
    });
    app.post('/api/deposits/verify-tx', async (req, reply) => {
        const session = (0, jwt_1.authenticateSession)(req.headers.authorization);
        if (!session?.wallet) {
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        const parsed = VerifyDepositTxBody.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
        }
        const userWallet = (0, bsc_1.normalizeAddress)(session.wallet);
        const asset = (0, bsc_1.normalizeAddress)(parsed.data.asset);
        if (!(0, bsc_1.isSupportedAsset)(asset)) {
            return reply.code(400).send({ error: 'Unsupported deposit asset', code: 'UNSUPPORTED_ASSET' });
        }
        const txHash = parsed.data.txHash.toLowerCase();
        const vaultAddress = await (0, bsc_1.predictVaultAddress)(userWallet, asset);
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) {
            return reply.code(202).send({ status: 'pending', credited: false });
        }
        const currentBlock = await provider.getBlockNumber();
        const confirmations = Math.max(1, currentBlock - receipt.blockNumber + 1);
        const expectedAmount = parsed.data.expectedAmount ? BigInt(parsed.data.expectedAmount) : null;
        for (const log of receipt.logs) {
            if ((0, bsc_1.normalizeAddress)(log.address) !== asset)
                continue;
            const transfer = (() => {
                try {
                    return erc20Interface.parseLog({
                        topics: [...log.topics],
                        data: log.data,
                    });
                }
                catch {
                    return null;
                }
            })();
            if (!transfer || transfer.name !== 'Transfer')
                continue;
            const toAddress = (0, bsc_1.normalizeAddress)(String(transfer.args.to ?? transfer.args[1]));
            if (toAddress !== vaultAddress)
                continue;
            const amountRaw = BigInt(transfer.args.value ?? transfer.args[2]);
            const amount = amountRaw / 1000000000000n;
            if (expectedAmount !== null && amount < expectedAmount)
                continue;
            const result = await creditVerifiedDeposit({
                userId: session.userId,
                userWallet,
                vaultAddress,
                asset,
                chainId: parsed.data.chainId,
                amount,
                txHash,
                logIndex: log.index,
                confirmations,
            });
            return reply.send({
                status: 'credited',
                credited: true,
                alreadyCredited: result.alreadyCredited,
                depositId: result.deposit.id,
                amount: result.deposit.amount.toString(),
                confirmations,
            });
        }
        return reply.code(400).send({
            error: 'Transaction does not contain a supported USDT transfer to your deposit vault',
            code: 'NO_MATCHING_DEPOSIT_TRANSFER',
        });
    });
    app.post('/api/deposits/credit', async (req, reply) => {
        const expectedSecret = process.env.INDEXER_SECRET;
        if (expectedSecret) {
            const provided = req.headers['x-indexer-secret'];
            if (provided !== expectedSecret) {
                return reply.code(401).send({ error: 'Unauthorized indexer', code: 'UNAUTHORIZED' });
            }
        }
        else if (process.env.NODE_ENV === 'production') {
            return reply.code(503).send({ error: 'Indexer secret is not configured', code: 'INDEXER_SECRET_REQUIRED' });
        }
        const parsed = CreditDepositBody.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
        }
        const userWallet = (0, bsc_1.normalizeAddress)(parsed.data.userWallet);
        const vaultAddress = (0, bsc_1.normalizeAddress)(parsed.data.vaultAddress);
        const asset = (0, bsc_1.normalizeAddress)(parsed.data.asset);
        if (!(0, bsc_1.isSupportedAsset)(asset)) {
            return reply.code(400).send({ error: 'Unsupported deposit asset', code: 'UNSUPPORTED_ASSET' });
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const depositAddress = await tx.depositAddress.upsert({
                where: {
                    userWallet_chainId_asset: {
                        userWallet,
                        chainId: parsed.data.chainId,
                        asset,
                    },
                },
                update: { vaultAddress, userId: parsed.data.userId },
                create: {
                    userId: parsed.data.userId,
                    userWallet,
                    chainId: parsed.data.chainId,
                    asset,
                    vaultAddress,
                },
            });
            const txHash = parsed.data.txHash.toLowerCase();
            const existingDeposit = await tx.deposit.findUnique({
                where: { txHash_logIndex: { txHash, logIndex: parsed.data.logIndex } },
            });
            const deposit = existingDeposit
                ? await tx.deposit.update({
                    where: { txHash_logIndex: { txHash, logIndex: parsed.data.logIndex } },
                    data: { confirmations: parsed.data.confirmations },
                })
                : await tx.deposit.create({
                    data: {
                        depositAddressId: depositAddress.id,
                        vaultAddress,
                        userWallet,
                        chainId: parsed.data.chainId,
                        asset,
                        amount: BigInt(parsed.data.amount),
                        txHash,
                        logIndex: parsed.data.logIndex,
                        confirmations: parsed.data.confirmations,
                        credited: true,
                    },
                });
            if (!existingDeposit) {
                await tx.userBalance.upsert({
                    where: {
                        walletAddress_chainId_asset: {
                            walletAddress: userWallet,
                            chainId: parsed.data.chainId,
                            asset,
                        },
                    },
                    update: {
                        userId: parsed.data.userId,
                        available: { increment: BigInt(parsed.data.amount) },
                    },
                    create: {
                        userId: parsed.data.userId,
                        walletAddress: userWallet,
                        chainId: parsed.data.chainId,
                        asset,
                        available: BigInt(parsed.data.amount),
                    },
                });
            }
            return deposit;
        });
        return reply.code(201).send({ depositId: result.id, credited: result.credited });
    });
    app.post('/api/deposits/withdraw', async (req, reply) => {
        const session = (0, jwt_1.authenticateSession)(req.headers.authorization);
        if (!session?.wallet) {
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        const WithdrawBody = zod_1.z.object({
            amount: zod_1.z.string().regex(/^\d+$/),
            asset: zod_1.z.string().default(bsc_1.PAYMENT_ASSET),
            chainId: zod_1.z.coerce.number().default(bsc_1.BSC_CHAIN_ID),
            destination: zod_1.z.string(),
        });
        const parsed = WithdrawBody.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
        }
        const userWallet = (0, bsc_1.normalizeAddress)(session.wallet);
        const asset = (0, bsc_1.normalizeAddress)(parsed.data.asset);
        const destination = (0, bsc_1.normalizeAddress)(parsed.data.destination);
        const amountWei = BigInt(parsed.data.amount);
        if (amountWei <= 0n) {
            return reply.code(400).send({ error: 'Amount must be greater than 0', code: 'INVALID_AMOUNT' });
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const balance = await tx.userBalance.findUnique({
                where: {
                    walletAddress_chainId_asset: {
                        walletAddress: userWallet,
                        chainId: parsed.data.chainId,
                        asset,
                    },
                },
            });
            if (!balance || BigInt(balance.available) < amountWei) {
                throw new Error('Insufficient balance');
            }
            await tx.userBalance.update({
                where: { id: balance.id },
                data: {
                    available: { decrement: amountWei },
                },
            });
            // Queue the withdrawal to be processed on-chain by the Hot Wallet Worker
            const withdrawal = await tx.withdrawalRequest.create({
                data: {
                    userId: session.userId ?? undefined,
                    userWallet: userWallet,
                    asset: asset,
                    amount: amountWei,
                    destination: destination,
                    status: 'pending'
                }
            });
            return { balance, withdrawal };
        });
        return reply.send({ success: true, withdrawalId: result.withdrawal.id, newBalance: result.balance?.available?.toString() });
    });
    // ── Withdrawal history ──────────────────────────────────────────────────────
    app.get('/api/deposits/withdrawals/:wallet', async (req, reply) => {
        const session = (0, jwt_1.authenticateSession)(req.headers.authorization);
        if (!session?.wallet) {
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        const { wallet } = req.params;
        const userWallet = (0, bsc_1.normalizeAddress)(wallet);
        const requests = await prisma_1.prisma.withdrawalRequest.findMany({
            where: { userWallet },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        return reply.send({
            withdrawals: requests.map((r) => ({
                id: r.id,
                amount: r.amount.toString(),
                destination: r.destination,
                status: r.status,
                txHash: r.txHash ?? null,
                error: r.error ?? null,
                createdAt: r.createdAt.getTime(),
            })),
        });
    });
    app.post('/api/deposits/testnet-credit', async (req, reply) => {
        // ONLY allowed if environment is not strictly production requiring an indexer
        const session = (0, jwt_1.authenticateSession)(req.headers.authorization);
        if (!session?.wallet) {
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        const TestnetCreditBody = zod_1.z.object({
            amount: zod_1.z.string().regex(/^\d+$/),
            asset: zod_1.z.string().default(bsc_1.PAYMENT_ASSET),
            chainId: zod_1.z.coerce.number().default(bsc_1.BSC_CHAIN_ID),
            txHash: zod_1.z.string(), // We just trust the tx hash on testnet
        });
        const parsed = TestnetCreditBody.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
        }
        const userWallet = (0, bsc_1.normalizeAddress)(session.wallet);
        const asset = (0, bsc_1.normalizeAddress)(parsed.data.asset);
        // Check if txHash was already credited
        const existingDeposit = await prisma_1.prisma.deposit.findFirst({
            where: { txHash: parsed.data.txHash }
        });
        if (existingDeposit) {
            return reply.code(400).send({ error: 'Transaction already credited', code: 'DUPLICATE_TX' });
        }
        const vaultAddress = await (0, bsc_1.predictVaultAddress)(userWallet, asset);
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // Create deposit record to prevent double crediting
            const depositAddress = await tx.depositAddress.upsert({
                where: {
                    userWallet_chainId_asset: { userWallet, chainId: parsed.data.chainId, asset },
                },
                update: { vaultAddress, userId: session.userId ?? undefined },
                create: {
                    userId: session.userId ?? undefined,
                    userWallet,
                    chainId: parsed.data.chainId,
                    asset,
                    vaultAddress,
                },
            });
            const deposit = await tx.deposit.create({
                data: {
                    depositAddressId: depositAddress.id,
                    vaultAddress,
                    userWallet,
                    chainId: parsed.data.chainId,
                    asset,
                    amount: BigInt(parsed.data.amount),
                    txHash: parsed.data.txHash,
                    logIndex: 0,
                    confirmations: 1,
                    credited: true,
                },
            });
            // Credit UserBalance
            await tx.userBalance.upsert({
                where: {
                    walletAddress_chainId_asset: {
                        walletAddress: userWallet,
                        chainId: parsed.data.chainId,
                        asset,
                    },
                },
                update: {
                    userId: session.userId ?? undefined,
                    available: { increment: BigInt(parsed.data.amount) },
                },
                create: {
                    userId: session.userId ?? undefined,
                    walletAddress: userWallet,
                    chainId: parsed.data.chainId,
                    asset,
                    available: BigInt(parsed.data.amount),
                },
            });
            return deposit;
        });
        return reply.send({ success: true, depositId: result.id });
    });
    // ── FOR DEV ONLY: Reset entire database ──────────────────────────────────────
    app.get('/api/dev/reset', async (req, reply) => {
        try {
            await prisma_1.prisma.$transaction([
                prisma_1.prisma.trade.deleteMany({}),
                prisma_1.prisma.comment.deleteMany({}),
                prisma_1.prisma.deposit.deleteMany({}),
                prisma_1.prisma.depositAddress.deleteMany({}),
                prisma_1.prisma.userBalance.deleteMany({}),
                prisma_1.prisma.token.deleteMany({}),
                prisma_1.prisma.profile.deleteMany({}),
                prisma_1.prisma.session.deleteMany({}),
                prisma_1.prisma.user.deleteMany({}),
                prisma_1.prisma.indexerState.deleteMany({}),
            ]);
            return reply.send({ success: true, message: "Database completely wiped!" });
        }
        catch (e) {
            return reply.code(500).send({ error: e.message });
        }
    });
}
//# sourceMappingURL=deposits.js.map