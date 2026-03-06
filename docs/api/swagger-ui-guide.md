# Swagger UI 使用指南

## 概述

Swagger UI 提供了一个交互式的 API 文档浏览界面，允许开发者直接在浏览器中测试 API 端点。

## 访问 Swagger UI

启动后端服务器后，可以通过以下 URL 访问 Swagger UI：

```
http://localhost:3000/api-docs
```

## 功能特性

### 1. 浏览 API 端点

Swagger UI 会显示所有可用的 API 端点，按照标签（tags）进行分组。每个端点都包含：

- HTTP 方法（GET、POST、PUT、DELETE 等）
- 端点路径
- 简要描述
- 参数说明
- 请求体格式
- 响应格式和状态码

### 2. 测试 API 端点

点击任意端点可以展开详细信息。点击 "Try it out" 按钮可以：

1. 填写请求参数
2. 编辑请求体（对于 POST/PUT 请求）
3. 点击 "Execute" 执行请求
4. 查看实际的响应数据和状态码

### 3. 认证

对于需要认证的 API 端点：

1. 点击页面右上角的 "Authorize" 按钮
2. 在弹出的对话框中输入 JWT token（格式：`Bearer <your-token>`）
3. 点击 "Authorize" 确认
4. 之后的所有请求都会自动包含认证信息

Swagger UI 会保持认证状态，即使刷新页面也不会丢失（使用 `persistAuthorization` 选项）。

### 4. 过滤端点

使用页面顶部的搜索框可以快速过滤和查找特定的 API 端点。

### 5. 查看请求示例

每个端点都提供了请求和响应的示例，帮助理解 API 的使用方式。

## OpenAPI 规范文件

Swagger UI 使用的 OpenAPI 规范文件位于：

```
docs/api/openapi.json
docs/api/openapi.yaml
```

这些文件是自动生成的，包含了所有 API 端点的完整定义。

## 配置选项

Swagger UI 的配置在 `backend/src/config/swagger.ts` 文件中，包括：

- `explorer`: 启用 API 浏览器
- `persistAuthorization`: 保持认证状态
- `displayRequestDuration`: 显示请求持续时间
- `filter`: 启用过滤功能
- `tryItOutEnabled`: 默认启用 "Try it out" 功能

## 故障排查

### Swagger UI 无法访问

如果无法访问 `/api-docs`，请检查：

1. 后端服务器是否正常启动
2. OpenAPI 规范文件是否存在于 `docs/api/openapi.json`
3. 查看服务器日志中是否有 Swagger UI 配置错误

### API 测试失败

如果在 Swagger UI 中测试 API 失败：

1. 检查是否需要认证，如果需要请先点击 "Authorize" 按钮
2. 确认请求参数格式是否正确
3. 查看响应中的错误消息
4. 检查服务器日志以获取更多详细信息

## 相关文档

- [REST API 文档](./rest-api.md)
- [认证和授权](./authentication.md)
- [OpenAPI 规范](./openapi.yaml)

---

**最后更新**: 2024-01-05  
**版本**: 1.0.0
