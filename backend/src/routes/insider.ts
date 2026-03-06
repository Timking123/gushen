import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { insiderService, TransactionType } from '../services/insiderService.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { ApiResponse } from '../types/index.js';

const router = Router();

// Valid transaction types
const validTransactionTypes: TransactionType[] = ['buy', 'sell', 'exercise'];

// Validation schemas using Zod
const symbolParamSchema = z.object({
  symbol: z
    .string()
    .min(1, '股票代码不能为空')
    .max(20, '股票代码过长')
    .regex(/^[A-Za-z0-9.]+$/, '股票代码格式无效'),
});

const insiderTradesQuerySchema = z.object({
  symbol: z
    .string()
    .optional()
    .transform((val) => (val ? val.trim().toUpperCase() : undefined)),
  symbols: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map((s) => s.trim()) : undefined)),
  insiderName: z.string().optional(),
  transactionTypes: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const types = val.split(',').map((t) => t.trim().toLowerCase()) as TransactionType[];
      return types.filter((t) => validTransactionTypes.includes(t));
    }),
  startDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .refine((val) => !val || !isNaN(val.getTime()), {
      message: '开始日期格式无效',
    }),
  endDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .refine((val) => !val || !isNaN(val.getTime()), {
      message: '结束日期格式无效',
    }),
  minValue: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .refine((val) => val === undefined || (!isNaN(val) && val >= 0), {
      message: '最小金额必须是非负数',
    }),
  maxValue: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .refine((val) => val === undefined || (!isNaN(val) && val >= 0), {
      message: '最大金额必须是非负数',
    }),
  minShares: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine((val) => val === undefined || (!isNaN(val) && val >= 0), {
      message: '最小股数必须是非负整数',
    }),
  maxShares: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine((val) => val === undefined || (!isNaN(val) && val >= 0), {
      message: '最大股数必须是非负整数',
    }),
  sortBy: z
    .enum(['tradeDate', 'filedAt', 'totalValue', 'shares', 'insiderName'])
    .optional()
    .default('tradeDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => !isNaN(val) && val > 0, {
      message: '页码必须是正整数',
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => !isNaN(val) && val > 0 && val <= 100, {
      message: '每页数量必须在1-100之间',
    }),
});

const symbolLimitQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => !isNaN(val) && val > 0 && val <= 100, {
      message: '数量必须在1-100之间',
    }),
});

const trendQuerySchema = z.object({
  days: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 90))
    .refine((val) => !isNaN(val) && val > 0 && val <= 365, {
      message: '天数必须在1-365之间',
    }),
});

const insiderNameQuerySchema = z.object({
  name: z.string().min(1, '内部人士姓名不能为空'),
  symbol: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .refine((val) => !isNaN(val) && val > 0 && val <= 100, {
      message: '数量必须在1-100之间',
    }),
});

const recentQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .refine((val) => !isNaN(val) && val > 0 && val <= 100, {
      message: '数量必须在1-100之间',
    }),
});

const significantQuerySchema = z.object({
  minValue: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : 100000))
    .refine((val) => !isNaN(val) && val >= 0, {
      message: '最小金额必须是非负数',
    }),
  days: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 30))
    .refine((val) => !isNaN(val) && val > 0 && val <= 90, {
      message: '天数必须在1-90之间',
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .refine((val) => !isNaN(val) && val > 0 && val <= 100, {
      message: '数量必须在1-100之间',
    }),
});

/**
 * GET /api/insider/trades
 * Get insider trades with optional filters
 * 
 * Implements Requirements:
 * - 12.1: Display recent insider trading records
 * - 12.2: Record trader identity, transaction type, quantity, and price
 * - 12.5: Support filtering by transaction type, amount, date
 * 
 * Query Parameters:
 * - symbol: Single stock symbol to filter by
 * - symbols: Comma-separated list of stock symbols
 * - insiderName: Filter by insider name (partial match)
 * - transactionTypes: Comma-separated list of transaction types (buy, sell, exercise)
 * - startDate: Start date for filtering (ISO format)
 * - endDate: End date for filtering (ISO format)
 * - minValue: Minimum transaction value
 * - maxValue: Maximum transaction value
 * - minShares: Minimum number of shares
 * - maxShares: Maximum number of shares
 * - sortBy: Sort field (tradeDate, filedAt, totalValue, shares, insiderName)
 * - sortOrder: Sort order (asc, desc)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 */
