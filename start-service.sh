#!/usr/bin/env bash

echo "========================================================"
echo "       SEHATLINK AUTO-PRINT SERVICE (PORT 8181)"
echo "========================================================"
echo ""

if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js belum terinstall di komputer ini!"
    echo "Silakan unduh dan pasang Node.js LTS dari: https://nodejs.org/"
    echo ""
    exit 1
fi

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

if [ ! -d "node_modules" ]; then
    echo "[INFO] Memasang dependensi service..."
    npm install --omit=dev
    echo ""
fi

echo "[INFO] Menjalankan service auto-print pada port 8181..."
npm start
