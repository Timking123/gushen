import { prisma } from '../lib/prisma.js';
import { logger } from '../utils/logger.js';
import { pushService } from './pushService.js';

/**
 * Dividend change event for notifications
 */
export interface DividendChangeEvent {
  symbol: string;
  stockName: string;
  previousAmount: number;
  newAmount: number;
  changePercent: number;
  exDate: Date;
}

/**
 * Upcoming dividend reminder
 */
export interface UpcomingDividendReminder {
  symbol: string;
  stockName: string;
  exDate: Date;
  payDate: Date;
  amount: number;
  yield: number | null;
  daysUntilExDate: number;
}

/**
 * DividendReminderService - Handles dividend reminder notifications
 * 
 * Implements Requirements:
 * - 15.3: WHEN 自选股即将除息 THEN Dividend_Tracker SHALL 提前推送提醒通知
 * - 15.5: WHEN 公司宣布股息变化 THEN Dividend_Tracker SHALL 推送股息增减通知
 */
export class DividendReminderService {
  private readonly DEFAULT_REMINDER_DAYS = 3; // Days before ex-date to send reminder

  /**
   * Check and send reminders for upcoming dividends
   * 
   * Implements Requirement 15.3: Push reminder before ex-dividend date
   * 
   * @param reminderDays - Number of days before ex-date to send reminder
   */
  async checkAndSendUpcomingDividendReminders(
    reminderDays: number = this.DEFAULT_REMINDER_DAYS
  ): Promise<void> {
    logger.info(`Checking for upcoming dividend reminders (${reminderDays} days ahead)`);

    try {
      // Get all users with watchlist items
      const usersWithWatchlist = await prisma.user.findMany({
        where: {
          settings: {
            pushEnabled: true,
          },
        },
        include: {
          watchlistItems: {
            select: {
              symbol: true,
            },
          },
          settings: true,
        },
      });

      // Calculate the target date range
      const now = new Date();
      const targetDate = new Date(now.getTime() + reminderDays * 24 * 60 * 60 * 1000);
      const startOfTargetDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfTargetDay = new Date(targetDate.setHours(23, 59, 59, 999));

      for (const user of usersWithWatchlist) {
        if (user.watchlistItems.length === 0) continue;

        const symbols = user.watchlistItems.map((w) => w.symbol);

        // Find dividends for user's watchlist stocks on the target date
        const upcomingDividends = await prisma.dividendEvent.findMany({
          where: {
            symbol: { in: symbols },
            exDate: {
              gte: startOfTargetDay,
              lte: endOfTargetDay,
            },
          },
          include: {
            stock: {
              select: {
                name: true,
              },
            },
          },
        });

        // Send reminders for each upcoming dividend
        for (const dividend of upcomingDividends) {
          await this.sendUpcomingDividendReminder(user.id, {
            symbol: dividend.symbol,
            stockName: dividend.stock.name,
            exDate: dividend.exDate,
            payDate: dividend.payDate,
            amount: dividend.amount,
            yield: dividend.yield,
            daysUntilExDate: reminderDays,
          });
        }
      }

      logger.info('Completed checking for upcoming dividend reminders');
    } catch (error) {
      logger.error('Error checking for upcoming dividend reminders:', error);
      throw error;
    }
  }

  /**
   * Send upcoming dividend reminder to a user
   * 
   * @param userId - User ID
   * @param reminder - Reminder details
   */
  async sendUpcomingDividendReminder(
    userId: string,
    reminder: UpcomingDividendReminder
  ): Promise<void> {
    const title = `股息提醒: ${reminder.symbol}`;
    const message = `${reminder.stockName} (${reminder.symbol}) 将于 ${reminder.daysUntilExDate} 天后除息。` +
      `\n除息日: ${this.formatDate(reminder.exDate)}` +
      `\n派息日: ${this.formatDate(reminder.payDate)}` +
      `\n每股股息: $${reminder.amount.toFixed(4)}` +
      (reminder.yield ? `\n股息率: ${reminder.yield.toFixed(2)}%` : '');

    try {
      // Create alert in database
      await prisma.alert.create({
        data: {
          userId,
          type: 'dividend',
          symbol: reminder.symbol,
          title,
          message,
          priority: 'medium',
          metadata: {
            exDate: reminder.exDate.toISOString(),
            payDate: reminder.payDate.toISOString(),
            amount: reminder.amount,
            yield: reminder.yield,
            daysUntilExDate: reminder.daysUntilExDate,
          },
        },
      });

      // Send push notification
      await pushService.pushToUser(userId, {
        type: 'dividend',
        symbol: reminder.symbol,
        title,
        message,
        priority: 'medium',
        metadata: {
          exDate: reminder.exDate.toISOString(),
          payDate: reminder.payDate.toISOString(),
          amount: reminder.amount,
          yield: reminder.yield,
          daysUntilExDate: reminder.daysUntilExDate,
        },
      });

      logger.debug(`Sent upcoming dividend reminder to user ${userId} for ${reminder.symbol}`);
    } catch (error) {
      logger.error(`Failed to send dividend reminder to user ${userId}:`, error);
    }
  }

