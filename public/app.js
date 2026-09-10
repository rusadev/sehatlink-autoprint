document.addEventListener('DOMContentLoaded', async () => {
  const wsUrl = `http://${window.location.hostname || 'localhost'}:${window.location.port || 8181}`;
  const printerSdk = new SehatLinkPrinter(wsUrl);

  const connectionBadge = document.getElementById('connection-badge');
  const connectionText = document.getElementById('connection-text');
  const btnRestartService = document.getElementById('btn-restart-service');
  const btnClearQueue = document.getElementById('btn-clear-queue');
  const alertStatus = document.getElementById('alert-status');
  const logFeed = document.getElementById('log-feed');
  const logCount = document.getElementById('log-count');
  const statTotal = document.getElementById('stat-total');
  const statSpooler = document.getElementById('stat-spooler');

  let totalLogs = 0;

  function addLogToFeed(log) {
    if (totalLogs === 0) {
      logFeed.innerHTML = '';
    }
    totalLogs++;
    logCount.textContent = `${totalLogs} Pekerjaan`;
    statTotal.textContent = `${totalLogs} Cetakan`;

    const item = document.createElement('div');
    const isBarcode = log.type === 'barcode' || String(log.title || '').toLowerCase().includes('barcode');
    const isSystem = log.type === 'system';
    
    let typeClass = 'result';
    let typeLabel = 'HASIL LAB';
    
    if (isBarcode) {
      typeClass = 'barcode';
      typeLabel = 'BARCODE';
    } else if (isSystem) {
      typeClass = 'system';
      typeLabel = 'SISTEM';
    }

    item.className = `log-item ${typeClass}`;

    const titleText = log.title || (isBarcode ? 'Label Barcode Spesimen' : 'Lembar Hasil Lab (A4/F4)');
    const printerName = log.printer ? `<span style="color:#0284c7; font-weight:600;">➔ ${log.printer}</span>` : '';
    const details = log.details ? `<span class="log-meta-tag">${log.details}</span>` : '';

    item.innerHTML = `
      <div style="flex-grow: 1; padding-right: 12px;">
        <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
          <span class="type-pill ${typeClass}">${typeLabel}</span>
          <span class="log-title">${titleText}</span>
        </div>
        <div class="log-meta">
          ${details ? details + ' &bull; ' : ''}
          Tujuan: ${printerName || '<span style="color:#64748b">Printer Default</span>'}
        </div>
      </div>
      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 3px; min-width: 70px;">
        <span class="log-badge">BERHASIL</span>
        <span class="log-time">${log.time || new Date().toLocaleTimeString('id-ID')}</span>
      </div>
    `;

    logFeed.insertBefore(item, logFeed.firstChild);
  }

  const currentPort = window.location.port || '18181';
  const statPort = document.getElementById('stat-port');
  if (statPort) statPort.textContent = `${currentPort} (Aktif)`;

  printerSdk.on('connected', () => {
    connectionBadge.className = 'badge online';
    connectionText.textContent = `Online (${currentPort})`;
    statSpooler.textContent = 'Normal';
    statSpooler.style.color = '#059669';
  });

  printerSdk.on('printActivity', (log) => {
    addLogToFeed(log);
  });

  printerSdk.on('disconnected', () => {
    connectionBadge.className = 'badge offline';
    connectionText.textContent = 'Terputus';
    statSpooler.textContent = 'Offline';
    statSpooler.style.color = '#dc2626';
  });

  // RESTART SERVICE
  btnRestartService.addEventListener('click', async () => {
    btnRestartService.disabled = true;
    btnRestartService.textContent = 'Merestart...';
    try {
      const res = await fetch('/api/restart-service', { method: 'POST' });
      const data = await res.json();
      showAlert(data.message || 'Service berhasil direstart!', 'success');
    } catch (e) {
      showAlert('Gagal restart service: ' + e.message, 'error');
    } finally {
      btnRestartService.disabled = false;
      btnRestartService.textContent = 'Restart Service';
    }
  });

  // CLEAR SPOOLER QUEUE
  btnClearQueue.addEventListener('click', async () => {
    btnClearQueue.disabled = true;
    try {
      const res = await fetch('/api/clear-queue', { method: 'POST' });
      const data = await res.json();
      showAlert(data.message || 'Antrean printer berhasil dibersihkan.', 'success');
    } catch (e) {
      showAlert('Gagal membersihkan antrean: ' + e.message, 'error');
    } finally {
      btnClearQueue.disabled = false;
    }
  });

  function showAlert(msg, type = 'success') {
    alertStatus.textContent = msg;
    alertStatus.className = `alert-box ${type}`;
    alertStatus.style.display = 'block';
    setTimeout(() => {
      alertStatus.style.display = 'none';
    }, 3500);
  }

  try {
    await printerSdk.connect();
  } catch (e) {
    console.warn('WebSocket connection error:', e);
  }
});
