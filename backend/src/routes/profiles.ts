/**
 * Profile routes — Phase 5 social layer.
 *
 * GET  /api/profiles/check-username/:username  — availability check
 * GET  /api/profiles/:wallet                   — get profile (404 = not onboarded)
 * POST /api/profiles                           — create profile (onboarding)
 * PUT  /api/profiles/:wallet                   — update profile
 * GET  /api/profiles/:wallet/tokens            — tokens created by wallet
 * GET  /api/profiles/:wallet/holdings          — current token holdings
 * GET  /api/profiles/:wallet/trades            — trade history
 * GET  /api/profiles/:wallet/comments          — comments posted
 *
 * Auth: POST and PUT require a wallet signature.
 * GET endpoints are public (no auth required).
 */
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { verifyWalletSignature, isTimestampFresh } from '../lib/auth';
import { computeSpotPrice } from '../services/price';

// ─────────────────────────────────────────────────────────────────────────────
// Validation schemas
// ─────────────────────────────────────────────────────────────────────────────

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

const CreateProfileBody = z.object({
  walletAddress: z.string().min(32).max(44),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(USERNAME_RE, 'Username may only contain letters, numbers, and underscores'),
  profilePicUri: z.string().nullable().default(null),
  coverUri: z.string().nullable().default(null),
  signature: z.string().min(1),
  timestamp: z.number().int().positive(),
});

