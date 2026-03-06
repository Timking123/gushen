import { redisHelpers } from '../lib/redis.js';
import { CacheKeys, CacheTTL } from '../lib/cache-keys.js';
import { logger } from '../utils/logger.js';
import { OHLCV } from './stockService.js';

/**
 * Fundamental metrics interface
 * Financial metrics for fundamental analysis
 * 
 * Implements Requirements 10.3: 基本面筛选条件
 */
export interface FundamentalMetrics {
  symbol: string;
  // Valuation ratios
  pe: number | null;              // Price to Earnings ratio
  forwardPe: number | null;       // Forward P/E ratio
  peg: number | null;             // Price/Earnings to Growth ratio
  ps: number | null;              // Price to Sales ratio
  pb: number | null;              // Price to Book ratio
  // Earnings metrics
  eps: number | null;             // Earnings Per Share
  epsGrowth: number | null;       // EPS Growth rate (%)
  // Revenue metrics
  revenue: number | null;         // Total revenue
  revenueGrowth: number | null;   // Revenue growth rate (%)
  // Margin metrics
  grossMargin: number | null;     // Gross margin (%)
  operatingMargin: number | null; // Operating margin (%)
  netMargin: number | null;       // Net profit margin (%)
  // Return metrics
  roe: number | null;             // Return on Equity (%)
  roa: number | null;             // Return on Assets (%)
  // Debt metrics
  debtToEquity: number | null;    // Debt to Equity ratio
  currentRatio: number | null;    // Current ratio
  // Dividend metrics
  dividendYield: number | null;   // Dividend yield (%)
  payoutRatio: number | null;     // Payout ratio (%)
}

/**
 * MACD indicator values
 */
export interface MACDValue {
  value: number;      // MACD line
  signal: number;     // Signal line
  histogram: number;  // MACD histogram
}

/**
 * Bollinger Bands values
 */
export interface BollingerBandsValue {
  upper: number;      // Upper band
  middle: number;     // Middle band (SMA)
  lower: number;      // Lower band
}

/**
 * Technical indicators interface
 * Technical analysis indicators calculated from price data
 * 
 * Implements Requirements 10.4, 16.1: 技术面筛选条件和技术指标
 */
export interface TechnicalIndicators {
  symbol: string;
  rsi14: number | null;                    // 14-period RSI
  macd: MACDValue | null;                  // MACD (12, 26, 9)
  sma20: number | null;                    // 20-period SMA
  sma50: number | null;                    // 50-period SMA
  sma200: number | null;                   // 200-period SMA
  ema12: number | null;                    // 12-period EMA
  ema26: number | null;                    // 26-period EMA
  bollingerBands: BollingerBandsValue | null;  // Bollinger Bands (20, 2)
  atr14: number | null;                    // 14-period ATR
  adx14: number | null;                    // 14-period ADX
}

/**
 * TechnicalIndicatorService - Handles technical indicator calculations
 * 
 * Implements Requirements:
 * - 10.3: 基本面筛选条件 (P/E, EPS增长率, 股息率, 负债率等)
 * - 10.4: 技术面筛选条件 (RSI, 移动平均线, 价格形态, 成交量等)
 * - 16.1: 技术指标叠加 (RSI, MACD, 布林带等)
 */
export class TechnicalIndicatorService {
  /**
   * Calculate Simple Moving Average (SMA)
   * SMA = Sum of closing prices over n periods / n
   * 
   * @param prices - Array of closing prices
   * @param period - Number of periods for the SMA
   * @returns SMA value or null if insufficient data
   */
  calculateSMA(prices: number[], period: number): number | null {
    if (prices.length < period || period <= 0) {
      return null;
    }

    const relevantPrices = prices.slice(-period);
    const sum = relevantPrices.reduce((acc, price) => acc + price, 0);
    return sum / period;
  }

