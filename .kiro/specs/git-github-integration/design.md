# 设计文档：Git 和 GitHub 集成

## Overview

本设计文档详细说明了如何为智能股票分析平台建立完整的 Git 版本控制体系，并与 GitHub 平台深度集成。该方案涵盖从本地 Git 仓库初始化、分支管理策略、提交规范自动化验证，到 GitHub 远程协作、分支保护、CI/CD 流水线的完整技术实现。

### 设计目标

1. **标准化版本控制**：建立统一的 Git 工作流程，确保团队协作规范
2. **自动化质量保障**：通过 Git Hooks 和 CI/CD 流水线自动验证代码质量
3. **安全性保护**：防止敏感信息泄露，保护重要分支不被误操作
4. **可追溯性**：通过规范的提交信息和版本标签，建立清晰的变更历史
5. **协作效率**：通过 GitHub 平台功能提升团队协作效率

### 技术栈

- **版本控制**：Git 2.x+
- **代码托管**：GitHub
- **Git Hooks 管理**：Husky 8.x
- **提交信息验证**：commitlint 17.x
- **代码格式化**：Prettier 3.x
- **代码检查**：ESLint 8.x
- **CI/CD**：GitHub Actions
- **包管理器**：npm/pnpm

## Architecture

### 系统架构概览

```mermaid
graph TB
    subgraph "本地开发环境"
        DEV[开发者工作区]
        STAGED[暂存区]
        LOCAL[本地仓库]
        HOOKS[Git Hooks]
    end
    
    subgraph "Git Hooks 验证层"
        HUSKY[Husky]
        COMMITLINT[commitlint]
        LINTSTAGED[lint-staged]
        PRETTIER[Prettier]
        ESLINT[ESLint]
    end
    
    subgraph "GitHub 平台"
        REMOTE[远程仓库]
        PR[Pull Request]
        PROTECT[分支保护]
        ACTIONS[GitHub Actions]
    end
    
    subgraph "CI/CD 流水线"
        INSTALL[依赖安装]
        LINT[代码检查]
        TEST[测试执行]
        BUILD[构建验证]
    end
    
    DEV -->|git add| STAGED
    STAGED -->|git commit| HOOKS
    HOOKS --> HUSKY
    HUSKY --> COMMITLINT
    HUSKY --> LINTSTAGED
    LINTSTAGED --> PRETTIER
    LINTSTAGED --> ESLINT
    HOOKS -->|验证通过| LOCAL
    LOCAL -->|git push| REMOTE
    REMOTE -->|触发| ACTIONS
    ACTIONS --> INSTALL
    INSTALL --> LINT
    LINT --> TEST
    TEST --> BUILD
    REMOTE --> PR
    PR --> PROTECT
    PROTECT -->|审核通过| REMOTE
```

### 分支管理架构

```mermaid
gitGraph
    commit id: "initial commit"
    branch develop
    checkout develop
    commit id: "setup project"
    
    branch feature/user-auth
    checkout feature/user-auth
    commit id: "add login"
    commit id: "add register"
    checkout develop
    merge feature/user-auth
    
    checkout main
    merge develop tag: "v1.0.0"
    
    branch hotfix/security-patch
    checkout hotfix/security-patch
    commit id: "fix vulnerability"
    checkout main
    merge hotfix/security-patch tag: "v1.0.1"
    checkout develop
    merge hotfix/security-patch
```

### 工作流程

1. **本地开发阶段**
   - 开发者从 develop 分支创建 feature 分支
   - 在 feature 分支上进行开发和提交
   - Git Hooks 在提交时自动验证代码格式和提交信息

2. **代码审查阶段**
   - 开发者推送 feature 分支到 GitHub
   - 创建 Pull Request 到 develop 分支
   - GitHub Actions 自动运行 CI 流水线
   - 团队成员进行代码审查

3. **集成阶段**
   - PR 获得批准且 CI 通过后合并到 develop
   - develop 分支积累足够功能后合并到 main
   - 在 main 分支上创建版本标签

4. **紧急修复流程**
   - 从 main 分支创建 hotfix 分支
   - 修复完成后同时合并到 main 和 develop
   - 在 main 上创建补丁版本标签

