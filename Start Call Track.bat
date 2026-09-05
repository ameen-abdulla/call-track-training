@echo off
title Call Track (Training) — Starting...
if exist "%~dp0call-track" (
    cd /d "%~dp0call-track"
) else (
    cd /d "%~dp0"
)

echo.
echo  ======================================
echo    Call Track (Training) is starting...
echo  ======================================
echo.

REM ── Check if Node.js is installed ──────────────────────────────────
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  ⚠  Node.js is not installed on this computer.
    echo.
    echo  Please follow these steps:
    echo.
    echo   1. Open your browser and go to:
    echo      https://nodejs.org
    echo.
    echo   2. Click the big green "LTS" download button
    echo.
    echo   3. Run the downloaded installer
    echo      ^(just click Next, Next, Next, Finish^)
    echo.
    echo   4. Once installed, double-click this file again.
    echo.
    start https://nodejs.org
    echo  Opening nodejs.org in your browser now...
    echo.
    pause
    exit /b
)

REM ── First-time setup ───────────────────────────────────────────────
if not exist ".next" (
    echo  First-time setup — this runs once and takes 2-3 minutes.
    echo  Please wait and do not close this window...
    echo.
    if not exist ".env" (
        copy .env.example .env
    )
    call npm install
    echo.
    call npm run db:push
    call npm run db:seed
    call npm run build
    echo.
    echo  ✔ Setup complete!
    echo.
)

REM ── Start the server ───────────────────────────────────────────────
start "Call Track Training Server" /MIN cmd /k "npm run start"

echo  Server is starting up on port 4000...
echo  Opening browser in 8 seconds...
echo.
timeout /t 8 /nobreak >nul

start http://localhost:4000

echo.
echo  ======================================
echo    Call Track (Training) is running!
echo    http://localhost:4000
echo  ======================================
echo.
echo  To stop the app, run "Stop Call Track.bat"
echo.
timeout /t 4 /nobreak >nul
