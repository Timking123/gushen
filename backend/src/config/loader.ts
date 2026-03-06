import fs from 'fs';
import path from 'path';

// Get directory path - works in both ESM and test environments
const getConfigDir = (): string => {
  // In production, config is relative to project root
  return path.join(process.cwd(), 'config');
};

export interface MarketCapTierConfig {
  threshold: number;
  label: string;
}

export interface AppConfig {
  marketCap: {
    tiers: Record<string, MarketCapTierConfig>;
  };
  userSettings: {
    priceAlertThreshold: {
      min: number;
      max: number;
      default: number;
    };
  };
  cache: {
    ttl: {
      quote: number;
      sectorList: number;
      heatmap: number;
    };
  };
}

let cachedConfig: AppConfig | null = null;

/**
 * Load application configuration from JSON file
 * Supports environment variable overrides (Requirement 9.3)
 * Uses reasonable defaults if config file is missing (Requirement 9.4)
 */
export function loadAppConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.join(getConfigDir(), 'app.config.json');
  
  let config: AppConfig;

  try {
    const configFile = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(configFile);
  } catch (error) {
    console.warn('Config file not found, using defaults');
    config = getDefaultConfig();
  }

  // Apply environment variable overrides (Requirement 9.3)
  if (process.env.MARKET_CAP_MEGA_THRESHOLD) {
    config.marketCap.tiers.mega.threshold = parseInt(process.env.MARKET_CAP_MEGA_THRESHOLD, 10);
  }
  if (process.env.CACHE_TTL_QUOTE) {
    config.cache.ttl.quote = parseInt(process.env.CACHE_TTL_QUOTE, 10);
  }

  // Validate configuration (Requirement 9.5)
  validateConfig(config);

  cachedConfig = config;
  return config;
}

/**
 * Get default configuration (Requirement 9.4)
 */
function getDefaultConfig(): AppConfig {
  return {
    marketCap: {
      tiers: {
        mega: { threshold: 200000000000, label: '超大盘 (>$200B)' },
        large: { threshold: 10000000000, label: '大盘 ($10B-$200B)' },
        mid: { threshold: 2000000000, label: '中盘 ($2B-$10B)' },
        small: { threshold: 300000000, label: '小盘 ($300M-$2B)' },
        micro: { threshold: 0, label: '微盘 (<$300M)' },
      },
    },
    userSettings: {
      priceAlertThreshold: {
        min: 0.1,
        max: 50,
        default: 5.0,
      },
    },
    cache: {
      ttl: {
        quote: 60,
        sectorList: 3600,
        heatmap: 300,
      },
    },
  };
}

/**
 * Validate configuration completeness and validity (Requirement 9.5)
 */
function validateConfig(config: AppConfig): void {
  if (!config.marketCap || !config.marketCap.tiers) {
    throw new Error('Invalid config: marketCap.tiers is required');
  }

  if (!config.userSettings || !config.userSettings.priceAlertThreshold) {
    throw new Error('Invalid config: userSettings.priceAlertThreshold is required');
  }

  if (!config.cache || !config.cache.ttl) {
    throw new Error('Invalid config: cache.ttl is required');
  }

  // Validate numeric values
  Object.values(config.marketCap.tiers).forEach((tier) => {
    if (typeof tier.threshold !== 'number' || tier.threshold < 0) {
      throw new Error(`Invalid market cap threshold: ${tier.threshold}`);
    }
  });
}

export const appConfig = loadAppConfig();

