"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeSpotPrice = computeSpotPrice;
exports.getPrice24hAgo = getPrice24hAgo;
exports.calcPriceChange24h = calcPriceChange24h;
exports.calcMarketCap = calcMarketCap;
exports.getSparkline = getSparkline;
exports.getVolume24h = getVolume24h;
/**
 * Price calculation service — mirrors the on-chain bonding curve math.
 * Used by API endpoints to return current/historical prices without RPC calls.
 */
const prisma_1 = require("./prisma");
const PAYMENT_UNIT = 1000000000000000000n;
const SCALE = 1000000n;
function linearPriceAt(a, b, supply) {
    return a + b * supply / SCALE;
}
function expPriceAt(a, r, supply) {
    const rs = r * supply / SCALE;
    return a + a * rs / SCALE + a * rs * rs / SCALE / SCALE / 2n;
}
/**
 * Compute the current spot price in wei for a given token.
 */
function computeSpotPrice(curveType, paramA, paramB, paramC, currentSupply, supplyCap) {
    if (curveType === 'linear') {
        return linearPriceAt(paramA, paramB, currentSupply);
    }
    if (curveType === 'exponential') {
        return expPriceAt(paramA, paramB, currentSupply);
    }
    // Sigmoid: approximate via linear interpolation at current supply
    // Full sigmoid computed client-side; this gives a reasonable on-chain price ref
    const fraction = supplyCap > 0n ? currentSupply * SCALE / supplyCap : 0n;
    const k = paramB;
    const s0 = paramC;
    // Simplified: use piecewise linear around midpoint
    if (currentSupply < s0) {
        const slope = paramA / (s0 * 2n + 1n);
        return slope * currentSupply;
    }
    else {
        const remaining = supplyCap - s0;
        const slope = paramA / (remaining * 2n + 1n);
        return paramA / 2n + slope * (currentSupply - s0);
    }
}
/**
 * Fetch price 24h ago from trade history.
 * Returns 0n if no trade found.
 */
async function getPrice24hAgo(mint) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const trade = await prisma_1.prisma.trade.findFirst({
        where: {
            tokenMint: mint,
            timestamp: { lte: cutoff },
        },
        orderBy: { timestamp: 'desc' },
        select: { pricePerToken: true },
    });
    return trade ? BigInt(trade.pricePerToken.toString()) : 0n;
}
/**
 * Calculate 24h price change percentage.
 */
function calcPriceChange24h(currentPrice, price24h) {
    if (price24h === 0n)
        return 0;
    const diff = currentPrice - price24h;
    return Number(diff * 10000n / price24h) / 100;
}
/**
 * Calculate market cap in wei: price × currentSupply.
 */
function calcMarketCap(pricePerToken, currentSupply) {
    // currentSupply is in 6-decimal token units
    return pricePerToken * currentSupply / 1000000n;
}
/**
 * Get last 7 distinct daily prices for sparkline.
 */
async function getSparkline(mint) {
    const trades = await prisma_1.prisma.$queryRaw `
    SELECT DISTINCT ON (DATE_TRUNC('day', "timestamp"))
      "pricePerToken" as price
    FROM "Trade"
    WHERE "tokenMint" = ${mint}
    ORDER BY DATE_TRUNC('day', "timestamp") DESC, "timestamp" DESC
    LIMIT 7
  `;
    return trades.map((t) => Number(t.price) / Number(PAYMENT_UNIT));
}
/**
 * Compute 24h trading volume in wei.
 */
async function getVolume24h(mint) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await prisma_1.prisma.trade.aggregate({
        where: {
            tokenMint: mint,
            timestamp: { gte: cutoff },
        },
        _sum: { solAmount: true },
    });
    return result._sum.solAmount ? BigInt(result._sum.solAmount.toString()) : 0n;
}
//# sourceMappingURL=price.js.map