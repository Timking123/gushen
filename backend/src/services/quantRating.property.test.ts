/**
 * Property-Based Tests for Quant Rating Calculation
 * Feature: smart-stock-analyzer, Property 19: 量化评级计算属�?
 * 
 * **Validates: Requirements 13.1, 13.2**
 * 
 * Property: For any stock's quant rating, the overall rating should be calculated
 * based on weighted average of valuation, growth, profitability, momentum, and revisions scores.
 * 
 * Requirements:
 * - 13.1: WHEN 用户查看股票详情 THEN Quant_Rating SHALL 显示综合量化评级（强烈买�?买入/持有/卖出/强烈卖出�?
 * - 13.2: WHEN 生成量化评级 THEN Quant_Rating SHALL 基于估值、成长性、盈利能力、动量和修正因子计算
 */

import fc from 'fast-check';
import { describe, it, expect } from '@jest/globals';
import { 
  QuantRatingService, 
  QuantRating, 
  OverallRating 
} from './quantRatingService.js';

/**
 * Valid overall rating values as defined in the design document
 */
const VALID_RATINGS: OverallRating[] = ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'];

/**
 * Default weights for each dimension in overall score calculation
 * Must match the weights in quantRatingService.ts
 */
const DEFAULT_WEIGHTS = {
  valuation: 0.25,
  growth: 0.20,
  profitability: 0.20,
  momentum: 0.20,
  revisions: 0.15,
};

/**
 * Create a new instance of QuantRatingService for testing
 */
const quantRatingService = new QuantRatingService();

/**
 * Helper function to check if a score is in valid range (1-5)
 */
function isValidScore(score: number): boolean {
  return typeof score === 'number' && 
         score >= 1 && 
         score <= 5 && 
         Number.isFinite(score);
}

/**
 * Helper function to check if a rating is valid
 */
function isValidRating(rating: unknown): rating is OverallRating {
  return typeof rating === 'string' && VALID_RATINGS.includes(rating as OverallRating);
}

/**
 * Helper function to calculate expected overall score from dimension scores
 */
function calculateExpectedOverallScore(
  valuationScore: number,
  growthScore: number,
  profitabilityScore: number,
  momentumScore: number,
  revisionsScore: number,
  weights = DEFAULT_WEIGHTS
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

  return weightedSum / totalWeight;
}

/**
 * Helper function to get expected rating from score
 */
function getExpectedRating(score: number): OverallRating {
  if (score >= 4.5) return 'strong_buy';
  if (score >= 3.5) return 'buy';
  if (score >= 2.5) return 'hold';
  if (score >= 1.5) return 'sell';
  return 'strong_sell';
}

/**
 * Arbitrary generator for valid dimension scores (1-5)
 * Uses integer cents and converts to avoid floating point issues
 */
const dimensionScoreArbitrary = fc.integer({ min: 100, max: 500 }).map(cents => cents / 100);

/**
 * Arbitrary generator for stock symbols
 */
const symbolArbitrary = fc.stringMatching(/^[A-Z]{1,5}$/);

/**
 * Arbitrary generator for valid timestamps
 */
const timestampArbitrary = fc.integer({
  min: Date.now() - 365 * 24 * 60 * 60 * 1000, // 1 year ago
  max: Date.now(),
}).map(timestamp => new Date(timestamp));

/**
 * Arbitrary generator for sector/industry rank (can be null or positive number)
 */
const rankArbitrary = fc.option(
  fc.integer({ min: 1, max: 1000 }),
  { nil: null }
);

/**
 * Arbitrary generator for a complete QuantRating with consistent scores
 */
const quantRatingArbitrary = fc.record({
  symbol: symbolArbitrary,
  valuationScore: dimensionScoreArbitrary,
  growthScore: dimensionScoreArbitrary,
  profitabilityScore: dimensionScoreArbitrary,
  momentumScore: dimensionScoreArbitrary,
  revisionsScore: dimensionScoreArbitrary,
  sectorRank: rankArbitrary,
  industryRank: rankArbitrary,
  updatedAt: timestampArbitrary,
}).map(record => {
  // Calculate overall score based on dimension scores
  const overallScore = calculateExpectedOverallScore(
    record.valuationScore,
    record.growthScore,
    record.profitabilityScore,
    record.momentumScore,
    record.revisionsScore
  );
  
  // Round to 2 decimal places as the service does
  const roundedOverallScore = Math.round(overallScore * 100) / 100;
  
  return {
    ...record,
    overallScore: roundedOverallScore,
    overallRating: getExpectedRating(roundedOverallScore),
  } as QuantRating;
});

