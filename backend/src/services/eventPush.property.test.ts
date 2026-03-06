/**
 * 事件触发推送属性测试
 * **Feature: smart-stock-analyzer, Property 16: 事件触发推送属性**
 * **Validates: Requirements 11.4, 12.3, 13.6, 14.4, 15.5, 19.3, 20.2**
 */

import * as fc from 'fast-check';
import { EventPushService, EventType, EventPriority, PushEvent } from './eventPushService';

describe('Event Push Property Tests', () => {
  const service = new EventPushService();

  // 生成有效的事件类型
  const eventTypeArb = fc.constantFrom<EventType>(
    'earnings',
    'dividend',
    'insider',
    'rating_change',
    'sec_filing',
    'price_alert',
    'technical_signal'
  );

  // 生成有效的优先级
  const priorityArb = fc.constantFrom<EventPriority>('high', 'medium', 'low');

  // 生成股票代码
  const symbolArb = fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), {
    minLength: 1,
    maxLength: 5,
  });

  // 生成推送事件
  const pushEventArb = fc.record({
    id: fc.uuid(),
    type: eventTypeArb,
    symbol: fc.option(symbolArb, { nil: undefined }),
    title: fc.string({ minLength: 1, maxLength: 100 }),
    message: fc.string({ minLength: 1, maxLength: 500 }),
    priority: priorityArb,
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
  }) as fc.Arbitrary<PushEvent>;

  /**
   * Property 16.1: 事件应按优先级正确排序
   * 高优先级事件应排在低优先级事件之前
   */
  test('Property 16.1: 事件应按优先级正确排序', () => {
    fc.assert(
      fc.property(
        fc.array(pushEventArb, { minLength: 2, maxLength: 20 }),
        (events) => {
          const sorted = service.sortEventsByPriority(events);

          // 验证排序结果
          for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i];
            const next = sorted[i + 1];

            const priorityOrder: Record<EventPriority, number> = {
              high: 3,
              medium: 2,
              low: 1,
            };

            // 当前事件的优先级应 >= 下一个事件
            expect(priorityOrder[current.priority]).toBeGreaterThanOrEqual(
              priorityOrder[next.priority]
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.2: 排序应保持事件数量不变
   */
  test('Property 16.2: 排序应保持事件数量不变', () => {
    fc.assert(
      fc.property(
        fc.array(pushEventArb, { minLength: 0, maxLength: 50 }),
        (events) => {
          const sorted = service.sortEventsByPriority(events);
          expect(sorted.length).toBe(events.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.3: 排序不应修改原数组
   */
  test('Property 16.3: 排序不应修改原数组', () => {
    fc.assert(
      fc.property(
        fc.array(pushEventArb, { minLength: 1, maxLength: 20 }),
        (events) => {
          const originalIds = events.map((e) => e.id);
          service.sortEventsByPriority(events);
          const afterIds = events.map((e) => e.id);

          // 原数组顺序应保持不变
          expect(afterIds).toEqual(originalIds);
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property 16.4: 每种事件类型应有默认优先级
   */
  test('Property 16.4: 每种事件类型应有默认优先级', () => {
    fc.assert(
      fc.property(eventTypeArb, (eventType) => {
        const priority = service.getDefaultPriority(eventType);

        // 应返回有效的优先级
        expect(['high', 'medium', 'low']).toContain(priority);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.5: 财报事件应包含必要信息
   */
  test('Property 16.5: 财报事件应包含必要信息', () => {
    fc.assert(
      fc.property(
        symbolArb,
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
        fc.constantFrom('Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'),
        fc.boolean(),
        (symbol, reportDate, fiscalQuarter, isReminder) => {
          const event = service.createEarningsEvent({
            symbol,
            reportDate,
            fiscalQuarter,
            isReminder,
          });

          // 事件应包含必要字段
          expect(event.id).toBeDefined();
          expect(event.type).toBe('earnings');
          expect(event.symbol).toBe(symbol);
          expect(event.title).toContain(symbol);
          expect(event.message.length).toBeGreaterThan(0);
          expect(event.priority).toBe('high');
          expect(event.createdAt).toBeInstanceOf(Date);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.6: 股息事件应包含必要信息
   */
  test('Property 16.6: 股息事件应包含必要信息', () => {
    fc.assert(
      fc.property(
        symbolArb,
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
        fc.float({ min: 0.01, max: 10, noNaN: true }),
        fc.boolean(),
        (symbol, exDate, amount, isReminder) => {
          const event = service.createDividendEvent({
            symbol,
            exDate,
            amount,
            isReminder,
          });

          expect(event.id).toBeDefined();
          expect(event.type).toBe('dividend');
          expect(event.symbol).toBe(symbol);
          expect(event.title).toContain(symbol);
          expect(event.message).toContain(amount.toFixed(2));
          expect(event.priority).toBe('medium');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.7: 内部交易事件应包含必要信息
   */
  test('Property 16.7: 内部交易事件应包含必要信息', () => {
    fc.assert(
      fc.property(
        symbolArb,
        fc.string({ minLength: 2, maxLength: 50 }),
        fc.constantFrom('buy', 'sell'),
        fc.integer({ min: 100, max: 1000000 }),
        fc.float({ min: 1000, max: 10000000, noNaN: true }),
        (symbol, insiderName, transactionType, shares, totalValue) => {
          const event = service.createInsiderEvent({
            symbol,
            insiderName,
            transactionType,
            shares,
            totalValue,
          });

          expect(event.id).toBeDefined();
          expect(event.type).toBe('insider');
          expect(event.symbol).toBe(symbol);
          expect(event.title).toContain(symbol);
          expect(event.message).toContain(insiderName);
          expect(event.priority).toBe('high');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.8: 评级变化事件应包含必要信息
   */
  test('Property 16.8: 评级变化事件应包含必要信息', () => {
    fc.assert(
      fc.property(
        symbolArb,
        fc.string({ minLength: 2, maxLength: 30 }),
        fc.string({ minLength: 2, maxLength: 50 }),
        fc.constantFrom('strong_buy', 'buy', 'hold', 'sell', 'strong_sell'),
        (symbol, analyst, firm, newRating) => {
          const event = service.createRatingChangeEvent({
            symbol,
            analyst,
            firm,
            newRating,
          });

          expect(event.id).toBeDefined();
          expect(event.type).toBe('rating_change');
          expect(event.symbol).toBe(symbol);
          expect(event.title).toContain(symbol);
          expect(event.message).toContain(firm);
          expect(event.message).toContain(newRating);
          expect(event.priority).toBe('medium');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.9: SEC 文件事件应包含必要信息
   */
  test('Property 16.9: SEC 文件事件应包含必要信息', () => {
    fc.assert(
      fc.property(
        symbolArb,
        fc.constantFrom('10-K', '10-Q', '8-K', '4', 'S-1'),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
        (symbol, formType, filedAt) => {
          const event = service.createSECFilingEvent({
            symbol,
            formType,
            filedAt,
          });

          expect(event.id).toBeDefined();
          expect(event.type).toBe('sec_filing');
          expect(event.symbol).toBe(symbol);
          expect(event.title).toContain(symbol);
          expect(event.message).toContain(formType);
          expect(event.priority).toBe('medium');
        }
      ),
      { numRuns: 100 }
    );
  });
});
