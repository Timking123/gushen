import { useState, useEffect, useCallback } from 'react'
import type {
  TranscriptListItem,
  TranscriptWithAnalysis,
  KeyStatement,
  TranscriptSearchResult,
} from '../types'
import {
  getTranscriptsBySymbol,
  getRecentTranscripts,
  getTranscriptWithAnalysis,
  searchTranscripts,
} from '../services/transcriptApi'
import './TranscriptList.css'

/**
 * Props for TranscriptList component
 */
interface TranscriptListProps {
  symbol?: string
  showSearch?: boolean
  limit?: number
  onTranscriptSelect?: (transcript: TranscriptWithAnalysis) => void
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
 * Get event type label
 */
function getEventTypeLabel(eventType: string): string {
  const labels: Record<string, string> = {
    earnings: '财报电话会议',
    investor_day: '投资者日',
    conference: '行业会议',
  }
  return labels[eventType] || eventType
}

/**
 * Get sentiment badge class
 */
function getSentimentClass(sentiment: string): string {
  const classes: Record<string, string> = {
    positive: 'sentiment-positive',
    negative: 'sentiment-negative',
    neutral: 'sentiment-neutral',
  }
  return classes[sentiment] || 'sentiment-neutral'
}

/**
 * Get key statement type label
 */
function getStatementTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    guidance: '业绩指引',
    commitment: '承诺',
    strategy: '战略',
    risk: '风险',
    highlight: '要点',
  }
  return labels[type] || type
}

/**
 * Get importance badge class
 */
function getImportanceClass(importance: string): string {
  const classes: Record<string, string> = {
    high: 'importance-high',
    medium: 'importance-medium',
    low: 'importance-low',
  }
  return classes[importance] || 'importance-medium'
}

/**
 * TranscriptList Component
 * Displays a list of earnings call transcripts with search and detail view
 * 
 * Implements Requirements:
 * - 14.1: Display recent earnings call transcript list
 * - 14.3: Support keyword search
 * - 14.5: Provide AI-generated meeting summary
 * - 14.6: Highlight key statements from management
 */
