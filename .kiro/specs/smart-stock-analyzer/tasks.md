# 实现计划：智能股票分析网站

## 概述

本实现计划将智能股票分析网站的设计分解为可执行的编码任务。采用增量开发方式，每个任务都建立在前一个任务的基础上，确保代码始终可运行和可测试。实现采用 TypeScript + React 前端和 Node.js + Express 后端架构，使用 PostgreSQL 数据库和 Redis 缓存。

## 任务列表

- [x] 1. 项目初始化与基础架构
  - [x] 1.1 初始化前端项目（React + TypeScript + Vite）
    - 创建项目结构，配置 TypeScript、ESLint、Prettier
    - 安装核心依赖：React Router、Zustand、Axios、Socket.IO Client
    - 配置路径别名和环境变量
    - _Requirements: 6.7_
  
  - [x] 1.2 初始化后端项目（Node.js + Express + TypeScript）
    - 创建项目结构，配置 TypeScript 编译
    - 安装核心依赖：Express、Socket.IO、Prisma、Redis
    - 配置 CORS、日志、错误处理中间件
    - _Requirements: 6.6_
  
  - [x] 1.3 配置数据库和 ORM
    - 创建 PostgreSQL 数据库 Schema（Prisma）
    - 定义用户、股票、自选股、设置等核心表
    - 配置 Redis 连接用于缓存
    - _Requirements: 7.6_

- [x] 2. 用户认证与账户管理
  - [x] 2.1 实现用户注册和登录 API
    - 创建 UserService 实现注册、登录、JWT 生成
    - 实现密码加密存储（bcrypt）
    - 创建认证中间件验证 JWT
    - _Requirements: 7.1, 7.2_

  - [x] 2.2 编写用户设置持久化属性测试
    - **Property 11: 用户设置持久化属性**
    - **Validates: Requirements 7.2, 7.3**
  
  - [x] 2.3 实现用户设置 API
    - 创建 getSettings 和 updateSettings 端点
    - 实现默认设置初始化
    - _Requirements: 7.3, 6.5_
  
  - [x] 2.4 实现前端认证页面和状态管理
    - 创建登录、注册页面组件
    - 实现 Zustand 认证状态存储
    - 配置 Axios 拦截器自动添加 Token
    - _Requirements: 7.1, 7.2, 7.4_

- [x] 3. 检查点 - 确保认证功能正常
  - 确保所有测试通过，如有问题请询问用户

- [x] 4. 股票数据服务
  - [x] 4.1 实现股票搜索 API
    - 创建 StockService 实现股票搜索
    - 集成外部行情数据 API
    - 实现搜索结果缓存
    - _Requirements: 1.1_
  
  - [x] 4.2 编写搜索匹配属性测试
    - **Property 1: 搜索匹配属性**
    - **Validates: Requirements 1.1**
  
  - [x] 4.3 实现股票详情和行情 API
    - 创建 getStockDetail 和 getQuote 端点
    - 实现历史数据获取（getHistoricalData）
    - 配置 Redis 缓存行情数据
    - _Requirements: 4.1, 4.3_
  
  - [x] 4.4 编写时间范围数据属性测试
    - **Property 9: 时间范围数据属性**
    - **Validates: Requirements 4.3**
  
  - [x] 4.5 实现基本面和技术指标计算
    - 创建 FundamentalMetrics 计算逻辑
    - 实现 RSI、MACD、布林带等技术指标计算
    - _Requirements: 10.3, 10.4, 16.1_
  
  - [x] 4.6 编写技术指标计算属性测试
    - **Property 23: 技术指标计算属性**
    - **Validates: Requirements 16.1, 16.4**

- [x] 5. 自选股管理
  - [x] 5.1 实现自选股 CRUD API
    - 创建 WatchlistService 实现增删改查
    - 实现重复检测和排序功能
    - _Requirements: 1.2, 1.3, 1.5, 1.6_
  
  - [x] 5.2 编写自选股增删属性测试
    - **Property 2: 自选股增删属性**
    - **Validates: Requirements 1.2, 1.3**
  
  - [x] 5.3 编写自选股排序属性测试
    - **Property 3: 自选股排序属性**
    - **Validates: Requirements 1.6**
  
  - [x] 5.4 实现前端自选股组件
    - 创建 WatchlistPanel 组件
    - 实现拖拽排序功能（react-beautiful-dnd）
    - 实现股票搜索和添加 UI
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

- [x] 6. 检查点 - 确保自选股功能正常
  - 确保所有测试通过，如有问题请询问用户

