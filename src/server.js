const http = require('http');
const https = require('https');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const express = require('express');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');
const { getSystemPrinters } = require('./utils/systemPrinters');
const { virtualPrinterInstance, getAdapter } = require('./adapters');
const { TemplateEngine, LisTemplates, PdfBarcode, Barcode128 } = require('./templates');
const { getConfig, saveConfig } = require('./configManager');
const PrintQueue = require('./queue/printQueue');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const config = getConfig();
const printQueue = new PrintQueue({
  throttleDelayMs: config.printers?.throttleDelayMs || 80
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// -------------------------------------------------------------
// WebSocket Real-time Event Streaming
// -------------------------------------------------------------
const wsClients = new Set();
const printLogs = [];

function addPrintLog(log) {
  const item = {
    id: 'log_' + Date.now(),
    time: new Date().toLocaleTimeString('id-ID'),
    ...log
  };
  printLogs.unshift(item);
  if (printLogs.length > 50) printLogs.pop();
  broadcast('printActivity', item);
}

wss.on('connection', (ws) => {
  wsClients.add(ws);

  ws.send(JSON.stringify({
    event: 'connected',
    service: 'SehatLink LIS Auto-Print Service',
    version: '1.0.0',
    config: getConfig(),
    logs: printLogs.slice(0, 15),
    timestamp: new Date().toISOString()
  }));

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      const { action, id, payload } = data;

      switch (action) {
        case 'getPrinters': {
          const printers = await getSystemPrinters();
          ws.send(JSON.stringify({ responseTo: id, action, success: true, printers }));
          break;
        }

        case 'getConfig': {
          ws.send(JSON.stringify({ responseTo: id, action, success: true, config: getConfig() }));
          break;
        }

        case 'saveConfig': {
          const result = saveConfig(payload);
          if (result.success && result.config?.printers?.throttleDelayMs) {
            printQueue.throttleDelayMs = result.config.printers.throttleDelayMs;
          }
          ws.send(JSON.stringify({ responseTo: id, action, ...result }));
          break;
        }

        case 'clearQueue': {
          clearSystemSpoolerQueue((err, msg) => {
            ws.send(JSON.stringify({ responseTo: id, action, success: !err, message: msg || err?.message }));
          });
          break;
        }

        case 'print':
        case 'printBatch': {
          const result = printQueue.enqueue(payload || {});
          ws.send(JSON.stringify({ responseTo: id, action, success: true, ...result }));
          break;
        }

        case 'getStatus': {
          const status = printQueue.getQueueStatus();
          ws.send(JSON.stringify({ responseTo: id, action, success: true, status }));
          break;
        }

        case 'cancel': {
          const cancelled = printQueue.cancelJob(payload?.jobId);
          ws.send(JSON.stringify({ responseTo: id, action, success: cancelled }));
          break;
        }

        default:
          ws.send(JSON.stringify({ responseTo: id, action, success: false, error: `Unknown: "${action}"` }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ event: 'error', error: err.message }));
    }
  });

  ws.on('close', () => {
    wsClients.delete(ws);
  });
});

function broadcast(event, payload) {
  const msg = JSON.stringify({ event, ...payload });
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

printQueue.on('jobEnqueued', (e) => broadcast('jobEnqueued', e));
printQueue.on('jobStarted', (e) => broadcast('jobStarted', e));
printQueue.on('jobProgress', (e) => broadcast('jobProgress', e));
printQueue.on('jobFinished', (e) => broadcast('jobFinished', e));
printQueue.on('jobFailed', (e) => broadcast('jobFailed', e));
printQueue.on('jobCancelled', (e) => broadcast('jobCancelled', e));

function clearSystemSpoolerQueue(callback) {
  const platform = os.platform();
  if (platform === 'win32') {
    const cmd = `powershell -NoProfile -Command "Get-PrintJob -PrinterName * | Remove-PrintJob -ErrorAction SilentlyContinue"`;
    exec(cmd, (err) => {
      if (err) return callback(err);
      callback(null, 'Antrean printer Windows Spooler berhasil dibersihkan');
    });
  } else {
    exec('cancel -a 2>/dev/null || true', (err) => {
      if (err) return callback(err);
      callback(null, 'Antrean printer CUPS berhasil dibersihkan');
    });
  }
}

// -------------------------------------------------------------
// HTTP REST Endpoints (Plug & Play for SaaS LIS SehatLink)
// -------------------------------------------------------------

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'sehatlink-autoprint',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/config', (req, res) => {
  res.json({ success: true, config: getConfig() });
});

