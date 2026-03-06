import { prisma } from '../lib/prisma.js';
import { pushService, PushMessage } from './pushService.js';
import { logger } from '../utils/logger.js';

/**
 * SEC Filing Notification Service
 * Implements Requirement 20.2: Push notification when new SEC filing is submitted
 */
export class SECFilingNotificationService {
  /**
   * Notify users about new SEC filing
   * Implements Requirement 20.2: WHEN 公司提交新的 SEC 文件 THEN News_Aggregator SHALL 推送通知提醒用户
   * 
   * @param symbol - Stock symbol
   * @param formType - SEC form type
   * @param filedAt - Filing date
   * @param url - Filing URL
   */
  async notifyNewFiling(
    symbol: string,
    formType: string,
    filedAt: Date,
    url: string
  ): Promise<void> {
    try {
      // Get users who have this stock in their watchlist
      const watchlistUsers = await prisma.watchlistItem.findMany({
        where: { symbol: symbol.toUpperCase() },
        select: { userId: true },
      });

      if (watchlistUsers.length === 0) {
        logger.debug(`No users watching ${symbol}, skipping SEC filing notification`);
        return;
      }

      // Get stock name for better notification
      const stock = await prisma.stock.findUnique({
        where: { symbol: symbol.toUpperCase() },
        select: { name: true },
      });

      const stockName = stock?.name || symbol;
      const formDescription = this.getFormTypeDescription(formType);

      // Create push message
      const message: PushMessage = {
        type: 'sec_filing',
        symbol: symbol.toUpperCase(),
        title: `新SEC文件: ${stockName}`,
        message: `${stockName} (${symbol}) 提交了新的 ${formType} 文件 (${formDescription})`,
        priority: this.getFilingPriority(formType),
        metadata: {
          formType,
          filedAt: filedAt.toISOString(),
          url,
        },
      };

      // Send notification to each user
      const userIds = watchlistUsers.map(w => w.userId);
      const uniqueUserIds = [...new Set(userIds)];

      logger.info(`Notifying ${uniqueUserIds.length} users about new ${formType} filing for ${symbol}`);

      for (const userId of uniqueUserIds) {
        try {
          await pushService.pushToUser(userId, message);
        } catch (error) {
          logger.error(`Failed to notify user ${userId} about SEC filing:`, error);
          // Continue with other users
        }
      }
    } catch (error) {
      logger.error(`Failed to send SEC filing notifications for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Notify users about significant SEC filing (8-K with material events)
   * 
   * @param symbol - Stock symbol
   * @param formType - SEC form type
   * @param summary - Filing summary
   * @param url - Filing URL
   */
  async notifySignificantFiling(
    symbol: string,
    formType: string,
    summary: string,
    url: string
  ): Promise<void> {
    try {
      // Get users who have this stock in their watchlist
      const watchlistUsers = await prisma.watchlistItem.findMany({
        where: { symbol: symbol.toUpperCase() },
        select: { userId: true },
      });

      if (watchlistUsers.length === 0) {
        return;
      }

      // Get stock name
      const stock = await prisma.stock.findUnique({
        where: { symbol: symbol.toUpperCase() },
        select: { name: true },
      });

      const stockName = stock?.name || symbol;

      // Create high priority push message
      const message: PushMessage = {
        type: 'sec_filing',
        symbol: symbol.toUpperCase(),
        title: `重要SEC披露: ${stockName}`,
        message: summary.length > 100 ? summary.substring(0, 100) + '...' : summary,
        priority: 'high',
        metadata: {
          formType,
          url,
          isSignificant: true,
        },
      };

      // Send notification to each user
      const userIds = watchlistUsers.map(w => w.userId);
      const uniqueUserIds = [...new Set(userIds)];

      logger.info(`Notifying ${uniqueUserIds.length} users about significant ${formType} filing for ${symbol}`);

      for (const userId of uniqueUserIds) {
        try {
          await pushService.pushToUser(userId, message);
        } catch (error) {
          logger.error(`Failed to notify user ${userId} about significant SEC filing:`, error);
        }
      }
    } catch (error) {
      logger.error(`Failed to send significant SEC filing notifications for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get form type description in Chinese
   */
  private getFormTypeDescription(formType: string): string {
    const descriptions: Record<string, string> = {
      '10-K': '年度报告',
      '10-Q': '季度报告',
      '8-K': '重大事件报告',
      '4': '内部人士交易',
      'S-1': '注册声明',
      'DEF 14A': '委托书',
      '13F': '机构持仓',
      'SC 13G': '被动投资者持仓',
      'SC 13D': '主动投资者持仓',
    };
    return descriptions[formType] || 'SEC文件';
  }

  /**
   * Get notification priority based on form type
   */
  private getFilingPriority(formType: string): 'high' | 'medium' | 'low' {
    // High priority for material events
    if (['8-K', 'S-1'].includes(formType)) {
      return 'high';
    }
    // Medium priority for regular reports
    if (['10-K', '10-Q', 'DEF 14A'].includes(formType)) {
      return 'medium';
    }
    // Low priority for other filings
    return 'low';
  }

  /**
   * Check for new SEC filings and send notifications
   * This would typically be called by a scheduled job
   */
  async checkAndNotifyNewFilings(): Promise<void> {
    try {
      // Get filings from the last hour that haven't been notified
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const newFilings = await prisma.sECFiling.findMany({
        where: {
          createdAt: {
            gte: oneHourAgo,
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

      logger.info(`Found ${newFilings.length} new SEC filings to notify`);

      for (const filing of newFilings) {
        await this.notifyNewFiling(
          filing.symbol,
          filing.formType,
          filing.filedAt,
          filing.url
        );
      }
    } catch (error) {
      logger.error('Failed to check and notify new SEC filings:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const secFilingNotificationService = new SECFilingNotificationService();
