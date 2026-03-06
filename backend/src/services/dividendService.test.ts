import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    stock: {
      findUnique: vi.fn(),
    },
    dividendEvent: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    portfolio: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock Redis
vi.mock('../lib/redis.js', () => ({
  redisHelpers: {
    getJson: vi.fn().mockResolvedValue(null),
    setJson: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { prisma } from '../lib/prisma.js';
import { DividendService } from './dividendService.js';

describe('DividendService', () => {
  let service: DividendService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DividendService();
  });

  describe('getDividendSummary', () => {
    it('should return null for non-existent stock', async () => {
      vi.mocked(prisma.stock.findUnique).mockResolvedValue(null);

      const result = await service.getDividendSummary('INVALID');

      expect(result).toBeNull();
    });

    it('should return summary with no dividends', async () => {
      vi.mocked(prisma.stock.findUnique).mockResolvedValue({
        symbol: 'AAPL',
        name: 'Apple Inc.',
        exchange: 'NASDAQ',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        marketCap: BigInt(3000000000000),
        country: 'US',
        createdAt: new Date(),
        updatedAt: new Date(),
        fundamentalMetrics: {
          id: '1',
          symbol: 'AAPL',
          dividendYield: 0.5,
          payoutRatio: 15,
          pe: 30,
          forwardPe: 28,
          peg: 2.5,
          ps: 8,
          pb: 45,
          eps: 6.5,
          epsGrowth: 10,
          revenue: BigInt(400000000000),
          revenueGrowth: 8,
          grossMargin: 43,
          operatingMargin: 30,
          netMargin: 25,
          roe: 150,
          roa: 28,
          debtToEquity: 180,
          currentRatio: 1.0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as any);

      vi.mocked(prisma.dividendEvent.findMany).mockResolvedValue([]);

      const result = await service.getDividendSummary('AAPL');

      expect(result).not.toBeNull();
      expect(result?.symbol).toBe('AAPL');
      expect(result?.stockName).toBe('Apple Inc.');
      expect(result?.currentYield).toBe(0.5);
      expect(result?.consecutiveYears).toBe(0);
    });

    it('should calculate annual dividend from history', async () => {
      const now = new Date();
      const quarterlyDividends = [
        { id: '1', symbol: 'AAPL', exDate: new Date(now.getFullYear(), now.getMonth() - 1, 1), payDate: new Date(now.getFullYear(), now.getMonth() - 1, 15), recordDate: new Date(now.getFullYear(), now.getMonth() - 1, 5), amount: 0.24, frequency: 'quarterly', yield: 0.5, createdAt: new Date() },
        { id: '2', symbol: 'AAPL', exDate: new Date(now.getFullYear(), now.getMonth() - 4, 1), payDate: new Date(now.getFullYear(), now.getMonth() - 4, 15), recordDate: new Date(now.getFullYear(), now.getMonth() - 4, 5), amount: 0.24, frequency: 'quarterly', yield: 0.5, createdAt: new Date() },
        { id: '3', symbol: 'AAPL', exDate: new Date(now.getFullYear(), now.getMonth() - 7, 1), payDate: new Date(now.getFullYear(), now.getMonth() - 7, 15), recordDate: new Date(now.getFullYear(), now.getMonth() - 7, 5), amount: 0.23, frequency: 'quarterly', yield: 0.5, createdAt: new Date() },
        { id: '4', symbol: 'AAPL', exDate: new Date(now.getFullYear(), now.getMonth() - 10, 1), payDate: new Date(now.getFullYear(), now.getMonth() - 10, 15), recordDate: new Date(now.getFullYear(), now.getMonth() - 10, 5), amount: 0.23, frequency: 'quarterly', yield: 0.5, createdAt: new Date() },
      ];

      vi.mocked(prisma.stock.findUnique).mockResolvedValue({
        symbol: 'AAPL',
        name: 'Apple Inc.',
        exchange: 'NASDAQ',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        marketCap: BigInt(3000000000000),
        country: 'US',
        createdAt: new Date(),
        updatedAt: new Date(),
        fundamentalMetrics: {
          dividendYield: 0.5,
          payoutRatio: 15,
        },
      } as any);

      vi.mocked(prisma.dividendEvent.findMany).mockResolvedValue(quarterlyDividends);

      const result = await service.getDividendSummary('AAPL');

      expect(result).not.toBeNull();
      expect(result?.annualDividend).toBeCloseTo(0.94, 2);
      expect(result?.frequency).toBe('quarterly');
    });
  });

  describe('getDividendHistory', () => {
    it('should return dividend history for a stock', async () => {
      const mockDividends = [
        { id: '1', symbol: 'AAPL', exDate: new Date('2024-02-09'), payDate: new Date('2024-02-15'), recordDate: new Date('2024-02-12'), amount: 0.24, frequency: 'quarterly', yield: 0.5, createdAt: new Date() },
        { id: '2', symbol: 'AAPL', exDate: new Date('2023-11-10'), payDate: new Date('2023-11-16'), recordDate: new Date('2023-11-13'), amount: 0.24, frequency: 'quarterly', yield: 0.5, createdAt: new Date() },
      ];

      vi.mocked(prisma.dividendEvent.findMany).mockResolvedValue(mockDividends);

      const result = await service.getDividendHistory('AAPL', 10);

      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(0.24);
    });
  });

  describe('getDividendCalendar', () => {
    it('should return paginated dividend calendar', async () => {
      vi.mocked(prisma.dividendEvent.count).mockResolvedValue(2);
      vi.mocked(prisma.dividendEvent.findMany).mockResolvedValue([
        { id: '1', symbol: 'AAPL', exDate: new Date('2024-02-09'), payDate: new Date('2024-02-15'), recordDate: new Date('2024-02-12'), amount: 0.24, frequency: 'quarterly', yield: 0.5, createdAt: new Date(), stock: { name: 'Apple Inc.' } },
        { id: '2', symbol: 'MSFT', exDate: new Date('2024-02-14'), payDate: new Date('2024-03-14'), recordDate: new Date('2024-02-15'), amount: 0.75, frequency: 'quarterly', yield: 0.7, createdAt: new Date(), stock: { name: 'Microsoft Corporation' } },
      ] as any);

      const result = await service.getDividendCalendar(undefined, { page: 1, limit: 10 });

      expect(result.events).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });
  });

  describe('calculatePortfolioDividendIncome', () => {
    it('should return null for non-existent portfolio', async () => {
      vi.mocked(prisma.portfolio.findUnique).mockResolvedValue(null);

      const result = await service.calculatePortfolioDividendIncome('invalid-id');

      expect(result).toBeNull();
    });

    it('should calculate total annual dividend income', async () => {
      vi.mocked(prisma.portfolio.findUnique).mockResolvedValue({
        id: 'portfolio-1',
        userId: 'user-1',
        name: 'My Portfolio',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        holdings: [
          {
            id: 'holding-1',
            portfolioId: 'portfolio-1',
            symbol: 'AAPL',
            shares: 100,
            avgCostBasis: 150,
            addedAt: new Date(),
            updatedAt: new Date(),
            stock: {
              symbol: 'AAPL',
              name: 'Apple Inc.',
              fundamentalMetrics: {
                dividendYield: 0.5,
              },
            },
          },
          {
            id: 'holding-2',
            portfolioId: 'portfolio-1',
            symbol: 'MSFT',
            shares: 50,
            avgCostBasis: 300,
            addedAt: new Date(),
            updatedAt: new Date(),
            stock: {
              symbol: 'MSFT',
              name: 'Microsoft Corporation',
              fundamentalMetrics: {
                dividendYield: 0.7,
              },
            },
          },
        ],
      } as any);

      // Mock getDividendSummary calls
      vi.mocked(prisma.stock.findUnique)
        .mockResolvedValueOnce({
          symbol: 'AAPL',
          name: 'Apple Inc.',
          fundamentalMetrics: { dividendYield: 0.5 },
        } as any)
        .mockResolvedValueOnce({
          symbol: 'MSFT',
          name: 'Microsoft Corporation',
          fundamentalMetrics: { dividendYield: 0.7 },
        } as any);

      vi.mocked(prisma.dividendEvent.findMany)
        .mockResolvedValueOnce([]) // AAPL dividends
        .mockResolvedValueOnce([]); // MSFT dividends

      const result = await service.calculatePortfolioDividendIncome('portfolio-1');

      expect(result).not.toBeNull();
      expect(result?.portfolioId).toBe('portfolio-1');
      expect(result?.holdings).toHaveLength(2);
    });
  });
});
