const { exec } = require('child_process');
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
        for (let c = 0; c < copies; c++) {
          await new Promise((resolve, reject) => {
            let psScript;
            if (isPdf) {
              psScript = `Start-Process -FilePath '${tempFilePath.replace(/'/g, "''")}' -Verb PrintTo -ArgumentList '${this.printerName.replace(/'/g, "''")}' -WindowStyle Hidden -Wait;`;
            } else if (isDoc) {
              psScript = `Start-Process -FilePath 'notepad.exe' -ArgumentList '/p', '${tempFilePath.replace(/'/g, "''")}' -WindowStyle Hidden -Wait;`;
            } else {
              psScript = `Get-Content -Path '${tempFilePath.replace(/'/g, "''")}' -Raw | Out-Printer -Name '${this.printerName.replace(/'/g, "''")}';`;
            }
            exec(`powershell -NoProfile -NonInteractive -Command "${psScript.replace(/\n/g, ' ')}"`, (err, stdout, stderr) => {
              if (err) return reject(new Error(`Windows Spooler Error: ${stderr || err.message}`));
              resolve(stdout);
            });
          });
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
      }, 5000);
    }
  }
}

module.exports = SystemAdapter;
