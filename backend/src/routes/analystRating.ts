/**
 * Analyst Rating Routes
 * Implements Requirements 19.1, 19.2, 19.4:
 * - 19.1: Display analyst composite rating and target price
 * - 19.2: Display individual analyst ratings from each institution
 * - 19.4: Display rating change trends and target price adjustment history
 */

import { Router, Request, Response } from 'express';
import { analystRatingService } from '../services/analystRatingService.js';

const router = Router();

/**
 * GET /api/analyst-ratings/:symbol
 * Get all analyst ratings for a stock
 * Implements Requirement 19.2
 */
router.get('/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol as string;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await analystRatingService.getRatings(symbol.toUpperCase(), {
      limit,
      offset,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching analyst ratings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analyst ratings',
    });
  }
});

/**
 * GET /api/analyst-ratings/:symbol/composite
 * Get composite rating for a stock
 * Implements Requirement 19.1
 */
router.get('/:symbol/composite', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol as string;

    const composite = await analystRatingService.getCompositeRating(symbol.toUpperCase());

    if (!composite) {
      res.status(404).json({
        success: false,
        error: 'No analyst ratings found for this stock',
      });
      return;
    }

    res.json({
      success: true,
      data: composite,
    });
  } catch (error) {
    console.error('Error fetching composite rating:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch composite rating',
    });
  }
});

/**
 * GET /api/analyst-ratings/:symbol/changes
 * Get rating changes history for a stock
 * Implements Requirement 19.4
 */
router.get('/:symbol/changes', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol as string;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await analystRatingService.getRatingChanges(symbol.toUpperCase(), {
      limit,
      offset,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching rating changes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rating changes',
    });
  }
});

/**
 * GET /api/analyst-ratings/firm/:firm
 * Get all ratings from a specific firm
 */
router.get('/firm/:firm', async (req: Request, res: Response) => {
  try {
    const firm = req.params.firm as string;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await analystRatingService.getRatingsByFirm(firm, {
      limit,
      offset,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching firm ratings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch firm ratings',
    });
  }
});

/**
 * GET /api/analyst-ratings/recent/changes
 * Get recent rating changes across all stocks
 */
router.get('/recent/changes', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const changeTypesParam = req.query.changeTypes as string;
    const changeTypes = changeTypesParam
      ? (changeTypesParam.split(',') as Array<'upgrade' | 'downgrade'>)
      : undefined;

    const changes = await analystRatingService.getRecentChanges({
      limit,
      changeTypes,
    });

    res.json({
      success: true,
      data: changes,
    });
  } catch (error) {
    console.error('Error fetching recent changes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent changes',
    });
  }
});

export default router;
