"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenRoutes = tokenRoutes;
const zod_1 = require("zod");
const prisma_1 = require("../services/prisma");
const bsc_1 = require("../services/bsc");
const server_1 = require("../ws/server");
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
    return { commentCount: 0, holderCount: 0, watchCount: 0, volume24h: 0, totalRaised: 0 };
}
async function fetchTokenSocialCounts(tokenMints) {
    const uniqueMints = [...new Set(tokenMints)].filter(Boolean);
    const countMap = new Map(uniqueMints.map((mint) => [mint, emptyCounts()]));
    if (uniqueMints.length === 0)
        return countMap;
    const [commentCounts, watchCounts, holderRows, volRows, raisedRows] = await Promise.all([
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
        prisma_1.prisma.trade.groupBy({
            by: ['tokenMint'],
            where: {
                tokenMint: { in: uniqueMints },
                timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            },
            _sum: { solAmount: true },
        }),
        prisma_1.prisma.trade.groupBy({
            by: ['tokenMint'],
            where: { tokenMint: { in: uniqueMints }, type: 'buy' },
            _sum: { solAmount: true },
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
    for (const row of volRows) {
        const current = countMap.get(row.tokenMint) ?? emptyCounts();
        countMap.set(row.tokenMint, {
            ...current,
            volume24h: row._sum.solAmount ? Number(row._sum.solAmount) / 1e6 : 0
        });
    }
    for (const row of raisedRows) {
        const current = countMap.get(row.tokenMint) ?? emptyCounts();
        countMap.set(row.tokenMint, {
            ...current,
            totalRaised: row._sum.solAmount ? Number(row._sum.solAmount) / 1e6 : 0
        });
    }
    return countMap;
}
// The sigmoid curve uses graduationThreshold/2 as the midpoint.
// This means:
//   supply=0 → price≈pMin
//   supply=graduationThreshold/2 → price midway between pMin and pMax
//   supply=graduationThreshold → price≈pMax
// curveK=10 gives a nice S-curve shape.
const CURVE_K = 10.0;
function getSigmoidPrice(supply, pMin, pMax, _k, graduationThreshold) {
    if (graduationThreshold <= 0)
        return pMin;
    const midpoint = graduationThreshold / 2;
    const normalizedSupply = supply / midpoint;
    const expVal = Math.exp(-CURVE_K * (normalizedSupply - 1.0));
    return pMin + (pMax - pMin) / (1 + expVal);
}
function getSigmoidIntegral(supply, pMin, pMax, _k, graduationThreshold) {
    if (graduationThreshold <= 0)
        return 0;
    const midpoint = graduationThreshold / 2;
    // Numerical integration via trapezoid rule (100 steps) — avoids overflow
    const steps = 100;
    let total = 0;
    const step = supply / steps;
    for (let i = 0; i < steps; i++) {
        const x0 = i * step;
        const x1 = (i + 1) * step;
        const p0 = getSigmoidPrice(x0, pMin, pMax, 0, graduationThreshold);
        const p1 = getSigmoidPrice(x1, pMin, pMax, 0, graduationThreshold);
        total += (p0 + p1) * step / 2;
    }
    return total;
}
function estimateBuyTokensForPayment(paymentUsdt, currentSupply, pMin, pMax, graduationThreshold) {
    if (paymentUsdt <= 0)
        return 0;
    const remaining = Math.max(0, graduationThreshold - currentSupply);
    if (remaining <= 0)
        return 0;
    let lo = 0;
    let hi = remaining;
    let tokensOut = 0;
    for (let i = 0; i < 48; i++) {
        const mid = (lo + hi) / 2;
        const cost = getSigmoidIntegral(currentSupply + mid, pMin, pMax, 0, graduationThreshold) -
            getSigmoidIntegral(currentSupply, pMin, pMax, 0, graduationThreshold);
        if (cost <= paymentUsdt) {
            tokensOut = mid;
            lo = mid;
        }
        else {
            hi = mid;
        }
    }
    return Math.floor(tokensOut);
}
function serializeToken(token, creatorHandle, counts = emptyCounts()) {
    const tokenAddress = token.tokenAddress ?? token.mint;
    const supply = Number(token.currentSupply.toString());
    const cap = Number(token.supplyCap.toString());
    const pMax = Number(token.curveParamA.toString()) / 1e18;
    const pMin = Number(token.curveParamB.toString()) / 1e18;
    const k = Number(token.curveParamC) / 1e6; // k stored for reference; curve now uses graduationThreshold/2 as midpoint
    const graduationThresholdNum = Number(token.graduationThreshold);
    const currentPrice = getSigmoidPrice(supply, pMin, pMax, k, graduationThresholdNum);
    const totalRaised = counts.totalRaised;
    // Market cap = current price × total supply cap (fully diluted)
    const marketCap = cap > 0 ? currentPrice * cap : 0;
    // Circulating market cap = current price × tokens already sold
    const circulatingMarketCap = currentPrice * supply;
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
            k,
            midpoint: graduationThresholdNum / 2,
        },
        currentSupply: supply,
        supplyCap: cap,
        graduationThreshold: graduationThresholdNum,
        status: token.status,
        price: currentPrice,
        priceChange24h: 0,
        marketCap,
        circulatingMarketCap,
        commentCount: counts.commentCount,
        watchCount: counts.watchCount,
        sparklineData: [],
        volume24h: counts.volume24h,
        holderCount: counts.holderCount,
        totalSupply: cap,
        basePrice: pMin,
        platformFee: 3,
        totalRaised,
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
                    asset: bsc_1.PAYMENT_ASSET,
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
                        asset: bsc_1.PAYMENT_ASSET,
                    },
                },
                update: {
                    available: { decrement: totalCostWei },
                    consumed: { increment: totalCostWei },
                },
                create: {
                    walletAddress: creator,
                    chainId: 97,
                    asset: bsc_1.PAYMENT_ASSET,
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
                        paymentAsset: bsc_1.PAYMENT_ASSET,
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
        // Authenticated Balance Trade — fully backend-tracked (no on-chain tx per trade)
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        const TradeBody = zod_1.z.object({
            wallet: zod_1.z.string(),
            type: zod_1.z.enum(['buy', 'sell']),
            amountUsdt: zod_1.z.number().positive(), // USDT to spend (buy) or USDT to receive (sell)
            amountTokens: zod_1.z.number().nonnegative().optional(), // Optional for buys; required for sells
        });
        const parsed = TradeBody.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
        }
        const { wallet, type, amountUsdt } = parsed.data;
        const userWallet = (0, bsc_1.normalizeAddress)(wallet);
        const { address: tokenAddressParam } = req.params;
        const tokenAddress = tokenAddressParam.toLowerCase();
        // USDT: 6 decimals for DB storage.
        const amountUsdtWei = BigInt(Math.round(amountUsdt * 1e6));
        try {
            const result = await prisma_1.prisma.$transaction(async (tx) => {
                const token = await tx.token.findFirst({
                    where: { OR: [{ tokenAddress }, { mint: tokenAddress }] },
                });
                if (!token)
                    throw new Error('Token not found');
                // Allow trading on 'active' and 'graduating' tokens (graduation is async)
                if (token.status !== 'active' && token.status !== 'graduating') {
                    throw new Error(`Token is not available for trading (status: ${token.status})`);
                }
                const usdtBalance = await tx.userBalance.findFirst({
                    where: { walletAddress: userWallet, asset: bsc_1.PAYMENT_ASSET },
                });
                const pMax = Number(token.curveParamA.toString()) / 1e18;
                const pMin = Number(token.curveParamB.toString()) / 1e18;
                const currentSupply = Number(token.currentSupply.toString());
                const graduationThreshold = Number(token.graduationThreshold.toString());
                const resolvedAmountTokens = type === 'buy'
                    ? estimateBuyTokensForPayment(amountUsdt, currentSupply, pMin, pMax, graduationThreshold)
                    : (parsed.data.amountTokens ?? 0);
                if (resolvedAmountTokens <= 0) {
                    throw new Error(type === 'buy' ? 'Amount is too small for the current curve price' : 'Token amount must be greater than 0');
                }
                // Tokens: TWO representations needed:
                //   amountTokensRaw = raw integer units for currentSupply/graduationThreshold.
                //   amountTokensWei = 6-decimal units for UserTokenBalance.
                const amountTokensRaw = BigInt(Math.round(resolvedAmountTokens));
                const amountTokensWei = BigInt(Math.round(resolvedAmountTokens * 1e6));
                if (type === 'buy') {
                    // ── BUY ──────────────────────────────────────────────────────────────
                    if (!usdtBalance || usdtBalance.available < amountUsdtWei) {
                        throw new Error('Insufficient USDT balance — please deposit more');
                    }
                    // Deduct USDT
                    await tx.userBalance.update({
                        where: { id: usdtBalance.id },
                        data: { available: { decrement: amountUsdtWei }, consumed: { increment: amountUsdtWei } },
                    });
                    // Credit token balance (6-decimal scaled for UserTokenBalance)
                    const existingTokenBal = await tx.userTokenBalance.findUnique({
                        where: { walletAddress_tokenAddress: { walletAddress: userWallet, tokenAddress: token.mint } },
                    });
                    if (existingTokenBal) {
                        await tx.userTokenBalance.update({
                            where: { id: existingTokenBal.id },
                            data: { amount: { increment: amountTokensWei } },
                        });
                    }
                    else {
                        await tx.userTokenBalance.create({
                            data: { walletAddress: userWallet, tokenAddress: token.mint, amount: amountTokensWei },
                        });
                    }
                    // Advance the bonding curve supply (raw integer units — matches graduationThreshold scale)
                    const newSupply = token.currentSupply + amountTokensRaw;
                    const willGraduate = newSupply >= token.graduationThreshold;
                    await tx.token.update({
                        where: { id: token.id },
                        data: {
                            currentSupply: newSupply,
                            status: willGraduate ? 'graduating' : 'active',
                        },
                    });
                }
                else {
                    // ── SELL ─────────────────────────────────────────────────────────────
                    const tokenBalance = await tx.userTokenBalance.findUnique({
                        where: { walletAddress_tokenAddress: { walletAddress: userWallet, tokenAddress: token.mint } },
                    });
                    if (!tokenBalance || tokenBalance.amount < amountTokensWei) {
                        throw new Error('Insufficient token balance to sell');
                    }
                    // Deduct token balance
                    await tx.userTokenBalance.update({
                        where: { walletAddress_tokenAddress: { walletAddress: userWallet, tokenAddress: token.mint } },
                        data: { amount: { decrement: amountTokensWei } },
                    });
                    // Credit USDT
                    if (usdtBalance) {
                        await tx.userBalance.update({
                            where: { id: usdtBalance.id },
                            data: { available: { increment: amountUsdtWei } },
                        });
                    }
                    else {
                        await tx.userBalance.create({
                            data: {
                                walletAddress: userWallet,
                                chainId: bsc_1.BSC_CHAIN_ID,
                                asset: bsc_1.PAYMENT_ASSET,
                                available: amountUsdtWei,
                            },
                        });
                    }
                    // Roll back the bonding curve supply (raw integer units)
                    const newSupply = token.currentSupply - amountTokensRaw;
                    await tx.token.update({
                        where: { id: token.id },
                        data: { currentSupply: newSupply > 0n ? newSupply : 0n },
                    });
                }
                // Record trade activity
                const trade = await tx.trade.create({
                    data: {
                        tokenMint: token.mint,
                        tokenAddress: token.tokenAddress,
                        walletAddress: userWallet,
                        type,
                        amount: amountTokensWei,
                        solAmount: amountUsdtWei,
                        paymentAmount: amountUsdtWei,
                        paymentAsset: bsc_1.PAYMENT_ASSET,
                        pricePerToken: resolvedAmountTokens > 0 ? BigInt(Math.round((amountUsdt / resolvedAmountTokens) * 1e18)) : 0n,
                        txSignature: `internal-${type}-${Date.now()}`,
                        timestamp: new Date(),
                        isWhale: amountUsdt >= 1000,
                    },
                });
                const finalSupply = type === 'buy'
                    ? token.currentSupply + amountTokensRaw
                    : token.currentSupply - amountTokensRaw;
                return {
                    trade: {
                        ...trade,
                        amount: trade.amount.toString(),
                        solAmount: trade.solAmount.toString(),
                        paymentAmount: trade.paymentAmount?.toString() ?? null,
                        pricePerToken: trade.pricePerToken.toString(),
                    },
                    tokenSymbol: token.symbol,
                    newSupply: finalSupply.toString(),
                    graduated: type === 'buy' && finalSupply >= token.graduationThreshold
                };
            });
            (0, server_1.broadcast)({
                id: result.trade.id,
                type: result.trade.type,
                tokenMint: result.trade.tokenMint,
                tokenSymbol: result.tokenSymbol,
                amount: Number(result.trade.amount) / 1e6,
                solAmount: Number(result.trade.solAmount) / 1e6,
                walletAddress: result.trade.walletAddress,
                txSignature: result.trade.txSignature,
                timestamp: new Date(result.trade.timestamp).getTime(),
                isWhale: result.trade.isWhale,
            });
            return reply.send({ success: true, ...result });
        }
        catch (err) {
            return reply.code(400).send({ error: err.message, code: 'TRADE_ERROR' });
        }
    });
    // ── GET /api/tokens/:address/my-balance ─────────────────────────────────────
    // Returns the calling wallet's platform token balance for a specific token.
    app.get('/api/tokens/:address/my-balance', async (req, reply) => {
        const { wallet } = req.query;
        if (!wallet)
            return reply.code(400).send({ error: 'wallet query param required' });
        const { address: tokenAddressParam } = req.params;
        const tokenAddress = tokenAddressParam.toLowerCase();
        const userWallet = (0, bsc_1.normalizeAddress)(wallet);
        const token = await prisma_1.prisma.token.findFirst({
            where: { OR: [{ tokenAddress }, { mint: tokenAddress }] },
            select: { mint: true },
        });
        if (!token)
            return reply.code(404).send({ error: 'Token not found' });
        const tokenBalance = await prisma_1.prisma.userTokenBalance.findUnique({
            where: { walletAddress_tokenAddress: { walletAddress: userWallet, tokenAddress: token.mint } },
        });
        return reply.send({ amount: tokenBalance?.amount.toString() ?? '0' });
    });
    // ── POST /api/admin/tokens/:address/reset-status ─────────────────────────────
    // Admin-only: resets a stuck token back to 'active' for testing/recovery.
    // Pass ?resetSupply=true to also zero out currentSupply (fixes corrupted scale data).
    app.post('/api/admin/tokens/:address/reset-status', async (req, reply) => {
        const secret = req.headers['x-admin-secret'] ?? '';
        if (secret !== (process.env.ADMIN_SECRET ?? 'limiance-admin')) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const { address: tokenAddressParam } = req.params;
        const tokenAddress = tokenAddressParam.toLowerCase();
        const { resetSupply } = req.query;
        const token = await prisma_1.prisma.token.findFirst({
            where: { OR: [{ tokenAddress }, { mint: tokenAddress }] },
        });
        if (!token)
            return reply.code(404).send({ error: 'Token not found' });
        const updated = await prisma_1.prisma.token.update({
            where: { id: token.id },
            data: {
                status: 'active',
                ...(resetSupply === 'true' ? { currentSupply: 0n } : {}),
            },
        });
        return reply.send({ success: true, id: updated.id, status: updated.status, currentSupply: updated.currentSupply.toString() });
    });
    // ── GET /api/admin/diagnose ───────────────────────────────────────────────────
    // Returns full DB state for debugging. Protected by admin secret.
    app.get('/api/admin/diagnose', async (req, reply) => {
        const secret = req.headers['x-admin-secret'] ?? '';
        if (secret !== (process.env.ADMIN_SECRET ?? 'limiance-admin')) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const tokens = await prisma_1.prisma.token.findMany({
            select: {
                mint: true, symbol: true, name: true,
                currentSupply: true, supplyCap: true, graduationThreshold: true,
                curveParamA: true, curveParamB: true, curveParamC: true,
                status: true, createdAt: true,
            }
        });
        const tokenBals = await prisma_1.prisma.userTokenBalance.findMany();
        const trades = await prisma_1.prisma.trade.findMany({
            orderBy: { timestamp: 'asc' },
            select: {
                id: true, tokenMint: true, type: true, walletAddress: true,
                amount: true, solAmount: true, pricePerToken: true, timestamp: true,
            }
        });
        const usdtBals = await prisma_1.prisma.userBalance.findMany();
        return reply.send({
            tokens: tokens.map(t => ({
                symbol: t.symbol,
                name: t.name,
                mint: t.mint,
                currentSupply: t.currentSupply.toString(),
                supplyCap: t.supplyCap.toString(),
                graduationThreshold: t.graduationThreshold.toString(),
                pMax_raw: t.curveParamA.toString(),
                pMin_raw: t.curveParamB.toString(),
                k_raw: t.curveParamC.toString(),
                pMax: Number(t.curveParamA) / 1e18,
                pMin: Number(t.curveParamB) / 1e18,
                k: Number(t.curveParamC) / 1e6,
                status: t.status,
                marketCapAtCurrentSupply: (Number(t.curveParamB) / 1e18) * Number(t.supplyCap),
            })),
            userTokenBalances: tokenBals.map(b => ({
                wallet: b.walletAddress,
                tokenAddress: b.tokenAddress,
                amountRaw: b.amount.toString(),
                amountHuman: Number(b.amount) / 1e6,
            })),
            trades: trades.map(t => ({
                id: t.id,
                tokenMint: t.tokenMint,
                type: t.type,
                wallet: t.walletAddress,
                tokenAmount: Number(t.amount) / 1e6,
                usdtAmount: Number(t.solAmount) / 1e6,
                pricePerTokenRaw: t.pricePerToken.toString(),
                pricePerTokenHuman: Number(t.pricePerToken) < 1e10 ? Number(t.pricePerToken) / 1e6 : Number(t.pricePerToken) / 1e18,
                timestamp: t.timestamp.toISOString(),
            })),
            usdtBalances: usdtBals.map(b => ({
                wallet: b.walletAddress,
                availableRaw: b.available.toString(),
                availableHuman: Number(b.available) / 1e6,
            })),
        });
    });
    // ── POST /api/admin/fix-supply ────────────────────────────────────────────────
    // Recomputes token.currentSupply from the sum of all buy/sell trades.
    // Also fixes UserTokenBalance by recomputing from trades per wallet.
    app.post('/api/admin/fix-supply', async (req, reply) => {
        const secret = req.headers['x-admin-secret'] ?? '';
        if (secret !== (process.env.ADMIN_SECRET ?? 'limiance-admin')) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const tokens = await prisma_1.prisma.token.findMany({ select: { id: true, mint: true, symbol: true } });
        const results = [];
        for (const token of tokens) {
            // Sum all buy trades - sum all sell trades to get net supply
            const buyTrades = await prisma_1.prisma.trade.findMany({
                where: { tokenMint: token.mint, type: 'buy' },
                select: { amount: true, walletAddress: true },
            });
            const sellTrades = await prisma_1.prisma.trade.findMany({
                where: { tokenMint: token.mint, type: 'sell' },
                select: { amount: true, walletAddress: true },
            });
            // Total supply = sum of buys - sum of sells (in amountTokensWei, i.e. tokens × 1e6)
            const totalBoughtWei = buyTrades.reduce((s, t) => s + t.amount, 0n);
            const totalSoldWei = sellTrades.reduce((s, t) => s + t.amount, 0n);
            const netSupplyWei = totalBoughtWei - totalSoldWei;
            // currentSupply is stored in raw token units (not × 1e6)
            const newCurrentSupply = netSupplyWei / 1000000n;
            await prisma_1.prisma.token.update({
                where: { id: token.id },
                data: { currentSupply: newCurrentSupply > 0n ? newCurrentSupply : 0n },
            });
            // Fix per-wallet token balances
            const wallets = new Set([
                ...buyTrades.map(t => t.walletAddress),
                ...sellTrades.map(t => t.walletAddress),
            ]);
            const walletResults = [];
            for (const wallet of wallets) {
                const bought = buyTrades.filter(t => t.walletAddress === wallet).reduce((s, t) => s + t.amount, 0n);
                const sold = sellTrades.filter(t => t.walletAddress === wallet).reduce((s, t) => s + t.amount, 0n);
                const netBalance = bought - sold;
                const finalBalance = netBalance > 0n ? netBalance : 0n;
                await prisma_1.prisma.userTokenBalance.upsert({
                    where: { walletAddress_tokenAddress: { walletAddress: wallet, tokenAddress: token.mint } },
                    create: { walletAddress: wallet, tokenAddress: token.mint, amount: finalBalance },
                    update: { amount: finalBalance },
                });
                walletResults.push({ wallet, boughtRaw: bought.toString(), soldRaw: sold.toString(), netBalance: (Number(finalBalance) / 1e6).toFixed(2) });
            }
            results.push({
                symbol: token.symbol,
                mint: token.mint,
                newCurrentSupply: newCurrentSupply.toString(),
                wallets: walletResults,
            });
        }
        return reply.send({ success: true, results });
    });
}
//# sourceMappingURL=tokens.js.map