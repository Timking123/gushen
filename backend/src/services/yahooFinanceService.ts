/**
 * Yahoo Finance Service
 * Provides free historical stock data from Yahoo Finance
 * 
 * Uses yahoo-finance2 library for reliable API access
 */

import { logger } from '../utils/logger.js';
import yahooFinance from 'yahoo-finance2';

export interface OHLCV {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface YahooHistoricalRow {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose?: number;
}

export class YahooFinanceService {
  async getHistoricalData(
    symbol: string,
    range: string = '1mo',
    interval: string = '1d'
  ): Promise<OHLCV[]> {
    try {
      logger.debug(`Fetching Yahoo Finance data for ${symbol}`);
      
      const endDate = new Date();
      const startDate = this.calculateStartDate(range);
      const yahooInterval = this.mapInterval(interval);
      
      const result = await (yahooFinance as unknown as {
        historical: (symbol: string, options: object) => Promise<YahooHistoricalRow[]>
      }).historical(symbol, {
        period1: startDate,
        period2: endDate,
        interval: yahooInterval,
      });

      if (!result || result.length === 0) {
        logger.warn(`No data returned for ${symbol}`);
        return [];
      }

      const ohlcvData: OHLCV[] = [];
      for (const quote of result) {
        if (!quote.open || !quote.high || !quote.low || !quote.close || !quote.date) {
          continue;
        }
        ohlcvData.push({
          timestamp: new Date(quote.date),
          open: quote.open,
          high: quote.high,
          low: quote.low,
          close: quote.close,
          volume: quote.volume || 0,
        });
      }

      logger.info(`Retrieved ${ohlcvData.length} data points for ${symbol} from Yahoo Finance`);
      return ohlcvData;
    } catch (error) {
      logger.error(`Failed to fetch Yahoo Finance data for ${symbol}:`, error);
      return [];
    }
  }

  private calculateStartDate(range: string): Date {
    const now = new Date();
    switch (range.toLowerCase()) {
      case '1d': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '5d': return new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      case '1mo': return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      case '3mo': return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      case '6mo': return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      case '1y': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      case '2y': return new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
      case '5y': return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      case 'ytd': return new Date(now.getFullYear(), 0, 1);
      case 'max': return new Date(1970, 0, 1);
      default: return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    }
  }

  private mapInterval(interval: string): '1d' | '1wk' | '1mo' {
    switch (interval.toLowerCase()) {
      case '1wk': return '1wk';
      case '1mo': case '3mo': return '1mo';
      default: return '1d';
    }
  }

  convertTimeRange(range: string): { yahooRange: string; interval: string } {
    switch (range) {
      case '1D': return { yahooRange: '1d', interval: '1d' };
      case '5D': return { yahooRange: '5d', interval: '1d' };
      case '1M': return { yahooRange: '1mo', interval: '1d' };
      case '3M': return { yahooRange: '3mo', interval: '1d' };
      case '6M': return { yahooRange: '6mo', interval: '1d' };
      case '1Y': return { yahooRange: '1y', interval: '1d' };
      case '5Y': return { yahooRange: '5y', interval: '1wk' };
      case 'MAX': return { yahooRange: 'max', interval: '1mo' };
      default: return { yahooRange: '1mo', interval: '1d' };
    }
  }
}

export const yahooFinanceService = new YahooFinanceService();
