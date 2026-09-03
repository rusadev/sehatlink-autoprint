# 🖨️ SehatLink Auto-Print Service (Port 8181)

Service lokal (*client-side background daemon*) untuk meneruskan dokumen cetak secara otomatis (*silent direct pass-through*) dari aplikasi web SaaS SehatLink ke printer fisik (Barcode Label & Hasil Pemeriksaan Lab A4/F4) tanpa pop-up dialog print browser.

---

## 📁 Standar Lokasi Folder Instalasi (SOP Support Klinik)

Untuk keseragaman SOP, menghindari kesalahan *case-sensitive*, dan mencegah file terhapus secara tidak sengaja di folder Downloads, seluruh tim support diwajibkan mengekstrak file ke lokasi standar berhuruf kecil (*lowercase*) berikut:

- 🪟 **Komputer Windows (Standar Utama)**:
  `C:\sehatlink-autoprint`  
  *(Jika drive C penuh, gunakan `D:\sehatlink-autoprint`)*

- 🍏🐧 **Komputer macOS / Linux**:
  `~/sehatlink-autoprint` (Home Directory)

---

## 📋 Prasyarat Sistem (System Requirements)

1. **Node.js**: Versi LTS 18.x, 20.x, atau 22.x ([Download Node.js](https://nodejs.org/)).
2. **Driver Printer**: Driver printer fisik (misal: EPSON L3210, Xprinter, Zebra, dll.) sudah terpasang dan terbaca di OS (Windows Spooler / macOS CUPS / Linux CUPS).
3. **Kabel USB**: Printer terhubung ke komputer via USB / Local LAN.

---

## 🚀 Panduan Instalasi Cepat (Untuk Tim Support di Klinik)

### A. Pengguna Windows:
1. **Ekstrak** file `sehatlink-autoprint.zip` ke folder: `C:\sehatlink-autoprint`.
2. Buka folder tersebut dan klik ganda file **`start-service.bat`**.
3. Jendela browser monitoring *(Tema Terang)* akan otomatis terbuka di `http://localhost:8181`.

### B. Pengguna macOS / Linux:
1. Buka Terminal pada folder `~/sehatlink-autoprint`:
   ```bash
   chmod +x start-service.sh
   ./start-service.sh
   ```
2. Atau jalankan langsung dengan perintah:
   ```bash
   npm install --omit=dev
   npm start
   ```

---

## ⚙️ Cara Menghubungkan ke Web SaaS SehatLink:

1. Buka menu **Pengaturan 2 Printer** di web: `http://[domain-klinik]/master/printer-settings`
2. Status badge di kanan atas akan otomatis berwarna hijau: **`Service Terhubung (Port 8181)`**.
3. Klik tombol **`Scan Printer USB`**.
4. Pilih printer untuk:
   - **1. Printer Barcode Label** (Orientasi default: *Landscape*, Rangkap: *1*)
   - **2. Printer Cetak Hasil Lab** (Orientasi default: *Portrait*, Rangkap: *1*)
5. Klik **`Simpan Pengaturan 2 Printer`**.
6. Selesai! Semua aksi cetak barcode dan hasil lab dari web akan langsung diteruskan ke printer fisik tanpa dialog print.

---

## 🛠️ Port & Endpoints:
- `http://localhost:8181/health` ➔ Status service & deteksi port.
- `http://localhost:8181/api/printers` ➔ Daftar printer OS aktif.
- `http://localhost:8181/api/print-result` ➔ Menerima base64 PDF stream & mencetak ke printer.
- `http://localhost:8181/api/clear-queue` ➔ Membersihkan antrean spooler yang macet.
- `http://localhost:8181/api/restart-service` ➔ Restart & segarkan driver service.
