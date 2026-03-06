/**
 * 路由扫描器
 * 
 * 负责扫描路由文件并提取端点信息，包括方法、路径、处理器和 JSDoc 注释
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from './logger.js';

/**
 * 路由端点信息
 */
export interface RouteEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  handler: string;
  summary?: string;
  description?: string;
  parameters?: RouteParameter[];
  requestBody?: RouteRequestBody;
  responses?: RouteResponse[];
  tags?: string[];
  requiresAuth?: boolean;
}

/**
 * 路由参数信息
 */
export interface RouteParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  type: string;
  required: boolean;
  description?: string;
}

/**
 * 请求体信息
 */
export interface RouteRequestBody {
  type: string;
  required: boolean;
  description?: string;
  properties?: Record<string, RouteProperty>;
}

/**
 * 属性信息
 */
export interface RouteProperty {
  type: string;
  description?: string;
  required?: boolean;
}

/**
 * 响应信息
 */
export interface RouteResponse {
  statusCode: string;
  description: string;
  type?: string;
}

/**
 * 路由扫描器类
 */
export class RouteScanner {
  private routesDir: string;

  /**
   * 创建路由扫描器实例
   * 
   * @param routesDir 路由文件目录路径
   */
  constructor(routesDir: string) {
    this.routesDir = routesDir;
  }

  /**
   * 扫描所有路由文件并提取端点信息
   * 
   * @returns 路由端点信息数组
   */
  async scanRoutes(): Promise<RouteEndpoint[]> {
    const endpoints: RouteEndpoint[] = [];

    try {
      // 读取路由目录
      const files = await fs.readdir(this.routesDir);

      // 过滤出 TypeScript 文件（排除测试文件和 index.ts）
      const routeFiles = files.filter(
        file => file.endsWith('.ts') && 
        !file.endsWith('.test.ts') && 
        file !== 'index.ts'
      );

      // 扫描每个路由文件
      for (const file of routeFiles) {
        const filePath = path.join(this.routesDir, file);
        const fileEndpoints = await this.scanRouteFile(filePath);
        endpoints.push(...fileEndpoints);
      }

      logger.info(`扫描完成，共发现 ${endpoints.length} 个端点`);
      return endpoints;
    } catch (error) {
      logger.error('扫描路由文件失败:', error);
      throw error;
    }
  }

  /**
   * 扫描单个路由文件
   * 
   * @param filePath 路由文件路径
   * @returns 路由端点信息数组
   */
  private async scanRouteFile(filePath: string): Promise<RouteEndpoint[]> {
    const endpoints: RouteEndpoint[] = [];

    try {
      // 读取文件内容
      const content = await fs.readFile(filePath, 'utf-8');

      // 提取文件名作为标签
      const fileName = path.basename(filePath, '.ts');
      const tag = this.formatTag(fileName);

      // 查找所有路由定义
      const routeMatches = this.findRouteDefinitions(content);

      for (const match of routeMatches) {
        const endpoint = this.parseRouteDefinition(match, tag);
        if (endpoint) {
          endpoints.push(endpoint);
        }
      }

      logger.debug(`从 ${fileName} 提取了 ${endpoints.length} 个端点`);
      return endpoints;
    } catch (error) {
      logger.error(`扫描文件 ${filePath} 失败:`, error);
      return [];
    }
  }

