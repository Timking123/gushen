import { WatchlistService } from './watchlistService.js';
import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';
import { ConflictError, NotFoundError } from '../middleware/errorHandler.js';

// Mock dependencies
jest.mock('../lib/prisma', () => ({
  prisma: {
    watchlistItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    stock: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../lib/redis', () => ({
  redisHelpers: {
    getJson: jest.fn(),
    setJson: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('WatchlistService', () => {
  let watchlistService: WatchlistService;
  const mockUserId = 'user-123';

  beforeEach(() => {
    watchlistService = new WatchlistService();
    jest.clearAllMocks();
  });

  describe('getWatchlist', () => {
    const mockWatchlistItems = [
      {
        id: 'item-1',
        userId: mockUserId,
        symbol: 'AAPL',
        addedAt: new Date('2024-01-01'),
        sortOrder: 0,
        notes: 'Apple stock',
        stock: { name: 'Apple Inc.', exchange: 'NASDAQ', sector: 'Technology' },
      },
      {
        id: 'item-2',
        userId: mockUserId,
        symbol: 'GOOGL',
        addedAt: new Date('2024-01-02'),
        sortOrder: 1,
        notes: null,
        stock: { name: 'Alphabet Inc.', exchange: 'NASDAQ', sector: 'Technology' },
      },
    ];

    it('should return watchlist from cache if available', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(mockWatchlistItems);

      const result = await watchlistService.getWatchlist(mockUserId);

      expect(redisHelpers.getJson).toHaveBeenCalled();
      expect(prisma.watchlistItem.findMany).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should query database if cache miss', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.watchlistItem.findMany as jest.Mock).mockResolvedValue(mockWatchlistItems);

      const result = await watchlistService.getWatchlist(mockUserId);

      expect(prisma.watchlistItem.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        include: {
          stock: {
            select: { name: true, exchange: true, sector: true },
          },
        },
        orderBy: { sortOrder: 'asc' },
      });
      expect(result).toHaveLength(2);
      expect(redisHelpers.setJson).toHaveBeenCalled();
    });

    it('should return empty array for user with no watchlist', async () => {
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.watchlistItem.findMany as jest.Mock).mockResolvedValue([]);

      const result = await watchlistService.getWatchlist(mockUserId);

      expect(result).toEqual([]);
    });
  });


  describe('addStock', () => {
    const mockStock = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      exchange: 'NASDAQ',
      sector: 'Technology',
    };

    it('should add stock to watchlist successfully', async () => {
      (prisma.stock.findUnique as jest.Mock).mockResolvedValue(mockStock);
      (prisma.watchlistItem.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.watchlistItem.aggregate as jest.Mock).mockResolvedValue({ _max: { sortOrder: 1 } });
      (prisma.watchlistItem.create as jest.Mock).mockResolvedValue({
        id: 'item-new',
        userId: mockUserId,
        symbol: 'AAPL',
        addedAt: new Date(),
        sortOrder: 2,
        notes: null,
        stock: mockStock,
      });

      const result = await watchlistService.addStock(mockUserId, 'AAPL');

      expect(result.symbol).toBe('AAPL');
      expect(result.sortOrder).toBe(2);
      expect(redisHelpers.del).toHaveBeenCalled();
    });

    it('should throw NotFoundError if stock does not exist', async () => {
      (prisma.stock.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(watchlistService.addStock(mockUserId, 'INVALID')).rejects.toThrow(NotFoundError);
      await expect(watchlistService.addStock(mockUserId, 'INVALID')).rejects.toThrow('股票 INVALID 不存在');
    });

    it('should throw ConflictError if stock already in watchlist', async () => {
      (prisma.stock.findUnique as jest.Mock).mockResolvedValue(mockStock);
      (prisma.watchlistItem.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-item',
        userId: mockUserId,
        symbol: 'AAPL',
      });

      await expect(watchlistService.addStock(mockUserId, 'AAPL')).rejects.toThrow(ConflictError);
      await expect(watchlistService.addStock(mockUserId, 'AAPL')).rejects.toThrow('股票 AAPL 已在自选股列表中');
    });

    it('should normalize symbol to uppercase', async () => {
      (prisma.stock.findUnique as jest.Mock).mockResolvedValue(mockStock);
      (prisma.watchlistItem.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.watchlistItem.aggregate as jest.Mock).mockResolvedValue({ _max: { sortOrder: null } });
      (prisma.watchlistItem.create as jest.Mock).mockResolvedValue({
        id: 'item-new',
        userId: mockUserId,
        symbol: 'AAPL',
        addedAt: new Date(),
        sortOrder: 0,
        notes: null,
        stock: mockStock,
      });

      await watchlistService.addStock(mockUserId, 'aapl');

      expect(prisma.stock.findUnique).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
        select: expect.any(Object),
      });
    });
  });

  describe('removeStock', () => {
    it('should remove stock from watchlist successfully', async () => {
      (prisma.watchlistItem.findUnique as jest.Mock).mockResolvedValue({
        id: 'item-1',
        userId: mockUserId,
        symbol: 'AAPL',
      });
      (prisma.watchlistItem.delete as jest.Mock).mockResolvedValue({});

      await watchlistService.removeStock(mockUserId, 'AAPL');

      expect(prisma.watchlistItem.delete).toHaveBeenCalledWith({
        where: {
          userId_symbol: {
            userId: mockUserId,
            symbol: 'AAPL',
          },
        },
      });
      expect(redisHelpers.del).toHaveBeenCalled();
    });

    it('should throw NotFoundError if stock not in watchlist', async () => {
      (prisma.watchlistItem.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(watchlistService.removeStock(mockUserId, 'AAPL')).rejects.toThrow(NotFoundError);
      await expect(watchlistService.removeStock(mockUserId, 'AAPL')).rejects.toThrow('股票 AAPL 不在自选股列表中');
    });
  });

  describe('reorderStocks', () => {
    it('should reorder stocks successfully', async () => {
      (prisma.watchlistItem.findMany as jest.Mock).mockResolvedValue([
        { symbol: 'AAPL' },
        { symbol: 'GOOGL' },
        { symbol: 'MSFT' },
      ]);
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);

      await watchlistService.reorderStocks(mockUserId, ['GOOGL', 'MSFT', 'AAPL']);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(redisHelpers.del).toHaveBeenCalled();
    });

    it('should throw NotFoundError if symbol not in watchlist', async () => {
      (prisma.watchlistItem.findMany as jest.Mock).mockResolvedValue([
        { symbol: 'AAPL' },
        { symbol: 'GOOGL' },
      ]);

      await expect(watchlistService.reorderStocks(mockUserId, ['AAPL', 'INVALID'])).rejects.toThrow(NotFoundError);
    });
  });

  describe('isInWatchlist', () => {
    it('should return true if stock is in watchlist', async () => {
      (prisma.watchlistItem.findUnique as jest.Mock).mockResolvedValue({ id: 'item-1' });

      const result = await watchlistService.isInWatchlist(mockUserId, 'AAPL');

      expect(result).toBe(true);
    });

    it('should return false if stock is not in watchlist', async () => {
      (prisma.watchlistItem.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await watchlistService.isInWatchlist(mockUserId, 'AAPL');

      expect(result).toBe(false);
    });
  });

  describe('getWatchlistCount', () => {
    it('should return count of watchlist items', async () => {
      (prisma.watchlistItem.count as jest.Mock).mockResolvedValue(5);

      const result = await watchlistService.getWatchlistCount(mockUserId);

      expect(result).toBe(5);
    });
  });
});
