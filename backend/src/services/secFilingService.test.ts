import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SECFilingService, SECFilingWithStock } from './secFilingService.js';

// Mock Prisma
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    sECFiling: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

// Mock Redis
vi.mock('../lib/redis.js', () => ({
  redisHelpers: {
    getJson: vi.fn(),
    setJson: vi.fn(),
    del: vi.fn(),
  },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';

describe('SECFilingService', () => {
  let service: SECFilingService;

  beforeEach(() => {
    service = new SECFilingService();
    vi.clearAllMocks();
  });

  describe('getSECFilingsBySymbol', () => {
    it('should return SEC filings for a symbol', async () => {
      const mockFilings = [
        {
          id: '1',
          symbol: 'AAPL',
          formType: '10-K',
          filedAt: new Date('2024-01-15'),
          periodOfReport: new Date('2023-12-31'),
          url: 'https://sec.gov/filing1',
          summary: 'Annual financial report',
          createdAt: new Date(),
          stock: { name: 'Apple Inc.', sector: 'Technology' },
        },
        {
          id: '2',
          symbol: 'AAPL',
          formType: '10-Q',
          filedAt: new Date('2024-04-15'),
          periodOfReport: new Date('2024-03-31'),
          url: 'https://sec.gov/filing2',
          summary: null,
          createdAt: new Date(),
          stock: { name: 'Apple Inc.', sector: 'Technology' },
        },
      ];

      vi.mocked(redisHelpers.getJson).mockResolvedValue(null);
      vi.mocked(prisma.sECFiling.findMany).mockResolvedValue(mockFilings as never);

      const result = await service.getSECFilingsBySymbol('AAPL');

      expect(result).toHaveLength(2);
      expect(result[0].symbol).toBe('AAPL');
      expect(result[0].formType).toBe('10-K');
      expect(result[0].stockName).toBe('Apple Inc.');
    });

    it('should return cached filings if available', async () => {
      const cachedFilings: SECFilingWithStock[] = [
        {
          id: '1',
          symbol: 'AAPL',
          formType: '10-K',
          filedAt: new Date('2024-01-15'),
          periodOfReport: new Date('2023-12-31'),
          url: 'https://sec.gov/filing1',
          summary: 'Annual financial report',
          createdAt: new Date(),
          stockName: 'Apple Inc.',
          sector: 'Technology',
        },
      ];

      vi.mocked(redisHelpers.getJson).mockResolvedValue(cachedFilings);

      const result = await service.getSECFilingsBySymbol('AAPL');

      expect(result).toHaveLength(1);
      expect(prisma.sECFiling.findMany).not.toHaveBeenCalled();
    });

    it('should filter by form types', async () => {
      const mockFilings = [
        {
          id: '1',
          symbol: 'AAPL',
          formType: '10-K',
          filedAt: new Date('2024-01-15'),
          periodOfReport: new Date('2023-12-31'),
          url: 'https://sec.gov/filing1',
          summary: null,
          createdAt: new Date(),
          stock: { name: 'Apple Inc.', sector: 'Technology' },
        },
      ];

      vi.mocked(prisma.sECFiling.findMany).mockResolvedValue(mockFilings as never);

      const result = await service.getSECFilingsBySymbol('AAPL', ['10-K']);

      expect(result).toHaveLength(1);
      expect(result[0].formType).toBe('10-K');
    });
  });

  describe('getSECFilings', () => {
    it('should return paginated SEC filings with filters', async () => {
      const mockFilings = [
        {
          id: '1',
          symbol: 'AAPL',
          formType: '10-K',
          filedAt: new Date('2024-01-15'),
          periodOfReport: new Date('2023-12-31'),
          url: 'https://sec.gov/filing1',
          summary: null,
          createdAt: new Date(),
          stock: { name: 'Apple Inc.', sector: 'Technology' },
        },
      ];

      vi.mocked(prisma.sECFiling.count).mockResolvedValue(1);
      vi.mocked(prisma.sECFiling.findMany).mockResolvedValue(mockFilings as never);

      const result = await service.getSECFilings(
        { symbol: 'AAPL', formTypes: ['10-K'] },
        { field: 'filedAt', order: 'desc' },
        { page: 1, limit: 20 }
      );

      expect(result.filings).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by date range', async () => {
      vi.mocked(prisma.sECFiling.count).mockResolvedValue(0);
      vi.mocked(prisma.sECFiling.findMany).mockResolvedValue([]);

      await service.getSECFilings({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      });

      expect(prisma.sECFiling.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            filedAt: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        })
      );
    });
  });

  describe('getSECFilingById', () => {
    it('should return a specific SEC filing', async () => {
      const mockFiling = {
        id: '1',
        symbol: 'AAPL',
        formType: '10-K',
        filedAt: new Date('2024-01-15'),
        periodOfReport: new Date('2023-12-31'),
        url: 'https://sec.gov/filing1',
        summary: 'Annual financial report',
        createdAt: new Date(),
        stock: { name: 'Apple Inc.', sector: 'Technology' },
      };

      vi.mocked(prisma.sECFiling.findUnique).mockResolvedValue(mockFiling as never);

      const result = await service.getSECFilingById('1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('1');
      expect(result?.formType).toBe('10-K');
    });

    it('should return null for non-existent filing', async () => {
      vi.mocked(prisma.sECFiling.findUnique).mockResolvedValue(null);

      const result = await service.getSECFilingById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('createSECFiling', () => {
    it('should create a new SEC filing', async () => {
      const mockFiling = {
        id: '1',
        symbol: 'AAPL',
        formType: '10-K',
        filedAt: new Date('2024-01-15'),
        periodOfReport: new Date('2023-12-31'),
        url: 'https://sec.gov/filing1',
        summary: null,
        createdAt: new Date(),
      };

      vi.mocked(prisma.sECFiling.create).mockResolvedValue(mockFiling as never);
      vi.mocked(redisHelpers.del).mockResolvedValue(undefined);

      const result = await service.createSECFiling({
        symbol: 'AAPL',
        formType: '10-K',
        filedAt: new Date('2024-01-15'),
        periodOfReport: new Date('2023-12-31'),
        url: 'https://sec.gov/filing1',
      });

      expect(result.symbol).toBe('AAPL');
      expect(result.formType).toBe('10-K');
      expect(redisHelpers.del).toHaveBeenCalled();
    });
  });

  describe('updateSECFilingSummary', () => {
    it('should update the summary of a SEC filing', async () => {
      const mockFiling = {
        id: '1',
        symbol: 'AAPL',
        formType: '10-K',
        filedAt: new Date('2024-01-15'),
        periodOfReport: new Date('2023-12-31'),
        url: 'https://sec.gov/filing1',
        summary: 'Updated AI summary',
        createdAt: new Date(),
      };

      vi.mocked(prisma.sECFiling.update).mockResolvedValue(mockFiling as never);
      vi.mocked(redisHelpers.del).mockResolvedValue(undefined);

      const result = await service.updateSECFilingSummary('1', 'Updated AI summary');

      expect(result?.summary).toBe('Updated AI summary');
    });
  });

  describe('getFormTypeDescription', () => {
    it('should return correct description for 10-K', () => {
      const description = service.getFormTypeDescription('10-K');
      expect(description).toContain('年度报告');
    });

    it('should return correct description for 10-Q', () => {
      const description = service.getFormTypeDescription('10-Q');
      expect(description).toContain('季度报告');
    });

    it('should return correct description for 8-K', () => {
      const description = service.getFormTypeDescription('8-K');
      expect(description).toContain('重大事件');
    });
  });

  describe('getRecentSECFilings', () => {
    it('should return recent SEC filings', async () => {
      const mockFilings = [
        {
          id: '1',
          symbol: 'AAPL',
          formType: '10-K',
          filedAt: new Date('2024-01-15'),
          periodOfReport: new Date('2023-12-31'),
          url: 'https://sec.gov/filing1',
          summary: null,
          createdAt: new Date(),
          stock: { name: 'Apple Inc.', sector: 'Technology' },
        },
        {
          id: '2',
          symbol: 'MSFT',
          formType: '8-K',
          filedAt: new Date('2024-01-14'),
          periodOfReport: null,
          url: 'https://sec.gov/filing2',
          summary: null,
          createdAt: new Date(),
          stock: { name: 'Microsoft Corp.', sector: 'Technology' },
        },
      ];

      vi.mocked(redisHelpers.getJson).mockResolvedValue(null);
      vi.mocked(prisma.sECFiling.findMany).mockResolvedValue(mockFilings as never);

      const result = await service.getRecentSECFilings();

      expect(result).toHaveLength(2);
      expect(result[0].symbol).toBe('AAPL');
      expect(result[1].symbol).toBe('MSFT');
    });
  });
});
