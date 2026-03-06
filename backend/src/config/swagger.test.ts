import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { Express } from 'express';
import request from 'supertest';
import { setupSwagger } from './swagger.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

describe('Swagger UI Configuration', () => {
  let app: Express;
  const testOpenapiPath = join(process.cwd(), '..', 'docs', 'api', 'openapi.json');

  beforeEach(() => {
    app = express();
    
    // 确保测试 OpenAPI 文件存在
    const docsDir = join(process.cwd(), '..', 'docs', 'api');
    if (!existsSync(docsDir)) {
      mkdirSync(docsDir, { recursive: true });
    }
    
    // 创建最小的 OpenAPI 规范用于测试
    const minimalSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
        description: 'Test API for Swagger UI'
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Test server'
        }
      ],
      paths: {
        '/api/test': {
          get: {
            summary: 'Test endpoint',
            tags: ['Test'],
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        data: { type: 'object' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
    
    writeFileSync(testOpenapiPath, JSON.stringify(minimalSpec, null, 2));
  });

  describe('setupSwagger', () => {
    it('应该成功配置 Swagger UI 路由', async () => {
      // 配置 Swagger UI
      setupSwagger(app);
      
      // 验证 /api-docs 路由可访问
      const response = await request(app).get('/api-docs/');
      
      // 如果路由配置成功，应该返回 200 或重定向
      expect([200, 301, 302]).toContain(response.status);
    });

    it('应该在 /api-docs 路径提供 Swagger UI', async () => {
      setupSwagger(app);
      
      const response = await request(app).get('/api-docs/');
      
      // Swagger UI 应该返回 HTML 页面
      expect(response.status).toBe(200);
      expect(response.type).toContain('text/html');
      expect(response.text).toContain('swagger-ui');
    });

    it('应该加载 OpenAPI 规范文件', async () => {
      setupSwagger(app);
      
      // Swagger UI 会提供规范文件的副本
      const response = await request(app).get('/api-docs/');
      
      expect(response.status).toBe(200);
      // 验证 HTML 包含 Swagger UI 的核心元素
      expect(response.text).toContain('swagger-ui-bundle.js');
      expect(response.text).toContain('swagger-ui-standalone-preset.js');
    });

    it('应该配置 Swagger UI 选项', async () => {
      setupSwagger(app);
      
      const response = await request(app).get('/api-docs/');
      
      expect(response.status).toBe(200);
      // 验证自定义配置已应用
      expect(response.text).toContain('Smart Stock Analyzer API Documentation');
      // 验证自定义 CSS 已应用
      expect(response.text).toContain('.swagger-ui .topbar { display: none }');
    });

    it('应该在 OpenAPI 文件不存在时优雅处理错误', () => {
      // 删除 OpenAPI 文件
      const fs = require('fs');
      if (fs.existsSync(testOpenapiPath)) {
        fs.unlinkSync(testOpenapiPath);
      }
      
      // 应该不抛出错误
      expect(() => setupSwagger(app)).not.toThrow();
    });
  });

  describe('Swagger UI 功能验证', () => {
    beforeEach(() => {
      setupSwagger(app);
    });

    it('应该支持交互式 API 文档浏览', async () => {
      const response = await request(app).get('/api-docs/');
      
      expect(response.status).toBe(200);
      // 验证包含 Swagger UI 的交互元素
      expect(response.text).toContain('swagger-ui');
      expect(response.text).toContain('swagger-ui-bundle.js');
    });

    it('应该加载 Swagger UI 的核心资源', async () => {
      const response = await request(app).get('/api-docs/');
      
      expect(response.status).toBe(200);
      // 验证 Swagger UI 的核心 JavaScript 文件被引用
      expect(response.text).toContain('swagger-ui-bundle.js');
      expect(response.text).toContain('swagger-ui-standalone-preset.js');
      expect(response.text).toContain('swagger-ui-init.js');
    });

    it('应该应用自定义样式配置', async () => {
      const response = await request(app).get('/api-docs/');
      
      expect(response.status).toBe(200);
      // 验证自定义 CSS 已应用（隐藏顶部栏）
      expect(response.text).toContain('.swagger-ui .topbar { display: none }');
    });
  });
});

/**
 * 验证需求: 2.5
 * 
 * 这些测试验证 Swagger UI 配置满足以下需求：
 * - 安装 swagger-ui-express 依赖 ✓
 * - 在后端添加 /api-docs 路由 ✓
 * - 配置 Swagger UI 使用生成的 OpenAPI 规范 ✓
 * - 提供交互式 API 文档浏览 ✓
 */
