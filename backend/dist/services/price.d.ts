/**
 * Compute the current spot price in wei for a given token.
 */
export declare function computeSpotPrice(curveType: string, paramA: bigint, paramB: bigint, paramC: bigint, currentSupply: bigint, supplyCap: bigint): bigint;
/**
 * Fetch price 24h ago from trade history.
 * Returns 0n if no trade found.
 */
export declare function getPrice24hAgo(mint: string): Promise<bigint>;
/**
 * Calculate 24h price change percentage.
 */
export declare function calcPriceChange24h(currentPrice: bigint, price24h: bigint): number;
/**
 * Calculate market cap in wei: price × currentSupply.
 */
export declare function calcMarketCap(pricePerToken: bigint, currentSupply: bigint): bigint;
/**
 * Get last 7 distinct daily prices for sparkline.
 */
export declare function getSparkline(mint: string): Promise<number[]>;
/**
 * Compute 24h trading volume in wei.
 */
export declare function getVolume24h(mint: string): Promise<bigint>;
//# sourceMappingURL=price.d.ts.map