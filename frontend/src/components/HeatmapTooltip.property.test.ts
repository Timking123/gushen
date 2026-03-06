/**
 * Property-Based Tests for Heatmap Tooltip Content Completeness
 * Feature: stock-detail-and-heatmap-enhancement
 *
 * **Property 14: 热力图提示框内容完整性**
 * **Validates: Requirements 13.2**
 *
 * Property: For any stock item in the heatmap, the tooltip should contain
 * all required fields: symbol (股票代码), name (名称), price (价格),
 * changePercent (涨跌幅), marketCap (市值), sector (板块).
 *
 * Requirements:
 * - 13.2: 提示框包含股票代码、名称、价格、涨跌幅、市值、板块
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

/**
 * Interface representing a stock item in the heatmap
 * This mirrors the data structure used in MarketHeatmap component
 */
interface HeatmapStockItem {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  marketCap: number
  sector: string
  industry?: string | null
  volume?: number
}

/**
 * Required tooltip fields as per Requirement 13.2
 */
const REQUIRED_TOOLTIP_FIELDS = [
  'symbol',     // 股票代码
  'name',       // 名称
  'price',      // 价格
  'changePercent', // 涨跌幅
  'marketCap',  // 市值
  'sector',     // 板块
] as const

/**
 * Generates a tooltip HTML string for a stock item
 * This simulates the tooltip formatter logic in MarketHeatmap
 */
function generateTooltipContent(item: HeatmapStockItem): string {
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

  const formatChangePercent = (changePercent: number): string => {
    const sign = changePercent >= 0 ? '+' : ''
    return `${sign}${changePercent.toFixed(2)}%`
  }

  return `
    <div class="heatmap-tooltip heatmap-tooltip-stock">
      <div class="tooltip-header">
        <span class="tooltip-symbol">${item.symbol}</span>
        <span class="tooltip-name">${item.name || '暂无名称'}</span>
      </div>
      <div class="tooltip-body">
        <div class="tooltip-row">
          <span class="tooltip-label">价格:</span>
          <span class="tooltip-value">$${item.price.toFixed(2)}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">涨跌:</span>
          <span class="tooltip-value ${item.changePercent >= 0 ? 'positive' : 'negative'}">
            ${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)} (${formatChangePercent(item.changePercent)})
          </span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">市值:</span>
          <span class="tooltip-value">${formatMarketCap(item.marketCap)}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">板块:</span>
          <span class="tooltip-value">${item.sector || '暂无数据'}</span>
        </div>
      </div>
    </div>
  `
}

/**
 * Validates that a tooltip contains all required fields
 */
function validateTooltipCompleteness(tooltipHtml: string, item: HeatmapStockItem): {
  isComplete: boolean
  missingFields: string[]
  presentFields: string[]
} {
  const missingFields: string[] = []
  const presentFields: string[] = []

  // Check for symbol (股票代码)
  if (tooltipHtml.includes(item.symbol)) {
    presentFields.push('symbol')
  } else {
    missingFields.push('symbol')
  }

  // Check for name (名称) - either actual name or placeholder
  if (tooltipHtml.includes(item.name) || tooltipHtml.includes('暂无名称')) {
    presentFields.push('name')
  } else {
    missingFields.push('name')
  }

  // Check for price (价格)
  if (tooltipHtml.includes('价格') && tooltipHtml.includes(item.price.toFixed(2))) {
    presentFields.push('price')
  } else {
    missingFields.push('price')
  }

  // Check for changePercent (涨跌幅)
  if (tooltipHtml.includes('涨跌') && tooltipHtml.includes('%')) {
    presentFields.push('changePercent')
  } else {
    missingFields.push('changePercent')
  }

  // Check for marketCap (市值)
  if (tooltipHtml.includes('市值')) {
    presentFields.push('marketCap')
  } else {
    missingFields.push('marketCap')
  }

  // Check for sector (板块) - either actual sector or placeholder
  if (tooltipHtml.includes('板块') && (tooltipHtml.includes(item.sector) || tooltipHtml.includes('暂无数据'))) {
    presentFields.push('sector')
  } else {
    missingFields.push('sector')
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    presentFields,
  }
}

/**
 * Arbitrary generator for valid stock symbols
 */
const stockSymbolArb = fc.string({ minLength: 1, maxLength: 5 }).map(s => 
  s.toUpperCase().replace(/[^A-Z]/g, 'A').slice(0, 5) || 'AAPL'
)

/**
 * Arbitrary generator for stock names
 */
const stockNameArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 50 }),
  fc.constant(''),
)

/**
 * Arbitrary generator for sector names
 */
const sectorArb = fc.oneof(
  fc.constantFrom('Technology', 'Healthcare', 'Financial Services', 'Consumer Cyclical', 'Energy', 'Industrials'),
  fc.constant(''),
)

/**
 * Arbitrary generator for a complete HeatmapStockItem
 */
const heatmapStockItemArb: fc.Arbitrary<HeatmapStockItem> = fc.record({
  symbol: stockSymbolArb,
  name: stockNameArb,
  price: fc.double({ min: 0.01, max: 10000, noNaN: true }),
  change: fc.double({ min: -1000, max: 1000, noNaN: true }),
  changePercent: fc.double({ min: -100, max: 100, noNaN: true }),
  marketCap: fc.double({ min: 1000, max: 5_000_000_000_000, noNaN: true }),
  sector: sectorArb,
  industry: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
  volume: fc.option(fc.integer({ min: 0, max: 1_000_000_000 }), { nil: undefined }),
})

