@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Moyu Tools - First Setup

echo.
echo ========================================
echo   Moyu Tools - Windows Source Test Setup
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 goto node_missing

for /f "delims=" %%V in ('node -p "process.versions.node.split('.')[0]" 2^>nul') do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR goto node_missing
if %NODE_MAJOR% LSS 22 goto node_old

where npm >nul 2>nul
if errorlevel 1 goto npm_missing

rem A machine-level ELECTRON_SKIP_BINARY_DOWNLOAD would leave only the JS package.
set "ELECTRON_SKIP_BINARY_DOWNLOAD="

echo [1/6] Installing locked npm dependencies...
call npm ci
if errorlevel 1 goto failed

echo [2/6] Verifying the Electron Windows binary...
if not exist "node_modules\electron\path.txt" (
  call node "node_modules\electron\install.js"
  if errorlevel 1 goto electron_failed
)
if not exist "node_modules\electron\dist\electron.exe" goto electron_failed

echo [3/6] Rebuilding Electron native dependencies...
call npx electron-builder install-app-deps
if errorlevel 1 goto failed

echo [4/6] Preparing FFmpeg and ffprobe...
call npm run build:tools:win
if errorlevel 1 goto failed

if not defined MOYU_PYTHON (
  for /f "delims=" %%P in ('py -3.11 -c "import sys;print(sys.executable)" 2^>nul') do set "MOYU_PYTHON=%%P"
)
if not defined MOYU_PYTHON (
  python -c "import sys;raise SystemExit(0 if sys.version_info[:2] == (3,11) else 1)" >nul 2>nul
  if not errorlevel 1 (
    for /f "delims=" %%P in ('python -c "import sys;print(sys.executable)"') do set "MOYU_PYTHON=%%P"
  )
)
if not defined MOYU_PYTHON goto python_missing

echo [5/6] Building the Windows AI sidecar with Python 3.11...
call npm run build:sidecar:win
if errorlevel 1 goto failed

echo [6/6] Verifying the Electron production bundle...
call npm run build
if errorlevel 1 goto failed

echo.
echo Setup completed successfully.
echo Double-click the test-start CMD file to launch the app.
echo.
pause
exit /b 0

:node_missing
echo [ERROR] Node.js was not found. Install Node.js 22 x64, then run this file again.
goto failed_pause

:node_old
echo [ERROR] Node.js 22 or newer is required. Current major version: %NODE_MAJOR%
goto failed_pause

:npm_missing
echo [ERROR] npm was not found. Reinstall Node.js 22 x64 with npm enabled.
goto failed_pause

:python_missing
echo [ERROR] Python 3.11 was not found.
echo Install Python 3.11 x64, or set MOYU_PYTHON to python.exe and run again.
goto failed_pause

:electron_failed
echo [ERROR] Electron for Windows was not installed completely.
echo Check the network, proxy, npm settings, and antivirus quarantine.
echo Then run this file again. Do not set ELECTRON_SKIP_BINARY_DOWNLOAD.
goto failed_pause

:failed
echo.
echo [ERROR] Setup failed. Read the error above, fix it, and run this file again.

:failed_pause
echo.
pause
exit /b 1
