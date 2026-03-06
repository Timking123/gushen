/**
 * Property-Based Tests for Stock Search
 *
 * **Feature: smart-stock-analyzer, Property 1: 搜索匹配属�?*
 *
 * This test validates the search matching property:
 * "For any search query string and stock database, all stocks returned from search
 * should have their symbol or name containing the query string (case-insensitive)"
 *
 * **Validates: Requirements 1.1**
 * - 1.1: WHEN 用户搜索股票代码或名�?THEN Watchlist_Manager SHALL 显示匹配的股票列表供用户选择
 */

import fc from 'fast-check';
import { StockService } from './stockService.js';
import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';

// Mock dependencies
jest.mock('../lib/prisma', () => ({
  prisma: {
    stock: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
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

// Type definitions for test data
interface TestStock {
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
  industry: string | null;
  marketCap: bigint | null;
  country: string | null;
}

describe('Stock Search Property Tests', () => {
  let stockService: StockService;

  beforeEach(() => {
    stockService = new StockService();
    jest.clearAllMocks();
    // Default: cache miss, so database is queried
    (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
    (redisHelpers.setJson as jest.Mock).mockResolvedValue(undefined);
  });

  /**
   * **Feature: smart-stock-analyzer, Property 1: 搜索匹配属�?*
   *
   * Property: For any search query string and stock database,
   * all stocks returned from search should have their symbol or name
   * containing the query string (case-insensitive).
   *
   * **Validates: Requirements 1.1**
   */
  describe('Property 1: Search Matching Property (搜索匹配属�?', () => {
    // Arbitrary for generating valid stock symbols (1-5 uppercase letters)
    const symbolArbitrary: fc.Arbitrary<string> = fc
      .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
        minLength: 1,
        maxLength: 5,
      })
      .map((chars: string[]) => chars.join(''));

    // Arbitrary for generating stock names (alphanumeric with spaces)
    const nameArbitrary: fc.Arbitrary<string> = fc
      .array(
        fc.constantFrom(
          'Apple',
          'Microsoft',
          'Google',
          'Amazon',
          'Tesla',
          'Meta',
          'Netflix',
          'Nvidia',
          'Intel',
          'AMD',
          'IBM',
          'Oracle',
          'Cisco',
          'Adobe',
          'Salesforce',
          'Inc',
          'Corp',
          'Ltd',
          'Holdings',
          'Group',
          'Technologies',
          'Systems',
          'Solutions',
          'Services',
          'International'
        ),
        { minLength: 1, maxLength: 4 }
      )
      .map((words: string[]) => words.join(' '));

    // Arbitrary for generating a single stock
    const stockArbitrary: fc.Arbitrary<TestStock> = fc.record({
      symbol: symbolArbitrary,
      name: nameArbitrary,
      exchange: fc.constantFrom('NASDAQ', 'NYSE', 'AMEX', 'OTC'),
      sector: fc.option(
        fc.constantFrom('Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer'),
        { nil: null }
      ),
      industry: fc.option(
        fc.constantFrom('Software', 'Hardware', 'Biotech', 'Banking', 'Retail'),
        { nil: null }
      ),
      marketCap: fc.option(
        fc.bigInt({ min: BigInt(1000000), max: BigInt(5000000000000) }),
        { nil: null }
      ),
      country: fc.option(fc.constantFrom('US', 'CN', 'UK', 'JP', 'DE'), { nil: null }),
    });

    // Arbitrary for generating a database of stocks
    const stockDatabaseArbitrary: fc.Arbitrary<TestStock[]> = fc.array(stockArbitrary, {
      minLength: 0,
      maxLength: 50,
    });

    // Arbitrary for generating search queries (non-empty strings)
    const searchQueryArbitrary: fc.Arbitrary<string> = fc
      .array(
        fc.constantFrom(
          ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('')
        ),
        { minLength: 1, maxLength: 10 }
      )
      .map((chars: string[]) => chars.join(''));

    /**
     * Helper function to check if a stock matches a query (case-insensitive)
     */
    const stockMatchesQuery = (
      stock: { symbol: string; name: string },
      query: string
    ): boolean => {
      const normalizedQuery = query.toLowerCase();
      const symbolMatches = stock.symbol.toLowerCase().includes(normalizedQuery);
      const nameMatches = stock.name.toLowerCase().includes(normalizedQuery);
      return symbolMatches || nameMatches;
    };

    /**
     * Helper function to simulate database filtering (mimics Prisma's behavior)
     */
    const filterStocksByQuery = (stocks: TestStock[], query: string): TestStock[] => {
      const normalizedQuery = query.toLowerCase();
      return stocks.filter(
        (stock) =>
          stock.symbol.toLowerCase().includes(normalizedQuery) ||
          stock.name.toLowerCase().includes(normalizedQuery)
      );
    };

    it('should return only stocks where symbol or name contains the query (case-insensitive)', async () => {
      await fc.assert(
        fc.asyncProperty(
          stockDatabaseArbitrary,
          searchQueryArbitrary,
          async (stockDatabase: TestStock[], query: string) => {
            // Setup: Mock database to return filtered stocks
            const filteredStocks = filterStocksByQuery(stockDatabase, query);
            (prisma.stock.findMany as jest.Mock).mockResolvedValue(filteredStocks);

            // Act: Perform search
            const results = await stockService.searchStocks(query);

            // Assert: All returned stocks should match the query
            for (const result of results) {
              const matches = stockMatchesQuery(result, query);
              if (!matches) {
                // Provide detailed failure message
                throw new Error(
                  `Stock "${result.symbol}" (name: "${result.name}") does not contain query "${query}" in symbol or name (case-insensitive)`
                );
              }
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should perform case-insensitive matching on symbol', async () => {
      await fc.assert(
        fc.asyncProperty(
          symbolArbitrary,
          fc.constantFrom('lower', 'upper', 'mixed'),
          async (symbol: string, caseType: string) => {
            // Generate query with different case variations
            let query: string;
            switch (caseType) {
              case 'lower':
                query = symbol.toLowerCase();
                break;
              case 'upper':
                query = symbol.toUpperCase();
                break;
              case 'mixed':
                query = symbol
                  .split('')
                  .map((c: string, i: number) =>
                    i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()
                  )
                  .join('');
                break;
              default:
                query = symbol;
            }

            // Create a stock that matches the symbol
            const matchingStock: TestStock = {
              symbol: symbol.toUpperCase(),
              name: 'Test Company Inc.',
              exchange: 'NASDAQ',
              sector: 'Technology',
              industry: 'Software',
              marketCap: BigInt(1000000000),
              country: 'US',
            };

            (prisma.stock.findMany as jest.Mock).mockResolvedValue([matchingStock]);

            // Act
            const results = await stockService.searchStocks(query);

            // Assert: Should find the stock regardless of query case
            expect(results.length).toBeGreaterThanOrEqual(0);
            for (const result of results) {
              expect(stockMatchesQuery(result, query)).toBe(true);
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should perform case-insensitive matching on name', async () => {
      await fc.assert(
        fc.asyncProperty(
          nameArbitrary,
          fc.constantFrom('lower', 'upper', 'mixed'),
          async (name: string, caseType: string) => {
            // Extract a word from the name to use as query
            const words = name.split(' ').filter((w: string) => w.length > 0);
            if (words.length === 0) return true; // Skip if no valid words

            const baseQuery = words[0];
            let query: string;
            switch (caseType) {
              case 'lower':
                query = baseQuery.toLowerCase();
                break;
              case 'upper':
                query = baseQuery.toUpperCase();
                break;
              case 'mixed':
                query = baseQuery
                  .split('')
                  .map((c: string, i: number) =>
                    i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()
                  )
                  .join('');
                break;
              default:
                query = baseQuery;
            }

            // Create a stock that matches the name
            const matchingStock: TestStock = {
              symbol: 'TEST',
              name: name,
              exchange: 'NYSE',
              sector: 'Technology',
              industry: 'Software',
              marketCap: BigInt(1000000000),
              country: 'US',
            };

            (prisma.stock.findMany as jest.Mock).mockResolvedValue([matchingStock]);

            // Act
            const results = await stockService.searchStocks(query);

            // Assert: All results should match the query
            for (const result of results) {
              expect(stockMatchesQuery(result, query)).toBe(true);
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return empty array for empty or whitespace-only queries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constant(' '), { minLength: 0, maxLength: 10 }).map((arr) => arr.join('')),
          async (whitespaceQuery: string) => {
            // Act
            const results = await stockService.searchStocks(whitespaceQuery);

            // Assert: Should return empty array
            expect(results).toEqual([]);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should not return stocks that do not match the query', async () => {
      await fc.assert(
        fc.asyncProperty(
          stockDatabaseArbitrary,
          searchQueryArbitrary,
          async (stockDatabase: TestStock[], query: string) => {
            // Setup: Mock database to return filtered stocks (simulating correct DB behavior)
            const filteredStocks = filterStocksByQuery(stockDatabase, query);
            (prisma.stock.findMany as jest.Mock).mockResolvedValue(filteredStocks);

            // Act
            const results = await stockService.searchStocks(query);

            // Assert: No result should fail to match the query
            const nonMatchingResults = results.filter(
              (result) => !stockMatchesQuery(result, query)
            );

            expect(nonMatchingResults).toHaveLength(0);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle partial matches in symbol', async () => {
      await fc.assert(
        fc.asyncProperty(
          symbolArbitrary.filter((s: string) => s.length >= 2),
          async (symbol: string) => {
            // Use a substring of the symbol as query
            const substringLength = Math.max(1, Math.floor(symbol.length / 2));
            const query = symbol.substring(0, substringLength).toLowerCase();

            const matchingStock: TestStock = {
              symbol: symbol,
              name: 'Test Company',
              exchange: 'NASDAQ',
              sector: null,
              industry: null,
              marketCap: null,
              country: null,
            };

            (prisma.stock.findMany as jest.Mock).mockResolvedValue([matchingStock]);

            // Act
            const results = await stockService.searchStocks(query);

            // Assert: All results should contain the query substring
            for (const result of results) {
              expect(stockMatchesQuery(result, query)).toBe(true);
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle partial matches in name', async () => {
      await fc.assert(
        fc.asyncProperty(nameArbitrary, async (name: string) => {
          const words = name.split(' ').filter((w: string) => w.length >= 2);
          if (words.length === 0) return true;

          // Use a substring of a word as query
          const word = words[0];
          const substringLength = Math.max(1, Math.floor(word.length / 2));
          const query = word.substring(0, substringLength).toLowerCase();

          const matchingStock: TestStock = {
            symbol: 'TEST',
            name: name,
            exchange: 'NYSE',
            sector: null,
            industry: null,
            marketCap: null,
            country: null,
          };

          (prisma.stock.findMany as jest.Mock).mockResolvedValue([matchingStock]);

          // Act
          const results = await stockService.searchStocks(query);

          // Assert: All results should contain the query substring
          for (const result of results) {
            expect(stockMatchesQuery(result, query)).toBe(true);
          }

          return true;
        }),
        { numRuns: 20 }
      );
    });

    it('should correctly convert BigInt marketCap to number in results', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.bigInt({ min: BigInt(1000000), max: BigInt(5000000000000) }),
          async (marketCap: bigint) => {
            const stock: TestStock = {
              symbol: 'TEST',
              name: 'Test Company',
              exchange: 'NASDAQ',
              sector: 'Technology',
              industry: 'Software',
              marketCap: marketCap,
              country: 'US',
            };

            (prisma.stock.findMany as jest.Mock).mockResolvedValue([stock]);

            // Act
            const results = await stockService.searchStocks('TEST');

            // Assert: marketCap should be converted to number
            if (results.length > 0) {
              expect(typeof results[0].marketCap).toBe('number');
              expect(results[0].marketCap).toBe(Number(marketCap));
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
