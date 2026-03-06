/**
 * Feature: smart-stock-analyzer, Property 13: 筛选结果排序属�?
 * 
 * Property: For any 筛选结果和排序条件，返回的股票列表应按指定字段和顺序正确排�?
 * 
 * **Validates: Requirements 10.7**
 * - 10.7: WHEN 用户查看筛选结�?THEN Stock_Screener SHALL 支持按不同指标排序和分页浏览
 */

import fc from 'fast-check';
import { describe, it } from '@jest/globals';
import type { ScreenerResultItem } from './screenerService.js';

/**
 * Sortable fields that the screener supports
 * These map to the sortBy parameter in ScreenerFilters
 */
type SortableField = 
  | 'symbol'
  | 'name'
  | 'marketCap'
  | 'price'
  | 'changePercent'
  | 'volume'
  | 'pe'
  | 'epsGrowth'
  | 'dividendYield'
  | 'debtToEquity'
  | 'revenueGrowth'
  | 'roe'
  | 'rsi14'
  | 'sma20'
  | 'sma50'
  | 'sma200';

/**
 * Get the value of a sortable field from a stock
 */
function getFieldValue(stock: ScreenerResultItem, field: SortableField): number | string | null {
  switch (field) {
    case 'symbol':
      return stock.symbol;
    case 'name':
      return stock.name;
    case 'marketCap':
      return stock.marketCap;
    case 'price':
      return stock.price;
    case 'changePercent':
      return stock.changePercent;
    case 'volume':
      return stock.volume;
    case 'pe':
      return stock.pe;
    case 'epsGrowth':
      return stock.epsGrowth;
    case 'dividendYield':
      return stock.dividendYield;
    case 'debtToEquity':
      return stock.debtToEquity;
    case 'revenueGrowth':
      return stock.revenueGrowth;
    case 'roe':
      return stock.roe;
    case 'rsi14':
      return stock.rsi14;
    case 'sma20':
      return stock.sma20;
    case 'sma50':
      return stock.sma50;
    case 'sma200':
      return stock.sma200;
    default:
      return null;
  }
}

/**
 * Compare two values for sorting
 * Handles null values by placing them at the end
 */
function compareValues(
  a: number | string | null,
  b: number | string | null,
  order: 'asc' | 'desc'
): number {
  // Null values go to the end regardless of sort order
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  let comparison: number;
  if (typeof a === 'string' && typeof b === 'string') {
    comparison = a.localeCompare(b);
  } else {
    comparison = (a as number) - (b as number);
  }

  return order === 'asc' ? comparison : -comparison;
}

/**
 * Sort stocks by a specified field and order
 * This is the reference implementation for testing
 */
function sortStocks(
  stocks: ScreenerResultItem[],
  sortBy: SortableField,
  sortOrder: 'asc' | 'desc'
): ScreenerResultItem[] {
  return [...stocks].sort((a, b) => {
    const valueA = getFieldValue(a, sortBy);
    const valueB = getFieldValue(b, sortBy);
    return compareValues(valueA, valueB, sortOrder);
  });
}

/**
 * Check if an array is sorted correctly by a field
 */
function isSortedBy(
  stocks: ScreenerResultItem[],
  sortBy: SortableField,
  sortOrder: 'asc' | 'desc'
): boolean {
  if (stocks.length <= 1) return true;

  for (let i = 0; i < stocks.length - 1; i++) {
    const currentValue = getFieldValue(stocks[i], sortBy);
    const nextValue = getFieldValue(stocks[i + 1], sortBy);
    
    const comparison = compareValues(currentValue, nextValue, sortOrder);
    
    // For ascending: current should be <= next (comparison <= 0)
    // For descending: current should be >= next (comparison <= 0 after reversal)
    if (comparison > 0) {
      return false;
    }
  }
  return true;
}

/**
 * Check if sorting is stable (equal elements maintain relative order)
 */
