/**
 * Follow and Watchlist routes — Phase 5 social layer.
 *
 * POST   /api/follows              — follow a wallet (wallet-signed)
 * DELETE /api/follows              — unfollow a wallet (wallet-signed)
 * GET    /api/watchlist/:wallet    — get watchlist
 * POST   /api/watchlist            — add to watchlist (wallet-signed)
 * DELETE /api/watchlist            — remove from watchlist (wallet-signed)
 */
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { verifyWalletSignature, isTimestampFresh } from '../lib/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Validation schemas
// ─────────────────────────────────────────────────────────────────────────────

const FollowBody = z.object({
  followerWallet: z.string().min(32).max(44),
  followingWallet: z.string().min(32).max(44),
  signature: z.string().min(1),
  timestamp: z.number().int().positive(),
});

const WatchlistBody = z.object({
  walletAddress: z.string().min(32).max(44),
  tokenMint: z.string().min(32).max(44),
  signature: z.string().min(1),
  timestamp: z.number().int().positive(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Route plugin
// ─────────────────────────────────────────────────────────────────────────────

export async function followRoutes(fastify: FastifyInstance) {
  // ── Follow ────────────────────────────────────────────────────────────────

  fastify.post<{ Body: unknown }>('/api/follows', async (req, reply) => {
    const parsed = FollowBody.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'INVALID_BODY' });
    }

    const { followerWallet, followingWallet, signature, timestamp } = parsed.data;

    if (followerWallet === followingWallet) {
      return reply.code(400).send({ error: 'Cannot follow yourself', code: 'INVALID_FOLLOW' });
    }

    if (!isTimestampFresh(timestamp)) {
      return reply.code(400).send({ error: 'Request expired', code: 'EXPIRED' });
    }

    const message = `ACTION:FOLLOW|DATA:${followingWallet}|TIMESTAMP:${timestamp}`;
    if (!verifyWalletSignature(followerWallet, message, signature)) {
      return reply.code(400).send({ error: 'Invalid signature', code: 'INVALID_SIGNATURE' });
    }

    await prisma.follow.upsert({
      where: {
        followerWallet_followingWallet: { followerWallet, followingWallet },
      },
      create: { followerWallet, followingWallet },
      update: {},
    });

    return reply.code(201).send({ following: true });
  });

  // ── Unfollow ──────────────────────────────────────────────────────────────

  fastify.delete<{ Body: unknown }>('/api/follows', async (req, reply) => {
    const parsed = FollowBody.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'INVALID_BODY' });
    }

    const { followerWallet, followingWallet, signature, timestamp } = parsed.data;

    if (!isTimestampFresh(timestamp)) {
      return reply.code(400).send({ error: 'Request expired', code: 'EXPIRED' });
    }

    const message = `ACTION:UNFOLLOW|DATA:${followingWallet}|TIMESTAMP:${timestamp}`;
    if (!verifyWalletSignature(followerWallet, message, signature)) {
      return reply.code(400).send({ error: 'Invalid signature', code: 'INVALID_SIGNATURE' });
    }

    await prisma.follow
      .delete({
        where: {
          followerWallet_followingWallet: { followerWallet, followingWallet },
        },
      })
      .catch(() => null); // Ignore not-found

    return reply.send({ following: false });
  });

  // ── Get watchlist ─────────────────────────────────────────────────────────

  fastify.get<{ Params: { wallet: string } }>(
    '/api/watchlist/:wallet',
    async (req, reply) => {
      const { wallet } = req.params;

      const entries = await prisma.watchlist.findMany({
        where: { walletAddress: wallet },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({ mints: entries.map((e) => e.tokenMint) });
    }
  );

  // ── Add to watchlist ──────────────────────────────────────────────────────

  fastify.post<{ Body: unknown }>('/api/watchlist', async (req, reply) => {
    const parsed = WatchlistBody.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'INVALID_BODY' });
    }

    const { walletAddress, tokenMint, signature, timestamp } = parsed.data;

    if (!isTimestampFresh(timestamp)) {
      return reply.code(400).send({ error: 'Request expired', code: 'EXPIRED' });
    }

    const message = `ACTION:WATCH|DATA:${tokenMint}|TIMESTAMP:${timestamp}`;
    if (!verifyWalletSignature(walletAddress, message, signature)) {
      return reply.code(400).send({ error: 'Invalid signature', code: 'INVALID_SIGNATURE' });
    }

    // Verify token exists
    const token = await prisma.token.findUnique({ where: { mint: tokenMint } });
    if (!token) {
      return reply.code(404).send({ error: 'Token not found', code: 'NOT_FOUND' });
    }

    await prisma.watchlist.upsert({
      where: { walletAddress_tokenMint: { walletAddress, tokenMint } },
      create: { walletAddress, tokenMint },
      update: {},
    });

    return reply.code(201).send({ watched: true });
  });

  // ── Remove from watchlist ─────────────────────────────────────────────────

  fastify.delete<{ Body: unknown }>('/api/watchlist', async (req, reply) => {
    const parsed = WatchlistBody.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'INVALID_BODY' });
    }

    const { walletAddress, tokenMint, signature, timestamp } = parsed.data;

    if (!isTimestampFresh(timestamp)) {
      return reply.code(400).send({ error: 'Request expired', code: 'EXPIRED' });
    }

    const message = `ACTION:UNWATCH|DATA:${tokenMint}|TIMESTAMP:${timestamp}`;
    if (!verifyWalletSignature(walletAddress, message, signature)) {
      return reply.code(400).send({ error: 'Invalid signature', code: 'INVALID_SIGNATURE' });
    }

    await prisma.watchlist
      .delete({
        where: { walletAddress_tokenMint: { walletAddress, tokenMint } },
      })
      .catch(() => null);

    return reply.send({ watched: false });
  });
}