export default function TranscriptList({
  symbol,
  showSearch = true,
  limit = 10,
  onTranscriptSelect,
}: TranscriptListProps) {
  const [transcripts, setTranscripts] = useState<TranscriptListItem[]>([])
  const [searchResults, setSearchResults] = useState<TranscriptSearchResult[]>([])
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptWithAnalysis | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'summary' | 'statements' | 'full'>('summary')

  // Load transcripts
  const loadTranscripts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = symbol
        ? await getTranscriptsBySymbol(symbol, limit)
        : await getRecentTranscripts(limit)
      setTranscripts(data)
    } catch (err) {
      setError('加载会议记录失败')
      console.error('Failed to load transcripts:', err)
    } finally {
      setLoading(false)
    }
  }, [symbol, limit])

  useEffect(() => {
    loadTranscripts()
  }, [loadTranscripts])

  // Handle search
  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      setIsSearching(false)
      setSearchResults([])
      return
    }

    setIsSearching(true)
    setError(null)
    try {
      const response = await searchTranscripts(
        searchKeyword,
        symbol ? { symbol } : undefined,
        { limit: 20 }
      )
      setSearchResults(response.results)
    } catch (err) {
      setError('搜索失败')
      console.error('Search failed:', err)
    }
  }

  // Handle transcript selection
  const handleSelectTranscript = async (transcriptId: string) => {
    setDetailLoading(true)
    setError(null)
    try {
      const data = await getTranscriptWithAnalysis(transcriptId)
      setSelectedTranscript(data)
      setActiveTab('summary')
      if (onTranscriptSelect) {
        onTranscriptSelect(data)
      }
    } catch (err) {
      setError('加载会议记录详情失败')
      console.error('Failed to load transcript detail:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  // Close detail view
  const handleCloseDetail = () => {
    setSelectedTranscript(null)
  }

  // Render key statement
  const renderKeyStatement = (statement: KeyStatement) => (
    <div key={statement.id} className={`key-statement ${getImportanceClass(statement.importance)}`}>
      <div className="statement-header">
        <span className={`statement-type type-${statement.type}`}>
          {getStatementTypeLabel(statement.type)}
        </span>
        <span className="statement-speaker">
          {statement.speaker}
          {statement.speakerTitle && <span className="speaker-title"> - {statement.speakerTitle}</span>}
        </span>
      </div>
      <div className="statement-content">
        <span className="highlighted-text">{statement.highlightedText}</span>
      </div>
      <div className="statement-full">{statement.content}</div>
    </div>
  )

  // Render transcript list item
  const renderTranscriptItem = (item: TranscriptListItem) => (
    <div
      key={item.id}
      className="transcript-item"
      onClick={() => handleSelectTranscript(item.id)}
    >
      <div className="transcript-header">
        <span className="transcript-symbol">{item.symbol}</span>
        <span className="transcript-quarter">{item.quarter}</span>
        <span className="transcript-type">{getEventTypeLabel(item.eventType)}</span>
      </div>
      <div className="transcript-meta">
        <span className="transcript-date">{formatDate(item.date)}</span>
        <span className="transcript-participants">{item.participantCount} 位参与者</span>
      </div>
      {item.aiSummary && (
        <div className="transcript-summary-preview">
          {item.aiSummary.substring(0, 150)}...
        </div>
      )}
    </div>
  )

  // Render search result item
  const renderSearchResult = (result: TranscriptSearchResult) => (
    <div
      key={result.transcript.id}
      className="search-result-item"
      onClick={() => handleSelectTranscript(result.transcript.id)}
    >
      <div className="result-header">
        <span className="result-symbol">{result.transcript.symbol}</span>
        <span className="result-quarter">{result.transcript.quarter}</span>
        <span className="result-matches">{result.matchCount} 处匹配</span>
      </div>
      <div className="result-date">{formatDate(result.transcript.date)}</div>
      {result.matchedSections.slice(0, 2).map((section, idx) => (
        <div key={idx} className="result-match">
          <span className="match-speaker">{section.speaker}:</span>
          <span
            className="match-highlight"
            dangerouslySetInnerHTML={{ __html: section.matchHighlight }}
          />
        </div>
      ))}
    </div>
  )

  return (
    <div className="transcript-list-container">
      {/* Search bar */}
      {showSearch && (
        <div className="transcript-search">
          <input
            type="text"
            placeholder="搜索会议记录内容..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} disabled={!searchKeyword.trim()}>
            搜索
          </button>
          {isSearching && (
            <button className="clear-search" onClick={() => {
              setSearchKeyword('')
              setIsSearching(false)
              setSearchResults([])
            }}>
              清除
            </button>
          )}
        </div>
      )}

      {/* Error message */}
      {error && <div className="transcript-error">{error}</div>}

      {/* Main content */}
      <div className="transcript-content">
        {/* List view */}
        {!selectedTranscript && (
          <div className="transcript-list">
            <h3>{symbol ? `${symbol} 会议记录` : '最近会议记录'}</h3>
            
            {loading ? (
              <div className="transcript-loading">加载中...</div>
            ) : isSearching ? (
              searchResults.length > 0 ? (
                <div className="search-results">
                  <div className="search-results-header">
                    找到 {searchResults.length} 条结果
                  </div>
                  {searchResults.map(renderSearchResult)}
                </div>
              ) : (
                <div className="no-results">未找到匹配的会议记录</div>
              )
            ) : transcripts.length > 0 ? (
              transcripts.map(renderTranscriptItem)
            ) : (
              <div className="no-transcripts">暂无会议记录</div>
            )}
          </div>
        )}

        {/* Detail view */}
        {selectedTranscript && (
          <div className="transcript-detail">
            <div className="detail-header">
              <button className="back-button" onClick={handleCloseDetail}>
                ← 返回列表
              </button>
              <div className="detail-title">
                <span className="detail-symbol">{selectedTranscript.symbol}</span>
                <span className="detail-name">{selectedTranscript.stockName}</span>
                <span className="detail-quarter">{selectedTranscript.quarter}</span>
              </div>
              <div className="detail-meta">
                <span>{getEventTypeLabel(selectedTranscript.eventType)}</span>
                <span>{formatDate(selectedTranscript.date)}</span>
                <span>{selectedTranscript.participants.length} 位参与者</span>
              </div>
            </div>

            {detailLoading ? (
              <div className="detail-loading">加载详情中...</div>
            ) : (
              <>
                {/* Tabs */}
                <div className="detail-tabs">
                  <button
                    className={activeTab === 'summary' ? 'active' : ''}
                    onClick={() => setActiveTab('summary')}
                  >
                    AI 摘要
                  </button>
                  <button
                    className={activeTab === 'statements' ? 'active' : ''}
                    onClick={() => setActiveTab('statements')}
                  >
                    关键陈述
                  </button>
                  <button
                    className={activeTab === 'full' ? 'active' : ''}
                    onClick={() => setActiveTab('full')}
                  >
                    完整记录
                  </button>
                </div>

                {/* Tab content */}
                <div className="detail-tab-content">
                  {/* AI Summary tab */}
                  {activeTab === 'summary' && selectedTranscript.aiAnalysis?.summary && (
                    <div className="ai-summary">
                      <div className="summary-header">
                        <span className={`sentiment-badge ${getSentimentClass(selectedTranscript.aiAnalysis.summary.sentiment)}`}>
                          {selectedTranscript.aiAnalysis.summary.sentiment === 'positive' ? '积极' :
                           selectedTranscript.aiAnalysis.summary.sentiment === 'negative' ? '消极' : '中性'}
                        </span>
                        <span className="confidence">
                          置信度: {Math.round(selectedTranscript.aiAnalysis.summary.confidence * 100)}%
                        </span>
                      </div>
                      <div className="summary-text">
                        {selectedTranscript.aiAnalysis.summary.summary}
                      </div>
                      <div className="key-points">
                        <h4>关键要点</h4>
                        <ul>
                          {selectedTranscript.aiAnalysis.summary.keyPoints.map((point, idx) => (
                            <li key={idx}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {activeTab === 'summary' && !selectedTranscript.aiAnalysis?.summary && (
                    <div className="no-summary">
                      <p>暂无 AI 摘要</p>
                      {selectedTranscript.aiSummary && (
                        <div className="fallback-summary">{selectedTranscript.aiSummary}</div>
                      )}
                    </div>
                  )}

                  {/* Key Statements tab */}
                  {activeTab === 'statements' && (
                    <div className="key-statements">
                      {selectedTranscript.aiAnalysis?.keyStatements?.length ? (
                        selectedTranscript.aiAnalysis.keyStatements.map(renderKeyStatement)
                      ) : (
                        <div className="no-statements">暂无关键陈述</div>
                      )}
                    </div>
                  )}

                  {/* Full Transcript tab */}
                  {activeTab === 'full' && (
                    <div className="full-transcript">
                      {/* Participants */}
                      <div className="participants-section">
                        <h4>参与者</h4>
                        <div className="participants-list">
                          {selectedTranscript.participants.map((p) => (
                            <div key={p.id} className="participant">
                              <span className="participant-name">{p.name}</span>
                              {p.title && <span className="participant-title">{p.title}</span>}
                              {p.company && <span className="participant-company">{p.company}</span>}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Sections */}
                      <div className="sections">
                        {selectedTranscript.sections.map((section) => (
                          <div key={section.id} className={`section section-${section.type}`}>
                            <div className="section-header">
                              <span className="section-type">
                                {section.type === 'prepared_remarks' ? '准备发言' : '问答环节'}
                              </span>
                              <span className="section-speaker">{section.speaker}</span>
                            </div>
                            <div className="section-content">{section.content}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
