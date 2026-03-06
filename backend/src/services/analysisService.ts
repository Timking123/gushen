import { prisma } from '../lib/prisma.js';
import { logger } from '../utils/logger.js';
import type { ImpactAnalysis } from './newsService.js';

/**
 * AI response for news impact analysis
 */
interface AIImpactResponse {
  direction: 'bullish' | 'bearish' | 'neutral';
  magnitude: 'high' | 'medium' | 'low';
  confidence: number;
  summary: string;
  keyPoints: string[];
  historicalComparison?: string;
}

/**
 * Summary response from AI
 */
interface SummaryResponse {
  summary: string;
  keyThemes: string[];
  overallSentiment: 'positive' | 'negative' | 'neutral';
}

/**
 * Stock comparison response from AI
 */
interface ComparisonReport {
  symbols: string[];
  summary: string;
  strengths: Record<string, string[]>;
  weaknesses: Record<string, string[]>;
  recommendation: string;
  generatedAt: Date;
}

/**
 * Chat context for AI assistant
 */
export interface ChatContext {
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  userPreferences?: string[];
  watchlist?: string[];
}

/**
 * AI response for chat
 */
export interface AIResponse {
  message: string;
  action?: {
    type: 'add_watchlist' | 'remove_watchlist' | 'search_stock' | 'get_summary';
    params: Record<string, unknown>;
  };
  confidence: number;
}

/**
 * Low confidence threshold for marking analysis
 * Implements Requirement 3.6
 */
const LOW_CONFIDENCE_THRESHOLD = 0.6;

/**
 * AnalysisService - Handles intelligent analysis using AI
 * Implements Requirements 3.1, 3.2, 3.3, 3.4, 3.6 (Intelligent information analysis)
 * Implements Requirements 9.1, 9.2, 9.4, 9.5 (AI assistant functionality)
 */
