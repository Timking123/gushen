# REST API 概览

**版本**: 1.0.0

**最后更新**: 2026-03-04

---

## 简介

RESTful API for stock analysis and portfolio management

本文档提供所有 REST API 端点的概览。详细的 API 规范请参考 [OpenAPI 规范](./openapi.yaml)。

## 服务器

- **Development server**: `http://localhost:3000`
- **Production server**: `https://api.example.com`

## 认证

大部分 API 端点需要 JWT Bearer Token 认证。在请求头中包含：

```
Authorization: Bearer <your-jwt-token>
```

详细的认证流程请参考 [认证文档](./authentication.md)。

## API 端点

### Analysis

Analysis related endpoints

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | `/api/chat` | AI assistant chat interface | 🔓 |
| POST | `/api/impact/:newsId` | Analyze news impact on stock price | 🔓 |
| POST | `/api/summarize` | Summarize multiple news items | 🔓 |
| POST | `/api/compare` | Compare multiple stocks | 🔓 |

### Ai Assistant

Ai Assistant related endpoints

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | `/api/history` | 获取对话历史 | 🔓 |
| DELETE | `/api/history` | 清除对话历史 | 🔓 |
| GET | `/api/suggestions` | 获取个性化建议 | 🔓 |
| POST | `/api/parse-intent` | 解析用户意图（用于调试） | 🔓 |

### Stocks

Stocks related endpoints

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | `/api/:symbol` | Get stock detail by symbol | 🔓 |
| GET | `/api/:symbol/history` | Get historical OHLCV data for a stock | 🔓 |
| GET | `/api/market/heatmap` | Get market heatmap data grouped by sector, market cap, or industry | 🔓 |
| GET | `/api/market/sectors` | Get list of available sectors for heatmap filtering | 🔓 |
| GET | `/api/market/industries` | Get list of available industries with their sector and stock count | 🔓 |
| GET | `/api/:symbol/quote` | Get real-time stock quote by symbol | 🔓 |
| GET | `/api/:symbol/indicators` | Get technical indicators for a stock with customizable parameters | 🔓 |
| GET | `/api/:symbol/events` | Stock event type for timeline markers | 🔓 |
| GET | `/api/:symbol/full-detail` | Get complete stock detail information including profile, quote, financials, analyst ratings, and insider trades | 🔓 |
| GET | `/api/:symbol/financials` | Get financial metrics for a stock | 🔓 |
| GET | `/api/:symbol/analyst-ratings` | Get analyst ratings summary and recent ratings for a stock | 🔓 |
| GET | `/api/:symbol/insider-trades` | Get insider trade summary and recent trades for a stock | 🔓 |

### Watchlist

Watchlist related endpoints

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| DELETE | `/api/:symbol` | Remove a stock from watchlist | 🔓 |
| GET | `/api/` | Get user's watchlist | 🔓 |
| POST | `/api/` | Add a stock to watchlist | 🔓 |
| PUT | `/api/reorder` | Reorder stocks in watchlist | 🔓 |
| PATCH | `/api/:symbol/notes` | Update notes for a watchlist item | 🔓 |
| GET | `/api/:symbol/check` | Check if a stock is in watchlist | 🔓 |

### Analyst Rating

Analyst Rating related endpoints

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | `/api/:symbol/composite` | Get composite rating for a stock | 🔓 |
| GET | `/api/firm/:firm` | Get all ratings from a specific firm | 🔓 |
| GET | `/api/recent/changes` | Get recent rating changes across all stocks | 🔓 |

### Quant Rating

Quant Rating related endpoints

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | `/api/:symbol/changes` | Get rating change trend for a stock | 🔓 |
| POST | `/api/:symbol/calculate` | Calculate and save a new quant rating for a stock | 🔓 |
| GET | `/api/sector/:sector/rankings` | Get sector rankings for all stocks in a sector | 🔓 |
| GET | `/api/industry/:industry/rankings` | Get industry rankings for all stocks in an industry | 🔓 |

### Auth

Auth related endpoints

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | `/api/register` | Register a new user account | 🔒 |
| POST | `/api/login` | Authenticate user and return token | 🔒 |

### Earnings

