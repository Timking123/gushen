import { prisma } from '../lib/prisma.js';
import { logger } from '../utils/logger.js';
import { pushService, PushMessage } from './pushService.js';
import { earningsService, EarningsEvent } from './earningsService.js';

/**
 * Earnings reminder configuration
 */
export interface EarningsReminderConfig {
  /** Days before earnings to send reminder (default: 1) */
  reminderDaysBefore: number;
  /** Whether to send post-earnings comparison notifications */
  sendPostEarningsComparison: boolean;
}

/**
 * Earnings comparison result for post-earnings notification
 */
export interface EarningsComparisonResult {
  symbol: string;
  stockName: string;
  fiscalQuarter: string;
  fiscalYear: number;
  epsEstimate: number | null;
  epsActual: number | null;
  epsSurprise: number | null;
  epsSurprisePercent: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  revenueSurprisePercent: number | null;
  beat: 'beat' | 'miss' | 'meet' | 'unknown';
}

/**
 * Default configuration for earnings reminders
 */
const DEFAULT_CONFIG: EarningsReminderConfig = {
  reminderDaysBefore: 1,
  sendPostEarningsComparison: true,
};

/**
 * EarningsReminderService - Handles earnings reminder push notifications
 * 
 * Implements Requirements:
 * - 11.4: WHEN 自选股即将发布财报 THEN Earnings_Calendar SHALL 提前推送提醒通知
 * - 11.5: WHEN 财报发布后 THEN Earnings_Calendar SHALL 显示实际业绩与预期对比及股价反应
 */
export class EarningsReminderService {
  private config: EarningsReminderConfig;

  constructor(config: Partial<EarningsReminderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get upcoming earnings events for a user's watchlist stocks
   * 
   * @param userId - User's unique identifier
   * @param daysAhead - Number of days to look ahead (default: 7)
   * @returns Array of upcoming earnings events for watchlist stocks
   */
  async getUpcomingEarningsForWatchlist(
    userId: string,
    daysAhead: number = 7
  ): Promise<EarningsEvent[]> {
    // Get user's watchlist symbols
    const watchlistItems = await prisma.watchlistItem.findMany({
      where: { userId },
      select: { symbol: true },
    });

    if (watchlistItems.length === 0) {
      return [];
    }

    const symbols = watchlistItems.map(item => item.symbol);

    // Get upcoming earnings for these symbols
    const now = new Date();
    const endDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const result = await earningsService.getEarningsCalendar(
      {
        startDate: now,
        endDate,
        symbols,
        hasActualResults: false,
      },
      { field: 'reportDate', order: 'asc' },
      { page: 1, limit: 100 }
    );

    return result.events;
  }

  /**
   * Get earnings events happening tomorrow for a user's watchlist
   * Used for sending day-before reminders
   * 
   * @param userId - User's unique identifier
   * @returns Array of earnings events happening tomorrow
   * 
   * Implements Requirement 11.4
   */
  async getEarningsTomorrowForWatchlist(userId: string): Promise<EarningsEvent[]> {
    // Get user's watchlist symbols
    const watchlistItems = await prisma.watchlistItem.findMany({
      where: { userId },
      select: { symbol: true },
    });

    if (watchlistItems.length === 0) {
      return [];
    }

    const symbols = watchlistItems.map(item => item.symbol);

    // Calculate tomorrow's date range
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + this.config.reminderDaysBefore);
    tomorrow.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const result = await earningsService.getEarningsCalendar(
      {
        startDate: tomorrow,
        endDate: tomorrowEnd,
        symbols,
        hasActualResults: false,
      },
      { field: 'reportDate', order: 'asc' },
      { page: 1, limit: 100 }
    );

    return result.events;
  }

  /**
   * Get recent earnings results for a user's watchlist
   * Used for sending post-earnings comparison notifications
   * 
   * @param userId - User's unique identifier
   * @param hoursBack - Number of hours to look back (default: 24)
   * @returns Array of recent earnings events with results
   * 
   * Implements Requirement 11.5
   */
  async getRecentEarningsResultsForWatchlist(
    userId: string,
    hoursBack: number = 24
  ): Promise<EarningsEvent[]> {
    // Get user's watchlist symbols
    const watchlistItems = await prisma.watchlistItem.findMany({
      where: { userId },
      select: { symbol: true },
    });

    if (watchlistItems.length === 0) {
      return [];
    }

    const symbols = watchlistItems.map(item => item.symbol);

    // Calculate time range
    const now = new Date();
    const startDate = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

    const result = await earningsService.getEarningsCalendar(
      {
        startDate,
        endDate: now,
        symbols,
        hasActualResults: true,
      },
      { field: 'reportDate', order: 'desc' },
      { page: 1, limit: 100 }
    );

    return result.events;
  }

