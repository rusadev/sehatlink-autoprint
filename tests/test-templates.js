const assert = require('assert');
const { ZplBuilder, TsplBuilder, EscposBuilder, TemplateEngine } = require('../src/templates');

console.log('--- Testing Template Builders ---');

// 1. Test ZPL Builder
const zpl = ZplBuilder.buildBarcodeLabel({
  barcode: '8991234567',
  title: 'Kopi Kenangan',
  price: 'Rp 22.000',
  barcodeType: '128',
  qty: 2
});

assert(zpl.includes('^XA'), 'ZPL must start with ^XA');
assert(zpl.includes('^XZ'), 'ZPL must end with ^XZ');
assert(zpl.includes('8991234567'), 'ZPL must contain barcode');
assert(zpl.includes('Kopi Kenangan'), 'ZPL must contain title');
assert(zpl.includes('^PQ2'), 'ZPL must set quantity ^PQ2');
console.log('✅ ZPL Builder test passed');

// 2. Test TSPL Builder
const tspl = TsplBuilder.buildBarcodeLabel({
  barcode: '8997654321',
  title: 'Roti Bakar',
  price: 'Rp 15.000',
  barcodeType: '128',
  qty: 1
});

assert(tspl.includes('SIZE 50 mm, 30 mm'), 'TSPL must set label size');
assert(tspl.includes('BARCODE'), 'TSPL must contain BARCODE command');
assert(tspl.includes('8997654321'), 'TSPL must contain barcode string');
assert(tspl.includes('PRINT 1, 1'), 'TSPL must contain PRINT command');
console.log('✅ TSPL Builder test passed');

// 3. Test ESC/POS Builder
const escpos = EscposBuilder.buildBarcodeLabel({
  barcode: '123456',
  title: 'Struk Label',
  price: 'Rp 5.000',
  barcodeType: '128',
  qty: 1
});

assert(Buffer.isBuffer(escpos), 'ESC/POS must return a Buffer');
assert(escpos.length > 10, 'ESC/POS buffer must have content');
console.log('✅ ESC/POS Builder test passed');

// 4. Test TemplateEngine Router
const zplOutput = TemplateEngine.render('zpl', { barcode: '111', title: 'Test' });
assert(zplOutput.includes('^XA'), 'TemplateEngine must render ZPL');

const tsplOutput = TemplateEngine.render('tspl', { barcode: '222', title: 'Test' });
assert(tsplOutput.includes('CLS'), 'TemplateEngine must render TSPL');

console.log('🎉 All Template tests passed successfully!');
