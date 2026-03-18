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
  private static redis: Redis;
  
  /**
   * Initialize with Redis client
   */
  static initialize(redis: Redis): void {
    this.redis = redis;
    console.log('[RateLimiter] Initialized with Redis');
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
    const redisKey = `ratelimit:sliding:${key}`;
    
    try {
      const multi = this.redis.multi();
      
      // Remove old entries outside the window
      multi.zremrangebyscore(redisKey, 0, windowStart);
      
      // Count current requests in window
      multi.zcard(redisKey);
      
      // Add current request with timestamp as score
      const requestId = `${now}-${Math.random().toString(36).substring(7)}`;
      multi.zadd(redisKey, now, requestId);
      
      // Set expiry to window duration
      multi.expire(redisKey, window);
      
      const results = await multi.exec();
      
      if (!results) {
        throw new Error('Redis multi exec failed');
      }
      
      // Get count before adding current request
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
      // Fail open (allow request) on Redis errors
      return {
        allowed: true,
        remaining: limit,
        resetAt: now + window * 1000,
      };
    }
  }
  
  /**
   * Token Bucket Rate Limiter
   * Handles burst traffic well
   * 
   * @param key - Unique identifier
   * @param capacity - Maximum tokens (burst size)
   * @param refillRate - Tokens added per interval
   * @param refillInterval - Interval in milliseconds
   */
  static async checkTokenBucket(
    key: string,
    capacity: number,
    refillRate: number,
    refillInterval: number
  ): Promise<TokenBucketResult> {
    const now = Date.now();
    const redisKey = `ratelimit:bucket:${key}`;
    
    try {
      // Lua script for atomic token bucket operation
      const script = `
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local refillRate = tonumber(ARGV[2])
        local refillInterval = tonumber(ARGV[3])
        local now = tonumber(ARGV[4])
        local cost = tonumber(ARGV[5])
        
        -- Get current bucket state
        local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
        local tokens = tonumber(bucket[1]) or capacity
        local lastRefill = tonumber(bucket[2]) or now
        
        -- Calculate tokens to add based on time elapsed
        local elapsed = now - lastRefill
        local refills = math.floor(elapsed / refillInterval)
        
        if refills > 0 then
          tokens = math.min(capacity, tokens + refills * refillRate)
          lastRefill = lastRefill + refills * refillInterval
        end
        
        -- Try to consume tokens
        local allowed = tokens >= cost
        if allowed then
          tokens = tokens - cost
        end
        
        -- Update bucket state
        redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
        redis.call('EXPIRE', key, 3600) -- 1 hour expiry
        
        -- Calculate next refill time
        local nextRefill = lastRefill + refillInterval
        
        return {allowed and 1 or 0, tokens, nextRefill}
      `;
      
      const result = await this.redis.eval(
        script,
        1,
        redisKey,
        capacity,
        refillRate,
        refillInterval,
        now,
        1 // cost per request
      ) as [number, number, number];
      
      return {
        allowed: result[0] === 1,
        tokens: result[1],
        refillAt: result[2],
      };
      
    } catch (error: any) {
      console.error('[RateLimiter] Token bucket error:', error.message);
      return {
        allowed: true,
        tokens: capacity,
        refillAt: now + refillInterval,
      };
    }
  }
  
  /**
   * Fixed Window Rate Limiter
   * Simple and fast, but less accurate
   * 
   * @param key - Unique identifier
   * @param limit - Maximum requests per window
   * @param window - Window size in seconds
   */
  static async checkFixedWindow(
    key: string,
    limit: number,
    window: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowKey = Math.floor(now / (window * 1000));
    const redisKey = `ratelimit:fixed:${key}:${windowKey}`;
    
    try {
      const multi = this.redis.multi();
      
      // Increment counter
      multi.incr(redisKey);
      
      // Set expiry
      multi.expire(redisKey, window);
      
      const results = await multi.exec();
      
      if (!results) {
        throw new Error('Redis multi exec failed');
      }
      
      const count = (results[0][1] as number) || 0;
      const allowed = count <= limit;
      const remaining = Math.max(0, limit - count);
      const resetAt = (windowKey + 1) * window * 1000;
      
      return {
        allowed,
        remaining,
        resetAt,
        retryAfter: allowed ? undefined : Math.ceil((resetAt - now) / 1000),
      };
      
    } catch (error: any) {
      console.error('[RateLimiter] Fixed window error:', error.message);
      return {
        allowed: true,
        remaining: limit,
        resetAt: now + window * 1000,
      };
    }
  }
  
  /**
   * Leaky Bucket Rate Limiter
   * Smooths out traffic spikes
   * 
   * @param key - Unique identifier
   * @param capacity - Maximum queue size
   * @param leakRate - Requests processed per second
   */
  static async checkLeakyBucket(
    key: string,
    capacity: number,
    leakRate: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const redisKey = `ratelimit:leaky:${key}`;
    
    try {
      const script = `
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local leakRate = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        
        -- Get current bucket state
        local bucket = redis.call('HMGET', key, 'level', 'lastLeak')
        local level = tonumber(bucket[1]) or 0
        local lastLeak = tonumber(bucket[2]) or now
        
        -- Calculate leaked amount
        local elapsed = (now - lastLeak) / 1000 -- Convert to seconds
        local leaked = elapsed * leakRate
        level = math.max(0, level - leaked)
        
        -- Try to add request
        local allowed = level < capacity
        if allowed then
          level = level + 1
        end
        
        -- Update bucket state
        redis.call('HMSET', key, 'level', level, 'lastLeak', now)
        redis.call('EXPIRE', key, 3600)
        
        local remaining = math.max(0, capacity - level)
        local resetAt = now + ((level / leakRate) * 1000)
        
        return {allowed and 1 or 0, remaining, resetAt}
      `;
      
      const result = await this.redis.eval(
        script,
        1,
        redisKey,
        capacity,
        leakRate,
        now
      ) as [number, number, number];
      
      return {
        allowed: result[0] === 1,
        remaining: result[1],
        resetAt: result[2],
        retryAfter: result[0] === 0 ? Math.ceil((result[2] - now) / 1000) : undefined,
      };
      
    } catch (error: any) {
      console.error('[RateLimiter] Leaky bucket error:', error.message);
      return {
        allowed: true,
        remaining: capacity,
        resetAt: now + 1000,
      };
    }
  }
  
  /**
   * Multi-tier rate limiting
   * Combines multiple limits (per second, per minute, per hour, per day)
   * 
   * @param key - Unique identifier
   * @param limits - Array of {limit, window} objects
   */
  static async checkMultiTier(
    key: string,
    limits: Array<{ limit: number; window: number }>
  ): Promise<RateLimitResult> {
    // Check all tiers
    for (const { limit, window } of limits) {
      const result = await this.checkSlidingWindow(key, limit, window);
      
      if (!result.allowed) {
        return result;
      }
    }
    
    // All tiers passed
    return {
      allowed: true,
      remaining: limits[0].limit,
      resetAt: Date.now() + limits[0].window * 1000,
    };
  }
  
  /**
   * Get current usage for a key
   */
  static async getUsage(key: string, window: number): Promise<number> {
    const now = Date.now();
    const windowStart = now - window * 1000;
    const redisKey = `ratelimit:sliding:${key}`;
    
    try {
      const count = await this.redis.zcount(redisKey, windowStart, now);
      return count;
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * Reset rate limit for a key
   */
  static async reset(key: string): Promise<void> {
    try {
      const keys = await this.redis.keys(`ratelimit:*:${key}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error: any) {
      console.error('[RateLimiter] Reset error:', error.message);
    }
  }
  
  /**
   * Get all rate limit keys
   */
  static async getAllKeys(pattern: string = '*'): Promise<string[]> {
    try {
      return await this.redis.keys(`ratelimit:*:${pattern}`);
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Cleanup expired keys
   */
  static async cleanup(): Promise<number> {
    try {
      const keys = await this.redis.keys('ratelimit:*');
      let cleaned = 0;
      
      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) {
          // No expiry set, delete it
          await this.redis.del(key);
          cleaned++;
        }
      }
      
      return cleaned;
    } catch (error) {
      return 0;
    }
  }
}
