import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';
import { CacheKeys, CacheTTL } from '../lib/cache-keys.js';
import { logger } from '../utils/logger.js';

/**
 * SEC form types
 */
export type SECFormType = '10-K' | '10-Q' | '8-K' | '4' | 'S-1' | 'DEF 14A' | '13F' | 'SC 13G' | 'SC 13D' | 'Other';

/**
 * SEC filing interface
 * Implements Requirement 20.1: Display recent SEC filings (10-K, 10-Q, 8-K, etc.)
 */
export interface SECFiling {
  id: string;
  symbol: string;
  formType: SECFormType;
  filedAt: Date;
  periodOfReport: Date | null;
  url: string;
  summary: string | null;
  createdAt: Date;
}

/**
 * SEC filing with stock information
 */
export interface SECFilingWithStock extends SECFiling {
  stockName?: string;
  sector?: string | null;
}

/**
 * SEC filing filter options
 * Implements Requirement 20.5: Support filtering by form type and date range
 */
export interface SECFilingFilters {
  symbol?: string;
  symbols?: string[];
  formTypes?: SECFormType[];
  startDate?: Date;
  endDate?: Date;
}

/**
 * SEC filing sort options
 */
export interface SECFilingSort {
  field: 'filedAt' | 'formType' | 'symbol';
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
 * Paginated SEC filings response
 */
export interface SECFilingsResponse {
  filings: SECFilingWithStock[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * SECFilingService - Handles SEC filing data operations
 * 
 * Implements Requirements:
 * - 20.1: WHEN 用户查看股票详情 THEN News_Aggregator SHALL 显示最近的 SEC 文件列表（10-K、10-Q、8-K 等）
 * - 20.5: WHEN 用户筛选 SEC 文件 THEN News_Aggregator SHALL 支持按文件类型和日期范围筛选
 */
export class SECFilingService {
  /**
   * Get SEC filings with optional filters and pagination
   * 
   * @param filters - Optional filter criteria
   * @param sort - Optional sort options
   * @param pagination - Pagination options
   * @returns Paginated SEC filings
   * 
   * Implements Requirements 20.1, 20.5
   */
  async getSECFilings(
    filters?: SECFilingFilters,
    sort?: SECFilingSort,
    pagination?: PaginationOptions
  ): Promise<SECFilingsResponse> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    // Build where clause based on filters
    const where = this.buildWhereClause(filters);

    // Build order by clause
    const orderBy = this.buildOrderByClause(sort);

    // Get total count for pagination
    const total = await prisma.sECFiling.count({ where });

    // Query SEC filings with stock information
    const secFilings = await prisma.sECFiling.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        stock: {
          select: {
            name: true,
            sector: true,
          },
        },
      },
    });

    // Transform to response format
    const filings: SECFilingWithStock[] = secFilings.map((filing) => ({
      id: filing.id,
      symbol: filing.symbol,
      formType: filing.formType as SECFormType,
      filedAt: filing.filedAt,
      periodOfReport: filing.periodOfReport,
      url: filing.url,
      summary: filing.summary,
      createdAt: filing.createdAt,
      stockName: filing.stock.name,
      sector: filing.stock.sector,
    }));

    return {
      filings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get SEC filings for a specific stock symbol
   * 
   * @param symbol - Stock symbol
   * @param formTypes - Optional form types to filter
   * @param limit - Maximum number of filings to return
   * @returns Array of SEC filings for the stock
   * 
   * Implements Requirement 20.1
   */
  async getSECFilingsBySymbol(
    symbol: string,
    formTypes?: SECFormType[],
    limit: number = 20
  ): Promise<SECFilingWithStock[]> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check cache first (only if no form type filter)
    if (!formTypes || formTypes.length === 0) {
      const cacheKey = CacheKeys.sec.filings(normalizedSymbol);
      try {
        const cachedFilings = await redisHelpers.getJson<SECFilingWithStock[]>(cacheKey);
        if (cachedFilings) {
          logger.debug(`SEC filings cache hit for: ${normalizedSymbol}`);
          return cachedFilings.slice(0, limit).map((filing) => ({
            ...filing,
            filedAt: new Date(filing.filedAt),
            periodOfReport: filing.periodOfReport ? new Date(filing.periodOfReport) : null,
            createdAt: new Date(filing.createdAt),
          }));
        }
      } catch (error) {
        logger.warn('Redis cache read error:', error);
      }
    }

    // Build where clause
    const where: Record<string, unknown> = { symbol: normalizedSymbol };
    if (formTypes && formTypes.length > 0) {
      where.formType = { in: formTypes };
    }

    // Query SEC filings for the symbol
    const secFilings = await prisma.sECFiling.findMany({
      where,
      orderBy: { filedAt: 'desc' },
      take: Math.max(limit, 50), // Cache more than requested
      include: {
        stock: {
          select: {
            name: true,
            sector: true,
          },
        },
      },
    });

    // Transform to response format
    const filings: SECFilingWithStock[] = secFilings.map((filing) => ({
      id: filing.id,
      symbol: filing.symbol,
      formType: filing.formType as SECFormType,
      filedAt: filing.filedAt,
      periodOfReport: filing.periodOfReport,
      url: filing.url,
      summary: filing.summary,
      createdAt: filing.createdAt,
      stockName: filing.stock.name,
      sector: filing.stock.sector,
    }));

    // Cache the result (only if no form type filter)
    if (!formTypes || formTypes.length === 0) {
      const cacheKey = CacheKeys.sec.filings(normalizedSymbol);
      try {
        await redisHelpers.setJson(cacheKey, filings, CacheTTL.secFilings);
        logger.debug(`SEC filings cached for: ${normalizedSymbol}`);
      } catch (error) {
        logger.warn('Redis cache write error:', error);
      }
    }

    return filings.slice(0, limit);
  }

