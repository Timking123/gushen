/**
 * Property-Based Tests for Error Handler
 * Feature: project-review-and-upgrade
 *
 * **Property 8: 统一错误响应格式**
 * **Property 9: 缓存失败容错**
 * **Property 10: 内部错误信息隐藏**
 * **Validates: Requirements 6.1, 6.2, 6.4, 6.5, 6.6**
 */

import fc from 'fast-check';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import {
  errorHandler,
  requestIdMiddleware,
  withCacheFallback,
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
} from './errorHandler.js';

jest.mock('../utils/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

function createTestApp(throwError: (req: Request, res: Response, next: NextFunction) => void) {
  const app = express();
  app.use(requestIdMiddleware);
  app.get('/test', throwError);
  app.use(errorHandler);
  return app;
}

describe('Property 8: 统一错误响应格式 (Req 6.1, 6.2, 6.5)', () => {
  const errorClasses = [
    { Cls: BadRequestError, status: 400, code: 'BAD_REQUEST' },
    { Cls: UnauthorizedError, status: 401, code: 'UNAUTHORIZED' },
    { Cls: ForbiddenError, status: 403, code: 'FORBIDDEN' },
    { Cls: NotFoundError, status: 404, code: 'NOT_FOUND' },
    { Cls: TooManyRequestsError, status: 429, code: 'TOO_MANY_REQUESTS' },
  ];

  it('should always return unified format with success, error.code, error.message, error.timestamp, error.requestId for any AppError', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.integer({ min: 0, max: errorClasses.length - 1 }),
        async (msg: string, idx: number) => {
          const { Cls, status, code } = errorClasses[idx];
          const app = createTestApp((_req, _res, next) => next(new Cls(msg)));
          const res = await request(app).get('/test');

          expect(res.status).toBe(status);
          expect(res.body.success).toBe(false);
          expect(res.body.error).toBeDefined();
          expect(res.body.error.code).toBe(code);
          expect(res.body.error.message).toBe(msg);
          expect(typeof res.body.error.timestamp).toBe('string');
          expect(typeof res.body.error.requestId).toBe('string');
          // timestamp should be valid ISO
          expect(new Date(res.body.error.timestamp).toISOString()).toBe(res.body.error.timestamp);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should distinguish 4xx from 5xx correctly for any status code', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 400, max: 499 }),
        async (statusCode) => {
          const app = createTestApp((_req, _res, next) =>
            next(new AppError('client error', statusCode, 'CLIENT_ERR'))
          );
          const res = await request(app).get('/test');
          expect(res.status).toBe(statusCode);
          expect(res.body.error.message).toBe('client error');
        }
      ),
      { numRuns: 15 }
    );
  });
});

describe('Property 9: 缓存失败容错 (Req 6.4)', () => {
  it('should always return fallback value when cache operation throws any error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.anything(),
        async (errorMsg, fallbackVal) => {
          const result = await withCacheFallback(
            () => Promise.reject(new Error(errorMsg)),
            fallbackVal,
            'test-context'
          );
          expect(result).toEqual(fallbackVal);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should return successful result when cache operation succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.anything(),
        async (value) => {
          const result = await withCacheFallback(
            () => Promise.resolve(value),
            'fallback'
          );
          expect(result).toEqual(value);
        }
      ),
      { numRuns: 30 }
    );
  });
});

describe('Property 10: 内部错误信息隐藏 (Req 6.6)', () => {
  const sensitiveMessages = [
    'ECONNREFUSED 127.0.0.1:5432',
    'SELECT * FROM users WHERE id = 1',
    'at Object.<anonymous> (/app/src/index.ts:10:5)',
    'ENOTFOUND database.internal',
    'INSERT INTO logs VALUES (1)',
    '/var/app/src/secret.ts',
  ];

  it('should never expose sensitive information in 5xx error responses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: sensitiveMessages.length - 1 }),
        async (idx) => {
          const sensitiveMsg = sensitiveMessages[idx];
          const app = createTestApp((_req, _res, next) =>
            next(new Error(sensitiveMsg))
          );
          const res = await request(app).get('/test');

          expect(res.status).toBe(500);
          expect(res.body.error.message).toBe('Internal server error');
          expect(res.body.error.code).toBe('INTERNAL_ERROR');
          // The response body should not contain any of the sensitive content
          const bodyStr = JSON.stringify(res.body);
          expect(bodyStr).not.toContain('ECONNREFUSED');
          expect(bodyStr).not.toContain('SELECT');
          expect(bodyStr).not.toContain('INSERT');
          expect(bodyStr).not.toContain('/var/app');
          expect(bodyStr).not.toContain('ENOTFOUND');
        }
      ),
      { numRuns: 10 }
    );
  });
});

