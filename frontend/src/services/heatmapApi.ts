import api from './api'

/**
 * Heatmap data item interface
 * Represents a single stock in the heatmap
 */
export interface HeatmapItem {
  symbol: string
  name: string
  sector: string
  industry: string | null
  marketCap: number
  price: number
  change: number
  changePercent: number
  volume: number
}

/**
 * Heatmap group interface
 * Represents a group of stocks (by sector or market cap)
 */
export interface HeatmapGroup {
  name: string
  totalMarketCap: number
  avgChangePercent: number
  stockCount: number
  items: HeatmapItem[]
}

/**
 * Heatmap response interface
 */
export interface HeatmapResponse {
  groupBy: 'sector' | 'marketCap' | 'industry'
  groups: HeatmapGroup[]
  totalStocks: number
  lastUpdated: string
}

/**
 * Grouping options for heatmap
 */
export type HeatmapGroupBy = 'sector' | 'marketCap' | 'industry'

/**
 * Heatmap filter options
 * Implements Requirements 14.2, 14.3, 14.4, 14.6
 */
export interface HeatmapFilters {
  sectors?: string[]
  industries?: string[]
  minMarketCap?: number
  maxMarketCap?: number
  hideZeroPrice?: boolean  // Option to hide stocks with zero price
}

/**
 * Industry info interface
 * Implements Requirement 14.1
 */
export interface IndustryInfo {
  name: string
  sector: string
  stockCount: number
}

/**
 * Heatmap API service
 * Implements Requirements 4.4, 18.2, 18.6, 14.1-14.6:
 * - 4.4: Display sector heatmap showing stock performance
 * - 18.2: Show color intensity based on price change
 * - 18.6: Support grouping by market cap, sector, etc.
 * - 14.1: Display sector/industry filter dropdown
 * - 14.2: Filter by sector
 * - 14.3: Filter by industry
 * - 14.4: Show all stocks when "All" is selected
 * - 14.6: Support multi-select sector filtering
 */
export const heatmapApi = {
  /**
   * Get market heatmap data with optional filters
   * @param groupBy - Grouping method ('sector', 'marketCap', or 'industry')
   * @param limit - Maximum number of stocks per group
   * @param filters - Optional filter parameters
   * @returns Heatmap data with groups
   */
  async getHeatmapData(
    groupBy: HeatmapGroupBy = 'sector',
    limit: number = 50,
    filters?: HeatmapFilters
  ): Promise<HeatmapResponse> {
    const params: Record<string, string | number | boolean> = { groupBy, limit }
    
    if (filters?.sectors && filters.sectors.length > 0) {
      params.sectors = filters.sectors.join(',')
    }
    if (filters?.industries && filters.industries.length > 0) {
      params.industries = filters.industries.join(',')
    }
    if (filters?.minMarketCap !== undefined) {
      params.minMarketCap = filters.minMarketCap
    }
    if (filters?.maxMarketCap !== undefined) {
      params.maxMarketCap = filters.maxMarketCap
    }
    if (filters?.hideZeroPrice !== undefined) {
      params.hideZeroPrice = filters.hideZeroPrice
    }
    
    const response = await api.get<{ success: boolean; data: HeatmapResponse }>(
      '/stocks/market/heatmap',
      { params }
    )
    return response.data.data
  },

  /**
   * Get list of available sectors
   * @returns Array of sector names
   */
  async getAvailableSectors(): Promise<string[]> {
    const response = await api.get<{ success: boolean; data: string[] }>('/stocks/market/sectors')
    return response.data.data
  },

  /**
   * Get list of available industries with their sector and stock count
   * Implements Requirement 14.1
   * @param sector - Optional sector name to filter industries by
   * @returns Array of industry info objects
   */
  async getAvailableIndustries(sector?: string): Promise<IndustryInfo[]> {
    const params: Record<string, string> = {}
    if (sector) {
      params.sector = sector
    }
    const response = await api.get<{ success: boolean; data: { industries: IndustryInfo[]; count: number } }>(
      '/stocks/market/industries',
      { params }
    )
    return response.data.data.industries
  },
}
