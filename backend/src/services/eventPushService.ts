import { prisma } from '../lib/prisma.js';
import { logger } from '../utils/logger.js';
import { pushService, PushMessage } from './pushService.js';
import { earningsReminderService } from './earningsReminderService.js';
import { dividendReminderService } from './dividendReminderService.js';
// Note: insiderNotificationService and secFilingNotificationService are available for future use
// import { insiderNotificationService } from './insiderNotificationService.js';
// import { secFilingNotificationService } from './secFilingNotificationService.js';

export type EventType = 
  | 'earnings'
  | 'dividend'
  | 'insider'
  | 'rating_change'
  | 'sec_filing'
  | 'price_alert'
  | 'technical_signal';

export type EventPriority = 'high' | 'medium' | 'low';

export interface EventConfig {
  type: EventType;
  enabled: boolean;
  priority: EventPriority;
}

export interface PushEvent {
  id: string;
  type: EventType;
  symbol?: string;
  title: string;
  message: string;
  priority: EventPriority;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * 事件推送整合服务
 * 统一管理所有类型的事件推送
 */
export class EventPushService {
  // 事件优先级权重
  private readonly PRIORITY_WEIGHTS: Record<EventPriority, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  // 默认事件优先级
  private readonly DEFAULT_PRIORITIES: Record<EventType, EventPriority> = {
    earnings: 'high',
    dividend: 'medium',
    insider: 'high',
    rating_change: 'medium',
    sec_filing: 'medium',
    price_alert: 'high',
    technical_signal: 'medium',
  };

  /**
   * 推送事件给用户
   */
  async pushEvent(userId: string, event: PushEvent): Promise<void> {
    try {
      // 检查用户是否启用了该类型的推送
      const isEnabled = await this.isEventTypeEnabled(userId, event.type);
      if (!isEnabled) {
        logger.debug(`用户 ${userId} 已禁用 ${event.type} 类型推送`);
        return;
      }

      const message: PushMessage = {
        type: this.mapEventTypeToPushType(event.type),
        symbol: event.symbol,
        title: event.title,
        message: event.message,
        priority: event.priority,
        metadata: {
          ...event.metadata,
          eventType: event.type,
          eventId: event.id,
        },
      };

      await pushService.pushToUser(userId, message);
      logger.info(`推送事件 ${event.type} 给用户 ${userId}`);
    } catch (error) {
      logger.error(`推送事件失败 (userId: ${userId}, type: ${event.type}):`, error);
      throw error;
    }
  }

  /**
   * 批量推送事件给多个用户
   */
  async pushEventToUsers(userIds: string[], event: PushEvent): Promise<void> {
    const results = await Promise.allSettled(
      userIds.map((userId) => this.pushEvent(userId, event))
    );

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      logger.warn(`批量推送事件失败: ${failures.length}/${userIds.length}`);
    }
  }

  /**
   * 推送事件给股票订阅者
   */
  async pushEventToStockSubscribers(symbol: string, event: PushEvent): Promise<void> {
    try {
      // 获取订阅该股票的用户
      const subscribers = await prisma.watchlistItem.findMany({
        where: { symbol },
        select: { userId: true },
      });

      const userIds = [...new Set(subscribers.map((s) => s.userId))];
      await this.pushEventToUsers(userIds, event);
    } catch (error) {
      logger.error(`推送事件给股票订阅者失败 (${symbol}):`, error);
      throw error;
    }
  }


  /**
   * 按优先级排序事件
   */
  sortEventsByPriority(events: PushEvent[]): PushEvent[] {
    return [...events].sort((a, b) => {
      const weightA = this.PRIORITY_WEIGHTS[a.priority];
      const weightB = this.PRIORITY_WEIGHTS[b.priority];
      
      // 优先级高的排前面
      if (weightB !== weightA) {
        return weightB - weightA;
      }
      
      // 同优先级按时间排序（新的在前）
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  /**
   * 检查用户是否启用了某类型的事件推送
   */
  async isEventTypeEnabled(userId: string, _eventType: EventType): Promise<boolean> {
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
      });

      if (!settings || !settings.pushEnabled) {
        return false;
      }

      // 默认所有事件类型都启用
      // 可以扩展 UserSettings 模型来存储每种事件类型的启用状态
      return true;
    } catch (error) {
      logger.error(`检查事件类型启用状态失败:`, error);
      return true; // 默认启用
    }
  }

  /**
   * 获取事件的默认优先级
   */
  getDefaultPriority(eventType: EventType): EventPriority {
    return this.DEFAULT_PRIORITIES[eventType] || 'medium';
  }

