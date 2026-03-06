import './ZoomController.css'

/**
 * ZoomController Props Interface
 * As defined in the design document
 */
export interface ZoomControllerProps {
  scale: number
  minScale: number
  maxScale: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  className?: string
}

/**
 * Default zoom configuration
 */
export const DEFAULT_ZOOM_CONFIG = {
  minScale: 0.5,
  maxScale: 3,
  step: 0.25,
  defaultScale: 1,
}

/**
 * Calculate the new scale after zooming in
 * Ensures the scale does not exceed maxScale
 *
 * @param currentScale - Current zoom scale
 * @param step - Zoom step increment
 * @param maxScale - Maximum allowed scale
 * @returns New scale after zoom in
 */
export const calculateZoomIn = (
  currentScale: number,
  step: number = DEFAULT_ZOOM_CONFIG.step,
  maxScale: number = DEFAULT_ZOOM_CONFIG.maxScale
): number => {
  const newScale = currentScale + step
  return Math.min(newScale, maxScale)
}

/**
 * Calculate the new scale after zooming out
 * Ensures the scale does not go below minScale
 *
 * @param currentScale - Current zoom scale
 * @param step - Zoom step decrement
 * @param minScale - Minimum allowed scale
 * @returns New scale after zoom out
 */
export const calculateZoomOut = (
  currentScale: number,
  step: number = DEFAULT_ZOOM_CONFIG.step,
  minScale: number = DEFAULT_ZOOM_CONFIG.minScale
): number => {
  const newScale = currentScale - step
  return Math.max(newScale, minScale)
}

/**
 * Check if zoom in is allowed
 *
 * @param currentScale - Current zoom scale
 * @param maxScale - Maximum allowed scale
 * @returns True if zoom in is allowed
 */
export const canZoomIn = (
  currentScale: number,
  maxScale: number = DEFAULT_ZOOM_CONFIG.maxScale
): boolean => {
  return currentScale < maxScale
}

/**
 * Check if zoom out is allowed
 *
 * @param currentScale - Current zoom scale
 * @param minScale - Minimum allowed scale
 * @returns True if zoom out is allowed
 */
export const canZoomOut = (
  currentScale: number,
  minScale: number = DEFAULT_ZOOM_CONFIG.minScale
): boolean => {
  return currentScale > minScale
}

/**
 * ZoomController Component
 *
 * Provides zoom controls for the market heatmap visualization.
 * Implements Requirements 10.1, 10.2, 10.3, 10.6:
 * - 10.1: Display zoom in and zoom out control buttons
 * - 10.2: Zoom in increases the display scale
 * - 10.3: Zoom out decreases the display scale
 * - 10.6: Reset to default zoom level on double-click
 */
export const ZoomController = ({
  scale,
  minScale,
  maxScale,
  onZoomIn,
  onZoomOut,
  onReset,
  className = '',
}: ZoomControllerProps) => {
  const zoomInAllowed = canZoomIn(scale, maxScale)
  const zoomOutAllowed = canZoomOut(scale, minScale)
  const isDefaultScale = scale === DEFAULT_ZOOM_CONFIG.defaultScale

  // Format scale as percentage for display
  const scalePercent = Math.round(scale * 100)

  return (
    <div className={`zoom-controller ${className}`}>
      <button
        className="zoom-button zoom-out"
        onClick={onZoomOut}
        disabled={!zoomOutAllowed}
        title="缩小 (Ctrl + -)"
        aria-label="缩小热力图"
      >
        <span className="zoom-icon">−</span>
      </button>

      <div className="zoom-scale" title="当前缩放比例">
        <span className="scale-value">{scalePercent}%</span>
      </div>

      <button
        className="zoom-button zoom-in"
        onClick={onZoomIn}
        disabled={!zoomInAllowed}
        title="放大 (Ctrl + +)"
        aria-label="放大热力图"
      >
        <span className="zoom-icon">+</span>
      </button>

      <button
        className="zoom-button zoom-reset"
        onClick={onReset}
        disabled={isDefaultScale}
        title="重置缩放 (双击)"
        aria-label="重置热力图缩放"
      >
        <span className="zoom-icon">⟲</span>
      </button>
    </div>
  )
}
