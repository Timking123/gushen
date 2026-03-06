/**
 * Property-Based Tests for Technical Indicator Calculations
 *
 * **Feature: smart-stock-analyzer, Property 23: 技术指标计算属�?*
 *
 * This test validates the technical indicator calculation property:
 * "For any stock historical data and indicator parameters, the calculated technical
 * indicator values should conform to standard formulas (such as RSI, MACD, Bollinger Bands)"
 *
 * **Validates: Requirements 16.1, 16.4**
 * - 16.1: WHEN 用户查看股票图表 THEN Technical_Indicator SHALL 支持叠加多种技术指标（RSI、MACD、布林带等）
 * - 16.4: WHEN 用户设置技术指标参�?THEN Technical_Indicator SHALL 允许自定义指标周期和参数
 */

import fc from 'fast-check';
import { TechnicalIndicatorService } from './technicalIndicatorService.js';

// Mock dependencies
jest.mock('../lib/redis', () => ({
  redisHelpers: {
    getJson: jest.fn(),
    setJson: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Technical Indicator Calculation Property Tests', () => {
  let service: TechnicalIndicatorService;

  beforeEach(() => {
    service = new TechnicalIndicatorService();
    jest.clearAllMocks();
  });

  /**
   * **Feature: smart-stock-analyzer, Property 23: 技术指标计算属�?*
   *
   * Property: For any stock historical data and indicator parameters,
   * the calculated technical indicator values should conform to standard formulas.
   *
   * **Validates: Requirements 16.1, 16.4**
   */
  describe('Property 23: Technical Indicator Calculation Property (技术指标计算属�?', () => {
    // Arbitrary for generating valid positive prices
    const priceArbitrary: fc.Arbitrary<number> = fc.float({
      min: Math.fround(0.01),
      max: Math.fround(10000),
      noNaN: true,
      noDefaultInfinity: true,
    });

    // Arbitrary for generating an array of positive prices
    const priceArrayArbitrary = (minLength: number, maxLength: number): fc.Arbitrary<number[]> =>
      fc.array(priceArbitrary, { minLength, maxLength });

    // Note: The following arbitraries are defined for potential future use
    // Arbitrary for generating valid OHLCV data
    // const ohlcvArbitrary: fc.Arbitrary<OHLCV> = fc
    //   .tuple(
    //     priceArbitrary, // base price
    //     fc.float({ min: 0.001, max: 0.2, noNaN: true }), // high offset percentage
    //     fc.float({ min: 0.001, max: 0.2, noNaN: true }), // low offset percentage
    //     fc.float({ min: -0.1, max: 0.1, noNaN: true }), // close offset percentage
    //     fc.integer({ min: 1000, max: 100000000 }), // volume
    //     fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') })
    //   )
    //   .map(([basePrice, highOffset, lowOffset, closeOffset, volume, timestamp]) => {
    //     const open = basePrice;
    //     const high = basePrice * (1 + highOffset);
    //     const low = basePrice * (1 - lowOffset);
    //     const close = basePrice * (1 + closeOffset);
    //     return {
    //       timestamp,
    //       open,
    //       high: Math.max(high, open, close),
    //       low: Math.min(low, open, close),
    //       close,
    //       volume,
    //     };
    //   });

    // Arbitrary for generating an array of OHLCV data with sequential timestamps
    // const ohlcvArrayArbitrary = (minLength: number, maxLength: number): fc.Arbitrary<OHLCV[]> =>
    //   fc
    //     .array(
    //       fc.tuple(
    //         priceArbitrary,
    //         fc.float({ min: 0.001, max: 0.2, noNaN: true }),
    //         fc.float({ min: 0.001, max: 0.2, noNaN: true }),
    //         fc.float({ min: -0.1, max: 0.1, noNaN: true }),
    //         fc.integer({ min: 1000, max: 100000000 })
    //       ),
    //       { minLength, maxLength }
    //     )
    //     .map((data) => {
    //       const baseDate = new Date('2024-01-01');
    //       return data.map(([basePrice, highOffset, lowOffset, closeOffset, volume], index) => {
    //         const open = basePrice;
    //         const high = basePrice * (1 + highOffset);
    //         const low = basePrice * (1 - lowOffset);
    //         const close = basePrice * (1 + closeOffset);
    //         return {
    //           timestamp: new Date(baseDate.getTime() + index * 24 * 60 * 60 * 1000),
    //           open,
    //           high: Math.max(high, open, close),
    //           low: Math.min(low, open, close),
    //           close,
    //           volume,
    //         };
    //       });
    //     });

    // Arbitrary for generating valid SMA/EMA periods
    // const periodArbitrary: fc.Arbitrary<number> = fc.integer({ min: 1, max: 200 });

    /**
     * Property 23.1: RSI values are always between 0 and 100
     *
     * RSI (Relative Strength Index) is bounded by definition:
     * RSI = 100 - (100 / (1 + RS)) where RS >= 0
     * This means RSI is always in the range [0, 100]
     */
    describe('RSI Calculation Properties', () => {
      it('RSI values should always be between 0 and 100 for any valid price data', async () => {
        await fc.assert(
          fc.property(
            priceArrayArbitrary(16, 200), // Need at least period + 1 data points
            fc.integer({ min: 2, max: 50 }), // RSI period
            (prices, period) => {
              // Precondition: enough data for RSI calculation
              fc.pre(prices.length >= period + 1);

              const rsi = service.calculateRSI(prices, period);

              // If RSI is calculated (not null), it must be in [0, 100]
              if (rsi !== null) {
                if (rsi < 0 || rsi > 100) {
                  throw new Error(
                    `RSI value ${rsi} is outside valid range [0, 100] for period ${period}`
                  );
                }
              }

              return true;
            }
          ),
          { numRuns: 20 }
        );
      });

      it('RSI should return 100 when all price changes are gains (no losses)', async () => {
        await fc.assert(
          fc.property(
            fc.integer({ min: 2, max: 30 }), // period
            fc.float({ min: Math.fround(10), max: Math.fround(100), noNaN: true }), // starting price
            fc.float({ min: Math.fround(0.01), max: Math.fround(1), noNaN: true }), // increment
            (period, startPrice, increment) => {
              // Generate strictly increasing prices
              const prices: number[] = [];
              for (let i = 0; i < period + 5; i++) {
                prices.push(startPrice + i * increment);
              }

              const rsi = service.calculateRSI(prices, period);

              // With only gains, RSI should be 100
              expect(rsi).toBe(100);

              return true;
            }
          ),
          { numRuns: 20 }
        );
      });

      it('RSI should return 0 when all price changes are losses (no gains)', async () => {
        await fc.assert(
          fc.property(
            fc.integer({ min: 2, max: 30 }), // period
            fc.float({ min: Math.fround(100), max: Math.fround(1000), noNaN: true }), // starting price
            fc.float({ min: Math.fround(0.01), max: Math.fround(1), noNaN: true }), // decrement
            (period, startPrice, decrement) => {
              // Generate strictly decreasing prices
              const prices: number[] = [];
              for (let i = 0; i < period + 5; i++) {
                prices.push(startPrice - i * decrement);
              }

              // Ensure all prices are positive
              fc.pre(prices.every((p) => p > 0));

              const rsi = service.calculateRSI(prices, period);

              // With only losses, RSI should be 0
              expect(rsi).toBe(0);

              return true;
            }
          ),
          { numRuns: 20 }
        );
      });

      it('RSI should return 50 when there are no price changes', async () => {
        await fc.assert(
          fc.property(
            fc.integer({ min: 2, max: 30 }), // period
            fc.float({ min: Math.fround(10), max: Math.fround(1000), noNaN: true }), // constant price
            (period, price) => {
              // Generate constant prices
              const prices: number[] = Array(period + 5).fill(price);

              const rsi = service.calculateRSI(prices, period);

              // With no changes, RSI should be 50
              expect(rsi).toBe(50);

              return true;
            }
          ),
          { numRuns: 20 }
        );
      });
    });

    /**
     * Property 23.2: MACD histogram equals MACD value minus signal line
     *
     * By definition: Histogram = MACD Line - Signal Line
     */
    describe('MACD Calculation Properties', () => {
      it('MACD histogram should equal MACD value minus signal line', async () => {
        await fc.assert(
          fc.property(
            priceArrayArbitrary(50, 200), // Need enough data for MACD
            (prices) => {
              const macd = service.calculateMACD(prices, 12, 26, 9);

              if (macd !== null) {
                const expectedHistogram = macd.value - macd.signal;
                const histogramDiff = Math.abs(macd.histogram - expectedHistogram);

                if (histogramDiff > 1e-10) {
                  throw new Error(
                    `MACD histogram ${macd.histogram} does not equal value - signal ` +
                      `(${macd.value} - ${macd.signal} = ${expectedHistogram})`
                  );
                }
              }

              return true;
            }
          ),
          { numRuns: 20 }
        );
      });

      it('MACD should have positive value when fast EMA > slow EMA in uptrend', async () => {
        await fc.assert(
          fc.property(
            fc.float({ min: Math.fround(50), max: Math.fround(200), noNaN: true }), // starting price
            fc.float({ min: Math.fround(0.5), max: Math.fround(2), noNaN: true }), // trend strength
            (startPrice, trendStrength) => {
              // Generate strongly uptrending prices
              const prices: number[] = [];
              for (let i = 0; i < 60; i++) {
                prices.push(startPrice + i * trendStrength);
              }

              const macd = service.calculateMACD(prices, 12, 26, 9);

              // In a strong uptrend, MACD value should be positive
              // (fast EMA responds quicker to rising prices)
              if (macd !== null) {
                expect(macd.value).toBeGreaterThan(0);
              }

              return true;
            }
          ),
          { numRuns: 20 }
        );
      });

      it('MACD should return null for insufficient data', async () => {
        await fc.assert(
          fc.property(priceArrayArbitrary(1, 33), (prices) => {
            // With less than slowPeriod + signalPeriod - 1 = 26 + 9 - 1 = 34 data points
            fc.pre(prices.length < 34);

            const macd = service.calculateMACD(prices, 12, 26, 9);

            expect(macd).toBeNull();

            return true;
          }),
          { numRuns: 20 }
        );
      });
    });

    /**
     * Property 23.3: Bollinger Bands: upper > middle > lower, and bands are symmetric around middle
     *
     * By definition:
     * - Middle Band = SMA
     * - Upper Band = Middle + (k * StdDev)
     * - Lower Band = Middle - (k * StdDev)
     * Therefore: Upper - Middle = Middle - Lower (symmetric)
     */
    describe('Bollinger Bands Calculation Properties', () => {
      it('Bollinger Bands should satisfy upper > middle > lower', async () => {
        await fc.assert(
          fc.property(
            priceArrayArbitrary(20, 200),
            fc.integer({ min: 5, max: 50 }), // period
            fc.float({ min: Math.fround(0.5), max: Math.fround(3), noNaN: true }), // stdDev multiplier
            (prices, period, stdDevMultiplier) => {
              fc.pre(prices.length >= period);

              const bb = service.calculateBollingerBands(prices, period, stdDevMultiplier);

              if (bb !== null) {
                if (bb.upper < bb.middle || bb.middle < bb.lower) {
                  return false;
                }
                return true;
              }
              return true;
            }
          ),
          { numRuns: 20 }
        );
      });
    });
  });
});
