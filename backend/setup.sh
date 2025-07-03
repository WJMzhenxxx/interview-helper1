#!/bin/bash

# AI Interview Helper Backend Setup Script
# 后端环境安装和数据库初始化脚本

set -e

echo "🚀 开始设置AI面试助手后端环境..."

# 检查Python版本
echo "📋 检查Python版本..."
python3 --version

# 创建虚拟环境
echo "🔧 创建Python虚拟环境..."
python3 -m venv venv

# 检查和配置环境变量
echo "🔧 检查环境变量配置..."
if [ ! -f .env ]; then
  echo "⚠️  未找到.env文件，正在复制示例配置..."
  cp .env.example .env
  echo "✅ 已创建.env文件，请根据需要修改JWT密钥等配置"
  echo "⚠️  重要：请修改.env文件中的SECRET_KEY为强密码！"
fi

# 激活虚拟环境
echo "✅ 激活虚拟环境..."
source venv/bin/activate

# 安装依赖
echo "📦 安装Python依赖..."
pip install -r requirements.txt

# 测试数据库连接并创建数据库
echo "🗄️ 初始化数据库连接..."
python test_db.py

# 创建数据库表
echo "📊 创建数据库表结构..."
python -c "
import sys
sys.path.append('.')
from app.database import engine
from app.models import Base
Base.metadata.create_all(bind=engine)
print('✅ 数据库表创建成功')
"

# 创建默认用户
echo "👤 创建默认用户账户..."
python init_default_user.py

echo "🎉 后端环境设置完成!"
echo ""
echo "📝 使用说明:"
echo "  1. 启动后端服务: python run_server.py"
echo "  2. API文档地址: http://localhost:9000/docs"
echo "  3. 默认用户: test / test1234"
echo ""
echo "🔧 环境配置:"
echo "  - Python虚拟环境: ./venv"
echo "  - 数据库: PostgreSQL (localhost:5432)"
echo "  - Redis: localhost:6379"
echo "  - 后端端口: 9000"
echo ""
echo "🔐 安全提醒:"
echo "  - .env文件包含敏感信息，已加入.gitignore"
echo "  - 生产环境请务必修改SECRET_KEY为强密码"
echo "  - API密钥等敏感信息不会提交到版本控制"