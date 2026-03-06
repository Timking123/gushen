/**
 * 跳过股票重新同步脚本
 * 专门用于获取之前同步时跳过的股票（无报价数据的股票）
 * 
 * 使用方法:
 *   npm run sync:skipped        - 同步跳过的股票
 *   npx tsx scripts/sync-skipped-stocks.ts
 * 
 * 工作原理:
 *   1. 查找数据库中没有任何报价记录的股票
 *   2. 尝试从 Finnhub 获取这些股票的报价
 *   3. 如果仍然无法获取，记录到日志文件
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || 'd60h819r01qto1rd5730d60h819r01qto1rd573g';
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

// 速率限制配置
const REQUESTS_PER_MINUTE = 55;
const REQUEST_INTERVAL_MS = Math.ceil(60000 / REQUESTS_PER_MINUTE);

// 日志文件
const LOG_DIR = path.join(process.cwd(), 'scripts', 'logs');
const STILL_SKIPPED_FILE = path.join(LOG_DIR, 'still-skipped-stocks.json');

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

interface SkippedStockInfo {
  symbol: string;
  name: string;
  exchange: string;
  reason: string;
  lastAttempt: string;
}

// 统计信息
const stats = {
  totalSkipped: 0,
  recovered: 0,
  stillSkipped: 0,
  errors: 0,
  startTime: new Date(),
};

function log(message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info') {
  const timestamp = new Date().toLocaleString('zh-CN');
  const prefix = { info: '📊', warn: '⚠️', error: '❌', success: '✅' }[level];
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

async function fetchQuote(symbol: string): Promise<FinnhubQuote | null> {
  const url = `${FINNHUB_BASE_URL}/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
  
  try {
    const response = await fetch(url);
    
    if (response.status === 429) {
      log('触发速率限制，等待 60 秒...', 'warn');
      await sleep(60000);
      return fetchQuote(symbol);
    }
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json() as FinnhubQuote;
    return data;
  } catch (e) {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getSkippedStocks(): Promise<Array<{ symbol: string; name: string; exchange: string }>> {
  // 查找没有任何报价记录的股票
  const stocksWithoutQuotes = await prisma.$queryRaw<Array<{ symbol: string; name: string; exchange: string }>>`
    SELECT s.symbol, s.name, s.exchange
    FROM stocks s
    LEFT JOIN stock_quotes sq ON s.symbol = sq.symbol
    WHERE sq.id IS NULL
      AND s.exchange != 'INDEX'
    ORDER BY s.symbol
  `;
  
  return stocksWithoutQuotes;
}

async function syncQuote(symbol: string): Promise<{ success: boolean; reason?: string }> {
  const quote = await fetchQuote(symbol);
  
  if (!quote) {
    return { success: false, reason: 'API请求失败' };
  }
  
  // 检查是否有有效数据
  if (quote.c === 0 && quote.pc === 0) {
    return { success: false, reason: '无交易数据(价格为0)' };
  }
  
  if (quote.c === 0 && quote.pc > 0) {
    // 使用前收盘价
    quote.c = quote.pc;
  }
  
  try {
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
        timestamp: quote.t > 0 ? new Date(quote.t * 1000) : new Date(),
      },
    });
    return { success: true };
  } catch (e) {
    return { success: false, reason: `数据库错误: ${e}` };
  }
}

function printStats() {
  const runtime = Math.round((Date.now() - stats.startTime.getTime()) / 1000 / 60);
  const rate = stats.totalSkipped > 0 
    ? Math.round(stats.totalSkipped / Math.max(runtime, 1)) 
    : 0;
  
  console.log('\n' + '='.repeat(60));
  console.log(`📈 跳过股票同步统计 (运行 ${runtime} 分钟)`);
  console.log('='.repeat(60));
  console.log(`原跳过数量: ${stats.totalSkipped}`);
  console.log(`成功恢复: ${stats.recovered} (${(stats.recovered / stats.totalSkipped * 100).toFixed(1)}%)`);
  console.log(`仍然跳过: ${stats.stillSkipped}`);
  console.log(`错误: ${stats.errors}`);
  console.log(`平均速率: ${rate} 请求/分钟`);
  console.log('='.repeat(60) + '\n');
}

async function main() {
  log('🚀 启动跳过股票重新同步...');
  ensureLogDir();
  
  // 获取跳过的股票
  const skippedStocks = await getSkippedStocks();
  stats.totalSkipped = skippedStocks.length;
  
  if (skippedStocks.length === 0) {
    log('没有找到跳过的股票，所有股票都有报价数据！', 'success');
    await prisma.$disconnect();
    return;
  }
  
  log(`找到 ${skippedStocks.length} 只跳过的股票`);
  
  // 预计时间
  const totalMinutes = Math.ceil(skippedStocks.length / REQUESTS_PER_MINUTE);
  log(`预计完成时间: ${totalMinutes} 分钟`);
  
  const stillSkipped: SkippedStockInfo[] = [];
  
  for (let i = 0; i < skippedStocks.length; i++) {
    const stock = skippedStocks[i];
    const result = await syncQuote(stock.symbol);
    
    const progress = ((i + 1) / skippedStocks.length * 100).toFixed(1);
    
    if (result.success) {
      stats.recovered++;
      process.stdout.write(`\r✓ ${stock.symbol}: 恢复成功 | 进度: ${i + 1}/${skippedStocks.length} (${progress}%)    `);
    } else {
      stats.stillSkipped++;
      stillSkipped.push({
        symbol: stock.symbol,
        name: stock.name,
        exchange: stock.exchange,
        reason: result.reason || '未知原因',
        lastAttempt: new Date().toISOString(),
      });
    }
    
    // 每 50 个打印详细进度
    if ((i + 1) % 50 === 0) {
      console.log('');
      log(`进度: ${i + 1}/${skippedStocks.length} (${progress}%) | 恢复: ${stats.recovered} | 仍跳过: ${stats.stillSkipped}`);
    }
    
    await sleep(REQUEST_INTERVAL_MS);
  }
  
  console.log('');
  
  // 保存仍然跳过的股票列表
  if (stillSkipped.length > 0) {
    fs.writeFileSync(STILL_SKIPPED_FILE, JSON.stringify(stillSkipped, null, 2));
    log(`仍然跳过的股票已保存到: ${STILL_SKIPPED_FILE}`, 'warn');
    
    // 按原因分组统计
    const reasonCounts: Record<string, number> = {};
    for (const s of stillSkipped) {
      reasonCounts[s.reason] = (reasonCounts[s.reason] || 0) + 1;
    }
    
    console.log('\n跳过原因统计:');
    for (const [reason, count] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${reason}: ${count}`);
    }
  }
  
  printStats();
  
  await prisma.$disconnect();
}

// 优雅退出
process.on('SIGINT', () => {
  log('\n收到退出信号...');
  printStats();
  process.exit(0);
});

main().catch(e => {
  log(`致命错误: ${e}`, 'error');
  process.exit(1);
});
