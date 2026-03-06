import { useState, useCallback } from 'react'
import type { ScreenerFilters } from '../services/screenerApi'
import './FilterPanel.css'

/**
 * Filter category type
 */
type FilterCategory = 'descriptive' | 'fundamental' | 'technical'

/**
 * FilterPanel props
 */
interface FilterPanelProps {
  filters: ScreenerFilters
  onFiltersChange: (filters: ScreenerFilters) => void
  onApply: () => void
  loading?: boolean
  hideZeroPrice?: boolean
  onToggleZeroPrice?: () => void
}

/**
 * Available exchanges for filtering
 */
const EXCHANGES = ['NYSE', 'NASDAQ', 'AMEX']

/**
 * Available sectors for filtering
 */
const SECTORS = [
  'Technology',
  'Healthcare',
  'Financial Services',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Industrials',
  'Energy',
  'Basic Materials',
  'Real Estate',
  'Utilities',
  'Communication Services',
]

/**
 * Market cap ranges (in billions)
 */
const MARKET_CAP_RANGES = [
  { label: '微型 (<$300M)', min: 0, max: 300000000 },
  { label: '小型 ($300M-$2B)', min: 300000000, max: 2000000000 },
  { label: '中型 ($2B-$10B)', min: 2000000000, max: 10000000000 },
  { label: '大型 ($10B-$200B)', min: 10000000000, max: 200000000000 },
  { label: '超大型 (>$200B)', min: 200000000000, max: undefined },
]

/**
 * FilterPanel Component
 * Provides filter controls for stock screening
 *
 * Implements Requirements:
 * - 10.1: Display descriptive, fundamental, and technical filter categories
 * - 10.2: 描述性筛选条件
 * - 10.3: 基本面筛选条件
 * - 10.4: 技术面筛选条件
 */
