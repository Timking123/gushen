/**
 * Property-Based Tests for Transaction Type Color
 * Feature: stock-detail-and-heatmap-enhancement
 *
 * **Property 10: 交易类型颜色正确性**
 * **Validates: Requirements 8.4, 8.5**
 *
 * Property: For any insider trade, buy transactions should display green,
 * sell transactions should display red.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getTransactionTypeColorClass } from './InsiderTrades';

describe('Property 10: 交易类型颜色正确性', () => {
  /**
   * Property: Buy transactions should return 'transaction-buy' (green)
   * **Validates: Requirements 8.4**
   */
  it('should return "transaction-buy" for buy transactions (green)', () => {
    const colorClass = getTransactionTypeColorClass('buy');
    expect(colorClass).toBe('transaction-buy');
  });

  /**
   * Property: Sell transactions should return 'transaction-sell' (red)
   * **Validates: Requirements 8.5**
   */
  it('should return "transaction-sell" for sell transactions (red)', () => {
    const colorClass = getTransactionTypeColorClass('sell');
    expect(colorClass).toBe('transaction-sell');
  });

  /**
   * Property: Exercise transactions should return 'transaction-exercise'
   * **Validates: Requirements 8.4, 8.5**
   */
  it('should return "transaction-exercise" for exercise transactions', () => {
    const colorClass = getTransactionTypeColorClass('exercise');
    expect(colorClass).toBe('transaction-exercise');
  });

  /**
   * Property: Color class should be deterministic for any given transaction type
   * **Validates: Requirements 8.4, 8.5**
   */
  it('should return consistent color class for the same transaction type', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('buy', 'sell', 'exercise') as fc.Arbitrary<'buy' | 'sell' | 'exercise'>,
        (transactionType) => {
          const colorClass1 = getTransactionTypeColorClass(transactionType);
          const colorClass2 = getTransactionTypeColorClass(transactionType);
          expect(colorClass1).toBe(colorClass2);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Color class should only be one of three valid values
   * **Validates: Requirements 8.4, 8.5**
   */
  it('should only return valid color classes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('buy', 'sell', 'exercise') as fc.Arbitrary<'buy' | 'sell' | 'exercise'>,
        (transactionType) => {
          const colorClass = getTransactionTypeColorClass(transactionType);
          expect(['transaction-buy', 'transaction-sell', 'transaction-exercise']).toContain(colorClass);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: For any transaction type, the color mapping should be correct
   * - buy → 'transaction-buy' (green)
   * - sell → 'transaction-sell' (red)
   * - exercise → 'transaction-exercise'
   * **Validates: Requirements 8.4, 8.5**
   */
  it('should correctly map all transaction types to appropriate colors', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('buy', 'sell', 'exercise') as fc.Arbitrary<'buy' | 'sell' | 'exercise'>,
        (transactionType) => {
          const colorClass = getTransactionTypeColorClass(transactionType);

          if (transactionType === 'buy') {
            expect(colorClass).toBe('transaction-buy');
          } else if (transactionType === 'sell') {
            expect(colorClass).toBe('transaction-sell');
          } else {
            expect(colorClass).toBe('transaction-exercise');
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
