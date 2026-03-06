/**
 * Redis cache key constants for the Smart Stock Analyzer
 * Centralizes all cache key patterns for consistency and maintainability
 */

export const CacheKeys = {
  // Stock data cache keys
  stock: {
    quote: (symbol: string) => `stock:quote:${symbol}`,
    detail: (symbol: string) => `stock:detail:${symbol}`,
    historical: (symbol: string, range: string) => `stock:historical:${symbol}:${range}`,
    search: (query: string) => `stock:search:${query.toLowerCase()}`,
    fundamentals: (symbol: string) => `stock:fundamentals:${symbol}`,
    technicals: (symbol: string) => `stock:technicals:${symbol}`,
  },

  // User data cache keys
  user: {
    settings: (userId: string) => `user:settings:${userId}`,
    watchlist: (userId: string) => `user:watchlist:${userId}`,
    alerts: (userId: string) => `user:alerts:${userId}`,
    session: (userId: string) => `user:session:${userId}`,
  },

  // News cache keys
  news: {
    stock: (symbol: string, page: number) => `news:stock:${symbol}:${page}`,
    sector: (sector: string, page: number) => `news:sector:${sector}:${page}`,
    latest: () => `news:latest`,
    impact: (newsId: string) => `news:impact:${newsId}`,
  },

  // Market data cache keys
  market: {
    indices: () => `market:indices`,
    heatmap: () => `market:heatmap`,
    gainers: () => `market:gainers`,
    losers: () => `market:losers`,
    mostActive: () => `market:most_active`,
    sentiment: () => `market:sentiment`,
  },

  // Screener cache keys
  screener: {
    results: (hash: string) => `screener:results:${hash}`,
    templates: (userId: string) => `screener:templates:${userId}`,
  },

  // Earnings and events cache keys
  earnings: {
    calendar: (date: string) => `earnings:calendar:${date}`,
    stock: (symbol: string) => `earnings:stock:${symbol}`,
  },

  // Dividend cache keys
  dividend: {
    calendar: (date: string) => `dividend:calendar:${date}`,
    stock: (symbol: string) => `dividend:stock:${symbol}`,
  },

  // Insider trading cache keys
  insider: {
    stock: (symbol: string) => `insider:stock:${symbol}`,
    recent: () => `insider:recent`,
  },

  // Stock events cache keys (timeline events)
  events: {
    stock: (symbol: string, range: string) => `events:stock:${symbol}:${range}`,
  },

  // Quant rating cache keys
  quant: {
    rating: (symbol: string) => `quant:rating:${symbol}`,
    sectorRanking: (sector: string) => `quant:sector_ranking:${sector}`,
    history: (symbol: string) => `quant:history:${symbol}`,
    changes: (symbol: string) => `quant:changes:${symbol}`,
  },

  // Analyst rating cache keys
  analyst: {
    rating: (symbol: string) => `analyst:rating:${symbol}`,
    history: (symbol: string) => `analyst:history:${symbol}`,
  },

  // SEC filings cache keys
  sec: {
    filings: (symbol: string) => `sec:filings:${symbol}`,
    recent: () => `sec:recent`,
  },

  // Transcript cache keys
  transcript: {
    list: (symbol: string) => `transcript:list:${symbol}`,
    detail: (transcriptId: string) => `transcript:detail:${transcriptId}`,
    summary: (transcriptId: string) => `transcript:summary:${transcriptId}`,
    keyStatements: (transcriptId: string) => `transcript:key_statements:${transcriptId}`,
  },

  // Sector cache keys
  sector: {
    list: () => `sector:list`,
    detail: (sectorId: string) => `sector:detail:${sectorId}`,
    stocks: (sectorId: string) => `sector:stocks:${sectorId}`,
    news: (sectorName: string) => `sector:news:${sectorName}`,
    performance: (sectorId: string) => `sector:performance:${sectorId}`,
  },

  // Portfolio cache keys
  portfolio: {
    summary: (portfolioId: string) => `portfolio:summary:${portfolioId}`,
    holdings: (portfolioId: string) => `portfolio:holdings:${portfolioId}`,
  },

  // Push/notification cache keys
  push: {
    offlineMessages: (userId: string) => `push:offline:${userId}`,
    userOnline: (userId: string) => `push:online:${userId}`,
  },
} as const;

