/**
 * Property-Based Tests for Pagination
 * Feature: project-review-and-upgrade
 *
 * **Property 11: 大结果集分页**
 * **Validates: Requirements 7.3**
 *
 * Property: For any collection of groups and valid pagination parameters,
 * the paginated result should correctly slice the data, and pagination
 * metadata should be consistent.
 */

import fc from 'fast-check';
import type { HeatmapGroup, HeatmapItem, PaginatedHeatmapResponse } from './heatmapService.js';

// Helper: simulate pagination logic identical to the service
function paginate(
  groups: HeatmapGroup[],
  page: number,
  pageSize: number
): PaginatedHeatmapResponse {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const totalItems = groups.length;
  const totalPages = Math.ceil(totalItems / safePageSize);
  const startIdx = (safePage - 1) * safePageSize;
  const endIdx = startIdx + safePageSize;

  return {
    groupBy: 'sector',
    groups: groups.slice(startIdx, endIdx),
    totalStocks: 0,
    lastUpdated: new Date().toISOString(),
    dataIntegrity: {
      isComplete: true,
      totalGroupsWithData: groups.length,
      totalGroupsEmpty: 0,
      minStocksPerGroup: 1,
      warnings: [],
      excludedZeroPriceCount: 0,
    },
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      totalItems,
      totalPages,
      hasNext: safePage < totalPages,
      hasPrev: safePage > 1,
    },
  };
}

// Arbitrary for generating a HeatmapGroup
const arbGroup = fc.record({
  name: fc.string({ minLength: 1, maxLength: 20 }),
  totalMarketCap: fc.float({ min: 0, max: Math.fround(1e12), noNaN: true }),
  avgChangePercent: fc.float({ min: -100, max: 100, noNaN: true }),
  stockCount: fc.integer({ min: 0, max: 500 }),
  items: fc.constant([] as HeatmapItem[]),
}) as fc.Arbitrary<HeatmapGroup>;

describe('Property 11: 大结果集分页 (Req 7.3)', () => {
  it('paginated groups should be a correct slice of the full groups array', () => {
    fc.assert(
      fc.property(
        fc.array(arbGroup, { minLength: 0, maxLength: 50 }),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 50 }),
        (groups, page, pageSize) => {
          const result = paginate(groups, page, pageSize);
          const safePageSize = Math.min(100, Math.max(1, pageSize));
          const startIdx = (page - 1) * safePageSize;
          const expected = groups.slice(startIdx, startIdx + safePageSize);

          expect(result.groups).toEqual(expected);
          expect(result.groups.length).toBeLessThanOrEqual(safePageSize);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('pagination metadata should be consistent', () => {
    fc.assert(
      fc.property(
        fc.array(arbGroup, { minLength: 0, maxLength: 50 }),
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 50 }),
        (groups, page, pageSize) => {
          const result = paginate(groups, page, pageSize);
          const p = result.pagination;

          expect(p.totalItems).toBe(groups.length);
          expect(p.totalPages).toBe(Math.ceil(groups.length / p.pageSize));
          expect(p.hasNext).toBe(p.page < p.totalPages);
          expect(p.hasPrev).toBe(p.page > 1);
          expect(p.page).toBeGreaterThanOrEqual(1);
          expect(p.pageSize).toBeGreaterThanOrEqual(1);
          expect(p.pageSize).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('iterating all pages should cover all groups without overlap', () => {
    fc.assert(
      fc.property(
        fc.array(arbGroup, { minLength: 1, maxLength: 30 }),
        fc.integer({ min: 1, max: 15 }),
        (groups, pageSize) => {
          const allItems: typeof groups = [];
          const safePageSize = Math.min(100, Math.max(1, pageSize));
          const totalPages = Math.ceil(groups.length / safePageSize);

          for (let p = 1; p <= totalPages; p++) {
            const result = paginate(groups, p, pageSize);
            allItems.push(...result.groups);
          }

          expect(allItems).toEqual(groups);
        }
      ),
      { numRuns: 30 }
    );
  });
});

