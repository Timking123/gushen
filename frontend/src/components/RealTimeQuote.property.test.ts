/**
 * Property-Based Tests for Price Change Color
 * Feature: stock-detail-and-heatmap-enhancement
 *
 * **Property 4: 涨跌颜色正确性**
 * **Validates: Requirements 4.2, 4.3**
 *
 * Property: For any stock quote data, when the price change is >= 0, it should
 * display green; when the price change is < 0, it should display red.
 *
 * Requirements:
 * - 4.2: 股价上涨时以绿色显示涨跌信息
 * - 4.3: 股价下跌时以红色显示涨跌信息
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getPriceChangeColorClass } from './RealTimeQuote';

describe('Property 4: 涨跌颜色正确性', () => {
  /**
   * Property: Positive price changes should return 'positive' (green)
   * **Validates: Requirements 4.2**
   */
  it('should return "positive" for positive price changes (green for gains)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.0001, max: 1000000, noNaN: true }),
        (change) => {
          const colorClass = getPriceChangeColorClass(change);
          expect(colorClass).toBe('positive');
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Negative price changes should return 'negative' (red)
   * **Validates: Requirements 4.3**
   */
  it('should return "negative" for negative price changes (red for losses)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000000, max: -0.0001, noNaN: true }),
        (change) => {
          const colorClass = getPriceChangeColorClass(change);
          expect(colorClass).toBe('negative');
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Zero price change should return 'neutral'
   * **Validates: Requirements 4.2, 4.3**
   */
  it('should return "neutral" for zero price change', () => {
    const colorClass = getPriceChangeColorClass(0);
    expect(colorClass).toBe('neutral');
  });

  /**
   * Property: Color class should be deterministic for any given change value
   * **Validates: Requirements 4.2, 4.3**
   */
  it('should return consistent color class for the same change value', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000000, max: 1000000, noNaN: true }),
        (change) => {
          const colorClass1 = getPriceChangeColorClass(change);
          const colorClass2 = getPriceChangeColorClass(change);
          expect(colorClass1).toBe(colorClass2);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Color class should only be one of three valid values
   * **Validates: Requirements 4.2, 4.3**
   */
  it('should only return valid color classes (positive, negative, neutral)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000000, max: 1000000, noNaN: true }),
        (change) => {
          const colorClass = getPriceChangeColorClass(change);
          expect(['positive', 'negative', 'neutral']).toContain(colorClass);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: For any price change, the color mapping should be correct
   * - change > 0 → 'positive' (green)
   * - change < 0 → 'negative' (red)
   * - change === 0 → 'neutral'
   * **Validates: Requirements 4.2, 4.3**
   */
  it('should correctly map all price changes to appropriate colors', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000000, max: 1000000, noNaN: true }),
        (change) => {
          const colorClass = getPriceChangeColorClass(change);

          if (change > 0) {
            expect(colorClass).toBe('positive');
          } else if (change < 0) {
            expect(colorClass).toBe('negative');
          } else {
            expect(colorClass).toBe('neutral');
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
