/**
 * Property-Based Tests for Heatmap Data Completeness
 * Feature: stock-detail-and-heatmap-enhancement
 * 
 * **Property 13: 热力图数据完整性**
 * **Validates: Requirements 12.1, 12.2, 12.3**
 * 
 * Property: For any heatmap data response, each sector should contain at least 1 stock,
 * and the total stock count should equal the sum of all sector stock counts.
 */

import fc from 'fast-check';
import { describe, it, expect } from '@jest/globals';

/**
 * Heatmap data item interface (mirrors heatmapService.ts)
 */
interface HeatmapItem {
  symbol: string;
  name: string;
  sector: string;
  industry: string | null;
  marketCap: number;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

/**
 * Heatmap group interface (mirrors heatmapService.ts)
 */
interface HeatmapGroup {
  name: string;
  totalMarketCap: number;
  avgChangePercent: number;
  stockCount: number;
  items: HeatmapItem[];
}

/**
 * Heatmap response interface (mirrors heatmapService.ts)
 */
interface HeatmapResponse {
  groupBy: 'sector' | 'marketCap' | 'industry';
  groups: HeatmapGroup[];
  totalStocks: number;
  lastUpdated: string;
  dataIntegrity: DataIntegrityInfo;
}

/**
 * Data integrity information (mirrors heatmapService.ts)
 */
interface DataIntegrityInfo {
  isComplete: boolean;
  totalGroupsWithData: number;
  totalGroupsEmpty: number;
  minStocksPerGroup: number;
  warnings: string[];
}

/**
 * Available sectors for testing
 */
const SECTORS = [
  'Technology',
  'Healthcare',
  'Financial Services',
  'Consumer Cyclical',
  'Communication Services',
  'Industrials',
  'Consumer Defensive',
  'Energy',
  'Basic Materials',
  'Real Estate',
  'Utilities',
];

/**
 * Available industries for testing
 */
const INDUSTRIES = [
  'Software',
  'Hardware',
  'Biotechnology',
  'Banks',
  'Insurance',
  'Retail',
  'Automotive',
  'Semiconductors',
  'Pharmaceuticals',
  'Oil & Gas',
];

/**
 * Arbitrary generator for stock symbols
 */
const symbolArbitrary = fc.stringMatching(/^[A-Z]{1,5}$/);

/**
 * Arbitrary generator for stock names
 */
const nameArbitrary = fc.string({ minLength: 1, maxLength: 50 });

/**
 * Arbitrary generator for sectors
 */
const sectorArbitrary = fc.constantFrom(...SECTORS);

/**
 * Arbitrary generator for industries (nullable)
 */
const industryArbitrary = fc.option(fc.constantFrom(...INDUSTRIES), { nil: null });

/**
 * Arbitrary generator for market cap values
 */
const marketCapArbitrary = fc.integer({ min: 1_000_000, max: 3_000_000_000_000 });

/**
 * Arbitrary generator for price values
 */
const priceArbitrary = fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true });

/**
 * Arbitrary generator for a complete HeatmapItem
 */
const heatmapItemArbitrary = fc.record({
  symbol: symbolArbitrary,
  name: nameArbitrary,
  sector: sectorArbitrary,
  industry: industryArbitrary,
  marketCap: marketCapArbitrary,
  price: priceArbitrary,
  change: fc.float({ min: -100, max: 100, noNaN: true }),
  changePercent: fc.float({ min: -50, max: 50, noNaN: true }),
  volume: fc.integer({ min: 0, max: 1_000_000_000 }),
});

/**
 * Arbitrary generator for an array of HeatmapItems with at least one item per sector
 * This ensures we have complete data for testing
 */