## Components and Interfaces

### 1. Git 仓库初始化组件

**职责**：初始化 Git 仓库并配置基础设置

**实现方式**：
- 使用 `git init` 初始化仓库
- 配置 `.gitignore` 文件排除不必要的文件
- 配置用户信息和默认分支名称
- 创建初始提交

**配置文件**：
```bash
# .gitignore
# 依赖
node_modules/
.pnp
.pnp.js

# 构建产物
dist/
build/
.next/
out/

# 环境变量
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# 日志
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# 数据库
*.db
*.sqlite
*.sqlite3
prisma/dev.db

# 操作系统
.DS_Store
Thumbs.db
*.swp
*.swo

# IDE
.vscode/
.idea/
*.sublime-project
*.sublime-workspace

# 测试覆盖率
coverage/
.nyc_output/

# 临时文件
*.tmp
.cache/
```

### 2. Husky Git Hooks 管理组件

**职责**：管理和执行 Git Hooks

**安装配置**：
```bash
npm install --save-dev husky
npx husky install
npm pkg set scripts.prepare="husky install"
```

**Hooks 配置**：
- `pre-commit`: 运行 lint-staged 检查暂存文件
- `commit-msg`: 验证提交信息格式

**文件结构**：
```
.husky/
├── pre-commit
└── commit-msg
```

### 3. lint-staged 暂存文件检查组件

**职责**：对暂存区文件执行代码格式化和检查

**配置文件** (`.lintstagedrc.json`):
```json
{
  "*.{ts,tsx,js,jsx}": [
    "prettier --write",
    "eslint --fix"
  ],
  "*.{json,md,yml,yaml}": [
    "prettier --write"
  ]
}
```

**执行流程**：
1. 获取暂存区文件列表
2. 根据文件类型执行对应的格式化工具
3. 如果有错误则阻止提交并显示错误信息

### 4. commitlint 提交信息验证组件

**职责**：验证提交信息符合 Conventional Commits 规范

**配置文件** (`commitlint.config.js`):
```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // 修复
        'docs',     // 文档
        'style',    // 格式
        'refactor', // 重构
        'test',     // 测试
        'chore',    // 构建/工具
        'perf',     // 性能优化
        'ci',       // CI 配置
        'revert'    // 回滚
      ]
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-max-length': [2, 'always', 50],
    'header-max-length': [2, 'always', 72]
  }
};
```

**验证规则**：
- type 必须是预定义的类型之一
- scope 可选，但如果存在必须是小写
- subject 必填，最大长度 50 字符
- 整个 header 最大长度 72 字符

**提交信息格式**：
```
<type>(<scope>): <subject>

<body>

<footer>
```

**示例**：
```
feat(backend): 添加股票实时报价接口

实现了通过 Yahoo Finance API 获取实时股票报价的功能，
包括价格、涨跌幅、成交量等信息。

Closes #123
```

### 5. GitHub Actions CI/CD 组件

**职责**：自动化测试、构建和部署流程

