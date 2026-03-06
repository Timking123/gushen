/**
 * Market Routes
 * API endpoints for market overview data
 * 
 * Requirements:
 * - 18.1: Display major indices (Dow Jones, S&P 500, NASDAQ) real-time quotes
 * - 18.4: Display advance/decline counts, volume, and market sentiment indicators
 * - 18.5: Display top gainers, losers, and volume leaders
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { marketService } from '../services/marketService.js';
import { ValidationError } from '../middleware/errorHandler.js';
import { ApiResponse } from '../types/index.js';

const router = Router();

// Validation schema for limit parameter
const limitQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .refine((val) => !isNaN(val) && val > 0 && val <= 50, {
      message: '返回数量必须在1-50之间',
    }),
});

/**
 * GET /api/market/indices
 * Get major market indices quotes
 * Implements Requirement 18.1: Display major indices real-time quotes
 */
router.get(
  '/indices',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const indices = await marketService.getMarketIndices();

      const response: ApiResponse = {
        success: true,
        data: indices,
        message: '获取指数行情成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/market/breadth
 * Get market breadth data (advance/decline statistics)
 * Implements Requirement 18.4: Display advance/decline counts
 */
router.get(
  '/breadth',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const breadth = await marketService.calculateMarketBreadth();

      const response: ApiResponse = {
        success: true,
        data: breadth,
        message: '获取市场宽度数据成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/market/sentiment
 * Get market sentiment indicators
 * Implements Requirement 18.4: Display market sentiment indicators
 */
router.get(
  '/sentiment',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sentiment = await marketService.getMarketSentiment();

      const response: ApiResponse = {
        success: true,
        data: sentiment,
        message: '获取市场情绪指标成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/market/gainers
 * Get top gaining stocks
 * Implements Requirement 18.5: Display top gainers
 * 
 * Query Parameters:
 * - limit: Maximum number of stocks (optional, default: 10, max: 50)
 */
router.get(
  '/gainers',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query parameters
      const validationResult = limitQuerySchema.safeParse(req.query);

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
      const gainers = await marketService.getTopGainers(limit);

      const response: ApiResponse = {
        success: true,
        data: {
          count: gainers.length,
          stocks: gainers,
        },
        message: gainers.length > 0 ? '获取涨幅榜成功' : '暂无涨幅数据',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/market/losers
 * Get top losing stocks
 * Implements Requirement 18.5: Display top losers
 * 
 * Query Parameters:
 * - limit: Maximum number of stocks (optional, default: 10, max: 50)
 */
router.get(
  '/losers',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query parameters
      const validationResult = limitQuerySchema.safeParse(req.query);

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
      const losers = await marketService.getTopLosers(limit);

      const response: ApiResponse = {
        success: true,
        data: {
          count: losers.length,
          stocks: losers,
        },
        message: losers.length > 0 ? '获取跌幅榜成功' : '暂无跌幅数据',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/market/most-active
 * Get most active stocks by volume
 * Implements Requirement 18.5: Display volume leaders
 * 
 * Query Parameters:
 * - limit: Maximum number of stocks (optional, default: 10, max: 50)
 */
router.get(
  '/most-active',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query parameters
      const validationResult = limitQuerySchema.safeParse(req.query);

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
      const mostActive = await marketService.getMostActive(limit);

      const response: ApiResponse = {
        success: true,
        data: {
          count: mostActive.length,
          stocks: mostActive,
        },
        message: mostActive.length > 0 ? '获取成交量榜成功' : '暂无成交量数据',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/market/leaderboards
 * Get all market leaderboards (gainers, losers, most active)
 * Implements Requirement 18.5: Display all leaderboards
 * 
 * Query Parameters:
 * - limit: Maximum number of stocks per leaderboard (optional, default: 10, max: 50)
 */
router.get(
  '/leaderboards',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query parameters
      const validationResult = limitQuerySchema.safeParse(req.query);

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
      const leaderboards = await marketService.getLeaderboards(limit);

      const response: ApiResponse = {
        success: true,
        data: leaderboards,
        message: '获取排行榜成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/market/overview
 * Get complete market overview (indices, sentiment, leaderboards)
 * Combines all market data endpoints
 * 
 * Query Parameters:
 * - limit: Maximum number of stocks per leaderboard (optional, default: 10, max: 50)
 */
router.get(
  '/overview',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query parameters
      const validationResult = limitQuerySchema.safeParse(req.query);

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
      const overview = await marketService.getMarketOverview(limit);

      const response: ApiResponse = {
        success: true,
        data: overview,
        message: '获取市场概览成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
