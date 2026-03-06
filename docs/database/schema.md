# 数据库设计文档

> 最后更新: 2026-03-05

## 数据源配置

- **数据库类型**: postgresql
- **连接配置**: env("DATABASE_URL")

## 枚举类型

### UserRole

============================================ Enums ============================================

**可选值**:
- `USER`
- `PREMIUM`
- `ADMIN`

## 数据模型

### User

============================================ User Related Models ============================================ User model - core user authentication

**数据库表名**: `users`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| email | String |  | ✓ |  |  |
| passwordHash (`password_hash`) | String |  |  |  |  |
| role | UserRole |  |  | `USER` |  |
| permissions | String[] |  |  | `[]` |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |
| updatedAt (`updated_at`) | DateTime |  |  |  |  |
| lastLoginAt (`last_login_at`) | DateTime |  |  |  |  |
| settings | UserSettings |  |  |  |  |
| watchlistItems | WatchlistItem[] |  |  |  |  |
| portfolios | Portfolio[] |  |  |  |  |
| alerts | Alert[] |  |  |  |  |
| priceAlerts | PriceAlert[] |  |  |  |  |
| sectorSubscriptions | SectorSubscription[] |  |  |  |  |
| screenerTemplates | ScreenerTemplate[] |  |  |  |  |
| auditLogs | AuditLog[] |  |  |  |  |

**索引**:
- `role`

### AuditLog

Audit log - records permission and role changes

**数据库表名**: `audit_logs`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| userId (`user_id`) | String |  |  |  |  |
| action | String |  |  |  |  |
| resource | String |  |  |  |  |
| details | Json |  |  |  |  |
| ipAddress (`ip_address`) | String |  |  |  |  |
| userAgent (`user_agent`) | String |  |  |  |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |
| user | User |  |  |  | 关联到 User |

**索引**:
- `userId`
- `action`
- `createdAt`

**关系**:
- `user`: 通过 `userId` 关联到 `User.id`

### UserSettings

User settings - preferences and configuration

**数据库表名**: `user_settings`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| userId (`user_id`) | String |  | ✓ |  |  |
| theme | String |  |  | `system` |  |
| language | String |  |  | `zh` |  |
| timezone | String |  |  | `Asia/Shanghai` |  |
| pushEnabled (`push_enabled`) | Boolean |  |  | `true` |  |
| quietHoursStart (`quiet_hours_start`) | String |  |  |  |  |
| quietHoursEnd (`quiet_hours_end`) | String |  |  |  |  |
| priceAlertThreshold (`price_alert_threshold`) | Float |  |  | `5` |  |
| investmentPreferences (`investment_preferences`) | String[] |  |  | `[]` |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |
| updatedAt (`updated_at`) | DateTime |  |  |  |  |
| user | User |  |  |  | 关联到 User |

**关系**:
- `user`: 通过 `userId` 关联到 `User.id`

### WatchlistItem

Watchlist item - user's stock watchlist

**数据库表名**: `watchlist_items`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| userId (`user_id`) | String |  |  |  |  |
| symbol | String |  |  |  |  |
| addedAt (`added_at`) | DateTime |  |  | `now()` |  |
| sortOrder (`sort_order`) | Int |  |  | `0` |  |
| notes | String |  |  |  |  |
| user | User |  |  |  | 关联到 User |
| stock | Stock |  |  |  | 关联到 Stock |

**索引**:
- `userId`

**唯一约束**:
- `userId, symbol`

**关系**:
- `user`: 通过 `userId` 关联到 `User.id`
- `stock`: 通过 `symbol` 关联到 `Stock.symbol`

### Stock

============================================ Stock Related Models ============================================ Stock - basic stock information

