import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';
import { CacheKeys, CacheTTL } from '../lib/cache-keys.js';
import { logger } from '../utils/logger.js';
import { finnhubService } from './finnhubService.js';

/**
 * News item interface
 * Represents a news article with impact analysis
 */
export interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  content: string | null;
  source: string;
  sourceCredibility: 'high' | 'medium' | 'low';
  url: string;
  publishedAt: Date;
  symbols: string[];
  sectors: string[];
  impactAnalysis: ImpactAnalysis | null;
}

/**
 * Impact analysis interface
 * AI-generated analysis of news impact on stock price
 */
export interface ImpactAnalysis {
  newsId: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  magnitude: 'high' | 'medium' | 'low';
  confidence: number;
  summary: string;
  keyPoints: string[];
  historicalComparison: string | null;
  analyzedAt: Date;
}

/**
 * Pagination options for news queries
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * News search options
 */
export interface NewsSearchOptions extends PaginationOptions {
  startDate?: Date;
  endDate?: Date;
  sources?: string[];
  minCredibility?: 'high' | 'medium' | 'low';
}

/**
 * News feed item with priority for sorting
 */
export interface NewsFeedItem extends NewsItem {
  priority: 'high' | 'medium' | 'low';
}

/**
 * Raw news input for creating news items
 */
export interface RawNewsInput {
  title: string;
  summary?: string | null;
  content?: string | null;
  source: string;
  sourceCredibility?: 'high' | 'medium' | 'low';
  url: string;
  publishedAt: Date;
  symbols?: string[];
  sectors?: string[];
}


/**
 * Credibility level mapping for comparison
 */
const credibilityLevels: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Priority level mapping for comparison
 */
const priorityLevels: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * NewsService - Handles news aggregation and information flow
 * Implements Requirements 8.1, 8.2, 8.3 (News aggregation and quality)
 * Implements Requirement 6.4 (Information flow sorting)
 */
export class NewsService {
  /**
   * Get news for a specific stock from Finnhub API
   * Results are cached in Redis for performance
   * 
   * @param symbol - Stock symbol
   * @param options - Pagination options
   * @returns Array of news items related to the stock
   * 
   * Implements Requirement 8.1: Aggregate news from multiple reliable sources
   */
  async getStockNews(symbol: string, options: PaginationOptions): Promise<NewsItem[]> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const { page, limit } = options;

    // Check cache first
    const cacheKey = CacheKeys.news.stock(normalizedSymbol, page);
    try {
      const cachedNews = await redisHelpers.getJson<NewsItem[]>(cacheKey);
      if (cachedNews) {
        logger.debug(`Stock news cache hit for symbol: ${normalizedSymbol}, page: ${page}`);
        return cachedNews.map(item => ({
          ...item,
          publishedAt: new Date(item.publishedAt),
          impactAnalysis: item.impactAnalysis ? {
            ...item.impactAnalysis,
            analyzedAt: new Date(item.impactAnalysis.analyzedAt),
          } : null,
        }));
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Fetch from Finnhub API
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30); // Get news from last 30 days
    
    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];
    
    logger.info(`Fetching Finnhub news for ${normalizedSymbol} from ${fromStr} to ${toStr}`);
    
    const finnhubNews = await finnhubService.getCompanyNews(normalizedSymbol, fromStr, toStr);
    
    logger.info(`Finnhub returned ${finnhubNews?.length || 0} news items for ${normalizedSymbol}`);
    
    if (!finnhubNews || finnhubNews.length === 0) {
      logger.debug(`No Finnhub news for ${normalizedSymbol}, falling back to database`);
      // Fallback to database
      return this.getStockNewsFromDB(normalizedSymbol, options);
    }

    // Transform Finnhub news to our format
    const results: NewsItem[] = finnhubNews.map(item => ({
      id: item.id.toString(),
      title: item.headline,
      summary: item.summary || null,
      content: null,
      source: item.source,
      sourceCredibility: this.getSourceCredibility(item.source),
      url: item.url,
      publishedAt: new Date(item.datetime * 1000),
      symbols: item.related ? item.related.split(',').map(s => s.trim()) : [normalizedSymbol],
      sectors: item.category ? [item.category] : [],
      impactAnalysis: null,
    }));

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedResults = results.slice(skip, skip + limit);

