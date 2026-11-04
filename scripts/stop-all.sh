#!/usr/bin/env bash
#
# AI Interview Helper — 一键停止脚本
# 停止 start-all.sh 启动的后端与前端后台进程

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT_DIR/.run"

echo "==================================================================="
echo "  AI Interview Helper — 一键停止"
echo "==================================================================="

stop_one() {
  local name="$1" pidfile="$2"
  if [ -f "$pidfile" ]; then
    local pid
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "  正在停止 $name (PID $pid)..."
      kill "$pid" 2>/dev/null || true
    else
      echo "  $name 未在运行（或 PID 失效）"
    fi
    rm -f "$pidfile"
  else
    echo "  $name 未找到 PID 文件"
  fi
}

stop_one "前端(frontend 5173)" "$PID_DIR/frontend.pid"
stop_one "后端(backend 9000)" "$PID_DIR/backend.pid"

echo ""
echo "  ✅ 已停止。可运行 bash scripts/start-all.sh 重新启动。"
echo "==================================================================="
exit 0
