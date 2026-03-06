import { prisma } from '../lib/prisma.js';
import { logger } from '../utils/logger.js';
import { appConfig } from '../config/loader.js';

/**
 * Input type for user settings (without system fields)
 */
export interface UserSettingsInput {
  theme: 'light' | 'dark' | 'system';
  language: 'zh' | 'en';
  timezone: string;
  pushEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  priceAlertThreshold: number;
  investmentPreferences: string[];
}

/**
 * Full user settings response type (includes system fields)
 */
export interface UserSettingsResponse extends UserSettingsInput {
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Default user settings values
 */
export const DEFAULT_USER_SETTINGS: UserSettingsInput = {
  theme: 'system',
  language: 'zh',
  timezone: 'Asia/Shanghai',
  pushEnabled: true,
  quietHoursStart: null,
  quietHoursEnd: null,
  priceAlertThreshold: 5.0,
  investmentPreferences: [],
};

/**
 * UserSettingsService - Handles user preferences and settings management
 *
 * Implements:
 * - Requirements 7.2: Restore user preferences on login
 * - Requirements 7.3: Save settings changes to cloud in real-time
 * - Requirements 6.5: Save and apply user's personalized settings
 */
export class UserSettingsService {
  /**
   * Get user settings by user ID
   * Restores user's preferences (Requirement 7.2)
   *
   * @param userId - User's unique identifier
   * @returns User settings or null if not found
   */
  async getSettings(userId: string): Promise<UserSettingsResponse | null> {
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      logger.warn(`Settings not found for user: ${userId}`);
      return null;
    }

    return {
      userId: settings.userId,
      theme: settings.theme as 'light' | 'dark' | 'system',
      language: settings.language as 'zh' | 'en',
      timezone: settings.timezone,
      pushEnabled: settings.pushEnabled,
      quietHoursStart: settings.quietHoursStart,
      quietHoursEnd: settings.quietHoursEnd,
      priceAlertThreshold: settings.priceAlertThreshold,
      investmentPreferences: settings.investmentPreferences,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  /**
   * Update user settings
   * Saves changes to cloud in real-time (Requirement 7.3)
   *
   * @param userId - User's unique identifier
   * @param settings - Partial settings to update
   * @returns Updated user settings
   */
  async updateSettings(
    userId: string,
    settings: Partial<UserSettingsInput>
  ): Promise<UserSettingsResponse> {
    // Validate quiet hours format if provided
    if (settings.quietHoursStart !== undefined && settings.quietHoursStart !== null) {
      this.validateQuietHoursFormat(settings.quietHoursStart);
    }
    if (settings.quietHoursEnd !== undefined && settings.quietHoursEnd !== null) {
      this.validateQuietHoursFormat(settings.quietHoursEnd);
    }

    // Validate price alert threshold if provided (using config)
    if (settings.priceAlertThreshold !== undefined) {
      const { min, max } = appConfig.userSettings.priceAlertThreshold;
      if (settings.priceAlertThreshold < min || settings.priceAlertThreshold > max) {
        throw new Error(`Price alert threshold must be between ${min} and ${max}`);
      }
    }

    // Use upsert to handle both create and update cases
    const updatedSettings = await prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...DEFAULT_USER_SETTINGS,
        ...settings,
      },
      update: settings,
    });

    logger.info(`Settings updated for user: ${userId}`);

    return {
      userId: updatedSettings.userId,
      theme: updatedSettings.theme as 'light' | 'dark' | 'system',
      language: updatedSettings.language as 'zh' | 'en',
      timezone: updatedSettings.timezone,
      pushEnabled: updatedSettings.pushEnabled,
      quietHoursStart: updatedSettings.quietHoursStart,
      quietHoursEnd: updatedSettings.quietHoursEnd,
      priceAlertThreshold: updatedSettings.priceAlertThreshold,
      investmentPreferences: updatedSettings.investmentPreferences,
      createdAt: updatedSettings.createdAt,
      updatedAt: updatedSettings.updatedAt,
    };
  }

  /**
   * Validate quiet hours format (HH:mm)
   * @param time - Time string to validate
   * @throws Error if format is invalid
   */
  private validateQuietHoursFormat(time: string): void {
    const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!regex.test(time)) {
      throw new Error(`Invalid quiet hours format: ${time}. Expected HH:mm format.`);
    }
  }
}

// Export singleton instance
export const userSettingsService = new UserSettingsService();
