# Requirements Document

## Introduction

本功能规格涵盖两个主要部分：个股详情页（新功能）和市场热力图优化（现有功能改进）。个股详情页将提供全面的股票信息展示，包括可缩放K线图、公司基本信息、相关新闻、实时报价、技术指标、财务数据、分析师评级、内部交易记录等。市场热力图优化将改进现有热力图组件的交互体验，添加缩放功能、修复导航问题、补充完整数据并支持按板块/行业筛选。

这是 P0 级别的功能，需要高度重视。

## Glossary

- **Stock_Detail_Page**: 个股详情页面组件，展示单只股票的完整信息
- **K_Line_Chart**: K线图组件，支持多时间周期和缩放功能
- **Market_Heatmap**: 市场热力图组件，以颜色深浅展示股票涨跌幅
- **Company_Profile**: 公司基本信息模块，包含名称、代码、行业、市值等
- **Technical_Indicators**: 技术指标模块，包含 MA、MACD、RSI 等指标
- **Financial_Summary**: 财务数据摘要模块，展示关键财务指标
- **Analyst_Rating**: 分析师评级模块，展示华尔街分析师的评级和目标价
- **Insider_Trading**: 内部交易记录模块，展示公司内部人员的交易活动
- **Watchlist_Manager**: 自选股管理器，处理添加/移除自选股操作
- **Zoom_Controller**: 缩放控制器，处理热力图的放大/缩小操作
- **Sector_Filter**: 板块筛选器，支持按板块/行业筛选热力图数据
- **Finnhub_API**: 第三方股票数据 API 服务
- **WebSocket_Service**: 实时数据推送服务

## Requirements

### Requirement 1: 个股详情页 - 可缩放K线图

**User Story:** As a 投资者, I want 查看可缩放的K线图并支持多种时间周期, so that 我可以分析股票的历史价格走势和趋势。

#### Acceptance Criteria

1. WHEN 用户访问个股详情页 THEN Stock_Detail_Page SHALL 显示可交互的K线图，支持鼠标滚轮缩放和拖拽平移
2. WHEN 用户选择时间周期（日/周/月/年） THEN K_Line_Chart SHALL 动态加载并显示对应周期的K线数据
3. WHEN 用户在K线图上悬停 THEN K_Line_Chart SHALL 显示该时间点的开盘价、收盘价、最高价、最低价和成交量
4. WHEN K线图数据加载中 THEN K_Line_Chart SHALL 显示加载状态指示器
5. IF K线图数据加载失败 THEN K_Line_Chart SHALL 显示错误信息并提供重试按钮

### Requirement 2: 个股详情页 - 公司基本信息

**User Story:** As a 投资者, I want 查看公司的基本信息, so that 我可以了解公司的基本情况和行业定位。

#### Acceptance Criteria

1. WHEN 用户访问个股详情页 THEN Company_Profile SHALL 显示公司名称、股票代码、所属交易所
2. WHEN 用户访问个股详情页 THEN Company_Profile SHALL 显示公司所属行业和板块
3. WHEN 用户访问个股详情页 THEN Company_Profile SHALL 显示公司市值（格式化为易读形式，如 1.5T、200B）
4. WHEN 用户访问个股详情页 THEN Company_Profile SHALL 显示公司所在国家/地区
5. IF 公司信息不完整 THEN Company_Profile SHALL 对缺失字段显示"暂无数据"

### Requirement 3: 个股详情页 - 公司相关新闻

**User Story:** As a 投资者, I want 查看与该股票相关的最新新闻, so that 我可以了解影响股价的最新事件和动态。

#### Acceptance Criteria

1. WHEN 用户访问个股详情页 THEN Stock_Detail_Page SHALL 显示与该股票相关的最新新闻列表
2. WHEN 显示新闻列表 THEN Stock_Detail_Page SHALL 按发布时间倒序排列，显示标题、来源、发布时间
3. WHEN 用户点击新闻标题 THEN Stock_Detail_Page SHALL 在新标签页打开新闻原文链接
4. WHEN 新闻有影响分析 THEN Stock_Detail_Page SHALL 显示影响方向（利好/利空/中性）和影响程度
5. WHILE 新闻数据加载中 THEN Stock_Detail_Page SHALL 显示新闻加载骨架屏

### Requirement 4: 个股详情页 - 实时报价和涨跌幅

**User Story:** As a 投资者, I want 查看股票的实时报价和涨跌幅, so that 我可以了解股票的当前价格和今日表现。

#### Acceptance Criteria