export class AnalysisService {
  private readonly openaiApiKey: string | undefined;
  private readonly openaiEndpoint = 'https://api.openai.com/v1/chat/completions';

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    if (!this.openaiApiKey) {
      logger.warn('OPENAI_API_KEY not configured - AI analysis features will use fallback logic');
    }
  }

  /**
   * Analyze news impact on stock price
   * Implements Requirements 3.1, 3.2: Analyze news impact with direction and magnitude
   * Implements Requirement 3.6: Mark low confidence analysis
   * 
   * @param newsId - ID of the news item to analyze
   * @returns Impact analysis result
   */
  async analyzeNewsImpact(newsId: string): Promise<ImpactAnalysis> {
    // Get news item
    const newsItem = await prisma.newsItem.findUnique({
      where: { id: newsId },
      include: {
        stocks: { select: { symbol: true } },
      },
    });

    if (!newsItem) {
      throw new Error(`News item not found: ${newsId}`);
    }

    // Check if analysis already exists
    const existingAnalysis = await prisma.impactAnalysis.findUnique({
      where: { newsId },
    });

    if (existingAnalysis) {
      logger.info(`Impact analysis already exists for news: ${newsId}`);
      return this.transformImpactAnalysis(existingAnalysis);
    }

    // Perform AI analysis
    let aiResponse: AIImpactResponse;
    
    if (this.openaiApiKey) {
      aiResponse = await this.callOpenAIForImpact(newsItem);
    } else {
      // Fallback to rule-based analysis
      aiResponse = this.fallbackImpactAnalysis(newsItem);
    }

    // Validate analysis completeness (Property 7)
    this.validateImpactAnalysis(aiResponse);

    // Check if confidence is low (Property 8)
    const isLowConfidence = aiResponse.confidence < LOW_CONFIDENCE_THRESHOLD;
    if (isLowConfidence) {
      logger.info(`Low confidence analysis for news: ${newsId} (confidence: ${aiResponse.confidence})`);
    }

    // Save analysis to database
    const analysis = await prisma.impactAnalysis.create({
      data: {
        newsId,
        direction: aiResponse.direction,
        magnitude: aiResponse.magnitude,
        confidence: aiResponse.confidence,
        summary: aiResponse.summary,
        keyPoints: aiResponse.keyPoints,
        historicalComparison: aiResponse.historicalComparison || null,
        analyzedAt: new Date(),
      },
    });

    logger.info(`Created impact analysis for news: ${newsId}`);
    return this.transformImpactAnalysis(analysis);
  }

  /**
   * Validate impact analysis completeness
   * Implements Property 7: Impact analysis completeness property
   * 
   * @param analysis - AI impact response
   * @throws Error if analysis is incomplete
   */
  private validateImpactAnalysis(analysis: AIImpactResponse): void {
    // Check direction is valid
    if (!['bullish', 'bearish', 'neutral'].includes(analysis.direction)) {
      throw new Error(`Invalid impact direction: ${analysis.direction}`);
    }

    // Check magnitude is valid
    if (!['high', 'medium', 'low'].includes(analysis.magnitude)) {
      throw new Error(`Invalid impact magnitude: ${analysis.magnitude}`);
    }

    // Check confidence is between 0 and 1
    if (analysis.confidence < 0 || analysis.confidence > 1) {
      throw new Error(`Invalid confidence value: ${analysis.confidence}`);
    }

    // Check summary exists
    if (!analysis.summary || analysis.summary.trim().length === 0) {
      throw new Error('Impact analysis summary is required');
    }

    // Check key points exist
    if (!analysis.keyPoints || analysis.keyPoints.length === 0) {
      throw new Error('Impact analysis must have at least one key point');
    }
  }

  /**
   * Call OpenAI API for impact analysis
   * 
   * @param newsItem - News item to analyze
   * @returns AI impact response
   */
  private async callOpenAIForImpact(newsItem: {
    title: string;
    summary: string | null;
    content: string | null;
    stocks: { symbol: string }[];
  }): Promise<AIImpactResponse> {
    const symbols = newsItem.stocks.map(s => s.symbol).join(', ');
    const content = newsItem.content || newsItem.summary || newsItem.title;

    const prompt = `Analyze the following news article and determine its potential impact on stock price(s): ${symbols}

News Title: ${newsItem.title}
News Content: ${content}

Provide your analysis in the following JSON format:
{
  "direction": "bullish" | "bearish" | "neutral",
  "magnitude": "high" | "medium" | "low",
  "confidence": 0.0 to 1.0,
  "summary": "Brief summary of the impact",
  "keyPoints": ["Key point 1", "Key point 2", ...],
  "historicalComparison": "Optional comparison to similar historical events"
}`;

    try {
      const response = await fetch(this.openaiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a financial analyst expert at analyzing news impact on stock prices.',
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

      return parsed as AIImpactResponse;
    } catch (error) {
      logger.error('OpenAI API call failed:', error);
      throw new Error('Failed to analyze news impact with AI');
    }
  }

  /**
   * Fallback rule-based impact analysis when AI is not available
   * 
   * @param newsItem - News item to analyze
   * @returns Impact response
   */
  private fallbackImpactAnalysis(newsItem: {
    title: string;
    summary: string | null;
    sourceCredibility: string;
  }): AIImpactResponse {
    const text = `${newsItem.title} ${newsItem.summary || ''}`.toLowerCase();

    // Simple keyword-based analysis
    const bullishKeywords = ['profit', 'growth', 'beat', 'exceed', 'positive', 'upgrade', 'buy', 'strong'];
    const bearishKeywords = ['loss', 'decline', 'miss', 'negative', 'downgrade', 'sell', 'weak', 'concern'];

    const bullishCount = bullishKeywords.filter(kw => text.includes(kw)).length;
    const bearishCount = bearishKeywords.filter(kw => text.includes(kw)).length;

    let direction: 'bullish' | 'bearish' | 'neutral';
    let magnitude: 'high' | 'medium' | 'low';
    let confidence: number;

    if (bullishCount > bearishCount) {
      direction = 'bullish';
      magnitude = bullishCount >= 3 ? 'high' : bullishCount >= 2 ? 'medium' : 'low';
      confidence = Math.min(0.5 + (bullishCount * 0.1), 0.8);
    } else if (bearishCount > bullishCount) {
      direction = 'bearish';
      magnitude = bearishCount >= 3 ? 'high' : bearishCount >= 2 ? 'medium' : 'low';
      confidence = Math.min(0.5 + (bearishCount * 0.1), 0.8);
    } else {
      direction = 'neutral';
      magnitude = 'low';
      confidence = 0.4;
    }

    // Adjust confidence based on source credibility
    if (newsItem.sourceCredibility === 'high') {
      confidence = Math.min(confidence + 0.1, 0.9);
    } else if (newsItem.sourceCredibility === 'low') {
      confidence = Math.max(confidence - 0.1, 0.2);
    }

    return {
      direction,
      magnitude,
      confidence,
      summary: `Rule-based analysis indicates ${direction} sentiment with ${magnitude} magnitude.`,
      keyPoints: [
        `Detected ${direction} keywords in news content`,
        `Source credibility: ${newsItem.sourceCredibility}`,
      ],
      historicalComparison: undefined,
    };
  }

  /**
   * Summarize multiple news items
   * Implements Requirement 3.3: Summarize multiple related news
   * 
   * @param newsIds - Array of news IDs to summarize
   * @returns Summary response
   */
  async summarizeNews(newsIds: string[]): Promise<SummaryResponse> {
    if (newsIds.length === 0) {
      throw new Error('At least one news ID is required for summarization');
    }

    // Get news items
    const newsItems = await prisma.newsItem.findMany({
      where: {
        id: { in: newsIds },
      },
      include: {
        stocks: { select: { symbol: true } },
        impactAnalysis: true,
      },
    });

    if (newsItems.length === 0) {
      throw new Error('No news items found for the provided IDs');
    }

    if (this.openaiApiKey) {
      return await this.callOpenAIForSummary(newsItems);
    } else {
      return this.fallbackSummary(newsItems);
    }
  }

  /**
   * Call OpenAI API for news summarization
   * 
   * @param newsItems - News items to summarize
   * @returns Summary response
   */
  private async callOpenAIForSummary(newsItems: Array<{
    title: string;
    summary: string | null;
    impactAnalysis: { direction: string } | null;
  }>): Promise<SummaryResponse> {
    const newsText = newsItems.map((item, idx) => 
      `${idx + 1}. ${item.title}${item.summary ? ': ' + item.summary : ''}`
    ).join('\n');

    const prompt = `Summarize the following news articles and identify key themes:

${newsText}

Provide your summary in the following JSON format:
{
  "summary": "Comprehensive summary of all news",
  "keyThemes": ["Theme 1", "Theme 2", ...],
  "overallSentiment": "positive" | "negative" | "neutral"
}`;

    try {
      const response = await fetch(this.openaiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a financial news analyst expert at summarizing market news.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.5,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json() as { choices: Array<{ message: { content: string } }> };
      const aiContent = data.choices[0].message.content;
      return JSON.parse(aiContent) as SummaryResponse;
    } catch (error) {
      logger.error('OpenAI API call failed for summary:', error);
      throw new Error('Failed to summarize news with AI');
    }
  }

  /**
   * Fallback summary when AI is not available
   * 
   * @param newsItems - News items to summarize
   * @returns Summary response
   */
  private fallbackSummary(newsItems: Array<{
    title: string;
    impactAnalysis: { direction: string } | null;
  }>): SummaryResponse {
    const bullishCount = newsItems.filter(n => n.impactAnalysis?.direction === 'bullish').length;
    const bearishCount = newsItems.filter(n => n.impactAnalysis?.direction === 'bearish').length;

    let overallSentiment: 'positive' | 'negative' | 'neutral';
    if (bullishCount > bearishCount) {
      overallSentiment = 'positive';
    } else if (bearishCount > bullishCount) {
      overallSentiment = 'negative';
    } else {
      overallSentiment = 'neutral';
    }

    return {
      summary: `Summary of ${newsItems.length} news items. Overall sentiment: ${overallSentiment}.`,
      keyThemes: newsItems.slice(0, 3).map(n => n.title),
      overallSentiment,
    };
  }

  /**
   * Compare multiple stocks
   * Implements Requirement 3.4, 9.5: Generate stock comparison analysis
   * 
   * @param symbols - Array of stock symbols to compare
   * @returns Comparison report
   */
  async compareStocks(symbols: string[]): Promise<ComparisonReport> {
    if (symbols.length < 2) {
      throw new Error('At least two stock symbols are required for comparison');
    }

    const normalizedSymbols = symbols.map(s => s.trim().toUpperCase());

    // Get recent news for each stock
    const newsPromises = normalizedSymbols.map(symbol =>
      prisma.newsItem.findMany({
        where: {
          stocks: { some: { symbol } },
        },
        include: {
          impactAnalysis: true,
        },
        orderBy: { publishedAt: 'desc' },
        take: 5,
      })
    );

    const newsResults = await Promise.all(newsPromises);

    if (this.openaiApiKey) {
      return await this.callOpenAIForComparison(normalizedSymbols, newsResults);
    } else {
      return this.fallbackComparison(normalizedSymbols, newsResults);
    }
  }

  /**
   * Call OpenAI API for stock comparison
   * 
   * @param symbols - Stock symbols
   * @param newsResults - Recent news for each stock
   * @returns Comparison report
   */
  private async callOpenAIForComparison(
    symbols: string[],
    newsResults: Array<Array<{ title: string; impactAnalysis: { direction: string; summary: string } | null }>>
  ): Promise<ComparisonReport> {
    const stockInfo = symbols.map((symbol, idx) => {
      const news = newsResults[idx];
      const newsText = news.map(n => `- ${n.title}`).join('\n');
      return `${symbol}:\nRecent News:\n${newsText || 'No recent news'}`;
    }).join('\n\n');

    const prompt = `Compare the following stocks based on their recent news and performance:

${stockInfo}

Provide your comparison in the following JSON format:
{
  "summary": "Overall comparison summary",
  "strengths": {
    "SYMBOL1": ["Strength 1", "Strength 2"],
    "SYMBOL2": ["Strength 1", "Strength 2"]
  },
  "weaknesses": {
    "SYMBOL1": ["Weakness 1", "Weakness 2"],
    "SYMBOL2": ["Weakness 1", "Weakness 2"]
  },
  "recommendation": "Investment recommendation based on comparison"
}`;

    try {
      const response = await fetch(this.openaiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a financial analyst expert at comparing stocks.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.5,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json() as { choices: Array<{ message: { content: string } }> };
      const aiContent = data.choices[0].message.content;
      const parsed = JSON.parse(aiContent);

      return {
        symbols,
        summary: parsed.summary,
        strengths: parsed.strengths,
        weaknesses: parsed.weaknesses,
        recommendation: parsed.recommendation,
        generatedAt: new Date(),
      };
    } catch (error) {
      logger.error('OpenAI API call failed for comparison:', error);
      throw new Error('Failed to compare stocks with AI');
    }
  }

  /**
   * Fallback comparison when AI is not available
   * 
   * @param symbols - Stock symbols
   * @param newsResults - Recent news for each stock
   * @returns Comparison report
   */
  private fallbackComparison(
    symbols: string[],
    newsResults: Array<Array<{ impactAnalysis: { direction: string } | null }>>
  ): ComparisonReport {
    const strengths: Record<string, string[]> = {};
    const weaknesses: Record<string, string[]> = {};

    symbols.forEach((symbol, idx) => {
      const news = newsResults[idx];
      const bullishCount = news.filter(n => n.impactAnalysis?.direction === 'bullish').length;
      const bearishCount = news.filter(n => n.impactAnalysis?.direction === 'bearish').length;

      strengths[symbol] = bullishCount > 0 
        ? [`${bullishCount} positive news items in recent period`]
        : ['No significant positive news'];

      weaknesses[symbol] = bearishCount > 0
        ? [`${bearishCount} negative news items in recent period`]
        : ['No significant negative news'];
    });

    return {
      symbols,
      summary: `Comparison of ${symbols.join(', ')} based on recent news sentiment.`,
      strengths,
      weaknesses,
      recommendation: 'Further analysis recommended. AI comparison not available.',
      generatedAt: new Date(),
    };
  }

  /**
   * AI chat interface for natural language interactions
   * Implements Requirements 9.1, 9.2: Natural language command processing
   * 
   * @param _userId - User ID (reserved for future use)
   * @param message - User message
   * @param context - Chat context
   * @returns AI response with optional action
   */
  async chat(_userId: string, message: string, context: ChatContext): Promise<AIResponse> {
    if (!this.openaiApiKey) {
      return {
        message: 'AI assistant is not available. Please configure OPENAI_API_KEY.',
        confidence: 0,
      };
    }

    // Build conversation history
    const messages = [
      {
        role: 'system' as const,
        content: `You are a helpful stock market assistant. You can help users:
- Add or remove stocks from their watchlist
- Search for stocks
- Summarize news and market information
- Answer questions about stocks

When the user wants to perform an action, respond with JSON containing:
{
  "message": "Your response to the user",
  "action": {
    "type": "add_watchlist" | "remove_watchlist" | "search_stock" | "get_summary",
    "params": { relevant parameters }
  },
  "confidence": 0.0 to 1.0
}

User's watchlist: ${context.watchlist?.join(', ') || 'empty'}
User's preferences: ${context.userPreferences?.join(', ') || 'none'}`,
      },
      ...(context.conversationHistory || []),
      {
        role: 'user' as const,
        content: message,
      },
    ];

    try {
      const response = await fetch(this.openaiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json() as { choices: Array<{ message: { content: string } }> };
      const aiContent = data.choices[0].message.content;

      // Try to parse as JSON first
      try {
        const parsed = JSON.parse(aiContent);
        return parsed as AIResponse;
      } catch {
        // If not JSON, return as plain message
        return {
          message: aiContent,
          confidence: 0.8,
        };
      }
    } catch (error) {
      logger.error('OpenAI API call failed for chat:', error);
      return {
        message: 'Sorry, I encountered an error processing your request.',
        confidence: 0,
      };
    }
  }

  /**
   * Transform database impact analysis to API response format
   * 
   * @param analysis - Database impact analysis
   * @returns Transformed impact analysis
   */
  private transformImpactAnalysis(analysis: {
    newsId: string;
    direction: string;
    magnitude: string;
    confidence: number;
    summary: string;
    keyPoints: string[];
    historicalComparison: string | null;
    analyzedAt: Date;
  }): ImpactAnalysis {
    return {
      newsId: analysis.newsId,
      direction: analysis.direction as 'bullish' | 'bearish' | 'neutral',
      magnitude: analysis.magnitude as 'high' | 'medium' | 'low',
      confidence: analysis.confidence,
      summary: analysis.summary,
      keyPoints: analysis.keyPoints,
      historicalComparison: analysis.historicalComparison,
      analyzedAt: analysis.analyzedAt,
    };
  }
}

// Export singleton instance
export const analysisService = new AnalysisService();

/**
 * SEC Filing Summary Response
 */
export interface SECFilingSummaryResponse {
  filingId: string;
  summary: string;
  keyDisclosures: string[];
  potentialImpact: {
    direction: 'bullish' | 'bearish' | 'neutral';
    magnitude: 'high' | 'medium' | 'low';
  };
  generatedAt: Date;
}

/**
 * SEC Filing Analysis Service
 * Implements Requirements 20.4, 20.6: AI summary and impact analysis for SEC filings
 */
export class SECFilingAnalysisService {
  private readonly openaiApiKey: string | undefined;
  private readonly openaiEndpoint = 'https://api.openai.com/v1/chat/completions';

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
  }

  /**
   * Generate AI summary for SEC filing
   * Implements Requirement 20.4: Provide intelligent summary for SEC filings
   * 
   * @param filingId - SEC filing ID
   * @param formType - Form type (10-K, 10-Q, 8-K, etc.)
   * @param url - URL to the filing
   * @param existingContent - Optional existing content/summary
   * @returns AI-generated summary
   */
  async generateSECFilingSummary(
    filingId: string,
    formType: string,
    url: string,
    existingContent?: string
  ): Promise<SECFilingSummaryResponse> {
    if (!this.openaiApiKey) {
      return this.fallbackSECFilingSummary(filingId, formType);
    }

    const prompt = this.buildSECFilingPrompt(formType, url, existingContent);

    try {
      const response = await fetch(this.openaiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a financial analyst expert at analyzing SEC filings and extracting key information.',
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
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json() as { choices: Array<{ message: { content: string } }> };
      const aiContent = data.choices[0].message.content;
      const parsed = JSON.parse(aiContent);

      return {
        filingId,
        summary: parsed.summary,
        keyDisclosures: parsed.keyDisclosures || [],
        potentialImpact: {
          direction: parsed.potentialImpact?.direction || 'neutral',
          magnitude: parsed.potentialImpact?.magnitude || 'low',
        },
        generatedAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to generate SEC filing summary:', error);
      return this.fallbackSECFilingSummary(filingId, formType);
    }
  }

  /**
   * Build prompt for SEC filing analysis
   */
  private buildSECFilingPrompt(formType: string, url: string, existingContent?: string): string {
    const formDescriptions: Record<string, string> = {
      '10-K': 'Annual report containing comprehensive financial information',
      '10-Q': 'Quarterly report with unaudited financial statements',
      '8-K': 'Current report for material events',
      '4': 'Statement of changes in beneficial ownership',
      'S-1': 'Registration statement for securities',
      'DEF 14A': 'Definitive proxy statement',
    };

    const formDescription = formDescriptions[formType] || 'SEC filing';

    return `Analyze the following SEC filing and provide a summary:

Form Type: ${formType} (${formDescription})
Filing URL: ${url}
${existingContent ? `\nExisting Content:\n${existingContent}` : ''}

Provide your analysis in the following JSON format:
{
  "summary": "Concise summary of the filing's key points (2-3 sentences)",
  "keyDisclosures": ["Key disclosure 1", "Key disclosure 2", ...],
  "potentialImpact": {
    "direction": "bullish" | "bearish" | "neutral",
    "magnitude": "high" | "medium" | "low"
  }
}`;
  }

  /**
   * Fallback summary when AI is not available
   */
  private fallbackSECFilingSummary(filingId: string, formType: string): SECFilingSummaryResponse {
    const summaries: Record<string, string> = {
      '10-K': 'Annual report filed with the SEC containing comprehensive financial information.',
      '10-Q': 'Quarterly report with unaudited financial statements and management discussion.',
      '8-K': 'Current report disclosing material events or corporate changes.',
      '4': 'Statement of changes in beneficial ownership by company insiders.',
      'S-1': 'Registration statement for initial public offering or securities registration.',
      'DEF 14A': 'Definitive proxy statement for shareholder meeting.',
    };

    return {
      filingId,
      summary: summaries[formType] || `SEC filing of type ${formType}.`,
      keyDisclosures: ['AI summary not available - please review the original document'],
      potentialImpact: {
        direction: 'neutral',
        magnitude: 'low',
      },
      generatedAt: new Date(),
    };
  }

  /**
   * Analyze impact of SEC filing disclosure
   * Implements Requirement 20.6: Analyze impact of major disclosures
   * 
   * @param formType - Form type
   * @param summary - Filing summary
   * @returns Impact analysis
   */
  analyzeDisclosureImpact(
    formType: string,
    summary: string
  ): { direction: 'bullish' | 'bearish' | 'neutral'; magnitude: 'high' | 'medium' | 'low' } {
    // High impact form types
    const highImpactForms = ['8-K', 'S-1'];
    const mediumImpactForms = ['10-K', '10-Q', 'DEF 14A'];

    // Keyword analysis
    const text = summary.toLowerCase();
    const bullishKeywords = ['growth', 'profit', 'increase', 'positive', 'beat', 'exceed', 'strong'];
    const bearishKeywords = ['loss', 'decline', 'decrease', 'negative', 'miss', 'weak', 'concern', 'risk'];

    const bullishCount = bullishKeywords.filter(kw => text.includes(kw)).length;
    const bearishCount = bearishKeywords.filter(kw => text.includes(kw)).length;

    let direction: 'bullish' | 'bearish' | 'neutral';
    if (bullishCount > bearishCount) {
      direction = 'bullish';
    } else if (bearishCount > bullishCount) {
      direction = 'bearish';
    } else {
      direction = 'neutral';
    }

    let magnitude: 'high' | 'medium' | 'low';
    if (highImpactForms.includes(formType)) {
      magnitude = 'high';
    } else if (mediumImpactForms.includes(formType)) {
      magnitude = 'medium';
    } else {
      magnitude = 'low';
    }

    return { direction, magnitude };
  }
}

// Export singleton instance
export const secFilingAnalysisService = new SECFilingAnalysisService();
