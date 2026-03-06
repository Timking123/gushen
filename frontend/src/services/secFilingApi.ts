import api from './api'

/**
 * SEC form types
 */
export type SECFormType = '10-K' | '10-Q' | '8-K' | '4' | 'S-1' | 'DEF 14A' | '13F' | 'SC 13G' | 'SC 13D' | 'Other'

/**
 * SEC filing interface
 * Implements Requirement 20.1: Display recent SEC filings
 */
export interface SECFiling {
  id: string
  symbol: string
  formType: SECFormType
  filedAt: string
  periodOfReport: string | null
  url: string
  summary: string | null
  createdAt: string
  stockName?: string
  sector?: string | null
}

/**
 * SEC filing filter options
 * Implements Requirement 20.5: Support filtering by form type and date range
 */
export interface SECFilingFilters {
  formTypes?: SECFormType[]
  startDate?: string
  endDate?: string
}

/**
 * Paginated response
 */
interface PaginatedResponse<T> {
  filings: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * API response wrapper
 */
interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

/**
 * Form type description
 */
export interface FormTypeDescription {
  formType: SECFormType
  description: string
}

/**
 * AI Summary response
 */
export interface SECFilingSummaryResponse {
  filingId: string
  summary: string
  keyDisclosures: string[]
  potentialImpact: {
    direction: 'bullish' | 'bearish' | 'neutral'
    magnitude: 'high' | 'medium' | 'low'
  }
  generatedAt: string
}

/**
 * SEC Filing API service
 * Implements Requirements:
 * - 20.1: Display recent SEC filings (10-K, 10-Q, 8-K, etc.)
 * - 20.3: Provide file summary and original link
 * - 20.5: Support filtering by form type and date range
 */
export const secFilingApi = {
  /**
   * Get SEC filings for a stock
   * @param symbol - Stock symbol
   * @param formTypes - Optional form types to filter
   * @param limit - Maximum number of results
   * @returns Array of SEC filings
   * 
   * Implements Requirement 20.1
   */
  async getFilingsBySymbol(
    symbol: string,
    formTypes?: SECFormType[],
    limit: number = 20
  ): Promise<SECFiling[]> {
    const params: Record<string, string | number> = { limit }
    if (formTypes && formTypes.length > 0) {
      params.formTypes = formTypes.join(',')
    }
    
    const response = await api.get<ApiResponse<SECFiling[]>>(
      `/sec-filings/${symbol}`,
      { params }
    )
    return response.data.data
  },

  /**
   * Get SEC filings with advanced filtering
   * @param symbol - Stock symbol
   * @param filters - Filter options
   * @param page - Page number
   * @param limit - Results per page
   * @returns Paginated SEC filings
   * 
   * Implements Requirement 20.5
   */
  async getFilingsWithFilter(
    symbol: string,
    filters: SECFilingFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<SECFiling>> {
    const params: Record<string, string | number> = { page, limit }
    
    if (filters.formTypes && filters.formTypes.length > 0) {
      params.formTypes = filters.formTypes.join(',')
    }
    if (filters.startDate) {
      params.startDate = filters.startDate
    }
    if (filters.endDate) {
      params.endDate = filters.endDate
    }
    
    const response = await api.get<ApiResponse<PaginatedResponse<SECFiling>>>(
      `/sec-filings/${symbol}/filter`,
      { params }
    )
    return response.data.data
  },

  /**
   * Get recent SEC filings across all stocks
   * @param formTypes - Optional form types to filter
   * @param limit - Maximum number of results
   * @returns Array of recent SEC filings
   */
  async getRecentFilings(
    formTypes?: SECFormType[],
    limit: number = 50
  ): Promise<SECFiling[]> {
    const params: Record<string, string | number> = { limit }
    if (formTypes && formTypes.length > 0) {
      params.formTypes = formTypes.join(',')
    }
    
    const response = await api.get<ApiResponse<SECFiling[]>>(
      '/sec-filings/recent',
      { params }
    )
    return response.data.data
  },

  /**
   * Get a specific SEC filing by ID
   * @param filingId - Filing ID
   * @returns SEC filing details
   * 
   * Implements Requirement 20.3
   */
  async getFilingById(filingId: string): Promise<SECFiling | null> {
    try {
      const response = await api.get<ApiResponse<SECFiling>>(
        `/sec-filings/detail/${filingId}`
      )
      return response.data.data
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } }
        if (axiosError.response?.status === 404) {
          return null
        }
      }
      throw error
    }
  },

  /**
   * Get form type descriptions
   * @returns Array of form type descriptions
   */
  async getFormTypeDescriptions(): Promise<FormTypeDescription[]> {
    const response = await api.get<ApiResponse<FormTypeDescription[]>>(
      '/sec-filings/form-types/descriptions'
    )
    return response.data.data
  },

  /**
   * Generate AI summary for SEC filing
   * @param filingId - Filing ID
   * @returns AI-generated summary
   * 
   * Implements Requirement 20.4
   */
  async generateAISummary(filingId: string): Promise<SECFilingSummaryResponse> {
    const response = await api.post<ApiResponse<SECFilingSummaryResponse>>(
      `/sec-filings/${filingId}/ai-summary`
    )
    return response.data.data
  },

  /**
   * Format form type for display
   * @param formType - SEC form type
   * @returns Formatted form type label
   */
  formatFormType(formType: SECFormType): string {
    const labels: Record<SECFormType, string> = {
      '10-K': '年度报告 (10-K)',
      '10-Q': '季度报告 (10-Q)',
      '8-K': '重大事件 (8-K)',
      '4': '内部交易 (Form 4)',
      'S-1': '注册声明 (S-1)',
      'DEF 14A': '委托书 (DEF 14A)',
      '13F': '机构持仓 (13F)',
      'SC 13G': '被动持仓 (SC 13G)',
      'SC 13D': '主动持仓 (SC 13D)',
      'Other': '其他',
    }
    return labels[formType] || formType
  },

  /**
   * Get form type badge color
   * @param formType - SEC form type
   * @returns CSS class for badge color
   */
  getFormTypeBadgeClass(formType: SECFormType): string {
    const classes: Record<SECFormType, string> = {
      '10-K': 'badge-annual',
      '10-Q': 'badge-quarterly',
      '8-K': 'badge-event',
      '4': 'badge-insider',
      'S-1': 'badge-registration',
      'DEF 14A': 'badge-proxy',
      '13F': 'badge-institutional',
      'SC 13G': 'badge-passive',
      'SC 13D': 'badge-active',
      'Other': 'badge-other',
    }
    return classes[formType] || 'badge-other'
  },

  /**
   * Format date for display
   * @param dateString - ISO date string
   * @returns Formatted date
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  },
}
