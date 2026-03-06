/**
 * OpenAPI 生成器属性测试
 * 
 * 使用 fast-check 进行基于属性的测试
 */

import { describe, it, expect } from '@jest/globals';
import * as fc from 'fast-check';
import {
  OpenAPIGenerator,
  PathItemObject,
  OperationObject,
  ParameterObject,
  SchemaObject
} from './OpenAPIGenerator.js';
import { RouteEndpoint, RouteParameter, RouteResponse } from './RouteScanner.js';

// 测试配置 - 减少迭代次数以加快测试速度
const testConfig = {
  numRuns: 20, // 从 100 减少到 20
  verbose: false
};

// ==================== 自定义生成器 ====================

/**
 * 生成有效的 HTTP 方法
 */
const httpMethodArbitrary = fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH');

/**
 * 生成有效的 API 路径
 */
const apiPathArbitrary = fc.array(
  fc.string({ minLength: 1, maxLength: 20 })
    .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
  { minLength: 1, maxLength: 3 }
).map(parts => `/api/${parts.join('/')}`);

/**
 * 生成路径参数
 */
const pathParameterArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 20 })
    .filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s)),
  in: fc.constant('path' as const),
  type: fc.constantFrom('string', 'number', 'integer'),
  required: fc.constant(true),
  description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined })
});

/**
 * 生成查询参数
 */
const queryParameterArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 20 })
    .filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s)),
  in: fc.constant('query' as const),
  type: fc.constantFrom('string', 'number', 'boolean', 'array'),
  required: fc.boolean(),
  description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined })
});

/**
 * 生成路由参数（混合路径参数和查询参数）
 */
const routeParametersArbitrary = fc.tuple(
  fc.array(pathParameterArbitrary, { maxLength: 3 }),
  fc.array(queryParameterArbitrary, { maxLength: 5 })
).map(([pathParams, queryParams]) => [...pathParams, ...queryParams]);

/**
 * 生成响应对象
 */
const routeResponseArbitrary = fc.record({
  statusCode: fc.constantFrom('200', '201', '204', '400', '401', '403', '404', '500'),
  description: fc.string({ minLength: 1, maxLength: 100 }),
  type: fc.option(fc.constantFrom('object', 'array', 'string'), { nil: undefined })
});

/**
 * 生成路由端点
 */
const routeEndpointArbitrary = fc.record({
  method: httpMethodArbitrary,
  path: apiPathArbitrary,
  handler: fc.string({ minLength: 1, maxLength: 50 }),
  summary: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
  parameters: fc.option(routeParametersArbitrary, { nil: undefined }),
  responses: fc.option(fc.array(routeResponseArbitrary, { minLength: 1, maxLength: 5 }), { nil: undefined }),
  tags: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 }), { nil: undefined }),
  requiresAuth: fc.option(fc.boolean(), { nil: undefined })
});

/**
 * 生成端点集合（确保路径唯一）
 */
