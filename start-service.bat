@echo off
cd /d "%~dp0"
title SehatLink Auto-Print Service (Port 18181)
color 0b
echo ========================================================
echo        SEHATLINK AUTO-PRINT SERVICE (PORT 18181)
echo ========================================================
echo.

if not exist "node_modules" (
    echo [INFO] Memasang dependensi service untuk pertama kali...
    echo Mohon tunggu 5-10 detik...
    echo.
    call npm install --omit=dev
    echo.
    echo [INFO] Dependensi berhasil dipasang!
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
