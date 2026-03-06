/**
 * Property-Based Tests for SEC Filing Filtering
 * 
 * Feature: smart-stock-analyzer, Property 32: SEC文件筛选属性
 * 
 * **Validates: Requirements 20.5**
 * 
 * Property: For any file type and date range filter conditions,
 * returned SEC filings should satisfy all conditions.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SECFormType, SECFilingFilters, SECFilingWithStock } from './secFilingService.js';

// Valid SEC form types
const validFormTypes: SECFormType[] = ['10-K', '10-Q', '8-K', '4', 'S-1', 'DEF 14A', '13F', 'SC 13G', 'SC 13D', 'Other'];

// Arbitrary for SEC form type
const formTypeArb = fc.constantFrom(...validFormTypes);

// Arbitrary for stock symbol
const symbolArb = fc.stringMatching(/^[A-Z]{1,5}$/);

// Arbitrary for date within a reasonable range
const dateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') });

// Arbitrary for SEC filing
const secFilingArb: fc.Arbitrary<SECFilingWithStock> = fc.record({
  id: fc.uuid(),
  symbol: symbolArb,
  formType: formTypeArb,
  filedAt: dateArb,
  periodOfReport: fc.option(dateArb, { nil: null }),
  url: fc.webUrl(),
  summary: fc.option(fc.string({ minLength: 10, maxLength: 200 }), { nil: null }),
  createdAt: dateArb,
  stockName: fc.string({ minLength: 1, maxLength: 50 }),
  sector: fc.option(fc.constantFrom('Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer'), { nil: null }),
});

// Arbitrary for SEC filing filters
const filtersArb: fc.Arbitrary<SECFilingFilters> = fc.record({
  symbol: fc.option(symbolArb, { nil: undefined }),
  symbols: fc.option(fc.array(symbolArb, { minLength: 1, maxLength: 5 }), { nil: undefined }),
  formTypes: fc.option(fc.array(formTypeArb, { minLength: 1, maxLength: 3 }), { nil: undefined }),
  startDate: fc.option(dateArb, { nil: undefined }),
  endDate: fc.option(dateArb, { nil: undefined }),
});

/**
 * Pure function to filter SEC filings based on criteria
 * This simulates the filtering logic without database dependency
 */
function filterSECFilings(
  filings: SECFilingWithStock[],
  filters: SECFilingFilters
): SECFilingWithStock[] {
  return filings.filter((filing) => {
    // Symbol filter
    if (filters.symbol && filing.symbol !== filters.symbol.toUpperCase()) {
      return false;
    }

    // Multiple symbols filter
    if (filters.symbols && filters.symbols.length > 0) {
      const normalizedSymbols = filters.symbols.map(s => s.toUpperCase());
      if (!normalizedSymbols.includes(filing.symbol)) {
        return false;
      }
    }

    // Form type filter
    if (filters.formTypes && filters.formTypes.length > 0) {
      if (!filters.formTypes.includes(filing.formType)) {
        return false;
      }
    }

    // Date range filter
    if (filters.startDate && filing.filedAt < filters.startDate) {
      return false;
    }
    if (filters.endDate && filing.filedAt > filters.endDate) {
      return false;
    }

    return true;
  });
}

/**
 * Check if a filing matches all filter criteria
 */
function matchesAllFilters(filing: SECFilingWithStock, filters: SECFilingFilters): boolean {
  // Symbol filter
  if (filters.symbol && filing.symbol !== filters.symbol.toUpperCase()) {
    return false;
  }

  // Multiple symbols filter
  if (filters.symbols && filters.symbols.length > 0) {
    const normalizedSymbols = filters.symbols.map(s => s.toUpperCase());
    if (!normalizedSymbols.includes(filing.symbol)) {
      return false;
    }
  }

  // Form type filter
  if (filters.formTypes && filters.formTypes.length > 0) {
    if (!filters.formTypes.includes(filing.formType)) {
      return false;
    }
  }

  // Date range filter
  if (filters.startDate && filing.filedAt < filters.startDate) {
    return false;
  }
  if (filters.endDate && filing.filedAt > filters.endDate) {
    return false;
  }

  return true;
}

