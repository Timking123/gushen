/**
 * Property-Based Tests for Quant Rating Ranking
 * Feature: smart-stock-analyzer, Property 20: 量化评级排名属�?
 * 
 * **Validates: Requirements 13.4**
 * 
 * Property: For any set of stocks within a sector or industry, rankings should be
 * consistent with the descending order of overall scores (rank 1 = highest score).
 * 
 * Requirements:
 * - 13.4: WHEN 用户查看股票 THEN Quant_Rating SHALL 显示该股票在板块和行业中的排�?
 */

import fc from 'fast-check';
import { describe, it, expect } from '@jest/globals';

/**
 * Stock rating data for ranking tests
 */
interface StockRating {
  symbol: string;
  overallScore: number;
  sector: string | null;
  industry: string | null;
}

/**
 * Ranked stock with assigned rank
 */
interface RankedStock extends StockRating {
  sectorRank: number | null;
  industryRank: number | null;
}

/**
 * Calculate rankings for stocks within a sector
 * Rankings are assigned in descending order of overall score (rank 1 = highest score)
 * 
 * @param stocks - Array of stock ratings
 * @param sector - Sector to rank within
 * @returns Array of stocks with sector ranks assigned
 */
function calculateSectorRankings(stocks: StockRating[], sector: string): RankedStock[] {
  // Filter stocks in the specified sector
  const sectorStocks = stocks.filter(s => s.sector === sector);
  
  // Sort by overall score descending
  const sorted = [...sectorStocks].sort((a, b) => b.overallScore - a.overallScore);

  // Assign ranks (1-based)
  const rankedStocks: RankedStock[] = sorted.map((stock, index) => ({
    ...stock,
    sectorRank: index + 1,
    industryRank: null,
  }));
  
  // Return all stocks with ranks (non-sector stocks get null rank)
  return stocks.map(stock => {
    const ranked = rankedStocks.find(r => r.symbol === stock.symbol);
    return ranked || { ...stock, sectorRank: null, industryRank: null };
  });
}

/**
 * Calculate rankings for stocks within an industry
 * Rankings are assigned in descending order of overall score (rank 1 = highest score)
 * 
 * @param stocks - Array of stock ratings
 * @param industry - Industry to rank within
 * @returns Array of stocks with industry ranks assigned
 */
function calculateIndustryRankings(stocks: StockRating[], industry: string): RankedStock[] {
  // Filter stocks in the specified industry
  const industryStocks = stocks.filter(s => s.industry === industry);
  
  // Sort by overall score descending
  const sorted = [...industryStocks].sort((a, b) => b.overallScore - a.overallScore);
  
  // Assign ranks (1-based)
  const rankedStocks: RankedStock[] = sorted.map((stock, index) => ({
    ...stock,
    sectorRank: null,
    industryRank: index + 1,
  }));
  
  // Return all stocks with ranks (non-industry stocks get null rank)
  return stocks.map(stock => {
    const ranked = rankedStocks.find(r => r.symbol === stock.symbol);
    return ranked || { ...stock, sectorRank: null, industryRank: null };
  });
}

/**
 * Calculate both sector and industry rankings for all stocks
 * 
 * @param stocks - Array of stock ratings
 * @returns Array of stocks with both sector and industry ranks assigned
 */
function calculateAllRankings(stocks: StockRating[]): RankedStock[] {
  // Get unique sectors and industries
  const sectors = [...new Set(stocks.map(s => s.sector).filter((s): s is string => s !== null))];
  const industries = [...new Set(stocks.map(s => s.industry).filter((i): i is string => i !== null))];

  // Initialize result with null ranks
  const result: RankedStock[] = stocks.map(stock => ({
    ...stock,
    sectorRank: null,
    industryRank: null,
  }));
  
  // Calculate sector rankings
  for (const sector of sectors) {
    const sectorStocks = stocks.filter(s => s.sector === sector);
    const sorted = [...sectorStocks].sort((a, b) => b.overallScore - a.overallScore);
    
    sorted.forEach((stock, index) => {
      const resultStock = result.find(r => r.symbol === stock.symbol);
      if (resultStock) {
        resultStock.sectorRank = index + 1;
      }
    });
  }
  
  // Calculate industry rankings
  for (const industry of industries) {
    const industryStocks = stocks.filter(s => s.industry === industry);
    const sorted = [...industryStocks].sort((a, b) => b.overallScore - a.overallScore);
    
    sorted.forEach((stock, index) => {
      const resultStock = result.find(r => r.symbol === stock.symbol);
      if (resultStock) {
        resultStock.industryRank = index + 1;
      }
    });
  }
  
  return result;
}

