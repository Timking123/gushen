/**
 * API 文档生成脚本
 * 
 * 此脚本负责：
 * 1. 扫描路由文件并生成 OpenAPI 规范
 * 2. 将规范写入 docs/api/openapi.yaml 和 openapi.json
 * 3. 生成 REST API 概览文档 (docs/api/rest-api.md)
 */

import { OpenAPIGenerator } from '../src/utils/OpenAPIGenerator.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 主函数：生成 API 文档
 */
async function generateAPIDocs() {
  try {
    console.log('开始生成 API 文档...\n');

    // 1. 创建 OpenAPI 生成器
    const generator = new OpenAPIGenerator(
      'Stock Analysis Platform API',
      '1.0.0',
      'RESTful API for stock analysis and portfolio management'
    );

    // 2. 扫描路由并生成规范
    const routesDir = path.join(__dirname, '../src/routes');
    console.log(`扫描路由目录: ${routesDir}`);
    
    await generator.generateFromRoutes(routesDir);
    const spec = generator.getSpec();

    // 3. 验证规范
    console.log('\n验证 OpenAPI 规范...');
    const validation = generator.validateSpec();
    
    if (!validation.isValid) {
      console.error('❌ OpenAPI 规范验证失败:');
      validation.errors.forEach(error => {
        console.error(`  - ${error.code}: ${error.message}`);
      });
      process.exit(1);
    }

    if (validation.warnings.length > 0) {
      console.warn('⚠️  警告:');
      validation.warnings.forEach(warning => {
        console.warn(`  - ${warning.code}: ${warning.message}`);
        if (warning.suggestion) {
          console.warn(`    建议: ${warning.suggestion}`);
        }
      });
    }

    console.log('✅ OpenAPI 规范验证通过\n');

    // 4. 确保 docs/api 目录存在
    const docsApiDir = path.join(__dirname, '../../docs/api');
    await fs.mkdir(docsApiDir, { recursive: true });

    // 5. 写入 YAML 文件
    const yamlPath = path.join(docsApiDir, 'openapi.yaml');
    const yamlContent = generator.toYAML();
    await fs.writeFile(yamlPath, yamlContent, 'utf-8');
    console.log(`✅ 已生成: ${yamlPath}`);

    // 6. 写入 JSON 文件
    const jsonPath = path.join(docsApiDir, 'openapi.json');
    const jsonContent = generator.toJSON(true);
    await fs.writeFile(jsonPath, jsonContent, 'utf-8');
    console.log(`✅ 已生成: ${jsonPath}`);

    // 7. 生成 REST API 概览文档
    const overviewPath = path.join(docsApiDir, 'rest-api.md');
    const overviewContent = generateRESTAPIOverview(spec);
    await fs.writeFile(overviewPath, overviewContent, 'utf-8');
    console.log(`✅ 已生成: ${overviewPath}`);

    console.log('\n🎉 API 文档生成完成！');
    console.log('\n可用的文档文件:');
    console.log(`  - OpenAPI YAML: ${yamlPath}`);
    console.log(`  - OpenAPI JSON: ${jsonPath}`);
    console.log(`  - REST API 概览: ${overviewPath}`);

  } catch (error) {
    console.error('❌ 生成 API 文档失败:', error);
    process.exit(1);
  }
}

/**
 * 生成 REST API 概览文档内容
 * 
 * @param spec OpenAPI 规范对象
 * @returns Markdown 格式的概览文档
 */
