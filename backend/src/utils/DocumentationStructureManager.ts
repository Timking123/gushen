import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 文档目录结构定义
 */
interface Directory {
  name: string;
  path: string;
  description: string;
  files?: DocumentFile[];
  subdirectories?: Directory[];
}

/**
 * 文档文件定义
 */
interface DocumentFile {
  name: string;
  path: string;
  title: string;
  description: string;
  lastUpdated?: Date;
  version?: string;
  author?: string;
  tags?: string[];
}

/**
 * 文档结构定义
 */
interface DocumentStructure {
  root: string;
  directories: Directory[];
}

/**
 * 验证结果
 */
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  code: string;
  message: string;
  location?: {
    file: string;
    line: number;
    column: number;
  };
}

interface ValidationWarning {
  code: string;
  message: string;
  suggestion?: string;
  location?: {
    file: string;
    line: number;
    column: number;
  };
}

/**
 * 文档结构管理器
 * 负责创建和维护标准化的文档目录结构
 */
export class DocumentationStructureManager {
  /**
   * 标准文档目录结构定义
   */
  private readonly standardStructure: Directory[] = [
    {
      name: 'api',
      path: 'api',
      description: 'API 文档，包括 REST API 和 WebSocket 协议'
    },
    {
      name: 'architecture',
      path: 'architecture',
      description: '系统架构文档，描述系统设计和组件关系'
    },
    {
      name: 'database',
      path: 'database',
      description: '数据库设计文档，包括 schema 和 ER 图'
    },
    {
      name: 'deployment',
      path: 'deployment',
      description: '部署和运维文档，指导生产环境部署'
    },
    {
      name: 'development',
      path: 'development',
      description: '开发指南和编码规范'
    },
    {
      name: 'troubleshooting',
      path: 'troubleshooting',
      description: '故障排查文档，常见问题和解决方案'
    },
    {
      name: 'templates',
      path: 'templates',
      description: '文档模板，用于创建新文档'
    }
  ];

  /**
   * 创建标准文档目录结构
   * @param rootDir 项目根目录
   * @throws 如果目录创建失败
   */
  async createStructure(rootDir: string): Promise<void> {
    const docsDir = path.join(rootDir, 'docs');

    try {
      // 创建主文档目录
      await fs.mkdir(docsDir, { recursive: true });

      // 创建所有子目录
      for (const dir of this.standardStructure) {
        const dirPath = path.join(docsDir, dir.path);
        await fs.mkdir(dirPath, { recursive: true });
      }
    } catch (error: any) {
      if (error.code === 'EACCES') {
        throw new Error(
          `无法创建目录 ${docsDir}：权限不足。请检查目录权限或使用管理员权限运行。`
        );
      } else if (error.code === 'ENOSPC') {
        throw new Error('磁盘空间不足。请清理磁盘空间后重试。');
      }
      throw error;
    }
  }

