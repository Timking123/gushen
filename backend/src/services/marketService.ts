/**
 * Market Service
 * Handles market overview data including major indices, market breadth, and leaderboards
 * 
 * Requirements:
 * - 18.1: Display major indices (Dow Jones, S&P 500, NASDAQ) real-time quotes
 * - 18.4: Display advance/decline counts, volume, and market sentiment indicators
 * - 18.5: Display top gainers, losers, and volume leaders
 */

import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';
import { CacheKeys, CacheTTL } from '../lib/cache-keys.js';
import { logger } from '../utils/logger.js';
import { finnhubService } from './finnhubService.js';

/**
 * Market index quote interface
 * Represents a major market index
 */
export interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  timestamp: Date;
}

/**
 * Market breadth data interface
 * Represents advance/decline statistics
 */
export interface MarketBreadth {
  advancing: number;
  declining: number;
  unchanged: number;
  total: number;
  advanceDeclineRatio: number;
  advanceVolume: number;
  declineVolume: number;
  totalVolume: number;
}

/**
 * Market sentiment interface
 * Represents overall market sentiment indicators
 */
export interface MarketSentiment {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  score: number; // -100 to 100
  breadth: MarketBreadth;
  fearGreedIndex: number; // 0 to 100
  description: string;
}

/**
 * Stock ranking item interface
 * Represents a stock in a leaderboard
 */
export interface StockRankingItem {
  symbol: string;
  name: string;
  sector: string | null;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number | null;
}

/**
 * Market leaderboards interface
 * Contains top gainers, losers, and volume leaders
 */
export interface MarketLeaderboards {
  topGainers: StockRankingItem[];
  topLosers: StockRankingItem[];
  mostActive: StockRankingItem[];
  lastUpdated: string;
}

/**
 * Market overview response interface
 */
export interface MarketOverview {
  indices: MarketIndex[];
  sentiment: MarketSentiment;
  leaderboards: MarketLeaderboards;
  lastUpdated: string;
}

/**
 * Major market indices symbols
 */
const MAJOR_INDICES = [
  { symbol: 'DJI', name: '道琼斯工业平均指数' },
  { symbol: 'SPX', name: '标普500指数' },
  { symbol: 'IXIC', name: '纳斯达克综合指数' },
];

/**
 * MarketService - Handles market overview data operations
 * Implements Requirements 18.1, 18.4, 18.5
 */
