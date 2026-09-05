@echo off
title Call Track (Training) — Stopping...

echo.
echo  ======================================
echo    Stopping Call Track (Training)...
echo  ======================================
echo.

REM Kill whatever process is listening on port 4000
set FOUND=0
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
    set FOUND=1
)

REM Also close the server window by title as a backup
taskkill /F /FI "WINDOWTITLE eq Call Track Training Server" >nul 2>&1

if "%FOUND%"=="1" (
    echo  Call Track (Training) has been stopped.
) else (
    echo  Call Track (Training) was not running.
)

echo.
echo  You can now close this window.
echo.
timeout /t 3 /nobreak >nul
