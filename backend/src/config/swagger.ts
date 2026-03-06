import { readFileSync } from 'fs';
import { join } from 'path';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';
import { logger } from '../utils/logger.js';

/**
 * 获取 OpenAPI 规范文件路径
 * 
 * @returns OpenAPI 规范文件的绝对路径
 */
function getOpenAPIPath(): string {
  // 从 backend 目录向上一级到项目根目录
  return join(process.cwd(), '..', 'docs', 'api', 'openapi.json');
}

/**
 * 配置 Swagger UI 中间件
 * 
 * 此函数设置 Swagger UI 以提供交互式 API 文档浏览。
 * 它从项目根目录的 docs/api/openapi.json 文件加载 OpenAPI 规范。
 * 
 * @param app - Express 应用实例
 * 
 * @example
 * ```typescript
 * import { createApp } from './app.js';
 * import { setupSwagger } from './config/swagger.js';
 * 
 * const app = createApp();
 * setupSwagger(app);
 * ```
 * 
 * 验证需求: 2.5
 */
export function setupSwagger(app: Express): void {
  try {
    // 从项目根目录加载 OpenAPI 规范
    const openapiPath = getOpenAPIPath();
    const openapiSpec = JSON.parse(readFileSync(openapiPath, 'utf-8'));

    // Swagger UI 配置选项
    const swaggerOptions = {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Smart Stock Analyzer API Documentation',
      swaggerOptions: {
        persistAuthorization: true, // 保持授权状态
        displayRequestDuration: true, // 显示请求持续时间
        filter: true, // 启用过滤功能
        tryItOutEnabled: true, // 默认启用 "Try it out"
      },
    };

    // 设置 Swagger UI 路由
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, swaggerOptions));

    logger.info('📚 Swagger UI configured at /api-docs');
  } catch (error) {
    logger.error('Failed to setup Swagger UI:', error);
    logger.warn('API documentation will not be available at /api-docs');
  }
}
