/**
 * 数据库文档生成脚本
 * 
 * 此脚本负责：
 * 1. 解析 Prisma schema 文件
 * 2. 生成数据库设计文档 (docs/database/schema.md)
 * 3. 生成 ER 图文档 (docs/database/er-diagram.md)
 */

import { DatabaseDocGenerator } from '../src/utils/DatabaseDocGenerator.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 主函数：生成数据库文档
 */
async function generateDatabaseDocs() {
  try {
    console.log('开始生成数据库文档...\n');

    // 1. 创建数据库文档生成器
    const generator = new DatabaseDocGenerator();

    // 2. 解析 Prisma schema
    const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
    console.log(`解析 Prisma schema: ${schemaPath}`);
    
    const schema = await generator.parseSchema(schemaPath);
    console.log(`✅ 成功解析 ${schema.models.length} 个模型`);
    console.log(`✅ 成功解析 ${schema.enums.length} 个枚举\n`);

    // 3. 确保 docs/database 目录存在
    const docsDatabaseDir = path.join(__dirname, '../../docs/database');
    await fs.mkdir(docsDatabaseDir, { recursive: true });
    console.log(`✅ 确保目录存在: ${docsDatabaseDir}\n`);

    // 4. 生成数据库设计文档
    console.log('生成数据库设计文档...');
    const schemaDoc = generator.generateSchemaDoc(schema);
    const schemaDocPath = path.join(docsDatabaseDir, 'schema.md');
    await fs.writeFile(schemaDocPath, schemaDoc, 'utf-8');
    console.log(`✅ 已生成: ${schemaDocPath}`);
    console.log(`   文档长度: ${schemaDoc.length} 字符\n`);

    // 5. 生成 ER 图文档
    console.log('生成 ER 图文档...');
    const erDiagram = generator.generateERDiagram(schema);
    
    // 创建完整的 ER 图文档，包含说明
    const erDiagramDoc = generateERDiagramDoc(erDiagram);
    const erDiagramPath = path.join(docsDatabaseDir, 'er-diagram.md');
    await fs.writeFile(erDiagramPath, erDiagramDoc, 'utf-8');
    console.log(`✅ 已生成: ${erDiagramPath}`);
    console.log(`   ER 图长度: ${erDiagram.length} 字符\n`);

    // 6. 显示统计信息
    console.log('📊 数据库统计信息:');
    console.log(`   - 数据模型: ${schema.models.length} 个`);
    console.log(`   - 枚举类型: ${schema.enums.length} 个`);
    
    const totalFields = schema.models.reduce((sum, model) => sum + model.fields.length, 0);
    console.log(`   - 总字段数: ${totalFields} 个`);
    
    const totalIndexes = schema.models.reduce((sum, model) => sum + model.indexes.length, 0);
    console.log(`   - 总索引数: ${totalIndexes} 个`);
    
    const totalRelations = schema.models.reduce((sum, model) => 
      sum + model.fields.filter(f => f.relationFields || f.relationReferences).length, 0
    );
    console.log(`   - 关系数: ${totalRelations} 个\n`);

    // 7. 显示模型列表
    console.log('📋 数据模型列表:');
    schema.models.forEach(model => {
      const tableName = model.mapTo ? ` (表: ${model.mapTo})` : '';
      console.log(`   - ${model.name}${tableName}: ${model.fields.length} 个字段`);
    });
    console.log('');

    console.log('🎉 数据库文档生成完成！');
    console.log('\n可用的文档文件:');
    console.log(`  - 数据库设计文档: ${schemaDocPath}`);
    console.log(`  - ER 图文档: ${erDiagramPath}`);

  } catch (error) {
    console.error('❌ 生成数据库文档失败:', error);
    if (error instanceof Error) {
      console.error('错误详情:', error.message);
      if (error.stack) {
        console.error('堆栈跟踪:', error.stack);
      }
    }
    process.exit(1);
  }
}

/**
 * 生成完整的 ER 图文档内容
 * 
 * @param erDiagram Mermaid ER 图代码
 * @returns Markdown 格式的 ER 图文档
 */
