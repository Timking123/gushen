import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EarningsReminderService } from './earningsReminderService.js';
import { EarningsEvent } from './earningsService.js';

// Mock dependencies
jest.mock('../lib/prisma.js', () => ({
  prisma: {
    watchlistItem: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('./earningsService.js', () => ({
  earningsService: {
    getEarningsCalendar: jest.fn(),
    getEarningsBySymbol: jest.fn(),
  },
}));

jest.mock('./pushService.js', () => ({
  pushService: {
    pushToUser: jest.fn(),
  },
}));

jest.mock('../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { prisma } from '../lib/prisma.js';
import { earningsService } from './earningsService.js';
import { pushService } from './pushService.js';

// Helper to create mock earnings event
function createMockEarningsEvent(overrides: Partial<EarningsEvent> = {}): EarningsEvent {
  return {
    id: '1',
    symbol: 'AAPL',
    stockName: 'Apple Inc.',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    marketCap: 3000000000000,
    reportDate: new Date('2024-02-01'),
    fiscalQuarter: 'Q1',
    fiscalYear: 2024,
    timing: 'amc',
    epsEstimate: 2.10,
    epsActual: null,
    epsSurprise: null,
    epsSurprisePercent: null,
    revenueEstimate: 118000000000,
    revenueActual: null,
    revenueSurprise: null,
    revenueSurprisePercent: null,
    previousEps: 1.88,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}


describe('EarningsReminderService', () => {
  let service: EarningsReminderService;
  const mockUserId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EarningsReminderService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getUpcomingEarningsForWatchlist', () => {
    it('should return empty array when user has no watchlist items', async () => {
      (prisma.watchlistItem.findMany as jest.MockedFunction<any>).mockResolvedValue([]);

      const result = await service.getUpcomingEarningsForWatchlist(mockUserId);

      expect(result).toEqual([]);
      expect(prisma.watchlistItem.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        select: { symbol: true },
      });
    });

    it('should return upcoming earnings for watchlist stocks', async () => {
      const mockWatchlistItems = [{ symbol: 'AAPL' }, { symbol: 'GOOGL' }];
      const mockEarningsEvents = [createMockEarningsEvent()];

      (prisma.watchlistItem.findMany as jest.MockedFunction<any>).mockResolvedValue(mockWatchlistItems);
      (earningsService.getEarningsCalendar as jest.MockedFunction<any>).mockResolvedValue({
        events: mockEarningsEvents,
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });

      const result = await service.getUpcomingEarningsForWatchlist(mockUserId, 7);

      expect(result).toEqual(mockEarningsEvents);
      expect(earningsService.getEarningsCalendar).toHaveBeenCalledWith(
        expect.objectContaining({
          symbols: ['AAPL', 'GOOGL'],
          hasActualResults: false,
        }),
        { field: 'reportDate', order: 'asc' },
        { page: 1, limit: 100 }
      );
    });
  });

  describe('getEarningsTomorrowForWatchlist', () => {
    it('should return earnings happening tomorrow for watchlist stocks', async () => {
      const mockWatchlistItems = [{ symbol: 'AAPL' }];
      const mockEarningsEvents = [createMockEarningsEvent({ timing: 'bmo' })];

      (prisma.watchlistItem.findMany as jest.MockedFunction<any>).mockResolvedValue(mockWatchlistItems);
      (earningsService.getEarningsCalendar as jest.MockedFunction<any>).mockResolvedValue({
        events: mockEarningsEvents,
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });

      const result = await service.getEarningsTomorrowForWatchlist(mockUserId);

      expect(result).toEqual(mockEarningsEvents);
    });

    it('should return empty array when no watchlist items', async () => {
      (prisma.watchlistItem.findMany as jest.MockedFunction<any>).mockResolvedValue([]);

      const result = await service.getEarningsTomorrowForWatchlist(mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe('getRecentEarningsResultsForWatchlist', () => {
    it('should return recent earnings results for watchlist stocks', async () => {
      const mockWatchlistItems = [{ symbol: 'AAPL' }];
      const mockEarningsEvents = [createMockEarningsEvent({
        epsActual: 2.18,
        epsSurprise: 0.08,
        epsSurprisePercent: 3.81,
      })];

      (prisma.watchlistItem.findMany as jest.MockedFunction<any>).mockResolvedValue(mockWatchlistItems);
      (earningsService.getEarningsCalendar as jest.MockedFunction<any>).mockResolvedValue({
        events: mockEarningsEvents,
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });

      const result = await service.getRecentEarningsResultsForWatchlist(mockUserId, 24);

      expect(result).toEqual(mockEarningsEvents);
      expect(earningsService.getEarningsCalendar).toHaveBeenCalledWith(
        expect.objectContaining({
          symbols: ['AAPL'],
          hasActualResults: true,
        }),
        { field: 'reportDate', order: 'desc' },
        { page: 1, limit: 100 }
      );
    });
  });

  describe('sendEarningsReminder', () => {
    it('should send pre-earnings reminder notification', async () => {
      const mockEvent = createMockEarningsEvent();
      (pushService.pushToUser as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await service.sendEarningsReminder(mockUserId, mockEvent);

      expect(pushService.pushToUser).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          type: 'earnings',
          symbol: 'AAPL',
          title: expect.stringContaining('财报提醒'),
          message: expect.stringContaining('Apple Inc.'),
          priority: 'high',
          metadata: expect.objectContaining({
            reminderType: 'pre_earnings',
            symbol: 'AAPL',
            fiscalQuarter: 'Q1',
            fiscalYear: 2024,
          }),
        })
      );
    });

    it('should include timing text in reminder message for BMO', async () => {
      const mockEvent = createMockEarningsEvent({ timing: 'bmo' });
      (pushService.pushToUser as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await service.sendEarningsReminder(mockUserId, mockEvent);

      expect(pushService.pushToUser).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          message: expect.stringContaining('盘前'),
        })
      );
    });

    it('should include timing text in reminder message for AMC', async () => {
      const mockEvent = createMockEarningsEvent({ timing: 'amc' });
      (pushService.pushToUser as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await service.sendEarningsReminder(mockUserId, mockEvent);

      expect(pushService.pushToUser).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          message: expect.stringContaining('盘后'),
        })
      );
    });
  });

  describe('sendEarningsComparisonNotification', () => {
    it('should send post-earnings comparison notification for beat', async () => {
      const mockEvent = createMockEarningsEvent({
        epsEstimate: 2.10,
        epsActual: 2.18,
        epsSurprise: 0.08,
        epsSurprisePercent: 3.81,
      });
      (pushService.pushToUser as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await service.sendEarningsComparisonNotification(mockUserId, mockEvent);

      expect(pushService.pushToUser).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          type: 'earnings',
          symbol: 'AAPL',
          title: expect.stringContaining('超预期'),
          priority: 'high',
          metadata: expect.objectContaining({
            reminderType: 'post_earnings',
            beat: 'beat',
            epsActual: 2.18,
            epsEstimate: 2.10,
          }),
        })
      );
    });

    it('should send post-earnings comparison notification for miss', async () => {
      const mockEvent = createMockEarningsEvent({
        epsEstimate: 2.10,
        epsActual: 1.95,
        epsSurprise: -0.15,
        epsSurprisePercent: -7.14,
      });
      (pushService.pushToUser as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await service.sendEarningsComparisonNotification(mockUserId, mockEvent);

      expect(pushService.pushToUser).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          title: expect.stringContaining('不及预期'),
          priority: 'medium',
          metadata: expect.objectContaining({
            beat: 'miss',
          }),
        })
      );
    });

    it('should not send notification when sendPostEarningsComparison is disabled', async () => {
      const serviceWithDisabled = new EarningsReminderService({
        sendPostEarningsComparison: false,
      });
      const mockEvent = createMockEarningsEvent({ epsActual: 2.18 });

      await serviceWithDisabled.sendEarningsComparisonNotification(mockUserId, mockEvent);

      expect(pushService.pushToUser).not.toHaveBeenCalled();
    });
  });

  describe('sendEarningsReminderForSymbol', () => {
    it('should send reminder for symbol with upcoming earnings', async () => {
      const mockEvent = createMockEarningsEvent({
        reportDate: new Date(Date.now() + 86400000), // Tomorrow
      });
      (earningsService.getEarningsBySymbol as jest.MockedFunction<any>).mockResolvedValue([mockEvent]);
      (pushService.pushToUser as jest.MockedFunction<any>).mockResolvedValue(undefined);

      const result = await service.sendEarningsReminderForSymbol(mockUserId, 'AAPL');

      expect(result).toBe(true);
      expect(pushService.pushToUser).toHaveBeenCalled();
    });

    it('should return false when no upcoming earnings', async () => {
      (earningsService.getEarningsBySymbol as jest.MockedFunction<any>).mockResolvedValue([]);

      const result = await service.sendEarningsReminderForSymbol(mockUserId, 'AAPL');

      expect(result).toBe(false);
      expect(pushService.pushToUser).not.toHaveBeenCalled();
    });

    it('should return false when earnings is in the past', async () => {
      const mockEvent = createMockEarningsEvent({
        reportDate: new Date(Date.now() - 86400000), // Yesterday
        epsActual: 2.18,
      });
      (earningsService.getEarningsBySymbol as jest.MockedFunction<any>).mockResolvedValue([mockEvent]);

      const result = await service.sendEarningsReminderForSymbol(mockUserId, 'AAPL');

      expect(result).toBe(false);
      expect(pushService.pushToUser).not.toHaveBeenCalled();
    });

    it('should normalize symbol to uppercase', async () => {
      (earningsService.getEarningsBySymbol as jest.MockedFunction<any>).mockResolvedValue([]);

      await service.sendEarningsReminderForSymbol(mockUserId, 'aapl');

      expect(earningsService.getEarningsBySymbol).toHaveBeenCalledWith('AAPL', 1);
    });
  });

  describe('processEarningsReminders', () => {
    it('should process reminders for all users with watchlist', async () => {
      const mockUsers = [{ id: 'user1' }, { id: 'user2' }];
      const mockEvent = createMockEarningsEvent();

      (prisma.user.findMany as jest.MockedFunction<any>).mockResolvedValue(mockUsers);
      (prisma.watchlistItem.findMany as jest.MockedFunction<any>).mockResolvedValue([{ symbol: 'AAPL' }]);
      (earningsService.getEarningsCalendar as jest.MockedFunction<any>).mockResolvedValue({
        events: [mockEvent],
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });
      (pushService.pushToUser as jest.MockedFunction<any>).mockResolvedValue(undefined);

      const result = await service.processEarningsReminders();

      expect(result.usersNotified).toBe(2);
      expect(result.remindersCount).toBe(2);
    });

    it('should return zero counts when no users have watchlist', async () => {
      (prisma.user.findMany as jest.MockedFunction<any>).mockResolvedValue([]);

      const result = await service.processEarningsReminders();

      expect(result.usersNotified).toBe(0);
      expect(result.remindersCount).toBe(0);
    });
  });

  describe('processPostEarningsNotifications', () => {
    it('should process post-earnings notifications for all users', async () => {
      const mockUsers = [{ id: 'user1' }];
      const mockEvent = createMockEarningsEvent({
        epsActual: 2.18,
        epsSurprise: 0.08,
        epsSurprisePercent: 3.81,
      });

      (prisma.user.findMany as jest.MockedFunction<any>).mockResolvedValue(mockUsers);
      (prisma.watchlistItem.findMany as jest.MockedFunction<any>).mockResolvedValue([{ symbol: 'AAPL' }]);
      (earningsService.getEarningsCalendar as jest.MockedFunction<any>).mockResolvedValue({
        events: [mockEvent],
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });
      (pushService.pushToUser as jest.MockedFunction<any>).mockResolvedValue(undefined);

      const result = await service.processPostEarningsNotifications();

      expect(result.usersNotified).toBe(1);
      expect(result.notificationsCount).toBe(1);
    });

    it('should skip events without actual results', async () => {
      const mockUsers = [{ id: 'user1' }];
      const mockEvent = createMockEarningsEvent({ epsActual: null });

      (prisma.user.findMany as jest.MockedFunction<any>).mockResolvedValue(mockUsers);
      (prisma.watchlistItem.findMany as jest.MockedFunction<any>).mockResolvedValue([{ symbol: 'AAPL' }]);
      (earningsService.getEarningsCalendar as jest.MockedFunction<any>).mockResolvedValue({
        events: [mockEvent],
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });

      const result = await service.processPostEarningsNotifications();

      expect(result.usersNotified).toBe(1);
      expect(result.notificationsCount).toBe(0);
      expect(pushService.pushToUser).not.toHaveBeenCalled();
    });

    it('should return zero counts when disabled', async () => {
      const serviceWithDisabled = new EarningsReminderService({
        sendPostEarningsComparison: false,
      });

      const result = await serviceWithDisabled.processPostEarningsNotifications();

      expect(result.usersNotified).toBe(0);
      expect(result.notificationsCount).toBe(0);
    });
  });

  describe('EarningsComparisonResult beat determination', () => {
    it('should determine beat correctly', async () => {
      const mockEvent = createMockEarningsEvent({
        epsEstimate: 2.00,
        epsActual: 2.10,
        epsSurprise: 0.10,
        epsSurprisePercent: 5.0,
      });
      (pushService.pushToUser as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await service.sendEarningsComparisonNotification(mockUserId, mockEvent);

      expect(pushService.pushToUser).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          metadata: expect.objectContaining({ beat: 'beat' }),
        })
      );
    });

    it('should determine meet correctly for small differences', async () => {
      const mockEvent = createMockEarningsEvent({
        epsEstimate: 2.00,
        epsActual: 2.005,
        epsSurprise: 0.005,
        epsSurprisePercent: 0.25,
      });
      (pushService.pushToUser as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await service.sendEarningsComparisonNotification(mockUserId, mockEvent);

      expect(pushService.pushToUser).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          metadata: expect.objectContaining({ beat: 'meet' }),
        })
      );
    });

    it('should determine unknown when no estimate', async () => {
      const mockEvent = createMockEarningsEvent({
        epsEstimate: null,
        epsActual: 2.10,
      });
      (pushService.pushToUser as jest.MockedFunction<any>).mockResolvedValue(undefined);

      await service.sendEarningsComparisonNotification(mockUserId, mockEvent);

      expect(pushService.pushToUser).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          metadata: expect.objectContaining({ beat: 'unknown' }),
        })
      );
    });
  });
});
