/**
 * Portfolio Routes
 * REST API endpoints for portfolio management
 * Requirements: 17.1, 17.4, 17.6, 17.7
 */

import { Router, Response } from 'express';
import { portfolioService } from '../services/portfolioService.js';
import { portfolioCalculationService, ReturnsTimeRange } from '../services/portfolioCalculationService.js';
import { authenticate } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/portfolios/benchmarks/available
 * Get list of available benchmark indices
 * Note: This route must be defined before /:id routes to avoid conflicts
 */
router.get('/benchmarks/available', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const benchmarks = portfolioCalculationService.getAvailableBenchmarks();
    res.json({ success: true, data: benchmarks });
  } catch (error) {
    console.error('Error fetching available benchmarks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch available benchmarks' });
  }
});

/**
 * GET /api/portfolios
 * Get all portfolios for the authenticated user
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const portfolios = await portfolioService.getPortfolios(req.user!.id);
    res.json({ success: true, data: portfolios });
  } catch (error) {
    console.error('Error fetching portfolios:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch portfolios' });
  }
});

/**
 * POST /api/portfolios
 * Create a new portfolio
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: 'Portfolio name is required' });
      return;
    }

    const portfolio = await portfolioService.createPortfolio({
      userId: req.user!.id,
      name,
      description,
    });
    res.status(201).json({ success: true, data: portfolio });
  } catch (error) {
    console.error('Error creating portfolio:', error);
    res.status(500).json({ success: false, error: 'Failed to create portfolio' });
  }
});

/**
 * GET /api/portfolios/:id
 * Get a specific portfolio
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const portfolioId = req.params.id as string;
    const portfolio = await portfolioService.getPortfolio(portfolioId, req.user!.id);
    if (!portfolio) {
      res.status(404).json({ success: false, error: 'Portfolio not found' });
      return;
    }
    res.json({ success: true, data: portfolio });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch portfolio' });
  }
});

/**
 * PUT /api/portfolios/:id
 * Update a portfolio
 */
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const portfolioId = req.params.id as string;
    const { name, description } = req.body;
    const portfolio = await portfolioService.updatePortfolio(portfolioId, req.user!.id, {
      name,
      description,
    });
    if (!portfolio) {
      res.status(404).json({ success: false, error: 'Portfolio not found' });
      return;
    }
    res.json({ success: true, data: portfolio });
  } catch (error) {
    console.error('Error updating portfolio:', error);
    res.status(500).json({ success: false, error: 'Failed to update portfolio' });
  }
});

/**
 * DELETE /api/portfolios/:id
 * Delete a portfolio
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const portfolioId = req.params.id as string;
    const deleted = await portfolioService.deletePortfolio(portfolioId, req.user!.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Portfolio not found' });
      return;
    }
    res.json({ success: true, message: 'Portfolio deleted' });
  } catch (error) {
    console.error('Error deleting portfolio:', error);
    res.status(500).json({ success: false, error: 'Failed to delete portfolio' });
  }
});

/**
 * GET /api/portfolios/:id/holdings
 * Get all holdings for a portfolio
 */
router.get('/:id/holdings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const portfolioId = req.params.id as string;
    const portfolio = await portfolioService.getPortfolio(portfolioId, req.user!.id);
    if (!portfolio) {
      res.status(404).json({ success: false, error: 'Portfolio not found' });
      return;
    }
    const holdings = await portfolioService.getHoldings(portfolioId);
    res.json({ success: true, data: holdings });
  } catch (error) {
    console.error('Error fetching holdings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch holdings' });
  }
});

/**
 * POST /api/portfolios/:id/holdings
 * Add a holding to portfolio
 */
