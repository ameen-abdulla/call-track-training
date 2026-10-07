@echo off
setlocal enabledelayedexpansion
title Call Track (Training) — Starting...

:: 1. Determine project directory safely (handling spaces in path)
cd /d "%~dp0"
set "APP_DIR=%CD%"

echo.
echo  ============================================
echo    Call Track (Training) Launcher (Port 4000)
echo  ============================================
echo.

goto :check_node

:check_node
echo [*] Checking Node.js installation...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [!] Node.js is not installed or not in PATH.
    echo.
    echo  Please install Node.js LTS from:
    echo    https://nodejs.org
    echo.
    start https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set "NODE_VER=%%v"
echo     Node.js version: %NODE_VER%
goto :prepare_env

:prepare_env
echo [*] Checking environment configuration...
if not exist ".env" (
    echo     .env not found. Creating from .env.example with generated unique auth secrets...
    if exist ".env.example" (
        copy /y ".env.example" ".env" >nul
        node -e "const crypto = require('crypto'); const fs = require('fs'); const s = crypto.randomBytes(32).toString('hex'); let c = fs.readFileSync('.env', 'utf8'); c = c.replace(/AUTH_SECRET=.*/, 'AUTH_SECRET=' + JSON.stringify(s)).replace(/NEXTAUTH_SECRET=.*/, 'NEXTAUTH_SECRET=' + JSON.stringify(s)); fs.writeFileSync('.env', c);"
        if errorlevel 1 (
            echo  [!] Failed to generate auth secrets in .env
            goto :setup_failed
        )
        echo     Generated unique AUTH_SECRET in .env
    ) else (
        echo  [!] .env.example not found. Cannot create .env
        goto :setup_failed
    )
) else (
    echo     .env already exists. Preserving existing configuration.
)
goto :install_dependencies

:install_dependencies
if not exist "node_modules" (
    echo [*] Installing dependencies via npm install...
    echo     This may take a couple of minutes on first run...
    call npm install
    if errorlevel 1 (
        echo  [!] npm install failed with error code %ERRORLEVEL%.
        goto :setup_failed
    )
    echo     Dependencies installed successfully.
) else (
    echo [*] Dependencies already installed: node_modules present.
)
goto :prepare_database

:prepare_database
echo [*] Ensuring database schema is up-to-date (prisma db push)...
call npm run db:push
if errorlevel 1 (
    echo  [!] Database schema setup failed with error code %ERRORLEVEL%.
    goto :setup_failed
)
goto :seed_if_required

:seed_if_required
if not exist "prisma\.seeded" (
    echo [*] Initial database seeding required...
    call npm run db:seed
    if errorlevel 1 (
        echo  [!] Database seeding failed with error code %ERRORLEVEL%.
        goto :setup_failed
    )
    echo Seed completed on %DATE% at %TIME% > "prisma\.seeded"
    echo     Database seeded successfully. Marker created: prisma\.seeded
) else (
    echo [*] Database already seeded: prisma\.seeded exists. Skipping seed.
)
goto :ensure_build

:ensure_build
if not exist ".next\BUILD_ID" (
    echo [*] Valid production build not found: .next\BUILD_ID missing. Building application...
    echo     Running npm run build...
    call npm run build
    if errorlevel 1 (
        echo  [!] Production build failed with error code %ERRORLEVEL%.
        goto :setup_failed
    )
    if not exist ".next\BUILD_ID" (
        echo  [!] Build finished but .next\BUILD_ID was not generated.
        goto :setup_failed
    )
    echo     Production build succeeded.
) else (
    echo [*] Production build verified: .next\BUILD_ID present.
)
goto :start_server

:start_server
echo [*] Launching Call Track Training Server on port 4000...
start "Call Track Training Server" /MIN /D "%APP_DIR%" cmd /k "npm run start"
goto :wait_for_health

:wait_for_health
echo [*] Waiting for server to become responsive on http://localhost:4000...
set /a ATTEMPTS=0
set /a MAX_ATTEMPTS=15

:health_loop
set /a ATTEMPTS+=1
echo     [Attempt !ATTEMPTS! of !MAX_ATTEMPTS!] Checking http://localhost:4000/api/healthz...
curl.exe --fail --silent --connect-timeout 2 --max-time 3 http://localhost:4000/api/healthz >nul 2>&1 && goto :success

if !ATTEMPTS! GEQ !MAX_ATTEMPTS! goto :start_failed

ping 127.0.0.1 -n 2 >nul
goto :health_loop

:success
echo.
echo  ============================================================
echo    [OK] Call Track (Training) is RUNNING on http://localhost:4000
echo  ============================================================
echo.
if exist "SEED_CREDENTIALS.txt" (
    echo  Training credentials: See SEED_CREDENTIALS.txt
)
echo.
echo  Opening http://localhost:4000 in your browser...
start http://localhost:4000
echo  To stop the application, run: "Stop Call Track.bat"
echo.
ping 127.0.0.1 -n 4 >nul
exit /b 0

:setup_failed
echo.
echo  ============================================================
echo    [ERROR] Call Track Training setup FAILED!
echo    Review the error messages above.
echo    The server was NOT started.
echo  ============================================================
echo.
pause
exit /b 1

:start_failed
echo.
echo  ============================================================
echo    [ERROR] Server failed to respond on http://localhost:4000
echo    Timeout reached after %MAX_ATTEMPTS% seconds.
echo  ============================================================
echo.
echo  Troubleshooting:
echo   1. Check the minimized 'Call Track Training Server' window for error logs.
echo   2. Verify that port 4000 is not already occupied by another process.
echo   3. Run 'Stop Call Track.bat' and try again.
echo.
pause
exit /b 1