/**
 * Default TTL (Time To Live) values in seconds for different cache types
 * 
 * 缓存策略说明：
 * - 实时数据（股价）：15-30秒，需要高实时性
 * - 日内变化数据（热力图、涨跌榜）：1-2分钟
 * - 新闻：5-15分钟，新闻发布频率中等
 * - 公司基本信息：24小时，很少变化
 * - 财务指标：24小时，季度更新
 * - 分析师评级：12小时，每天可能有几次更新
 * - 内部交易：6小时，每天可能有几次SEC披露
 * - SEC文件：6小时，每天可能有几次提交
 * - 历史K线：24小时，收盘后才更新
 */
export const CacheTTL = {
  // 实时数据 - 极短TTL（秒级）
  quote: 15, // 15秒 - 股价需要实时性
  indices: 30, // 30秒 - 市场指数

  // 日内变化数据 - 短TTL（分钟级）
  heatmap: 120, // 2分钟 - 热力图
  gainersLosers: 120, // 2分钟 - 涨跌榜
  news: 900, // 15分钟 - 新闻

  // 相对稳定数据 - 中等TTL（小时级）
  stockDetail: 86400, // 24小时 - 公司基本信息（名称、行业等）
  fundamentals: 86400, // 24小时 - 财务指标（季度更新）
  technicals: 900, // 15分钟 - 技术指标（基于价格计算）
  historical: 86400, // 24小时 - 历史K线（收盘后更新）
  search: 3600, // 1小时 - 搜索结果

  // 用户数据 - 中等TTL
  userSettings: 1800, // 30分钟 - 用户设置
  watchlist: 300, // 5分钟 - 自选股
  alerts: 300, // 5分钟 - 提醒

  // 事件数据 - 根据更新频率设置
  earnings: 21600, // 6小时 - 财报日历（每天更新几次）
  dividend: 86400, // 24小时 - 股息信息（很少变化）
  insider: 21600, // 6小时 - 内部交易（每天可能有几次SEC披露）
  secFilings: 21600, // 6小时 - SEC文件（每天可能有几次提交）
  transcript: 86400, // 24小时 - 电话会议记录（发布后不变）
  events: 21600, // 6小时 - 时间轴事件汇总

  // 评级数据 - 中等TTL
  quantRating: 86400, // 24小时 - 量化评级（每天更新一次）
  analystRating: 43200, // 12小时 - 分析师评级（每天可能有几次更新）

  // 板块数据 - 长TTL
  sectorList: 86400, // 24小时 - 板块列表（很少变化）
  sectorDetail: 3600, // 1小时 - 板块详情

  // 筛选器 - 短TTL
  screenerResults: 300, // 5分钟 - 筛选结果
  templates: 1800, // 30分钟 - 筛选模板

  // 会话数据
  userSession: 86400, // 24小时 - 用户会话
  offlineMessages: 604800, // 7天 - 离线消息
} as const;


// Legacy exports for backward compatibility
export const CACHE_KEYS = {
  STOCK_QUOTE: 'stock:quote',
  STOCK_DETAIL: 'stock:detail',
  STOCK_HISTORICAL: 'stock:historical',
  STOCK_SEARCH: 'stock:search',
  USER_SETTINGS: 'user:settings',
  USER_WATCHLIST: 'user:watchlist',
  NEWS_LATEST: 'news:latest',
  NEWS_STOCK: 'news:stock',
  SECTOR_NEWS: 'sector:news',
  SECTOR_PERFORMANCE: 'sector:performance',
  MARKET_INDICES: 'market:indices',
  MARKET_HEATMAP: 'market:heatmap',
  EARNINGS_CALENDAR: 'earnings:calendar',
  DIVIDEND_CALENDAR: 'dividend:calendar',
  INSIDER_RECENT: 'insider:recent',
  QUANT_RATING: 'quant:rating',
  ANALYST_RATING: 'analyst:rating',
  SEC_FILINGS: 'sec:filings',
  TRANSCRIPT_LIST: 'transcript:list',
} as const;

export const CACHE_TTL = {
  STOCK_QUOTE: CacheTTL.quote,
  STOCK_DETAIL: CacheTTL.stockDetail,
  NEWS: CacheTTL.news,
  SECTOR_NEWS: 300, // 5 minutes
  SECTOR_PERFORMANCE: 60, // 1 minute
  MARKET_INDICES: CacheTTL.indices,
  EARNINGS: CacheTTL.earnings,
  DIVIDEND: CacheTTL.dividend,
  INSIDER: CacheTTL.insider,
  QUANT_RATING: CacheTTL.quantRating,
  ANALYST_RATING: CacheTTL.analystRating,
  SEC_FILINGS: CacheTTL.secFilings,
  TRANSCRIPT: CacheTTL.transcript,
} as const;
