import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { dividendService, DividendCalendarFilters } from '../services/dividendService.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { ApiResponse } from '../types/index.js';

const router = Router();

// Validation schemas
const symbolParamSchema = z.object({
  symbol: z
    .string()
    .min(1, '股票代码不能为空')
    .max(20, '股票代码过长')
    .regex(/^[A-Za-z0-9.]+$/, '股票代码格式无效'),
});

const portfolioIdParamSchema = z.object({
  portfolioId: z
    .string()
    .uuid('投资组合ID格式无效'),
});

const calendarQuerySchema = z.object({
  symbols: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map(s => s.trim().toUpperCase()) : undefined)),
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
  minYield: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .refine((val) => val === undefined || !isNaN(val), {
      message: '最小股息率格式无效',
    }),
  maxYield: z
    .string()
    .optional()
    .transform((val) => (val ? parseFloat(val) : undefined))
    .refine((val) => val === undefined || !isNaN(val), {
      message: '最大股息率格式无效',
    }),
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

const upcomingQuerySchema = z.object({
  symbols: z
    .string()
    .min(1, '股票代码列表不能为空')
    .transform((val) => val.split(',').map(s => s.trim().toUpperCase())),
  days: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 30))
    .refine((val) => !isNaN(val) && val > 0 && val <= 365, {
      message: '天数必须在1-365之间',
    }),
});

const historyQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => !isNaN(val) && val > 0 && val <= 100, {
      message: '数量必须在1-100之间',
    }),
});

/**
 * GET /api/dividends/calendar
 * Get dividend calendar with optional filters
 * 
 * Implements Requirement 15.2: Display upcoming ex-dividend and pay dates
 * 
 * Query Parameters:
 * - symbols: Comma-separated list of stock symbols
 * - startDate: Start date for filtering (ISO format)
 * - endDate: End date for filtering (ISO format)
 * - minYield: Minimum dividend yield filter
 * - maxYield: Maximum dividend yield filter
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 */
router.get(
  '/calendar',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validationResult = calendarQuerySchema.safeParse(req.query);

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

      const { symbols, startDate, endDate, minYield, maxYield, page, limit } = validationResult.data;

      const filters: DividendCalendarFilters = {
        symbols: symbols as string[] | undefined,
        startDate: startDate as Date | undefined,
        endDate: endDate as Date | undefined,
        minYield: minYield as number | undefined,
        maxYield: maxYield as number | undefined,
      };

      const result = await dividendService.getDividendCalendar(filters, { page, limit });

      const response: ApiResponse = {
        success: true,
        data: result,
        message: result.events.length > 0 ? '获取股息日历成功' : '暂无股息事件',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/dividends/upcoming
 * Get upcoming dividends for specified stocks
 * 
 * Implements Requirement 15.3: Push reminder before ex-dividend date
 * 
 * Query Parameters:
 * - symbols: Comma-separated list of stock symbols (required)
 * - days: Number of days to look ahead (default: 30, max: 365)
 */
router.get(
  '/upcoming',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validationResult = upcomingQuerySchema.safeParse(req.query);

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

      const { symbols, days } = validationResult.data;

      const events = await dividendService.getUpcomingDividends(symbols, days);

      const response: ApiResponse = {
        success: true,
        data: {
          count: events.length,
          events,
        },
        message: events.length > 0 ? '获取即将到来的股息事件成功' : '暂无即将到来的股息事件',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/dividends/stock/:symbol
 * Get dividend summary for a specific stock
 * 
 * Implements Requirement 15.1: Display dividend rate, frequency, and history
 * 
 * Path Parameters:
 * - symbol: Stock symbol
 */
router.get(
  '/stock/:symbol',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
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

      const summary = await dividendService.getDividendSummary(symbol);

      if (!summary) {
        throw new NotFoundError('未找到该股票');
      }

      const response: ApiResponse = {
        success: true,
        data: summary,
        message: '获取股息摘要成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/dividends/stock/:symbol/history
 * Get dividend history for a specific stock
 * 
 * Implements Requirement 15.1: Display historical dividend records
 * 
 * Path Parameters:
 * - symbol: Stock symbol
 * 
 * Query Parameters:
 * - limit: Maximum number of records (default: 20, max: 100)
 */
router.get(
  '/stock/:symbol/history',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
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
      const { limit } = queryValidation.data;

      const history = await dividendService.getDividendHistory(symbol, limit);

      const response: ApiResponse = {
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          count: history.length,
          history,
        },
        message: history.length > 0 ? '获取股息历史成功' : '该股票暂无股息历史',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/dividends/portfolio/:portfolioId/income
 * Calculate expected annual dividend income for a portfolio
 * 
 * Implements Requirement 15.6: Calculate and display expected annual dividend income
 * 
 * Path Parameters:
 * - portfolioId: Portfolio ID (UUID)
 */
router.get(
  '/portfolio/:portfolioId/income',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validationResult = portfolioIdParamSchema.safeParse(req.params);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('投资组合ID验证失败', errors);
      }

      const { portfolioId } = validationResult.data;

      const income = await dividendService.calculatePortfolioDividendIncome(portfolioId);

      if (!income) {
        throw new NotFoundError('未找到该投资组合');
      }

      const response: ApiResponse = {
        success: true,
        data: income,
        message: '计算股息收入成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
