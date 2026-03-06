# 需求文档

## 简介

智能股票分析网站（Smart Stock Analyzer）是一个面向个人投资者的一站式智能投资助手平台。该系统融合 Finviz 的数据可视化能力和 Seeking Alpha 的深度分析优势，通过智能筛选、分析和可视化海量金融信息，帮助用户做出更明智的投资决策。核心特点包括自选股实时推送、智能信息分析、数据可视化、板块订阅以及简洁易用的界面设计。

## 术语表

- **Stock_Analyzer（股票分析器）**: 核心分析引擎，负责处理股票数据和生成分析报告
- **Watchlist_Manager（自选股管理器）**: 管理用户自选股列表的组件
- **Push_Service（推送服务）**: 负责实时推送股票相关信息的服务
- **News_Aggregator（新闻聚合器）**: 收集和整理股票相关新闻、公告的组件
- **Impact_Analyzer（影响分析器）**: 分析新闻和事件对股价潜在影响的智能组件
- **Visualization_Engine（可视化引擎）**: 生成图表和数据可视化的组件
- **Sector_Subscription（板块订阅）**: 用户订阅特定行业板块的功能
- **User（用户）**: 使用系统的个人投资者
- **Stock（股票）**: 被追踪和分析的证券标的
- **Sector（板块）**: 股票所属的行业分类，如科技、医疗、能源等
- **Alert（提醒）**: 系统向用户发送的通知消息
- **AI_Assistant（AI 助手）**: 基于自然语言处理的智能交互组件，帮助用户完成操作和获取信息总结
- **Stock_Screener（股票筛选器）**: 基于多维度条件筛选股票的工具
- **Earnings_Calendar（财报日历）**: 追踪和展示公司财报发布时间的组件
- **Insider_Tracker（内部交易追踪器）**: 监控公司内部人士买卖股票行为的组件
- **Quant_Rating（量化评级）**: 基于量化指标对股票进行评级的系统
- **Transcript_Service（电话会议记录服务）**: 提供财报电话会议文字记录的服务
- **Dividend_Tracker（股息追踪器）**: 追踪股息发放信息的组件
- **Technical_Indicator（技术指标）**: 用于技术分析的各类指标，如 RSI、MACD、移动平均线等
- **Fundamental_Metric（基本面指标）**: 用于基本面分析的财务指标，如 P/E、EPS、市值等
- **Portfolio（投资组合）**: 用户持有股票的集合及其表现追踪

## 需求

### 需求 1：自选股管理

**用户故事：** 作为个人投资者，我希望能够管理我的自选股列表，以便追踪我关注的股票。

#### 验收标准

1. WHEN 用户搜索股票代码或名称 THEN Watchlist_Manager SHALL 显示匹配的股票列表供用户选择
2. WHEN 用户添加股票到自选股 THEN Watchlist_Manager SHALL 将该股票保存到用户的自选股列表并立即显示
3. WHEN 用户从自选股中移除股票 THEN Watchlist_Manager SHALL 从列表中删除该股票并停止相关推送
4. WHEN 用户查看自选股列表 THEN Watchlist_Manager SHALL 显示所有自选股的当前价格、涨跌幅和最新动态摘要
5. IF 用户添加重复的股票 THEN Watchlist_Manager SHALL 提示用户该股票已在自选股列表中
6. WHEN 用户拖拽自选股 THEN Watchlist_Manager SHALL 允许用户自定义排序顺序并保存

### 需求 2：实时信息推送

**用户故事：** 作为个人投资者，我希望实时接收影响我自选股的重要信息，以便及时了解市场动态。

#### 验收标准

1. WHEN 自选股有新的相关新闻发布 THEN Push_Service SHALL 在30秒内向用户推送通知
2. WHEN 自选股发布财报或重大公告 THEN Push_Service SHALL 立即推送高优先级通知
3. WHEN 自选股价格波动超过用户设定阈值 THEN Push_Service SHALL 推送价格异动提醒
4. WHILE 用户在线 THEN Push_Service SHALL 通过网页实时更新信息流
5. WHILE 用户离线 THEN Push_Service SHALL 缓存推送消息并在用户上线时批量展示
6. WHERE 用户设置了免打扰时段 THEN Push_Service SHALL 在该时段内暂停推送通知
7. WHEN 用户点击推送通知 THEN Push_Service SHALL 跳转到相关信息详情页面

### 需求 3：智能信息分析

