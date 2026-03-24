/**
 * Distributed Rate Limiter
 * 
 * Redis-based rate limiting that works across multiple server instances.
 * Implements multiple algorithms:
 * - Sliding Window (accurate, memory efficient)
 * - Token Bucket (handles bursts)
 * - Leaky Bucket (smooth rate)
 * - Fixed Window (simple, fast)
 * 
 * @module DistributedRateLimiter
 * @author Manus AI
 * @version 2.0.0
 */

import Redis from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export interface TokenBucketResult {
  allowed: boolean;
  tokens: number;
  refillAt: number;
}

export class DistributedRateLimiter {
  private static redis: Redis | null = null;
  private static localCache = new Map<string, number[]>();

  /**
   * Initialize with Redis client
   */
  static initialize(redis: Redis): void {
    this.redis = redis;
    console.log('[RateLimiter] Initialized with Redis');
  }

  private static isRedisAvailable(): boolean {
    return !!this.redis && (this.redis as any).status === 'ready';
  }

  /**
   * Sliding Window Rate Limiter
   * Most accurate, memory efficient
   * 
   * @param key - Unique identifier (e.g., accountId:operation)
   * @param limit - Maximum requests allowed
   * @param window - Time window in seconds
   */
  static async checkSlidingWindow(
    key: string,
    limit: number,
    window: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - window * 1000;

    if (!this.isRedisAvailable()) {
      // In-memory fallback
      let timestamps = this.localCache.get(key) || [];
      timestamps = timestamps.filter(t => t > windowStart);
      
      const allowed = timestamps.length < limit;
      if (allowed) {
        timestamps.push(now);
      }
      this.localCache.set(key, timestamps);

      const resetAt = now + window * 1000;
      return {
        allowed,
        remaining: Math.max(0, limit - timestamps.length),
        resetAt,
        retryAfter: allowed ? undefined : Math.ceil((resetAt - now) / 1000),
      };
    }

    const redisKey = `ratelimit:sliding:${key}`;
    try {
      const multi = this.redis!.multi();
      multi.zremrangebyscore(redisKey, 0, windowStart);
      multi.zcard(redisKey);
      const requestId = `${now}-${Math.random().toString(36).substring(7)}`;
      multi.zadd(redisKey, now, requestId);
      multi.expire(redisKey, window);
      
      const results = await multi.exec();
      if (!results) throw new Error('Redis multi exec failed');
      
      const count = (results[1][1] as number) || 0;
      const allowed = count < limit;
      const remaining = Math.max(0, limit - count - 1);
      const resetAt = now + window * 1000;
      
      return {
        allowed,
        remaining,
        resetAt,
        retryAfter: allowed ? undefined : Math.ceil((resetAt - now) / 1000),
      };
    } catch (error: any) {
      console.error('[RateLimiter] Sliding window error:', error.message);
      return { allowed: true, remaining: limit, resetAt: now + window * 1000 };
    }
  }

  /**
   * Token Bucket Rate Limiter
   */
  static async checkTokenBucket(
    key: string,
    capacity: number,
    refillRate: number,
    refillInterval: number
  ): Promise<TokenBucketResult> {
    const now = Date.now();
    if (!this.isRedisAvailable()) {
      return { allowed: true, tokens: capacity, refillAt: now + refillInterval };
    }

    const redisKey = `ratelimit:bucket:${key}`;
    try {
      const script = `
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local refillRate = tonumber(ARGV[2])
        local refillInterval = tonumber(ARGV[3])
        local now = tonumber(ARGV[4])
        local cost = tonumber(ARGV[5])
        
        local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
        local tokens = tonumber(bucket[1]) or capacity
        local lastRefill = tonumber(bucket[2]) or now
        
        local elapsed = now - lastRefill
        local refills = math.floor(elapsed / refillInterval)
        
        if refills > 0 then
          tokens = math.min(capacity, tokens + refills * refillRate)
          lastRefill = lastRefill + refills * refillInterval
        end
        
        local allowed = tokens >= cost
        if allowed then
          tokens = tokens - cost
        end
        
        redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
        redis.call('EXPIRE', key, 3600)
        
        return {allowed and 1 or 0, tokens, lastRefill + refillInterval}
      `;
      
      const result = await this.redis!.eval(script, 1, redisKey, capacity, refillRate, refillInterval, now, 1) as [number, number, number];
      return { allowed: result[0] === 1, tokens: result[1], refillAt: result[2] };
    } catch (error: any) {
      console.error('[RateLimiter] Token bucket error:', error.message);
      return { allowed: true, tokens: capacity, refillAt: now + refillInterval };
    }
  }