  /**
   * Send earnings reminder notification to a user
   * 
   * @param userId - User's unique identifier
   * @param event - Earnings event to remind about
   * 
   * Implements Requirement 11.4
   */
  async sendEarningsReminder(userId: string, event: EarningsEvent): Promise<void> {
    const timingText = this.getTimingText(event.timing);
    const estimateText = event.epsEstimate !== null 
      ? `预期 EPS: $${event.epsEstimate.toFixed(2)}`
      : '预期 EPS: 暂无';

    const message: PushMessage = {
      type: 'earnings',
      symbol: event.symbol,
      title: `📊 财报提醒: ${event.stockName || event.symbol}`,
      message: `${event.stockName || event.symbol} (${event.symbol}) 将于明天${timingText}发布 ${event.fiscalQuarter} ${event.fiscalYear} 财报。${estimateText}`,
      priority: 'high',
      metadata: {
        eventId: event.id,
        symbol: event.symbol,
        reportDate: event.reportDate.toISOString(),
        fiscalQuarter: event.fiscalQuarter,
        fiscalYear: event.fiscalYear,
        timing: event.timing,
        epsEstimate: event.epsEstimate,
        previousEps: event.previousEps,
        reminderType: 'pre_earnings',
      },
    };

    await pushService.pushToUser(userId, message);
    logger.info(`Earnings reminder sent to user ${userId} for ${event.symbol}`);
  }

  /**
   * Send post-earnings comparison notification to a user
   * 
   * @param userId - User's unique identifier
   * @param event - Earnings event with actual results
   * 
   * Implements Requirement 11.5
   */
  async sendEarningsComparisonNotification(
    userId: string,
    event: EarningsEvent
  ): Promise<void> {
    if (!this.config.sendPostEarningsComparison) {
      return;
    }

    const comparison = this.buildEarningsComparison(event);
    const resultText = this.getResultText(comparison);
    const surpriseText = this.getSurpriseText(comparison);

    const message: PushMessage = {
      type: 'earnings',
      symbol: event.symbol,
      title: `📈 财报发布: ${event.stockName || event.symbol} ${resultText}`,
      message: `${event.stockName || event.symbol} (${event.symbol}) ${event.fiscalQuarter} ${event.fiscalYear} 财报已发布。${surpriseText}`,
      priority: comparison.beat === 'beat' ? 'high' : 'medium',
      metadata: {
        eventId: event.id,
        symbol: event.symbol,
        reportDate: event.reportDate.toISOString(),
        fiscalQuarter: event.fiscalQuarter,
        fiscalYear: event.fiscalYear,
        epsEstimate: event.epsEstimate,
        epsActual: event.epsActual,
        epsSurprise: event.epsSurprise,
        epsSurprisePercent: comparison.epsSurprisePercent,
        revenueEstimate: event.revenueEstimate,
        revenueActual: event.revenueActual,
        revenueSurprisePercent: comparison.revenueSurprisePercent,
        beat: comparison.beat,
        reminderType: 'post_earnings',
      },
    };

    await pushService.pushToUser(userId, message);
    logger.info(`Earnings comparison notification sent to user ${userId} for ${event.symbol}`);
  }

  /**
   * Process earnings reminders for all users
   * This should be called by a scheduled job (e.g., daily at market close)
   * 
   * Implements Requirement 11.4
   */
  async processEarningsReminders(): Promise<{ usersNotified: number; remindersCount: number }> {
    let usersNotified = 0;
    let remindersCount = 0;

    try {
      // Get all users with watchlist items
      const usersWithWatchlist = await prisma.user.findMany({
        where: {
          watchlistItems: {
            some: {},
          },
        },
        select: { id: true },
      });

      for (const user of usersWithWatchlist) {
        const events = await this.getEarningsTomorrowForWatchlist(user.id);
        
        if (events.length > 0) {
          usersNotified++;
          for (const event of events) {
            await this.sendEarningsReminder(user.id, event);
            remindersCount++;
          }
        }
      }

      logger.info(`Processed earnings reminders: ${usersNotified} users notified, ${remindersCount} reminders sent`);
    } catch (error) {
      logger.error('Error processing earnings reminders:', error);
      throw error;
    }

    return { usersNotified, remindersCount };
  }

