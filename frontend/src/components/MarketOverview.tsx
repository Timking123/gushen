import { useState, useEffect, useCallback, useRef } from 'react'
import {
  marketApi,
  type MarketIndex,
  type MarketSentiment,
  type MarketLeaderboards,
  type StockRankingItem,
} from '../services/marketApi'
import { MarketHeatmap } from './MarketHeatmap'
import { subscribeToMarketPrices } from '../services/socket'
import './MarketOverview.css'

interface MarketOverviewProps {
  className?: string
  onStockClick?: (symbol: string) => void
}

/**
 * Format number with commas
 */
const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/**
 * Format volume for display
 */
const formatVolume = (volume: number): string => {
  if (volume >= 1_000_000_000) {
    return `${(volume / 1_000_000_000).toFixed(2)}B`
  }
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(2)}K`
  }
  return volume.toString()
}

/**
 * Format change percent for display
 */
const formatChangePercent = (changePercent: number): string => {
  const sign = changePercent >= 0 ? '+' : ''
  return `${sign}${changePercent.toFixed(2)}%`
}

/**
 * Format change value for display
 */
const formatChange = (change: number): string => {
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(2)}`
}

/**
 * Get sentiment color class
 */
const getSentimentClass = (sentiment: 'bullish' | 'bearish' | 'neutral'): string => {
  switch (sentiment) {
    case 'bullish':
      return 'bullish'
    case 'bearish':
      return 'bearish'
    default:
      return 'neutral'
  }
}

/**
 * Get sentiment icon
 */
const getSentimentIcon = (sentiment: 'bullish' | 'bearish' | 'neutral'): string => {
  switch (sentiment) {
    case 'bullish':
      return '📈'
    case 'bearish':
      return '📉'
    default:
      return '➡️'
  }
}

/**
 * Index Card Component
 * Displays a single market index
 */
