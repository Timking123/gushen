import express, { Express, Request, Response, NextFunction } from 'express';
import request from 'supertest';
import {
  errorHandler,
  notFoundHandler,
  requestIdMiddleware,
  withCacheFallback,
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
  RequestWithId,
} from './errorHandler.js';

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { logger } from '../utils/logger.js';

describe('Error Handler Middleware', () => {
  let app: Express;

  function createApp(throwError: (req: Request, res: Response, next: NextFunction) => void) {
    app = express();
    app.use(express.json());
    app.use(requestIdMiddleware);
    app.get('/test', throwError);
    app.use(errorHandler);
    return app;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Unified error response format (Req 6.1)', () => {
    it('should return success: false, error.code, error.message, error.timestamp, error.requestId', async () => {
      const app = createApp((_req, _res, next) => {
        next(new BadRequestError('Invalid input'));
      });

      const res = await request(app).get('/test');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toBe('Invalid input');
      expect(res.body.error.timestamp).toBeDefined();
      expect(res.body.error.requestId).toBeDefined();
      // timestamp should be a valid ISO string
      expect(() => new Date(res.body.error.timestamp)).not.toThrow();
      expect(new Date(res.body.error.timestamp).toISOString()).toBe(res.body.error.timestamp);
    });
  });

  describe('HTTP status codes (Req 6.2, 6.5)', () => {
    it.each([
      { ErrorClass: BadRequestError, expectedStatus: 400, expectedCode: 'BAD_REQUEST' },
      { ErrorClass: UnauthorizedError, expectedStatus: 401, expectedCode: 'UNAUTHORIZED' },
      { ErrorClass: ForbiddenError, expectedStatus: 403, expectedCode: 'FORBIDDEN' },
      { ErrorClass: NotFoundError, expectedStatus: 404, expectedCode: 'NOT_FOUND' },
      { ErrorClass: ConflictError, expectedStatus: 409, expectedCode: 'CONFLICT' },
      { ErrorClass: ValidationError, expectedStatus: 422, expectedCode: 'VALIDATION_ERROR' },
      { ErrorClass: TooManyRequestsError, expectedStatus: 429, expectedCode: 'TOO_MANY_REQUESTS' },
    ])('$ErrorClass.name should return $expectedStatus', async ({ ErrorClass, expectedStatus, expectedCode }) => {
      const app = createApp((_req, _res, next) => {
        next(new ErrorClass());
      });

      const res = await request(app).get('/test');

      expect(res.status).toBe(expectedStatus);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(expectedCode);
    });
  });

  describe('Error logging with request context (Req 6.3)', () => {
    it('should log client errors as warnings with request context', async () => {
      const app = createApp((_req, _res, next) => {
        next(new BadRequestError('bad input'));
      });

      await request(app).get('/test?foo=bar');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('bad input'),
        expect.objectContaining({
          requestId: expect.any(String),
          method: 'GET',
          url: '/test?foo=bar',
          statusCode: 400,
          code: 'BAD_REQUEST',
        })
      );
    });

    it('should log server errors with full details', async () => {
      const app = createApp((_req, _res, next) => {
        next(new Error('DB connection failed'));
      });

      await request(app).get('/test');

      expect(logger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          requestId: expect.any(String),
          method: 'GET',
          statusCode: 500,
        })
      );
    });
  });

  describe('5xx error detail hiding (Req 6.6)', () => {
    it('should not expose internal error message for unexpected errors', async () => {
      const app = createApp((_req, _res, next) => {
        next(new Error('ECONNREFUSED 127.0.0.1:5432 - PostgreSQL connection failed'));
      });

      const res = await request(app).get('/test');

      expect(res.status).toBe(500);
      expect(res.body.error.message).toBe('Internal server error');
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
      // Should NOT contain any sensitive info
      expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
      expect(JSON.stringify(res.body)).not.toContain('PostgreSQL');
      expect(JSON.stringify(res.body)).not.toContain('5432');
    });

    it('should not expose stack traces for 5xx AppErrors', async () => {
      const app = createApp((_req, _res, next) => {
        next(new AppError('Something broke internally', 500, 'INTERNAL_ERROR'));
      });

      const res = await request(app).get('/test');

      expect(res.status).toBe(500);
      expect(res.body.error.message).toBe('Internal server error');
      expect(res.body.error.details).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('errorHandler.ts');
    });

    it('should include details for 4xx errors', async () => {
      const app = createApp((_req, _res, next) => {
        next(new BadRequestError('Missing field', { field: 'email' }));
      });

      const res = await request(app).get('/test');

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Missing field');
      expect(res.body.error.details).toEqual({ field: 'email' });
    });

    it('should include validation errors in details for ValidationError', async () => {
      const app = createApp((_req, _res, next) => {
        next(new ValidationError('Validation failed', { email: ['required'] }));
      });

      const res = await request(app).get('/test');

      expect(res.status).toBe(422);
      expect(res.body.error.details).toEqual({ errors: { email: ['required'] } });
    });
  });

  describe('Request ID (Req 6.1)', () => {
    it('should generate a unique requestId for each request', async () => {
      const app = createApp((_req, _res, next) => {
        next(new BadRequestError('test'));
      });

      const res1 = await request(app).get('/test');
      const res2 = await request(app).get('/test');

      expect(res1.body.error.requestId).toBeDefined();
      expect(res2.body.error.requestId).toBeDefined();
      expect(res1.body.error.requestId).not.toBe(res2.body.error.requestId);
    });

    it('should use client-provided X-Request-ID if present', async () => {
      const app = createApp((_req, _res, next) => {
        next(new BadRequestError('test'));
      });

      const res = await request(app)
        .get('/test')
        .set('X-Request-ID', 'custom-request-id-123');

      expect(res.body.error.requestId).toBe('custom-request-id-123');
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 with unified format for undefined routes', async () => {
      const app = express();
      app.use(requestIdMiddleware);
      app.use(notFoundHandler);
      app.use(errorHandler);

      const res = await request(app).get('/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toContain('/nonexistent');
      expect(res.body.error.requestId).toBeDefined();
      expect(res.body.error.timestamp).toBeDefined();
    });
  });

  describe('AppError class', () => {
    it('should support details parameter', () => {
      const err = new AppError('test', 400, 'TEST', { key: 'value' });
      expect(err.details).toEqual({ key: 'value' });
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('TEST');
      expect(err.message).toBe('test');
      expect(err.isOperational).toBe(true);
    });

    it('should default to 500 INTERNAL_ERROR', () => {
      const err = new AppError('oops');
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe('INTERNAL_ERROR');
    });
  });
});

