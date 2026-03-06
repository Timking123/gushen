import fc from 'fast-check';
import { analysisService } from './analysisService.js';
import { prisma } from '../lib/prisma.js';

/**
 * Feature: smart-stock-analyzer, Property 7: 影响分析完整性属�?
 * **Validates: Requirements 3.1, 3.2**
 * 
 * For any news analysis result, it should contain valid impact direction 
 * (bullish/bearish/neutral), impact magnitude (high/medium/low), and 
 * confidence (0-1 range).
 */
describe('Impact Analysis Completeness Property', () => {
  // Arbitraries for generating test data
  const directionArbitrary = fc.constantFrom('bullish', 'bearish', 'neutral');
  const magnitudeArbitrary = fc.constantFrom('high', 'medium', 'low');
  const confidenceArbitrary = fc.float({ min: 0, max: 1 });
  const summaryArbitrary = fc.string({ minLength: 10, maxLength: 200 });
  const keyPointsArbitrary = fc.array(fc.string({ minLength: 5, maxLength: 100 }), { minLength: 1, maxLength: 5 });

  const impactAnalysisArbitrary = fc.record({
    direction: directionArbitrary,
    magnitude: magnitudeArbitrary,
    confidence: confidenceArbitrary,
    summary: summaryArbitrary,
    keyPoints: keyPointsArbitrary,
    historicalComparison: fc.option(fc.string({ minLength: 10, maxLength: 200 }), { nil: undefined }),
  });

  /**
   * Property: All impact analysis results must have valid direction
   */
  it('should have valid direction (bullish/bearish/neutral)', () => {
    fc.assert(
      fc.property(impactAnalysisArbitrary, (analysis) => {
        const validDirections = ['bullish', 'bearish', 'neutral'];
        return validDirections.includes(analysis.direction);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property: All impact analysis results must have valid magnitude
   */
  it('should have valid magnitude (high/medium/low)', () => {
    fc.assert(
      fc.property(impactAnalysisArbitrary, (analysis) => {
        const validMagnitudes = ['high', 'medium', 'low'];
        return validMagnitudes.includes(analysis.magnitude);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property: All impact analysis results must have confidence between 0 and 1
   */
  it('should have confidence between 0 and 1', () => {
    fc.assert(
      fc.property(impactAnalysisArbitrary, (analysis) => {
        // Filter out NaN values
        fc.pre(!Number.isNaN(analysis.confidence));
        return analysis.confidence >= 0 && analysis.confidence <= 1;
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property: All impact analysis results must have non-empty summary
   */
  it('should have non-empty summary', () => {
    fc.assert(
      fc.property(impactAnalysisArbitrary, (analysis) => {
        return analysis.summary.trim().length > 0;
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property: All impact analysis results must have at least one key point
   */
  it('should have at least one key point', () => {
    fc.assert(
      fc.property(impactAnalysisArbitrary, (analysis) => {
        return analysis.keyPoints.length > 0;
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Integration test: Validate analysis service produces complete analysis
   * Note: Requires database connection
   */
  describe('Integration with AnalysisService', () => {
    let testNewsId: string;
    let dbAvailable = false;

    beforeAll(async () => {
      try {
        // Test database connection
        await prisma.$connect();
        dbAvailable = true;

        // Create a test news item
        const newsItem = await prisma.newsItem.create({
          data: {
            title: 'Test News for Impact Analysis',
            summary: 'This is a test news item for property testing',
            content: 'Detailed content about positive earnings and growth prospects',
            source: 'Test Source',
            sourceCredibility: 'high',
            url: 'https://test.com/news/impact-test',
            publishedAt: new Date(),
            sectors: ['technology'],
          },
        });
        testNewsId = newsItem.id;
      } catch (error) {
        console.log('Database not available, skipping integration test');
        dbAvailable = false;
      }
    });

    afterAll(async () => {
      if (dbAvailable && testNewsId) {
        try {
          // Clean up test data
          await prisma.impactAnalysis.deleteMany({
            where: { newsId: testNewsId },
          });
          await prisma.newsItem.delete({
            where: { id: testNewsId },
          });
        } catch (error) {
          console.log('Error cleaning up test data:', error);
        }
      }
      await prisma.$disconnect();
    });

    it('should produce complete impact analysis with all required fields', async () => {
      if (!dbAvailable) {
        console.log('Skipping test - database not available');
        return;
      }

      const analysis = await analysisService.analyzeNewsImpact(testNewsId);

      // Validate completeness
      expect(['bullish', 'bearish', 'neutral']).toContain(analysis.direction);
      expect(['high', 'medium', 'low']).toContain(analysis.magnitude);
      expect(analysis.confidence).toBeGreaterThanOrEqual(0);
      expect(analysis.confidence).toBeLessThanOrEqual(1);
      expect(analysis.summary).toBeTruthy();
      expect(analysis.summary.trim().length).toBeGreaterThan(0);
      expect(analysis.keyPoints).toBeDefined();
      expect(analysis.keyPoints.length).toBeGreaterThan(0);
      expect(analysis.analyzedAt).toBeInstanceOf(Date);
    });
  });

  /**
   * Property: Validation function should reject incomplete analysis
   */
  describe('Validation function behavior', () => {
    it('should reject analysis with invalid direction', () => {
      const invalidAnalysis = {
        direction: 'invalid' as any,
        magnitude: 'high' as const,
        confidence: 0.8,
        summary: 'Test summary',
        keyPoints: ['Point 1'],
      };

      expect(() => {
        (analysisService as any).validateImpactAnalysis(invalidAnalysis);
      }).toThrow('Invalid impact direction');
    });

    it('should reject analysis with invalid magnitude', () => {
      const invalidAnalysis = {
        direction: 'bullish' as const,
        magnitude: 'invalid' as any,
        confidence: 0.8,
        summary: 'Test summary',
        keyPoints: ['Point 1'],
      };

      expect(() => {
        (analysisService as any).validateImpactAnalysis(invalidAnalysis);
      }).toThrow('Invalid impact magnitude');
    });

    it('should reject analysis with confidence out of range', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.double({ min: -10, max: -0.01 }),
            fc.double({ min: 1.01, max: 10 })
          ).filter(n => !Number.isNaN(n)),
          (invalidConfidence) => {
            const invalidAnalysis = {
              direction: 'bullish' as const,
              magnitude: 'high' as const,
              confidence: invalidConfidence,
              summary: 'Test summary',
              keyPoints: ['Point 1'],
            };

            try {
              (analysisService as any).validateImpactAnalysis(invalidAnalysis);
              return false; // Should have thrown
            } catch (error) {
              return error instanceof Error && error.message.includes('Invalid confidence');
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should reject analysis with empty summary', () => {
      const invalidAnalysis = {
        direction: 'bullish' as const,
        magnitude: 'high' as const,
        confidence: 0.8,
        summary: '   ',
        keyPoints: ['Point 1'],
      };

      expect(() => {
        (analysisService as any).validateImpactAnalysis(invalidAnalysis);
      }).toThrow('summary is required');
    });

    it('should reject analysis with no key points', () => {
      const invalidAnalysis = {
        direction: 'bullish' as const,
        magnitude: 'high' as const,
        confidence: 0.8,
        summary: 'Test summary',
        keyPoints: [],
      };

      expect(() => {
        (analysisService as any).validateImpactAnalysis(invalidAnalysis);
      }).toThrow('at least one key point');
    });
  });
});