Earnings related endpoints

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | `/api/calendar` | Get earnings calendar with optional filters | 🔓 |
| GET | `/api/upcoming` | Get upcoming earnings events | 🔓 |
| GET | `/api/date/:date` | Get earnings events for a specific date | 🔓 |
| GET | `/api/watchlist/upcoming` | Get upcoming earnings for user's watchlist stocks | 🔒 |
| GET | `/api/watchlist/tomorrow` | Get earnings happening tomorrow for user's watchlist stocks | 🔒 |
| GET | `/api/watchlist/recent` | Get recent earnings results for user's watchlist stocks | 🔒 |
| POST | `/api/reminder` | Send earnings reminder for a specific stock | 🔒 |

### Transcript

Transcript related endpoints

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | `/api/stock/:symbol` | Get transcripts for a specific stock | 🔓 |
| GET | `/api/recent` | Get recent transcripts across all stocks | 🔓 |
| GET | `/api/:id` | Get a single transcript by ID with full content | 🔓 |
| POST | `/api/:id/summary` | Generate AI summary for a transcript | 🔓 |
| GET | `/api/search` | Search transcripts by keyword | 🔓 |
| GET | `/api/stock/:symbol/latest` | Get the latest transcript for a specific stock | 🔓 |
| GET | `/api/:id/analysis` | Get a transcript with AI analysis (summary and key statements) | 🔓 |
| GET | `/api/:id/key-statements` | Extract key statements from a transcript | 🔓 |

### Dividend

Dividend related endpoints

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | `/api/stock/:symbol/history` | Get dividend history for a specific stock | 🔓 |
| GET | `/api/portfolio/:portfolioId/income` | Calculate expected annual dividend income for a portfolio | 🔓 |

### Insider

Insider related endpoints

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | `/api/trades` | Get insider trades with optional filters | 🔓 |
| GET | `/api/significant` | Get significant (large) insider trades | 🔓 |
| GET | `/api/insider` | Get trades by a specific insider | 🔓 |
| GET | `/api/stock/:symbol/trend` | Get insider trading trend for a specific stock | 🔓 |

### Market

Market related endpoints

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | `/api/indices` | Market Routes | 🔓 |
| GET | `/api/breadth` | Get market breadth data (advance/decline statistics) | 🔓 |
| GET | `/api/sentiment` | Get market sentiment indicators | 🔓 |
| GET | `/api/gainers` | Get top gaining stocks | 🔓 |
| GET | `/api/losers` | Get top losing stocks | 🔓 |
| GET | `/api/most-active` | Get most active stocks by volume | 🔓 |
| GET | `/api/leaderboards` | Get all market leaderboards (gainers, losers, most active) | 🔓 |
| GET | `/api/overview` | Get complete market overview (indices, sentiment, leaderboards) | 🔓 |

### News

News related endpoints

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | `/api/sector/:sector` | Get news for a specific sector | 🔓 |

### Portfolio

Portfolio related endpoints

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | `/api/benchmarks/available` | Portfolio Routes | 🔓 |
| PUT | `/api/:id` | Update a portfolio | 🔓 |
| DELETE | `/api/:id` | Delete a portfolio | 🔓 |
| GET | `/api/:id/holdings` | Get all holdings for a portfolio | 🔓 |
| POST | `/api/:id/holdings` | Add a holding to portfolio | 🔓 |
| PUT | `/api/:id/holdings/:holdingId` | Update a holding | 🔓 |
| DELETE | `/api/:id/holdings/:holdingId` | Remove a holding | 🔓 |
| GET | `/api/:id/transactions` | Get transactions for a portfolio | 🔓 |
| POST | `/api/:id/transactions` | Record a transaction | 🔓 |
| GET | `/api/:id/summary` | Get portfolio summary with current values | 🔓 |
| GET | `/api/:id/sector-distribution` | Get portfolio sector distribution | 🔓 |
| GET | `/api/:id/returns-curve` | Get historical returns curve for a portfolio | 🔓 |
| GET | `/api/:id/benchmark-comparison` | Compare portfolio performance against a benchmark index | 🔓 |

### Push

Push related endpoints

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | `/api/subscribe/stock` | Subscribe to stock updates | 🔓 |
| POST | `/api/unsubscribe/stock` | Unsubscribe from stock updates | 🔓 |
| POST | `/api/alerts/price` | Set price alert | 🔓 |
| GET | `/api/alerts` | Get user alerts | 🔓 |
| PUT | `/api/alerts/:alertId/read` | Mark alert as read | 🔓 |

### Screener

