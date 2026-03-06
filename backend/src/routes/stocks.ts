import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { stockService, TimeRange } from '../services/stockService.js';
import { technicalIndicatorService } from '../services/technicalIndicatorService.js';
import { heatmapService } from '../services/heatmapService.js';
import { finnhubService } from '../services/finnhubService.js';
import { redisHelpers } from '../lib/redis.js';
import { CacheKeys, CacheTTL } from '../lib/cache-keys.js';
import { logger } from '../utils/logger.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { ApiResponse } from '../types/index.js';

const router = Router();

// Validation schemas using Zod
const searchQuerySchema = z.object({
  q: z
    .string()
    .min(1, '搜索关键词不能为空')
    .max(100, '搜索关键词过长'),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => !isNaN(val) && val > 0 && val <= 100, {
      message: '返回数量必须在1-100之间',
    }),
});

const symbolParamSchema = z.object({
  symbol: z
    .string()
    .min(1, '股票代码不能为空')
    .max(20, '股票代码过长')
    .regex(/^[A-Za-z0-9.]+$/, '股票代码格式无效'),
});

// Valid time ranges for historical data
const validTimeRanges = ['1D', '5D', '1M', '3M', '6M', '1Y', '5Y', 'MAX'] as const;

const historyQuerySchema = z.object({
  range: z
    .string()
    .optional()
    .default('1M')
    .refine((val) => validTimeRanges.includes(val as TimeRange), {
      message: `时间范围必须是以下之一: ${validTimeRanges.join(', ')}`,
    })
    .transform((val) => val as TimeRange),
});

// ============================================================================
// IMPORTANT: Static routes MUST be defined BEFORE dynamic :symbol routes
// to prevent route matching issues (e.g., /market/heatmap being matched as /:symbol)
// ============================================================================

// Validation schema for heatmap query
// Implements Requirements 14.1-14.6: Sector/industry filtering support
const heatmapQuerySchema = z.object({
  groupBy: z
    .enum(['sector', 'marketCap', 'industry'])
    .optional()
    .default('sector'),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .refine((val) => !isNaN(val) && val > 0 && val <= 100, {
      message: '每组股票数量必须在1-100之间',
    }),
  // Sector filter - supports comma-separated values for multi-select
  // Implements Requirements 14.2, 14.4, 14.6
  sectors: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim() === '') return undefined;
      return val.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }),
  // Industry filter - supports comma-separated values for multi-select
  // Implements Requirements 14.3, 14.6
  industries: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim() === '') return undefined;
      return val.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }),
  // Minimum market cap filter
  minMarketCap: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const num = parseFloat(val);
      return isNaN(num) || num < 0 ? undefined : num;
    }),
  // Maximum market cap filter
  maxMarketCap: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const num = parseFloat(val);
      return isNaN(num) || num < 0 ? undefined : num;
    }),
  // Hide stocks with zero price (default: true)
  hideZeroPrice: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'false' || val === '0') return false;
      return true; // Default to true
    }),
});

/**
 * GET /api/stocks/market/heatmap
 * Get market heatmap data grouped by sector, market cap, or industry
 * Implements Requirements 4.4, 18.2, 18.6, 14.1-14.6
 * 
 * IMPORTANT: This route MUST be defined BEFORE /:symbol routes
 */
