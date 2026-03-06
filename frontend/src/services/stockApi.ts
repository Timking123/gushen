import api from './api'
import type { ApiResponse } from '../types'

export interface StockSearchResult {
  symbol: string
  name: string
  exchange: string
  sector: string
  industry: string
}

/**
 * OHLCV data interface for historical price data
 */
export interface OHLCV {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/**
 * Stock quote interface for real-time price data
 */
export interface StockQuote {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  avgVolume: number | null
  high: number
  low: number
  open: number
  previousClose: number
  timestamp: string
}

/**
 * Stock detail interface
 */
export interface StockDetail {
  symbol: string
  name: string
  exchange: string
  sector: string | null
  industry: string | null
  marketCap: number | null
  country: string | null
}

/**
 * Time range type for historical data
 */
export type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'All'

/**
 * Technical indicator data point with timestamp
 */
export interface IndicatorDataPoint {
  timestamp: string
  value: number
}

/**
 * MACD data point with all components
 */
export interface MACDDataPoint {
  timestamp: string
  value: number
  signal: number
  histogram: number
}

/**
 * Bollinger Bands data point
 */
export interface BollingerBandsDataPoint {
  timestamp: string
  upper: number
  middle: number
  lower: number
}

/**
 * Technical indicators response from API
 */
export interface TechnicalIndicatorsResponse {
  symbol: string
  range: string
  dataPoints: number
  sma: Record<string, number | null>
  smaSeries: Record<string, IndicatorDataPoint[]>
  rsi: {
    period: number
    value: number | null
  }
  rsiSeries: IndicatorDataPoint[]
  macd: {
    params: { fast: number; slow: number; signal: number }
    value: number | null
    signal: number | null
    histogram: number | null
  }
  macdSeries: MACDDataPoint[]
  bollingerBands: {
    params: { period: number; stdDev: number }
    upper: number | null
    middle: number | null
    lower: number | null
  }
  bollingerBandsSeries: BollingerBandsDataPoint[]
}

/**
 * Parameters for fetching technical indicators
 */
export interface TechnicalIndicatorsParams {
  range?: TimeRange
  smaPeriods?: number[]
  rsiPeriod?: number
  macdParams?: { fast: number; slow: number; signal: number }
  bbParams?: { period: number; stdDev: number }
}

/**
 * Stock event type for timeline markers
 */
export type StockEventType = 'news' | 'earnings' | 'dividend' | 'insider' | 'sec_filing'

/**
 * Stock event for chart timeline markers
 * Implements Requirements 4.2, 4.5: Event markers on timeline with hover details
 */
export interface StockEvent {
  id: string
  symbol: string
  type: StockEventType
  title: string
  summary: string
  timestamp: string
  impact?: {
    direction: 'bullish' | 'bearish' | 'neutral'
    magnitude: 'high' | 'medium' | 'low'
  }
  url?: string
}

export const stockApi = {
  /**
   * Search stocks by symbol or name
   */
  async searchStocks(query: string): Promise<StockSearchResult[]> {
    const response = await api.get<ApiResponse<StockSearchResult[]>>('/stocks/search', {
      params: { q: query },
    })
    return response.data.data ?? []
  },

  /**
   * Get stock detail by symbol
   */
  async getStockDetail(symbol: string): Promise<StockDetail | null> {
    const response = await api.get<ApiResponse<StockDetail>>(`/stocks/${symbol}`)
    return response.data.data ?? null
  },

  /**
   * Get stock quote (real-time price data)
   */
  async getQuote(symbol: string): Promise<StockQuote | null> {
    const response = await api.get<ApiResponse<StockQuote>>(`/stocks/${symbol}/quote`)
    return response.data.data ?? null
  },

  /**
   * Get historical OHLCV data for a stock
   * @param symbol - Stock symbol
   * @param range - Time range (1D, 1W, 1M, 3M, 6M, 1Y, All)
   * @returns Array of OHLCV data points
   */
  async getHistoricalData(symbol: string, range: TimeRange): Promise<OHLCV[]> {
    // Map frontend time ranges to backend time ranges
    const backendRange = range === '1W' ? '5D' : range === 'All' ? 'MAX' : range
    const response = await api.get<ApiResponse<{ data: OHLCV[] }>>(`/stocks/${symbol}/history`, {
      params: { range: backendRange },
    })
    return response.data.data?.data ?? []
  },

  /**
   * Get technical indicators for a stock with customizable parameters
   * Implements Requirements 16.1, 16.4: Technical indicator overlays with customizable parameters
   *
   * @param symbol - Stock symbol
   * @param params - Optional parameters for indicator calculation
   * @returns Technical indicators data including series for chart overlay
   */
  async getTechnicalIndicators(
    symbol: string,
    params?: TechnicalIndicatorsParams
  ): Promise<TechnicalIndicatorsResponse | null> {
    // Map frontend time ranges to backend time ranges
    const backendRange =
      params?.range === '1W' ? '5D' : params?.range === 'All' ? 'MAX' : params?.range

    const queryParams: Record<string, string> = {}

    if (backendRange) {
      queryParams.range = backendRange
    }

    if (params?.smaPeriods && params.smaPeriods.length > 0) {
      queryParams.smaPeriods = params.smaPeriods.join(',')
    }

    if (params?.rsiPeriod) {
      queryParams.rsiPeriod = params.rsiPeriod.toString()
    }

    if (params?.macdParams) {
      queryParams.macdParams = `${params.macdParams.fast},${params.macdParams.slow},${params.macdParams.signal}`
    }

    if (params?.bbParams) {
      queryParams.bbParams = `${params.bbParams.period},${params.bbParams.stdDev}`
    }

    const response = await api.get<ApiResponse<TechnicalIndicatorsResponse>>(
      `/stocks/${symbol}/indicators`,
      { params: queryParams }
    )
    return response.data.data ?? null
  },

  /**
   * Get stock events for chart timeline markers
   * Implements Requirements 4.2, 4.5: Event markers on timeline with hover details
   *
   * @param symbol - Stock symbol
   * @param range - Time range for events
   * @returns Array of stock events for the timeline
   */
  async getStockEvents(symbol: string, range: TimeRange): Promise<StockEvent[]> {
    // Map frontend time ranges to backend time ranges
    const backendRange = range === '1W' ? '5D' : range === 'All' ? 'MAX' : range

    try {
      const response = await api.get<ApiResponse<StockEvent[]>>(`/stocks/${symbol}/events`, {
        params: { range: backendRange },
      })
      return response.data.data ?? []
    } catch {
      // Return empty array if events endpoint is not available
      // This allows graceful degradation
      console.warn(`Events endpoint not available for ${symbol}`)
      return []
    }
  },
}
