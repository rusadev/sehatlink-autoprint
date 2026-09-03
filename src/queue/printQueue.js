const EventEmitter = require('events');
const { getAdapter } = require('../adapters');
const { TemplateEngine } = require('../templates');

class PrintQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.throttleDelayMs = options.throttleDelayMs || 80;
    this.queue = [];
    this.activeJob = null;
    this.isProcessing = false;
    this.history = [];
    this.maxHistory = options.maxHistory || 100;
  }

  /**
   * Add a single or batch multi-print job to the queue
   * @param {Object} jobData
   * @param {string} jobData.printer - Target printer name or IP
   * @param {'zpl'|'tspl'|'escpos'|'raw'} jobData.type - Format
   * @param {Array<Object>} [jobData.items] - List of items for batch multi-print
   * @param {string|Buffer} [jobData.raw] - Raw command string or Buffer (for single raw print)
   * @param {string} [jobData.customTemplate] - Optional template string
   * @param {number} [jobData.delayMs] - Optional custom throttle delay in ms
   * @returns {Object} Job metadata
   */
  enqueue(jobData) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    // Normalize items: expand quantities if items provided
    let expandedItems = [];
    if (Array.isArray(jobData.items) && jobData.items.length > 0) {
      for (const item of jobData.items) {
        const qty = Math.max(parseInt(item.qty, 10) || 1, 1);
        for (let i = 0; i < qty; i++) {
          expandedItems.push({
            ...item,
            _copyIndex: i + 1,
            _totalCopies: qty,
            qty: 1 // printed 1 by 1 in sequential multi-print
          });
        }
      }
    } else if (jobData.raw || jobData.data) {
      expandedItems = [{
        raw: jobData.raw || jobData.data,
        qty: 1
      }];
    } else if (jobData.barcode) {
      const qty = Math.max(parseInt(jobData.qty, 10) || 1, 1);
      for (let i = 0; i < qty; i++) {
        expandedItems.push({
          ...jobData,
          _copyIndex: i + 1,
          _totalCopies: qty,
          qty: 1
        });
      }
    }

    const job = {
      id: jobId,
      printer: jobData.printer || 'Virtual_Barcode_Printer',
      type: jobData.type || 'zpl',
      customTemplate: jobData.customTemplate || '',
      delayMs: jobData.delayMs !== undefined ? jobData.delayMs : this.throttleDelayMs,
      items: expandedItems,
      totalCount: expandedItems.length,
      processedCount: 0,
      status: 'pending', // 'pending', 'processing', 'completed', 'failed', 'cancelled'
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      errors: []
    };

    this.queue.push(job);
    this.emit('jobEnqueued', { jobId: job.id, total: job.totalCount, printer: job.printer });

    // Trigger processing
    this._processNext();

    return {
      jobId: job.id,
      totalItems: job.totalCount,
      printer: job.printer,
      status: job.status
    };
  }

  /**
   * Internal queue processor
   */
  async _processNext() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const job = this.queue.shift();
    this.activeJob = job;

    job.status = 'processing';
    job.startedAt = new Date().toISOString();
    this.emit('jobStarted', { jobId: job.id, total: job.totalCount, printer: job.printer });

    const adapter = getAdapter(job.printer);

    try {
      for (let idx = 0; idx < job.items.length; idx++) {
        if (job.status === 'cancelled') {
          break;
        }

        const item = job.items[idx];
        const payload = TemplateEngine.render(job.type, item, job.customTemplate);

        await adapter.send(payload, {
          jobId: job.id,
          itemIndex: idx + 1,
          total: job.totalCount,
          barcode: item.barcode
        });

        job.processedCount++;
        const percent = Math.round((job.processedCount / job.totalCount) * 100);

        this.emit('jobProgress', {
          jobId: job.id,
          current: job.processedCount,
          total: job.totalCount,
          percent,
          item: {
            barcode: item.barcode,
            title: item.title,
            copy: `${item._copyIndex || 1}/${item._totalCopies || 1}`
          }
        });

        // Throttle delay between labels if there are more items
        if (idx < job.items.length - 1 && job.delayMs > 0) {
          await new Promise(r => setTimeout(r, job.delayMs));
        }
      }

      if (job.status !== 'cancelled') {
        job.status = 'completed';
      }
    } catch (err) {
      job.status = 'failed';
      job.errors.push(err.message);
      this.emit('jobFailed', { jobId: job.id, error: err.message });
      console.error(`[PrintQueue] Job ${job.id} failed:`, err);
    } finally {
      job.completedAt = new Date().toISOString();
      this.activeJob = null;
      this.isProcessing = false;

      // Add to history
      this.history.unshift({ ...job, items: undefined }); // omit heavy item array in history
      if (this.history.length > this.maxHistory) {
        this.history.pop();
      }

      if (job.status === 'completed') {
        this.emit('jobFinished', {
          jobId: job.id,
          totalPrinted: job.processedCount,
          durationMs: new Date(job.completedAt) - new Date(job.startedAt)
        });
      }

      // Continue processing next job in queue
      setImmediate(() => this._processNext());
    }
  }

  /**
   * Cancel a pending or active job
   */
  cancelJob(jobId) {
    if (this.activeJob && this.activeJob.id === jobId) {
      this.activeJob.status = 'cancelled';
      this.emit('jobCancelled', { jobId });
      return true;
    }

    const index = this.queue.findIndex(j => j.id === jobId);
    if (index !== -1) {
      const removed = this.queue.splice(index, 1)[0];
      removed.status = 'cancelled';
      this.emit('jobCancelled', { jobId });
      return true;
    }

    return false;
  }

  getQueueStatus() {
    return {
      isProcessing: this.isProcessing,
      activeJob: this.activeJob ? {
        id: this.activeJob.id,
        printer: this.activeJob.printer,
        type: this.activeJob.type,
        current: this.activeJob.processedCount,
        total: this.activeJob.totalCount,
        percent: Math.round((this.activeJob.processedCount / (this.activeJob.totalCount || 1)) * 100),
        startedAt: this.activeJob.startedAt
      } : null,
      pendingCount: this.queue.length,
      history: this.history.slice(0, 10)
    };
  }
}

module.exports = PrintQueue;
