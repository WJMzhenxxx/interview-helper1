#!/bin/bash

# AI Interview Helper Docker重启脚本

echo "🔄 重启AI面试助手Docker服务..."

if [ ! -f "docker-compose.yml" ]; then
    echo "❌ 未找到docker-compose.yml文件，请在项目根目录执行此脚本"
    exit 1
fi

# 重启服务
if command -v docker-compose &> /dev/null; then
    docker-compose restart
else
    docker compose restart
fi

echo "✅ 服务已重启"

# 显示状态
echo "📊 服务状态："
if command -v docker-compose &> /dev/null; then
    docker-compose ps
else
    docker compose ps
fi