# E2E Tests - Stock Detail and Heatmap Enhancement

This directory contains end-to-end tests for the Stock Detail and Heatmap Enhancement feature using Playwright.

## Setup

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

## Running Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run tests with UI mode (interactive)
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Run tests in debug mode
```bash
npm run test:e2e:debug
```

### Run specific test file
```bash
npx playwright test e2e/stock-detail.spec.ts
```

### Run tests for specific browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Files

- `stock-detail.spec.ts` - Tests for the Stock Detail Page (Requirements 1.1-9.6)
- `market-heatmap.spec.ts` - Tests for the Market Heatmap (Requirements 10.1-14.6)
- `complete-flow.spec.ts` - Tests for complete user flows combining both features

## Requirements Coverage

### Stock Detail Page Tests
- **1.1-1.5**: K-line chart display and interaction
- **2.1-2.5**: Company profile information
- **3.1-3.5**: Related news display
- **4.1-4.6**: Real-time quote and price changes
- **6.1-6.6**: Financial summary
- **7.1-7.5**: Analyst ratings
- **8.1-8.6**: Insider trades
- **9.1-9.6**: Watchlist functionality

### Market Heatmap Tests
- **10.1-10.6**: Zoom functionality (zoom in, zoom out, reset, wheel zoom, pan)
- **11.1-11.4**: Navigation menu behavior
- **12.1-12.5**: Data completeness
- **13.1-13.5**: Interaction experience (tooltip, click navigation)
- **14.1-14.6**: Sector/industry filtering

## Configuration

The Playwright configuration is in `playwright.config.ts`. Key settings:
- Base URL: `http://localhost:5173`
- Browsers: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- Auto-starts dev server before tests

## Notes

- Tests require the backend server to be running for full functionality
- Some tests may need adjustment based on actual component class names
- ECharts canvas interactions are limited in E2E tests
