# 需求文档：Git 和 GitHub 集成

## 简介

本功能旨在为智能股票分析平台建立规范的 Git 版本控制体系，并成功对接 GitHub 平台。通过实施标准化的分支管理策略、提交规范和自动化工作流，提升团队协作效率和代码质量管理水平。

## 术语表

- **Git_System**: 本地 Git 版本控制系统
- **GitHub_Platform**: GitHub 远程代码托管平台
- **Repository**: 项目代码仓库
- **Commit**: Git 提交记录
- **Branch**: Git 分支
- **Pull_Request**: GitHub 拉取请求（PR）
- **Conventional_Commit**: 遵循约定式提交规范的提交信息格式
- **Git_Hook**: Git 钩子，在特定 Git 操作时自动执行的脚本
- **CI_Pipeline**: 持续集成流水线
- **Protected_Branch**: 受保护的分支，需要特定权限才能推送
- **Gitignore_File**: .gitignore 文件，定义不纳入版本控制的文件模式
- **Main_Branch**: 主分支（main），包含生产就绪代码
- **Development_Branch**: 开发分支（develop），包含最新开发代码
- **Feature_Branch**: 功能分支，用于开发新功能
- **Hotfix_Branch**: 热修复分支，用于紧急修复生产问题

## 需求

### 需求 1：Git 仓库初始化

**用户故事：** 作为开发者，我希望初始化 Git 仓库并配置基础设置，以便开始版本控制。

#### 验收标准

1. THE Git_System SHALL 在项目根目录初始化 Git 仓库
2. THE Gitignore_File SHALL 排除 node_modules、dist、.env、日志文件和 IDE 配置文件
3. THE Git_System SHALL 配置用户名和邮箱信息
4. THE Repository SHALL 包含初始提交，提交信息为 "chore: initial commit"

### 需求 2：分支管理策略

**用户故事：** 作为团队负责人，我希望建立清晰的分支管理策略，以便规范团队协作流程。

#### 验收标准

1. THE Repository SHALL 维护 Main_Branch 作为生产环境分支
2. THE Repository SHALL 维护 Development_Branch 作为开发集成分支
3. WHEN 开发新功能时，THE Git_System SHALL 从 Development_Branch 创建 Feature_Branch
4. WHEN 需要紧急修复时，THE Git_System SHALL 从 Main_Branch 创建 Hotfix_Branch
5. THE Feature_Branch SHALL 遵循命名规范 "feature/功能描述"
6. THE Hotfix_Branch SHALL 遵循命名规范 "hotfix/问题描述"
7. WHEN Feature_Branch 开发完成时，THE Git_System SHALL 合并回 Development_Branch
8. WHEN Hotfix_Branch 修复完成时，THE Git_System SHALL 同时合并到 Main_Branch 和 Development_Branch

### 需求 3：提交信息规范

**用户故事：** 作为开发者，我希望遵循统一的提交信息格式，以便生成清晰的变更历史。

#### 验收标准

1. THE Commit SHALL 遵循 Conventional_Commit 规范格式：`<type>(<scope>): <subject>`
2. THE Commit SHALL 使用以下类型之一：feat（新功能）、fix（修复）、docs（文档）、style（格式）、refactor（重构）、test（测试）、chore（构建/工具）
3. WHERE scope 适用时，THE Commit SHALL 包含影响范围（如 backend、frontend、api、database）
4. THE Commit 的 subject SHALL 使用中文描述，长度不超过 50 个字符
5. WHERE 需要详细说明时，THE Commit SHALL 包含 body 部分，说明变更原因和影响
6. WHERE 存在破坏性变更时，THE Commit SHALL 在 footer 中包含 "BREAKING CHANGE:" 标记

### 需求 4：提交前验证

**用户故事：** 作为开发者，我希望在提交前自动验证代码质量，以便及早发现问题。

#### 验收标准

1. WHEN 执行 git commit 时，THE Git_Hook SHALL 自动运行代码格式检查
2. WHEN 执行 git commit 时，THE Git_Hook SHALL 验证提交信息格式符合 Conventional_Commit 规范
3. IF 代码格式检查失败，THEN THE Git_Hook SHALL 阻止提交并显示错误信息
4. IF 提交信息格式不符合规范，THEN THE Git_Hook SHALL 阻止提交并显示格式要求
5. THE Git_Hook SHALL 仅检查暂存区（staged）的文件，不影响未暂存的文件

### 需求 5：GitHub 远程仓库对接

**用户故事：** 作为项目管理员，我希望将项目对接到 GitHub 平台，以便实现远程协作和备份。

#### 验收标准

