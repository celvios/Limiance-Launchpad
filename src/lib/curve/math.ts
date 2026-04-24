/**
 * Bonding Curve Math — TypeScript port of the Anchor program's curve modules.
 *
 * Forge (Claude) implementation. Mirrors programs/launchpad/src/curve/*.rs exactly.
 *
 * IMPORTANT UNITS:
 *   - All on-chain values are in lamports (1 SOL = 1_000_000_000 lamports).
 *   - The existing helper functions (calculatePrice, calculateBuyPrice,
 *     calculateSellReturn) work in SOL for UI display convenience.
 *   - The on-chain functions (onChainBuyPrice, onChainSellReturn, onChainPriceAt)
 *     work in lamports and match the Rust implementation exactly.
 */

import type { CurveParams } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// On-chain parameter type (lamports scale — mirrors CurveParams in Rust)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * On-chain curve parameters as stored in the TokenConfig account.
 * All prices in lamports, rates scaled by 1_000_000.
 */
export interface OnChainCurveParams {
  /** Linear: base price in lamports | Exp: initial price | Sigmoid: P_max */
  paramA: bigint;
  /** Linear: slope (lamports per 1M tokens) | Exp: growth rate ×1e6 | Sigmoid: steepness k ×1e6 */
  paramB: bigint;
  /** Sigmoid: midpoint s0 in token units; unused for linear/exponential */
  paramC: bigint;
}

export type OnChainCurveType = 'linear' | 'exponential' | 'sigmoid';

const SCALE = 1_000_000n;
const SOL = 1_000_000_000n; // lamports per SOL

// ─────────────────────────────────────────────────────────────────────────────
// LINEAR
// ─────────────────────────────────────────────────────────────────────────────

function linearPriceAt(a: bigint, b: bigint, supply: bigint): bigint {
  return a + b * supply / SCALE;
}

function linearBuyCost(a: bigint, b: bigint, currentSupply: bigint, amount: bigint): bigint {
  if (amount === 0n) return 0n;
  const term1 = amount * a;
  const term2 = b * currentSupply * amount / SCALE;
  const term3 = b * amount * (amount - 1n) / SCALE / 2n;
  return term1 + term2 + term3;
}

