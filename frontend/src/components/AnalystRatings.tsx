import { useState, useEffect } from 'react'
import type { AnalystRatingSummary, AnalystRatingItem } from '../types'
import { stockDetailApi } from '../services/stockDetailApi'
import './AnalystRatings.css'

interface AnalystRatingsProps {
  symbol: string
  className?: string
}

/**
 * Calculate the upside percentage between average target price and current price.
 * Exported for use in property tests.
 *
 * @param averageTargetPrice - The average target price from analysts
 * @param currentPrice - The current stock price
 * @returns The upside percentage or null if averageTargetPrice is null or currentPrice is 0
 */
export function calculateUpsidePercent(
  averageTargetPrice: number | null,
  currentPrice: number
): number | null {
  if (averageTargetPrice === null || currentPrice === 0) {
    return null
  }
  return ((averageTargetPrice - currentPrice) / currentPrice) * 100
}

/**
 * Maps rating value to display text in Chinese
 */
function getRatingDisplayText(rating: string): string {
  const ratingMap: Record<string, string> = {
    strong_buy: '强烈买入',
    buy: '买入',
    hold: '持有',
    sell: '卖出',
    strong_sell: '强烈卖出',
  }
  return ratingMap[rating] || rating
}

/**
 * Returns CSS class based on rating value
 */
function getRatingClass(rating: string): string {
  switch (rating) {
    case 'strong_buy':
      return 'rating-strong-buy'
    case 'buy':
      return 'rating-buy'
    case 'hold':
      return 'rating-hold'
    case 'sell':
      return 'rating-sell'
    case 'strong_sell':
      return 'rating-strong-sell'
    default:
      return ''
  }
}

/**
 * Formats currency value for display
 */
function formatCurrency(value: number | null): string {
  if (value === null) {
    return '暂无数据'
  }
  return `$${value.toFixed(2)}`
}

/**
 * Formats percentage value for display
 */
