/**
 * OpenAPI 生成器单元测试
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  OpenAPIGenerator,
  PathItemObject,
  OperationObject,
  SchemaObject,
  TagObject,
  SecuritySchemeObject
} from './OpenAPIGenerator.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('OpenAPIGenerator', () => {
  let generator: OpenAPIGenerator;

  beforeEach(() => {
    generator = new OpenAPIGenerator();
  });

  describe('构造函数', () => {
    it('应该创建带有默认值的基础规范', () => {
      const spec = generator.getSpec();

      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info.title).toBe('Stock Analysis Platform API');
      expect(spec.info.version).toBe('1.0.0');
      expect(spec.info.description).toBe('RESTful API for stock analysis and portfolio management');
    });

    it('应该接受自定义标题、版本和描述', () => {
      const customGenerator = new OpenAPIGenerator(
        'Custom API',
        '2.0.0',
        'Custom description'
      );
      const spec = customGenerator.getSpec();

      expect(spec.info.title).toBe('Custom API');
      expect(spec.info.version).toBe('2.0.0');
      expect(spec.info.description).toBe('Custom description');
    });

    it('应该包含默认的服务器配置', () => {
      const spec = generator.getSpec();

      expect(spec.servers).toHaveLength(2);
      expect(spec.servers[0].url).toBe('http://localhost:3000');
      expect(spec.servers[1].url).toBe('https://api.example.com');
    });

    it('应该包含默认的 JWT Bearer 认证方案', () => {
      const spec = generator.getSpec();

      expect(spec.components.securitySchemes).toBeDefined();
      expect(spec.components.securitySchemes?.bearerAuth).toBeDefined();
      expect(spec.components.securitySchemes?.bearerAuth.type).toBe('http');
      expect(spec.components.securitySchemes?.bearerAuth.scheme).toBe('bearer');
    });

    it('应该初始化空的 paths 和 tags', () => {
      const spec = generator.getSpec();

      expect(spec.paths).toEqual({});
      expect(spec.tags).toEqual([]);
    });
  });

  describe('addPath', () => {
    it('应该添加路径项到规范', () => {
      const pathItem: PathItemObject = {
        get: {
          summary: 'Get stocks',
          tags: ['stocks'],
          responses: {
            '200': {
              description: 'Success'
            }
          }
        }
      };

      generator.addPath('/api/stocks', pathItem);
      const spec = generator.getSpec();

      expect(spec.paths['/api/stocks']).toBeDefined();
      expect(spec.paths['/api/stocks'].get?.summary).toBe('Get stocks');
    });

    it('应该支持添加多个 HTTP 方法', () => {
      const pathItem: PathItemObject = {
        get: {
          summary: 'Get stock',
          tags: ['stocks'],
          responses: { '200': { description: 'Success' } }
        },
        post: {
          summary: 'Create stock',
          tags: ['stocks'],
          responses: { '201': { description: 'Created' } }
        }
      };

      generator.addPath('/api/stocks', pathItem);
      const spec = generator.getSpec();

      expect(spec.paths['/api/stocks'].get).toBeDefined();
      expect(spec.paths['/api/stocks'].post).toBeDefined();
    });

    it('应该覆盖已存在的路径', () => {
      const pathItem1: PathItemObject = {
        get: {
          summary: 'Old summary',
          tags: ['stocks'],
          responses: { '200': { description: 'Success' } }
        }
      };

      const pathItem2: PathItemObject = {
        get: {
          summary: 'New summary',
          tags: ['stocks'],
          responses: { '200': { description: 'Success' } }
        }
      };

      generator.addPath('/api/stocks', pathItem1);
      generator.addPath('/api/stocks', pathItem2);
      const spec = generator.getSpec();

      expect(spec.paths['/api/stocks'].get?.summary).toBe('New summary');
    });
  });

  describe('addSchema', () => {
    it('应该添加 Schema 定义到组件', () => {
      const schema: SchemaObject = {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' }
        },
        required: ['id', 'name']
      };

      generator.addSchema('Stock', schema);
      const spec = generator.getSpec();

      expect(spec.components.schemas).toBeDefined();
      expect(spec.components.schemas?.Stock).toBeDefined();
      expect(spec.components.schemas?.Stock.type).toBe('object');
      expect(spec.components.schemas?.Stock.required).toEqual(['id', 'name']);
    });

    it('应该支持添加多个 Schema', () => {
      const stockSchema: SchemaObject = {
        type: 'object',
        properties: { symbol: { type: 'string' } }
      };

      const portfolioSchema: SchemaObject = {
        type: 'object',
        properties: { name: { type: 'string' } }
      };

      generator.addSchema('Stock', stockSchema);
      generator.addSchema('Portfolio', portfolioSchema);
      const spec = generator.getSpec();

      expect(spec.components.schemas?.Stock).toBeDefined();
      expect(spec.components.schemas?.Portfolio).toBeDefined();
    });
  });

  describe('addTag', () => {
    it('应该添加标签到规范', () => {
      const tag: TagObject = {
        name: 'stocks',
        description: 'Stock related endpoints'
      };

      generator.addTag(tag);
      const spec = generator.getSpec();

      expect(spec.tags).toHaveLength(1);
      expect(spec.tags[0].name).toBe('stocks');
      expect(spec.tags[0].description).toBe('Stock related endpoints');
    });

    it('应该防止添加重复的标签', () => {
      const tag: TagObject = {
        name: 'stocks',
        description: 'Stock related endpoints'
      };

      generator.addTag(tag);
      generator.addTag(tag);
      const spec = generator.getSpec();

      expect(spec.tags).toHaveLength(1);
    });

    it('应该允许添加不同名称的标签', () => {
      const tag1: TagObject = { name: 'stocks', description: 'Stocks' };
      const tag2: TagObject = { name: 'portfolio', description: 'Portfolio' };

      generator.addTag(tag1);
      generator.addTag(tag2);
      const spec = generator.getSpec();

      expect(spec.tags).toHaveLength(2);
    });
  });

  describe('addSecurityScheme', () => {
    it('应该添加安全方案到组件', () => {
      const scheme: SecuritySchemeObject = {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key'
      };

      generator.addSecurityScheme('apiKey', scheme);
      const spec = generator.getSpec();

      expect(spec.components.securitySchemes?.apiKey).toBeDefined();
      expect(spec.components.securitySchemes?.apiKey.type).toBe('apiKey');
    });
  });

  describe('addSecurityToOperation', () => {
    it('应该为操作添加默认的 bearerAuth 认证要求', () => {
      const operation: OperationObject = {
        summary: 'Get watchlist',
        tags: ['watchlist'],
        responses: {
          '200': { description: 'Success' }
        }
      };

      const securedOperation = generator.addSecurityToOperation(operation);

      expect(securedOperation.security).toBeDefined();
      expect(securedOperation.security).toHaveLength(1);
      expect(securedOperation.security?.[0].bearerAuth).toEqual([]);
    });

    it('应该支持自定义安全方案名称', () => {
      const operation: OperationObject = {
        summary: 'Get data',
        tags: ['data'],
        responses: {
          '200': { description: 'Success' }
        }
      };

      const securedOperation = generator.addSecurityToOperation(operation, 'apiKey');

      expect(securedOperation.security?.[0].apiKey).toBeDefined();
    });

    it('应该支持添加权限范围', () => {
      const operation: OperationObject = {
        summary: 'Admin operation',
        tags: ['admin'],
        responses: {
          '200': { description: 'Success' }
        }
      };

      const securedOperation = generator.addSecurityToOperation(
        operation,
        'bearerAuth',
        ['admin', 'write']
      );

      expect(securedOperation.security?.[0].bearerAuth).toEqual(['admin', 'write']);
    });

    it('应该防止添加重复的安全要求', () => {
      const operation: OperationObject = {
        summary: 'Get data',
        tags: ['data'],
        responses: {
          '200': { description: 'Success' }
        }
      };

      generator.addSecurityToOperation(operation);
      generator.addSecurityToOperation(operation);

      expect(operation.security).toHaveLength(1);
    });

    it('应该保留已存在的其他安全要求', () => {
      const operation: OperationObject = {
        summary: 'Get data',
        tags: ['data'],
        responses: {
          '200': { description: 'Success' }
        },
        security: [{ apiKey: [] }]
      };

      generator.addSecurityToOperation(operation, 'bearerAuth');

      expect(operation.security).toHaveLength(2);
      expect(operation.security?.[0]).toHaveProperty('apiKey');
      expect(operation.security?.[1]).toHaveProperty('bearerAuth');
    });
  });

  describe('addSecurityToPathItem', () => {
    it('应该为路径项的所有操作添加认证要求', () => {
      const pathItem: PathItemObject = {
        get: {
          summary: 'Get items',
          tags: ['items'],
          responses: { '200': { description: 'Success' } }
        },
        post: {
          summary: 'Create item',
          tags: ['items'],
          responses: { '201': { description: 'Created' } }
        },
        delete: {
          summary: 'Delete item',
          tags: ['items'],
          responses: { '204': { description: 'Deleted' } }
        }
      };

      const securedPathItem = generator.addSecurityToPathItem(pathItem);

      expect(securedPathItem.get?.security).toBeDefined();
      expect(securedPathItem.post?.security).toBeDefined();
      expect(securedPathItem.delete?.security).toBeDefined();
      expect(securedPathItem.get?.security?.[0].bearerAuth).toEqual([]);
    });

    it('应该只为存在的操作添加认证要求', () => {
      const pathItem: PathItemObject = {
        get: {
          summary: 'Get items',
          tags: ['items'],
          responses: { '200': { description: 'Success' } }
        }
      };

      const securedPathItem = generator.addSecurityToPathItem(pathItem);

      expect(securedPathItem.get?.security).toBeDefined();
      expect(securedPathItem.post).toBeUndefined();
    });

    it('应该支持自定义安全方案和权限范围', () => {
      const pathItem: PathItemObject = {
        get: {
          summary: 'Admin operation',
          tags: ['admin'],
          responses: { '200': { description: 'Success' } }
        }
      };

      const securedPathItem = generator.addSecurityToPathItem(
        pathItem,
        'bearerAuth',
        ['admin']
      );

      expect(securedPathItem.get?.security?.[0].bearerAuth).toEqual(['admin']);
    });
  });

  describe('validateSpec', () => {
    it('应该验证有效的规范', () => {
      const pathItem: PathItemObject = {
        get: {
          summary: 'Get stocks',
          tags: ['stocks'],
          responses: {
            '200': { description: 'Success' }
          }
        }
      };

      generator.addPath('/api/stocks', pathItem);
      const result = generator.validateSpec();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该在没有路径时发出警告', () => {
      const result = generator.validateSpec();

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.code === 'NO_PATHS')).toBe(true);
    });

    it('应该在路径没有操作时发出警告', () => {
      const pathItem: PathItemObject = {};

      generator.addPath('/api/stocks', pathItem);
      const result = generator.validateSpec();

      expect(result.warnings.some(w => w.code === 'EMPTY_PATH')).toBe(true);
    });

    it('应该在操作缺少 summary 时发出警告', () => {
      const pathItem: PathItemObject = {
        get: {
          summary: '',
          tags: ['stocks'],
          responses: {
            '200': { description: 'Success' }
          }
        }
      };

      generator.addPath('/api/stocks', pathItem);
      const result = generator.validateSpec();

      expect(result.warnings.some(w => w.code === 'MISSING_SUMMARY')).toBe(true);
    });

    it('应该在操作缺少响应时报错', () => {
      const pathItem: PathItemObject = {
        get: {
          summary: 'Get stocks',
          tags: ['stocks'],
          responses: {}
        }
      };

      generator.addPath('/api/stocks', pathItem);
      const result = generator.validateSpec();

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_RESPONSES')).toBe(true);
    });
  });

  describe('toJSON', () => {
    it('应该将规范转换为 JSON 字符串', () => {
      const json = generator.toJSON();
      const parsed = JSON.parse(json);

      expect(parsed.openapi).toBe('3.0.0');
      expect(parsed.info.title).toBe('Stock Analysis Platform API');
    });

    it('应该支持格式化输出', () => {
      const prettyJson = generator.toJSON(true);
      const compactJson = generator.toJSON(false);

      expect(prettyJson.length).toBeGreaterThan(compactJson.length);
      expect(prettyJson).toContain('\n');
      expect(compactJson).not.toContain('\n');
    });
  });

  describe('toYAML', () => {
    it('应该将规范转换为 YAML 字符串', () => {
      const yaml = generator.toYAML();

      expect(yaml).toContain('openapi: 3.0.0');
      expect(yaml).toContain('title: Stock Analysis Platform API');
    });

    it('应该正确处理嵌套对象', () => {
      const pathItem: PathItemObject = {
        get: {
          summary: 'Get stocks',
          tags: ['stocks'],
          responses: {
            '200': { description: 'Success' }
          }
        }
      };

      generator.addPath('/api/stocks', pathItem);
      const yaml = generator.toYAML();

      expect(yaml).toContain('paths:');
      expect(yaml).toContain('/api/stocks:');
      expect(yaml).toContain('get:');
    });
  });

  describe('边缘情况', () => {
    it('应该处理空字符串参数', () => {
      const emptyGenerator = new OpenAPIGenerator('', '', '');
      const spec = emptyGenerator.getSpec();

      expect(spec.info.title).toBe('');
      expect(spec.info.version).toBe('');
      expect(spec.info.description).toBe('');
    });

    it('应该处理包含特殊字符的路径', () => {
      const pathItem: PathItemObject = {
        get: {
          summary: 'Get stock',
          tags: ['stocks'],
          responses: { '200': { description: 'Success' } }
        }
      };

      generator.addPath('/api/stocks/{symbol}', pathItem);
      const spec = generator.getSpec();

      expect(spec.paths['/api/stocks/{symbol}']).toBeDefined();
    });

    it('应该处理复杂的 Schema 定义', () => {
      const complexSchema: SchemaObject = {
        type: 'object',
        properties: {
          id: { type: 'string' },
          nested: {
            type: 'object',
            properties: {
              value: { type: 'number' }
            }
          },
          array: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      };

      generator.addSchema('Complex', complexSchema);
      const spec = generator.getSpec();

      expect(spec.components.schemas?.Complex.properties?.nested).toBeDefined();
      expect(spec.components.schemas?.Complex.properties?.array).toBeDefined();
    });
  });

  describe('generateFromRoutes', () => {
    it('应该从路由目录生成 OpenAPI 规范', async () => {
      // 创建临时测试路由目录
      const testRoutesDir = path.join(process.cwd(), 'test-routes-openapi');
      await fs.mkdir(testRoutesDir, { recursive: true });

      try {
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

        // 生成 OpenAPI 规范
        const spec = await generator.generateFromRoutes(testRoutesDir);

        expect(spec.paths['/api/test']).toBeDefined();
        expect(spec.paths['/api/test'].get).toBeDefined();
        expect(spec.paths['/api/test'].get?.summary).toBe('测试端点');
      } finally {
        // 清理测试目录
        await fs.rm(testRoutesDir, { recursive: true, force: true });
      }
    });

    it('应该为端点添加默认响应', async () => {
      const testRoutesDir = path.join(process.cwd(), 'test-routes-openapi-2');
      await fs.mkdir(testRoutesDir, { recursive: true });

      try {
        const testRoute = `
import { Router } from 'express';
const router = Router();

/**
 * GET /api/data
 * 获取数据
 */
