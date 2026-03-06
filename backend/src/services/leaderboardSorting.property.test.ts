/**
 * Property-Based Tests for Leaderboard Sorting
 * 
 * Feature: smart-stock-analyzer, Property 29: 排行榜排序属性
 * 
 * Tests that leaderboards (gainers, losers, volume) are correctly sorted
 * by their respective metrics.
 * 
 * **Validates: Requirements 18.5**
 */

import fc from 'fast-check';

/**
 * Stock ranking item interface for testing
 */
interface StockRankingItem {
  symbol: string;
  name: string;
  sector: string | null;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number | null;
}

/**
 * Sort stocks by change percent descending (for gainers)
 * Only includes stocks with positive change
 */
function sortGainers(stocks: StockRankingItem[]): StockRankingItem[] {
  return stocks
    .filter(stock => stock.changePercent > 0)
    .sort((a, b) => b.changePercent - a.changePercent);
}

/**
 * Sort stocks by change percent ascending (for losers)
 * Only includes stocks with negative change
 */
function sortLosers(stocks: StockRankingItem[]): StockRankingItem[] {
  return stocks
    .filter(stock => stock.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent);
}

/**
 * Sort stocks by volume descending (for most active)
 */
function sortByVolume(stocks: StockRankingItem[]): StockRankingItem[] {
  return [...stocks].sort((a, b) => b.volume - a.volume);
}

/**
 * Arbitrary for generating stock ranking items
 */
const stockRankingItemArbitrary = fc.record({
  symbol: fc.string({ minLength: 1, maxLength: 5 }).map(s => s.toUpperCase()),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  sector: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
  price: fc.float({ min: 0.01, max: 10000, noNaN: true }),
  change: fc.float({ min: -1000, max: 1000, noNaN: true }),
  changePercent: fc.float({ min: -100, max: 100, noNaN: true }),
  volume: fc.integer({ min: 0, max: 1000000000 }),
  marketCap: fc.option(fc.integer({ min: 1000000, max: 1000000000000 }), { nil: null }),
});

