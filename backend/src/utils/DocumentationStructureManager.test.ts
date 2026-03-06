import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DocumentationStructureManager } from './DocumentationStructureManager.js';
import type { ValidationResult, DocumentStructure } from './DocumentationStructureManager.js';

// Mock fs/promises
jest.mock('fs/promises');

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

const mockFs = fs as jest.Mocked<typeof fs>;

// 导入 mocked exec
import { exec } from 'child_process';
const mockExec = exec as jest.MockedFunction<typeof exec>;

describe('DocumentationStructureManager', () => {
  let manager: DocumentationStructureManager;
  const testRootDir = '/tmp/test-project';
  const testDocsDir = path.join(testRootDir, 'docs');

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new DocumentationStructureManager();
  });

  describe('createStructure - 目录创建功能 (需求 1.1, 1.2)', () => {
    it('应该创建主文档目录和所有标准子目录', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);

      await manager.createStructure(testRootDir);

      // 验证创建了主文档目录
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        testDocsDir,
        { recursive: true }
      );

      // 验证创建了所有标准子目录
      const expectedSubDirs = [
        'api',
        'architecture',
        'database',
        'deployment',
        'development',
        'troubleshooting',
        'templates'
      ];

      for (const subDir of expectedSubDirs) {
        expect(mockFs.mkdir).toHaveBeenCalledWith(
          path.join(testDocsDir, subDir),
          { recursive: true }
        );
      }

      // 验证总共调用了 8 次（1 个主目录 + 7 个子目录）
      expect(mockFs.mkdir).toHaveBeenCalledTimes(8);
    });

    it('应该处理已存在的目录而不抛出错误', async () => {
      // recursive: true 选项会自动处理已存在的目录
      mockFs.mkdir.mockResolvedValue(undefined);

      await expect(manager.createStructure(testRootDir)).resolves.not.toThrow();

      expect(mockFs.mkdir).toHaveBeenCalled();
    });

    it('应该在不同的根目录下创建文档结构', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      const alternativeRoot = '/home/user/project';

      await manager.createStructure(alternativeRoot);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(alternativeRoot, 'docs'),
        { recursive: true }
      );
    });
  });

  describe('createStructure - 权限错误处理 (需求 1.1, 1.2)', () => {
    it('应该在权限不足时抛出清晰的错误消息', async () => {
      const permissionError: any = new Error('Permission denied');
      permissionError.code = 'EACCES';
      mockFs.mkdir.mockRejectedValue(permissionError);

      await expect(manager.createStructure(testRootDir)).rejects.toThrow(
        /无法创建目录.*权限不足/
      );
      await expect(manager.createStructure(testRootDir)).rejects.toThrow(
        /请检查目录权限或使用管理员权限运行/
      );
    });

    it('应该在磁盘空间不足时抛出清晰的错误消息', async () => {
      const diskFullError: any = new Error('No space left on device');
      diskFullError.code = 'ENOSPC';
      mockFs.mkdir.mockRejectedValue(diskFullError);

      await expect(manager.createStructure(testRootDir)).rejects.toThrow(
        /磁盘空间不足/
      );
      await expect(manager.createStructure(testRootDir)).rejects.toThrow(
        /请清理磁盘空间后重试/
      );
    });

    it('应该重新抛出其他未知错误', async () => {
      const unknownError = new Error('Unknown filesystem error');
      mockFs.mkdir.mockRejectedValue(unknownError);

      await expect(manager.createStructure(testRootDir)).rejects.toThrow(
        'Unknown filesystem error'
      );
    });
  });

  describe('validateStructure - 结构验证 (需求 1.1, 1.2)', () => {
    it('应该在文档目录不存在时返回错误', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await manager.validateStructure(testDocsDir);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('DOCS_DIR_NOT_FOUND');
      expect(result.errors[0].message).toContain(testDocsDir);
    });

    it('应该在缺少标准子目录时返回警告', async () => {
      // 主目录存在
      mockFs.access
        .mockResolvedValueOnce(undefined) // docs/ 存在
        .mockRejectedValueOnce(new Error('ENOENT')) // api/ 不存在
        .mockResolvedValueOnce(undefined) // architecture/ 存在
        .mockRejectedValueOnce(new Error('ENOENT')) // database/ 不存在
        .mockResolvedValueOnce(undefined) // deployment/ 存在
        .mockResolvedValueOnce(undefined) // development/ 存在
        .mockResolvedValueOnce(undefined) // troubleshooting/ 存在
        .mockResolvedValueOnce(undefined) // templates/ 存在
        .mockRejectedValueOnce(new Error('ENOENT')); // README.md 不存在

      const result = await manager.validateStructure(testDocsDir);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      
      // 检查缺少目录的警告
      const missingDirWarnings = result.warnings.filter(
        w => w.code === 'MISSING_DIRECTORY'
      );
      expect(missingDirWarnings.length).toBe(2); // api 和 database
    });

    it('应该在缺少 README.md 时返回警告', async () => {
      // 所有目录都存在，但 README.md 不存在
      mockFs.access
        .mockResolvedValueOnce(undefined) // docs/
        .mockResolvedValueOnce(undefined) // api/
        .mockResolvedValueOnce(undefined) // architecture/
        .mockResolvedValueOnce(undefined) // database/
        .mockResolvedValueOnce(undefined) // deployment/
        .mockResolvedValueOnce(undefined) // development/
        .mockResolvedValueOnce(undefined) // troubleshooting/
        .mockResolvedValueOnce(undefined) // templates/
        .mockRejectedValueOnce(new Error('ENOENT')); // README.md 不存在

      const result = await manager.validateStructure(testDocsDir);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_INDEX',
          message: expect.stringContaining('README.md')
        })
      );
    });

    it('应该在所有结构完整时返回有效结果', async () => {
      // 所有目录和 README.md 都存在
      mockFs.access.mockResolvedValue(undefined);

      const result = await manager.validateStructure(testDocsDir);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('应该在验证过程中发生错误时返回错误结果', async () => {
      // 模拟在检查子目录时抛出的意外错误（不是简单的 ENOENT）
      // 由于 pathExists 会捕获所有错误，我们需要在 try 块的其他地方触发错误
      // 这个测试验证了 catch 块的存在和正确性
      
      // 实际上，由于 pathExists 捕获了所有错误，这个场景很难触发
      // 但我们可以通过让 access 在第一次调用时就抛出非标准错误来测试
      const criticalError: any = new Error('Critical filesystem error');
      criticalError.code = 'EIO'; // I/O 错误
      
      // 让第一次检查主目录时就失败
      mockFs.access.mockRejectedValue(criticalError);

      const result = await manager.validateStructure(testDocsDir);

      // 由于 pathExists 捕获了错误，主目录会被认为不存在
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'DOCS_DIR_NOT_FOUND'
        })
      );
    });
  });

  describe('generateIndex - 索引生成 (需求 1.4)', () => {
    it('应该生成包含标题和说明的索引', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue([]);

      const index = await manager.generateIndex(testDocsDir);

      expect(index).toContain('# 项目文档');
      expect(index).toContain('本目录包含项目的所有文档');
      expect(index).toContain('## 文档结构');
    });

    it('应该列出所有标准目录及其描述', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue([]);

      const index = await manager.generateIndex(testDocsDir);

      const expectedDirs = [
        'api',
        'architecture',
        'database',
        'deployment',
        'development',
        'troubleshooting',
        'templates'
      ];

      for (const dir of expectedDirs) {
        expect(index).toContain(`### ${dir}/`);
      }

      expect(index).toContain('API 文档');
      expect(index).toContain('系统架构文档');
      expect(index).toContain('数据库设计文档');
    });

    it('应该列出目录中的 Markdown 文件', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir
        .mockResolvedValueOnce(['rest-api.md', 'websocket.md', 'openapi.yaml'] as any)
        .mockResolvedValue([]);

      const index = await manager.generateIndex(testDocsDir);

      // 使用正则表达式匹配，兼容不同的路径分隔符
      expect(index).toMatch(/\[rest api\]\(api[\/\\]rest-api\.md\)/);
      expect(index).toMatch(/\[websocket\]\(api[\/\\]websocket\.md\)/);
      // 不应该包含非 .md 文件
      expect(index).not.toContain('openapi.yaml');
    });

    it('应该包含文档维护信息', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue([]);

      const index = await manager.generateIndex(testDocsDir);

      expect(index).toContain('## 文档维护');
      expect(index).toContain('Markdown 格式');
      expect(index).toContain('最后更新日期');
      expect(index).toContain('*最后更新:');
    });

    it('应该包含当前日期', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue([]);

      const index = await manager.generateIndex(testDocsDir);

      const today = new Date().toISOString().split('T')[0];
      expect(index).toContain(today);
    });

    it('应该优雅地处理目录读取错误', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      // 不应该抛出错误，而是跳过该目录
      await expect(manager.generateIndex(testDocsDir)).resolves.not.toThrow();
    });

    it('应该跳过不存在的目录', async () => {
      // 只有部分目录存在
      mockFs.access
        .mockResolvedValueOnce(undefined) // api/ 存在
        .mockRejectedValueOnce(new Error('ENOENT')) // architecture/ 不存在
        .mockResolvedValueOnce(undefined) // database/ 存在
        .mockRejectedValueOnce(new Error('ENOENT')) // deployment/ 不存在
        .mockRejectedValueOnce(new Error('ENOENT')) // development/ 不存在
        .mockRejectedValueOnce(new Error('ENOENT')) // troubleshooting/ 不存在
        .mockRejectedValueOnce(new Error('ENOENT')); // templates/ 不存在

      mockFs.readdir.mockResolvedValue([]);

      const index = await manager.generateIndex(testDocsDir);

      // 应该只包含存在的目录
      expect(index).toContain('### api/');
      expect(index).toContain('### database/');
      // 不存在的目录不应该出现
      expect(index.match(/### architecture\//g)).toBeNull();
    });
  });

  describe('边缘情况测试', () => {
    it('应该处理空的根目录路径', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);

      await manager.createStructure('');

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        'docs',
        { recursive: true }
      );
    });

    it('应该处理包含特殊字符的路径', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      const specialPath = '/tmp/test project (2024)';

      await manager.createStructure(specialPath);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(specialPath, 'docs'),
        { recursive: true }
      );
    });

    it('应该处理 Windows 风格的路径', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      const windowsPath = 'C:\\Users\\Test\\Project';

      await manager.createStructure(windowsPath);

      expect(mockFs.mkdir).toHaveBeenCalled();
    });
  });

  describe('migrateDocuments - 文档迁移功能 (需求 1.3, 1.5)', () => {
    const testStructure: DocumentStructure = {
      root: testRootDir,
      directories: []
    };

    beforeEach(() => {
      // 设置 exec mock 的默认行为
      (mockExec as any).mockImplementation((command: string, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });
    });

    it('应该在 Git 仓库中使用 git mv 迁移文件', async () => {
      const oldPaths = ['README.md', 'API.md'];
      
      // Mock 文件存在检查
      mockFs.access.mockResolvedValue(undefined);
      
      // Mock Git 命令执行
      (mockExec as any).mockImplementation((command: string, callback: any) => {
        if (command.includes('rev-parse')) {
          // Git 仓库检查成功
          callback(null, { stdout: '.git\n', stderr: '' });
        } else if (command.includes('ls-files')) {
          // 文件被 Git 跟踪
          callback(null, { stdout: 'README.md\n', stderr: '' });
        } else if (command.includes('git mv')) {
          // git mv 成功
          callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });
      
      mockFs.mkdir.mockResolvedValue(undefined);

      await manager.migrateDocuments(oldPaths, testStructure);

      // 验证创建了目标目录
      expect(mockFs.mkdir).toHaveBeenCalled();
    });

    it('应该在非 Git 仓库中使用普通文件移动', async () => {
      const oldPaths = ['README.md'];
      
      mockFs.access.mockResolvedValue(undefined);
      
      // Mock Git 仓库检查失败
      (mockExec as any).mockImplementation((command: string, callback: any) => {
        callback(new Error('Not a git repository'), { stdout: '', stderr: '' });
        return {} as any;
      });
      
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);

      await manager.migrateDocuments(oldPaths, testStructure);

      // 验证使用了普通文件移动
      expect(mockFs.rename).toHaveBeenCalledWith(
        'README.md',
        expect.stringContaining('README.md')
      );
    });

    it('应该在 git mv 失败时降级为普通文件移动', async () => {
      const oldPaths = ['README.md'];
      
      mockFs.access.mockResolvedValue(undefined);
      
      // Mock Git 命令：仓库检查成功，但 git mv 失败
      (mockExec as any).mockImplementation((command: string, callback: any) => {
        if (command.includes('rev-parse')) {
          callback(null, { stdout: '.git\n', stderr: '' });
        } else {
          callback(new Error('git command failed'), { stdout: '', stderr: '' });
        }
        return {} as any;
      });
      
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);

      await manager.migrateDocuments(oldPaths, testStructure);

      // 验证降级为普通文件移动
      expect(mockFs.rename).toHaveBeenCalled();
    });

    it('应该跳过不存在的文件', async () => {
      const oldPaths = ['nonexistent.md', 'README.md'];
      
      // 第一个文件不存在，第二个存在
      mockFs.access
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValue(undefined);
      
      (mockExec as any).mockImplementation((command: string, callback: any) => {
        callback(new Error('Not a git repository'), { stdout: '', stderr: '' });
        return {} as any;
      });
      
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);

      await manager.migrateDocuments(oldPaths, testStructure);

      // 验证只移动了一个文件
      expect(mockFs.rename).toHaveBeenCalledTimes(1);
    });

    it('应该根据文件名确定正确的目标目录', async () => {
      const oldPaths = [
        'API_DOCS.md',
        'ARCHITECTURE.md',
        'DATABASE_SCHEMA.md',
        'DEPLOYMENT.md',
        'DEVELOPMENT.md',
        'TROUBLESHOOTING.md',
        'TEMPLATE.md',
        'OTHER.md'
      ];
      
      mockFs.access.mockResolvedValue(undefined);
      (mockExec as any).mockImplementation((command: string, callback: any) => {
        callback(new Error('Not a git repository'), { stdout: '', stderr: '' });
        return {} as any;
      });
      
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);

      await manager.migrateDocuments(oldPaths, testStructure);

      // 验证文件被移动到正确的目录
      expect(mockFs.rename).toHaveBeenCalledWith(
        'API_DOCS.md',
        expect.stringContaining(path.join('docs', 'api', 'API_DOCS.md'))
      );
      
      expect(mockFs.rename).toHaveBeenCalledWith(
        'ARCHITECTURE.md',
        expect.stringContaining(path.join('docs', 'architecture', 'ARCHITECTURE.md'))
      );
      
      expect(mockFs.rename).toHaveBeenCalledWith(
        'DATABASE_SCHEMA.md',
        expect.stringContaining(path.join('docs', 'database', 'DATABASE_SCHEMA.md'))
      );
      
      expect(mockFs.rename).toHaveBeenCalledWith(
        'DEPLOYMENT.md',
        expect.stringContaining(path.join('docs', 'deployment', 'DEPLOYMENT.md'))
      );
      
      expect(mockFs.rename).toHaveBeenCalledWith(
        'DEVELOPMENT.md',
        expect.stringContaining(path.join('docs', 'development', 'DEVELOPMENT.md'))
      );
      
      expect(mockFs.rename).toHaveBeenCalledWith(
        'TROUBLESHOOTING.md',
        expect.stringContaining(path.join('docs', 'troubleshooting', 'TROUBLESHOOTING.md'))
      );
      
      expect(mockFs.rename).toHaveBeenCalledWith(
        'TEMPLATE.md',
        expect.stringContaining(path.join('docs', 'templates', 'TEMPLATE.md'))
      );
      
      // OTHER.md 应该放在 docs 根目录
      expect(mockFs.rename).toHaveBeenCalledWith(
        'OTHER.md',
        expect.stringContaining(path.join('docs', 'OTHER.md'))
      );
    });

    it('应该处理文件移动失败的情况', async () => {
      const oldPaths = ['README.md'];
      
      mockFs.access.mockResolvedValue(undefined);
      (mockExec as any).mockImplementation((command: string, callback: any) => {
        callback(new Error('Not a git repository'), { stdout: '', stderr: '' });
        return {} as any;
      });
      
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.rename.mockRejectedValue(new Error('Permission denied'));

      // 不应该抛出错误，而是记录错误并继续
      await expect(manager.migrateDocuments(oldPaths, testStructure)).resolves.not.toThrow();
    });

    it('应该确保目标目录存在', async () => {
      const oldPaths = ['README.md'];
      
      mockFs.access.mockResolvedValue(undefined);
      (mockExec as any).mockImplementation((command: string, callback: any) => {
        callback(new Error('Not a git repository'), { stdout: '', stderr: '' });
        return {} as any;
      });
      
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);

      await manager.migrateDocuments(oldPaths, testStructure);

      // 验证创建了目标目录
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
    });
  });
});
