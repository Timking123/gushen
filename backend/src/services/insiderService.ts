import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';
import { CacheKeys, CacheTTL } from '../lib/cache-keys.js';
import { logger } from '../utils/logger.js';

/**
 * Transaction type for insider trades
 */
export type TransactionType = 'buy' | 'sell' | 'exercise';

/**
 * Insider trade interface
 * Represents a single insider trading record
 * 
 * Implements Requirements:
 * - 12.1: Display recent insider trading records
 * - 12.2: Record trader identity, transaction type, quantity, and price
 * - 12.4: Display trader position and historical trading records
 */
export interface InsiderTrade {
  id: string;
  symbol: string;
  filedAt: Date;
  tradeDate: Date;
  insiderName: string;
  insiderTitle: string | null;
  transactionType: TransactionType;
  shares: number;
  pricePerShare: number;
  totalValue: number;
  sharesOwned: number | null;
  createdAt: Date;
}

/**
 * Insider trade with stock information
 */
export interface InsiderTradeWithStock extends InsiderTrade {
  stockName?: string;
  sector?: string | null;
}

/**
 * Insider trading filter options
 * Implements Requirement 12.5: Support filtering by transaction type, amount, date
 */
export interface InsiderTradeFilters {
  symbol?: string;
  symbols?: string[];
  insiderName?: string;
  transactionTypes?: TransactionType[];
  startDate?: Date;
  endDate?: Date;
  minValue?: number;
  maxValue?: number;
  minShares?: number;
  maxShares?: number;
}

/**
 * Insider trading sort options
 */