  /**
   * Get recent SEC filings across all stocks
   * 
   * @param formTypes - Optional form types to filter
   * @param limit - Maximum number of filings to return
   * @returns Array of recent SEC filings
   */
  async getRecentSECFilings(
    formTypes?: SECFormType[],
    limit: number = 50
  ): Promise<SECFilingWithStock[]> {
    // Check cache first (only if no form type filter)
    if (!formTypes || formTypes.length === 0) {
      const cacheKey = CacheKeys.sec.recent();
      try {
        const cachedFilings = await redisHelpers.getJson<SECFilingWithStock[]>(cacheKey);
        if (cachedFilings) {
          logger.debug('Recent SEC filings cache hit');
          return cachedFilings.slice(0, limit).map((filing) => ({
            ...filing,
            filedAt: new Date(filing.filedAt),
            periodOfReport: filing.periodOfReport ? new Date(filing.periodOfReport) : null,
            createdAt: new Date(filing.createdAt),
          }));
        }
      } catch (error) {
        logger.warn('Redis cache read error:', error);
      }
    }

    // Build where clause
    const where: Record<string, unknown> = {};
    if (formTypes && formTypes.length > 0) {
      where.formType = { in: formTypes };
    }

    // Query recent SEC filings
    const secFilings = await prisma.sECFiling.findMany({
      where,
      orderBy: { filedAt: 'desc' },
      take: Math.max(limit, 100), // Cache more than requested
      include: {
        stock: {
          select: {
            name: true,
            sector: true,
          },
        },
      },
    });

    // Transform to response format
    const filings: SECFilingWithStock[] = secFilings.map((filing) => ({
      id: filing.id,
      symbol: filing.symbol,
      formType: filing.formType as SECFormType,
      filedAt: filing.filedAt,
      periodOfReport: filing.periodOfReport,
      url: filing.url,
      summary: filing.summary,
      createdAt: filing.createdAt,
      stockName: filing.stock.name,
      sector: filing.stock.sector,
    }));

    // Cache the result (only if no form type filter)
    if (!formTypes || formTypes.length === 0) {
      const cacheKey = CacheKeys.sec.recent();
      try {
        await redisHelpers.setJson(cacheKey, filings, CacheTTL.secFilings);
        logger.debug('Recent SEC filings cached');
      } catch (error) {
        logger.warn('Redis cache write error:', error);
      }
    }

    return filings.slice(0, limit);
  }

  /**
   * Get a specific SEC filing by ID
   * 
   * @param filingId - Filing ID
   * @returns SEC filing or null if not found
   */
  async getSECFilingById(filingId: string): Promise<SECFilingWithStock | null> {
    const filing = await prisma.sECFiling.findUnique({
      where: { id: filingId },
      include: {
        stock: {
          select: {
            name: true,
            sector: true,
          },
        },
      },
    });

    if (!filing) {
      return null;
    }

    return {
      id: filing.id,
      symbol: filing.symbol,
      formType: filing.formType as SECFormType,
      filedAt: filing.filedAt,
      periodOfReport: filing.periodOfReport,
      url: filing.url,
      summary: filing.summary,
      createdAt: filing.createdAt,
      stockName: filing.stock.name,
      sector: filing.stock.sector,
    };
  }

  /**
   * Create a new SEC filing record
   * 
   * @param filingData - SEC filing data
   * @returns The created SEC filing
   */
  async createSECFiling(filingData: {
    symbol: string;
    formType: SECFormType;
    filedAt: Date;
    periodOfReport?: Date | null;
    url: string;
    title?: string;
    summary?: string | null;
  }): Promise<SECFiling> {
    const normalizedSymbol = filingData.symbol.trim().toUpperCase();

    const filing = await prisma.sECFiling.create({
      data: {
        symbol: normalizedSymbol,
        formType: filingData.formType,
        filedAt: filingData.filedAt,
        periodOfReport: filingData.periodOfReport ?? null,
        url: filingData.url,
        summary: filingData.summary ?? null,
      },
    });

    // Invalidate caches
    await this.invalidateCache(normalizedSymbol);

    return {
      id: filing.id,
      symbol: filing.symbol,
      formType: filing.formType as SECFormType,
      filedAt: filing.filedAt,
      periodOfReport: filing.periodOfReport,
      url: filing.url,
      summary: filing.summary,
      createdAt: filing.createdAt,
    };
  }