**用户故事：** 作为个人投资者，我希望系统能智能分析推送的信息对股价的潜在影响，以便快速理解信息价值。

#### 验收标准

1. WHEN 新闻或公告被推送 THEN Impact_Analyzer SHALL 自动生成影响分析摘要
2. WHEN 分析新闻影响 THEN Impact_Analyzer SHALL 标注影响方向（利好/利空/中性）和影响程度（高/中/低）
3. WHEN 生成分析摘要 THEN Impact_Analyzer SHALL 提取关键信息点并用简洁语言解释潜在影响
4. WHEN 多条相关新闻出现 THEN Impact_Analyzer SHALL 整合分析并展示综合影响评估
5. WHEN 用户查看分析详情 THEN Impact_Analyzer SHALL 展示分析依据和历史类似事件的股价反应
6. IF 分析置信度较低 THEN Impact_Analyzer SHALL 明确标注并建议用户自行判断

### 需求 4：数据可视化

**用户故事：** 作为个人投资者，我希望通过直观的图表了解股票走势和相关信息，以便更好地把握投资时机。

#### 验收标准

1. WHEN 用户查看股票详情 THEN Visualization_Engine SHALL 显示可交互的K线图和成交量图
2. WHEN 用户查看股票详情 THEN Visualization_Engine SHALL 在时间轴上标注重要新闻和事件节点
3. WHEN 用户选择时间范围 THEN Visualization_Engine SHALL 动态更新图表显示对应时段数据
4. WHEN 用户查看板块概览 THEN Visualization_Engine SHALL 显示板块热力图展示各股票涨跌情况
5. WHEN 用户悬停在图表节点 THEN Visualization_Engine SHALL 显示该时间点的详细数据和相关事件
6. WHEN 用户查看影响因素 THEN Visualization_Engine SHALL 以图表形式展示各因素对股价的影响权重
7. WHERE 用户使用移动设备 THEN Visualization_Engine SHALL 自适应显示并支持触摸交互

### 需求 5：板块订阅

**用户故事：** 作为个人投资者，我希望订阅特定行业板块，以便系统自动收集整理该板块的更新信息。

#### 验收标准

1. WHEN 用户浏览板块列表 THEN Sector_Subscription SHALL 显示所有可订阅板块及其简介
2. WHEN 用户订阅板块 THEN Sector_Subscription SHALL 开始收集该板块的新闻、分析和市场动态
3. WHEN 用户查看已订阅板块 THEN Sector_Subscription SHALL 显示该板块的综合信息流和热门股票
4. WHEN 板块有重大行业新闻 THEN Sector_Subscription SHALL 推送板块级别的信息更新
5. WHEN 用户取消订阅板块 THEN Sector_Subscription SHALL 停止该板块的信息推送
6. WHEN 用户查看板块详情 THEN Sector_Subscription SHALL 显示板块整体走势、龙头股表现和行业分析

### 需求 6：用户界面与体验

**用户故事：** 作为新手投资者，我希望界面简洁直观且有功能引导，以便快速上手使用系统。

#### 验收标准

1. WHEN 新用户首次登录 THEN Stock_Analyzer SHALL 显示交互式功能引导教程
2. WHEN 用户使用新功能 THEN Stock_Analyzer SHALL 提供上下文相关的操作提示
3. THE Stock_Analyzer SHALL 采用简洁的视觉设计，避免信息过载
4. WHEN 用户查看信息流 THEN Stock_Analyzer SHALL 按重要性和时间排序展示信息
5. WHERE 用户自定义了界面偏好 THEN Stock_Analyzer SHALL 保存并应用用户的个性化设置
6. WHEN 用户遇到错误 THEN Stock_Analyzer SHALL 显示友好的错误提示和解决建议
7. THE Stock_Analyzer SHALL 支持响应式设计，适配桌面和移动设备

### 需求 7：用户账户与数据管理

**用户故事：** 作为用户，我希望我的自选股和偏好设置能够安全保存，以便在不同设备上访问。

#### 验收标准

1. WHEN 用户注册账户 THEN Stock_Analyzer SHALL 创建用户账户并初始化默认设置
2. WHEN 用户登录 THEN Stock_Analyzer SHALL 恢复用户的自选股列表、订阅和偏好设置
3. WHEN 用户修改设置 THEN Stock_Analyzer SHALL 实时保存更改到云端
4. IF 用户未登录 THEN Stock_Analyzer SHALL 允许有限功能体验并提示登录以解锁完整功能
5. WHEN 用户请求导出数据 THEN Stock_Analyzer SHALL 提供自选股列表和设置的导出功能
6. THE Stock_Analyzer SHALL 加密存储用户敏感数据并遵循数据保护规范

