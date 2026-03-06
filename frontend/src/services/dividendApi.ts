import api from './api'
import type {
  DividendSummary,
  DividendHistoryItem,
  DividendCalendarEntry,
} from '../types'

/**
 * Dividend calendar filters
 */
export interface DividendCalendarFilters {
  symbols?: string[]
  startDate?: string
  endDate?: string
  minYield?: number
  maxYield?: number
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number
  limit?: number
}

/**
 * Dividend calendar response
 */
export interface DividendCalendarResponse {
  events: DividendCalendarEntry[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * Get dividend calendar with optional filters
 * Implements Requirement 15.2: Display upcoming ex-dividend and pay dates
 */
export async function getDividendCalendar(
  filters?: DividendCalendarFilters,
  pagination?: PaginationOptions
): Promise<DividendCalendarResponse> {
  const params = new URLSearchParams()

  if (filters?.symbols?.length) {
    params.append('symbols', filters.symbols.join(','))
  }
  if (filters?.startDate) {
    params.append('startDate', filters.startDate)
  }
  if (filters?.endDate) {
    params.append('endDate', filters.endDate)
  }
  if (filters?.minYield !== undefined) {
    params.append('minYield', filters.minYield.toString())
  }
  if (filters?.maxYield !== undefined) {
    params.append('maxYield', filters.maxYield.toString())
  }
  if (pagination?.page) {
    params.append('page', pagination.page.toString())
  }
  if (pagination?.limit) {
    params.append('limit', pagination.limit.toString())
  }

  const queryString = params.toString()
  const url = queryString ? `/dividends/calendar?${queryString}` : '/dividends/calendar'

  const response = await api.get(url)
  return response.data.data
}

/**
 * Get upcoming dividends for specified stocks
 * Implements Requirement 15.3: Push reminder before ex-dividend date
 */
export async function getUpcomingDividends(
  symbols: string[],
  days: number = 30
): Promise<DividendCalendarEntry[]> {
  const params = new URLSearchParams()
  params.append('symbols', symbols.join(','))
  params.append('days', days.toString())

  const response = await api.get(`/dividends/upcoming?${params.toString()}`)
  return response.data.data.events
}

/**
 * Get dividend summary for a specific stock
 * Implements Requirement 15.1: Display dividend rate, frequency, and history
 */
export async function getDividendSummary(symbol: string): Promise<DividendSummary> {
  const response = await api.get(`/dividends/stock/${symbol}`)
  return response.data.data
}

/**
 * Get dividend history for a specific stock
 * Implements Requirement 15.1: Display historical dividend records
 */
export async function getDividendHistory(
  symbol: string,
  limit: number = 20
): Promise<DividendHistoryItem[]> {
  const response = await api.get(`/dividends/stock/${symbol}/history?limit=${limit}`)
  return response.data.data.history
}

/**
 * Portfolio dividend income response
 */
export interface PortfolioDividendIncome {
  portfolioId: string
  totalAnnualIncome: number
  holdings: Array<{
    symbol: string
    stockName?: string
    shares: number
    annualDividend: number
    expectedIncome: number
    yield: number | null
    frequency: string | null
    nextExDate: string | null
  }>
}

/**
 * Calculate expected annual dividend income for a portfolio
 * Implements Requirement 15.6: Calculate and display expected annual dividend income
 */
export async function getPortfolioDividendIncome(
  portfolioId: string
): Promise<PortfolioDividendIncome> {
  const response = await api.get(`/dividends/portfolio/${portfolioId}/income`)
  return response.data.data
}

export default {
  getDividendCalendar,
  getUpcomingDividends,
  getDividendSummary,
  getDividendHistory,
  getPortfolioDividendIncome,
}
