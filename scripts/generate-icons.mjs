import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

function crc32(buf) {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const header = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([header, data])));
  return Buffer.concat([len, header, data, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixel(x, y, size);
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function mix(a, b, t) {
  return a.map((value, i) => Math.round(value + (b[i] - value) * t));
}

function inOval(px, py, cx, cy, rx, ry) {
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  return dx * dx + dy * dy;
}

function drawIcon(x, y, size, { maskable }) {
  const bg = [18, 12, 9, 255];
  const nx = (x + 0.5) / size;
  const ny = (y + 0.5) / size;
  const pad = maskable ? 0.22 : 0.1;
  const left = pad;
  const right = 1 - pad;
  const top = pad;
  const bottom = 1 - pad;
  const radius = maskable ? 0 : 0.18;

  if (!maskable) {
    const qx = nx < left + radius ? left + radius : nx > right - radius ? right - radius : nx;
    const qy = ny < top + radius ? top + radius : ny > bottom - radius ? bottom - radius : ny;
    const outside =
      nx < left || nx > right || ny < top || ny > bottom || (nx - qx) ** 2 + (ny - qy) ** 2 > radius ** 2;
    if (outside) return [0, 0, 0, 0];
  }

  const cx = 0.5;
  const cy = 0.52;
  const outer = inOval(nx, ny, cx, cy, 0.22 * (1 - pad * 0.4), 0.32 * (1 - pad * 0.2));
  const mid = inOval(nx, ny, cx, cy + 0.02, 0.14, 0.22);
  const inner = inOval(nx, ny, cx, cy + 0.06, 0.07, 0.12);
  if (outer > 1) return bg;
  if (inner <= 1) return mix([226, 88, 34, 255], [232, 184, 109, 255], 1 - inner);
  if (mid <= 1) return mix([196, 69, 28, 255], [226, 88, 34, 255], 1 - mid);
  return mix(bg, [196, 69, 28, 255], 1 - (outer - 0.55) / 0.45);
}

for (const size of [192, 512]) {
  writeFileSync(path.join(outDir, `icon-${size}.png`), png(size, (x, y, s) => drawIcon(x, y, s, { maskable: false })));
  writeFileSync(
    path.join(outDir, `icon-${size}-maskable.png`),
    png(size, (x, y, s) => drawIcon(x, y, s, { maskable: true })),
  );
}

console.log("Wrote PNG icons to public/");