describe('Property 14: 热力图提示框内容完整性', () => {
  /**
   * Property: Tooltip should contain all required fields for any stock item
   * **Validates: Requirements 13.2**
   */
  it('should contain all required fields (symbol, name, price, changePercent, marketCap, sector) for any stock item', () => {
    fc.assert(
      fc.property(heatmapStockItemArb, (stockItem) => {
        const tooltipHtml = generateTooltipContent(stockItem)
        const validation = validateTooltipCompleteness(tooltipHtml, stockItem)

        expect(validation.isComplete).toBe(true)
        expect(validation.missingFields).toHaveLength(0)
        expect(validation.presentFields).toHaveLength(REQUIRED_TOOLTIP_FIELDS.length)
      }),
      { numRuns: 20 }
    )
  })

  /**
   * Property: Tooltip should handle missing/empty name gracefully
   * **Validates: Requirements 13.2**
   */
  it('should display placeholder when name is empty', () => {
    fc.assert(
      fc.property(
        heatmapStockItemArb.map(item => ({ ...item, name: '' })),
        (stockItem) => {
          const tooltipHtml = generateTooltipContent(stockItem)
          expect(tooltipHtml).toContain('暂无名称')
        }
      ),
      { numRuns: 5 }
    )
  })

  /**
   * Property: Tooltip should handle missing/empty sector gracefully
   * **Validates: Requirements 13.2**
   */
  it('should display placeholder when sector is empty', () => {
    fc.assert(
      fc.property(
        heatmapStockItemArb.map(item => ({ ...item, sector: '' })),
        (stockItem) => {
          const tooltipHtml = generateTooltipContent(stockItem)
          expect(tooltipHtml).toContain('暂无数据')
        }
      ),
      { numRuns: 5 }
    )
  })

  /**
   * Property: Tooltip should correctly format positive change with + sign
   * **Validates: Requirements 13.2**
   */
  it('should format positive change with + sign', () => {
    fc.assert(
      fc.property(
        heatmapStockItemArb.filter(item => item.changePercent >= 0),
        (stockItem) => {
          const tooltipHtml = generateTooltipContent(stockItem)
          expect(tooltipHtml).toContain('positive')
          expect(tooltipHtml).toMatch(/\+\d+\.\d+%/)
        }
      ),
      { numRuns: 5 }
    )
  })

  /**
   * Property: Tooltip should correctly format negative change
   * **Validates: Requirements 13.2**
   */
  it('should format negative change correctly', () => {
    fc.assert(
      fc.property(
        heatmapStockItemArb.filter(item => item.changePercent < 0),
        (stockItem) => {
          const tooltipHtml = generateTooltipContent(stockItem)
          expect(tooltipHtml).toContain('negative')
          expect(tooltipHtml).toMatch(/-\d+\.\d+%/)
        }
      ),
      { numRuns: 5 }
    )
  })

  /**
   * Property: Tooltip should format market cap with appropriate suffix (T/B/M)
   * **Validates: Requirements 13.2**
   */
  it('should format market cap with appropriate suffix', () => {
    // Test trillion formatting
    const trillionItem: HeatmapStockItem = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      price: 150,
      change: 2.5,
      changePercent: 1.5,
      marketCap: 2_500_000_000_000,
      sector: 'Technology',
    }
    expect(generateTooltipContent(trillionItem)).toContain('T')

    // Test billion formatting
    const billionItem: HeatmapStockItem = {
      symbol: 'MSFT',
      name: 'Microsoft',
      price: 300,
      change: -1.5,
      changePercent: -0.5,
      marketCap: 500_000_000_000,
      sector: 'Technology',
    }
    expect(generateTooltipContent(billionItem)).toContain('B')

    // Test million formatting
    const millionItem: HeatmapStockItem = {
      symbol: 'SMALL',
      name: 'Small Cap',
      price: 10,
      change: 0.5,
      changePercent: 5,
      marketCap: 50_000_000,
      sector: 'Healthcare',
    }
    expect(generateTooltipContent(millionItem)).toContain('M')
  })

  /**
   * Property: Tooltip should always include the stock symbol prominently
   * **Validates: Requirements 13.2**
   */
  it('should always include the stock symbol in tooltip-symbol class', () => {
    fc.assert(
      fc.property(heatmapStockItemArb, (stockItem) => {
        const tooltipHtml = generateTooltipContent(stockItem)
        expect(tooltipHtml).toContain('tooltip-symbol')
        expect(tooltipHtml).toContain(stockItem.symbol)
      }),
      { numRuns: 5 }
    )
  })

  /**
   * Property: Tooltip should have proper structure with header and body
   * **Validates: Requirements 13.2**
   */
  it('should have proper tooltip structure', () => {
    fc.assert(
      fc.property(heatmapStockItemArb, (stockItem) => {
        const tooltipHtml = generateTooltipContent(stockItem)
        expect(tooltipHtml).toContain('heatmap-tooltip')
        expect(tooltipHtml).toContain('tooltip-header')
        expect(tooltipHtml).toContain('tooltip-body')
        expect(tooltipHtml).toContain('tooltip-row')
        expect(tooltipHtml).toContain('tooltip-label')
        expect(tooltipHtml).toContain('tooltip-value')
      }),
      { numRuns: 5 }
    )
  })
})
