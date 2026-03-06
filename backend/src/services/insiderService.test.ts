import { InsiderService, TransactionType } from './insiderService.js';
import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';

// Mock dependencies
jest.mock('../lib/prisma', () => ({
  prisma: {
    insiderTrade: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
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

describe('InsiderService', () => {
  let insiderService: InsiderService;

  beforeEach(() => {
    insiderService = new InsiderService();
    jest.clearAllMocks();
    // Default mock for cache miss
    (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getInsiderTradesBySymbol', () => {
    it('should return insider trades for a given symbol', async () => {
      const mockTrades = [
        {
          id: '1',
          symbol: 'AAPL',
          filedAt: new Date('2024-01-15'),
          tradeDate: new Date('2024-01-10'),
          insiderName: 'Tim Cook',
          insiderTitle: 'CEO',
          transactionType: 'sell',
          shares: BigInt(50000),
          pricePerShare: 185.5,
          totalValue: 9275000,
          sharesOwned: BigInt(1000000),
          createdAt: new Date('2024-01-15'),
          stock: {
            name: 'Apple Inc.',
            sector: 'Technology',
          },
        },
        {
          id: '2',
          symbol: 'AAPL',
          filedAt: new Date('2024-01-10'),
          tradeDate: new Date('2024-01-05'),
          insiderName: 'Luca Maestri',
          insiderTitle: 'CFO',
          transactionType: 'buy',
          shares: BigInt(10000),
          pricePerShare: 180.0,
          totalValue: 1800000,
          sharesOwned: BigInt(500000),
          createdAt: new Date('2024-01-10'),
          stock: {
            name: 'Apple Inc.',
            sector: 'Technology',
          },
        },
      ];

      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(mockTrades);

      const result = await insiderService.getInsiderTradesBySymbol('AAPL', 10);

      expect(result).toHaveLength(2);
      expect(result[0].symbol).toBe('AAPL');
      expect(result[0].insiderName).toBe('Tim Cook');
      expect(result[0].insiderTitle).toBe('CEO');
      expect(result[0].transactionType).toBe('sell');
      expect(result[0].shares).toBe(50000);
      expect(result[0].pricePerShare).toBe(185.5);
      expect(result[0].totalValue).toBe(9275000);
      expect(result[0].stockName).toBe('Apple Inc.');
      expect(result[0].sector).toBe('Technology');
    });

    it('should normalize symbol to uppercase', async () => {
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue([]);

      await insiderService.getInsiderTradesBySymbol('aapl', 10);

      expect(prisma.insiderTrade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { symbol: 'AAPL' },
        })
      );
    });

    it('should return empty array when no trades found', async () => {
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue([]);

      const result = await insiderService.getInsiderTradesBySymbol('UNKNOWN', 10);

      expect(result).toHaveLength(0);
    });
  });

  describe('getInsiderTradesByInsider', () => {
    it('should return insider summary with trade history', async () => {
      const mockTrades = [
        {
          id: '1',
          symbol: 'AAPL',
          filedAt: new Date('2024-01-15'),
          tradeDate: new Date('2024-01-10'),
          insiderName: 'Tim Cook',
          insiderTitle: 'CEO',
          transactionType: 'sell',
          shares: BigInt(50000),
          pricePerShare: 185.5,
          totalValue: 9275000,
          sharesOwned: BigInt(1000000),
          createdAt: new Date('2024-01-15'),
        },
        {
          id: '2',
          symbol: 'AAPL',
          filedAt: new Date('2024-01-05'),
          tradeDate: new Date('2024-01-01'),
          insiderName: 'Tim Cook',
          insiderTitle: 'CEO',
          transactionType: 'buy',
          shares: BigInt(10000),
          pricePerShare: 180.0,
          totalValue: 1800000,
          sharesOwned: BigInt(960000),
          createdAt: new Date('2024-01-05'),
        },
      ];

      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(mockTrades);

      const result = await insiderService.getInsiderTradesByInsider('Tim Cook');

      expect(result.insiderName).toBe('Tim Cook');
      expect(result.insiderTitle).toBe('CEO');
      expect(result.totalTrades).toBe(2);
      expect(result.totalBuyShares).toBe(10000);
      expect(result.totalSellShares).toBe(50000);
      expect(result.totalBuyValue).toBe(1800000);
      expect(result.totalSellValue).toBe(9275000);
      expect(result.trades).toHaveLength(2);
    });

    it('should return empty summary when no trades found', async () => {
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue([]);

      const result = await insiderService.getInsiderTradesByInsider('Unknown Person');

      expect(result.insiderName).toBe('Unknown Person');
      expect(result.totalTrades).toBe(0);
      expect(result.totalBuyShares).toBe(0);
      expect(result.totalSellShares).toBe(0);
      expect(result.trades).toHaveLength(0);
    });
  });

  describe('calculateInsiderTrend', () => {
    it('should calculate correct net buy/sell trend', async () => {
      const mockTrades = [
        {
          id: '1',
          symbol: 'AAPL',
          filedAt: new Date('2024-01-15'),
          tradeDate: new Date('2024-01-10'),
          insiderName: 'Tim Cook',
          insiderTitle: 'CEO',
          transactionType: 'sell',
          shares: BigInt(50000),
          pricePerShare: 185.5,
          totalValue: 9275000,
          sharesOwned: BigInt(1000000),
          createdAt: new Date('2024-01-15'),
        },
        {
          id: '2',
          symbol: 'AAPL',
          filedAt: new Date('2024-01-10'),
          tradeDate: new Date('2024-01-05'),
          insiderName: 'Luca Maestri',
          insiderTitle: 'CFO',
          transactionType: 'buy',
          shares: BigInt(10000),
          pricePerShare: 180.0,
          totalValue: 1800000,
          sharesOwned: BigInt(500000),
          createdAt: new Date('2024-01-10'),
        },
        {
          id: '3',
          symbol: 'AAPL',
          filedAt: new Date('2024-01-08'),
          tradeDate: new Date('2024-01-03'),
          insiderName: 'Jeff Williams',
          insiderTitle: 'COO',
          transactionType: 'exercise',
          shares: BigInt(5000),
          pricePerShare: 175.0,
          totalValue: 875000,
          sharesOwned: BigInt(200000),
          createdAt: new Date('2024-01-08'),
        },
      ];

      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(mockTrades);

      const result = await insiderService.calculateInsiderTrend('AAPL', 90);

      expect(result.symbol).toBe('AAPL');
      expect(result.period).toBe('90 days');
      expect(result.totalBuyShares).toBe(10000);
      expect(result.totalSellShares).toBe(50000);
      expect(result.totalBuyValue).toBe(1800000);
      expect(result.totalSellValue).toBe(9275000);
      expect(result.netShares).toBe(-40000); // 10000 - 50000
      expect(result.netValue).toBe(-7475000); // 1800000 - 9275000
      expect(result.buyTransactions).toBe(1);
      expect(result.sellTransactions).toBe(1);
      expect(result.exerciseTransactions).toBe(1);
    });

    it('should return zero values when no trades found', async () => {
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue([]);

      const result = await insiderService.calculateInsiderTrend('UNKNOWN', 90);

      expect(result.symbol).toBe('UNKNOWN');
      expect(result.totalBuyShares).toBe(0);
      expect(result.totalSellShares).toBe(0);
      expect(result.netShares).toBe(0);
      expect(result.netValue).toBe(0);
    });
  });

  describe('getInsiderTrades with filters', () => {
    it('should filter by transaction type', async () => {
      (prisma.insiderTrade.count as jest.Mock).mockResolvedValue(1);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          symbol: 'AAPL',
          filedAt: new Date('2024-01-15'),
          tradeDate: new Date('2024-01-10'),
          insiderName: 'Tim Cook',
          insiderTitle: 'CEO',
          transactionType: 'buy',
          shares: BigInt(10000),
          pricePerShare: 180.0,
          totalValue: 1800000,
          sharesOwned: BigInt(500000),
          createdAt: new Date('2024-01-15'),
          stock: {
            name: 'Apple Inc.',
            sector: 'Technology',
          },
        },
      ]);

      const result = await insiderService.getInsiderTrades(
        { transactionTypes: ['buy'] },
        undefined,
        { page: 1, limit: 20 }
      );

      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].transactionType).toBe('buy');
    });

    it('should filter by date range', async () => {
      (prisma.insiderTrade.count as jest.Mock).mockResolvedValue(0);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue([]);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await insiderService.getInsiderTrades(
        { startDate, endDate },
        undefined,
        { page: 1, limit: 20 }
      );

      expect(prisma.insiderTrade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tradeDate: {
              gte: startDate,
              lte: endDate,
            },
          }),
        })
      );
    });

    it('should filter by value range', async () => {
      (prisma.insiderTrade.count as jest.Mock).mockResolvedValue(0);
      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue([]);

      await insiderService.getInsiderTrades(
        { minValue: 100000, maxValue: 1000000 },
        undefined,
        { page: 1, limit: 20 }
      );

      expect(prisma.insiderTrade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            totalValue: {
              gte: 100000,
              lte: 1000000,
            },
          }),
        })
      );
    });
  });

  describe('createInsiderTrade', () => {
    it('should create a new insider trade record', async () => {
      const tradeData = {
        symbol: 'AAPL',
        filedAt: new Date('2024-01-15'),
        tradeDate: new Date('2024-01-10'),
        insiderName: 'Tim Cook',
        insiderTitle: 'CEO',
        transactionType: 'sell' as TransactionType,
        shares: 50000,
        pricePerShare: 185.5,
        totalValue: 9275000,
        sharesOwned: 1000000,
      };

      (prisma.insiderTrade.create as jest.Mock).mockResolvedValue({
        id: '1',
        symbol: 'AAPL',
        filedAt: tradeData.filedAt,
        tradeDate: tradeData.tradeDate,
        insiderName: tradeData.insiderName,
        insiderTitle: tradeData.insiderTitle,
        transactionType: tradeData.transactionType,
        shares: BigInt(tradeData.shares),
        pricePerShare: tradeData.pricePerShare,
        totalValue: tradeData.totalValue,
        sharesOwned: BigInt(tradeData.sharesOwned),
        createdAt: new Date(),
      });

      const result = await insiderService.createInsiderTrade(tradeData);

      expect(result.symbol).toBe('AAPL');
      expect(result.insiderName).toBe('Tim Cook');
      expect(result.insiderTitle).toBe('CEO');
      expect(result.transactionType).toBe('sell');
      expect(result.shares).toBe(50000);
      expect(result.pricePerShare).toBe(185.5);
      expect(result.totalValue).toBe(9275000);
    });
  });

  describe('getSignificantInsiderTrades', () => {
    it('should return trades above minimum value threshold', async () => {
      const mockTrades = [
        {
          id: '1',
          symbol: 'AAPL',
          filedAt: new Date('2024-01-15'),
          tradeDate: new Date('2024-01-10'),
          insiderName: 'Tim Cook',
          insiderTitle: 'CEO',
          transactionType: 'sell',
          shares: BigInt(50000),
          pricePerShare: 185.5,
          totalValue: 9275000,
          sharesOwned: BigInt(1000000),
          createdAt: new Date('2024-01-15'),
          stock: {
            name: 'Apple Inc.',
            sector: 'Technology',
          },
        },
      ];

      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue(mockTrades);

      const result = await insiderService.getSignificantInsiderTrades(1000000, 30, 50);

      expect(result).toHaveLength(1);
      expect(result[0].totalValue).toBeGreaterThanOrEqual(1000000);
    });
  });

  describe('data completeness validation', () => {
    /**
     * Validates Property 17: 内部交易数据完整性属性
     * For any insider trade record, it should contain:
     * - trader identity (insiderName)
     * - trader position (insiderTitle)
     * - transaction type
     * - quantity (shares)
     * - price (pricePerShare)
     * - total value
     * 
     * Implements Requirements 12.1, 12.2, 12.4
     */
    it('should return trades with all required fields', async () => {
      const mockTrade = {
        id: '1',
        symbol: 'AAPL',
        filedAt: new Date('2024-01-15'),
        tradeDate: new Date('2024-01-10'),
        insiderName: 'Tim Cook',
        insiderTitle: 'CEO',
        transactionType: 'sell',
        shares: BigInt(50000),
        pricePerShare: 185.5,
        totalValue: 9275000,
        sharesOwned: BigInt(1000000),
        createdAt: new Date('2024-01-15'),
        stock: {
          name: 'Apple Inc.',
          sector: 'Technology',
        },
      };

      (prisma.insiderTrade.findMany as jest.Mock).mockResolvedValue([mockTrade]);

      const result = await insiderService.getInsiderTradesBySymbol('AAPL', 10);

      expect(result).toHaveLength(1);
      const trade = result[0];

      // Verify all required fields are present (Property 17)
      expect(trade.insiderName).toBeDefined();
      expect(trade.insiderName).toBe('Tim Cook');
      
      expect(trade.insiderTitle).toBeDefined();
      expect(trade.insiderTitle).toBe('CEO');
      
      expect(trade.transactionType).toBeDefined();
      expect(['buy', 'sell', 'exercise']).toContain(trade.transactionType);
      
      expect(trade.shares).toBeDefined();
      expect(typeof trade.shares).toBe('number');
      expect(trade.shares).toBeGreaterThan(0);
      
      expect(trade.pricePerShare).toBeDefined();
      expect(typeof trade.pricePerShare).toBe('number');
      expect(trade.pricePerShare).toBeGreaterThan(0);
      
      expect(trade.totalValue).toBeDefined();
      expect(typeof trade.totalValue).toBe('number');
      expect(trade.totalValue).toBeGreaterThan(0);
    });
  });
});
