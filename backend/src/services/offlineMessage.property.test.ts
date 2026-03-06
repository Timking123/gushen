/**
 * Property-Based Tests for Offline Message Caching
 * Feature: smart-stock-analyzer, Property 6: 离线消息缓存属�?
 * 
 * **Validates: Requirements 2.5**
 * 
 * Property: For any user offline period and generated push messages,
 * when user comes online, they should receive all cached messages
 * with complete content.
 */

import fc from 'fast-check';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PushService, PushMessage } from './pushService.js';
import { prisma } from '../lib/prisma.js';

describe('Property 6: 离线消息缓存属性', () => {
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

    // Create user settings
    await prisma.userSettings.create({
      data: {
        userId: testUserId,
        pushEnabled: true,
      },
    });

    pushService = new PushService();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.offlineMessage.deleteMany({ where: { userId: testUserId } });
    await prisma.alert.deleteMany({ where: { userId: testUserId } });
    await prisma.userSettings.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  it('should cache all messages for offline user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constantFrom('price', 'news', 'earnings', 'dividend', 'insider', 'rating'),
            symbol: fc.constantFrom('AAPL', 'GOOGL', 'MSFT', 'TSLA'),
            title: fc.string({ minLength: 5, maxLength: 50 }),
            message: fc.string({ minLength: 10, maxLength: 200 }),
            priority: fc.constantFrom('high', 'medium', 'low'),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (messages) => {
          // Cache all messages
          for (const msg of messages) {
            const pushMessage: PushMessage = {
              type: msg.type as any,
              symbol: msg.symbol,
              title: msg.title,
              message: msg.message,
              priority: msg.priority as any,
            };
            await pushService.cacheOfflineMessage(testUserId, pushMessage);
          }

          // Retrieve cached messages
          const cachedMessages = await prisma.offlineMessage.findMany({
            where: { userId: testUserId },
            orderBy: { createdAt: 'asc' },
          });

          // Property: All messages should be cached
          expect(cachedMessages.length).toBe(messages.length);

          // Property: Message content should be complete
          for (let i = 0; i < messages.length; i++) {
            const cached = cachedMessages[i];
            const original = messages[i];
            const payload = cached.payload as any;

            expect(cached.type).toBe(original.type);
            expect(cached.priority).toBe(original.priority);
            expect(payload.symbol).toBe(original.symbol);
            expect(payload.title).toBe(original.title);
            expect(payload.message).toBe(original.message);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should deliver all cached messages when user comes online', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constantFrom('price', 'news'),
            symbol: fc.constantFrom('AAPL', 'GOOGL'),
            title: fc.string({ minLength: 5, maxLength: 30 }),
            message: fc.string({ minLength: 10, maxLength: 100 }),
            priority: fc.constantFrom('high', 'medium'),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (messages) => {
          // Cache messages for offline user
          for (const msg of messages) {
            const pushMessage: PushMessage = {
              type: msg.type as any,
              symbol: msg.symbol,
              title: msg.title,
              message: msg.message,
              priority: msg.priority as any,
            };
            await pushService.cacheOfflineMessage(testUserId, pushMessage);
          }

          // Verify messages are cached
          const cachedBefore = await prisma.offlineMessage.findMany({
            where: { userId: testUserId },
          });
          expect(cachedBefore.length).toBe(messages.length);

          // Mock emitToUser to capture delivered messages
          const deliveredMessages: any[] = [];
          const originalEmit = (await import('../lib/socket.js')).emitToUser;
          const mockEmit = (userId: string, event: string, data: any) => {
            deliveredMessages.push({ userId, event, data });
          };
          
          // Replace emitToUser temporarily
          const socketModule = await import('../lib/socket.js');
          (socketModule as any).emitToUser = mockEmit;

          // Deliver cached messages
          await pushService.deliverCachedMessages(testUserId);

          // Restore original emitToUser
          (socketModule as any).emitToUser = originalEmit;

          // Property: All messages should be delivered
          expect(deliveredMessages.length).toBe(messages.length);

          // Property: Cached messages should be cleared after delivery
          const cachedAfter = await prisma.offlineMessage.findMany({
            where: { userId: testUserId },
          });
          expect(cachedAfter.length).toBe(0);
        }
      ),
      { numRuns: 15 }
    );
  });

  it('should preserve message order when delivering cached messages', async () => {
    // Create messages with specific order
    const messages: PushMessage[] = [
      {
        type: 'price',
        symbol: 'AAPL',
        title: 'Message 1',
        message: 'First message',
        priority: 'high',
      },
      {
        type: 'news',
        symbol: 'GOOGL',
        title: 'Message 2',
        message: 'Second message',
        priority: 'medium',
      },
      {
        type: 'earnings',
        symbol: 'MSFT',
        title: 'Message 3',
        message: 'Third message',
        priority: 'low',
      },
    ];

    // Cache messages in order
    for (const msg of messages) {
      await pushService.cacheOfflineMessage(testUserId, msg);
      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Retrieve cached messages
    const cachedMessages = await prisma.offlineMessage.findMany({
      where: { userId: testUserId },
      orderBy: { createdAt: 'asc' },
    });

    // Property: Messages should be in the same order
    expect(cachedMessages.length).toBe(3);
    expect((cachedMessages[0].payload as any).title).toBe('Message 1');
    expect((cachedMessages[1].payload as any).title).toBe('Message 2');
    expect((cachedMessages[2].payload as any).title).toBe('Message 3');
  });

  it('should not deliver messages if user is in quiet hours', async () => {
    // Set quiet hours to current time
    const now = new Date();
    const currentHour = now.getHours().toString().padStart(2, '0');
    const currentMinute = now.getMinutes().toString().padStart(2, '0');
    const quietStart = `${currentHour}:${currentMinute}`;
    
    // End quiet hours 2 hours later
    const endHour = ((now.getHours() + 2) % 24).toString().padStart(2, '0');
    const quietEnd = `${endHour}:${currentMinute}`;

    await prisma.userSettings.update({
      where: { userId: testUserId },
      data: {
        quietHoursStart: quietStart,
        quietHoursEnd: quietEnd,
      },
    });

    // Cache a message
    const message: PushMessage = {
      type: 'price',
      symbol: 'AAPL',
      title: 'Test Message',
      message: 'Test content',
      priority: 'high',
    };
    await pushService.cacheOfflineMessage(testUserId, message);

    // Try to deliver cached messages
    await pushService.deliverCachedMessages(testUserId);

    // Property: Messages should NOT be delivered during quiet hours
    const cachedAfter = await prisma.offlineMessage.findMany({
      where: { userId: testUserId },
    });
    expect(cachedAfter.length).toBe(1); // Message should still be cached
  });

  it('should handle empty cache gracefully', async () => {
    // Try to deliver messages when cache is empty
    await expect(pushService.deliverCachedMessages(testUserId)).resolves.not.toThrow();

    // Verify no errors occurred
    const cachedMessages = await prisma.offlineMessage.findMany({
      where: { userId: testUserId },
    });
    expect(cachedMessages.length).toBe(0);
  });
});
