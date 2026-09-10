const { exec } = require('child_process');
const os = require('os');

/**
 * Enhanced Printer Auto-Discovery for Windows, macOS, and Linux
 */
function getSystemPrinters() {
  return new Promise((resolve) => {
    const platform = os.platform();

    if (platform === 'win32') {
      // 1. Try single-line PowerShell query
      const psCmd = 'powershell -NoProfile -NonInteractive -Command "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; (Get-CimInstance Win32_Printer).Name"';

      exec(psCmd, { timeout: 6000 }, (error, stdout) => {
        let names = [];
        if (!error && stdout && stdout.trim()) {
          names = stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        }

        if (names.length > 0) {
          return resolve(formatPrinterList(names));
        }

        // 2. Fallback to wmic
        exec('wmic printer get name', { timeout: 5000 }, (wmicErr, wmicOut) => {
          if (!wmicErr && wmicOut && wmicOut.trim()) {
            names = wmicOut
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter((s) => s && s.toLowerCase() !== 'name');
          }

          if (names.length > 0) {
            return resolve(formatPrinterList(names));
          }

          // 3. Fallback to Get-Printer
          exec('powershell -NoProfile -NonInteractive -Command "(Get-Printer).Name"', { timeout: 5000 }, (p2Err, p2Out) => {
            if (!p2Err && p2Out && p2Out.trim()) {
              names = p2Out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
            }
            resolve(formatPrinterList(names));
          });
        });
      });
    } else {
      // macOS & Linux CUPS query
      exec('lpstat -p -d -v 2>/dev/null', { timeout: 5000 }, (error, stdout) => {
        if (error || !stdout.trim()) {
          exec('lpstat -e 2>/dev/null', { timeout: 3000 }, (err2, stdout2) => {
            if (err2 || !stdout2.trim()) {
              return resolve(getFallbackPrinters());
            }
            const names = stdout2.trim().split('\n').filter(Boolean);
            const printers = names.map((name, idx) => ({
              name: name.trim(),
              isDefault: idx === 0,
              status: 'ready',
              port: 'CUPS',
              type: 'system-cups'
            }));
            resolve(printers.length > 0 ? printers : getFallbackPrinters());
          });
          return;
        }

        const lines = stdout.split('\n');
        let defaultPrinter = '';
        const printersMap = new Map();

        for (const line of lines) {
          if (line.startsWith('system default destination:')) {
            defaultPrinter = line.replace('system default destination:', '').trim();
          } else if (line.startsWith('printer ')) {
            const parts = line.split(' ');
            const name = parts[1];
            if (name) {
              const status = line.includes('idle') ? 'idle' : line.includes('printing') ? 'busy' : 'ready';
              printersMap.set(name, {
                name,
                isDefault: false,
                status,
                port: 'CUPS',
                type: 'system-cups'
              });
            }
          } else if (line.startsWith('device for ')) {
            // device for Zebra_ZD220: usb://Zebra/ZD220...
            const match = line.match(/^device for ([^:]+):\s*(.+)$/);
            if (match) {
              const name = match[1].trim();
              const uri = match[2].trim();
              if (printersMap.has(name)) {
                printersMap.get(name).port = uri;
              }
            }
          }
        }

        const printers = Array.from(printersMap.values());
        if (defaultPrinter) {
          const found = printers.find(p => p.name === defaultPrinter);
          if (found) {
            found.isDefault = true;
          } else {
            printers.unshift({
              name: defaultPrinter,
              isDefault: true,
              status: 'ready',
              port: 'CUPS Default',
              type: 'system-cups'
            });
          }
        }

        resolve(printers.length > 0 ? printers : getFallbackPrinters());
      });
    }
  });
}

function formatPrinterList(names) {
  const uniqueNames = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  if (uniqueNames.length === 0) {
    return getFallbackPrinters();
  }
  const list = uniqueNames.map((name, idx) => ({
    name: name,
    isDefault: idx === 0,
    port: 'USB/Local',
    driver: '',
    status: 'ready',
    type: 'windows-spooler',
    isLocal: true
  }));
  list.push({
    name: 'Virtual_Barcode_Printer',
    isDefault: false,
    port: 'Virtual Memory Port',
    status: 'ready',
    type: 'virtual'
  });
  return list;
}

function getFallbackPrinters() {
  return [
    {
      name: 'Virtual_Barcode_Printer',
      isDefault: true,
      status: 'ready',
      port: 'Virtual Memory Port',
      type: 'virtual',
      description: 'Virtual preview printer for testing without physical hardware'
    }
  ];
}

module.exports = {
  getSystemPrinters,
  getFallbackPrinters
};