  /**
   * 验证文档结构完整性
   * @param docsDir 文档目录路径
   * @returns 验证结果
   */
  async validateStructure(docsDir: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // 检查主文档目录是否存在
      const docsDirExists = await this.pathExists(docsDir);
      if (!docsDirExists) {
        errors.push({
          code: 'DOCS_DIR_NOT_FOUND',
          message: `文档目录不存在: ${docsDir}`
        });
        return { isValid: false, errors, warnings };
      }

      // 检查所有标准子目录
      for (const dir of this.standardStructure) {
        const dirPath = path.join(docsDir, dir.path);
        const exists = await this.pathExists(dirPath);
        
        if (!exists) {
          warnings.push({
            code: 'MISSING_DIRECTORY',
            message: `缺少标准目录: ${dir.name}`,
            suggestion: `创建目录: ${dirPath}`
          });
        }
      }

      // 检查 README.md 是否存在
      const readmePath = path.join(docsDir, 'README.md');
      const readmeExists = await this.pathExists(readmePath);
      
      if (!readmeExists) {
        warnings.push({
          code: 'MISSING_INDEX',
          message: '缺少文档索引文件: docs/README.md',
          suggestion: '运行 generateIndex 方法创建索引文件'
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error: any) {
      errors.push({
        code: 'VALIDATION_ERROR',
        message: `验证过程中发生错误: ${error.message}`
      });
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * 生成文档索引
   * @param docsDir 文档目录路径
   * @returns 文档索引内容（Markdown 格式）
   */
  async generateIndex(docsDir: string): Promise<string> {
    const indexLines: string[] = [];
    
    // 添加标题和说明
    indexLines.push('# 项目文档');
    indexLines.push('');
    indexLines.push('本目录包含项目的所有文档，按照功能和用途进行组织。');
    indexLines.push('');
    indexLines.push('## 文档结构');
    indexLines.push('');

    // 遍历所有标准目录
    for (const dir of this.standardStructure) {
      const dirPath = path.join(docsDir, dir.path);
      const exists = await this.pathExists(dirPath);
      
      if (exists) {
        indexLines.push(`### ${dir.name}/`);
        indexLines.push('');
        indexLines.push(dir.description);
        indexLines.push('');

        // 列出目录中的文件
        try {
          const files = await fs.readdir(dirPath);
          const mdFiles = files.filter(f => f.endsWith('.md'));
          
          if (mdFiles.length > 0) {
            indexLines.push('**文档列表:**');
            indexLines.push('');
            for (const file of mdFiles) {
              const relativePath = path.join(dir.path, file);
              const title = file.replace('.md', '').replace(/-/g, ' ');
              indexLines.push(`- [${title}](${relativePath})`);
            }
            indexLines.push('');
          }
        } catch (error) {
          // 忽略读取错误，继续处理其他目录
        }
      }
    }

    // 添加维护信息
    indexLines.push('## 文档维护');
    indexLines.push('');
    indexLines.push('- 所有文档使用 Markdown 格式编写');
    indexLines.push('- 每个文档应包含最后更新日期和版本信息');
    indexLines.push('- 当代码发生变更时，请及时更新相关文档');
    indexLines.push('- 使用文档模板（templates/ 目录）创建新文档');
    indexLines.push('');
    indexLines.push(`*最后更新: ${new Date().toISOString().split('T')[0]}*`);

    return indexLines.join('\n');
  }

  /**
   * 迁移现有文档到新结构
   * @param oldPaths 旧文档路径列表
   * @param newStructure 新目录结构
   */
  async migrateDocuments(
    oldPaths: string[],
    newStructure: DocumentStructure
  ): Promise<void> {
    // 检查是否在 Git 仓库中
    const isGitRepo = await this.checkGitRepository();
    
    for (const oldPath of oldPaths) {
      // 检查源文件是否存在
      const exists = await this.pathExists(oldPath);
      if (!exists) {
        console.warn(`跳过不存在的文件: ${oldPath}`);
        continue;
      }

      // 确定目标路径
      const fileName = path.basename(oldPath);
      const targetDir = this.determineTargetDirectory(fileName, newStructure);
      const newPath = path.join(targetDir, fileName);

      // 确保目标目录存在
      await fs.mkdir(path.dirname(newPath), { recursive: true });

      // 尝试使用 git mv 保持历史
      if (isGitRepo) {
        const moved = await this.moveWithGitHistory(oldPath, newPath);
        if (moved) {
          console.log(`已迁移（保持 Git 历史）: ${oldPath} -> ${newPath}`);
          continue;
        }
      }

      // 降级为普通文件移动
      try {
        await fs.rename(oldPath, newPath);
        console.log(`已迁移: ${oldPath} -> ${newPath}`);
      } catch (error: any) {
        console.error(`迁移失败: ${oldPath}`, error.message);
      }
    }
  }

  /**
   * 检查是否在 Git 仓库中
   * @returns 是否在 Git 仓库中
   */
  private async checkGitRepository(): Promise<boolean> {
    try {
      await execAsync('git rev-parse --git-dir');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 使用 git mv 移动文件以保持历史
   * @param oldPath 源文件路径
   * @param newPath 目标文件路径
   * @returns 是否成功移动
   */
  private async moveWithGitHistory(
    oldPath: string,
    newPath: string
  ): Promise<boolean> {
    try {
      // 检查文件是否在 Git 中被跟踪
      await execAsync(`git ls-files --error-unmatch "${oldPath}"`);
      
      // 使用 git mv 移动文件
      await execAsync(`git mv "${oldPath}" "${newPath}"`);
      return true;
    } catch (error) {
      // 如果 git mv 失败，返回 false 以降级为普通移动
      console.warn(`git mv 失败，降级为普通文件移动: ${oldPath}`);
      return false;
    }
  }

  /**
   * 根据文件名确定目标目录
   * @param fileName 文件名
   * @param newStructure 新目录结构
   * @returns 目标目录路径
   */
  private determineTargetDirectory(
    fileName: string,
    newStructure: DocumentStructure
  ): string {
    const lowerFileName = fileName.toLowerCase();
    const docsRoot = path.join(newStructure.root, 'docs');

    // 根据文件名模式确定目标目录
    if (lowerFileName.includes('api') || lowerFileName.includes('openapi')) {
      return path.join(docsRoot, 'api');
    } else if (lowerFileName.includes('architecture') || lowerFileName.includes('design')) {
      return path.join(docsRoot, 'architecture');
    } else if (lowerFileName.includes('database') || lowerFileName.includes('schema')) {
      return path.join(docsRoot, 'database');
    } else if (lowerFileName.includes('deploy') || lowerFileName.includes('docker')) {
      return path.join(docsRoot, 'deployment');
    } else if (lowerFileName.includes('develop') || lowerFileName.includes('contributing')) {
      return path.join(docsRoot, 'development');
    } else if (lowerFileName.includes('troubleshoot') || lowerFileName.includes('faq')) {
      return path.join(docsRoot, 'troubleshooting');
    } else if (lowerFileName.includes('template')) {
      return path.join(docsRoot, 'templates');
    } else {
      // 默认放在 docs 根目录
      return docsRoot;
    }
  }

  /**
   * 检查路径是否存在
   * @param filePath 文件或目录路径
   * @returns 是否存在
   */
  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// 导出类型定义
export type {
  Directory,
  DocumentFile,
  DocumentStructure,
  ValidationResult,
  ValidationError,
  ValidationWarning
};
