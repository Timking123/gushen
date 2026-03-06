/**
 * Sync stock data from Finnhub API
 * 
 * Usage:
 *   npm run sync:quotes  - Sync quotes for popular stocks
 *   npm run sync:news    - Sync market news
 *   npm run sync:candles - Sync historical candles
 *   npm run sync:all     - Sync all data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || 'd60h819r01qto1rd5730d60h819r01qto1rd573g';
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

// Popular stocks to sync
const POPULAR_STOCKS = [
  // Tech Giants
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AMD', 'INTC', 'CRM',
  'ORCL', 'ADBE', 'NFLX', 'PYPL', 'CSCO', 'IBM', 'QCOM', 'TXN', 'AVGO', 'MU',
  // Finance
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'AXP', 'V', 'MA', 'BLK',
  // Healthcare
  'JNJ', 'UNH', 'PFE', 'ABBV', 'MRK', 'LLY', 'TMO', 'ABT', 'BMY', 'AMGN',
  // Consumer
  'WMT', 'HD', 'PG', 'KO', 'PEP', 'COST', 'NKE', 'MCD', 'SBUX', 'DIS',
  // Industrial
  'CAT', 'BA', 'GE', 'MMM', 'HON', 'UPS', 'RTX', 'LMT', 'DE', 'UNP',
  // Energy
  'XOM', 'CVX', 'COP', 'SLB', 'EOG',
  // ETFs (for index tracking)
  'SPY', 'QQQ', 'DIA', 'IWM', 'VTI',
];

interface FinnhubQuote {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

interface FinnhubNews {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

async function fetchQuote(symbol: string): Promise<FinnhubQuote | null> {
  const url = `${FINNHUB_BASE_URL}/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 429) {
        console.log('Rate limited, waiting 60s...');
        await new Promise(r => setTimeout(r, 60000));
        return fetchQuote(symbol);
      }
      return null;
    }
    const data = await response.json() as FinnhubQuote;
    return data.c > 0 ? data : null;
  } catch {
    return null;
  }
}

async function fetchNews(): Promise<FinnhubNews[]> {
  const url = `${FINNHUB_BASE_URL}/news?category=general&token=${FINNHUB_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    return await response.json() as FinnhubNews[];
  } catch {
    return [];
  }
}

async function syncQuotes() {
  console.log(`Syncing quotes for ${POPULAR_STOCKS.length} stocks...`);
  let success = 0;
  
  for (let i = 0; i < POPULAR_STOCKS.length; i++) {
    const symbol = POPULAR_STOCKS[i];
    
    // Rate limit: 60 req/min
    if (i > 0 && i % 55 === 0) {
      console.log('Rate limit pause (60s)...');
      await new Promise(r => setTimeout(r, 60000));
    }
    
    const quote = await fetchQuote(symbol);
    if (quote) {
      try {
        await prisma.stock.upsert({
          where: { symbol },
          update: {},
          create: { symbol, name: symbol, exchange: 'US' },
        });
        
        await prisma.stockQuote.create({
          data: {
            symbol,
            price: quote.c,
            change: quote.d || 0,
            changePercent: quote.dp || 0,
            high: quote.h,
            low: quote.l,
            open: quote.o,
            previousClose: quote.pc,
            volume: BigInt(0),
            timestamp: new Date(quote.t * 1000),
          },
        });
        console.log(`✓ ${symbol}: $${quote.c} (${quote.dp > 0 ? '+' : ''}${quote.dp?.toFixed(2)}%)`);
        success++;
      } catch (e) {
        console.error(`DB error ${symbol}:`, e);
      }
    }
    await new Promise(r => setTimeout(r, 1100));
  }
  console.log(`Synced ${success}/${POPULAR_STOCKS.length} quotes`);
}

async function syncNews() {
  console.log('Syncing market news...');
  const news = await fetchNews();
  let count = 0;
  
  for (const item of news.slice(0, 20)) {
    try {
      const exists = await prisma.newsItem.findFirst({ where: { url: item.url } });
      if (!exists) {
        await prisma.newsItem.create({
          data: {
            title: item.headline,
            summary: item.summary,
            source: item.source,
            url: item.url,
            publishedAt: new Date(item.datetime * 1000),
            sectors: item.category ? [item.category] : [],
          },
        });
        count++;
      }
    } catch (e) {
      console.error('News error:', e);
    }
  }
  console.log(`Synced ${count} news items`);
}

async function main() {
  const cmd = process.argv[2] || 'quotes';
  
  switch (cmd) {
    case 'quotes':
      await syncQuotes();
      break;
    case 'news':
      await syncNews();
      break;
    case 'candles':
      console.log('Candle sync not implemented yet');
      break;
    case 'all':
      await syncQuotes();
      await syncNews();
      break;
    default:
      console.log('Usage: tsx scripts/sync-finnhub.ts [quotes|news|candles|all]');
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
