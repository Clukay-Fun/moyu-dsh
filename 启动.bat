@echo off
chcp 65001 >nul
setlocal
title Moyu Toolbox

cd /d "%~dp0"
set "PYTHON="

where python >nul 2>&1 && set "PYTHON=python"
if not defined PYTHON (
    where py >nul 2>&1 && set "PYTHON=py -3"
)

if not defined PYTHON (
    echo [ERROR] Python 3 was not found.
    echo Install Python from https://www.python.org/downloads/ and run this file again.
    pause
    exit /b 1
)

echo [INFO] Using %PYTHON%
%PYTHON% -m pip install --disable-pip-version-check pywin32 python-barcode pywebview
if errorlevel 1 (
    echo [ERROR] Dependency installation failed.
    pause
    exit /b 1
)

echo [INFO] Starting Moyu Toolbox...
%PYTHON% main.py
if errorlevel 1 echo [ERROR] Application exited with an error.
pause