// ============================================
// Arbitrary Generators
// ============================================

/**
 * Arbitrary generator for stock symbols (unique uppercase letters)
 */
const symbolArbitrary = fc.stringMatching(/^[A-Z]{1,5}$/);

/**
 * Arbitrary generator for overall scores (1-5 range)
 */
const overallScoreArbitrary = fc.integer({ min: 100, max: 500 }).map(cents => cents / 100);

/**
 * Arbitrary generator for sector names
 */
const sectorArbitrary = fc.constantFrom(
  'Technology',
  'Healthcare',
  'Financial',
  'Consumer',
  'Energy',
  'Industrial',
  'Materials',
  'Utilities',
  'Real Estate',
  'Communication'
);


/**
 * Arbitrary generator for industry names
 */
const industryArbitrary = fc.constantFrom(
  'Software',
  'Hardware',
  'Semiconductors',
  'Biotechnology',
  'Pharmaceuticals',
  'Banks',
  'Insurance',
  'Retail',
  'Oil & Gas',
  'Aerospace'
);

/**
 * Arbitrary generator for a single stock rating
 */
const stockRatingArbitrary = fc.record({
  symbol: symbolArbitrary,
  overallScore: overallScoreArbitrary,
  sector: fc.option(sectorArbitrary, { nil: null }),
  industry: fc.option(industryArbitrary, { nil: null }),
});

/**
 * Arbitrary generator for a list of stock ratings with unique symbols
 */
const stockRatingsListArbitrary = fc.array(stockRatingArbitrary, { minLength: 2, maxLength: 50 })
  .map(stocks => {
    // Ensure unique symbols
    const seen = new Set<string>();
    return stocks.filter(stock => {
      if (seen.has(stock.symbol)) {
        return false;
      }
      seen.add(stock.symbol);
      return true;
    });
  })
  .filter(stocks => stocks.length >= 2);

/**
 * Arbitrary generator for stocks in the same sector
 */
const sameSectorStocksArbitrary = fc.tuple(
  sectorArbitrary,
  fc.array(
    fc.record({
      symbol: symbolArbitrary,
      overallScore: overallScoreArbitrary,
    }),
    { minLength: 2, maxLength: 20 }
  )
).map(([sector, baseStocks]) => {
  // Ensure unique symbols
  const seen = new Set<string>();
  const uniqueStocks = baseStocks.filter(stock => {
    if (seen.has(stock.symbol)) {
      return false;
    }
    seen.add(stock.symbol);
    return true;
  });

  return {
    sector,
    stocks: uniqueStocks.map(s => ({
      ...s,
      sector,
      industry: null,
    })) as StockRating[],
  };
}).filter(data => data.stocks.length >= 2);

/**
 * Arbitrary generator for stocks in the same industry
 */
const sameIndustryStocksArbitrary = fc.tuple(
  industryArbitrary,
  fc.array(
    fc.record({
      symbol: symbolArbitrary,
      overallScore: overallScoreArbitrary,
    }),
    { minLength: 2, maxLength: 20 }
  )
).map(([industry, baseStocks]) => {
  // Ensure unique symbols
  const seen = new Set<string>();
  const uniqueStocks = baseStocks.filter(stock => {
    if (seen.has(stock.symbol)) {
      return false;
    }
    seen.add(stock.symbol);
    return true;
  });
  
  return {
    industry,
    stocks: uniqueStocks.map(s => ({
      ...s,
      sector: null,
      industry,
    })) as StockRating[],
  };
}).filter(data => data.stocks.length >= 2);

