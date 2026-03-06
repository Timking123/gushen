import { Router, Request, Response, NextFunction } from 'express';
import { secFilingService, SECFormType } from '../services/secFilingService.js';
import { secFilingAnalysisService } from '../services/analysisService.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * Helper to get string from query param
 */
function getQueryString(param: unknown): string | undefined {
  if (!param) return undefined;
  if (typeof param === 'string') return param;
  if (Array.isArray(param) && param.length > 0) return String(param[0]);
  return undefined;
}

/**
 * Parse form types from query parameter
 */
function parseFormTypes(formTypesParam: unknown): SECFormType[] | undefined {
  const param = getQueryString(formTypesParam);
  if (!param) return undefined;
  
  const validTypes: SECFormType[] = ['10-K', '10-Q', '8-K', '4', 'S-1', 'DEF 14A', '13F', 'SC 13G', 'SC 13D', 'Other'];
  const types = param.split(',').map(t => t.trim());
  
  return types.filter(t => validTypes.includes(t as SECFormType)) as SECFormType[];
}

/**
 * GET /api/sec-filings/recent
 * Get recent SEC filings across all stocks
 * 
 * Query params:
 * - formTypes: Comma-separated form types (e.g., "10-K,10-Q,8-K")
 * - limit: Maximum number of results (default: 50)
 */
router.get('/recent', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const formTypes = parseFormTypes(req.query.formTypes);
    const limit = Math.min(parseInt(getQueryString(req.query.limit) || '50'), 100);

    const filings = await secFilingService.getRecentSECFilings(formTypes, limit);

    res.json({
      success: true,
      data: filings,
    });
  } catch (error) {
    logger.error('Error fetching recent SEC filings:', error);
    next(error);
  }
});

/**
 * GET /api/sec-filings/form-types/descriptions
 * Get descriptions for all SEC form types
 */
router.get('/form-types/descriptions', (_req: Request, res: Response): void => {
  const formTypes: SECFormType[] = ['10-K', '10-Q', '8-K', '4', 'S-1', 'DEF 14A', '13F', 'SC 13G', 'SC 13D', 'Other'];
  
  const descriptions = formTypes.map(formType => ({
    formType,
    description: secFilingService.getFormTypeDescription(formType),
  }));

  res.json({
    success: true,
    data: descriptions,
  });
});

/**
 * GET /api/sec-filings/detail/:filingId
 * Get a specific SEC filing by ID
 * 
 * Implements Requirement 20.3: Provide file summary and original link
 */
router.get('/detail/:filingId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filingId = String(req.params.filingId);

    const filing = await secFilingService.getSECFilingById(filingId);

    if (!filing) {
      res.status(404).json({
        success: false,
        message: 'SEC filing not found',
      });
      return;
    }

    res.json({
      success: true,
      data: filing,
    });
  } catch (error) {
    logger.error(`Error fetching SEC filing ${req.params.filingId}:`, error);
    next(error);
  }
});

/**
 * GET /api/sec-filings/:symbol/filter
 * Get SEC filings with advanced filtering
 * 
 * Implements Requirement 20.5: Support filtering by form type and date range
 * 
 * Query params:
 * - formTypes: Comma-separated form types
 * - startDate: Start date (ISO format)
 * - endDate: End date (ISO format)
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 20)
 * - sortBy: Sort field (filedAt, formType, symbol)
 * - sortOrder: Sort order (asc, desc)
 */
router.get('/:symbol/filter', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const symbol = String(req.params.symbol);
    const formTypes = parseFormTypes(req.query.formTypes);
    const startDateStr = getQueryString(req.query.startDate);
    const endDateStr = getQueryString(req.query.endDate);
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    const page = parseInt(getQueryString(req.query.page) || '1');
    const limit = Math.min(parseInt(getQueryString(req.query.limit) || '20'), 100);
    const sortByStr = getQueryString(req.query.sortBy);
    const sortOrderStr = getQueryString(req.query.sortOrder);
    const sortBy = sortByStr as 'filedAt' | 'formType' | 'symbol' | undefined;
    const sortOrder = sortOrderStr as 'asc' | 'desc' | undefined;

    const result = await secFilingService.getSECFilings(
      {
        symbol,
        formTypes,
        startDate,
        endDate,
      },
      sortBy ? { field: sortBy, order: sortOrder || 'desc' } : undefined,
      { page, limit }
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(`Error filtering SEC filings for ${req.params.symbol}:`, error);
    next(error);
  }
});