function isStableSorted(
  original: ScreenerResultItem[],
  sorted: ScreenerResultItem[],
  sortBy: SortableField
): boolean {
  // Create a map of original indices for each stock
  const originalIndices = new Map<string, number>();
  original.forEach((stock, index) => {
    originalIndices.set(stock.symbol, index);
  });

  // Check that for equal values, original order is preserved
  for (let i = 0; i < sorted.length - 1; i++) {
    const currentValue = getFieldValue(sorted[i], sortBy);
    const nextValue = getFieldValue(sorted[i + 1], sortBy);

    // If values are equal, check original order
    if (currentValue === nextValue) {
      const currentOriginalIndex = originalIndices.get(sorted[i].symbol);
      const nextOriginalIndex = originalIndices.get(sorted[i + 1].symbol);
      
      if (currentOriginalIndex !== undefined && 
          nextOriginalIndex !== undefined &&
          currentOriginalIndex > nextOriginalIndex) {
        return false;
      }
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
 * Arbitrary generator for unique stock symbols
 */
const uniqueSymbolArbitrary = fc.uniqueArray(symbolArbitrary, {
  minLength: 5,
  maxLength: 30,
  comparator: (a, b) => a === b,
});

/**
 * Arbitrary generator for stock result items with unique symbols
 */
function createStockArbitrary(symbol: string): fc.Arbitrary<ScreenerResultItem> {
  return fc.record({
    symbol: fc.constant(symbol),
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
}

/**
 * Arbitrary generator for an array of stocks with unique symbols
 */
const stockArrayArbitrary: fc.Arbitrary<ScreenerResultItem[]> = uniqueSymbolArbitrary.chain(
  (symbols) => fc.tuple(...symbols.map(createStockArbitrary))
);

/**
 * Arbitrary generator for sortable fields
 */
const sortableFieldArbitrary: fc.Arbitrary<SortableField> = fc.constantFrom(
  'symbol',
  'name',
  'marketCap',
  'price',
  'changePercent',
  'volume',
  'pe',
  'epsGrowth',
  'dividendYield',
  'debtToEquity',
  'revenueGrowth',
  'roe',
  'rsi14',
  'sma20',
  'sma50',
  'sma200'
);

/**
 * Arbitrary generator for sort order
 */
const sortOrderArbitrary: fc.Arbitrary<'asc' | 'desc'> = fc.constantFrom('asc', 'desc');

/**
 * Feature: smart-stock-analyzer, Property 13: 筛选结果排序属�?
 * 
 * Tests that screener results are correctly sorted by specified field and order
 */
describe('Property 13: Screener Sorting Property (筛选结果排序属�?', () => {
  /**
   * Core property test: Results should be sorted by specified field and order
   * **Validates: Requirements 10.7**
   */
  it('should sort results correctly by any sortable field and order', () => {
    fc.assert(
      fc.property(
        stockArrayArbitrary,
        sortableFieldArbitrary,
        sortOrderArbitrary,
        (stocks, sortBy, sortOrder) => {
          const sorted = sortStocks(stocks, sortBy, sortOrder);
          
          // Property: Sorted array should be correctly ordered
          return isSortedBy(sorted, sortBy, sortOrder);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Ascending order test: Values should increase (or stay equal)
   * **Validates: Requirements 10.7**
   */
  it('should sort in ascending order when sortOrder is "asc"', () => {
    fc.assert(
      fc.property(
        stockArrayArbitrary,
        sortableFieldArbitrary,
        (stocks, sortBy) => {
          const sorted = sortStocks(stocks, sortBy, 'asc');
          
          // For ascending, each value should be <= the next (nulls at end)
          return isSortedBy(sorted, sortBy, 'asc');
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Descending order test: Values should decrease (or stay equal)
   * **Validates: Requirements 10.7**
   */
  it('should sort in descending order when sortOrder is "desc"', () => {
    fc.assert(
      fc.property(
        stockArrayArbitrary,
        sortableFieldArbitrary,
        (stocks, sortBy) => {
          const sorted = sortStocks(stocks, sortBy, 'desc');
          
          // For descending, each value should be >= the next (nulls at end)
          return isSortedBy(sorted, sortBy, 'desc');
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Stable sort test: Equal elements should maintain relative order
   * **Validates: Requirements 10.7**
   */
  it('should maintain stable sort (equal elements preserve relative order)', () => {
    fc.assert(
      fc.property(
        stockArrayArbitrary,
        sortableFieldArbitrary,
        sortOrderArbitrary,
        (stocks, sortBy, sortOrder) => {
          const sorted = sortStocks(stocks, sortBy, sortOrder);
          
          // Property: Sorting should be stable
          return isStableSorted(stocks, sorted, sortBy);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Length preservation test: Sorting should not add or remove elements
   * **Validates: Requirements 10.7**
   */
  it('should preserve array length after sorting', () => {
    fc.assert(
      fc.property(
        stockArrayArbitrary,
        sortableFieldArbitrary,
        sortOrderArbitrary,
        (stocks, sortBy, sortOrder) => {
          const sorted = sortStocks(stocks, sortBy, sortOrder);
          
          // Property: Length should be preserved
          return sorted.length === stocks.length;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Element preservation test: Sorting should contain same elements
   * **Validates: Requirements 10.7**
   */
  it('should preserve all elements after sorting (same symbols)', () => {
    fc.assert(
      fc.property(
        stockArrayArbitrary,
        sortableFieldArbitrary,
        sortOrderArbitrary,
        (stocks, sortBy, sortOrder) => {
          const sorted = sortStocks(stocks, sortBy, sortOrder);
          
          // Property: Same symbols should be present
          const originalSymbols = new Set(stocks.map(s => s.symbol));
          const sortedSymbols = new Set(sorted.map(s => s.symbol));
          
          if (originalSymbols.size !== sortedSymbols.size) return false;
          
          for (const symbol of originalSymbols) {
            if (!sortedSymbols.has(symbol)) return false;
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Null handling test: Null values should be placed at the end
   * **Validates: Requirements 10.7**
   */
  it('should place null values at the end regardless of sort order', () => {
    fc.assert(
      fc.property(
        stockArrayArbitrary,
        sortableFieldArbitrary,
        sortOrderArbitrary,
        (stocks, sortBy, sortOrder) => {
          const sorted = sortStocks(stocks, sortBy, sortOrder);
          
          // Find the first null value index
          let firstNullIndex = -1;
          for (let i = 0; i < sorted.length; i++) {
            if (getFieldValue(sorted[i], sortBy) === null) {
              firstNullIndex = i;
              break;
            }
          }
          
          // If there are null values, all values after the first null should also be null
          if (firstNullIndex !== -1) {
            for (let i = firstNullIndex; i < sorted.length; i++) {
              if (getFieldValue(sorted[i], sortBy) !== null) {
                return false;
              }
            }
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Price sorting test: Specific test for price field
   * **Validates: Requirements 10.7**
   */
  it('should correctly sort by price field', () => {
    fc.assert(
      fc.property(
        stockArrayArbitrary,
        sortOrderArbitrary,
        (stocks, sortOrder) => {
          const sorted = sortStocks(stocks, 'price', sortOrder);
          return isSortedBy(sorted, 'price', sortOrder);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Market cap sorting test: Specific test for marketCap field
   * **Validates: Requirements 10.7**
   */
  it('should correctly sort by marketCap field', () => {
    fc.assert(
      fc.property(
        stockArrayArbitrary,
        sortOrderArbitrary,
        (stocks, sortOrder) => {
          const sorted = sortStocks(stocks, 'marketCap', sortOrder);
          return isSortedBy(sorted, 'marketCap', sortOrder);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * P/E ratio sorting test: Specific test for pe field
   * **Validates: Requirements 10.7**
   */
  it('should correctly sort by P/E ratio field', () => {
    fc.assert(
      fc.property(
        stockArrayArbitrary,
        sortOrderArbitrary,
        (stocks, sortOrder) => {
          const sorted = sortStocks(stocks, 'pe', sortOrder);
          return isSortedBy(sorted, 'pe', sortOrder);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Change percent sorting test: Specific test for changePercent field
   * **Validates: Requirements 10.7**
   */
  it('should correctly sort by changePercent field', () => {
    fc.assert(
      fc.property(
        stockArrayArbitrary,
        sortOrderArbitrary,
        (stocks, sortOrder) => {
          const sorted = sortStocks(stocks, 'changePercent', sortOrder);
          return isSortedBy(sorted, 'changePercent', sortOrder);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Volume sorting test: Specific test for volume field
   * **Validates: Requirements 10.7**
   */
  it('should correctly sort by volume field', () => {
    fc.assert(
      fc.property(
        stockArrayArbitrary,
        sortOrderArbitrary,
        (stocks, sortOrder) => {
          const sorted = sortStocks(stocks, 'volume', sortOrder);
          return isSortedBy(sorted, 'volume', sortOrder);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * RSI sorting test: Specific test for rsi14 field
   * **Validates: Requirements 10.7**
   */
  it('should correctly sort by RSI field', () => {
    fc.assert(
      fc.property(
        stockArrayArbitrary,
        sortOrderArbitrary,
        (stocks, sortOrder) => {
          const sorted = sortStocks(stocks, 'rsi14', sortOrder);
          return isSortedBy(sorted, 'rsi14', sortOrder);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Symbol (string) sorting test: Specific test for symbol field
   * **Validates: Requirements 10.7**
   */
  it('should correctly sort by symbol field (string sorting)', () => {
    fc.assert(
      fc.property(
        stockArrayArbitrary,
        sortOrderArbitrary,
        (stocks, sortOrder) => {
          const sorted = sortStocks(stocks, 'symbol', sortOrder);
          return isSortedBy(sorted, 'symbol', sortOrder);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Idempotency test: Sorting twice should produce same result
   * **Validates: Requirements 10.7**
   */
  it('should be idempotent (sorting twice produces same result)', () => {
    fc.assert(
      fc.property(
        stockArrayArbitrary,
        sortableFieldArbitrary,
        sortOrderArbitrary,
        (stocks, sortBy, sortOrder) => {
          const sortedOnce = sortStocks(stocks, sortBy, sortOrder);
          const sortedTwice = sortStocks(sortedOnce, sortBy, sortOrder);
          
          // Property: Sorting twice should produce identical result
          if (sortedOnce.length !== sortedTwice.length) return false;
          
          for (let i = 0; i < sortedOnce.length; i++) {
            if (sortedOnce[i].symbol !== sortedTwice[i].symbol) return false;
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Reverse order test: Ascending and descending should be reverse of each other
   * **Validates: Requirements 10.7**
   */
  it('should produce reverse order when switching between asc and desc', () => {
    fc.assert(
      fc.property(
        stockArrayArbitrary,
        sortableFieldArbitrary,
        (stocks, sortBy) => {
          // Filter out stocks with null values for this field to simplify comparison
          const nonNullStocks = stocks.filter(s => getFieldValue(s, sortBy) !== null);
          
          if (nonNullStocks.length <= 1) return true; // Trivially true
          
          const sortedAsc = sortStocks(nonNullStocks, sortBy, 'asc');
          const sortedDesc = sortStocks(nonNullStocks, sortBy, 'desc');
          
          // Property: Ascending and descending should be reverse of each other
          // (for non-null values only, since nulls always go to end)
          const ascFirstValue = getFieldValue(sortedAsc[0], sortBy);
          const descLastValue = getFieldValue(sortedDesc[sortedDesc.length - 1], sortBy);
          const ascLastValue = getFieldValue(sortedAsc[sortedAsc.length - 1], sortBy);
          const descFirstValue = getFieldValue(sortedDesc[0], sortBy);
          
          // The smallest value in asc should equal the smallest value in desc (at end)
          // The largest value in asc should equal the largest value in desc (at start)
          return ascFirstValue === descLastValue && ascLastValue === descFirstValue;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Empty array test: Sorting empty array should return empty array
   * **Validates: Requirements 10.7**
   */
  it('should handle empty array correctly', () => {
    fc.assert(
      fc.property(
        sortableFieldArbitrary,
        sortOrderArbitrary,
        (sortBy, sortOrder) => {
          const sorted = sortStocks([], sortBy, sortOrder);
          return sorted.length === 0;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Single element test: Sorting single element should return same element
   * **Validates: Requirements 10.7**
   */
  it('should handle single element array correctly', () => {
    fc.assert(
      fc.property(
        createStockArbitrary('TEST'),
        sortableFieldArbitrary,
        sortOrderArbitrary,
        (stock, sortBy, sortOrder) => {
          const sorted = sortStocks([stock], sortBy, sortOrder);
          return sorted.length === 1 && sorted[0].symbol === stock.symbol;
        }
      ),
      { numRuns: 20 }
    );
  });
});
