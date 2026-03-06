# Smart Stock Analyzer - 项目完整说明文档

**版本**: 1.0.0  
**最后更新**: 2026-03-05  
**项目类型**: 全栈 Web 应用  
**开发状态**: 开发中

---

## 📋 目录

1. [项目概述](#项目概述)
2. [技术栈](#技术栈)
3. [系统架构](#系统架构)
4. [核心功能](#核心功能)
5. [数据模型](#数据模型)
6. [API 接口](#api-接口)
7. [前端架构](#前端架构)
8. [开发环境配置](#开发环境配置)
9. [部署说明](#部署说明)
10. [测试策略](#测试策略)
11. [项目结构](#项目结构)

---

## 项目概述

### 项目简介

Smart Stock Analyzer（智能股票分析平台）是一个功能全面的股票分析和投资管理平台，为投资者提供实时市场数据、智能分析、投资组合管理和个性化提醒服务。

### 核心价值

- **实时数据**: 提供实时股票报价、市场热力图和行情数据
- **智能分析**: 基于量化评级、技术指标和基本面分析的智能投资建议
- **全面信息**: 整合新闻、财报、内幕交易、分析师评级等多维度信息
- **投资管理**: 完整的投资组合管理和交易记录功能
- **个性化服务**: 自定义提醒、关注列表和筛选器

### 目标用户

- 个人投资者
- 专业交易员
- 金融分析师
- 投资顾问

---

## 技术栈

### 后端技术栈

#### 核心框架
- **Node.js**: JavaScript 运行时环境
- **Express 5.x**: Web 应用框架
- **TypeScript 5.9**: 类型安全的 JavaScript 超集

#### 数据库与缓存
- **PostgreSQL 16**: 主数据库，存储所有业务数据
- **Prisma 6.x**: 现代化的 ORM 工具
- **Redis 7**: 缓存层，提升性能和实时数据处理
- **ioredis**: Redis 客户端库

#### 实时通信
- **Socket.IO 4.x**: WebSocket 实时双向通信
- **ws**: WebSocket 协议实现

#### 安全与认证
- **JWT (jsonwebtoken)**: 基于令牌的身份认证
- **bcryptjs**: 密码加密
- **Helmet**: HTTP 安全头设置
- **CORS**: 跨域资源共享配置

#### 数据验证与处理
- **Zod**: TypeScript 优先的模式验证
- **express-validator**: 请求数据验证

#### 外部数据源
- **Axios**: HTTP 客户端，用于调用外部 API
- **yahoo-finance2**: Yahoo Finance 数据接口
- **Finnhub API**: 金融市场数据（通过配置）
- **Alpha Vantage**: 股票数据 API（通过配置）

#### 开发工具
- **tsx**: TypeScript 执行器
- **ESLint**: 代码质量检查
- **Prettier**: 代码格式化
- **Jest**: 单元测试框架
- **fast-check**: 属性测试（Property-Based Testing）
- **Supertest**: API 测试

#### 文档工具
- **Swagger UI Express**: API 文档界面
- **OpenAPI 3.0**: API 规范标准

### 前端技术栈

#### 核心框架
- **React 19.x**: UI 框架
- **TypeScript 5.9**: 类型安全
- **Vite (Rolldown)**: 构建工具和开发服务器

#### 路由与状态管理
- **React Router DOM 7.x**: 客户端路由
- **Zustand 5.x**: 轻量级状态管理

#### UI 组件与可视化
- **ECharts 6.x**: 数据可视化图表库
- **echarts-for-react**: ECharts 的 React 封装
- **Lightweight Charts**: 金融图表库
- **@hello-pangea/dnd**: 拖拽功能

#### 网络通信
- **Axios**: HTTP 客户端
- **Socket.IO Client**: WebSocket 客户端

#### 测试工具
- **Vitest**: 单元测试框架
- **Playwright**: E2E 测试框架
- **fast-check**: 属性测试
- **axios-mock-adapter**: API Mock 工具

#### 开发工具
- **ESLint**: 代码检查
- **Prettier**: 代码格式化
- **TypeScript**: 类型检查

### 基础设施

#### 容器化
- **Docker**: 容器化部署
- **Docker Compose**: 多容器编排

#### 数据库服务
- **PostgreSQL 16 Alpine**: 轻量级数据库镜像
- **Redis 7 Alpine**: 轻量级缓存镜像

---

## 系统架构

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        客户端层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Web Browser │  │ Mobile App   │  │  Desktop App │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS / WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      前端应用层 (React)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Pages  │  Components  │  Services  │  Stores        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ REST API / WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    后端应用层 (Express)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Routes  │  Middleware  │  Services  │  Utils        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│      数据持久层          │  │      缓存层              │
│   PostgreSQL + Prisma   │  │    Redis + ioredis      │
└─────────────────────────┘  └─────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      外部服务层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Finnhub API │  │ Yahoo Finance│  │ Alpha Vantage│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 架构特点

#### 1. 前后端分离
- 前端使用 React 构建单页应用（SPA）
- 后端提供 RESTful API 和 WebSocket 服务
- 通过 CORS 配置实现跨域通信

#### 2. 微服务化设计
- 服务层按业务领域划分（股票、新闻、分析、投资组合等）
- 每个服务独立封装业务逻辑
- 便于维护和扩展

#### 3. 缓存策略
- Redis 缓存热点数据（实时报价、市场数据）
- 减少数据库查询压力
- 提升响应速度

#### 4. 实时通信
- WebSocket 推送实时行情更新
- 消息队列处理异步任务
- 离线消息缓存机制

#### 5. 安全机制
- JWT 令牌认证
- 基于角色的访问控制（RBAC）
- 请求限流和防护
- 审计日志记录

---

## 核心功能

### 1. 用户管理系统

#### 用户认证
- 邮箱注册和登录
- JWT 令牌认证
- 密码加密存储（bcrypt）
- 会话管理

#### 角色权限
- **USER**: 普通用户，基础功能
- **PREMIUM**: 高级用户，完整功能
- **ADMIN**: 管理员，系统管理权限

#### 用户设置
- 主题选择（亮色/暗色/系统）
- 语言设置（中文/英文）
- 时区配置
- 推送通知开关
- 免打扰时段设置
- 价格提醒阈值
- 投资偏好标签

#### 审计日志
- 记录用户操作
- 权限变更追踪
- IP 地址和用户代理记录

### 2. 股票数据管理

#### 基础信息
- 股票代码（Symbol）
- 公司名称
- 交易所
- 行业分类
- 市值数据
- 国家/地区

#### 实时行情
- 当前价格
- 涨跌幅
- 成交量
- 最高/最低价
- 开盘价/收盘价
- 平均成交量

#### 历史数据
- OHLCV 数据（开盘、最高、最低、收盘、成交量）
- 支持多时间周期查询
- 用于技术分析和图表展示

### 3. 量化评级系统

#### 综合评级
- 整体评级（强力买入/买入/持有/卖出/强力卖出）
- 综合评分（1-5 分）

#### 多维度评分
- **估值评分**: 基于 PE、PB、PS 等估值指标
- **成长评分**: 基于营收增长、EPS 增长等
- **盈利能力评分**: 基于利润率、ROE、ROA 等
- **动量评分**: 基于价格走势和技术指标
- **修正评分**: 基于分析师评级变化

#### 排名系统
- 行业排名
- 板块排名

### 4. 基本面分析

#### 估值指标
- PE（市盈率）
- Forward PE（预期市盈率）
- PEG（市盈率相对盈利增长比率）
- PS（市销率）
- PB（市净率）

#### 盈利指标
- EPS（每股收益）
- EPS 增长率
- 营收
- 营收增长率

#### 利润率指标
- 毛利率
- 营业利润率
- 净利率

#### 财务健康指标
- ROE（净资产收益率）
- ROA（总资产收益率）
- 负债权益比
- 流动比率

#### 股息指标
- 股息收益率
- 派息比率

### 5. 技术分析

#### 趋势指标
- SMA（简单移动平均线）: 20日、50日、200日
- EMA（指数移动平均线）: 12日、26日

#### 动量指标
- RSI（相对强弱指标）: 14日
- MACD（移动平均收敛散度）
  - MACD 值
  - 信号线
  - 柱状图

#### 波动率指标
- 布林带（上轨、中轨、下轨）
- ATR（平均真实波幅）: 14日

#### 趋势强度
- ADX（平均趋向指数）: 14日

### 6. 新闻与信息

#### 新闻聚合
- 多源新闻整合
- 新闻来源可信度评级（高/中/低）
- 相关股票关联
- 行业板块标签

#### AI 影响分析
- 情绪方向（看涨/看跌/中性）
- 影响程度（高/中/低）
- 置信度评分（0-1）
- 关键要点提取
- 历史对比分析

#### SEC 文件
- 10-K（年度报告）
- 10-Q（季度报告）
- 8-K（重大事件报告）
- 文件摘要
- 报告期间

#### 财报电话会议记录
- 季度财报会议
- 投资者日活动
- 行业会议
- 参与者信息
- 发言内容分段
- AI 摘要

### 7. 财报与股息

#### 财报日历
- 财报发布日期
- 财政季度和年度
- 发布时间（盘前/盘后）

#### 财报数据
- EPS 预期值和实际值
- EPS 惊喜度
- 营收预期值和实际值
- 营收惊喜度

#### 股息日历
- 除息日
- 支付日
- 登记日
- 股息金额
- 派息频率（年度/半年度/季度/月度）
- 股息收益率

### 8. 内幕交易追踪

#### 交易记录
- 内部人姓名
- 职位头衔
- 交易类型（买入/卖出/行权）
- 交易股数
- 每股价格
- 交易总额
- 交易后持股数
- 交易日期
- 申报日期

#### 分析功能
- 内部人交易趋势
- 大额交易提醒
- 高管交易模式

### 9. 分析师评级

#### 评级信息
- 分析师姓名
- 所属机构
- 评级（强力买入/买入/持有/卖出/强力卖出）
- 目标价
- 评级日期

#### 评级变化
- 前次评级
- 前次目标价
- 评级变化追踪

#### 统计分析
- 评级分布
- 平均目标价
- 目标价区间

### 10. 投资组合管理

#### 组合创建
- 多组合支持
- 组合命名和描述
- 组合分类

#### 持仓管理
- 股票持仓记录
- 持股数量
- 平均成本基础
- 实时盈亏计算

#### 交易记录
- 买入/卖出记录
- 股息收入记录
- 交易日期和价格
- 交易备注

#### 组合分析
- 总资产价值
- 总收益率
- 行业分布
- 个股占比

### 11. 关注列表（Watchlist）

#### 功能特性
- 添加/移除股票
- 自定义排序
- 备注功能
- 快速访问

#### 实时更新
- 价格实时刷新
- 涨跌幅提醒
- 重要事件通知

### 12. 股票筛选器

#### 筛选条件
- 市值范围
- PE 范围
- 股息收益率
- 成交量
- 价格区间
- 行业板块
- 技术指标条件

#### 模板管理
- 保存筛选条件
- 模板命名
- 快速应用模板
- 模板分享

#### 结果展示
- 符合条件的股票列表
- 关键指标展示
- 排序和过滤
- 导出功能

### 13. 市场热力图

#### 可视化展示
- 按市值大小显示
- 颜色表示涨跌幅
- 分层级展示（市场/板块/个股）

#### 交互功能
- 点击查看详情
- 缩放和导航
- 筛选和搜索

#### 数据维度
- 按板块分类
- 按交易所分类
- 按市值分类

### 14. 提醒系统

#### 价格提醒
- 价格高于/低于目标值
- 价格变动百分比
- 触发后通知

#### 事件提醒
- 财报发布提醒
- 股息支付提醒
- 内幕交易提醒
- 评级变化提醒

#### 板块订阅
- 订阅特定行业
- 行业新闻推送
- 行业动态提醒

#### 通知管理
- 通知优先级（高/中/低）
- 已读/未读状态
- 通知历史记录
- 免打扰时段

### 15. AI 智能助手

#### 自然语言查询
- 理解用户意图
- 智能解析查询
- 多轮对话支持

#### 智能分析
- 股票推荐
- 投资建议
- 风险评估
- 市场洞察

#### 个性化服务
- 基于用户偏好
- 学习用户行为
- 定制化建议

---

## 数据模型

### 核心实体关系

```
User (用户)
├── UserSettings (用户设置)
├── WatchlistItem (关注列表)
├── Portfolio (投资组合)
│   ├── PortfolioHolding (持仓)
│   └── PortfolioTransaction (交易记录)
├── Alert (提醒)
├── PriceAlert (价格提醒)
├── SectorSubscription (板块订阅)
├── ScreenerTemplate (筛选器模板)
└── AuditLog (审计日志)

Stock (股票)
├── StockQuote (实时报价)
├── OHLCV (历史数据)
├── QuantRating (量化评级)
├── FundamentalMetrics (基本面指标)
├── TechnicalIndicators (技术指标)
├── NewsItemStock (相关新闻)
├── EarningsEvent (财报事件)
├── DividendEvent (股息事件)
├── InsiderTrade (内幕交易)
├── SECFiling (SEC 文件)
├── Transcript (会议记录)
└── AnalystRating (分析师评级)

NewsItem (新闻)
├── NewsItemStock (关联股票)
└── ImpactAnalysis (影响分析)

Sector (板块)
└── SectorSubscription (订阅关系)
```

### 主要数据表

#### 用户相关（6 张表）
- `users`: 用户基本信息
- `user_settings`: 用户设置
- `watchlist_items`: 关注列表
- `audit_logs`: 审计日志
- `screener_templates`: 筛选器模板
- `offline_messages`: 离线消息缓存

#### 股票相关（8 张表）
- `stocks`: 股票基本信息
- `stock_quotes`: 实时报价
- `ohlcv`: 历史 K 线数据
- `quant_ratings`: 量化评级
- `fundamental_metrics`: 基本面指标
- `technical_indicators`: 技术指标
- `analyst_ratings`: 分析师评级
- `insider_trades`: 内幕交易

#### 新闻相关（3 张表）
- `news_items`: 新闻内容
- `news_item_stocks`: 新闻-股票关联
- `impact_analyses`: AI 影响分析

#### 财报相关（2 张表）
- `earnings_events`: 财报日历
- `dividend_events`: 股息日历

#### 文档相关（4 张表）
- `sec_filings`: SEC 文件
- `transcripts`: 会议记录
- `transcript_participants`: 会议参与者
- `transcript_sections`: 会议内容分段

#### 投资组合相关（3 张表）
- `portfolios`: 投资组合
- `portfolio_holdings`: 持仓记录
- `portfolio_transactions`: 交易记录

#### 提醒相关（3 张表）
- `alerts`: 通用提醒
- `price_alerts`: 价格提醒
- `sector_subscriptions`: 板块订阅

#### 板块相关（1 张表）
- `sectors`: 行业板块

**总计**: 30+ 张数据表

---

## API 接口

### 接口规范

- **协议**: HTTP/HTTPS
- **格式**: JSON
- **认证**: JWT Bearer Token
- **文档**: Swagger UI (http://localhost:3001/api-docs)

### 主要 API 端点

#### 1. 认证接口 (`/api/auth`)
```
POST   /api/auth/register      # 用户注册
POST   /api/auth/login         # 用户登录
POST   /api/auth/logout        # 用户登出
GET    /api/auth/me            # 获取当前用户信息
PUT    /api/auth/password      # 修改密码
```

#### 2. 股票接口 (`/api/stocks`)
```
GET    /api/stocks             # 获取股票列表
GET    /api/stocks/:symbol     # 获取股票详情
GET    /api/stocks/:symbol/quote        # 获取实时报价
GET    /api/stocks/:symbol/candles      # 获取 K 线数据
GET    /api/stocks/:symbol/fundamentals # 获取基本面数据
GET    /api/stocks/:symbol/technicals   # 获取技术指标
GET    /api/stocks/search      # 搜索股票
```

#### 3. 量化评级接口 (`/api/quant-ratings`)
```
GET    /api/quant-ratings/:symbol       # 获取股票评级
GET    /api/quant-ratings/top-rated     # 获取高评级股票
```

#### 4. 新闻接口 (`/api/news`)
```
GET    /api/news               # 获取新闻列表
GET    /api/news/:id           # 获取新闻详情
GET    /api/news/:id/impact    # 获取影响分析
GET    /api/news/stock/:symbol # 获取股票相关新闻
```

#### 5. 分析接口 (`/api/analysis`)
```
POST   /api/analysis/impact    # 生成影响分析
GET    /api/analysis/market    # 市场分析
GET    /api/analysis/sector/:sector # 板块分析
```

#### 6. 财报接口 (`/api/earnings`)
```
GET    /api/earnings/calendar  # 财报日历
GET    /api/earnings/:symbol   # 获取股票财报
POST   /api/earnings/reminder  # 设置财报提醒
```

#### 7. 股息接口 (`/api/dividends`)
```
GET    /api/dividends/calendar # 股息日历
GET    /api/dividends/:symbol  # 获取股票股息
POST   /api/dividends/reminder # 设置股息提醒
```

#### 8. 内幕交易接口 (`/api/insider`)
```
GET    /api/insider/:symbol    # 获取内幕交易记录
GET    /api/insider/recent     # 获取最近交易
POST   /api/insider/notification # 设置交易提醒
```

#### 9. 分析师评级接口 (`/api/analyst-ratings`)
```
GET    /api/analyst-ratings/:symbol     # 获取评级
GET    /api/analyst-ratings/:symbol/summary # 评级汇总
```

#### 10. SEC 文件接口 (`/api/sec-filings`)
```
GET    /api/sec-filings/:symbol # 获取 SEC 文件列表
GET    /api/sec-filings/:id     # 获取文件详情
```

#### 11. 会议记录接口 (`/api/transcripts`)
```
GET    /api/transcripts/:symbol # 获取会议记录列表
GET    /api/transcripts/:id     # 获取记录详情
```

#### 12. 投资组合接口 (`/api/portfolios`)
```
GET    /api/portfolios          # 获取组合列表
POST   /api/portfolios          # 创建组合
GET    /api/portfolios/:id      # 获取组合详情
PUT    /api/portfolios/:id      # 更新组合
DELETE /api/portfolios/:id      # 删除组合
POST   /api/portfolios/:id/holdings    # 添加持仓
POST   /api/portfolios/:id/transactions # 添加交易
GET    /api/portfolios/:id/performance  # 获取业绩
```

#### 13. 关注列表接口 (`/api/watchlist`)
```
GET    /api/watchlist           # 获取关注列表
POST   /api/watchlist           # 添加股票
DELETE /api/watchlist/:symbol   # 移除股票
PUT    /api/watchlist/:symbol   # 更新备注
```

#### 14. 筛选器接口 (`/api/screener`)
```
POST   /api/screener/search     # 执行筛选
GET    /api/screener/templates  # 获取模板列表
POST   /api/screener/templates  # 保存模板
DELETE /api/screener/templates/:id # 删除模板
```

#### 15. 市场接口 (`/api/market`)
```
GET    /api/market/overview     # 市场概览
GET    /api/market/heatmap      # 市场热力图
GET    /api/market/sectors      # 板块表现
GET    /api/market/movers       # 涨跌幅排行
```

#### 16. 板块接口 (`/api/sectors`)
```
GET    /api/sectors             # 获取板块列表
GET    /api/sectors/:id         # 获取板块详情
POST   /api/sectors/:id/subscribe   # 订阅板块
DELETE /api/sectors/:id/subscribe   # 取消订阅
```

#### 17. 提醒接口 (`/api/alerts`)
```
GET    /api/alerts              # 获取提醒列表
POST   /api/alerts              # 创建提醒
PUT    /api/alerts/:id/read     # 标记已读
DELETE /api/alerts/:id          # 删除提醒
```

#### 18. 价格提醒接口 (`/api/price-alerts`)
```
GET    /api/price-alerts        # 获取价格提醒
POST   /api/price-alerts        # 创建价格提醒
DELETE /api/price-alerts/:id    # 删除价格提醒
```

#### 19. 用户设置接口 (`/api/user-settings`)
```
GET    /api/user-settings       # 获取用户设置
PUT    /api/user-settings       # 更新用户设置
```

#### 20. AI 助手接口 (`/api/ai-assistant`)
```
POST   /api/ai-assistant/query  # 发送查询
GET    /api/ai-assistant/suggestions # 获取建议
```

#### 21. 推送接口 (`/api/push`)
```
POST   /api/push/subscribe      # 订阅推送
POST   /api/push/unsubscribe    # 取消订阅
POST   /api/push/test           # 测试推送
```

#### 22. 系统状态接口 (`/api/status`)
```
GET    /api/status              # 系统健康检查
GET    /api/status/version      # 版本信息
```

### WebSocket 事件

#### 客户端订阅事件
```javascript
// 订阅股票实时数据
socket.emit('subscribe:stock', { symbol: 'AAPL' })

// 取消订阅
socket.emit('unsubscribe:stock', { symbol: 'AAPL' })

// 订阅市场数据
socket.emit('subscribe:market')
```

#### 服务端推送事件
```javascript
// 股票价格更新
socket.on('stock:quote', (data) => { ... })

// 新闻推送
socket.on('news:new', (data) => { ... })

// 提醒通知
socket.on('alert:trigger', (data) => { ... })

// 市场数据更新
socket.on('market:update', (data) => { ... })
```

---

## 前端架构

### 目录结构

```
frontend/src/
├── assets/          # 静态资源（图片、图标等）
├── components/      # 可复用组件
│   ├── AIAssistant.tsx
│   ├── AnalystRatings.tsx
│   ├── CompanyProfile.tsx
│   ├── EarningsCalendar.tsx
│   ├── FilterPanel.tsx
│   ├── HeatmapNavigation.tsx
│   ├── InsiderTrades.tsx
│   ├── MarketHeatmap.tsx
│   ├── NewsFeed.tsx
│   ├── NotificationPanel.tsx
│   ├── StockChart.tsx
│   └── ...
├── hooks/           # 自定义 React Hooks
├── lib/             # 工具库
│   └── websocket.ts # WebSocket 客户端
├── pages/           # 页面组件
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── StockDetailPage.tsx
│   ├── PortfolioPage.tsx
│   ├── ScreenerPage.tsx
│   └── ...
├── services/        # API 服务层
│   ├── api.ts       # 基础 API 配置
│   ├── stockApi.ts
│   ├── newsApi.ts
│   ├── portfolioApi.ts
│   └── ...
├── stores/          # 状态管理
│   └── authStore.ts # 认证状态
├── types/           # TypeScript 类型定义
│   └── index.ts
├── utils/           # 工具函数
│   └── formatters.ts # 格式化函数
├── App.tsx          # 根组件
└── main.tsx         # 入口文件
```

### 核心页面

#### 1. 登录/注册页面
- 用户认证
- 表单验证
- 错误处理

#### 2. 股票详情页面
- 实时报价展示
- 公司基本信息
- 财务摘要
- 分析师评级
- 内幕交易
- 技术图表
- 相关新闻

#### 3. 市场热力图页面
- 可视化市场表现
- 板块导航
- 缩放控制
- 筛选功能

#### 4. 投资组合页面
- 组合列表
- 持仓详情
- 交易记录
- 业绩分析

#### 5. 筛选器页面
- 筛选条件设置
- 结果展示
- 模板管理

#### 6. 财报日历页面
- 日历视图
- 财报列表
- 提醒设置

#### 7. 板块页面
- 板块表现
- 板块股票列表
- 板块新闻

### 核心组件

#### 1. MarketHeatmap（市场热力图）
- 使用 ECharts 树图
- 响应式设计
- 交互式导航

#### 2. StockChart（股票图表）
- 使用 Lightweight Charts
- 支持多时间周期
- 技术指标叠加

#### 3. RealTimeQuote（实时报价）
- WebSocket 实时更新
- 价格变动动画
- 涨跌颜色标识

#### 4. NewsFeed（新闻流）
- 无限滚动加载
- 影响分析展示
- 相关股票链接

#### 5. NotificationPanel（通知面板）
- 实时通知推送
- 分类展示
- 已读/未读管理

#### 6. AIAssistant（AI 助手）
- 自然语言输入
- 智能回复
- 上下文理解

### 状态管理

#### Zustand Store
```typescript
// authStore.ts - 认证状态
interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}
```

### 路由配置

```typescript
// 主要路由
/                    # 首页（市场概览）
/login               # 登录
/register            # 注册
/stocks/:symbol      # 股票详情
/portfolio           # 投资组合
/screener            # 股票筛选器
/earnings            # 财报日历
/sectors/:id         # 板块详情
/watchlist           # 关注列表
```

---

## 开发环境配置

### 前置要求

- **Node.js**: 18.x 或更高版本
- **npm**: 9.x 或更高版本
- **Docker**: 20.x 或更高版本（用于数据库）
- **Docker Compose**: 2.x 或更高版本
- **Git**: 版本控制

### 环境搭建步骤

#### 1. 克隆项目
```bash
git clone <repository-url>
cd smart-stock-analyzer
```

#### 2. 启动数据库服务
```bash
# 启动 PostgreSQL 和 Redis
docker-compose up -d

# 验证服务运行状态
docker-compose ps
```

#### 3. 配置后端

```bash
cd backend

# 安装依赖
npm install

# 复制环境变量文件
cp .env.example .env

# 编辑 .env 文件，配置必要的环境变量
# - DATABASE_URL: PostgreSQL 连接字符串
# - REDIS_URL: Redis 连接字符串
# - JWT_SECRET: JWT 密钥
# - 外部 API 密钥（可选）

# 生成 Prisma 客户端
npm run prisma:generate

# 运行数据库迁移
npm run prisma:migrate

# 填充种子数据（可选）
npm run db:seed
```

#### 4. 配置前端

```bash
cd frontend

# 安装依赖
npm install

# 复制环境变量文件
cp .env.example .env.development

# 编辑 .env.development 文件
# - VITE_API_URL: 后端 API 地址
# - VITE_WS_URL: WebSocket 地址
```

#### 5. 启动开发服务器

```bash
# 终端 1 - 启动后端
cd backend
npm run dev
# 后端运行在 http://localhost:3001

# 终端 2 - 启动前端
cd frontend
npm run dev
# 前端运行在 http://localhost:5173
```

#### 6. 访问应用

- **前端应用**: http://localhost:5173
- **后端 API**: http://localhost:3001
- **API 文档**: http://localhost:3001/api-docs
- **Prisma Studio**: 运行 `npm run prisma:studio`（端口 5555）

### 环境变量说明

#### 后端环境变量 (.env)

```bash
# 服务器配置
NODE_ENV=development          # 环境：development/production
PORT=3001                     # 服务器端口

# 数据库配置
DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/smart_stock_analyzer?schema=public"

# Redis 配置
REDIS_URL="redis://localhost:6379"

# JWT 配置
JWT_SECRET="your-secret-key"  # 生产环境必须更改
JWT_EXPIRES_IN="7d"           # 令牌过期时间

# CORS 配置
CORS_ORIGIN="http://localhost:5173"  # 前端地址

# 外部 API 密钥（根据需要配置）
FINNHUB_API_KEY=""            # Finnhub API 密钥
ALPHA_VANTAGE_API_KEY=""      # Alpha Vantage API 密钥
OPENAI_API_KEY=""             # OpenAI API 密钥（AI 功能）
```

#### 前端环境变量 (.env.development)

```bash
# API 配置
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
```

### 开发工具

#### 代码质量
```bash
# 后端
npm run lint          # 运行 ESLint
npm run lint:fix      # 自动修复问题
npm run format        # 格式化代码
npm run type-check    # TypeScript 类型检查

# 前端
npm run lint          # 运行 ESLint
npm run lint:fix      # 自动修复问题
npm run format        # 格式化代码
npm run type-check    # TypeScript 类型检查
```

#### 测试
```bash
# 后端
npm test              # 运行所有测试
npm run test:watch    # 监听模式
npm run test:coverage # 生成覆盖率报告

# 前端
npm test              # 运行单元测试
npm run test:coverage # 生成覆盖率报告
npm run test:e2e      # 运行 E2E 测试
npm run test:e2e:ui   # E2E 测试 UI 模式
```

#### 数据库管理
```bash
npm run prisma:studio    # 打开 Prisma Studio
npm run prisma:generate  # 生成 Prisma 客户端
npm run prisma:migrate   # 运行迁移
npm run db:seed          # 填充种子数据
```

#### 数据同步脚本
```bash
npm run sync:quotes      # 同步股票报价
npm run sync:news        # 同步新闻
npm run sync:candles     # 同步 K 线数据
npm run sync:all         # 同步所有数据
npm run sync:daemon      # 守护进程模式
npm run sync:skipped     # 同步跳过的股票
```

#### 文档生成
```bash
npm run docs:generate    # 生成 API 文档
```

---

## 部署说明

### 生产环境构建

#### 1. 构建后端
```bash
cd backend
npm run build
# 输出目录: dist/
```

#### 2. 构建前端
```bash
cd frontend
npm run build
# 输出目录: dist/
```

### Docker 部署

#### 使用 Docker Compose
```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 环境配置

#### 生产环境变量
```bash
# 后端
NODE_ENV=production
PORT=3001
DATABASE_URL="<production-database-url>"
REDIS_URL="<production-redis-url>"
JWT_SECRET="<strong-random-secret>"
CORS_ORIGIN="<production-frontend-url>"

# 前端
VITE_API_URL=<production-api-url>
VITE_WS_URL=<production-ws-url>
```

### 性能优化

#### 1. 数据库优化
- 添加适当的索引
- 定期清理过期数据
- 使用连接池
- 查询优化

#### 2. 缓存策略
- Redis 缓存热点数据
- 设置合理的过期时间
- 缓存预热
- 缓存更新策略

#### 3. 前端优化
- 代码分割（Code Splitting）
- 懒加载（Lazy Loading）
- 图片优化
- CDN 加速
- Gzip 压缩

#### 4. API 优化
- 请求限流
- 响应压缩
- 分页查询
- 字段筛选

### 监控与日志

#### 日志系统
- 使用 Winston 记录日志
- 日志级别：error, warn, info, debug
- 日志文件轮转
- 错误追踪

#### 性能监控
- API 响应时间
- 数据库查询性能
- 缓存命中率
- 系统资源使用

---

## 测试策略

### 测试类型

#### 1. 单元测试（Unit Tests）
- **工具**: Jest (后端), Vitest (前端)
- **覆盖范围**: 
  - 服务层业务逻辑
  - 工具函数
  - 数据验证
  - 组件逻辑

#### 2. 属性测试（Property-Based Tests）
- **工具**: fast-check
- **覆盖范围**:
  - 数据转换函数
  - 格式化函数
  - 筛选和排序逻辑
  - 缓存管理
  - 消息队列
  - 错误处理

#### 3. 集成测试（Integration Tests）
- **工具**: Jest + Supertest (后端)
- **覆盖范围**:
  - API 端点
  - 数据库操作
  - 外部服务集成
  - WebSocket 通信

#### 4. E2E 测试（End-to-End Tests）
- **工具**: Playwright
- **覆盖范围**:
  - 用户登录流程
  - 股票搜索和查看
  - 投资组合管理
  - 关键业务流程

### 测试文件命名规范

```
component.test.ts          # 单元测试
component.property.test.ts # 属性测试
component.integration.test.ts # 集成测试
```

### 运行测试

```bash
# 后端测试
cd backend
npm test                    # 运行所有测试
npm run test:watch          # 监听模式
npm run test:coverage       # 生成覆盖率报告

# 前端测试
cd frontend
npm test                    # 运行单元测试
npm run test:coverage       # 生成覆盖率报告
npm run test:e2e            # 运行 E2E 测试
npm run test:e2e:ui         # E2E 测试 UI 模式
npm run test:e2e:debug      # E2E 测试调试模式
```

### 测试覆盖率目标

- **单元测试**: > 80%
- **集成测试**: 关键 API 端点 100%
- **E2E 测试**: 核心用户流程 100%

---

## 项目结构

### 后端项目结构

```
backend/
├── config/                 # 配置文件
│   └── app.config.json
├── dist/                   # 编译输出目录
├── docs/                   # 文档
│   └── CONFIGURATION.md
├── prisma/                 # Prisma ORM
│   ├── migrations/         # 数据库迁移
│   ├── schema.prisma       # 数据模型定义
│   └── seed.ts             # 种子数据
├── scripts/                # 脚本工具
│   ├── clean-seed-data.ts
│   ├── generate-api-docs.ts
│   ├── sync-all-stocks.ts
│   └── ...
├── src/                    # 源代码
│   ├── config/             # 配置加载
│   ├── lib/                # 核心库
│   │   ├── cache-manager.ts
│   │   ├── messageQueue.ts
│   │   ├── prisma.ts
│   │   ├── redis.ts
│   │   └── socket.ts
│   ├── middleware/         # 中间件
│   │   ├── auth.ts
│   │   ├── cors.ts
│   │   ├── errorHandler.ts
│   │   ├── rateLimit.ts
│   │   ├── rbac.ts
│   │   └── ...
│   ├── routes/             # 路由定义
│   │   ├── auth.ts
│   │   ├── stocks.ts
│   │   ├── news.ts
│   │   ├── portfolio.ts
│   │   └── ...
│   ├── services/           # 业务逻辑层
│   │   ├── stockService.ts
│   │   ├── newsService.ts
│   │   ├── analysisService.ts
│   │   └── ...
│   ├── types/              # 类型定义
│   ├── utils/              # 工具函数
│   │   ├── DocumentationStructureManager.ts
│   │   ├── OpenAPIGenerator.ts
│   │   ├── RouteScanner.ts
│   │   └── ...
│   ├── app.ts              # Express 应用配置
│   └── index.ts            # 入口文件
├── .env                    # 环境变量
├── .env.example            # 环境变量示例
├── package.json            # 依赖配置
├── tsconfig.json           # TypeScript 配置
└── jest.config.js          # Jest 配置
```

### 前端项目结构

```
frontend/
├── e2e/                    # E2E 测试
├── public/                 # 静态资源
├── src/                    # 源代码
│   ├── assets/             # 资源文件
│   ├── components/         # React 组件
│   │   ├── AIAssistant.tsx
│   │   ├── AnalystRatings.tsx
│   │   ├── CompanyProfile.tsx
│   │   ├── MarketHeatmap.tsx
│   │   ├── StockChart.tsx
│   │   └── ...
│   ├── hooks/              # 自定义 Hooks
│   ├── integration/        # 集成测试
│   ├── lib/                # 工具库
│   │   └── websocket.ts
│   ├── pages/              # 页面组件
│   │   ├── LoginPage.tsx
│   │   ├── StockDetailPage.tsx
│   │   ├── PortfolioPage.tsx
│   │   └── ...
│   ├── services/           # API 服务
│   │   ├── api.ts
│   │   ├── stockApi.ts
│   │   ├── newsApi.ts
│   │   └── ...
│   ├── stores/             # 状态管理
│   │   └── authStore.ts
│   ├── types/              # 类型定义
│   ├── utils/              # 工具函数
│   │   └── formatters.ts
│   ├── App.tsx             # 根组件
│   ├── main.tsx            # 入口文件
│   └── index.css           # 全局样式
├── .env.development        # 开发环境变量
├── .env.example            # 环境变量示例
├── package.json            # 依赖配置
├── tsconfig.json           # TypeScript 配置
├── vite.config.ts          # Vite 配置
├── vitest.config.ts        # Vitest 配置
└── playwright.config.ts    # Playwright 配置
```

### 文档结构

```
docs/
├── api/                    # API 文档
│   ├── authentication.md   # 认证文档
│   ├── swagger-ui-guide.md # Swagger 使用指南
│   └── openapi.yaml        # OpenAPI 规范
└── README.md               # 文档索引
```

### 规范目录

```
.kiro/
├── specs/                  # 功能规范
│   ├── documentation-organization-and-archiving/
│   ├── project-review-and-upgrade/
│   ├── smart-stock-analyzer/
│   ├── stock-detail-and-heatmap-enhancement/
│   └── website-development-standards/
└── steering/               # 开发指南
```

---

## 附录

### 外部 API 集成

#### 1. Finnhub API
- **用途**: 实时股票数据、新闻、财报
- **文档**: https://finnhub.io/docs/api
- **限制**: 根据订阅计划

#### 2. Yahoo Finance API
- **用途**: 历史数据、股票信息
- **库**: yahoo-finance2
- **文档**: https://github.com/gadicc/node-yahoo-finance2

#### 3. Alpha Vantage API
- **用途**: 技术指标、基本面数据
- **文档**: https://www.alphavantage.co/documentation/
- **限制**: 免费版每分钟 5 次请求

### 技术文档链接

- **Express**: https://expressjs.com/
- **React**: https://react.dev/
- **Prisma**: https://www.prisma.io/docs
- **Socket.IO**: https://socket.io/docs/
- **ECharts**: https://echarts.apache.org/
- **Vitest**: https://vitest.dev/
- **Playwright**: https://playwright.dev/

### 贡献指南

#### 代码规范
- 遵循 ESLint 和 Prettier 配置
- 使用 TypeScript 严格模式
- 编写清晰的注释
- 保持代码简洁

#### 提交规范
```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式调整
refactor: 重构
test: 测试相关
chore: 构建/工具相关
```

#### Pull Request 流程
1. Fork 项目
2. 创建功能分支
3. 编写代码和测试
4. 提交 PR
5. 代码审查
6. 合并到主分支

### 常见问题

#### Q: 如何重置数据库？
```bash
npm run prisma:migrate reset
npm run db:seed
```

#### Q: 如何添加新的 API 端点？
1. 在 `src/routes/` 创建路由文件
2. 在 `src/services/` 实现业务逻辑
3. 在 `src/routes/index.ts` 注册路由
4. 添加相应的测试

#### Q: 如何调试 WebSocket 连接？
- 使用浏览器开发者工具的 Network 标签
- 查看 WebSocket 连接状态和消息
- 检查服务器日志

#### Q: 如何优化查询性能？
- 使用 Prisma Studio 查看查询
- 添加数据库索引
- 使用 Redis 缓存
- 实现分页查询

### 许可证

MIT License

### 联系方式

- **项目仓库**: <repository-url>
- **问题反馈**: <issues-url>
- **技术支持**: <support-email>

---

**文档结束**

*本文档会随项目发展持续更新，请定期查看最新版本。*