router.get('/data', async (req, res) => {
  res.json({ data: [] });
});

export default router;
`;

        await fs.writeFile(path.join(testRoutesDir, 'data.ts'), testRoute);

        const spec = await generator.generateFromRoutes(testRoutesDir);

        expect(spec.paths['/api/data'].get?.responses).toBeDefined();
        expect(spec.paths['/api/data'].get?.responses['200']).toBeDefined();
        expect(spec.paths['/api/data'].get?.responses['400']).toBeDefined();
        expect(spec.paths['/api/data'].get?.responses['500']).toBeDefined();
      } finally {
        await fs.rm(testRoutesDir, { recursive: true, force: true });
      }
    });

    it('应该为需要认证的端点添加安全要求', async () => {
      const testRoutesDir = path.join(process.cwd(), 'test-routes-openapi-3');
      await fs.mkdir(testRoutesDir, { recursive: true });

      try {
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

        const spec = await generator.generateFromRoutes(testRoutesDir);

        expect(spec.paths['/api/profile'].get?.security).toBeDefined();
        expect(spec.paths['/api/profile'].get?.security?.[0].bearerAuth).toEqual([]);
      } finally {
        await fs.rm(testRoutesDir, { recursive: true, force: true });
      }
    });

    it('应该自动添加标签', async () => {
      const testRoutesDir = path.join(process.cwd(), 'test-routes-openapi-4');
      await fs.mkdir(testRoutesDir, { recursive: true });

      try {
        const testRoute = `
