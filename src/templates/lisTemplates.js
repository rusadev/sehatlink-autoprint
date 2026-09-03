const ZplBuilder = require('./zplBuilder');
const TsplBuilder = require('./tsplBuilder');
const EscposBuilder = require('./escposBuilder');
const PdfBarcode = require('../utils/pdfBarcode');

class LisTemplates {
  /**
   * Build exact specimen tube barcode label matching SehatLink LIS
   */
  static buildSpecimenLabel(data, format = 'tspl') {
    const {
      labNo,
      patientName,
      patientRm = '',
      patientInfo = '',
      tubeType = 'EDTA',
      testName = '',
      brand = 'MITRA MEDIKA LAB',
      dept = 'PK',
      orderTime,
      printTime,
      widthMm = 55,
      heightMm = 38
    } = data;

    const f = String(format).toLowerCase();

    // 1. Vector PDF for Epson L3210 & standard desktop printers
    if (f === 'pdf' || f === 'ps' || f === 'desktop' || f === 'document') {
      return PdfBarcode.generatePdf({
        labNo,
        patientName,
        patientRm,
        patientInfo,
        tubeType,
        brand,
        dept,
        orderTime,
        printTime
      });
    }

    // 2. ZPL for Zebra printers
    if (f === 'zpl' || f === 'zebra') {
      return this._buildSpecimenZpl({
        labNo,
        patientName,
        patientRm,
        patientInfo,
        tubeType,
        brand,
        dept,
        widthMm,
        heightMm
      });
    }

    // 3. Default TSPL (Xprinter, TSC)
    return this._buildSpecimenTspl({
      labNo,
      patientName,
      patientRm,
      patientInfo,
      tubeType,
      brand,
      dept,
      widthMm,
      heightMm
    });
  }

  static _buildSpecimenTspl(d) {
    const lines = [];
    lines.push(`SIZE ${d.widthMm} mm, ${d.heightMm} mm`);
    lines.push(`GAP 2 mm, 0 mm`);
    lines.push(`DIRECTION 1`);
    lines.push(`CLS`);

    // 1. Header: Brand & Tag
    lines.push(`TEXT 15, 10, "TSS24.BF2", 0, 1, 1, "${TsplBuilder.escapeTspl(d.brand || 'MITRA MEDIKA LAB')}"`);
    lines.push(`TEXT 360, 10, "TSS24.BF2", 0, 1, 1, "[${TsplBuilder.escapeTspl(d.dept || 'PK')}]"`);
    lines.push(`BAR 15, 36, 400, 2`);

    // 2. Patient Name & Meta
    const name = `${d.patientName}`.toUpperCase().substring(0, 22);
    lines.push(`TEXT 15, 44, "TSS24.BF2", 0, 1, 1, "${TsplBuilder.escapeTspl(name)}"`);
    const meta = `${d.patientRm ? d.patientRm + ' | ' : ''}${d.patientInfo || 'L'}`;
    lines.push(`TEXT 15, 70, "1", 0, 1, 1, "${TsplBuilder.escapeTspl(meta)}"`);

    // 3. Barcode
    lines.push(`BARCODE 30, 95, "128", 45, 1, 0, 2, 4, "${TsplBuilder.escapeTspl(d.labNo)}"`);

    // 4. Info Box (ORDER_NO - TUBE)
    const info = `${d.labNo} - ${String(d.tubeType).toUpperCase()}`;
    lines.push(`TEXT 80, 150, "TSS24.BF2", 0, 1, 1, "${TsplBuilder.escapeTspl(info)}"`);

    // 5. Footer Dates
    const nowStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    lines.push(`TEXT 15, 180, "1", 0, 1, 1, "ORD: ${nowStr}"`);
    lines.push(`TEXT 260, 180, "1", 0, 1, 1, "PRN: ${nowStr}"`);

    lines.push(`PRINT 1, 1\r\n`);
    return lines.join('\r\n');
  }

  static _buildSpecimenZpl(d) {
    const widthDots = ZplBuilder.mmToDots(d.widthMm, 203);
    const heightDots = ZplBuilder.mmToDots(d.heightMm, 203);

    let zpl = '^XA\n';
    zpl += `^PW${widthDots}\n`;
    zpl += `^LL${heightDots}\n`;
    zpl += '^LH0,0\n';

    const brand = ZplBuilder.escapeZpl(d.brand || 'MITRA MEDIKA LAB');
    zpl += `^FO15,10^A0N,20,20^FD${brand}^FS\n`;
    zpl += `^FO360,10^A0N,20,20^FD[${d.dept || 'PK'}]^FS\n`;
    zpl += `^FO15,34^GB${widthDots - 30},2,2^FS\n`;

    const name = ZplBuilder.escapeZpl(`${d.patientName}`.toUpperCase().substring(0, 22));
    zpl += `^FO15,44^A0N,22,22^FD${name}^FS\n`;

    const meta = ZplBuilder.escapeZpl(`${d.patientRm ? d.patientRm + ' | ' : ''}${d.patientInfo || 'L'}`);
    zpl += `^FO15,70^A0N,18,18^FD${meta}^FS\n`;

    zpl += `^FO30,95^BCN,45,Y,N,N^FD>:${ZplBuilder.escapeZpl(d.labNo)}^FS\n`;

    const info = ZplBuilder.escapeZpl(`${d.labNo} - ${String(d.tubeType).toUpperCase()}`);
    zpl += `^FO80,150^A0N,20,20^FD${info}^FS\n`;

    zpl += '^XZ\n';
    return zpl;
  }
}

module.exports = LisTemplates;
