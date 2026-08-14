/*
 * Generate the extension icons.
 *
 * Chrome wants raster icons, and pulling in an image library for three tiny
 * squares isn't worth it — so this writes the PNGs by hand with node:zlib.
 * Run with `pnpm icons`.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
const SIZES = [16, 48, 128];

const BG = [79, 70, 229]; // indigo-600, matching the active-hint accent
const FG = [255, 255, 255];

/* ------------------------------------------------------------ PNG encoding */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // One filter byte (0 = None) in front of every scanline.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------------------------------------------------------------- geometry */

/** Signed distance from a point to a rounded rectangle, negative inside. */
function roundedRectDistance(px, py, halfW, halfH, radius) {
  const qx = Math.abs(px) - (halfW - radius);
  const qy = Math.abs(py) - (halfH - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius;
}

/** Distance from a point to a line segment. */
function segmentDistance(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  return Math.hypot(wx - t * vx, wy - t * vy);
}

/** Coverage in [0,1] for a signed distance, giving us cheap antialiasing. */
function coverage(distance, feather) {
  return Math.max(0, Math.min(1, 0.5 - distance / feather));
}

/**
 * A keycap with a slash on it: rounded indigo square, white "/" stroke.
 * Supersampled 4x4 per pixel so the diagonal doesn't look ragged at 16px.
 */
function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const samples = 4;
  const step = 1 / samples;

  const half = size / 2;
  const cardHalf = size * 0.46;
  const cardRadius = size * 0.22;
  const strokeHalfWidth = size * 0.062;

  const ax = size * 0.355;
  const ay = size * 0.735;
  const bx = size * 0.645;
  const by = size * 0.265;

  const feather = 1.1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgSum = 0;
      let fgSum = 0;

      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const px = x + (sx + 0.5) * step;
          const py = y + (sy + 0.5) * step;
          bgSum += coverage(roundedRectDistance(px - half, py - half, cardHalf, cardHalf, cardRadius), feather);
          fgSum += coverage(segmentDistance(px, py, ax, ay, bx, by) - strokeHalfWidth, feather);
        }
      }

      const total = samples * samples;
      const bgAlpha = bgSum / total;
      // The slash never bleeds outside the card.
      const fgAlpha = Math.min(fgSum / total, bgAlpha);

      const offset = (y * size + x) * 4;
      if (bgAlpha <= 0) continue;

      // Composite white over indigo, then apply the card's own alpha.
      for (let c = 0; c < 3; c++) {
        rgba[offset + c] = Math.round(BG[c] * (1 - fgAlpha) + FG[c] * fgAlpha);
      }
      rgba[offset + 3] = Math.round(bgAlpha * 255);
    }
  }

  return rgba;
}

/* -------------------------------------------------------------------- main */

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const png = encodePng(size, size, drawIcon(size));
  const file = join(OUT_DIR, `icon${size}.png`);
  writeFileSync(file, png);
  console.log(`wrote ${file} (${png.length} bytes)`);
}
