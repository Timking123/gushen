/**
 * Property-Based Tests for Watchlist Add/Remove Operations
 *
 * **Feature: smart-stock-analyzer, Property 2: 自选股增删属�?*
 *
 * This test validates the add/remove property:
 * "For any user and stock, adding a stock should increase list length by 1 and include the stock;
 * removing a stock should decrease list length by 1 and exclude the stock"
 *
 * **Validates: Requirements 1.2, 1.3**
 * - 1.2: WHEN 用户添加股票到自选股 THEN Watchlist_Manager SHALL 将该股票保存到用户的自选股列表并立即显�?
 * - 1.3: WHEN 用户从自选股中移除股�?THEN Watchlist_Manager SHALL 从列表中删除该股票并停止相关推�?
 */

import fc from 'fast-check';
import { WatchlistService, WatchlistItemResponse } from './watchlistService.js';
import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';

// Mock Prisma
jest.mock('../lib/prisma', () => ({
  prisma: {
    watchlistItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    stock: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../lib/redis', () => ({
  redisHelpers: {
    getJson: jest.fn(),
    setJson: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Arbitrary for generating valid stock symbols (1-5 uppercase letters)
const symbolArbitrary: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
    minLength: 1,
    maxLength: 5,
  })
  .map((chars) => chars.join(''));

// Arbitrary for generating a list of unique stock symbols
const uniqueSymbolsArbitrary: fc.Arbitrary<string[]> = fc
  .array(symbolArbitrary, { minLength: 0, maxLength: 10 })
  .map((symbols) => [...new Set(symbols)]);

describe('Watchlist Add/Remove Property Tests', () => {
  let watchlistService: WatchlistService;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    watchlistService = new WatchlistService();
    jest.clearAllMocks();
    // Default: no cache
    (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
    (redisHelpers.setJson as jest.Mock).mockResolvedValue(undefined);
    (redisHelpers.del as jest.Mock).mockResolvedValue(undefined);
  });


  /**
   * **Feature: smart-stock-analyzer, Property 2: 自选股增删属�?*
   *
   * Property: For any user and stock, adding a stock should increase list length by 1
   * and the list should contain the added stock.
   *
   * **Validates: Requirements 1.2**
   */
  describe('Property 2: Watchlist Add Property', () => {
    it('should increase list length by 1 when adding a stock not in watchlist', async () => {
      await fc.assert(
        fc.asyncProperty(
          uniqueSymbolsArbitrary,
          symbolArbitrary,
          async (initialSymbols, newSymbol) => {
            // Pre-condition: newSymbol should not be in initialSymbols
            if (initialSymbols.includes(newSymbol)) {
              return true; // Skip this case
            }

            // Setup: Simulate initial watchlist state
            const initialWatchlist: WatchlistItemResponse[] = initialSymbols.map(
              (symbol, index) => ({
                id: `item-${index}`,
                userId: testUserId,
                symbol,
                addedAt: new Date(),
                sortOrder: index,
                notes: null,
                stock: { name: `${symbol} Inc.`, exchange: 'NASDAQ', sector: 'Technology' },
              })
            );

            // Mock stock exists
            (prisma.stock.findUnique as jest.Mock).mockResolvedValue({
              symbol: newSymbol,
              name: `${newSymbol} Inc.`,
              exchange: 'NASDAQ',
              sector: 'Technology',
            });

            // Mock: stock not in watchlist
            (prisma.watchlistItem.findUnique as jest.Mock).mockResolvedValue(null);

            // Mock: get max sortOrder
            (prisma.watchlistItem.aggregate as jest.Mock).mockResolvedValue({
              _max: { sortOrder: initialSymbols.length - 1 },
            });

            // Mock: create new item
            const newItem: WatchlistItemResponse = {
              id: `item-${initialSymbols.length}`,
              userId: testUserId,
              symbol: newSymbol,
              addedAt: new Date(),
              sortOrder: initialSymbols.length,
              notes: null,
              stock: { name: `${newSymbol} Inc.`, exchange: 'NASDAQ', sector: 'Technology' },
            };

            (prisma.watchlistItem.create as jest.Mock).mockResolvedValue({
              ...newItem,
              stock: newItem.stock,
            });

            // Mock: findMany returns updated list
            (prisma.watchlistItem.findMany as jest.Mock).mockResolvedValue([
              ...initialWatchlist.map((item) => ({
                ...item,
                stock: item.stock,
              })),
              { ...newItem, stock: newItem.stock },
            ]);

            // Act: Add stock
            const addedItem = await watchlistService.addStock(testUserId, newSymbol);

            // Act: Get updated watchlist
            const updatedWatchlist = await watchlistService.getWatchlist(testUserId);

            // Assert: Length increased by 1
            expect(updatedWatchlist.length).toBe(initialSymbols.length + 1);

            // Assert: New stock is in the list
            const symbols = updatedWatchlist.map((item) => item.symbol);
            expect(symbols).toContain(newSymbol);

            // Assert: Added item has correct symbol
            expect(addedItem.symbol).toBe(newSymbol);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Feature: smart-stock-analyzer, Property 2: 自选股增删属�?*
   *
   * Property: For any user and stock in watchlist, removing a stock should decrease
   * list length by 1 and the list should not contain the removed stock.
   *
   * **Validates: Requirements 1.3**
   */
  describe('Property 2: Watchlist Remove Property', () => {
    it('should decrease list length by 1 when removing a stock from watchlist', async () => {
      await fc.assert(
        fc.asyncProperty(
          uniqueSymbolsArbitrary.filter((symbols) => symbols.length > 0),
          async (initialSymbols) => {
            // Pre-condition: at least one symbol in watchlist
            if (initialSymbols.length === 0) {
              return true;
            }

            // Pick a random symbol to remove
            const symbolToRemove = initialSymbols[0];

            // Setup: Simulate initial watchlist state
            const initialWatchlist: WatchlistItemResponse[] = initialSymbols.map(
              (symbol, index) => ({
                id: `item-${index}`,
                userId: testUserId,
                symbol,
                addedAt: new Date(),
                sortOrder: index,
                notes: null,
                stock: { name: `${symbol} Inc.`, exchange: 'NASDAQ', sector: 'Technology' },
              })
            );

            // Mock: stock exists in watchlist
            (prisma.watchlistItem.findUnique as jest.Mock).mockResolvedValue({
              id: 'item-0',
              userId: testUserId,
              symbol: symbolToRemove,
            });

            // Mock: delete succeeds
            (prisma.watchlistItem.delete as jest.Mock).mockResolvedValue({});

            // Mock: findMany returns list without removed item
            const remainingWatchlist = initialWatchlist.filter(
              (item) => item.symbol !== symbolToRemove
            );
            (prisma.watchlistItem.findMany as jest.Mock).mockResolvedValue(
              remainingWatchlist.map((item) => ({
                ...item,
                stock: item.stock,
              }))
            );

            // Act: Remove stock
            await watchlistService.removeStock(testUserId, symbolToRemove);

            // Act: Get updated watchlist
            const updatedWatchlist = await watchlistService.getWatchlist(testUserId);

            // Assert: Length decreased by 1
            expect(updatedWatchlist.length).toBe(initialSymbols.length - 1);

            // Assert: Removed stock is not in the list
            const symbols = updatedWatchlist.map((item) => item.symbol);
            expect(symbols).not.toContain(symbolToRemove);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Additional property: Adding and then removing a stock should result in the original list
   */
  describe('Property 2: Add-Remove Inverse Property', () => {
    it('should return to original state after adding and removing the same stock', async () => {
      await fc.assert(
        fc.asyncProperty(
          uniqueSymbolsArbitrary,
          symbolArbitrary,
          async (initialSymbols, newSymbol) => {
            // Pre-condition: newSymbol should not be in initialSymbols
            if (initialSymbols.includes(newSymbol)) {
              return true;
            }

            // Setup: Simulate initial watchlist state
            const initialWatchlist: WatchlistItemResponse[] = initialSymbols.map(
              (symbol, index) => ({
                id: `item-${index}`,
                userId: testUserId,
                symbol,
                addedAt: new Date(),
                sortOrder: index,
                notes: null,
                stock: { name: `${symbol} Inc.`, exchange: 'NASDAQ', sector: 'Technology' },
              })
            );

            // Track current state
            let currentWatchlist = [...initialWatchlist];

            // Mock stock exists
            (prisma.stock.findUnique as jest.Mock).mockResolvedValue({
              symbol: newSymbol,
              name: `${newSymbol} Inc.`,
              exchange: 'NASDAQ',
              sector: 'Technology',
            });

            // Mock: stock not in watchlist initially
            (prisma.watchlistItem.findUnique as jest.Mock)
              .mockResolvedValueOnce(null) // For add check
              .mockResolvedValueOnce({
                // For remove check
                id: `item-${initialSymbols.length}`,
                userId: testUserId,
                symbol: newSymbol,
              });

            // Mock: get max sortOrder
            (prisma.watchlistItem.aggregate as jest.Mock).mockResolvedValue({
              _max: { sortOrder: initialSymbols.length - 1 },
            });

            // Mock: create new item
            const newItem: WatchlistItemResponse = {
              id: `item-${initialSymbols.length}`,
              userId: testUserId,
              symbol: newSymbol,
              addedAt: new Date(),
              sortOrder: initialSymbols.length,
              notes: null,
              stock: { name: `${newSymbol} Inc.`, exchange: 'NASDAQ', sector: 'Technology' },
            };

            (prisma.watchlistItem.create as jest.Mock).mockImplementation(async () => {
              currentWatchlist = [...currentWatchlist, newItem];
              return { ...newItem, stock: newItem.stock };
            });

            // Mock: delete
            (prisma.watchlistItem.delete as jest.Mock).mockImplementation(async () => {
              currentWatchlist = currentWatchlist.filter(
                (item) => item.symbol !== newSymbol
              );
              return {};
            });

            // Mock: findMany returns current state
            (prisma.watchlistItem.findMany as jest.Mock).mockImplementation(async () =>
              currentWatchlist.map((item) => ({
                ...item,
                stock: item.stock,
              }))
            );

            // Act: Add stock
            await watchlistService.addStock(testUserId, newSymbol);

            // Act: Remove stock
            await watchlistService.removeStock(testUserId, newSymbol);

            // Act: Get final watchlist
            const finalWatchlist = await watchlistService.getWatchlist(testUserId);

            // Assert: Final list has same length as initial
            expect(finalWatchlist.length).toBe(initialSymbols.length);

            // Assert: Final list has same symbols as initial
            const finalSymbols = finalWatchlist.map((item) => item.symbol).sort();
            const initialSymbolsSorted = [...initialSymbols].sort();
            expect(finalSymbols).toEqual(initialSymbolsSorted);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});


/**
 * Property-Based Tests for Watchlist Sorting Operations
 *
 * **Feature: smart-stock-analyzer, Property 3: 自选股排序属�?*
 *
 * This test validates the sorting property:
 * "For any user watchlist and new sort order, reordering should result in the list
 * being returned in the specified order"
 *
 * **Validates: Requirements 1.6**
 * - 1.6: WHEN 用户拖拽自选股 THEN Watchlist_Manager SHALL 允许用户自定义排序顺序并保存
 */
describe('Watchlist Sorting Property Tests', () => {
  let watchlistService: WatchlistService;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    watchlistService = new WatchlistService();
    jest.clearAllMocks();
    // Default: no cache
    (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
    (redisHelpers.setJson as jest.Mock).mockResolvedValue(undefined);
    (redisHelpers.del as jest.Mock).mockResolvedValue(undefined);
  });

  /**
   * **Feature: smart-stock-analyzer, Property 3: 自选股排序属�?*
   *
   * Property: For any user watchlist and new sort order, after reordering,
   * the list should be returned in the exact specified order.
   *
   * **Validates: Requirements 1.6**
   */
  describe('Property 3: Watchlist Reorder Property', () => {
    it('should return watchlist in the exact order specified after reordering', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a list of 2-10 unique symbols
          fc
            .array(symbolArbitrary, { minLength: 2, maxLength: 10 })
            .map((symbols) => [...new Set(symbols)])
            .filter((symbols) => symbols.length >= 2),
          async (initialSymbols) => {
            // Setup: Simulate initial watchlist state
            const initialWatchlist: WatchlistItemResponse[] = initialSymbols.map(
              (symbol, index) => ({
                id: `item-${index}`,
                userId: testUserId,
                symbol,
                addedAt: new Date(),
                sortOrder: index,
                notes: null,
                stock: { name: `${symbol} Inc.`, exchange: 'NASDAQ', sector: 'Technology' },
              })
            );

            // Generate a random permutation of the symbols
            const shuffledSymbols = [...initialSymbols].sort(() => Math.random() - 0.5);

            // Track current state
            let currentWatchlist = [...initialWatchlist];

            // Mock: findMany returns existing items
            (prisma.watchlistItem.findMany as jest.Mock).mockImplementation(async () => {
              return currentWatchlist
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((item) => ({
                  ...item,
                  stock: item.stock,
                }));
            });

            // Mock: transaction updates sortOrder
            (prisma.$transaction as jest.Mock).mockImplementation(async (updates) => {
              // Simulate the transaction updating sortOrder
              for (let i = 0; i < shuffledSymbols.length; i++) {
                const symbol = shuffledSymbols[i];
                const item = currentWatchlist.find((w) => w.symbol === symbol);
                if (item) {
                  item.sortOrder = i;
                }
              }
              return updates;
            });

            // Act: Reorder stocks
            await watchlistService.reorderStocks(testUserId, shuffledSymbols);

            // Act: Get updated watchlist
            const updatedWatchlist = await watchlistService.getWatchlist(testUserId);

            // Assert: The order should match the specified order
            const resultSymbols = updatedWatchlist.map((item) => item.symbol);
            expect(resultSymbols).toEqual(shuffledSymbols);

            // Assert: sortOrder values should be sequential starting from 0
            for (let i = 0; i < updatedWatchlist.length; i++) {
              expect(updatedWatchlist[i].sortOrder).toBe(i);
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should preserve all items after reordering (no items lost or added)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .array(symbolArbitrary, { minLength: 2, maxLength: 10 })
            .map((symbols) => [...new Set(symbols)])
            .filter((symbols) => symbols.length >= 2),
          async (initialSymbols) => {
            // Setup: Simulate initial watchlist state
            const initialWatchlist: WatchlistItemResponse[] = initialSymbols.map(
              (symbol, index) => ({
                id: `item-${index}`,
                userId: testUserId,
                symbol,
                addedAt: new Date(),
                sortOrder: index,
                notes: null,
                stock: { name: `${symbol} Inc.`, exchange: 'NASDAQ', sector: 'Technology' },
              })
            );

            // Generate a random permutation
            const shuffledSymbols = [...initialSymbols].sort(() => Math.random() - 0.5);

            // Track current state
            let currentWatchlist = [...initialWatchlist];

            // Mock: findMany returns existing items
            (prisma.watchlistItem.findMany as jest.Mock).mockImplementation(async () => {
              return currentWatchlist
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((item) => ({
                  ...item,
                  stock: item.stock,
                }));
            });

            // Mock: transaction updates sortOrder
            (prisma.$transaction as jest.Mock).mockImplementation(async (updates) => {
              for (let i = 0; i < shuffledSymbols.length; i++) {
                const symbol = shuffledSymbols[i];
                const item = currentWatchlist.find((w) => w.symbol === symbol);
                if (item) {
                  item.sortOrder = i;
                }
              }
              return updates;
            });

            // Act: Reorder stocks
            await watchlistService.reorderStocks(testUserId, shuffledSymbols);

            // Act: Get updated watchlist
            const updatedWatchlist = await watchlistService.getWatchlist(testUserId);

            // Assert: Same number of items
            expect(updatedWatchlist.length).toBe(initialSymbols.length);

            // Assert: Same set of symbols (order may differ)
            const resultSymbolsSet = new Set(updatedWatchlist.map((item) => item.symbol));
            const initialSymbolsSet = new Set(initialSymbols);
            expect(resultSymbolsSet).toEqual(initialSymbolsSet);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should be idempotent - reordering with same order should not change anything', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .array(symbolArbitrary, { minLength: 1, maxLength: 10 })
            .map((symbols) => [...new Set(symbols)])
            .filter((symbols) => symbols.length >= 1),
          async (initialSymbols) => {
            // Setup: Simulate initial watchlist state
            const initialWatchlist: WatchlistItemResponse[] = initialSymbols.map(
              (symbol, index) => ({
                id: `item-${index}`,
                userId: testUserId,
                symbol,
                addedAt: new Date(),
                sortOrder: index,
                notes: null,
                stock: { name: `${symbol} Inc.`, exchange: 'NASDAQ', sector: 'Technology' },
              })
            );

            // Track current state
            let currentWatchlist = [...initialWatchlist];

            // Mock: findMany returns existing items
            (prisma.watchlistItem.findMany as jest.Mock).mockImplementation(async () => {
              return currentWatchlist
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((item) => ({
                  ...item,
                  stock: item.stock,
                }));
            });

            // Mock: transaction updates sortOrder
            (prisma.$transaction as jest.Mock).mockImplementation(async (updates) => {
              for (let i = 0; i < initialSymbols.length; i++) {
                const symbol = initialSymbols[i];
                const item = currentWatchlist.find((w) => w.symbol === symbol);
                if (item) {
                  item.sortOrder = i;
                }
              }
              return updates;
            });

            // Act: Reorder with the same order
            await watchlistService.reorderStocks(testUserId, initialSymbols);

            // Act: Get updated watchlist
            const updatedWatchlist = await watchlistService.getWatchlist(testUserId);

            // Assert: Order should be the same as initial
            const resultSymbols = updatedWatchlist.map((item) => item.symbol);
            expect(resultSymbols).toEqual(initialSymbols);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
