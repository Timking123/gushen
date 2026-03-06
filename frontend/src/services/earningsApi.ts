import api from './api'

/**
 * Earnings event timing type
 * BMO = Before Market Open
 * AMC = After Market Close
 */
export type EarningsTiming = 'bmo' | 'amc' | 'unknown'

/**
 * Earnings event interface
 * Represents a single earnings report event
 *
 * Implements Requirements:
 * - 11.1: Display future earnings release schedule
 * - 11.2: Mark BMO or AMC release timing
 * - 11.3: Show expected EPS, previous EPS, and analyst forecasts
 */
export interface EarningsEvent {
  id: string
  symbol: string
  stockName?: string
  sector?: string | null
  industry?: string | null
  marketCap?: number | null
  reportDate: string
  fiscalQuarter: string
  fiscalYear: number
  timing: EarningsTiming
  epsEstimate: number | null
  epsActual: number | null
  epsSurprise: number | null
  epsSurprisePercent: number | null
  revenueEstimate: number | null
  revenueActual: number | null
  revenueSurprise: number | null
  revenueSurprisePercent: number | null
  previousEps?: number | null
  createdAt: string
  updatedAt: string
}

/**
 * Earnings calendar filter options
 * Implements Requirement 11.6: Support filtering by date, sector, market cap
 */
export interface EarningsCalendarFilters {
  startDate?: string
  endDate?: string
  symbols?: string[]
  sectors?: string[]
  timing?: EarningsTiming[]
  marketCapMin?: number
  marketCapMax?: number
  hasActualResults?: boolean
  sortBy?: 'reportDate' | 'symbol' | 'marketCap' | 'epsSurprisePercent'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

/**
 * Paginated earnings calendar response
 */
export interface EarningsCalendarResponse {
  events: EarningsEvent[]
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
 * Earnings API service
 * Implements Requirements:
 * - 11.1: WHEN 用户查看财报日历 THEN Earnings_Calendar SHALL 显示未来财报发布的时间表
 * - 11.2: WHEN 用户查看财报日历 THEN Earnings_Calendar SHALL 标注盘前（BMO）或盘后（AMC）发布时间
 * - 11.3: WHEN 用户查看即将发布财报的股票 THEN Earnings_Calendar SHALL 显示预期 EPS、上期 EPS 和分析师预测
 * - 11.6: WHEN 用户筛选财报日历 THEN Earnings_Calendar SHALL 支持按日期、板块、市值等条件筛选
 * - 11.7: WHEN 用户点击财报事件 THEN Earnings_Calendar SHALL 跳转到该股票的详情页面
 */
export const earningsApi = {
  /**
   * Get earnings calendar with optional filters
   * @param filters - Optional filter criteria
   * @returns Paginated earnings events
   */
  async getEarningsCalendar(
    filters?: EarningsCalendarFilters
  ): Promise<EarningsCalendarResponse> {
    const params: Record<string, string> = {}

    if (filters) {
      if (filters.startDate) params.startDate = filters.startDate
      if (filters.endDate) params.endDate = filters.endDate
      if (filters.symbols?.length) params.symbols = filters.symbols.join(',')
      if (filters.sectors?.length) params.sectors = filters.sectors.join(',')
      if (filters.timing?.length) params.timing = filters.timing.join(',')
      if (filters.marketCapMin !== undefined) params.marketCapMin = String(filters.marketCapMin)
      if (filters.marketCapMax !== undefined) params.marketCapMax = String(filters.marketCapMax)
      if (filters.hasActualResults !== undefined)
        params.hasActualResults = String(filters.hasActualResults)
      if (filters.sortBy) params.sortBy = filters.sortBy
      if (filters.sortOrder) params.sortOrder = filters.sortOrder
      if (filters.page) params.page = String(filters.page)
      if (filters.limit) params.limit = String(filters.limit)
    }

    const response = await api.get<ApiResponse<EarningsCalendarResponse>>('/earnings/calendar', {
      params,
    })
    return response.data.data
  },

  /**
   * Get upcoming earnings events
   * @param days - Number of days to look ahead (default: 7)
   * @param limit - Maximum number of events (default: 50)
   * @returns Array of upcoming earnings events
   */
  async getUpcomingEarnings(
    days: number = 7,
    limit: number = 50
  ): Promise<{ days: number; count: number; events: EarningsEvent[] }> {
    const response = await api.get<
      ApiResponse<{ days: number; count: number; events: EarningsEvent[] }>
    >('/earnings/upcoming', {
      params: { days, limit },
    })
    return response.data.data
  },

  /**
   * Get recent earnings results
   * @param days - Number of days to look back (default: 7)
   * @param limit - Maximum number of events (default: 50)
   * @returns Array of recent earnings events with results
   */
  async getRecentEarnings(
    days: number = 7,
    limit: number = 50
  ): Promise<{ days: number; count: number; events: EarningsEvent[] }> {
    const response = await api.get<
      ApiResponse<{ days: number; count: number; events: EarningsEvent[] }>
    >('/earnings/recent', {
      params: { days, limit },
    })
    return response.data.data
  },

  /**
   * Get earnings events for a specific date
   * @param date - Date in YYYY-MM-DD format
   * @returns Array of earnings events for that date
   */
  async getEarningsByDate(
    date: string
  ): Promise<{ date: string; count: number; events: EarningsEvent[] }> {
    const response = await api.get<
      ApiResponse<{ date: string; count: number; events: EarningsEvent[] }>
    >(`/earnings/date/${date}`)
    return response.data.data
  },

  /**
   * Get earnings history for a specific stock
   * @param symbol - Stock symbol
   * @param limit - Maximum number of events (default: 10)
   * @returns Array of earnings events for the stock
   */
  async getEarningsBySymbol(
    symbol: string,
    limit: number = 10
  ): Promise<{ symbol: string; count: number; events: EarningsEvent[] }> {
    const response = await api.get<
      ApiResponse<{ symbol: string; count: number; events: EarningsEvent[] }>
    >(`/earnings/stock/${symbol}`, {
      params: { limit },
    })
    return response.data.data
  },

  /**
   * Get upcoming earnings for user's watchlist stocks (requires authentication)
   * @param days - Number of days to look ahead (default: 7)
   * @returns Array of upcoming earnings events for watchlist stocks
   */
  async getWatchlistUpcomingEarnings(
    days: number = 7
  ): Promise<{ days: number; count: number; events: EarningsEvent[] }> {
    const response = await api.get<
      ApiResponse<{ days: number; count: number; events: EarningsEvent[] }>
    >('/earnings/watchlist/upcoming', {
      params: { days },
    })
    return response.data.data
  },

  /**
   * Get earnings happening tomorrow for user's watchlist stocks (requires authentication)
   * @returns Array of earnings events happening tomorrow
   */
  async getWatchlistTomorrowEarnings(): Promise<{ count: number; events: EarningsEvent[] }> {
    const response = await api.get<ApiResponse<{ count: number; events: EarningsEvent[] }>>(
      '/earnings/watchlist/tomorrow'
    )
    return response.data.data
  },

  /**
   * Get recent earnings results for user's watchlist stocks (requires authentication)
   * @param hours - Number of hours to look back (default: 24)
   * @returns Array of recent earnings events for watchlist stocks
   */
  async getWatchlistRecentEarnings(
    hours: number = 24
  ): Promise<{ hours: number; count: number; events: EarningsEvent[] }> {
    const response = await api.get<
      ApiResponse<{ hours: number; count: number; events: EarningsEvent[] }>
    >('/earnings/watchlist/recent', {
      params: { hours },
    })
    return response.data.data
  },
}
