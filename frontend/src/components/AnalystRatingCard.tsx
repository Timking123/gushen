import { useState, useEffect } from 'react'
import {
  analystRatingApi,
  type CompositeRating,
  type AnalystRatingData,
  type RatingType,
} from '../services/analystRatingApi'
import './AnalystRatingCard.css'

interface AnalystRatingCardProps {
  symbol: string
  currentPrice?: number
  onError?: (error: Error) => void
}

/**
 * Rating display configuration
 */
interface RatingDisplay {
  label: string
  labelEn: string
  icon: string
  colorClass: string
}

/**
 * Get display configuration for a rating
 */
const getRatingDisplay = (rating: RatingType): RatingDisplay => {
  switch (rating) {
    case 'strong_buy':
      return {
        label: '强烈买入',
        labelEn: 'Strong Buy',
        icon: '🚀',
        colorClass: 'analyst-rating-strong-buy',
      }
    case 'buy':
      return {
        label: '买入',
        labelEn: 'Buy',
        icon: '📈',
        colorClass: 'analyst-rating-buy',
      }
    case 'hold':
      return {
        label: '持有',
        labelEn: 'Hold',
        icon: '➖',
        colorClass: 'analyst-rating-hold',
      }
    case 'sell':
      return {
        label: '卖出',
        labelEn: 'Sell',
        icon: '📉',
        colorClass: 'analyst-rating-sell',
      }
    case 'strong_sell':
      return {
        label: '强烈卖出',
        labelEn: 'Strong Sell',
        icon: '⚠️',
        colorClass: 'analyst-rating-strong-sell',
      }
  }
}

/**
 * Format date for display
 */
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Calculate price upside/downside percentage
 */
const calculateUpside = (targetPrice: number, currentPrice: number): number => {
  return ((targetPrice - currentPrice) / currentPrice) * 100
}

/**
 * AnalystRatingCard Component
 * Displays analyst ratings with composite rating and individual analyst details
 * 
 * Implements Requirements:
 * - 19.1: WHEN 用户查看股票详情 THEN Stock_Analyzer SHALL 显示分析师综合评级和目标价
 * - 19.2: WHEN 用户查看评级详情 THEN Stock_Analyzer SHALL 显示各机构分析师的具体评级和目标价
 * - 19.6: WHEN 显示分析师评级 THEN Stock_Analyzer SHALL 标注评级发布日期和分析师所属机构
 */