  /**
   * Calculate Exponential Moving Average (EMA)
   * EMA = (Price * multiplier) + (Previous EMA * (1 - multiplier))
   * where multiplier = 2 / (period + 1)
   * 
   * @param prices - Array of closing prices
   * @param period - Number of periods for the EMA
   * @returns EMA value or null if insufficient data
   */
  calculateEMA(prices: number[], period: number): number | null {
    if (prices.length < period || period <= 0) {
      return null;
    }

    const multiplier = 2 / (period + 1);
    
    // Start with SMA for the first EMA value
    let ema = prices.slice(0, period).reduce((acc, price) => acc + price, 0) / period;
    
    // Calculate EMA for remaining prices
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  /**
   * Calculate all EMA values for a price series
   * Returns an array of EMA values for each point after the initial period
   * 
   * @param prices - Array of closing prices
   * @param period - Number of periods for the EMA
   * @returns Array of EMA values
   */
  calculateEMASeries(prices: number[], period: number): number[] {
    if (prices.length < period || period <= 0) {
      return [];
    }

    const multiplier = 2 / (period + 1);
    const emaValues: number[] = [];
    
    // Start with SMA for the first EMA value
    let ema = prices.slice(0, period).reduce((acc, price) => acc + price, 0) / period;
    emaValues.push(ema);
    
    // Calculate EMA for remaining prices
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
      emaValues.push(ema);
    }
    
    return emaValues;
  }

