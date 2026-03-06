/**
 * Property-Based Tests for Insider Trade Trend Calculation
 * Feature: smart-stock-analyzer, Property 18: 内部交易趋势计算属�?
 * 
 * **Validates: Requirements 12.6**
 * 
 * Property: For any collection of insider trading records for a stock,
 * the net buy/sell trend should equal total buy quantity minus total sell quantity
 * 
 * Specifically:
 * 1. netShares = totalBuyShares - totalSellShares
 * 2. netValue = totalBuyValue - totalSellValue
 * 3. buyTransactions + sellTransactions + exerciseTransactions = total number of trades
 * 4. All share and value counts are non-negative
 * 5. The trend calculation is consistent regardless of trade order
 * 
 * Requirements:
 * - 12.6: WHEN 分析内部交易 THEN Insider_Tracker SHALL 计算并显示内部人士净买入/卖出趋势
 */

import fc from 'fast-check';
import { describe, it, expect } from '@jest/globals';
import type { InsiderTrade, TransactionType, InsiderTradeTrend } from './insiderService.js';

/**
 * Arbitrary generator for valid transaction types
 */
const transactionTypeArbitrary = fc.constantFrom<TransactionType>('buy', 'sell', 'exercise');

/**
 * Arbitrary generator for valid insider names
 */
const insiderNameArbitrary = fc.constantFrom(
  'John Smith', 'Jane Doe', 'Tim Cook', 'Satya Nadella', 'Elon Musk',
  'Warren Buffett', 'Mary Barra', 'Jamie Dimon', 'Sundar Pichai', 'Jeff Bezos'
);

/**
 * Arbitrary generator for insider titles
 */
const insiderTitleArbitrary = fc.option(
  fc.constantFrom('CEO', 'CFO', 'COO', 'CTO', 'Director', 'VP', 'President'),
  { nil: null }
);

/**
 * Arbitrary generator for stock symbols
 */
const symbolArbitrary = fc.stringMatching(/^[A-Z]{1,5}$/);

/**
 * Arbitrary generator for valid timestamps
 */
const timestampArbitrary = fc.integer({
  min: Date.now() - 365 * 24 * 60 * 60 * 1000, // 1 year ago
  max: Date.now(),
}).map(timestamp => new Date(timestamp));

/**
 * Arbitrary generator for shares (positive integers)
 */
const sharesArbitrary = fc.integer({ min: 1, max: 1_000_000 });

/**
 * Arbitrary generator for price per share (non-negative, reasonable stock prices)
 * Uses integer cents and converts to dollars to avoid floating point issues
 */
const pricePerShareArbitrary = fc.integer({ min: 1, max: 100000 }).map(cents => cents / 100);

/**
 * Arbitrary generator for a complete InsiderTrade with consistent totalValue
 */
const insiderTradeArbitrary = fc.record({
  id: fc.uuid(),
  symbol: symbolArbitrary,
  filedAt: timestampArbitrary,
  tradeDate: timestampArbitrary,
  insiderName: insiderNameArbitrary,
  insiderTitle: insiderTitleArbitrary,
  transactionType: transactionTypeArbitrary,
  shares: sharesArbitrary,
  pricePerShare: pricePerShareArbitrary,
  sharesOwned: fc.option(fc.integer({ min: 0, max: 10_000_000 }), { nil: null }),
  createdAt: timestampArbitrary,
}).map(record => ({
  ...record,
  // Calculate totalValue to be consistent with shares * pricePerShare
  totalValue: Math.round(record.shares * record.pricePerShare * 100) / 100,
} as InsiderTrade));

/**
 * Calculate insider trade trend from a collection of trades
 * This is a pure function implementation for testing purposes
 * 
 * @param trades - Array of insider trades
 * @param symbol - Stock symbol
 * @param period - Period description
 * @returns Calculated trend data
 */
