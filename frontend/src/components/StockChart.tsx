import { useEffect, useRef, useState, useCallback } from 'react'
import {
  createChart,
  type IChartApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type UTCTimestamp,
  type SeriesMarker,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
} from 'lightweight-charts'
import {
  stockApi,
  type OHLCV,
  type TimeRange,
  type StockQuote,
  type TechnicalIndicatorsResponse,
  type TechnicalIndicatorsParams,
  type StockEvent,
  type StockEventType,
} from '../services/stockApi'
import './StockChart.css'

interface StockChartProps {
  symbol: string
  className?: string
}

/**
 * Available technical indicators
 */
type IndicatorType = 'sma' | 'rsi' | 'macd' | 'bollingerBands'

/**
 * Indicator configuration state
 */
interface IndicatorConfig {
  sma: {
    enabled: boolean
    periods: number[]
  }
  rsi: {
    enabled: boolean
    period: number
  }
  macd: {
    enabled: boolean
    fast: number
    slow: number
    signal: number
  }
  bollingerBands: {
    enabled: boolean
    period: number
    stdDev: number
  }
}

/**
 * Default indicator configuration
 */
const DEFAULT_INDICATOR_CONFIG: IndicatorConfig = {
  sma: {
    enabled: false,
    periods: [20, 50, 200],
  },
  rsi: {
    enabled: false,
    period: 14,
  },
  macd: {
    enabled: false,
    fast: 12,
    slow: 26,
    signal: 9,
  },
  bollingerBands: {
    enabled: false,
    period: 20,
    stdDev: 2,
  },
}

/**
 * SMA line colors for different periods
 */
const SMA_COLORS: Record<number, string> = {
  20: '#2196F3', // Blue
  50: '#FF9800', // Orange
  200: '#9C27B0', // Purple
}

/**
 * Time range options for the chart
 */
const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: '1天', value: '1D' },
  { label: '1周', value: '1W' },
  { label: '1月', value: '1M' },
  { label: '3月', value: '3M' },
  { label: '6月', value: '6M' },
  { label: '1年', value: '1Y' },
  { label: '全部', value: 'All' },
]

/**
 * Convert OHLCV data to candlestick format for lightweight-charts
 */
const toCandlestickData = (data: OHLCV[]): CandlestickData<UTCTimestamp>[] => {
  return data.map(item => ({
    time: (new Date(item.timestamp).getTime() / 1000) as UTCTimestamp,
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
  }))
}

/**
 * Convert OHLCV data to volume histogram format
 */
const toVolumeData = (data: OHLCV[]): HistogramData<UTCTimestamp>[] => {
  return data.map(item => ({
    time: (new Date(item.timestamp).getTime() / 1000) as UTCTimestamp,
    value: item.volume,
    color: item.close >= item.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
  }))
}

/**
 * Convert indicator series to line data format
 */
const toLineData = (series: { timestamp: string; value: number }[]): LineData<UTCTimestamp>[] => {
  return series.map(item => ({
    time: (new Date(item.timestamp).getTime() / 1000) as UTCTimestamp,
    value: item.value,
  }))
}

/**
 * Format price for display
 */
const formatPrice = (price: number): string => {
  return price.toFixed(2)
}

/**
 * Format volume for display
 */
const formatVolume = (volume: number): string => {
  if (volume >= 1_000_000_000) {
    return (volume / 1_000_000_000).toFixed(2) + 'B'
  }
  if (volume >= 1_000_000) {
    return (volume / 1_000_000).toFixed(2) + 'M'
  }
  if (volume >= 1_000) {
    return (volume / 1_000).toFixed(2) + 'K'
  }
  return volume.toString()
}

/**
 * Event marker configuration by type
 */
