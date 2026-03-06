/**
 * Property-Based Tests for WebSocket Reconnection Exponential Backoff
 * Feature: project-review-and-upgrade
 *
 * **Property 6: WebSocket重连指数退避**
 * **Validates: Requirements 5.3**
 *
 * For any disconnected WebSocket connection, the client reconnection interval
 * should grow exponentially (e.g. 1s, 2s, 4s, 8s...) until reaching the
 * maximum reconnect attempts or a successful connection.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculateBackoffDelay } from './websocket';

/** Arbitrary for baseDelay: 100ms – 5000ms */
const baseDelayArb = fc.integer({ min: 100, max: 5000 });

/** Arbitrary for maxDelay: must be >= baseDelay */
const delayPairArb = baseDelayArb.chain((base) =>
  fc.integer({ min: base, max: base * 100 }).map((max) => ({ base, max })),
);

/** Arbitrary for attempt number: 0 – 20 */
const attemptArb = fc.integer({ min: 0, max: 20 });

describe('Property 6: WebSocket重连指数退避', () => {
  /**
   * delay(0) should always equal baseDelay.
   * **Validates: Requirements 5.3**
   */
  it('should return baseDelay for attempt 0', () => {
    fc.assert(
      fc.property(delayPairArb, ({ base, max }) => {
        expect(calculateBackoffDelay(0, base, max)).toBe(base);
      }),
      { numRuns: 20 },
    );
  });

  /**
   * delay should follow the exact formula: min(baseDelay * 2^attempt, maxDelay).
   * **Validates: Requirements 5.3**
   */
  it('should equal min(baseDelay * 2^attempt, maxDelay)', () => {
    fc.assert(
      fc.property(attemptArb, delayPairArb, (attempt, { base, max }) => {
        const actual = calculateBackoffDelay(attempt, base, max);
        const expected = Math.min(base * Math.pow(2, attempt), max);
        expect(actual).toBe(expected);
      }),
      { numRuns: 20 },
    );
  });

  /**
   * delay(n+1) >= delay(n) for all n — monotonically non-decreasing.
   * **Validates: Requirements 5.3**
   */
  it('should be monotonically non-decreasing: delay(n+1) >= delay(n)', () => {
    fc.assert(
      fc.property(attemptArb, delayPairArb, (attempt, { base, max }) => {
        const current = calculateBackoffDelay(attempt, base, max);
        const next = calculateBackoffDelay(attempt + 1, base, max);
        expect(next).toBeGreaterThanOrEqual(current);
      }),
      { numRuns: 20 },
    );
  });

  /**
   * delay should never exceed maxDelay.
   * **Validates: Requirements 5.3**
   */
  it('should never exceed maxDelay', () => {
    fc.assert(
      fc.property(attemptArb, delayPairArb, (attempt, { base, max }) => {
        const delay = calculateBackoffDelay(attempt, base, max);
        expect(delay).toBeLessThanOrEqual(max);
      }),
      { numRuns: 20 },
    );
  });
});
