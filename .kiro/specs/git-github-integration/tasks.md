# 实施计划：Git 和 GitHub 集成

## 概述

本实施计划将智能股票分析平台与 Git 版本控制和 GitHub 平台深度集成。通过分阶段实施，建立标准化的开发工作流、自动化质量保障机制和完善的协作体系。

实施策略采用增量方式，从基础的 Git 仓库初始化开始，逐步添加自动化验证、远程协作和 CI/CD 流水线，确保每个阶段都能独立验证和使用。

## 任务清单

- [ ] 1. Git 仓库初始化和基础配置
  - [x] 1.1 初始化 Git 仓库并配置 .gitignore
    - 在项目根目录执行 `git init`
    - 创建 .gitignore 文件，排除 node_modules、dist、.env 文件、数据库文件、日志文件、操作系统文件和 IDE 配置
    - 配置 Git 用户信息（user.name 和 user.email）
    - 设置默认分支名称为 main
    - _需求：1.1, 1.2, 1.3, 9.1, 9.2, 9.3, 9.4_
  
  - [ ]* 1.2 编写 .gitignore 规则完整性属性测试
    - **属性 1：Gitignore 文件排除规则完整性**
    - **验证需求：1.2, 9.1, 9.2, 9.3, 9.4**
    - 测试所有应该被排除的文件类型都被正确忽略
  
  - [x] 1.3 创建环境变量模板文件
    - 创建 .env.example 文件，包含所有必需的环境变量键
    - 使用占位符值，不包含真实敏感信息
    - 添加注释说明每个变量的用途
    - _需求：9.5, 9.6_
  
  - [ ]* 1.4 编写环境变量模板属性测试
    - **属性 15：环境变量模板包含必需键**
    - **验证需求：9.6**
    - 验证 .env.example 包含所有必需键且值为占位符

- [ ] 2. 分支管理策略实施
  - [-] 2.1 创建主要分支结构
    - 确保 main 分支存在（已由 git init 创建）
    - 创建 develop 分支：`git checkout -b develop`
    - 创建初始提交：`git commit --allow-empty -m "chore: initial commit"`
    - _需求：1.4, 2.1, 2.2_
  
  - [~] 2.2 编写分支管理辅助脚本
    - 创建 scripts/create-feature-branch.sh 脚本，从 develop 创建 feature 分支
    - 创建 scripts/create-hotfix-branch.sh 脚本，从 main 创建 hotfix 分支
    - 添加分支命名验证逻辑
    - _需求：2.3, 2.4, 2.5, 2.6_
  
  - [ ]* 2.3 编写分支命名规范属性测试
    - **属性 2：分支命名规范验证**
    - **验证需求：2.5, 2.6**
    - 测试 feature 和 hotfix 分支命名格式
  
  - [ ]* 2.4 编写分支创建和合并属性测试
    - **属性 3：Feature 分支基于 develop 创建**
    - **属性 4：Hotfix 分支基于 main 创建**
    - **属性 5：Feature 分支合并到 develop**
    - **属性 6：Hotfix 分支同时合并到 main 和 develop**
    - **验证需求：2.3, 2.4, 2.7, 2.8**

- [ ] 3. Husky 和 Git Hooks 配置
  - [~] 3.1 安装和初始化 Husky
    - 安装 Husky：`npm install --save-dev husky`
    - 初始化 Husky：`npx husky install`
    - 添加 prepare 脚本到 package.json：`npm pkg set scripts.prepare="husky install"`
    - _需求：4.1, 4.2_
  
  - [~] 3.2 创建 pre-commit hook
    - 创建 .husky/pre-commit 文件
    - 配置运行 lint-staged
    - 添加敏感文件检测逻辑
    - 设置可执行权限
    - _需求：4.1, 4.5, 9.7_
  
  - [~] 3.3 创建 commit-msg hook
    - 创建 .husky/commit-msg 文件
    - 配置运行 commitlint
    - 设置可执行权限
    - _需求：4.2, 4.4_
  
  - [ ]* 3.4 编写 Git Hooks 单元测试
    - 测试 pre-commit hook 存在且可执行
    - 测试 commit-msg hook 存在且可执行
    - 测试 hooks 对无效输入的拒绝
  
  - [ ]* 3.5 编写 Git Hook 行为属性测试
    - **属性 11：Git Hook 对无效输入的拒绝**
    - **属性 12：Git Hook 仅处理暂存文件**
    - **属性 16：敏感文件检测警告**
    - **验证需求：4.3, 4.4, 4.5, 9.7**

