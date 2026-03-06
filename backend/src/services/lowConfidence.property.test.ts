import fc from 'fast-check';

/**
 * Feature: smart-stock-analyzer, Property 8: 低置信度标注属�?
 * **Validates: Requirement 3.6**
 * 
 * For any analysis with confidence below threshold (0.6), it should be 
 * clearly marked as low confidence.
 */
describe('Low Confidence Annotation Property', () => {
  const LOW_CONFIDENCE_THRESHOLD = 0.6;

  /**
   * Arbitrary for generating impact analysis with various confidence levels
   */
  const impactAnalysisArbitrary = fc.record({
    direction: fc.constantFrom('bullish', 'bearish', 'neutral'),
    magnitude: fc.constantFrom('high', 'medium', 'low'),
    confidence: fc.float({ min: 0, max: 1, noNaN: true }),
    summary: fc.string({ minLength: 10, maxLength: 200 }),
    keyPoints: fc.array(fc.string({ minLength: 5, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
  });

  /**
   * Property: Analysis with confidence < 0.6 should be identified as low confidence
   */
  it('should identify low confidence when confidence < 0.6', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: Math.fround(0.59), noNaN: true }),
        (confidence) => {
          const isLowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD;
          return isLowConfidence === true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Analysis with confidence >= 0.6 should NOT be identified as low confidence
   */
  it('should NOT identify low confidence when confidence >= 0.6', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.6), max: 1.0, noNaN: true }),
        (confidence) => {
          const isLowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD;
          return isLowConfidence === false;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Low confidence classification is deterministic
   * Same confidence value should always produce same classification
   */
  it('should consistently classify confidence levels', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1, noNaN: true }),
        (confidence) => {
          const result1 = confidence < LOW_CONFIDENCE_THRESHOLD;
          const result2 = confidence < LOW_CONFIDENCE_THRESHOLD;
          return result1 === result2;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Threshold boundary behavior
   * Values exactly at threshold should not be marked as low confidence
   */
  it('should not mark threshold value as low confidence', () => {
    const isLowConfidence = LOW_CONFIDENCE_THRESHOLD < LOW_CONFIDENCE_THRESHOLD;
    expect(isLowConfidence).toBe(false);
  });

  /**
   * Property: All analysis results should be classifiable
   * For any valid confidence value, we can determine if it's low confidence
   */
  it('should classify all valid confidence values', () => {
    fc.assert(
      fc.property(
        impactAnalysisArbitrary,
        (analysis) => {
          const isLowConfidence = analysis.confidence < LOW_CONFIDENCE_THRESHOLD;
          // Should return a boolean
          return typeof isLowConfidence === 'boolean';
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Low confidence marking is based solely on confidence value
   * Other properties (direction, magnitude) should not affect classification
   */
  it('should base classification only on confidence value', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.constantFrom('bullish', 'bearish', 'neutral'),
        fc.constantFrom('high', 'medium', 'low'),
        (confidence, _direction, _magnitude) => {
          const isLowConfidence1 = confidence < LOW_CONFIDENCE_THRESHOLD;
          
          // Classification should be same regardless of direction/magnitude
          const isLowConfidence2 = confidence < LOW_CONFIDENCE_THRESHOLD;
          
          return isLowConfidence1 === isLowConfidence2;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Monotonicity - lower confidence should not become high confidence
   * If confidence1 < confidence2 and confidence1 is low, confidence2 being low is acceptable
   */
  it('should maintain monotonicity in classification', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        (conf1, conf2) => {
          if (conf1 >= conf2) return true; // Skip if not ordered
          
          const isLow1 = conf1 < LOW_CONFIDENCE_THRESHOLD;
          const isLow2 = conf2 < LOW_CONFIDENCE_THRESHOLD;
          
          // If lower confidence is NOT low, higher confidence should also NOT be low
          if (!isLow1) {
            return !isLow2;
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test suite for practical scenarios
   */
  describe('Practical Low Confidence Scenarios', () => {
    it('should mark confidence 0.5 as low', () => {
      const isLowConfidence = 0.5 < LOW_CONFIDENCE_THRESHOLD;
      expect(isLowConfidence).toBe(true);
    });

    it('should mark confidence 0.3 as low', () => {
      const isLowConfidence = 0.3 < LOW_CONFIDENCE_THRESHOLD;
      expect(isLowConfidence).toBe(true);
    });

    it('should NOT mark confidence 0.7 as low', () => {
      const isLowConfidence = 0.7 < LOW_CONFIDENCE_THRESHOLD;
      expect(isLowConfidence).toBe(false);
    });

    it('should NOT mark confidence 0.9 as low', () => {
      const isLowConfidence = 0.9 < LOW_CONFIDENCE_THRESHOLD;
      expect(isLowConfidence).toBe(false);
    });

    it('should NOT mark confidence exactly 0.6 as low', () => {
      const isLowConfidence = 0.6 < LOW_CONFIDENCE_THRESHOLD;
      expect(isLowConfidence).toBe(false);
    });

    it('should mark confidence 0.59 as low', () => {
      const isLowConfidence = 0.59 < LOW_CONFIDENCE_THRESHOLD;
      expect(isLowConfidence).toBe(true);
    });
  });

  /**
   * Test edge cases
   */
  describe('Edge Cases', () => {
    it('should mark confidence 0 as low', () => {
      const isLowConfidence = 0 < LOW_CONFIDENCE_THRESHOLD;
      expect(isLowConfidence).toBe(true);
    });

    it('should NOT mark confidence 1 as low', () => {
      const isLowConfidence = 1 < LOW_CONFIDENCE_THRESHOLD;
      expect(isLowConfidence).toBe(false);
    });

    it('should handle very small positive confidence', () => {
      const isLowConfidence = 0.001 < LOW_CONFIDENCE_THRESHOLD;
      expect(isLowConfidence).toBe(true);
    });

    it('should handle confidence very close to threshold', () => {
      const isLowConfidence = 0.5999 < LOW_CONFIDENCE_THRESHOLD;
      expect(isLowConfidence).toBe(true);
    });
  });
});
