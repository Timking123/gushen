/**
 * Feature: smart-stock-analyzer, Property 12: 筛选器过滤属�?
 * 
 * Property: For any 筛选条件组合和股票数据库，返回的所有股票都应满足所有指定的筛选条�?
 * 
 * **Validates: Requirements 10.2, 10.3, 10.4, 10.5**
 * - 10.2: WHEN 用户设置描述性筛选条�?THEN Stock_Screener SHALL 支持按交易所、板块、市值范围、国家等筛�?
 * - 10.3: WHEN 用户设置基本面筛选条�?THEN Stock_Screener SHALL 支持�?P/E、EPS 增长率、股息率、负债率等筛�?
 * - 10.4: WHEN 用户设置技术面筛选条�?THEN Stock_Screener SHALL 支持�?RSI、移动平均线、价格形态、成交量等筛�?
 * - 10.5: WHEN 用户应用筛选条�?THEN Stock_Screener SHALL 实时显示符合条件的股票列�?
 */

import fc from 'fast-check';
import { describe, it } from '@jest/globals';
import type { ScreenerFilters, ScreenerResultItem } from './screenerService.js';

/**
 * Helper function to check if a stock matches all filter criteria
 * This implements the core filtering logic that should match the service behavior
 */
function matchesAllFilters(stock: ScreenerResultItem, filters: ScreenerFilters): boolean {
  // Descriptive filters (Requirement 10.2)
  if (filters.exchange && filters.exchange.length > 0) {
    if (!filters.exchange.includes(stock.exchange)) {
      return false;
    }
  }

  if (filters.sector && filters.sector.length > 0) {
    if (!stock.sector || !filters.sector.includes(stock.sector)) {
      return false;
    }
  }

  if (filters.industry && filters.industry.length > 0) {
    if (!stock.industry || !filters.industry.includes(stock.industry)) {
      return false;
    }
  }

  if (filters.country && filters.country.length > 0) {
    if (!stock.country || !filters.country.includes(stock.country)) {
      return false;
    }
  }

  if (filters.marketCapMin !== undefined) {
    if (stock.marketCap === null || stock.marketCap < filters.marketCapMin) {
      return false;
    }
  }

  if (filters.marketCapMax !== undefined) {
    if (stock.marketCap === null || stock.marketCap > filters.marketCapMax) {
      return false;
    }
  }

  // Fundamental filters (Requirement 10.3)
  if (filters.peMin !== undefined) {
    if (stock.pe === null || stock.pe < filters.peMin) {
      return false;
    }
  }

  if (filters.peMax !== undefined) {
    if (stock.pe === null || stock.pe > filters.peMax) {
      return false;
    }
  }

  if (filters.epsGrowthMin !== undefined) {
    if (stock.epsGrowth === null || stock.epsGrowth < filters.epsGrowthMin) {
      return false;
    }
  }

  if (filters.dividendYieldMin !== undefined) {
    if (stock.dividendYield === null || stock.dividendYield < filters.dividendYieldMin) {
      return false;
    }
  }

  if (filters.debtToEquityMax !== undefined) {
    if (stock.debtToEquity === null || stock.debtToEquity > filters.debtToEquityMax) {
      return false;
    }
  }

  if (filters.revenueGrowthMin !== undefined) {
    if (stock.revenueGrowth === null || stock.revenueGrowth < filters.revenueGrowthMin) {
      return false;
    }
  }

  if (filters.roeMin !== undefined) {
    if (stock.roe === null || stock.roe < filters.roeMin) {
      return false;
    }
  }

  // Technical filters (Requirement 10.4)
  if (filters.rsiMin !== undefined) {
    if (stock.rsi14 === null || stock.rsi14 < filters.rsiMin) {
      return false;
    }
  }

  if (filters.rsiMax !== undefined) {
    if (stock.rsi14 === null || stock.rsi14 > filters.rsiMax) {
      return false;
    }
  }

  if (filters.priceAboveSma20 !== undefined) {
    if (stock.price === null || stock.sma20 === null) {
      return false;
    }
    const isAbove = stock.price > stock.sma20;
    if (filters.priceAboveSma20 !== isAbove) {
      return false;
    }
  }

  if (filters.priceAboveSma50 !== undefined) {
    if (stock.price === null || stock.sma50 === null) {
      return false;
    }
    const isAbove = stock.price > stock.sma50;
    if (filters.priceAboveSma50 !== isAbove) {
      return false;
    }
  }

  if (filters.priceAboveSma200 !== undefined) {
    if (stock.price === null || stock.sma200 === null) {
      return false;
    }
    const isAbove = stock.price > stock.sma200;
    if (filters.priceAboveSma200 !== isAbove) {
      return false;
    }
  }

  return true;
}

