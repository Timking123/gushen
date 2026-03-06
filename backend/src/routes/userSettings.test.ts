import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';

// Mock dependencies before importing the router
jest.mock('../services/userSettingsService', () => ({
  userSettingsService: {
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
  },
  DEFAULT_USER_SETTINGS: {
    theme: 'system',
    language: 'zh',
    timezone: 'Asia/Shanghai',
    pushEnabled: true,
    quietHoursStart: null,
    quietHoursEnd: null,
    priceAlertThreshold: 5.0,
    investmentPreferences: [],
  },
}));

jest.mock('../middleware/auth', () => ({
  authenticate: jest.fn((req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    // Simulate authenticated user
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  }),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import request from 'supertest';
import express, { Express } from 'express';
import userSettingsRoutes from './userSettings.js';
import { userSettingsService, DEFAULT_USER_SETTINGS } from '../services/userSettingsService.js';
import { authenticate } from '../middleware/auth.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('User Settings Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/user', userSettingsRoutes);
    app.use(errorHandler);
    jest.clearAllMocks();
  });

  describe('GET /api/user/settings', () => {
    const mockSettings = {
      userId: 'test-user-id',
      theme: 'dark' as const,
      language: 'en' as const,
      timezone: 'America/New_York',
      pushEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      priceAlertThreshold: 3.5,
      investmentPreferences: ['tech', 'healthcare'],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    };

    it('should return user settings when they exist', async () => {
      (userSettingsService.getSettings as jest.Mock).mockResolvedValue(mockSettings);

      const response = await request(app)
        .get('/api/user/settings')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        userId: mockSettings.userId,
        theme: mockSettings.theme,
        language: mockSettings.language,
        timezone: mockSettings.timezone,
        pushEnabled: mockSettings.pushEnabled,
        quietHoursStart: mockSettings.quietHoursStart,
        quietHoursEnd: mockSettings.quietHoursEnd,
        priceAlertThreshold: mockSettings.priceAlertThreshold,
        investmentPreferences: mockSettings.investmentPreferences,
      });
      expect(response.body.message).toBe('获取设置成功');
    });

    it('should initialize default settings when they do not exist', async () => {
      const defaultSettingsResponse = {
        userId: 'test-user-id',
        ...DEFAULT_USER_SETTINGS,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (userSettingsService.getSettings as jest.Mock).mockResolvedValue(null);
      (userSettingsService.updateSettings as jest.Mock).mockResolvedValue(defaultSettingsResponse);

      const response = await request(app)
        .get('/api/user/settings')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(userSettingsService.updateSettings).toHaveBeenCalledWith(
        'test-user-id',
        DEFAULT_USER_SETTINGS
      );
      expect(response.body.data.theme).toBe('system');
      expect(response.body.data.language).toBe('zh');
    });

    it('should require authentication', async () => {
      // Override authenticate mock to simulate unauthenticated request
      const { UnauthorizedError } = await import('../middleware/errorHandler.js');
      (authenticate as jest.Mock).mockImplementationOnce((_req, _res, next) => {
        next(new UnauthorizedError('未提供认证令牌'));
      });

      const response = await request(app)
        .get('/api/user/settings');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/user/settings', () => {
    const mockUpdatedSettings = {
      userId: 'test-user-id',
      theme: 'dark' as const,
      language: 'en' as const,
      timezone: 'America/New_York',
      pushEnabled: false,
      quietHoursStart: '23:00',
      quietHoursEnd: '07:00',
      priceAlertThreshold: 10.0,
      investmentPreferences: ['tech'],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    };

    it('should update settings with valid partial data', async () => {
      (userSettingsService.updateSettings as jest.Mock).mockResolvedValue(mockUpdatedSettings);

      const response = await request(app)
        .put('/api/user/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({ theme: 'dark', language: 'en' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('设置更新成功');
      expect(userSettingsService.updateSettings).toHaveBeenCalledWith(
        'test-user-id',
        { theme: 'dark', language: 'en' }
      );
    });

    it('should update single field', async () => {
      (userSettingsService.updateSettings as jest.Mock).mockResolvedValue({
        ...mockUpdatedSettings,
        pushEnabled: false,
      });

      const response = await request(app)
        .put('/api/user/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({ pushEnabled: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(userSettingsService.updateSettings).toHaveBeenCalledWith(
        'test-user-id',
        { pushEnabled: false }
      );
    });

    it('should update all fields at once', async () => {
      const fullUpdate = {
        theme: 'light' as const,
        language: 'en' as const,
        timezone: 'Europe/London',
        pushEnabled: false,
        quietHoursStart: '21:00',
        quietHoursEnd: '06:00',
        priceAlertThreshold: 2.5,
        investmentPreferences: ['finance', 'energy'],
      };

      (userSettingsService.updateSettings as jest.Mock).mockResolvedValue({
        userId: 'test-user-id',
        ...fullUpdate,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .put('/api/user/settings')
        .set('Authorization', 'Bearer valid-token')
        .send(fullUpdate);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(userSettingsService.updateSettings).toHaveBeenCalledWith(
        'test-user-id',
        fullUpdate
      );
    });

    it('should reject invalid theme value', async () => {
      const response = await request(app)
        .put('/api/user/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({ theme: 'invalid-theme' });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should reject invalid language value', async () => {
      const response = await request(app)
        .put('/api/user/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({ language: 'fr' });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should reject invalid quiet hours format', async () => {
      const response = await request(app)
        .put('/api/user/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({ quietHoursStart: '25:00' });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should reject price alert threshold below minimum', async () => {
      const response = await request(app)
        .put('/api/user/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({ priceAlertThreshold: 0.05 });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should reject price alert threshold above maximum', async () => {
      const response = await request(app)
        .put('/api/user/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({ priceAlertThreshold: 100 });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should reject empty request body', async () => {
      const response = await request(app)
        .put('/api/user/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('should allow null quiet hours values', async () => {
      (userSettingsService.updateSettings as jest.Mock).mockResolvedValue({
        ...mockUpdatedSettings,
        quietHoursStart: null,
        quietHoursEnd: null,
      });

      const response = await request(app)
        .put('/api/user/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({ quietHoursStart: null, quietHoursEnd: null });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should accept valid quiet hours format', async () => {
      (userSettingsService.updateSettings as jest.Mock).mockResolvedValue({
        ...mockUpdatedSettings,
        quietHoursStart: '09:30',
        quietHoursEnd: '17:45',
      });

      const response = await request(app)
        .put('/api/user/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({ quietHoursStart: '09:30', quietHoursEnd: '17:45' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should require authentication', async () => {
      // Override authenticate mock to simulate unauthenticated request
      const { UnauthorizedError } = await import('../middleware/errorHandler.js');
      (authenticate as jest.Mock).mockImplementationOnce((_req, _res, next) => {
        next(new UnauthorizedError('未提供认证令牌'));
      });

      const response = await request(app)
        .put('/api/user/settings')
        .send({ theme: 'dark' });

      expect(response.status).toBe(401);
    });

    it('should handle service errors gracefully', async () => {
      (userSettingsService.updateSettings as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .put('/api/user/settings')
        .set('Authorization', 'Bearer valid-token')
        .send({ theme: 'dark' });

      expect(response.status).toBe(500);
    });
  });
});
