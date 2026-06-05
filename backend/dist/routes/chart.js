"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chartRoutes = chartRoutes;
const zod_1 = require("zod");
const prisma_1 = require("../services/prisma");
const ChartQuery = zod_1.z.object({
    range: zod_1.z.enum(['1h', '4h', '1d', 'all']).default('1d'),
});
/** Bucket duration in seconds per range. */
const BUCKET_SECONDS = {
    '1h': 60, // 1-minute candles over 1 hour
    '4h': 300, // 5-minute candles over 4 hours
    '1d': 1800, // 30-minute candles over 1 day
    'all': 86400, // 1-day candles over all time
};
/** How far back to look per range. */
const LOOKBACK_MS = {
    '1h': 1 * 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    'all': Infinity,
};
async function chartRoutes(app) {
    /**
     * GET /api/tokens/:mint/chart
     *
     * Response:
     *   { data: Array<{ time: number; price: string; volume: string }> }
     */
    app.get('/api/tokens/:mint/chart', {
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
        const trades = await prisma_1.prisma.trade.findMany({
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
        const bucketMap = new Map();
        for (const t of trades) {
            const unixSec = Math.floor(t.timestamp.getTime() / 1000);
            const bucketTime = Math.floor(unixSec / bucketSec) * bucketSec;
            const p = t.pricePerToken;
            if (!bucketMap.has(bucketTime)) {
                bucketMap.set(bucketTime, { time: bucketTime, open: p, high: p, low: p, close: p, volume: 0n });
            }
            const b = bucketMap.get(bucketTime);
            b.close = p; // since trades are ordered asc, last one seen is close
            if (p > b.high)
                b.high = p;
            if (p < b.low)
                b.low = p;
            b.volume += t.solAmount;
        }
        const formatPrice = (p) => Number(p) < 1e10 ? Number(p) / 1e6 : Number(p) / 1e18;
        // Emit OHLC in each bucket
        const data = Array.from(bucketMap.values())
            .sort((a, b) => a.time - b.time)
            .map((b) => ({
            time: b.time,
            open: formatPrice(b.open),
            high: formatPrice(b.high),
            low: formatPrice(b.low),
            close: formatPrice(b.close),
            value: formatPrice(b.close),
            volume: Number(b.volume) / 1e18,
        }));
        return reply.send({ data });
    });
}
//# sourceMappingURL=chart.js.map