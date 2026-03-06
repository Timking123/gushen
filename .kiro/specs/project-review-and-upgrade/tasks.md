# 实现计划：项目审查与升级

## 概述

本实现计划将项目升级工作分为四个阶段，按优先级顺序执行：P0（严重问题）、P1（中等问题）、P2（轻微问题）和P3（性能优化）。每个阶段包含具体的编码任务和测试任务。

## 任务列表

- [x] 1. P0阶段：严重问题修复
  - [x] 1.1 实现API速率限制中间件
    - 创建 `backend/src/middleware/rateLimit.ts`
    - 实现基于Redis的速率限制器
    - 支持IP和用户级别的限制
    - 添加响应头 X-RateLimit-Limit、X-RateLimit-Remaining、X-RateLimit-Reset
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  
  - [x] 1.2 编写速率限制属性测试
    - **Property 1: 速率限制正确性**
    - **Validates: Requirements 1.2, 1.3, 1.5**
  
  - [x] 1.3 实现RBAC权限系统
    - 创建 `backend/src/types/roles.ts` 定义角色和权限枚举
    - 创建 `backend/src/middleware/rbac.ts` 实现权限检查中间件
    - 扩展User模型添加role字段
    - 创建AuditLog模型记录权限变更
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [x] 1.4 编写RBAC权限属性测试
    - **Property 2: RBAC权限验证正确性**
    - **Property 3: 角色修改即时生效**
    - **Validates: Requirements 2.2, 2.4, 2.6**


  - [x] 1.5 修复零价股票数据处理
    - 更新 `backend/src/services/heatmapService.ts` 统一零价处理逻辑
    - 确保hideZeroPrice参数正确过滤零价股票
    - 在数据完整性报告中添加排除数量统计
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [x] 1.6 编写零价股票过滤属性测试
    - **Property 4: 零价股票过滤正确性**
    - **Validates: Requirements 3.2, 3.4**
  
  - [x] 1.7 修复缓存键冲突问题
    - 创建 `backend/src/lib/cache-manager.ts` 统一缓存管理
    - 实现确定性缓存键生成算法（规范化排序+哈希）
    - 为不同数据类型使用不同键前缀
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 1.8 编写缓存键确定性属性测试
    - **Property 5: 缓存键确定性**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 2. P0阶段检查点
  - 确保所有P0阶段测试通过，如有问题请询问用户

- [ ] 3. P1阶段：中等问题改进
  - [x] 3.1 增强WebSocket连接稳定性
    - 更新 `backend/src/lib/socket.ts` 添加心跳检测配置
    - 创建 `backend/src/lib/messageQueue.ts` 实现消息队列持久化
    - 创建 `frontend/src/lib/websocket.ts` 实现客户端重连逻辑
    - 实现指数退避重连策略
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [x] 3.2 编写WebSocket属性测试
    - **Property 6: WebSocket重连指数退避**
    - **Property 7: 离线消息持久化和投递**
    - **Validates: Requirements 5.3, 5.4, 5.5**


  - [x] 3.3 统一错误处理机制
    - 更新 `backend/src/middleware/errorHandler.ts` 统一错误响应格式
    - 添加请求ID和时间戳到错误响应
    - 实现缓存失败容错逻辑
    - 确保内部错误不暴露敏感信息
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 3.4 编写错误处理属性测试
    - **Property 8: 统一错误响应格式**
    - **Property 9: 缓存失败容错**
    - **Property 10: 内部错误信息隐藏**
    - **Validates: Requirements 6.1, 6.2, 6.4, 6.5, 6.6**
  
  - [x] 3.5 优化数据库查询性能
    - 更新 `backend/src/services/heatmapService.ts` 合并两次查询为单次
    - 创建数据库迁移添加必要索引
    - 实现分页机制
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 3.6 编写分页属性测试
    - **Property 11: 大结果集分页**
    - **Validates: Requirements 7.3**

  - [x] 3.7 实现前端API超时控制
    - 更新 `frontend/src/services/api.ts` 添加默认超时配置
    - 实现请求取消机制
    - 添加超时友好提示
    - 实现重试机制
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 3.8 编写超时处理属性测试
    - **Property 12: 请求超时处理**
    - **Validates: Requirements 8.2, 8.4**

- [x] 4. P1阶段检查点
  - 确保所有P1阶段测试通过，如有问题请询问用户

- [ ] 5. P2阶段：轻微问题优化
  - [x] 5.1 配置外部化
    - 创建 `backend/config/app.config.json` 配置文件
    - 创建 `backend/src/config/loader.ts` 配置加载器
    - 将ETF代理映射、市值分级等硬编码配置移至配置文件
    - 支持环境变量覆盖
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 5.2 消除代码重复
    - 创建 `backend/src/utils/cacheHelpers.ts` 提取缓存读写逻辑
    - 创建 `backend/src/utils/responseBuilder.ts` 提取响应格式化逻辑
    - 创建 `backend/src/utils/validators.ts` 提取通用验证逻辑
    - 重构现有代码使用新的工具函数
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 5.3 增强测试覆盖
    - 为所有API端点编写集成测试
    - 为WebSocket功能编写测试
    - 配置测试覆盖率检查（目标80%）
    - _Requirements: 11.1, 11.4, 11.5_

- [x] 6. P2阶段检查点
  - 确保所有P2阶段测试通过，如有问题请询问用户

- [ ] 7. P3阶段：性能优化
  - [x] 7.1 优化缓存策略
    - 实现缓存预热机制
    - 实现基于事件的缓存失效
    - 添加缓存命中率监控
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 7.2 编写缓存失效属性测试
    - **Property 13: 缓存失效正确性**
    - **Validates: Requirements 12.2, 12.3**

  - [x] 7.3 前端性能优化
    - 配置路由级别代码分割
    - 为长列表实现虚拟滚动
    - 实现图片懒加载
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 7.4 API响应优化
    - 配置gzip/brotli响应压缩
    - 设置CDN缓存头
    - 实现条件请求支持（ETag/Last-Modified）
    - 实现字段选择功能
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 7.5 编写API响应优化属性测试
    - **Property 14: 响应压缩**
    - **Property 15: 条件请求处理**
    - **Property 16: 字段选择**
    - **Validates: Requirements 14.1, 14.3, 14.4, 14.5**

- [x] 8. 最终检查点
  - 确保所有测试通过，如有问题请询问用户

- [ ] 9. 集成和验收
  - [x] 9.1 运行完整测试套件
    - 运行所有单元测试
    - 运行所有属性测试
    - 运行所有集成测试
    - 验证测试覆盖率达标

  - [x] 9.2 更新项目文档
    - 更新README.md添加新功能说明
    - 更新API文档
    - 添加配置说明文档

## 注意事项

- 所有任务都是必需的，包括测试任务
- 每个任务都引用了具体的需求以便追溯
- 检查点确保增量验证
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边界情况

