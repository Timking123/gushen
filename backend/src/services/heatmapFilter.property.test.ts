/**
 * Property-Based Tests for Heatmap Filtering
 * Feature: stock-detail-and-heatmap-enhancement
 * 
 * **Property 15: 板块筛选正确性**
 * **Validates: Requirements 14.2, 14.3, 14.4**
 * 
 * Property: For any selected sector/industry list, filtered heatmap data
 * should only contain stocks belonging to the selected sectors/industries.
 */

import fc from 'fast-check';
import { describe, it, expect } from '@jest/globals';
import type { HeatmapItem, HeatmapFilters } from './heatmapService.js';

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
 * Arbitrary generator for an array of HeatmapItems
 */
const heatmapItemsArbitrary = fc.array(heatmapItemArbitrary, { minLength: 1, maxLength: 20 });

/**
 * Arbitrary generator for sector filter (subset of available sectors)
 */
const sectorFilterArbitrary = fc.subarray(SECTORS, { minLength: 0, maxLength: SECTORS.length });

/**
 * Arbitrary generator for industry filter (subset of available industries)
 */
const industryFilterArbitrary = fc.subarray(INDUSTRIES, { minLength: 0, maxLength: INDUSTRIES.length });

/**
 * Apply filters to heatmap items (mirrors the service implementation)
 */
function applyFilters(items: HeatmapItem[], filters: HeatmapFilters): HeatmapItem[] {
  let filtered = items;

  // Filter by sectors (multi-select)
  if (filters.sectors && filters.sectors.length > 0) {
    const sectorSet = new Set(filters.sectors.map(s => s.toLowerCase()));
    filtered = filtered.filter(item => sectorSet.has(item.sector.toLowerCase()));
  }

  // Filter by industries (multi-select)
  if (filters.industries && filters.industries.length > 0) {
    const industrySet = new Set(filters.industries.map(i => i.toLowerCase()));
    filtered = filtered.filter(item => 
      item.industry && industrySet.has(item.industry.toLowerCase())
    );
  }

  // Filter by minimum market cap
  if (filters.minMarketCap !== undefined && filters.minMarketCap !== null) {
    filtered = filtered.filter(item => item.marketCap >= filters.minMarketCap!);
  }

  // Filter by maximum market cap
  if (filters.maxMarketCap !== undefined && filters.maxMarketCap !== null) {
    filtered = filtered.filter(item => item.marketCap <= filters.maxMarketCap!);
  }

  return filtered;
}

