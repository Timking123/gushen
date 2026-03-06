import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { transcriptService, TranscriptEventType, TranscriptFilters } from '../services/transcriptService.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { ApiResponse } from '../types/index.js';

const router = Router();

// Valid event types
const validEventTypes: TranscriptEventType[] = ['earnings', 'investor_day', 'conference'];

// Validation schemas using Zod
const symbolParamSchema = z.object({
  symbol: z
    .string()
    .min(1, '股票代码不能为空')
    .max(20, '股票代码过长')
    .regex(/^[A-Za-z0-9.]+$/, '股票代码格式无效'),
});

const transcriptIdParamSchema = z.object({
  id: z
    .string()
    .uuid('会议记录ID格式无效'),
});

const listQuerySchema = z.object({
  symbol: z
    .string()
    .optional()
    .transform((val) => (val ? val.trim().toUpperCase() : undefined)),
  symbols: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map(s => s.trim().toUpperCase()) : undefined)),
  eventTypes: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const types = val.split(',').map(t => t.trim().toLowerCase()) as TranscriptEventType[];
      return types.filter(t => validEventTypes.includes(t));
    }),
  startDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .refine((val) => !val || !isNaN(val.getTime()), {
      message: '开始日期格式无效',
    }),
  endDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .refine((val) => !val || !isNaN(val.getTime()), {
      message: '结束日期格式无效',
    }),
  quarter: z
    .string()
    .optional()
    .refine((val) => !val || val === '' || /^Q[1-4]\s+\d{4}$/.test(val), {
      message: '季度格式无效，应为 Q1 2024 格式',
    }),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => !isNaN(val) && val > 0, {
      message: '页码必须是正整数',
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => !isNaN(val) && val > 0 && val <= 100, {
      message: '每页数量必须在1-100之间',
    }),
});

const searchQuerySchema = z.object({
  keyword: z
    .string()
    .min(1, '搜索关键词不能为空')
    .max(100, '搜索关键词过长'),
  symbol: z
    .string()
    .optional()
    .transform((val) => (val ? val.trim().toUpperCase() : undefined)),
  symbols: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map(s => s.trim().toUpperCase()) : undefined)),
  eventTypes: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const types = val.split(',').map(t => t.trim().toLowerCase()) as TranscriptEventType[];
      return types.filter(t => validEventTypes.includes(t));
    }),
  startDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .refine((val) => !val || !isNaN(val.getTime()), {
      message: '开始日期格式无效',
    }),
  endDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .refine((val) => !val || !isNaN(val.getTime()), {
      message: '结束日期格式无效',
    }),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => !isNaN(val) && val > 0, {
      message: '页码必须是正整数',
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => !isNaN(val) && val > 0 && val <= 50, {
      message: '每页数量必须在1-50之间',
    }),
});

const symbolLimitQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .refine((val) => !isNaN(val) && val > 0 && val <= 50, {
      message: '数量必须在1-50之间',
    }),
});

const recentQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine((val) => !isNaN(val) && val > 0 && val <= 100, {
      message: '数量必须在1-100之间',
    }),
});

