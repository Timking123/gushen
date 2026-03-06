import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ScreenerResultItem, ScreenerFilters } from '../services/screenerApi'
import { WatchlistButton } from './WatchlistButton'
import './ScreenerResults.css'

/**
 * View mode type
 */
type ViewMode = 'table' | 'card'

/**
 * Sort configuration
 */
interface SortConfig {
  field: string
  order: 'asc' | 'desc'
}

/**
 * Sort option definition
 */
interface SortOption {
  value: string
  label: string
  order: 'asc' | 'desc'
}

/**
 * Predefined sort options
 */
const SORT_OPTIONS: SortOption[] = [
  { value: 'marketCap', label: '市值 (高→低)', order: 'desc' },
  { value: 'marketCap', label: '市值 (低→高)', order: 'asc' },
  { value: 'changePercent', label: '涨幅 (高→低)', order: 'desc' },
  { value: 'changePercent', label: '跌幅 (高→低)', order: 'asc' },
  { value: 'price', label: '价格 (高→低)', order: 'desc' },
  { value: 'price', label: '价格 (低→高)', order: 'asc' },
  { value: 'name', label: '名称 (A→Z)', order: 'asc' },
  { value: 'name', label: '名称 (Z→A)', order: 'desc' },
  { value: 'symbol', label: '代码 (A→Z)', order: 'asc' },
  { value: 'pe', label: 'P/E (低→高)', order: 'asc' },
  { value: 'pe', label: 'P/E (高→低)', order: 'desc' },
  { value: 'rsi14', label: 'RSI (低→高)', order: 'asc' },
  { value: 'rsi14', label: 'RSI (高→低)', order: 'desc' },
]

/**
 * ScreenerResults props
 */
interface ScreenerResultsProps {
  results: ScreenerResultItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  loading?: boolean
  onPageChange: (page: number) => void
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void
  currentFilters: ScreenerFilters
}

/**
 * Column definition for table
 */
interface Column {
  key: string
  label: string
  sortable: boolean
  format?: (value: unknown, item: ScreenerResultItem) => string | React.ReactNode
  align?: 'left' | 'center' | 'right'
}

/**
 * Format number with commas
 */
const formatNumber = (value: number | null): string => {
  if (value === null) return '-'
  return value.toLocaleString('en-US')
}

/**
 * Format market cap
 */
const formatMarketCap = (value: number | null): string => {
  if (value === null) return '-'
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  return `$${formatNumber(value)}`
}

/**
 * Format percentage
 */