app.post('/api/config', (req, res) => {
  const result = saveConfig(req.body);
  if (result.success && result.config?.printers?.throttleDelayMs) {
    printQueue.throttleDelayMs = result.config.printers.throttleDelayMs;
  }
  res.json(result);
});

app.get('/api/printers', async (req, res) => {
  try {
    const printers = await getSystemPrinters();
    res.json({ success: true, printers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/logs', (req, res) => {
  res.json({ success: true, logs: printLogs });
});

app.post('/api/clear-queue', (req, res) => {
  clearSystemSpoolerQueue((err, message) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    addPrintLog({ type: 'system', title: 'Antrean printer dibersihkan', printer: 'SYSTEM', status: 'success' });
    res.json({ success: true, message });
  });
});

// 1. TEST PRINT BARCODE
app.post('/api/test-print', async (req, res) => {
  try {
    const { printer, format, mode } = req.body;
    const targetPrinter = printer || 'EPSON_L3210_Series';
    const adapter = getAdapter(targetPrinter);
    const isDesktop = mode === 'document' || (adapter.isStandardDesktopPrinter?.() && targetPrinter !== 'Virtual_Barcode_Printer');

    const testItem = {
      labNo: `LAB${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-TEST`,
      patientName: 'TES BARCODE SEHATLINK',
      patientRm: 'RM-048291',
      patientInfo: 'L / 38 th',
      tubeType: 'EDTA',
      testName: 'Darah Lengkap + Gol. Darah',
      isLisSpecimen: true,
      qty: 1
    };

    const targetFormat = isDesktop ? 'pdf' : (format || 'tspl');

    const result = printQueue.enqueue({
      printer: targetPrinter,
      type: targetFormat,
      items: [testItem]
    });

    addPrintLog({
      type: 'barcode',
      title: `Test Barcode (${testItem.tubeType})`,
      patient: testItem.patientName,
      labNo: testItem.labNo,
      printer: targetPrinter,
      status: 'success'
    });

    res.json({
      success: true,
      message: `Label barcode uji coba berhasil dikirim ke printer "${targetPrinter}"`,
      formatUsed: targetFormat,
      ...result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. PRINT HASIL PEMERIKSAAN LAB (PDF)
app.post('/api/print-result', async (req, res) => {
  try {
    const { printer, pdfUrl, base64Pdf, jobType, title, details, copies = 1 } = req.body;
    const targetPrinter = printer || 'EPSON_L3210_Series';
    const adapter = getAdapter(targetPrinter);

    let pdfBuffer;

    if (base64Pdf) {
      const cleanBase64 = base64Pdf.includes(',') ? base64Pdf.split(',')[1] : base64Pdf;
      pdfBuffer = Buffer.from(cleanBase64, 'base64');
    } else if (pdfUrl) {
      pdfBuffer = await new Promise((resolve, reject) => {
        const client = pdfUrl.startsWith('https') ? https : http;
        client.get(pdfUrl, (response) => {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            return client.get(response.headers.location, (res2) => {
              const data = [];
              res2.on('data', chunk => data.push(chunk));
              res2.on('end', () => resolve(Buffer.concat(data)));
            }).on('error', reject);
          }
          const data = [];
          response.on('data', chunk => data.push(chunk));
          response.on('end', () => resolve(Buffer.concat(data)));
        }).on('error', reject);
      });
    } else {
      pdfBuffer = PdfBarcode.generatePdf({
        labNo: `HASIL-${Date.now().toString().slice(-6)}`,
        patientName: 'HASIL PEMERIKSAAN LAB SEHATLINK',
        patientRm: 'RM-048291',
        tubeType: 'HASIL',
        testName: 'Hasil Laboratorium (A4/F4)'
      });
    }

    const printResult = await adapter.send(pdfBuffer, { mode: 'document', copies });

    const logType = jobType || (String(title || '').toLowerCase().includes('barcode') ? 'barcode' : 'result');
    const logTitle = title || (logType === 'barcode' ? 'Label Barcode Spesimen' : 'Lembar Hasil Pemeriksaan Lab (A4/F4)');

    addPrintLog({
      type: logType,
      title: logTitle,
      details: details || (copies > 1 ? (copies + ' Copy') : ''),
      printer: targetPrinter,
      copies: copies,
      status: 'success'
    });

    res.json({ success: true, message: `Hasil laboratorium berhasil dikirim ke printer "${targetPrinter}"`, ...printResult });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. MULTI-TUBE SPECIMEN PRINT
app.post('/api/lis/print-patient-tubes', (req, res) => {
  try {
    const { patient, labNo, tubes, printer, format } = req.body;
    const currentConfig = getConfig();
    const targetPrinter = printer || currentConfig.printers?.defaultBarcodePrinter || 'EPSON_L3210_Series';
    const adapter = getAdapter(targetPrinter);
    const isDesktop = adapter.isStandardDesktopPrinter?.() && targetPrinter !== 'Virtual_Barcode_Printer';
    const targetFormat = format || (isDesktop ? 'pdf' : (currentConfig.printers?.defaultFormat || 'tspl'));

    const items = (tubes || ['EDTA']).map((tube) => {
      const isObj = typeof tube === 'object';
      return {
        labNo,
        patientName: patient?.name || 'Pasien Lab',
        patientRm: patient?.rm || '',
        patientInfo: `${patient?.gender || 'L'} / ${patient?.age || '30'} th`,
        tubeType: isObj ? tube.name : tube,
        testName: isObj ? (tube.testName || tube.tests) : 'Pemeriksaan Lab',
        qty: isObj ? (tube.qty || 1) : 1,
        isLisSpecimen: true
      };
    });

    const result = printQueue.enqueue({
      printer: targetPrinter,
      type: targetFormat,
      items
    });

    items.forEach(it => {
      addPrintLog({
        type: 'barcode',
        title: `Barcode Tabung [${it.tubeType}]`,
        patient: `${it.patientName} (${it.patientRm})`,
        labNo: it.labNo,
        printer: targetPrinter,
        status: 'success'
      });
    });

    res.json({ success: true, message: `Dispatched ${items.length} tube labels to queue`, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/print', (req, res) => {
  try {
    const result = printQueue.enqueue(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/print-batch', (req, res) => {
  try {
    const result = printQueue.enqueue(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/queue', (req, res) => {
  res.json({ success: true, ...printQueue.getQueueStatus() });
});

app.post('/api/queue/cancel/:id', (req, res) => {
  const cancelled = printQueue.cancelJob(req.params.id);
  res.json({ success: cancelled, jobId: req.params.id });
});

app.get('/api/virtual/history', (req, res) => {
  res.json({ success: true, history: virtualPrinterInstance.getHistory() });
});

app.post('/api/virtual/clear', (req, res) => {
  virtualPrinterInstance.clearHistory();
  res.json({ success: true });
});

// Helper auto-launch desktop GUI window
function openDesktopAppWindow(url) {
  const platform = os.platform();
  const noOpen = process.env.NO_OPEN === 'true';
  if (noOpen) return;

  setTimeout(() => {
    if (platform === 'darwin') {
      exec(`open -na "Google Chrome" --args --app="${url}" || open "${url}"`, () => {});
    } else if (platform === 'win32') {
      exec(`start chrome --app="${url}" || start msedge --app="${url}" || start "${url}"`, () => {});
    } else {
      exec(`google-chrome --app="${url}" || xdg-open "${url}"`, () => {});
    }
  }, 500);
}

// Error handling for EADDRINUSE
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ [ERROR] Port ${err.port} sudah digunakan oleh proses lain.`);
    console.error(`💡 Solusi: Jalankan: lsof -ti:${err.port} | xargs kill -9\n`);
  } else {
    console.error('Server error:', err);
  }
});

// Start Server
const currentCfg = getConfig();
const PORT = process.env.PORT || currentCfg.server?.port || 8181;
const HOST = currentCfg.server?.host || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`
===========================================================
🏥 SehatLink LIS Auto-Print Service (v1.0.0)
===========================================================
📡 HTTP REST API:   http://localhost:${PORT}
⚡ WebSocket API:   ws://localhost:${PORT}
🖥️ GUI Live Window: http://localhost:${PORT}
===========================================================
Ready for 2-Printer Setup: 1. Barcode Label & 2. Cetak Hasil!
`);

  openDesktopAppWindow(`http://localhost:${PORT}`);
});
