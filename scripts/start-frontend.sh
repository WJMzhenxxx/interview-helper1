#!/bin/bash

# AI Interview Helper 前端启动脚本

set -e

echo "🚀 启动AI面试助手前端开发服务器..."

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ Node.js未安装，请先安装Node.js 16+"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm未安装，请先安装npm"
    exit 1
fi

echo "✅ Node.js版本: $(node --version)"
echo "✅ npm版本: $(npm --version)"

# 检查当前目录
if [ ! -d "frontend" ]; then
    echo "❌ 未找到frontend目录，请在项目根目录执行此脚本"
    exit 1
fi

# 进入前端目录
cd frontend

# 检查并创建环境变量文件
if [ ! -f ".env" ]; then
    echo "⚠️  未找到.env文件，正在复制示例配置..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ 已创建.env文件"
    else
        echo "🔧 创建默认.env文件..."
        cat > .env << EOF
# API Base URL
VITE_API_BASE_URL=http://localhost:9000
EOF
        echo "✅ 已创建默认.env文件"
    fi
fi

# 检查后端API是否可用
echo "🔍 检查后端API连接..."
if curl -s -f http://localhost:9000/health > /dev/null 2>&1; then
    echo "✅ 后端API服务正常运行"
else
    echo "⚠️  后端API不可访问，请确保Docker容器正在运行"
    echo "💡 可以运行以下命令启动后端："
    echo "   docker-compose -f docker-compose.dev.yml up -d"
    echo ""
    echo "🔄 继续启动前端服务器..."
fi

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装前端依赖..."
    npm install
else
    echo "✅ 前端依赖已安装"
fi

# 启动开发服务器
echo "🌟 启动前端开发服务器..."
echo ""
echo "📝 服务信息："
echo "  - 前端地址: http://localhost:5173"
echo "  - 后端API: http://localhost:9000"
echo "  - API文档: http://localhost:9000/docs"
echo ""
echo "👤 默认登录账户："
echo "  - 用户名: test"
echo "  - 密码: test1234"
echo ""
echo "🛑 按Ctrl+C停止服务器"
echo "=" * 50

# 启动Vite开发服务器
npm run dev