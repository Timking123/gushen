import { Request, Response, NextFunction } from 'express';
import { createRateLimiter, authenticatedKeyGenerator, RateLimitConfig } from './rateLimit.js';

// --- Redis mock ---
let store: Record<string, { value: number; ttl: number }> = {};

jest.mock('../lib/redis.js', () => ({
  getRedisClient: () => ({
    incr: jest.fn(async (key: string) => {
      if (!store[key]) store[key] = { value: 0, ttl: -1 };
      store[key].value += 1;
      return store[key].value;
    }),
    expire: jest.fn(async (key: string, seconds: number) => {
      if (store[key]) store[key].ttl = seconds;
    }),
    ttl: jest.fn(async (key: string) => store[key]?.ttl ?? -2),
    decr: jest.fn(async (key: string) => {
      if (store[key]) store[key].value -= 1;
      return store[key]?.value ?? 0;
    }),
  }),
}));

jest.mock('../utils/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// --- Helpers ---
function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    ip: '127.0.0.1',
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {
    statusCode: 200,
    setHeader: jest.fn().mockReturnThis(),
    on: jest.fn(),
  };
  return res as Response;
}

// --- Tests ---
describe('createRateLimiter', () => {
  const baseConfig: RateLimitConfig = { windowMs: 60_000, maxRequests: 3 };

  beforeEach(() => {
    store = {};
  });

  it('allows requests under the limit', async () => {
    const limiter = createRateLimiter(baseConfig);
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await limiter(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 3);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 2);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
  });

  it('returns 429 when limit is exceeded', async () => {
    const limiter = createRateLimiter(baseConfig);
    const next = jest.fn();

    // Send maxRequests + 1 requests
    for (let i = 0; i < baseConfig.maxRequests; i++) {
      await limiter(mockReq(), mockRes(), jest.fn());
    }

    const res = mockRes();
    await limiter(mockReq(), res, next);

    // next should be called with a TooManyRequestsError
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 429 })
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
  });

  it('sets remaining to 0 at the limit boundary', async () => {
    const limiter = createRateLimiter(baseConfig);
    const res = mockRes();
    const next = jest.fn();

    // Send exactly maxRequests
    for (let i = 0; i < baseConfig.maxRequests - 1; i++) {
      await limiter(mockReq(), mockRes(), jest.fn());
    }
    await limiter(mockReq(), res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
  });

  it('uses custom keyGenerator when provided', async () => {
    const customKey = jest.fn(() => 'custom:key');
    const limiter = createRateLimiter({ ...baseConfig, keyGenerator: customKey });

    await limiter(mockReq(), mockRes(), jest.fn());

    expect(customKey).toHaveBeenCalled();
    expect(store['ratelimit:custom:key']).toBeDefined();
  });

  it('isolates different IPs into separate buckets', async () => {
    const limiter = createRateLimiter({ ...baseConfig, maxRequests: 1 });

    const next1 = jest.fn();
    const next2 = jest.fn();

    await limiter(mockReq({ ip: '1.1.1.1' }), mockRes(), next1);
    await limiter(mockReq({ ip: '2.2.2.2' }), mockRes(), next2);

    // Both should succeed since they are different IPs
    expect(next1).toHaveBeenCalledWith();
    expect(next2).toHaveBeenCalledWith();
  });
});

describe('authenticatedKeyGenerator', () => {
  it('returns user-based key for authenticated requests', () => {
    const req = mockReq() as any;
    req.user = { id: 'user-123', email: 'test@test.com' };

    expect(authenticatedKeyGenerator(req)).toBe('user:user-123');
  });

  it('falls back to IP-based key for unauthenticated requests', () => {
    const req = mockReq({ ip: '10.0.0.1' });

    expect(authenticatedKeyGenerator(req)).toBe('ip:10.0.0.1');
  });
});
