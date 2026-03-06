import { PortfolioService } from './portfolioService.js';
import { prisma } from '../lib/prisma.js';
import { redisHelpers } from '../lib/redis.js';
import { ConflictError, NotFoundError, BadRequestError } from '../middleware/errorHandler.js';

// Mock dependencies
jest.mock('../lib/prisma', () => ({
  prisma: {
    portfolio: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    portfolioHolding: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    portfolioTransaction: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    stock: {
      findUnique: jest.fn(),
    },
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
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('PortfolioService', () => {
  let portfolioService: PortfolioService;

  beforeEach(() => {
    portfolioService = new PortfolioService();
    jest.clearAllMocks();
  });

  // ============================================
  // Portfolio CRUD Tests
  // ============================================

  describe('createPortfolio', () => {
    const userId = 'user-123';
    const portfolioName = 'My Portfolio';
    const description = 'Test description';

    it('should create a new portfolio successfully', async () => {
      const mockPortfolio = {
        id: 'portfolio-123',
        userId,
        name: portfolioName,
        description,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.portfolio.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.portfolio.create as jest.Mock).mockResolvedValue(mockPortfolio);

      const result = await portfolioService.createPortfolio(userId, portfolioName, description);

      expect(result).toEqual({
        id: mockPortfolio.id,
        userId: mockPortfolio.userId,
        name: mockPortfolio.name,
        description: mockPortfolio.description,
        createdAt: mockPortfolio.createdAt,
        updatedAt: mockPortfolio.updatedAt,
      });
      expect(prisma.portfolio.create).toHaveBeenCalledWith({
        data: {
          userId,
          name: portfolioName,
          description,
        },
      });
    });

    it('should throw ConflictError if portfolio name already exists', async () => {
      (prisma.portfolio.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-portfolio',
        userId,
        name: portfolioName,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        portfolioService.createPortfolio(userId, portfolioName)
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('getPortfolios', () => {
    const userId = 'user-123';

    it('should return all portfolios for a user', async () => {
      const mockPortfolios = [
        {
          id: 'portfolio-1',
          userId,
          name: 'Portfolio 1',
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'portfolio-2',
          userId,
          name: 'Portfolio 2',
          description: 'Description',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.portfolio.findMany as jest.Mock).mockResolvedValue(mockPortfolios);

      const result = await portfolioService.getPortfolios(userId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Portfolio 1');
      expect(result[1].name).toBe('Portfolio 2');
    });

    it('should return empty array if user has no portfolios', async () => {
      (prisma.portfolio.findMany as jest.Mock).mockResolvedValue([]);

      const result = await portfolioService.getPortfolios(userId);

      expect(result).toEqual([]);
    });
  });

  describe('getPortfolio', () => {
    const portfolioId = 'portfolio-123';
    const userId = 'user-123';

    it('should return a portfolio by ID', async () => {
      const mockPortfolio = {
        id: portfolioId,
        userId,
        name: 'My Portfolio',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue(mockPortfolio);

      const result = await portfolioService.getPortfolio(portfolioId, userId);

      expect(result.id).toBe(portfolioId);
      expect(result.name).toBe('My Portfolio');
    });

    it('should throw NotFoundError if portfolio does not exist', async () => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        portfolioService.getPortfolio(portfolioId, userId)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if portfolio belongs to different user', async () => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue({
        id: portfolioId,
        userId: 'different-user',
        name: 'My Portfolio',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        portfolioService.getPortfolio(portfolioId, userId)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('updatePortfolio', () => {
    const portfolioId = 'portfolio-123';
    const userId = 'user-123';

    it('should update portfolio name and description', async () => {
      const mockPortfolio = {
        id: portfolioId,
        userId,
        name: 'Old Name',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedPortfolio = {
        ...mockPortfolio,
        name: 'New Name',
        description: 'New Description',
      };

      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue(mockPortfolio);
      (prisma.portfolio.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.portfolio.update as jest.Mock).mockResolvedValue(updatedPortfolio);

      const result = await portfolioService.updatePortfolio(portfolioId, userId, {
        name: 'New Name',
        description: 'New Description',
      });

      expect(result.name).toBe('New Name');
      expect(result.description).toBe('New Description');
    });

    it('should throw ConflictError if new name already exists', async () => {
      const mockPortfolio = {
        id: portfolioId,
        userId,
        name: 'Old Name',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue(mockPortfolio);
      (prisma.portfolio.findFirst as jest.Mock).mockResolvedValue({
        id: 'other-portfolio',
        userId,
        name: 'New Name',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        portfolioService.updatePortfolio(portfolioId, userId, { name: 'New Name' })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('deletePortfolio', () => {
    const portfolioId = 'portfolio-123';
    const userId = 'user-123';

    it('should delete a portfolio', async () => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue({
        id: portfolioId,
        userId,
        name: 'My Portfolio',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.portfolio.delete as jest.Mock).mockResolvedValue({
        id: portfolioId,
        userId,
        name: 'My Portfolio',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        portfolioService.deletePortfolio(portfolioId, userId)
      ).resolves.not.toThrow();

      expect(prisma.portfolio.delete).toHaveBeenCalledWith({
        where: { id: portfolioId },
      });
    });

    it('should throw NotFoundError if portfolio does not exist', async () => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        portfolioService.deletePortfolio(portfolioId, userId)
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ============================================
  // Holding Tests
  // ============================================

  describe('addHolding', () => {
    const portfolioId = 'portfolio-123';
    const userId = 'user-123';
    const symbol = 'AAPL';

    beforeEach(() => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue({
        id: portfolioId,
        userId,
        name: 'My Portfolio',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should add a new holding to portfolio', async () => {
      const mockHolding = {
        id: 'holding-123',
        portfolioId,
        symbol,
        shares: 100,
        avgCostBasis: 150.0,
        addedAt: new Date(),
        updatedAt: new Date(),
        stock: {
          name: 'Apple Inc.',
          exchange: 'NASDAQ',
          sector: 'Technology',
        },
      };

      (prisma.stock.findUnique as jest.Mock).mockResolvedValue({
        symbol,
        name: 'Apple Inc.',
        exchange: 'NASDAQ',
        sector: 'Technology',
        industry: null,
        marketCap: BigInt(3000000000000),
        country: 'US',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.portfolioHolding.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.portfolioHolding.create as jest.Mock).mockResolvedValue(mockHolding);

      const result = await portfolioService.addHolding(portfolioId, userId, symbol, 100, 150.0);

      expect(result.symbol).toBe(symbol);
      expect(result.shares).toBe(100);
      expect(result.avgCostBasis).toBe(150.0);
    });

    it('should throw NotFoundError if stock does not exist', async () => {
      (prisma.stock.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        portfolioService.addHolding(portfolioId, userId, 'INVALID', 100, 150.0)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError if holding already exists', async () => {
      (prisma.stock.findUnique as jest.Mock).mockResolvedValue({
        symbol,
        name: 'Apple Inc.',
        exchange: 'NASDAQ',
        sector: 'Technology',
        industry: null,
        marketCap: BigInt(3000000000000),
        country: 'US',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.portfolioHolding.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-holding',
        portfolioId,
        symbol,
        shares: 50,
        avgCostBasis: 140.0,
        addedAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        portfolioService.addHolding(portfolioId, userId, symbol, 100, 150.0)
      ).rejects.toThrow(ConflictError);
    });

    it('should throw BadRequestError if shares is not positive', async () => {
      (prisma.stock.findUnique as jest.Mock).mockResolvedValue({
        symbol,
        name: 'Apple Inc.',
        exchange: 'NASDAQ',
        sector: 'Technology',
        industry: null,
        marketCap: BigInt(3000000000000),
        country: 'US',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.portfolioHolding.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        portfolioService.addHolding(portfolioId, userId, symbol, 0, 150.0)
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('getHoldings', () => {
    const portfolioId = 'portfolio-123';
    const userId = 'user-123';

    it('should return all holdings for a portfolio', async () => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue({
        id: portfolioId,
        userId,
        name: 'My Portfolio',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (redisHelpers.getJson as jest.Mock).mockResolvedValue(null);

      const mockHoldings = [
        {
          id: 'holding-1',
          portfolioId,
          symbol: 'AAPL',
          shares: 100,
          avgCostBasis: 150.0,
          addedAt: new Date(),
          updatedAt: new Date(),
          stock: { name: 'Apple Inc.', exchange: 'NASDAQ', sector: 'Technology' },
        },
        {
          id: 'holding-2',
          portfolioId,
          symbol: 'GOOGL',
          shares: 50,
          avgCostBasis: 140.0,
          addedAt: new Date(),
          updatedAt: new Date(),
          stock: { name: 'Alphabet Inc.', exchange: 'NASDAQ', sector: 'Technology' },
        },
      ];

      (prisma.portfolioHolding.findMany as jest.Mock).mockResolvedValue(mockHoldings);

      const result = await portfolioService.getHoldings(portfolioId, userId);

      expect(result).toHaveLength(2);
      expect(result[0].symbol).toBe('AAPL');
      expect(result[1].symbol).toBe('GOOGL');
    });

    it('should return cached holdings if available', async () => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue({
        id: portfolioId,
        userId,
        name: 'My Portfolio',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const cachedHoldings = [
        {
          id: 'holding-1',
          portfolioId,
          symbol: 'AAPL',
          shares: 100,
          avgCostBasis: 150.0,
          addedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          stock: { name: 'Apple Inc.', exchange: 'NASDAQ', sector: 'Technology' },
        },
      ];

      (redisHelpers.getJson as jest.Mock).mockResolvedValue(cachedHoldings);

      const result = await portfolioService.getHoldings(portfolioId, userId);

      expect(result).toHaveLength(1);
      expect(prisma.portfolioHolding.findMany).not.toHaveBeenCalled();
    });
  });

  describe('removeHolding', () => {
    const portfolioId = 'portfolio-123';
    const userId = 'user-123';
    const symbol = 'AAPL';

    it('should remove a holding from portfolio', async () => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue({
        id: portfolioId,
        userId,
        name: 'My Portfolio',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.portfolioHolding.findUnique as jest.Mock).mockResolvedValue({
        id: 'holding-123',
        portfolioId,
        symbol,
        shares: 100,
        avgCostBasis: 150.0,
        addedAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.portfolioHolding.delete as jest.Mock).mockResolvedValue({
        id: 'holding-123',
        portfolioId,
        symbol,
        shares: 100,
        avgCostBasis: 150.0,
        addedAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        portfolioService.removeHolding(portfolioId, userId, symbol)
      ).resolves.not.toThrow();
    });

    it('should throw NotFoundError if holding does not exist', async () => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue({
        id: portfolioId,
        userId,
        name: 'My Portfolio',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.portfolioHolding.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        portfolioService.removeHolding(portfolioId, userId, symbol)
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ============================================
  // Transaction Tests
  // ============================================

  describe('recordTransaction', () => {
    const portfolioId = 'portfolio-123';
    const userId = 'user-123';
    const symbol = 'AAPL';

    beforeEach(() => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue({
        id: portfolioId,
        userId,
        name: 'My Portfolio',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should record a buy transaction', async () => {
      const transactionDate = new Date();
      const mockTransaction = {
        id: 'transaction-123',
        portfolioId,
        symbol,
        type: 'buy',
        shares: 100,
        pricePerShare: 150.0,
        totalAmount: 15000.0,
        transactionDate,
        notes: null,
        createdAt: new Date(),
      };

      (prisma.portfolioTransaction.create as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.portfolioHolding.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.stock.findUnique as jest.Mock).mockResolvedValue({
        symbol,
        name: 'Apple Inc.',
        exchange: 'NASDAQ',
        sector: 'Technology',
        industry: null,
        marketCap: BigInt(3000000000000),
        country: 'US',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.portfolioHolding.create as jest.Mock).mockResolvedValue({
        id: 'holding-123',
        portfolioId,
        symbol,
        shares: 100,
        avgCostBasis: 150.0,
        addedAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await portfolioService.recordTransaction(portfolioId, userId, {
        symbol,
        type: 'buy',
        shares: 100,
        pricePerShare: 150.0,
        transactionDate,
      });

      expect(result.type).toBe('buy');
      expect(result.shares).toBe(100);
      expect(result.totalAmount).toBe(15000.0);
    });

    it('should record a sell transaction', async () => {
      const transactionDate = new Date();
      const mockTransaction = {
        id: 'transaction-123',
        portfolioId,
        symbol,
        type: 'sell',
        shares: 50,
        pricePerShare: 160.0,
        totalAmount: 8000.0,
        transactionDate,
        notes: null,
        createdAt: new Date(),
      };

      (prisma.portfolioTransaction.create as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.portfolioHolding.findUnique as jest.Mock).mockResolvedValue({
        id: 'holding-123',
        portfolioId,
        symbol,
        shares: 100,
        avgCostBasis: 150.0,
        addedAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.portfolioHolding.update as jest.Mock).mockResolvedValue({
        id: 'holding-123',
        portfolioId,
        symbol,
        shares: 50,
        avgCostBasis: 150.0,
        addedAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await portfolioService.recordTransaction(portfolioId, userId, {
        symbol,
        type: 'sell',
        shares: 50,
        pricePerShare: 160.0,
        transactionDate,
      });

      expect(result.type).toBe('sell');
      expect(result.shares).toBe(50);
    });

    it('should record a dividend transaction', async () => {
      const transactionDate = new Date();
      const mockTransaction = {
        id: 'transaction-123',
        portfolioId,
        symbol,
        type: 'dividend',
        shares: 100,
        pricePerShare: 0.5,
        totalAmount: 50.0,
        transactionDate,
        notes: 'Quarterly dividend',
        createdAt: new Date(),
      };

      (prisma.portfolioTransaction.create as jest.Mock).mockResolvedValue(mockTransaction);
      (prisma.portfolioHolding.findUnique as jest.Mock).mockResolvedValue({
        id: 'holding-123',
        portfolioId,
        symbol,
        shares: 100,
        avgCostBasis: 150.0,
        addedAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await portfolioService.recordTransaction(portfolioId, userId, {
        symbol,
        type: 'dividend',
        shares: 100,
        pricePerShare: 0.5,
        transactionDate,
        notes: 'Quarterly dividend',
      });

      expect(result.type).toBe('dividend');
      expect(result.notes).toBe('Quarterly dividend');
    });

    it('should throw BadRequestError if shares is not positive', async () => {
      await expect(
        portfolioService.recordTransaction(portfolioId, userId, {
          symbol,
          type: 'buy',
          shares: 0,
          pricePerShare: 150.0,
          transactionDate: new Date(),
        })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('getTransactions', () => {
    const portfolioId = 'portfolio-123';
    const userId = 'user-123';

    it('should return all transactions for a portfolio', async () => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue({
        id: portfolioId,
        userId,
        name: 'My Portfolio',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockTransactions = [
        {
          id: 'transaction-1',
          portfolioId,
          symbol: 'AAPL',
          type: 'buy',
          shares: 100,
          pricePerShare: 150.0,
          totalAmount: 15000.0,
          transactionDate: new Date(),
          notes: null,
          createdAt: new Date(),
        },
        {
          id: 'transaction-2',
          portfolioId,
          symbol: 'AAPL',
          type: 'sell',
          shares: 50,
          pricePerShare: 160.0,
          totalAmount: 8000.0,
          transactionDate: new Date(),
          notes: null,
          createdAt: new Date(),
        },
      ];

      (prisma.portfolioTransaction.findMany as jest.Mock).mockResolvedValue(mockTransactions);
      (prisma.portfolioTransaction.count as jest.Mock).mockResolvedValue(2);

      const result = await portfolioService.getTransactions(portfolioId, userId);

      expect(result.transactions).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter transactions by type', async () => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue({
        id: portfolioId,
        userId,
        name: 'My Portfolio',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockTransactions = [
        {
          id: 'transaction-1',
          portfolioId,
          symbol: 'AAPL',
          type: 'buy',
          shares: 100,
          pricePerShare: 150.0,
          totalAmount: 15000.0,
          transactionDate: new Date(),
          notes: null,
          createdAt: new Date(),
        },
      ];

      (prisma.portfolioTransaction.findMany as jest.Mock).mockResolvedValue(mockTransactions);
      (prisma.portfolioTransaction.count as jest.Mock).mockResolvedValue(1);

      const result = await portfolioService.getTransactions(portfolioId, userId, { type: 'buy' });

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].type).toBe('buy');
    });
  });
});
