#!/bin/bash
# 局域网部署：监听 0.0.0.0，允许同网段设备访问
# 用法: ./scripts/run_lan.sh  或  bash scripts/run_lan.sh

cd "$(dirname "$0")/.." || exit
source .venv/bin/activate 2>/dev/null || true
echo "启动 OptLab（局域网可访问）..."
echo "本机访问: http://localhost:8001"
# 尝试获取局域网 IP（macOS 用 en0，Linux 用 hostname -I）
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || (hostname -I 2>/dev/null | awk '{print $1}') || echo "请用 ifconfig/ipconfig 查看")
echo "局域网访问: http://${LAN_IP}:8001"
echo ""
uvicorn main:app --host 0.0.0.0 --port 8001
