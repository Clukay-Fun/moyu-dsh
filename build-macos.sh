#!/usr/bin/env bash
# 在 macOS 生成可双击运行的 .app 包。
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
python -m pip install --quiet --upgrade pip
python -m pip install --quiet pywebview python-barcode pillow pyinstaller
python -m PyInstaller --noconfirm --clean --windowed \
  --name "摸鱼工具箱" \
  --add-data "frontend:frontend" \
  --add-data "icon.ico:." \
  main.py

echo "已生成：$(pwd)/dist/摸鱼工具箱.app"
