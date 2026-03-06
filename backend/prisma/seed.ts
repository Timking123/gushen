import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 示例股票数据
const stocks = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', sector: 'Technology', industry: 'Consumer Electronics', marketCap: 2800000000000, country: 'US' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', sector: 'Technology', industry: 'Software', marketCap: 2900000000000, country: 'US' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', sector: 'Technology', industry: 'Internet Services', marketCap: 1800000000000, country: 'US' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ', sector: 'Consumer Cyclical', industry: 'E-Commerce', marketCap: 1600000000000, country: 'US' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', sector: 'Technology', industry: 'Semiconductors', marketCap: 1200000000000, country: 'US' },
  { symbol: 'META', name: 'Meta Platforms Inc.', exchange: 'NASDAQ', sector: 'Technology', industry: 'Social Media', marketCap: 900000000000, country: 'US' },
  { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', marketCap: 700000000000, country: 'US' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE', sector: 'Financial Services', industry: 'Banks', marketCap: 500000000000, country: 'US' },
  { symbol: 'V', name: 'Visa Inc.', exchange: 'NYSE', sector: 'Financial Services', industry: 'Credit Services', marketCap: 480000000000, country: 'US' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', exchange: 'NYSE', sector: 'Healthcare', industry: 'Drug Manufacturers', marketCap: 450000000000, country: 'US' },
  { symbol: 'WMT', name: 'Walmart Inc.', exchange: 'NYSE', sector: 'Consumer Defensive', industry: 'Discount Stores', marketCap: 420000000000, country: 'US' },
  { symbol: 'PG', name: 'Procter & Gamble Co.', exchange: 'NYSE', sector: 'Consumer Defensive', industry: 'Household Products', marketCap: 380000000000, country: 'US' },
  { symbol: 'MA', name: 'Mastercard Inc.', exchange: 'NYSE', sector: 'Financial Services', industry: 'Credit Services', marketCap: 370000000000, country: 'US' },
  { symbol: 'HD', name: 'Home Depot Inc.', exchange: 'NYSE', sector: 'Consumer Cyclical', industry: 'Home Improvement', marketCap: 350000000000, country: 'US' },
  { symbol: 'DIS', name: 'Walt Disney Co.', exchange: 'NYSE', sector: 'Communication Services', industry: 'Entertainment', marketCap: 200000000000, country: 'US' },
  // 指数
  { symbol: 'DJI', name: '道琼斯工业平均指数', exchange: 'INDEX', sector: null, industry: null, marketCap: null, country: 'US' },
  { symbol: 'SPX', name: '标普500指数', exchange: 'INDEX', sector: null, industry: null, marketCap: null, country: 'US' },
  { symbol: 'IXIC', name: '纳斯达克综合指数', exchange: 'INDEX', sector: null, industry: null, marketCap: null, country: 'US' },
];

// 生成随机报价数据
function generateQuote(symbol: string, basePrice: number) {
  const changePercent = (Math.random() - 0.5) * 6; // -3% to +3%
  const change = basePrice * (changePercent / 100);
  const price = basePrice + change;
  const previousClose = basePrice;
  const open = previousClose * (1 + (Math.random() - 0.5) * 0.02);
  const high = Math.max(price, open) * (1 + Math.random() * 0.01);
  const low = Math.min(price, open) * (1 - Math.random() * 0.01);

  return {
    symbol,
    price: Math.round(price * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    previousClose: Math.round(previousClose * 100) / 100,
    open: Math.round(open * 100) / 100,
    high: Math.round(high * 100) / 100,
    low: Math.round(low * 100) / 100,
    volume: BigInt(Math.floor(Math.random() * 50000000) + 1000000),
    avgVolume: BigInt(Math.floor(Math.random() * 30000000) + 5000000),
    timestamp: new Date(),
  };
}

// 基础价格
const basePrices: Record<string, number> = {
  'AAPL': 185,
  'MSFT': 415,
  'GOOGL': 155,
  'AMZN': 180,
  'NVDA': 880,
  'META': 500,
  'TSLA': 250,
  'JPM': 195,
  'V': 280,
  'JNJ': 160,
  'WMT': 165,
  'PG': 165,
  'MA': 460,
  'HD': 380,
  'DIS': 115,
  'DJI': 38500,
  'SPX': 5100,
  'IXIC': 16200,
};

// 生成历史数据
function generateHistoricalData(symbol: string, basePrice: number, days: number = 365) {
  const data = [];
  let currentPrice = basePrice * 0.85; // 从较低价格开始
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(16, 0, 0, 0); // 收盘时间

    // 随机波动
    const dailyChange = (Math.random() - 0.48) * 0.03; // 略微向上偏移
    currentPrice = currentPrice * (1 + dailyChange);
    
    const open = currentPrice * (1 + (Math.random() - 0.5) * 0.02);
    const high = Math.max(currentPrice, open) * (1 + Math.random() * 0.015);
    const low = Math.min(currentPrice, open) * (1 - Math.random() * 0.015);

    data.push({
      symbol,
      timestamp: date,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(currentPrice * 100) / 100,
      volume: BigInt(Math.floor(Math.random() * 50000000) + 1000000),
    });
  }

  return data;
}

