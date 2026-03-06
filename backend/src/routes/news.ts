import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { newsService } from '../services/newsService.js';
import { ValidationError } from '../middleware/errorHandler.js';
import { PaginatedResponse } from '../types/index.js';

const router = Router();

// Validation schemas using Zod
const paginationSchema = z.object({
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

const symbolParamSchema = z.object({
  symbol: z
    .string()
    .min(1, '股票代码不能为空')
    .max(20, '股票代码过长')
    .regex(/^[A-Za-z0-9.]+$/, '股票代码格式无效'),
});

const sectorParamSchema = z.object({
  sector: z
    .string()
    .min(1, '板块名称不能为空')
    .max(100, '板块名称过长'),
});

/**
 * GET /api/news
 * Get latest news feed sorted by priority and time
 * Implements Requirement 6.4: Sort information by importance and time
 * 
 * Query Parameters:
 * - page: Page number (optional, default: 1)
 * - limit: Items per page (optional, default: 20, max: 100)
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query parameters
      const validationResult = paginationSchema.safeParse(req.query);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('分页参数验证失败', errors);
      }

      const { page, limit } = validationResult.data;

      // Get news feed
      const news = await newsService.getNewsFeed({ page, limit });
      const total = await newsService.getTotalNewsCount();
      const totalPages = Math.ceil(total / limit);

      const response: PaginatedResponse<typeof news[0]> = {
        success: true,
        data: news,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        message: news.length > 0 ? '获取新闻成功' : '暂无新闻',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);


/**
 * GET /api/news/stock/:symbol
 * Get news for a specific stock
 * Implements Requirement 8.1: Aggregate news from multiple reliable sources
 * 
 * Path Parameters:
 * - symbol: Stock symbol (required)
 * 
 * Query Parameters:
 * - page: Page number (optional, default: 1)
 * - limit: Items per page (optional, default: 20, max: 100)
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
      const paginationValidation = paginationSchema.safeParse(req.query);

      if (!paginationValidation.success) {
        const errors: Record<string, string[]> = {};
        paginationValidation.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('分页参数验证失败', errors);
      }

      const { symbol } = symbolValidation.data;
      const { page, limit } = paginationValidation.data;

      // Get stock news
      const news = await newsService.getStockNews(symbol, { page, limit });
      const total = await newsService.getStockNewsCount(symbol);
      const totalPages = Math.ceil(total / limit);

      const response: PaginatedResponse<typeof news[0]> = {
        success: true,
        data: news,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        message: news.length > 0 ? '获取股票新闻成功' : '暂无该股票相关新闻',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/news/sector/:sector
 * Get news for a specific sector
 * 
 * Path Parameters:
 * - sector: Sector name (required)
 * 
 * Query Parameters:
 * - page: Page number (optional, default: 1)
 * - limit: Items per page (optional, default: 20, max: 100)
 */
router.get(
  '/sector/:sector',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate path parameter
      const sectorValidation = sectorParamSchema.safeParse(req.params);

      if (!sectorValidation.success) {
        const errors: Record<string, string[]> = {};
        sectorValidation.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('板块名称验证失败', errors);
      }

      // Validate query parameters
      const paginationValidation = paginationSchema.safeParse(req.query);

      if (!paginationValidation.success) {
        const errors: Record<string, string[]> = {};
        paginationValidation.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('分页参数验证失败', errors);
      }

      const { sector } = sectorValidation.data;
      const { page, limit } = paginationValidation.data;

      // Get sector news
      const news = await newsService.getSectorNews(sector, { page, limit });
      const total = await newsService.getSectorNewsCount(sector);
      const totalPages = Math.ceil(total / limit);

      const response: PaginatedResponse<typeof news[0]> = {
        success: true,
        data: news,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        message: news.length > 0 ? '获取板块新闻成功' : '暂无该板块相关新闻',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
