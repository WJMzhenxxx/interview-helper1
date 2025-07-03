#!/bin/bash

# AI Interview Helper Docker停止脚本

echo "🛑 停止AI面试助手Docker服务..."

if [ ! -f "docker-compose.yml" ]; then
    echo "❌ 未找到docker-compose.yml文件，请在项目根目录执行此脚本"
    exit 1
fi

# 停止服务
if command -v docker-compose &> /dev/null; then
    docker-compose down
else
    docker compose down
fi

echo "✅ 服务已停止"