export interface InsiderTradeSort {
  field: 'tradeDate' | 'filedAt' | 'totalValue' | 'shares' | 'insiderName';
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
 * Paginated insider trades response
 */
export interface InsiderTradesResponse {
  trades: InsiderTradeWithStock[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Insider trading trend data
 * Implements Requirement 12.6: Calculate net buy/sell trend
 */
export interface InsiderTradeTrend {
  symbol: string;
  period: string;
  totalBuyShares: number;
  totalSellShares: number;
  totalBuyValue: number;
  totalSellValue: number;
  netShares: number;
  netValue: number;
  buyTransactions: number;
  sellTransactions: number;
  exerciseTransactions: number;
}

/**
 * Insider summary for a specific insider
 */
export interface InsiderSummary {
  insiderName: string;
  insiderTitle: string | null;
  totalTrades: number;
  totalBuyShares: number;
  totalSellShares: number;
  totalBuyValue: number;
  totalSellValue: number;
  lastTradeDate: Date | null;
  trades: InsiderTrade[];
}

/**
 * InsiderService - Handles insider trading data operations
 * 
 * Implements Requirements:
 * - 12.1: WHEN 用户查看股票详情 THEN Insider_Tracker SHALL 显示近期内部交易记录
 * - 12.2: WHEN 内部人士买入或卖出股票 THEN Insider_Tracker SHALL 记录交易人身份、交易类型、数量和价格
 * - 12.4: WHEN 用户查看内部交易详情 THEN Insider_Tracker SHALL 显示交易人职位和历史交易记录
 * - 12.5: WHEN 用户浏览内部交易列表 THEN Insider_Tracker SHALL 支持按交易类型、金额、日期筛选
 * - 12.6: WHEN 分析内部交易 THEN Insider_Tracker SHALL 计算并显示内部人士净买入/卖出趋势
 */
export class InsiderService {
  /**
   * Get insider trades with optional filters and pagination
   * 
   * @param filters - Optional filter criteria
   * @param sort - Optional sort options
   * @param pagination - Pagination options
   * @returns Paginated insider trades
   * 
   * Implements Requirements 12.1, 12.2, 12.5
   */
  async getInsiderTrades(
    filters?: InsiderTradeFilters,
    sort?: InsiderTradeSort,
    pagination?: PaginationOptions
  ): Promise<InsiderTradesResponse> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    // Build where clause based on filters
    const where = this.buildWhereClause(filters);

    // Build order by clause
    const orderBy = this.buildOrderByClause(sort);

    // Get total count for pagination
    const total = await prisma.insiderTrade.count({ where });

    // Query insider trades with stock information
    const insiderTrades = await prisma.insiderTrade.findMany({
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
    const trades: InsiderTradeWithStock[] = insiderTrades.map((trade) => ({
      id: trade.id,
      symbol: trade.symbol,
      filedAt: trade.filedAt,
      tradeDate: trade.tradeDate,
      insiderName: trade.insiderName,
      insiderTitle: trade.insiderTitle,
      transactionType: trade.transactionType as TransactionType,
      shares: Number(trade.shares),
      pricePerShare: trade.pricePerShare,
      totalValue: trade.totalValue,
      sharesOwned: trade.sharesOwned ? Number(trade.sharesOwned) : null,
      createdAt: trade.createdAt,
      stockName: trade.stock.name,
      sector: trade.stock.sector,
    }));

    return {
      trades,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get insider trades for a specific stock symbol
   * 
   * @param symbol - Stock symbol
   * @param limit - Maximum number of trades to return
   * @returns Array of insider trades for the stock
   * 
   * Implements Requirement 12.1
   */
  async getInsiderTradesBySymbol(
    symbol: string,
    limit: number = 20
  ): Promise<InsiderTradeWithStock[]> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check cache first
    const cacheKey = CacheKeys.insider.stock(normalizedSymbol);
    try {
      const cachedTrades = await redisHelpers.getJson<InsiderTradeWithStock[]>(cacheKey);
      if (cachedTrades) {
        logger.debug(`Insider trades cache hit for: ${normalizedSymbol}`);
        return cachedTrades.slice(0, limit).map((trade) => ({
          ...trade,
          filedAt: new Date(trade.filedAt),
          tradeDate: new Date(trade.tradeDate),
          createdAt: new Date(trade.createdAt),
        }));
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Query insider trades for the symbol
    const insiderTrades = await prisma.insiderTrade.findMany({
      where: { symbol: normalizedSymbol },
      orderBy: { tradeDate: 'desc' },
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
    const trades: InsiderTradeWithStock[] = insiderTrades.map((trade) => ({
      id: trade.id,
      symbol: trade.symbol,
      filedAt: trade.filedAt,
      tradeDate: trade.tradeDate,
      insiderName: trade.insiderName,
      insiderTitle: trade.insiderTitle,
      transactionType: trade.transactionType as TransactionType,
      shares: Number(trade.shares),
      pricePerShare: trade.pricePerShare,
      totalValue: trade.totalValue,
      sharesOwned: trade.sharesOwned ? Number(trade.sharesOwned) : null,
      createdAt: trade.createdAt,
      stockName: trade.stock.name,
      sector: trade.stock.sector,
    }));

    // Cache the result
    try {
      await redisHelpers.setJson(cacheKey, trades, CacheTTL.insider);
      logger.debug(`Insider trades cached for: ${normalizedSymbol}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return trades.slice(0, limit);
  }

  /**
   * Get insider trades by a specific insider
   * 
   * @param insiderName - Name of the insider
   * @param symbol - Optional stock symbol to filter by
   * @param limit - Maximum number of trades to return
   * @returns Insider summary with trade history
   * 
   * Implements Requirement 12.4
   */
  async getInsiderTradesByInsider(
    insiderName: string,
    symbol?: string,
    limit: number = 50
  ): Promise<InsiderSummary> {
    const where: Record<string, unknown> = {
      insiderName: {
        contains: insiderName,
        mode: 'insensitive',
      },
    };

    if (symbol) {
      where.symbol = symbol.trim().toUpperCase();
    }

    // Query insider trades
    const insiderTrades = await prisma.insiderTrade.findMany({
      where,
      orderBy: { tradeDate: 'desc' },
      take: limit,
    });

    if (insiderTrades.length === 0) {
      return {
        insiderName,
        insiderTitle: null,
        totalTrades: 0,
        totalBuyShares: 0,
        totalSellShares: 0,
        totalBuyValue: 0,
        totalSellValue: 0,
        lastTradeDate: null,
        trades: [],
      };
    }

    // Calculate summary statistics
    let totalBuyShares = 0;
    let totalSellShares = 0;
    let totalBuyValue = 0;
    let totalSellValue = 0;

    const trades: InsiderTrade[] = insiderTrades.map((trade) => {
      const shares = Number(trade.shares);
      
      if (trade.transactionType === 'buy') {
        totalBuyShares += shares;
        totalBuyValue += trade.totalValue;
      } else if (trade.transactionType === 'sell') {
        totalSellShares += shares;
        totalSellValue += trade.totalValue;
      }

      return {
        id: trade.id,
        symbol: trade.symbol,
        filedAt: trade.filedAt,
        tradeDate: trade.tradeDate,
        insiderName: trade.insiderName,
        insiderTitle: trade.insiderTitle,
        transactionType: trade.transactionType as TransactionType,
        shares,
        pricePerShare: trade.pricePerShare,
        totalValue: trade.totalValue,
        sharesOwned: trade.sharesOwned ? Number(trade.sharesOwned) : null,
        createdAt: trade.createdAt,
      };
    });

    return {
      insiderName: insiderTrades[0].insiderName,
      insiderTitle: insiderTrades[0].insiderTitle,
      totalTrades: insiderTrades.length,
      totalBuyShares,
      totalSellShares,
      totalBuyValue,
      totalSellValue,
      lastTradeDate: insiderTrades[0].tradeDate,
      trades,
    };
  }

  /**
   * Calculate insider trading trend for a stock
   * 
   * @param symbol - Stock symbol
   * @param days - Number of days to analyze (default: 90)
   * @returns Insider trading trend data
   * 
   * Implements Requirement 12.6
   */
  async calculateInsiderTrend(
    symbol: string,
    days: number = 90
  ): Promise<InsiderTradeTrend> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Query insider trades for the period
    const insiderTrades = await prisma.insiderTrade.findMany({
      where: {
        symbol: normalizedSymbol,
        tradeDate: {
          gte: startDate,
        },
      },
    });

    // Calculate trend statistics
    let totalBuyShares = 0;
    let totalSellShares = 0;
    let totalBuyValue = 0;
    let totalSellValue = 0;
    let buyTransactions = 0;
    let sellTransactions = 0;
    let exerciseTransactions = 0;

    for (const trade of insiderTrades) {
      const shares = Number(trade.shares);
      
      switch (trade.transactionType) {
        case 'buy':
          totalBuyShares += shares;
          totalBuyValue += trade.totalValue;
          buyTransactions++;
          break;
        case 'sell':
          totalSellShares += shares;
          totalSellValue += trade.totalValue;
          sellTransactions++;
          break;
        case 'exercise':
          exerciseTransactions++;
          break;
      }
    }

    return {
      symbol: normalizedSymbol,
      period: `${days} days`,
      totalBuyShares,
      totalSellShares,
      totalBuyValue,
      totalSellValue,
      netShares: totalBuyShares - totalSellShares,
      netValue: totalBuyValue - totalSellValue,
      buyTransactions,
      sellTransactions,
      exerciseTransactions,
    };
  }

  /**
   * Get recent insider trades across all stocks
   * 
   * @param limit - Maximum number of trades to return
   * @returns Array of recent insider trades
   */
  async getRecentInsiderTrades(limit: number = 50): Promise<InsiderTradeWithStock[]> {
    // Check cache first
    const cacheKey = CacheKeys.insider.recent();
    try {
      const cachedTrades = await redisHelpers.getJson<InsiderTradeWithStock[]>(cacheKey);
      if (cachedTrades) {
        logger.debug('Recent insider trades cache hit');
        return cachedTrades.slice(0, limit).map((trade) => ({
          ...trade,
          filedAt: new Date(trade.filedAt),
          tradeDate: new Date(trade.tradeDate),
          createdAt: new Date(trade.createdAt),
        }));
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Query recent insider trades
    const insiderTrades = await prisma.insiderTrade.findMany({
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
    const trades: InsiderTradeWithStock[] = insiderTrades.map((trade) => ({
      id: trade.id,
      symbol: trade.symbol,
      filedAt: trade.filedAt,
      tradeDate: trade.tradeDate,
      insiderName: trade.insiderName,
      insiderTitle: trade.insiderTitle,
      transactionType: trade.transactionType as TransactionType,
      shares: Number(trade.shares),
      pricePerShare: trade.pricePerShare,
      totalValue: trade.totalValue,
      sharesOwned: trade.sharesOwned ? Number(trade.sharesOwned) : null,
      createdAt: trade.createdAt,
      stockName: trade.stock.name,
      sector: trade.stock.sector,
    }));

    // Cache the result
    try {
      await redisHelpers.setJson(cacheKey, trades, CacheTTL.insider);
      logger.debug('Recent insider trades cached');
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return trades.slice(0, limit);
  }

  /**
   * Get significant insider trades (large transactions)
   * 
   * @param minValue - Minimum transaction value
   * @param days - Number of days to look back
   * @param limit - Maximum number of trades to return
   * @returns Array of significant insider trades
   * 
   * Implements Requirement 12.3 (for identifying significant trades)
   */
  async getSignificantInsiderTrades(
    minValue: number = 100000,
    days: number = 30,
    limit: number = 50
  ): Promise<InsiderTradeWithStock[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const insiderTrades = await prisma.insiderTrade.findMany({
      where: {
        filedAt: {
          gte: startDate,
        },
        totalValue: {
          gte: minValue,
        },
      },
      orderBy: { totalValue: 'desc' },
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

    return insiderTrades.map((trade) => ({
      id: trade.id,
      symbol: trade.symbol,
      filedAt: trade.filedAt,
      tradeDate: trade.tradeDate,
      insiderName: trade.insiderName,
      insiderTitle: trade.insiderTitle,
      transactionType: trade.transactionType as TransactionType,
      shares: Number(trade.shares),
      pricePerShare: trade.pricePerShare,
      totalValue: trade.totalValue,
      sharesOwned: trade.sharesOwned ? Number(trade.sharesOwned) : null,
      createdAt: trade.createdAt,
      stockName: trade.stock.name,
      sector: trade.stock.sector,
    }));
  }

  /**
   * Create or update an insider trade record
   * 
   * @param tradeData - Insider trade data
   * @returns The created insider trade
   * 
   * Implements Requirement 12.2
   */
  async createInsiderTrade(tradeData: {
    symbol: string;
    filedAt: Date;
    tradeDate: Date;
    insiderName: string;
    insiderTitle?: string | null;
    transactionType: TransactionType;
    shares: number;
    pricePerShare: number;
    totalValue: number;
    sharesOwned?: number | null;
  }): Promise<InsiderTrade> {
    const normalizedSymbol = tradeData.symbol.trim().toUpperCase();

    const trade = await prisma.insiderTrade.create({
      data: {
        symbol: normalizedSymbol,
        filedAt: tradeData.filedAt,
        tradeDate: tradeData.tradeDate,
        insiderName: tradeData.insiderName,
        insiderTitle: tradeData.insiderTitle ?? null,
        transactionType: tradeData.transactionType,
        shares: BigInt(tradeData.shares),
        pricePerShare: tradeData.pricePerShare,
        totalValue: tradeData.totalValue,
        sharesOwned: tradeData.sharesOwned ? BigInt(tradeData.sharesOwned) : null,
      },
    });

    // Invalidate caches
    await this.invalidateCache(normalizedSymbol);

    return {
      id: trade.id,
      symbol: trade.symbol,
      filedAt: trade.filedAt,
      tradeDate: trade.tradeDate,
      insiderName: trade.insiderName,
      insiderTitle: trade.insiderTitle,
      transactionType: trade.transactionType as TransactionType,
      shares: Number(trade.shares),
      pricePerShare: trade.pricePerShare,
      totalValue: trade.totalValue,
      sharesOwned: trade.sharesOwned ? Number(trade.sharesOwned) : null,
      createdAt: trade.createdAt,
    };
  }

  /**
   * Bulk create insider trades (for SEC EDGAR data import)
   * 
   * @param trades - Array of insider trade data
   * @returns Number of trades created
   */
  async bulkCreateInsiderTrades(
    trades: Array<{
      symbol: string;
      filedAt: Date;
      tradeDate: Date;
      insiderName: string;
      insiderTitle?: string | null;
      transactionType: TransactionType;
      shares: number;
      pricePerShare: number;
      totalValue: number;
      sharesOwned?: number | null;
    }>
  ): Promise<number> {
    const data = trades.map((trade) => ({
      symbol: trade.symbol.trim().toUpperCase(),
      filedAt: trade.filedAt,
      tradeDate: trade.tradeDate,
      insiderName: trade.insiderName,
      insiderTitle: trade.insiderTitle ?? null,
      transactionType: trade.transactionType,
      shares: BigInt(trade.shares),
      pricePerShare: trade.pricePerShare,
      totalValue: trade.totalValue,
      sharesOwned: trade.sharesOwned ? BigInt(trade.sharesOwned) : null,
    }));

    const result = await prisma.insiderTrade.createMany({
      data,
      skipDuplicates: true,
    });

    // Invalidate caches for affected symbols
    const symbols = Array.from(new Set(trades.map((t) => t.symbol.trim().toUpperCase())));
    for (const symbol of symbols) {
      await this.invalidateCache(symbol);
    }

    return result.count;
  }

  /**
   * Build Prisma where clause from filters
   */
  private buildWhereClause(filters?: InsiderTradeFilters): Record<string, unknown> {
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

    // Insider name filter (partial match)
    if (filters.insiderName) {
      where.insiderName = {
        contains: filters.insiderName,
        mode: 'insensitive',
      };
    }

    // Transaction type filter
    if (filters.transactionTypes && filters.transactionTypes.length > 0) {
      where.transactionType = {
        in: filters.transactionTypes,
      };
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      where.tradeDate = {};
      if (filters.startDate) {
        (where.tradeDate as Record<string, Date>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.tradeDate as Record<string, Date>).lte = filters.endDate;
      }
    }

    // Value range filter
    if (filters.minValue !== undefined || filters.maxValue !== undefined) {
      where.totalValue = {};
      if (filters.minValue !== undefined) {
        (where.totalValue as Record<string, number>).gte = filters.minValue;
      }
      if (filters.maxValue !== undefined) {
        (where.totalValue as Record<string, number>).lte = filters.maxValue;
      }
    }

    // Shares range filter
    if (filters.minShares !== undefined || filters.maxShares !== undefined) {
      where.shares = {};
      if (filters.minShares !== undefined) {
        (where.shares as Record<string, bigint>).gte = BigInt(filters.minShares);
      }
      if (filters.maxShares !== undefined) {
        (where.shares as Record<string, bigint>).lte = BigInt(filters.maxShares);
      }
    }

    return where;
  }

  /**
   * Build Prisma orderBy clause from sort options
   */
  private buildOrderByClause(sort?: InsiderTradeSort): Record<string, string>[] {
    if (!sort) {
      // Default sort: by trade date descending
      return [{ tradeDate: 'desc' }];
    }

    const orderBy: Record<string, string>[] = [];

    switch (sort.field) {
      case 'tradeDate':
        orderBy.push({ tradeDate: sort.order });
        break;
      case 'filedAt':
        orderBy.push({ filedAt: sort.order });
        break;
      case 'totalValue':
        orderBy.push({ totalValue: sort.order });
        break;
      case 'shares':
        orderBy.push({ shares: sort.order });
        break;
      case 'insiderName':
        orderBy.push({ insiderName: sort.order });
        break;
      default:
        orderBy.push({ tradeDate: 'desc' });
    }

    return orderBy;
  }

  /**
   * Invalidate cache for a symbol
   */
  private async invalidateCache(symbol: string): Promise<void> {
    try {
      // Invalidate symbol-specific cache
      await redisHelpers.del(CacheKeys.insider.stock(symbol));
      // Invalidate recent trades cache
      await redisHelpers.del(CacheKeys.insider.recent());
      
      logger.debug(`Insider trades cache invalidated for symbol: ${symbol}`);
    } catch (error) {
      logger.warn('Redis cache invalidation error:', error);
    }
  }
}

// Export singleton instance
export const insiderService = new InsiderService();
