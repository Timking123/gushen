/**
 * Property-Based Tests for Zoom Operations
 * Feature: stock-detail-and-heatmap-enhancement
 *
 * **Property 12: 缩放操作正确性**
 * **Validates: Requirements 10.2, 10.3**
 *
 * Property: For any current zoom scale, clicking the zoom in button should
 * increase the scale (not exceeding maxScale), and clicking the zoom out
 * button should decrease the scale (not going below minScale).
 *
 * Requirements:
 * - 10.2: 点击放大按钮放大热力图显示比例
 * - 10.3: 点击缩小按钮缩小热力图显示比例
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  calculateZoomIn,
  calculateZoomOut,
  canZoomIn,
  canZoomOut,
  DEFAULT_ZOOM_CONFIG,
} from './ZoomController'

describe('Property 12: 缩放操作正确性', () => {
  const { minScale, maxScale, step } = DEFAULT_ZOOM_CONFIG

  /**
   * Property: Zoom in should increase scale (not exceeding maxScale)
   * **Validates: Requirements 10.2**
   */
  it('should increase scale when zooming in (not exceeding maxScale)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: minScale, max: maxScale - 0.01, noNaN: true }),
        (currentScale) => {
          const newScale = calculateZoomIn(currentScale, step, maxScale)
          // New scale should be greater than or equal to current scale
          expect(newScale).toBeGreaterThanOrEqual(currentScale)
          // New scale should not exceed maxScale
          expect(newScale).toBeLessThanOrEqual(maxScale)
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: Zoom out should decrease scale (not going below minScale)
   * **Validates: Requirements 10.3**
   */
  it('should decrease scale when zooming out (not going below minScale)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: minScale + 0.01, max: maxScale, noNaN: true }),
        (currentScale) => {
          const newScale = calculateZoomOut(currentScale, step, minScale)
          // New scale should be less than or equal to current scale
          expect(newScale).toBeLessThanOrEqual(currentScale)
          // New scale should not go below minScale
          expect(newScale).toBeGreaterThanOrEqual(minScale)
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: Scale should always stay within bounds after any zoom operation
   * **Validates: Requirements 10.2, 10.3**
   */
  it('should keep scale within bounds after any zoom operation', () => {
    fc.assert(
      fc.property(
        fc.double({ min: minScale, max: maxScale, noNaN: true }),
        fc.boolean(),
        (currentScale, isZoomIn) => {
          const newScale = isZoomIn
            ? calculateZoomIn(currentScale, step, maxScale)
            : calculateZoomOut(currentScale, step, minScale)

          expect(newScale).toBeGreaterThanOrEqual(minScale)
          expect(newScale).toBeLessThanOrEqual(maxScale)
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: canZoomIn should return false when at maxScale
   * **Validates: Requirements 10.2**
   */
  it('should not allow zoom in when at maxScale', () => {
    expect(canZoomIn(maxScale, maxScale)).toBe(false)
  })

  /**
   * Property: canZoomOut should return false when at minScale
   * **Validates: Requirements 10.3**
   */
  it('should not allow zoom out when at minScale', () => {
    expect(canZoomOut(minScale, minScale)).toBe(false)
  })

  /**
   * Property: canZoomIn should return true when below maxScale
   * **Validates: Requirements 10.2**
   */
  it('should allow zoom in when below maxScale', () => {
    fc.assert(
      fc.property(
        fc.double({ min: minScale, max: maxScale - 0.01, noNaN: true }),
        (currentScale) => {
          expect(canZoomIn(currentScale, maxScale)).toBe(true)
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: canZoomOut should return true when above minScale
   * **Validates: Requirements 10.3**
   */
  it('should allow zoom out when above minScale', () => {
    fc.assert(
      fc.property(
        fc.double({ min: minScale + 0.01, max: maxScale, noNaN: true }),
        (currentScale) => {
          expect(canZoomOut(currentScale, minScale)).toBe(true)
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property: Zoom operations should be deterministic
   * **Validates: Requirements 10.2, 10.3**
   */
  it('should return consistent results for the same input', () => {
    fc.assert(
      fc.property(
        fc.double({ min: minScale, max: maxScale, noNaN: true }),
        (currentScale) => {
          const zoomIn1 = calculateZoomIn(currentScale, step, maxScale)
          const zoomIn2 = calculateZoomIn(currentScale, step, maxScale)
          const zoomOut1 = calculateZoomOut(currentScale, step, minScale)
          const zoomOut2 = calculateZoomOut(currentScale, step, minScale)

          expect(zoomIn1).toBe(zoomIn2)
          expect(zoomOut1).toBe(zoomOut2)
        }
      ),
      { numRuns: 10 }
    )
  })
})
