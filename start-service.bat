@echo off
setlocal enabledelayedexpansion
title SehatLink Auto-Print Service (Port 8181)
color 0b

:: Pastikan working directory selalu di folder file .bat ini berada
cd /d "%~dp0"

echo ========================================================
echo        SEHATLINK AUTO-PRINT SERVICE (PORT 8181)
echo ========================================================
echo.

:: 1. Periksa instalasi Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0c
    echo [ERROR] Node.js belum terpasang di sistem!
    echo Silakan unduh dan pasang Node.js LTS dari:
    echo 👉 https://nodejs.org/
    echo.
    echo Setelah selesai install, jalankan kembali start-service.bat ini.
    echo.
    pause
    exit /b 1
)

:: 2. Bersihkan port 8181 jika masih ada proses lama yang menyangkut di Windows
echo [INFO] Memeriksa ketersediaan Port 8181...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8181" ^| findstr "LISTENING"') do (
    echo [INFO] Menutup proses lama pada port 8181 (PID: %%a)...
    taskkill /f /pid %%a >nul 2>nul
)

:: 3. Periksa dependensi node_modules
if not exist "node_modules" (
    echo [INFO] Memasang dependensi service pertama kali...
    call npm install --omit=dev
    if !errorlevel! neq 0 (
        color 0c
        echo [ERROR] Gagal memasang dependensi npm install!
        echo Pastikan komputer terhubung ke internet dan coba kembali.
        echo.
        pause
        exit /b 1
    )
    echo [INFO] Selesai memasang dependensi.
    echo.
)

:: 4. Jalankan Service langsung via Node.js
echo [INFO] Menjalankan service pada http://127.0.0.1:8181...
echo [INFO] Browser monitor akan terbuka otomatis...
echo [INFO] Jangan tutup jendela terminal ini selama komputer digunakan untuk mencetak.
echo.
call node src/server.js

:: Jika service berhenti karena alasan apa pun, jendela TIDAK AKAN tertutup otomatis
echo.
echo ========================================================
echo [NOTICE] Service Auto-Print telah berhenti.
echo ========================================================
pause
