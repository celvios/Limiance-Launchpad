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
    '1h': 60, // 1-minute candles
    '4h': 60, // 1-minute candles
    '1d': 300, // 5-minute candles
    'all': 3600, // 1-hour candles
};
/** How far back to look per range. */
const LOOKBACK_MS = {
    '1h': 1 * 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    'all': Infinity,
};
/**
 * Exponential bonding curve spot price.
 * Price(supply) = pMin * (pMax/pMin)^(supply / graduationThreshold)
 */
function getExponentialPrice(supply, pMin, pMax, graduationThreshold) {
    if (graduationThreshold <= 0 || pMin <= 0 || pMax <= pMin)
        return pMin;
    return pMin * Math.pow(pMax / pMin, supply / graduationThreshold);
}
/** Convert stored pricePerToken BigInt to a human-readable float. */
const formatPrice = (p) => Number(p) < 1e10 ? Number(p) / 1e6 : Number(p) / 1e18;
async function chartRoutes(app) {
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
        // Fetch the token for live price computation
        const token = await prisma_1.prisma.token.findFirst({
            where: { OR: [{ mint }, { tokenAddress: mint }] },
            select: {
                currentSupply: true,
                graduationThreshold: true,
                curveParamA: true, // pMax (×1e18)
                curveParamB: true, // pMin (×1e18)
                createdAt: true,
            },
        });
        // Compute live spot price from the exponential curve
        const livePriceUsdt = token
            ? (() => {
                const pMax = Number(token.curveParamA) / 1e18;
                const pMin = Number(token.curveParamB) / 1e18;
                const supply = Number(token.currentSupply);
                const gt = Number(token.graduationThreshold);
                return getExponentialPrice(supply, pMin, pMax, gt);
            })()
            : null;
        // Convert live price to the same BigInt scale used for stored pricePerToken (×1e18)
        const livePriceBigInt = livePriceUsdt !== null
            ? BigInt(Math.round(livePriceUsdt * 1e18))
            : null;
        // Fetch the last trade BEFORE the window to establish the opening price
        const previousTrade = await prisma_1.prisma.trade.findFirst({
            where: { tokenMint: mint, timestamp: { lt: since } },
            orderBy: { timestamp: 'desc' },
            select: { pricePerToken: true },
        });
        // Fetch trades inside the time window
        const trades = await prisma_1.prisma.trade.findMany({
            where: { tokenMint: mint, timestamp: { gte: since } },
            orderBy: { timestamp: 'asc' },
            select: { timestamp: true, pricePerToken: true, solAmount: true },
        });
        // If no trade history at all, but we have a live price — bootstrap from token creation
        if (trades.length === 0 && !previousTrade) {
            if (livePriceBigInt === null)
                return reply.send({ data: [] });
            const nowSec = Math.floor(Date.now() / 1000);
            const nowBucket = Math.floor(nowSec / bucketSec) * bucketSec;
            const liveFloat = livePriceUsdt;
            return reply.send({
                data: [{
                        time: nowBucket,
                        open: liveFloat,
                        high: liveFloat,
                        low: liveFloat,
                        close: liveFloat,
                        value: liveFloat,
                        volume: 0,
                    }],
            });
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
            b.close = p;
            if (p > b.high)
                b.high = p;
            if (p < b.low)
                b.low = p;
            b.volume += t.solAmount;
        }
        const sortedBuckets = Array.from(bucketMap.values()).sort((a, b) => a.time - b.time);
        const startSec = Math.floor(since.getTime() / 1000);
        const windowStartBucketTime = Math.floor(startSec / bucketSec) * bucketSec;
        const firstBucketTime = sortedBuckets.length > 0
            ? (previousTrade ? windowStartBucketTime : sortedBuckets[0].time)
            : windowStartBucketTime;
        const nowSec = Math.floor(Date.now() / 1000);
        const currentBucketTime = Math.floor(nowSec / bucketSec) * bucketSec;
        const lastBucketTime = Math.max(sortedBuckets.length > 0 ? sortedBuckets[sortedBuckets.length - 1].time : 0, currentBucketTime);
        const filledBuckets = [];
        // Iterate through sorted buckets and only add the ones that have actual trades
        for (const bucket of sortedBuckets) {
            filledBuckets.push(bucket);
        }
        // Always ensure there is a bucket for the current time to show the live price
        if (filledBuckets.length === 0 || filledBuckets[filledBuckets.length - 1].time < currentBucketTime) {
            const lastClose = filledBuckets.length > 0 ? filledBuckets[filledBuckets.length - 1].close : (previousTrade ? previousTrade.pricePerToken : 0n);
            filledBuckets.push({
                time: currentBucketTime,
                open: lastClose,
                high: lastClose,
                low: lastClose,
                close: lastClose,
                volume: 0n,
            });
        }
        // ── Override the current (latest) bucket with the live spot price ──────────
        // This ensures the chart always reflects the true current bonding-curve price,
        // even when the token has few or no recent trades.
        if (filledBuckets.length > 0 && livePriceBigInt !== null) {
            const last = filledBuckets[filledBuckets.length - 1];
            // Only update close/high; preserve open/low from actual trades
            last.close = livePriceBigInt;
            if (livePriceBigInt > last.high)
                last.high = livePriceBigInt;
            if (livePriceBigInt < last.low)
                last.low = livePriceBigInt;
        }
        const data = filledBuckets.map((b) => ({
            time: b.time,
            open: formatPrice(b.open),
            high: formatPrice(b.high),
            low: formatPrice(b.low),
            close: formatPrice(b.close),
            value: formatPrice(b.close),
            volume: Number(b.volume) / 1e6,
        }));
        return reply.send({ data });
    });
}
//# sourceMappingURL=chart.js.map