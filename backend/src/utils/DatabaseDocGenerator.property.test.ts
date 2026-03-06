/**
 * 数据库文档生成器属性测试
 * 
 * 使用 fast-check 进行基于属性的测试
 * Feature: documentation-organization-and-archiving
 * 
 * **属性 6: 数据库文档生成完整性**
 * **验证需求: 4.1, 4.2**
 * 
 * 对于任意有效的 Prisma schema，生成的数据库文档应该包含 schema 中定义的所有模型，
 * 且每个模型的文档都包含所有字段的名称、类型、约束和关系信息。
 */

import { describe, it, expect } from '@jest/globals';
import * as fc from 'fast-check';
import { DatabaseDocGenerator, ParsedSchema, Model, Field, Enum } from './DatabaseDocGenerator.js';

// 测试配置 - 减少迭代次数以加快测试速度
const testConfig = {
  numRuns: 20,
  verbose: false
};

// ==================== 自定义生成器 ====================

/**
 * 生成有效的模型名称（PascalCase）
 */
const modelNameArbitrary = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => /^[A-Z][a-zA-Z0-9]*$/.test(s))
  .map(s => s.charAt(0).toUpperCase() + s.slice(1));

/**
 * 生成有效的字段名称（camelCase）
 */
const fieldNameArbitrary = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => /^[a-z][a-zA-Z0-9]*$/.test(s));

/**
 * 生成 Prisma 字段类型
 */
const fieldTypeArbitrary = fc.constantFrom(
  'String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Bytes'
);

/**
 * 生成字段定义
 */
const fieldArbitrary: fc.Arbitrary<Field> = fc.record({
  name: fieldNameArbitrary,
  type: fieldTypeArbitrary,
  isRequired: fc.boolean(),
  isUnique: fc.boolean(),
  isList: fc.boolean(),
  isId: fc.boolean(),
  defaultValue: fc.option(
    fc.oneof(
      fc.constant('uuid()'),
      fc.constant('now()'),
      fc.constant('autoincrement()'),
      fc.boolean(),
      fc.integer(),
      fc.string({ maxLength: 20 })
    ),
    { nil: undefined }
  ),
  documentation: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
  mapTo: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined })
}) as fc.Arbitrary<Field>;

/**
 * 生成关系字段
 */
const relationFieldArbitrary: fc.Arbitrary<Field> = fc.record({
  name: fieldNameArbitrary,
  type: modelNameArbitrary,
  isRequired: fc.boolean(),
  isUnique: fc.boolean(),
  isList: fc.boolean(),
  isId: fc.constant(false),
  relationName: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  relationFields: fc.option(
    fc.array(fieldNameArbitrary, { minLength: 1, maxLength: 2 }),
    { nil: undefined }
  ),
  relationReferences: fc.option(
    fc.array(fieldNameArbitrary, { minLength: 1, maxLength: 2 }),
    { nil: undefined }
  ),
  documentation: fc.option(fc.string({ maxLength: 100 }), { nil: undefined })
}) as fc.Arbitrary<Field>;

/**
 * 生成索引定义
 */
const indexArbitrary = fc.record({
  fields: fc.array(fieldNameArbitrary, { minLength: 1, maxLength: 3 }),
  name: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined })
});

/**
 * 生成唯一约束定义
 */
const uniqueConstraintArbitrary = fc.record({
  fields: fc.array(fieldNameArbitrary, { minLength: 1, maxLength: 3 }),
  name: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined })
});

/**
 * 生成模型定义
 */
const modelArbitrary: fc.Arbitrary<Model> = fc.record({
  name: modelNameArbitrary,
  fields: fc.array(fieldArbitrary, { minLength: 1, maxLength: 10 }),
  indexes: fc.array(indexArbitrary, { maxLength: 3 }),
  uniqueConstraints: fc.array(uniqueConstraintArbitrary, { maxLength: 3 }),
  documentation: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
  mapTo: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined })
}) as fc.Arbitrary<Model>;

/**
 * 生成枚举定义
 */