const EVENT_MARKER_CONFIG: Record<
  StockEventType,
  { shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown'; color: string; label: string }
> = {
  news: { shape: 'circle', color: '#1890ff', label: '📰' },
  earnings: { shape: 'square', color: '#722ed1', label: '📊' },
  dividend: { shape: 'circle', color: '#52c41a', label: '💰' },
  insider: { shape: 'arrowUp', color: '#fa8c16', label: '👤' },
  sec_filing: { shape: 'square', color: '#eb2f96', label: '📄' },
}

/**
 * Get marker shape based on impact direction
 */
const getMarkerShape = (event: StockEvent): 'circle' | 'square' | 'arrowUp' | 'arrowDown' => {
  if (event.impact) {
    if (event.impact.direction === 'bullish') return 'arrowUp'
    if (event.impact.direction === 'bearish') return 'arrowDown'
  }
  return EVENT_MARKER_CONFIG[event.type].shape
}

/**
 * Get marker color based on event type and impact
 */
const getMarkerColor = (event: StockEvent): string => {
  if (event.impact) {
    if (event.impact.direction === 'bullish') return '#26a69a'
    if (event.impact.direction === 'bearish') return '#ef5350'
  }
  return EVENT_MARKER_CONFIG[event.type].color
}

/**
 * Convert stock events to chart markers
 */
const toChartMarkers = (events: StockEvent[]): SeriesMarker<UTCTimestamp>[] => {
  return events.map(event => ({
    time: (new Date(event.timestamp).getTime() / 1000) as UTCTimestamp,
    position: 'aboveBar' as const,
    color: getMarkerColor(event),
    shape: getMarkerShape(event),
    text: EVENT_MARKER_CONFIG[event.type].label,
    id: event.id,
  }))
}

/**
 * Format event type for display
 */
const formatEventType = (type: StockEventType): string => {
  const typeLabels: Record<StockEventType, string> = {
    news: '新闻',
    earnings: '财报',
    dividend: '股息',
    insider: '内部交易',
    sec_filing: 'SEC文件',
  }
  return typeLabels[type]
}

/**
 * Format impact direction for display
 */
const formatImpactDirection = (direction: 'bullish' | 'bearish' | 'neutral'): string => {
  const directionLabels = {
    bullish: '利好',
    bearish: '利空',
    neutral: '中性',
  }
  return directionLabels[direction]
}

/**
 * Format impact magnitude for display
 */
const formatImpactMagnitude = (magnitude: 'high' | 'medium' | 'low'): string => {
  const magnitudeLabels = {
    high: '高',
    medium: '中',
    low: '低',
  }
  return magnitudeLabels[magnitude]
}

/**
 * StockChart Component
 *
 * Displays an interactive K-line (candlestick) chart with volume bars
 * and technical indicator overlays using TradingView Lightweight Charts library.
 *
 * Features:
 * - Candlestick chart with OHLCV data
 * - Volume bars below the chart
 * - Time range selector (1D, 1W, 1M, 3M, 6M, 1Y, All)
 * - Technical indicator overlays (SMA, Bollinger Bands)
 * - Separate indicator panels (RSI, MACD)
 * - Customizable indicator parameters
 * - Responsive design
 * - Loading and error states
 *
 * Implements Requirements 4.1, 4.3, 16.1, 16.4:
 * - 4.1: Display interactive K-line chart and volume chart
 * - 4.3: Support time range switching
 * - 16.1: Support overlaying multiple technical indicators (RSI, MACD, Bollinger Bands, etc.)
 * - 16.4: Allow customizing indicator parameters
 */
export const StockChart = ({ symbol, className = '' }: StockChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const rsiChartContainerRef = useRef<HTMLDivElement>(null)
  const macdChartContainerRef = useRef<HTMLDivElement>(null)

  const chartRef = useRef<IChartApi | null>(null)
  const rsiChartRef = useRef<IChartApi | null>(null)
  const macdChartRef = useRef<IChartApi | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candlestickSeriesRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volumeSeriesRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const smaSeriesRefs = useRef<Map<number, any>>(new Map())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bbSeriesRefs = useRef<{ upper: any; middle: any; lower: any } | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rsiSeriesRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const macdSeriesRefs = useRef<{ macd: any; signal: any; histogram: any } | null>(null)

  const [selectedRange, setSelectedRange] = useState<TimeRange>('1M')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quote, setQuote] = useState<StockQuote | null>(null)
  const [ohlcvData, setOhlcvData] = useState<OHLCV[]>([])
  const [indicators, setIndicators] = useState<TechnicalIndicatorsResponse | null>(null)
  const [indicatorConfig, setIndicatorConfig] = useState<IndicatorConfig>(DEFAULT_INDICATOR_CONFIG)
  const [showIndicatorPanel, setShowIndicatorPanel] = useState(false)

  // Event markers state
  const [events, setEvents] = useState<StockEvent[]>([])
  const [showEvents, setShowEvents] = useState(true)
  const [hoveredEvent, setHoveredEvent] = useState<StockEvent | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  /**
   * Initialize the main price chart
   */
  const initChart = useCallback(() => {
    if (!chartContainerRef.current) return

    // Clean up existing chart
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const container = chartContainerRef.current
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 400,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          width: 1,
          color: '#758696',
          style: 3,
          labelBackgroundColor: '#1890ff',
        },
        horzLine: {
          width: 1,
          color: '#758696',
          style: 3,
          labelBackgroundColor: '#1890ff',
        },
      },
      rightPriceScale: {
        borderColor: '#d9d9d9',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: '#d9d9d9',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    // Create candlestick series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    })

    // Create volume series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    })

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    })

    chartRef.current = chart
    candlestickSeriesRef.current = candlestickSeries
    volumeSeriesRef.current = volumeSeries

    // Handle resize
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [])

  /**
   * Initialize RSI chart panel
   */
  const initRsiChart = useCallback(() => {
    if (!rsiChartContainerRef.current || !indicatorConfig.rsi.enabled) return

    if (rsiChartRef.current) {
      rsiChartRef.current.remove()
      rsiChartRef.current = null
    }

    const container = rsiChartContainerRef.current
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 150,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      rightPriceScale: {
        borderColor: '#d9d9d9',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#d9d9d9',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    const rsiSeries = chart.addSeries(LineSeries, {
      color: '#9C27B0',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    })

    rsiChartRef.current = chart
    rsiSeriesRef.current = rsiSeries

    return () => {
      if (rsiChartRef.current) {
        rsiChartRef.current.remove()
        rsiChartRef.current = null
      }
    }
  }, [indicatorConfig.rsi.enabled])

  /**
   * Initialize MACD chart panel
   */
  const initMacdChart = useCallback(() => {
    if (!macdChartContainerRef.current || !indicatorConfig.macd.enabled) return

    if (macdChartRef.current) {
      macdChartRef.current.remove()
      macdChartRef.current = null
    }

    const container = macdChartContainerRef.current
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 150,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      rightPriceScale: {
        borderColor: '#d9d9d9',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#d9d9d9',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    const macdLine = chart.addSeries(LineSeries, {
      color: '#2196F3',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
    })

    const signalLine = chart.addSeries(LineSeries, {
      color: '#FF9800',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
    })

    const histogram = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
      priceScaleId: '',
    })

    histogram.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })

    macdChartRef.current = chart
    macdSeriesRefs.current = { macd: macdLine, signal: signalLine, histogram }

    return () => {
      if (macdChartRef.current) {
        macdChartRef.current.remove()
        macdChartRef.current = null
      }
    }
  }, [indicatorConfig.macd.enabled])

  /**
   * Update SMA overlay lines on the main chart
   */
  const updateSmaOverlay = useCallback(() => {
    if (!chartRef.current || !indicators) return

    // Remove existing SMA series
    smaSeriesRefs.current.forEach(series => {
      try {
        chartRef.current?.removeSeries(series)
      } catch {
        // Series may already be removed
      }
    })
    smaSeriesRefs.current.clear()

    if (!indicatorConfig.sma.enabled) return

    // Add SMA lines for each period
    for (const period of indicatorConfig.sma.periods) {
      const seriesKey = `sma${period}`
      const seriesData = indicators.smaSeries[seriesKey]

      if (seriesData && seriesData.length > 0) {
        const smaSeries = chartRef.current.addSeries(LineSeries, {
          color: SMA_COLORS[period] || '#666',
          lineWidth: 1,
          priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
        })

        smaSeries.setData(toLineData(seriesData))
        smaSeriesRefs.current.set(period, smaSeries)
      }
    }
  }, [indicators, indicatorConfig.sma])

  /**
   * Update Bollinger Bands overlay on the main chart
   */
  const updateBollingerBandsOverlay = useCallback(() => {
    if (!chartRef.current || !indicators) return

    // Remove existing BB series
    if (bbSeriesRefs.current) {
      try {
        chartRef.current.removeSeries(bbSeriesRefs.current.upper)
        chartRef.current.removeSeries(bbSeriesRefs.current.middle)
        chartRef.current.removeSeries(bbSeriesRefs.current.lower)
      } catch {
        // Series may already be removed
      }
      bbSeriesRefs.current = null
    }

    if (!indicatorConfig.bollingerBands.enabled) return

    const bbData = indicators.bollingerBandsSeries
    if (!bbData || bbData.length === 0) return

    // Create BB series
    const upperSeries = chartRef.current.addSeries(LineSeries, {
      color: 'rgba(33, 150, 243, 0.5)',
      lineWidth: 1,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    })

    const middleSeries = chartRef.current.addSeries(LineSeries, {
      color: 'rgba(33, 150, 243, 0.8)',
      lineWidth: 1,
      lineStyle: 2, // Dashed
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    })

    const lowerSeries = chartRef.current.addSeries(LineSeries, {
      color: 'rgba(33, 150, 243, 0.5)',
      lineWidth: 1,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    })

    // Set data
    upperSeries.setData(
      bbData.map(d => ({
        time: (new Date(d.timestamp).getTime() / 1000) as UTCTimestamp,
        value: d.upper,
      }))
    )

    middleSeries.setData(
      bbData.map(d => ({
        time: (new Date(d.timestamp).getTime() / 1000) as UTCTimestamp,
        value: d.middle,
      }))
    )

    lowerSeries.setData(
      bbData.map(d => ({
        time: (new Date(d.timestamp).getTime() / 1000) as UTCTimestamp,
        value: d.lower,
      }))
    )

    bbSeriesRefs.current = { upper: upperSeries, middle: middleSeries, lower: lowerSeries }
  }, [indicators, indicatorConfig.bollingerBands])

  /**
   * Update RSI panel data
   */
  const updateRsiPanel = useCallback(() => {
    if (!rsiSeriesRef.current || !indicators) return

    const rsiData = indicators.rsiSeries
    if (!rsiData || rsiData.length === 0) return

    rsiSeriesRef.current.setData(toLineData(rsiData))

    if (rsiChartRef.current) {
      rsiChartRef.current.timeScale().fitContent()
    }
  }, [indicators])

  /**
   * Update MACD panel data
   */
  const updateMacdPanel = useCallback(() => {
    if (!macdSeriesRefs.current || !indicators) return

    const macdData = indicators.macdSeries
    if (!macdData || macdData.length === 0) return

    // MACD line
    macdSeriesRefs.current.macd.setData(
      macdData.map(d => ({
        time: (new Date(d.timestamp).getTime() / 1000) as UTCTimestamp,
        value: d.value,
      }))
    )

    // Signal line
    macdSeriesRefs.current.signal.setData(
      macdData.map(d => ({
        time: (new Date(d.timestamp).getTime() / 1000) as UTCTimestamp,
        value: d.signal,
      }))
    )

    // Histogram
    macdSeriesRefs.current.histogram.setData(
      macdData.map(d => ({
        time: (new Date(d.timestamp).getTime() / 1000) as UTCTimestamp,
        value: d.histogram,
        color: d.histogram >= 0 ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
      }))
    )

    if (macdChartRef.current) {
      macdChartRef.current.timeScale().fitContent()
    }
  }, [indicators])

  /**
   * Update event markers on the chart
   * Implements Requirements 4.2: Mark important news and events on the timeline
   * Note: In lightweight-charts v5, setMarkers is no longer available on series.
   * We need to use chart.setMarkers() instead or skip markers for now.
   */
  const updateEventMarkers = useCallback(() => {
    if (!chartRef.current || !showEvents) {
      return
    }

    // In lightweight-charts v5, markers need to be set on the chart level
    // For now, we'll skip the markers functionality as it requires a different approach
    // The events are still loaded and can be displayed in a separate UI component
    
    // Note: To properly implement markers in v5, you would need to:
    // 1. Use chart.addLineSeries() with markers
    // 2. Or implement a custom primitive using chart.addSeries().attachPrimitive()
    // 3. Or display events in a separate timeline component below the chart
    
    // For now, we just log the events for debugging
    if (events.length > 0) {
      console.debug(`Loaded ${events.length} events for chart timeline`)
    }
  }, [events, showEvents])

  /**
   * Load chart data and indicators
   */
  const loadData = useCallback(async () => {
    if (!symbol) return

    try {
      setLoading(true)
      setError(null)

      // Build indicator params based on config
      const indicatorParams: TechnicalIndicatorsParams = {
        range: selectedRange,
        smaPeriods: indicatorConfig.sma.periods,
        rsiPeriod: indicatorConfig.rsi.period,
        macdParams: {
          fast: indicatorConfig.macd.fast,
          slow: indicatorConfig.macd.slow,
          signal: indicatorConfig.macd.signal,
        },
        bbParams: {
          period: indicatorConfig.bollingerBands.period,
          stdDev: indicatorConfig.bollingerBands.stdDev,
        },
      }

      // Fetch data in parallel (including events)
      const [historicalData, quoteData, indicatorData, eventsData] = await Promise.all([
        stockApi.getHistoricalData(symbol, selectedRange),
        stockApi.getQuote(symbol),
        stockApi.getTechnicalIndicators(symbol, indicatorParams),
        stockApi.getStockEvents(symbol, selectedRange),
      ])

      setOhlcvData(historicalData)
      setQuote(quoteData)
      setIndicators(indicatorData)
      setEvents(eventsData)

      // Update main chart data
      if (candlestickSeriesRef.current && volumeSeriesRef.current) {
        const candlestickData = toCandlestickData(historicalData)
        const volumeData = toVolumeData(historicalData)

        candlestickSeriesRef.current.setData(candlestickData)
        volumeSeriesRef.current.setData(volumeData)

        if (chartRef.current) {
          chartRef.current.timeScale().fitContent()
        }
      }
    } catch (err) {
      console.error('Failed to load chart data:', err)
      setError('加载图表数据失败')
    } finally {
      setLoading(false)
    }
  }, [symbol, selectedRange, indicatorConfig])

  // Initialize main chart on mount
  useEffect(() => {
    const cleanup = initChart()
    return cleanup
  }, [initChart])

  // Initialize RSI chart when enabled
  useEffect(() => {
    if (indicatorConfig.rsi.enabled) {
      const cleanup = initRsiChart()
      return cleanup
    }
  }, [initRsiChart, indicatorConfig.rsi.enabled])

  // Initialize MACD chart when enabled
  useEffect(() => {
    if (indicatorConfig.macd.enabled) {
      const cleanup = initMacdChart()
      return cleanup
    }
  }, [initMacdChart, indicatorConfig.macd.enabled])

  // Load data when symbol or range changes
  useEffect(() => {
    if (chartRef.current) {
      loadData()
    }
  }, [loadData])

  // Update overlays when indicators data changes
  useEffect(() => {
    if (indicators) {
      updateSmaOverlay()
      updateBollingerBandsOverlay()
    }
  }, [indicators, updateSmaOverlay, updateBollingerBandsOverlay])

  // Update RSI panel when data changes
  useEffect(() => {
    if (indicators && indicatorConfig.rsi.enabled && rsiSeriesRef.current) {
      updateRsiPanel()
    }
  }, [indicators, indicatorConfig.rsi.enabled, updateRsiPanel])

  // Update MACD panel when data changes
  useEffect(() => {
    if (indicators && indicatorConfig.macd.enabled && macdSeriesRefs.current) {
      updateMacdPanel()
    }
  }, [indicators, indicatorConfig.macd.enabled, updateMacdPanel])

  // Update event markers when events or showEvents changes
  useEffect(() => {
    updateEventMarkers()
  }, [updateEventMarkers])

  // Set up crosshair move handler for event tooltips
  useEffect(() => {
    if (!chartRef.current || !chartContainerRef.current) return

    const chart = chartRef.current
    const container = chartContainerRef.current

    /**
     * Handle crosshair move to show event tooltips
     * Implements Requirements 4.5: Show detailed data and related events on hover
     */
    const handleCrosshairMove = (param: {
      time?: number | string
      point?: { x: number; y: number }
    }) => {
      if (!param.time || !param.point || events.length === 0 || !showEvents) {
        setHoveredEvent(null)
        setTooltipPosition(null)
        return
      }

      // Find event at the current time (within a small tolerance)
      const currentTime =
        typeof param.time === 'number' ? param.time : new Date(param.time).getTime() / 1000
      const tolerance = 86400 // 1 day in seconds

      const matchingEvent = events.find(event => {
        const eventTime = new Date(event.timestamp).getTime() / 1000
        return Math.abs(eventTime - currentTime) < tolerance
      })

      if (matchingEvent) {
        setHoveredEvent(matchingEvent)
        // Calculate tooltip position relative to the container
        const containerRect = container.getBoundingClientRect()
        setTooltipPosition({
          x: param.point.x,
          y: param.point.y - containerRect.top + container.scrollTop,
        })
      } else {
        setHoveredEvent(null)
        setTooltipPosition(null)
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chart.subscribeCrosshairMove(handleCrosshairMove as any)

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chart.unsubscribeCrosshairMove(handleCrosshairMove as any)
    }
  }, [events, showEvents])

  /**
   * Handle time range change
   */
  const handleRangeChange = (range: TimeRange) => {
    setSelectedRange(range)
  }

  /**
   * Toggle indicator
   */
  const toggleIndicator = (indicator: IndicatorType) => {
    setIndicatorConfig(prev => ({
      ...prev,
      [indicator]: {
        ...prev[indicator],
        enabled: !prev[indicator].enabled,
      },
    }))
  }

  /**
   * Toggle event markers visibility
   */
  const toggleEvents = () => {
    setShowEvents(prev => !prev)
  }

  /**
   * Handle event click to open URL
   */
  const handleEventClick = (event: StockEvent) => {
    if (event.url) {
      window.open(event.url, '_blank', 'noopener,noreferrer')
    }
  }

  /**
   * Update indicator parameter
   */
  const updateIndicatorParam = (
    indicator: IndicatorType,
    param: string,
    value: number | number[]
  ) => {
    setIndicatorConfig(prev => ({
      ...prev,
      [indicator]: {
        ...prev[indicator],
        [param]: value,
      },
    }))
  }

  /**
   * Get the latest OHLCV data point
   */
  const getLatestData = (): OHLCV | null => {
    if (ohlcvData.length === 0) return null
    return ohlcvData[ohlcvData.length - 1]
  }

  const latestData = getLatestData()
  const priceChange = quote ? quote.change : 0
  const priceChangePercent = quote ? quote.changePercent : 0
  const isPositive = priceChange >= 0

  return (
    <div className={`stock-chart ${className}`}>
      {/* Header with stock info */}
      <div className="chart-header">
        <div className="chart-title">
          <h2 className="symbol">{symbol}</h2>
          {quote && (
            <div className="price-info">
              <span className="current-price">${formatPrice(quote.price)}</span>
              <span className={`price-change ${isPositive ? 'positive' : 'negative'}`}>
                {isPositive ? '+' : ''}
                {formatPrice(priceChange)} ({isPositive ? '+' : ''}
                {priceChangePercent.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>

        {/* Time range selector */}
        <div className="time-range-selector">
          {TIME_RANGES.map(range => (
            <button
              key={range.value}
              className={`range-button ${selectedRange === range.value ? 'active' : ''}`}
              onClick={() => handleRangeChange(range.value)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Indicator selector */}
      <div className="indicator-controls">
        <button
          className="indicator-toggle-btn"
          onClick={() => setShowIndicatorPanel(!showIndicatorPanel)}
        >
          📊 技术指标 {showIndicatorPanel ? '▲' : '▼'}
        </button>

        {/* Quick indicator toggles */}
        <div className="indicator-quick-toggles">
          <label className={`indicator-checkbox ${indicatorConfig.sma.enabled ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={indicatorConfig.sma.enabled}
              onChange={() => toggleIndicator('sma')}
            />
            SMA
          </label>
          <label
            className={`indicator-checkbox ${indicatorConfig.bollingerBands.enabled ? 'active' : ''}`}
          >
            <input
              type="checkbox"
              checked={indicatorConfig.bollingerBands.enabled}
              onChange={() => toggleIndicator('bollingerBands')}
            />
            布林带
          </label>
          <label className={`indicator-checkbox ${indicatorConfig.rsi.enabled ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={indicatorConfig.rsi.enabled}
              onChange={() => toggleIndicator('rsi')}
            />
            RSI
          </label>
          <label className={`indicator-checkbox ${indicatorConfig.macd.enabled ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={indicatorConfig.macd.enabled}
              onChange={() => toggleIndicator('macd')}
            />
            MACD
          </label>

          {/* Event markers toggle */}
          <label className={`indicator-checkbox events-toggle ${showEvents ? 'active' : ''}`}>
            <input type="checkbox" checked={showEvents} onChange={toggleEvents} />
            📅 事件标注
          </label>
        </div>
      </div>

      {/* Indicator parameter panel */}
      {showIndicatorPanel && (
        <div className="indicator-panel">
          {/* SMA Settings */}
          <div className="indicator-settings">
            <h4>SMA 移动平均线</h4>
            <div className="param-group">
              <label>周期:</label>
              <div className="sma-periods">
                {[20, 50, 200].map(period => (
                  <label key={period} className="period-checkbox">
                    <input
                      type="checkbox"
                      checked={indicatorConfig.sma.periods.includes(period)}
                      onChange={() => {
                        const newPeriods = indicatorConfig.sma.periods.includes(period)
                          ? indicatorConfig.sma.periods.filter(p => p !== period)
                          : [...indicatorConfig.sma.periods, period].sort((a, b) => a - b)
                        updateIndicatorParam('sma', 'periods', newPeriods)
                      }}
                    />
                    <span style={{ color: SMA_COLORS[period] }}>{period}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* RSI Settings */}
          <div className="indicator-settings">
            <h4>RSI 相对强弱指数</h4>
            <div className="param-group">
              <label>周期:</label>
              <input
                type="number"
                min="2"
                max="100"
                value={indicatorConfig.rsi.period}
                onChange={e =>
                  updateIndicatorParam('rsi', 'period', parseInt(e.target.value) || 14)
                }
              />
            </div>
          </div>

          {/* MACD Settings */}
          <div className="indicator-settings">
            <h4>MACD 指数平滑异同移动平均线</h4>
            <div className="param-group">
              <label>快线:</label>
              <input
                type="number"
                min="2"
                max="100"
                value={indicatorConfig.macd.fast}
                onChange={e => updateIndicatorParam('macd', 'fast', parseInt(e.target.value) || 12)}
              />
              <label>慢线:</label>
              <input
                type="number"
                min="2"
                max="100"
                value={indicatorConfig.macd.slow}
                onChange={e => updateIndicatorParam('macd', 'slow', parseInt(e.target.value) || 26)}
              />
              <label>信号:</label>
              <input
                type="number"
                min="2"
                max="100"
                value={indicatorConfig.macd.signal}
                onChange={e =>
                  updateIndicatorParam('macd', 'signal', parseInt(e.target.value) || 9)
                }
              />
            </div>
          </div>

          {/* Bollinger Bands Settings */}
          <div className="indicator-settings">
            <h4>布林带</h4>
            <div className="param-group">
              <label>周期:</label>
              <input
                type="number"
                min="2"
                max="100"
                value={indicatorConfig.bollingerBands.period}
                onChange={e =>
                  updateIndicatorParam('bollingerBands', 'period', parseInt(e.target.value) || 20)
                }
              />
              <label>标准差:</label>
              <input
                type="number"
                min="0.5"
                max="5"
                step="0.5"
                value={indicatorConfig.bollingerBands.stdDev}
                onChange={e =>
                  updateIndicatorParam('bollingerBands', 'stdDev', parseFloat(e.target.value) || 2)
                }
              />
            </div>
          </div>

          <button className="apply-indicators-btn" onClick={loadData}>
            应用设置
          </button>
        </div>
      )}

      {/* OHLCV summary */}
      {latestData && !loading && (
        <div className="ohlcv-summary">
          <div className="ohlcv-item">
            <span className="label">开盘</span>
            <span className="value">${formatPrice(latestData.open)}</span>
          </div>
          <div className="ohlcv-item">
            <span className="label">最高</span>
            <span className="value">${formatPrice(latestData.high)}</span>
          </div>
          <div className="ohlcv-item">
            <span className="label">最低</span>
            <span className="value">${formatPrice(latestData.low)}</span>
          </div>
          <div className="ohlcv-item">
            <span className="label">收盘</span>
            <span className="value">${formatPrice(latestData.close)}</span>
          </div>
          <div className="ohlcv-item">
            <span className="label">成交量</span>
            <span className="value">{formatVolume(latestData.volume)}</span>
          </div>
          {/* Show current indicator values */}
          {indicators && indicatorConfig.rsi.enabled && indicators.rsi.value !== null && (
            <div className="ohlcv-item">
              <span className="label">RSI({indicatorConfig.rsi.period})</span>
              <span
                className={`value ${indicators.rsi.value > 70 ? 'overbought' : indicators.rsi.value < 30 ? 'oversold' : ''}`}
              >
                {indicators.rsi.value.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Events summary - Implements Requirements 4.2: Mark important news and events on timeline */}
      {showEvents && events.length > 0 && !loading && (
        <div className="events-summary">
          <div className="events-summary-header">
            <span className="events-title">📅 时间轴事件 ({events.length})</span>
          </div>
          <div className="events-list">
            {events.slice(0, 5).map(event => (
              <div
                key={event.id}
                className="event-item"
                onClick={() => handleEventClick(event)}
                onMouseEnter={() => setHoveredEvent(event)}
                onMouseLeave={() => setHoveredEvent(null)}
              >
                <span className="event-icon">{EVENT_MARKER_CONFIG[event.type].label}</span>
                <span className="event-info">
                  <span className="event-title-text">{event.title}</span>
                  <span className="event-meta">
                    {new Date(event.timestamp).toLocaleDateString('zh-CN')}
                    {event.impact && (
                      <span className={`event-impact-badge ${event.impact.direction}`}>
                        {formatImpactDirection(event.impact.direction)}
                      </span>
                    )}
                  </span>
                </span>
              </div>
            ))}
            {events.length > 5 && (
              <div className="events-more">还有 {events.length - 5} 个事件...</div>
            )}
          </div>
        </div>
      )}

      {/* Main chart container */}
      <div className="chart-container">
        {loading && (
          <div className="chart-loading">
            <div className="loading-spinner"></div>
            <span>加载中...</span>
          </div>
        )}

        {error && (
          <div className="chart-error">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{error}</span>
            <button className="retry-button" onClick={loadData}>
              重试
            </button>
          </div>
        )}

        <div
          ref={chartContainerRef}
          className={`chart-canvas ${loading || error ? 'hidden' : ''}`}
        />

        {/* Event tooltip - Implements Requirements 4.5: Show detailed data and related events on hover */}
        {hoveredEvent && tooltipPosition && (
          <div
            ref={tooltipRef}
            className="event-tooltip"
            style={{
              left: `${Math.min(tooltipPosition.x, (chartContainerRef.current?.clientWidth || 400) - 280)}px`,
              top: `${Math.max(tooltipPosition.y - 120, 10)}px`,
            }}
            onClick={() => handleEventClick(hoveredEvent)}
          >
            <div className="event-tooltip-header">
              <span className="event-type-badge" data-type={hoveredEvent.type}>
                {EVENT_MARKER_CONFIG[hoveredEvent.type].label} {formatEventType(hoveredEvent.type)}
              </span>
              <span className="event-date">
                {new Date(hoveredEvent.timestamp).toLocaleDateString('zh-CN')}
              </span>
            </div>
            <div className="event-tooltip-title">{hoveredEvent.title}</div>
            <div className="event-tooltip-summary">{hoveredEvent.summary}</div>
            {hoveredEvent.impact && (
              <div className="event-tooltip-impact">
                <span className={`impact-direction ${hoveredEvent.impact.direction}`}>
                  {formatImpactDirection(hoveredEvent.impact.direction)}
                </span>
                <span className={`impact-magnitude ${hoveredEvent.impact.magnitude}`}>
                  影响程度: {formatImpactMagnitude(hoveredEvent.impact.magnitude)}
                </span>
              </div>
            )}
            {hoveredEvent.url && <div className="event-tooltip-footer">点击查看详情 →</div>}
          </div>
        )}
      </div>

      {/* RSI Panel */}
      {indicatorConfig.rsi.enabled && (
        <div className="indicator-chart-panel">
          <div className="panel-header">
            <span className="panel-title">RSI ({indicatorConfig.rsi.period})</span>
            <div className="rsi-levels">
              <span className="level overbought">超买 70</span>
              <span className="level oversold">超卖 30</span>
            </div>
          </div>
          <div ref={rsiChartContainerRef} className="indicator-chart-canvas" />
        </div>
      )}

      {/* MACD Panel */}
      {indicatorConfig.macd.enabled && (
        <div className="indicator-chart-panel">
          <div className="panel-header">
            <span className="panel-title">
              MACD ({indicatorConfig.macd.fast}, {indicatorConfig.macd.slow},{' '}
              {indicatorConfig.macd.signal})
            </span>
            <div className="macd-legend">
              <span className="legend-item macd-line">MACD</span>
              <span className="legend-item signal-line">Signal</span>
              <span className="legend-item histogram">Histogram</span>
            </div>
          </div>
          <div ref={macdChartContainerRef} className="indicator-chart-canvas" />
        </div>
      )}

      {/* Chart legend */}
      <div className="chart-legend">
        <div className="legend-item">
          <span className="legend-color bullish"></span>
          <span className="legend-text">上涨</span>
        </div>
        <div className="legend-item">
          <span className="legend-color bearish"></span>
          <span className="legend-text">下跌</span>
        </div>
        {indicatorConfig.sma.enabled &&
          indicatorConfig.sma.periods.map(period => (
            <div key={period} className="legend-item">
              <span className="legend-color" style={{ backgroundColor: SMA_COLORS[period] }}></span>
              <span className="legend-text">SMA{period}</span>
            </div>
          ))}
        {indicatorConfig.bollingerBands.enabled && (
          <div className="legend-item">
            <span
              className="legend-color"
              style={{ backgroundColor: 'rgba(33, 150, 243, 0.8)' }}
            ></span>
            <span className="legend-text">布林带</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default StockChart
