import { Request, Response, NextFunction, RequestHandler } from 'express';
import { getRedisClient } from '../lib/redis.js';
import { TooManyRequestsError } from './errorHandler.js';
import { logger } from '../utils/logger.js';
import { AuthenticatedRequest } from '../types/index.js';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Custom key generator function (defaults to IP-based) */
  keyGenerator?: (req: Request) => string;
  /** Whether to skip counting failed requests */
  skipFailedRequests?: boolean;
  /** Whether to skip counting successful requests */
  skipSuccessfulRequests?: boolean;
}

/**
 * Rate limit info returned for each request
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
}

/**
 * Default key generator: uses IP address
 */
function defaultKeyGenerator(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

/**
 * Key generator for authenticated users: uses user ID if available, falls back to IP
 */
export function authenticatedKeyGenerator(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.id) {
    return `user:${authReq.user.id}`;
  }
  return defaultKeyGenerator(req);
}

/**
 * Creates a rate limiting middleware using Redis as the backing store.
 *
 * Uses a sliding window counter stored in Redis. Each request increments
 * the counter for the client's key. When the counter exceeds maxRequests,
 * subsequent requests receive a 429 response.
 *
 * Response headers are always set:
 * - X-RateLimit-Limit: the configured max requests
 * - X-RateLimit-Remaining: requests remaining in the current window
 * - X-RateLimit-Reset: Unix timestamp (seconds) when the window resets
 */
export function createRateLimiter(config: RateLimitConfig): RequestHandler {
  const {
    windowMs,
    maxRequests,
    keyGenerator = defaultKeyGenerator,
    skipFailedRequests = false,
    skipSuccessfulRequests = false,
  } = config;

  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const clientKey = keyGenerator(req);
    const redisKey = `ratelimit:${clientKey}`;

    try {
      const redis = getRedisClient();

      // Increment the counter and get the new value atomically
      const currentCount = await redis.incr(redisKey);

      // Set expiry on first request in the window
      if (currentCount === 1) {
        await redis.expire(redisKey, windowSeconds);
      }

      // Get TTL to calculate reset time
      const ttl = await redis.ttl(redisKey);
      const resetTimestamp = Math.ceil(Date.now() / 1000) + (ttl > 0 ? ttl : windowSeconds);
      const remaining = Math.max(0, maxRequests - currentCount);

      // Set rate limit headers on every response
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetTimestamp);

      // Handle skip options via response finish listener
      if (skipFailedRequests || skipSuccessfulRequests) {
        res.on('finish', async () => {
          try {
            const isSuccess = res.statusCode < 400;
            if ((skipFailedRequests && !isSuccess) || (skipSuccessfulRequests && isSuccess)) {
              await redis.decr(redisKey);
            }
          } catch (err) {
            logger.warn('Failed to adjust rate limit counter', { error: err });
          }
        });
      }

      if (currentCount > maxRequests) {
        const retryAfter = ttl > 0 ? ttl : windowSeconds;
        res.setHeader('Retry-After', retryAfter);
        throw new TooManyRequestsError(
          `请求过于频繁，请在 ${retryAfter} 秒后重试`
        );
      }

      next();
    } catch (error) {
      if (error instanceof TooManyRequestsError) {
        return next(error);
      }
      // If Redis is unavailable, log and allow the request through (fail-open)
      logger.warn('Rate limiter Redis error, allowing request through', { error });
      next();
    }
  };
}

// --- Pre-configured limiters ---

/** Public API: 100 requests per minute (IP-based) */
export const publicApiLimiter: RequestHandler = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 100,
});

/** Authenticated API: 200 requests per minute (user-based) */
export const authenticatedApiLimiter: RequestHandler = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 200,
  keyGenerator: authenticatedKeyGenerator,
});

/** Strict API: 10 requests per minute (for sensitive operations) */
export const strictApiLimiter: RequestHandler = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
});
