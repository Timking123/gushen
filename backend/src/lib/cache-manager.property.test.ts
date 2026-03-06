/**
 * Property-Based Tests for Cache Key Determinism
 * Feature: project-review-and-upgrade
 *
 * **Property 5: 缓存键确定性**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 *
 * For any identical input parameters (including filter objects), regardless of
 * property order, the cache key generation algorithm should always produce the
 * same key, and key length should be bounded (via hashing).
 */

import fc from 'fast-check';
import { describe, it, expect } from '@jest/globals';
import { generateKey, deepSortObject } from './cache-manager.js';

/**
 * Shuffle the keys of a plain object (top-level only).
 */
function shuffleObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(obj);
  // Fisher-Yates shuffle
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  const shuffled: Record<string, unknown> = {};
  for (const k of keys) {
    shuffled[k] = obj[k];
  }
  return shuffled;
}

/**
 * Recursively shuffle all object keys at every level.
 */
function deepShuffleKeys(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(deepShuffleKeys);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const shuffled = shuffleObjectKeys(obj);
    const result: Record<string, unknown> = {};
    for (const k of Object.keys(shuffled)) {
      result[k] = deepShuffleKeys(shuffled[k]);
    }
    return result;
  }
  return value;
}

/** Arbitrary for cache key prefixes */
const prefixArbitrary = fc.stringMatching(/^[a-z][a-z0-9_-]{0,19}$/);

/** Arbitrary for JSON-serializable leaf values */
const leafArbitrary = fc.oneof(
  fc.string({ maxLength: 50 }),
  fc.integer(),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.boolean(),
  fc.constant(null),
);

/** Arbitrary for nested params objects (depth ≤ 3) */
const paramsArbitrary: fc.Arbitrary<Record<string, unknown>> = fc.dictionary(
  fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,9}$/),
  fc.oneof(
    leafArbitrary,
    fc.array(leafArbitrary, { maxLength: 5 }),
    // one level of nesting
    fc.dictionary(
      fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,9}$/),
      fc.oneof(
        leafArbitrary,
        // two levels of nesting
        fc.dictionary(
          fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,9}$/),
          leafArbitrary,
          { minKeys: 1, maxKeys: 3 },
        ),
      ),
      { minKeys: 1, maxKeys: 4 },
    ),
  ),
  { minKeys: 1, maxKeys: 6 },
);


describe('Property 5: 缓存键确定性', () => {
  /**
   * 1. Same params with different key order produce the same cache key (determinism).
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
   */
  it('should produce the same key regardless of property order', () => {
    fc.assert(
      fc.property(prefixArbitrary, paramsArbitrary, (prefix, params) => {
        const key1 = generateKey(prefix, params);
        const shuffled = shuffleObjectKeys(params) as Record<string, unknown>;
        const key2 = generateKey(prefix, shuffled);
        expect(key1).toBe(key2);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * 2. Different params produce different cache keys (uniqueness).
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
   */
  it('should produce different keys for different params', () => {
    fc.assert(
      fc.property(
        prefixArbitrary,
        paramsArbitrary,
        paramsArbitrary,
        (prefix, paramsA, paramsB) => {
          // Only assert when the two param objects are semantically different
          const sortedA = JSON.stringify(deepSortObject(paramsA));
          const sortedB = JSON.stringify(deepSortObject(paramsB));
          fc.pre(sortedA !== sortedB);

          const keyA = generateKey(prefix, paramsA);
          const keyB = generateKey(prefix, paramsB);
          expect(keyA).not.toBe(keyB);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * 3. Key format is always `{prefix}:{64-char-hex-hash}` (bounded length).
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
   */
  it('should always produce keys in prefix:64-hex-hash format', () => {
    fc.assert(
      fc.property(prefixArbitrary, paramsArbitrary, (prefix, params) => {
        const key = generateKey(prefix, params);

        // Format: prefix + ':' + 64 hex chars
        const regex = new RegExp(`^${prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}:[a-f0-9]{64}$`);
        expect(key).toMatch(regex);

        // Total length = prefix.length + 1 (colon) + 64 (SHA-256 hex)
        expect(key.length).toBe(prefix.length + 1 + 64);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * 4. Deep nested objects with shuffled keys produce the same key.
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
   */
  it('should produce the same key for deeply nested objects with shuffled keys', () => {
    fc.assert(
      fc.property(prefixArbitrary, paramsArbitrary, (prefix, params) => {
        const key1 = generateKey(prefix, params);
        const deepShuffled = deepShuffleKeys(params) as Record<string, unknown>;
        const key2 = generateKey(prefix, deepShuffled);
        expect(key1).toBe(key2);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * 5. Different prefixes with same params produce different keys (namespace isolation).
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
   */
  it('should produce different keys for different prefixes with same params', () => {
    fc.assert(
      fc.property(
        prefixArbitrary,
        prefixArbitrary,
        paramsArbitrary,
        (prefixA, prefixB, params) => {
          fc.pre(prefixA !== prefixB);

          const keyA = generateKey(prefixA, params);
          const keyB = generateKey(prefixB, params);
          expect(keyA).not.toBe(keyB);
        },
      ),
      { numRuns: 100 },
    );
  });
});
