// Generates the user-location "navigation arrow puck" marker as PNG assets
// (@1x/@2x/@3x). Zero dependencies: rasterizes a signed-distance navigation
// arrow and encodes the PNG with Node's built-in zlib.
//
// Run: node scripts/generate-user-puck.mjs
//
// Design: a Google-Maps "driving arrow" — a blue (#2563EB) chevron with a
// concave/notched base, a white outline (rounded outer corners come for free
// from the SDF), a soft drop shadow, and a small white center accent dot. The
// arrow points up in image space; the app rotates it by the device heading.

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images');

// --- Colors -----------------------------------------------------------------
const BLUE = [0x25, 0x63, 0xeb]; // #2563EB
const WHITE = [0xff, 0xff, 0xff];

// --- Arrow geometry (normalized units, y down; up = negative y) -------------
// tip -> right wing -> notch -> left wing
const POLY = [
  [0.0, -1.0],
  [0.62, 0.7],
  [0.0, 0.35],
  [-0.62, 0.7],
];

// Signed distance to the polygon outline (negative inside).
function signedDistance(px, py) {
  let minDist = Infinity;
  let inside = false;
  for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    const [xi, yi] = POLY[i];
    const [xj, yj] = POLY[j];
    // distance to segment i-j
    const dx = xj - xi;
    const dy = yj - yi;
    const len2 = dx * dx + dy * dy || 1e-9;
    let t = ((px - xi) * dx + (py - yi) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = xi + t * dx;
    const cy = yi + t * dy;
    const d = Math.hypot(px - cx, py - cy);
    if (d < minDist) minDist = d;
    // point-in-polygon (ray cast)
    if (yi > py !== yj > py) {
      const xCross = ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (px < xCross) inside = !inside;
    }
  }
  return inside ? -minDist : minDist;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// Antialiased coverage for "distance <= edge", with ~half-pixel softness.
function cover(dist, edge, soft) {
  return clamp01((edge - dist) / soft);
}

function renderRGBA(scale) {
  const size = Math.round(36 * scale);
  const cx = size / 2;
  const cy = size / 2;
  const R = 13 * scale; // unit -> pixels
  const stroke = 2.0 * scale; // white border thickness
  const soft = 0.9; // edge softness in px (post-supersample this is fine)
  const shadowOffset = 1.6 * scale;
  const shadowBlur = 3.2 * scale;
  const shadowMax = 0.3;
  const dotR = 0.13; // center dot radius (normalized)

  const SS = 4; // supersampling per axis
  const data = Buffer.alloc(size * size * 4, 0);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rA = 0;
      let gA = 0;
      let bA = 0;
      let aA = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS;
          const fy = y + (sy + 0.5) / SS;
          // normalized coords (px in pixels relative to center)
          const nx = (fx - cx) / R;
          const ny = (fy - cy) / R;
          const d = signedDistance(nx, ny) * R; // distance in px

          // Premultiplied "over" compositing, back to front.
          let pr = 0;
          let pg = 0;
          let pb = 0;
          let pa = 0;

          const over = (col, alpha) => {
            if (alpha <= 0) return;
            const inv = 1 - alpha;
            pr = col[0] * alpha + pr * inv;
            pg = col[1] * alpha + pg * inv;
            pb = col[2] * alpha + pb * inv;
            pa = alpha + pa * inv;
          };

          // 1. soft drop shadow (silhouette shifted up so it falls below puck)
          const dsRaw = signedDistance(nx, ny - shadowOffset / R) * R;
          over([0, 0, 0], clamp01((stroke + shadowBlur - dsRaw) / shadowBlur) * shadowMax);
          // 2. white border (silhouette out to +stroke)
          over(WHITE, cover(d, stroke, soft));
          // 3. blue fill (inside polygon)
          over(BLUE, cover(d, 0, soft));
          // 4. white center accent dot
          over(WHITE, cover((Math.hypot(nx, ny) - dotR) * R, 0, soft));

          rA += pr;
          gA += pg;
          bA += pb;
          aA += pa;
        }
      }
      const n = SS * SS;
      const a = aA / n; // average coverage (0..1)
      const idx = (y * size + x) * 4;
      // un-premultiply: stored RGBA is straight alpha
      const unp = a > 0 ? 1 / a : 0;
      data[idx] = Math.round((rA / n) * unp);
      data[idx + 1] = Math.round((gA / n) * unp);
      data[idx + 2] = Math.round((bA / n) * unp);
      data[idx + 3] = Math.round(a * 255);
    }
  }
  return { size, data };
}

// --- PNG encoding -----------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, body])), 0);
  return Buffer.concat([len, typeBuf, body, crc]);
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // raw scanlines with filter byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Main -------------------------------------------------------------------
for (const [scale, suffix] of [
  [1, ''],
  [2, '@2x'],
  [3, '@3x'],
]) {
  const { size, data } = renderRGBA(scale);
  const png = encodePNG(size, data);
  const file = join(OUT_DIR, `user-puck${suffix}.png`);
  writeFileSync(file, png);
  console.log(`wrote ${file} (${size}x${size}, ${png.length} bytes)`);
}