/**
 * GET /api/transcripts
 * Get transcripts with optional filters
 * 
 * Implements Requirement 14.1: Provide access to earnings call transcripts
 * 
 * Query Parameters:
 * - symbol: Single stock symbol filter
 * - symbols: Comma-separated list of stock symbols
 * - eventTypes: Comma-separated list of event types (earnings, investor_day, conference)
 * - startDate: Start date for filtering (ISO format)
 * - endDate: End date for filtering (ISO format)
 * - quarter: Quarter filter (e.g., "Q1 2024")
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query parameters
      const validationResult = listQuerySchema.safeParse(req.query);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('查询参数验证失败', errors);
      }

      const {
        symbol,
        symbols,
        eventTypes,
        startDate,
        endDate,
        quarter,
        page,
        limit,
      } = validationResult.data;

      // Build filters with proper typing
      const filters: TranscriptFilters = {
        symbol: symbol as string | undefined,
        symbols: symbols as string[] | undefined,
        eventTypes: eventTypes as TranscriptEventType[] | undefined,
        startDate: startDate as Date | undefined,
        endDate: endDate as Date | undefined,
        quarter: (quarter && quarter !== '') ? quarter : undefined,
      };

      // Get transcripts
      const result = await transcriptService.getTranscripts(
        filters,
        { page, limit }
      );

      const response: ApiResponse = {
        success: true,
        data: result,
        message: result.transcripts.length > 0 ? '获取会议记录列表成功' : '暂无会议记录',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/transcripts/search
 * Search transcripts by keyword
 * 
 * Implements Requirement 14.3: Support keyword search in transcript content
 * 
 * Query Parameters:
 * - keyword: Search keyword (required)
 * - symbol: Single stock symbol filter
 * - symbols: Comma-separated list of stock symbols
 * - eventTypes: Comma-separated list of event types
 * - startDate: Start date for filtering (ISO format)
 * - endDate: End date for filtering (ISO format)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 50)
 */
