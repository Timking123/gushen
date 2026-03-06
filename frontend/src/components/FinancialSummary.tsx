import { useState, useEffect } from 'react'
import type { FinancialMetrics } from '../types'
import { stockDetailApi } from '../services/stockDetailApi'
import { formatMarketCap } from '../utils/formatters'
import './FinancialSummary.css'

interface FinancialSummaryProps {
  symbol: string
  className?: string
}

/**
 * Formats a percentage value for display
 * @param value - Percentage value (e.g., 0.25 for 25%)
 * @returns Formatted string (e.g., "25.00%") or "暂无数据" if null
 */
function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '暂无数据'
  }
  // Value is already in percentage form (e.g., 25 for 25%)
  return `${value.toFixed(2)}%`
}

/**
 * Formats a ratio value for display
 * @param value - Ratio value
 * @returns Formatted string or "暂无数据" if null
 */
function formatRatio(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '暂无数据'
  }
  return value.toFixed(2)
}

/**
 * Formats a currency value for display
 * @param value - Currency value
 * @returns Formatted string or "暂无数据" if null
 */
function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '暂无数据'
  }
  return `$${value.toFixed(2)}`
}

/**
 * FinancialSummary Component
 * Displays key financial metrics for a stock including valuation ratios,
 * profitability metrics, and financial health indicators.
 *
 * Implements Requirements:
 * - 6.1: 显示市盈率（PE）、市净率（PB）、市销率（PS）
 * - 6.2: 显示每股收益（EPS）和收益增长率
 * - 6.3: 显示营收和营收增长率
 * - 6.4: 显示毛利率、营业利润率、净利率
 * - 6.5: 显示 ROE、ROA、负债权益比
 * - 6.6: 对不可用数据显示"暂无数据"
 */
