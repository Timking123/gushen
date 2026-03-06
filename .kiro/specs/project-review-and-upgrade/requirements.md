# 需求文档

## 简介

本文档定义了智能股票分析网站项目的审查与升级需求。项目采用 React 19 + TypeScript + Express 5 + Prisma + PostgreSQL 技术栈，已完成大部分核心功能。本次升级旨在修复已识别的问题、提升系统安全性、优化性能，并增强用户体验。

## 术语表

- **Rate_Limiter**: 速率限制器，用于控制API请求频率，防止滥用和DDoS攻击
- **RBAC_System**: 基于角色的访问控制系统，管理用户权限和资源访问
- **Cache_Manager**: 缓存管理器，负责缓存键生成、数据存储和失效策略
- **WebSocket_Manager**: WebSocket连接管理器，处理实时通信、心跳检测和重连机制
- **Heatmap_Service**: 热力图服务，处理股票数据聚合和可视化
- **API_Gateway**: API网关，统一处理请求验证、响应格式化和错误处理
- **Performance_Optimizer**: 性能优化器，负责数据库查询优化、前端性能提升

## 需求

### 需求 1：API速率限制

**用户故事：** 作为系统管理员，我希望所有API端点都有速率限制保护，以防止API滥用和DDoS攻击。

#### 验收标准

1. THE Rate_Limiter SHALL 为所有公开API端点实现速率限制中间件
2. WHEN 单个IP在1分钟内发送超过100次请求 THEN Rate_Limiter SHALL 返回429状态码和重试时间
3. WHEN 认证用户在1分钟内发送超过200次请求 THEN Rate_Limiter SHALL 返回429状态码
4. THE Rate_Limiter SHALL 支持基于端点的差异化限制配置
5. WHEN 速率限制被触发 THEN Rate_Limiter SHALL 在响应头中包含 X-RateLimit-Limit、X-RateLimit-Remaining 和 X-RateLimit-Reset
6. THE Rate_Limiter SHALL 使用Redis存储速率限制计数器以支持分布式部署

### 需求 2：角色基础访问控制（RBAC）

**用户故事：** 作为系统管理员，我希望实现完整的角色权限系统，以便精细控制用户对不同功能的访问权限。

#### 验收标准

1. THE RBAC_System SHALL 定义至少三种用户角色：普通用户、高级用户、管理员
2. WHEN 用户尝试访问受保护资源 THEN RBAC_System SHALL 验证用户是否具有相应权限
3. THE RBAC_System SHALL 为每个API端点定义所需的最低权限级别
4. WHEN 用户权限不足 THEN RBAC_System SHALL 返回403状态码和明确的错误信息
5. THE RBAC_System SHALL 支持权限的动态配置和更新
6. WHEN 管理员修改用户角色 THEN RBAC_System SHALL 立即生效并记录审计日志

### 需求 3：零价股票数据处理

**用户故事：** 作为用户，我希望热力图能够一致且正确地处理零价股票数据，以避免显示错误或数据不一致。

#### 验收标准

1. THE Heatmap_Service SHALL 定义统一的零价股票处理规则
2. WHEN 股票价格为零或null THEN Heatmap_Service SHALL 根据配置决定是否显示该股票
3. THE Heatmap_Service SHALL 提供hideZeroPrice参数允许用户控制零价股票的显示
4. WHEN hideZeroPrice为true THEN Heatmap_Service SHALL 从结果中排除所有零价股票
5. THE Heatmap_Service SHALL 在数据完整性报告中标注被排除的零价股票数量

### 需求 4：缓存键安全性

**用户故事：** 作为开发者，我希望缓存系统使用安全且唯一的缓存键，以防止缓存键冲突和数据污染。

#### 验收标准

1. THE Cache_Manager SHALL 使用确定性的缓存键生成算法
2. WHEN 生成包含过滤器对象的缓存键 THEN Cache_Manager SHALL 对过滤器进行规范化排序后再序列化
3. THE Cache_Manager SHALL 对缓存键进行哈希处理以限制键长度
4. WHEN 缓存键生成 THEN Cache_Manager SHALL 确保相同参数始终生成相同的键
5. THE Cache_Manager SHALL 为不同类型的数据使用不同的键前缀以避免冲突

### 需求 5：WebSocket连接稳定性

**用户故事：** 作为用户，我希望实时数据推送连接稳定可靠，即使网络波动也能自动恢复。

#### 验收标准

1. THE WebSocket_Manager SHALL 实现心跳检测机制，每25秒发送一次ping
2. WHEN 60秒内未收到客户端响应 THEN WebSocket_Manager SHALL 关闭该连接
3. WHEN 连接断开 THEN WebSocket_Manager SHALL 在客户端实现指数退避重连策略
4. THE WebSocket_Manager SHALL 支持消息队列持久化，确保离线消息不丢失
5. WHEN 用户重新连接 THEN WebSocket_Manager SHALL 自动投递离线期间的缓存消息
6. THE WebSocket_Manager SHALL 在连接状态变化时通知客户端

### 需求 6：统一错误处理

**用户故事：** 作为开发者，我希望所有API都有一致的错误处理和响应格式，以便前端能够统一处理错误情况。

#### 验收标准

