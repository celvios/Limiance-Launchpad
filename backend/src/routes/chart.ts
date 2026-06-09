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
    type Bucket = { time: number; open: bigint; high: bigint; low: bigint; close: bigint; volume: bigint };
    const bucketMap = new Map<number, Bucket>();

    for (const t of trades) {
      const unixSec = Math.floor(t.timestamp.getTime() / 1000);
      const bucketTime = Math.floor(unixSec / bucketSec) * bucketSec;
      const p = t.pricePerToken;

      if (!bucketMap.has(bucketTime)) {
        bucketMap.set(bucketTime, { time: bucketTime, open: p, high: p, low: p, close: p, volume: 0n });
      }
      const b = bucketMap.get(bucketTime)!;
      b.close = p; // since trades are ordered asc, last one seen is close
      if (p > b.high) b.high = p;
      if (p < b.low) b.low = p;
      b.volume += t.solAmount;
    }

    const formatPrice = (p: bigint) => Number(p) < 1e10 ? Number(p) / 1e6 : Number(p) / 1e18;

    // Only emit buckets that contain real trades — empty bucket filling was causing
    // the price scale to collapse because hundreds of flat candles at the same price
    // dominated the Y-axis range, making real candles invisible.
    const sortedBuckets = Array.from(bucketMap.values()).sort((a, b) => a.time - b.time);

    const data = sortedBuckets.map((b) => ({
      time: b.time,
      open: formatPrice(b.open),
      high: formatPrice(b.high),
      low: formatPrice(b.low),
      close: formatPrice(b.close),
      value: formatPrice(b.close),
      volume: Number(b.volume) / 1e6, // solAmount stored in 6-decimal internal units
    }));

    return reply.send({ data });
  });
}
