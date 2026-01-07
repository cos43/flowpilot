#!/bin/bash

# FlowPilot 自动化部署脚本
# 使用方法: ./deploy.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PID_FILE=".flowpilot.pid"
LOG_DIR="logs"
PORT="${PORT:-6001}"
HOST="${HOST:-0.0.0.0}"
NODE_ENV="${NODE_ENV:-production}"
NODE_MEM="${NODE_OPTIONS:---max_old_space_size=4096}"
BUILD_MARK=".last_build_commit"
LOCK_MARK=".last_lock_sha"

echo "🚀 FlowPilot 自动化部署开始"
echo "================================"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()  { echo -e "${YELLOW}$*${NC}"; }
ok()    { echo -e "${GREEN}$*${NC}"; }
err()   { echo -e "${RED}$*${NC}"; }
lock_sha() {
    if [[ -f pnpm-lock.yaml ]]; then
        sha256sum pnpm-lock.yaml | awk '{print $1}'
    elif [[ -f package-lock.json ]]; then
        sha256sum package-lock.json | awk '{print $1}'
    else
        echo "no-lock"
    fi
}
port_in_use() {
    fuser -n tcp "$1" > /dev/null 2>&1
}
wait_port_free() {
    local port="$1"
    for _ in {1..5}; do
        if ! port_in_use "$port"; then
            return 0
        fi
        sleep 1
    done
    return 1
}

# 1. 检查git状态
info "📋 步骤 1/6: 检查代码更新状态..."
git status -sb || true
echo ""

# 2. 安装依赖
info "📦 步骤 2/6: 安装依赖包..."
if command -v pnpm &> /dev/null; then
    pnpm install --frozen-lockfile || pnpm install
    ok "✓ 依赖安装完成 (pnpm)"
elif command -v npm &> /dev/null; then
    npm ci || npm install
    ok "✓ 依赖安装完成 (npm)"
else
    err "✗ 错误: 未找到 pnpm 或 npm"
    exit 1
fi
echo ""

# 3. 构建项目（成功后再切换，减少停机）
info "🔨 步骤 3/6: 构建项目..."
NEED_BUILD=1
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    if git diff --quiet --ignore-submodules -- && [[ -f "$BUILD_MARK" ]] && [[ -f "$LOCK_MARK" ]]; then
        CUR_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo nogit)"
        CUR_LOCK_SHA="$(lock_sha)"
        LAST_COMMIT="$(cat "$BUILD_MARK")"
        LAST_LOCK_SHA="$(cat "$LOCK_MARK")"
        if [[ "$CUR_COMMIT" == "$LAST_COMMIT" && "$CUR_LOCK_SHA" == "$LAST_LOCK_SHA" ]]; then
            NEED_BUILD=0
            ok "✓ 检测到代码和依赖未变，跳过构建"
        fi
    fi
fi

if [[ "$NEED_BUILD" -eq 1 ]]; then
    if command -v pnpm &> /dev/null; then
        NODE_ENV="$NODE_ENV" NODE_OPTIONS="$NODE_MEM" pnpm build
    else
        NODE_ENV="$NODE_ENV" NODE_OPTIONS="$NODE_MEM" npm run build
    fi
    CUR_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo nogit)"
    if ! git diff --quiet --ignore-submodules -- 2>/dev/null; then
        CUR_COMMIT="${CUR_COMMIT}-dirty-$(date +%s)"
    fi
    CUR_LOCK_SHA="$(lock_sha)"
    echo "$CUR_COMMIT" > "$BUILD_MARK"
    echo "$CUR_LOCK_SHA" > "$LOCK_MARK"
    ok "✓ 项目构建完成 (标记已更新)"
fi
echo ""

# 4. 停止当前运行的服务（优雅优先，兜底 kill）
info "🛑 步骤 4/6: 停止当前运行的服务..."
if [[ -f "$PID_FILE" ]]; then
    OLD_PID="$(cat "$PID_FILE")"
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo "发现 PID $OLD_PID，正在优雅停止..."
        kill "$OLD_PID" || true
        for _ in {1..10}; do
            if ps -p "$OLD_PID" > /dev/null 2>&1; then
                sleep 1
            else
                break
            fi
        done
        if ps -p "$OLD_PID" > /dev/null 2>&1; then
            echo "进程仍在，强制终止..."
            kill -9 "$OLD_PID" || true
        fi
    fi
    rm -f "$PID_FILE"
fi

if pgrep -f "next start|next-server" > /dev/null; then
    echo "发现残留 Next.js 进程，兜底清理..."
    pkill -9 -f "next start|next-server" || true
fi

# 兜底释放端口，避免 EADDRINUSE
if port_in_use "$PORT"; then
    echo "端口 $PORT 仍被占用，尝试释放..."
    fuser -k "$PORT"/tcp || true
    pkill -9 -f "next-server" || true
fi

if ! wait_port_free "$PORT"; then
    err "✗ 端口 $PORT 仍被占用，请手动检查 (可能是其他服务占用)"
else
    ok "✓ 端口 $PORT 已空闲"
fi
ok "✓ 旧服务已停止"
echo ""

# 5. 启动服务（持久化日志，避免 SIGHUP 退出）
info "▶️  步骤 5/6: 启动生产环境服务..."
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/flowpilot-$(date +%Y%m%d_%H%M%S).log"

START_CMD=()
if command -v pnpm &> /dev/null; then
    START_CMD=(pnpm exec next start --hostname "$HOST" --port "$PORT")
else
    START_CMD=(npx next start --hostname "$HOST" --port "$PORT")
fi

echo "启动命令: ${START_CMD[*]}"
echo "日志文件: $LOG_FILE"

NODE_ENV="$NODE_ENV" HOSTNAME="$HOST" PORT="$PORT" NODE_OPTIONS="$NODE_MEM" \
    nohup "${START_CMD[@]}" > "$LOG_FILE" 2>&1 &

echo $! > "$PID_FILE"
ok "✓ 服务已在后台启动 (PID: $(cat "$PID_FILE"))"
echo ""

# 6. 验证服务，失败时打印日志尾部
info "✅ 步骤 6/6: 验证服务状态..."
HEALTH_URL="http://127.0.0.1:${PORT}"

for i in {1..12}; do
    if curl -fsS --max-time 2 "$HEALTH_URL" > /dev/null 2>&1; then
        ok "✓ 服务验证成功！"
        echo ""
        echo "访问地址: $HEALTH_URL"
        echo "进程PID: $(cat "$PID_FILE")"
        echo "日志文件: $LOG_FILE"
        echo ""
        echo "常用命令:"
        echo "  查看日志: tail -f \"$LOG_FILE\""
        echo "  停止服务: kill \$(cat \"$PID_FILE\")"
        echo "  重新部署: ./deploy.sh"
        exit 0
    fi
    sleep 2
done

err "✗ 服务启动失败，请检查日志: $LOG_FILE"
tail -n 40 "$LOG_FILE" || true
exit 1