export function AnalystRatingCard({
  symbol,
  currentPrice,
  onError,
}: AnalystRatingCardProps) {
  const [composite, setComposite] = useState<CompositeRating | null>(null)
  const [ratings, setRatings] = useState<AnalystRatingData[]>([])
  const [loading, setLoading] = useState(true)
  const [ratingsLoading, setRatingsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [totalRatings, setTotalRatings] = useState(0)

  // Fetch composite rating on mount
  useEffect(() => {
    if (symbol) {
      fetchCompositeRating()
    }
  }, [symbol])

  const fetchCompositeRating = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await analystRatingApi.getCompositeRating(symbol)
      setComposite(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取评级失败'
      setError(errorMessage)
      onError?.(err instanceof Error ? err : new Error(errorMessage))
    } finally {
      setLoading(false)
    }
  }

  const fetchRatings = async () => {
    if (ratings.length > 0) {
      setShowDetails(true)
      return
    }

    try {
      setRatingsLoading(true)
      const data = await analystRatingApi.getRatings(symbol, 10, 0)
      setRatings(data.ratings)
      setTotalRatings(data.total)
      setShowDetails(true)
    } catch (err) {
      console.error('Failed to fetch analyst ratings:', err)
    } finally {
      setRatingsLoading(false)
    }
  }

  const loadMoreRatings = async () => {
    try {
      setRatingsLoading(true)
      const data = await analystRatingApi.getRatings(symbol, 10, ratings.length)
      setRatings([...ratings, ...data.ratings])
    } catch (err) {
      console.error('Failed to load more ratings:', err)
    } finally {
      setRatingsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="analyst-rating-card loading">
        <div className="loading-spinner" />
        <span>加载分析师评级...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="analyst-rating-card error">
        <span className="error-icon">⚠️</span>
        <span className="error-message">{error}</span>
        <button className="retry-btn" onClick={fetchCompositeRating}>
          重试
        </button>
      </div>
    )
  }

  if (!composite) {
    return (
      <div className="analyst-rating-card empty">
        <span className="empty-icon">📊</span>
        <span className="empty-message">暂无分析师评级数据</span>
      </div>
    )
  }

  const ratingDisplay = getRatingDisplay(composite.consensusRating)
  const upside = composite.averageTargetPrice && currentPrice
    ? calculateUpside(composite.averageTargetPrice, currentPrice)
    : null

  return (
    <div className="analyst-rating-card">
      {/* Header with consensus rating */}
      <div className="analyst-card-header">
        <div className="header-left">
          <h3 className="card-title">分析师评级</h3>
          <span className="symbol-label">{symbol}</span>
        </div>
        <div className={`consensus-badge ${ratingDisplay.colorClass}`}>
          <span className="consensus-icon">{ratingDisplay.icon}</span>
          <span className="consensus-label">{ratingDisplay.label}</span>
        </div>
      </div>

      {/* Target price section */}
      <div className="target-price-section">
        <div className="target-price-main">
          <div className="price-item">
            <span className="price-label">平均目标价</span>
            <span className="price-value">
              {composite.averageTargetPrice
                ? `$${composite.averageTargetPrice.toFixed(2)}`
                : '--'}
            </span>
            {upside !== null && (
              <span className={`upside-badge ${upside >= 0 ? 'upside-positive' : 'upside-negative'}`}>
                {upside >= 0 ? '+' : ''}{upside.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <div className="target-price-range">
          <div className="price-range-item">
            <span className="range-label">最高</span>
            <span className="range-value">
              {composite.highTargetPrice
                ? `$${composite.highTargetPrice.toFixed(2)}`
                : '--'}
            </span>
          </div>
          <div className="price-range-item">
            <span className="range-label">最低</span>
            <span className="range-value">
              {composite.lowTargetPrice
                ? `$${composite.lowTargetPrice.toFixed(2)}`
                : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* Rating distribution */}
      <div className="rating-distribution">
        <h4 className="distribution-title">评级分布 ({composite.numberOfAnalysts} 位分析师)</h4>
        <div className="distribution-bars">
          <DistributionBar
            label="强烈买入"
            count={composite.ratingDistribution.strongBuy}
            total={composite.numberOfAnalysts}
            colorClass="bar-strong-buy"
          />
          <DistributionBar
            label="买入"
            count={composite.ratingDistribution.buy}
            total={composite.numberOfAnalysts}
            colorClass="bar-buy"
          />
          <DistributionBar
            label="持有"
            count={composite.ratingDistribution.hold}
            total={composite.numberOfAnalysts}
            colorClass="bar-hold"
          />
          <DistributionBar
            label="卖出"
            count={composite.ratingDistribution.sell}
            total={composite.numberOfAnalysts}
            colorClass="bar-sell"
          />
          <DistributionBar
            label="强烈卖出"
            count={composite.ratingDistribution.strongSell}
            total={composite.numberOfAnalysts}
            colorClass="bar-strong-sell"
          />
        </div>
      </div>

      {/* Footer with details toggle */}
      <div className="analyst-card-footer">
        <span className="updated-at">
          更新于: {formatDate(composite.lastUpdated)}
        </span>
        <button
          className="details-btn"
          onClick={fetchRatings}
          disabled={ratingsLoading}
        >
          {ratingsLoading ? '加载中...' : showDetails ? '收起详情' : '查看详情'}
        </button>
      </div>

      {/* Individual ratings panel */}
      {showDetails && (
        <div className="ratings-detail-panel">
          <div className="detail-header">
            <h4>各机构评级详情</h4>
            <button
              className="close-detail-btn"
              onClick={() => setShowDetails(false)}
            >
              ✕
            </button>
          </div>
          <div className="ratings-list">
            {ratings.map((rating) => (
              <RatingItem
                key={rating.id}
                rating={rating}
                currentPrice={currentPrice}
              />
            ))}
          </div>
          {ratings.length < totalRatings && (
            <button
              className="load-more-btn"
              onClick={loadMoreRatings}
              disabled={ratingsLoading}
            >
              {ratingsLoading ? '加载中...' : `加载更多 (${ratings.length}/${totalRatings})`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Distribution bar component
 */
interface DistributionBarProps {
  label: string
  count: number
  total: number
  colorClass: string
}

function DistributionBar({ label, count, total, colorClass }: DistributionBarProps) {
  const percentage = total > 0 ? (count / total) * 100 : 0

  return (
    <div className="distribution-row">
      <span className="distribution-label">{label}</span>
      <div className="distribution-bar-container">
        <div
          className={`distribution-bar ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="distribution-count">{count}</span>
    </div>
  )
}

/**
 * Individual rating item component
 * Implements Requirement 19.6: 标注评级发布日期和分析师所属机构
 */
interface RatingItemProps {
  rating: AnalystRatingData
  currentPrice?: number
}

function RatingItem({ rating, currentPrice }: RatingItemProps) {
  const ratingDisplay = getRatingDisplay(rating.rating)
  const upside = rating.targetPrice && currentPrice
    ? calculateUpside(rating.targetPrice, currentPrice)
    : null

  return (
    <div className="rating-item">
      <div className="rating-item-header">
        <div className="firm-info">
          <span className="firm-name">{rating.firm}</span>
          <span className="analyst-name">{rating.analyst}</span>
        </div>
        <span className={`rating-badge-small ${ratingDisplay.colorClass}`}>
          {ratingDisplay.icon} {ratingDisplay.label}
        </span>
      </div>
      <div className="rating-item-body">
        <div className="target-info">
          <span className="target-label">目标价:</span>
          <span className="target-value">
            {rating.targetPrice ? `$${rating.targetPrice.toFixed(2)}` : '--'}
          </span>
          {upside !== null && (
            <span className={`upside-small ${upside >= 0 ? 'upside-positive' : 'upside-negative'}`}>
              ({upside >= 0 ? '+' : ''}{upside.toFixed(1)}%)
            </span>
          )}
        </div>
        {rating.previousRating && rating.previousRating !== rating.rating && (
          <div className="previous-rating">
            <span className="previous-label">前次评级:</span>
            <span className="previous-value">
              {analystRatingApi.formatRating(rating.previousRating)}
            </span>
            {rating.previousTargetPrice && (
              <span className="previous-target">
                → ${rating.previousTargetPrice.toFixed(2)}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="rating-item-footer">
        <span className="rating-date">{formatDate(rating.ratingDate)}</span>
      </div>
    </div>
  )
}

export default AnalystRatingCard
