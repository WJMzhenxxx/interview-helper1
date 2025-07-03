#!/bin/bash

# AI Interview Helper Docker启动脚本

set -e

echo "🐳 启动AI面试助手Docker环境..."

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

# 检查当前目录
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ 未找到docker-compose.yml文件，请在项目根目录执行此脚本"
    exit 1
fi

# 停止并删除旧容器（如果存在）
echo "🧹 清理旧容器..."
docker-compose down --remove-orphans 2>/dev/null || docker compose down --remove-orphans 2>/dev/null || true

# 构建并启动服务
echo "🔨 构建并启动服务..."
if command -v docker-compose &> /dev/null; then
    docker-compose up --build -d
else
    docker compose up --build -d
fi

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "📊 检查服务状态..."
if command -v docker-compose &> /dev/null; then
    docker-compose ps
else
    docker compose ps
fi

# 初始化默认用户
echo "👤 初始化默认用户..."
if command -v docker-compose &> /dev/null; then
    docker-compose exec backend python init_default_user.py
else
    docker compose exec backend python init_default_user.py
fi

echo ""
echo "🎉 AI面试助手启动完成！"
echo ""
echo "📝 服务地址："
echo "  - 后端API: http://localhost:9000"
echo "  - API文档: http://localhost:9000/docs"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo ""
echo "👤 默认账户："
echo "  - 用户名: test"
echo "  - 密码: test1234"
echo ""
echo "🔧 管理命令："
echo "  - 查看日志: ./scripts/docker-logs.sh"
echo "  - 停止服务: ./scripts/docker-stop.sh"
echo "  - 重启服务: ./scripts/docker-restart.sh"