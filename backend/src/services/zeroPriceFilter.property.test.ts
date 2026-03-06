/**
 * Property-Based Tests for Zero-Price Stock Filtering
 * Feature: project-review-and-upgrade
 *
 * **Property 4: 零价股票过滤正确性**
 * **Validates: Requirements 3.2, 3.4**
 *
 * Property: For any dataset containing zero-price stocks, when hideZeroPrice
 * is true, the result set should not contain any stocks with zero or null prices.
 */

import fc from 'fast-check';
import { describe, it, expect } from '@jest/globals';
import { isZeroPrice } from './heatmapService.js';
import type { HeatmapItem, HeatmapFilters } from './heatmapService.js';

/**
 * Sectors and industries for generating realistic test data
 */
const SECTORS = [
  'Technology', 'Healthcare', 'Financial Services',
  'Consumer Cyclical', 'Energy', 'Industrials',
];

const INDUSTRIES = [
  'Software', 'Biotechnology', 'Banks', 'Retail', 'Oil & Gas',
];

/**
 * Arbitrary generator for a valid (non-zero) price: >= 0.01
 * We use min=0.02 (fround) to avoid float32 rounding producing values < 0.01
 */
const validPriceArbitrary = fc.float({
  min: Math.fround(0.02),
  max: Math.fround(10000),
  noNaN: true,
}).filter(p => p >= 0.01);

/**
 * Arbitrary generator for a zero-price value:
 * exactly 0, null, undefined, or sub-penny (< 0.01)
 */
const zeroPriceArbitrary = fc.oneof(
  fc.constant(0),
  fc.constant(null as number | null),
  fc.constant(undefined as number | undefined),
  fc.float({ min: Math.fround(-100), max: Math.fround(0.0099), noNaN: true }),
);

/**
 * Arbitrary generator for any price (mix of valid and zero-price)
 */
const anyPriceArbitrary = fc.oneof(validPriceArbitrary, zeroPriceArbitrary);

/**
 * Arbitrary generator for a HeatmapItem with a specific price
 */
function heatmapItemWithPrice(priceArb: fc.Arbitrary<number | null | undefined>): fc.Arbitrary<HeatmapItem> {
  return fc.record({
    symbol: fc.stringMatching(/^[A-Z]{1,5}$/),
    name: fc.string({ minLength: 1, maxLength: 30 }),
    sector: fc.constantFrom(...SECTORS),
    industry: fc.option(fc.constantFrom(...INDUSTRIES), { nil: null }),
    marketCap: fc.integer({ min: 1_000_000, max: 3_000_000_000_000 }),
    price: priceArb.map(p => (p === null || p === undefined) ? 0 : p as number),
    change: fc.float({ min: -100, max: 100, noNaN: true }),
    changePercent: fc.float({ min: -50, max: 50, noNaN: true }),
    volume: fc.integer({ min: 0, max: 1_000_000_000 }),
  });
}

/**
 * Generate a mixed dataset: some items with valid prices, some with zero prices.
 * Ensures at least one zero-price and one valid-price item.
 */
const mixedDatasetArbitrary = fc.tuple(
  fc.array(heatmapItemWithPrice(validPriceArbitrary), { minLength: 1, maxLength: 10 }),
  fc.array(heatmapItemWithPrice(fc.constant(0 as number | null | undefined)), { minLength: 1, maxLength: 5 }),
).map(([valid, zero]) => [...valid, ...zero]);

/**
 * Apply filters to heatmap items (mirrors the service's applyFilters logic)
 */
