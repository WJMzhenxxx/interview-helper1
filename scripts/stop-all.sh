#!/usr/bin/env bash
#
# AI Interview Helper — 一键停止脚本
# 停止 start-all.sh 启动的后端与前端后台进程
#
# 停止策略（修复"找不到 PID / 端口残留"问题）：
#   1. 优先终止整个进程组（PGID，负 PID）：start-all.sh 用 setsid 启动时，
#      能连 npm 派生的 vite 子进程一起杀掉，避免 vite 孤儿残留占住端口。
#   2. 递归 kill 所有子进程（pkill -P）作为兜底。
#   3. 若仍有残留，按端口精确匹配并结束占用者。

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT_DIR/.run"

echo "==================================================================="
echo "  AI Interview Helper — 一键停止"
echo "==================================================================="

kill_tree() {
  local pid="$1"
  # 先递归杀子进程
  local child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}

stop_one() {
  local name="$1" pidfile="$2"
  if [ -f "$pidfile" ]; then
    local pid
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "  正在停止 $name (PID $pid)..."
      # 1) 若该 PID 是进程组组长，先尝试杀进程组
      kill -- "-$pid" 2>/dev/null || true
      # 2) 递归杀子进程 + 本体
      kill_tree "$pid"
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

# 兜底：若 5173 / 9000 端口仍被残留进程占用，按端口精确结束它们。
# 通过 ss/lsof/netstat 找到占用者并 kill（防误杀，只针对本服务端口附近）。
echo ""
echo "  检查残留端口占用..."
for port in 5173 5174 5175 9000; do
  owner=""
  if command -v lsof &>/dev/null; then
    owner="$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | tr '\n' ' ')"
  elif command -v ss &>/dev/null; then
    owner="$(ss -tlnp 2>/dev/null | grep ":$port " | grep -oE 'pid=[0-9]+' | grep -oE '[0-9]+' | sort -u | tr '\n' ' ')"
  elif command -v fuser &>/dev/null; then
    owner="$(fuser "$port/tcp" 2>/dev/null | tr '\n' ' ')"
  fi
  if [[ -n "$owner" ]]; then
    echo "  端口 $port 仍被 PID(s) [$owner] 占用，正在结束..."
    for p in $owner; do
      [[ "$p" =~ ^[0-9]+$ ]] && kill -9 "$p" 2>/dev/null || true
    done
  fi
done

echo ""
echo "  ✅ 已停止。可运行 bash scripts/start-all.sh 重新启动。"
echo "==================================================================="
exit 0
