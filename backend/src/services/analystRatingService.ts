/**
 * Analyst Rating Service
 * Implements Requirements 19.1, 19.2, 19.3, 19.4:
 * - 19.1: Display analyst composite rating and target price
 * - 19.2: Display individual analyst ratings from each institution
 * - 19.3: Push rating change notifications
 * - 19.4: Display rating change trends and target price adjustment history
 */

import { prisma } from '../lib/prisma.js';
import { pushService, PushMessage } from './pushService.js';
import { logger } from '../utils/logger.js';

/**
 * Rating type enum
 */
export type RatingType = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';

/**
 * Analyst rating interface
 */
export interface AnalystRatingData {
  id: string;
  symbol: string;
  analyst: string;
  firm: string;
  rating: RatingType;
  targetPrice: number | null;
  previousRating: RatingType | null;
  previousTargetPrice: number | null;
  ratingDate: Date;
  createdAt: Date;
}

/**
 * Composite rating interface
 */
export interface CompositeRating {
  symbol: string;
  consensusRating: RatingType;
  averageTargetPrice: number | null;
  highTargetPrice: number | null;
  lowTargetPrice: number | null;
  numberOfAnalysts: number;
  ratingDistribution: {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
  };
  lastUpdated: Date;
}

/**
 * Rating change interface
 */
export interface RatingChange {
  id: string;
  analyst: string;
  firm: string;
  previousRating: RatingType | null;
  newRating: RatingType;
  previousTargetPrice: number | null;
  newTargetPrice: number | null;
  ratingDate: Date;
  changeType: 'upgrade' | 'downgrade' | 'maintain' | 'initiate';
}

/**
 * Convert rating string to numeric value for calculations
 */
export function ratingToNumeric(rating: RatingType): number {
  const ratingMap: Record<RatingType, number> = {
    strong_buy: 5,
    buy: 4,
    hold: 3,
    sell: 2,
    strong_sell: 1,
  };
  return ratingMap[rating] || 3;
}

/**
 * Convert numeric value to rating string
 */
export function numericToRating(value: number): RatingType {
  if (value >= 4.5) return 'strong_buy';
  if (value >= 3.5) return 'buy';
  if (value >= 2.5) return 'hold';
  if (value >= 1.5) return 'sell';
  return 'strong_sell';
}

/**
 * Determine change type based on previous and new ratings
 */
export function getChangeType(
  previousRating: RatingType | null,
  newRating: RatingType
): 'upgrade' | 'downgrade' | 'maintain' | 'initiate' {
  if (!previousRating) return 'initiate';
  
  const prevValue = ratingToNumeric(previousRating);
  const newValue = ratingToNumeric(newRating);
  
  if (newValue > prevValue) return 'upgrade';
  if (newValue < prevValue) return 'downgrade';
  return 'maintain';
}

