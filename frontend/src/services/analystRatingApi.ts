import api from './api'

/**
 * Rating type enum
 */
export type RatingType = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'

/**
 * Analyst rating interface
 * Implements Requirement 19.2: Display individual analyst ratings from each institution
 */
export interface AnalystRatingData {
  id: string
  symbol: string
  analyst: string
  firm: string
  rating: RatingType
  targetPrice: number | null
  previousRating: RatingType | null
  previousTargetPrice: number | null
  ratingDate: string
  createdAt: string
}

/**
 * Composite rating interface
 * Implements Requirement 19.1: Display analyst composite rating and target price
 */
export interface CompositeRating {
  symbol: string
  consensusRating: RatingType
  averageTargetPrice: number | null
  highTargetPrice: number | null
  lowTargetPrice: number | null
  numberOfAnalysts: number
  ratingDistribution: {
    strongBuy: number
    buy: number
    hold: number
    sell: number
    strongSell: number
  }
  lastUpdated: string
}

/**
 * Rating change interface
 * Implements Requirement 19.4: Display rating change trends
 */
export interface RatingChange {
  id: string
  analyst: string
  firm: string
  previousRating: RatingType | null
  newRating: RatingType
  previousTargetPrice: number | null
  newTargetPrice: number | null
  ratingDate: string
  changeType: 'upgrade' | 'downgrade' | 'maintain' | 'initiate'
}

/**
 * API response wrapper
 */
interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

/**
 * Paginated response
 */
interface PaginatedData<T> {
  ratings?: T[]
  changes?: T[]
  total: number
}

/**
 * Analyst Rating API service
 * Implements Requirements:
 * - 19.1: WHEN 用户查看股票详情 THEN Stock_Analyzer SHALL 显示分析师综合评级和目标价
 * - 19.2: WHEN 用户查看评级详情 THEN Stock_Analyzer SHALL 显示各机构分析师的具体评级和目标价
 * - 19.6: WHEN 显示分析师评级 THEN Stock_Analyzer SHALL 标注评级发布日期和分析师所属机构
 */
export const analystRatingApi = {
  /**
   * Get all analyst ratings for a stock
   * @param symbol - Stock symbol
   * @param limit - Maximum number of results (default: 20)
   * @param offset - Offset for pagination (default: 0)
   * @returns Paginated analyst ratings
   * 
   * Implements Requirement 19.2
   */
  async getRatings(
    symbol: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ ratings: AnalystRatingData[]; total: number }> {
    const response = await api.get<ApiResponse<PaginatedData<AnalystRatingData>>>(
      `/analyst-ratings/${symbol}`,
      { params: { limit, offset } }
    )
    return {
      ratings: response.data.data.ratings || [],
      total: response.data.data.total,
    }
  },

  /**
   * Get composite rating for a stock
   * @param symbol - Stock symbol
   * @returns Composite rating data
   * 
   * Implements Requirement 19.1
   */
  async getCompositeRating(symbol: string): Promise<CompositeRating | null> {
    try {
      const response = await api.get<ApiResponse<CompositeRating>>(
        `/analyst-ratings/${symbol}/composite`
      )
      return response.data.data
    } catch (error: unknown) {
      // Return null if no ratings found (404)
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } }
        if (axiosError.response?.status === 404) {
          return null
        }
      }
      throw error
    }
  },

  /**
   * Get rating changes history for a stock
   * @param symbol - Stock symbol
   * @param limit - Maximum number of results (default: 20)
   * @param offset - Offset for pagination (default: 0)
   * @returns Paginated rating changes
   * 
   * Implements Requirement 19.4
   */
  async getRatingChanges(
    symbol: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ changes: RatingChange[]; total: number }> {
    const response = await api.get<ApiResponse<PaginatedData<RatingChange>>>(
      `/analyst-ratings/${symbol}/changes`,
      { params: { limit, offset } }
    )
    return {
      changes: response.data.data.changes || [],
      total: response.data.data.total,
    }
  },

  /**
   * Get recent rating changes across all stocks
   * @param limit - Maximum number of results (default: 20)
   * @param changeTypes - Filter by change types (upgrade/downgrade)
   * @returns Array of recent rating changes
   */
  async getRecentChanges(
    limit: number = 20,
    changeTypes?: Array<'upgrade' | 'downgrade'>
  ): Promise<RatingChange[]> {
    const params: Record<string, string | number> = { limit }
    if (changeTypes && changeTypes.length > 0) {
      params.changeTypes = changeTypes.join(',')
    }
    const response = await api.get<ApiResponse<RatingChange[]>>(
      '/analyst-ratings/recent/changes',
      { params }
    )
    return response.data.data
  },

  /**
   * Format rating for display
   * @param rating - Rating type
   * @returns Formatted rating label in Chinese
   */
  formatRating(rating: RatingType): string {
    const labels: Record<RatingType, string> = {
      strong_buy: '强烈买入',
      buy: '买入',
      hold: '持有',
      sell: '卖出',
      strong_sell: '强烈卖出',
    }
    return labels[rating]
  },

  /**
   * Format rating for display in English
   * @param rating - Rating type
   * @returns Formatted rating label in English
   */
  formatRatingEn(rating: RatingType): string {
    const labels: Record<RatingType, string> = {
      strong_buy: 'Strong Buy',
      buy: 'Buy',
      hold: 'Hold',
      sell: 'Sell',
      strong_sell: 'Strong Sell',
    }
    return labels[rating]
  },

  /**
   * Get rating color class
   * @param rating - Rating type
   * @returns CSS class name for the rating
   */
  getRatingColorClass(rating: RatingType): string {
    const classes: Record<RatingType, string> = {
      strong_buy: 'rating-strong-buy',
      buy: 'rating-buy',
      hold: 'rating-hold',
      sell: 'rating-sell',
      strong_sell: 'rating-strong-sell',
    }
    return classes[rating]
  },

  /**
   * Get change type label
   * @param changeType - Change type
   * @returns Formatted change type label
   */
  formatChangeType(changeType: 'upgrade' | 'downgrade' | 'maintain' | 'initiate'): string {
    const labels: Record<string, string> = {
      upgrade: '上调',
      downgrade: '下调',
      maintain: '维持',
      initiate: '首次覆盖',
    }
    return labels[changeType]
  },
}
