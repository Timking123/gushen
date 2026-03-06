import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { quantRatingService } from '../services/quantRatingService.js';
import { stockService } from '../services/stockService.js';
import { technicalIndicatorService } from '../services/technicalIndicatorService.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * Helper to extract string from param that could be string or string[]
 */
function getParamString(param: string | string[] | undefined): string {
  if (Array.isArray(param)) {
    return param[0] || '';
  }
  return param || '';
}

/**
 * GET /api/quant-rating/:symbol
 * Get quant rating for a stock
 * 
 * Implements Requirements:
 * - 13.1: 显示综合量化评级
 * - 13.3: 展示各维度的具体得分
 * - 13.4: 显示该股票在板块和行业中的排名
 */
router.get('/:symbol', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const symbol = getParamString(req.params.symbol);

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Stock symbol is required',
      });
    }

    const rating = await quantRatingService.getQuantRating(symbol);

    if (!rating) {
      return res.status(404).json({
        success: false,
        error: 'Quant rating not found for this stock',
      });
    }

    return res.json({
      success: true,
      data: rating,
    });
  } catch (error) {
    logger.error('Error getting quant rating:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get quant rating',
    });
  }
});

/**
 * GET /api/quant-rating/:symbol/history
 * Get rating history for a stock
 * 
 * Implements Requirement 13.5: 评级变化追踪 - 记录评级历史
 */
router.get('/:symbol/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const symbol = getParamString(req.params.symbol);
    const limitStr = getParamString(req.query.limit as string | string[] | undefined);

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Stock symbol is required',
      });
    }

    const limit = Math.min(parseInt(limitStr || '50', 10) || 50, 100);
    const history = await quantRatingService.getRatingHistory(symbol, limit);

    return res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    logger.error('Error getting rating history:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get rating history',
    });
  }
});

/**
 * GET /api/quant-rating/:symbol/changes
 * Get rating change trend for a stock
 * 
 * Implements Requirement 13.5: 评级变化追踪 - 支持查看变化趋势
 */
router.get('/:symbol/changes', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const symbol = getParamString(req.params.symbol);
    const daysStr = getParamString(req.query.days as string | string[] | undefined);

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Stock symbol is required',
      });
    }

    const days = Math.min(parseInt(daysStr || '90', 10) || 90, 365);
    const changes = await quantRatingService.getRatingChangeTrend(symbol, days);

    return res.json({
      success: true,
      data: changes,
    });
  } catch (error) {
    logger.error('Error getting rating changes:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get rating changes',
    });
  }
});


/**
 * POST /api/quant-rating/:symbol/calculate
 * Calculate and save a new quant rating for a stock
 * This endpoint triggers a fresh calculation of the quant rating
 * and sends notifications if the rating changes
 * 
 * Implements Requirements:
 * - 13.5: 评级变化追踪 - 记录评级历史
 * - 13.6: 评级变化推送 - 评级变化时推送通知
 */
router.post('/:symbol/calculate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const symbol = getParamString(req.params.symbol);

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Stock symbol is required',
      });
    }

    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check if stock exists
    const stockExists = await stockService.stockExists(normalizedSymbol);
    if (!stockExists) {
      return res.status(404).json({
        success: false,
        error: 'Stock not found',
      });
    }

    // Get historical data for momentum calculation
    const ohlcvData = await stockService.getHistoricalData(normalizedSymbol, '1Y');

    // Get technical indicators
    const technicals = ohlcvData.length > 0
      ? await technicalIndicatorService.getTechnicalIndicators(normalizedSymbol, ohlcvData)
      : null;

    // Get fundamental metrics from database
    const fundamentalsData = await prisma.fundamentalMetrics.findUnique({
      where: { symbol: normalizedSymbol },
    });

    const fundamentals = fundamentalsData ? {
      symbol: fundamentalsData.symbol,
      pe: fundamentalsData.pe,
      forwardPe: fundamentalsData.forwardPe,
      peg: fundamentalsData.peg,
      ps: fundamentalsData.ps,
      pb: fundamentalsData.pb,
      eps: fundamentalsData.eps,
      epsGrowth: fundamentalsData.epsGrowth,
      revenue: fundamentalsData.revenue ? Number(fundamentalsData.revenue) : null,
      revenueGrowth: fundamentalsData.revenueGrowth,
      grossMargin: fundamentalsData.grossMargin,
      operatingMargin: fundamentalsData.operatingMargin,
      netMargin: fundamentalsData.netMargin,
      roe: fundamentalsData.roe,
      roa: fundamentalsData.roa,
      debtToEquity: fundamentalsData.debtToEquity,
      currentRatio: fundamentalsData.currentRatio,
      dividendYield: fundamentalsData.dividendYield,
      payoutRatio: fundamentalsData.payoutRatio,
    } : null;

    // Calculate, save, and notify rating changes
    const { rating, changeEvent } = await quantRatingService.calculateSaveAndNotifyRatingChange(
      normalizedSymbol,
      fundamentals,
      technicals,
      ohlcvData
    );

    return res.json({
      success: true,
      data: {
        rating,
        ratingChanged: changeEvent !== null,
        changeEvent,
      },
    });
  } catch (error) {
    logger.error('Error calculating quant rating:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to calculate quant rating',
    });
  }
});

