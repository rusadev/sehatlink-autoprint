@echo off
cd /d "%~dp0"
title SehatLink Auto-Print Service (Port 18181)
color 0b
echo ========================================================
echo        SEHATLINK AUTO-PRINT SERVICE (PORT 18181)
echo ========================================================
echo.

if not exist "node_modules\pdf-to-printer" (
    echo [INFO] Memeriksa dan memasang dependensi service...
    echo Mohon tunggu 5-10 detik...
    echo.
    call npm install --omit=dev
    echo.
    echo [INFO] Dependensi berhasil disiapkan!
    echo.
)

echo [INFO] Menjalankan SehatLink Auto-Print...
echo [INFO] Jangan tutup jendela ini selama komputer digunakan.
echo.
node src\server.js
echo.
echo ========================================================
echo [PERINGATAN] Service telah berhenti.
echo ========================================================
pause
