#!/bin/bash

# 智能股票分析网站 - 一键启动脚本 (Unix/Linux/macOS)

set -e

echo "========================================"
echo "  智能股票分析网站 - 一键启动脚本"
echo "========================================"
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js，请先安装 Node.js (>=18.0.0)"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

# 显示 Node.js 版本
echo "[信息] Node.js 版本:"
node -v
echo ""

# 检查是否需要安装依赖
if [ ! -d "node_modules" ]; then
    echo "[信息] 正在安装根目录依赖..."
    npm install
fi

if [ ! -d "backend/node_modules" ]; then
    echo "[信息] 正在安装后端依赖..."
    cd backend
    npm install
    cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "[信息] 正在安装前端依赖..."
    cd frontend
    npm install
    cd ..
fi

# 检查环境配置文件
if [ ! -f "backend/.env" ]; then
    echo "[警告] 后端环境配置文件不存在，正在从示例文件创建..."
    cp backend/.env.example backend/.env
    echo "[信息] 已创建 backend/.env，请根据需要修改配置"
fi

if [ ! -f "frontend/.env.development" ]; then
    if [ -f "frontend/.env.example" ]; then
        echo "[警告] 前端环境配置文件不存在，正在从示例文件创建..."
        cp frontend/.env.example frontend/.env.development
        echo "[信息] 已创建 frontend/.env.development，请根据需要修改配置"
    fi
fi

echo ""
echo "========================================"
echo "  正在启动前后端服务..."
echo "========================================"
echo ""
echo "  后端服务: http://localhost:3001"
echo "  前端服务: http://localhost:5173"
echo ""
echo "  按 Ctrl+C 停止所有服务"
echo "========================================"
echo ""

# 启动前后端服务
npm run dev
