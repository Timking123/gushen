/**
 * Sync Stock Data Script
 * Downloads comprehensive stock data from Finnhub API:
 * - Company profile (sector, marketCap, country, etc.)
 * - Real-time quote (price, change, volume)
 * - Basic financials (P/E, EPS, ROE, etc.)
 * 
 * Usage: npx tsx scripts/sync-stock-profiles.ts [options]
 * 
 * Options:
 *   --limit=N        Limit the number of stocks to sync (default: all)
 *   --skip-existing  Skip stocks that already have sector data
 *   --popular-only   Only sync popular/major stocks first
 *   --full           Fetch all data (profile + quote + financials) - uses 3 API calls per stock
 *   --profile-only   Only fetch company profile (default)
 * 
 * Rate Limiting:
 *   Finnhub free tier: 60 requests/minute
 *   - Uses 48 req/min (80% of limit) for safety margin
 *   - Token bucket with max burst of 10 requests
 *   - Automatic retry with exponential backoff on 429 errors
 *   - Default mode (profile-only): ~48 stocks/minute
 *   - Full mode: ~16 stocks/minute (3 API calls per stock)
 */

import { finnhubService } from '../src/services/finnhubService.js';
import { prisma } from '../src/lib/prisma.js';

// Parse command line arguments
const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;
const skipExisting = args.includes('--skip-existing');
const popularOnly = args.includes('--popular-only');
const fullMode = args.includes('--full');

// Popular stocks to prioritize
const POPULAR_SYMBOLS = [
  // Tech Giants
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA', 'TSLA', 'AMD', 'INTC',
  'ORCL', 'CRM', 'ADBE', 'NFLX', 'PYPL', 'CSCO', 'IBM', 'QCOM', 'TXN', 'AVGO',
  // Finance
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'AXP', 'V', 'MA', 'BLK',
  // Healthcare
  'JNJ', 'UNH', 'PFE', 'ABBV', 'MRK', 'LLY', 'TMO', 'ABT', 'DHR', 'BMY',
  // Consumer
  'WMT', 'PG', 'KO', 'PEP', 'COST', 'HD', 'MCD', 'NKE', 'SBUX', 'DIS',
  // Energy
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO', 'OXY', 'HAL',
  // Industrial
  'CAT', 'BA', 'HON', 'UPS', 'RTX', 'GE', 'MMM', 'LMT', 'DE', 'UNP',
  // ETFs (will fail but included for completeness)
  'SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'VOO', 'VEA', 'VWO', 'BND', 'GLD',
];

// Rate limiting configuration
// Finnhub allows 60 requests/minute = 1 request per second
// We use a token bucket approach with conservative settings to avoid 429 errors
class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per ms
  private lastRefill: number;
  private consecutiveErrors: number = 0;
  private cooldownUntil: number = 0;

  constructor(requestsPerMinute: number = 48) {
    // Use 48 instead of 60 to have safety margin (80% of limit)
    this.maxTokens = Math.min(requestsPerMinute, 10); // Don't burst more than 10
    this.tokens = this.maxTokens;
    this.refillRate = requestsPerMinute / 60000; // tokens per ms
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    // Check if we're in cooldown period
    const now = Date.now();
    if (now < this.cooldownUntil) {
      const waitTime = this.cooldownUntil - now;
      console.log(`⏸️  Rate limit cooldown: waiting ${(waitTime / 1000).toFixed(1)}s...`);
      await this.sleep(waitTime);
    }

    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait for token to become available
    const waitTime = Math.ceil((1 - this.tokens) / this.refillRate);
    await this.sleep(waitTime);
    this.refill();
    this.tokens -= 1;
  }

  // Call this when a 429 error is received
  onRateLimitError(): void {
    this.consecutiveErrors++;
    // Exponential backoff: 30s, 60s, 120s, max 5min
    const backoffTime = Math.min(30000 * Math.pow(2, this.consecutiveErrors - 1), 300000);
    this.cooldownUntil = Date.now() + backoffTime;
    this.tokens = 0; // Reset tokens
    console.log(`🚨 Rate limit hit! Backing off for ${(backoffTime / 1000).toFixed(0)}s (attempt ${this.consecutiveErrors})`);
  }

  // Call this on successful request
  onSuccess(): void {
    this.consecutiveErrors = 0;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const rateLimiter = new RateLimiter(48);

// Helper function to make API call with retry logic
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await rateLimiter.acquire();
      const result = await fn();
      rateLimiter.onSuccess();
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Check if it's a rate limit error (429)
      if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('rate limit')) {
        rateLimiter.onRateLimitError();
        if (attempt < maxRetries) {
          console.log(`   ↻ Retry ${attempt}/${maxRetries} for rate limit...`);
          continue;
        }
      }
      
      // For other errors, don't retry
      throw error;
    }
  }
  return null;
}

