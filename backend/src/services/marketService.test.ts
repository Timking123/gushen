/**
 * Market Service Unit Tests
 * Tests for market overview data including indices, breadth, sentiment, and leaderboards
 * 
 * Requirements:
 * - 18.1: Display major indices (Dow Jones, S&P 500, NASDAQ) real-time quotes
 * - 18.4: Display advance/decline counts, volume, and market sentiment indicators
 * - 18.5: Display top gainers, losers, and volume leaders
 */

import { MarketService } from './marketService.js';
import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';

// Mock dependencies
jest.mock('../lib/prisma', () => ({
  prisma: {
    stock: {
      findMany: jest.fn(),
    },
    stockQuote: {
      findFirst: jest.fn(),
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

describe('MarketService', () => {
  let marketService: MarketService;

  beforeEach(() => {
    marketService = new MarketService();
    jest.clearAllMocks();
    // Default to cache miss
    (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
  });


  describe('getMarketIndices', () => {
    it('should return major market indices with mock data when no real data exists', async () => {
      // Mock no data in database
      (prisma.stockQuote.findFirst as jest.Mock).mockResolvedValue(null);

      const indices = await marketService.getMarketIndices();

      expect(indices).toHaveLength(3);
      expect(indices.map(i => i.symbol)).toEqual(['DJI', 'SPX', 'IXIC']);
      
      // Verify each index has required fields
      for (const index of indices) {
        expect(index).toHaveProperty('symbol');
        expect(index).toHaveProperty('name');
        expect(index).toHaveProperty('price');
        expect(index).toHaveProperty('change');
        expect(index).toHaveProperty('changePercent');
        expect(index).toHaveProperty('previousClose');
        expect(index).toHaveProperty('open');
        expect(index).toHaveProperty('high');
        expect(index).toHaveProperty('low');
        expect(index).toHaveProperty('volume');
        expect(index).toHaveProperty('timestamp');
      }
    });

    it('should return real data when available in database', async () => {
      const mockQuote = {
        id: '1',
        symbol: 'DJI',
        price: 38500.50,
        change: 150.25,
        changePercent: 0.39,
        previousClose: 38350.25,
        open: 38400.00,
        high: 38600.00,
        low: 38300.00,
        volume: BigInt(250000000),
        avgVolume: BigInt(200000000),
        timestamp: new Date('2024-01-15T16:00:00Z'),
      };

      (prisma.stockQuote.findFirst as jest.Mock).mockResolvedValue(mockQuote);

      const indices = await marketService.getMarketIndices();

      expect(indices).toHaveLength(3);
      const dji = indices.find(i => i.symbol === 'DJI');
      expect(dji).toBeDefined();
      expect(dji?.price).toBe(38500.50);
      expect(dji?.change).toBe(150.25);
      expect(dji?.changePercent).toBe(0.39);
    });

    it('should return cached data when cache hit', async () => {
      const cachedIndices = [
        { symbol: 'DJI', name: '道琼斯工业平均指数', price: 38500, change: 100, changePercent: 0.26, previousClose: 38400, open: 38450, high: 38600, low: 38300, volume: 200000000, timestamp: new Date().toISOString() },
      ];
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(cachedIndices);

      const indices = await marketService.getMarketIndices();

      expect(indices).toHaveLength(1);
      expect(indices[0].symbol).toBe('DJI');
      expect(prisma.stockQuote.findFirst).not.toHaveBeenCalled();
    });
  });


  describe('calculateMarketBreadth', () => {
    it('should calculate correct advance/decline counts', async () => {
      const mockStocks = [
        { symbol: 'AAPL' },
        { symbol: 'GOOGL' },
        { symbol: 'MSFT' },
        { symbol: 'AMZN' },
        { symbol: 'META' },
      ];

      const mockQuotes = [
        { symbol: 'AAPL', changePercent: 2.5, volume: BigInt(50000000) },
        { symbol: 'GOOGL', changePercent: -1.2, volume: BigInt(30000000) },
        { symbol: 'MSFT', changePercent: 0.8, volume: BigInt(40000000) },
        { symbol: 'AMZN', changePercent: 0, volume: BigInt(25000000) },
        { symbol: 'META', changePercent: -0.5, volume: BigInt(35000000) },
      ];

      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStocks);
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue(mockQuotes);

      const breadth = await marketService.calculateMarketBreadth();

      expect(breadth.advancing).toBe(2); // AAPL, MSFT
      expect(breadth.declining).toBe(2); // GOOGL, META
      expect(breadth.unchanged).toBe(1); // AMZN
      expect(breadth.total).toBe(5);
      expect(breadth.advanceDeclineRatio).toBe(1); // 2/2 = 1
    });

    it('should handle all advancing stocks', async () => {
      const mockStocks = [
        { symbol: 'AAPL' },
        { symbol: 'GOOGL' },
      ];

      const mockQuotes = [
        { symbol: 'AAPL', changePercent: 2.5, volume: BigInt(50000000) },
        { symbol: 'GOOGL', changePercent: 1.2, volume: BigInt(30000000) },
      ];

      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStocks);
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue(mockQuotes);

      const breadth = await marketService.calculateMarketBreadth();

      expect(breadth.advancing).toBe(2);
      expect(breadth.declining).toBe(0);
      expect(breadth.advanceDeclineRatio).toBe(999); // Capped at 999 when no decliners
    });

    it('should handle empty market', async () => {
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue([]);

      const breadth = await marketService.calculateMarketBreadth();

      expect(breadth.advancing).toBe(0);
      expect(breadth.declining).toBe(0);
      expect(breadth.unchanged).toBe(0);
      expect(breadth.total).toBe(0);
    });

    it('should calculate correct volume totals', async () => {
      const mockStocks = [
        { symbol: 'AAPL' },
        { symbol: 'GOOGL' },
      ];

      const mockQuotes = [
        { symbol: 'AAPL', changePercent: 2.5, volume: BigInt(50000000) },
        { symbol: 'GOOGL', changePercent: -1.2, volume: BigInt(30000000) },
      ];

      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStocks);
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue(mockQuotes);

      const breadth = await marketService.calculateMarketBreadth();

      expect(breadth.advanceVolume).toBe(50000000);
      expect(breadth.declineVolume).toBe(30000000);
      expect(breadth.totalVolume).toBe(80000000);
    });
  });


  describe('getMarketSentiment', () => {
    it('should return bullish sentiment when more stocks are advancing', async () => {
      const mockStocks = [
        { symbol: 'AAPL' },
        { symbol: 'GOOGL' },
        { symbol: 'MSFT' },
        { symbol: 'AMZN' },
        { symbol: 'META' },
      ];

      const mockQuotes = [
        { symbol: 'AAPL', changePercent: 2.5, volume: BigInt(50000000) },
        { symbol: 'GOOGL', changePercent: 1.2, volume: BigInt(30000000) },
        { symbol: 'MSFT', changePercent: 0.8, volume: BigInt(40000000) },
        { symbol: 'AMZN', changePercent: 0.5, volume: BigInt(25000000) },
        { symbol: 'META', changePercent: -0.5, volume: BigInt(35000000) },
      ];

      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStocks);
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue(mockQuotes);

      const sentiment = await marketService.getMarketSentiment();

      expect(sentiment.sentiment).toBe('bullish');
      expect(sentiment.score).toBeGreaterThan(20);
      expect(sentiment.fearGreedIndex).toBeGreaterThan(50);
    });

    it('should return bearish sentiment when more stocks are declining', async () => {
      const mockStocks = [
        { symbol: 'AAPL' },
        { symbol: 'GOOGL' },
        { symbol: 'MSFT' },
        { symbol: 'AMZN' },
        { symbol: 'META' },
      ];

      const mockQuotes = [
        { symbol: 'AAPL', changePercent: -2.5, volume: BigInt(50000000) },
        { symbol: 'GOOGL', changePercent: -1.2, volume: BigInt(30000000) },
        { symbol: 'MSFT', changePercent: -0.8, volume: BigInt(40000000) },
        { symbol: 'AMZN', changePercent: -0.5, volume: BigInt(25000000) },
        { symbol: 'META', changePercent: 0.5, volume: BigInt(35000000) },
      ];

      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStocks);
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue(mockQuotes);

      const sentiment = await marketService.getMarketSentiment();

      expect(sentiment.sentiment).toBe('bearish');
      expect(sentiment.score).toBeLessThan(-20);
      expect(sentiment.fearGreedIndex).toBeLessThan(50);
    });

    it('should return neutral sentiment when market is balanced', async () => {
      const mockStocks = [
        { symbol: 'AAPL' },
        { symbol: 'GOOGL' },
      ];

      const mockQuotes = [
        { symbol: 'AAPL', changePercent: 1.0, volume: BigInt(50000000) },
        { symbol: 'GOOGL', changePercent: -1.0, volume: BigInt(30000000) },
      ];

      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStocks);
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue(mockQuotes);

      const sentiment = await marketService.getMarketSentiment();

      expect(sentiment.sentiment).toBe('neutral');
      expect(sentiment.score).toBeGreaterThanOrEqual(-20);
      expect(sentiment.score).toBeLessThanOrEqual(20);
    });

    it('should return cached sentiment when cache hit', async () => {
      const cachedSentiment = {
        sentiment: 'bullish',
        score: 60,
        breadth: { advancing: 4, declining: 1, unchanged: 0, total: 5, advanceDeclineRatio: 4, advanceVolume: 100, declineVolume: 20, totalVolume: 120 },
        fearGreedIndex: 80,
        description: '市场情绪极度乐观',
      };
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(cachedSentiment);

      const sentiment = await marketService.getMarketSentiment();

      expect(sentiment.sentiment).toBe('bullish');
      expect(sentiment.score).toBe(60);
      expect(prisma.stock.findMany).not.toHaveBeenCalled();
    });
  });


  describe('getTopGainers', () => {
    it('should return stocks sorted by changePercent descending', async () => {
      const mockStocks = [
        { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', marketCap: BigInt(3000000000000) },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', marketCap: BigInt(2000000000000) },
        { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology', marketCap: BigInt(2500000000000) },
      ];

      const mockQuotes = [
        { symbol: 'AAPL', price: 180, change: 5.4, changePercent: 3.0, volume: BigInt(50000000) },
        { symbol: 'GOOGL', price: 140, change: 7.0, changePercent: 5.0, volume: BigInt(30000000) },
        { symbol: 'MSFT', price: 380, change: 3.8, changePercent: 1.0, volume: BigInt(40000000) },
      ];

      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStocks);
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue(mockQuotes);

      const gainers = await marketService.getTopGainers(10);

      expect(gainers).toHaveLength(3);
      expect(gainers[0].symbol).toBe('GOOGL'); // 5.0%
      expect(gainers[1].symbol).toBe('AAPL');  // 3.0%
      expect(gainers[2].symbol).toBe('MSFT');  // 1.0%
    });

    it('should only include stocks with positive change', async () => {
      const mockStocks = [
        { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', marketCap: BigInt(3000000000000) },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', marketCap: BigInt(2000000000000) },
      ];

      const mockQuotes = [
        { symbol: 'AAPL', price: 180, change: 5.4, changePercent: 3.0, volume: BigInt(50000000) },
        { symbol: 'GOOGL', price: 140, change: -7.0, changePercent: -5.0, volume: BigInt(30000000) },
      ];

      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStocks);
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue(mockQuotes);

      const gainers = await marketService.getTopGainers(10);

      expect(gainers).toHaveLength(1);
      expect(gainers[0].symbol).toBe('AAPL');
    });

    it('should respect the limit parameter', async () => {
      const mockStocks = Array.from({ length: 20 }, (_, i) => ({
        symbol: `STOCK${i}`,
        name: `Stock ${i}`,
        sector: 'Technology',
        marketCap: BigInt(1000000000),
      }));

      const mockQuotes = Array.from({ length: 20 }, (_, i) => ({
        symbol: `STOCK${i}`,
        price: 100,
        change: i + 1,
        changePercent: i + 1,
        volume: BigInt(10000000),
      }));

      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStocks);
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue(mockQuotes);

      const gainers = await marketService.getTopGainers(5);

      expect(gainers).toHaveLength(5);
    });

    it('should return cached data when cache hit', async () => {
      const cachedGainers = [
        { symbol: 'AAPL', name: 'Apple', sector: 'Tech', price: 180, change: 5, changePercent: 3, volume: 50000000, marketCap: 3000000000000 },
      ];
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(cachedGainers);

      const gainers = await marketService.getTopGainers(10);

      expect(gainers).toHaveLength(1);
      expect(gainers[0].symbol).toBe('AAPL');
      expect(prisma.stock.findMany).not.toHaveBeenCalled();
    });
  });


  describe('getTopLosers', () => {
    it('should return stocks sorted by changePercent ascending (most negative first)', async () => {
      const mockStocks = [
        { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', marketCap: BigInt(3000000000000) },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', marketCap: BigInt(2000000000000) },
        { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology', marketCap: BigInt(2500000000000) },
      ];

      const mockQuotes = [
        { symbol: 'AAPL', price: 180, change: -5.4, changePercent: -3.0, volume: BigInt(50000000) },
        { symbol: 'GOOGL', price: 140, change: -7.0, changePercent: -5.0, volume: BigInt(30000000) },
        { symbol: 'MSFT', price: 380, change: -3.8, changePercent: -1.0, volume: BigInt(40000000) },
      ];

      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStocks);
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue(mockQuotes);

      const losers = await marketService.getTopLosers(10);

      expect(losers).toHaveLength(3);
      expect(losers[0].symbol).toBe('GOOGL'); // -5.0%
      expect(losers[1].symbol).toBe('AAPL');  // -3.0%
      expect(losers[2].symbol).toBe('MSFT');  // -1.0%
    });

    it('should only include stocks with negative change', async () => {
      const mockStocks = [
        { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', marketCap: BigInt(3000000000000) },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', marketCap: BigInt(2000000000000) },
      ];

      const mockQuotes = [
        { symbol: 'AAPL', price: 180, change: 5.4, changePercent: 3.0, volume: BigInt(50000000) },
        { symbol: 'GOOGL', price: 140, change: -7.0, changePercent: -5.0, volume: BigInt(30000000) },
      ];

      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStocks);
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue(mockQuotes);

      const losers = await marketService.getTopLosers(10);

      expect(losers).toHaveLength(1);
      expect(losers[0].symbol).toBe('GOOGL');
    });

    it('should return cached data when cache hit', async () => {
      const cachedLosers = [
        { symbol: 'GOOGL', name: 'Alphabet', sector: 'Tech', price: 140, change: -7, changePercent: -5, volume: 30000000, marketCap: 2000000000000 },
      ];
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(cachedLosers);

      const losers = await marketService.getTopLosers(10);

      expect(losers).toHaveLength(1);
      expect(losers[0].symbol).toBe('GOOGL');
      expect(prisma.stock.findMany).not.toHaveBeenCalled();
    });
  });


  describe('getMostActive', () => {
    it('should return stocks sorted by volume descending', async () => {
      const mockStocks = [
        { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', marketCap: BigInt(3000000000000) },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', marketCap: BigInt(2000000000000) },
        { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology', marketCap: BigInt(2500000000000) },
      ];

      const mockQuotes = [
        { symbol: 'AAPL', price: 180, change: 5.4, changePercent: 3.0, volume: BigInt(50000000) },
        { symbol: 'GOOGL', price: 140, change: 7.0, changePercent: 5.0, volume: BigInt(80000000) },
        { symbol: 'MSFT', price: 380, change: 3.8, changePercent: 1.0, volume: BigInt(30000000) },
      ];

      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStocks);
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue(mockQuotes);

      const mostActive = await marketService.getMostActive(10);

      expect(mostActive).toHaveLength(3);
      expect(mostActive[0].symbol).toBe('GOOGL'); // 80M
      expect(mostActive[1].symbol).toBe('AAPL');  // 50M
      expect(mostActive[2].symbol).toBe('MSFT');  // 30M
    });

    it('should include both gainers and losers', async () => {
      const mockStocks = [
        { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', marketCap: BigInt(3000000000000) },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', marketCap: BigInt(2000000000000) },
      ];

      const mockQuotes = [
        { symbol: 'AAPL', price: 180, change: 5.4, changePercent: 3.0, volume: BigInt(50000000) },
        { symbol: 'GOOGL', price: 140, change: -7.0, changePercent: -5.0, volume: BigInt(80000000) },
      ];

      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStocks);
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue(mockQuotes);

      const mostActive = await marketService.getMostActive(10);

      expect(mostActive).toHaveLength(2);
      // GOOGL has higher volume, should be first regardless of direction
      expect(mostActive[0].symbol).toBe('GOOGL');
      expect(mostActive[1].symbol).toBe('AAPL');
    });

    it('should return cached data when cache hit', async () => {
      const cachedMostActive = [
        { symbol: 'GOOGL', name: 'Alphabet', sector: 'Tech', price: 140, change: 7, changePercent: 5, volume: 80000000, marketCap: 2000000000000 },
      ];
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(cachedMostActive);

      const mostActive = await marketService.getMostActive(10);

      expect(mostActive).toHaveLength(1);
      expect(mostActive[0].symbol).toBe('GOOGL');
      expect(prisma.stock.findMany).not.toHaveBeenCalled();
    });
  });


  describe('getLeaderboards', () => {
    it('should return all three leaderboards', async () => {
      const mockStocks = [
        { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', marketCap: BigInt(3000000000000) },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', marketCap: BigInt(2000000000000) },
        { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology', marketCap: BigInt(2500000000000) },
      ];

      const mockQuotes = [
        { symbol: 'AAPL', price: 180, change: 5.4, changePercent: 3.0, volume: BigInt(50000000) },
        { symbol: 'GOOGL', price: 140, change: -7.0, changePercent: -5.0, volume: BigInt(80000000) },
        { symbol: 'MSFT', price: 380, change: 3.8, changePercent: 1.0, volume: BigInt(30000000) },
      ];

      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStocks);
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue(mockQuotes);

      const leaderboards = await marketService.getLeaderboards(10);

      expect(leaderboards).toHaveProperty('topGainers');
      expect(leaderboards).toHaveProperty('topLosers');
      expect(leaderboards).toHaveProperty('mostActive');
      expect(leaderboards).toHaveProperty('lastUpdated');

      expect(leaderboards.topGainers.length).toBeGreaterThan(0);
      expect(leaderboards.topLosers.length).toBeGreaterThan(0);
      expect(leaderboards.mostActive.length).toBeGreaterThan(0);
    });
  });

  describe('getMarketOverview', () => {
    it('should return complete market overview', async () => {
      const mockStocks = [
        { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', marketCap: BigInt(3000000000000) },
      ];

      const mockQuotes = [
        { symbol: 'AAPL', price: 180, change: 5.4, changePercent: 3.0, volume: BigInt(50000000) },
      ];

      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStocks);
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue(mockQuotes);
      (prisma.stockQuote.findFirst as jest.Mock).mockResolvedValue(null);

      const overview = await marketService.getMarketOverview(10);

      expect(overview).toHaveProperty('indices');
      expect(overview).toHaveProperty('sentiment');
      expect(overview).toHaveProperty('leaderboards');
      expect(overview).toHaveProperty('lastUpdated');

      expect(overview.indices).toHaveLength(3);
      expect(overview.sentiment).toHaveProperty('sentiment');
      expect(overview.sentiment).toHaveProperty('score');
      expect(overview.sentiment).toHaveProperty('breadth');
      expect(overview.leaderboards).toHaveProperty('topGainers');
      expect(overview.leaderboards).toHaveProperty('topLosers');
      expect(overview.leaderboards).toHaveProperty('mostActive');
    });
  });
});
