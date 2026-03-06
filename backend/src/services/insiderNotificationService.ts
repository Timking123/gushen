import { prisma } from '../lib/prisma.js';
import { logger } from '../utils/logger.js';
import { insiderService, InsiderTradeWithStock } from './insiderService.js';
import { pushService, PushMessage } from './pushService.js';

/**
 * Configuration for insider trade notification thresholds
 */
export interface InsiderNotificationConfig {
  /** Minimum transaction value to trigger notification (default: $100,000) */
  minTransactionValue: number;
  /** Number of days to look back for significant trades (default: 7) */
  lookbackDays: number;
}

/**
 * Default configuration for insider notifications
 */
export const DEFAULT_INSIDER_NOTIFICATION_CONFIG: InsiderNotificationConfig = {
  minTransactionValue: 100000,
  lookbackDays: 7,
};

/**
 * Result of checking for significant insider trades
 */
export interface SignificantTradeCheckResult {
  userId: string;
  trade: InsiderTradeWithStock;
  notificationSent: boolean;
}

/**
 * InsiderNotificationService - Monitors significant insider trades and sends push notifications
 * 
 * Implements Requirement 12.3:
 * WHEN 自选股有重大内部交易 THEN Insider_Tracker SHALL 推送通知提醒用户
 */
export class InsiderNotificationService {
  private config: InsiderNotificationConfig;

  constructor(config: Partial<InsiderNotificationConfig> = {}) {
    this.config = { ...DEFAULT_INSIDER_NOTIFICATION_CONFIG, ...config };
  }

  /**
   * Check for significant insider trades and notify affected users
   * 
   * This method:
   * 1. Gets significant insider trades above the threshold
   * 2. Finds users who have those stocks in their watchlist
   * 3. Sends push notifications to those users
   * 
   * @param config - Optional override configuration
   * @returns Array of results indicating which notifications were sent
   * 
   * Implements Requirement 12.3
   */
  async checkAndNotifySignificantTrades(
    config?: Partial<InsiderNotificationConfig>
  ): Promise<SignificantTradeCheckResult[]> {
    const effectiveConfig = { ...this.config, ...config };
    const results: SignificantTradeCheckResult[] = [];

    try {
      // Get significant insider trades
      const significantTrades = await insiderService.getSignificantInsiderTrades(
        effectiveConfig.minTransactionValue,
        effectiveConfig.lookbackDays,
        100 // Get up to 100 significant trades
      );

      if (significantTrades.length === 0) {
        logger.debug('No significant insider trades found');
        return results;
      }

      logger.info(`Found ${significantTrades.length} significant insider trades to process`);

      // Get unique symbols from significant trades
      const symbols = [...new Set(significantTrades.map(trade => trade.symbol))];

      // Find users who have these stocks in their watchlist
      const watchlistItems = await prisma.watchlistItem.findMany({
        where: {
          symbol: {
            in: symbols,
          },
        },
        select: {
          userId: true,
          symbol: true,
        },
      });

      // Create a map of symbol -> userIds for efficient lookup
      const symbolToUsers = new Map<string, string[]>();
      for (const item of watchlistItems) {
        const users = symbolToUsers.get(item.symbol) || [];
        users.push(item.userId);
        symbolToUsers.set(item.symbol, users);
      }

      // Process each significant trade and notify affected users
      for (const trade of significantTrades) {
        const affectedUsers = symbolToUsers.get(trade.symbol) || [];
        
        for (const userId of affectedUsers) {
          try {
            // Check if we've already notified this user about this trade
            const alreadyNotified = await this.hasAlreadyNotified(userId, trade.id);
            
            if (!alreadyNotified) {
              await this.sendInsiderTradeNotification(userId, trade);
              results.push({
                userId,
                trade,
                notificationSent: true,
              });
              logger.debug(`Sent insider trade notification to user ${userId} for ${trade.symbol}`);
            } else {
              results.push({
                userId,
                trade,
                notificationSent: false,
              });
            }
          } catch (error) {
            logger.error(`Failed to send notification to user ${userId} for trade ${trade.id}:`, error);
            results.push({
              userId,
              trade,
              notificationSent: false,
            });
          }
        }
      }

      logger.info(`Processed ${results.length} insider trade notifications`);
      return results;
    } catch (error) {
      logger.error('Error checking and notifying significant trades:', error);
      throw error;
    }
  }

