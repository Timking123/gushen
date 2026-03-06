import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';
import { CacheKeys, CacheTTL } from '../lib/cache-keys.js';
import { logger } from '../utils/logger.js';

/**
 * Earnings event timing type
 * BMO = Before Market Open
 * AMC = After Market Close
 */
export type EarningsTiming = 'bmo' | 'amc' | 'unknown';

/**
 * Earnings event interface
 * Represents a single earnings report event
 * 
 * Implements Requirements:
 * - 11.1: Display future earnings release schedule
 * - 11.2: Mark BMO or AMC release timing
 * - 11.3: Show expected EPS, previous EPS, and analyst forecasts
 */
export interface EarningsEvent {
  id: string;
  symbol: string;
  stockName?: string;
  sector?: string | null;
  industry?: string | null;
  marketCap?: number | null;
  reportDate: Date;
  fiscalQuarter: string;
  fiscalYear: number;
  timing: EarningsTiming;
  epsEstimate: number | null;
  epsActual: number | null;
  epsSurprise: number | null;
  epsSurprisePercent: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  revenueSurprise: number | null;
  revenueSurprisePercent: number | null;
  previousEps?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Earnings calendar filter options
 * Implements Requirement 11.6: Support filtering by date, sector, market cap
 */
export interface EarningsCalendarFilters {
  startDate?: Date;
  endDate?: Date;
  symbols?: string[];
  sectors?: string[];
  timing?: EarningsTiming[];
  marketCapMin?: number;
  marketCapMax?: number;
  hasActualResults?: boolean;
}

/**
 * Earnings calendar sort options
 */
export interface EarningsCalendarSort {
  field: 'reportDate' | 'symbol' | 'marketCap' | 'epsSurprisePercent';
  order: 'asc' | 'desc';
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Paginated earnings calendar response
 */
export interface EarningsCalendarResponse {
  events: EarningsEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * EarningsService - Handles earnings calendar operations
 * 
 * Implements Requirements:
 * - 11.1: WHEN 用户查看财报日历 THEN Earnings_Calendar SHALL 显示未来财报发布的时间表
 * - 11.2: WHEN 用户查看财报日历 THEN Earnings_Calendar SHALL 标注盘前（BMO）或盘后（AMC）发布时间
 * - 11.3: WHEN 用户查看即将发布财报的股票 THEN Earnings_Calendar SHALL 显示预期 EPS、上期 EPS 和分析师预测
 * - 11.6: WHEN 用户筛选财报日历 THEN Earnings_Calendar SHALL 支持按日期、板块、市值等条件筛选
 */
export class EarningsService {
  /**
   * Get earnings calendar with optional filters and pagination
   * 
   * @param filters - Optional filter criteria
   * @param sort - Optional sort options
   * @param pagination - Pagination options
   * @returns Paginated earnings events
   * 
   * Implements Requirements 11.1, 11.2, 11.3, 11.6
   */
  async getEarningsCalendar(
    filters?: EarningsCalendarFilters,
    sort?: EarningsCalendarSort,
    pagination?: PaginationOptions
  ): Promise<EarningsCalendarResponse> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    // Build where clause based on filters
    const where = this.buildWhereClause(filters);

    // Build order by clause
    const orderBy = this.buildOrderByClause(sort);

    // Check cache for common queries (no filters, default sort)
    const cacheKey = this.buildCacheKey(filters, sort, pagination);
    if (cacheKey) {
      try {
        const cachedResult = await redisHelpers.getJson<EarningsCalendarResponse>(cacheKey);
        if (cachedResult) {
          logger.debug(`Earnings calendar cache hit for key: ${cacheKey}`);
          // Convert date strings back to Date objects
          return {
            ...cachedResult,
            events: cachedResult.events.map(event => ({
              ...event,
              reportDate: new Date(event.reportDate),
              createdAt: new Date(event.createdAt),
              updatedAt: new Date(event.updatedAt),
            })),
          };
        }
      } catch (error) {
        logger.warn('Redis cache read error:', error);
      }
    }

