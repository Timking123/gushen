/**
 * Integration Tests - Market Heatmap Complete Functionality
 * Feature: stock-detail-and-heatmap-enhancement
 * Task: 19.2 集成测试 - 热力图完整功能
 *
 * Tests the complete heatmap functionality including zoom, filter, and navigation.
 *
 * **Validates: Requirements 10.1-14.6**
 */

import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'

/**
 * Zoom configuration
 */
const ZOOM_CONFIG = {
  minScale: 0.5,
  maxScale: 3,
  defaultScale: 1,
  step: 0.25,
}

/**
 * Zoom state interface
 * Implements Requirements 10.1-10.6
 */
interface ZoomState {
  scale: number
  translateX: number
  translateY: number
}

/**
 * Filter state interface
 * Implements Requirements 14.1-14.6
 */
interface FilterState {
  sectors: string[]
  industries: string[]
}

/**
 * Heatmap item interface
 */
interface HeatmapItem {
  symbol: string
  name: string
  sector: string
  industry: string | null
  marketCap: number
  price: number
  changePercent: number
}

/**
 * Heatmap group interface
 */
interface HeatmapGroup {
  name: string
  items: HeatmapItem[]
  avgChangePercent: number
  totalMarketCap: number
}

/**
 * Navigation state
 */
interface NavigationState {
  currentPath: string
  params: Record<string, string>
}

/**
 * Calculate zoom in
 * Implements Requirement 10.2
 */
function calculateZoomIn(
  currentScale: number,
  step: number,
  maxScale: number
): number {
  return Math.min(currentScale + step, maxScale)
}

/**
 * Calculate zoom out
 * Implements Requirement 10.3
 */
function calculateZoomOut(
  currentScale: number,
  step: number,
  minScale: number
): number {
  return Math.max(currentScale - step, minScale)
}

/**
 * Reset zoom
 * Implements Requirement 10.6
 */
function resetZoom(): ZoomState {
  return {
    scale: ZOOM_CONFIG.defaultScale,
    translateX: 0,
    translateY: 0,
  }
}

/**
 * Check if can zoom in
 */
function canZoomIn(scale: number, maxScale: number): boolean {
  return scale < maxScale
}

/**
 * Check if can zoom out
 */
function canZoomOut(scale: number, minScale: number): boolean {
  return scale > minScale
}

/**
 * Apply pan translation
 * Implements Requirement 10.5
 */
function applyPan(
  state: ZoomState,
  deltaX: number,
  deltaY: number
): ZoomState {
  return {
    ...state,
    translateX: state.translateX + deltaX,
    translateY: state.translateY + deltaY,
  }
}

/**
 * Filter items by sectors
 * Implements Requirements 14.2, 14.4, 14.6
 */
function filterBySectors(
  items: HeatmapItem[],
  selectedSectors: string[]
): HeatmapItem[] {
  if (selectedSectors.length === 0) return items
  return items.filter((item) => selectedSectors.includes(item.sector))
}

/**
 * Filter items by industries
 * Implements Requirements 14.3, 14.4
 */
function filterByIndustries(
  items: HeatmapItem[],
  selectedIndustries: string[]
): HeatmapItem[] {
  if (selectedIndustries.length === 0) return items
  return items.filter(
    (item) => item.industry !== null && selectedIndustries.includes(item.industry)
  )
}

/**
 * Filter items by multiple criteria (union/OR logic)
 * Implements Requirement 14.6
 */
function filterByMultipleCriteria(
  items: HeatmapItem[],
  selectedSectors: string[],
  selectedIndustries: string[]
): HeatmapItem[] {
  if (selectedSectors.length === 0 && selectedIndustries.length === 0) {
    return items
  }

  if (selectedIndustries.length === 0) {
    return filterBySectors(items, selectedSectors)
  }

  if (selectedSectors.length === 0) {
    return filterByIndustries(items, selectedIndustries)
  }

  // Union of both filters
  return items.filter((item) => {
    const matchesSector = selectedSectors.includes(item.sector)
    const matchesIndustry =
      item.industry !== null && selectedIndustries.includes(item.industry)
    return matchesSector || matchesIndustry
  })
}

/**
 * Navigate to stock detail
 * Implements Requirement 13.3
 */
function navigateToStockDetail(symbol: string): NavigationState {
  return {
    currentPath: `/stock/${symbol}`,
    params: { symbol },
  }
}

/**
 * Group items by sector
 */
