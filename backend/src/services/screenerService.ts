import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';
import { CacheKeys, CacheTTL } from '../lib/cache-keys.js';
import { logger } from '../utils/logger.js';

/**
 * Screener filters interface
 * Defines all possible filter criteria for stock screening
 * 
 * Implements Requirements:
 * - 10.2: 描述性筛选条件 (交易所、板块、市值范围、国家等)
 * - 10.3: 基本面筛选条件 (P/E、EPS增长率、股息率、负债率等)
 * - 10.4: 技术面筛选条件 (RSI、移动平均线、价格形态、成交量等)
 */
export interface ScreenerFilters {
  // Descriptive filters (Requirement 10.2)
  exchange?: string[];
  sector?: string[];
  industry?: string[];
  country?: string[];
  marketCapMin?: number;
  marketCapMax?: number;

  // Fundamental filters (Requirement 10.3)
  peMin?: number;
  peMax?: number;
  epsGrowthMin?: number;
  dividendYieldMin?: number;
  debtToEquityMax?: number;
  revenueGrowthMin?: number;
  roeMin?: number;
  currentRatioMin?: number;

  // Technical filters (Requirement 10.4)
  rsiMin?: number;
  rsiMax?: number;
  priceAboveSma20?: boolean;
  priceAboveSma50?: boolean;
  priceAboveSma200?: boolean;
  volumeAboveAvg?: boolean;
  
  // Data quality filters
  hideZeroPrice?: boolean;  // Filter out stocks with zero or null price
  maxChangePercent?: number;  // Maximum absolute change percent (e.g., 100 means ±100%)

  // Search filter
  search?: string;  // Search by symbol or name

  // Sorting (Requirement 10.7)
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';

  // Pagination
  page?: number;
  limit?: number;
}

/**
 * Screener result item interface
 * Represents a single stock in the screener results
 */
export interface ScreenerResultItem {
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  country: string | null;
  
  // Current price data
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  
  // Fundamental metrics
  pe: number | null;
  epsGrowth: number | null;
  dividendYield: number | null;
  debtToEquity: number | null;
  revenueGrowth: number | null;
  roe: number | null;
  
  // Technical indicators
  rsi14: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
}

/**
 * Screener result interface
 * Contains the filtered stocks and pagination info
 */
export interface ScreenerResult {
  stocks: ScreenerResultItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Screener template interface
 * Saved filter configurations
 */
export interface ScreenerTemplate {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  filters: ScreenerFilters;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ScreenerService - Handles stock screening with multiple filter criteria
 * 
 * Implements Requirements:
 * - 10.2: 描述性筛选条件
 * - 10.3: 基本面筛选条件
 * - 10.4: 技术面筛选条件
 * - 10.5: 实时显示符合条件的股票列表
 * - 10.6: 保存筛选条件为可复用模板
 * - 10.7: 支持按不同指标排序和分页浏览
 */
export class ScreenerService {
  /**
   * Execute stock screening with the provided filters
   * 
   * @param filters - Screening filters
   * @returns Screener result with filtered stocks and pagination
   * 
   * Implements Requirements:
   * - 10.2: 描述性筛选
   * - 10.3: 基本面筛选
   * - 10.4: 技术面筛选
   * - 10.5: 实时显示结果
   * - 10.7: 排序和分页
   */
  async screen(filters: ScreenerFilters): Promise<ScreenerResult> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100); // Cap at 100
    const skip = (page - 1) * limit;

    // Build where clause for Prisma query
    const whereClause: any = {};

