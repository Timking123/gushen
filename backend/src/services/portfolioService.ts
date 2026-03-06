/**
 * Portfolio Service
 * Handles portfolio CRUD operations, holdings management, and transaction recording
 * Requirements: 17.1, 17.4, 17.7
 */

import { prisma } from '../lib/prisma.js';

export interface CreatePortfolioInput {
  userId: string;
  name: string;
  description?: string;
}

export interface UpdatePortfolioInput {
  name?: string;
  description?: string;
}

export interface AddHoldingInput {
  portfolioId: string;
  symbol: string;
  shares: number;
  avgCostBasis: number;
}

export interface UpdateHoldingInput {
  shares?: number;
  avgCostBasis?: number;
}

export interface RecordTransactionInput {
  portfolioId: string;
  symbol: string;
  type: 'buy' | 'sell' | 'dividend';
  shares: number;
  pricePerShare: number;
  transactionDate: Date;
  notes?: string;
}

export const portfolioService = {
  /**
   * Create a new portfolio
   * Validates: Requirement 17.1, 17.7
   */
  async createPortfolio(input: CreatePortfolioInput) {
    return prisma.portfolio.create({
      data: {
        userId: input.userId,
        name: input.name,
        description: input.description || null,
      },
      include: {
        holdings: true,
        transactions: {
          orderBy: { transactionDate: 'desc' },
          take: 10,
        },
      },
    });
  },

  /**
   * Get all portfolios for a user
   * Validates: Requirement 17.7
   */
  async getPortfolios(userId: string) {
    return prisma.portfolio.findMany({
      where: { userId },
      include: {
        holdings: {
          include: { stock: true },
        },
        _count: { select: { transactions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Get a single portfolio by ID
   */
  async getPortfolio(portfolioId: string, userId: string) {
    return prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
      include: {
        holdings: {
          include: { stock: true },
        },
        transactions: {
          orderBy: { transactionDate: 'desc' },
        },
      },
    });
  },

  /**
   * Update portfolio details
   */
  async updatePortfolio(portfolioId: string, userId: string, input: UpdatePortfolioInput) {
    const portfolio = await prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
    });
    if (!portfolio) return null;

    return prisma.portfolio.update({
      where: { id: portfolioId },
      data: input,
      include: {
        holdings: true,
      },
    });
  },

  /**
   * Delete a portfolio
   */
  async deletePortfolio(portfolioId: string, userId: string) {
    const portfolio = await prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
    });
    if (!portfolio) return false;

    await prisma.portfolio.delete({ where: { id: portfolioId } });
    return true;
  },

  /**
   * Add a holding to portfolio
   * Validates: Requirement 17.1
   */
  async addHolding(input: AddHoldingInput) {
    const existing = await prisma.portfolioHolding.findUnique({
      where: {
        portfolioId_symbol: {
          portfolioId: input.portfolioId,
          symbol: input.symbol,
        },
      },
    });

    if (existing) {
      // Update existing holding with weighted average cost basis
      const totalShares = existing.shares + input.shares;
      const newAvgCost =
        (existing.shares * existing.avgCostBasis + input.shares * input.avgCostBasis) / totalShares;

      return prisma.portfolioHolding.update({
        where: { id: existing.id },
        data: {
          shares: totalShares,
          avgCostBasis: newAvgCost,
        },
        include: { stock: true },
      });
    }

    return prisma.portfolioHolding.create({
      data: {
        portfolioId: input.portfolioId,
        symbol: input.symbol,
        shares: input.shares,
        avgCostBasis: input.avgCostBasis,
      },
      include: { stock: true },
    });
  },

  /**
   * Update a holding
   */
  async updateHolding(holdingId: string, input: UpdateHoldingInput) {
    return prisma.portfolioHolding.update({
      where: { id: holdingId },
      data: input,
      include: { stock: true },
    });
  },

  /**
   * Remove a holding from portfolio
   */
  async removeHolding(holdingId: string) {
    await prisma.portfolioHolding.delete({ where: { id: holdingId } });
    return true;
  },

  /**
   * Get all holdings for a portfolio
   */
  async getHoldings(portfolioId: string) {
    return prisma.portfolioHolding.findMany({
      where: { portfolioId },
      include: { stock: true },
      orderBy: { addedAt: 'desc' },
    });
  },

  /**
   * Record a transaction
   * Validates: Requirement 17.4
   */
  async recordTransaction(input: RecordTransactionInput) {
    const totalAmount = input.shares * input.pricePerShare;

    const transaction = await prisma.portfolioTransaction.create({
      data: {
        portfolioId: input.portfolioId,
        symbol: input.symbol,
        type: input.type,
        shares: input.shares,
        pricePerShare: input.pricePerShare,
        totalAmount,
        transactionDate: input.transactionDate,
        notes: input.notes || null,
      },
    });

    // Update holding based on transaction type
    if (input.type === 'buy') {
      await this.addHolding({
        portfolioId: input.portfolioId,
        symbol: input.symbol,
        shares: input.shares,
        avgCostBasis: input.pricePerShare,
      });
    } else if (input.type === 'sell') {
      const holding = await prisma.portfolioHolding.findUnique({
        where: {
          portfolioId_symbol: {
            portfolioId: input.portfolioId,
            symbol: input.symbol,
          },
        },
      });

      if (holding) {
        const newShares = holding.shares - input.shares;
        if (newShares <= 0) {
          await prisma.portfolioHolding.delete({ where: { id: holding.id } });
        } else {
          await prisma.portfolioHolding.update({
            where: { id: holding.id },
            data: { shares: newShares },
          });
        }
      }
    }

    return transaction;
  },

  /**
   * Get transactions for a portfolio
   */
  async getTransactions(portfolioId: string, options?: { limit?: number; offset?: number }) {
    return prisma.portfolioTransaction.findMany({
      where: { portfolioId },
      orderBy: { transactionDate: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });
  },

  /**
   * Get transactions for a specific symbol in portfolio
   */
  async getSymbolTransactions(portfolioId: string, symbol: string) {
    return prisma.portfolioTransaction.findMany({
      where: { portfolioId, symbol },
      orderBy: { transactionDate: 'desc' },
    });
  },
};