**工作流配置文件** (`.github/workflows/ci.yml`):
```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    name: Test on Node.js ${{ matrix.node-version }}
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run tests
        run: npm run test
      
      - name: Build project
        run: npm run build
      
      - name: Upload coverage
        if: matrix.node-version == '20.x'
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

**触发条件**：
- 向 main 或 develop 分支推送代码
- 创建或更新针对 main 或 develop 的 Pull Request

**执行步骤**：
1. 检出代码
2. 设置 Node.js 环境（多版本矩阵测试）
3. 安装依赖（使用 npm ci 确保一致性）
4. 运行代码检查
5. 运行测试套件
6. 执行构建验证
7. 上传测试覆盖率报告

### 6. 分支保护规则组件

**职责**：保护重要分支不被直接推送

**GitHub 分支保护配置**：

**main 分支保护规则**：
- ✅ 要求 Pull Request 才能合并
- ✅ 要求至少 1 个审核者批准
- ✅ 要求状态检查通过（CI 流水线）
- ✅ 要求分支是最新的（与目标分支同步）
- ✅ 要求解决所有对话
- ✅ 限制谁可以推送（仅管理员）
- ✅ 不允许强制推送
- ✅ 不允许删除分支

**develop 分支保护规则**：
- ✅ 要求 Pull Request 才能合并
- ✅ 要求至少 1 个审核者批准
- ✅ 要求状态检查通过（CI 流水线）
- ✅ 要求分支是最新的
- ✅ 不允许强制推送

### 7. 敏感信息保护组件

**职责**：防止敏感信息被提交到版本控制

**实现方式**：

1. **`.gitignore` 配置**：排除所有敏感文件
2. **`.env.example` 模板**：提供环境变量示例
3. **pre-commit hook 检查**：扫描暂存文件中的敏感模式

**敏感信息检测脚本** (`.husky/pre-commit`):
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# 运行 lint-staged
npx lint-staged

# 检查是否有敏感文件被暂存
SENSITIVE_FILES=$(git diff --cached --name-only | grep -E '\.(env|key|pem|p12)$|\.env\.')

if [ -n "$SENSITIVE_FILES" ]; then
  echo "⚠️  警告：检测到敏感文件被暂存："
  echo "$SENSITIVE_FILES"
  echo ""
  echo "请确认这些文件是否应该被提交。"
  echo "如果不应该提交，请运行："
  echo "  git reset HEAD <file>"
  echo ""
  read -p "是否继续提交？(y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi
```

### 8. 版本标签管理组件

**职责**：管理版本发布和标签

**语义化版本规范**：
- **主版本号 (MAJOR)**：不兼容的 API 变更
- **次版本号 (MINOR)**：向后兼容的功能新增
- **修订号 (PATCH)**：向后兼容的问题修复

**标签创建流程**：
```bash
# 创建带注释的标签
git tag -a v1.0.0 -m "Release version 1.0.0

主要变更：
- 实现用户认证功能
- 添加股票实时报价
- 完成数据库迁移

"

# 推送标签到远程
git push origin v1.0.0

# 或推送所有标签
git push origin --tags
```

**GitHub Release 自动化**：
- 基于标签自动创建 Release 页面
- 从提交历史自动生成变更日志
- 附加构建产物（可选）

## Data Models

### Git 配置数据模型

```typescript
interface GitConfig {
  user: {
    name: string;
    email: string;
  };
  core: {
    autocrlf: 'input' | 'true' | 'false';
    ignorecase: boolean;
  };
  init: {
    defaultBranch: 'main';
  };
  remote: {
    origin: {
      url: string;
      fetch: string;
    };
  };
}
```

### 分支模型

```typescript
interface Branch {
  name: string;
  type: 'main' | 'develop' | 'feature' | 'hotfix' | 'release';
  upstream?: string;
  protected: boolean;
  lastCommit: {
    hash: string;
    message: string;
    author: string;
    date: Date;
  };
}
```

### 提交信息模型

```typescript
interface CommitMessage {
  type: 'feat' | 'fix' | 'docs' | 'style' | 'refactor' | 'test' | 'chore' | 'perf' | 'ci' | 'revert';
  scope?: string;
  subject: string;
  body?: string;
  footer?: string;
  breakingChange?: string;
}

// 示例
const exampleCommit: CommitMessage = {
  type: 'feat',
  scope: 'backend',
  subject: '添加股票实时报价接口',
  body: '实现了通过 Yahoo Finance API 获取实时股票报价的功能，包括价格、涨跌幅、成交量等信息。',
  footer: 'Closes #123'
};
```

### Pull Request 模型

```typescript
interface PullRequest {
  id: number;
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  author: string;
  reviewers: string[];
  status: 'open' | 'closed' | 'merged';
  checks: {
    name: string;
    status: 'pending' | 'success' | 'failure';
    conclusion?: string;
  }[];
  approvals: {
    reviewer: string;
    status: 'approved' | 'changes_requested' | 'commented';
    date: Date;
  }[];
  mergeable: boolean;
}
```

### CI/CD 流水线状态模型

