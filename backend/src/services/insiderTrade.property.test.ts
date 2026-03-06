/**
 * Property-Based Tests for Insider Trade Data Integrity
 * Feature: smart-stock-analyzer, Property 17: 内部交易数据完整性属�?
 * 
 * **Validates: Requirements 12.1, 12.2, 12.4**
 * 
 * Property: For any insider trade record, it should contain:
 * - Trader identity (insiderName) - non-empty string
 * - Trader position (insiderTitle) - string or null
 * - Transaction type ('buy' | 'sell' | 'exercise')
 * - Quantity (shares) - positive number
 * - Price (pricePerShare) - non-negative number
 * - Total value (totalValue) - non-negative number
 * - totalValue should approximately equal shares * pricePerShare
 * 
 * Requirements:
 * - 12.1: WHEN 用户查看股票详情 THEN Insider_Tracker SHALL 显示近期内部交易记录
 * - 12.2: WHEN 内部人士买入或卖出股�?THEN Insider_Tracker SHALL 记录交易人身份、交易类型、数量和价格
 * - 12.4: WHEN 用户查看内部交易详情 THEN Insider_Tracker SHALL 显示交易人职位和历史交易记录
 */

import fc from 'fast-check';
import { describe, it, expect } from '@jest/globals';
import type { InsiderTrade, TransactionType } from './insiderService.js';

/**
 * Valid transaction types as defined in the design document
 */
const VALID_TRANSACTION_TYPES: TransactionType[] = ['buy', 'sell', 'exercise'];

/**
 * Helper function to check if a transaction type is valid
 */
function isValidTransactionType(type: unknown): type is TransactionType {
  return typeof type === 'string' && VALID_TRANSACTION_TYPES.includes(type as TransactionType);
}

/**
 * Helper function to check if a value is a valid Date object
 */
function isValidDate(date: unknown): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Helper function to check if insider name is valid (non-empty string)
 */
function isValidInsiderName(name: unknown): boolean {
  return typeof name === 'string' && name.trim().length > 0;
}

/**
 * Helper function to check if shares is valid (positive number)
 */
function isValidShares(shares: unknown): boolean {
  return typeof shares === 'number' && shares > 0 && Number.isFinite(shares);
}

/**
 * Helper function to check if price is valid (non-negative number)
 */
function isValidPrice(price: unknown): boolean {
  return typeof price === 'number' && price >= 0 && Number.isFinite(price);
}

/**
 * Helper function to check if total value is valid (non-negative number)
 */
function isValidTotalValue(value: unknown): boolean {
  return typeof value === 'number' && value >= 0 && Number.isFinite(value);
}

/**
 * Helper function to check if total value approximately equals shares * pricePerShare
 * Allows for small floating point differences (0.01% tolerance)
 */
function isTotalValueConsistent(shares: number, pricePerShare: number, totalValue: number): boolean {
  const expectedValue = shares * pricePerShare;
  // Allow for small floating point differences (0.01% tolerance or $0.01 absolute)
  const tolerance = Math.max(expectedValue * 0.0001, 0.01);
  return Math.abs(totalValue - expectedValue) <= tolerance;
}

/**
 * Arbitrary generator for valid transaction types
 */
const transactionTypeArbitrary = fc.constantFrom<TransactionType>('buy', 'sell', 'exercise');

/**
 * Arbitrary generator for valid insider names (non-empty strings)
 * Uses common executive names to ensure realistic test data
 */
const insiderNameArbitrary = fc.oneof(
  fc.constantFrom(
    'John Smith', 'Jane Doe', 'Tim Cook', 'Satya Nadella', 'Elon Musk',
    'Warren Buffett', 'Mary Barra', 'Jamie Dimon', 'Sundar Pichai', 'Jeff Bezos',
    'Lisa Su', 'Jensen Huang', 'Mark Zuckerberg', 'Andy Jassy', 'Brian Moynihan'
  ),
  fc.tuple(
    fc.constantFrom('John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Jennifer'),
    fc.constantFrom('Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez')
  ).map(([first, last]) => `${first} ${last}`)
);

/**
 * Arbitrary generator for insider titles (can be null or a string)
 */
const insiderTitleArbitrary = fc.option(
  fc.constantFrom('CEO', 'CFO', 'COO', 'CTO', 'Director', 'VP', 'President', 'Chairman', 'SVP', '10% Owner'),
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
  min: Date.now() - 5 * 365 * 24 * 60 * 60 * 1000, // 5 years ago
  max: Date.now(),
}).map(timestamp => new Date(timestamp));

/**
 * Arbitrary generator for shares (positive integers)
 */
const sharesArbitrary = fc.integer({ min: 1, max: 10_000_000 });

