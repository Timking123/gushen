import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  insiderApi,
  type InsiderTrade,
  type InsiderTradeTrend,
  type TransactionType,
  type InsiderTradeFilters,
} from '../services/insiderApi'
import './InsiderTradeList.css'

interface InsiderTradeListProps {
  className?: string
  /** Filter by specific stock symbol */
  symbol?: string
  /** Initial number of trades to show */
  initialLimit?: number
  /** Show trend summary */
  showTrend?: boolean
  /** Days for trend calculation */
  trendDays?: number
}

/**
 * InsiderTradeList Component
 *
 * Implements Requirements:
 * - 12.1: WHEN 用户查看股票详情 THEN Insider_Tracker SHALL 显示近期内部交易记录
 * - 12.5: WHEN 用户浏览内部交易列表 THEN Insider_Tracker SHALL 支持按交易类型、金额、日期筛选
 */
export const InsiderTradeList = ({
  className = '',
  symbol,
  initialLimit = 20,
  showTrend = true,
  trendDays = 90,
}: InsiderTradeListProps) => {
  const navigate = useNavigate()
  const [trades, setTrades] = useState<InsiderTrade[]>([])
  const [trend, setTrend] = useState<InsiderTradeTrend | null>(null)
  const [loading, setLoading] = useState(true)
  const [trendLoading, setTrendLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
    limit: initialLimit,
  })

  // Filter states
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<TransactionType[]>([])
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  })
  const [valueRange, setValueRange] = useState<{ min: string; max: string }>({
    min: '',
    max: '',
  })
  const [sortBy, setSortBy] = useState<InsiderTradeFilters['sortBy']>('tradeDate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Load insider trades
  const loadTrades = useCallback(async (page: number = 1) => {
    try {
      setLoading(true)
      setError(null)

      const filters: InsiderTradeFilters = {
        symbol,
        transactionTypes: transactionTypeFilter.length > 0 ? transactionTypeFilter : undefined,
        startDate: dateRange.start || undefined,
        endDate: dateRange.end || undefined,
        minValue: valueRange.min ? parseFloat(valueRange.min) : undefined,
        maxValue: valueRange.max ? parseFloat(valueRange.max) : undefined,
        sortBy,
        sortOrder,
        page,
        limit: pagination.limit,
      }

      let result
      if (symbol && !transactionTypeFilter.length && !dateRange.start && !dateRange.end && !valueRange.min && !valueRange.max) {
        // Use the simpler endpoint when no filters are applied
        const stockResult = await insiderApi.getInsiderTradesBySymbol(symbol, pagination.limit)
        result = {
          trades: stockResult.trades,
          pagination: {
            page: 1,
            limit: pagination.limit,
            total: stockResult.count,
            totalPages: Math.ceil(stockResult.count / pagination.limit),
          },
        }
      } else {
        result = await insiderApi.getInsiderTrades(filters)
      }

      setTrades(result.trades)
      setPagination(prev => ({
        ...prev,
        page: result.pagination.page,
        total: result.pagination.total,
        totalPages: result.pagination.totalPages,
      }))
    } catch (err) {
      console.error('Failed to load insider trades:', err)
      setError('加载内部交易记录失败')
    } finally {
      setLoading(false)
    }
  }, [symbol, transactionTypeFilter, dateRange, valueRange, sortBy, sortOrder, pagination.limit])

  // Load trend data
  const loadTrend = useCallback(async () => {
    if (!symbol || !showTrend) return

    try {
      setTrendLoading(true)
      const trendData = await insiderApi.getInsiderTrend(symbol, trendDays)
      setTrend(trendData)
    } catch (err) {
      console.error('Failed to load insider trend:', err)
      // Don't set error for trend - it's optional
    } finally {
      setTrendLoading(false)
    }
  }, [symbol, showTrend, trendDays])

  useEffect(() => {
    loadTrades(1)
  }, [loadTrades])

  useEffect(() => {
    loadTrend()
  }, [loadTrend])

  // Handle stock click - navigate to stock details
  const handleStockClick = (stockSymbol: string) => {
    navigate(`/stock/${stockSymbol}`)
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // Format currency value
  const formatCurrency = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`
    return `$${value.toFixed(2)}`
  }

  // Format shares number
  const formatShares = (shares: number) => {
    if (shares >= 1e6) return `${(shares / 1e6).toFixed(2)}M`
    if (shares >= 1e3) return `${(shares / 1e3).toFixed(2)}K`
    return shares.toLocaleString()
  }

  // Get transaction type label
  const getTransactionTypeLabel = (type: TransactionType) => {
    const labels: Record<TransactionType, string> = {
      buy: '买入',
      sell: '卖出',
      exercise: '行权',
    }
    return labels[type]
  }

  // Get transaction type class
  const getTransactionTypeClass = (type: TransactionType) => {
    return `transaction-${type}`
  }

  // Handle transaction type filter change
  const handleTransactionTypeChange = (type: TransactionType) => {
    setTransactionTypeFilter(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type)
      }
      return [...prev, type]
    })
  }

  // Handle date range change
  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  // Handle value range change
  const handleValueRangeChange = (field: 'min' | 'max', value: string) => {
    setValueRange(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  // Handle sort change
  const handleSortChange = (field: InsiderTradeFilters['sortBy']) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  // Handle page change
  const handlePageChange = (newPage: number) => {
    loadTrades(newPage)
  }

  // Clear all filters
  const clearFilters = () => {
    setTransactionTypeFilter([])
    setDateRange({ start: '', end: '' })
    setValueRange({ min: '', max: '' })
    setSortBy('tradeDate')
    setSortOrder('desc')
  }

  // Check if any filters are active
  const hasActiveFilters = transactionTypeFilter.length > 0 || 
    dateRange.start || dateRange.end || 
    valueRange.min || valueRange.max

  // Render loading state
  if (loading && trades.length === 0) {
    return (
      <div className={`insider-trade-list ${className}`}>
        <div className="insider-loading">加载中...</div>
      </div>
    )
  }

  // Render error state
  if (error && trades.length === 0) {
    return (
      <div className={`insider-trade-list ${className}`}>
        <div className="insider-error">{error}</div>
      </div>
    )
  }

  return (
    <div className={`insider-trade-list ${className}`}>
      {/* Header */}
      <div className="insider-header">
        <h2>{symbol ? `${symbol} 内部交易` : '内部交易记录'}</h2>
        {hasActiveFilters && (
          <button className="clear-filters-btn" onClick={clearFilters}>
            清除筛选
          </button>
        )}
      </div>

      {/* Trend Summary */}
      {showTrend && symbol && (
        <div className="trend-summary">
          {trendLoading ? (
            <div className="trend-loading">加载趋势数据...</div>
          ) : trend ? (
            <>
              <div className="trend-header">
                <h3>内部交易趋势 ({trend.period})</h3>
              </div>
              <div className="trend-stats">
                <div className="trend-stat">
                  <span className="stat-label">净股数</span>
                  <span className={`stat-value ${trend.netShares >= 0 ? 'positive' : 'negative'}`}>
                    {trend.netShares >= 0 ? '+' : ''}{formatShares(trend.netShares)}
                  </span>
                </div>
                <div className="trend-stat">
                  <span className="stat-label">净金额</span>
                  <span className={`stat-value ${trend.netValue >= 0 ? 'positive' : 'negative'}`}>
                    {trend.netValue >= 0 ? '+' : ''}{formatCurrency(Math.abs(trend.netValue))}
                  </span>
                </div>
                <div className="trend-stat buy">
                  <span className="stat-label">买入</span>
                  <span className="stat-value">{trend.buyTransactions} 笔 / {formatCurrency(trend.totalBuyValue)}</span>
                </div>
                <div className="trend-stat sell">
                  <span className="stat-label">卖出</span>
                  <span className="stat-value">{trend.sellTransactions} 笔 / {formatCurrency(trend.totalSellValue)}</span>
                </div>
                {trend.exerciseTransactions > 0 && (
                  <div className="trend-stat exercise">
                    <span className="stat-label">行权</span>
                    <span className="stat-value">{trend.exerciseTransactions} 笔</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="trend-empty">暂无趋势数据</div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="insider-filters">
        <div className="filter-group">
          <label>交易类型</label>
          <div className="transaction-type-filters">
            <button
              className={`type-btn buy ${transactionTypeFilter.includes('buy') ? 'active' : ''}`}
              onClick={() => handleTransactionTypeChange('buy')}
            >
              买入
            </button>
            <button
              className={`type-btn sell ${transactionTypeFilter.includes('sell') ? 'active' : ''}`}
              onClick={() => handleTransactionTypeChange('sell')}
            >
              卖出
            </button>
            <button
              className={`type-btn exercise ${transactionTypeFilter.includes('exercise') ? 'active' : ''}`}
              onClick={() => handleTransactionTypeChange('exercise')}
            >
              行权
            </button>
          </div>
        </div>

        <div className="filter-group">
          <label>日期范围</label>
          <div className="date-inputs">
            <input
              type="date"
              value={dateRange.start}
              onChange={e => handleDateRangeChange('start', e.target.value)}
              placeholder="开始日期"
            />
            <span>至</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={e => handleDateRangeChange('end', e.target.value)}
              placeholder="结束日期"
            />
          </div>
        </div>

        <div className="filter-group">
          <label>金额范围</label>
          <div className="value-inputs">
            <input
              type="number"
              value={valueRange.min}
              onChange={e => handleValueRangeChange('min', e.target.value)}
              placeholder="最小金额"
              min="0"
            />
            <span>至</span>
            <input
              type="number"
              value={valueRange.max}
              onChange={e => handleValueRangeChange('max', e.target.value)}
              placeholder="最大金额"
              min="0"
            />
          </div>
        </div>
      </div>

      {/* Trade List */}
      {trades.length === 0 ? (
        <div className="insider-empty">
          <p>暂无内部交易记录</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="trades-table-container">
            <table className="trades-table">
              <thead>
                <tr>
                  <th 
                    className={`sortable ${sortBy === 'tradeDate' ? 'active' : ''}`}
                    onClick={() => handleSortChange('tradeDate')}
                  >
                    日期
                    {sortBy === 'tradeDate' && (
                      <span className="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  {!symbol && <th>股票</th>}
                  <th 
                    className={`sortable ${sortBy === 'insiderName' ? 'active' : ''}`}
                    onClick={() => handleSortChange('insiderName')}
                  >
                    内部人士
                    {sortBy === 'insiderName' && (
                      <span className="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th>职位</th>
                  <th>类型</th>
                  <th 
                    className={`sortable ${sortBy === 'shares' ? 'active' : ''}`}
                    onClick={() => handleSortChange('shares')}
                  >
                    股数
                    {sortBy === 'shares' && (
                      <span className="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th>价格</th>
                  <th 
                    className={`sortable ${sortBy === 'totalValue' ? 'active' : ''}`}
                    onClick={() => handleSortChange('totalValue')}
                  >
                    总价值
                    {sortBy === 'totalValue' && (
                      <span className="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {trades.map(trade => (
                  <tr key={trade.id}>
                    <td className="date-cell">
                      <div className="date-info">
                        <span className="trade-date">{formatDate(trade.tradeDate)}</span>
                        <span className="filed-date">申报: {formatDate(trade.filedAt)}</span>
                      </div>
                    </td>
                    {!symbol && (
                      <td className="symbol-cell">
                        <button
                          className="symbol-link"
                          onClick={() => handleStockClick(trade.symbol)}
                        >
                          {trade.symbol}
                        </button>
                      </td>
                    )}
                    <td className="insider-cell">{trade.insiderName}</td>
                    <td className="title-cell">{trade.insiderTitle || '-'}</td>
                    <td className="type-cell">
                      <span className={`transaction-badge ${getTransactionTypeClass(trade.transactionType)}`}>
                        {getTransactionTypeLabel(trade.transactionType)}
                      </span>
                    </td>
                    <td className="shares-cell">{formatShares(trade.shares)}</td>
                    <td className="price-cell">${trade.pricePerShare.toFixed(2)}</td>
                    <td className="value-cell">{formatCurrency(trade.totalValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="trades-cards">
            {trades.map(trade => (
              <div key={trade.id} className="trade-card">
                <div className="card-header">
                  <div className="card-left">
                    {!symbol && (
                      <button
                        className="symbol-link"
                        onClick={() => handleStockClick(trade.symbol)}
                      >
                        {trade.symbol}
                      </button>
                    )}
                    <span className={`transaction-badge ${getTransactionTypeClass(trade.transactionType)}`}>
                      {getTransactionTypeLabel(trade.transactionType)}
                    </span>
                  </div>
                  <span className="card-date">{formatDate(trade.tradeDate)}</span>
                </div>
                <div className="card-body">
                  <div className="insider-info">
                    <span className="insider-name">{trade.insiderName}</span>
                    {trade.insiderTitle && (
                      <span className="insider-title">{trade.insiderTitle}</span>
                    )}
                  </div>
                  <div className="trade-details">
                    <div className="detail-item">
                      <span className="label">股数</span>
                      <span className="value">{formatShares(trade.shares)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">价格</span>
                      <span className="value">${trade.pricePerShare.toFixed(2)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">总价值</span>
                      <span className="value">{formatCurrency(trade.totalValue)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

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
                第 {pagination.page} / {pagination.totalPages} 页 (共 {pagination.total} 条)
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
        </>
      )}
    </div>
  )
}
