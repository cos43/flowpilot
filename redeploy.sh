#!/bin/bash
# FlowPilot 快速重新部署脚本

echo "🔄 快速重新部署 FlowPilot..."

# 停止旧服务
pkill -9 -f "next" 2>/dev/null || true
sleep 2

# 构建并启动
pnpm build && pnpm start &

echo "✅ 部署完成！服务运行在 http://localhost:6001"
echo "📋 查看日志: tail -f nohup.out"
