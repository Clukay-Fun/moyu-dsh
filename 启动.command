#!/usr/bin/env bash
# 摸鱼工具箱 — macOS 双击启动器
# 排错入口：Finder 双击会打开终端；日常请双击“启动.app”以无终端启动。
cd "$(dirname "$0")"
exec ./run.sh