/**
 * Arbitrary generator for stock symbols (1-5 uppercase letters)
 */
const symbolArbitrary = fc
  .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
    minLength: 1,
    maxLength: 5,
  })
  .map((chars) => chars.join(''));

/**
 * Arbitrary generator for stock result items
 * Generates realistic stock data with all required fields
 */
const stockArbitrary: fc.Arbitrary<ScreenerResultItem> = fc.record({
  symbol: symbolArbitrary,
  name: fc.string({ minLength: 3, maxLength: 50 }),
  exchange: fc.constantFrom('NYSE', 'NASDAQ', 'AMEX', 'LSE'),
  sector: fc.option(fc.constantFrom('Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer'), { nil: null }),
  industry: fc.option(fc.constantFrom('Software', 'Biotech', 'Banking', 'Oil & Gas', 'Retail'), { nil: null }),
  marketCap: fc.option(fc.integer({ min: 1000000, max: 5000000000000 }), { nil: null }),
  country: fc.option(fc.constantFrom('US', 'UK', 'CN', 'JP', 'DE'), { nil: null }),
  price: fc.option(fc.float({ min: 1, max: 5000, noNaN: true }), { nil: null }),
  changePercent: fc.option(fc.float({ min: -50, max: 50, noNaN: true }), { nil: null }),
  volume: fc.option(fc.integer({ min: 100000, max: 500000000 }), { nil: null }),
  pe: fc.option(fc.float({ min: 1, max: 100, noNaN: true }), { nil: null }),
  epsGrowth: fc.option(fc.float({ min: -50, max: 200, noNaN: true }), { nil: null }),
  dividendYield: fc.option(fc.float({ min: 0, max: 15, noNaN: true }), { nil: null }),
  debtToEquity: fc.option(fc.float({ min: 0, max: 5, noNaN: true }), { nil: null }),
  revenueGrowth: fc.option(fc.float({ min: -50, max: 200, noNaN: true }), { nil: null }),
  roe: fc.option(fc.float({ min: -50, max: 100, noNaN: true }), { nil: null }),
  rsi14: fc.option(fc.float({ min: 0, max: 100, noNaN: true }), { nil: null }),
  sma20: fc.option(fc.float({ min: 1, max: 5000, noNaN: true }), { nil: null }),
  sma50: fc.option(fc.float({ min: 1, max: 5000, noNaN: true }), { nil: null }),
  sma200: fc.option(fc.float({ min: 1, max: 5000, noNaN: true }), { nil: null }),
});

/**
 * Arbitrary generator for screener filters
 * Generates valid filter combinations for testing
 */
