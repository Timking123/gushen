/**
 * Portfolio API Service
 * Frontend API client for portfolio management
 * Requirements: 17.1, 17.2, 17.3, 17.5, 17.6
 */

import api from './api'

// Types
export interface Portfolio {
  id: string
  userId: string
  name: string
  description: string | null
  createdAt: string
}

export interface PortfolioHolding {
  id: string
  portfolioId: string
  symbol: string
  shares: number
  avgCostBasis: number
  addedAt: string
  stock?: {
    name: string
    sector: string
  }
}

export interface PortfolioTransaction {
  id: string
  portfolioId: string
  symbol: string
  type: 'buy' | 'sell' | 'dividend'
  shares: number
  pricePerShare: number
  totalAmount: number
  transactionDate: string
  notes: string | null
}

export interface HoldingWithValue {
  symbol: string
  shares: number
  avgCostBasis: number
  currentPrice: number
  marketValue: number
  costBasis: number
  gain: number
  gainPercent: number
  weight: number
  sector?: string
}

export interface PortfolioSummary {
  totalMarketValue: number
  totalCostBasis: number
  totalGain: number
  totalGainPercent: number
  dayChange: number
  dayChangePercent: number
  holdings: HoldingWithValue[]
}

export interface SectorDistribution {
  sector: string
  marketValue: number
  weight: number
  stockCount: number
}

export interface ReturnsCurvePoint {
  date: string
  portfolioValue: number
  dailyReturn: number
  cumulativeReturn: number
  totalInvested: number
}

export interface ReturnsCurveResult {
  portfolioId: string
  startDate: string
  endDate: string
  dataPoints: ReturnsCurvePoint[]
  totalReturn: number
  annualizedReturn: number
  maxDrawdown: number
}

export interface BenchmarkComparisonPoint {
  date: string
  portfolioReturn: number
  benchmarkReturn: number
  alpha: number
}

export interface BenchmarkComparisonResult {
  portfolioId: string
  benchmarkSymbol: string
  startDate: string
  endDate: string
  portfolioTotalReturn: number
  benchmarkTotalReturn: number
  alpha: number
  portfolioAnnualizedReturn: number
  benchmarkAnnualizedReturn: number
  dataPoints: BenchmarkComparisonPoint[]
}

export interface BenchmarkInfo {
  symbol: string
  name: string
  description: string
}

export type ReturnsTimeRange = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'MAX'

// API Functions
export const portfolioApi = {
  /**
   * Get all portfolios for the current user
   */
  async getPortfolios(): Promise<Portfolio[]> {
    const response = await api.get('/portfolios')
    return response.data.data
  },

  /**
   * Get a specific portfolio
   */
  async getPortfolio(portfolioId: string): Promise<Portfolio> {
    const response = await api.get(`/portfolios/${portfolioId}`)
    return response.data.data
  },

  /**
   * Create a new portfolio
   */
  async createPortfolio(data: { name: string; description?: string }): Promise<Portfolio> {
    const response = await api.post('/portfolios', data)
    return response.data.data
  },

  /**
   * Update a portfolio
   */
  async updatePortfolio(
    portfolioId: string,
    data: { name?: string; description?: string }
  ): Promise<Portfolio> {
    const response = await api.put(`/portfolios/${portfolioId}`, data)
    return response.data.data
  },

  /**
   * Delete a portfolio
   */
  async deletePortfolio(portfolioId: string): Promise<void> {
    await api.delete(`/portfolios/${portfolioId}`)
  },

  /**
   * Get holdings for a portfolio
   */
  async getHoldings(portfolioId: string): Promise<PortfolioHolding[]> {
    const response = await api.get(`/portfolios/${portfolioId}/holdings`)
    return response.data.data
  },

  /**
   * Add a holding to portfolio
   */
  async addHolding(
    portfolioId: string,
    data: { symbol: string; shares: number; avgCostBasis: number }
  ): Promise<PortfolioHolding> {
    const response = await api.post(`/portfolios/${portfolioId}/holdings`, data)
    return response.data.data
  },

  /**
   * Update a holding
   */
  async updateHolding(
    portfolioId: string,
    holdingId: string,
    data: { shares?: number; avgCostBasis?: number }
  ): Promise<PortfolioHolding> {
    const response = await api.put(`/portfolios/${portfolioId}/holdings/${holdingId}`, data)
    return response.data.data
  },

  /**
   * Remove a holding
   */
  async removeHolding(portfolioId: string, holdingId: string): Promise<void> {
    await api.delete(`/portfolios/${portfolioId}/holdings/${holdingId}`)
  },

  /**
   * Get transactions for a portfolio
   */
  async getTransactions(
    portfolioId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<PortfolioTransaction[]> {
    const params = new URLSearchParams()
    if (options?.limit) params.append('limit', options.limit.toString())
    if (options?.offset) params.append('offset', options.offset.toString())
    const response = await api.get(`/portfolios/${portfolioId}/transactions?${params}`)
    return response.data.data
  },

  /**
   * Record a transaction
   */
  async recordTransaction(
    portfolioId: string,
    data: {
      symbol: string
      type: 'buy' | 'sell' | 'dividend'
      shares: number
      pricePerShare: number
      transactionDate?: string
      notes?: string
    }
  ): Promise<PortfolioTransaction> {
    const response = await api.post(`/portfolios/${portfolioId}/transactions`, data)
    return response.data.data
  },

  /**
   * Get portfolio summary with current values
   * Validates: Requirement 17.2, 17.3
   */
  async getPortfolioSummary(portfolioId: string): Promise<PortfolioSummary> {
    const response = await api.get(`/portfolios/${portfolioId}/summary`)
    return response.data.data
  },

  /**
   * Get sector distribution
   * Validates: Requirement 17.5
   */
  async getSectorDistribution(portfolioId: string): Promise<SectorDistribution[]> {
    const response = await api.get(`/portfolios/${portfolioId}/sector-distribution`)
    return response.data.data
  },

  /**
   * Get returns curve
   * Validates: Requirement 17.6
   */
  async getReturnsCurve(
    portfolioId: string,
    range: ReturnsTimeRange = '1Y'
  ): Promise<ReturnsCurveResult> {
    const response = await api.get(`/portfolios/${portfolioId}/returns-curve?range=${range}`)
    return response.data.data
  },

  /**
   * Get benchmark comparison
   * Validates: Requirement 17.6
   */
  async getBenchmarkComparison(
    portfolioId: string,
    benchmarkSymbol: string = 'SPY',
    range: ReturnsTimeRange = '1Y'
  ): Promise<BenchmarkComparisonResult> {
    const response = await api.get(
      `/portfolios/${portfolioId}/benchmark-comparison?benchmark=${benchmarkSymbol}&range=${range}`
    )
    return response.data.data
  },

  /**
   * Get available benchmarks
   */
  async getAvailableBenchmarks(): Promise<BenchmarkInfo[]> {
    const response = await api.get('/portfolios/benchmarks/available')
    return response.data.data
  },
}

export default portfolioApi
