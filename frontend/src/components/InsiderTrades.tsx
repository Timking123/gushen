import { useState, useEffect } from 'react'
import type { InsiderTradeSummary, InsiderTrade } from '../types'
import { stockDetailApi } from '../services/stockDetailApi'
import { formatMarketCap } from '../utils/formatters'
import './InsiderTrades.css'

interface InsiderTradesProps {
  symbol: string
  className?: string
  limit?: number
}

/**
 * Returns CSS class based on transaction type.
 * Exported for use in property tests.
 *
 * Implements Requirements:
 * - 8.4: 买入交易以绿色标识
 * - 8.5: 卖出交易以红色标识
 *
 * @param transactionType - The type of transaction ('buy', 'sell', or 'exercise')
 * @returns CSS class name for the transaction type color
 */
export function getTransactionTypeColorClass(
  transactionType: 'buy' | 'sell' | 'exercise'
): string {
  switch (transactionType) {
    case 'buy':
      return 'transaction-buy'
    case 'sell':
      return 'transaction-sell'
    case 'exercise':
      return 'transaction-exercise'
    default:
      return ''
  }
}

/**
 * Maps transaction type to display text in Chinese
 */
function getTransactionTypeText(transactionType: 'buy' | 'sell' | 'exercise'): string {
  const typeMap: Record<string, string> = {
    buy: '买入',
    sell: '卖出',
    exercise: '行权',
  }
  return typeMap[transactionType] || transactionType
}

/**
 * Formats a number with thousand separators
 */
function formatNumber(value: number): string {
  return value.toLocaleString('zh-CN')
}

/**
 * Formats currency value for display
 */