1. THE API_Gateway SHALL 定义统一的错误响应格式，包含code、message和details字段
2. WHEN API调用失败 THEN API_Gateway SHALL 返回适当的HTTP状态码和错误详情
3. THE API_Gateway SHALL 记录所有错误到日志系统，包含请求上下文
4. WHEN 缓存读写失败 THEN API_Gateway SHALL 记录警告但继续处理请求
5. THE API_Gateway SHALL 区分客户端错误（4xx）和服务器错误（5xx）
6. WHEN 发生未预期错误 THEN API_Gateway SHALL 返回500状态码但不暴露内部错误详情

### 需求 7：数据库查询优化

**用户故事：** 作为用户，我希望热力图和其他数据密集型功能能够快速响应，即使数据量很大。

#### 验收标准

1. THE Performance_Optimizer SHALL 将热力图服务的两次数据库查询合并为单次查询
2. THE Performance_Optimizer SHALL 为常用查询字段添加数据库索引
3. WHEN 查询结果集过大 THEN Performance_Optimizer SHALL 实现分页机制
4. THE Performance_Optimizer SHALL 使用数据库连接池优化连接管理
5. WHEN 执行复杂查询 THEN Performance_Optimizer SHALL 记录查询执行时间用于性能监控

### 需求 8：前端API超时控制

**用户故事：** 作为用户，我希望在网络缓慢时能够得到及时反馈，而不是无限等待。

#### 验收标准

1. THE API_Gateway SHALL 为所有前端API调用设置默认超时时间（30秒）
2. WHEN API调用超时 THEN API_Gateway SHALL 显示友好的超时提示信息
3. THE API_Gateway SHALL 支持为不同类型的请求配置不同的超时时间
4. WHEN 请求超时 THEN API_Gateway SHALL 自动取消pending的请求
5. THE API_Gateway SHALL 提供重试机制，允许用户手动重试失败的请求

### 需求 9：配置外部化

**用户故事：** 作为开发者，我希望所有硬编码的配置都能够外部化，以便在不修改代码的情况下调整系统行为。

#### 验收标准

1. THE API_Gateway SHALL 将ETF代理映射配置移至外部配置文件
2. THE API_Gateway SHALL 将市值分级阈值配置移至外部配置文件
3. THE API_Gateway SHALL 支持通过环境变量覆盖配置文件中的值
4. WHEN 配置文件缺失 THEN API_Gateway SHALL 使用合理的默认值
5. THE API_Gateway SHALL 在启动时验证配置的完整性和有效性

### 需求 10：代码重复消除

**用户故事：** 作为开发者，我希望消除代码重复，以提高代码可维护性和一致性。

#### 验收标准

1. THE API_Gateway SHALL 提取缓存读写逻辑为可复用的工具函数
2. THE API_Gateway SHALL 提取API响应格式化逻辑为统一的响应构建器
3. THE API_Gateway SHALL 提取数据验证逻辑为可复用的验证器
4. WHEN 添加新功能 THEN API_Gateway SHALL 优先使用已有的工具函数
5. THE API_Gateway SHALL 通过代码审查确保不引入新的重复代码

### 需求 11：测试覆盖增强

**用户故事：** 作为开发者，我希望项目有全面的测试覆盖，以确保代码质量和系统稳定性。

#### 验收标准

1. THE API_Gateway SHALL 为所有API端点编写集成测试
2. THE API_Gateway SHALL 为关键业务逻辑编写性能测试
3. THE API_Gateway SHALL 为认证和授权功能编写安全性测试
4. THE WebSocket_Manager SHALL 编写WebSocket连接和消息传递测试
5. WHEN 代码覆盖率低于80% THEN API_Gateway SHALL 在CI中发出警告
6. THE API_Gateway SHALL 使用属性测试验证数据处理的正确性

### 需求 12：缓存策略优化

**用户故事：** 作为用户，我希望系统能够智能地管理缓存，以提供更快的响应速度和更好的数据一致性。

#### 验收标准

1. THE Cache_Manager SHALL 实现缓存预热机制，在系统启动时加载热点数据
2. THE Cache_Manager SHALL 实现基于时间和事件的缓存失效策略
3. WHEN 数据更新 THEN Cache_Manager SHALL 主动失效相关缓存
4. THE Cache_Manager SHALL 支持缓存分层（本地缓存 + Redis缓存）
5. THE Cache_Manager SHALL 提供缓存命中率监控指标

### 需求 13：前端性能优化

**用户故事：** 作为用户，我希望前端应用加载快速、交互流畅，即使在低端设备上也能有良好体验。

#### 验收标准

1. THE Performance_Optimizer SHALL 实现路由级别的代码分割
2. THE Performance_Optimizer SHALL 为长列表实现虚拟滚动
3. THE Performance_Optimizer SHALL 为图片资源实现懒加载
4. WHEN 首次加载 THEN Performance_Optimizer SHALL 确保首屏渲染时间小于3秒
5. THE Performance_Optimizer SHALL 使用Web Workers处理复杂计算以避免阻塞主线程

### 需求 14：API响应优化

**用户故事：** 作为用户，我希望API响应快速且数据传输高效，以减少等待时间和流量消耗。

#### 验收标准

1. THE API_Gateway SHALL 实现gzip/brotli响应压缩
2. THE API_Gateway SHALL 设置适当的CDN缓存头
3. THE API_Gateway SHALL 支持条件请求（ETag/Last-Modified）
4. WHEN 响应数据未变化 THEN API_Gateway SHALL 返回304状态码
5. THE API_Gateway SHALL 支持字段选择，允许客户端只请求需要的字段

