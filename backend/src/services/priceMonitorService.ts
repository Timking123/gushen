import { prisma } from '../lib/prisma.js';
import { getRedisClient } from '../lib/redis.js';
import { logger } from '../utils/logger.js';
import { pushService, PushMessage } from './pushService.js';
import { StockQuote } from '../types/index.js';

export class PriceMonitorService {
  private redis = getRedisClient();
  private readonly LAST_PRICE_PREFIX = 'price:last:';
  private monitoringInterval: NodeJS.Timeout | null = null;

  /**
   * Start price monitoring
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      logger.warn('Price monitoring already running');
      return;
    }

    logger.info(`Starting price monitoring with ${intervalMs}ms interval`);
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkPriceAlerts();
      } catch (error) {
        logger.error('Error in price monitoring:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop price monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Price monitoring stopped');
    }
  }

  /**
   * Check all active price alerts
   */
  async checkPriceAlerts(): Promise<void> {
    try {
      // Get all untriggered price alerts
      const alerts = await prisma.priceAlert.findMany({
        where: {
          triggered: false,
        },
        include: {
          user: {
            include: {
              settings: true,
            },
          },
        },
      });

      if (alerts.length === 0) {
        return;
      }

      logger.debug(`Checking ${alerts.length} price alerts`);

      // Group alerts by symbol for efficient processing
      const alertsBySymbol = new Map<string, typeof alerts>();
      for (const alert of alerts) {
        const existing = alertsBySymbol.get(alert.symbol) || [];
        existing.push(alert);
        alertsBySymbol.set(alert.symbol, existing);
      }

      // Check each symbol
      for (const [symbol, symbolAlerts] of alertsBySymbol.entries()) {
        try {
          await this.checkSymbolAlerts(symbol, symbolAlerts);
        } catch (error) {
          logger.error(`Error checking alerts for ${symbol}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error checking price alerts:', error);
      throw error;
    }
  }

  /**
   * Check alerts for a specific symbol
   */
  private async checkSymbolAlerts(
    symbol: string,
    alerts: Array<{
      id: string;
      userId: string;
      symbol: string;
      condition: string;
      targetValue: number;
      user: {
        settings: {
          priceAlertThreshold: number;
        } | null;
      };
    }>
  ): Promise<void> {
    try {
      // Get current price
      const currentQuote = await this.getCurrentPrice(symbol);
      if (!currentQuote) {
        logger.warn(`No current price available for ${symbol}`);
        return;
      }

      // Get previous price for change_percent calculation
      const previousPrice = await this.getPreviousPrice(symbol);

      // Check each alert
      for (const alert of alerts) {
        try {
          const shouldTrigger = this.shouldTriggerAlert(
            alert,
            currentQuote,
            previousPrice
          );

          if (shouldTrigger) {
            await this.triggerAlert(alert, currentQuote);
          }
        } catch (error) {
          logger.error(`Error processing alert ${alert.id}:`, error);
        }
      }

      // Update last price
      await this.updateLastPrice(symbol, currentQuote.price);
    } catch (error) {
      logger.error(`Error checking symbol alerts for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Check if alert should be triggered
   */
  private shouldTriggerAlert(
    alert: {
      condition: string;
      targetValue: number;
      user: {
        settings: {
          priceAlertThreshold: number;
        } | null;
      };
    },
    currentQuote: StockQuote,
    previousPrice: number | null
  ): boolean {
    const currentPrice = currentQuote.price;

    switch (alert.condition) {
      case 'above':
        return currentPrice >= alert.targetValue;

      case 'below':
        return currentPrice <= alert.targetValue;

      case 'change_percent': {
        if (!previousPrice) {
          // Use previous close if no cached price
          previousPrice = currentQuote.previousClose;
        }
        
        const changePercent = Math.abs(
          ((currentPrice - previousPrice) / previousPrice) * 100
        );
        
        return changePercent >= alert.targetValue;
      }

      default:
        logger.warn(`Unknown alert condition: ${alert.condition}`);
        return false;
    }
  }

  /**
   * Trigger a price alert
   */
  private async triggerAlert(
    alert: {
      id: string;
      userId: string;
      symbol: string;
      condition: string;
      targetValue: number;
    },
    currentQuote: StockQuote
  ): Promise<void> {
    try {
      // Mark alert as triggered
      await prisma.priceAlert.update({
        where: { id: alert.id },
        data: {
          triggered: true,
          triggeredAt: new Date(),
        },
      });

      // Create push message
      const message: PushMessage = {
        type: 'price',
        symbol: alert.symbol,
        title: `价格提醒: ${alert.symbol}`,
        message: this.formatAlertMessage(alert, currentQuote),
        priority: 'high',
        metadata: {
          alertId: alert.id,
          condition: alert.condition,
          targetValue: alert.targetValue,
          currentPrice: currentQuote.price,
          change: currentQuote.change,
          changePercent: currentQuote.changePercent,
        },
      };

      // Push to user
      await pushService.pushToUser(alert.userId, message);

      logger.info(`Triggered price alert ${alert.id} for user ${alert.userId}`);
    } catch (error) {
      logger.error(`Failed to trigger alert ${alert.id}:`, error);
      throw error;
    }
  }

  /**
   * Format alert message
   */
  private formatAlertMessage(
    alert: {
      symbol: string;
      condition: string;
      targetValue: number;
    },
    currentQuote: StockQuote
  ): string {
    const price = currentQuote.price.toFixed(2);
    const change = currentQuote.change.toFixed(2);
    const changePercent = currentQuote.changePercent.toFixed(2);
    const changeNum = currentQuote.change;

    switch (alert.condition) {
      case 'above':
        return `${alert.symbol} 价格已达到 $${price}，超过设定值 $${alert.targetValue.toFixed(2)}`;

      case 'below':
        return `${alert.symbol} 价格已降至 $${price}，低于设定值 $${alert.targetValue.toFixed(2)}`;

      case 'change_percent':
        return `${alert.symbol} 价格波动 ${changePercent}%，当前价格 $${price} (${changeNum >= 0 ? '+' : ''}${change})`;

      default:
        return `${alert.symbol} 价格提醒触发，当前价格 $${price}`;
    }
  }

  /**
   * Get current price from database
   */
  private async getCurrentPrice(symbol: string): Promise<StockQuote | null> {
    try {
      const quote = await prisma.stockQuote.findFirst({
        where: { symbol },
        orderBy: { timestamp: 'desc' },
      });

      if (!quote) {
        return null;
      }

      // Convert bigint to number for volume
      return {
        ...quote,
        volume: Number(quote.volume),
        avgVolume: quote.avgVolume ? Number(quote.avgVolume) : null,
      };
    } catch (error) {
      logger.error(`Failed to get current price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get previous price from cache
   */
  private async getPreviousPrice(symbol: string): Promise<number | null> {
    try {
      if (this.redis.status === 'ready') {
        const cached = await this.redis.get(`${this.LAST_PRICE_PREFIX}${symbol}`);
        return cached ? parseFloat(cached) : null;
      }
      return null;
    } catch (error) {
      logger.error(`Failed to get previous price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Update last price in cache
   */
  private async updateLastPrice(symbol: string, price: number): Promise<void> {
    try {
      if (this.redis.status === 'ready') {
        await this.redis.set(
          `${this.LAST_PRICE_PREFIX}${symbol}`,
          price.toString(),
          'EX',
          86400 // 24 hour TTL
        );
      }
    } catch (error) {
      logger.error(`Failed to update last price for ${symbol}:`, error);
    }
  }

  /**
   * Manually check price for a symbol and trigger alerts
   */
  async checkSymbolPrice(symbol: string): Promise<void> {
    try {
      const alerts = await prisma.priceAlert.findMany({
        where: {
          symbol,
          triggered: false,
        },
        include: {
          user: {
            include: {
              settings: true,
            },
          },
        },
      });

      if (alerts.length > 0) {
        await this.checkSymbolAlerts(symbol, alerts);
      }
    } catch (error) {
      logger.error(`Error checking price for ${symbol}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const priceMonitorService = new PriceMonitorService();
