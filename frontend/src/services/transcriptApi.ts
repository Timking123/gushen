import api from './api'
import type {
  Transcript,
  TranscriptListItem,
  TranscriptWithAnalysis,
  TranscriptAISummary,
  KeyStatement,
  TranscriptSearchResult,
  TranscriptEventType,
} from '../types'

/**
 * Transcript filters for API requests
 */
export interface TranscriptFilters {
  symbol?: string
  symbols?: string[]
  eventTypes?: TranscriptEventType[]
  startDate?: string
  endDate?: string
  quarter?: string
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number
  limit?: number
}

/**
 * Paginated transcripts response
 */
export interface TranscriptsResponse {
  transcripts: TranscriptListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * Transcript search response
 */
export interface TranscriptSearchResponse {
  results: TranscriptSearchResult[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  keyword: string
}

/**
 * Get transcripts with optional filters
 * Implements Requirement 14.1: Provide access to earnings call transcripts
 */
export async function getTranscripts(
  filters?: TranscriptFilters,
  pagination?: PaginationOptions
): Promise<TranscriptsResponse> {
  const params = new URLSearchParams()

  if (filters?.symbol) {
    params.append('symbol', filters.symbol)
  }
  if (filters?.symbols?.length) {
    params.append('symbols', filters.symbols.join(','))
  }
  if (filters?.eventTypes?.length) {
    params.append('eventTypes', filters.eventTypes.join(','))
  }
  if (filters?.startDate) {
    params.append('startDate', filters.startDate)
  }
  if (filters?.endDate) {
    params.append('endDate', filters.endDate)
  }
  if (filters?.quarter) {
    params.append('quarter', filters.quarter)
  }
  if (pagination?.page) {
    params.append('page', pagination.page.toString())
  }
  if (pagination?.limit) {
    params.append('limit', pagination.limit.toString())
  }

  const queryString = params.toString()
  const url = queryString ? `/transcripts?${queryString}` : '/transcripts'

  const response = await api.get(url)
  return response.data.data
}

/**
 * Get transcripts for a specific stock
 * Implements Requirement 14.1: Display recent earnings call transcript list
 */
export async function getTranscriptsBySymbol(
  symbol: string,
  limit: number = 10
): Promise<TranscriptListItem[]> {
  const response = await api.get(`/transcripts/stock/${symbol}?limit=${limit}`)
  return response.data.data.transcripts
}

/**
 * Get the latest transcript for a stock
 */
export async function getLatestTranscript(symbol: string): Promise<Transcript> {
  const response = await api.get(`/transcripts/stock/${symbol}/latest`)
  return response.data.data
}

/**
 * Get recent transcripts across all stocks
 */
export async function getRecentTranscripts(
  limit: number = 20
): Promise<TranscriptListItem[]> {
  const response = await api.get(`/transcripts/recent?limit=${limit}`)
  return response.data.data.transcripts
}

/**
 * Get a single transcript by ID with full content
 * Implements Requirement 14.2: Provide complete Q&A transcript
 */
export async function getTranscriptById(id: string): Promise<Transcript> {
  const response = await api.get(`/transcripts/${id}`)
  return response.data.data
}

/**
 * Get transcript with AI analysis (summary and key statements)
 * Implements Requirements 14.5, 14.6
 */
export async function getTranscriptWithAnalysis(
  id: string
): Promise<TranscriptWithAnalysis> {
  const response = await api.get(`/transcripts/${id}/analysis`)
  return response.data.data
}

/**
 * Generate AI summary for a transcript
 * Implements Requirement 14.5: Provide AI-generated meeting summary
 */
export async function generateAISummary(id: string): Promise<TranscriptAISummary> {
  const response = await api.post(`/transcripts/${id}/summary`)
  return response.data.data
}

/**
 * Get key statements from a transcript
 * Implements Requirement 14.6: Highlight key statements from management
 */
export async function getKeyStatements(id: string): Promise<KeyStatement[]> {
  const response = await api.get(`/transcripts/${id}/key-statements`)
  return response.data.data.keyStatements
}

/**
 * Search transcripts by keyword
 * Implements Requirement 14.3: Support keyword search in transcript content
 */
export async function searchTranscripts(
  keyword: string,
  filters?: TranscriptFilters,
  pagination?: PaginationOptions
): Promise<TranscriptSearchResponse> {
  const params = new URLSearchParams()
  params.append('keyword', keyword)

  if (filters?.symbol) {
    params.append('symbol', filters.symbol)
  }
  if (filters?.symbols?.length) {
    params.append('symbols', filters.symbols.join(','))
  }
  if (filters?.eventTypes?.length) {
    params.append('eventTypes', filters.eventTypes.join(','))
  }
  if (filters?.startDate) {
    params.append('startDate', filters.startDate)
  }
  if (filters?.endDate) {
    params.append('endDate', filters.endDate)
  }
  if (pagination?.page) {
    params.append('page', pagination.page.toString())
  }
  if (pagination?.limit) {
    params.append('limit', pagination.limit.toString())
  }

  const response = await api.get(`/transcripts/search?${params.toString()}`)
  return response.data.data
}

export default {
  getTranscripts,
  getTranscriptsBySymbol,
  getLatestTranscript,
  getRecentTranscripts,
  getTranscriptById,
  getTranscriptWithAnalysis,
  generateAISummary,
  getKeyStatements,
  searchTranscripts,
}
