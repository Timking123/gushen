/**
 * Property-Based Tests for Portfolio Profit/Loss Calculation
 * Feature: smart-stock-analyzer, Property 26: 投资组合收益计算属性
 * Validates: Requirements 17.3
 */

import * as fc from 'fast-check';
import { portfolioCalculationService } from './portfolioCalculationService.js';

describe('Portfolio Profit/Loss Calculation Property Tests', () => {
  /**
   * Feature: smart-stock-analyzer, Property 26: 投资组合收益计算属性
   * For any 投资组合持仓，收益应等于（当前价格 - 平均成本）乘以股数
   * **Validates: Requirements 17.3**
   */
  describe('Property 26: Portfolio Profit/Loss Calculation', () => {
    // Arbitrary for holding parameters
    const holdingParamsArbitrary = fc.record({
      shares: fc.float({ min: 0.01, max: 100000, noNaN: true }),
      currentPrice: fc.float({ min: 0.01, max: 10000, noNaN: true }),
      avgCostBasis: fc.float({ min: 0.01, max: 10000, noNaN: true }),
    });

    it('should calculate gain/loss as (currentPrice - avgCostBasis) * shares for any holding', () => {
      fc.assert(
        fc.property(holdingParamsArbitrary, ({ shares, currentPrice, avgCostBasis }) => {
          const calculatedGain = portfolioCalculationService.calculateHoldingGain(
            shares,
            currentPrice,
            avgCostBasis
          );
          const expectedGain = (currentPrice - avgCostBasis) * shares;

          // Allow small floating point tolerance
          return Math.abs(calculatedGain - expectedGain) < 0.01;
        }),
        { numRuns: 20 }
      );
    });

    it('should return positive gain when currentPrice > avgCostBasis', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0.01, max: 100000, noNaN: true }), // shares
          fc.float({ min: 100, max: 10000, noNaN: true }), // currentPrice (higher)
          fc.float({ min: 0.01, max: 99.99, noNaN: true }), // avgCostBasis (lower)
          (shares, currentPrice, avgCostBasis) => {
            const gain = portfolioCalculationService.calculateHoldingGain(
              shares,
              currentPrice,
              avgCostBasis
            );
            return gain > 0;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return negative gain when currentPrice < avgCostBasis', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0.01, max: 100000, noNaN: true }), // shares
          fc.float({ min: 0.01, max: 99.99, noNaN: true }), // currentPrice (lower)
          fc.float({ min: 100, max: 10000, noNaN: true }), // avgCostBasis (higher)
          (shares, currentPrice, avgCostBasis) => {
            const gain = portfolioCalculationService.calculateHoldingGain(
              shares,
              currentPrice,
              avgCostBasis
            );
            return gain < 0;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return zero gain when currentPrice equals avgCostBasis', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0.01, max: 100000, noNaN: true }), // shares
          fc.float({ min: 0.01, max: 10000, noNaN: true }), // price (same for both)
          (shares, price) => {
            const gain = portfolioCalculationService.calculateHoldingGain(shares, price, price);
            return Math.abs(gain) < 0.01;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should scale linearly with shares', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0.01, max: 10000, noNaN: true }), // shares
          fc.float({ min: 0.01, max: 10000, noNaN: true }), // currentPrice
          fc.float({ min: 0.01, max: 10000, noNaN: true }), // avgCostBasis
          fc.float({ min: 1, max: 10, noNaN: true }), // multiplier
          (shares, currentPrice, avgCostBasis, multiplier) => {
            const originalGain = portfolioCalculationService.calculateHoldingGain(
              shares,
              currentPrice,
              avgCostBasis
            );
            const scaledGain = portfolioCalculationService.calculateHoldingGain(
              shares * multiplier,
              currentPrice,
              avgCostBasis
            );

            // Allow small floating point tolerance
            return Math.abs(scaledGain - originalGain * multiplier) < 0.01;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should be additive across multiple holdings', () => {
      fc.assert(
        fc.property(
          fc.array(holdingParamsArbitrary, { minLength: 2, maxLength: 10 }),
          (holdings) => {
            const totalGain = holdings.reduce(
              (sum, h) =>
                sum +
                portfolioCalculationService.calculateHoldingGain(
                  h.shares,
                  h.currentPrice,
                  h.avgCostBasis
                ),
              0
            );

            const expectedTotal = holdings.reduce(
              (sum, h) => sum + (h.currentPrice - h.avgCostBasis) * h.shares,
              0
            );

            // Allow small floating point tolerance
            return Math.abs(totalGain - expectedTotal) < 0.01;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
