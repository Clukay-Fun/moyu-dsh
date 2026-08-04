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

echo [1/5] Installing locked npm dependencies...
call npm ci
if errorlevel 1 goto failed

echo [2/5] Verifying the Electron Windows binary...
if not exist "node_modules\electron\path.txt" (
  call node "node_modules\electron\install.js"
  if errorlevel 1 goto electron_failed
)
if not exist "node_modules\electron\dist\electron.exe" goto electron_failed

echo [3/5] Rebuilding Electron native dependencies...
call npx electron-builder install-app-deps
if errorlevel 1 goto failed

echo [4/5] Preparing FFmpeg and ffprobe...
call npm run build:tools:win
if errorlevel 1 goto failed

echo [5/5] Verifying the Electron production bundle...
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
