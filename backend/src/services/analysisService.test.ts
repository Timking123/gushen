import { analysisService } from './analysisService.js';
import { prisma } from '../lib/prisma.js';

/**
 * Unit tests for AnalysisService
 * Tests summarizeNews and compareStocks functionality
 * Implements Requirements 3.3, 3.4, 9.5
 */
describe('AnalysisService', () => {
  let dbAvailable = false;
  let testNewsIds: string[] = [];

  beforeAll(async () => {
    try {
      await prisma.$connect();
      dbAvailable = true;

      // Create test news items
      const news1 = await prisma.newsItem.create({
        data: {
          title: 'Company A Reports Strong Earnings',
          summary: 'Company A exceeded expectations with 20% revenue growth',
          content: 'Detailed earnings report...',
          source: 'Financial Times',
          sourceCredibility: 'high',
          url: 'https://test.com/news1',
          publishedAt: new Date(),
          sectors: ['technology'],
        },
      });

      const news2 = await prisma.newsItem.create({
        data: {
          title: 'Market Volatility Increases',
          summary: 'Stock market experiences increased volatility',
          content: 'Market analysis...',
          source: 'Bloomberg',
          sourceCredibility: 'high',
          url: 'https://test.com/news2',
          publishedAt: new Date(),
          sectors: ['market'],
        },
      });

      testNewsIds = [news1.id, news2.id];

      // Create impact analysis for news items
      await prisma.impactAnalysis.create({
        data: {
          newsId: news1.id,
          direction: 'bullish',
          magnitude: 'high',
          confidence: 0.85,
          summary: 'Strong earnings indicate positive outlook',
          keyPoints: ['Revenue growth', 'Beat expectations'],
          analyzedAt: new Date(),
        },
      });

      await prisma.impactAnalysis.create({
        data: {
          newsId: news2.id,
          direction: 'bearish',
          magnitude: 'medium',
          confidence: 0.7,
          summary: 'Volatility may impact short-term performance',
          keyPoints: ['Market uncertainty', 'Risk factors'],
          analyzedAt: new Date(),
        },
      });
    } catch (error) {
      console.log('Database not available, skipping tests');
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (dbAvailable && testNewsIds.length > 0) {
      try {
        await prisma.impactAnalysis.deleteMany({
          where: { newsId: { in: testNewsIds } },
        });
        await prisma.newsItem.deleteMany({
          where: { id: { in: testNewsIds } },
        });
      } catch (error) {
        console.log('Error cleaning up test data:', error);
      }
    }
    await prisma.$disconnect();
  });

  describe('summarizeNews', () => {
    it('should throw error when no news IDs provided', async () => {
      await expect(analysisService.summarizeNews([])).rejects.toThrow(
        'At least one news ID is required'
      );
    });

    it('should throw error when news items not found', async () => {
      if (!dbAvailable) {
        console.log('Skipping test - database not available');
        return;
      }

      await expect(
        analysisService.summarizeNews(['non-existent-id'])
      ).rejects.toThrow('No news items found');
    });

    it('should summarize multiple news items', async () => {
      if (!dbAvailable) {
        console.log('Skipping test - database not available');
        return;
      }

      const summary = await analysisService.summarizeNews(testNewsIds);

      expect(summary).toBeDefined();
      expect(summary.summary).toBeTruthy();
      expect(summary.keyThemes).toBeDefined();
      expect(Array.isArray(summary.keyThemes)).toBe(true);
      expect(summary.overallSentiment).toMatch(/positive|negative|neutral/);
    });

    it('should use fallback when AI not available', async () => {
      if (!dbAvailable) {
        console.log('Skipping test - database not available');
        return;
      }

      // This test assumes OPENAI_API_KEY is not configured
      const summary = await analysisService.summarizeNews(testNewsIds);

      // Fallback should still provide valid structure
      expect(summary).toBeDefined();
      expect(summary.summary).toContain('news items');
      expect(summary.overallSentiment).toMatch(/positive|negative|neutral/);
    });
  });

  describe('compareStocks', () => {
    it('should throw error when less than 2 symbols provided', async () => {
      await expect(analysisService.compareStocks(['AAPL'])).rejects.toThrow(
        'At least two stock symbols are required'
      );
    });

    it('should compare multiple stocks', async () => {
      if (!dbAvailable) {
        console.log('Skipping test - database not available');
        return;
      }

      const comparison = await analysisService.compareStocks(['AAPL', 'MSFT']);

      expect(comparison).toBeDefined();
      expect(comparison.symbols).toEqual(['AAPL', 'MSFT']);
      expect(comparison.summary).toBeTruthy();
      expect(comparison.strengths).toBeDefined();
      expect(comparison.weaknesses).toBeDefined();
      expect(comparison.recommendation).toBeTruthy();
      expect(comparison.generatedAt).toBeInstanceOf(Date);
    });

    it('should normalize stock symbols to uppercase', async () => {
      if (!dbAvailable) {
        console.log('Skipping test - database not available');
        return;
      }

      const comparison = await analysisService.compareStocks(['aapl', 'msft']);

      expect(comparison.symbols).toEqual(['AAPL', 'MSFT']);
    });

    it('should use fallback when AI not available', async () => {
      if (!dbAvailable) {
        console.log('Skipping test - database not available');
        return;
      }

      const comparison = await analysisService.compareStocks(['AAPL', 'GOOGL']);

      // Fallback should still provide valid structure
      expect(comparison).toBeDefined();
      expect(comparison.summary).toContain('Comparison');
      expect(comparison.strengths).toBeDefined();
      expect(comparison.weaknesses).toBeDefined();
      expect(Object.keys(comparison.strengths)).toContain('AAPL');
      expect(Object.keys(comparison.strengths)).toContain('GOOGL');
    });
  });

  describe('chat', () => {
    it('should return error message when API key not configured', async () => {
      const response = await analysisService.chat('user123', 'Hello', {});

      expect(response).toBeDefined();
      expect(response.message).toContain('not available');
      expect(response.confidence).toBe(0);
    });

    it('should accept chat context', async () => {
      const context = {
        watchlist: ['AAPL', 'MSFT'],
        userPreferences: ['technology', 'growth'],
      };

      const response = await analysisService.chat('user123', 'What stocks should I watch?', context);

      expect(response).toBeDefined();
      expect(response.message).toBeTruthy();
    });
  });
});
