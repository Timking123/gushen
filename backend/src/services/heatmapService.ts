import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';
import { CacheKeys, CacheTTL } from '../lib/cache-keys.js';
import { logger } from '../utils/logger.js';
import { appConfig } from '../config/loader.js';

/**
 * Heatmap data item interface
 * Represents a single stock in the heatmap
 */
export interface HeatmapItem {
  symbol: string;
  name: string;
  sector: string;
  industry: string | null;
  marketCap: number;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

/**
 * Heatmap group interface
 * Represents a group of stocks (by sector or market cap)
 */
export interface HeatmapGroup {
  name: string;
  totalMarketCap: number;
  avgChangePercent: number;
  stockCount: number;
  items: HeatmapItem[];
}

/**
 * Heatmap response interface
 */
export interface HeatmapResponse {
  groupBy: 'sector' | 'marketCap' | 'industry';
  groups: HeatmapGroup[];
  totalStocks: number;
  lastUpdated: string;
  dataIntegrity: DataIntegrityInfo;
}

/**
 * Data integrity information
 * Implements Requirement 12.3: Display total stock count and last update time
 * Implements Requirement 3.5: Report excluded zero-price stock count
 */
export interface DataIntegrityInfo {
  isComplete: boolean;
  totalGroupsWithData: number;
  totalGroupsEmpty: number;
  minStocksPerGroup: number;
  warnings: string[];
  /** Number of stocks excluded due to zero/null price (Requirement 3.5) */
  excludedZeroPriceCount: number;
}

/**
 * Industry info interface
 * Represents industry metadata for filtering
 */
export interface IndustryInfo {
  name: string;
  sector: string;
  stockCount: number;
}

/**
 * Market cap tier for grouping
 */
export type MarketCapTier = 'mega' | 'large' | 'mid' | 'small' | 'micro';

/**
 * Get market cap tier label from configuration
 */
function getMarketCapTierLabel(tier: MarketCapTier): string {
  const tierConfig = appConfig.marketCap.tiers[tier];
  return tierConfig ? tierConfig.label : tier;
}

/**
 * Determine market cap tier for a stock using configuration
 */
function getMarketCapTier(marketCap: number): MarketCapTier {
  const tiers = appConfig.marketCap.tiers;
  if (marketCap >= tiers.mega.threshold) return 'mega';
  if (marketCap >= tiers.large.threshold) return 'large';
  if (marketCap >= tiers.mid.threshold) return 'mid';
  if (marketCap >= tiers.small.threshold) return 'small';
  return 'micro';
}

/**
 * Unified zero-price stock detection (Requirement 3.1)
 * A stock is considered "zero price" if its price is:
 * - exactly 0
 * - null or undefined
 * - less than $0.01 (sub-penny)
 */
export function isZeroPrice(price: number | null | undefined): boolean {
  return price === null || price === undefined || price < 0.01;
}

/**
 * Heatmap filter options interface
 */
export interface HeatmapFilters {
  sectors?: string[];
  industries?: string[];
  minMarketCap?: number;
  maxMarketCap?: number;
  hideZeroPrice?: boolean;  // New: Option to hide stocks with zero price
}

/**
 * HeatmapService - Handles market heatmap data operations
 * Implements Requirements 4.4, 18.2, 18.6, 14.1, 14.2, 14.3, 14.4, 14.6:
 * - 4.4: Display sector heatmap showing stock performance
 * - 18.2: Show color intensity based on price change
 * - 18.6: Support grouping by market cap, sector, etc.
 * - 14.1: Display sector/industry filter dropdown
 * - 14.2: Filter by sector
 * - 14.3: Filter by industry
 * - 14.4: Show all stocks when "All" is selected
 * - 14.6: Support multi-select sector filtering
 */
/**
 * Pagination options for heatmap queries (Requirement 7.3)
 */
export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedHeatmapResponse extends HeatmapResponse {
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class HeatmapService {
  /**
   * Get heatmap data grouped by sector, market cap, or industry
   * Supports filtering by sectors, industries, and market cap range
   * Supports pagination for large result sets (Requirement 7.3)
   *
   * @param groupBy - Grouping method ('sector', 'marketCap', or 'industry')
   * @param filters - Optional filter criteria
   * @param limit - Maximum number of stocks per group (default: 50)
   * @param pagination - Optional pagination options
   * @returns Heatmap data with groups
   */
  async getHeatmapData(
    groupBy: 'sector' | 'marketCap' | 'industry' = 'sector',
    filters: HeatmapFilters = {},
    limit: number = 50,
    pagination?: PaginationOptions
  ): Promise<HeatmapResponse | PaginatedHeatmapResponse> {
    // Generate cache key including filters
    const filterKey = JSON.stringify(filters);
    const cacheKey = CacheKeys.market.heatmap 
      ? `${CacheKeys.market.heatmap()}:${groupBy}:${filterKey}` 
      : `heatmap:${groupBy}:${filterKey}`;
    
    try {
      const cachedData = await redisHelpers.getJson<HeatmapResponse>(cacheKey);
      if (cachedData) {
        logger.debug(`Heatmap cache hit for groupBy: ${groupBy}, filters: ${filterKey}`);
        return cachedData;
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Fetch stocks with their latest quotes
    let stocksWithQuotes = await this.fetchStocksWithQuotes();
    
    // Count zero-price stocks before filtering (Requirement 3.5)
    const zeroPriceCountBeforeFilter = stocksWithQuotes.filter(item => isZeroPrice(item.price)).length;

    // Apply filters
    stocksWithQuotes = this.applyFilters(stocksWithQuotes, filters);

    // Calculate how many zero-price stocks were excluded by hideZeroPrice filter
    const zeroPriceCountAfterFilter = stocksWithQuotes.filter(item => isZeroPrice(item.price)).length;
    const excludedZeroPriceCount = filters.hideZeroPrice === true
      ? zeroPriceCountBeforeFilter - zeroPriceCountAfterFilter
      : 0;

    // Group the data based on groupBy parameter
    let groups: HeatmapGroup[];
    switch (groupBy) {
      case 'sector':
        groups = this.groupBySector(stocksWithQuotes, limit);
        break;
      case 'marketCap':
        groups = this.groupByMarketCap(stocksWithQuotes, limit);
        break;
      case 'industry':
        groups = this.groupByIndustry(stocksWithQuotes, limit);
        break;
      default:
        groups = this.groupBySector(stocksWithQuotes, limit);
    }

    // Calculate data integrity information (Requirement 3.5)
    const dataIntegrity = this.calculateDataIntegrity(groups, limit, excludedZeroPriceCount);

    const response: HeatmapResponse = {
      groupBy,
      groups,
      totalStocks: stocksWithQuotes.length,
      lastUpdated: new Date().toISOString(),
      dataIntegrity,
    };

    // Apply pagination if requested (Requirement 7.3)
    if (pagination) {
      const page = Math.max(1, pagination.page || 1);
      const pageSize = Math.min(100, Math.max(1, pagination.pageSize || 20));
      const totalItems = groups.length;
      const totalPages = Math.ceil(totalItems / pageSize);
      const startIdx = (page - 1) * pageSize;
      const endIdx = startIdx + pageSize;

      const paginatedResponse: PaginatedHeatmapResponse = {
        ...response,
        groups: groups.slice(startIdx, endIdx),
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };

      // Cache the result
      try {
        await redisHelpers.setJson(cacheKey, paginatedResponse, CacheTTL.quote || 60);
        logger.debug(`Heatmap data cached for groupBy: ${groupBy} (page ${page})`);
      } catch (error) {
        logger.warn('Redis cache write error:', error);
      }

      return paginatedResponse;
    }

    // Cache the result
    try {
      await redisHelpers.setJson(cacheKey, response, CacheTTL.quote || 60);
      logger.debug(`Heatmap data cached for groupBy: ${groupBy}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return response;
  }

  /**
   * Fetch all stocks with their latest quotes in a single query (Requirement 7.1)
   * Uses Prisma include to merge two separate queries into one
   * Records query execution time for performance monitoring (Requirement 7.5)
   */
  private async fetchStocksWithQuotes(): Promise<HeatmapItem[]> {
    const startTime = Date.now();

    // Single query: fetch stocks with their latest quote included (Requirement 7.1)
    const stocks = await prisma.stock.findMany({
      where: {
        sector: { not: null },
        marketCap: { not: null },
      },
      select: {
        symbol: true,
        name: true,
        sector: true,
        industry: true,
        marketCap: true,
        quotes: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: {
            price: true,
            change: true,
            changePercent: true,
            volume: true,
            previousClose: true,
          },
        },
      },
    });

    const queryTime = Date.now() - startTime;
    logger.debug(`fetchStocksWithQuotes query completed in ${queryTime}ms, fetched ${stocks.length} stocks`);

    // Combine stock and quote data with validation
    const items: HeatmapItem[] = [];
    for (const stock of stocks) {
      const quote = stock.quotes[0];
      if (quote && stock.sector && stock.marketCap) {
        // Validate and sanitize change percent
        let changePercent = quote.changePercent;
        let price = quote.price;

        // Rule 0: Use unified zero-price detection (Requirement 3.1)
        if (isZeroPrice(price)) {
          price = 0;
          changePercent = 0;
        }

        // Rule 1: If price is 0 or null, change percent cannot be positive
        if (price <= 0 && changePercent > 0) {
          changePercent = 0;
        }

        // Rule 2: Cap extreme change percentages (anything over 1000% is likely data error)
        if (Math.abs(changePercent) > 1000) {
          const previousClose = quote.previousClose;
          if (previousClose && previousClose > 0 && price > 0) {
            changePercent = ((price - previousClose) / previousClose) * 100;
          } else {
            changePercent = Math.sign(changePercent) * 100;
          }
        }

        // Rule 3: If price is very small (penny stock), be more conservative
        if (price > 0 && price < 0.01 && Math.abs(changePercent) > 100) {
          changePercent = Math.sign(changePercent) * 100;
        }

        items.push({
          symbol: stock.symbol,
          name: stock.name,
          sector: stock.sector,
          industry: stock.industry,
          marketCap: Number(stock.marketCap),
          price: price,
          change: price === 0 ? 0 : quote.change,
          changePercent: changePercent,
          volume: Number(quote.volume),
        });
      }
    }

    return items;
  }

  /**
   * Apply filters to heatmap items
   * Implements Requirements 14.2, 14.3, 14.4, 14.6:
   * - 14.2: Filter by sector
   * - 14.3: Filter by industry
   * - 14.4: Show all when no filter selected
   * - 14.6: Support multi-select filtering
   * 
   * @param items - Array of heatmap items to filter
   * @param filters - Filter criteria
   * @returns Filtered array of heatmap items
   */
  private applyFilters(items: HeatmapItem[], filters: HeatmapFilters): HeatmapItem[] {
    let filtered = items;

    // Filter by sectors (multi-select)
    if (filters.sectors && filters.sectors.length > 0) {
      const sectorSet = new Set(filters.sectors.map(s => s.toLowerCase()));
      filtered = filtered.filter(item => 
        sectorSet.has(item.sector.toLowerCase())
      );
    }

    // Filter by industries (multi-select)
    if (filters.industries && filters.industries.length > 0) {
      const industrySet = new Set(filters.industries.map(i => i.toLowerCase()));
      filtered = filtered.filter(item => 
        item.industry && industrySet.has(item.industry.toLowerCase())
      );
    }

    // Filter by minimum market cap
    if (filters.minMarketCap !== undefined && filters.minMarketCap !== null) {
      filtered = filtered.filter(item => item.marketCap >= filters.minMarketCap!);
    }

    // Filter by maximum market cap
    if (filters.maxMarketCap !== undefined && filters.maxMarketCap !== null) {
      filtered = filtered.filter(item => item.marketCap <= filters.maxMarketCap!);
    }

    // Filter out stocks with zero or null price when hideZeroPrice is true (Requirement 3.3, 3.4)
    // Default behavior: do NOT hide zero-price stocks unless explicitly requested
    if (filters.hideZeroPrice === true) {
      filtered = filtered.filter(item => !isZeroPrice(item.price));
    }

    return filtered;
  }

  /**
   * Calculate data integrity information for heatmap response
   * Implements Requirements 12.1, 12.2, 12.3, 12.4:
   * - 12.1: Display all major sector stock data
   * - 12.2: Ensure each sector shows at least top 50 stocks by market cap
   * - 12.3: Display total stock count and last update time
   * - 12.4: Show "loading" or "no data" for missing data
   * 
   * @param groups - Array of heatmap groups
   * @param expectedMinStocks - Expected minimum stocks per group
   * @returns Data integrity information
   */
  private calculateDataIntegrity(groups: HeatmapGroup[], expectedMinStocks: number, excludedZeroPriceCount: number = 0): DataIntegrityInfo {
    const warnings: string[] = [];
    let totalGroupsWithData = 0;
    let totalGroupsEmpty = 0;
    let minStocksPerGroup = Infinity;

    for (const group of groups) {
      if (group.stockCount === 0) {
        totalGroupsEmpty++;
        warnings.push(`Group "${group.name}" has no stock data`);
      } else {
        totalGroupsWithData++;
        minStocksPerGroup = Math.min(minStocksPerGroup, group.stockCount);
        
        // Check if group has fewer stocks than expected (but not empty)
        if (group.stockCount < expectedMinStocks && group.stockCount > 0) {
          warnings.push(`Group "${group.name}" has only ${group.stockCount} stocks (expected at least ${expectedMinStocks})`);
        }
      }
    }

    // Handle case where all groups are empty
    if (minStocksPerGroup === Infinity) {
      minStocksPerGroup = 0;
    }

    // Data is considered complete if:
    // 1. There are groups with data
    // 2. No groups are completely empty
    // 3. Each group has at least 1 stock
    const isComplete = totalGroupsWithData > 0 && 
                       totalGroupsEmpty === 0 && 
                       minStocksPerGroup >= 1;

    // Add warning about excluded zero-price stocks (Requirement 3.5)
    if (excludedZeroPriceCount > 0) {
      warnings.push(`${excludedZeroPriceCount} zero-price stock(s) excluded from results`);
    }

    return {
      isComplete,
      totalGroupsWithData,
      totalGroupsEmpty,
      minStocksPerGroup,
      warnings,
      excludedZeroPriceCount,
    };
  }

  /**
   * Group heatmap items by sector
   * Implements Requirement 4.4: Display sector heatmap
   */
  private groupBySector(items: HeatmapItem[], limit: number): HeatmapGroup[] {
    // Group by sector
    const sectorMap = new Map<string, HeatmapItem[]>();
    
    for (const item of items) {
      const existing = sectorMap.get(item.sector) || [];
      existing.push(item);
      sectorMap.set(item.sector, existing);
    }

    // Convert to groups
    const groups: HeatmapGroup[] = [];
    
    for (const [sector, sectorItems] of sectorMap) {
      // Sort by market cap descending and limit
      const sortedItems = sectorItems
        .sort((a, b) => b.marketCap - a.marketCap)
        .slice(0, limit);

      const totalMarketCap = sortedItems.reduce((sum, item) => sum + item.marketCap, 0);
      const avgChangePercent = sortedItems.length > 0
        ? sortedItems.reduce((sum, item) => sum + item.changePercent, 0) / sortedItems.length
        : 0;

      groups.push({
        name: sector,
        totalMarketCap,
        avgChangePercent,
        stockCount: sortedItems.length,
        items: sortedItems,
      });
    }

    // Sort groups by total market cap descending
    return groups.sort((a, b) => b.totalMarketCap - a.totalMarketCap);
  }

  /**
   * Group heatmap items by market cap tier
   * Implements Requirement 18.6: Support grouping by market cap
   */
  private groupByMarketCap(items: HeatmapItem[], limit: number): HeatmapGroup[] {
    // Group by market cap tier
    const tierMap = new Map<MarketCapTier, HeatmapItem[]>();
    const tiers: MarketCapTier[] = ['mega', 'large', 'mid', 'small', 'micro'];
    
    // Initialize all tiers
    for (const tier of tiers) {
      tierMap.set(tier, []);
    }

    for (const item of items) {
      const tier = getMarketCapTier(item.marketCap);
      const existing = tierMap.get(tier) || [];
      existing.push(item);
      tierMap.set(tier, existing);
    }

    // Convert to groups (maintain tier order)
    const groups: HeatmapGroup[] = [];
    
    for (const tier of tiers) {
      const tierItems = tierMap.get(tier) || [];
      
      if (tierItems.length === 0) continue;

      // Sort by market cap descending and limit
      const sortedItems = tierItems
        .sort((a, b) => b.marketCap - a.marketCap)
        .slice(0, limit);

      const totalMarketCap = sortedItems.reduce((sum, item) => sum + item.marketCap, 0);
      const avgChangePercent = sortedItems.length > 0
        ? sortedItems.reduce((sum, item) => sum + item.changePercent, 0) / sortedItems.length
        : 0;

      groups.push({
        name: getMarketCapTierLabel(tier),
        totalMarketCap,
        avgChangePercent,
        stockCount: sortedItems.length,
        items: sortedItems,
      });
    }

    return groups;
  }

  /**
   * Group heatmap items by industry
   * Implements Requirements 14.1, 14.3: Support industry grouping and filtering
   */
  private groupByIndustry(items: HeatmapItem[], limit: number): HeatmapGroup[] {
    // Group by industry
    const industryMap = new Map<string, HeatmapItem[]>();
    
    for (const item of items) {
      // Use industry if available, otherwise use 'Unknown' as fallback
      const industry = item.industry || 'Unknown';
      const existing = industryMap.get(industry) || [];
      existing.push(item);
      industryMap.set(industry, existing);
    }

    // Convert to groups
    const groups: HeatmapGroup[] = [];
    
    for (const [industry, industryItems] of industryMap) {
      // Sort by market cap descending and limit
      const sortedItems = industryItems
        .sort((a, b) => b.marketCap - a.marketCap)
        .slice(0, limit);

      const totalMarketCap = sortedItems.reduce((sum, item) => sum + item.marketCap, 0);
      const avgChangePercent = sortedItems.length > 0
        ? sortedItems.reduce((sum, item) => sum + item.changePercent, 0) / sortedItems.length
        : 0;

      groups.push({
        name: industry,
        totalMarketCap,
        avgChangePercent,
        stockCount: sortedItems.length,
        items: sortedItems,
      });
    }

    // Sort groups by total market cap descending
    return groups.sort((a, b) => b.totalMarketCap - a.totalMarketCap);
  }

  /**
   * Get heatmap data for a specific sector
   * 
   * @param sector - Sector name
   * @param limit - Maximum number of stocks (default: 100)
   * @returns Heatmap items for the sector
   */
  async getSectorHeatmap(sector: string, limit: number = 100): Promise<HeatmapItem[]> {
    const stocks = await prisma.stock.findMany({
      where: {
        sector: {
          equals: sector,
          mode: 'insensitive',
        },
        marketCap: { not: null },
      },
      select: {
        symbol: true,
        name: true,
        sector: true,
        industry: true,
        marketCap: true,
      },
      take: limit * 2, // Fetch more to account for missing quotes
    });

    const symbols = stocks.map(s => s.symbol);
    const quotes = await prisma.stockQuote.findMany({
      where: {
        symbol: { in: symbols },
      },
      orderBy: { timestamp: 'desc' },
      distinct: ['symbol'],
    });

    const quoteMap = new Map(quotes.map(q => [q.symbol, q]));

    const items: HeatmapItem[] = [];
    for (const stock of stocks) {
      const quote = quoteMap.get(stock.symbol);
      if (quote && stock.sector && stock.marketCap) {
        let price = quote.price;
        let change = quote.change;
        let changePercent = quote.changePercent;

        // Apply unified zero-price handling (Requirement 3.1)
        if (isZeroPrice(price)) {
          price = 0;
          change = 0;
          changePercent = 0;
        }

        items.push({
          symbol: stock.symbol,
          name: stock.name,
          sector: stock.sector,
          industry: stock.industry,
          marketCap: Number(stock.marketCap),
          price,
          change,
          changePercent,
          volume: Number(quote.volume),
        });
      }
    }

    // Sort by market cap and limit
    return items
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, limit);
  }

  /**
   * Get list of available sectors
   */
  async getAvailableSectors(): Promise<string[]> {
    const sectors = await prisma.stock.findMany({
      where: {
        sector: { not: null },
      },
      select: {
        sector: true,
      },
      distinct: ['sector'],
    });

    return sectors
      .map(s => s.sector)
      .filter((s): s is string => s !== null)
      .sort();
  }

  /**
   * Get list of available industries with their sector and stock count
   * Implements Requirement 14.1: Display sector/industry filter dropdown
   * 
   * @returns Array of industry info objects
   */
  async getAvailableIndustries(): Promise<IndustryInfo[]> {
    // Check cache first
    const cacheKey = 'market:industries';
    try {
      const cachedData = await redisHelpers.getJson<IndustryInfo[]>(cacheKey);
      if (cachedData) {
        logger.debug('Industries cache hit');
        return cachedData;
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Get all stocks with industry and sector info
    const stocks = await prisma.stock.findMany({
      where: {
        industry: { not: null },
        sector: { not: null },
      },
      select: {
        industry: true,
        sector: true,
      },
    });

    // Group by industry and count stocks
    const industryMap = new Map<string, { sector: string; count: number }>();
    
    for (const stock of stocks) {
      if (stock.industry && stock.sector) {
        const existing = industryMap.get(stock.industry);
        if (existing) {
          existing.count++;
        } else {
          industryMap.set(stock.industry, { sector: stock.sector, count: 1 });
        }
      }
    }

    // Convert to IndustryInfo array
    const industries: IndustryInfo[] = [];
    for (const [name, data] of industryMap) {
      industries.push({
        name,
        sector: data.sector,
        stockCount: data.count,
      });
    }

    // Sort by stock count descending, then by name
    industries.sort((a, b) => {
      if (b.stockCount !== a.stockCount) {
        return b.stockCount - a.stockCount;
      }
      return a.name.localeCompare(b.name);
    });

    // Cache the result
    try {
      await redisHelpers.setJson(cacheKey, industries, CacheTTL.sectorList || 3600);
      logger.debug('Industries data cached');
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return industries;
  }

  /**
   * Get industries for a specific sector
   * Implements Requirement 14.1: Support filtering industries by sector
   * 
   * @param sector - Sector name to filter by
   * @returns Array of industry names in the sector
   */
  async getIndustriesBySector(sector: string): Promise<string[]> {
    const stocks = await prisma.stock.findMany({
      where: {
        sector: {
          equals: sector,
          mode: 'insensitive',
        },
        industry: { not: null },
      },
      select: {
        industry: true,
      },
      distinct: ['industry'],
    });

    return stocks
      .map(s => s.industry)
      .filter((i): i is string => i !== null)
      .sort();
  }
}

// Export singleton instance
export const heatmapService = new HeatmapService();