```typescript
interface CIPipeline {
  workflowId: string;
  runId: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped';
  triggeredBy: string;
  branch: string;
  commit: {
    hash: string;
    message: string;
  };
  jobs: {
    name: string;
    status: 'queued' | 'in_progress' | 'completed';
    conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped';
    steps: {
      name: string;
      status: 'queued' | 'in_progress' | 'completed';
      conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped';
      duration: number;
    }[];
  }[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
}
```

### 版本标签模型

```typescript
interface VersionTag {
  name: string; // e.g., "v1.0.0"
  version: {
    major: number;
    minor: number;
    patch: number;
  };
  commit: {
    hash: string;
    message: string;
  };
  annotation: string;
  tagger: {
    name: string;
    email: string;
    date: Date;
  };
  release?: {
    id: number;
    url: string;
    assets: {
      name: string;
      url: string;
      size: number;
    }[];
  };
}
```

### 环境变量模板模型

```typescript
interface EnvTemplate {
  // 数据库配置
  DATABASE_URL: string; // "postgresql://user:password@localhost:5432/dbname"
  
  // 服务器配置
  PORT: number; // 3000
  NODE_ENV: 'development' | 'production' | 'test';
  
  // API 密钥
  YAHOO_FINANCE_API_KEY: string; // "your_api_key_here"
  
  // JWT 配置
  JWT_SECRET: string; // "your_jwt_secret_here"
  JWT_EXPIRES_IN: string; // "7d"
  
  // Redis 配置
  REDIS_URL: string; // "redis://localhost:6379"
  
  // 日志配置
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
}
```


## Correctness Properties

*属性（Property）是指在系统所有有效执行过程中都应该保持为真的特征或行为——本质上是关于系统应该做什么的形式化陈述。属性是人类可读规范和机器可验证正确性保证之间的桥梁。*

### Property 1: Gitignore 文件排除规则完整性

*对于任何*应该被排除的文件类型（node_modules、dist、.env 文件、数据库文件、日志文件、操作系统文件、IDE 配置），.gitignore 文件应该包含相应的排除模式，使得这些文件不会被 git status 显示为未跟踪文件。

**验证需求：1.2, 9.1, 9.2, 9.3, 9.4**

### Property 2: 分支命名规范验证

*对于任何*分支名称，如果它是 feature 类型，则应该匹配 `feature/*` 模式；如果它是 hotfix 类型，则应该匹配 `hotfix/*` 模式。

**验证需求：2.5, 2.6**

### Property 3: Feature 分支基于 develop 创建

*对于任何*从 develop 分支创建的 feature 分支，该分支的基础提交应该是创建时 develop 分支的 HEAD 提交。

**验证需求：2.3**

### Property 4: Hotfix 分支基于 main 创建

*对于任何*从 main 分支创建的 hotfix 分支，该分支的基础提交应该是创建时 main 分支的 HEAD 提交。

**验证需求：2.4**

### Property 5: Feature 分支合并到 develop

*对于任何*feature 分支，当合并到 develop 分支后，develop 分支应该包含该 feature 分支的所有提交。

**验证需求：2.7**

### Property 6: Hotfix 分支同时合并到 main 和 develop

*对于任何*hotfix 分支，当合并操作完成后，main 和 develop 分支都应该包含该 hotfix 分支的所有提交。

**验证需求：2.8**

### Property 7: 提交信息格式可解析性

*对于任何*符合 Conventional Commits 规范的提交信息，应该能够成功解析出 type、可选的 scope 和 subject 字段。

**验证需求：3.1**

### Property 8: 提交信息类型有效性

*对于任何*提交信息，其 type 字段应该是以下值之一：feat、fix、docs、style、refactor、test、chore、perf、ci、revert。

**验证需求：3.2**

### Property 9: 提交信息 subject 长度限制

*对于任何*提交信息，其 subject 字段的长度应该不超过 50 个字符。

**验证需求：3.4**

### Property 10: 提交信息可选字段格式正确性

*对于任何*包含可选字段（scope、body、footer）的提交信息，这些字段应该符合规范格式：scope 为小写字母，body 为非空字符串，包含破坏性变更时 footer 包含 "BREAKING CHANGE:" 标记。

