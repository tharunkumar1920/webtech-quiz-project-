@echo off
setlocal enabledelayedexpansion
title ExamPortal - Launching System
color 0F

echo ======================================================================
echo             EXAMPORTAL - ONLINE EXAMINATION PLATFORM
echo ======================================================================
echo.

cd /d "%~dp0"

:: 1. Verify Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js was not detected on your system.
    echo Please download and install Node.js (LTS) from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Verify dependencies
if not exist "node_modules\" (
    echo [INFO] First-time setup: Installing required npm dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install npm dependencies.
        pause
        exit /b 1
    )
)

:: 3. Verify SQLite database, seed if missing
if not exist "backend\database\exam_portal.sqlite" (
    echo [INFO] Database file not found. Generating schema and seeding sample data...
    call npm run seed
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to seed database.
        pause
        exit /b 1
    )
)

echo.
echo [INFO] Starting ExamPortal Web Server on http://localhost:3000 ...
echo [INFO] Your default web browser will open automatically in 2 seconds.
echo.
echo ======================================================================
echo  Sample Login Credentials:
echo   - Student:       STU2023001  /  student123
echo   - Administrator: admin       /  admin123
echo   - Exam Passcodes:
echo       * WTDB2026 (Web Technologies & Database Systems - 12 Qs, 30m)
echo       * DEMO2026 (Mobile Programming & Responsive Web - 6 Qs, 15m)
echo ======================================================================
echo.
echo (Press Ctrl+C in this console window anytime to stop the server)
echo.

:: 4. Launch browser after a brief delay so the server has bound to port 3000
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: 5. Start the Node.js server
node backend/server.js

if %errorlevel% neq 0 (
    echo.
    echo [NOTICE] Server has stopped.
    pause
)