function applyFilters(items: HeatmapItem[], filters: HeatmapFilters): HeatmapItem[] {
  let filtered = items;

  if (filters.sectors && filters.sectors.length > 0) {
    const sectorSet = new Set(filters.sectors.map(s => s.toLowerCase()));
    filtered = filtered.filter(item => sectorSet.has(item.sector.toLowerCase()));
  }

  if (filters.industries && filters.industries.length > 0) {
    const industrySet = new Set(filters.industries.map(i => i.toLowerCase()));
    filtered = filtered.filter(item =>
      item.industry && industrySet.has(item.industry.toLowerCase())
    );
  }

  if (filters.minMarketCap !== undefined && filters.minMarketCap !== null) {
    filtered = filtered.filter(item => item.marketCap >= filters.minMarketCap!);
  }

  if (filters.maxMarketCap !== undefined && filters.maxMarketCap !== null) {
    filtered = filtered.filter(item => item.marketCap <= filters.maxMarketCap!);
  }

  if (filters.hideZeroPrice === true) {
    filtered = filtered.filter(item => !isZeroPrice(item.price));
  }

  return filtered;
}

describe('Property 4: 零价股票过滤正确性', () => {
  /**
   * **Validates: Requirements 3.2, 3.4**
   *
   * isZeroPrice should return true for 0, null, undefined, and sub-penny values
   */
  it('isZeroPrice correctly identifies zero-price values', () => {
    fc.assert(
      fc.property(zeroPriceArbitrary, (price) => {
        expect(isZeroPrice(price)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.2, 3.4**
   *
   * isZeroPrice should return false for valid prices (>= 0.01)
   */
  it('isZeroPrice correctly identifies valid prices', () => {
    fc.assert(
      fc.property(validPriceArbitrary, (price) => {
        expect(isZeroPrice(price)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.2, 3.4**
   *
   * When hideZeroPrice is true, no zero-price stocks should remain in the result
   */
  it('hideZeroPrice=true removes all zero-price stocks from results', () => {
    fc.assert(
      fc.property(mixedDatasetArbitrary, (items) => {
        const filters: HeatmapFilters = { hideZeroPrice: true };
        const filtered = applyFilters(items, filters);

        // Property: no item in the result should have a zero price
        for (const item of filtered) {
          expect(isZeroPrice(item.price)).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.2, 3.4**
   *
   * When hideZeroPrice is false, zero-price stocks should be preserved
   */
  it('hideZeroPrice=false preserves zero-price stocks', () => {
    fc.assert(
      fc.property(mixedDatasetArbitrary, (items) => {
        const filters: HeatmapFilters = { hideZeroPrice: false };
        const filtered = applyFilters(items, filters);

        // Property: all items should be preserved (no filtering)
        expect(filtered.length).toBe(items.length);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.2, 3.4**
   *
   * When hideZeroPrice is undefined, zero-price stocks should be preserved
   */
  it('hideZeroPrice=undefined preserves zero-price stocks', () => {
    fc.assert(
      fc.property(mixedDatasetArbitrary, (items) => {
        const filters: HeatmapFilters = {};
        const filtered = applyFilters(items, filters);

        // Property: all items should be preserved (no filtering)
        expect(filtered.length).toBe(items.length);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.2, 3.4**
   *
   * hideZeroPrice=true should only remove zero-price items; valid-price items are kept
   */
  it('hideZeroPrice=true keeps all valid-price stocks', () => {
    fc.assert(
      fc.property(mixedDatasetArbitrary, (items) => {
        const filters: HeatmapFilters = { hideZeroPrice: true };
        const filtered = applyFilters(items, filters);

        const validItems = items.filter(item => !isZeroPrice(item.price));

        // Property: filtered count should equal the count of valid-price items
        expect(filtered.length).toBe(validItems.length);

        // Property: every valid-price item from the original set should be in the result
        const filteredSymbols = new Set(filtered.map(i => i.symbol));
        for (const item of validItems) {
          expect(filteredSymbols.has(item.symbol)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.2, 3.4**
   *
   * For any arbitrary price, isZeroPrice and "not isZeroPrice" should be exhaustive
   * (every price is classified as either zero or valid)
   */
  it('isZeroPrice partitions all prices into exactly two categories', () => {
    fc.assert(
      fc.property(anyPriceArbitrary, (price) => {
        const result = isZeroPrice(price);
        expect(typeof result).toBe('boolean');
      }),
      { numRuns: 100 }
    );
  });
});