  /**
   * 查找文件中的所有路由定义
   * 
   * @param content 文件内容
   * @returns 路由定义匹配结果数组
   */
  private findRouteDefinitions(content: string): RouteMatch[] {
    const matches: RouteMatch[] = [];

    // 匹配 router.get/post/put/delete/patch 调用
    // 支持多行定义和 JSDoc 注释
    const routeRegex = /(?:\/\*\*[\s\S]*?\*\/\s*)?(router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]\s*,[\s\S]*?\);)/g;

    let match;
    while ((match = routeRegex.exec(content)) !== null) {
      const fullMatch = match[0];
      const method = match[2].toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      const routePath = match[3];

      // 提取 JSDoc 注释
      const jsdocMatch = fullMatch.match(/\/\*\*([\s\S]*?)\*\//);
      const jsdoc = jsdocMatch ? jsdocMatch[1] : '';

      matches.push({
        fullMatch,
        method,
        path: routePath,
        jsdoc
      });
    }

    return matches;
  }

  /**
   * 解析路由定义
   * 
   * @param match 路由匹配结果
   * @param tag 标签
   * @returns 路由端点信息
   */
  private parseRouteDefinition(match: RouteMatch, tag: string): RouteEndpoint | null {
    try {
      const endpoint: RouteEndpoint = {
        method: match.method,
        path: `/api${match.path}`,
        handler: `${tag}Handler`,
        tags: [tag]
      };

      // 解析 JSDoc 注释
      if (match.jsdoc) {
        this.parseJSDoc(match.jsdoc, endpoint);
      }

      // 提取路径参数
      const pathParams = this.extractPathParameters(match.path);
      if (pathParams.length > 0) {
        endpoint.parameters = endpoint.parameters || [];
        endpoint.parameters.push(...pathParams);
      }

      return endpoint;
    } catch (error) {
      logger.error('解析路由定义失败:', error);
      return null;
    }
  }

  /**
   * 解析 JSDoc 注释
   * 
   * @param jsdoc JSDoc 注释内容
   * @param endpoint 端点信息对象
   */
  private parseJSDoc(jsdoc: string, endpoint: RouteEndpoint): void {
    // 提取第一行作为 summary
    const lines = jsdoc.split('\n').map(line => line.trim().replace(/^\*\s*/, ''));
    
    // 第一个非空行是方法签名（如 GET /api/stocks/search）
    const firstLine = lines.find(line => line.length > 0);
    if (firstLine && firstLine.match(/^(GET|POST|PUT|DELETE|PATCH)\s+/)) {
      // 跳过方法签名行
      const descLines = lines.slice(1).filter(line => 
        line.length > 0 && 
        !line.startsWith('@') &&
        !line.match(/^(GET|POST|PUT|DELETE|PATCH)\s+/)
      );
      
      if (descLines.length > 0) {
        endpoint.summary = descLines[0];
        if (descLines.length > 1) {
          endpoint.description = descLines.slice(1).join(' ');
        }
      }
    } else if (firstLine) {
      endpoint.summary = firstLine;
    }

    // 提取 Implements 信息作为描述的一部分
    const implementsMatch = jsdoc.match(/Implements\s+Requirement[s]?\s+([\d.,\s]+):/i);
    if (implementsMatch) {
      const requirements = implementsMatch[1].trim();
      if (endpoint.description) {
        endpoint.description += ` (实现需求: ${requirements})`;
      } else {
        endpoint.description = `实现需求: ${requirements}`;
      }
    }

    // 解析参数
    const paramRegex = /-\s+(\w+):\s+([^(]+)(?:\(([^)]+)\))?/g;
    let paramMatch;
    while ((paramMatch = paramRegex.exec(jsdoc)) !== null) {
      const paramName = paramMatch[1];
      const paramDesc = paramMatch[2].trim();
      const paramDetails = paramMatch[3];

      // 判断参数类型
      let paramIn: 'query' | 'path' | 'header' | 'cookie' = 'query';
      if (jsdoc.includes('Path Parameters')) {
        paramIn = 'path';
      } else if (jsdoc.includes('Query Parameters')) {
        paramIn = 'query';
      }

      const parameter: RouteParameter = {
        name: paramName,
        in: paramIn,
        type: 'string',
        required: paramDetails?.includes('required') || false,
        description: paramDesc
      };

      endpoint.parameters = endpoint.parameters || [];
      endpoint.parameters.push(parameter);
    }

    // 检查是否需要认证
    if (jsdoc.toLowerCase().includes('auth') || jsdoc.toLowerCase().includes('token')) {
      endpoint.requiresAuth = true;
    }
  }

  /**
   * 提取路径参数
   * 
   * @param routePath 路由路径
   * @returns 路径参数数组
   */
  private extractPathParameters(routePath: string): RouteParameter[] {
    const parameters: RouteParameter[] = [];
    const paramRegex = /:(\w+)/g;

    let match;
    while ((match = paramRegex.exec(routePath)) !== null) {
      parameters.push({
        name: match[1],
        in: 'path',
        type: 'string',
        required: true,
        description: `${match[1]} parameter`
      });
    }

    return parameters;
  }

  /**
   * 格式化标签名称
   * 
   * @param fileName 文件名
   * @returns 格式化后的标签名称
   */
  private formatTag(fileName: string): string {
    // 将驼峰命名转换为空格分隔的标题格式
    // 例如: userSettings -> User Settings
    return fileName
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

/**
 * 路由匹配结果
 */
interface RouteMatch {
  fullMatch: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  jsdoc: string;
}
