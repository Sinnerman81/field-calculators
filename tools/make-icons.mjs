/**
 * Generates FieldKit's icons with no dependencies: a supersampled amber tile
 * with a dark lightning bolt, written as PNG via zlib.
 *
 * Run: node tools/make-icons.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'icons');
const SS = 4; // supersampling factor

const BOLT = [
  [27.4, 7],
  [13.5, 27],
  [21.7, 27],
  [20.1, 41],
  [34.5, 21],
  [26.4, 21],
];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function insideRoundedRect(x, y, size, radius) {
  if (x < 0 || y < 0 || x >= size || y >= size) return false;
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function insidePolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function boltPoints(size, scale) {
  const center = 24;
  const unit = size / 48;
  return BOLT.map(([x, y]) => [
    (center + (x - center) * scale) * unit,
    (center + (y - center) * scale) * unit,
  ]);
}

function renderIcon(size, { maskable = false } = {}) {
  const dimension = size * SS;
  const radius = maskable ? 0 : dimension * 0.22;
  const bolt = boltPoints(dimension, maskable ? 0.68 : 0.8);
  const pixels = Buffer.alloc(dimension * dimension * 4);

  for (let y = 0; y < dimension; y += 1) {
    // Vertical amber gradient with a subtle warm highlight.
    const t = y / dimension;
    const r = Math.round(255 - 15 * t);
    const g = Math.round(202 - 38 * t);
    const b = Math.round(74 - 30 * t);

    for (let x = 0; x < dimension; x += 1) {
      const offset = (y * dimension + x) * 4;

      if (maskable || insideRoundedRect(x + 0.5, y + 0.5, dimension, radius)) {
        pixels[offset] = r;
        pixels[offset + 1] = g;
        pixels[offset + 2] = b;
        pixels[offset + 3] = 255;
      }

      if (insidePolygon(x + 0.5, y + 0.5, bolt)) {
        pixels[offset] = 10;
        pixels[offset + 1] = 16;
        pixels[offset + 2] = 22;
        pixels[offset + 3] = 255;
      }
    }
  }

  // Box-filter down to the target size for smooth edges.
  const output = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const offset = ((y * SS + sy) * dimension + (x * SS + sx)) * 4;
          r += pixels[offset];
          g += pixels[offset + 1];
          b += pixels[offset + 2];
          a += pixels[offset + 3];
        }
      }
      const samples = SS * SS;
      const out = (y * size + x) * 4;
      output[out] = Math.round(r / samples);
      output[out + 1] = Math.round(g / samples);
      output[out + 2] = Math.round(b / samples);
      output[out + 3] = Math.round(a / samples);
    }
  }

  return encodePng(size, size, output);
}

const SVG_BOLT = [
  [286.51, 103.68],
  [161.87, 282.88],
  [235.44, 282.88],
  [221.15, 408.32],
  [350.08, 229.12],
  [277.55, 229.12],
]
  .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
  .join(' ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="FieldKit">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffd166"/>
      <stop offset="1" stop-color="#f0a000"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <path d="${SVG_BOLT} Z" fill="#0a1016"/>
</svg>
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'icon-192.png'), renderIcon(192));
writeFileSync(join(OUT_DIR, 'icon-512.png'), renderIcon(512));
writeFileSync(join(OUT_DIR, 'icon-maskable-512.png'), renderIcon(512, { maskable: true }));
writeFileSync(join(OUT_DIR, 'icon.svg'), svg);
console.log('Wrote icons to', OUT_DIR);