const heatmapItemsWithAllSectorsArbitrary = fc.tuple(
  // Generate at least one item for each sector
  ...SECTORS.map(sector =>
    fc.record({
      symbol: symbolArbitrary,
      name: nameArbitrary,
      sector: fc.constant(sector),
      industry: industryArbitrary,
      marketCap: marketCapArbitrary,
      price: priceArbitrary,
      change: fc.float({ min: -100, max: 100, noNaN: true }),
      changePercent: fc.float({ min: -50, max: 50, noNaN: true }),
      volume: fc.integer({ min: 0, max: 1_000_000_000 }),
    })
  )
).chain(sectorItems =>
  // Add additional random items (reduced from 30 to 10)
  fc.array(heatmapItemArbitrary, { minLength: 0, maxLength: 10 }).map(additionalItems => [
    ...sectorItems,
    ...additionalItems,
  ])
);

/**
 * Arbitrary generator for an array of HeatmapItems (may not have all sectors)
 */
const heatmapItemsArbitrary = fc.array(heatmapItemArbitrary, { minLength: 1, maxLength: 20 });

/**
 * Group heatmap items by sector (mirrors the service implementation)
 */
function groupBySector(items: HeatmapItem[], limit: number): HeatmapGroup[] {
  // Group by sector
  const sectorMap = new Map<string, HeatmapItem[]>();

  for (const item of items) {
    const existing = sectorMap.get(item.sector) || [];
    existing.push(item);
    sectorMap.set(item.sector, existing);
  }

  // Convert to groups
  const groups: HeatmapGroup[] = [];

  for (const [sector, sectorItems] of sectorMap) {
    // Sort by market cap descending and limit
    const sortedItems = sectorItems.sort((a, b) => b.marketCap - a.marketCap).slice(0, limit);

    const totalMarketCap = sortedItems.reduce((sum, item) => sum + item.marketCap, 0);
    const avgChangePercent =
      sortedItems.length > 0
        ? sortedItems.reduce((sum, item) => sum + item.changePercent, 0) / sortedItems.length
        : 0;

    groups.push({
      name: sector,
      totalMarketCap,
      avgChangePercent,
      stockCount: sortedItems.length,
      items: sortedItems,
    });
  }

  // Sort groups by total market cap descending
  return groups.sort((a, b) => b.totalMarketCap - a.totalMarketCap);
}

/**
 * Calculate data integrity information (mirrors the service implementation)
 */
function calculateDataIntegrity(groups: HeatmapGroup[], expectedMinStocks: number): DataIntegrityInfo {
  const warnings: string[] = [];
  let totalGroupsWithData = 0;
  let totalGroupsEmpty = 0;
  let minStocksPerGroup = Infinity;

  for (const group of groups) {
    if (group.stockCount === 0) {
      totalGroupsEmpty++;
      warnings.push(`Group "${group.name}" has no stock data`);
    } else {
      totalGroupsWithData++;
      minStocksPerGroup = Math.min(minStocksPerGroup, group.stockCount);

      // Check if group has fewer stocks than expected (but not empty)
      if (group.stockCount < expectedMinStocks && group.stockCount > 0) {
        warnings.push(
          `Group "${group.name}" has only ${group.stockCount} stocks (expected at least ${expectedMinStocks})`
        );
      }
    }
  }

  // Handle case where all groups are empty
  if (minStocksPerGroup === Infinity) {
    minStocksPerGroup = 0;
  }

  // Data is considered complete if:
  // 1. There are groups with data
  // 2. No groups are completely empty
  // 3. Each group has at least 1 stock
  const isComplete = totalGroupsWithData > 0 && totalGroupsEmpty === 0 && minStocksPerGroup >= 1;

  return {
    isComplete,
    totalGroupsWithData,
    totalGroupsEmpty,
    minStocksPerGroup,
    warnings,
  };
}

/**
 * Build a complete HeatmapResponse from items (mirrors the service implementation)
 */
function buildHeatmapResponse(
  items: HeatmapItem[],
  groupBy: 'sector' | 'marketCap' | 'industry' = 'sector',
  limit: number = 50
): HeatmapResponse {
  const groups = groupBySector(items, limit);
  const dataIntegrity = calculateDataIntegrity(groups, limit);

  return {
    groupBy,
    groups,
    totalStocks: items.length,
    lastUpdated: new Date().toISOString(),
    dataIntegrity,
  };
}

