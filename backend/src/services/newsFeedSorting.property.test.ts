/**
 * Property-Based Tests for News Feed Sorting
 *
 * **Feature: smart-stock-analyzer, Property 10: 信息流排序属�?*
 *
 * This test validates the news feed sorting property:
 * "For any news feed list, items should be sorted by priority (descending),
 * and items with the same priority should be sorted by time (descending)"
 *
 * **Validates: Requirements 6.4**
 * - 6.4: WHEN 用户查看信息�?THEN Stock_Analyzer SHALL 按重要性和时间排序展示信息
 */

import fc from 'fast-check';
import { NewsService, NewsFeedItem } from './newsService.js';

// Mock dependencies
jest.mock('../lib/prisma', () => ({
  prisma: {
    newsItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock('../lib/redis', () => ({
  redisHelpers: {
    getJson: jest.fn(),
    setJson: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('News Feed Sorting Property Tests', () => {
  let newsService: NewsService;

  beforeEach(() => {
    newsService = new NewsService();
    jest.clearAllMocks();
  });

  // Priority level mapping for comparison
  const priorityLevels: Record<string, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  // Arbitrary for generating valid news titles
  const titleArbitrary: fc.Arbitrary<string> = fc
    .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 '.split('')), {
      minLength: 10,
      maxLength: 50,
    })
    .map((chars) => chars.join('').trim())
    .filter((title) => title.length >= 5);

  // Arbitrary for generating priority levels
  const priorityArbitrary: fc.Arbitrary<'high' | 'medium' | 'low'> = fc.constantFrom(
    'high',
    'medium',
    'low'
  );

  // Arbitrary for generating credibility levels
  const credibilityArbitrary: fc.Arbitrary<'high' | 'medium' | 'low'> = fc.constantFrom(
    'high',
    'medium',
    'low'
  );

  // Arbitrary for generating a news feed item
  const newsFeedItemArbitrary: fc.Arbitrary<NewsFeedItem> = fc.record({
    id: fc.uuid(),
    title: titleArbitrary,
    summary: fc.option(fc.string({ minLength: 10, maxLength: 100 }), { nil: null }),
    content: fc.option(fc.string({ minLength: 50, maxLength: 200 }), { nil: null }),
    source: fc.constantFrom('Reuters', 'Bloomberg', 'CNBC', 'WSJ'),
    sourceCredibility: credibilityArbitrary,
    url: fc.webUrl(),
    publishedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
    symbols: fc.array(fc.string({ minLength: 1, maxLength: 5 }), { minLength: 0, maxLength: 3 }),
    sectors: fc.array(fc.constantFrom('technology', 'healthcare', 'finance'), { minLength: 0, maxLength: 2 }),
    impactAnalysis: fc.option(
      fc.record({
        newsId: fc.uuid(),
        direction: fc.constantFrom('bullish', 'bearish', 'neutral') as fc.Arbitrary<'bullish' | 'bearish' | 'neutral'>,
        magnitude: fc.constantFrom('high', 'medium', 'low') as fc.Arbitrary<'high' | 'medium' | 'low'>,
        confidence: fc.float({ min: 0, max: 1 }),
        summary: fc.string({ minLength: 10, maxLength: 100 }),
        keyPoints: fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 0, maxLength: 3 }),
        historicalComparison: fc.option(fc.string({ minLength: 10, maxLength: 100 }), { nil: null }),
        analyzedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
      }),
      { nil: null }
    ),
    priority: priorityArbitrary,
  });


  /**
   * **Feature: smart-stock-analyzer, Property 10: 信息流排序属�?*
   *
   * Property: For any news feed list, items should be sorted by priority (descending).
   * Higher priority items should appear before lower priority items.
   *
   * **Validates: Requirements 6.4**
   */
  describe('Property 10: News Feed Sorting - Priority Order', () => {
    it('should sort items by priority in descending order', () => {
      fc.assert(
        fc.property(
          fc.array(newsFeedItemArbitrary, { minLength: 2, maxLength: 50 }),
          (feedItems) => {
            // Act: Sort the news feed
            const sorted = newsService.sortNewsFeed(feedItems);

            // Assert: Items are sorted by priority (descending)
            for (let i = 0; i < sorted.length - 1; i++) {
              const currentPriority = priorityLevels[sorted[i].priority];
              const nextPriority = priorityLevels[sorted[i + 1].priority];
              
              // Current item's priority should be >= next item's priority
              expect(currentPriority).toBeGreaterThanOrEqual(nextPriority);
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should place all high priority items before medium and low priority items', () => {
      fc.assert(
        fc.property(
          fc.array(newsFeedItemArbitrary, { minLength: 5, maxLength: 30 }),
          (feedItems) => {
            // Act: Sort the news feed
            const sorted = newsService.sortNewsFeed(feedItems);

            // Find the last high priority item index
            let lastHighIndex = -1;
            for (let i = 0; i < sorted.length; i++) {
              if (sorted[i].priority === 'high') {
                lastHighIndex = i;
              }
            }

            // Find the first medium or low priority item index
            let firstNonHighIndex = sorted.length;
            for (let i = 0; i < sorted.length; i++) {
              if (sorted[i].priority !== 'high') {
                firstNonHighIndex = i;
                break;
              }
            }

            // Assert: All high priority items come before non-high priority items
            if (lastHighIndex !== -1 && firstNonHighIndex < sorted.length) {
              expect(lastHighIndex).toBeLessThan(firstNonHighIndex);
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Feature: smart-stock-analyzer, Property 10: 信息流排序属�?*
   *
   * Property: For items with the same priority, they should be sorted by time (descending).
   * More recent items should appear before older items within the same priority level.
   *
   * **Validates: Requirements 6.4**
   */
  describe('Property 10: News Feed Sorting - Time Order Within Same Priority', () => {
    it('should sort items with same priority by time in descending order', () => {
      fc.assert(
        fc.property(
          fc.array(newsFeedItemArbitrary, { minLength: 2, maxLength: 50 })
            .filter(items => items.every(item => !isNaN(new Date(item.publishedAt).getTime()))),
          (feedItems) => {
            // Act: Sort the news feed
            const sorted = newsService.sortNewsFeed(feedItems);

            // Assert: Items with same priority are sorted by time (descending)
            for (let i = 0; i < sorted.length - 1; i++) {
              if (sorted[i].priority === sorted[i + 1].priority) {
                const currentTime = new Date(sorted[i].publishedAt).getTime();
                const nextTime = new Date(sorted[i + 1].publishedAt).getTime();
                
                // Current item's time should be >= next item's time
                expect(currentTime).toBeGreaterThanOrEqual(nextTime);
              }
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should maintain time order for items with identical priority', () => {
      fc.assert(
        fc.property(
          // Generate items with the same priority but different times
          priorityArbitrary,
          fc.array(fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }), { minLength: 3, maxLength: 10 })
            .filter(dates => dates.every(d => !isNaN(d.getTime()))),
          (priority, dates) => {
            // Create feed items with the same priority but different times
            const feedItems: NewsFeedItem[] = dates.map((date, index) => ({
              id: `id-${index}`,
              title: `News ${index}`,
              summary: null,
              content: null,
              source: 'Reuters',
              sourceCredibility: 'medium' as const,
              url: `https://example.com/news/${index}`,
              publishedAt: date,
              symbols: [],
              sectors: [],
              impactAnalysis: null,
              priority,
            }));

            // Act: Sort the news feed
            const sorted = newsService.sortNewsFeed(feedItems);

            // Assert: All items have the same priority
            expect(sorted.every(item => item.priority === priority)).toBe(true);

            // Assert: Items are sorted by time (descending)
            for (let i = 0; i < sorted.length - 1; i++) {
              const currentTime = new Date(sorted[i].publishedAt).getTime();
              const nextTime = new Date(sorted[i + 1].publishedAt).getTime();
              expect(currentTime).toBeGreaterThanOrEqual(nextTime);
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });


  /**
   * **Feature: smart-stock-analyzer, Property 10: 信息流排序属�?*
   *
   * Property: Sorting should preserve all items - no items should be lost or added.
   *
   * **Validates: Requirements 6.4**
   */
  describe('Property 10: News Feed Sorting - Item Preservation', () => {
    it('should preserve all items after sorting', () => {
      fc.assert(
        fc.property(
          fc.array(newsFeedItemArbitrary, { minLength: 1, maxLength: 50 }),
          (feedItems) => {
            // Act: Sort the news feed
            const sorted = newsService.sortNewsFeed(feedItems);

            // Assert: Same number of items
            expect(sorted.length).toBe(feedItems.length);

            // Assert: All original items are present (by id)
            const originalIds = new Set(feedItems.map(item => item.id));
            const sortedIds = new Set(sorted.map(item => item.id));
            expect(sortedIds).toEqual(originalIds);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should not modify the original array', () => {
      fc.assert(
        fc.property(
          fc.array(newsFeedItemArbitrary, { minLength: 2, maxLength: 20 }),
          (feedItems) => {
            // Store original order
            const originalOrder = feedItems.map(item => item.id);

            // Act: Sort the news feed
            newsService.sortNewsFeed(feedItems);

            // Assert: Original array is unchanged
            const currentOrder = feedItems.map(item => item.id);
            expect(currentOrder).toEqual(originalOrder);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Feature: smart-stock-analyzer, Property 10: 信息流排序属�?*
   *
   * Property: Sorting should be stable - items with equal priority and time
   * should maintain their relative order.
   *
   * **Validates: Requirements 6.4**
   */
  describe('Property 10: News Feed Sorting - Stability', () => {
    it('should be idempotent - sorting twice should produce the same result', () => {
      fc.assert(
        fc.property(
          fc.array(newsFeedItemArbitrary, { minLength: 1, maxLength: 30 }),
          (feedItems) => {
            // Act: Sort once
            const firstSort = newsService.sortNewsFeed(feedItems);

            // Act: Sort again
            const secondSort = newsService.sortNewsFeed(firstSort);

            // Assert: Same order
            const firstIds = firstSort.map(item => item.id);
            const secondIds = secondSort.map(item => item.id);
            expect(secondIds).toEqual(firstIds);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Feature: smart-stock-analyzer, Property 10: 信息流排序属�?*
   *
   * Property: Empty and single-item arrays should be handled correctly.
   *
   * **Validates: Requirements 6.4**
   */
  describe('Property 10: News Feed Sorting - Edge Cases', () => {
    it('should handle empty array', () => {
      const sorted = newsService.sortNewsFeed([]);
      expect(sorted).toEqual([]);
    });

    it('should handle single item array', () => {
      fc.assert(
        fc.property(
          newsFeedItemArbitrary,
          (feedItem) => {
            const sorted = newsService.sortNewsFeed([feedItem]);
            
            expect(sorted.length).toBe(1);
            expect(sorted[0].id).toBe(feedItem.id);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle array with all same priority and time', () => {
      fc.assert(
        fc.property(
          priorityArbitrary,
          fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
          fc.integer({ min: 2, max: 10 }),
          (priority, date, count) => {
            // Create items with identical priority and time
            const feedItems: NewsFeedItem[] = Array.from({ length: count }, (_, index) => ({
              id: `id-${index}`,
              title: `News ${index}`,
              summary: null,
              content: null,
              source: 'Reuters',
              sourceCredibility: 'medium' as const,
              url: `https://example.com/news/${index}`,
              publishedAt: date,
              symbols: [],
              sectors: [],
              impactAnalysis: null,
              priority,
            }));

            // Act: Sort the news feed
            const sorted = newsService.sortNewsFeed(feedItems);

            // Assert: All items preserved
            expect(sorted.length).toBe(count);

            // Assert: All items have the same priority
            expect(sorted.every(item => item.priority === priority)).toBe(true);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
