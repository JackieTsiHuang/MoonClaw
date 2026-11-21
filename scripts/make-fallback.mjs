// Renders a static near-side view of the Moon (orthographic projection of the
// equirectangular color map) for browsers without WebGL.
// Usage: node scripts/make-fallback.mjs
import sharp from 'sharp';

const SRC = 'public/textures/moon_color_4k.jpg';
const OUT = 'public/textures/moon_fallback.jpg';
const SIZE = 900;

const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const out = Buffer.alloc(SIZE * SIZE * 3);

// Light from the upper-left, slightly in front (matches the 3D view).
const L = (() => { const v = [-0.55, 0.35, 0.76]; const n = Math.hypot(...v); return v.map((c) => c / n); })();

for (let py = 0; py < SIZE; py++) {
  for (let px = 0; px < SIZE; px++) {
    const x = (px + 0.5) / SIZE * 2 - 1;
    const y = 1 - (py + 0.5) / SIZE * 2;
    const r2 = x * x + y * y;
    const o = (py * SIZE + px) * 3;
    if (r2 > 1) { out[o] = 2; out[o + 1] = 3; out[o + 2] = 8; continue; }
    const z = Math.sqrt(1 - r2);
    const lat = Math.asin(y);
    const lon = Math.atan2(x, z);
    const u = (lon / (2 * Math.PI) + 0.5) * (W - 1);
    const v = (0.5 - lat / Math.PI) * (H - 1);
    const i = (Math.round(v) * W + Math.round(u)) * C;
    const lambert = Math.max(0, x * L[0] + y * L[1] + z * L[2]);
    const shade = 0.12 + 1.0 * lambert;
    // Soft anti-aliased limb
    const edge = Math.min(1, (1 - Math.sqrt(r2)) * SIZE * 0.5);
    for (let c = 0; c < 3; c++) {
      const val = Math.min(255, data[i + c] * shade * 1.08);
      const bg = [2, 3, 8][c];
      out[o + c] = Math.round(bg + (val - bg) * edge);
    }
  }
}

await sharp(out, { raw: { width: SIZE, height: SIZE, channels: 3 } }).jpeg({ quality: 82, mozjpeg: true }).toFile(OUT);
console.log('wrote', OUT);
