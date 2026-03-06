/**
 * Property-Based Tests for Offline Message Persistence and Delivery
 * Feature: project-review-and-upgrade
 *
 * **Property 7: 离线消息持久化和投递**
 * **Validates: Requirements 5.4, 5.5**
 *
 * For any messages received while a user is offline, messages should be
 * persisted to the queue; when the user reconnects, all cached messages
 * should be delivered in order.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import fc from 'fast-check';

// ---------------------------------------------------------------------------
// Mock Redis — simple mocks (same pattern as messageQueue.test.ts)
// ---------------------------------------------------------------------------

const mockRedis = {
  rpush: jest.fn<() => Promise<number>>().mockResolvedValue(1),
  expire: jest.fn<() => Promise<number>>().mockResolvedValue(1),
  lrange: jest.fn<() => Promise<string[]>>().mockResolvedValue([]),
  del: jest.fn<() => Promise<number>>().mockResolvedValue(1),
  llen: jest.fn<() => Promise<number>>().mockResolvedValue(0),
};

jest.mock('./redis.js', () => ({
  getRedisClient: () => mockRedis,
}));

jest.mock('../utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { MessageQueue } from './messageQueue.js';
import type { QueuedMessage } from './messageQueue.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Serialize a QueuedMessage the same way MessageQueue.enqueue does. */
function serializeMessage(msg: QueuedMessage): string {
  return JSON.stringify({
    ...msg,
    timestamp: msg.timestamp.toISOString(),
    expiresAt: msg.expiresAt.toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generate a valid QueuedMessage that is NOT expired. */
const validMessageArb = fc
  .record({
    id: fc.uuid(),
    event: fc.stringMatching(/^[a-z][a-z0-9:_-]{0,19}$/),
    data: fc.oneof(
      fc.string({ maxLength: 30 }),
      fc.integer(),
      fc.constant(null),
    ),
  })
  .map(({ id, event, data }): QueuedMessage => {
    const now = new Date();
    return {
      id,
      event,
      data,
      timestamp: now,
      expiresAt: new Date('2099-12-31T23:59:59.000Z'),
    };
  });

/** Generate a QueuedMessage that is already expired. */
const expiredMessageArb = fc
  .record({
    id: fc.uuid(),
    event: fc.stringMatching(/^[a-z][a-z0-9:_-]{0,19}$/),
  })
  .map(({ id, event }): QueuedMessage => {
    return {
      id,
      event,
      data: null,
      timestamp: new Date('2020-01-01T00:00:00.000Z'),
      expiresAt: new Date('2020-01-01T00:00:01.000Z'),
    };
  });

const userIdArb = fc.stringMatching(/^user-[a-z0-9]{1,8}$/);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 7: 离线消息持久化和投递', () => {
  let queue: MessageQueue;

  beforeEach(() => {
    jest.clearAllMocks();
    queue = new MessageQueue('test:pbt:', 3600);
  });

  /**
   * Enqueued messages are dequeued in FIFO order.
   * We verify by mocking lrange to return the serialized messages in order,
   * then checking that dequeue returns them in the same order.
   * **Validates: Requirements 5.4, 5.5**
   */
  it('should deliver messages in FIFO order', () => {
    fc.assert(
      fc.asyncProperty(
        userIdArb,
        fc.array(validMessageArb, { minLength: 1, maxLength: 10 }),
        async (userId, messages) => {
          // Setup: lrange returns the serialized messages in enqueue order
          const serialized = messages.map(serializeMessage);
          mockRedis.lrange.mockResolvedValueOnce(serialized);

          const delivered = await queue.dequeue(userId);

          // All messages delivered in FIFO order
          expect(delivered.map((m) => m.id)).toEqual(messages.map((m) => m.id));
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Expired messages are filtered out on dequeue.
   * **Validates: Requirements 5.4, 5.5**
   */
  it('should filter out expired messages on dequeue', () => {
    fc.assert(
      fc.asyncProperty(
        userIdArb,
        fc.array(validMessageArb, { minLength: 1, maxLength: 5 }),
        fc.array(expiredMessageArb, { minLength: 1, maxLength: 5 }),
        async (userId, validMsgs, expiredMsgs) => {
          // Ensure no ID collisions between valid and expired sets
          const validIds = new Set(validMsgs.map((m) => m.id));
          const uniqueExpired = expiredMsgs.filter((m) => !validIds.has(m.id));
          fc.pre(uniqueExpired.length > 0);

          // Setup: lrange returns expired + valid messages interleaved
          const allSerialized = [
            ...uniqueExpired.map(serializeMessage),
            ...validMsgs.map(serializeMessage),
          ];
          mockRedis.lrange.mockResolvedValueOnce(allSerialized);

          const delivered = await queue.dequeue(userId);

          // None of the expired message IDs should appear
          const expiredIds = new Set(uniqueExpired.map((m) => m.id));
          for (const msg of delivered) {
            expect(expiredIds.has(msg.id)).toBe(false);
          }

          // All valid messages should be present
          const deliveredIds = delivered.map((m) => m.id);
          for (const msg of validMsgs) {
            expect(deliveredIds).toContain(msg.id);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Queue size matches the number of enqueued messages.
   * We verify that enqueue calls rpush once per message, and that
   * getQueueSize returns the expected count.
   * **Validates: Requirements 5.4, 5.5**
   */
  it('should report queue size equal to number of enqueued messages', () => {
    fc.assert(
      fc.asyncProperty(
        userIdArb,
        fc.array(validMessageArb, { minLength: 0, maxLength: 10 }),
        async (userId, messages) => {
          // Reset mocks for this property run
          mockRedis.rpush.mockClear();
          mockRedis.llen.mockReset();
          mockRedis.rpush.mockResolvedValue(1);

          // Enqueue all messages
          for (const msg of messages) {
            await queue.enqueue(userId, msg);
          }

          // Verify rpush was called once per message
          expect(mockRedis.rpush).toHaveBeenCalledTimes(messages.length);

          // Setup getQueueSize to return the count
          mockRedis.llen.mockResolvedValueOnce(messages.length);
          const size = await queue.getQueueSize(userId);
          expect(size).toBe(messages.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});
