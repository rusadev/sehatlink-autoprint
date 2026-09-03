const NetworkAdapter = require('./networkAdapter');
const SystemAdapter = require('./systemAdapter');
const VirtualAdapter = require('./virtualAdapter');

const virtualPrinterInstance = new VirtualAdapter();

/**
 * Adapter Resolver: get the appropriate adapter for a given printer destination
 * @param {string} target - Printer name or Network IP (e.g., "192.168.1.100:9100", "Zebra_ZD220", "virtual")
 * @returns {import('./baseAdapter')}
 */
function getAdapter(target) {
  if (!target || target === 'virtual' || target === 'Virtual_Barcode_Printer') {
    return virtualPrinterInstance;
  }

  // Check if target is an IP address format: "192.168.1.50" or "192.168.1.50:9100"
  const ipMatch = target.match(/^([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})(?::([0-9]+))?$/);
  if (ipMatch) {
    const host = ipMatch[1];
    const port = ipMatch[2] ? parseInt(ipMatch[2], 10) : 9100;
    return new NetworkAdapter(host, port);
  }

  // Default to OS System Spooler
  return new SystemAdapter(target);
}

module.exports = {
  getAdapter,
  virtualPrinterInstance,
  NetworkAdapter,
  SystemAdapter,
  VirtualAdapter
};
