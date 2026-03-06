/**
 * Property-Based Tests for Sector Filter Operations
 * Feature: stock-detail-and-heatmap-enhancement
 *
 * **Property 15: 板块筛选正确性**
 * **Property 16: 多选筛选正确性**
 * **Validates: Requirements 14.2, 14.3, 14.4, 14.6**
 *
 * Property 15: For any selected sector list, filtered heatmap data
 * should only contain stocks belonging to the selected sectors.
 *
 * Property 16: For multiple selected sectors, the filter result
 * should be the union of stocks from those sectors.
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  filterBySectors,
  filterByIndustries,
  filterByMultipleCriteria,
} from './SectorFilter'

/**
 * Available sectors for testing
 */
const SECTORS = [
  'Technology',
  'Healthcare',
  'Financial Services',
  'Consumer Cyclical',
  'Communication Services',
  'Industrials',
  'Consumer Defensive',
  'Energy',
  'Basic Materials',
  'Real Estate',
  'Utilities',
]

/**
 * Available industries for testing
 */
const INDUSTRIES = [
  'Software',
  'Hardware',
  'Biotechnology',
  'Banks',
  'Insurance',
  'Retail',
  'Automotive',
  'Semiconductors',
  'Pharmaceuticals',
  'Oil & Gas',
]

/**
 * Stock item interface for testing
 */
interface TestStock {
  symbol: string
  sector: string
  industry: string | null
}

/**
 * Arbitrary generator for stock symbols
 */
const symbolArbitrary = fc.stringMatching(/^[A-Z]{1,5}$/)

/**
 * Arbitrary generator for sectors
 */
const sectorArbitrary = fc.constantFrom(...SECTORS)

/**
 * Arbitrary generator for industries (nullable)
 */
const industryArbitrary = fc.option(fc.constantFrom(...INDUSTRIES), { nil: null })

/**
 * Arbitrary generator for a test stock
 */
const stockArbitrary: fc.Arbitrary<TestStock> = fc.record({
  symbol: symbolArbitrary,
  sector: sectorArbitrary,
  industry: industryArbitrary,
})

/**
 * Arbitrary generator for an array of stocks
 */
const stocksArbitrary = fc.array(stockArbitrary, { minLength: 1, maxLength: 20 })

/**
 * Arbitrary generator for sector filter (subset of available sectors)
 */
const sectorFilterArbitrary = fc.subarray(SECTORS, { minLength: 0, maxLength: SECTORS.length })

/**
 * Arbitrary generator for industry filter (subset of available industries)
 */
const industryFilterArbitrary = fc.subarray(INDUSTRIES, { minLength: 0, maxLength: INDUSTRIES.length })

