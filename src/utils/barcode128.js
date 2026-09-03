/**
 * Standalone Code 128 Barcode Generator (Code 128 Auto/B)
 * Generates exact binary bar patterns, PostScript (for Epson/Inkjet), and SVG.
 */

const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106
];

class Barcode128 {
  static encode(text) {
    const chars = String(text);
    const startB = 104;
    const stop = 106;

    let checksum = startB;
    const values = [startB];

    for (let i = 0; i < chars.length; i++) {
      const code = chars.charCodeAt(i) - 32;
      const val = (code >= 0 && code <= 95) ? code : 0;
      values.push(val);
      checksum += val * (i + 1);
    }

    const checkDigit = checksum % 103;
    values.push(checkDigit);
    values.push(stop);

    let binary = "";
    for (const val of values) {
      const pattern = CODE128_PATTERNS[val];
      if (!pattern) continue;
      for (let j = 0; j < pattern.length; j++) {
        const width = parseInt(pattern[j], 10);
        const bit = (j % 2 === 0) ? "1" : "0";
        binary += bit.repeat(width);
      }
    }

    return binary;
  }

  static generateSvg(text, height = 40) {
    const binary = this.encode(text);
    let rects = '';
    let x = 0;
    const barWidth = 2;

    for (let i = 0; i < binary.length; i++) {
      if (binary[i] === '1') {
        rects += `<rect x="${x}" y="0" width="${barWidth}" height="${height}" fill="#000" />`;
      }
      x += barWidth;
    }

    return `<svg viewBox="0 0 ${x} ${height}" style="width: 100%; max-width: 240px; height: ${height}px;" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
  }

  static generatePostScriptLabel(data) {
    const {
      labNo = 'LAB20260903001',
      patientName = 'Bpk. Budi Santoso',
      patientRm = 'RM-048291',
      patientInfo = 'L / 38 th',
      tubeType = 'EDTA',
      testName = 'Darah Lengkap + Gol. Darah',
      dateTime = new Date().toLocaleString('id-ID')
    } = data;

    const binary = this.encode(labNo);
    const barWidth = 1.4;
    const totalWidth = binary.length * barWidth;
    const barHeight = 45;

    const originX = 72;
    const originY = 650;
    const cardWidth = 260;
    const cardHeight = 130;

    let ps = `%!PS-Adobe-3.0
%%Title: SehatLink LIS Specimen Label
%%Pages: 1
%%EndComments

/Helvetica findfont 12 scalefont setfont

newpath
${originX} ${originY} ${cardWidth} ${cardHeight} rectstroke

0.95 0.95 0.95 setgray
newpath
${originX + 1} ${originY + cardHeight - 24} ${cardWidth - 2} 23 rectfill
0 setgray

/Helvetica-Bold findfont 11 scalefont setfont
${originX + 10} ${originY + cardHeight - 16} moveto
(${this._escapePs(patientName)}) show

/Helvetica-Bold findfont 11 scalefont setfont
${originX + cardWidth - 55} ${originY + cardHeight - 16} moveto
([${this._escapePs(tubeType)}]) show

/Helvetica findfont 9 scalefont setfont
${originX + 10} ${originY + cardHeight - 36} moveto
(RM: ${this._escapePs(patientRm)}   |   ${this._escapePs(patientInfo)}) show

0 setgray
`;

    const barcodeStartX = originX + (cardWidth - totalWidth) / 2;
    const barcodeStartY = originY + 38;

    let currentX = barcodeStartX;
    for (let i = 0; i < binary.length; i++) {
      if (binary[i] === '1') {
        ps += `newpath ${currentX.toFixed(2)} ${barcodeStartY} ${barWidth.toFixed(2)} ${barHeight} rectfill\n`;
      }
      currentX += barWidth;
    }

    ps += `
/Helvetica-Bold findfont 9 scalefont setfont
${barcodeStartX + (totalWidth / 2) - (labNo.length * 2.8)} ${barcodeStartY - 10} moveto
(${this._escapePs(labNo)}) show

/Helvetica findfont 8 scalefont setfont
${originX + 10} ${originY + 10} moveto
(${this._escapePs(testName)}) show

${originX + cardWidth - 85} ${originY + 10} moveto
(${this._escapePs(dateTime)}) show

showpage
%%EOF
`;

    return ps;
  }

  static _escapePs(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }
}

module.exports = Barcode128;
