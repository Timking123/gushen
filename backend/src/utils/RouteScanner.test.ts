/**
 * RouteScanner 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RouteScanner } from './RouteScanner.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('RouteScanner', () => {
  const testRoutesDir = path.join(process.cwd(), 'test-routes');

  beforeEach(async () => {
    // 创建测试路由目录
    await fs.mkdir(testRoutesDir, { recursive: true });
  });

  afterEach(async () => {
    // 清理测试路由目录
    try {
      await fs.rm(testRoutesDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('scanRoutes', () => {
    it('应该扫描并提取简单的 GET 路由', async () => {
      // 创建测试路由文件
      const testRoute = `
import { Router } from 'express';
const router = Router();

/**
 * GET /api/test
 * 测试端点
 */
router.get('/test', async (req, res) => {
  res.json({ success: true });
});

export default router;
`;

      await fs.writeFile(path.join(testRoutesDir, 'test.ts'), testRoute);

      const scanner = new RouteScanner(testRoutesDir);
      const endpoints = await scanner.scanRoutes();

      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].method).toBe('GET');
      expect(endpoints[0].path).toBe('/api/test');
      expect(endpoints[0].summary).toBe('测试端点');
      expect(endpoints[0].tags).toContain('Test');
    });

    it('应该提取路径参数', async () => {
      const testRoute = `
import { Router } from 'express';
const router = Router();

/**
 * GET /api/stocks/:symbol
 * 获取股票信息
 */
router.get('/stocks/:symbol', async (req, res) => {
  res.json({ symbol: req.params.symbol });
});

export default router;
`;

      await fs.writeFile(path.join(testRoutesDir, 'stocks.ts'), testRoute);

      const scanner = new RouteScanner(testRoutesDir);
      const endpoints = await scanner.scanRoutes();

      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].parameters).toBeDefined();
      expect(endpoints[0].parameters).toHaveLength(1);
      expect(endpoints[0].parameters![0].name).toBe('symbol');
      expect(endpoints[0].parameters![0].in).toBe('path');
      expect(endpoints[0].parameters![0].required).toBe(true);
    });

    it('应该提取多个路由方法', async () => {
      const testRoute = `
import { Router } from 'express';
const router = Router();

/**
 * GET /api/users
 * 获取用户列表
 */
router.get('/users', async (req, res) => {
  res.json({ users: [] });
});

/**
 * POST /api/users
 * 创建新用户
 */
router.post('/users', async (req, res) => {
  res.json({ success: true });
});

export default router;
`;

      await fs.writeFile(path.join(testRoutesDir, 'users.ts'), testRoute);

      const scanner = new RouteScanner(testRoutesDir);
      const endpoints = await scanner.scanRoutes();

      expect(endpoints).toHaveLength(2);
      expect(endpoints[0].method).toBe('GET');
      expect(endpoints[1].method).toBe('POST');
      expect(endpoints[0].path).toBe('/api/users');
      expect(endpoints[1].path).toBe('/api/users');
    });

    it('应该从 JSDoc 提取参数信息', async () => {
      const testRoute = `
import { Router } from 'express';
const router = Router();

/**
 * GET /api/search
 * 搜索功能
 * 
 * Query Parameters:
 * - q: 搜索关键词 (required)
 * - limit: 返回数量限制 (optional)
 */
router.get('/search', async (req, res) => {
  res.json({ results: [] });
});

export default router;
`;

      await fs.writeFile(path.join(testRoutesDir, 'search.ts'), testRoute);

      const scanner = new RouteScanner(testRoutesDir);
      const endpoints = await scanner.scanRoutes();

      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].parameters).toBeDefined();
      expect(endpoints[0].parameters!.length).toBeGreaterThanOrEqual(1);
      
      const qParam = endpoints[0].parameters!.find(p => p.name === 'q');
      expect(qParam).toBeDefined();
      expect(qParam!.description).toContain('搜索关键词');
    });

    it('应该识别需要认证的端点', async () => {
      const testRoute = `
import { Router } from 'express';
const router = Router();

/**
 * GET /api/profile
 * 获取用户资料
 * 需要 JWT token 认证
 */
router.get('/profile', async (req, res) => {
  res.json({ profile: {} });
});

export default router;
`;

      await fs.writeFile(path.join(testRoutesDir, 'profile.ts'), testRoute);

      const scanner = new RouteScanner(testRoutesDir);
      const endpoints = await scanner.scanRoutes();

      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].requiresAuth).toBe(true);
    });

    it('应该跳过测试文件和 index.ts', async () => {
      await fs.writeFile(
        path.join(testRoutesDir, 'test.test.ts'),
        'router.get("/test", () => {});'
      );
      await fs.writeFile(
        path.join(testRoutesDir, 'index.ts'),
        'export * from "./test";'
      );

      const scanner = new RouteScanner(testRoutesDir);
      const endpoints = await scanner.scanRoutes();

      expect(endpoints).toHaveLength(0);
    });

    it('应该处理空目录', async () => {
      const scanner = new RouteScanner(testRoutesDir);
      const endpoints = await scanner.scanRoutes();

      expect(endpoints).toHaveLength(0);
    });

    it('应该提取 Implements 需求信息', async () => {
      const testRoute = `
import { Router } from 'express';
const router = Router();

/**
 * GET /api/stocks/search
 * 搜索股票
 * Implements Requirement 1.1: Display matching stocks for user selection
 */
router.get('/stocks/search', async (req, res) => {
  res.json({ stocks: [] });
});

export default router;
`;

      await fs.writeFile(path.join(testRoutesDir, 'stocks.ts'), testRoute);

      const scanner = new RouteScanner(testRoutesDir);
      const endpoints = await scanner.scanRoutes();

      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].description).toContain('实现需求: 1.1');
    });

    it('应该处理多行路由定义', async () => {
      const testRoute = `
import { Router } from 'express';
const router = Router();

/**
 * POST /api/data
 * 提交数据
 */
router.post(
  '/data',
  validateMiddleware,
  async (req, res) => {
    res.json({ success: true });
  }
);

export default router;
`;

      await fs.writeFile(path.join(testRoutesDir, 'data.ts'), testRoute);

      const scanner = new RouteScanner(testRoutesDir);
      const endpoints = await scanner.scanRoutes();

      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].method).toBe('POST');
      expect(endpoints[0].path).toBe('/api/data');
    });
  });

  describe('formatTag', () => {
    it('应该正确格式化驼峰命名的文件名', async () => {
      const testRoute = `
import { Router } from 'express';
const router = Router();

/**
 * GET /api/test
 * 测试
 */
router.get('/test', async (req, res) => {
  res.json({});
});

export default router;
`;

      await fs.writeFile(path.join(testRoutesDir, 'userSettings.ts'), testRoute);

      const scanner = new RouteScanner(testRoutesDir);
      const endpoints = await scanner.scanRoutes();

      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].tags).toContain('User Settings');
    });
  });
});
