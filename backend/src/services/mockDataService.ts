/**
 * Mock Data Service
 * Generates realistic mock historical stock data for development/testing
 * Used as a fallback when all external APIs fail
 */

import { logger } from '../utils/logger.js';

export interface OHLCV {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Base prices for common stocks (approximate)
const BASE_PRICES: Record<string, number> = {
  AAPL: 180,
  MSFT: 400,
  GOOGL: 140,
  AMZN: 180,
  META: 500,
  NVDA: 800,
  TSLA: 250,
  AMD: 150,
  JPM: 190,
  V: 280,
  MA: 450,
  JNJ: 160,
  WMT: 170,
  PG: 160,
  XOM: 110,
  SPY: 500,
  QQQ: 430,
  DIA: 390,
};

export class MockDataService {
  /**
   * Generate mock historical OHLCV data
   */
  generateHistoricalData(
    symbol: string,
    startDate: Date,
    endDate: Date
  ): OHLCV[] {
    logger.info(`Generating mock data for ${symbol} from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    const basePrice = BASE_PRICES[symbol.toUpperCase()] || 100;
    const data: OHLCV[] = [];
    
    let currentDate = new Date(startDate);
    let currentPrice = basePrice;
    
    // Add some randomness to starting price
    currentPrice = basePrice * (0.9 + Math.random() * 0.2);
    
    while (currentDate <= endDate) {
      // Skip weekends
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      
      // Generate daily price movement (-3% to +3%)
      const dailyChange = (Math.random() - 0.5) * 0.06;
      const volatility = 0.02; // 2% intraday volatility
      
      const open = currentPrice;
      const close = currentPrice * (1 + dailyChange);
      const high = Math.max(open, close) * (1 + Math.random() * volatility);
      const low = Math.min(open, close) * (1 - Math.random() * volatility);
      
      // Generate volume (random between 10M and 100M)
      const volume = Math.floor(10000000 + Math.random() * 90000000);
      
      data.push({
        timestamp: new Date(currentDate),
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
        volume,
      });
      
      currentPrice = close;
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    logger.info(`Generated ${data.length} mock data points for ${symbol}`);
    return data;
  }
}

export const mockDataService = new MockDataService();
