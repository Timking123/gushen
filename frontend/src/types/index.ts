// User types
export interface User {
  id: string
  email: string
  createdAt: Date
  updatedAt: Date
}

export interface UserSettings {
  userId: string
  theme: 'light' | 'dark' | 'system'
  language: 'zh' | 'en'
  timezone: string
  pushEnabled: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
  priceAlertThreshold: number
  investmentPreferences: string[]
}

// Stock types
export interface Stock {
  symbol: string
  name: string
  exchange: string
  sector: string
  industry: string
  marketCap: number
  country: string
}

export interface StockQuote {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  avgVolume: number
  high: number
  low: number
  open: number
  previousClose: number
  timestamp: Date
}

// Watchlist types
export interface WatchlistItem {
  userId: string
  symbol: string
  addedAt: Date
  sortOrder: number
  notes: string | null
}

// Dividend types
/**
 * Dividend frequency type
 */
export type DividendFrequency = 'annual' | 'semi_annual' | 'quarterly' | 'monthly'

/**
 * Dividend event
 * Implements Requirement 15.1: Display dividend information
 */
export interface DividendEvent {
  id: string
  symbol: string
  stockName?: string
  exDate: string
  payDate: string
  recordDate: string
  amount: number
  frequency: DividendFrequency
  yield: number | null
}

/**
 * Dividend summary for a stock
 * Implements Requirement 15.1: Display dividend rate, frequency, and history
 */
export interface DividendSummary {
  symbol: string
  stockName?: string
  currentYield: number | null
  annualDividend: number | null
  frequency: DividendFrequency | null
  payoutRatio: number | null
  dividendGrowthRate: number | null
  consecutiveYears: number
  lastExDate: string | null
  lastPayDate: string | null
  lastAmount: number | null
  nextExDate: string | null
  nextPayDate: string | null
  nextAmount: number | null
}

/**
 * Dividend history item
 */
export interface DividendHistoryItem {
  id: string
  exDate: string
  payDate: string
  amount: number
  yield: number | null
}

/**
 * Dividend calendar entry
 * Implements Requirement 15.2: Display upcoming ex-dividend and pay dates
 */
export interface DividendCalendarEntry {
  id: string
  symbol: string
  stockName?: string
  exDate: string
  payDate: string
  recordDate: string
  amount: number
  yield: number | null
}

// News types
export interface NewsItem {
  id: string
  title: string
  summary: string | null
  content: string | null
  source: string
  sourceCredibility: 'high' | 'medium' | 'low'
  url: string
  publishedAt: Date
  symbols: string[]
  sectors: string[]
  impactAnalysis: ImpactAnalysis | null
}

export interface ImpactAnalysis {
  newsId: string
  direction: 'bullish' | 'bearish' | 'neutral'
  magnitude: 'high' | 'medium' | 'low'
  confidence: number
  summary: string
  keyPoints: string[]
  historicalComparison: string | null
  analyzedAt: Date
}

export interface NewsFeedItem extends NewsItem {
  priority: 'high' | 'medium' | 'low'
}

// Alert types
export interface Alert {
  id: string
  userId: string
  type: 'price' | 'news' | 'earnings' | 'dividend' | 'insider' | 'rating'
  symbol: string | null
  sector: string | null
  title: string
  message: string
  priority: 'high' | 'medium' | 'low'
  read: boolean
  createdAt: Date
  metadata: Record<string, unknown>
}

// Quant Rating types
/**
 * Overall rating classification
 * Implements Requirement 13.1: 显示综合量化评级
 */
export type OverallRating = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'

/**
 * Quant Rating interface
 * Implements Requirements:
 * - 13.1: 显示综合量化评级（强烈买入/买入/持有/卖出/强烈卖出）
 * - 13.2: 基于估值、成长性、盈利能力、动量和修正因子计算
 * - 13.3: 展示各维度的具体得分
 * - 13.4: 显示该股票在板块和行业中的排名
 */
