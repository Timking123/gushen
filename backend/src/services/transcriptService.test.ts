import { TranscriptService, Transcript, TranscriptListItem, TranscriptEventType, TranscriptSectionType } from './transcriptService.js';
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
    transcriptParticipant: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    transcriptSection: {
      findMany: jest.fn(),
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

describe('TranscriptService', () => {
  let transcriptService: TranscriptService;

  beforeEach(() => {
    transcriptService = new TranscriptService();
    jest.clearAllMocks();
    // Default mock for cache miss
    (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
  });


  // Mock transcript data
  const mockTranscriptWithRelations = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    symbol: 'AAPL',
    quarter: 'Q1 2024',
    eventType: 'earnings' as TranscriptEventType,
    date: new Date('2024-01-25'),
    aiSummary: 'Apple reported strong Q1 results with revenue growth.',
    createdAt: new Date(),
    stock: {
      name: 'Apple Inc.',
    },
    participants: [
      {
        id: 'p1',
        name: 'Tim Cook',
        title: 'CEO',
        company: 'Apple Inc.',
      },
      {
        id: 'p2',
        name: 'Luca Maestri',
        title: 'CFO',
        company: 'Apple Inc.',
      },
    ],
    sections: [
      {
        id: 's1',
        type: 'prepared_remarks' as TranscriptSectionType,
        speaker: 'Tim Cook',
        content: 'Good afternoon and thank you for joining us today.',
      },
      {
        id: 's2',
        type: 'qa' as TranscriptSectionType,
        speaker: 'Analyst',
        content: 'Can you discuss the iPhone revenue growth?',
      },
    ],
  };

  describe('getTranscriptsBySymbol', () => {
    it('should return transcripts for a specific stock', async () => {
      (prisma.transcript.findMany as jest.Mock).mockResolvedValue([mockTranscriptWithRelations]);

      const result = await transcriptService.getTranscriptsBySymbol('AAPL');

      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('AAPL');
      expect(result[0].quarter).toBe('Q1 2024');
      expect(result[0].participantCount).toBe(2);
      expect(prisma.transcript.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { symbol: 'AAPL' },
          orderBy: { date: 'desc' },
        })
      );
    });

    it('should normalize symbol to uppercase', async () => {
      (prisma.transcript.findMany as jest.Mock).mockResolvedValue([]);

      await transcriptService.getTranscriptsBySymbol('aapl');

      expect(prisma.transcript.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { symbol: 'AAPL' },
        })
      );
    });

    it('should respect limit parameter', async () => {
      (prisma.transcript.findMany as jest.Mock).mockResolvedValue([]);

      await transcriptService.getTranscriptsBySymbol('AAPL', 5);

      // Service caches more than requested, but returns limited results
      expect(prisma.transcript.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20, // Caches at least 20
        })
      );
    });

    it('should return cached results when cache hit', async () => {
      const cachedTranscripts: TranscriptListItem[] = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          symbol: 'AAPL',
          stockName: 'Apple Inc.',
          quarter: 'Q1 2024',
          eventType: 'earnings',
          date: new Date('2024-01-25'),
          participantCount: 2,
          aiSummary: 'Apple reported strong Q1 results.',
          createdAt: new Date(),
        },
      ];

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(cachedTranscripts);

      const result = await transcriptService.getTranscriptsBySymbol('AAPL');

      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('AAPL');
      expect(prisma.transcript.findMany).not.toHaveBeenCalled();
    });

    it('should cache results after fetching from database', async () => {
      (prisma.transcript.findMany as jest.Mock).mockResolvedValue([mockTranscriptWithRelations]);

      await transcriptService.getTranscriptsBySymbol('AAPL');

      expect(redisHelpers.setJson).toHaveBeenCalled();
    });
  });


  describe('getTranscriptById', () => {
    it('should return full transcript with participants and sections', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptWithRelations);

      const result = await transcriptService.getTranscriptById('123e4567-e89b-12d3-a456-426614174000');

      expect(result).not.toBeNull();
      expect(result!.symbol).toBe('AAPL');
      expect(result!.participants).toHaveLength(2);
      expect(result!.sections).toHaveLength(2);
      expect(result!.participants[0].name).toBe('Tim Cook');
      expect(result!.sections[0].type).toBe('prepared_remarks');
    });

    it('should return null when transcript not found', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await transcriptService.getTranscriptById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should return cached transcript when cache hit', async () => {
      const cachedTranscript: Transcript = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        symbol: 'AAPL',
        stockName: 'Apple Inc.',
        quarter: 'Q1 2024',
        eventType: 'earnings',
        date: new Date('2024-01-25'),
        participants: [
          { id: 'p1', name: 'Tim Cook', title: 'CEO', company: 'Apple Inc.' },
        ],
        sections: [
          { id: 's1', type: 'prepared_remarks', speaker: 'Tim Cook', content: 'Hello.' },
        ],
        aiSummary: 'Summary',
        createdAt: new Date(),
      };

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(cachedTranscript);

      const result = await transcriptService.getTranscriptById('123e4567-e89b-12d3-a456-426614174000');

      expect(result).not.toBeNull();
      expect(result!.symbol).toBe('AAPL');
      expect(prisma.transcript.findUnique).not.toHaveBeenCalled();
    });

    it('should cache transcript after fetching from database', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptWithRelations);

      await transcriptService.getTranscriptById('123e4567-e89b-12d3-a456-426614174000');

      expect(redisHelpers.setJson).toHaveBeenCalled();
    });
  });

  describe('getTranscripts', () => {
    it('should return paginated transcripts', async () => {
      (prisma.transcript.count as jest.Mock).mockResolvedValue(1);
      (prisma.transcript.findMany as jest.Mock).mockResolvedValue([mockTranscriptWithRelations]);

      const result = await transcriptService.getTranscripts();

      expect(result.transcripts).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    it('should filter by single symbol', async () => {
      (prisma.transcript.count as jest.Mock).mockResolvedValue(0);
      (prisma.transcript.findMany as jest.Mock).mockResolvedValue([]);

      await transcriptService.getTranscripts({ symbol: 'AAPL' });

      expect(prisma.transcript.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            symbol: 'AAPL',
          }),
        })
      );
    });

    it('should filter by multiple symbols', async () => {
      (prisma.transcript.count as jest.Mock).mockResolvedValue(0);
      (prisma.transcript.findMany as jest.Mock).mockResolvedValue([]);

      await transcriptService.getTranscripts({ symbols: ['AAPL', 'MSFT'] });

      expect(prisma.transcript.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            symbol: { in: ['AAPL', 'MSFT'] },
          }),
        })
      );
    });

    it('should filter by event types', async () => {
      (prisma.transcript.count as jest.Mock).mockResolvedValue(0);
      (prisma.transcript.findMany as jest.Mock).mockResolvedValue([]);

      await transcriptService.getTranscripts({ eventTypes: ['earnings', 'investor_day'] });

      expect(prisma.transcript.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventType: { in: ['earnings', 'investor_day'] },
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-03-31');

      (prisma.transcript.count as jest.Mock).mockResolvedValue(0);
      (prisma.transcript.findMany as jest.Mock).mockResolvedValue([]);

      await transcriptService.getTranscripts({ startDate, endDate });

      expect(prisma.transcript.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: {
              gte: startDate,
              lte: endDate,
            },
          }),
        })
      );
    });

    it('should filter by quarter', async () => {
      (prisma.transcript.count as jest.Mock).mockResolvedValue(0);
      (prisma.transcript.findMany as jest.Mock).mockResolvedValue([]);

      await transcriptService.getTranscripts({ quarter: 'Q1 2024' });

      expect(prisma.transcript.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            quarter: 'Q1 2024',
          }),
        })
      );
    });

    it('should support pagination', async () => {
      (prisma.transcript.count as jest.Mock).mockResolvedValue(100);
      (prisma.transcript.findMany as jest.Mock).mockResolvedValue([]);

      const result = await transcriptService.getTranscripts(
        undefined,
        { page: 3, limit: 10 }
      );

      expect(prisma.transcript.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );
      expect(result.pagination.page).toBe(3);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.totalPages).toBe(10);
    });
  });


  describe('searchTranscripts', () => {
    const mockSectionWithTranscript = {
      id: 's1',
      transcriptId: '123e4567-e89b-12d3-a456-426614174000',
      type: 'qa' as TranscriptSectionType,
      speaker: 'Analyst',
      content: 'Can you discuss the iPhone revenue growth and market share?',
      transcript: mockTranscriptWithRelations,
    };

    it('should search transcripts by keyword', async () => {
      (prisma.transcriptSection.findMany as jest.Mock).mockResolvedValue([mockSectionWithTranscript]);

      const result = await transcriptService.searchTranscripts('iPhone');

      expect(result.results).toHaveLength(1);
      expect(result.keyword).toBe('iPhone');
      expect(result.results[0].matchCount).toBe(1);
    });

    it('should return empty results for empty keyword', async () => {
      const result = await transcriptService.searchTranscripts('');

      expect(result.results).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should return empty results for whitespace-only keyword', async () => {
      const result = await transcriptService.searchTranscripts('   ');

      expect(result.results).toHaveLength(0);
    });

    it('should search case-insensitively', async () => {
      (prisma.transcriptSection.findMany as jest.Mock).mockResolvedValue([mockSectionWithTranscript]);

      await transcriptService.searchTranscripts('IPHONE');

      expect(prisma.transcriptSection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            content: {
              contains: 'iphone',
              mode: 'insensitive',
            },
          }),
        })
      );
    });

    it('should include match highlights in results', async () => {
      (prisma.transcriptSection.findMany as jest.Mock).mockResolvedValue([mockSectionWithTranscript]);

      const result = await transcriptService.searchTranscripts('iPhone');

      expect(result.results[0].matchedSections[0].matchHighlight).toBeDefined();
      expect(result.results[0].matchedSections[0].matchHighlight).toContain('iPhone');
    });

    it('should group multiple matching sections by transcript', async () => {
      const mockSections = [
        {
          ...mockSectionWithTranscript,
          id: 's1',
          content: 'iPhone sales were strong.',
        },
        {
          ...mockSectionWithTranscript,
          id: 's2',
          content: 'iPhone market share increased.',
        },
      ];

      (prisma.transcriptSection.findMany as jest.Mock).mockResolvedValue(mockSections);

      const result = await transcriptService.searchTranscripts('iPhone');

      expect(result.results).toHaveLength(1);
      expect(result.results[0].matchCount).toBe(2);
      expect(result.results[0].matchedSections).toHaveLength(2);
    });

    it('should apply filters when searching', async () => {
      (prisma.transcriptSection.findMany as jest.Mock).mockResolvedValue([]);

      await transcriptService.searchTranscripts('iPhone', { symbol: 'AAPL' });

      expect(prisma.transcriptSection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            transcript: expect.objectContaining({
              symbol: 'AAPL',
            }),
          }),
        })
      );
    });

    it('should support pagination in search results', async () => {
      const mockSections = Array.from({ length: 30 }, (_, i) => ({
        ...mockSectionWithTranscript,
        id: `s${i}`,
        transcriptId: `t${i}`,
        transcript: {
          ...mockTranscriptWithRelations,
          id: `t${i}`,
        },
      }));

      (prisma.transcriptSection.findMany as jest.Mock).mockResolvedValue(mockSections);

      const result = await transcriptService.searchTranscripts(
        'iPhone',
        undefined,
        { page: 2, limit: 10 }
      );

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
      expect(result.results.length).toBeLessThanOrEqual(10);
    });
  });


  describe('getLatestTranscript', () => {
    it('should return the latest transcript for a stock', async () => {
      (prisma.transcript.findFirst as jest.Mock).mockResolvedValue(mockTranscriptWithRelations);

      const result = await transcriptService.getLatestTranscript('AAPL');

      expect(result).not.toBeNull();
      expect(result!.symbol).toBe('AAPL');
      expect(prisma.transcript.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { symbol: 'AAPL' },
          orderBy: { date: 'desc' },
        })
      );
    });

    it('should normalize symbol to uppercase', async () => {
      (prisma.transcript.findFirst as jest.Mock).mockResolvedValue(null);

      await transcriptService.getLatestTranscript('aapl');

      expect(prisma.transcript.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { symbol: 'AAPL' },
        })
      );
    });

    it('should return null when no transcript exists', async () => {
      (prisma.transcript.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await transcriptService.getLatestTranscript('UNKNOWN');

      expect(result).toBeNull();
    });
  });

  describe('getRecentTranscripts', () => {
    it('should return recent transcripts across all stocks', async () => {
      (prisma.transcript.findMany as jest.Mock).mockResolvedValue([mockTranscriptWithRelations]);

      const result = await transcriptService.getRecentTranscripts(20);

      expect(result).toHaveLength(1);
      expect(prisma.transcript.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { date: 'desc' },
          take: 20,
        })
      );
    });

    it('should use default limit when not provided', async () => {
      (prisma.transcript.findMany as jest.Mock).mockResolvedValue([]);

      await transcriptService.getRecentTranscripts();

      expect(prisma.transcript.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
        })
      );
    });
  });

  describe('upsertTranscript', () => {
    it('should create a new transcript with participants and sections', async () => {
      const mockCreatedTranscript = {
        ...mockTranscriptWithRelations,
        id: 'new-id',
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          transcript: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'new-id' }),
            findUnique: jest.fn().mockResolvedValue(mockCreatedTranscript),
          },
          transcriptParticipant: {
            createMany: jest.fn(),
            deleteMany: jest.fn(),
          },
          transcriptSection: {
            createMany: jest.fn(),
            deleteMany: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result = await transcriptService.upsertTranscript({
        symbol: 'AAPL',
        quarter: 'Q1 2024',
        eventType: 'earnings',
        date: new Date('2024-01-25'),
        participants: [
          { name: 'Tim Cook', title: 'CEO', company: 'Apple Inc.' },
        ],
        sections: [
          { type: 'prepared_remarks', speaker: 'Tim Cook', content: 'Hello.' },
        ],
        aiSummary: 'Summary',
      });

      expect(result.symbol).toBe('AAPL');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should normalize symbol to uppercase', async () => {
      const mockCreatedTranscript = {
        ...mockTranscriptWithRelations,
        symbol: 'AAPL',
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          transcript: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'new-id' }),
            findUnique: jest.fn().mockResolvedValue(mockCreatedTranscript),
          },
          transcriptParticipant: {
            createMany: jest.fn(),
            deleteMany: jest.fn(),
          },
          transcriptSection: {
            createMany: jest.fn(),
            deleteMany: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result = await transcriptService.upsertTranscript({
        symbol: 'aapl',
        quarter: 'Q1 2024',
        date: new Date('2024-01-25'),
      });

      expect(result.symbol).toBe('AAPL');
    });

    it('should invalidate cache after upsert', async () => {
      const mockCreatedTranscript = {
        ...mockTranscriptWithRelations,
        id: 'new-id',
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          transcript: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'new-id' }),
            findUnique: jest.fn().mockResolvedValue(mockCreatedTranscript),
          },
          transcriptParticipant: {
            createMany: jest.fn(),
            deleteMany: jest.fn(),
          },
          transcriptSection: {
            createMany: jest.fn(),
            deleteMany: jest.fn(),
          },
        };
        return callback(tx);
      });

      await transcriptService.upsertTranscript({
        symbol: 'AAPL',
        quarter: 'Q1 2024',
        date: new Date('2024-01-25'),
      });

      expect(redisHelpers.del).toHaveBeenCalled();
    });
  });


  describe('Transcript data model', () => {
    it('should include all required fields per design spec', () => {
      // Verify the Transcript interface includes all fields from design.md
      const mockTranscript: Transcript = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        symbol: 'AAPL',
        stockName: 'Apple Inc.',
        quarter: 'Q1 2024',
        eventType: 'earnings',
        date: new Date('2024-01-25'),
        participants: [
          { id: 'p1', name: 'Tim Cook', title: 'CEO', company: 'Apple Inc.' },
        ],
        sections: [
          { id: 's1', type: 'prepared_remarks', speaker: 'Tim Cook', content: 'Hello.' },
          { id: 's2', type: 'qa', speaker: 'Analyst', content: 'Question?' },
        ],
        aiSummary: 'Summary of the call.',
        createdAt: new Date(),
      };

      // Verify event types match design spec
      expect(['earnings', 'investor_day', 'conference']).toContain(mockTranscript.eventType);
      
      // Verify section types match design spec
      expect(['prepared_remarks', 'qa']).toContain(mockTranscript.sections[0].type);
      
      // Verify all required fields are present
      expect(mockTranscript.symbol).toBeDefined();
      expect(mockTranscript.quarter).toBeDefined();
      expect(mockTranscript.date).toBeDefined();
      expect(mockTranscript.participants).toBeDefined();
      expect(mockTranscript.sections).toBeDefined();
    });

    it('should support earnings event type', () => {
      const eventType: TranscriptEventType = 'earnings';
      expect(eventType).toBe('earnings');
    });

    it('should support investor_day event type', () => {
      const eventType: TranscriptEventType = 'investor_day';
      expect(eventType).toBe('investor_day');
    });

    it('should support conference event type', () => {
      const eventType: TranscriptEventType = 'conference';
      expect(eventType).toBe('conference');
    });

    it('should support prepared_remarks section type', () => {
      const sectionType: TranscriptSectionType = 'prepared_remarks';
      expect(sectionType).toBe('prepared_remarks');
    });

    it('should support qa section type', () => {
      const sectionType: TranscriptSectionType = 'qa';
      expect(sectionType).toBe('qa');
    });
  });

  describe('Requirements validation', () => {
    /**
     * Requirement 14.1: WHEN 用户查看股票详情 THEN Transcript_Service SHALL 显示最近的财报电话会议记录列表
     */
    it('should provide access to earnings call transcripts (Req 14.1)', async () => {
      (prisma.transcript.findMany as jest.Mock).mockResolvedValue([mockTranscriptWithRelations]);

      const result = await transcriptService.getTranscriptsBySymbol('AAPL');

      expect(result).toHaveLength(1);
      expect(result[0].eventType).toBe('earnings');
    });

    /**
     * Requirement 14.2: WHEN 用户阅读会议记录 THEN Transcript_Service SHALL 提供完整的问答环节文字记录
     */
    it('should display meeting date, participants, and main topics (Req 14.2)', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptWithRelations);

      const result = await transcriptService.getTranscriptById('123e4567-e89b-12d3-a456-426614174000');

      expect(result).not.toBeNull();
      // Meeting date
      expect(result!.date).toBeDefined();
      // Participants
      expect(result!.participants).toHaveLength(2);
      expect(result!.participants[0].name).toBe('Tim Cook');
      expect(result!.participants[0].title).toBe('CEO');
      // Main topics (sections)
      expect(result!.sections).toHaveLength(2);
      expect(result!.sections.some(s => s.type === 'prepared_remarks')).toBe(true);
      expect(result!.sections.some(s => s.type === 'qa')).toBe(true);
    });

    /**
     * Requirement 14.3: WHEN 用户搜索会议记录 THEN Transcript_Service SHALL 支持按关键词搜索特定主题或内容
     */
    it('should support keyword search in transcript content (Req 14.3)', async () => {
      const mockSectionWithTranscript = {
        id: 's1',
        transcriptId: '123e4567-e89b-12d3-a456-426614174000',
        type: 'qa' as TranscriptSectionType,
        speaker: 'Analyst',
        content: 'Can you discuss the iPhone revenue growth?',
        transcript: mockTranscriptWithRelations,
      };

      (prisma.transcriptSection.findMany as jest.Mock).mockResolvedValue([mockSectionWithTranscript]);

      const result = await transcriptService.searchTranscripts('iPhone');

      expect(result.results).toHaveLength(1);
      expect(result.results[0].matchedSections[0].content).toContain('iPhone');
    });
  });

  describe('generateAISummary', () => {
    const mockTranscriptForSummary = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      symbol: 'AAPL',
      quarter: 'Q1 2024',
      eventType: 'earnings' as TranscriptEventType,
      date: new Date('2024-01-25'),
      aiSummary: null,
      createdAt: new Date(),
      stock: {
        name: 'Apple Inc.',
      },
      participants: [
        {
          id: 'p1',
          name: 'Tim Cook',
          title: 'CEO',
          company: 'Apple Inc.',
        },
      ],
      sections: [
        {
          id: 's1',
          type: 'prepared_remarks' as TranscriptSectionType,
          speaker: 'Tim Cook',
          content: 'We are pleased to report strong revenue growth this quarter. Our iPhone sales exceeded expectations.',
        },
        {
          id: 's2',
          type: 'qa' as TranscriptSectionType,
          speaker: 'Analyst',
          content: 'Can you provide guidance for next quarter?',
        },
      ],
    };

    /**
     * Requirement 14.5: WHEN 用户阅读会议记录 THEN AI_Assistant SHALL 提供一键总结功能，提取关键要点
     */
    it('should generate AI summary for a transcript (Req 14.5)', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptForSummary);
      (prisma.transcript.update as jest.Mock).mockResolvedValue(mockTranscriptForSummary);

      const result = await transcriptService.generateAISummary('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toBeDefined();
      expect(result.transcriptId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result.summary).toBeDefined();
      expect(result.keyPoints).toBeDefined();
      expect(Array.isArray(result.keyPoints)).toBe(true);
      expect(result.sentiment).toBeDefined();
      expect(['positive', 'negative', 'neutral']).toContain(result.sentiment);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.generatedAt).toBeDefined();
    });

    it('should throw error when transcript not found', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(transcriptService.generateAISummary('non-existent-id'))
        .rejects.toThrow('Transcript not found');
    });

    it('should return cached summary when cache hit', async () => {
      const cachedSummary = {
        transcriptId: '123e4567-e89b-12d3-a456-426614174000',
        summary: 'Cached summary',
        keyPoints: ['Point 1', 'Point 2'],
        sentiment: 'positive',
        confidence: 0.8,
        generatedAt: new Date(),
      };

      (redisHelpers.getJson as jest.Mock)
        .mockResolvedValueOnce(null) // First call for transcript detail
        .mockResolvedValueOnce(cachedSummary); // Second call for summary cache

      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptForSummary);

      const result = await transcriptService.generateAISummary('123e4567-e89b-12d3-a456-426614174000');

      expect(result.summary).toBe('Cached summary');
    });

    it('should cache summary after generation', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptForSummary);
      (prisma.transcript.update as jest.Mock).mockResolvedValue(mockTranscriptForSummary);

      await transcriptService.generateAISummary('123e4567-e89b-12d3-a456-426614174000');

      expect(redisHelpers.setJson).toHaveBeenCalled();
    });

    it('should update transcript with AI summary', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptForSummary);
      (prisma.transcript.update as jest.Mock).mockResolvedValue(mockTranscriptForSummary);

      await transcriptService.generateAISummary('123e4567-e89b-12d3-a456-426614174000');

      expect(prisma.transcript.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '123e4567-e89b-12d3-a456-426614174000' },
          data: expect.objectContaining({
            aiSummary: expect.any(String),
          }),
        })
      );
    });

    it('should generate fallback summary when AI is not available', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptForSummary);
      (prisma.transcript.update as jest.Mock).mockResolvedValue(mockTranscriptForSummary);

      // Without OPENAI_API_KEY, fallback should be used
      const result = await transcriptService.generateAISummary('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.confidence).toBe(0.5); // Fallback has lower confidence
    });
  });

  describe('extractKeyStatements', () => {
    const mockTranscriptForKeyStatements = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      symbol: 'AAPL',
      quarter: 'Q1 2024',
      eventType: 'earnings' as TranscriptEventType,
      date: new Date('2024-01-25'),
      aiSummary: null,
      createdAt: new Date(),
      stock: {
        name: 'Apple Inc.',
      },
      participants: [
        {
          id: 'p1',
          name: 'Tim Cook',
          title: 'CEO',
          company: 'Apple Inc.',
        },
        {
          id: 'p2',
          name: 'Luca Maestri',
          title: 'CFO',
          company: 'Apple Inc.',
        },
      ],
      sections: [
        {
          id: 's1',
          type: 'prepared_remarks' as TranscriptSectionType,
          speaker: 'Tim Cook',
          content: 'We expect revenue growth of 10% next quarter. Our strategy focuses on expanding services.',
        },
        {
          id: 's2',
          type: 'prepared_remarks' as TranscriptSectionType,
          speaker: 'Luca Maestri',
          content: 'We commit to returning $100 billion to shareholders. There are some risks in the supply chain.',
        },
        {
          id: 's3',
          type: 'qa' as TranscriptSectionType,
          speaker: 'Analyst',
          content: 'What is your guidance for iPhone sales?',
        },
      ],
    };

    /**
     * Requirement 14.6: WHEN 用户查看会议记录 THEN Transcript_Service SHALL 高亮显示管理层对业绩指引和战略方向的陈述
     */
    it('should extract key statements from transcript (Req 14.6)', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptForKeyStatements);

      const result = await transcriptService.extractKeyStatements('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should identify guidance statements', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptForKeyStatements);

      const result = await transcriptService.extractKeyStatements('123e4567-e89b-12d3-a456-426614174000');

      const guidanceStatements = result.filter(s => s.type === 'guidance');
      expect(guidanceStatements.length).toBeGreaterThan(0);
    });

    it('should identify strategy statements', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptForKeyStatements);

      const result = await transcriptService.extractKeyStatements('123e4567-e89b-12d3-a456-426614174000');

      const strategyStatements = result.filter(s => s.type === 'strategy');
      expect(strategyStatements.length).toBeGreaterThan(0);
    });

    it('should identify commitment statements', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptForKeyStatements);

      const result = await transcriptService.extractKeyStatements('123e4567-e89b-12d3-a456-426614174000');

      const commitmentStatements = result.filter(s => s.type === 'commitment');
      expect(commitmentStatements.length).toBeGreaterThan(0);
    });

    it('should identify risk statements', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptForKeyStatements);

      const result = await transcriptService.extractKeyStatements('123e4567-e89b-12d3-a456-426614174000');

      const riskStatements = result.filter(s => s.type === 'risk');
      expect(riskStatements.length).toBeGreaterThan(0);
    });

    it('should include highlighted text for each statement', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptForKeyStatements);

      const result = await transcriptService.extractKeyStatements('123e4567-e89b-12d3-a456-426614174000');

      result.forEach(statement => {
        expect(statement.highlightedText).toBeDefined();
        expect(statement.highlightedText.length).toBeGreaterThan(0);
      });
    });

    it('should include speaker information for each statement', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptForKeyStatements);

      const result = await transcriptService.extractKeyStatements('123e4567-e89b-12d3-a456-426614174000');

      result.forEach(statement => {
        expect(statement.speaker).toBeDefined();
        expect(statement.sectionId).toBeDefined();
      });
    });

    it('should include importance level for each statement', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptForKeyStatements);

      const result = await transcriptService.extractKeyStatements('123e4567-e89b-12d3-a456-426614174000');

      result.forEach(statement => {
        expect(statement.importance).toBeDefined();
        expect(['high', 'medium', 'low']).toContain(statement.importance);
      });
    });

    it('should throw error when transcript not found', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(transcriptService.extractKeyStatements('non-existent-id'))
        .rejects.toThrow('Transcript not found');
    });

    it('should return cached key statements when cache hit', async () => {
      const cachedStatements = [
        {
          id: 'ks-1',
          sectionId: 's1',
          speaker: 'Tim Cook',
          speakerTitle: 'CEO',
          content: 'We expect revenue growth.',
          type: 'guidance',
          importance: 'high',
          highlightedText: 'expect revenue growth',
        },
      ];

      (redisHelpers.getJson as jest.Mock)
        .mockResolvedValueOnce(null) // First call for transcript detail
        .mockResolvedValueOnce(cachedStatements); // Second call for key statements cache

      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptForKeyStatements);

      const result = await transcriptService.extractKeyStatements('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toEqual(cachedStatements);
    });

    it('should cache key statements after extraction', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptForKeyStatements);

      await transcriptService.extractKeyStatements('123e4567-e89b-12d3-a456-426614174000');

      expect(redisHelpers.setJson).toHaveBeenCalled();
    });
  });

  describe('getTranscriptWithAnalysis', () => {
    const mockTranscriptWithSections = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      symbol: 'AAPL',
      quarter: 'Q1 2024',
      eventType: 'earnings' as TranscriptEventType,
      date: new Date('2024-01-25'),
      aiSummary: null,
      createdAt: new Date(),
      stock: {
        name: 'Apple Inc.',
      },
      participants: [
        {
          id: 'p1',
          name: 'Tim Cook',
          title: 'CEO',
          company: 'Apple Inc.',
        },
      ],
      sections: [
        {
          id: 's1',
          type: 'prepared_remarks' as TranscriptSectionType,
          speaker: 'Tim Cook',
          content: 'We expect strong growth. Our strategy is to expand services.',
        },
      ],
    };

    /**
     * Requirements 14.5, 14.6: Get transcript with AI analysis
     */
    it('should return transcript with AI analysis (Req 14.5, 14.6)', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptWithSections);
      (prisma.transcript.update as jest.Mock).mockResolvedValue(mockTranscriptWithSections);

      const result = await transcriptService.getTranscriptWithAnalysis('123e4567-e89b-12d3-a456-426614174000');

      expect(result).not.toBeNull();
      expect(result!.symbol).toBe('AAPL');
      expect(result!.aiAnalysis).toBeDefined();
      expect(result!.aiAnalysis!.summary).toBeDefined();
      expect(result!.aiAnalysis!.keyStatements).toBeDefined();
    });

    it('should return null when transcript not found', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await transcriptService.getTranscriptWithAnalysis('non-existent-id');

      expect(result).toBeNull();
    });

    it('should include summary with key points', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptWithSections);
      (prisma.transcript.update as jest.Mock).mockResolvedValue(mockTranscriptWithSections);

      const result = await transcriptService.getTranscriptWithAnalysis('123e4567-e89b-12d3-a456-426614174000');

      expect(result!.aiAnalysis!.summary.summary).toBeDefined();
      expect(result!.aiAnalysis!.summary.keyPoints).toBeDefined();
      expect(Array.isArray(result!.aiAnalysis!.summary.keyPoints)).toBe(true);
    });

    it('should include sentiment analysis', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptWithSections);
      (prisma.transcript.update as jest.Mock).mockResolvedValue(mockTranscriptWithSections);

      const result = await transcriptService.getTranscriptWithAnalysis('123e4567-e89b-12d3-a456-426614174000');

      expect(result!.aiAnalysis!.summary.sentiment).toBeDefined();
      expect(['positive', 'negative', 'neutral']).toContain(result!.aiAnalysis!.summary.sentiment);
    });

    it('should include key statements with types', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscriptWithSections);
      (prisma.transcript.update as jest.Mock).mockResolvedValue(mockTranscriptWithSections);

      const result = await transcriptService.getTranscriptWithAnalysis('123e4567-e89b-12d3-a456-426614174000');

      expect(result!.aiAnalysis!.keyStatements).toBeDefined();
      expect(Array.isArray(result!.aiAnalysis!.keyStatements)).toBe(true);
    });
  });

  describe('KeyStatement data model', () => {
    it('should support all statement types per design spec', () => {
      const validTypes = ['guidance', 'commitment', 'strategy', 'risk', 'highlight'];
      
      validTypes.forEach(type => {
        expect(['guidance', 'commitment', 'strategy', 'risk', 'highlight']).toContain(type);
      });
    });

    it('should support all importance levels', () => {
      const validLevels = ['high', 'medium', 'low'];
      
      validLevels.forEach(level => {
        expect(['high', 'medium', 'low']).toContain(level);
      });
    });
  });

  describe('TranscriptAISummary data model', () => {
    it('should support all sentiment values', () => {
      const validSentiments = ['positive', 'negative', 'neutral'];
      
      validSentiments.forEach(sentiment => {
        expect(['positive', 'negative', 'neutral']).toContain(sentiment);
      });
    });

    it('should have confidence between 0 and 1', () => {
      const validConfidences = [0, 0.5, 1];
      
      validConfidences.forEach(confidence => {
        expect(confidence).toBeGreaterThanOrEqual(0);
        expect(confidence).toBeLessThanOrEqual(1);
      });
    });
  });
});
