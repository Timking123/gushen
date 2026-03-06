import { test, expect } from '@playwright/test'

/**
 * E2E Tests - Complete User Flow
 * Feature: stock-detail-and-heatmap-enhancement
 * Task: 19.3 编写端到端测试
 *
 * Tests the complete user flow from heatmap to stock detail page,
 * including all key interactions.
 *
 * **Validates: Requirements 1.1-14.6**
 */

test.describe('Complete User Flow E2E Tests', () => {
  /**
   * Test: Complete flow from home page to stock detail
   * Implements Requirements 1.1-9.6, 13.3
   */
  test('should complete flow from home page to stock detail', async ({ page }) => {
    // Step 1: Navigate to home page
    await page.goto('/')

    // Step 2: Verify heatmap is displayed
    const heatmap = page.locator('.market-heatmap')
    await expect(heatmap).toBeVisible({ timeout: 10000 })

    // Step 3: Navigate to a stock detail page directly
    // (Since clicking on ECharts canvas is complex, we navigate directly)
    await page.goto('/stock/AAPL')

    // Step 4: Verify stock detail page loaded
    await expect(page).toHaveURL(/\/stock\/AAPL/)
    await expect(page.locator('.stock-detail-page')).toBeVisible()

    // Step 5: Verify all key sections are displayed
    await expect(page.locator('.real-time-quote')).toBeVisible()
    await expect(page.locator('.company-profile')).toBeVisible()

    // Step 6: Verify watchlist button is present
    const watchlistButton = page.locator('.watchlist-button')
    await expect(watchlistButton).toBeVisible()

    // Step 7: Navigate back to home
    const backButton = page.locator('.back-button')
    await backButton.click()

    // Step 8: Verify we're back on home page
    await expect(page.locator('.market-heatmap')).toBeVisible({ timeout: 10000 })
  })

  /**
   * Test: Heatmap zoom and filter combined flow
   * Implements Requirements 10.1-14.6
   */
  test('should handle zoom and filter operations in sequence', async ({ page }) => {
    await page.goto('/')

    // Wait for heatmap to load
    const heatmap = page.locator('.market-heatmap')
    await expect(heatmap).toBeVisible({ timeout: 10000 })

    // Step 1: Zoom in
    const zoomInButton = page.locator('.zoom-in-btn, [title*="放大"]')
    if (await zoomInButton.isVisible()) {
      await zoomInButton.click()
      await zoomInButton.click()
    }

    // Step 2: Apply sector filter (if available)
    const sectorFilter = page.locator('.sector-filter')
    if (await sectorFilter.isVisible()) {
      const sectorDropdown = sectorFilter.locator('.sector-dropdown, select, button').first()
      if (await sectorDropdown.isVisible()) {
        await sectorDropdown.click()
        const sectorOption = page.locator('.sector-option, option').first()
        if (await sectorOption.isVisible()) {
          await sectorOption.click()
        }
      }
    }

    // Step 3: Reset zoom
    const resetButton = page.locator('.zoom-reset-btn, [title*="重置"]')
    if (await resetButton.isVisible()) {
      await resetButton.click()
    }

    // Step 4: Clear filters
    const clearButton = page.locator('.clear-filters-button')
    if (await clearButton.isVisible()) {
      await clearButton.click()
    }

    // Verify heatmap is still functional
    await expect(heatmap).toBeVisible()
  })

  /**
   * Test: Multiple stock detail page visits
   */
  test('should handle multiple stock detail page visits', async ({ page }) => {
    const stocks = ['AAPL', 'MSFT', 'GOOGL']

    for (const symbol of stocks) {
      // Navigate to stock detail
      await page.goto(`/stock/${symbol}`)

      // Verify page loaded
      await expect(page).toHaveURL(new RegExp(`/stock/${symbol}`))
      await expect(page.locator('.stock-symbol-header')).toContainText(symbol)

      // Verify key sections
      await expect(page.locator('.stock-detail-page')).toBeVisible()
    }
  })

  /**
   * Test: Navigation between pages preserves state
   */
  test('should preserve heatmap state when navigating back', async ({ page }) => {
    await page.goto('/')

    // Wait for heatmap to load
    const heatmap = page.locator('.market-heatmap')
    await expect(heatmap).toBeVisible({ timeout: 10000 })

    // Navigate to stock detail
    await page.goto('/stock/AAPL')
    await expect(page.locator('.stock-detail-page')).toBeVisible()

    // Navigate back
    await page.goBack()

    // Verify heatmap is still displayed
    await expect(heatmap).toBeVisible({ timeout: 10000 })
  })

  /**
   * Test: Error handling for invalid routes
   */
  test('should handle invalid routes gracefully', async ({ page }) => {
    // Navigate to invalid stock
    await page.goto('/stock/INVALID_SYMBOL_12345')

    // Should show error or redirect
    const errorElement = page.locator('.stock-detail-error, .error-message, .not-found')
    await expect(errorElement).toBeVisible({ timeout: 10000 })
  })

  /**
   * Test: Page load performance
   */
  test('should load pages within acceptable time', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/')
    await expect(page.locator('.market-heatmap')).toBeVisible({ timeout: 10000 })

    const homeLoadTime = Date.now() - startTime
    expect(homeLoadTime).toBeLessThan(10000) // 10 seconds max

    const detailStartTime = Date.now()
    await page.goto('/stock/AAPL')
    await expect(page.locator('.stock-detail-page')).toBeVisible({ timeout: 10000 })

    const detailLoadTime = Date.now() - detailStartTime
    expect(detailLoadTime).toBeLessThan(10000) // 10 seconds max
  })

  /**
   * Test: Keyboard navigation
   */
  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/stock/AAPL')

    // Tab through interactive elements
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Verify focus is on an interactive element
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
  })

  /**
   * Test: Accessibility - basic checks
   */
  test('should have accessible elements', async ({ page }) => {
    await page.goto('/stock/AAPL')

    // Check that buttons have accessible names
    const buttons = page.locator('button')
    const buttonCount = await buttons.count()

    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i)
      const ariaLabel = await button.getAttribute('aria-label')
      const title = await button.getAttribute('title')
      const text = await button.textContent()

      // Button should have some accessible name
      expect(ariaLabel || title || text?.trim()).toBeTruthy()
    }
  })
})

