/**
 * Portfolio Calculation Service
 * Handles portfolio value calculations, returns, and sector distribution
 * Requirements: 17.2, 17.3, 17.5, 17.6
 */

import { prisma } from '../lib/prisma.js';

export interface HoldingWithValue {
  symbol: string;
  shares: number;
  avgCostBasis: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  gain: number;
  gainPercent: number;
  weight: number;
  sector?: string;
}

export interface PortfolioSummary {
  totalMarketValue: number;
  totalCostBasis: number;
  totalGain: number;
  totalGainPercent: number;
  dayChange: number;
  dayChangePercent: number;
  holdings: HoldingWithValue[];
}

export interface SectorDistribution {
  sector: string;
  marketValue: number;
  weight: number;
  stockCount: number;
}

export interface PortfolioPerformance {
  date: Date;
  value: number;
  dailyReturn: number;
  cumulativeReturn: number;
}

/**
 * Returns curve data point
 * Represents portfolio value and return at a specific date
 */
export interface ReturnsCurvePoint {
  date: Date;
  portfolioValue: number;
  dailyReturn: number;
  cumulativeReturn: number;
  totalInvested: number;
}

/**
 * Benchmark comparison data point
 * Represents both portfolio and benchmark returns at a specific date
 */
export interface BenchmarkComparisonPoint {
  date: Date;
  portfolioReturn: number;
  benchmarkReturn: number;
  alpha: number;
}

/**
 * Full benchmark comparison result
 */
export interface BenchmarkComparisonResult {
  portfolioId: string;
  benchmarkSymbol: string;
  startDate: Date;
  endDate: Date;
  portfolioTotalReturn: number;
  benchmarkTotalReturn: number;
  alpha: number;
  portfolioAnnualizedReturn: number;
  benchmarkAnnualizedReturn: number;
  dataPoints: BenchmarkComparisonPoint[];
}

/**
 * Returns curve result
 */
export interface ReturnsCurveResult {
  portfolioId: string;
  startDate: Date;
  endDate: Date;
  dataPoints: ReturnsCurvePoint[];
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
}

/**
 * Time range for returns calculation
 */
export type ReturnsTimeRange = '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | 'MAX';

/**
 * Internal holding snapshot for a specific date
 */
interface HoldingSnapshot {
  symbol: string;
  shares: number;
  avgCostBasis: number;
}