router.get(
  '/search',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query parameters
      const validationResult = searchQuerySchema.safeParse(req.query);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('查询参数验证失败', errors);
      }

      const {
        keyword,
        symbol,
        symbols,
        eventTypes,
        startDate,
        endDate,
        page,
        limit,
      } = validationResult.data;

      // Build filters with proper typing
      const filters: TranscriptFilters = {
        symbol: symbol as string | undefined,
        symbols: symbols as string[] | undefined,
        eventTypes: eventTypes as TranscriptEventType[] | undefined,
        startDate: startDate as Date | undefined,
        endDate: endDate as Date | undefined,
      };

      // Search transcripts
      const result = await transcriptService.searchTranscripts(
        keyword,
        filters,
        { page, limit }
      );

      const response: ApiResponse = {
        success: true,
        data: result,
        message: result.results.length > 0 
          ? `找到 ${result.pagination.total} 条包含 "${keyword}" 的会议记录` 
          : `未找到包含 "${keyword}" 的会议记录`,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/transcripts/recent
 * Get recent transcripts across all stocks
 * 
 * Query Parameters:
 * - limit: Maximum number of transcripts (default: 20, max: 100)
 */
router.get(
  '/recent',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query parameters
      const validationResult = recentQuerySchema.safeParse(req.query);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('查询参数验证失败', errors);
      }

      const { limit } = validationResult.data;

      // Get recent transcripts
      const transcripts = await transcriptService.getRecentTranscripts(limit);

      const response: ApiResponse = {
        success: true,
        data: {
          count: transcripts.length,
          transcripts,
        },
        message: transcripts.length > 0 ? '获取最近会议记录成功' : '暂无会议记录',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/transcripts/stock/:symbol
 * Get transcripts for a specific stock
 * 
 * Implements Requirement 14.1: Display recent earnings call transcript list
 * 
 * Path Parameters:
 * - symbol: Stock symbol
 * 
 * Query Parameters:
 * - limit: Maximum number of transcripts (default: 10, max: 50)
 */
router.get(
  '/stock/:symbol',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate path parameter
      const symbolValidation = symbolParamSchema.safeParse(req.params);

      if (!symbolValidation.success) {
        const errors: Record<string, string[]> = {};
        symbolValidation.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('股票代码验证失败', errors);
      }

      // Validate query parameters
      const queryValidation = symbolLimitQuerySchema.safeParse(req.query);

      if (!queryValidation.success) {
        const errors: Record<string, string[]> = {};
        queryValidation.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('查询参数验证失败', errors);
      }

      const { symbol } = symbolValidation.data;
      const { limit } = queryValidation.data;

      // Get transcripts for the stock
      const transcripts = await transcriptService.getTranscriptsBySymbol(symbol, limit);

      const response: ApiResponse = {
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          count: transcripts.length,
          transcripts,
        },
        message: transcripts.length > 0 ? '获取股票会议记录成功' : '该股票暂无会议记录',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/transcripts/stock/:symbol/latest
 * Get the latest transcript for a specific stock
 * 
 * Path Parameters:
 * - symbol: Stock symbol
 */
router.get(
  '/stock/:symbol/latest',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate path parameter
      const symbolValidation = symbolParamSchema.safeParse(req.params);

      if (!symbolValidation.success) {
        const errors: Record<string, string[]> = {};
        symbolValidation.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('股票代码验证失败', errors);
      }

      const { symbol } = symbolValidation.data;

      // Get latest transcript for the stock
      const transcript = await transcriptService.getLatestTranscript(symbol);

      if (!transcript) {
        throw new NotFoundError('该股票暂无会议记录');
      }

      const response: ApiResponse = {
        success: true,
        data: transcript,
        message: '获取最新会议记录成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/transcripts/:id
 * Get a single transcript by ID with full content
 * 
 * Implements Requirement 14.2: Provide complete Q&A transcript
 * 
 * Path Parameters:
 * - id: Transcript ID (UUID)
 */
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate path parameter
      const validationResult = transcriptIdParamSchema.safeParse(req.params);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('会议记录ID验证失败', errors);
      }

      const { id } = validationResult.data;

      // Get transcript by ID
      const transcript = await transcriptService.getTranscriptById(id);

      if (!transcript) {
        throw new NotFoundError('未找到该会议记录');
      }

      const response: ApiResponse = {
        success: true,
        data: transcript,
        message: '获取会议记录详情成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/transcripts/:id/analysis
 * Get a transcript with AI analysis (summary and key statements)
 * 
 * Implements Requirements:
 * - 14.5: Provide AI-generated meeting summary with key points
 * - 14.6: Highlight key statements from management
 * 
 * Path Parameters:
 * - id: Transcript ID (UUID)
 */
router.get(
  '/:id/analysis',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate path parameter
      const validationResult = transcriptIdParamSchema.safeParse(req.params);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('会议记录ID验证失败', errors);
      }

      const { id } = validationResult.data;

      // Get transcript with AI analysis
      const transcriptWithAnalysis = await transcriptService.getTranscriptWithAnalysis(id);

      if (!transcriptWithAnalysis) {
        throw new NotFoundError('未找到该会议记录');
      }

      const response: ApiResponse = {
        success: true,
        data: transcriptWithAnalysis,
        message: '获取会议记录分析成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/transcripts/:id/summary
 * Generate AI summary for a transcript
 * 
 * Implements Requirement 14.5: Provide AI-generated meeting summary with key points
 * 
 * Path Parameters:
 * - id: Transcript ID (UUID)
 */
router.post(
  '/:id/summary',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate path parameter
      const validationResult = transcriptIdParamSchema.safeParse(req.params);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('会议记录ID验证失败', errors);
      }

      const { id } = validationResult.data;

      // Generate AI summary
      const summary = await transcriptService.generateAISummary(id);

      const response: ApiResponse = {
        success: true,
        data: summary,
        message: 'AI摘要生成成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/transcripts/:id/key-statements
 * Extract key statements from a transcript
 * 
 * Implements Requirement 14.6: Highlight key statements from management
 * 
 * Path Parameters:
 * - id: Transcript ID (UUID)
 */
router.get(
  '/:id/key-statements',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate path parameter
      const validationResult = transcriptIdParamSchema.safeParse(req.params);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('会议记录ID验证失败', errors);
      }

      const { id } = validationResult.data;

      // Extract key statements
      const keyStatements = await transcriptService.extractKeyStatements(id);

      const response: ApiResponse = {
        success: true,
        data: {
          transcriptId: id,
          keyStatements,
          count: keyStatements.length,
        },
        message: keyStatements.length > 0 ? '关键陈述提取成功' : '未找到关键陈述',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