function formatPercent(value: number | null): string {
  if (value === null) {
    return '暂无数据'
  }
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
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
 * AnalystRatings Component
 * Displays analyst ratings summary, target price information, and recent rating changes.
 *
 * Implements Requirements:
 * - 7.1: 显示分析师评级汇总（强烈买入/买入/持有/卖出/强烈卖出的数量分布）
 * - 7.2: 显示平均目标价和当前价格的差距百分比
 * - 7.3: 显示最近的分析师评级变动列表
 * - 7.4: 显示分析师姓名、所属机构、评级、目标价、评级日期
 * - 7.5: 无分析师评级数据时显示"暂无分析师评级"
 */
export function AnalystRatings({ symbol, className = '' }: AnalystRatingsProps) {
  const [summary, setSummary] = useState<AnalystRatingSummary | null>(null)
  const [ratings, setRatings] = useState<AnalystRatingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (symbol) {
      fetchAnalystRatings()
    }
  }, [symbol])

  const fetchAnalystRatings = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await stockDetailApi.getAnalystRatings(symbol)
      if (data) {
        setSummary(data.summary)
        setRatings(data.ratings)
      } else {
        setSummary(null)
        setRatings([])
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取分析师评级失败'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={`analyst-ratings loading ${className}`}>
        <div className="loading-spinner" />
        <span>加载分析师评级...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`analyst-ratings error ${className}`}>
        <span className="error-icon">⚠️</span>
        <span className="error-message">{error}</span>
        <button className="retry-btn" onClick={fetchAnalystRatings}>
          重试
        </button>
      </div>
    )
  }

  // Implements Requirement 7.5: 无分析师评级数据时显示"暂无分析师评级"
  if (!summary || summary.totalAnalysts === 0) {
    return (
      <div className={`analyst-ratings empty ${className}`}>
        <span className="empty-icon">📊</span>
        <span className="empty-message">暂无分析师评级</span>
      </div>
    )
  }

  const totalRatings = summary.strongBuy + summary.buy + summary.hold + summary.sell + summary.strongSell

  return (
    <div className={`analyst-ratings ${className}`}>
      <div className="analyst-header">
        <h3 className="analyst-title">分析师评级</h3>
        <span className="analyst-count">{summary.totalAnalysts} 位分析师</span>
      </div>

      <div className="analyst-content">
        {/* Rating Distribution Chart - Implements Requirement 7.1 */}
        <div className="ratings-section">
          <h4 className="section-title">
            <span className="section-icon">📈</span>
            评级分布
          </h4>
          <div className="rating-distribution">
            <div className="rating-bar-container">
              <RatingBar
                label="强烈买入"
                count={summary.strongBuy}
                total={totalRatings}
                colorClass="bar-strong-buy"
              />
              <RatingBar
                label="买入"
                count={summary.buy}
                total={totalRatings}
                colorClass="bar-buy"
              />
              <RatingBar
                label="持有"
                count={summary.hold}
                total={totalRatings}
                colorClass="bar-hold"
              />
              <RatingBar
                label="卖出"
                count={summary.sell}
                total={totalRatings}
                colorClass="bar-sell"
              />
              <RatingBar
                label="强烈卖出"
                count={summary.strongSell}
                total={totalRatings}
                colorClass="bar-strong-sell"
              />
            </div>
          </div>
        </div>

        {/* Target Price Section - Implements Requirement 7.2 */}
        <div className="ratings-section">
          <h4 className="section-title">
            <span className="section-icon">🎯</span>
            目标价
          </h4>
          <div className="target-price-grid">
            <div className="price-item">
              <span className="price-label">当前价格</span>
              <span className="price-value current">{formatCurrency(summary.currentPrice)}</span>
            </div>
            <div className="price-item">
              <span className="price-label">平均目标价</span>
              <span className="price-value target">{formatCurrency(summary.averageTargetPrice)}</span>
            </div>
            <div className="price-item">
              <span className="price-label">最高目标价</span>
              <span className="price-value high">{formatCurrency(summary.highTargetPrice)}</span>
            </div>
            <div className="price-item">
              <span className="price-label">最低目标价</span>
              <span className="price-value low">{formatCurrency(summary.lowTargetPrice)}</span>
            </div>
            <div className="price-item upside-item">
              <span className="price-label">潜在涨幅</span>
              <span className={`price-value upside ${getUpsideClass(summary.upsidePercent)}`}>
                {formatPercent(summary.upsidePercent)}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Ratings List - Implements Requirements 7.3, 7.4 */}
        {ratings.length > 0 && (
          <div className="ratings-section">
            <h4 className="section-title">
              <span className="section-icon">📋</span>
              最近评级变动
            </h4>
            <div className="ratings-list">
              {ratings.map((rating) => (
                <div key={rating.id} className="rating-item">
                  <div className="rating-item-header">
                    <div className="analyst-info">
                      <span className="analyst-name">{rating.analyst}</span>
                      <span className="analyst-firm">{rating.firm}</span>
                    </div>
                    <span className="rating-date">{formatDate(rating.ratingDate)}</span>
                  </div>
                  <div className="rating-item-body">
                    <div className="rating-change">
                      {rating.previousRating && (
                        <>
                          <span className={`rating-badge ${getRatingClass(rating.previousRating)}`}>
                            {getRatingDisplayText(rating.previousRating)}
                          </span>
                          <span className="rating-arrow">→</span>
                        </>
                      )}
                      <span className={`rating-badge ${getRatingClass(rating.rating)}`}>
                        {getRatingDisplayText(rating.rating)}
                      </span>
                    </div>
                    <div className="target-change">
                      {rating.previousTargetPrice !== null && (
                        <>
                          <span className="target-previous">{formatCurrency(rating.previousTargetPrice)}</span>
                          <span className="target-arrow">→</span>
                        </>
                      )}
                      <span className="target-current">{formatCurrency(rating.targetPrice)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * RatingBar Component
 * Displays a single rating bar in the distribution chart
 */
interface RatingBarProps {
  label: string
  count: number
  total: number
  colorClass: string
}

function RatingBar({ label, count, total, colorClass }: RatingBarProps) {
  const percentage = total > 0 ? (count / total) * 100 : 0

  return (
    <div className="rating-bar-row">
      <span className="rating-bar-label">{label}</span>
      <div className="rating-bar-track">
        <div
          className={`rating-bar-fill ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="rating-bar-count">{count}</span>
    </div>
  )
}

/**
 * Returns CSS class based on upside percentage
 */
function getUpsideClass(value: number | null): string {
  if (value === null) return ''
  if (value > 0) return 'positive'
  if (value < 0) return 'negative'
  return ''
}
