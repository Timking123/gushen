import api from './api'
import type { ApiResponse } from '../types'

/**
 * Screener filters interface
 * Matches backend ScreenerFilters interface
 *
 * Implements Requirements:
 * - 10.1: Display descriptive, fundamental, and technical filter categories
 * - 10.2: 描述性筛选条件 (交易所、板块、市值范围、国家等)
 * - 10.3: 基本面筛选条件 (P/E、EPS增长率、股息率、负债率等)
 * - 10.4: 技术面筛选条件 (RSI、移动平均线、价格形态、成交量等)
 */
export interface ScreenerFilters {
  // Descriptive filters (Requirement 10.2)
  exchange?: string[]
  sector?: string[]
  industry?: string[]
  country?: string[]
  marketCapMin?: number
  marketCapMax?: number

  // Fundamental filters (Requirement 10.3)
  peMin?: number
  peMax?: number
  epsGrowthMin?: number
  dividendYieldMin?: number
  debtToEquityMax?: number
  revenueGrowthMin?: number
  roeMin?: number
  currentRatioMin?: number

  // Technical filters (Requirement 10.4)
  rsiMin?: number
  rsiMax?: number
  priceAboveSma20?: boolean
  priceAboveSma50?: boolean
  priceAboveSma200?: boolean
  volumeAboveAvg?: boolean

  // Data quality filters
  hideZeroPrice?: boolean  // Filter out stocks with zero or null price
  maxChangePercent?: number  // Maximum absolute change percent (e.g., 100 means ±100%)

  // Search filter
  search?: string  // Search by symbol or name

  // Sorting (Requirement 10.7)
  sortBy?: string
  sortOrder?: 'asc' | 'desc'

  // Pagination
  page?: number
  limit?: number
}

/**
 * Screener result item interface
 * Represents a single stock in the screener results
 */
export interface ScreenerResultItem {
  symbol: string
  name: string
  exchange: string
  sector: string | null
  industry: string | null
  marketCap: number | null
  country: string | null

  // Current price data
  price: number | null
  changePercent: number | null
  volume: number | null

  // Fundamental metrics
  pe: number | null
  epsGrowth: number | null
  dividendYield: number | null
  debtToEquity: number | null
  revenueGrowth: number | null
  roe: number | null

  // Technical indicators
  rsi14: number | null
  sma20: number | null
  sma50: number | null
  sma200: number | null
}

/**
 * Screener result interface
 * Contains the filtered stocks and pagination info
 */
export interface ScreenerResult {
  stocks: ScreenerResultItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * Screener template interface
 * Saved filter configurations
 */
export interface ScreenerTemplate {
  id: string
  userId: string
  name: string
  description: string | null
  filters: ScreenerFilters
  createdAt: Date
  updatedAt: Date
}

/**
 * Screener API service
 * Handles all screener-related API calls
 *
 * Implements Requirements:
 * - 10.5: Real-time display of filtered results
 * - 10.6: Save/load template functionality
 */
export const screenerApi = {
  /**
   * Execute stock screening with filters
   * @param filters - Screening filters
   * @returns Screener result with filtered stocks and pagination
   */
  async screen(filters: ScreenerFilters): Promise<ScreenerResult> {
    const response = await api.post<ApiResponse<ScreenerResult>>('/screener/screen', filters)
    return response.data.data!
  },

  /**
   * Save a screener template
   * @param name - Template name
   * @param filters - Filter configuration
   * @param description - Optional description
   * @returns Created template
   */
  async saveTemplate(
    name: string,
    filters: ScreenerFilters,
    description?: string
  ): Promise<ScreenerTemplate> {
    const response = await api.post<ApiResponse<ScreenerTemplate>>('/screener/templates', {
      name,
      filters,
      description,
    })
    return response.data.data!
  },

  /**
   * Get all screener templates for the current user
   * @returns Array of templates
   */
  async getTemplates(): Promise<ScreenerTemplate[]> {
    const response = await api.get<ApiResponse<ScreenerTemplate[]>>('/screener/templates')
    return response.data.data || []
  },

  /**
   * Get a specific screener template
   * @param templateId - Template ID
   * @returns Template or null if not found
   */
  async getTemplate(templateId: string): Promise<ScreenerTemplate | null> {
    try {
      const response = await api.get<ApiResponse<ScreenerTemplate>>(
        `/screener/templates/${templateId}`
      )
      return response.data.data || null
    } catch {
      return null
    }
  },

  /**
   * Update a screener template
   * @param templateId - Template ID
   * @param updates - Template updates
   * @returns Updated template
   */
  async updateTemplate(
    templateId: string,
    updates: {
      name?: string
      description?: string
      filters?: ScreenerFilters
    }
  ): Promise<ScreenerTemplate | null> {
    try {
      const response = await api.put<ApiResponse<ScreenerTemplate>>(
        `/screener/templates/${templateId}`,
        updates
      )
      return response.data.data || null
    } catch {
      return null
    }
  },

  /**
   * Delete a screener template
   * @param templateId - Template ID
   * @returns true if deleted successfully
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      await api.delete(`/screener/templates/${templateId}`)
      return true
    } catch {
      return false
    }
  },
}
