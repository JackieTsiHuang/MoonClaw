// Builds the Moon textures in public/textures/ from the NASA SVS CGI Moon Kit
// (https://svs.gsfc.nasa.gov/4720):
//   lroc_color_poles_8k.tif  (LROC WAC color mosaic, 8192x4096)
//   ldem_16.tif              (LOLA elevation, 16 px/deg, 5760x2880, float32 km)
//
// Usage:  node scripts/build-moon-textures.mjs <dir containing the two TIFFs>
//
// Both sources are simple-cylindrical with 0° longitude at the image centre,
// the same layout the app already uses for landmark placement.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFloatTiff } from './tiff-float.mjs';

const srcDir = process.argv[2];
if (!srcDir) {
  console.error('usage: node scripts/build-moon-textures.mjs <source dir>');
  process.exit(1);
}
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'textures');
sharp.cache(false);

const MOON_R_KM = 1737.4;

// ---------- Color ----------
const color = path.join(srcDir, 'lroc_color_poles_8k.tif');
const colorSrc = fs.existsSync(color) ? color : path.join(srcDir, 'lroc_8k.tif');
const base = () => sharp(colorSrc, { limitInputPixels: false });

await base().webp({ quality: 86, effort: 6 }).toFile(path.join(outDir, 'moon_color_8k.webp'));
await base()
  .resize(4096, 2048, { kernel: 'lanczos3' })
  .sharpen({ sigma: 0.6 })
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(path.join(outDir, 'moon_color_4k.jpg'));
await base()
  .resize(2048, 1024, { kernel: 'lanczos3' })
  .sharpen({ sigma: 0.6 })
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(path.join(outDir, 'moon_color_2k.jpg'));
console.log('color maps done');

// ---------- Normal maps from LOLA elevation ----------
const dem = readFloatTiff(path.join(srcDir, 'ldem_16.tif')); // {width,height,data(Float32, km)}
console.log('dem', dem.width, dem.height);

/** Bilinear resample of the DEM (wraps in longitude, clamps in latitude). */
function resampleDem(w, h) {
  const out = new Float32Array(w * h);
  const { width: W, height: H, data } = dem;
  for (let y = 0; y < h; y++) {
    const sy = Math.min(H - 1, Math.max(0, ((y + 0.5) * H) / h - 0.5));
    const y0 = Math.floor(sy), y1 = Math.min(H - 1, y0 + 1), fy = sy - y0;
    for (let x = 0; x < w; x++) {
      const sx = ((x + 0.5) * W) / w - 0.5;
      const x0f = Math.floor(sx), fx = sx - x0f;
      const x0 = (x0f + W) % W, x1 = (x0f + 1 + W) % W;
      const a = data[y0 * W + x0] * (1 - fx) + data[y0 * W + x1] * fx;
      const b = data[y1 * W + x0] * (1 - fx) + data[y1 * W + x1] * fx;
      out[y * w + x] = a * (1 - fy) + b * fy;
    }
  }
  return out;
}

/**
 * Tangent-space normal map (OpenGL convention: R = +east/+u, G = +north/+v).
 * Gradients use physical spacing, so craters keep their true shape at all
 * latitudes; `exaggeration` boosts relief so it reads at globe scale.
 */
async function buildNormal(w, h, file, exaggeration, quality) {
  const hgt = w === dem.width && h === dem.height ? dem.data : resampleDem(w, h);
  const rgb = Buffer.alloc(w * h * 3);
  const dLat = Math.PI / h; // radians per row
  const dLon = (2 * Math.PI) / w;
  for (let y = 0; y < h; y++) {
    const lat = Math.PI / 2 - (y + 0.5) * dLat;
    const dyKm = MOON_R_KM * dLat;
    // Avoid blow-up at the poles: cap the east-west shrink factor.
    const dxKm = MOON_R_KM * dLon * Math.max(Math.cos(lat), 0.02);
    const yn = Math.max(0, y - 1), ys = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const xe = (x + 1) % w, xw = (x - 1 + w) % w; // wraps across the ±180° seam
      const dhdx = (hgt[y * w + xe] - hgt[y * w + xw]) / (2 * dxKm);
      const dhdy = (hgt[yn * w + x] - hgt[ys * w + x]) / ((ys - yn) * dyKm); // +north
      let nx = -dhdx * exaggeration, ny = -dhdy * exaggeration, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * w + x) * 3;
      rgb[i] = Math.round((nx * 0.5 + 0.5) * 255);
      rgb[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      rgb[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    }
  }
  const img = sharp(rgb, { raw: { width: w, height: h, channels: 3 } });
  if (file.endsWith('.webp')) await img.webp({ quality, effort: 6 }).toFile(path.join(outDir, file));
  else await img.jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile(path.join(outDir, file));
  console.log('normal', file);
}

await buildNormal(dem.width, dem.height, 'moon_normal_6k.webp', 3, 90);
await buildNormal(2048, 1024, 'moon_normal_2k.jpg', 3, 92);

console.log('done');