- [ ] 4. lint-staged 和代码格式化配置
  - [~] 4.1 安装 lint-staged 和格式化工具
    - 安装 lint-staged：`npm install --save-dev lint-staged`
    - 确保 Prettier 和 ESLint 已安装
    - _需求：4.1_
  
  - [~] 4.2 创建 lint-staged 配置文件
    - 创建 .lintstagedrc.json 文件
    - 配置 TypeScript/JavaScript 文件使用 Prettier 和 ESLint
    - 配置 JSON/Markdown/YAML 文件使用 Prettier
    - _需求：4.1, 4.3_
  
  - [ ]* 4.3 编写代码格式检查单元测试
    - 测试格式正确的代码通过检查
    - 测试格式错误的代码被拒绝
    - 测试仅暂存文件被检查

- [ ] 5. commitlint 提交信息验证配置
  - [~] 5.1 安装 commitlint 及配置包
    - 安装 commitlint：`npm install --save-dev @commitlint/cli @commitlint/config-conventional`
    - _需求：3.1, 3.2_
  
  - [~] 5.2 创建 commitlint 配置文件
    - 创建 commitlint.config.js 文件
    - 配置允许的提交类型（feat, fix, docs, style, refactor, test, chore, perf, ci, revert）
    - 配置 scope 和 subject 规则
    - 设置长度限制（subject 最大 50 字符，header 最大 72 字符）
    - _需求：3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  
  - [ ]* 5.3 编写提交信息格式属性测试
    - **属性 7：提交信息格式可解析性**
    - **属性 8：提交信息类型有效性**
    - **属性 9：提交信息 subject 长度限制**
    - **属性 10：提交信息可选字段格式正确性**
    - **验证需求：3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

- [~] 6. 检查点 - 验证本地 Git 配置
  - 确保所有 Git Hooks 正常工作
  - 测试提交格式验证和代码检查
  - 询问用户是否有问题

- [ ] 7. GitHub 远程仓库对接
  - [~] 7.1 配置 GitHub 仓库信息
    - 仓库地址：https://github.com/Timking123/gushen
    - 确保仓库已创建（如未创建，在 GitHub 上创建）
    - _需求：5.1_
  
  - [~] 7.2 配置远程仓库连接
    - 添加远程仓库：`git remote add origin https://github.com/Timking123/gushen.git`
    - 配置 Git 凭据（使用 Personal Access Token）
    - 推送 main 分支：`git push -u origin main`
    - 推送 develop 分支：`git push -u origin develop`
    - _需求：5.1, 5.2, 5.3, 5.4_
    - **注意**：建议使用 Git Credential Manager 或 SSH 密钥进行身份验证，避免在命令中直接使用 token
  
  - [ ]* 7.3 编写远程仓库配置属性测试
    - **属性 13：本地分支跟踪远程分支**
    - **验证需求：5.4**

- [ ] 8. GitHub Actions CI/CD 流水线配置
  - [~] 8.1 创建 GitHub Actions 工作流文件
    - 创建 .github/workflows/ci.yml 文件
    - 配置触发条件：push 到 main/develop 分支，PR 到 main/develop 分支
    - _需求：7.1, 7.2_
  
  - [~] 8.2 配置 CI 流水线步骤
    - 添加代码检出步骤
    - 配置 Node.js 环境（18.x 和 20.x 矩阵）
    - 添加依赖安装步骤（npm ci）
    - 添加代码检查步骤（npm run lint）
    - 添加测试步骤（npm run test）
    - 添加构建步骤（npm run build）
    - 添加测试覆盖率上传步骤
    - _需求：7.3, 7.4, 7.5, 7.6, 7.8_
  
  - [ ]* 8.3 编写 GitHub Actions 配置单元测试
    - 测试 workflow 文件包含正确的触发器
    - 测试 workflow 包含所有必需步骤
    - 测试 workflow 在多个 Node.js 版本上运行

