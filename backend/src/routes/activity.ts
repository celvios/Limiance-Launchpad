/**
 * Token activity route.
 *
 * GET /api/tokens/:mint/activity
 *
 * Returns a cursor-paginated list of trades for a specific token.
 * Most recent trades first.
 */
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma';

const ActivityQuery = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(), // trade ID cursor
});

const HomeActivityQuery = z.object({
  limit: z.coerce.number().min(1).max(50).default(24),
});

export async function activityRoutes(app: FastifyInstance) {
  app.get('/api/activity', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const query = HomeActivityQuery.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: 'Invalid query params', code: 'INVALID_PARAMS' });

    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const take = query.data.limit;
    const [trades, launches, comments, follows, watches] = await Promise.all([
      prisma.trade.findMany({
        where: { timestamp: { gte: since } }, orderBy: { timestamp: 'desc' }, take,
        select: { id: true, walletAddress: true, tokenMint: true, type: true, amount: true, solAmount: true, timestamp: true },
      }),
      prisma.token.findMany({
        where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take,
        select: { mint: true, symbol: true, name: true, creator: true, createdAt: true },
      }),
      prisma.comment.findMany({
        where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take,
        select: { id: true, walletAddress: true, tokenMint: true, message: true, createdAt: true },
      }),
      prisma.follow.findMany({
        where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take,
        select: { id: true, followerWallet: true, followingWallet: true, createdAt: true },
      }),
      prisma.watchlist.findMany({
        where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take,
        select: { id: true, walletAddress: true, tokenMint: true, createdAt: true },
      }),
    ]);

    const tokenMints = [...new Set([
      ...trades.map((item) => item.tokenMint),
      ...comments.map((item) => item.tokenMint),
      ...watches.map((item) => item.tokenMint),
      ...launches.map((item) => item.mint),
    ])];
    const walletAddresses = [...new Set([
      ...trades.map((item) => item.walletAddress),
      ...comments.map((item) => item.walletAddress),
      ...watches.map((item) => item.walletAddress),
      ...follows.flatMap((item) => [item.followerWallet, item.followingWallet]),
      ...launches.map((item) => item.creator),
    ])];
    const profileWhere = walletAddresses.length > 0
      ? { OR: walletAddresses.map((walletAddress) => ({ walletAddress: { equals: walletAddress, mode: 'insensitive' as const } })) }
      : { walletAddress: { in: [] as string[] } };
    const [tokenRows, profiles] = await Promise.all([
      prisma.token.findMany({ where: { mint: { in: tokenMints } }, select: { mint: true, symbol: true, name: true } }),
      prisma.profile.findMany({ where: profileWhere, select: { walletAddress: true, username: true, usernameDisplay: true } }),
    ]);
    const tokenMap = new Map(tokenRows.map((item) => [item.mint, item]));
    // Wallet casing can differ between signed activity and profile creation.
    // Normalize lookup keys so a valid username is not lost to checksum casing.
    const profileMap = new Map(profiles.map((item) => [item.walletAddress.toLowerCase(), item.usernameDisplay || item.username]));
    const usernameFor = (walletAddress: string) => profileMap.get(walletAddress.toLowerCase()) ?? null;
    const makeToken = (mint: string) => {
      const token = tokenMap.get(mint);
      return { tokenMint: mint, tokenSymbol: token?.symbol ?? null, tokenName: token?.name ?? null };
    };

    const activities = [
      ...trades.map((item) => ({
        id: `trade:${item.id}`, type: item.type, timestamp: item.timestamp.getTime(),
        walletAddress: item.walletAddress, username: usernameFor(item.walletAddress),
        ...makeToken(item.tokenMint), amount: Number(item.amount) / 1e6, usdt: Number(item.solAmount) / 1e6,
      })),
      ...launches.map((item) => ({
        id: `launch:${item.mint}`, type: 'launch', timestamp: item.createdAt.getTime(),
        walletAddress: item.creator, username: usernameFor(item.creator),
        tokenMint: item.mint, tokenSymbol: item.symbol, tokenName: item.name,
      })),
      ...comments.map((item) => ({
        id: `comment:${item.id}`, type: 'comment', timestamp: item.createdAt.getTime(),
        walletAddress: item.walletAddress, username: usernameFor(item.walletAddress),
        commentPreview: item.message.replace(/\s+/g, ' ').trim().slice(0, 120),
        ...makeToken(item.tokenMint),
      })),
      ...follows.map((item) => ({
        id: `follow:${item.id}`, type: 'follow', timestamp: item.createdAt.getTime(),
        walletAddress: item.followerWallet, username: usernameFor(item.followerWallet),
        followingWallet: item.followingWallet, followingUsername: usernameFor(item.followingWallet),
        tokenMint: null, tokenSymbol: null, tokenName: null,
      })),
      ...watches.map((item) => ({
        id: `watch:${item.id}`, type: 'watch', timestamp: item.createdAt.getTime(),
        walletAddress: item.walletAddress, username: usernameFor(item.walletAddress),
        ...makeToken(item.tokenMint),
      })),
    ]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, take);

    return reply.send({ activities });
  });

  /**
   * GET /api/tokens/:mint/activity
   *
   * Response:
   *   { trades: TradeEvent[], nextCursor: string | null }
   */
  app.get<{
    Params: { mint: string };
    Querystring: z.infer<typeof ActivityQuery>;
  }>('/api/tokens/:mint/activity', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { mint } = request.params;
    const query = ActivityQuery.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: 'Invalid query params', code: 'INVALID_PARAMS' });
    }
    const { limit, cursor } = query.data;

    // Fetch one extra to determine if there's a next page
    const trades = await prisma.trade.findMany({
      where: { tokenMint: mint },
      orderBy: { timestamp: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        type: true,
        walletAddress: true,
        amount: true,
        solAmount: true,
        pricePerToken: true,
        txSignature: true,
        timestamp: true,
        isWhale: true,
      },
    });

    const hasMore = trades.length > limit;
    if (hasMore) trades.pop();

    // Enrich with profile handles (best-effort)
    const wallets = [...new Set(trades.map((t) => t.walletAddress))];
    const profiles = await prisma.profile.findMany({
      where: { walletAddress: { in: wallets } },
      select: { walletAddress: true, username: true },
    });
    const handleMap = new Map(profiles.map((p) => [p.walletAddress, p.username]));

    const result = trades.map((t) => ({
      id: t.id,
      type: t.type,
      walletAddress: t.walletAddress,
      walletHandle: handleMap.get(t.walletAddress) ?? null,
      tokenAmount: Number(t.amount) / 1e6,
      solAmount: Number(t.solAmount) / 1e6,
      pricePerToken: Number(t.pricePerToken) < 1e10 ? Number(t.pricePerToken) / 1e6 : Number(t.pricePerToken) / 1e18,
      txSignature: t.txSignature,
      timestamp: t.timestamp.getTime(),
      isWhale: t.isWhale,
    }));

    return reply.send({
      trades: result,
      nextCursor: hasMore ? trades[trades.length - 1].id : null,
    });
  });
}