1. WHEN 用户访问个股详情页 THEN Stock_Detail_Page SHALL 显示当前股价、涨跌金额、涨跌幅百分比
2. WHEN 股价上涨 THEN Stock_Detail_Page SHALL 以绿色显示涨跌信息
3. WHEN 股价下跌 THEN Stock_Detail_Page SHALL 以红色显示涨跌信息
4. WHEN 收到实时价格更新 THEN Stock_Detail_Page SHALL 实时更新显示的价格和涨跌幅
5. WHEN 用户访问个股详情页 THEN Stock_Detail_Page SHALL 显示今日开盘价、最高价、最低价、昨收价
6. WHEN 用户访问个股详情页 THEN Stock_Detail_Page SHALL 显示成交量和平均成交量

### Requirement 5: 个股详情页 - 技术指标

**User Story:** As a 技术分析投资者, I want 查看股票的技术指标, so that 我可以进行技术分析辅助投资决策。

#### Acceptance Criteria

1. WHEN 用户访问个股详情页 THEN Technical_Indicators SHALL 显示移动平均线（MA5、MA10、MA20、MA50、MA200）
2. WHEN 用户访问个股详情页 THEN Technical_Indicators SHALL 显示 MACD 指标（MACD线、信号线、柱状图）
3. WHEN 用户访问个股详情页 THEN Technical_Indicators SHALL 显示 RSI 指标值和超买/超卖状态
4. WHEN 用户访问个股详情页 THEN Technical_Indicators SHALL 显示布林带指标（上轨、中轨、下轨）
5. WHEN 用户切换K线图时间周期 THEN Technical_Indicators SHALL 同步更新技术指标数据
6. WHERE 用户启用技术指标叠加 THEN K_Line_Chart SHALL 在K线图上叠加显示所选技术指标

### Requirement 6: 个股详情页 - 财务数据摘要

**User Story:** As a 基本面分析投资者, I want 查看公司的关键财务数据, so that 我可以评估公司的财务健康状况和估值水平。

#### Acceptance Criteria

1. WHEN 用户访问个股详情页 THEN Financial_Summary SHALL 显示市盈率（PE）、市净率（PB）、市销率（PS）
2. WHEN 用户访问个股详情页 THEN Financial_Summary SHALL 显示每股收益（EPS）和收益增长率
3. WHEN 用户访问个股详情页 THEN Financial_Summary SHALL 显示营收和营收增长率
4. WHEN 用户访问个股详情页 THEN Financial_Summary SHALL 显示毛利率、营业利润率、净利率
5. WHEN 用户访问个股详情页 THEN Financial_Summary SHALL 显示 ROE、ROA、负债权益比
6. IF 财务数据不可用 THEN Financial_Summary SHALL 显示"暂无数据"并说明原因

### Requirement 7: 个股详情页 - 分析师评级

**User Story:** As a 投资者, I want 查看华尔街分析师对该股票的评级, so that 我可以参考专业分析师的观点。

#### Acceptance Criteria

1. WHEN 用户访问个股详情页 THEN Analyst_Rating SHALL 显示分析师评级汇总（强烈买入/买入/持有/卖出/强烈卖出的数量分布）
2. WHEN 用户访问个股详情页 THEN Analyst_Rating SHALL 显示平均目标价和当前价格的差距百分比
3. WHEN 用户访问个股详情页 THEN Analyst_Rating SHALL 显示最近的分析师评级变动列表
4. WHEN 显示评级变动 THEN Analyst_Rating SHALL 显示分析师姓名、所属机构、评级、目标价、评级日期
5. IF 无分析师评级数据 THEN Analyst_Rating SHALL 显示"暂无分析师评级"

### Requirement 8: 个股详情页 - 内部交易记录

**User Story:** As a 投资者, I want 查看公司内部人员的交易记录, so that 我可以了解内部人员对公司前景的看法。

#### Acceptance Criteria

1. WHEN 用户访问个股详情页 THEN Insider_Trading SHALL 显示最近的内部交易记录列表
2. WHEN 显示内部交易 THEN Insider_Trading SHALL 显示交易人姓名、职位、交易类型（买入/卖出）、股数、价格、交易日期
3. WHEN 用户访问个股详情页 THEN Insider_Trading SHALL 显示近期内部交易的买入/卖出汇总统计
4. WHEN 内部人员买入 THEN Insider_Trading SHALL 以绿色标识交易类型
5. WHEN 内部人员卖出 THEN Insider_Trading SHALL 以红色标识交易类型
6. IF 无内部交易记录 THEN Insider_Trading SHALL 显示"暂无内部交易记录"

### Requirement 9: 个股详情页 - 添加到自选股

**User Story:** As a 投资者, I want 将感兴趣的股票添加到自选股, so that 我可以方便地跟踪和管理关注的股票。

#### Acceptance Criteria