router.get(
  '/trades',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query parameters
      const validationResult = insiderTradesQuerySchema.safeParse(req.query);

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

      const {
        symbol,
        symbols,
        insiderName,
        transactionTypes,
        startDate,
        endDate,
        minValue,
        maxValue,
        minShares,
        maxShares,
        sortBy,
        sortOrder,
        page,
        limit,
      } = validationResult.data;

      // Build filters
      const filters = {
        symbol,
        symbols,
        insiderName,
        transactionTypes,
        startDate,
        endDate,
        minValue,
        maxValue,
        minShares,
        maxShares,
      };

      // Build sort options
      const sort = {
        field: sortBy as 'tradeDate' | 'filedAt' | 'totalValue' | 'shares' | 'insiderName',
        order: sortOrder as 'asc' | 'desc',
      };

      // Get insider trades
      const result = await insiderService.getInsiderTrades(filters, sort, { page, limit });

      const response: ApiResponse = {
        success: true,
        data: result,
        message: result.trades.length > 0 ? '获取内部交易记录成功' : '暂无内部交易数据',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/insider/recent
 * Get recent insider trades across all stocks
 * 
 * Query Parameters:
 * - limit: Maximum number of trades (default: 50, max: 100)
 */
router.get(
  '/recent',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query parameters
      const validationResult = recentQuerySchema.safeParse(req.query);

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

      const { limit } = validationResult.data;

      // Get recent insider trades
      const trades = await insiderService.getRecentInsiderTrades(limit);

      const response: ApiResponse = {
        success: true,
        data: {
          count: trades.length,
          trades,
        },
        message: trades.length > 0 ? '获取最近内部交易成功' : '暂无最近内部交易',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/insider/significant
 * Get significant (large) insider trades
 * 
 * Implements Requirement 12.3: Monitor significant insider trades
 * 
 * Query Parameters:
 * - minValue: Minimum transaction value (default: 100000)
 * - days: Number of days to look back (default: 30, max: 90)
 * - limit: Maximum number of trades (default: 50, max: 100)
 */
router.get(
  '/significant',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query parameters
      const validationResult = significantQuerySchema.safeParse(req.query);

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

      const { minValue, days, limit } = validationResult.data;

      // Get significant insider trades
      const trades = await insiderService.getSignificantInsiderTrades(minValue, days, limit);

      const response: ApiResponse = {
        success: true,
        data: {
          minValue,
          days,
          count: trades.length,
          trades,
        },
        message: trades.length > 0 ? '获取重大内部交易成功' : '暂无重大内部交易',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/insider/insider
 * Get trades by a specific insider
 * 
 * Implements Requirement 12.4: Display trader position and historical trading records
 * 
 * Query Parameters:
 * - name: Insider name (required)
 * - symbol: Optional stock symbol to filter by
 * - limit: Maximum number of trades (default: 50, max: 100)
 */
router.get(
  '/insider',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query parameters
      const validationResult = insiderNameQuerySchema.safeParse(req.query);

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

      const { name, symbol, limit } = validationResult.data;

      // Get insider trades by insider name
      const summary = await insiderService.getInsiderTradesByInsider(name, symbol, limit);

      if (summary.totalTrades === 0) {
        throw new NotFoundError('未找到该内部人士的交易记录');
      }

      const response: ApiResponse = {
        success: true,
        data: summary,
        message: '获取内部人士交易记录成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/insider/stock/:symbol
 * Get insider trades for a specific stock
 * 
 * Implements Requirement 12.1: Display recent insider trading records
 * 
 * Path Parameters:
 * - symbol: Stock symbol
 * 
 * Query Parameters:
 * - limit: Maximum number of trades (default: 20, max: 100)
 */
router.get(
  '/stock/:symbol',
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
      const queryValidation = symbolLimitQuerySchema.safeParse(req.query);

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
      const { limit } = queryValidation.data;

      // Get insider trades for the stock
      const trades = await insiderService.getInsiderTradesBySymbol(symbol, limit);

      const response: ApiResponse = {
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          count: trades.length,
          trades,
        },
        message: trades.length > 0 ? '获取股票内部交易记录成功' : '该股票暂无内部交易记录',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/insider/stock/:symbol/trend
 * Get insider trading trend for a specific stock
 * 
 * Implements Requirement 12.6: Calculate and display net buy/sell trend
 * 
 * Path Parameters:
 * - symbol: Stock symbol
 * 
 * Query Parameters:
 * - days: Number of days to analyze (default: 90, max: 365)
 */
router.get(
  '/stock/:symbol/trend',
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
      const queryValidation = trendQuerySchema.safeParse(req.query);

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
      const { days } = queryValidation.data;

      // Calculate insider trading trend
      const trend = await insiderService.calculateInsiderTrend(symbol, days);

      const response: ApiResponse = {
        success: true,
        data: trend,
        message: '获取内部交易趋势成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