  /**
   * 映射事件类型到推送消息类型
   */
  private mapEventTypeToPushType(eventType: EventType): PushMessage['type'] {
    const mapping: Record<EventType, PushMessage['type']> = {
      earnings: 'earnings',
      dividend: 'dividend',
      insider: 'insider',
      rating_change: 'rating',
      sec_filing: 'sec_filing',
      price_alert: 'price',
      technical_signal: 'price',
    };
    return mapping[eventType] || 'news';
  }

  /**
   * 创建财报事件
   */
  createEarningsEvent(data: {
    symbol: string;
    reportDate: Date;
    fiscalQuarter: string;
    isReminder: boolean;
    epsEstimate?: number;
    epsActual?: number;
  }): PushEvent {
    const isReminder = data.isReminder;
    
    return {
      id: `earnings_${data.symbol}_${Date.now()}`,
      type: 'earnings',
      symbol: data.symbol,
      title: isReminder ? `${data.symbol} 财报提醒` : `${data.symbol} 财报发布`,
      message: isReminder
        ? `${data.symbol} 将于 ${data.reportDate.toLocaleDateString('zh-CN')} 发布 ${data.fiscalQuarter} 财报`
        : `${data.symbol} ${data.fiscalQuarter} 财报已发布，EPS: ${data.epsActual?.toFixed(2) || 'N/A'}（预期: ${data.epsEstimate?.toFixed(2) || 'N/A'}）`,
      priority: 'high',
      metadata: data,
      createdAt: new Date(),
    };
  }

  /**
   * 创建股息事件
   */
  createDividendEvent(data: {
    symbol: string;
    exDate: Date;
    amount: number;
    isReminder: boolean;
  }): PushEvent {
    return {
      id: `dividend_${data.symbol}_${Date.now()}`,
      type: 'dividend',
      symbol: data.symbol,
      title: data.isReminder ? `${data.symbol} 除息日提醒` : `${data.symbol} 股息公告`,
      message: data.isReminder
        ? `${data.symbol} 除息日为 ${data.exDate.toLocaleDateString('zh-CN')}，每股股息 $${data.amount.toFixed(2)}`
        : `${data.symbol} 宣布每股股息 $${data.amount.toFixed(2)}`,
      priority: 'medium',
      metadata: data,
      createdAt: new Date(),
    };
  }

  /**
   * 创建内部交易事件
   */
  createInsiderEvent(data: {
    symbol: string;
    insiderName: string;
    transactionType: string;
    shares: number;
    totalValue: number;
  }): PushEvent {
    const action = data.transactionType === 'buy' ? '买入' : '卖出';
    
    return {
      id: `insider_${data.symbol}_${Date.now()}`,
      type: 'insider',
      symbol: data.symbol,
      title: `${data.symbol} 内部交易`,
      message: `${data.insiderName} ${action} ${data.shares.toLocaleString()} 股，总价值 $${data.totalValue.toLocaleString()}`,
      priority: 'high',
      metadata: data,
      createdAt: new Date(),
    };
  }

  /**
   * 创建评级变化事件
   */
  createRatingChangeEvent(data: {
    symbol: string;
    analyst: string;
    firm: string;
    newRating: string;
    previousRating?: string;
    targetPrice?: number;
  }): PushEvent {
    const ratingText = data.previousRating
      ? `从 ${data.previousRating} 调整为 ${data.newRating}`
      : `评级为 ${data.newRating}`;

    return {
      id: `rating_${data.symbol}_${Date.now()}`,
      type: 'rating_change',
      symbol: data.symbol,
      title: `${data.symbol} 评级变化`,
      message: `${data.firm} ${ratingText}${data.targetPrice ? `，目标价 $${data.targetPrice}` : ''}`,
      priority: 'medium',
      metadata: data,
      createdAt: new Date(),
    };
  }

  /**
   * 创建 SEC 文件事件
   */
  createSECFilingEvent(data: {
    symbol: string;
    formType: string;
    filedAt: Date;
    summary?: string;
  }): PushEvent {
    return {
      id: `sec_${data.symbol}_${Date.now()}`,
      type: 'sec_filing',
      symbol: data.symbol,
      title: `${data.symbol} SEC 文件`,
      message: `${data.symbol} 提交了 ${data.formType} 文件${data.summary ? `：${data.summary}` : ''}`,
      priority: 'medium',
      metadata: data,
      createdAt: new Date(),
    };
  }

  /**
   * 启动所有事件监控
   */
  async startAllMonitors(): Promise<void> {
    try {
      // 事件监控已启动 - 各服务会在需要时自动处理
      logger.info('所有事件监控已启动');
    } catch (error) {
      logger.error('启动事件监控失败:', error);
      throw error;
    }
  }

  /**
   * 停止所有事件监控
   */
  stopAllMonitors(): void {
    // 事件监控已停止
    logger.info('所有事件监控已停止');
  }
}

// 导出单例实例
export const eventPushService = new EventPushService();
