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
    parentId: zod_1.z.string().optional(),
});
const ReactionBody = zod_1.z.object({
    walletAddress: zod_1.z.string().min(32).max(44),
    type: zod_1.z.enum(['like', 'dislike']),
});
const UpvoteBody = zod_1.z.object({
    walletAddress: zod_1.z.string().min(32).max(44),
});
// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function enrichComment(comment, viewerWallet, replyCount = 0, replies = []) {
    const [profile, viewerReaction] = await Promise.all([
        prisma_1.prisma.profile.findUnique({
            where: { walletAddress: comment.walletAddress },
            select: { usernameDisplay: true, username: true, profilePicUri: true },
        }),
        viewerWallet
            ? prisma_1.prisma.commentReaction
                .findUnique({
                where: {
                    commentId_walletAddress: {
                        commentId: comment.id,
                        walletAddress: viewerWallet,
                    },
                },
            })
                .then((r) => r?.type)
            : Promise.resolve(undefined),
    ]);
    return {
        id: comment.id,
        tokenMint: comment.tokenMint,
        parentId: comment.parentId,
        walletAddress: comment.walletAddress,
        walletHandle: profile ? (profile.usernameDisplay || profile.username) : null,
        profilePicUri: profile?.profilePicUri || null,
        text: comment.message,
        likeCount: comment.likes,
        dislikeCount: comment.dislikes,
        viewerReaction: viewerReaction ?? null,
        replyCount,
        replies,
        upvotes: comment.likes,
        hasUpvoted: viewerReaction === 'like',
        timestamp: comment.createdAt.getTime(),
    };
}
async function setCommentReaction(commentId, walletAddress, type) {
    const comment = await prisma_1.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment)
        return null;
    const existing = await prisma_1.prisma.commentReaction.findUnique({
        where: { commentId_walletAddress: { commentId, walletAddress } },
    });
    let likeCount = comment.likes;
    let dislikeCount = comment.dislikes;
    let viewerReaction = type;
    if (existing?.type === type) {
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.commentReaction.delete({
                where: { commentId_walletAddress: { commentId, walletAddress } },
            }),
            prisma_1.prisma.comment.update({
                where: { id: commentId },
                data: {
                    ...(type === 'like' ? { likes: { decrement: 1 }, upvotes: { decrement: 1 } } : {}),
                    ...(type === 'dislike' ? { dislikes: { decrement: 1 } } : {}),
                },
            }),
        ]);
        viewerReaction = null;
        if (type === 'like')
            likeCount = Math.max(0, likeCount - 1);
        if (type === 'dislike')
            dislikeCount = Math.max(0, dislikeCount - 1);
    }
    else if (existing) {
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.commentReaction.update({
                where: { commentId_walletAddress: { commentId, walletAddress } },
                data: { type },
            }),
            prisma_1.prisma.comment.update({
                where: { id: commentId },
                data: {
                    likes: { increment: type === 'like' ? 1 : -1 },
                    dislikes: { increment: type === 'dislike' ? 1 : -1 },
                    upvotes: { increment: type === 'like' ? 1 : -1 },
                },
            }),
        ]);
        likeCount += type === 'like' ? 1 : -1;
        dislikeCount += type === 'dislike' ? 1 : -1;
    }
    else {
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.commentReaction.create({ data: { commentId, walletAddress, type } }),
            prisma_1.prisma.comment.update({
                where: { id: commentId },
                data: {
                    ...(type === 'like' ? { likes: { increment: 1 }, upvotes: { increment: 1 } } : {}),
                    ...(type === 'dislike' ? { dislikes: { increment: 1 } } : {}),
                },
            }),
        ]);
        if (type === 'like')
            likeCount += 1;
        if (type === 'dislike')
            dislikeCount += 1;
    }
    return {
        likeCount: Math.max(0, likeCount),
        dislikeCount: Math.max(0, dislikeCount),
        viewerReaction,
        upvotes: Math.max(0, likeCount),
        hasUpvoted: viewerReaction === 'like',
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
            where: { tokenMint: mint, parentId: null },
            orderBy: sort === 'top' ? { likes: 'desc' } : { createdAt: 'desc' },
            take: limit + 1,
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        });
        const hasMore = comments.length > limit;
        const page = hasMore ? comments.slice(0, limit) : comments;
        const parentIds = page.map((c) => c.id);
        const replies = parentIds.length > 0
            ? await prisma_1.prisma.comment.findMany({
                where: { parentId: { in: parentIds } },
                orderBy: { createdAt: 'asc' },
            })
            : [];
        const replyGroups = new Map();
        for (const reply of replies) {
            if (!reply.parentId)
                continue;
            replyGroups.set(reply.parentId, [...(replyGroups.get(reply.parentId) ?? []), reply]);
        }
        const enriched = await Promise.all(page.map(async (c) => {
            const childReplies = await Promise.all((replyGroups.get(c.id) ?? []).map((reply) => enrichComment(reply, viewer)));
            return enrichComment(c, viewer, childReplies.length, childReplies);
        }));
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
        const { walletAddress, message, parentId } = parsed.data;
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
        if (parentId) {
            const parent = await prisma_1.prisma.comment.findUnique({ where: { id: parentId } });
            if (!parent || parent.tokenMint !== mint) {
                return reply.code(400).send({ error: 'Invalid parent comment', code: 'INVALID_PARENT' });
            }
        }
        const comment = await prisma_1.prisma.comment.create({
            data: {
                tokenMint: mint,
                parentId: parentId ?? null,
                walletAddress,
                message,
            },
        });
        return reply.code(201).send({ comment: await enrichComment(comment, walletAddress) });
    });
    // ── Toggle upvote ─────────────────────────────────────────────────────────
    fastify.post('/api/comments/:id/reaction', {
        config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    }, async (req, reply) => {
        const { id } = req.params;
        const parsed = ReactionBody.safeParse(req.body);
        if (!parsed.success) {
            return reply
                .code(400)
                .send({ error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'INVALID_BODY' });
        }
        const { walletAddress, type } = parsed.data;
        const authenticatedWallet = (0, jwt_1.authenticateRequest)(req.headers.authorization);
        if (!authenticatedWallet || authenticatedWallet !== walletAddress) {
            return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
        }
        const result = await setCommentReaction(id, walletAddress, type);
        if (!result) {
            return reply.code(404).send({ error: 'Comment not found', code: 'NOT_FOUND' });
        }
        return reply.send(result);
    });
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
        const result = await setCommentReaction(id, walletAddress, 'like');
        if (!result) {
            return reply.code(404).send({ error: 'Comment not found', code: 'NOT_FOUND' });
        }
        return reply.send(result);
    });
}
//# sourceMappingURL=comments.js.map