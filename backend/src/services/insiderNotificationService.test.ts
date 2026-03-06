import { InsiderNotificationService, DEFAULT_INSIDER_NOTIFICATION_CONFIG } from './insiderNotificationService.js';
import { insiderService, InsiderTradeWithStock } from './insiderService.js';
import { pushService, PushMessage } from './pushService.js';
import { prisma } from '../lib/prisma.js';

// Mock dependencies
jest.mock('./insiderService.js', () => ({
  insiderService: {
    getSignificantInsiderTrades: jest.fn(),
  },
}));

jest.mock('./pushService.js', () => ({
  pushService: {
    pushToUser: jest.fn(),
  },
}));

jest.mock('../lib/prisma.js', () => ({
  prisma: {
    watchlistItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    alert: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('InsiderNotificationService', () => {
  let service: InsiderNotificationService;

  const mockTrade: InsiderTradeWithStock = {
    id: 'trade-1',
    symbol: 'AAPL',
    filedAt: new Date('2024-01-15'),
    tradeDate: new Date('2024-01-14'),
    insiderName: 'Tim Cook',
    insiderTitle: 'CEO',
    transactionType: 'buy',
    shares: 10000,
    pricePerShare: 185.50,
    totalValue: 1855000,
    sharesOwned: 500000,
    createdAt: new Date('2024-01-15'),
    stockName: 'Apple Inc.',
    sector: 'Technology',
  };

  const mockSellTrade: InsiderTradeWithStock = {
    id: 'trade-2',
    symbol: 'MSFT',
    filedAt: new Date('2024-01-15'),
    tradeDate: new Date('2024-01-14'),
    insiderName: 'Satya Nadella',
    insiderTitle: 'CEO',
    transactionType: 'sell',
    shares: 5000,
    pricePerShare: 380.00,
    totalValue: 1900000,
    sharesOwned: 100000,
    createdAt: new Date('2024-01-15'),
    stockName: 'Microsoft Corporation',
    sector: 'Technology',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InsiderNotificationService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor and configuration', () => {
    it('should use default configuration when no config provided', () => {
      const config = service.getConfig();
      expect(config).toEqual(DEFAULT_INSIDER_NOTIFICATION_CONFIG);
    });

    it('should merge custom configuration with defaults', () => {
      const customService = new InsiderNotificationService({
        minTransactionValue: 200000,
      });
      const config = customService.getConfig();
      expect(config.minTransactionValue).toBe(200000);
      expect(config.lookbackDays).toBe(DEFAULT_INSIDER_NOTIFICATION_CONFIG.lookbackDays);
    });

    it('should update configuration via setConfig', () => {
      service.setConfig({ minTransactionValue: 500000 });
      const config = service.getConfig();
      expect(config.minTransactionValue).toBe(500000);
    });
  });

  describe('isSignificantTrade', () => {
    it('should return true for trades above threshold', () => {
      expect(service.isSignificantTrade(150000)).toBe(true);
      expect(service.isSignificantTrade(100000)).toBe(true);
    });

    it('should return false for trades below threshold', () => {
      expect(service.isSignificantTrade(99999)).toBe(false);
      expect(service.isSignificantTrade(50000)).toBe(false);
    });

    it('should use custom threshold when provided', () => {
      expect(service.isSignificantTrade(150000, 200000)).toBe(false);
      expect(service.isSignificantTrade(250000, 200000)).toBe(true);
    });
  });

  describe('getUsersToNotify', () => {
    it('should return user IDs who have the stock in their watchlist', async () => {
      (prisma.watchlistItem.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-1', symbol: 'AAPL', id: '1', addedAt: new Date(), sortOrder: 0, notes: null },
        { userId: 'user-2', symbol: 'AAPL', id: '2', addedAt: new Date(), sortOrder: 0, notes: null },
      ]);

      const users = await service.getUsersToNotify('AAPL');
      
      expect(users).toEqual(['user-1', 'user-2']);
      expect(prisma.watchlistItem.findMany).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
        select: { userId: true },
      });
    });

    it('should normalize symbol to uppercase', async () => {
      (prisma.watchlistItem.findMany as jest.Mock).mockResolvedValue([]);

      await service.getUsersToNotify('aapl');
      
      expect(prisma.watchlistItem.findMany).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
        select: { userId: true },
      });
    });

    it('should return empty array when no users have the stock', async () => {
      (prisma.watchlistItem.findMany as jest.Mock).mockResolvedValue([]);

      const users = await service.getUsersToNotify('UNKNOWN');
      
      expect(users).toEqual([]);
    });
  });

  describe('sendInsiderTradeNotification', () => {
    it('should send notification with correct format for buy transaction', async () => {
      (pushService.pushToUser as jest.Mock).mockResolvedValue(undefined);

      await service.sendInsiderTradeNotification('user-1', mockTrade);

      expect(pushService.pushToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          type: 'insider',
          symbol: 'AAPL',
          title: 'AAPL 重大内部交易',
          priority: 'high', // $1.85M is high priority
          metadata: expect.objectContaining({
            tradeId: 'trade-1',
            insiderName: 'Tim Cook',
            insiderTitle: 'CEO',
            transactionType: 'buy',
            shares: 10000,
            totalValue: 1855000,
          }),
        })
      );

      // Verify message contains expected content
      const call = (pushService.pushToUser as jest.Mock).mock.calls[0];
      const message = call[1] as PushMessage;
      expect(message.message).toContain('Tim Cook');
      expect(message.message).toContain('买入');
    });

    it('should send notification with correct format for sell transaction', async () => {
      (pushService.pushToUser as jest.Mock).mockResolvedValue(undefined);

      await service.sendInsiderTradeNotification('user-1', mockSellTrade);

      const call = (pushService.pushToUser as jest.Mock).mock.calls[0];
      const message = call[1] as PushMessage;
      expect(message.type).toBe('insider');
      expect(message.symbol).toBe('MSFT');
      expect(message.message).toContain('卖出');
    });

    it('should set high priority for trades >= $1M', async () => {
      (pushService.pushToUser as jest.Mock).mockResolvedValue(undefined);

      await service.sendInsiderTradeNotification('user-1', mockTrade);

      const call = (pushService.pushToUser as jest.Mock).mock.calls[0];
      expect((call[1] as PushMessage).priority).toBe('high');
    });

    it('should set medium priority for trades >= $500K and < $1M', async () => {
      (pushService.pushToUser as jest.Mock).mockResolvedValue(undefined);

      const mediumTrade = { ...mockTrade, totalValue: 750000 };
      await service.sendInsiderTradeNotification('user-1', mediumTrade);

      const call = (pushService.pushToUser as jest.Mock).mock.calls[0];
      expect((call[1] as PushMessage).priority).toBe('medium');
    });

    it('should set low priority for trades < $500K', async () => {
      (pushService.pushToUser as jest.Mock).mockResolvedValue(undefined);

      const lowTrade = { ...mockTrade, totalValue: 150000 };
      await service.sendInsiderTradeNotification('user-1', lowTrade);

      const call = (pushService.pushToUser as jest.Mock).mock.calls[0];
      expect((call[1] as PushMessage).priority).toBe('low');
    });
  });

  describe('checkAndNotifySignificantTrades', () => {
    it('should return empty array when no significant trades found', async () => {
      (insiderService.getSignificantInsiderTrades as jest.Mock).mockResolvedValue([]);

      const results = await service.checkAndNotifySignificantTrades();

      expect(results).toEqual([]);
      expect(pushService.pushToUser).not.toHaveBeenCalled();
    });

    it('should notify users who have stocks in their watchlist', async () => {
      (insiderService.getSignificantInsiderTrades as jest.Mock).mockResolvedValue([mockTrade]);
      (prisma.watchlistItem.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-1', symbol: 'AAPL' },
        { userId: 'user-2', symbol: 'AAPL' },
      ]);
      (prisma.alert.findFirst as jest.Mock).mockResolvedValue(null);
      (pushService.pushToUser as jest.Mock).mockResolvedValue(undefined);

      const results = await service.checkAndNotifySignificantTrades();

      expect(results).toHaveLength(2);
      expect(results[0].notificationSent).toBe(true);
      expect(results[1].notificationSent).toBe(true);
      expect(pushService.pushToUser).toHaveBeenCalledTimes(2);
    });

    it('should not notify users who have already been notified', async () => {
      (insiderService.getSignificantInsiderTrades as jest.Mock).mockResolvedValue([mockTrade]);
      (prisma.watchlistItem.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-1', symbol: 'AAPL' },
      ]);
      (prisma.alert.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-alert' });

      const results = await service.checkAndNotifySignificantTrades();

      expect(results).toHaveLength(1);
      expect(results[0].notificationSent).toBe(false);
      expect(pushService.pushToUser).not.toHaveBeenCalled();
    });

    it('should handle multiple stocks and users correctly', async () => {
      (insiderService.getSignificantInsiderTrades as jest.Mock).mockResolvedValue([
        mockTrade,
        mockSellTrade,
      ]);
      (prisma.watchlistItem.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-1', symbol: 'AAPL' },
        { userId: 'user-2', symbol: 'MSFT' },
        { userId: 'user-3', symbol: 'AAPL' },
      ]);
      (prisma.alert.findFirst as jest.Mock).mockResolvedValue(null);
      (pushService.pushToUser as jest.Mock).mockResolvedValue(undefined);

      const results = await service.checkAndNotifySignificantTrades();

      // user-1 and user-3 for AAPL, user-2 for MSFT
      expect(results).toHaveLength(3);
      expect(pushService.pushToUser).toHaveBeenCalledTimes(3);
    });

    it('should use custom config when provided', async () => {
      (insiderService.getSignificantInsiderTrades as jest.Mock).mockResolvedValue([]);

      await service.checkAndNotifySignificantTrades({
        minTransactionValue: 500000,
        lookbackDays: 14,
      });

      expect(insiderService.getSignificantInsiderTrades).toHaveBeenCalledWith(
        500000,
        14,
        100
      );
    });
  });

  describe('notifyUserOfSignificantTrade', () => {
    it('should return false if user does not have stock in watchlist', async () => {
      (prisma.watchlistItem.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.notifyUserOfSignificantTrade('user-1', 'AAPL');

      expect(result).toBe(false);
      expect(pushService.pushToUser).not.toHaveBeenCalled();
    });

    it('should return false if no significant trades found', async () => {
      (prisma.watchlistItem.findUnique as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        symbol: 'AAPL',
      });
      (insiderService.getSignificantInsiderTrades as jest.Mock).mockResolvedValue([]);

      const result = await service.notifyUserOfSignificantTrade('user-1', 'AAPL');

      expect(result).toBe(false);
      expect(pushService.pushToUser).not.toHaveBeenCalled();
    });

    it('should send notification for significant trade', async () => {
      (prisma.watchlistItem.findUnique as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        symbol: 'AAPL',
      });
      (insiderService.getSignificantInsiderTrades as jest.Mock).mockResolvedValue([mockTrade]);
      (prisma.alert.findFirst as jest.Mock).mockResolvedValue(null);
      (pushService.pushToUser as jest.Mock).mockResolvedValue(undefined);

      const result = await service.notifyUserOfSignificantTrade('user-1', 'AAPL');

      expect(result).toBe(true);
      expect(pushService.pushToUser).toHaveBeenCalledTimes(1);
    });

    it('should return false if user already notified', async () => {
      (prisma.watchlistItem.findUnique as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        symbol: 'AAPL',
      });
      (insiderService.getSignificantInsiderTrades as jest.Mock).mockResolvedValue([mockTrade]);
      (prisma.alert.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });

      const result = await service.notifyUserOfSignificantTrade('user-1', 'AAPL');

      expect(result).toBe(false);
      expect(pushService.pushToUser).not.toHaveBeenCalled();
    });

    it('should normalize symbol to uppercase', async () => {
      (prisma.watchlistItem.findUnique as jest.Mock).mockResolvedValue(null);

      await service.notifyUserOfSignificantTrade('user-1', 'aapl');

      expect(prisma.watchlistItem.findUnique).toHaveBeenCalledWith({
        where: {
          userId_symbol: {
            userId: 'user-1',
            symbol: 'AAPL',
          },
        },
      });
    });
  });

  describe('notification message formatting', () => {
    it('should format large values in millions', async () => {
      (pushService.pushToUser as jest.Mock).mockResolvedValue(undefined);

      const largeTrade = { ...mockTrade, totalValue: 5000000 };
      await service.sendInsiderTradeNotification('user-1', largeTrade);

      const call = (pushService.pushToUser as jest.Mock).mock.calls[0];
      expect((call[1] as PushMessage).message).toContain('$5.00M');
    });

    it('should format medium values in thousands', async () => {
      (pushService.pushToUser as jest.Mock).mockResolvedValue(undefined);

      const mediumTrade = { ...mockTrade, totalValue: 250000 };
      await service.sendInsiderTradeNotification('user-1', mediumTrade);

      const call = (pushService.pushToUser as jest.Mock).mock.calls[0];
      expect((call[1] as PushMessage).message).toContain('$250.00K');
    });

    it('should include insider title when available', async () => {
      (pushService.pushToUser as jest.Mock).mockResolvedValue(undefined);

      await service.sendInsiderTradeNotification('user-1', mockTrade);

      const call = (pushService.pushToUser as jest.Mock).mock.calls[0];
      expect((call[1] as PushMessage).message).toContain('CEO');
    });

    it('should handle missing insider title', async () => {
      (pushService.pushToUser as jest.Mock).mockResolvedValue(undefined);

      const tradeWithoutTitle = { ...mockTrade, insiderTitle: null };
      await service.sendInsiderTradeNotification('user-1', tradeWithoutTitle);

      const call = (pushService.pushToUser as jest.Mock).mock.calls[0];
      expect((call[1] as PushMessage).message).not.toContain('(null)');
    });

    it('should handle exercise transaction type', async () => {
      (pushService.pushToUser as jest.Mock).mockResolvedValue(undefined);

      const exerciseTrade: InsiderTradeWithStock = { ...mockTrade, transactionType: 'exercise' };
      await service.sendInsiderTradeNotification('user-1', exerciseTrade);

      const call = (pushService.pushToUser as jest.Mock).mock.calls[0];
      expect((call[1] as PushMessage).message).toContain('行权');
    });
  });

  /**
   * Tests for Requirement 12.3:
   * WHEN 自选股有重大内部交易 THEN Insider_Tracker SHALL 推送通知提醒用户
   */
  describe('Requirement 12.3 - Significant insider trade notifications', () => {
    it('should trigger notification when watchlist stock has significant insider trade', async () => {
      // Setup: User has AAPL in watchlist, significant trade occurs
      (insiderService.getSignificantInsiderTrades as jest.Mock).mockResolvedValue([mockTrade]);
      (prisma.watchlistItem.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-1', symbol: 'AAPL' },
      ]);
      (prisma.alert.findFirst as jest.Mock).mockResolvedValue(null);
      (pushService.pushToUser as jest.Mock).mockResolvedValue(undefined);

      const results = await service.checkAndNotifySignificantTrades();

      // Verify notification was sent
      expect(results).toHaveLength(1);
      expect(results[0].notificationSent).toBe(true);
      expect(results[0].userId).toBe('user-1');
      expect(results[0].trade.symbol).toBe('AAPL');
      
      // Verify push service was called with correct parameters
      expect(pushService.pushToUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          type: 'insider',
          symbol: 'AAPL',
        })
      );
    });

    it('should not trigger notification for stocks not in user watchlist', async () => {
      // Setup: User has MSFT in watchlist, but trade is for AAPL
      (insiderService.getSignificantInsiderTrades as jest.Mock).mockResolvedValue([mockTrade]);
      (prisma.watchlistItem.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-1', symbol: 'MSFT' }, // Different stock
      ]);

      const results = await service.checkAndNotifySignificantTrades();

      // No notifications should be sent
      expect(results).toHaveLength(0);
      expect(pushService.pushToUser).not.toHaveBeenCalled();
    });

    it('should include trade details in notification metadata', async () => {
      (pushService.pushToUser as jest.Mock).mockResolvedValue(undefined);

      await service.sendInsiderTradeNotification('user-1', mockTrade);

      const call = (pushService.pushToUser as jest.Mock).mock.calls[0];
      const message = call[1] as PushMessage;
      
      // Verify metadata contains all required trade details
      expect(message.metadata).toMatchObject({
        tradeId: 'trade-1',
        insiderName: 'Tim Cook',
        insiderTitle: 'CEO',
        transactionType: 'buy',
        shares: 10000,
        pricePerShare: 185.50,
        totalValue: 1855000,
      });
    });
  });
});
