/**
 * Property-Based Tests for Watchlist Operations
 * Feature: stock-detail-and-heatmap-enhancement
 *
 * **Property 11: 自选股操作往返正确性**
 * **Validates: Requirements 9.3, 9.4**
 *
 * Property: For any stock code and user, after adding to watchlist the query
 * should return that the stock is in the watchlist, and after removing the
 * query should return that the stock is not in the watchlist.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

interface WatchlistState {
  stocks: Set<string>;
}

function createWatchlistState(): WatchlistState {
  return { stocks: new Set() };
}

function addToWatchlist(state: WatchlistState, symbol: string): WatchlistState {
  const newStocks = new Set(state.stocks);
  newStocks.add(symbol);
  return { stocks: newStocks };
}

function removeFromWatchlist(state: WatchlistState, symbol: string): WatchlistState {
  const newStocks = new Set(state.stocks);
  newStocks.delete(symbol);
  return { stocks: newStocks };
}

function isInWatchlist(state: WatchlistState, symbol: string): boolean {
  return state.stocks.has(symbol);
}

function toggleWatchlist(state: WatchlistState, symbol: string): WatchlistState {
  if (isInWatchlist(state, symbol)) {
    return removeFromWatchlist(state, symbol);
  } else {
    return addToWatchlist(state, symbol);
  }
}

const stockSymbolArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 5 })
  .map(s => s.replace(/[^A-Za-z]/g, '').toUpperCase())
  .filter(s => s.length >= 1 && s.length <= 5);

describe('Property 11: 自选股操作往返正确性', () => {
  it('should return true for isInWatchlist after adding a stock', () => {
    fc.assert(
      fc.property(stockSymbolArb, (symbol) => {
        const initialState = createWatchlistState();
        const stateAfterAdd = addToWatchlist(initialState, symbol);
        expect(isInWatchlist(stateAfterAdd, symbol)).toBe(true);
      }),
      { numRuns: 20 }
    );
  });

  it('should return false for isInWatchlist after removing a stock', () => {
    fc.assert(
      fc.property(stockSymbolArb, (symbol) => {
        const initialState = createWatchlistState();
        const stateAfterAdd = addToWatchlist(initialState, symbol);
        const stateAfterRemove = removeFromWatchlist(stateAfterAdd, symbol);
        expect(isInWatchlist(stateAfterRemove, symbol)).toBe(false);
      }),
      { numRuns: 20 }
    );
  });

  it('should correctly handle add-then-remove round trip', () => {
    fc.assert(
      fc.property(stockSymbolArb, (symbol) => {
        const initialState = createWatchlistState();
        const stateAfterAdd = addToWatchlist(initialState, symbol);
        expect(isInWatchlist(stateAfterAdd, symbol)).toBe(true);
        const stateAfterRemove = removeFromWatchlist(stateAfterAdd, symbol);
        expect(isInWatchlist(stateAfterRemove, symbol)).toBe(false);
      }),
      { numRuns: 20 }
    );
  });

  it('should toggle watchlist status correctly', () => {
    fc.assert(
      fc.property(stockSymbolArb, (symbol) => {
        const initialState = createWatchlistState();
        expect(isInWatchlist(initialState, symbol)).toBe(false);
        const stateAfterFirstToggle = toggleWatchlist(initialState, symbol);
        expect(isInWatchlist(stateAfterFirstToggle, symbol)).toBe(true);
        const stateAfterSecondToggle = toggleWatchlist(stateAfterFirstToggle, symbol);
        expect(isInWatchlist(stateAfterSecondToggle, symbol)).toBe(false);
      }),
      { numRuns: 20 }
    );
  });

  it('should be idempotent when adding the same stock multiple times', () => {
    fc.assert(
      fc.property(stockSymbolArb, fc.nat({ max: 10 }), (symbol, repeatCount) => {
        let state = createWatchlistState();
        for (let i = 0; i <= repeatCount; i++) {
          state = addToWatchlist(state, symbol);
        }
        expect(isInWatchlist(state, symbol)).toBe(true);
        expect(state.stocks.size).toBe(1);
      }),
      { numRuns: 20 }
    );
  });

  it('should safely handle removing a stock not in watchlist', () => {
    fc.assert(
      fc.property(stockSymbolArb, (symbol) => {
        const initialState = createWatchlistState();
        const stateAfterRemove = removeFromWatchlist(initialState, symbol);
        expect(isInWatchlist(stateAfterRemove, symbol)).toBe(false);
        expect(stateAfterRemove.stocks.size).toBe(0);
      }),
      { numRuns: 20 }
    );
  });

  it('should handle multiple stocks independently', () => {
    fc.assert(
      fc.property(
        fc.array(stockSymbolArb, { minLength: 2, maxLength: 5 }),
        (symbols) => {
          const uniqueSymbols = [...new Set(symbols)];
          if (uniqueSymbols.length < 2) return;
          let state = createWatchlistState();
          for (const symbol of uniqueSymbols) {
            state = addToWatchlist(state, symbol);
          }
          for (const symbol of uniqueSymbols) {
            expect(isInWatchlist(state, symbol)).toBe(true);
          }
          const firstSymbol = uniqueSymbols[0];
          state = removeFromWatchlist(state, firstSymbol);
          expect(isInWatchlist(state, firstSymbol)).toBe(false);
          for (let i = 1; i < uniqueSymbols.length; i++) {
            expect(isInWatchlist(state, uniqueSymbols[i])).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should maintain consistency through a sequence of operations', () => {
    type Operation = { type: 'add'; symbol: string } | { type: 'remove'; symbol: string };
    const operationArb: fc.Arbitrary<Operation> = fc.oneof(
      stockSymbolArb.map((symbol): Operation => ({ type: 'add', symbol })),
      stockSymbolArb.map((symbol): Operation => ({ type: 'remove', symbol }))
    );
    fc.assert(
      fc.property(fc.array(operationArb, { maxLength: 10 }), (operations) => {
        let state = createWatchlistState();
        const expectedState = new Set<string>();
        for (const op of operations) {
          if (op.type === 'add') {
            state = addToWatchlist(state, op.symbol);
            expectedState.add(op.symbol);
          } else {
            state = removeFromWatchlist(state, op.symbol);
            expectedState.delete(op.symbol);
          }
        }
        expect(state.stocks.size).toBe(expectedState.size);
        for (const symbol of expectedState) {
          expect(isInWatchlist(state, symbol)).toBe(true);
        }
      }),
      { numRuns: 20 }
    );
  });
});
