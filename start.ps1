# ExamPortal - PowerShell Launcher
$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "            EXAMPORTAL - ONLINE EXAMINATION PLATFORM                  " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot

# 1. Verify Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js was not detected on your system." -ForegroundColor Red
    Write-Host "Please download and install Node.js from https://nodejs.org/"
    Read-Host "Press Enter to exit..."
    exit 1
}

# 2. Check dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] First-time setup: Installing required npm dependencies..." -ForegroundColor Yellow
    npm install
}

# 3. Check database
if (-not (Test-Path "backend\database\exam_portal.sqlite")) {
    Write-Host "[INFO] Database file not found. Generating schema and seeding sample data..." -ForegroundColor Yellow
    npm run seed
}

Write-Host ""
Write-Host "[INFO] Starting ExamPortal Web Server on http://localhost:3000 ..." -ForegroundColor Green
Write-Host "[INFO] Opening default browser at http://localhost:3000 ..." -ForegroundColor Green
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Yellow
Write-Host " Sample Login Credentials:" -ForegroundColor Yellow
Write-Host "  - Student:       STU2023001  /  student123"
Write-Host "  - Administrator: admin       /  admin123"
Write-Host "  - Exam Passcodes:"
Write-Host "      * WTDB2026 (Web Technologies & Database Systems - 12 Qs, 30m)"
Write-Host "      * DEMO2026 (Mobile Programming & Responsive Web - 6 Qs, 15m)"
Write-Host "======================================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "(Press Ctrl+C in this console window anytime to stop the server)" -ForegroundColor Gray
Write-Host ""

# Open browser
Start-Process "http://localhost:3000"

# Start Node.js server
node backend/server.js
