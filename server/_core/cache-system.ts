/**
 * Advanced Caching System
 * 
 * Multi-layer caching with Redis:
 * - In-memory cache (L1) for hot data
 * - Redis cache (L2) for distributed caching
 * - Automatic cache warming
 * - Cache invalidation strategies
 * - TTL management
 * - Metrics and monitoring
 * 
 * @module CacheSystem
 * @author Manus AI
 * @version 2.0.0
 */

import Redis from 'ioredis';
import { LRUCache } from 'lru-cache';

export interface CacheOptions {
  ttl?: number;           // Time to live in seconds
  tags?: string[];        // Tags for group invalidation
  compress?: boolean;     // Compress large values
  namespace?: string;     // Cache namespace
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  l1Hits: number;
  l2Hits: number;
}

export class CacheSystem {
  private static instance: CacheSystem;
  private redis: Redis | null = null;
  private l1Cache: LRUCache<string, any>;
  private metrics: CacheMetrics;
  private readonly DEFAULT_TTL = 3600; // 1 hour
  private readonly L1_MAX_SIZE = 1000;  // Max items in L1 cache
  private readonly L1_MAX_AGE = 300000; // 5 minutes

  private constructor(redis?: Redis) {
    if (redis) this.redis = redis;

    // Initialize L1 cache (in-memory)
    this.l1Cache = new LRUCache<string, any>({
      max: this.L1_MAX_SIZE,
      ttl: this.L1_MAX_AGE,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });

    // Initialize metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      l1Hits: 0,
      l2Hits: 0,
    };