router.post('/:id/holdings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const portfolioId = req.params.id as string;
    const portfolio = await portfolioService.getPortfolio(portfolioId, req.user!.id);
    if (!portfolio) {
      res.status(404).json({ success: false, error: 'Portfolio not found' });
      return;
    }

    const { symbol, shares, avgCostBasis } = req.body;
    if (!symbol || shares === undefined || avgCostBasis === undefined) {
      res.status(400).json({
        success: false,
        error: 'Symbol, shares, and avgCostBasis are required',
      });
      return;
    }

    const holding = await portfolioService.addHolding({
      portfolioId,
      symbol,
      shares,
      avgCostBasis,
    });
    res.status(201).json({ success: true, data: holding });
  } catch (error) {
    console.error('Error adding holding:', error);
    res.status(500).json({ success: false, error: 'Failed to add holding' });
  }
});

/**
 * PUT /api/portfolios/:id/holdings/:holdingId
 * Update a holding
 */
router.put('/:id/holdings/:holdingId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const portfolioId = req.params.id as string;
    const holdingId = req.params.holdingId as string;
    const portfolio = await portfolioService.getPortfolio(portfolioId, req.user!.id);
    if (!portfolio) {
      res.status(404).json({ success: false, error: 'Portfolio not found' });
      return;
    }

    const { shares, avgCostBasis } = req.body;
    const holding = await portfolioService.updateHolding(holdingId, {
      shares,
      avgCostBasis,
    });
    res.json({ success: true, data: holding });
  } catch (error) {
    console.error('Error updating holding:', error);
    res.status(500).json({ success: false, error: 'Failed to update holding' });
  }
});

/**
 * DELETE /api/portfolios/:id/holdings/:holdingId
 * Remove a holding
 */
router.delete('/:id/holdings/:holdingId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const portfolioId = req.params.id as string;
    const holdingId = req.params.holdingId as string;
    const portfolio = await portfolioService.getPortfolio(portfolioId, req.user!.id);
    if (!portfolio) {
      res.status(404).json({ success: false, error: 'Portfolio not found' });
      return;
    }

    await portfolioService.removeHolding(holdingId);
    res.json({ success: true, message: 'Holding removed' });
  } catch (error) {
    console.error('Error removing holding:', error);
    res.status(500).json({ success: false, error: 'Failed to remove holding' });
  }
});

/**
 * GET /api/portfolios/:id/transactions
 * Get transactions for a portfolio
 */
router.get('/:id/transactions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const portfolioId = req.params.id as string;
    const portfolio = await portfolioService.getPortfolio(portfolioId, req.user!.id);
    if (!portfolio) {
      res.status(404).json({ success: false, error: 'Portfolio not found' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const transactions = await portfolioService.getTransactions(portfolioId, { limit, offset });
    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
  }
});

/**
 * POST /api/portfolios/:id/transactions
 * Record a transaction
 */
router.post('/:id/transactions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const portfolioId = req.params.id as string;
    const portfolio = await portfolioService.getPortfolio(portfolioId, req.user!.id);
    if (!portfolio) {
      res.status(404).json({ success: false, error: 'Portfolio not found' });
      return;
    }

    const { symbol, type, shares, pricePerShare, transactionDate, notes } = req.body;
    if (!symbol || !type || shares === undefined || pricePerShare === undefined) {
      res.status(400).json({
        success: false,
        error: 'Symbol, type, shares, and pricePerShare are required',
      });
      return;
    }

    if (!['buy', 'sell', 'dividend'].includes(type)) {
      res.status(400).json({
        success: false,
        error: 'Type must be buy, sell, or dividend',
      });
      return;
    }

    const transaction = await portfolioService.recordTransaction({
      portfolioId,
      symbol,
      type,
      shares,
      pricePerShare,
      transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
      notes,
    });
    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    console.error('Error recording transaction:', error);
    res.status(500).json({ success: false, error: 'Failed to record transaction' });
  }
});

/**
 * GET /api/portfolios/:id/summary
 * Get portfolio summary with current values
 * Validates: Requirement 17.2, 17.3
 */
