import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { userService } from '../services/userService.js';
import { ValidationError } from '../middleware/errorHandler.js';
import { ApiResponse } from '../types/index.js';

const router = Router();

// Validation schemas using Zod
const registerSchema = z.object({
  email: z
    .string()
    .email('请输入有效的邮箱地址')
    .max(255, '邮箱地址过长'),
  password: z
    .string()
    .min(8, '密码至少需要8个字符')
    .max(128, '密码过长')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      '密码必须包含大写字母、小写字母和数字'
    ),
});

const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码'),
});

/**
 * POST /api/auth/register
 * Register a new user account
 * Implements Requirement 7.1: Create user account and initialize default settings
 */
router.post(
  '/register',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request body
      const validationResult = registerSchema.safeParse(req.body);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('输入验证失败', errors);
      }

      const { email, password } = validationResult.data;

      // Register user
      const result = await userService.register(email, password);

      const response: ApiResponse = {
        success: true,
        data: result,
        message: '注册成功',
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/login
 * Authenticate user and return token
 * Implements Requirement 7.2: Restore user's watchlist, subscriptions, and preferences
 */
router.post(
  '/login',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request body
      const validationResult = loginSchema.safeParse(req.body);

      if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.errors.forEach((err) => {
          const field = err.path.join('.');
          if (!errors[field]) {
            errors[field] = [];
          }
          errors[field].push(err.message);
        });
        throw new ValidationError('输入验证失败', errors);
      }

      const { email, password } = validationResult.data;

      // Login user
      const result = await userService.login(email, password);

      const response: ApiResponse = {
        success: true,
        data: result,
        message: '登录成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
