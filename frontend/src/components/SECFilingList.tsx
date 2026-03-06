import { useState, useEffect } from 'react'
import {
  secFilingApi,
  type SECFiling,
  type SECFormType,
  type SECFilingFilters,
} from '../services/secFilingApi'
import './SECFilingList.css'

interface SECFilingListProps {
  symbol: string
  onError?: (error: Error) => void
}

/**
 * SECFilingList Component
 * Displays SEC filings for a stock with filtering capabilities
 * 
 * Implements Requirements:
 * - 20.1: WHEN 用户查看股票详情 THEN News_Aggregator SHALL 显示最近的 SEC 文件列表
 * - 20.3: WHEN 用户点击 SEC 文件 THEN News_Aggregator SHALL 提供文件摘要和原文链接
 * - 20.5: WHEN 用户筛选 SEC 文件 THEN News_Aggregator SHALL 支持按文件类型和日期范围筛选
 */
export function SECFilingList({ symbol, onError }: SECFilingListProps) {
  const [filings, setFilings] = useState<SECFiling[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SECFilingFilters>({})
  const [selectedFormTypes, setSelectedFormTypes] = useState<SECFormType[]>([])
  const [expandedFiling, setExpandedFiling] = useState<string | null>(null)
  const [generatingSummary, setGeneratingSummary] = useState<string | null>(null)

  // Available form types for filtering
  const formTypes: SECFormType[] = ['10-K', '10-Q', '8-K', '4', 'S-1', 'DEF 14A', '13F', 'SC 13G', 'SC 13D', 'Other']

  useEffect(() => {
    if (symbol) {
      fetchFilings()
    }
  }, [symbol, filters])

  const fetchFilings = async () => {
    try {
      setLoading(true)
      setError(null)

      const hasFilters = selectedFormTypes.length > 0 || filters.startDate || filters.endDate

      let data: SECFiling[]
      if (hasFilters) {
        const result = await secFilingApi.getFilingsWithFilter(symbol, {
          ...filters,
          formTypes: selectedFormTypes.length > 0 ? selectedFormTypes : undefined,
        })
        data = result.filings
      } else {
        data = await secFilingApi.getFilingsBySymbol(symbol)
      }

      setFilings(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取SEC文件失败'
      setError(errorMessage)
      onError?.(err instanceof Error ? err : new Error(errorMessage))
    } finally {
      setLoading(false)
    }
  }

  const handleFormTypeToggle = (formType: SECFormType) => {
    setSelectedFormTypes(prev => {
      if (prev.includes(formType)) {
        return prev.filter(t => t !== formType)
      } else {
        return [...prev, formType]
      }
    })
  }

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value || undefined,
    }))
  }

  const clearFilters = () => {
    setSelectedFormTypes([])
    setFilters({})
  }

  const handleGenerateSummary = async (filingId: string) => {
    try {
      setGeneratingSummary(filingId)
      const summary = await secFilingApi.generateAISummary(filingId)
      
      // Update the filing with the new summary
      setFilings(prev => prev.map(f => 
        f.id === filingId ? { ...f, summary: summary.summary } : f
      ))
    } catch (err) {
      console.error('Failed to generate summary:', err)
    } finally {
      setGeneratingSummary(null)
    }
  }

  const openFilingUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return (
      <div className="sec-filing-list loading">
        <div className="loading-spinner" />
        <span>加载SEC文件...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="sec-filing-list error">
        <span className="error-icon">⚠️</span>
        <span className="error-message">{error}</span>
        <button className="retry-btn" onClick={fetchFilings}>
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="sec-filing-list">
      {/* Header */}
      <div className="sec-list-header">
        <div className="header-left">
          <h3 className="list-title">SEC文件</h3>
          <span className="filing-count">{filings.length} 个文件</span>
        </div>
        <button
          className={`filter-toggle ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <span className="filter-icon">🔍</span>
          筛选
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filter-section">
            <label className="filter-label">文件类型</label>
            <div className="form-type-chips">
              {formTypes.map(type => (
                <button
                  key={type}
                  className={`form-type-chip ${selectedFormTypes.includes(type) ? 'selected' : ''}`}
                  onClick={() => handleFormTypeToggle(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-section date-filters">
            <div className="date-input-group">
              <label className="filter-label">开始日期</label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => handleDateChange('startDate', e.target.value)}
                className="date-input"
              />
            </div>
            <div className="date-input-group">
              <label className="filter-label">结束日期</label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => handleDateChange('endDate', e.target.value)}
                className="date-input"
              />
            </div>
          </div>
          <div className="filter-actions">
            <button className="apply-btn" onClick={fetchFilings}>
              应用筛选
            </button>
            <button className="clear-btn" onClick={clearFilters}>
              清除
            </button>
          </div>
        </div>
      )}

      {/* Filings List */}
      {filings.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📄</span>
          <span className="empty-message">暂无SEC文件</span>
        </div>
      ) : (
        <div className="filings-list">
          {filings.map(filing => (
            <div
              key={filing.id}
              className={`filing-item ${expandedFiling === filing.id ? 'expanded' : ''}`}
            >
              <div
                className="filing-header"
                onClick={() => setExpandedFiling(expandedFiling === filing.id ? null : filing.id)}
              >
                <div className="filing-info">
                  <span className={`form-type-badge ${secFilingApi.getFormTypeBadgeClass(filing.formType)}`}>
                    {filing.formType}
                  </span>
                  <span className="filing-date">
                    {secFilingApi.formatDate(filing.filedAt)}
                  </span>
                </div>
                <div className="filing-actions">
                  <button
                    className="view-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      openFilingUrl(filing.url)
                    }}
                    title="查看原文"
                  >
                    📎
                  </button>
                  <span className="expand-icon">
                    {expandedFiling === filing.id ? '▼' : '▶'}
                  </span>
                </div>
              </div>

              {expandedFiling === filing.id && (
                <div className="filing-details">
                  <div className="detail-row">
                    <span className="detail-label">文件类型:</span>
                    <span className="detail-value">
                      {secFilingApi.formatFormType(filing.formType)}
                    </span>
                  </div>
                  {filing.periodOfReport && (
                    <div className="detail-row">
                      <span className="detail-label">报告期间:</span>
                      <span className="detail-value">
                        {secFilingApi.formatDate(filing.periodOfReport)}
                      </span>
                    </div>
                  )}
                  <div className="detail-row">
                    <span className="detail-label">提交日期:</span>
                    <span className="detail-value">
                      {secFilingApi.formatDate(filing.filedAt)}
                    </span>
                  </div>

                  {/* Summary Section */}
                  <div className="summary-section">
                    <div className="summary-header">
                      <span className="summary-label">摘要</span>
                      {!filing.summary && (
                        <button
                          className="generate-summary-btn"
                          onClick={() => handleGenerateSummary(filing.id)}
                          disabled={generatingSummary === filing.id}
                        >
                          {generatingSummary === filing.id ? '生成中...' : '🤖 AI生成摘要'}
                        </button>
                      )}
                    </div>
                    {filing.summary ? (
                      <p className="summary-text">{filing.summary}</p>
                    ) : (
                      <p className="no-summary">暂无摘要，点击上方按钮生成AI摘要</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="filing-action-buttons">
                    <button
                      className="primary-btn"
                      onClick={() => openFilingUrl(filing.url)}
                    >
                      查看原文 →
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SECFilingList
