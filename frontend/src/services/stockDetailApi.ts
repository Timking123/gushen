import api from './api'
import type {
  ApiResponse,
  StockDetailResponse,
  FinancialMetrics,
  AnalystRatingSummary,
  AnalystRatingItem,
  InsiderTradeSummary,
  InsiderTrade,
} from '../types'

/**
 * Financials API response
 * Implements Requirements 6.1-6.6
 */
export interface FinancialsResponse {
  symbol: string
  metrics: FinancialMetrics
  updatedAt: string
}

/**
 * Analyst ratings API response
 * Implements Requirements 7.1-7.5
 */
export interface AnalystRatingsResponse {
  summary: AnalystRatingSummary
  ratings: AnalystRatingItem[]
}

/**
 * Insider trades API response
 * Implements Requirements 8.1-8.6
 */
export interface InsiderTradesResponse {
  summary: InsiderTradeSummary
  trades: InsiderTrade[]
}

/**
 * Stock Detail API service
 * Provides methods for fetching complete stock details, financial data,
 * analyst ratings, and insider trades.
 *
 * Implements Requirements:
 * - 2.1-2.5: Company profile information
 * - 6.1-6.6: Financial data summary
 * - 7.1-7.5: Analyst ratings
 * - 8.1-8.6: Insider trading records
 */
export const stockDetailApi = {
  /**
   * Get complete stock details including profile, quote, financials,
   * analyst ratings, and insider trades.
   *
   * Implements Requirements:
   * - 2.1: 显示公司名称、股票代码、所属交易所
   * - 2.2: 显示公司所属行业和板块
   * - 2.3: 显示公司市值
   * - 2.4: 显示公司所在国家/地区
   * - 2.5: 对缺失字段显示"暂无数据"
   *
   * @param symbol - Stock symbol (e.g., 'AAPL', 'MSFT')
   * @returns Complete stock detail response or null if not found
   */
  async getStockFullDetail(symbol: string): Promise<StockDetailResponse | null> {
    const response = await api.get<ApiResponse<StockDetailResponse>>(
      `/stocks/${symbol}/full-detail`
    )
    return response.data.data ?? null
  },

  /**
   * Get financial metrics for a stock.
   *
   * Implements Requirements:
   * - 6.1: 显示市盈率（PE）、市净率（PB）、市销率（PS）
   * - 6.2: 显示每股收益（EPS）和收益增长率
   * - 6.3: 显示营收和营收增长率
   * - 6.4: 显示毛利率、营业利润率、净利率
   * - 6.5: 显示 ROE、ROA、负债权益比
   * - 6.6: 对不可用数据显示"暂无数据"
   *
   * @param symbol - Stock symbol (e.g., 'AAPL', 'MSFT')
   * @returns Financial metrics response or null if not found
   */
  async getFinancials(symbol: string): Promise<FinancialsResponse | null> {
    const response = await api.get<ApiResponse<FinancialsResponse>>(
      `/stocks/${symbol}/financials`
    )
    return response.data.data ?? null
  },

  /**
   * Get analyst ratings summary and recent rating changes.
   *
   * Implements Requirements:
   * - 7.1: 显示分析师评级汇总（强烈买入/买入/持有/卖出/强烈卖出的数量分布）
   * - 7.2: 显示平均目标价和当前价格的差距百分比
   * - 7.3: 显示最近的分析师评级变动列表
   * - 7.4: 显示分析师姓名、所属机构、评级、目标价、评级日期
   * - 7.5: 无分析师评级数据时显示"暂无分析师评级"
   *
   * @param symbol - Stock symbol (e.g., 'AAPL', 'MSFT')
   * @returns Analyst ratings response or null if not found
   */
  async getAnalystRatings(symbol: string): Promise<AnalystRatingsResponse | null> {
    const response = await api.get<ApiResponse<AnalystRatingsResponse>>(
      `/stocks/${symbol}/analyst-ratings`
    )
    return response.data.data ?? null
  },

  /**
   * Get insider trade summary and recent trades.
   *
   * Implements Requirements:
   * - 8.1: 显示最近的内部交易记录列表
   * - 8.2: 显示交易人姓名、职位、交易类型（买入/卖出）、股数、价格、交易日期
   * - 8.3: 显示近期内部交易的买入/卖出汇总统计
   * - 8.4: 买入交易以绿色标识
   * - 8.5: 卖出交易以红色标识
   * - 8.6: 无内部交易记录时显示"暂无内部交易记录"
   *
   * @param symbol - Stock symbol (e.g., 'AAPL', 'MSFT')
   * @param period - Time period for summary (default: '3M')
   * @returns Insider trades response or null if not found
   */
  async getInsiderTrades(
    symbol: string,
    period: string = '3M'
  ): Promise<InsiderTradesResponse | null> {
    const response = await api.get<ApiResponse<InsiderTradesResponse>>(
      `/stocks/${symbol}/insider-trades`,
      { params: { period } }
    )
    return response.data.data ?? null
  },
}