### 需求 8：信息源管理与数据质量

**用户故事：** 作为用户，我希望系统提供可靠、及时的信息，以便做出准确的投资判断。

#### 验收标准

1. THE News_Aggregator SHALL 从多个可靠信息源聚合新闻和公告
2. WHEN 聚合新闻 THEN News_Aggregator SHALL 去除重复内容并标注信息来源
3. WHEN 显示新闻 THEN News_Aggregator SHALL 标注发布时间和信息源可信度
4. IF 信息源不可用 THEN News_Aggregator SHALL 自动切换到备用信息源并通知用户
5. WHEN 用户反馈信息质量问题 THEN News_Aggregator SHALL 记录反馈并用于优化信息筛选
6. THE News_Aggregator SHALL 定期验证信息源的可用性和数据质量


### 需求 9：AI 智能助手

**用户故事：** 作为用户，我希望通过自然语言与 AI 助手交互，以便更便捷地完成操作和获取信息总结。

#### 验收标准

1. WHEN 用户输入自然语言指令 THEN AI_Assistant SHALL 理解意图并执行相应操作
2. WHEN 用户请求添加自选股（如"帮我关注苹果和特斯拉"）THEN AI_Assistant SHALL 自动添加对应股票到自选股列表
3. WHEN 用户请求信息总结（如"总结一下今天科技板块的动态"）THEN AI_Assistant SHALL 生成简洁的信息摘要
4. WHEN 用户询问股票相关问题 THEN AI_Assistant SHALL 基于最新数据提供分析和建议
5. WHEN 用户请求对比分析（如"比较苹果和微软的近期表现"）THEN AI_Assistant SHALL 生成对比分析报告
6. WHEN AI_Assistant 执行操作 THEN AI_Assistant SHALL 向用户确认操作结果
7. IF AI_Assistant 无法理解用户意图 THEN AI_Assistant SHALL 请求用户澄清并提供可能的操作建议
8. WHEN 用户查看信息流 THEN AI_Assistant SHALL 提供一键总结功能，快速概括当前信息要点
9. WHERE 用户设置了个人投资偏好 THEN AI_Assistant SHALL 基于偏好提供个性化的分析和建议


### 需求 10：智能股票筛选器

**用户故事：** 作为个人投资者，我希望通过多维度条件筛选股票，以便快速发现符合我投资策略的标的。

#### 验收标准

1. WHEN 用户打开筛选器 THEN Stock_Screener SHALL 显示描述性、基本面和技术面三类筛选条件
2. WHEN 用户设置描述性筛选条件 THEN Stock_Screener SHALL 支持按交易所、板块、市值范围、国家等筛选
3. WHEN 用户设置基本面筛选条件 THEN Stock_Screener SHALL 支持按 P/E、EPS 增长率、股息率、负债率等筛选
4. WHEN 用户设置技术面筛选条件 THEN Stock_Screener SHALL 支持按 RSI、移动平均线、价格形态、成交量等筛选
5. WHEN 用户应用筛选条件 THEN Stock_Screener SHALL 实时显示符合条件的股票列表
6. WHEN 用户保存筛选条件 THEN Stock_Screener SHALL 将条件组合保存为可复用的筛选模板
7. WHEN 用户查看筛选结果 THEN Stock_Screener SHALL 支持按不同指标排序和分页浏览
8. WHERE 用户选择图表视图 THEN Stock_Screener SHALL 以表格或卡片形式展示筛选结果

### 需求 11：财报日历与追踪

**用户故事：** 作为个人投资者，我希望追踪自选股和关注板块的财报发布时间，以便提前做好投资决策准备。

#### 验收标准

1. WHEN 用户查看财报日历 THEN Earnings_Calendar SHALL 显示未来财报发布的时间表
2. WHEN 用户查看财报日历 THEN Earnings_Calendar SHALL 标注盘前（BMO）或盘后（AMC）发布时间
3. WHEN 用户查看即将发布财报的股票 THEN Earnings_Calendar SHALL 显示预期 EPS、上期 EPS 和分析师预测
4. WHEN 自选股即将发布财报 THEN Earnings_Calendar SHALL 提前推送提醒通知
5. WHEN 财报发布后 THEN Earnings_Calendar SHALL 显示实际业绩与预期对比及股价反应
6. WHEN 用户筛选财报日历 THEN Earnings_Calendar SHALL 支持按日期、板块、市值等条件筛选
7. WHEN 用户点击财报事件 THEN Earnings_Calendar SHALL 跳转到该股票的详情页面

