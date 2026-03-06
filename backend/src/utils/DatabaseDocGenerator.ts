import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Prisma Schema 解析后的数据源配置
 */
export interface Datasource {
  provider: string;
  url: string;
}

/**
 * Prisma Schema 解析后的生成器配置
 */
export interface Generator {
  provider: string;
  output?: string;
}

/**
 * 字段信息
 */
export interface Field {
  name: string;
  type: string;
  isRequired: boolean;
  isUnique: boolean;
  isList: boolean;
  isId: boolean;
  defaultValue?: any;
  relationName?: string;
  relationFields?: string[];
  relationReferences?: string[];
  documentation?: string;
  mapTo?: string;
}

/**
 * 索引信息
 */
export interface Index {
  fields: string[];
  name?: string;
}

/**
 * 唯一约束信息
 */
export interface UniqueConstraint {
  fields: string[];
  name?: string;
}

/**
 * 模型信息
 */
export interface Model {
  name: string;
  fields: Field[];
  indexes: Index[];
  uniqueConstraints: UniqueConstraint[];
  documentation?: string;
  mapTo?: string;
}

/**
 * 枚举信息
 */
export interface Enum {
  name: string;
  values: string[];
  documentation?: string;
}

/**
 * 解析后的 Prisma Schema
 */
export interface ParsedSchema {
  models: Model[];
  enums: Enum[];
  datasource: Datasource;
  generator: Generator;
}

/**
 * 数据库文档生成器
 * 负责解析 Prisma schema 文件并生成数据库设计文档
 */
export class DatabaseDocGenerator {
  /**
   * 解析 Prisma schema 文件
   * @param schemaPath schema 文件路径
   * @returns 解析后的 schema 对象
   */
  async parseSchema(schemaPath: string): Promise<ParsedSchema> {
    const content = await fs.readFile(schemaPath, 'utf-8');
    
    const schema: ParsedSchema = {
      models: [],
      enums: [],
      datasource: { provider: '', url: '' },
      generator: { provider: '' }
    };

    // 解析 datasource
    const datasourceMatch = content.match(/datasource\s+\w+\s*\{([^}]+)\}/s);
    if (datasourceMatch) {
      schema.datasource = this.parseDatasource(datasourceMatch[1]);
    }

