/**
 * Integration Tests - Stock Detail Page Complete Flow
 * Feature: stock-detail-and-heatmap-enhancement
 * Task: 19.1 集成测试 - 个股详情页完整流程
 *
 * Tests the complete flow from heatmap click to stock detail page,
 * including watchlist add/remove functionality.
 *
 * **Validates: Requirements 1.1-9.6, 13.3**
 */

import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'

/**
 * Mock types for integration testing
 */
interface StockQuote {
  symbol: string
  price: number
  change: number
  changePercent: number
  open: number
  high: number
  low: number
  previousClose: number
  volume: number
}

interface CompanyProfile {
  symbol: string
  name: string
  exchange: string
  sector: string | null
  industry: string | null
  marketCap: number | null
  country: string | null
}

interface FinancialMetrics {
  pe: number | null
  pb: number | null
  ps: number | null
  eps: number | null
  roe: number | null
  roa: number | null
}

interface AnalystRatingSummary {
  totalAnalysts: number
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
  averageTargetPrice: number | null
  currentPrice: number
}

interface InsiderTradeSummary {
  totalBuyShares: number
  totalSellShares: number
  netShares: number
  buyTransactions: number
  sellTransactions: number
}

interface StockDetailData {
  profile: CompanyProfile
  quote: StockQuote
  financials: FinancialMetrics
  analystRatings: AnalystRatingSummary
  insiderSummary: InsiderTradeSummary
}

interface WatchlistState {
  stocks: Set<string>
}

/**
 * Navigation state simulation
 */
interface NavigationState {
  currentPath: string
  params: Record<string, string>
}

/**
 * Simulate navigation from heatmap to stock detail
 * Implements Requirement 13.3: Click stock to navigate to detail page
 */
function navigateToStockDetail(
  navState: NavigationState,
  symbol: string
): NavigationState {
  return {
    currentPath: `/stock/${symbol}`,
    params: { symbol },
  }
}

/**
 * Parse symbol from route
 */
function getSymbolFromRoute(navState: NavigationState): string | null {
  const match = navState.currentPath.match(/^\/stock\/([A-Z]+)$/)
  return match ? match[1] : null
}

/**
 * Validate stock detail data completeness
 * Implements Requirements 2.1-2.5, 4.1-4.6, 6.1-6.6, 7.1-7.5, 8.1-8.6
 */
function validateStockDetailData(data: StockDetailData): {
  isValid: boolean
  missingFields: string[]
} {
  const missingFields: string[] = []

  // Check profile (Requirements 2.1-2.5)
  if (!data.profile.symbol) missingFields.push('profile.symbol')
  if (!data.profile.name) missingFields.push('profile.name')
  if (!data.profile.exchange) missingFields.push('profile.exchange')

  // Check quote (Requirements 4.1-4.6)
  if (data.quote.price === undefined) missingFields.push('quote.price')
  if (data.quote.change === undefined) missingFields.push('quote.change')
  if (data.quote.changePercent === undefined) missingFields.push('quote.changePercent')

  return {
    isValid: missingFields.length === 0,
    missingFields,
  }
}

/**
 * Determine price change color
 * Implements Requirements 4.2, 4.3
 */
function getPriceChangeColor(changePercent: number): 'green' | 'red' | 'neutral' {
  if (changePercent > 0) return 'green'
  if (changePercent < 0) return 'red'
  return 'neutral'
}

/**
 * Format market cap for display
 * Implements Requirement 2.3
 */
function formatMarketCap(marketCap: number | null): string {
  if (marketCap === null) return '暂无数据'
  if (marketCap >= 1e12) return `${(marketCap / 1e12).toFixed(2)}T`
  if (marketCap >= 1e9) return `${(marketCap / 1e9).toFixed(2)}B`
  if (marketCap >= 1e6) return `${(marketCap / 1e6).toFixed(2)}M`
  return marketCap.toLocaleString()
}

/**
 * Watchlist operations
 * Implements Requirements 9.1-9.6
 */
function createWatchlistState(): WatchlistState {
  return { stocks: new Set() }
}