export interface QuantRating {
  symbol: string
  overallRating: OverallRating
  overallScore: number // 1-5 分
  valuationScore: number
  growthScore: number
  profitabilityScore: number
  momentumScore: number
  revisionsScore: number
  sectorRank: number | null
  industryRank: number | null
  updatedAt: string
}

/**
 * Rating history entry
 * Implements Requirement 13.5: 记录评级历史并支持查看变化趋势
 */
export interface RatingHistoryEntry {
  id: string
  symbol: string
  overallRating: OverallRating
  overallScore: number
  valuationScore: number
  growthScore: number
  profitabilityScore: number
  momentumScore: number
  revisionsScore: number
  recordedAt: string
}

/**
 * Rating change event
 * Implements Requirement 13.5: 评级变化追踪
 */
export interface RatingChangeEvent {
  symbol: string
  previousRating: OverallRating
  newRating: OverallRating
  previousScore: number
  newScore: number
  changedAt: string
}

// Transcript types
/**
 * Transcript event type
 * Implements Requirement 14.1: Display earnings call transcript list
 */
export type TranscriptEventType = 'earnings' | 'investor_day' | 'conference'

/**
 * Transcript section type
 */
export type TranscriptSectionType = 'prepared_remarks' | 'qa'

/**
 * Transcript participant
 * Implements Requirement 14.2: Display meeting participants
 */
export interface TranscriptParticipant {
  id: string
  name: string
  title: string | null
  company: string | null
}

/**
 * Transcript section
 * Implements Requirement 14.2: Display main topics
 */
export interface TranscriptSection {
  id: string
  type: TranscriptSectionType
  speaker: string
  content: string
}

/**
 * Transcript list item (without full content)
 */
export interface TranscriptListItem {
  id: string
  symbol: string
  stockName?: string
  quarter: string
  eventType: TranscriptEventType
  date: string
  participantCount: number
  aiSummary: string | null
  createdAt: string
}

/**
 * Full transcript with content
 * Implements Requirements:
 * - 14.1: Provide access to earnings call transcripts
 * - 14.2: Display meeting date, participants, main topics
 */
export interface Transcript {
  id: string
  symbol: string
  stockName?: string
  quarter: string
  eventType: TranscriptEventType
  date: string
  participants: TranscriptParticipant[]
  sections: TranscriptSection[]
  aiSummary: string | null
  createdAt: string
}

/**
 * AI Summary for transcript
 * Implements Requirement 14.5: Provide AI-generated meeting summary
 */
export interface TranscriptAISummary {
  transcriptId: string
  summary: string
  keyPoints: string[]
  sentiment: 'positive' | 'negative' | 'neutral'
  confidence: number
  generatedAt: string
}

/**
 * Key statement from transcript
 * Implements Requirement 14.6: Highlight key statements from management
 */
export interface KeyStatement {
  id: string
  sectionId: string
  speaker: string
  speakerTitle: string | null
  content: string
  type: 'guidance' | 'commitment' | 'strategy' | 'risk' | 'highlight'
  importance: 'high' | 'medium' | 'low'
  highlightedText: string
}

/**
 * Transcript with AI analysis
 * Implements Requirements 14.5, 14.6
 */
export interface TranscriptWithAnalysis extends Transcript {
  aiAnalysis?: {
    summary: TranscriptAISummary
    keyStatements: KeyStatement[]
  }
}

/**
 * Transcript search result
 * Implements Requirement 14.3: Support keyword search
 */
export interface TranscriptSearchResult {
  transcript: TranscriptListItem
  matchedSections: Array<{
    id: string
    type: TranscriptSectionType
    speaker: string
    content: string
    matchHighlight: string
  }>
  matchCount: number
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  message?: string
}

// Stock Detail Page types
// Implements Requirements: 6.1-6.6, 7.1-7.5, 8.1-8.6

/**
 * Financial metrics for a stock
 * Implements Requirements:
 * - 6.1: 显示市盈率（PE）、市净率（PB）、市销率（PS）
 * - 6.2: 显示每股收益（EPS）和收益增长率
 * - 6.3: 显示营收和营收增长率
 * - 6.4: 显示毛利率、营业利润率、净利率
 * - 6.5: 显示 ROE、ROA、负债权益比
 */
