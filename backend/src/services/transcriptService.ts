import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';
import { CacheKeys, CacheTTL } from '../lib/cache-keys.js';
import { logger } from '../utils/logger.js';

/**
 * AI Summary response interface
 * Implements Requirement 14.5: Provide AI-generated meeting summary
 */
export interface TranscriptAISummary {
  transcriptId: string;
  summary: string;
  keyPoints: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  generatedAt: Date;
}

/**
 * Key statement interface
 * Implements Requirement 14.6: Highlight key statements and commitments from management
 */
export interface KeyStatement {
  id: string;
  sectionId: string;
  speaker: string;
  speakerTitle: string | null;
  content: string;
  type: 'guidance' | 'commitment' | 'strategy' | 'risk' | 'highlight';
  importance: 'high' | 'medium' | 'low';
  highlightedText: string;
}

/**
 * Transcript with AI analysis
 */
export interface TranscriptWithAnalysis extends Transcript {
  aiAnalysis?: {
    summary: TranscriptAISummary;
    keyStatements: KeyStatement[];
  };
}

/**
 * Event type for transcripts
 */
export type TranscriptEventType = 'earnings' | 'investor_day' | 'conference';

/**
 * Section type for transcript content
 */
export type TranscriptSectionType = 'prepared_remarks' | 'qa';

/**
 * Transcript participant interface
 * Represents a participant in the earnings call
 * 
 * Implements Requirement 14.2: Display meeting participants
 */
export interface TranscriptParticipant {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
}

/**
 * Transcript section interface
 * Represents a section of the transcript (prepared remarks or Q&A)
 * 
 * Implements Requirement 14.2: Display main topics
 */
export interface TranscriptSection {
  id: string;
  type: TranscriptSectionType;
  speaker: string;
  content: string;
}

/**
 * Transcript interface
 * Represents a complete earnings call transcript
 * 
 * Implements Requirements:
 * - 14.1: Provide access to earnings call transcripts
 * - 14.2: Display meeting date, participants, main topics
 */
export interface Transcript {
  id: string;
  symbol: string;
  stockName?: string;
  quarter: string;
  eventType: TranscriptEventType;
  date: Date;
  participants: TranscriptParticipant[];
  sections: TranscriptSection[];
  aiSummary: string | null;
  createdAt: Date;
}

/**
 * Transcript list item (without full content)
 */
export interface TranscriptListItem {
  id: string;
  symbol: string;
  stockName?: string;
  quarter: string;
  eventType: TranscriptEventType;
  date: Date;
  participantCount: number;
  aiSummary: string | null;
  createdAt: Date;
}

/**
 * Transcript search result
 * Implements Requirement 14.3: Support keyword search in transcript content
 */
export interface TranscriptSearchResult {
  transcript: TranscriptListItem;
  matchedSections: Array<{
    id: string;
    type: TranscriptSectionType;
    speaker: string;
    content: string;
    matchHighlight: string;
  }>;
  matchCount: number;
}

/**
 * Transcript filter options
 */
