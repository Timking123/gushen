import { api } from './api'
import type { ImpactAnalysis, ApiResponse } from '../types'

/**
 * Summary response from AI
 */
export interface SummaryResponse {
  summary: string
  keyThemes: string[]
  overallSentiment: 'positive' | 'negative' | 'neutral'
}

/**
 * Stock comparison response
 */
export interface ComparisonReport {
  symbols: string[]
  summary: string
  strengths: Record<string, string[]>
  weaknesses: Record<string, string[]>
  recommendation: string
  generatedAt: Date
}

/**
 * AI chat response
 */
export interface AIResponse {
  message: string
  action?: {
    type: 'add_watchlist' | 'remove_watchlist' | 'search_stock' | 'get_summary'
    params: Record<string, unknown>
  }
  confidence: number
}

/**
 * Chat context
 */
export interface ChatContext {
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  userPreferences?: string[]
  watchlist?: string[]
}

/**
 * Analysis API Service
 * Handles intelligent analysis operations
 * Implements Requirements 3.1, 3.2, 3.3, 3.4, 9.1, 9.2
 */
export const analysisApi = {
  /**
   * Analyze news impact on stock price
   * Implements Requirements 3.1, 3.2
   *
   * @param newsId - ID of the news item to analyze
   * @returns Impact analysis result
   */
  async analyzeNewsImpact(newsId: string): Promise<ImpactAnalysis> {
    const response = await api.post<ApiResponse<ImpactAnalysis>>(`/analysis/impact/${newsId}`)

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.message || 'Failed to analyze news impact')
    }

    return response.data.data
  },

  /**
   * Summarize multiple news items
   * Implements Requirement 3.3
   *
   * @param newsIds - Array of news IDs to summarize
   * @returns Summary response
   */
  async summarizeNews(newsIds: string[]): Promise<SummaryResponse> {
    const response = await api.post<ApiResponse<SummaryResponse>>('/analysis/summarize', {
      newsIds,
    })

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.message || 'Failed to summarize news')
    }

    return response.data.data
  },

  /**
   * Compare multiple stocks
   * Implements Requirements 3.4, 9.5
   *
   * @param symbols - Array of stock symbols to compare
   * @returns Comparison report
   */
  async compareStocks(symbols: string[]): Promise<ComparisonReport> {
    const response = await api.post<ApiResponse<ComparisonReport>>('/analysis/compare', { symbols })

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.message || 'Failed to compare stocks')
    }

    return response.data.data
  },

  /**
   * AI assistant chat interface
   * Implements Requirements 9.1, 9.2
   *
   * @param message - User message
   * @param context - Chat context
   * @returns AI response
   */
  async chat(message: string, context?: ChatContext): Promise<AIResponse> {
    const response = await api.post<ApiResponse<AIResponse>>('/analysis/chat', { message, context })

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.message || 'Failed to process chat message')
    }

    return response.data.data
  },
}
