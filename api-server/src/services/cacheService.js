// api-server/src/services/cacheService.js
import redis from 'redis';
import { logger } from '../config/logger.js';
import { CACHE, SECURITY_CONFIG } from '../config/constants.js';

// Create Redis client with TLS in production
const client = redis.createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: process.env.NODE_ENV === 'production',
    rejectUnauthorized: false
  }
});

// Connection event handlers
client
  .on('connect', () => logger.info('Redis: Connecting...'))
  .on('ready', () => logger.info('Redis: Ready'))
  .on('error', (err) => logger.error('Redis Error:', err))
  .on('reconnecting', () => logger.warn('Redis: Reconnecting'))
  .on('end', () => logger.warn('Redis: Connection closed'));

// Cache operations with enhanced features
export const CacheService = {
  /**
   * Cache middleware with stale-while-revalidate
   * @param {string} key - Cache key
   * @param {function} getData - Data fetching function
   * @param {object} options - Cache options
   * @returns {Promise<any>} Cached or fresh data
   */
  async getOrSet(key, getData, options = {}) {
    try {
      const { ttl = CACHE.DEFAULT_TTL, swr = 60 } = options;
      const [cachedData, cacheTime] = await Promise.all([
        client.get(key),
        client.ttl(key)
      ]);

      // Serve stale data while revalidating if within SWR window
      if (cachedData) {
        if (cacheTime > -ttl && cacheTime < 0) {
          setImmediate(async () => {
            const fresh = await getData();
            await this.set(key, fresh, ttl);
          });
        }
        return this._deserialize(cachedData);
      }

      // Cache miss - fetch and set
      const freshData = await getData();
      await this.set(key, freshData, ttl);
      return freshData;
    } catch (error) {
      logger.error('Cache failure:', error);
      return getData(); // Fallback to direct fetch
    }
  },

  async set(key, value, ttl = CACHE.DEFAULT_TTL) {
    const serialized = this._serialize(value);
    await client.setEx(key, ttl, serialized);
    return value;
  },

  async get(key) {
    const data = await client.get(key);
    return this._deserialize(data);
  },

  async invalidate(pattern) {
    const keys = await client.keys(pattern);
    if (keys.length) await client.del(keys);
    return keys.length;
  },

  async memoize(fn, keyFn, ttl = 300) {
    return async (...args) => {
      const cacheKey = keyFn(...args);
      return this.getOrSet(cacheKey, () => fn(...args), { ttl });
    };
  },

  _serialize(data) {
    return JSON.stringify({
      _cachedAt: Date.now(),
      data,
      signature: this._createSignature(data)
    });
  },

  _deserialize(string) {
    if (!string) return null;
    const { data, _cachedAt, signature } = JSON.parse(string);
    
    if (!this._validateSignature(data, signature)) {
      logger.warn('Cache tampering detected', { key });
      return null;
    }

    return {
      data,
      metadata: { 
        cachedAt: new Date(_cachedAt),
        ageSeconds: (Date.now() - _cachedAt) / 1000
      }
    };
  },

  _createSignature(data) {
    return createHash('sha256')
      .update(JSON.stringify(data) + SECURITY_CONFIG.CACHE_SECRET)
      .digest('hex');
  },

  _validateSignature(data, signature) {
    return this._createSignature(data) === signature;
  },

  async close() {
    await client.quit();
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  await CacheService.close();
  process.exit(0);
});