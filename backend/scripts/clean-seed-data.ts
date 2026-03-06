import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 这些是 seed.ts 中创建的假股票
const seedStockSymbols = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  'JPM', 'V', 'JNJ', 'WMT', 'PG', 'MA', 'HD', 'DIS',
  'DJI', 'SPX', 'IXIC'
];

async function main() {
  console.log('🧹 开始清理种子数据...\n');

  // 统计当前数据
  const totalStocks = await prisma.stock.count();
  const totalQuotes = await prisma.stockQuote.count();
  const totalOHLCV = await prisma.oHLCV.count();
  const totalNews = await prisma.newsItem.count();
  
  console.log('📊 当前数据统计:');
  console.log(`  - 股票: ${totalStocks}`);
  console.log(`  - 报价: ${totalQuotes}`);
  console.log(`  - 历史数据: ${totalOHLCV}`);
  console.log(`  - 新闻: ${totalNews}`);
  console.log('');

  // 检查哪些种子股票还存在
  const existingSeedStocks = await prisma.stock.findMany({
    where: {
      symbol: { in: seedStockSymbols }
    },
    select: { symbol: true }
  });

  if (existingSeedStocks.length === 0) {
    console.log('✅ 没有找到种子数据中的股票，可能已经被清理或被真实数据覆盖。');
    return;
  }

  console.log(`🔍 找到 ${existingSeedStocks.length} 个种子股票:`);
  existingSeedStocks.forEach(s => console.log(`  - ${s.symbol}`));
  console.log('');

  // 检查这些股票是否在用户的自选股中
  const watchlistItems = await prisma.watchlistItem.findMany({
    where: {
      symbol: { in: seedStockSymbols }
    },
    select: { symbol: true, userId: true }
  });

  if (watchlistItems.length > 0) {
    console.log('⚠️  警告: 以下种子股票在用户自选股中:');
    watchlistItems.forEach(w => console.log(`  - ${w.symbol}`));
    console.log('');
    console.log('删除这些股票会同时删除用户的自选股记录。');
    console.log('如果你想保留这些股票，请先从自选股中移除它们。');
    console.log('');
  }

  // 删除种子新闻数据
  console.log('🗑️  删除种子新闻数据...');
  const deletedNewsStocks = await prisma.newsItemStock.deleteMany({
    where: {
      symbol: { in: seedStockSymbols }
    }
  });
  console.log(`  - 删除了 ${deletedNewsStocks.count} 条新闻-股票关联`);

  // 删除没有关联股票的新闻
  const orphanNews = await prisma.newsItem.findMany({
    where: {
      stocks: { none: {} }
    },
    select: { id: true }
  });
  
  if (orphanNews.length > 0) {
    await prisma.newsItem.deleteMany({
      where: {
        id: { in: orphanNews.map(n => n.id) }
      }
    });
    console.log(`  - 删除了 ${orphanNews.length} 条孤立新闻`);
  }

  // 删除种子历史数据
  console.log('🗑️  删除种子历史数据...');
  const deletedOHLCV = await prisma.oHLCV.deleteMany({
    where: {
      symbol: { in: seedStockSymbols }
    }
  });
  console.log(`  - 删除了 ${deletedOHLCV.count} 条历史数据`);

  // 删除种子报价数据
  console.log('🗑️  删除种子报价数据...');
  const deletedQuotes = await prisma.stockQuote.deleteMany({
    where: {
      symbol: { in: seedStockSymbols }
    }
  });
  console.log(`  - 删除了 ${deletedQuotes.count} 条报价数据`);

  // 注意：不删除股票本身，因为真实 API 可能也同步了这些股票
  // 如果你确定要删除，取消下面的注释

  // console.log('🗑️  删除种子股票...');
  // const deletedStocks = await prisma.stock.deleteMany({
  //   where: {
  //     symbol: { in: seedStockSymbols }
  //   }
  // });
  // console.log(`  - 删除了 ${deletedStocks.count} 只股票`);

  console.log('');
  console.log('✅ 种子数据清理完成！');
  console.log('');
  console.log('注意: 股票基本信息没有被删除，因为真实 API 可能也同步了这些股票。');
  console.log('如果你想完全删除这些股票，请编辑脚本取消相关注释。');
}

main()
  .catch((e) => {
    console.error('❌ 清理失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
