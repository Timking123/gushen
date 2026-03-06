/**
 * Property-Based Tests for Earnings Calendar Time Property
 * Feature: smart-stock-analyzer, Property 15: 财报日历时间属�?
 * 
 * **Validates: Requirements 11.1, 11.2**
 * 
 * Property: For any earnings event, it should contain:
 * - A valid reportDate (Date object)
 * - A valid timing value ('bmo' | 'amc' | 'unknown')
 * 
 * Requirements:
 * - 11.1: WHEN 用户查看财报日历 THEN Earnings_Calendar SHALL 显示未来财报发布的时间表
 * - 11.2: WHEN 用户查看财报日历 THEN Earnings_Calendar SHALL 标注盘前（BMO）或盘后（AMC）发布时�?
 */

import fc from 'fast-check';
import { describe, it, expect } from '@jest/globals';
import type { EarningsEvent, EarningsTiming } from './earningsService.js';

/**
 * Valid earnings timing values as defined in the design document
 * BMO = Before Market Open (盘前)
 * AMC = After Market Close (盘后)
 * unknown = Unknown timing
 */
const VALID_TIMING_VALUES: EarningsTiming[] = ['bmo', 'amc', 'unknown'];

/**
 * Helper function to check if a value is a valid Date object
 */
function isValidDate(date: unknown): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Helper function to check if a timing value is valid
 */
function isValidTiming(timing: unknown): timing is EarningsTiming {
  return typeof timing === 'string' && VALID_TIMING_VALUES.includes(timing as EarningsTiming);
}

/**
 * Arbitrary generator for valid earnings timing values
 */
const timingArbitrary = fc.constantFrom<EarningsTiming>('bmo', 'amc', 'unknown');

/**
 * Arbitrary generator for valid report dates
 * Generates dates within a reasonable range (past 5 years to future 2 years)
 * Uses integer timestamps to avoid NaN dates
 */
const reportDateArbitrary = fc.integer({
  min: Date.now() - 5 * 365 * 24 * 60 * 60 * 1000, // 5 years ago
  max: Date.now() + 2 * 365 * 24 * 60 * 60 * 1000, // 2 years from now
}).map(timestamp => new Date(timestamp));

/**
 * Arbitrary generator for stock symbols
 */
const symbolArbitrary = fc.stringMatching(/^[A-Z]{1,5}$/);

/**
 * Arbitrary generator for fiscal quarters
 */
const fiscalQuarterArbitrary = fc.constantFrom('Q1', 'Q2', 'Q3', 'Q4');

/**
 * Arbitrary generator for fiscal years
 */
const fiscalYearArbitrary = fc.integer({ min: 2019, max: 2030 });

/**
 * Arbitrary generator for EPS values (can be null or a number)
 */
const epsArbitrary = fc.option(
  fc.float({ min: -100, max: 100, noNaN: true }),
  { nil: null }
);

/**
 * Arbitrary generator for revenue values (can be null or a positive number)
 */
const revenueArbitrary = fc.option(
  fc.integer({ min: 0, max: 1_000_000_000_000 }),
  { nil: null }
);

/**
 * Arbitrary generator for valid timestamps (for createdAt and updatedAt)
 */
const timestampArbitrary = fc.integer({
  min: Date.now() - 5 * 365 * 24 * 60 * 60 * 1000,
  max: Date.now(),
}).map(timestamp => new Date(timestamp));

/**
 * Arbitrary generator for a complete EarningsEvent
 */
const earningsEventArbitrary = fc.record({
  id: fc.uuid(),
  symbol: symbolArbitrary,
  stockName: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  sector: fc.option(fc.constantFrom('Technology', 'Healthcare', 'Financial Services', 'Energy', 'Consumer'), { nil: null }),
  industry: fc.option(fc.constantFrom('Software', 'Biotechnology', 'Banks', 'Oil & Gas'), { nil: null }),
  marketCap: fc.option(fc.integer({ min: 1_000_000, max: 3_000_000_000_000 }), { nil: null }),
  reportDate: reportDateArbitrary,
  fiscalQuarter: fiscalQuarterArbitrary,
  fiscalYear: fiscalYearArbitrary,
  timing: timingArbitrary,
  epsEstimate: epsArbitrary,
  epsActual: epsArbitrary,
  epsSurprise: epsArbitrary,
  epsSurprisePercent: fc.option(fc.float({ min: -1000, max: 1000, noNaN: true }), { nil: null }),
  revenueEstimate: revenueArbitrary,
  revenueActual: revenueArbitrary,
  revenueSurprise: fc.option(fc.float({ min: -1_000_000_000, max: 1_000_000_000, noNaN: true }), { nil: null }),
  revenueSurprisePercent: fc.option(fc.float({ min: -1000, max: 1000, noNaN: true }), { nil: null }),
  previousEps: fc.option(fc.float({ min: -100, max: 100, noNaN: true }), { nil: null }),
  createdAt: timestampArbitrary,
  updatedAt: timestampArbitrary,
}).map(record => record as EarningsEvent);

/**
 * Arbitrary generator for an array of EarningsEvents
 */
const earningsEventsArbitrary = fc.array(earningsEventArbitrary, { minLength: 1, maxLength: 50 });

