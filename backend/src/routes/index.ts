import { Router } from 'express';
import authRoutes from './auth.js';
import userSettingsRoutes from './userSettings.js';
import stockRoutes from './stocks.js';
import watchlistRoutes from './watchlist.js';
import newsRoutes from './news.js';
import analysisRoutes from './analysis.js';
import pushRoutes from './push.js';
import screenerRoutes from './screener.js';
import earningsRoutes from './earnings.js';
import insiderRoutes from './insider.js';
import quantRatingRoutes from './quantRating.js';
import transcriptRoutes from './transcript.js';
import dividendRoutes from './dividend.js';
import portfolioRoutes from './portfolio.js';
import marketRoutes from './market.js';
import analystRatingRoutes from './analystRating.js';
import secFilingRoutes from './secFiling.js';
import sectorRoutes from './sector.js';
import aiAssistantRoutes from './aiAssistant.js';
import statusRoutes from './status.js';

const router = Router();

// Auth routes - /api/auth/*
router.use('/auth', authRoutes);

// User settings routes - /api/user/*
router.use('/user', userSettingsRoutes);

// Stock routes - /api/stocks/*
router.use('/stocks', stockRoutes);

// Watchlist routes - /api/watchlist/*
router.use('/watchlist', watchlistRoutes);

// News routes - /api/news/*
router.use('/news', newsRoutes);

// Analysis routes - /api/analysis/*
router.use('/analysis', analysisRoutes);

// Push notification routes - /api/push/*
router.use('/push', pushRoutes);

// Screener routes - /api/screener/*
router.use('/screener', screenerRoutes);

// Earnings calendar routes - /api/earnings/*
router.use('/earnings', earningsRoutes);

// Insider trading routes - /api/insider/*
router.use('/insider', insiderRoutes);

// Quant rating routes - /api/quant-rating/*
router.use('/quant-rating', quantRatingRoutes);

// Transcript routes - /api/transcripts/*
router.use('/transcripts', transcriptRoutes);

// Dividend routes - /api/dividends/*
router.use('/dividends', dividendRoutes);

// Portfolio routes - /api/portfolios/*
router.use('/portfolios', portfolioRoutes);

// Market routes - /api/market/*
router.use('/market', marketRoutes);

// Analyst rating routes - /api/analyst-ratings/*
router.use('/analyst-ratings', analystRatingRoutes);

// SEC filing routes - /api/sec-filings/*
router.use('/sec-filings', secFilingRoutes);

// Sector routes - /api/sectors/*
router.use('/sectors', sectorRoutes);

// AI assistant routes - /api/ai/*
router.use('/ai', aiAssistantRoutes);

// System status routes - /api/status/*
router.use('/status', statusRoutes);

export default router;
