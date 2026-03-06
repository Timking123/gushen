/**
 * Property-Based Tests for News Deduplication
 *
 * **Feature: smart-stock-analyzer, Property 31: 新闻去重属�?*
 *
 * This test validates the news deduplication property:
 * "For any news items from multiple sources with the same content,
 * after aggregation, only one item should remain with all sources marked"
 *
 * **Validates: Requirements 8.2**
 * - 8.2: WHEN 聚合新闻 THEN News_Aggregator SHALL 去除重复内容并标注信息来�?
 */

import fc from 'fast-check';
import { NewsService, RawNewsInput } from './newsService.js';

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

describe('News Deduplication Property Tests', () => {
  let newsService: NewsService;

  beforeEach(() => {
    newsService = new NewsService();
    jest.clearAllMocks();
  });

  // Arbitrary for generating valid news titles
  const titleArbitrary: fc.Arbitrary<string> = fc
    .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 '.split('')), {
      minLength: 10,
      maxLength: 100,
    })
    .map((chars) => chars.join('').trim())
    .filter((title) => title.length >= 5);

  // Arbitrary for generating valid source names
  const sourceArbitrary: fc.Arbitrary<string> = fc.constantFrom(
    'Reuters',
    'Bloomberg',
    'CNBC',
    'WSJ',
    'Financial Times',
    'MarketWatch',
    'Yahoo Finance',
    'Seeking Alpha'
  );

  // Arbitrary for generating credibility levels
  const credibilityArbitrary: fc.Arbitrary<'high' | 'medium' | 'low'> = fc.constantFrom(
    'high',
    'medium',
    'low'
  );

  // Arbitrary for generating stock symbols
  const symbolArbitrary: fc.Arbitrary<string> = fc
    .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
      minLength: 1,
      maxLength: 5,
    })
    .map((chars) => chars.join(''));

  // Arbitrary for generating a raw news input
  const newsInputArbitrary: fc.Arbitrary<RawNewsInput> = fc.record({
    title: titleArbitrary,
    summary: fc.option(fc.string({ minLength: 10, maxLength: 200 }), { nil: null }),
    content: fc.option(fc.string({ minLength: 50, maxLength: 500 }), { nil: null }),
    source: sourceArbitrary,
    sourceCredibility: fc.option(credibilityArbitrary, { nil: undefined }),
    url: fc.webUrl(),
    publishedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
    symbols: fc.option(fc.array(symbolArbitrary, { minLength: 0, maxLength: 5 }), { nil: undefined }),
    sectors: fc.option(fc.array(fc.constantFrom('technology', 'healthcare', 'finance', 'energy'), { minLength: 0, maxLength: 3 }), { nil: undefined }),
  });


  /**
   * **Feature: smart-stock-analyzer, Property 31: 新闻去重属�?*
   *
   * Property: For any news items from multiple sources with the same title,
   * after deduplication, only one item should remain.
   *
   * **Validates: Requirements 8.2**
   */
  describe('Property 31: News Deduplication - Single Item Per Title', () => {
    it('should keep only one item per unique title after deduplication', () => {
      fc.assert(
        fc.property(
          // Generate a list of news items with some duplicates
          fc.array(newsInputArbitrary, { minLength: 1, maxLength: 20 }),
          (newsItems) => {
            // Act: Deduplicate news
            const deduplicated = newsService.deduplicateNews(newsItems);

            // Get unique titles from input (case-insensitive)
            const uniqueTitles = new Set(
              newsItems.map((item) => item.title.toLowerCase().trim())
            );

            // Assert: Number of deduplicated items equals number of unique titles
            expect(deduplicated.length).toBe(uniqueTitles.size);

            // Assert: Each deduplicated item has a unique title
            const deduplicatedTitles = deduplicated.map((item) =>
              item.title.toLowerCase().trim()
            );
            const deduplicatedTitlesSet = new Set(deduplicatedTitles);
            expect(deduplicatedTitlesSet.size).toBe(deduplicated.length);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Feature: smart-stock-analyzer, Property 31: 新闻去重属�?*
   *
   * Property: For duplicate news items, all sources should be merged into one item.
   *
   * **Validates: Requirements 8.2**
   */
  describe('Property 31: News Deduplication - Source Merging', () => {
    it('should merge all sources when news items have the same title', () => {
      fc.assert(
        fc.property(
          titleArbitrary,
          fc.array(sourceArbitrary, { minLength: 2, maxLength: 5 }),
          (title, sources) => {
            // Create news items with the same title but different sources
            const newsItems: RawNewsInput[] = sources.map((source, index) => ({
              title,
              summary: `Summary ${index}`,
              content: null,
              source,
              sourceCredibility: 'medium' as const,
              url: `https://example.com/news/${index}`,
              publishedAt: new Date(),
              symbols: [],
              sectors: [],
            }));

            // Act: Deduplicate news
            const deduplicated = newsService.deduplicateNews(newsItems);

            // Assert: Only one item remains
            expect(deduplicated.length).toBe(1);

            // Assert: All unique sources are included in the merged source
            const uniqueSources = [...new Set(sources)];
            const mergedSources = deduplicated[0].source.split(', ');
            
            for (const source of uniqueSources) {
              expect(mergedSources).toContain(source);
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Feature: smart-stock-analyzer, Property 31: 新闻去重属�?*
   *
   * Property: Deduplication should preserve all unique symbols from merged items.
   *
   * **Validates: Requirements 8.2**
   */
  describe('Property 31: News Deduplication - Symbol Preservation', () => {
    it('should preserve all unique symbols when merging duplicate news', () => {
      fc.assert(
        fc.property(
          titleArbitrary,
          fc.array(fc.array(symbolArbitrary, { minLength: 1, maxLength: 3 }), { minLength: 2, maxLength: 4 }),
          (title, symbolArrays) => {
            // Create news items with the same title but different symbols
            const newsItems: RawNewsInput[] = symbolArrays.map((symbols, index) => ({
              title,
              summary: null,
              content: null,
              source: `Source${index}`,
              sourceCredibility: 'medium' as const,
              url: `https://example.com/news/${index}`,
              publishedAt: new Date(),
              symbols,
              sectors: [],
            }));

            // Act: Deduplicate news
            const deduplicated = newsService.deduplicateNews(newsItems);

            // Assert: Only one item remains
            expect(deduplicated.length).toBe(1);

            // Assert: All unique symbols are preserved
            const allSymbols = symbolArrays.flat();
            const uniqueSymbols = [...new Set(allSymbols)];
            const mergedSymbols = deduplicated[0].symbols || [];

            for (const symbol of uniqueSymbols) {
              expect(mergedSymbols).toContain(symbol);
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });


  /**
   * **Feature: smart-stock-analyzer, Property 31: 新闻去重属�?*
   *
   * Property: Deduplication should preserve all unique sectors from merged items.
   *
   * **Validates: Requirements 8.2**
   */
  describe('Property 31: News Deduplication - Sector Preservation', () => {
    it('should preserve all unique sectors when merging duplicate news', () => {
      fc.assert(
        fc.property(
          titleArbitrary,
          fc.array(
            fc.array(fc.constantFrom('technology', 'healthcare', 'finance', 'energy'), { minLength: 1, maxLength: 2 }),
            { minLength: 2, maxLength: 4 }
          ),
          (title, sectorArrays) => {
            // Create news items with the same title but different sectors
            const newsItems: RawNewsInput[] = sectorArrays.map((sectors, index) => ({
              title,
              summary: null,
              content: null,
              source: `Source${index}`,
              sourceCredibility: 'medium' as const,
              url: `https://example.com/news/${index}`,
              publishedAt: new Date(),
              symbols: [],
              sectors,
            }));

            // Act: Deduplicate news
            const deduplicated = newsService.deduplicateNews(newsItems);

            // Assert: Only one item remains
            expect(deduplicated.length).toBe(1);

            // Assert: All unique sectors are preserved
            const allSectors = sectorArrays.flat();
            const uniqueSectors = [...new Set(allSectors)];
            const mergedSectors = deduplicated[0].sectors || [];

            for (const sector of uniqueSectors) {
              expect(mergedSectors).toContain(sector);
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Feature: smart-stock-analyzer, Property 31: 新闻去重属�?*
   *
   * Property: Deduplication should use the highest credibility among merged sources.
   *
   * **Validates: Requirements 8.2**
   */
  describe('Property 31: News Deduplication - Credibility Selection', () => {
    it('should use the highest credibility level when merging duplicate news', () => {
      fc.assert(
        fc.property(
          titleArbitrary,
          fc.array(credibilityArbitrary, { minLength: 2, maxLength: 5 }),
          (title, credibilities) => {
            // Create news items with the same title but different credibilities
            const newsItems: RawNewsInput[] = credibilities.map((credibility, index) => ({
              title,
              summary: null,
              content: null,
              source: `Source${index}`,
              sourceCredibility: credibility,
              url: `https://example.com/news/${index}`,
              publishedAt: new Date(),
              symbols: [],
              sectors: [],
            }));

            // Act: Deduplicate news
            const deduplicated = newsService.deduplicateNews(newsItems);

            // Assert: Only one item remains
            expect(deduplicated.length).toBe(1);

            // Determine expected highest credibility
            const credibilityLevels: Record<string, number> = {
              high: 3,
              medium: 2,
              low: 1,
            };
            const highestCredibility = credibilities.reduce((highest, current) =>
              credibilityLevels[current] > credibilityLevels[highest] ? current : highest
            );

            // Assert: Merged item has the highest credibility
            expect(deduplicated[0].sourceCredibility).toBe(highestCredibility);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Feature: smart-stock-analyzer, Property 31: 新闻去重属�?*
   *
   * Property: Deduplication should be idempotent - running it twice should produce the same result.
   *
   * **Validates: Requirements 8.2**
   */
  describe('Property 31: News Deduplication - Idempotence', () => {
    it('should produce the same result when deduplication is applied twice', () => {
      fc.assert(
        fc.property(
          fc.array(newsInputArbitrary, { minLength: 1, maxLength: 20 }),
          (newsItems) => {
            // Act: Deduplicate once
            const firstPass = newsService.deduplicateNews(newsItems);

            // Act: Deduplicate again
            const secondPass = newsService.deduplicateNews(firstPass);

            // Assert: Same number of items
            expect(secondPass.length).toBe(firstPass.length);

            // Assert: Same titles (in same order since we're using the same input)
            const firstTitles = firstPass.map((item) => item.title);
            const secondTitles = secondPass.map((item) => item.title);
            expect(secondTitles).toEqual(firstTitles);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * **Feature: smart-stock-analyzer, Property 31: 新闻去重属�?*
   *
   * Property: Unique news items should not be affected by deduplication.
   *
   * **Validates: Requirements 8.2**
   */
  describe('Property 31: News Deduplication - Unique Items Preserved', () => {
    it('should preserve all unique news items without modification', () => {
      fc.assert(
        fc.property(
          // Generate unique titles
          fc.array(titleArbitrary, { minLength: 1, maxLength: 10 })
            .map((titles) => [...new Set(titles)])
            .filter((titles) => titles.length >= 1),
          (uniqueTitles) => {
            // Create news items with unique titles
            const newsItems: RawNewsInput[] = uniqueTitles.map((title, index) => ({
              title,
              summary: `Summary for ${title}`,
              content: null,
              source: `Source${index}`,
              sourceCredibility: 'medium' as const,
              url: `https://example.com/news/${index}`,
              publishedAt: new Date(),
              symbols: [`SYM${index}`],
              sectors: ['technology'],
            }));

            // Act: Deduplicate news
            const deduplicated = newsService.deduplicateNews(newsItems);

            // Assert: Same number of items (no duplicates to remove)
            expect(deduplicated.length).toBe(uniqueTitles.length);

            // Assert: All original titles are present
            const deduplicatedTitles = deduplicated.map((item) => item.title);
            for (const title of uniqueTitles) {
              expect(deduplicatedTitles).toContain(title);
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
