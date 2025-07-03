#!/bin/bash

# AI Interview Helper 开发环境启动脚本

set -e

echo "🚀 启动AI面试助手开发环境..."

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

# 检查当前目录
if [ ! -f "docker-compose.dev.yml" ]; then
    echo "❌ 未找到docker-compose.dev.yml文件，请在项目根目录执行此脚本"
    exit 1
fi

# 停止并删除旧容器（如果存在）
echo "🧹 清理旧容器..."
docker-compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || docker compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true

# 构建并启动服务
echo "🔨 构建并启动开发环境..."
if command -v docker-compose &> /dev/null; then
    docker-compose -f docker-compose.dev.yml up --build -d
else
    docker compose -f docker-compose.dev.yml up --build -d
fi

# 等待数据库启动
echo "⏳ 等待数据库启动..."
sleep 15

# 初始化默认用户
echo "👤 初始化默认用户..."
if command -v docker-compose &> /dev/null; then
    docker-compose -f docker-compose.dev.yml exec backend python init_default_user.py
else
    docker compose -f docker-compose.dev.yml exec backend python init_default_user.py
fi

echo ""
echo "🎉 开发环境启动完成！"
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
echo "🔧 开发命令："
echo "  - 查看日志: docker-compose -f docker-compose.dev.yml logs -f"
echo "  - 进入后端容器: docker-compose -f docker-compose.dev.yml exec backend bash"
echo "  - 停止服务: docker-compose -f docker-compose.dev.yml down"
echo ""
echo "💡 提示："
echo "  - 代码修改会自动重载"
echo "  - 数据库数据持久化保存"