**验证需求：3.3, 3.5, 3.6**

### Property 11: Git Hook 对无效输入的拒绝

*对于任何*不符合规范的代码格式或提交信息，相应的 Git Hook 应该返回非零退出码，阻止提交操作并输出错误信息。

**验证需求：4.3, 4.4**

### Property 12: Git Hook 仅处理暂存文件

*对于任何*包含暂存和未暂存文件的工作区状态，Git Hook 执行的检查应该仅影响暂存区的文件，不修改未暂存的文件。

**验证需求：4.5**

### Property 13: 本地分支跟踪远程分支

*对于任何*推送到远程的本地分支，应该能够查询到其配置的上游（upstream）分支，且上游分支名称应该与本地分支名称对应。

**验证需求：5.4**

### Property 14: 文档包含必需内容

*对于任何*项目文档（CONTRIBUTING.md 和 README.md），应该包含所有必需的章节和关键信息：分支管理策略、提交规范、PR 流程、代码审查标准、Git 工作流程和常用命令。

**验证需求：8.2, 8.3, 8.4, 8.5, 8.6, 8.7**

### Property 15: 环境变量模板包含必需键

*对于任何*.env.example 文件，应该包含所有必需的环境变量键（DATABASE_URL、PORT、NODE_ENV、API_KEY、JWT_SECRET 等），但这些键的值应该是占位符而非真实值。

**验证需求：9.6**

### Property 16: 敏感文件检测警告

*对于任何*匹配敏感文件模式（.env、.key、.pem 等）的暂存文件，pre-commit hook 应该输出警告信息，提示用户确认是否继续提交。

**验证需求：9.7**

### Property 17: 版本标签创建在 main 分支

*对于任何*版本标签，应该在 main 分支上创建，且标签指向的提交应该存在于 main 分支的历史中。

**验证需求：10.1**

### Property 18: 版本标签遵循语义化版本规范

*对于任何*版本标签名称，应该匹配语义化版本模式 `v<major>.<minor>.<patch>`，其中 major、minor、patch 都是非负整数。

**验证需求：10.2**

### Property 19: 版本标签包含注释

*对于任何*使用 `git tag -a` 创建的版本标签，应该包含非空的注释内容，说明该版本的主要变更。

**验证需求：10.3**

### Property 20: 标签推送到远程仓库

*对于任何*本地创建的版本标签，执行推送操作后，远程仓库应该包含相同名称和指向相同提交的标签。

**验证需求：10.4**

## Error Handling

### Git 操作错误处理

1. **仓库初始化失败**
   - 错误场景：目录已存在 .git 文件夹
   - 处理方式：检查是否已初始化，提示用户确认是否重新初始化
   - 错误信息：`错误：Git 仓库已存在。如需重新初始化，请先删除 .git 目录。`

2. **分支创建失败**
   - 错误场景：分支名称已存在、基础分支不存在
   - 处理方式：验证分支名称唯一性和基础分支存在性
   - 错误信息：`错误：分支 'feature/xxx' 已存在。请使用不同的名称或删除现有分支。`

3. **合并冲突**
   - 错误场景：自动合并失败，存在冲突文件
   - 处理方式：标记冲突文件，提示用户手动解决
   - 错误信息：`合并冲突：以下文件存在冲突，请手动解决后提交：\n- src/file1.ts\n- src/file2.ts`

4. **推送被拒绝**
   - 错误场景：远程分支有新提交、分支受保护
   - 处理方式：提示用户先拉取远程更新或通过 PR 提交
   - 错误信息：`推送被拒绝：远程分支有新提交。请先执行 'git pull --rebase' 更新本地分支。`

### Git Hooks 错误处理

1. **代码格式检查失败**
   - 错误场景：代码不符合 Prettier/ESLint 规则
   - 处理方式：显示具体错误文件和行号，阻止提交
   - 错误信息：
     ```
     ✖ 代码格式检查失败：
     
     src/services/stockService.ts
       12:5  error  Missing semicolon  semi
       23:10 error  'unused' is defined but never used  no-unused-vars
     
     请修复以上错误后重新提交。
     ```

