import { test, expect } from '@playwright/test'

/**
 * E2E Tests - Stock Detail Page User Flows
 * Feature: stock-detail-and-heatmap-enhancement
 * Task: 19.3 编写端到端测试
 *
 * Tests key user flows for the stock detail page.
 *
 * **Validates: Requirements 1.1-9.6**
 */

test.describe('Stock Detail Page E2E Tests', () => {
  /**
   * Test: Navigate to stock detail page
   * Implements Requirement 1.1
   */
  test('should navigate to stock detail page', async ({ page }) => {
    // Navigate to a stock detail page
    await page.goto('/stock/AAPL')

    // Verify the page loaded
    await expect(page).toHaveURL(/\/stock\/AAPL/)

    // Verify the stock symbol is displayed in the header
    await expect(page.locator('.stock-symbol-header')).toContainText('AAPL')
  })

  /**
   * Test: Display company profile information
   * Implements Requirements 2.1-2.5
   */
  test('should display company profile information', async ({ page }) => {
    await page.goto('/stock/AAPL')

    // Wait for the company profile section to load
    const companyProfile = page.locator('.company-profile')
    await expect(companyProfile).toBeVisible()

    // Verify company name is displayed
    await expect(companyProfile.locator('.company-name')).toBeVisible()

    // Verify stock symbol is displayed
    await expect(companyProfile.locator('.stock-symbol')).toContainText('AAPL')
  })

  /**
   * Test: Display real-time quote with price change colors
   * Implements Requirements 4.1-4.6
   */
  test('should display real-time quote information', async ({ page }) => {
    await page.goto('/stock/AAPL')

    // Wait for the real-time quote section to load
    const quoteSection = page.locator('.real-time-quote')
    await expect(quoteSection).toBeVisible()

    // Verify price is displayed
    await expect(quoteSection.locator('.current-price')).toBeVisible()

    // Verify change information is displayed
    await expect(quoteSection.locator('.price-change')).toBeVisible()
  })

  /**
   * Test: Display financial summary
   * Implements Requirements 6.1-6.6
   */
  test('should display financial summary', async ({ page }) => {
    await page.goto('/stock/AAPL')

    // Wait for the financial summary section to load
    const financialSection = page.locator('.financial-summary')
    await expect(financialSection).toBeVisible()
  })

  /**
   * Test: Display analyst ratings
   * Implements Requirements 7.1-7.5
   */
  test('should display analyst ratings', async ({ page }) => {
    await page.goto('/stock/AAPL')

    // Wait for the analyst ratings section to load
    const analystSection = page.locator('.analyst-ratings')
    await expect(analystSection).toBeVisible()
  })

  /**
   * Test: Display insider trades
   * Implements Requirements 8.1-8.6
   */
  test('should display insider trades', async ({ page }) => {
    await page.goto('/stock/AAPL')

    // Wait for the insider trades section to load
    const insiderSection = page.locator('.insider-trades')
    await expect(insiderSection).toBeVisible()
  })

  /**
   * Test: Watchlist button functionality (unauthenticated)
   * Implements Requirements 9.1, 9.6
   */
  test('should show watchlist button and prompt login when not authenticated', async ({
    page,
  }) => {
    await page.goto('/stock/AAPL')

    // Find the watchlist button
    const watchlistButton = page.locator('.watchlist-button')
    await expect(watchlistButton).toBeVisible()

    // Click the button
    await watchlistButton.click()

    // Should show login prompt (toast or modal)
    // The exact behavior depends on implementation
    await expect(page.locator('.toast, .login-prompt')).toBeVisible({ timeout: 5000 })
  })

  /**
   * Test: Back navigation
   */
  test('should navigate back when clicking back button', async ({ page }) => {
    // First go to home page
    await page.goto('/')

    // Then navigate to stock detail
    await page.goto('/stock/AAPL')

    // Click back button
    const backButton = page.locator('.back-button')
    await expect(backButton).toBeVisible()
    await backButton.click()

    // Should navigate back
    await expect(page).not.toHaveURL(/\/stock\/AAPL/)
  })

  /**
   * Test: Stock chart is displayed
   * Implements Requirements 1.1-1.5
   */
  test('should display stock chart', async ({ page }) => {
    await page.goto('/stock/AAPL')

    // Wait for the chart section to load
    const chartSection = page.locator('.detail-chart-section')
    await expect(chartSection).toBeVisible()
  })

  /**
   * Test: News section is displayed
   * Implements Requirements 3.1-3.5
   */
  test('should display news section', async ({ page }) => {
    await page.goto('/stock/AAPL')

    // Wait for the news section to load
    const newsSection = page.locator('.news-section')
    await expect(newsSection).toBeVisible()
  })

  /**
   * Test: Handle invalid stock symbol
   */
  test('should handle invalid stock symbol gracefully', async ({ page }) => {
    await page.goto('/stock/INVALID123')

    // Should show error state or redirect
    // The exact behavior depends on implementation
    const errorElement = page.locator('.stock-detail-error, .error-message')
    await expect(errorElement).toBeVisible({ timeout: 10000 })
  })

  /**
   * Test: Responsive layout on mobile
   */
  test('should display correctly on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto('/stock/AAPL')

    // Verify the page is still functional
    await expect(page.locator('.stock-detail-page')).toBeVisible()

    // Verify key sections are visible
    await expect(page.locator('.real-time-quote')).toBeVisible()
  })
})
