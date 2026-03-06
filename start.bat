@echo off
chcp 65001 >nul
title 智能股票分析网站 - 一键启动

echo ========================================
echo   智能股票分析网站 - 一键启动脚本
echo ========================================
echo.

:: 检查 Node.js 是否安装
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js ^(^>=18.0.0^)
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

:: 显示 Node.js 版本
echo [信息] Node.js 版本:
node -v
echo.

:: 检查是否需要安装依赖
if not exist "node_modules" (
    echo [信息] 正在安装根目录依赖...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [错误] 根目录依赖安装失败
        pause
        exit /b 1
    )
)

if not exist "backend\node_modules" (
    echo [信息] 正在安装后端依赖...
    cd backend
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [错误] 后端依赖安装失败
        cd ..
        pause
        exit /b 1
    )
    cd ..
)

if not exist "frontend\node_modules" (
    echo [信息] 正在安装前端依赖...
    cd frontend
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [错误] 前端依赖安装失败
        cd ..
        pause
        exit /b 1
    )
    cd ..
)

:: 检查环境配置文件
if not exist "backend\.env" (
    echo [警告] 后端环境配置文件不存在，正在从示例文件创建...
    copy backend\.env.example backend\.env >nul
    echo [信息] 已创建 backend\.env，请根据需要修改配置
)

if not exist "frontend\.env.development" (
    if exist "frontend\.env.example" (
        echo [警告] 前端环境配置文件不存在，正在从示例文件创建...
        copy frontend\.env.example frontend\.env.development >nul
        echo [信息] 已创建 frontend\.env.development，请根据需要修改配置
    )
)

echo.
echo ========================================
echo   正在启动前后端服务...
echo ========================================
echo.
echo   后端服务: http://localhost:3001
echo   前端服务: http://localhost:5173
echo.
echo   按 Ctrl+C 停止所有服务
echo ========================================
echo.

:: 启动前后端服务
call npm run dev