router.get(
  '/market/heatmap',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query parameters
      const validationResult = heatmapQuerySchema.safeParse(req.query);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('查询参数验证失败', errors);
      }

      const { groupBy, limit, sectors, industries, minMarketCap, maxMarketCap, hideZeroPrice } = validationResult.data;

      // Build filters object
      const filters: {
        sectors?: string[];
        industries?: string[];
        minMarketCap?: number;
        maxMarketCap?: number;
        hideZeroPrice?: boolean;
      } = {};

      if (sectors && sectors.length > 0) {
        filters.sectors = sectors;
      }
      if (industries && industries.length > 0) {
        filters.industries = industries;
      }
      if (minMarketCap !== undefined) {
        filters.minMarketCap = minMarketCap;
      }
      if (maxMarketCap !== undefined) {
        filters.maxMarketCap = maxMarketCap;
      }
      filters.hideZeroPrice = hideZeroPrice;

      // Get heatmap data with filters
      const heatmapData = await heatmapService.getHeatmapData(groupBy, filters, limit);

      const response: ApiResponse = {
        success: true,
        data: heatmapData,
        message: '获取热力图数据成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/stocks/market/sectors
 * Get list of available sectors for heatmap filtering
 * 
 * IMPORTANT: This route MUST be defined BEFORE /:symbol routes
 */
router.get(
  '/market/sectors',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sectors = await heatmapService.getAvailableSectors();

      const response: ApiResponse = {
        success: true,
        data: sectors,
        message: '获取板块列表成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/stocks/market/industries
 * Get list of available industries with their sector and stock count
 * Implements Requirement 14.1: Display sector/industry filter dropdown
 * 
 * IMPORTANT: This route MUST be defined BEFORE /:symbol routes
 */
router.get(
  '/market/industries',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sector = req.query.sector as string | undefined;

      let industries;
      if (sector && sector.trim() !== '') {
        // Get industries for a specific sector
        const industryNames = await heatmapService.getIndustriesBySector(sector);
        industries = industryNames.map(name => ({
          name,
          sector,
          stockCount: 0, // Count not available when filtering by sector
        }));
      } else {
        // Get all industries with full info
        industries = await heatmapService.getAvailableIndustries();
      }

      const response: ApiResponse = {
        success: true,
        data: {
          industries,
          count: industries.length,
        },
        message: '获取行业列表成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/stocks/search
 * Search stocks by symbol or name
 * Implements Requirement 1.1: Display matching stocks for user selection
 * 
 * Query Parameters:
 * - q: Search query (required)
 * - limit: Maximum number of results (optional, default: 20, max: 100)
 */
router.get(
  '/search',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query parameters
      const validationResult = searchQuerySchema.safeParse(req.query);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('搜索参数验证失败', errors);
      }

      const { q, limit } = validationResult.data;

      // Search stocks
      const results = await stockService.searchStocks(q, limit);

      const response: ApiResponse = {
        success: true,
        data: {
          query: q,
          count: results.length,
          stocks: results,
        },
        message: results.length > 0 ? '搜索成功' : '未找到匹配的股票',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/stocks/:symbol/quote
 * Get real-time stock quote by symbol
 * Implements Requirement 4.1: Display interactive K-line chart and volume chart
 * 
 * Path Parameters:
 * - symbol: Stock symbol (required)
 */
router.get(
  '/:symbol/quote',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate path parameter
      const validationResult = symbolParamSchema.safeParse(req.params);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('股票代码验证失败', errors);
      }

      const { symbol } = validationResult.data;

      // Get stock quote
      const quote = await stockService.getQuote(symbol);

      if (!quote) {
        throw new NotFoundError('未找到该股票的行情数据');
      }

      const response: ApiResponse = {
        success: true,
        data: quote,
        message: '获取行情成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/stocks/:symbol/history
 * Get historical OHLCV data for a stock
 * Implements Requirement 4.3: Dynamically update chart to display data for selected time range
 * 
 * Path Parameters:
 * - symbol: Stock symbol (required)
 * 
 * Query Parameters:
 * - range: Time range (optional, default: '1M')
 *   Valid values: '1D', '5D', '1M', '3M', '6M', '1Y', '5Y', 'MAX'
 */
router.get(
  '/:symbol/history',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate path parameter
      const symbolValidation = symbolParamSchema.safeParse(req.params);

      if (!symbolValidation.success) {
        const errors: Record<string, string[]> = {};
        symbolValidation.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('股票代码验证失败', errors);
      }

      // Validate query parameters
      const queryValidation = historyQuerySchema.safeParse(req.query);

      if (!queryValidation.success) {
        const errors: Record<string, string[]> = {};
        queryValidation.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('查询参数验证失败', errors);
      }

      const { symbol } = symbolValidation.data;
      const { range } = queryValidation.data;

      // Get historical data
      const historicalData = await stockService.getHistoricalData(symbol, range);

      const response: ApiResponse = {
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          range,
          count: historicalData.length,
          data: historicalData,
        },
        message: historicalData.length > 0 ? '获取历史数据成功' : '暂无历史数据',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Validation schema for technical indicators query
const technicalIndicatorsQuerySchema = z.object({
  range: z
    .string()
    .optional()
    .default('1M')
    .refine((val) => validTimeRanges.includes(val as TimeRange), {
      message: `时间范围必须是以下之一: ${validTimeRanges.join(', ')}`,
    })
    .transform((val) => val as TimeRange),
  // SMA periods (comma-separated)
  smaPeriods: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return [20, 50, 200];
      return val.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p) && p > 0 && p <= 500);
    }),
  // RSI period
  rsiPeriod: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return 14;
      const period = parseInt(val, 10);
      return !isNaN(period) && period > 0 && period <= 100 ? period : 14;
    }),
  // MACD parameters (fast,slow,signal)
  macdParams: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return { fast: 12, slow: 26, signal: 9 };
      const parts = val.split(',').map(p => parseInt(p.trim(), 10));
      if (parts.length === 3 && parts.every(p => !isNaN(p) && p > 0 && p <= 100)) {
        return { fast: parts[0], slow: parts[1], signal: parts[2] };
      }
      return { fast: 12, slow: 26, signal: 9 };
    }),
  // Bollinger Bands parameters (period,stdDev)
  bbParams: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return { period: 20, stdDev: 2 };
      const parts = val.split(',').map(p => parseFloat(p.trim()));
      if (parts.length === 2 && parts.every(p => !isNaN(p) && p > 0)) {
        return { period: Math.floor(parts[0]), stdDev: parts[1] };
      }
      return { period: 20, stdDev: 2 };
    }),
});

