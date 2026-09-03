/**
 * ESC/POS Command Builder for Thermal Receipt / Mini Label Printers
 */

class EscposBuilder {
  /**
   * Build an ESC/POS binary buffer for a barcode label
   */
  static buildBarcodeLabel(options) {
    const {
      barcode,
      title = '',
      subtitle = '',
      price = '',
      barcodeType = '128',
      qty = 1
    } = options;

    const buffers = [];

    // Helper to push text or commands
    const addBytes = (...bytes) => buffers.push(Buffer.from(bytes));
    const addText = (text) => buffers.push(Buffer.from(text + '\n', 'ascii'));

    for (let q = 0; q < qty; q++) {
      // 1. Initialize printer (ESC @)
      addBytes(0x1B, 0x40);

      // 2. Center align (ESC a 1)
      addBytes(0x1B, 0x61, 0x01);

      // 3. Title (Double height/width or bold)
      if (title) {
        addBytes(0x1B, 0x45, 0x01); // Bold ON
        addText(title);
        addBytes(0x1B, 0x45, 0x00); // Bold OFF
      }

      // 4. Subtitle
      if (subtitle) {
        addText(subtitle);
      }

      // 5. Barcode (GS k)
      if (barcodeType.toUpperCase() === 'QR') {
        // QR Code in ESC/POS standard (Model 2)
        const qrData = Buffer.from(barcode, 'utf-8');
        const len = qrData.length + 3;
        const pL = len % 256;
        const pH = Math.floor(len / 256);

        // Function 165: Select model
        addBytes(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
        // Function 167: Set module size (size = 6)
        addBytes(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06);
        // Function 169: Error correction level L
        addBytes(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30);
        // Function 180: Store data
        addBytes(0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30);
        buffers.push(qrData);
        // Function 181: Print QR code
        addBytes(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);
      } else {
        // GS h (Set barcode height = 60 dots)
        addBytes(0x1D, 0x68, 0x3C);
        // GS w (Set barcode width = 2)
        addBytes(0x1D, 0x77, 0x02);
        // GS H (Set HRI characters below barcode: 2)
        addBytes(0x1D, 0x48, 0x02);

        // GS k: Code 128 (Format B, type 73)
        const bcData = Buffer.from(barcode, 'ascii');
        addBytes(0x1D, 0x6B, 0x49, bcData.length);
        buffers.push(bcData);
      }

      // 6. Price
      if (price) {
        addBytes(0x0A); // linefeed
        addBytes(0x1B, 0x45, 0x01); // Bold ON
        addText(price);
        addBytes(0x1B, 0x45, 0x00);
      }

      // Feed & partial cut (GS V 66 0)
      addBytes(0x0A, 0x0A, 0x0A);
      addBytes(0x1D, 0x56, 0x42, 0x00);
    }

    return Buffer.concat(buffers);
  }
}

module.exports = EscposBuilder;
