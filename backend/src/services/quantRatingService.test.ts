import { describe, it, expect, beforeEach } from '@jest/globals';
import { QuantRatingService, SectorAverages, AnalystRevisions, QuantRating, OverallRating } from './quantRatingService.js';
import { FundamentalMetrics } from './technicalIndicatorService.js';
import { OHLCV } from './stockService.js';

describe('QuantRatingService', () => {
  let service: QuantRatingService;

  beforeEach(() => {
    service = new QuantRatingService();
  });

  describe('calculateValuationScore', () => {
    it('should return neutral score (3) when no fundamentals provided', () => {
      const score = service.calculateValuationScore(null, null);
      expect(score).toBe(3);
    });

    it('should return high score for low P/E relative to sector', () => {
      const fundamentals: FundamentalMetrics = {
        symbol: 'AAPL',
        pe: 10,
        forwardPe: null,
        peg: null,
        ps: null,
        pb: null,
        eps: null,
        epsGrowth: null,
        revenue: null,
        revenueGrowth: null,
        grossMargin: null,
        operatingMargin: null,
        netMargin: null,
        roe: null,
        roa: null,
        debtToEquity: null,
        currentRatio: null,
        dividendYield: null,
        payoutRatio: null,
      };
      const sectorAverages: SectorAverages = {
        pe: 25,
        pb: null,
        ps: null,
        roe: null,
        roa: null,
        revenueGrowth: null,
        epsGrowth: null,
        grossMargin: null,
        operatingMargin: null,
        netMargin: null,
      };

      const score = service.calculateValuationScore(fundamentals, sectorAverages);
      expect(score).toBeGreaterThanOrEqual(4);
    });

    it('should return low score for high P/E relative to sector', () => {
      const fundamentals: FundamentalMetrics = {
        symbol: 'AAPL',
        pe: 50,
        forwardPe: null,
        peg: null,
        ps: null,
        pb: null,
        eps: null,
        epsGrowth: null,
        revenue: null,
        revenueGrowth: null,
        grossMargin: null,
        operatingMargin: null,
        netMargin: null,
        roe: null,
        roa: null,
        debtToEquity: null,
        currentRatio: null,
        dividendYield: null,
        payoutRatio: null,
      };
      const sectorAverages: SectorAverages = {
        pe: 15,
        pb: null,
        ps: null,
        roe: null,
        roa: null,
        revenueGrowth: null,
        epsGrowth: null,
        grossMargin: null,
        operatingMargin: null,
        netMargin: null,
      };

      const score = service.calculateValuationScore(fundamentals, sectorAverages);
      expect(score).toBeLessThanOrEqual(2);
    });
  });


  describe('calculateGrowthScore', () => {
    it('should return neutral score (3) when no fundamentals provided', () => {
      const score = service.calculateGrowthScore(null, null);
      expect(score).toBe(3);
    });

    it('should return high score for strong revenue growth', () => {
      const fundamentals: FundamentalMetrics = {
        symbol: 'AAPL',
        pe: null,
        forwardPe: null,
        peg: null,
        ps: null,
        pb: null,
        eps: null,
        epsGrowth: null,
        revenue: null,
        revenueGrowth: 35,
        grossMargin: null,
        operatingMargin: null,
        netMargin: null,
        roe: null,
        roa: null,
        debtToEquity: null,
        currentRatio: null,
        dividendYield: null,
        payoutRatio: null,
      };

      const score = service.calculateGrowthScore(fundamentals, null);
      expect(score).toBeGreaterThanOrEqual(4);
    });

    it('should return low score for negative growth', () => {
      const fundamentals: FundamentalMetrics = {
        symbol: 'AAPL',
        pe: null,
        forwardPe: null,
        peg: null,
        ps: null,
        pb: null,
        eps: null,
        epsGrowth: -20,
        revenue: null,
        revenueGrowth: -15,
        grossMargin: null,
        operatingMargin: null,
        netMargin: null,
        roe: null,
        roa: null,
        debtToEquity: null,
        currentRatio: null,
        dividendYield: null,
        payoutRatio: null,
      };

      const score = service.calculateGrowthScore(fundamentals, null);
      expect(score).toBeLessThanOrEqual(2);
    });
  });

  describe('calculateProfitabilityScore', () => {
    it('should return neutral score (3) when no fundamentals provided', () => {
      const score = service.calculateProfitabilityScore(null, null);
      expect(score).toBe(3);
    });

    it('should return high score for strong ROE', () => {
      const fundamentals: FundamentalMetrics = {
        symbol: 'AAPL',
        pe: null,
        forwardPe: null,
        peg: null,
        ps: null,
        pb: null,
        eps: null,
        epsGrowth: null,
        revenue: null,
        revenueGrowth: null,
        grossMargin: null,
        operatingMargin: null,
        netMargin: null,
        roe: 30,
        roa: null,
        debtToEquity: null,
        currentRatio: null,
        dividendYield: null,
        payoutRatio: null,
      };

      const score = service.calculateProfitabilityScore(fundamentals, null);
      expect(score).toBeGreaterThanOrEqual(4);
    });

    it('should return low score for negative ROE', () => {
      const fundamentals: FundamentalMetrics = {
        symbol: 'AAPL',
        pe: null,
        forwardPe: null,
        peg: null,
        ps: null,
        pb: null,
        eps: null,
        epsGrowth: null,
        revenue: null,
        revenueGrowth: null,
        grossMargin: null,
        operatingMargin: null,
        netMargin: null,
        roe: -10,
        roa: -5,
        debtToEquity: null,
        currentRatio: null,
        dividendYield: null,
        payoutRatio: null,
      };

      const score = service.calculateProfitabilityScore(fundamentals, null);
      expect(score).toBeLessThanOrEqual(2);
    });
  });


  describe('calculateMomentumScore', () => {
    it('should return neutral score (3) when insufficient data', () => {
      const score = service.calculateMomentumScore([], null);
      expect(score).toBe(3);
    });

    it('should return high score for positive price momentum', () => {
      // Create OHLCV data with upward trend
      const ohlcvData: OHLCV[] = [];
      const baseDate = new Date('2024-01-01');
      for (let i = 0; i < 126; i++) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + i);
        const price = 100 + i * 0.5; // Steady upward trend
        ohlcvData.push({
          timestamp: date,
          open: price - 0.5,
          high: price + 1,
          low: price - 1,
          close: price,
          volume: 1000000,
        });
      }

      const score = service.calculateMomentumScore(ohlcvData, null);
      expect(score).toBeGreaterThanOrEqual(3.5);
    });

    it('should return low score for negative price momentum', () => {
      // Create OHLCV data with downward trend
      const ohlcvData: OHLCV[] = [];
      const baseDate = new Date('2024-01-01');
      for (let i = 0; i < 126; i++) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + i);
        const price = 200 - i * 0.8; // Steady downward trend
        ohlcvData.push({
          timestamp: date,
          open: price + 0.5,
          high: price + 1,
          low: price - 1,
          close: price,
          volume: 1000000,
        });
      }

      const score = service.calculateMomentumScore(ohlcvData, null);
      expect(score).toBeLessThanOrEqual(2.5);
    });
  });

  describe('calculateRevisionsScore', () => {
    it('should return neutral score (3) when no revisions data', () => {
      const score = service.calculateRevisionsScore(null);
      expect(score).toBe(3);
    });

    it('should return high score for mostly upward revisions', () => {
      const revisions: AnalystRevisions = {
        epsRevisionsUp: 8,
        epsRevisionsDown: 2,
        revenueRevisionsUp: 7,
        revenueRevisionsDown: 3,
        targetPriceRevisionsUp: 9,
        targetPriceRevisionsDown: 1,
      };

      const score = service.calculateRevisionsScore(revisions);
      expect(score).toBeGreaterThanOrEqual(4);
    });

    it('should return low score for mostly downward revisions', () => {
      const revisions: AnalystRevisions = {
        epsRevisionsUp: 1,
        epsRevisionsDown: 9,
        revenueRevisionsUp: 2,
        revenueRevisionsDown: 8,
        targetPriceRevisionsUp: 1,
        targetPriceRevisionsDown: 9,
      };

      const score = service.calculateRevisionsScore(revisions);
      expect(score).toBeLessThanOrEqual(2);
    });
  });


  describe('calculateOverallScore', () => {
    it('should calculate weighted average of all dimension scores', () => {
      const score = service.calculateOverallScore(4, 4, 4, 4, 4);
      expect(score).toBe(4);
    });

    it('should handle mixed scores correctly', () => {
      const score = service.calculateOverallScore(5, 3, 3, 3, 3);
      // With default weights: 5*0.25 + 3*0.20 + 3*0.20 + 3*0.20 + 3*0.15 = 1.25 + 0.6 + 0.6 + 0.6 + 0.45 = 3.5
      expect(score).toBeCloseTo(3.5, 1);
    });

    it('should clamp score to valid range', () => {
      const score = service.calculateOverallScore(5, 5, 5, 5, 5);
      expect(score).toBeLessThanOrEqual(5);
      expect(score).toBeGreaterThanOrEqual(1);
    });
  });

  describe('scoreToRating', () => {
    it('should return strong_buy for score >= 4.5', () => {
      expect(service.scoreToRating(4.5)).toBe('strong_buy');
      expect(service.scoreToRating(5)).toBe('strong_buy');
    });

    it('should return buy for score >= 3.5 and < 4.5', () => {
      expect(service.scoreToRating(3.5)).toBe('buy');
      expect(service.scoreToRating(4.4)).toBe('buy');
    });

    it('should return hold for score >= 2.5 and < 3.5', () => {
      expect(service.scoreToRating(2.5)).toBe('hold');
      expect(service.scoreToRating(3.4)).toBe('hold');
    });

    it('should return sell for score >= 1.5 and < 2.5', () => {
      expect(service.scoreToRating(1.5)).toBe('sell');
      expect(service.scoreToRating(2.4)).toBe('sell');
    });

    it('should return strong_sell for score < 1.5', () => {
      expect(service.scoreToRating(1)).toBe('strong_sell');
      expect(service.scoreToRating(1.4)).toBe('strong_sell');
    });
  });

  describe('calculateQuantRating', () => {
    it('should calculate complete rating with all dimensions', () => {
      const fundamentals: FundamentalMetrics = {
        symbol: 'AAPL',
        pe: 15,
        forwardPe: 14,
        peg: 1.2,
        ps: 5,
        pb: 3,
        eps: 6.5,
        epsGrowth: 15,
        revenue: 400000000000,
        revenueGrowth: 10,
        grossMargin: 45,
        operatingMargin: 30,
        netMargin: 25,
        roe: 150,
        roa: 25,
        debtToEquity: 1.5,
        currentRatio: 1.2,
        dividendYield: 0.5,
        payoutRatio: 15,
      };

      const ohlcvData: OHLCV[] = [];
      const baseDate = new Date('2024-01-01');
      for (let i = 0; i < 30; i++) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + i);
        ohlcvData.push({
          timestamp: date,
          open: 180,
          high: 182,
          low: 178,
          close: 180 + i * 0.1,
          volume: 50000000,
        });
      }

      const rating = service.calculateQuantRating({
        symbol: 'AAPL',
        fundamentals,
        technicals: null,
        ohlcvData,
        sectorAverages: null,
      });

      expect(rating.symbol).toBe('AAPL');
      expect(rating.overallScore).toBeGreaterThanOrEqual(1);
      expect(rating.overallScore).toBeLessThanOrEqual(5);
      expect(rating.valuationScore).toBeGreaterThanOrEqual(1);
      expect(rating.valuationScore).toBeLessThanOrEqual(5);
      expect(rating.growthScore).toBeGreaterThanOrEqual(1);
      expect(rating.growthScore).toBeLessThanOrEqual(5);
      expect(rating.profitabilityScore).toBeGreaterThanOrEqual(1);
      expect(rating.profitabilityScore).toBeLessThanOrEqual(5);
      expect(rating.momentumScore).toBeGreaterThanOrEqual(1);
      expect(rating.momentumScore).toBeLessThanOrEqual(5);
      expect(rating.revisionsScore).toBeGreaterThanOrEqual(1);
      expect(rating.revisionsScore).toBeLessThanOrEqual(5);
      expect(['strong_buy', 'buy', 'hold', 'sell', 'strong_sell']).toContain(rating.overallRating);
    });

    it('should return neutral ratings when no data available', () => {
      const rating = service.calculateQuantRating({
        symbol: 'UNKNOWN',
        fundamentals: null,
        technicals: null,
        ohlcvData: [],
        sectorAverages: null,
      });

      expect(rating.symbol).toBe('UNKNOWN');
      expect(rating.overallScore).toBe(3);
      expect(rating.valuationScore).toBe(3);
      expect(rating.growthScore).toBe(3);
      expect(rating.profitabilityScore).toBe(3);
      expect(rating.momentumScore).toBe(3);
      expect(rating.revisionsScore).toBe(3);
      expect(rating.overallRating).toBe('hold');
    });
  });

  /**
   * Tests for rating change detection
   * Implements Requirement 13.5: 评级变化追踪
   */
  describe('detectRatingChange', () => {
    const createMockRating = (overallRating: OverallRating, overallScore: number): QuantRating => ({
      symbol: 'AAPL',
      overallRating,
      overallScore,
      valuationScore: 3,
      growthScore: 3,
      profitabilityScore: 3,
      momentumScore: 3,
      revisionsScore: 3,
      sectorRank: 1,
      industryRank: 1,
      updatedAt: new Date(),
    });

    it('should return null when no previous rating exists', () => {
      const newRating = createMockRating('buy', 3.8);
      const changeEvent = service.detectRatingChange(null, newRating);
      expect(changeEvent).toBeNull();
    });

    it('should return null when rating is unchanged', () => {
      const previousRating = createMockRating('hold', 3.0);
      const newRating = createMockRating('hold', 3.2);
      const changeEvent = service.detectRatingChange(previousRating, newRating);
      expect(changeEvent).toBeNull();
    });

    it('should detect upgrade from hold to buy', () => {
      const previousRating = createMockRating('hold', 3.0);
      const newRating = createMockRating('buy', 3.8);
      const changeEvent = service.detectRatingChange(previousRating, newRating);

      expect(changeEvent).not.toBeNull();
      expect(changeEvent!.changeDirection).toBe('upgrade');
      expect(changeEvent!.previousRating).toBe('hold');
      expect(changeEvent!.newRating).toBe('buy');
      expect(changeEvent!.symbol).toBe('AAPL');
    });

    it('should detect upgrade from sell to hold', () => {
      const previousRating = createMockRating('sell', 2.0);
      const newRating = createMockRating('hold', 2.8);
      const changeEvent = service.detectRatingChange(previousRating, newRating);

      expect(changeEvent).not.toBeNull();
      expect(changeEvent!.changeDirection).toBe('upgrade');
      expect(changeEvent!.previousRating).toBe('sell');
      expect(changeEvent!.newRating).toBe('hold');
    });

    it('should detect upgrade from strong_sell to strong_buy', () => {
      const previousRating = createMockRating('strong_sell', 1.2);
      const newRating = createMockRating('strong_buy', 4.8);
      const changeEvent = service.detectRatingChange(previousRating, newRating);

      expect(changeEvent).not.toBeNull();
      expect(changeEvent!.changeDirection).toBe('upgrade');
      expect(changeEvent!.previousRating).toBe('strong_sell');
      expect(changeEvent!.newRating).toBe('strong_buy');
    });

    it('should detect downgrade from buy to hold', () => {
      const previousRating = createMockRating('buy', 3.8);
      const newRating = createMockRating('hold', 3.0);
      const changeEvent = service.detectRatingChange(previousRating, newRating);

      expect(changeEvent).not.toBeNull();
      expect(changeEvent!.changeDirection).toBe('downgrade');
      expect(changeEvent!.previousRating).toBe('buy');
      expect(changeEvent!.newRating).toBe('hold');
    });

    it('should detect downgrade from strong_buy to sell', () => {
      const previousRating = createMockRating('strong_buy', 4.8);
      const newRating = createMockRating('sell', 2.0);
      const changeEvent = service.detectRatingChange(previousRating, newRating);

      expect(changeEvent).not.toBeNull();
      expect(changeEvent!.changeDirection).toBe('downgrade');
      expect(changeEvent!.previousRating).toBe('strong_buy');
      expect(changeEvent!.newRating).toBe('sell');
    });

    it('should include score information in change event', () => {
      const previousRating = createMockRating('hold', 3.0);
      const newRating = createMockRating('buy', 3.8);
      const changeEvent = service.detectRatingChange(previousRating, newRating);

      expect(changeEvent).not.toBeNull();
      expect(changeEvent!.previousScore).toBe(3.0);
      expect(changeEvent!.newScore).toBe(3.8);
    });

    it('should include timestamp in change event', () => {
      const previousRating = createMockRating('hold', 3.0);
      const newRating = createMockRating('buy', 3.8);
      const changeEvent = service.detectRatingChange(previousRating, newRating);

      expect(changeEvent).not.toBeNull();
      expect(changeEvent!.changedAt).toBeInstanceOf(Date);
    });
  });
});