- [x] 7. 新闻聚合与信息流
  - [x] 7.1 实现新闻聚合服务
    - 创建 NewsService 集成多个新闻 API
    - 实现新闻去重和来源标注
    - 配置 Elasticsearch 存储和搜索
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [x] 7.2 编写新闻去重属性测试
    - **Property 31: 新闻去重属性**
    - **Validates: Requirements 8.2**
  
  - [x] 7.3 实现信息流排序逻辑
    - 按优先级和时间排序新闻
    - 实现分页和筛选
    - _Requirements: 6.4_
  
  - [x] 7.4 编写信息流排序属性测试
    - **Property 10: 信息流排序属性**
    - **Validates: Requirements 6.4**
  
  - [x] 7.5 实现前端信息流组件
    - 创建 NewsFeed 组件
    - 实现无限滚动加载
    - 显示新闻来源和可信度
    - _Requirements: 6.4, 8.3_

- [x] 8. 智能分析服务
  - [x] 8.1 实现影响分析 API
    - 创建 AnalysisService 集成 AI API
    - 实现新闻影响分析（方向、程度、置信度）
    - 实现低置信度标注逻辑
    - _Requirements: 3.1, 3.2, 3.6_
  
  - [x] 8.2 编写影响分析完整性属性测试
    - **Property 7: 影响分析完整性属性**
    - **Validates: Requirements 3.1, 3.2**
  
  - [x] 8.3 编写低置信度标注属性测试
    - **Property 8: 低置信度标注属性**
    - **Validates: Requirements 3.6**
  
  - [x] 8.4 实现信息摘要和对比分析
    - 实现 summarizeNews 多条新闻摘要
    - 实现 compareStocks 股票对比分析
    - _Requirements: 3.3, 3.4, 9.5_
  
  - [x] 8.5 实现前端分析展示组件
    - 创建 ImpactAnalysisCard 组件
    - 显示影响方向、程度和关键点
    - 实现分析详情弹窗
    - _Requirements: 3.1, 3.2, 3.5_

- [x] 9. 检查点 - 确保分析功能正常
  - 确保所有测试通过，如有问题请询问用户

- [x] 10. 实时推送服务
  - [x] 10.1 实现 WebSocket 推送服务
    - 创建 PushService 使用 Socket.IO
    - 实现股票订阅和取消订阅
    - 实现消息广播逻辑
    - _Requirements: 2.1, 2.4_
  
  - [x] 10.2 实现价格提醒功能
    - 创建价格监控任务
    - 实现阈值触发推送
    - _Requirements: 2.3_
  
  - [x] 10.3 编写价格波动推送属性测试
    - **Property 4: 价格波动推送属性**
    - **Validates: Requirements 2.3**
  
  - [x] 10.4 实现免打扰时段逻辑
    - 检查用户免打扰设置
    - 在免打扰时段暂停推送
    - _Requirements: 2.6_
  
  - [x] 10.5 编写免打扰时段属性测试
    - **Property 5: 免打扰时段属性**
    - **Validates: Requirements 2.6**
  
  - [x] 10.6 实现离线消息缓存
    - 缓存离线用户的推送消息
    - 用户上线时批量发送
    - _Requirements: 2.5_
  
  - [x] 10.7 编写离线消息缓存属性测试
    - **Property 6: 离线消息缓存属性**
    - **Validates: Requirements 2.5**
  
  - [x] 10.8 实现前端推送接收和通知
    - 集成 Socket.IO Client
    - 实现通知弹窗和提醒列表
    - 创建 NotificationPanel 组件
    - _Requirements: 2.1, 2.7_

- [x] 11. 股票筛选器
  - [x] 11.1 实现筛选器服务
    - 创建 ScreenerService 实现多条件筛选
    - 支持描述性、基本面、技术面筛选
    - 实现排序和分页
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.7_
  
  - [x] 11.2 编写筛选器过滤属性测试
    - **Property 12: 筛选器过滤属性**
    - **Validates: Requirements 10.2, 10.3, 10.4, 10.5**
  
  - [x] 11.3 编写筛选结果排序属性测试
    - **Property 13: 筛选结果排序属性**
    - **Validates: Requirements 10.7**
  
  - [x] 11.4 实现筛选模板保存和加载
    - 创建模板 CRUD API
    - _Requirements: 10.6_
  
  - [x] 11.5 编写筛选模板持久化属性测试
    - **Property 14: 筛选模板持久化属性**
    - **Validates: Requirements 10.6**
  
  - [x] 11.6 实现前端筛选器页面
    - 创建 ScreenerPage 和 FilterPanel 组件
    - 实现筛选条件 UI
    - 显示筛选结果列表
    - _Requirements: 10.1, 10.5, 10.8_

