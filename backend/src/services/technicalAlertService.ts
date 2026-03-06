// Note: prisma is available for future database operations
// import { prisma } from '../lib/prisma.js';
import { getRedisClient } from '../lib/redis.js';
import { logger } from '../utils/logger.js';
import { pushService, PushMessage } from './pushService.js';
import { technicalIndicatorService, TechnicalIndicators } from './technicalIndicatorService.js';
import { stockService } from './stockService.js';

export type IndicatorType = 'rsi' | 'macd' | 'sma' | 'ema' | 'bollinger';
export type AlertCondition = 'above' | 'below' | 'cross_above' | 'cross_below';

export interface TechnicalAlertConfig {
  id?: string;
  userId: string;
  symbol: string;
  indicatorType: IndicatorType;
  indicatorParams?: Record<string, number>; // e.g., { period: 14 } for RSI
  condition: AlertCondition;
  targetValue: number;
  enabled: boolean;
}

export interface TechnicalSignal {
  symbol: string;
  indicatorType: IndicatorType;
  currentValue: number;
  targetValue: number;
  condition: AlertCondition;
  triggered: boolean;
  timestamp: Date;
}

export class TechnicalAlertService {
  private redis = getRedisClient();
  private readonly ALERT_CHECK_INTERVAL = 60000; // 1 minute
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * 创建技术指标提醒
   */
  async createAlert(config: TechnicalAlertConfig): Promise<string> {
    try {
      // 存储到 Redis（使用 hash 结构）
      const alertId = config.id || `ta_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const key = `technical_alert:${config.userId}:${alertId}`;

      if (this.redis.status === 'ready') {
        await this.redis.hset(key, {
          id: alertId,
          userId: config.userId,
          symbol: config.symbol,
          indicatorType: config.indicatorType,
          indicatorParams: JSON.stringify(config.indicatorParams || {}),
          condition: config.condition,
          targetValue: config.targetValue.toString(),
          enabled: config.enabled ? '1' : '0',
          createdAt: new Date().toISOString(),
        });

        // 添加到用户的提醒列表
        await this.redis.sadd(`technical_alerts:${config.userId}`, alertId);
      }

      logger.info(`创建技术指标提醒: ${alertId} for ${config.symbol}`);
      return alertId;
    } catch (error) {
      logger.error('创建技术指标提醒失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的技术指标提醒列表
   */
  async getUserAlerts(userId: string): Promise<TechnicalAlertConfig[]> {
    try {
      if (this.redis.status !== 'ready') return [];

      const alertIds = await this.redis.smembers(`technical_alerts:${userId}`);
      const alerts: TechnicalAlertConfig[] = [];

      for (const alertId of alertIds) {
        const key = `technical_alert:${userId}:${alertId}`;
        const data = await this.redis.hgetall(key);

        if (data && Object.keys(data).length > 0) {
          alerts.push({
            id: data.id,
            userId: data.userId,
            symbol: data.symbol,
            indicatorType: data.indicatorType as IndicatorType,
            indicatorParams: JSON.parse(data.indicatorParams || '{}'),
            condition: data.condition as AlertCondition,
            targetValue: parseFloat(data.targetValue),
            enabled: data.enabled === '1',
          });
        }
      }

      return alerts;
    } catch (error) {
      logger.error('获取用户技术指标提醒失败:', error);
      throw error;
    }
  }


  /**
   * 删除技术指标提醒
   */
  async deleteAlert(userId: string, alertId: string): Promise<void> {
    try {
      if (this.redis.status !== 'ready') return;

      const key = `technical_alert:${userId}:${alertId}`;
      await this.redis.del(key);
      await this.redis.srem(`technical_alerts:${userId}`, alertId);

      logger.info(`删除技术指标提醒: ${alertId}`);
    } catch (error) {
      logger.error('删除技术指标提醒失败:', error);
      throw error;
    }
  }

  /**
   * 更新技术指标提醒
   */
  async updateAlert(userId: string, alertId: string, updates: Partial<TechnicalAlertConfig>): Promise<void> {
    try {
      if (this.redis.status !== 'ready') return;

      const key = `technical_alert:${userId}:${alertId}`;
      const updateData: Record<string, string> = {};

      if (updates.targetValue !== undefined) {
        updateData.targetValue = updates.targetValue.toString();
      }
      if (updates.condition !== undefined) {
        updateData.condition = updates.condition;
      }
      if (updates.enabled !== undefined) {
        updateData.enabled = updates.enabled ? '1' : '0';
      }
      if (updates.indicatorParams !== undefined) {
        updateData.indicatorParams = JSON.stringify(updates.indicatorParams);
      }

      if (Object.keys(updateData).length > 0) {
        await this.redis.hset(key, updateData);
      }

      logger.info(`更新技术指标提醒: ${alertId}`);
    } catch (error) {
      logger.error('更新技术指标提醒失败:', error);
      throw error;
    }
  }

  /**
   * 检查技术指标信号
   */
  async checkSignal(alert: TechnicalAlertConfig): Promise<TechnicalSignal> {
    try {
      // Get historical data for the stock
      const ohlcvData = await stockService.getHistoricalData(alert.symbol, '1M');
      
      if (!ohlcvData || ohlcvData.length === 0) {
        return {
          symbol: alert.symbol,
          indicatorType: alert.indicatorType,
          currentValue: 0,
          targetValue: alert.targetValue,
          condition: alert.condition,
          triggered: false,
          timestamp: new Date(),
        };
      }

      const indicators: TechnicalIndicators = await technicalIndicatorService.getTechnicalIndicators(alert.symbol, ohlcvData);
      
      if (!indicators) {
        return {
          symbol: alert.symbol,
          indicatorType: alert.indicatorType,
          currentValue: 0,
          targetValue: alert.targetValue,
          condition: alert.condition,
          triggered: false,
          timestamp: new Date(),
        };
      }

      let currentValue = 0;

      switch (alert.indicatorType) {
        case 'rsi':
          currentValue = indicators.rsi14 || 0;
          break;
        case 'macd':
          currentValue = indicators.macd?.histogram || 0;
          break;
        case 'sma':
          const smaPeriod = alert.indicatorParams?.period || 20;
          if (smaPeriod === 20) currentValue = indicators.sma20 || 0;
          else if (smaPeriod === 50) currentValue = indicators.sma50 || 0;
          else if (smaPeriod === 200) currentValue = indicators.sma200 || 0;
          break;
        case 'ema':
          const emaPeriod = alert.indicatorParams?.period || 12;
          if (emaPeriod === 12) currentValue = indicators.ema12 || 0;
          else if (emaPeriod === 26) currentValue = indicators.ema26 || 0;
          break;
        case 'bollinger':
          currentValue = indicators.bollingerBands?.middle || 0;
          break;
      }

      const triggered = this.evaluateCondition(currentValue, alert.targetValue, alert.condition);

      return {
        symbol: alert.symbol,
        indicatorType: alert.indicatorType,
        currentValue,
        targetValue: alert.targetValue,
        condition: alert.condition,
        triggered,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error(`检查技术指标信号失败 (${alert.symbol}):`, error);
      throw error;
    }
  }

  /**
   * 评估条件是否满足
   */
  evaluateCondition(currentValue: number, targetValue: number, condition: AlertCondition): boolean {
    switch (condition) {
      case 'above':
        return currentValue > targetValue;
      case 'below':
        return currentValue < targetValue;
      case 'cross_above':
        // 简化处理：当前值刚好超过目标值
        return currentValue > targetValue && currentValue <= targetValue * 1.02;
      case 'cross_below':
        // 简化处理：当前值刚好低于目标值
        return currentValue < targetValue && currentValue >= targetValue * 0.98;
      default:
        return false;
    }
  }


  /**
   * 检查所有用户的技术指标提醒
   */
  async checkAllAlerts(): Promise<void> {
    try {
      if (this.redis.status !== 'ready') return;

      // 获取所有有技术指标提醒的用户
      const userKeys = await this.redis.keys('technical_alerts:*');

      for (const userKey of userKeys) {
        const userId = userKey.replace('technical_alerts:', '');
        const alerts = await this.getUserAlerts(userId);

        for (const alert of alerts) {
          if (!alert.enabled) continue;

          try {
            const signal = await this.checkSignal(alert);

            if (signal.triggered) {
              await this.sendAlertNotification(userId, alert, signal);
              
              // 触发后禁用提醒（避免重复触发）
              await this.updateAlert(userId, alert.id!, { enabled: false });
            }
          } catch (error) {
            logger.error(`检查提醒失败 (${alert.id}):`, error);
          }
        }
      }
    } catch (error) {
      logger.error('检查所有技术指标提醒失败:', error);
    }
  }

  /**
   * 发送提醒通知
   */
  async sendAlertNotification(
    userId: string,
    alert: TechnicalAlertConfig,
    signal: TechnicalSignal
  ): Promise<void> {
    try {
      const indicatorNames: Record<IndicatorType, string> = {
        rsi: 'RSI',
        macd: 'MACD',
        sma: 'SMA',
        ema: 'EMA',
        bollinger: '布林带',
      };

      const conditionTexts: Record<AlertCondition, string> = {
        above: '高于',
        below: '低于',
        cross_above: '上穿',
        cross_below: '下穿',
      };

      const message: PushMessage = {
        type: 'price',
        symbol: alert.symbol,
        title: `${alert.symbol} 技术指标信号`,
        message: `${indicatorNames[alert.indicatorType]} ${conditionTexts[alert.condition]} ${alert.targetValue}，当前值: ${signal.currentValue.toFixed(2)}`,
        priority: 'high',
        metadata: {
          indicatorType: alert.indicatorType,
          currentValue: signal.currentValue,
          targetValue: alert.targetValue,
          condition: alert.condition,
        },
      };

      await pushService.pushToUser(userId, message);

      logger.info(`发送技术指标提醒: ${alert.symbol} ${alert.indicatorType} to user ${userId}`);
    } catch (error) {
      logger.error('发送技术指标提醒失败:', error);
      throw error;
    }
  }

  /**
   * 启动定时检查
   */
  startPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkAllAlerts().catch((error) => {
        logger.error('定时检查技术指标提醒失败:', error);
      });
    }, this.ALERT_CHECK_INTERVAL);

    logger.info('技术指标提醒定时检查已启动');
  }

  /**
   * 停止定时检查
   */
  stopPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('技术指标提醒定时检查已停止');
    }
  }

  /**
   * 获取常用技术指标预设
   */
  getPresetAlerts(): { name: string; config: Partial<TechnicalAlertConfig> }[] {
    return [
      {
        name: 'RSI 超买',
        config: {
          indicatorType: 'rsi',
          condition: 'above',
          targetValue: 70,
        },
      },
      {
        name: 'RSI 超卖',
        config: {
          indicatorType: 'rsi',
          condition: 'below',
          targetValue: 30,
        },
      },
      {
        name: 'MACD 金叉',
        config: {
          indicatorType: 'macd',
          condition: 'cross_above',
          targetValue: 0,
        },
      },
      {
        name: 'MACD 死叉',
        config: {
          indicatorType: 'macd',
          condition: 'cross_below',
          targetValue: 0,
        },
      },
      {
        name: '价格突破 SMA20',
        config: {
          indicatorType: 'sma',
          indicatorParams: { period: 20 },
          condition: 'cross_above',
          targetValue: 0, // 将在创建时设置为当前 SMA20 值
        },
      },
    ];
  }
}

// 导出单例实例
export const technicalAlertService = new TechnicalAlertService();
