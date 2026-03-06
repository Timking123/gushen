import { useState, useEffect } from 'react'
import type { QuantRating, RatingHistoryEntry } from '../types'
import { RatingBadge } from './RatingBadge'
import { quantRatingApi } from '../services/quantRatingApi'
import './QuantRatingCard.css'

interface QuantRatingCardProps {
  symbol: string
  rating?: QuantRating
  showHistory?: boolean
  onError?: (error: Error) => void
}

/**
 * Score dimension configuration
 */
interface ScoreDimension {
  key: keyof Pick<QuantRating, 'valuationScore' | 'growthScore' | 'profitabilityScore' | 'momentumScore' | 'revisionsScore'>
  label: string
  labelEn: string
  description: string
  icon: string
}

const SCORE_DIMENSIONS: ScoreDimension[] = [
  {
    key: 'valuationScore',
    label: '估值',
    labelEn: 'Valuation',
    description: '基于P/E、P/B、P/S等估值指标',
    icon: '💰',
  },
  {
    key: 'growthScore',
    label: '成长性',
    labelEn: 'Growth',
    description: '基于收入增长、EPS增长等指标',
    icon: '📊',
  },
  {
    key: 'profitabilityScore',
    label: '盈利能力',
    labelEn: 'Profitability',
    description: '基于ROE、ROA、利润率等指标',
    icon: '💵',
  },
  {
    key: 'momentumScore',
    label: '动量',
    labelEn: 'Momentum',
    description: '基于价格趋势和技术指标',
    icon: '🚀',
  },
  {
    key: 'revisionsScore',
    label: '修正因子',
    labelEn: 'Revisions',
    description: '基于分析师预期修正',
    icon: '📝',
  },
]

/**
 * Get score color class based on score value
 */
const getScoreColorClass = (score: number): string => {
  if (score >= 4) return 'score-excellent'
  if (score >= 3) return 'score-good'
  if (score >= 2) return 'score-neutral'
  if (score >= 1) return 'score-poor'
  return 'score-very-poor'
}

/**
 * Get score bar width percentage
 */
const getScoreBarWidth = (score: number): number => {
  return Math.min(Math.max((score / 5) * 100, 0), 100)
}

/**
 * QuantRatingCard Component
 * Displays comprehensive quant rating with all dimension scores
 * 
 * Implements Requirements:
 * - 13.1: 显示综合量化评级（强烈买入/买入/持有/卖出/强烈卖出）
 * - 13.3: 展示各维度的具体得分（估值、成长性、盈利能力、动量、修正因子）
 */
export function QuantRatingCard({
  symbol,
  rating: initialRating,
  showHistory = false,
  onError,
}: QuantRatingCardProps) {
  const [rating, setRating] = useState<QuantRating | null>(initialRating || null)
  const [history, setHistory] = useState<RatingHistoryEntry[]>([])
  const [loading, setLoading] = useState(!initialRating)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)

  // Fetch rating if not provided
  useEffect(() => {
    if (!initialRating && symbol) {
      fetchRating()
    }
  }, [symbol, initialRating])

  const fetchRating = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await quantRatingApi.getQuantRating(symbol)
      setRating(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取评级失败'
      setError(errorMessage)
      onError?.(err instanceof Error ? err : new Error(errorMessage))
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async () => {
    if (history.length > 0) {
      setShowHistoryPanel(true)
      return
    }

    try {
      setHistoryLoading(true)
      const data = await quantRatingApi.getRatingHistory(symbol, 10)
      setHistory(data)
      setShowHistoryPanel(true)
    } catch (err) {
      console.error('Failed to fetch rating history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="quant-rating-card loading">
        <div className="loading-spinner" />
        <span>加载评级数据...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="quant-rating-card error">
        <span className="error-icon">⚠️</span>
        <span className="error-message">{error}</span>
        <button className="retry-btn" onClick={fetchRating}>
          重试
        </button>
      </div>
    )
  }

  if (!rating) {
    return (
      <div className="quant-rating-card empty">
        <span className="empty-icon">📊</span>
        <span className="empty-message">暂无评级数据</span>
      </div>
    )
  }

  return (
    <div className="quant-rating-card">
      <div className="rating-card-header">
        <div className="header-left">
          <h3 className="card-title">量化评级</h3>
          <span className="symbol-label">{symbol}</span>
        </div>
        <RatingBadge rating={rating.overallRating} score={rating.overallScore} size="large" />
      </div>

      <div className="rating-dimensions">
        <h4 className="dimensions-title">各维度得分</h4>
        {SCORE_DIMENSIONS.map((dimension) => {
          const score = rating[dimension.key]
          return (
            <div key={dimension.key} className="dimension-row">
              <div className="dimension-info">
                <span className="dimension-icon">{dimension.icon}</span>
                <span className="dimension-label">{dimension.label}</span>
                <span className="dimension-description" title={dimension.description}>
                  ℹ️
                </span>
              </div>
              <div className="dimension-score-container">
                <div className="score-bar-bg">
                  <div
                    className={`score-bar ${getScoreColorClass(score)}`}
                    style={{ width: `${getScoreBarWidth(score)}%` }}
                  />
                </div>
                <span className={`score-value ${getScoreColorClass(score)}`}>
                  {score.toFixed(1)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {(rating.sectorRank || rating.industryRank) && (
        <div className="rating-rankings">
          <h4 className="rankings-title">排名</h4>
          <div className="rankings-grid">
            {rating.sectorRank && (
              <div className="ranking-item">
                <span className="ranking-label">板块排名</span>
                <span className="ranking-value">#{rating.sectorRank}</span>
              </div>
            )}
            {rating.industryRank && (
              <div className="ranking-item">
                <span className="ranking-label">行业排名</span>
                <span className="ranking-value">#{rating.industryRank}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rating-card-footer">
        <span className="updated-at">
          更新于: {new Date(rating.updatedAt).toLocaleString('zh-CN')}
        </span>
        {showHistory && (
          <button
            className="history-btn"
            onClick={fetchHistory}
            disabled={historyLoading}
          >
            {historyLoading ? '加载中...' : '查看历史'}
          </button>
        )}
      </div>

      {showHistoryPanel && history.length > 0 && (
        <div className="history-panel">
          <div className="history-header">
            <h4>评级历史</h4>
            <button className="close-history-btn" onClick={() => setShowHistoryPanel(false)}>
              ✕
            </button>
          </div>
          <div className="history-list">
            {history.map((entry) => (
              <div key={entry.id} className="history-entry">
                <div className="history-date">
                  {new Date(entry.recordedAt).toLocaleDateString('zh-CN')}
                </div>
                <RatingBadge rating={entry.overallRating} score={entry.overallScore} size="small" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