- [x] 12. 检查点 - 确保筛选器功能正常
  - 确保所有测试通过，如有问题请询问用户

- [x] 13. 数据可视化
  - [x] 13.1 实现 K 线图组件
    - 集成 TradingView Lightweight Charts
    - 实现时间范围切换
    - 显示成交量图
    - _Requirements: 4.1, 4.3_
  
  - [x] 13.2 实现技术指标叠加
    - 添加 RSI、MACD、布林带等指标图层
    - 实现指标参数自定义
    - _Requirements: 16.1, 16.4_
  
  - [x] 13.3 实现事件时间轴标注
    - 在图表上标注新闻和事件
    - 实现悬停显示详情
    - _Requirements: 4.2, 4.5_
  
  - [x] 13.4 实现市场热力图
    - 使用 ECharts 创建热力图组件
    - 支持按板块、市值分组
    - _Requirements: 4.4, 18.2, 18.6_
  
  - [x] 13.5 编写热力图数据属性测试
    - **Property 28: 热力图数据属性**
    - **Validates: Requirements 18.2**

- [x] 14. 财报日历与追踪
  - [x] 14.1 实现财报日历 API
    - 创建 EarningsCalendar 服务
    - 获取和存储财报事件
    - 实现筛选和排序
    - _Requirements: 11.1, 11.2, 11.3, 11.6_
  
  - [x] 14.2 编写财报日历时间属性测试
    - **Property 15: 财报日历时间属性**
    - **Validates: Requirements 11.1, 11.2**
  
  - [x] 14.3 实现财报提醒推送
    - 财报前推送提醒
    - 财报后推送业绩对比
    - _Requirements: 11.4, 11.5_
  
  - [x] 14.4 实现前端财报日历组件
    - 创建日历视图组件
    - 显示财报事件详情
    - _Requirements: 11.1, 11.7_

- [x] 15. 内部交易监控
  - [x] 15.1 实现内部交易数据服务
    - 创建 InsiderTracker 服务
    - 集成 SEC EDGAR API
    - 存储和查询内部交易记录
    - _Requirements: 12.1, 12.2, 12.4_
  
  - [x] 15.2 编写内部交易数据完整性属性测试
    - **Property 17: 内部交易数据完整性属性**
    - **Validates: Requirements 12.1, 12.2, 12.4**
  
  - [x] 15.3 实现内部交易趋势计算
    - 计算净买入/卖出趋势
    - _Requirements: 12.6_
  
  - [x] 15.4 编写内部交易趋势计算属性测试
    - **Property 18: 内部交易趋势计算属性**
    - **Validates: Requirements 12.6**
  
  - [x] 15.5 实现重大交易推送
    - 监控大额交易
    - 触发推送通知
    - _Requirements: 12.3_
  
  - [x] 15.6 实现前端内部交易组件
    - 显示交易记录列表
    - 显示趋势图表
    - _Requirements: 12.1, 12.5_

- [x] 16. 检查点 - 确保财报和内部交易功能正常
  - 确保所有测试通过，如有问题请询问用户

- [x] 17. 量化评级系统
  - [x] 17.1 实现量化评级计算服务
    - 创建 QuantRating 服务
    - 实现多维度评分计算
    - 计算板块和行业排名
    - _Requirements: 13.1, 13.2, 13.4_
  
  - [x] 17.2 编写量化评级计算属性测试
    - **Property 19: 量化评级计算属性**
    - **Validates: Requirements 13.1, 13.2**
  
  - [x] 17.3 编写量化评级排名属性测试
    - **Property 20: 量化评级排名属性**
    - **Validates: Requirements 13.4**
  
  - [x] 17.4 实现评级变化追踪和推送
    - 记录评级历史
    - 评级变化时推送通知
    - _Requirements: 13.5, 13.6_
  
  - [x] 17.5 实现前端评级展示组件
    - 创建 RatingBadge 组件
    - 显示各维度得分
    - _Requirements: 13.1, 13.3_

