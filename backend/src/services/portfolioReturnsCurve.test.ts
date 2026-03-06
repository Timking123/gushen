/**
 * Unit Tests for Portfolio Returns Curve and Benchmark Comparison
 * Feature: smart-stock-analyzer
 * Validates: Requirements 17.6 - 显示收益曲线和与基准指数的对比
 */

import { portfolioCalculationService, ReturnsTimeRange } from './portfolioCalculationService.js';
import { prisma } from '../lib/prisma.js';

// Mock Prisma
jest.mock('../lib/prisma', () => ({
  prisma: {
    portfolioTransaction: {
      findMany: jest.fn(),
    },
    oHLCV: {
      findMany: jest.fn(),
    },
    portfolio: {
      findUnique: jest.fn(),
    },
  },
}));

describe('Portfolio Returns Curve and Benchmark Comparison', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // calculateStartDateFromRange Tests
  // ============================================
  describe('calculateStartDateFromRange', () => {
    it('should calculate correct start date for 1M range', () => {
      const now = new Date();
      const startDate = portfolioCalculationService.calculateStartDateFromRange('1M');
      const expectedDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      
      expect(startDate.getFullYear()).toBe(expectedDate.getFullYear());
      expect(startDate.getMonth()).toBe(expectedDate.getMonth());
      expect(startDate.getDate()).toBe(expectedDate.getDate());
    });

    it('should calculate correct start date for 3M range', () => {
      const now = new Date();
      const startDate = portfolioCalculationService.calculateStartDateFromRange('3M');
      const expectedDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      
      expect(startDate.getFullYear()).toBe(expectedDate.getFullYear());
      expect(startDate.getMonth()).toBe(expectedDate.getMonth());
    });

    it('should calculate correct start date for 6M range', () => {
      const now = new Date();
      const startDate = portfolioCalculationService.calculateStartDateFromRange('6M');
      const expectedDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      
      expect(startDate.getFullYear()).toBe(expectedDate.getFullYear());
      expect(startDate.getMonth()).toBe(expectedDate.getMonth());
    });

    it('should calculate correct start date for 1Y range', () => {
      const now = new Date();
      const startDate = portfolioCalculationService.calculateStartDateFromRange('1Y');
      const expectedDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      
      expect(startDate.getFullYear()).toBe(expectedDate.getFullYear());
      expect(startDate.getMonth()).toBe(expectedDate.getMonth());
    });

    it('should calculate correct start date for 3Y range', () => {
      const now = new Date();
      const startDate = portfolioCalculationService.calculateStartDateFromRange('3Y');
      const expectedDate = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
      
      expect(startDate.getFullYear()).toBe(expectedDate.getFullYear());
    });

    it('should calculate correct start date for 5Y range', () => {
      const now = new Date();
      const startDate = portfolioCalculationService.calculateStartDateFromRange('5Y');
      const expectedDate = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      
      expect(startDate.getFullYear()).toBe(expectedDate.getFullYear());
    });

    it('should return epoch for MAX range', () => {
      const startDate = portfolioCalculationService.calculateStartDateFromRange('MAX');
      expect(startDate.getFullYear()).toBe(1970);
      expect(startDate.getMonth()).toBe(0);
      expect(startDate.getDate()).toBe(1);
    });
  });

  // ============================================
  // calculatePortfolioValueAtDate Tests
  // ============================================
  describe('calculatePortfolioValueAtDate', () => {
    it('should calculate portfolio value correctly', () => {
      const holdings = new Map([
        ['AAPL', { symbol: 'AAPL', shares: 100, avgCostBasis: 150 }],
        ['GOOGL', { symbol: 'GOOGL', shares: 50, avgCostBasis: 2800 }],
      ]);
      const priceMap = new Map([
        ['AAPL', 175],
        ['GOOGL', 2900],
      ]);

      const value = portfolioCalculationService.calculatePortfolioValueAtDate(holdings, priceMap);
      
      // AAPL: 100 * 175 = 17500
      // GOOGL: 50 * 2900 = 145000
      // Total: 162500
      expect(value).toBe(162500);
    });

    it('should return 0 for empty holdings', () => {
      const holdings = new Map();
      const priceMap = new Map([['AAPL', 175]]);

      const value = portfolioCalculationService.calculatePortfolioValueAtDate(holdings, priceMap);
      expect(value).toBe(0);
    });

    it('should skip holdings without price data', () => {
      const holdings = new Map([
        ['AAPL', { symbol: 'AAPL', shares: 100, avgCostBasis: 150 }],
        ['UNKNOWN', { symbol: 'UNKNOWN', shares: 50, avgCostBasis: 100 }],
      ]);
      const priceMap = new Map([['AAPL', 175]]);

      const value = portfolioCalculationService.calculatePortfolioValueAtDate(holdings, priceMap);
      expect(value).toBe(17500); // Only AAPL counted
    });
  });

  // ============================================
  // calculateTotalInvestedAtDate Tests
  // ============================================
  describe('calculateTotalInvestedAtDate', () => {
    it('should calculate total invested correctly', () => {
      const holdings = new Map([
        ['AAPL', { symbol: 'AAPL', shares: 100, avgCostBasis: 150 }],
        ['GOOGL', { symbol: 'GOOGL', shares: 50, avgCostBasis: 2800 }],
      ]);

      const totalInvested = portfolioCalculationService.calculateTotalInvestedAtDate(holdings);
      
      // AAPL: 100 * 150 = 15000
      // GOOGL: 50 * 2800 = 140000
      // Total: 155000
      expect(totalInvested).toBe(155000);
    });

    it('should return 0 for empty holdings', () => {
      const holdings = new Map();
      const totalInvested = portfolioCalculationService.calculateTotalInvestedAtDate(holdings);
      expect(totalInvested).toBe(0);
    });
  });

  // ============================================
  // getHoldingsSnapshotAtDate Tests
  // ============================================
  describe('getHoldingsSnapshotAtDate', () => {
    it('should reconstruct holdings from buy transactions', async () => {
      const portfolioId = 'portfolio-123';
      const asOfDate = new Date('2024-06-01');

      (prisma.portfolioTransaction.findMany as jest.Mock).mockResolvedValue([
        {
          symbol: 'AAPL',
          type: 'buy',
          shares: 100,
          pricePerShare: 150,
          transactionDate: new Date('2024-01-15'),
        },
        {
          symbol: 'GOOGL',
          type: 'buy',
          shares: 50,
          pricePerShare: 2800,
          transactionDate: new Date('2024-02-20'),
        },
      ]);

      const holdings = await portfolioCalculationService.getHoldingsSnapshotAtDate(
        portfolioId,
        asOfDate
      );

      expect(holdings.size).toBe(2);
      expect(holdings.get('AAPL')).toEqual({
        symbol: 'AAPL',
        shares: 100,
        avgCostBasis: 150,
      });
      expect(holdings.get('GOOGL')).toEqual({
        symbol: 'GOOGL',
        shares: 50,
        avgCostBasis: 2800,
      });
    });

    it('should calculate weighted average cost basis for multiple buys', async () => {
      const portfolioId = 'portfolio-123';
      const asOfDate = new Date('2024-06-01');

      (prisma.portfolioTransaction.findMany as jest.Mock).mockResolvedValue([
        {
          symbol: 'AAPL',
          type: 'buy',
          shares: 100,
          pricePerShare: 150,
          transactionDate: new Date('2024-01-15'),
        },
        {
          symbol: 'AAPL',
          type: 'buy',
          shares: 100,
          pricePerShare: 170,
          transactionDate: new Date('2024-03-20'),
        },
      ]);

      const holdings = await portfolioCalculationService.getHoldingsSnapshotAtDate(
        portfolioId,
        asOfDate
      );

      expect(holdings.size).toBe(1);
      const aaplHolding = holdings.get('AAPL');
      expect(aaplHolding?.shares).toBe(200);
      // Weighted avg: (100 * 150 + 100 * 170) / 200 = 160
      expect(aaplHolding?.avgCostBasis).toBe(160);
    });

    it('should reduce shares on sell transactions', async () => {
      const portfolioId = 'portfolio-123';
      const asOfDate = new Date('2024-06-01');

      (prisma.portfolioTransaction.findMany as jest.Mock).mockResolvedValue([
        {
          symbol: 'AAPL',
          type: 'buy',
          shares: 100,
          pricePerShare: 150,
          transactionDate: new Date('2024-01-15'),
        },
        {
          symbol: 'AAPL',
          type: 'sell',
          shares: 30,
          pricePerShare: 175,
          transactionDate: new Date('2024-03-20'),
        },
      ]);

      const holdings = await portfolioCalculationService.getHoldingsSnapshotAtDate(
        portfolioId,
        asOfDate
      );

      expect(holdings.size).toBe(1);
      expect(holdings.get('AAPL')?.shares).toBe(70);
    });

    it('should remove holding when all shares are sold', async () => {
      const portfolioId = 'portfolio-123';
      const asOfDate = new Date('2024-06-01');

      (prisma.portfolioTransaction.findMany as jest.Mock).mockResolvedValue([
        {
          symbol: 'AAPL',
          type: 'buy',
          shares: 100,
          pricePerShare: 150,
          transactionDate: new Date('2024-01-15'),
        },
        {
          symbol: 'AAPL',
          type: 'sell',
          shares: 100,
          pricePerShare: 175,
          transactionDate: new Date('2024-03-20'),
        },
      ]);

      const holdings = await portfolioCalculationService.getHoldingsSnapshotAtDate(
        portfolioId,
        asOfDate
      );

      expect(holdings.size).toBe(0);
      expect(holdings.has('AAPL')).toBe(false);
    });

    it('should ignore dividend transactions for holdings', async () => {
      const portfolioId = 'portfolio-123';
      const asOfDate = new Date('2024-06-01');

      (prisma.portfolioTransaction.findMany as jest.Mock).mockResolvedValue([
        {
          symbol: 'AAPL',
          type: 'buy',
          shares: 100,
          pricePerShare: 150,
          transactionDate: new Date('2024-01-15'),
        },
        {
          symbol: 'AAPL',
          type: 'dividend',
          shares: 100,
          pricePerShare: 0.5,
          transactionDate: new Date('2024-03-20'),
        },
      ]);

      const holdings = await portfolioCalculationService.getHoldingsSnapshotAtDate(
        portfolioId,
        asOfDate
      );

      expect(holdings.size).toBe(1);
      expect(holdings.get('AAPL')?.shares).toBe(100); // Unchanged by dividend
    });

    it('should return empty map for no transactions', async () => {
      const portfolioId = 'portfolio-123';
      const asOfDate = new Date('2024-06-01');

      (prisma.portfolioTransaction.findMany as jest.Mock).mockResolvedValue([]);

      const holdings = await portfolioCalculationService.getHoldingsSnapshotAtDate(
        portfolioId,
        asOfDate
      );

      expect(holdings.size).toBe(0);
    });
  });

  // ============================================
  // calculateReturnsCurve Tests
  // ============================================
  describe('calculateReturnsCurve', () => {
    it('should return null for portfolio with no transactions', async () => {
      const portfolioId = 'portfolio-123';

      (prisma.portfolioTransaction.findMany as jest.Mock).mockResolvedValue([]);

      const result = await portfolioCalculationService.calculateReturnsCurve(portfolioId, '1Y');

      expect(result).toBeNull();
    });

    it('should return null when no price data available', async () => {
      const portfolioId = 'portfolio-123';

      (prisma.portfolioTransaction.findMany as jest.Mock).mockResolvedValue([
        {
          symbol: 'AAPL',
          type: 'buy',
          shares: 100,
          pricePerShare: 150,
          transactionDate: new Date('2024-01-15'),
        },
      ]);

      (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue([]);

      const result = await portfolioCalculationService.calculateReturnsCurve(portfolioId, '1Y');

      expect(result).toBeNull();
    });

    it('should calculate returns curve with valid data', async () => {
      const portfolioId = 'portfolio-123';
      const baseDate = new Date('2024-01-15');

      (prisma.portfolioTransaction.findMany as jest.Mock).mockResolvedValue([
        {
          symbol: 'AAPL',
          type: 'buy',
          shares: 100,
          pricePerShare: 150,
          transactionDate: baseDate,
        },
      ]);

      // Mock price data for multiple days
      const priceData = [
        { symbol: 'AAPL', timestamp: new Date('2024-01-15'), close: 150 },
        { symbol: 'AAPL', timestamp: new Date('2024-01-16'), close: 155 },
        { symbol: 'AAPL', timestamp: new Date('2024-01-17'), close: 160 },
      ];

      (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue(priceData);

      const result = await portfolioCalculationService.calculateReturnsCurve(portfolioId, '1Y');

      expect(result).not.toBeNull();
      expect(result?.portfolioId).toBe(portfolioId);
      expect(result?.dataPoints.length).toBeGreaterThan(0);
      expect(result?.totalReturn).toBeDefined();
      expect(result?.annualizedReturn).toBeDefined();
      expect(result?.maxDrawdown).toBeDefined();
    });

    it('should calculate correct cumulative returns', async () => {
      const portfolioId = 'portfolio-123';

      (prisma.portfolioTransaction.findMany as jest.Mock).mockResolvedValue([
        {
          symbol: 'AAPL',
          type: 'buy',
          shares: 100,
          pricePerShare: 100,
          transactionDate: new Date('2024-01-01'),
        },
      ]);

      const priceData = [
        { symbol: 'AAPL', timestamp: new Date('2024-01-01'), close: 100 },
        { symbol: 'AAPL', timestamp: new Date('2024-01-02'), close: 110 }, // 10% gain
        { symbol: 'AAPL', timestamp: new Date('2024-01-03'), close: 120 }, // 20% gain from start
      ];

      (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue(priceData);

      const result = await portfolioCalculationService.calculateReturnsCurve(portfolioId, '1Y');

      expect(result).not.toBeNull();
      expect(result?.dataPoints.length).toBe(3);
      
      // First point should have 0 cumulative return
      expect(result?.dataPoints[0].cumulativeReturn).toBe(0);
      
      // Second point should have ~10% cumulative return
      expect(result?.dataPoints[1].cumulativeReturn).toBeCloseTo(10, 1);
      
      // Third point should have ~20% cumulative return
      expect(result?.dataPoints[2].cumulativeReturn).toBeCloseTo(20, 1);
    });

    it('should calculate max drawdown correctly', async () => {
      const portfolioId = 'portfolio-123';

      (prisma.portfolioTransaction.findMany as jest.Mock).mockResolvedValue([
        {
          symbol: 'AAPL',
          type: 'buy',
          shares: 100,
          pricePerShare: 100,
          transactionDate: new Date('2024-01-01'),
        },
      ]);

      const priceData = [
        { symbol: 'AAPL', timestamp: new Date('2024-01-01'), close: 100 },
        { symbol: 'AAPL', timestamp: new Date('2024-01-02'), close: 120 }, // Peak
        { symbol: 'AAPL', timestamp: new Date('2024-01-03'), close: 96 },  // 20% drawdown from peak
        { symbol: 'AAPL', timestamp: new Date('2024-01-04'), close: 110 }, // Recovery
      ];

      (prisma.oHLCV.findMany as jest.Mock).mockResolvedValue(priceData);

      const result = await portfolioCalculationService.calculateReturnsCurve(portfolioId, '1Y');

      expect(result).not.toBeNull();
      // Max drawdown should be 20% (from 120 to 96)
      expect(result?.maxDrawdown).toBeCloseTo(20, 1);
    });
  });

  // ============================================
  // calculateBenchmarkComparison Tests
  // ============================================
  describe('calculateBenchmarkComparison', () => {
    it('should return null when portfolio has no data', async () => {
      const portfolioId = 'portfolio-123';

      (prisma.portfolioTransaction.findMany as jest.Mock).mockResolvedValue([]);

      const result = await portfolioCalculationService.calculateBenchmarkComparison(
        portfolioId,
        'SPY',
        '1Y'
      );

      expect(result).toBeNull();
    });

    it('should return null when benchmark has insufficient data', async () => {
      const portfolioId = 'portfolio-123';

      (prisma.portfolioTransaction.findMany as jest.Mock).mockResolvedValue([
        {
          symbol: 'AAPL',
          type: 'buy',
          shares: 100,
          pricePerShare: 150,
          transactionDate: new Date('2024-01-15'),
        },
      ]);

      // Portfolio price data
      (prisma.oHLCV.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { symbol: 'AAPL', timestamp: new Date('2024-01-15'), close: 150 },
          { symbol: 'AAPL', timestamp: new Date('2024-01-16'), close: 155 },
        ])
        // Benchmark data - only 1 point (insufficient)
        .mockResolvedValueOnce([
          { symbol: 'SPY', timestamp: new Date('2024-01-15'), close: 450 },
        ]);

      const result = await portfolioCalculationService.calculateBenchmarkComparison(
        portfolioId,
        'SPY',
        '1Y'
      );

      expect(result).toBeNull();
    });

    it('should calculate benchmark comparison with valid data', async () => {
      const portfolioId = 'portfolio-123';

      (prisma.portfolioTransaction.findMany as jest.Mock).mockResolvedValue([
        {
          symbol: 'AAPL',
          type: 'buy',
          shares: 100,
          pricePerShare: 100,
          transactionDate: new Date('2024-01-01'),
        },
      ]);

      // First call for portfolio symbols
      (prisma.oHLCV.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { symbol: 'AAPL', timestamp: new Date('2024-01-01'), close: 100 },
          { symbol: 'AAPL', timestamp: new Date('2024-01-02'), close: 110 },
          { symbol: 'AAPL', timestamp: new Date('2024-01-03'), close: 120 },
        ])
        // Second call for benchmark
        .mockResolvedValueOnce([
          { symbol: 'SPY', timestamp: new Date('2024-01-01'), close: 450 },
          { symbol: 'SPY', timestamp: new Date('2024-01-02'), close: 455 },
          { symbol: 'SPY', timestamp: new Date('2024-01-03'), close: 460 },
        ]);

      const result = await portfolioCalculationService.calculateBenchmarkComparison(
        portfolioId,
        'SPY',
        '1Y'
      );

      expect(result).not.toBeNull();
      expect(result?.portfolioId).toBe(portfolioId);
      expect(result?.benchmarkSymbol).toBe('SPY');
      expect(result?.portfolioTotalReturn).toBeDefined();
      expect(result?.benchmarkTotalReturn).toBeDefined();
      expect(result?.alpha).toBeDefined();
      expect(result?.dataPoints.length).toBeGreaterThan(0);
    });

    it('should calculate alpha correctly', async () => {
      const portfolioId = 'portfolio-123';

      (prisma.portfolioTransaction.findMany as jest.Mock).mockResolvedValue([
        {
          symbol: 'AAPL',
          type: 'buy',
          shares: 100,
          pricePerShare: 100,
          transactionDate: new Date('2024-01-01'),
        },
      ]);

      // Portfolio gains 20%
      (prisma.oHLCV.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { symbol: 'AAPL', timestamp: new Date('2024-01-01'), close: 100 },
          { symbol: 'AAPL', timestamp: new Date('2024-01-02'), close: 120 },
        ])
        // Benchmark gains 10%
        .mockResolvedValueOnce([
          { symbol: 'SPY', timestamp: new Date('2024-01-01'), close: 100 },
          { symbol: 'SPY', timestamp: new Date('2024-01-02'), close: 110 },
        ]);

      const result = await portfolioCalculationService.calculateBenchmarkComparison(
        portfolioId,
        'SPY',
        '1Y'
      );

      expect(result).not.toBeNull();
      // Alpha should be portfolio return - benchmark return = 20% - 10% = 10%
      expect(result?.alpha).toBeCloseTo(10, 1);
    });
  });

  // ============================================
  // getAvailableBenchmarks Tests
  // ============================================
  describe('getAvailableBenchmarks', () => {
    it('should return list of available benchmarks', () => {
      const benchmarks = portfolioCalculationService.getAvailableBenchmarks();

      expect(benchmarks).toBeInstanceOf(Array);
      expect(benchmarks.length).toBeGreaterThan(0);
      
      // Check that SPY is included
      const spy = benchmarks.find(b => b.symbol === 'SPY');
      expect(spy).toBeDefined();
      expect(spy?.name).toBe('S&P 500');
    });

    it('should include required benchmark properties', () => {
      const benchmarks = portfolioCalculationService.getAvailableBenchmarks();

      for (const benchmark of benchmarks) {
        expect(benchmark).toHaveProperty('symbol');
        expect(benchmark).toHaveProperty('name');
        expect(benchmark).toHaveProperty('description');
        expect(typeof benchmark.symbol).toBe('string');
        expect(typeof benchmark.name).toBe('string');
        expect(typeof benchmark.description).toBe('string');
      }
    });

    it('should include common benchmark indices', () => {
      const benchmarks = portfolioCalculationService.getAvailableBenchmarks();
      const symbols = benchmarks.map(b => b.symbol);

      expect(symbols).toContain('SPY');  // S&P 500
      expect(symbols).toContain('QQQ');  // NASDAQ 100
      expect(symbols).toContain('DIA');  // Dow Jones
    });
  });
});