### 需求 12：内部交易监控

**用户故事：** 作为个人投资者，我希望了解公司内部人士的股票交易行为，以便洞察管理层对公司前景的真实看法。

#### 验收标准

1. WHEN 用户查看股票详情 THEN Insider_Tracker SHALL 显示近期内部交易记录
2. WHEN 内部人士买入或卖出股票 THEN Insider_Tracker SHALL 记录交易人身份、交易类型、数量和价格
3. WHEN 自选股有重大内部交易 THEN Insider_Tracker SHALL 推送通知提醒用户
4. WHEN 用户查看内部交易详情 THEN Insider_Tracker SHALL 显示交易人职位和历史交易记录
5. WHEN 用户浏览内部交易列表 THEN Insider_Tracker SHALL 支持按交易类型、金额、日期筛选
6. WHEN 分析内部交易 THEN Insider_Tracker SHALL 计算并显示内部人士净买入/卖出趋势

### 需求 13：量化评级系统

**用户故事：** 作为个人投资者，我希望获得基于量化指标的股票评级，以便快速评估股票的投资价值。

#### 验收标准

1. WHEN 用户查看股票详情 THEN Quant_Rating SHALL 显示综合量化评级（强烈买入/买入/持有/卖出/强烈卖出）
2. WHEN 生成量化评级 THEN Quant_Rating SHALL 基于估值、成长性、盈利能力、动量和修正因子计算
3. WHEN 用户查看评级详情 THEN Quant_Rating SHALL 展示各维度的具体得分和评级依据
4. WHEN 用户查看股票 THEN Quant_Rating SHALL 显示该股票在板块和行业中的排名
5. WHEN 量化评级发生变化 THEN Quant_Rating SHALL 记录评级历史并支持查看变化趋势
6. WHERE 用户订阅了评级变化提醒 THEN Quant_Rating SHALL 在自选股评级变化时推送通知

### 需求 14：财报电话会议记录

**用户故事：** 作为个人投资者，我希望阅读财报电话会议的文字记录，以便深入了解管理层对公司业务的解读。

#### 验收标准

1. WHEN 用户查看股票详情 THEN Transcript_Service SHALL 显示最近的财报电话会议记录列表
2. WHEN 用户阅读会议记录 THEN Transcript_Service SHALL 提供完整的问答环节文字记录
3. WHEN 用户搜索会议记录 THEN Transcript_Service SHALL 支持按关键词搜索特定主题或内容
4. WHEN 新的会议记录发布 THEN Transcript_Service SHALL 通知订阅了该股票的用户
5. WHEN 用户阅读会议记录 THEN AI_Assistant SHALL 提供一键总结功能，提取关键要点
6. WHEN 用户查看会议记录 THEN Transcript_Service SHALL 高亮显示管理层对业绩指引和战略方向的陈述

### 需求 15：股息追踪与分析

**用户故事：** 作为注重股息收入的投资者，我希望追踪股息发放信息，以便优化我的股息投资策略。

#### 验收标准

1. WHEN 用户查看股票详情 THEN Dividend_Tracker SHALL 显示股息率、派息频率和历史派息记录
2. WHEN 用户查看股息日历 THEN Dividend_Tracker SHALL 显示即将到来的除息日和派息日
3. WHEN 自选股即将除息 THEN Dividend_Tracker SHALL 提前推送提醒通知
4. WHEN 用户筛选股票 THEN Dividend_Tracker SHALL 支持按股息率、派息增长率、派息年限筛选
5. WHEN 公司宣布股息变化 THEN Dividend_Tracker SHALL 推送股息增减通知
6. WHEN 用户查看投资组合 THEN Dividend_Tracker SHALL 计算并显示预期年度股息收入

### 需求 16：技术分析工具

**用户故事：** 作为技术分析爱好者，我希望使用专业的技术指标和图表工具，以便进行深入的技术分析。

#### 验收标准

