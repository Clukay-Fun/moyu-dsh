@echo off
chcp 65001 >nul
setlocal
title Moyu Toolbox Build
cd /d "%~dp0"

where python >nul 2>&1 && set "PYTHON=python"
if not defined PYTHON (
  where py >nul 2>&1 && set "PYTHON=py -3"
)

if not defined PYTHON (
  echo [ERROR] Python 3 was not found.
  pause
  exit /b 1
)

%PYTHON% -m pip install --disable-pip-version-check pyinstaller pywin32 python-barcode pywebview
%PYTHON% -m PyInstaller --noconfirm --clean --onefile --noconsole ^
  --name "MoyuToolbox" ^
  --icon icon.ico ^
  --add-data "frontend;frontend" ^
  --add-data "icon.ico;." ^
  main.py

if errorlevel 1 (
  echo [ERROR] Build failed.
  pause
  exit /b 1
)

echo [DONE] Created dist\MoyuToolbox.exe
pause
