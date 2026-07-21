@echo off
chcp 65001 >nul
title 摸鱼工具箱

cd /d "%~dp0"

:: Try to find a working Python
set PYTHON=

set "CODEX_PY=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%CODEX_PY%" (
    set PYTHON=%CODEX_PY%
    goto :found_python
)

python --version >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON=python
    goto :found_python
)

py --version >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON=py
    goto :found_python
)

echo [错误] 未找到可用的 Python
pause
exit /b 1

:found_python
echo [信息] 使用 Python: %PYTHON%
%PYTHON% --version

:: Install missing packages
%PYTHON% -c "import win32com" >nul 2>&1 || %PYTHON% -m pip install pywin32
%PYTHON% -c "import barcode" >nul 2>&1 || %PYTHON% -m pip install python-barcode
%PYTHON% -c "import webview" >nul 2>&1 || %PYTHON% -m pip install pywebview

:: Launch
echo [信息] 启动 包装设计工具箱 ...
%PYTHON% main.py

pause
