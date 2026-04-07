// generate-icons.js — Creates simple red square PNG icons with a white "S"
// Uses ONLY built-in Node.js modules (no npm packages).
// Generates minimal valid PNGs by writing raw pixel data.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const outDir = path.join(__dirname, "icons");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// ── Minimal PNG encoder ────────────────────────────────────────────────

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makePNG(width, height, pixels) {
  // pixels is a Buffer of RGBA data (width * height * 4 bytes)
  // Add filter byte (0 = None) before each row
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    rawRows.push(Buffer.from([0])); // filter byte
    rawRows.push(pixels.slice(y * width * 4, (y + 1) * width * 4));
  }
  const rawData = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(rawData);

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([typeBytes, data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, c]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Draw a letter "S" as a bitmap onto RGBA pixel buffer ───────────────

// Hard-coded 8x8 "S" glyph pattern (1 = white pixel, 0 = transparent)
const S_GLYPH = [
  "01111110",
  "11000011",
  "11000000",
  "01111110",
  "00000011",
  "00000011",
  "11000011",
  "01111110",
];

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);

  // Fill red background
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4 + 0] = 0xff; // R
    pixels[i * 4 + 1] = 0x00; // G
    pixels[i * 4 + 2] = 0x00; // B
    pixels[i * 4 + 3] = 0xff; // A
  }

  // Scale and center the 8x8 glyph onto the icon
  const glyphSize = 8;
  const scale = Math.max(1, Math.floor(size * 0.55 / glyphSize));
  const letterW = glyphSize * scale;
  const letterH = glyphSize * scale;
  const offsetX = Math.floor((size - letterW) / 2);
  const offsetY = Math.floor((size - letterH) / 2);

  for (let gy = 0; gy < glyphSize; gy++) {
    for (let gx = 0; gx < glyphSize; gx++) {
      if (S_GLYPH[gy][gx] === "1") {
        // Fill a scale x scale block
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = offsetX + gx * scale + dx;
            const py = offsetY + gy * scale + dy;
            if (px >= 0 && px < size && py >= 0 && py < size) {
              const idx = (py * size + px) * 4;
              pixels[idx + 0] = 0xff; // R
              pixels[idx + 1] = 0xff; // G
              pixels[idx + 2] = 0xff; // B
              pixels[idx + 3] = 0xff; // A
            }
          }
        }
      }
    }
  }

  return pixels;
}

// ── Generate icons ─────────────────────────────────────────────────────

const sizes = [16, 48, 128];

for (const size of sizes) {
  const pixels = drawIcon(size);
  const png = makePNG(size, size, pixels);
  const outPath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Created ${outPath} (${png.length} bytes)`);
}

console.log("Done — all icons generated.");
