#!/usr/bin/env python3
"""
OptLab 跨平台启动脚本
支持：Windows 10+, Ubuntu 20.04+, macOS 11+

用法:
    python scripts/launch.py
    或先设置可执行权限后：./scripts/launch.py

功能：
    1. 检查 Python 版本 (>=3.13)
    2. 创建虚拟环境（如果不存在）
    3. 安装项目依赖 (pip install -e .)
    4. 初始化数据库 (python scripts/init_db.py)
    5. 启动服务 (uvicorn main:app --host 0.0.0.0 --port 8001)
"""

import platform
import subprocess
import sys
import os
from pathlib import Path


def get_python_version():
    """获取当前 Python 版本信息"""
    return sys.version_info


def check_python_version():
    """检查 Python 版本是否 >= 3.13"""
    version = get_python_version()
    if version.major < 3 or (version.major == 3 and version.minor < 13):
        print(
            f"错误: Python 版本要求 >= 3.13，当前为 {version.major}.{version.minor}.{version.micro}"
        )
        print("   请升级 Python: https://www.python.org/downloads/")
        sys.exit(1)
    print(f"Python 版本检查通过: {version.major}.{version.minor}.{version.micro}")


def get_system_info():
    """获取系统信息"""
    system = platform.system()
    machine = platform.machine()
    return system, machine


def get_venv_python(venv_path: Path):
    """获取虚拟环境中的 Python 解释器路径"""
    system, _ = get_system_info()
    if system == "Windows":
        return venv_path / "Scripts" / "python.exe"
    else:
        return venv_path / "bin" / "python"


def get_venv_pip(venv_path: Path):
    """获取虚拟环境中的 pip 路径"""
    system, _ = get_system_info()
    if system == "Windows":
        return venv_path / "Scripts" / "pip.exe"
    else:
        return venv_path / "bin" / "pip"


def ensure_pip_installed(venv_python: Path):
    """确保虚拟环境中已安装 pip，如果没有则运行 ensurepip"""
    print("\n 检查 pip 是否可用...")

    # 首先尝试运行 pip --version 检查 pip 是否可用
    result = subprocess.run(
        [str(venv_python), "-m", "pip", "--version"], capture_output=True, text=True
    )

    if result.returncode == 0:
        pip_version = result.stdout.strip()
        print(f"   ✅ pip 已安装: {pip_version}")
        return True

    # pip 不可用，尝试使用 ensurepip 安装
    print("     pip 未安装，正在运行 ensurepip...")
    ensure_result = subprocess.run(
        [str(venv_python), "-m", "ensurepip", "--upgrade"],
        capture_output=False,
        text=True,
    )

    if ensure_result.returncode != 0:
        print("    ensurepip 失败，尝试使用 --default-pip 选项...")
        # 某些系统可能需要 --default-pip 选项
        ensure_result = subprocess.run(
            [str(venv_python), "-m", "ensurepip", "--upgrade", "--default-pip"],
            capture_output=False,
            text=True,
        )

    if ensure_result.returncode == 0:
        print("   ✅ pip 安装成功")
        # 再次验证 pip 是否可用
        verify_result = subprocess.run(
            [str(venv_python), "-m", "pip", "--version"], capture_output=True, text=True
        )
        if verify_result.returncode == 0:
            print(f"   ✅ pip 验证通过: {verify_result.stdout.strip()}")
            return True

    print("    无法安装 pip，请手动安装")
    return False


def run_command(cmd, description, check=True, **kwargs):
    """执行命令并打印状态"""
    print(f"\n{description}...")
    print(f"   命令: {' '.join(str(c) for c in cmd)}")

    result = subprocess.run(cmd, capture_output=False, text=True, **kwargs)

    if check and result.returncode != 0:
        print(f"{description}失败 (返回码: {result.returncode})")
        sys.exit(1)

    print(f"{description}完成")
    return result


def check_env_file(project_root: Path):
    """检查 .env 文件是否存在，如果不存在则提示"""
    env_file = project_root / ".env"
    env_template = project_root / ".env.template"

    if not env_file.exists():
        print("\n警告: 未找到 .env 文件")

        if env_template.exists():
            print("   发现 .env.template 模板文件")
            response = (
                input("   是否自动复制 .env.template 到 .env? (y/N): ").strip().lower()
            )

            if response in ("y", "yes"):
                import shutil

                shutil.copy(env_template, env_file)
                print(f"   已创建 {env_file}")
                print("   请编辑 .env 文件，修改其中的配置（特别是密钥）")
                response2 = input("   是否继续启动? (Y/n): ").strip().lower()
                if response2 in ("n", "no"):
                    print("   已取消启动，请先编辑 .env 文件")
                    sys.exit(0)
            else:
                print("   跳过创建 .env，某些功能可能无法正常工作")
        else:
            print("   也未找到 .env.template 模板文件")
            print("   某些功能可能无法正常工作")