**数据库表名**: `stocks`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| symbol | String |  | ✓ |  | 主键  |
| name | String |  |  |  |  |
| exchange | String |  |  |  |  |
| sector | String |  |  |  |  |
| industry | String |  |  |  |  |
| marketCap (`market_cap`) | BigInt |  |  |  |  |
| country | String |  |  |  |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |
| updatedAt (`updated_at`) | DateTime |  |  |  |  |
| watchlistItems | WatchlistItem[] |  |  |  |  |
| quotes | StockQuote[] |  |  |  |  |
| quantRatings | QuantRating[] |  |  |  |  |
| fundamentalMetrics | FundamentalMetrics |  |  |  |  |
| technicalIndicators | TechnicalIndicators |  |  |  |  |
| newsItems | NewsItemStock[] |  |  |  |  |
| earningsEvents | EarningsEvent[] |  |  |  |  |
| dividendEvents | DividendEvent[] |  |  |  |  |
| insiderTrades | InsiderTrade[] |  |  |  |  |
| secFilings | SECFiling[] |  |  |  |  |
| transcripts | Transcript[] |  |  |  |  |
| analystRatings | AnalystRating[] |  |  |  |  |
| portfolioHoldings | PortfolioHolding[] |  |  |  |  |

**索引**:
- `sector`
- `exchange`
- `industry`
- `marketCap`

### StockQuote

Stock quote - real-time price data

**数据库表名**: `stock_quotes`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| symbol | String |  |  |  |  |
| price | Float |  |  |  |  |
| change | Float |  |  |  |  |
| changePercent (`change_percent`) | Float |  |  |  |  |
| volume | BigInt |  |  |  |  |
| avgVolume (`avg_volume`) | BigInt |  |  |  |  |
| high | Float |  |  |  |  |
| low | Float |  |  |  |  |
| open | Float |  |  |  |  |
| previousClose (`previous_close`) | Float |  |  |  |  |
| timestamp | DateTime |  |  | `now()` |  |
| stock | Stock |  |  |  | 关联到 Stock |

**索引**:
- `symbol, timestamp`

**关系**:
- `stock`: 通过 `symbol` 关联到 `Stock.symbol`

### OHLCV

OHLCV - historical price data

**数据库表名**: `ohlcv`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| symbol | String |  |  |  |  |
| timestamp | DateTime |  |  |  |  |
| open | Float |  |  |  |  |
| high | Float |  |  |  |  |
| low | Float |  |  |  |  |
| close | Float |  |  |  |  |
| volume | BigInt |  |  |  |  |

**索引**:
- `symbol, timestamp`

**唯一约束**:
- `symbol, timestamp`

### QuantRating

Quant rating - quantitative stock rating

**数据库表名**: `quant_ratings`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| symbol | String |  |  |  |  |
| overallRating (`overall_rating`) | String |  |  |  |  |
| overallScore (`overall_score`) | Float |  |  |  |  |
| valuationScore (`valuation_score`) | Float |  |  |  |  |
| growthScore (`growth_score`) | Float |  |  |  |  |
| profitabilityScore (`profitability_score`) | Float |  |  |  |  |
| momentumScore (`momentum_score`) | Float |  |  |  |  |
| revisionsScore (`revisions_score`) | Float |  |  |  |  |
| sectorRank (`sector_rank`) | Int |  |  |  |  |
| industryRank (`industry_rank`) | Int |  |  |  |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |
| updatedAt (`updated_at`) | DateTime |  |  |  |  |
| stock | Stock |  |  |  | 关联到 Stock |

**索引**:
- `symbol`
- `overallRating`

**关系**:
- `stock`: 通过 `symbol` 关联到 `Stock.symbol`

### FundamentalMetrics

Fundamental metrics - financial metrics for fundamental analysis