describe('withCacheFallback (Req 6.4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return the result of a successful cache operation', async () => {
    const result = await withCacheFallback(() => Promise.resolve('cached-data'), 'fallback');
    expect(result).toBe('cached-data');
  });

  it('should return fallback and log warning when cache operation fails', async () => {
    const result = await withCacheFallback(
      () => Promise.reject(new Error('Redis connection lost')),
      'fallback-value',
      'get user data'
    );

    expect(result).toBe('fallback-value');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Cache operation failed'),
      expect.objectContaining({
        error: 'Redis connection lost',
      })
    );
  });

  it('should return fallback value of correct type', async () => {
    const fallback = { items: [], total: 0 };
    const result = await withCacheFallback(
      () => Promise.reject(new Error('timeout')),
      fallback
    );
    expect(result).toEqual(fallback);
  });

  it('should not throw even when cache throws synchronously', async () => {
    const result = await withCacheFallback(
      () => { throw new Error('sync error'); },
      null
    );
    expect(result).toBeNull();
  });
});

describe('requestIdMiddleware', () => {
  it('should attach requestId to the request object', async () => {
    let capturedRequestId: string | undefined;

    const app = express();
    app.use(requestIdMiddleware);
    app.get('/test', (req: Request, res: Response) => {
      capturedRequestId = (req as RequestWithId).requestId;
      res.json({ ok: true });
    });

    await request(app).get('/test');

    expect(capturedRequestId).toBeDefined();
    // Should be a valid UUID format
    expect(capturedRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('should use X-Request-ID header when provided', async () => {
    let capturedRequestId: string | undefined;

    const app = express();
    app.use(requestIdMiddleware);
    app.get('/test', (req: Request, res: Response) => {
      capturedRequestId = (req as RequestWithId).requestId;
      res.json({ ok: true });
    });

    await request(app).get('/test').set('X-Request-ID', 'my-custom-id');

    expect(capturedRequestId).toBe('my-custom-id');
  });
});
