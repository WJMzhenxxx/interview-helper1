#!/usr/bin/env bash
#
# AI Interview Helper — 本地一键启动脚本（原生栈 + SQLite，零外部依赖）
#
# 前提：
#   - 已安装：bash、uv、node、npm（无需数据库，后端默认使用 SQLite）
#
# 行为：
#   - 缺失时才安装依赖（后端 .venv 不存在则 uv sync，前端 node_modules
#     不存在则 npm install），已存在直接启动
#   - 后端以后台方式启动（uvicorn，端口 9000）
#   - 前端以后台方式启动（vite dev，端口 5173）
#   - 自动为后端/前端创建 .env（若缺则从 .env.example 复制）
#   - 每次启动后端前幂等执行建表 + 默认用户
#
# 用法：从项目根目录执行  bash scripts/start-all.sh

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
PID_DIR="$ROOT_DIR/.run"
BACKEND_PID=""
FRONTEND_PID=""

# ---------- 通用工具 ----------
log()  { echo -e "\033[1;34m[一键启动]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[OK]\033[0m $*"; }
warn() { echo -e "\033[1;33m[警告]\033[0m $*"; }
fail() { echo -e "\033[1;31m[失败]\033[0m $*"; }

cleanup() {
  # 记录 PID，方便单独停止
  :
}

trap 'echo -e "\n\033[1;36m接收到退出信号，正在停止后台进程...\033[0m"; [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null; [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null; exit 0' INT TERM

echo "==================================================================="
echo "  AI Interview Helper — 一键启动"
echo "==================================================================="

# ---------- 前置依赖检查 ----------
need_cmd() {
  if ! command -v "$1" &>/dev/null; then
    fail "缺少命令: $1"
    case "$1" in
      uv)    echo "  请安装 uv：https://docs.astral.sh/uv/ ；或 pip install uv" ;;
      node|npm) echo "  请安装 Node.js 16+：https://nodejs.org/" ;;
    esac
    return 1
  fi
  return 0
}

for c in uv node npm; do
  need_cmd "$c" || exit 1
done

# ---------- 1. 后端 ----------
log "准备后端环境..."

if [ ! -f "$BACKEND_DIR/.env" ]; then
  if [ -f "$BACKEND_DIR/.env.example" ]; then
    warn "后端缺少 .env，从 .env.example 复制（请自行填入 DEEPSEEK_API_KEY 等）"
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  else
    fail "后端缺少 .env.example，无法生成配置"
    exit 1
  fi
fi

if [ ! -d "$BACKEND_DIR/.venv" ]; then
  log "后端虚拟环境不存在，执行 uv sync（首次会安装依赖，可能较慢）..."
  ( cd "$BACKEND_DIR" && uv sync )
else
  ok "后端虚拟环境已存在，跳过依赖安装"
fi

# 幂等：建表 + 默认用户（不重复创建）
log "初始化数据库表结构与默认用户（幂等）..."
( cd "$BACKEND_DIR" && uv run -q python -X utf8 -c "
import sys
sys.path.append('.')
from app.database import engine
from app.models import Base
Base.metadata.create_all(bind=engine)
print('表结构已就绪')
" && uv run -q python -X utf8 init_default_user.py ) || warn "初始化数据库失败，请检查 backend/.env 与文件写入权限"

# 后台启动后端
log "后台启动后端（uvicorn :9000）..."
mkdir -p "$PID_DIR"
( cd "$BACKEND_DIR" && uv run -q python run_server.py >"$PID_DIR/backend.log" 2>&1 & echo $! > "$PID_DIR/backend.pid" )
sleep 2
BACKEND_PID="$(cat "$PID_DIR/backend.pid" 2>/dev/null || true)"

if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
  ok "后端已启动 (PID $BACKEND_PID)，日志: $PID_DIR/backend.log"
else
  warn "后端可能启动失败，请查看日志: $PID_DIR/backend.log"
fi

# ---------- 2. 前端 ----------
log "准备前端环境..."

if [ ! -f "$FRONTEND_DIR/.env" ]; then
  if [ -f "$FRONTEND_DIR/.env.example" ]; then
    warn "前端缺少 .env，从 .env.example 复制"
    cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env"
  fi
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  log "前端依赖不存在，执行 npm install（首次较慢）..."
  ( cd "$FRONTEND_DIR" && npm install )
else
  ok "前端依赖已存在，跳过 npm install"
fi

log "后台启动前端（vite dev :5173）..."
( cd "$FRONTEND_DIR" && npm run dev >"$PID_DIR/frontend.log" 2>&1 & echo $! > "$PID_DIR/frontend.pid" )
sleep 4
FRONTEND_PID="$(cat "$PID_DIR/frontend.pid" 2>/dev/null || true)"

if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
  ok "前端已启动 (PID $FRONTEND_PID)，日志: $PID_DIR/frontend.log"
else
  warn "前端可能启动失败，请查看日志: $PID_DIR/frontend.log"
fi

# ---------- 汇总 ----------
echo ""
echo "==================================================================="
echo "  🎉 启动完成！"
echo "==================================================================="
echo "  前端:      http://localhost:5173"
echo "  后端:      http://localhost:9000"
echo "  API文档:   http://localhost:9000/docs"
echo ""
echo "  默认账户:  test / test1234"
echo ""
echo "  后端日志:  $PID_DIR/backend.log"
echo "  前端日志:  $PID_DIR/frontend.log"
echo ""
echo "  💡 停止服务："
echo "     bash scripts/stop-all.sh"
echo "     或手动 kill PID：backend=$(cat "$PID_DIR/backend.pid" 2>/dev/null)  frontend=$(cat "$PID_DIR/frontend.pid" 2>/dev/null)"
echo "==================================================================="
exit 0