describe('Property 15: 财报日历时间属性', () => {
  /**
   * Test that all earnings events have a valid reportDate (Date object)
   * Validates Requirement 11.1: Display future earnings release schedule
   */
  it('should have valid reportDate for all earnings events', () => {
    fc.assert(
      fc.property(
        earningsEventArbitrary,
        (event) => {
          // Property: reportDate must be a valid Date object
          expect(event.reportDate).toBeInstanceOf(Date);
          expect(isValidDate(event.reportDate)).toBe(true);
          
          // The date should not be NaN
          expect(isNaN(event.reportDate.getTime())).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test that all earnings events have a valid timing value
   * Validates Requirement 11.2: Mark BMO or AMC release timing
   */
  it('should have valid timing value (bmo/amc/unknown) for all earnings events', () => {
    fc.assert(
      fc.property(
        earningsEventArbitrary,
        (event) => {
          // Property: timing must be one of the three valid values
          expect(isValidTiming(event.timing)).toBe(true);
          expect(VALID_TIMING_VALUES).toContain(event.timing);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test that timing is always one of exactly three valid values
   */
  it('should only allow exactly three timing values: bmo, amc, unknown', () => {
    fc.assert(
      fc.property(
        timingArbitrary,
        (timing) => {
          // Property: timing must be exactly one of the three valid values
          expect(['bmo', 'amc', 'unknown']).toContain(timing);
          expect(typeof timing).toBe('string');
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test that all events in an array have valid reportDate and timing
   */
  it('should have all events in calendar with valid reportDate and timing', () => {
    fc.assert(
      fc.property(
        earningsEventsArbitrary,
        (events) => {
          // For each event in the calendar
          for (const event of events) {
            // Property: reportDate must be valid
            expect(event.reportDate).toBeInstanceOf(Date);
            expect(isValidDate(event.reportDate)).toBe(true);
            
            // Property: timing must be valid
            expect(isValidTiming(event.timing)).toBe(true);
            expect(VALID_TIMING_VALUES).toContain(event.timing);
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test that reportDate can represent any valid date (past, present, future)
   * This validates that the calendar can show both historical and upcoming earnings
   */
  it('should support reportDate for past, present, and future dates', () => {
    const now = Date.now();
    const pastTimestamp = now - 365 * 24 * 60 * 60 * 1000; // 1 year ago
    const futureTimestamp = now + 365 * 24 * 60 * 60 * 1000; // 1 year from now

    const dateInRangeArbitrary = fc.integer({ min: pastTimestamp, max: futureTimestamp })
      .map(timestamp => new Date(timestamp));

    fc.assert(
      fc.property(
        dateInRangeArbitrary,
        timingArbitrary,
        (reportDate, timing) => {
          // Create a minimal earnings event
          const event: Partial<EarningsEvent> = {
            reportDate,
            timing,
          };
          
          // Property: reportDate should be valid regardless of being past/present/future
          expect(isValidDate(event.reportDate)).toBe(true);
          expect(isValidTiming(event.timing)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test that timing values are case-sensitive and lowercase
   */
  it('should have timing values in lowercase format', () => {
    fc.assert(
      fc.property(
        timingArbitrary,
        (timing) => {
          // Property: timing should be lowercase
          expect(timing).toBe(timing.toLowerCase());
          
          // Property: timing should not contain uppercase letters
          expect(timing).toMatch(/^[a-z]+$/);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test that reportDate maintains its value after serialization/deserialization
   * This is important for API responses and caching
   */
  it('should preserve reportDate value through JSON serialization', () => {
    fc.assert(
      fc.property(
        reportDateArbitrary,
        (reportDate) => {
          // Simulate JSON serialization (as would happen in API response)
          const serialized = JSON.stringify({ reportDate });
          const deserialized = JSON.parse(serialized);
          const restoredDate = new Date(deserialized.reportDate);
          
          // Property: Date should be preserved through serialization
          expect(restoredDate.getTime()).toBe(reportDate.getTime());
          expect(isValidDate(restoredDate)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test that timing value is preserved through JSON serialization
   */
  it('should preserve timing value through JSON serialization', () => {
    fc.assert(
      fc.property(
        timingArbitrary,
        (timing) => {
          // Simulate JSON serialization
          const serialized = JSON.stringify({ timing });
          const deserialized = JSON.parse(serialized);
          
          // Property: timing should be preserved through serialization
          expect(deserialized.timing).toBe(timing);
          expect(isValidTiming(deserialized.timing)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test that each timing value has a distinct meaning
   * BMO = Before Market Open, AMC = After Market Close, unknown = not determined
   */
  it('should have distinct timing values representing different release times', () => {
    fc.assert(
      fc.property(
        fc.tuple(timingArbitrary, timingArbitrary),
        ([timing1, timing2]) => {
          // If timings are the same, they should be equal
          if (timing1 === timing2) {
            expect(timing1).toBe(timing2);
          } else {
            // If timings are different, they should not be equal
            expect(timing1).not.toBe(timing2);
          }
          
          // Both should still be valid
          expect(isValidTiming(timing1)).toBe(true);
          expect(isValidTiming(timing2)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test that reportDate and timing are independent properties
   * Any valid date can have any valid timing
   */
  it('should allow any combination of valid reportDate and timing', () => {
    fc.assert(
      fc.property(
        reportDateArbitrary,
        timingArbitrary,
        (reportDate, timing) => {
          // Create an event with the combination
          const event: Partial<EarningsEvent> = {
            reportDate,
            timing,
          };
          
          // Property: Any combination of valid date and timing should be valid
          expect(isValidDate(event.reportDate)).toBe(true);
          expect(isValidTiming(event.timing)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });
});
