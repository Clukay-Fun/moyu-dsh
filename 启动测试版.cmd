@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Moyu Tools - Source Test Version

where node >nul 2>nul
if errorlevel 1 goto not_ready

if not exist "node_modules\electron\package.json" goto not_ready
if not exist "node_modules\electron\path.txt" goto electron_missing
if not exist "node_modules\electron\dist\electron.exe" goto electron_missing

if not exist "build\ffmpeg\ffmpeg.exe" (
  echo [WARN] FFmpeg is not ready. Format Factory features may fail.
  echo        Run the first-setup CMD file again to prepare it.
  echo.
)

echo Starting Moyu Tools in Electron development mode...
echo Keep this window open while testing. Press Ctrl+C here to stop the app.
echo.
call npm run dev
if errorlevel 1 goto failed
exit /b 0

:not_ready
echo [ERROR] Source test dependencies are not ready.
echo Run the first-setup CMD file first.
goto failed_pause

:electron_missing
echo [ERROR] The Electron Windows executable is missing.
echo Run the first-setup CMD file again to repair the installation.
echo If it still fails, check the network, proxy, npm settings, and antivirus quarantine.
goto failed_pause

:failed
echo.
echo [ERROR] The Electron development process exited with an error.

:failed_pause
echo.
pause
exit /b 1