export interface FinancialMetrics {
  // 估值指标
  pe: number | null;
  forwardPe: number | null;
  peg: number | null;
  ps: number | null;
  pb: number | null;
  
  // 盈利指标
  eps: number | null;
  epsGrowth: number | null;
  
  // 营收指标
  revenue: number | null;
  revenueGrowth: number | null;
  
  // 利润率
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  
  // 回报率
  roe: number | null;
  roa: number | null;
  
  // 负债
  debtToEquity: number | null;
  currentRatio: number | null;
  
  // 股息
  dividendYield: number | null;
  payoutRatio: number | null;
}

/**
 * Analyst rating summary
 * Implements Requirements:
 * - 7.1: 显示分析师评级汇总（强烈买入/买入/持有/卖出/强烈卖出的数量分布）
 * - 7.2: 显示平均目标价和当前价格的差距百分比
 */
export interface AnalystRatingSummary {
  symbol: string;
  totalAnalysts: number;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  averageTargetPrice: number | null;
  highTargetPrice: number | null;
  lowTargetPrice: number | null;
  currentPrice: number;
  upsidePercent: number | null;
}

/**
 * Individual analyst rating item
 * Implements Requirements:
 * - 7.3: 显示最近的分析师评级变动列表
 * - 7.4: 显示分析师姓名、所属机构、评级、目标价、评级日期
 */
export interface AnalystRatingItem {
  id: string;
  analyst: string;
  firm: string;
  rating: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  targetPrice: number | null;
  previousRating: string | null;
  previousTargetPrice: number | null;
  ratingDate: string;
}

/**
 * Insider trade record
 * Implements Requirements:
 * - 8.1: 显示最近的内部交易记录列表
 * - 8.2: 显示交易人姓名、职位、交易类型（买入/卖出）、股数、价格、交易日期
 */
export interface InsiderTrade {
  id: string;
  symbol: string;
  filedAt: string;
  tradeDate: string;
  insiderName: string;
  insiderTitle: string | null;
  transactionType: 'buy' | 'sell' | 'exercise';
  shares: number;
  pricePerShare: number;
  totalValue: number;
  sharesOwned: number | null;
}

/**
 * Insider trade summary
 * Implements Requirement 8.3: 显示近期内部交易的买入/卖出汇总统计
 */
export interface InsiderTradeSummary {
  symbol: string;
  period: string;  // e.g., "3M", "6M", "1Y"
  totalBuyShares: number;
  totalBuyValue: number;
  totalSellShares: number;
  totalSellValue: number;
  netShares: number;
  netValue: number;
  buyTransactions: number;
  sellTransactions: number;
}

/**
 * Company profile data
 * Implements Requirements:
 * - 2.1: 显示公司名称、股票代码、所属交易所
 * - 2.2: 显示公司所属行业和板块
 * - 2.3: 显示公司市值（格式化为易读形式）
 * - 2.4: 显示公司所在国家/地区
 */
export interface CompanyProfileData {
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  country: string | null;
  description?: string;
  website?: string;
  employees?: number;
  founded?: string;
  logo?: string;
  phone?: string;
  ipo?: string;
  shareOutstanding?: number;
}

/**
 * Real-time quote data
 * Implements Requirements:
 * - 4.1: 显示当前股价、涨跌金额、涨跌幅百分比
 * - 4.5: 显示今日开盘价、最高价、最低价、昨收价
 * - 4.6: 显示成交量和平均成交量
 */
export interface QuoteData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  avgVolume: number | null;
  timestamp: string;
}

/**
 * Complete stock detail response
 * Aggregates all stock detail data for the stock detail page
 */
export interface StockDetailResponse {
  profile: CompanyProfileData;
  quote: QuoteData;
  financials: FinancialMetrics;
  analystRatings: AnalystRatingSummary;
  recentRatings: AnalystRatingItem[];
  insiderSummary: InsiderTradeSummary;
  recentInsiderTrades: InsiderTrade[];
}
