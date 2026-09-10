@echo off
title SehatLink Auto-Print Service
color 0b
echo ========================================================
echo        SEHATLINK AUTO-PRINT SERVICE (PORT 8181)
echo ========================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] Node.js belum terinstall di komputer ini!
    echo Silakan download dan install Node.js LTS terlebih dahulu:
    echo 👉 https://nodejs.org/
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] Memasang dependensi service pertama kali...
    call npm install --omit=dev
    echo [INFO] Selesai memasang dependensi.
    echo.
)

echo [INFO] Menjalankan service auto-print pada port 8181...
echo [INFO] Monitor browser akan terbuka otomatis setelah service siap.
npm start
pause
