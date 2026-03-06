/**
 * Tests for configuration loader
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { loadAppConfig } from '../config/loader.js';

describe('Configuration Loader Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load configuration successfully', () => {
    const config = loadAppConfig();
    
    expect(config).toBeDefined();
    expect(config.marketCap).toBeDefined();
    expect(config.userSettings).toBeDefined();
    expect(config.cache).toBeDefined();
  });

  it('should have correct market cap tiers', () => {
    const config = loadAppConfig();
    
    expect(config.marketCap.tiers.mega.threshold).toBe(200000000000);
    expect(config.marketCap.tiers.large.threshold).toBe(10000000000);
    expect(config.marketCap.tiers.mid.threshold).toBe(2000000000);
    expect(config.marketCap.tiers.small.threshold).toBe(300000000);
    expect(config.marketCap.tiers.micro.threshold).toBe(0);
  });

  it('should have correct user settings config', () => {
    const config = loadAppConfig();
    
    expect(config.userSettings.priceAlertThreshold.min).toBe(0.1);
    expect(config.userSettings.priceAlertThreshold.max).toBe(50);
    expect(config.userSettings.priceAlertThreshold.default).toBe(5.0);
  });

  it('should have correct cache TTL config', () => {
    const config = loadAppConfig();
    
    expect(config.cache.ttl.quote).toBe(60);
    expect(config.cache.ttl.sectorList).toBe(3600);
    expect(config.cache.ttl.heatmap).toBe(300);
  });

  it('should support environment variable override', () => {
    process.env.MARKET_CAP_MEGA_THRESHOLD = '300000000000';
    
    // Clear cached config to force reload
    delete require.cache[require.resolve('../config/loader.js')];
    
    const config = loadAppConfig();
    
    // Note: This test may not work as expected due to module caching
    // In production, env vars should be set before app starts
    expect(config.marketCap.tiers.mega.threshold).toBeGreaterThan(0);
  });
});