  /**
   * Calculate Relative Strength Index (RSI)
   * RSI = 100 - (100 / (1 + RS))
   * where RS = Average Gain / Average Loss
   * 
   * @param prices - Array of closing prices
   * @param period - Number of periods for RSI (default: 14)
   * @returns RSI value (0-100) or null if insufficient data
   */
  calculateRSI(prices: number[], period: number = 14): number | null {
    if (prices.length < period + 1 || period <= 0) {
      return null;
    }

    // Calculate price changes
    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    // Separate gains and losses
    const gains: number[] = changes.map(change => change > 0 ? change : 0);
    const losses: number[] = changes.map(change => change < 0 ? Math.abs(change) : 0);

    // Calculate initial average gain and loss using SMA
    let avgGain = gains.slice(0, period).reduce((acc, g) => acc + g, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((acc, l) => acc + l, 0) / period;

    // Use Wilder's smoothing method for subsequent values
    for (let i = period; i < changes.length; i++) {
      avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
      avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
    }

    // Avoid division by zero
    if (avgLoss === 0) {
      return avgGain === 0 ? 50 : 100;
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   * MACD Line = 12-period EMA - 26-period EMA
   * Signal Line = 9-period EMA of MACD Line
   * Histogram = MACD Line - Signal Line
   * 
   * @param prices - Array of closing prices
   * @param fastPeriod - Fast EMA period (default: 12)
   * @param slowPeriod - Slow EMA period (default: 26)
   * @param signalPeriod - Signal line period (default: 9)
   * @returns MACD values or null if insufficient data
   */
  calculateMACD(
    prices: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): MACDValue | null {
    // Need enough data for slow EMA + signal period
    if (prices.length < slowPeriod + signalPeriod - 1) {
      return null;
    }

    // Calculate EMA series for both fast and slow periods
    const fastEMASeries = this.calculateEMASeries(prices, fastPeriod);
    const slowEMASeries = this.calculateEMASeries(prices, slowPeriod);

    if (fastEMASeries.length === 0 || slowEMASeries.length === 0) {
      return null;
    }

    // Calculate MACD line series (align the series)
    // Fast EMA starts at index fastPeriod-1, Slow EMA starts at index slowPeriod-1
    const offset = slowPeriod - fastPeriod;
    const macdLine: number[] = [];
    
    for (let i = 0; i < slowEMASeries.length; i++) {
      const fastIndex = i + offset;
      if (fastIndex < fastEMASeries.length) {
        macdLine.push(fastEMASeries[fastIndex] - slowEMASeries[i]);
      }
    }

    if (macdLine.length < signalPeriod) {
      return null;
    }

    // Calculate signal line (EMA of MACD line)
    const signalMultiplier = 2 / (signalPeriod + 1);
    let signal = macdLine.slice(0, signalPeriod).reduce((acc, v) => acc + v, 0) / signalPeriod;
    
    for (let i = signalPeriod; i < macdLine.length; i++) {
      signal = (macdLine[i] * signalMultiplier) + (signal * (1 - signalMultiplier));
    }

    const macdValue = macdLine[macdLine.length - 1];
    const histogram = macdValue - signal;

    return {
      value: macdValue,
      signal: signal,
      histogram: histogram,
    };
  }

  /**
   * Calculate Bollinger Bands
   * Middle Band = 20-period SMA
   * Upper Band = Middle Band + (2 * Standard Deviation)
   * Lower Band = Middle Band - (2 * Standard Deviation)
   * 
   * @param prices - Array of closing prices
   * @param period - Number of periods (default: 20)
   * @param stdDevMultiplier - Standard deviation multiplier (default: 2)
   * @returns Bollinger Bands values or null if insufficient data
   */
  calculateBollingerBands(
    prices: number[],
    period: number = 20,
    stdDevMultiplier: number = 2
  ): BollingerBandsValue | null {
    if (prices.length < period || period <= 0) {
      return null;
    }

    const relevantPrices = prices.slice(-period);
    
    // Calculate middle band (SMA)
    const middle = relevantPrices.reduce((acc, price) => acc + price, 0) / period;
    
    // Calculate standard deviation
    const squaredDiffs = relevantPrices.map(price => Math.pow(price - middle, 2));
    const variance = squaredDiffs.reduce((acc, diff) => acc + diff, 0) / period;
    const stdDev = Math.sqrt(variance);
    
    // Calculate upper and lower bands
    const upper = middle + (stdDevMultiplier * stdDev);
    const lower = middle - (stdDevMultiplier * stdDev);

    return {
      upper,
      middle,
      lower,
    };
  }

  /**
   * Calculate True Range for a single period
   * TR = max(High - Low, |High - Previous Close|, |Low - Previous Close|)
   * 
   * @param high - Current high price
   * @param low - Current low price
   * @param previousClose - Previous closing price
   * @returns True Range value
   */
  private calculateTrueRange(high: number, low: number, previousClose: number): number {
    const highLow = high - low;
    const highPrevClose = Math.abs(high - previousClose);
    const lowPrevClose = Math.abs(low - previousClose);
    
    return Math.max(highLow, highPrevClose, lowPrevClose);
  }

  /**
   * Calculate Average True Range (ATR)
   * ATR = Smoothed average of True Range over n periods
   * 
   * @param ohlcvData - Array of OHLCV data
   * @param period - Number of periods (default: 14)
   * @returns ATR value or null if insufficient data
   */
  calculateATR(ohlcvData: OHLCV[], period: number = 14): number | null {
    if (ohlcvData.length < period + 1 || period <= 0) {
      return null;
    }

    // Calculate True Range for each period
    const trueRanges: number[] = [];
    for (let i = 1; i < ohlcvData.length; i++) {
      const tr = this.calculateTrueRange(
        ohlcvData[i].high,
        ohlcvData[i].low,
        ohlcvData[i - 1].close
      );
      trueRanges.push(tr);
    }

    // Calculate initial ATR using simple average
    let atr = trueRanges.slice(0, period).reduce((acc, tr) => acc + tr, 0) / period;

    // Use Wilder's smoothing for subsequent values
    for (let i = period; i < trueRanges.length; i++) {
      atr = ((atr * (period - 1)) + trueRanges[i]) / period;
    }

    return atr;
  }

  /**
   * Calculate Average Directional Index (ADX)
   * ADX measures trend strength regardless of direction
   * 
   * @param ohlcvData - Array of OHLCV data
   * @param period - Number of periods (default: 14)
   * @returns ADX value (0-100) or null if insufficient data
   */
  calculateADX(ohlcvData: OHLCV[], period: number = 14): number | null {
    // Need at least 2*period data points for proper ADX calculation
    if (ohlcvData.length < 2 * period || period <= 0) {
      return null;
    }

    // Calculate +DM, -DM, and TR for each period
    const plusDM: number[] = [];
    const minusDM: number[] = [];
    const trueRanges: number[] = [];

    for (let i = 1; i < ohlcvData.length; i++) {
      const highDiff = ohlcvData[i].high - ohlcvData[i - 1].high;
      const lowDiff = ohlcvData[i - 1].low - ohlcvData[i].low;

      // +DM
      if (highDiff > lowDiff && highDiff > 0) {
        plusDM.push(highDiff);
      } else {
        plusDM.push(0);
      }

      // -DM
      if (lowDiff > highDiff && lowDiff > 0) {
        minusDM.push(lowDiff);
      } else {
        minusDM.push(0);
      }

      // True Range
      const tr = this.calculateTrueRange(
        ohlcvData[i].high,
        ohlcvData[i].low,
        ohlcvData[i - 1].close
      );
      trueRanges.push(tr);
    }

    // Calculate smoothed values using Wilder's smoothing
    let smoothedPlusDM = plusDM.slice(0, period).reduce((acc, v) => acc + v, 0);
    let smoothedMinusDM = minusDM.slice(0, period).reduce((acc, v) => acc + v, 0);
    let smoothedTR = trueRanges.slice(0, period).reduce((acc, v) => acc + v, 0);

    // Calculate DX values
    const dxValues: number[] = [];

    for (let i = period; i < plusDM.length; i++) {
      // Wilder's smoothing
      smoothedPlusDM = smoothedPlusDM - (smoothedPlusDM / period) + plusDM[i];
      smoothedMinusDM = smoothedMinusDM - (smoothedMinusDM / period) + minusDM[i];
      smoothedTR = smoothedTR - (smoothedTR / period) + trueRanges[i];

      // Calculate +DI and -DI
      const plusDI = smoothedTR !== 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
      const minusDI = smoothedTR !== 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;

      // Calculate DX
      const diSum = plusDI + minusDI;
      const dx = diSum !== 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
      dxValues.push(dx);
    }

    if (dxValues.length < period) {
      return null;
    }

    // Calculate ADX as smoothed average of DX
    let adx = dxValues.slice(0, period).reduce((acc, dx) => acc + dx, 0) / period;

    for (let i = period; i < dxValues.length; i++) {
      adx = ((adx * (period - 1)) + dxValues[i]) / period;
    }

    return adx;
  }

  /**
   * Calculate all technical indicators for a stock
   * 
   * @param symbol - Stock symbol
   * @param ohlcvData - Array of OHLCV data (sorted by timestamp ascending)
   * @returns Technical indicators object
   * 
   * Implements Requirements 16.1: 技术指标叠加 (RSI, MACD, 布林带等)
   */
  calculateTechnicalIndicators(symbol: string, ohlcvData: OHLCV[]): TechnicalIndicators {
    // Extract closing prices for calculations
    const closingPrices = ohlcvData.map(d => d.close);

    return {
      symbol: symbol.toUpperCase(),
      rsi14: this.calculateRSI(closingPrices, 14),
      macd: this.calculateMACD(closingPrices, 12, 26, 9),
      sma20: this.calculateSMA(closingPrices, 20),
      sma50: this.calculateSMA(closingPrices, 50),
      sma200: this.calculateSMA(closingPrices, 200),
      ema12: this.calculateEMA(closingPrices, 12),
      ema26: this.calculateEMA(closingPrices, 26),
      bollingerBands: this.calculateBollingerBands(closingPrices, 20, 2),
      atr14: this.calculateATR(ohlcvData, 14),
      adx14: this.calculateADX(ohlcvData, 14),
    };
  }

  /**
   * Get technical indicators for a stock with caching
   * 
   * @param symbol - Stock symbol
   * @param ohlcvData - Array of OHLCV data
   * @returns Technical indicators object
   */
  async getTechnicalIndicators(symbol: string, ohlcvData: OHLCV[]): Promise<TechnicalIndicators> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check cache first
    const cacheKey = CacheKeys.stock.technicals(normalizedSymbol);
    try {
      const cachedIndicators = await redisHelpers.getJson<TechnicalIndicators>(cacheKey);
      if (cachedIndicators) {
        logger.debug(`Technical indicators cache hit for symbol: ${normalizedSymbol}`);
        return cachedIndicators;
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Calculate indicators
    const indicators = this.calculateTechnicalIndicators(normalizedSymbol, ohlcvData);

    // Cache results
    try {
      await redisHelpers.setJson(cacheKey, indicators, CacheTTL.technicals);
      logger.debug(`Technical indicators cached for symbol: ${normalizedSymbol}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return indicators;
  }

  /**
   * Calculate fundamental metrics from financial data
   * This is a placeholder that would typically integrate with financial data APIs
   * 
   * @param symbol - Stock symbol
   * @param financialData - Financial data object
   * @returns Fundamental metrics object
   * 
   * Implements Requirements 10.3: 基本面筛选条件
   */
  calculateFundamentalMetrics(
    symbol: string,
    financialData: {
      price?: number;
      earnings?: number;
      forwardEarnings?: number;
      earningsGrowth?: number;
      sales?: number;
      bookValue?: number;
      eps?: number;
      epsGrowth?: number;
      revenue?: number;
      revenueGrowth?: number;
      grossProfit?: number;
      operatingIncome?: number;
      netIncome?: number;
      totalEquity?: number;
      totalAssets?: number;
      totalDebt?: number;
      currentAssets?: number;
      currentLiabilities?: number;
      dividendPerShare?: number;
      sharesOutstanding?: number;
    }
  ): FundamentalMetrics {
    const {
      price,
      earnings,
      forwardEarnings,
      earningsGrowth,
      sales,
      bookValue,
      eps,
      epsGrowth,
      revenue,
      revenueGrowth,
      grossProfit,
      operatingIncome,
      netIncome,
      totalEquity,
      totalAssets,
      totalDebt,
      currentAssets,
      currentLiabilities,
      dividendPerShare,
      sharesOutstanding,
    } = financialData;

    // Calculate P/E ratio
    const pe = price && earnings && earnings !== 0 ? price / earnings : null;
    
    // Calculate Forward P/E
    const forwardPe = price && forwardEarnings && forwardEarnings !== 0 
      ? price / forwardEarnings 
      : null;
    
    // Calculate PEG ratio
    const peg = pe && earningsGrowth && earningsGrowth !== 0 
      ? pe / earningsGrowth 
      : null;
    
    // Calculate P/S ratio
    const ps = price && sales && sales !== 0 && sharesOutstanding
      ? (price * sharesOutstanding) / sales 
      : null;
    
    // Calculate P/B ratio
    const pb = price && bookValue && bookValue !== 0 
      ? price / bookValue 
      : null;

    // Calculate margins
    const grossMargin = revenue && grossProfit && revenue !== 0 
      ? (grossProfit / revenue) * 100 
      : null;
    
    const operatingMargin = revenue && operatingIncome && revenue !== 0 
      ? (operatingIncome / revenue) * 100 
      : null;
    
    const netMargin = revenue && netIncome && revenue !== 0 
      ? (netIncome / revenue) * 100 
      : null;

    // Calculate return metrics
    const roe = totalEquity && netIncome && totalEquity !== 0 
      ? (netIncome / totalEquity) * 100 
      : null;
    
    const roa = totalAssets && netIncome && totalAssets !== 0 
      ? (netIncome / totalAssets) * 100 
      : null;

    // Calculate debt metrics
    const debtToEquity = totalEquity && totalDebt && totalEquity !== 0 
      ? totalDebt / totalEquity 
      : null;
    
    const currentRatio = currentLiabilities && currentAssets && currentLiabilities !== 0 
      ? currentAssets / currentLiabilities 
      : null;

    // Calculate dividend metrics
    const dividendYield = price && dividendPerShare && price !== 0 
      ? (dividendPerShare / price) * 100 
      : null;
    
    const payoutRatio = eps && dividendPerShare && eps !== 0 
      ? (dividendPerShare / eps) * 100 
      : null;

    return {
      symbol: symbol.toUpperCase(),
      pe,
      forwardPe,
      peg,
      ps,
      pb,
      eps: eps ?? null,
      epsGrowth: epsGrowth ?? null,
      revenue: revenue ?? null,
      revenueGrowth: revenueGrowth ?? null,
      grossMargin,
      operatingMargin,
      netMargin,
      roe,
      roa,
      debtToEquity,
      currentRatio,
      dividendYield,
      payoutRatio,
    };
  }

  /**
   * Get fundamental metrics for a stock with caching
   * 
   * @param symbol - Stock symbol
   * @param financialData - Financial data object
   * @returns Fundamental metrics object
   */
  async getFundamentalMetrics(
    symbol: string,
    financialData: Parameters<typeof this.calculateFundamentalMetrics>[1]
  ): Promise<FundamentalMetrics> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check cache first
    const cacheKey = CacheKeys.stock.fundamentals(normalizedSymbol);
    try {
      const cachedMetrics = await redisHelpers.getJson<FundamentalMetrics>(cacheKey);
      if (cachedMetrics) {
        logger.debug(`Fundamental metrics cache hit for symbol: ${normalizedSymbol}`);
        return cachedMetrics;
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Calculate metrics
    const metrics = this.calculateFundamentalMetrics(normalizedSymbol, financialData);

    // Cache results
    try {
      await redisHelpers.setJson(cacheKey, metrics, CacheTTL.fundamentals);
      logger.debug(`Fundamental metrics cached for symbol: ${normalizedSymbol}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return metrics;
  }
}

// Export singleton instance
export const technicalIndicatorService = new TechnicalIndicatorService();
