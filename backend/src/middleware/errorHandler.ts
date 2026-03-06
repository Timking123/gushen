import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

// Unified error response format (Requirements 6.1)
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
    requestId: string;
  };
}

// Custom error class for API errors
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error types
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', details?: Record<string, unknown>) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', details?: Record<string, unknown>) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', details?: Record<string, unknown>) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', details?: Record<string, unknown>) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', details?: Record<string, unknown>) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class ValidationError extends AppError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string = 'Validation failed', errors: Record<string, string[]> = {}) {
    super(message, 422, 'VALIDATION_ERROR', { errors });
    this.errors = errors;
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests', details?: Record<string, unknown>) {
    super(message, 429, 'TOO_MANY_REQUESTS', details);
  }
}

// Sensitive patterns to strip from error messages for 5xx responses (Requirement 6.6)
const SENSITIVE_PATTERNS = [
  /at\s+\S+\s+\(.*:\d+:\d+\)/gi,  // stack trace lines
  /\/[\w./\\-]+\.\w+/g,             // file paths
  /SELECT\s+|INSERT\s+|UPDATE\s+|DELETE\s+|FROM\s+|WHERE\s+/gi, // SQL fragments
  /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/gi, // internal network errors
];

function containsSensitiveInfo(message: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(message);
  });
}

/**
 * Middleware to attach a unique requestId to each incoming request.
 * The requestId is used in error responses and logging for traceability.
 */
export const requestIdMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  // Use client-provided X-Request-ID if present, otherwise generate one
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  (req as RequestWithId).requestId = requestId;
  next();
};

/** Extended Request type with requestId */
export interface RequestWithId extends Request {
  requestId: string;
}

/**
 * Build a unified ErrorResponse object.
 */
function buildErrorResponse(
  code: string,
  message: string,
  requestId: string,
  details?: Record<string, unknown>
): ErrorResponse {
  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
  if (details && Object.keys(details).length > 0) {
    response.error.details = details;
  }
  return response;
}

/**
 * Global error handler middleware (Requirements 6.1–6.6).
 *
 * - Returns unified error response format with code, message, details, timestamp, requestId
 * - Logs all errors with request context (method, url, requestId) (Req 6.3)
 * - Distinguishes client errors (4xx) from server errors (5xx) (Req 6.5)
 * - Hides internal details for 5xx errors (Req 6.6)
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = (req as RequestWithId).requestId || randomUUID();

  // Determine status code and error info
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_ERROR';
  const isServerError = statusCode >= 500;

  // Log all errors with request context (Requirement 6.3)
  const logContext = {
    requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    statusCode,
    code,
  };

  if (isServerError) {
    // Log full error details for server errors (including stack)
    logger.error('Server error', { ...logContext, stack: err.stack, message: err.message });
  } else if (isAppError && err.isOperational) {
    logger.warn(`Client error: ${err.message}`, logContext);
  } else {
    logger.error('Unexpected error', { ...logContext, stack: err.stack, message: err.message });
  }

  // Build response — hide internal details for 5xx (Requirement 6.6)
  let message: string;
  let details: Record<string, unknown> | undefined;

  if (isServerError) {
    // Never expose internal error details to the client
    message = 'Internal server error';
    details = undefined;
  } else if (isAppError) {
    message = err.message;
    details = err.details;
  } else {
    // Non-AppError that somehow isn't 5xx — still sanitize
    message = containsSensitiveInfo(err.message) ? 'An error occurred' : err.message;
    details = undefined;
  }

  const response = buildErrorResponse(code, message, requestId, details);
  res.status(statusCode).json(response);
};

/**
 * Cache-fault-tolerant wrapper (Requirement 6.4).
 * Wraps a cache operation so that failures are logged as warnings
 * but do not interrupt request processing.
 */
export async function withCacheFallback<T>(
  operation: () => Promise<T>,
  fallback: T,
  context?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.warn(`Cache operation failed${context ? ` (${context})` : ''}, continuing without cache`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

// 404 handler for undefined routes
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
};