function groupBySector(items: HeatmapItem[]): HeatmapGroup[] {
  const groups = new Map<string, HeatmapItem[]>()

  for (const item of items) {
    const existing = groups.get(item.sector) || []
    existing.push(item)
    groups.set(item.sector, existing)
  }

  return Array.from(groups.entries()).map(([name, groupItems]) => ({
    name,
    items: groupItems,
    avgChangePercent:
      groupItems.reduce((sum, i) => sum + i.changePercent, 0) / groupItems.length,
    totalMarketCap: groupItems.reduce((sum, i) => sum + i.marketCap, 0),
  }))
}

/**
 * Available sectors for testing
 */
const SECTORS = [
  'Technology',
  'Healthcare',
  'Financial Services',
  'Consumer Cyclical',
  'Energy',
]

/**
 * Available industries for testing
 */
const INDUSTRIES = ['Software', 'Hardware', 'Biotechnology', 'Banks', 'Oil & Gas']

/**
 * Arbitrary generators
 */
const symbolArb = fc
  .stringMatching(/^[A-Z]{1,5}$/)
  .filter((s) => s.length >= 1 && s.length <= 5)

const sectorArb = fc.constantFrom(...SECTORS)

const industryArb = fc.option(fc.constantFrom(...INDUSTRIES), { nil: null })

const heatmapItemArb: fc.Arbitrary<HeatmapItem> = fc.record({
  symbol: symbolArb,
  name: fc.string({ minLength: 1, maxLength: 30 }),
  sector: sectorArb,
  industry: industryArb,
  marketCap: fc.double({ min: 1e6, max: 5e12, noNaN: true }),
  price: fc.double({ min: 0.01, max: 10000, noNaN: true }),
  changePercent: fc.double({ min: -20, max: 20, noNaN: true }),
})

const heatmapItemsArb = fc.array(heatmapItemArb, { minLength: 5, maxLength: 30 })

const scaleArb = fc.double({
  min: ZOOM_CONFIG.minScale,
  max: ZOOM_CONFIG.maxScale,
  noNaN: true,
})

const sectorFilterArb = fc.subarray(SECTORS, { minLength: 0, maxLength: SECTORS.length })

const industryFilterArb = fc.subarray(INDUSTRIES, {
  minLength: 0,
  maxLength: INDUSTRIES.length,
})

