import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  earningsApi,
  type EarningsEvent,
  type EarningsTiming,
  type EarningsCalendarFilters,
} from '../services/earningsApi'
import './EarningsCalendar.css'

interface EarningsCalendarProps {
  className?: string
  /** Filter by specific stock symbol */
  symbol?: string
  /** Show only watchlist stocks (requires authentication) */
  watchlistOnly?: boolean
  /** Initial view mode */
  initialView?: 'calendar' | 'list'
  /** Number of days to show in calendar view */
  daysToShow?: number
}

type ViewMode = 'calendar' | 'list'

/**
 * EarningsCalendar Component
 *
 * Implements Requirements:
 * - 11.1: WHEN 用户查看财报日历 THEN Earnings_Calendar SHALL 显示未来财报发布的时间表
 * - 11.7: WHEN 用户点击财报事件 THEN Earnings_Calendar SHALL 跳转到该股票的详情页面
 */
export const EarningsCalendar = ({
  className = '',
  symbol,
  watchlistOnly = false,
  initialView = 'list',
  daysToShow = 14,
}: EarningsCalendarProps) => {
  const navigate = useNavigate()
  const [events, setEvents] = useState<EarningsEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>(initialView)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [filters, setFilters] = useState<EarningsCalendarFilters>({
    sortBy: 'reportDate',
    sortOrder: 'asc',
    limit: 50,
  })
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
  })

  // Date range state for filtering
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
    const today = new Date()
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + daysToShow)
    return {
      start: today.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    }
  })

  // Timing filter state
  const [timingFilter, setTimingFilter] = useState<EarningsTiming[]>([])

  // Load earnings data
  const loadEarnings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      let result

      if (symbol) {
        // Load earnings for specific stock
        const stockResult = await earningsApi.getEarningsBySymbol(symbol)
        result = {
          events: stockResult.events,
          pagination: {
            page: 1,
            limit: stockResult.count,
            total: stockResult.count,
            totalPages: 1,
          },
        }
      } else if (watchlistOnly) {
        // Load watchlist earnings
        const watchlistResult = await earningsApi.getWatchlistUpcomingEarnings(daysToShow)
        result = {
          events: watchlistResult.events,
          pagination: {
            page: 1,
            limit: watchlistResult.count,
            total: watchlistResult.count,
            totalPages: 1,
          },
        }
      } else {
        // Load calendar with filters
        const calendarFilters: EarningsCalendarFilters = {
          ...filters,
          startDate: dateRange.start,
          endDate: dateRange.end,
          timing: timingFilter.length > 0 ? timingFilter : undefined,
        }
        result = await earningsApi.getEarningsCalendar(calendarFilters)
      }

      setEvents(result.events)
      setPagination({
        page: result.pagination.page,
        total: result.pagination.total,
        totalPages: result.pagination.totalPages,
      })
    } catch (err) {
      console.error('Failed to load earnings:', err)
      setError('加载财报日历失败')
    } finally {
      setLoading(false)
    }
  }, [symbol, watchlistOnly, daysToShow, filters, dateRange, timingFilter])

  useEffect(() => {
    loadEarnings()
  }, [loadEarnings])

  // Handle event click - navigate to stock details
  // Implements Requirement 11.7
  const handleEventClick = (event: EarningsEvent) => {
    navigate(`/stock/${event.symbol}`)
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    })
  }

  // Format short date for calendar
  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
    })
  }

  // Get timing label
  const getTimingLabel = (timing: EarningsTiming) => {
    const labels: Record<EarningsTiming, string> = {
      bmo: '盘前',
      amc: '盘后',
      unknown: '未知',
    }
    return labels[timing]
  }

  // Get timing class
  const getTimingClass = (timing: EarningsTiming) => {
    return `timing-${timing}`
  }

  // Format number with sign
  const formatWithSign = (value: number | null, suffix: string = '') => {
    if (value === null) return '-'
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}${suffix}`
  }

  // Format EPS value
  const formatEps = (value: number | null) => {
    if (value === null) return '-'
    return `$${value.toFixed(2)}`
  }

  // Format market cap
  const formatMarketCap = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-'
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
    return `$${value.toLocaleString()}`
  }

  // Get surprise class based on value
  const getSurpriseClass = (value: number | null) => {
    if (value === null) return ''
    if (value > 0) return 'positive'
    if (value < 0) return 'negative'
    return ''
  }

  // Group events by date for calendar view
  const groupEventsByDate = () => {
    const grouped: Record<string, EarningsEvent[]> = {}
    events.forEach(event => {
      const dateKey = event.reportDate.split('T')[0]
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(event)
    })
    return grouped
  }

  // Generate calendar days
  const generateCalendarDays = () => {
    const days: Date[] = []
    const start = new Date(dateRange.start)
    const end = new Date(dateRange.end)

    const current = new Date(start)
    while (current <= end) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    return days
  }

  // Handle date range change
  const handleDateRangeChange = (type: 'start' | 'end', value: string) => {
    setDateRange(prev => ({
      ...prev,
      [type]: value,
    }))
  }

  // Handle timing filter change
  const handleTimingFilterChange = (timing: EarningsTiming) => {
    setTimingFilter(prev => {
      if (prev.includes(timing)) {
        return prev.filter(t => t !== timing)
      }
      return [...prev, timing]
    })
  }

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }))
  }

  // Render loading state
  if (loading) {
    return (
      <div className={`earnings-calendar ${className}`}>
        <div className="earnings-loading">加载中...</div>
      </div>
    )
  }

  // Render error state
  if (error && events.length === 0) {
    return (
      <div className={`earnings-calendar ${className}`}>
        <div className="earnings-error">{error}</div>
      </div>
    )
  }

  const groupedEvents = groupEventsByDate()
  const calendarDays = generateCalendarDays()

  return (
    <div className={`earnings-calendar ${className}`}>
      {/* Header */}
      <div className="earnings-header">
        <h2>{symbol ? `${symbol} 财报历史` : watchlistOnly ? '自选股财报' : '财报日历'}</h2>
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            列表
          </button>
          <button
            className={`toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
            onClick={() => setViewMode('calendar')}
          >
            日历
          </button>
        </div>
      </div>

      {/* Filters */}
      {!symbol && (
        <div className="earnings-filters">
          <div className="filter-group">
            <label>日期范围</label>
            <div className="date-inputs">
              <input
                type="date"
                value={dateRange.start}
                onChange={e => handleDateRangeChange('start', e.target.value)}
              />
              <span>至</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={e => handleDateRangeChange('end', e.target.value)}
              />
            </div>
          </div>
          <div className="filter-group">
            <label>发布时间</label>
            <div className="timing-filters">
              <button
                className={`timing-btn ${timingFilter.includes('bmo') ? 'active' : ''}`}
                onClick={() => handleTimingFilterChange('bmo')}
              >
                盘前 (BMO)
              </button>
              <button
                className={`timing-btn ${timingFilter.includes('amc') ? 'active' : ''}`}
                onClick={() => handleTimingFilterChange('amc')}
              >
                盘后 (AMC)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {events.length === 0 ? (
        <div className="earnings-empty">
          <p>暂无财报数据</p>
        </div>
      ) : viewMode === 'list' ? (
        /* List View */
        <div className="earnings-list">
          {events.map(event => (
            <div
              key={event.id}
              className="earnings-item"
              onClick={() => handleEventClick(event)}
            >
              <div className="item-header">
                <div className="stock-info">
                  <span className="symbol">{event.symbol}</span>
                  {event.stockName && <span className="name">{event.stockName}</span>}
                </div>
                <div className="timing-info">
                  <span className={`timing-badge ${getTimingClass(event.timing)}`}>
                    {getTimingLabel(event.timing)}
                  </span>
                  <span className="report-date">{formatDate(event.reportDate)}</span>
                </div>
              </div>

              <div className="item-details">
                <div className="detail-row">
                  <div className="detail-item">
                    <span className="label">预期 EPS</span>
                    <span className="value">{formatEps(event.epsEstimate)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">实际 EPS</span>
                    <span className="value">{formatEps(event.epsActual)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">上期 EPS</span>
                    <span className="value">{formatEps(event.previousEps ?? null)}</span>
                  </div>
                  {event.epsSurprisePercent !== null && (
                    <div className="detail-item">
                      <span className="label">EPS 惊喜</span>
                      <span className={`value ${getSurpriseClass(event.epsSurprisePercent)}`}>
                        {formatWithSign(event.epsSurprisePercent, '%')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="detail-row secondary">
                  <div className="detail-item">
                    <span className="label">板块</span>
                    <span className="value">{event.sector || '-'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">市值</span>
                    <span className="value">{formatMarketCap(event.marketCap)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">财季</span>
                    <span className="value">
                      {event.fiscalYear} {event.fiscalQuarter}
                    </span>
                  </div>
                </div>
              </div>

              <div className="item-action">
                <span className="action-hint">点击查看详情 →</span>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                className="page-btn"
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                上一页
              </button>
              <span className="page-info">
                第 {pagination.page} / {pagination.totalPages} 页
              </span>
              <button
                className="page-btn"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                下一页
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Calendar View */
        <div className="earnings-calendar-view">
          <div className="calendar-grid">
            {calendarDays.map(day => {
              const dateKey = day.toISOString().split('T')[0]
              const dayEvents = groupedEvents[dateKey] || []
              const isToday = dateKey === new Date().toISOString().split('T')[0]
              const isSelected = dateKey === selectedDate.toISOString().split('T')[0]

              return (
                <div
                  key={dateKey}
                  className={`calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${dayEvents.length > 0 ? 'has-events' : ''}`}
                  onClick={() => setSelectedDate(day)}
                >
                  <div className="day-header">
                    <span className="day-date">{formatShortDate(dateKey)}</span>
                    <span className="day-weekday">
                      {day.toLocaleDateString('zh-CN', { weekday: 'short' })}
                    </span>
                  </div>
                  {dayEvents.length > 0 && (
                    <div className="day-events">
                      {dayEvents.slice(0, 3).map(event => (
                        <div
                          key={event.id}
                          className={`day-event ${getTimingClass(event.timing)}`}
                          onClick={e => {
                            e.stopPropagation()
                            handleEventClick(event)
                          }}
                        >
                          <span className="event-symbol">{event.symbol}</span>
                          <span className="event-timing">{getTimingLabel(event.timing)}</span>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="more-events">+{dayEvents.length - 3} 更多</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Selected date details */}
          {selectedDate && (
            <div className="selected-date-details">
              <h3>{formatDate(selectedDate.toISOString())}</h3>
              {groupedEvents[selectedDate.toISOString().split('T')[0]]?.length > 0 ? (
                <div className="selected-events">
                  {groupedEvents[selectedDate.toISOString().split('T')[0]].map(event => (
                    <div
                      key={event.id}
                      className="selected-event"
                      onClick={() => handleEventClick(event)}
                    >
                      <div className="event-header">
                        <span className="symbol">{event.symbol}</span>
                        {event.stockName && <span className="name">{event.stockName}</span>}
                        <span className={`timing-badge ${getTimingClass(event.timing)}`}>
                          {getTimingLabel(event.timing)}
                        </span>
                      </div>
                      <div className="event-eps">
                        <span>预期: {formatEps(event.epsEstimate)}</span>
                        <span>实际: {formatEps(event.epsActual)}</span>
                        {event.epsSurprisePercent !== null && (
                          <span className={getSurpriseClass(event.epsSurprisePercent)}>
                            {formatWithSign(event.epsSurprisePercent, '%')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-events">该日期暂无财报</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
