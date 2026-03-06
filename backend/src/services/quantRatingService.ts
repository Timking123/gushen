import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';
import { CacheKeys, CacheTTL } from '../lib/cache-keys.js';
import { logger } from '../utils/logger.js';
import { FundamentalMetrics, TechnicalIndicators } from './technicalIndicatorService.js';
import { OHLCV } from './stockService.js';
import { pushService, PushMessage } from './pushService.js';

/**
 * Overall rating type for quant rating
 * Represents the final recommendation based on quantitative analysis
 */
export type OverallRating = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';

/**
 * QuantRating interface
 * Represents the complete quantitative rating for a stock
 * 
 * Implements Requirements 13.1, 13.2, 13.4
 */
export interface QuantRating {
  symbol: string;
  overallRating: OverallRating;
  overallScore: number;           // 1-5 score
  valuationScore: number;         // 1-5 score
  growthScore: number;            // 1-5 score
  profitabilityScore: number;     // 1-5 score
  momentumScore: number;          // 1-5 score
  revisionsScore: number;         // 1-5 score
  sectorRank: number | null;
  industryRank: number | null;
  updatedAt: Date;
}

/**
 * Sector average metrics for comparison
 */
export interface SectorAverages {
  pe: number | null;
  pb: number | null;
  ps: number | null;
  roe: number | null;
  roa: number | null;
  revenueGrowth: number | null;
  epsGrowth: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
}

/**
 * Input data for calculating quant rating
 */
export interface QuantRatingInput {
  symbol: string;
  fundamentals: FundamentalMetrics | null;
  technicals: TechnicalIndicators | null;
  ohlcvData: OHLCV[];
  sectorAverages: SectorAverages | null;
  analystRevisions?: AnalystRevisions | null;
}


/**
 * Analyst revisions data for revisions score calculation
 */
export interface AnalystRevisions {
  epsRevisionsUp: number;         // Number of upward EPS revisions
  epsRevisionsDown: number;       // Number of downward EPS revisions
  revenueRevisionsUp: number;     // Number of upward revenue revisions
  revenueRevisionsDown: number;   // Number of downward revenue revisions
  targetPriceRevisionsUp: number; // Number of upward target price revisions
  targetPriceRevisionsDown: number; // Number of downward target price revisions
}

/**
 * Rating history entry for tracking changes over time
 * 
 * Implements Requirement 13.5: 评级变化追踪
 */
export interface RatingHistoryEntry {
  id: string;
  symbol: string;
  overallRating: OverallRating;
  overallScore: number;
  valuationScore: number;
  growthScore: number;
  profitabilityScore: number;
  momentumScore: number;
  revisionsScore: number;
  sectorRank: number | null;
  industryRank: number | null;
  createdAt: Date;
}

/**
 * Rating change event for notifications
 * 
 * Implements Requirement 13.6: 评级变化推送
 */
export interface RatingChangeEvent {
  symbol: string;
  previousRating: OverallRating;
  newRating: OverallRating;
  previousScore: number;
  newScore: number;
  changeDirection: 'upgrade' | 'downgrade' | 'unchanged';
  changedAt: Date;
}

/**
 * Default weights for each dimension in overall score calculation
 */
const DEFAULT_WEIGHTS = {
  valuation: 0.25,
  growth: 0.20,
  profitability: 0.20,
  momentum: 0.20,
  revisions: 0.15,
};

/**
 * Rating order for comparison (higher index = better rating)
 */
const RATING_ORDER: OverallRating[] = ['strong_sell', 'sell', 'hold', 'buy', 'strong_buy'];

/**
 * QuantRatingService - Handles quantitative rating calculations
 * 
 * Implements Requirements:
 * - 13.1: 显示综合量化评级（强烈买入/买入/持有/卖出/强烈卖出）
 * - 13.2: 基于估值、成长性、盈利能力、动量和修正因子计算
 * - 13.4: 显示该股票在板块和行业中的排名
 */
export class QuantRatingService {
  /**
   * Calculate valuation score based on P/E, P/B, P/S ratios compared to sector averages
   * Lower ratios relative to sector = higher score (better value)
   * 
   * @param fundamentals - Stock fundamental metrics
   * @param sectorAverages - Sector average metrics for comparison
   * @returns Valuation score (1-5)
   */
  calculateValuationScore(
    fundamentals: FundamentalMetrics | null,
    sectorAverages: SectorAverages | null
  ): number {
    if (!fundamentals) {
      return 3; // Neutral score if no data
    }

    const scores: number[] = [];

    // P/E ratio scoring
    if (fundamentals.pe !== null && fundamentals.pe > 0) {
      if (sectorAverages?.pe && sectorAverages.pe > 0) {
        const peRatio = fundamentals.pe / sectorAverages.pe;
        scores.push(this.ratioToScore(peRatio, true)); // Lower is better
      } else {
        // Absolute P/E scoring
        scores.push(this.absolutePEToScore(fundamentals.pe));
      }
    }

    // P/B ratio scoring
    if (fundamentals.pb !== null && fundamentals.pb > 0) {
      if (sectorAverages?.pb && sectorAverages.pb > 0) {
        const pbRatio = fundamentals.pb / sectorAverages.pb;
        scores.push(this.ratioToScore(pbRatio, true)); // Lower is better
      } else {
        // Absolute P/B scoring
        scores.push(this.absolutePBToScore(fundamentals.pb));
      }
    }

    // P/S ratio scoring
    if (fundamentals.ps !== null && fundamentals.ps > 0) {
      if (sectorAverages?.ps && sectorAverages.ps > 0) {
        const psRatio = fundamentals.ps / sectorAverages.ps;
        scores.push(this.ratioToScore(psRatio, true)); // Lower is better
      } else {
        // Absolute P/S scoring
        scores.push(this.absolutePSToScore(fundamentals.ps));
      }
    }

    // PEG ratio scoring (if available)
    if (fundamentals.peg !== null && fundamentals.peg > 0) {
      scores.push(this.pegToScore(fundamentals.peg));
    }

    if (scores.length === 0) {
      return 3; // Neutral score if no metrics available
    }

    return this.clampScore(scores.reduce((a, b) => a + b, 0) / scores.length);
  }


