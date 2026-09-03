/**
 * ZPL (Zebra Programming Language) Template Builder
 * Designed for barcode and label printing on Zebra and compatible printers.
 */

class ZplBuilder {
  /**
   * Convert mm to dots based on DPI (default 203 DPI = 8 dots/mm)
   */
  static mmToDots(mm, dpi = 203) {
    const dotsPerMm = dpi === 300 ? 11.81 : dpi === 600 ? 23.62 : 8; // 203 dpi
    return Math.round(mm * dotsPerMm);
  }

  /**
   * Build a standard barcode label in ZPL format.
   * @param {Object} options
   * @param {string} options.barcode - The barcode string
   * @param {string} [options.title] - Product title / top line
   * @param {string} [options.subtitle] - Second line or SKU
   * @param {string} [options.price] - Price text (highlighted)
   * @param {string} [options.barcodeType='128'] - 128, 39, QR, EAN13
   * @param {number} [options.widthMm=50] - Label width in mm
   * @param {number} [options.heightMm=30] - Label height in mm
   * @param {number} [options.dpi=203] - 203 or 300 DPI
   * @param {number} [options.qty=1] - Quantity of copies
   * @returns {string} ZPL command string
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
      dpi = 203,
      qty = 1
    } = options;

    const widthDots = this.mmToDots(widthMm, dpi);
    const heightDots = this.mmToDots(heightMm, dpi);

    let zpl = '^XA\n';
    zpl += `^PW${widthDots}\n`;
    zpl += `^LL${heightDots}\n`;
    zpl += '^LH0,0\n';

    let currentY = 15;

    // 1. Title
    if (title) {
      zpl += `^FO20,${currentY}^A0N,24,24^FB${widthDots - 40},1,0,C,0^FD${this.escapeZpl(title)}^FS\n`;
      currentY += 28;
    }

    // 2. Subtitle / SKU
    if (subtitle) {
      zpl += `^FO20,${currentY}^A0N,18,18^FB${widthDots - 40},1,0,C,0^FD${this.escapeZpl(subtitle)}^FS\n`;
      currentY += 22;
    }

    // 3. Barcode / QR
    if (barcodeType.toUpperCase() === 'QR') {
      const qrY = currentY;
      zpl += `^FO${Math.floor(widthDots / 2 - 50)},${qrY}^BQN,2,4^FDQA,${this.escapeZpl(barcode)}^FS\n`;
      currentY += 110;
    } else if (barcodeType === 'EAN13' || barcodeType === 'EAN') {
      zpl += `^FO30,${currentY}^BEN,60,Y,N^FD${this.escapeZpl(barcode)}^FS\n`;
      currentY += 75;
    } else if (barcodeType === '39') {
      zpl += `^FO30,${currentY}^B3N,N,60,Y,N^FD${this.escapeZpl(barcode)}^FS\n`;
      currentY += 75;
    } else {
      // Default Code 128
      zpl += `^FO30,${currentY}^BCN,60,Y,N,N^FD>:${this.escapeZpl(barcode)}^FS\n`;
      currentY += 75;
    }

    // 4. Price or Footer
    if (price) {
      currentY = Math.max(currentY, heightDots - 35);
      zpl += `^FO20,${currentY}^A0N,24,24^FB${widthDots - 40},1,0,C,0^FD${this.escapeZpl(price)}^FS\n`;
    }

    // 5. Quantity
    if (qty > 1) {
      zpl += `^PQ${qty}\n`;
    }

    zpl += '^XZ\n';
    return zpl;
  }

  /**
   * Escape ZPL special characters
   */
  static escapeZpl(str) {
    if (!str) return '';
    return String(str).replace(/\^/g, '').replace(/~/g, '');
  }
}

module.exports = ZplBuilder;
