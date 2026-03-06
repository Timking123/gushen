import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { initSocket, connectSocket, disconnectSocket } from '../services/socket'
import { notificationService } from '../services/notificationService'

// Components
import { StockChart } from '../components/StockChart'
import { CompanyProfile } from '../components/CompanyProfile'
import { RealTimeQuote } from '../components/RealTimeQuote'
import { FinancialSummary } from '../components/FinancialSummary'
import { AnalystRatings } from '../components/AnalystRatings'
import { InsiderTrades } from '../components/InsiderTrades'
import { WatchlistButton } from '../components/WatchlistButton'
import { NewsFeed } from '../components/NewsFeed'

import './StockDetailPage.css'

/**
 * StockDetailPage Component
 * 
 * Main page component for displaying comprehensive stock information.
 * Integrates all sub-components: K-line chart, company profile, real-time quote,
 * technical indicators, financial data, analyst ratings, insider trades, news, and watchlist button.
 * 
 * Implements Requirements:
 * - 1.1-1.5: 可缩放K线图
 * - 2.1-2.5: 公司基本信息
 * - 3.1-3.5: 公司相关新闻
 * - 4.1-4.6: 实时报价和涨跌幅
 * - 5.1-5.6: 技术指标
 * - 6.1-6.6: 财务数据摘要
 * - 7.1-7.5: 分析师评级
 * - 8.1-8.6: 内部交易记录
 * - 9.1-9.6: 添加到自选股
 */
export function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuthStore()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initialize socket and notification service for authenticated users
  useEffect(() => {
    if (isAuthenticated && user) {
      const token = localStorage.getItem('token')
      initSocket(token || undefined)
      connectSocket()
      notificationService.init(user.id)

      return () => {
        disconnectSocket()
        notificationService.cleanup()
      }
    }
  }, [isAuthenticated, user])

  // Validate symbol and set loading state
  useEffect(() => {
    if (!symbol) {
      setError('股票代码无效')
      setLoading(false)
      return
    }

    // Symbol is valid, components will handle their own loading
    setLoading(false)
    setError(null)
  }, [symbol])

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigate(-1)
  }, [navigate])

  // Handle watchlist status change
  const handleWatchlistChange = useCallback((isInWatchlist: boolean) => {
    console.log(`Watchlist status changed for ${symbol}: ${isInWatchlist}`)
  }, [symbol])

  // Loading state
  if (loading) {
    return (
      <div className="stock-detail-page">
        <div className="stock-detail-loading">
          <div className="loading-spinner" />
          <span>加载股票信息...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !symbol) {
    return (
      <div className="stock-detail-page">
        <div className="stock-detail-header">
          <div className="header-left">
            <button className="back-button" onClick={handleBack}>
              <span>←</span>
              <span>返回</span>
            </button>
          </div>
        </div>
        <div className="stock-detail-error">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error || '股票代码无效'}</span>
          <button className="retry-btn" onClick={handleBack}>
            返回上一页
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="stock-detail-page">
      {/* Header with navigation and watchlist button */}
      <div className="stock-detail-header">
        <div className="header-left">
          <button className="back-button" onClick={handleBack}>
            <span>←</span>
            <span>返回</span>
          </button>
          <span className="stock-symbol-header">{symbol}</span>
        </div>
        <div className="header-right">
          <WatchlistButton 
            symbol={symbol} 
            onStatusChange={handleWatchlistChange}
          />
        </div>
      </div>

      {/* Main content area */}
      <div className="stock-detail-content">
        <div className="detail-grid">
          {/* Top Section: Real-time Quote and Company Profile */}
          <div className="detail-top-section">
            <div className="detail-card">
              <RealTimeQuote symbol={symbol} />
            </div>
            <div className="detail-card">
              <CompanyProfile symbol={symbol} />
            </div>
          </div>

          {/* Chart Section: K-line chart with technical indicators */}
          <div className="detail-chart-section">
            <StockChart symbol={symbol} />
          </div>

          {/* Middle Section: Financial Summary and Analyst Ratings */}
          <div className="detail-middle-section">
            <div className="detail-card">
              <FinancialSummary symbol={symbol} />
            </div>
            <div className="detail-card">
              <AnalystRatings symbol={symbol} />
            </div>
          </div>

          {/* Bottom Section: Insider Trades and News */}
          <div className="detail-bottom-section">
            <div className="detail-card">
              <InsiderTrades symbol={symbol} limit={10} />
            </div>
            <div className="detail-card news-section">
              <div className="news-section-header">
                <h3>📰 相关新闻</h3>
              </div>
              <NewsFeed symbol={symbol} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StockDetailPage
