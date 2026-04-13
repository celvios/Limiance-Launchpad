/**
 * Price calculation service — mirrors the on-chain bonding curve math.
 * Used by API endpoints to return current/historical prices without RPC calls.
 */
import { prisma } from './prisma';

const LAMPORTS_PER_SOL = 1_000_000_000n;
const SCALE = 1_000_000n;

function linearPriceAt(a: bigint, b: bigint, supply: bigint): bigint {
  return a + b * supply / SCALE;
}

function expPriceAt(a: bigint, r: bigint, supply: bigint): bigint {
  const rs = r * supply / SCALE;
  return a + a * rs / SCALE + a * rs * rs / SCALE / SCALE / 2n;
}

/**
 * Compute the current spot price in lamports for a given token.
 */
export function computeSpotPrice(
  curveType: string,
  paramA: bigint,
  paramB: bigint,
  paramC: bigint,
  currentSupply: bigint,
  supplyCap: bigint,
): bigint {
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
  } else {
    const remaining = supplyCap - s0;
    const slope = paramA / (remaining * 2n + 1n);
    return paramA / 2n + slope * (currentSupply - s0);
  }
}

/**
 * Fetch price 24h ago from trade history.
 * Returns 0n if no trade found.
 */
export async function getPrice24hAgo(mint: string): Promise<bigint> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const trade = await prisma.trade.findFirst({
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
export function calcPriceChange24h(currentPrice: bigint, price24h: bigint): number {
  if (price24h === 0n) return 0;
  const diff = currentPrice - price24h;
  return Number(diff * 10_000n / price24h) / 100;
}

/**
 * Calculate market cap in lamports: price × currentSupply.
 */
export function calcMarketCap(pricePerToken: bigint, currentSupply: bigint): bigint {
  // currentSupply is in 6-decimal token units
  return pricePerToken * currentSupply / 1_000_000n;
}

/**
 * Get last 7 distinct daily prices for sparkline.
 */
export async function getSparkline(mint: string): Promise<number[]> {
  const trades = await prisma.$queryRaw<Array<{ price: bigint }>>`
    SELECT DISTINCT ON (DATE_TRUNC('day', "timestamp"))
      "pricePerToken" as price
    FROM "Trade"
    WHERE "tokenMint" = ${mint}
    ORDER BY DATE_TRUNC('day', "timestamp") DESC, "timestamp" DESC
    LIMIT 7
  `;
  return trades.map((t) => Number(t.price) / Number(LAMPORTS_PER_SOL));
}

/**
 * Compute 24h trading volume in lamports.
 */
export async function getVolume24h(mint: string): Promise<bigint> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await prisma.trade.aggregate({
    where: {
      tokenMint: mint,
      timestamp: { gte: cutoff },
    },
    _sum: { solAmount: true },
  });
  return result._sum.solAmount ? BigInt(result._sum.solAmount.toString()) : 0n;
}
