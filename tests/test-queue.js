const assert = require('assert');
const PrintQueue = require('../src/queue/printQueue');

console.log('--- Testing PrintQueue & Multi-Print Batching ---');

const queue = new PrintQueue({ throttleDelayMs: 10 });
let progressCount = 0;
let jobFinishedTriggered = false;

queue.on('jobProgress', (e) => {
  progressCount++;
  console.log(`[Test Progress] Label ${e.current}/${e.total} (${e.percent}%) -> ${e.item.barcode}`);
});

queue.on('jobFinished', (e) => {
  jobFinishedTriggered = true;
  console.log(`[Test Finished] Printed ${e.totalPrinted} labels in ${e.durationMs}ms`);
});

// Enqueue a batch job with 3 items (total 6 copies: 2 + 1 + 3)
const result = queue.enqueue({
  printer: 'Virtual_Barcode_Printer',
  type: 'tspl',
  items: [
    { barcode: 'BRC001', title: 'Product 1', qty: 2 },
    { barcode: 'BRC002', title: 'Product 2', qty: 1 },
    { barcode: 'BRC003', title: 'Product 3', qty: 3 }
  ]
});

assert.strictEqual(result.totalItems, 6, 'Total expanded items must equal 6 (2+1+3)');
console.log('✅ Batch expansion verification passed: 6 labels');

// Wait for queue processing to complete
setTimeout(() => {
  assert.strictEqual(progressCount, 6, `Expected 6 progress events, got ${progressCount}`);
  assert.strictEqual(jobFinishedTriggered, true, 'Job finished event should have fired');
  console.log('🎉 All PrintQueue & Multi-Print tests passed successfully!');
  process.exit(0);
}, 300);
