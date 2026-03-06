import type { OverallRating } from '../types'
import './RatingBadge.css'

interface RatingBadgeProps {
  rating: OverallRating
  score?: number
  size?: 'small' | 'medium' | 'large'
  showLabel?: boolean
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
const getRatingDisplay = (rating: OverallRating): RatingDisplay => {
  switch (rating) {
    case 'strong_buy':
      return {
        label: '强烈买入',
        labelEn: 'Strong Buy',
        icon: '🚀',
        colorClass: 'rating-strong-buy',
      }
    case 'buy':
      return {
        label: '买入',
        labelEn: 'Buy',
        icon: '📈',
        colorClass: 'rating-buy',
      }
    case 'hold':
      return {
        label: '持有',
        labelEn: 'Hold',
        icon: '➖',
        colorClass: 'rating-hold',
      }
    case 'sell':
      return {
        label: '卖出',
        labelEn: 'Sell',
        icon: '📉',
        colorClass: 'rating-sell',
      }
    case 'strong_sell':
      return {
        label: '强烈卖出',
        labelEn: 'Strong Sell',
        icon: '⚠️',
        colorClass: 'rating-strong-sell',
      }
  }
}

/**
 * RatingBadge Component
 * Displays the overall quant rating with appropriate styling
 * 
 * Implements Requirement 13.1: 显示综合量化评级（强烈买入/买入/持有/卖出/强烈卖出）
 */
export function RatingBadge({
  rating,
  score,
  size = 'medium',
  showLabel = true,
}: RatingBadgeProps) {
  const display = getRatingDisplay(rating)

  return (
    <div className={`rating-badge ${display.colorClass} rating-badge-${size}`}>
      <span className="rating-icon">{display.icon}</span>
      {showLabel && (
        <span className="rating-label">{display.label}</span>
      )}
      {score !== undefined && (
        <span className="rating-score">{score.toFixed(1)}</span>
      )}
    </div>
  )
}

/**
 * RatingBadgeCompact Component
 * A more compact version showing just the icon and score
 */
export function RatingBadgeCompact({
  rating,
  score,
}: {
  rating: OverallRating
  score?: number
}) {
  const display = getRatingDisplay(rating)

  return (
    <span className={`rating-badge-compact ${display.colorClass}`} title={display.label}>
      <span className="rating-icon">{display.icon}</span>
      {score !== undefined && (
        <span className="rating-score">{score.toFixed(1)}</span>
      )}
    </span>
  )
}