    // Cache results
    try {
      await redisHelpers.setJson(cacheKey, paginatedResults, CacheTTL.news);
      logger.debug(`Stock news cached for symbol: ${normalizedSymbol}, page: ${page}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return paginatedResults;
  }

  /**
   * Get source credibility based on source name
   */
  private getSourceCredibility(source: string): 'high' | 'medium' | 'low' {
    const highCredibilitySources = [
      'Reuters', 'Bloomberg', 'CNBC', 'Wall Street Journal', 'WSJ',
      'Financial Times', 'MarketWatch', 'Barron\'s', 'The Economist',
      'Associated Press', 'AP', 'Yahoo Finance', 'Seeking Alpha'
    ];
    
    const mediumCredibilitySources = [
      'Benzinga', 'Investopedia', 'TheStreet', 'Motley Fool',
      'Business Insider', 'Forbes', 'Fortune'
    ];
    
    const sourceLower = source.toLowerCase();
    
    if (highCredibilitySources.some(s => sourceLower.includes(s.toLowerCase()))) {
      return 'high';
    }
    
    if (mediumCredibilitySources.some(s => sourceLower.includes(s.toLowerCase()))) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Fallback: Get news from database
   */
  private async getStockNewsFromDB(symbol: string, options: PaginationOptions): Promise<NewsItem[]> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    // Query database for news related to the stock
    const newsItems = await prisma.newsItem.findMany({
      where: {
        stocks: {
          some: {
            symbol: symbol,
          },
        },
      },
      include: {
        stocks: {
          select: {
            symbol: true,
          },
        },
        impactAnalysis: true,
      },
      orderBy: {
        publishedAt: 'desc',
      },
      skip,
      take: limit,
    });

    // Transform results
    return newsItems.map(item => this.transformNewsItem(item));
  }

  /**
   * Get news for a specific sector
   * 
   * @param sector - Sector name
   * @param options - Pagination options
   * @returns Array of news items related to the sector
   */
  async getSectorNews(sector: string, options: PaginationOptions): Promise<NewsItem[]> {
    const normalizedSector = sector.trim().toLowerCase();
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    // Check cache first
    const cacheKey = CacheKeys.news.sector(normalizedSector, page);
    try {
      const cachedNews = await redisHelpers.getJson<NewsItem[]>(cacheKey);
      if (cachedNews) {
        logger.debug(`Sector news cache hit for sector: ${normalizedSector}, page: ${page}`);
        return cachedNews.map(item => ({
          ...item,
          publishedAt: new Date(item.publishedAt),
          impactAnalysis: item.impactAnalysis ? {
            ...item.impactAnalysis,
            analyzedAt: new Date(item.impactAnalysis.analyzedAt),
          } : null,
        }));
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Query database for news related to the sector
    const newsItems = await prisma.newsItem.findMany({
      where: {
        sectors: {
          has: normalizedSector,
        },
      },
      include: {
        stocks: {
          select: {
            symbol: true,
          },
        },
        impactAnalysis: true,
      },
      orderBy: {
        publishedAt: 'desc',
      },
      skip,
      take: limit,
    });

    // Transform results
    const results: NewsItem[] = newsItems.map(item => this.transformNewsItem(item));

    // Cache results
    try {
      await redisHelpers.setJson(cacheKey, results, CacheTTL.news);
      logger.debug(`Sector news cached for sector: ${normalizedSector}, page: ${page}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return results;
  }


  /**
   * Get latest news across all stocks and sectors
   * Now fetches from Finnhub market news API
   * 
   * @param options - Pagination options
   * @returns Array of latest news items
   */
  async getLatestNews(options: PaginationOptions): Promise<NewsItem[]> {
    const { page, limit } = options;

    // Check cache first
    const cacheKey = CacheKeys.news.latest();
    try {
      const cachedNews = await redisHelpers.getJson<NewsItem[]>(cacheKey);
      if (cachedNews && cachedNews.length > 0) {
        logger.debug('Latest news cache hit');
        const skip = (page - 1) * limit;
        return cachedNews.slice(skip, skip + limit).map(item => ({
          ...item,
          publishedAt: new Date(item.publishedAt),
          impactAnalysis: item.impactAnalysis ? {
            ...item.impactAnalysis,
            analyzedAt: new Date(item.impactAnalysis.analyzedAt),
          } : null,
        }));
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Fetch from Finnhub market news API
    logger.info('Fetching market news from Finnhub');
    const finnhubNews = await finnhubService.getMarketNews('general');
    
    if (finnhubNews && finnhubNews.length > 0) {
      logger.info(`Finnhub returned ${finnhubNews.length} market news items`);
      
      // Transform Finnhub news to our format
      const results: NewsItem[] = finnhubNews.map(item => ({
        id: item.id.toString(),
        title: item.headline,
        summary: item.summary || null,
        content: null,
        source: item.source,
        sourceCredibility: this.getSourceCredibility(item.source),
        url: item.url,
        publishedAt: new Date(item.datetime * 1000),
        symbols: item.related ? item.related.split(',').map(s => s.trim()).filter(s => s) : [],
        sectors: item.category ? [item.category] : [],
        impactAnalysis: null,
      }));

      // Cache all results
      try {
        await redisHelpers.setJson(cacheKey, results, CacheTTL.news);
        logger.debug('Latest news cached');
      } catch (error) {
        logger.warn('Redis cache write error:', error);
      }

      // Apply pagination
      const skip = (page - 1) * limit;
      return results.slice(skip, skip + limit);
    }

    // Fallback to database if Finnhub returns nothing
    logger.debug('No Finnhub market news, falling back to database');
    const skip = (page - 1) * limit;
    const newsItems = await prisma.newsItem.findMany({
      include: {
        stocks: {
          select: {
            symbol: true,
          },
        },
        impactAnalysis: true,
      },
      orderBy: {
        publishedAt: 'desc',
      },
      skip,
      take: limit,
    });

    return newsItems.map(item => this.transformNewsItem(item));
  }

  /**
   * Get news feed sorted by priority and time
   * Implements Requirement 6.4: Sort information by importance and time
   * 
   * @param options - Pagination options
   * @returns Array of news feed items sorted by priority (desc) then time (desc)
   */
  async getNewsFeed(options: PaginationOptions): Promise<NewsFeedItem[]> {
    const { page, limit } = options;
    
    // Get more items than needed to allow for proper sorting
    const fetchLimit = limit * 3;
    const newsItems = await this.getLatestNews({ page: 1, limit: fetchLimit });

    // Assign priority based on impact analysis and source credibility
    const feedItems: NewsFeedItem[] = newsItems.map(item => ({
      ...item,
      priority: this.calculatePriority(item),
    }));

    // Sort by priority (desc) then by publishedAt (desc)
    const sortedItems = this.sortNewsFeed(feedItems);

    // Apply pagination
    const skip = (page - 1) * limit;
    return sortedItems.slice(skip, skip + limit);
  }

  /**
   * Sort news feed by priority (descending) then by time (descending)
   * Implements Property 10: Information flow sorting property
   * 
   * @param items - Array of news feed items
   * @returns Sorted array
   */
  sortNewsFeed(items: NewsFeedItem[]): NewsFeedItem[] {
    return [...items].sort((a, b) => {
      // First sort by priority (descending)
      const priorityDiff = priorityLevels[b.priority] - priorityLevels[a.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      // Then sort by time (descending)
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
  }

  /**
   * Calculate priority for a news item based on impact analysis and source credibility
   * 
   * @param item - News item
   * @returns Priority level
   */
  private calculatePriority(item: NewsItem): 'high' | 'medium' | 'low' {
    // High priority if impact analysis indicates high magnitude
    if (item.impactAnalysis?.magnitude === 'high') {
      return 'high';
    }

    // High priority if from high credibility source with medium magnitude
    if (item.sourceCredibility === 'high' && item.impactAnalysis?.magnitude === 'medium') {
      return 'high';
    }

    // Medium priority for medium credibility or medium magnitude
    if (item.sourceCredibility === 'high' || item.impactAnalysis?.magnitude === 'medium') {
      return 'medium';
    }

    // Low priority for everything else
    return 'low';
  }


  /**
   * Add news items with deduplication
   * Implements Requirement 8.2: Remove duplicate content and mark sources
   * Implements Property 31: News deduplication property
   * 
   * @param newsInputs - Array of raw news inputs
   * @returns Array of created/updated news items
   */
  async addNewsWithDeduplication(newsInputs: RawNewsInput[]): Promise<NewsItem[]> {
    const results: NewsItem[] = [];

    for (const input of newsInputs) {
      // Check for duplicates based on title similarity and URL
      const existingNews = await this.findDuplicateNews(input);

      if (existingNews) {
        // Update existing news with additional source if different
        const updatedNews = await this.mergeNewsSource(existingNews.id, input);
        results.push(updatedNews);
      } else {
        // Create new news item
        const newNews = await this.createNewsItem(input);
        results.push(newNews);
      }
    }

    // Invalidate latest news cache
    try {
      await redisHelpers.del(CacheKeys.news.latest());
    } catch (error) {
      logger.warn('Redis cache invalidation error:', error);
    }

    return results;
  }

  /**
   * Find duplicate news based on title similarity
   * Uses exact title match for simplicity (can be enhanced with fuzzy matching)
   * 
   * @param input - Raw news input
   * @returns Existing news item if duplicate found, null otherwise
   */
  private async findDuplicateNews(input: RawNewsInput): Promise<{ id: string; source: string } | null> {
    // Check for exact URL match first
    const urlMatch = await prisma.newsItem.findFirst({
      where: {
        url: input.url,
      },
      select: {
        id: true,
        source: true,
      },
    });

    if (urlMatch) {
      return urlMatch;
    }

    // Check for title match within a time window (24 hours)
    const timeWindow = new Date(input.publishedAt.getTime() - 24 * 60 * 60 * 1000);
    const titleMatch = await prisma.newsItem.findFirst({
      where: {
        title: input.title,
        publishedAt: {
          gte: timeWindow,
        },
      },
      select: {
        id: true,
        source: true,
      },
    });

    return titleMatch;
  }

  /**
   * Merge news source when duplicate is found
   * Appends new source to existing news item
   * 
   * @param existingId - ID of existing news item
   * @param input - New news input with different source
   * @returns Updated news item
   */
  private async mergeNewsSource(existingId: string, input: RawNewsInput): Promise<NewsItem> {
    const existing = await prisma.newsItem.findUnique({
      where: { id: existingId },
      include: {
        stocks: { select: { symbol: true } },
        impactAnalysis: true,
      },
    });

    if (!existing) {
      throw new Error(`News item not found: ${existingId}`);
    }

    // Check if source is already included
    const sources = existing.source.split(', ');
    if (!sources.includes(input.source)) {
      // Append new source
      const updatedSource = `${existing.source}, ${input.source}`;
      
      // Update credibility to highest among sources
      const newCredibility = this.getHigherCredibility(
        existing.sourceCredibility as 'high' | 'medium' | 'low',
        input.sourceCredibility || 'medium'
      );

      await prisma.newsItem.update({
        where: { id: existingId },
        data: {
          source: updatedSource,
          sourceCredibility: newCredibility,
        },
      });

      logger.info(`Merged news source: ${input.source} into existing news: ${existingId}`);
    }

    // Return updated news item
    const updated = await prisma.newsItem.findUnique({
      where: { id: existingId },
      include: {
        stocks: { select: { symbol: true } },
        impactAnalysis: true,
      },
    });

    return this.transformNewsItem(updated!);
  }

  /**
   * Get higher credibility level between two
   * 
   * @param a - First credibility level
   * @param b - Second credibility level
   * @returns Higher credibility level
   */
  private getHigherCredibility(
    a: 'high' | 'medium' | 'low',
    b: 'high' | 'medium' | 'low'
  ): 'high' | 'medium' | 'low' {
    return credibilityLevels[a] >= credibilityLevels[b] ? a : b;
  }


  /**
   * Create a new news item
   * 
   * @param input - Raw news input
   * @returns Created news item
   */
  private async createNewsItem(input: RawNewsInput): Promise<NewsItem> {
    const newsItem = await prisma.newsItem.create({
      data: {
        title: input.title,
        summary: input.summary,
        content: input.content,
        source: input.source,
        sourceCredibility: input.sourceCredibility || 'medium',
        url: input.url,
        publishedAt: input.publishedAt,
        sectors: input.sectors || [],
        stocks: input.symbols && input.symbols.length > 0
          ? {
              create: input.symbols.map(symbol => ({
                symbol: symbol.toUpperCase(),
              })),
            }
          : undefined,
      },
      include: {
        stocks: { select: { symbol: true } },
        impactAnalysis: true,
      },
    });

    logger.info(`Created news item: ${newsItem.id} - ${newsItem.title}`);
    return this.transformNewsItem(newsItem);
  }

  /**
   * Get total count of news for a stock
   * 
   * @param symbol - Stock symbol
   * @returns Total count
   */
  async getStockNewsCount(symbol: string): Promise<number> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    
    // Try to get count from Finnhub (estimate based on fetched news)
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    
    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];
    
    const finnhubNews = await finnhubService.getCompanyNews(normalizedSymbol, fromStr, toStr);
    
    if (finnhubNews && finnhubNews.length > 0) {
      return finnhubNews.length;
    }
    
    // Fallback to database count
    return prisma.newsItem.count({
      where: {
        stocks: {
          some: {
            symbol: normalizedSymbol,
          },
        },
      },
    });
  }

  /**
   * Get total count of news for a sector
   * 
   * @param sector - Sector name
   * @returns Total count
   */
  async getSectorNewsCount(sector: string): Promise<number> {
    const normalizedSector = sector.trim().toLowerCase();
    return prisma.newsItem.count({
      where: {
        sectors: {
          has: normalizedSector,
        },
      },
    });
  }

  /**
   * Get total count of all news
   * Now checks Finnhub market news count first
   * 
   * @returns Total count
   */
  async getTotalNewsCount(): Promise<number> {
    // Try to get count from Finnhub market news
    const finnhubNews = await finnhubService.getMarketNews('general');
    if (finnhubNews && finnhubNews.length > 0) {
      return finnhubNews.length;
    }
    
    // Fallback to database count
    return prisma.newsItem.count();
  }

  /**
   * Transform database news item to API response format
   * 
   * @param item - Database news item with relations
   * @returns Transformed news item
   */
  private transformNewsItem(item: {
    id: string;
    title: string;
    summary: string | null;
    content: string | null;
    source: string;
    sourceCredibility: string;
    url: string;
    publishedAt: Date;
    sectors: string[];
    stocks: { symbol: string }[];
    impactAnalysis: {
      newsId: string;
      direction: string;
      magnitude: string;
      confidence: number;
      summary: string;
      keyPoints: string[];
      historicalComparison: string | null;
      analyzedAt: Date;
    } | null;
  }): NewsItem {
    return {
      id: item.id,
      title: item.title,
      summary: item.summary,
      content: item.content,
      source: item.source,
      sourceCredibility: item.sourceCredibility as 'high' | 'medium' | 'low',
      url: item.url,
      publishedAt: item.publishedAt,
      symbols: item.stocks.map(s => s.symbol),
      sectors: item.sectors,
      impactAnalysis: item.impactAnalysis
        ? {
            newsId: item.impactAnalysis.newsId,
            direction: item.impactAnalysis.direction as 'bullish' | 'bearish' | 'neutral',
            magnitude: item.impactAnalysis.magnitude as 'high' | 'medium' | 'low',
            confidence: item.impactAnalysis.confidence,
            summary: item.impactAnalysis.summary,
            keyPoints: item.impactAnalysis.keyPoints,
            historicalComparison: item.impactAnalysis.historicalComparison,
            analyzedAt: item.impactAnalysis.analyzedAt,
          }
        : null,
    };
  }

  /**
   * Deduplicate news items from multiple sources
   * Pure function for property testing
   * Implements Property 31: News deduplication property
   * 
   * @param newsItems - Array of news items potentially with duplicates
   * @returns Deduplicated array with merged sources
   */
  deduplicateNews(newsItems: RawNewsInput[]): RawNewsInput[] {
    const deduped = new Map<string, RawNewsInput>();

    for (const item of newsItems) {
      // Use title as the deduplication key
      const key = item.title.toLowerCase().trim();
      
      if (deduped.has(key)) {
        // Merge sources
        const existing = deduped.get(key)!;
        const existingSources = existing.source.split(', ');
        
        if (!existingSources.includes(item.source)) {
          existing.source = `${existing.source}, ${item.source}`;
          // Use higher credibility
          existing.sourceCredibility = this.getHigherCredibility(
            existing.sourceCredibility || 'medium',
            item.sourceCredibility || 'medium'
          );
        }
        
        // Merge symbols
        if (item.symbols) {
          const existingSymbols = new Set(existing.symbols || []);
          item.symbols.forEach(s => existingSymbols.add(s));
          existing.symbols = Array.from(existingSymbols);
        }
        
        // Merge sectors
        if (item.sectors) {
          const existingSectors = new Set(existing.sectors || []);
          item.sectors.forEach(s => existingSectors.add(s));
          existing.sectors = Array.from(existingSectors);
        }
      } else {
        // Add new item (clone to avoid mutation)
        deduped.set(key, {
          ...item,
          symbols: item.symbols ? [...item.symbols] : [],
          sectors: item.sectors ? [...item.sectors] : [],
        });
      }
    }

    return Array.from(deduped.values());
  }
}

// Export singleton instance
export const newsService = new NewsService();
