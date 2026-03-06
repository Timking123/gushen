import api from './api'

/**
 * Transaction type for insider trades
 */
export type TransactionType = 'buy' | 'sell' | 'exercise'

/**
 * Insider trade interface
 * Represents a single insider trading record
 *
 * Implements Requirements:
 * - 12.1: Display recent insider trading records
 * - 12.2: Record trader identity, transaction type, quantity, and price
 */
export interface InsiderTrade {
  id: string
  symbol: string
  filedAt: string
  tradeDate: string
  insiderName: string
  insiderTitle: string | null
  transactionType: TransactionType
  shares: number
  pricePerShare: number
  totalValue: number
  sharesOwned: number | null
}

/**
 * Insider trading trend interface
 * Represents aggregated trading trend data
 *
 * Implements Requirement 12.6: Calculate and display net buy/sell trend
 */
export interface InsiderTradeTrend {
  symbol: string
  period: string
  totalBuyShares: number
  totalSellShares: number
  totalBuyValue: number
  totalSellValue: number
  netShares: number
  netValue: number
  buyTransactions: number
  sellTransactions: number
  exerciseTransactions: number
}

/**
 * Filter options for insider trades
 * Implements Requirement 12.5: Support filtering by transaction type, amount, date
 */
export interface InsiderTradeFilters {
  symbol?: string
  symbols?: string[]
  insiderName?: string
  transactionTypes?: TransactionType[]
  startDate?: string
  endDate?: string
  minValue?: number
  maxValue?: number
  minShares?: number
  maxShares?: number
  sortBy?: 'tradeDate' | 'filedAt' | 'totalValue' | 'shares' | 'insiderName'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

/**
 * Paginated insider trades response
 */
export interface InsiderTradesResponse {
  trades: InsiderTrade[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
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
 * Insider API service
 * Implements Requirements:
 * - 12.1: WHEN 用户查看股票详情 THEN Insider_Tracker SHALL 显示近期内部交易记录
 * - 12.5: WHEN 用户浏览内部交易列表 THEN Insider_Tracker SHALL 支持按交易类型、金额、日期筛选
 * - 12.6: WHEN 分析内部交易 THEN Insider_Tracker SHALL 计算并显示内部人士净买入/卖出趋势
 */
export const insiderApi = {
  /**
   * Get insider trades with optional filters
   * @param filters - Optional filter criteria
   * @returns Paginated insider trades
   */
  async getInsiderTrades(filters?: InsiderTradeFilters): Promise<InsiderTradesResponse> {
    const params: Record<string, string> = {}

    if (filters) {
      if (filters.symbol) params.symbol = filters.symbol
      if (filters.symbols?.length) params.symbols = filters.symbols.join(',')
      if (filters.insiderName) params.insiderName = filters.insiderName
      if (filters.transactionTypes?.length) params.transactionTypes = filters.transactionTypes.join(',')
      if (filters.startDate) params.startDate = filters.startDate
      if (filters.endDate) params.endDate = filters.endDate
      if (filters.minValue !== undefined) params.minValue = String(filters.minValue)
      if (filters.maxValue !== undefined) params.maxValue = String(filters.maxValue)
      if (filters.minShares !== undefined) params.minShares = String(filters.minShares)
      if (filters.maxShares !== undefined) params.maxShares = String(filters.maxShares)
      if (filters.sortBy) params.sortBy = filters.sortBy
      if (filters.sortOrder) params.sortOrder = filters.sortOrder
      if (filters.page) params.page = String(filters.page)
      if (filters.limit) params.limit = String(filters.limit)
    }

    const response = await api.get<ApiResponse<InsiderTradesResponse>>('/insider/trades', {
      params,
    })
    return response.data.data
  },

  /**
   * Get insider trades for a specific stock
   * @param symbol - Stock symbol
   * @param limit - Maximum number of trades (default: 20)
   * @returns Array of insider trades for the stock
   */
  async getInsiderTradesBySymbol(
    symbol: string,
    limit: number = 20
  ): Promise<{ symbol: string; count: number; trades: InsiderTrade[] }> {
    const response = await api.get<
      ApiResponse<{ symbol: string; count: number; trades: InsiderTrade[] }>
    >(`/insider/stock/${symbol}`, {
      params: { limit },
    })
    return response.data.data
  },

  /**
   * Get insider trading trend for a specific stock
   * @param symbol - Stock symbol
   * @param days - Number of days to analyze (default: 90)
   * @returns Insider trading trend data
   */
  async getInsiderTrend(symbol: string, days: number = 90): Promise<InsiderTradeTrend> {
    const response = await api.get<ApiResponse<InsiderTradeTrend>>(
      `/insider/stock/${symbol}/trend`,
      {
        params: { days },
      }
    )
    return response.data.data
  },

  /**
   * Get recent insider trades across all stocks
   * @param limit - Maximum number of trades (default: 50)
   * @returns Array of recent insider trades
   */
  async getRecentInsiderTrades(
    limit: number = 50
  ): Promise<{ count: number; trades: InsiderTrade[] }> {
    const response = await api.get<ApiResponse<{ count: number; trades: InsiderTrade[] }>>(
      '/insider/recent',
      {
        params: { limit },
      }
    )
    return response.data.data
  },

  /**
   * Get significant (large) insider trades
   * @param minValue - Minimum transaction value (default: 100000)
   * @param days - Number of days to look back (default: 30)
   * @param limit - Maximum number of trades (default: 50)
   * @returns Array of significant insider trades
   */
  async getSignificantInsiderTrades(
    minValue: number = 100000,
    days: number = 30,
    limit: number = 50
  ): Promise<{ minValue: number; days: number; count: number; trades: InsiderTrade[] }> {
    const response = await api.get<
      ApiResponse<{ minValue: number; days: number; count: number; trades: InsiderTrade[] }>
    >('/insider/significant', {
      params: { minValue, days, limit },
    })
    return response.data.data
  },

  /**
   * Get trades by a specific insider
   * @param name - Insider name
   * @param symbol - Optional stock symbol to filter by
   * @param limit - Maximum number of trades (default: 50)
   * @returns Insider's trading summary and trades
   */
  async getInsiderTradesByInsider(
    name: string,
    symbol?: string,
    limit: number = 50
  ): Promise<{
    insiderName: string
    totalTrades: number
    totalBuyValue: number
    totalSellValue: number
    trades: InsiderTrade[]
  }> {
    const params: Record<string, string> = { name }
    if (symbol) params.symbol = symbol
    params.limit = String(limit)

    const response = await api.get<
      ApiResponse<{
        insiderName: string
        totalTrades: number
        totalBuyValue: number
        totalSellValue: number
        trades: InsiderTrade[]
      }>
    >('/insider/insider', {
      params,
    })
    return response.data.data
  },
}
