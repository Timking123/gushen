import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';
import { CacheKeys, CacheTTL } from '../lib/cache-keys.js';
import { logger } from '../utils/logger.js';
import { finnhubService } from './finnhubService.js';
import { twelveDataService } from './twelveDataService.js';

/**
 * Stock search result interface
 * Represents a stock returned from search
 */
export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  country: string | null;
}

/**
 * Stock detail interface
 * Full stock information
 */
export interface StockDetail {
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  country: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Extended profile fields from Finnhub
  website?: string;
  logo?: string;
  phone?: string;
  ipo?: string;
  shareOutstanding?: number;
}

/**
 * Stock quote interface
 * Real-time price data
 */
export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number | null;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: Date;
}

/**
 * OHLCV data interface
 * Historical price data point
 */
export interface OHLCV {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Time range type for historical data
 */
export type TimeRange = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX';

/**
 * Financial metrics interface
 * Key financial indicators for fundamental analysis
 * 
 * Implements Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */
export interface FinancialMetrics {
  // 估值指标 (Valuation metrics)
  pe: number | null;
  forwardPe: number | null;
  peg: number | null;
  ps: number | null;
  pb: number | null;
  
  // 盈利指标 (Earnings metrics)
  eps: number | null;
  epsGrowth: number | null;
  
  // 营收指标 (Revenue metrics)
  revenue: number | null;
  revenueGrowth: number | null;
  
  // 利润率 (Profit margins)
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  
  // 回报率 (Return metrics)
  roe: number | null;
  roa: number | null;
  
  // 负债 (Debt metrics)
  debtToEquity: number | null;
  currentRatio: number | null;
  
  // 股息 (Dividend metrics)
  dividendYield: number | null;
  payoutRatio: number | null;
}

/**
 * StockService - Handles stock data operations
 * Implements Requirements 1.1 (stock search)
 */
export class StockService {
  /**
   * Search stocks by symbol or name (case-insensitive)
   * Results are cached in Redis for performance
   * 
   * @param query - Search query string (symbol or name)
   * @param limit - Maximum number of results to return (default: 20)
   * @returns Array of matching stocks
   * 
   * Implements Requirement 1.1: WHEN 用户搜索股票代码或名称 
   * THEN Watchlist_Manager SHALL 显示匹配的股票列表供用户选择
   */
  async searchStocks(query: string, limit: number = 20): Promise<StockSearchResult[]> {
    // Normalize query for consistent caching
    const normalizedQuery = query.trim().toLowerCase();
    
    // Return empty array for empty queries
    if (!normalizedQuery) {
      return [];
    }

    // Check cache first
    const cacheKey = CacheKeys.stock.search(normalizedQuery);
    try {
      const cachedResults = await redisHelpers.getJson<StockSearchResult[]>(cacheKey);
      if (cachedResults) {
        logger.debug(`Stock search cache hit for query: ${normalizedQuery}`);
        return cachedResults.slice(0, limit);
      }
    } catch (error) {
      // Log cache error but continue with database query
      logger.warn('Redis cache read error:', error);
    }

    // Search in database - case-insensitive search on symbol and name
    const stocks = await prisma.stock.findMany({
      where: {
        OR: [
          {
            symbol: {
              contains: normalizedQuery,
              mode: 'insensitive',
            },
          },
          {
            name: {
              contains: normalizedQuery,
              mode: 'insensitive',
            },
          },
        ],
      },
      select: {
        symbol: true,
        name: true,
        exchange: true,
        sector: true,
        industry: true,
        marketCap: true,
        country: true,
      },
      orderBy: [
        // Prioritize exact symbol matches
        {
          symbol: 'asc',
        },
      ],
      take: Math.min(limit, 100), // Cap at 100 for performance
    });

    // Transform results - convert BigInt to number for JSON serialization
    const results: StockSearchResult[] = stocks.map((stock) => ({
      symbol: stock.symbol,
      name: stock.name,
      exchange: stock.exchange,
      sector: stock.sector,
      industry: stock.industry,
      marketCap: stock.marketCap ? Number(stock.marketCap) : null,
      country: stock.country,
    }));

    // Sort results: exact symbol matches first, then by symbol length
    results.sort((a, b) => {
      const aSymbolMatch = a.symbol.toLowerCase() === normalizedQuery;
      const bSymbolMatch = b.symbol.toLowerCase() === normalizedQuery;
      
      if (aSymbolMatch && !bSymbolMatch) return -1;
      if (!aSymbolMatch && bSymbolMatch) return 1;
      
      const aSymbolStartsWith = a.symbol.toLowerCase().startsWith(normalizedQuery);
      const bSymbolStartsWith = b.symbol.toLowerCase().startsWith(normalizedQuery);
      
      if (aSymbolStartsWith && !bSymbolStartsWith) return -1;
      if (!aSymbolStartsWith && bSymbolStartsWith) return 1;
      
      // Then sort by symbol length (shorter symbols first)
      return a.symbol.length - b.symbol.length;
    });

    // Cache results
    try {
      await redisHelpers.setJson(cacheKey, results, CacheTTL.search);
      logger.debug(`Stock search results cached for query: ${normalizedQuery}`);
    } catch (error) {
      // Log cache error but don't fail the request
      logger.warn('Redis cache write error:', error);
    }

    return results.slice(0, limit);
  }