**数据库表名**: `fundamental_metrics`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| symbol | String |  | ✓ |  |  |
| pe | Float |  |  |  |  |
| forwardPe (`forward_pe`) | Float |  |  |  |  |
| peg | Float |  |  |  |  |
| ps | Float |  |  |  |  |
| pb | Float |  |  |  |  |
| eps | Float |  |  |  |  |
| epsGrowth (`eps_growth`) | Float |  |  |  |  |
| revenue | BigInt |  |  |  |  |
| revenueGrowth (`revenue_growth`) | Float |  |  |  |  |
| grossMargin (`gross_margin`) | Float |  |  |  |  |
| operatingMargin (`operating_margin`) | Float |  |  |  |  |
| netMargin (`net_margin`) | Float |  |  |  |  |
| roe | Float |  |  |  |  |
| roa | Float |  |  |  |  |
| debtToEquity (`debt_to_equity`) | Float |  |  |  |  |
| currentRatio (`current_ratio`) | Float |  |  |  |  |
| dividendYield (`dividend_yield`) | Float |  |  |  |  |
| payoutRatio (`payout_ratio`) | Float |  |  |  |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |
| updatedAt (`updated_at`) | DateTime |  |  |  |  |
| stock | Stock |  |  |  | 关联到 Stock |

**关系**:
- `stock`: 通过 `symbol` 关联到 `Stock.symbol`

### TechnicalIndicators

Technical indicators - technical analysis indicators

**数据库表名**: `technical_indicators`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| symbol | String |  | ✓ |  |  |
| rsi14 (`rsi_14`) | Float |  |  |  |  |
| macdValue (`macd_value`) | Float |  |  |  |  |
| macdSignal (`macd_signal`) | Float |  |  |  |  |
| macdHistogram (`macd_histogram`) | Float |  |  |  |  |
| sma20 (`sma_20`) | Float |  |  |  |  |
| sma50 (`sma_50`) | Float |  |  |  |  |
| sma200 (`sma_200`) | Float |  |  |  |  |
| ema12 (`ema_12`) | Float |  |  |  |  |
| ema26 (`ema_26`) | Float |  |  |  |  |
| bollingerUpper (`bollinger_upper`) | Float |  |  |  |  |
| bollingerMiddle (`bollinger_middle`) | Float |  |  |  |  |
| bollingerLower (`bollinger_lower`) | Float |  |  |  |  |
| atr14 (`atr_14`) | Float |  |  |  |  |
| adx14 (`adx_14`) | Float |  |  |  |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |
| updatedAt (`updated_at`) | DateTime |  |  |  |  |
| stock | Stock |  |  |  | 关联到 Stock |

**关系**:
- `stock`: 通过 `symbol` 关联到 `Stock.symbol`

### NewsItem

============================================ News and Analysis Models ============================================ News item - aggregated news

**数据库表名**: `news_items`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| title | String |  |  |  |  |
| summary | String |  |  |  |  |
| content | String |  |  |  |  |
| source | String |  |  |  |  |
| sourceCredibility (`source_credibility`) | String |  |  | `medium` |  |
| url | String |  |  |  |  |
| publishedAt (`published_at`) | DateTime |  |  |  |  |
| sectors | String[] |  |  | `[]` |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |
| stocks | NewsItemStock[] |  |  |  |  |
| impactAnalysis | ImpactAnalysis |  |  |  |  |

**索引**:
- `publishedAt`

### NewsItemStock

Many-to-many relation between news and stocks

**数据库表名**: `news_item_stocks`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| newsId (`news_id`) | String |  |  |  |  |
| symbol | String |  |  |  |  |
| news | NewsItem |  |  |  | 关联到 NewsItem |
| stock | Stock |  |  |  | 关联到 Stock |

**关系**:
- `news`: 通过 `newsId` 关联到 `NewsItem.id`
- `stock`: 通过 `symbol` 关联到 `Stock.symbol`

### ImpactAnalysis

Impact analysis - AI-generated news impact analysis

**数据库表名**: `impact_analyses`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| newsId (`news_id`) | String |  | ✓ |  |  |
| direction | String |  |  |  |  |
| magnitude | String |  |  |  |  |
| confidence | Float |  |  |  |  |
| summary | String |  |  |  |  |
| keyPoints (`key_points`) | String[] |  |  | `[]` |  |
| historicalComparison (`historical_comparison`) | String |  |  |  |  |
| analyzedAt (`analyzed_at`) | DateTime |  |  | `now()` |  |
| news | NewsItem |  |  |  | 关联到 NewsItem |