function linearSellReturn(a: bigint, b: bigint, currentSupply: bigint, amount: bigint): bigint {
  const gross = linearBuyCost(a, b, currentSupply - amount, amount);
  return gross * 95n / 100n;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPONENTIAL (3-term Taylor + Simpson's rule)
// ─────────────────────────────────────────────────────────────────────────────

function expPriceAt(a: bigint, r: bigint, supply: bigint): bigint {
  const rs = r * supply / SCALE;
  const term1 = a;
  const term2 = a * rs / SCALE;
  const term3 = a * rs * rs / SCALE / SCALE / 2n;
  return term1 + term2 + term3;
}

function expBuyCost(a: bigint, r: bigint, currentSupply: bigint, amount: bigint): bigint {
  if (amount === 0n) return 0n;
  const sMid = currentSupply + amount / 2n;
  const pStart = expPriceAt(a, r, currentSupply);
  const pMid = expPriceAt(a, r, sMid);
  const pEnd = expPriceAt(a, r, currentSupply + amount);
  // Simpson's rule: (n/6) * (p0 + 4*p_mid + p1)
  return amount * (pStart + 4n * pMid + pEnd) / 6n;
}

function expSellReturn(a: bigint, r: bigint, currentSupply: bigint, amount: bigint): bigint {
  const gross = expBuyCost(a, r, currentSupply - amount, amount);
  return gross * 95n / 100n;
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGMOID (7-segment piecewise linear)
// ─────────────────────────────────────────────────────────────────────────────

const BP_NUM = [0n, 100n, 250n, 450n, 550n, 750n, 900n, 1000n];
const BP_DEN = 1000n;

// Sigmoid table: values × 10_000 at x = -6..6
const TABLE_X = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
const TABLE_V = [25n, 67n, 180n, 474n, 1192n, 2689n, 5000n, 7311n, 8808n, 9526n, 9820n, 9933n, 9975n];
const TABLE_DENOM = 10_000n;

function sigmoidPrice(pMax: bigint, kScaled: bigint, s0: bigint, supply: bigint): bigint {
  const p = pMax;
  // x = k * (supply - s0) / SCALE  (dimensionless)
  const xNum = kScaled * (supply - s0); // signed via JS BigInt
  const xDen = SCALE;

  // Clamp to [-6, 6]
  const clamp = 6n * xDen;
  const xClamped = xNum < -clamp ? -clamp : xNum > clamp ? clamp : xNum;

  const xInt = xClamped / xDen; // truncates toward zero
  const xFrac = xClamped < 0n ? -(xClamped % xDen) : xClamped % xDen;

  const idx = Number(xInt + 6n);
  const safeIdx = Math.max(0, Math.min(11, idx));
  const vLo = TABLE_V[safeIdx];
  const vHi = TABLE_V[Math.min(12, safeIdx + 1)];

  let v: bigint;
  if (xInt >= 0n) {
    v = vLo + (vHi - vLo) * xFrac / xDen;
  } else {
    v = vHi - (vHi - vLo) * xFrac / xDen;
  }

  return p * v / TABLE_DENOM;
}

interface SigSegment {
  start: bigint;
  end: bigint;
  pStart: bigint;
  pEnd: bigint;
}

function buildSigmoidSegments(pMax: bigint, kScaled: bigint, s0: bigint, supplyCap: bigint): SigSegment[] {
  const breakpoints = BP_NUM.map(bp => supplyCap * bp / BP_DEN);
  const segs: SigSegment[] = [];
  for (let i = 0; i < 7; i++) {
    segs.push({
      start: breakpoints[i],
      end: breakpoints[i + 1],
      pStart: sigmoidPrice(pMax, kScaled, s0, breakpoints[i]),
      pEnd: sigmoidPrice(pMax, kScaled, s0, breakpoints[i + 1]),
    });
  }
  return segs;
}

function sigmoidPriceAt(segs: SigSegment[], supply: bigint, pMax: bigint): bigint {
  for (const seg of segs) {
    if (supply >= seg.start && supply < seg.end) {
      const span = seg.end - seg.start;
      if (span === 0n) return seg.pStart;
      const delta = supply - seg.start;
      return seg.pStart + (seg.pEnd - seg.pStart) * delta / span;
    }
  }
  return pMax;
}

function sigmoidBuyCost(
  pMax: bigint,
  kScaled: bigint,
  s0: bigint,
  supplyCap: bigint,
  currentSupply: bigint,
  amount: bigint,
): bigint {
  if (amount === 0n) return 0n;
  const segs = buildSigmoidSegments(pMax, kScaled, s0, supplyCap);
  let total = 0n;
  let remaining = amount;
  let pos = currentSupply;

  for (const seg of segs) {
    if (remaining === 0n) break;
    if (pos >= seg.end) continue;
    if (pos < seg.start) pos = seg.start;

    const available = seg.end - pos;
    const toBuy = remaining < available ? remaining : available;

    const p0 = sigmoidPriceAt(segs, pos, pMax);
    const p1 = sigmoidPriceAt(segs, pos + toBuy, pMax);
    total += toBuy * (p0 + p1) / 2n;

    pos += toBuy;
    remaining -= toBuy;
  }
  return total;
}

function sigmoidSellReturn(
  pMax: bigint,
  kScaled: bigint,
  s0: bigint,
  supplyCap: bigint,
  currentSupply: bigint,
  amount: bigint,
): bigint {
  const gross = sigmoidBuyCost(pMax, kScaled, s0, supplyCap, currentSupply - amount, amount);
  return gross * 95n / 100n;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public on-chain API (lamports, BigInt)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Spot price in lamports at a given supply level.
 * Mirrors `calc_price_at` in curve/mod.rs.
 */
export function onChainPriceAt(
  curveType: OnChainCurveType,
  params: OnChainCurveParams,
  supply: bigint,
  supplyCap: bigint,
): bigint {
  switch (curveType) {
    case 'linear':
      return linearPriceAt(params.paramA, params.paramB, supply);
    case 'exponential':
      return expPriceAt(params.paramA, params.paramB, supply);
    case 'sigmoid':
      return sigmoidPrice(params.paramA, params.paramB, params.paramC, supply);
  }
}

/**
 * Total lamport cost to buy `amount` tokens at `currentSupply`.
 * Mirrors `calc_buy_cost` in curve/mod.rs.
 */
export function onChainBuyCost(
  curveType: OnChainCurveType,
  params: OnChainCurveParams,
  supplyCap: bigint,
  currentSupply: bigint,
  amount: bigint,
): bigint {
  switch (curveType) {
    case 'linear':
      return linearBuyCost(params.paramA, params.paramB, currentSupply, amount);
    case 'exponential':
      return expBuyCost(params.paramA, params.paramB, currentSupply, amount);
    case 'sigmoid':
      return sigmoidBuyCost(params.paramA, params.paramB, params.paramC, supplyCap, currentSupply, amount);
  }
}

/**
 * Lamports returned for selling `amount` tokens (95% of equivalent buy cost).
 * Mirrors `calc_sell_return` in curve/mod.rs.
 */
export function onChainSellReturn(
  curveType: OnChainCurveType,
  params: OnChainCurveParams,
  supplyCap: bigint,
  currentSupply: bigint,
  amount: bigint,
): bigint {
  switch (curveType) {
    case 'linear':
      return linearSellReturn(params.paramA, params.paramB, currentSupply, amount);
    case 'exponential':
      return expSellReturn(params.paramA, params.paramB, currentSupply, amount);
    case 'sigmoid':
      return sigmoidSellReturn(params.paramA, params.paramB, params.paramC, supplyCap, currentSupply, amount);
  }
}

/**
 * Generate N price data points across the full supply range (for chart rendering).
 */
export function generateOnChainCurveData(
  curveType: OnChainCurveType,
  params: OnChainCurveParams,
  supplyCap: bigint,
  points = 100,
): Array<{ supply: number; priceSol: number }> {
  const result: Array<{ supply: number; priceSol: number }> = [];
  for (let i = 0; i <= points; i++) {
    const supply = supplyCap * BigInt(i) / BigInt(points);
    const priceLamports = onChainPriceAt(curveType, params, supply, supplyCap);
    result.push({
      supply: Number(supply),
      priceSol: Number(priceLamports) / Number(SOL),
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI-friendly wrappers (SOL values — preserve existing component API)
// These keep the signatures Pixel's components rely on.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert the frontend CurveParams (SOL scale, loose fields) to on-chain params.
 * Uses sensible defaults from the Create Wizard defaults.
 */
function toOnChain(params: CurveParams, supplyCap: number): OnChainCurveParams {
  switch (params.type) {
    case 'linear':
      return {
        // a = base price in lamports (default 0.0001 SOL = 100_000 lamports)
        paramA: BigInt(Math.round((params.a ?? 0.0001) * 1e9)),
        // b = slope: convert SOL-per-token to lamports, then scale by 1e6
        // e.g. 0.000005 SOL/token → 5000 lamports/token → stored as 5000 * 1e6 / 1 (norm to 1M tokens)
        paramB: BigInt(Math.round((params.b ?? 0.000005) * 1e9 * 1e6 / 1_000_000)),
        paramC: 0n,
      };
    case 'exponential':
      return {
        paramA: BigInt(Math.round((params.a ?? 0.00001) * 1e9)),
        // r = growth rate per token: e.g. 0.0008 → scaled by 1e6 → 800
        paramB: BigInt(Math.round((params.r ?? 0.0008) * 1e6)),
        paramC: 0n,
      };
    case 'sigmoid':
      return {
        // P_max in lamports
        paramA: BigInt(Math.round((params.maxPrice ?? 0.1) * 1e9)),
        // k scaled by 1e6: e.g. 0.002 → 2000
        paramB: BigInt(Math.round((params.k ?? 0.002) * 1e6)),
        // s0 in token units
        paramC: BigInt(Math.round(params.s0 ?? supplyCap * 0.5)),
      };
  }
}

/**
 * Calculate the spot price in SOL at a given supply level.
 * Preserves existing signature used by Pixel's components.
 */
export function calculatePrice(supply: number, params: CurveParams, supplyCap = 10_000): number {
  const onChain = toOnChain(params, supplyCap);
  const lamports = onChainPriceAt(params.type as OnChainCurveType, onChain, BigInt(Math.round(supply)), BigInt(supplyCap));
  return Number(lamports) / 1e9;
}

/**
 * Estimate tokens received for a given SOL input amount.
 * Uses binary search over the on-chain buy cost function.
 * Preserves existing signature used by Pixel's components.
 */
export function calculateBuyPrice(
  solIn: number,
  currentSupply: number,
  params: CurveParams,
): { tokensOut: number; avgPrice: number; priceImpact: number } {
  if (solIn <= 0) return { tokensOut: 0, avgPrice: 0, priceImpact: 0 };

  const supplyCap = 10_000_000; // default 10M tokens for preview
  const onChain = toOnChain(params, supplyCap);
  const curveType = params.type as OnChainCurveType;
  const solLamports = BigInt(Math.round(solIn * 1e9));
  const s = BigInt(Math.round(currentSupply));
  const cap = BigInt(supplyCap);

  // Binary search: find max tokens we can buy with solLamports
  let lo = 0n;
  let hi = cap - s;
  if (hi <= 0n) return { tokensOut: 0, avgPrice: 0, priceImpact: 0 };

  // Clamp hi so we don't exceed supply cap
  let tokensOut = 0n;
  for (let iter = 0; iter < 64; iter++) {
    const mid = (lo + hi) / 2n;
    if (mid === 0n) break;
    const cost = onChainBuyCost(curveType, onChain, cap, s, mid);
    if (cost <= solLamports) {
      tokensOut = mid;
      lo = mid + 1n;
    } else {
      hi = mid - 1n;
    }
  }

  const startPrice = calculatePrice(currentSupply, params);
  const endPrice = calculatePrice(currentSupply + Number(tokensOut), params);
  const avgPrice = solIn / Number(tokensOut);
  const priceImpact = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;

  return {
    tokensOut: Number(tokensOut),
    avgPrice,
    priceImpact: Math.max(0, priceImpact),
  };
}

/**
 * Estimate SOL received for selling a given number of tokens.
 * Preserves existing signature used by Pixel's components.
 */
export function calculateSellReturn(
  tokensIn: number,
  currentSupply: number,
  params: CurveParams,
): { solOut: number; avgPrice: number; priceImpact: number } {
  if (tokensIn <= 0 || tokensIn > currentSupply) {
    return { solOut: 0, avgPrice: 0, priceImpact: 0 };
  }

  const supplyCap = 10_000_000;
  const onChain = toOnChain(params, supplyCap);
  const curveType = params.type as OnChainCurveType;
  const s = BigInt(Math.round(currentSupply));
  const n = BigInt(Math.round(tokensIn));
  const cap = BigInt(supplyCap);

  const returnLamports = onChainSellReturn(curveType, onChain, cap, s, n);
  const solOut = Number(returnLamports) / 1e9;
  const startPrice = calculatePrice(currentSupply, params);
  const endPrice = calculatePrice(currentSupply - tokensIn, params);
  const avgPrice = solOut / tokensIn;
  const priceImpact = startPrice > 0 ? ((startPrice - endPrice) / startPrice) * 100 : 0;

  return {
    solOut: parseFloat(solOut.toFixed(6)),
    avgPrice,
    priceImpact: Math.max(0, priceImpact),
  };
}