const formatPercent = (value: number | null): string => {
  if (value === null) return '-'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

/**
 * Format price
 */
const formatPrice = (value: number | null): string => {
  if (value === null) return '-'
  return `$${value.toFixed(2)}`
}

/**
 * Table columns definition
 */
const COLUMNS: Column[] = [
  {
    key: 'symbol',
    label: '代码',
    sortable: true,
    align: 'left',
  },
  {
    key: 'name',
    label: '名称',
    sortable: true,
    align: 'left',
  },
  {
    key: 'price',
    label: '价格',
    sortable: true,
    format: value => formatPrice(value as number | null),
    align: 'right',
  },
  {
    key: 'changePercent',
    label: '涨跌幅',
    sortable: true,
    format: value => {
      const percent = value as number | null
      if (percent === null) return <span>-</span>
      const className = percent >= 0 ? 'positive' : 'negative'
      return <span className={`change-value ${className}`}>{formatPercent(percent)}</span>
    },
    align: 'right',
  },
  {
    key: 'marketCap',
    label: '市值',
    sortable: true,
    format: value => formatMarketCap(value as number | null),
    align: 'right',
  },
  {
    key: 'sector',
    label: '板块',
    sortable: false,
    format: value => (value as string | null) || '-',
    align: 'left',
  },
  {
    key: 'pe',
    label: 'P/E',
    sortable: true,
    format: value => {
      const pe = value as number | null
      return pe !== null ? pe.toFixed(2) : '-'
    },
    align: 'right',
  },
  {
    key: 'rsi14',
    label: 'RSI',
    sortable: true,
    format: value => {
      const rsi = value as number | null
      if (rsi === null) return '-'
      let className = ''
      if (rsi < 30) className = 'oversold'
      else if (rsi > 70) className = 'overbought'
      return <span className={`rsi-value ${className}`}>{rsi.toFixed(1)}</span>
    },
    align: 'right',
  },
  {
    key: 'action',
    label: '操作',
    sortable: false,
    align: 'center',
  },
]

/**
 * ScreenerResults Component
 * Displays screener results in table or card view
 *
 * Implements Requirements:
 * - 10.5: Real-time display of filtered results
 * - 10.7: Support sorting by different metrics
 * - 10.8: Table or card view for results
 */
export const ScreenerResults = ({
  results,
  pagination,
  loading = false,
  onPageChange,
  onSortChange,
  currentFilters,
}: ScreenerResultsProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const navigate = useNavigate()

  const sortConfig: SortConfig | null = useMemo(() => {
    if (currentFilters.sortBy) {
      return {
        field: currentFilters.sortBy,
        order: currentFilters.sortOrder || 'desc',
      }
    }
    return null
  }, [currentFilters.sortBy, currentFilters.sortOrder])

  /**
   * Get current sort option key for dropdown
   */
  const currentSortKey = useMemo(() => {
    if (!sortConfig) return ''
    return `${sortConfig.field}-${sortConfig.order}`
  }, [sortConfig])

  /**
   * Handle sort dropdown change
   */
  const handleSortDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    if (!value) return
    
    const [field, order] = value.split('-')
    onSortChange(field, order as 'asc' | 'desc')
  }

  /**
   * Handle column header click for sorting
   */
  const handleSort = (field: string) => {
    if (sortConfig?.field === field) {
      // Toggle order
      onSortChange(field, sortConfig.order === 'asc' ? 'desc' : 'asc')
    } else {
      // New sort field, default to desc
      onSortChange(field, 'desc')
    }
  }

  /**
   * Navigate to stock detail page
   */
  const handleStockClick = (symbol: string, e: React.MouseEvent) => {
    // Don't navigate if clicking on watchlist button
    if ((e.target as HTMLElement).closest('.watchlist-button')) {
      return
    }
    navigate(`/stock/${symbol}`)
  }

  /**
   * Render sort indicator
   */
  const renderSortIndicator = (field: string) => {
    if (sortConfig?.field !== field) return null
    return <span className="sort-indicator">{sortConfig.order === 'asc' ? '↑' : '↓'}</span>
  }

  /**
   * Render table view
   */
  const renderTableView = () => (
    <div className="results-table-container">
      <table className="results-table">
        <thead>
          <tr>
            {COLUMNS.map(column => (
              <th
                key={column.key}
                className={`${column.sortable ? 'sortable' : ''} align-${column.align || 'left'}`}
                onClick={() => column.sortable && handleSort(column.key)}
              >
                {column.label}
                {column.sortable && renderSortIndicator(column.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map(item => (
            <tr 
              key={item.symbol} 
              className="clickable-row"
              onClick={(e) => handleStockClick(item.symbol, e)}
            >
              {COLUMNS.map(column => (
                <td key={column.key} className={`align-${column.align || 'left'}`}>
                  {column.key === 'action' ? (
                    <WatchlistButton symbol={item.symbol} className="screener-watchlist-btn" />
                  ) : column.format
                    ? column.format(item[column.key as keyof ScreenerResultItem], item)
                    : String(item[column.key as keyof ScreenerResultItem] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  /**
   * Render card view
   */
  const renderCardView = () => (
    <div className="results-cards">
      {results.map(item => (
        <div 
          key={item.symbol} 
          className="result-card clickable-card"
          onClick={(e) => handleStockClick(item.symbol, e)}
        >
          <div className="card-header">
            <div className="card-symbol">{item.symbol}</div>
            <div
              className={`card-change ${item.changePercent !== null && item.changePercent >= 0 ? 'positive' : 'negative'}`}
            >
              {formatPercent(item.changePercent)}
            </div>
          </div>
          <div className="card-name">{item.name}</div>
          <div className="card-price">{formatPrice(item.price)}</div>
          <div className="card-details">
            <div className="card-detail">
              <span className="detail-label">市值</span>
              <span className="detail-value">{formatMarketCap(item.marketCap)}</span>
            </div>
            <div className="card-detail">
              <span className="detail-label">P/E</span>
              <span className="detail-value">{item.pe !== null ? item.pe.toFixed(2) : '-'}</span>
            </div>
            <div className="card-detail">
              <span className="detail-label">RSI</span>
              <span
                className={`detail-value ${item.rsi14 !== null && item.rsi14 < 30 ? 'oversold' : item.rsi14 !== null && item.rsi14 > 70 ? 'overbought' : ''}`}
              >
                {item.rsi14 !== null ? item.rsi14.toFixed(1) : '-'}
              </span>
            </div>
            <div className="card-detail">
              <span className="detail-label">板块</span>
              <span className="detail-value">{item.sector || '-'}</span>
            </div>
          </div>
          <div className="card-actions">
            <WatchlistButton symbol={item.symbol} className="screener-watchlist-btn" />
          </div>
        </div>
      ))}
    </div>
  )

  /**
   * Render pagination
   */
  const renderPagination = () => {
    const { page, totalPages, total } = pagination
    const pages: (number | string)[] = []

    // Build page numbers array
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (page <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages)
      } else if (page >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
      } else {
        pages.push(1, '...', page - 1, page, page + 1, '...', totalPages)
      }
    }

    return (
      <div className="results-pagination">
        <div className="pagination-info">
          共 {total} 条结果，第 {page} / {totalPages} 页
        </div>
        <div className="pagination-controls">
          <button
            className="pagination-btn"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
          >
            上一页
          </button>
          {pages.map((p, index) =>
            typeof p === 'number' ? (
              <button
                key={index}
                className={`pagination-btn ${p === page ? 'active' : ''}`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            ) : (
              <span key={index} className="pagination-ellipsis">
                {p}
              </span>
            )
          )}
          <button
            className="pagination-btn"
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            下一页
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screener-results">
      <div className="results-header">
        <div className="results-count">
          找到 <strong>{pagination.total}</strong> 只股票
        </div>
        <div className="results-controls">
          <div className="sort-dropdown">
            <label>排序：</label>
            <select value={currentSortKey} onChange={handleSortDropdownChange}>
              <option value="">默认排序</option>
              {SORT_OPTIONS.map((option, index) => (
                <option key={index} value={`${option.value}-${option.order}`}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="表格视图"
            >
              ☰
            </button>
            <button
              className={`view-btn ${viewMode === 'card' ? 'active' : ''}`}
              onClick={() => setViewMode('card')}
              title="卡片视图"
            >
              ▦
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="results-loading">
          <div className="loading-spinner"></div>
          <span>正在筛选...</span>
        </div>
      ) : results.length === 0 ? (
        <div className="results-empty">
          <div className="empty-icon">📊</div>
          <p>没有找到符合条件的股票</p>
          <p className="empty-hint">请尝试调整筛选条件</p>
        </div>
      ) : (
        <>
          {viewMode === 'table' ? renderTableView() : renderCardView()}
          {pagination.totalPages > 1 && renderPagination()}
        </>
      )}
    </div>
  )
}