  /**
   * Fixed Window Rate Limiter
   */
  static async checkFixedWindow(key: string, limit: number, window: number): Promise<RateLimitResult> {
    const now = Date.now();
    if (!this.isRedisAvailable()) {
      return { allowed: true, remaining: limit, resetAt: now + window * 1000 };
    }

    const windowKey = Math.floor(now / (window * 1000));
    const redisKey = `ratelimit:fixed:${key}:${windowKey}`;
    try {
      const multi = this.redis!.multi();
      multi.incr(redisKey);
      multi.expire(redisKey, window);
      const results = await multi.exec();
      if (!results) throw new Error('Redis multi exec failed');
      
      const count = (results[0][1] as number) || 0;
      const allowed = count <= limit;
      const resetAt = (windowKey + 1) * window * 1000;
      
      return { allowed, remaining: Math.max(0, limit - count), resetAt, retryAfter: allowed ? undefined : Math.ceil((resetAt - now) / 1000) };
    } catch (error: any) {
      console.error('[RateLimiter] Fixed window error:', error.message);
      return { allowed: true, remaining: limit, resetAt: now + window * 1000 };
    }
  }

  /**
   * Leaky Bucket Rate Limiter
   */
  static async checkLeakyBucket(key: string, capacity: number, leakRate: number): Promise<RateLimitResult> {
    const now = Date.now();
    if (!this.isRedisAvailable()) {
      return { allowed: true, remaining: capacity, resetAt: now + 1000 };
    }

    const redisKey = `ratelimit:leaky:${key}`;
    try {
      const script = `
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local leakRate = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        local bucket = redis.call('HMGET', key, 'level', 'lastLeak')
        local level = tonumber(bucket[1]) or 0
        local lastLeak = tonumber(bucket[2]) or now
        local elapsed = (now - lastLeak) / 1000
        level = math.max(0, level - (elapsed * leakRate))
        local allowed = level < capacity
        if allowed then level = level + 1 end
        redis.call('HMSET', key, 'level', level, 'lastLeak', now)
        redis.call('EXPIRE', key, 3600)
        return {allowed and 1 or 0, math.max(0, capacity - level), now + ((level / leakRate) * 1000)}
      `;
      const r = await this.redis!.eval(script, 1, redisKey, capacity, leakRate, now) as [number, number, number];
      return { allowed: r[0] === 1, remaining: r[1], resetAt: r[2], retryAfter: r[0] === 0 ? Math.ceil((r[2] - now) / 1000) : undefined };
    } catch (error: any) {
      console.error('[RateLimiter] Leaky bucket error:', error.message);
      return { allowed: true, remaining: capacity, resetAt: now + 1000 };
    }
  }

  /**
   * Multi-tier rate limiting
   */
  static async checkMultiTier(key: string, limits: Array<{ limit: number; window: number }>): Promise<RateLimitResult> {
    for (const { limit, window } of limits) {
      const result = await this.checkSlidingWindow(key, limit, window);
      if (!result.allowed) return result;
    }
    return { allowed: true, remaining: limits[0].limit, resetAt: Date.now() + limits[0].window * 1000 };
  }

  /**
   * Get current usage for a key
   */
  static async getUsage(key: string, window: number): Promise<number> {
    if (!this.isRedisAvailable()) {
      return (this.localCache.get(key) || []).length;
    }
    try {
      return await this.redis!.zcount(`ratelimit:sliding:${key}`, Date.now() - window * 1000, Date.now());
    } catch { return 0; }
  }

  /**
   * Reset rate limit for a key
   */
  static async reset(key: string): Promise<void> {
    this.localCache.delete(key);
    if (!this.isRedisAvailable()) return;
    try {
      const keys = await this.redis!.keys(`ratelimit:*:${key}*`);
      if (keys.length > 0) await this.redis!.del(...keys);
    } catch (error: any) {
      console.error('[RateLimiter] Reset error:', error.message);
    }
  }

  /**
   * Get all rate limit keys
   */
  static async getAllKeys(pattern: string = '*'): Promise<string[]> {
    try {
      if (!this.isRedisAvailable()) return Array.from(this.localCache.keys());
      return await this.redis!.keys(`ratelimit:*:${pattern}`);
    } catch (error) { return []; }
  }

  /**
   * Cleanup expired keys
   */
  static async cleanup(): Promise<number> {
    let cleaned = 0;
    const now = Date.now();
    
    // Cleanup local cache
    for (const [key, timestamps] of this.localCache.entries()) {
      const valid = timestamps.filter(t => t > now - 86400 * 1000); // 24h max
      if (valid.length === 0) {
        this.localCache.delete(key);
        cleaned++;
      } else {
        this.localCache.set(key, valid);
      }
    }

    if (!this.isRedisAvailable()) return cleaned;

    try {
      const keys = await this.redis!.keys('ratelimit:*');
      for (const key of keys) {
        const ttl = await this.redis!.ttl(key);
        if (ttl === -1) {
          await this.redis!.del(key);
          cleaned++;
        }
      }
      return cleaned;
    } catch (error) { return cleaned; }
  }
}