/**
 * GET /api/stocks/:symbol/indicators
 * Get technical indicators for a stock with customizable parameters
 * Implements Requirements 16.1, 16.4: Technical indicator overlays with customizable parameters
 * 
 * Path Parameters:
 * - symbol: Stock symbol (required)
 * 
 * Query Parameters:
 * - range: Time range for historical data (optional, default: '1M')
 * - smaPeriods: Comma-separated SMA periods (optional, default: '20,50,200')
 * - rsiPeriod: RSI period (optional, default: 14)
 * - macdParams: MACD parameters as 'fast,slow,signal' (optional, default: '12,26,9')
 * - bbParams: Bollinger Bands parameters as 'period,stdDev' (optional, default: '20,2')
 */
router.get(
  '/:symbol/indicators',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate path parameter
      const symbolValidation = symbolParamSchema.safeParse(req.params);

      if (!symbolValidation.success) {
        const errors: Record<string, string[]> = {};
        symbolValidation.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('股票代码验证失败', errors);
      }

      // Validate query parameters
      const queryValidation = technicalIndicatorsQuerySchema.safeParse(req.query);

      if (!queryValidation.success) {
        const errors: Record<string, string[]> = {};
        queryValidation.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('查询参数验证失败', errors);
      }

      const { symbol } = symbolValidation.data;
      const { range, smaPeriods, rsiPeriod, macdParams, bbParams } = queryValidation.data;

      // Get historical data first
      const historicalData = await stockService.getHistoricalData(symbol, range);

      if (historicalData.length === 0) {
        throw new NotFoundError('暂无历史数据，无法计算技术指标');
      }

      // Extract closing prices
      const closingPrices = historicalData.map(d => d.close);

      // Calculate indicators with custom parameters
      const indicators: Record<string, unknown> = {
        symbol: symbol.toUpperCase(),
        range,
        dataPoints: historicalData.length,
      };

      // Calculate SMAs for each period
      const smaValues: Record<string, number | null> = {};
      for (const period of smaPeriods) {
        smaValues[`sma${period}`] = technicalIndicatorService.calculateSMA(closingPrices, period);
      }
      indicators.sma = smaValues;

      // Calculate SMA series for chart overlay
      const smaSeries: Record<string, { timestamp: string; value: number }[]> = {};
      for (const period of smaPeriods) {
        const series: { timestamp: string; value: number }[] = [];
        for (let i = period - 1; i < historicalData.length; i++) {
          const smaValue = technicalIndicatorService.calculateSMA(
            closingPrices.slice(0, i + 1),
            period
          );
          if (smaValue !== null) {
            series.push({
              timestamp: historicalData[i].timestamp.toISOString(),
              value: smaValue,
            });
          }
        }
        smaSeries[`sma${period}`] = series;
      }
      indicators.smaSeries = smaSeries;

      // Calculate RSI
      indicators.rsi = {
        period: rsiPeriod,
        value: technicalIndicatorService.calculateRSI(closingPrices, rsiPeriod),
      };

      // Calculate RSI series for chart
      const rsiSeries: { timestamp: string; value: number }[] = [];
      for (let i = rsiPeriod; i < historicalData.length; i++) {
        const rsiValue = technicalIndicatorService.calculateRSI(
          closingPrices.slice(0, i + 1),
          rsiPeriod
        );
        if (rsiValue !== null) {
          rsiSeries.push({
            timestamp: historicalData[i].timestamp.toISOString(),
            value: rsiValue,
          });
        }
      }
      indicators.rsiSeries = rsiSeries;

      // Calculate MACD
      const macdValue = technicalIndicatorService.calculateMACD(
        closingPrices,
        macdParams.fast,
        macdParams.slow,
        macdParams.signal
      );
      indicators.macd = {
        params: macdParams,
        ...macdValue,
      };

      // Calculate MACD series for chart
      const macdSeries: { timestamp: string; value: number; signal: number; histogram: number }[] = [];
      const minMacdDataPoints = macdParams.slow + macdParams.signal - 1;
      for (let i = minMacdDataPoints; i < historicalData.length; i++) {
        const macdVal = technicalIndicatorService.calculateMACD(
          closingPrices.slice(0, i + 1),
          macdParams.fast,
          macdParams.slow,
          macdParams.signal
        );
        if (macdVal !== null) {
          macdSeries.push({
            timestamp: historicalData[i].timestamp.toISOString(),
            value: macdVal.value,
            signal: macdVal.signal,
            histogram: macdVal.histogram,
          });
        }
      }
      indicators.macdSeries = macdSeries;

      // Calculate Bollinger Bands
      const bbValue = technicalIndicatorService.calculateBollingerBands(
        closingPrices,
        bbParams.period,
        bbParams.stdDev
      );
      indicators.bollingerBands = {
        params: bbParams,
        ...bbValue,
      };

      // Calculate Bollinger Bands series for chart
      const bbSeries: { timestamp: string; upper: number; middle: number; lower: number }[] = [];
      for (let i = bbParams.period - 1; i < historicalData.length; i++) {
        const bbVal = technicalIndicatorService.calculateBollingerBands(
          closingPrices.slice(0, i + 1),
          bbParams.period,
          bbParams.stdDev
        );
        if (bbVal !== null) {
          bbSeries.push({
            timestamp: historicalData[i].timestamp.toISOString(),
            upper: bbVal.upper,
            middle: bbVal.middle,
            lower: bbVal.lower,
          });
        }
      }
      indicators.bollingerBandsSeries = bbSeries;

      const response: ApiResponse = {
        success: true,
        data: indicators,
        message: '获取技术指标成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Stock event type for timeline markers
 */
type StockEventType = 'news' | 'earnings' | 'dividend' | 'insider' | 'sec_filing';

/**
 * Stock event interface for chart timeline markers
 */
interface StockEvent {
  id: string;
  symbol: string;
  type: StockEventType;
  title: string;
  summary: string;
  timestamp: string;
  impact?: {
    direction: 'bullish' | 'bearish' | 'neutral';
    magnitude: 'high' | 'medium' | 'low';
  };
  url?: string;
}

/**
 * Format date to YYYY-MM-DD string
 */
function formatDateToYYYYMMDD(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Fetch real stock events from Finnhub API
 * Combines earnings, dividends, insider transactions, SEC filings, and news
 */
async function fetchRealEvents(symbol: string, startDate: Date, endDate: Date): Promise<StockEvent[]> {
  const events: StockEvent[] = [];
  const fromStr = formatDateToYYYYMMDD(startDate);
  const toStr = formatDateToYYYYMMDD(endDate);

  // Fetch all event types in parallel
  const [earnings, dividends, insiderTrades, secFilings, news] = await Promise.all([
    finnhubService.getEarningsCalendar(symbol, fromStr, toStr).catch(() => []),
    finnhubService.getDividends(symbol, fromStr, toStr).catch(() => []),
    finnhubService.getInsiderTransactions(symbol).catch(() => []),
    finnhubService.getSECFilings(symbol).catch(() => []),
    finnhubService.getCompanyNews(symbol, fromStr, toStr).catch(() => []),
  ]);

  // Process earnings events
  for (const earning of earnings) {
    const eventDate = new Date(earning.date);
    if (eventDate >= startDate && eventDate <= endDate) {
      const hasActual = earning.epsActual !== null;
      const beat = hasActual && earning.epsEstimate !== null && earning.epsActual! > earning.epsEstimate;
      const miss = hasActual && earning.epsEstimate !== null && earning.epsActual! < earning.epsEstimate;
      
      events.push({
        id: `${symbol}-earnings-${earning.date}-Q${earning.quarter}`,
        symbol,
        type: 'earnings',
        title: hasActual 
          ? `${symbol} Q${earning.quarter} ${earning.year} 财报${beat ? '超预期' : miss ? '不及预期' : '符合预期'}`
          : `${symbol} Q${earning.quarter} ${earning.year} 财报预告`,
        summary: hasActual
          ? `EPS: $${earning.epsActual?.toFixed(2)} (预期: $${earning.epsEstimate?.toFixed(2) || 'N/A'})${earning.revenueActual ? `, 营收: $${(earning.revenueActual / 1e9).toFixed(2)}B` : ''}`
          : `预期EPS: $${earning.epsEstimate?.toFixed(2) || 'N/A'}${earning.revenueEstimate ? `, 预期营收: $${(earning.revenueEstimate / 1e9).toFixed(2)}B` : ''}`,
        timestamp: eventDate.toISOString(),
        impact: {
          direction: beat ? 'bullish' : miss ? 'bearish' : 'neutral',
          magnitude: 'high',
        },
      });
    }
  }

  // Process dividend events
  for (const dividend of dividends) {
    const eventDate = new Date(dividend.date);
    if (eventDate >= startDate && eventDate <= endDate) {
      events.push({
        id: `${symbol}-dividend-${dividend.date}`,
        symbol,
        type: 'dividend',
        title: `${symbol} 派发股息 $${dividend.amount.toFixed(4)}`,
        summary: `除息日: ${dividend.date}${dividend.payDate ? `, 支付日: ${dividend.payDate}` : ''}`,
        timestamp: eventDate.toISOString(),
        impact: {
          direction: 'neutral',
          magnitude: 'low',
        },
      });
    }
  }

  // Process insider transactions (filter by date range)
  for (const trade of insiderTrades) {
    const eventDate = new Date(trade.filingDate);
    if (eventDate >= startDate && eventDate <= endDate) {
      const isBuy = trade.change > 0;
      const transactionValue = Math.abs(trade.change * trade.transactionPrice);
      const magnitude = transactionValue > 1000000 ? 'high' : transactionValue > 100000 ? 'medium' : 'low';
      
      events.push({
        id: `${symbol}-insider-${trade.filingDate}-${trade.name.replace(/\s+/g, '-')}`,
        symbol,
        type: 'insider',
        title: `${trade.name} ${isBuy ? '买入' : '卖出'} ${Math.abs(trade.change).toLocaleString()} 股`,
        summary: `交易价格: $${trade.transactionPrice.toFixed(2)}, 交易金额: $${transactionValue.toLocaleString()}`,
        timestamp: eventDate.toISOString(),
        impact: {
          direction: isBuy ? 'bullish' : 'bearish',
          magnitude,
        },
      });
    }
  }

  // Process SEC filings (filter by date range)
  for (const filing of secFilings) {
    const eventDate = new Date(filing.filedDate);
    if (eventDate >= startDate && eventDate <= endDate) {
      // Determine importance based on form type
      const importantForms = ['10-K', '10-Q', '8-K', 'S-1', 'DEF 14A'];
      const isImportant = importantForms.some(f => filing.form.includes(f));
      
      const formDescriptions: Record<string, string> = {
        '10-K': '年度报告',
        '10-Q': '季度报告',
        '8-K': '重大事项报告',
        'S-1': '首次公开发行注册',
        'DEF 14A': '股东大会代理声明',
        '4': '内部人士持股变动',
        '13F': '机构持仓报告',
      };
      
      const formDesc = Object.entries(formDescriptions).find(([key]) => filing.form.includes(key))?.[1] || filing.form;
      
      events.push({
        id: `${symbol}-sec-${filing.accessNumber}`,
        symbol,
        type: 'sec_filing',
        title: `${symbol} 提交 ${filing.form} (${formDesc})`,
        summary: `提交日期: ${filing.filedDate}`,
        timestamp: eventDate.toISOString(),
        url: filing.reportUrl || filing.filingUrl,
        impact: isImportant ? {
          direction: 'neutral',
          magnitude: filing.form.includes('8-K') ? 'high' : 'medium',
        } : undefined,
      });
    }
  }

  // Process news events
  if (news) {
    for (const item of news.slice(0, 10)) { // Limit to 10 news items
      const eventDate = new Date(item.datetime * 1000);
      if (eventDate >= startDate && eventDate <= endDate) {
        events.push({
          id: `${symbol}-news-${item.id}`,
          symbol,
          type: 'news',
          title: item.headline,
          summary: item.summary || '点击查看详情',
          timestamp: eventDate.toISOString(),
          url: item.url,
          impact: {
            direction: 'neutral',
            magnitude: 'low',
          },
        });
      }
    }
  }

  // Sort events by timestamp (newest first)
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return events;
}

/**
 * GET /api/stocks/:symbol/events
 * Get stock events for chart timeline markers
 * Implements Requirements 4.2, 4.5: Event markers on timeline with hover details
 * 
 * Path Parameters:
 * - symbol: Stock symbol (required)
 * 
 * Query Parameters:
 * - range: Time range for events (optional, default: '1M')
 */
router.get(
  '/:symbol/events',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate path parameter
      const symbolValidation = symbolParamSchema.safeParse(req.params);

      if (!symbolValidation.success) {
        const errors: Record<string, string[]> = {};
        symbolValidation.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('股票代码验证失败', errors);
      }

      // Validate query parameters
      const queryValidation = historyQuerySchema.safeParse(req.query);

      if (!queryValidation.success) {
        const errors: Record<string, string[]> = {};
        queryValidation.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('查询参数验证失败', errors);
      }

      const { symbol } = symbolValidation.data;
      const { range } = queryValidation.data;
      const normalizedSymbol = symbol.toUpperCase();

      // Check cache first
      const cacheKey = CacheKeys.events.stock(normalizedSymbol, range);
      try {
        const cachedEvents = await redisHelpers.getJson<StockEvent[]>(cacheKey);
        if (cachedEvents) {
          logger.debug(`Events cache hit for symbol: ${normalizedSymbol}, range: ${range}`);
          const response: ApiResponse = {
            success: true,
            data: cachedEvents,
            message: cachedEvents.length > 0 ? '获取事件成功' : '暂无事件数据',
          };
          res.status(200).json(response);
          return;
        }
      } catch (error) {
        logger.warn('Redis cache read error:', error);
      }

      // Calculate date range based on time range
      const now = new Date();
      let startDate: Date;
      
      switch (range) {
        case '1D':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '5D':
          startDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
          break;
        case '1M':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '3M':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '6M':
          startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        case '1Y':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        case '5Y':
          startDate = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
          break;
        case 'MAX':
        default:
          startDate = new Date(now.getTime() - 10 * 365 * 24 * 60 * 60 * 1000);
          break;
      }

      // Fetch real events from Finnhub API
      const events: StockEvent[] = await fetchRealEvents(normalizedSymbol, startDate, now);

      // Cache the result
      try {
        await redisHelpers.setJson(cacheKey, events, CacheTTL.events);
        logger.debug(`Events cached for symbol: ${normalizedSymbol}, range: ${range}`);
      } catch (error) {
        logger.warn('Redis cache write error:', error);
      }

      const response: ApiResponse = {
        success: true,
        data: events,
        message: events.length > 0 ? '获取事件成功' : '暂无事件数据',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/stocks/:symbol/full-detail
 * Get complete stock detail information including profile, quote, financials, analyst ratings, and insider trades
 * Implements Requirements 2.1-2.5, 4.1-4.6, 6.1-6.6, 7.1-7.5, 8.1-8.6
 * 
 * Path Parameters:
 * - symbol: Stock symbol (required)
 */
router.get(
  '/:symbol/full-detail',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate path parameter
      const validationResult = symbolParamSchema.safeParse(req.params);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('股票代码验证失败', errors);
      }

      const { symbol } = validationResult.data;

      // Get full stock detail
      const fullDetail = await stockService.getStockFullDetail(symbol);

      if (!fullDetail.profile && !fullDetail.quote) {
        throw new NotFoundError('未找到该股票');
      }

      const response: ApiResponse = {
        success: true,
        data: fullDetail,
        message: '获取股票完整详情成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/stocks/:symbol/financials
 * Get financial metrics for a stock
 * Implements Requirements 6.1-6.6
 * 
 * Path Parameters:
 * - symbol: Stock symbol (required)
 */
router.get(
  '/:symbol/financials',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate path parameter
      const validationResult = symbolParamSchema.safeParse(req.params);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('股票代码验证失败', errors);
      }

      const { symbol } = validationResult.data;

      // Get financial metrics
      const financials = await stockService.getFinancialMetrics(symbol);

      const response: ApiResponse = {
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          metrics: financials,
          updatedAt: new Date().toISOString(),
        },
        message: financials ? '获取财务数据成功' : '暂无财务数据',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/stocks/:symbol/analyst-ratings
 * Get analyst ratings summary and recent ratings for a stock
 * Implements Requirements 7.1-7.5
 * 
 * Path Parameters:
 * - symbol: Stock symbol (required)
 * 
 * Query Parameters:
 * - limit: Maximum number of recent ratings to return (optional, default: 10)
 */
router.get(
  '/:symbol/analyst-ratings',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate path parameter
      const validationResult = symbolParamSchema.safeParse(req.params);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('股票代码验证失败', errors);
      }

      const { symbol } = validationResult.data;
      const limit = parseInt(req.query.limit as string, 10) || 10;

      // Get analyst ratings summary and recent ratings in parallel
      const [summary, ratings] = await Promise.all([
        stockService.getAnalystRatingSummary(symbol),
        stockService.getRecentAnalystRatings(symbol, limit),
      ]);

      const response: ApiResponse = {
        success: true,
        data: {
          summary,
          ratings,
        },
        message: summary ? '获取分析师评级成功' : '暂无分析师评级',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Validation schema for insider trades query
const insiderTradesQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .refine((val) => !isNaN(val) && val > 0 && val <= 50, {
      message: '返回数量必须在1-50之间',
    }),
  period: z
    .string()
    .optional()
    .default('3M')
    .refine((val) => /^\d+[DMY]$/i.test(val), {
      message: '时间周期格式无效，应为如 3M, 6M, 1Y',
    }),
});

/**
 * GET /api/stocks/:symbol/insider-trades
 * Get insider trade summary and recent trades for a stock
 * Implements Requirements 8.1-8.6
 * 
 * Path Parameters:
 * - symbol: Stock symbol (required)
 * 
 * Query Parameters:
 * - limit: Maximum number of recent trades to return (optional, default: 10)
 * - period: Time period for summary (optional, default: '3M')
 */
router.get(
  '/:symbol/insider-trades',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate path parameter
      const symbolValidation = symbolParamSchema.safeParse(req.params);

      if (!symbolValidation.success) {
        const errors: Record<string, string[]> = {};
        symbolValidation.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('股票代码验证失败', errors);
      }

      // Validate query parameters
      const queryValidation = insiderTradesQuerySchema.safeParse(req.query);

      if (!queryValidation.success) {
        const errors: Record<string, string[]> = {};
        queryValidation.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('查询参数验证失败', errors);
      }

      const { symbol } = symbolValidation.data;
      const { limit, period } = queryValidation.data;

      // Get insider trade summary and recent trades in parallel
      const [summary, trades] = await Promise.all([
        stockService.getInsiderTradeSummary(symbol, period),
        stockService.getRecentInsiderTrades(symbol, limit),
      ]);

      const response: ApiResponse = {
        success: true,
        data: {
          summary,
          trades,
        },
        message: summary || trades.length > 0 ? '获取内部交易成功' : '暂无内部交易记录',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/stocks/:symbol
 * Get stock detail by symbol
 * 
 * IMPORTANT: This catch-all route MUST be defined LAST after all other routes
 * 
 * Path Parameters:
 * - symbol: Stock symbol (required)
 */
router.get(
  '/:symbol',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate path parameter
      const validationResult = symbolParamSchema.safeParse(req.params);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('股票代码验证失败', errors);
      }

      const { symbol } = validationResult.data;

      // Get stock detail
      const stock = await stockService.getStockDetail(symbol);

      if (!stock) {
        throw new NotFoundError('未找到该股票');
      }

      const response: ApiResponse = {
        success: true,
        data: stock,
        message: '获取成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
