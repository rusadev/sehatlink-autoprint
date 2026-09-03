const ZplBuilder = require('./zplBuilder');
const TsplBuilder = require('./tsplBuilder');
const EscposBuilder = require('./escposBuilder');
const LisTemplates = require('./lisTemplates');
const PdfBarcode = require('../utils/pdfBarcode');
const Barcode128 = require('../utils/barcode128');

class TemplateEngine {
  static render(type = 'tspl', item = {}, customTemplate = '') {
    if (customTemplate) {
      return this.renderCustom(customTemplate, item);
    }

    const t = String(type).toLowerCase();

    // Check if PDF / Desktop printer format
    if (t === 'pdf' || t === 'ps' || t === 'desktop' || t === 'document') {
      return PdfBarcode.generatePdf({
        labNo: item.labNo || item.barcode || 'TEST-123456',
        patientName: item.patientName || item.title || 'Pasien Lab',
        patientRm: item.patientRm || item.subtitle || 'RM-000000',
        patientInfo: item.patientInfo || '',
        tubeType: item.tubeType || 'EDTA',
        testName: item.testName || item.price || 'Pemeriksaan Lab',
        dateTime: item.dateTime
      });
    }

    // Check if LIS specimen label format
    if (t.startsWith('lis') || item.isLisSpecimen || item.tubeType || item.labNo) {
      return LisTemplates.buildSpecimenLabel({
        labNo: item.labNo || item.barcode,
        patientName: item.patientName || item.title || 'Pasien Lab',
        patientRm: item.patientRm || item.subtitle || '',
        patientInfo: item.patientInfo || '',
        tubeType: item.tubeType || 'EDTA',
        testName: item.testName || item.price || '',
        dateTime: item.dateTime,
        widthMm: item.widthMm || 50,
        heightMm: item.heightMm || 30
      }, t);
    }

    switch (t) {
      case 'zpl':
      case 'zebra':
        return ZplBuilder.buildBarcodeLabel(item);

      case 'tspl':
      case 'tsc':
      case 'xprinter':
        return TsplBuilder.buildBarcodeLabel(item);

      case 'escpos':
      case 'esc-pos':
      case 'thermal':
        return EscposBuilder.buildBarcodeLabel(item);

      case 'raw':
        return item.data || item.raw || '';

      default:
        return TsplBuilder.buildBarcodeLabel(item);
    }
  }

  static renderCustom(templateStr, data) {
    return templateStr.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : '';
    });
  }
}

module.exports = {
  TemplateEngine,
  ZplBuilder,
  TsplBuilder,
  EscposBuilder,
  LisTemplates,
  PdfBarcode,
  Barcode128
};