function generateERDiagramDoc(erDiagram: string): string {
  const lines: string[] = [];

  // 文档头部
  lines.push('# 数据库 ER 图\n');
  lines.push(`> 最后更新: ${new Date().toISOString().split('T')[0]}\n`);
  lines.push('---\n');

  // 简介
  lines.push('## 简介\n');
  lines.push('本文档展示数据库的实体关系图（Entity-Relationship Diagram），');
  lines.push('帮助理解数据模型之间的关系和整体数据库结构。\n');

  // 使用说明
  lines.push('## 如何查看\n');
  lines.push('本 ER 图使用 Mermaid 语法编写，可以通过以下方式查看：\n');
  lines.push('1. **GitHub**: 在 GitHub 上直接查看此 Markdown 文件，ER 图会自动渲染');
  lines.push('2. **VS Code**: 安装 "Markdown Preview Mermaid Support" 扩展');
  lines.push('3. **在线工具**: 复制 Mermaid 代码到 [Mermaid Live Editor](https://mermaid.live/)');
  lines.push('4. **文档网站**: 使用支持 Mermaid 的文档生成工具（如 VitePress, Docusaurus）\n');

  // ER 图
  lines.push('## 实体关系图\n');
  lines.push(erDiagram);
  lines.push('');

  // 关系说明
  lines.push('## 关系类型说明\n');
  lines.push('ER 图中使用以下符号表示实体之间的关系：\n');
  lines.push('| 符号 | 含义 | 说明 |');
  lines.push('|------|------|------|');
  lines.push('| `||--o{` | 一对多 | 一个实体可以关联多个另一个实体 |');
  lines.push('| `}o--||` | 多对一 | 多个实体关联到一个实体 |');
  lines.push('| `||--||` | 一对一 | 一个实体只能关联一个另一个实体 |');
  lines.push('| `}o--o{` | 多对多 | 多个实体可以关联多个另一个实体 |');
  lines.push('');

  // 字段类型说明
  lines.push('## 字段类型说明\n');
  lines.push('ER 图中的字段类型标记：\n');
  lines.push('- **PK** (Primary Key): 主键，唯一标识实体的字段');
  lines.push('- **FK** (Foreign Key): 外键，关联到其他实体的字段');
  lines.push('- **UK** (Unique Key): 唯一键，值必须唯一的字段');
  lines.push('');

  // 相关文档
  lines.push('## 相关文档\n');
  lines.push('- [数据库设计文档](./schema.md) - 详细的表结构和字段说明');
  lines.push('- [数据迁移文档](./migrations.md) - 数据库迁移策略和历史');
  lines.push('- [常用查询文档](./queries.md) - 常用数据库查询示例');
  lines.push('');

  // 更新指南
  lines.push('## 更新指南\n');
  lines.push('当数据库结构发生变更时，请遵循以下步骤更新 ER 图：\n');
  lines.push('### 1. 修改 Prisma Schema\n');
  lines.push('在 `backend/prisma/schema.prisma` 中修改数据模型定义。\n');
  lines.push('### 2. 重新生成文档\n');
  lines.push('运行以下命令重新生成数据库文档：\n');
  lines.push('```bash');
  lines.push('npm run docs:database');
  lines.push('```\n');
  lines.push('或者：\n');
  lines.push('```bash');
  lines.push('cd backend');
  lines.push('npx tsx scripts/generate-database-docs.ts');
  lines.push('```\n');
  lines.push('### 3. 验证生成的文档\n');
  lines.push('检查以下文件是否正确更新：\n');
  lines.push('- `docs/database/schema.md` - 数据库设计文档');
  lines.push('- `docs/database/er-diagram.md` - ER 图文档\n');
  lines.push('### 4. 提交变更\n');
  lines.push('将更新的 Prisma schema 和生成的文档一起提交：\n');
  lines.push('```bash');
  lines.push('git add backend/prisma/schema.prisma docs/database/');
  lines.push('git commit -m "docs: update database documentation for [change description]"');
  lines.push('```\n');

  return lines.join('\n');
}

// 运行主函数
generateDatabaseDocs();
