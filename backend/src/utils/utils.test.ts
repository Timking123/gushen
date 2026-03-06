/**
 * Quick tests for utility functions
 */

import { describe, it, expect } from '@jest/globals';
import { withCache, invalidateCache } from '../utils/cacheHelpers.js';
import { buildSuccessResponse, buildPaginatedResponse } from '../utils/responseBuilder.js';
import { validatePagination, validateRange, validateEmail } from '../utils/validators.js';

describe('Utility Functions Quick Tests', () => {
  describe('cacheHelpers', () => {
    it('withCache should call fetchFn when skipCache is true', async () => {
      let called = false;
      const fetchFn = async () => {
        called = true;
        return 'data';
      };

      const result = await withCache('test-key', 60, fetchFn, { skipCache: true });
      
      expect(called).toBe(true);
      expect(result).toBe('data');
    });
  });

  describe('responseBuilder', () => {
    it('buildSuccessResponse should return correct format', () => {
      const response = buildSuccessResponse({ id: 1, name: 'test' });
      
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ id: 1, name: 'test' });
    });

    it('buildPaginatedResponse should include pagination metadata', () => {
      const response = buildPaginatedResponse(
        [{ id: 1 }, { id: 2 }],
        { page: 1, pageSize: 10, totalItems: 25 }
      );
      
      expect(response.success).toBe(true);
      expect(response.pagination.page).toBe(1);
      expect(response.pagination.totalPages).toBe(3);
      expect(response.pagination.hasNext).toBe(true);
      expect(response.pagination.hasPrev).toBe(false);
    });
  });

  describe('validators', () => {
    it('validatePagination should normalize values', () => {
      const result = validatePagination(0, 200);
      
      expect(result.page).toBe(1); // Min is 1
      expect(result.pageSize).toBe(100); // Max is 100
    });

    it('validateRange should throw on invalid range', () => {
      expect(() => validateRange(150, 0, 100, 'value')).toThrow('value must be between 0 and 100');
    });

    it('validateEmail should accept valid email', () => {
      expect(() => validateEmail('test@example.com')).not.toThrow();
    });

    it('validateEmail should reject invalid email', () => {
      expect(() => validateEmail('invalid-email')).toThrow('Invalid email format');
    });
  });
});

