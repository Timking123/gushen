import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { screenerService } from '../services/screenerService.js';
import { logger } from '../utils/logger.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = Router();

/**
 * POST /api/screener/screen
 * Execute stock screening with filters
 * 
 * Implements Requirements:
 * - 10.2: 描述性筛选
 * - 10.3: 基本面筛选
 * - 10.4: 技术面筛选
 * - 10.5: 实时显示结果
 * - 10.7: 排序和分页
 */
router.post('/screen', async (req, res, next) => {
  try {
    const filters = req.body;

    logger.info('Screener request:', { filters });

    const result = await screenerService.screen(filters);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error executing screener:', error);
    next(error);
  }
});

/**
 * POST /api/screener/templates
 * Save a screener template
 * Requires authentication
 * 
 * Implements Requirement 10.6: 保存筛选模板
 */
router.post('/templates', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { name, description, filters } = req.body;

    if (!name || !filters) {
      res.status(400).json({
        success: false,
        error: 'Name and filters are required',
      });
      return;
    }

    const template = await screenerService.saveTemplate(userId, {
      name,
      description,
      filters,
    });

    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error('Error saving screener template:', error);
    next(error);
  }
});

/**
 * GET /api/screener/templates
 * Get all screener templates for the authenticated user
 * Requires authentication
 * 
 * Implements Requirement 10.6: 加载筛选模板
 */
router.get('/templates', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;

    const templates = await screenerService.getTemplates(userId);

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    logger.error('Error fetching screener templates:', error);
    next(error);
  }
});

/**
 * GET /api/screener/templates/:id
 * Get a specific screener template
 * Requires authentication
 */
router.get('/templates/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const templateId = req.params.id as string;

    const template = await screenerService.getTemplate(userId, templateId);

    if (!template) {
      res.status(404).json({
        success: false,
        error: 'Template not found',
      });
      return;
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error('Error fetching screener template:', error);
    next(error);
  }
});

/**
 * PUT /api/screener/templates/:id
 * Update a screener template
 * Requires authentication
 */
router.put('/templates/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const templateId = req.params.id as string;
    const { name, description, filters } = req.body;

    const template = await screenerService.updateTemplate(userId, templateId, {
      name,
      description,
      filters,
    });

    if (!template) {
      res.status(404).json({
        success: false,
        error: 'Template not found',
      });
      return;
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error('Error updating screener template:', error);
    next(error);
  }
});

/**
 * DELETE /api/screener/templates/:id
 * Delete a screener template
 * Requires authentication
 */
router.delete('/templates/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const templateId = req.params.id as string;

    const deleted = await screenerService.deleteTemplate(userId, templateId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Template not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting screener template:', error);
    next(error);
  }
});

export default router;
