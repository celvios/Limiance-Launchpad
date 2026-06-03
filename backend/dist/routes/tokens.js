"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenRoutes = tokenRoutes;
const zod_1 = require("zod");
const prisma_1 = require("../services/prisma");
const bsc_1 = require("../services/bsc");
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DeployBody = zod_1.z.object({
    creator: zod_1.z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    name: zod_1.z.string().min(1).max(32),
    symbol: zod_1.z.string().min(1).max(10),
    description: zod_1.z.string().max(500).default(''),
    imageUri: zod_1.z.string().default(''),
    totalSupply: zod_1.z.number().int().positive(),
    initialBuyAmount: zod_1.z.number().min(0).default(0),
    graduationThreshold: zod_1.z.number().min(40).max(100),
    curveParams: zod_1.z.object({
        pMin: zod_1.z.number().optional(),
        pMax: zod_1.z.number().optional(),
        k: zod_1.z.number().optional(),
        midpoint: zod_1.z.number().optional(),
    }).passthrough(),
});
const FeedQuery = zod_1.z.object({
    filter: zod_1.z.enum(['new', 'trending', 'near_grad', 'graduated', 'following']).default('new'),
    cursor: zod_1.z.string().optional(),
    limit: zod_1.z.coerce.number().min(1).max(50).default(20),
    wallet: zod_1.z.string().optional(),
});
function pseudoAddress(seed) {
    let hash = 0n;
    for (const char of seed) {
        hash = (hash * 33n + BigInt(char.charCodeAt(0))) & ((1n << 160n) - 1n);
    }
    return `0x${hash.toString(16).padStart(40, '0')}`;
}
function toWei(value) {
    return BigInt(Math.round(value * 1e18));
}
function serializeToken(token) {
    const tokenAddress = token.tokenAddress ?? token.mint;
    const supply = BigInt(token.currentSupply.toString());
    const cap = BigInt(token.supplyCap.toString());
    const price = BigInt(token.curveParamA.toString());
    const marketCap = cap > 0n ? (price * supply) / 1000000000000000000n : 0n;
    return {
        tokenAddress,
        mint: tokenAddress,
        symbol: token.symbol,
        name: token.name,
        imageUri: token.uri,
        description: token.description,
        creatorWallet: token.creator,
        creatorHandle: null,
        createdAt: token.createdAt.getTime(),
        curveType: 'sigmoid',
        curveParams: {
            type: 'sigmoid',
            pMin: Number(token.curveParamB) / 1e18,
            pMax: Number(token.curveParamA) / 1e18,
            k: Number(token.curveParamC) / 1e6,
            midpoint: Number(token.graduationThreshold),
        },
        currentSupply: Number(supply),
        supplyCap: Number(cap),
        graduationThreshold: Number(token.graduationThreshold),
        status: token.status,
        price: Number(price) / 1e18,
        priceChange24h: 0,
        marketCap: Number(marketCap) / 1e18,
        commentCount: 0,
        sparklineData: [],
        volume24h: 0,
        holderCount: 0,
        totalSupply: Number(cap),
        basePrice: Number(token.curveParamB) / 1e18,
        platformFee: 3,
        totalRaised: 0,
        dexPoolAddress: token.dexPoolAddress ?? null,
    };
}
async function tokenRoutes(app) {
    app.post('/api/tokens/deploy', async (req, reply) => {
        const parsed = DeployBody.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
        }
        const body = parsed.data;
        const creator = (0, bsc_1.normalizeAddress)(body.creator);
        const tokenAddress = pseudoAddress(`${creator}:${body.symbol}:${Date.now()}`);
        const saleAddress = pseudoAddress(`${tokenAddress}:sale`);
        const supplyCap = BigInt(body.totalSupply) * 1000000000000000000n;
        const graduationThreshold = (supplyCap * BigInt(body.graduationThreshold)) / 100n;
        const token = await prisma_1.prisma.token.create({
            data: {
                mint: tokenAddress,
                tokenAddress,
                saleAddress,
                chainId: bsc_1.BSC_CHAIN_ID,
                creator,
                name: body.name,
                symbol: body.symbol.toUpperCase(),
                uri: body.imageUri,
                description: body.description,
                supplyCap,
                currentSupply: BigInt(body.initialBuyAmount) * 1000000000000000000n,
                graduationThreshold,
                creatorAllocation: 0,
                curveType: 'sigmoid',
                curveParamA: toWei(body.curveParams.pMax ?? 0.1),
                curveParamB: toWei(body.curveParams.pMin ?? 0.00001),
                curveParamC: BigInt(Math.round((body.curveParams.k ?? 0.002) * 1e6)),
                status: 'active',
            },
        });
        if (body.initialBuyAmount > 0) {
            await prisma_1.prisma.trade.create({
                data: {
                    tokenMint: tokenAddress,
                    tokenAddress,
                    walletAddress: creator,
                    type: 'buy',
                    amount: BigInt(body.initialBuyAmount) * 1000000000000000000n,
                    solAmount: 0n, // Legacy
                    paymentAmount: 0n, // Approximated for simulation
                    paymentAsset: '0x0000000000000000000000000000000000000000',
                    pricePerToken: toWei(body.curveParams.pMin ?? 0.00001),
                    txSignature: `initial-buy-${token.id}`,
                    timestamp: new Date(),
                    isWhale: false,
                },
            });
        }
        return reply.code(201).send({
            success: true,
            tokenAddress,
            saleAddress,
            mint: tokenAddress,
            txSignature: `pending:${token.id}`,
        });
    });
    app.get('/api/tokens/check-name', async (req, reply) => {
        const { name } = req.query;
        const existing = name
            ? await prisma_1.prisma.token.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } })
            : null;
        return reply.send({ available: !existing });
    });
    app.get('/api/tokens/check-symbol', async (req, reply) => {
        const { symbol } = req.query;
        const existing = symbol
            ? await prisma_1.prisma.token.findFirst({ where: { symbol: { equals: symbol, mode: 'insensitive' } } })
            : null;
        return reply.send({ available: !existing });
    });
    app.get('/api/tokens', async (req, reply) => {
        const parsed = FeedQuery.safeParse(req.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
        }
        const where = {};
        if (parsed.data.filter === 'graduated')
            where.status = 'graduated';
        else
            where.status = 'active';
        if (parsed.data.cursor)
            where.createdAt = { lt: new Date(parsed.data.cursor) };
        const tokens = await prisma_1.prisma.token.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: parsed.data.limit + 1,
        });
        const page = tokens.slice(0, parsed.data.limit);
        const nextCursor = tokens.length > parsed.data.limit ? page[page.length - 1]?.createdAt.toISOString() : null;
        return reply.send({ tokens: page.map(serializeToken), nextCursor, total: page.length });
    });
    app.get('/api/tokens/:address', async (req, reply) => {
        const { address } = req.params;
        const tokenAddress = address.toLowerCase();
        const token = await prisma_1.prisma.token.findFirst({
            where: { OR: [{ tokenAddress }, { mint: tokenAddress }] },
        });
        if (!token)
            return reply.code(404).send({ error: 'Token not found', code: 'NOT_FOUND' });
        return reply.send(serializeToken(token));
    });
}
//# sourceMappingURL=tokens.js.map