**关系**:
- `news`: 通过 `newsId` 关联到 `NewsItem.id`

### SECFiling

SEC filing - SEC documents

**数据库表名**: `sec_filings`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| symbol | String |  |  |  |  |
| formType (`form_type`) | String |  |  |  |  |
| filedAt (`filed_at`) | DateTime |  |  |  |  |
| periodOfReport (`period_of_report`) | DateTime |  |  |  |  |
| url | String |  |  |  |  |
| summary | String |  |  |  |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |
| stock | Stock |  |  |  | 关联到 Stock |

**索引**:
- `symbol, filedAt`

**关系**:
- `stock`: 通过 `symbol` 关联到 `Stock.symbol`

### Transcript

Transcript - earnings call transcripts

**数据库表名**: `transcripts`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| symbol | String |  |  |  |  |
| quarter | String |  |  |  |  |
| eventType (`event_type`) | String |  |  | `earnings` |  |
| date | DateTime |  |  |  |  |
| aiSummary (`ai_summary`) | String |  |  |  |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |
| stock | Stock |  |  |  | 关联到 Stock |
| participants | TranscriptParticipant[] |  |  |  |  |
| sections | TranscriptSection[] |  |  |  |  |

**索引**:
- `symbol, date`

**关系**:
- `stock`: 通过 `symbol` 关联到 `Stock.symbol`

### TranscriptParticipant

Transcript participant

**数据库表名**: `transcript_participants`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| transcriptId (`transcript_id`) | String |  |  |  |  |
| name | String |  |  |  |  |
| title | String |  |  |  |  |
| company | String |  |  |  |  |
| transcript | Transcript |  |  |  | 关联到 Transcript |

**关系**:
- `transcript`: 通过 `transcriptId` 关联到 `Transcript.id`

### TranscriptSection

Transcript section

**数据库表名**: `transcript_sections`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| transcriptId (`transcript_id`) | String |  |  |  |  |
| type | String |  |  |  |  |
| speaker | String |  |  |  |  |
| content | String |  |  |  |  |
| transcript | Transcript |  |  |  | 关联到 Transcript |

**关系**:
- `transcript`: 通过 `transcriptId` 关联到 `Transcript.id`

### EarningsEvent

============================================ Earnings and Dividend Models ============================================ Earnings event - earnings calendar

**数据库表名**: `earnings_events`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| symbol | String |  |  |  |  |
| reportDate (`report_date`) | DateTime |  |  |  |  |
| fiscalQuarter (`fiscal_quarter`) | String |  |  |  |  |
| fiscalYear (`fiscal_year`) | Int |  |  |  |  |
| timing | String |  |  | `unknown` |  |
| epsEstimate (`eps_estimate`) | Float |  |  |  |  |
| epsActual (`eps_actual`) | Float |  |  |  |  |
| epsSurprise (`eps_surprise`) | Float |  |  |  |  |
| revenueEstimate (`revenue_estimate`) | BigInt |  |  |  |  |
| revenueActual (`revenue_actual`) | BigInt |  |  |  |  |
| revenueSurprise (`revenue_surprise`) | Float |  |  |  |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |
| updatedAt (`updated_at`) | DateTime |  |  |  |  |
| stock | Stock |  |  |  | 关联到 Stock |

**索引**:
- `reportDate`

**唯一约束**:
- `symbol, fiscalYear, fiscalQuarter`

**关系**:
- `stock`: 通过 `symbol` 关联到 `Stock.symbol`

### DividendEvent

Dividend event - dividend calendar

