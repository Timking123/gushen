import api from './api'

/**
 * Market index quote interface
 * Represents a major market index
 */
export interface MarketIndex {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  previousClose: number
  open: number
  high: number
  low: number
  volume: number
  timestamp: string
}

/**
 * Market breadth data interface
 * Represents advance/decline statistics
 */
export interface MarketBreadth {
  advancing: number
  declining: number
  unchanged: number
  total: number
  advanceDeclineRatio: number
  advanceVolume: number
  declineVolume: number
  totalVolume: number
}

/**
 * Market sentiment interface
 * Represents overall market sentiment indicators
 */
export interface MarketSentiment {
  sentiment: 'bullish' | 'bearish' | 'neutral'
  score: number // -100 to 100
  breadth: MarketBreadth
  fearGreedIndex: number // 0 to 100
  description: string
}

/**
 * Stock ranking item interface
 * Represents a stock in a leaderboard
 */
export interface StockRankingItem {
  symbol: string
  name: string
  sector: string | null
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap: number | null
}

/**
 * Market leaderboards interface
 * Contains top gainers, losers, and volume leaders
 */
export interface MarketLeaderboards {
  topGainers: StockRankingItem[]
  topLosers: StockRankingItem[]
  mostActive: StockRankingItem[]
  lastUpdated: string
}

/**
 * Market overview response interface
 */
export interface MarketOverview {
  indices: MarketIndex[]
  sentiment: MarketSentiment
  leaderboards: MarketLeaderboards
  lastUpdated: string
}

/**
 * Market API service
 * Implements Requirements 18.1, 18.4, 18.5:
 * - 18.1: Display major indices (Dow Jones, S&P 500, NASDAQ) real-time quotes
 * - 18.4: Display advance/decline counts and market sentiment indicators
 * - 18.5: Display top gainers, losers, and volume leaders
 */
export const marketApi = {
  /**
   * Get major market indices quotes
   * Implements Requirement 18.1
   * @returns Array of market index quotes
   */
  async getMarketIndices(): Promise<MarketIndex[]> {
    const response = await api.get<{ success: boolean; data: MarketIndex[] }>('/market/indices')
    return response.data.data
  },

  /**
   * Get market breadth data (advance/decline statistics)
   * Implements Requirement 18.4
   * @returns Market breadth statistics
   */
  async getMarketBreadth(): Promise<MarketBreadth> {
    const response = await api.get<{ success: boolean; data: MarketBreadth }>('/market/breadth')
    return response.data.data
  },

  /**
   * Get market sentiment indicators
   * Implements Requirement 18.4
   * @returns Market sentiment data
   */
  async getMarketSentiment(): Promise<MarketSentiment> {
    const response = await api.get<{ success: boolean; data: MarketSentiment }>('/market/sentiment')
    return response.data.data
  },

  /**
   * Get top gaining stocks
   * Implements Requirement 18.5
   * @param limit - Maximum number of stocks (default: 10)
   * @returns Array of top gaining stocks
   */
  async getTopGainers(limit: number = 10): Promise<{ count: number; stocks: StockRankingItem[] }> {
    const response = await api.get<{
      success: boolean
      data: { count: number; stocks: StockRankingItem[] }
    }>('/market/gainers', { params: { limit } })
    return response.data.data
  },

  /**
   * Get top losing stocks
   * Implements Requirement 18.5
   * @param limit - Maximum number of stocks (default: 10)
   * @returns Array of top losing stocks
   */
  async getTopLosers(limit: number = 10): Promise<{ count: number; stocks: StockRankingItem[] }> {
    const response = await api.get<{
      success: boolean
      data: { count: number; stocks: StockRankingItem[] }
    }>('/market/losers', { params: { limit } })
    return response.data.data
  },

  /**
   * Get most active stocks by volume
   * Implements Requirement 18.5
   * @param limit - Maximum number of stocks (default: 10)
   * @returns Array of most active stocks
   */
  async getMostActive(limit: number = 10): Promise<{ count: number; stocks: StockRankingItem[] }> {
    const response = await api.get<{
      success: boolean
      data: { count: number; stocks: StockRankingItem[] }
    }>('/market/most-active', { params: { limit } })
    return response.data.data
  },

  /**
   * Get all market leaderboards
   * Implements Requirement 18.5
   * @param limit - Maximum number of stocks per leaderboard (default: 10)
   * @returns Market leaderboards with gainers, losers, and most active
   */
  async getLeaderboards(limit: number = 10): Promise<MarketLeaderboards> {
    const response = await api.get<{ success: boolean; data: MarketLeaderboards }>(
      '/market/leaderboards',
      { params: { limit } }
    )
    return response.data.data
  },

  /**
   * Get complete market overview
   * Combines indices, sentiment, and leaderboards
   * @param limit - Maximum stocks per leaderboard (default: 10)
   * @returns Complete market overview data
   */
  async getMarketOverview(limit: number = 10): Promise<MarketOverview> {
    const response = await api.get<{ success: boolean; data: MarketOverview }>('/market/overview', {
      params: { limit },
    })
    return response.data.data
  },
}