2. **提交信息格式错误**
   - 错误场景：提交信息不符合 Conventional Commits 规范
   - 处理方式：显示格式要求和示例，阻止提交
   - 错误信息：
     ```
     ✖ 提交信息格式错误
     
     提交信息必须遵循格式：<type>(<scope>): <subject>
     
     允许的类型：feat, fix, docs, style, refactor, test, chore
     
     示例：
       feat(backend): 添加股票实时报价接口
       fix(frontend): 修复图表显示错误
     ```

3. **敏感文件警告**
   - 错误场景：检测到 .env 或其他敏感文件被暂存
   - 处理方式：显示警告，询问用户是否继续
   - 错误信息：
     ```
     ⚠️  警告：检测到敏感文件被暂存：
     - .env
     - config/secrets.json
     
     这些文件可能包含敏感信息，不应提交到版本控制。
     是否继续提交？(y/N)
     ```

### GitHub Actions 错误处理

1. **依赖安装失败**
   - 错误场景：package.json 中的依赖无法安装
   - 处理方式：显示详细的 npm 错误日志
   - 失败状态：标记 CI 为失败，阻止 PR 合并

2. **测试失败**
   - 错误场景：单元测试或集成测试失败
   - 处理方式：显示失败的测试用例和错误堆栈
   - 失败状态：标记 CI 为失败，在 PR 中显示失败详情

3. **构建失败**
   - 错误场景：TypeScript 编译错误、打包失败
   - 处理方式：显示编译错误信息和文件位置
   - 失败状态：标记 CI 为失败，提示修复后重新推送

4. **超时错误**
   - 错误场景：CI 流水线执行超过时间限制
   - 处理方式：取消执行，提示优化测试或增加超时时间
   - 错误信息：`工作流执行超时。请检查是否有死循环或性能问题。`

### 配置错误处理

1. **Git 配置缺失**
   - 错误场景：用户名或邮箱未配置
   - 处理方式：提示用户配置必需信息
   - 错误信息：
     ```
     错误：Git 用户信息未配置
     
     请运行以下命令配置：
       git config --global user.name "Your Name"
       git config --global user.email "your.email@example.com"
     ```

2. **远程仓库配置错误**
   - 错误场景：远程仓库 URL 无效或无权限
   - 处理方式：验证 URL 格式和访问权限
   - 错误信息：`错误：无法访问远程仓库。请检查 URL 和访问权限。`

3. **Husky 安装失败**
   - 错误场景：.husky 目录未创建或 hooks 不可执行
   - 处理方式：重新运行 `npx husky install`
   - 错误信息：`警告：Git Hooks 未正确安装。请运行 'npx husky install' 重新安装。`

## Testing Strategy

### 测试方法概述

本功能采用**双重测试策略**，结合单元测试和基于属性的测试（Property-Based Testing），确保全面的质量保障：

- **单元测试**：验证具体示例、边缘情况和错误条件
- **属性测试**：验证跨所有输入的通用属性
- 两者互补：单元测试捕获具体错误，属性测试验证通用正确性

### 测试工具选择

- **单元测试框架**：Vitest（用于 TypeScript/JavaScript）
- **属性测试库**：fast-check（JavaScript/TypeScript 的属性测试库）
- **Git 操作测试**：使用临时目录和 simple-git 库
- **GitHub API 测试**：使用 @octokit/rest 和 nock 进行 API mock
- **最小迭代次数**：每个属性测试至少运行 100 次迭代

### 单元测试策略

#### 1. Git 仓库初始化测试

**测试文件**：`tests/git-setup.test.ts`

```typescript
describe('Git 仓库初始化', () => {
  test('应该在项目根目录创建 .git 目录', () => {
    // 验证需求 1.1
  });

  test('应该配置用户名和邮箱', () => {
    // 验证需求 1.3
  });

  test('应该创建初始提交', () => {
    // 验证需求 1.4
  });
});
```

#### 2. 分支管理测试

**测试文件**：`tests/branch-management.test.ts`

