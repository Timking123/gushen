/**
 * Property-Based Tests for User Settings Persistence
 *
 * **Feature: smart-stock-analyzer, Property 11: 用户设置持久化属�?*
 *
 * This test validates the round-trip property:
 * "For any user settings, saving and then reading should return the same settings values"
 *
 * **Validates: Requirements 7.2, 7.3**
 * - 7.2: WHEN 用户登录 THEN Stock_Analyzer SHALL 恢复用户的自选股列表、订阅和偏好设置
 * - 7.3: WHEN 用户修改设置 THEN Stock_Analyzer SHALL 实时保存更改到云�?
 */

import fc from 'fast-check';
import { UserSettingsService, UserSettingsInput } from './userSettingsService.js';
import { prisma } from '../lib/prisma.js';

// Mock Prisma
jest.mock('../lib/prisma', () => ({
  prisma: {
    userSettings: {
      findUnique: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

describe('User Settings Persistence Property Tests', () => {
  let userSettingsService: UserSettingsService;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    userSettingsService = new UserSettingsService();
    jest.clearAllMocks();
  });

  /**
   * **Feature: smart-stock-analyzer, Property 11: 用户设置持久化属�?*
   *
   * Round-trip property: For any valid user settings,
   * saving and then reading should return the exact same values.
   *
   * **Validates: Requirements 7.2, 7.3**
   */
  describe('Property 11: User Settings Round-Trip Persistence', () => {
    // Arbitrary for generating valid theme values
    const themeArbitrary = fc.constantFrom('light', 'dark', 'system') as fc.Arbitrary<
      'light' | 'dark' | 'system'
    >;

    // Arbitrary for generating valid language values
    const languageArbitrary = fc.constantFrom('zh', 'en') as fc.Arbitrary<'zh' | 'en'>;

    // Arbitrary for generating valid timezone strings
    const timezoneArbitrary = fc.constantFrom(
      'Asia/Shanghai',
      'America/New_York',
      'Europe/London',
      'Asia/Tokyo',
      'UTC'
    );

    // Arbitrary for generating valid quiet hours (HH:mm format or null)
    const quietHoursArbitrary = fc.option(
      fc.tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 })).map(
        ([hour, minute]) =>
          `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      ),
      { nil: null }
    );

    // Arbitrary for generating valid price alert threshold (0.1% to 50%)
    // Use Math.fround to ensure 32-bit float compatibility
    const priceAlertThresholdArbitrary = fc.float({
      min: Math.fround(0.1),
      max: Math.fround(50),
      noNaN: true,
    });

    // Arbitrary for generating investment preferences (array of strings)
    const investmentPreferencesArbitrary = fc.array(
      fc.constantFrom(
        '价值投资',
        '成长股',
        '股息收入',
        '技术分析',
        '短线交易',
        '长期持有',
        '科技股',
        '医疗健康',
        '金融',
        '能源'
      ),
      { minLength: 0, maxLength: 5 }
    );

    // Complete UserSettings arbitrary
    const userSettingsArbitrary: fc.Arbitrary<UserSettingsInput> = fc.record({
      theme: themeArbitrary,
      language: languageArbitrary,
      timezone: timezoneArbitrary,
      pushEnabled: fc.boolean(),
      quietHoursStart: quietHoursArbitrary,
      quietHoursEnd: quietHoursArbitrary,
      priceAlertThreshold: priceAlertThresholdArbitrary,
      investmentPreferences: investmentPreferencesArbitrary,
    });

    it('should preserve all settings after save and load (round-trip)', async () => {
      await fc.assert(
        fc.asyncProperty(userSettingsArbitrary, async (settings) => {
          // Setup: Mock the database to store and return the settings
          let storedSettings: UserSettingsInput | null = null;

          (prisma.userSettings.upsert as jest.Mock).mockImplementation(
            async ({ create, update }) => {
              // Simulate database storage - use update data if exists, otherwise create
              storedSettings = update || create;
              return {
                id: 'settings-123',
                userId: testUserId,
                ...storedSettings,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
            }
          );

          (prisma.userSettings.findUnique as jest.Mock).mockImplementation(async () => {
            if (!storedSettings) return null;
            return {
              id: 'settings-123',
              userId: testUserId,
              ...storedSettings,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          });

          // Act: Save settings
          await userSettingsService.updateSettings(testUserId, settings);

          // Act: Load settings
          const loadedSettings = await userSettingsService.getSettings(testUserId);

          // Assert: Loaded settings should match saved settings
          expect(loadedSettings).not.toBeNull();
          expect(loadedSettings!.theme).toBe(settings.theme);
          expect(loadedSettings!.language).toBe(settings.language);
          expect(loadedSettings!.timezone).toBe(settings.timezone);
          expect(loadedSettings!.pushEnabled).toBe(settings.pushEnabled);
          expect(loadedSettings!.quietHoursStart).toBe(settings.quietHoursStart);
          expect(loadedSettings!.quietHoursEnd).toBe(settings.quietHoursEnd);
          // Use toBeCloseTo for floating point comparison
          expect(loadedSettings!.priceAlertThreshold).toBeCloseTo(
            settings.priceAlertThreshold,
            5
          );
          expect(loadedSettings!.investmentPreferences).toEqual(
            settings.investmentPreferences
          );

          return true;
        }),
        { numRuns: 20 }
      );
    });

    it('should preserve partial settings updates (round-trip)', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate partial settings (at least one field)
          fc.record(
            {
              theme: themeArbitrary,
              language: languageArbitrary,
              timezone: timezoneArbitrary,
              pushEnabled: fc.boolean(),
              quietHoursStart: quietHoursArbitrary,
              quietHoursEnd: quietHoursArbitrary,
              priceAlertThreshold: priceAlertThresholdArbitrary,
              investmentPreferences: investmentPreferencesArbitrary,
            },
            { requiredKeys: [] }
          ),
          async (partialSettings) => {
            // Skip empty updates
            if (Object.keys(partialSettings).length === 0) {
              return true;
            }

            // Setup: Initial settings in database
            const initialSettings: UserSettingsInput = {
              theme: 'system',
              language: 'zh',
              timezone: 'Asia/Shanghai',
              pushEnabled: true,
              quietHoursStart: null,
              quietHoursEnd: null,
              priceAlertThreshold: 5.0,
              investmentPreferences: [],
            };

            let storedSettings = { ...initialSettings };

            (prisma.userSettings.upsert as jest.Mock).mockImplementation(
              async ({ update }) => {
                // Merge partial update with existing settings
                storedSettings = { ...storedSettings, ...update };
                return {
                  id: 'settings-123',
                  userId: testUserId,
                  ...storedSettings,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };
              }
            );

            (prisma.userSettings.findUnique as jest.Mock).mockImplementation(async () => ({
              id: 'settings-123',
              userId: testUserId,
              ...storedSettings,
              createdAt: new Date(),
              updatedAt: new Date(),
            }));

            // Act: Update with partial settings
            await userSettingsService.updateSettings(testUserId, partialSettings);

            // Act: Load settings
            const loadedSettings = await userSettingsService.getSettings(testUserId);

            // Assert: Updated fields should match, others should remain unchanged
            expect(loadedSettings).not.toBeNull();

            // Check each field that was updated
            for (const [key, value] of Object.entries(partialSettings)) {
              if (key === 'priceAlertThreshold' && typeof value === 'number') {
                expect(loadedSettings![key as keyof UserSettingsInput]).toBeCloseTo(
                  value,
                  5
                );
              } else {
                expect(loadedSettings![key as keyof UserSettingsInput]).toEqual(value);
              }
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle edge cases for quiet hours format', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.integer({ min: 0, max: 23 }),
            fc.integer({ min: 0, max: 59 }),
            fc.integer({ min: 0, max: 23 }),
            fc.integer({ min: 0, max: 59 })
          ),
          async ([startHour, startMinute, endHour, endMinute]) => {
            const quietHoursStart = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
            const quietHoursEnd = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

            const settings: Partial<UserSettingsInput> = {
              quietHoursStart,
              quietHoursEnd,
            };

            let storedSettings: Partial<UserSettingsInput> = {};

            (prisma.userSettings.upsert as jest.Mock).mockImplementation(
              async ({ update }) => {
                storedSettings = { ...storedSettings, ...update };
                return {
                  id: 'settings-123',
                  userId: testUserId,
                  theme: 'system',
                  language: 'zh',
                  timezone: 'Asia/Shanghai',
                  pushEnabled: true,
                  priceAlertThreshold: 5.0,
                  investmentPreferences: [],
                  ...storedSettings,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };
              }
            );

            (prisma.userSettings.findUnique as jest.Mock).mockImplementation(async () => ({
              id: 'settings-123',
              userId: testUserId,
              theme: 'system',
              language: 'zh',
              timezone: 'Asia/Shanghai',
              pushEnabled: true,
              priceAlertThreshold: 5.0,
              investmentPreferences: [],
              ...storedSettings,
              createdAt: new Date(),
              updatedAt: new Date(),
            }));

            // Act
            await userSettingsService.updateSettings(testUserId, settings);
            const loadedSettings = await userSettingsService.getSettings(testUserId);

            // Assert: Quiet hours should be preserved exactly
            expect(loadedSettings!.quietHoursStart).toBe(quietHoursStart);
            expect(loadedSettings!.quietHoursEnd).toBe(quietHoursEnd);

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