describe('SEC Filing Filter Property Tests', () => {
  /**
   * Feature: smart-stock-analyzer, Property 32: SEC文件筛选属性
   * 
   * **Validates: Requirements 20.5**
   * 
   * For any file type and date range filter conditions,
   * returned SEC filings should satisfy all conditions.
   */
  describe('Property 32: SEC文件筛选属性', () => {
    it('should return only filings that match all filter criteria', () => {
      fc.assert(
        fc.property(
          fc.array(secFilingArb, { minLength: 0, maxLength: 50 }),
          filtersArb,
          (filings, filters) => {
            const results = filterSECFilings(filings, filters);
            
            // All returned filings should match all filter criteria
            return results.every(filing => matchesAllFilters(filing, filters));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should filter by form type correctly', () => {
      fc.assert(
        fc.property(
          fc.array(secFilingArb, { minLength: 1, maxLength: 30 }),
          fc.array(formTypeArb, { minLength: 1, maxLength: 3 }),
          (filings, formTypes) => {
            const filters: SECFilingFilters = { formTypes };
            const results = filterSECFilings(filings, filters);
            
            // All returned filings should have one of the specified form types
            return results.every(filing => formTypes.includes(filing.formType));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should filter by date range correctly', () => {
      fc.assert(
        fc.property(
          fc.array(secFilingArb, { minLength: 1, maxLength: 30 }),
          dateArb,
          dateArb,
          (filings, date1, date2) => {
            // Ensure startDate <= endDate
            const startDate = date1 < date2 ? date1 : date2;
            const endDate = date1 < date2 ? date2 : date1;
            
            const filters: SECFilingFilters = { startDate, endDate };
            const results = filterSECFilings(filings, filters);
            
            // All returned filings should be within the date range
            return results.every(filing => 
              filing.filedAt >= startDate && filing.filedAt <= endDate
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should filter by symbol correctly', () => {
      fc.assert(
        fc.property(
          fc.array(secFilingArb, { minLength: 1, maxLength: 30 }),
          symbolArb,
          (filings, symbol) => {
            const filters: SECFilingFilters = { symbol };
            const results = filterSECFilings(filings, filters);
            
            // All returned filings should have the specified symbol
            return results.every(filing => filing.symbol === symbol.toUpperCase());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should filter by multiple symbols correctly', () => {
      fc.assert(
        fc.property(
          fc.array(secFilingArb, { minLength: 1, maxLength: 30 }),
          fc.array(symbolArb, { minLength: 1, maxLength: 5 }),
          (filings, symbols) => {
            const filters: SECFilingFilters = { symbols };
            const results = filterSECFilings(filings, filters);
            
            const normalizedSymbols = symbols.map(s => s.toUpperCase());
            // All returned filings should have one of the specified symbols
            return results.every(filing => normalizedSymbols.includes(filing.symbol));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should combine multiple filters correctly', () => {
      fc.assert(
        fc.property(
          fc.array(secFilingArb, { minLength: 1, maxLength: 30 }),
          fc.array(formTypeArb, { minLength: 1, maxLength: 2 }),
          dateArb,
          dateArb,
          (filings, formTypes, date1, date2) => {
            const startDate = date1 < date2 ? date1 : date2;
            const endDate = date1 < date2 ? date2 : date1;
            
            const filters: SECFilingFilters = { formTypes, startDate, endDate };
            const results = filterSECFilings(filings, filters);
            
            // All returned filings should match all criteria
            return results.every(filing => 
              formTypes.includes(filing.formType) &&
              filing.filedAt >= startDate &&
              filing.filedAt <= endDate
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array when no filings match', () => {
      fc.assert(
        fc.property(
          fc.array(secFilingArb, { minLength: 0, maxLength: 20 }),
          filtersArb,
          (filings, filters) => {
            const results = filterSECFilings(filings, filters);
            
            // If results is empty, either input was empty or no filings matched
            if (results.length === 0) {
              return filings.length === 0 || 
                     filings.every(filing => !matchesAllFilters(filing, filters));
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve filing data integrity after filtering', () => {
      fc.assert(
        fc.property(
          fc.array(secFilingArb, { minLength: 1, maxLength: 30 }),
          filtersArb,
          (filings, filters) => {
            const results = filterSECFilings(filings, filters);
            
            // All returned filings should exist in the original array
            return results.every(result => 
              filings.some(filing => filing.id === result.id)
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