  /**
   * Process post-earnings comparison notifications for all users
   * This should be called by a scheduled job (e.g., hourly or after market hours)
   * 
   * Implements Requirement 11.5
   */
  async processPostEarningsNotifications(): Promise<{ usersNotified: number; notificationsCount: number }> {
    let usersNotified = 0;
    let notificationsCount = 0;

    if (!this.config.sendPostEarningsComparison) {
      return { usersNotified, notificationsCount };
    }

    try {
      // Get all users with watchlist items
      const usersWithWatchlist = await prisma.user.findMany({
        where: {
          watchlistItems: {
            some: {},
          },
        },
        select: { id: true },
      });

      for (const user of usersWithWatchlist) {
        // Look back 24 hours for recent earnings results
        const events = await this.getRecentEarningsResultsForWatchlist(user.id, 24);
        
        if (events.length > 0) {
          usersNotified++;
          for (const event of events) {
            // Only send if we have actual results
            if (event.epsActual !== null) {
              await this.sendEarningsComparisonNotification(user.id, event);
              notificationsCount++;
            }
          }
        }
      }

      logger.info(`Processed post-earnings notifications: ${usersNotified} users notified, ${notificationsCount} notifications sent`);
    } catch (error) {
      logger.error('Error processing post-earnings notifications:', error);
      throw error;
    }

    return { usersNotified, notificationsCount };
  }

  /**
   * Send earnings reminder for a specific user and symbol
   * Can be called manually or by API
   * 
   * @param userId - User's unique identifier
   * @param symbol - Stock symbol
   * @returns true if reminder was sent, false if no upcoming earnings
   */
  async sendEarningsReminderForSymbol(userId: string, symbol: string): Promise<boolean> {
    const normalizedSymbol = symbol.trim().toUpperCase();

    // Get upcoming earnings for this symbol
    const events = await earningsService.getEarningsBySymbol(normalizedSymbol, 1);
    
    if (events.length === 0) {
      logger.debug(`No upcoming earnings found for ${normalizedSymbol}`);
      return false;
    }

    const event = events[0];
    
    // Only send if earnings is in the future
    if (event.reportDate <= new Date()) {
      logger.debug(`Earnings for ${normalizedSymbol} is in the past`);
      return false;
    }

    await this.sendEarningsReminder(userId, event);
    return true;
  }

  /**
   * Build earnings comparison result from event
   */
  private buildEarningsComparison(event: EarningsEvent): EarningsComparisonResult {
    let beat: 'beat' | 'miss' | 'meet' | 'unknown' = 'unknown';

    if (event.epsActual !== null && event.epsEstimate !== null) {
      const diff = event.epsActual - event.epsEstimate;
      if (Math.abs(diff) < 0.01) {
        beat = 'meet';
      } else if (diff > 0) {
        beat = 'beat';
      } else {
        beat = 'miss';
      }
    }

    return {
      symbol: event.symbol,
      stockName: event.stockName || event.symbol,
      fiscalQuarter: event.fiscalQuarter,
      fiscalYear: event.fiscalYear,
      epsEstimate: event.epsEstimate,
      epsActual: event.epsActual,
      epsSurprise: event.epsSurprise,
      epsSurprisePercent: event.epsSurprisePercent,
      revenueEstimate: event.revenueEstimate,
      revenueActual: event.revenueActual,
      revenueSurprisePercent: event.revenueSurprisePercent,
      beat,
    };
  }

  /**
   * Get timing text for earnings release
   */
  private getTimingText(timing: string): string {
    switch (timing) {
      case 'bmo':
        return '盘前';
      case 'amc':
        return '盘后';
      default:
        return '';
    }
  }

  /**
   * Get result text for earnings comparison
   */
  private getResultText(comparison: EarningsComparisonResult): string {
    switch (comparison.beat) {
      case 'beat':
        return '超预期 ✅';
      case 'miss':
        return '不及预期 ❌';
      case 'meet':
        return '符合预期 ➖';
      default:
        return '';
    }
  }

  /**
   * Get surprise text for earnings comparison
   */
  private getSurpriseText(comparison: EarningsComparisonResult): string {
    const parts: string[] = [];

    if (comparison.epsActual !== null) {
      parts.push(`实际 EPS: $${comparison.epsActual.toFixed(2)}`);
      
      if (comparison.epsEstimate !== null) {
        parts.push(`预期: $${comparison.epsEstimate.toFixed(2)}`);
      }

      if (comparison.epsSurprisePercent !== null) {
        const sign = comparison.epsSurprisePercent >= 0 ? '+' : '';
        parts.push(`(${sign}${comparison.epsSurprisePercent.toFixed(1)}%)`);
      }
    }

    return parts.join(' ');
  }
}

// Export singleton instance with default configuration
export const earningsReminderService = new EarningsReminderService();
