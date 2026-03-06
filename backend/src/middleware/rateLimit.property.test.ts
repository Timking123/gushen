/**
 * Property-Based Tests for Rate Limiter
 * Feature: project-review-and-upgrade
 *
 * **Property 1: 速率限制正确性**
 * **Validates: Requirements 1.2, 1.3, 1.5**
 *
 * Property: For any IP address or authenticated user, when the number of requests
 * sent within the configured time window exceeds the configured maximum, subsequent
 * requests should return 429 status code, and response headers should include
 * X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset fields.
 */

import fc from 'fast-check';
import { Request, Response, NextFunction } from 'express';
import { createRateLimiter, RateLimitConfig } from './rateLimit.js';

// --- Redis mock (in-memory store) ---
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
function mockReq(ip: string = '127.0.0.1'): Request {
  return {
    ip,
    headers: {},
    socket: { remoteAddress: ip },
  } as unknown as Request;
}

function mockAuthReq(userId: string): Request {
  return {
    ip: '127.0.0.1',
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    user: { id: userId, email: `${userId}@test.com` },
  } as unknown as Request;
}

interface MockResponse {
  statusCode: number;
  headers: Record<string, string | number>;
  setHeader: jest.Mock;
  on: jest.Mock;
}

function mockRes(): MockResponse {
  const headers: Record<string, string | number> = {};
  return {
    statusCode: 200,
    headers,
    setHeader: jest.fn((name: string, value: string | number) => {
      headers[name] = value;
    }),
    on: jest.fn(),
  };
}

/**
 * Send N requests through the limiter and return the next() call results.
 * Returns an array of { error, headers } for each request.
 */
async function sendRequests(
  limiter: ReturnType<typeof createRateLimiter>,
  count: number,
  reqFactory: () => Request
): Promise<Array<{ error: unknown; headers: Record<string, string | number> }>> {
  const results: Array<{ error: unknown; headers: Record<string, string | number> }> = [];

  for (let i = 0; i < count; i++) {
    const req = reqFactory();
    const res = mockRes();
    let capturedError: unknown = undefined;

    const next = jest.fn((err?: unknown) => {
      capturedError = err;
    });

    await limiter(req, res as unknown as Response, next as unknown as NextFunction);

    results.push({
      error: capturedError,
      headers: res.headers,
    });
  }

  return results;
}

// --- Arbitraries ---

/** Generate realistic maxRequests values (small range for fast tests) */
const maxRequestsArb = fc.integer({ min: 1, max: 50 });

/** Generate window durations in ms (10s to 120s) */
const windowMsArb = fc.integer({ min: 10_000, max: 120_000 });