- [x] 18. 财报电话会议记录
  - [x] 18.1 实现会议记录服务
    - 创建 TranscriptService
    - 获取和存储会议记录
    - 实现关键词搜索
    - _Requirements: 14.1, 14.2, 14.3_
  
  - [x] 18.2 编写会议记录搜索属性测试
    - **Property 21: 会议记录搜索属性**
    - **Validates: Requirements 14.3**
  
  - [x] 18.3 实现会议记录 AI 摘要
    - 集成 AI 生成摘要
    - 高亮关键陈述
    - _Requirements: 14.5, 14.6_
  
  - [x] 18.4 实现前端会议记录组件
    - 显示记录列表和详情
    - 实现搜索和高亮
    - _Requirements: 14.1, 14.3, 14.6_

- [x] 19. 股息追踪
  - [x] 19.1 实现股息数据服务
    - 创建 DividendTracker 服务
    - 获取股息历史和日历
    - _Requirements: 15.1, 15.2_
  
  - [x] 19.2 实现股息收入计算
    - 计算投资组合预期股息收入
    - _Requirements: 15.6_
  
  - [x] 19.3 编写股息收入计算属性测试
    - **Property 22: 股息收入计算属性**
    - **Validates: Requirements 15.6**
  
  - [x] 19.4 实现股息提醒推送
    - 除息日前推送提醒
    - 股息变化推送通知
    - _Requirements: 15.3, 15.5_
  
  - [x] 19.5 实现前端股息组件
    - 显示股息日历
    - 显示股息历史图表
    - _Requirements: 15.1, 15.2, 15.4_

- [x] 20. 检查点 - 确保评级、会议记录和股息功能正常
  - 确保所有测试通过，如有问题请询问用户

- [x] 21. 投资组合管理
  - [x] 21.1 实现投资组合 CRUD API
    - 创建 Portfolio 服务
    - 实现组合和持仓管理
    - 记录交易历史
    - _Requirements: 17.1, 17.4, 17.7_
  
  - [x] 21.2 实现投资组合计算服务
    - 计算总市值、收益、收益率
    - 计算各持仓盈亏和占比
    - 计算板块分布
    - _Requirements: 17.2, 17.3, 17.5_
  
  - [x] 21.3 编写投资组合市值计算属性测试
    - **Property 25: 投资组合市值计算属性**
    - **Validates: Requirements 17.2**
  
  - [x] 21.4 编写投资组合收益计算属性测试
    - **Property 26: 投资组合收益计算属性**
    - **Validates: Requirements 17.3**
  
  - [x] 21.5 编写投资组合板块分布属性测试
    - **Property 27: 投资组合板块分布属性**
    - **Validates: Requirements 17.5**
  
  - [x] 21.6 实现收益曲线和基准对比
    - 计算历史收益曲线
    - 与基准指数对比
    - _Requirements: 17.6_
  
  - [x] 21.7 实现前端投资组合页面
    - 创建 PortfolioPage 组件
    - 显示持仓列表和统计
    - 显示收益图表
    - _Requirements: 17.1, 17.2, 17.3, 17.5, 17.6_

- [x] 22. 市场概览
  - [x] 22.1 实现市场数据 API
    - 获取主要指数行情
    - 计算涨跌家数和市场情绪
    - 生成涨幅榜、跌幅榜
    - _Requirements: 18.1, 18.4, 18.5_
  
  - [x] 22.2 编写排行榜排序属性测试
    - **Property 29: 排行榜排序属性**
    - **Validates: Requirements 18.5**
  
  - [x] 22.3 实现前端市场概览组件
    - 创建首页市场概览区域
    - 显示指数行情和热力图
    - 显示排行榜
    - _Requirements: 18.1, 18.4, 18.5_

- [x] 23. 分析师评级
  - [x] 23.1 实现分析师评级服务
    - 获取分析师评级数据
    - 存储评级历史
    - _Requirements: 19.1, 19.2, 19.4_
  
  - [x] 23.2 实现评级变化推送
    - 监控评级变化
    - 触发推送通知
    - _Requirements: 19.3_
  
  - [x] 23.3 实现前端评级组件
    - 显示综合评级和目标价
    - 显示各机构评级详情
    - _Requirements: 19.1, 19.2, 19.6_

- [x] 24. SEC 文件追踪
  - [x] 24.1 实现 SEC 文件服务
    - 集成 SEC EDGAR API
    - 获取和存储 SEC 文件
    - 实现筛选功能
    - _Requirements: 20.1, 20.5_
  
  - [x] 24.2 编写 SEC 文件筛选属性测试
    - **Property 32: SEC文件筛选属性**
    - **Validates: Requirements 20.5**
  
  - [x] 24.3 实现 SEC 文件 AI 摘要
    - 生成文件摘要
    - 分析重大披露影响
    - _Requirements: 20.4, 20.6_
  
  - [x] 24.4 实现 SEC 文件推送
    - 新文件推送通知
    - _Requirements: 20.2_
  
  - [x] 24.5 实现前端 SEC 文件组件
    - 显示文件列表
    - 显示摘要和原文链接
    - _Requirements: 20.1, 20.3_

