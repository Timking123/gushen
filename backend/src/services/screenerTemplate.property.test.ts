/**
 * Feature: smart-stock-analyzer, Property 14: 筛选模板持久化属�?(Round-trip)
 *
 * Property: For any 筛选模板，保存后再加载应得到相同的筛选条�?
 *
 * **Validates: Requirements 10.6**
 * - 10.6: WHEN 用户保存筛选条�?THEN Stock_Screener SHALL 将条件组合保存为可复用的筛选模�?
 */

import fc from 'fast-check';
import { ScreenerService, ScreenerFilters } from './screenerService.js';
import { prisma } from '../lib/prisma.js';

// Mock Prisma
jest.mock('../lib/prisma', () => ({
  prisma: {
    screenerTemplate: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// Mock Redis
jest.mock('../lib/redis', () => ({
  redisHelpers: {
    del: jest.fn().mockResolvedValue(undefined),
    getJson: jest.fn().mockResolvedValue(null),
    setJson: jest.fn().mockResolvedValue(undefined),
  },
}));

/**
 * Feature: smart-stock-analyzer, Property 14: 筛选模板持久化属�?
 *
 * Tests that screener templates are correctly persisted and retrieved
 */
describe('Property 14: Screener Template Persistence Property (筛选模板持久化属�?', () => {
  let screenerService: ScreenerService;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    screenerService = new ScreenerService();
    jest.clearAllMocks();
  });

  /**
   * Arbitrary generator for template names (non-empty strings)
   */
  const templateNameArbitrary = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

  /**
   * Arbitrary generator for template descriptions (optional strings)
   */
  const templateDescriptionArbitrary = fc.option(
    fc.string({ minLength: 1, maxLength: 500 }),
    { nil: undefined }
  );

  /**
   * Arbitrary generator for exchange arrays
   */
  const exchangeArbitrary = fc.option(
    fc.subarray(['NYSE', 'NASDAQ', 'AMEX', 'LSE', 'TSE'], { minLength: 1 }),
    { nil: undefined }
  );

  /**
   * Arbitrary generator for sector arrays
   */
  const sectorArbitrary = fc.option(
    fc.subarray(['Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer', 'Industrial'], { minLength: 1 }),
    { nil: undefined }
  );

  /**
   * Arbitrary generator for industry arrays
   */
  const industryArbitrary = fc.option(
    fc.subarray(['Software', 'Biotech', 'Banking', 'Oil & Gas', 'Retail', 'Automotive'], { minLength: 1 }),
    { nil: undefined }
  );

  /**
   * Arbitrary generator for country arrays
   */
  const countryArbitrary = fc.option(
    fc.subarray(['US', 'UK', 'CN', 'JP', 'DE', 'FR', 'CA'], { minLength: 1 }),
    { nil: undefined }
  );

  /**
   * Arbitrary generator for positive numbers (market cap, etc.)
   */
  const positiveNumberArbitrary = fc.option(
    fc.integer({ min: 1000000, max: 5000000000000 }),
    { nil: undefined }
  );

  /**
   * Arbitrary generator for float values with reasonable ranges
   */
  const floatArbitrary = (min: number, max: number) => fc.option(
    fc.float({ min, max, noNaN: true }).map(v => Math.round(v * 100) / 100), // Round to 2 decimal places
    { nil: undefined }
  );

  /**
   * Arbitrary generator for boolean options
   */
  const booleanOptionArbitrary = fc.option(fc.boolean(), { nil: undefined });

  /**
   * Arbitrary generator for sort order
   */
  const sortOrderArbitrary = fc.option(
    fc.constantFrom('asc', 'desc') as fc.Arbitrary<'asc' | 'desc'>,
    { nil: undefined }
  );

  /**
   * Arbitrary generator for sortBy field
   */
  const sortByArbitrary = fc.option(
    fc.constantFrom(
      'symbol', 'name', 'marketCap', 'price', 'changePercent', 'volume',
      'pe', 'epsGrowth', 'dividendYield', 'debtToEquity', 'revenueGrowth',
      'roe', 'rsi14', 'sma20', 'sma50', 'sma200'
    ),
    { nil: undefined }
  );

  /**
   * Arbitrary generator for complete ScreenerFilters
   * Generates valid filter combinations for testing
   */
  const screenerFiltersArbitrary: fc.Arbitrary<ScreenerFilters> = fc.record({
    // Descriptive filters (Requirement 10.2)
    exchange: exchangeArbitrary,
    sector: sectorArbitrary,
    industry: industryArbitrary,
    country: countryArbitrary,
    marketCapMin: positiveNumberArbitrary,
    marketCapMax: positiveNumberArbitrary,

    // Fundamental filters (Requirement 10.3)
    peMin: floatArbitrary(1, 50),
    peMax: floatArbitrary(50, 200),
    epsGrowthMin: floatArbitrary(-50, 100),
    dividendYieldMin: floatArbitrary(0, 10),
    debtToEquityMax: floatArbitrary(0, 5),
    revenueGrowthMin: floatArbitrary(-50, 100),
    roeMin: floatArbitrary(-50, 50),
    currentRatioMin: floatArbitrary(0, 5),

    // Technical filters (Requirement 10.4)
    rsiMin: floatArbitrary(0, 50),
    rsiMax: floatArbitrary(50, 100),
    priceAboveSma20: booleanOptionArbitrary,
    priceAboveSma50: booleanOptionArbitrary,
    priceAboveSma200: booleanOptionArbitrary,
    volumeAboveAvg: booleanOptionArbitrary,

    // Sorting (Requirement 10.7)
    sortBy: sortByArbitrary,
    sortOrder: sortOrderArbitrary,

    // Pagination
    page: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
    limit: fc.option(fc.integer({ min: 10, max: 100 }), { nil: undefined }),
  }, { requiredKeys: [] });

  /**
   * Helper function to clean undefined values from filters
   * This simulates what happens during JSON serialization
   */
  function cleanFilters(filters: ScreenerFilters): ScreenerFilters {
    const cleaned: ScreenerFilters = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined) {
        (cleaned as any)[key] = value;
      }
    }
    return cleaned;
  }

  /**
   * Helper function to compare two filter objects
   * Handles undefined vs missing keys and floating point comparison
   */
  function filtersAreEqual(a: ScreenerFilters, b: ScreenerFilters): boolean {
    const cleanedA = cleanFilters(a);
    const cleanedB = cleanFilters(b);

    const keysA = Object.keys(cleanedA).sort();
    const keysB = Object.keys(cleanedB).sort();

    if (keysA.length !== keysB.length) {
      return false;
    }

    for (const key of keysA) {
      if (!keysB.includes(key)) {
        return false;
      }

      const valueA = (cleanedA as any)[key];
      const valueB = (cleanedB as any)[key];

      // Handle array comparison
      if (Array.isArray(valueA) && Array.isArray(valueB)) {
        if (valueA.length !== valueB.length) {
          return false;
        }
        const sortedA = [...valueA].sort();
        const sortedB = [...valueB].sort();
        for (let i = 0; i < sortedA.length; i++) {
          if (sortedA[i] !== sortedB[i]) {
            return false;
          }
        }
      }
      // Handle floating point comparison
      else if (typeof valueA === 'number' && typeof valueB === 'number') {
        if (Math.abs(valueA - valueB) > 0.01) {
          return false;
        }
      }
      // Handle other values
      else if (valueA !== valueB) {
        return false;
      }
    }

    return true;
  }

  /**
   * Core property test: Template round-trip persistence
   * **Validates: Requirements 10.6**
   *
   * For any screener template, saving and then loading should return
   * the same template name, description, and filters.
   */
  it('should preserve template name, description, and filters after save and load (round-trip)', async () => {
    await fc.assert(
      fc.asyncProperty(
        templateNameArbitrary,
        templateDescriptionArbitrary,
        screenerFiltersArbitrary,
        async (name, description, filters) => {
          // Setup: Mock database storage
          let storedTemplate: any = null;
          const templateId = `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          (prisma.screenerTemplate.create as jest.Mock).mockImplementation(async ({ data }) => {
            storedTemplate = {
              id: templateId,
              userId: data.userId,
              name: data.name,
              description: data.description,
              filters: data.filters,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            return storedTemplate;
          });

          (prisma.screenerTemplate.findFirst as jest.Mock).mockImplementation(async ({ where }) => {
            if (storedTemplate && where.id === templateId && where.userId === testUserId) {
              return storedTemplate;
            }
            return null;
          });

          // Act: Save template
          const savedTemplate = await screenerService.saveTemplate(testUserId, {
            name,
            description,
            filters: cleanFilters(filters),
          });

          // Act: Load template
          const loadedTemplate = await screenerService.getTemplate(testUserId, savedTemplate.id);

          // Assert: Template should be found
          expect(loadedTemplate).not.toBeNull();

          // Assert: Name should be preserved
          expect(loadedTemplate!.name).toBe(name);

          // Assert: Description should be preserved
          expect(loadedTemplate!.description).toBe(description || null);

          // Assert: Filters should be preserved
          expect(filtersAreEqual(loadedTemplate!.filters, cleanFilters(filters))).toBe(true);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property test: Multiple templates round-trip
   * **Validates: Requirements 10.6**
   *
   * Saving multiple templates and loading them all should return
   * all templates with correct data.
   */
  it('should preserve multiple templates after save and getTemplates (round-trip)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: templateNameArbitrary,
            description: templateDescriptionArbitrary,
            filters: screenerFiltersArbitrary,
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (templates) => {
          // Setup: Mock database storage
          const storedTemplates: any[] = [];

          (prisma.screenerTemplate.create as jest.Mock).mockImplementation(async ({ data }) => {
            const template = {
              id: `template-${storedTemplates.length}-${Date.now()}`,
              userId: data.userId,
              name: data.name,
              description: data.description,
              filters: data.filters,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            storedTemplates.push(template);
            return template;
          });

          (prisma.screenerTemplate.findMany as jest.Mock).mockImplementation(async ({ where }) => {
            if (where.userId === testUserId) {
              return [...storedTemplates].reverse(); // Simulate orderBy: { createdAt: 'desc' }
            }
            return [];
          });

          // Act: Save all templates
          for (const template of templates) {
            await screenerService.saveTemplate(testUserId, {
              name: template.name,
              description: template.description,
              filters: cleanFilters(template.filters),
            });
          }

          // Act: Load all templates
          const loadedTemplates = await screenerService.getTemplates(testUserId);

          // Assert: Should have same number of templates
          expect(loadedTemplates.length).toBe(templates.length);

          // Assert: Each template should be preserved (in reverse order due to sorting)
          for (let i = 0; i < templates.length; i++) {
            const original = templates[templates.length - 1 - i]; // Reverse order
            const loaded = loadedTemplates[i];

            expect(loaded.name).toBe(original.name);
            expect(loaded.description).toBe(original.description || null);
            expect(filtersAreEqual(loaded.filters, cleanFilters(original.filters))).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property test: Descriptive filters persistence
   * **Validates: Requirements 10.6**
   *
   * Descriptive filters (exchange, sector, industry, country, marketCap)
   * should be preserved after save and load.
   */
  it('should preserve descriptive filters after save and load', async () => {
    await fc.assert(
      fc.asyncProperty(
        templateNameArbitrary,
        exchangeArbitrary,
        sectorArbitrary,
        industryArbitrary,
        countryArbitrary,
        positiveNumberArbitrary,
        positiveNumberArbitrary,
        async (name, exchange, sector, industry, country, marketCapMin, marketCapMax) => {
          const filters: ScreenerFilters = cleanFilters({
            exchange,
            sector,
            industry,
            country,
            marketCapMin,
            marketCapMax,
          });

          // Setup: Mock database storage
          let storedTemplate: any = null;
          const templateId = `template-${Date.now()}`;

          (prisma.screenerTemplate.create as jest.Mock).mockImplementation(async ({ data }) => {
            storedTemplate = {
              id: templateId,
              userId: data.userId,
              name: data.name,
              description: data.description,
              filters: data.filters,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            return storedTemplate;
          });

          (prisma.screenerTemplate.findFirst as jest.Mock).mockImplementation(async () => storedTemplate);

          // Act: Save and load
          const saved = await screenerService.saveTemplate(testUserId, { name, filters });
          const loaded = await screenerService.getTemplate(testUserId, saved.id);

          // Assert: Descriptive filters should be preserved
          expect(loaded).not.toBeNull();
          expect(filtersAreEqual(loaded!.filters, filters)).toBe(true);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property test: Fundamental filters persistence
   * **Validates: Requirements 10.6**
   *
   * Fundamental filters (P/E, EPS growth, dividend yield, etc.)
   * should be preserved after save and load.
   */
  it('should preserve fundamental filters after save and load', async () => {
    await fc.assert(
      fc.asyncProperty(
        templateNameArbitrary,
        floatArbitrary(1, 50),
        floatArbitrary(50, 200),
        floatArbitrary(-50, 100),
        floatArbitrary(0, 10),
        floatArbitrary(0, 5),
        floatArbitrary(-50, 100),
        floatArbitrary(-50, 50),
        async (name, peMin, peMax, epsGrowthMin, dividendYieldMin, debtToEquityMax, revenueGrowthMin, roeMin) => {
          const filters: ScreenerFilters = cleanFilters({
            peMin,
            peMax,
            epsGrowthMin,
            dividendYieldMin,
            debtToEquityMax,
            revenueGrowthMin,
            roeMin,
          });

          // Setup: Mock database storage
          let storedTemplate: any = null;
          const templateId = `template-${Date.now()}`;

          (prisma.screenerTemplate.create as jest.Mock).mockImplementation(async ({ data }) => {
            storedTemplate = {
              id: templateId,
              userId: data.userId,
              name: data.name,
              description: data.description,
              filters: data.filters,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            return storedTemplate;
          });

          (prisma.screenerTemplate.findFirst as jest.Mock).mockImplementation(async () => storedTemplate);

          // Act: Save and load
          const saved = await screenerService.saveTemplate(testUserId, { name, filters });
          const loaded = await screenerService.getTemplate(testUserId, saved.id);

          // Assert: Fundamental filters should be preserved
          expect(loaded).not.toBeNull();
          expect(filtersAreEqual(loaded!.filters, filters)).toBe(true);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property test: Technical filters persistence
   * **Validates: Requirements 10.6**
   *
   * Technical filters (RSI, SMA comparisons, volume)
   * should be preserved after save and load.
   */
  it('should preserve technical filters after save and load', async () => {
    await fc.assert(
      fc.asyncProperty(
        templateNameArbitrary,
        floatArbitrary(0, 50),
        floatArbitrary(50, 100),
        booleanOptionArbitrary,
        booleanOptionArbitrary,
        booleanOptionArbitrary,
        booleanOptionArbitrary,
        async (name, rsiMin, rsiMax, priceAboveSma20, priceAboveSma50, priceAboveSma200, volumeAboveAvg) => {
          const filters: ScreenerFilters = cleanFilters({
            rsiMin,
            rsiMax,
            priceAboveSma20,
            priceAboveSma50,
            priceAboveSma200,
            volumeAboveAvg,
          });

          // Setup: Mock database storage
          let storedTemplate: any = null;
          const templateId = `template-${Date.now()}`;

          (prisma.screenerTemplate.create as jest.Mock).mockImplementation(async ({ data }) => {
            storedTemplate = {
              id: templateId,
              userId: data.userId,
              name: data.name,
              description: data.description,
              filters: data.filters,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            return storedTemplate;
          });

          (prisma.screenerTemplate.findFirst as jest.Mock).mockImplementation(async () => storedTemplate);

          // Act: Save and load
          const saved = await screenerService.saveTemplate(testUserId, { name, filters });
          const loaded = await screenerService.getTemplate(testUserId, saved.id);

          // Assert: Technical filters should be preserved
          expect(loaded).not.toBeNull();
          expect(filtersAreEqual(loaded!.filters, filters)).toBe(true);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property test: Sorting options persistence
   * **Validates: Requirements 10.6**
   *
   * Sorting options (sortBy, sortOrder) should be preserved after save and load.
   */
  it('should preserve sorting options after save and load', async () => {
    await fc.assert(
      fc.asyncProperty(
        templateNameArbitrary,
        sortByArbitrary,
        sortOrderArbitrary,
        async (name, sortBy, sortOrder) => {
          const filters: ScreenerFilters = cleanFilters({
            sortBy,
            sortOrder,
          });

          // Setup: Mock database storage
          let storedTemplate: any = null;
          const templateId = `template-${Date.now()}`;

          (prisma.screenerTemplate.create as jest.Mock).mockImplementation(async ({ data }) => {
            storedTemplate = {
              id: templateId,
              userId: data.userId,
              name: data.name,
              description: data.description,
              filters: data.filters,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            return storedTemplate;
          });

          (prisma.screenerTemplate.findFirst as jest.Mock).mockImplementation(async () => storedTemplate);

          // Act: Save and load
          const saved = await screenerService.saveTemplate(testUserId, { name, filters });
          const loaded = await screenerService.getTemplate(testUserId, saved.id);

          // Assert: Sorting options should be preserved
          expect(loaded).not.toBeNull();
          expect(filtersAreEqual(loaded!.filters, filters)).toBe(true);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property test: Empty filters persistence
   * **Validates: Requirements 10.6**
   *
   * A template with empty filters should be preserved correctly.
   */
  it('should preserve template with empty filters', async () => {
    await fc.assert(
      fc.asyncProperty(
        templateNameArbitrary,
        templateDescriptionArbitrary,
        async (name, description) => {
          const filters: ScreenerFilters = {};

          // Setup: Mock database storage
          let storedTemplate: any = null;
          const templateId = `template-${Date.now()}`;

          (prisma.screenerTemplate.create as jest.Mock).mockImplementation(async ({ data }) => {
            storedTemplate = {
              id: templateId,
              userId: data.userId,
              name: data.name,
              description: data.description,
              filters: data.filters,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            return storedTemplate;
          });

          (prisma.screenerTemplate.findFirst as jest.Mock).mockImplementation(async () => storedTemplate);

          // Act: Save and load
          const saved = await screenerService.saveTemplate(testUserId, { name, description, filters });
          const loaded = await screenerService.getTemplate(testUserId, saved.id);

          // Assert: Template should be preserved with empty filters
          expect(loaded).not.toBeNull();
          expect(loaded!.name).toBe(name);
          expect(loaded!.description).toBe(description || null);
          expect(Object.keys(loaded!.filters).length).toBe(0);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property test: Combined filters persistence
   * **Validates: Requirements 10.6**
   *
   * A template with all three filter types (descriptive, fundamental, technical)
   * should be preserved correctly.
   */
  it('should preserve template with all filter types combined', async () => {
    await fc.assert(
      fc.asyncProperty(
        templateNameArbitrary,
        templateDescriptionArbitrary,
        // Descriptive
        exchangeArbitrary,
        sectorArbitrary,
        // Fundamental
        floatArbitrary(1, 50),
        floatArbitrary(0, 10),
        // Technical
        floatArbitrary(0, 50),
        booleanOptionArbitrary,
        // Sorting
        sortByArbitrary,
        sortOrderArbitrary,
        async (name, description, exchange, sector, peMin, dividendYieldMin, rsiMin, priceAboveSma20, sortBy, sortOrder) => {
          const filters: ScreenerFilters = cleanFilters({
            exchange,
            sector,
            peMin,
            dividendYieldMin,
            rsiMin,
            priceAboveSma20,
            sortBy,
            sortOrder,
          });

          // Setup: Mock database storage
          let storedTemplate: any = null;
          const templateId = `template-${Date.now()}`;

          (prisma.screenerTemplate.create as jest.Mock).mockImplementation(async ({ data }) => {
            storedTemplate = {
              id: templateId,
              userId: data.userId,
              name: data.name,
              description: data.description,
              filters: data.filters,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            return storedTemplate;
          });

          (prisma.screenerTemplate.findFirst as jest.Mock).mockImplementation(async () => storedTemplate);

          // Act: Save and load
          const saved = await screenerService.saveTemplate(testUserId, { name, description, filters });
          const loaded = await screenerService.getTemplate(testUserId, saved.id);

          // Assert: All filters should be preserved
          expect(loaded).not.toBeNull();
          expect(loaded!.name).toBe(name);
          expect(loaded!.description).toBe(description || null);
          expect(filtersAreEqual(loaded!.filters, filters)).toBe(true);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property test: Template update round-trip
   * **Validates: Requirements 10.6**
   *
   * Updating a template and loading it should return the updated values.
   */
  it('should preserve updated template after update and load (round-trip)', async () => {
    await fc.assert(
      fc.asyncProperty(
        templateNameArbitrary,
        templateNameArbitrary,
        screenerFiltersArbitrary,
        screenerFiltersArbitrary,
        async (originalName, updatedName, originalFilters, updatedFilters) => {
          // Setup: Mock database storage
          let storedTemplate: any = null;
          const templateId = `template-${Date.now()}`;

          (prisma.screenerTemplate.create as jest.Mock).mockImplementation(async ({ data }) => {
            storedTemplate = {
              id: templateId,
              userId: data.userId,
              name: data.name,
              description: data.description,
              filters: data.filters,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            return storedTemplate;
          });

          (prisma.screenerTemplate.findFirst as jest.Mock).mockImplementation(async ({ where }) => {
            if (storedTemplate && where.id === templateId && where.userId === testUserId) {
              return storedTemplate;
            }
            return null;
          });

          (prisma.screenerTemplate.update as jest.Mock).mockImplementation(async ({ data }) => {
            storedTemplate = {
              ...storedTemplate,
              name: data.name !== undefined ? data.name : storedTemplate.name,
              description: data.description !== undefined ? data.description : storedTemplate.description,
              filters: data.filters !== undefined ? data.filters : storedTemplate.filters,
              updatedAt: new Date(),
            };
            return storedTemplate;
          });

          // Act: Save original template
          const saved = await screenerService.saveTemplate(testUserId, {
            name: originalName,
            filters: cleanFilters(originalFilters),
          });

          // Act: Update template
          await screenerService.updateTemplate(testUserId, saved.id, {
            name: updatedName,
            filters: cleanFilters(updatedFilters),
          });

          // Act: Load updated template
          const loaded = await screenerService.getTemplate(testUserId, saved.id);

          // Assert: Updated values should be preserved
          expect(loaded).not.toBeNull();
          expect(loaded!.name).toBe(updatedName);
          expect(filtersAreEqual(loaded!.filters, cleanFilters(updatedFilters))).toBe(true);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });
});