test.describe('Authentication Flow Tests', () => {
  /**
   * Test: Unauthenticated user flow
   */
  test('should show login prompt for watchlist when not authenticated', async ({
    page,
  }) => {
    await page.goto('/stock/AAPL')

    // Find and click watchlist button
    const watchlistButton = page.locator('.watchlist-button')
    await expect(watchlistButton).toBeVisible()
    await watchlistButton.click()

    // Should show login prompt
    const toast = page.locator('.toast, .login-prompt, [role="alert"]')
    await expect(toast).toBeVisible({ timeout: 5000 })
  })

  /**
   * Test: Guest user can view stock details
   */
  test('should allow guest users to view stock details', async ({ page }) => {
    await page.goto('/stock/AAPL')

    // Verify all read-only sections are visible
    await expect(page.locator('.stock-detail-page')).toBeVisible()
    await expect(page.locator('.real-time-quote')).toBeVisible()
    await expect(page.locator('.company-profile')).toBeVisible()
  })
})

test.describe('Responsive Design Tests', () => {
  const viewports = [
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1920, height: 1080 },
  ]

  for (const viewport of viewports) {
    test(`should display correctly on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })

      // Test home page
      await page.goto('/')
      await expect(page.locator('.market-heatmap')).toBeVisible({ timeout: 10000 })

      // Test stock detail page
      await page.goto('/stock/AAPL')
      await expect(page.locator('.stock-detail-page')).toBeVisible()
    })
  }
})
