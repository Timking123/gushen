/**
 * Property-Based Tests for Portfolio Market Value Calculation
 * Feature: smart-stock-analyzer, Property 25: 投资组合市值计算属�?
 * Validates: Requirements 17.2
 */

import * as fc from 'fast-check';
import { portfolioCalculationService } from './portfolioCalculationService.js';

describe('Portfolio Market Value Calculation Property Tests', () => {
  /**
   * Feature: smart-stock-analyzer, Property 25: 投资组合市值计算属�?
   * For any 投资组合，总市值应等于各持仓股数乘以当前价格的总和
   * **Validates: Requirements 17.2**
   */
  describe('Property 25: Portfolio Market Value Calculation', () => {
    // Arbitrary for a single holding
    const holdingArbitrary = fc.record({
      shares: fc.float({ min: 0.01, max: 100000, noNaN: true }),
      currentPrice: fc.float({ min: 0.01, max: 10000, noNaN: true }),
    });

    it('should calculate total market value as sum of (shares * currentPrice) for all holdings', () => {
      fc.assert(
        fc.property(
          fc.array(holdingArbitrary, { minLength: 0, maxLength: 50 }),
          (holdings) => {
            const calculatedValue = portfolioCalculationService.calculateMarketValue(holdings);
            const expectedValue = holdings.reduce(
              (sum, h) => sum + h.shares * h.currentPrice,
              0
            );

            // Allow small floating point tolerance
            return Math.abs(calculatedValue - expectedValue) < 0.01;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return 0 for empty portfolio', () => {
      fc.assert(
        fc.property(fc.constant([]), (holdings) => {
          const value = portfolioCalculationService.calculateMarketValue(holdings);
          return value === 0;
        }),
        { numRuns: 20 }
      );
    });

    it('should be non-negative when all shares and prices are positive', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              shares: fc.float({ min: 0, max: 100000, noNaN: true }),
              currentPrice: fc.float({ min: 0, max: 10000, noNaN: true }),
            }),
            { minLength: 0, maxLength: 50 }
          ),
          (holdings) => {
            const value = portfolioCalculationService.calculateMarketValue(holdings);
            return value >= 0;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should scale linearly with shares', () => {
      fc.assert(
        fc.property(
          holdingArbitrary,
          fc.float({ min: 1, max: 10, noNaN: true }),
          (holding, multiplier) => {
            const originalValue = portfolioCalculationService.calculateMarketValue([holding]);
            const scaledHolding = { ...holding, shares: holding.shares * multiplier };
            const scaledValue = portfolioCalculationService.calculateMarketValue([scaledHolding]);

            // Allow small floating point tolerance
            return Math.abs(scaledValue - originalValue * multiplier) < 0.01;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should be additive across holdings', () => {
      fc.assert(
        fc.property(
          fc.array(holdingArbitrary, { minLength: 2, maxLength: 10 }),
          (holdings) => {
            const totalValue = portfolioCalculationService.calculateMarketValue(holdings);
            const sumOfIndividual = holdings.reduce(
              (sum, h) => sum + portfolioCalculationService.calculateMarketValue([h]),
              0
            );

            // Allow small floating point tolerance
            return Math.abs(totalValue - sumOfIndividual) < 0.01;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