  /**
   * Send a push notification for a significant insider trade
   * 
   * @param userId - User to notify
   * @param trade - The insider trade details
   * 
   * Implements Requirement 12.3
   */
  async sendInsiderTradeNotification(
    userId: string,
    trade: InsiderTradeWithStock
  ): Promise<void> {
    const transactionTypeText = this.getTransactionTypeText(trade.transactionType);
    const formattedValue = this.formatCurrency(trade.totalValue);
    const formattedShares = this.formatNumber(trade.shares);
    
    // Determine priority based on transaction value
    const priority = this.determinePriority(trade.totalValue);

    const message: PushMessage = {
      type: 'insider',
      symbol: trade.symbol,
      title: `${trade.symbol} 重大内部交易`,
      message: `${trade.insiderName}${trade.insiderTitle ? ` (${trade.insiderTitle})` : ''} ${transactionTypeText} ${formattedShares} 股，总价值 ${formattedValue}`,
      priority,
      metadata: {
        tradeId: trade.id,
        insiderName: trade.insiderName,
        insiderTitle: trade.insiderTitle,
        transactionType: trade.transactionType,
        shares: trade.shares,
        pricePerShare: trade.pricePerShare,
        totalValue: trade.totalValue,
        tradeDate: trade.tradeDate.toISOString(),
        filedAt: trade.filedAt.toISOString(),
        stockName: trade.stockName,
        sector: trade.sector,
      },
    };

    await pushService.pushToUser(userId, message);
  }

  /**
   * Notify a specific user about a significant insider trade
   * This can be called directly when a new significant trade is detected
   * 
   * @param userId - User to notify
   * @param symbol - Stock symbol
   * @param minValue - Minimum transaction value threshold
   * @returns true if notification was sent
   */
  async notifyUserOfSignificantTrade(
    userId: string,
    symbol: string,
    minValue: number = this.config.minTransactionValue
  ): Promise<boolean> {
    try {
      // Check if user has this stock in their watchlist
      const watchlistItem = await prisma.watchlistItem.findUnique({
        where: {
          userId_symbol: {
            userId,
            symbol: symbol.toUpperCase(),
          },
        },
      });

      if (!watchlistItem) {
        logger.debug(`User ${userId} does not have ${symbol} in watchlist, skipping notification`);
        return false;
      }

      // Get recent significant trades for this symbol
      const trades = await insiderService.getSignificantInsiderTrades(
        minValue,
        this.config.lookbackDays,
        10
      );

      const symbolTrades = trades.filter(t => t.symbol === symbol.toUpperCase());
      
      if (symbolTrades.length === 0) {
        logger.debug(`No significant trades found for ${symbol}`);
        return false;
      }

      // Send notification for the most recent significant trade
      const latestTrade = symbolTrades[0];
      
      // Check if already notified
      const alreadyNotified = await this.hasAlreadyNotified(userId, latestTrade.id);
      if (alreadyNotified) {
        logger.debug(`User ${userId} already notified about trade ${latestTrade.id}`);
        return false;
      }

      await this.sendInsiderTradeNotification(userId, latestTrade);
      return true;
    } catch (error) {
      logger.error(`Error notifying user ${userId} of significant trade for ${symbol}:`, error);
      return false;
    }
  }

  /**
   * Get users who should be notified about a specific insider trade
   * 
   * @param symbol - Stock symbol
   * @returns Array of user IDs who have this stock in their watchlist
   */
  async getUsersToNotify(symbol: string): Promise<string[]> {
    const watchlistItems = await prisma.watchlistItem.findMany({
      where: {
        symbol: symbol.toUpperCase(),
      },
      select: {
        userId: true,
      },
    });

    return watchlistItems.map(item => item.userId);
  }

  /**
   * Check if a trade qualifies as significant based on the configured threshold
   * 
   * @param totalValue - Total transaction value
   * @param minValue - Optional override for minimum value threshold
   * @returns true if the trade is significant
   */
  isSignificantTrade(
    totalValue: number,
    minValue: number = this.config.minTransactionValue
  ): boolean {
    return totalValue >= minValue;
  }

  /**
   * Check if user has already been notified about a specific trade
   * 
   * @param userId - User ID
   * @param tradeId - Trade ID
   * @returns true if already notified
   */
  private async hasAlreadyNotified(userId: string, tradeId: string): Promise<boolean> {
    const existingAlert = await prisma.alert.findFirst({
      where: {
        userId,
        type: 'insider',
        metadata: {
          path: ['tradeId'],
          equals: tradeId,
        },
      },
    });

    return existingAlert !== null;
  }

  /**
   * Get human-readable text for transaction type
   */
  private getTransactionTypeText(transactionType: string): string {
    switch (transactionType) {
      case 'buy':
        return '买入';
      case 'sell':
        return '卖出';
      case 'exercise':
        return '行权';
      default:
        return transactionType;
    }
  }

  /**
   * Format currency value for display
   */
  private formatCurrency(value: number): string {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  }

  /**
   * Format number with commas
   */
  private formatNumber(value: number): string {
    return value.toLocaleString('en-US');
  }

  /**
   * Determine notification priority based on transaction value
   */
  private determinePriority(totalValue: number): 'high' | 'medium' | 'low' {
    if (totalValue >= 1000000) {
      return 'high';
    } else if (totalValue >= 500000) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<InsiderNotificationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): InsiderNotificationConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const insiderNotificationService = new InsiderNotificationService();