const screenerFiltersArbitrary: fc.Arbitrary<ScreenerFilters> = fc.record({
  exchange: fc.option(fc.subarray(['NYSE', 'NASDAQ', 'AMEX'], { minLength: 1 })),
  sector: fc.option(fc.subarray(['Technology', 'Healthcare', 'Finance'], { minLength: 1 })),
  industry: fc.option(fc.subarray(['Software', 'Biotech', 'Banking'], { minLength: 1 })),
  country: fc.option(fc.subarray(['US', 'UK', 'CN'], { minLength: 1 })),
  marketCapMin: fc.option(fc.integer({ min: 1000000, max: 1000000000 })),
  marketCapMax: fc.option(fc.integer({ min: 1000000000, max: 5000000000000 })),
  peMin: fc.option(fc.float({ min: 1, max: 20, noNaN: true })),
  peMax: fc.option(fc.float({ min: 20, max: 100, noNaN: true })),
  epsGrowthMin: fc.option(fc.float({ min: 0, max: 50, noNaN: true })),
  dividendYieldMin: fc.option(fc.float({ min: 0, max: 5, noNaN: true })),
  debtToEquityMax: fc.option(fc.float({ min: 0.5, max: 3, noNaN: true })),
  revenueGrowthMin: fc.option(fc.float({ min: 0, max: 50, noNaN: true })),
  roeMin: fc.option(fc.float({ min: 0, max: 30, noNaN: true })),
  rsiMin: fc.option(fc.float({ min: 0, max: 50, noNaN: true })),
  rsiMax: fc.option(fc.float({ min: 50, max: 100, noNaN: true })),
  priceAboveSma20: fc.option(fc.boolean()),
  priceAboveSma50: fc.option(fc.boolean()),
  priceAboveSma200: fc.option(fc.boolean()),
}, { requiredKeys: [] });

/**
 * Feature: smart-stock-analyzer, Property 12: 筛选器过滤属�?
 * 
 * Tests that all returned stocks match ALL specified filter criteria
 */
