/**
 * AI 指令解析属性测试
 * **Feature: smart-stock-analyzer, Property 30: AI指令解析属性**
 * **Validates: Requirements 9.1, 9.2**
 */

import * as fc from 'fast-check';
import { AIAssistantService, IntentType, ParsedIntent } from './aiAssistantService';

describe('AI Intent Parsing Property Tests', () => {
  const service = new AIAssistantService();

  // 生成股票代码
  const symbolArb = fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), {
    minLength: 1,
    maxLength: 5,
  });

  // 生成添加自选股的消息
  const addWatchlistMessageArb = fc.tuple(
    fc.constantFrom('添加', '加入', '关注', '收藏'),
    symbolArb,
    fc.constantFrom('到自选', '到关注列表', '到收藏夹', '自选')
  ).map(([action, symbol, target]) => `${action}${symbol}${target}`);

  // 生成移除自选股的消息
  const removeWatchlistMessageArb = fc.tuple(
    fc.constantFrom('删除', '移除', '取消关注', '移出'),
    symbolArb,
    fc.constantFrom('从自选', '自选', '关注列表')
  ).map(([action, symbol, target]) => `${action}${symbol}${target}`);

  // 生成股票查询消息
  const stockInfoMessageArb = fc.tuple(
    symbolArb,
    fc.constantFrom('怎么样', '如何', '情况', '分析', '介绍', '查询')
  ).map(([symbol, query]) => `${symbol}${query}`);

  // 生成股票对比消息
  const stockCompareMessageArb = fc.tuple(
    symbolArb,
    fc.constantFrom('对比', '比较', '和', 'vs'),
    symbolArb
  ).map(([s1, op, s2]) => `${s1}${op}${s2}`);

  /**
   * Property 30.1: 添加自选股意图应被正确识别
   * 包含添加关键词和自选关键词的消息应识别为 add_watchlist 意图
   */
  test('Property 30.1: 添加自选股意图应被正确识别', () => {
    fc.assert(
      fc.property(addWatchlistMessageArb, (message) => {
        const intent = service.parseIntent(message);
        
        // 应识别为添加自选股意图
        expect(intent.type).toBe('add_watchlist');
        // 置信度应大于0.5
        expect(intent.confidence).toBeGreaterThan(0.5);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 30.2: 移除自选股意图应被正确识别
   * 包含移除关键词和自选关键词的消息应识别为 remove_watchlist 意图
   */
  test('Property 30.2: 移除自选股意图应被正确识别', () => {
    fc.assert(
      fc.property(removeWatchlistMessageArb, (message) => {
        const intent = service.parseIntent(message);
        
        // 应识别为移除自选股意图
        expect(intent.type).toBe('remove_watchlist');
        // 置信度应大于0.5
        expect(intent.confidence).toBeGreaterThan(0.5);
      }),
      { numRuns: 100 }
    );
  });


  /**
   * Property 30.3: 股票查询意图应被正确识别
   * 包含股票代码和查询关键词的消息应识别为 stock_info 意图
   */
  test('Property 30.3: 股票查询意图应被正确识别', () => {
    fc.assert(
      fc.property(stockInfoMessageArb, (message) => {
        const intent = service.parseIntent(message);
        
        // 应识别为股票信息查询意图
        expect(intent.type).toBe('stock_info');
        // 应提取出股票代码
        expect(intent.entities.symbols).toBeDefined();
        expect(intent.entities.symbols!.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 30.4: 股票对比意图应被正确识别
   * 包含两个股票代码和对比关键词的消息应识别为 stock_compare 意图
   */
  test('Property 30.4: 股票对比意图应被正确识别', () => {
    fc.assert(
      fc.property(stockCompareMessageArb, (message) => {
        const intent = service.parseIntent(message);
        
        // 应识别为股票对比意图
        expect(intent.type).toBe('stock_compare');
        // 应提取出至少两个股票代码
        expect(intent.entities.symbols).toBeDefined();
        expect(intent.entities.symbols!.length).toBeGreaterThanOrEqual(2);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 30.5: 意图解析结果应始终包含必要字段
   * 任何消息的解析结果都应包含 type、confidence 和 entities
   */
  test('Property 30.5: 意图解析结果应始终包含必要字段', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 200 }), (message) => {
        const intent = service.parseIntent(message);
        
        // 必须包含 type
        expect(intent.type).toBeDefined();
        expect(typeof intent.type).toBe('string');
        
        // 必须包含 confidence
        expect(intent.confidence).toBeDefined();
        expect(typeof intent.confidence).toBe('number');
        expect(intent.confidence).toBeGreaterThanOrEqual(0);
        expect(intent.confidence).toBeLessThanOrEqual(1);
        
        // 必须包含 entities
        expect(intent.entities).toBeDefined();
        expect(typeof intent.entities).toBe('object');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 30.6: 意图类型应为有效枚举值
   * 解析结果的 type 应为预定义的意图类型之一
   */
  test('Property 30.6: 意图类型应为有效枚举值', () => {
    const validIntentTypes: IntentType[] = [
      'add_watchlist',
      'remove_watchlist',
      'stock_info',
      'stock_compare',
      'news_summary',
      'sector_summary',
      'general_question',
      'unknown',
    ];

    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 500 }), (message) => {
        const intent = service.parseIntent(message);
        
        // type 应为有效的意图类型
        expect(validIntentTypes).toContain(intent.type);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 30.7: 空消息或无意义消息应返回 unknown 意图
   * 无法识别的消息应返回 unknown 类型且置信度较低
   */
  test('Property 30.7: 无法识别的消息应返回低置信度', () => {
    // 生成随机无意义字符串
    const randomStringArb = fc.stringOf(
      fc.constantFrom(...'0123456789!@#$%^&*()'),
      { minLength: 5, maxLength: 50 }
    );

    fc.assert(
      fc.property(randomStringArb, (message) => {
        const intent = service.parseIntent(message);
        
        // 无意义消息的置信度应较低
        expect(intent.confidence).toBeLessThanOrEqual(0.5);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 30.8: 提取的股票代码应为有效格式
   * 提取的股票代码应为1-5个字母
   */
  test('Property 30.8: 提取的股票代码应为有效格式', () => {
    fc.assert(
      fc.property(
        fc.tuple(symbolArb, fc.constantFrom('分析', '查询', '怎么样')),
        ([symbol, query]) => {
          const message = `${symbol}${query}`;
          const intent = service.parseIntent(message);
          
          if (intent.entities.symbols && intent.entities.symbols.length > 0) {
            for (const s of intent.entities.symbols) {
              // 股票代码应为1-5个字母
              expect(s.length).toBeGreaterThanOrEqual(1);
              expect(s.length).toBeLessThanOrEqual(5);
              // 应只包含字母
              expect(/^[A-Za-z]+$/.test(s)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
