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

export async function activityRoutes(app: FastifyInstance) {
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
      amount: t.amount.toString(),
      solAmount: t.solAmount.toString(),
      pricePerToken: t.pricePerToken.toString(),
      txSignature: t.txSignature,
      timestamp: t.timestamp.toISOString(),
      isWhale: t.isWhale,
    }));

    return reply.send({
      trades: result,
      nextCursor: hasMore ? trades[trades.length - 1].id : null,
    });
  });
}