export const analystRatingService = {
  /**
   * Get all analyst ratings for a stock
   * Implements Requirement 19.2
   */
  async getRatings(
    symbol: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ ratings: AnalystRatingData[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    const [ratings, total] = await Promise.all([
      prisma.analystRating.findMany({
        where: { symbol },
        orderBy: { ratingDate: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.analystRating.count({ where: { symbol } }),
    ]);

    return {
      ratings: ratings.map(r => ({
        ...r,
        rating: r.rating as RatingType,
        previousRating: r.previousRating as RatingType | null,
      })),
      total,
    };
  },

  /**
   * Get composite rating for a stock
   * Implements Requirement 19.1
   */
  async getCompositeRating(symbol: string): Promise<CompositeRating | null> {
    // Get the most recent rating from each analyst/firm
    const latestRatings = await prisma.$queryRaw<
      Array<{
        symbol: string;
        analyst: string;
        firm: string;
        rating: string;
        target_price: number | null;
        rating_date: Date;
      }>
    >`
      SELECT DISTINCT ON (analyst, firm) 
        symbol, analyst, firm, rating, target_price, rating_date
      FROM analyst_ratings
      WHERE symbol = ${symbol}
      ORDER BY analyst, firm, rating_date DESC
    `;

    if (latestRatings.length === 0) {
      return null;
    }

    // Calculate distribution
    const distribution = {
      strongBuy: 0,
      buy: 0,
      hold: 0,
      sell: 0,
      strongSell: 0,
    };

    let totalScore = 0;
    const targetPrices: number[] = [];

    for (const rating of latestRatings) {
      const ratingType = rating.rating as RatingType;
      totalScore += ratingToNumeric(ratingType);

      switch (ratingType) {
        case 'strong_buy':
          distribution.strongBuy++;
          break;
        case 'buy':
          distribution.buy++;
          break;
        case 'hold':
          distribution.hold++;
          break;
        case 'sell':
          distribution.sell++;
          break;
        case 'strong_sell':
          distribution.strongSell++;
          break;
      }

      if (rating.target_price !== null) {
        targetPrices.push(rating.target_price);
      }
    }

    const avgScore = totalScore / latestRatings.length;
    const consensusRating = numericToRating(avgScore);

    return {
      symbol,
      consensusRating,
      averageTargetPrice:
        targetPrices.length > 0
          ? targetPrices.reduce((a, b) => a + b, 0) / targetPrices.length
          : null,
      highTargetPrice: targetPrices.length > 0 ? Math.max(...targetPrices) : null,
      lowTargetPrice: targetPrices.length > 0 ? Math.min(...targetPrices) : null,
      numberOfAnalysts: latestRatings.length,
      ratingDistribution: distribution,
      lastUpdated: new Date(
        Math.max(...latestRatings.map(r => new Date(r.rating_date).getTime()))
      ),
    };
  },

  /**
   * Get rating changes history
   * Implements Requirement 19.4
   */
  async getRatingChanges(
    symbol: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ changes: RatingChange[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    const [ratings, total] = await Promise.all([
      prisma.analystRating.findMany({
        where: { symbol },
        orderBy: { ratingDate: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.analystRating.count({ where: { symbol } }),
    ]);

    const changes: RatingChange[] = ratings.map(r => ({
      id: r.id,
      analyst: r.analyst,
      firm: r.firm,
      previousRating: r.previousRating as RatingType | null,
      newRating: r.rating as RatingType,
      previousTargetPrice: r.previousTargetPrice,
      newTargetPrice: r.targetPrice,
      ratingDate: r.ratingDate,
      changeType: getChangeType(
        r.previousRating as RatingType | null,
        r.rating as RatingType
      ),
    }));

    return { changes, total };
  },

  /**
   * Add a new analyst rating
   */
  async addRating(data: {
    symbol: string;
    analyst: string;
    firm: string;
    rating: RatingType;
    targetPrice?: number | null;
    ratingDate: Date;
  }): Promise<AnalystRatingData> {
    // Get the previous rating from this analyst/firm
    const previousRating = await prisma.analystRating.findFirst({
      where: {
        symbol: data.symbol,
        analyst: data.analyst,
        firm: data.firm,
      },
      orderBy: { ratingDate: 'desc' },
    });

    const rating = await prisma.analystRating.create({
      data: {
        symbol: data.symbol,
        analyst: data.analyst,
        firm: data.firm,
        rating: data.rating,
        targetPrice: data.targetPrice ?? null,
        previousRating: previousRating?.rating ?? null,
        previousTargetPrice: previousRating?.targetPrice ?? null,
        ratingDate: data.ratingDate,
      },
    });

    return {
      ...rating,
      rating: rating.rating as RatingType,
      previousRating: rating.previousRating as RatingType | null,
    };
  },

  /**
   * Get ratings by firm
   */
  async getRatingsByFirm(
    firm: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ ratings: AnalystRatingData[]; total: number }> {
    const { limit = 20, offset = 0 } = options;

    const [ratings, total] = await Promise.all([
      prisma.analystRating.findMany({
        where: { firm },
        orderBy: { ratingDate: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.analystRating.count({ where: { firm } }),
    ]);

    return {
      ratings: ratings.map(r => ({
        ...r,
        rating: r.rating as RatingType,
        previousRating: r.previousRating as RatingType | null,
      })),
      total,
    };
  },

  /**
   * Get recent rating changes across all stocks
   */
  async getRecentChanges(
    options: { limit?: number; changeTypes?: Array<'upgrade' | 'downgrade'> } = {}
  ): Promise<RatingChange[]> {
    const { limit = 20, changeTypes } = options;

    const ratings = await prisma.analystRating.findMany({
      where: changeTypes
        ? {
            previousRating: { not: null },
          }
        : undefined,
      orderBy: { ratingDate: 'desc' },
      take: limit * 2, // Get more to filter
    });

    let changes: RatingChange[] = ratings.map(r => ({
      id: r.id,
      analyst: r.analyst,
      firm: r.firm,
      previousRating: r.previousRating as RatingType | null,
      newRating: r.rating as RatingType,
      previousTargetPrice: r.previousTargetPrice,
      newTargetPrice: r.targetPrice,
      ratingDate: r.ratingDate,
      changeType: getChangeType(
        r.previousRating as RatingType | null,
        r.rating as RatingType
      ),
    }));

    // Filter by change types if specified
    if (changeTypes) {
      changes = changes.filter(c => changeTypes.includes(c.changeType as 'upgrade' | 'downgrade'));
    }

    return changes.slice(0, limit);
  },

  /**
   * Format rating for display
   */
  formatRating(rating: RatingType): string {
    const labels: Record<RatingType, string> = {
      strong_buy: '强烈买入',
      buy: '买入',
      hold: '持有',
      sell: '卖出',
      strong_sell: '强烈卖出',
    };
    return labels[rating];
  },

  /**
   * Push analyst rating change notification to subscribed users
   * Implements Requirement 19.3: 分析师调整评级时推送评级变化通知
   */
  async pushRatingChangeNotification(ratingData: AnalystRatingData): Promise<void> {
    const { symbol, analyst, firm, rating, previousRating, targetPrice, previousTargetPrice } = ratingData;

    // Only notify on actual rating changes (not initiations or maintains)
    const changeType = getChangeType(previousRating, rating);
    if (changeType === 'maintain') {
      return;
    }

    // Get stock name for better notification message
    const stock = await prisma.stock.findUnique({
      where: { symbol },
      select: { name: true },
    });

    const stockName = stock?.name || symbol;
    const newLabel = this.formatRating(rating);
    const previousLabel = previousRating ? this.formatRating(previousRating) : null;

    // Determine priority based on change significance
    const priority: 'high' | 'medium' | 'low' = 
      changeType === 'upgrade' && rating === 'strong_buy' ? 'high' :
      changeType === 'downgrade' && rating === 'strong_sell' ? 'high' :
      'medium';

    // Build notification message
    let title: string;
    let messageText: string;

    if (changeType === 'initiate') {
      title = `${firm} 首次覆盖 ${stockName}`;
      messageText = `${firm} 分析师 ${analyst} 首次覆盖 ${stockName} (${symbol})，评级为 ${newLabel}`;
      if (targetPrice) {
        messageText += `，目标价 $${targetPrice.toFixed(2)}`;
      }
    } else {
      title = changeType === 'upgrade' 
        ? `${stockName} 获分析师上调评级` 
        : `${stockName} 被分析师下调评级`;
      messageText = `${firm} 分析师 ${analyst} 将 ${stockName} (${symbol}) 评级从 ${previousLabel} 调整为 ${newLabel}`;
      if (targetPrice && previousTargetPrice) {
        const priceChange = targetPrice - previousTargetPrice;
        const priceChangeStr = priceChange >= 0 ? `+$${priceChange.toFixed(2)}` : `-$${Math.abs(priceChange).toFixed(2)}`;
        messageText += `，目标价调整至 $${targetPrice.toFixed(2)} (${priceChangeStr})`;
      } else if (targetPrice) {
        messageText += `，目标价 $${targetPrice.toFixed(2)}`;
      }
    }

    const message: PushMessage = {
      type: 'rating',
      symbol,
      title,
      message: messageText,
      priority,
      metadata: {
        analyst,
        firm,
        previousRating,
        newRating: rating,
        previousTargetPrice,
        newTargetPrice: targetPrice,
        changeType,
        ratingDate: ratingData.ratingDate.toISOString(),
      },
    };

    // Find users who have this stock in their watchlist
    const subscribedUsers = await prisma.watchlistItem.findMany({
      where: { symbol },
      select: { userId: true },
    });

    // Push notification to each subscribed user
    for (const { userId } of subscribedUsers) {
      try {
        await pushService.pushToUser(userId, message);
        logger.debug(`Analyst rating change notification sent to user ${userId} for ${symbol}`);
      } catch (error) {
        logger.error(`Failed to send analyst rating change notification to user ${userId}:`, error);
      }
    }

    // Also broadcast to stock subscribers via WebSocket
    try {
      await pushService.broadcastToStock(symbol, message);
      logger.info(`Analyst rating change notification broadcasted for ${symbol}: ${firm} ${changeType} to ${newLabel}`);
    } catch (error) {
      logger.error(`Failed to broadcast analyst rating change for ${symbol}:`, error);
    }
  },

  /**
   * Add a new analyst rating and send notification if rating changed
   * Implements Requirements 19.3, 19.4
   */
  async addRatingWithNotification(data: {
    symbol: string;
    analyst: string;
    firm: string;
    rating: RatingType;
    targetPrice?: number | null;
    ratingDate: Date;
  }): Promise<AnalystRatingData> {
    const ratingData = await this.addRating(data);
    
    // Send notification for rating changes
    await this.pushRatingChangeNotification(ratingData);
    
    return ratingData;
  },
};