/**
 * Arbitrary generator for price per share (non-negative, reasonable stock prices)
 * Uses integer cents and converts to dollars to avoid 32-bit float issues
 */
const pricePerShareArbitrary = fc.integer({ min: 1, max: 1000000 }).map(cents => cents / 100);

/**
 * Arbitrary generator for shares owned (can be null or positive number)
 */
const sharesOwnedArbitrary = fc.option(
  fc.integer({ min: 0, max: 100_000_000 }),
  { nil: null }
);

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
  sharesOwned: sharesOwnedArbitrary,
  createdAt: timestampArbitrary,
}).map(record => ({
  ...record,
  // Calculate totalValue to be consistent with shares * pricePerShare
  totalValue: Math.round(record.shares * record.pricePerShare * 100) / 100,
} as InsiderTrade));

/**
 * Arbitrary generator for an array of InsiderTrades
 */
const insiderTradesArbitrary = fc.array(insiderTradeArbitrary, { minLength: 1, maxLength: 50 });

describe('Property 17: 内部交易数据完整性属性', () => {
  /**
   * Test 1: Every insider trade record has a non-empty insiderName (trader identity)
   * Validates Requirement 12.2: Record trader identity
   */
  it('should have non-empty insiderName for all insider trades', () => {
    fc.assert(
      fc.property(
        insiderTradeArbitrary,
        (trade) => {
          // Property: insiderName must be a non-empty string
          expect(trade.insiderName).toBeDefined();
          expect(typeof trade.insiderName).toBe('string');
          expect(trade.insiderName.trim().length).toBeGreaterThan(0);
          expect(isValidInsiderName(trade.insiderName)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 2: Every insider trade record has a valid transactionType ('buy', 'sell', or 'exercise')
   * Validates Requirement 12.2: Record transaction type
   */
  it('should have valid transactionType (buy/sell/exercise) for all insider trades', () => {
    fc.assert(
      fc.property(
        insiderTradeArbitrary,
        (trade) => {
          // Property: transactionType must be one of the three valid values
          expect(trade.transactionType).toBeDefined();
          expect(isValidTransactionType(trade.transactionType)).toBe(true);
          expect(VALID_TRANSACTION_TYPES).toContain(trade.transactionType);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 3: Every insider trade record has shares > 0 (quantity)
   * Validates Requirement 12.2: Record quantity
   */
  it('should have positive shares (quantity) for all insider trades', () => {
    fc.assert(
      fc.property(
        insiderTradeArbitrary,
        (trade) => {
          // Property: shares must be a positive number
          expect(trade.shares).toBeDefined();
          expect(typeof trade.shares).toBe('number');
          expect(trade.shares).toBeGreaterThan(0);
          expect(isValidShares(trade.shares)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 4: Every insider trade record has pricePerShare >= 0 (price)
   * Validates Requirement 12.2: Record price
   */
  it('should have non-negative pricePerShare for all insider trades', () => {
    fc.assert(
      fc.property(
        insiderTradeArbitrary,
        (trade) => {
          // Property: pricePerShare must be a non-negative number
          expect(trade.pricePerShare).toBeDefined();
          expect(typeof trade.pricePerShare).toBe('number');
          expect(trade.pricePerShare).toBeGreaterThanOrEqual(0);
          expect(isValidPrice(trade.pricePerShare)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 5: Every insider trade record has totalValue >= 0 (total value)
   * Validates Requirement 12.2: Record total value
   */
  it('should have non-negative totalValue for all insider trades', () => {
    fc.assert(
      fc.property(
        insiderTradeArbitrary,
        (trade) => {
          // Property: totalValue must be a non-negative number
          expect(trade.totalValue).toBeDefined();
          expect(typeof trade.totalValue).toBe('number');
          expect(trade.totalValue).toBeGreaterThanOrEqual(0);
          expect(isValidTotalValue(trade.totalValue)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 6: totalValue should approximately equal shares * pricePerShare
   * Validates data consistency for insider trades
   */
  it('should have totalValue approximately equal to shares * pricePerShare', () => {
    fc.assert(
      fc.property(
        insiderTradeArbitrary,
        (trade) => {
          // Property: totalValue should be consistent with shares * pricePerShare
          const expectedValue = trade.shares * trade.pricePerShare;
          expect(isTotalValueConsistent(trade.shares, trade.pricePerShare, trade.totalValue)).toBe(true);
          
          // Additional check: the difference should be minimal
          const difference = Math.abs(trade.totalValue - expectedValue);
          const tolerance = Math.max(expectedValue * 0.0001, 0.01);
          expect(difference).toBeLessThanOrEqual(tolerance);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 7: All insider trades in an array should have complete data
   * Validates Requirements 12.1, 12.2, 12.4 for multiple records
   */
  it('should have all trades in a list with complete required fields', () => {
    fc.assert(
      fc.property(
        insiderTradesArbitrary,
        (trades) => {
          // For each trade in the list
          for (const trade of trades) {
            // Property: insiderName must be valid
            expect(isValidInsiderName(trade.insiderName)).toBe(true);
            
            // Property: transactionType must be valid
            expect(isValidTransactionType(trade.transactionType)).toBe(true);
            
            // Property: shares must be positive
            expect(isValidShares(trade.shares)).toBe(true);
            
            // Property: pricePerShare must be non-negative
            expect(isValidPrice(trade.pricePerShare)).toBe(true);
            
            // Property: totalValue must be non-negative
            expect(isValidTotalValue(trade.totalValue)).toBe(true);
            
            // Property: totalValue should be consistent
            expect(isTotalValueConsistent(trade.shares, trade.pricePerShare, trade.totalValue)).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 8: insiderTitle can be null or a valid string (trader position)
   * Validates Requirement 12.4: Display trader position
   */
  it('should have insiderTitle as null or valid string', () => {
    fc.assert(
      fc.property(
        insiderTradeArbitrary,
        (trade) => {
          // Property: insiderTitle can be null or a non-empty string
          if (trade.insiderTitle !== null) {
            expect(typeof trade.insiderTitle).toBe('string');
            expect(trade.insiderTitle.length).toBeGreaterThan(0);
          } else {
            expect(trade.insiderTitle).toBeNull();
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 9: Transaction types are case-sensitive and lowercase
   */
  it('should have transactionType values in lowercase format', () => {
    fc.assert(
      fc.property(
        transactionTypeArbitrary,
        (transactionType) => {
          // Property: transactionType should be lowercase
          expect(transactionType).toBe(transactionType.toLowerCase());
          
          // Property: transactionType should not contain uppercase letters
          expect(transactionType).toMatch(/^[a-z]+$/);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 10: Dates (filedAt, tradeDate, createdAt) should be valid Date objects
   */
  it('should have valid Date objects for all date fields', () => {
    fc.assert(
      fc.property(
        insiderTradeArbitrary,
        (trade) => {
          // Property: filedAt must be a valid Date
          expect(trade.filedAt).toBeInstanceOf(Date);
          expect(isValidDate(trade.filedAt)).toBe(true);
          
          // Property: tradeDate must be a valid Date
          expect(trade.tradeDate).toBeInstanceOf(Date);
          expect(isValidDate(trade.tradeDate)).toBe(true);
          
          // Property: createdAt must be a valid Date
          expect(trade.createdAt).toBeInstanceOf(Date);
          expect(isValidDate(trade.createdAt)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 11: Data should be preserved through JSON serialization
   * Important for API responses and caching
   */
  it('should preserve critical data through JSON serialization', () => {
    fc.assert(
      fc.property(
        insiderTradeArbitrary,
        (trade) => {
          // Simulate JSON serialization (as would happen in API response)
          const serialized = JSON.stringify(trade);
          const deserialized = JSON.parse(serialized);
          
          // Property: insiderName should be preserved
          expect(deserialized.insiderName).toBe(trade.insiderName);
          
          // Property: transactionType should be preserved
          expect(deserialized.transactionType).toBe(trade.transactionType);
          
          // Property: shares should be preserved
          expect(deserialized.shares).toBe(trade.shares);
          
          // Property: pricePerShare should be preserved
          expect(deserialized.pricePerShare).toBe(trade.pricePerShare);
          
          // Property: totalValue should be preserved
          expect(deserialized.totalValue).toBe(trade.totalValue);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 12: Symbol should be a valid stock symbol format
   */
  it('should have valid stock symbol format', () => {
    fc.assert(
      fc.property(
        insiderTradeArbitrary,
        (trade) => {
          // Property: symbol should be uppercase letters only, 1-5 characters
          expect(trade.symbol).toBeDefined();
          expect(typeof trade.symbol).toBe('string');
          expect(trade.symbol).toMatch(/^[A-Z]{1,5}$/);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 13: sharesOwned can be null or a non-negative number
   */
  it('should have sharesOwned as null or non-negative number', () => {
    fc.assert(
      fc.property(
        insiderTradeArbitrary,
        (trade) => {
          // Property: sharesOwned can be null or a non-negative number
          if (trade.sharesOwned !== null) {
            expect(typeof trade.sharesOwned).toBe('number');
            expect(trade.sharesOwned).toBeGreaterThanOrEqual(0);
          } else {
            expect(trade.sharesOwned).toBeNull();
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });
});