interface SyncResult {
  symbol: string;
  success: boolean;
  profileUpdated: boolean;
  quoteUpdated: boolean;
  financialsUpdated: boolean;
  error?: string;
}

/**
 * Sync comprehensive stock data for a single symbol
 */
async function syncStockData(symbol: string, fetchFull: boolean): Promise<SyncResult> {
  const result: SyncResult = {
    symbol,
    success: false,
    profileUpdated: false,
    quoteUpdated: false,
    financialsUpdated: false,
  };

  try {
    // Always fetch profile with retry logic
    const profile = await withRetry(() => finnhubService.getCompanyProfile(symbol));
    
    if (!profile || !profile.name) {
      result.error = 'No profile data';
      return result;
    }

    // Prepare stock update data
    const stockData: any = {
      name: profile.name,
      exchange: profile.exchange || 'US',
      sector: profile.finnhubIndustry || null,
      industry: profile.finnhubIndustry || null,
      marketCap: profile.marketCapitalization 
        ? BigInt(Math.round(profile.marketCapitalization * 1000000))
        : null,
      country: profile.country || 'US',
    };

    // Update stock record
    await prisma.stock.update({
      where: { symbol },
      data: stockData,
    });
    result.profileUpdated = true;

    // Fetch quote if in full mode
    if (fetchFull) {
      const quote = await withRetry(() => finnhubService.getQuote(symbol));
      
      if (quote && quote.c > 0) {
        await prisma.stockQuote.create({
          data: {
            symbol,
            price: quote.c,
            change: quote.d || 0,
            changePercent: quote.dp || 0,
            high: quote.h || quote.c,
            low: quote.l || quote.c,
            open: quote.o || quote.c,
            previousClose: quote.pc || quote.c,
            volume: BigInt(0),
            timestamp: new Date(),
          },
        });
        result.quoteUpdated = true;
      }
    }

    // Fetch financials if in full mode
    if (fetchFull) {
      const financials = await withRetry(() => finnhubService.getBasicFinancials(symbol));
      
      if (financials && financials.metric) {
        const m = financials.metric;
        await prisma.fundamentalMetrics.upsert({
          where: { symbol },
          update: {
            pe: m.peBasicExclExtraTTM ?? m.peExclExtraTTM ?? m.peAnnual ?? null,
            forwardPe: m.peExclExtraAnnual ?? null,
            peg: m.pegRatio ?? null,
            ps: m.psTTM ?? m.psAnnual ?? null,
            pb: m.pbQuarterly ?? m.pbAnnual ?? null,
            eps: m.epsAnnual ?? null,
            epsGrowth: m.epsGrowthTTMYoy ?? m.epsGrowthQuarterlyYoy ?? null,
            revenueGrowth: m.revenueGrowthTTMYoy ?? m.revenueGrowthQuarterlyYoy ?? null,
            grossMargin: m.grossMarginTTM ?? m.grossMarginAnnual ?? null,
            operatingMargin: m.operatingMarginTTM ?? m.operatingMarginAnnual ?? null,
            netMargin: m.netProfitMarginTTM ?? m.netProfitMarginAnnual ?? null,
            roe: m.roeTTM ?? m.roeRfy ?? null,
            roa: m.roaTTM ?? m.roaRfy ?? null,
            debtToEquity: m.totalDebtToEquityQuarterly ?? m.totalDebtToEquityAnnual ?? null,
            currentRatio: m.currentRatioQuarterly ?? m.currentRatioAnnual ?? null,
            dividendYield: m.dividendYieldIndicatedAnnual ?? null,
            payoutRatio: m.payoutRatioAnnual ?? null,
          },
          create: {
            symbol,
            pe: m.peBasicExclExtraTTM ?? m.peExclExtraTTM ?? m.peAnnual ?? null,
            forwardPe: m.peExclExtraAnnual ?? null,
            peg: m.pegRatio ?? null,
            ps: m.psTTM ?? m.psAnnual ?? null,
            pb: m.pbQuarterly ?? m.pbAnnual ?? null,
            eps: m.epsAnnual ?? null,
            epsGrowth: m.epsGrowthTTMYoy ?? m.epsGrowthQuarterlyYoy ?? null,
            revenueGrowth: m.revenueGrowthTTMYoy ?? m.revenueGrowthQuarterlyYoy ?? null,
            grossMargin: m.grossMarginTTM ?? m.grossMarginAnnual ?? null,
            operatingMargin: m.operatingMarginTTM ?? m.operatingMarginAnnual ?? null,
            netMargin: m.netProfitMarginTTM ?? m.netProfitMarginAnnual ?? null,
            roe: m.roeTTM ?? m.roeRfy ?? null,
            roa: m.roaTTM ?? m.roaRfy ?? null,
            debtToEquity: m.totalDebtToEquityQuarterly ?? m.totalDebtToEquityAnnual ?? null,
            currentRatio: m.currentRatioQuarterly ?? m.currentRatioAnnual ?? null,
            dividendYield: m.dividendYieldIndicatedAnnual ?? null,
            payoutRatio: m.payoutRatioAnnual ?? null,
          },
        });
        result.financialsUpdated = true;
      }
    }

    result.success = true;
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

/**
 * Format market cap for display
 */
function formatMarketCap(marketCap: bigint | null): string {
  if (!marketCap) return 'N/A';
  const num = Number(marketCap);
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toLocaleString()}`;
}

async function main() {
  console.log('🚀 Stock Data Sync from Finnhub\n');
  console.log('Options:');
  console.log(`  - Limit: ${limit || 'all'}`);
  console.log(`  - Skip existing: ${skipExisting}`);
  console.log(`  - Popular only: ${popularOnly}`);
  console.log(`  - Full mode: ${fullMode} (profile${fullMode ? ' + quote + financials' : ' only'})`);
  console.log(`  - API calls per stock: ${fullMode ? 3 : 1}`);
  console.log(`  - Rate limit: 48 req/min (80% of Finnhub limit)`);
  console.log(`  - Expected rate: ~${fullMode ? 16 : 48} stocks/minute\n`);

  try {
    let stocks: { symbol: string }[];

    if (popularOnly) {
      stocks = POPULAR_SYMBOLS.map(symbol => ({ symbol }));
      console.log(`📋 Syncing ${stocks.length} popular stocks...\n`);
    } else {
      const whereClause: any = {};
      
      if (skipExisting) {
        whereClause.OR = [
          { sector: null },
          { marketCap: null },
        ];
      }

      stocks = await prisma.stock.findMany({
        where: whereClause,
        select: { symbol: true },
        orderBy: { symbol: 'asc' },
        take: limit,
      });

      console.log(`📋 Found ${stocks.length} stocks to sync...\n`);
    }

    let successCount = 0;
    let failCount = 0;
    let profileCount = 0;
    let quoteCount = 0;
    let financialsCount = 0;
    const startTime = Date.now();

    for (let i = 0; i < stocks.length; i++) {
      const stock = stocks[i];
      const progress = `[${i + 1}/${stocks.length}]`;
      
      process.stdout.write(`${progress} ${stock.symbol.padEnd(6)} `);
      
      const result = await syncStockData(stock.symbol, fullMode);
      
      if (result.success) {
        successCount++;
        if (result.profileUpdated) profileCount++;
        if (result.quoteUpdated) quoteCount++;
        if (result.financialsUpdated) financialsCount++;
        
        // Get updated stock info for display
        const updatedStock = await prisma.stock.findUnique({
          where: { symbol: stock.symbol },
          select: { name: true, sector: true, marketCap: true },
        });
        
        const parts = [
          '✅',
          updatedStock?.name?.substring(0, 25).padEnd(25) || 'Unknown',
          `| ${(updatedStock?.sector || 'N/A').substring(0, 20).padEnd(20)}`,
          `| ${formatMarketCap(updatedStock?.marketCap || null).padStart(12)}`,
        ];
        
        if (fullMode) {
          parts.push(`| Q:${result.quoteUpdated ? '✓' : '✗'} F:${result.financialsUpdated ? '✓' : '✗'}`);
        }
        
        console.log(parts.join(' '));
      } else {
        failCount++;
        console.log(`⚠️  ${result.error || 'Unknown error'}`);
      }

      // Progress update every 50 stocks
      if ((i + 1) % 50 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = (i + 1) / (elapsed / 60);
        const apiCalls = fullMode ? (i + 1) * 3 : (i + 1);
        const apiRate = apiCalls / (elapsed / 60);
        const remaining = (stocks.length - i - 1) / rate;
        
        console.log('\n' + '─'.repeat(80));
        console.log(`📊 Progress: ${i + 1}/${stocks.length} stocks | Success: ${successCount} | Failed: ${failCount}`);
        console.log(`⏱️  Elapsed: ${elapsed.toFixed(0)}s | Rate: ${rate.toFixed(1)} stocks/min | API: ${apiRate.toFixed(1)} calls/min`);
        console.log(`📈 Profile: ${profileCount} | Quote: ${quoteCount} | Financials: ${financialsCount}`);
        console.log(`⏳ ETA: ${remaining.toFixed(0)}s`);
        console.log('─'.repeat(80) + '\n');
      }
    }

    const totalTime = (Date.now() - startTime) / 1000;
    const totalApiCalls = fullMode ? stocks.length * 3 : stocks.length;
    
    console.log('\n' + '═'.repeat(80));
    console.log('✅ SYNC COMPLETED');
    console.log('═'.repeat(80));
    console.log(`⏱️  Total time: ${totalTime.toFixed(0)} seconds`);
    console.log(`📊 Stocks processed: ${stocks.length}`);
    console.log(`   - Success: ${successCount}`);
    console.log(`   - Failed: ${failCount}`);
    console.log(`📈 Data updated:`);
    console.log(`   - Profiles: ${profileCount}`);
    console.log(`   - Quotes: ${quoteCount}`);
    console.log(`   - Financials: ${financialsCount}`);
    console.log(`🔄 API calls: ${totalApiCalls} (${(totalApiCalls / (totalTime / 60)).toFixed(1)} calls/min)`);

    // Show database stats
    const stocksWithSector = await prisma.stock.count({ where: { sector: { not: null } } });
    const stocksWithMarketCap = await prisma.stock.count({ where: { marketCap: { not: null } } });
    const stocksWithFinancials = await prisma.fundamentalMetrics.count();
    const totalStocks = await prisma.stock.count();

    console.log('\n📊 Database Stats:');
    console.log(`   Total stocks: ${totalStocks}`);
    console.log(`   With sector: ${stocksWithSector} (${((stocksWithSector / totalStocks) * 100).toFixed(1)}%)`);
    console.log(`   With market cap: ${stocksWithMarketCap} (${((stocksWithMarketCap / totalStocks) * 100).toFixed(1)}%)`);
    console.log(`   With financials: ${stocksWithFinancials} (${((stocksWithFinancials / totalStocks) * 100).toFixed(1)}%)`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
