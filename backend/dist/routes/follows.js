"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.followRoutes = followRoutes;
const zod_1 = require("zod");
const prisma_1 = require("../services/prisma");
const jwt_1 = require("../lib/jwt");
// ─────────────────────────────────────────────────────────────────────────────
// Validation schemas
// ─────────────────────────────────────────────────────────────────────────────
const FollowBody = zod_1.z.object({
    followerWallet: zod_1.z.string().min(32).max(44),
    followingWallet: zod_1.z.string().min(32).max(44),
});
const WatchlistBody = zod_1.z.object({
    walletAddress: zod_1.z.string().min(32).max(44),
    tokenMint: zod_1.z.string().min(32).max(44),
});
// ─────────────────────────────────────────────────────────────────────────────
// Route plugin
// ─────────────────────────────────────────────────────────────────────────────
async function followRoutes(fastify) {
    // ── Follow ────────────────────────────────────────────────────────────────
    fastify.post('/api/follows', async (req, reply) => {
        const parsed = FollowBody.safeParse(req.body);
        if (!parsed.success) {
            return reply
                .code(400)
                .send({ error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'INVALID_BODY' });
        }
        const followerWallet = parsed.data.followerWallet.toLowerCase();
        const followingWallet = parsed.data.followingWallet.toLowerCase();
        if (followerWallet === followingWallet) {
            return reply.code(400).send({ error: 'Cannot follow yourself', code: 'INVALID_FOLLOW' });
        }
        const authenticatedWallet = (0, jwt_1.authenticateRequest)(req.headers.authorization);
        if (!authenticatedWallet || authenticatedWallet.toLowerCase() !== followerWallet) {
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
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
    // ── Unfollow ──────────────────────────────────────────────────────────────
    fastify.delete('/api/follows', async (req, reply) => {
        const parsed = FollowBody.safeParse(req.body);
        if (!parsed.success) {
            return reply
                .code(400)
                .send({ error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'INVALID_BODY' });
        }
        const followerWallet = parsed.data.followerWallet.toLowerCase();
        const followingWallet = parsed.data.followingWallet.toLowerCase();
        const authenticatedWallet = (0, jwt_1.authenticateRequest)(req.headers.authorization);
        if (!authenticatedWallet || authenticatedWallet.toLowerCase() !== followerWallet) {
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        await prisma_1.prisma.follow
            .delete({
            where: {
                followerWallet_followingWallet: { followerWallet, followingWallet },
            },
        })
            .catch(() => null); // Ignore not-found
        return reply.send({ following: false });
    });
    // ── Get watchlist ─────────────────────────────────────────────────────────
    fastify.get('/api/watchlist/:wallet', async (req, reply) => {
        const wallet = req.params.wallet.toLowerCase();
        const entries = await prisma_1.prisma.watchlist.findMany({
            where: { walletAddress: wallet },
            orderBy: { createdAt: 'desc' },
        });
        return reply.send({ mints: entries.map((e) => e.tokenMint) });
    });
    // ── Add to watchlist ──────────────────────────────────────────────────────
    fastify.post('/api/watchlist', async (req, reply) => {
        const parsed = WatchlistBody.safeParse(req.body);
        if (!parsed.success) {
            return reply
                .code(400)
                .send({ error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'INVALID_BODY' });
        }
        const walletAddress = parsed.data.walletAddress.toLowerCase();
        const { tokenMint } = parsed.data;
        const authenticatedWallet = (0, jwt_1.authenticateRequest)(req.headers.authorization);
        if (!authenticatedWallet || authenticatedWallet.toLowerCase() !== walletAddress) {
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        // A watch event must have a stable username. Do not create orphaned
        // watchlist activity for authenticated wallets that have not onboarded.
        const profile = await prisma_1.prisma.profile.findUnique({
            where: { walletAddress },
            select: { onboarded: true },
        });
        if (!profile?.onboarded) {
            return reply.code(409).send({
                error: 'Complete your profile before watching tokens',
                code: 'PROFILE_REQUIRED',
            });
        }
        // Verify token exists
        const token = await prisma_1.prisma.token.findUnique({ where: { mint: tokenMint } });
        if (!token) {
            return reply.code(404).send({ error: 'Token not found', code: 'NOT_FOUND' });
        }
        await prisma_1.prisma.watchlist.upsert({
            where: { walletAddress_tokenMint: { walletAddress, tokenMint } },
            create: { walletAddress, tokenMint },
            update: {},
        });
        return reply.code(201).send({ watched: true });
    });
    // ── Remove from watchlist ─────────────────────────────────────────────────
    fastify.delete('/api/watchlist', async (req, reply) => {
        const parsed = WatchlistBody.safeParse(req.body);
        if (!parsed.success) {
            return reply
                .code(400)
                .send({ error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'INVALID_BODY' });
        }
        const walletAddress = parsed.data.walletAddress.toLowerCase();
        const { tokenMint } = parsed.data;
        const authenticatedWallet = (0, jwt_1.authenticateRequest)(req.headers.authorization);
        if (!authenticatedWallet || authenticatedWallet.toLowerCase() !== walletAddress) {
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        await prisma_1.prisma.watchlist
            .delete({
            where: { walletAddress_tokenMint: { walletAddress, tokenMint } },
        })
            .catch(() => null);
        return reply.send({ watched: false });
    });
}
//# sourceMappingURL=follows.js.map