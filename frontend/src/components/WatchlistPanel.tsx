import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { watchlistApi, type WatchlistItemWithQuote } from '../services/watchlistApi'
import './WatchlistPanel.css'

interface WatchlistPanelProps {
  className?: string
}

export const WatchlistPanel = ({ className = '' }: WatchlistPanelProps) => {
  const navigate = useNavigate()
  const [watchlist, setWatchlist] = useState<WatchlistItemWithQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Load watchlist on mount
  useEffect(() => {
    loadWatchlist()
  }, [])

  // Filter watchlist based on search query
  const filteredWatchlist = useMemo(() => {
    if (!searchQuery.trim()) {
      return watchlist
    }
    const query = searchQuery.toLowerCase().trim()
    return watchlist.filter(item => 
      item.symbol.toLowerCase().includes(query) ||
      (item.stock?.name && item.stock.name.toLowerCase().includes(query))
    )
  }, [watchlist, searchQuery])

  const loadWatchlist = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await watchlistApi.getWatchlist()
      setWatchlist(data)
    } catch (err) {
      setError('加载自选股失败')
      console.error('Failed to load watchlist:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveStock = async (symbol: string) => {
    try {
      setError(null)
      await watchlistApi.removeStock(symbol)
      await loadWatchlist()
    } catch (err) {
      setError('移除股票失败')
      console.error('Failed to remove stock:', err)
    }
  }

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) {
      return
    }

    // When searching, don't allow reordering
    if (searchQuery.trim()) {
      return
    }

    const items = Array.from(watchlist)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    // Optimistically update UI
    setWatchlist(items)

    try {
      // Send new order to backend
      const symbols = items.map(item => item.symbol)
      await watchlistApi.reorderStocks(symbols)
    } catch (err) {
      setError('更新排序失败')
      console.error('Failed to reorder stocks:', err)
      // Reload to restore correct order
      await loadWatchlist()
    }
  }

  const formatChange = (change: number, changePercent: number) => {
    const sign = change >= 0 ? '+' : ''
    return `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`
  }

  const handleStockClick = (symbol: string, e: React.MouseEvent) => {
    // Prevent navigation when clicking remove button or during drag
    if ((e.target as HTMLElement).closest('.remove-button')) {
      return
    }
    navigate(`/stock/${symbol}`)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
  }

  if (loading) {
    return (
      <div className={`watchlist-panel ${className}`}>
        <div className="watchlist-loading">加载中...</div>
      </div>
    )
  }

  return (
    <div className={`watchlist-panel ${className}`}>
      <div className="watchlist-header">
        <h2>自选股</h2>
        <span className="watchlist-count">{watchlist.length} 只</span>
      </div>

      {/* Search box for filtering watchlist */}
      <div className="watchlist-search">
        <input
          type="text"
          className="watchlist-search-input"
          placeholder="搜索自选股..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="search-clear-btn" onClick={handleClearSearch} title="清除搜索">
            ×
          </button>
        )}
      </div>

      {error && (
        <div className="watchlist-error">
          {error}
          <button onClick={() => setError(null)} className="error-close">
            ×
          </button>
        </div>
      )}

      {watchlist.length === 0 ? (
        <div className="watchlist-empty">
          <p>您还没有添加自选股</p>
          <p className="empty-hint">在股票详情页点击"加入自选"添加股票</p>
        </div>
      ) : filteredWatchlist.length === 0 ? (
        <div className="watchlist-empty">
          <p>未找到匹配的自选股</p>
          <p className="empty-hint">尝试其他关键词</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="watchlist">
            {(provided, snapshot) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className={`watchlist-items ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
              >
                {filteredWatchlist.map((item, index) => (
                  <Draggable 
                    key={item.symbol} 
                    draggableId={item.symbol} 
                    index={index}
                    isDragDisabled={!!searchQuery.trim()}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`watchlist-item ${snapshot.isDragging ? 'dragging' : ''}`}
                        onClick={(e) => handleStockClick(item.symbol, e)}
                        style={{ cursor: 'pointer', ...provided.draggableProps.style }}
                      >
                        {!searchQuery.trim() && <div className="drag-handle">⋮⋮</div>}
                        <div className="stock-info">
                          <div className="stock-header">
                            <span className="stock-symbol">{item.symbol}</span>
                            {item.stock && <span className="stock-name">{item.stock.name}</span>}
                          </div>
                          {item.stock && item.stock.price !== undefined && (
                            <div className="stock-quote">
                              <span className="stock-price">${item.stock.price.toFixed(2)}</span>
                              <span
                                className={`stock-change ${(item.stock.change ?? 0) >= 0 ? 'positive' : 'negative'}`}
                              >
                                {formatChange(item.stock.change ?? 0, item.stock.changePercent ?? 0)}
                              </span>
                            </div>
                          )}
                        </div>
                        <button
                          className="remove-button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveStock(item.symbol)
                          }}
                          title="移除"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  )
}
