const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config.json');

function getConfig() {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      server: { port: 8181, host: '0.0.0.0' },
      printers: {
        defaultBarcodePrinter: 'Virtual_Barcode_Printer',
        defaultFormat: 'tspl',
        throttleDelayMs: 80,
        labelWidthMm: 50,
        labelHeightMm: 30,
        labelGapMm: 2
      },
      lis: {
        labName: 'Laboratorium SehatLink',
        includePatientRm: true,
        includeLabNo: true,
        includeDateTime: true,
        barcodeType: '128'
      }
    };
  }
}

function saveConfig(newConfig) {
  try {
    const current = getConfig();
    const merged = {
      ...current,
      ...newConfig,
      server: { ...current.server, ...newConfig.server },
      printers: { ...current.printers, ...newConfig.printers },
      lis: { ...current.lis, ...newConfig.lis }
    };
    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf8');
    return { success: true, config: merged };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  getConfig,
  saveConfig
};
