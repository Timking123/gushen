import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { ECharts } from 'echarts'
import {
  heatmapApi,
  type HeatmapResponse,
  type HeatmapGroupBy,
  type HeatmapItem,
  type HeatmapFilters,
} from '../services/heatmapApi'
import {
  ZoomController,
  calculateZoomIn,
  calculateZoomOut,
  DEFAULT_ZOOM_CONFIG,
} from './ZoomController'
import { SectorFilter } from './SectorFilter'
import { HeatmapNavigation } from './HeatmapNavigation'
import './MarketHeatmap.css'

interface MarketHeatmapProps {
  className?: string
  onStockClick?: (symbol: string) => void
}

/**
 * Zoom state interface for heatmap
 * Implements Requirements 10.1-10.6
 */
interface ZoomState {
  scale: number
  translateX: number
  translateY: number
}

/**
 * Drag state interface for panning
 */
interface DragState {
  isDragging: boolean
  startX: number
  startY: number
  startTranslateX: number
  startTranslateY: number
}

/**
 * Filter state interface for heatmap
 * Implements Requirements 14.1-14.6
 */
interface FilterState {
  sectors: string[]
  industries: string[]
  hideZeroPrice: boolean  // New: Toggle to show/hide stocks with zero price
}

/**
 * Get color based on change percent
 * Implements Requirement 18.2: Show color intensity based on price change
 *
 * @param changePercent - The percentage change
 * @returns Color string for the heatmap cell
 */
const getColorByChange = (changePercent: number): string => {
  // Clamp the change percent to a reasonable range for color mapping
  const clampedChange = Math.max(-10, Math.min(10, changePercent))

  if (clampedChange >= 0) {
    // Green gradient for positive changes
    // Intensity increases with larger positive changes
    const intensity = Math.min(clampedChange / 5, 1) // Normalize to 0-1 range
    const r = Math.round(38 + (200 - 38) * (1 - intensity))
    const g = Math.round(166 + (230 - 166) * (1 - intensity))
    const b = Math.round(154 + (200 - 154) * (1 - intensity))
    return `rgb(${r}, ${g}, ${b})`
  } else {
    // Red gradient for negative changes
    // Intensity increases with larger negative changes
    const intensity = Math.min(Math.abs(clampedChange) / 5, 1)
    const r = Math.round(239 + (200 - 239) * (1 - intensity))
    const g = Math.round(83 + (200 - 83) * (1 - intensity))
    const b = Math.round(80 + (200 - 80) * (1 - intensity))
    return `rgb(${r}, ${g}, ${b})`
  }
}

/**
 * Format market cap for display
 */
const formatMarketCap = (marketCap: number): string => {
  if (marketCap >= 1_000_000_000_000) {
    return `${(marketCap / 1_000_000_000_000).toFixed(2)}T`
  }
  if (marketCap >= 1_000_000_000) {
    return `${(marketCap / 1_000_000_000).toFixed(2)}B`
  }
  if (marketCap >= 1_000_000) {
    return `${(marketCap / 1_000_000).toFixed(2)}M`
  }
  return `${marketCap.toLocaleString()}`
}

/**
 * Format change percent for display
 */
const formatChangePercent = (changePercent: number): string => {
  const sign = changePercent >= 0 ? '+' : ''
  return `${sign}${changePercent.toFixed(2)}%`
}

/**
 * Format volume for display
 * Implements Requirement 13.2: Tooltip content completeness
 */