    // 解析 generator
    const generatorMatch = content.match(/generator\s+\w+\s*\{([^}]+)\}/s);
    if (generatorMatch) {
      schema.generator = this.parseGenerator(generatorMatch[1]);
    }

    // 解析 enums
    const enumMatches = content.matchAll(/enum\s+(\w+)\s*\{([^}]+)\}/gs);
    for (const match of enumMatches) {
      const enumDef = this.parseEnum(match[1], match[2], content, match.index || 0);
      schema.enums.push(enumDef);
    }

    // 解析 models
    const modelMatches = content.matchAll(/model\s+(\w+)\s*\{([^}]+)\}/gs);
    for (const match of modelMatches) {
      const model = this.parseModel(match[1], match[2], content, match.index || 0);
      schema.models.push(model);
    }

    return schema;
  }

  /**
   * 解析 datasource 配置
   */
  private parseDatasource(content: string): Datasource {
    const providerMatch = content.match(/provider\s*=\s*"([^"]+)"/);
    const urlMatch = content.match(/url\s*=\s*(.+)/);
    
    return {
      provider: providerMatch ? providerMatch[1] : '',
      url: urlMatch ? urlMatch[1].trim() : ''
    };
  }

  /**
   * 解析 generator 配置
   */
  private parseGenerator(content: string): Generator {
    const providerMatch = content.match(/provider\s*=\s*"([^"]+)"/);
    const outputMatch = content.match(/output\s*=\s*"([^"]+)"/);
    
    return {
      provider: providerMatch ? providerMatch[1] : '',
      output: outputMatch ? outputMatch[1] : undefined
    };
  }

  /**
   * 解析枚举定义
   */
  private parseEnum(name: string, content: string, fullContent: string, enumIndex: number): Enum {
    const values = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//'))
      .map(line => line.split('//')[0].trim());

    // 提取文档注释
    const documentation = this.extractDocumentation(fullContent, enumIndex);

    return {
      name,
      values,
      documentation
    };
  }

  /**
   * 解析模型定义
   */
  private parseModel(name: string, content: string, fullContent: string, modelIndex: number): Model {
    const lines = content.split('\n').map(line => line.trim());
    const fields: Field[] = [];
    const indexes: Index[] = [];
    const uniqueConstraints: UniqueConstraint[] = [];
    let mapTo: string | undefined;

    for (const line of lines) {
      if (!line || line.startsWith('//')) continue;

      // 解析字段
      if (!line.startsWith('@@')) {
        const field = this.parseField(line);
        if (field) {
          fields.push(field);
        }
      } else {
        // 解析模型级别的属性
        if (line.startsWith('@@index')) {
          const index = this.parseIndex(line);
          if (index) indexes.push(index);
        } else if (line.startsWith('@@unique')) {
          const unique = this.parseUniqueConstraint(line);
          if (unique) uniqueConstraints.push(unique);
        } else if (line.startsWith('@@map')) {
          const mapMatch = line.match(/@@map\("([^"]+)"\)/);
          if (mapMatch) mapTo = mapMatch[1];
        }
      }
    }

    // 提取文档注释
    const documentation = this.extractDocumentation(fullContent, modelIndex);

    return {
      name,
      fields,
      indexes,
      uniqueConstraints,
      documentation,
      mapTo
    };
  }

  /**
   * 解析字段定义
   */
  private parseField(line: string): Field | null {
    // 匹配字段定义: fieldName Type @attributes
    const fieldMatch = line.match(/^(\w+)\s+(\w+)(\[\])?([\?\!]?)\s*(.*)/);
    if (!fieldMatch) return null;

    const [, name, baseType, isList, modifier, attributes] = fieldMatch;
    
    const field: Field = {
      name,
      type: baseType,
      isRequired: modifier === '!',
      isUnique: attributes.includes('@unique'),
      isList: !!isList,
      isId: attributes.includes('@id'),
      defaultValue: undefined,
      mapTo: undefined
    };

    // 解析 @default - 需要处理嵌套括号的情况，如 @default(uuid())
    const defaultMatch = attributes.match(/@default\(((?:[^()]|\([^)]*\))+)\)/);
    if (defaultMatch) {
      field.defaultValue = this.parseDefaultValue(defaultMatch[1]);
    }

    // 解析 @map
    const mapMatch = attributes.match(/@map\("([^"]+)"\)/);
    if (mapMatch) {
      field.mapTo = mapMatch[1];
    }

    // 解析 @relation
    const relationMatch = attributes.match(/@relation\(([^)]+)\)/);
    if (relationMatch) {
      const relationAttrs = relationMatch[1];
      
      // 解析 fields
      const fieldsMatch = relationAttrs.match(/fields:\s*\[([^\]]+)\]/);
      if (fieldsMatch) {
        field.relationFields = fieldsMatch[1].split(',').map(f => f.trim());
      }

      // 解析 references
      const referencesMatch = relationAttrs.match(/references:\s*\[([^\]]+)\]/);
      if (referencesMatch) {
        field.relationReferences = referencesMatch[1].split(',').map(r => r.trim());
      }

      // 解析 name
      const nameMatch = relationAttrs.match(/name:\s*"([^"]+)"/);
      if (nameMatch) {
        field.relationName = nameMatch[1];
      }
    }

    return field;
  }

  /**
   * 解析默认值
   */
  private parseDefaultValue(value: string): any {
    value = value.trim();
    
    // 函数调用
    if (value.includes('(')) {
      return value;
    }
    
    // 布尔值
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    // 数字
    if (!isNaN(Number(value))) {
      return Number(value);
    }
    
    // 字符串
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }
    
    // 数组
    if (value.startsWith('[') && value.endsWith(']')) {
      return value;
    }
    
    return value;
  }

  /**
   * 解析索引定义
   */
  private parseIndex(line: string): Index | null {
    const match = line.match(/@@index\(\[([^\]]+)\](?:,\s*name:\s*"([^"]+)")?\)/);
    if (!match) return null;

    const fields = match[1].split(',').map(f => f.trim());
    const name = match[2];

    return { fields, name };
  }

  /**
   * 解析唯一约束定义
   */
  private parseUniqueConstraint(line: string): UniqueConstraint | null {
    const match = line.match(/@@unique\(\[([^\]]+)\](?:,\s*name:\s*"([^"]+)")?\)/);
    if (!match) return null;

    const fields = match[1].split(',').map(f => f.trim());
    const name = match[2];

    return { fields, name };
  }

  /**
   * 提取文档注释
   */
  private extractDocumentation(content: string, startIndex: number): string | undefined {
    // 向前查找注释
    const beforeContent = content.substring(0, startIndex);
    const lines = beforeContent.split('\n');
    const comments: string[] = [];

    // 从后往前查找连续的注释行
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('//')) {
        comments.unshift(line.replace(/^\/\/\s*/, ''));
      } else if (line === '') {
        continue;
      } else {
        break;
      }
    }

    return comments.length > 0 ? comments.join(' ') : undefined;
  }

  /**
   * 生成数据库设计文档
   * @param schema 解析后的 schema
   * @returns Markdown 格式的文档
   */
  generateSchemaDoc(schema: ParsedSchema): string {
    let doc = '# 数据库设计文档\n\n';
    doc += `> 最后更新: ${new Date().toISOString().split('T')[0]}\n\n`;
    
    // 数据源信息
    doc += '## 数据源配置\n\n';
    doc += `- **数据库类型**: ${schema.datasource.provider}\n`;
    doc += `- **连接配置**: ${schema.datasource.url}\n\n`;

    // 枚举
    if (schema.enums.length > 0) {
      doc += '## 枚举类型\n\n';
      for (const enumDef of schema.enums) {
        doc += `### ${enumDef.name}\n\n`;
        if (enumDef.documentation) {
          doc += `${enumDef.documentation}\n\n`;
        }
        doc += '**可选值**:\n';
        for (const value of enumDef.values) {
          doc += `- \`${value}\`\n`;
        }
        doc += '\n';
      }
    }

    // 模型
    doc += '## 数据模型\n\n';
    for (const model of schema.models) {
      doc += `### ${model.name}\n\n`;
      if (model.documentation) {
        doc += `${model.documentation}\n\n`;
      }
      if (model.mapTo) {
        doc += `**数据库表名**: \`${model.mapTo}\`\n\n`;
      }

      // 字段表格
      doc += '| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |\n';
      doc += '|--------|------|------|------|--------|------|\n';
      
      for (const field of model.fields) {
        const fieldName = field.mapTo ? `${field.name} (\`${field.mapTo}\`)` : field.name;
        const type = field.isList ? `${field.type}[]` : field.type;
        const required = field.isRequired ? '✓' : '';
        const unique = field.isUnique || field.isId ? '✓' : '';
        const defaultVal = field.defaultValue !== undefined ? `\`${field.defaultValue}\`` : '';
        
        let description = '';
        if (field.isId) description += '主键 ';
        if (field.relationFields) {
          description += `关联到 ${field.type}`;
        }
        
        doc += `| ${fieldName} | ${type} | ${required} | ${unique} | ${defaultVal} | ${description} |\n`;
      }
      doc += '\n';

      // 索引
      if (model.indexes.length > 0) {
        doc += '**索引**:\n';
        for (const index of model.indexes) {
          const indexName = index.name ? ` (${index.name})` : '';
          doc += `- \`${index.fields.join(', ')}\`${indexName}\n`;
        }
        doc += '\n';
      }

      // 唯一约束
      if (model.uniqueConstraints.length > 0) {
        doc += '**唯一约束**:\n';
        for (const constraint of model.uniqueConstraints) {
          const constraintName = constraint.name ? ` (${constraint.name})` : '';
          doc += `- \`${constraint.fields.join(', ')}\`${constraintName}\n`;
        }
        doc += '\n';
      }

      // 关系
      const relations = model.fields.filter(f => f.relationFields || f.relationReferences);
      if (relations.length > 0) {
        doc += '**关系**:\n';
        for (const rel of relations) {
          if (rel.relationFields && rel.relationReferences) {
            doc += `- \`${rel.name}\`: 通过 \`${rel.relationFields.join(', ')}\` 关联到 \`${rel.type}.${rel.relationReferences.join(', ')}\`\n`;
          }
        }
        doc += '\n';
      }
    }

    return doc;
  }

  /**
   * 生成 Mermaid ER 图
   * @param schema 解析后的 schema
   * @returns Mermaid 图表代码
   */
  generateERDiagram(schema: ParsedSchema): string {
    let diagram = '```mermaid\nerDiagram\n';

    // 为每个模型生成实体定义
    for (const model of schema.models) {
      const tableName = model.mapTo || model.name;
      diagram += `    ${model.name} {\n`;
      
      for (const field of model.fields) {
        // 跳过关系字段（它们会通过关系线表示）
        if (field.relationFields || field.relationReferences) continue;
        
        const type = field.isList ? `${field.type}[]` : field.type;
        let attributes = '';
        if (field.isId) attributes += ' PK';
        if (field.isUnique) attributes += ' UK';
        
        diagram += `        ${type} ${field.name}${attributes}\n`;
      }
      
      diagram += `    }\n`;
    }

    diagram += '\n';

    // 生成关系
    const processedRelations = new Set<string>();
    
    for (const model of schema.models) {
      for (const field of model.fields) {
        if (field.relationFields && field.relationReferences) {
          const relationKey = [model.name, field.type].sort().join('-');
          
          if (!processedRelations.has(relationKey)) {
            processedRelations.add(relationKey);
            
            // 确定关系类型
            const cardinality = field.isList ? '||--o{' : '||--||';
            diagram += `    ${model.name} ${cardinality} ${field.type} : "${field.name}"\n`;
          }
        }
      }
    }

    diagram += '```\n';
    return diagram;
  }
}
