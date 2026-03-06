import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';
import { CacheKeys, CacheTTL } from '../lib/cache-keys.js';
import { logger } from '../utils/logger.js';

/**
 * Dividend frequency type
 */
export type DividendFrequency = 'annual' | 'semi_annual' | 'quarterly' | 'monthly';

/**
 * Dividend event interface
 * Implements Requirement 15.1: Display dividend rate, frequency, and history
 */
export interface DividendEvent {
  id: string;
  symbol: string;
  stockName?: string;
  exDate: Date;
  payDate: Date;
  recordDate: Date;
  amount: number;
  frequency: DividendFrequency;
  yield: number | null;
  createdAt: Date;
}

/**
 * Dividend history item
 */
export interface DividendHistoryItem {
  id: string;
  exDate: Date;
  payDate: Date;
  amount: number;
  yield: number | null;
}

/**
 * Dividend summary for a stock
 * Implements Requirement 15.1: Display dividend rate, frequency, and history
 */
export interface DividendSummary {
  symbol: string;
  stockName?: string;
  currentYield: number | null;
  annualDividend: number | null;
  frequency: DividendFrequency | null;
  payoutRatio: number | null;
  dividendGrowthRate: number | null;
  consecutiveYears: number;
  lastExDate: Date | null;
  lastPayDate: Date | null;
  lastAmount: number | null;
  nextExDate: Date | null;
  nextPayDate: Date | null;
  nextAmount: number | null;
}

/**
 * Dividend calendar entry
 * Implements Requirement 15.2: Display upcoming ex-dividend and pay dates
 */
export interface DividendCalendarEntry {
  id: string;
  symbol: string;
  stockName?: string;
  exDate: Date;
  payDate: Date;
  recordDate: Date;
  amount: number;
  yield: number | null;
}

/**
 * Dividend calendar filters
 */
