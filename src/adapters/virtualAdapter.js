const BaseAdapter = require('./baseAdapter');

class VirtualAdapter extends BaseAdapter {
  constructor(name = 'Virtual_Barcode_Printer', options = {}) {
    super(`virtual://${name}`, options);
    this.history = [];
    this.maxHistory = options.maxHistory || 50;
  }

  async send(data, options = {}) {
    const isBuffer = Buffer.isBuffer(data);
    const content = isBuffer ? data.toString('utf-8') : String(data);
    const timestamp = new Date().toISOString();

    const record = {
      id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp,
      sizeBytes: isBuffer ? data.length : Buffer.byteLength(content),
      options,
      preview: content.length > 500 ? content.substring(0, 500) + '... (truncated)' : content,
      raw: content
    };

    this.history.unshift(record);
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }

    console.log(`[Virtual Printer] 🖨️ Received print job (${record.sizeBytes} bytes):\n`, record.preview);

    return {
      success: true,
      message: `[Virtual Printer] Simulated print success (${record.sizeBytes} bytes)`,
      jobId: record.id
    };
  }

  getHistory() {
    return this.history;
  }

  clearHistory() {
    this.history = [];
  }
}

module.exports = VirtualAdapter;
