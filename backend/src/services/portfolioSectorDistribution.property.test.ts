/**
 * Property-Based Tests for Portfolio Sector Distribution
 * Feature: smart-stock-analyzer, Property 27: 投资组合板块分布属性
 * Validates: Requirements 17.5
 */

import * as fc from 'fast-check';
import { portfolioCalculationService, SectorDistribution } from './portfolioCalculationService.js';

describe('Portfolio Sector Distribution Property Tests', () => {
  /**
   * Feature: smart-stock-analyzer, Property 27: 投资组合板块分布属性
   * For any 投资组合，各板块占比之和应等于100%
   * For any portfolio with holdings, the sum of all sector weights equals 100%
   * Each sector's weight equals its total market value divided by portfolio total market value
   * **Validates: Requirements 17.5**
   */
  describe('Property 27: Portfolio Sector Distribution', () => {
    // Arbitrary for a single holding with sector and market value
    const holdingWithSectorArbitrary = fc.record({
      sector: fc.constantFrom('Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer', 'Industrial', 'Materials', 'Utilities'),
      marketValue: fc.float({ min: 0.01, max: 1000000, noNaN: true }),
    });

    it('should have sector weights sum to 100% (within floating point tolerance)', () => {
      fc.assert(
        fc.property(
          fc.array(holdingWithSectorArbitrary, { minLength: 1, maxLength: 50 }),
          (holdings) => {
            const distribution = portfolioCalculationService.calculateSectorDistribution(holdings);
            const totalWeight = distribution.reduce((sum, d) => sum + d.weight, 0);

            // Allow small floating point tolerance
            return Math.abs(totalWeight - 100) < 0.01;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should have each sector weight between 0% and 100%', () => {
      fc.assert(
        fc.property(
          fc.array(holdingWithSectorArbitrary, { minLength: 1, maxLength: 50 }),
          (holdings) => {
            const distribution = portfolioCalculationService.calculateSectorDistribution(holdings);

            return distribution.every((d) => d.weight >= 0 && d.weight <= 100);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should have sector weight proportional to market value', () => {
      fc.assert(
        fc.property(
          fc.array(holdingWithSectorArbitrary, { minLength: 1, maxLength: 50 }),
          (holdings) => {
            const distribution = portfolioCalculationService.calculateSectorDistribution(holdings);
            const totalMarketValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);

            // Calculate expected weights by sector
            const sectorValues = new Map<string, number>();
            for (const holding of holdings) {
              const current = sectorValues.get(holding.sector) || 0;
              sectorValues.set(holding.sector, current + holding.marketValue);
            }

            // Verify each sector's weight matches expected
            for (const sectorDist of distribution) {
              const expectedValue = sectorValues.get(sectorDist.sector) || 0;
              const expectedWeight = (expectedValue / totalMarketValue) * 100;

              if (Math.abs(sectorDist.weight - expectedWeight) >= 0.01) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return empty distribution for empty holdings', () => {
      fc.assert(
        fc.property(fc.constant([]), (holdings) => {
          const distribution = portfolioCalculationService.calculateSectorDistribution(holdings);
          return distribution.length === 0;
        }),
        { numRuns: 20 }
      );
    });

    it('should have 100% weight for single sector portfolio', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('Technology', 'Healthcare', 'Finance', 'Energy'),
          fc.array(fc.float({ min: 0.01, max: 1000000, noNaN: true }), { minLength: 1, maxLength: 10 }),
          (sector, marketValues) => {
            const holdings = marketValues.map((marketValue) => ({ sector, marketValue }));
            const distribution = portfolioCalculationService.calculateSectorDistribution(holdings);

            // Should have exactly one sector with 100% weight
            return (
              distribution.length === 1 &&
              distribution[0].sector === sector &&
              Math.abs(distribution[0].weight - 100) < 0.01
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should correctly count stocks per sector', () => {
      fc.assert(
        fc.property(
          fc.array(holdingWithSectorArbitrary, { minLength: 1, maxLength: 50 }),
          (holdings) => {
            const distribution = portfolioCalculationService.calculateSectorDistribution(holdings);

            // Calculate expected stock counts by sector
            const sectorCounts = new Map<string, number>();
            for (const holding of holdings) {
              const current = sectorCounts.get(holding.sector) || 0;
              sectorCounts.set(holding.sector, current + 1);
            }

            // Verify each sector's stock count matches expected
            for (const sectorDist of distribution) {
              const expectedCount = sectorCounts.get(sectorDist.sector) || 0;
              if (sectorDist.stockCount !== expectedCount) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should have total market value equal to sum of sector market values', () => {
      fc.assert(
        fc.property(
          fc.array(holdingWithSectorArbitrary, { minLength: 1, maxLength: 50 }),
          (holdings) => {
            const distribution = portfolioCalculationService.calculateSectorDistribution(holdings);
            const totalFromHoldings = holdings.reduce((sum, h) => sum + h.marketValue, 0);
            const totalFromDistribution = distribution.reduce((sum, d) => sum + d.marketValue, 0);

            // Allow small floating point tolerance
            return Math.abs(totalFromHoldings - totalFromDistribution) < 0.01;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should sort sectors by weight in descending order', () => {
      fc.assert(
        fc.property(
          fc.array(holdingWithSectorArbitrary, { minLength: 2, maxLength: 50 }),
          (holdings) => {
            const distribution = portfolioCalculationService.calculateSectorDistribution(holdings);

            // Verify descending order by weight
            for (let i = 1; i < distribution.length; i++) {
              if (distribution[i - 1].weight < distribution[i].weight) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