**数据库表名**: `dividend_events`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| symbol | String |  |  |  |  |
| exDate (`ex_date`) | DateTime |  |  |  |  |
| payDate (`pay_date`) | DateTime |  |  |  |  |
| recordDate (`record_date`) | DateTime |  |  |  |  |
| amount | Float |  |  |  |  |
| frequency | String |  |  | `quarterly` |  |
| yield | Float |  |  |  |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |
| stock | Stock |  |  |  | 关联到 Stock |

**索引**:
- `symbol, exDate`

**关系**:
- `stock`: 通过 `symbol` 关联到 `Stock.symbol`

### InsiderTrade

Insider trade - insider trading records

**数据库表名**: `insider_trades`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| symbol | String |  |  |  |  |
| filedAt (`filed_at`) | DateTime |  |  |  |  |
| tradeDate (`trade_date`) | DateTime |  |  |  |  |
| insiderName (`insider_name`) | String |  |  |  |  |
| insiderTitle (`insider_title`) | String |  |  |  |  |
| transactionType (`transaction_type`) | String |  |  |  |  |
| shares | BigInt |  |  |  |  |
| pricePerShare (`price_per_share`) | Float |  |  |  |  |
| totalValue (`total_value`) | Float |  |  |  |  |
| sharesOwned (`shares_owned`) | BigInt |  |  |  |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |
| stock | Stock |  |  |  | 关联到 Stock |

**索引**:
- `symbol, tradeDate`

**关系**:
- `stock`: 通过 `symbol` 关联到 `Stock.symbol`

### ScreenerTemplate

============================================ Screener Models ============================================ Screener template - saved screener filters

**数据库表名**: `screener_templates`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| userId (`user_id`) | String |  |  |  |  |
| name | String |  |  |  |  |
| description | String |  |  |  |  |
| filters | Json |  |  |  |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |
| updatedAt (`updated_at`) | DateTime |  |  |  |  |
| user | User |  |  |  | 关联到 User |

**索引**:
- `userId`

**关系**:
- `user`: 通过 `userId` 关联到 `User.id`

### Portfolio

============================================ Portfolio Models ============================================ Portfolio - user investment portfolio

**数据库表名**: `portfolios`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| userId (`user_id`) | String |  |  |  |  |
| name | String |  |  |  |  |
| description | String |  |  |  |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |
| updatedAt (`updated_at`) | DateTime |  |  |  |  |
| user | User |  |  |  | 关联到 User |
| holdings | PortfolioHolding[] |  |  |  |  |
| transactions | PortfolioTransaction[] |  |  |  |  |

**索引**:
- `userId`

**关系**:
- `user`: 通过 `userId` 关联到 `User.id`

### PortfolioHolding

Portfolio holding - stocks held in portfolio

**数据库表名**: `portfolio_holdings`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| portfolioId (`portfolio_id`) | String |  |  |  |  |
| symbol | String |  |  |  |  |
| shares | Float |  |  |  |  |
| avgCostBasis (`avg_cost_basis`) | Float |  |  |  |  |
| addedAt (`added_at`) | DateTime |  |  | `now()` |  |
| updatedAt (`updated_at`) | DateTime |  |  |  |  |
| portfolio | Portfolio |  |  |  | 关联到 Portfolio |
| stock | Stock |  |  |  | 关联到 Stock |

**唯一约束**:
- `portfolioId, symbol`

**关系**:
- `portfolio`: 通过 `portfolioId` 关联到 `Portfolio.id`
- `stock`: 通过 `symbol` 关联到 `Stock.symbol`

### PortfolioTransaction

Portfolio transaction - buy/sell/dividend records

**数据库表名**: `portfolio_transactions`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| portfolioId (`portfolio_id`) | String |  |  |  |  |
| symbol | String |  |  |  |  |
| type | String |  |  |  |  |
| shares | Float |  |  |  |  |
| pricePerShare (`price_per_share`) | Float |  |  |  |  |
| totalAmount (`total_amount`) | Float |  |  |  |  |
| transactionDate (`transaction_date`) | DateTime |  |  |  |  |
| notes | String |  |  |  |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |
| portfolio | Portfolio |  |  |  | 关联到 Portfolio |