export interface DividendCalendarFilters {
  symbols?: string[];
  startDate?: Date;
  endDate?: Date;
  minYield?: number;
  maxYield?: number;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Dividend calendar response
 */
export interface DividendCalendarResponse {
  events: DividendCalendarEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Portfolio dividend income calculation
 * Implements Requirement 15.6: Calculate expected annual dividend income
 */
export interface PortfolioDividendIncome {
  portfolioId: string;
  totalAnnualIncome: number;
  holdings: Array<{
    symbol: string;
    stockName?: string;
    shares: number;
    annualDividend: number;
    expectedIncome: number;
    yield: number | null;
    frequency: DividendFrequency | null;
    nextExDate: Date | null;
  }>;
}

/**
 * Input for creating/updating a dividend event
 */
export interface DividendEventInput {
  symbol: string;
  exDate: Date;
  payDate: Date;
  recordDate: Date;
  amount: number;
  frequency?: DividendFrequency;
  yield?: number | null;
}

/**
 * DividendService - Handles dividend tracking operations
 * 
 * Implements Requirements:
 * - 15.1: WHEN 用户查看股票详情 THEN Dividend_Tracker SHALL 显示股息率、派息频率和历史派息记录
 * - 15.2: WHEN 用户查看股息日历 THEN Dividend_Tracker SHALL 显示即将到来的除息日和派息日
 * - 15.6: WHEN 用户查看投资组合 THEN Dividend_Tracker SHALL 计算并显示预期年度股息收入
 */
export class DividendService {
  /**
   * Get dividend summary for a stock
   * 
   * @param symbol - Stock symbol
   * @returns Dividend summary with yield, frequency, and history stats
   * 
   * Implements Requirement 15.1
   */
  async getDividendSummary(symbol: string): Promise<DividendSummary | null> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check cache first
    const cacheKey = CacheKeys.dividend.stock(normalizedSymbol);
    try {
      const cached = await redisHelpers.getJson<DividendSummary>(cacheKey);
      if (cached) {
        logger.debug(`Dividend summary cache hit for: ${normalizedSymbol}`);
        return {
          ...cached,
          lastExDate: cached.lastExDate ? new Date(cached.lastExDate) : null,
          lastPayDate: cached.lastPayDate ? new Date(cached.lastPayDate) : null,
          nextExDate: cached.nextExDate ? new Date(cached.nextExDate) : null,
          nextPayDate: cached.nextPayDate ? new Date(cached.nextPayDate) : null,
        };
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Get stock info
    const stock = await prisma.stock.findUnique({
      where: { symbol: normalizedSymbol },
      include: {
        fundamentalMetrics: true,
      },
    });

    if (!stock) {
      return null;
    }

    // Get dividend history
    const now = new Date();
    const dividends = await prisma.dividendEvent.findMany({
      where: { symbol: normalizedSymbol },
      orderBy: { exDate: 'desc' },
      take: 20,
    });

    if (dividends.length === 0) {
      return {
        symbol: normalizedSymbol,
        stockName: stock.name,
        currentYield: stock.fundamentalMetrics?.dividendYield ?? null,
        annualDividend: null,
        frequency: null,
        payoutRatio: stock.fundamentalMetrics?.payoutRatio ?? null,
        dividendGrowthRate: null,
        consecutiveYears: 0,
        lastExDate: null,
        lastPayDate: null,
        lastAmount: null,
        nextExDate: null,
        nextPayDate: null,
        nextAmount: null,
      };
    }

    // Calculate annual dividend and frequency
    const lastYearDividends = dividends.filter(
      (d) => d.exDate >= new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    );
    const annualDividend = lastYearDividends.reduce((sum, d) => sum + d.amount, 0);
    const frequency = this.determineFrequency(lastYearDividends.length);

    // Calculate dividend growth rate (compare last year to previous year)
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
    const previousYearDividends = dividends.filter(
      (d) => d.exDate >= twoYearsAgo && d.exDate < new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    );
    const previousAnnualDividend = previousYearDividends.reduce((sum, d) => sum + d.amount, 0);
    const dividendGrowthRate = previousAnnualDividend > 0
      ? ((annualDividend - previousAnnualDividend) / previousAnnualDividend) * 100
      : null;

    // Calculate consecutive years of dividends
    const consecutiveYears = this.calculateConsecutiveYears(dividends);

    // Find last and next dividend
    const pastDividends = dividends.filter((d) => d.exDate <= now);
    const futureDividends = dividends.filter((d) => d.exDate > now);
    const lastDividend = pastDividends[0] || null;
    const nextDividend = futureDividends[futureDividends.length - 1] || null;

    const summary: DividendSummary = {
      symbol: normalizedSymbol,
      stockName: stock.name,
      currentYield: stock.fundamentalMetrics?.dividendYield ?? null,
      annualDividend: annualDividend > 0 ? annualDividend : null,
      frequency,
      payoutRatio: stock.fundamentalMetrics?.payoutRatio ?? null,
      dividendGrowthRate,
      consecutiveYears,
      lastExDate: lastDividend?.exDate ?? null,
      lastPayDate: lastDividend?.payDate ?? null,
      lastAmount: lastDividend?.amount ?? null,
      nextExDate: nextDividend?.exDate ?? null,
      nextPayDate: nextDividend?.payDate ?? null,
      nextAmount: nextDividend?.amount ?? null,
    };

    // Cache the result
    try {
      await redisHelpers.setJson(cacheKey, summary, CacheTTL.dividend);
      logger.debug(`Dividend summary cached for: ${normalizedSymbol}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return summary;
  }

  /**
   * Get dividend history for a stock
   * 
   * @param symbol - Stock symbol
   * @param limit - Maximum number of records
   * @returns Array of dividend history items
   * 
   * Implements Requirement 15.1
   */
  async getDividendHistory(
    symbol: string,
    limit: number = 20
  ): Promise<DividendHistoryItem[]> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    const dividends = await prisma.dividendEvent.findMany({
      where: { symbol: normalizedSymbol },
      orderBy: { exDate: 'desc' },
      take: limit,
    });

    return dividends.map((d) => ({
      id: d.id,
      exDate: d.exDate,
      payDate: d.payDate,
      amount: d.amount,
      yield: d.yield,
    }));
  }

  /**
   * Get dividend calendar with filters
   * 
   * @param filters - Optional filter criteria
   * @param pagination - Pagination options
   * @returns Paginated dividend calendar entries
   * 
   * Implements Requirement 15.2
   */
  async getDividendCalendar(
    filters?: DividendCalendarFilters,
    pagination?: PaginationOptions
  ): Promise<DividendCalendarResponse> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where = this.buildWhereClause(filters);

    // Get total count
    const total = await prisma.dividendEvent.count({ where });

    // Get dividend events
    const events = await prisma.dividendEvent.findMany({
      where,
      orderBy: { exDate: 'asc' },
      skip,
      take: limit,
      include: {
        stock: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      events: events.map((e) => ({
        id: e.id,
        symbol: e.symbol,
        stockName: e.stock.name,
        exDate: e.exDate,
        payDate: e.payDate,
        recordDate: e.recordDate,
        amount: e.amount,
        yield: e.yield,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get upcoming dividends for watchlist stocks
   * 
   * @param symbols - Array of stock symbols
   * @param days - Number of days to look ahead
   * @returns Array of upcoming dividend events
   * 
   * Implements Requirement 15.3
   */
  async getUpcomingDividends(
    symbols: string[],
    days: number = 30
  ): Promise<DividendCalendarEntry[]> {
    const normalizedSymbols = symbols.map((s) => s.trim().toUpperCase());
    const now = new Date();
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const events = await prisma.dividendEvent.findMany({
      where: {
        symbol: { in: normalizedSymbols },
        exDate: {
          gte: now,
          lte: endDate,
        },
      },
      orderBy: { exDate: 'asc' },
      include: {
        stock: {
          select: {
            name: true,
          },
        },
      },
    });

    return events.map((e) => ({
      id: e.id,
      symbol: e.symbol,
      stockName: e.stock.name,
      exDate: e.exDate,
      payDate: e.payDate,
      recordDate: e.recordDate,
      amount: e.amount,
      yield: e.yield,
    }));
  }

  /**
   * Calculate expected annual dividend income for a portfolio
   * 
   * @param portfolioId - Portfolio ID
   * @returns Portfolio dividend income calculation
   * 
   * Implements Requirement 15.6
   */
  async calculatePortfolioDividendIncome(
    portfolioId: string
  ): Promise<PortfolioDividendIncome | null> {
    // Get portfolio holdings
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        holdings: {
          include: {
            stock: {
              include: {
                fundamentalMetrics: true,
              },
            },
          },
        },
      },
    });

    if (!portfolio) {
      return null;
    }

    const holdingsWithDividends = await Promise.all(
      portfolio.holdings.map(async (holding) => {
        const summary = await this.getDividendSummary(holding.symbol);
        const annualDividend = summary?.annualDividend ?? 0;
        const expectedIncome = holding.shares * annualDividend;

        return {
          symbol: holding.symbol,
          stockName: holding.stock.name,
          shares: holding.shares,
          annualDividend,
          expectedIncome,
          yield: summary?.currentYield ?? null,
          frequency: summary?.frequency ?? null,
          nextExDate: summary?.nextExDate ?? null,
        };
      })
    );

    const totalAnnualIncome = holdingsWithDividends.reduce(
      (sum, h) => sum + h.expectedIncome,
      0
    );

    return {
      portfolioId,
      totalAnnualIncome,
      holdings: holdingsWithDividends,
    };
  }

  /**
   * Create or update a dividend event
   * 
   * @param input - Dividend event input
   * @returns The created or updated dividend event
   */
  async upsertDividendEvent(input: DividendEventInput): Promise<DividendEvent> {
    const normalizedSymbol = input.symbol.trim().toUpperCase();

    // Check if event exists for this symbol and ex-date
    const existing = await prisma.dividendEvent.findFirst({
      where: {
        symbol: normalizedSymbol,
        exDate: input.exDate,
      },
    });

    let event;
    if (existing) {
      event = await prisma.dividendEvent.update({
        where: { id: existing.id },
        data: {
          payDate: input.payDate,
          recordDate: input.recordDate,
          amount: input.amount,
          frequency: input.frequency ?? 'quarterly',
          yield: input.yield,
        },
        include: {
          stock: {
            select: {
              name: true,
            },
          },
        },
      });
    } else {
      event = await prisma.dividendEvent.create({
        data: {
          symbol: normalizedSymbol,
          exDate: input.exDate,
          payDate: input.payDate,
          recordDate: input.recordDate,
          amount: input.amount,
          frequency: input.frequency ?? 'quarterly',
          yield: input.yield,
        },
        include: {
          stock: {
            select: {
              name: true,
            },
          },
        },
      });
    }

    // Invalidate cache
    await this.invalidateCache(normalizedSymbol);

    return {
      id: event.id,
      symbol: event.symbol,
      stockName: event.stock.name,
      exDate: event.exDate,
      payDate: event.payDate,
      recordDate: event.recordDate,
      amount: event.amount,
      frequency: event.frequency as DividendFrequency,
      yield: event.yield,
      createdAt: event.createdAt,
    };
  }

  /**
   * Determine dividend frequency based on count
   */
  private determineFrequency(count: number): DividendFrequency | null {
    if (count >= 10) return 'monthly';
    if (count >= 3) return 'quarterly';
    if (count >= 2) return 'semi_annual';
    if (count >= 1) return 'annual';
    return null;
  }

  /**
   * Calculate consecutive years of dividend payments
   */
  private calculateConsecutiveYears(
    dividends: Array<{ exDate: Date }>
  ): number {
    if (dividends.length === 0) return 0;

    const years = new Set<number>();
    dividends.forEach((d) => years.add(d.exDate.getFullYear()));

    const sortedYears = Array.from(years).sort((a, b) => b - a);
    let consecutive = 0;
    const currentYear = new Date().getFullYear();

    for (let i = 0; i < sortedYears.length; i++) {
      if (sortedYears[i] === currentYear - i || sortedYears[i] === currentYear - i - 1) {
        consecutive++;
      } else {
        break;
      }
    }

    return consecutive;
  }

  /**
   * Build Prisma where clause from filters
   */
  private buildWhereClause(
    filters?: DividendCalendarFilters
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (!filters) {
      // Default to upcoming dividends
      where.exDate = { gte: new Date() };
      return where;
    }

    // Symbol filter
    if (filters.symbols && filters.symbols.length > 0) {
      where.symbol = {
        in: filters.symbols.map((s) => s.trim().toUpperCase()),
      };
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      where.exDate = {};
      if (filters.startDate) {
        (where.exDate as Record<string, Date>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.exDate as Record<string, Date>).lte = filters.endDate;
      }
    }

    // Yield filter
    if (filters.minYield !== undefined || filters.maxYield !== undefined) {
      where.yield = {};
      if (filters.minYield !== undefined) {
        (where.yield as Record<string, number>).gte = filters.minYield;
      }
      if (filters.maxYield !== undefined) {
        (where.yield as Record<string, number>).lte = filters.maxYield;
      }
    }

    return where;
  }

  /**
   * Invalidate cache for a symbol
   */
  private async invalidateCache(symbol: string): Promise<void> {
    try {
      await redisHelpers.del(CacheKeys.dividend.stock(symbol));
      logger.debug(`Dividend cache invalidated for: ${symbol}`);
    } catch (error) {
      logger.warn('Redis cache invalidation error:', error);
    }
  }
}

// Export singleton instance
export const dividendService = new DividendService();
