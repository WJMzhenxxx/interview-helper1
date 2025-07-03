#!/bin/bash

# AI Interview Helper Frontend Setup Script
# 前端环境安装和配置脚本

set -e

echo "🚀 开始设置AI面试助手前端环境..."

# 检查Node.js版本
echo "📋 检查Node.js版本..."
node --version
npm --version

# 检查和配置环境变量
echo "🔧 检查环境变量配置..."
if [ ! -f .env ]; then
  echo "⚠️  未找到.env文件，正在复制示例配置..."
  cp .env.example .env
  echo "✅ 已创建.env文件"
  echo "📝 注意：科大讯飞API密钥建议在应用内设置页面配置"
fi

# 安装依赖
echo "📦 安装前端依赖..."
npm install

echo "🎉 前端环境设置完成!"
echo ""
echo "📝 使用说明:"
echo "  1. 启动开发服务器: npm run dev"
echo "  2. 构建生产版本: npm run build"
echo "  3. 访问地址: http://localhost:5173"
echo ""
echo "🔧 环境配置:"
echo "  - Node.js项目，使用Vite构建"
echo "  - 后端API地址: http://localhost:9000"
echo "  - 默认登录: test / test1234"
echo ""
echo "🔐 API配置说明:"
echo "  - DeepSeek API密钥: 在应用内API配置页面填入"
echo "  - 科大讯飞API: 在应用内语音设置页面配置"
echo "  - 环境变量文件(.env)已加入.gitignore保护"