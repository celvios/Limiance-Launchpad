/**
 * Auth routes — EVM signed-message session system.
 *
 * POST /api/auth/login   — verify wallet signature, issue JWT
 * POST /api/auth/logout  — stateless; client drops the token
 * GET  /api/auth/me      — validate a token, return wallet address
 */
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { signToken, authenticateRequest, authenticateSession } from '../lib/jwt';
import { prisma } from '../services/prisma';
import { normalizeAddress, pimlicoConfig } from '../services/bsc';
import { verifyEvmPersonalSignature } from '../lib/auth';

// The exact message the client must sign — must mirror session.ts on the frontend.
export function buildLoginMessage(timestamp: number): string {
  return `Limiance Launchpad\n\nSign to authenticate your BSC session.\n\nThis request will not trigger any blockchain transaction or cost gas.\n\nTimestamp: ${timestamp}`;
}

const LoginBody = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/),
  timestamp: z.number().int().positive(),
});

const RequestEmailBody = z.object({
  email: z.string().email(),
});

const VerifyEmailBody = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
  embeddedSignerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  smartAccountAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
});

function isTimestampFresh(timestamp: number): boolean {
  return Math.abs(Date.now() - timestamp) <= 5 * 60 * 1000;
}

function hashCode(email: string, code: string): string {
  return crypto
    .createHash('sha256')
    .update(`${email.toLowerCase()}:${code}:${process.env.JWT_SECRET ?? 'change-me-in-production'}`)
    .digest('hex');
}

function generateOtp(): string {
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_EMAIL_OTP) {
    return process.env.DEV_EMAIL_OTP;
  }
  return String(crypto.randomInt(100000, 1000000));
}

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
      const normalizedWallet = walletAddress.toLowerCase();
      const message = buildLoginMessage(timestamp);
      if (!verifyEvmPersonalSignature(normalizedWallet, message, signature)) {
        return reply.code(401).send({ error: 'Invalid wallet signature', code: 'INVALID_SIGNATURE' });
      }
      const user = await (prisma as any).user.upsert({
        where: { primaryWalletAddress: normalizedWallet },
        update: {},
        create: {
          primaryWalletAddress: normalizedWallet,
          authType: 'wallet',
          wallets: {
            create: {
              walletAddress: normalizedWallet,
              walletType: 'external',
            },
          },
        },
      });
      const token = signToken(normalizedWallet, { userId: user.id, authType: 'wallet' });
      return reply.send({ token, wallet: normalizedWallet, userId: user.id, authType: 'wallet' });
    }
  );

  fastify.post<{ Body: unknown }>(
    '/api/auth/email/request-otp',
    { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } },
    async (req, reply) => {
      const parsed = RequestEmailBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid email', code: 'INVALID_BODY' });
      }
      const email = parsed.data.email.toLowerCase();
      const code = generateOtp();
      await (prisma as any).loginOtp.create({
        data: {
          email,
          codeHash: hashCode(email, code),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      // Production should send via an email provider. Development returns the code for local testing.
      return reply.send({
        ok: true,
        delivery: process.env.NODE_ENV === 'production' ? 'email' : 'dev_response',
        devCode: process.env.NODE_ENV === 'production' ? undefined : code,
      });
    },
  );

  fastify.post<{ Body: unknown }>(
    '/api/auth/email/verify-otp',
    { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } },
    async (req, reply) => {
      const parsed = VerifyEmailBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'INVALID_BODY' });
      }

      const email = parsed.data.email.toLowerCase();
      const otp = await (prisma as any).loginOtp.findFirst({
        where: {
          email,
          consumed: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!otp || otp.codeHash !== hashCode(email, parsed.data.code)) {
        return reply.code(401).send({ error: 'Invalid or expired login code', code: 'INVALID_OTP' });
      }

      if (!parsed.data.embeddedSignerAddress || !parsed.data.smartAccountAddress) {
        return reply.code(400).send({
          error: 'Production email login requires an embedded signer address and Pimlico-backed smart account',
          code: 'EMBEDDED_WALLET_REQUIRED',
        });
      }

      const primaryWalletAddress = normalizeAddress(parsed.data.smartAccountAddress);
      const embeddedSignerAddress = parsed.data.embeddedSignerAddress
        ? normalizeAddress(parsed.data.embeddedSignerAddress)
        : null;
      const smartAccountAddress = parsed.data.smartAccountAddress
        ? normalizeAddress(parsed.data.smartAccountAddress)
        : null;

      const user = await prisma.$transaction(async (tx: any) => {
        await tx.loginOtp.update({ where: { id: otp.id }, data: { consumed: true } });
        return tx.user.upsert({
          where: { email },
          update: {
            emailVerifiedAt: new Date(),
            primaryWalletAddress,
            embeddedSignerAddress,
            smartAccountAddress,
            authType: 'email',
          },
          create: {
            email,
            emailVerifiedAt: new Date(),
            primaryWalletAddress,
            embeddedSignerAddress,
            smartAccountAddress,
            authType: 'email',
            emailIdentities: { create: { email } },
            wallets: {
              create: {
                walletAddress: primaryWalletAddress,
                walletType: smartAccountAddress ? 'pimlico_smart_account' : 'email_embedded',
              },
            },
          },
        });
      });

      const token = signToken(primaryWalletAddress, {
        userId: user.id,
        email,
        authType: 'email',
      });
      return reply.send({
        token,
        userId: user.id,
        email,
        wallet: primaryWalletAddress,
        embeddedSignerAddress,
        smartAccountAddress,
        authType: 'email',
      });
    },
  );

  // ── POST /api/auth/logout ─────────────────────────────────────────────────
  // Stateless — the client simply drops the JWT from storage.
  fastify.post('/api/auth/logout', async (_req, reply) => {
    return reply.send({ ok: true });
  });

  // ── GET /api/auth/me ──────────────────────────────────────────────────────
  fastify.get('/api/auth/me', async (req, reply) => {
    const session = authenticateSession(req.headers.authorization);
    if (!session?.wallet) {
      return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    return reply.send({
      wallet: session.wallet,
      userId: session.userId,
      email: session.email,
      authType: session.authType ?? 'wallet',
      pimlico: pimlicoConfig(),
    });
  });

  fastify.get('/api/users/me', async (req, reply) => {
    const session = authenticateSession(req.headers.authorization);
    if (!session?.wallet) {
      return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const user = session.userId
      ? await (prisma as any).user.findUnique({ where: { id: session.userId } })
      : null;
    return reply.send({
      userId: user?.id ?? session.userId ?? null,
      email: user?.email ?? session.email ?? null,
      wallet: user?.primaryWalletAddress ?? session.wallet,
      embeddedSignerAddress: user?.embeddedSignerAddress ?? null,
      smartAccountAddress: user?.smartAccountAddress ?? null,
      authType: user?.authType ?? session.authType ?? 'wallet',
      pimlico: pimlicoConfig(),
    });
  });

  fastify.get('/api/pimlico/config', async (_req, reply) => {
    return reply.send(pimlicoConfig());
  });
}