const formatVolume = (volume: number): string => {
  if (volume >= 1_000_000_000) {
    return `${(volume / 1_000_000_000).toFixed(2)}B`
  }
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(2)}K`
  }
  return volume.toLocaleString()
}

/**
 * MarketHeatmap Component
 *
 * Displays a market heatmap visualization using ECharts treemap.
 * Shows stock performance with color-coded cells based on price changes.
 *
 * Features:
 * - Treemap visualization with nested groups
 * - Color intensity based on price change (green for gains, red for losses)
 * - Support for grouping by sector or market cap
 * - Interactive tooltips with stock details
 * - Click to navigate to stock details
 * - Responsive design
 * - Zoom and pan support
 * - Sector and industry filtering
 *
 * Implements Requirements 4.4, 18.2, 18.6, 10.1-10.6, 13.1-13.5, 14.1-14.6:
 * - 4.4: Display sector heatmap showing stock performance
 * - 18.2: Show color intensity based on price change
 * - 18.6: Support grouping by market cap, sector, etc.
 * - 10.1-10.6: Zoom and pan functionality
 * - 13.1: Display detailed stock info tooltip on hover
 * - 13.2: Tooltip contains symbol, name, price, change, marketCap, sector
 * - 14.1: Display sector/industry filter dropdown
 * - 14.2: Filter by sector
 * - 14.3: Filter by industry
 * - 14.4: Show all stocks when "All" is selected
 * - 14.5: Smooth transition when filter changes
 * - 14.6: Support multi-select sector filtering
 */
export const MarketHeatmap = ({ className = '', onStockClick }: MarketHeatmapProps) => {
  const [heatmapData, setHeatmapData] = useState<HeatmapResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<HeatmapGroupBy>('sector')

  // Available sectors and industries for filtering
  const [availableSectors, setAvailableSectors] = useState<string[]>([])
  const [availableIndustries, setAvailableIndustries] = useState<string[]>([])

  // Filter state - Implements Requirements 14.1-14.6
  const [filterState, setFilterState] = useState<FilterState>({
    sectors: [],
    industries: [],
    hideZeroPrice: true,  // Default: hide stocks with zero price
  })

  // Zoom state - Implements Requirements 10.1-10.6
  const [zoomState, setZoomState] = useState<ZoomState>({
    scale: DEFAULT_ZOOM_CONFIG.defaultScale,
    translateX: 0,
    translateY: 0,
  })

  // Drag state for panning - Implements Requirement 10.5
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startTranslateX: 0,
    startTranslateY: 0,
  })
  
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ECharts | null>(null)
  
  // Ref for wheel event handler to use with addEventListener
  const wheelHandlerRef = useRef<((e: WheelEvent) => void) | null>(null)

  /**
   * Handle window resize - Implements Requirement 13.5
   * Resize chart when window size changes for responsive layout
   */
  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current) {
        // Use requestAnimationFrame for smooth resize
        requestAnimationFrame(() => {
          chartRef.current?.resize()
        })
      }
    }

    // Add resize listener
    window.addEventListener('resize', handleResize)

    // Also handle orientation change for mobile devices
    window.addEventListener('orientationchange', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [])

  /**
   * Handle container resize using ResizeObserver - Implements Requirement 13.5
   * This handles cases where the container size changes without window resize
   */
  useEffect(() => {
    if (!chartContainerRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === chartContainerRef.current && chartRef.current) {
          // Debounce resize calls
          requestAnimationFrame(() => {
            chartRef.current?.resize()
          })
        }
      }
    })

    resizeObserver.observe(chartContainerRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  /**
   * Load available sectors and industries for filtering
   * Implements Requirement 14.1
   */
  const loadFilterOptions = useCallback(async () => {
    try {
      const [sectors, industries] = await Promise.all([
        heatmapApi.getAvailableSectors(),
        heatmapApi.getAvailableIndustries(),
      ])
      setAvailableSectors(sectors)
      setAvailableIndustries(industries.map(i => i.name))
    } catch (err) {
      console.error('Failed to load filter options:', err)
    }
  }, [])

  // Load filter options on mount
  useEffect(() => {
    loadFilterOptions()
  }, [loadFilterOptions])

  /**
   * Load heatmap data from API with filters
   * Implements Requirements 14.2, 14.3, 14.4, 14.6
   */
  const loadHeatmapData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Build filters object
      const filters: HeatmapFilters = {
        hideZeroPrice: filterState.hideZeroPrice,
      }
      if (filterState.sectors.length > 0) {
        filters.sectors = filterState.sectors
      }
      if (filterState.industries.length > 0) {
        filters.industries = filterState.industries
      }
      
      const data = await heatmapApi.getHeatmapData(groupBy, 50, filters)
      setHeatmapData(data)
    } catch (err) {
      console.error('Failed to load heatmap data:', err)
      setError('加载热力图数据失败')
    } finally {
      setLoading(false)
    }
  }, [groupBy, filterState])

  // Load data on mount and when groupBy changes
  useEffect(() => {
    loadHeatmapData()
  }, [loadHeatmapData])

  /**
   * Handle group by change
   * Implements Requirement 18.6: Support grouping by market cap, sector, etc.
   */
  const handleGroupByChange = (newGroupBy: HeatmapGroupBy) => {
    setGroupBy(newGroupBy)
  }

  /**
   * Handle sector filter change
   * Implements Requirements 14.2, 14.4, 14.5, 14.6
   */
  const handleSectorChange = useCallback((sectors: string[]) => {
    setFilterState(prev => ({
      ...prev,
      sectors,
    }))
  }, [])

  /**
   * Handle industry filter change
   * Implements Requirements 14.3, 14.4, 14.5
   */
  const handleIndustryChange = useCallback((industries: string[]) => {
    setFilterState(prev => ({
      ...prev,
      industries,
    }))
  }, [])

  /**
   * Toggle visibility of stocks with zero price
   */
  const handleToggleZeroPrice = useCallback(() => {
    setFilterState(prev => ({
      ...prev,
      hideZeroPrice: !prev.hideZeroPrice,
    }))
  }, [])

  /**
   * Handle stock click
   * Implements Requirement 18.3: Click to navigate to stock details
   */
  const handleChartClick = useCallback(
    (params: { data?: { symbol?: string } }) => {
      if (params.data?.symbol && onStockClick) {
        onStockClick(params.data.symbol)
      }
    },
    [onStockClick]
  )

  /**
   * Handle zoom in
   * Implements Requirement 10.2: Zoom in increases the display scale
   */
  const handleZoomIn = useCallback(() => {
    setZoomState(prev => ({
      ...prev,
      scale: calculateZoomIn(prev.scale, DEFAULT_ZOOM_CONFIG.step, DEFAULT_ZOOM_CONFIG.maxScale),
    }))
  }, [])

  /**
   * Handle zoom out
   * Implements Requirement 10.3: Zoom out decreases the display scale
   */
  const handleZoomOut = useCallback(() => {
    setZoomState(prev => ({
      ...prev,
      scale: calculateZoomOut(prev.scale, DEFAULT_ZOOM_CONFIG.step, DEFAULT_ZOOM_CONFIG.minScale),
    }))
  }, [])

  /**
   * Handle zoom reset
   * Implements Requirement 10.6: Reset to default zoom level
   */
  const handleZoomReset = useCallback(() => {
    setZoomState({
      scale: DEFAULT_ZOOM_CONFIG.defaultScale,
      translateX: 0,
      translateY: 0,
    })
  }, [])

  /**
   * Handle mouse wheel zoom using native event listener with passive: false
   * Implements Requirement 10.4: Support scroll wheel zoom
   * Uses useEffect to add non-passive event listener to avoid "Unable to preventDefault inside passive event listener" warning
   */
  useEffect(() => {
    const container = chartContainerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      
      const delta = e.deltaY > 0 ? -1 : 1
      
      setZoomState(prev => {
        const newScale = delta > 0
          ? calculateZoomIn(prev.scale, DEFAULT_ZOOM_CONFIG.step, DEFAULT_ZOOM_CONFIG.maxScale)
          : calculateZoomOut(prev.scale, DEFAULT_ZOOM_CONFIG.step, DEFAULT_ZOOM_CONFIG.minScale)
        
        return {
          ...prev,
          scale: newScale,
        }
      })
    }

    wheelHandlerRef.current = handleWheel
    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [])

  /**
   * Handle mouse down for drag start
   * Implements Requirement 10.5: Support drag to pan when zoomed
   */
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only enable dragging when zoomed in
    if (zoomState.scale <= DEFAULT_ZOOM_CONFIG.defaultScale) return
    
    e.preventDefault()
    setDragState({
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startTranslateX: zoomState.translateX,
      startTranslateY: zoomState.translateY,
    })
  }, [zoomState.scale, zoomState.translateX, zoomState.translateY])

  /**
   * Handle mouse move for dragging
   * Implements Requirement 10.5: Support drag to pan when zoomed
   */
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragState.isDragging) return
    
    e.preventDefault()
    const deltaX = e.clientX - dragState.startX
    const deltaY = e.clientY - dragState.startY
    
    setZoomState(prev => ({
      ...prev,
      translateX: dragState.startTranslateX + deltaX,
      translateY: dragState.startTranslateY + deltaY,
    }))
  }, [dragState])

  /**
   * Handle mouse up to end dragging
   */
  const handleMouseUp = useCallback(() => {
    setDragState(prev => ({
      ...prev,
      isDragging: false,
    }))
  }, [])

  /**
   * Handle mouse leave to end dragging
   */
  const handleMouseLeave = useCallback(() => {
    if (dragState.isDragging) {
      setDragState(prev => ({
        ...prev,
        isDragging: false,
      }))
    }
  }, [dragState.isDragging])

  /**
   * Handle double click to reset zoom
   * Implements Requirement 10.6: Double-click resets to default zoom level
   */
  const handleDoubleClick = useCallback(() => {
    handleZoomReset()
  }, [handleZoomReset])

  /**
   * Convert heatmap data to ECharts treemap format
   */
  const chartData = useMemo(() => {
    if (!heatmapData) return []

    return heatmapData.groups.map(group => ({
      name: group.name,
      value: group.totalMarketCap,
      avgChangePercent: group.avgChangePercent,
      stockCount: group.stockCount,
      itemStyle: {
        borderColor: '#fff',
        borderWidth: 2,
        gapWidth: 2,
      },
      children: group.items.map((item: HeatmapItem) => ({
        name: item.symbol,
        value: item.marketCap,
        symbol: item.symbol,
        stockName: item.name,
        price: item.price,
        change: item.change,
        changePercent: item.changePercent,
        sector: item.sector,
        industry: item.industry,
        volume: item.volume,
        itemStyle: {
          color: getColorByChange(item.changePercent),
          borderColor: '#fff',
          borderWidth: 1,
        },
      })),
    }))
  }, [heatmapData])

  /**
   * ECharts option configuration
   * Implements Requirements 13.1, 13.2: Tooltip with complete stock information
   */
  const chartOption: EChartsOption = useMemo(
    () => ({
      tooltip: {
        show: true,
        trigger: 'item',
        confine: true,
        enterable: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) => {
          const data = params.data
          if (!data) return ''

          // Check if this is a group (has children) or a stock item
          if (data.children) {
            // Group tooltip
            return `
              <div class="heatmap-tooltip heatmap-tooltip-group">
                <div class="tooltip-title">${data.name}</div>
                <div class="tooltip-row">
                  <span class="tooltip-label">股票数量:</span>
                  <span class="tooltip-value">${data.stockCount}</span>
                </div>
                <div class="tooltip-row">
                  <span class="tooltip-label">总市值:</span>
                  <span class="tooltip-value">${formatMarketCap(data.value || 0)}</span>
                </div>
                <div class="tooltip-row">
                  <span class="tooltip-label">平均涨跌:</span>
                  <span class="tooltip-value ${(data.avgChangePercent || 0) >= 0 ? 'positive' : 'negative'}">
                    ${formatChangePercent(data.avgChangePercent || 0)}
                  </span>
                </div>
              </div>
            `
          }

          /**
           * Stock item tooltip - Implements Requirement 13.2
           * Required fields: 股票代码、名称、价格、涨跌幅、市值、板块
           */
          return `
            <div class="heatmap-tooltip heatmap-tooltip-stock">
              <div class="tooltip-header">
                <span class="tooltip-symbol">${data.name}</span>
                <span class="tooltip-name">${data.stockName || '暂无名称'}</span>
              </div>
              <div class="tooltip-body">
                <div class="tooltip-row">
                  <span class="tooltip-label">价格:</span>
                  <span class="tooltip-value">$${(data.price || 0).toFixed(2)}</span>
                </div>
                <div class="tooltip-row">
                  <span class="tooltip-label">涨跌:</span>
                  <span class="tooltip-value ${(data.changePercent || 0) >= 0 ? 'positive' : 'negative'}">
                    ${(data.change || 0) >= 0 ? '+' : ''}${(data.change || 0).toFixed(2)} (${formatChangePercent(data.changePercent || 0)})
                  </span>
                </div>
                <div class="tooltip-row">
                  <span class="tooltip-label">市值:</span>
                  <span class="tooltip-value">${formatMarketCap(data.value || 0)}</span>
                </div>
                <div class="tooltip-row">
                  <span class="tooltip-label">板块:</span>
                  <span class="tooltip-value">${data.sector || '暂无数据'}</span>
                </div>
                ${
                  data.industry
                    ? `
                  <div class="tooltip-row">
                    <span class="tooltip-label">行业:</span>
                    <span class="tooltip-value">${data.industry}</span>
                  </div>
                `
                    : ''
                }
                ${
                  data.volume
                    ? `
                  <div class="tooltip-row">
                    <span class="tooltip-label">成交量:</span>
                    <span class="tooltip-value">${formatVolume(data.volume)}</span>
                  </div>
                `
                    : ''
                }
              </div>
              <div class="tooltip-footer">
                <span class="tooltip-hint">点击查看详情</span>
              </div>
            </div>
          `
        },
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#e0e0e0',
        borderWidth: 1,
        borderRadius: 8,
        padding: 0,
        textStyle: {
          color: '#333',
          fontSize: 13,
        },
        extraCssText: 'box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12); max-width: 280px;',
      },
      series: [
        {
          type: 'treemap',
          data: chartData,
          width: '100%',
          height: '100%',
          roam: false,
          nodeClick: 'link',
          breadcrumb: {
            show: true,
            height: 28,
            itemStyle: {
              color: '#f5f5f5',
              borderColor: '#e8e8e8',
              borderWidth: 1,
              shadowBlur: 0,
              textStyle: {
                color: '#333',
                fontSize: 12,
              },
            },
            emphasis: {
              itemStyle: {
                color: '#e6f7ff',
              },
            },
          },
          label: {
            show: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter: (params: any) => {
              const data = params.data
              if (!data) return ''

              // For group labels, show name only
              if (!data.changePercent && data.changePercent !== 0) {
                return data.name || ''
              }

              // For stock labels, show symbol and change percent
              return `${data.name}\n${formatChangePercent(data.changePercent)}`
            },
            fontSize: 11,
            color: '#fff',
            textShadowColor: 'rgba(0, 0, 0, 0.5)',
            textShadowBlur: 2,
            textShadowOffsetX: 1,
            textShadowOffsetY: 1,
          },
          upperLabel: {
            show: true,
            height: 24,
            color: '#333',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderColor: '#e8e8e8',
            borderWidth: 1,
            padding: [4, 8],
            fontSize: 12,
            fontWeight: 'bold',
          },
          levels: [
            {
              itemStyle: {
                borderColor: '#fff',
                borderWidth: 3,
                gapWidth: 3,
              },
              upperLabel: {
                show: true,
              },
            },
            {
              itemStyle: {
                borderColor: '#fff',
                borderWidth: 1,
                gapWidth: 1,
              },
              label: {
                show: true,
              },
            },
          ],
        },
      ],
    }),
    [chartData]
  )

  /**
   * Chart event handlers
   */
  const onEvents = useMemo(
    () => ({
      click: handleChartClick,
    }),
    [handleChartClick]
  )

  // Loading state
  if (loading) {
    return (
      <div className={`market-heatmap ${className}`}>
        <div className="heatmap-loading">
          <div className="loading-spinner"></div>
          <span>加载热力图数据...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={`market-heatmap ${className}`}>
        <div className="heatmap-error">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
          <button className="retry-button" onClick={loadHeatmapData}>
            重试
          </button>
        </div>
      </div>
    )
  }

  // Empty state
  if (!heatmapData || heatmapData.groups.length === 0) {
    return (
      <div className={`market-heatmap ${className}`}>
        <div className="heatmap-empty">
          <span>暂无热力图数据</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`market-heatmap ${className}`}>
      {/* Header with controls */}
      <div className="heatmap-header">
        <div className="heatmap-title">
          <h3>市场热力图</h3>
          <span className="heatmap-subtitle">
            共 {heatmapData.totalStocks} 只股票 · 更新于{' '}
            {new Date(heatmapData.lastUpdated).toLocaleTimeString('zh-CN')}
          </span>
        </div>

        {/* Group by selector using HeatmapNavigation - Implements Requirements 11.1-11.4, 18.6 */}
        <div className="heatmap-controls">
          <HeatmapNavigation
            currentGroupBy={groupBy}
            onGroupByChange={handleGroupByChange}
          />
          <button className="refresh-button" onClick={loadHeatmapData} title="刷新数据">
            🔄
          </button>
        </div>
      </div>

      {/* Sector and Industry Filter - Implements Requirements 14.1, 14.6 */}
      <div className="heatmap-filter-row">
        <SectorFilter
          sectors={availableSectors}
          industries={availableIndustries}
          selectedSectors={filterState.sectors}
          selectedIndustries={filterState.industries}
          onSectorChange={handleSectorChange}
          onIndustryChange={handleIndustryChange}
        />
        
        {/* Toggle button for zero price stocks */}
        <button 
          className={`toggle-zero-price-button ${filterState.hideZeroPrice ? 'active' : ''}`}
          onClick={handleToggleZeroPrice}
          title={filterState.hideZeroPrice ? '显示零价股票' : '隐藏零价股票'}
        >
          {filterState.hideZeroPrice ? '👁️ 显示零价股' : '🚫 隐藏零价股'}
        </button>
        
        {(filterState.sectors.length > 0 || filterState.industries.length > 0) && (
          <button 
            className="clear-filters-button"
            onClick={() => setFilterState({ sectors: [], industries: [], hideZeroPrice: filterState.hideZeroPrice })}
          >
            清除筛选
          </button>
        )}
      </div>

      {/* Color legend */}
      <div className="heatmap-legend">
        <div className="legend-item">
          <div className="legend-gradient negative"></div>
          <span>跌幅</span>
        </div>
        <div className="legend-scale">
          <span>-5%</span>
          <span>0%</span>
          <span>+5%</span>
        </div>
        <div className="legend-item">
          <div className="legend-gradient positive"></div>
          <span>涨幅</span>
        </div>
      </div>

      {/* Heatmap chart with zoom support */}
      <div 
        className={`heatmap-chart-container ${dragState.isDragging ? 'dragging' : ''} ${zoomState.scale > DEFAULT_ZOOM_CONFIG.defaultScale ? 'zoomed' : ''}`}
        ref={chartContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
      >
        <div 
          className="heatmap-chart-wrapper"
          style={{
            transform: `scale(${zoomState.scale}) translate(${zoomState.translateX / zoomState.scale}px, ${zoomState.translateY / zoomState.scale}px)`,
            transformOrigin: 'center center',
          }}
        >
          <ReactECharts
            option={chartOption}
            style={{ height: '500px', width: '100%' }}
            onEvents={onEvents}
            opts={{ renderer: 'canvas' }}
            onChartReady={(chart) => { chartRef.current = chart }}
          />
        </div>
        
        {/* Zoom Controller - Implements Requirements 10.1, 10.2, 10.3, 10.6 */}
        <ZoomController
          scale={zoomState.scale}
          minScale={DEFAULT_ZOOM_CONFIG.minScale}
          maxScale={DEFAULT_ZOOM_CONFIG.maxScale}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onReset={handleZoomReset}
          className="heatmap-zoom-controller"
        />
      </div>

      {/* Summary statistics */}
      <div className="heatmap-summary">
        {heatmapData.groups.slice(0, 6).map(group => (
          <div key={group.name} className="summary-item">
            <span className="summary-name">{group.name}</span>
            <span
              className={`summary-change ${group.avgChangePercent >= 0 ? 'positive' : 'negative'}`}
            >
              {formatChangePercent(group.avgChangePercent)}
            </span>
            <span className="summary-count">{group.stockCount} 只</span>
          </div>
        ))}
      </div>
    </div>
  )
}