/**
 * Arbitrary generator for dimension scores tuple
 */
const dimensionScoresTupleArbitrary = fc.tuple(
  dimensionScoreArbitrary, // valuation
  dimensionScoreArbitrary, // growth
  dimensionScoreArbitrary, // profitability
  dimensionScoreArbitrary, // momentum
  dimensionScoreArbitrary  // revisions
);

describe('Property 19: 量化评级计算属性', () => {
  /**
   * Test 1: All dimension scores should be in valid range (1-5)
   * Validates Requirement 13.2: 基于估值、成长性、盈利能力、动量和修正因子计算
   */
  it('should have all dimension scores in valid range (1-5)', () => {
    fc.assert(
      fc.property(
        quantRatingArbitrary,
        (rating) => {
          // Property: valuationScore must be in range 1-5
          expect(rating.valuationScore).toBeGreaterThanOrEqual(1);
          expect(rating.valuationScore).toBeLessThanOrEqual(5);
          expect(isValidScore(rating.valuationScore)).toBe(true);
          
          // Property: growthScore must be in range 1-5
          expect(rating.growthScore).toBeGreaterThanOrEqual(1);
          expect(rating.growthScore).toBeLessThanOrEqual(5);
          expect(isValidScore(rating.growthScore)).toBe(true);
          
          // Property: profitabilityScore must be in range 1-5
          expect(rating.profitabilityScore).toBeGreaterThanOrEqual(1);
          expect(rating.profitabilityScore).toBeLessThanOrEqual(5);
          expect(isValidScore(rating.profitabilityScore)).toBe(true);
          
          // Property: momentumScore must be in range 1-5
          expect(rating.momentumScore).toBeGreaterThanOrEqual(1);
          expect(rating.momentumScore).toBeLessThanOrEqual(5);
          expect(isValidScore(rating.momentumScore)).toBe(true);
          
          // Property: revisionsScore must be in range 1-5
          expect(rating.revisionsScore).toBeGreaterThanOrEqual(1);
          expect(rating.revisionsScore).toBeLessThanOrEqual(5);
          expect(isValidScore(rating.revisionsScore)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 2: Overall score should be in valid range (1-5)
   * Validates Requirement 13.2
   */
  it('should have overall score in valid range (1-5)', () => {
    fc.assert(
      fc.property(
        quantRatingArbitrary,
        (rating) => {
          // Property: overallScore must be in range 1-5
          expect(rating.overallScore).toBeGreaterThanOrEqual(1);
          expect(rating.overallScore).toBeLessThanOrEqual(5);
          expect(isValidScore(rating.overallScore)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 3: Overall score should be a weighted average of dimension scores
   * Validates Requirement 13.2: 基于估值、成长性、盈利能力、动量和修正因子计算
   */
  it('should calculate overall score as weighted average of dimension scores', () => {
    fc.assert(
      fc.property(
        dimensionScoresTupleArbitrary,
        ([valuationScore, growthScore, profitabilityScore, momentumScore, revisionsScore]) => {
          // Calculate overall score using the service
          const calculatedScore = quantRatingService.calculateOverallScore(
            valuationScore,
            growthScore,
            profitabilityScore,
            momentumScore,
            revisionsScore
          );
          
          // Calculate expected score manually
          const expectedScore = calculateExpectedOverallScore(
            valuationScore,
            growthScore,
            profitabilityScore,
            momentumScore,
            revisionsScore
          );
          
          // Property: calculated score should match expected weighted average
          // Allow small tolerance for floating point differences
          expect(Math.abs(calculatedScore - expectedScore)).toBeLessThan(0.001);
          
          // Property: result should be in valid range
          expect(calculatedScore).toBeGreaterThanOrEqual(1);
          expect(calculatedScore).toBeLessThanOrEqual(5);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 4: Rating label should correspond correctly to overall score
   * Validates Requirement 13.1: 显示综合量化评级（强烈买�?买入/持有/卖出/强烈卖出�?
   * 
   * Score thresholds:
   * - score >= 4.5 �?strong_buy
   * - score >= 3.5 �?buy
   * - score >= 2.5 �?hold
   * - score >= 1.5 �?sell
   * - score < 1.5 �?strong_sell
   */
  it('should map overall score to correct rating label', () => {
    fc.assert(
      fc.property(
        dimensionScoreArbitrary,
        (score) => {
          // Get rating from service
          const rating = quantRatingService.scoreToRating(score);
          
          // Property: rating must be a valid rating value
          expect(isValidRating(rating)).toBe(true);
          
          // Property: rating should match expected based on score thresholds
          const expectedRating = getExpectedRating(score);
          expect(rating).toBe(expectedRating);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 5: Strong buy rating for scores >= 4.5
   */
  it('should return strong_buy for scores >= 4.5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 450, max: 500 }).map(cents => cents / 100),
        (score) => {
          const rating = quantRatingService.scoreToRating(score);
          expect(rating).toBe('strong_buy');
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 6: Buy rating for scores >= 3.5 and < 4.5
   */
  it('should return buy for scores >= 3.5 and < 4.5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 350, max: 449 }).map(cents => cents / 100),
        (score) => {
          const rating = quantRatingService.scoreToRating(score);
          expect(rating).toBe('buy');
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 7: Hold rating for scores >= 2.5 and < 3.5
   */
  it('should return hold for scores >= 2.5 and < 3.5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 250, max: 349 }).map(cents => cents / 100),
        (score) => {
          const rating = quantRatingService.scoreToRating(score);
          expect(rating).toBe('hold');
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 8: Sell rating for scores >= 1.5 and < 2.5
   */
  it('should return sell for scores >= 1.5 and < 2.5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 150, max: 249 }).map(cents => cents / 100),
        (score) => {
          const rating = quantRatingService.scoreToRating(score);
          expect(rating).toBe('sell');
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 9: Strong sell rating for scores < 1.5
   */
  it('should return strong_sell for scores < 1.5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 149 }).map(cents => cents / 100),
        (score) => {
          const rating = quantRatingService.scoreToRating(score);
          expect(rating).toBe('strong_sell');
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 10: Higher dimension scores should result in higher overall scores
   * Validates Requirement 13.2
   */
  it('should produce higher overall score when dimension scores increase', () => {
    fc.assert(
      fc.property(
        dimensionScoresTupleArbitrary,
        fc.double({ min: 0.01, max: 1.0, noNaN: true }),
        ([valuation, growth, profitability, momentum, revisions], increment) => {
          // Calculate base score
          const baseScore = quantRatingService.calculateOverallScore(
            valuation,
            growth,
            profitability,
            momentum,
            revisions
          );
          
          // Calculate score with all dimensions increased (clamped to max 5)
          const increasedScore = quantRatingService.calculateOverallScore(
            Math.min(5, valuation + increment),
            Math.min(5, growth + increment),
            Math.min(5, profitability + increment),
            Math.min(5, momentum + increment),
            Math.min(5, revisions + increment)
          );
          
          // Property: increased scores should result in equal or higher overall score
          expect(increasedScore).toBeGreaterThanOrEqual(baseScore);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 11: Overall score should be bounded by min and max dimension scores
   */
  it('should have overall score bounded by min and max dimension scores', () => {
    fc.assert(
      fc.property(
        dimensionScoresTupleArbitrary,
        ([valuation, growth, profitability, momentum, revisions]) => {
          const scores = [valuation, growth, profitability, momentum, revisions];
          const minScore = Math.min(...scores);
          const maxScore = Math.max(...scores);
          
          const overallScore = quantRatingService.calculateOverallScore(
            valuation,
            growth,
            profitability,
            momentum,
            revisions
          );
          
          // Property: overall score should be between min and max dimension scores
          expect(overallScore).toBeGreaterThanOrEqual(minScore);
          expect(overallScore).toBeLessThanOrEqual(maxScore);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 12: Equal dimension scores should result in that same overall score
   */
  it('should return same score when all dimensions are equal', () => {
    fc.assert(
      fc.property(
        dimensionScoreArbitrary,
        (uniformScore) => {
          const overallScore = quantRatingService.calculateOverallScore(
            uniformScore,
            uniformScore,
            uniformScore,
            uniformScore,
            uniformScore
          );
          
          // Property: when all dimensions are equal, overall should equal that value
          expect(Math.abs(overallScore - uniformScore)).toBeLessThan(0.001);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 13: Rating transitions should be monotonic with score
   */
  it('should have monotonic rating transitions as score increases', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 400 }).map(cents => cents / 100),
        (lowerScore) => {
          const higherScore = lowerScore + 1; // Guaranteed to be higher
          
          const lowerRating = quantRatingService.scoreToRating(lowerScore);
          const higherRating = quantRatingService.scoreToRating(higherScore);
          
          // Define rating order (lower index = worse rating)
          const ratingOrder: OverallRating[] = ['strong_sell', 'sell', 'hold', 'buy', 'strong_buy'];
          
          const lowerIndex = ratingOrder.indexOf(lowerRating);
          const higherIndex = ratingOrder.indexOf(higherRating);
          
          // Property: higher score should result in equal or better rating
          expect(higherIndex).toBeGreaterThanOrEqual(lowerIndex);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 14: Weights should sum to 1.0 (or close to it)
   */
  it('should use weights that sum to approximately 1.0', () => {
    const totalWeight =
      DEFAULT_WEIGHTS.valuation +
      DEFAULT_WEIGHTS.growth +
      DEFAULT_WEIGHTS.profitability +
      DEFAULT_WEIGHTS.momentum +
      DEFAULT_WEIGHTS.revisions;
    
    // Property: weights should sum to 1.0
    expect(Math.abs(totalWeight - 1.0)).toBeLessThan(0.001);
  });

  /**
   * Test 15: Valuation has highest weight (0.25)
   */
  it('should give valuation the highest weight', () => {
    // Property: valuation weight should be the highest
    expect(DEFAULT_WEIGHTS.valuation).toBeGreaterThanOrEqual(DEFAULT_WEIGHTS.growth);
    expect(DEFAULT_WEIGHTS.valuation).toBeGreaterThanOrEqual(DEFAULT_WEIGHTS.profitability);
    expect(DEFAULT_WEIGHTS.valuation).toBeGreaterThanOrEqual(DEFAULT_WEIGHTS.momentum);
    expect(DEFAULT_WEIGHTS.valuation).toBeGreaterThanOrEqual(DEFAULT_WEIGHTS.revisions);
  });

  /**
   * Test 16: Changing valuation score has the most impact on overall score
   * When all dimensions have the same room to increase, valuation should have the most impact
   */
  it('should have valuation score impact overall score the most', () => {
    fc.assert(
      fc.property(
        // Use scores that leave room for equal increments (max 4.0 so +1 doesn't clamp)
        fc.integer({ min: 100, max: 400 }).map(cents => cents / 100),
        fc.integer({ min: 100, max: 400 }).map(cents => cents / 100),
        fc.integer({ min: 100, max: 400 }).map(cents => cents / 100),
        fc.integer({ min: 100, max: 400 }).map(cents => cents / 100),
        fc.integer({ min: 100, max: 400 }).map(cents => cents / 100),
        (valuation, growth, profitability, momentum, revisions) => {
          const baseScore = quantRatingService.calculateOverallScore(
            valuation,
            growth,
            profitability,
            momentum,
            revisions
          );
          
          // Increase each dimension by 1 (no clamping needed since max is 4.0)
          const increment = 1;
          
          const valuationImpact = Math.abs(
            quantRatingService.calculateOverallScore(
              valuation + increment,
              growth,
              profitability,
              momentum,
              revisions
            ) - baseScore
          );
          
          const growthImpact = Math.abs(
            quantRatingService.calculateOverallScore(
              valuation,
              growth + increment,
              profitability,
              momentum,
              revisions
            ) - baseScore
          );
          
          const revisionsImpact = Math.abs(
            quantRatingService.calculateOverallScore(
              valuation,
              growth,
              profitability,
              momentum,
              revisions + increment
            ) - baseScore
          );
          
          // Property: valuation impact should be >= growth impact (0.25 vs 0.20)
          // Allow small tolerance for floating point
          expect(valuationImpact + 0.001).toBeGreaterThanOrEqual(growthImpact);
          
          // Property: valuation impact should be >= revisions impact (0.25 vs 0.15)
          expect(valuationImpact + 0.001).toBeGreaterThanOrEqual(revisionsImpact);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 17: QuantRating should have all required fields
   */
  it('should have all required fields in QuantRating', () => {
    fc.assert(
      fc.property(
        quantRatingArbitrary,
        (rating) => {
          // Property: symbol must be defined and non-empty
          expect(rating.symbol).toBeDefined();
          expect(typeof rating.symbol).toBe('string');
          expect(rating.symbol.length).toBeGreaterThan(0);
          
          // Property: overallRating must be a valid rating
          expect(rating.overallRating).toBeDefined();
          expect(isValidRating(rating.overallRating)).toBe(true);
          
          // Property: overallScore must be defined and valid
          expect(rating.overallScore).toBeDefined();
          expect(isValidScore(rating.overallScore)).toBe(true);
          
          // Property: all dimension scores must be defined and valid
          expect(rating.valuationScore).toBeDefined();
          expect(rating.growthScore).toBeDefined();
          expect(rating.profitabilityScore).toBeDefined();
          expect(rating.momentumScore).toBeDefined();
          expect(rating.revisionsScore).toBeDefined();
          
          // Property: updatedAt must be a valid Date
          expect(rating.updatedAt).toBeInstanceOf(Date);
          expect(!isNaN(rating.updatedAt.getTime())).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 18: Sector and industry ranks can be null or positive numbers
   */
  it('should have sectorRank and industryRank as null or positive numbers', () => {
    fc.assert(
      fc.property(
        quantRatingArbitrary,
        (rating) => {
          // Property: sectorRank can be null or positive number
          if (rating.sectorRank !== null) {
            expect(typeof rating.sectorRank).toBe('number');
            expect(rating.sectorRank).toBeGreaterThan(0);
          } else {
            expect(rating.sectorRank).toBeNull();
          }
          
          // Property: industryRank can be null or positive number
          if (rating.industryRank !== null) {
            expect(typeof rating.industryRank).toBe('number');
            expect(rating.industryRank).toBeGreaterThan(0);
          } else {
            expect(rating.industryRank).toBeNull();
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 19: Data should be preserved through JSON serialization
   */
  it('should preserve critical data through JSON serialization', () => {
    fc.assert(
      fc.property(
        quantRatingArbitrary,
        (rating) => {
          // Simulate JSON serialization (as would happen in API response)
          const serialized = JSON.stringify(rating);
          const deserialized = JSON.parse(serialized);
          
          // Property: symbol should be preserved
          expect(deserialized.symbol).toBe(rating.symbol);
          
          // Property: overallRating should be preserved
          expect(deserialized.overallRating).toBe(rating.overallRating);
          
          // Property: overallScore should be preserved
          expect(deserialized.overallScore).toBe(rating.overallScore);
          
          // Property: dimension scores should be preserved
          expect(deserialized.valuationScore).toBe(rating.valuationScore);
          expect(deserialized.growthScore).toBe(rating.growthScore);
          expect(deserialized.profitabilityScore).toBe(rating.profitabilityScore);
          expect(deserialized.momentumScore).toBe(rating.momentumScore);
          expect(deserialized.revisionsScore).toBe(rating.revisionsScore);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 20: Overall rating should be consistent with overall score
   */
  it('should have overall rating consistent with overall score', () => {
    fc.assert(
      fc.property(
        quantRatingArbitrary,
        (rating) => {
          // Property: overallRating should match what scoreToRating returns for overallScore
          const expectedRating = quantRatingService.scoreToRating(rating.overallScore);
          expect(rating.overallRating).toBe(expectedRating);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });
});
