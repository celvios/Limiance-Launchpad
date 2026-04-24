/**
 * Auth routes — SIWS (Sign-In With Solana) session system.
 *
 * POST /api/auth/login   — verify wallet signature, issue JWT
 * POST /api/auth/logout  — stateless; client drops the token
 * GET  /api/auth/me      — validate a token, return wallet address
 */
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyWalletSignature, isTimestampFresh } from '../lib/auth';
import { signToken, authenticateRequest } from '../lib/jwt';

// The exact message the client must sign — must mirror session.ts on the frontend.
export function buildLoginMessage(timestamp: number): string {
  return `Limiance Launchpad\n\nSign to authenticate your session.\n\nThis request will not trigger any blockchain transaction or cost any gas.\n\nTimestamp: ${timestamp}`;
}

const LoginBody = z.object({
  walletAddress: z.string().min(32).max(44),
  signature: z.string().min(1),   // base64-encoded ed25519 signature
  timestamp: z.number().int().positive(),
});

export async function authRoutes(fastify: FastifyInstance) {
  // ── POST /api/auth/login ──────────────────────────────────────────────────
  fastify.post<{ Body: unknown }>(
    '/api/auth/login',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const parsed = LoginBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid body',
          code: 'INVALID_BODY',
        });
      }

      const { walletAddress, signature, timestamp } = parsed.data;

      // Reject stale or future-dated requests
      if (!isTimestampFresh(timestamp)) {
        return reply.code(400).send({ error: 'Request expired', code: 'EXPIRED' });
      }

      // Verify the wallet actually signed this message
      const message = buildLoginMessage(timestamp);
      if (!verifyWalletSignature(walletAddress, message, signature)) {
        return reply.code(401).send({ error: 'Invalid signature', code: 'INVALID_SIGNATURE' });
      }

      const token = signToken(walletAddress);
      return reply.send({ token, wallet: walletAddress });
    }
  );

  // ── POST /api/auth/logout ─────────────────────────────────────────────────
  // Stateless — the client simply drops the JWT from storage.
  fastify.post('/api/auth/logout', async (_req, reply) => {
    return reply.send({ ok: true });
  });

  // ── GET /api/auth/me ──────────────────────────────────────────────────────
  fastify.get('/api/auth/me', async (req, reply) => {
    const wallet = authenticateRequest(req.headers.authorization);
    if (!wallet) {
      return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    return reply.send({ wallet });
  });
}