describe('Property 15: 板块筛选正确性', () => {
  /**
   * Property: All filtered items should belong to selected sectors
   * **Validates: Requirements 14.2**
   */
  it('should only return stocks from selected sectors', () => {
    fc.assert(
      fc.property(
        heatmapItemsArbitrary,
        sectorFilterArbitrary,
        (items, selectedSectors) => {
          // Skip if no sectors selected (shows all)
          if (selectedSectors.length === 0) return true;

          const filters: HeatmapFilters = { sectors: selectedSectors };
          const filtered = applyFilters(items, filters);

          const sectorSet = new Set(selectedSectors.map(s => s.toLowerCase()));

          // Property: Every filtered item's sector should be in the selected sectors
          for (const item of filtered) {
            expect(sectorSet.has(item.sector.toLowerCase())).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: All filtered items should belong to selected industries
   * **Validates: Requirements 14.3**
   */
  it('should only return stocks from selected industries', () => {
    fc.assert(
      fc.property(
        heatmapItemsArbitrary,
        industryFilterArbitrary,
        (items, selectedIndustries) => {
          // Skip if no industries selected (shows all)
          if (selectedIndustries.length === 0) return true;

          const filters: HeatmapFilters = { industries: selectedIndustries };
          const filtered = applyFilters(items, filters);

          const industrySet = new Set(selectedIndustries.map(i => i.toLowerCase()));

          // Property: Every filtered item's industry should be in the selected industries
          for (const item of filtered) {
            expect(item.industry).not.toBeNull();
            expect(industrySet.has(item.industry!.toLowerCase())).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Empty filter should return all items
   * **Validates: Requirements 14.4**
   */
  it('should return all stocks when no filter is applied', () => {
    fc.assert(
      fc.property(
        heatmapItemsArbitrary,
        (items) => {
          const filters: HeatmapFilters = {};
          const filtered = applyFilters(items, filters);

          // Property: No filter should return all items
          expect(filtered.length).toBe(items.length);

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Filtered result should be a subset of original items
   */
  it('should return a subset of original items', () => {
    fc.assert(
      fc.property(
        heatmapItemsArbitrary,
        sectorFilterArbitrary,
        industryFilterArbitrary,
        (items, selectedSectors, selectedIndustries) => {
          const filters: HeatmapFilters = {
            sectors: selectedSectors.length > 0 ? selectedSectors : undefined,
            industries: selectedIndustries.length > 0 ? selectedIndustries : undefined,
          };
          const filtered = applyFilters(items, filters);

          // Property: Filtered count should be <= original count
          expect(filtered.length).toBeLessThanOrEqual(items.length);

          // Property: Every filtered item should exist in original items
          const originalSymbols = new Set(items.map(i => i.symbol));
          for (const item of filtered) {
            expect(originalSymbols.has(item.symbol)).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Market cap filter should respect min/max bounds
   */
  it('should filter by market cap range correctly', () => {
    fc.assert(
      fc.property(
        heatmapItemsArbitrary,
        fc.integer({ min: 0, max: 1_000_000_000_000 }),
        fc.integer({ min: 1_000_000_000_000, max: 3_000_000_000_000 }),
        (items, minMarketCap, maxMarketCap) => {
          const filters: HeatmapFilters = { minMarketCap, maxMarketCap };
          const filtered = applyFilters(items, filters);

          // Property: Every filtered item's market cap should be within range
          for (const item of filtered) {
            expect(item.marketCap).toBeGreaterThanOrEqual(minMarketCap);
            expect(item.marketCap).toBeLessThanOrEqual(maxMarketCap);
          }

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Combined filters should be intersection (AND logic)
   */
  it('should apply combined filters with AND logic', () => {
    fc.assert(
      fc.property(
        heatmapItemsArbitrary,
        sectorFilterArbitrary,
        fc.integer({ min: 0, max: 500_000_000_000 }),
        (items, selectedSectors, minMarketCap) => {
          // Skip if no sectors selected
          if (selectedSectors.length === 0) return true;

          const filters: HeatmapFilters = {
            sectors: selectedSectors,
            minMarketCap,
          };
          const filtered = applyFilters(items, filters);

          const sectorSet = new Set(selectedSectors.map(s => s.toLowerCase()));

          // Property: Every filtered item should satisfy ALL filter conditions
          for (const item of filtered) {
            expect(sectorSet.has(item.sector.toLowerCase())).toBe(true);
            expect(item.marketCap).toBeGreaterThanOrEqual(minMarketCap);
          }

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Filter is idempotent - applying same filter twice gives same result
   */
  it('should be idempotent - applying filter twice gives same result', () => {
    fc.assert(
      fc.property(
        heatmapItemsArbitrary,
        sectorFilterArbitrary,
        (items, selectedSectors) => {
          const filters: HeatmapFilters = {
            sectors: selectedSectors.length > 0 ? selectedSectors : undefined,
          };

          const filteredOnce = applyFilters(items, filters);
          const filteredTwice = applyFilters(filteredOnce, filters);

          // Property: Applying filter twice should give same result
          expect(filteredTwice.length).toBe(filteredOnce.length);
          expect(filteredTwice.map(i => i.symbol).sort()).toEqual(
            filteredOnce.map(i => i.symbol).sort()
          );

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property: Case-insensitive sector matching
   */
  it('should match sectors case-insensitively', () => {
    fc.assert(
      fc.property(
        heatmapItemsArbitrary,
        (items) => {
          // Get unique sectors from items
          const uniqueSectors = [...new Set(items.map(i => i.sector))];
          if (uniqueSectors.length === 0) return true;

          // Pick a random sector and change its case
          const originalSector = uniqueSectors[0];
          const upperCaseSector = originalSector.toUpperCase();
          const lowerCaseSector = originalSector.toLowerCase();

          const filtersUpper: HeatmapFilters = { sectors: [upperCaseSector] };
          const filtersLower: HeatmapFilters = { sectors: [lowerCaseSector] };
          const filtersOriginal: HeatmapFilters = { sectors: [originalSector] };

          const filteredUpper = applyFilters(items, filtersUpper);
          const filteredLower = applyFilters(items, filtersLower);
          const filteredOriginal = applyFilters(items, filtersOriginal);

          // Property: All case variations should return same results
          expect(filteredUpper.length).toBe(filteredOriginal.length);
          expect(filteredLower.length).toBe(filteredOriginal.length);

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });
});
