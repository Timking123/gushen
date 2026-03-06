import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { EarningsCalendar } from '../components/EarningsCalendar'
import './EarningsCalendarPage.css'

/**
 * EarningsCalendarPage Component
 * Main page for viewing earnings calendar
 *
 * Implements Requirements:
 * - 11.1: WHEN 用户查看财报日历 THEN Earnings_Calendar SHALL 显示未来财报发布的时间表
 * - 11.7: WHEN 用户点击财报事件 THEN Earnings_Calendar SHALL 跳转到该股票的详情页面
 */
const EarningsCalendarPage = () => {
  const { isAuthenticated } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'all' | 'watchlist'>('all')

  return (
    <div className="earnings-page">
      <div className="earnings-page-header">
        <div className="header-left">
          <Link to="/" className="back-link">
            ← 返回首页
          </Link>
          <h1>📅 财报日历</h1>
          <p>追踪股票财报发布时间，提前做好投资决策准备</p>
        </div>
      </div>

      {/* Tab navigation for authenticated users */}
      {isAuthenticated && (
        <div className="earnings-tabs">
          <button
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            全部财报
          </button>
          <button
            className={`tab-btn ${activeTab === 'watchlist' ? 'active' : ''}`}
            onClick={() => setActiveTab('watchlist')}
          >
            自选股财报
          </button>
        </div>
      )}

      <div className="earnings-page-content">
        {activeTab === 'all' ? (
          <EarningsCalendar
            className="earnings-calendar-full"
            initialView="list"
            daysToShow={30}
          />
        ) : (
          <EarningsCalendar
            className="earnings-calendar-full"
            watchlistOnly={true}
            initialView="list"
            daysToShow={14}
          />
        )}
      </div>

      {/* Guest prompt */}
      {!isAuthenticated && (
        <div className="guest-banner">
          <span>登录后可查看自选股财报提醒</span>
          <Link to="/login" className="login-link">
            立即登录
          </Link>
        </div>
      )}
    </div>
  )
}

export default EarningsCalendarPage