export interface TranscriptFilters {
  symbol?: string;
  symbols?: string[];
  eventTypes?: TranscriptEventType[];
  startDate?: Date;
  endDate?: Date;
  quarter?: string;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Paginated transcripts response
 */
export interface TranscriptsResponse {
  transcripts: TranscriptListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Transcript search response
 */
export interface TranscriptSearchResponse {
  results: TranscriptSearchResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  keyword: string;
}

/**
 * Input for creating a transcript
 */
export interface TranscriptInput {
  symbol: string;
  quarter: string;
  eventType?: TranscriptEventType;
  date: Date;
  participants?: Array<{
    name: string;
    title?: string | null;
    company?: string | null;
  }>;
  sections?: Array<{
    type: TranscriptSectionType;
    speaker: string;
    content: string;
  }>;
  aiSummary?: string | null;
}

/**
 * TranscriptService - Handles earnings call transcript operations
 * 
 * Implements Requirements:
 * - 14.1: WHEN 用户查看股票详情 THEN Transcript_Service SHALL 显示最近的财报电话会议记录列表
 * - 14.2: WHEN 用户阅读会议记录 THEN Transcript_Service SHALL 提供完整的问答环节文字记录
 * - 14.3: WHEN 用户搜索会议记录 THEN Transcript_Service SHALL 支持按关键词搜索特定主题或内容
 */
export class TranscriptService {
  /**
   * Get transcripts for a specific stock symbol
   * 
   * @param symbol - Stock symbol
   * @param limit - Maximum number of transcripts to return
   * @returns Array of transcript list items for the stock
   * 
   * Implements Requirement 14.1
   */
  async getTranscriptsBySymbol(
    symbol: string,
    limit: number = 10
  ): Promise<TranscriptListItem[]> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check cache first
    const cacheKey = CacheKeys.transcript.list(normalizedSymbol);
    try {
      const cachedTranscripts = await redisHelpers.getJson<TranscriptListItem[]>(cacheKey);
      if (cachedTranscripts) {
        logger.debug(`Transcripts cache hit for: ${normalizedSymbol}`);
        return cachedTranscripts.slice(0, limit).map((t) => ({
          ...t,
          date: new Date(t.date),
          createdAt: new Date(t.createdAt),
        }));
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Query transcripts for the symbol
    const transcripts = await prisma.transcript.findMany({
      where: { symbol: normalizedSymbol },
      orderBy: { date: 'desc' },
      take: Math.max(limit, 20), // Cache more than requested
      include: {
        stock: {
          select: {
            name: true,
          },
        },
        participants: true,
      },
    });

    // Transform to list items
    const transcriptList: TranscriptListItem[] = transcripts.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      stockName: t.stock.name,
      quarter: t.quarter,
      eventType: t.eventType as TranscriptEventType,
      date: t.date,
      participantCount: t.participants.length,
      aiSummary: t.aiSummary,
      createdAt: t.createdAt,
    }));

    // Cache the result
    try {
      await redisHelpers.setJson(cacheKey, transcriptList, CacheTTL.transcript);
      logger.debug(`Transcripts cached for: ${normalizedSymbol}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return transcriptList.slice(0, limit);
  }

  /**
   * Get a single transcript by ID with full content
   * 
   * @param transcriptId - Transcript ID
   * @returns Full transcript with participants and sections
   * 
   * Implements Requirement 14.2
   */
  async getTranscriptById(transcriptId: string): Promise<Transcript | null> {
    // Check cache first
    const cacheKey = CacheKeys.transcript.detail(transcriptId);
    try {
      const cachedTranscript = await redisHelpers.getJson<Transcript>(cacheKey);
      if (cachedTranscript) {
        logger.debug(`Transcript detail cache hit for: ${transcriptId}`);
        return {
          ...cachedTranscript,
          date: new Date(cachedTranscript.date),
          createdAt: new Date(cachedTranscript.createdAt),
        };
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Query transcript with all relations
    const transcript = await prisma.transcript.findUnique({
      where: { id: transcriptId },
      include: {
        stock: {
          select: {
            name: true,
          },
        },
        participants: true,
        sections: true,
      },
    });

    if (!transcript) {
      return null;
    }

    // Transform to response format
    const result: Transcript = {
      id: transcript.id,
      symbol: transcript.symbol,
      stockName: transcript.stock.name,
      quarter: transcript.quarter,
      eventType: transcript.eventType as TranscriptEventType,
      date: transcript.date,
      participants: transcript.participants.map((p) => ({
        id: p.id,
        name: p.name,
        title: p.title,
        company: p.company,
      })),
      sections: transcript.sections.map((s) => ({
        id: s.id,
        type: s.type as TranscriptSectionType,
        speaker: s.speaker,
        content: s.content,
      })),
      aiSummary: transcript.aiSummary,
      createdAt: transcript.createdAt,
    };

    // Cache the result
    try {
      await redisHelpers.setJson(cacheKey, result, CacheTTL.transcript);
      logger.debug(`Transcript detail cached for: ${transcriptId}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return result;
  }

  /**
   * Get transcripts with optional filters and pagination
   * 
   * @param filters - Optional filter criteria
   * @param pagination - Pagination options
   * @returns Paginated transcript list items
   */
  async getTranscripts(
    filters?: TranscriptFilters,
    pagination?: PaginationOptions
  ): Promise<TranscriptsResponse> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    // Build where clause based on filters
    const where = this.buildWhereClause(filters);

    // Get total count for pagination
    const total = await prisma.transcript.count({ where });

    // Query transcripts
    const transcripts = await prisma.transcript.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: limit,
      include: {
        stock: {
          select: {
            name: true,
          },
        },
        participants: true,
      },
    });

