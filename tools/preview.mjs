// Renders the committed map data (public/data/provinces.png + provinces.json) to PNG images,
// so province shapes can be inspected without starting the game.
// Run with: node tools/preview.mjs
//
// Outputs: tools/out/look-world.png, look-europe.png, look-asia.png, look-africa.png
// Province borders are drawn dark, country borders black, sea provinces dark blue.

import fs from 'node:fs';
import path from 'node:path';
import pngjs from 'pngjs';

const { PNG } = pngjs;

const meta = JSON.parse(fs.readFileSync('public/data/provinces.json', 'utf8'));
const { width: W, height: H, countries, provinces } = meta;
const idPng = PNG.sync.read(fs.readFileSync('public/data/provinces.png'));

const ids = new Uint16Array(W * H);
for (let i = 0; i < ids.length; i++) ids[i] = idPng.data[i * 4] | (idPng.data[i * 4 + 1] << 8);

const ownerOf = new Uint16Array(provinces.length + 1);
const stateOf = new Uint16Array(provinces.length + 1);
for (const p of provinces) {
  ownerOf[p.id] = p.owner;
  stateOf[p.id] = p.state;
}
const stateOwner = new Map();
for (const p of provinces) stateOwner.set(p.state, p.owner);

fs.mkdirSync('tools/out', { recursive: true });

const LAT_TOP = 84;
const LAT_BOTTOM = -58;

function render(file, x0, y0, w, h, step, scale = 1) {
  const pw = Math.floor(w / step);
  const ph = Math.floor(h / step);
  const png = new PNG({ width: pw * scale, height: ph * scale });
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const sx = Math.min(W - 1, x0 + x * step);
      const sy = Math.min(H - 1, y0 + y * step);
      const id = ids[sy * W + sx];
      const o = (y * pw + x) * 4;
      if (id === 0) {
        png.data[o] = 22;
        png.data[o + 1] = 48;
        png.data[o + 2] = 78;
        png.data[o + 3] = 255;
        continue;
      }
      const owner = ownerOf[id];
      const sea = owner === 0;
      const right = sx + 1 < W ? ids[sy * W + sx + 1] : id;
      const down = sy + 1 < H ? ids[(sy + 1) * W + sx] : id;
      const provinceBorder = right !== id || down !== id;
      const countryBorder =
        provinceBorder &&
        ((right !== id && ownerOf[right] !== owner) || (down !== id && ownerOf[down] !== owner));
      const stateBorder =
        provinceBorder &&
        ((right !== id && stateOf[right] !== stateOf[id]) || (down !== id && stateOf[down] !== stateOf[id]));
      let [r, g, b] = countries[owner].color;
      if (sea) {
        const region = stateOf[id];
        const tint = (region * 37) % 40;
        r = 30 + tint;
        g = 62 + tint;
        b = 100 + tint;
      }
      if (provinceBorder) {
        const k = countryBorder ? 0.2 : stateBorder ? 0.55 : 0.8;
        r *= k;
        g *= k;
        b *= k;
      }
      png.data[o] = r;
      png.data[o + 1] = g;
      png.data[o + 2] = b;
      png.data[o + 3] = 255;
    }
  }
  if (scale > 1) {
    const big = new PNG({ width: pw * scale, height: ph * scale });
    for (let y = 0; y < ph * scale; y++) {
      for (let x = 0; x < pw * scale; x++) {
        const src = (Math.floor(y / scale) * pw + Math.floor(x / scale)) * 4;
        const dst = (y * pw * scale + x) * 4;
        big.data[dst] = png.data[src];
        big.data[dst + 1] = png.data[src + 1];
        big.data[dst + 2] = png.data[src + 2];
        big.data[dst + 3] = 255;
      }
    }
    fs.writeFileSync(path.join('tools/out', file), PNG.sync.write(big));
    console.log(`wrote tools/out/${file} (${pw * scale}x${ph * scale})`);
    return;
  }
  fs.writeFileSync(path.join('tools/out', file), PNG.sync.write(png));
  console.log(`wrote tools/out/${file} (${pw}x${ph})`);
}

