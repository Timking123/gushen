import { HeatmapService, HeatmapItem, HeatmapFilters, HeatmapResponse, IndustryInfo, isZeroPrice } from './heatmapService.js';
import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';

// Mock dependencies
jest.mock('../lib/prisma', () => ({
  prisma: {
    stock: {
      findMany: jest.fn(),
    },
    stockQuote: {
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

describe('HeatmapService', () => {
  let heatmapService: HeatmapService;

  beforeEach(() => {
    heatmapService = new HeatmapService();
    jest.clearAllMocks();
  });

  const mockStocks = [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      sector: 'Technology',
      industry: 'Consumer Electronics',
      marketCap: BigInt(3000000000000),
    },
    {
      symbol: 'MSFT',
      name: 'Microsoft Corporation',
      sector: 'Technology',
      industry: 'Software',
      marketCap: BigInt(2800000000000),
    },
    {
      symbol: 'JPM',
      name: 'JPMorgan Chase',
      sector: 'Financial Services',
      industry: 'Banks',
      marketCap: BigInt(500000000000),
    },
    {
      symbol: 'JNJ',
      name: 'Johnson & Johnson',
      sector: 'Healthcare',
      industry: 'Pharmaceuticals',
      marketCap: BigInt(400000000000),
    },
  ];

  const mockQuotes = [
    {
      symbol: 'AAPL',
      price: 175.50,
      change: 2.50,
      changePercent: 1.45,
      volume: BigInt(50000000),
      timestamp: new Date(),
    },
    {
      symbol: 'MSFT',
      price: 380.00,
      change: -3.20,
      changePercent: -0.84,
      volume: BigInt(25000000),
      timestamp: new Date(),
    },
    {
      symbol: 'JPM',
      price: 195.00,
      change: 1.50,
      changePercent: 0.78,
      volume: BigInt(10000000),
      timestamp: new Date(),
    },
    {
      symbol: 'JNJ',
      price: 160.00,
      change: -0.50,
      changePercent: -0.31,
      volume: BigInt(8000000),
      timestamp: new Date(),
    },
  ];

  describe('getHeatmapData', () => {
    beforeEach(() => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStocks);
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue(mockQuotes);
    });

    it('should return heatmap data grouped by sector', async () => {
      const result = await heatmapService.getHeatmapData('sector');

      expect(result.groupBy).toBe('sector');
      expect(result.groups.length).toBeGreaterThan(0);
      expect(result.totalStocks).toBe(4);
      expect(result.lastUpdated).toBeDefined();
      expect(result.dataIntegrity).toBeDefined();
    });

    it('should return heatmap data grouped by industry', async () => {
      const result = await heatmapService.getHeatmapData('industry');

      expect(result.groupBy).toBe('industry');
      expect(result.groups.length).toBeGreaterThan(0);
      // Each stock has a different industry
      expect(result.groups.length).toBe(4);
    });

    it('should return heatmap data grouped by marketCap', async () => {
      const result = await heatmapService.getHeatmapData('marketCap');

      expect(result.groupBy).toBe('marketCap');
      expect(result.groups.length).toBeGreaterThan(0);
    });

    it('should return cached data when available', async () => {
      const cachedData: HeatmapResponse = {
        groupBy: 'sector',
        groups: [],
        totalStocks: 10,
        lastUpdated: new Date().toISOString(),
        dataIntegrity: {
          isComplete: true,
          totalGroupsWithData: 3,
          totalGroupsEmpty: 0,
          minStocksPerGroup: 5,
          warnings: [],
          excludedZeroPriceCount: 0,
        },
      };

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(cachedData);

      const result = await heatmapService.getHeatmapData('sector');

      expect(result).toEqual(cachedData);
      expect(prisma.stock.findMany).not.toHaveBeenCalled();
    });

    it('should filter by sectors', async () => {
      const filters: HeatmapFilters = {
        sectors: ['Technology'],
      };

      const result = await heatmapService.getHeatmapData('sector', filters);

      // Should only have Technology sector stocks
      expect(result.totalStocks).toBe(2);
      result.groups.forEach(group => {
        group.items.forEach(item => {
          expect(item.sector.toLowerCase()).toBe('technology');
        });
      });
    });

    it('should filter by industries', async () => {
      const filters: HeatmapFilters = {
        industries: ['Software', 'Banks'],
      };

      const result = await heatmapService.getHeatmapData('sector', filters);

      // Should only have Software and Banks industry stocks
      expect(result.totalStocks).toBe(2);
    });

    it('should filter by minimum market cap', async () => {
      const filters: HeatmapFilters = {
        minMarketCap: 1000000000000, // 1T
      };

      const result = await heatmapService.getHeatmapData('sector', filters);

      // Should only have stocks with marketCap >= 1T (AAPL and MSFT)
      expect(result.totalStocks).toBe(2);
      result.groups.forEach(group => {
        group.items.forEach(item => {
          expect(item.marketCap).toBeGreaterThanOrEqual(1000000000000);
        });
      });
    });

    it('should filter by maximum market cap', async () => {
      const filters: HeatmapFilters = {
        maxMarketCap: 500000000000, // 500B
      };

      const result = await heatmapService.getHeatmapData('sector', filters);

      // Should only have stocks with marketCap <= 500B (JPM and JNJ)
      expect(result.totalStocks).toBe(2);
      result.groups.forEach(group => {
        group.items.forEach(item => {
          expect(item.marketCap).toBeLessThanOrEqual(500000000000);
        });
      });
    });

    it('should support multi-select sector filtering', async () => {
      const filters: HeatmapFilters = {
        sectors: ['Technology', 'Healthcare'],
      };

      const result = await heatmapService.getHeatmapData('sector', filters);

      // Should have Technology and Healthcare stocks (AAPL, MSFT, JNJ)
      expect(result.totalStocks).toBe(3);
    });

    it('should respect limit parameter', async () => {
      const result = await heatmapService.getHeatmapData('sector', {}, 1);

      // Each group should have at most 1 stock
      result.groups.forEach(group => {
        expect(group.items.length).toBeLessThanOrEqual(1);
      });
    });

    it('should calculate data integrity correctly', async () => {
      const result = await heatmapService.getHeatmapData('sector');

      expect(result.dataIntegrity.isComplete).toBeDefined();
      expect(result.dataIntegrity.totalGroupsWithData).toBeGreaterThan(0);
      expect(result.dataIntegrity.minStocksPerGroup).toBeGreaterThanOrEqual(0);
    });

    it('should sort groups by total market cap descending', async () => {
      const result = await heatmapService.getHeatmapData('sector');

      for (let i = 1; i < result.groups.length; i++) {
        expect(result.groups[i - 1].totalMarketCap).toBeGreaterThanOrEqual(
          result.groups[i].totalMarketCap
        );
      }
    });

    it('should calculate average change percent for each group', async () => {
      const result = await heatmapService.getHeatmapData('sector');

      result.groups.forEach(group => {
        expect(typeof group.avgChangePercent).toBe('number');
      });
    });

    it('should handle empty database results', async () => {
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue([]);

      const result = await heatmapService.getHeatmapData('sector');

      expect(result.totalStocks).toBe(0);
      expect(result.groups.length).toBe(0);
    });

    it('should continue when cache read fails', async () => {
      (redisHelpers.getJson as jest.Mock).mockRejectedValue(new Error('Redis Error'));

      const result = await heatmapService.getHeatmapData('sector');

      expect(result.totalStocks).toBe(4);
    });

    it('should not fail when cache write fails', async () => {
      (redisHelpers.setJson as jest.Mock).mockRejectedValue(new Error('Redis Error'));

      const result = await heatmapService.getHeatmapData('sector');

      expect(result.totalStocks).toBe(4);
    });
  });

  describe('getAvailableSectors', () => {
    it('should return list of unique sectors', async () => {
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([
        { sector: 'Technology' },
        { sector: 'Healthcare' },
        { sector: 'Financial Services' },
      ]);

      const result = await heatmapService.getAvailableSectors();

      expect(result).toContain('Technology');
      expect(result).toContain('Healthcare');
      expect(result).toContain('Financial Services');
      expect(result.length).toBe(3);
    });

    it('should return sorted sectors', async () => {
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([
        { sector: 'Technology' },
        { sector: 'Healthcare' },
        { sector: 'Basic Materials' },
      ]);

      const result = await heatmapService.getAvailableSectors();

      expect(result).toEqual(['Basic Materials', 'Healthcare', 'Technology']);
    });

    it('should filter out null sectors', async () => {
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([
        { sector: 'Technology' },
        { sector: null },
        { sector: 'Healthcare' },
      ]);

      const result = await heatmapService.getAvailableSectors();

      expect(result).not.toContain(null);
      expect(result.length).toBe(2);
    });
  });

  describe('getAvailableIndustries', () => {
    beforeEach(() => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
    });

    it('should return list of industries with sector and stock count', async () => {
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([
        { industry: 'Software', sector: 'Technology' },
        { industry: 'Software', sector: 'Technology' },
        { industry: 'Banks', sector: 'Financial Services' },
        { industry: 'Pharmaceuticals', sector: 'Healthcare' },
      ]);

      const result = await heatmapService.getAvailableIndustries();

      expect(result.length).toBe(3);
      
      const software = result.find(i => i.name === 'Software');
      expect(software).toBeDefined();
      expect(software?.sector).toBe('Technology');
      expect(software?.stockCount).toBe(2);
    });

    it('should return cached industries when available', async () => {
      const cachedIndustries: IndustryInfo[] = [
        { name: 'Software', sector: 'Technology', stockCount: 10 },
      ];

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(cachedIndustries);

      const result = await heatmapService.getAvailableIndustries();

      expect(result).toEqual(cachedIndustries);
      expect(prisma.stock.findMany).not.toHaveBeenCalled();
    });

    it('should sort industries by stock count descending', async () => {
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([
        { industry: 'Software', sector: 'Technology' },
        { industry: 'Software', sector: 'Technology' },
        { industry: 'Software', sector: 'Technology' },
        { industry: 'Banks', sector: 'Financial Services' },
        { industry: 'Banks', sector: 'Financial Services' },
        { industry: 'Pharmaceuticals', sector: 'Healthcare' },
      ]);

      const result = await heatmapService.getAvailableIndustries();

      expect(result[0].name).toBe('Software');
      expect(result[0].stockCount).toBe(3);
      expect(result[1].name).toBe('Banks');
      expect(result[1].stockCount).toBe(2);
    });
  });

  describe('getIndustriesBySector', () => {
    it('should return industries for a specific sector', async () => {
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([
        { industry: 'Software' },
        { industry: 'Consumer Electronics' },
        { industry: 'Semiconductors' },
      ]);

      const result = await heatmapService.getIndustriesBySector('Technology');

      expect(result.length).toBe(3);
      expect(result).toContain('Software');
      expect(result).toContain('Consumer Electronics');
      expect(result).toContain('Semiconductors');
    });

    it('should return sorted industries', async () => {
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([
        { industry: 'Software' },
        { industry: 'Consumer Electronics' },
        { industry: 'Semiconductors' },
      ]);

      const result = await heatmapService.getIndustriesBySector('Technology');

      expect(result).toEqual(['Consumer Electronics', 'Semiconductors', 'Software']);
    });

    it('should filter out null industries', async () => {
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([
        { industry: 'Software' },
        { industry: null },
        { industry: 'Hardware' },
      ]);

      const result = await heatmapService.getIndustriesBySector('Technology');

      expect(result).not.toContain(null);
      expect(result.length).toBe(2);
    });
  });

  describe('getSectorHeatmap', () => {
    beforeEach(() => {
      (prisma.stock.findMany as jest.Mock).mockResolvedValue(
        mockStocks.filter(s => s.sector === 'Technology')
      );
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue(
        mockQuotes.filter(q => ['AAPL', 'MSFT'].includes(q.symbol))
      );
    });

    it('should return heatmap items for a specific sector', async () => {
      const result = await heatmapService.getSectorHeatmap('Technology');

      expect(result.length).toBe(2);
      result.forEach(item => {
        expect(item.sector).toBe('Technology');
      });
    });

    it('should sort items by market cap descending', async () => {
      const result = await heatmapService.getSectorHeatmap('Technology');

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].marketCap).toBeGreaterThanOrEqual(result[i].marketCap);
      }
    });

    it('should respect limit parameter', async () => {
      const result = await heatmapService.getSectorHeatmap('Technology', 1);

      expect(result.length).toBeLessThanOrEqual(1);
    });
  });

  describe('isZeroPrice (Requirement 3.1)', () => {
    it('should return true for price === 0', () => {
      expect(isZeroPrice(0)).toBe(true);
    });

    it('should return true for price === null', () => {
      expect(isZeroPrice(null)).toBe(true);
    });

    it('should return true for price === undefined', () => {
      expect(isZeroPrice(undefined)).toBe(true);
    });

    it('should return true for sub-penny prices (< 0.01)', () => {
      expect(isZeroPrice(0.005)).toBe(true);
      expect(isZeroPrice(0.001)).toBe(true);
      expect(isZeroPrice(0.0099)).toBe(true);
    });

    it('should return false for valid prices (>= 0.01)', () => {
      expect(isZeroPrice(0.01)).toBe(false);
      expect(isZeroPrice(1)).toBe(false);
      expect(isZeroPrice(175.50)).toBe(false);
    });
  });

  describe('Zero-price stock handling (Requirements 3.2, 3.3, 3.4, 3.5)', () => {
    const mockStocksWithZeroPrice = [
      ...mockStocks,
      {
        symbol: 'ZERO1',
        name: 'Zero Price Corp',
        sector: 'Technology',
        industry: 'Software',
        marketCap: BigInt(100000000),
      },
      {
        symbol: 'ZERO2',
        name: 'Null Price Inc',
        sector: 'Healthcare',
        industry: 'Biotechnology',
        marketCap: BigInt(50000000),
      },
    ];

    const mockQuotesWithZeroPrice = [
      ...mockQuotes,
      {
        symbol: 'ZERO1',
        price: 0,
        change: 0,
        changePercent: 0,
        volume: BigInt(1000),
        timestamp: new Date(),
      },
      {
        symbol: 'ZERO2',
        price: 0.005,
        change: 0.001,
        changePercent: 25,
        volume: BigInt(500),
        timestamp: new Date(),
      },
    ];

    beforeEach(() => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStocksWithZeroPrice);
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue(mockQuotesWithZeroPrice);
    });

    it('should include zero-price stocks when hideZeroPrice is not set (Req 3.2, 3.3)', async () => {
      const result = await heatmapService.getHeatmapData('sector', {});

      // All 6 stocks should be present (including zero-price ones)
      expect(result.totalStocks).toBe(6);
      expect(result.dataIntegrity.excludedZeroPriceCount).toBe(0);
    });

    it('should include zero-price stocks when hideZeroPrice is false (Req 3.3)', async () => {
      const result = await heatmapService.getHeatmapData('sector', { hideZeroPrice: false });

      expect(result.totalStocks).toBe(6);
      expect(result.dataIntegrity.excludedZeroPriceCount).toBe(0);
    });

    it('should exclude zero-price stocks when hideZeroPrice is true (Req 3.4)', async () => {
      const result = await heatmapService.getHeatmapData('sector', { hideZeroPrice: true });

      // Only 4 normal-priced stocks should remain
      expect(result.totalStocks).toBe(4);

      // Verify no zero-price items in any group
      result.groups.forEach(group => {
        group.items.forEach(item => {
          expect(item.price).toBeGreaterThanOrEqual(0.01);
        });
      });
    });

    it('should report excludedZeroPriceCount in data integrity (Req 3.5)', async () => {
      const result = await heatmapService.getHeatmapData('sector', { hideZeroPrice: true });

      expect(result.dataIntegrity.excludedZeroPriceCount).toBe(2);
    });

    it('should add warning about excluded zero-price stocks (Req 3.5)', async () => {
      const result = await heatmapService.getHeatmapData('sector', { hideZeroPrice: true });

      const hasZeroPriceWarning = result.dataIntegrity.warnings.some(
        w => w.includes('zero-price') && w.includes('excluded')
      );
      expect(hasZeroPriceWarning).toBe(true);
    });

    it('should normalize zero-price stock data (price=0, change=0, changePercent=0)', async () => {
      // Without hideZeroPrice, zero-price stocks should still have normalized values
      const result = await heatmapService.getHeatmapData('sector', { hideZeroPrice: false });

      const allItems = result.groups.flatMap(g => g.items);
      const zeroPriceItems = allItems.filter(item => item.price === 0);

      zeroPriceItems.forEach(item => {
        expect(item.change).toBe(0);
        expect(item.changePercent).toBe(0);
      });
    });

    it('should handle getSectorHeatmap with zero-price stocks', async () => {
      (prisma.stock.findMany as jest.Mock).mockResolvedValue(
        mockStocksWithZeroPrice.filter(s => s.sector === 'Technology')
      );
      (prisma.stockQuote.findMany as jest.Mock).mockResolvedValue(
        mockQuotesWithZeroPrice.filter(q => ['AAPL', 'MSFT', 'ZERO1'].includes(q.symbol))
      );

      const result = await heatmapService.getSectorHeatmap('Technology');

      // ZERO1 should be included but with normalized price=0
      const zeroItem = result.find(item => item.symbol === 'ZERO1');
      expect(zeroItem).toBeDefined();
      expect(zeroItem!.price).toBe(0);
      expect(zeroItem!.change).toBe(0);
      expect(zeroItem!.changePercent).toBe(0);
    });
  });
});
