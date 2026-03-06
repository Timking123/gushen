import { useState, useEffect, useCallback } from 'react'
import type { QuoteData } from '../types'
import { stockDetailApi } from '../services/stockDetailApi'
import { subscribeToStock, initSocket, connectSocket } from '../services/socket'
import './RealTimeQuote.css'

interface RealTimeQuoteProps {
  symbol: string
  className?: string
}

/**
 * Determines the color class based on price change
 * Implements Requirements:
 * - 4.2: 股价上涨时以绿色显示涨跌信息
 * - 4.3: 股价下跌时以红色显示涨跌信息
 */
export function getPriceChangeColorClass(change: number): string {
  if (change > 0) {
    return 'positive' // Green for positive change
  } else if (change < 0) {
    return 'negative' // Red for negative change
  }
  return 'neutral' // Neutral for no change
}

/**
 * Formats a number with appropriate decimal places
 */
function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '暂无数据'
  }
  return value.toFixed(2)
}

/**
 * Formats a percentage value
 */
function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '暂无数据'
  }
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

/**
 * Formats a change value with sign
 */
function formatChange(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '暂无数据'
  }
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}`
}

/**
 * Formats volume with K/M/B suffixes
 */
function formatVolume(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '暂无数据'
  }
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(2)}K`
  }
  return value.toLocaleString()
}

/**
 * RealTimeQuote Component
 * Displays real-time stock quote information with WebSocket updates.
 *
 * Implements Requirements:
 * - 4.1: 显示当前股价、涨跌金额、涨跌幅百分比
 * - 4.2: 股价上涨时以绿色显示涨跌信息
 * - 4.3: 股价下跌时以红色显示涨跌信息
 * - 4.4: 收到实时价格更新时实时更新显示的价格和涨跌幅
 * - 4.5: 显示今日开盘价、最高价、最低价、昨收价
 * - 4.6: 显示成交量和平均成交量
 */
export function RealTimeQuote({ symbol, className = '' }: RealTimeQuoteProps) {
  const [quote, setQuote] = useState<QuoteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Fetch initial quote data
  const fetchQuote = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await stockDetailApi.getStockFullDetail(symbol)
      if (data && data.quote) {
        setQuote(data.quote)
        setLastUpdate(new Date())
      } else {
        setError('未找到报价信息')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取报价信息失败'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [symbol])

  // Initialize and subscribe to WebSocket updates
  useEffect(() => {
    if (!symbol) return

    // Fetch initial data
    fetchQuote()

    // Initialize socket and connect
    initSocket()
    connectSocket()

    // Subscribe to real-time updates for this stock
    // Implements Requirement 4.4: 收到实时价格更新时实时更新显示的价格和涨跌幅
    const unsubscribe = subscribeToStock(symbol, (data) => {
      setQuote((prevQuote) => {
        if (!prevQuote) return prevQuote
        return {
          ...prevQuote,
          price: data.price,
          change: data.change,
          changePercent: data.changePercent,
          volume: data.volume,
          timestamp: data.timestamp,
        }
      })
      setLastUpdate(new Date())
    })

    // Cleanup subscription on unmount
    return () => {
      unsubscribe()
    }
  }, [symbol, fetchQuote])

  if (loading) {
    return (
      <div className={`realtime-quote loading ${className}`}>
        <div className="loading-spinner" />
        <span>加载报价信息...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`realtime-quote error ${className}`}>
        <span className="error-icon">⚠️</span>
        <span className="error-message">{error}</span>
        <button className="retry-btn" onClick={fetchQuote}>
          重试
        </button>
      </div>
    )
  }

  if (!quote) {
    return (
      <div className={`realtime-quote empty ${className}`}>
        <span className="empty-icon">📊</span>
        <span className="empty-message">暂无报价信息</span>
      </div>
    )
  }

  const colorClass = getPriceChangeColorClass(quote.change)

  return (
    <div className={`realtime-quote ${className}`}>
      <div className="quote-header">
        <h3 className="quote-title">实时报价</h3>
        {lastUpdate && (
          <span className="quote-update-time">
            更新于 {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="quote-content">
        {/* Primary price display - Implements Requirement 4.1 */}
        <div className="quote-primary">
          <div className="price-main">
            <span className={`current-price ${colorClass}`}>
              ${formatPrice(quote.price)}
            </span>
            <div className={`price-change ${colorClass}`}>
              <span className="change-amount">{formatChange(quote.change)}</span>
              <span className="change-percent">({formatPercent(quote.changePercent)})</span>
            </div>
          </div>
          <div className="price-indicator">
            {quote.change > 0 && <span className="indicator-arrow up">▲</span>}
            {quote.change < 0 && <span className="indicator-arrow down">▼</span>}
            {quote.change === 0 && <span className="indicator-arrow neutral">●</span>}
          </div>
        </div>

        {/* Price details grid - Implements Requirement 4.5 */}
        <div className="quote-details">
          <div className="detail-row">
            <div className="detail-item">
              <span className="detail-label">开盘价</span>
              <span className="detail-value">${formatPrice(quote.open)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">昨收价</span>
              <span className="detail-value">${formatPrice(quote.previousClose)}</span>
            </div>
          </div>
          <div className="detail-row">
            <div className="detail-item">
              <span className="detail-label">最高价</span>
              <span className="detail-value high">${formatPrice(quote.high)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">最低价</span>
              <span className="detail-value low">${formatPrice(quote.low)}</span>
            </div>
          </div>
        </div>

        {/* Volume section - Implements Requirement 4.6 */}
        <div className="quote-volume">
          <div className="volume-item">
            <span className="volume-label">成交量</span>
            <span className="volume-value">{formatVolume(quote.volume)}</span>
          </div>
          <div className="volume-item">
            <span className="volume-label">平均成交量</span>
            <span className="volume-value">{formatVolume(quote.avgVolume)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