// 示例新闻数据
const newsItems = [
  { title: 'Apple发布新款iPhone，市场反应积极', summary: 'Apple公司今日发布了最新款iPhone，搭载全新A18芯片，性能提升显著。分析师预计这将推动公司第四季度销售增长。', source: 'TechNews', url: 'https://example.com/news/1', symbols: ['AAPL'], sectors: ['Technology'] },
  { title: 'Microsoft云业务持续增长', summary: 'Microsoft Azure云服务收入同比增长29%，超出市场预期。公司表示AI服务需求强劲是主要推动力。', source: 'BusinessDaily', url: 'https://example.com/news/2', symbols: ['MSFT'], sectors: ['Technology'] },
  { title: 'NVIDIA发布新一代AI芯片', summary: 'NVIDIA推出H200 GPU，AI训练性能提升2倍。多家科技巨头已下单采购。', source: 'ChipWorld', url: 'https://example.com/news/3', symbols: ['NVDA'], sectors: ['Technology'] },
  { title: '特斯拉降价引发市场担忧', summary: '特斯拉宣布在中国市场降价5%，分析师担忧这可能影响利润率。', source: 'AutoNews', url: 'https://example.com/news/4', symbols: ['TSLA'], sectors: ['Consumer Cyclical'] },
  { title: '美联储暗示可能降息', summary: '美联储主席表示通胀正在降温，市场预期年内可能降息。金融股普遍上涨。', source: 'FinanceToday', url: 'https://example.com/news/5', symbols: ['JPM', 'V', 'MA'], sectors: ['Financial Services'] },
  { title: 'Meta元宇宙投资持续', summary: 'Meta公司表示将继续投资元宇宙和AI技术，预计2024年资本支出将增加。', source: 'TechInsider', url: 'https://example.com/news/6', symbols: ['META'], sectors: ['Technology'] },
  { title: '亚马逊AWS推出新服务', summary: '亚马逊云服务推出多项AI相关新功能，进一步巩固云计算市场领先地位。', source: 'CloudNews', url: 'https://example.com/news/7', symbols: ['AMZN'], sectors: ['Consumer Cyclical', 'Technology'] },
  { title: '谷歌搜索市场份额稳定', summary: '尽管面临AI搜索竞争，谷歌搜索市场份额保持在90%以上。', source: 'SearchDaily', url: 'https://example.com/news/8', symbols: ['GOOGL'], sectors: ['Technology'] },
];

async function main() {
  console.log('🌱 开始填充种子数据...');

  // 清理现有数据
  console.log('🧹 清理现有数据...');
  await prisma.newsItemStock.deleteMany();
  await prisma.oHLCV.deleteMany();
  await prisma.stockQuote.deleteMany();
  await prisma.newsItem.deleteMany();
  await prisma.watchlistItem.deleteMany();
  await prisma.stock.deleteMany();

  // 创建股票
  console.log('📈 创建股票数据...');
  for (const stock of stocks) {
    await prisma.stock.create({
      data: {
        symbol: stock.symbol,
        name: stock.name,
        exchange: stock.exchange,
        sector: stock.sector,
        industry: stock.industry,
        marketCap: stock.marketCap ? BigInt(stock.marketCap) : null,
        country: stock.country,
      },
    });
    console.log(`  ✓ ${stock.symbol} - ${stock.name}`);
  }

  // 创建报价数据
  console.log('💹 创建报价数据...');
  for (const stock of stocks) {
    const basePrice = basePrices[stock.symbol] || 100;
    const quote = generateQuote(stock.symbol, basePrice);
    await prisma.stockQuote.create({ data: quote });
    console.log(`  ✓ ${stock.symbol} 报价: $${quote.price}`);
  }

  // 创建历史数据（只为主要股票创建，减少数据量）
  console.log('📊 创建历史数据...');
  const mainStocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA'];
  for (const symbol of mainStocks) {
    const basePrice = basePrices[symbol];
    const historicalData = generateHistoricalData(symbol, basePrice, 180); // 6个月数据
    
    for (const data of historicalData) {
      await prisma.oHLCV.create({ data });
    }
    console.log(`  ✓ ${symbol} 历史数据 (${historicalData.length} 条)`);
  }

  // 创建新闻
  console.log('📰 创建新闻数据...');
  for (const news of newsItems) {
    const newsItem = await prisma.newsItem.create({
      data: {
        title: news.title,
        summary: news.summary,
        source: news.source,
        url: news.url,
        sectors: news.sectors,
        publishedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // 过去7天内
      },
    });
    
    // 创建新闻与股票的关联
    for (const symbol of news.symbols) {
      await prisma.newsItemStock.create({
        data: {
          newsId: newsItem.id,
          symbol: symbol,
        },
      });
    }
    
    console.log(`  ✓ ${news.title.substring(0, 30)}...`);
  }

  console.log('✅ 种子数据填充完成！');
}

main()
  .catch((e) => {
    console.error('❌ 种子数据填充失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
