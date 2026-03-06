/**
 * 后台股票数据同步服务
 * 持续运行，每分钟最多 60 次 API 请求
 * 循环同步所有股票数据
 * 
 * 使用方法:
 *   npm run sync:daemon        - 启动后台同步服务
 *   npm run sync:daemon:stop   - 停止服务
 * 
 * 或直接运行:
 *   npx tsx scripts/sync-all-stocks.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || 'd60h819r01qto1rd5730d60h819r01qto1rd573g';
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

// 速率限制配置
const REQUESTS_PER_MINUTE = 55; // 留一点余量，避免触发限制
const REQUEST_INTERVAL_MS = Math.ceil(60000 / REQUESTS_PER_MINUTE); // ~1090ms

// 状态文件路径（用于断点续传）
const STATE_FILE = path.join(process.cwd(), 'scripts', '.sync-state.json');

interface SyncState {
  lastIndex: number;
  lastSymbol: string;
  totalStocks: number;
  syncedCount: number;
  startTime: string;
  lastUpdateTime: string;
}

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

// 统计信息
let stats = {
  totalRequests: 0,
  successCount: 0,
  errorCount: 0,
  skipCount: 0,
  startTime: new Date(),
  currentCycle: 1,
};

function log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toLocaleString('zh-CN');
  const prefix = { info: '📊', warn: '⚠️', error: '❌' }[level];
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function loadState(): SyncState | null {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (e) {
    log('无法加载状态文件，将从头开始', 'warn');
  }
  return null;
}

function saveState(state: SyncState) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    log('无法保存状态文件', 'warn');
  }
}

async function fetchQuote(symbol: string): Promise<FinnhubQuote | null> {
  const url = `${FINNHUB_BASE_URL}/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
  
  try {
    const response = await fetch(url);
    stats.totalRequests++;
    
    if (response.status === 429) {
      log('触发速率限制，等待 60 秒...', 'warn');
      await sleep(60000);
      return fetchQuote(symbol); // 重试
    }
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json() as FinnhubQuote;
    return data.c > 0 ? data : null;
  } catch (e) {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function syncQuote(symbol: string): Promise<boolean> {
  const quote = await fetchQuote(symbol);
  
  if (!quote) {
    stats.skipCount++;
    return false;
  }
  
  try {
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
    stats.successCount++;
    return true;
  } catch (e) {
    stats.errorCount++;
    return false;
  }
}

async function getAllStocks(): Promise<string[]> {
  const stocks = await prisma.stock.findMany({
    select: { symbol: true },
    where: {
      exchange: { not: 'INDEX' },
    },
    orderBy: { symbol: 'asc' },
  });
  return stocks.map(s => s.symbol);
}

function printStats() {
  const runtime = Math.round((Date.now() - stats.startTime.getTime()) / 1000 / 60);
  const rate = stats.totalRequests > 0 
    ? Math.round(stats.totalRequests / Math.max(runtime, 1)) 
    : 0;
  
  console.log('\n' + '='.repeat(50));
  console.log(`📈 同步统计 (运行 ${runtime} 分钟, 第 ${stats.currentCycle} 轮)`);
  console.log('='.repeat(50));
  console.log(`总请求数: ${stats.totalRequests}`);
  console.log(`成功: ${stats.successCount} | 跳过: ${stats.skipCount} | 错误: ${stats.errorCount}`);
  console.log(`平均速率: ${rate} 请求/分钟`);
  console.log('='.repeat(50) + '\n');
}

async function runSyncLoop() {
  log('🚀 启动股票数据同步服务...');
  
  // 获取所有股票
  const allSymbols = await getAllStocks();
  log(`数据库中共有 ${allSymbols.length} 只股票`);
  
  if (allSymbols.length === 0) {
    log('没有找到股票数据，退出', 'error');
    process.exit(1);
  }
  
  // 加载上次状态
  const state = loadState();
  let startIndex = 0;
  
  if (state && state.totalStocks === allSymbols.length) {
    startIndex = state.lastIndex + 1;
    if (startIndex >= allSymbols.length) {
      startIndex = 0;
      stats.currentCycle++;
    }
    log(`从上次位置继续: ${state.lastSymbol} (索引 ${startIndex})`);
  }
  
  // 计算预计完成时间
  const totalMinutes = Math.ceil(allSymbols.length / REQUESTS_PER_MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  log(`预计完成一轮需要: ${hours}小时${mins}分钟`);
  log(`开始同步，每 ${REQUEST_INTERVAL_MS}ms 一次请求...`);
  
  // 主循环
  let currentIndex = startIndex;
  
  while (true) {
    const symbol = allSymbols[currentIndex];
    
    // 同步报价
    const success = await syncQuote(symbol);
    
    // 打印进度
    const progress = ((currentIndex + 1) / allSymbols.length * 100).toFixed(1);
    if (success) {
      process.stdout.write(`\r✓ ${symbol}: 成功 | 进度: ${currentIndex + 1}/${allSymbols.length} (${progress}%)    `);
    }
    
    // 每 100 个打印详细进度
    if ((currentIndex + 1) % 100 === 0) {
      console.log(''); // 换行
      log(`进度: ${currentIndex + 1}/${allSymbols.length} (${progress}%) | 成功: ${stats.successCount} | 跳过: ${stats.skipCount}`);
    }
    
    // 保存状态
    saveState({
      lastIndex: currentIndex,
      lastSymbol: symbol,
      totalStocks: allSymbols.length,
      syncedCount: stats.successCount,
      startTime: stats.startTime.toISOString(),
      lastUpdateTime: new Date().toISOString(),
    });
    
    // 移动到下一个
    currentIndex++;
    if (currentIndex >= allSymbols.length) {
      // 完成一轮，退出
      console.log(''); // 换行
      printStats();
      log(`✅ 同步完成！共处理 ${allSymbols.length} 只股票`);
      
      // 删除状态文件（下次从头开始）
      try {
        fs.unlinkSync(STATE_FILE);
        log('已清除状态文件');
      } catch (e) {
        // 忽略
      }
      
      process.exit(0); // 正常退出
    }
    
    // 速率限制
    await sleep(REQUEST_INTERVAL_MS);
  }
}

// 优雅退出
process.on('SIGINT', () => {
  log('\n收到退出信号，正在保存状态...');
  printStats();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\n收到终止信号，正在保存状态...');
  printStats();
  process.exit(0);
});

// 启动
runSyncLoop().catch(e => {
  log(`致命错误: ${e}`, 'error');
  process.exit(1);
});
