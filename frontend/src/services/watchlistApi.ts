import api from './api'
import type { WatchlistItem, ApiResponse } from '../types'

export interface WatchlistItemWithQuote extends WatchlistItem {
  stock?: {
    name: string
    exchange?: string
    sector?: string | null
    price?: number
    change?: number
    changePercent?: number
  }
}

export const watchlistApi = {
  /**
   * Get user's watchlist
   */
  async getWatchlist(): Promise<WatchlistItemWithQuote[]> {
    const response = await api.get<ApiResponse<WatchlistItemWithQuote[]>>('/watchlist')
    return response.data.data
  },

  /**
   * Add a stock to watchlist
   */
  async addStock(symbol: string, notes?: string): Promise<WatchlistItem> {
    const response = await api.post<ApiResponse<WatchlistItem>>('/watchlist', {
      symbol,
      notes,
    })
    return response.data.data
  },

  /**
   * Remove a stock from watchlist
   */
  async removeStock(symbol: string): Promise<void> {
    await api.delete(`/watchlist/${symbol}`)
  },

  /**
   * Reorder stocks in watchlist
   */
  async reorderStocks(symbols: string[]): Promise<void> {
    await api.put('/watchlist/reorder', { symbols })
  },

  /**
   * Update notes for a watchlist item
   */
  async updateNotes(symbol: string, notes: string | null): Promise<WatchlistItem> {
    const response = await api.patch<ApiResponse<WatchlistItem>>(`/watchlist/${symbol}/notes`, {
      notes,
    })
    return response.data.data
  },

  /**
   * Check if a stock is in watchlist
   */
  async isInWatchlist(symbol: string): Promise<boolean> {
    const response = await api.get<ApiResponse<{ isInWatchlist: boolean }>>(
      `/watchlist/${symbol}/check`
    )
    return response.data.data.isInWatchlist
  },
}
