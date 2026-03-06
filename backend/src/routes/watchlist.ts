import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { watchlistService } from '../services/watchlistService.js';
import { authenticate } from '../middleware/auth.js';
import { ValidationError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';

const router = Router();

// All watchlist routes require authentication
router.use(authenticate);

// Validation schemas
const addStockSchema = z.object({
  symbol: z.string().min(1, '请输入股票代码').max(10, '股票代码过长'),
  notes: z.string().max(500, '备注过长').optional(),
});

const reorderSchema = z.object({
  symbols: z.array(z.string().min(1).max(10)).min(1, '请提供股票列表'),
});

const updateNotesSchema = z.object({
  notes: z.string().max(500, '备注过长').nullable(),
});

/**
 * GET /api/watchlist
 * Get user's watchlist
 * Implements Requirement 1.4
 */
router.get(
  '/',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const watchlist = await watchlistService.getWatchlist(userId);

      const response: ApiResponse = {
        success: true,
        data: watchlist,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/watchlist
 * Add a stock to watchlist
 * Implements Requirements 1.2, 1.5
 */
router.post(
  '/',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validationResult = addStockSchema.safeParse(req.body);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('输入验证失败', errors);
      }

      const { symbol, notes } = validationResult.data;
      const userId = req.user!.id;

      console.log(`[Watchlist] Adding stock ${symbol} for user ${userId}`);

      const watchlistItem = await watchlistService.addStock(userId, symbol, notes);

      const response: ApiResponse = {
        success: true,
        data: watchlistItem,
        message: '股票已添加到自选股',
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('[Watchlist] Error adding stock:', error);
      next(error);
    }
  }
);


/**
 * DELETE /api/watchlist/:symbol
 * Remove a stock from watchlist
 * Implements Requirement 1.3
 */
router.delete(
  '/:symbol',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const symbol = req.params.symbol as string;
      const userId = req.user!.id;

      await watchlistService.removeStock(userId, symbol);

      const response: ApiResponse = {
        success: true,
        message: '股票已从自选股移除',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/watchlist/reorder
 * Reorder stocks in watchlist
 * Implements Requirement 1.6
 */
router.put(
  '/reorder',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validationResult = reorderSchema.safeParse(req.body);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('输入验证失败', errors);
      }

      const { symbols } = validationResult.data;
      const userId = req.user!.id;

      await watchlistService.reorderStocks(userId, symbols);

      const response: ApiResponse = {
        success: true,
        message: '自选股排序已更新',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/watchlist/:symbol/notes
 * Update notes for a watchlist item
 */
router.patch(
  '/:symbol/notes',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validationResult = updateNotesSchema.safeParse(req.body);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('输入验证失败', errors);
      }

      const symbol = req.params.symbol as string;
      const { notes } = validationResult.data;
      const userId = req.user!.id;

      const updatedItem = await watchlistService.updateNotes(userId, symbol, notes);

      const response: ApiResponse = {
        success: true,
        data: updatedItem,
        message: '备注已更新',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/watchlist/:symbol/check
 * Check if a stock is in watchlist
 */
router.get(
  '/:symbol/check',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const symbol = req.params.symbol as string;
      const userId = req.user!.id;

      const isInWatchlist = await watchlistService.isInWatchlist(userId, symbol);

      const response: ApiResponse = {
        success: true,
        data: { isInWatchlist },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