```typescript
describe('分支管理', () => {
  test('应该存在 main 和 develop 分支', () => {
    // 验证需求 2.1, 2.2
  });

  test('feature 分支名称应该符合规范', () => {
    // 验证需求 2.5 的具体示例
  });

  test('hotfix 分支名称应该符合规范', () => {
    // 验证需求 2.6 的具体示例
  });
});
```

#### 3. Git Hooks 测试

**测试文件**：`tests/git-hooks.test.ts`

```typescript
describe('Git Hooks', () => {
  test('pre-commit hook 应该存在且可执行', () => {
    // 验证需求 4.1
  });

  test('commit-msg hook 应该存在且可执行', () => {
    // 验证需求 4.2
  });

  test('应该拒绝格式错误的提交信息', () => {
    // 验证需求 4.4 的具体示例
  });
});
```

#### 4. GitHub Actions 配置测试

**测试文件**：`tests/github-actions.test.ts`

```typescript
describe('GitHub Actions 配置', () => {
  test('workflow 文件应该包含 push 触发器', () => {
    // 验证需求 7.1
  });

  test('workflow 文件应该包含 pull_request 触发器', () => {
    // 验证需求 7.2
  });

  test('workflow 应该包含所有必需步骤', () => {
    // 验证需求 7.3, 7.4, 7.5, 7.6
  });

  test('workflow 应该在多个 Node.js 版本上运行', () => {
    // 验证需求 7.8
  });
});
```

#### 5. 文档完整性测试

**测试文件**：`tests/documentation.test.ts`

```typescript
describe('项目文档', () => {
  test('应该存在 CONTRIBUTING.md 文件', () => {
    // 验证需求 8.1
  });

  test('应该存在 README.md 文件', () => {
    // 验证需求 5.5
  });

  test('应该存在 .env.example 文件', () => {
    // 验证需求 9.5
  });
});
```

### 属性测试策略

#### 1. Gitignore 规则属性测试

**测试文件**：`tests/gitignore.property.test.ts`

**标签**：Feature: git-github-integration, Property 1: 对于任何应该被排除的文件类型，.gitignore 文件应该包含相应的排除模式