import { Router } from 'express';
const router = Router();

/**
 * GET /api/stocks
 * 获取股票列表
 */
router.get('/stocks', async (req, res) => {
  res.json({ stocks: [] });
});

export default router;
`;

        await fs.writeFile(path.join(testRoutesDir, 'stocks.ts'), testRoute);

        const spec = await generator.generateFromRoutes(testRoutesDir);

        expect(spec.tags.length).toBeGreaterThan(0);
        expect(spec.tags.some((t: any) => t.name === 'Stocks')).toBe(true);
      } finally {
        await fs.rm(testRoutesDir, { recursive: true, force: true });
      }
    });

    it('应该处理带路径参数的端点', async () => {
      const testRoutesDir = path.join(process.cwd(), 'test-routes-openapi-5');
      await fs.mkdir(testRoutesDir, { recursive: true });

      try {
        const testRoute = `
import { Router } from 'express';
const router = Router();

/**
 * GET /api/stocks/:symbol
 * 获取股票详情
 */
router.get('/stocks/:symbol', async (req, res) => {
  res.json({ symbol: req.params.symbol });
});

export default router;
`;

        await fs.writeFile(path.join(testRoutesDir, 'stocks.ts'), testRoute);

        const spec = await generator.generateFromRoutes(testRoutesDir);

        expect(spec.paths['/api/stocks/:symbol'].get?.parameters).toBeDefined();
        expect(spec.paths['/api/stocks/:symbol'].get?.parameters?.length).toBeGreaterThan(0);
        
        const symbolParam = spec.paths['/api/stocks/:symbol'].get?.parameters?.find(
          (p: any) => p.name === 'symbol'
        );
        expect(symbolParam).toBeDefined();
        expect(symbolParam?.in).toBe('path');
        expect(symbolParam?.required).toBe(true);
      } finally {
        await fs.rm(testRoutesDir, { recursive: true, force: true });
      }
    });
  });
});
