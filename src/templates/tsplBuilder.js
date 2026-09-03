/**
 * TSPL (TSC Programming Language) Template Builder
 * Designed for Xprinter (XP-420B, XP-360B, etc.), TSC (TE200), Blueprint, Kassen, and Rongta.
 */

class TsplBuilder {
  /**
   * Build a standard barcode label in TSPL format.
   * @param {Object} options
   * @param {string} options.barcode - The barcode string
   * @param {string} [options.title] - Product title / top line
   * @param {string} [options.subtitle] - Second line / SKU
   * @param {string} [options.price] - Price text
   * @param {string} [options.barcodeType='128'] - 128, 39, QR, EAN13
   * @param {number} [options.widthMm=50] - Label width in mm
   * @param {number} [options.heightMm=30] - Label height in mm
   * @param {number} [options.gapMm=2] - Gap between labels in mm
   * @param {number} [options.qty=1] - Quantity
   * @returns {string} TSPL command string
   */
  static buildBarcodeLabel(options) {
    const {
      barcode,
      title = '',
      subtitle = '',
      price = '',
      barcodeType = '128',
      widthMm = 50,
      heightMm = 30,
      gapMm = 2,
      qty = 1
    } = options;

    let commands = [];
    commands.push(`SIZE ${widthMm} mm, ${heightMm} mm`);
    commands.push(`GAP ${gapMm} mm, 0 mm`);
    commands.push(`DIRECTION 1`);
    commands.push(`CLS`);

    let currentY = 15;

    // 1. Title
    if (title) {
      commands.push(`TEXT 20, ${currentY}, "TSS24.BF2", 0, 1, 1, "${this.escapeTspl(title)}"`);
      currentY += 28;
    }

    // 2. Subtitle / SKU
    if (subtitle) {
      commands.push(`TEXT 20, ${currentY}, "1", 0, 1, 1, "${this.escapeTspl(subtitle)}"`);
      currentY += 22;
    }

    // 3. Barcode / QR
    if (barcodeType.toUpperCase() === 'QR') {
      commands.push(`QRCODE 140, ${currentY}, L, 4, A, 0, M2, S7, "${this.escapeTspl(barcode)}"`);
      currentY += 100;
    } else if (barcodeType === 'EAN13' || barcodeType === 'EAN') {
      commands.push(`BARCODE 30, ${currentY}, "EAN13", 55, 1, 0, 2, 4, "${this.escapeTspl(barcode)}"`);
      currentY += 75;
    } else if (barcodeType === '39') {
      commands.push(`BARCODE 30, ${currentY}, "39", 55, 1, 0, 2, 4, "${this.escapeTspl(barcode)}"`);
      currentY += 75;
    } else {
      // Code 128
      commands.push(`BARCODE 30, ${currentY}, "128", 55, 1, 0, 2, 4, "${this.escapeTspl(barcode)}"`);
      currentY += 75;
    }

    // 4. Price
    if (price) {
      commands.push(`TEXT 20, ${currentY}, "TSS24.BF2", 0, 1, 1, "${this.escapeTspl(price)}"`);
    }

    // 5. Print command: PRINT <sets>, <copies>
    commands.push(`PRINT 1, ${qty}`);

    return commands.join('\r\n') + '\r\n';
  }

  static escapeTspl(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '\'').replace(/[\r\n]/g, ' ');
  }
}

module.exports = TsplBuilder;
