import { createHash } from 'crypto';
import { CacheManager, generateKey, deepSortObject } from './cache-manager.js';

// --- Mocks ---

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  scan: jest.fn(),
  info: jest.fn(),
};

jest.mock('./redis', () => ({
  getRedisClient: () => mockRedis,
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// --- Tests ---

describe('deepSortObject', () => {
  it('sorts top-level keys alphabetically', () => {
    expect(deepSortObject({ z: 1, a: 2, m: 3 })).toEqual({ a: 2, m: 3, z: 1 });
  });

  it('sorts nested object keys recursively', () => {
    const input = { b: { z: 1, a: 2 }, a: 1 };
    const result = deepSortObject(input) as Record<string, unknown>;
    expect(Object.keys(result)).toEqual(['a', 'b']);
    expect(Object.keys(result.b as Record<string, unknown>)).toEqual(['a', 'z']);
  });

  it('preserves array order but sorts objects inside arrays', () => {
    const input = { arr: [{ z: 1, a: 2 }, { b: 3, a: 4 }] };
    const result = deepSortObject(input) as { arr: Record<string, unknown>[] };
    expect(Object.keys(result.arr[0])).toEqual(['a', 'z']);
    expect(Object.keys(result.arr[1])).toEqual(['a', 'b']);
  });

  it('handles null and undefined', () => {
    expect(deepSortObject(null)).toBeNull();
    expect(deepSortObject(undefined)).toBeUndefined();
  });

  it('returns primitives unchanged', () => {
    expect(deepSortObject(42)).toBe(42);
    expect(deepSortObject('hello')).toBe('hello');
    expect(deepSortObject(true)).toBe(true);
  });

  it('handles empty objects', () => {
    expect(deepSortObject({})).toEqual({});
  });
});

describe('generateKey', () => {
  it('returns prefix:hash format', () => {
    const key = generateKey('stock', { symbol: 'AAPL' });
    expect(key).toMatch(/^stock:[a-f0-9]{64}$/);
  });

  it('produces the same key regardless of property order', () => {
    const key1 = generateKey('test', { a: 1, b: 2, c: 3 });
    const key2 = generateKey('test', { c: 3, a: 1, b: 2 });
    expect(key1).toBe(key2);
  });

  it('produces different keys for different prefixes', () => {
    const key1 = generateKey('stock', { id: 1 });
    const key2 = generateKey('user', { id: 1 });
    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different params', () => {
    const key1 = generateKey('stock', { symbol: 'AAPL' });
    const key2 = generateKey('stock', { symbol: 'MSFT' });
    expect(key1).not.toBe(key2);
  });

  it('handles deeply nested objects deterministically', () => {
    const key1 = generateKey('filter', { filters: { sector: 'Tech', range: { min: 0, max: 100 } } });
    const key2 = generateKey('filter', { filters: { range: { max: 100, min: 0 }, sector: 'Tech' } });
    expect(key1).toBe(key2);
  });

  it('hash matches SHA-256 of sorted JSON', () => {
    const params = { b: 2, a: 1 };
    const sorted = deepSortObject(params);
    const expectedHash = createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
    const key = generateKey('prefix', params);
    expect(key).toBe(`prefix:${expectedHash}`);
  });
});

describe('CacheManager', () => {
  let cm: CacheManager;

  beforeEach(() => {
    cm = new CacheManager();
    jest.clearAllMocks();
  });

  // --- get ---
  describe('get', () => {
    it('returns parsed JSON on cache hit', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ name: 'AAPL' }));
      const result = await cm.get<{ name: string }>('stock:abc');
      expect(result).toEqual({ name: 'AAPL' });
    });

    it('returns null on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await cm.get('missing');
      expect(result).toBeNull();
    });

    it('returns null and logs warning on Redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('connection lost'));
      const result = await cm.get('key');
      expect(result).toBeNull();
    });
  });

  // --- set ---
  describe('set', () => {
    it('stores value with TTL using setex', async () => {
      await cm.set('key', { v: 1 }, { ttl: 60 });
      expect(mockRedis.setex).toHaveBeenCalledWith('key', 60, JSON.stringify({ v: 1 }));
    });

    it('stores value without TTL using set', async () => {
      await cm.set('key', { v: 1 });
      expect(mockRedis.set).toHaveBeenCalledWith('key', JSON.stringify({ v: 1 }));
    });

    it('does not throw on Redis error', async () => {
      mockRedis.set.mockRejectedValue(new Error('write fail'));
      await expect(cm.set('key', 'val')).resolves.toBeUndefined();
    });
  });

  // --- del ---
  describe('del', () => {
    it('deletes the key', async () => {
      await cm.del('key');
      expect(mockRedis.del).toHaveBeenCalledWith('key');
    });

    it('does not throw on Redis error', async () => {
      mockRedis.del.mockRejectedValue(new Error('del fail'));
      await expect(cm.del('key')).resolves.toBeUndefined();
    });
  });

  // --- getOrSet ---
  describe('getOrSet', () => {
    it('returns cached value without calling factory', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify('cached'));
      const factory = jest.fn();
      const result = await cm.getOrSet('key', factory);
      expect(result).toBe('cached');
      expect(factory).not.toHaveBeenCalled();
    });

    it('calls factory on miss and stores result', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      const factory = jest.fn().mockResolvedValue({ fresh: true });
      const result = await cm.getOrSet('key', factory);
      expect(result).toEqual({ fresh: true });
      expect(factory).toHaveBeenCalledTimes(1);
      expect(mockRedis.set).toHaveBeenCalled();
    });
  });

  // --- invalidatePattern ---
  describe('invalidatePattern', () => {
    it('scans and deletes matching keys', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['5', ['stock:a', 'stock:b']])
        .mockResolvedValueOnce(['0', ['stock:c']]);
      mockRedis.del.mockResolvedValue(1);

      await cm.invalidatePattern('stock:*');

      expect(mockRedis.del).toHaveBeenCalledWith('stock:a', 'stock:b');
      expect(mockRedis.del).toHaveBeenCalledWith('stock:c');
    });

    it('handles no matching keys gracefully', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);
      await expect(cm.invalidatePattern('none:*')).resolves.toBeUndefined();
    });
  });

  // --- generateKey (instance method) ---
  describe('generateKey (instance)', () => {
    it('delegates to standalone generateKey', () => {
      const standalone = generateKey('p', { x: 1 });
      const instance = cm.generateKey('p', { x: 1 });
      expect(instance).toBe(standalone);
    });
  });

  // --- getStats ---
  describe('getStats', () => {
    it('tracks hits and misses', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify('v')); // hit
      mockRedis.get.mockResolvedValueOnce(null);                // miss
      mockRedis.info.mockResolvedValue('used_memory:1024\r\n');

      await cm.get('a');
      await cm.get('b');

      const stats = await cm.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
      expect(stats.memoryUsage).toBe(1024);
    });

    it('returns 0 hitRate when no requests', async () => {
      mockRedis.info.mockResolvedValue('used_memory:0\r\n');
      const stats = await cm.getStats();
      expect(stats.hitRate).toBe(0);
    });
  });
});