    // Get total count for pagination
    const total = await prisma.earningsEvent.count({ where });

    // Query earnings events with stock information
    const earningsEvents = await prisma.earningsEvent.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        stock: {
          select: {
            name: true,
            sector: true,
            industry: true,
            marketCap: true,
          },
        },
      },
    });

    // Get previous EPS for each event (from the previous quarter)
    const events: EarningsEvent[] = await Promise.all(
      earningsEvents.map(async (event) => {
        const previousEps = await this.getPreviousEps(
          event.symbol,
          event.fiscalYear,
          event.fiscalQuarter
        );

        return {
          id: event.id,
          symbol: event.symbol,
          stockName: event.stock.name,
          sector: event.stock.sector,
          industry: event.stock.industry,
          marketCap: event.stock.marketCap ? Number(event.stock.marketCap) : null,
          reportDate: event.reportDate,
          fiscalQuarter: event.fiscalQuarter,
          fiscalYear: event.fiscalYear,
          timing: event.timing as EarningsTiming,
          epsEstimate: event.epsEstimate,
          epsActual: event.epsActual,
          epsSurprise: event.epsSurprise,
          epsSurprisePercent: this.calculateSurprisePercent(event.epsActual, event.epsEstimate),
          revenueEstimate: event.revenueEstimate ? Number(event.revenueEstimate) : null,
          revenueActual: event.revenueActual ? Number(event.revenueActual) : null,
          revenueSurprise: event.revenueSurprise,
          revenueSurprisePercent: this.calculateSurprisePercent(
            event.revenueActual ? Number(event.revenueActual) : null,
            event.revenueEstimate ? Number(event.revenueEstimate) : null
          ),
          previousEps,
          createdAt: event.createdAt,
          updatedAt: event.updatedAt,
        };
      })
    );

    const result: EarningsCalendarResponse = {
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache the result
    if (cacheKey) {
      try {
        await redisHelpers.setJson(cacheKey, result, CacheTTL.earnings);
        logger.debug(`Earnings calendar cached for key: ${cacheKey}`);
      } catch (error) {
        logger.warn('Redis cache write error:', error);
      }
    }

    return result;
  }