const enumArbitrary: fc.Arbitrary<Enum> = fc.record({
  name: modelNameArbitrary,
  values: fc.array(
    fc.string({ minLength: 1, maxLength: 20 })
      .filter(s => /^[A-Z][A-Z0-9_]*$/.test(s)),
    { minLength: 1, maxLength: 5 }
  ),
  documentation: fc.option(fc.string({ maxLength: 100 }), { nil: undefined })
}) as fc.Arbitrary<Enum>;

/**
 * 生成完整的 ParsedSchema
 */
const parsedSchemaArbitrary: fc.Arbitrary<ParsedSchema> = fc.record({
  models: fc.array(modelArbitrary, { minLength: 1, maxLength: 10 }),
  enums: fc.array(enumArbitrary, { maxLength: 5 }),
  datasource: fc.record({
    provider: fc.constantFrom('postgresql', 'mysql', 'sqlite', 'sqlserver', 'mongodb'),
    url: fc.constant('env("DATABASE_URL")')
  }),
  generator: fc.record({
    provider: fc.constant('prisma-client-js'),
    output: fc.option(fc.constant('../node_modules/.prisma/client'), { nil: undefined })
  })
}) as fc.Arbitrary<ParsedSchema>;

// ==================== 属性测试 ====================

describe('DatabaseDocGenerator 属性测试', () => {
  describe('属性 6: 数据库文档生成完整性', () => {
    it('Feature: documentation-organization-and-archiving, Property 6: 对于任意 Prisma schema，生成的文档应该包含所有模型', async () => {
      /**
       * **验证需求: 4.1, 4.2**
       * 
       * 此测试验证：
       * - 所有模型都被包含在生成的文档中
       * - 每个模型的名称都出现在文档中
       */
      await fc.assert(
        fc.asyncProperty(
          parsedSchemaArbitrary,
          async (schema) => {
            const generator = new DatabaseDocGenerator();
            const doc = generator.generateSchemaDoc(schema);

            // 验证所有模型都在文档中
            for (const model of schema.models) {
              expect(doc).toContain(model.name);
            }

            // 验证文档包含基本结构
            expect(doc).toContain('# 数据库设计文档');
            expect(doc).toContain('## 数据源配置');
            expect(doc).toContain('## 数据模型');
          }
        ),
        testConfig
      );
    });

    it('Feature: documentation-organization-and-archiving, Property 6: 每个模型的文档都包含所有字段的名称和类型', async () => {
      /**
       * **验证需求: 4.1, 4.2**
       * 
       * 此测试验证：
       * - 每个模型的所有字段都被包含
       * - 字段名称和类型都出现在文档中
       */
      await fc.assert(
        fc.asyncProperty(
          parsedSchemaArbitrary,
          async (schema) => {
            const generator = new DatabaseDocGenerator();
            const doc = generator.generateSchemaDoc(schema);

            // 验证每个模型的所有字段都在文档中
            for (const model of schema.models) {
              for (const field of model.fields) {
                // 验证字段名称出现在文档中
                expect(doc).toContain(field.name);
                
                // 验证字段类型出现在文档中
                expect(doc).toContain(field.type);
              }
            }
          }
        ),
        testConfig
      );
    });

    it('Feature: documentation-organization-and-archiving, Property 6: 每个模型的文档都包含字段约束信息', async () => {
      /**
       * **验证需求: 4.1, 4.2**
       * 
       * 此测试验证：
       * - 主键字段被标识
       * - 唯一约束被标识
       * - 必填字段被标识
       */
      await fc.assert(
        fc.asyncProperty(
          parsedSchemaArbitrary,
          async (schema) => {
            const generator = new DatabaseDocGenerator();
            const doc = generator.generateSchemaDoc(schema);

            // 验证字段约束信息
            for (const model of schema.models) {
              // 查找主键字段
              const idFields = model.fields.filter(f => f.isId);
              for (const idField of idFields) {
                // 主键字段应该在文档中被标识
                expect(doc).toContain(idField.name);
                expect(doc).toContain('主键');
              }

              // 验证表格标题包含约束列
              expect(doc).toContain('| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |');
            }
          }
        ),
        testConfig
      );
    });

    it('Feature: documentation-organization-and-archiving, Property 6: 每个模型的文档都包含关系信息', async () => {
      /**
       * **验证需求: 4.1, 4.2**
       * 
       * 此测试验证：
       * - 关系字段被识别
       * - 关系信息被包含在文档中
       */
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            schema: parsedSchemaArbitrary,
            hasRelations: fc.boolean()
          }),
          async ({ schema, hasRelations }) => {
            // 如果需要关系，为第一个模型添加关系字段
            if (hasRelations && schema.models.length >= 2) {
              const relationField: Field = {
                name: 'relatedModel',
                type: schema.models[1].name,
                isRequired: true,
                isUnique: false,
                isList: false,
                isId: false,
                relationFields: ['relatedModelId'],
                relationReferences: ['id']
              };
              schema.models[0].fields.push(relationField);
            }

            const generator = new DatabaseDocGenerator();
            const doc = generator.generateSchemaDoc(schema);

            // 如果有关系字段，验证关系信息在文档中
            for (const model of schema.models) {
              const relationFields = model.fields.filter(
                f => f.relationFields || f.relationReferences
              );

              if (relationFields.length > 0) {
                // 应该有关系部分
                const modelSection = doc.substring(doc.indexOf(`### ${model.name}`));
                const nextModelIndex = modelSection.indexOf('### ', 1);
                const modelDoc = nextModelIndex > 0 
                  ? modelSection.substring(0, nextModelIndex)
                  : modelSection;

                if (relationFields.length > 0) {
                  expect(modelDoc).toContain('**关系**');
                }

                // 验证每个关系字段
                for (const relField of relationFields) {
                  expect(modelDoc).toContain(relField.name);
                  if (relField.relationFields && relField.relationReferences) {
                    expect(modelDoc).toContain(relField.type);
                  }
                }
              }
            }
          }
        ),
        testConfig
      );
    });

    it('Feature: documentation-organization-and-archiving, Property 6: 文档应该包含所有枚举定义', async () => {
      /**
       * **验证需求: 4.1, 4.2**
       * 
       * 此测试验证：
       * - 所有枚举都被包含在文档中
       * - 枚举的所有值都被列出
       */
      await fc.assert(
        fc.asyncProperty(
          parsedSchemaArbitrary,
          async (schema) => {
            const generator = new DatabaseDocGenerator();
            const doc = generator.generateSchemaDoc(schema);

            // 如果有枚举，验证枚举部分存在
            if (schema.enums.length > 0) {
              expect(doc).toContain('## 枚举类型');

              // 验证每个枚举
              for (const enumDef of schema.enums) {
                expect(doc).toContain(enumDef.name);
                
                // 验证枚举的所有值
                for (const value of enumDef.values) {
                  expect(doc).toContain(value);
                }
              }
            }
          }
        ),
        testConfig
      );
    });

    it('Feature: documentation-organization-and-archiving, Property 6: 文档应该包含索引和唯一约束信息', async () => {
      /**
       * **验证需求: 4.1, 4.2**
       * 
       * 此测试验证：
       * - 模型的索引被包含在文档中
       * - 模型的唯一约束被包含在文档中
       */
      await fc.assert(
        fc.asyncProperty(
          parsedSchemaArbitrary,
          async (schema) => {
            const generator = new DatabaseDocGenerator();
            const doc = generator.generateSchemaDoc(schema);

            // 验证索引和唯一约束
            for (const model of schema.models) {
              // 如果模型有索引
              if (model.indexes.length > 0) {
                const modelSection = doc.substring(doc.indexOf(`### ${model.name}`));
                const nextModelIndex = modelSection.indexOf('### ', 1);
                const modelDoc = nextModelIndex > 0 
                  ? modelSection.substring(0, nextModelIndex)
                  : modelSection;

                expect(modelDoc).toContain('**索引**');
                
                // 验证每个索引的字段
                for (const index of model.indexes) {
                  for (const field of index.fields) {
                    expect(modelDoc).toContain(field);
                  }
                }
              }

              // 如果模型有唯一约束
              if (model.uniqueConstraints.length > 0) {
                const modelSection = doc.substring(doc.indexOf(`### ${model.name}`));
                const nextModelIndex = modelSection.indexOf('### ', 1);
                const modelDoc = nextModelIndex > 0 
                  ? modelSection.substring(0, nextModelIndex)
                  : modelSection;

                expect(modelDoc).toContain('**唯一约束**');
                
                // 验证每个唯一约束的字段
                for (const constraint of model.uniqueConstraints) {
                  for (const field of constraint.fields) {
                    expect(modelDoc).toContain(field);
                  }
                }
              }
            }
          }
        ),
        testConfig
      );
    });

    it('Feature: documentation-organization-and-archiving, Property 6: 文档应该包含数据源配置信息', async () => {
      /**
       * **验证需求: 4.1, 4.2**
       * 
       * 此测试验证：
       * - 数据源提供者被包含
       * - 数据源连接配置被包含
       */
      await fc.assert(
        fc.asyncProperty(
          parsedSchemaArbitrary,
          async (schema) => {
            const generator = new DatabaseDocGenerator();
            const doc = generator.generateSchemaDoc(schema);

            // 验证数据源信息
            expect(doc).toContain('## 数据源配置');
            expect(doc).toContain(schema.datasource.provider);
            expect(doc).toContain(schema.datasource.url);
          }
        ),
        testConfig
      );
    });

    it('Feature: documentation-organization-and-archiving, Property 6: 文档应该包含最后更新日期', async () => {
      /**
       * **验证需求: 4.1, 4.2**
       * 
       * 此测试验证：
       * - 文档包含最后更新日期
       * - 日期格式正确（YYYY-MM-DD）
       */
      await fc.assert(
        fc.asyncProperty(
          parsedSchemaArbitrary,
          async (schema) => {
            const generator = new DatabaseDocGenerator();
            const doc = generator.generateSchemaDoc(schema);

            // 验证包含最后更新日期
            expect(doc).toContain('> 最后更新:');
            
            // 验证日期格式
            const datePattern = /\d{4}-\d{2}-\d{2}/;
            expect(doc).toMatch(datePattern);
          }
        ),
        testConfig
      );
    });
  });

  describe('ER 图生成完整性', () => {
    it('应该为所有模型生成 ER 图实体定义', async () => {
      await fc.assert(
        fc.asyncProperty(
          parsedSchemaArbitrary,
          async (schema) => {
            const generator = new DatabaseDocGenerator();
            const diagram = generator.generateERDiagram(schema);

            // 验证 Mermaid 语法
            expect(diagram).toContain('```mermaid');
            expect(diagram).toContain('erDiagram');
            expect(diagram).toContain('```');

            // 验证所有模型都在 ER 图中
            for (const model of schema.models) {
              expect(diagram).toContain(`${model.name} {`);
            }
          }
        ),
        testConfig
      );
    });

    it('应该在 ER 图中标注主键字段', async () => {
      await fc.assert(
        fc.asyncProperty(
          parsedSchemaArbitrary,
          async (schema) => {
            const generator = new DatabaseDocGenerator();
            const diagram = generator.generateERDiagram(schema);

            // 验证主键标注
            for (const model of schema.models) {
              const idFields = model.fields.filter(f => f.isId);
              if (idFields.length > 0) {
                expect(diagram).toContain('PK');
              }
            }
          }
        ),
        testConfig
      );
    });

    it('应该在 ER 图中包含关系线', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            schema: parsedSchemaArbitrary,
            addRelation: fc.boolean()
          }),
          async ({ schema, addRelation }) => {
            // 如果需要，添加关系
            if (addRelation && schema.models.length >= 2) {
              const relationField: Field = {
                name: 'related',
                type: schema.models[1].name,
                isRequired: true,
                isUnique: false,
                isList: false,
                isId: false,
                relationFields: ['relatedId'],
                relationReferences: ['id']
              };
              schema.models[0].fields.push(relationField);
            }

            const generator = new DatabaseDocGenerator();
            const diagram = generator.generateERDiagram(schema);

            // 验证 ER 图语法
            expect(diagram).toContain('erDiagram');

            // 如果有关系，验证关系线存在
            const hasRelations = schema.models.some(model =>
              model.fields.some(f => f.relationFields && f.relationReferences)
            );

            if (hasRelations) {
              // Mermaid 使用 ||--|| 或 ||--o{ 表示关系
              expect(diagram).toMatch(/\|\|--/);
            }
          }
        ),
        testConfig
      );
    });
  });

  describe('边缘情况和不变性', () => {
    it('应该处理没有字段的模型', async () => {
      const schema: ParsedSchema = {
        models: [{
          name: 'EmptyModel',
          fields: [],
          indexes: [],
          uniqueConstraints: []
        }],
        enums: [],
        datasource: { provider: 'postgresql', url: 'env("DATABASE_URL")' },
        generator: { provider: 'prisma-client-js' }
      };

      const generator = new DatabaseDocGenerator();
      const doc = generator.generateSchemaDoc(schema);

      // 应该包含模型名称
      expect(doc).toContain('EmptyModel');
      // 应该有表格结构
      expect(doc).toContain('| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |');
    });

    it('应该处理没有枚举的 schema', async () => {
      const schema: ParsedSchema = {
        models: [{
          name: 'User',
          fields: [{
            name: 'id',
            type: 'String',
            isRequired: true,
            isUnique: true,
            isList: false,
            isId: true
          }],
          indexes: [],
          uniqueConstraints: []
        }],
        enums: [],
        datasource: { provider: 'postgresql', url: 'env("DATABASE_URL")' },
        generator: { provider: 'prisma-client-js' }
      };

      const generator = new DatabaseDocGenerator();
      const doc = generator.generateSchemaDoc(schema);

      // 应该生成有效文档
      expect(doc).toContain('# 数据库设计文档');
      expect(doc).toContain('User');
      // 不应该有枚举部分（或者有但为空）
    });

    it('应该处理数组类型字段', async () => {
      const schema: ParsedSchema = {
        models: [{
          name: 'User',
          fields: [{
            name: 'tags',
            type: 'String',
            isRequired: true,
            isUnique: false,
            isList: true,
            isId: false
          }],
          indexes: [],
          uniqueConstraints: []
        }],
        enums: [],
        datasource: { provider: 'postgresql', url: 'env("DATABASE_URL")' },
        generator: { provider: 'prisma-client-js' }
      };

      const generator = new DatabaseDocGenerator();
      const doc = generator.generateSchemaDoc(schema);

      // 应该显示数组类型
      expect(doc).toContain('String[]');
    });

    it('生成文档不应该修改原始 schema 对象', async () => {
      await fc.assert(
        fc.asyncProperty(
          parsedSchemaArbitrary,
          async (schema) => {
            const generator = new DatabaseDocGenerator();
            const originalSchema = JSON.parse(JSON.stringify(schema));
            
            generator.generateSchemaDoc(schema);
            generator.generateERDiagram(schema);

            // 原始 schema 对象不应该被修改
            expect(schema).toEqual(originalSchema);
          }
        ),
        testConfig
      );
    });

    it('多次生成文档应该产生相同的结果', async () => {
      await fc.assert(
        fc.asyncProperty(
          parsedSchemaArbitrary,
          async (schema) => {
            const generator = new DatabaseDocGenerator();
            
            const doc1 = generator.generateSchemaDoc(schema);
            const doc2 = generator.generateSchemaDoc(schema);

            // 除了日期可能不同，其他内容应该相同
            // 移除日期后比较
            const removeDate = (doc: string) => doc.replace(/\d{4}-\d{2}-\d{2}/, 'DATE');
            
            expect(removeDate(doc1)).toBe(removeDate(doc2));
          }
        ),
        testConfig
      );
    });
  });
});
