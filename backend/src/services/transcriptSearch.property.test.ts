/**
 * Property-Based Tests for Transcript Search
 *
 * **Feature: smart-stock-analyzer, Property 21: 会议记录搜索属�?*
 *
 * This test validates the transcript search property:
 * "For any search keyword and transcript collection, returned transcripts
 * should contain the keyword in their content"
 *
 * **Validates: Requirements 14.3**
 * - 14.3: WHEN 用户搜索会议记录 THEN Transcript_Service SHALL 支持按关键词搜索特定主题或内�?
 */

import fc from 'fast-check';
import {
  TranscriptService,
  TranscriptSectionType,
} from './transcriptService.js';
import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';

// Mock dependencies
jest.mock('../lib/prisma', () => ({
  prisma: {
    transcript: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    transcriptSection: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    transcriptParticipant: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
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

// Type definitions for test data
interface TestTranscriptSection {
  id: string;
  transcriptId: string;
  type: TranscriptSectionType;
  speaker: string;
  content: string;
  transcript: {
    id: string;
    symbol: string;
    quarter: string;
    eventType: string;
    date: Date;
    aiSummary: string | null;
    createdAt: Date;
    stock: {
      name: string;
    };
    participants: Array<{
      id: string;
      name: string;
      title: string | null;
      company: string | null;
    }>;
  };
}

describe('Transcript Search Property Tests', () => {
  let transcriptService: TranscriptService;

  beforeEach(() => {
    transcriptService = new TranscriptService();
    jest.clearAllMocks();
    // Default: cache miss
    (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
    (redisHelpers.setJson as jest.Mock).mockResolvedValue(undefined);
  });

  /**
   * **Feature: smart-stock-analyzer, Property 21: 会议记录搜索属�?*
   *
   * Property: For any search keyword and transcript collection,
   * returned transcripts should contain the keyword in their content.
   *
   * **Validates: Requirements 14.3**
   */
  describe('Property 21: Transcript Search Property (会议记录搜索属�?', () => {
    // Arbitrary for generating valid stock symbols
    const symbolArbitrary: fc.Arbitrary<string> = fc
      .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
        minLength: 1,
        maxLength: 5,
      })
      .map((chars: string[]) => chars.join(''));

    // Arbitrary for generating quarter strings
    const quarterArbitrary: fc.Arbitrary<string> = fc
      .tuple(
        fc.constantFrom('Q1', 'Q2', 'Q3', 'Q4'),
        fc.integer({ min: 2020, max: 2025 })
      )
      .map(([q, year]) => `${q} ${year}`);

    // Arbitrary for generating speaker names
    const speakerArbitrary: fc.Arbitrary<string> = fc.constantFrom(
      'John Smith',
      'Jane Doe',
      'Tim Cook',
      'Satya Nadella',
      'Sundar Pichai',
      'Mark Zuckerberg',
      'Analyst',
      'CEO',
      'CFO',
      'COO'
    );

    // Arbitrary for generating transcript content with potential keywords
    const contentArbitrary: fc.Arbitrary<string> = fc
      .array(
        fc.constantFrom(
          'revenue',
          'growth',
          'profit',
          'margin',
          'guidance',
          'outlook',
          'market',
          'share',
          'customer',
          'product',
          'innovation',
          'strategy',
          'investment',
          'expansion',
          'quarter',
          'year',
          'increase',
          'decrease',
          'strong',
          'performance',
          'AI',
          'cloud',
          'services',
          'subscription',
          'enterprise',
          'consumer',
          'digital',
          'transformation',
          'operating',
          'expenses',
          'cash',
          'flow',
          'dividend',
          'buyback',
          'acquisition',
          'partnership'
        ),
        { minLength: 5, maxLength: 30 }
      )
      .map((words: string[]) => words.join(' '));

    // Arbitrary for generating section types
    const sectionTypeArbitrary: fc.Arbitrary<TranscriptSectionType> = fc.constantFrom(
      'prepared_remarks',
      'qa'
    );

    // Arbitrary for generating a transcript section
    const sectionArbitrary: fc.Arbitrary<{
      type: TranscriptSectionType;
      speaker: string;
      content: string;
    }> = fc.record({
      type: sectionTypeArbitrary,
      speaker: speakerArbitrary,
      content: contentArbitrary,
    });

    // Arbitrary for generating search keywords
    const keywordArbitrary: fc.Arbitrary<string> = fc.constantFrom(
      'revenue',
      'growth',
      'profit',
      'margin',
      'guidance',
      'outlook',
      'market',
      'AI',
      'cloud',
      'strategy',
      'investment',
      'customer',
      'product'
    );

    /**
     * Helper function to check if content contains keyword (case-insensitive)
     */
    const contentContainsKeyword = (content: string, keyword: string): boolean => {
      return content.toLowerCase().includes(keyword.toLowerCase());
    };

    /**
     * Helper function to create mock transcript sections with matching content
     */
    const createMockSections = (
      sections: Array<{ type: TranscriptSectionType; speaker: string; content: string }>,
      keyword: string,
      transcriptId: string,
      symbol: string,
      quarter: string
    ): TestTranscriptSection[] => {
      return sections
        .filter((s) => contentContainsKeyword(s.content, keyword))
        .map((s, index) => ({
          id: `section-${transcriptId}-${index}`,
          transcriptId,
          type: s.type,
          speaker: s.speaker,
          content: s.content,
          transcript: {
            id: transcriptId,
            symbol,
            quarter,
            eventType: 'earnings',
            date: new Date(),
            aiSummary: null,
            createdAt: new Date(),
            stock: {
              name: `${symbol} Inc.`,
            },
            participants: [
              { id: 'p1', name: 'CEO', title: 'Chief Executive Officer', company: `${symbol} Inc.` },
            ],
          },
        }));
    };

    it('should return only transcripts that contain the search keyword', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(sectionArbitrary, { minLength: 1, maxLength: 10 }),
          keywordArbitrary,
          symbolArbitrary,
          quarterArbitrary,
          async (sections, keyword, symbol, quarter) => {
            const transcriptId = `transcript-${symbol}-${quarter.replace(' ', '-')}`;

            // Create mock sections that match the keyword
            const matchingSections = createMockSections(
              sections,
              keyword,
              transcriptId,
              symbol,
              quarter
            );

            // Mock the database query
            (prisma.transcriptSection.findMany as jest.Mock).mockResolvedValue(matchingSections);

            // Act
            const result = await transcriptService.searchTranscripts(keyword);

            // Assert: All returned results should have sections containing the keyword
            for (const searchResult of result.results) {
              for (const matchedSection of searchResult.matchedSections) {
                const containsKeyword = contentContainsKeyword(matchedSection.content, keyword);
                if (!containsKeyword) {
                  throw new Error(
                    `Section content "${matchedSection.content.substring(0, 50)}..." does not contain keyword "${keyword}" (case-insensitive)`
                  );
                }
              }
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should perform case-insensitive keyword matching', async () => {
      await fc.assert(
        fc.asyncProperty(
          keywordArbitrary,
          fc.constantFrom('lower', 'upper', 'mixed'),
          symbolArbitrary,
          async (baseKeyword, caseType, symbol) => {
            // Generate keyword with different case variations
            let keyword: string;
            switch (caseType) {
              case 'lower':
                keyword = baseKeyword.toLowerCase();
                break;
              case 'upper':
                keyword = baseKeyword.toUpperCase();
                break;
              case 'mixed':
                keyword = baseKeyword
                  .split('')
                  .map((c: string, i: number) =>
                    i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()
                  )
                  .join('');
                break;
              default:
                keyword = baseKeyword;
            }

            // Create content that contains the keyword in original case
            const content = `Our ${baseKeyword} has been strong this quarter with significant improvements.`;
            const transcriptId = `transcript-${symbol}`;

            const mockSection: TestTranscriptSection = {
              id: 'section-1',
              transcriptId,
              type: 'prepared_remarks',
              speaker: 'CEO',
              content,
              transcript: {
                id: transcriptId,
                symbol,
                quarter: 'Q1 2024',
                eventType: 'earnings',
                date: new Date(),
                aiSummary: null,
                createdAt: new Date(),
                stock: { name: `${symbol} Inc.` },
                participants: [],
              },
            };

            (prisma.transcriptSection.findMany as jest.Mock).mockResolvedValue([mockSection]);

            // Act
            const result = await transcriptService.searchTranscripts(keyword);

            // Assert: Should find the content regardless of keyword case
            for (const searchResult of result.results) {
              for (const matchedSection of searchResult.matchedSections) {
                expect(contentContainsKeyword(matchedSection.content, keyword)).toBe(true);
              }
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return empty results for empty keyword', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constant(' '), { minLength: 0, maxLength: 5 }).map((arr) => arr.join('')),
          async (emptyKeyword: string) => {
            // Act
            const result = await transcriptService.searchTranscripts(emptyKeyword);

            // Assert: Should return empty results
            expect(result.results).toEqual([]);
            expect(result.pagination.total).toBe(0);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should not return sections that do not contain the keyword', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(sectionArbitrary, { minLength: 1, maxLength: 10 }),
          keywordArbitrary,
          symbolArbitrary,
          async (sections, keyword, symbol) => {
            const transcriptId = `transcript-${symbol}`;

            // Filter to only include sections that actually contain the keyword
            const matchingSections = sections
              .filter((s) => contentContainsKeyword(s.content, keyword))
              .map((s, index) => ({
                id: `section-${index}`,
                transcriptId,
                type: s.type,
                speaker: s.speaker,
                content: s.content,
                transcript: {
                  id: transcriptId,
                  symbol,
                  quarter: 'Q1 2024',
                  eventType: 'earnings',
                  date: new Date(),
                  aiSummary: null,
                  createdAt: new Date(),
                  stock: { name: `${symbol} Inc.` },
                  participants: [],
                },
              }));

            (prisma.transcriptSection.findMany as jest.Mock).mockResolvedValue(matchingSections);

            // Act
            const result = await transcriptService.searchTranscripts(keyword);

            // Assert: No section should fail to contain the keyword
            const nonMatchingSections = result.results.flatMap((r) =>
              r.matchedSections.filter((s) => !contentContainsKeyword(s.content, keyword))
            );

            expect(nonMatchingSections).toHaveLength(0);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should correctly count matched sections per transcript', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(sectionArbitrary, { minLength: 1, maxLength: 10 }),
          keywordArbitrary,
          symbolArbitrary,
          async (sections, keyword, symbol) => {
            const transcriptId = `transcript-${symbol}`;

            // Create mock sections
            const matchingSections = sections
              .filter((s) => contentContainsKeyword(s.content, keyword))
              .map((s, index) => ({
                id: `section-${index}`,
                transcriptId,
                type: s.type,
                speaker: s.speaker,
                content: s.content,
                transcript: {
                  id: transcriptId,
                  symbol,
                  quarter: 'Q1 2024',
                  eventType: 'earnings',
                  date: new Date(),
                  aiSummary: null,
                  createdAt: new Date(),
                  stock: { name: `${symbol} Inc.` },
                  participants: [],
                },
              }));

            (prisma.transcriptSection.findMany as jest.Mock).mockResolvedValue(matchingSections);

            // Act
            const result = await transcriptService.searchTranscripts(keyword);

            // Assert: matchCount should equal the number of matched sections
            for (const searchResult of result.results) {
              expect(searchResult.matchCount).toBe(searchResult.matchedSections.length);
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should include match highlight for each matched section', async () => {
      await fc.assert(
        fc.asyncProperty(
          keywordArbitrary,
          symbolArbitrary,
          async (keyword, symbol) => {
            const transcriptId = `transcript-${symbol}`;
            const content = `We are seeing strong ${keyword} performance this quarter. The ${keyword} metrics have exceeded expectations.`;

            const mockSection: TestTranscriptSection = {
              id: 'section-1',
              transcriptId,
              type: 'prepared_remarks',
              speaker: 'CEO',
              content,
              transcript: {
                id: transcriptId,
                symbol,
                quarter: 'Q1 2024',
                eventType: 'earnings',
                date: new Date(),
                aiSummary: null,
                createdAt: new Date(),
                stock: { name: `${symbol} Inc.` },
                participants: [],
              },
            };

            (prisma.transcriptSection.findMany as jest.Mock).mockResolvedValue([mockSection]);

            // Act
            const result = await transcriptService.searchTranscripts(keyword);

            // Assert: Each matched section should have a matchHighlight
            for (const searchResult of result.results) {
              for (const matchedSection of searchResult.matchedSections) {
                expect(matchedSection.matchHighlight).toBeDefined();
                expect(typeof matchedSection.matchHighlight).toBe('string');
                expect(matchedSection.matchHighlight.length).toBeGreaterThan(0);
              }
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle multiple transcripts with matching content', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(symbolArbitrary, { minLength: 2, maxLength: 5 }),
          keywordArbitrary,
          async (symbols, keyword) => {
            // Create sections from multiple transcripts
            const allSections: TestTranscriptSection[] = symbols.flatMap((symbol, tIndex) => {
              const transcriptId = `transcript-${symbol}`;
              const content = `The ${keyword} for ${symbol} has been exceptional this quarter.`;
              return {
                id: `section-${tIndex}`,
                transcriptId,
                type: 'prepared_remarks' as TranscriptSectionType,
                speaker: 'CEO',
                content,
                transcript: {
                  id: transcriptId,
                  symbol,
                  quarter: 'Q1 2024',
                  eventType: 'earnings',
                  date: new Date(),
                  aiSummary: null,
                  createdAt: new Date(),
                  stock: { name: `${symbol} Inc.` },
                  participants: [],
                },
              };
            });

            (prisma.transcriptSection.findMany as jest.Mock).mockResolvedValue(allSections);

            // Act
            const result = await transcriptService.searchTranscripts(keyword);

            // Assert: Should return results from multiple transcripts
            // Each result should have sections containing the keyword
            for (const searchResult of result.results) {
              for (const matchedSection of searchResult.matchedSections) {
                expect(contentContainsKeyword(matchedSection.content, keyword)).toBe(true);
              }
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should preserve section type and speaker information in results', async () => {
      await fc.assert(
        fc.asyncProperty(
          sectionTypeArbitrary,
          speakerArbitrary,
          keywordArbitrary,
          symbolArbitrary,
          async (sectionType, speaker, keyword, symbol) => {
            const transcriptId = `transcript-${symbol}`;
            const content = `Discussing ${keyword} performance and future outlook.`;

            const mockSection: TestTranscriptSection = {
              id: 'section-1',
              transcriptId,
              type: sectionType,
              speaker,
              content,
              transcript: {
                id: transcriptId,
                symbol,
                quarter: 'Q1 2024',
                eventType: 'earnings',
                date: new Date(),
                aiSummary: null,
                createdAt: new Date(),
                stock: { name: `${symbol} Inc.` },
                participants: [],
              },
            };

            (prisma.transcriptSection.findMany as jest.Mock).mockResolvedValue([mockSection]);

            // Act
            const result = await transcriptService.searchTranscripts(keyword);

            // Assert: Section type and speaker should be preserved
            if (result.results.length > 0) {
              const matchedSection = result.results[0].matchedSections[0];
              expect(matchedSection.type).toBe(sectionType);
              expect(matchedSection.speaker).toBe(speaker);
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return keyword in response for reference', async () => {
      await fc.assert(
        fc.asyncProperty(keywordArbitrary, async (keyword) => {
          (prisma.transcriptSection.findMany as jest.Mock).mockResolvedValue([]);

          // Act
          const result = await transcriptService.searchTranscripts(keyword);

          // Assert: Response should include the original keyword
          expect(result.keyword).toBe(keyword);

          return true;
        }),
        { numRuns: 20 }
      );
    });

    it('should handle pagination correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 20 }),
          keywordArbitrary,
          async (page, limit, keyword) => {
            (prisma.transcriptSection.findMany as jest.Mock).mockResolvedValue([]);

            // Act
            const result = await transcriptService.searchTranscripts(keyword, undefined, {
              page,
              limit,
            });

            // Assert: Pagination info should be correct
            expect(result.pagination.page).toBe(page);
            expect(result.pagination.limit).toBe(limit);
            expect(result.pagination.totalPages).toBe(Math.ceil(result.pagination.total / limit));

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