    // Search filter - search by symbol or name
    if (filters.search && filters.search.trim()) {
      const searchTerm = filters.search.trim();
      whereClause.OR = [
        { symbol: { contains: searchTerm, mode: 'insensitive' } },
        { name: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    // Descriptive filters (Requirement 10.2)
    if (filters.exchange && filters.exchange.length > 0) {
      whereClause.exchange = { in: filters.exchange };
    }

    if (filters.sector && filters.sector.length > 0) {
      whereClause.sector = { in: filters.sector };
    }

    if (filters.industry && filters.industry.length > 0) {
      whereClause.industry = { in: filters.industry };
    }

    if (filters.country && filters.country.length > 0) {
      whereClause.country = { in: filters.country };
    }

    if (filters.marketCapMin !== undefined || filters.marketCapMax !== undefined) {
      whereClause.marketCap = {};
      if (filters.marketCapMin !== undefined) {
        whereClause.marketCap.gte = BigInt(filters.marketCapMin);
      }
      if (filters.marketCapMax !== undefined) {
        whereClause.marketCap.lte = BigInt(filters.marketCapMax);
      }
    }

    // Fundamental filters (Requirement 10.3)
    const fundamentalFilters: any = {};
    
    if (filters.peMin !== undefined || filters.peMax !== undefined) {
      fundamentalFilters.pe = {};
      if (filters.peMin !== undefined) {
        fundamentalFilters.pe.gte = filters.peMin;
      }
      if (filters.peMax !== undefined) {
        fundamentalFilters.pe.lte = filters.peMax;
      }
    }

    if (filters.epsGrowthMin !== undefined) {
      fundamentalFilters.epsGrowth = { gte: filters.epsGrowthMin };
    }

    if (filters.dividendYieldMin !== undefined) {
      fundamentalFilters.dividendYield = { gte: filters.dividendYieldMin };
    }

    if (filters.debtToEquityMax !== undefined) {
      fundamentalFilters.debtToEquity = { lte: filters.debtToEquityMax };
    }

    if (filters.revenueGrowthMin !== undefined) {
      fundamentalFilters.revenueGrowth = { gte: filters.revenueGrowthMin };
    }

    if (filters.roeMin !== undefined) {
      fundamentalFilters.roe = { gte: filters.roeMin };
    }

    if (filters.currentRatioMin !== undefined) {
      fundamentalFilters.currentRatio = { gte: filters.currentRatioMin };
    }

    // Add fundamental filters to where clause if any exist
    if (Object.keys(fundamentalFilters).length > 0) {
      whereClause.fundamentalMetrics = fundamentalFilters;
    }

    // Technical filters (Requirement 10.4)
    const technicalFilters: any = {};

    if (filters.rsiMin !== undefined || filters.rsiMax !== undefined) {
      technicalFilters.rsi14 = {};
      if (filters.rsiMin !== undefined) {
        technicalFilters.rsi14.gte = filters.rsiMin;
      }
      if (filters.rsiMax !== undefined) {
        technicalFilters.rsi14.lte = filters.rsiMax;
      }
    }

    // Add technical filters to where clause if any exist
    if (Object.keys(technicalFilters).length > 0) {
      whereClause.technicalIndicators = technicalFilters;
    }

    // Build orderBy clause (Requirement 10.7)
    const orderBy: any = this.buildOrderByClause(filters.sortBy, filters.sortOrder);

    logger.debug('Screener query:', { whereClause, orderBy, skip, limit, hideZeroPrice: filters.hideZeroPrice, search: filters.search });

    // If hideZeroPrice is enabled, we need to filter stocks with valid prices
    // This requires a different query approach since price is in the quotes relation
    // Filter out stocks with price < $0.01 (less than 1 cent)
    if (filters.hideZeroPrice) {
      // Add filter to only include stocks that have at least one quote with price >= 0.01
      whereClause.quotes = {
        some: {
          price: {
            gte: 0.01,  // At least 1 cent
          },
        },
      };
    }

    // For price/changePercent sorting, we need a different approach
    // We'll fetch all matching stocks first, then sort and paginate
    // Also need full query when maxChangePercent is set to get accurate total count
    const requiresQuoteSort = this.requiresPostQuerySort(filters.sortBy);
    const hasMaxChangePercentFilter = filters.maxChangePercent !== undefined && filters.maxChangePercent > 0;
    
    if (requiresQuoteSort || hasMaxChangePercentFilter) {
      // Fetch all matching stocks without pagination for proper sorting
      const allStocks = await prisma.stock.findMany({
        where: whereClause,
        include: {
          fundamentalMetrics: true,
          technicalIndicators: true,
          quotes: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      });

      // Post-process results for technical filters that require comparison with price
      let filteredStocks = allStocks;

      // Filter by price vs SMA comparisons (Requirement 10.4)
      if (filters.priceAboveSma20 !== undefined || 
          filters.priceAboveSma50 !== undefined || 
          filters.priceAboveSma200 !== undefined ||
          filters.volumeAboveAvg !== undefined) {
        
        filteredStocks = allStocks.filter(stock => {
          const quote = stock.quotes[0];
          const technicals = stock.technicalIndicators;

          if (!quote) return false;

          // Check price above SMA20
          if (filters.priceAboveSma20 !== undefined) {
            if (!technicals?.sma20) return false;
            const isAbove = quote.price > technicals.sma20;
            if (filters.priceAboveSma20 !== isAbove) return false;
          }

          // Check price above SMA50
          if (filters.priceAboveSma50 !== undefined) {
            if (!technicals?.sma50) return false;
            const isAbove = quote.price > technicals.sma50;
            if (filters.priceAboveSma50 !== isAbove) return false;
          }

          // Check price above SMA200
          if (filters.priceAboveSma200 !== undefined) {
            if (!technicals?.sma200) return false;
            const isAbove = quote.price > technicals.sma200;
            if (filters.priceAboveSma200 !== isAbove) return false;
          }

          // Check volume above average
          if (filters.volumeAboveAvg !== undefined) {
            if (!quote.avgVolume) return false;
            const isAbove = Number(quote.volume) > Number(quote.avgVolume);
            if (filters.volumeAboveAvg !== isAbove) return false;
          }

          return true;
        });
      }

      // Transform results with data validation
      const allResults: ScreenerResultItem[] = filteredStocks.map(stock => {
        const quote = stock.quotes[0];
        const fundamentals = stock.fundamentalMetrics;
        const technicals = stock.technicalIndicators;

        // Get raw change percent
        let changePercent = quote?.changePercent ?? null;
        let price = quote?.price ?? null;
        
        // Rule: If price is less than $0.01 (1 cent), treat as zero price stock
        if (price !== null && price < 0.01) {
          price = 0;
          changePercent = 0;
        }
        
        // Rule: If price is 0 or very small, change percent should be 0
        if (changePercent !== null && (price === null || price <= 0)) {
          changePercent = 0;
        }

        return {
          symbol: stock.symbol,
          name: stock.name,
          exchange: stock.exchange,
          sector: stock.sector,
          industry: stock.industry,
          marketCap: stock.marketCap ? Number(stock.marketCap) : null,
          country: stock.country,
          
          // Price data
          price: price,
          changePercent: changePercent,
          volume: quote ? Number(quote.volume) : null,
          
          // Fundamental metrics
          pe: fundamentals?.pe ?? null,
          epsGrowth: fundamentals?.epsGrowth ?? null,
          dividendYield: fundamentals?.dividendYield ?? null,
          debtToEquity: fundamentals?.debtToEquity ?? null,
          revenueGrowth: fundamentals?.revenueGrowth ?? null,
          roe: fundamentals?.roe ?? null,
          
          // Technical indicators
          rsi14: technicals?.rsi14 ?? null,
          sma20: technicals?.sma20 ?? null,
          sma50: technicals?.sma50 ?? null,
          sma200: technicals?.sma200 ?? null,
        };
      });

      // Filter by maxChangePercent if specified
      let filteredResults = allResults;
      if (filters.maxChangePercent !== undefined && filters.maxChangePercent > 0) {
        filteredResults = allResults.filter(stock => {
          if (stock.changePercent === null) return true; // Keep stocks without change data
          return Math.abs(stock.changePercent) <= filters.maxChangePercent!;
        });
      }

      // Sort all results by quote field
      const sortedResults = this.sortByQuoteField(filteredResults, filters.sortBy!, filters.sortOrder || 'desc');
      
      // Apply pagination after sorting
      const total = sortedResults.length;
      const paginatedResults = sortedResults.slice(skip, skip + limit);
      const totalPages = Math.ceil(total / limit);

      return {
        stocks: paginatedResults,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    }

    // Execute query with pagination
    const [stocks, total] = await Promise.all([
      prisma.stock.findMany({
        where: whereClause,
        include: {
          fundamentalMetrics: true,
          technicalIndicators: true,
          quotes: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.stock.count({ where: whereClause }),
    ]);

    // Post-process results for technical filters that require comparison with price
    let filteredStocks = stocks;

    // Filter by price vs SMA comparisons (Requirement 10.4)
    if (filters.priceAboveSma20 !== undefined || 
        filters.priceAboveSma50 !== undefined || 
        filters.priceAboveSma200 !== undefined ||
        filters.volumeAboveAvg !== undefined) {
      
      filteredStocks = stocks.filter(stock => {
        const quote = stock.quotes[0];
        const technicals = stock.technicalIndicators;

        if (!quote) return false;

        // Check price above SMA20
        if (filters.priceAboveSma20 !== undefined) {
          if (!technicals?.sma20) return false;
          const isAbove = quote.price > technicals.sma20;
          if (filters.priceAboveSma20 !== isAbove) return false;
        }

        // Check price above SMA50
        if (filters.priceAboveSma50 !== undefined) {
          if (!technicals?.sma50) return false;
          const isAbove = quote.price > technicals.sma50;
          if (filters.priceAboveSma50 !== isAbove) return false;
        }

        // Check price above SMA200
        if (filters.priceAboveSma200 !== undefined) {
          if (!technicals?.sma200) return false;
          const isAbove = quote.price > technicals.sma200;
          if (filters.priceAboveSma200 !== isAbove) return false;
        }

        // Check volume above average
        if (filters.volumeAboveAvg !== undefined) {
          if (!quote.avgVolume) return false;
          const isAbove = Number(quote.volume) > Number(quote.avgVolume);
          if (filters.volumeAboveAvg !== isAbove) return false;
        }

        return true;
      });
    }

    // Transform results with data validation
    const results: ScreenerResultItem[] = filteredStocks.map(stock => {
      const quote = stock.quotes[0];
      const fundamentals = stock.fundamentalMetrics;
      const technicals = stock.technicalIndicators;

      // Get raw change percent
      let changePercent = quote?.changePercent ?? null;
      let price = quote?.price ?? null;
      
      // Rule: If price is less than $0.01 (1 cent), treat as zero price stock
      if (price !== null && price < 0.01) {
        price = 0;
        changePercent = 0;
      }
      
      // Rule: If price is 0 or very small, change percent should be 0
      if (changePercent !== null && (price === null || price <= 0)) {
        changePercent = 0;
      }

      return {
        symbol: stock.symbol,
        name: stock.name,
        exchange: stock.exchange,
        sector: stock.sector,
        industry: stock.industry,
        marketCap: stock.marketCap ? Number(stock.marketCap) : null,
        country: stock.country,
        
        // Price data
        price: price,
        changePercent: changePercent,
        volume: quote ? Number(quote.volume) : null,
        
        // Fundamental metrics
        pe: fundamentals?.pe ?? null,
        epsGrowth: fundamentals?.epsGrowth ?? null,
        dividendYield: fundamentals?.dividendYield ?? null,
        debtToEquity: fundamentals?.debtToEquity ?? null,
        revenueGrowth: fundamentals?.revenueGrowth ?? null,
        roe: fundamentals?.roe ?? null,
        
        // Technical indicators
        rsi14: technicals?.rsi14 ?? null,
        sma20: technicals?.sma20 ?? null,
        sma50: technicals?.sma50 ?? null,
        sma200: technicals?.sma200 ?? null,
      };
    });

    // Filter by maxChangePercent if specified
    let filteredByChangePercent = results;
    if (filters.maxChangePercent !== undefined && filters.maxChangePercent > 0) {
      filteredByChangePercent = results.filter(stock => {
        if (stock.changePercent === null) return true; // Keep stocks without change data
        return Math.abs(stock.changePercent) <= filters.maxChangePercent!;
      });
    }

    // Apply post-query sorting for quote fields (price, changePercent)
    let sortedResults = filteredByChangePercent;
    if (this.requiresPostQuerySort(filters.sortBy)) {
      sortedResults = this.sortByQuoteField(filteredByChangePercent, filters.sortBy!, filters.sortOrder || 'desc');
    }

    // Calculate pagination - use filtered count for accurate total
    const filteredTotal = filters.maxChangePercent !== undefined && filters.maxChangePercent > 0 
      ? filteredByChangePercent.length 
      : total;
    const totalPages = Math.ceil(filteredTotal / limit);

    return {
      stocks: sortedResults,
      pagination: {
        page,
        limit,
        total: filteredTotal,
        totalPages,
      },
    };
  }

  /**
   * Build Prisma orderBy clause from sort parameters
   * 
   * @param sortBy - Field to sort by
   * @param sortOrder - Sort order (asc/desc)
   * @returns Prisma orderBy clause
   */
  private buildOrderByClause(sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc'): any {
    if (!sortBy) {
      // Default sort by market cap descending, with nulls last
      return [
        { marketCap: { sort: 'desc', nulls: 'last' } },
      ];
    }

    // Map sort fields to Prisma relations with nulls handling
    const sortFieldMap: Record<string, any> = {
      // Stock fields - use nulls: 'last' to put null values at the end
      symbol: [{ symbol: sortOrder }],
      name: [{ name: sortOrder }],
      marketCap: [{ marketCap: { sort: sortOrder, nulls: 'last' } }],
      
      // Fundamental fields
      pe: [{ fundamentalMetrics: { pe: sortOrder } }],
      epsGrowth: [{ fundamentalMetrics: { epsGrowth: sortOrder } }],
      dividendYield: [{ fundamentalMetrics: { dividendYield: sortOrder } }],
      debtToEquity: [{ fundamentalMetrics: { debtToEquity: sortOrder } }],
      revenueGrowth: [{ fundamentalMetrics: { revenueGrowth: sortOrder } }],
      roe: [{ fundamentalMetrics: { roe: sortOrder } }],
      
      // Technical fields
      rsi14: [{ technicalIndicators: { rsi14: sortOrder } }],
      sma20: [{ technicalIndicators: { sma20: sortOrder } }],
      sma50: [{ technicalIndicators: { sma50: sortOrder } }],
      sma200: [{ technicalIndicators: { sma200: sortOrder } }],
    };

    return sortFieldMap[sortBy] || [{ marketCap: { sort: 'desc', nulls: 'last' } }];
  }

  /**
   * Check if sort field requires post-query sorting (for quote fields)
   * @param sortBy - Field to sort by
   * @returns true if post-query sorting is needed
   */
  private requiresPostQuerySort(sortBy?: string): boolean {
    return sortBy === 'price' || sortBy === 'changePercent';
  }

  /**
   * Sort results by quote fields (price, changePercent)
   * @param results - Array of screener result items
   * @param sortBy - Field to sort by
   * @param sortOrder - Sort order
   * @returns Sorted array
   */
  private sortByQuoteField(
    results: ScreenerResultItem[],
    sortBy: string,
    sortOrder: 'asc' | 'desc'
  ): ScreenerResultItem[] {
    return [...results].sort((a, b) => {
      let aVal: number | null = null;
      let bVal: number | null = null;

      if (sortBy === 'price') {
        aVal = a.price;
        bVal = b.price;
      } else if (sortBy === 'changePercent') {
        aVal = a.changePercent;
        bVal = b.changePercent;
      }

      // Handle nulls - put them at the end
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      const diff = aVal - bVal;
      return sortOrder === 'asc' ? diff : -diff;
    });
  }

  /**
   * Save a screener template for a user
   * 
   * @param userId - User ID
   * @param template - Template data
   * @returns Created template
   * 
   * Implements Requirement 10.6: 保存筛选条件为可复用模板
   */
  async saveTemplate(
    userId: string,
    template: {
      name: string;
      description?: string;
      filters: ScreenerFilters;
    }
  ): Promise<ScreenerTemplate> {
    const created = await prisma.screenerTemplate.create({
      data: {
        userId,
        name: template.name,
        description: template.description || null,
        filters: template.filters as any, // JSON field
      },
    });

    // Invalidate user templates cache
    const cacheKey = CacheKeys.screener.templates(userId);
    try {
      await redisHelpers.del(cacheKey);
    } catch (error) {
      logger.warn('Redis cache invalidation error:', error);
    }

    return {
      id: created.id,
      userId: created.userId,
      name: created.name,
      description: created.description,
      filters: created.filters as ScreenerFilters,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  /**
   * Get all screener templates for a user
   * 
   * @param userId - User ID
   * @returns Array of templates
   * 
   * Implements Requirement 10.6: 加载保存的筛选模板
   */
  async getTemplates(userId: string): Promise<ScreenerTemplate[]> {
    // Check cache first
    const cacheKey = CacheKeys.screener.templates(userId);
    try {
      const cachedTemplates = await redisHelpers.getJson<ScreenerTemplate[]>(cacheKey);
      if (cachedTemplates) {
        logger.debug(`Screener templates cache hit for user: ${userId}`);
        // Convert date strings back to Date objects
        return cachedTemplates.map(t => ({
          ...t,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
        }));
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Query database
    const templates = await prisma.screenerTemplate.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const results: ScreenerTemplate[] = templates.map(t => ({
      id: t.id,
      userId: t.userId,
      name: t.name,
      description: t.description,
      filters: t.filters as ScreenerFilters,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    // Cache results
    try {
      await redisHelpers.setJson(cacheKey, results, CacheTTL.templates);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return results;
  }

  /**
   * Get a specific screener template by ID
   * 
   * @param userId - User ID
   * @param templateId - Template ID
   * @returns Template or null if not found
   */
  async getTemplate(userId: string, templateId: string): Promise<ScreenerTemplate | null> {
    const template = await prisma.screenerTemplate.findFirst({
      where: {
        id: templateId,
        userId,
      },
    });

    if (!template) {
      return null;
    }

    return {
      id: template.id,
      userId: template.userId,
      name: template.name,
      description: template.description,
      filters: template.filters as ScreenerFilters,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  /**
   * Update a screener template
   * 
   * @param userId - User ID
   * @param templateId - Template ID
   * @param updates - Template updates
   * @returns Updated template or null if not found
   */
  async updateTemplate(
    userId: string,
    templateId: string,
    updates: {
      name?: string;
      description?: string;
      filters?: ScreenerFilters;
    }
  ): Promise<ScreenerTemplate | null> {
    // Verify ownership
    const existing = await prisma.screenerTemplate.findFirst({
      where: { id: templateId, userId },
    });

    if (!existing) {
      return null;
    }

    const updated = await prisma.screenerTemplate.update({
      where: { id: templateId },
      data: {
        name: updates.name,
        description: updates.description,
        filters: updates.filters as any,
      },
    });

    // Invalidate cache
    const cacheKey = CacheKeys.screener.templates(userId);
    try {
      await redisHelpers.del(cacheKey);
    } catch (error) {
      logger.warn('Redis cache invalidation error:', error);
    }

    return {
      id: updated.id,
      userId: updated.userId,
      name: updated.name,
      description: updated.description,
      filters: updated.filters as ScreenerFilters,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Delete a screener template
   * 
   * @param userId - User ID
   * @param templateId - Template ID
   * @returns true if deleted, false if not found
   */
  async deleteTemplate(userId: string, templateId: string): Promise<boolean> {
    // Verify ownership
    const existing = await prisma.screenerTemplate.findFirst({
      where: { id: templateId, userId },
    });

    if (!existing) {
      return false;
    }

    await prisma.screenerTemplate.delete({
      where: { id: templateId },
    });

    // Invalidate cache
    const cacheKey = CacheKeys.screener.templates(userId);
    try {
      await redisHelpers.del(cacheKey);
    } catch (error) {
      logger.warn('Redis cache invalidation error:', error);
    }

    return true;
  }
}

// Export singleton instance
export const screenerService = new ScreenerService();
