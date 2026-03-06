import { getSocketIO, emitToUser } from '../lib/socket.js';
import { prisma } from '../lib/prisma.js';
import { getRedisClient } from '../lib/redis.js';
import { logger } from '../utils/logger.js';
import { Alert } from '../types/index.js';

export interface PushMessage {
  type: 'price' | 'news' | 'earnings' | 'dividend' | 'insider' | 'rating' | 'sec_filing';
  symbol?: string;
  sector?: string;
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  metadata?: Record<string, unknown>;
}

export interface PriceAlertConfig {
  userId: string;
  symbol: string;
  condition: 'above' | 'below' | 'change_percent';
  targetValue: number;
}

export class PushService {
  private redis = getRedisClient();
  private readonly ONLINE_USERS_KEY = 'push:online_users';

  /**
   * Subscribe user to stock updates
   */
  async subscribeStock(userId: string, symbol: string): Promise<void> {
    try {
      const io = getSocketIO();
      const userSockets = await io.in(`user:${userId}`).fetchSockets();
      
      for (const socket of userSockets) {
        socket.join(`stock:${symbol}`);
      }
      
      logger.debug(`User ${userId} subscribed to stock ${symbol}`);
    } catch (error) {
      logger.error(`Failed to subscribe user ${userId} to stock ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe user from stock updates
   */
  async unsubscribeStock(userId: string, symbol: string): Promise<void> {
    try {
      const io = getSocketIO();
      const userSockets = await io.in(`user:${userId}`).fetchSockets();
      
      for (const socket of userSockets) {
        socket.leave(`stock:${symbol}`);
      }
      
      logger.debug(`User ${userId} unsubscribed from stock ${symbol}`);
    } catch (error) {
      logger.error(`Failed to unsubscribe user ${userId} from stock ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe user to sector updates
   */
  async subscribeSector(userId: string, sectorName: string): Promise<void> {
    try {
      const io = getSocketIO();
      const userSockets = await io.in(`user:${userId}`).fetchSockets();
      
      for (const socket of userSockets) {
        socket.join(`sector:${sectorName}`);
      }
      
      logger.debug(`User ${userId} subscribed to sector ${sectorName}`);
    } catch (error) {
      logger.error(`Failed to subscribe user ${userId} to sector ${sectorName}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe user from sector updates
   */
  async unsubscribeSector(userId: string, sectorName: string): Promise<void> {
    try {
      const io = getSocketIO();
      const userSockets = await io.in(`user:${userId}`).fetchSockets();
      
      for (const socket of userSockets) {
        socket.leave(`sector:${sectorName}`);
      }
      
      logger.debug(`User ${userId} unsubscribed from sector ${sectorName}`);
    } catch (error) {
      logger.error(`Failed to unsubscribe user ${userId} from sector ${sectorName}:`, error);
      throw error;
    }
  }

  /**
   * Set price alert for user
   */
  async setPriceAlert(config: PriceAlertConfig): Promise<string> {
    try {
      const alert = await prisma.priceAlert.create({
        data: {
          userId: config.userId,
          symbol: config.symbol,
          condition: config.condition,
          targetValue: config.targetValue,
          triggered: false,
        },
      });

      logger.info(`Price alert created for user ${config.userId}, symbol ${config.symbol}`);
      return alert.id;
    } catch (error) {
      logger.error('Failed to create price alert:', error);
      throw error;
    }
  }

  /**
   * Get user's alerts
   */
  async getAlerts(userId: string, unreadOnly = false): Promise<Alert[]> {
    try {
      const alerts = await prisma.alert.findMany({
        where: {
          userId,
          ...(unreadOnly ? { read: false } : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return alerts.map((alert) => ({
        ...alert,
        type: alert.type as Alert['type'],
        priority: alert.priority as Alert['priority'],
        metadata: alert.metadata as Record<string, unknown>,
      }));
    } catch (error) {
      logger.error(`Failed to get alerts for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Mark alert as read
   */
  async markAlertAsRead(alertId: string, userId: string): Promise<void> {
    try {
      await prisma.alert.update({
        where: {
          id: alertId,
          userId,
        },
        data: {
          read: true,
        },
      });

      logger.debug(`Alert ${alertId} marked as read`);
    } catch (error) {
      logger.error(`Failed to mark alert ${alertId} as read:`, error);
      throw error;
    }
  }

  /**
   * Push message to user
   */
  async pushToUser(userId: string, message: PushMessage): Promise<void> {
    try {
      // Check if user is online
      const isOnline = await this.isUserOnline(userId);

      if (isOnline) {
        // Check quiet hours before sending
        const canPush = await this.canPushToUser(userId);
        
        if (canPush) {
          // Send via WebSocket
          emitToUser(userId, 'push:notification', message);
          logger.debug(`Pushed notification to online user ${userId}`);
        } else {
          // Cache for later delivery
          await this.cacheOfflineMessage(userId, message);
          logger.debug(`User ${userId} in quiet hours, message cached`);
        }
      } else {
        // Cache for offline user
        await this.cacheOfflineMessage(userId, message);
        logger.debug(`User ${userId} offline, message cached`);
      }

      // Create alert record in database
      await this.createAlert(userId, message);
    } catch (error) {
      logger.error(`Failed to push message to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Broadcast message to stock subscribers
   */
  async broadcastToStock(symbol: string, message: PushMessage): Promise<void> {
    try {
      const io = getSocketIO();
      io.to(`stock:${symbol}`).emit('push:notification', message);
      
      logger.debug(`Broadcasted message to stock ${symbol} subscribers`);
    } catch (error) {
      logger.error(`Failed to broadcast to stock ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Broadcast message to sector subscribers
   */
  async broadcastToSector(sector: string, message: PushMessage): Promise<void> {
    try {
      const io = getSocketIO();
      io.to(`sector:${sector}`).emit('push:notification', message);
      
      logger.debug(`Broadcasted message to sector ${sector} subscribers`);
    } catch (error) {
      logger.error(`Failed to broadcast to sector ${sector}:`, error);
      throw error;
    }
  }

  /**
   * Mark user as online
   */
  async markUserOnline(userId: string): Promise<void> {
    try {
      if (this.redis.status === 'ready') {
        await this.redis.sadd(this.ONLINE_USERS_KEY, userId);
        await this.redis.expire(this.ONLINE_USERS_KEY, 3600); // 1 hour TTL
      }
    } catch (error) {
      logger.error(`Failed to mark user ${userId} as online:`, error);
    }
  }

  /**
   * Mark user as offline
   */
  async markUserOffline(userId: string): Promise<void> {
    try {
      if (this.redis.status === 'ready') {
        await this.redis.srem(this.ONLINE_USERS_KEY, userId);
      }
    } catch (error) {
      logger.error(`Failed to mark user ${userId} as offline:`, error);
    }
  }

  /**
   * Check if user is online
   */
  async isUserOnline(userId: string): Promise<boolean> {
    try {
      if (this.redis.status === 'ready') {
        const result = await this.redis.sismember(this.ONLINE_USERS_KEY, userId);
        return result === 1;
      }
      return false;
    } catch (error) {
      logger.error(`Failed to check if user ${userId} is online:`, error);
      return false;
    }
  }

  /**
   * Check if user can receive push notifications (not in quiet hours)
   */
  async canPushToUser(userId: string): Promise<boolean> {
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
      });

      if (!settings || !settings.pushEnabled) {
        return false;
      }

      // Check quiet hours
      if (settings.quietHoursStart && settings.quietHoursEnd) {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        const start = settings.quietHoursStart;
        const end = settings.quietHoursEnd;

        // Handle quiet hours that span midnight
        if (start <= end) {
          // Normal case: e.g., 22:00 - 08:00
          if (currentTime >= start && currentTime < end) {
            return false;
          }
        } else {
          // Spans midnight: e.g., 22:00 - 08:00
          if (currentTime >= start || currentTime < end) {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      logger.error(`Failed to check quiet hours for user ${userId}:`, error);
      return true; // Default to allowing push on error
    }
  }

  /**
   * Cache message for offline user
   */
  async cacheOfflineMessage(userId: string, message: PushMessage): Promise<void> {
    try {
      // Store in database
      await prisma.offlineMessage.create({
        data: {
          userId,
          type: message.type,
          payload: message as any,
          priority: message.priority,
        },
      });

      logger.debug(`Cached offline message for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to cache offline message for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Deliver cached messages to user when they come online
   */
  async deliverCachedMessages(userId: string): Promise<void> {
    try {
      // Get cached messages from database
      const messages = await prisma.offlineMessage.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });

      if (messages.length === 0) {
        return;
      }

      logger.info(`Delivering ${messages.length} cached messages to user ${userId}`);

      // Check if user can receive push
      const canPush = await this.canPushToUser(userId);

      if (canPush) {
        // Send all cached messages
        for (const msg of messages) {
          const payload = msg.payload as unknown as PushMessage;
          emitToUser(userId, 'push:notification', payload);
        }

        // Delete delivered messages
        await prisma.offlineMessage.deleteMany({
          where: { userId },
        });

        logger.info(`Delivered and cleared ${messages.length} cached messages for user ${userId}`);
      } else {
        logger.debug(`User ${userId} in quiet hours, keeping messages cached`);
      }
    } catch (error) {
      logger.error(`Failed to deliver cached messages to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Create alert record in database
   */
  private async createAlert(userId: string, message: PushMessage): Promise<void> {
    try {
      await prisma.alert.create({
        data: {
          userId,
          type: message.type,
          symbol: message.symbol || null,
          sector: message.sector || null,
          title: message.title,
          message: message.message,
          priority: message.priority,
          metadata: (message.metadata || {}) as any,
        },
      });
    } catch (error) {
      logger.error('Failed to create alert:', error);
      // Don't throw - alert creation failure shouldn't block push
    }
  }
}

// Export singleton instance
export const pushService = new PushService();