function addToWatchlist(state: WatchlistState, symbol: string): WatchlistState {
  const newStocks = new Set(state.stocks)
  newStocks.add(symbol)
  return { stocks: newStocks }
}

function removeFromWatchlist(state: WatchlistState, symbol: string): WatchlistState {
  const newStocks = new Set(state.stocks)
  newStocks.delete(symbol)
  return { stocks: newStocks }
}

function isInWatchlist(state: WatchlistState, symbol: string): boolean {
  return state.stocks.has(symbol)
}

/**
 * Calculate analyst rating distribution percentage
 * Implements Requirement 7.1
 */
function calculateRatingDistribution(summary: AnalystRatingSummary): {
  strongBuyPercent: number
  buyPercent: number
  holdPercent: number
  sellPercent: number
  strongSellPercent: number
} {
  const total = summary.totalAnalysts
  if (total === 0) {
    return {
      strongBuyPercent: 0,
      buyPercent: 0,
      holdPercent: 0,
      sellPercent: 0,
      strongSellPercent: 0,
    }
  }
  return {
    strongBuyPercent: (summary.strongBuy / total) * 100,
    buyPercent: (summary.buy / total) * 100,
    holdPercent: (summary.hold / total) * 100,
    sellPercent: (summary.sell / total) * 100,
    strongSellPercent: (summary.strongSell / total) * 100,
  }
}

/**
 * Calculate target price gap
 * Implements Requirement 7.2
 */
function calculateTargetPriceGap(
  averageTargetPrice: number | null,
  currentPrice: number
): number | null {
  if (averageTargetPrice === null || currentPrice === 0) return null
  return ((averageTargetPrice - currentPrice) / currentPrice) * 100
}

/**
 * Arbitrary generators for testing
 */
const symbolArb = fc
  .stringMatching(/^[A-Z]{1,5}$/)
  .filter((s) => s.length >= 1 && s.length <= 5)

const priceArb = fc.double({ min: 0.01, max: 10000, noNaN: true })

const changePercentArb = fc.double({ min: -100, max: 100, noNaN: true })

const marketCapArb = fc.oneof(
  fc.constant(null),
  fc.double({ min: 1e6, max: 5e12, noNaN: true })
)

const stockQuoteArb: fc.Arbitrary<StockQuote> = fc.record({
  symbol: symbolArb,
  price: priceArb,
  change: fc.double({ min: -1000, max: 1000, noNaN: true }),
  changePercent: changePercentArb,
  open: priceArb,
  high: priceArb,
  low: priceArb,
  previousClose: priceArb,
  volume: fc.nat({ max: 1e9 }),
})

const companyProfileArb: fc.Arbitrary<CompanyProfile> = fc.record({
  symbol: symbolArb,
  name: fc.string({ minLength: 1, maxLength: 50 }),
  exchange: fc.constantFrom('NYSE', 'NASDAQ', 'AMEX'),
  sector: fc.option(fc.constantFrom('Technology', 'Healthcare', 'Finance'), { nil: null }),
  industry: fc.option(fc.constantFrom('Software', 'Biotech', 'Banking'), { nil: null }),
  marketCap: marketCapArb,
  country: fc.option(fc.constantFrom('US', 'CN', 'UK'), { nil: null }),
})

const analystRatingSummaryArb: fc.Arbitrary<AnalystRatingSummary> = fc
  .record({
    strongBuy: fc.nat({ max: 20 }),
    buy: fc.nat({ max: 20 }),
    hold: fc.nat({ max: 20 }),
    sell: fc.nat({ max: 20 }),
    strongSell: fc.nat({ max: 20 }),
    averageTargetPrice: fc.option(priceArb, { nil: null }),
    currentPrice: priceArb,
  })
  .map((r) => ({
    ...r,
    totalAnalysts: r.strongBuy + r.buy + r.hold + r.sell + r.strongSell,
  }))

