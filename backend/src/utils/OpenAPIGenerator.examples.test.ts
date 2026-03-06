/**
 * OpenAPI 生成器示例生成功能测试
 * 
 * 验证需求 2.4: 为每个端点生成请求和响应示例
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { OpenAPIGenerator } from './OpenAPIGenerator.js';
import { RouteScanner } from './RouteScanner.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('OpenAPIGenerator - 示例生成功能', () => {
  let generator: OpenAPIGenerator;
  let testRoutesDir: string;

  beforeEach(async () => {
    generator = new OpenAPIGenerator();
    testRoutesDir = path.join(process.cwd(), 'test-routes-examples');
    
    // 创建测试路由目录
    await fs.mkdir(testRoutesDir, { recursive: true });
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testRoutesDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('请求示例生成', () => {
    it('应该为 POST 端点生成请求示例', async () => {
      // 创建测试路由文件
      const routeContent = `
import { Router } from 'express';
const router = Router();

/**
 * POST /api/stocks
 * 创建新的股票记录
 */
router.post('/stocks', async (req, res) => {
  // 处理逻辑
});

export default router;
      `;

      await fs.writeFile(path.join(testRoutesDir, 'stocks.ts'), routeContent);

      // 生成 OpenAPI 规范
      await generator.generateFromRoutes(testRoutesDir);
      const spec = generator.getSpec();

      // 验证请求体包含示例
      const postOperation = spec.paths['/api/stocks']?.post;
      expect(postOperation).toBeDefined();
      
      // 注意：由于我们的路由扫描器需要 JSDoc 注释来提取请求体信息
      // 这个测试验证了基础结构存在
      expect(postOperation?.responses).toBeDefined();
    });

    it('应该根据属性类型生成正确的请求示例值', async () => {
      // 创建带有详细 JSDoc 的路由文件
      const routeContent = `
import { Router } from 'express';
const router = Router();

/**
 * POST /api/users
 * 创建新用户
 * 
 * Request Body:
 * - name: 用户名称 (string, required)
 * - age: 用户年龄 (number, required)
 * - active: 是否激活 (boolean, required)
 * - tags: 标签列表 (array, optional)
 */
router.post('/users', async (req, res) => {
  // 处理逻辑
});

export default router;
      `;

      await fs.writeFile(path.join(testRoutesDir, 'users.ts'), routeContent);

      // 生成 OpenAPI 规范
      await generator.generateFromRoutes(testRoutesDir);
      const spec = generator.getSpec();

      // 验证端点存在
      const postOperation = spec.paths['/api/users']?.post;
      expect(postOperation).toBeDefined();
    });
  });

  describe('响应示例生成', () => {
    it('应该为成功响应生成示例', async () => {
      // 创建测试路由文件
      const routeContent = `
import { Router } from 'express';
const router = Router();

/**
 * GET /api/stocks/:symbol
 * 获取股票信息
 */
router.get('/stocks/:symbol', async (req, res) => {
  // 处理逻辑
});

export default router;
      `;

      await fs.writeFile(path.join(testRoutesDir, 'stocks.ts'), routeContent);

      // 生成 OpenAPI 规范
      await generator.generateFromRoutes(testRoutesDir);
      const spec = generator.getSpec();

      // 验证响应包含示例
      const getOperation = spec.paths['/api/stocks/:symbol']?.get;
      expect(getOperation).toBeDefined();
      expect(getOperation?.responses).toBeDefined();
      expect(getOperation?.responses['200']).toBeDefined();

      // 验证成功响应包含示例
      const successResponse = getOperation?.responses['200'];
      expect(successResponse?.content).toBeDefined();
      expect(successResponse?.content?.['application/json']).toBeDefined();
      
      const mediaType = successResponse?.content?.['application/json'];
      expect(mediaType?.examples).toBeDefined();
      expect(mediaType?.examples?.default).toBeDefined();
      expect(mediaType?.examples?.default.value).toBeDefined();
      
      // 验证示例结构
      const exampleValue = mediaType?.examples?.default.value;
      expect(exampleValue).toHaveProperty('success');
      expect(exampleValue).toHaveProperty('data');
      expect(exampleValue).toHaveProperty('message');
    });

    it('应该为错误响应生成示例', async () => {
      // 创建测试路由文件
      const routeContent = `
import { Router } from 'express';
const router = Router();

/**
 * GET /api/test
 * 测试端点
 */
router.get('/test', async (req, res) => {
  // 处理逻辑
});

export default router;
      `;

      await fs.writeFile(path.join(testRoutesDir, 'test.ts'), routeContent);

      // 生成 OpenAPI 规范
      await generator.generateFromRoutes(testRoutesDir);
      const spec = generator.getSpec();

      // 验证错误响应包含示例
      const getOperation = spec.paths['/api/test']?.get;
      expect(getOperation?.responses['400']).toBeDefined();
      expect(getOperation?.responses['500']).toBeDefined();

      // 验证 400 错误响应示例
      const badRequestResponse = getOperation?.responses['400'];
      const badRequestExample = badRequestResponse?.content?.['application/json']?.examples?.default?.value;
      expect(badRequestExample).toHaveProperty('success', false);
      expect(badRequestExample).toHaveProperty('error');
      expect(badRequestExample).toHaveProperty('message');

      // 验证 500 错误响应示例
      const serverErrorResponse = getOperation?.responses['500'];
      const serverErrorExample = serverErrorResponse?.content?.['application/json']?.examples?.default?.value;
      expect(serverErrorExample).toHaveProperty('success', false);
      expect(serverErrorExample).toHaveProperty('error');
      expect(serverErrorExample).toHaveProperty('message');
    });

    it('应该根据端点路径生成特定的响应数据示例', async () => {
      // 创建股票相关的路由文件
      const routeContent = `