const UpdateProfileBody = z.object({
  walletAddress: z.string().min(32).max(44),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(USERNAME_RE)
    .optional(),
  profilePicUri: z.string().nullable().optional(),
  coverUri: z.string().nullable().optional(),
  bio: z.string().max(500).optional(), // accepted but ignored — no bio
  signature: z.string().min(1),
  timestamp: z.number().int().positive(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function buildProfileResponse(
  profile: {
    walletAddress: string;
    username: string;
    usernameDisplay: string;
    bio: string;
    profilePicUri: string;
    coverUri: string;
    onboarded: boolean;
    createdAt: Date;
  },
  viewerWallet?: string
) {
  const [followerCount, followingCount, tokenCount, graduatedCount, isFollowing] =
    await Promise.all([
      prisma.follow.count({ where: { followingWallet: profile.walletAddress } }),
      prisma.follow.count({ where: { followerWallet: profile.walletAddress } }),
      prisma.token.count({ where: { creator: profile.walletAddress } }),
      prisma.token.count({
        where: { creator: profile.walletAddress, status: 'graduated' },
      }),
      viewerWallet && viewerWallet !== profile.walletAddress
        ? prisma.follow
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

export async function profileRoutes(fastify: FastifyInstance) {
  // ── Check username availability ───────────────────────────────────────────

  fastify.get<{ Params: { username: string } }>(
    '/api/profiles/check-username/:username',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { username } = req.params;

      // Local format validation
      if (!username || username.length < 3 || username.length > 20) {
        return reply.send({ available: false });
      }
      if (!USERNAME_RE.test(username)) {
        return reply.send({ available: false });
      }

      // Case-insensitive uniqueness check
      const existing = await prisma.profile.findUnique({
        where: { username: username.toLowerCase() },
      });

      return reply.send({ available: existing === null });
    }
  );

  // ── Get profile ───────────────────────────────────────────────────────────

  fastify.get<{ Params: { wallet: string }; Querystring: { viewer?: string } }>(
    '/api/profiles/:wallet',
    async (req, reply) => {
      const { wallet } = req.params;
      const viewer = req.query.viewer;

      const profile = await prisma.profile.findUnique({
        where: { walletAddress: wallet },
      });

      if (!profile || !profile.onboarded) {
        return reply.code(404).send({ error: 'Profile not found', code: 'NOT_FOUND' });
      }

      return reply.send(await buildProfileResponse(profile, viewer));
    }
  );

  // ── Create profile (onboarding) ───────────────────────────────────────────

  fastify.post<{ Body: unknown }>(
    '/api/profiles',
    {
      config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const parsed = CreateProfileBody.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'INVALID_BODY' });
      }

      const { walletAddress, username, profilePicUri, coverUri, signature, timestamp } =
        parsed.data;

      // Timestamp freshness
      if (!isTimestampFresh(timestamp)) {
        return reply.code(400).send({ error: 'Request expired', code: 'EXPIRED' });
      }

      // Signature verification
      const message = `ACTION:ONBOARD|DATA:${username}|TIMESTAMP:${timestamp}`;
      if (!verifyWalletSignature(walletAddress, message, signature)) {
        return reply.code(400).send({ error: 'Invalid signature', code: 'INVALID_SIGNATURE' });
      }

      // Username format
      if (!USERNAME_RE.test(username) || username.length < 3 || username.length > 20) {
        return reply
          .code(400)
          .send({ error: 'Invalid username format', code: 'INVALID_USERNAME' });
      }

      const usernameLower = username.toLowerCase();

      // Check profile already exists
      const existing = await prisma.profile.findUnique({
        where: { walletAddress },
      });
      if (existing?.onboarded) {
        return reply
          .code(409)
          .send({ error: 'Profile already exists', code: 'ALREADY_EXISTS' });
      }

      // Check username uniqueness
      const usernameTaken = await prisma.profile.findUnique({
        where: { username: usernameLower },
      });
      if (usernameTaken && usernameTaken.walletAddress !== walletAddress) {
        return reply.code(400).send({ error: 'Username taken', code: 'USERNAME_TAKEN' });
      }

      // Upsert (handles wallet connecting for first time vs. completing onboarding)
      const profile = await prisma.profile.upsert({
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
    }
  );

  // ── Update profile ────────────────────────────────────────────────────────

  fastify.put<{ Params: { wallet: string }; Body: unknown }>(
    '/api/profiles/:wallet',
    async (req, reply) => {
      const { wallet } = req.params;

      const parsed = UpdateProfileBody.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'INVALID_BODY' });
      }

      const { walletAddress, username, profilePicUri, coverUri, signature, timestamp } =
        parsed.data;

      if (walletAddress !== wallet) {
        return reply.code(403).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      }

      if (!isTimestampFresh(timestamp)) {
        return reply.code(400).send({ error: 'Request expired', code: 'EXPIRED' });
      }

      const displayName = username ?? wallet;
      const message = `ACTION:UPDATE_PROFILE|DATA:${displayName}|TIMESTAMP:${timestamp}`;
      if (!verifyWalletSignature(walletAddress, message, signature)) {
        return reply.code(400).send({ error: 'Invalid signature', code: 'INVALID_SIGNATURE' });
      }

      const profile = await prisma.profile.findUnique({ where: { walletAddress: wallet } });
      if (!profile || !profile.onboarded) {
        return reply.code(404).send({ error: 'Profile not found', code: 'NOT_FOUND' });
      }

      // Validate new username if provided
      const updateData: Record<string, unknown> = {};
      if (username !== undefined) {
        if (!USERNAME_RE.test(username) || username.length < 3 || username.length > 20) {
          return reply
            .code(400)
            .send({ error: 'Invalid username format', code: 'INVALID_USERNAME' });
        }
        const usernameLower = username.toLowerCase();
        const taken = await prisma.profile.findUnique({
          where: { username: usernameLower },
        });
        if (taken && taken.walletAddress !== wallet) {
          return reply.code(409).send({ error: 'Username taken', code: 'USERNAME_TAKEN' });
        }
        updateData.username = usernameLower;
        updateData.usernameDisplay = username;
      }
      if (profilePicUri !== undefined) updateData.profilePicUri = profilePicUri ?? '';
      if (coverUri !== undefined) updateData.coverUri = coverUri ?? '';

      const updated = await prisma.profile.update({
        where: { walletAddress: wallet },
        data: updateData,
      });

      return reply.send({ profile: await buildProfileResponse(updated) });
    }
  );

  // ── Profile sub-resources ─────────────────────────────────────────────────

  // Tokens created by wallet
  fastify.get<{ Params: { wallet: string } }>(
    '/api/profiles/:wallet/tokens',
    async (req, reply) => {
      const { wallet } = req.params;

      const tokens = await prisma.token.findMany({
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
    }
  );

  // Holdings — net-positive token positions computed from trades
  fastify.get<{ Params: { wallet: string } }>(
    '/api/profiles/:wallet/holdings',
    async (req, reply) => {
      const { wallet } = req.params;

      // Aggregate buys and sells per token
      const [buys, sells] = await Promise.all([
        prisma.trade.groupBy({
          by: ['tokenMint'],
          where: { walletAddress: wallet, type: 'buy' },
          _sum: { amount: true, solAmount: true },
        }),
        prisma.trade.groupBy({
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
      const tokens = await prisma.token.findMany({ where: { mint: { in: mints } } });
      const tokenMap = new Map(tokens.map((t) => [t.mint, t]));

      const LAMPORTS_PER_SOL = 1_000_000_000n;
      const TOKEN_DECIMALS = 1_000_000n;

      const holdings = netHoldings
        .map((h) => {
          const token = tokenMap.get(h.tokenMint);
          if (!token) return null;

          const currentPrice = computeSpotPrice(
            token.curveType,
            BigInt(token.curveParamA.toString()),
            BigInt(token.curveParamB.toString()),
            BigInt(token.curveParamC.toString()),
            BigInt(token.currentSupply.toString()),
            BigInt(token.supplyCap.toString())
          );

          const avgBuyLamports =
            h.buyAmount > BigInt(0)
              ? Number((h.solSpent * TOKEN_DECIMALS) / h.buyAmount)
              : 0;

          const currentLamports = Number(currentPrice);
          const pnlPercent =
            avgBuyLamports > 0
              ? ((currentLamports - avgBuyLamports) / avgBuyLamports) * 100
              : 0;

          const valueLamports = (h.net * BigInt(currentLamports)) / TOKEN_DECIMALS;
          const valueSol = Number(valueLamports) / Number(LAMPORTS_PER_SOL);

          return {
            mint: token.mint,
            symbol: token.symbol,
            name: token.name,
            amount: Number(h.net) / Number(TOKEN_DECIMALS),
            avgBuyPrice: avgBuyLamports / Number(LAMPORTS_PER_SOL),
            currentPrice: currentLamports / Number(LAMPORTS_PER_SOL),
            pnlPercent: Math.round(pnlPercent * 100) / 100,
            value: Math.round(valueSol * 1e6) / 1e6,
          };
        })
        .filter((h): h is NonNullable<typeof h> => h !== null);

      return reply.send({ holdings });
    }
  );

  // Trade history
  fastify.get<{
    Params: { wallet: string };
    Querystring: { cursor?: string; limit?: string };
  }>('/api/profiles/:wallet/trades', async (req, reply) => {
    const { wallet } = req.params;
    const limit = Math.min(parseInt(req.query.limit ?? '20', 10), 50);
    const cursor = req.query.cursor;

    const trades = await prisma.trade.findMany({
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
  fastify.get<{ Params: { wallet: string } }>(
    '/api/profiles/:wallet/comments',
    async (req, reply) => {
      const { wallet } = req.params;

      const comments = await prisma.comment.findMany({
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
    }
  );

  // ── Follow/Unfollow aliases (compatibility with frontend api.ts) ──────────

  fastify.post<{ Params: { wallet: string }; Body: unknown }>(
    '/api/profiles/:wallet/follow',
    async (req, reply) => {
      // Re-use the follows route logic inline for alias compatibility
      const body = req.body as {
        followerWallet?: string;
        signature?: string;
        timestamp?: number;
      };
      const followerWallet = body?.followerWallet;
      const followingWallet = req.params.wallet;

      if (!followerWallet) {
        return reply.code(400).send({ error: 'followerWallet required', code: 'MISSING_FIELDS' });
      }

      await prisma.follow.upsert({
        where: {
          followerWallet_followingWallet: { followerWallet, followingWallet },
        },
        create: { followerWallet, followingWallet },
        update: {},
      });

      return reply.code(201).send({ following: true });
    }
  );

  fastify.post<{ Params: { wallet: string }; Body: unknown }>(
    '/api/profiles/:wallet/unfollow',
    async (req, reply) => {
      const body = req.body as { followerWallet?: string };
      const followerWallet = body?.followerWallet;
      const followingWallet = req.params.wallet;

      if (!followerWallet) {
        return reply.code(400).send({ error: 'followerWallet required', code: 'MISSING_FIELDS' });
      }

      await prisma.follow
        .delete({
          where: {
            followerWallet_followingWallet: { followerWallet, followingWallet },
          },
        })
        .catch(() => null); // Ignore if not found

      return reply.send({ following: false });
    }
  );
}