    // Start metrics calculation
    this.startMetricsCalculation();
  }

  /**
   * Get singleton instance
   */
  static getInstance(redis?: Redis): CacheSystem {
    if (!this.instance) {
      this.instance = new CacheSystem(redis);
    } else if (redis && !this.instance.redis) {
      this.instance.redis = redis;
    }
    return this.instance;
  }

  /**
   * Get value from cache
   * Checks L1 first, then L2 (Redis)
   */
  async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const fullKey = this.buildKey(key, options.namespace);

    // Check L1 cache first
    const l1Value = this.l1Cache.get(fullKey);
    if (l1Value !== undefined) {
      this.metrics.hits++;
      this.metrics.l1Hits++;
      return l1Value as T;
    }

    // Check L2 cache (Redis)
    if (!this.redis) {
      this.metrics.misses++;
      return null;
    }

    try {
      const l2Value = await this.redis.get(fullKey);

      if (l2Value !== null) {
        this.metrics.hits++;
        this.metrics.l2Hits++;

        // Parse value
        const parsed = this.deserialize<T>(l2Value);

        // Store in L1 for faster access
        this.l1Cache.set(fullKey, parsed);

        return parsed;
      }

      this.metrics.misses++;
      return null;

    } catch (error: any) {
      console.error('[Cache] Error getting value:', error.message);
      this.metrics.misses++;
      return null;
    }
  }

  /**
   * Set value in cache
   * Stores in both L1 and L2
   */
  async set<T = any>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const fullKey = this.buildKey(key, options.namespace);
    const ttl = options.ttl || this.DEFAULT_TTL;

    try {
      // Serialize value
      const serialized = this.serialize(value);

      // Store in L1
      this.l1Cache.set(fullKey, value);

      // Store in L2 (Redis)
      if (this.redis) {
        await this.redis.setex(fullKey, ttl, serialized);
      }

      // Store tags for group invalidation
      if (options.tags && options.tags.length > 0) {
        await this.storeTags(fullKey, options.tags, ttl);
      }

      this.metrics.sets++;

    } catch (error: any) {
      console.error('[Cache] Error setting value:', error.message);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.buildKey(key, options.namespace);

    try {
      // Delete from L1
      this.l1Cache.delete(fullKey);

      // Delete from L2
      if (this.redis) {
        await this.redis.del(fullKey);
      }

      this.metrics.deletes++;

    } catch (error: any) {
      console.error('[Cache] Error deleting value:', error.message);
    }
  }

  /**
   * Check if key exists
   */
  async has(key: string, options: CacheOptions = {}): Promise<boolean> {
    const fullKey = this.buildKey(key, options.namespace);

    // Check L1
    if (this.l1Cache.has(fullKey)) {
      return true;
    }

    // Check L2
    if (!this.redis) return false;
    try {
      const exists = await this.redis.exists(fullKey);
      return exists === 1;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get multiple values
   */
  async mget<T = any>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    const fullKeys = keys.map(k => this.buildKey(k, options.namespace));
    const results: (T | null)[] = new Array(keys.length).fill(null);
    const l2Keys: number[] = [];
    const l2FullKeys: string[] = [];

    // Check L1 first
    fullKeys.forEach((fullKey, index) => {
      const l1Value = this.l1Cache.get(fullKey);
      if (l1Value !== undefined) {
        results[index] = l1Value as T;
        this.metrics.l1Hits++;
      } else {
        l2Keys.push(index);
        l2FullKeys.push(fullKey);
      }
    });

    // Check L2 for remaining keys
    if (l2FullKeys.length > 0 && this.redis) {
      try {
        const l2Values = await this.redis.mget(...l2FullKeys);

        l2Values.forEach((value, i) => {
          const originalIndex = l2Keys[i];

          if (value !== null) {
            const parsed = this.deserialize<T>(value);
            results[originalIndex] = parsed;

            // Store in L1
            this.l1Cache.set(l2FullKeys[i], parsed);
            this.metrics.l2Hits++;
          } else {
            this.metrics.misses++;
          }
        });

      } catch (error: any) {
        console.error('[Cache] Error getting multiple values:', error.message);
      }
    }

    return results;
  }

  /**
   * Set multiple values
   */
  async mset<T = any>(
    entries: Array<{ key: string; value: T }>,
    options: CacheOptions = {}
  ): Promise<void> {
    const ttl = options.ttl || this.DEFAULT_TTL;

    try {
      const pipeline = this.redis.pipeline();

      for (const { key, value } of entries) {
        const fullKey = this.buildKey(key, options.namespace);
        const serialized = this.serialize(value);

        // Store in L1
        this.l1Cache.set(fullKey, value);

        // Store in L2
        if (this.redis) {
          pipeline.setex(fullKey, ttl, serialized);
        }
      }

      if (this.redis) {
        await pipeline.exec();
      }
      this.metrics.sets += entries.length;

    } catch (error: any) {
      console.error('[Cache] Error setting multiple values:', error.message);
    }
  }

  /**
   * Invalidate by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let deleted = 0;

    if (!this.redis) return 0;

    try {
      for (const tag of tags) {
        const tagKey = `cache:tag:${tag}`;
        const keys = await this.redis.smembers(tagKey);

        if (keys.length > 0) {
          // Delete from L1
          keys.forEach(key => this.l1Cache.delete(key));

          // Delete from L2
          await this.redis.del(...keys);
          deleted += keys.length;

          // Delete tag set
          await this.redis.del(tagKey);
        }
      }

      this.metrics.deletes += deleted;

    } catch (error: any) {
      console.error('[Cache] Error invalidating by tags:', error.message);
    }

    return deleted;
  }

  /**
   * Clear all cache
   */
  async clear(namespace?: string): Promise<void> {
    try {
      // Clear L1
      this.l1Cache.clear();

      // Clear L2
      if (this.redis) {
        if (namespace) {
          const pattern = `cache:${namespace}:*`;
          const keys = await this.redis.keys(pattern);

          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        } else {
          const keys = await this.redis.keys('cache:*');

          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        }
      }

      console.log('[Cache] Cache cleared');

    } catch (error: any) {
      console.error('[Cache] Error clearing cache:', error.message);
    }
  }

  /**
   * Get or set (cache-aside pattern)
   */
  async getOrSet<T = any>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key, options);

    if (cached !== null) {
      return cached;
    }

    // Not in cache, fetch from factory
    const value = await factory();

    // Store in cache
    await this.set(key, value, options);

    return value;
  }

  /**
   * Warm cache with data
   */
  async warm<T = any>(
    entries: Array<{ key: string; value: T }>,
    options: CacheOptions = {}
  ): Promise<void> {
    console.log(`[Cache] Warming cache with ${entries.length} entries...`);
    await this.mset(entries, options);
    console.log('[Cache] Cache warmed');
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      l1Hits: 0,
      l2Hits: 0,
    };
  }

  /**
   * Get cache size
   */
  async getSize(namespace?: string): Promise<number> {
    if (!this.redis) return 0;
    try {
      const pattern = namespace ? `cache:${namespace}:*` : 'cache:*';
      const keys = await this.redis.keys(pattern);
      return keys.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Build full cache key
   */
  private buildKey(key: string, namespace?: string): string {
    const ns = namespace || 'default';
    return `cache:${ns}:${key}`;
  }

  /**
   * Serialize value for storage
   */
  private serialize<T>(value: T): string {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }

  /**
   * Deserialize value from storage
   */
  private deserialize<T>(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      return value as any;
    }
  }

  /**
   * Store tags for group invalidation
   */
  private async storeTags(key: string, tags: string[], ttl: number): Promise<void> {
    if (!this.redis) return;
    try {
      const pipeline = this.redis.pipeline();

      for (const tag of tags) {
        const tagKey = `cache:tag:${tag}`;
        pipeline.sadd(tagKey, key);
        pipeline.expire(tagKey, ttl);
      }

      await pipeline.exec();

    } catch (error: any) {
      console.error('[Cache] Error storing tags:', error.message);
    }
  }

  /**
   * Start metrics calculation
   */
  private startMetricsCalculation(): void {
    setInterval(() => {
      const total = this.metrics.hits + this.metrics.misses;
      this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
    }, 10000); // Every 10 seconds
  }
}

/**
 * Initialize cache system
 */
export function initializeCacheSystem(redis: Redis): CacheSystem {
  const cache = CacheSystem.getInstance(redis);
  console.log('[Cache] Cache system initialized');
  return cache;
}

// Export singleton getter
export const getCache = () => CacheSystem.getInstance();
