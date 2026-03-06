#!/usr/bin/env tsx

/**
 * Swagger UI 验证脚本
 * 
 * 此脚本验证 Swagger UI 配置是否正确，包括：
 * 1. OpenAPI 规范文件是否存在
 * 2. 规范文件格式是否正确
 * 3. Swagger UI 配置是否有效
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface ValidationResult {
  success: boolean;
  message: string;
  details?: string;
}

/**
 * 验证 OpenAPI 规范文件是否存在
 */
function validateOpenAPIFileExists(): ValidationResult {
  const openapiPath = join(process.cwd(), '..', 'docs', 'api', 'openapi.json');
  
  if (!existsSync(openapiPath)) {
    return {
      success: false,
      message: 'OpenAPI 规范文件不存在',
      details: `期望路径: ${openapiPath}`
    };
  }
  
  return {
    success: true,
    message: 'OpenAPI 规范文件存在',
    details: openapiPath
  };
}

/**
 * 验证 OpenAPI 规范文件格式是否正确
 */
function validateOpenAPIFormat(): ValidationResult {
  const openapiPath = join(process.cwd(), '..', 'docs', 'api', 'openapi.json');
  
  try {
    const content = readFileSync(openapiPath, 'utf-8');
    const spec = JSON.parse(content);
    
    // 验证必需字段
    if (!spec.openapi) {
      return {
        success: false,
        message: 'OpenAPI 规范缺少 openapi 版本字段'
      };
    }
    
    if (!spec.info) {
      return {
        success: false,
        message: 'OpenAPI 规范缺少 info 字段'
      };
    }
    
    if (!spec.paths) {
      return {
        success: false,
        message: 'OpenAPI 规范缺少 paths 字段'
      };
    }
    
    const pathCount = Object.keys(spec.paths).length;
    
    return {
      success: true,
      message: 'OpenAPI 规范格式正确',
      details: `版本: ${spec.openapi}, 端点数量: ${pathCount}`
    };
  } catch (error) {
    return {
      success: false,
      message: 'OpenAPI 规范文件格式错误',
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 验证 Swagger UI 配置文件是否存在
 */
function validateSwaggerConfigExists(): ValidationResult {
  const configPath = join(process.cwd(), 'src', 'config', 'swagger.ts');
  
  if (!existsSync(configPath)) {
    return {
      success: false,
      message: 'Swagger UI 配置文件不存在',
      details: `期望路径: ${configPath}`
    };
  }
  
  return {
    success: true,
    message: 'Swagger UI 配置文件存在',
    details: configPath
  };
}

/**
 * 验证 swagger-ui-express 依赖是否已安装
 */
function validateSwaggerDependency(): ValidationResult {
  const packageJsonPath = join(process.cwd(), 'package.json');
  
  try {
    const content = readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);
    
    if (!packageJson.dependencies || !packageJson.dependencies['swagger-ui-express']) {
      return {
        success: false,
        message: 'swagger-ui-express 依赖未安装'
      };
    }
    
    const version = packageJson.dependencies['swagger-ui-express'];
    
    return {
      success: true,
      message: 'swagger-ui-express 依赖已安装',
      details: `版本: ${version}`
    };
  } catch (error) {
    return {
      success: false,
      message: '无法读取 package.json',
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 主验证函数
 */
async function main() {
  console.log('🔍 开始验证 Swagger UI 配置...\n');
  
  const validations = [
    { name: '1. OpenAPI 规范文件存在性', fn: validateOpenAPIFileExists },
    { name: '2. OpenAPI 规范格式', fn: validateOpenAPIFormat },
    { name: '3. Swagger UI 配置文件', fn: validateSwaggerConfigExists },
    { name: '4. swagger-ui-express 依赖', fn: validateSwaggerDependency }
  ];
  
  let allPassed = true;
  
  for (const validation of validations) {
    const result = validation.fn();
    
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${validation.name}`);
    console.log(`   ${result.message}`);
    
    if (result.details) {
      console.log(`   详情: ${result.details}`);
    }
    
    console.log();
    
    if (!result.success) {
      allPassed = false;
    }
  }
  
  if (allPassed) {
    console.log('✨ 所有验证通过！Swagger UI 配置正确。');
    console.log('\n📚 访问 Swagger UI: http://localhost:3000/api-docs');
    process.exit(0);
  } else {
    console.log('⚠️  部分验证失败，请检查上述错误。');
    process.exit(1);
  }
}

// 运行验证
main().catch((error) => {
  console.error('❌ 验证过程中发生错误:', error);
  process.exit(1);
});
