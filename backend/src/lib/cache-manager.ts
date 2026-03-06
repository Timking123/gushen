import { createHash } from 'crypto';
import { getRedisClient } from './redis.js';
import { logger } from '../utils/logger.js';

// --- Interfaces ---

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
  serialize?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsage: number;
}

// --- Key generation helpers (exported for testing) ---

/**
 * Deep-sort an object's keys alphabetically (recursive).
 * Arrays are preserved in order; each element is deep-sorted if it's an object.
 */
export function deepSortObject(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(deepSortObject);
  if (typeof value === 'object' && !(value instanceof Date)) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = deepSortObject((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Generate a deterministic cache key from a prefix and params object.
 *
 * 1. Recursively sort all object keys alphabetically
 * 2. Serialize to JSON
 * 3. SHA-256 hash the serialized string
 * 4. Return `{prefix}:{hash}`
 */
export function generateKey(prefix: string, params: Record<string, unknown>): string {
  const sorted = deepSortObject(params);
  const serialized = JSON.stringify(sorted);
  const hash = createHash('sha256').update(serialized).digest('hex');
  return `${prefix}:${hash}`;
}

// --- CacheManager class ---

export class CacheManager {
  private hits = 0;
  private misses = 0;

  /** Retrieve a value from Redis. Returns null on miss or error. */
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = getRedisClient();
      const raw = await client.get(key);
      if (raw === null) {
        this.misses++;
        return null;
      }
      this.hits++;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    } catch (err) {
      logger.warn('CacheManager.get failed', { key, error: err });
      this.misses++;
      return null;
    }
  }

  /** Store a value in Redis with optional TTL (seconds). */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const client = getRedisClient();
      const serialized = JSON.stringify(value);
      if (options?.ttl && options.ttl > 0) {
        await client.setex(key, options.ttl, serialized);
      } else {
        await client.set(key, serialized);
      }
    } catch (err) {
      logger.warn('CacheManager.set failed', { key, error: err });
    }
  }

  /** Delete a single key from Redis. */
  async del(key: string): Promise<void> {
    try {
      const client = getRedisClient();
      await client.del(key);
    } catch (err) {
      logger.warn('CacheManager.del failed', { key, error: err });
    }
  }

  /**
   * Get a cached value or compute it via `factory`, store, and return.
   * Cache misses invoke the factory; the result is stored with the given options.
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /** Delete all keys matching a glob pattern (uses SCAN for safety). */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const client = getRedisClient();
      let cursor = '0';
      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      logger.warn('CacheManager.invalidatePattern failed', { pattern, error: err });
    }
  }

  /** Convenience wrapper around the standalone generateKey function. */
  generateKey(prefix: string, params: Record<string, unknown>): string {
    return generateKey(prefix, params);
  }

  /** Return hit/miss statistics. */
  async getStats(): Promise<CacheStats> {
    const total = this.hits + this.misses;
    let memoryUsage = 0;
    try {
      const client = getRedisClient();
      const info = await client.info('memory');
      const match = info.match(/used_memory:(\d+)/);
      if (match) memoryUsage = parseInt(match[1], 10);
    } catch {
      // ignore – stats are best-effort
    }
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : this.hits / total,
      memoryUsage,
    };
  }
}

/** Singleton instance */
export const cacheManager = new CacheManager();
