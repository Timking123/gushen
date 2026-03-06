import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { earningsService, EarningsTiming } from '../services/earningsService.js';
import { earningsReminderService } from '../services/earningsReminderService.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { ApiResponse, AuthenticatedRequest } from '../types/index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Valid timing values
const validTimings: EarningsTiming[] = ['bmo', 'amc', 'unknown'];

// Validation schemas using Zod
const symbolParamSchema = z.object({
  symbol: z
    .string()
    .min(1, '股票代码不能为空')
    .max(20, '股票代码过长')
    .regex(/^[A-Za-z0-9.]+$/, '股票代码格式无效'),
});

const calendarQuerySchema = z.object({
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
  symbols: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map(s => s.trim()) : undefined)),
  sectors: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map(s => s.trim()) : undefined)),
  timing: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const timings = val.split(',').map(t => t.trim().toLowerCase()) as EarningsTiming[];
      return timings.filter(t => validTimings.includes(t));
    }),
  marketCapMin: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine((val) => val === undefined || (!isNaN(val) && val >= 0), {
      message: '最小市值必须是非负整数',
    }),
  marketCapMax: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine((val) => val === undefined || (!isNaN(val) && val >= 0), {
      message: '最大市值必须是非负整数',
    }),
  hasActualResults: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
  sortBy: z
    .enum(['reportDate', 'symbol', 'marketCap', 'epsSurprisePercent'])
    .optional()
    .default('reportDate'),
  sortOrder: z
    .enum(['asc', 'desc'])
    .optional()
    .default('asc'),
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
  days: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 7))
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

const dateQuerySchema = z.object({
  date: z
    .string()
    .transform((val) => new Date(val))
    .refine((val) => !isNaN(val.getTime()), {
      message: '日期格式无效',
    }),
});

const symbolLimitQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .refine((val) => !isNaN(val) && val > 0 && val <= 50, {
      message: '数量必须在1-50之间',
    }),
});

/**
 * GET /api/earnings/calendar
 * Get earnings calendar with optional filters
 * 
 * Implements Requirements:
 * - 11.1: Display future earnings release schedule
 * - 11.2: Mark BMO or AMC release timing
 * - 11.3: Show expected EPS, previous EPS, and analyst forecasts
 * - 11.6: Support filtering by date, sector, market cap
 * 
 * Query Parameters:
 * - startDate: Start date for filtering (ISO format)
 * - endDate: End date for filtering (ISO format)
 * - symbols: Comma-separated list of stock symbols
 * - sectors: Comma-separated list of sectors
 * - timing: Comma-separated list of timing values (bmo, amc, unknown)
 * - marketCapMin: Minimum market cap filter
 * - marketCapMax: Maximum market cap filter
 * - hasActualResults: Filter by whether actual results are available
 * - sortBy: Sort field (reportDate, symbol, marketCap, epsSurprisePercent)
 * - sortOrder: Sort order (asc, desc)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 */