```typescript
import fc from 'fast-check';

describe('Property 1: Gitignore 文件排除规则完整性', () => {
  test('应该排除所有应该被忽略的文件类型', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('node_modules/package.json'),
          fc.constant('dist/bundle.js'),
          fc.constant('.env'),
          fc.constant('.env.local'),
          fc.constant('test.db'),
          fc.constant('app.log'),
          fc.constant('.DS_Store')
        ),
        (filePath) => {
          // 验证文件是否被 .gitignore 排除
          const isIgnored = checkGitignore(filePath);
          expect(isIgnored).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### 2. 分支命名规范属性测试

**测试文件**：`tests/branch-naming.property.test.ts`

**标签**：Feature: git-github-integration, Property 2: 对于任何分支名称，应该匹配其类型的命名模式

```typescript
describe('Property 2: 分支命名规范验证', () => {
  test('feature 分支应该匹配 feature/* 模式', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('/')),
        (featureName) => {
          const branchName = `feature/${featureName}`;
          expect(validateBranchName(branchName, 'feature')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('hotfix 分支应该匹配 hotfix/* 模式', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('/')),
        (fixName) => {
          const branchName = `hotfix/${fixName}`;
          expect(validateBranchName(branchName, 'hotfix')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### 3. 提交信息格式属性测试

**测试文件**：`tests/commit-message.property.test.ts`

**标签**：Feature: git-github-integration, Property 7-10: 提交信息格式验证

```typescript
describe('Property 7: 提交信息格式可解析性', () => {
  test('应该能够解析符合规范的提交信息', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore'),
        fc.option(fc.constantFrom('backend', 'frontend', 'api', 'database'), { nil: undefined }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (type, scope, subject) => {
          const message = scope 
            ? `${type}(${scope}): ${subject}`
            : `${type}: ${subject}`;
          
          const parsed = parseCommitMessage(message);
          expect(parsed.type).toBe(type);
          expect(parsed.scope).toBe(scope);
          expect(parsed.subject).toBe(subject);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 8: 提交信息类型有效性', () => {
  test('type 应该是允许的类型之一', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore', 'perf', 'ci', 'revert'),
        fc.string({ minLength: 1, maxLength: 50 }),
        (type, subject) => {
          const message = `${type}: ${subject}`;
          expect(validateCommitType(message)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 9: 提交信息 subject 长度限制', () => {
  test('subject 长度不应超过 50 字符', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('feat', 'fix', 'docs'),
        fc.string({ minLength: 1, maxLength: 50 }),
        (type, subject) => {
          const message = `${type}: ${subject}`;
          expect(validateSubjectLength(message)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('超过 50 字符的 subject 应该被拒绝', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('feat', 'fix', 'docs'),
        fc.string({ minLength: 51, maxLength: 100 }),
        (type, subject) => {
          const message = `${type}: ${subject}`;
          expect(validateSubjectLength(message)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### 4. 版本标签属性测试

**测试文件**：`tests/version-tag.property.test.ts`

**标签**：Feature: git-github-integration, Property 18: 版本标签遵循语义化版本规范

```typescript
describe('Property 18: 版本标签遵循语义化版本规范', () => {
  test('版本标签应该匹配 v<major>.<minor>.<patch> 格式', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100 }),
        fc.nat({ max: 100 }),
        fc.nat({ max: 100 }),
        (major, minor, patch) => {
          const tagName = `v${major}.${minor}.${patch}`;
          expect(validateVersionTag(tagName)).toBe(true);
          
          const parsed = parseVersionTag(tagName);
          expect(parsed.major).toBe(major);
          expect(parsed.minor).toBe(minor);
          expect(parsed.patch).toBe(patch);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### 5. 环境变量模板属性测试

**测试文件**：`tests/env-template.property.test.ts`

**标签**：Feature: git-github-integration, Property 15: 环境变量模板包含必需键

```typescript
describe('Property 15: 环境变量模板包含必需键', () => {
  test('.env.example 应该包含所有必需的键但值为占位符', () => {
    const requiredKeys = [
      'DATABASE_URL',
      'PORT',
      'NODE_ENV',
      'YAHOO_FINANCE_API_KEY',
      'JWT_SECRET',
      'REDIS_URL'
    ];

    fc.assert(
      fc.property(
        fc.constant(requiredKeys),
        (keys) => {
          const envExample = readEnvExample();
          
          keys.forEach(key => {
            expect(envExample).toHaveProperty(key);
            expect(envExample[key]).toMatch(/placeholder|example|your_|xxx/i);
            expect(envExample[key]).not.toMatch(/^[a-f0-9]{32,}$/); // 不应该是真实的密钥
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### 集成测试策略

#### 1. 完整工作流集成测试

**测试文件**：`tests/integration/git-workflow.test.ts`

```typescript
describe('Git 工作流集成测试', () => {
  test('完整的 feature 开发流程', async () => {
    // 1. 从 develop 创建 feature 分支
    // 2. 进行开发和提交
    // 3. 推送到远程
    // 4. 创建 PR
    // 5. 合并到 develop
  });

  test('完整的 hotfix 流程', async () => {
    // 1. 从 main 创建 hotfix 分支
    // 2. 修复问题并提交
    // 3. 合并到 main 和 develop
    // 4. 创建版本标签
  });
});
```

#### 2. CI/CD 流水线集成测试

**测试文件**：`tests/integration/ci-pipeline.test.ts`

```typescript
describe('CI/CD 流水线集成测试', () => {
  test('推送代码应该触发 CI', async () => {
    // 模拟推送操作，验证 GitHub Actions 触发
  });

  test('CI 失败应该阻止 PR 合并', async () => {
    // 模拟测试失败，验证 PR 状态
  });
});
```

### 测试覆盖率目标

- **代码覆盖率**：≥ 80%
- **分支覆盖率**：≥ 75%
- **属性测试迭代**：每个属性至少 100 次
- **关键路径覆盖**：100%（初始化、分支管理、提交验证、CI/CD）

### 持续测试

- 所有测试在 CI 流水线中自动运行
- PR 必须通过所有测试才能合并
- 定期运行完整测试套件（每日构建）
- 性能测试和压力测试（每周运行）