export const FilterPanel = ({
  filters,
  onFiltersChange,
  onApply,
  loading = false,
  hideZeroPrice = true,
  onToggleZeroPrice,
}: FilterPanelProps) => {
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('descriptive')

  /**
   * Update a single filter value
   */
  const updateFilter = useCallback(
    <K extends keyof ScreenerFilters>(key: K, value: ScreenerFilters[K]) => {
      onFiltersChange({
        ...filters,
        [key]: value,
      })
    },
    [filters, onFiltersChange]
  )

  /**
   * Toggle array filter value
   */
  const toggleArrayFilter = useCallback(
    (key: 'exchange' | 'sector', value: string) => {
      const currentValues = filters[key] || []
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value]
      updateFilter(key, newValues.length > 0 ? newValues : undefined)
    },
    [filters, updateFilter]
  )

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    onFiltersChange({})
  }, [onFiltersChange])

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = Object.keys(filters).some(
    key => !['sortBy', 'sortOrder', 'page', 'limit'].includes(key)
  )

  /**
   * Render descriptive filters
   * Implements Requirement 10.2
   */
  const renderDescriptiveFilters = () => (
    <div className="filter-section">
      {/* Hide zero price stocks toggle */}
      {onToggleZeroPrice && (
        <div className="filter-group">
          <label className="filter-label">数据过滤</label>
          <div className="filter-toggle-row">
            <button 
              className={`toggle-zero-price-button ${hideZeroPrice ? 'active' : ''}`}
              onClick={onToggleZeroPrice}
              title={hideZeroPrice ? '显示零价股票' : '隐藏零价股票'}
            >
              {hideZeroPrice ? '👁️ 显示零价股' : '🚫 隐藏零价股'}
            </button>
          </div>
        </div>
      )}

      {/* Exchange filter */}
      <div className="filter-group">
        <label className="filter-label">交易所</label>
        <div className="filter-chips">
          {EXCHANGES.map(exchange => (
            <button
              key={exchange}
              className={`filter-chip ${filters.exchange?.includes(exchange) ? 'active' : ''}`}
              onClick={() => toggleArrayFilter('exchange', exchange)}
            >
              {exchange}
            </button>
          ))}
        </div>
      </div>

      {/* Sector filter */}
      <div className="filter-group">
        <label className="filter-label">板块</label>
        <div className="filter-chips scrollable">
          {SECTORS.map(sector => (
            <button
              key={sector}
              className={`filter-chip ${filters.sector?.includes(sector) ? 'active' : ''}`}
              onClick={() => toggleArrayFilter('sector', sector)}
            >
              {sector}
            </button>
          ))}
        </div>
      </div>

      {/* Market Cap filter */}
      <div className="filter-group">
        <label className="filter-label">市值范围</label>
        <div className="filter-chips">
          {MARKET_CAP_RANGES.map(range => {
            const isActive =
              filters.marketCapMin === range.min &&
              (range.max === undefined
                ? filters.marketCapMax === undefined
                : filters.marketCapMax === range.max)
            return (
              <button
                key={range.label}
                className={`filter-chip ${isActive ? 'active' : ''}`}
                onClick={() => {
                  if (isActive) {
                    updateFilter('marketCapMin', undefined)
                    updateFilter('marketCapMax', undefined)
                  } else {
                    updateFilter('marketCapMin', range.min)
                    updateFilter('marketCapMax', range.max)
                  }
                }}
              >
                {range.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

  /**
   * Render fundamental filters
   * Implements Requirement 10.3
   */
  const renderFundamentalFilters = () => (
    <div className="filter-section">
      {/* P/E Ratio */}
      <div className="filter-group">
        <label className="filter-label">市盈率 (P/E)</label>
        <div className="filter-range">
          <input
            type="number"
            placeholder="最小"
            value={filters.peMin ?? ''}
            onChange={e =>
              updateFilter('peMin', e.target.value ? Number(e.target.value) : undefined)
            }
            className="filter-input"
          />
          <span className="range-separator">-</span>
          <input
            type="number"
            placeholder="最大"
            value={filters.peMax ?? ''}
            onChange={e =>
              updateFilter('peMax', e.target.value ? Number(e.target.value) : undefined)
            }
            className="filter-input"
          />
        </div>
      </div>

      {/* EPS Growth */}
      <div className="filter-group">
        <label className="filter-label">EPS 增长率 (%)</label>
        <div className="filter-single">
          <input
            type="number"
            placeholder="最小增长率"
            value={filters.epsGrowthMin ?? ''}
            onChange={e =>
              updateFilter('epsGrowthMin', e.target.value ? Number(e.target.value) : undefined)
            }
            className="filter-input"
          />
          <span className="input-suffix">% 以上</span>
        </div>
      </div>

      {/* Dividend Yield */}
      <div className="filter-group">
        <label className="filter-label">股息率 (%)</label>
        <div className="filter-single">
          <input
            type="number"
            placeholder="最小股息率"
            value={filters.dividendYieldMin ?? ''}
            onChange={e =>
              updateFilter('dividendYieldMin', e.target.value ? Number(e.target.value) : undefined)
            }
            className="filter-input"
            step="0.1"
          />
          <span className="input-suffix">% 以上</span>
        </div>
      </div>

      {/* Debt to Equity */}
      <div className="filter-group">
        <label className="filter-label">负债权益比</label>
        <div className="filter-single">
          <input
            type="number"
            placeholder="最大比率"
            value={filters.debtToEquityMax ?? ''}
            onChange={e =>
              updateFilter('debtToEquityMax', e.target.value ? Number(e.target.value) : undefined)
            }
            className="filter-input"
            step="0.1"
          />
          <span className="input-suffix">以下</span>
        </div>
      </div>

      {/* ROE */}
      <div className="filter-group">
        <label className="filter-label">净资产收益率 (ROE %)</label>
        <div className="filter-single">
          <input
            type="number"
            placeholder="最小 ROE"
            value={filters.roeMin ?? ''}
            onChange={e =>
              updateFilter('roeMin', e.target.value ? Number(e.target.value) : undefined)
            }
            className="filter-input"
            step="0.1"
          />
          <span className="input-suffix">% 以上</span>
        </div>
      </div>
    </div>
  )

  /**
   * Render technical filters
   * Implements Requirement 10.4
   */
  const renderTechnicalFilters = () => (
    <div className="filter-section">
      {/* RSI */}
      <div className="filter-group">
        <label className="filter-label">RSI (14日)</label>
        <div className="filter-range">
          <input
            type="number"
            placeholder="最小"
            value={filters.rsiMin ?? ''}
            onChange={e =>
              updateFilter('rsiMin', e.target.value ? Number(e.target.value) : undefined)
            }
            className="filter-input"
            min="0"
            max="100"
          />
          <span className="range-separator">-</span>
          <input
            type="number"
            placeholder="最大"
            value={filters.rsiMax ?? ''}
            onChange={e =>
              updateFilter('rsiMax', e.target.value ? Number(e.target.value) : undefined)
            }
            className="filter-input"
            min="0"
            max="100"
          />
        </div>
        <div className="filter-hint">超卖: &lt;30, 超买: &gt;70</div>
      </div>

      {/* SMA Filters */}
      <div className="filter-group">
        <label className="filter-label">移动平均线</label>
        <div className="filter-checkboxes">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={filters.priceAboveSma20 === true}
              onChange={e => updateFilter('priceAboveSma20', e.target.checked ? true : undefined)}
            />
            <span>价格高于 SMA20</span>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={filters.priceAboveSma50 === true}
              onChange={e => updateFilter('priceAboveSma50', e.target.checked ? true : undefined)}
            />
            <span>价格高于 SMA50</span>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={filters.priceAboveSma200 === true}
              onChange={e => updateFilter('priceAboveSma200', e.target.checked ? true : undefined)}
            />
            <span>价格高于 SMA200</span>
          </label>
        </div>
      </div>

      {/* Volume */}
      <div className="filter-group">
        <label className="filter-label">成交量</label>
        <div className="filter-checkboxes">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={filters.volumeAboveAvg === true}
              onChange={e => updateFilter('volumeAboveAvg', e.target.checked ? true : undefined)}
            />
            <span>成交量高于平均</span>
          </label>
        </div>
      </div>
    </div>
  )

  return (
    <div className="filter-panel">
      <div className="filter-panel-header">
        <h3>筛选条件</h3>
        {hasActiveFilters && (
          <button className="clear-filters-btn" onClick={clearFilters}>
            清除全部
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div className="filter-categories">
        <button
          className={`category-tab ${activeCategory === 'descriptive' ? 'active' : ''}`}
          onClick={() => setActiveCategory('descriptive')}
        >
          描述性
        </button>
        <button
          className={`category-tab ${activeCategory === 'fundamental' ? 'active' : ''}`}
          onClick={() => setActiveCategory('fundamental')}
        >
          基本面
        </button>
        <button
          className={`category-tab ${activeCategory === 'technical' ? 'active' : ''}`}
          onClick={() => setActiveCategory('technical')}
        >
          技术面
        </button>
      </div>

      {/* Filter content */}
      <div className="filter-content">
        {activeCategory === 'descriptive' && renderDescriptiveFilters()}
        {activeCategory === 'fundamental' && renderFundamentalFilters()}
        {activeCategory === 'technical' && renderTechnicalFilters()}
      </div>

      {/* Apply button */}
      <div className="filter-actions">
        <button className="apply-filters-btn" onClick={onApply} disabled={loading}>
          {loading ? '筛选中...' : '应用筛选'}
        </button>
      </div>
    </div>
  )
}