/**
 * GET /api/sec-filings/:symbol
 * Get SEC filings for a specific stock
 * 
 * Implements Requirement 20.1: Display recent SEC filings (10-K, 10-Q, 8-K, etc.)
 * 
 * Query params:
 * - formTypes: Comma-separated form types (e.g., "10-K,10-Q,8-K")
 * - limit: Maximum number of results (default: 20)
 */
router.get('/:symbol', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const symbol = String(req.params.symbol);
    const formTypes = parseFormTypes(req.query.formTypes);
    const limit = Math.min(parseInt(getQueryString(req.query.limit) || '20'), 100);

    const filings = await secFilingService.getSECFilingsBySymbol(symbol, formTypes, limit);

    res.json({
      success: true,
      data: filings,
    });
  } catch (error) {
    logger.error(`Error fetching SEC filings for ${req.params.symbol}:`, error);
    next(error);
  }
});

// Protected routes (require authentication)

/**
 * POST /api/sec-filings
 * Create a new SEC filing (admin only)
 */
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { symbol, formType, filedAt, periodOfReport, url, summary } = req.body;

    if (!symbol || !formType || !filedAt || !url) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: symbol, formType, filedAt, url',
      });
      return;
    }

    const filing = await secFilingService.createSECFiling({
      symbol,
      formType,
      filedAt: new Date(filedAt),
      periodOfReport: periodOfReport ? new Date(periodOfReport) : null,
      url,
      summary,
    });

    res.status(201).json({
      success: true,
      data: filing,
    });
  } catch (error) {
    logger.error('Error creating SEC filing:', error);
    next(error);
  }
});

/**
 * POST /api/sec-filings/:filingId/ai-summary
 * Generate AI summary for SEC filing
 * 
 * Implements Requirement 20.4: Provide intelligent summary
 */
router.post('/:filingId/ai-summary', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filingId = String(req.params.filingId);

    // Get the filing
    const filing = await secFilingService.getSECFilingById(filingId);

    if (!filing) {
      res.status(404).json({
        success: false,
        message: 'SEC filing not found',
      });
      return;
    }

    // Generate AI summary
    const summaryResult = await secFilingAnalysisService.generateSECFilingSummary(
      filingId,
      filing.formType,
      filing.url,
      filing.summary || undefined
    );

    // Update the filing with the new summary
    await secFilingService.updateSECFilingSummary(filingId, summaryResult.summary);

    res.json({
      success: true,
      data: summaryResult,
    });
  } catch (error) {
    logger.error(`Error generating AI summary for SEC filing ${req.params.filingId}:`, error);
    next(error);
  }
});

/**
 * PATCH /api/sec-filings/:filingId/summary
 * Update SEC filing summary (for AI-generated summaries)
 * 
 * Implements Requirement 20.4: Provide intelligent summary
 */
router.patch('/:filingId/summary', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filingId = String(req.params.filingId);
    const { summary } = req.body;

    if (!summary) {
      res.status(400).json({
        success: false,
        message: 'Summary is required',
      });
      return;
    }

    const filing = await secFilingService.updateSECFilingSummary(filingId, summary);

    if (!filing) {
      res.status(404).json({
        success: false,
        message: 'SEC filing not found',
      });
      return;
    }

    res.json({
      success: true,
      data: filing,
    });
  } catch (error) {
    logger.error(`Error updating SEC filing summary ${req.params.filingId}:`, error);
    next(error);
  }
});

export default router;
