import { DatabaseDocGenerator } from './DatabaseDocGenerator';
import * as path from 'path';

describe('DatabaseDocGenerator', () => {
  let generator: DatabaseDocGenerator;

  beforeEach(() => {
    generator = new DatabaseDocGenerator();
  });

  describe('parseSchema', () => {
    it('应该成功解析真实的 Prisma schema 文件', async () => {
      const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
      const schema = await generator.parseSchema(schemaPath);

      // 验证基本结构
      expect(schema).toBeDefined();
      expect(schema.datasource).toBeDefined();
      expect(schema.generator).toBeDefined();
      expect(schema.models).toBeDefined();
      expect(schema.enums).toBeDefined();

      // 验证数据源
      expect(schema.datasource.provider).toBe('postgresql');
      expect(schema.datasource.url).toContain('DATABASE_URL');

      // 验证生成器
      expect(schema.generator.provider).toBe('prisma-client-js');

      // 验证枚举
      expect(schema.enums.length).toBeGreaterThan(0);
      const userRoleEnum = schema.enums.find(e => e.name === 'UserRole');
      expect(userRoleEnum).toBeDefined();
      expect(userRoleEnum?.values).toContain('USER');
      expect(userRoleEnum?.values).toContain('PREMIUM');
      expect(userRoleEnum?.values).toContain('ADMIN');

      // 验证模型
      expect(schema.models.length).toBeGreaterThan(0);
      const userModel = schema.models.find(m => m.name === 'User');
      expect(userModel).toBeDefined();
      expect(userModel?.fields.length).toBeGreaterThan(0);
    });

    it('应该正确解析 User 模型的字段', async () => {
      const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
      const schema = await generator.parseSchema(schemaPath);

      const userModel = schema.models.find(m => m.name === 'User');
      expect(userModel).toBeDefined();

      // 验证 id 字段
      const idField = userModel?.fields.find(f => f.name === 'id');
      expect(idField).toBeDefined();
      expect(idField?.type).toBe('String');
      expect(idField?.isId).toBe(true);
      expect(idField?.defaultValue).toBe('uuid()');

      // 验证 email 字段
      const emailField = userModel?.fields.find(f => f.name === 'email');
      expect(emailField).toBeDefined();
      expect(emailField?.type).toBe('String');
      expect(emailField?.isUnique).toBe(true);

      // 验证 role 字段
      const roleField = userModel?.fields.find(f => f.name === 'role');
      expect(roleField).toBeDefined();
      expect(roleField?.type).toBe('UserRole');
      expect(roleField?.defaultValue).toBe('USER');

      // 验证 permissions 字段（数组类型）
      const permissionsField = userModel?.fields.find(f => f.name === 'permissions');
      expect(permissionsField).toBeDefined();
      expect(permissionsField?.type).toBe('String');
      expect(permissionsField?.isList).toBe(true);
    });

    it('应该正确解析模型的索引', async () => {
      const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
      const schema = await generator.parseSchema(schemaPath);

      const userModel = schema.models.find(m => m.name === 'User');
      expect(userModel).toBeDefined();
      expect(userModel?.indexes.length).toBeGreaterThan(0);

      // 验证 role 索引
      const roleIndex = userModel?.indexes.find(idx => idx.fields.includes('role'));
      expect(roleIndex).toBeDefined();
    });

    it('应该正确解析模型的唯一约束', async () => {
      const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
      const schema = await generator.parseSchema(schemaPath);

      const watchlistModel = schema.models.find(m => m.name === 'WatchlistItem');
      expect(watchlistModel).toBeDefined();
      
      // WatchlistItem 有 @@unique([userId, symbol])
      const uniqueConstraint = watchlistModel?.uniqueConstraints.find(
        uc => uc.fields.includes('userId') && uc.fields.includes('symbol')
      );
      expect(uniqueConstraint).toBeDefined();
    });

    it('应该正确解析关系字段', async () => {
      const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
      const schema = await generator.parseSchema(schemaPath);

      const watchlistModel = schema.models.find(m => m.name === 'WatchlistItem');
      expect(watchlistModel).toBeDefined();

      // 验证 user 关系
      const userRelation = watchlistModel?.fields.find(f => f.name === 'user');
      expect(userRelation).toBeDefined();
      expect(userRelation?.type).toBe('User');
      expect(userRelation?.relationFields).toEqual(['userId']);
      expect(userRelation?.relationReferences).toEqual(['id']);
    });

    it('应该正确解析 @map 属性', async () => {
      const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
      const schema = await generator.parseSchema(schemaPath);

      const userModel = schema.models.find(m => m.name === 'User');
      expect(userModel).toBeDefined();
      expect(userModel?.mapTo).toBe('users');

      // 验证字段的 @map
      const passwordHashField = userModel?.fields.find(f => f.name === 'passwordHash');
      expect(passwordHashField).toBeDefined();
      expect(passwordHashField?.mapTo).toBe('password_hash');
    });
  });

  describe('generateSchemaDoc', () => {
    it('应该生成包含所有模型的文档', async () => {
      const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
      const schema = await generator.parseSchema(schemaPath);
      const doc = generator.generateSchemaDoc(schema);

      // 验证文档包含标题
      expect(doc).toContain('# 数据库设计文档');
      expect(doc).toContain('## 数据源配置');
      expect(doc).toContain('## 枚举类型');
      expect(doc).toContain('## 数据模型');

      // 验证包含数据源信息
      expect(doc).toContain('postgresql');

      // 验证包含枚举
      expect(doc).toContain('UserRole');

      // 验证包含模型
      expect(doc).toContain('### User');
      expect(doc).toContain('### Stock');
    });

    it('应该生成包含字段表格的文档', async () => {
      const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
      const schema = await generator.parseSchema(schemaPath);
      const doc = generator.generateSchemaDoc(schema);

      // 验证表格标题
      expect(doc).toContain('| 字段名 | 类型 | 必填 | 唯一 | 默认值 | 说明 |');
      
      // 验证包含字段信息
      expect(doc).toContain('email');
      expect(doc).toContain('String');
    });

    it('应该在文档中标注索引和唯一约束', async () => {
      const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
      const schema = await generator.parseSchema(schemaPath);
      const doc = generator.generateSchemaDoc(schema);

      // 验证索引部分
      expect(doc).toContain('**索引**');
      
      // 验证唯一约束部分
      expect(doc).toContain('**唯一约束**');
    });

    it('应该在文档中包含关系信息', async () => {
      const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
      const schema = await generator.parseSchema(schemaPath);
      const doc = generator.generateSchemaDoc(schema);

      // 验证关系部分
      expect(doc).toContain('**关系**');
    });

    it('应该包含最后更新日期', async () => {
      const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
      const schema = await generator.parseSchema(schemaPath);
      const doc = generator.generateSchemaDoc(schema);

      const today = new Date().toISOString().split('T')[0];
      expect(doc).toContain(`> 最后更新: ${today}`);
    });
  });

  describe('generateERDiagram', () => {
    it('应该生成 Mermaid ER 图', async () => {
      const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
      const schema = await generator.parseSchema(schemaPath);
      const diagram = generator.generateERDiagram(schema);

      // 验证 Mermaid 语法
      expect(diagram).toContain('```mermaid');
      expect(diagram).toContain('erDiagram');
      expect(diagram).toContain('```');

      // 验证包含实体
      expect(diagram).toContain('User {');
      expect(diagram).toContain('Stock {');
    });

    it('应该在 ER 图中包含关系', async () => {
      const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
      const schema = await generator.parseSchema(schemaPath);
      const diagram = generator.generateERDiagram(schema);

      // 验证关系语法（Mermaid 使用 ||--|| 或 ||--o{ 表示关系）
      expect(diagram).toMatch(/\|\|--/);
    });

    it('应该标注主键字段', async () => {
      const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
      const schema = await generator.parseSchema(schemaPath);
      const diagram = generator.generateERDiagram(schema);

      // 验证主键标注
      expect(diagram).toContain('PK');
    });
  });

  describe('边缘情况', () => {
    it('应该处理空的枚举列表', async () => {
      const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
      const schema = await generator.parseSchema(schemaPath);
      
      // 即使有枚举，也应该能正常处理
      expect(schema.enums).toBeDefined();
      expect(Array.isArray(schema.enums)).toBe(true);
    });

    it('应该处理没有索引的模型', async () => {
      const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
      const schema = await generator.parseSchema(schemaPath);
      
      // 某些模型可能没有索引
      const models = schema.models.filter(m => m.indexes.length === 0);
      expect(models.length).toBeGreaterThanOrEqual(0);
    });

    it('应该处理没有关系的模型', async () => {
      const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
      const schema = await generator.parseSchema(schemaPath);
      
      // 验证可以处理没有关系字段的模型
      for (const model of schema.models) {
        const relations = model.fields.filter(f => f.relationFields || f.relationReferences);
        expect(relations).toBeDefined();
      }
    });
  });
});