  /**
   * Check and notify users about dividend changes
   * 
   * Implements Requirement 15.5: Push notification when dividend changes
   * 
   * @param changeEvent - Dividend change event details
   */
  async notifyDividendChange(changeEvent: DividendChangeEvent): Promise<void> {
    logger.info(`Processing dividend change notification for ${changeEvent.symbol}`);

    try {
      // Find all users who have this stock in their watchlist
      const usersWithStock = await prisma.watchlistItem.findMany({
        where: {
          symbol: changeEvent.symbol,
        },
        include: {
          user: {
            include: {
              settings: true,
            },
          },
        },
      });

      const changeDirection = changeEvent.changePercent > 0 ? '增加' : '减少';
      const changeIcon = changeEvent.changePercent > 0 ? '📈' : '📉';

      for (const watchlistItem of usersWithStock) {
        const user = watchlistItem.user;

        // Skip if push is disabled
        if (!user.settings?.pushEnabled) continue;

        const title = `${changeIcon} 股息变化: ${changeEvent.symbol}`;
        const message = `${changeEvent.stockName} (${changeEvent.symbol}) 宣布股息${changeDirection}。` +
          `\n原股息: $${changeEvent.previousAmount.toFixed(4)}` +
          `\n新股息: $${changeEvent.newAmount.toFixed(4)}` +
          `\n变化幅度: ${changeEvent.changePercent > 0 ? '+' : ''}${changeEvent.changePercent.toFixed(2)}%` +
          `\n除息日: ${this.formatDate(changeEvent.exDate)}`;

        // Create alert in database
        await prisma.alert.create({
          data: {
            userId: user.id,
            type: 'dividend',
            symbol: changeEvent.symbol,
            title,
            message,
            priority: Math.abs(changeEvent.changePercent) > 10 ? 'high' : 'medium',
            metadata: {
              previousAmount: changeEvent.previousAmount,
              newAmount: changeEvent.newAmount,
              changePercent: changeEvent.changePercent,
              exDate: changeEvent.exDate.toISOString(),
            },
          },
        });

        // Send push notification
        await pushService.pushToUser(user.id, {
          type: 'dividend',
          symbol: changeEvent.symbol,
          title,
          message,
          priority: Math.abs(changeEvent.changePercent) > 10 ? 'high' : 'medium',
          metadata: {
            previousAmount: changeEvent.previousAmount,
            newAmount: changeEvent.newAmount,
            changePercent: changeEvent.changePercent,
            exDate: changeEvent.exDate.toISOString(),
          },
        });

        logger.debug(`Sent dividend change notification to user ${user.id} for ${changeEvent.symbol}`);
      }

      logger.info(`Completed dividend change notifications for ${changeEvent.symbol}`);
    } catch (error) {
      logger.error(`Error sending dividend change notifications for ${changeEvent.symbol}:`, error);
      throw error;
    }
  }

  /**
   * Detect dividend changes by comparing with previous dividend
   * 
   * @param symbol - Stock symbol
   * @param newAmount - New dividend amount
   * @param exDate - Ex-dividend date
   * @returns Dividend change event if change detected, null otherwise
   */
  async detectDividendChange(
    symbol: string,
    newAmount: number,
    exDate: Date
  ): Promise<DividendChangeEvent | null> {
    try {
      // Get the previous dividend for this stock
      const previousDividend = await prisma.dividendEvent.findFirst({
        where: {
          symbol: symbol.toUpperCase(),
          exDate: { lt: exDate },
        },
        orderBy: { exDate: 'desc' },
        include: {
          stock: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!previousDividend) {
        return null; // No previous dividend to compare
      }

      // Calculate change percentage
      const changePercent = ((newAmount - previousDividend.amount) / previousDividend.amount) * 100;

      // Only notify if change is significant (> 1%)
      if (Math.abs(changePercent) < 1) {
        return null;
      }

      return {
        symbol: symbol.toUpperCase(),
        stockName: previousDividend.stock.name,
        previousAmount: previousDividend.amount,
        newAmount,
        changePercent,
        exDate,
      };
    } catch (error) {
      logger.error(`Error detecting dividend change for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

// Export singleton instance
export const dividendReminderService = new DividendReminderService();
