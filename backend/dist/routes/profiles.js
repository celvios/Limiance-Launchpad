"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileRoutes = profileRoutes;
const zod_1 = require("zod");
const prisma_1 = require("../services/prisma");
const jwt_1 = require("../lib/jwt");
const price_1 = require("../services/price");
// ─────────────────────────────────────────────────────────────────────────────
// Validation schemas
// ─────────────────────────────────────────────────────────────────────────────
const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
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
        const profile = await prisma_1.prisma.profile.findUnique({
            where: { walletAddress: wallet },
        });
        if (!profile || !profile.onboarded) {
            return reply.code(404).send({ error: 'Profile not found', code: 'NOT_FOUND' });
        }
        return reply.send(await buildProfileResponse(profile, viewer));
    });
    // ── Create profile (onboarding) ───────────────────────────────────────────
    fastify.post('/api/profiles', {
        config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
    }, async (req, reply) => {
        const parsed = CreateProfileBody.safeParse(req.body);
        if (!parsed.success) {
            return reply
                .code(400)
                .send({ error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'INVALID_BODY' });
        }
        const { walletAddress, username, profilePicUri, coverUri } = parsed.data;
        // JWT authentication
        const authenticatedWallet = (0, jwt_1.authenticateRequest)(req.headers.authorization);
        if (!authenticatedWallet || authenticatedWallet !== walletAddress) {
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        // Username format
        if (!USERNAME_RE.test(username) || username.length < 3 || username.length > 20) {
            return reply
                .code(400)
                .send({ error: 'Invalid username format', code: 'INVALID_USERNAME' });
        }
        const usernameLower = username.toLowerCase();
        // Check profile already exists
        const existing = await prisma_1.prisma.profile.findUnique({
            where: { walletAddress },
        });
        if (existing?.onboarded) {
            return reply
                .code(409)
                .send({ error: 'Profile already exists', code: 'ALREADY_EXISTS' });
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
        const { walletAddress, username, profilePicUri, coverUri } = parsed.data;
        if (walletAddress !== wallet) {
            return reply.code(403).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        // JWT authentication
        const authenticatedWallet = (0, jwt_1.authenticateRequest)(req.headers.authorization);
        if (!authenticatedWallet || authenticatedWallet !== walletAddress) {
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        const profile = await prisma_1.prisma.profile.findUnique({ where: { walletAddress: wallet } });
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
            if (taken && taken.walletAddress !== wallet) {
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
            where: { walletAddress: wallet },
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
            tokens: tokens.map((t) => ({
                mint: t.mint,
                symbol: t.symbol,
                name: t.name,
                imageUri: t.uri,
                description: t.description,
                curveType: t.curveType,
                status: t.status,
                currentSupply: t.currentSupply.toString(),
                supplyCap: t.supplyCap.toString(),
                graduationThreshold: t.graduationThreshold.toString(),
                createdAt: t.createdAt.toISOString(),
            })),
        });
    });
    // Holdings — net-positive token positions computed from trades
    fastify.get('/api/profiles/:wallet/holdings', async (req, reply) => {
        const { wallet } = req.params;
        // Aggregate buys and sells per token
        const [buys, sells] = await Promise.all([
            prisma_1.prisma.trade.groupBy({
                by: ['tokenMint'],
                where: { walletAddress: wallet, type: 'buy' },
                _sum: { amount: true, solAmount: true },
            }),
            prisma_1.prisma.trade.groupBy({
                by: ['tokenMint'],
                where: { walletAddress: wallet, type: 'sell' },
                _sum: { amount: true },
            }),
        ]);
        const sellMap = new Map(sells.map((s) => [s.tokenMint, s._sum.amount ?? BigInt(0)]));
        // Net holdings (positive balance only)
        const netHoldings = buys
            .map((b) => {
            const buyAmount = b._sum.amount ?? BigInt(0);
            const sellAmount = sellMap.get(b.tokenMint) ?? BigInt(0);
            const net = buyAmount - sellAmount;
            const solSpent = b._sum.solAmount ?? BigInt(0);
            return { tokenMint: b.tokenMint, net, solSpent, buyAmount };
        })
            .filter((h) => h.net > BigInt(0));
        if (netHoldings.length === 0) {
            return reply.send({ holdings: [] });
        }
        // Fetch token metadata for held tokens
        const mints = netHoldings.map((h) => h.tokenMint);
        const tokens = await prisma_1.prisma.token.findMany({ where: { mint: { in: mints } } });
        const tokenMap = new Map(tokens.map((t) => [t.mint, t]));
        const PAYMENT_UNIT = 1000000000000000000n;
        const TOKEN_DECIMALS = 1000000n;
        const holdings = netHoldings
            .map((h) => {
            const token = tokenMap.get(h.tokenMint);
            if (!token)
                return null;
            const currentPrice = (0, price_1.computeSpotPrice)(token.curveType, BigInt(token.curveParamA.toString()), BigInt(token.curveParamB.toString()), BigInt(token.curveParamC.toString()), BigInt(token.currentSupply.toString()), BigInt(token.supplyCap.toString()));
            const avgBuyWei = h.buyAmount > BigInt(0)
                ? Number((h.solSpent * TOKEN_DECIMALS) / h.buyAmount)
                : 0;
            const currentWei = Number(currentPrice);
            const pnlPercent = avgBuyWei > 0
                ? ((currentWei - avgBuyWei) / avgBuyWei) * 100
                : 0;
            const valueWei = (h.net * BigInt(currentWei)) / TOKEN_DECIMALS;
            const valuePayment = Number(valueWei) / Number(PAYMENT_UNIT);
            return {
                mint: token.mint,
                symbol: token.symbol,
                name: token.name,
                amount: Number(h.net) / Number(TOKEN_DECIMALS),
                avgBuyPrice: avgBuyWei / Number(PAYMENT_UNIT),
                currentPrice: currentWei / Number(PAYMENT_UNIT),
                pnlPercent: Math.round(pnlPercent * 100) / 100,
                value: Math.round(valuePayment * 1e6) / 1e6,
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
                amount: t.amount.toString(),
                solAmount: t.solAmount.toString(),
                pricePerToken: t.pricePerToken.toString(),
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
}
//# sourceMappingURL=profiles.js.map