**索引**:
- `portfolioId, transactionDate`

**关系**:
- `portfolio`: 通过 `portfolioId` 关联到 `Portfolio.id`

### Alert

============================================ Alert Models ============================================ Alert - user notifications

**数据库表名**: `alerts`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| userId (`user_id`) | String |  |  |  |  |
| type | String |  |  |  |  |
| symbol | String |  |  |  |  |
| sector | String |  |  |  |  |
| title | String |  |  |  |  |
| message | String |  |  |  |  |
| priority | String |  |  | `medium` |  |
| read | Boolean |  |  | `false` |  |
| metadata | Json |  |  |  |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |
| user | User |  |  |  | 关联到 User |

**索引**:
- `userId, read`
- `userId, createdAt`

**关系**:
- `user`: 通过 `userId` 关联到 `User.id`

### PriceAlert

Price alert - user-defined price alerts

**数据库表名**: `price_alerts`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| userId (`user_id`) | String |  |  |  |  |
| symbol | String |  |  |  |  |
| condition | String |  |  |  |  |
| targetValue (`target_value`) | Float |  |  |  |  |
| triggered | Boolean |  |  | `false` |  |
| triggeredAt (`triggered_at`) | DateTime |  |  |  |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |
| user | User |  |  |  | 关联到 User |

**索引**:
- `userId, triggered`
- `symbol`

**关系**:
- `user`: 通过 `userId` 关联到 `User.id`

### Sector

============================================ Sector Models ============================================ Sector - industry sectors

**数据库表名**: `sectors`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| name | String |  | ✓ |  |  |
| nameZh (`name_zh`) | String |  |  |  |  |
| description | String |  |  |  |  |
| stockCount (`stock_count`) | Int |  |  | `0` |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |
| updatedAt (`updated_at`) | DateTime |  |  |  |  |
| subscriptions | SectorSubscription[] |  |  |  |  |

### SectorSubscription

Sector subscription - user sector subscriptions

**数据库表名**: `sector_subscriptions`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| userId (`user_id`) | String |  |  |  |  |
| sectorId (`sector_id`) | String |  |  |  |  |
| subscribedAt (`subscribed_at`) | DateTime |  |  | `now()` |  |
| user | User |  |  |  | 关联到 User |
| sector | Sector |  |  |  | 关联到 Sector |

**唯一约束**:
- `userId, sectorId`

**关系**:
- `user`: 通过 `userId` 关联到 `User.id`
- `sector`: 通过 `sectorId` 关联到 `Sector.id`

### AnalystRating

============================================ Analyst Rating Models ============================================ Analyst rating - Wall Street analyst ratings

**数据库表名**: `analyst_ratings`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| symbol | String |  |  |  |  |
| analyst | String |  |  |  |  |
| firm | String |  |  |  |  |
| rating | String |  |  |  |  |
| targetPrice (`target_price`) | Float |  |  |  |  |
| previousRating (`previous_rating`) | String |  |  |  |  |
| previousTargetPrice (`previous_target_price`) | Float |  |  |  |  |
| ratingDate (`rating_date`) | DateTime |  |  |  |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |
| stock | Stock |  |  |  | 关联到 Stock |

**索引**:
- `symbol, ratingDate`

**关系**:
- `stock`: 通过 `symbol` 关联到 `Stock.symbol`

### OfflineMessage

============================================ Offline Message Cache ============================================ Offline message - cached messages for offline users

**数据库表名**: `offline_messages`

| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |
|--------|------|------|------|--------|------|
| id | String |  | ✓ | `uuid()` | 主键  |
| userId (`user_id`) | String |  |  |  |  |
| type | String |  |  |  |  |
| payload | Json |  |  |  |  |
| priority | String |  |  | `medium` |  |
| createdAt (`created_at`) | DateTime |  |  | `now()` |  |

**索引**:
- `userId, createdAt`

