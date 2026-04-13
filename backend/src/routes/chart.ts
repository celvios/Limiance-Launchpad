/**
 * Price chart route.
 *
 * GET /api/tokens/:mint/chart?range=1h|4h|1d|all
 *
 * Aggregates trade data into OHLCV-style buckets from the trades table.
 * Returns (time, price, volume) tuples sorted ascending for chart rendering.
 */
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma';

const ChartQuery = z.object({
  range: z.enum(['1h', '4h', '1d', 'all']).default('1d'),
});

/** Bucket duration in seconds per range. */
const BUCKET_SECONDS: Record<string, number> = {
  '1h':  60,      // 1-minute candles over 1 hour
  '4h':  300,     // 5-minute candles over 4 hours
  '1d':  1800,    // 30-minute candles over 1 day
  'all': 86400,   // 1-day candles over all time
};

/** How far back to look per range. */
const LOOKBACK_MS: Record<string, number> = {
  '1h':  1 * 60 * 60 * 1000,
  '4h':  4 * 60 * 60 * 1000,
  '1d':  24 * 60 * 60 * 1000,
  'all': Infinity,
};

export async function chartRoutes(app: FastifyInstance) {
  /**
   * GET /api/tokens/:mint/chart
   *
   * Response:
   *   { data: Array<{ time: number; price: string; volume: string }> }
   */
  app.get<{
    Params: { mint: string };
    Querystring: z.infer<typeof ChartQuery>;
  }>('/api/tokens/:mint/chart', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { mint } = request.params;
    const query = ChartQuery.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: 'Invalid query params', code: 'INVALID_PARAMS' });
    }
    const { range } = query.data;

    const bucketSec = BUCKET_SECONDS[range];
    const lookbackMs = LOOKBACK_MS[range];
    const since = lookbackMs === Infinity
      ? new Date(0)
      : new Date(Date.now() - lookbackMs);

    const trades = await prisma.trade.findMany({
      where: {
        tokenMint: mint,
        timestamp: { gte: since },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        pricePerToken: true,
        solAmount: true,
      },
    });

    if (trades.length === 0) {
      return reply.send({ data: [] });
    }

    // Group into time buckets
    type Bucket = { time: number; prices: bigint[]; volume: bigint };
    const bucketMap = new Map<number, Bucket>();

    for (const t of trades) {
      const unixSec = Math.floor(t.timestamp.getTime() / 1000);
      const bucketTime = Math.floor(unixSec / bucketSec) * bucketSec;

      if (!bucketMap.has(bucketTime)) {
        bucketMap.set(bucketTime, { time: bucketTime, prices: [], volume: 0n });
      }
      const b = bucketMap.get(bucketTime)!;
      b.prices.push(t.pricePerToken);
      b.volume += t.solAmount;
    }

    // Emit last price in each bucket (close price) and total volume
    const data = Array.from(bucketMap.values())
      .sort((a, b) => a.time - b.time)
      .map((b) => ({
        time: b.time,
        price: b.prices[b.prices.length - 1].toString(),
        volume: b.volume.toString(),
      }));

    return reply.send({ data });
  });
}