const IndexCard = ({ index }: { index: MarketIndex }) => {
  const isPositive = index.changePercent >= 0

  return (
    <div className={`index-card ${isPositive ? 'positive' : 'negative'}`}>
      <div className="index-header">
        <span className="index-symbol">{index.symbol}</span>
        <span className="index-name">{index.name}</span>
      </div>
      <div className="index-price">{formatNumber(index.price)}</div>
      <div className="index-change">
        <span className={`change-value ${isPositive ? 'positive' : 'negative'}`}>
          {formatChange(index.change)}
        </span>
        <span className={`change-percent ${isPositive ? 'positive' : 'negative'}`}>
          ({formatChangePercent(index.changePercent)})
        </span>
      </div>
      <div className="index-details">
        <div className="detail-item">
          <span className="detail-label">开盘</span>
          <span className="detail-value">{formatNumber(index.open)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">最高</span>
          <span className="detail-value">{formatNumber(index.high)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">最低</span>
          <span className="detail-value">{formatNumber(index.low)}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Sentiment Card Component
 * Displays market sentiment indicators
 * Implements Requirement 18.4
 */
const SentimentCard = ({ sentiment }: { sentiment: MarketSentiment }) => {
  const sentimentClass = getSentimentClass(sentiment.sentiment)
  const sentimentIcon = getSentimentIcon(sentiment.sentiment)

  return (
    <div className={`sentiment-card ${sentimentClass}`}>
      <div className="sentiment-header">
        <span className="sentiment-icon">{sentimentIcon}</span>
        <span className="sentiment-title">市场情绪</span>
      </div>
      <div className="sentiment-main">
        <div className="sentiment-label">{sentiment.description}</div>
        <div className="sentiment-score">
          <span className="score-value">
            {sentiment.score > 0 ? '+' : ''}
            {sentiment.score}
          </span>
          <span className="score-label">情绪指数</span>
        </div>
      </div>
      <div className="breadth-stats">
        <div className="breadth-item positive">
          <span className="breadth-label">上涨</span>
          <span className="breadth-value">{sentiment.breadth.advancing}</span>
        </div>
        <div className="breadth-item negative">
          <span className="breadth-label">下跌</span>
          <span className="breadth-value">{sentiment.breadth.declining}</span>
        </div>
        <div className="breadth-item neutral">
          <span className="breadth-label">平盘</span>
          <span className="breadth-value">{sentiment.breadth.unchanged}</span>
        </div>
      </div>
      <div className="fear-greed">
        <span className="fear-greed-label">恐惧/贪婪指数</span>
        <div className="fear-greed-bar">
          <div className="fear-greed-fill" style={{ width: `${sentiment.fearGreedIndex}%` }} />
          <span className="fear-greed-value">{sentiment.fearGreedIndex}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Leaderboard Component
 * Displays a list of ranked stocks
 * Implements Requirement 18.5
 */
const Leaderboard = ({
  title,
  icon,
  stocks,
  type,
  onStockClick,
}: {
  title: string
  icon: string
  stocks: StockRankingItem[]
  type: 'gainers' | 'losers' | 'volume'
  onStockClick?: (symbol: string) => void
}) => {
  return (
    <div className="leaderboard">
      <div className="leaderboard-header">
        <span className="leaderboard-icon">{icon}</span>
        <span className="leaderboard-title">{title}</span>
      </div>
      <div className="leaderboard-list">
        {stocks.length === 0 ? (
          <div className="leaderboard-empty">暂无数据</div>
        ) : (
          stocks.map((stock, index) => (
            <div
              key={stock.symbol}
              className="leaderboard-item"
              onClick={() => onStockClick?.(stock.symbol)}
            >
              <div className="item-rank">{index + 1}</div>
              <div className="item-info">
                <span className="item-symbol">{stock.symbol}</span>
                <span className="item-name">{stock.name}</span>
              </div>
              <div className="item-data">
                <span className="item-price">${formatNumber(stock.price)}</span>
                {type === 'volume' ? (
                  <span className="item-volume">{formatVolume(stock.volume)}</span>
                ) : (
                  <span
                    className={`item-change ${stock.changePercent >= 0 ? 'positive' : 'negative'}`}
                  >
                    {formatChangePercent(stock.changePercent)}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/**
 * MarketOverview Component
 *
 * Displays a comprehensive market overview on the homepage including:
 * - Major market indices (Dow Jones, S&P 500, NASDAQ)
 * - Market sentiment and breadth indicators
 * - Market heatmap
 * - Top gainers, losers, and volume leaders
 *
 * Implements Requirements 18.1, 18.4, 18.5:
 * - 18.1: Display major indices real-time quotes on homepage
 * - 18.4: Display advance/decline counts and market sentiment indicators
 * - 18.5: Display top gainers, losers, and volume leaders
 */
export const MarketOverview = ({ className = '', onStockClick }: MarketOverviewProps) => {
  const [indices, setIndices] = useState<MarketIndex[]>([])
  const [sentiment, setSentiment] = useState<MarketSentiment | null>(null)
  const [leaderboards, setLeaderboards] = useState<MarketLeaderboards | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'gainers' | 'losers' | 'volume'>('gainers')
  const [showHeatmap, setShowHeatmap] = useState(false)

  /**
   * Load market overview data
   */
  const loadMarketData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const overview = await marketApi.getMarketOverview(10)

      setIndices(overview.indices)
      setSentiment(overview.sentiment)
      setLeaderboards(overview.leaderboards)
    } catch (err) {
      console.error('Failed to load market data:', err)
      setError('加载市场数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load data on mount
  useEffect(() => {
    loadMarketData()
  }, [loadMarketData])

  // Auto-refresh every 60 seconds (fallback for when WebSocket is not available)
  useEffect(() => {
    const interval = setInterval(loadMarketData, 60000)
    return () => clearInterval(interval)
  }, [loadMarketData])

  // Subscribe to real-time price updates via Socket.IO
  useEffect(() => {
    const unsubscribe = subscribeToMarketPrices((data) => {
      // Update leaderboards with real-time price
      setLeaderboards(prev => {
        if (!prev) return prev
        
        const updateStockList = (stocks: StockRankingItem[]): StockRankingItem[] => {
          return stocks.map(stock => {
            if (stock.symbol === data.symbol) {
              return {
                ...stock,
                price: data.price,
                change: data.change,
                changePercent: data.changePercent,
                volume: data.volume,
              }
            }
            return stock
          })
        }

        return {
          ...prev,
          topGainers: updateStockList(prev.topGainers),
          topLosers: updateStockList(prev.topLosers),
          mostActive: updateStockList(prev.mostActive),
          lastUpdated: data.timestamp,
        }
      })

      // Update indices if the symbol matches
      setIndices(prev => {
        return prev.map(index => {
          if (index.symbol === data.symbol) {
            return {
              ...index,
              price: data.price,
              change: data.change,
              changePercent: data.changePercent,
            }
          }
          return index
        })
      })
    })

    return () => {
      unsubscribe()
    }
  }, [])

  /**
   * Get current leaderboard stocks based on active tab
   */
  const getCurrentLeaderboard = (): StockRankingItem[] => {
    if (!leaderboards) return []
    switch (activeTab) {
      case 'gainers':
        return leaderboards.topGainers
      case 'losers':
        return leaderboards.topLosers
      case 'volume':
        return leaderboards.mostActive
      default:
        return []
    }
  }

  // Loading state
  if (loading && !indices.length) {
    return (
      <div className={`market-overview ${className}`}>
        <div className="market-overview-loading">
          <div className="loading-spinner"></div>
          <span>加载市场数据...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !indices.length) {
    return (
      <div className={`market-overview ${className}`}>
        <div className="market-overview-error">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
          <button className="retry-button" onClick={loadMarketData}>
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`market-overview ${className}`}>
      {/* Header */}
      <div className="market-overview-header">
        <div className="header-title">
          <h2>市场概览</h2>
          <span className="last-updated">
            更新于{' '}
            {leaderboards?.lastUpdated
              ? new Date(leaderboards.lastUpdated).toLocaleTimeString('zh-CN')
              : '--'}
          </span>
        </div>
        <div className="header-actions">
          <button
            className={`toggle-heatmap ${showHeatmap ? 'active' : ''}`}
            onClick={() => setShowHeatmap(!showHeatmap)}
          >
            {showHeatmap ? '隐藏热力图' : '显示热力图'}
          </button>
          <button className="refresh-button" onClick={loadMarketData} disabled={loading}>
            {loading ? '刷新中...' : '🔄 刷新'}
          </button>
        </div>
      </div>

      {/* Major Indices - Implements Requirement 18.1 */}
      <div className="indices-section">
        <h3 className="section-title">主要指数</h3>
        <div className="indices-grid">
          {indices.map(index => (
            <IndexCard key={index.symbol} index={index} />
          ))}
        </div>
      </div>

      {/* Market Sentiment - Implements Requirement 18.4 */}
      {sentiment && (
        <div className="sentiment-section">
          <SentimentCard sentiment={sentiment} />
        </div>
      )}

      {/* Market Heatmap */}
      {showHeatmap && (
        <div className="heatmap-section">
          <MarketHeatmap onStockClick={onStockClick} />
        </div>
      )}

      {/* Leaderboards - Implements Requirement 18.5 */}
      <div className="leaderboards-section">
        <div className="leaderboards-tabs">
          <button
            className={`tab-button ${activeTab === 'gainers' ? 'active' : ''}`}
            onClick={() => setActiveTab('gainers')}
          >
            🚀 涨幅榜
          </button>
          <button
            className={`tab-button ${activeTab === 'losers' ? 'active' : ''}`}
            onClick={() => setActiveTab('losers')}
          >
            📉 跌幅榜
          </button>
          <button
            className={`tab-button ${activeTab === 'volume' ? 'active' : ''}`}
            onClick={() => setActiveTab('volume')}
          >
            📊 成交量榜
          </button>
        </div>
        <Leaderboard
          title={
            activeTab === 'gainers' ? '涨幅榜' : activeTab === 'losers' ? '跌幅榜' : '成交量榜'
          }
          icon={activeTab === 'gainers' ? '🚀' : activeTab === 'losers' ? '📉' : '📊'}
          stocks={getCurrentLeaderboard()}
          type={activeTab}
          onStockClick={onStockClick}
        />
      </div>
    </div>
  )
}