def get_lan_ip():
    """获取局域网 IP 地址"""
    system, _ = get_system_info()

    try:
        if system == "Darwin":  # macOS
            for iface in ["en0", "en1", "en2", "en3"]:
                result = subprocess.run(
                    ["ipconfig", "getifaddr", iface], capture_output=True, text=True
                )
                if result.returncode == 0:
                    return result.stdout.strip()
            # 备用方法
            result = subprocess.run(["ifconfig"], capture_output=True, text=True)
            if result.returncode == 0:
                import re

                matches = re.findall(r"inet\s+(\d+\.\d+\.\d+\.\d+)", result.stdout)
                for ip in matches:
                    if not ip.startswith("127."):
                        return ip

        elif system == "Linux":
            # 尝试 hostname
            result = subprocess.run(["hostname", "-I"], capture_output=True, text=True)
            if result.returncode == 0:
                return result.stdout.strip().split()[0]
            # 备用：ip route
            result = subprocess.run(
                ["ip", "route", "get", "1"], capture_output=True, text=True
            )
            if result.returncode == 0:
                parts = result.stdout.split()
                for i, part in enumerate(parts):
                    if part == "src" and i + 1 < len(parts):
                        return parts[i + 1]

        elif system == "Windows":
            # 使用 socket 方法
            import socket

            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            try:
                s.connect(("8.8.8.8", 80))
                ip = s.getsockname()[0]
                return ip
            finally:
                s.close()

    except Exception as e:
        pass

    return None


def print_banner(project_root: Path, venv_path: Path):
    """打印启动信息横幅"""
    system, machine = get_system_info()
    python_version = (
        f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    )

    print("=" * 60)
    print("OptLab 启动脚本")
    print("=" * 60)
    print(f"   操作系统: {system} ({machine})")
    print(f"   Python 版本: {python_version}")
    print(f"   项目目录: {project_root}")
    print(f"   虚拟环境: {venv_path}")
    print("=" * 60)


def main():
    """主函数"""
    # 获取项目根目录（scripts/launch.py 的上级目录）
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent

    # 切换到项目根目录
    os.chdir(project_root)

    # 虚拟环境路径
    venv_path = project_root / ".venv"

    # 打印启动信息
    print_banner(project_root, venv_path)

    # 1. 检查 Python 版本
    check_python_version()

    # 2. 检查 .env 文件
    check_env_file(project_root)

    # 3. 创建虚拟环境（如果不存在）
    if not venv_path.exists():
        print(f"\n虚拟环境不存在，正在创建...")
        run_command(
            [sys.executable, "-m", "venv", str(venv_path)], "创建虚拟环境", check=True
        )
    else:
        print(f"\n虚拟环境已存在: {venv_path}")

    # 获取虚拟环境的 Python 和 pip 路径
    venv_python = get_venv_python(venv_path)
    venv_pip = get_venv_pip(venv_path)

    # 验证虚拟环境可用
    if not venv_python.exists():
        print(f" 错误: 虚拟环境 Python 不存在: {venv_python}")
        print("   请删除 .venv 目录后重试")
        sys.exit(1)

    print(f"    使用 Python: {venv_python}")

    # 4. 确保 pip 已安装
    if not ensure_pip_installed(venv_python):
        print(" 错误: pip 安装失败，无法继续")
        sys.exit(1)

    # 5. 安装/更新项目依赖
    print(f"\n安装项目依赖 (pip install -e .)...")
    run_command(
        [str(venv_python), "-m", "pip", "install", "-e", "."], "安装依赖", check=True
    )

    # 6. 初始化数据库
    print(f"\n🗄️  初始化数据库...")
    init_db_script = project_root / "scripts" / "init_db.py"
    if init_db_script.exists():
        run_command([str(venv_python), str(init_db_script)], "初始化数据库", check=True)
    else:
        print(f"  警告: 未找到数据库初始化脚本: {init_db_script}")

    # 7. 获取局域网 IP 并打印访问信息
    print("\n" + "=" * 60)
    print(" 启动信息")
    print("=" * 60)
    print(f"   本机访问: http://localhost:8001")

    lan_ip = get_lan_ip()
    if lan_ip:
        print(f"   局域网访问: http://{lan_ip}:8001")
    else:
        print("   局域网访问: 无法自动获取 IP，请手动查看")

    print("=" * 60)
    print("")

    # 8. 启动服务
    print(" 正在启动 OptLab 服务...")
    print("   按 Ctrl+C 停止服务\n")

    try:
        result = subprocess.run(
            [
                str(venv_python),
                "-m",
                "uvicorn",
                "main:app",
                "--host",
                "0.0.0.0",
                "--port",
                "8001",
            ],
            check=False,
        )

        if result.returncode != 0:
            print(f"\n服务异常退出 (返回码: {result.returncode})")
            sys.exit(result.returncode)

    except KeyboardInterrupt:
        print("\n\n服务已停止")
        sys.exit(0)


if __name__ == "__main__":
    main()
