/**
 * 技术信号触发属性测试
 * **Feature: smart-stock-analyzer, Property 24: 技术信号触发属性**
 * **Validates: Requirements 16.5**
 */

import * as fc from 'fast-check';
import { TechnicalAlertService, AlertCondition, IndicatorType } from './technicalAlertService';

describe('Technical Signal Trigger Property Tests', () => {
  const service = new TechnicalAlertService();

  // 生成有效的指标类型
  const indicatorTypeArb = fc.constantFrom<IndicatorType>('rsi', 'macd', 'sma', 'ema', 'bollinger');

  // 生成有效的条件类型
  const conditionArb = fc.constantFrom<AlertCondition>('above', 'below', 'cross_above', 'cross_below');

  // 生成数值
  const valueArb = fc.float({ min: -1000, max: 1000, noNaN: true });

  /**
   * Property 24.1: above 条件应在当前值大于目标值时触发
   */
  test('Property 24.1: above 条件应在当前值大于目标值时触发', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true }),
        fc.float({ min: 0, max: 100, noNaN: true }),
        (currentValue, targetValue) => {
          const result = service.evaluateCondition(currentValue, targetValue, 'above');
          
          if (currentValue > targetValue) {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 24.2: below 条件应在当前值小于目标值时触发
   */
  test('Property 24.2: below 条件应在当前值小于目标值时触发', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true }),
        fc.float({ min: 0, max: 100, noNaN: true }),
        (currentValue, targetValue) => {
          const result = service.evaluateCondition(currentValue, targetValue, 'below');
          
          if (currentValue < targetValue) {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 24.3: cross_above 条件应在当前值刚超过目标值时触发
   */
  test('Property 24.3: cross_above 条件应在当前值刚超过目标值时触发', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 100, noNaN: true }),
        (targetValue) => {
          // 刚超过目标值（在 2% 范围内）
          const justAbove = targetValue * 1.01;
          const result = service.evaluateCondition(justAbove, targetValue, 'cross_above');
          expect(result).toBe(true);

          // 远超过目标值（超过 2%）
          const farAbove = targetValue * 1.05;
          const resultFar = service.evaluateCondition(farAbove, targetValue, 'cross_above');
          expect(resultFar).toBe(false);

          // 低于目标值
          const below = targetValue * 0.95;
          const resultBelow = service.evaluateCondition(below, targetValue, 'cross_above');
          expect(resultBelow).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property 24.4: cross_below 条件应在当前值刚低于目标值时触发
   */
  test('Property 24.4: cross_below 条件应在当前值刚低于目标值时触发', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 100, noNaN: true }),
        (targetValue) => {
          // 刚低于目标值（在 2% 范围内）
          const justBelow = targetValue * 0.99;
          const result = service.evaluateCondition(justBelow, targetValue, 'cross_below');
          expect(result).toBe(true);

          // 远低于目标值（超过 2%）
          const farBelow = targetValue * 0.95;
          const resultFar = service.evaluateCondition(farBelow, targetValue, 'cross_below');
          expect(resultFar).toBe(false);

          // 高于目标值
          const above = targetValue * 1.05;
          const resultAbove = service.evaluateCondition(above, targetValue, 'cross_below');
          expect(resultAbove).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 24.5: 条件评估应返回布尔值
   */
  test('Property 24.5: 条件评估应返回布尔值', () => {
    fc.assert(
      fc.property(
        valueArb,
        valueArb,
        conditionArb,
        (currentValue, targetValue, condition) => {
          const result = service.evaluateCondition(currentValue, targetValue, condition);
          
          // 结果应为布尔值
          expect(typeof result).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 24.6: above 和 below 条件应互斥（当值不等时）
   */
  test('Property 24.6: above 和 below 条件应互斥', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true }),
        fc.float({ min: 0, max: 100, noNaN: true }),
        (currentValue, targetValue) => {
          const aboveResult = service.evaluateCondition(currentValue, targetValue, 'above');
          const belowResult = service.evaluateCondition(currentValue, targetValue, 'below');
          
          // 当值不相等时，above 和 below 不能同时为 true
          if (currentValue !== targetValue) {
            expect(aboveResult && belowResult).toBe(false);
          }
          
          // 当值相等时，两者都应为 false
          if (currentValue === targetValue) {
            expect(aboveResult).toBe(false);
            expect(belowResult).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 24.7: RSI 超买超卖阈值应正确触发
   */
  test('Property 24.7: RSI 超买超卖阈值应正确触发', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true }),
        (rsiValue) => {
          // RSI 超买阈值 70
          const overboughtResult = service.evaluateCondition(rsiValue, 70, 'above');
          expect(overboughtResult).toBe(rsiValue > 70);

          // RSI 超卖阈值 30
          const oversoldResult = service.evaluateCondition(rsiValue, 30, 'below');
          expect(oversoldResult).toBe(rsiValue < 30);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 24.8: 预设提醒配置应包含必要字段
   */
  test('Property 24.8: 预设提醒配置应包含必要字段', () => {
    const presets = service.getPresetAlerts();

    expect(presets.length).toBeGreaterThan(0);

    for (const preset of presets) {
      // 每个预设应有名称
      expect(preset.name).toBeDefined();
      expect(typeof preset.name).toBe('string');
      expect(preset.name.length).toBeGreaterThan(0);

      // 每个预设应有配置
      expect(preset.config).toBeDefined();

      // 配置应包含指标类型
      expect(preset.config.indicatorType).toBeDefined();

      // 配置应包含条件
      expect(preset.config.condition).toBeDefined();

      // 配置应包含目标值
      expect(preset.config.targetValue).toBeDefined();
    }
  });
});