export const portfolioCalculationService = {
  /**
   * Calculate total market value of portfolio
   * Validates: Requirement 17.2
   * Property 25: 投资组合市值计算属性
   */
  calculateMarketValue(holdings: { shares: number; currentPrice: number }[]): number {
    return holdings.reduce((total, h) => total + h.shares * h.currentPrice, 0);
  },

  /**
   * Calculate gain/loss for a holding
   * Validates: Requirement 17.3
   * Property 26: 投资组合收益计算属性
   */
  calculateHoldingGain(shares: number, currentPrice: number, avgCostBasis: number): number {
    return (currentPrice - avgCostBasis) * shares;
  },

  /**
   * Calculate gain percentage for a holding
   */
  calculateHoldingGainPercent(currentPrice: number, avgCostBasis: number): number {
    if (avgCostBasis === 0) return 0;
    return ((currentPrice - avgCostBasis) / avgCostBasis) * 100;
  },

  /**
   * Calculate sector distribution
   * Validates: Requirement 17.5
   * Property 27: 投资组合板块分布属性
   */
  calculateSectorDistribution(
    holdings: { sector: string; marketValue: number }[]
  ): SectorDistribution[] {
    const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
    if (totalValue === 0) return [];

    const sectorMap = new Map<string, { value: number; count: number }>();

    for (const holding of holdings) {
      const sector = holding.sector || 'Unknown';
      const existing = sectorMap.get(sector) || { value: 0, count: 0 };
      sectorMap.set(sector, {
        value: existing.value + holding.marketValue,
        count: existing.count + 1,
      });
    }

    return Array.from(sectorMap.entries())
      .map(([sector, data]) => ({
        sector,
        marketValue: data.value,
        weight: (data.value / totalValue) * 100,
        stockCount: data.count,
      }))
      .sort((a, b) => b.weight - a.weight);
  },

  /**
   * Get full portfolio summary with current prices
   */
  async getPortfolioSummary(portfolioId: string): Promise<PortfolioSummary | null> {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        holdings: {
          include: {
            stock: {
              include: {
                quotes: {
                  orderBy: { timestamp: 'desc' },
                  take: 2,
                },
              },
            },
          },
        },
      },
    });

    if (!portfolio) return null;

    const holdingsWithValue: HoldingWithValue[] = [];
    let totalMarketValue = 0;
    let totalCostBasis = 0;
    let totalDayChange = 0;

    for (const holding of portfolio.holdings) {
      const latestQuote = holding.stock.quotes[0];
      const previousQuote = holding.stock.quotes[1];
      const currentPrice = latestQuote?.price || 0;
      const previousPrice = previousQuote?.price || currentPrice;

      const marketValue = holding.shares * currentPrice;
      const costBasis = holding.shares * holding.avgCostBasis;
      const gain = this.calculateHoldingGain(holding.shares, currentPrice, holding.avgCostBasis);
      const gainPercent = this.calculateHoldingGainPercent(currentPrice, holding.avgCostBasis);
      const dayChange = holding.shares * (currentPrice - previousPrice);

      totalMarketValue += marketValue;
      totalCostBasis += costBasis;
      totalDayChange += dayChange;

      holdingsWithValue.push({
        symbol: holding.symbol,
        shares: holding.shares,
        avgCostBasis: holding.avgCostBasis,
        currentPrice,
        marketValue,
        costBasis,
        gain,
        gainPercent,
        weight: 0, // Will be calculated after total is known
        sector: holding.stock.sector || undefined,
      });
    }

    // Calculate weights
    for (const holding of holdingsWithValue) {
      holding.weight = totalMarketValue > 0 ? (holding.marketValue / totalMarketValue) * 100 : 0;
    }

    const totalGain = totalMarketValue - totalCostBasis;
    const totalGainPercent = totalCostBasis > 0 ? (totalGain / totalCostBasis) * 100 : 0;
    const dayChangePercent =
      totalMarketValue - totalDayChange > 0
        ? (totalDayChange / (totalMarketValue - totalDayChange)) * 100
        : 0;

    return {
      totalMarketValue,
      totalCostBasis,
      totalGain,
      totalGainPercent,
      dayChange: totalDayChange,
      dayChangePercent,
      holdings: holdingsWithValue,
    };
  },

  /**
   * Get sector distribution for a portfolio
   */
  async getSectorDistribution(portfolioId: string): Promise<SectorDistribution[]> {
    const summary = await this.getPortfolioSummary(portfolioId);
    if (!summary) return [];

    return this.calculateSectorDistribution(
      summary.holdings.map((h) => ({
        sector: h.sector || 'Unknown',
        marketValue: h.marketValue,
      }))
    );
  },

  /**
   * Compare portfolio performance against a benchmark
   * Validates: Requirement 17.6
   */
  async compareToBenchmark(
    portfolioId: string,
    benchmarkSymbol: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    portfolioReturn: number;
    benchmarkReturn: number;
    alpha: number;
  } | null> {
    // Get benchmark data
    const benchmarkData = await prisma.oHLCV.findMany({
      where: {
        symbol: benchmarkSymbol,
        timestamp: { gte: startDate, lte: endDate },
      },
      orderBy: { timestamp: 'asc' },
    });

    if (benchmarkData.length < 2) return null;

    const benchmarkStartPrice = benchmarkData[0].close;
    const benchmarkEndPrice = benchmarkData[benchmarkData.length - 1].close;
    const benchmarkReturn = ((benchmarkEndPrice - benchmarkStartPrice) / benchmarkStartPrice) * 100;

    // Calculate portfolio return (simplified - using current summary)
    const summary = await this.getPortfolioSummary(portfolioId);
    const portfolioReturn = summary?.totalGainPercent || 0;

    return {
      portfolioReturn,
      benchmarkReturn,
      alpha: portfolioReturn - benchmarkReturn,
    };
  },

  /**
   * Calculate start date based on time range
   * @param range - Time range for returns calculation
   * @returns Start date
   */
  calculateStartDateFromRange(range: ReturnsTimeRange): Date {
    const now = new Date();
    switch (range) {
      case '1M':
        return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      case '3M':
        return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      case '6M':
        return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      case '1Y':
        return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      case '3Y':
        return new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
      case '5Y':
        return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      case 'MAX':
        return new Date(1970, 0, 1);
      default:
        return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    }
  },

  /**
   * Get portfolio holdings snapshot at a specific date
   * Reconstructs holdings based on transactions up to that date
   * @param portfolioId - Portfolio ID
   * @param asOfDate - Date to calculate holdings for
   * @returns Map of symbol to holding snapshot
   */
  async getHoldingsSnapshotAtDate(
    portfolioId: string,
    asOfDate: Date
  ): Promise<Map<string, HoldingSnapshot>> {
    const transactions = await prisma.portfolioTransaction.findMany({
      where: {
        portfolioId,
        transactionDate: { lte: asOfDate },
      },
      orderBy: { transactionDate: 'asc' },
    });

    const holdings = new Map<string, HoldingSnapshot>();

    for (const tx of transactions) {
      const existing = holdings.get(tx.symbol);

      if (tx.type === 'buy') {
        if (existing) {
          // Calculate weighted average cost basis
          const totalShares = existing.shares + tx.shares;
          const newAvgCost =
            (existing.shares * existing.avgCostBasis + tx.shares * tx.pricePerShare) / totalShares;
          holdings.set(tx.symbol, {
            symbol: tx.symbol,
            shares: totalShares,
            avgCostBasis: newAvgCost,
          });
        } else {
          holdings.set(tx.symbol, {
            symbol: tx.symbol,
            shares: tx.shares,
            avgCostBasis: tx.pricePerShare,
          });
        }
      } else if (tx.type === 'sell' && existing) {
        const newShares = existing.shares - tx.shares;
        if (newShares <= 0) {
          holdings.delete(tx.symbol);
        } else {
          holdings.set(tx.symbol, {
            ...existing,
            shares: newShares,
          });
        }
      }
      // Dividend transactions don't affect holdings
    }

    return holdings;
  },

  /**
   * Calculate portfolio value at a specific date
   * @param holdings - Holdings snapshot
   * @param priceMap - Map of symbol to price at that date
   * @returns Total portfolio value
   */
  calculatePortfolioValueAtDate(
    holdings: Map<string, HoldingSnapshot>,
    priceMap: Map<string, number>
  ): number {
    let totalValue = 0;
    for (const [symbol, holding] of holdings) {
      const price = priceMap.get(symbol);
      if (price !== undefined) {
        totalValue += holding.shares * price;
      }
    }
    return totalValue;
  },

  /**
   * Calculate total invested amount at a specific date
   * @param holdings - Holdings snapshot
   * @returns Total cost basis
   */
  calculateTotalInvestedAtDate(holdings: Map<string, HoldingSnapshot>): number {
    let totalInvested = 0;
    for (const holding of holdings.values()) {
      totalInvested += holding.shares * holding.avgCostBasis;
    }
    return totalInvested;
  },

  /**
   * Calculate historical returns curve for a portfolio
   * Validates: Requirement 17.6 - 显示收益曲线
   * @param portfolioId - Portfolio ID
   * @param range - Time range for returns calculation
   * @returns Returns curve result with data points
   */
  async calculateReturnsCurve(
    portfolioId: string,
    range: ReturnsTimeRange = '1Y'
  ): Promise<ReturnsCurveResult | null> {
    const endDate = new Date();
    const startDate = this.calculateStartDateFromRange(range);

    // Get all transactions for the portfolio
    const allTransactions = await prisma.portfolioTransaction.findMany({
      where: { portfolioId },
      orderBy: { transactionDate: 'asc' },
    });

    if (allTransactions.length === 0) {
      return null;
    }

    // Get unique symbols from transactions
    const symbols = [...new Set(allTransactions.map((tx) => tx.symbol))];

    // Get historical price data for all symbols
    const priceData = await prisma.oHLCV.findMany({
      where: {
        symbol: { in: symbols },
        timestamp: { gte: startDate, lte: endDate },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Group price data by date
    const pricesByDate = new Map<string, Map<string, number>>();
    for (const price of priceData) {
      const dateKey = price.timestamp.toISOString().split('T')[0];
      if (!pricesByDate.has(dateKey)) {
        pricesByDate.set(dateKey, new Map());
      }
      pricesByDate.get(dateKey)!.set(price.symbol, price.close);
    }

    // Get all unique dates and sort them
    const dates = [...pricesByDate.keys()].sort();

    if (dates.length === 0) {
      return null;
    }

    // Calculate returns curve data points
    const dataPoints: ReturnsCurvePoint[] = [];
    let previousValue: number | null = null;
    let initialValue: number | null = null;
    let maxValue = 0;
    let maxDrawdown = 0;

    for (const dateKey of dates) {
      const date = new Date(dateKey);
      const holdings = await this.getHoldingsSnapshotAtDate(portfolioId, date);
      const priceMap = pricesByDate.get(dateKey)!;

      const portfolioValue = this.calculatePortfolioValueAtDate(holdings, priceMap);
      const totalInvested = this.calculateTotalInvestedAtDate(holdings);

      // Skip dates with no holdings
      if (holdings.size === 0 || portfolioValue === 0) {
        continue;
      }

      // Calculate daily return
      let dailyReturn = 0;
      if (previousValue !== null && previousValue > 0) {
        dailyReturn = ((portfolioValue - previousValue) / previousValue) * 100;
      }

      // Calculate cumulative return
      if (initialValue === null) {
        initialValue = portfolioValue;
      }
      const cumulativeReturn =
        initialValue > 0 ? ((portfolioValue - initialValue) / initialValue) * 100 : 0;

      // Track max drawdown
      if (portfolioValue > maxValue) {
        maxValue = portfolioValue;
      }
      if (maxValue > 0) {
        const drawdown = ((maxValue - portfolioValue) / maxValue) * 100;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }

      dataPoints.push({
        date,
        portfolioValue,
        dailyReturn,
        cumulativeReturn,
        totalInvested,
      });

      previousValue = portfolioValue;
    }

    if (dataPoints.length === 0) {
      return null;
    }

    // Calculate total and annualized returns
    const firstPoint = dataPoints[0];
    const lastPoint = dataPoints[dataPoints.length - 1];
    const totalReturn = lastPoint.cumulativeReturn;

    // Calculate annualized return
    const daysDiff =
      (lastPoint.date.getTime() - firstPoint.date.getTime()) / (1000 * 60 * 60 * 24);
    const years = daysDiff / 365;
    const annualizedReturn =
      years > 0 ? (Math.pow(1 + totalReturn / 100, 1 / years) - 1) * 100 : totalReturn;

    return {
      portfolioId,
      startDate: firstPoint.date,
      endDate: lastPoint.date,
      dataPoints,
      totalReturn,
      annualizedReturn,
      maxDrawdown,
    };
  },

  /**
   * Calculate detailed benchmark comparison with time series data
   * Validates: Requirement 17.6 - 与基准指数的对比
   * @param portfolioId - Portfolio ID
   * @param benchmarkSymbol - Benchmark index symbol (e.g., 'SPY', 'QQQ')
   * @param range - Time range for comparison
   * @returns Detailed benchmark comparison result
   */
  async calculateBenchmarkComparison(
    portfolioId: string,
    benchmarkSymbol: string,
    range: ReturnsTimeRange = '1Y'
  ): Promise<BenchmarkComparisonResult | null> {
    const endDate = new Date();
    const startDate = this.calculateStartDateFromRange(range);

    // Get portfolio returns curve
    const portfolioReturns = await this.calculateReturnsCurve(portfolioId, range);
    if (!portfolioReturns || portfolioReturns.dataPoints.length === 0) {
      return null;
    }

    // Get benchmark price data
    const benchmarkData = await prisma.oHLCV.findMany({
      where: {
        symbol: benchmarkSymbol,
        timestamp: { gte: startDate, lte: endDate },
      },
      orderBy: { timestamp: 'asc' },
    });

    if (benchmarkData.length < 2) {
      return null;
    }

    // Create benchmark price map by date
    const benchmarkPriceByDate = new Map<string, number>();
    for (const price of benchmarkData) {
      const dateKey = price.timestamp.toISOString().split('T')[0];
      benchmarkPriceByDate.set(dateKey, price.close);
    }

    // Calculate benchmark returns
    const benchmarkStartPrice = benchmarkData[0].close;
    const benchmarkEndPrice = benchmarkData[benchmarkData.length - 1].close;
    const benchmarkTotalReturn =
      ((benchmarkEndPrice - benchmarkStartPrice) / benchmarkStartPrice) * 100;

    // Generate comparison data points
    const dataPoints: BenchmarkComparisonPoint[] = [];
    let benchmarkInitialPrice: number | null = null;

    for (const portfolioPoint of portfolioReturns.dataPoints) {
      const dateKey = portfolioPoint.date.toISOString().split('T')[0];
      const benchmarkPrice = benchmarkPriceByDate.get(dateKey);

      if (benchmarkPrice !== undefined) {
        if (benchmarkInitialPrice === null) {
          benchmarkInitialPrice = benchmarkPrice;
        }

        const benchmarkReturn =
          benchmarkInitialPrice > 0
            ? ((benchmarkPrice - benchmarkInitialPrice) / benchmarkInitialPrice) * 100
            : 0;

        dataPoints.push({
          date: portfolioPoint.date,
          portfolioReturn: portfolioPoint.cumulativeReturn,
          benchmarkReturn,
          alpha: portfolioPoint.cumulativeReturn - benchmarkReturn,
        });
      }
    }

    if (dataPoints.length === 0) {
      return null;
    }

    // Calculate annualized returns
    const daysDiff =
      (portfolioReturns.endDate.getTime() - portfolioReturns.startDate.getTime()) /
      (1000 * 60 * 60 * 24);
    const years = daysDiff / 365;

    const portfolioAnnualizedReturn =
      years > 0
        ? (Math.pow(1 + portfolioReturns.totalReturn / 100, 1 / years) - 1) * 100
        : portfolioReturns.totalReturn;

    const benchmarkAnnualizedReturn =
      years > 0 ? (Math.pow(1 + benchmarkTotalReturn / 100, 1 / years) - 1) * 100 : benchmarkTotalReturn;

    return {
      portfolioId,
      benchmarkSymbol,
      startDate: portfolioReturns.startDate,
      endDate: portfolioReturns.endDate,
      portfolioTotalReturn: portfolioReturns.totalReturn,
      benchmarkTotalReturn,
      alpha: portfolioReturns.totalReturn - benchmarkTotalReturn,
      portfolioAnnualizedReturn,
      benchmarkAnnualizedReturn,
      dataPoints,
    };
  },

  /**
   * Get available benchmark indices
   * Returns common benchmark symbols that can be used for comparison
   */
  getAvailableBenchmarks(): { symbol: string; name: string; description: string }[] {
    return [
      { symbol: 'SPY', name: 'S&P 500', description: 'S&P 500 Index ETF' },
      { symbol: 'QQQ', name: 'NASDAQ 100', description: 'NASDAQ 100 Index ETF' },
      { symbol: 'DIA', name: 'Dow Jones', description: 'Dow Jones Industrial Average ETF' },
      { symbol: 'IWM', name: 'Russell 2000', description: 'Russell 2000 Small Cap ETF' },
      { symbol: 'VTI', name: 'Total Market', description: 'Vanguard Total Stock Market ETF' },
    ];
  },
};