router.get(
  '/calendar',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query parameters
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

      const {
        startDate,
        endDate,
        symbols,
        sectors,
        timing,
        marketCapMin,
        marketCapMax,
        hasActualResults,
        sortBy,
        sortOrder,
        page,
        limit,
      } = validationResult.data;

      // Build filters
      const filters = {
        startDate,
        endDate,
        symbols,
        sectors,
        timing,
        marketCapMin,
        marketCapMax,
        hasActualResults,
      };

      // Build sort options
      const sort = {
        field: sortBy as 'reportDate' | 'symbol' | 'marketCap' | 'epsSurprisePercent',
        order: sortOrder as 'asc' | 'desc',
      };

      // Get earnings calendar
      const result = await earningsService.getEarningsCalendar(
        filters,
        sort,
        { page, limit }
      );

      const response: ApiResponse = {
        success: true,
        data: result,
        message: result.events.length > 0 ? '获取财报日历成功' : '暂无财报数据',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/earnings/upcoming
 * Get upcoming earnings events
 * 
 * Implements Requirement 11.1: Display future earnings release schedule
 * 
 * Query Parameters:
 * - days: Number of days to look ahead (default: 7, max: 90)
 * - limit: Maximum number of events (default: 50, max: 100)
 */
router.get(
  '/upcoming',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query parameters
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

      const { days, limit } = validationResult.data;

      // Get upcoming earnings
      const events = await earningsService.getUpcomingEarnings(days, limit);

      const response: ApiResponse = {
        success: true,
        data: {
          days,
          count: events.length,
          events,
        },
        message: events.length > 0 ? '获取即将发布的财报成功' : '暂无即将发布的财报',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/earnings/recent
 * Get recent earnings results
 * 
 * Query Parameters:
 * - days: Number of days to look back (default: 7, max: 90)
 * - limit: Maximum number of events (default: 50, max: 100)
 */
router.get(
  '/recent',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query parameters
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

      const { days, limit } = validationResult.data;

      // Get recent earnings results
      const events = await earningsService.getRecentEarningsResults(days, limit);

      const response: ApiResponse = {
        success: true,
        data: {
          days,
          count: events.length,
          events,
        },
        message: events.length > 0 ? '获取最近财报结果成功' : '暂无最近财报结果',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/earnings/date/:date
 * Get earnings events for a specific date
 * 
 * Path Parameters:
 * - date: Date in YYYY-MM-DD format
 */
router.get(
  '/date/:date',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate date parameter
      const validationResult = dateQuerySchema.safeParse(req.params);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('日期参数验证失败', errors);
      }

      const { date } = validationResult.data;

      // Get earnings for the date
      const events = await earningsService.getEarningsByDate(date);

      const response: ApiResponse = {
        success: true,
        data: {
          date: date.toISOString().split('T')[0],
          count: events.length,
          events,
        },
        message: events.length > 0 ? '获取指定日期财报成功' : '该日期暂无财报',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/earnings/stock/:symbol
 * Get earnings history for a specific stock
 * 
 * Implements Requirement 11.3: Show expected EPS, previous EPS, and analyst forecasts
 * 
 * Path Parameters:
 * - symbol: Stock symbol
 * 
 * Query Parameters:
 * - limit: Maximum number of events (default: 10, max: 50)
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

      // Get earnings for the stock
      const events = await earningsService.getEarningsBySymbol(symbol, limit);

      if (events.length === 0) {
        throw new NotFoundError('未找到该股票的财报数据');
      }

      const response: ApiResponse = {
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          count: events.length,
          events,
        },
        message: '获取股票财报历史成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Earnings Reminder Routes (Authenticated)
// ============================================

const watchlistDaysQuerySchema = z.object({
  days: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 7))
    .refine((val) => !isNaN(val) && val > 0 && val <= 30, {
      message: '天数必须在1-30之间',
    }),
});

const symbolBodySchema = z.object({
  symbol: z
    .string()
    .min(1, '股票代码不能为空')
    .max(20, '股票代码过长')
    .regex(/^[A-Za-z0-9.]+$/, '股票代码格式无效'),
});

/**
 * GET /api/earnings/watchlist/upcoming
 * Get upcoming earnings for user's watchlist stocks
 * 
 * Implements Requirement 11.4: Pre-earnings reminder for watchlist stocks
 * 
 * Query Parameters:
 * - days: Number of days to look ahead (default: 7, max: 30)
 * 
 * Requires authentication
 */
router.get(
  '/watchlist/upcoming',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;

      // Validate query parameters
      const validationResult = watchlistDaysQuerySchema.safeParse(req.query);

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

      const { days } = validationResult.data;

      // Get upcoming earnings for watchlist
      const events = await earningsReminderService.getUpcomingEarningsForWatchlist(userId, days);

      const response: ApiResponse = {
        success: true,
        data: {
          days,
          count: events.length,
          events,
        },
        message: events.length > 0 
          ? '获取自选股即将发布的财报成功' 
          : '自选股暂无即将发布的财报',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/earnings/watchlist/tomorrow
 * Get earnings happening tomorrow for user's watchlist stocks
 * 
 * Implements Requirement 11.4: Pre-earnings reminder for watchlist stocks
 * 
 * Requires authentication
 */
router.get(
  '/watchlist/tomorrow',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;

      // Get earnings happening tomorrow for watchlist
      const events = await earningsReminderService.getEarningsTomorrowForWatchlist(userId);

      const response: ApiResponse = {
        success: true,
        data: {
          count: events.length,
          events,
        },
        message: events.length > 0 
          ? '获取自选股明日财报成功' 
          : '自选股明日暂无财报发布',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/earnings/watchlist/recent
 * Get recent earnings results for user's watchlist stocks
 * 
 * Implements Requirement 11.5: Post-earnings comparison for watchlist stocks
 * 
 * Query Parameters:
 * - hours: Number of hours to look back (default: 24, max: 168)
 * 
 * Requires authentication
 */
router.get(
  '/watchlist/recent',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;

      // Validate hours parameter
      const hoursParam = req.query.hours;
      let hours = 24;
      if (hoursParam) {
        hours = parseInt(hoursParam as string, 10);
        if (isNaN(hours) || hours < 1 || hours > 168) {
          throw new ValidationError('小时数必须在1-168之间', { hours: ['小时数必须在1-168之间'] });
        }
      }

      // Get recent earnings results for watchlist
      const events = await earningsReminderService.getRecentEarningsResultsForWatchlist(userId, hours);

      const response: ApiResponse = {
        success: true,
        data: {
          hours,
          count: events.length,
          events,
        },
        message: events.length > 0 
          ? '获取自选股最近财报结果成功' 
          : '自选股暂无最近财报结果',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/earnings/reminder
 * Send earnings reminder for a specific stock
 * 
 * Implements Requirement 11.4: Pre-earnings reminder
 * 
 * Request Body:
 * - symbol: Stock symbol to send reminder for
 * 
 * Requires authentication
 */
router.post(
  '/reminder',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;

      // Validate request body
      const validationResult = symbolBodySchema.safeParse(req.body);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('请求参数验证失败', errors);
      }

      const { symbol } = validationResult.data;

      // Send earnings reminder
      const sent = await earningsReminderService.sendEarningsReminderForSymbol(userId, symbol);

      const response: ApiResponse = {
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          reminderSent: sent,
        },
        message: sent 
          ? '财报提醒已发送' 
          : '该股票暂无即将发布的财报',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