  /**
   * Get earnings events for a specific stock
   * 
   * @param symbol - Stock symbol
   * @param limit - Maximum number of events to return
   * @returns Array of earnings events for the stock
   * 
   * Implements Requirement 11.3
   */
  async getEarningsBySymbol(symbol: string, limit: number = 10): Promise<EarningsEvent[]> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check cache first
    const cacheKey = CacheKeys.earnings.stock(normalizedSymbol);
    try {
      const cachedEvents = await redisHelpers.getJson<EarningsEvent[]>(cacheKey);
      if (cachedEvents) {
        logger.debug(`Earnings by symbol cache hit for: ${normalizedSymbol}`);
        return cachedEvents.map(event => ({
          ...event,
          reportDate: new Date(event.reportDate),
          createdAt: new Date(event.createdAt),
          updatedAt: new Date(event.updatedAt),
        }));
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Query earnings events for the symbol
    const earningsEvents = await prisma.earningsEvent.findMany({
      where: { symbol: normalizedSymbol },
      orderBy: { reportDate: 'desc' },
      take: limit,
      include: {
        stock: {
          select: {
            name: true,
            sector: true,
            industry: true,
            marketCap: true,
          },
        },
      },
    });

    // Transform and add previous EPS
    const events: EarningsEvent[] = await Promise.all(
      earningsEvents.map(async (event) => {
        const previousEps = await this.getPreviousEps(
          event.symbol,
          event.fiscalYear,
          event.fiscalQuarter
        );

        return {
          id: event.id,
          symbol: event.symbol,
          stockName: event.stock.name,
          sector: event.stock.sector,
          industry: event.stock.industry,
          marketCap: event.stock.marketCap ? Number(event.stock.marketCap) : null,
          reportDate: event.reportDate,
          fiscalQuarter: event.fiscalQuarter,
          fiscalYear: event.fiscalYear,
          timing: event.timing as EarningsTiming,
          epsEstimate: event.epsEstimate,
          epsActual: event.epsActual,
          epsSurprise: event.epsSurprise,
          epsSurprisePercent: this.calculateSurprisePercent(event.epsActual, event.epsEstimate),
          revenueEstimate: event.revenueEstimate ? Number(event.revenueEstimate) : null,
          revenueActual: event.revenueActual ? Number(event.revenueActual) : null,
          revenueSurprise: event.revenueSurprise,
          revenueSurprisePercent: this.calculateSurprisePercent(
            event.revenueActual ? Number(event.revenueActual) : null,
            event.revenueEstimate ? Number(event.revenueEstimate) : null
          ),
          previousEps,
          createdAt: event.createdAt,
          updatedAt: event.updatedAt,
        };
      })
    );

    // Cache the result
    try {
      await redisHelpers.setJson(cacheKey, events, CacheTTL.earnings);
      logger.debug(`Earnings by symbol cached for: ${normalizedSymbol}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return events;
  }

  /**
   * Get upcoming earnings events (future dates)
   * 
   * @param days - Number of days to look ahead (default: 7)
   * @param limit - Maximum number of events to return
   * @returns Array of upcoming earnings events
   * 
   * Implements Requirement 11.1
   */
  async getUpcomingEarnings(days: number = 7, limit: number = 50): Promise<EarningsEvent[]> {
    const now = new Date();
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const result = await this.getEarningsCalendar(
      {
        startDate: now,
        endDate,
        hasActualResults: false,
      },
      { field: 'reportDate', order: 'asc' },
      { page: 1, limit }
    );

    return result.events;
  }

  /**
   * Get recent earnings results (past dates with actual results)
   * 
   * @param days - Number of days to look back (default: 7)
   * @param limit - Maximum number of events to return
   * @returns Array of recent earnings events with results
   */
  async getRecentEarningsResults(days: number = 7, limit: number = 50): Promise<EarningsEvent[]> {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const result = await this.getEarningsCalendar(
      {
        startDate,
        endDate: now,
        hasActualResults: true,
      },
      { field: 'reportDate', order: 'desc' },
      { page: 1, limit }
    );

    return result.events;
  }

  /**
   * Filter earnings events based on criteria
   * This is a convenience method that wraps getEarningsCalendar
   * 
   * @param filters - Filter criteria
   * @param sort - Sort options
   * @param pagination - Pagination options
   * @returns Filtered and paginated earnings events
   * 
   * Implements Requirement 11.6
   */
  async filterEarnings(
    filters: EarningsCalendarFilters,
    sort?: EarningsCalendarSort,
    pagination?: PaginationOptions
  ): Promise<EarningsCalendarResponse> {
    return this.getEarningsCalendar(filters, sort, pagination);
  }

  /**
   * Create or update an earnings event
   * 
   * @param eventData - Earnings event data
   * @returns The created or updated earnings event
   */
  async upsertEarningsEvent(eventData: {
    symbol: string;
    reportDate: Date;
    fiscalQuarter: string;
    fiscalYear: number;
    timing?: EarningsTiming;
    epsEstimate?: number | null;
    epsActual?: number | null;
    epsSurprise?: number | null;
    revenueEstimate?: number | null;
    revenueActual?: number | null;
    revenueSurprise?: number | null;
  }): Promise<EarningsEvent> {
    const normalizedSymbol = eventData.symbol.trim().toUpperCase();

    const event = await prisma.earningsEvent.upsert({
      where: {
        symbol_fiscalYear_fiscalQuarter: {
          symbol: normalizedSymbol,
          fiscalYear: eventData.fiscalYear,
          fiscalQuarter: eventData.fiscalQuarter,
        },
      },
      update: {
        reportDate: eventData.reportDate,
        timing: eventData.timing ?? 'unknown',
        epsEstimate: eventData.epsEstimate,
        epsActual: eventData.epsActual,
        epsSurprise: eventData.epsSurprise,
        revenueEstimate: eventData.revenueEstimate ? BigInt(eventData.revenueEstimate) : null,
        revenueActual: eventData.revenueActual ? BigInt(eventData.revenueActual) : null,
        revenueSurprise: eventData.revenueSurprise,
      },
      create: {
        symbol: normalizedSymbol,
        reportDate: eventData.reportDate,
        fiscalQuarter: eventData.fiscalQuarter,
        fiscalYear: eventData.fiscalYear,
        timing: eventData.timing ?? 'unknown',
        epsEstimate: eventData.epsEstimate,
        epsActual: eventData.epsActual,
        epsSurprise: eventData.epsSurprise,
        revenueEstimate: eventData.revenueEstimate ? BigInt(eventData.revenueEstimate) : null,
        revenueActual: eventData.revenueActual ? BigInt(eventData.revenueActual) : null,
        revenueSurprise: eventData.revenueSurprise,
      },
      include: {
        stock: {
          select: {
            name: true,
            sector: true,
            industry: true,
            marketCap: true,
          },
        },
      },
    });

    // Invalidate caches
    await this.invalidateCache(normalizedSymbol);

    const previousEps = await this.getPreviousEps(
      event.symbol,
      event.fiscalYear,
      event.fiscalQuarter
    );

    return {
      id: event.id,
      symbol: event.symbol,
      stockName: event.stock.name,
      sector: event.stock.sector,
      industry: event.stock.industry,
      marketCap: event.stock.marketCap ? Number(event.stock.marketCap) : null,
      reportDate: event.reportDate,
      fiscalQuarter: event.fiscalQuarter,
      fiscalYear: event.fiscalYear,
      timing: event.timing as EarningsTiming,
      epsEstimate: event.epsEstimate,
      epsActual: event.epsActual,
      epsSurprise: event.epsSurprise,
      epsSurprisePercent: this.calculateSurprisePercent(event.epsActual, event.epsEstimate),
      revenueEstimate: event.revenueEstimate ? Number(event.revenueEstimate) : null,
      revenueActual: event.revenueActual ? Number(event.revenueActual) : null,
      revenueSurprise: event.revenueSurprise,
      revenueSurprisePercent: this.calculateSurprisePercent(
        event.revenueActual ? Number(event.revenueActual) : null,
        event.revenueEstimate ? Number(event.revenueEstimate) : null
      ),
      previousEps,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  /**
   * Get earnings events for a specific date
   * 
   * @param date - The date to get earnings for
   * @returns Array of earnings events for that date
   */
  async getEarningsByDate(date: Date): Promise<EarningsEvent[]> {
    // Normalize to start of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await this.getEarningsCalendar(
      {
        startDate: startOfDay,
        endDate: endOfDay,
      },
      { field: 'symbol', order: 'asc' },
      { page: 1, limit: 100 }
    );

    return result.events;
  }

  /**
   * Build Prisma where clause from filters
   */
  private buildWhereClause(filters?: EarningsCalendarFilters): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (!filters) {
      return where;
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      where.reportDate = {};
      if (filters.startDate) {
        (where.reportDate as Record<string, Date>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.reportDate as Record<string, Date>).lte = filters.endDate;
      }
    }

    // Symbol filter
    if (filters.symbols && filters.symbols.length > 0) {
      where.symbol = {
        in: filters.symbols.map(s => s.trim().toUpperCase()),
      };
    }

    // Timing filter
    if (filters.timing && filters.timing.length > 0) {
      where.timing = {
        in: filters.timing,
      };
    }

    // Has actual results filter
    if (filters.hasActualResults !== undefined) {
      if (filters.hasActualResults) {
        where.epsActual = { not: null };
      } else {
        where.epsActual = null;
      }
    }

    // Sector and market cap filters require joining with stock table
    if (filters.sectors && filters.sectors.length > 0) {
      where.stock = {
        ...((where.stock as Record<string, unknown>) || {}),
        sector: {
          in: filters.sectors,
        },
      };
    }

    if (filters.marketCapMin !== undefined || filters.marketCapMax !== undefined) {
      const marketCapFilter: Record<string, bigint> = {};
      if (filters.marketCapMin !== undefined) {
        marketCapFilter.gte = BigInt(filters.marketCapMin);
      }
      if (filters.marketCapMax !== undefined) {
        marketCapFilter.lte = BigInt(filters.marketCapMax);
      }
      where.stock = {
        ...((where.stock as Record<string, unknown>) || {}),
        marketCap: marketCapFilter,
      };
    }

    return where;
  }

  /**
   * Build Prisma orderBy clause from sort options
   */
  private buildOrderByClause(sort?: EarningsCalendarSort): Record<string, string>[] {
    if (!sort) {
      // Default sort: by report date ascending
      return [{ reportDate: 'asc' }];
    }

    const orderBy: Record<string, string>[] = [];

    switch (sort.field) {
      case 'reportDate':
        orderBy.push({ reportDate: sort.order });
        break;
      case 'symbol':
        orderBy.push({ symbol: sort.order });
        break;
      case 'marketCap':
        // For market cap, we need to sort by the related stock's market cap
        // This is handled differently in Prisma
        orderBy.push({ stock: { marketCap: sort.order } } as unknown as Record<string, string>);
        break;
      case 'epsSurprisePercent':
        orderBy.push({ epsSurprise: sort.order });
        break;
      default:
        orderBy.push({ reportDate: 'asc' });
    }

    return orderBy;
  }

  /**
   * Build cache key for earnings calendar query
   */
  private buildCacheKey(
    filters?: EarningsCalendarFilters,
    sort?: EarningsCalendarSort,
    pagination?: PaginationOptions
  ): string | null {
    // Only cache simple queries without complex filters
    if (filters && (
      filters.symbols ||
      filters.sectors ||
      filters.marketCapMin ||
      filters.marketCapMax
    )) {
      return null;
    }

    const dateKey = filters?.startDate 
      ? filters.startDate.toISOString().split('T')[0]
      : 'all';
    
    const page = pagination?.page ?? 1;
    const sortKey = sort ? `${sort.field}-${sort.order}` : 'default';

    return `${CacheKeys.earnings.calendar(dateKey)}:${sortKey}:page${page}`;
  }

  /**
   * Get previous quarter's EPS for comparison
   */
  private async getPreviousEps(
    symbol: string,
    fiscalYear: number,
    fiscalQuarter: string
  ): Promise<number | null> {
    // Calculate previous quarter
    const quarterNum = parseInt(fiscalQuarter.replace('Q', ''), 10);
    let prevYear = fiscalYear;
    let prevQuarter: string;

    if (quarterNum === 1) {
      prevYear = fiscalYear - 1;
      prevQuarter = 'Q4';
    } else {
      prevQuarter = `Q${quarterNum - 1}`;
    }

    const previousEvent = await prisma.earningsEvent.findUnique({
      where: {
        symbol_fiscalYear_fiscalQuarter: {
          symbol,
          fiscalYear: prevYear,
          fiscalQuarter: prevQuarter,
        },
      },
      select: {
        epsActual: true,
      },
    });

    return previousEvent?.epsActual ?? null;
  }

  /**
   * Calculate surprise percentage
   */
  private calculateSurprisePercent(
    actual: number | null,
    estimate: number | null
  ): number | null {
    if (actual === null || estimate === null || estimate === 0) {
      return null;
    }
    return ((actual - estimate) / Math.abs(estimate)) * 100;
  }

  /**
   * Invalidate cache for a symbol
   */
  private async invalidateCache(symbol: string): Promise<void> {
    try {
      // Invalidate symbol-specific cache
      await redisHelpers.del(CacheKeys.earnings.stock(symbol));
      
      // Note: We don't invalidate calendar caches here as they are date-based
      // and will expire naturally
      logger.debug(`Earnings cache invalidated for symbol: ${symbol}`);
    } catch (error) {
      logger.warn('Redis cache invalidation error:', error);
    }
  }
}

// Export singleton instance
export const earningsService = new EarningsService();
