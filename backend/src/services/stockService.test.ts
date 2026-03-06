import { StockService, StockSearchResult, StockQuote, OHLCV, TimeRange, FinancialMetrics } from './stockService.js';
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
    stockQuote: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    oHLCV: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    fundamentalMetrics: {
      findUnique: jest.fn(),
    },
    insiderTrade: {
      findMany: jest.fn(),
    },
    analystRating: {
      findMany: jest.fn(),
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

describe('StockService', () => {
  let stockService: StockService;

  beforeEach(() => {
    stockService = new StockService();
    jest.clearAllMocks();
  });

  describe('searchStocks', () => {
    const mockStocks = [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        exchange: 'NASDAQ',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        marketCap: BigInt(3000000000000),
        country: 'US',
      },
      {
        symbol: 'AAPD',
        name: 'Direxion Daily AAPL Bear 1X Shares',
        exchange: 'NASDAQ',
        sector: 'Financial',
        industry: 'ETF',
        marketCap: BigInt(100000000),
        country: 'US',
      },
      {
        symbol: 'MSFT',
        name: 'Microsoft Corporation',
        exchange: 'NASDAQ',
        sector: 'Technology',
        industry: 'Software',
        marketCap: BigInt(2800000000000),
        country: 'US',
      },
    ];

    it('should return matching stocks from database when cache miss', async () => {
      // Mock cache miss
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      // Mock database query
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([mockStocks[0]]);

      const results = await stockService.searchStocks('AAPL');

      expect(results).toHaveLength(1);
      expect(results[0].symbol).toBe('AAPL');
      expect(results[0].name).toBe('Apple Inc.');
      expect(results[0].marketCap).toBe(3000000000000);
      
      // Verify cache was checked
      expect(redisHelpers.getJson).toHaveBeenCalled();
      // Verify database was queried
      expect(prisma.stock.findMany).toHaveBeenCalled();
      // Verify results were cached
      expect(redisHelpers.setJson).toHaveBeenCalled();
    });

    it('should return cached results when cache hit', async () => {
      const cachedResults: StockSearchResult[] = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          exchange: 'NASDAQ',
          sector: 'Technology',
          industry: 'Consumer Electronics',
          marketCap: 3000000000000,
          country: 'US',
        },
      ];

      // Mock cache hit
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(cachedResults);

      const results = await stockService.searchStocks('AAPL');

      expect(results).toHaveLength(1);
      expect(results[0].symbol).toBe('AAPL');
      
      // Verify database was NOT queried
      expect(prisma.stock.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array for empty query', async () => {
      const results = await stockService.searchStocks('');

      expect(results).toHaveLength(0);
      expect(redisHelpers.getJson).not.toHaveBeenCalled();
      expect(prisma.stock.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array for whitespace-only query', async () => {
      const results = await stockService.searchStocks('   ');

      expect(results).toHaveLength(0);
    });

    it('should search case-insensitively', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([mockStocks[0]]);

      // Search with lowercase
      await stockService.searchStocks('aapl');

      // Verify the query was normalized
      expect(redisHelpers.getJson).toHaveBeenCalledWith(
        expect.stringContaining('aapl')
      );
    });

    it('should respect limit parameter', async () => {
      const manyStocks = Array(50).fill(null).map((_, i) => ({
        symbol: `STK${i}`,
        name: `Stock ${i}`,
        exchange: 'NYSE',
        sector: 'Technology',
        industry: 'Software',
        marketCap: BigInt(1000000000),
        country: 'US',
      }));

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue(manyStocks);

      const results = await stockService.searchStocks('STK', 10);

      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should prioritize exact symbol matches in results', async () => {
      const stocks = [
        {
          symbol: 'AAPLX',
          name: 'Some Fund',
          exchange: 'NYSE',
          sector: null,
          industry: null,
          marketCap: null,
          country: 'US',
        },
        {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          exchange: 'NASDAQ',
          sector: 'Technology',
          industry: 'Consumer Electronics',
          marketCap: BigInt(3000000000000),
          country: 'US',
        },
      ];

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue(stocks);

      const results = await stockService.searchStocks('aapl');

      // Exact match should come first
      expect(results[0].symbol).toBe('AAPL');
    });

    it('should handle database errors gracefully', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.stock.findMany as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await expect(stockService.searchStocks('AAPL')).rejects.toThrow('DB Error');
    });

    it('should continue with database query when cache read fails', async () => {
      (redisHelpers.getJson as jest.Mock).mockRejectedValue(new Error('Redis Error'));
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([mockStocks[0]]);

      const results = await stockService.searchStocks('AAPL');

      expect(results).toHaveLength(1);
      expect(results[0].symbol).toBe('AAPL');
    });

    it('should not fail when cache write fails', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([mockStocks[0]]);
      (redisHelpers.setJson as jest.Mock).mockRejectedValue(new Error('Redis Error'));

      const results = await stockService.searchStocks('AAPL');

      // Should still return results even if caching fails
      expect(results).toHaveLength(1);
    });

    it('should convert BigInt marketCap to number', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([mockStocks[0]]);

      const results = await stockService.searchStocks('AAPL');

      expect(typeof results[0].marketCap).toBe('number');
      expect(results[0].marketCap).toBe(3000000000000);
    });

    it('should handle null marketCap', async () => {
      const stockWithNullMarketCap = {
        ...mockStocks[0],
        marketCap: null,
      };

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([stockWithNullMarketCap]);

      const results = await stockService.searchStocks('AAPL');

      expect(results[0].marketCap).toBeNull();
    });

    it('should search by name as well as symbol', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([mockStocks[0]]);

      await stockService.searchStocks('Apple');

      // Verify the database query includes name search
      expect(prisma.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                name: expect.objectContaining({
                  contains: 'apple',
                  mode: 'insensitive',
                }),
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('getStockDetail', () => {
    const mockStock = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      exchange: 'NASDAQ',
      sector: 'Technology',
      industry: 'Consumer Electronics',
      marketCap: BigInt(3000000000000),
      country: 'US',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    };

    it('should return stock detail from database when cache miss', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.stock.findUnique as jest.Mock).mockResolvedValue(mockStock);

      const result = await stockService.getStockDetail('AAPL');

      expect(result).not.toBeNull();
      expect(result?.symbol).toBe('AAPL');
      expect(result?.name).toBe('Apple Inc.');
      expect(result?.marketCap).toBe(3000000000000);
    });

    it('should return cached stock detail when cache hit', async () => {
      const cachedStock = {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        exchange: 'NASDAQ',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        marketCap: 3000000000000,
        country: 'US',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(cachedStock);

      const result = await stockService.getStockDetail('AAPL');

      expect(result?.symbol).toBe('AAPL');
      expect(prisma.stock.findUnique).not.toHaveBeenCalled();
    });

    it('should return null for non-existent stock', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.stock.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await stockService.getStockDetail('INVALID');

      expect(result).toBeNull();
    });

    it('should normalize symbol to uppercase', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.stock.findUnique as jest.Mock).mockResolvedValue(mockStock);

      await stockService.getStockDetail('aapl');

      expect(prisma.stock.findUnique).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
      });
    });
  });

  describe('stockExists', () => {
    it('should return true if stock exists', async () => {
      (prisma.stock.findUnique as jest.Mock).mockResolvedValue({ symbol: 'AAPL' });

      const exists = await stockService.stockExists('AAPL');

      expect(exists).toBe(true);
    });

    it('should return false if stock does not exist', async () => {
      (prisma.stock.findUnique as jest.Mock).mockResolvedValue(null);

      const exists = await stockService.stockExists('INVALID');

      expect(exists).toBe(false);
    });

    it('should normalize symbol to uppercase', async () => {
      (prisma.stock.findUnique as jest.Mock).mockResolvedValue({ symbol: 'AAPL' });

      await stockService.stockExists('aapl');

      expect(prisma.stock.findUnique).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
        select: { symbol: true },
      });
    });
  });

  describe('upsertStock', () => {
    const mockStockData = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      exchange: 'NASDAQ',
      sector: 'Technology',
      industry: 'Consumer Electronics',
      marketCap: 3000000000000,
      country: 'US',
    };

    const mockUpsertedStock = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      exchange: 'NASDAQ',
      sector: 'Technology',
      industry: 'Consumer Electronics',
      marketCap: BigInt(3000000000000),
      country: 'US',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should upsert stock and invalidate cache', async () => {
      (prisma.stock.upsert as jest.Mock).mockResolvedValue(mockUpsertedStock);

      const result = await stockService.upsertStock(mockStockData);

      expect(result.symbol).toBe('AAPL');
      expect(prisma.stock.upsert).toHaveBeenCalled();
      expect(redisHelpers.del).toHaveBeenCalled();
    });

    it('should normalize symbol to uppercase', async () => {
      (prisma.stock.upsert as jest.Mock).mockResolvedValue(mockUpsertedStock);

      await stockService.upsertStock({
        ...mockStockData,
        symbol: 'aapl',
      });

      expect(prisma.stock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { symbol: 'AAPL' },
        })
      );
    });

    it('should handle null marketCap', async () => {
      const stockWithNullMarketCap = {
        ...mockUpsertedStock,
        marketCap: null,
      };

      (prisma.stock.upsert as jest.Mock).mockResolvedValue(stockWithNullMarketCap);

      const result = await stockService.upsertStock({
        ...mockStockData,
        marketCap: null,
      });

      expect(result.marketCap).toBeNull();
    });
  });

  describe('getQuote', () => {
    const mockQuote = {
      id: 'quote-1',
      symbol: 'AAPL',
      price: 175.50,
      change: 2.50,
      changePercent: 1.45,
      volume: BigInt(50000000),
      avgVolume: BigInt(45000000),
      high: 176.00,
      low: 173.00,
      open: 174.00,
      previousClose: 173.00,
      timestamp: new Date('2024-01-15T10:30:00Z'),
    };

    it('should return quote from database when cache miss', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.stockQuote.findFirst as jest.Mock).mockResolvedValue(mockQuote);

      const result = await stockService.getQuote('AAPL');

      expect(result).not.toBeNull();
      expect(result?.symbol).toBe('AAPL');
      expect(result?.price).toBe(175.50);
      expect(result?.volume).toBe(50000000);
      expect(result?.avgVolume).toBe(45000000);
      
      // Verify cache was checked
      expect(redisHelpers.getJson).toHaveBeenCalled();
      // Verify database was queried
      expect(prisma.stockQuote.findFirst).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
        orderBy: { timestamp: 'desc' },
      });
      // Verify results were cached
      expect(redisHelpers.setJson).toHaveBeenCalled();
    });

    it('should return cached quote when cache hit', async () => {
      const cachedQuote: StockQuote = {
        symbol: 'AAPL',
        price: 175.50,
        change: 2.50,
        changePercent: 1.45,
        volume: 50000000,
        avgVolume: 45000000,
        high: 176.00,
        low: 173.00,
        open: 174.00,
        previousClose: 173.00,
        timestamp: new Date('2024-01-15T10:30:00Z'),
      };

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(cachedQuote);

      const result = await stockService.getQuote('AAPL');

      expect(result?.symbol).toBe('AAPL');
      expect(result?.price).toBe(175.50);
      // Verify database was NOT queried
      expect(prisma.stockQuote.findFirst).not.toHaveBeenCalled();
    });

    it('should return null for non-existent quote', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.stockQuote.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await stockService.getQuote('INVALID');

      expect(result).toBeNull();
    });

    it('should normalize symbol to uppercase', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.stockQuote.findFirst as jest.Mock).mockResolvedValue(mockQuote);

      await stockService.getQuote('aapl');

      expect(prisma.stockQuote.findFirst).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should handle null avgVolume', async () => {
      const quoteWithNullAvgVolume = {
        ...mockQuote,
        avgVolume: null,
      };

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.stockQuote.findFirst as jest.Mock).mockResolvedValue(quoteWithNullAvgVolume);

      const result = await stockService.getQuote('AAPL');

      expect(result?.avgVolume).toBeNull();
    });

    it('should convert BigInt volume to number', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.stockQuote.findFirst as jest.Mock).mockResolvedValue(mockQuote);

      const result = await stockService.getQuote('AAPL');

      expect(typeof result?.volume).toBe('number');
      expect(result?.volume).toBe(50000000);
    });

    it('should continue with database query when cache read fails', async () => {
      (redisHelpers.getJson as jest.Mock).mockRejectedValue(new Error('Redis Error'));
      (prisma.stockQuote.findFirst as jest.Mock).mockResolvedValue(mockQuote);

      const result = await stockService.getQuote('AAPL');

      expect(result).not.toBeNull();
      expect(result?.symbol).toBe('AAPL');
    });

    it('should not fail when cache write fails', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.stockQuote.findFirst as jest.Mock).mockResolvedValue(mockQuote);
      (redisHelpers.setJson as jest.Mock).mockRejectedValue(new Error('Redis Error'));

      const result = await stockService.getQuote('AAPL');

      expect(result).not.toBeNull();
      expect(result?.symbol).toBe('AAPL');
    });
  });

  describe('getHistoricalData', () => {
    const mockOHLCVData = [
      {
        id: 'ohlcv-1',
        symbol: 'AAPL',
        timestamp: new Date('2024-01-10'),
        open: 170.00,
        high: 172.00,
        low: 169.00,
        close: 171.50,
        volume: BigInt(40000000),
      },
      {
        id: 'ohlcv-2',
        symbol: 'AAPL',
        timestamp: new Date('2024-01-11'),
        open: 171.50,
        high: 174.00,
        low: 171.00,
        close: 173.00,
        volume: BigInt(45000000),
      },
      {
        id: 'ohlcv-3',
        symbol: 'AAPL',
        timestamp: new Date('2024-01-12'),
        open: 173.00,
        high: 176.00,
        low: 172.50,
        close: 175.50,
        volume: BigInt(50000000),
      },
    ];

    it('should return historical data from database when cache miss', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue(mockOHLCVData);

      const result = await stockService.getHistoricalData('AAPL', '1M');

      expect(result).toHaveLength(3);
      expect(result[0].open).toBe(170.00);
      expect(result[0].close).toBe(171.50);
      expect(result[0].volume).toBe(40000000);
      
      // Verify cache was checked
      expect(redisHelpers.getJson).toHaveBeenCalled();
      // Verify database was queried
      expect(prisma.oHLCV.findMany).toHaveBeenCalled();
      // Verify results were cached
      expect(redisHelpers.setJson).toHaveBeenCalled();
    });

    it('should return cached historical data when cache hit', async () => {
      const cachedData: OHLCV[] = [
        {
          timestamp: new Date('2024-01-10'),
          open: 170.00,
          high: 172.00,
          low: 169.00,
          close: 171.50,
          volume: 40000000,
        },
      ];

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(cachedData);

      const result = await stockService.getHistoricalData('AAPL', '1M');

      expect(result).toHaveLength(1);
      expect(result[0].open).toBe(170.00);
      // Verify database was NOT queried
      expect(prisma.oHLCV.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array when no data exists', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue([]);

      const result = await stockService.getHistoricalData('INVALID', '1M');

      expect(result).toHaveLength(0);
    });

    it('should normalize symbol to uppercase', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue(mockOHLCVData);

      await stockService.getHistoricalData('aapl', '1M');

      expect(prisma.oHLCV.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            symbol: 'AAPL',
          }),
        })
      );
    });

    it('should query with correct date range for 1D', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue([]);

      await stockService.getHistoricalData('AAPL', '1D');

      expect(prisma.oHLCV.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
          orderBy: { timestamp: 'asc' },
        })
      );
    });

    it('should query with correct date range for 1Y', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue([]);

      await stockService.getHistoricalData('AAPL', '1Y');

      expect(prisma.oHLCV.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('should return data sorted by timestamp ascending', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue(mockOHLCVData);

      const result = await stockService.getHistoricalData('AAPL', '1M');

      // Verify data is sorted ascending
      for (let i = 1; i < result.length; i++) {
        expect(result[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          result[i - 1].timestamp.getTime()
        );
      }
    });

    it('should convert BigInt volume to number', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue(mockOHLCVData);

      const result = await stockService.getHistoricalData('AAPL', '1M');

      expect(typeof result[0].volume).toBe('number');
      expect(result[0].volume).toBe(40000000);
    });

    it('should continue with database query when cache read fails', async () => {
      (redisHelpers.getJson as jest.Mock).mockRejectedValue(new Error('Redis Error'));
      (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue(mockOHLCVData);

      const result = await stockService.getHistoricalData('AAPL', '1M');

      expect(result).toHaveLength(3);
    });

    it('should not fail when cache write fails', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue(mockOHLCVData);
      (redisHelpers.setJson as jest.Mock).mockRejectedValue(new Error('Redis Error'));

      const result = await stockService.getHistoricalData('AAPL', '1M');

      expect(result).toHaveLength(3);
    });

    it.each([
      ['1D', 1],
      ['5D', 5],
      ['1M', 30],
      ['3M', 90],
      ['6M', 180],
      ['1Y', 365],
      ['5Y', 1825],
    ])('should handle %s time range', async (range, _expectedDays) => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue([]);

      await stockService.getHistoricalData('AAPL', range as TimeRange);

      expect(prisma.oHLCV.findMany).toHaveBeenCalled();
    });

    it('should handle MAX time range', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue(mockOHLCVData);

      const result = await stockService.getHistoricalData('AAPL', 'MAX');

      expect(result).toHaveLength(3);
      expect(prisma.oHLCV.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        })
      );
    });
  });

  describe('saveQuote', () => {
    const mockQuoteData = {
      symbol: 'AAPL',
      price: 175.50,
      change: 2.50,
      changePercent: 1.45,
      volume: 50000000,
      avgVolume: 45000000,
      high: 176.00,
      low: 173.00,
      open: 174.00,
      previousClose: 173.00,
    };

    const mockCreatedQuote = {
      id: 'quote-1',
      symbol: 'AAPL',
      price: 175.50,
      change: 2.50,
      changePercent: 1.45,
      volume: BigInt(50000000),
      avgVolume: BigInt(45000000),
      high: 176.00,
      low: 173.00,
      open: 174.00,
      previousClose: 173.00,
      timestamp: new Date('2024-01-15T10:30:00Z'),
    };

    it('should save quote and invalidate cache', async () => {
      (prisma.stockQuote.create as jest.Mock).mockResolvedValue(mockCreatedQuote);

      const result = await stockService.saveQuote(mockQuoteData);

      expect(result.symbol).toBe('AAPL');
      expect(result.price).toBe(175.50);
      expect(prisma.stockQuote.create).toHaveBeenCalled();
      expect(redisHelpers.del).toHaveBeenCalled();
    });

    it('should normalize symbol to uppercase', async () => {
      (prisma.stockQuote.create as jest.Mock).mockResolvedValue(mockCreatedQuote);

      await stockService.saveQuote({
        ...mockQuoteData,
        symbol: 'aapl',
      });

      expect(prisma.stockQuote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            symbol: 'AAPL',
          }),
        })
      );
    });

    it('should handle null avgVolume', async () => {
      const quoteWithNullAvgVolume = {
        ...mockCreatedQuote,
        avgVolume: null,
      };

      (prisma.stockQuote.create as jest.Mock).mockResolvedValue(quoteWithNullAvgVolume);

      const result = await stockService.saveQuote({
        ...mockQuoteData,
        avgVolume: null,
      });

      expect(result.avgVolume).toBeNull();
    });
  });

  describe('saveHistoricalData', () => {
    const mockOHLCVData: OHLCV[] = [
      {
        timestamp: new Date('2024-01-10'),
        open: 170.00,
        high: 172.00,
        low: 169.00,
        close: 171.50,
        volume: 40000000,
      },
      {
        timestamp: new Date('2024-01-11'),
        open: 171.50,
        high: 174.00,
        low: 171.00,
        close: 173.00,
        volume: 45000000,
      },
    ];

    it('should save historical data and invalidate cache', async () => {
      (prisma.oHLCV.upsert as jest.Mock).mockResolvedValue({});

      const result = await stockService.saveHistoricalData('AAPL', mockOHLCVData);

      expect(result).toBe(2);
      expect(prisma.oHLCV.upsert).toHaveBeenCalledTimes(2);
      // Should invalidate cache for all time ranges
      expect(redisHelpers.del).toHaveBeenCalledTimes(8); // 8 time ranges
    });

    it('should normalize symbol to uppercase', async () => {
      (prisma.oHLCV.upsert as jest.Mock).mockResolvedValue({});

      await stockService.saveHistoricalData('aapl', mockOHLCVData);

      expect(prisma.oHLCV.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            symbol_timestamp: expect.objectContaining({
              symbol: 'AAPL',
            }),
          }),
        })
      );
    });

    it('should return 0 for empty data array', async () => {
      const result = await stockService.saveHistoricalData('AAPL', []);

      expect(result).toBe(0);
      expect(prisma.oHLCV.upsert).not.toHaveBeenCalled();
    });
  });

  describe('getFinancialMetrics', () => {
    const mockFundamentals = {
      id: 'fund-1',
      symbol: 'AAPL',
      pe: 28.5,
      forwardPe: 25.2,
      peg: 1.8,
      ps: 7.5,
      pb: 45.2,
      eps: 6.15,
      epsGrowth: 0.12,
      revenue: BigInt(394328000000),
      revenueGrowth: 0.08,
      grossMargin: 0.438,
      operatingMargin: 0.302,
      netMargin: 0.253,
      roe: 1.47,
      roa: 0.28,
      debtToEquity: 1.81,
      currentRatio: 0.99,
      dividendYield: 0.005,
      payoutRatio: 0.15,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    };

    it('should return financial metrics from database when cache miss', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.fundamentalMetrics.findUnique as jest.Mock).mockResolvedValue(mockFundamentals);

      const result = await stockService.getFinancialMetrics('AAPL');

      expect(result).not.toBeNull();
      expect(result?.pe).toBe(28.5);
      expect(result?.forwardPe).toBe(25.2);
      expect(result?.peg).toBe(1.8);
      expect(result?.ps).toBe(7.5);
      expect(result?.pb).toBe(45.2);
      expect(result?.eps).toBe(6.15);
      expect(result?.epsGrowth).toBe(0.12);
      expect(result?.revenue).toBe(394328000000);
      expect(result?.revenueGrowth).toBe(0.08);
      expect(result?.grossMargin).toBe(0.438);
      expect(result?.operatingMargin).toBe(0.302);
      expect(result?.netMargin).toBe(0.253);
      expect(result?.roe).toBe(1.47);
      expect(result?.roa).toBe(0.28);
      expect(result?.debtToEquity).toBe(1.81);
      expect(result?.currentRatio).toBe(0.99);
      expect(result?.dividendYield).toBe(0.005);
      expect(result?.payoutRatio).toBe(0.15);
      
      // Verify cache was checked
      expect(redisHelpers.getJson).toHaveBeenCalled();
      // Verify database was queried
      expect(prisma.fundamentalMetrics.findUnique).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
      });
      // Verify results were cached
      expect(redisHelpers.setJson).toHaveBeenCalled();
    });

    it('should return cached financial metrics when cache hit', async () => {
      const cachedMetrics: FinancialMetrics = {
        pe: 28.5,
        forwardPe: 25.2,
        peg: 1.8,
        ps: 7.5,
        pb: 45.2,
        eps: 6.15,
        epsGrowth: 0.12,
        revenue: 394328000000,
        revenueGrowth: 0.08,
        grossMargin: 0.438,
        operatingMargin: 0.302,
        netMargin: 0.253,
        roe: 1.47,
        roa: 0.28,
        debtToEquity: 1.81,
        currentRatio: 0.99,
        dividendYield: 0.005,
        payoutRatio: 0.15,
      };

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(cachedMetrics);

      const result = await stockService.getFinancialMetrics('AAPL');

      expect(result?.pe).toBe(28.5);
      expect(result?.eps).toBe(6.15);
      // Verify database was NOT queried
      expect(prisma.fundamentalMetrics.findUnique).not.toHaveBeenCalled();
    });

    it('should return null for non-existent stock', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.fundamentalMetrics.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await stockService.getFinancialMetrics('INVALID');

      expect(result).toBeNull();
    });

    it('should normalize symbol to uppercase', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.fundamentalMetrics.findUnique as jest.Mock).mockResolvedValue(mockFundamentals);

      await stockService.getFinancialMetrics('aapl');

      expect(prisma.fundamentalMetrics.findUnique).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
      });
    });

    it('should handle null values for all metrics', async () => {
      const metricsWithNulls = {
        id: 'fund-2',
        symbol: 'TEST',
        pe: null,
        forwardPe: null,
        peg: null,
        ps: null,
        pb: null,
        eps: null,
        epsGrowth: null,
        revenue: null,
        revenueGrowth: null,
        grossMargin: null,
        operatingMargin: null,
        netMargin: null,
        roe: null,
        roa: null,
        debtToEquity: null,
        currentRatio: null,
        dividendYield: null,
        payoutRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.fundamentalMetrics.findUnique as jest.Mock).mockResolvedValue(metricsWithNulls);

      const result = await stockService.getFinancialMetrics('TEST');

      expect(result).not.toBeNull();
      expect(result?.pe).toBeNull();
      expect(result?.forwardPe).toBeNull();
      expect(result?.peg).toBeNull();
      expect(result?.ps).toBeNull();
      expect(result?.pb).toBeNull();
      expect(result?.eps).toBeNull();
      expect(result?.epsGrowth).toBeNull();
      expect(result?.revenue).toBeNull();
      expect(result?.revenueGrowth).toBeNull();
      expect(result?.grossMargin).toBeNull();
      expect(result?.operatingMargin).toBeNull();
      expect(result?.netMargin).toBeNull();
      expect(result?.roe).toBeNull();
      expect(result?.roa).toBeNull();
      expect(result?.debtToEquity).toBeNull();
      expect(result?.currentRatio).toBeNull();
      expect(result?.dividendYield).toBeNull();
      expect(result?.payoutRatio).toBeNull();
    });

    it('should convert BigInt revenue to number', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.fundamentalMetrics.findUnique as jest.Mock).mockResolvedValue(mockFundamentals);

      const result = await stockService.getFinancialMetrics('AAPL');

      expect(typeof result?.revenue).toBe('number');
      expect(result?.revenue).toBe(394328000000);
    });

    it('should continue with database query when cache read fails', async () => {
      (redisHelpers.getJson as jest.Mock).mockRejectedValue(new Error('Redis Error'));
      (prisma.fundamentalMetrics.findUnique as jest.Mock).mockResolvedValue(mockFundamentals);

      const result = await stockService.getFinancialMetrics('AAPL');

      expect(result).not.toBeNull();
      expect(result?.pe).toBe(28.5);
    });

    it('should not fail when cache write fails', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.fundamentalMetrics.findUnique as jest.Mock).mockResolvedValue(mockFundamentals);
      (redisHelpers.setJson as jest.Mock).mockRejectedValue(new Error('Redis Error'));

      const result = await stockService.getFinancialMetrics('AAPL');

      expect(result).not.toBeNull();
      expect(result?.pe).toBe(28.5);
    });

    it('should cache with correct TTL (1 hour = 3600 seconds)', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.fundamentalMetrics.findUnique as jest.Mock).mockResolvedValue(mockFundamentals);

      await stockService.getFinancialMetrics('AAPL');

      // Verify cache was set with fundamentals TTL (3600 seconds)
      expect(redisHelpers.setJson).toHaveBeenCalledWith(
        expect.stringContaining('fundamentals'),
        expect.any(Object),
        3600
      );
    });

    it('should trim whitespace from symbol', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.fundamentalMetrics.findUnique as jest.Mock).mockResolvedValue(mockFundamentals);

      await stockService.getFinancialMetrics('  AAPL  ');

      expect(prisma.fundamentalMetrics.findUnique).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
      });
    });
  });

  describe('getInsiderTradeSummary', () => {
    const mockInsiderTrades = [
      {
        id: 'trade-1',
        symbol: 'AAPL',
        filedAt: new Date('2024-01-15'),
        tradeDate: new Date('2024-01-10'),
        insiderName: 'Tim Cook',
        insiderTitle: 'CEO',
        transactionType: 'sell',
        shares: BigInt(50000),
        pricePerShare: 175.50,
        totalValue: 8775000,
        sharesOwned: BigInt(1000000),
      },
      {
        id: 'trade-2',
        symbol: 'AAPL',
        filedAt: new Date('2024-01-12'),
        tradeDate: new Date('2024-01-08'),
        insiderName: 'Luca Maestri',
        insiderTitle: 'CFO',
        transactionType: 'buy',
        shares: BigInt(10000),
        pricePerShare: 172.00,
        totalValue: 1720000,
        sharesOwned: BigInt(500000),
      },
      {
        id: 'trade-3',
        symbol: 'AAPL',
        filedAt: new Date('2024-01-10'),
        tradeDate: new Date('2024-01-05'),
        insiderName: 'Jeff Williams',
        insiderTitle: 'COO',
        transactionType: 'sell',
        shares: BigInt(25000),
        pricePerShare: 170.00,
        totalValue: 4250000,
        sharesOwned: BigInt(750000),
      },
    ];

    it('should return insider trade summary from database when cache miss', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(mockInsiderTrades);

      const result = await stockService.getInsiderTradeSummary('AAPL', '3M');

      expect(result).not.toBeNull();
      expect(result?.symbol).toBe('AAPL');
      expect(result?.period).toBe('3M');
      expect(result?.totalBuyShares).toBe(10000);
      expect(result?.totalBuyValue).toBe(1720000);
      expect(result?.totalSellShares).toBe(75000);
      expect(result?.totalSellValue).toBe(13025000);
      expect(result?.netShares).toBe(-65000);
      expect(result?.netValue).toBe(-11305000);
      expect(result?.buyTransactions).toBe(1);
      expect(result?.sellTransactions).toBe(2);
      
      // Verify cache was checked
      expect(redisHelpers.getJson).toHaveBeenCalled();
      // Verify database was queried
      expect(prisma.insiderTrade.findMany).toHaveBeenCalled();
      // Verify results were cached
      expect(redisHelpers.setJson).toHaveBeenCalled();
    });

    it('should return cached insider trade summary when cache hit', async () => {
      const cachedSummary = {
        symbol: 'AAPL',
        period: '3M',
        totalBuyShares: 10000,
        totalBuyValue: 1720000,
        totalSellShares: 75000,
        totalSellValue: 13025000,
        netShares: -65000,
        netValue: -11305000,
        buyTransactions: 1,
        sellTransactions: 2,
      };

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(cachedSummary);

      const result = await stockService.getInsiderTradeSummary('AAPL', '3M');

      expect(result?.symbol).toBe('AAPL');
      expect(result?.totalBuyShares).toBe(10000);
      // Verify database was NOT queried
      expect(prisma.insiderTrade.findMany).not.toHaveBeenCalled();
    });

    it('should return null when no trades found', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue([]);

      const result = await stockService.getInsiderTradeSummary('INVALID', '3M');

      expect(result).toBeNull();
    });

    it('should normalize symbol to uppercase', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(mockInsiderTrades);

      await stockService.getInsiderTradeSummary('aapl', '3M');

      expect(prisma.insiderTrade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            symbol: 'AAPL',
          }),
        })
      );
    });

    it('should handle different period formats', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(mockInsiderTrades);

      // Test 6M period
      await stockService.getInsiderTradeSummary('AAPL', '6M');
      expect(prisma.insiderTrade.findMany).toHaveBeenCalled();

      // Test 1Y period
      await stockService.getInsiderTradeSummary('AAPL', '1Y');
      expect(prisma.insiderTrade.findMany).toHaveBeenCalled();
    });

    it('should not count exercise transactions in buy/sell summary', async () => {
      const tradesWithExercise = [
        ...mockInsiderTrades,
        {
          id: 'trade-4',
          symbol: 'AAPL',
          filedAt: new Date('2024-01-08'),
          tradeDate: new Date('2024-01-03'),
          insiderName: 'Kate Adams',
          insiderTitle: 'General Counsel',
          transactionType: 'exercise',
          shares: BigInt(100000),
          pricePerShare: 50.00,
          totalValue: 5000000,
          sharesOwned: BigInt(200000),
        },
      ];

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(tradesWithExercise);

      const result = await stockService.getInsiderTradeSummary('AAPL', '3M');

      // Exercise transactions should not be counted
      expect(result?.buyTransactions).toBe(1);
      expect(result?.sellTransactions).toBe(2);
      expect(result?.totalBuyShares).toBe(10000);
      expect(result?.totalSellShares).toBe(75000);
    });

    it('should continue with database query when cache read fails', async () => {
      (redisHelpers.getJson as jest.Mock).mockRejectedValue(new Error('Redis Error'));
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(mockInsiderTrades);

      const result = await stockService.getInsiderTradeSummary('AAPL', '3M');

      expect(result).not.toBeNull();
      expect(result?.symbol).toBe('AAPL');
    });

    it('should not fail when cache write fails', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(mockInsiderTrades);
      (redisHelpers.setJson as jest.Mock).mockRejectedValue(new Error('Redis Error'));

      const result = await stockService.getInsiderTradeSummary('AAPL', '3M');

      expect(result).not.toBeNull();
      expect(result?.symbol).toBe('AAPL');
    });

    it('should default to 3 months for invalid period format', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(mockInsiderTrades);

      await stockService.getInsiderTradeSummary('AAPL', 'invalid');

      expect(prisma.insiderTrade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tradeDate: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        })
      );
    });
  });

  describe('getRecentInsiderTrades', () => {
    const mockInsiderTrades = [
      {
        id: 'trade-1',
        symbol: 'AAPL',
        filedAt: new Date('2024-01-15'),
        tradeDate: new Date('2024-01-10'),
        insiderName: 'Tim Cook',
        insiderTitle: 'CEO',
        transactionType: 'sell',
        shares: BigInt(50000),
        pricePerShare: 175.50,
        totalValue: 8775000,
        sharesOwned: BigInt(1000000),
      },
      {
        id: 'trade-2',
        symbol: 'AAPL',
        filedAt: new Date('2024-01-12'),
        tradeDate: new Date('2024-01-08'),
        insiderName: 'Luca Maestri',
        insiderTitle: 'CFO',
        transactionType: 'buy',
        shares: BigInt(10000),
        pricePerShare: 172.00,
        totalValue: 1720000,
        sharesOwned: BigInt(500000),
      },
    ];

    it('should return recent insider trades from database when cache miss', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(mockInsiderTrades);

      const result = await stockService.getRecentInsiderTrades('AAPL', 10);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('trade-1');
      expect(result[0].symbol).toBe('AAPL');
      expect(result[0].insiderName).toBe('Tim Cook');
      expect(result[0].insiderTitle).toBe('CEO');
      expect(result[0].transactionType).toBe('sell');
      expect(result[0].shares).toBe(50000);
      expect(result[0].pricePerShare).toBe(175.50);
      expect(result[0].totalValue).toBe(8775000);
      expect(result[0].sharesOwned).toBe(1000000);
      
      // Verify cache was checked
      expect(redisHelpers.getJson).toHaveBeenCalled();
      // Verify database was queried
      expect(prisma.insiderTrade.findMany).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
        orderBy: { tradeDate: 'desc' },
        take: 10,
      });
      // Verify results were cached
      expect(redisHelpers.setJson).toHaveBeenCalled();
    });

    it('should return cached recent insider trades when cache hit', async () => {
      const cachedTrades = [
        {
          id: 'trade-1',
          symbol: 'AAPL',
          filedAt: '2024-01-15T00:00:00.000Z',
          tradeDate: '2024-01-10T00:00:00.000Z',
          insiderName: 'Tim Cook',
          insiderTitle: 'CEO',
          transactionType: 'sell',
          shares: 50000,
          pricePerShare: 175.50,
          totalValue: 8775000,
          sharesOwned: 1000000,
        },
      ];

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(cachedTrades);

      const result = await stockService.getRecentInsiderTrades('AAPL', 10);

      expect(result).toHaveLength(1);
      expect(result[0].insiderName).toBe('Tim Cook');
      expect(result[0].filedAt).toBeInstanceOf(Date);
      expect(result[0].tradeDate).toBeInstanceOf(Date);
      // Verify database was NOT queried
      expect(prisma.insiderTrade.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array when no trades found', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue([]);

      const result = await stockService.getRecentInsiderTrades('INVALID', 10);

      expect(result).toHaveLength(0);
    });

    it('should normalize symbol to uppercase', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(mockInsiderTrades);

      await stockService.getRecentInsiderTrades('aapl', 10);

      expect(prisma.insiderTrade.findMany).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
        orderBy: { tradeDate: 'desc' },
        take: 10,
      });
    });

    it('should respect limit parameter', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(mockInsiderTrades);

      await stockService.getRecentInsiderTrades('AAPL', 5);

      expect(prisma.insiderTrade.findMany).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
        orderBy: { tradeDate: 'desc' },
        take: 5,
      });
    });

    it('should cap limit at 50 for performance', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(mockInsiderTrades);

      await stockService.getRecentInsiderTrades('AAPL', 100);

      expect(prisma.insiderTrade.findMany).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
        orderBy: { tradeDate: 'desc' },
        take: 50,
      });
    });

    it('should use default limit of 10 when not specified', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(mockInsiderTrades);

      await stockService.getRecentInsiderTrades('AAPL');

      expect(prisma.insiderTrade.findMany).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
        orderBy: { tradeDate: 'desc' },
        take: 10,
      });
    });

    it('should handle null insiderTitle', async () => {
      const tradesWithNullTitle = [
        {
          ...mockInsiderTrades[0],
          insiderTitle: null,
        },
      ];

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(tradesWithNullTitle);

      const result = await stockService.getRecentInsiderTrades('AAPL', 10);

      expect(result[0].insiderTitle).toBeNull();
    });

    it('should handle null sharesOwned', async () => {
      const tradesWithNullSharesOwned = [
        {
          ...mockInsiderTrades[0],
          sharesOwned: null,
        },
      ];

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(tradesWithNullSharesOwned);

      const result = await stockService.getRecentInsiderTrades('AAPL', 10);

      expect(result[0].sharesOwned).toBeNull();
    });

    it('should convert BigInt shares to number', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(mockInsiderTrades);

      const result = await stockService.getRecentInsiderTrades('AAPL', 10);

      expect(typeof result[0].shares).toBe('number');
      expect(result[0].shares).toBe(50000);
    });

    it('should continue with database query when cache read fails', async () => {
      (redisHelpers.getJson as jest.Mock).mockRejectedValue(new Error('Redis Error'));
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(mockInsiderTrades);

      const result = await stockService.getRecentInsiderTrades('AAPL', 10);

      expect(result).toHaveLength(2);
    });

    it('should not fail when cache write fails', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(mockInsiderTrades);
      (redisHelpers.setJson as jest.Mock).mockRejectedValue(new Error('Redis Error'));

      const result = await stockService.getRecentInsiderTrades('AAPL', 10);

      expect(result).toHaveLength(2);
    });
  });

  describe('getStockFullDetail', () => {
    const mockStockDetail = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      exchange: 'NASDAQ',
      sector: 'Technology',
      industry: 'Consumer Electronics',
      marketCap: BigInt(3000000000000),
      country: 'US',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    };

    const mockQuote = {
      id: 'quote-1',
      symbol: 'AAPL',
      price: 175.50,
      change: 2.50,
      changePercent: 1.45,
      volume: BigInt(50000000),
      avgVolume: BigInt(45000000),
      high: 176.00,
      low: 173.00,
      open: 174.00,
      previousClose: 173.00,
      timestamp: new Date('2024-01-15T10:30:00Z'),
    };

    const mockFundamentals = {
      id: 'fund-1',
      symbol: 'AAPL',
      pe: 28.5,
      forwardPe: 25.2,
      peg: 1.8,
      ps: 7.5,
      pb: 45.2,
      eps: 6.15,
      epsGrowth: 0.12,
      revenue: BigInt(394328000000),
      revenueGrowth: 0.08,
      grossMargin: 0.438,
      operatingMargin: 0.302,
      netMargin: 0.253,
      roe: 1.47,
      roa: 0.28,
      debtToEquity: 1.81,
      currentRatio: 0.99,
      dividendYield: 0.005,
      payoutRatio: 0.15,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    };

    const mockAnalystRatings = [
      {
        id: 'rating-1',
        symbol: 'AAPL',
        analyst: 'John Doe',
        firm: 'Goldman Sachs',
        rating: 'buy',
        targetPrice: 200.00,
        previousRating: 'hold',
        previousTargetPrice: 180.00,
        ratingDate: new Date('2024-01-10'),
      },
    ];

    const mockInsiderTrades = [
      {
        id: 'trade-1',
        symbol: 'AAPL',
        filedAt: new Date('2024-01-12'),
        tradeDate: new Date('2024-01-10'),
        insiderName: 'Tim Cook',
        insiderTitle: 'CEO',
        transactionType: 'sell',
        shares: BigInt(50000),
        pricePerShare: 175.00,
        totalValue: 8750000,
        sharesOwned: BigInt(3000000),
      },
    ];

    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();
      // Default mock implementations
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.stock.findUnique as jest.Mock).mockResolvedValue(mockStockDetail);
      (prisma.stockQuote.findFirst as jest.Mock).mockResolvedValue(mockQuote);
      (prisma.fundamentalMetrics.findUnique as jest.Mock).mockResolvedValue(mockFundamentals);
      (prisma.analystRating.findMany as jest.Mock).mockResolvedValue(mockAnalystRatings);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(mockInsiderTrades);
    });

    it('should return aggregated stock full detail', async () => {
      const result = await stockService.getStockFullDetail('AAPL');

      expect(result.profile).not.toBeNull();
      expect(result.profile?.symbol).toBe('AAPL');
      expect(result.quote).not.toBeNull();
      expect(result.quote?.price).toBe(175.50);
      expect(result.financials).not.toBeNull();
      expect(result.financials?.pe).toBe(28.5);
    });

    it('should fetch all data in parallel', async () => {
      await stockService.getStockFullDetail('AAPL');

      // Verify all data sources were queried
      expect(prisma.stock.findUnique).toHaveBeenCalled();
      expect(prisma.stockQuote.findFirst).toHaveBeenCalled();
      expect(prisma.fundamentalMetrics.findUnique).toHaveBeenCalled();
      expect(prisma.analystRating.findMany).toHaveBeenCalled();
      expect(prisma.insiderTrade.findMany).toHaveBeenCalled();
    });

    it('should normalize symbol to uppercase', async () => {
      await stockService.getStockFullDetail('aapl');

      expect(prisma.stock.findUnique).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
      });
    });

    it('should handle missing profile data', async () => {
      (prisma.stock.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await stockService.getStockFullDetail('INVALID');

      expect(result.profile).toBeNull();
      expect(result.quote).not.toBeNull(); // Other data may still exist
    });

    it('should handle missing quote data', async () => {
      (prisma.stockQuote.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await stockService.getStockFullDetail('AAPL');

      expect(result.profile).not.toBeNull();
      expect(result.quote).toBeNull();
    });

    it('should handle missing financial data', async () => {
      (prisma.fundamentalMetrics.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await stockService.getStockFullDetail('AAPL');

      expect(result.profile).not.toBeNull();
      expect(result.financials).toBeNull();
    });

    it('should handle missing analyst ratings', async () => {
      (prisma.analystRating.findMany as jest.Mock).mockResolvedValue([]);

      const result = await stockService.getStockFullDetail('AAPL');

      expect(result.profile).not.toBeNull();
      expect(result.analystRatings).toBeNull();
      expect(result.recentRatings).toHaveLength(0);
    });

    it('should handle missing insider trades', async () => {
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue([]);

      const result = await stockService.getStockFullDetail('AAPL');

      expect(result.profile).not.toBeNull();
      expect(result.insiderSummary).toBeNull();
      expect(result.recentInsiderTrades).toHaveLength(0);
    });

    it('should cache the aggregated result', async () => {
      await stockService.getStockFullDetail('AAPL');

      expect(redisHelpers.setJson).toHaveBeenCalledWith(
        'stock:fullDetail:AAPL',
        expect.any(Object),
        300 // 5 minutes TTL
      );
    });

    it('should not fail when cache write fails', async () => {
      (redisHelpers.setJson as jest.Mock).mockRejectedValue(new Error('Redis Error'));

      const result = await stockService.getStockFullDetail('AAPL');

      expect(result.profile).not.toBeNull();
    });

    it('should return complete data structure', async () => {
      const result = await stockService.getStockFullDetail('AAPL');

      // Verify all expected fields are present
      expect(result).toHaveProperty('profile');
      expect(result).toHaveProperty('quote');
      expect(result).toHaveProperty('financials');
      expect(result).toHaveProperty('analystRatings');
      expect(result).toHaveProperty('recentRatings');
      expect(result).toHaveProperty('insiderSummary');
      expect(result).toHaveProperty('recentInsiderTrades');
    });
  });
});
