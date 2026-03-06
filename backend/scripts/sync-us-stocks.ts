/**
 * Sync US Stocks Script
 * Downloads all US stock symbols from Finnhub and saves to database
 * 
 * Usage: npx tsx scripts/sync-us-stocks.ts
 */

import { finnhubService } from '../src/services/finnhubService.js';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  console.log('🚀 Starting US stocks sync from Finnhub...\n');

  try {
    const count = await finnhubService.syncAllUSStocks();
    console.log(`\n✅ Successfully synced ${count} US stocks to database`);

    // Show total count in database
    const totalStocks = await prisma.stock.count();
    console.log(`📊 Total stocks in database: ${totalStocks}`);

  } catch (error) {
    console.error('❌ Error syncing stocks:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
