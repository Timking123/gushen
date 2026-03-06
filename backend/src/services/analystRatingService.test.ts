/**
 * Analyst Rating Service Tests
 * Tests for Requirements 19.1, 19.2, 19.4
 */

import {
  ratingToNumeric,
  numericToRating,
  getChangeType,
  type RatingType,
} from './analystRatingService.js';

describe('AnalystRatingService', () => {
  describe('ratingToNumeric', () => {
    it('should convert strong_buy to 5', () => {
      expect(ratingToNumeric('strong_buy')).toBe(5);
    });

    it('should convert buy to 4', () => {
      expect(ratingToNumeric('buy')).toBe(4);
    });

    it('should convert hold to 3', () => {
      expect(ratingToNumeric('hold')).toBe(3);
    });

    it('should convert sell to 2', () => {
      expect(ratingToNumeric('sell')).toBe(2);
    });

    it('should convert strong_sell to 1', () => {
      expect(ratingToNumeric('strong_sell')).toBe(1);
    });
  });

  describe('numericToRating', () => {
    it('should convert 5 to strong_buy', () => {
      expect(numericToRating(5)).toBe('strong_buy');
    });

    it('should convert 4.5 to strong_buy', () => {
      expect(numericToRating(4.5)).toBe('strong_buy');
    });

    it('should convert 4 to buy', () => {
      expect(numericToRating(4)).toBe('buy');
    });

    it('should convert 3.5 to buy', () => {
      expect(numericToRating(3.5)).toBe('buy');
    });

    it('should convert 3 to hold', () => {
      expect(numericToRating(3)).toBe('hold');
    });

    it('should convert 2.5 to hold', () => {
      expect(numericToRating(2.5)).toBe('hold');
    });

    it('should convert 2 to sell', () => {
      expect(numericToRating(2)).toBe('sell');
    });

    it('should convert 1.5 to sell', () => {
      expect(numericToRating(1.5)).toBe('sell');
    });

    it('should convert 1 to strong_sell', () => {
      expect(numericToRating(1)).toBe('strong_sell');
    });

    it('should convert values below 1.5 to strong_sell', () => {
      expect(numericToRating(1.2)).toBe('strong_sell');
    });
  });

  describe('getChangeType', () => {
    it('should return initiate when previous rating is null', () => {
      expect(getChangeType(null, 'buy')).toBe('initiate');
    });

    it('should return upgrade when new rating is higher', () => {
      expect(getChangeType('hold', 'buy')).toBe('upgrade');
      expect(getChangeType('sell', 'hold')).toBe('upgrade');
      expect(getChangeType('strong_sell', 'sell')).toBe('upgrade');
      expect(getChangeType('buy', 'strong_buy')).toBe('upgrade');
    });

    it('should return downgrade when new rating is lower', () => {
      expect(getChangeType('buy', 'hold')).toBe('downgrade');
      expect(getChangeType('hold', 'sell')).toBe('downgrade');
      expect(getChangeType('sell', 'strong_sell')).toBe('downgrade');
      expect(getChangeType('strong_buy', 'buy')).toBe('downgrade');
    });

    it('should return maintain when rating is unchanged', () => {
      expect(getChangeType('buy', 'buy')).toBe('maintain');
      expect(getChangeType('hold', 'hold')).toBe('maintain');
      expect(getChangeType('sell', 'sell')).toBe('maintain');
    });

    it('should handle multi-level upgrades', () => {
      expect(getChangeType('strong_sell', 'strong_buy')).toBe('upgrade');
      expect(getChangeType('sell', 'buy')).toBe('upgrade');
    });

    it('should handle multi-level downgrades', () => {
      expect(getChangeType('strong_buy', 'strong_sell')).toBe('downgrade');
      expect(getChangeType('buy', 'sell')).toBe('downgrade');
    });
  });

  describe('Rating conversion round-trip', () => {
    const ratings: RatingType[] = ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'];

    it('should maintain rating identity through numeric conversion', () => {
      for (const rating of ratings) {
        const numeric = ratingToNumeric(rating);
        const converted = numericToRating(numeric);
        expect(converted).toBe(rating);
      }
    });
  });

  describe('Consensus rating calculation', () => {
    it('should calculate correct consensus for all buy ratings', () => {
      const ratings: RatingType[] = ['buy', 'buy', 'buy'];
      const avgScore = ratings.reduce((sum, r) => sum + ratingToNumeric(r), 0) / ratings.length;
      expect(numericToRating(avgScore)).toBe('buy');
    });

    it('should calculate correct consensus for mixed ratings', () => {
      // 2 buy (4) + 1 hold (3) = 11/3 = 3.67 -> buy
      const ratings: RatingType[] = ['buy', 'buy', 'hold'];
      const avgScore = ratings.reduce((sum, r) => sum + ratingToNumeric(r), 0) / ratings.length;
      expect(numericToRating(avgScore)).toBe('buy');
    });

    it('should calculate correct consensus for bearish ratings', () => {
      // 2 sell (2) + 1 hold (3) = 7/3 = 2.33 -> sell
      const ratings: RatingType[] = ['sell', 'sell', 'hold'];
      const avgScore = ratings.reduce((sum, r) => sum + ratingToNumeric(r), 0) / ratings.length;
      expect(numericToRating(avgScore)).toBe('sell');
    });

    it('should calculate correct consensus for neutral ratings', () => {
      // 1 buy (4) + 1 hold (3) + 1 sell (2) = 9/3 = 3 -> hold
      const ratings: RatingType[] = ['buy', 'hold', 'sell'];
      const avgScore = ratings.reduce((sum, r) => sum + ratingToNumeric(r), 0) / ratings.length;
      expect(numericToRating(avgScore)).toBe('hold');
    });
  });
});
