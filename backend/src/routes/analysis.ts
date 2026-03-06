import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { analysisService } from '../services/index.js';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import type { ImpactAnalysis } from '../services/newsService.js';
import type { AIResponse } from '../services/analysisService.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/analysis/impact/:newsId
 * Analyze news impact on stock price
 */
router.post(
  '/impact/:newsId',
  authenticate,
  param('newsId').isString().notEmpty(),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    try {
      const newsId = req.params.newsId as string;
      const analysis = await analysisService.analyzeNewsImpact(newsId);

      const response: ApiResponse<ImpactAnalysis> = {
        success: true,
        data: analysis,
      };

      res.json(response);
    } catch (error) {
      logger.error('Error analyzing news impact:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze news impact',
      });
    }
  }
);

/**
 * POST /api/analysis/summarize
 * Summarize multiple news items
 */
router.post(
  '/summarize',
  authenticate,
  body('newsIds').isArray({ min: 1 }),
  body('newsIds.*').isString(),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    try {
      const { newsIds } = req.body;
      const summary = await analysisService.summarizeNews(newsIds);

      const response: ApiResponse = {
        success: true,
        data: summary,
      };

      res.json(response);
    } catch (error) {
      logger.error('Error summarizing news:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to summarize news',
      });
    }
  }
);

/**
 * POST /api/analysis/compare
 * Compare multiple stocks
 */
router.post(
  '/compare',
  authenticate,
  body('symbols').isArray({ min: 2 }),
  body('symbols.*').isString(),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    try {
      const { symbols } = req.body;
      const comparison = await analysisService.compareStocks(symbols);

      const response: ApiResponse = {
        success: true,
        data: comparison,
      };

      res.json(response);
    } catch (error) {
      logger.error('Error comparing stocks:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compare stocks',
      });
    }
  }
);

/**
 * POST /api/analysis/chat
 * AI assistant chat interface
 */
router.post(
  '/chat',
  authenticate,
  body('message').isString().notEmpty(),
  body('context').optional().isObject(),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    try {
      const userId = req.user!.id;
      const { message, context } = req.body;
      
      const aiResponse = await analysisService.chat(userId, message, context || {});

      const response: ApiResponse<AIResponse> = {
        success: true,
        data: aiResponse,
      };

      res.json(response);
    } catch (error) {
      logger.error('Error in AI chat:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process chat message',
      });
    }
  }
);

export default router;
