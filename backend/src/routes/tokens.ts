/**
 * Token API routes.
 *
 * POST /api/tokens      — Index a token after on-chain deploy
 * GET  /api/tokens      — Feed / explore with filters and cursor pagination
 * GET  /api/tokens/:mint — Full token detail
 */
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { fetchTokenConfig, decodeCurveType, decodeStatus } from '../services/rpc';
import {
  computeSpotPrice,
  calcMarketCap,
  calcPriceChange24h,
  getPrice24hAgo,
  getSparkline,
  getVolume24h,
} from '../services/price';
import { cacheGet, cacheSet } from '../services/redis';

const LAMPORTS_PER_SOL = 1_000_000_000n;

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────────────────────────

const IndexTokenBody = z.object({
  mint: z.string().min(32).max(44),
  txSignature: z.string().min(64).max(90),
  description: z.string().max(500).default(''),
});

const FeedQuery = z.object({
  filter: z
    .enum(['new', 'trending', 'near_grad', 'graduated', 'following'])
    .default('new'),
  tags: z.string().optional(), // comma-separated curve types
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  wallet: z.string().optional(), // required for "following" filter
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: serialize BigInt fields for JSON response
// ─────────────────────────────────────────────────────────────────────────────
function bigintToStr(v: bigint): string {
  return v.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build TokenListItem from DB token + computed price fields
// ─────────────────────────────────────────────────────────────────────────────
async function buildTokenListItem(token: any) {
  const priceA = BigInt(token.curveParamA.toString());
  const priceB = BigInt(token.curveParamB.toString());
  const priceC = BigInt(token.curveParamC.toString());
  const supply = BigInt(token.currentSupply.toString());
  const cap = BigInt(token.supplyCap.toString());

  const spotPrice = computeSpotPrice(token.curveType, priceA, priceB, priceC, supply, cap);
  const price24h = await getPrice24hAgo(token.mint);
  const priceChange24h = calcPriceChange24h(spotPrice, price24h);
  const marketCap = calcMarketCap(spotPrice, supply);
  const volume24h = await getVolume24h(token.mint);
  const sparkline = await getSparkline(token.mint);

  const commentCount = await prisma.comment.count({ where: { tokenMint: token.mint } });

  // Resolve creator handle
  const profile = await prisma.profile.findUnique({
    where: { walletAddress: token.creator },
    select: { username: true },
  });

  return {
    mint: token.mint,
    symbol: token.symbol,
    name: token.name,
    imageUri: token.uri,
    description: token.description,
    creatorWallet: token.creator,
    creatorHandle: profile?.username ?? null,
    createdAt: token.createdAt.toISOString(),
    curveType: token.curveType,
    currentSupply: bigintToStr(supply),
    supplyCap: bigintToStr(cap),
    graduationThreshold: bigintToStr(BigInt(token.graduationThreshold.toString())),
    status: token.status,
    price: bigintToStr(spotPrice),
    priceChange24h,
    marketCap: bigintToStr(marketCap),
    commentCount,
    sparklineData: sparkline,
    volume24h: bigintToStr(volume24h),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Route registration
// ─────────────────────────────────────────────────────────────────────────────

export async function tokenRoutes(app: FastifyInstance) {
  // ── POST /api/tokens ────────────────────────────────────────────────────────
  app.post('/api/tokens', async (req, reply) => {
    const body = IndexTokenBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.message, code: 'VALIDATION_ERROR' });
    }

    const { mint, txSignature, description } = body.data;

    // Check if already indexed
    const existing = await prisma.token.findUnique({ where: { mint } });
    if (existing) {
      return reply.send({ token: existing });
    }

    // Fetch from chain
    const onChain = await fetchTokenConfig(mint);
    if (!onChain) {
      return reply.code(400).send({ error: 'Token not found on-chain', code: 'TOKEN_NOT_FOUND' });
    }

    const curveType = decodeCurveType(onChain.curveType);

    const token = await prisma.token.create({
      data: {
        mint,
        creator: onChain.creator.toBase58(),
        name: onChain.name,
        symbol: onChain.symbol,
        uri: onChain.uri,
        description,
        supplyCap: onChain.supplyCap,
        currentSupply: onChain.currentSupply,
        graduationThreshold: onChain.graduationThreshold,
        creatorAllocation: onChain.creatorAllocation,
        curveType,
        curveParamA: onChain.curveParams.paramA,
        curveParamB: onChain.curveParams.paramB,
        curveParamC: onChain.curveParams.paramC,
        status: 'active',
      },
    });

    return reply.code(200).send({ token });
  });

  // ── GET /api/tokens/check-name ──────────────────────────────────────────────
  // Must be registered before /:mint to avoid Fastify treating "check-name" as a mint
  app.get('/api/tokens/check-name', async (req, reply) => {
    const { name } = req.query as { name?: string };
    if (!name || name.trim().length < 1) {
      return reply.code(400).send({ error: 'name query param required', code: 'VALIDATION_ERROR' });
    }
    const existing = await prisma.token.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' } },
      select: { mint: true },
    });
    return reply.send({ available: !existing });
  });

  // ── GET /api/tokens/check-symbol ─────────────────────────────────────────────
  app.get('/api/tokens/check-symbol', async (req, reply) => {
    const { symbol } = req.query as { symbol?: string };
    if (!symbol || symbol.trim().length < 1) {
      return reply.code(400).send({ error: 'symbol query param required', code: 'VALIDATION_ERROR' });
    }
    const existing = await prisma.token.findFirst({
      where: { symbol: { equals: symbol.trim().toUpperCase(), mode: 'insensitive' } },
      select: { mint: true },
    });
    return reply.send({ available: !existing });
  });

  // ── GET /api/tokens ─────────────────────────────────────────────────────────
  app.get('/api/tokens', async (req, reply) => {
    const q = FeedQuery.safeParse(req.query);
    if (!q.success) {
      return reply.code(400).send({ error: q.error.message, code: 'VALIDATION_ERROR' });
    }

    const { filter, tags, cursor, limit, wallet } = q.data;

    // Build WHERE clause
    const where: any = {};

    switch (filter) {
      case 'graduated':
        where.status = 'graduated';
        break;
      case 'near_grad':
        where.status = 'active';
        // Filter in-memory after fetch (requires supply comparison — SQL fallback)
        break;
      case 'following':
        if (!wallet) {
          return reply.code(400).send({ error: 'wallet required for following filter', code: 'WALLET_REQUIRED' });
        }
        const follows = await prisma.follow.findMany({
          where: { followerWallet: wallet },
          select: { followingWallet: true },
        });
        where.creator = { in: follows.map((f: any) => f.followingWallet) };
        where.status = 'active';
        break;
      case 'new':
        where.status = 'active';
        break;
      case 'trending':
      default:
        where.status = 'active';
        break;
    }

    // Tag filters
    if (tags) {
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
      const curveFilters = tagList.filter((t) => ['linear', 'exponential', 'sigmoid'].includes(t));
      if (curveFilters.length > 0) {
        where.curveType = { in: curveFilters };
      }
    }

    // Cursor pagination
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }

    // ORDER BY
    let orderBy: any = { createdAt: 'desc' };
    if (filter === 'trending') {
      // Trending: most trades in last 24h — handled via join; use updatedAt as proxy for now
      orderBy = { updatedAt: 'desc' };
    }

    const tokens = await prisma.token.findMany({
      where,
      orderBy,
      take: limit + 1, // fetch one extra to determine if there's a next page
    });

    const hasMore = tokens.length > limit;
    const page = hasMore ? tokens.slice(0, limit) : tokens;

    // For near_grad: filter where currentSupply > 75% of graduationThreshold
    const filtered =
      filter === 'near_grad'
        ? page.filter((t: any) => {
            const supply = BigInt(t.currentSupply.toString());
            const threshold = BigInt(t.graduationThreshold.toString());
            return threshold > 0n && supply * 100n / threshold > 75n;
          })
        : page;

    // Build list items (parallelized per token)
    const items = await Promise.all(filtered.map(buildTokenListItem));

    const nextCursor =
      hasMore && page.length > 0
        ? page[page.length - 1].createdAt.toISOString()
        : null;

    return reply.send({ tokens: items, nextCursor });
  });

  // ── GET /api/tokens/:mint ───────────────────────────────────────────────────
  app.get('/api/tokens/:mint', async (req, reply) => {
    const { mint } = req.params as { mint: string };
    if (!mint || mint.length < 32) {
      return reply.code(400).send({ error: 'Invalid mint address', code: 'INVALID_MINT' });
    }

    // Cache check (5s TTL)
    const cacheKey = `token:${mint}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return reply.send(cached);

    const token = await prisma.token.findUnique({ where: { mint } });
    if (!token) {
      return reply.code(404).send({ error: 'Token not found', code: 'NOT_FOUND' });
    }

    const priceA = BigInt(token.curveParamA.toString());
    const priceB = BigInt(token.curveParamB.toString());
    const priceC = BigInt(token.curveParamC.toString());
    const supply = BigInt(token.currentSupply.toString());
    const cap = BigInt(token.supplyCap.toString());

    const spotPrice = computeSpotPrice(token.curveType, priceA, priceB, priceC, supply, cap);
    const price24h = await getPrice24hAgo(mint);
    const priceChange24h = calcPriceChange24h(spotPrice, price24h);
    const marketCap = calcMarketCap(spotPrice, supply);
    const volume24h = await getVolume24h(mint);

    const [tradeCount, holderSet, profile] = await Promise.all([
      prisma.trade.count({ where: { tokenMint: mint } }),
      prisma.trade.findMany({
        where: { tokenMint: mint },
        distinct: ['walletAddress'],
        select: { walletAddress: true },
      }),
      prisma.profile.findUnique({
        where: { walletAddress: token.creator },
        select: { username: true },
      }),
    ]);

    const result = {
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      imageUri: token.uri,
      description: token.description,
      curveType: token.curveType,
      curveParams: {
        a: bigintToStr(priceA),
        b: bigintToStr(priceB),
        c: bigintToStr(priceC),
      },
      supplyCap: bigintToStr(cap),
      currentSupply: bigintToStr(supply),
      graduationThreshold: bigintToStr(BigInt(token.graduationThreshold.toString())),
      status: token.status,
      raydiumPoolId: token.raydiumPoolId ?? null,
      creatorWallet: token.creator,
      creatorHandle: profile?.username ?? null,
      createdAt: token.createdAt.toISOString(),
      holderCount: holderSet.length,
      tradeCount,
      price: bigintToStr(spotPrice),
      priceChange24h,
      volume24h: bigintToStr(volume24h),
      marketCap: bigintToStr(marketCap),
    };

    await cacheSet(cacheKey, result, 5);
    return reply.send(result);
  });
}