1. WHEN 用户访问个股详情页 THEN Stock_Detail_Page SHALL 显示"添加自选"按钮
2. WHEN 股票已在自选股中 THEN Stock_Detail_Page SHALL 显示"已添加"状态和"移除自选"按钮
3. WHEN 用户点击"添加自选"按钮 THEN Watchlist_Manager SHALL 将该股票添加到用户的自选股列表
4. WHEN 用户点击"移除自选"按钮 THEN Watchlist_Manager SHALL 将该股票从用户的自选股列表移除
5. WHEN 添加/移除操作完成 THEN Stock_Detail_Page SHALL 显示操作成功的提示信息
6. IF 用户未登录 THEN Stock_Detail_Page SHALL 提示用户登录后才能添加自选股

### Requirement 10: 市场热力图 - 放大/缩小功能

**User Story:** As a 投资者, I want 放大或缩小热力图, so that 我可以更清晰地查看特定区域或获得整体概览。

#### Acceptance Criteria

1. WHEN 用户访问热力图页面 THEN Market_Heatmap SHALL 显示放大和缩小控制按钮
2. WHEN 用户点击放大按钮 THEN Zoom_Controller SHALL 放大热力图显示比例
3. WHEN 用户点击缩小按钮 THEN Zoom_Controller SHALL 缩小热力图显示比例
4. WHEN 用户使用鼠标滚轮 THEN Zoom_Controller SHALL 支持滚轮缩放热力图
5. WHEN 热力图处于放大状态 THEN Market_Heatmap SHALL 支持拖拽平移查看不同区域
6. WHEN 用户双击热力图 THEN Zoom_Controller SHALL 重置为默认缩放比例

### Requirement 11: 市场热力图 - 修复导航按钮问题

**User Story:** As a 用户, I want 导航按钮点击后保持展开状态, so that 我可以方便地进行多次操作。

#### Acceptance Criteria

1. WHEN 用户点击热力图导航按钮 THEN Market_Heatmap SHALL 保持导航菜单展开状态
2. WHEN 用户点击导航菜单外部区域 THEN Market_Heatmap SHALL 收起导航菜单
3. WHEN 用户选择导航选项 THEN Market_Heatmap SHALL 执行对应操作但保持菜单展开
4. WHEN 用户按 ESC 键 THEN Market_Heatmap SHALL 收起导航菜单

### Requirement 12: 市场热力图 - 补充完整数据

**User Story:** As a 投资者, I want 查看完整的市场热力图数据, so that 我可以全面了解市场各板块的表现。

#### Acceptance Criteria

1. WHEN 用户访问热力图页面 THEN Market_Heatmap SHALL 显示所有主要板块的股票数据
2. WHEN 显示热力图 THEN Market_Heatmap SHALL 确保每个板块至少显示前50只市值最大的股票
3. WHEN 数据加载完成 THEN Market_Heatmap SHALL 显示总股票数量和最后更新时间
4. WHEN 部分数据缺失 THEN Market_Heatmap SHALL 在对应位置显示"数据加载中"或"暂无数据"
5. IF 数据获取失败 THEN Market_Heatmap SHALL 显示错误信息并提供重试按钮

### Requirement 13: 市场热力图 - 改进交互体验

**User Story:** As a 用户, I want 更流畅的热力图交互体验, so that 我可以高效地浏览和分析市场数据。

#### Acceptance Criteria

1. WHEN 用户悬停在股票方块上 THEN Market_Heatmap SHALL 显示详细的股票信息提示框
2. WHEN 显示提示框 THEN Market_Heatmap SHALL 包含股票代码、名称、价格、涨跌幅、市值、板块
3. WHEN 用户点击股票方块 THEN Market_Heatmap SHALL 导航到该股票的详情页
4. WHEN 热力图数据更新 THEN Market_Heatmap SHALL 平滑过渡动画更新颜色和大小
5. WHEN 用户调整窗口大小 THEN Market_Heatmap SHALL 自适应调整布局保持可读性

### Requirement 14: 市场热力图 - 按板块/行业筛选

**User Story:** As a 投资者, I want 按板块或行业筛选热力图, so that 我可以专注于感兴趣的特定领域。

#### Acceptance Criteria

1. WHEN 用户访问热力图页面 THEN Sector_Filter SHALL 显示板块/行业筛选下拉菜单
2. WHEN 用户选择特定板块 THEN Market_Heatmap SHALL 仅显示该板块的股票
3. WHEN 用户选择特定行业 THEN Market_Heatmap SHALL 仅显示该行业的股票
4. WHEN 用户选择"全部" THEN Market_Heatmap SHALL 显示所有板块的股票
5. WHEN 筛选条件改变 THEN Market_Heatmap SHALL 平滑过渡更新显示内容
6. WHEN 用户访问热力图页面 THEN Sector_Filter SHALL 支持多选板块进行组合筛选
