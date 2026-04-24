/**
 * Comment routes — Phase 5 social layer.
 *
 * GET  /api/tokens/:mint/comments        — list (sorted by new or top)
 * POST /api/tokens/:mint/comments        — post a comment (wallet-signed)
 * POST /api/comments/:id/upvote          — toggle upvote (wallet-signed)
 */
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticateRequest } from '../lib/jwt';

// ─────────────────────────────────────────────────────────────────────────────
// Validation schemas
// ─────────────────────────────────────────────────────────────────────────────

const PostCommentBody = z.object({
  walletAddress: z.string().min(32).max(44),
  message: z.string().min(1).max(280),
});

const UpvoteBody = z.object({
  walletAddress: z.string().min(32).max(44),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function enrichComment(
  comment: {
    id: string;
    tokenMint: string;
    walletAddress: string;
    message: string;
    upvotes: number;
    createdAt: Date;
  },
  viewerWallet?: string
) {
  const [profile, hasUpvoted] = await Promise.all([
    prisma.profile.findUnique({
      where: { walletAddress: comment.walletAddress },
      select: { usernameDisplay: true, username: true },
    }),
    viewerWallet
      ? prisma.commentUpvote
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

export async function commentRoutes(fastify: FastifyInstance) {
  // ── List comments ─────────────────────────────────────────────────────────

  fastify.get<{
    Params: { mint: string };
    Querystring: { sort?: string; limit?: string; cursor?: string; viewer?: string };
  }>('/api/tokens/:mint/comments', async (req, reply) => {
    const { mint } = req.params;
    const sort = req.query.sort === 'top' ? 'top' : 'new';
    const limit = Math.min(parseInt(req.query.limit ?? '20', 10), 50);
    const cursor = req.query.cursor;
    const viewer = req.query.viewer;

    const comments = await prisma.comment.findMany({
      where: { tokenMint: mint },
      orderBy: sort === 'top' ? { upvotes: 'desc' } : { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = comments.length > limit;
    const page = hasMore ? comments.slice(0, limit) : comments;

    const enriched = await Promise.all(page.map((c) => enrichComment(c, viewer)));
    const total = await prisma.comment.count({ where: { tokenMint: mint } });

    return reply.send({
      comments: enriched,
      total,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  });

  // ── Post comment ──────────────────────────────────────────────────────────

  fastify.post<{ Params: { mint: string }; Body: unknown }>(
    '/api/tokens/:mint/comments',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { mint } = req.params;

      const parsed = PostCommentBody.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'INVALID_BODY' });
      }

      const { walletAddress, message } = parsed.data;

      // JWT authentication — token is sent in Authorization header
      const authenticatedWallet = authenticateRequest(req.headers.authorization);
      if (!authenticatedWallet || authenticatedWallet !== walletAddress) {
        return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      }

      // Verify token exists
      const token = await prisma.token.findUnique({ where: { mint } });
      if (!token) {
        return reply.code(404).send({ error: 'Token not found', code: 'NOT_FOUND' });
      }

      const comment = await prisma.comment.create({
        data: {
          tokenMint: mint,
          walletAddress,
          message,
        },
      });

      return reply.code(201).send({ comment: await enrichComment(comment, walletAddress) });
    }
  );

  // ── Toggle upvote ─────────────────────────────────────────────────────────

  fastify.post<{ Params: { id: string }; Body: unknown }>(
    '/api/comments/:id/upvote',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { id } = req.params;

      const parsed = UpvoteBody.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'INVALID_BODY' });
      }

      const { walletAddress } = parsed.data;

      // JWT authentication — token is sent in Authorization header
      const authenticatedWallet = authenticateRequest(req.headers.authorization);
      if (!authenticatedWallet || authenticatedWallet !== walletAddress) {
        return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      }

      const comment = await prisma.comment.findUnique({ where: { id } });
      if (!comment) {
        return reply.code(404).send({ error: 'Comment not found', code: 'NOT_FOUND' });
      }

      // Toggle: check if already upvoted
      const existing = await prisma.commentUpvote.findUnique({
        where: { commentId_walletAddress: { commentId: id, walletAddress } },
      });

      let upvotes: number;
      let hasUpvoted: boolean;

      if (existing) {
        // Remove upvote
        await prisma.$transaction([
          prisma.commentUpvote.delete({
            where: { commentId_walletAddress: { commentId: id, walletAddress } },
          }),
          prisma.comment.update({
            where: { id },
            data: { upvotes: { decrement: 1 } },
          }),
        ]);
        upvotes = Math.max(0, comment.upvotes - 1);
        hasUpvoted = false;
      } else {
        // Add upvote
        await prisma.$transaction([
          prisma.commentUpvote.create({ data: { commentId: id, walletAddress } }),
          prisma.comment.update({
            where: { id },
            data: { upvotes: { increment: 1 } },
          }),
        ]);
        upvotes = comment.upvotes + 1;
        hasUpvoted = true;
      }

      return reply.send({ upvotes, hasUpvoted });
    }
  );
}
