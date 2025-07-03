#!/bin/bash

# AI Interview Helper Docker日志查看脚本

echo "📋 AI面试助手服务日志..."

if [ ! -f "docker-compose.yml" ]; then
    echo "❌ 未找到docker-compose.yml文件，请在项目根目录执行此脚本"
    exit 1
fi

# 显示所有服务日志
if [ "$1" == "" ]; then
    echo "🔍 显示所有服务日志 (按Ctrl+C退出)..."
    if command -v docker-compose &> /dev/null; then
        docker-compose logs -f
    else
        docker compose logs -f
    fi
else
    echo "🔍 显示 $1 服务日志 (按Ctrl+C退出)..."
    if command -v docker-compose &> /dev/null; then
        docker-compose logs -f $1
    else
        docker compose logs -f $1
    fi
fi