  /**
   * Update SEC filing summary (for AI-generated summaries)
   * 
   * @param filingId - Filing ID
   * @param summary - AI-generated summary
   * @returns Updated SEC filing
   * 
   * Implements Requirement 20.4
   */
  async updateSECFilingSummary(
    filingId: string,
    summary: string
  ): Promise<SECFiling | null> {
    const filing = await prisma.sECFiling.update({
      where: { id: filingId },
      data: { summary },
    });

    // Invalidate caches
    await this.invalidateCache(filing.symbol);

    return {
      id: filing.id,
      symbol: filing.symbol,
      formType: filing.formType as SECFormType,
      filedAt: filing.filedAt,
      periodOfReport: filing.periodOfReport,
      url: filing.url,
      summary: filing.summary,
      createdAt: filing.createdAt,
    };
  }

  /**
   * Bulk create SEC filings (for SEC EDGAR data import)
   * 
   * @param filings - Array of SEC filing data
   * @returns Number of filings created
   */
  async bulkCreateSECFilings(
    filings: Array<{
      symbol: string;
      formType: SECFormType;
      filedAt: Date;
      periodOfReport?: Date | null;
      url: string;
      summary?: string | null;
    }>
  ): Promise<number> {
    const data = filings.map((filing) => ({
      symbol: filing.symbol.trim().toUpperCase(),
      formType: filing.formType,
      filedAt: filing.filedAt,
      periodOfReport: filing.periodOfReport ?? null,
      url: filing.url,
      summary: filing.summary ?? null,
    }));

    const result = await prisma.sECFiling.createMany({
      data,
      skipDuplicates: true,
    });

    // Invalidate caches for affected symbols
    const symbols = Array.from(new Set(filings.map((f) => f.symbol.trim().toUpperCase())));
    for (const symbol of symbols) {
      await this.invalidateCache(symbol);
    }

    return result.count;
  }

  /**
   * Get form type description
   * 
   * @param formType - SEC form type
   * @returns Description of the form type
   */
  getFormTypeDescription(formType: SECFormType): string {
    const descriptions: Record<SECFormType, string> = {
      '10-K': '年度报告 - 公司年度财务状况和经营成果的全面报告',
      '10-Q': '季度报告 - 公司季度财务状况的报告',
      '8-K': '重大事件报告 - 公司重大事件的即时披露',
      '4': '内部人士交易报告 - 公司内部人士股票交易的披露',
      'S-1': '注册声明 - 公司首次公开发行股票的注册文件',
      'DEF 14A': '委托书 - 股东大会相关信息和投票事项',
      '13F': '机构持仓报告 - 机构投资者的持仓披露',
      'SC 13G': '被动投资者持仓报告 - 被动投资者超过5%持仓的披露',
      'SC 13D': '主动投资者持仓报告 - 主动投资者超过5%持仓的披露',
      'Other': '其他SEC文件',
    };
    return descriptions[formType] || '其他SEC文件';
  }

  /**
   * Build Prisma where clause from filters
   */
  private buildWhereClause(filters?: SECFilingFilters): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (!filters) {
      return where;
    }

    // Single symbol filter
    if (filters.symbol) {
      where.symbol = filters.symbol.trim().toUpperCase();
    }

    // Multiple symbols filter
    if (filters.symbols && filters.symbols.length > 0) {
      where.symbol = {
        in: filters.symbols.map((s) => s.trim().toUpperCase()),
      };
    }

    // Form type filter
    if (filters.formTypes && filters.formTypes.length > 0) {
      where.formType = {
        in: filters.formTypes,
      };
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      where.filedAt = {};
      if (filters.startDate) {
        (where.filedAt as Record<string, Date>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.filedAt as Record<string, Date>).lte = filters.endDate;
      }
    }

    return where;
  }

  /**
   * Build Prisma orderBy clause from sort options
   */
  private buildOrderByClause(sort?: SECFilingSort): Record<string, string>[] {
    if (!sort) {
      // Default sort: by filed date descending
      return [{ filedAt: 'desc' }];
    }

    const orderBy: Record<string, string>[] = [];

    switch (sort.field) {
      case 'filedAt':
        orderBy.push({ filedAt: sort.order });
        break;
      case 'formType':
        orderBy.push({ formType: sort.order });
        break;
      case 'symbol':
        orderBy.push({ symbol: sort.order });
        break;
      default:
        orderBy.push({ filedAt: 'desc' });
    }

    return orderBy;
  }

  /**
   * Invalidate cache for a symbol
   */
  private async invalidateCache(symbol: string): Promise<void> {
    try {
      // Invalidate symbol-specific cache
      await redisHelpers.del(CacheKeys.sec.filings(symbol));
      // Invalidate recent filings cache
      await redisHelpers.del(CacheKeys.sec.recent());
      
      logger.debug(`SEC filings cache invalidated for symbol: ${symbol}`);
    } catch (error) {
      logger.warn('Redis cache invalidation error:', error);
    }
  }
}

// Export singleton instance
export const secFilingService = new SECFilingService();