- [ ] 9. GitHub 分支保护规则配置
  - [~] 9.1 配置 main 分支保护
    - 在 GitHub 仓库设置中配置 main 分支保护
    - 要求 Pull Request 才能合并
    - 要求至少 1 个审核者批准
    - 要求状态检查通过（CI 流水线）
    - 要求分支是最新的
    - 要求解决所有对话
    - 限制推送权限（仅管理员）
    - 禁止强制推送和删除分支
    - _需求：6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [~] 9.2 配置 develop 分支保护
    - 配置 develop 分支保护规则
    - 要求 Pull Request 才能合并
    - 要求至少 1 个审核者批准
    - 要求状态检查通过
    - 要求分支是最新的
    - 禁止强制推送
    - _需求：6.2, 6.3, 6.4, 6.6_

- [ ] 10. 项目文档创建和更新
  - [~] 10.1 创建 CONTRIBUTING.md 文件
    - 说明分支管理策略和命名规范
    - 说明提交信息规范和示例
    - 说明 Pull Request 流程和要求
    - 说明代码审查标准
    - 添加常见问题解答
    - _需求：8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [~] 10.2 更新 README.md 文件
    - 添加 Git 工作流程说明章节
    - 添加常用 Git 命令参考
    - 添加开发环境设置说明
    - 添加 CI/CD 状态徽章
    - _需求：5.5, 8.6, 8.7_
  
  - [ ]* 10.3 编写文档完整性属性测试
    - **属性 14：文档包含必需内容**
    - **验证需求：8.2, 8.3, 8.4, 8.5, 8.6, 8.7**
    - 验证 CONTRIBUTING.md 和 README.md 包含所有必需章节

- [ ] 11. 版本标签管理配置
  - [~] 11.1 创建版本标签管理脚本
    - 创建 scripts/create-release.sh 脚本
    - 实现语义化版本验证
    - 实现标签创建和推送逻辑
    - 添加变更日志生成功能
    - _需求：10.1, 10.2, 10.3, 10.4_
  
  - [ ]* 11.2 编写版本标签属性测试
    - **属性 17：版本标签创建在 main 分支**
    - **属性 18：版本标签遵循语义化版本规范**
    - **属性 19：版本标签包含注释**
    - **属性 20：标签推送到远程仓库**
    - **验证需求：10.1, 10.2, 10.3, 10.4**

- [~] 12. 检查点 - 完整工作流验证
  - 测试完整的 feature 开发流程
  - 测试完整的 hotfix 流程
  - 验证 CI/CD 流水线正常运行
  - 验证分支保护规则生效
  - 确保所有测试通过
  - 询问用户是否有问题

- [ ] 13. 集成测试和文档最终验证
  - [~] 13.1 编写完整工作流集成测试
    - 测试 feature 开发完整流程
    - 测试 hotfix 修复完整流程
    - 测试版本发布完整流程
    - _需求：2.3, 2.4, 2.7, 2.8, 10.1, 10.4_
  
  - [~] 13.2 编写 CI/CD 流水线集成测试
    - 测试推送代码触发 CI
    - 测试 CI 失败阻止 PR 合并
    - 测试 CI 成功允许 PR 合并
    - _需求：7.1, 7.2, 7.7_
  
  - [~] 13.3 验证所有文档和配置文件
    - 检查所有配置文件语法正确
    - 验证文档链接有效
    - 确保示例代码可运行
    - 运行完整测试套件

- [~] 14. 最终检查点
  - 确保所有测试通过（单元测试、属性测试、集成测试）
  - 验证测试覆盖率达到目标（≥80%）
  - 确认所有文档完整且准确
  - 询问用户是否准备好开始使用新的 Git 工作流

## 注意事项

- 标记 `*` 的任务为可选任务，可以跳过以加快 MVP 交付
- 每个任务都引用了具体的需求编号，便于追溯
- 检查点任务确保增量验证，及时发现问题
- 属性测试验证通用正确性属性，单元测试验证具体示例
- 建议按顺序执行任务，因为后续任务依赖前面任务的输出

## 测试策略说明

本实施计划采用双重测试策略：

1. **单元测试**：验证具体功能点、边缘情况和错误处理
2. **属性测试**：验证跨所有输入的通用属性，每个属性至少运行 100 次迭代

测试工具：
- 单元测试框架：Vitest
- 属性测试库：fast-check
- Git 操作测试：simple-git + 临时目录
- GitHub API 测试：@octokit/rest + nock

测试覆盖率目标：
- 代码覆盖率：≥80%
- 分支覆盖率：≥75%
- 关键路径覆盖：100%
