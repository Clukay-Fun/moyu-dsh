@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

:: 请在 Windows 上执行；PyInstaller 不支持从 macOS 交叉生成 Windows EXE。
set PYTHON=python
%PYTHON% --version >nul 2>&1 || set PYTHON=py

%PYTHON% -m pip install pyinstaller
%PYTHON% -m PyInstaller --noconfirm --clean --onefile --noconsole ^
  --name "摸鱼工具箱" ^
  --icon icon.ico ^
  --add-data "frontend;frontend" ^
  --add-data "icon.ico;." ^
  main.py

if errorlevel 1 (
  echo [错误] 打包失败
  pause
  exit /b 1
)

echo [完成] 已生成 dist\摸鱼工具箱.exe
pause
