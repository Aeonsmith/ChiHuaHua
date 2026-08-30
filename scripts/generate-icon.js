const fs = require('node:fs');
const path = require('node:path');

const assetsDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assetsDir, { recursive: true });

// Create a simple 32x32 BMP-based ICO file
const width = 32;
const height = 32;
const bpp = 32;
const headerSize = 40;
const rowSize = width * 4;
const pixelDataSize = rowSize * height;
const maskSize = (width / 8) * height;
const bmpSize = headerSize + pixelDataSize + maskSize;
const icoHeaderSize = 6;
const dirEntrySize = 16;
const totalSize = icoHeaderSize + dirEntrySize + bmpSize;

const buf = Buffer.alloc(totalSize);

// ICO Header
buf.writeUInt16LE(0, 0); // Reserved
buf.writeUInt16LE(1, 2); // Type 1 = ICO
buf.writeUInt16LE(1, 4); // 1 Image

// Directory Entry
buf.writeUInt8(width, 6);        // Width
buf.writeUInt8(height, 7);       // Height
buf.writeUInt8(0, 8);            // Colors
buf.writeUInt8(0, 9);            // Reserved
buf.writeUInt16LE(1, 10);        // Color planes
buf.writeUInt16LE(bpp, 12);      // Bits per pixel
buf.writeUInt32LE(bmpSize, 14);  // Image data size
buf.writeUInt32LE(22, 18);       // Offset (6 + 16)

// BITMAPINFOHEADER
let offset = 22;
buf.writeUInt32LE(headerSize, offset); offset += 4;
buf.writeInt32LE(width, offset); offset += 4;
buf.writeInt32LE(height * 2, offset); offset += 4; // Height doubled for mask
buf.writeUInt16LE(1, offset); offset += 2;          // Planes
buf.writeUInt16LE(bpp, offset); offset += 2;        // BPP
buf.writeUInt32LE(0, offset); offset += 4;          // Compression (BI_RGB)
buf.writeUInt32LE(pixelDataSize + maskSize, offset); offset += 4;
buf.writeInt32LE(0, offset); offset += 4;          // XPelsPerMeter
buf.writeInt32LE(0, offset); offset += 4;          // YPelsPerMeter
buf.writeUInt32LE(0, offset); offset += 4;          // ClrUsed
buf.writeUInt32LE(0, offset); offset += 4;          // ClrImportant

// Pixel Data (32x32 RGBA) - Neon Green Phosphor VHS Tape icon
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const isBorder = x === 2 || x === 29 || y === 4 || y === 27;
    const isCassetteWindow = y >= 10 && y <= 20 && x >= 8 && x <= 23;
    const isSpool = isCassetteWindow && ((x >= 10 && x <= 13) || (x >= 18 && x <= 21)) && (y >= 13 && y <= 17);

    let r = 10, g = 18, b = 10, a = 255;

    if (isBorder || isSpool) {
      r = 51; g = 255; b = 102; a = 255; // Neon green
    } else if (isCassetteWindow) {
      r = 255; g = 184; b = 51; a = 255; // Amber
    }

    buf.writeUInt8(b, offset);
    buf.writeUInt8(g, offset + 1);
    buf.writeUInt8(r, offset + 2);
    buf.writeUInt8(a, offset + 3);
    offset += 4;
  }
}

// AND Mask (0 for opaque)
for (let i = 0; i < maskSize; i++) {
  buf.writeUInt8(0, offset++);
}

const icoPath = path.join(assetsDir, 'icon.ico');
fs.writeFileSync(icoPath, buf);
console.log(`Generated icon at ${icoPath}`);