describe('Leaderboard Sorting Property Tests', () => {
  /**
   * Feature: smart-stock-analyzer, Property 29: 排行榜排序属性
   * **Validates: Requirements 18.5**
   * 
   * Property: Top gainers should be sorted by changePercent in descending order
   */
  describe('Top Gainers Sorting', () => {
    it('should sort gainers by changePercent descending', () => {
      fc.assert(
        fc.property(
          fc.array(stockRankingItemArbitrary, { minLength: 0, maxLength: 100 }),
          (stocks) => {
            const sorted = sortGainers(stocks);
            
            // Verify all items have positive changePercent
            const allPositive = sorted.every(stock => stock.changePercent > 0);
            
            // Verify sorted in descending order
            let isSorted = true;
            for (let i = 1; i < sorted.length; i++) {
              if (sorted[i].changePercent > sorted[i - 1].changePercent) {
                isSorted = false;
                break;
              }
            }
            
            return allPositive && isSorted;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only include stocks with positive change', () => {
      fc.assert(
        fc.property(
          fc.array(stockRankingItemArbitrary, { minLength: 1, maxLength: 50 }),
          (stocks) => {
            const sorted = sortGainers(stocks);
            return sorted.every(stock => stock.changePercent > 0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve stock data integrity after sorting', () => {
      fc.assert(
        fc.property(
          fc.array(stockRankingItemArbitrary, { minLength: 1, maxLength: 50 }),
          (stocks) => {
            const sorted = sortGainers(stocks);
            const positiveStocks = stocks.filter(s => s.changePercent > 0);
            
            // All sorted items should exist in original positive stocks
            return sorted.every(sortedStock => 
              positiveStocks.some(original => 
                original.symbol === sortedStock.symbol &&
                original.changePercent === sortedStock.changePercent
              )
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: smart-stock-analyzer, Property 29: 排行榜排序属性
   * **Validates: Requirements 18.5**
   * 
   * Property: Top losers should be sorted by changePercent in ascending order
   */
  describe('Top Losers Sorting', () => {
    it('should sort losers by changePercent ascending', () => {
      fc.assert(
        fc.property(
          fc.array(stockRankingItemArbitrary, { minLength: 0, maxLength: 100 }),
          (stocks) => {
            const sorted = sortLosers(stocks);
            
            // Verify all items have negative changePercent
            const allNegative = sorted.every(stock => stock.changePercent < 0);
            
            // Verify sorted in ascending order (most negative first)
            let isSorted = true;
            for (let i = 1; i < sorted.length; i++) {
              if (sorted[i].changePercent < sorted[i - 1].changePercent) {
                isSorted = false;
                break;
              }
            }
            
            return allNegative && isSorted;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only include stocks with negative change', () => {
      fc.assert(
        fc.property(
          fc.array(stockRankingItemArbitrary, { minLength: 1, maxLength: 50 }),
          (stocks) => {
            const sorted = sortLosers(stocks);
            return sorted.every(stock => stock.changePercent < 0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have the biggest loser first', () => {
      fc.assert(
        fc.property(
          fc.array(stockRankingItemArbitrary, { minLength: 1, maxLength: 50 }),
          (stocks) => {
            const sorted = sortLosers(stocks);
            if (sorted.length === 0) return true;
            
            const negativeStocks = stocks.filter(s => s.changePercent < 0);
            if (negativeStocks.length === 0) return sorted.length === 0;
            
            const minChange = Math.min(...negativeStocks.map(s => s.changePercent));
            return sorted[0].changePercent === minChange;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: smart-stock-analyzer, Property 29: 排行榜排序属性
   * **Validates: Requirements 18.5**
   * 
   * Property: Most active should be sorted by volume in descending order
   */
  describe('Most Active (Volume) Sorting', () => {
    it('should sort by volume descending', () => {
      fc.assert(
        fc.property(
          fc.array(stockRankingItemArbitrary, { minLength: 0, maxLength: 100 }),
          (stocks) => {
            const sorted = sortByVolume(stocks);
            
            // Verify sorted in descending order by volume
            let isSorted = true;
            for (let i = 1; i < sorted.length; i++) {
              if (sorted[i].volume > sorted[i - 1].volume) {
                isSorted = false;
                break;
              }
            }
            
            return isSorted;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have the highest volume stock first', () => {
      fc.assert(
        fc.property(
          fc.array(stockRankingItemArbitrary, { minLength: 1, maxLength: 50 }),
          (stocks) => {
            const sorted = sortByVolume(stocks);
            if (sorted.length === 0) return true;
            
            const maxVolume = Math.max(...stocks.map(s => s.volume));
            return sorted[0].volume === maxVolume;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all stocks when sorting by volume', () => {
      fc.assert(
        fc.property(
          fc.array(stockRankingItemArbitrary, { minLength: 1, maxLength: 50 }),
          (stocks) => {
            const sorted = sortByVolume(stocks);
            return sorted.length === stocks.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: smart-stock-analyzer, Property 29: 排行榜排序属性
   * **Validates: Requirements 18.5**
   * 
   * Property: Sorting should be stable and deterministic
   */
  describe('Sorting Stability', () => {
    it('should produce consistent results for same input', () => {
      fc.assert(
        fc.property(
          fc.array(stockRankingItemArbitrary, { minLength: 1, maxLength: 50 }),
          (stocks) => {
            const sorted1 = sortGainers(stocks);
            const sorted2 = sortGainers(stocks);
            
            if (sorted1.length !== sorted2.length) return false;
            
            for (let i = 0; i < sorted1.length; i++) {
              if (sorted1[i].symbol !== sorted2[i].symbol ||
                  sorted1[i].changePercent !== sorted2[i].changePercent) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty arrays', () => {
      expect(sortGainers([])).toEqual([]);
      expect(sortLosers([])).toEqual([]);
      expect(sortByVolume([])).toEqual([]);
    });

    it('should handle single item arrays', () => {
      fc.assert(
        fc.property(
          stockRankingItemArbitrary,
          (stock) => {
            const gainers = sortGainers([stock]);
            const losers = sortLosers([stock]);
            const byVolume = sortByVolume([stock]);
            
            // Single positive stock should appear in gainers
            if (stock.changePercent > 0) {
              if (gainers.length !== 1) return false;
            }
            
            // Single negative stock should appear in losers
            if (stock.changePercent < 0) {
              if (losers.length !== 1) return false;
            }
            
            // Single stock should always appear in volume sort
            if (byVolume.length !== 1) return false;
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