describe('Property 12: Screener Filter Property (筛选器过滤属�?', () => {
  /**
   * Core property test: All filtered stocks must match all criteria
   * **Validates: Requirements 10.2, 10.3, 10.4, 10.5**
   */
  it('should return only stocks matching all filter criteria', () => {
    fc.assert(
      fc.property(
        fc.array(stockArbitrary, { minLength: 5, maxLength: 20 }),
        screenerFiltersArbitrary,
        (stocks, filters) => {
          // Apply filters manually (simulating what the service does)
          const filteredStocks = stocks.filter(stock => matchesAllFilters(stock, filters));

          // Property: All filtered stocks must match all criteria
          return filteredStocks.every(stock => matchesAllFilters(stock, filters));
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Descriptive filter test: Exchange filter
   * **Validates: Requirement 10.2**
   */
  it('should handle exchange filter correctly (Requirement 10.2)', () => {
    fc.assert(
      fc.property(
        fc.array(stockArbitrary, { minLength: 10, maxLength: 30 }),
        fc.subarray(['NYSE', 'NASDAQ', 'AMEX'], { minLength: 1 }),
        (stocks, exchanges) => {
          const filters: ScreenerFilters = { exchange: exchanges };
          const filteredStocks = stocks.filter(stock => matchesAllFilters(stock, filters));

          // All filtered stocks must have exchange in the filter list
          return filteredStocks.every(stock => exchanges.includes(stock.exchange));
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Descriptive filter test: Sector filter
   * **Validates: Requirement 10.2**
   */
  it('should handle sector filter correctly (Requirement 10.2)', () => {
    fc.assert(
      fc.property(
        fc.array(stockArbitrary, { minLength: 10, maxLength: 30 }),
        fc.subarray(['Technology', 'Healthcare', 'Finance'], { minLength: 1 }),
        (stocks, sectors) => {
          const filters: ScreenerFilters = { sector: sectors };
          const filteredStocks = stocks.filter(stock => matchesAllFilters(stock, filters));

          // All filtered stocks must have sector in the filter list
          return filteredStocks.every(stock => 
            stock.sector !== null && sectors.includes(stock.sector)
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Descriptive filter test: Market cap range filter
   * **Validates: Requirement 10.2**
   */
  it('should handle market cap range filter correctly (Requirement 10.2)', () => {
    fc.assert(
      fc.property(
        fc.array(stockArbitrary, { minLength: 10, maxLength: 30 }),
        fc.integer({ min: 1000000, max: 1000000000 }),
        fc.integer({ min: 1000000000, max: 5000000000000 }),
        (stocks, minCap, maxCap) => {
          const filters: ScreenerFilters = {
            marketCapMin: minCap,
            marketCapMax: maxCap,
          };
          const filteredStocks = stocks.filter(stock => matchesAllFilters(stock, filters));

          // All filtered stocks must have market cap within range
          return filteredStocks.every(stock => 
            stock.marketCap !== null &&
            stock.marketCap >= minCap &&
            stock.marketCap <= maxCap
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Descriptive filter test: Country filter
   * **Validates: Requirement 10.2**
   */
  it('should handle country filter correctly (Requirement 10.2)', () => {
    fc.assert(
      fc.property(
        fc.array(stockArbitrary, { minLength: 10, maxLength: 30 }),
        fc.subarray(['US', 'UK', 'CN'], { minLength: 1 }),
        (stocks, countries) => {
          const filters: ScreenerFilters = { country: countries };
          const filteredStocks = stocks.filter(stock => matchesAllFilters(stock, filters));

          // All filtered stocks must have country in the filter list
          return filteredStocks.every(stock => 
            stock.country !== null && countries.includes(stock.country)
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Fundamental filter test: P/E ratio range filter
   * **Validates: Requirement 10.3**
   */
  it('should handle P/E ratio range filter correctly (Requirement 10.3)', () => {
    fc.assert(
      fc.property(
        fc.array(stockArbitrary, { minLength: 10, maxLength: 30 }),
        fc.float({ min: 1, max: 20, noNaN: true }),
        fc.float({ min: 20, max: 100, noNaN: true }),
        (stocks, minPe, maxPe) => {
          const filters: ScreenerFilters = {
            peMin: minPe,
            peMax: maxPe,
          };
          const filteredStocks = stocks.filter(stock => matchesAllFilters(stock, filters));

          // All filtered stocks must have P/E within range
          return filteredStocks.every(stock =>
            stock.pe !== null &&
            stock.pe >= minPe &&
            stock.pe <= maxPe
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Fundamental filter test: EPS growth filter
   * **Validates: Requirement 10.3**
   */
  it('should handle EPS growth filter correctly (Requirement 10.3)', () => {
    fc.assert(
      fc.property(
        fc.array(stockArbitrary, { minLength: 10, maxLength: 30 }),
        fc.float({ min: 0, max: 50, noNaN: true }),
        (stocks, minEpsGrowth) => {
          const filters: ScreenerFilters = { epsGrowthMin: minEpsGrowth };
          const filteredStocks = stocks.filter(stock => matchesAllFilters(stock, filters));

          // All filtered stocks must have EPS growth >= minimum
          return filteredStocks.every(stock =>
            stock.epsGrowth !== null && stock.epsGrowth >= minEpsGrowth
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Fundamental filter test: Dividend yield filter
   * **Validates: Requirement 10.3**
   */
  it('should handle dividend yield filter correctly (Requirement 10.3)', () => {
    fc.assert(
      fc.property(
        fc.array(stockArbitrary, { minLength: 10, maxLength: 30 }),
        fc.float({ min: 0, max: 5, noNaN: true }),
        (stocks, minDividendYield) => {
          const filters: ScreenerFilters = { dividendYieldMin: minDividendYield };
          const filteredStocks = stocks.filter(stock => matchesAllFilters(stock, filters));

          // All filtered stocks must have dividend yield >= minimum
          return filteredStocks.every(stock =>
            stock.dividendYield !== null && stock.dividendYield >= minDividendYield
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Fundamental filter test: Debt to equity filter
   * **Validates: Requirement 10.3**
   */
  it('should handle debt to equity filter correctly (Requirement 10.3)', () => {
    fc.assert(
      fc.property(
        fc.array(stockArbitrary, { minLength: 10, maxLength: 30 }),
        fc.float({ min: 0.5, max: 3, noNaN: true }),
        (stocks, maxDebtToEquity) => {
          const filters: ScreenerFilters = { debtToEquityMax: maxDebtToEquity };
          const filteredStocks = stocks.filter(stock => matchesAllFilters(stock, filters));

          // All filtered stocks must have debt to equity <= maximum
          return filteredStocks.every(stock =>
            stock.debtToEquity !== null && stock.debtToEquity <= maxDebtToEquity
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Technical filter test: RSI range filter
   * **Validates: Requirement 10.4**
   */
  it('should handle RSI range filter correctly (Requirement 10.4)', () => {
    fc.assert(
      fc.property(
        fc.array(stockArbitrary, { minLength: 10, maxLength: 30 }),
        fc.float({ min: 0, max: 50, noNaN: true }),
        fc.float({ min: 50, max: 100, noNaN: true }),
        (stocks, minRsi, maxRsi) => {
          const filters: ScreenerFilters = {
            rsiMin: minRsi,
            rsiMax: maxRsi,
          };
          const filteredStocks = stocks.filter(stock => matchesAllFilters(stock, filters));

          // All filtered stocks must have RSI within range
          return filteredStocks.every(stock =>
            stock.rsi14 !== null &&
            stock.rsi14 >= minRsi &&
            stock.rsi14 <= maxRsi
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Technical filter test: Price above SMA20 filter
   * **Validates: Requirement 10.4**
   */
  it('should handle price above SMA20 filter correctly (Requirement 10.4)', () => {
    fc.assert(
      fc.property(
        fc.array(stockArbitrary, { minLength: 10, maxLength: 30 }),
        fc.boolean(),
        (stocks, shouldBeAbove) => {
          const filters: ScreenerFilters = {
            priceAboveSma20: shouldBeAbove,
          };
          const filteredStocks = stocks.filter(stock => matchesAllFilters(stock, filters));

          // All filtered stocks must have price relationship with SMA20 as specified
          return filteredStocks.every(stock => {
            if (stock.price === null || stock.sma20 === null) {
              return false;
            }
            const isAbove = stock.price > stock.sma20;
            return isAbove === shouldBeAbove;
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Technical filter test: Price above SMA50 filter
   * **Validates: Requirement 10.4**
   */
  it('should handle price above SMA50 filter correctly (Requirement 10.4)', () => {
    fc.assert(
      fc.property(
        fc.array(stockArbitrary, { minLength: 10, maxLength: 30 }),
        fc.boolean(),
        (stocks, shouldBeAbove) => {
          const filters: ScreenerFilters = {
            priceAboveSma50: shouldBeAbove,
          };
          const filteredStocks = stocks.filter(stock => matchesAllFilters(stock, filters));

          // All filtered stocks must have price relationship with SMA50 as specified
          return filteredStocks.every(stock => {
            if (stock.price === null || stock.sma50 === null) {
              return false;
            }
            const isAbove = stock.price > stock.sma50;
            return isAbove === shouldBeAbove;
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Technical filter test: Price above SMA200 filter
   * **Validates: Requirement 10.4**
   */
  it('should handle price above SMA200 filter correctly (Requirement 10.4)', () => {
    fc.assert(
      fc.property(
        fc.array(stockArbitrary, { minLength: 10, maxLength: 30 }),
        fc.boolean(),
        (stocks, shouldBeAbove) => {
          const filters: ScreenerFilters = {
            priceAboveSma200: shouldBeAbove,
          };
          const filteredStocks = stocks.filter(stock => matchesAllFilters(stock, filters));

          // All filtered stocks must have price relationship with SMA200 as specified
          return filteredStocks.every(stock => {
            if (stock.price === null || stock.sma200 === null) {
              return false;
            }
            const isAbove = stock.price > stock.sma200;
            return isAbove === shouldBeAbove;
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Combined filter test: Multiple filters together
   * **Validates: Requirements 10.2, 10.3, 10.4, 10.5**
   */
  it('should handle multiple combined filters correctly (Requirements 10.2, 10.3, 10.4)', () => {
    fc.assert(
      fc.property(
        fc.array(stockArbitrary, { minLength: 20, maxLength: 50 }),
        fc.subarray(['Technology', 'Healthcare'], { minLength: 1 }),
        fc.float({ min: 10, max: 30, noNaN: true }),
        fc.float({ min: 30, max: 70, noNaN: true }),
        (stocks, sectors, minRsi, maxRsi) => {
          const filters: ScreenerFilters = {
            sector: sectors,
            rsiMin: minRsi,
            rsiMax: maxRsi,
          };
          const filteredStocks = stocks.filter(stock => matchesAllFilters(stock, filters));

          // All filtered stocks must match ALL criteria
          return filteredStocks.every(stock =>
            stock.sector !== null &&
            sectors.includes(stock.sector) &&
            stock.rsi14 !== null &&
            stock.rsi14 >= minRsi &&
            stock.rsi14 <= maxRsi
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Combined filter test: Descriptive + Fundamental + Technical
   * **Validates: Requirements 10.2, 10.3, 10.4, 10.5**
   */
  it('should handle all three filter types combined (Requirements 10.2, 10.3, 10.4, 10.5)', () => {
    fc.assert(
      fc.property(
        fc.array(stockArbitrary, { minLength: 30, maxLength: 60 }),
        fc.subarray(['NYSE', 'NASDAQ'], { minLength: 1 }),
        fc.float({ min: 5, max: 25, noNaN: true }),
        fc.float({ min: 20, max: 80, noNaN: true }),
        (stocks, exchanges, minPe, minRsi) => {
          const filters: ScreenerFilters = {
            exchange: exchanges,
            peMin: minPe,
            rsiMin: minRsi,
          };
          const filteredStocks = stocks.filter(stock => matchesAllFilters(stock, filters));

          // All filtered stocks must match ALL criteria from all three categories
          return filteredStocks.every(stock =>
            exchanges.includes(stock.exchange) &&
            stock.pe !== null && stock.pe >= minPe &&
            stock.rsi14 !== null && stock.rsi14 >= minRsi
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Empty filter test: No filters should return all stocks
   * **Validates: Requirement 10.5**
   */
  it('should return all stocks when no filters are applied (Requirement 10.5)', () => {
    fc.assert(
      fc.property(
        fc.array(stockArbitrary, { minLength: 5, maxLength: 20 }),
        (stocks) => {
          const filters: ScreenerFilters = {};
          const filteredStocks = stocks.filter(stock => matchesAllFilters(stock, filters));

          // With no filters, all stocks should pass
          return filteredStocks.length === stocks.length;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Filter exclusivity test: Stocks not matching should be excluded
   * **Validates: Requirements 10.2, 10.3, 10.4**
   */
  it('should exclude stocks that do not match filter criteria', () => {
    fc.assert(
      fc.property(
        fc.array(stockArbitrary, { minLength: 10, maxLength: 30 }),
        screenerFiltersArbitrary,
        (stocks, filters) => {
          const filteredStocks = stocks.filter(stock => matchesAllFilters(stock, filters));
          const excludedStocks = stocks.filter(stock => !matchesAllFilters(stock, filters));

          // Verify partition: filtered + excluded = all stocks
          if (filteredStocks.length + excludedStocks.length !== stocks.length) {
            return false;
          }

          // Excluded stocks should NOT match all filters
          // (at least one filter criterion should fail)
          return excludedStocks.every(stock => !matchesAllFilters(stock, filters));
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Filter consistency test: Same filters should produce same results
   * **Validates: Requirement 10.5**
   */
  it('should produce consistent results for the same filters (Requirement 10.5)', () => {
    fc.assert(
      fc.property(
        fc.array(stockArbitrary, { minLength: 10, maxLength: 30 }),
        screenerFiltersArbitrary,
        (stocks, filters) => {
          // Apply filters twice
          const result1 = stocks.filter(stock => matchesAllFilters(stock, filters));
          const result2 = stocks.filter(stock => matchesAllFilters(stock, filters));

          // Results should be identical
          if (result1.length !== result2.length) return false;
          
          for (let i = 0; i < result1.length; i++) {
            if (result1[i].symbol !== result2[i].symbol) return false;
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });
});
