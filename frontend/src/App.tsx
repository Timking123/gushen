import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom'
import { useEffect, useCallback } from 'react'
import { useAuthStore } from './stores/authStore'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ScreenerPage from './pages/ScreenerPage'
import EarningsCalendarPage from './pages/EarningsCalendarPage'
import PortfolioPage from './pages/PortfolioPage'
import StockDetailPage from './pages/StockDetailPage'
import { WatchlistPanel } from './components/WatchlistPanel'
import { NewsFeed } from './components/NewsFeed'
import { NotificationPanel } from './components/NotificationPanel'
import { MarketOverview } from './components/MarketOverview'
import { initSocket, connectSocket, disconnectSocket } from './services/socket'
import { notificationService } from './services/notificationService'
import './App.css'

// Placeholder HomePage - will be fully implemented in later tasks
const HomePage = () => {
  const { isAuthenticated, user, logout } = useAuthStore()
  const navigate = useNavigate()

  /**
   * Handle stock click - navigate to stock detail page
   * Implements Requirement 13.3: Click stock to navigate to detail page
   */
  const handleStockClick = useCallback((symbol: string) => {
    navigate(`/stock/${symbol}`)
  }, [navigate])

  useEffect(() => {
    if (isAuthenticated && user) {
      // Initialize socket connection
      const token = localStorage.getItem('token')
      initSocket(token || undefined)
      connectSocket()

      // Initialize notification service
      notificationService.init(user.id)

      // Request notification permission
      notificationService.requestPermission()

      return () => {
        disconnectSocket()
        notificationService.cleanup()
      }
    }
  }, [isAuthenticated, user])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Smart Stock Analyzer</h1>
          <p>智能股票分析平台</p>
        </div>
        <div className="header-right">
          <Link to="/screener" className="nav-link">
            📊 股票筛选器
          </Link>
          <Link to="/earnings" className="nav-link">
            📅 财报日历
          </Link>
          <Link to="/portfolio" className="nav-link">
            💼 投资组合
          </Link>
          {isAuthenticated && (
            <div className="user-info">
              <NotificationPanel />
              <span>欢迎回来，{user?.email}</span>
              <button onClick={logout} className="logout-button">
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>

      {isAuthenticated ? (
        <div className="home-content">
          {/* Market Overview Section - Implements Requirements 18.1, 18.4, 18.5, 13.3 */}
          <div className="market-overview-section">
            <MarketOverview onStockClick={handleStockClick} />
          </div>
          
          <div className="main-layout">
            <div className="sidebar">
              <WatchlistPanel />
            </div>
            <div className="main-content">
              <NewsFeed />
            </div>
          </div>
        </div>
      ) : (
        <div className="guest-prompt">
          <p>您正在以访客身份浏览，部分功能受限</p>
          <div className="auth-links">
            <Link to="/login" className="auth-link primary">
              登录
            </Link>
            <Link to="/register" className="auth-link secondary">
              注册
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

const NotFoundPage = () => (
  <div className="page">
    <h1>404 - 页面未找到</h1>
    <p>您访问的页面不存在</p>
    <Link to="/">返回首页</Link>
  </div>
)

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/screener" element={<ScreenerPage />} />
          <Route path="/earnings" element={<EarningsCalendarPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/stock/:symbol" element={<StockDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
