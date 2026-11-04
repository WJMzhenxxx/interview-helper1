#!/bin/bash

# AI Interview Helper Backend Setup Script
# 后端环境安装和数据库初始化脚本（使用 uv 管理 + SQLite，零外部依赖）

set -e

echo "🚀 开始设置AI面试助手后端环境..."

# 检查 uv
if ! command -v uv &>/dev/null; then
  echo "❌ 未找到 uv，请先安装 uv：pip install uv 或 https://docs.astral.sh/uv/"
  exit 1
fi
echo "✅ uv 版本: $(uv --version)"

# 检查和配置环境变量
echo "🔧 检查环境变量配置..."
if [ ! -f .env ]; then
  echo "⚠️  未找到.env文件，正在复制示例配置..."
  cp .env.example .env
  echo "✅ 已创建.env文件，请根据需要修改 JWT 密钥与 DEEPSEEK_API_KEY"
  echo "⚠️  重要：请修改.env文件中的 SECRET_KEY 为强密码！"
fi

# 用 uv 创建虚拟环境并安装依赖
echo "📦 使用 uv 安装Python依赖..."
uv sync

# 创建数据库表（幂等）
echo "📊 创建数据库表结构..."
uv run -q python -X utf8 -c "
import sys
sys.path.append('.')
from app.database import engine
from app.models import Base
Base.metadata.create_all(bind=engine)
print('✅ 数据库表创建成功')
"

# 创建默认用户
echo "👤 创建默认用户账户..."
uv run -q python -X utf8 init_default_user.py

echo "🎉 后端环境设置完成!"
echo ""
echo "📝 使用说明:"
echo "  1. 启动后端服务: uv run python run_server.py"
echo "  2. API文档地址: http://localhost:9000/docs"
echo "  3. 默认用户: test / test1234"
echo ""
echo "🔧 环境配置:"
echo "  - Python虚拟环境: .venv (uv 管理)"
echo "  - 数据库: SQLite (backend/ai_interview_helper.db)"
echo "  - 后端端口: 9000"
echo ""
echo "🔐 安全提醒:"
echo "  - .env文件包含敏感信息，已加入.gitignore"
echo "  - 生产环境请务必修改SECRET_KEY为强密码"
echo "  - API密钥等敏感信息不会提交到版本控制"
