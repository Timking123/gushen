import api from './api'
import type { NewsItem, PaginatedResponse } from '../types'

export interface NewsFeedItem extends NewsItem {
  priority: 'high' | 'medium' | 'low'
}

export interface NewsApiOptions {
  page?: number
  limit?: number
}

/**
 * News API service
 * Provides methods to fetch news from the backend
 */
export const newsApi = {
  /**
   * Get latest news feed sorted by priority and time
   * Implements Requirement 6.4: Sort information by importance and time
   */
  async getNewsFeed(options: NewsApiOptions = {}): Promise<PaginatedResponse<NewsFeedItem>> {
    const { page = 1, limit = 20 } = options
    const response = await api.get<PaginatedResponse<NewsFeedItem>>('/news', {
      params: { page, limit },
    })
    return response.data
  },

  /**
   * Get news for a specific stock
   */
  async getStockNews(
    symbol: string,
    options: NewsApiOptions = {}
  ): Promise<PaginatedResponse<NewsItem>> {
    const { page = 1, limit = 20 } = options
    const response = await api.get<PaginatedResponse<NewsItem>>(`/news/stock/${symbol}`, {
      params: { page, limit },
    })
    return response.data
  },

  /**
   * Get news for a specific sector
   */
  async getSectorNews(
    sector: string,
    options: NewsApiOptions = {}
  ): Promise<PaginatedResponse<NewsItem>> {
    const { page = 1, limit = 20 } = options
    const response = await api.get<PaginatedResponse<NewsItem>>(`/news/sector/${sector}`, {
      params: { page, limit },
    })
    return response.data
  },
}