const px = (lon) => Math.round(((lon + 180) / 360) * W);
const py = (lat) => Math.round(((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * H);

render('look-world.png', 0, 0, W, H, 4);
render('look-europe.png', px(-12), py(72), px(62) - px(-12), py(25) - py(72), 2);
render('look-asia.png', px(60), py(55), px(150) - px(60), py(-12) - py(55), 2);
render('look-africa.png', px(-20), py(40), px(55) - px(-20), py(-36) - py(40), 2);

// 1:1 crops of the regions whose province shapes were called out as wrong.
render('detail-finland.png', px(16), py(71), px(34) - px(16), py(55) - py(71), 1);
render('detail-poland.png', px(11), py(56), px(26) - px(11), py(47) - py(56), 1);
render('detail-china.png', px(98), py(43), px(126) - px(98), py(19) - py(43), 1);
render('detail-turkey.png', px(24), py(43), px(48) - px(24), py(29) - py(43), 1);
// Petsamo (the Finnish corridor between Norway and the USSR) needs a close look.
render('detail-petsamo.png', px(24), py(71.6), px(36) - px(24), py(67.6) - py(71.6), 1, 3);
render('detail-petsamo-wide.png', px(20), py(72), px(40) - px(20), py(67) - py(72), 1, 2);

// Province count and size per country, to spot countries cut too finely or too coarsely.
const KM2_PER_EQUATOR_PIXEL = (40075 / W) ** 2;
const rowKm2 = new Float64Array(H);
for (let y = 0; y < H; y++) {
  const lat = LAT_TOP - ((y + 0.5) / H) * (LAT_TOP - LAT_BOTTOM);
  rowKm2[y] = Math.cos((lat * Math.PI) / 180) * KM2_PER_EQUATOR_PIXEL;
}
const areaOf = new Float64Array(provinces.length + 1);
for (let i = 0; i < ids.length; i++) areaOf[ids[i]] += rowKm2[Math.floor(i / W)];

const perOwner = new Map();
for (const p of provinces) {
  if (p.owner === 0) continue;
  const e = perOwner.get(p.owner) ?? { sizes: [] };
  e.sizes.push(areaOf[p.id]);
  perOwner.set(p.owner, e);
}
const median = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log('\nProvinces per country (land only):');
[...perOwner.entries()]
  .sort((a, b) => b[1].sizes.length - a[1].sizes.length)
  .forEach(([owner, e]) =>
    console.log(
      `  ${countries[owner].name}: ${e.sizes.length} provinces, median ${Math.round(median(e.sizes))} km2, total ${Math.round(e.sizes.reduce((s, v) => s + v, 0))} km2`,
    ),
  );

// Neighbouring countries must be clearly different in color (Turkey and France once looked the same).
function toLab([r, g, b]) {
  const lin = (v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const lab = countries.map((c) => toLab(c.color));
const byId = new Map(provinces.map((p) => [p.id, p]));
const borders = new Map();
for (const p of provinces) {
  if (p.owner === 0) continue;
  for (const n of p.neighbors) {
    const q = byId.get(n);
    if (!q || q.owner === 0 || q.owner === p.owner) continue;
    const key = p.owner < q.owner ? `${p.owner}:${q.owner}` : `${q.owner}:${p.owner}`;
    borders.set(key, (borders.get(key) ?? 0) + 1);
  }
}
const weak = [...borders]
  .map(([key, px]) => {
    const [a, b] = key.split(':').map(Number);
    return { a, b, px, d: Math.hypot(...[0, 1, 2].map((i) => lab[a][i] - lab[b][i])) };
  })
  .filter((r) => r.d < 25)
  .sort((x, y) => x.d - y.d);
console.log(`\nNeighbouring countries with a weak color difference (Lab < 25): ${weak.length}`);
for (const r of weak) console.log(`  ${countries[r.a].name} / ${countries[r.b].name}: ${r.d.toFixed(1)} (${r.px} border px)`);
