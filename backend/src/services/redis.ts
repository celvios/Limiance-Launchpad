import Redis from 'ioredis';

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
    _redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });
  }
  return _redis;
}

/**
 * Cache a value with TTL in seconds.
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await getRedis().setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Non-fatal: cache miss is acceptable
  }
}

/**
 * Retrieve a cached value. Returns null on miss or error.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await getRedis().get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await getRedis().del(key);
  } catch {
    // Non-fatal
  }
}