  /**
   * Calculate growth score based on revenue growth and EPS growth
   * Higher growth = higher score
   * 
   * @param fundamentals - Stock fundamental metrics
   * @param sectorAverages - Sector average metrics for comparison
   * @returns Growth score (1-5)
   */
  calculateGrowthScore(
    fundamentals: FundamentalMetrics | null,
    sectorAverages: SectorAverages | null
  ): number {
    if (!fundamentals) {
      return 3; // Neutral score if no data
    }

    const scores: number[] = [];

    // Revenue growth scoring
    if (fundamentals.revenueGrowth !== null) {
      if (sectorAverages && sectorAverages.revenueGrowth !== null && sectorAverages.revenueGrowth !== undefined) {
        const growthDiff = fundamentals.revenueGrowth - sectorAverages.revenueGrowth;
        scores.push(this.growthDiffToScore(growthDiff));
      } else {
        scores.push(this.absoluteGrowthToScore(fundamentals.revenueGrowth));
      }
    }

    // EPS growth scoring
    if (fundamentals.epsGrowth !== null) {
      if (sectorAverages && sectorAverages.epsGrowth !== null && sectorAverages.epsGrowth !== undefined) {
        const growthDiff = fundamentals.epsGrowth - sectorAverages.epsGrowth;
        scores.push(this.growthDiffToScore(growthDiff));
      } else {
        scores.push(this.absoluteGrowthToScore(fundamentals.epsGrowth));
      }
    }

    if (scores.length === 0) {
      return 3; // Neutral score if no metrics available
    }

    return this.clampScore(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  /**
   * Calculate profitability score based on ROE, ROA, and margins
   * Higher profitability = higher score
   * 
   * @param fundamentals - Stock fundamental metrics
   * @param sectorAverages - Sector average metrics for comparison
   * @returns Profitability score (1-5)
   */
  calculateProfitabilityScore(
    fundamentals: FundamentalMetrics | null,
    sectorAverages: SectorAverages | null
  ): number {
    if (!fundamentals) {
      return 3; // Neutral score if no data
    }

    const scores: number[] = [];

    // ROE scoring
    if (fundamentals.roe !== null) {
      if (sectorAverages && sectorAverages.roe !== null && sectorAverages.roe !== undefined) {
        const roeDiff = fundamentals.roe - sectorAverages.roe;
        scores.push(this.profitabilityDiffToScore(roeDiff));
      } else {
        scores.push(this.absoluteROEToScore(fundamentals.roe));
      }
    }

    // ROA scoring
    if (fundamentals.roa !== null) {
      if (sectorAverages && sectorAverages.roa !== null && sectorAverages.roa !== undefined) {
        const roaDiff = fundamentals.roa - sectorAverages.roa;
        scores.push(this.profitabilityDiffToScore(roaDiff));
      } else {
        scores.push(this.absoluteROAToScore(fundamentals.roa));
      }
    }

    // Gross margin scoring
    if (fundamentals.grossMargin !== null) {
      if (sectorAverages && sectorAverages.grossMargin !== null && sectorAverages.grossMargin !== undefined) {
        const marginDiff = fundamentals.grossMargin - sectorAverages.grossMargin;
        scores.push(this.marginDiffToScore(marginDiff));
      } else {
        scores.push(this.absoluteMarginToScore(fundamentals.grossMargin));
      }
    }

    // Operating margin scoring
    if (fundamentals.operatingMargin !== null) {
      if (sectorAverages && sectorAverages.operatingMargin !== null && sectorAverages.operatingMargin !== undefined) {
        const marginDiff = fundamentals.operatingMargin - sectorAverages.operatingMargin;
        scores.push(this.marginDiffToScore(marginDiff));
      } else {
        scores.push(this.absoluteMarginToScore(fundamentals.operatingMargin));
      }
    }

    // Net margin scoring
    if (fundamentals.netMargin !== null) {
      if (sectorAverages && sectorAverages.netMargin !== null && sectorAverages.netMargin !== undefined) {
        const marginDiff = fundamentals.netMargin - sectorAverages.netMargin;
        scores.push(this.marginDiffToScore(marginDiff));
      } else {
        scores.push(this.absoluteMarginToScore(fundamentals.netMargin));
      }
    }

    if (scores.length === 0) {
      return 3; // Neutral score if no metrics available
    }

    return this.clampScore(scores.reduce((a, b) => a + b, 0) / scores.length);
  }


  /**
   * Calculate momentum score based on price performance over various periods
   * Positive momentum = higher score
   * 
   * @param ohlcvData - Historical OHLCV data (sorted by timestamp ascending)
   * @param technicals - Technical indicators
   * @returns Momentum score (1-5)
   */
  calculateMomentumScore(
    ohlcvData: OHLCV[],
    technicals: TechnicalIndicators | null
  ): number {
    if (ohlcvData.length < 2) {
      return 3; // Neutral score if insufficient data
    }

    const scores: number[] = [];
    const currentPrice = ohlcvData[ohlcvData.length - 1].close;

    // 1-week performance (5 trading days)
    if (ohlcvData.length >= 5) {
      const weekAgoPrice = ohlcvData[ohlcvData.length - 5].close;
      const weekReturn = ((currentPrice - weekAgoPrice) / weekAgoPrice) * 100;
      scores.push(this.returnToScore(weekReturn, 'short'));
    }

    // 1-month performance (21 trading days)
    if (ohlcvData.length >= 21) {
      const monthAgoPrice = ohlcvData[ohlcvData.length - 21].close;
      const monthReturn = ((currentPrice - monthAgoPrice) / monthAgoPrice) * 100;
      scores.push(this.returnToScore(monthReturn, 'medium'));
    }

    // 3-month performance (63 trading days)
    if (ohlcvData.length >= 63) {
      const threeMonthAgoPrice = ohlcvData[ohlcvData.length - 63].close;
      const threeMonthReturn = ((currentPrice - threeMonthAgoPrice) / threeMonthAgoPrice) * 100;
      scores.push(this.returnToScore(threeMonthReturn, 'medium'));
    }

    // 6-month performance (126 trading days)
    if (ohlcvData.length >= 126) {
      const sixMonthAgoPrice = ohlcvData[ohlcvData.length - 126].close;
      const sixMonthReturn = ((currentPrice - sixMonthAgoPrice) / sixMonthAgoPrice) * 100;
      scores.push(this.returnToScore(sixMonthReturn, 'long'));
    }

    // RSI-based momentum (if available)
    if (technicals?.rsi14 !== null && technicals?.rsi14 !== undefined) {
      scores.push(this.rsiToMomentumScore(technicals.rsi14));
    }

    // Price vs SMA (if available)
    if (technicals?.sma50 !== null && technicals?.sma50 !== undefined && technicals.sma50 > 0) {
      const priceVsSma50 = ((currentPrice - technicals.sma50) / technicals.sma50) * 100;
      scores.push(this.priceVsSmaToScore(priceVsSma50));
    }

    if (scores.length === 0) {
      return 3; // Neutral score if no metrics available
    }

    return this.clampScore(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  /**
   * Calculate revisions score based on analyst estimate revisions
   * More upward revisions = higher score
   * 
   * @param revisions - Analyst revisions data
   * @returns Revisions score (1-5)
   */
  calculateRevisionsScore(revisions: AnalystRevisions | null): number {
    if (!revisions) {
      return 3; // Neutral score if no data
    }

    const scores: number[] = [];

    // EPS revisions
    const totalEpsRevisions = revisions.epsRevisionsUp + revisions.epsRevisionsDown;
    if (totalEpsRevisions > 0) {
      const epsRevisionRatio = (revisions.epsRevisionsUp - revisions.epsRevisionsDown) / totalEpsRevisions;
      scores.push(this.revisionRatioToScore(epsRevisionRatio));
    }

    // Revenue revisions
    const totalRevenueRevisions = revisions.revenueRevisionsUp + revisions.revenueRevisionsDown;
    if (totalRevenueRevisions > 0) {
      const revenueRevisionRatio = (revisions.revenueRevisionsUp - revisions.revenueRevisionsDown) / totalRevenueRevisions;
      scores.push(this.revisionRatioToScore(revenueRevisionRatio));
    }

    // Target price revisions
    const totalTargetRevisions = revisions.targetPriceRevisionsUp + revisions.targetPriceRevisionsDown;
    if (totalTargetRevisions > 0) {
      const targetRevisionRatio = (revisions.targetPriceRevisionsUp - revisions.targetPriceRevisionsDown) / totalTargetRevisions;
      scores.push(this.revisionRatioToScore(targetRevisionRatio));
    }

    if (scores.length === 0) {
      return 3; // Neutral score if no revisions data
    }

    return this.clampScore(scores.reduce((a, b) => a + b, 0) / scores.length);
  }


  /**
   * Calculate overall score as weighted average of all dimension scores
   * 
   * @param valuationScore - Valuation dimension score
   * @param growthScore - Growth dimension score
   * @param profitabilityScore - Profitability dimension score
   * @param momentumScore - Momentum dimension score
   * @param revisionsScore - Revisions dimension score
   * @param weights - Optional custom weights for each dimension
   * @returns Overall score (1-5)
   * 
   * Implements Requirement 13.2: 基于估值、成长性、盈利能力、动量和修正因子计算
   */
  calculateOverallScore(
    valuationScore: number,
    growthScore: number,
    profitabilityScore: number,
    momentumScore: number,
    revisionsScore: number,
    weights: typeof DEFAULT_WEIGHTS = DEFAULT_WEIGHTS
  ): number {
    const weightedSum =
      valuationScore * weights.valuation +
      growthScore * weights.growth +
      profitabilityScore * weights.profitability +
      momentumScore * weights.momentum +
      revisionsScore * weights.revisions;

    const totalWeight =
      weights.valuation +
      weights.growth +
      weights.profitability +
      weights.momentum +
      weights.revisions;

    return this.clampScore(weightedSum / totalWeight);
  }

  /**
   * Convert overall score to rating label
   * 
   * @param score - Overall score (1-5)
   * @returns Rating label
   * 
   * Implements Requirement 13.1: 显示综合量化评级（强烈买入/买入/持有/卖出/强烈卖出）
   */
  scoreToRating(score: number): OverallRating {
    if (score >= 4.5) return 'strong_buy';
    if (score >= 3.5) return 'buy';
    if (score >= 2.5) return 'hold';
    if (score >= 1.5) return 'sell';
    return 'strong_sell';
  }

  /**
   * Calculate complete quant rating for a stock
   * 
   * @param input - Input data for rating calculation
   * @returns Complete quant rating
   */
  calculateQuantRating(input: QuantRatingInput): Omit<QuantRating, 'sectorRank' | 'industryRank'> {
    const { symbol, fundamentals, technicals, ohlcvData, sectorAverages, analystRevisions } = input;

    const valuationScore = this.calculateValuationScore(fundamentals, sectorAverages);
    const growthScore = this.calculateGrowthScore(fundamentals, sectorAverages);
    const profitabilityScore = this.calculateProfitabilityScore(fundamentals, sectorAverages);
    const momentumScore = this.calculateMomentumScore(ohlcvData, technicals);
    const revisionsScore = this.calculateRevisionsScore(analystRevisions ?? null);

    const overallScore = this.calculateOverallScore(
      valuationScore,
      growthScore,
      profitabilityScore,
      momentumScore,
      revisionsScore
    );

    const overallRating = this.scoreToRating(overallScore);

    return {
      symbol: symbol.toUpperCase(),
      overallRating,
      overallScore: Math.round(overallScore * 100) / 100,
      valuationScore: Math.round(valuationScore * 100) / 100,
      growthScore: Math.round(growthScore * 100) / 100,
      profitabilityScore: Math.round(profitabilityScore * 100) / 100,
      momentumScore: Math.round(momentumScore * 100) / 100,
      revisionsScore: Math.round(revisionsScore * 100) / 100,
      updatedAt: new Date(),
    };
  }


  /**
   * Calculate sector ranking for a stock
   * Ranks stocks within the same sector by overall score (descending)
   * 
   * @param symbol - Stock symbol
   * @param sector - Sector name
   * @returns Sector rank (1 = best)
   * 
   * Implements Requirement 13.4: 显示该股票在板块和行业中的排名
   */
  async calculateSectorRank(symbol: string, sector: string): Promise<number | null> {
    if (!sector) {
      return null;
    }

    const normalizedSymbol = symbol.trim().toUpperCase();

    // Get all stocks in the same sector with their quant ratings
    const sectorStocks = await prisma.quantRating.findMany({
      where: {
        stock: {
          sector: sector,
        },
      },
      orderBy: {
        overallScore: 'desc',
      },
      select: {
        symbol: true,
        overallScore: true,
      },
    });

    if (sectorStocks.length === 0) {
      return null;
    }

    // Find the rank of the target stock
    const rank = sectorStocks.findIndex(s => s.symbol === normalizedSymbol) + 1;
    return rank > 0 ? rank : null;
  }

  /**
   * Calculate industry ranking for a stock
   * Ranks stocks within the same industry by overall score (descending)
   * 
   * @param symbol - Stock symbol
   * @param industry - Industry name
   * @returns Industry rank (1 = best)
   * 
   * Implements Requirement 13.4: 显示该股票在板块和行业中的排名
   */
  async calculateIndustryRank(symbol: string, industry: string): Promise<number | null> {
    if (!industry) {
      return null;
    }

    const normalizedSymbol = symbol.trim().toUpperCase();

    // Get all stocks in the same industry with their quant ratings
    const industryStocks = await prisma.quantRating.findMany({
      where: {
        stock: {
          industry: industry,
        },
      },
      orderBy: {
        overallScore: 'desc',
      },
      select: {
        symbol: true,
        overallScore: true,
      },
    });

    if (industryStocks.length === 0) {
      return null;
    }

    // Find the rank of the target stock
    const rank = industryStocks.findIndex(s => s.symbol === normalizedSymbol) + 1;
    return rank > 0 ? rank : null;
  }

  /**
   * Get sector averages for comparison
   * 
   * @param sector - Sector name
   * @returns Sector average metrics
   */
  async getSectorAverages(sector: string): Promise<SectorAverages | null> {
    if (!sector) {
      return null;
    }

    // Get all fundamental metrics for stocks in the sector
    const sectorMetrics = await prisma.fundamentalMetrics.findMany({
      where: {
        stock: {
          sector: sector,
        },
      },
    });

    if (sectorMetrics.length === 0) {
      return null;
    }

    // Calculate averages (excluding null values)
    const calculateAverage = (values: (number | null)[]): number | null => {
      const validValues = values.filter((v): v is number => v !== null && !isNaN(v));
      if (validValues.length === 0) return null;
      return validValues.reduce((a, b) => a + b, 0) / validValues.length;
    };

    return {
      pe: calculateAverage(sectorMetrics.map(m => m.pe)),
      pb: calculateAverage(sectorMetrics.map(m => m.pb)),
      ps: calculateAverage(sectorMetrics.map(m => m.ps)),
      roe: calculateAverage(sectorMetrics.map(m => m.roe)),
      roa: calculateAverage(sectorMetrics.map(m => m.roa)),
      revenueGrowth: calculateAverage(sectorMetrics.map(m => m.revenueGrowth)),
      epsGrowth: calculateAverage(sectorMetrics.map(m => m.epsGrowth)),
      grossMargin: calculateAverage(sectorMetrics.map(m => m.grossMargin)),
      operatingMargin: calculateAverage(sectorMetrics.map(m => m.operatingMargin)),
      netMargin: calculateAverage(sectorMetrics.map(m => m.netMargin)),
    };
  }


  /**
   * Get quant rating for a stock with caching
   * 
   * @param symbol - Stock symbol
   * @returns Quant rating or null if not found
   */
  async getQuantRating(symbol: string): Promise<QuantRating | null> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check cache first
    const cacheKey = CacheKeys.quant.rating(normalizedSymbol);
    try {
      const cachedRating = await redisHelpers.getJson<QuantRating>(cacheKey);
      if (cachedRating) {
        logger.debug(`Quant rating cache hit for symbol: ${normalizedSymbol}`);
        return {
          ...cachedRating,
          updatedAt: new Date(cachedRating.updatedAt),
        };
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Query database for the latest rating
    const rating = await prisma.quantRating.findFirst({
      where: { symbol: normalizedSymbol },
      orderBy: { updatedAt: 'desc' },
      include: {
        stock: {
          select: {
            sector: true,
            industry: true,
          },
        },
      },
    });

    if (!rating) {
      return null;
    }

    const result: QuantRating = {
      symbol: rating.symbol,
      overallRating: rating.overallRating as OverallRating,
      overallScore: rating.overallScore,
      valuationScore: rating.valuationScore,
      growthScore: rating.growthScore,
      profitabilityScore: rating.profitabilityScore,
      momentumScore: rating.momentumScore,
      revisionsScore: rating.revisionsScore,
      sectorRank: rating.sectorRank,
      industryRank: rating.industryRank,
      updatedAt: rating.updatedAt,
    };

    // Cache result
    try {
      await redisHelpers.setJson(cacheKey, result, CacheTTL.quantRating);
      logger.debug(`Quant rating cached for symbol: ${normalizedSymbol}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return result;
  }

  /**
   * Save quant rating to database
   * 
   * @param rating - Quant rating to save
   * @returns Saved quant rating
   */
  async saveQuantRating(rating: QuantRating): Promise<QuantRating> {
    const normalizedSymbol = rating.symbol.trim().toUpperCase();

    const savedRating = await prisma.quantRating.create({
      data: {
        symbol: normalizedSymbol,
        overallRating: rating.overallRating,
        overallScore: rating.overallScore,
        valuationScore: rating.valuationScore,
        growthScore: rating.growthScore,
        profitabilityScore: rating.profitabilityScore,
        momentumScore: rating.momentumScore,
        revisionsScore: rating.revisionsScore,
        sectorRank: rating.sectorRank,
        industryRank: rating.industryRank,
      },
    });

    // Invalidate cache
    const cacheKey = CacheKeys.quant.rating(normalizedSymbol);
    try {
      await redisHelpers.del(cacheKey);
    } catch (error) {
      logger.warn('Redis cache invalidation error:', error);
    }

    return {
      symbol: savedRating.symbol,
      overallRating: savedRating.overallRating as OverallRating,
      overallScore: savedRating.overallScore,
      valuationScore: savedRating.valuationScore,
      growthScore: savedRating.growthScore,
      profitabilityScore: savedRating.profitabilityScore,
      momentumScore: savedRating.momentumScore,
      revisionsScore: savedRating.revisionsScore,
      sectorRank: savedRating.sectorRank,
      industryRank: savedRating.industryRank,
      updatedAt: savedRating.updatedAt,
    };
  }


  /**
   * Calculate and save quant rating for a stock
   * This is the main entry point for generating a new rating
   * 
   * @param symbol - Stock symbol
   * @param fundamentals - Fundamental metrics
   * @param technicals - Technical indicators
   * @param ohlcvData - Historical OHLCV data
   * @param analystRevisions - Optional analyst revisions data
   * @returns Complete quant rating with rankings
   */
  async calculateAndSaveQuantRating(
    symbol: string,
    fundamentals: FundamentalMetrics | null,
    technicals: TechnicalIndicators | null,
    ohlcvData: OHLCV[],
    analystRevisions?: AnalystRevisions | null
  ): Promise<QuantRating> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Get stock info for sector/industry
    const stock = await prisma.stock.findUnique({
      where: { symbol: normalizedSymbol },
      select: { sector: true, industry: true },
    });

    // Get sector averages for comparison
    const sectorAverages = stock?.sector
      ? await this.getSectorAverages(stock.sector)
      : null;

    // Calculate base rating
    const baseRating = this.calculateQuantRating({
      symbol: normalizedSymbol,
      fundamentals,
      technicals,
      ohlcvData,
      sectorAverages,
      analystRevisions,
    });

    // Save the rating first (needed for ranking calculation)
    const savedRating = await this.saveQuantRating({
      ...baseRating,
      sectorRank: null,
      industryRank: null,
    });

    // Calculate rankings
    const sectorRank = stock?.sector
      ? await this.calculateSectorRank(normalizedSymbol, stock.sector)
      : null;
    const industryRank = stock?.industry
      ? await this.calculateIndustryRank(normalizedSymbol, stock.industry)
      : null;

    // Update with rankings if they changed
    if (sectorRank !== null || industryRank !== null) {
      await prisma.quantRating.update({
        where: { id: savedRating.symbol },
        data: {
          sectorRank,
          industryRank,
        },
      }).catch(() => {
        // Update by finding the latest rating for this symbol
        return prisma.quantRating.updateMany({
          where: { symbol: normalizedSymbol },
          data: {
            sectorRank,
            industryRank,
          },
        });
      });

      // Invalidate cache again after ranking update
      const cacheKey = CacheKeys.quant.rating(normalizedSymbol);
      try {
        await redisHelpers.del(cacheKey);
      } catch (error) {
        logger.warn('Redis cache invalidation error:', error);
      }
    }

    return {
      ...savedRating,
      sectorRank,
      industryRank,
    };
  }

  /**
   * Get rating history for a stock
   * Returns all historical ratings sorted by date descending
   * 
   * @param symbol - Stock symbol
   * @param limit - Maximum number of entries to return (default 50)
   * @returns Array of rating history entries
   * 
   * Implements Requirement 13.5: 评级变化追踪 - 记录评级历史
   */
  async getRatingHistory(symbol: string, limit: number = 50): Promise<RatingHistoryEntry[]> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    const history = await prisma.quantRating.findMany({
      where: { symbol: normalizedSymbol },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return history.map(entry => ({
      id: entry.id,
      symbol: entry.symbol,
      overallRating: entry.overallRating as OverallRating,
      overallScore: entry.overallScore,
      valuationScore: entry.valuationScore,
      growthScore: entry.growthScore,
      profitabilityScore: entry.profitabilityScore,
      momentumScore: entry.momentumScore,
      revisionsScore: entry.revisionsScore,
      sectorRank: entry.sectorRank,
      industryRank: entry.industryRank,
      createdAt: entry.createdAt,
    }));
  }

  /**
   * Detect rating change between two ratings
   * 
   * @param previousRating - Previous rating
   * @param newRating - New rating
   * @returns Rating change event or null if no significant change
   * 
   * Implements Requirement 13.5: 评级变化追踪
   */
  detectRatingChange(
    previousRating: QuantRating | null,
    newRating: QuantRating
  ): RatingChangeEvent | null {
    if (!previousRating) {
      return null; // No previous rating to compare
    }

    const previousIndex = RATING_ORDER.indexOf(previousRating.overallRating);
    const newIndex = RATING_ORDER.indexOf(newRating.overallRating);

    let changeDirection: 'upgrade' | 'downgrade' | 'unchanged';
    if (newIndex > previousIndex) {
      changeDirection = 'upgrade';
    } else if (newIndex < previousIndex) {
      changeDirection = 'downgrade';
    } else {
      changeDirection = 'unchanged';
    }

    // Only return change event if rating actually changed
    if (changeDirection === 'unchanged') {
      return null;
    }

    return {
      symbol: newRating.symbol,
      previousRating: previousRating.overallRating,
      newRating: newRating.overallRating,
      previousScore: previousRating.overallScore,
      newScore: newRating.overallScore,
      changeDirection,
      changedAt: newRating.updatedAt,
    };
  }

  /**
   * Get the most recent rating for a stock (before the current one)
   * 
   * @param symbol - Stock symbol
   * @param excludeId - ID to exclude (current rating)
   * @returns Previous rating or null
   */
  async getPreviousRating(symbol: string, excludeId?: string): Promise<QuantRating | null> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    const previousRating = await prisma.quantRating.findFirst({
      where: {
        symbol: normalizedSymbol,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: excludeId ? 0 : 1, // Skip the most recent if no excludeId
    });

    if (!previousRating) {
      return null;
    }

    return {
      symbol: previousRating.symbol,
      overallRating: previousRating.overallRating as OverallRating,
      overallScore: previousRating.overallScore,
      valuationScore: previousRating.valuationScore,
      growthScore: previousRating.growthScore,
      profitabilityScore: previousRating.profitabilityScore,
      momentumScore: previousRating.momentumScore,
      revisionsScore: previousRating.revisionsScore,
      sectorRank: previousRating.sectorRank,
      industryRank: previousRating.industryRank,
      updatedAt: previousRating.updatedAt,
    };
  }

  /**
   * Push rating change notification to subscribed users
   * 
   * @param changeEvent - Rating change event
   * 
   * Implements Requirement 13.6: 评级变化推送 - 评级变化时推送通知
   */
  async pushRatingChangeNotification(changeEvent: RatingChangeEvent): Promise<void> {
    const { symbol, previousRating, newRating, changeDirection } = changeEvent;

    // Get stock name for better notification message
    const stock = await prisma.stock.findUnique({
      where: { symbol },
      select: { name: true },
    });

    const stockName = stock?.name || symbol;

    // Format rating labels for display
    const formatRating = (rating: OverallRating): string => {
      const labels: Record<OverallRating, string> = {
        strong_buy: '强烈买入',
        buy: '买入',
        hold: '持有',
        sell: '卖出',
        strong_sell: '强烈卖出',
      };
      return labels[rating];
    };

    const previousLabel = formatRating(previousRating);
    const newLabel = formatRating(newRating);

    // Determine priority based on change significance
    const priority: 'high' | 'medium' | 'low' = 
      changeDirection === 'upgrade' && newRating === 'strong_buy' ? 'high' :
      changeDirection === 'downgrade' && newRating === 'strong_sell' ? 'high' :
      'medium';

    const message: PushMessage = {
      type: 'rating',
      symbol,
      title: changeDirection === 'upgrade' 
        ? `${stockName} 评级上调` 
        : `${stockName} 评级下调`,
      message: `${stockName} (${symbol}) 量化评级从 ${previousLabel} 变更为 ${newLabel}`,
      priority,
      metadata: {
        previousRating,
        newRating,
        previousScore: changeEvent.previousScore,
        newScore: changeEvent.newScore,
        changeDirection,
        changedAt: changeEvent.changedAt.toISOString(),
      },
    };

    // Find users who have this stock in their watchlist and have subscribed to rating changes
    const subscribedUsers = await prisma.watchlistItem.findMany({
      where: { symbol },
      select: { userId: true },
    });

    // Push notification to each subscribed user
    for (const { userId } of subscribedUsers) {
      try {
        await pushService.pushToUser(userId, message);
        logger.debug(`Rating change notification sent to user ${userId} for ${symbol}`);
      } catch (error) {
        logger.error(`Failed to send rating change notification to user ${userId}:`, error);
      }
    }

    // Also broadcast to stock subscribers via WebSocket
    try {
      await pushService.broadcastToStock(symbol, message);
      logger.info(`Rating change notification broadcasted for ${symbol}: ${previousLabel} -> ${newLabel}`);
    } catch (error) {
      logger.error(`Failed to broadcast rating change for ${symbol}:`, error);
    }
  }

  /**
   * Calculate, save, and notify rating changes for a stock
   * This is the main entry point that includes change detection and notification
   * 
   * @param symbol - Stock symbol
   * @param fundamentals - Fundamental metrics
   * @param technicals - Technical indicators
   * @param ohlcvData - Historical OHLCV data
   * @param analystRevisions - Optional analyst revisions data
   * @returns Complete quant rating with rankings
   * 
   * Implements Requirements 13.5, 13.6: 评级变化追踪和推送
   */
  async calculateSaveAndNotifyRatingChange(
    symbol: string,
    fundamentals: FundamentalMetrics | null,
    technicals: TechnicalIndicators | null,
    ohlcvData: OHLCV[],
    analystRevisions?: AnalystRevisions | null
  ): Promise<{ rating: QuantRating; changeEvent: RatingChangeEvent | null }> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Get the previous rating before calculating new one
    const previousRating = await this.getQuantRating(normalizedSymbol);

    // Calculate and save the new rating
    const newRating = await this.calculateAndSaveQuantRating(
      normalizedSymbol,
      fundamentals,
      technicals,
      ohlcvData,
      analystRevisions
    );

    // Detect rating change
    const changeEvent = this.detectRatingChange(previousRating, newRating);

    // Push notification if rating changed
    if (changeEvent) {
      await this.pushRatingChangeNotification(changeEvent);
      logger.info(`Rating change detected for ${normalizedSymbol}: ${changeEvent.previousRating} -> ${changeEvent.newRating}`);
    }

    return { rating: newRating, changeEvent };
  }

  /**
   * Get rating change trend for a stock over time
   * 
   * @param symbol - Stock symbol
   * @param days - Number of days to look back (default 90)
   * @returns Array of rating changes
   * 
   * Implements Requirement 13.5: 评级变化追踪 - 支持查看变化趋势
   */
  async getRatingChangeTrend(symbol: string, days: number = 90): Promise<RatingChangeEvent[]> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const history = await prisma.quantRating.findMany({
      where: {
        symbol: normalizedSymbol,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    const changes: RatingChangeEvent[] = [];

    for (let i = 1; i < history.length; i++) {
      const previous = history[i - 1];
      const current = history[i];

      const previousIndex = RATING_ORDER.indexOf(previous.overallRating as OverallRating);
      const currentIndex = RATING_ORDER.indexOf(current.overallRating as OverallRating);

      if (previousIndex !== currentIndex) {
        changes.push({
          symbol: normalizedSymbol,
          previousRating: previous.overallRating as OverallRating,
          newRating: current.overallRating as OverallRating,
          previousScore: previous.overallScore,
          newScore: current.overallScore,
          changeDirection: currentIndex > previousIndex ? 'upgrade' : 'downgrade',
          changedAt: current.createdAt,
        });
      }
    }

    return changes;
  }

  // ============================================
  // Helper methods for score calculations
  // ============================================

  /**
   * Clamp score to valid range (1-5)
   */
  private clampScore(score: number): number {
    return Math.max(1, Math.min(5, score));
  }

  /**
   * Convert ratio to score (for valuation metrics where lower is better)
   */
  private ratioToScore(ratio: number, lowerIsBetter: boolean): number {
    if (lowerIsBetter) {
      // ratio < 0.5 = 5, ratio = 1 = 3, ratio > 2 = 1
      if (ratio <= 0.5) return 5;
      if (ratio <= 0.75) return 4;
      if (ratio <= 1.25) return 3;
      if (ratio <= 2) return 2;
      return 1;
    } else {
      // ratio > 2 = 5, ratio = 1 = 3, ratio < 0.5 = 1
      if (ratio >= 2) return 5;
      if (ratio >= 1.5) return 4;
      if (ratio >= 0.75) return 3;
      if (ratio >= 0.5) return 2;
      return 1;
    }
  }

  /**
   * Convert absolute P/E to score
   */
  private absolutePEToScore(pe: number): number {
    if (pe <= 10) return 5;
    if (pe <= 15) return 4;
    if (pe <= 25) return 3;
    if (pe <= 40) return 2;
    return 1;
  }

  /**
   * Convert absolute P/B to score
   */
  private absolutePBToScore(pb: number): number {
    if (pb <= 1) return 5;
    if (pb <= 2) return 4;
    if (pb <= 4) return 3;
    if (pb <= 8) return 2;
    return 1;
  }

  /**
   * Convert absolute P/S to score
   */
  private absolutePSToScore(ps: number): number {
    if (ps <= 1) return 5;
    if (ps <= 3) return 4;
    if (ps <= 6) return 3;
    if (ps <= 10) return 2;
    return 1;
  }

  /**
   * Convert PEG ratio to score
   */
  private pegToScore(peg: number): number {
    if (peg <= 0.5) return 5;
    if (peg <= 1) return 4;
    if (peg <= 1.5) return 3;
    if (peg <= 2.5) return 2;
    return 1;
  }


  /**
   * Convert growth difference to score
   */
  private growthDiffToScore(diff: number): number {
    // diff is percentage points above/below sector average
    if (diff >= 20) return 5;
    if (diff >= 10) return 4;
    if (diff >= -5) return 3;
    if (diff >= -15) return 2;
    return 1;
  }

  /**
   * Convert absolute growth rate to score
   */
  private absoluteGrowthToScore(growth: number): number {
    if (growth >= 30) return 5;
    if (growth >= 15) return 4;
    if (growth >= 5) return 3;
    if (growth >= -5) return 2;
    return 1;
  }

  /**
   * Convert profitability difference to score
   */
  private profitabilityDiffToScore(diff: number): number {
    // diff is percentage points above/below sector average
    if (diff >= 10) return 5;
    if (diff >= 5) return 4;
    if (diff >= -3) return 3;
    if (diff >= -10) return 2;
    return 1;
  }

  /**
   * Convert absolute ROE to score
   */
  private absoluteROEToScore(roe: number): number {
    if (roe >= 25) return 5;
    if (roe >= 15) return 4;
    if (roe >= 8) return 3;
    if (roe >= 0) return 2;
    return 1;
  }

  /**
   * Convert absolute ROA to score
   */
  private absoluteROAToScore(roa: number): number {
    if (roa >= 15) return 5;
    if (roa >= 10) return 4;
    if (roa >= 5) return 3;
    if (roa >= 0) return 2;
    return 1;
  }

  /**
   * Convert margin difference to score
   */
  private marginDiffToScore(diff: number): number {
    if (diff >= 15) return 5;
    if (diff >= 5) return 4;
    if (diff >= -5) return 3;
    if (diff >= -15) return 2;
    return 1;
  }

  /**
   * Convert absolute margin to score
   */
  private absoluteMarginToScore(margin: number): number {
    if (margin >= 30) return 5;
    if (margin >= 20) return 4;
    if (margin >= 10) return 3;
    if (margin >= 0) return 2;
    return 1;
  }

  /**
   * Convert price return to momentum score
   */
  private returnToScore(returnPct: number, period: 'short' | 'medium' | 'long'): number {
    const thresholds = {
      short: { high: 5, medHigh: 2, medLow: -2, low: -5 },
      medium: { high: 15, medHigh: 5, medLow: -5, low: -15 },
      long: { high: 30, medHigh: 10, medLow: -10, low: -30 },
    };

    const t = thresholds[period];
    if (returnPct >= t.high) return 5;
    if (returnPct >= t.medHigh) return 4;
    if (returnPct >= t.medLow) return 3;
    if (returnPct >= t.low) return 2;
    return 1;
  }

  /**
   * Convert RSI to momentum score
   */
  private rsiToMomentumScore(rsi: number): number {
    // RSI 50-70 is bullish momentum, 30-50 is neutral, <30 oversold, >70 overbought
    if (rsi >= 50 && rsi <= 70) return 4;
    if (rsi > 70) return 3; // Overbought - neutral
    if (rsi >= 40 && rsi < 50) return 3;
    if (rsi >= 30 && rsi < 40) return 2;
    return 2; // Oversold - could be reversal opportunity
  }

  /**
   * Convert price vs SMA to score
   */
  private priceVsSmaToScore(pctAboveSma: number): number {
    if (pctAboveSma >= 10) return 5;
    if (pctAboveSma >= 5) return 4;
    if (pctAboveSma >= -5) return 3;
    if (pctAboveSma >= -10) return 2;
    return 1;
  }

  /**
   * Convert revision ratio to score
   */
  private revisionRatioToScore(ratio: number): number {
    // ratio ranges from -1 (all down) to 1 (all up)
    if (ratio >= 0.6) return 5;
    if (ratio >= 0.2) return 4;
    if (ratio >= -0.2) return 3;
    if (ratio >= -0.6) return 2;
    return 1;
  }
}

// Export singleton instance
export const quantRatingService = new QuantRatingService();