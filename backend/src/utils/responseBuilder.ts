/**
 * Response Builder Utilities
 * Requirement 10.2: Extract API response formatting logic as unified response builder
 */

/**
 * Standard success response format
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    timestamp?: string;
    requestId?: string;
    [key: string]: unknown;
  };
}

/**
 * Standard paginated response format
 */
export interface PaginatedResponse<T = unknown> extends SuccessResponse<T> {
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Build a success response
 */
export function buildSuccessResponse<T>(
  data: T,
  meta?: Record<string, unknown>
): SuccessResponse<T> {
  const response: SuccessResponse<T> = {
    success: true,
    data,
  };

  if (meta && Object.keys(meta).length > 0) {
    response.meta = {
      timestamp: new Date().toISOString(),
      ...meta,
    };
  }

  return response;
}

/**
 * Build a paginated response
 */
export function buildPaginatedResponse<T>(
  data: T,
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
  },
  meta?: Record<string, unknown>
): PaginatedResponse<T> {
  const totalPages = Math.ceil(pagination.totalItems / pagination.pageSize);

  return {
    success: true,
    data,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems: pagination.totalItems,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1,
    },
    meta: meta
      ? {
          timestamp: new Date().toISOString(),
          ...meta,
        }
      : undefined,
  };
}

/**
 * Build a list response with count
 */
export function buildListResponse<T>(
  items: T[],
  meta?: Record<string, unknown>
): SuccessResponse<T[]> {
  return buildSuccessResponse(items, {
    count: items.length,
    ...meta,
  });
}

/**
 * Build a response with additional metadata
 */
export function withMetadata<T>(
  data: T,
  metadata: Record<string, unknown>
): SuccessResponse<T> {
  return buildSuccessResponse(data, metadata);
}

