/**
 * Alpha Vantage Service
 * Provides free historical stock data from Alpha Vantage API
 * 
 * Free tier: 25 requests per day, 5 requests per minute
 * Get API key at: https://www.alphavantage.co/support/#api-key
 */

import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export interface OHLCV {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface AlphaVantageTimeSeriesDaily {
  'Meta Data': {
    '1. Information': string;
    '2. Symbol': string;
    '3. Last Refreshed': string;
    '4. Output Size': string;
    '5. Time Zone': string;
  };
  'Time Series (Daily)': {
    [date: string]: {
      '1. open': string;
      '2. high': string;
      '3. low': string;
      '4. close': string;
      '5. volume': string;
    };
  };
}

export class AlphaVantageService {
  private baseUrl = 'https://www.alphavantage.co/query';
  private apiKey: string;

  constructor() {
    // Use a demo key if not configured - limited functionality
    this.apiKey = config.alphaVantageApiKey || 'demo';
    if (this.apiKey === 'demo') {
      logger.warn('Alpha Vantage API key not configured, using demo key with limited functionality');
    }
  }

  /**
   * Get daily historical OHLCV data for a stock
   * 
   * @param symbol - Stock symbol (e.g., 'AAPL', 'MSFT')
   * @param outputSize - 'compact' (last 100 days) or 'full' (20+ years)
   * @returns Array of OHLCV data points
   */
  async getDailyData(symbol: string, outputSize: 'compact' | 'full' = 'compact'): Promise<OHLCV[]> {
    try {
      const url = `${this.baseUrl}?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=${outputSize}&apikey=${this.apiKey}`;
      
      logger.debug(`Fetching Alpha Vantage data for ${symbol}`);
      
      const response = await fetch(url);

      if (!response.ok) {
        logger.error(`Alpha Vantage API error: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = await response.json() as AlphaVantageTimeSeriesDaily | { Note?: string; 'Error Message'?: string };

      // Check for rate limit or error messages
      if ('Note' in data) {
        logger.warn(`Alpha Vantage rate limit: ${data.Note}`);
        return [];
      }

      if ('Error Message' in data) {
        logger.error(`Alpha Vantage error: ${data['Error Message']}`);
        return [];
      }

      const timeSeries = (data as AlphaVantageTimeSeriesDaily)['Time Series (Daily)'];
      if (!timeSeries) {
        logger.warn(`No time series data returned for ${symbol}`);
        return [];
      }

      const ohlcvData: OHLCV[] = [];

      for (const [dateStr, values] of Object.entries(timeSeries)) {
        ohlcvData.push({
          timestamp: new Date(dateStr),
          open: parseFloat(values['1. open']),
          high: parseFloat(values['2. high']),
          low: parseFloat(values['3. low']),
          close: parseFloat(values['4. close']),
          volume: parseInt(values['5. volume'], 10),
        });
      }

      // Sort by date ascending
      ohlcvData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      logger.debug(`Retrieved ${ohlcvData.length} data points for ${symbol} from Alpha Vantage`);
      return ohlcvData;
    } catch (error) {
      logger.error(`Failed to fetch Alpha Vantage data for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get historical data filtered by date range
   * 
   * @param symbol - Stock symbol
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Filtered OHLCV data
   */
  async getHistoricalData(symbol: string, startDate: Date, endDate: Date): Promise<OHLCV[]> {
    // Determine output size based on date range
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const outputSize = daysDiff > 100 ? 'full' : 'compact';

    const allData = await this.getDailyData(symbol, outputSize);

    // Filter by date range
    return allData.filter(item => 
      item.timestamp >= startDate && item.timestamp <= endDate
    );
  }
}

export const alphaVantageService = new AlphaVantageService();
