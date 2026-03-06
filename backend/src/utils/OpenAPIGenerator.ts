/**
 * OpenAPI 规范生成器
 * 
 * 负责从路由定义和 JSDoc 注释生成 OpenAPI 3.0 规范
 */

import { RouteScanner, RouteEndpoint, RouteResponse } from './RouteScanner.js';
import { logger } from './logger.js';

// ==================== OpenAPI 数据模型接口 ====================

/**
 * OpenAPI 3.0 规范根对象
 */
export interface OpenAPISpec {
  openapi: '3.0.0';
  info: InfoObject;
  servers: ServerObject[];
  paths: PathsObject;
  components: ComponentsObject;
  tags: TagObject[];
}

/**
 * API 信息对象
 */
export interface InfoObject {
  title: string;
  version: string;
  description: string;
  contact?: ContactObject;
}

/**
 * 联系信息对象
 */
export interface ContactObject {
  name: string;
  email: string;
}

/**
 * 服务器对象
 */
export interface ServerObject {
  url: string;
  description: string;
}

/**
 * 路径对象集合
 */
export interface PathsObject {
  [path: string]: PathItemObject;
}

/**
 * 路径项对象，包含各种 HTTP 方法的操作
 */
export interface PathItemObject {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  delete?: OperationObject;
  patch?: OperationObject;
}

/**
 * 操作对象，描述单个 API 端点
 */
export interface OperationObject {
  summary: string;
  description?: string;
  tags: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: ResponsesObject;
  security?: SecurityRequirementObject[];
}

/**
 * 参数对象
 */
export interface ParameterObject {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  description?: string;
  required: boolean;
  schema: SchemaObject;
}

/**
 * 请求体对象
 */
export interface RequestBodyObject {
  description?: string;
  required: boolean;
  content: ContentObject;
}

/**
 * 响应对象集合
 */
export interface ResponsesObject {
  [statusCode: string]: ResponseObject;
}

/**
 * 响应对象
 */
export interface ResponseObject {
  description: string;
  content?: ContentObject;
}

/**
 * 内容对象，按媒体类型组织
 */
export interface ContentObject {
  [mediaType: string]: MediaTypeObject;
}

/**
 * 媒体类型对象
 */
export interface MediaTypeObject {
  schema: SchemaObject;
  examples?: ExamplesObject;
}

/**
 * 示例对象集合
 */
export interface ExamplesObject {
  [exampleName: string]: ExampleObject;
}

/**
 * 示例对象
 */
export interface ExampleObject {
  summary?: string;
  description?: string;
  value: any;
}

/**
 * Schema 对象，描述数据结构
 */
export interface SchemaObject {
  type?: string;
  properties?: { [propertyName: string]: SchemaObject };
  required?: string[];
  items?: SchemaObject;
  enum?: any[];
  format?: string;
  description?: string;
  example?: any;
  $ref?: string;
}

/**
 * 组件对象，包含可重用的定义
 */
export interface ComponentsObject {
  schemas?: { [schemaName: string]: SchemaObject };
  securitySchemes?: { [schemeName: string]: SecuritySchemeObject };
}

/**
 * 安全方案对象
 */
export interface SecuritySchemeObject {
  type: 'http' | 'apiKey' | 'oauth2' | 'openIdConnect';
  scheme?: string;
  bearerFormat?: string;
  in?: 'query' | 'header' | 'cookie';
  name?: string;
}

/**
 * 安全要求对象
 */
export interface SecurityRequirementObject {
  [schemeName: string]: string[];
}

/**
 * 标签对象
 */
export interface TagObject {
  name: string;
  description: string;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * 验证错误
 */
export interface ValidationError {
  code: string;
  message: string;
  location?: {
    file: string;
    line: number;
    column: number;
  };
}

/**
 * 验证警告
 */
export interface ValidationWarning {
  code: string;
  message: string;
  suggestion?: string;
  location?: {
    file: string;
    line: number;
    column: number;
  };
}


// ==================== OpenAPI 生成器类 ====================

/**
 * OpenAPI 规范生成器
 * 
 * 负责创建和管理 OpenAPI 3.0 规范对象
 */
export class OpenAPIGenerator {
  private spec: OpenAPISpec;

