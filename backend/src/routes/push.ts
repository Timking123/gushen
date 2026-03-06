import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { pushService } from '../services/pushService.js';
import { AuthenticatedRequest, ApiResponse, Alert } from '../types/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * Subscribe to stock updates
 * POST /api/push/subscribe/stock
 */
router.post('/subscribe/stock', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { symbol } = req.body;

    if (!symbol || typeof symbol !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Symbol is required',
      } as ApiResponse);
      return;
    }

    await pushService.subscribeStock(userId, symbol.toUpperCase());

    res.json({
      success: true,
      data: { symbol: symbol.toUpperCase() },
      message: 'Subscribed to stock updates',
    } as ApiResponse);
  } catch (error) {
    logger.error('Subscribe to stock error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to subscribe to stock',
    } as ApiResponse);
  }
});

/**
 * Unsubscribe from stock updates
 * POST /api/push/unsubscribe/stock
 */
router.post('/unsubscribe/stock', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { symbol } = req.body;

    if (!symbol || typeof symbol !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Symbol is required',
      } as ApiResponse);
      return;
    }

    await pushService.unsubscribeStock(userId, symbol.toUpperCase());

    res.json({
      success: true,
      data: { symbol: symbol.toUpperCase() },
      message: 'Unsubscribed from stock updates',
    } as ApiResponse);
  } catch (error) {
    logger.error('Unsubscribe from stock error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unsubscribe from stock',
    } as ApiResponse);
  }
});

/**
 * Set price alert
 * POST /api/push/alerts/price
 */
router.post('/alerts/price', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { symbol, condition, targetValue } = req.body;

    if (!symbol || !condition || targetValue === undefined) {
      res.status(400).json({
        success: false,
        error: 'Symbol, condition, and targetValue are required',
      } as ApiResponse);
      return;
    }

    if (!['above', 'below', 'change_percent'].includes(condition)) {
      res.status(400).json({
        success: false,
        error: 'Invalid condition. Must be: above, below, or change_percent',
      } as ApiResponse);
      return;
    }

    const alertId = await pushService.setPriceAlert({
      userId,
      symbol: symbol.toUpperCase(),
      condition,
      targetValue: parseFloat(targetValue),
    });

    res.json({
      success: true,
      data: { alertId },
      message: 'Price alert created',
    } as ApiResponse);
  } catch (error) {
    logger.error('Set price alert error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create price alert',
    } as ApiResponse);
  }
});

/**
 * Get user alerts
 * GET /api/push/alerts
 */
router.get('/alerts', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const unreadOnly = req.query.unreadOnly === 'true';

    const alerts = await pushService.getAlerts(userId, unreadOnly);

    res.json({
      success: true,
      data: alerts,
    } as ApiResponse<Alert[]>);
  } catch (error) {
    logger.error('Get alerts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get alerts',
    } as ApiResponse);
  }
});

/**
 * Mark alert as read
 * PUT /api/push/alerts/:alertId/read
 */
router.put('/alerts/:alertId/read', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const alertId = req.params.alertId as string;

    await pushService.markAlertAsRead(alertId, userId);

    res.json({
      success: true,
      message: 'Alert marked as read',
    } as ApiResponse);
  } catch (error) {
    logger.error('Mark alert as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark alert as read',
    } as ApiResponse);
  }
});

export default router;