/** Generate IP addresses */
const ipArb = fc.tuple(
  fc.integer({ min: 1, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 1, max: 254 })
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

/** Generate user IDs */
const userIdArb = fc.stringMatching(/^user-[a-z0-9]{4,8}$/);

/** Generate how many extra requests to send beyond the limit (1 to 10) */
const extraRequestsArb = fc.integer({ min: 1, max: 10 });

// --- Property Tests ---

describe('Property 1: 速率限制正确性', () => {
  beforeEach(() => {
    store = {};
  });

  /**
   * For any maxRequests config and any IP, sending exactly maxRequests requests
   * should all succeed, and the (maxRequests+N)th request should be rejected with 429.
   *
   * **Validates: Requirements 1.2, 1.5**
   */
  it('should return 429 for IP-based requests exceeding the limit, with correct headers', async () => {
    await fc.assert(
      fc.asyncProperty(
        maxRequestsArb,
        windowMsArb,
        ipArb,
        extraRequestsArb,
        async (maxRequests, windowMs, ip, extraRequests) => {
          // Reset store for each run
          store = {};

          const config: RateLimitConfig = { windowMs, maxRequests };
          const limiter = createRateLimiter(config);

          const totalRequests = maxRequests + extraRequests;
          const results = await sendRequests(totalRequests, () => mockReq(ip));

          // All requests within the limit should succeed (no error)
          for (let i = 0; i < maxRequests; i++) {
            expect(results[i].error).toBeUndefined();
          }

          // All requests beyond the limit should get 429
          for (let i = maxRequests; i < totalRequests; i++) {
            expect(results[i].error).toBeDefined();
            expect((results[i].error as any).statusCode).toBe(429);
          }

          // Verify headers on every response
          for (let i = 0; i < totalRequests; i++) {
            const h = results[i].headers;
            // X-RateLimit-Limit should equal the configured max
            expect(h['X-RateLimit-Limit']).toBe(maxRequests);
            // X-RateLimit-Remaining should be non-negative
            expect(h['X-RateLimit-Remaining']).toBeGreaterThanOrEqual(0);
            // X-RateLimit-Remaining should be correct
            const expectedRemaining = Math.max(0, maxRequests - (i + 1));
            expect(h['X-RateLimit-Remaining']).toBe(expectedRemaining);
            // X-RateLimit-Reset should be a positive number (unix timestamp)
            expect(typeof h['X-RateLimit-Reset']).toBe('number');
            expect(h['X-RateLimit-Reset']).toBeGreaterThan(0);
          }

          // Helper used inside the property
          async function sendRequests(
            count: number,
            reqFactory: () => Request
          ): Promise<Array<{ error: unknown; headers: Record<string, string | number> }>> {
            const res: Array<{ error: unknown; headers: Record<string, string | number> }> = [];
            for (let j = 0; j < count; j++) {
              const req = reqFactory();
              const response = mockRes();
              let capturedError: unknown = undefined;
              const next = jest.fn((err?: unknown) => { capturedError = err; });
              await limiter(req, response as unknown as Response, next as unknown as NextFunction);
              res.push({ error: capturedError, headers: response.headers });
            }
            return res;
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * For any maxRequests config and any authenticated user, sending more than
   * maxRequests requests should result in 429 with correct headers.
   *
   * **Validates: Requirements 1.3, 1.5**
   */
  it('should return 429 for authenticated user requests exceeding the limit, with correct headers', async () => {
    await fc.assert(
      fc.asyncProperty(
        maxRequestsArb,
        windowMsArb,
        userIdArb,
        extraRequestsArb,
        async (maxRequests, windowMs, userId, extraRequests) => {
          store = {};

          const config: RateLimitConfig = {
            windowMs,
            maxRequests,
            keyGenerator: (req: Request) => {
              const authReq = req as any;
              return authReq.user?.id ? `user:${authReq.user.id}` : `ip:${req.ip}`;
            },
          };
          const limiter = createRateLimiter(config);

          const totalRequests = maxRequests + extraRequests;
          const results: Array<{ error: unknown; headers: Record<string, string | number> }> = [];

          for (let j = 0; j < totalRequests; j++) {
            const req = mockAuthReq(userId);
            const response = mockRes();
            let capturedError: unknown = undefined;
            const next = jest.fn((err?: unknown) => { capturedError = err; });
            await limiter(req, response as unknown as Response, next as unknown as NextFunction);
            results.push({ error: capturedError, headers: response.headers });
          }

          // Requests within limit should succeed
          for (let i = 0; i < maxRequests; i++) {
            expect(results[i].error).toBeUndefined();
          }

          // Requests beyond limit should get 429
          for (let i = maxRequests; i < totalRequests; i++) {
            expect(results[i].error).toBeDefined();
            expect((results[i].error as any).statusCode).toBe(429);
          }

          // All responses should have the required rate limit headers
          for (let i = 0; i < totalRequests; i++) {
            const h = results[i].headers;
            expect(h['X-RateLimit-Limit']).toBe(maxRequests);
            expect(h['X-RateLimit-Remaining']).toBeGreaterThanOrEqual(0);
            expect(typeof h['X-RateLimit-Reset']).toBe('number');
            expect(h['X-RateLimit-Reset']).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Different clients (different IPs or different user IDs) should have
   * independent rate limit counters — one client hitting the limit should
   * not affect another.
   *
   * **Validates: Requirements 1.2, 1.3**
   */
  it('should isolate rate limits between different clients', async () => {
    await fc.assert(
      fc.asyncProperty(
        maxRequestsArb,
        windowMsArb,
        fc.tuple(ipArb, ipArb).filter(([a, b]) => a !== b),
        async (maxRequests, windowMs, [ip1, ip2]) => {
          store = {};

          const config: RateLimitConfig = { windowMs, maxRequests };
          const limiter = createRateLimiter(config);

          // Exhaust ip1's limit
          for (let j = 0; j < maxRequests; j++) {
            const req = mockReq(ip1);
            const res = mockRes();
            const next = jest.fn();
            await limiter(req, res as unknown as Response, next as unknown as NextFunction);
          }

          // ip1's next request should be rejected
          const res1 = mockRes();
          let error1: unknown = undefined;
          const next1 = jest.fn((err?: unknown) => { error1 = err; });
          await limiter(mockReq(ip1), res1 as unknown as Response, next1 as unknown as NextFunction);
          expect(error1).toBeDefined();
          expect((error1 as any).statusCode).toBe(429);

          // ip2 should still be allowed
          const res2 = mockRes();
          let error2: unknown = undefined;
          const next2 = jest.fn((err?: unknown) => { error2 = err; });
          await limiter(mockReq(ip2), res2 as unknown as Response, next2 as unknown as NextFunction);
          expect(error2).toBeUndefined();
          expect(res2.headers['X-RateLimit-Remaining']).toBe(maxRequests - 1);
        }
      ),
      { numRuns: 20 }
    );
  });
});