export class MarketService {
  /**
   * Get major market indices quotes
   * Implements Requirement 18.1: Display major indices real-time quotes
   * 
   * Note: Finnhub free tier doesn't support index quotes directly,
   * so we use ETFs that track these indices as proxies:
   * - DJI (Dow Jones) -> DIA ETF
   * - SPX (S&P 500) -> SPY ETF  
   * - IXIC (NASDAQ) -> QQQ ETF
   * 
   * @returns Array of market index quotes
   */
  async getMarketIndices(): Promise<MarketIndex[]> {
    // Check cache first
    const cacheKey = CacheKeys.market.indices();
    try {
      const cachedData = await redisHelpers.getJson<MarketIndex[]>(cacheKey);
      if (cachedData) {
        logger.debug('Market indices cache hit');
        return cachedData.map(index => ({
          ...index,
          timestamp: new Date(index.timestamp),
        }));
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // ETF proxies for major indices
    const indexProxies: Record<string, { etf: string; multiplier: number }> = {
      'DJI': { etf: 'DIA', multiplier: 100 },   // DIA tracks Dow/100
      'SPX': { etf: 'SPY', multiplier: 10 },    // SPY tracks S&P/10
      'IXIC': { etf: 'QQQ', multiplier: 40 },   // QQQ roughly tracks NASDAQ/40
    };

    const indices: MarketIndex[] = [];
    
    for (const indexInfo of MAJOR_INDICES) {
      const proxy = indexProxies[indexInfo.symbol];
      
      if (proxy) {
        // Try to get real-time data from Finnhub via ETF proxy
        try {
          const quote = await finnhubService.getQuote(proxy.etf);
          if (quote && quote.c > 0) {
            indices.push({
              symbol: indexInfo.symbol,
              name: indexInfo.name,
              price: Math.round(quote.c * proxy.multiplier * 100) / 100,
              change: Math.round((quote.d || 0) * proxy.multiplier * 100) / 100,
              changePercent: quote.dp || 0,
              previousClose: Math.round(quote.pc * proxy.multiplier * 100) / 100,
              open: Math.round(quote.o * proxy.multiplier * 100) / 100,
              high: Math.round(quote.h * proxy.multiplier * 100) / 100,
              low: Math.round(quote.l * proxy.multiplier * 100) / 100,
              volume: 0,
              timestamp: new Date(quote.t * 1000),
            });
            continue;
          }
        } catch (error) {
          logger.warn(`Failed to get ETF proxy quote for ${indexInfo.symbol}:`, error);
        }
      }

      // Fallback to database
      const dbQuote = await prisma.stockQuote.findFirst({
        where: { symbol: indexInfo.symbol },
        orderBy: { timestamp: 'desc' },
      });

      if (dbQuote) {
        indices.push({
          symbol: indexInfo.symbol,
          name: indexInfo.name,
          price: dbQuote.price,
          change: dbQuote.change,
          changePercent: dbQuote.changePercent,
          previousClose: dbQuote.previousClose,
          open: dbQuote.open,
          high: dbQuote.high,
          low: dbQuote.low,
          volume: Number(dbQuote.volume),
          timestamp: dbQuote.timestamp,
        });
      } else {
        // Generate mock data if no real data exists
        indices.push(this.generateMockIndexData(indexInfo.symbol, indexInfo.name));
      }
    }

    // Cache the result
    try {
      await redisHelpers.setJson(cacheKey, indices, CacheTTL.indices);
      logger.debug('Market indices cached');
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return indices;
  }

  /**
   * Calculate market breadth (advancing vs declining stocks)
   * Implements Requirement 18.4: Display advance/decline counts
   * 
   * @returns Market breadth statistics
   */
  async calculateMarketBreadth(): Promise<MarketBreadth> {
    // Get all stocks with their latest quotes
    const stocks = await prisma.stock.findMany({
      select: { symbol: true },
    });

    const symbols = stocks.map(s => s.symbol);
    
    // Get latest quotes for all stocks
    const quotes = await prisma.stockQuote.findMany({
      where: { symbol: { in: symbols } },
      orderBy: { timestamp: 'desc' },
      distinct: ['symbol'],
    });

    let advancing = 0;
    let declining = 0;
    let unchanged = 0;
    let advanceVolume = 0;
    let declineVolume = 0;
    let totalVolume = 0;

    for (const quote of quotes) {
      const volume = Number(quote.volume);
      totalVolume += volume;

      if (quote.changePercent > 0) {
        advancing++;
        advanceVolume += volume;
      } else if (quote.changePercent < 0) {
        declining++;
        declineVolume += volume;
      } else {
        unchanged++;
      }
    }

    const total = advancing + declining + unchanged;
    const advanceDeclineRatio = declining > 0 ? advancing / declining : advancing > 0 ? Infinity : 1;

    return {
      advancing,
      declining,
      unchanged,
      total,
      advanceDeclineRatio: Number.isFinite(advanceDeclineRatio) ? Math.round(advanceDeclineRatio * 100) / 100 : 999,
      advanceVolume,
      declineVolume,
      totalVolume,
    };
  }

  /**
   * Calculate market sentiment based on breadth and other indicators
   * Implements Requirement 18.4: Display market sentiment indicators
   * 
   * @returns Market sentiment data
   */
  async getMarketSentiment(): Promise<MarketSentiment> {
    // Check cache first
    const cacheKey = CacheKeys.market.sentiment();
    try {
      const cachedData = await redisHelpers.getJson<MarketSentiment>(cacheKey);
      if (cachedData) {
        logger.debug('Market sentiment cache hit');
        return cachedData;
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    const breadth = await this.calculateMarketBreadth();
    
    // Calculate sentiment score based on breadth
    // Score ranges from -100 (extremely bearish) to 100 (extremely bullish)
    let score = 0;
    
    if (breadth.total > 0) {
      // Base score on advance/decline ratio
      const advanceRatio = breadth.advancing / breadth.total;
      const declineRatio = breadth.declining / breadth.total;
      score = Math.round((advanceRatio - declineRatio) * 100);
    }

    // Calculate fear/greed index (0-100)
    // Based on advance/decline ratio and volume
    let fearGreedIndex = 50; // Neutral
    if (breadth.total > 0) {
      const advanceRatio = breadth.advancing / breadth.total;
      fearGreedIndex = Math.round(advanceRatio * 100);
    }

    // Determine sentiment category
    let sentiment: 'bullish' | 'bearish' | 'neutral';
    let description: string;

    if (score > 20) {
      sentiment = 'bullish';
      description = score > 50 ? '市场情绪极度乐观' : '市场情绪偏向乐观';
    } else if (score < -20) {
      sentiment = 'bearish';
      description = score < -50 ? '市场情绪极度悲观' : '市场情绪偏向悲观';
    } else {
      sentiment = 'neutral';
      description = '市场情绪中性';
    }

    const result: MarketSentiment = {
      sentiment,
      score,
      breadth,
      fearGreedIndex,
      description,
    };

    // Cache the result
    try {
      await redisHelpers.setJson(cacheKey, result, CacheTTL.gainersLosers);
      logger.debug('Market sentiment cached');
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return result;
  }

  /**
   * Get top gainers list
   * Implements Requirement 18.5: Display top gainers
   * 
   * @param limit - Maximum number of stocks to return (default: 10)
   * @returns Array of top gaining stocks sorted by changePercent descending
   */
  async getTopGainers(limit: number = 10): Promise<StockRankingItem[]> {
    // Check cache first
    const cacheKey = CacheKeys.market.gainers();
    try {
      const cachedData = await redisHelpers.getJson<StockRankingItem[]>(cacheKey);
      if (cachedData) {
        logger.debug('Top gainers cache hit');
        return cachedData.slice(0, limit);
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    const gainers = await this.getRankedStocks('gainers', 50);

    // Cache the result
    try {
      await redisHelpers.setJson(cacheKey, gainers, CacheTTL.gainersLosers);
      logger.debug('Top gainers cached');
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return gainers.slice(0, limit);
  }

  /**
   * Get top losers list
   * Implements Requirement 18.5: Display top losers
   * 
   * @param limit - Maximum number of stocks to return (default: 10)
   * @returns Array of top losing stocks sorted by changePercent ascending
   */
  async getTopLosers(limit: number = 10): Promise<StockRankingItem[]> {
    // Check cache first
    const cacheKey = CacheKeys.market.losers();
    try {
      const cachedData = await redisHelpers.getJson<StockRankingItem[]>(cacheKey);
      if (cachedData) {
        logger.debug('Top losers cache hit');
        return cachedData.slice(0, limit);
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    const losers = await this.getRankedStocks('losers', 50);

    // Cache the result
    try {
      await redisHelpers.setJson(cacheKey, losers, CacheTTL.gainersLosers);
      logger.debug('Top losers cached');
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return losers.slice(0, limit);
  }

  /**
   * Get most active stocks by volume
   * Implements Requirement 18.5: Display volume leaders
   * 
   * @param limit - Maximum number of stocks to return (default: 10)
   * @returns Array of most active stocks sorted by volume descending
   */
  async getMostActive(limit: number = 10): Promise<StockRankingItem[]> {
    // Check cache first
    const cacheKey = CacheKeys.market.mostActive();
    try {
      const cachedData = await redisHelpers.getJson<StockRankingItem[]>(cacheKey);
      if (cachedData) {
        logger.debug('Most active cache hit');
        return cachedData.slice(0, limit);
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    const mostActive = await this.getRankedStocks('volume', 50);

    // Cache the result
    try {
      await redisHelpers.setJson(cacheKey, mostActive, CacheTTL.gainersLosers);
      logger.debug('Most active cached');
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return mostActive.slice(0, limit);
  }

  /**
   * Get all market leaderboards
   * Implements Requirement 18.5: Display all leaderboards
   * 
   * @param limit - Maximum number of stocks per leaderboard (default: 10)
   * @returns Market leaderboards with gainers, losers, and most active
   */
  async getLeaderboards(limit: number = 10): Promise<MarketLeaderboards> {
    const [topGainers, topLosers, mostActive] = await Promise.all([
      this.getTopGainers(limit),
      this.getTopLosers(limit),
      this.getMostActive(limit),
    ]);

    return {
      topGainers,
      topLosers,
      mostActive,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get complete market overview
   * Combines indices, sentiment, and leaderboards
   * 
   * @param leaderboardLimit - Maximum stocks per leaderboard (default: 10)
   * @returns Complete market overview data
   */
  async getMarketOverview(leaderboardLimit: number = 10): Promise<MarketOverview> {
    const [indices, sentiment, leaderboards] = await Promise.all([
      this.getMarketIndices(),
      this.getMarketSentiment(),
      this.getLeaderboards(leaderboardLimit),
    ]);

    return {
      indices,
      sentiment,
      leaderboards,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get ranked stocks by type (gainers, losers, or volume)
   * Uses database quotes to avoid API rate limits
   * 
   * @param type - Ranking type
   * @param limit - Maximum number of stocks
   * @param maxChangePercent - Maximum absolute change percent for filtering (default: 100)
   * @returns Array of ranked stocks
   */
  private async getRankedStocks(
    type: 'gainers' | 'losers' | 'volume',
    limit: number,
    maxChangePercent: number = 100
  ): Promise<StockRankingItem[]> {
    // Get latest quotes from database with stock info
    // Use a subquery to get the latest quote for each symbol
    // Filter out stocks with price < $0.01 (less than 1 cent)
    const latestQuotes = await prisma.$queryRaw<Array<{
      symbol: string;
      price: number;
      change: number;
      changePercent: number;
      volume: bigint;
    }>>`
      SELECT DISTINCT ON (symbol) 
        symbol, price, change, change_percent as "changePercent", volume
      FROM stock_quotes
      WHERE change_percent IS NOT NULL
        AND price >= 0.01
      ORDER BY symbol, timestamp DESC
    `;

    // Get stock info for these symbols
    const symbols = latestQuotes.map(q => q.symbol);
    const stocks = await prisma.stock.findMany({
      where: { 
        symbol: { in: symbols },
        exchange: { not: 'INDEX' },
      },
      select: {
        symbol: true,
        name: true,
        sector: true,
        marketCap: true,
      },
    });

    const stockMap = new Map(stocks.map(s => [s.symbol, s]));

    // Build ranking items
    const items: StockRankingItem[] = latestQuotes
      .filter(q => stockMap.has(q.symbol))
      .map(q => {
        const stock = stockMap.get(q.symbol)!;
        // Treat price < $0.01 as zero price stock
        const price = q.price < 0.01 ? 0 : q.price;
        const changePercent = price === 0 ? 0 : q.changePercent;
        return {
          symbol: q.symbol,
          name: stock.name,
          sector: stock.sector,
          price: price,
          change: price === 0 ? 0 : q.change,
          changePercent: changePercent,
          volume: Number(q.volume),
          marketCap: stock.marketCap ? Number(stock.marketCap) : null,
        };
      });

    // Sort based on type
    switch (type) {
      case 'gainers':
        // Sort by changePercent descending, only positive changes within limit
        return items
          .filter(item => item.changePercent > 0 && item.changePercent <= maxChangePercent && item.price > 0)
          .sort((a, b) => b.changePercent - a.changePercent)
          .slice(0, limit);
      
      case 'losers':
        // Sort by changePercent ascending, only negative changes within limit
        return items
          .filter(item => item.changePercent < 0 && item.changePercent >= -maxChangePercent && item.price > 0)
          .sort((a, b) => a.changePercent - b.changePercent)
          .slice(0, limit);
      
      case 'volume':
        // Sort by volume descending, filter out extreme change percentages and zero price stocks
        return items
          .filter(item => Math.abs(item.changePercent) <= maxChangePercent && item.price > 0)
          .sort((a, b) => b.volume - a.volume)
          .slice(0, limit);
      
      default:
        return items.slice(0, limit);
    }
  }

  /**
   * Generate mock index data for demonstration
   * Used when no real data is available
   */
  private generateMockIndexData(symbol: string, name: string): MarketIndex {
    // Base prices for major indices
    const basePrices: Record<string, number> = {
      'DJI': 38500,
      'SPX': 5100,
      'IXIC': 16200,
    };

    const basePrice = basePrices[symbol] || 10000;
    const changePercent = (Math.random() - 0.5) * 4; // -2% to +2%
    const change = basePrice * (changePercent / 100);
    const price = basePrice + change;
    const previousClose = basePrice;
    const open = previousClose * (1 + (Math.random() - 0.5) * 0.01);
    const high = Math.max(price, open) * (1 + Math.random() * 0.005);
    const low = Math.min(price, open) * (1 - Math.random() * 0.005);

    return {
      symbol,
      name,
      price: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      previousClose: Math.round(previousClose * 100) / 100,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      volume: Math.floor(Math.random() * 500000000) + 100000000,
      timestamp: new Date(),
    };
  }
}

// Export singleton instance
export const marketService = new MarketService();
