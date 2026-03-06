/**
 * Response Optimization Middleware
 * Requirements 14.1, 14.2, 14.3, 14.4, 14.5
 */

import compression from 'compression';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Compression middleware (Requirement 14.1)
 * Supports gzip and brotli compression
 */
export const compressionMiddleware = compression({
  filter: (req: Request, res: Response) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6, // Compression level (0-9)
});

/**
 * CDN Cache headers middleware (Requirement 14.2)
 */
export const cacheHeadersMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Set cache headers for static resources
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  // Set cache headers for API responses
  else if (req.path.startsWith('/api/')) {
    // Different cache strategies for different endpoints
    if (req.path.includes('/quotes') || req.path.includes('/heatmap')) {
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    } else if (req.path.includes('/stocks') || req.path.includes('/sectors')) {
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    } else {
      res.setHeader('Cache-Control', 'private, no-cache');
    }
  }
  next();
};

/**
 * ETag generation and conditional request support (Requirement 14.3, 14.4)
 */
export const etagMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const originalSend = res.send;

  res.send = function (body: any): Response {
    // Only apply ETag for successful GET requests
    if (req.method === 'GET' && res.statusCode === 200) {
      // Generate ETag from response body
      const etag = generateETag(body);
      res.setHeader('ETag', etag);

      // Check If-None-Match header for conditional request (Requirement 14.3)
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        // Return 304 Not Modified (Requirement 14.4)
        res.status(304);
        return originalSend.call(this, '');
      }

      // Check If-Modified-Since header
      const lastModified = res.getHeader('Last-Modified');
      if (lastModified) {
        const ifModifiedSince = req.headers['if-modified-since'];
        if (ifModifiedSince && new Date(ifModifiedSince) >= new Date(lastModified as string)) {
          res.status(304);
          return originalSend.call(this, '');
        }
      }
    }

    return originalSend.call(this, body);
  };

  next();
};

/**
 * Generate ETag from content
 */
function generateETag(content: any): string {
  const hash = crypto.createHash('md5');
  const data = typeof content === 'string' ? content : JSON.stringify(content);
  hash.update(data);
  return `"${hash.digest('hex')}"`;
}

/**
 * Field selection middleware (Requirement 14.5)
 * Allows clients to request only specific fields
 */
export const fieldSelectionMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const originalJson = res.json;

  res.json = function (body: any): Response {
    // Check for fields query parameter
    const fields = req.query.fields as string | undefined;

    if (fields && body && typeof body === 'object') {
      const selectedFields = fields.split(',').map((f) => f.trim());
      const filteredBody = selectFields(body, selectedFields);
      return originalJson.call(this, filteredBody);
    }

    return originalJson.call(this, body);
  };

  next();
};

/**
 * Select specific fields from an object or array
 */
function selectFields(data: any, fields: string[]): any {
  if (Array.isArray(data)) {
    return data.map((item) => selectFields(item, fields));
  }

  if (data && typeof data === 'object') {
    const result: any = {};

    // Handle nested data structure
    if (data.success !== undefined && data.data !== undefined) {
      result.success = data.success;
      result.data = selectFields(data.data, fields);
      if (data.meta) result.meta = data.meta;
      if (data.pagination) result.pagination = data.pagination;
      return result;
    }

    // Select specified fields
    for (const field of fields) {
      if (field in data) {
        result[field] = data[field];
      }
    }

    return result;
  }

  return data;
}

