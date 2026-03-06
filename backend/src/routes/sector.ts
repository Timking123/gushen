import { Router, Request, Response, NextFunction } from 'express';
import { sectorSubscriptionService } from '../services/sectorSubscriptionService.js';
import { authenticate } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

/**
 * GET /api/sectors
 * 获取所有板块列表
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    const sectors = await sectorSubscriptionService.getAllSectors(userId);
    res.json({ sectors });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/sectors/subscriptions
 * 获取用户订阅的板块列表
 */
router.get(
  '/subscriptions',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const subscriptions = await sectorSubscriptionService.getUserSubscriptions(userId);
      res.json({ subscriptions });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/sectors/:sectorId
 * 获取板块详情
 */
router.get('/:sectorId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sectorId = req.params.sectorId as string;
    const userId = (req as AuthenticatedRequest).user?.id;
    const sector = await sectorSubscriptionService.getSectorById(sectorId, userId);

    if (!sector) {
      res.status(404).json({ error: '板块不存在' });
      return;
    }

    res.json({ sector });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sectors/:sectorId/subscribe
 * 订阅板块
 */
router.post(
  '/:sectorId/subscribe',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const sectorId = req.params.sectorId as string;
      const userId = req.user!.id;

      await sectorSubscriptionService.subscribeSector(userId, sectorId);
      res.json({ success: true, message: '订阅成功' });
    } catch (error) {
      if ((error as Error).message === '板块不存在') {
        res.status(404).json({ error: '板块不存在' });
        return;
      }
      next(error);
    }
  }
);

/**
 * DELETE /api/sectors/:sectorId/subscribe
 * 取消订阅板块
 */
router.delete(
  '/:sectorId/subscribe',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const sectorId = req.params.sectorId as string;
      const userId = req.user!.id;

      await sectorSubscriptionService.unsubscribeSector(userId, sectorId);
      res.json({ success: true, message: '取消订阅成功' });
    } catch (error) {
      if ((error as Error).message === '板块不存在') {
        res.status(404).json({ error: '板块不存在' });
        return;
      }
      next(error);
    }
  }
);

/**
 * GET /api/sectors/:sectorId/stocks
 * 获取板块内的股票列表
 */
router.get('/:sectorId/stocks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sectorId = req.params.sectorId as string;
    const { limit, sortBy } = req.query;

    const sector = await sectorSubscriptionService.getSectorById(sectorId);
    if (!sector) {
      res.status(404).json({ error: '板块不存在' });
      return;
    }

    const stocks = await sectorSubscriptionService.getSectorStocks(sector.name, {
      limit: limit ? parseInt(limit as string, 10) : undefined,
      sortBy: sortBy as 'marketCap' | 'changePercent' | undefined,
    });

    res.json({ stocks });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/sectors/:sectorId/news
 * 获取板块相关新闻
 */
router.get('/:sectorId/news', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sectorId = req.params.sectorId as string;
    const { limit } = req.query;

    const sector = await sectorSubscriptionService.getSectorById(sectorId);
    if (!sector) {
      res.status(404).json({ error: '板块不存在' });
      return;
    }

    const news = await sectorSubscriptionService.getSectorNews(
      sector.name,
      limit ? parseInt(limit as string, 10) : undefined
    );

    res.json({ news });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/sectors/:sectorId/performance
 * 获取板块表现数据
 */
router.get('/:sectorId/performance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sectorId = req.params.sectorId as string;
    const performance = await sectorSubscriptionService.getSectorPerformance(sectorId);

    if (!performance) {
      res.status(404).json({ error: '板块不存在' });
      return;
    }

    res.json({ performance });
  } catch (error) {
    next(error);
  }
});

export default router;
