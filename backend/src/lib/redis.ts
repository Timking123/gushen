import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Create Redis client
export const createRedisClient = (): Redis => {
  const redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 3) {
        logger.error('Redis connection failed after 3 retries');
        return null; // Stop retrying
      }
      const delay = Math.min(times * 200, 2000);
      logger.warn(`Redis connection retry in ${delay}ms (attempt ${times})`);
      return delay;
    },
    lazyConnect: true, // Don't connect immediately
  });

  redis.on('connect', () => {
    logger.info('Redis client connected');
  });

  redis.on('error', (err: Error) => {
    logger.error('Redis client error:', err);
  });

  redis.on('close', () => {
    logger.warn('Redis connection closed');
  });

  return redis;
};

// Singleton Redis instance
let redisClient: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
};

// Helper functions for common Redis operations
export const redisHelpers = {
  // Set with expiration (in seconds)
  async setEx(key: string, value: string, ttlSeconds: number): Promise<void> {
    const client = getRedisClient();
    await client.setex(key, ttlSeconds, value);
  },

  // Get value
  async get(key: string): Promise<string | null> {
    const client = getRedisClient();
    return client.get(key);
  },

  // Delete key
  async del(key: string): Promise<void> {
    const client = getRedisClient();
    await client.del(key);
  },

  // Set JSON with expiration
  async setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const client = getRedisClient();
    await client.setex(key, ttlSeconds, JSON.stringify(value));
  },

  // Get JSON
  async getJson<T>(key: string): Promise<T | null> {
    const client = getRedisClient();
    const value = await client.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  },

  // Check if key exists
  async exists(key: string): Promise<boolean> {
    const client = getRedisClient();
    const result = await client.exists(key);
    return result === 1;
  },

  // Publish message to channel
  async publish(channel: string, message: string): Promise<void> {
    const client = getRedisClient();
    await client.publish(channel, message);
  },
};

// Graceful shutdown
export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed gracefully');
  }
};
