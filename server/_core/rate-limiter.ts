/**
 * Rate Limiting System
 * Protects APIs from abuse and DoS attacks
 */

import { Request, Response, NextFunction } from "express";
import { ENV } from "./env";
import { createLogger } from "./logger";

const logger = createLogger("RateLimiter");

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store (for development)
// In production, use Redis for distributed rate limiting
const store: RateLimitStore = {};

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 5 * 60 * 1000);

export interface RateLimitOptions {
  windowMs?: number; // Time window in milliseconds
  maxRequests?: number; // Maximum requests per window
  keyGenerator?: (req: Request) => string; // Function to generate rate limit key
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  handler?: (req: Request, res: Response) => void; // Custom handler for rate limit exceeded
  message?: string; // Custom error message
}

/**
 * Create a rate limiter middleware
 */
export function createRateLimiter(options: RateLimitOptions = {}) {
  const {
    windowMs = ENV.rateLimitWindowMs,
    maxRequests = ENV.rateLimitMaxRequests,
    keyGenerator = defaultKeyGenerator,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    handler = defaultHandler,
    message = "Too many requests, please try again later.",
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator(req);
      const now = Date.now();

      // Get or create rate limit entry
      if (!store[key] || store[key].resetTime < now) {
        store[key] = {
          count: 0,
          resetTime: now + windowMs,
        };
      }

      const entry = store[key];

      // Check if limit exceeded
      if (entry.count >= maxRequests) {
        logger.warn(`Rate limit exceeded for key: ${key}`, {
          count: entry.count,
          maxRequests,
          resetTime: new Date(entry.resetTime).toISOString(),
        });

        // Set rate limit headers
        res.setHeader("X-RateLimit-Limit", maxRequests.toString());
        res.setHeader("X-RateLimit-Remaining", "0");
        res.setHeader("X-RateLimit-Reset", entry.resetTime.toString());
        res.setHeader("Retry-After", Math.ceil((entry.resetTime - now) / 1000).toString());

        return handler(req, res);
      }

      // Increment counter
      entry.count++;

      // Set rate limit headers
      res.setHeader("X-RateLimit-Limit", maxRequests.toString());
      res.setHeader("X-RateLimit-Remaining", (maxRequests - entry.count).toString());
      res.setHeader("X-RateLimit-Reset", entry.resetTime.toString());

      // Handle skip options
      if (skipSuccessfulRequests || skipFailedRequests) {
        const originalSend = res.send;
        res.send = function (body: any) {
          const statusCode = res.statusCode;

          if (
            (skipSuccessfulRequests && statusCode < 400) ||
            (skipFailedRequests && statusCode >= 400)
          ) {
            entry.count--;
          }

          return originalSend.call(this, body);
        };
      }

      next();
    } catch (error) {
      logger.error("Rate limiter error", error);
      // Don't block requests on rate limiter errors
      next();
    }
  };
}

/**
 * Default key generator (IP-based)
 */
function defaultKeyGenerator(req: Request): string {
  // Try to get real IP from various headers
  const forwarded = req.headers["x-forwarded-for"];
  const realIp = req.headers["x-real-ip"];
  const cfConnectingIp = req.headers["cf-connecting-ip"];

  let ip: string;

  if (typeof forwarded === "string") {
    ip = forwarded.split(",")[0].trim();
  } else if (typeof realIp === "string") {
    ip = realIp;
  } else if (typeof cfConnectingIp === "string") {
    ip = cfConnectingIp;
  } else {
    ip = req.ip || req.socket.remoteAddress || "unknown";
  }

  return `ip:${ip}`;
}

/**
 * User-based key generator
 */
export function userKeyGenerator(req: Request): string {
  const userId = (req as any).user?.id;
  if (userId) {
    return `user:${userId}`;
  }
  return defaultKeyGenerator(req);
}

/**
 * API key-based key generator
 */
export function apiKeyGenerator(req: Request): string {
  const apiKey = req.headers["x-api-key"];
  if (apiKey && typeof apiKey === "string") {
    return `apikey:${apiKey}`;
  }
  return defaultKeyGenerator(req);
}

/**
 * Default handler for rate limit exceeded
 */
function defaultHandler(req: Request, res: Response): void {
  res.status(429).json({
    error: "Too Many Requests",
    message: "You have exceeded the rate limit. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  });
}

/**
 * Preset rate limiters for common use cases
 */
export const rateLimiters = {
  // Strict rate limiter for authentication endpoints
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 requests per 15 minutes
    message: "Too many authentication attempts, please try again later.",
  }),

  // Standard rate limiter for API endpoints
  api: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  }),

  // Lenient rate limiter for public endpoints
  public: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  }),

  // Strict rate limiter for expensive operations
  expensive: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
  }),

  // User-based rate limiter
  user: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute per user
    keyGenerator: userKeyGenerator,
  }),
};

/**
 * Get current rate limit status for a key
 */
export function getRateLimitStatus(key: string): {
  count: number;
  resetTime: number;
  remaining: number;
} | null {
  const entry = store[key];
  if (!entry) {
    return null;
  }

  const maxRequests = ENV.rateLimitMaxRequests;
  return {
    count: entry.count,
    resetTime: entry.resetTime,
    remaining: Math.max(0, maxRequests - entry.count),
  };
}

/**
 * Reset rate limit for a key
 */
export function resetRateLimit(key: string): void {
  delete store[key];
  logger.info(`Rate limit reset for key: ${key}`);
}

/**
 * Clear all rate limits
 */
export function clearAllRateLimits(): void {
  Object.keys(store).forEach((key) => delete store[key]);
  logger.info("All rate limits cleared");
}
