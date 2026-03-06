import { useState } from 'react'
import type { ImpactAnalysis } from '../types'
import './ImpactAnalysisCard.css'

interface ImpactAnalysisCardProps {
  analysis: ImpactAnalysis
  newsTitle?: string
}

/**
 * ImpactAnalysisCard Component
 * Displays AI-generated impact analysis for news items
 * Implements Requirements 3.1, 3.2, 3.5
 */
export function ImpactAnalysisCard({ analysis, newsTitle }: ImpactAnalysisCardProps) {
  const [showDetails, setShowDetails] = useState(false)

  // Determine if confidence is low (< 0.6)
  const isLowConfidence = analysis.confidence < 0.6

  // Get direction icon and color
  const getDirectionDisplay = () => {
    switch (analysis.direction) {
      case 'bullish':
        return { icon: '📈', label: '利好', color: 'bullish' }
      case 'bearish':
        return { icon: '📉', label: '利空', color: 'bearish' }
      case 'neutral':
        return { icon: '➖', label: '中性', color: 'neutral' }
    }
  }

  // Get magnitude display
  const getMagnitudeDisplay = () => {
    switch (analysis.magnitude) {
      case 'high':
        return '高'
      case 'medium':
        return '中'
      case 'low':
        return '低'
    }
  }

  const directionDisplay = getDirectionDisplay()
  const magnitudeDisplay = getMagnitudeDisplay()

  return (
    <div className={`impact-analysis-card ${directionDisplay.color}`}>
      <div className="impact-header">
        <div className="impact-direction">
          <span className="direction-icon">{directionDisplay.icon}</span>
          <span className="direction-label">{directionDisplay.label}</span>
        </div>
        <div className="impact-magnitude">
          <span className="magnitude-label">影响程度:</span>
          <span className={`magnitude-value magnitude-${analysis.magnitude}`}>
            {magnitudeDisplay}
          </span>
        </div>
        <div className="impact-confidence">
          <span className="confidence-label">置信度:</span>
          <span className={`confidence-value ${isLowConfidence ? 'low-confidence' : ''}`}>
            {(analysis.confidence * 100).toFixed(0)}%
          </span>
          {isLowConfidence && (
            <span className="low-confidence-badge" title="置信度较低，建议自行判断">
              ⚠️
            </span>
          )}
        </div>
      </div>

      <div className="impact-summary">
        <p>{analysis.summary}</p>
        {isLowConfidence && (
          <div className="low-confidence-warning">
            ⚠️ 此分析置信度较低，建议结合其他信息自行判断
          </div>
        )}
      </div>

      <div className="impact-key-points">
        <h4>关键要点:</h4>
        <ul>
          {analysis.keyPoints.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
      </div>

      {(analysis.historicalComparison || newsTitle) && (
        <button className="show-details-btn" onClick={() => setShowDetails(!showDetails)}>
          {showDetails ? '收起详情' : '查看详情'}
        </button>
      )}

      {showDetails && (
        <div className="impact-details-modal">
          <div className="modal-overlay" onClick={() => setShowDetails(false)} />
          <div className="modal-content">
            <div className="modal-header">
              <h3>分析详情</h3>
              <button className="close-btn" onClick={() => setShowDetails(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              {newsTitle && (
                <div className="detail-section">
                  <h4>相关新闻</h4>
                  <p>{newsTitle}</p>
                </div>
              )}

              <div className="detail-section">
                <h4>影响分析</h4>
                <div className="analysis-metrics">
                  <div className="metric">
                    <span className="metric-label">方向:</span>
                    <span className={`metric-value ${directionDisplay.color}`}>
                      {directionDisplay.icon} {directionDisplay.label}
                    </span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">程度:</span>
                    <span className={`metric-value magnitude-${analysis.magnitude}`}>
                      {magnitudeDisplay}
                    </span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">置信度:</span>
                    <span className={`metric-value ${isLowConfidence ? 'low-confidence' : ''}`}>
                      {(analysis.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>分析摘要</h4>
                <p>{analysis.summary}</p>
              </div>

              <div className="detail-section">
                <h4>关键要点</h4>
                <ul>
                  {analysis.keyPoints.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </div>

              {analysis.historicalComparison && (
                <div className="detail-section">
                  <h4>历史对比</h4>
                  <p>{analysis.historicalComparison}</p>
                </div>
              )}

              <div className="detail-section">
                <h4>分析时间</h4>
                <p>{new Date(analysis.analyzedAt).toLocaleString('zh-CN')}</p>
              </div>

              {isLowConfidence && (
                <div className="detail-section warning-section">
                  <h4>⚠️ 注意事项</h4>
                  <p>
                    此分析的置信度为 {(analysis.confidence * 100).toFixed(0)}%，
                    低于建议阈值（60%）。建议结合其他信息来源和您自己的判断来做出投资决策。
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
