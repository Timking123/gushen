# 智能股票分析网站

一个功能完整的股票分析平台，提供实时行情、技术分析、AI 智能助手等功能。

## 技术栈

### 后端
- Node.js + Express 5
- TypeScript
- Prisma ORM + PostgreSQL
- Redis 缓存
- Socket.IO 实时通信
- JWT 认证

### 前端
- React 19 + TypeScript
- Vite 构建工具
- Zustand 状态管理
- ECharts 图表库
- Socket.IO 客户端

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- Docker (推荐) 或 PostgreSQL + Redis

### 方式一：使用 Docker（推荐）

1. 启动数据库服务：
```bash
docker-compose up -d
```

2. 安装依赖并初始化数据库：
```bash
npm run install:all
npm run db:generate
npm run db:migrate
```

3. 启动开发服务器：
```bash
npm run dev
```

### 方式二：一键启动（需要先启动 Docker）

**Windows:**
```bash
# 双击运行或在命令行执行
start.bat
```

**Linux/macOS:**
```bash
chmod +x start.sh
./start.sh
```

### 手动安装

```bash
# 安装所有依赖
npm run install:all

# 或分别安装
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 环境配置

1. 复制后端环境配置文件：
```bash
cp backend/.env.example backend/.env
```

2. 修改 `backend/.env` 中的配置：
```env
DATABASE_URL="postgresql://用户名:密码@localhost:5432/数据库名"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="你的JWT密钥"
```

3. 初始化数据库：
```bash
npm run db:generate
npm run db:migrate
```

### 启动开发服务器

```bash
# 同时启动前后端
npm run dev

# 或分别启动
npm run dev:backend   # 后端: http://localhost:3001
npm run dev:frontend  # 前端: http://localhost:5173
```

## 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 同时启动前后端开发服务器 |
| `npm run build` | 构建前后端生产版本 |
| `npm run start` | 启动生产服务器 |
| `npm run test` | 运行后端测试 |
| `npm run lint` | 代码检查 |
| `npm run db:migrate` | 数据库迁移 |
| `npm run db:studio` | 打开 Prisma Studio |
| `npm run clean` | 清理所有构建文件和依赖 |

## 项目结构

```
smart-stock-analyzer/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── routes/         # API 路由
│   │   ├── services/       # 业务逻辑
│   │   ├── middleware/     # 中间件
│   │   ├── lib/            # 工具库
│   │   └── types/          # 类型定义
│   └── prisma/             # 数据库模型
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── components/     # React 组件
│   │   ├── pages/          # 页面组件
│   │   ├── services/       # API 服务
│   │   ├── stores/         # 状态管理
│   │   └── types/          # 类型定义
│   └── public/             # 静态资源
├── start.bat               # Windows 一键启动
├── start.sh                # Unix 一键启动
└── package.json            # 根项目配置
```

## 主要功能

- 📈 实时股票行情与图表
- 🔍 智能股票筛选器
- 📊 技术指标分析
- 🤖 AI 智能助手
- 📰 财经新闻聚合
- 📅 财报日历与提醒
- 💰 股息追踪
- 👥 内部交易监控
- 🏆 量化评级系统
- 📋 投资组合管理
- 🔔 价格预警推送

## 新增功能与优化（v1.1）

### 安全性增强
- ✅ **API速率限制**：基于 Redis 的分布式速率限制，防止 API 滥用
- ✅ **RBAC权限系统**：完整的角色权限管理，支持用户、高级用户、管理员三种角色
- ✅ **审计日志**：记录所有权限变更和敏感操作

### 性能优化
- ✅ **数据库查询优化**：合并多次查询为单次，添加索引，提升查询速度
- ✅ **响应压缩**：支持 gzip/brotli 压缩，减少传输数据量
- ✅ **条件请求**：支持 ETag 和 Last-Modified，减少不必要的数据传输
- ✅ **字段选择**：允许客户端只请求需要的字段，减少响应体积
- ✅ **分页支持**：大结果集自动分页，提升响应速度

### 稳定性提升
- ✅ **统一错误处理**：标准化错误响应格式，隐藏敏感信息
- ✅ **WebSocket 重连**：指数退避重连策略，离线消息持久化
- ✅ **请求超时控制**：前端 API 自动超时和重试机制
- ✅ **缓存容错**：缓存失败不影响业务逻辑

### 可维护性改进
- ✅ **配置外部化**：支持配置文件和环境变量，无需修改代码
- ✅ **代码重复消除**：提取通用工具函数，提高代码复用性
- ✅ **属性测试**：使用 fast-check 进行属性测试，确保代码正确性

## 配置说明

### 应用配置

应用配置文件位于 `backend/config/app.config.json`，支持以下配置：

```json
{
  "marketCap": {
    "tiers": {
      "mega": { "threshold": 200000000000, "label": "超大盘 (>$200B)" },
      "large": { "threshold": 10000000000, "label": "大盘 ($10B-$200B)" },
      "mid": { "threshold": 2000000000, "label": "中盘 ($2B-$10B)" },
      "small": { "threshold": 300000000, "label": "小盘 ($300M-$2B)" },
      "micro": { "threshold": 0, "label": "微盘 (<$300M)" }
    }
  },
  "userSettings": {
    "priceAlertThreshold": {
      "min": 0.1,
      "max": 50,
      "default": 5.0
    }
  },
  "cache": {
    "ttl": {
      "quote": 60,
      "sectorList": 3600,
      "heatmap": 300
    }
  }
}
```

### 环境变量覆盖

可以通过环境变量覆盖配置文件中的值：

```bash
# 市值分级阈值
MARKET_CAP_MEGA_THRESHOLD=200000000000

# 缓存 TTL
CACHE_TTL_QUOTE=60
```

## API 使用说明

### 字段选择

客户端可以通过 `fields` 查询参数只请求需要的字段：

```bash
# 只获取 symbol 和 price 字段
GET /api/stocks?fields=symbol,price
```

### 条件请求

支持 ETag 和 If-None-Match 头，减少不必要的数据传输：

```bash
# 首次请求
GET /api/stocks/AAPL
# 响应头: ETag: "abc123"

# 后续请求
GET /api/stocks/AAPL
If-None-Match: "abc123"
# 如果数据未变化，返回 304 Not Modified
```

### 分页

大结果集自动支持分页：

```bash
GET /api/heatmap?page=1&pageSize=20
```

响应格式：

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## 许可证

MIT
