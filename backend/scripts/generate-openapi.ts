/**
 * 生成 OpenAPI 规范文件
 * 
 * 此脚本扫描路由文件并生成 OpenAPI 3.0 规范
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { OpenAPIGenerator } from '../src/utils/OpenAPIGenerator.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateOpenAPISpec() {
  try {
    console.log('开始生成 OpenAPI 规范...');

    // 创建生成器实例
    const generator = new OpenAPIGenerator(
      'Stock Analysis Platform API',
      '1.0.0',
      'RESTful API for stock analysis and portfolio management'
    );

    // 扫描路由目录
    const routesDir = path.join(__dirname, '../src/routes');
    await generator.generateFromRoutes(routesDir);

    // 验证规范
    const validation = generator.validateSpec();
    console.log('\n验证结果:');
    console.log(`- 有效: ${validation.isValid}`);
    console.log(`- 错误数: ${validation.errors.length}`);
    console.log(`- 警告数: ${validation.warnings.length}`);

    if (validation.errors.length > 0) {
      console.log('\n错误:');
      validation.errors.forEach(error => {
        console.log(`  - [${error.code}] ${error.message}`);
      });
    }

    if (validation.warnings.length > 0) {
      console.log('\n警告:');
      validation.warnings.forEach(warning => {
        console.log(`  - [${warning.code}] ${warning.message}`);
        if (warning.suggestion) {
          console.log(`    建议: ${warning.suggestion}`);
        }
      });
    }

    // 确保输出目录存在
    const docsDir = path.join(__dirname, '../../docs/api');
    await fs.mkdir(docsDir, { recursive: true });

    // 生成 YAML 文件
    const yamlPath = path.join(docsDir, 'openapi.yaml');
    const yamlContent = generator.toYAML();
    await fs.writeFile(yamlPath, yamlContent, 'utf-8');
    console.log(`\n✓ YAML 规范已生成: ${yamlPath}`);

    // 生成 JSON 文件
    const jsonPath = path.join(docsDir, 'openapi.json');
    const jsonContent = generator.toJSON(true);
    await fs.writeFile(jsonPath, jsonContent, 'utf-8');
    console.log(`✓ JSON 规范已生成: ${jsonPath}`);

    // 统计信息
    const spec = generator.getSpec();
    const pathCount = Object.keys(spec.paths).length;
    const tagCount = spec.tags.length;
    const schemaCount = Object.keys(spec.components.schemas || {}).length;
    const securitySchemeCount = Object.keys(spec.components.securitySchemes || {}).length;

    console.log('\n统计信息:');
    console.log(`- 端点数量: ${pathCount}`);
    console.log(`- 标签数量: ${tagCount}`);
    console.log(`- Schema 数量: ${schemaCount}`);
    console.log(`- 安全方案数量: ${securitySchemeCount}`);

    // 统计需要认证的端点
    let authRequiredCount = 0;
    for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
      const methods = ['get', 'post', 'put', 'delete', 'patch'] as const;
      for (const method of methods) {
        const operation = pathItem[method];
        if (operation?.security && operation.security.length > 0) {
          authRequiredCount++;
        }
      }
    }
    console.log(`- 需要认证的端点: ${authRequiredCount}`);

    console.log('\n✓ OpenAPI 规范生成完成！');
  } catch (error) {
    console.error('生成 OpenAPI 规范失败:', error);
    process.exit(1);
  }
}

// 运行生成器
generateOpenAPISpec();
