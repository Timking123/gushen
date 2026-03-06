import { useState, useEffect, useCallback } from 'react'
import type { DividendCalendarEntry, DividendSummary, DividendHistoryItem } from '../types'
import {
  getDividendCalendar,
  getDividendSummary,
  getDividendHistory,
} from '../services/dividendApi'
import './DividendCalendar.css'

/**
 * Props for DividendCalendar component
 */
interface DividendCalendarProps {
  symbol?: string
  watchlistSymbols?: string[]
  showHistory?: boolean
  onStockSelect?: (symbol: string) => void
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(4)}`
}

/**
 * Format percentage
 */
function formatPercent(value: number | null): string {
  if (value === null) return '-'
  return `${value.toFixed(2)}%`
}

/**
 * Get frequency label
 */
function getFrequencyLabel(frequency: string | null): string {
  if (!frequency) return '-'
  const labels: Record<string, string> = {
    annual: '年度',
    semi_annual: '半年度',
    quarterly: '季度',
    monthly: '月度',
  }
  return labels[frequency] || frequency
}

/**
 * Calculate days until date
 */
function daysUntil(dateString: string): number {
  const date = new Date(dateString)
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/**
 * DividendCalendar Component
 * Displays dividend calendar, summary, and history
 * 
 * Implements Requirements:
 * - 15.1: Display dividend rate, frequency, and history
 * - 15.2: Display upcoming ex-dividend and pay dates
 * - 15.4: Support filtering by dividend yield and growth rate
 */
export default function DividendCalendar({
  symbol,
  watchlistSymbols,
  showHistory = true,
  onStockSelect,
}: DividendCalendarProps) {
  const [calendarEvents, setCalendarEvents] = useState<DividendCalendarEntry[]>([])
  const [summary, setSummary] = useState<DividendSummary | null>(null)
  const [history, setHistory] = useState<DividendHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'calendar' | 'summary' | 'history'>('calendar')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Load calendar events
  const loadCalendar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filters = symbol
        ? { symbols: [symbol] }
        : watchlistSymbols?.length
        ? { symbols: watchlistSymbols }
        : undefined

      const response = await getDividendCalendar(filters, { page, limit: 20 })
      setCalendarEvents(response.events)
      setTotalPages(response.pagination.totalPages)
    } catch (err) {
      setError('加载股息日历失败')
      console.error('Failed to load dividend calendar:', err)
    } finally {
      setLoading(false)
    }
  }, [symbol, watchlistSymbols, page])

  // Load summary for a specific stock
  const loadSummary = useCallback(async () => {
    if (!symbol) return
    setLoading(true)
    setError(null)
    try {
      const data = await getDividendSummary(symbol)
      setSummary(data)
    } catch (err) {
      setError('加载股息摘要失败')
      console.error('Failed to load dividend summary:', err)
    } finally {
      setLoading(false)
    }
  }, [symbol])

  // Load history for a specific stock
  const loadHistory = useCallback(async () => {
    if (!symbol) return
    setLoading(true)
    setError(null)
    try {
      const data = await getDividendHistory(symbol, 20)
      setHistory(data)
    } catch (err) {
      setError('加载股息历史失败')
      console.error('Failed to load dividend history:', err)
    } finally {
      setLoading(false)
    }
  }, [symbol])

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'calendar') {
      loadCalendar()
    } else if (activeTab === 'summary' && symbol) {
      loadSummary()
    } else if (activeTab === 'history' && symbol) {
      loadHistory()
    }
  }, [activeTab, loadCalendar, loadSummary, loadHistory, symbol])

  // Handle stock click
  const handleStockClick = (stockSymbol: string) => {
    if (onStockSelect) {
      onStockSelect(stockSymbol)
    }
  }

  // Render calendar event
  const renderCalendarEvent = (event: DividendCalendarEntry) => {
    const days = daysUntil(event.exDate)
    const isUpcoming = days > 0 && days <= 7

    return (
      <div
        key={event.id}
        className={`dividend-event ${isUpcoming ? 'upcoming' : ''}`}
        onClick={() => handleStockClick(event.symbol)}
      >
        <div className="event-header">
          <span className="event-symbol">{event.symbol}</span>
          {event.stockName && <span className="event-name">{event.stockName}</span>}
          {isUpcoming && <span className="upcoming-badge">{days}天后除息</span>}
        </div>
        <div className="event-details">
          <div className="detail-row">
            <span className="detail-label">除息日</span>
            <span className="detail-value">{formatDate(event.exDate)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">派息日</span>
            <span className="detail-value">{formatDate(event.payDate)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">每股股息</span>
            <span className="detail-value amount">{formatCurrency(event.amount)}</span>
          </div>
          {event.yield && (
            <div className="detail-row">
              <span className="detail-label">股息率</span>
              <span className="detail-value yield">{formatPercent(event.yield)}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Render summary
  const renderSummary = () => {
    if (!summary) return <div className="no-data">暂无股息数据</div>

    return (
      <div className="dividend-summary">
        <div className="summary-header">
          <span className="summary-symbol">{summary.symbol}</span>
          {summary.stockName && <span className="summary-name">{summary.stockName}</span>}
        </div>

        <div className="summary-grid">
          <div className="summary-item">
            <span className="item-label">当前股息率</span>
            <span className="item-value highlight">{formatPercent(summary.currentYield)}</span>
          </div>
          <div className="summary-item">
            <span className="item-label">年度股息</span>
            <span className="item-value">{summary.annualDividend ? formatCurrency(summary.annualDividend) : '-'}</span>
          </div>
          <div className="summary-item">
            <span className="item-label">派息频率</span>
            <span className="item-value">{getFrequencyLabel(summary.frequency)}</span>
          </div>
          <div className="summary-item">
            <span className="item-label">派息率</span>
            <span className="item-value">{formatPercent(summary.payoutRatio)}</span>
          </div>
          <div className="summary-item">
            <span className="item-label">股息增长率</span>
            <span className={`item-value ${summary.dividendGrowthRate && summary.dividendGrowthRate > 0 ? 'positive' : summary.dividendGrowthRate && summary.dividendGrowthRate < 0 ? 'negative' : ''}`}>
              {formatPercent(summary.dividendGrowthRate)}
            </span>
          </div>
          <div className="summary-item">
            <span className="item-label">连续派息年数</span>
            <span className="item-value">{summary.consecutiveYears} 年</span>
          </div>
        </div>

        <div className="summary-dates">
          <div className="date-section">
            <h4>上次派息</h4>
            {summary.lastExDate ? (
              <>
                <div className="date-row">
                  <span>除息日:</span>
                  <span>{formatDate(summary.lastExDate)}</span>
                </div>
                <div className="date-row">
                  <span>派息日:</span>
                  <span>{summary.lastPayDate ? formatDate(summary.lastPayDate) : '-'}</span>
                </div>
                <div className="date-row">
                  <span>金额:</span>
                  <span>{summary.lastAmount ? formatCurrency(summary.lastAmount) : '-'}</span>
                </div>
              </>
            ) : (
              <div className="no-data">暂无数据</div>
            )}
          </div>

          <div className="date-section">
            <h4>下次派息</h4>
            {summary.nextExDate ? (
              <>
                <div className="date-row">
                  <span>除息日:</span>
                  <span>{formatDate(summary.nextExDate)}</span>
                </div>
                <div className="date-row">
                  <span>派息日:</span>
                  <span>{summary.nextPayDate ? formatDate(summary.nextPayDate) : '-'}</span>
                </div>
                <div className="date-row">
                  <span>预计金额:</span>
                  <span>{summary.nextAmount ? formatCurrency(summary.nextAmount) : '-'}</span>
                </div>
              </>
            ) : (
              <div className="no-data">暂无数据</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Render history
  const renderHistory = () => {
    if (history.length === 0) return <div className="no-data">暂无股息历史</div>

    return (
      <div className="dividend-history">
        <table className="history-table">
          <thead>
            <tr>
              <th>除息日</th>
              <th>派息日</th>
              <th>每股股息</th>
              <th>股息率</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id}>
                <td>{formatDate(item.exDate)}</td>
                <td>{formatDate(item.payDate)}</td>
                <td className="amount">{formatCurrency(item.amount)}</td>
                <td>{formatPercent(item.yield)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="dividend-calendar-container">
      {/* Tabs */}
      <div className="dividend-tabs">
        <button
          className={activeTab === 'calendar' ? 'active' : ''}
          onClick={() => setActiveTab('calendar')}
        >
          股息日历
        </button>
        {symbol && (
          <>
            <button
              className={activeTab === 'summary' ? 'active' : ''}
              onClick={() => setActiveTab('summary')}
            >
              股息摘要
            </button>
            {showHistory && (
              <button
                className={activeTab === 'history' ? 'active' : ''}
                onClick={() => setActiveTab('history')}
              >
                历史记录
              </button>
            )}
          </>
        )}
      </div>

      {/* Error message */}
      {error && <div className="dividend-error">{error}</div>}

      {/* Content */}
      <div className="dividend-content">
        {loading ? (
          <div className="dividend-loading">加载中...</div>
        ) : (
          <>
            {activeTab === 'calendar' && (
              <>
                <div className="calendar-events">
                  {calendarEvents.length > 0 ? (
                    calendarEvents.map(renderCalendarEvent)
                  ) : (
                    <div className="no-data">暂无即将到来的股息事件</div>
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      上一页
                    </button>
                    <span>
                      {page} / {totalPages}
                    </span>
                    <button
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      下一页
                    </button>
                  </div>
                )}
              </>
            )}

            {activeTab === 'summary' && renderSummary()}
            {activeTab === 'history' && renderHistory()}
          </>
        )}
      </div>
    </div>
  )
}
