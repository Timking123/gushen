/**
 * Property-Based Tests for Insider Trade Summary
 * Feature: stock-detail-and-heatmap-enhancement
 *
 * **Property 9: 内部交易汇总正确性**
 * **Validates: Requirements 8.3**
 *
 * Property: For any insider trade records, the buy summary total shares should
 * equal the sum of all buy transaction shares, sell summary should equal the
 * sum of all sell transaction shares, and net shares should equal buy - sell.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { InsiderTrade, InsiderTradeSummary } from '../types';

/**
 * Calculates insider trade summary from a list of trades.
 * This is a pure function that can be tested with property-based testing.
 *
 * @param trades - List of insider trades
 * @returns Calculated summary
 */
export function calculateInsiderTradeSummary(trades: InsiderTrade[]): InsiderTradeSummary {
  let totalBuyShares = 0;
  let totalBuyValue = 0;
  let totalSellShares = 0;
  let totalSellValue = 0;
  let buyTransactions = 0;
  let sellTransactions = 0;

  for (const trade of trades) {
    if (trade.transactionType === 'buy') {
      totalBuyShares += trade.shares;
      totalBuyValue += trade.totalValue;
      buyTransactions++;
    } else if (trade.transactionType === 'sell') {
      totalSellShares += trade.shares;
      totalSellValue += trade.totalValue;
      sellTransactions++;
    }
  }

  return {
    symbol: trades.length > 0 ? trades[0].symbol : 'TEST',
    period: '3M',
    totalBuyShares,
    totalBuyValue,
    totalSellShares,
    totalSellValue,
    netShares: totalBuyShares - totalSellShares,
    netValue: totalBuyValue - totalSellValue,
    buyTransactions,
    sellTransactions,
  };
}

/**
 * Generates a valid InsiderTrade
 */
const insiderTradeArb = fc.record({
  id: fc.uuid(),
  symbol: fc.constant('TEST'),
  filedAt: fc.date().map((d) => d.toISOString()),
  tradeDate: fc.date().map((d) => d.toISOString()),
  insiderName: fc.string({ minLength: 1, maxLength: 50 }),
  insiderTitle: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 50 })),
  transactionType: fc.constantFrom('buy', 'sell', 'exercise') as fc.Arbitrary<'buy' | 'sell' | 'exercise'>,
  shares: fc.nat({ max: 1000000 }),
  pricePerShare: fc.nat({ max: 10000 }),
  totalValue: fc.nat({ max: 100000000 }),
  sharesOwned: fc.oneof(fc.constant(null), fc.nat({ max: 10000000 })),
});

describe('Property 9: 内部交易汇总正确性', () => {
  /**
   * Property: Total buy shares should equal sum of all buy transaction shares
   * **Validates: Requirements 8.3**
   */
  it('should calculate total buy shares correctly', () => {
    fc.assert(
      fc.property(fc.array(insiderTradeArb, { maxLength: 20 }), (trades) => {
        const summary = calculateInsiderTradeSummary(trades);
        const expectedBuyShares = trades
          .filter((t) => t.transactionType === 'buy')
          .reduce((sum, t) => sum + t.shares, 0);
        expect(summary.totalBuyShares).toBe(expectedBuyShares);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Total sell shares should equal sum of all sell transaction shares
   * **Validates: Requirements 8.3**
   */
  it('should calculate total sell shares correctly', () => {
    fc.assert(
      fc.property(fc.array(insiderTradeArb, { maxLength: 20 }), (trades) => {
        const summary = calculateInsiderTradeSummary(trades);
        const expectedSellShares = trades
          .filter((t) => t.transactionType === 'sell')
          .reduce((sum, t) => sum + t.shares, 0);
        expect(summary.totalSellShares).toBe(expectedSellShares);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Net shares should equal buy shares minus sell shares
   * **Validates: Requirements 8.3**
   */
  it('should calculate net shares correctly', () => {
    fc.assert(
      fc.property(fc.array(insiderTradeArb, { maxLength: 20 }), (trades) => {
        const summary = calculateInsiderTradeSummary(trades);
        expect(summary.netShares).toBe(summary.totalBuyShares - summary.totalSellShares);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Transaction counts should match the number of buy/sell transactions
   * **Validates: Requirements 8.3**
   */
  it('should count transactions correctly', () => {
    fc.assert(
      fc.property(fc.array(insiderTradeArb, { maxLength: 20 }), (trades) => {
        const summary = calculateInsiderTradeSummary(trades);
        const expectedBuyCount = trades.filter((t) => t.transactionType === 'buy').length;
        const expectedSellCount = trades.filter((t) => t.transactionType === 'sell').length;
        expect(summary.buyTransactions).toBe(expectedBuyCount);
        expect(summary.sellTransactions).toBe(expectedSellCount);
      }),
      { numRuns: 20 }
    );
  });
});
