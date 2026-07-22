"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileRoutes = profileRoutes;
const zod_1 = require("zod");
const prisma_1 = require("../services/prisma");
const jwt_1 = require("../lib/jwt");
// ─────────────────────────────────────────────────────────────────────────────
// Validation schemas
// ─────────────────────────────────────────────────────────────────────────────
const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
function getExponentialIntegral(supply, pMin, pMax, graduationThreshold) {
    if (supply <= 0 || graduationThreshold <= 0 || pMin <= 0)
        return 0;
    if (pMax <= pMin)
        return pMin * supply;
    const ratio = pMax / pMin;
    return (pMin * graduationThreshold / Math.log(ratio)) * (Math.pow(ratio, supply / graduationThreshold) - 1);
}
function getExecutableSellValue(tokenAmount, currentSupply, pMin, pMax, graduationThreshold) {
    if (tokenAmount <= 0 || currentSupply <= 0)
        return 0;
    const amount = Math.min(tokenAmount, currentSupply);
    const gross = getExponentialIntegral(currentSupply, pMin, pMax, graduationThreshold)
        - getExponentialIntegral(currentSupply - amount, pMin, pMax, graduationThreshold);
    return Math.max(0, gross * 0.95);
}
const CreateProfileBody = zod_1.z.object({
    walletAddress: zod_1.z.string().min(32).max(44),
    username: zod_1.z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(20, 'Username must be at most 20 characters')
        .regex(USERNAME_RE, 'Username may only contain letters, numbers, and underscores'),
    profilePicUri: zod_1.z.string().nullable().default(null),
    coverUri: zod_1.z.string().nullable().default(null),
});
const UpdateProfileBody = zod_1.z.object({
    walletAddress: zod_1.z.string().min(32).max(44),
    username: zod_1.z
        .string()
        .min(3)
        .max(20)
        .regex(USERNAME_RE)
        .optional(),
    profilePicUri: zod_1.z.string().nullable().optional(),
    coverUri: zod_1.z.string().nullable().optional(),
    bio: zod_1.z.string().max(500).optional(), // accepted but ignored — no bio
});
// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function buildProfileResponse(profile, viewerWallet) {
    const [followerCount, followingCount, tokenCount, graduatedCount, isFollowing] = await Promise.all([
        prisma_1.prisma.follow.count({ where: { followingWallet: profile.walletAddress } }),
        prisma_1.prisma.follow.count({ where: { followerWallet: profile.walletAddress } }),
        prisma_1.prisma.token.count({ where: { creator: profile.walletAddress } }),
        prisma_1.prisma.token.count({
            where: { creator: profile.walletAddress, status: 'graduated' },
        }),
        viewerWallet && viewerWallet !== profile.walletAddress
            ? prisma_1.prisma.follow
                .findUnique({
                where: {
                    followerWallet_followingWallet: {
                        followerWallet: viewerWallet,
                        followingWallet: profile.walletAddress,
                    },
                },
            })
                .then((r) => r !== null)
            : Promise.resolve(false),
    ]);
    return {
        walletAddress: profile.walletAddress,
        username: profile.usernameDisplay || profile.username,
        bio: profile.bio || null,
        profilePicUri: profile.profilePicUri || null,
        coverUri: profile.coverUri || null,
        onboarded: profile.onboarded,
        joinedAt: profile.createdAt.getTime(),
        tokensCreated: tokenCount,
        followerCount,
        followingCount,
        graduatedCount,
        isFollowing,
        isOwnProfile: viewerWallet === profile.walletAddress,
    };
}
async function walletAliases(walletAddress) {
    const wallet = walletAddress.toLowerCase();
    const user = await prisma_1.prisma.user.findFirst({
        where: {
            OR: [
                { primaryWalletAddress: wallet },
                { embeddedSignerAddress: wallet },
                { smartAccountAddress: wallet },
                { wallets: { some: { walletAddress: wallet } } },
            ],
        },
        include: { wallets: { select: { walletAddress: true } } },
    });
    return [
        wallet,
        user?.primaryWalletAddress,
        user?.embeddedSignerAddress,
        user?.smartAccountAddress,
        ...(user?.wallets?.map((w) => w.walletAddress) ?? []),
    ]
        .filter((alias) => typeof alias === 'string' && alias.length > 0)
        .map((alias) => alias.toLowerCase())
        .filter((alias, index, aliases) => aliases.indexOf(alias) === index);
}
async function findOnboardedProfileForWallet(walletAddress) {
    const aliases = await walletAliases(walletAddress);
    return prisma_1.prisma.profile.findFirst({
        where: { walletAddress: { in: aliases }, onboarded: true },
    });
}
async function sessionCanUseWallet(session, walletAddress) {
    const wallet = walletAddress.toLowerCase();
    if (session.wallet?.toLowerCase() === wallet)
        return true;
    if (!session.userId)
        return false;
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: session.userId },
        include: { wallets: { select: { walletAddress: true } } },
    });
    if (!user)
        return false;
    return [
        user.primaryWalletAddress,
        user.embeddedSignerAddress,
        user.smartAccountAddress,
        ...(user.wallets?.map((w) => w.walletAddress) ?? []),
    ]
        .filter(Boolean)
        .map((alias) => alias.toLowerCase())
        .includes(wallet);
}
// ─────────────────────────────────────────────────────────────────────────────
// Route plugin
// ─────────────────────────────────────────────────────────────────────────────
async function profileRoutes(fastify) {
    // ── Check username availability ───────────────────────────────────────────
    fastify.get('/api/profiles/check-username/:username', {
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    }, async (req, reply) => {
        const { username } = req.params;
        // Local format validation
        if (!username || username.length < 3 || username.length > 20) {
            return reply.send({ available: false });
        }
        if (!USERNAME_RE.test(username)) {
            return reply.send({ available: false });
        }
        // Case-insensitive uniqueness check
        const existing = await prisma_1.prisma.profile.findUnique({
            where: { username: username.toLowerCase() },
        });
        return reply.send({ available: existing === null });
    });
    // ── Get profile ───────────────────────────────────────────────────────────
    fastify.get('/api/profiles/:wallet', async (req, reply) => {
        const { wallet } = req.params;
        const viewer = req.query.viewer;
        const profile = await findOnboardedProfileForWallet(wallet);
        if (!profile || !profile.onboarded) {
            return reply.code(404).send({ error: 'Profile not found', code: 'NOT_FOUND' });
        }
        return reply.send(await buildProfileResponse(profile, viewer));
    });
    // ── Create profile (onboarding) ───────────────────────────────────────────
    fastify.post('/api/profiles', {
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    }, async (req, reply) => {
        const parsed = CreateProfileBody.safeParse(req.body);
        if (!parsed.success) {
            return reply
                .code(400)
                .send({ error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'INVALID_BODY' });
        }
        // Always compare lowercased addresses — frontend may send mixed-case
        const walletAddress = parsed.data.walletAddress.toLowerCase();
        const { username, profilePicUri, coverUri } = parsed.data;
        // JWT authentication
        const session = (0, jwt_1.authenticateSession)(req.headers.authorization);
        if (!session?.wallet || !(await sessionCanUseWallet(session, walletAddress))) {
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        // Username format
        if (!USERNAME_RE.test(username) || username.length < 3 || username.length > 20) {
            return reply
                .code(400)
                .send({ error: 'Invalid username format', code: 'INVALID_USERNAME' });
        }
        const usernameLower = username.toLowerCase();
        // Check profile already exists under this wallet or any linked wallet alias
        const existing = await findOnboardedProfileForWallet(walletAddress);
        if (existing) {
            return reply.send({ profile: await buildProfileResponse(existing, session.wallet) });
        }
        // Check username uniqueness
        const usernameTaken = await prisma_1.prisma.profile.findUnique({
            where: { username: usernameLower },
        });
        if (usernameTaken && usernameTaken.walletAddress !== walletAddress) {
            return reply.code(400).send({ error: 'Username taken', code: 'USERNAME_TAKEN' });
        }
        // Upsert (handles wallet connecting for first time vs. completing onboarding)
        const profile = await prisma_1.prisma.profile.upsert({
            where: { walletAddress },
            create: {
                walletAddress,
                username: usernameLower,
                usernameDisplay: username,
                profilePicUri: profilePicUri ?? '',
                coverUri: coverUri ?? '',
                onboarded: true,
            },
            update: {
                username: usernameLower,
                usernameDisplay: username,
                profilePicUri: profilePicUri ?? '',
                coverUri: coverUri ?? '',
                onboarded: true,
            },
        });
        return reply.code(201).send({ profile: await buildProfileResponse(profile) });
    });
    // ── Update profile ────────────────────────────────────────────────────────
    fastify.put('/api/profiles/:wallet', async (req, reply) => {
        const { wallet } = req.params;
        const parsed = UpdateProfileBody.safeParse(req.body);
        if (!parsed.success) {
            return reply
                .code(400)
                .send({ error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'INVALID_BODY' });
        }
        const walletAddress = parsed.data.walletAddress.toLowerCase();
        const { username, profilePicUri, coverUri } = parsed.data;
        const walletParam = wallet.toLowerCase();
        if (walletAddress !== walletParam) {
            return reply.code(403).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        // JWT authentication
        const session = (0, jwt_1.authenticateSession)(req.headers.authorization);
        if (!session?.wallet || !(await sessionCanUseWallet(session, walletAddress))) {
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        const profile = await findOnboardedProfileForWallet(walletAddress);
        if (!profile || !profile.onboarded) {
            return reply.code(404).send({ error: 'Profile not found', code: 'NOT_FOUND' });
        }
        // Validate new username if provided
        const updateData = {};
        if (username !== undefined) {
            if (!USERNAME_RE.test(username) || username.length < 3 || username.length > 20) {
                return reply
                    .code(400)
                    .send({ error: 'Invalid username format', code: 'INVALID_USERNAME' });
            }
            const usernameLower = username.toLowerCase();
            const taken = await prisma_1.prisma.profile.findUnique({
                where: { username: usernameLower },
            });
            if (taken && taken.walletAddress !== profile.walletAddress) {
                return reply.code(409).send({ error: 'Username taken', code: 'USERNAME_TAKEN' });
            }
            updateData.username = usernameLower;
            updateData.usernameDisplay = username;
        }
        if (profilePicUri !== undefined)
            updateData.profilePicUri = profilePicUri ?? '';
        if (coverUri !== undefined)
            updateData.coverUri = coverUri ?? '';
        if (parsed.data.bio !== undefined)
            updateData.bio = parsed.data.bio;
        const updated = await prisma_1.prisma.profile.update({
            where: { walletAddress: profile.walletAddress },
            data: updateData,
        });
        return reply.send({ profile: await buildProfileResponse(updated) });
    });
    // ── Profile sub-resources ─────────────────────────────────────────────────
    // Tokens created by wallet
    fastify.get('/api/profiles/:wallet/tokens', async (req, reply) => {
        const { wallet } = req.params;
        const tokens = await prisma_1.prisma.token.findMany({
            where: { creator: wallet },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return reply.send({
            tokens: tokens.map((t) => {
                const supply = Number(t.currentSupply);
                const cap = Number(t.supplyCap);
                const pMax = Number(t.curveParamA) / 1e18;
                const pMin = Number(t.curveParamB) / 1e18;
                const price = pMin + (pMax - pMin) * (cap > 0 ? supply / cap : 0);
                const tokenAddress = t.tokenAddress ?? t.mint;
                return {
                    tokenAddress,
                    mint: tokenAddress,
                    symbol: t.symbol,
                    name: t.name,
                    imageUri: t.uri,
                    description: t.description,
                    creatorWallet: t.creator,
                    creatorHandle: null,
                    curveType: t.curveType,
                    status: t.status,
                    price,
                    priceChange24h: 0,
                    marketCap: price * supply,
                    sparklineData: [],
                    currentSupply: supply,
                    graduationThreshold: Number(t.graduationThreshold),
                    holderCount: 0,
                    commentCount: 0,
                    volume24h: 0,
                    createdAt: t.createdAt.getTime(),
                };
            }),
        });
    });
    // Holdings — net-positive token positions computed from trades
    fastify.get('/api/profiles/:wallet/holdings', async (req, reply) => {
        const { wallet } = req.params;
        const normalizedWallet = wallet.toLowerCase();
        const trades = await prisma_1.prisma.trade.findMany({
            where: { walletAddress: normalizedWallet },
            select: { tokenMint: true, type: true, amount: true, solAmount: true, timestamp: true, id: true },
            orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
        });
        // Preserve the actual remaining cost basis using FIFO lots. Total buys are
        // not a valid basis after a holder has made one or more sells.
        const lotsByToken = new Map();
        for (const trade of trades) {
            const amount = Number(trade.amount) / 1e6;
            if (trade.type === 'buy') {
                const lots = lotsByToken.get(trade.tokenMint) ?? [];
                lots.push({ amount, cost: Number(trade.solAmount) / 1e6 });
                lotsByToken.set(trade.tokenMint, lots);
                continue;
            }
            let remainingToSell = amount;
            const lots = lotsByToken.get(trade.tokenMint) ?? [];
            while (remainingToSell > 0 && lots.length > 0) {
                const lot = lots[0];
                const removed = Math.min(remainingToSell, lot.amount);
                const fraction = removed / lot.amount;
                lot.amount -= removed;
                lot.cost -= lot.cost * fraction;
                remainingToSell -= removed;
                if (lot.amount <= 1e-9)
                    lots.shift();
            }
        }
        const netHoldings = Array.from(lotsByToken.entries())
            .map(([tokenMint, lots]) => ({
            tokenMint,
            tokenAmount: lots.reduce((sum, lot) => sum + lot.amount, 0),
            costBasis: lots.reduce((sum, lot) => sum + lot.cost, 0),
        }))
            .filter((holding) => holding.tokenAmount > 0);
        if (netHoldings.length === 0) {
            return reply.send({ holdings: [] });
        }
        // Fetch token metadata for held tokens
        const mints = netHoldings.map((h) => h.tokenMint);
        const [tokens, externalTrades] = await Promise.all([
            prisma_1.prisma.token.findMany({ where: { mint: { in: mints } } }),
            prisma_1.prisma.trade.findMany({
                where: { tokenMint: { in: mints }, walletAddress: { not: normalizedWallet } },
                select: { tokenMint: true, timestamp: true },
            }),
        ]);
        const tokenMap = new Map(tokens.map((t) => [t.mint, t]));
        const latestExternalTrade = new Map();
        for (const trade of externalTrades) {
            const timestamp = trade.timestamp.getTime();
            const previous = latestExternalTrade.get(trade.tokenMint) ?? 0;
            if (timestamp > previous)
                latestExternalTrade.set(trade.tokenMint, timestamp);
        }
        const latestHolderTrade = new Map();
        for (const trade of trades) {
            const timestamp = trade.timestamp.getTime();
            const previous = latestHolderTrade.get(trade.tokenMint) ?? 0;
            if (timestamp > previous)
                latestHolderTrade.set(trade.tokenMint, timestamp);
        }
        const holdings = netHoldings
            .map((h) => {
            const token = tokenMap.get(h.tokenMint);
            if (!token)
                return null;
            // A holder's own buy shifts the curve, but that is not market profit.
            // Until another wallet trades after the holder's latest trade, hold the
            // portfolio at remaining cost basis. The sell panel remains the source
            // of the fee-inclusive executable payout.
            const pMax = Number(token.curveParamA) / 1e18;
            const pMin = Number(token.curveParamB) / 1e18;
            const supply = Number(token.currentSupply) / 1e6; // human token units
            const gt = Number(token.graduationThreshold) / 1e6; // human token units
            const holderTradeTime = latestHolderTrade.get(h.tokenMint) ?? 0;
            const hasExternalMarketMove = (latestExternalTrade.get(h.tokenMint) ?? 0) > holderTradeTime;
            const executableValue = hasExternalMarketMove
                ? getExecutableSellValue(h.tokenAmount, supply, pMin, pMax, gt)
                : 0;
            // A malformed legacy curve must never erase a real holder's cost basis.
            // Keep the position at basis until a valid executable mark is available.
            const value = executableValue > 0 ? executableValue : h.costBasis;
            const avgBuyPrice = h.tokenAmount > 0 ? h.costBasis / h.tokenAmount : 0;
            const currentPriceUsdt = h.tokenAmount > 0 ? value / h.tokenAmount : 0;
            const rawPnlPercent = h.costBasis > 0
                ? ((value - h.costBasis) / h.costBasis) * 100
                : 0;
            const pnlPercent = Math.abs(rawPnlPercent) < 0.005 ? 0 : rawPnlPercent;
            return {
                mint: token.mint,
                symbol: token.symbol,
                name: token.name,
                amount: Math.round(h.tokenAmount * 1e6) / 1e6,
                avgBuyPrice: Math.round(avgBuyPrice * 1e8) / 1e8,
                currentPrice: Math.round(currentPriceUsdt * 1e8) / 1e8,
                pnlPercent: Math.round(pnlPercent * 100) / 100,
                value: Math.round(value * 1e6) / 1e6,
            };
        })
            .filter((h) => h !== null);
        return reply.send({ holdings });
    });
    // Trade history
    fastify.get('/api/profiles/:wallet/trades', async (req, reply) => {
        const { wallet } = req.params;
        const limit = Math.min(parseInt(req.query.limit ?? '20', 10), 50);
        const cursor = req.query.cursor;
        const trades = await prisma_1.prisma.trade.findMany({
            where: { walletAddress: wallet },
            orderBy: { timestamp: 'desc' },
            take: limit + 1,
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
            include: {
                token: { select: { symbol: true, name: true, uri: true } },
            },
        });
        const hasMore = trades.length > limit;
        const page = hasMore ? trades.slice(0, limit) : trades;
        return reply.send({
            trades: page.map((t) => ({
                id: t.id,
                tokenMint: t.tokenMint,
                tokenSymbol: t.token.symbol,
                tokenName: t.token.name,
                type: t.type,
                amount: Number(t.amount),
                solAmount: Number(t.solAmount) / 1e6,
                pricePerToken: Number(t.pricePerToken) / 1e18,
                txSignature: t.txSignature,
                timestamp: t.timestamp.toISOString(),
                isWhale: t.isWhale,
            })),
            nextCursor: hasMore ? page[page.length - 1].id : null,
        });
    });
    // Comments posted by wallet
    fastify.get('/api/profiles/:wallet/comments', async (req, reply) => {
        const { wallet } = req.params;
        const comments = await prisma_1.prisma.comment.findMany({
            where: { walletAddress: wallet },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                token: { select: { symbol: true } },
            },
        });
        return reply.send({
            comments: comments.map((c) => ({
                id: c.id,
                tokenMint: c.tokenMint,
                tokenSymbol: c.token.symbol,
                walletAddress: c.walletAddress,
                text: c.message,
                upvotes: c.upvotes,
                hasUpvoted: false, // viewer-relative — not computed here
                timestamp: c.createdAt.getTime(),
            })),
        });
    });
    // ── Follow/Unfollow aliases (compatibility with frontend api.ts) ──────────
    fastify.post('/api/profiles/:wallet/follow', async (req, reply) => {
        // Re-use the follows route logic inline for alias compatibility
        const body = req.body;
        const followerWallet = body?.followerWallet;
        const followingWallet = req.params.wallet;
        if (!followerWallet) {
            return reply.code(400).send({ error: 'followerWallet required', code: 'MISSING_FIELDS' });
        }
        await prisma_1.prisma.follow.upsert({
            where: {
                followerWallet_followingWallet: { followerWallet, followingWallet },
            },
            create: { followerWallet, followingWallet },
            update: {},
        });
        return reply.code(201).send({ following: true });
    });
    fastify.post('/api/profiles/:wallet/unfollow', async (req, reply) => {
        const body = req.body;
        const followerWallet = body?.followerWallet;
        const followingWallet = req.params.wallet;
        if (!followerWallet) {
            return reply.code(400).send({ error: 'followerWallet required', code: 'MISSING_FIELDS' });
        }
        await prisma_1.prisma.follow
            .delete({
            where: {
                followerWallet_followingWallet: { followerWallet, followingWallet },
            },
        })
            .catch(() => null); // Ignore if not found
        return reply.send({ following: false });
    });
    // Net worth history — computed from real trade history
    fastify.get('/api/profiles/:wallet/networth', async (req, reply) => {
        const { wallet } = req.params;
        // Fetch all trades for this wallet, oldest first
        const trades = await prisma_1.prisma.trade.findMany({
            where: { walletAddress: wallet },
            orderBy: { timestamp: 'asc' },
            select: {
                timestamp: true,
                type: true,
                amount: true, // raw token units (1e6)
                solAmount: true, // USDT paid/received (1e6)
                tokenMint: true,
            },
        });
        if (trades.length === 0) {
            return reply.send({ networth: [] });
        }
        // Fetch token curve params for all tokens the user has traded
        const mints = [...new Set(trades.map((t) => t.tokenMint))];
        const tokens = await prisma_1.prisma.token.findMany({
            where: { mint: { in: mints } },
            select: {
                mint: true,
                curveParamA: true, // pMax ×1e18
                curveParamB: true, // pMin ×1e18
                graduationThreshold: true,
                currentSupply: true,
            },
        });
        const tokenMap = new Map(tokens.map((t) => [t.mint, t]));
        // Replay trades: track per-token running supply and USDT spent
        // Group trades by UTC day, compute end-of-day portfolio value
        const dayMap = new Map(); // "YYYY-MM-DD" → value
        // Running state
        const holding = new Map(); // tokenMint → human token count
        const tokenSupplyAtTime = new Map(); // rough supply proxy
        for (const trade of trades) {
            const dayKey = trade.timestamp.toISOString().slice(0, 10);
            const amount = Number(trade.amount) / 1e6; // human tokens
            if (trade.type === 'buy') {
                holding.set(trade.tokenMint, (holding.get(trade.tokenMint) ?? 0) + amount);
                tokenSupplyAtTime.set(trade.tokenMint, (tokenSupplyAtTime.get(trade.tokenMint) ?? 0) + amount);
            }
            else {
                holding.set(trade.tokenMint, Math.max(0, (holding.get(trade.tokenMint) ?? 0) - amount));
                tokenSupplyAtTime.set(trade.tokenMint, Math.max(0, (tokenSupplyAtTime.get(trade.tokenMint) ?? 0) - amount));
            }
            // Compute current portfolio value at end of this trade
            let dayValue = 0;
            for (const [mint, tokenAmt] of holding.entries()) {
                if (tokenAmt <= 0)
                    continue;
                const token = tokenMap.get(mint);
                if (!token)
                    continue;
                const pMax = Number(token.curveParamA) / 1e18;
                const pMin = Number(token.curveParamB) / 1e18;
                const gt = Number(token.graduationThreshold);
                const supply = tokenSupplyAtTime.get(mint) ?? 0;
                const price = (pMin > 0 && pMax > pMin && gt > 0)
                    ? pMin * Math.pow(pMax / pMin, supply / gt)
                    : pMax;
                dayValue += tokenAmt * price;
            }
            // Keep highest value seen for this day
            dayMap.set(dayKey, Math.max(dayMap.get(dayKey) ?? 0, dayValue));
        }
        const data = Array.from(dayMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([day, value]) => ({
            time: Math.floor(new Date(day).getTime() / 1000),
            value: Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : 0,
        }));
        // If there's only 1 day of history, lightweight-charts will just draw a flat line 
        // or a dot. Add a 0 point for the day before their first trade to show an upward slope.
        if (data.length === 1) {
            data.unshift({
                time: data[0].time - 86400,
                value: 0,
            });
        }
        return reply.send({ networth: data });
    });
}
//# sourceMappingURL=profiles.js.map