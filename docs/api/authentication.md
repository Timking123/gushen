# API 认证和授权

**最后更新**: 2024-01-20  
**版本**: 1.0.0

## 概述

Stock Analysis Platform API 使用 JWT (JSON Web Token) Bearer 认证机制来保护需要用户身份验证的端点。本文档说明如何进行身份验证以及如何在 API 请求中使用认证令牌。

## 认证流程

### 1. 用户注册

首先，用户需要创建一个账户。

**端点**: `POST /api/auth/register`

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**密码要求**:
- 至少 8 个字符
- 至少包含一个大写字母
- 至少包含一个小写字母
- 至少包含一个数字

**成功响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "注册成功"
}
```

**错误响应** (400 Bad Request):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "输入验证失败",
    "details": {
      "email": ["请输入有效的邮箱地址"],
      "password": ["密码必须包含大写字母、小写字母和数字"]
    }
  }
}
```

### 2. 用户登录

已注册用户可以使用邮箱和密码登录以获取访问令牌。

**端点**: `POST /api/auth/login`

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**成功响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "登录成功"
}
```

**错误响应** (401 Unauthorized):
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "邮箱或密码错误"
  }
}
```

## 使用认证令牌

### 在请求中包含令牌

获取令牌后，需要在所有需要认证的 API 请求的 `Authorization` 头中包含该令牌：

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 示例请求

**使用 cURL**:
```bash
curl -X GET https://api.example.com/api/watchlist \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**使用 JavaScript (fetch)**:
```javascript
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

fetch('https://api.example.com/api/watchlist', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => console.log(data));
```

**使用 Python (requests)**:
```python
import requests

token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

response = requests.get('https://api.example.com/api/watchlist', headers=headers)
data = response.json()
```

## 需要认证的端点

以下端点需要有效的 JWT 令牌：

### 自选股管理 (Watchlist)
- `GET /api/watchlist` - 获取用户自选股列表
- `POST /api/watchlist` - 添加股票到自选股
- `DELETE /api/watchlist/:symbol` - 从自选股移除股票
- `PUT /api/watchlist/reorder` - 重新排序自选股
- `PATCH /api/watchlist/:symbol/notes` - 更新股票备注
- `GET /api/watchlist/:symbol/check` - 检查股票是否在自选股中

### 用户设置 (User Settings)
- `GET /api/user/settings` - 获取用户设置
- `PUT /api/user/settings` - 更新用户设置

### 板块订阅 (Sector Subscriptions)
- `GET /api/sectors/subscriptions` - 获取用户订阅的板块
- `POST /api/sectors/:sectorId/subscribe` - 订阅板块
- `DELETE /api/sectors/:sectorId/subscribe` - 取消订阅板块

### 筛选器模板 (Screener Templates)
- `POST /api/screener/templates` - 保存筛选模板
- `GET /api/screener/templates` - 获取用户的筛选模板
- `GET /api/screener/templates/:id` - 获取特定筛选模板
- `PUT /api/screener/templates/:id` - 更新筛选模板
- `DELETE /api/screener/templates/:id` - 删除筛选模板

### SEC 文件管理 (SEC Filings - 管理员)
- `POST /api/sec-filings` - 创建 SEC 文件记录（管理员）
- `POST /api/sec-filings/:filingId/ai-summary` - 生成 AI 摘要
- `PATCH /api/sec-filings/:filingId/summary` - 更新文件摘要

## 可选认证的端点

以下端点支持可选认证，即可以在有令牌或无令牌的情况下访问，但行为可能不同：

### 板块信息
- `GET /api/sectors` - 获取所有板块（认证用户可看到订阅状态）
- `GET /api/sectors/:sectorId` - 获取板块详情（认证用户可看到订阅状态）

## 令牌管理

### 令牌有效期

JWT 令牌具有有限的有效期。令牌过期后，需要重新登录以获取新令牌。

**令牌有效期**: 默认 7 天

### 令牌刷新

当前实现不支持令牌刷新。令牌过期后，用户需要重新登录。

### 令牌撤销

当前实现不支持令牌撤销。如果需要立即使令牌失效，请联系系统管理员。

## 错误处理

### 认证错误响应

**401 Unauthorized - 未提供令牌**:
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "未提供认证令牌"
  }
}
```

**401 Unauthorized - 令牌格式错误**:
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "无效的认证格式"
  }
}
```

**401 Unauthorized - 令牌无效或过期**:
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "认证令牌无效或已过期"
  }
}
```

### 授权错误响应

**403 Forbidden - 权限不足**:
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "您没有权限执行此操作"
  }
}
```

## 安全最佳实践

### 客户端存储

1. **使用安全存储**: 在客户端安全地存储令牌
   - Web 应用: 使用 `httpOnly` cookies 或安全的 localStorage
   - 移动应用: 使用平台提供的安全存储（如 iOS Keychain、Android Keystore）

2. **避免在 URL 中传递令牌**: 永远不要在 URL 查询参数中包含令牌

3. **使用 HTTPS**: 始终通过 HTTPS 传输令牌，防止中间人攻击

### 令牌保护

1. **不要共享令牌**: 令牌是个人凭证，不应与他人共享

2. **定期更新**: 定期重新登录以获取新令牌

3. **退出登录**: 退出时从客户端删除令牌

### 密码安全

1. **使用强密码**: 遵循密码复杂度要求

2. **不要重复使用密码**: 为不同服务使用不同的密码

3. **定期更改密码**: 建议定期更改密码

## OpenAPI 规范中的安全定义

在 OpenAPI 3.0 规范中，认证方案定义如下：

```yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT Bearer 认证。在 Authorization 头中使用格式：Bearer <token>
```

需要认证的端点在其操作定义中包含以下安全要求：

```yaml
paths:
  /api/watchlist:
    get:
      summary: 获取用户自选股列表
      security:
        - bearerAuth: []
      responses:
        '200':
          description: 成功返回自选股列表
        '401':
          description: 未授权 - 令牌缺失或无效
```

## 常见问题

### Q: 令牌在哪里获取？
A: 通过 `/api/auth/register` 注册或 `/api/auth/login` 登录后，响应中会包含令牌。

### Q: 令牌有效期是多久？
A: 默认有效期为 7 天。过期后需要重新登录。

### Q: 如何知道令牌是否过期？
A: 当令牌过期时，API 会返回 401 Unauthorized 错误。此时需要重新登录。

### Q: 可以同时使用多个令牌吗？
A: 可以。每次登录都会生成新令牌，旧令牌在过期前仍然有效。

### Q: 如何撤销令牌？
A: 当前版本不支持令牌撤销。如有安全顾虑，请更改密码，这将使所有现有令牌失效。

### Q: 忘记密码怎么办？
A: 当前版本不支持密码重置功能。请联系系统管理员。

## 相关文档

- [REST API 概览](./rest-api.md)
- [WebSocket 协议](./websocket.md)
- [错误处理](../troubleshooting/api.md)

## 支持

如有问题或需要帮助，请联系：
- 邮箱: support@example.com
- 文档: https://docs.example.com