function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`
}

/**
 * Formats date string for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/**
 * InsiderTrades Component
 * Displays insider trading summary and recent trades for a stock.
 *
 * Implements Requirements:
 * - 8.1: 显示最近的内部交易记录列表
 * - 8.2: 显示交易人姓名、职位、交易类型（买入/卖出）、股数、价格、交易日期
 * - 8.3: 显示近期内部交易的买入/卖出汇总统计
 * - 8.4: 买入交易以绿色标识
 * - 8.5: 卖出交易以红色标识
 * - 8.6: 无内部交易记录时显示"暂无内部交易记录"
 */
export function InsiderTrades({ symbol, className = '', limit = 10 }: InsiderTradesProps) {
  const [summary, setSummary] = useState<InsiderTradeSummary | null>(null)
  const [trades, setTrades] = useState<InsiderTrade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (symbol) {
      fetchInsiderTrades()
    }
  }, [symbol])

  const fetchInsiderTrades = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await stockDetailApi.getInsiderTrades(symbol)
      if (data) {
        setSummary(data.summary)
        setTrades(data.trades.slice(0, limit))
      } else {
        setSummary(null)
        setTrades([])
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取内部交易记录失败'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={`insider-trades loading ${className}`}>
        <div className="loading-spinner" />
        <span>加载内部交易记录...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`insider-trades error ${className}`}>
        <span className="error-icon">⚠️</span>
        <span className="error-message">{error}</span>
        <button className="retry-btn" onClick={fetchInsiderTrades}>
          重试
        </button>
      </div>
    )
  }

  // Implements Requirement 8.6: 无内部交易记录时显示"暂无内部交易记录"
  if (!summary || (trades.length === 0 && summary.buyTransactions === 0 && summary.sellTransactions === 0)) {
    return (
      <div className={`insider-trades empty ${className}`}>
        <span className="empty-icon">👤</span>
        <span className="empty-message">暂无内部交易记录</span>
      </div>
    )
  }

  return (
    <div className={`insider-trades ${className}`}>
      <div className="insider-header">
        <h3 className="insider-title">内部交易记录</h3>
        <span className="insider-period">近 {summary.period}</span>
      </div>

      <div className="insider-content">
        {/* Trade Summary - Implements Requirement 8.3 */}
        <div className="trades-section">
          <h4 className="section-title">
            <span className="section-icon">📊</span>
            交易汇总
          </h4>
          <div className="summary-grid">
            <div className="summary-card buy-card">
              <div className="summary-card-header">
                <span className="summary-card-icon">📈</span>
                <span className="summary-card-title">买入</span>
              </div>
              <div className="summary-card-body">
                <div className="summary-stat">
                  <span className="stat-label">交易次数</span>
                  <span className="stat-value">{summary.buyTransactions}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">总股数</span>
                  <span className="stat-value">{formatNumber(summary.totalBuyShares)}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">总金额</span>
                  <span className="stat-value">{formatMarketCap(summary.totalBuyValue)}</span>
                </div>
              </div>
            </div>

            <div className="summary-card sell-card">
              <div className="summary-card-header">
                <span className="summary-card-icon">📉</span>
                <span className="summary-card-title">卖出</span>
              </div>
              <div className="summary-card-body">
                <div className="summary-stat">
                  <span className="stat-label">交易次数</span>
                  <span className="stat-value">{summary.sellTransactions}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">总股数</span>
                  <span className="stat-value">{formatNumber(summary.totalSellShares)}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">总金额</span>
                  <span className="stat-value">{formatMarketCap(summary.totalSellValue)}</span>
                </div>
              </div>
            </div>

            <div className={`summary-card net-card ${summary.netShares >= 0 ? 'net-positive' : 'net-negative'}`}>
              <div className="summary-card-header">
                <span className="summary-card-icon">⚖️</span>
                <span className="summary-card-title">净变动</span>
              </div>
              <div className="summary-card-body">
                <div className="summary-stat">
                  <span className="stat-label">净股数</span>
                  <span className={`stat-value ${summary.netShares >= 0 ? 'positive' : 'negative'}`}>
                    {summary.netShares >= 0 ? '+' : ''}{formatNumber(summary.netShares)}
                  </span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">净金额</span>
                  <span className={`stat-value ${summary.netValue >= 0 ? 'positive' : 'negative'}`}>
                    {summary.netValue >= 0 ? '+' : ''}{formatMarketCap(summary.netValue)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Trades List - Implements Requirements 8.1, 8.2, 8.4, 8.5 */}
        {trades.length > 0 && (
          <div className="trades-section">
            <h4 className="section-title">
              <span className="section-icon">📋</span>
              最近交易
            </h4>
            <div className="trades-list">
              {trades.map((trade) => (
                <div key={trade.id} className="trade-item">
                  <div className="trade-item-header">
                    <div className="insider-info">
                      <span className="insider-name">{trade.insiderName}</span>
                      {trade.insiderTitle && (
                        <span className="insider-title-text">{trade.insiderTitle}</span>
                      )}
                    </div>
                    <span className="trade-date">{formatDate(trade.tradeDate)}</span>
                  </div>
                  <div className="trade-item-body">
                    <span className={`transaction-type ${getTransactionTypeColorClass(trade.transactionType)}`}>
                      {getTransactionTypeText(trade.transactionType)}
                    </span>
                    <div className="trade-details">
                      <div className="trade-detail">
                        <span className="detail-label">股数</span>
                        <span className="detail-value">{formatNumber(trade.shares)}</span>
                      </div>
                      <div className="trade-detail">
                        <span className="detail-label">价格</span>
                        <span className="detail-value">{formatCurrency(trade.pricePerShare)}</span>
                      </div>
                      <div className="trade-detail">
                        <span className="detail-label">总价值</span>
                        <span className="detail-value">{formatMarketCap(trade.totalValue)}</span>
                      </div>
                    </div>
                  </div>
                  {trade.sharesOwned !== null && (
                    <div className="trade-item-footer">
                      <span className="shares-owned">
                        持有股数: {formatNumber(trade.sharesOwned)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