Screener related endpoints

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| POST | `/api/screen` | Execute stock screening with filters | 🔓 |
| GET | `/api/templates` | Get all screener templates for the authenticated user | 🔒 |
| POST | `/api/templates` | Save a screener template | 🔒 |
| GET | `/api/templates/:id` | Get a specific screener template | 🔒 |
| PUT | `/api/templates/:id` | Update a screener template | 🔒 |
| DELETE | `/api/templates/:id` | Delete a screener template | 🔒 |

### Sec Filing

Sec Filing related endpoints

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | `/api/form-types/descriptions` | Get descriptions for all SEC form types | 🔓 |
| GET | `/api/detail/:filingId` | Get a specific SEC filing by ID | 🔓 |
| GET | `/api/:symbol/filter` | Get SEC filings with advanced filtering | 🔓 |
| POST | `/api/:filingId/ai-summary` | Generate AI summary for SEC filing | 🔓 |
| PATCH | `/api/:filingId/summary` | Update SEC filing summary (for AI-generated summaries) | 🔓 |

### Sector

Sector related endpoints

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | `/api/subscriptions` | 获取用户订阅的板块列表 | 🔓 |
| GET | `/api/:sectorId` | 获取板块详情 | 🔓 |
| POST | `/api/:sectorId/subscribe` | 订阅板块 | 🔓 |
| DELETE | `/api/:sectorId/subscribe` | 取消订阅板块 | 🔓 |
| GET | `/api/:sectorId/stocks` | 获取板块内的股票列表 | 🔓 |
| GET | `/api/:sectorId/news` | 获取板块相关新闻 | 🔓 |
| GET | `/api/:sectorId/performance` | 获取板块表现数据 | 🔓 |

### Status

Status related endpoints

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | `/api/finnhub` | Get Finnhub WebSocket connection status | 🔓 |

### User Settings

User Settings related endpoints

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | `/api/settings` | Get current user's settings | 🔓 |
| PUT | `/api/settings` | Update current user's settings (partial update supported) | 🔓 |

## 通用响应格式

### 成功响应

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully"
}
```

### 错误响应

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Error description",
  "details": [
    "Additional error details"
  ]
}
```

## 常见 HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 资源创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证或认证失败 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## API 更新指南

当 API 端点发生变更时，请遵循以下步骤更新文档：

### 1. 更新路由文件中的 JSDoc 注释

在路由处理器函数上添加或更新 JSDoc 注释，包括：

- `@route` - 路由路径和方法
- `@summary` - 端点简短描述
- `@description` - 详细描述（可选）
- `@tags` - 端点分类标签
- `@param` - 请求参数说明
- `@body` - 请求体说明
- `@response` - 响应说明
- `@auth` - 是否需要认证

**示例**：

```typescript
/**
 * @route POST /api/stocks/search
 * @summary 搜索股票
 * @description 根据关键词搜索股票代码和名称
 * @tags Stocks
 * @param {string} query.query - 搜索关键词
 * @response 200 - 搜索结果列表
 * @response 400 - 请求参数错误
 * @auth
 */
router.post('/search', async (req, res) => {
  // 实现代码
});
```

### 2. 重新生成 API 文档

运行以下命令重新生成 API 文档：

```bash
npm run docs:generate
```

或者：

```bash
cd backend
npx tsx scripts/generate-api-docs.ts
```

### 3. 验证生成的文档

检查以下文件是否正确更新：

- `docs/api/openapi.yaml` - OpenAPI 规范（YAML 格式）
- `docs/api/openapi.json` - OpenAPI 规范（JSON 格式）
- `docs/api/rest-api.md` - REST API 概览文档

### 4. 提交变更

将更新的路由文件和生成的文档一起提交到版本控制：

```bash
git add backend/src/routes/ docs/api/
git commit -m "docs: update API documentation for [feature/endpoint]"
```

### 5. 代码审查清单

在代码审查时，确保：

- [ ] 所有新增或修改的端点都有完整的 JSDoc 注释
- [ ] API 文档已重新生成并包含在 PR 中
- [ ] 端点描述清晰准确
- [ ] 请求参数和响应格式文档完整
- [ ] 认证要求正确标注
- [ ] 如有破坏性变更，已在 PR 描述中说明

## 相关资源

- [OpenAPI 规范 (YAML)](./openapi.yaml)
- [OpenAPI 规范 (JSON)](./openapi.json)
- [认证文档](./authentication.md)
- [WebSocket 协议](./websocket.md)
