import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';
import { CacheKeys, CacheTTL } from '../lib/cache-keys.js';
import { ConflictError, NotFoundError, UnauthorizedError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

/**
 * Watchlist item interface
 * Represents a stock in user's watchlist
 */
export interface WatchlistItemResponse {
  id: string;
  userId: string;
  symbol: string;
  addedAt: Date;
  sortOrder: number;
  notes: string | null;
  stock?: {
    name: string;
    exchange: string;
    sector: string | null;
    price?: number;
    change?: number;
    changePercent?: number;
  };
}

/**
 * WatchlistService - Handles user watchlist operations
 * Implements Requirements 1.2, 1.3, 1.5, 1.6
 */
export class WatchlistService {
  /**
   * Get user's watchlist
   * Returns all stocks in user's watchlist sorted by sortOrder
   * 
   * @param userId - User's unique identifier
   * @returns Array of watchlist items with stock details
   * 
   * Implements Requirement 1.4: WHEN 用户查看自选股列表 
   * THEN Watchlist_Manager SHALL 显示所有自选股的当前价格、涨跌幅和最新动态摘要
   */
  async getWatchlist(userId: string): Promise<WatchlistItemResponse[]> {
    // Check cache first
    const cacheKey = CacheKeys.user.watchlist(userId);
    try {
      const cachedWatchlist = await redisHelpers.getJson<WatchlistItemResponse[]>(cacheKey);
      if (cachedWatchlist) {
        logger.debug(`Watchlist cache hit for user: ${userId}`);
        return cachedWatchlist.map(item => ({
          ...item,
          addedAt: new Date(item.addedAt),
        }));
      }
    } catch (error) {
      logger.warn('Redis cache read error:', error);
    }

    // Query database with latest quotes
    const watchlistItems = await prisma.watchlistItem.findMany({
      where: { userId },
      include: {
        stock: {
          select: {
            name: true,
            exchange: true,
            sector: true,
            quotes: {
              orderBy: { timestamp: 'desc' },
              take: 1,
              select: {
                price: true,
                change: true,
                changePercent: true,
              },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const results: WatchlistItemResponse[] = watchlistItems.map(item => {
      const latestQuote = item.stock?.quotes?.[0];
      return {
        id: item.id,
        userId: item.userId,
        symbol: item.symbol,
        addedAt: item.addedAt,
        sortOrder: item.sortOrder,
        notes: item.notes,
        stock: item.stock ? {
          name: item.stock.name,
          exchange: item.stock.exchange,
          sector: item.stock.sector,
          price: latestQuote?.price,
          change: latestQuote?.change,
          changePercent: latestQuote?.changePercent,
        } : undefined,
      };
    });

    // Cache results
    try {
      await redisHelpers.setJson(cacheKey, results, CacheTTL.watchlist);
      logger.debug(`Watchlist cached for user: ${userId}`);
    } catch (error) {
      logger.warn('Redis cache write error:', error);
    }

    return results;
  }


  /**
   * Add a stock to user's watchlist
   * Validates stock exists and checks for duplicates
   * 
   * @param userId - User's unique identifier
   * @param symbol - Stock symbol to add
   * @param notes - Optional notes for the stock
   * @returns The newly added watchlist item
   * @throws ConflictError if stock already in watchlist
   * @throws NotFoundError if stock doesn't exist
   * 
   * Implements Requirement 1.2: WHEN 用户添加股票到自选股 
   * THEN Watchlist_Manager SHALL 将该股票保存到用户的自选股列表并立即显示
   * 
   * Implements Requirement 1.5: IF 用户添加重复的股票 
   * THEN Watchlist_Manager SHALL 提示用户该股票已在自选股列表中
   */
  async addStock(userId: string, symbol: string, notes?: string): Promise<WatchlistItemResponse> {
    // Validate userId
    if (!userId) {
      logger.error('addStock called without userId');
      throw new UnauthorizedError('用户未登录');
    }

    const normalizedSymbol = symbol.trim().toUpperCase();
    logger.debug(`Adding stock ${normalizedSymbol} to watchlist for user ${userId}`);

    try {
      // Check if user exists in database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        logger.error(`User ${userId} not found in database - token may be invalid`);
        throw new UnauthorizedError('用户不存在，请重新登录');
      }

      // Check if stock exists
      const stock = await prisma.stock.findUnique({
        where: { symbol: normalizedSymbol },
        select: { symbol: true, name: true, exchange: true, sector: true },
      });

      if (!stock) {
        logger.warn(`Stock ${normalizedSymbol} not found in database`);
        throw new NotFoundError(`股票 ${normalizedSymbol} 不存在`);
      }

      // Check for duplicate (Requirement 1.5)
      const existingItem = await prisma.watchlistItem.findUnique({
        where: {
          userId_symbol: {
            userId,
            symbol: normalizedSymbol,
          },
        },
      });

      if (existingItem) {
        throw new ConflictError(`股票 ${normalizedSymbol} 已在自选股列表中`);
      }

      // Get the max sortOrder for the user
      const maxSortOrder = await prisma.watchlistItem.aggregate({
        where: { userId },
        _max: { sortOrder: true },
      });

      const newSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;

      // Create watchlist item
      const watchlistItem = await prisma.watchlistItem.create({
        data: {
          userId,
          symbol: normalizedSymbol,
          sortOrder: newSortOrder,
          notes: notes || null,
        },
        include: {
          stock: {
            select: {
              name: true,
              exchange: true,
              sector: true,
            },
          },
        },
      });

      logger.info(`Stock ${normalizedSymbol} added to watchlist for user ${userId}`);

      // Invalidate cache
      await this.invalidateCache(userId);

      return {
        id: watchlistItem.id,
        userId: watchlistItem.userId,
        symbol: watchlistItem.symbol,
        addedAt: watchlistItem.addedAt,
        sortOrder: watchlistItem.sortOrder,
        notes: watchlistItem.notes,
        stock: watchlistItem.stock ? {
          name: watchlistItem.stock.name,
          exchange: watchlistItem.stock.exchange,
          sector: watchlistItem.stock.sector,
        } : undefined,
      };
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof ConflictError || error instanceof UnauthorizedError) {
        throw error;
      }
      // Log and wrap unknown errors
      logger.error(`Failed to add stock ${normalizedSymbol} to watchlist:`, error);
      throw error;
    }
  }

  /**
   * Remove a stock from user's watchlist
   * 
   * @param userId - User's unique identifier
   * @param symbol - Stock symbol to remove
   * @throws NotFoundError if stock not in watchlist
   * 
   * Implements Requirement 1.3: WHEN 用户从自选股中移除股票 
   * THEN Watchlist_Manager SHALL 从列表中删除该股票并停止相关推送
   */
  async removeStock(userId: string, symbol: string): Promise<void> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check if item exists
    const existingItem = await prisma.watchlistItem.findUnique({
      where: {
        userId_symbol: {
          userId,
          symbol: normalizedSymbol,
        },
      },
    });

    if (!existingItem) {
      throw new NotFoundError(`股票 ${normalizedSymbol} 不在自选股列表中`);
    }

    // Delete the item
    await prisma.watchlistItem.delete({
      where: {
        userId_symbol: {
          userId,
          symbol: normalizedSymbol,
        },
      },
    });

    logger.info(`Stock ${normalizedSymbol} removed from watchlist for user ${userId}`);

    // Invalidate cache
    await this.invalidateCache(userId);
  }


  /**
   * Reorder stocks in user's watchlist
   * Updates sortOrder for all stocks based on the provided order
   * 
   * @param userId - User's unique identifier
   * @param symbols - Array of stock symbols in desired order
   * 
   * Implements Requirement 1.6: WHEN 用户拖拽自选股 
   * THEN Watchlist_Manager SHALL 允许用户自定义排序顺序并保存
   */
  async reorderStocks(userId: string, symbols: string[]): Promise<void> {
    // Normalize symbols
    const normalizedSymbols = symbols.map(s => s.trim().toUpperCase());

    // Verify all symbols are in user's watchlist
    const existingItems = await prisma.watchlistItem.findMany({
      where: { userId },
      select: { symbol: true },
    });

    const existingSymbols = new Set(existingItems.map(item => item.symbol));
    
    for (const symbol of normalizedSymbols) {
      if (!existingSymbols.has(symbol)) {
        throw new NotFoundError(`股票 ${symbol} 不在自选股列表中`);
      }
    }

    // Update sortOrder for each symbol in a transaction
    await prisma.$transaction(
      normalizedSymbols.map((symbol, index) =>
        prisma.watchlistItem.update({
          where: {
            userId_symbol: {
              userId,
              symbol,
            },
          },
          data: { sortOrder: index },
        })
      )
    );

    logger.info(`Watchlist reordered for user ${userId}`);

    // Invalidate cache
    await this.invalidateCache(userId);
  }

  /**
   * Update notes for a watchlist item
   * 
   * @param userId - User's unique identifier
   * @param symbol - Stock symbol
   * @param notes - New notes (null to clear)
   * @returns Updated watchlist item
   */
  async updateNotes(userId: string, symbol: string, notes: string | null): Promise<WatchlistItemResponse> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Check if item exists
    const existingItem = await prisma.watchlistItem.findUnique({
      where: {
        userId_symbol: {
          userId,
          symbol: normalizedSymbol,
        },
      },
    });

    if (!existingItem) {
      throw new NotFoundError(`股票 ${normalizedSymbol} 不在自选股列表中`);
    }

    // Update notes
    const updatedItem = await prisma.watchlistItem.update({
      where: {
        userId_symbol: {
          userId,
          symbol: normalizedSymbol,
        },
      },
      data: { notes },
      include: {
        stock: {
          select: {
            name: true,
            exchange: true,
            sector: true,
          },
        },
      },
    });

    // Invalidate cache
    await this.invalidateCache(userId);

    return {
      id: updatedItem.id,
      userId: updatedItem.userId,
      symbol: updatedItem.symbol,
      addedAt: updatedItem.addedAt,
      sortOrder: updatedItem.sortOrder,
      notes: updatedItem.notes,
      stock: updatedItem.stock ? {
        name: updatedItem.stock.name,
        exchange: updatedItem.stock.exchange,
        sector: updatedItem.stock.sector,
      } : undefined,
    };
  }

  /**
   * Check if a stock is in user's watchlist
   * 
   * @param userId - User's unique identifier
   * @param symbol - Stock symbol to check
   * @returns true if stock is in watchlist
   */
  async isInWatchlist(userId: string, symbol: string): Promise<boolean> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    const item = await prisma.watchlistItem.findUnique({
      where: {
        userId_symbol: {
          userId,
          symbol: normalizedSymbol,
        },
      },
      select: { id: true },
    });

    return item !== null;
  }

  /**
   * Get watchlist count for a user
   * 
   * @param userId - User's unique identifier
   * @returns Number of stocks in watchlist
   */
  async getWatchlistCount(userId: string): Promise<number> {
    return prisma.watchlistItem.count({
      where: { userId },
    });
  }

  /**
   * Invalidate watchlist cache for a user
   * @param userId - User's unique identifier
   */
  private async invalidateCache(userId: string): Promise<void> {
    const cacheKey = CacheKeys.user.watchlist(userId);
    try {
      await redisHelpers.del(cacheKey);
      logger.debug(`Watchlist cache invalidated for user: ${userId}`);
    } catch (error) {
      logger.warn('Redis cache invalidation error:', error);
    }
  }
}

// Export singleton instance
export const watchlistService = new WatchlistService();