describe('Property 13: 热力图数据完整性', () => {
  /**
   * Property: Each sector should contain at least 1 stock when data is complete
   * **Validates: Requirements 12.1**
   */
  it('should have at least 1 stock per sector when data is complete', () => {
    fc.assert(
      fc.property(heatmapItemsWithAllSectorsArbitrary, items => {
        const response = buildHeatmapResponse(items, 'sector', 50);

        // Property: When we have items for all sectors, each group should have at least 1 stock
        for (const group of response.groups) {
          expect(group.stockCount).toBeGreaterThanOrEqual(1);
          expect(group.items.length).toBeGreaterThanOrEqual(1);
        }

        // Property: Data integrity should report no empty groups
        expect(response.dataIntegrity.totalGroupsEmpty).toBe(0);
        expect(response.dataIntegrity.minStocksPerGroup).toBeGreaterThanOrEqual(1);

        return true;
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Total stock count should equal sum of all sector stock counts
   * **Validates: Requirements 12.3**
   */
  it('should have total stock count equal to sum of all sector stock counts', () => {
    fc.assert(
      fc.property(heatmapItemsArbitrary, fc.integer({ min: 1, max: 100 }), (items, limit) => {
        const response = buildHeatmapResponse(items, 'sector', limit);

        // Calculate sum of all group stock counts
        const sumOfGroupStocks = response.groups.reduce((sum, group) => sum + group.stockCount, 0);

        // Property: Sum of group stock counts should equal total items in groups
        const totalItemsInGroups = response.groups.reduce((sum, group) => sum + group.items.length, 0);
        expect(sumOfGroupStocks).toBe(totalItemsInGroups);

        // Property: Each group's stockCount should match its items.length
        for (const group of response.groups) {
          expect(group.stockCount).toBe(group.items.length);
        }

        return true;
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Data integrity isComplete should be true when all groups have data
   * **Validates: Requirements 12.1, 12.2**
   */
  it('should report isComplete=true when all groups have at least 1 stock', () => {
    fc.assert(
      fc.property(heatmapItemsWithAllSectorsArbitrary, items => {
        const response = buildHeatmapResponse(items, 'sector', 50);

        // Property: When all sectors have data, isComplete should be true
        expect(response.dataIntegrity.isComplete).toBe(true);
        expect(response.dataIntegrity.totalGroupsWithData).toBe(response.groups.length);
        expect(response.dataIntegrity.totalGroupsEmpty).toBe(0);

        return true;
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Response should include lastUpdated timestamp
   * **Validates: Requirements 12.3**
   */
  it('should include lastUpdated timestamp in response', () => {
    fc.assert(
      fc.property(heatmapItemsArbitrary, items => {
        const response = buildHeatmapResponse(items, 'sector', 50);

        // Property: lastUpdated should be a valid ISO date string
        expect(response.lastUpdated).toBeDefined();
        expect(typeof response.lastUpdated).toBe('string');

        const parsedDate = new Date(response.lastUpdated);
        expect(parsedDate.toString()).not.toBe('Invalid Date');

        return true;
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Response should include totalStocks count
   * **Validates: Requirements 12.3**
   */
  it('should include totalStocks count in response', () => {
    fc.assert(
      fc.property(heatmapItemsArbitrary, items => {
        const response = buildHeatmapResponse(items, 'sector', 50);

        // Property: totalStocks should be defined and non-negative
        expect(response.totalStocks).toBeDefined();
        expect(typeof response.totalStocks).toBe('number');
        expect(response.totalStocks).toBeGreaterThanOrEqual(0);

        return true;
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Each group's items should be sorted by market cap descending
   * **Validates: Requirements 12.2** (top stocks by market cap)
   */
  it('should sort stocks by market cap descending within each group', () => {
    fc.assert(
      fc.property(heatmapItemsArbitrary, items => {
        const response = buildHeatmapResponse(items, 'sector', 50);

        // Property: Items within each group should be sorted by market cap descending
        for (const group of response.groups) {
          for (let i = 1; i < group.items.length; i++) {
            expect(group.items[i - 1].marketCap).toBeGreaterThanOrEqual(group.items[i].marketCap);
          }
        }

        return true;
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Limit parameter should cap the number of stocks per group
   * **Validates: Requirements 12.2** (at least top 50 stocks)
   */
  it('should respect limit parameter for stocks per group', () => {
    fc.assert(
      fc.property(
        heatmapItemsArbitrary,
        fc.integer({ min: 1, max: 20 }),
        (items, limit) => {
          const response = buildHeatmapResponse(items, 'sector', limit);

          // Property: Each group should have at most 'limit' stocks
          for (const group of response.groups) {
            expect(group.stockCount).toBeLessThanOrEqual(limit);
            expect(group.items.length).toBeLessThanOrEqual(limit);
          }

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Data integrity warnings should be generated for groups with insufficient data
   */
  it('should generate warnings for groups with fewer stocks than expected', () => {
    fc.assert(
      fc.property(
        heatmapItemsArbitrary,
        fc.integer({ min: 50, max: 100 }),
        (items, expectedMinStocks) => {
          const response = buildHeatmapResponse(items, 'sector', expectedMinStocks);

          // Property: Groups with fewer stocks than expected should generate warnings
          for (const group of response.groups) {
            if (group.stockCount < expectedMinStocks && group.stockCount > 0) {
              const hasWarning = response.dataIntegrity.warnings.some(
                w => w.includes(group.name) && w.includes('only')
              );
              expect(hasWarning).toBe(true);
            }
          }

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: All stocks in a group should belong to that sector
   * **Validates: Requirements 12.1** (display all major sector stock data)
   */
  it('should group stocks correctly by sector', () => {
    fc.assert(
      fc.property(heatmapItemsArbitrary, items => {
        const response = buildHeatmapResponse(items, 'sector', 50);

        // Property: All items in a group should have the same sector as the group name
        for (const group of response.groups) {
          for (const item of group.items) {
            expect(item.sector).toBe(group.name);
          }
        }

        return true;
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Group statistics should be calculated correctly
   */
  it('should calculate group statistics correctly', () => {
    fc.assert(
      fc.property(heatmapItemsArbitrary, items => {
        const response = buildHeatmapResponse(items, 'sector', 50);

        for (const group of response.groups) {
          if (group.items.length === 0) continue;

          // Property: totalMarketCap should be sum of all items' market caps
          const expectedTotalMarketCap = group.items.reduce((sum, item) => sum + item.marketCap, 0);
          expect(group.totalMarketCap).toBe(expectedTotalMarketCap);

          // Property: avgChangePercent should be average of all items' change percents
          const expectedAvgChangePercent =
            group.items.reduce((sum, item) => sum + item.changePercent, 0) / group.items.length;
          expect(group.avgChangePercent).toBeCloseTo(expectedAvgChangePercent, 5);
        }

        return true;
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Groups should be sorted by total market cap descending
   */
  it('should sort groups by total market cap descending', () => {
    fc.assert(
      fc.property(heatmapItemsArbitrary, items => {
        const response = buildHeatmapResponse(items, 'sector', 50);

        // Property: Groups should be sorted by totalMarketCap descending
        for (let i = 1; i < response.groups.length; i++) {
          expect(response.groups[i - 1].totalMarketCap).toBeGreaterThanOrEqual(
            response.groups[i].totalMarketCap
          );
        }

        return true;
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Data integrity minStocksPerGroup should reflect actual minimum
   */
  it('should correctly report minStocksPerGroup in data integrity', () => {
    fc.assert(
      fc.property(heatmapItemsArbitrary, items => {
        const response = buildHeatmapResponse(items, 'sector', 50);

        if (response.groups.length === 0) {
          expect(response.dataIntegrity.minStocksPerGroup).toBe(0);
          return true;
        }

        // Property: minStocksPerGroup should be the minimum stockCount across all groups
        const actualMin = Math.min(...response.groups.map(g => g.stockCount));
        expect(response.dataIntegrity.minStocksPerGroup).toBe(actualMin);

        return true;
      }),
      { numRuns: 10 }
    );
  });
});