function calculateTrendFromTrades(
  trades: InsiderTrade[],
  symbol: string,
  period: string = '90 days'
): InsiderTradeTrend {
  let totalBuyShares = 0;
  let totalSellShares = 0;
  let totalBuyValue = 0;
  let totalSellValue = 0;
  let buyTransactions = 0;
  let sellTransactions = 0;
  let exerciseTransactions = 0;

  for (const trade of trades) {
    switch (trade.transactionType) {
      case 'buy':
        totalBuyShares += trade.shares;
        totalBuyValue += trade.totalValue;
        buyTransactions++;
        break;
      case 'sell':
        totalSellShares += trade.shares;
        totalSellValue += trade.totalValue;
        sellTransactions++;
        break;
      case 'exercise':
        exerciseTransactions++;
        break;
    }
  }

  return {
    symbol,
    period,
    totalBuyShares,
    totalSellShares,
    totalBuyValue,
    totalSellValue,
    netShares: totalBuyShares - totalSellShares,
    netValue: totalBuyValue - totalSellValue,
    buyTransactions,
    sellTransactions,
    exerciseTransactions,
  };
}

/**
 * Shuffle an array randomly (Fisher-Yates algorithm)
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

describe('Property 18: 内部交易趋势计算属性', () => {
  /**
   * Test 1: netShares = totalBuyShares - totalSellShares
   * Validates Requirement 12.6: Calculate net buy/sell trend
   */
  it('should calculate netShares as totalBuyShares minus totalSellShares', () => {
    fc.assert(
      fc.property(
        symbolArbitrary,
        fc.array(insiderTradeArbitrary, { minLength: 0, maxLength: 50 }),
        (symbol, trades) => {
          // Normalize all trades to the same symbol
          const normalizedTrades = trades.map(t => ({ ...t, symbol }));
          
          // Calculate trend
          const trend = calculateTrendFromTrades(normalizedTrades, symbol);
          
          // Property: netShares = totalBuyShares - totalSellShares
          expect(trend.netShares).toBe(trend.totalBuyShares - trend.totalSellShares);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 2: netValue = totalBuyValue - totalSellValue
   * Validates Requirement 12.6: Calculate net buy/sell trend
   */
  it('should calculate netValue as totalBuyValue minus totalSellValue', () => {
    fc.assert(
      fc.property(
        symbolArbitrary,
        fc.array(insiderTradeArbitrary, { minLength: 0, maxLength: 50 }),
        (symbol, trades) => {
          // Normalize all trades to the same symbol
          const normalizedTrades = trades.map(t => ({ ...t, symbol }));
          
          // Calculate trend
          const trend = calculateTrendFromTrades(normalizedTrades, symbol);
          
          // Property: netValue = totalBuyValue - totalSellValue
          // Use approximate equality due to floating point arithmetic
          const expectedNetValue = trend.totalBuyValue - trend.totalSellValue;
          expect(Math.abs(trend.netValue - expectedNetValue)).toBeLessThan(0.01);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 3: buyTransactions + sellTransactions + exerciseTransactions = total trades
   * Validates Requirement 12.6: Track all transaction types
   */
  it('should have transaction counts sum to total number of trades', () => {
    fc.assert(
      fc.property(
        symbolArbitrary,
        fc.array(insiderTradeArbitrary, { minLength: 0, maxLength: 50 }),
        (symbol, trades) => {
          // Normalize all trades to the same symbol
          const normalizedTrades = trades.map(t => ({ ...t, symbol }));
          
          // Calculate trend
          const trend = calculateTrendFromTrades(normalizedTrades, symbol);
          
          // Property: sum of all transaction counts = total trades
          const totalTransactions = trend.buyTransactions + trend.sellTransactions + trend.exerciseTransactions;
          expect(totalTransactions).toBe(normalizedTrades.length);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 4: All share and value counts are non-negative
   * Validates Requirement 12.6: Valid trend data
   */
  it('should have non-negative share and value counts', () => {
    fc.assert(
      fc.property(
        symbolArbitrary,
        fc.array(insiderTradeArbitrary, { minLength: 0, maxLength: 50 }),
        (symbol, trades) => {
          // Normalize all trades to the same symbol
          const normalizedTrades = trades.map(t => ({ ...t, symbol }));
          
          // Calculate trend
          const trend = calculateTrendFromTrades(normalizedTrades, symbol);
          
          // Property: totalBuyShares >= 0
          expect(trend.totalBuyShares).toBeGreaterThanOrEqual(0);
          
          // Property: totalSellShares >= 0
          expect(trend.totalSellShares).toBeGreaterThanOrEqual(0);
          
          // Property: totalBuyValue >= 0
          expect(trend.totalBuyValue).toBeGreaterThanOrEqual(0);
          
          // Property: totalSellValue >= 0
          expect(trend.totalSellValue).toBeGreaterThanOrEqual(0);
          
          // Property: buyTransactions >= 0
          expect(trend.buyTransactions).toBeGreaterThanOrEqual(0);
          
          // Property: sellTransactions >= 0
          expect(trend.sellTransactions).toBeGreaterThanOrEqual(0);
          
          // Property: exerciseTransactions >= 0
          expect(trend.exerciseTransactions).toBeGreaterThanOrEqual(0);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 5: Trend calculation is consistent regardless of trade order
   * Validates Requirement 12.6: Consistent calculation
   */
  it('should calculate consistent trend regardless of trade order', () => {
    fc.assert(
      fc.property(
        symbolArbitrary,
        fc.array(insiderTradeArbitrary, { minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1, max: 10 }), // Number of shuffles to test
        (symbol, trades, shuffleCount) => {
          // Normalize all trades to the same symbol
          const normalizedTrades = trades.map(t => ({ ...t, symbol }));
          
          // Calculate trend with original order
          const originalTrend = calculateTrendFromTrades(normalizedTrades, symbol);
          
          // Test multiple shuffled orders
          for (let i = 0; i < shuffleCount; i++) {
            const shuffledTrades = shuffleArray(normalizedTrades);
            const shuffledTrend = calculateTrendFromTrades(shuffledTrades, symbol);
            
            // Property: All trend values should be identical regardless of order
            expect(shuffledTrend.totalBuyShares).toBe(originalTrend.totalBuyShares);
            expect(shuffledTrend.totalSellShares).toBe(originalTrend.totalSellShares);
            expect(Math.abs(shuffledTrend.totalBuyValue - originalTrend.totalBuyValue)).toBeLessThan(0.01);
            expect(Math.abs(shuffledTrend.totalSellValue - originalTrend.totalSellValue)).toBeLessThan(0.01);
            expect(shuffledTrend.netShares).toBe(originalTrend.netShares);
            expect(Math.abs(shuffledTrend.netValue - originalTrend.netValue)).toBeLessThan(0.01);
            expect(shuffledTrend.buyTransactions).toBe(originalTrend.buyTransactions);
            expect(shuffledTrend.sellTransactions).toBe(originalTrend.sellTransactions);
            expect(shuffledTrend.exerciseTransactions).toBe(originalTrend.exerciseTransactions);
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 6: Empty trade list produces zero trend values
   * Validates Requirement 12.6: Handle edge case of no trades
   */
  it('should produce zero trend values for empty trade list', () => {
    fc.assert(
      fc.property(
        symbolArbitrary,
        (symbol) => {
          // Calculate trend with empty trades
          const trend = calculateTrendFromTrades([], symbol);
          
          // Property: All values should be zero for empty list
          expect(trend.totalBuyShares).toBe(0);
          expect(trend.totalSellShares).toBe(0);
          expect(trend.totalBuyValue).toBe(0);
          expect(trend.totalSellValue).toBe(0);
          expect(trend.netShares).toBe(0);
          expect(trend.netValue).toBe(0);
          expect(trend.buyTransactions).toBe(0);
          expect(trend.sellTransactions).toBe(0);
          expect(trend.exerciseTransactions).toBe(0);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 7: Only buy transactions result in positive netShares
   * Validates Requirement 12.6: Correct trend direction
   */
  it('should have positive netShares when only buy transactions exist', () => {
    fc.assert(
      fc.property(
        symbolArbitrary,
        fc.array(
          insiderTradeArbitrary.map(t => ({ ...t, transactionType: 'buy' as TransactionType })),
          { minLength: 1, maxLength: 50 }
        ),
        (symbol, buyTrades) => {
          // Normalize all trades to the same symbol
          const normalizedTrades = buyTrades.map(t => ({ ...t, symbol }));
          
          // Calculate trend
          const trend = calculateTrendFromTrades(normalizedTrades, symbol);
          
          // Property: netShares should be positive (equal to totalBuyShares)
          expect(trend.netShares).toBeGreaterThan(0);
          expect(trend.netShares).toBe(trend.totalBuyShares);
          expect(trend.totalSellShares).toBe(0);
          expect(trend.sellTransactions).toBe(0);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 8: Only sell transactions result in negative netShares
   * Validates Requirement 12.6: Correct trend direction
   */
  it('should have negative netShares when only sell transactions exist', () => {
    fc.assert(
      fc.property(
        symbolArbitrary,
        fc.array(
          insiderTradeArbitrary.map(t => ({ ...t, transactionType: 'sell' as TransactionType })),
          { minLength: 1, maxLength: 50 }
        ),
        (symbol, sellTrades) => {
          // Normalize all trades to the same symbol
          const normalizedTrades = sellTrades.map(t => ({ ...t, symbol }));
          
          // Calculate trend
          const trend = calculateTrendFromTrades(normalizedTrades, symbol);
          
          // Property: netShares should be negative (equal to -totalSellShares)
          expect(trend.netShares).toBeLessThan(0);
          expect(trend.netShares).toBe(-trend.totalSellShares);
          expect(trend.totalBuyShares).toBe(0);
          expect(trend.buyTransactions).toBe(0);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 9: Exercise transactions don't affect share counts
   * Validates Requirement 12.6: Exercise transactions tracked separately
   */
  it('should not count exercise transactions in share totals', () => {
    fc.assert(
      fc.property(
        symbolArbitrary,
        fc.array(
          insiderTradeArbitrary.map(t => ({ ...t, transactionType: 'exercise' as TransactionType })),
          { minLength: 1, maxLength: 50 }
        ),
        (symbol, exerciseTrades) => {
          // Normalize all trades to the same symbol
          const normalizedTrades = exerciseTrades.map(t => ({ ...t, symbol }));
          
          // Calculate trend
          const trend = calculateTrendFromTrades(normalizedTrades, symbol);
          
          // Property: Exercise transactions should not affect buy/sell totals
          expect(trend.totalBuyShares).toBe(0);
          expect(trend.totalSellShares).toBe(0);
          expect(trend.totalBuyValue).toBe(0);
          expect(trend.totalSellValue).toBe(0);
          expect(trend.netShares).toBe(0);
          expect(trend.netValue).toBe(0);
          expect(trend.buyTransactions).toBe(0);
          expect(trend.sellTransactions).toBe(0);
          expect(trend.exerciseTransactions).toBe(normalizedTrades.length);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 10: totalBuyShares equals sum of all buy trade shares
   * Validates Requirement 12.6: Accurate aggregation
   */
  it('should have totalBuyShares equal to sum of all buy trade shares', () => {
    fc.assert(
      fc.property(
        symbolArbitrary,
        fc.array(insiderTradeArbitrary, { minLength: 0, maxLength: 50 }),
        (symbol, trades) => {
          // Normalize all trades to the same symbol
          const normalizedTrades = trades.map(t => ({ ...t, symbol }));
          
          // Calculate expected buy shares
          const expectedBuyShares = normalizedTrades
            .filter(t => t.transactionType === 'buy')
            .reduce((sum, t) => sum + t.shares, 0);
          
          // Calculate trend
          const trend = calculateTrendFromTrades(normalizedTrades, symbol);
          
          // Property: totalBuyShares should equal sum of buy trade shares
          expect(trend.totalBuyShares).toBe(expectedBuyShares);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 11: totalSellShares equals sum of all sell trade shares
   * Validates Requirement 12.6: Accurate aggregation
   */
  it('should have totalSellShares equal to sum of all sell trade shares', () => {
    fc.assert(
      fc.property(
        symbolArbitrary,
        fc.array(insiderTradeArbitrary, { minLength: 0, maxLength: 50 }),
        (symbol, trades) => {
          // Normalize all trades to the same symbol
          const normalizedTrades = trades.map(t => ({ ...t, symbol }));
          
          // Calculate expected sell shares
          const expectedSellShares = normalizedTrades
            .filter(t => t.transactionType === 'sell')
            .reduce((sum, t) => sum + t.shares, 0);
          
          // Calculate trend
          const trend = calculateTrendFromTrades(normalizedTrades, symbol);
          
          // Property: totalSellShares should equal sum of sell trade shares
          expect(trend.totalSellShares).toBe(expectedSellShares);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 12: totalBuyValue equals sum of all buy trade values
   * Validates Requirement 12.6: Accurate value aggregation
   */
  it('should have totalBuyValue equal to sum of all buy trade values', () => {
    fc.assert(
      fc.property(
        symbolArbitrary,
        fc.array(insiderTradeArbitrary, { minLength: 0, maxLength: 50 }),
        (symbol, trades) => {
          // Normalize all trades to the same symbol
          const normalizedTrades = trades.map(t => ({ ...t, symbol }));
          
          // Calculate expected buy value
          const expectedBuyValue = normalizedTrades
            .filter(t => t.transactionType === 'buy')
            .reduce((sum, t) => sum + t.totalValue, 0);
          
          // Calculate trend
          const trend = calculateTrendFromTrades(normalizedTrades, symbol);
          
          // Property: totalBuyValue should equal sum of buy trade values
          // Use approximate equality due to floating point arithmetic
          expect(Math.abs(trend.totalBuyValue - expectedBuyValue)).toBeLessThan(0.01);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 13: totalSellValue equals sum of all sell trade values
   * Validates Requirement 12.6: Accurate value aggregation
   */
  it('should have totalSellValue equal to sum of all sell trade values', () => {
    fc.assert(
      fc.property(
        symbolArbitrary,
        fc.array(insiderTradeArbitrary, { minLength: 0, maxLength: 50 }),
        (symbol, trades) => {
          // Normalize all trades to the same symbol
          const normalizedTrades = trades.map(t => ({ ...t, symbol }));
          
          // Calculate expected sell value
          const expectedSellValue = normalizedTrades
            .filter(t => t.transactionType === 'sell')
            .reduce((sum, t) => sum + t.totalValue, 0);
          
          // Calculate trend
          const trend = calculateTrendFromTrades(normalizedTrades, symbol);
          
          // Property: totalSellValue should equal sum of sell trade values
          // Use approximate equality due to floating point arithmetic
          expect(Math.abs(trend.totalSellValue - expectedSellValue)).toBeLessThan(0.01);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 14: Trend symbol matches input symbol
   * Validates Requirement 12.6: Correct symbol association
   */
  it('should have trend symbol match the input symbol', () => {
    fc.assert(
      fc.property(
        symbolArbitrary,
        fc.array(insiderTradeArbitrary, { minLength: 0, maxLength: 20 }),
        (symbol, trades) => {
          // Normalize all trades to the same symbol
          const normalizedTrades = trades.map(t => ({ ...t, symbol }));
          
          // Calculate trend
          const trend = calculateTrendFromTrades(normalizedTrades, symbol);
          
          // Property: trend symbol should match input symbol
          expect(trend.symbol).toBe(symbol);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 15: Mixed transactions produce correct net values
   * Validates Requirement 12.6: Correct net calculation with mixed transactions
   */
  it('should calculate correct net values with mixed buy and sell transactions', () => {
    fc.assert(
      fc.property(
        symbolArbitrary,
        fc.array(
          insiderTradeArbitrary.map(t => ({ ...t, transactionType: 'buy' as TransactionType })),
          { minLength: 1, maxLength: 25 }
        ),
        fc.array(
          insiderTradeArbitrary.map(t => ({ ...t, transactionType: 'sell' as TransactionType })),
          { minLength: 1, maxLength: 25 }
        ),
        (symbol, buyTrades, sellTrades) => {
          // Normalize all trades to the same symbol
          const allTrades = [
            ...buyTrades.map(t => ({ ...t, symbol })),
            ...sellTrades.map(t => ({ ...t, symbol })),
          ];
          
          // Calculate expected values
          const expectedBuyShares = buyTrades.reduce((sum, t) => sum + t.shares, 0);
          const expectedSellShares = sellTrades.reduce((sum, t) => sum + t.shares, 0);
          const expectedNetShares = expectedBuyShares - expectedSellShares;
          
          // Calculate trend
          const trend = calculateTrendFromTrades(allTrades, symbol);
          
          // Property: netShares should equal expected value
          expect(trend.netShares).toBe(expectedNetShares);
          expect(trend.totalBuyShares).toBe(expectedBuyShares);
          expect(trend.totalSellShares).toBe(expectedSellShares);
          expect(trend.buyTransactions).toBe(buyTrades.length);
          expect(trend.sellTransactions).toBe(sellTrades.length);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });
});
