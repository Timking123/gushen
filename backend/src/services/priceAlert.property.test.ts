/**
 * Property-Based Tests for Price Alert System
 * Feature: smart-stock-analyzer, Property 4: 价格波动推送属�?
 * 
 * **Validates: Requirements 2.3**
 * 
 * Property: For any user-defined price threshold and stock price change,
 * when price change percentage exceeds threshold, a push should be triggered;
 * when it does not exceed threshold, no push should be triggered.
 */

import fc from 'fast-check';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PriceMonitorService } from './priceMonitorService.js';
import { PushService } from './pushService.js';
import { prisma } from '../lib/prisma.js';

describe('Property 4: 价格波动推送属性', () => {
  let priceMonitor: PriceMonitorService;
  let pushService: PushService;
  let testUserId: string;
  let pushedMessages: Array<{ userId: string; message: any }> = [];

  beforeEach(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        passwordHash: 'test',
      },
    });
    testUserId = user.id;

    // Create user settings
    await prisma.userSettings.create({
      data: {
        userId: testUserId,
        pushEnabled: true,
        priceAlertThreshold: 5.0,
      },
    });

    // Initialize services
    priceMonitor = new PriceMonitorService();
    pushService = new PushService();

    // Mock pushToUser to capture messages
    pushedMessages = [];
    pushService.pushToUser = async (userId: string, message: any) => {
      pushedMessages.push({ userId, message });
    };
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.priceAlert.deleteMany({ where: { userId: testUserId } });
    await prisma.userSettings.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  it('should trigger push when price change exceeds threshold', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          symbol: fc.constantFrom('AAPL', 'GOOGL', 'MSFT', 'TSLA'),
          threshold: fc.float({ min: 1, max: 20 }), // 1-20% threshold
          previousPrice: fc.float({ min: 50, max: 500 }),
        }),
        async ({ symbol, threshold, previousPrice }) => {
          // Reset pushed messages
          pushedMessages = [];

          // Create price alert with change_percent condition
          const alert = await prisma.priceAlert.create({
            data: {
              userId: testUserId,
              symbol,
              condition: 'change_percent',
              targetValue: threshold,
              triggered: false,
            },
          });

          // Calculate a price change that EXCEEDS the threshold
          const changePercent = threshold + fc.sample(fc.float({ min: 0.1, max: 5 }), 1)[0];
          const currentPrice = previousPrice * (1 + changePercent / 100);

          // Create stock quote with current price
          await prisma.stockQuote.create({
            data: {
              symbol,
              price: currentPrice,
              change: currentPrice - previousPrice,
              changePercent: ((currentPrice - previousPrice) / previousPrice) * 100,
              volume: 1000000,
              high: currentPrice,
              low: previousPrice,
              open: previousPrice,
              previousClose: previousPrice,
              timestamp: new Date(),
            },
          });

          // Check if alert should trigger
          const shouldTrigger = (priceMonitor as any).shouldTriggerAlert(
            {
              condition: 'change_percent',
              targetValue: threshold,
              user: { settings: { priceAlertThreshold: 5.0 } },
            },
            {
              price: currentPrice,
              previousClose: previousPrice,
              change: currentPrice - previousPrice,
              changePercent: ((currentPrice - previousPrice) / previousPrice) * 100,
            },
            previousPrice
          );

          // Property: When change exceeds threshold, should trigger
          expect(shouldTrigger).toBe(true);

          // Clean up
          await prisma.priceAlert.delete({ where: { id: alert.id } });
          await prisma.stockQuote.deleteMany({ where: { symbol } });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should NOT trigger push when price change is below threshold', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          symbol: fc.constantFrom('AAPL', 'GOOGL', 'MSFT', 'TSLA'),
          threshold: fc.float({ min: 5, max: 20 }), // 5-20% threshold
          previousPrice: fc.float({ min: 50, max: 500 }),
        }),
        async ({ symbol, threshold, previousPrice }) => {
          // Reset pushed messages
          pushedMessages = [];

          // Create price alert with change_percent condition
          const alert = await prisma.priceAlert.create({
            data: {
              userId: testUserId,
              symbol,
              condition: 'change_percent',
              targetValue: threshold,
              triggered: false,
            },
          });

          // Calculate a price change that is BELOW the threshold
          const changePercent = fc.sample(fc.float({ min: 0.1, max: threshold - 0.1 }), 1)[0];
          const currentPrice = previousPrice * (1 + changePercent / 100);

          // Create stock quote with current price
          await prisma.stockQuote.create({
            data: {
              symbol,
              price: currentPrice,
              change: currentPrice - previousPrice,
              changePercent: ((currentPrice - previousPrice) / previousPrice) * 100,
              volume: 1000000,
              high: currentPrice,
              low: previousPrice,
              open: previousPrice,
              previousClose: previousPrice,
              timestamp: new Date(),
            },
          });

          // Check if alert should trigger
          const shouldTrigger = (priceMonitor as any).shouldTriggerAlert(
            {
              condition: 'change_percent',
              targetValue: threshold,
              user: { settings: { priceAlertThreshold: 5.0 } },
            },
            {
              price: currentPrice,
              previousClose: previousPrice,
              change: currentPrice - previousPrice,
              changePercent: ((currentPrice - previousPrice) / previousPrice) * 100,
            },
            previousPrice
          );

          // Property: When change is below threshold, should NOT trigger
          expect(shouldTrigger).toBe(false);

          // Clean up
          await prisma.priceAlert.delete({ where: { id: alert.id } });
          await prisma.stockQuote.deleteMany({ where: { symbol } });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should trigger push when price goes above target', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          symbol: fc.constantFrom('AAPL', 'GOOGL', 'MSFT', 'TSLA'),
          targetPrice: fc.float({ min: 100, max: 500 }),
        }),
        async ({ symbol, targetPrice }) => {
          // Reset pushed messages
          pushedMessages = [];

          // Create price alert with 'above' condition
          const alert = await prisma.priceAlert.create({
            data: {
              userId: testUserId,
              symbol,
              condition: 'above',
              targetValue: targetPrice,
              triggered: false,
            },
          });

          // Current price is above target
          const currentPrice = targetPrice + fc.sample(fc.float({ min: 0.01, max: 50 }), 1)[0];

          // Check if alert should trigger
          const shouldTrigger = (priceMonitor as any).shouldTriggerAlert(
            {
              condition: 'above',
              targetValue: targetPrice,
              user: { settings: { priceAlertThreshold: 5.0 } },
            },
            {
              price: currentPrice,
              previousClose: targetPrice - 10,
              change: 10,
              changePercent: 10,
            },
            null
          );

          // Property: When price is above target, should trigger
          expect(shouldTrigger).toBe(true);

          // Clean up
          await prisma.priceAlert.delete({ where: { id: alert.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should trigger push when price goes below target', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          symbol: fc.constantFrom('AAPL', 'GOOGL', 'MSFT', 'TSLA'),
          targetPrice: fc.float({ min: 100, max: 500 }),
        }),
        async ({ symbol, targetPrice }) => {
          // Reset pushed messages
          pushedMessages = [];

          // Create price alert with 'below' condition
          const alert = await prisma.priceAlert.create({
            data: {
              userId: testUserId,
              symbol,
              condition: 'below',
              targetValue: targetPrice,
              triggered: false,
            },
          });

          // Current price is below target
          const currentPrice = targetPrice - fc.sample(fc.float({ min: 0.01, max: 50 }), 1)[0];

          // Check if alert should trigger
          const shouldTrigger = (priceMonitor as any).shouldTriggerAlert(
            {
              condition: 'below',
              targetValue: targetPrice,
              user: { settings: { priceAlertThreshold: 5.0 } },
            },
            {
              price: currentPrice,
              previousClose: targetPrice + 10,
              change: -10,
              changePercent: -10,
            },
            null
          );

          // Property: When price is below target, should trigger
          expect(shouldTrigger).toBe(true);

          // Clean up
          await prisma.priceAlert.delete({ where: { id: alert.id } });
        }
      ),
      { numRuns: 50 }
    );
  });
});
