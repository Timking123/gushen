/**
 * 测试数据库文档生成器
 * 用于验证 DatabaseDocGenerator 的功能
 */
import { DatabaseDocGenerator } from '../src/utils/DatabaseDocGenerator';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('开始测试数据库文档生成器...\n');

  const generator = new DatabaseDocGenerator();
  const schemaPath = path.join(__dirname, '../prisma/schema.prisma');

  try {
    // 解析 schema
    console.log('1. 解析 Prisma schema...');
    const schema = await generator.parseSchema(schemaPath);
    console.log(`   ✓ 成功解析 ${schema.models.length} 个模型`);
    console.log(`   ✓ 成功解析 ${schema.enums.length} 个枚举\n`);

    // 生成数据库文档
    console.log('2. 生成数据库设计文档...');
    const schemaDoc = generator.generateSchemaDoc(schema);
    console.log(`   ✓ 文档长度: ${schemaDoc.length} 字符\n`);

    // 生成 ER 图
    console.log('3. 生成 ER 图...');
    const erDiagram = generator.generateERDiagram(schema);
    console.log(`   ✓ ER 图长度: ${erDiagram.length} 字符\n`);

    // 显示部分模型信息
    console.log('4. 模型信息示例:');
    const userModel = schema.models.find(m => m.name === 'User');
    if (userModel) {
      console.log(`   模型: ${userModel.name}`);
      console.log(`   表名: ${userModel.mapTo}`);
      console.log(`   字段数: ${userModel.fields.length}`);
      console.log(`   索引数: ${userModel.indexes.length}`);
      console.log(`   文档注释: ${userModel.documentation || '无'}\n`);
    }

    // 显示部分枚举信息
    console.log('5. 枚举信息示例:');
    const userRoleEnum = schema.enums.find(e => e.name === 'UserRole');
    if (userRoleEnum) {
      console.log(`   枚举: ${userRoleEnum.name}`);
      console.log(`   值: ${userRoleEnum.values.join(', ')}\n`);
    }

    // 保存文档到临时文件以供查看
    const outputDir = path.join(__dirname, '../temp');
    await fs.mkdir(outputDir, { recursive: true });
    
    const schemaDocPath = path.join(outputDir, 'database-schema.md');
    await fs.writeFile(schemaDocPath, schemaDoc, 'utf-8');
    console.log(`6. 数据库文档已保存到: ${schemaDocPath}`);

    const erDiagramPath = path.join(outputDir, 'er-diagram.md');
    await fs.writeFile(erDiagramPath, erDiagram, 'utf-8');
    console.log(`   ER 图已保存到: ${erDiagramPath}\n`);

    console.log('✓ 测试完成！');
  } catch (error) {
    console.error('✗ 测试失败:', error);
    process.exit(1);
  }
}

main();
