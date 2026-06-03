"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheSet = cacheSet;
exports.cacheGet = cacheGet;
exports.cacheDel = cacheDel;
const ioredis_1 = __importDefault(require("ioredis"));
// Redis is optional. If REDIS_URL is not set, caching is skipped silently.
// Set REDIS_URL (e.g. from Upstash) in the Render dashboard to enable caching.
let _redis = null;
let _attempted = false;
function getRedis() {
    if (_attempted)
        return _redis;
    _attempted = true;
    const url = process.env.REDIS_URL;
    if (!url) {
        console.warn('[Redis] REDIS_URL not set — caching disabled');
        return null;
    }
    _redis = new ioredis_1.default(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        connectTimeout: 5_000,
        enableOfflineQueue: false,
    });
    _redis.on('error', (err) => {
        // Log once, then suppress repeated errors
        console.error('[Redis] Connection error:', err.message);
    });
    return _redis;
}
/**
 * Cache a value with TTL in seconds. No-op if Redis is unavailable.
 */
async function cacheSet(key, value, ttlSeconds) {
    const r = getRedis();
    if (!r)
        return;
    try {
        await r.setex(key, ttlSeconds, JSON.stringify(value));
    }
    catch {
        // Non-fatal
    }
}
/**
 * Retrieve a cached value. Returns null on miss, error, or if Redis is unavailable.
 */
async function cacheGet(key) {
    const r = getRedis();
    if (!r)
        return null;
    try {
        const raw = await r.get(key);
        if (!raw)
            return null;
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
async function cacheDel(key) {
    const r = getRedis();
    if (!r)
        return;
    try {
        await r.del(key);
    }
    catch {
        // Non-fatal
    }
}
//# sourceMappingURL=redis.js.map