router.get('/:id/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const portfolioId = req.params.id as string;
    const portfolio = await portfolioService.getPortfolio(portfolioId, req.user!.id);
    if (!portfolio) {
      res.status(404).json({ success: false, error: 'Portfolio not found' });
      return;
    }

    const summary = await portfolioCalculationService.getPortfolioSummary(portfolioId);
    if (!summary) {
      res.status(404).json({ success: false, error: 'Unable to calculate portfolio summary' });
      return;
    }

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error fetching portfolio summary:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch portfolio summary' });
  }
});

/**
 * GET /api/portfolios/:id/sector-distribution
 * Get portfolio sector distribution
 * Validates: Requirement 17.5
 */
router.get('/:id/sector-distribution', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const portfolioId = req.params.id as string;
    const portfolio = await portfolioService.getPortfolio(portfolioId, req.user!.id);
    if (!portfolio) {
      res.status(404).json({ success: false, error: 'Portfolio not found' });
      return;
    }

    const distribution = await portfolioCalculationService.getSectorDistribution(portfolioId);
    res.json({ success: true, data: distribution });
  } catch (error) {
    console.error('Error fetching sector distribution:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sector distribution' });
  }
});

/**
 * GET /api/portfolios/:id/returns-curve
 * Get historical returns curve for a portfolio
 * Validates: Requirement 17.6 - 显示收益曲线
 * 
 * Query params:
 * - range: Time range ('1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX'), default '1Y'
 */
router.get('/:id/returns-curve', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const portfolioId = req.params.id as string;
    const portfolio = await portfolioService.getPortfolio(portfolioId, req.user!.id);
    if (!portfolio) {
      res.status(404).json({ success: false, error: 'Portfolio not found' });
      return;
    }

    const range = (req.query.range as ReturnsTimeRange) || '1Y';
    const validRanges: ReturnsTimeRange[] = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX'];
    if (!validRanges.includes(range)) {
      res.status(400).json({
        success: false,
        error: `Invalid range. Must be one of: ${validRanges.join(', ')}`,
      });
      return;
    }

    const returnsCurve = await portfolioCalculationService.calculateReturnsCurve(portfolioId, range);
    if (!returnsCurve) {
      res.status(404).json({
        success: false,
        error: 'Unable to calculate returns curve. Portfolio may have no transactions or price data.',
      });
      return;
    }

    res.json({ success: true, data: returnsCurve });
  } catch (error) {
    console.error('Error fetching returns curve:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch returns curve' });
  }
});

/**
 * GET /api/portfolios/:id/benchmark-comparison
 * Compare portfolio performance against a benchmark index
 * Validates: Requirement 17.6 - 与基准指数的对比
 * 
 * Query params:
 * - benchmark: Benchmark symbol (e.g., 'SPY', 'QQQ'), default 'SPY'
 * - range: Time range ('1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX'), default '1Y'
 */
router.get('/:id/benchmark-comparison', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const portfolioId = req.params.id as string;
    const portfolio = await portfolioService.getPortfolio(portfolioId, req.user!.id);
    if (!portfolio) {
      res.status(404).json({ success: false, error: 'Portfolio not found' });
      return;
    }

    const benchmarkSymbol = (req.query.benchmark as string) || 'SPY';
    const range = (req.query.range as ReturnsTimeRange) || '1Y';
    
    const validRanges: ReturnsTimeRange[] = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX'];
    if (!validRanges.includes(range)) {
      res.status(400).json({
        success: false,
        error: `Invalid range. Must be one of: ${validRanges.join(', ')}`,
      });
      return;
    }

    const comparison = await portfolioCalculationService.calculateBenchmarkComparison(
      portfolioId,
      benchmarkSymbol,
      range
    );

    if (!comparison) {
      res.status(404).json({
        success: false,
        error: 'Unable to calculate benchmark comparison. Portfolio or benchmark may have insufficient data.',
      });
      return;
    }

    res.json({ success: true, data: comparison });
  } catch (error) {
    console.error('Error fetching benchmark comparison:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch benchmark comparison' });
  }
});

export default router;