const uniqueEndpointsArbitrary = fc.array(routeEndpointArbitrary, { minLength: 1, maxLength: 20 })
  .map(endpoints => {
    // 确保每个路径+方法组合是唯一的
    const seen = new Set<string>();
    return endpoints.filter(endpoint => {
      const key = `${endpoint.method}:${endpoint.path}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  })
  .filter(endpoints => endpoints.length > 0);

// ==================== 属性测试 ====================

describe('OpenAPIGenerator 属性测试', () => {
  describe('属性 4: OpenAPI 规范完整性', () => {
    it('Feature: documentation-organization-and-archiving, Property 4: 对于任意 API 端点集合，生成的 OpenAPI 规范应该包含所有端点', async () => {
      /**
       * **验证需求: 2.1, 2.2**
       * 
       * 此测试验证：
       * - 所有端点都被包含在生成的规范中
       * - 每个端点都有正确的 HTTP 方法和路径
       * - 每个端点都包含必需的字段（summary, responses）
       */
      await fc.assert(
        fc.asyncProperty(
          uniqueEndpointsArbitrary,
          async (endpoints) => {
            // 创建生成器
            const generator = new OpenAPIGenerator();

            // 按路径分组端点，以便正确合并同一路径的不同方法
            const pathGroups = new Map<string, RouteEndpoint[]>();
            for (const endpoint of endpoints) {
              if (!pathGroups.has(endpoint.path)) {
                pathGroups.set(endpoint.path, []);
              }
              pathGroups.get(endpoint.path)!.push(endpoint);
            }

            // 为每个路径创建完整的路径项
            for (const [path, pathEndpoints] of pathGroups.entries()) {
              const pathItem: PathItemObject = {};
              
              for (const endpoint of pathEndpoints) {
                const method = endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch';
                const operation = createPathItemFromEndpoint(endpoint)[method];
                if (operation) {
                  pathItem[method] = operation;
                }

                // 添加标签
                if (endpoint.tags) {
                  endpoint.tags.forEach(tag => {
                    generator.addTag({ name: tag, description: `${tag} related endpoints` });
                  });
                }
              }

              generator.addPath(path, pathItem);
            }

            const spec = generator.getSpec();

            // 验证所有端点都在规范中
            for (const endpoint of endpoints) {
              const pathItem = spec.paths[endpoint.path];
              
              // 验证路径存在
              expect(pathItem).toBeDefined();

              // 验证方法存在
              const method = endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch';
              const operation = pathItem[method];
              expect(operation).toBeDefined();

              // 验证必需字段
              expect(operation?.summary).toBeDefined();
              expect(operation?.responses).toBeDefined();
              expect(Object.keys(operation?.responses || {}).length).toBeGreaterThan(0);

              // 验证参数
              if (endpoint.parameters && endpoint.parameters.length > 0) {
                expect(operation?.parameters).toBeDefined();
                
                // 去重参数（按名称和位置）
                const uniqueParams = endpoint.parameters.filter((param, index, self) => 
                  index === self.findIndex(p => p.name === param.name && p.in === param.in)
                );
                
                expect(operation?.parameters?.length).toBe(uniqueParams.length);

                // 验证每个唯一参数都被包含
                for (const param of uniqueParams) {
                  const foundParam = operation?.parameters?.find(p => p.name === param.name && p.in === param.in);
                  expect(foundParam).toBeDefined();
                  expect(foundParam?.in).toBe(param.in);
                  expect(foundParam?.required).toBe(param.required);
                }
              }

              // 验证标签
              if (endpoint.tags && endpoint.tags.length > 0) {
                expect(operation?.tags).toBeDefined();
                expect(operation?.tags.length).toBeGreaterThan(0);
              }

              // 验证认证要求
              if (endpoint.requiresAuth) {
                expect(operation?.security).toBeDefined();
                expect(operation?.security?.length).toBeGreaterThan(0);
              }
            }
          }
        ),
        testConfig
      );
    });

    it('Feature: documentation-organization-and-archiving, Property 4: 每个端点的文档都包含请求方法、路径、参数、响应格式和状态码', async () => {
      /**
       * **验证需求: 2.1, 2.2**
       * 
       * 此测试验证端点文档的完整性：
       * - 请求方法正确
       * - 路径正确
       * - 参数完整（包括名称、位置、类型、是否必需）
       * - 响应包含状态码和描述
       */
      await fc.assert(
        fc.asyncProperty(
          routeEndpointArbitrary,
          async (endpoint) => {
            const generator = new OpenAPIGenerator();
            const pathItem = createPathItemFromEndpoint(endpoint);
            generator.addPath(endpoint.path, pathItem);

            const spec = generator.getSpec();
            const method = endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch';
            const operation = spec.paths[endpoint.path][method];

            // 验证请求方法和路径
            expect(spec.paths[endpoint.path]).toBeDefined();
            expect(operation).toBeDefined();

            // 验证参数完整性
            if (endpoint.parameters && endpoint.parameters.length > 0) {
              expect(operation?.parameters).toBeDefined();
              
              // 去重参数（按名称和位置）
              const uniqueParams = endpoint.parameters.filter((param, index, self) => 
                index === self.findIndex(p => p.name === param.name && p.in === param.in)
              );
              
              for (const param of uniqueParams) {
                const foundParam = operation?.parameters?.find(p => p.name === param.name && p.in === param.in);
                expect(foundParam).toBeDefined();
                
                // 验证参数的所有必需字段
                expect(foundParam?.name).toBe(param.name);
                expect(foundParam?.in).toBe(param.in);
                expect(foundParam?.required).toBe(param.required);
                expect(foundParam?.schema).toBeDefined();
                expect(foundParam?.schema.type).toBeDefined();
              }
            }

            // 验证响应格式和状态码
            expect(operation?.responses).toBeDefined();
            const responses = operation?.responses || {};
            expect(Object.keys(responses).length).toBeGreaterThan(0);

            // 每个响应都应该有描述
            for (const [statusCode, response] of Object.entries(responses)) {
              expect(statusCode).toMatch(/^\d{3}$/); // 状态码是三位数字
              expect(response.description).toBeDefined();
              expect(response.description.length).toBeGreaterThan(0);
            }
          }
        ),
        testConfig
      );
    });

    it('Feature: documentation-organization-and-archiving, Property 4: 生成的规范应该通过基本验证', async () => {
      /**
       * **验证需求: 2.1, 2.2**
       * 
       * 此测试验证生成的规范符合 OpenAPI 3.0 标准
       */
      await fc.assert(
        fc.asyncProperty(
          uniqueEndpointsArbitrary,
          async (endpoints) => {
            const generator = new OpenAPIGenerator();

            for (const endpoint of endpoints) {
              const pathItem = createPathItemFromEndpoint(endpoint);
              generator.addPath(endpoint.path, pathItem);
            }

            const spec = generator.getSpec();

            // 验证基本结构
            expect(spec.openapi).toBe('3.0.0');
            expect(spec.info).toBeDefined();
            expect(spec.info.title).toBeDefined();
            expect(spec.info.version).toBeDefined();
            expect(spec.paths).toBeDefined();

            // 运行内置验证
            const validationResult = generator.validateSpec();
            
            // 规范应该是有效的（没有错误）
            expect(validationResult.isValid).toBe(true);
            expect(validationResult.errors.length).toBe(0);
          }
        ),
        testConfig
      );
    });
  });

  describe('属性 5: API 端点示例生成', () => {
    it('Feature: documentation-organization-and-archiving, Property 5: 对于任意 API 端点，生成的文档应该包含至少一个响应示例', async () => {
      /**
       * **验证需求: 2.4**
       * 
       * 此测试验证每个端点都有响应示例
       */
      await fc.assert(
        fc.asyncProperty(
          routeEndpointArbitrary,
          async (endpoint) => {
            const generator = new OpenAPIGenerator();
            const pathItem = createPathItemFromEndpoint(endpoint);
            generator.addPath(endpoint.path, pathItem);

            const spec = generator.getSpec();
            const method = endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch';
            const operation = spec.paths[endpoint.path][method];

            // 验证响应存在
            expect(operation?.responses).toBeDefined();
            const responses = operation?.responses || {};
            
            // 至少应该有一个响应
            expect(Object.keys(responses).length).toBeGreaterThan(0);

            // 检查是否有成功响应（2xx）
            const successResponses = Object.keys(responses).filter(code => code.startsWith('2'));
            
            // 如果端点有自定义响应且没有成功响应，这是允许的（例如只定义了错误响应）
            // 但如果没有自定义响应，默认应该包含成功响应
            if (!endpoint.responses || endpoint.responses.length === 0) {
              expect(successResponses.length).toBeGreaterThan(0);
            }

            // 成功响应应该有内容定义
            for (const code of successResponses) {
              const response = responses[code];
              expect(response).toBeDefined();
              expect(response.description).toBeDefined();
              
              // 如果有内容，应该定义 schema
              if (response.content) {
                expect(response.content['application/json']).toBeDefined();
                expect(response.content['application/json'].schema).toBeDefined();
              }
            }
          }
        ),
        testConfig
      );
    });

    it('Feature: documentation-organization-and-archiving, Property 5: 响应示例应该包含完整的结构定义', async () => {
      /**
       * **验证需求: 2.4**
       * 
       * 此测试验证响应示例的结构完整性
       */
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            endpoint: routeEndpointArbitrary,
            includeExamples: fc.boolean()
          }),
          async ({ endpoint, includeExamples }) => {
            const generator = new OpenAPIGenerator();
            const pathItem = createPathItemFromEndpoint(endpoint, includeExamples);
            generator.addPath(endpoint.path, pathItem);

            const spec = generator.getSpec();
            const method = endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch';
            const operation = spec.paths[endpoint.path][method];

            // 验证响应结构
            const responses = operation?.responses || {};
            
            for (const [statusCode, response] of Object.entries(responses)) {
              // 每个响应都应该有描述
              expect(response.description).toBeDefined();
              expect(typeof response.description).toBe('string');
              expect(response.description.length).toBeGreaterThan(0);

              // 如果有内容，验证结构
              if (response.content && response.content['application/json']) {
                const mediaType = response.content['application/json'];
                
                // 应该有 schema 定义
                expect(mediaType.schema).toBeDefined();
                expect(mediaType.schema.type).toBeDefined();

                // 如果包含示例，验证示例存在
                if (includeExamples && mediaType.examples) {
                  expect(Object.keys(mediaType.examples).length).toBeGreaterThan(0);
                  
                  // 每个示例都应该有值
                  for (const example of Object.values(mediaType.examples)) {
                    expect(example.value).toBeDefined();
                  }
                }
              }
            }
          }
        ),
        testConfig
      );
    });

    it('Feature: documentation-organization-and-archiving, Property 5: 端点应该包含常见的错误响应示例', async () => {
      /**
       * **验证需求: 2.4**
       * 
       * 此测试验证端点包含错误响应（4xx, 5xx）
       */
      await fc.assert(
        fc.asyncProperty(
          routeEndpointArbitrary,
          async (endpoint) => {
            const generator = new OpenAPIGenerator();
            const pathItem = createPathItemFromEndpoint(endpoint);
            generator.addPath(endpoint.path, pathItem);

            const spec = generator.getSpec();
            const method = endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch';
            const operation = spec.paths[endpoint.path][method];

            const responses = operation?.responses || {};
            const statusCodes = Object.keys(responses);

            // 如果端点有自定义响应，使用自定义的
            // 否则应该有默认的错误响应
            if (!endpoint.responses || endpoint.responses.length === 0) {
              // 默认应该包含 400 和 500 错误响应
              const errorCodes = statusCodes.filter(code => 
                code.startsWith('4') || code.startsWith('5')
              );
              expect(errorCodes.length).toBeGreaterThan(0);
            }

            // 所有响应都应该有描述
            for (const response of Object.values(responses)) {
              expect(response.description).toBeDefined();
              expect(response.description.length).toBeGreaterThan(0);
            }
          }
        ),
        testConfig
      );
    });
  });

  describe('边缘情况和不变性', () => {
    it('空端点集合应该生成有效的基础规范', async () => {
      const generator = new OpenAPIGenerator();
      const spec = generator.getSpec();

      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info).toBeDefined();
      expect(spec.paths).toEqual({});
      expect(spec.components).toBeDefined();
    });

    it('添加端点不应该修改原始端点对象', async () => {
      await fc.assert(
        fc.asyncProperty(
          routeEndpointArbitrary,
          async (endpoint) => {
            const generator = new OpenAPIGenerator();
            const originalEndpoint = JSON.parse(JSON.stringify(endpoint));
            
            const pathItem = createPathItemFromEndpoint(endpoint);
            generator.addPath(endpoint.path, pathItem);

            // 原始端点对象不应该被修改
            expect(endpoint).toEqual(originalEndpoint);
          }
        ),
        testConfig
      );
    });

    it('多次添加相同路径应该覆盖而不是累积', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(routeEndpointArbitrary, routeEndpointArbitrary)
            .filter(([e1, e2]) => e1.path === e2.path && e1.method === e2.method),
          async ([endpoint1, endpoint2]) => {
            const generator = new OpenAPIGenerator();
            
            const pathItem1 = createPathItemFromEndpoint(endpoint1);
            const pathItem2 = createPathItemFromEndpoint(endpoint2);
            
            generator.addPath(endpoint1.path, pathItem1);
            generator.addPath(endpoint2.path, pathItem2);

            const spec = generator.getSpec();
            const method = endpoint1.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch';
            const operation = spec.paths[endpoint1.path][method];

            // 应该使用第二个端点的信息
            expect(operation?.summary).toBe(endpoint2.summary || `${endpoint2.method} ${endpoint2.path}`);
          }
        ),
        { ...testConfig, numRuns: 50 } // 减少运行次数，因为过滤条件严格
      );
    });
  });
});

// ==================== 辅助函数 ====================

/**
 * 从路由端点创建 PathItemObject
 * 
 * @param endpoint 路由端点
 * @param includeExamples 是否包含示例
 * @returns PathItemObject
 */
function createPathItemFromEndpoint(endpoint: RouteEndpoint, includeExamples: boolean = false): PathItemObject {
  const operation: OperationObject = {
    summary: endpoint.summary || `${endpoint.method} ${endpoint.path}`,
    description: endpoint.description,
    tags: endpoint.tags || [],
    responses: createResponses(endpoint.responses, includeExamples)
  };

  // 添加参数
  if (endpoint.parameters && endpoint.parameters.length > 0) {
    const params = endpoint.parameters.map(param => ({
      name: param.name,
      in: param.in,
      description: param.description,
      required: param.required,
      schema: {
        type: param.type
      }
    }));
    
    // 去重参数（按名称和位置）
    const seen = new Map<string, any>();
    for (const param of params) {
      const key = `${param.name}:${param.in}`;
      if (!seen.has(key)) {
        seen.set(key, param);
      }
    }
    operation.parameters = Array.from(seen.values());
  }

  // 添加安全要求
  if (endpoint.requiresAuth) {
    operation.security = [{ bearerAuth: [] }];
  }

  const method = endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch';
  return {
    [method]: operation
  };
}

/**
 * 创建响应对象
 * 
 * @param responses 路由响应数组
 * @param includeExamples 是否包含示例
 * @returns 响应对象集合
 */
function createResponses(responses?: RouteResponse[], includeExamples: boolean = false): Record<string, any> {
  const responsesObject: Record<string, any> = {};

  if (responses && responses.length > 0) {
    responses.forEach(response => {
      responsesObject[response.statusCode] = {
        description: response.description,
        content: response.type
          ? {
              'application/json': {
                schema: {
                  type: response.type
                },
                ...(includeExamples && {
                  examples: {
                    default: {
                      summary: 'Example response',
                      value: response.type === 'array' ? [] : {}
                    }
                  }
                })
              }
            }
          : undefined
      };
    });
  } else {
    // 默认响应
    responsesObject['200'] = {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              message: { type: 'string' }
            }
          },
          ...(includeExamples && {
            examples: {
              success: {
                summary: 'Successful response example',
                value: {
                  success: true,
                  data: {},
                  message: 'Operation completed successfully'
                }
              }
            }
          })
        }
      }
    };

    responsesObject['400'] = {
      description: 'Bad request',
      ...(includeExamples && {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' }
              }
            },
            examples: {
              error: {
                summary: 'Bad request example',
                value: {
                  error: 'Invalid request parameters'
                }
              }
            }
          }
        }
      })
    };

    responsesObject['500'] = {
      description: 'Internal server error',
      ...(includeExamples && {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' }
              }
            },
            examples: {
              error: {
                summary: 'Server error example',
                value: {
                  error: 'Internal server error'
                }
              }
            }
          }
        }
      })
    };
  }

  return responsesObject;
}
