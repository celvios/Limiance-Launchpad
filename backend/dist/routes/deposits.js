"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.depositRoutes = depositRoutes;
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
}
//# sourceMappingURL=deposits.js.map