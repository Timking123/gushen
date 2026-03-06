import { getRedisClient } from './redis.js';
import { logger } from '../utils/logger.js';

/**
 * Queued message structure for offline message persistence (Requirement 5.4)
 */
export interface QueuedMessage {
  id: string;
  event: string;
  data: unknown;
  timestamp: Date;
  expiresAt: Date;
}

/**
 * Message queue interface for offline message persistence
 */
export interface IMessageQueue {
  enqueue(userId: string, message: QueuedMessage): Promise<void>;
  dequeue(userId: string): Promise<QueuedMessage[]>;
  getQueueSize(userId: string): Promise<number>;
}

// Default message TTL: 24 hours
const DEFAULT_MESSAGE_TTL_SECONDS = 86400;

/**
 * Redis-backed message queue for WebSocket offline message persistence.
 * Ensures messages sent while a user is offline are stored and delivered
 * when they reconnect (Requirements 5.4, 5.5).
 */
export class MessageQueue implements IMessageQueue {
  private readonly keyPrefix: string;
  private readonly messageTTL: number;

  constructor(keyPrefix = 'ws:msgqueue:', messageTTL = DEFAULT_MESSAGE_TTL_SECONDS) {
    this.keyPrefix = keyPrefix;
    this.messageTTL = messageTTL;
  }

  private getQueueKey(userId: string): string {
    return `${this.keyPrefix}${userId}`;
  }

  /**
   * Add a message to the user's offline queue (Requirement 5.4)
   */
  async enqueue(userId: string, message: QueuedMessage): Promise<void> {
    const redis = getRedisClient();
    const key = this.getQueueKey(userId);

    try {
      const serialized = JSON.stringify({
        ...message,
        timestamp: message.timestamp.toISOString(),
        expiresAt: message.expiresAt.toISOString(),
      });

      await redis.rpush(key, serialized);
      // Set TTL on the queue key so it auto-expires
      await redis.expire(key, this.messageTTL);

      logger.debug(`Enqueued message ${message.id} for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to enqueue message for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve and remove all queued messages for a user (Requirement 5.5).
   * Messages are returned in FIFO order and expired messages are filtered out.
   */
  async dequeue(userId: string): Promise<QueuedMessage[]> {
    const redis = getRedisClient();
    const key = this.getQueueKey(userId);

    try {
      // Get all messages atomically
      const rawMessages = await redis.lrange(key, 0, -1);

      if (rawMessages.length === 0) {
        return [];
      }

      // Delete the queue after reading
      await redis.del(key);

      const now = new Date();
      const messages: QueuedMessage[] = [];

      for (const raw of rawMessages) {
        try {
          const parsed = JSON.parse(raw);
          const msg: QueuedMessage = {
            ...parsed,
            timestamp: new Date(parsed.timestamp),
            expiresAt: new Date(parsed.expiresAt),
          };

          // Filter out expired messages
          if (msg.expiresAt > now) {
            messages.push(msg);
          }
        } catch {
          logger.warn(`Failed to parse queued message for user ${userId}`);
        }
      }

      logger.info(`Dequeued ${messages.length} messages for user ${userId} (${rawMessages.length - messages.length} expired)`);
      return messages;
    } catch (error) {
      logger.error(`Failed to dequeue messages for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get the number of messages in a user's queue
   */
  async getQueueSize(userId: string): Promise<number> {
    const redis = getRedisClient();
    const key = this.getQueueKey(userId);

    try {
      return await redis.llen(key);
    } catch (error) {
      logger.error(`Failed to get queue size for user ${userId}:`, error);
      throw error;
    }
  }
}

/** Singleton message queue instance */
export const messageQueue = new MessageQueue();
