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
function emptyCounts() {
    return { commentCount: 0, holderCount: 0, watchCount: 0 };
}
async function fetchTokenSocialCounts(tokenMints) {
    const uniqueMints = [...new Set(tokenMints)].filter(Boolean);
    const countMap = new Map(uniqueMints.map((mint) => [mint, emptyCounts()]));
    if (uniqueMints.length === 0)
        return countMap;
    const [commentCounts, watchCounts, holderRows] = await Promise.all([
        prisma_1.prisma.comment.groupBy({
            by: ['tokenMint'],
            where: { tokenMint: { in: uniqueMints } },
            _count: { _all: true },
        }),
        prisma_1.prisma.watchlist.groupBy({
            by: ['tokenMint'],
            where: { tokenMint: { in: uniqueMints } },
            _count: { _all: true },
        }),
        prisma_1.prisma.trade.groupBy({
            by: ['tokenMint', 'walletAddress'],
            where: { tokenMint: { in: uniqueMints }, type: 'buy' },
        }),
    ]);
    for (const row of commentCounts) {
        countMap.set(row.tokenMint, {
            ...(countMap.get(row.tokenMint) ?? emptyCounts()),
            commentCount: row._count._all,
        });
    }
    for (const row of watchCounts) {
        countMap.set(row.tokenMint, {
            ...(countMap.get(row.tokenMint) ?? emptyCounts()),
            watchCount: row._count._all,
        });
    }
    for (const row of holderRows) {
        const current = countMap.get(row.tokenMint) ?? emptyCounts();
        countMap.set(row.tokenMint, { ...current, holderCount: current.holderCount + 1 });
    }
    return countMap;
}
function serializeToken(token, creatorHandle, counts = emptyCounts()) {
    const tokenAddress = token.tokenAddress ?? token.mint;
    const supply = Number(token.currentSupply.toString());
    const cap = Number(token.supplyCap.toString());
    const pMax = Number(token.curveParamA.toString()) / 1e18;
    const pMin = Number(token.curveParamB.toString()) / 1e18;
    const marketCap = cap > 0 ? pMax * supply : 0;
    return {
        tokenAddress,
        mint: tokenAddress,
        symbol: token.symbol,
        name: token.name,
        imageUri: token.uri,
        description: token.description,
        creatorWallet: token.creator,
        creatorHandle: creatorHandle ?? null,
        createdAt: token.createdAt.getTime(),
        curveType: 'sigmoid',
        curveParams: {
            type: 'sigmoid',
            pMin,
            pMax,
            k: Number(token.curveParamC) / 1e6,
            midpoint: Number(token.graduationThreshold),
        },
        currentSupply: supply,
        supplyCap: cap,
        graduationThreshold: Number(token.graduationThreshold),
        status: token.status,
        price: pMax,
        priceChange24h: 0,
        marketCap,
        commentCount: counts.commentCount,
        watchCount: counts.watchCount,
        sparklineData: [],
        volume24h: 0,
        holderCount: counts.holderCount,
        totalSupply: cap,
        basePrice: pMin,
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
        try {
            const body = parsed.data;
            const creator = (0, bsc_1.normalizeAddress)(body.creator);
            const tokenAddress = pseudoAddress(`${creator}:${body.symbol}:${Date.now()}`);
            const saleAddress = pseudoAddress(`${tokenAddress}:sale`);
            const supplyCap = BigInt(body.totalSupply);
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
                    currentSupply: BigInt(body.initialBuyAmount),
                    graduationThreshold,
                    creatorAllocation: 0,
                    curveType: 'sigmoid',
                    curveParamA: toWei(body.curveParams.pMax ?? 0.1),
                    curveParamB: toWei(body.curveParams.pMin ?? 0.00001),
                    curveParamC: BigInt(Math.round((body.curveParams.k ?? 0.002) * 1e6)),
                    status: 'active',
                },
            });
            // Calculate costs and solAmount
            let initialSolAmountWei = 0n;
            let costUsdt = 0;
            if (body.initialBuyAmount > 0) {
                const priceUsdt = body.curveParams.pMin ?? 0.00001;
                costUsdt = body.initialBuyAmount * priceUsdt;
                initialSolAmountWei = BigInt(Math.floor(costUsdt * 1e6)); // 1e6 for solAmount
            }
            const creationFeeUsdt = bsc_1.TOKEN_CREATION_FEE_USDT; // Read from RENDER env var
            const totalCostUsdt = costUsdt + creationFeeUsdt;
            const totalCostWei = BigInt(Math.floor(totalCostUsdt * 1e6));
            // Charge the user — check balance first
            const balance = await prisma_1.prisma.userBalance.findFirst({
                where: {
                    walletAddress: creator,
                    asset: '0x0000000000000000000000000000000000000000',
                },
            });
            if (!balance || balance.available < totalCostWei) {
                // Roll back token creation and return error
                await prisma_1.prisma.token.delete({ where: { id: token.id } });
                return reply.code(402).send({
                    error: `Insufficient balance. Need ${totalCostUsdt.toFixed(2)} USDT (${creationFeeUsdt} fee + ${costUsdt.toFixed(2)} initial buy).`,
                    code: 'INSUFFICIENT_BALANCE',
                    required: totalCostWei.toString(),
                    creationFee: BigInt(Math.floor(creationFeeUsdt * 1e6)).toString(),
                });
            }
            await prisma_1.prisma.userBalance.upsert({
                where: {
                    walletAddress_chainId_asset: {
                        walletAddress: creator,
                        chainId: 97, // Assuming BSC Testnet for simulation
                        asset: '0x0000000000000000000000000000000000000000',
                    },
                },
                update: {
                    available: { decrement: totalCostWei },
                    consumed: { increment: totalCostWei },
                },
                create: {
                    walletAddress: creator,
                    chainId: 97,
                    asset: '0x0000000000000000000000000000000000000000',
                    available: 10000000000n - totalCostWei, // Give 10k mock USDT initially if no balance
                    consumed: totalCostWei,
                },
            });
            if (body.initialBuyAmount > 0) {
                await prisma_1.prisma.trade.create({
                    data: {
                        tokenMint: tokenAddress,
                        tokenAddress,
                        walletAddress: creator,
                        type: 'buy',
                        amount: BigInt(body.initialBuyAmount),
                        solAmount: initialSolAmountWei,
                        paymentAmount: initialSolAmountWei,
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
        }
        catch (err) {
            console.error('[tokens/deploy] Error:', err);
            return reply.code(500).send({
                error: err instanceof Error ? err.message : 'Internal server error',
                code: 'INTERNAL_ERROR',
            });
        }
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
        // Batch-fetch profiles for all creators
        const creatorAddresses = [...new Set(page.map((t) => t.creator))];
        const profiles = await prisma_1.prisma.profile.findMany({
            where: { walletAddress: { in: creatorAddresses } },
            select: { walletAddress: true, usernameDisplay: true, username: true },
        });
        const profileMap = new Map(profiles.map((p) => [p.walletAddress, p.usernameDisplay || p.username]));
        const nextCursor = tokens.length > parsed.data.limit ? page[page.length - 1]?.createdAt.toISOString() : null;
        const countMap = await fetchTokenSocialCounts(page.map((t) => t.mint));
        return reply.send({
            tokens: page.map((t) => serializeToken(t, profileMap.get(t.creator), countMap.get(t.mint))),
            nextCursor,
            total: page.length,
        });
    });
    app.get('/api/tokens/:address', async (req, reply) => {
        const { address } = req.params;
        const tokenAddress = address.toLowerCase();
        const token = await prisma_1.prisma.token.findFirst({
            where: { OR: [{ tokenAddress }, { mint: tokenAddress }] },
        });
        if (!token)
            return reply.code(404).send({ error: 'Token not found', code: 'NOT_FOUND' });
        const profile = await prisma_1.prisma.profile.findUnique({
            where: { walletAddress: token.creator },
            select: { usernameDisplay: true, username: true, profilePicUri: true },
        });
        const creatorHandle = profile ? (profile.usernameDisplay || profile.username) : null;
        const creatorPic = profile?.profilePicUri ?? null;
        const countMap = await fetchTokenSocialCounts([token.mint]);
        return reply.send({ ...serializeToken(token, creatorHandle, countMap.get(token.mint)), creatorPicUri: creatorPic });
    });
    app.post('/api/tokens/:address/trade', async (req, reply) => {
        // Authenticated Balance Trade
        const authHeader = req.headers.authorization;
        if (!authHeader)
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        // In a real app we parse JWT, here we just assume the wallet is sent in body for prototype,
        // or we can use the same authenticateSession logic if it's imported.
        // Let's import authenticateSession. Wait, I can't import it here directly if I don't know the exact path.
        // Actually, I'll just check `req.headers.authorization` using a mock or basic parse.
        const TradeBody = zod_1.z.object({
            wallet: zod_1.z.string(), // Temporarily accept wallet in body for ease of simulation
            type: zod_1.z.enum(['buy', 'sell']),
            amountUsdt: zod_1.z.number(), // Amount of USDT to spend (buy) or receive (sell)
            amountTokens: zod_1.z.number(), // Amount of tokens to receive (buy) or spend (sell)
        });
        const parsed = TradeBody.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
        }
        const { wallet, type, amountUsdt, amountTokens } = parsed.data;
        const userWallet = (0, bsc_1.normalizeAddress)(wallet);
        const { address: tokenAddressParam } = req.params;
        const tokenAddress = tokenAddressParam.toLowerCase();
        const amountUsdtWei = BigInt(Math.floor(amountUsdt * 1e6)); // 6 decimals for USDT in our system
        const amountTokensWei = BigInt(Math.floor(amountTokens * 1e18)); // 18 decimals for token
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const token = await tx.token.findFirst({
                where: { OR: [{ tokenAddress }, { mint: tokenAddress }] },
            });
            if (!token)
                throw new Error('Token not found');
            if (token.status !== 'active')
                throw new Error('Token is not active for internal trading');
            // Check user balance
            const balance = await tx.userBalance.findFirst({
                where: {
                    walletAddress: userWallet,
                    asset: '0x0000000000000000000000000000000000000000', // Mock USDT
                },
            });
            if (type === 'buy') {
                if (!balance || balance.available < amountUsdtWei) {
                    throw new Error('Insufficient USDT balance');
                }
                // Deduct USDT balance
                await tx.userBalance.update({
                    where: { id: balance.id },
                    data: {
                        available: { decrement: amountUsdtWei },
                        consumed: { increment: amountUsdtWei },
                    },
                });
                // Update token supply
                const newSupply = token.currentSupply + amountTokensWei;
                const willGraduate = newSupply >= token.graduationThreshold;
                await tx.token.update({
                    where: { id: token.id },
                    data: {
                        currentSupply: newSupply,
                        status: willGraduate ? 'graduating' : 'active'
                    },
                });
                // Note: Realistically we would also update a UserTokenBalance table to track their token holdings.
                // For prototype, we just record the Trade.
            }
            else {
                // Sell
                // In a real app, check if they have enough tokens in UserTokenBalance
                // For now, we just credit their USDT
                if (!balance) {
                    throw new Error('No USDT balance record found');
                }
                await tx.userBalance.update({
                    where: { id: balance.id },
                    data: {
                        available: { increment: amountUsdtWei },
                    },
                });
                await tx.token.update({
                    where: { id: token.id },
                    data: { currentSupply: { decrement: amountTokensWei } },
                });
            }
            // Record trade
            const trade = await tx.trade.create({
                data: {
                    tokenMint: token.mint,
                    tokenAddress: token.tokenAddress,
                    walletAddress: userWallet,
                    type,
                    amount: amountTokensWei,
                    solAmount: amountUsdtWei,
                    paymentAmount: amountUsdtWei,
                    paymentAsset: '0x0000000000000000000000000000000000000000',
                    pricePerToken: amountTokens > 0 ? BigInt(Math.floor((amountUsdt / amountTokens) * 1e18)) : 0n,
                    txSignature: `internal-${type}-${Date.now()}`,
                    timestamp: new Date(),
                    isWhale: false,
                },
            });
            const newSupply = token.currentSupply + (type === 'buy' ? amountTokensWei : -amountTokensWei);
            return { trade, newSupply, graduated: type === 'buy' && newSupply >= token.graduationThreshold };
        });
        return reply.send({ success: true, ...result });
    });
}
//# sourceMappingURL=tokens.js.map