  /**
   * Get stock detail by symbol
   * Fetches from database and enriches with Finnhub profile data
   * 
   * @param symbol - Stock symbol
   * @returns Stock detail or null if not found
   */
  async getStockDetail(symbol: string): Promise<StockDetail | null> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check cache first
    const cacheKey = CacheKeys.stock.detail(normalizedSymbol);
    try {
      const cachedDetail = await redisHelpers.getJson<StockDetail>(cacheKey);
      if (cachedDetail) {
        logger.debug(`Stock detail cache hit for symbol: ${normalizedSymbol}`);
        return cachedDetail;
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Query database
    const stock = await prisma.stock.findUnique({
      where: { symbol: normalizedSymbol },
    });

    if (!stock) {
      return null;
    }

    // Start with database data
    const detail: StockDetail = {
      symbol: stock.symbol,
      name: stock.name,
      exchange: stock.exchange,
      sector: stock.sector,
      industry: stock.industry,
      marketCap: stock.marketCap ? Number(stock.marketCap) : null,
      country: stock.country,
      createdAt: stock.createdAt,
      updatedAt: stock.updatedAt,
    };

    // Enrich with Finnhub profile data
    try {
      const finnhubProfile = await finnhubService.getCompanyProfile(normalizedSymbol);
      if (finnhubProfile) {
        // Update detail with Finnhub data
        detail.website = finnhubProfile.weburl || undefined;
        detail.logo = finnhubProfile.logo || undefined;
        detail.phone = finnhubProfile.phone || undefined;
        detail.ipo = finnhubProfile.ipo || undefined;
        detail.shareOutstanding = finnhubProfile.shareOutstanding || undefined;
        
        // Update fields if database is missing them
        if (!detail.industry && finnhubProfile.finnhubIndustry) {
          detail.industry = finnhubProfile.finnhubIndustry;
        }
        if (!detail.country && finnhubProfile.country) {
          detail.country = finnhubProfile.country;
        }
        if (!detail.marketCap && finnhubProfile.marketCapitalization) {
          detail.marketCap = finnhubProfile.marketCapitalization * 1000000; // Convert from millions
        }
        if (finnhubProfile.name && finnhubProfile.name.length > detail.name.length) {
          detail.name = finnhubProfile.name;
        }
        if (finnhubProfile.exchange) {
          detail.exchange = finnhubProfile.exchange;
        }
        
        logger.debug(`Enriched stock detail with Finnhub profile for: ${normalizedSymbol}`);
      }
    } catch (error) {
      logger.warn(`Failed to fetch Finnhub profile for ${normalizedSymbol}:`, error);
      // Continue with database data only
    }

    // Cache result
    try {
      await redisHelpers.setJson(cacheKey, detail, CacheTTL.stockDetail);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return detail;
  }

  /**
   * Get financial metrics for a stock
   * Data is cached in Redis for 1 hour (3600 seconds)
   * 
   * @param symbol - Stock symbol
   * @returns Financial metrics or null if not found
   * 
   * Implements Requirements 6.1, 6.2, 6.3, 6.4, 6.5:
   * - 6.1: 显示市盈率（PE）、市净率（PB）、市销率（PS）
   * - 6.2: 显示每股收益（EPS）和收益增长率
   * - 6.3: 显示营收和营收增长率
   * - 6.4: 显示毛利率、营业利润率、净利率
   * - 6.5: 显示 ROE、ROA、负债权益比
   */
  async getFinancialMetrics(symbol: string): Promise<FinancialMetrics | null> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check cache first - using fundamentals cache key with 1 hour TTL
    const cacheKey = CacheKeys.stock.fundamentals(normalizedSymbol);
    try {
      const cachedMetrics = await redisHelpers.getJson<FinancialMetrics>(cacheKey);
      if (cachedMetrics) {
        logger.debug(`Financial metrics cache hit for symbol: ${normalizedSymbol}`);
        return cachedMetrics;
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Fetch from Finnhub API directly
    const financials = await finnhubService.getBasicFinancials(normalizedSymbol);

    if (!financials || !financials.metric) {
      logger.debug(`No financial metrics found for symbol: ${normalizedSymbol}`);
      return null;
    }

    const m = financials.metric;

    // Transform Finnhub API result to FinancialMetrics interface
    const metrics: FinancialMetrics = {
      // 估值指标
      pe: m.peExclExtraTTM ?? m.peAnnual ?? null,
      forwardPe: null, // Finnhub basic doesn't provide forward PE
      peg: m.pegRatio ?? null,
      ps: m.psTTM ?? m.psAnnual ?? null,
      pb: m.pbQuarterly ?? m.pbAnnual ?? null,
      
      // 盈利指标
      eps: m.epsAnnual ?? null,
      epsGrowth: m.epsGrowthTTMYoy ?? m.epsGrowthQuarterlyYoy ?? null,
      
      // 营收指标
      revenue: null, // Not directly available in basic metrics
      revenueGrowth: m.revenueGrowthTTMYoy ?? m.revenueGrowthQuarterlyYoy ?? null,
      
      // 利润率
      grossMargin: m.grossMarginTTM ?? m.grossMarginAnnual ?? null,
      operatingMargin: m.operatingMarginTTM ?? m.operatingMarginAnnual ?? null,
      netMargin: m.netProfitMarginTTM ?? m.netProfitMarginAnnual ?? null,
      
      // 回报率
      roe: m.roeTTM ?? m.roeRfy ?? null,
      roa: m.roaTTM ?? m.roaRfy ?? null,
      
      // 负债
      debtToEquity: m.totalDebtToEquityQuarterly ?? m.totalDebtToEquityAnnual ?? null,
      currentRatio: m.currentRatioQuarterly ?? m.currentRatioAnnual ?? null,
      
      // 股息
      dividendYield: m.dividendYieldIndicatedAnnual ?? null,
      payoutRatio: m.payoutRatioAnnual ?? null,
    };

    // Cache result with 1 hour TTL (3600 seconds)
    try {
      await redisHelpers.setJson(cacheKey, metrics, CacheTTL.fundamentals);
      logger.debug(`Financial metrics cached for symbol: ${normalizedSymbol}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return metrics;
  }

  /**
   * Check if a stock exists by symbol
   * 
   * @param symbol - Stock symbol to check
   * @returns true if stock exists, false otherwise
   */
  async stockExists(symbol: string): Promise<boolean> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    
    const stock = await prisma.stock.findUnique({
      where: { symbol: normalizedSymbol },
      select: { symbol: true },
    });

    return stock !== null;
  }

  /**
   * Create or update a stock in the database
   * Used for seeding data or syncing with external APIs
   * 
   * @param stockData - Stock data to upsert
   * @returns The created or updated stock
   */
  async upsertStock(stockData: {
    symbol: string;
    name: string;
    exchange: string;
    sector?: string | null;
    industry?: string | null;
    marketCap?: number | null;
    country?: string | null;
  }): Promise<StockDetail> {
    const normalizedSymbol = stockData.symbol.trim().toUpperCase();

    const stock = await prisma.stock.upsert({
      where: { symbol: normalizedSymbol },
      update: {
        name: stockData.name,
        exchange: stockData.exchange,
        sector: stockData.sector,
        industry: stockData.industry,
        marketCap: stockData.marketCap ? BigInt(stockData.marketCap) : null,
        country: stockData.country,
      },
      create: {
        symbol: normalizedSymbol,
        name: stockData.name,
        exchange: stockData.exchange,
        sector: stockData.sector,
        industry: stockData.industry,
        marketCap: stockData.marketCap ? BigInt(stockData.marketCap) : null,
        country: stockData.country,
      },
    });

    // Invalidate cache
    const cacheKey = CacheKeys.stock.detail(normalizedSymbol);
    try {
      await redisHelpers.del(cacheKey);
    } catch (error) {
      logger.warn('Redis cache invalidation error:', error);
    }

    return {
      symbol: stock.symbol,
      name: stock.name,
      exchange: stock.exchange,
      sector: stock.sector,
      industry: stock.industry,
      marketCap: stock.marketCap ? Number(stock.marketCap) : null,
      country: stock.country,
      createdAt: stock.createdAt,
      updatedAt: stock.updatedAt,
    };
  }

  /**
   * Get stock quote (real-time price data) by symbol
   * Prioritizes Finnhub API for real-time data, falls back to database
   * 
   * @param symbol - Stock symbol
   * @returns Stock quote or null if not found
   * 
   * Implements Requirement 4.1: WHEN 用户查看股票详情 
   * THEN Visualization_Engine SHALL 显示可交互的K线图和成交量图
   */
  async getQuote(symbol: string): Promise<StockQuote | null> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check cache first (short TTL for real-time data)
    const cacheKey = CacheKeys.stock.quote(normalizedSymbol);
    try {
      const cachedQuote = await redisHelpers.getJson<StockQuote>(cacheKey);
      if (cachedQuote) {
        logger.debug(`Stock quote cache hit for symbol: ${normalizedSymbol}`);
        // Convert timestamp string back to Date if needed
        return {
          ...cachedQuote,
          timestamp: new Date(cachedQuote.timestamp),
        };
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Try to get real-time quote from Finnhub API first
    try {
      const finnhubQuote = await finnhubService.getQuote(normalizedSymbol);
      if (finnhubQuote && finnhubQuote.c > 0) {
        const result: StockQuote = {
          symbol: normalizedSymbol,
          price: finnhubQuote.c,
          change: finnhubQuote.d || 0,
          changePercent: finnhubQuote.dp || 0,
          volume: 0, // Finnhub quote doesn't include volume
          avgVolume: null,
          high: finnhubQuote.h,
          low: finnhubQuote.l,
          open: finnhubQuote.o,
          previousClose: finnhubQuote.pc,
          timestamp: new Date(finnhubQuote.t * 1000),
        };

        // Cache result with short TTL
        try {
          await redisHelpers.setJson(cacheKey, result, CacheTTL.quote);
          logger.debug(`Finnhub quote cached for symbol: ${normalizedSymbol}`);
        } catch (cacheError) {
          logger.warn('Redis cache write error:', cacheError);
        }

        return result;
      }
    } catch (error) {
      logger.warn(`Finnhub API error for ${normalizedSymbol}, falling back to database:`, error);
    }

    // Fallback: Query database for the latest quote
    const quote = await prisma.stockQuote.findFirst({
      where: { symbol: normalizedSymbol },
      orderBy: { timestamp: 'desc' },
    });

    if (!quote) {
      return null;
    }

    const result: StockQuote = {
      symbol: quote.symbol,
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      volume: Number(quote.volume),
      avgVolume: quote.avgVolume ? Number(quote.avgVolume) : null,
      high: quote.high,
      low: quote.low,
      open: quote.open,
      previousClose: quote.previousClose,
      timestamp: quote.timestamp,
    };

    // Cache result with short TTL
    try {
      await redisHelpers.setJson(cacheKey, result, CacheTTL.quote);
      logger.debug(`Stock quote cached for symbol: ${normalizedSymbol}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return result;
  }

  /**
   * Get historical OHLCV data for a stock within a time range
   * Uses Twelve Data API as primary source for real market data
   * 
   * @param symbol - Stock symbol
   * @param range - Time range for historical data
   * @returns Array of OHLCV data points sorted by timestamp ascending
   * 
   * Implements Requirement 4.3: WHEN 用户选择时间范围 
   * THEN Visualization_Engine SHALL 动态更新图表显示对应时段数据
   */
  async getHistoricalData(symbol: string, range: TimeRange): Promise<OHLCV[]> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check cache first (longer TTL to save API credits)
    const cacheKey = CacheKeys.stock.historical(normalizedSymbol, range);
    try {
      const cachedData = await redisHelpers.getJson<OHLCV[]>(cacheKey);
      if (cachedData && cachedData.length > 0) {
        logger.debug(`Historical data cache hit for symbol: ${normalizedSymbol}, range: ${range}`);
        // Convert timestamp strings back to Date objects
        return cachedData.map(item => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Calculate date range based on TimeRange
    const endDate = new Date();
    const startDate = this.calculateStartDate(range);
    
    // Primary: Try Twelve Data API (most reliable for historical data)
    try {
      const interval = twelveDataService.convertTimeRange(range);
      const twelveData = await twelveDataService.getHistoricalData(normalizedSymbol, startDate, endDate, interval);
      
      if (twelveData && twelveData.length > 0) {
        // Cache results with longer TTL (1 hour) to save API credits
        try {
          await redisHelpers.setJson(cacheKey, twelveData, 3600);
          logger.debug(`Twelve Data historical data cached for symbol: ${normalizedSymbol}, range: ${range}`);
        } catch (cacheError) {
          logger.warn('Redis cache write error:', cacheError);
        }

        return twelveData;
      }
    } catch (error) {
      logger.warn(`Twelve Data API error for ${normalizedSymbol}, trying Finnhub:`, error);
    }

    // Fallback 1: Try Finnhub API
    try {
      const to = Math.floor(endDate.getTime() / 1000);
      const from = Math.floor(startDate.getTime() / 1000);
      
      const candles = await finnhubService.getCandles(normalizedSymbol, 'D', from, to);
      
      if (candles && candles.s === 'ok' && candles.t && candles.t.length > 0) {
        const results: OHLCV[] = [];
        
        for (let i = 0; i < candles.t.length; i++) {
          results.push({
            timestamp: new Date(candles.t[i] * 1000),
            open: candles.o[i],
            high: candles.h[i],
            low: candles.l[i],
            close: candles.c[i],
            volume: candles.v[i],
          });
        }

        // Cache results
        try {
          await redisHelpers.setJson(cacheKey, results, 3600);
          logger.debug(`Finnhub historical data cached for symbol: ${normalizedSymbol}, range: ${range}`);
        } catch (cacheError) {
          logger.warn('Redis cache write error:', cacheError);
        }

        return results;
      }
    } catch (error) {
      logger.warn(`Finnhub API error for ${normalizedSymbol} historical data:`, error);
    }

    // Fallback 2: Query database for historical data
    const ohlcvData = await prisma.oHLCV.findMany({
      where: {
        symbol: normalizedSymbol,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Transform results
    const results: OHLCV[] = ohlcvData.map(item => ({
      timestamp: item.timestamp,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: Number(item.volume),
    }));

    // Cache results if found
    if (results.length > 0) {
      try {
        await redisHelpers.setJson(cacheKey, results, 3600);
        logger.debug(`Database historical data cached for symbol: ${normalizedSymbol}, range: ${range}`);
      } catch (error) {
        logger.warn('Redis cache write error:', error);
      }
    } else {
      logger.warn(`No historical data available for ${normalizedSymbol}`);
    }

    return results;
  }

  /**
   * Calculate start date based on time range
   * @param range - Time range
   * @returns Start date for the range
   */
  private calculateStartDate(range: TimeRange): Date {
    const now = new Date();
    
    switch (range) {
      case '1D':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '5D':
        return new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      case '1M':
        return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      case '3M':
        return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      case '6M':
        return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      case '1Y':
        return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      case '5Y':
        return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      case 'MAX':
        // Return a very old date for MAX range
        return new Date(1970, 0, 1);
      default:
        // Default to 1 month
        return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    }
  }

  /**
   * Save a stock quote to the database
   * Used for storing real-time quote data
   * 
   * @param quoteData - Quote data to save
   * @returns The saved quote
   */
  async saveQuote(quoteData: Omit<StockQuote, 'timestamp'> & { timestamp?: Date }): Promise<StockQuote> {
    const normalizedSymbol = quoteData.symbol.trim().toUpperCase();

    const quote = await prisma.stockQuote.create({
      data: {
        symbol: normalizedSymbol,
        price: quoteData.price,
        change: quoteData.change,
        changePercent: quoteData.changePercent,
        volume: BigInt(quoteData.volume),
        avgVolume: quoteData.avgVolume ? BigInt(quoteData.avgVolume) : null,
        high: quoteData.high,
        low: quoteData.low,
        open: quoteData.open,
        previousClose: quoteData.previousClose,
        timestamp: quoteData.timestamp || new Date(),
      },
    });

    // Invalidate quote cache
    const cacheKey = CacheKeys.stock.quote(normalizedSymbol);
    try {
      await redisHelpers.del(cacheKey);
    } catch (error) {
      logger.warn('Redis cache invalidation error:', error);
    }

    return {
      symbol: quote.symbol,
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      volume: Number(quote.volume),
      avgVolume: quote.avgVolume ? Number(quote.avgVolume) : null,
      high: quote.high,
      low: quote.low,
      open: quote.open,
      previousClose: quote.previousClose,
      timestamp: quote.timestamp,
    };
  }

  /**
   * Save OHLCV data to the database
   * Used for storing historical price data
   * 
   * @param symbol - Stock symbol
   * @param ohlcvData - Array of OHLCV data to save
   * @returns Number of records saved
   */
  async saveHistoricalData(symbol: string, ohlcvData: OHLCV[]): Promise<number> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Use upsert to handle duplicates
    let savedCount = 0;
    for (const item of ohlcvData) {
      await prisma.oHLCV.upsert({
        where: {
          symbol_timestamp: {
            symbol: normalizedSymbol,
            timestamp: item.timestamp,
          },
        },
        update: {
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: BigInt(item.volume),
        },
        create: {
          symbol: normalizedSymbol,
          timestamp: item.timestamp,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: BigInt(item.volume),
        },
      });
      savedCount++;
    }

    // Invalidate historical data cache for all ranges
    const ranges: TimeRange[] = ['1D', '5D', '1M', '3M', '6M', '1Y', '5Y', 'MAX'];
    for (const range of ranges) {
      const cacheKey = CacheKeys.stock.historical(normalizedSymbol, range);
      try {
        await redisHelpers.del(cacheKey);
      } catch (error) {
        logger.warn('Redis cache invalidation error:', error);
      }
    }

    return savedCount;
  }

  /**
   * Analyst rating summary interface
   * Aggregated analyst ratings for a stock
   * 
   * Implements Requirements 7.1, 7.2
   */
  async getAnalystRatingSummary(symbol: string): Promise<{
    symbol: string;
    totalAnalysts: number;
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
    averageTargetPrice: number | null;
    highTargetPrice: number | null;
    lowTargetPrice: number | null;
    currentPrice: number | null;
    upsidePercent: number | null;
  } | null> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check cache first
    const cacheKey = CacheKeys.analyst.rating(normalizedSymbol);
    try {
      const cachedSummary = await redisHelpers.getJson<{
        symbol: string;
        totalAnalysts: number;
        strongBuy: number;
        buy: number;
        hold: number;
        sell: number;
        strongSell: number;
        averageTargetPrice: number | null;
        highTargetPrice: number | null;
        lowTargetPrice: number | null;
        currentPrice: number | null;
        upsidePercent: number | null;
      }>(cacheKey);
      if (cachedSummary) {
        logger.debug(`Analyst rating summary cache hit for symbol: ${normalizedSymbol}`);
        return cachedSummary;
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Fetch from Finnhub API directly
    const [recommendations, priceTarget, quote] = await Promise.all([
      finnhubService.getRecommendations(normalizedSymbol),
      finnhubService.getPriceTarget(normalizedSymbol),
      this.getQuote(normalizedSymbol),
    ]);

    // Get the most recent recommendation (first in array)
    const latestRec = recommendations && recommendations.length > 0 ? recommendations[0] : null;

    if (!latestRec) {
      logger.debug(`No analyst ratings found for symbol: ${normalizedSymbol}`);
      return null;
    }

    // Calculate total analysts
    const totalAnalysts = latestRec.strongBuy + latestRec.buy + latestRec.hold + latestRec.sell + latestRec.strongSell;

    // Get price target data
    const averageTargetPrice = priceTarget?.targetMean ?? priceTarget?.targetMedian ?? null;
    const highTargetPrice = priceTarget?.targetHigh ?? null;
    const lowTargetPrice = priceTarget?.targetLow ?? null;

    // Get current price for upside calculation
    const currentPrice = quote?.price ?? null;

    // Calculate upside percentage
    const upsidePercent = (averageTargetPrice !== null && currentPrice !== null && currentPrice > 0)
      ? ((averageTargetPrice - currentPrice) / currentPrice) * 100
      : null;

    const summary = {
      symbol: normalizedSymbol,
      totalAnalysts,
      strongBuy: latestRec.strongBuy,
      buy: latestRec.buy,
      hold: latestRec.hold,
      sell: latestRec.sell,
      strongSell: latestRec.strongSell,
      averageTargetPrice,
      highTargetPrice,
      lowTargetPrice,
      currentPrice,
      upsidePercent,
    };

    // Cache result with 30 minutes TTL
    try {
      await redisHelpers.setJson(cacheKey, summary, CacheTTL.analystRating);
      logger.debug(`Analyst rating summary cached for symbol: ${normalizedSymbol}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return summary;
  }

  /**
   * Get recent analyst ratings for a stock
   * 
   * @param symbol - Stock symbol
   * @param limit - Maximum number of ratings to return (default: 10)
   * @returns Array of recent analyst ratings
   * 
   * Implements Requirements 7.3, 7.4
   */
  async getRecentAnalystRatings(symbol: string, limit: number = 10): Promise<Array<{
    id: string;
    analyst: string;
    firm: string;
    rating: string;
    targetPrice: number | null;
    previousRating: string | null;
    previousTargetPrice: number | null;
    ratingDate: Date;
  }>> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check cache first
    const cacheKey = CacheKeys.analyst.history(normalizedSymbol);
    try {
      const cachedRatings = await redisHelpers.getJson<Array<{
        id: string;
        analyst: string;
        firm: string;
        rating: string;
        targetPrice: number | null;
        previousRating: string | null;
        previousTargetPrice: number | null;
        ratingDate: string;
      }>>(cacheKey);
      if (cachedRatings) {
        logger.debug(`Recent analyst ratings cache hit for symbol: ${normalizedSymbol}`);
        return cachedRatings.slice(0, limit).map(r => ({
          ...r,
          ratingDate: new Date(r.ratingDate),
        }));
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Fetch from Finnhub API - get recommendation history
    const recommendations = await finnhubService.getRecommendations(normalizedSymbol);

    if (!recommendations || recommendations.length === 0) {
      logger.debug(`No analyst ratings found for symbol: ${normalizedSymbol}`);
      return [];
    }

    // Convert Finnhub recommendations to our format
    // Each recommendation represents a monthly consensus, not individual analyst ratings
    const results = recommendations.slice(0, Math.min(limit, 12)).map((rec, index) => {
      // Determine consensus rating based on distribution
      let rating = 'hold';
      const total = rec.strongBuy + rec.buy + rec.hold + rec.sell + rec.strongSell;
      if (total > 0) {
        const buyWeight = (rec.strongBuy * 2 + rec.buy) / total;
        const sellWeight = (rec.strongSell * 2 + rec.sell) / total;
        if (buyWeight > 0.6) rating = rec.strongBuy > rec.buy ? 'strong_buy' : 'buy';
        else if (sellWeight > 0.6) rating = rec.strongSell > rec.sell ? 'strong_sell' : 'sell';
      }

      // Get previous rating for comparison
      const prevRec = recommendations[index + 1];
      let previousRating: string | null = null;
      if (prevRec) {
        const prevTotal = prevRec.strongBuy + prevRec.buy + prevRec.hold + prevRec.sell + prevRec.strongSell;
        if (prevTotal > 0) {
          const prevBuyWeight = (prevRec.strongBuy * 2 + prevRec.buy) / prevTotal;
          const prevSellWeight = (prevRec.strongSell * 2 + prevRec.sell) / prevTotal;
          if (prevBuyWeight > 0.6) previousRating = prevRec.strongBuy > prevRec.buy ? 'strong_buy' : 'buy';
          else if (prevSellWeight > 0.6) previousRating = prevRec.strongSell > prevRec.sell ? 'strong_sell' : 'sell';
          else previousRating = 'hold';
        }
      }

      return {
        id: `${normalizedSymbol}-${rec.period}`,
        analyst: '市场共识',
        firm: `${total} 位分析师`,
        rating,
        targetPrice: null, // Price target is separate API
        previousRating,
        previousTargetPrice: null,
        ratingDate: new Date(rec.period),
      };
    });

    // Cache result
    try {
      await redisHelpers.setJson(cacheKey, results, CacheTTL.analystRating);
      logger.debug(`Recent analyst ratings cached for symbol: ${normalizedSymbol}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return results.slice(0, limit);
  }

  /**
   * Get insider trade summary for a stock within a specified period
   * Calculates aggregated buy/sell statistics
   * 
   * @param symbol - Stock symbol
   * @param period - Time period for summary (e.g., "3M", "6M", "1Y")
   * @returns Insider trade summary or null if no trades found
   * 
   * Implements Requirements 8.1, 8.3:
   * - 8.1: 显示最近的内部交易记录列表
   * - 8.3: 显示近期内部交易的买入/卖出汇总统计
   */
  async getInsiderTradeSummary(symbol: string, period: string): Promise<{
    symbol: string;
    period: string;
    totalBuyShares: number;
    totalBuyValue: number;
    totalSellShares: number;
    totalSellValue: number;
    netShares: number;
    netValue: number;
    buyTransactions: number;
    sellTransactions: number;
  } | null> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check cache first
    const cacheKey = `${CacheKeys.insider.stock(normalizedSymbol)}:summary:${period}`;
    try {
      const cachedSummary = await redisHelpers.getJson<{
        symbol: string;
        period: string;
        totalBuyShares: number;
        totalBuyValue: number;
        totalSellShares: number;
        totalSellValue: number;
        netShares: number;
        netValue: number;
        buyTransactions: number;
        sellTransactions: number;
      }>(cacheKey);
      if (cachedSummary) {
        logger.debug(`Insider trade summary cache hit for symbol: ${normalizedSymbol}, period: ${period}`);
        return cachedSummary;
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Calculate start date based on period
    const startDate = this.calculatePeriodStartDate(period);

    // Fetch from Finnhub API
    const trades = await finnhubService.getInsiderTransactions(normalizedSymbol);

    if (!trades || trades.length === 0) {
      logger.debug(`No insider trades found for symbol: ${normalizedSymbol}, period: ${period}`);
      return null;
    }

    // Filter trades by period
    const filteredTrades = trades.filter(t => new Date(t.filingDate) >= startDate);

    if (filteredTrades.length === 0) {
      return null;
    }

    // Calculate summary statistics
    let totalBuyShares = 0;
    let totalBuyValue = 0;
    let totalSellShares = 0;
    let totalSellValue = 0;
    let buyTransactions = 0;
    let sellTransactions = 0;

    for (const trade of filteredTrades) {
      const shares = Math.abs(trade.change);
      const value = shares * (trade.transactionPrice || 0);

      if (trade.change > 0) {
        // Positive change = buy
        totalBuyShares += shares;
        totalBuyValue += value;
        buyTransactions++;
      } else if (trade.change < 0) {
        // Negative change = sell
        totalSellShares += shares;
        totalSellValue += value;
        sellTransactions++;
      }
    }

    const summary = {
      symbol: normalizedSymbol,
      period,
      totalBuyShares,
      totalBuyValue,
      totalSellShares,
      totalSellValue,
      netShares: totalBuyShares - totalSellShares,
      netValue: totalBuyValue - totalSellValue,
      buyTransactions,
      sellTransactions,
    };

    // Cache result with 30 minutes TTL
    try {
      await redisHelpers.setJson(cacheKey, summary, CacheTTL.insider);
      logger.debug(`Insider trade summary cached for symbol: ${normalizedSymbol}, period: ${period}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return summary;
  }

  /**
   * Get recent insider trades for a stock
   * 
   * @param symbol - Stock symbol
   * @param limit - Maximum number of trades to return (default: 10)
   * @returns Array of recent insider trades
   * 
   * Implements Requirements 8.1, 8.2:
   * - 8.1: 显示最近的内部交易记录列表
   * - 8.2: 显示交易人姓名、职位、交易类型（买入/卖出）、股数、价格、交易日期
   */
  async getRecentInsiderTrades(symbol: string, limit: number = 10): Promise<Array<{
    id: string;
    symbol: string;
    filedAt: Date;
    tradeDate: Date;
    insiderName: string;
    insiderTitle: string | null;
    transactionType: string;
    shares: number;
    pricePerShare: number;
    totalValue: number;
    sharesOwned: number | null;
  }>> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check cache first
    const cacheKey = `${CacheKeys.insider.stock(normalizedSymbol)}:recent`;
    try {
      const cachedTrades = await redisHelpers.getJson<Array<{
        id: string;
        symbol: string;
        filedAt: string;
        tradeDate: string;
        insiderName: string;
        insiderTitle: string | null;
        transactionType: string;
        shares: number;
        pricePerShare: number;
        totalValue: number;
        sharesOwned: number | null;
      }>>(cacheKey);
      if (cachedTrades) {
        logger.debug(`Recent insider trades cache hit for symbol: ${normalizedSymbol}`);
        return cachedTrades.slice(0, limit).map(t => ({
          ...t,
          filedAt: new Date(t.filedAt),
          tradeDate: new Date(t.tradeDate),
        }));
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Fetch from Finnhub API
    const trades = await finnhubService.getInsiderTransactions(normalizedSymbol);

    if (!trades || trades.length === 0) {
      logger.debug(`No insider trades found for symbol: ${normalizedSymbol}`);
      return [];
    }

    // Sort by filing date (newest first) and limit
    const sortedTrades = trades
      .sort((a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime())
      .slice(0, Math.min(limit, 50));

    const results = sortedTrades.map((t, index) => ({
      id: `${normalizedSymbol}-insider-${index}-${t.filingDate}`,
      symbol: normalizedSymbol,
      filedAt: new Date(t.filingDate),
      tradeDate: new Date(t.transactionDate || t.filingDate),
      insiderName: t.name,
      insiderTitle: null, // Finnhub doesn't provide title in this endpoint
      transactionType: t.change > 0 ? 'buy' : 'sell',
      shares: Math.abs(t.change),
      pricePerShare: t.transactionPrice || 0,
      totalValue: Math.abs(t.change) * (t.transactionPrice || 0),
      sharesOwned: t.share || null,
    }));

    // Cache result with 30 minutes TTL
    try {
      await redisHelpers.setJson(cacheKey, results, CacheTTL.insider);
      logger.debug(`Recent insider trades cached for symbol: ${normalizedSymbol}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return results.slice(0, limit);
  }

  /**
   * Stock full detail response interface
   * Aggregated data from multiple sources for stock detail page
   * 
   * Implements Requirements 2.1, 2.2, 2.3, 2.4, 4.1, 4.5, 4.6
   */
  async getStockFullDetail(symbol: string): Promise<{
    profile: StockDetail | null;
    quote: StockQuote | null;
    financials: FinancialMetrics | null;
    analystRatings: {
      symbol: string;
      totalAnalysts: number;
      strongBuy: number;
      buy: number;
      hold: number;
      sell: number;
      strongSell: number;
      averageTargetPrice: number | null;
      highTargetPrice: number | null;
      lowTargetPrice: number | null;
      currentPrice: number | null;
      upsidePercent: number | null;
    } | null;
    recentRatings: Array<{
      id: string;
      analyst: string;
      firm: string;
      rating: string;
      targetPrice: number | null;
      previousRating: string | null;
      previousTargetPrice: number | null;
      ratingDate: Date;
    }>;
    insiderSummary: {
      symbol: string;
      period: string;
      totalBuyShares: number;
      totalBuyValue: number;
      totalSellShares: number;
      totalSellValue: number;
      netShares: number;
      netValue: number;
      buyTransactions: number;
      sellTransactions: number;
    } | null;
    recentInsiderTrades: Array<{
      id: string;
      symbol: string;
      filedAt: Date;
      tradeDate: Date;
      insiderName: string;
      insiderTitle: string | null;
      transactionType: string;
      shares: number;
      pricePerShare: number;
      totalValue: number;
      sharesOwned: number | null;
    }>;
  }> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check cache first
    const cacheKey = `stock:fullDetail:${normalizedSymbol}`;
    // Note: Cache is checked but we skip complex type conversion for simplicity
    // The individual methods already have their own caching

    // Fetch all data in parallel for optimal performance
    const [
      profile,
      quote,
      financials,
      analystRatings,
      recentRatings,
      insiderSummary,
      recentInsiderTrades,
    ] = await Promise.all([
      this.getStockDetail(normalizedSymbol),
      this.getQuote(normalizedSymbol),
      this.getFinancialMetrics(normalizedSymbol),
      this.getAnalystRatingSummary(normalizedSymbol),
      this.getRecentAnalystRatings(normalizedSymbol, 10),
      this.getInsiderTradeSummary(normalizedSymbol, '3M'),
      this.getRecentInsiderTrades(normalizedSymbol, 10),
    ]);

    const result = {
      profile,
      quote,
      financials,
      analystRatings,
      recentRatings,
      insiderSummary,
      recentInsiderTrades,
    };

    // Cache result with 5 minutes TTL
    try {
      await redisHelpers.setJson(cacheKey, result, 300);
      logger.debug(`Stock full detail cached for symbol: ${normalizedSymbol}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return result;
  }

  /**
   * Calculate start date based on period string
   * @param period - Period string (e.g., "3M", "6M", "1Y")
   * @returns Start date for the period
   */
  private calculatePeriodStartDate(period: string): Date {
    const now = new Date();
    
    // Parse period string (e.g., "3M", "6M", "1Y")
    const match = period.match(/^(\d+)([DMY])$/i);
    if (!match) {
      // Default to 3 months if invalid period
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    }

    const value = parseInt(match[1], 10);
    const unit = match[2].toUpperCase();

    switch (unit) {
      case 'D':
        return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
      case 'M':
        return new Date(now.getFullYear(), now.getMonth() - value, now.getDate());
      case 'Y':
        return new Date(now.getFullYear() - value, now.getMonth(), now.getDate());
      default:
        // Default to 3 months
        return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    }
  }
}

// Export singleton instance
export const stockService = new StockService();