  /**
   * 创建 OpenAPI 生成器实例
   * 
   * @param title API 标题
   * @param version API 版本
   * @param description API 描述
   */
  constructor(
    title: string = 'Stock Analysis Platform API',
    version: string = '1.0.0',
    description: string = 'RESTful API for stock analysis and portfolio management'
  ) {
    this.spec = this.createBaseSpec(title, version, description);
  }

  /**
   * 创建基础 OpenAPI 规范对象
   * 
   * @param title API 标题
   * @param version API 版本
   * @param description API 描述
   * @returns 基础 OpenAPI 规范对象
   */
  private createBaseSpec(
    title: string,
    version: string,
    description: string
  ): OpenAPISpec {
    return {
      openapi: '3.0.0',
      info: {
        title,
        version,
        description,
        contact: {
          name: 'API Support',
          email: 'support@example.com'
        }
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server'
        },
        {
          url: 'https://api.example.com',
          description: 'Production server'
        }
      ],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      },
      tags: []
    };
  }

  /**
   * 获取当前的 OpenAPI 规范对象
   * 
   * @returns OpenAPI 规范对象
   */
  getSpec(): OpenAPISpec {
    return this.spec;
  }

  /**
   * 添加路径项到规范
   * 
   * @param path 路径字符串（如 '/api/stocks'）
   * @param pathItem 路径项对象
   */
  addPath(path: string, pathItem: PathItemObject): void {
    this.spec.paths[path] = pathItem;
  }

  /**
   * 添加 Schema 定义到组件
   * 
   * @param name Schema 名称
   * @param schema Schema 对象
   */
  addSchema(name: string, schema: SchemaObject): void {
    if (!this.spec.components.schemas) {
      this.spec.components.schemas = {};
    }
    this.spec.components.schemas[name] = schema;
  }

  /**
   * 添加标签到规范
   * 
   * @param tag 标签对象
   */
  addTag(tag: TagObject): void {
    // 检查标签是否已存在
    const exists = this.spec.tags.some(t => t.name === tag.name);
    if (!exists) {
      this.spec.tags.push(tag);
    }
  }

  /**
   * 为操作添加认证要求
   * 
   * @param operation 操作对象
   * @param schemeName 安全方案名称（默认为 'bearerAuth'）
   * @param scopes 所需的权限范围（可选）
   * @returns 添加了安全要求的操作对象
   */
  addSecurityToOperation(
    operation: OperationObject,
    schemeName: string = 'bearerAuth',
    scopes: string[] = []
  ): OperationObject {
    if (!operation.security) {
      operation.security = [];
    }
    
    // 检查是否已存在相同的安全要求
    const exists = operation.security.some(
      req => req[schemeName] !== undefined
    );
    
    if (!exists) {
      operation.security.push({ [schemeName]: scopes });
    }
    
    return operation;
  }

  /**
   * 批量为路径项的所有操作添加认证要求
   * 
   * @param pathItem 路径项对象
   * @param schemeName 安全方案名称（默认为 'bearerAuth'）
   * @param scopes 所需的权限范围（可选）
   * @returns 添加了安全要求的路径项对象
   */
  addSecurityToPathItem(
    pathItem: PathItemObject,
    schemeName: string = 'bearerAuth',
    scopes: string[] = []
  ): PathItemObject {
    const methods: (keyof PathItemObject)[] = ['get', 'post', 'put', 'delete', 'patch'];
    
    methods.forEach(method => {
      const operation = pathItem[method];
      if (operation) {
        this.addSecurityToOperation(operation, schemeName, scopes);
      }
    });
    
    return pathItem;
  }

  /**
   * 添加安全方案到组件
   * 
   * @param name 安全方案名称
   * @param scheme 安全方案对象
   */
  addSecurityScheme(name: string, scheme: SecuritySchemeObject): void {
    if (!this.spec.components.securitySchemes) {
      this.spec.components.securitySchemes = {};
    }
    this.spec.components.securitySchemes[name] = scheme;
  }


  /**
   * 验证 OpenAPI 规范的有效性
   * 
   * @returns 验证结果
   */
  validateSpec(): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 验证基本信息
    if (!this.spec.info.title) {
      errors.push({
        code: 'MISSING_TITLE',
        message: 'API title is required'
      });
    }

    if (!this.spec.info.version) {
      errors.push({
        code: 'MISSING_VERSION',
        message: 'API version is required'
      });
    }

    // 验证路径
    if (Object.keys(this.spec.paths).length === 0) {
      warnings.push({
        code: 'NO_PATHS',
        message: 'No API paths defined',
        suggestion: 'Add at least one API endpoint'
      });
    }

    // 验证每个路径项
    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      const operations = [
        pathItem.get,
        pathItem.post,
        pathItem.put,
        pathItem.delete,
        pathItem.patch
      ].filter(Boolean);

      if (operations.length === 0) {
        warnings.push({
          code: 'EMPTY_PATH',
          message: `Path ${path} has no operations defined`,
          suggestion: 'Add at least one HTTP method operation'
        });
      }

      // 验证每个操作
      operations.forEach(operation => {
        if (operation) {
          if (!operation.summary) {
            warnings.push({
              code: 'MISSING_SUMMARY',
              message: `Operation in path ${path} is missing summary`,
              suggestion: 'Add a summary to describe the operation'
            });
          }

          if (!operation.responses || Object.keys(operation.responses).length === 0) {
            errors.push({
              code: 'MISSING_RESPONSES',
              message: `Operation in path ${path} has no responses defined`
            });
          }
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 将 OpenAPI 规范转换为 JSON 字符串
   * 
   * @param pretty 是否格式化输出
   * @returns JSON 字符串
   */
  toJSON(pretty: boolean = true): string {
    return pretty
      ? JSON.stringify(this.spec, null, 2)
      : JSON.stringify(this.spec);
  }

  /**
   * 将 OpenAPI 规范转换为 YAML 字符串
   * 注意：此方法需要 yaml 库支持，这里提供基础实现
   * 
   * @returns YAML 字符串
   */
  toYAML(): string {
    // 简单的 YAML 转换实现
    // 在实际使用中应该使用专门的 YAML 库如 js-yaml
    return this.convertToYAML(this.spec, 0);
  }

  /**
   * 递归转换对象为 YAML 格式
   * 
   * @param obj 要转换的对象
   * @param indent 缩进级别
   * @returns YAML 字符串
   */
  private convertToYAML(obj: any, indent: number): string {
    const spaces = '  '.repeat(indent);
    let yaml = '';

    if (Array.isArray(obj)) {
      obj.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          yaml += `${spaces}-\n${this.convertToYAML(item, indent + 1)}`;
        } else {
          yaml += `${spaces}- ${this.formatYAMLValue(item)}\n`;
        }
      });
    } else if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          yaml += `${spaces}${key}:\n`;
          yaml += this.convertToYAML(value, indent + 1);
        } else if (typeof value === 'object' && value !== null) {
          yaml += `${spaces}${key}:\n`;
          yaml += this.convertToYAML(value, indent + 1);
        } else {
          yaml += `${spaces}${key}: ${this.formatYAMLValue(value)}\n`;
        }
      });
    }

    return yaml;
  }

  /**
   * 格式化 YAML 值
   * 
   * @param value 要格式化的值
   * @returns 格式化后的字符串
   */
  private formatYAMLValue(value: any): string {
    if (typeof value === 'string') {
      // 如果字符串包含特殊字符，使用引号
      if (value.includes(':') || value.includes('#') || value.includes('\n')) {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return value;
    }
    if (value === null || value === undefined) {
      return 'null';
    }
    return String(value);
  }

  /**
   * 从路由目录扫描并生成 OpenAPI 规范
   * 
   * @param routesDir 路由文件目录路径
   * @returns 生成的 OpenAPI 规范对象
   */
  async generateFromRoutes(routesDir: string): Promise<OpenAPISpec> {
    try {
      logger.info(`开始扫描路由目录: ${routesDir}`);

      // 创建路由扫描器
      const scanner = new RouteScanner(routesDir);

      // 扫描所有路由
      const endpoints = await scanner.scanRoutes();

      logger.info(`发现 ${endpoints.length} 个端点，开始生成 OpenAPI 规范`);

      // 将端点转换为 OpenAPI 路径
      for (const endpoint of endpoints) {
        this.addEndpoint(endpoint);
      }

      logger.info('OpenAPI 规范生成完成');
      return this.spec;
    } catch (error) {
      logger.error('生成 OpenAPI 规范失败:', error);
      throw error;
    }
  }


  /**
   * 为端点生成请求示例
   * 
   * @param endpoint 路由端点信息
   * @returns 请求示例对象
   */
  private generateRequestExample(endpoint: RouteEndpoint): any {
    if (!endpoint.requestBody || !endpoint.requestBody.properties) {
      return null;
    }

    const example: Record<string, any> = {};

    for (const [key, prop] of Object.entries(endpoint.requestBody.properties)) {
      // 根据属性类型生成示例值
      switch (prop.type) {
        case 'string':
          example[key] = `example_${key}`;
          break;
        case 'number':
        case 'integer':
          example[key] = 123;
          break;
        case 'boolean':
          example[key] = true;
          break;
        case 'array':
          example[key] = ['item1', 'item2'];
          break;
        case 'object':
          example[key] = {};
          break;
        default:
          example[key] = null;
      }
    }

    return example;
  }

  /**
   * 为端点生成响应示例
   * 
   * @param endpoint 路由端点信息
   * @param statusCode 状态码
   * @returns 响应示例对象
   */
  private generateResponseExample(endpoint: RouteEndpoint, statusCode: string): any {
    // 成功响应示例
    if (statusCode === '200' || statusCode === '201') {
      return {
        success: true,
        data: this.generateSuccessDataExample(endpoint),
        message: 'Operation completed successfully'
      };
    }

    // 错误响应示例
    if (statusCode === '400') {
      return {
        success: false,
        error: 'Bad Request',
        message: 'Invalid request parameters',
        details: ['Field validation failed']
      };
    }

    if (statusCode === '401') {
      return {
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required'
      };
    }

    if (statusCode === '403') {
      return {
        success: false,
        error: 'Forbidden',
        message: 'Insufficient permissions'
      };
    }

    if (statusCode === '404') {
      return {
        success: false,
        error: 'Not Found',
        message: 'Resource not found'
      };
    }

    if (statusCode === '500') {
      return {
        success: false,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred'
      };
    }

    // 默认响应
    return {
      success: true,
      message: 'Response'
    };
  }

  /**
   * 根据端点生成成功响应的数据示例
   * 
   * @param endpoint 路由端点信息
   * @returns 数据示例
   */
  private generateSuccessDataExample(endpoint: RouteEndpoint): any {
    // 根据端点路径和方法推断数据类型
    const path = endpoint.path.toLowerCase();
    const method = endpoint.method;

    // GET 请求通常返回数据
    if (method === 'GET') {
      if (path.includes('stocks')) {
        if (path.includes('search')) {
          return [
            {
              symbol: 'AAPL',
              name: 'Apple Inc.',
              price: 150.25,
              change: 2.5
            }
          ];
        }
        return {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          price: 150.25,
          change: 2.5,
          volume: 1000000
        };
      }

      if (path.includes('portfolio')) {
        return {
          id: 1,
          name: 'My Portfolio',
          totalValue: 50000,
          stocks: []
        };
      }

      if (path.includes('watchlist')) {
        return [
          {
            id: 1,
            symbol: 'AAPL',
            addedAt: '2024-01-01T00:00:00Z'
          }
        ];
      }
    }

    // POST 请求通常返回创建的资源
    if (method === 'POST') {
      return {
        id: 1,
        createdAt: '2024-01-01T00:00:00Z'
      };
    }

    // PUT/PATCH 请求返回更新的资源
    if (method === 'PUT' || method === 'PATCH') {
      return {
        id: 1,
        updatedAt: '2024-01-01T00:00:00Z'
      };
    }

    // DELETE 请求返回确认
    if (method === 'DELETE') {
      return {
        deleted: true
      };
    }

    // 默认返回空对象
    return {};
  }


  /**
   * 添加参数（去重）
   * 
   * @param parameters 参数数组
   * @returns 去重后的参数数组
   */
  private deduplicateParameters(parameters: ParameterObject[]): ParameterObject[] {
    const seen = new Map<string, ParameterObject>();
    
    for (const param of parameters) {
      const key = `${param.name}:${param.in}`;
      if (!seen.has(key)) {
        seen.set(key, param);
      }
    }
    
    return Array.from(seen.values());
  }

  /**
   * 添加端点到 OpenAPI 规范
   * 
   * @param endpoint 路由端点信息
   */
  private addEndpoint(endpoint: RouteEndpoint): void {
    // 确保路径存在
    if (!this.spec.paths[endpoint.path]) {
      this.spec.paths[endpoint.path] = {};
    }

    // 创建操作对象
    const operation: OperationObject = {
      summary: endpoint.summary || `${endpoint.method} ${endpoint.path}`,
      description: endpoint.description,
      tags: endpoint.tags || [],
      responses: this.createResponses(endpoint.responses, endpoint)
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
      
      // 去重参数
      operation.parameters = this.deduplicateParameters(params);
    }

    // 添加请求体（带示例）
    if (endpoint.requestBody) {
      const requestSchema: SchemaObject = {
        type: endpoint.requestBody.type,
        properties: endpoint.requestBody.properties
          ? this.convertProperties(endpoint.requestBody.properties)
          : undefined
      };

      // 生成请求示例
      const requestExample = this.generateRequestExample(endpoint);

      operation.requestBody = {
        description: endpoint.requestBody.description,
        required: endpoint.requestBody.required,
        content: {
          'application/json': {
            schema: requestSchema,
            examples: requestExample ? {
              default: {
                summary: 'Example request',
                value: requestExample
              }
            } : undefined
          }
        }
      };
    }

    // 添加安全要求
    if (endpoint.requiresAuth) {
      operation.security = [{ bearerAuth: [] }];
    }

    // 添加标签
    if (endpoint.tags) {
      endpoint.tags.forEach(tag => {
        this.addTag({
          name: tag,
          description: `${tag} related endpoints`
        });
      });
    }

    // 将操作添加到路径
    const method = endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch';
    this.spec.paths[endpoint.path][method] = operation;
  }

  /**
   * 创建响应对象（带示例）
   * 
   * @param responses 路由响应信息数组
   * @param endpoint 路由端点信息（用于生成示例）
   * @returns 响应对象集合
   */
  private createResponses(responses?: RouteResponse[], endpoint?: RouteEndpoint): ResponsesObject {
    const responsesObject: ResponsesObject = {};

    if (responses && responses.length > 0) {
      responses.forEach(response => {
        const responseExample = endpoint ? this.generateResponseExample(endpoint, response.statusCode) : undefined;

        responsesObject[response.statusCode] = {
          description: response.description,
          content: response.type
            ? {
                'application/json': {
                  schema: {
                    type: response.type
                  },
                  examples: responseExample ? {
                    default: {
                      summary: `Example ${response.statusCode} response`,
                      value: responseExample
                    }
                  } : undefined
                }
              }
            : undefined
        };
      });
    } else {
      // 默认响应（带示例）
      const successExample = endpoint ? this.generateResponseExample(endpoint, '200') : {
        success: true,
        data: {},
        message: 'Operation completed successfully'
      };

      const badRequestExample = {
        success: false,
        error: 'Bad Request',
        message: 'Invalid request parameters',
        details: ['Field validation failed']
      };

      const serverErrorExample = {
        success: false,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred'
      };

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
            examples: {
              default: {
                summary: 'Example success response',
                value: successExample
              }
            }
          }
        }
      };

      responsesObject['400'] = {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                error: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'array', items: { type: 'string' } }
              }
            },
            examples: {
              default: {
                summary: 'Example error response',
                value: badRequestExample
              }
            }
          }
        }
      };

      responsesObject['500'] = {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                error: { type: 'string' },
                message: { type: 'string' }
              }
            },
            examples: {
              default: {
                summary: 'Example server error response',
                value: serverErrorExample
              }
            }
          }
        }
      };
    }

    return responsesObject;
  }

  /**
   * 转换属性对象为 Schema 对象
   * 
   * @param properties 属性对象
   * @returns Schema 属性对象
   */
  private convertProperties(
    properties: Record<string, { type: string; description?: string; required?: boolean }>
  ): Record<string, SchemaObject> {
    const schemaProperties: Record<string, SchemaObject> = {};

    for (const [key, value] of Object.entries(properties)) {
      schemaProperties[key] = {
        type: value.type,
        description: value.description
      };
    }

    return schemaProperties;
  }
}