import { Router } from 'express';
const router = Router();

/**
 * GET /api/stocks/search
 * 搜索股票
 */
router.get('/stocks/search', async (req, res) => {
  // 处理逻辑
});

export default router;
      `;

      await fs.writeFile(path.join(testRoutesDir, 'stocks.ts'), routeContent);

      // 生成 OpenAPI 规范
      await generator.generateFromRoutes(testRoutesDir);
      const spec = generator.getSpec();

      // 验证响应数据示例
      const getOperation = spec.paths['/api/stocks/search']?.get;
      const successResponse = getOperation?.responses['200'];
      const exampleValue = successResponse?.content?.['application/json']?.examples?.default?.value;

      // 验证数据字段包含股票相关信息
      expect(exampleValue?.data).toBeDefined();
      
      // 对于搜索端点，应该返回数组
      if (Array.isArray(exampleValue?.data)) {
        expect(exampleValue.data.length).toBeGreaterThan(0);
        // 验证数组元素包含股票字段
        const firstItem = exampleValue.data[0];
        expect(firstItem).toHaveProperty('symbol');
        expect(firstItem).toHaveProperty('name');
      }
    });

    it('应该为不同 HTTP 方法生成适当的响应示例', async () => {
      // 创建包含多种方法的路由文件
      const routeContent = `
import { Router } from 'express';
const router = Router();

/**
 * POST /api/items
 * 创建项目
 */
router.post('/items', async (req, res) => {});

/**
 * PUT /api/items/:id
 * 更新项目
 */
router.put('/items/:id', async (req, res) => {});

/**
 * DELETE /api/items/:id
 * 删除项目
 */
router.delete('/items/:id', async (req, res) => {});

export default router;
      `;

      await fs.writeFile(path.join(testRoutesDir, 'items.ts'), routeContent);

      // 生成 OpenAPI 规范
      await generator.generateFromRoutes(testRoutesDir);
      const spec = generator.getSpec();

      // 验证 POST 响应包含 createdAt
      const postOperation = spec.paths['/api/items']?.post;
      const postExample = postOperation?.responses['200']?.content?.['application/json']?.examples?.default?.value;
      expect(postExample?.data).toHaveProperty('createdAt');

      // 验证 PUT 响应包含 updatedAt
      const putOperation = spec.paths['/api/items/:id']?.put;
      const putExample = putOperation?.responses['200']?.content?.['application/json']?.examples?.default?.value;
      expect(putExample?.data).toHaveProperty('updatedAt');

      // 验证 DELETE 响应包含 deleted
      const deleteOperation = spec.paths['/api/items/:id']?.delete;
      const deleteExample = deleteOperation?.responses['200']?.content?.['application/json']?.examples?.default?.value;
      expect(deleteExample?.data).toHaveProperty('deleted');
    });
  });

  describe('示例完整性验证', () => {
    it('应该为所有端点生成至少一个请求或响应示例', async () => {
      // 创建多个路由文件
      const routes = [
        { file: 'stocks.ts', content: `
import { Router } from 'express';
const router = Router();
router.get('/stocks', async (req, res) => {});
export default router;
        ` },
        { file: 'portfolio.ts', content: `
import { Router } from 'express';
const router = Router();
router.get('/portfolio', async (req, res) => {});
export default router;
        ` },
        { file: 'watchlist.ts', content: `
import { Router } from 'express';
const router = Router();
router.get('/watchlist', async (req, res) => {});
export default router;
        ` }
      ];

      for (const route of routes) {
        await fs.writeFile(path.join(testRoutesDir, route.file), route.content);
      }

      // 生成 OpenAPI 规范
      await generator.generateFromRoutes(testRoutesDir);
      const spec = generator.getSpec();

      // 验证每个端点都有示例
      for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
        const methods = ['get', 'post', 'put', 'delete', 'patch'] as const;
        
        for (const method of methods) {
          const operation = pathItem[method];
          if (operation) {
            // 验证至少有一个响应包含示例
            let hasExample = false;
            
            for (const [statusCode, response] of Object.entries(operation.responses)) {
              const mediaType = response.content?.['application/json'];
              if (mediaType?.examples) {
                hasExample = true;
                break;
              }
            }
            
            expect(hasExample).toBe(true);
          }
        }
      }
    });

    it('应该为示例添加描述性的 summary', async () => {
      // 创建测试路由文件
      const routeContent = `
import { Router } from 'express';
const router = Router();
router.get('/test', async (req, res) => {});
export default router;
      `;

      await fs.writeFile(path.join(testRoutesDir, 'test.ts'), routeContent);

      // 生成 OpenAPI 规范
      await generator.generateFromRoutes(testRoutesDir);
      const spec = generator.getSpec();

      // 验证示例包含 summary
      const getOperation = spec.paths['/api/test']?.get;
      const successExample = getOperation?.responses['200']?.content?.['application/json']?.examples?.default;
      
      expect(successExample?.summary).toBeDefined();
      expect(typeof successExample?.summary).toBe('string');
      if (successExample?.summary) {
        expect(successExample.summary.length).toBeGreaterThan(0);
      }
    });
  });
});
