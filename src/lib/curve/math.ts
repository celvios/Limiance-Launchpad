/* ── Curve Math (Stub) ──
 * These functions will be provided by Forge (Claude) when the
 * Anchor program is finalized. For now, we use simplified versions
 * that approximate the bonding curve behavior for UI display.
 *
 * SWAP INSTRUCTIONS:
 * Replace this entire file with Forge's implementation.
 * The function signatures must stay the same.
 */

import type { CurveParams } from '@/lib/types';

/**
 * Calculate the price of a token at a given supply level.
 */
export function calculatePrice(supply: number, params: CurveParams): number {
  switch (params.type) {
    case 'linear':
      return (params.a ?? 0.0001) + (params.b ?? 0.000005) * supply;

    case 'exponential':
      return (params.a ?? 0.00001) * Math.exp((params.r ?? 0.0008) * supply);

    case 'sigmoid': {
      const maxPrice = params.maxPrice ?? 0.1;
      const k = params.k ?? 0.002;
      const s0 = params.s0 ?? 5000;
      return maxPrice / (1 + Math.exp(-k * (supply - s0)));
    }

    default:
      return 0.0001;
  }
}

/**
 * Estimate the number of tokens received for a given SOL input (buy).
 * Uses numerical integration (simple Riemann sum) over the bonding curve.
 */
export function calculateBuyPrice(
  solIn: number,
  currentSupply: number,
  params: CurveParams
): { tokensOut: number; avgPrice: number; priceImpact: number } {
  if (solIn <= 0) return { tokensOut: 0, avgPrice: 0, priceImpact: 0 };

  const steps = 100;
  let solRemaining = solIn;
  let tokensBought = 0;
  const startPrice = calculatePrice(currentSupply, params);

  for (let i = 0; i < steps && solRemaining > 0; i++) {
    const supply = currentSupply + tokensBought;
    const price = calculatePrice(supply, params);
    const stepTokens = solRemaining / price / (steps - i);
    const stepCost = stepTokens * price;

    if (stepCost <= solRemaining) {
      tokensBought += stepTokens;
      solRemaining -= stepCost;
    } else {
      tokensBought += solRemaining / price;
      solRemaining = 0;
    }
  }

  const endPrice = calculatePrice(currentSupply + tokensBought, params);
  const avgPrice = solIn / tokensBought;
  const priceImpact = ((endPrice - startPrice) / startPrice) * 100;

  return {
    tokensOut: Math.floor(tokensBought),
    avgPrice,
    priceImpact: Math.max(0, priceImpact),
  };
}

/**
 * Estimate the SOL received for selling a given number of tokens.
 */
export function calculateSellReturn(
  tokensIn: number,
  currentSupply: number,
  params: CurveParams
): { solOut: number; avgPrice: number; priceImpact: number } {
  if (tokensIn <= 0 || tokensIn > currentSupply) {
    return { solOut: 0, avgPrice: 0, priceImpact: 0 };
  }

  const steps = 100;
  let tokensRemaining = tokensIn;
  let solReceived = 0;
  const startPrice = calculatePrice(currentSupply, params);
  const stepSize = tokensIn / steps;

  for (let i = 0; i < steps && tokensRemaining > 0; i++) {
    const supply = currentSupply - (tokensIn - tokensRemaining);
    const price = calculatePrice(supply, params);
    const step = Math.min(stepSize, tokensRemaining);
    solReceived += step * price;
    tokensRemaining -= step;
  }

  const endPrice = calculatePrice(currentSupply - tokensIn, params);
  const avgPrice = solReceived / tokensIn;
  const priceImpact = ((startPrice - endPrice) / startPrice) * 100;

  return {
    solOut: parseFloat(solReceived.toFixed(6)),
    avgPrice,
    priceImpact: Math.max(0, priceImpact),
  };
}
