/**
 * Cache a value with TTL in seconds. No-op if Redis is unavailable.
 */
export declare function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void>;
/**
 * Retrieve a cached value. Returns null on miss, error, or if Redis is unavailable.
 */
export declare function cacheGet<T>(key: string): Promise<T | null>;
export declare function cacheDel(key: string): Promise<void>;
//# sourceMappingURL=redis.d.ts.map