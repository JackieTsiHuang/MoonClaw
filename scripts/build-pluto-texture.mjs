// Prepares public/textures/planets/pluto.webp from NASA's New Horizons global color map
// ("Pluto color mapmosaic", NASA/JHUAPL/SwRI, public domain).
// New Horizons only imaged part of Pluto in detail; the unimaged area is black in the
// source. Here it's filled with a neutral tone (mean color of the imaged surface plus soft
// noise) so it doesn't render as a black hole. Usage:
//   node scripts/build-pluto-texture.mjs <path to Pluto_color_mapmosaic.jpg>
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'textures', 'planets', 'pluto.webp');
const W = 1280, H = 640;

const { data } = await sharp(src).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const n = W * H;
const mask = Buffer.alloc(n);
let r = 0, g = 0, b = 0, valid = 0;
for (let i = 0; i < n; i++) {
  const s = data[i * 3] + data[i * 3 + 1] + data[i * 3 + 2];
  if (s < 30) mask[i] = 255;
  else { r += data[i * 3]; g += data[i * 3 + 1]; b += data[i * 3 + 2]; valid++; }
}
r /= valid; g /= valid; b /= valid;

// Grow the mask slightly (to swallow dark JPEG fringes), then feather it.
const grown = await sharp(mask, { raw: { width: W, height: H, channels: 1 } }).blur(3).threshold(20).extractChannel(0).raw().toBuffer();
const soft = await sharp(grown, { raw: { width: W, height: H, channels: 1 } }).blur(6).extractChannel(0).raw().toBuffer();

// Soft value noise for the fill
const noise = await sharp(Buffer.from(Array.from({ length: (W / 16) * (H / 16) }, () => Math.floor(Math.random() * 255))), {
  raw: { width: W / 16, height: H / 16, channels: 1 },
}).resize(W, H, { kernel: 'cubic' }).blur(10).extractChannel(0).raw().toBuffer();

const outBuf = Buffer.alloc(n * 3);
for (let i = 0; i < n; i++) {
  const a = soft[i] / 255;
  const k = 0.9 + (noise[i] / 255) * 0.2;
  outBuf[i * 3] = Math.round(data[i * 3] * (1 - a) + r * k * a);
  outBuf[i * 3 + 1] = Math.round(data[i * 3 + 1] * (1 - a) + g * k * a);
  outBuf[i * 3 + 2] = Math.round(data[i * 3 + 2] * (1 - a) + b * k * a);
}
await sharp(outBuf, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 84 }).toFile(out);
console.log('wrote', out, 'mean fill', [r, g, b].map(Math.round), 'unimaged fraction', (1 - valid / n).toFixed(3));
