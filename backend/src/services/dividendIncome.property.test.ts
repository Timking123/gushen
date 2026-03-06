/**
 * Property-based tests for dividend income calculation
 * 
 * Feature: smart-stock-analyzer, Property 22: 股息收入计算属�?
 * 
 * **Validates: Requirements 15.6**
 * 
 * Property: For any portfolio holdings, expected annual dividend income
 * should equal the sum of (shares * annual dividend) for each holding.
 */

import * as fc from 'fast-check';

/**
 * Holding with dividend information
 */
interface HoldingWithDividend {
  symbol: string;
  shares: number;
  annualDividend: number;
}

/**
 * Calculate expected annual dividend income for a portfolio
 * This is the pure function that implements the calculation logic
 * 
 * Implements Requirement 15.6: Calculate expected annual dividend income
 * 
 * @param holdings - Array of holdings with dividend information
 * @returns Total expected annual dividend income
 */
function calculateExpectedDividendIncome(holdings: HoldingWithDividend[]): number {
  return holdings.reduce((total, holding) => {
    return total + (holding.shares * holding.annualDividend);
  }, 0);
}

/**
 * Calculate individual holding income
 * 
 * @param shares - Number of shares held
 * @param annualDividend - Annual dividend per share
 * @returns Expected income for this holding
 */
function calculateHoldingIncome(shares: number, annualDividend: number): number {
  return shares * annualDividend;
}

/**
 * Arbitrary for generating valid holding data
 */
const holdingArbitrary = fc.record({
  symbol: fc.string({ minLength: 1, maxLength: 5 }).map(s => s.toUpperCase()),
  shares: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
  annualDividend: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
});

/**
 * Arbitrary for generating a portfolio of holdings
 */
const portfolioArbitrary = fc.array(holdingArbitrary, { minLength: 0, maxLength: 50 });

describe('Dividend Income Calculation Properties', () => {
  /**
   * Feature: smart-stock-analyzer, Property 22: 股息收入计算属�?
   * 
   * **Validates: Requirements 15.6**
   */
  describe('Property 22: Dividend Income Calculation', () => {
    it('total income should equal sum of individual holding incomes', () => {
      fc.assert(
        fc.property(portfolioArbitrary, (holdings) => {
          const totalIncome = calculateExpectedDividendIncome(holdings);
          const sumOfIndividual = holdings.reduce(
            (sum, h) => sum + calculateHoldingIncome(h.shares, h.annualDividend),
            0
          );

          // Allow small floating point tolerance
          return Math.abs(totalIncome - sumOfIndividual) < 0.0001;
        }),
        { numRuns: 20 }
      );
    });

    it('income should be non-negative when all dividends are non-negative', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              symbol: fc.string({ minLength: 1, maxLength: 5 }),
              shares: fc.float({ min: Math.fround(0), max: Math.fround(100000), noNaN: true }),
              annualDividend: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
            }),
            { minLength: 0, maxLength: 50 }
          ),
          (holdings) => {
            const totalIncome = calculateExpectedDividendIncome(holdings);
            return totalIncome >= 0;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('income should be zero when portfolio is empty', () => {
      const emptyPortfolio: HoldingWithDividend[] = [];
      const income = calculateExpectedDividendIncome(emptyPortfolio);
      expect(income).toBe(0);
    });

    it('income should be zero when all dividends are zero', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              symbol: fc.string({ minLength: 1, maxLength: 5 }),
              shares: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
              annualDividend: fc.constant(0),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          (holdings) => {
            const totalIncome = calculateExpectedDividendIncome(holdings);
            return totalIncome === 0;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('income should scale linearly with shares', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
          fc.float({ min: Math.fround(1), max: Math.fround(10), noNaN: true }),
          (shares, annualDividend, multiplier) => {
            const originalIncome = calculateHoldingIncome(shares, annualDividend);
            const scaledIncome = calculateHoldingIncome(shares * multiplier, annualDividend);

            // Allow small floating point tolerance
            return Math.abs(scaledIncome - originalIncome * multiplier) < 0.01;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('income should scale linearly with dividend amount', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(50), noNaN: true }),
          fc.float({ min: Math.fround(1), max: Math.fround(10), noNaN: true }),
          (shares, annualDividend, multiplier) => {
            const originalIncome = calculateHoldingIncome(shares, annualDividend);
            const scaledIncome = calculateHoldingIncome(shares, annualDividend * multiplier);

            // Allow small floating point tolerance
            return Math.abs(scaledIncome - originalIncome * multiplier) < 0.01;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('adding a holding should increase or maintain total income', () => {
      fc.assert(
        fc.property(
          portfolioArbitrary,
          holdingArbitrary,
          (existingHoldings, newHolding) => {
            // Ensure new holding has non-negative dividend
            const safeNewHolding = {
              ...newHolding,
              annualDividend: Math.abs(newHolding.annualDividend),
            };

            const originalIncome = calculateExpectedDividendIncome(existingHoldings);
            const newIncome = calculateExpectedDividendIncome([...existingHoldings, safeNewHolding]);

            return newIncome >= originalIncome - 0.0001; // Allow small tolerance
          }
        ),
        { numRuns: 20 }
      );
    });

    it('order of holdings should not affect total income', () => {
      fc.assert(
        fc.property(
          fc.array(holdingArbitrary, { minLength: 2, maxLength: 20 }),
          (holdings) => {
            const originalIncome = calculateExpectedDividendIncome(holdings);
            
            // Reverse the holdings
            const reversedHoldings = [...holdings].reverse();
            const reversedIncome = calculateExpectedDividendIncome(reversedHoldings);

            // Allow small floating point tolerance
            return Math.abs(originalIncome - reversedIncome) < 0.0001;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('income calculation should be associative', () => {
      fc.assert(
        fc.property(
          fc.array(holdingArbitrary, { minLength: 3, maxLength: 20 }),
          (holdings) => {
            // Split holdings into two groups
            const midpoint = Math.floor(holdings.length / 2);
            const group1 = holdings.slice(0, midpoint);
            const group2 = holdings.slice(midpoint);

            const totalIncome = calculateExpectedDividendIncome(holdings);
            const group1Income = calculateExpectedDividendIncome(group1);
            const group2Income = calculateExpectedDividendIncome(group2);

            // Sum of group incomes should equal total income
            return Math.abs(totalIncome - (group1Income + group2Income)) < 0.0001;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small dividend amounts', () => {
      const holdings: HoldingWithDividend[] = [
        { symbol: 'TEST', shares: 1000000, annualDividend: 0.0001 },
      ];
      const income = calculateExpectedDividendIncome(holdings);
      expect(income).toBeCloseTo(100, 2);
    });

    it('should handle very large share counts', () => {
      const holdings: HoldingWithDividend[] = [
        { symbol: 'TEST', shares: 1000000, annualDividend: 1.0 },
      ];
      const income = calculateExpectedDividendIncome(holdings);
      expect(income).toBe(1000000);
    });

    it('should handle fractional shares', () => {
      const holdings: HoldingWithDividend[] = [
        { symbol: 'TEST', shares: 10.5, annualDividend: 2.0 },
      ];
      const income = calculateExpectedDividendIncome(holdings);
      expect(income).toBe(21);
    });
  });
});
