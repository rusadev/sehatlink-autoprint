const { exec } = require('child_process');
const os = require('os');

/**
 * Enhanced Printer Auto-Discovery for Windows, macOS, and Linux
 */
function getSystemPrinters() {
  return new Promise((resolve) => {
    const platform = os.platform();

    if (platform === 'win32') {
      // Windows PowerShell: comprehensive query
      const cmd = `powershell -NoProfile -NonInteractive -Command "
        try {
          $printers = Get-CimInstance Win32_Printer | Select-Object Name, Default, PrinterStatus, PortName, DriverName, Local;
          $printers | ConvertTo-Json -Compress;
        } catch {
          Get-Printer | Select-Object Name, Default, PortName, DriverName | ConvertTo-Json -Compress;
        }
      "`;

      exec(cmd, { timeout: 6000 }, (error, stdout) => {
        if (error || !stdout.trim()) {
          return resolve(getFallbackPrinters());
        }
        try {
          const data = JSON.parse(stdout);
          const list = Array.isArray(data) ? data : [data];
          const printers = list.map((p) => ({
            name: p.Name,
            isDefault: Boolean(p.Default),
            port: p.PortName || 'USB/Local',
            driver: p.DriverName || '',
            status: p.PrinterStatus === 3 ? 'idle' : 'ready',
            type: 'windows-spooler',
            isLocal: p.Local !== false
          }));
          resolve(printers.length > 0 ? printers : getFallbackPrinters());
        } catch {
          resolve(getFallbackPrinters());
        }
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
