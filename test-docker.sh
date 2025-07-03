#!/bin/bash

# AI Interview Helper Docker环境测试脚本

echo "🧪 测试AI面试助手Docker环境..."

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装"
    exit 1
fi

echo "✅ Docker已安装: $(docker --version)"

# 检查Docker Compose
if command -v docker-compose &> /dev/null; then
    echo "✅ Docker Compose已安装: $(docker-compose --version)"
elif docker compose version &> /dev/null; then
    echo "✅ Docker Compose已安装: $(docker compose version)"
else
    echo "❌ Docker Compose未安装"
    exit 1
fi

# 检查必要文件
echo "📋 检查项目文件..."
required_files=(
    "docker-compose.yml"
    "docker-compose.dev.yml"
    "backend/Dockerfile"
    "backend/requirements.txt"
    "scripts/docker-start.sh"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file 不存在"
        exit 1
    fi
done

# 测试Docker Compose配置
echo "🔍 验证Docker Compose配置..."
if command -v docker-compose &> /dev/null; then
    docker-compose config > /dev/null
    if [ $? -eq 0 ]; then
        echo "✅ docker-compose.yml 配置有效"
    else
        echo "❌ docker-compose.yml 配置无效"
        exit 1
    fi
    
    docker-compose -f docker-compose.dev.yml config > /dev/null
    if [ $? -eq 0 ]; then
        echo "✅ docker-compose.dev.yml 配置有效"
    else
        echo "❌ docker-compose.dev.yml 配置无效"
        exit 1
    fi
else
    docker compose config > /dev/null
    if [ $? -eq 0 ]; then
        echo "✅ docker-compose.yml 配置有效"
    else
        echo "❌ docker-compose.yml 配置无效"
        exit 1
    fi
    
    docker compose -f docker-compose.dev.yml config > /dev/null
    if [ $? -eq 0 ]; then
        echo "✅ docker-compose.dev.yml 配置有效"
    else
        echo "❌ docker-compose.dev.yml 配置无效"
        exit 1
    fi
fi

echo ""
echo "🎉 Docker环境测试通过！"
echo ""
echo "📝 可以使用以下命令启动："
echo "  - 生产环境: ./scripts/docker-start.sh"
echo "  - 开发环境: ./scripts/dev-start.sh"
echo "  - 手动启动: docker-compose up --build -d"