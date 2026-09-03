const net = require('net');
const BaseAdapter = require('./baseAdapter');

class NetworkAdapter extends BaseAdapter {
  constructor(host, port = 9100, options = {}) {
    super(`network://${host}:${port}`, options);
    this.host = host;
    this.port = parseInt(port, 10) || 9100;
    this.timeout = options.timeout || 5000;
  }

  async send(data) {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(this.timeout);

      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');

      socket.connect(this.port, this.host, () => {
        socket.write(buffer, () => {
          socket.end();
          resolve({ success: true, message: `Sent ${buffer.length} bytes to ${this.host}:${this.port}` });
        });
      });

      socket.on('error', (err) => {
        socket.destroy();
        reject(new Error(`Network printer (${this.host}:${this.port}) error: ${err.message}`));
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error(`Connection to network printer (${this.host}:${this.port}) timed out after ${this.timeout}ms`));
      });
    });
  }

  async testConnection() {
    try {
      await new Promise((resolve, reject) => {
        const socket = new net.Socket();
        socket.setTimeout(3000);
        socket.connect(this.port, this.host, () => {
          socket.end();
          resolve(true);
        });
        socket.on('error', reject);
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('Timeout'));
        });
      });
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = NetworkAdapter;
