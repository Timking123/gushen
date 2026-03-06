// @ts-nocheck
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ScreenerService } from './screenerService.js';
import { prisma } from '../lib/prisma.js';
import type { ScreenerFilters } from './screenerService.js';

// Mock Prisma
jest.mock('../lib/prisma', () => ({
  prisma: {
    stock: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    screenerTemplate: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

// Mock Redis
jest.mock('../lib/redis.js', () => ({
  redisHelpers: {
    getJson: jest.fn().mockResolvedValue(null),
    setJson: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  },
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('ScreenerService', () => {
  let screenerService: ScreenerService;
  const testUserId = 'test-user-id';

  beforeEach(() => {
    screenerService = new ScreenerService();
    jest.clearAllMocks();
  });

  describe('screen', () => {
    it('should return empty results when no stocks match filters', async () => {
      const filters: ScreenerFilters = {
        exchange: ['NONEXISTENT'],
        page: 1,
        limit: 10,
      };

      // @ts-ignore - Mock implementation
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([]);
      // @ts-ignore - Mock implementation
      (prisma.stock.count as jest.Mock).mockResolvedValue(0);

      const result = await screenerService.screen(filters);

      expect(result.stocks).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should filter by exchange', async () => {
      const mockStocks = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          exchange: 'NASDAQ',
          sector: 'Technology',
          industry: 'Consumer Electronics',
          marketCap: BigInt(3000000000000),
          country: 'US',
          fundamentalMetrics: null,
          technicalIndicators: null,
          quotes: [],
        },
      ];

      // @ts-ignore - Mock implementation
      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStocks);
      // @ts-ignore - Mock implementation
      (prisma.stock.count as jest.Mock).mockResolvedValue(1);

      const filters: ScreenerFilters = {
        exchange: ['NASDAQ'],
        page: 1,
        limit: 50,
      };

      const result = await screenerService.screen(filters);

      expect(result.stocks.length).toBe(1);
      expect(result.stocks[0].exchange).toBe('NASDAQ');
    });

    it('should apply pagination correctly', async () => {
      const mockStocks = Array.from({ length: 5 }, (_, i) => ({
        symbol: `STOCK${i}`,
        name: `Stock ${i}`,
        exchange: 'NYSE',
        sector: 'Technology',
        industry: 'Software',
        marketCap: BigInt(1000000000),
        country: 'US',
        fundamentalMetrics: null,
        technicalIndicators: null,
        quotes: [],
      }));

      // @ts-ignore - Mock implementation
      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStocks);
      // @ts-ignore - Mock implementation
      (prisma.stock.count as jest.Mock).mockResolvedValue(10);

      const result = await screenerService.screen({
        page: 1,
        limit: 5,
      });

      expect(result.stocks.length).toBe(5);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(5);
      expect(result.pagination.total).toBe(10);
      expect(result.pagination.totalPages).toBe(2);
    });

    it('should cap limit at 100', async () => {
      // @ts-ignore - Mock implementation
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([]);
      // @ts-ignore - Mock implementation
      (prisma.stock.count as jest.Mock).mockResolvedValue(0);

      const result = await screenerService.screen({
        page: 1,
        limit: 200, // Request more than max
      });

      expect(result.pagination.limit).toBe(100);
    });

    it('should filter by price above SMA20', async () => {
      const mockStocks = [
        {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          exchange: 'NASDAQ',
          sector: 'Technology',
          industry: 'Consumer Electronics',
          marketCap: BigInt(3000000000000),
          country: 'US',
          fundamentalMetrics: null,
          technicalIndicators: { sma20: 150 },
          quotes: [{ price: 160, volume: BigInt(1000000), changePercent: 1.5, avgVolume: BigInt(900000) }],
        },
      ];

      // @ts-ignore - Mock implementation
      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStocks);
      // @ts-ignore - Mock implementation
      (prisma.stock.count as jest.Mock).mockResolvedValue(1);

      const result = await screenerService.screen({
        priceAboveSma20: true,
        page: 1,
        limit: 10,
      });

      expect(result.stocks.length).toBe(1);
      expect(result.stocks[0].price).toBeGreaterThan(result.stocks[0].sma20!);
    });
  });

  describe('saveTemplate', () => {
    it('should save a screener template', async () => {
      const filters: ScreenerFilters = {
        exchange: ['NASDAQ'],
        sector: ['Technology'],
        peMin: 10,
        peMax: 30,
      };

      const mockTemplate = {
        id: 'template-123',
        userId: testUserId,
        name: 'Tech Stocks',
        description: 'NASDAQ tech stocks with reasonable P/E',
        filters: filters as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.screenerTemplate.create as jest.Mock).mockResolvedValue(mockTemplate);

      const template = await screenerService.saveTemplate(testUserId, {
        name: 'Tech Stocks',
        description: 'NASDAQ tech stocks with reasonable P/E',
        filters,
      });

      expect(template.id).toBe('template-123');
      expect(template.userId).toBe(testUserId);
      expect(template.name).toBe('Tech Stocks');
      expect(template.description).toBe('NASDAQ tech stocks with reasonable P/E');
      expect(template.filters).toEqual(filters);
    });

    it('should save template without description', async () => {
      const filters: ScreenerFilters = {
        marketCapMin: 1000000000,
      };

      const mockTemplate = {
        id: 'template-456',
        userId: testUserId,
        name: 'Large Cap',
        description: null,
        filters: filters as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.screenerTemplate.create as jest.Mock).mockResolvedValue(mockTemplate);

      const template = await screenerService.saveTemplate(testUserId, {
        name: 'Large Cap',
        filters,
      });

      expect(template.description).toBeNull();
      expect(template.filters).toEqual(filters);
    });
  });

  describe('getTemplates', () => {
    it('should return empty array when user has no templates', async () => {
      (prisma.screenerTemplate.findMany as jest.Mock).mockResolvedValue([]);

      const templates = await screenerService.getTemplates(testUserId);
      expect(templates).toEqual([]);
    });

    it('should return all templates for a user', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          userId: testUserId,
          name: 'Template 1',
          description: null,
          filters: { exchange: ['NYSE'] },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'template-2',
          userId: testUserId,
          name: 'Template 2',
          description: null,
          filters: { sector: ['Healthcare'] },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.screenerTemplate.findMany as jest.Mock).mockResolvedValue(mockTemplates);

      const templates = await screenerService.getTemplates(testUserId);

      expect(templates.length).toBe(2);
      expect(templates.map(t => t.name)).toContain('Template 1');
      expect(templates.map(t => t.name)).toContain('Template 2');
    });
  });

  describe('getTemplate', () => {
    it('should return a specific template', async () => {
      const mockTemplate = {
        id: 'template-123',
        userId: testUserId,
        name: 'Test Template',
        description: null,
        filters: { exchange: ['NASDAQ'] },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.screenerTemplate.findFirst as jest.Mock).mockResolvedValue(mockTemplate);

      const retrieved = await screenerService.getTemplate(testUserId, 'template-123');

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('template-123');
      expect(retrieved!.name).toBe('Test Template');
    });

    it('should return null for non-existent template', async () => {
      (prisma.screenerTemplate.findFirst as jest.Mock).mockResolvedValue(null);

      const template = await screenerService.getTemplate(testUserId, 'non-existent-id');
      expect(template).toBeNull();
    });
  });

  describe('updateTemplate', () => {
    it('should update template name', async () => {
      const existingTemplate = {
        id: 'template-123',
        userId: testUserId,
        name: 'Original Name',
        description: null,
        filters: { exchange: ['NYSE'] },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedTemplate = {
        ...existingTemplate,
        name: 'Updated Name',
      };

      (prisma.screenerTemplate.findFirst as jest.Mock).mockResolvedValue(existingTemplate);
      (prisma.screenerTemplate.update as jest.Mock).mockResolvedValue(updatedTemplate);

      const updated = await screenerService.updateTemplate(testUserId, 'template-123', {
        name: 'Updated Name',
      });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Name');
    });

    it('should return null when updating non-existent template', async () => {
      (prisma.screenerTemplate.findFirst as jest.Mock).mockResolvedValue(null);

      const updated = await screenerService.updateTemplate(testUserId, 'non-existent-id', {
        name: 'New Name',
      });

      expect(updated).toBeNull();
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a template', async () => {
      const existingTemplate = {
        id: 'template-123',
        userId: testUserId,
        name: 'To Delete',
        description: null,
        filters: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.screenerTemplate.findFirst as jest.Mock).mockResolvedValue(existingTemplate);
      (prisma.screenerTemplate.delete as jest.Mock).mockResolvedValue(existingTemplate);

      const deleted = await screenerService.deleteTemplate(testUserId, 'template-123');
      expect(deleted).toBe(true);
    });

    it('should return false when deleting non-existent template', async () => {
      (prisma.screenerTemplate.findFirst as jest.Mock).mockResolvedValue(null);

      const deleted = await screenerService.deleteTemplate(testUserId, 'non-existent-id');
      expect(deleted).toBe(false);
    });
  });
});
