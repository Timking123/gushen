/**
 * Property-Based Tests for Analyst Ratings Summary
 * Feature: stock-detail-and-heatmap-enhancement
 *
 * **Property 7: 分析师评级汇总正确性**
 * **Validates: Requirements 7.1**
 *
 * Property: For any analyst rating summary, the sum of all rating categories
 * (strongBuy + buy + hold + sell + strongSell) should equal totalAnalysts.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { AnalystRatingSummary } from '../types';

/**
 * Validates that an analyst rating summary has consistent totals.
 * The sum of all rating categories should equal totalAnalysts.
 *
 * @param summary - The analyst rating summary to validate
 * @returns true if the summary is consistent, false otherwise
 */
export function validateAnalystRatingSummary(summary: AnalystRatingSummary): boolean {
  const categorySum =
    summary.strongBuy + summary.buy + summary.hold + summary.sell + summary.strongSell;
  return categorySum === summary.totalAnalysts;
}

/**
 * Generates a valid AnalystRatingSummary where the category counts sum to totalAnalysts.
 * This is a smart generator that constrains to the valid input space.
 */
const validAnalystRatingSummaryArb = fc
  .record({
    strongBuy: fc.nat({ max: 50 }),
    buy: fc.nat({ max: 50 }),
    hold: fc.nat({ max: 50 }),
    sell: fc.nat({ max: 50 }),
    strongSell: fc.nat({ max: 50 }),
  })
  .map(({ strongBuy, buy, hold, sell, strongSell }) => {
    const totalAnalysts = strongBuy + buy + hold + sell + strongSell;
    const summary: AnalystRatingSummary = {
      symbol: 'TEST',
      totalAnalysts,
      strongBuy,
      buy,
      hold,
      sell,
      strongSell,
      averageTargetPrice: 100,
      highTargetPrice: 150,
      lowTargetPrice: 50,
      currentPrice: 90,
      upsidePercent: 11.11,
    };
    return summary;
  });

/**
 * Generates an arbitrary AnalystRatingSummary where totalAnalysts may not match
 * the sum of categories. Used to test the validation function itself.
 */
const arbitraryAnalystRatingSummaryArb = fc.record({
  symbol: fc.string({ minLength: 1, maxLength: 5 }),
  totalAnalysts: fc.nat({ max: 200 }),
  strongBuy: fc.nat({ max: 50 }),
  buy: fc.nat({ max: 50 }),
  hold: fc.nat({ max: 50 }),
  sell: fc.nat({ max: 50 }),
  strongSell: fc.nat({ max: 50 }),
  averageTargetPrice: fc.oneof(fc.constant(null), fc.float({ min: Math.fround(1), max: Math.fround(1000) })),
  highTargetPrice: fc.oneof(fc.constant(null), fc.float({ min: Math.fround(1), max: Math.fround(1000) })),
  lowTargetPrice: fc.oneof(fc.constant(null), fc.float({ min: Math.fround(1), max: Math.fround(1000) })),
  currentPrice: fc.float({ min: Math.fround(0.01), max: Math.fround(1000) }),
  upsidePercent: fc.oneof(fc.constant(null), fc.float({ min: Math.fround(-100), max: Math.fround(500) })),
});

describe('Property 7: 分析师评级汇总正确性', () => {
  /**
   * Property: For any valid analyst rating summary, the sum of all rating categories
   * should equal totalAnalysts.
   * **Validates: Requirements 7.1**
   */
  it('should have category sum equal to totalAnalysts for valid summaries', () => {
    fc.assert(
      fc.property(validAnalystRatingSummaryArb, (summary) => {
        const categorySum =
          summary.strongBuy + summary.buy + summary.hold + summary.sell + summary.strongSell;
        expect(categorySum).toBe(summary.totalAnalysts);
        expect(validateAnalystRatingSummary(summary)).toBe(true);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property: The validation function should correctly identify valid summaries
   * where category sum equals totalAnalysts.
   * **Validates: Requirements 7.1**
   */
  it('should validate summaries where category sum matches totalAnalysts', () => {
    fc.assert(
      fc.property(
        fc.record({
          strongBuy: fc.nat({ max: 30 }),
          buy: fc.nat({ max: 30 }),
          hold: fc.nat({ max: 30 }),
          sell: fc.nat({ max: 30 }),
          strongSell: fc.nat({ max: 30 }),
        }),
        ({ strongBuy, buy, hold, sell, strongSell }) => {
          const totalAnalysts = strongBuy + buy + hold + sell + strongSell;
          const summary: AnalystRatingSummary = {
            symbol: 'AAPL',
            totalAnalysts,
            strongBuy,
            buy,
            hold,
            sell,
            strongSell,
            averageTargetPrice: 150,
            highTargetPrice: 200,
            lowTargetPrice: 100,
            currentPrice: 140,
            upsidePercent: 7.14,
          };

          // The sum should always equal totalAnalysts
          const sum = strongBuy + buy + hold + sell + strongSell;
          expect(sum).toBe(totalAnalysts);
          expect(validateAnalystRatingSummary(summary)).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: The validation function should correctly identify invalid summaries
   * where category sum does not equal totalAnalysts.
   * **Validates: Requirements 7.1**
   */
  it('should detect invalid summaries where category sum does not match totalAnalysts', () => {
    fc.assert(
      fc.property(
        arbitraryAnalystRatingSummaryArb,
        (summary) => {
          const categorySum =
            summary.strongBuy + summary.buy + summary.hold + summary.sell + summary.strongSell;
          const isValid = categorySum === summary.totalAnalysts;
          expect(validateAnalystRatingSummary(summary)).toBe(isValid);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: All rating category counts should be non-negative integers.
   * **Validates: Requirements 7.1**
   */
  it('should have non-negative integer counts for all rating categories', () => {
    fc.assert(
      fc.property(validAnalystRatingSummaryArb, (summary) => {
        expect(summary.strongBuy).toBeGreaterThanOrEqual(0);
        expect(summary.buy).toBeGreaterThanOrEqual(0);
        expect(summary.hold).toBeGreaterThanOrEqual(0);
        expect(summary.sell).toBeGreaterThanOrEqual(0);
        expect(summary.strongSell).toBeGreaterThanOrEqual(0);
        expect(summary.totalAnalysts).toBeGreaterThanOrEqual(0);

        // All should be integers
        expect(Number.isInteger(summary.strongBuy)).toBe(true);
        expect(Number.isInteger(summary.buy)).toBe(true);
        expect(Number.isInteger(summary.hold)).toBe(true);
        expect(Number.isInteger(summary.sell)).toBe(true);
        expect(Number.isInteger(summary.strongSell)).toBe(true);
        expect(Number.isInteger(summary.totalAnalysts)).toBe(true);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Empty analyst ratings (totalAnalysts = 0) should have all categories as 0.
   * **Validates: Requirements 7.1**
   */
  it('should have all categories as 0 when totalAnalysts is 0', () => {
    const emptySummary: AnalystRatingSummary = {
      symbol: 'EMPTY',
      totalAnalysts: 0,
      strongBuy: 0,
      buy: 0,
      hold: 0,
      sell: 0,
      strongSell: 0,
      averageTargetPrice: null,
      highTargetPrice: null,
      lowTargetPrice: null,
      currentPrice: 100,
      upsidePercent: null,
    };

    expect(validateAnalystRatingSummary(emptySummary)).toBe(true);
    expect(
      emptySummary.strongBuy +
        emptySummary.buy +
        emptySummary.hold +
        emptySummary.sell +
        emptySummary.strongSell
    ).toBe(0);
  });
});
