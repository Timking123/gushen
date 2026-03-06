/**
 * Finnhub API Service
 * Provides real-time stock data from Finnhub API with WebSocket streaming
 */

import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';
import { emitToStock, broadcast } from '../lib/socket.js';
import WebSocket from 'ws';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const FINNHUB_WS_URL = 'wss://ws.finnhub.io';

interface FinnhubQuote {
  c: number;  // Current price
  d: number;  // Change
  dp: number; // Percent change
  h: number;  // High price of the day
  l: number;  // Low price of the day
  o: number;  // Open price of the day
  pc: number; // Previous close price
  t: number;  // Timestamp
}

interface FinnhubTrade {
  s: string;  // Symbol
  p: number;  // Last price
  t: number;  // Timestamp (ms)
  v: number;  // Volume
  c: string[] | null; // Trade conditions
}

interface FinnhubWSMessage {
  type: string;
  data?: FinnhubTrade[];
}

interface FinnhubCompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  finnhubIndustry: string;
  ipo: string;
  logo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
}

interface FinnhubNews {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

interface FinnhubCandle {
  c: number[];  // Close prices
  h: number[];  // High prices
  l: number[];  // Low prices
  o: number[];  // Open prices
  s: string;    // Status
  t: number[];  // Timestamps
  v: number[];  // Volumes
}

interface FinnhubSymbol {
  currency: string;
  description: string;
  displaySymbol: string;
  figi: string;
  mic: string;
  symbol: string;
  type: string;
}

// Earnings Calendar interfaces
interface FinnhubEarningsCalendar {
  earningsCalendar: FinnhubEarning[];
}

interface FinnhubEarning {
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  hour: string;
  quarter: number;
  revenueActual: number | null;
  revenueEstimate: number | null;
  symbol: string;
  year: number;
}

// Dividend interfaces
interface FinnhubDividend {
  symbol: string;
  date: string;
  amount: number;
  adjustedAmount: number;
  payDate: string;
  recordDate: string;
  declarationDate: string;
  currency: string;
}

// Insider Transaction interfaces
interface FinnhubInsiderTransaction {
  name: string;
  share: number;
  change: number;
  filingDate: string;
  transactionDate: string;
  transactionCode: string;
  transactionPrice: number;
}

interface FinnhubInsiderTransactions {
  data: FinnhubInsiderTransaction[];
  symbol: string;
}

// SEC Filing interfaces
interface FinnhubSECFiling {
  accessNumber: string;
  symbol: string;
  cik: string;
  form: string;
  filedDate: string;
  acceptedDate: string;
  reportUrl: string;
  filingUrl: string;
}

// Analyst Recommendation interfaces
interface FinnhubRecommendation {
  buy: number;
  hold: number;
  period: string;
  sell: number;
  strongBuy: number;
  strongSell: number;
  symbol: string;
}

// Price Target interfaces
interface FinnhubPriceTarget {
  lastUpdated: string;
  symbol: string;
  targetHigh: number;
  targetLow: number;
  targetMean: number;
  targetMedian: number;
}

// Basic Financials interfaces
interface FinnhubBasicFinancials {
  metric: {
    '10DayAverageTradingVolume'?: number;
    '52WeekHigh'?: number;
    '52WeekLow'?: number;
    '52WeekPriceReturnDaily'?: number;
    beta?: number;
    bookValuePerShareAnnual?: number;
    bookValuePerShareQuarterly?: number;
    currentRatioAnnual?: number;
    currentRatioQuarterly?: number;
    dividendPerShareAnnual?: number;
    dividendYieldIndicatedAnnual?: number;
    epsAnnual?: number;
    epsBasicExclExtraItemsAnnual?: number;
    epsGrowth3Y?: number;
    epsGrowth5Y?: number;
    epsGrowthQuarterlyYoy?: number;
    epsGrowthTTMYoy?: number;
    grossMarginAnnual?: number;
    grossMarginTTM?: number;
    netProfitMarginAnnual?: number;
    netProfitMarginTTM?: number;
    operatingMarginAnnual?: number;
    operatingMarginTTM?: number;
    payoutRatioAnnual?: number;
    pbAnnual?: number;
    pbQuarterly?: number;
    peAnnual?: number;
    peBasicExclExtraTTM?: number;
    peExclExtraAnnual?: number;
    peExclExtraTTM?: number;
    pegRatio?: number;
    pfcfShareAnnual?: number;
    pfcfShareTTM?: number;
    priceRelativeToS500_52Week?: number;
    psTTM?: number;
    psAnnual?: number;
    revenueGrowth3Y?: number;
    revenueGrowth5Y?: number;
    revenueGrowthQuarterlyYoy?: number;
    revenueGrowthTTMYoy?: number;
    revenuePerShareAnnual?: number;
    revenuePerShareTTM?: number;
    roaRfy?: number;
    roaTTM?: number;
    roeRfy?: number;
    roeTTM?: number;
    totalDebtToEquityAnnual?: number;
    totalDebtToEquityQuarterly?: number;
  };
  metricType: string;
  symbol: string;
}

export class FinnhubService {
  private apiKey: string;
  private ws: WebSocket | null = null;
  private subscribedSymbols: Set<string> = new Set();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 5000;
  private isConnecting: boolean = false;
  private lastPrices: Map<string, number> = new Map();

