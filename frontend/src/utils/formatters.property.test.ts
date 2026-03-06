/**
 * Property-Based Tests for Market Cap Formatting
 * Feature: stock-detail-and-heatmap-enhancement
 *
 * **Property 2: 市值格式化正确性**
 * **Validates: Requirements 2.3**
 *
 * Property: For any market cap value, the formatting function should correctly
 * convert to human-readable format:
 * - >= 1 trillion (1e12): Display as xT
 * - >= 1 billion (1e9): Display as xB
 * - >= 1 million (1e6): Display as xM
 * - < 1 million: Display original value with locale formatting
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { formatMarketCap } from './formatters';

describe('Property 2: 市值格式化正确性', () => {
  /**
   * Property: Market cap values >= 1 trillion should be formatted with 'T' suffix
   * **Validates: Requirements 2.3**
   */
  it('should format values >= 1 trillion with T suffix', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1_000_000_000_000, max: 999_000_000_000_000 }),
        (marketCap) => {
          const formatted = formatMarketCap(marketCap);
          expect(formatted).toMatch(/^\d+(\.\d+)?T$/);

          // Verify the numeric value is correct
          const numericPart = parseFloat(formatted.replace('T', ''));
          const expectedValue = marketCap / 1e12;
          // Allow for rounding differences due to toFixed(2)
          expect(numericPart).toBeCloseTo(expectedValue, 1);
        }
      ),
      { numRuns: 20 }  // Reduced for faster execution
    );
  });

  /**
   * Property: Market cap values >= 1 billion and < 1 trillion should be formatted with 'B' suffix
   * **Validates: Requirements 2.3**
   */
  it('should format values >= 1 billion and < 1 trillion with B suffix', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1_000_000_000, max: 999_999_999_999 }),
        (marketCap) => {
          const formatted = formatMarketCap(marketCap);
          expect(formatted).toMatch(/^\d+(\.\d+)?B$/);

          // Verify the numeric value is correct
          const numericPart = parseFloat(formatted.replace('B', ''));
          const expectedValue = marketCap / 1e9;
          expect(numericPart).toBeCloseTo(expectedValue, 1);
        }
      ),
      { numRuns: 20 }  // Reduced for faster execution
    );
  });

  /**
   * Property: Market cap values >= 1 million and < 1 billion should be formatted with 'M' suffix
   * **Validates: Requirements 2.3**
   */
  it('should format values >= 1 million and < 1 billion with M suffix', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1_000_000, max: 999_999_999 }),
        (marketCap) => {
          const formatted = formatMarketCap(marketCap);
          expect(formatted).toMatch(/^\d+(\.\d+)?M$/);

          // Verify the numeric value is correct
          const numericPart = parseFloat(formatted.replace('M', ''));
          const expectedValue = marketCap / 1e6;
          expect(numericPart).toBeCloseTo(expectedValue, 1);
        }
      ),
      { numRuns: 20 }  // Reduced for faster execution
    );
  });

  /**
   * Property: Market cap values < 1 million should be formatted with locale string
   * **Validates: Requirements 2.3**
   */
  it('should format values < 1 million with locale formatting', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 999_999 }), (marketCap) => {
        const formatted = formatMarketCap(marketCap);
        // Should not have T, B, or M suffix
        expect(formatted).not.toMatch(/[TBM]$/);
        // Should be the locale formatted string
        expect(formatted).toBe(marketCap.toLocaleString());
      }),
      { numRuns: 20 }  // Reduced for faster execution
    );
  });

  /**
   * Property: Null and undefined values should return '暂无数据'
   * **Validates: Requirements 2.3**
   */
  it('should return "暂无数据" for null or undefined values', () => {
    expect(formatMarketCap(null)).toBe('暂无数据');
    expect(formatMarketCap(undefined)).toBe('暂无数据');
  });

  /**
   * Property: Format should be consistent across all valid market cap ranges
   * **Validates: Requirements 2.3**
   */
  it('should format market cap correctly for all values', () => {
    fc.assert(
      fc.property(fc.nat({ max: 10_000_000_000_000 }), (marketCap) => {
        const formatted = formatMarketCap(marketCap);

        if (marketCap >= 1e12) {
          expect(formatted).toMatch(/^\d+(\.\d+)?T$/);
        } else if (marketCap >= 1e9) {
          expect(formatted).toMatch(/^\d+(\.\d+)?B$/);
        } else if (marketCap >= 1e6) {
          expect(formatted).toMatch(/^\d+(\.\d+)?M$/);
        } else {
          expect(formatted).toBe(marketCap.toLocaleString());
        }
      }),
      { numRuns: 20 }  // Reduced for faster execution
    );
  });

  /**
   * Property: Formatting should preserve relative ordering
   * For any two market cap values a < b, the formatted numeric values should maintain a <= b
   * **Validates: Requirements 2.3**
   */
  it('should preserve relative ordering of values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000_000_000 }),
        fc.integer({ min: 0, max: 10_000_000_000_000 }),
        (a, b) => {
          const [smaller, larger] = a <= b ? [a, b] : [b, a];
          const formattedSmaller = formatMarketCap(smaller);
          const formattedLarger = formatMarketCap(larger);

          // Extract numeric values and suffixes
          const parseFormatted = (str: string): number => {
            if (str.endsWith('T')) return parseFloat(str) * 1e12;
            if (str.endsWith('B')) return parseFloat(str) * 1e9;
            if (str.endsWith('M')) return parseFloat(str) * 1e6;
            return parseFloat(str.replace(/,/g, ''));
          };

          const numSmaller = parseFormatted(formattedSmaller);
          const numLarger = parseFormatted(formattedLarger);

          // Due to rounding, we allow a small tolerance
          expect(numSmaller).toBeLessThanOrEqual(numLarger + 1);
        }
      ),
      { numRuns: 20 }  // Reduced for faster execution
    );
  });
});