export function FinancialSummary({ symbol, className = '' }: FinancialSummaryProps) {
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    if (symbol) {
      fetchFinancials()
    }
  }, [symbol])

  const fetchFinancials = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await stockDetailApi.getFinancials(symbol)
      if (data) {
        setMetrics(data.metrics)
        setUpdatedAt(data.updatedAt)
      } else {
        setError('未找到财务数据')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取财务数据失败'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={`financial-summary loading ${className}`}>
        <div className="loading-spinner" />
        <span>加载财务数据...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`financial-summary error ${className}`}>
        <span className="error-icon">⚠️</span>
        <span className="error-message">{error}</span>
        <button className="retry-btn" onClick={fetchFinancials}>
          重试
        </button>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className={`financial-summary empty ${className}`}>
        <span className="empty-icon">📈</span>
        <span className="empty-message">暂无财务数据</span>
      </div>
    )
  }

  return (
    <div className={`financial-summary ${className}`}>
      <div className="financial-header">
        <h3 className="financial-title">财务数据摘要</h3>
        {updatedAt && (
          <span className="financial-update-time">
            更新于 {new Date(updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="financial-content">
        {/* Valuation Metrics - Implements Requirement 6.1 */}
        <div className="metrics-section">
          <h4 className="section-title">
            <span className="section-icon">📊</span>
            估值指标
          </h4>
          <div className="metrics-grid">
            <div className="metric-item">
              <span className="metric-label">市盈率 (PE)</span>
              <span className="metric-value">{formatRatio(metrics.pe)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">市净率 (PB)</span>
              <span className="metric-value">{formatRatio(metrics.pb)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">市销率 (PS)</span>
              <span className="metric-value">{formatRatio(metrics.ps)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">远期市盈率</span>
              <span className="metric-value">{formatRatio(metrics.forwardPe)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">PEG 比率</span>
              <span className="metric-value">{formatRatio(metrics.peg)}</span>
            </div>
          </div>
        </div>

        {/* Earnings Metrics - Implements Requirement 6.2 */}
        <div className="metrics-section">
          <h4 className="section-title">
            <span className="section-icon">💰</span>
            盈利指标
          </h4>
          <div className="metrics-grid">
            <div className="metric-item">
              <span className="metric-label">每股收益 (EPS)</span>
              <span className="metric-value">{formatCurrency(metrics.eps)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">EPS 增长率</span>
              <span className={`metric-value ${getGrowthClass(metrics.epsGrowth)}`}>
                {formatPercent(metrics.epsGrowth)}
              </span>
            </div>
          </div>
        </div>

        {/* Revenue Metrics - Implements Requirement 6.3 */}
        <div className="metrics-section">
          <h4 className="section-title">
            <span className="section-icon">📈</span>
            营收指标
          </h4>
          <div className="metrics-grid">
            <div className="metric-item">
              <span className="metric-label">营收</span>
              <span className="metric-value revenue">{formatMarketCap(metrics.revenue)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">营收增长率</span>
              <span className={`metric-value ${getGrowthClass(metrics.revenueGrowth)}`}>
                {formatPercent(metrics.revenueGrowth)}
              </span>
            </div>
          </div>
        </div>

        {/* Profit Margins - Implements Requirement 6.4 */}
        <div className="metrics-section">
          <h4 className="section-title">
            <span className="section-icon">📉</span>
            利润率
          </h4>
          <div className="metrics-grid">
            <div className="metric-item">
              <span className="metric-label">毛利率</span>
              <span className={`metric-value ${getMarginClass(metrics.grossMargin)}`}>
                {formatPercent(metrics.grossMargin)}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">营业利润率</span>
              <span className={`metric-value ${getMarginClass(metrics.operatingMargin)}`}>
                {formatPercent(metrics.operatingMargin)}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">净利率</span>
              <span className={`metric-value ${getMarginClass(metrics.netMargin)}`}>
                {formatPercent(metrics.netMargin)}
              </span>
            </div>
          </div>
        </div>

        {/* Return Metrics - Implements Requirement 6.5 */}
        <div className="metrics-section">
          <h4 className="section-title">
            <span className="section-icon">🎯</span>
            回报率与负债
          </h4>
          <div className="metrics-grid">
            <div className="metric-item">
              <span className="metric-label">ROE (净资产收益率)</span>
              <span className={`metric-value ${getReturnClass(metrics.roe)}`}>
                {formatPercent(metrics.roe)}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">ROA (总资产收益率)</span>
              <span className={`metric-value ${getReturnClass(metrics.roa)}`}>
                {formatPercent(metrics.roa)}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">负债权益比</span>
              <span className={`metric-value ${getDebtClass(metrics.debtToEquity)}`}>
                {formatRatio(metrics.debtToEquity)}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-label">流动比率</span>
              <span className={`metric-value ${getLiquidityClass(metrics.currentRatio)}`}>
                {formatRatio(metrics.currentRatio)}
              </span>
            </div>
          </div>
        </div>

        {/* Dividend Metrics */}
        <div className="metrics-section">
          <h4 className="section-title">
            <span className="section-icon">💵</span>
            股息指标
          </h4>
          <div className="metrics-grid">
            <div className="metric-item">
              <span className="metric-label">股息收益率</span>
              <span className="metric-value">{formatPercent(metrics.dividendYield)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">派息比率</span>
              <span className="metric-value">{formatPercent(metrics.payoutRatio)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Returns CSS class based on growth value
 * Positive growth is green, negative is red
 */
function getGrowthClass(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (value > 0) return 'positive'
  if (value < 0) return 'negative'
  return ''
}

/**
 * Returns CSS class based on margin value
 * Higher margins are better (green), negative margins are concerning (red)
 */
function getMarginClass(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (value >= 20) return 'positive'
  if (value < 0) return 'negative'
  return ''
}

/**
 * Returns CSS class based on return value (ROE/ROA)
 * Higher returns are better
 */
function getReturnClass(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (value >= 15) return 'positive'
  if (value < 0) return 'negative'
  return ''
}

/**
 * Returns CSS class based on debt-to-equity ratio
 * Lower is generally better, very high is concerning
 */
function getDebtClass(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (value <= 0.5) return 'positive'
  if (value > 2) return 'negative'
  return ''
}

/**
 * Returns CSS class based on current ratio
 * Above 1.5 is healthy, below 1 is concerning
 */
function getLiquidityClass(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (value >= 1.5) return 'positive'
  if (value < 1) return 'negative'
  return ''
}
