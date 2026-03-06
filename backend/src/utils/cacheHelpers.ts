/**
 * Cache Helper Utilities
 * Requirement 10.1: Extract cache read/write logic as reusable utility functions
 */

import { redisHelpers } from '../lib/redis.js';
import { logger } from './logger.js';

/**
 * Generic cache wrapper with fallback
 * Automatically handles cache read/write with error tolerance
 */
export async function withCache<T>(
  cacheKey: string,
  ttl: number,
  fetchFn: () => Promise<T>,
  options: {
    skipCache?: boolean;
    logContext?: string;
  } = {}
): Promise<T> {
  const { skipCache = false, logContext = 'cache operation' } = options;

  // Skip cache if requested
  if (skipCache) {
    return await fetchFn();
  }

  // Try to get from cache
  try {
    const cached = await redisHelpers.getJson<T>(cacheKey);
    if (cached !== null) {
      logger.debug(`Cache hit: ${cacheKey}`, { context: logContext });
      return cached;
    }
  } catch (error) {
    logger.warn(`Cache read failed for ${cacheKey}, continuing without cache`, {
      error: error instanceof Error ? error.message : String(error),
      context: logContext,
    });
  }

  // Cache miss or error - fetch fresh data
  const data = await fetchFn();

  // Try to cache the result
  try {
    await redisHelpers.setJson(cacheKey, data, ttl);
    logger.debug(`Cache set: ${cacheKey}`, { context: logContext, ttl });
  } catch (error) {
    logger.warn(`Cache write failed for ${cacheKey}`, {
      error: error instanceof Error ? error.message : String(error),
      context: logContext,
    });
  }

  return data;
}

/**
 * Invalidate cache by key pattern
 */
export async function invalidateCache(pattern: string): Promise<void> {
  try {
    await redisHelpers.del(pattern);
    logger.debug(`Cache invalidated: ${pattern}`);
  } catch (error) {
    logger.warn(`Cache invalidation failed for ${pattern}`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Batch cache operations
 */
export async function batchGetCache<T>(keys: string[]): Promise<Map<string, T>> {
  const results = new Map<string, T>();

  await Promise.all(
    keys.map(async (key) => {
      try {
        const value = await redisHelpers.getJson<T>(key);
        if (value !== null) {
          results.set(key, value);
        }
      } catch (error) {
        logger.warn(`Batch cache read failed for ${key}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })
  );

  return results;
}

/**
 * Batch set cache
 */
export async function batchSetCache<T>(
  entries: Array<{ key: string; value: T; ttl: number }>
): Promise<void> {
  await Promise.all(
    entries.map(async ({ key, value, ttl }) => {
      try {
        await redisHelpers.setJson(key, value, ttl);
      } catch (error) {
        logger.warn(`Batch cache write failed for ${key}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })
  );
}