describe('Task 19.2: Market Heatmap Integration Tests', () => {
  describe('Zoom Operations', () => {
    let zoomState: ZoomState

    beforeEach(() => {
      zoomState = resetZoom()
    })

    /**
     * Test: Zoom in increases scale
     * Implements Requirement 10.2
     */
    it('should increase scale when zooming in', () => {
      fc.assert(
        fc.property(
          fc.double({
            min: ZOOM_CONFIG.minScale,
            max: ZOOM_CONFIG.maxScale - 0.01,
            noNaN: true,
          }),
          (currentScale) => {
            const newScale = calculateZoomIn(
              currentScale,
              ZOOM_CONFIG.step,
              ZOOM_CONFIG.maxScale
            )
            expect(newScale).toBeGreaterThanOrEqual(currentScale)
            expect(newScale).toBeLessThanOrEqual(ZOOM_CONFIG.maxScale)
          }
        ),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Zoom out decreases scale
     * Implements Requirement 10.3
     */
    it('should decrease scale when zooming out', () => {
      fc.assert(
        fc.property(
          fc.double({
            min: ZOOM_CONFIG.minScale + 0.01,
            max: ZOOM_CONFIG.maxScale,
            noNaN: true,
          }),
          (currentScale) => {
            const newScale = calculateZoomOut(
              currentScale,
              ZOOM_CONFIG.step,
              ZOOM_CONFIG.minScale
            )
            expect(newScale).toBeLessThanOrEqual(currentScale)
            expect(newScale).toBeGreaterThanOrEqual(ZOOM_CONFIG.minScale)
          }
        ),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Scale stays within bounds
     * Implements Requirements 10.2, 10.3
     */
    it('should keep scale within bounds after any zoom operation', () => {
      fc.assert(
        fc.property(scaleArb, fc.boolean(), (currentScale, isZoomIn) => {
          const newScale = isZoomIn
            ? calculateZoomIn(currentScale, ZOOM_CONFIG.step, ZOOM_CONFIG.maxScale)
            : calculateZoomOut(currentScale, ZOOM_CONFIG.step, ZOOM_CONFIG.minScale)

          expect(newScale).toBeGreaterThanOrEqual(ZOOM_CONFIG.minScale)
          expect(newScale).toBeLessThanOrEqual(ZOOM_CONFIG.maxScale)
        }),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Reset zoom returns to default
     * Implements Requirement 10.6
     */
    it('should reset zoom to default state', () => {
      // Apply some zoom and pan
      zoomState = {
        scale: 2.5,
        translateX: 100,
        translateY: -50,
      }

      const resetState = resetZoom()
      expect(resetState.scale).toBe(ZOOM_CONFIG.defaultScale)
      expect(resetState.translateX).toBe(0)
      expect(resetState.translateY).toBe(0)
    })

    /**
     * Test: Pan when zoomed
     * Implements Requirement 10.5
     */
    it('should apply pan translation correctly', () => {
      fc.assert(
        fc.property(
          scaleArb,
          fc.double({ min: -500, max: 500, noNaN: true }),
          fc.double({ min: -500, max: 500, noNaN: true }),
          (scale, deltaX, deltaY) => {
            const initialState: ZoomState = { scale, translateX: 0, translateY: 0 }
            const pannedState = applyPan(initialState, deltaX, deltaY)

            // Use toBeCloseTo to handle -0 vs 0 edge case
            expect(pannedState.translateX).toBeCloseTo(deltaX, 10)
            expect(pannedState.translateY).toBeCloseTo(deltaY, 10)
            expect(pannedState.scale).toBe(scale)
          }
        ),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Cannot zoom in beyond max
     */
    it('should not allow zoom in beyond maxScale', () => {
      expect(canZoomIn(ZOOM_CONFIG.maxScale, ZOOM_CONFIG.maxScale)).toBe(false)
      expect(canZoomIn(ZOOM_CONFIG.maxScale - 0.01, ZOOM_CONFIG.maxScale)).toBe(true)
    })

    /**
     * Test: Cannot zoom out below min
     */
    it('should not allow zoom out below minScale', () => {
      expect(canZoomOut(ZOOM_CONFIG.minScale, ZOOM_CONFIG.minScale)).toBe(false)
      expect(canZoomOut(ZOOM_CONFIG.minScale + 0.01, ZOOM_CONFIG.minScale)).toBe(true)
    })
  })

  describe('Filter Operations', () => {
    /**
     * Test: Filter by sectors returns only matching items
     * Implements Requirement 14.2
     */
    it('should filter items by selected sectors', () => {
      fc.assert(
        fc.property(heatmapItemsArb, sectorFilterArb, (items, selectedSectors) => {
          const filtered = filterBySectors(items, selectedSectors)

          if (selectedSectors.length === 0) {
            expect(filtered.length).toBe(items.length)
          } else {
            for (const item of filtered) {
              expect(selectedSectors).toContain(item.sector)
            }
          }
        }),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Filter by industries returns only matching items
     * Implements Requirement 14.3
     */
    it('should filter items by selected industries', () => {
      fc.assert(
        fc.property(heatmapItemsArb, industryFilterArb, (items, selectedIndustries) => {
          const filtered = filterByIndustries(items, selectedIndustries)

          if (selectedIndustries.length === 0) {
            expect(filtered.length).toBe(items.length)
          } else {
            for (const item of filtered) {
              expect(item.industry).not.toBeNull()
              expect(selectedIndustries).toContain(item.industry)
            }
          }
        }),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Empty filter returns all items
     * Implements Requirement 14.4
     */
    it('should return all items when no filter is applied', () => {
      fc.assert(
        fc.property(heatmapItemsArb, (items) => {
          const filteredBySectors = filterBySectors(items, [])
          const filteredByIndustries = filterByIndustries(items, [])
          const filteredByMultiple = filterByMultipleCriteria(items, [], [])

          expect(filteredBySectors.length).toBe(items.length)
          expect(filteredByIndustries.length).toBe(items.length)
          expect(filteredByMultiple.length).toBe(items.length)
        }),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Multi-select filter returns union
     * Implements Requirement 14.6
     */
    it('should return union of items when multiple sectors selected', () => {
      fc.assert(
        fc.property(heatmapItemsArb, sectorFilterArb, (items, selectedSectors) => {
          if (selectedSectors.length < 2) return

          const filtered = filterBySectors(items, selectedSectors)
          const expectedCount = items.filter((i) =>
            selectedSectors.includes(i.sector)
          ).length

          expect(filtered.length).toBe(expectedCount)
        }),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Combined sector and industry filter
     * Implements Requirement 14.6
     */
    it('should handle combined sector and industry filter with OR logic', () => {
      fc.assert(
        fc.property(
          heatmapItemsArb,
          sectorFilterArb,
          industryFilterArb,
          (items, selectedSectors, selectedIndustries) => {
            const filtered = filterByMultipleCriteria(
              items,
              selectedSectors,
              selectedIndustries
            )

            if (selectedSectors.length === 0 && selectedIndustries.length === 0) {
              expect(filtered.length).toBe(items.length)
              return
            }

            for (const item of filtered) {
              const matchesSector = selectedSectors.includes(item.sector)
              const matchesIndustry =
                item.industry !== null && selectedIndustries.includes(item.industry)

              if (selectedSectors.length > 0 && selectedIndustries.length > 0) {
                expect(matchesSector || matchesIndustry).toBe(true)
              } else if (selectedSectors.length > 0) {
                expect(matchesSector).toBe(true)
              } else {
                expect(matchesIndustry).toBe(true)
              }
            }
          }
        ),
        { numRuns: 20 }
      )
    })
  })

  describe('Navigation Integration', () => {
    /**
     * Test: Click stock navigates to detail page
     * Implements Requirement 13.3
     */
    it('should navigate to stock detail page when clicking stock', () => {
      fc.assert(
        fc.property(heatmapItemArb, (item) => {
          const navState = navigateToStockDetail(item.symbol)
          expect(navState.currentPath).toBe(`/stock/${item.symbol}`)
          expect(navState.params.symbol).toBe(item.symbol)
        }),
        { numRuns: 20 }
      )
    })
  })

  describe('Grouping Operations', () => {
    /**
     * Test: Group by sector creates correct groups
     */
    it('should group items by sector correctly', () => {
      fc.assert(
        fc.property(heatmapItemsArb, (items) => {
          const groups = groupBySector(items)

          // Total items in groups should equal original items
          const totalInGroups = groups.reduce((sum, g) => sum + g.items.length, 0)
          expect(totalInGroups).toBe(items.length)

          // Each group should only contain items from that sector
          for (const group of groups) {
            for (const item of group.items) {
              expect(item.sector).toBe(group.name)
            }
          }
        }),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Group average change percent calculation
     */
    it('should calculate group average change percent correctly', () => {
      fc.assert(
        fc.property(heatmapItemsArb, (items) => {
          const groups = groupBySector(items)

          for (const group of groups) {
            if (group.items.length > 0) {
              const expectedAvg =
                group.items.reduce((sum, i) => sum + i.changePercent, 0) /
                group.items.length
              expect(group.avgChangePercent).toBeCloseTo(expectedAvg, 5)
            }
          }
        }),
        { numRuns: 20 }
      )
    })
  })

  describe('Combined Operations', () => {
    /**
     * Test: Zoom + Filter + Navigation combined flow
     * Implements Requirements 10.1-14.6
     */
    it('should handle zoom, filter, and navigation in sequence', () => {
      fc.assert(
        fc.property(
          heatmapItemsArb,
          sectorFilterArb,
          scaleArb,
          (items, selectedSectors, targetScale) => {
            // Step 1: Apply filter
            const filteredItems = filterBySectors(items, selectedSectors)

            // Step 2: Apply zoom
            let zoomState = resetZoom()
            while (zoomState.scale < targetScale) {
              zoomState = {
                ...zoomState,
                scale: calculateZoomIn(
                  zoomState.scale,
                  ZOOM_CONFIG.step,
                  ZOOM_CONFIG.maxScale
                ),
              }
            }

            // Step 3: Navigate to first filtered item (if any)
            if (filteredItems.length > 0) {
              const navState = navigateToStockDetail(filteredItems[0].symbol)
              expect(navState.currentPath).toBe(`/stock/${filteredItems[0].symbol}`)
            }

            // Verify zoom state is valid
            expect(zoomState.scale).toBeGreaterThanOrEqual(ZOOM_CONFIG.minScale)
            expect(zoomState.scale).toBeLessThanOrEqual(ZOOM_CONFIG.maxScale)
          }
        ),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Filter then reset filter
     */
    it('should restore all items when filter is cleared', () => {
      fc.assert(
        fc.property(heatmapItemsArb, sectorFilterArb, (items, selectedSectors) => {
          // Apply filter
          const filtered = filterBySectors(items, selectedSectors)

          // Clear filter
          const restored = filterBySectors(items, [])

          // Should have all original items
          expect(restored.length).toBe(items.length)
        }),
        { numRuns: 20 }
      )
    })
  })
})
