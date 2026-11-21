// Minimal reader for single-band, uncompressed, 32-bit float TIFFs (strips or tiles),
// which is the format of the NASA SVS LOLA elevation maps (ldem_*.tif).
import fs from 'node:fs';

export function readFloatTiff(file, { verbose = false } = {}) {
  const buf = fs.readFileSync(file);
  const le = buf.toString('latin1', 0, 2) === 'II';
  const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  if (u16(2) !== 42) throw new Error('Not a classic TIFF');
  const ifd = u32(4);
  const n = u16(ifd);
  const tags = {};
  const typeSize = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 11: 4, 12: 8, 16: 8 };
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
    const size = (typeSize[type] || 1) * count;
    const off = size <= 4 ? e + 8 : u32(e + 8);
    const vals = [];
    for (let k = 0; k < Math.min(count, 1 << 20); k++) {
      if (type === 3) vals.push(u16(off + k * 2));
      else if (type === 4) vals.push(u32(off + k * 4));
      else if (type === 1) vals.push(buf[off + k]);
    }
    tags[tag] = vals;
  }
  const width = tags[256][0], height = tags[257][0];
  const bps = tags[258]?.[0], compression = tags[259]?.[0] ?? 1;
  const spp = tags[277]?.[0] ?? 1, fmt = tags[339]?.[0] ?? 1, planar = tags[284]?.[0] ?? 1;
  if (verbose) console.log({ le, width, height, bps, compression, spp, fmt, planar, tiled: !!tags[322] });
  if (bps !== 32 || fmt !== 3 || spp !== 1 || compression !== 1)
    throw new Error(`Unsupported TIFF: bps=${bps} fmt=${fmt} spp=${spp} compression=${compression}`);

  const data = new Float32Array(width * height);
  const rd = (o) => (le ? buf.readFloatLE(o) : buf.readFloatBE(o));
  if (tags[322]) {
    const tw = tags[322][0], th = tags[323][0];
    const offs = tags[324], across = Math.ceil(width / tw);
    offs.forEach((o, t) => {
      const tx = (t % across) * tw, ty = Math.floor(t / across) * th;
      for (let y = 0; y < th && ty + y < height; y++)
        for (let x = 0; x < tw && tx + x < width; x++) data[(ty + y) * width + tx + x] = rd(o + (y * tw + x) * 4);
    });
  } else {
    const offs = tags[273], rps = tags[278]?.[0] ?? height;
    offs.forEach((o, s) => {
      const rows = Math.min(rps, height - s * rps);
      for (let i = 0; i < rows * width; i++) data[s * rps * width + i] = rd(o + i * 4);
    });
  }
  return { width, height, data };
}
