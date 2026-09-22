/**
 * Rasterize the Atman play-triangle (from public/favicon.svg) into PWA PNGs.
 * Geometry is the favicon path `M10 7.25v17.5L24.75 16z` on a 32×32 board,
 * painted on the site dark `#09080e` with cream `#f4efe4`.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BG = [0x09, 0x08, 0x0e, 0xff];
const FG = [0xf4, 0xef, 0xe4, 0xff];

/** Favicon triangle on the 32×32 board. */
const TRI = [
  [10, 7.25],
  [10, 24.75],
  [24.75, 16],
];

function crcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
}

const CRC = crcTable();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const payload = Buffer.concat([typeBuf, data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  payload.copy(out, 4);
  out.writeUInt32BE(crc32(payload), 8 + data.length);
  return out;
}

function encodePng(width, height, rgba) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function fillRgba(width, height, [r, g, b, a]) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = a;
  }
  return data;
}

function fillTriangle(data, width, height, ax, ay, bx, by, cx, cy, [r, g, b, a]) {
  const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
  if (area === 0) return;
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / area;
      const w1 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 >= -1e-6 && w1 >= -1e-6 && w2 >= -1e-6) {
        const i = (y * width + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = a;
      }
    }
  }
}

function paintMark(size, inset = 0) {
  const data = fillRgba(size, size, BG);
  const board = size * (1 - inset);
  const origin = (size - board) / 2;
  const scale = board / 32;
  const pts = TRI.map(([x, y]) => [origin + x * scale, origin + y * scale]);
  fillTriangle(data, size, size, ...pts.flat(), FG);
  return encodePng(size, size, data);
}

const iconsDir = join(ROOT, "public/icons");
mkdirSync(iconsDir, { recursive: true });

const files = [
  [join(iconsDir, "icon-192.png"), paintMark(192)],
  [join(iconsDir, "icon-512.png"), paintMark(512)],
  [join(iconsDir, "icon-maskable-192.png"), paintMark(192, 0.22)],
  [join(iconsDir, "icon-maskable-512.png"), paintMark(512, 0.22)],
  [join(iconsDir, "apple-touch-icon.png"), paintMark(180)],
  [join(ROOT, "public/__grok/icon-180.png"), paintMark(180)],
];

for (const [path, buf] of files) {
  writeFileSync(path, buf);
  console.log(`wrote ${path} (${buf.length} bytes)`);
}