/**
 * GET /api/quant-rating/sector/:sector/rankings
 * Get sector rankings for all stocks in a sector
 * 
 * Implements Requirement 13.4: 显示该股票在板块和行业中的排名
 */
router.get('/sector/:sector/rankings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sector = getParamString(req.params.sector);
    const limitStr = getParamString(req.query.limit as string | string[] | undefined);
    const offsetStr = getParamString(req.query.offset as string | string[] | undefined);

    if (!sector) {
      return res.status(400).json({
        success: false,
        error: 'Sector is required',
      });
    }

    const limitNum = Math.min(parseInt(limitStr || '20', 10) || 20, 100);
    const offsetNum = parseInt(offsetStr || '0', 10) || 0;

    // Get rankings from database
    const rankings = await prisma.quantRating.findMany({
      where: {
        stock: {
          sector: sector,
        },
      },
      orderBy: {
        overallScore: 'desc',
      },
      skip: offsetNum,
      take: limitNum,
      include: {
        stock: {
          select: {
            name: true,
            sector: true,
            industry: true,
          },
        },
      },
    });

    // Get total count
    const total = await prisma.quantRating.count({
      where: {
        stock: {
          sector: sector,
        },
      },
    });

    const rankedResults = rankings.map((r, index) => ({
      rank: offsetNum + index + 1,
      symbol: r.symbol,
      name: r.stock.name,
      overallRating: r.overallRating,
      overallScore: r.overallScore,
      valuationScore: r.valuationScore,
      growthScore: r.growthScore,
      profitabilityScore: r.profitabilityScore,
      momentumScore: r.momentumScore,
      revisionsScore: r.revisionsScore,
    }));

    return res.json({
      success: true,
      data: rankedResults,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      },
    });
  } catch (error) {
    logger.error('Error getting sector rankings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get sector rankings',
    });
  }
});


/**
 * GET /api/quant-rating/industry/:industry/rankings
 * Get industry rankings for all stocks in an industry
 * 
 * Implements Requirement 13.4: 显示该股票在板块和行业中的排名
 */
router.get('/industry/:industry/rankings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const industry = getParamString(req.params.industry);
    const limitStr = getParamString(req.query.limit as string | string[] | undefined);
    const offsetStr = getParamString(req.query.offset as string | string[] | undefined);

    if (!industry) {
      return res.status(400).json({
        success: false,
        error: 'Industry is required',
      });
    }

    const limitNum = Math.min(parseInt(limitStr || '20', 10) || 20, 100);
    const offsetNum = parseInt(offsetStr || '0', 10) || 0;

    // Get rankings from database
    const rankings = await prisma.quantRating.findMany({
      where: {
        stock: {
          industry: industry,
        },
      },
      orderBy: {
        overallScore: 'desc',
      },
      skip: offsetNum,
      take: limitNum,
      include: {
        stock: {
          select: {
            name: true,
            sector: true,
            industry: true,
          },
        },
      },
    });

    // Get total count
    const total = await prisma.quantRating.count({
      where: {
        stock: {
          industry: industry,
        },
      },
    });

    const rankedResults = rankings.map((r, index) => ({
      rank: offsetNum + index + 1,
      symbol: r.symbol,
      name: r.stock.name,
      overallRating: r.overallRating,
      overallScore: r.overallScore,
      valuationScore: r.valuationScore,
      growthScore: r.growthScore,
      profitabilityScore: r.profitabilityScore,
      momentumScore: r.momentumScore,
      revisionsScore: r.revisionsScore,
    }));

    return res.json({
      success: true,
      data: rankedResults,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      },
    });
  } catch (error) {
    logger.error('Error getting industry rankings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get industry rankings',
    });
  }
});

export default router;