describe('Property 15: 板块筛选正确性', () => {
  /**
   * Property: All filtered items should belong to selected sectors
   * **Validates: Requirements 14.2**
   */
  it('should only return stocks from selected sectors', () => {
    fc.assert(
      fc.property(
        stocksArbitrary,
        sectorFilterArbitrary,
        (stocks, selectedSectors) => {
          const filtered = filterBySectors(stocks, selectedSectors)

          // If no sectors selected, should return all stocks
          if (selectedSectors.length === 0) {
            expect(filtered.length).toBe(stocks.length)
            return
          }

          // Every filtered stock's sector should be in selected sectors
          for (const stock of filtered) {
            expect(selectedSectors).toContain(stock.sector)
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: All filtered items should belong to selected industries
   * **Validates: Requirements 14.3**
   */
  it('should only return stocks from selected industries', () => {
    fc.assert(
      fc.property(
        stocksArbitrary,
        industryFilterArbitrary,
        (stocks, selectedIndustries) => {
          const filtered = filterByIndustries(stocks, selectedIndustries)

          // If no industries selected, should return all stocks
          if (selectedIndustries.length === 0) {
            expect(filtered.length).toBe(stocks.length)
            return
          }

          // Every filtered stock's industry should be in selected industries
          for (const stock of filtered) {
            expect(stock.industry).not.toBeNull()
            expect(selectedIndustries).toContain(stock.industry)
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: Empty filter should return all items
   * **Validates: Requirements 14.4**
   */
  it('should return all stocks when no filter is applied', () => {
    fc.assert(
      fc.property(
        stocksArbitrary,
        (stocks) => {
          const filteredBySectors = filterBySectors(stocks, [])
          const filteredByIndustries = filterByIndustries(stocks, [])
          const filteredByMultiple = filterByMultipleCriteria(stocks, [], [])

          expect(filteredBySectors.length).toBe(stocks.length)
          expect(filteredByIndustries.length).toBe(stocks.length)
          expect(filteredByMultiple.length).toBe(stocks.length)
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: Filtered result should be a subset of original items
   */
  it('should return a subset of original items', () => {
    fc.assert(
      fc.property(
        stocksArbitrary,
        sectorFilterArbitrary,
        (stocks, selectedSectors) => {
          const filtered = filterBySectors(stocks, selectedSectors)

          // Filtered count should be <= original count
          expect(filtered.length).toBeLessThanOrEqual(stocks.length)

          // Every filtered item should exist in original items
          const originalSymbols = new Set(stocks.map(s => s.symbol))
          for (const stock of filtered) {
            expect(originalSymbols.has(stock.symbol)).toBe(true)
          }
        }
      ),
      { numRuns: 10 }
    )
  })
})

describe('Property 16: 多选筛选正确性', () => {
  /**
   * Property: Multi-select sectors should return union of stocks
   * **Validates: Requirements 14.6**
   */
  it('should return union of stocks from multiple selected sectors', () => {
    fc.assert(
      fc.property(
        stocksArbitrary,
        sectorFilterArbitrary,
        (stocks, selectedSectors) => {
          // Skip if less than 2 sectors selected
          if (selectedSectors.length < 2) return

          const filtered = filterBySectors(stocks, selectedSectors)

          // Count stocks that match any of the selected sectors
          const expectedCount = stocks.filter(s => selectedSectors.includes(s.sector)).length

          expect(filtered.length).toBe(expectedCount)
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: Multi-criteria filter should return union when both sectors and industries selected
   * **Validates: Requirements 14.6**
   */
  it('should return union when filtering by both sectors and industries', () => {
    fc.assert(
      fc.property(
        stocksArbitrary,
        sectorFilterArbitrary,
        industryFilterArbitrary,
        (stocks, selectedSectors, selectedIndustries) => {
          const filtered = filterByMultipleCriteria(stocks, selectedSectors, selectedIndustries)

          // If no filters, return all
          if (selectedSectors.length === 0 && selectedIndustries.length === 0) {
            expect(filtered.length).toBe(stocks.length)
            return
          }

          // If only sectors selected
          if (selectedIndustries.length === 0) {
            const expected = stocks.filter(s => selectedSectors.includes(s.sector))
            expect(filtered.length).toBe(expected.length)
            return
          }

          // If only industries selected
          if (selectedSectors.length === 0) {
            const expected = stocks.filter(s => s.industry !== null && selectedIndustries.includes(s.industry))
            expect(filtered.length).toBe(expected.length)
            return
          }

          // Both selected - should be union (OR logic)
          for (const stock of filtered) {
            const matchesSector = selectedSectors.includes(stock.sector)
            const matchesIndustry = stock.industry !== null && selectedIndustries.includes(stock.industry)
            expect(matchesSector || matchesIndustry).toBe(true)
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: Adding more sectors to a non-empty filter should not decrease result count
   * Note: When selectedSectors is empty, all stocks are returned. Adding a sector
   * creates a filter that may return fewer stocks. This property only applies
   * when there's already at least one sector selected.
   */
  it('should not decrease result count when adding more sectors to existing filter', () => {
    fc.assert(
      fc.property(
        stocksArbitrary,
        sectorFilterArbitrary,
        sectorArbitrary,
        (stocks, selectedSectors, additionalSector) => {
          // Skip if no sectors initially selected (empty filter returns all)
          if (selectedSectors.length === 0) return
          // Skip if additional sector already in selection
          if (selectedSectors.includes(additionalSector)) return

          const filteredBefore = filterBySectors(stocks, selectedSectors)
          const filteredAfter = filterBySectors(stocks, [...selectedSectors, additionalSector])

          // Adding a sector to an existing filter should not decrease the count
          expect(filteredAfter.length).toBeGreaterThanOrEqual(filteredBefore.length)
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: Filter is idempotent - applying same filter twice gives same result
   */
  it('should be idempotent - applying filter twice gives same result', () => {
    fc.assert(
      fc.property(
        stocksArbitrary,
        sectorFilterArbitrary,
        (stocks, selectedSectors) => {
          const filteredOnce = filterBySectors(stocks, selectedSectors)
          const filteredTwice = filterBySectors(filteredOnce, selectedSectors)

          expect(filteredTwice.length).toBe(filteredOnce.length)
          expect(filteredTwice.map(s => s.symbol).sort()).toEqual(
            filteredOnce.map(s => s.symbol).sort()
          )
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: Order of sectors in filter should not affect result
   */
  it('should return same result regardless of sector order in filter', () => {
    fc.assert(
      fc.property(
        stocksArbitrary,
        sectorFilterArbitrary,
        (stocks, selectedSectors) => {
          if (selectedSectors.length < 2) return

          const filteredOriginal = filterBySectors(stocks, selectedSectors)
          const filteredReversed = filterBySectors(stocks, [...selectedSectors].reverse())

          expect(filteredReversed.length).toBe(filteredOriginal.length)
          expect(filteredReversed.map(s => s.symbol).sort()).toEqual(
            filteredOriginal.map(s => s.symbol).sort()
          )
        }
      ),
      { numRuns: 10 }
    )
  })
})