1. WHEN 用户查看股票图表 THEN Technical_Indicator SHALL 支持叠加多种技术指标（RSI、MACD、布林带等）
2. WHEN 用户分析图表 THEN Technical_Indicator SHALL 自动识别并标注常见价格形态（头肩顶、双底等）
3. WHEN 用户绘制图表 THEN Technical_Indicator SHALL 提供趋势线、支撑阻力线等绘图工具
4. WHEN 用户设置技术指标参数 THEN Technical_Indicator SHALL 允许自定义指标周期和参数
5. WHEN 技术指标触发信号 THEN Technical_Indicator SHALL 支持设置提醒（如 RSI 超买超卖）
6. WHEN 用户保存图表配置 THEN Technical_Indicator SHALL 保存指标组合供后续使用
7. WHERE 用户选择全屏模式 THEN Technical_Indicator SHALL 提供沉浸式图表分析体验

### 需求 17：投资组合管理

**用户故事：** 作为个人投资者，我希望追踪我的投资组合表现，以便评估投资策略的有效性。

#### 验收标准

1. WHEN 用户创建投资组合 THEN Portfolio SHALL 允许添加持仓股票、买入价格和数量
2. WHEN 用户查看投资组合 THEN Portfolio SHALL 显示总市值、总收益、收益率和日涨跌
3. WHEN 用户查看投资组合 THEN Portfolio SHALL 显示各持仓的盈亏情况和占比
4. WHEN 用户记录交易 THEN Portfolio SHALL 支持记录买入、卖出和股息收入
5. WHEN 用户分析投资组合 THEN Portfolio SHALL 显示板块分布和风险集中度分析
6. WHEN 用户查看投资组合历史 THEN Portfolio SHALL 显示收益曲线和与基准指数的对比
7. WHERE 用户设置了多个投资组合 THEN Portfolio SHALL 支持分别追踪和对比不同组合表现

### 需求 18：市场概览与热力图

**用户故事：** 作为个人投资者，我希望快速了解整体市场状况，以便把握市场情绪和趋势。

#### 验收标准

1. WHEN 用户访问首页 THEN Visualization_Engine SHALL 显示主要指数（道琼斯、标普500、纳斯达克）的实时行情
2. WHEN 用户查看市场热力图 THEN Visualization_Engine SHALL 以颜色深浅展示各板块和个股的涨跌幅度
3. WHEN 用户点击热力图区块 THEN Visualization_Engine SHALL 跳转到对应股票或板块详情
4. WHEN 用户查看市场概览 THEN Visualization_Engine SHALL 显示涨跌家数、成交量和市场情绪指标
5. WHEN 用户查看市场概览 THEN Visualization_Engine SHALL 显示当日涨幅榜、跌幅榜和成交量榜
6. WHEN 用户切换热力图视图 THEN Visualization_Engine SHALL 支持按市值、板块、涨跌幅等维度分组显示

### 需求 19：分析师评级与目标价

**用户故事：** 作为个人投资者，我希望了解华尔街分析师对股票的评级和目标价，以便参考专业意见。

#### 验收标准

1. WHEN 用户查看股票详情 THEN Stock_Analyzer SHALL 显示分析师综合评级和目标价
2. WHEN 用户查看评级详情 THEN Stock_Analyzer SHALL 显示各机构分析师的具体评级和目标价
3. WHEN 分析师调整评级 THEN Stock_Analyzer SHALL 推送评级变化通知
4. WHEN 用户查看评级历史 THEN Stock_Analyzer SHALL 显示评级变化趋势和目标价调整记录
5. WHEN 用户筛选股票 THEN Stock_Analyzer SHALL 支持按分析师评级和目标价上涨空间筛选
6. WHEN 显示分析师评级 THEN Stock_Analyzer SHALL 标注评级发布日期和分析师所属机构

### 需求 20：SEC 文件与公告追踪

**用户故事：** 作为个人投资者，我希望及时获取公司向 SEC 提交的文件，以便了解公司的重要披露信息。

#### 验收标准

1. WHEN 用户查看股票详情 THEN News_Aggregator SHALL 显示最近的 SEC 文件列表（10-K、10-Q、8-K 等）
2. WHEN 公司提交新的 SEC 文件 THEN News_Aggregator SHALL 推送通知提醒用户
3. WHEN 用户点击 SEC 文件 THEN News_Aggregator SHALL 提供文件摘要和原文链接
4. WHEN 用户查看 SEC 文件 THEN AI_Assistant SHALL 提供智能摘要，提取关键信息点
5. WHEN 用户筛选 SEC 文件 THEN News_Aggregator SHALL 支持按文件类型和日期范围筛选
6. WHEN 检测到重大披露 THEN Impact_Analyzer SHALL 分析披露内容对股价的潜在影响
