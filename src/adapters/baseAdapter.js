/**
 * Base Printer Adapter
 */
class BaseAdapter {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
  }

  /**
   * Send raw data / buffer to the printer
   * @param {string|Buffer} data
   * @param {Object} [options]
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async send(data, options = {}) {
    throw new Error('send() method not implemented');
  }

  /**
   * Test connection to the printer
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    return true;
  }
}

module.exports = BaseAdapter;