  constructor() {
    this.apiKey = config.finnhubApiKey;
    if (!this.apiKey) {
      logger.warn('Finnhub API key not configured');
    }
  }

  /**
   * Initialize WebSocket connection for real-time streaming
   */
  async initWebSocket(): Promise<void> {
    if (!this.apiKey) {
      logger.warn('Finnhub API key not configured, WebSocket disabled');
      return;
    }

    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      logger.debug('WebSocket already connected or connecting');
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(`${FINNHUB_WS_URL}?token=${this.apiKey}`);

      this.ws.on('open', () => {
        logger.info('🔌 Finnhub WebSocket connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;

        // Re-subscribe to all symbols
        this.subscribedSymbols.forEach(symbol => {
          this.subscribeSymbol(symbol);
        });
      });

      this.ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message: FinnhubWSMessage = JSON.parse(data.toString());
          
          if (message.type === 'trade' && message.data) {
            await this.handleTradeData(message.data);
          } else if (message.type === 'ping') {
            // Finnhub sends ping messages, no action needed
          } else if (message.type === 'error') {
            logger.error('Finnhub WebSocket error message:', message);
          }
        } catch (error) {
          logger.error('Failed to parse WebSocket message:', error);
        }
      });

      this.ws.on('close', (code, reason) => {
        logger.warn(`Finnhub WebSocket closed: ${code} - ${reason}`);
        this.isConnecting = false;
        this.ws = null;
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        logger.error('Finnhub WebSocket error:', error);
        this.isConnecting = false;
      });

    } catch (error) {
      logger.error('Failed to initialize Finnhub WebSocket:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Handle incoming trade data from WebSocket
   */
  private async handleTradeData(trades: FinnhubTrade[]): Promise<void> {
    // Group trades by symbol and get latest price for each
    const latestBySymbol = new Map<string, FinnhubTrade>();
    
    for (const trade of trades) {
      const existing = latestBySymbol.get(trade.s);
      if (!existing || trade.t > existing.t) {
        latestBySymbol.set(trade.s, trade);
      }
    }

    // Process each symbol's latest trade
    for (const [symbol, trade] of latestBySymbol) {
      const previousPrice = this.lastPrices.get(symbol);
      this.lastPrices.set(symbol, trade.p);

      // Calculate change from previous close (if we have it cached)
      let change = 0;
      let changePercent = 0;
      
      if (previousPrice) {
        change = trade.p - previousPrice;
        changePercent = (change / previousPrice) * 100;
      }

      // Emit real-time update to frontend via Socket.IO
      const priceUpdate = {
        symbol,
        price: trade.p,
        change,
        changePercent,
        volume: trade.v,
        timestamp: new Date(trade.t).toISOString(),
      };

      // Emit to stock-specific room
      emitToStock(symbol, 'price:update', priceUpdate);
      
      // Also broadcast to all clients for market overview
      broadcast('market:price', priceUpdate);

      // Save to database (throttled - every 5 seconds per symbol)
      await this.throttledSaveQuote(symbol, trade);
    }
  }

  // Throttle database saves to avoid overwhelming the DB
  private saveThrottles: Map<string, number> = new Map();
  private readonly SAVE_THROTTLE_MS = 5000; // Save at most every 5 seconds per symbol

  private async throttledSaveQuote(symbol: string, trade: FinnhubTrade): Promise<void> {
    const now = Date.now();
    const lastSave = this.saveThrottles.get(symbol) || 0;

    if (now - lastSave < this.SAVE_THROTTLE_MS) {
      return; // Skip save, too soon
    }

    this.saveThrottles.set(symbol, now);

    try {
      await prisma.stockQuote.create({
        data: {
          symbol,
          price: trade.p,
          change: 0,
          changePercent: 0,
          high: trade.p,
          low: trade.p,
          open: trade.p,
          previousClose: this.lastPrices.get(symbol) || trade.p,
          volume: BigInt(trade.v),
          timestamp: new Date(trade.t),
        },
      });

      // Invalidate cache
      await redisHelpers.del(`stock:quote:${symbol}`);
    } catch (error) {
      // Ignore duplicate key errors, log others
      if (!(error instanceof Error && error.message.includes('Unique constraint'))) {
        logger.error(`Failed to save real-time quote for ${symbol}:`, error);
      }
    }
  }

  /**
   * Schedule WebSocket reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max WebSocket reconnection attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    logger.info(`Scheduling WebSocket reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.initWebSocket();
    }, delay);
  }

  /**
   * Subscribe to real-time updates for a symbol
   */
  subscribeSymbol(symbol: string): void {
    this.subscribedSymbols.add(symbol);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', symbol }));
      logger.debug(`Subscribed to ${symbol} on Finnhub WebSocket`);
    }
  }

  /**
   * Unsubscribe from real-time updates for a symbol
   */
  unsubscribeSymbol(symbol: string): void {
    this.subscribedSymbols.delete(symbol);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe', symbol }));
      logger.debug(`Unsubscribed from ${symbol} on Finnhub WebSocket`);
    }
  }

  /**
   * Subscribe to all tracked stocks in database
   * Note: Finnhub free tier has limited WebSocket subscriptions
   * Only subscribe to popular stocks to avoid rate limits
   */
  async subscribeAllTrackedStocks(): Promise<void> {
    // Only subscribe to popular stocks to avoid rate limits
    const popularSymbols = [
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AMD',
      'JPM', 'V', 'MA', 'JNJ', 'WMT', 'PG', 'XOM', 'SPY', 'QQQ', 'DIA'
    ];

    logger.info(`Subscribing to ${popularSymbols.length} popular stocks on Finnhub WebSocket...`);

    for (const symbol of popularSymbols) {
      this.subscribeSymbol(symbol);
    }
  }

  /**
   * Close WebSocket connection
   */
  closeWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      logger.info('Finnhub WebSocket closed');
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isWebSocketConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private async fetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
    if (!this.apiKey) {
      logger.warn('Finnhub API key not configured, skipping API call');
      return null;
    }

    const url = new URL(`${FINNHUB_BASE_URL}${endpoint}`);
    url.searchParams.append('token', this.apiKey);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        logger.error(`Finnhub API error: ${response.status} ${response.statusText}`);
        return null;
      }
      return await response.json() as T;
    } catch (error) {
      logger.error('Finnhub API fetch error:', error);
      return null;
    }
  }

  /**
   * Get real-time quote for a symbol
   */
  async getQuote(symbol: string): Promise<FinnhubQuote | null> {
    return this.fetch<FinnhubQuote>('/quote', { symbol });
  }

  /**
   * Get company profile
   */
  async getCompanyProfile(symbol: string): Promise<FinnhubCompanyProfile | null> {
    return this.fetch<FinnhubCompanyProfile>('/stock/profile2', { symbol });
  }

  /**
   * Get market news
   */
  async getMarketNews(category: string = 'general'): Promise<FinnhubNews[] | null> {
    return this.fetch<FinnhubNews[]>('/news', { category });
  }

  /**
   * Get company news
   */
  async getCompanyNews(symbol: string, from: string, to: string): Promise<FinnhubNews[] | null> {
    return this.fetch<FinnhubNews[]>('/company-news', { symbol, from, to });
  }

  /**
   * Get stock candles (historical data)
   */
  async getCandles(symbol: string, resolution: string, from: number, to: number): Promise<FinnhubCandle | null> {
    return this.fetch<FinnhubCandle>('/stock/candle', {
      symbol,
      resolution,
      from: from.toString(),
      to: to.toString(),
    });
  }

  /**
   * Get all stock symbols for an exchange
   * @param exchange - Exchange code (e.g., 'US' for US stocks)
   */
  async getStockSymbols(exchange: string = 'US'): Promise<FinnhubSymbol[] | null> {
    return this.fetch<FinnhubSymbol[]>('/stock/symbol', { exchange });
  }

  /**
   * Sync all US stock symbols to database
   * This imports the complete list of US stocks from Finnhub
   */
  async syncAllUSStocks(): Promise<number> {
    const symbols = await this.getStockSymbols('US');
    if (!symbols || symbols.length === 0) {
      logger.warn('No US stock symbols returned from Finnhub');
      return 0;
    }

    logger.info(`Found ${symbols.length} US stock symbols from Finnhub`);

    // Filter to only common stocks (exclude ETFs, warrants, etc. for cleaner data)
    const commonStocks = symbols.filter(s => 
      s.type === 'Common Stock' && 
      s.currency === 'USD' &&
      !s.symbol.includes('.') // Exclude symbols with dots (usually special classes)
    );

    logger.info(`Filtering to ${commonStocks.length} common stocks`);

    let count = 0;
    const batchSize = 100;

    for (let i = 0; i < commonStocks.length; i += batchSize) {
      const batch = commonStocks.slice(i, i + batchSize);
      
      for (const stock of batch) {
        try {
          await prisma.stock.upsert({
            where: { symbol: stock.symbol },
            update: {
              name: stock.description || stock.symbol,
              exchange: 'US',
            },
            create: {
              symbol: stock.symbol,
              name: stock.description || stock.symbol,
              exchange: 'US',
            },
          });
          count++;
        } catch (error) {
          // Skip duplicates or errors
          logger.debug(`Skipped ${stock.symbol}: ${error}`);
        }
      }

      logger.info(`Synced ${Math.min(i + batchSize, commonStocks.length)}/${commonStocks.length} stocks...`);
    }

    logger.info(`Successfully synced ${count} US stocks to database`);
    return count;
  }

  /**
   * Sync quote data for a symbol to database
   */
  async syncQuote(symbol: string): Promise<boolean> {
    const quote = await this.getQuote(symbol);
    if (!quote || quote.c === 0) {
      logger.warn(`No quote data for ${symbol}`);
      return false;
    }

    try {
      await prisma.stockQuote.create({
        data: {
          symbol,
          price: quote.c,
          change: quote.d,
          changePercent: quote.dp,
          high: quote.h,
          low: quote.l,
          open: quote.o,
          previousClose: quote.pc,
          volume: BigInt(0), // Finnhub quote doesn't include volume
          timestamp: new Date(quote.t * 1000),
        },
      });

      // Invalidate cache
      await redisHelpers.del(`stock:quote:${symbol}`);
      logger.info(`Synced quote for ${symbol}: $${quote.c}`);
      return true;
    } catch (error) {
      logger.error(`Failed to sync quote for ${symbol}:`, error);
      return false;
    }
  }

  /**
   * Sync company profile to database
   */
  async syncCompanyProfile(symbol: string): Promise<boolean> {
    const profile = await this.getCompanyProfile(symbol);
    if (!profile) {
      logger.warn(`No profile data for ${symbol}`);
      return false;
    }

    try {
      await prisma.stock.upsert({
        where: { symbol },
        update: {
          name: profile.name,
          exchange: profile.exchange,
          industry: profile.finnhubIndustry,
          marketCap: profile.marketCapitalization ? BigInt(Math.round(profile.marketCapitalization * 1000000)) : null,
          country: profile.country,
        },
        create: {
          symbol,
          name: profile.name,
          exchange: profile.exchange,
          industry: profile.finnhubIndustry,
          marketCap: profile.marketCapitalization ? BigInt(Math.round(profile.marketCapitalization * 1000000)) : null,
          country: profile.country,
        },
      });

      logger.info(`Synced profile for ${symbol}: ${profile.name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to sync profile for ${symbol}:`, error);
      return false;
    }
  }

  /**
   * Sync historical candle data to database
   */
  async syncCandles(symbol: string, days: number = 365): Promise<number> {
    const to = Math.floor(Date.now() / 1000);
    const from = to - days * 24 * 60 * 60;
    
    const candles = await this.getCandles(symbol, 'D', from, to);
    if (!candles || candles.s !== 'ok' || !candles.t) {
      logger.warn(`No candle data for ${symbol}`);
      return 0;
    }

    let count = 0;
    for (let i = 0; i < candles.t.length; i++) {
      try {
        await prisma.oHLCV.upsert({
          where: {
            symbol_timestamp: {
              symbol,
              timestamp: new Date(candles.t[i] * 1000),
            },
          },
          update: {
            open: candles.o[i],
            high: candles.h[i],
            low: candles.l[i],
            close: candles.c[i],
            volume: BigInt(candles.v[i]),
          },
          create: {
            symbol,
            timestamp: new Date(candles.t[i] * 1000),
            open: candles.o[i],
            high: candles.h[i],
            low: candles.l[i],
            close: candles.c[i],
            volume: BigInt(candles.v[i]),
          },
        });
        count++;
      } catch (error) {
        logger.error(`Failed to save candle for ${symbol}:`, error);
      }
    }

    logger.info(`Synced ${count} candles for ${symbol}`);
    return count;
  }

  /**
   * Sync market news to database
   */
  async syncMarketNews(): Promise<number> {
    const news = await this.getMarketNews('general');
    if (!news || news.length === 0) {
      logger.warn('No market news available');
      return 0;
    }

    let count = 0;
    for (const item of news.slice(0, 20)) { // Limit to 20 news items
      try {
        const existing = await prisma.newsItem.findFirst({
          where: { url: item.url },
        });

        if (!existing) {
          await prisma.newsItem.create({
            data: {
              title: item.headline,
              summary: item.summary,
              source: item.source,
              url: item.url,
              publishedAt: new Date(item.datetime * 1000),
              sectors: item.category ? [item.category] : [],
            },
          });
          count++;
        }
      } catch (error) {
        logger.error('Failed to save news item:', error);
      }
    }

    logger.info(`Synced ${count} news items`);
    return count;
  }

  /**
   * Sync all data for tracked symbols
   */
  async syncAllData(): Promise<void> {
    const stocks = await prisma.stock.findMany({
      select: { symbol: true },
      where: {
        exchange: { not: 'INDEX' }, // Skip indices
      },
    });

    logger.info(`Starting data sync for ${stocks.length} stocks...`);

    for (const stock of stocks) {
      await this.syncQuote(stock.symbol);
      // Add delay to respect rate limits (60 requests/minute for free tier)
      await new Promise(resolve => setTimeout(resolve, 1100));
    }

    await this.syncMarketNews();
    logger.info('Data sync completed');
  }

  /**
   * Get earnings calendar for a symbol
   * @param symbol Stock symbol
   * @param from Start date (YYYY-MM-DD)
   * @param to End date (YYYY-MM-DD)
   */
  async getEarningsCalendar(symbol: string, from: string, to: string): Promise<FinnhubEarning[]> {
    const result = await this.fetch<FinnhubEarningsCalendar>('/calendar/earnings', { symbol, from, to });
    if (!result || !result.earningsCalendar) {
      return [];
    }
    // Filter to only include the requested symbol
    return result.earningsCalendar.filter(e => e.symbol === symbol);
  }

  /**
   * Get dividend history for a symbol
   * @param symbol Stock symbol
   * @param from Start date (YYYY-MM-DD)
   * @param to End date (YYYY-MM-DD)
   */
  async getDividends(symbol: string, from: string, to: string): Promise<FinnhubDividend[]> {
    const result = await this.fetch<FinnhubDividend[]>('/stock/dividend', { symbol, from, to });
    return result || [];
  }

  /**
   * Get insider transactions for a symbol
   * @param symbol Stock symbol
   */
  async getInsiderTransactions(symbol: string): Promise<FinnhubInsiderTransaction[]> {
    const result = await this.fetch<FinnhubInsiderTransactions>('/stock/insider-transactions', { symbol });
    if (!result || !result.data) {
      return [];
    }
    return result.data;
  }

  /**
   * Get SEC filings for a symbol
   * @param symbol Stock symbol
   */
  async getSECFilings(symbol: string): Promise<FinnhubSECFiling[]> {
    const result = await this.fetch<FinnhubSECFiling[]>('/stock/filings', { symbol });
    return result || [];
  }

  /**
   * Get analyst recommendations for a symbol
   * @param symbol Stock symbol
   */
  async getRecommendations(symbol: string): Promise<FinnhubRecommendation[]> {
    const result = await this.fetch<FinnhubRecommendation[]>('/stock/recommendation', { symbol });
    return result || [];
  }

  /**
   * Get price target for a symbol
   * @param symbol Stock symbol
   */
  async getPriceTarget(symbol: string): Promise<FinnhubPriceTarget | null> {
    return this.fetch<FinnhubPriceTarget>('/stock/price-target', { symbol });
  }

  /**
   * Get basic financials for a symbol
   * @param symbol Stock symbol
   */
  async getBasicFinancials(symbol: string): Promise<FinnhubBasicFinancials | null> {
    return this.fetch<FinnhubBasicFinancials>('/stock/metric', { symbol, metric: 'all' });
  }
}

export const finnhubService = new FinnhubService();
