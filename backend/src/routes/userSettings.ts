import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { userSettingsService, DEFAULT_USER_SETTINGS } from '../services/userSettingsService.js';
import { authenticate } from '../middleware/auth.js';
import { ValidationError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';

const router = Router();

// Validation schema for updating settings (all fields optional for partial updates)
const updateSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.enum(['zh', 'en']).optional(),
  timezone: z.string().min(1, '时区不能为空').optional(),
  pushEnabled: z.boolean().optional(),
  quietHoursStart: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, '免打扰开始时间格式无效，应为 HH:mm')
    .nullable()
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, '免打扰结束时间格式无效，应为 HH:mm')
    .nullable()
    .optional(),
  priceAlertThreshold: z
    .number()
    .min(0.1, '价格提醒阈值最小为 0.1%')
    .max(50, '价格提醒阈值最大为 50%')
    .optional(),
  investmentPreferences: z.array(z.string()).optional(),
});

/**
 * GET /api/user/settings
 * Get current user's settings
 * Implements Requirements 7.2, 6.5: Restore and apply user's personalized settings
 */
router.get(
  '/settings',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      // Get user settings
      let settings = await userSettingsService.getSettings(userId);

      // If settings don't exist, initialize with defaults
      if (!settings) {
        settings = await userSettingsService.updateSettings(userId, DEFAULT_USER_SETTINGS);
      }

      const response: ApiResponse = {
        success: true,
        data: settings,
        message: '获取设置成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/user/settings
 * Update current user's settings (partial update supported)
 * Implements Requirements 7.3, 6.5: Save settings changes to cloud in real-time
 */
router.put(
  '/settings',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      // Validate request body
      const validationResult = updateSettingsSchema.safeParse(req.body);

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

      const settingsToUpdate = validationResult.data;

      // Check if there are any fields to update
      if (Object.keys(settingsToUpdate).length === 0) {
        throw new ValidationError('请提供要更新的设置字段', {});
      }

      // Update settings
      const updatedSettings = await userSettingsService.updateSettings(userId, settingsToUpdate);

      const response: ApiResponse = {
        success: true,
        data: updatedSettings,
        message: '设置更新成功',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
