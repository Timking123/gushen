# 配置说明文档

## 概述

本项目支持灵活的配置管理，允许通过配置文件和环境变量来调整系统行为，无需修改代码。

## 配置文件

### 应用配置 (backend/config/app.config.json)

应用配置文件包含以下配置项：

#### 1. 市值分级配置

定义股票市值分级的阈值和标签：

```json
{
  "marketCap": {
    "tiers": {
      "mega": {
        "threshold": 200000000000,
        "label": "超大盘 (>$200B)"
      },
      "large": {
        "threshold": 10000000000,
        "label": "大盘 ($10B-$200B)"
      },
      "mid": {
        "threshold": 2000000000,
        "label": "中盘 ($2B-$10B)"
      },
      "small": {
        "threshold": 300000000,
        "label": "小盘 ($300M-$2B)"
      },
      "micro": {
        "threshold": 0,
        "label": "微盘 (<$300M)"
      }
    }
  }
}
```

#### 2. 用户设置配置

定义用户设置的默认值和限制：

```json
{
  "userSettings": {
    "priceAlertThreshold": {
      "min": 0.1,
      "max": 50,
      "default": 5.0
    }
  }
}
```

#### 3. 缓存配置

定义各类数据的缓存过期时间（秒）：

```json
{
  "cache": {
    "ttl": {
      "quote": 60,
      "sectorList": 3600,
      "heatmap": 300
    }
  }
}
```

## 环境变量

### 数据库配置

```bash
DATABASE_URL="postgresql://用户名:密码@localhost:5432/数据库名"
```

### Redis 配置

```bash
REDIS_URL="redis://localhost:6379"
```

### JWT 配置

```bash
JWT_SECRET="你的JWT密钥"
JWT_EXPIRES_IN="7d"
```

### API 密钥

```bash
MARKET_DATA_API_KEY="你的市场数据API密钥"
NEWS_API_KEY="你的新闻API密钥"
OPENAI_API_KEY="你的OpenAI API密钥"
FINNHUB_API_KEY="你的Finnhub API密钥"
ALPHA_VANTAGE_API_KEY="你的Alpha Vantage API密钥"
TWELVE_DATA_API_KEY="你的Twelve Data API密钥"
```

### 配置覆盖

可以通过环境变量覆盖配置文件中的值：

```bash
# 市值分级阈值
MARKET_CAP_MEGA_THRESHOLD=200000000000

# 缓存 TTL
CACHE_TTL_QUOTE=60
```

## 配置加载顺序

1. 加载配置文件 `backend/config/app.config.json`
2. 应用环境变量覆盖
3. 验证配置完整性和有效性
4. 如果配置文件缺失，使用内置默认值

## 配置验证

系统启动时会自动验证配置的完整性和有效性：

- 检查必需的配置项是否存在
- 验证数值类型的配置是否在合理范围内
- 验证字符串格式是否正确

如果配置无效，系统会抛出错误并拒绝启动。

## 最佳实践

1. **不要在代码中硬编码配置**：所有可配置的值都应该放在配置文件或环境变量中
2. **使用环境变量存储敏感信息**：如 API 密钥、数据库密码等
3. **为不同环境使用不同的配置**：开发、测试、生产环境应该有各自的配置
4. **定期审查配置**：确保配置值符合当前业务需求
5. **文档化配置变更**：在修改配置时记录变更原因和影响

## 故障排查

### 配置文件未找到

如果配置文件缺失，系统会使用内置默认值并在日志中输出警告：

```
Config file not found, using defaults
```

### 配置验证失败

如果配置无效，系统会抛出错误：

```
Invalid config: marketCap.tiers is required
```

检查配置文件格式是否正确，确保所有必需字段都存在。

### 环境变量未生效

确保环境变量名称正确，并且在应用启动前已设置。可以在 `.env` 文件中设置环境变量：

```bash
# .env
MARKET_CAP_MEGA_THRESHOLD=200000000000
```

