const Barcode128 = require('./barcode128');

class PdfBarcode {
  /**
   * Generate exact specimen tube barcode label matching SehatLink LIS template (55mm x 38mm)
   */
  static generatePdf(data) {
    const {
      labNo = 'LAB20260903-001',
      patientName = 'PASIEN CONTOH',
      patientRm = 'RM-000000',
      patientInfo = 'L | 01/01/90',
      tubeType = 'EDTA',
      brand = 'MITRA MEDIKA LAB',
      dept = 'PK',
      orderTime = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      printTime = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    } = data;

    const binary = Barcode128.encode(labNo);
    
    // Exact dimensions for standard label (Width: 260pt, Height: 165pt)
    const pageW = 260;
    const pageH = 165;
    const padX = 14;

    let stream = "";

    // 1. Header: Brand (Left) & PK Tag (Right)
    stream += `0 0 0 rg\n`;
    stream += `BT /F2 9 Tf ${padX} ${pageH - 18} Td (${this._escapePdf(brand.toUpperCase())}) Tj ET\n`;
    
    // Tag background box for "PK"
    stream += `0 0 0 rg ${pageW - padX - 22} ${pageH - 22} 22 13 re f\n`;
    stream += `1 1 1 rg\n`;
    stream += `BT /F2 8 Tf ${pageW - padX - 17} ${pageH - 18} Td (${this._escapePdf(dept)}) Tj ET\n`;

    // Header separator line
    stream += `0 0 0 RG 0.75 w ${padX} ${pageH - 25} m ${pageW - padX} ${pageH - 25} l S\n`;

    // 2. Patient Name (Bold Uppercase)
    const upperName = String(patientName).toUpperCase().substring(0, 24);
    stream += `0 0 0 rg\n`;
    stream += `BT /F2 10 Tf ${padX} ${pageH - 39} Td (${this._escapePdf(upperName)}) Tj ET\n`;

    // 3. Patient Meta (RM | Gender | DOB)
    let metaStr = patientInfo;
    if (!metaStr || metaStr.includes('th')) {
      metaStr = `${patientRm} | ${patientInfo || 'L'}`;
    }
    stream += `0.2 0.2 0.2 rg\n`;
    stream += `BT /F1 8 Tf ${padX} ${pageH - 51} Td (${this._escapePdf(metaStr)}) Tj ET\n`;

    // 4. Barcode Code 128 (Exact Vector Bars)
    const barWidth = 1.35;
    const totalBarcodeWidth = binary.length * barWidth;
    const barHeight = 36;
    const barcodeStartX = padX + (pageW - 2 * padX - totalBarcodeWidth) / 2;
    const barcodeStartY = pageH - 93;

    stream += `0 0 0 rg\n`;
    let curX = barcodeStartX;
    for (let i = 0; i < binary.length; i++) {
      if (binary[i] === '1') {
        stream += `${curX.toFixed(2)} ${barcodeStartY} ${barWidth.toFixed(2)} ${barHeight} re f\n`;
      }
      curX += barWidth;
    }

    // 5. Info Box (Dashed Borders: ORDER_NO - TUBE_NAME)
    const infoText = `${labNo}${tubeType ? ' - ' + String(tubeType).toUpperCase() : ''}`;
    const boxY = pageH - 110;
    
    // Top dashed line
    stream += `0 0 0 RG [3 2] 0 d 0.5 w ${padX} ${boxY + 12} m ${pageW - padX} ${boxY + 12} l S\n`;
    
    // Info text centered
    stream += `[] 0 d 0 0 0 rg\n`;
    const textOffset = (infoText.length * 2.5);
    const infoTextX = (pageW / 2 - textOffset).toFixed(2);
    stream += `BT /F2 8.5 Tf ${infoTextX} ${boxY + 2} Td (${this._escapePdf(infoText)}) Tj ET\n`;
    
    // Bottom dashed line
    stream += `0 0 0 RG [3 2] 0 d 0.5 w ${padX} ${boxY - 3} m ${pageW - padX} ${boxY - 3} l S\n`;

    // 6. Footer Dates: ORD (Left) & PRN (Right)
    stream += `[] 0 d 0.2 0.2 0.2 rg\n`;
    stream += `BT /F1 7 Tf ${padX} ${pageH - 130} Td (ORD: ${this._escapePdf(orderTime)}) Tj ET\n`;
    stream += `BT /F1 7 Tf ${pageW - padX - 80} ${pageH - 130} Td (PRN: ${this._escapePdf(printTime)}) Tj ET\n`;

    // Outer Label Boundary
    stream += `0.8 0.8 0.8 RG 0.5 w 4 4 ${pageW - 8} ${pageH - 8} re S\n`;

    // Assemble Minimal Valid PDF 1.4
    const streamLen = Buffer.byteLength(stream, 'utf-8');

    const obj1 = "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n";
    const obj2 = "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n";
    const obj3 = `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >> endobj\n`;
    const obj4 = `4 0 obj << /Length ${streamLen} >>\nstream\n${stream}\nendstream\nendobj\n`;
    const obj5 = "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n";
    const obj6 = "6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj\n";

    const header = "%PDF-1.4\n";
    let offset = header.length;

    const offsets = [0];
    offsets.push(offset); offset += obj1.length;
    offsets.push(offset); offset += obj2.length;
    offsets.push(offset); offset += obj3.length;
    offsets.push(offset); offset += obj4.length;
    offsets.push(offset); offset += obj5.length;
    offsets.push(offset); offset += obj6.length;

    let xref = "xref\n0 7\n0000000000 65535 f \n";
    for (let i = 1; i <= 6; i++) {
      xref += String(offsets[i]).padStart(10, '0') + " 00000 n \n";
    }

    const startXref = offset;
    const trailer = `trailer << /Size 7 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

    return Buffer.from(header + obj1 + obj2 + obj3 + obj4 + obj5 + obj6 + xref + trailer, 'utf-8');
  }

  static _escapePdf(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }
}

module.exports = PdfBarcode;
