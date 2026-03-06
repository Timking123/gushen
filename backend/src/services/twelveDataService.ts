/**
 * Twelve Data Service
 * Provides free historical stock data from Twelve Data API
 * 
 * Free tier: 800 API credits/day, 8 API credits/minute
 * Get API key at: https://twelvedata.com/
 */

import axios from 'axios';
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

interface TwelveDataResponse {
  meta?: {
    symbol: string;
    interval: string;
    currency: string;
    exchange_timezone: string;
    exchange: string;
    type: string;
  };
  values?: Array<{
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
  }>;
  status?: string;
  message?: string;
}

export class TwelveDataService {
  private baseUrl = 'https://api.twelvedata.com';
  private apiKey: string;

  constructor() {
    this.apiKey = config.twelveDataApiKey || '';
    if (!this.apiKey) {
      logger.warn('Twelve Data API key not configured');
    }
  }

  /**
   * Get historical OHLCV data for a stock
   */
  async getHistoricalData(
    symbol: string,
    startDate: Date,
    endDate: Date,
    interval: string = '1day'
  ): Promise<OHLCV[]> {
    if (!this.apiKey) {
      logger.warn('Twelve Data API key not configured, skipping');
      return [];
    }

    try {
      logger.debug(`Fetching Twelve Data for ${symbol}`);
      
      const response = await axios.get<TwelveDataResponse>(`${this.baseUrl}/time_series`, {
        params: {
          symbol,
          interval,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          apikey: this.apiKey,
          outputsize: 500,
        },
        timeout: 10000,
      });

      const data = response.data;

      if (data.status === 'error') {
        logger.error(`Twelve Data error: ${data.message}`);
        return [];
      }

      if (!data.values || data.values.length === 0) {
        logger.warn(`No data returned for ${symbol}`);
        return [];
      }

      const ohlcvData: OHLCV[] = data.values.map(item => ({
        timestamp: new Date(item.datetime),
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
        volume: parseInt(item.volume, 10) || 0,
      }));

      // Sort by date ascending
      ohlcvData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      logger.info(`Retrieved ${ohlcvData.length} data points for ${symbol} from Twelve Data`);
      return ohlcvData;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Twelve Data API error: ${error.response?.status} ${error.message}`);
      } else {
        logger.error(`Failed to fetch Twelve Data for ${symbol}:`, error);
      }
      return [];
    }
  }

  /**
   * Convert TimeRange to Twelve Data interval
   */
  convertTimeRange(range: string): string {
    switch (range) {
      case '1D':
      case '5D':
      case '1M':
      case '3M':
      case '6M':
      case '1Y':
        return '1day';
      case '5Y':
      case 'MAX':
        return '1week';
      default:
        return '1day';
    }
  }
}

export const twelveDataService = new TwelveDataService();
