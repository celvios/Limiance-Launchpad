import Redis from 'ioredis';

// Redis is optional. If REDIS_URL is not set, caching is skipped silently.
// Set REDIS_URL (e.g. from Upstash) in the Render dashboard to enable caching.
let _redis: Redis | null = null;
let _attempted = false;

function getRedis(): Redis | null {
  if (_attempted) return _redis;
  _attempted = true;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('[Redis] REDIS_URL not set — caching disabled');
    return null;
  }

  _redis = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    connectTimeout: 5_000,
    enableOfflineQueue: false,
  });

  _redis.on('error', (err: Error) => {
    // Log once, then suppress repeated errors
    console.error('[Redis] Connection error:', err.message);
  });

  return _redis;
}

/**
 * Cache a value with TTL in seconds. No-op if Redis is unavailable.
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Non-fatal
  }
}

/**
 * Retrieve a cached value. Returns null on miss, error, or if Redis is unavailable.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const raw = await r.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheDel(key: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.del(key);
  } catch {
    // Non-fatal
  }
}
