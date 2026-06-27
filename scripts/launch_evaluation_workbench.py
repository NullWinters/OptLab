#!/usr/bin/env python3
"""评测工作台一键启动脚本：启动服务并自动打开可视化页面。"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path


def wait_for_server(url: str, timeout_sec: float = 25.0) -> bool:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.5):
                return True
        except Exception:
            time.sleep(0.35)
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="一键启动 OptLab 评测工作台。")
    parser.add_argument("--host", default="127.0.0.1", help="服务监听地址（默认 127.0.0.1）")
    parser.add_argument("--port", type=int, default=8001, help="服务端口（默认 8001）")
    parser.add_argument("--reload", action="store_true", help="启用热更新（开发模式）")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent.parent
    os.chdir(project_root)

    target_open_host = "127.0.0.1" if args.host in ("0.0.0.0", "::") else args.host
    page_url = f"http://{target_open_host}:{args.port}/tools/evaluation-workbench"
    health_url = f"http://{target_open_host}:{args.port}/"

    def _open_browser_later() -> None:
        if wait_for_server(health_url):
            webbrowser.open(page_url)

    threading.Thread(target=_open_browser_later, daemon=True).start()

    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "main:app",
        "--host",
        args.host,
        "--port",
        str(args.port),
    ]
    if args.reload:
        cmd.append("--reload")

    print("==========================================")
    print("OptLab 评测工作台一键启动")
    print(f"访问地址: {page_url}")
    print("按 Ctrl+C 可停止服务")
    print("==========================================")
    result = subprocess.run(cmd)
    return int(result.returncode)


if __name__ == "__main__":
    raise SystemExit(main())
