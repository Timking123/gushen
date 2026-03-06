import api from './api'
import type { QuantRating, RatingHistoryEntry, RatingChangeEvent, OverallRating } from '../types'

/**
 * API response wrapper
 */
interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

/**
 * Sector/Industry ranking entry
 */
export interface RankingEntry {
  rank: number
  symbol: string
  name: string
  overallRating: OverallRating
  overallScore: number
  valuationScore: number
  growthScore: number
  profitabilityScore: number
  momentumScore: number
  revisionsScore: number
}

/**
 * Paginated rankings response
 */
export interface RankingsResponse {
  data: RankingEntry[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

/**
 * Quant Rating API service
 * Implements Requirements:
 * - 13.1: WHEN 用户查看股票详情 THEN Quant_Rating SHALL 显示综合量化评级
 * - 13.3: WHEN 用户查看评级详情 THEN Quant_Rating SHALL 展示各维度的具体得分和评级依据
 * - 13.4: WHEN 用户查看股票 THEN Quant_Rating SHALL 显示该股票在板块和行业中的排名
 * - 13.5: WHEN 量化评级发生变化 THEN Quant_Rating SHALL 记录评级历史并支持查看变化趋势
 */
export const quantRatingApi = {
  /**
   * Get quant rating for a stock
   * @param symbol - Stock symbol
   * @returns Quant rating data
   * 
   * Implements Requirements 13.1, 13.3, 13.4
   */
  async getQuantRating(symbol: string): Promise<QuantRating> {
    const response = await api.get<ApiResponse<QuantRating>>(`/quant-rating/${symbol}`)
    return response.data.data
  },

  /**
   * Get rating history for a stock
   * @param symbol - Stock symbol
   * @param limit - Maximum number of history entries (default: 50)
   * @returns Array of rating history entries
   * 
   * Implements Requirement 13.5
   */
  async getRatingHistory(symbol: string, limit: number = 50): Promise<RatingHistoryEntry[]> {
    const response = await api.get<ApiResponse<RatingHistoryEntry[]>>(
      `/quant-rating/${symbol}/history`,
      { params: { limit } }
    )
    return response.data.data
  },

  /**
   * Get rating change trend for a stock
   * @param symbol - Stock symbol
   * @param days - Number of days to look back (default: 90)
   * @returns Array of rating change events
   * 
   * Implements Requirement 13.5
   */
  async getRatingChanges(symbol: string, days: number = 90): Promise<RatingChangeEvent[]> {
    const response = await api.get<ApiResponse<RatingChangeEvent[]>>(
      `/quant-rating/${symbol}/changes`,
      { params: { days } }
    )
    return response.data.data
  },

  /**
   * Calculate and save a new quant rating for a stock
   * @param symbol - Stock symbol
   * @returns Calculated rating and change event if rating changed
   */
  async calculateRating(
    symbol: string
  ): Promise<{ rating: QuantRating; ratingChanged: boolean; changeEvent: RatingChangeEvent | null }> {
    const response = await api.post<
      ApiResponse<{ rating: QuantRating; ratingChanged: boolean; changeEvent: RatingChangeEvent | null }>
    >(`/quant-rating/${symbol}/calculate`)
    return response.data.data
  },

  /**
   * Get sector rankings
   * @param sector - Sector name
   * @param limit - Maximum number of results (default: 20)
   * @param offset - Offset for pagination (default: 0)
   * @returns Paginated sector rankings
   * 
   * Implements Requirement 13.4
   */
  async getSectorRankings(
    sector: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<RankingsResponse> {
    const response = await api.get<ApiResponse<RankingEntry[]> & { pagination: RankingsResponse['pagination'] }>(
      `/quant-rating/sector/${encodeURIComponent(sector)}/rankings`,
      { params: { limit, offset } }
    )
    return {
      data: response.data.data,
      pagination: response.data.pagination,
    }
  },

  /**
   * Get industry rankings
   * @param industry - Industry name
   * @param limit - Maximum number of results (default: 20)
   * @param offset - Offset for pagination (default: 0)
   * @returns Paginated industry rankings
   * 
   * Implements Requirement 13.4
   */
  async getIndustryRankings(
    industry: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<RankingsResponse> {
    const response = await api.get<ApiResponse<RankingEntry[]> & { pagination: RankingsResponse['pagination'] }>(
      `/quant-rating/industry/${encodeURIComponent(industry)}/rankings`,
      { params: { limit, offset } }
    )
    return {
      data: response.data.data,
      pagination: response.data.pagination,
    }
  },
}
