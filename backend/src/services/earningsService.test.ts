import { EarningsService, EarningsEvent, EarningsTiming } from './earningsService.js';
import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';

// Mock dependencies
jest.mock('../lib/prisma', () => ({
  prisma: {
    earningsEvent: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
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

describe('EarningsService', () => {
  let earningsService: EarningsService;

  beforeEach(() => {
    earningsService = new EarningsService();
    jest.clearAllMocks();
    // Default mock for cache miss
    (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
  });

  describe('getEarningsCalendar', () => {
    const mockEvents = [
      {
        id: '1',
        symbol: 'AAPL',
        reportDate: new Date('2024-01-25'),
        fiscalQuarter: 'Q1',
        fiscalYear: 2024,
        timing: 'amc' as EarningsTiming,
        epsEstimate: 2.10,
        epsActual: 2.18,
        epsSurprise: 0.08,
        revenueEstimate: BigInt(118000000000),
        revenueActual: BigInt(119500000000),
        revenueSurprise: 1.27,
        createdAt: new Date(),
        updatedAt: new Date(),
        stock: {
          name: 'Apple Inc.',
          sector: 'Technology',
          industry: 'Consumer Electronics',
          marketCap: BigInt(3000000000000),
        },
      },
    ];

    it('should return paginated earnings events', async () => {
      (prisma.earningsEvent.count as jest.Mock).mockResolvedValue(1);
      (prisma.earningsEvent.findMany as jest.Mock).mockResolvedValue(mockEvents);
      (prisma.earningsEvent.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await earningsService.getEarningsCalendar();

      expect(result.events).toHaveLength(1);
      expect(result.events[0].symbol).toBe('AAPL');
      expect(result.events[0].timing).toBe('amc');
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      (prisma.earningsEvent.count as jest.Mock).mockResolvedValue(0);
      (prisma.earningsEvent.findMany as jest.Mock).mockResolvedValue([]);

      await earningsService.getEarningsCalendar({
        startDate,
        endDate,
      });

      expect(prisma.earningsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reportDate: {
              gte: startDate,
              lte: endDate,
            },
          }),
        })
      );
    });

    it('should filter by timing (BMO/AMC)', async () => {
      (prisma.earningsEvent.count as jest.Mock).mockResolvedValue(0);
      (prisma.earningsEvent.findMany as jest.Mock).mockResolvedValue([]);

      await earningsService.getEarningsCalendar({
        timing: ['bmo', 'amc'],
      });

      expect(prisma.earningsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timing: {
              in: ['bmo', 'amc'],
            },
          }),
        })
      );
    });

    it('should filter by sectors', async () => {
      (prisma.earningsEvent.count as jest.Mock).mockResolvedValue(0);
      (prisma.earningsEvent.findMany as jest.Mock).mockResolvedValue([]);

      await earningsService.getEarningsCalendar({
        sectors: ['Technology', 'Healthcare'],
      });

      expect(prisma.earningsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            stock: expect.objectContaining({
              sector: {
                in: ['Technology', 'Healthcare'],
              },
            }),
          }),
        })
      );
    });

    it('should filter by market cap range', async () => {
      (prisma.earningsEvent.count as jest.Mock).mockResolvedValue(0);
      (prisma.earningsEvent.findMany as jest.Mock).mockResolvedValue([]);

      await earningsService.getEarningsCalendar({
        marketCapMin: 1000000000,
        marketCapMax: 100000000000,
      });

      expect(prisma.earningsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            stock: expect.objectContaining({
              marketCap: {
                gte: BigInt(1000000000),
                lte: BigInt(100000000000),
              },
            }),
          }),
        })
      );
    });

    it('should sort by report date ascending by default', async () => {
      (prisma.earningsEvent.count as jest.Mock).mockResolvedValue(0);
      (prisma.earningsEvent.findMany as jest.Mock).mockResolvedValue([]);

      await earningsService.getEarningsCalendar();

      expect(prisma.earningsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ reportDate: 'asc' }],
        })
      );
    });

    it('should support custom sorting', async () => {
      (prisma.earningsEvent.count as jest.Mock).mockResolvedValue(0);
      (prisma.earningsEvent.findMany as jest.Mock).mockResolvedValue([]);

      await earningsService.getEarningsCalendar(
        undefined,
        { field: 'symbol', order: 'desc' }
      );

      expect(prisma.earningsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ symbol: 'desc' }],
        })
      );
    });

    it('should support pagination', async () => {
      (prisma.earningsEvent.count as jest.Mock).mockResolvedValue(100);
      (prisma.earningsEvent.findMany as jest.Mock).mockResolvedValue([]);

      const result = await earningsService.getEarningsCalendar(
        undefined,
        undefined,
        { page: 3, limit: 10 }
      );

      expect(prisma.earningsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );
      expect(result.pagination.page).toBe(3);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.totalPages).toBe(10);
    });

    it('should filter by hasActualResults = true', async () => {
      (prisma.earningsEvent.count as jest.Mock).mockResolvedValue(0);
      (prisma.earningsEvent.findMany as jest.Mock).mockResolvedValue([]);

      await earningsService.getEarningsCalendar({
        hasActualResults: true,
      });

      expect(prisma.earningsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            epsActual: { not: null },
          }),
        })
      );
    });

    it('should filter by hasActualResults = false', async () => {
      (prisma.earningsEvent.count as jest.Mock).mockResolvedValue(0);
      (prisma.earningsEvent.findMany as jest.Mock).mockResolvedValue([]);

      await earningsService.getEarningsCalendar({
        hasActualResults: false,
      });

      expect(prisma.earningsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            epsActual: null,
          }),
        })
      );
    });

    it('should filter by symbols', async () => {
      (prisma.earningsEvent.count as jest.Mock).mockResolvedValue(0);
      (prisma.earningsEvent.findMany as jest.Mock).mockResolvedValue([]);

      await earningsService.getEarningsCalendar({
        symbols: ['AAPL', 'MSFT', 'googl'],
      });

      expect(prisma.earningsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            symbol: {
              in: ['AAPL', 'MSFT', 'GOOGL'],
            },
          }),
        })
      );
    });
  });

  describe('getEarningsBySymbol', () => {
    const mockEvents = [
      {
        id: '1',
        symbol: 'AAPL',
        reportDate: new Date('2024-01-25'),
        fiscalQuarter: 'Q1',
        fiscalYear: 2024,
        timing: 'amc' as EarningsTiming,
        epsEstimate: 2.10,
        epsActual: 2.18,
        epsSurprise: 0.08,
        revenueEstimate: BigInt(118000000000),
        revenueActual: BigInt(119500000000),
        revenueSurprise: 1.27,
        createdAt: new Date(),
        updatedAt: new Date(),
        stock: {
          name: 'Apple Inc.',
          sector: 'Technology',
          industry: 'Consumer Electronics',
          marketCap: BigInt(3000000000000),
        },
      },
    ];

    it('should return earnings events for a specific stock', async () => {
      (prisma.earningsEvent.findMany as jest.Mock).mockResolvedValue(mockEvents);
      (prisma.earningsEvent.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await earningsService.getEarningsBySymbol('AAPL');

      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('AAPL');
      expect(prisma.earningsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { symbol: 'AAPL' },
          orderBy: { reportDate: 'desc' },
        })
      );
    });

    it('should normalize symbol to uppercase', async () => {
      (prisma.earningsEvent.findMany as jest.Mock).mockResolvedValue([]);

      await earningsService.getEarningsBySymbol('aapl');

      expect(prisma.earningsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { symbol: 'AAPL' },
        })
      );
    });

    it('should respect limit parameter', async () => {
      (prisma.earningsEvent.findMany as jest.Mock).mockResolvedValue([]);

      await earningsService.getEarningsBySymbol('AAPL', 5);

      expect(prisma.earningsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        })
      );
    });

    it('should return cached results when cache hit', async () => {
      const cachedEvents: EarningsEvent[] = [
        {
          id: '1',
          symbol: 'AAPL',
          stockName: 'Apple Inc.',
          sector: 'Technology',
          industry: 'Consumer Electronics',
          marketCap: 3000000000000,
          reportDate: new Date('2024-01-25'),
          fiscalQuarter: 'Q1',
          fiscalYear: 2024,
          timing: 'amc',
          epsEstimate: 2.10,
          epsActual: 2.18,
          epsSurprise: 0.08,
          epsSurprisePercent: 3.81,
          revenueEstimate: 118000000000,
          revenueActual: 119500000000,
          revenueSurprise: 1.27,
          revenueSurprisePercent: 1.27,
          previousEps: 1.95,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(cachedEvents);

      const result = await earningsService.getEarningsBySymbol('AAPL');

      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('AAPL');
      expect(prisma.earningsEvent.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getUpcomingEarnings', () => {
    it('should return future earnings events', async () => {
      (prisma.earningsEvent.count as jest.Mock).mockResolvedValue(0);
      (prisma.earningsEvent.findMany as jest.Mock).mockResolvedValue([]);

      await earningsService.getUpcomingEarnings(7, 50);

      expect(prisma.earningsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            epsActual: null,
          }),
          orderBy: [{ reportDate: 'asc' }],
        })
      );
    });

    it('should use default values when not provided', async () => {
      (prisma.earningsEvent.count as jest.Mock).mockResolvedValue(0);
      (prisma.earningsEvent.findMany as jest.Mock).mockResolvedValue([]);

      await earningsService.getUpcomingEarnings();

      expect(prisma.earningsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });
  });

  describe('getRecentEarningsResults', () => {
    it('should return past earnings events with actual results', async () => {
      (prisma.earningsEvent.count as jest.Mock).mockResolvedValue(0);
      (prisma.earningsEvent.findMany as jest.Mock).mockResolvedValue([]);

      await earningsService.getRecentEarningsResults(7, 50);

      expect(prisma.earningsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            epsActual: { not: null },
          }),
          orderBy: [{ reportDate: 'desc' }],
        })
      );
    });
  });

  describe('upsertEarningsEvent', () => {
    const mockEvent = {
      id: '1',
      symbol: 'AAPL',
      reportDate: new Date('2024-01-25'),
      fiscalQuarter: 'Q1',
      fiscalYear: 2024,
      timing: 'amc',
      epsEstimate: 2.10,
      epsActual: null,
      epsSurprise: null,
      revenueEstimate: BigInt(118000000000),
      revenueActual: null,
      revenueSurprise: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      stock: {
        name: 'Apple Inc.',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        marketCap: BigInt(3000000000000),
      },
    };

    it('should create or update an earnings event', async () => {
      (prisma.earningsEvent.upsert as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.earningsEvent.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await earningsService.upsertEarningsEvent({
        symbol: 'AAPL',
        reportDate: new Date('2024-01-25'),
        fiscalQuarter: 'Q1',
        fiscalYear: 2024,
        timing: 'amc',
        epsEstimate: 2.10,
      });

      expect(result.symbol).toBe('AAPL');
      expect(result.timing).toBe('amc');
      expect(prisma.earningsEvent.upsert).toHaveBeenCalled();
    });

    it('should normalize symbol to uppercase', async () => {
      (prisma.earningsEvent.upsert as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.earningsEvent.findUnique as jest.Mock).mockResolvedValue(null);

      await earningsService.upsertEarningsEvent({
        symbol: 'aapl',
        reportDate: new Date('2024-01-25'),
        fiscalQuarter: 'Q1',
        fiscalYear: 2024,
      });

      expect(prisma.earningsEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            symbol_fiscalYear_fiscalQuarter: expect.objectContaining({
              symbol: 'AAPL',
            }),
          }),
        })
      );
    });

    it('should invalidate cache after upsert', async () => {
      (prisma.earningsEvent.upsert as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.earningsEvent.findUnique as jest.Mock).mockResolvedValue(null);

      await earningsService.upsertEarningsEvent({
        symbol: 'AAPL',
        reportDate: new Date('2024-01-25'),
        fiscalQuarter: 'Q1',
        fiscalYear: 2024,
      });

      expect(redisHelpers.del).toHaveBeenCalled();
    });
  });

  describe('getEarningsByDate', () => {
    it('should return earnings events for a specific date', async () => {
      (prisma.earningsEvent.count as jest.Mock).mockResolvedValue(0);
      (prisma.earningsEvent.findMany as jest.Mock).mockResolvedValue([]);

      const testDate = new Date('2024-01-25');
      await earningsService.getEarningsByDate(testDate);

      expect(prisma.earningsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reportDate: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });
  });

  describe('EarningsEvent data model', () => {
    it('should include all required fields per design spec', () => {
      // Verify the EarningsEvent interface includes all fields from design.md
      const mockEvent: EarningsEvent = {
        id: '1',
        symbol: 'AAPL',
        stockName: 'Apple Inc.',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        marketCap: 3000000000000,
        reportDate: new Date('2024-01-25'),
        fiscalQuarter: 'Q1',
        fiscalYear: 2024,
        timing: 'amc',
        epsEstimate: 2.10,
        epsActual: 2.18,
        epsSurprise: 0.08,
        epsSurprisePercent: 3.81,
        revenueEstimate: 118000000000,
        revenueActual: 119500000000,
        revenueSurprise: 1500000000,
        revenueSurprisePercent: 1.27,
        previousEps: 1.95,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Verify timing values match design spec
      expect(['bmo', 'amc', 'unknown']).toContain(mockEvent.timing);
      
      // Verify all required fields are present
      expect(mockEvent.symbol).toBeDefined();
      expect(mockEvent.reportDate).toBeDefined();
      expect(mockEvent.fiscalQuarter).toBeDefined();
      expect(mockEvent.fiscalYear).toBeDefined();
      expect(mockEvent.timing).toBeDefined();
    });

    it('should support BMO (Before Market Open) timing', () => {
      const timing: EarningsTiming = 'bmo';
      expect(timing).toBe('bmo');
    });

    it('should support AMC (After Market Close) timing', () => {
      const timing: EarningsTiming = 'amc';
      expect(timing).toBe('amc');
    });

    it('should support unknown timing', () => {
      const timing: EarningsTiming = 'unknown';
      expect(timing).toBe('unknown');
    });
  });

  describe('filterEarnings', () => {
    it('should be a convenience wrapper for getEarningsCalendar', async () => {
      (prisma.earningsEvent.count as jest.Mock).mockResolvedValue(0);
      (prisma.earningsEvent.findMany as jest.Mock).mockResolvedValue([]);

      const filters = {
        sectors: ['Technology'],
        timing: ['bmo' as EarningsTiming],
      };

      await earningsService.filterEarnings(filters);

      expect(prisma.earningsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timing: { in: ['bmo'] },
            stock: expect.objectContaining({
              sector: { in: ['Technology'] },
            }),
          }),
        })
      );
    });
  });
});
