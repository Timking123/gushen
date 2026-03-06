import request from 'supertest';
import express, { Express } from 'express';
import stockRoutes from './stocks.js';
import { stockService } from '../services/stockService.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Mock the stock service
jest.mock('../services/stockService', () => ({
  stockService: {
    searchStocks: jest.fn(),
    getStockDetail: jest.fn(),
    getQuote: jest.fn(),
    getHistoricalData: jest.fn(),
    getStockFullDetail: jest.fn(),
    getFinancialMetrics: jest.fn(),
    getAnalystRatingSummary: jest.fn(),
    getRecentAnalystRatings: jest.fn(),
    getInsiderTradeSummary: jest.fn(),
    getRecentInsiderTrades: jest.fn(),
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

describe('Stock Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/stocks', stockRoutes);
    app.use(errorHandler);
    jest.clearAllMocks();
  });

  describe('GET /api/stocks/search', () => {
    const mockSearchResults = [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        exchange: 'NASDAQ',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        marketCap: 3000000000000,
        country: 'US',
      },
      {
        symbol: 'AAPD',
        name: 'Direxion Daily AAPL Bear 1X Shares',
        exchange: 'NASDAQ',
        sector: 'Financial',
        industry: 'ETF',
        marketCap: 100000000,
        country: 'US',
      },
    ];

    it('should return search results for valid query', async () => {
      (stockService.searchStocks as jest.Mock).mockResolvedValue(mockSearchResults);

      const response = await request(app)
        .get('/api/stocks/search')
        .query({ q: 'AAPL' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.query).toBe('AAPL');
      expect(response.body.data.count).toBe(2);
      expect(response.body.data.stocks).toHaveLength(2);
      expect(response.body.data.stocks[0].symbol).toBe('AAPL');
    });

    it('should return empty results with appropriate message', async () => {
      (stockService.searchStocks as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/stocks/search')
        .query({ q: 'NONEXISTENT' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBe(0);
      expect(response.body.data.stocks).toHaveLength(0);
      expect(response.body.message).toBe('未找到匹配的股票');
    });

    it('should return validation error for missing query parameter', async () => {
      const response = await request(app)
        .get('/api/stocks/search');

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should return validation error for empty query', async () => {
      const response = await request(app)
        .get('/api/stocks/search')
        .query({ q: '' });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should respect limit parameter', async () => {
      (stockService.searchStocks as jest.Mock).mockResolvedValue([mockSearchResults[0]]);

      const response = await request(app)
        .get('/api/stocks/search')
        .query({ q: 'AAPL', limit: '1' });

      expect(response.status).toBe(200);
      expect(stockService.searchStocks).toHaveBeenCalledWith('AAPL', 1);
    });

    it('should use default limit when not specified', async () => {
      (stockService.searchStocks as jest.Mock).mockResolvedValue(mockSearchResults);

      await request(app)
        .get('/api/stocks/search')
        .query({ q: 'AAPL' });

      expect(stockService.searchStocks).toHaveBeenCalledWith('AAPL', 20);
    });

    it('should return validation error for invalid limit', async () => {
      const response = await request(app)
        .get('/api/stocks/search')
        .query({ q: 'AAPL', limit: '0' });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should return validation error for limit exceeding maximum', async () => {
      const response = await request(app)
        .get('/api/stocks/search')
        .query({ q: 'AAPL', limit: '101' });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should return validation error for query exceeding maximum length', async () => {
      const longQuery = 'A'.repeat(101);

      const response = await request(app)
        .get('/api/stocks/search')
        .query({ q: longQuery });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should handle service errors gracefully', async () => {
      (stockService.searchStocks as jest.Mock).mockRejectedValue(new Error('Service Error'));

      const response = await request(app)
        .get('/api/stocks/search')
        .query({ q: 'AAPL' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/stocks/:symbol', () => {
    const mockStockDetail = {
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

    it('should return stock detail for valid symbol', async () => {
      (stockService.getStockDetail as jest.Mock).mockResolvedValue(mockStockDetail);

      const response = await request(app)
        .get('/api/stocks/AAPL');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.symbol).toBe('AAPL');
      expect(response.body.data.name).toBe('Apple Inc.');
    });

    it('should return 404 for non-existent stock', async () => {
      (stockService.getStockDetail as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/stocks/INVALID');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('未找到该股票');
    });

    it('should return validation error for invalid symbol format', async () => {
      const response = await request(app)
        .get('/api/stocks/INVALID@SYMBOL');

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should return validation error for symbol exceeding maximum length', async () => {
      const longSymbol = 'A'.repeat(21);

      const response = await request(app)
        .get(`/api/stocks/${longSymbol}`);

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should handle service errors gracefully', async () => {
      (stockService.getStockDetail as jest.Mock).mockRejectedValue(new Error('Service Error'));

      const response = await request(app)
        .get('/api/stocks/AAPL');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/stocks/:symbol/quote', () => {
    const mockQuote = {
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

    it('should return quote for valid symbol', async () => {
      (stockService.getQuote as jest.Mock).mockResolvedValue(mockQuote);

      const response = await request(app)
        .get('/api/stocks/AAPL/quote');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.symbol).toBe('AAPL');
      expect(response.body.data.price).toBe(175.50);
      expect(response.body.data.change).toBe(2.50);
      expect(response.body.data.changePercent).toBe(1.45);
      expect(response.body.message).toBe('获取行情成功');
    });

    it('should return 404 for non-existent quote', async () => {
      (stockService.getQuote as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/stocks/INVALID/quote');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('未找到该股票的行情数据');
    });

    it('should return validation error for invalid symbol format', async () => {
      const response = await request(app)
        .get('/api/stocks/INVALID@SYMBOL/quote');

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should return validation error for symbol exceeding maximum length', async () => {
      const longSymbol = 'A'.repeat(21);

      const response = await request(app)
        .get(`/api/stocks/${longSymbol}/quote`);

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should handle service errors gracefully', async () => {
      (stockService.getQuote as jest.Mock).mockRejectedValue(new Error('Service Error'));

      const response = await request(app)
        .get('/api/stocks/AAPL/quote');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/stocks/:symbol/history', () => {
    const mockHistoricalData = [
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
      {
        timestamp: new Date('2024-01-12'),
        open: 173.00,
        high: 176.00,
        low: 172.50,
        close: 175.50,
        volume: 50000000,
      },
    ];

    it('should return historical data for valid symbol with default range', async () => {
      (stockService.getHistoricalData as jest.Mock).mockResolvedValue(mockHistoricalData);

      const response = await request(app)
        .get('/api/stocks/AAPL/history');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.symbol).toBe('AAPL');
      expect(response.body.data.range).toBe('1M');
      expect(response.body.data.count).toBe(3);
      expect(response.body.data.data).toHaveLength(3);
      expect(response.body.message).toBe('获取历史数据成功');
      
      // Verify default range was used
      expect(stockService.getHistoricalData).toHaveBeenCalledWith('AAPL', '1M');
    });

    it('should return historical data with specified range', async () => {
      (stockService.getHistoricalData as jest.Mock).mockResolvedValue(mockHistoricalData);

      const response = await request(app)
        .get('/api/stocks/AAPL/history')
        .query({ range: '1Y' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.range).toBe('1Y');
      expect(stockService.getHistoricalData).toHaveBeenCalledWith('AAPL', '1Y');
    });

    it('should return empty data with appropriate message', async () => {
      (stockService.getHistoricalData as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/stocks/AAPL/history');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBe(0);
      expect(response.body.data.data).toHaveLength(0);
      expect(response.body.message).toBe('暂无历史数据');
    });

    it('should return validation error for invalid symbol format', async () => {
      const response = await request(app)
        .get('/api/stocks/INVALID@SYMBOL/history');

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should return validation error for invalid range', async () => {
      const response = await request(app)
        .get('/api/stocks/AAPL/history')
        .query({ range: 'INVALID' });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it.each(['1D', '5D', '1M', '3M', '6M', '1Y', '5Y', 'MAX'])(
      'should accept valid range: %s',
      async (range) => {
        (stockService.getHistoricalData as jest.Mock).mockResolvedValue(mockHistoricalData);

        const response = await request(app)
          .get('/api/stocks/AAPL/history')
          .query({ range });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.range).toBe(range);
      }
    );

    it('should handle service errors gracefully', async () => {
      (stockService.getHistoricalData as jest.Mock).mockRejectedValue(new Error('Service Error'));

      const response = await request(app)
        .get('/api/stocks/AAPL/history');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should normalize symbol to uppercase in response', async () => {
      (stockService.getHistoricalData as jest.Mock).mockResolvedValue(mockHistoricalData);

      const response = await request(app)
        .get('/api/stocks/aapl/history');

      expect(response.status).toBe(200);
      expect(response.body.data.symbol).toBe('AAPL');
    });
  });

  describe('GET /api/stocks/:symbol/full-detail', () => {
    const mockFullDetail = {
      profile: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        exchange: 'NASDAQ',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        marketCap: 3000000000000,
        country: 'US',
      },
      quote: {
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
      },
      financials: {
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
      },
      analystRatings: {
        symbol: 'AAPL',
        totalAnalysts: 40,
        strongBuy: 15,
        buy: 12,
        hold: 10,
        sell: 2,
        strongSell: 1,
        averageTargetPrice: 200.00,
        highTargetPrice: 250.00,
        lowTargetPrice: 150.00,
        currentPrice: 175.50,
        upsidePercent: 13.96,
      },
      recentRatings: [
        {
          id: 'rating-1',
          analyst: 'John Doe',
          firm: 'Goldman Sachs',
          rating: 'buy',
          targetPrice: 200.00,
          previousRating: 'hold',
          previousTargetPrice: 180.00,
          ratingDate: new Date('2024-01-10'),
        },
      ],
      insiderSummary: {
        symbol: 'AAPL',
        period: '3M',
        totalBuyShares: 100000,
        totalBuyValue: 17500000,
        totalSellShares: 50000,
        totalSellValue: 8750000,
        netShares: 50000,
        netValue: 8750000,
        buyTransactions: 5,
        sellTransactions: 2,
      },
      recentInsiderTrades: [
        {
          id: 'trade-1',
          symbol: 'AAPL',
          filedAt: new Date('2024-01-12'),
          tradeDate: new Date('2024-01-10'),
          insiderName: 'Tim Cook',
          insiderTitle: 'CEO',
          transactionType: 'sell',
          shares: 50000,
          pricePerShare: 175.00,
          totalValue: 8750000,
          sharesOwned: 3000000,
        },
      ],
    };

    it('should return full detail for valid symbol', async () => {
      (stockService.getStockFullDetail as jest.Mock).mockResolvedValue(mockFullDetail);

      const response = await request(app)
        .get('/api/stocks/AAPL/full-detail');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.profile.symbol).toBe('AAPL');
      expect(response.body.data.quote.price).toBe(175.50);
      expect(response.body.data.financials.pe).toBe(28.5);
      expect(response.body.data.analystRatings.totalAnalysts).toBe(40);
      expect(response.body.data.insiderSummary.netShares).toBe(50000);
      expect(response.body.message).toBe('获取股票完整详情成功');
    });

    it('should return 404 when stock not found', async () => {
      (stockService.getStockFullDetail as jest.Mock).mockResolvedValue({
        profile: null,
        quote: null,
        financials: null,
        analystRatings: null,
        recentRatings: [],
        insiderSummary: null,
        recentInsiderTrades: [],
      });

      const response = await request(app)
        .get('/api/stocks/INVALID/full-detail');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('未找到该股票');
    });

    it('should return validation error for invalid symbol format', async () => {
      const response = await request(app)
        .get('/api/stocks/INVALID@SYMBOL/full-detail');

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should handle service errors gracefully', async () => {
      (stockService.getStockFullDetail as jest.Mock).mockRejectedValue(new Error('Service Error'));

      const response = await request(app)
        .get('/api/stocks/AAPL/full-detail');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/stocks/:symbol/financials', () => {
    const mockFinancials = {
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

    it('should return financial metrics for valid symbol', async () => {
      (stockService.getFinancialMetrics as jest.Mock).mockResolvedValue(mockFinancials);

      const response = await request(app)
        .get('/api/stocks/AAPL/financials');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.symbol).toBe('AAPL');
      expect(response.body.data.metrics.pe).toBe(28.5);
      expect(response.body.data.metrics.eps).toBe(6.15);
      expect(response.body.message).toBe('获取财务数据成功');
    });

    it('should return null metrics with appropriate message when no data', async () => {
      (stockService.getFinancialMetrics as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/stocks/AAPL/financials');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.metrics).toBeNull();
      expect(response.body.message).toBe('暂无财务数据');
    });

    it('should return validation error for invalid symbol format', async () => {
      const response = await request(app)
        .get('/api/stocks/INVALID@SYMBOL/financials');

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should handle service errors gracefully', async () => {
      (stockService.getFinancialMetrics as jest.Mock).mockRejectedValue(new Error('Service Error'));

      const response = await request(app)
        .get('/api/stocks/AAPL/financials');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/stocks/:symbol/analyst-ratings', () => {
    const mockSummary = {
      symbol: 'AAPL',
      totalAnalysts: 40,
      strongBuy: 15,
      buy: 12,
      hold: 10,
      sell: 2,
      strongSell: 1,
      averageTargetPrice: 200.00,
      highTargetPrice: 250.00,
      lowTargetPrice: 150.00,
      currentPrice: 175.50,
      upsidePercent: 13.96,
    };

    const mockRatings = [
      {
        id: 'rating-1',
        analyst: 'John Doe',
        firm: 'Goldman Sachs',
        rating: 'buy',
        targetPrice: 200.00,
        previousRating: 'hold',
        previousTargetPrice: 180.00,
        ratingDate: new Date('2024-01-10'),
      },
    ];

    it('should return analyst ratings for valid symbol', async () => {
      (stockService.getAnalystRatingSummary as jest.Mock).mockResolvedValue(mockSummary);
      (stockService.getRecentAnalystRatings as jest.Mock).mockResolvedValue(mockRatings);

      const response = await request(app)
        .get('/api/stocks/AAPL/analyst-ratings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.totalAnalysts).toBe(40);
      expect(response.body.data.ratings).toHaveLength(1);
      expect(response.body.message).toBe('获取分析师评级成功');
    });

    it('should return null summary with appropriate message when no data', async () => {
      (stockService.getAnalystRatingSummary as jest.Mock).mockResolvedValue(null);
      (stockService.getRecentAnalystRatings as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/stocks/AAPL/analyst-ratings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toBeNull();
      expect(response.body.data.ratings).toHaveLength(0);
      expect(response.body.message).toBe('暂无分析师评级');
    });

    it('should respect limit parameter', async () => {
      (stockService.getAnalystRatingSummary as jest.Mock).mockResolvedValue(mockSummary);
      (stockService.getRecentAnalystRatings as jest.Mock).mockResolvedValue(mockRatings);

      await request(app)
        .get('/api/stocks/AAPL/analyst-ratings')
        .query({ limit: '5' });

      expect(stockService.getRecentAnalystRatings).toHaveBeenCalledWith('AAPL', 5);
    });

    it('should return validation error for invalid symbol format', async () => {
      const response = await request(app)
        .get('/api/stocks/INVALID@SYMBOL/analyst-ratings');

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should handle service errors gracefully', async () => {
      (stockService.getAnalystRatingSummary as jest.Mock).mockRejectedValue(new Error('Service Error'));

      const response = await request(app)
        .get('/api/stocks/AAPL/analyst-ratings');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/stocks/:symbol/insider-trades', () => {
    const mockSummary = {
      symbol: 'AAPL',
      period: '3M',
      totalBuyShares: 100000,
      totalBuyValue: 17500000,
      totalSellShares: 50000,
      totalSellValue: 8750000,
      netShares: 50000,
      netValue: 8750000,
      buyTransactions: 5,
      sellTransactions: 2,
    };

    const mockTrades = [
      {
        id: 'trade-1',
        symbol: 'AAPL',
        filedAt: new Date('2024-01-12'),
        tradeDate: new Date('2024-01-10'),
        insiderName: 'Tim Cook',
        insiderTitle: 'CEO',
        transactionType: 'sell',
        shares: 50000,
        pricePerShare: 175.00,
        totalValue: 8750000,
        sharesOwned: 3000000,
      },
    ];

    it('should return insider trades for valid symbol', async () => {
      (stockService.getInsiderTradeSummary as jest.Mock).mockResolvedValue(mockSummary);
      (stockService.getRecentInsiderTrades as jest.Mock).mockResolvedValue(mockTrades);

      const response = await request(app)
        .get('/api/stocks/AAPL/insider-trades');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.netShares).toBe(50000);
      expect(response.body.data.trades).toHaveLength(1);
      expect(response.body.message).toBe('获取内部交易成功');
    });

    it('should return null summary with appropriate message when no data', async () => {
      (stockService.getInsiderTradeSummary as jest.Mock).mockResolvedValue(null);
      (stockService.getRecentInsiderTrades as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/stocks/AAPL/insider-trades');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toBeNull();
      expect(response.body.data.trades).toHaveLength(0);
      expect(response.body.message).toBe('暂无内部交易记录');
    });

    it('should respect limit and period parameters', async () => {
      (stockService.getInsiderTradeSummary as jest.Mock).mockResolvedValue(mockSummary);
      (stockService.getRecentInsiderTrades as jest.Mock).mockResolvedValue(mockTrades);

      await request(app)
        .get('/api/stocks/AAPL/insider-trades')
        .query({ limit: '5', period: '6M' });

      expect(stockService.getInsiderTradeSummary).toHaveBeenCalledWith('AAPL', '6M');
      expect(stockService.getRecentInsiderTrades).toHaveBeenCalledWith('AAPL', 5);
    });

    it('should return validation error for invalid symbol format', async () => {
      const response = await request(app)
        .get('/api/stocks/INVALID@SYMBOL/insider-trades');

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should return validation error for invalid period format', async () => {
      const response = await request(app)
        .get('/api/stocks/AAPL/insider-trades')
        .query({ period: 'INVALID' });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should handle service errors gracefully', async () => {
      (stockService.getInsiderTradeSummary as jest.Mock).mockRejectedValue(new Error('Service Error'));

      const response = await request(app)
        .get('/api/stocks/AAPL/insider-trades');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});