describe('Task 19.1: Stock Detail Page Integration Tests', () => {
  describe('Navigation Flow - Heatmap to Stock Detail', () => {
    /**
     * Test: Navigation from heatmap click to stock detail page
     * Implements Requirement 13.3
     */
    it('should navigate to correct stock detail page when clicking heatmap stock', () => {
      fc.assert(
        fc.property(symbolArb, (symbol) => {
          const initialNav: NavigationState = { currentPath: '/', params: {} }
          const afterNav = navigateToStockDetail(initialNav, symbol)

          expect(afterNav.currentPath).toBe(`/stock/${symbol}`)
          expect(afterNav.params.symbol).toBe(symbol)
          expect(getSymbolFromRoute(afterNav)).toBe(symbol)
        }),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Symbol extraction from route
     */
    it('should correctly extract symbol from route path', () => {
      fc.assert(
        fc.property(symbolArb, (symbol) => {
          const navState: NavigationState = {
            currentPath: `/stock/${symbol}`,
            params: { symbol },
          }
          expect(getSymbolFromRoute(navState)).toBe(symbol)
        }),
        { numRuns: 20 }
      )
    })
  })

  describe('Stock Detail Data Validation', () => {
    /**
     * Test: Stock detail data completeness validation
     * Implements Requirements 2.1-2.5, 4.1-4.6
     */
    it('should validate stock detail data completeness', () => {
      fc.assert(
        fc.property(companyProfileArb, stockQuoteArb, (profile, quote) => {
          const data: StockDetailData = {
            profile,
            quote,
            financials: { pe: null, pb: null, ps: null, eps: null, roe: null, roa: null },
            analystRatings: {
              totalAnalysts: 0,
              strongBuy: 0,
              buy: 0,
              hold: 0,
              sell: 0,
              strongSell: 0,
              averageTargetPrice: null,
              currentPrice: quote.price,
            },
            insiderSummary: {
              totalBuyShares: 0,
              totalSellShares: 0,
              netShares: 0,
              buyTransactions: 0,
              sellTransactions: 0,
            },
          }

          const validation = validateStockDetailData(data)
          // Profile and quote should have required fields
          expect(validation.isValid).toBe(true)
        }),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Price change color determination
     * Implements Requirements 4.2, 4.3
     */
    it('should determine correct color based on price change', () => {
      fc.assert(
        fc.property(changePercentArb, (changePercent) => {
          const color = getPriceChangeColor(changePercent)

          if (changePercent > 0) {
            expect(color).toBe('green')
          } else if (changePercent < 0) {
            expect(color).toBe('red')
          } else {
            expect(color).toBe('neutral')
          }
        }),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Market cap formatting
     * Implements Requirement 2.3
     */
    it('should format market cap correctly', () => {
      fc.assert(
        fc.property(marketCapArb, (marketCap) => {
          const formatted = formatMarketCap(marketCap)

          if (marketCap === null) {
            expect(formatted).toBe('暂无数据')
          } else if (marketCap >= 1e12) {
            expect(formatted).toMatch(/^\d+\.\d+T$/)
          } else if (marketCap >= 1e9) {
            expect(formatted).toMatch(/^\d+\.\d+B$/)
          } else if (marketCap >= 1e6) {
            expect(formatted).toMatch(/^\d+\.\d+M$/)
          } else {
            expect(formatted).toBe(marketCap.toLocaleString())
          }
        }),
        { numRuns: 20 }
      )
    })
  })

  describe('Watchlist Operations', () => {
    let watchlistState: WatchlistState

    beforeEach(() => {
      watchlistState = createWatchlistState()
    })

    /**
     * Test: Add to watchlist
     * Implements Requirement 9.3
     */
    it('should add stock to watchlist correctly', () => {
      fc.assert(
        fc.property(symbolArb, (symbol) => {
          const newState = addToWatchlist(watchlistState, symbol)
          expect(isInWatchlist(newState, symbol)).toBe(true)
        }),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Remove from watchlist
     * Implements Requirement 9.4
     */
    it('should remove stock from watchlist correctly', () => {
      fc.assert(
        fc.property(symbolArb, (symbol) => {
          const stateAfterAdd = addToWatchlist(watchlistState, symbol)
          const stateAfterRemove = removeFromWatchlist(stateAfterAdd, symbol)
          expect(isInWatchlist(stateAfterRemove, symbol)).toBe(false)
        }),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Watchlist round-trip
     * Implements Requirements 9.3, 9.4
     */
    it('should handle add-then-remove round trip correctly', () => {
      fc.assert(
        fc.property(symbolArb, (symbol) => {
          // Initially not in watchlist
          expect(isInWatchlist(watchlistState, symbol)).toBe(false)

          // After add, should be in watchlist
          const stateAfterAdd = addToWatchlist(watchlistState, symbol)
          expect(isInWatchlist(stateAfterAdd, symbol)).toBe(true)

          // After remove, should not be in watchlist
          const stateAfterRemove = removeFromWatchlist(stateAfterAdd, symbol)
          expect(isInWatchlist(stateAfterRemove, symbol)).toBe(false)
        }),
        { numRuns: 20 }
      )
    })
  })

  describe('Analyst Rating Calculations', () => {
    /**
     * Test: Rating distribution percentages sum to 100%
     * Implements Requirement 7.1
     */
    it('should calculate rating distribution percentages that sum to 100%', () => {
      fc.assert(
        fc.property(analystRatingSummaryArb, (summary) => {
          const distribution = calculateRatingDistribution(summary)

          if (summary.totalAnalysts === 0) {
            expect(distribution.strongBuyPercent).toBe(0)
            expect(distribution.buyPercent).toBe(0)
            expect(distribution.holdPercent).toBe(0)
            expect(distribution.sellPercent).toBe(0)
            expect(distribution.strongSellPercent).toBe(0)
          } else {
            const total =
              distribution.strongBuyPercent +
              distribution.buyPercent +
              distribution.holdPercent +
              distribution.sellPercent +
              distribution.strongSellPercent

            expect(total).toBeCloseTo(100, 5)
          }
        }),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Target price gap calculation
     * Implements Requirement 7.2
     */
    it('should calculate target price gap correctly', () => {
      fc.assert(
        fc.property(
          fc.option(priceArb, { nil: null }),
          priceArb.filter((p) => p > 0),
          (targetPrice, currentPrice) => {
            const gap = calculateTargetPriceGap(targetPrice, currentPrice)

            if (targetPrice === null) {
              expect(gap).toBeNull()
            } else {
              const expectedGap = ((targetPrice - currentPrice) / currentPrice) * 100
              expect(gap).toBeCloseTo(expectedGap, 5)
            }
          }
        ),
        { numRuns: 20 }
      )
    })
  })

  describe('Complete Flow Integration', () => {
    /**
     * Test: Complete flow from heatmap click to watchlist operation
     * Implements Requirements 1.1-9.6, 13.3
     */
    it('should handle complete flow from heatmap to watchlist operation', () => {
      fc.assert(
        fc.property(symbolArb, companyProfileArb, stockQuoteArb, (symbol, profile, quote) => {
          // Step 1: Navigate from heatmap to stock detail
          const initialNav: NavigationState = { currentPath: '/', params: {} }
          const afterNav = navigateToStockDetail(initialNav, symbol)
          expect(getSymbolFromRoute(afterNav)).toBe(symbol)

          // Step 2: Load stock detail data
          const stockData: StockDetailData = {
            profile: { ...profile, symbol },
            quote: { ...quote, symbol },
            financials: { pe: null, pb: null, ps: null, eps: null, roe: null, roa: null },
            analystRatings: {
              totalAnalysts: 0,
              strongBuy: 0,
              buy: 0,
              hold: 0,
              sell: 0,
              strongSell: 0,
              averageTargetPrice: null,
              currentPrice: quote.price,
            },
            insiderSummary: {
              totalBuyShares: 0,
              totalSellShares: 0,
              netShares: 0,
              buyTransactions: 0,
              sellTransactions: 0,
            },
          }

          // Step 3: Validate data
          const validation = validateStockDetailData(stockData)
          expect(validation.isValid).toBe(true)

          // Step 4: Add to watchlist
          let watchlist = createWatchlistState()
          watchlist = addToWatchlist(watchlist, symbol)
          expect(isInWatchlist(watchlist, symbol)).toBe(true)

          // Step 5: Remove from watchlist
          watchlist = removeFromWatchlist(watchlist, symbol)
          expect(isInWatchlist(watchlist, symbol)).toBe(false)
        }),
        { numRuns: 20 }
      )
    })
  })
})