function generateRESTAPIOverview(spec: any): string {
  const lines: string[] = [];

  // 文档头部
  lines.push('# REST API 概览\n');
  lines.push(`**版本**: ${spec.info.version}\n`);
  lines.push(`**最后更新**: ${new Date().toISOString().split('T')[0]}\n`);
  lines.push('---\n');

  // API 简介
  lines.push('## 简介\n');
  lines.push(`${spec.info.description}\n`);
  lines.push('本文档提供所有 REST API 端点的概览。详细的 API 规范请参考 [OpenAPI 规范](./openapi.yaml)。\n');

  // 服务器信息
  lines.push('## 服务器\n');
  spec.servers.forEach((server: any) => {
    lines.push(`- **${server.description}**: \`${server.url}\``);
  });
  lines.push('');

  // 认证
  lines.push('## 认证\n');
  lines.push('大部分 API 端点需要 JWT Bearer Token 认证。在请求头中包含：\n');
  lines.push('```');
  lines.push('Authorization: Bearer <your-jwt-token>');
  lines.push('```\n');
  lines.push('详细的认证流程请参考 [认证文档](./authentication.md)。\n');

  // 按标签分组端点
  lines.push('## API 端点\n');

  // 收集所有标签
  const tagMap = new Map<string, any[]>();
  
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    const methods = ['get', 'post', 'put', 'delete', 'patch'];
    
    methods.forEach(method => {
      const operation = (pathItem as any)[method];
      if (operation) {
        const tags = operation.tags || ['未分类'];
        tags.forEach((tag: string) => {
          if (!tagMap.has(tag)) {
            tagMap.set(tag, []);
          }
          tagMap.get(tag)!.push({
            method: method.toUpperCase(),
            path,
            operation
          });
        });
      }
    });
  }

  // 按标签输出端点
  for (const [tag, endpoints] of tagMap.entries()) {
    lines.push(`### ${tag}\n`);
    
    // 查找标签描述
    const tagInfo = spec.tags.find((t: any) => t.name === tag);
    if (tagInfo && tagInfo.description) {
      lines.push(`${tagInfo.description}\n`);
    }

    // 端点表格
    lines.push('| 方法 | 路径 | 描述 | 认证 |');
    lines.push('|------|------|------|------|');
    
    endpoints.forEach(endpoint => {
      const requiresAuth = endpoint.operation.security && endpoint.operation.security.length > 0;
      const authIcon = requiresAuth ? '🔒' : '🔓';
      const summary = endpoint.operation.summary || '无描述';
      
      lines.push(`| ${endpoint.method} | \`${endpoint.path}\` | ${summary} | ${authIcon} |`);
    });
    
    lines.push('');
  }

  // 通用响应格式
  lines.push('## 通用响应格式\n');
  lines.push('### 成功响应\n');
  lines.push('```json');
  lines.push(JSON.stringify({
    success: true,
    data: {},
    message: 'Operation completed successfully'
  }, null, 2));
  lines.push('```\n');

  lines.push('### 错误响应\n');
  lines.push('```json');
  lines.push(JSON.stringify({
    success: false,
    error: 'Error Type',
    message: 'Error description',
    details: ['Additional error details']
  }, null, 2));
  lines.push('```\n');

  // 常见状态码
  lines.push('## 常见 HTTP 状态码\n');
  lines.push('| 状态码 | 说明 |');
  lines.push('|--------|------|');
  lines.push('| 200 | 请求成功 |');
  lines.push('| 201 | 资源创建成功 |');
  lines.push('| 400 | 请求参数错误 |');
  lines.push('| 401 | 未认证或认证失败 |');
  lines.push('| 403 | 权限不足 |');
  lines.push('| 404 | 资源不存在 |');
  lines.push('| 500 | 服务器内部错误 |');
  lines.push('');

  // API 更新指南
  lines.push('## API 更新指南\n');
  lines.push('当 API 端点发生变更时，请遵循以下步骤更新文档：\n');
  lines.push('### 1. 更新路由文件中的 JSDoc 注释\n');
  lines.push('在路由处理器函数上添加或更新 JSDoc 注释，包括：\n');
  lines.push('- `@route` - 路由路径和方法');
  lines.push('- `@summary` - 端点简短描述');
  lines.push('- `@description` - 详细描述（可选）');
  lines.push('- `@tags` - 端点分类标签');
  lines.push('- `@param` - 请求参数说明');
  lines.push('- `@body` - 请求体说明');
  lines.push('- `@response` - 响应说明');
  lines.push('- `@auth` - 是否需要认证\n');
  lines.push('**示例**：\n');
  lines.push('```typescript');
  lines.push('/**');
  lines.push(' * @route POST /api/stocks/search');
  lines.push(' * @summary 搜索股票');
  lines.push(' * @description 根据关键词搜索股票代码和名称');
  lines.push(' * @tags Stocks');
  lines.push(' * @param {string} query.query - 搜索关键词');
  lines.push(' * @response 200 - 搜索结果列表');
  lines.push(' * @response 400 - 请求参数错误');
  lines.push(' * @auth');
  lines.push(' */');
  lines.push('router.post(\'/search\', async (req, res) => {');
  lines.push('  // 实现代码');
  lines.push('});');
  lines.push('```\n');

  lines.push('### 2. 重新生成 API 文档\n');
  lines.push('运行以下命令重新生成 API 文档：\n');
  lines.push('```bash');
  lines.push('npm run docs:generate');
  lines.push('```\n');
  lines.push('或者：\n');
  lines.push('```bash');
  lines.push('cd backend');
  lines.push('npx tsx scripts/generate-api-docs.ts');
  lines.push('```\n');

  lines.push('### 3. 验证生成的文档\n');
  lines.push('检查以下文件是否正确更新：\n');
  lines.push('- `docs/api/openapi.yaml` - OpenAPI 规范（YAML 格式）');
  lines.push('- `docs/api/openapi.json` - OpenAPI 规范（JSON 格式）');
  lines.push('- `docs/api/rest-api.md` - REST API 概览文档\n');

  lines.push('### 4. 提交变更\n');
  lines.push('将更新的路由文件和生成的文档一起提交到版本控制：\n');
  lines.push('```bash');
  lines.push('git add backend/src/routes/ docs/api/');
  lines.push('git commit -m "docs: update API documentation for [feature/endpoint]"');
  lines.push('```\n');

  lines.push('### 5. 代码审查清单\n');
  lines.push('在代码审查时，确保：\n');
  lines.push('- [ ] 所有新增或修改的端点都有完整的 JSDoc 注释');
  lines.push('- [ ] API 文档已重新生成并包含在 PR 中');
  lines.push('- [ ] 端点描述清晰准确');
  lines.push('- [ ] 请求参数和响应格式文档完整');
  lines.push('- [ ] 认证要求正确标注');
  lines.push('- [ ] 如有破坏性变更，已在 PR 描述中说明\n');

  // 相关资源
  lines.push('## 相关资源\n');
  lines.push('- [OpenAPI 规范 (YAML)](./openapi.yaml)');
  lines.push('- [OpenAPI 规范 (JSON)](./openapi.json)');
  lines.push('- [认证文档](./authentication.md)');
  lines.push('- [WebSocket 协议](./websocket.md)');
  lines.push('');

  return lines.join('\n');
}

// 运行主函数
generateAPIDocs();
