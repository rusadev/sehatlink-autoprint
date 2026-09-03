const assert = require('assert');
const { LisTemplates } = require('../src/templates');

console.log('--- Testing SehatLink LIS Tube Label Templates ---');

const tsplLabel = LisTemplates.buildSpecimenLabel({
  labNo: 'LAB20260902-001',
  patientName: 'Bpk. Budi Santoso',
  patientRm: 'RM-00129',
  patientInfo: 'L / 38 th',
  tubeType: 'EDTA',
  testName: 'Darah Lengkap + Gol. Darah',
  dateTime: '02/09/2026 08:30',
  widthMm: 50,
  heightMm: 30
}, 'tspl');

assert(tsplLabel.includes('Bpk. Budi Santoso'), 'TSPL must contain Patient Name');
assert(tsplLabel.includes('[EDTA]'), 'TSPL must contain Tube Type');
assert(tsplLabel.includes('LAB20260902-001'), 'TSPL must contain Lab Order Barcode');
assert(tsplLabel.includes('RM: RM-00129'), 'TSPL must contain RM');
console.log('✅ LIS TSPL Specimen Label test passed');

const zplLabel = LisTemplates.buildSpecimenLabel({
  labNo: 'LAB20260902-001',
  patientName: 'Bpk. Budi Santoso',
  patientRm: 'RM-00129',
  patientInfo: 'L / 38 th',
  tubeType: 'SERUM',
  testName: 'SGOT, SGPT, Ureum',
  dateTime: '02/09/2026 08:30',
  widthMm: 50,
  heightMm: 30
}, 'zpl');

assert(zplLabel.includes('^XA'), 'ZPL must start with ^XA');
assert(zplLabel.includes('[SERUM]'), 'ZPL must contain Tube Type');
assert(zplLabel.includes('LAB20260902-001'), 'ZPL must contain Barcode');
console.log('✅ LIS ZPL Specimen Label test passed');

console.log('🎉 All LIS Label tests passed successfully!');
