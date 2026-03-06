/**
 * Property-Based Tests for Quiet Hours Logic
 * Feature: smart-stock-analyzer, Property 5: 免打扰时段属�?
 * 
 * **Validates: Requirements 2.6**
 * 
 * Property: For any user-defined quiet hours time range and push event,
 * pushes within the quiet hours period should be paused;
 * pushes outside the quiet hours period should be sent normally.
 */

import fc from 'fast-check';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PushService } from './pushService.js';
import { prisma } from '../lib/prisma.js';

describe('Property 5: 免打扰时段属性', () => {
  let pushService: PushService;
  let testUserId: string;

  beforeEach(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        passwordHash: 'test',
      },
    });
    testUserId = user.id;

    pushService = new PushService();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.userSettings.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  it('should block push during quiet hours (normal range)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Quiet hours: 22:00 - 08:00 (normal range, doesn't span midnight in this test)
          quietStart: fc.constantFrom('22:00', '23:00', '00:00'),
          quietEnd: fc.constantFrom('06:00', '07:00', '08:00'),
        }),
        async ({ quietStart, quietEnd }) => {
          // Create user settings with quiet hours
          await prisma.userSettings.upsert({
            where: { userId: testUserId },
            create: {
              userId: testUserId,
              pushEnabled: true,
              quietHoursStart: quietStart,
              quietHoursEnd: quietEnd,
            },
            update: {
              pushEnabled: true,
              quietHoursStart: quietStart,
              quietHoursEnd: quietEnd,
            },
          });

          // Mock current time to be within quiet hours
          const originalDate = Date;
          const mockDate = new Date('2024-01-01T23:30:00'); // 23:30 is within 22:00-08:00
          global.Date = class extends originalDate {
            constructor() {
              super();
              return mockDate;
            }
            static now() {
              return mockDate.getTime();
            }
          } as any;

          // Check if push is allowed
          const canPush = await pushService.canPushToUser(testUserId);

          // Restore Date
          global.Date = originalDate;

          // Property: During quiet hours, push should be blocked
          // Note: This test assumes 23:30 falls within the quiet hours range
          // For ranges like 22:00-08:00, 23:30 should be blocked
          if (quietStart <= '23:30' || '23:30' < quietEnd) {
            expect(canPush).toBe(false);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should allow push outside quiet hours', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Quiet hours: 22:00 - 08:00
          quietStart: fc.constant('22:00'),
          quietEnd: fc.constant('08:00'),
        }),
        async ({ quietStart, quietEnd }) => {
          // Create user settings with quiet hours
          await prisma.userSettings.upsert({
            where: { userId: testUserId },
            create: {
              userId: testUserId,
              pushEnabled: true,
              quietHoursStart: quietStart,
              quietHoursEnd: quietEnd,
            },
            update: {
              pushEnabled: true,
              quietHoursStart: quietStart,
              quietHoursEnd: quietEnd,
            },
          });

          // Mock current time to be OUTSIDE quiet hours
          const originalDate = Date;
          const mockDate = new Date('2024-01-01T14:00:00'); // 14:00 is outside 22:00-08:00
          global.Date = class extends originalDate {
            constructor() {
              super();
              return mockDate;
            }
            static now() {
              return mockDate.getTime();
            }
          } as any;

          // Check if push is allowed
          const canPush = await pushService.canPushToUser(testUserId);

          // Restore Date
          global.Date = originalDate;

          // Property: Outside quiet hours, push should be allowed
          expect(canPush).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should block push when pushEnabled is false', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          quietStart: fc.option(fc.constantFrom('22:00', '23:00'), { nil: null }),
          quietEnd: fc.option(fc.constantFrom('06:00', '08:00'), { nil: null }),
        }),
        async ({ quietStart, quietEnd }) => {
          // Create user settings with push disabled
          await prisma.userSettings.upsert({
            where: { userId: testUserId },
            create: {
              userId: testUserId,
              pushEnabled: false,
              quietHoursStart: quietStart,
              quietHoursEnd: quietEnd,
            },
            update: {
              pushEnabled: false,
              quietHoursStart: quietStart,
              quietHoursEnd: quietEnd,
            },
          });

          // Check if push is allowed
          const canPush = await pushService.canPushToUser(testUserId);

          // Property: When push is disabled, should always block
          expect(canPush).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle quiet hours spanning midnight correctly', async () => {
    // Test case: quiet hours from 22:00 to 08:00 (spans midnight)
    await prisma.userSettings.upsert({
      where: { userId: testUserId },
      create: {
        userId: testUserId,
        pushEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      },
      update: {
        pushEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      },
    });

    // Test times within quiet hours
    const timesInQuietHours = [
      new Date('2024-01-01T22:30:00'), // 22:30
      new Date('2024-01-01T23:59:00'), // 23:59
      new Date('2024-01-01T00:30:00'), // 00:30
      new Date('2024-01-01T07:30:00'), // 07:30
    ];

    const originalDate = Date;

    for (const mockDate of timesInQuietHours) {
      global.Date = class extends originalDate {
        constructor() {
          super();
          return mockDate;
        }
        static now() {
          return mockDate.getTime();
        }
      } as any;

      const canPush = await pushService.canPushToUser(testUserId);
      
      // Property: Times within quiet hours should be blocked
      expect(canPush).toBe(false);
    }

    // Test times outside quiet hours
    const timesOutsideQuietHours = [
      new Date('2024-01-01T09:00:00'), // 09:00
      new Date('2024-01-01T14:00:00'), // 14:00
      new Date('2024-01-01T21:00:00'), // 21:00
    ];

    for (const mockDate of timesOutsideQuietHours) {
      global.Date = class extends originalDate {
        constructor() {
          super();
          return mockDate;
        }
        static now() {
          return mockDate.getTime();
        }
      } as any;

      const canPush = await pushService.canPushToUser(testUserId);
      
      // Property: Times outside quiet hours should be allowed
      expect(canPush).toBe(true);
    }

    // Restore Date
    global.Date = originalDate;
  });

  it('should allow push when no quiet hours are set', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          // Create user settings without quiet hours
          await prisma.userSettings.upsert({
            where: { userId: testUserId },
            create: {
              userId: testUserId,
              pushEnabled: true,
              quietHoursStart: null,
              quietHoursEnd: null,
            },
            update: {
              pushEnabled: true,
              quietHoursStart: null,
              quietHoursEnd: null,
            },
          });

          // Check if push is allowed
          const canPush = await pushService.canPushToUser(testUserId);

          // Property: When no quiet hours are set, push should always be allowed
          expect(canPush).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });
});
