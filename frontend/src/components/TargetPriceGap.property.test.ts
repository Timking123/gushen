/**
 * Property-Based Tests for Target Price Gap Calculation
 * Feature: stock-detail-and-heatmap-enhancement
 *
 * **Property 8: 目标价差距计算正确性**
 * **Validates: Requirements 7.2**
 *
 * Property: For any average target price and current price, the gap percentage
 * should equal (averageTargetPrice - currentPrice) / currentPrice * 100.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculateUpsidePercent } from './AnalystRatings';

describe('Property 8: 目标价差距计算正确性', () => {
  /**
   * Property: Upside percent should be calculated correctly as
   * (averageTargetPrice - currentPrice) / currentPrice * 100
   * **Validates: Requirements 7.2**
   */
  it('should calculate upside percent correctly', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
        (targetPrice, currentPrice) => {
          const result = calculateUpsidePercent(targetPrice, currentPrice);
          if (currentPrice === 0) {
            expect(result).toBeNull();
          } else {
            const expected = ((targetPrice - currentPrice) / currentPrice) * 100;
            expect(result).toBeCloseTo(expected, 4);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Null target price should return null
   * **Validates: Requirements 7.2**
   */
  it('should return null when target price is null', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
        (currentPrice) => {
          const result = calculateUpsidePercent(null, currentPrice);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Zero current price should return null (avoid division by zero)
   * **Validates: Requirements 7.2**
   */
  it('should return null when current price is zero', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
        (targetPrice) => {
          const result = calculateUpsidePercent(targetPrice, 0);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Positive upside when target > current, negative when target < current
   * **Validates: Requirements 7.2**
   */
  it('should return positive upside when target > current, negative otherwise', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(500), noNaN: true }),
        fc.float({ min: Math.fround(1), max: Math.fround(500), noNaN: true }),
        (targetPrice, currentPrice) => {
          const result = calculateUpsidePercent(targetPrice, currentPrice);
          if (result !== null) {
            if (targetPrice > currentPrice) {
              expect(result).toBeGreaterThan(0);
            } else if (targetPrice < currentPrice) {
              expect(result).toBeLessThan(0);
            } else {
              expect(result).toBeCloseTo(0, 4);
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
