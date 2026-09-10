@echo off
cd /d "%~dp0"
title SehatLink Auto-Print Service (Port 8181)
color 0b
echo ========================================================
echo        SEHATLINK AUTO-PRINT SERVICE (PORT 8181)
echo ========================================================
echo.
echo [INFO] Menjalankan SehatLink Auto-Print...
echo [INFO] Jangan tutup jendela ini selama komputer digunakan.
echo.
node src\server.js
echo.
echo ========================================================
echo [PERINGATAN] Service telah berhenti.
echo ========================================================
pause
