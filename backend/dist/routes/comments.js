"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentRoutes = commentRoutes;
const zod_1 = require("zod");
const prisma_1 = require("../services/prisma");
const jwt_1 = require("../lib/jwt");
// ─────────────────────────────────────────────────────────────────────────────
// Validation schemas
// ─────────────────────────────────────────────────────────────────────────────
const PostCommentBody = zod_1.z.object({
    walletAddress: zod_1.z.string().min(32).max(44),
    message: zod_1.z.string().min(1).max(280),
});
const UpvoteBody = zod_1.z.object({
    walletAddress: zod_1.z.string().min(32).max(44),
});
// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function enrichComment(comment, viewerWallet) {
    const [profile, hasUpvoted] = await Promise.all([
        prisma_1.prisma.profile.findUnique({
            where: { walletAddress: comment.walletAddress },
            select: { usernameDisplay: true, username: true },
        }),
        viewerWallet
            ? prisma_1.prisma.commentUpvote
                .findUnique({
                where: {
                    commentId_walletAddress: {
                        commentId: comment.id,
                        walletAddress: viewerWallet,
                    },
                },
            })
                .then((r) => r !== null)
            : Promise.resolve(false),
    ]);
    return {
        id: comment.id,
        tokenMint: comment.tokenMint,
        walletAddress: comment.walletAddress,
        walletHandle: profile ? (profile.usernameDisplay || profile.username) : null,
        text: comment.message,
        upvotes: comment.upvotes,
        hasUpvoted,
        timestamp: comment.createdAt.getTime(),
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// Route plugin
// ─────────────────────────────────────────────────────────────────────────────
async function commentRoutes(fastify) {
    // ── List comments ─────────────────────────────────────────────────────────
    fastify.get('/api/tokens/:mint/comments', async (req, reply) => {
        const { mint } = req.params;
        const sort = req.query.sort === 'top' ? 'top' : 'new';
        const limit = Math.min(parseInt(req.query.limit ?? '20', 10), 50);
        const cursor = req.query.cursor;
        const viewer = req.query.viewer;
        const comments = await prisma_1.prisma.comment.findMany({
            where: { tokenMint: mint },
            orderBy: sort === 'top' ? { upvotes: 'desc' } : { createdAt: 'desc' },
            take: limit + 1,
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        });
        const hasMore = comments.length > limit;
        const page = hasMore ? comments.slice(0, limit) : comments;
        const enriched = await Promise.all(page.map((c) => enrichComment(c, viewer)));
        const total = await prisma_1.prisma.comment.count({ where: { tokenMint: mint } });
        return reply.send({
            comments: enriched,
            total,
            nextCursor: hasMore ? page[page.length - 1].id : null,
        });
    });
    // ── Post comment ──────────────────────────────────────────────────────────
    fastify.post('/api/tokens/:mint/comments', {
        config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    }, async (req, reply) => {
        const { mint } = req.params;
        const parsed = PostCommentBody.safeParse(req.body);
        if (!parsed.success) {
            return reply
                .code(400)
                .send({ error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'INVALID_BODY' });
        }
        const { walletAddress, message } = parsed.data;
        // JWT authentication — token is sent in Authorization header
        const authenticatedWallet = (0, jwt_1.authenticateRequest)(req.headers.authorization);
        if (!authenticatedWallet || authenticatedWallet !== walletAddress) {
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        // Verify token exists
        const token = await prisma_1.prisma.token.findUnique({ where: { mint } });
        if (!token) {
            return reply.code(404).send({ error: 'Token not found', code: 'NOT_FOUND' });
        }
        const comment = await prisma_1.prisma.comment.create({
            data: {
                tokenMint: mint,
                walletAddress,
                message,
            },
        });
        return reply.code(201).send({ comment: await enrichComment(comment, walletAddress) });
    });
    // ── Toggle upvote ─────────────────────────────────────────────────────────
    fastify.post('/api/comments/:id/upvote', {
        config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    }, async (req, reply) => {
        const { id } = req.params;
        const parsed = UpvoteBody.safeParse(req.body);
        if (!parsed.success) {
            return reply
                .code(400)
                .send({ error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'INVALID_BODY' });
        }
        const { walletAddress } = parsed.data;
        // JWT authentication — token is sent in Authorization header
        const authenticatedWallet = (0, jwt_1.authenticateRequest)(req.headers.authorization);
        if (!authenticatedWallet || authenticatedWallet !== walletAddress) {
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        const comment = await prisma_1.prisma.comment.findUnique({ where: { id } });
        if (!comment) {
            return reply.code(404).send({ error: 'Comment not found', code: 'NOT_FOUND' });
        }
        // Toggle: check if already upvoted
        const existing = await prisma_1.prisma.commentUpvote.findUnique({
            where: { commentId_walletAddress: { commentId: id, walletAddress } },
        });
        let upvotes;
        let hasUpvoted;
        if (existing) {
            // Remove upvote
            await prisma_1.prisma.$transaction([
                prisma_1.prisma.commentUpvote.delete({
                    where: { commentId_walletAddress: { commentId: id, walletAddress } },
                }),
                prisma_1.prisma.comment.update({
                    where: { id },
                    data: { upvotes: { decrement: 1 } },
                }),
            ]);
            upvotes = Math.max(0, comment.upvotes - 1);
            hasUpvoted = false;
        }
        else {
            // Add upvote
            await prisma_1.prisma.$transaction([
                prisma_1.prisma.commentUpvote.create({ data: { commentId: id, walletAddress } }),
                prisma_1.prisma.comment.update({
                    where: { id },
                    data: { upvotes: { increment: 1 } },
                }),
            ]);
            upvotes = comment.upvotes + 1;
            hasUpvoted = true;
        }
        return reply.send({ upvotes, hasUpvoted });
    });
}
//# sourceMappingURL=comments.js.map