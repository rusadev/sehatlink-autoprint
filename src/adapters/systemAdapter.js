const { exec, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const BaseAdapter = require('./baseAdapter');

class SystemAdapter extends BaseAdapter {
  constructor(printerName, options = {}) {
    super(`system://${printerName}`, options);
    this.printerName = printerName;
  }

  isStandardDesktopPrinter() {
    const lower = (this.printerName || '').toLowerCase();
    return (
      lower.includes('epson') ||
      lower.includes('brother') ||
      lower.includes('canon') ||
      lower.includes('hp') ||
      lower.includes('deskjet') ||
      lower.includes('laserjet') ||
      lower.includes('l3210') ||
      lower.includes('t420w') ||
      lower.includes('t810w') ||
      lower.includes('series')
    );
  }

  /**
   * Cari executable SumatraPDF di beberapa lokasi umum atau binary bawaan
   */
  findSumatraPdf() {
    const candidates = [
      path.resolve(__dirname, '../../bin/win/SumatraPDF.exe'),
      path.resolve(__dirname, '../../node_modules/pdf-to-printer/dist/SumatraPDF-3.4.6-32.exe'),
      path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'SumatraPDF', 'SumatraPDF.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'SumatraPDF', 'SumatraPDF.exe'),
      path.join(process.env['LOCALAPPDATA'] || '', 'SumatraPDF', 'SumatraPDF.exe')
    ];

    for (const p of candidates) {
      if (p && fs.existsSync(p)) {
        return p;
      }
    }
    return null;
  }

  /**
   * Cari Adobe Acrobat Reader jika terpasang
   */
  findAcrobatReader() {
    const candidates = [
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Adobe', 'Acrobat Reader DC', 'Reader', 'AcroRd32.exe'),
      path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Adobe', 'Acrobat DC', 'Acrobat', 'Acrobat.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Adobe', 'Reader 11.0', 'Reader', 'AcroRd32.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Adobe', 'Acrobat 11.0', 'Acrobat', 'Acrobat.exe')
    ];

    for (const p of candidates) {
      if (p && fs.existsSync(p)) {
        return p;
      }
    }
    return null;
  }

  /**
   * Eksekusi cetak PDF di Windows tanpa dialog / interaksi pengguna
   */
  async printWindowsPdf(filePath, copies = 1, options = {}) {
    const sumatraExe = this.findSumatraPdf();

    // 1. Prioritas Utama: SumatraPDF Standalone (Cepat, Silent, Mandiri tanpa dependensi luar)
    if (sumatraExe) {
      const printSettings = [];
      if (options.fit !== false) {
        printSettings.push('fit');
      }
      if (options.orientation) {
        printSettings.push(options.orientation);
      }

      const args = ['-print-to', this.printerName, '-silent', '-exit-on-print'];
      if (printSettings.length > 0) {
        args.push('-print-settings', printSettings.join(','));
      }
      args.push(filePath);

      for (let c = 0; c < copies; c++) {
        await new Promise((resolve, reject) => {
          execFile(sumatraExe, args, { windowsHide: true, timeout: 35000 }, (err, stdout, stderr) => {
            if (err && err.code !== 0) {
              return reject(new Error(`Gagal cetak via SumatraPDF (code ${err.code}): ${stderr || err.message}`));
            }
            resolve(stdout);
          });
        });
      }
      return;
    }

    // 2. Prioritas Kedua: pdf-to-printer npm package jika terinstall
    try {
      const ptp = require('pdf-to-printer');
      for (let c = 0; c < copies; c++) {
        await ptp.print(filePath, {
          printer: this.printerName,
          orientation: options.orientation
        });
      }
      return;
    } catch (ptpErr) {
      // Lanjut ke fallback berikutnya jika modul tidak ada
    }

    // 3. Prioritas Ketiga: Adobe Acrobat Reader CLI jika ada di PC klien
    const acrobatExe = this.findAcrobatReader();
    if (acrobatExe) {
      for (let c = 0; c < copies; c++) {
        await new Promise((resolve, reject) => {
          execFile(acrobatExe, ['/t', filePath, this.printerName], { windowsHide: true, timeout: 35000 }, (err, stdout) => {
            resolve(stdout);
          });
        });
      }
      return;
    }

    // 4. Prioritas Terakhir: PowerShell Start-Process PrintTo
    for (let c = 0; c < copies; c++) {
      await new Promise((resolve, reject) => {
        const psScript = `Start-Process -FilePath '${filePath.replace(/'/g, "''")}' -Verb PrintTo -ArgumentList '${this.printerName.replace(/'/g, "''")}' -WindowStyle Hidden -Wait;`;
        exec(`powershell -NoProfile -NonInteractive -Command "${psScript}"`, (err, stdout, stderr) => {
          if (err) {
            return reject(new Error(`Windows tidak memiliki aplikasi yang dapat mencetak file PDF secara langsung. Pastikan file "bin/win/SumatraPDF.exe" tersedia di folder sehatlink-autoprint atau install Adobe Reader. (${stderr || err.message})`));
          }
          resolve(stdout);
        });
      });
    }
  }

  async send(data, options = {}) {
    const platform = os.platform();
    const isDoc = options.mode === 'document' || options.isDocument || (options.mode !== 'raw' && this.isStandardDesktopPrinter());
    const copies = parseInt(options.copies) || 1;

    let isPdf = false;
    let buffer;

    if (Buffer.isBuffer(data)) {
      buffer = data;
      isPdf = data.slice(0, 4).toString('ascii') === '%PDF';
    } else if (typeof data === 'string') {
      isPdf = data.startsWith('%PDF');
      buffer = Buffer.from(data, 'utf-8');
    } else {
      const json = JSON.stringify(data, null, 2);
      buffer = Buffer.from(json, 'utf-8');
    }

    let ext = '.prn';
    if (isPdf) {
      ext = '.pdf';
    } else if (isDoc) {
      ext = '.txt';
    }

    const tempFileName = `print_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);

    await fs.promises.writeFile(tempFilePath, buffer);

    try {
      if (platform === 'win32') {
        if (isPdf) {
          await this.printWindowsPdf(tempFilePath, copies, options);
        } else {
          // Document teks biasa atau raw command printer
          for (let c = 0; c < copies; c++) {
            await new Promise((resolve, reject) => {
              const psScript = `Get-Content -Path '${tempFilePath.replace(/'/g, "''")}' -Raw | Out-Printer -Name '${this.printerName.replace(/'/g, "''")}';`;
              exec(`powershell -NoProfile -NonInteractive -Command "${psScript}"`, (err, stdout, stderr) => {
                if (err) return reject(new Error(`Windows Spooler Error: ${stderr || err.message}`));
                resolve(stdout);
              });
            });
          }
        }
      } else {
        // macOS & Linux CUPS
        await new Promise((resolve, reject) => {
          const rawFlag = (isDoc || isPdf) ? '' : '-o raw';
          const copiesFlag = copies > 1 ? `-n ${copies}` : '';
          const cmd = `lp -d "${this.printerName}" ${copiesFlag} ${rawFlag} "${tempFilePath}"`.replace(/\s+/g, ' ');
          exec(cmd, (err, stdout, stderr) => {
            if (err) return reject(new Error(`CUPS Print Error (${this.printerName}): ${stderr || err.message}`));
            resolve(stdout);
          });
        });
      }

      return {
        success: true,
        message: `Print job sent to "${this.printerName}" (${copies} copy, ${ext.toUpperCase()})`
      };
    } finally {
      setTimeout(() => {
        fs.promises.unlink(tempFilePath).catch(() => {});
      }, 10000);
    }
  }
}

module.exports = SystemAdapter;
