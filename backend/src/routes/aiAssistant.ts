import { Router, Response, NextFunction } from 'express';
import { aiAssistantService } from '../services/aiAssistantService.js';
import { authenticate } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/ai/chat
 * 发送消息给AI助手
 */
router.post(
  '/chat',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: '请提供消息内容' });
        return;
      }

      if (message.length > 1000) {
        res.status(400).json({ error: '消息长度不能超过1000字符' });
        return;
      }

      const response = await aiAssistantService.processMessage(userId, message);
      res.json({ response });
    } catch (error) {
      logger.error('AI聊天失败:', error);
      next(error);
    }
  }
);

/**
 * GET /api/ai/history
 * 获取对话历史
 */
router.get(
  '/history',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const history = await aiAssistantService.getConversationHistory(userId);
      res.json({ history });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/ai/history
 * 清除对话历史
 */
router.delete(
  '/history',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      await aiAssistantService.clearConversationHistory(userId);
      res.json({ success: true, message: '对话历史已清除' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/ai/suggestions
 * 获取个性化建议
 */
router.get(
  '/suggestions',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const suggestions = await aiAssistantService.getPersonalizedSuggestions(userId);
      res.json({ suggestions });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/ai/parse-intent
 * 解析用户意图（用于调试）
 */
router.post(
  '/parse-intent',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: '请提供消息内容' });
        return;
      }

      const intent = aiAssistantService.parseIntent(message);
      res.json({ intent });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
