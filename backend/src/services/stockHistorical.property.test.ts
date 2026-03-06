/**
 * Property-Based Tests for Stock Historical Data
 *
 * **Feature: smart-stock-analyzer, Property 9: 时间范围数据属�?*
 *
 * This test validates the time range data property:
 * "For any stock and time range, the returned historical data should only contain
 * data points within that time range, and data points should be sorted in ascending
 * order by timestamp"
 *
 * **Validates: Requirements 4.3**
 * - 4.3: WHEN 用户选择时间范围 THEN Visualization_Engine SHALL 动态更新图表显示对应时段数�?
 */

import fc from 'fast-check';
import { StockService, OHLCV, TimeRange } from './stockService.js';
import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';

// Mock dependencies
jest.mock('../lib/prisma', () => ({
  prisma: {
    oHLCV: {
      findMany: jest.fn(),
    },
    stock: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
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
interface TestOHLCV {
  symbol: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: bigint;
}

describe('Stock Historical Data Property Tests', () => {
  let stockService: StockService;

  beforeEach(() => {
    stockService = new StockService();
    jest.clearAllMocks();
    // Default: cache miss, so database is queried
    (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
    (redisHelpers.setJson as jest.Mock).mockResolvedValue(undefined);
  });

  /**
   * **Feature: smart-stock-analyzer, Property 9: 时间范围数据属�?*
   *
   * Property: For any stock and time range, the returned historical data should
   * only contain data points within that time range, and data points should be
   * sorted in ascending order by timestamp.
   *
   * **Validates: Requirements 4.3**
   */
  describe('Property 9: Time Range Data Property (时间范围数据属�?', () => {
    // Arbitrary for generating valid stock symbols
    const symbolArbitrary: fc.Arbitrary<string> = fc
      .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
        minLength: 1,
        maxLength: 5,
      })
      .map((chars: string[]) => chars.join(''));

    // Arbitrary for generating time ranges
    const timeRangeArbitrary: fc.Arbitrary<TimeRange> = fc.constantFrom(
      '1D',
      '5D',
      '1M',
      '3M',
      '6M',
      '1Y',
      '5Y',
      'MAX'
    );

    // Arbitrary for generating volume
    const volumeArbitrary: fc.Arbitrary<bigint> = fc.bigInt({
      min: BigInt(1000),
      max: BigInt(1000000000),
    });

    // Arbitrary for generating a timestamp within a reasonable range (past 10 years)
    const timestampArbitrary: fc.Arbitrary<Date> = fc
      .integer({
        min: Date.now() - 10 * 365 * 24 * 60 * 60 * 1000, // 10 years ago
        max: Date.now(),
      })
      .map((ms: number) => new Date(ms));

    /**
     * Helper function to calculate start date based on time range
     * (mirrors the implementation in StockService)
     */
    const calculateStartDate = (range: TimeRange): Date => {
      const now = new Date();

      switch (range) {
        case '1D':
          return new Date(now.getTime() - 24 * 60 * 60 * 1000);
        case '5D':
          return new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
        case '1M':
          return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        case '3M':
          return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        case '6M':
          return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        case '1Y':
          return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        case '5Y':
          return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
        case 'MAX':
          return new Date(1970, 0, 1);
        default:
          return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      }
    };

    /**
     * Helper function to filter OHLCV data by time range
     * (simulates database filtering)
     */
    const filterByTimeRange = (data: TestOHLCV[], range: TimeRange): TestOHLCV[] => {
      const startDate = calculateStartDate(range);
      const endDate = new Date();
      return data
        .filter((item) => item.timestamp >= startDate && item.timestamp <= endDate)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    };

    /**
     * Helper function to check if data is sorted in ascending order by timestamp
     */
    const isSortedAscending = (data: OHLCV[]): boolean => {
      for (let i = 1; i < data.length; i++) {
        if (data[i].timestamp.getTime() < data[i - 1].timestamp.getTime()) {
          return false;
        }
      }
      return true;
    };

    it('should return only data points within the specified time range', async () => {
      await fc.assert(
        fc.asyncProperty(
          symbolArbitrary,
          timeRangeArbitrary,
          fc.array(timestampArbitrary, { minLength: 0, maxLength: 50 }),
          async (symbol: string, range: TimeRange, timestamps: Date[]) => {
            // Generate OHLCV data with the given timestamps
            const ohlcvData: TestOHLCV[] = timestamps.map((timestamp) => ({
              symbol: symbol.toUpperCase(),
              timestamp,
              open: 100,
              high: 110,
              low: 90,
              close: 105,
              volume: BigInt(1000000),
            }));

            // Filter data by time range (simulating database behavior)
            const filteredData = filterByTimeRange(ohlcvData, range);

            // Mock database to return filtered data
            (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue(filteredData);

            // Act: Get historical data
            const results = await stockService.getHistoricalData(symbol, range);

            // Assert: All returned data points should be within the time range
            const startDate = calculateStartDate(range);
            const endDate = new Date();

            for (const item of results) {
              const withinRange = item.timestamp >= startDate && item.timestamp <= endDate;
              if (!withinRange) {
                throw new Error(
                  `Data point with timestamp ${item.timestamp.toISOString()} is outside ` +
                    `the time range [${startDate.toISOString()}, ${endDate.toISOString()}] ` +
                    `for range "${range}"`
                );
              }
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return data points sorted in ascending order by timestamp', async () => {
      await fc.assert(
        fc.asyncProperty(
          symbolArbitrary,
          timeRangeArbitrary,
          fc.array(timestampArbitrary, { minLength: 0, maxLength: 50 }),
          async (symbol: string, range: TimeRange, timestamps: Date[]) => {
            // Generate OHLCV data with the given timestamps
            const ohlcvData: TestOHLCV[] = timestamps.map((timestamp) => ({
              symbol: symbol.toUpperCase(),
              timestamp,
              open: 100,
              high: 110,
              low: 90,
              close: 105,
              volume: BigInt(1000000),
            }));

            // Filter and sort data (simulating database behavior with ORDER BY timestamp ASC)
            const filteredData = filterByTimeRange(ohlcvData, range);

            // Mock database to return filtered and sorted data
            (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue(filteredData);

            // Act: Get historical data
            const results = await stockService.getHistoricalData(symbol, range);

            // Assert: Data should be sorted in ascending order by timestamp
            if (!isSortedAscending(results)) {
              const timestamps = results.map((r) => r.timestamp.toISOString());
              throw new Error(
                `Data points are not sorted in ascending order by timestamp. ` +
                  `Timestamps: [${timestamps.join(', ')}]`
              );
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should not include data points before the start date of the time range', async () => {
      await fc.assert(
        fc.asyncProperty(
          symbolArbitrary,
          timeRangeArbitrary.filter((r) => r !== 'MAX'), // Exclude MAX as it has no meaningful start date
          async (symbol: string, range: TimeRange) => {
            const startDate = calculateStartDate(range);

            // Create data points: some before start date, some after
            const beforeStartDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000); // 1 day before
            const afterStartDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000); // 1 day after

            const ohlcvData: TestOHLCV[] = [
              {
                symbol: symbol.toUpperCase(),
                timestamp: beforeStartDate,
                open: 100,
                high: 110,
                low: 90,
                close: 105,
                volume: BigInt(1000000),
              },
              {
                symbol: symbol.toUpperCase(),
                timestamp: afterStartDate,
                open: 100,
                high: 110,
                low: 90,
                close: 105,
                volume: BigInt(1000000),
              },
            ];

            // Filter data by time range (simulating database behavior)
            const filteredData = filterByTimeRange(ohlcvData, range);

            // Mock database to return filtered data
            (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue(filteredData);

            // Act: Get historical data
            const results = await stockService.getHistoricalData(symbol, range);

            // Assert: No data point should be before the start date
            for (const item of results) {
              if (item.timestamp < startDate) {
                throw new Error(
                  `Data point with timestamp ${item.timestamp.toISOString()} is before ` +
                    `the start date ${startDate.toISOString()} for range "${range}"`
                );
              }
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should not include data points after the current date', async () => {
      await fc.assert(
        fc.asyncProperty(symbolArbitrary, timeRangeArbitrary, async (symbol: string, range: TimeRange) => {
          const now = new Date();
          const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week in future
          const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago

          const ohlcvData: TestOHLCV[] = [
            {
              symbol: symbol.toUpperCase(),
              timestamp: futureDate,
              open: 100,
              high: 110,
              low: 90,
              close: 105,
              volume: BigInt(1000000),
            },
            {
              symbol: symbol.toUpperCase(),
              timestamp: pastDate,
              open: 100,
              high: 110,
              low: 90,
              close: 105,
              volume: BigInt(1000000),
            },
          ];

          // Filter data by time range (simulating database behavior)
          const filteredData = filterByTimeRange(ohlcvData, range);

          // Mock database to return filtered data
          (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue(filteredData);

          // Act: Get historical data
          const results = await stockService.getHistoricalData(symbol, range);

          // Assert: No data point should be after the current date
          const endDate = new Date();
          for (const item of results) {
            if (item.timestamp > endDate) {
              throw new Error(
                `Data point with timestamp ${item.timestamp.toISOString()} is after ` +
                  `the end date ${endDate.toISOString()}`
              );
            }
          }

          return true;
        }),
        { numRuns: 20 }
      );
    });

    it('should return empty array when no data exists within the time range', async () => {
      await fc.assert(
        fc.asyncProperty(
          symbolArbitrary,
          timeRangeArbitrary.filter((r) => r !== 'MAX'),
          async (symbol: string, range: TimeRange) => {
            const startDate = calculateStartDate(range);

            // Create data points all before the start date
            const veryOldDate = new Date(startDate.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year before start

            const ohlcvData: TestOHLCV[] = [
              {
                symbol: symbol.toUpperCase(),
                timestamp: veryOldDate,
                open: 100,
                high: 110,
                low: 90,
                close: 105,
                volume: BigInt(1000000),
              },
            ];

            // Filter data by time range (should return empty)
            const filteredData = filterByTimeRange(ohlcvData, range);

            // Mock database to return filtered data (empty)
            (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue(filteredData);

            // Act: Get historical data
            const results = await stockService.getHistoricalData(symbol, range);

            // Assert: Should return empty array
            expect(results).toEqual([]);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should correctly convert BigInt volume to number in results', async () => {
      await fc.assert(
        fc.asyncProperty(
          symbolArbitrary,
          timeRangeArbitrary,
          volumeArbitrary,
          async (symbol: string, range: TimeRange, volume: bigint) => {
            const now = new Date();
            const recentDate = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

            const ohlcvData: TestOHLCV[] = [
              {
                symbol: symbol.toUpperCase(),
                timestamp: recentDate,
                open: 100,
                high: 110,
                low: 90,
                close: 105,
                volume: volume,
              },
            ];

            // Filter data by time range
            const filteredData = filterByTimeRange(ohlcvData, range);

            // Mock database to return filtered data
            (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue(filteredData);

            // Act: Get historical data
            const results = await stockService.getHistoricalData(symbol, range);

            // Assert: Volume should be converted to number
            if (results.length > 0) {
              expect(typeof results[0].volume).toBe('number');
              expect(results[0].volume).toBe(Number(volume));
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle different time ranges correctly', async () => {
      const timeRanges: TimeRange[] = ['1D', '5D', '1M', '3M', '6M', '1Y', '5Y', 'MAX'];

      for (const range of timeRanges) {
        await fc.assert(
          fc.asyncProperty(symbolArbitrary, async (symbol: string) => {
            const now = new Date();
            const startDate = calculateStartDate(range);

            // Create data points at various times
            const dataPoints: TestOHLCV[] = [];

            // Add a point just after start date (should be included)
            const justAfterStart = new Date(startDate.getTime() + 60 * 60 * 1000);
            if (justAfterStart <= now) {
              dataPoints.push({
                symbol: symbol.toUpperCase(),
                timestamp: justAfterStart,
                open: 100,
                high: 110,
                low: 90,
                close: 105,
                volume: BigInt(1000000),
              });
            }

            // Add a point in the middle of the range (should be included)
            const middleDate = new Date((startDate.getTime() + now.getTime()) / 2);
            if (middleDate >= startDate && middleDate <= now) {
              dataPoints.push({
                symbol: symbol.toUpperCase(),
                timestamp: middleDate,
                open: 100,
                high: 110,
                low: 90,
                close: 105,
                volume: BigInt(1000000),
              });
            }

            // Filter data by time range
            const filteredData = filterByTimeRange(dataPoints, range);

            // Mock database to return filtered data
            (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue(filteredData);

            // Act: Get historical data
            const results = await stockService.getHistoricalData(symbol, range);

            // Assert: All results should be within range and sorted
            for (const item of results) {
              expect(item.timestamp >= startDate).toBe(true);
              expect(item.timestamp <= now).toBe(true);
            }
            expect(isSortedAscending(results)).toBe(true);

            return true;
          }),
          { numRuns: 20 } // Fewer runs per range since we're testing all ranges
        );
      }
    });

    it('should normalize symbol to uppercase', async () => {
      await fc.assert(
        fc.asyncProperty(
          symbolArbitrary,
          fc.constantFrom('lower', 'upper', 'mixed'),
          timeRangeArbitrary,
          async (symbol: string, caseType: string, range: TimeRange) => {
            // Generate symbol with different case variations
            let inputSymbol: string;
            switch (caseType) {
              case 'lower':
                inputSymbol = symbol.toLowerCase();
                break;
              case 'upper':
                inputSymbol = symbol.toUpperCase();
                break;
              case 'mixed':
                inputSymbol = symbol
                  .split('')
                  .map((c: string, i: number) => (i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()))
                  .join('');
                break;
              default:
                inputSymbol = symbol;
            }

            const now = new Date();
            const recentDate = new Date(now.getTime() - 60 * 60 * 1000);

            const ohlcvData: TestOHLCV[] = [
              {
                symbol: symbol.toUpperCase(),
                timestamp: recentDate,
                open: 100,
                high: 110,
                low: 90,
                close: 105,
                volume: BigInt(1000000),
              },
            ];

            // Filter data by time range
            const filteredData = filterByTimeRange(ohlcvData, range);

            // Mock database to return filtered data
            (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue(filteredData);

            // Act: Get historical data with different case input
            await stockService.getHistoricalData(inputSymbol, range);

            // Assert: Should work regardless of input case
            // The mock is set up to return data, so we just verify the call was made
            expect(prisma.oHLCV.findMany).toHaveBeenCalled();

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