    // Transform to list items
    const transcriptList: TranscriptListItem[] = transcripts.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      stockName: t.stock.name,
      quarter: t.quarter,
      eventType: t.eventType as TranscriptEventType,
      date: t.date,
      participantCount: t.participants.length,
      aiSummary: t.aiSummary,
      createdAt: t.createdAt,
    }));

    return {
      transcripts: transcriptList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Search transcripts by keyword
   * 
   * @param keyword - Search keyword
   * @param filters - Optional filter criteria
   * @param pagination - Pagination options
   * @returns Search results with matched sections
   * 
   * Implements Requirement 14.3
   */
  async searchTranscripts(
    keyword: string,
    filters?: TranscriptFilters,
    pagination?: PaginationOptions
  ): Promise<TranscriptSearchResponse> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    // Normalize keyword for search
    const normalizedKeyword = keyword.trim().toLowerCase();

    if (!normalizedKeyword) {
      return {
        results: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
        keyword,
      };
    }

    // Build base where clause from filters
    const baseWhere = this.buildWhereClause(filters);

    // Search in transcript sections
    const matchingSections = await prisma.transcriptSection.findMany({
      where: {
        content: {
          contains: normalizedKeyword,
          mode: 'insensitive',
        },
        transcript: baseWhere,
      },
      include: {
        transcript: {
          include: {
            stock: {
              select: {
                name: true,
              },
            },
            participants: true,
          },
        },
      },
      orderBy: {
        transcript: {
          date: 'desc',
        },
      },
    });

    // Group sections by transcript
    const transcriptMap = new Map<string, {
      transcript: TranscriptListItem;
      matchedSections: Array<{
        id: string;
        type: TranscriptSectionType;
        speaker: string;
        content: string;
        matchHighlight: string;
      }>;
    }>();

    for (const section of matchingSections) {
      const transcriptId = section.transcriptId;
      
      if (!transcriptMap.has(transcriptId)) {
        transcriptMap.set(transcriptId, {
          transcript: {
            id: section.transcript.id,
            symbol: section.transcript.symbol,
            stockName: section.transcript.stock.name,
            quarter: section.transcript.quarter,
            eventType: section.transcript.eventType as TranscriptEventType,
            date: section.transcript.date,
            participantCount: section.transcript.participants.length,
            aiSummary: section.transcript.aiSummary,
            createdAt: section.transcript.createdAt,
          },
          matchedSections: [],
        });
      }

      const entry = transcriptMap.get(transcriptId)!;
      entry.matchedSections.push({
        id: section.id,
        type: section.type as TranscriptSectionType,
        speaker: section.speaker,
        content: section.content,
        matchHighlight: this.createHighlight(section.content, normalizedKeyword),
      });
    }

    // Convert to array and apply pagination
    const allResults = Array.from(transcriptMap.values()).map((entry) => ({
      transcript: entry.transcript,
      matchedSections: entry.matchedSections,
      matchCount: entry.matchedSections.length,
    }));

    const total = allResults.length;
    const paginatedResults = allResults.slice(skip, skip + limit);

    return {
      results: paginatedResults,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      keyword,
    };
  }

  /**
   * Create or update a transcript
   * 
   * @param input - Transcript input data
   * @returns The created or updated transcript
   */
  async upsertTranscript(input: TranscriptInput): Promise<Transcript> {
    const normalizedSymbol = input.symbol.trim().toUpperCase();

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Check if transcript exists for this symbol and quarter
      const existing = await tx.transcript.findFirst({
        where: {
          symbol: normalizedSymbol,
          quarter: input.quarter,
        },
      });

      let transcriptId: string;

      if (existing) {
        // Update existing transcript
        await tx.transcript.update({
          where: { id: existing.id },
          data: {
            eventType: input.eventType ?? 'earnings',
            date: input.date,
            aiSummary: input.aiSummary,
          },
        });
        transcriptId = existing.id;

        // Delete existing participants and sections
        await tx.transcriptParticipant.deleteMany({
          where: { transcriptId },
        });
        await tx.transcriptSection.deleteMany({
          where: { transcriptId },
        });
      } else {
        // Create new transcript
        const newTranscript = await tx.transcript.create({
          data: {
            symbol: normalizedSymbol,
            quarter: input.quarter,
            eventType: input.eventType ?? 'earnings',
            date: input.date,
            aiSummary: input.aiSummary,
          },
        });
        transcriptId = newTranscript.id;
      }

      // Create participants
      if (input.participants && input.participants.length > 0) {
        await tx.transcriptParticipant.createMany({
          data: input.participants.map((p) => ({
            transcriptId,
            name: p.name,
            title: p.title ?? null,
            company: p.company ?? null,
          })),
        });
      }

      // Create sections
      if (input.sections && input.sections.length > 0) {
        await tx.transcriptSection.createMany({
          data: input.sections.map((s) => ({
            transcriptId,
            type: s.type,
            speaker: s.speaker,
            content: s.content,
          })),
        });
      }

      // Fetch the complete transcript
      return tx.transcript.findUnique({
        where: { id: transcriptId },
        include: {
          stock: {
            select: {
              name: true,
            },
          },
          participants: true,
          sections: true,
        },
      });
    });

    if (!result) {
      throw new Error('Failed to create or update transcript');
    }

    // Invalidate caches
    await this.invalidateCache(normalizedSymbol, result.id);

    return {
      id: result.id,
      symbol: result.symbol,
      stockName: result.stock.name,
      quarter: result.quarter,
      eventType: result.eventType as TranscriptEventType,
      date: result.date,
      participants: result.participants.map((p) => ({
        id: p.id,
        name: p.name,
        title: p.title,
        company: p.company,
      })),
      sections: result.sections.map((s) => ({
        id: s.id,
        type: s.type as TranscriptSectionType,
        speaker: s.speaker,
        content: s.content,
      })),
      aiSummary: result.aiSummary,
      createdAt: result.createdAt,
    };
  }

  /**
   * Get the latest transcript for a stock
   * 
   * @param symbol - Stock symbol
   * @returns The latest transcript or null
   */
  async getLatestTranscript(symbol: string): Promise<Transcript | null> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    const transcript = await prisma.transcript.findFirst({
      where: { symbol: normalizedSymbol },
      orderBy: { date: 'desc' },
      include: {
        stock: {
          select: {
            name: true,
          },
        },
        participants: true,
        sections: true,
      },
    });

    if (!transcript) {
      return null;
    }

    return {
      id: transcript.id,
      symbol: transcript.symbol,
      stockName: transcript.stock.name,
      quarter: transcript.quarter,
      eventType: transcript.eventType as TranscriptEventType,
      date: transcript.date,
      participants: transcript.participants.map((p) => ({
        id: p.id,
        name: p.name,
        title: p.title,
        company: p.company,
      })),
      sections: transcript.sections.map((s) => ({
        id: s.id,
        type: s.type as TranscriptSectionType,
        speaker: s.speaker,
        content: s.content,
      })),
      aiSummary: transcript.aiSummary,
      createdAt: transcript.createdAt,
    };
  }

  /**
   * Get recent transcripts across all stocks
   * 
   * @param limit - Maximum number of transcripts to return
   * @returns Array of recent transcript list items
   */
  async getRecentTranscripts(limit: number = 20): Promise<TranscriptListItem[]> {
    const transcripts = await prisma.transcript.findMany({
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        stock: {
          select: {
            name: true,
          },
        },
        participants: true,
      },
    });

    return transcripts.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      stockName: t.stock.name,
      quarter: t.quarter,
      eventType: t.eventType as TranscriptEventType,
      date: t.date,
      participantCount: t.participants.length,
      aiSummary: t.aiSummary,
      createdAt: t.createdAt,
    }));
  }

  /**
   * Build Prisma where clause from filters
   */
  private buildWhereClause(filters?: TranscriptFilters): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (!filters) {
      return where;
    }

    // Single symbol filter
    if (filters.symbol) {
      where.symbol = filters.symbol.trim().toUpperCase();
    }

    // Multiple symbols filter
    if (filters.symbols && filters.symbols.length > 0) {
      where.symbol = {
        in: filters.symbols.map((s) => s.trim().toUpperCase()),
      };
    }

    // Event type filter
    if (filters.eventTypes && filters.eventTypes.length > 0) {
      where.eventType = {
        in: filters.eventTypes,
      };
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) {
        (where.date as Record<string, Date>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.date as Record<string, Date>).lte = filters.endDate;
      }
    }

    // Quarter filter
    if (filters.quarter) {
      where.quarter = filters.quarter;
    }

    return where;
  }

  /**
   * Create a highlight snippet around the matched keyword
   */
  private createHighlight(content: string, keyword: string, contextLength: number = 100): string {
    const lowerContent = content.toLowerCase();
    const index = lowerContent.indexOf(keyword);

    if (index === -1) {
      return content.substring(0, contextLength * 2) + '...';
    }

    const start = Math.max(0, index - contextLength);
    const end = Math.min(content.length, index + keyword.length + contextLength);

    let highlight = '';
    if (start > 0) {
      highlight += '...';
    }
    highlight += content.substring(start, end);
    if (end < content.length) {
      highlight += '...';
    }

    return highlight;
  }

  /**
   * Invalidate cache for a symbol and transcript
   */
  private async invalidateCache(symbol: string, transcriptId: string): Promise<void> {
    try {
      // Invalidate symbol-specific cache
      await redisHelpers.del(CacheKeys.transcript.list(symbol));
      // Invalidate transcript detail cache
      await redisHelpers.del(CacheKeys.transcript.detail(transcriptId));
      
      logger.debug(`Transcript cache invalidated for symbol: ${symbol}, id: ${transcriptId}`);
    } catch (error) {
      logger.warn('Redis cache invalidation error:', error);
    }
  }

  /**
   * Generate AI summary for a transcript
   * 
   * Implements Requirement 14.5: Provide AI-generated meeting summary
   * 
   * @param transcriptId - Transcript ID
   * @returns AI-generated summary with key points
   */
  async generateAISummary(transcriptId: string): Promise<TranscriptAISummary> {
    // Get the transcript with full content
    const transcript = await this.getTranscriptById(transcriptId);
    
    if (!transcript) {
      throw new Error(`Transcript not found: ${transcriptId}`);
    }

    // Check cache first
    const cacheKey = CacheKeys.transcript.summary(transcriptId);
    try {
      const cachedSummary = await redisHelpers.getJson<TranscriptAISummary>(cacheKey);
      if (cachedSummary) {
        logger.debug(`AI summary cache hit for transcript: ${transcriptId}`);
        return {
          ...cachedSummary,
          generatedAt: new Date(cachedSummary.generatedAt),
        };
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Generate summary using AI or fallback
    const openaiApiKey = process.env.OPENAI_API_KEY;
    let summary: TranscriptAISummary;

    if (openaiApiKey) {
      summary = await this.callOpenAIForSummary(transcript, openaiApiKey);
    } else {
      summary = this.generateFallbackSummary(transcript);
    }

    // Update the transcript with the AI summary
    await prisma.transcript.update({
      where: { id: transcriptId },
      data: { aiSummary: summary.summary },
    });

    // Cache the summary
    try {
      await redisHelpers.setJson(cacheKey, summary, CacheTTL.transcript);
      logger.debug(`AI summary cached for transcript: ${transcriptId}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    // Invalidate related caches
    await this.invalidateCache(transcript.symbol, transcriptId);

    return summary;
  }

  /**
   * Extract key statements from a transcript
   * 
   * Implements Requirement 14.6: Highlight key statements and commitments from management
   * 
   * @param transcriptId - Transcript ID
   * @returns Array of key statements with highlighting
   */
  async extractKeyStatements(transcriptId: string): Promise<KeyStatement[]> {
    // Get the transcript with full content
    const transcript = await this.getTranscriptById(transcriptId);
    
    if (!transcript) {
      throw new Error(`Transcript not found: ${transcriptId}`);
    }

    // Check cache first
    const cacheKey = CacheKeys.transcript.keyStatements(transcriptId);
    try {
      const cachedStatements = await redisHelpers.getJson<KeyStatement[]>(cacheKey);
      if (cachedStatements) {
        logger.debug(`Key statements cache hit for transcript: ${transcriptId}`);
        return cachedStatements;
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Extract key statements using AI or fallback
    const openaiApiKey = process.env.OPENAI_API_KEY;
    let keyStatements: KeyStatement[];

    if (openaiApiKey) {
      keyStatements = await this.callOpenAIForKeyStatements(transcript, openaiApiKey);
    } else {
      keyStatements = this.extractFallbackKeyStatements(transcript);
    }

    // Cache the key statements
    try {
      await redisHelpers.setJson(cacheKey, keyStatements, CacheTTL.transcript);
      logger.debug(`Key statements cached for transcript: ${transcriptId}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return keyStatements;
  }

  /**
   * Get transcript with AI analysis (summary and key statements)
   * 
   * Implements Requirements 14.5, 14.6
   * 
   * @param transcriptId - Transcript ID
   * @returns Transcript with AI analysis
   */
  async getTranscriptWithAnalysis(transcriptId: string): Promise<TranscriptWithAnalysis | null> {
    const transcript = await this.getTranscriptById(transcriptId);
    
    if (!transcript) {
      return null;
    }

    // Get AI analysis in parallel
    const [summary, keyStatements] = await Promise.all([
      this.generateAISummary(transcriptId).catch((error) => {
        logger.warn(`Failed to generate AI summary: ${error.message}`);
        return null;
      }),
      this.extractKeyStatements(transcriptId).catch((error) => {
        logger.warn(`Failed to extract key statements: ${error.message}`);
        return [];
      }),
    ]);

    const result: TranscriptWithAnalysis = {
      ...transcript,
    };

    if (summary || keyStatements.length > 0) {
      result.aiAnalysis = {
        summary: summary || this.generateFallbackSummary(transcript),
        keyStatements,
      };
    }

    return result;
  }

  /**
   * Call OpenAI API to generate transcript summary
   * 
   * @param transcript - Transcript data
   * @param apiKey - OpenAI API key
   * @returns AI-generated summary
   */
  private async callOpenAIForSummary(
    transcript: Transcript,
    apiKey: string
  ): Promise<TranscriptAISummary> {
    const openaiEndpoint = 'https://api.openai.com/v1/chat/completions';

    // Prepare transcript content for AI
    const preparedRemarks = transcript.sections
      .filter((s) => s.type === 'prepared_remarks')
      .map((s) => `${s.speaker}: ${s.content}`)
      .join('\n\n');

    const qaSection = transcript.sections
      .filter((s) => s.type === 'qa')
      .map((s) => `${s.speaker}: ${s.content}`)
      .join('\n\n');

    const prompt = `Analyze the following earnings call transcript for ${transcript.symbol} (${transcript.stockName || 'Unknown Company'}) for ${transcript.quarter}.

PREPARED REMARKS:
${preparedRemarks.substring(0, 4000)}

Q&A SESSION:
${qaSection.substring(0, 4000)}

Provide a comprehensive summary in the following JSON format:
{
  "summary": "A concise 2-3 paragraph summary of the key points from the earnings call",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3", "Key point 4", "Key point 5"],
  "sentiment": "positive" | "negative" | "neutral",
  "confidence": 0.0 to 1.0
}

Focus on:
- Financial performance highlights
- Business outlook and guidance
- Strategic initiatives
- Key challenges or risks mentioned
- Management's tone and confidence`;

    try {
      const response = await fetch(openaiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a financial analyst expert at summarizing earnings call transcripts. Provide accurate, concise summaries that highlight the most important information for investors.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { choices: Array<{ message: { content: string } }> };
      const aiContent = data.choices[0].message.content;
      const parsed = JSON.parse(aiContent);

      return {
        transcriptId: transcript.id,
        summary: parsed.summary,
        keyPoints: parsed.keyPoints,
        sentiment: parsed.sentiment,
        confidence: parsed.confidence,
        generatedAt: new Date(),
      };
    } catch (error) {
      logger.error('OpenAI API call failed for transcript summary:', error);
      // Fall back to rule-based summary
      return this.generateFallbackSummary(transcript);
    }
  }

  /**
   * Call OpenAI API to extract key statements
   * 
   * @param transcript - Transcript data
   * @param apiKey - OpenAI API key
   * @returns Array of key statements
   */
  private async callOpenAIForKeyStatements(
    transcript: Transcript,
    apiKey: string
  ): Promise<KeyStatement[]> {
    const openaiEndpoint = 'https://api.openai.com/v1/chat/completions';

    // Get participant titles for context
    const participantTitles = new Map<string, string>();
    transcript.participants.forEach((p) => {
      participantTitles.set(p.name.toLowerCase(), p.title || 'Unknown');
    });

    // Prepare sections content
    const sectionsContent = transcript.sections
      .map((s, idx) => `[Section ${idx + 1}] ${s.speaker}: ${s.content}`)
      .join('\n\n');

    const prompt = `Analyze the following earnings call transcript and identify key statements from management.

TRANSCRIPT:
${sectionsContent.substring(0, 6000)}

PARTICIPANTS:
${transcript.participants.map((p) => `- ${p.name}: ${p.title || 'Unknown'}`).join('\n')}

Identify the most important statements and return them in the following JSON format:
{
  "keyStatements": [
    {
      "sectionIndex": 1,
      "speaker": "Speaker Name",
      "content": "The full statement",
      "type": "guidance" | "commitment" | "strategy" | "risk" | "highlight",
      "importance": "high" | "medium" | "low",
      "highlightedText": "The key phrase to highlight within the statement"
    }
  ]
}

Focus on:
- Forward guidance and projections (type: "guidance")
- Commitments and promises (type: "commitment")
- Strategic initiatives and plans (type: "strategy")
- Risk factors and challenges (type: "risk")
- Other important highlights (type: "highlight")

Limit to the 10 most important statements.`;

    try {
      const response = await fetch(openaiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a financial analyst expert at identifying key statements in earnings call transcripts. Focus on statements that would be most relevant to investors.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { choices: Array<{ message: { content: string } }> };
      const aiContent = data.choices[0].message.content;
      const parsed = JSON.parse(aiContent);

      // Map AI response to KeyStatement format
      return (parsed.keyStatements || []).map((stmt: {
        sectionIndex: number;
        speaker: string;
        content: string;
        type: string;
        importance: string;
        highlightedText: string;
      }, idx: number) => {
        const sectionIndex = stmt.sectionIndex - 1;
        const section = transcript.sections[sectionIndex] || transcript.sections[0];
        
        return {
          id: `ks-${transcript.id}-${idx}`,
          sectionId: section?.id || '',
          speaker: stmt.speaker,
          speakerTitle: participantTitles.get(stmt.speaker.toLowerCase()) || null,
          content: stmt.content,
          type: stmt.type as KeyStatement['type'],
          importance: stmt.importance as KeyStatement['importance'],
          highlightedText: stmt.highlightedText,
        };
      });
    } catch (error) {
      logger.error('OpenAI API call failed for key statements:', error);
      // Fall back to rule-based extraction
      return this.extractFallbackKeyStatements(transcript);
    }
  }

  /**
   * Generate fallback summary when AI is not available
   * 
   * @param transcript - Transcript data
   * @returns Fallback summary
   */
  private generateFallbackSummary(transcript: Transcript): TranscriptAISummary {
    // Extract key information from sections
    const allContent = transcript.sections.map((s) => s.content).join(' ');

    // Simple sentiment analysis based on keywords
    const positiveKeywords = ['growth', 'increase', 'strong', 'exceed', 'beat', 'positive', 'record', 'success'];
    const negativeKeywords = ['decline', 'decrease', 'weak', 'miss', 'challenge', 'concern', 'risk', 'loss'];

    const lowerContent = allContent.toLowerCase();
    const positiveCount = positiveKeywords.filter((kw) => lowerContent.includes(kw)).length;
    const negativeCount = negativeKeywords.filter((kw) => lowerContent.includes(kw)).length;

    let sentiment: 'positive' | 'negative' | 'neutral';
    if (positiveCount > negativeCount + 2) {
      sentiment = 'positive';
    } else if (negativeCount > positiveCount + 2) {
      sentiment = 'negative';
    } else {
      sentiment = 'neutral';
    }

    // Generate summary from prepared remarks
    const preparedRemarks = transcript.sections
      .filter((s) => s.type === 'prepared_remarks')
      .map((s) => s.content)
      .join(' ');

    const summaryText = preparedRemarks.length > 500
      ? preparedRemarks.substring(0, 500) + '...'
      : preparedRemarks || 'No prepared remarks available.';

    // Extract key points from section content
    const keyPoints: string[] = [];
    const sentences = allContent.split(/[.!?]+/).filter((s) => s.trim().length > 20);
    
    // Find sentences with important keywords
    const importantKeywords = ['revenue', 'earnings', 'guidance', 'outlook', 'growth', 'margin', 'strategy'];
    for (const sentence of sentences) {
      if (keyPoints.length >= 5) break;
      const lowerSentence = sentence.toLowerCase();
      if (importantKeywords.some((kw) => lowerSentence.includes(kw))) {
        keyPoints.push(sentence.trim().substring(0, 200));
      }
    }

    // Fill remaining key points if needed
    while (keyPoints.length < 3 && sentences.length > keyPoints.length) {
      const sentence = sentences[keyPoints.length];
      if (sentence && !keyPoints.includes(sentence.trim())) {
        keyPoints.push(sentence.trim().substring(0, 200));
      }
    }

    return {
      transcriptId: transcript.id,
      summary: `${transcript.stockName || transcript.symbol} ${transcript.quarter} earnings call transcript. ${summaryText}`,
      keyPoints: keyPoints.length > 0 ? keyPoints : ['No key points extracted. Please review the full transcript.'],
      sentiment,
      confidence: 0.5, // Lower confidence for fallback
      generatedAt: new Date(),
    };
  }

  /**
   * Extract key statements using rule-based approach when AI is not available
   * 
   * @param transcript - Transcript data
   * @returns Array of key statements
   */
  private extractFallbackKeyStatements(transcript: Transcript): KeyStatement[] {
    const keyStatements: KeyStatement[] = [];
    
    // Get participant titles for context
    const participantTitles = new Map<string, string>();
    transcript.participants.forEach((p) => {
      participantTitles.set(p.name.toLowerCase(), p.title || 'Unknown');
    });

    // Keywords for different statement types
    const guidanceKeywords = ['expect', 'guidance', 'outlook', 'forecast', 'project', 'anticipate', 'target'];
    const commitmentKeywords = ['commit', 'promise', 'will', 'plan to', 'intend', 'going to'];
    const strategyKeywords = ['strategy', 'initiative', 'focus', 'priority', 'invest', 'expand'];
    const riskKeywords = ['risk', 'challenge', 'concern', 'headwind', 'uncertainty', 'difficult'];

    // Process each section
    for (const section of transcript.sections) {
      const sentences = section.content.split(/[.!?]+/).filter((s) => s.trim().length > 30);
      
      for (const sentence of sentences) {
        if (keyStatements.length >= 10) break;
        
        const lowerSentence = sentence.toLowerCase();
        let type: KeyStatement['type'] | null = null;
        let importance: KeyStatement['importance'] = 'medium';
        let highlightedText = '';

        // Check for guidance statements
        for (const kw of guidanceKeywords) {
          if (lowerSentence.includes(kw)) {
            type = 'guidance';
            importance = 'high';
            highlightedText = this.extractHighlightPhrase(sentence, kw);
            break;
          }
        }

        // Check for commitment statements
        if (!type) {
          for (const kw of commitmentKeywords) {
            if (lowerSentence.includes(kw)) {
              type = 'commitment';
              importance = 'high';
              highlightedText = this.extractHighlightPhrase(sentence, kw);
              break;
            }
          }
        }

        // Check for strategy statements
        if (!type) {
          for (const kw of strategyKeywords) {
            if (lowerSentence.includes(kw)) {
              type = 'strategy';
              importance = 'medium';
              highlightedText = this.extractHighlightPhrase(sentence, kw);
              break;
            }
          }
        }

        // Check for risk statements
        if (!type) {
          for (const kw of riskKeywords) {
            if (lowerSentence.includes(kw)) {
              type = 'risk';
              importance = 'medium';
              highlightedText = this.extractHighlightPhrase(sentence, kw);
              break;
            }
          }
        }

        // Add statement if type was identified
        if (type) {
          keyStatements.push({
            id: `ks-${transcript.id}-${keyStatements.length}`,
            sectionId: section.id,
            speaker: section.speaker,
            speakerTitle: participantTitles.get(section.speaker.toLowerCase()) || null,
            content: sentence.trim(),
            type,
            importance,
            highlightedText: highlightedText || sentence.trim().substring(0, 50),
          });
        }
      }
    }

    return keyStatements;
  }

  /**
   * Extract a highlight phrase around a keyword
   * 
   * @param sentence - Full sentence
   * @param keyword - Keyword to highlight around
   * @returns Highlighted phrase
   */
  private extractHighlightPhrase(sentence: string, keyword: string): string {
    const lowerSentence = sentence.toLowerCase();
    const index = lowerSentence.indexOf(keyword);
    
    if (index === -1) {
      return sentence.substring(0, 50);
    }

    // Extract phrase around the keyword
    const start = Math.max(0, index - 20);
    const end = Math.min(sentence.length, index + keyword.length + 30);
    
    let phrase = sentence.substring(start, end).trim();
    if (start > 0) phrase = '...' + phrase;
    if (end < sentence.length) phrase = phrase + '...';
    
    return phrase;
  }
}

// Export singleton instance
export const transcriptService = new TranscriptService();