1. THE Repository SHALL 添加 GitHub 远程仓库地址作为 origin
2. WHEN 首次推送时，THE Git_System SHALL 推送 Main_Branch 到 GitHub_Platform
3. WHEN 首次推送时，THE Git_System SHALL 推送 Development_Branch 到 GitHub_Platform
4. THE Git_System SHALL 配置本地分支跟踪对应的远程分支
5. THE Repository SHALL 在 GitHub_Platform 上包含 README.md 文件，显示项目基本信息

### 需求 6：分支保护规则

**用户故事：** 作为项目管理员，我希望设置分支保护规则，以便防止直接推送到重要分支。

#### 验收标准

1. THE Main_Branch SHALL 配置为 Protected_Branch
2. THE Development_Branch SHALL 配置为 Protected_Branch
3. WHEN 向 Protected_Branch 推送代码时，THE GitHub_Platform SHALL 要求通过 Pull_Request
4. WHEN 创建 Pull_Request 时，THE GitHub_Platform SHALL 要求至少一名审核者批准
5. WHEN Pull_Request 存在未解决的评论时，THE GitHub_Platform SHALL 阻止合并
6. THE Protected_Branch SHALL 要求 CI_Pipeline 检查通过后才能合并

### 需求 7：持续集成配置

**用户故事：** 作为开发者，我希望配置 GitHub Actions 自动化测试，以便确保代码质量。

#### 验收标准

1. WHEN 向任何分支推送代码时，THE CI_Pipeline SHALL 自动触发
2. WHEN Pull_Request 创建或更新时，THE CI_Pipeline SHALL 自动触发
3. THE CI_Pipeline SHALL 安装项目依赖（npm install）
4. THE CI_Pipeline SHALL 运行代码检查（npm run lint）
5. THE CI_Pipeline SHALL 运行后端测试套件（npm run test）
6. THE CI_Pipeline SHALL 执行前后端构建（npm run build）
7. IF 任何步骤失败，THEN THE CI_Pipeline SHALL 标记检查为失败状态
8. THE CI_Pipeline SHALL 在 Node.js 18.x 和 20.x 版本上运行，确保兼容性

### 需求 8：项目文档完善

**用户故事：** 作为新加入的开发者，我希望查看完整的项目文档，以便快速了解开发流程。

#### 验收标准

1. THE Repository SHALL 包含 CONTRIBUTING.md 文件，说明贡献指南
2. THE CONTRIBUTING.md SHALL 说明分支管理策略和命名规范
3. THE CONTRIBUTING.md SHALL 说明提交信息规范和示例
4. THE CONTRIBUTING.md SHALL 说明 Pull Request 流程和要求
5. THE CONTRIBUTING.md SHALL 说明代码审查标准
6. THE README.md SHALL 包含 Git 工作流程说明章节
7. THE README.md SHALL 包含常用 Git 命令参考

### 需求 9：敏感信息保护

**用户故事：** 作为安全负责人，我希望确保敏感信息不被提交到版本控制，以便保护系统安全。

#### 验收标准

1. THE Gitignore_File SHALL 排除所有 .env 文件（包括 .env.local、.env.production）
2. THE Gitignore_File SHALL 排除数据库文件（*.db、*.sqlite）
3. THE Gitignore_File SHALL 排除日志文件（logs/、*.log）
4. THE Gitignore_File SHALL 排除操作系统文件（.DS_Store、Thumbs.db）
5. THE Repository SHALL 包含 .env.example 文件作为环境变量模板
6. THE .env.example SHALL 包含所有必需的环境变量键，但值为占位符
7. WHEN 检测到敏感文件被暂存时，THE Git_Hook SHALL 发出警告提示

### 需求 10：版本标签管理

**用户故事：** 作为发布管理员，我希望使用 Git 标签标记版本发布，以便追踪版本历史。

#### 验收标准

1. WHEN 发布新版本时，THE Git_System SHALL 在 Main_Branch 创建版本标签
2. THE 版本标签 SHALL 遵循语义化版本规范（如 v1.0.0、v1.1.0）
3. THE 版本标签 SHALL 包含注释，说明该版本的主要变更
4. WHEN 创建版本标签后，THE Git_System SHALL 推送标签到 GitHub_Platform
5. THE GitHub_Platform SHALL 基于版本标签自动创建 Release 页面

## 质量属性

### 可维护性
- 提交历史清晰可读，便于追溯变更原因
- 分支结构清晰，便于理解开发流程

### 安全性
- 敏感信息不进入版本控制
- 重要分支受保护，防止误操作

### 协作效率
- 标准化流程减少沟通成本
- 自动化检查减少人工审查负担

### 代码质量
- 提交前自动验证确保基本质量
- CI 流水线持续监控代码健康度
