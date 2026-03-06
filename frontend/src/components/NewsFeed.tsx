import { useState, useEffect, useRef, useCallback } from 'react'
import { newsApi, type NewsFeedItem } from '../services/newsApi'
import './NewsFeed.css'

interface NewsFeedProps {
  className?: string
  symbol?: string
  sector?: string
  autoRefreshInterval?: number // 自动刷新间隔（毫秒），默认5分钟
}

// 自动刷新间隔：5分钟（与后端缓存TTL一致）
const DEFAULT_AUTO_REFRESH_INTERVAL = 5 * 60 * 1000

export const NewsFeed = ({ 
  className = '', 
  symbol, 
  sector,
  autoRefreshInterval = DEFAULT_AUTO_REFRESH_INTERVAL 
}: NewsFeedProps) => {
  const [news, setNews] = useState<NewsFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [selectedNews, setSelectedNews] = useState<NewsFeedItem | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [nextRefreshIn, setNextRefreshIn] = useState(autoRefreshInterval / 1000)

  const observerTarget = useRef<HTMLDivElement>(null)
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Load news function
  const loadNews = useCallback(async (pageNum: number, isInitial: boolean, isRefresh: boolean = false) => {
    try {
      if (isInitial && !isRefresh) {
        setLoading(true)
        setNews([])
        setPage(1)
        setHasMore(true)
      } else if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoadingMore(true)
      }
      setError(null)

      let response
      if (symbol) {
        const stockResponse = await newsApi.getStockNews(symbol, { page: pageNum, limit: 20 })
        response = {
          ...stockResponse,
          data: stockResponse.data.map(item => ({
            ...item,
            priority: 'medium' as const,
          })),
        }
      } else if (sector) {
        const sectorResponse = await newsApi.getSectorNews(sector, { page: pageNum, limit: 20 })
        response = {
          ...sectorResponse,
          data: sectorResponse.data.map(item => ({
            ...item,
            priority: 'medium' as const,
          })),
        }
      } else {
        response = await newsApi.getNewsFeed({ page: pageNum, limit: 20 })
      }

      const newItems = response.data || []

      if (isInitial || isRefresh) {
        setNews(newItems)
        setPage(1)
        setHasMore(1 < response.pagination.totalPages)
      } else {
        setNews(prev => [...prev, ...newItems])
        setPage(pageNum)
        setHasMore(pageNum < response.pagination.totalPages)
      }

      setLastUpdated(new Date())
      setNextRefreshIn(autoRefreshInterval / 1000)
    } catch (err) {
      console.error('Failed to load news:', err)
      setError('加载新闻失败')
    } finally {
      setLoading(false)
      setLoadingMore(false)
      setRefreshing(false)
    }
  }, [symbol, sector, autoRefreshInterval])

  // Manual refresh handler
  const handleRefresh = useCallback(() => {
    if (refreshing || loading) return
    loadNews(1, true, true)
    
    // Reset auto-refresh timer
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current)
    }
    autoRefreshTimerRef.current = setInterval(() => {
      loadNews(1, true, true)
    }, autoRefreshInterval)
  }, [refreshing, loading, loadNews, autoRefreshInterval])

  // Load initial news
  useEffect(() => {
    loadNews(1, true)
  }, [symbol, sector, loadNews])

  // Auto-refresh timer
  useEffect(() => {
    // Set up auto-refresh
    autoRefreshTimerRef.current = setInterval(() => {
      loadNews(1, true, true)
    }, autoRefreshInterval)

    // Countdown timer (update every second)
    countdownTimerRef.current = setInterval(() => {
      setNextRefreshIn(prev => {
        if (prev <= 1) {
          return autoRefreshInterval / 1000
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current)
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
      }
    }
  }, [autoRefreshInterval, loadNews])

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadNews(page + 1, false)
        }
      },
      { threshold: 0.1 }
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [hasMore, loading, loadingMore, page, loadNews])

  const formatDate = (date: Date | string) => {
    const d = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`

    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatLastUpdated = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getCredibilityLabel = (credibility: 'high' | 'medium' | 'low') => {
    const labels = {
      high: '高可信度',
      medium: '中等可信度',
      low: '低可信度',
    }
    return labels[credibility]
  }

  const getImpactIcon = (direction: 'bullish' | 'bearish' | 'neutral') => {
    const icons = {
      bullish: '📈',
      bearish: '📉',
      neutral: '➡️',
    }
    return icons[direction]
  }

  const getImpactLabel = (direction: 'bullish' | 'bearish' | 'neutral') => {
    const labels = {
      bullish: '利好',
      bearish: '利空',
      neutral: '中性',
    }
    return labels[direction]
  }

  const getMagnitudeLabel = (magnitude: 'high' | 'medium' | 'low') => {
    const labels = {
      high: '高',
      medium: '中',
      low: '低',
    }
    return labels[magnitude]
  }

  const handleNewsClick = (item: NewsFeedItem) => {
    setSelectedNews(item)
  }

  const closeModal = () => {
    setSelectedNews(null)
  }

  if (loading) {
    return (
      <div className={`news-feed ${className}`}>
        <div className="news-loading">加载中...</div>
      </div>
    )
  }

  if (error && news.length === 0) {
    return (
      <div className={`news-feed ${className}`}>
        <div className="news-error">{error}</div>
      </div>
    )
  }

  return (
    <div className={`news-feed ${className}`}>
      <div className="news-header">
        <div className="news-header-top">
          <h2>{symbol ? `${symbol} 相关新闻` : sector ? `${sector} 板块新闻` : '最新资讯'}</h2>
          <button 
            className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
            onClick={handleRefresh}
            disabled={refreshing || loading}
            title="刷新新闻"
          >
            <span className="refresh-icon">🔄</span>
            {refreshing ? '刷新中...' : '刷新'}
          </button>
        </div>
        <div className="news-header-info">
          {lastUpdated && (
            <span className="last-updated">
              上次更新: {formatLastUpdated(lastUpdated)}
            </span>
          )}
          <span className="next-refresh">
            下次自动刷新: {formatCountdown(nextRefreshIn)}
          </span>
        </div>
      </div>

      {news.length === 0 ? (
        <div className="news-empty">
          <p>暂无新闻</p>
        </div>
      ) : (
        <>
          <div className="news-list">
            {news.map(item => (
              <div
                key={item.id}
                className={`news-item priority-${item.priority}`}
                onClick={() => handleNewsClick(item)}
              >
                <div className="news-item-header">
                  <div className="news-meta">
                    <span className="news-source">{item.source}</span>
                    <span className="news-credibility">
                      {getCredibilityLabel(item.sourceCredibility)}
                    </span>
                    <span className="news-time">{formatDate(item.publishedAt)}</span>
                  </div>
                  {item.priority === 'high' && <span className="priority-badge">重要</span>}
                </div>

                <h3 className="news-title">{item.title}</h3>

                {item.summary && <p className="news-summary">{item.summary}</p>}

                {item.impactAnalysis && (
                  <div className="impact-analysis">
                    <div className="impact-header">
                      <span className="impact-icon">
                        {getImpactIcon(item.impactAnalysis.direction)}
                      </span>
                      <span className={`impact-direction ${item.impactAnalysis.direction}`}>
                        {getImpactLabel(item.impactAnalysis.direction)}
                      </span>
                      <span className="impact-magnitude">
                        影响程度: {getMagnitudeLabel(item.impactAnalysis.magnitude)}
                      </span>
                      <span className="impact-confidence">
                        置信度: {Math.round(item.impactAnalysis.confidence * 100)}%
                      </span>
                    </div>
                    <p className="impact-summary">{item.impactAnalysis.summary}</p>
                  </div>
                )}

                {item.symbols.length > 0 && (
                  <div className="news-symbols">
                    {item.symbols.map(sym => (
                      <span key={sym} className="symbol-tag">
                        {sym}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {hasMore && (
            <div ref={observerTarget} className="load-more-trigger">
              {loadingMore && <div className="loading-more">加载更多...</div>}
            </div>
          )}

          {!hasMore && news.length > 0 && <div className="no-more-news">没有更多新闻了</div>}
        </>
      )}

      {selectedNews && (
        <div className="news-modal-overlay" onClick={closeModal}>
          <div className="news-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>
              ×
            </button>

            <div className="modal-header">
              <h2>{selectedNews.title}</h2>
              <div className="modal-meta">
                <span className="news-source">{selectedNews.source}</span>
                <span className="news-credibility">
                  {getCredibilityLabel(selectedNews.sourceCredibility)}
                </span>
                <span className="news-time">{formatDate(selectedNews.publishedAt)}</span>
              </div>
            </div>

            {selectedNews.impactAnalysis && (
              <div className="modal-impact">
                <h3>影响分析</h3>
                <div className="impact-details">
                  <div className="impact-row">
                    <span className="impact-label">影响方向:</span>
                    <span className={`impact-value ${selectedNews.impactAnalysis.direction}`}>
                      {getImpactIcon(selectedNews.impactAnalysis.direction)}{' '}
                      {getImpactLabel(selectedNews.impactAnalysis.direction)}
                    </span>
                  </div>
                  <div className="impact-row">
                    <span className="impact-label">影响程度:</span>
                    <span className="impact-value">
                      {getMagnitudeLabel(selectedNews.impactAnalysis.magnitude)}
                    </span>
                  </div>
                  <div className="impact-row">
                    <span className="impact-label">置信度:</span>
                    <span className="impact-value">
                      {Math.round(selectedNews.impactAnalysis.confidence * 100)}%
                    </span>
                  </div>
                </div>
                <p className="impact-summary">{selectedNews.impactAnalysis.summary}</p>
                {selectedNews.impactAnalysis.keyPoints.length > 0 && (
                  <div className="key-points">
                    <h4>关键要点:</h4>
                    <ul>
                      {selectedNews.impactAnalysis.keyPoints.map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {selectedNews.content && (
              <div className="modal-content">
                <h3>详细内容</h3>
                <p>{selectedNews.content}</p>
              </div>
            )}

            {selectedNews.symbols.length > 0 && (
              <div className="modal-symbols">
                <h4>相关股票:</h4>
                <div className="symbols-list">
                  {selectedNews.symbols.map(sym => (
                    <span key={sym} className="symbol-tag">
                      {sym}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-footer">
              <a
                href={selectedNews.url}
                target="_blank"
                rel="noopener noreferrer"
                className="view-original"
              >
                查看原文 →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
