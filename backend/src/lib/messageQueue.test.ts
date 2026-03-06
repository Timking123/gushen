import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock Redis before importing the module
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

import { MessageQueue, QueuedMessage } from './messageQueue.js';

describe('MessageQueue', () => {
  let queue: MessageQueue;

  beforeEach(() => {
    jest.clearAllMocks();
    queue = new MessageQueue('test:queue:', 3600);
  });

  function createMessage(overrides: Partial<QueuedMessage> = {}): QueuedMessage {
    const now = new Date();
    return {
      id: 'msg-1',
      event: 'test:event',
      data: { foo: 'bar' },
      timestamp: now,
      expiresAt: new Date(now.getTime() + 86400000), // +24h
      ...overrides,
    };
  }

  describe('enqueue', () => {
    it('should push a serialized message to the Redis list', async () => {
      const msg = createMessage();
      await queue.enqueue('user-1', msg);

      expect(mockRedis.rpush).toHaveBeenCalledWith(
        'test:queue:user-1',
        expect.any(String),
      );
      // Verify the serialized payload
      const serialized = JSON.parse(
        (mockRedis.rpush.mock.calls[0] as unknown[])[1] as string,
      );
      expect(serialized.id).toBe('msg-1');
      expect(serialized.event).toBe('test:event');
    });

    it('should set TTL on the queue key', async () => {
      const msg = createMessage();
      await queue.enqueue('user-1', msg);

      expect(mockRedis.expire).toHaveBeenCalledWith('test:queue:user-1', 3600);
    });

    it('should throw when Redis fails', async () => {
      mockRedis.rpush.mockRejectedValueOnce(new Error('Redis down'));
      await expect(queue.enqueue('user-1', createMessage())).rejects.toThrow('Redis down');
    });
  });

  describe('dequeue', () => {
    it('should return empty array when no messages', async () => {
      mockRedis.lrange.mockResolvedValueOnce([]);
      const result = await queue.dequeue('user-1');
      expect(result).toEqual([]);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should return and delete all non-expired messages', async () => {
      const now = new Date();
      const validMsg = {
        id: 'msg-1',
        event: 'test',
        data: {},
        timestamp: now.toISOString(),
        expiresAt: new Date(now.getTime() + 86400000).toISOString(),
      };
      mockRedis.lrange.mockResolvedValueOnce([JSON.stringify(validMsg)]);

      const result = await queue.dequeue('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('msg-1');
      expect(result[0].timestamp).toBeInstanceOf(Date);
      expect(result[0].expiresAt).toBeInstanceOf(Date);
      expect(mockRedis.del).toHaveBeenCalledWith('test:queue:user-1');
    });

    it('should filter out expired messages', async () => {
      const now = new Date();
      const expiredMsg = {
        id: 'msg-expired',
        event: 'test',
        data: {},
        timestamp: new Date(now.getTime() - 86400000).toISOString(),
        expiresAt: new Date(now.getTime() - 1000).toISOString(), // already expired
      };
      const validMsg = {
        id: 'msg-valid',
        event: 'test',
        data: {},
        timestamp: now.toISOString(),
        expiresAt: new Date(now.getTime() + 86400000).toISOString(),
      };
      mockRedis.lrange.mockResolvedValueOnce([
        JSON.stringify(expiredMsg),
        JSON.stringify(validMsg),
      ]);

      const result = await queue.dequeue('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('msg-valid');
    });

    it('should skip malformed messages gracefully', async () => {
      mockRedis.lrange.mockResolvedValueOnce(['not-valid-json', '{"id":"ok","event":"e","data":{},"timestamp":"2025-01-01T00:00:00.000Z","expiresAt":"2099-01-01T00:00:00.000Z"}']);

      const result = await queue.dequeue('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ok');
    });
  });

  describe('getQueueSize', () => {
    it('should return the length of the Redis list', async () => {
      mockRedis.llen.mockResolvedValueOnce(5);
      const size = await queue.getQueueSize('user-1');
      expect(size).toBe(5);
      expect(mockRedis.llen).toHaveBeenCalledWith('test:queue:user-1');
    });

    it('should throw when Redis fails', async () => {
      mockRedis.llen.mockRejectedValueOnce(new Error('Redis down'));
      await expect(queue.getQueueSize('user-1')).rejects.toThrow('Redis down');
    });
  });
});
