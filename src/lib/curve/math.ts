import type { CurveParams } from '@/lib/types';

export interface OnChainCurveParams {
  paramA: bigint; // pMax in wei
  paramB: bigint; // k scaled by 1e6
  paramC: bigint; // midpoint in token units
  pMin?: bigint; // pMin in wei
}

export type OnChainCurveType = 'sigmoid';

const PAYMENT_UNIT = 1_000_000_000_000_000_000n;
const SCALE = 1_000_000n;
const TABLE_X = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
const TABLE_V = [25n, 67n, 180n, 474n, 1192n, 2689n, 5000n, 7311n, 8808n, 9526n, 9820n, 9933n, 9975n];
const TABLE_DENOM = 10_000n;

function sigmoidRatio(kScaled: bigint, midpoint: bigint, supply: bigint): bigint {
  const xNum = kScaled * (supply - midpoint);
  const xDen = SCALE;
  const clamp = 6n * xDen;
  const xClamped = xNum < -clamp ? -clamp : xNum > clamp ? clamp : xNum;
  const xInt = xClamped / xDen;
  const xFrac = xClamped < 0n ? -(xClamped % xDen) : xClamped % xDen;
  const idx = Number(xInt + 6n);
  const safeIdx = Math.max(0, Math.min(11, idx));
  const vLo = TABLE_V[safeIdx];
  const vHi = TABLE_V[Math.min(12, safeIdx + 1)];

  if (xInt >= 0n) {
    return vLo + ((vHi - vLo) * xFrac) / xDen;
  }
  return vHi - ((vHi - vLo) * xFrac) / xDen;
}

export function onChainPriceAt(
  _curveType: OnChainCurveType,
  params: OnChainCurveParams,
  supply: bigint,
  _supplyCap: bigint,
): bigint {
  const pMin = params.pMin ?? 0n;
  const ratio = sigmoidRatio(params.paramB, params.paramC, supply);
  return pMin + ((params.paramA - pMin) * ratio) / TABLE_DENOM;
}

export function onChainBuyCost(
  curveType: OnChainCurveType,
  params: OnChainCurveParams,
  supplyCap: bigint,
  currentSupply: bigint,
  amount: bigint,
): bigint {
  if (amount === 0n) return 0n;
  const startPrice = onChainPriceAt(curveType, params, currentSupply, supplyCap);
  const endPrice = onChainPriceAt(curveType, params, currentSupply + amount, supplyCap);
  return (amount * (startPrice + endPrice)) / 2n;
}

export function onChainSellReturn(
  curveType: OnChainCurveType,
  params: OnChainCurveParams,
  supplyCap: bigint,
  currentSupply: bigint,
  amount: bigint,
): bigint {
  const gross = onChainBuyCost(curveType, params, supplyCap, currentSupply - amount, amount);
  return (gross * 95n) / 100n;
}

export function generateOnChainCurveData(
  curveType: OnChainCurveType,
  params: OnChainCurveParams,
  supplyCap: bigint,
  points = 100,
): Array<{ supply: number; priceSol: number }> {
  const result: Array<{ supply: number; priceSol: number }> = [];
  for (let i = 0; i <= points; i++) {
    const supply = (supplyCap * BigInt(i)) / BigInt(points);
    const priceWei = onChainPriceAt(curveType, params, supply, supplyCap);
    result.push({ supply: Number(supply), priceSol: Number(priceWei) / Number(PAYMENT_UNIT) });
  }
  return result;
}

function toOnChain(params: CurveParams, supplyCap: number): OnChainCurveParams {
  return {
    pMin: BigInt(Math.round((params.pMin ?? params.a ?? 0.00001) * 1e18)),
    paramA: BigInt(Math.round((params.pMax ?? params.maxPrice ?? 0.1) * 1e18)),
    paramB: BigInt(Math.round((params.k ?? 0.002) * 1e6)),
    paramC: BigInt(Math.round(params.midpoint ?? params.s0 ?? supplyCap * 0.5)),
  };
}

export function calculatePrice(supply: number, params: CurveParams, supplyCap = 10_000): number {
  const onChain = toOnChain(params, supplyCap);
  const wei = onChainPriceAt('sigmoid', onChain, BigInt(Math.round(supply)), BigInt(supplyCap));
  return Number(wei) / 1e18;
}

export function calculateBuyPrice(
  paymentIn: number,
  currentSupply: number,
  params: CurveParams,
): { tokensOut: number; avgPrice: number; priceImpact: number } {
  if (paymentIn <= 0) return { tokensOut: 0, avgPrice: 0, priceImpact: 0 };

  const supplyCap = 10_000_000;
  const onChain = toOnChain(params, supplyCap);
  const budgetWei = BigInt(Math.round(paymentIn * 1e18));
  const current = BigInt(Math.round(currentSupply));
  const cap = BigInt(supplyCap);

  let lo = 0n;
  let hi = cap - current;
  let tokensOut = 0n;

  for (let iter = 0; iter < 64; iter++) {
    const mid = (lo + hi) / 2n;
    if (mid === 0n) break;
    const cost = onChainBuyCost('sigmoid', onChain, cap, current, mid);
    if (cost <= budgetWei) {
      tokensOut = mid;
      lo = mid + 1n;
    } else {
      hi = mid - 1n;
    }
  }

  const startPrice = calculatePrice(currentSupply, params);
  const endPrice = calculatePrice(currentSupply + Number(tokensOut), params);
  const avgPrice = tokensOut > 0n ? paymentIn / Number(tokensOut) : 0;
  const priceImpact = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;

  return { tokensOut: Number(tokensOut), avgPrice, priceImpact: Math.max(0, priceImpact) };
}

export function calculateSellReturn(
  tokensIn: number,
  currentSupply: number,
  params: CurveParams,
): { solOut: number; avgPrice: number; priceImpact: number } {
  if (tokensIn <= 0 || tokensIn > currentSupply) return { solOut: 0, avgPrice: 0, priceImpact: 0 };

  const supplyCap = 10_000_000;
  const onChain = toOnChain(params, supplyCap);
  const current = BigInt(Math.round(currentSupply));
  const amount = BigInt(Math.round(tokensIn));
  const returnWei = onChainSellReturn('sigmoid', onChain, BigInt(supplyCap), current, amount);
  const paymentOut = Number(returnWei) / 1e18;
  const startPrice = calculatePrice(currentSupply, params);
  const endPrice = calculatePrice(currentSupply - tokensIn, params);
  const avgPrice = paymentOut / tokensIn;
  const priceImpact = startPrice > 0 ? ((startPrice - endPrice) / startPrice) * 100 : 0;

  return { solOut: parseFloat(paymentOut.toFixed(6)), avgPrice, priceImpact: Math.max(0, priceImpact) };
}
