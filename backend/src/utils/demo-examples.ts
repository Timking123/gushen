/**
 * OpenAPI 示例生成功能演示脚本
 * 
 * 此脚本演示如何使用 OpenAPIGenerator 生成包含请求和响应示例的 API 文档
 */

import { OpenAPIGenerator } from './OpenAPIGenerator.js';
import * as path from 'path';
import * as fs from 'fs/promises';

async function demonstrateExampleGeneration() {
  console.log('=== OpenAPI 示例生成功能演示 ===\n');

  // 创建生成器实例
  const generator = new OpenAPIGenerator(
    'Stock Analysis API',
    '1.0.0',
    'API with request and response examples'
  );

  // 假设我们有一个路由目录
  const routesDir = path.join(process.cwd(), 'src', 'routes');

  try {
    // 检查路由目录是否存在
    await fs.access(routesDir);
    
    console.log(`正在扫描路由目录: ${routesDir}\n`);

    // 生成 OpenAPI 规范
    const spec = await generator.generateFromRoutes(routesDir);

    console.log('✓ OpenAPI 规范生成成功\n');
    console.log(`发现 ${Object.keys(spec.paths).length} 个 API 路径\n`);

    // 展示一些示例
    console.log('=== 示例展示 ===\n');

    for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
      console.log(`路径: ${pathKey}`);

      // 检查每个 HTTP 方法
      const methods = ['get', 'post', 'put', 'delete', 'patch'] as const;
      
      for (const method of methods) {
        const operation = pathItem[method];
        if (operation) {
          console.log(`  ${method.toUpperCase()} 方法:`);

          // 显示请求示例
          if (operation.requestBody?.content?.['application/json']?.examples) {
            const requestExample = operation.requestBody.content['application/json'].examples.default;
            console.log(`    请求示例: ${requestExample.summary}`);
            console.log(`    ${JSON.stringify(requestExample.value, null, 2).split('\n').join('\n    ')}`);
          }

          // 显示响应示例
          for (const [statusCode, response] of Object.entries(operation.responses)) {
            const mediaType = response.content?.['application/json'];
            if (mediaType?.examples?.default) {
              const responseExample = mediaType.examples.default;
              console.log(`    响应示例 (${statusCode}): ${responseExample.summary}`);
              console.log(`    ${JSON.stringify(responseExample.value, null, 2).split('\n').join('\n    ')}`);
            }
          }
        }
      }
      console.log('');
    }

    // 保存到文件
    const outputPath = path.join(process.cwd(), 'docs', 'api', 'openapi-with-examples.json');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, generator.toJSON(true));

    console.log(`\n✓ OpenAPI 规范已保存到: ${outputPath}`);
    console.log('\n提示: 您可以使用 Swagger UI 查看完整的 API 文档和示例');

  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('路由目录不存在，跳过演示');
      console.log('\n功能说明:');
      console.log('- 为每个 API 端点自动生成请求示例');
      console.log('- 为每个 API 端点生成成功和错误响应示例');
      console.log('- 根据端点路径和方法智能推断示例数据');
      console.log('- 所有示例都包含在 OpenAPI 规范的 examples 字段中');
    } else {
      console.error('演示过程中出错:', error);
    }
  }
}

// 运行演示
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateExampleGeneration().catch(console.error);
}

export { demonstrateExampleGeneration };
