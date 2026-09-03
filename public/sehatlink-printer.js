/**
 * SehatLink LIS Auto-Print Client SDK (v1.0.0)
 * Official JavaScript SDK to integrate SaaS LIS SehatLink with local client printers.
 * Built-in Auto-Connect & HTTP REST Fallback for 100% reliability.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const lib = factory();
    root.SehatLinkPrinter = lib;
    root.NodeTray = lib;
  }
}(typeof self !== 'undefined' ? self : this, function () {

  class SehatLinkPrinter {
    constructor(url = 'http://localhost:8181') {
      const cleanUrl = url.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://');
      this.httpUrl = cleanUrl.replace(/\/+$/, '');
      this.wsUrl = this.httpUrl.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
      this.ws = null;
      this.isConnected = false;
      this.pendingRequests = new Map();
      this.eventListeners = new Map();
    }

    /**
     * Connect to local SehatLink print service via WebSocket
     */
    connect() {
      return new Promise((resolve) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.isConnected = true;
          return resolve(true);
        }

        try {
          this.ws = new WebSocket(this.wsUrl);

          this.ws.onopen = () => {
            this.isConnected = true;
            this._emit('connected', { url: this.wsUrl });
            resolve(true);
          };

          this.ws.onclose = () => {
            this.isConnected = false;
            this._emit('disconnected', {});
          };

          this.ws.onerror = (err) => {
            this.isConnected = false;
            this._emit('error', err);
            // Resolve false rather than crash so HTTP fallback works seamlessly
            resolve(false);
          };

          this.ws.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data);

              if (msg.responseTo && this.pendingRequests.has(msg.responseTo)) {
                const { resolve, reject } = this.pendingRequests.get(msg.responseTo);
                this.pendingRequests.delete(msg.responseTo);
                if (msg.success !== false) {
                  resolve(msg);
                } else {
                  reject(new Error(msg.error || 'Print service error'));
                }
                return;
              }

              if (msg.event) {
                this._emit(msg.event, msg);
              }
            } catch (e) {
              console.error('[SehatLinkPrinter] Parse error:', e);
            }
          };

          // Timeout WS connect after 2s and fallback
          setTimeout(() => {
            if (!this.isConnected) resolve(false);
          }, 2000);

        } catch {
          resolve(false);
        }
      });
    }

    async _send(action, payload = {}) {
      // 1. Auto-connect if needed
      if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        await this.connect();
      }

      // 2. If WS is active, send via WebSocket
      if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        return new Promise((resolve, reject) => {
          const id = 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
          this.pendingRequests.set(id, { resolve, reject });

          const message = JSON.stringify({ id, action, payload });
          this.ws.send(message);

          setTimeout(() => {
            if (this.pendingRequests.has(id)) {
              this.pendingRequests.delete(id);
              // Fallback to HTTP on timeout
              this._httpFallback(action, payload).then(resolve).catch(reject);
            }
          }, 5000);
        });
      }

      // 3. Fallback to HTTP REST API
      return await this._httpFallback(action, payload);
    }

    async _httpFallback(action, payload = {}) {
      let endpoint = '/api/print';
      let method = 'POST';

      switch (action) {
        case 'getPrinters':
          endpoint = '/api/printers';
          method = 'GET';
          break;
        case 'getConfig':
          endpoint = '/api/config';
          method = 'GET';
          break;
        case 'saveConfig':
          endpoint = '/api/config';
          method = 'POST';
          break;
        case 'printPatientTubes':
          endpoint = '/api/lis/print-patient-tubes';
          method = 'POST';
          break;
        case 'printBatch':
          endpoint = '/api/print-batch';
          method = 'POST';
          break;
        case 'print':
          endpoint = '/api/print';
          method = 'POST';
          break;
        default:
          endpoint = '/api/print';
      }

      const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
      };

      if (method === 'POST') {
        options.body = JSON.stringify(payload);
      }

      const res = await fetch(`${this.httpUrl}${endpoint}`, options);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Request failed');
      }
      return data;
    }

    async getPrinters() {
      const res = await this._send('getPrinters');
      return res.printers || [];
    }

    async getConfig() {
      const res = await this._send('getConfig');
      return res.config;
    }

    async saveConfig(newConfig) {
      return await this._send('saveConfig', newConfig);
    }

    async printPatientTubes(options = {}) {
      const { onProgress, ...payload } = options;
      const res = await this._send('printPatientTubes', payload);
      return this._handleBatchProgress(res.jobId, res, onProgress);
    }

    async printBatch(options = {}) {
      const { onProgress, ...payload } = options;
      const res = await this._send('printBatch', payload);
      return this._handleBatchProgress(res.jobId, res, onProgress);
    }

    _handleBatchProgress(jobId, initialResponse, onProgress) {
      if (!onProgress) {
        return Promise.resolve(initialResponse);
      }

      return new Promise((resolve) => {
        let isDone = false;
        const progressHandler = (e) => {
          if (e.jobId === jobId) onProgress(e);
        };

        const finishHandler = (e) => {
          if (e.jobId === jobId) {
            isDone = true;
            cleanup();
            resolve({ success: true, ...initialResponse, ...e });
          }
        };

        const cleanup = () => {
          this.off('jobProgress', progressHandler);
          this.off('jobFinished', finishHandler);
        };

        this.on('jobProgress', progressHandler);
        this.on('jobFinished', finishHandler);

        // Auto resolve after 3s if no finish event (HTTP mode)
        setTimeout(() => {
          if (!isDone) {
            cleanup();
            resolve(initialResponse);
          }
        }, 3000);
      });
    }

    async print(options = {}) {
      return await this._send('print', options);
    }

    async cancel(jobId) {
      return await this._send('cancel', { jobId });
    }

    on(event, callback) {
      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, new Set());
      }
      this.eventListeners.get(event).add(callback);
    }

    off(event, callback) {
      if (this.eventListeners.has(event)) {
        this.eventListeners.get(event).delete(callback);
      }
    }

    _emit(event, data) {
      if (this.eventListeners.has(event)) {
        for (const cb of this.eventListeners.get(event)) {
          try {
            cb(data);
          } catch (e) {
            console.error('[SehatLinkPrinter] Listener error:', e);
          }
        }
      }
    }
  }

  return SehatLinkPrinter;
}));