- [x] 25. 检查点 - 确保投资组合、市场概览和 SEC 功能正常
  - 确保所有测试通过，如有问题请询问用户

- [x] 26. 板块订阅
  - [x] 26.1 实现板块订阅服务
    - 创建 SectorSubscription 服务
    - 实现订阅和取消订阅
    - 聚合板块新闻和动态
    - _Requirements: 5.1, 5.2, 5.3, 5.5_
  
  - [x] 26.2 实现板块推送
    - 板块重大新闻推送
    - _Requirements: 5.4_
  
  - [x] 26.3 实现前端板块页面
    - 创建 SectorPage 组件
    - 显示板块列表和详情
    - 显示板块走势和热门股票
    - _Requirements: 5.1, 5.3, 5.6_

- [x] 27. AI 智能助手
  - [x] 27.1 实现 AI 对话服务
    - 创建 AI 对话 API
    - 实现意图识别和指令解析
    - 集成操作执行
    - _Requirements: 9.1, 9.6, 9.7_
  
  - [x] 27.2 编写 AI 指令解析属性测试
    - **Property 30: AI指令解析属性**
    - **Validates: Requirements 9.1, 9.2**
  
  - [x] 27.3 实现自选股操作指令
    - 解析添加/移除自选股指令
    - 执行操作并确认
    - _Requirements: 9.2_
  
  - [x] 27.4 实现信息总结功能
    - 实现一键总结信息流
    - 实现板块动态总结
    - _Requirements: 9.3, 9.8_
  
  - [x] 27.5 实现股票问答和对比
    - 回答股票相关问题
    - 生成对比分析报告
    - _Requirements: 9.4, 9.5_
  
  - [x] 27.6 实现个性化建议
    - 基于用户偏好提供建议
    - _Requirements: 9.9_
  
  - [x] 27.7 实现前端 AI 助手组件
    - 创建 AIAssistant 聊天组件
    - 实现对话 UI
    - 显示操作确认
    - _Requirements: 9.1, 9.6, 9.7_

- [x] 28. 技术指标信号提醒
  - [x] 28.1 实现技术指标监控服务
    - 监控用户设定的技术指标条件
    - 实现信号触发逻辑
    - _Requirements: 16.5_
  
  - [x] 28.2 编写技术信号触发属性测试
    - **Property 24: 技术信号触发属性**
    - **Validates: Requirements 16.5**
  
  - [x] 28.3 实现技术指标提醒推送
    - 触发时推送通知给用户
    - _Requirements: 16.5_

- [x] 29. 事件触发推送整合
  - [x] 29.1 整合所有事件推送
    - 统一财报、内部交易、评级、股息、SEC 文件推送
    - 实现推送优先级管理
    - _Requirements: 2.2, 11.4, 12.3, 13.6, 15.5, 19.3, 20.2_
  
  - [x] 29.2 编写事件触发推送属性测试
    - **Property 16: 事件触发推送属性**
    - **Validates: Requirements 11.4, 12.3, 13.6, 14.4, 15.5, 19.3, 20.2**

- [x] 30. 用户界面完善
  - [x] 30.1 实现新手引导教程
    - 创建交互式引导组件
    - 实现功能提示
    - _Requirements: 6.1, 6.2_
  
  - [x] 30.2 实现响应式布局
    - 适配桌面和移动设备
    - 优化触摸交互
    - _Requirements: 6.7, 4.7_
  
  - [x] 30.3 实现错误处理 UI
    - 显示友好错误提示
    - 实现重试机制
    - _Requirements: 6.6_
  
  - [x] 30.4 实现数据导出功能
    - 导出自选股列表
    - 导出投资组合数据
    - _Requirements: 7.5_

- [x] 31. 最终检查点 - 确保所有功能正常
  - 确保所有测试通过，如有问题请询问用户

## 备注

- 每个任务都引用了具体的需求以确保可追溯性
- 检查点用于增量验证，确保功能正常
- 属性测试验证通用正确性属性（每个测试运行最少 100 次迭代）
- 单元测试验证具体示例和边界情况
- 所有属性测试必须用注释标注：**Feature: smart-stock-analyzer, Property {number}: {property_text}**
- 测试框架：Jest（单元测试）+ fast-check（属性测试）
- 所有测试任务均为必需，确保代码质量