// ============================================
// Property Tests
// ============================================

describe('Property 20: 量化评级排名属性', () => {
  /**
   * Test 1: Rankings should be assigned in descending order of overall score
   * Rank 1 = highest score
   * 
   * **Validates: Requirements 13.4**
   */
  it('should assign rank 1 to the stock with highest overall score in sector', () => {
    fc.assert(
      fc.property(
        sameSectorStocksArbitrary,
        ({ sector, stocks }) => {
          const ranked = calculateSectorRankings(stocks, sector);
          
          // Find the stock with highest score
          const highestScoreStock = stocks.reduce((max, stock) => 
            stock.overallScore > max.overallScore ? stock : max
          );
          
          // Find its rank
          const rankedHighest = ranked.find(r => r.symbol === highestScoreStock.symbol);
          
          // Property: highest score stock should have rank 1
          expect(rankedHighest).toBeDefined();
          expect(rankedHighest!.sectorRank).toBe(1);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });


  /**
   * Test 2: Stocks with higher overall scores should have lower (better) ranks
   * 
   * **Validates: Requirements 13.4**
   */
  it('should assign lower ranks to stocks with higher overall scores', () => {
    fc.assert(
      fc.property(
        sameSectorStocksArbitrary,
        ({ sector, stocks }) => {
          const ranked = calculateSectorRankings(stocks, sector);
          
          // For any two stocks in the same sector
          for (let i = 0; i < ranked.length; i++) {
            for (let j = i + 1; j < ranked.length; j++) {
              const stockA = ranked[i];
              const stockB = ranked[j];
              
              // Skip if either doesn't have a sector rank
              if (stockA.sectorRank === null || stockB.sectorRank === null) continue;
              
              // Property: if stockA has higher score, it should have lower (better) rank
              if (stockA.overallScore > stockB.overallScore) {
                expect(stockA.sectorRank).toBeLessThan(stockB.sectorRank);
              } else if (stockA.overallScore < stockB.overallScore) {
                expect(stockA.sectorRank).toBeGreaterThan(stockB.sectorRank);
              }
              // Equal scores can have any relative ranking
            }
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 3: All ranks within a sector should be unique and consecutive starting from 1
   * 
   * **Validates: Requirements 13.4**
   */
  it('should have unique and consecutive ranks starting from 1 within sector', () => {
    fc.assert(
      fc.property(
        sameSectorStocksArbitrary,
        ({ sector, stocks }) => {
          const ranked = calculateSectorRankings(stocks, sector);
          
          // Get all sector ranks (excluding nulls)
          const sectorRanks = ranked
            .filter(r => r.sectorRank !== null)
            .map(r => r.sectorRank as number)
            .sort((a, b) => a - b);
          
          // Property: ranks should start from 1
          if (sectorRanks.length > 0) {
            expect(sectorRanks[0]).toBe(1);
          }
          
          // Property: ranks should be consecutive (1, 2, 3, ...)
          for (let i = 0; i < sectorRanks.length; i++) {
            expect(sectorRanks[i]).toBe(i + 1);
          }
          
          // Property: ranks should be unique (no duplicates)
          const uniqueRanks = new Set(sectorRanks);
          expect(uniqueRanks.size).toBe(sectorRanks.length);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });


  /**
   * Test 4: Rank should be null when stock is not in any sector
   * 
   * **Validates: Requirements 13.4**
   */
  it('should have null sector rank when stock has no sector', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            symbol: symbolArbitrary,
            overallScore: overallScoreArbitrary,
            sector: fc.constant(null as string | null),
            industry: fc.option(industryArbitrary, { nil: null }),
          }),
          { minLength: 1, maxLength: 10 }
        ).map(stocks => {
          // Ensure unique symbols
          const seen = new Set<string>();
          return stocks.filter(stock => {
            if (seen.has(stock.symbol)) return false;
            seen.add(stock.symbol);
            return true;
          });
        }).filter(stocks => stocks.length >= 1),
        (stocks) => {
          const ranked = calculateAllRankings(stocks);
          
          // Property: all stocks without sector should have null sectorRank
          for (const stock of ranked) {
            if (stock.sector === null) {
              expect(stock.sectorRank).toBeNull();
            }
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 5: Rank should be null when stock is not in any industry
   * 
   * **Validates: Requirements 13.4**
   */
  it('should have null industry rank when stock has no industry', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            symbol: symbolArbitrary,
            overallScore: overallScoreArbitrary,
            sector: fc.option(sectorArbitrary, { nil: null }),
            industry: fc.constant(null as string | null),
          }),
          { minLength: 1, maxLength: 10 }
        ).map(stocks => {
          // Ensure unique symbols
          const seen = new Set<string>();
          return stocks.filter(stock => {
            if (seen.has(stock.symbol)) return false;
            seen.add(stock.symbol);
            return true;
          });
        }).filter(stocks => stocks.length >= 1),
        (stocks) => {
          const ranked = calculateAllRankings(stocks);
          
          // Property: all stocks without industry should have null industryRank
          for (const stock of ranked) {
            if (stock.industry === null) {
              expect(stock.industryRank).toBeNull();
            }
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });


  /**
   * Test 6: Ranking should be consistent - same scores should produce same relative rankings
   * 
   * **Validates: Requirements 13.4**
   */
  it('should produce consistent rankings for same input data', () => {
    fc.assert(
      fc.property(
        sameSectorStocksArbitrary,
        ({ sector, stocks }) => {
          // Calculate rankings twice
          const ranked1 = calculateSectorRankings(stocks, sector);
          const ranked2 = calculateSectorRankings(stocks, sector);
          
          // Property: rankings should be identical for same input
          for (const stock of stocks) {
            const rank1 = ranked1.find(r => r.symbol === stock.symbol)?.sectorRank;
            const rank2 = ranked2.find(r => r.symbol === stock.symbol)?.sectorRank;
            expect(rank1).toBe(rank2);
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 7: Industry rankings should follow same rules as sector rankings
   * 
   * **Validates: Requirements 13.4**
   */
  it('should assign rank 1 to the stock with highest overall score in industry', () => {
    fc.assert(
      fc.property(
        sameIndustryStocksArbitrary,
        ({ industry, stocks }) => {
          const ranked = calculateIndustryRankings(stocks, industry);
          
          // Find the stock with highest score
          const highestScoreStock = stocks.reduce((max, stock) => 
            stock.overallScore > max.overallScore ? stock : max
          );
          
          // Find its rank
          const rankedHighest = ranked.find(r => r.symbol === highestScoreStock.symbol);
          
          // Property: highest score stock should have rank 1
          expect(rankedHighest).toBeDefined();
          expect(rankedHighest!.industryRank).toBe(1);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 8: Industry ranks should be unique and consecutive
   * 
   * **Validates: Requirements 13.4**
   */
  it('should have unique and consecutive ranks starting from 1 within industry', () => {
    fc.assert(
      fc.property(
        sameIndustryStocksArbitrary,
        ({ industry, stocks }) => {
          const ranked = calculateIndustryRankings(stocks, industry);
          
          // Get all industry ranks (excluding nulls)
          const industryRanks = ranked
            .filter(r => r.industryRank !== null)
            .map(r => r.industryRank as number)
            .sort((a, b) => a - b);
          
          // Property: ranks should start from 1
          if (industryRanks.length > 0) {
            expect(industryRanks[0]).toBe(1);
          }
          
          // Property: ranks should be consecutive
          for (let i = 0; i < industryRanks.length; i++) {
            expect(industryRanks[i]).toBe(i + 1);
          }
          
          // Property: ranks should be unique
          const uniqueRanks = new Set(industryRanks);
          expect(uniqueRanks.size).toBe(industryRanks.length);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });


  /**
   * Test 9: Stocks in different sectors should have independent rankings
   * 
   * **Validates: Requirements 13.4**
   */
  it('should have independent rankings for different sectors', () => {
    fc.assert(
      fc.property(
        stockRatingsListArbitrary.filter(stocks => {
          // Ensure we have stocks in at least 2 different sectors
          const sectors = new Set(stocks.map(s => s.sector).filter(s => s !== null));
          return sectors.size >= 2;
        }),
        (stocks) => {
          const ranked = calculateAllRankings(stocks);
          
          // Group by sector
          const bySector = new Map<string, RankedStock[]>();
          for (const stock of ranked) {
            if (stock.sector !== null) {
              const sectorStocks = bySector.get(stock.sector) || [];
              sectorStocks.push(stock);
              bySector.set(stock.sector, sectorStocks);
            }
          }
          
          // Property: each sector should have its own ranking starting from 1
          for (const [, sectorStocks] of bySector) {
            const ranks = sectorStocks
              .map(s => s.sectorRank)
              .filter((r): r is number => r !== null)
              .sort((a, b) => a - b);
            
            if (ranks.length > 0) {
              expect(ranks[0]).toBe(1);
              for (let i = 0; i < ranks.length; i++) {
                expect(ranks[i]).toBe(i + 1);
              }
            }
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 10: Stocks in different industries should have independent rankings
   * 
   * **Validates: Requirements 13.4**
   */
  it('should have independent rankings for different industries', () => {
    fc.assert(
      fc.property(
        stockRatingsListArbitrary.filter(stocks => {
          // Ensure we have stocks in at least 2 different industries
          const industries = new Set(stocks.map(s => s.industry).filter(i => i !== null));
          return industries.size >= 2;
        }),
        (stocks) => {
          const ranked = calculateAllRankings(stocks);
          
          // Group by industry
          const byIndustry = new Map<string, RankedStock[]>();
          for (const stock of ranked) {
            if (stock.industry !== null) {
              const industryStocks = byIndustry.get(stock.industry) || [];
              industryStocks.push(stock);
              byIndustry.set(stock.industry, industryStocks);
            }
          }
          
          // Property: each industry should have its own ranking starting from 1
          for (const [, industryStocks] of byIndustry) {
            const ranks = industryStocks
              .map(s => s.industryRank)
              .filter((r): r is number => r !== null)
              .sort((a, b) => a - b);
            
            if (ranks.length > 0) {
              expect(ranks[0]).toBe(1);
              for (let i = 0; i < ranks.length; i++) {
                expect(ranks[i]).toBe(i + 1);
              }
            }
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });


  /**
   * Test 11: Ranking should be stable - adding a stock with lower score shouldn't change existing ranks
   * 
   * **Validates: Requirements 13.4**
   */
  it('should maintain existing ranks when adding a stock with lower score', () => {
    fc.assert(
      fc.property(
        sameSectorStocksArbitrary,
        symbolArbitrary,
        ({ sector, stocks }, newSymbol) => {
          // Skip if new symbol already exists
          if (stocks.some(s => s.symbol === newSymbol)) {
            return true;
          }
          
          // Calculate initial rankings
          const initialRanked = calculateSectorRankings(stocks, sector);
          
          // Find the lowest score
          const lowestScore = Math.min(...stocks.map(s => s.overallScore));
          
          // Add a new stock with even lower score
          const newStock: StockRating = {
            symbol: newSymbol,
            overallScore: Math.max(1, lowestScore - 0.5),
            sector,
            industry: null,
          };
          
          const newStocks = [...stocks, newStock];
          const newRanked = calculateSectorRankings(newStocks, sector);
          
          // Property: existing stocks should maintain their ranks
          for (const stock of stocks) {
            const initialRank = initialRanked.find(r => r.symbol === stock.symbol)?.sectorRank;
            const newRank = newRanked.find(r => r.symbol === stock.symbol)?.sectorRank;
            expect(newRank).toBe(initialRank);
          }
          
          // Property: new stock should have the last rank
          const newStockRank = newRanked.find(r => r.symbol === newSymbol)?.sectorRank;
          expect(newStockRank).toBe(stocks.length + 1);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 12: Ranking should update correctly when adding a stock with higher score
   * 
   * **Validates: Requirements 13.4**
   */
  it('should update ranks correctly when adding a stock with highest score', () => {
    fc.assert(
      fc.property(
        // Use stocks with scores that leave room for a higher score (max 4.5)
        fc.tuple(
          sectorArbitrary,
          fc.array(
            fc.record({
              symbol: symbolArbitrary,
              overallScore: fc.integer({ min: 100, max: 450 }).map(cents => cents / 100),
            }),
            { minLength: 2, maxLength: 20 }
          )
        ).map(([sector, baseStocks]) => {
          // Ensure unique symbols
          const seen = new Set<string>();
          const uniqueStocks = baseStocks.filter(stock => {
            if (seen.has(stock.symbol)) return false;
            seen.add(stock.symbol);
            return true;
          });
          return {
            sector,
            stocks: uniqueStocks.map(s => ({
              ...s,
              sector,
              industry: null,
            })) as StockRating[],
          };
        }).filter(data => data.stocks.length >= 2),
        symbolArbitrary,
        ({ sector, stocks }, newSymbol) => {
          // Skip if new symbol already exists
          if (stocks.some(s => s.symbol === newSymbol)) {
            return true;
          }
          
          // Find the highest score
          const highestScore = Math.max(...stocks.map(s => s.overallScore));
          
          // Add a new stock with strictly higher score (guaranteed since max is 4.5)
          const newStock: StockRating = {
            symbol: newSymbol,
            overallScore: highestScore + 0.5,
            sector,
            industry: null,
          };
          
          const newStocks = [...stocks, newStock];
          const newRanked = calculateSectorRankings(newStocks, sector);
          
          // Property: new stock should have rank 1 (since it has the highest score)
          const newStockRank = newRanked.find(r => r.symbol === newSymbol)?.sectorRank;
          expect(newStockRank).toBe(1);
          
          // Property: all existing stocks should have their ranks increased by 1
          const initialRanked = calculateSectorRankings(stocks, sector);
          for (const stock of stocks) {
            const initialRank = initialRanked.find(r => r.symbol === stock.symbol)?.sectorRank;
            const newRank = newRanked.find(r => r.symbol === stock.symbol)?.sectorRank;
            if (initialRank !== null && initialRank !== undefined && newRank !== null && newRank !== undefined) {
              expect(newRank).toBe(initialRank + 1);
            }
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });


  /**
   * Test 13: Number of ranked stocks should equal number of stocks in sector
   * 
   * **Validates: Requirements 13.4**
   */
  it('should rank all stocks in the sector', () => {
    fc.assert(
      fc.property(
        sameSectorStocksArbitrary,
        ({ sector, stocks }) => {
          const ranked = calculateSectorRankings(stocks, sector);
          
          // Count stocks with non-null sector rank
          const rankedCount = ranked.filter(r => r.sectorRank !== null).length;
          
          // Count stocks in the sector
          const sectorCount = stocks.filter(s => s.sector === sector).length;
          
          // Property: all stocks in sector should be ranked
          expect(rankedCount).toBe(sectorCount);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 14: Maximum rank should equal the number of stocks in sector
   * 
   * **Validates: Requirements 13.4**
   */
  it('should have maximum rank equal to number of stocks in sector', () => {
    fc.assert(
      fc.property(
        sameSectorStocksArbitrary,
        ({ sector, stocks }) => {
          const ranked = calculateSectorRankings(stocks, sector);
          
          // Get all sector ranks
          const sectorRanks = ranked
            .filter(r => r.sectorRank !== null)
            .map(r => r.sectorRank as number);
          
          if (sectorRanks.length > 0) {
            const maxRank = Math.max(...sectorRanks);
            const sectorCount = stocks.filter(s => s.sector === sector).length;
            
            // Property: max rank should equal number of stocks in sector
            expect(maxRank).toBe(sectorCount);
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 15: Ranking order should be deterministic for distinct scores
   * 
   * **Validates: Requirements 13.4**
   */
  it('should produce deterministic ranking order for distinct scores', () => {
    fc.assert(
      fc.property(
        sameSectorStocksArbitrary.filter(({ stocks }) => {
          // Ensure all scores are distinct
          const scores = stocks.map(s => s.overallScore);
          return new Set(scores).size === scores.length;
        }),
        ({ sector, stocks }) => {
          const ranked = calculateSectorRankings(stocks, sector);
          
          // Sort stocks by score descending
          const sortedByScore = [...stocks].sort((a, b) => b.overallScore - a.overallScore);
          
          // Property: ranking order should match score order
          for (let i = 0; i < sortedByScore.length; i++) {
            const stock = sortedByScore[i];
            const rankedStock = ranked.find(r => r.symbol === stock.symbol);
            expect(rankedStock?.sectorRank).toBe(i + 1);
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });


  /**
   * Test 16: Sector and industry rankings should be independent
   * 
   * **Validates: Requirements 13.4**
   */
  it('should calculate sector and industry rankings independently', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            symbol: symbolArbitrary,
            overallScore: overallScoreArbitrary,
            sector: sectorArbitrary,
            industry: industryArbitrary,
          }),
          { minLength: 3, maxLength: 20 }
        ).map(stocks => {
          // Ensure unique symbols
          const seen = new Set<string>();
          return stocks.filter(stock => {
            if (seen.has(stock.symbol)) return false;
            seen.add(stock.symbol);
            return true;
          }) as StockRating[];
        }).filter(stocks => stocks.length >= 3),
        (stocks) => {
          const ranked = calculateAllRankings(stocks);
          
          // Property: sector rank and industry rank can be different for the same stock
          // This is expected since they are calculated independently
          for (const stock of ranked) {
            // Both ranks should be valid (positive or null)
            if (stock.sectorRank !== null) {
              expect(stock.sectorRank).toBeGreaterThan(0);
            }
            if (stock.industryRank !== null) {
              expect(stock.industryRank).toBeGreaterThan(0);
            }
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 17: Ranking should handle single stock in sector correctly
   * 
   * **Validates: Requirements 13.4**
   */
  it('should assign rank 1 to single stock in sector', () => {
    fc.assert(
      fc.property(
        fc.record({
          symbol: symbolArbitrary,
          overallScore: overallScoreArbitrary,
          sector: sectorArbitrary,
          industry: fc.option(industryArbitrary, { nil: null }),
        }),
        (stock) => {
          const stocks: StockRating[] = [stock];
          const ranked = calculateSectorRankings(stocks, stock.sector!);
          
          // Property: single stock should have rank 1
          const rankedStock = ranked.find(r => r.symbol === stock.symbol);
          expect(rankedStock?.sectorRank).toBe(1);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test 18: Ranking should handle stocks with equal scores
   * 
   * **Validates: Requirements 13.4**
   */
  it('should handle stocks with equal scores by assigning different ranks', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          sectorArbitrary,
          overallScoreArbitrary,
          fc.integer({ min: 2, max: 5 })
        ),
        ([sector, score, count]) => {
          // Create multiple stocks with the same score
          const stocks: StockRating[] = [];
          for (let i = 0; i < count; i++) {
            stocks.push({
              symbol: `STOCK${i}`,
              overallScore: score,
              sector,
              industry: null,
            });
          }
          
          const ranked = calculateSectorRankings(stocks, sector);
          
          // Get all ranks
          const ranks = ranked
            .filter(r => r.sectorRank !== null)
            .map(r => r.sectorRank as number)
            .sort((a, b) => a - b);
          
          // Property: all ranks should be unique even with equal scores
          const uniqueRanks = new Set(ranks);
          expect(uniqueRanks.size).toBe(ranks.length);
          
          // Property: ranks should be consecutive starting from 1
          for (let i = 0; i < ranks.length; i++) {
            expect(ranks[i]).toBe(i + 1);
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });
});
