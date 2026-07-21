#!/usr/bin/env bash
# 摸鱼工具箱 — macOS 启动器
# UI、条码及 Illustrator 自动化可用；首次自动安装 macOS 所需依赖。
set -euo pipefail

cd "$(dirname "$0")"

VENV=".venv"
PY="python3"

echo "[信息] 使用 Python: $($PY --version 2>&1)"

# 1) 首次运行创建虚拟环境
if [ ! -d "$VENV" ]; then
    echo "[信息] 创建虚拟环境 $VENV ..."
    "$PY" -m venv "$VENV"
fi

# shellcheck disable=SC1091
source "$VENV/bin/activate"

# 2) 安装 macOS 可用依赖（跳过 Windows 专用的 pywin32）
python -m pip install --quiet --upgrade pip
python - <<'EOF'
import importlib.util, subprocess, sys
# (模块名, pip 包名) —— 仅安装 macOS 可用的依赖
need = [("webview", "pywebview"), ("barcode", "python-barcode"), ("PIL", "pillow")]
missing = [pkg for mod, pkg in need if importlib.util.find_spec(mod) is None]
if missing:
    print("[信息] 安装依赖:", " ".join(missing))
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", *missing])
EOF

# 3) 启动
echo "[信息] 启动 摸鱼工具箱 ..."
python main.py
