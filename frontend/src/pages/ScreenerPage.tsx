import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { FilterPanel } from '../components/FilterPanel'
import { ScreenerResults } from '../components/ScreenerResults'
import {
  screenerApi,
  type ScreenerFilters,
  type ScreenerResultItem,
  type ScreenerTemplate,
} from '../services/screenerApi'
import './ScreenerPage.css'

/**
 * ScreenerPage Component
 * Main page for stock screening functionality
 *
 * Implements Requirements:
 * - 10.1: Display descriptive, fundamental, and technical filter categories
 * - 10.5: Real-time display of filtered results
 * - 10.6: Save/load template functionality
 * - 10.8: Table or card view for results
 */
const ScreenerPage = () => {
  const { isAuthenticated } = useAuthStore()

  // Filter state
  const [filters, setFilters] = useState<ScreenerFilters>({})
  
  // Hide zero price stocks state
  const [hideZeroPrice, setHideZeroPrice] = useState(true)
  
  // Max change percent filter state (default 100%)
  const [maxChangePercent, setMaxChangePercent] = useState<number | undefined>(100)
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // Results state
  const [results, setResults] = useState<ScreenerResultItem[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Template state
  const [templates, setTemplates] = useState<ScreenerTemplate[]>([])
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [showTemplateList, setShowTemplateList] = useState(false)

  /**
   * Execute screening with current filters
   */
  const executeScreen = useCallback(async (
    screenFilters: ScreenerFilters, 
    hideZeroPriceStocks: boolean = true, 
    search: string = '',
    maxChangePct?: number
  ) => {
    try {
      setLoading(true)
      setError(null)
      
      // Pass hideZeroPrice, search, and maxChangePercent to backend API for server-side filtering
      const filtersWithOptions = {
        ...screenFilters,
        hideZeroPrice: hideZeroPriceStocks,
        search: search.trim() || undefined,
        maxChangePercent: maxChangePct,
      }
      
      const result = await screenerApi.screen(filtersWithOptions)
      
      setResults(result.stocks)
      setPagination(result.pagination)
    } catch (err) {
      console.error('Screening failed:', err)
      setError('筛选失败，请稍后重试')
      setResults([])
      setPagination({ page: 1, limit: 50, total: 0, totalPages: 0 })
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Handle apply filters button click
   */
  const handleApplyFilters = useCallback(() => {
    const screenFilters = { ...filters, page: 1 }
    setFilters(screenFilters)
    executeScreen(screenFilters, hideZeroPrice, searchQuery, maxChangePercent)
  }, [filters, executeScreen, hideZeroPrice, searchQuery, maxChangePercent])

  /**
   * Handle toggle zero price stocks
   */
  const handleToggleZeroPrice = useCallback(() => {
    const newHideZeroPrice = !hideZeroPrice
    setHideZeroPrice(newHideZeroPrice)
    executeScreen(filters, newHideZeroPrice, searchQuery, maxChangePercent)
  }, [hideZeroPrice, filters, executeScreen, searchQuery, maxChangePercent])

  /**
   * Handle max change percent change
   */
  const handleMaxChangePercentChange = useCallback((value: number | undefined) => {
    setMaxChangePercent(value)
    executeScreen(filters, hideZeroPrice, searchQuery, value)
  }, [filters, executeScreen, hideZeroPrice, searchQuery])

  /**
   * Handle search
   */
  const handleSearch = useCallback(() => {
    const screenFilters = { ...filters, page: 1 }
    setFilters(screenFilters)
    executeScreen(screenFilters, hideZeroPrice, searchQuery, maxChangePercent)
  }, [filters, executeScreen, hideZeroPrice, searchQuery, maxChangePercent])

  /**
   * Handle search input key press
   */
  const handleSearchKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }, [handleSearch])

  /**
   * Handle page change
   */
  const handlePageChange = useCallback(
    (page: number) => {
      const newFilters = { ...filters, page }
      setFilters(newFilters)
      executeScreen(newFilters, hideZeroPrice, searchQuery, maxChangePercent)
    },
    [filters, executeScreen, hideZeroPrice, searchQuery, maxChangePercent]
  )

  /**
   * Handle sort change
   */
  const handleSortChange = useCallback(
    (sortBy: string, sortOrder: 'asc' | 'desc') => {
      const newFilters = { ...filters, sortBy, sortOrder, page: 1 }
      setFilters(newFilters)
      executeScreen(newFilters, hideZeroPrice, searchQuery, maxChangePercent)
    },
    [filters, executeScreen, hideZeroPrice, searchQuery, maxChangePercent]
  )

  /**
   * Load user templates
   */
  const loadTemplates = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const userTemplates = await screenerApi.getTemplates()
      setTemplates(userTemplates)
    } catch (err) {
      console.error('Failed to load templates:', err)
    }
  }, [isAuthenticated])

  /**
   * Save current filters as template
   */
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return

    try {
      setSavingTemplate(true)
      await screenerApi.saveTemplate(
        templateName.trim(),
        filters,
        templateDescription.trim() || undefined
      )
      setShowTemplateModal(false)
      setTemplateName('')
      setTemplateDescription('')
      await loadTemplates()
    } catch (err) {
      console.error('Failed to save template:', err)
      setError('保存模板失败')
    } finally {
      setSavingTemplate(false)
    }
  }

  /**
   * Load a template
   */
  const handleLoadTemplate = (template: ScreenerTemplate) => {
    setFilters(template.filters)
    setShowTemplateList(false)
    executeScreen(template.filters, hideZeroPrice, searchQuery, maxChangePercent)
  }

  /**
   * Delete a template
   */
  const handleDeleteTemplate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定要删除此模板吗？')) return

    try {
      await screenerApi.deleteTemplate(templateId)
      await loadTemplates()
    } catch (err) {
      console.error('Failed to delete template:', err)
    }
  }

  // Load templates on mount
  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  // Initial screen on mount only
  useEffect(() => {
    executeScreen({}, true, '', 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="screener-page">
      <div className="screener-header">
        <div className="header-left">
          <Link to="/" className="back-link">
            ← 返回首页
          </Link>
          <h1>股票筛选器</h1>
          <p>使用多维度条件筛选符合您投资策略的股票</p>
        </div>
        {isAuthenticated && (
          <div className="header-actions">
            <button className="template-btn" onClick={() => setShowTemplateList(!showTemplateList)}>
              📋 我的模板 ({templates.length})
            </button>
            <button className="save-template-btn" onClick={() => setShowTemplateModal(true)}>
              💾 保存模板
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="screener-error">
          {error}
          <button onClick={() => setError(null)} className="error-close">
            ×
          </button>
        </div>
      )}

      {/* Search bar */}
      <div className="screener-search-bar">
        <div className="search-input-wrapper">
          <input
            type="text"
            className="screener-search-input"
            placeholder="搜索股票代码或名称..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyPress={handleSearchKeyPress}
          />
          <button className="search-btn" onClick={handleSearch} disabled={loading}>
            🔍 搜索
          </button>
          {searchQuery && (
            <button 
              className="clear-search-btn" 
              onClick={() => {
                setSearchQuery('')
                executeScreen(filters, hideZeroPrice, '', maxChangePercent)
              }}
              title="清除搜索"
            >
              ×
            </button>
          )}
        </div>
        <div className="search-filters-row">
          <div className="change-percent-filter">
            <label>涨跌幅限制：</label>
            <select
              value={maxChangePercent === undefined ? 'unlimited' : maxChangePercent}
              onChange={e => {
                const value = e.target.value
                handleMaxChangePercentChange(value === 'unlimited' ? undefined : Number(value))
              }}
              className="change-percent-select"
            >
              <option value="unlimited">不限制</option>
              <option value="1000">±1000% 以内</option>
              <option value="500">±500% 以内</option>
              <option value="200">±200% 以内</option>
              <option value="100">±100% 以内</option>
              <option value="50">±50% 以内</option>
            </select>
          </div>
          {searchQuery && (
            <div className="search-hint">
              当前搜索: "{searchQuery}"
            </div>
          )}
        </div>
      </div>

      {/* Template list dropdown */}
      {showTemplateList && templates.length > 0 && (
        <div className="template-list-dropdown">
          <div className="template-list-header">
            <h3>我的筛选模板</h3>
            <button onClick={() => setShowTemplateList(false)}>×</button>
          </div>
          <div className="template-list">
            {templates.map(template => (
              <div
                key={template.id}
                className="template-item"
                onClick={() => handleLoadTemplate(template)}
              >
                <div className="template-info">
                  <div className="template-name">{template.name}</div>
                  {template.description && (
                    <div className="template-description">{template.description}</div>
                  )}
                </div>
                <button
                  className="template-delete-btn"
                  onClick={e => handleDeleteTemplate(template.id, e)}
                  title="删除模板"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showTemplateList && templates.length === 0 && (
        <div className="template-list-dropdown">
          <div className="template-list-header">
            <h3>我的筛选模板</h3>
            <button onClick={() => setShowTemplateList(false)}>×</button>
          </div>
          <div className="template-empty">
            <p>您还没有保存任何模板</p>
            <p className="hint">设置筛选条件后点击"保存模板"</p>
          </div>
        </div>
      )}

      <div className="screener-content">
        <div className="screener-sidebar">
          <FilterPanel
            filters={filters}
            onFiltersChange={setFilters}
            onApply={handleApplyFilters}
            loading={loading}
            hideZeroPrice={hideZeroPrice}
            onToggleZeroPrice={handleToggleZeroPrice}
          />
        </div>
        <div className="screener-main">
          <ScreenerResults
            results={results}
            pagination={pagination}
            loading={loading}
            onPageChange={handlePageChange}
            onSortChange={handleSortChange}
            currentFilters={filters}
          />
        </div>
      </div>

      {/* Save template modal */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>保存筛选模板</h2>
              <button className="modal-close" onClick={() => setShowTemplateModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>模板名称 *</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder="例如：高股息蓝筹股"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>描述（可选）</label>
                <textarea
                  value={templateDescription}
                  onChange={e => setTemplateDescription(e.target.value)}
                  placeholder="描述此筛选模板的用途..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-cancel-btn" onClick={() => setShowTemplateModal(false)}>
                取消
              </button>
              <button
                className="modal-save-btn"
                onClick={handleSaveTemplate}
                disabled={!templateName.trim() || savingTemplate}
              >
                {savingTemplate ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guest prompt */}
      {!isAuthenticated && (
        <div className="guest-banner">
          <span>登录后可保存筛选模板</span>
          <Link to="/login" className="login-link">
            立即登录
          </Link>
        </div>
      )}
    </div>
  )
}

export default ScreenerPage
