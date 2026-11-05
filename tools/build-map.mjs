// Offline map builder. Run with: npm run build:map
//
// Province shapes come from Natural Earth admin-1 regions (downloaded once into tools/cache).
// Who owns what in 1936 comes from tools/data/history-1936.mjs (curated tables and polygons).
//
// Pipeline: rasterize regions -> paint an owner raster from the tables -> repaint with hand-drawn
// polygons -> a province is every (region, owner) pair -> merge tiny slivers -> write outputs.
//
// Outputs (committed to the repo, loaded by the game at runtime):
//   public/data/provinces.png   pixel color encodes province id (R = low byte, G = high byte, 0 = sea)
//   public/data/provinces.json  countries, provinces, neighbors
//   tools/out/preview.png       small debug image colored by owner

import fs from 'node:fs';
import path from 'node:path';
import pngjs from 'pngjs';
import { ADMIN0_TO_OWNER, ADMIN1_OVERRIDES, OWNER_INFO, POLYGON_OVERRIDES, PROTECTED_REGIONS } from './data/history-1936.mjs';

const PROTECTED = new Set(PROTECTED_REGIONS);

const { PNG } = pngjs;

const REGIONS_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';

// Equirectangular projection, cropped to the inhabited latitudes.
const W = 5632;
const LAT_TOP = 84;
const LAT_BOTTOM = -58;
const H = Math.round((W * (LAT_TOP - LAT_BOTTOM)) / 360);
// Province size balancing: the target province area depends on the size of the modern country,
// so small countries get few provinces and huge ones get many (similar to Hearts of Iron IV).
const KM2_PER_EQUATOR_PIXEL = (40075 / W) ** 2;
const targetKm2 = (countryKm2) => Math.min(80000, 8000 + 14 * Math.sqrt(countryKm2));
const STATE_FACTOR = 2.0; // a state is about this many "base targets" big (states group several provinces)
const PROVINCE_FACTOR = 0.42; // a province is about this many "base targets" big
const MERGE_BELOW = 0.5; // states smaller than this fraction of their target are merged into a neighbor
const SPLIT_ABOVE = 1.9; // states larger than this multiple of their target are split
const PROVINCE_SPLIT_ABOVE = 1.35; // a state bigger than this multiple of the province target gets several provinces

const CACHE = 'tools/cache';
const OUT = 'tools/out';
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync('public/data', { recursive: true });

async function loadRegions() {
  const file = path.join(CACHE, 'admin1.geojson');
  if (!fs.existsSync(file)) {
    console.log('Downloading Natural Earth admin-1 regions...');
    const res = await fetch(REGIONS_URL);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const MARINE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_geography_marine_polys.geojson';

async function loadMarine() {
  const file = path.join(CACHE, 'marine.geojson');
  if (!fs.existsSync(file)) {
    console.log('Downloading Natural Earth marine regions...');
    const res = await fetch(MARINE_URL);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ---------- geometry helpers (a polygon is [outerRing, ...holes], a ring is [[lon, lat], ...]) ----------

function polygonsOf(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function ringArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % n];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

function ringCentroidY(ring) {
  let a = 0;
  let cy = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % n];
    const cross = x0 * y1 - x1 * y0;
    a += cross;
    cy += (y0 + y1) * cross;
  }
  return a === 0 ? ring[0][1] : cy / (3 * a);
}

// A point that is (almost always) inside the feature: the middle of the widest span of the
// largest polygon along its centroid latitude.
function representativePoint(geometry) {
  const polys = polygonsOf(geometry);
  let best = polys[0];
  let bestArea = -1;
  for (const p of polys) {
    const area = Math.abs(ringArea(p[0]));
    if (area > bestArea) {
      bestArea = area;
      best = p;
    }
  }
  const y = ringCentroidY(best[0]);
  const xs = [];
  for (const ring of best) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
    }
  }
  xs.sort((a, b) => a - b);
  let bestSpan = -1;
  let mid = best[0][0][0];
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (xs[i + 1] - xs[i] > bestSpan) {
      bestSpan = xs[i + 1] - xs[i];
      mid = (xs[i] + xs[i + 1]) / 2;
    }
  }
  return bestSpan < 0 ? [best[0][0][0], best[0][0][1]] : [mid, y];
}

// ---------- rasterization ----------

const project = ([lon, lat]) => [((lon + 180) / 360) * W, ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * H];

// Even-odd scanline fill of lon/lat polygons into target[], returns the touched row range.
function fillPolygons(target, value, polygons) {
  const edges = [];
  let minRow = Infinity;
  let maxRow = -Infinity;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      const pts = ring.map(project);
      for (let i = 0, n = pts.length; i < n; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % n];
        if (y0 === y1) continue;
        const [ax, ay, bx, by] = y0 < y1 ? [x0, y0, x1, y1] : [x1, y1, x0, y0];
        const r0 = Math.max(0, Math.ceil(ay - 0.5));
        const r1 = Math.min(H - 1, Math.ceil(by - 0.5) - 1);
        if (r1 < r0) continue;
        edges.push({ ax, ay, slope: (bx - ax) / (by - ay), r0, r1 });
        if (r0 < minRow) minRow = r0;
        if (r1 > maxRow) maxRow = r1;
      }
    }
  }
  if (edges.length === 0) return null;
  const rows = Array.from({ length: maxRow - minRow + 1 }, () => []);
  for (const e of edges) for (let r = e.r0; r <= e.r1; r++) rows[r - minRow].push(e);
  for (let r = minRow; r <= maxRow; r++) {
    const yc = r + 0.5;
    const xs = rows[r - minRow].map((e) => e.ax + (yc - e.ay) * e.slope).sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const from = Math.max(0, Math.ceil(xs[i] - 0.5));
      const to = Math.min(W - 1, Math.ceil(xs[i + 1] - 0.5) - 1);
      for (let x = from; x <= to; x++) target[r * W + x] = value;
    }
  }
  return { minRow, maxRow };
}

function lighten([r, g, b], t) {
  return [Math.round(r + (255 - r) * t), Math.round(g + (255 - g) * t), Math.round(b + (255 - b) * t)];
}

function autoColor(index) {
  const hue = (index * 137.508) % 360;
  const sat = 0.5 + (index % 3) * 0.12;
  const light = 0.42 + ((index * 7) % 4) * 0.07;
  const a = sat * Math.min(light, 1 - light);
  const f = (n) => {
    const k = (n + hue / 30) % 12;
    return light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

// ---------- owners ----------

const ownerNames = ['Sea'];
const ownerIndex = new Map([['Sea', 0]]);
function ownerId(name) {
  if (!ownerIndex.has(name)) {
    ownerIndex.set(name, ownerNames.length);
    ownerNames.push(name);
  }
  return ownerIndex.get(name);
}

// ---------- main ----------

const regionsGeo = await loadRegions();
console.log(`Map size ${W}x${H}, ${regionsGeo.features.length} source regions`);

const regions = []; // index = region id - 1
const missingAdmin = new Set();
const usedOverrideKeys = new Set();
for (const f of regionsGeo.features) {
  const polys = polygonsOf(f.geometry);
  if (polys.length === 0) continue;
  const [lon, lat] = representativePoint(f.geometry);
  if (lat < LAT_BOTTOM || lat > LAT_TOP) continue; // outside the cropped map
  const name = f.properties.name || f.properties.name_en || f.properties.adm1_code;
  const key = `${f.properties.admin}|${name}`;
  let owner = ADMIN1_OVERRIDES[key];
  if (owner) usedOverrideKeys.add(key);
  else owner = ADMIN0_TO_OWNER[f.properties.admin];
  if (!owner) {
    missingAdmin.add(f.properties.admin);
    owner = 'Unclaimed';
  }
  regions.push({ name, admin: f.properties.admin, owner: ownerId(owner), point: project([lon, lat]), polys });
}
if (regions.length > 65535) throw new Error('Too many regions for 16-bit ids');

// 1) region raster (+ stamp one pixel for regions smaller than a pixel)
const regionRaster = new Uint16Array(W * H);
regions.forEach((r, i) => fillPolygons(regionRaster, i + 1, r.polys));
const regionCounts = new Uint32Array(regions.length + 1);
for (let i = 0; i < regionRaster.length; i++) regionCounts[regionRaster[i]]++;
let stamped = 0;
regions.forEach((r, i) => {
  if (regionCounts[i + 1] === 0) {
    const x = Math.min(W - 1, Math.max(0, Math.floor(r.point[0])));
    const y = Math.min(H - 1, Math.max(0, Math.floor(r.point[1])));
    regionRaster[y * W + x] = i + 1;
    stamped++;
  }
});

// 2) owner raster from the tables
const ownerOfRegion = new Uint16Array(regions.length + 1);
regions.forEach((r, i) => (ownerOfRegion[i + 1] = r.owner));
const ownerRaster = new Uint16Array(W * H);
for (let i = 0; i < ownerRaster.length; i++) ownerRaster[i] = ownerOfRegion[regionRaster[i]];

// 3) hand-drawn polygon overrides (land pixels only)
const mask = new Uint8Array(W * H);
for (const o of POLYGON_OVERRIDES) {
  const only = o.only ? new Set(o.only.map(ownerId)) : null;
  const target = ownerId(o.owner);
  const rows = fillPolygons(mask, 1, [[o.ring]]);
  if (!rows) continue;
  let changed = 0;
  for (let r = rows.minRow; r <= rows.maxRow; r++) {
    for (let x = 0; x < W; x++) {
      const i = r * W + x;
      if (!mask[i]) continue;
      mask[i] = 0;
      if (regionRaster[i] === 0) continue;
      if (only && !only.has(ownerRaster[i])) continue;
      ownerRaster[i] = target;
      changed++;
    }
  }
  if (changed === 0) console.warn(`WARNING: polygon "${o.name}" changed no pixels`);
}

// Area of one pixel row relative to the equator (equirectangular maps stretch the poles).
const rowWeight = new Float64Array(H);
for (let y = 0; y < H; y++) rowWeight[y] = Math.cos((((LAT_TOP - ((y + 0.5) / H) * (LAT_TOP - LAT_BOTTOM)) * Math.PI) / 180));

// 4) provinces = (region, owner) pairs
const pairToProvince = new Map();
const provinces = []; // index = province id - 1
const ids = new Uint16Array(W * H);
for (let i = 0; i < ids.length; i++) {
  const region = regionRaster[i];
  if (region === 0) continue;
  const key = region * 1024 + ownerRaster[i];
  let id = pairToProvince.get(key);
  if (id === undefined) {
    id = provinces.length + 1;
    pairToProvince.set(key, id);
    const r = regions[region - 1];
    provinces.push({
      id,
      name: r.name,
      admin: r.admin,
      owner: ownerRaster[i],
      // true when a hand-drawn polygon moved this piece of the region to another owner
      transferred: ownerRaster[i] !== ownerOfRegion[region],
      protected: PROTECTED.has(`${r.admin}|${r.name}`),
      count: 0,
      area: 0, // km2
      nameArea: 0,
      sx: 0,
      sy: 0,
    });
  }
  ids[i] = id;
}

function recomputeStats(list, raster = ids) {
  for (const p of list) {
    p.count = 0;
    p.area = 0;
    p.sx = 0;
    p.sy = 0;
  }
  for (let i = 0; i < raster.length; i++) {
    const id = raster[i];
    if (id === 0) continue;
    const p = list[id - 1];
    const y = Math.floor(i / W);
    p.count++;
    p.area += rowWeight[y] * KM2_PER_EQUATOR_PIXEL;
    p.sx += i % W;
    p.sy += y;
  }
  for (const p of list) p.nameArea = p.area;
}

// Drops provinces without pixels and renumbers the rest (ids must equal array index + 1).
function compact(list, raster = ids) {
  const newId = new Int32Array(list.length + 1);
  const out = [];
  for (const p of list) {
    if (p.count === 0) continue;
    out.push(p);
    newId[p.id] = out.length;
  }
  for (let i = 0; i < raster.length; i++) if (raster[i] !== 0) raster[i] = newId[raster[i]];
  out.forEach((p, i) => (p.id = i + 1));
  return out;
}

// 4b) Territory moved by a polygon (e.g. the strip of Greater Poland that was German) is shared out
// between the nearest provinces of its new owner instead of becoming a long thin province.
function dissolveTransferred() {
  const INF = 0x3fffffff;
  const isTransferred = new Uint8Array(provinces.length + 1);
  for (const p of provinces) if (p.transferred) isTransferred[p.id] = 1;
  const dist = new Int32Array(W * H).fill(INF);
  const label = new Uint16Array(W * H);
  const buckets = [];
  const dxs = [1, -1, 0, 0, 1, 1, -1, -1];
  const dys = [0, 0, 1, -1, 1, -1, 1, -1];
  const cost = [3, 3, 3, 3, 4, 4, 4, 4]; // chamfer 3-4 distance ~ Euclidean, so borders are not diamond shaped
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const a = ids[i];
      if (a === 0 || isTransferred[a]) continue;
      const owner = provinces[a - 1].owner;
      let border = false;
      for (let t = 0; t < 4 && !border; t++) {
        const vx = x + dxs[t];
        const vy = y + dys[t];
        if (vx < 0 || vx >= W || vy < 0 || vy >= H) continue;
        const b = ids[vy * W + vx];
        if (b !== 0 && isTransferred[b] && provinces[b - 1].owner === owner) border = true;
      }
      if (border) {
        dist[i] = 0;
        label[i] = a;
        (buckets[0] ??= []).push(i);
      }
    }
  }
  for (let d = 0; d < buckets.length; d++) {
    const list = buckets[d];
    if (!list) continue;
    for (let k = 0; k < list.length; k++) {
      const u = list[k];
      if (dist[u] !== d) continue;
      const ux = u % W;
      const uy = (u - ux) / W;
      const owner = provinces[label[u] - 1].owner;
      for (let t = 0; t < 8; t++) {
        const vx = ux + dxs[t];
        const vy = uy + dys[t];
        if (vx < 0 || vx >= W || vy < 0 || vy >= H) continue;
        const v = vy * W + vx;
        const b = ids[v];
        if (b === 0 || !isTransferred[b] || provinces[b - 1].owner !== owner) continue;
        const wobble = 1 + 0.7 * (0.7 * valueNoise(vx, vy, 30, 11) + 0.3 * valueNoise(vx, vy, 9, 12));
        const nd = d + Math.max(1, Math.round(cost[t] * wobble));
        if (nd < dist[v]) {
          dist[v] = nd;
          label[v] = label[u];
          (buckets[nd] ??= []).push(v);
        }
      }
    }
  }
  let moved = 0;
  for (let i = 0; i < ids.length; i++) {
    if (ids[i] !== 0 && isTransferred[ids[i]] && dist[i] < INF) {
      ids[i] = label[i];
      moved++;
    }
  }
  return moved;
}
const dissolved = dissolveTransferred();
recomputeStats(provinces);

// Total area of every modern country, used to pick the target province size.
const adminArea = new Map();
for (const p of provinces) adminArea.set(p.admin, (adminArea.get(p.admin) ?? 0) + p.area);
const targetOf = (p) => STATE_FACTOR * targetKm2(adminArea.get(p.admin));
const provinceTargetOf = (p) => PROVINCE_FACTOR * targetKm2(adminArea.get(p.admin));

// 5) merge small provinces into the same-owner neighbor they touch most
function contactCounts(n) {
  const contacts = Array.from({ length: n + 1 }, () => new Map());
  const add = (a, b) => {
    contacts[a].set(b, (contacts[a].get(b) ?? 0) + 1);
    contacts[b].set(a, (contacts[b].get(a) ?? 0) + 1);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = ids[y * W + x];
      if (a === 0) continue;
      if (x + 1 < W) {
        const b = ids[y * W + x + 1];
        if (b !== 0 && b !== a) add(a, b);
      }
      if (y + 1 < H) {
        const b = ids[(y + 1) * W + x];
        if (b !== 0 && b !== a) add(a, b);
      }
    }
  }
  return contacts;
}

const contacts = contactCounts(provinces.length);
const redirect = new Int32Array(provinces.length + 1).map((_, i) => i);
const find = (i) => {
  while (redirect[i] !== i) i = redirect[i] = redirect[redirect[i]];
  return i;
};
let merged = 0;
for (const p of [...provinces].sort((a, b) => a.area - b.area)) {
  if (p.count === 0 || p.protected || redirect[p.id] !== p.id) continue;
  const T = targetOf(p);
  if (p.area >= MERGE_BELOW * T) continue;
  let best = null;
  let bestScore = 0;
  for (const [n, c] of contacts[p.id]) {
    const q = provinces[n - 1];
    if (q.owner !== p.owner || q.protected) continue;
    const score = c * (q.admin === p.admin ? 3 : 1);
    if (score > bestScore) {
      bestScore = score;
      best = q;
    }
  }
  if (!best) continue;
  if (p.area >= 0.2 * T && p.area + best.area > 1.6 * Math.max(T, targetOf(best))) continue;
  // merge p into best
  best.area += p.area;
  best.count += p.count;
  best.sx += p.sx;
  best.sy += p.sy;
  if (p.nameArea > best.nameArea) {
    best.name = p.name;
    best.admin = p.admin;
    best.nameArea = p.nameArea;
  }
  for (const [m, c] of contacts[p.id]) {
    if (m === best.id) continue;
    contacts[m].delete(p.id);
    contacts[m].set(best.id, (contacts[m].get(best.id) ?? 0) + c);
    contacts[best.id].set(m, (contacts[best.id].get(m) ?? 0) + c);
  }
  contacts[best.id].delete(p.id);
  contacts[p.id].clear();
  redirect[p.id] = best.id;
  p.count = 0;
  merged++;
}
for (let i = 0; i < ids.length; i++) if (ids[i] !== 0) ids[i] = find(ids[i]);

// 6) compact ids: only provinces that still have pixels survive
let finalProvinces = compact(provinces);

// 7) split big units into compact cells: k-means seeds, then nearest-seed assignment on slightly warped
// coordinates. Used twice: for states (here) and for the provinces inside every state (later).
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(1936);

function hash2(x, y, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}
// smooth value noise in [-1, 1]
function valueNoise(x, y, period, seed) {
  const gx = x / period;
  const gy = y / period;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed) * (1 - sx) + hash2(ix + 1, iy, seed) * sx;
  const b = hash2(ix, iy + 1, seed) * (1 - sx) + hash2(ix + 1, iy + 1, seed) * sx;
  return a * (1 - sy) + b * sy;
}

// warp: [{ amp, period }] noise layers, both relative to the typical cell size
function subdivide(raster, list, targetFn, splitAbove, warp) {
  const startAt = new Int32Array(list.length + 2);
  for (let i = 0; i < raster.length; i++) if (raster[i] !== 0) startAt[raster[i] + 1]++;
  for (let i = 1; i < startAt.length; i++) startAt[i] += startAt[i - 1];
  const pixelList = new Int32Array(startAt[startAt.length - 1]);
  {
    const fillPos = startAt.slice();
    for (let i = 0; i < raster.length; i++) if (raster[i] !== 0) pixelList[fillPos[raster[i]]++] = i;
  }

  const cluster = new Int32Array(W * H).fill(-1);
  let splitCount = 0;
  const baseCount = list.length;
  for (let pid = 1; pid <= baseCount; pid++) {
    const p = list[pid - 1];
    const T = targetFn(p);
    if (p.protected || p.area <= splitAbove * T) continue;
    const k = Math.max(2, Math.round(p.area / T));
    const px = pixelList.subarray(startAt[pid], startAt[pid + 1]);
    const n = px.length;
    // Local equal-area coordinates: ONE horizontal scale for the whole cell group (the cosine of its
    // mean latitude). Scaling x per row would shear the shape and produce long horizontal strips.
    let meanY = 0;
    for (let j = 0; j < n; j++) meanY += Math.floor(px[j] / W);
    meanY /= n;
    const w0 = rowWeight[Math.min(H - 1, Math.max(0, Math.round(meanY)))];
    const X = new Float32Array(n);
    const Y = new Float32Array(n);
    for (let j = 0; j < n; j++) {
      X[j] = (px[j] % W) * w0;
      Y[j] = Math.floor(px[j] / W);
    }
    // k-means++ seeding on a sample
    const sample = Math.min(n, 3000);
    const sIdx = Array.from({ length: sample }, () => Math.floor(rnd() * n));
    const cx = new Float64Array(k);
    const cy = new Float64Array(k);
    cx[0] = X[sIdx[0]];
    cy[0] = Y[sIdx[0]];
    const minD = new Float64Array(sample).fill(Infinity);
    for (let c = 1; c < k; c++) {
      let total = 0;
      for (let s = 0; s < sample; s++) {
        const dx = X[sIdx[s]] - cx[c - 1];
        const dy = Y[sIdx[s]] - cy[c - 1];
        minD[s] = Math.min(minD[s], dx * dx + dy * dy);
        total += minD[s];
      }
      let r = rnd() * total;
      let pick = 0;
      for (let s = 0; s < sample; s++) {
        r -= minD[s];
        if (r <= 0) {
          pick = s;
          break;
        }
      }
      cx[c] = X[sIdx[pick]];
      cy[c] = Y[sIdx[pick]];
    }
    const label = new Int32Array(n);
    const assign = (xs, ys, accumulate) => {
      const sumX = new Float64Array(k);
      const sumY = new Float64Array(k);
      const cnt = new Int32Array(k);
      for (let j = 0; j < n; j++) {
        let best = 0;
        let bestD = Infinity;
        for (let c = 0; c < k; c++) {
          const dx = xs[j] - cx[c];
          const dy = ys[j] - cy[c];
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
        label[j] = best;
        if (accumulate) {
          sumX[best] += xs[j];
          sumY[best] += ys[j];
          cnt[best]++;
        }
      }
      if (accumulate) {
        for (let c = 0; c < k; c++) {
          if (cnt[c] > 0) {
            cx[c] = sumX[c] / cnt[c];
            cy[c] = sumY[c] / cnt[c];
          }
        }
      }
    };
    for (let iter = 0; iter < 6; iter++) assign(X, Y, true);
    // final assignment on lightly warped coordinates -> edges are not perfectly straight
    {
      const L = Math.sqrt(n / k);
      const layers = warp.map((w) => ({ amp: w.amp * L, period: w.period * L }));
      const base = Math.floor(rnd() * 1e6);
      const WX = new Float32Array(n);
      const WY = new Float32Array(n);
      for (let j = 0; j < n; j++) {
        const x = px[j] % W;
        const y = Math.floor(px[j] / W);
        let wx = 0;
        let wy = 0;
        layers.forEach((l, li) => {
          wx += l.amp * valueNoise(x, y, l.period, base + li * 2);
          wy += l.amp * valueNoise(x, y, l.period, base + li * 2 + 1);
        });
        WX[j] = (x + wx) * w0;
        WY[j] = y + wy;
      }
      assign(WX, WY, false);
    }
    for (let j = 0; j < n; j++) cluster[px[j]] = label[j];

    // connected components inside each cluster: big separate pieces become their own cells,
    // small leftovers (islands) stay with their cluster as extra parts
    const seen = new Uint8Array(n);
    const posOf = new Map();
    for (let j = 0; j < n; j++) posOf.set(px[j], j);
    const comps = [];
    for (let j = 0; j < n; j++) {
      if (seen[j]) continue;
      const c = label[j];
      const stack = [px[j]];
      seen[j] = 1;
      const members = [];
      while (stack.length) {
        const q = stack.pop();
        members.push(q);
        const x = q % W;
        const nb = [x > 0 ? q - 1 : -1, x + 1 < W ? q + 1 : -1, q - W, q + W];
        for (const m of nb) {
          if (m < 0 || m >= W * H || cluster[m] !== c) continue;
          const pos = posOf.get(m);
          if (pos === undefined || seen[pos]) continue;
          seen[pos] = 1;
          stack.push(m);
        }
      }
      let area = 0;
      for (const q of members) area += rowWeight[Math.floor(q / W)] * KM2_PER_EQUATOR_PIXEL;
      comps.push({ c, members, area });
    }
    const mainOfCluster = new Map();
    for (const comp of comps) {
      const cur = mainOfCluster.get(comp.c);
      if (!cur || comp.area > cur.area) mainOfCluster.set(comp.c, comp);
    }
    const groups = new Map();
    for (const comp of comps) {
      const main = mainOfCluster.get(comp.c);
      const own = comp === main || comp.area >= 0.25 * T;
      const key = own ? comp : main;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(comp);
    }
    const baseName = p.name;
    let part = 0;
    for (const [, parts] of groups) {
      part++;
      let target;
      if (part === 1) {
        target = p;
      } else {
        target = { ...p, id: list.length + 1, transferred: false, protected: false, count: 0, area: 0, nameArea: 0, sx: 0, sy: 0 };
        list.push(target);
      }
      target.name = `${baseName} ${part}`;
      for (const comp of parts) for (const q of comp.members) raster[q] = target.id;
    }
    for (let j = 0; j < n; j++) cluster[px[j]] = -1;
    splitCount++;
  }
  return splitCount;
}

let splitCount = subdivide(ids, finalProvinces, targetOf, SPLIT_ABOVE, [
  { amp: 0.45, period: 1.4 },
  { amp: 0.18, period: 0.5 },
]);
recomputeStats(finalProvinces);
if (finalProvinces.length > 65535) throw new Error('Too many states for 16-bit ids');

// 8) Small detached fragments (left by merging or splitting) join the neighboring province they touch most.
function cleanFragments(list, raster = ids) {
  const ownerOf = new Uint16Array(list.length + 1);
  const isProtected = new Uint8Array(list.length + 1);
  list.forEach((p) => {
    ownerOf[p.id] = p.owner;
    isProtected[p.id] = p.protected ? 1 : 0;
  });
  const comp = new Int32Array(W * H).fill(-1);
  const comps = [];
  const largest = new Map();
  const TRACK_LIMIT = 600;
  const stack = [];
  for (let s = 0; s < raster.length; s++) {
    if (raster[s] === 0 || comp[s] !== -1) continue;
    const id = raster[s];
    const c = { id, size: 0, pixels: [], tally: new Map() };
    const ci = comps.length;
    comps.push(c);
    comp[s] = ci;
    stack.push(s);
    while (stack.length) {
      const u = stack.pop();
      c.size++;
      if (c.pixels) {
        if (c.pixels.length < TRACK_LIMIT) c.pixels.push(u);
        else {
          c.pixels = null;
          c.tally = null;
        }
      }
      const x = u % W;
      const nb = [x > 0 ? u - 1 : -1, x + 1 < W ? u + 1 : -1, u - W, u + W];
      for (const v of nb) {
        if (v < 0 || v >= W * H) continue;
        const b = raster[v];
        if (b === 0) continue;
        if (b === id) {
          if (comp[v] === -1) {
            comp[v] = ci;
            stack.push(v);
          }
        } else if (c.tally && ownerOf[b] === ownerOf[id]) {
          c.tally.set(b, (c.tally.get(b) ?? 0) + 1);
        }
      }
    }
    if (c.size > (largest.get(id) ?? 0)) largest.set(id, c.size);
  }
  let moved = 0;
  for (const c of comps) {
    if (!c.pixels || c.size === largest.get(c.id) || isProtected[c.id]) continue;
    if (c.size >= Math.max(25, 0.12 * largest.get(c.id))) continue;
    let best = 0;
    let bestCount = 0;
    for (const [b, n] of c.tally) {
      if (n > bestCount) {
        bestCount = n;
        best = b;
      }
    }
    if (best === 0) continue;
    for (const u of c.pixels) raster[u] = best;
    moved++;
  }
  return moved;
}

cleanFragments(finalProvinces);

// 8) smooth the borders between provinces of the same owner (majority filter). Country borders and
// coastlines are never touched, only which province a pixel belongs to.
{
  const ownerOf = new Uint16Array(finalProvinces.length + 1);
  const isProtected = new Uint8Array(finalProvinces.length + 1);
  finalProvinces.forEach((p) => {
    ownerOf[p.id] = p.owner;
    isProtected[p.id] = p.protected ? 1 : 0;
  });
  const dxs = [1, -1, 0, 0, 1, 1, -1, -1];
  const dys = [0, 0, 1, -1, 1, -1, 1, -1];
  const tallyId = new Int32Array(8);
  const tallyCount = new Int32Array(8);
  for (let pass = 0; pass < 3; pass++) {
    const counts = new Int32Array(finalProvinces.length + 1);
    for (let i = 0; i < ids.length; i++) counts[ids[i]]++;
    const next = ids.slice();
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const a = ids[i];
        if (a === 0 || counts[a] < 40 || isProtected[a]) continue;
        let kinds = 0;
        for (let t = 0; t < 8; t++) {
          const b = ids[(y + dys[t]) * W + x + dxs[t]];
          if (b === 0 || ownerOf[b] !== ownerOf[a]) continue;
          let f = 0;
          while (f < kinds && tallyId[f] !== b) f++;
          if (f === kinds) {
            tallyId[kinds] = b;
            tallyCount[kinds] = 0;
            kinds++;
          }
          tallyCount[f]++;
        }
        let self = 0;
        let bestId = a;
        let bestCnt = 0;
        for (let f = 0; f < kinds; f++) {
          if (tallyId[f] === a) self = tallyCount[f];
          else if (tallyCount[f] > bestCnt) {
            bestCnt = tallyCount[f];
            bestId = tallyId[f];
          }
        }
        if (bestId !== a && bestCnt >= 5 && bestCnt > self) next[i] = bestId;
      }
    }
    ids.set(next);
  }
}
cleanFragments(finalProvinces);
recomputeStats(finalProvinces);
finalProvinces = compact(finalProvinces);
finalProvinces.forEach((p, i) => {
  if (p.id !== i + 1) throw new Error(`Province id mismatch at index ${i}`);
});

// 9) provinces: every state is cut into compact cells of roughly equal size (Voronoi-like, as in HOI4)
const states = finalProvinces.map((p, i) => ({ id: i, name: p.name, owner: p.owner }));
const stateRaster = ids.slice();
let provinceList = finalProvinces.map((p, i) => ({ ...p, id: i + 1, state: i }));
const provinceSplits = subdivide(stateRaster, provinceList, provinceTargetOf, PROVINCE_SPLIT_ABOVE, [{ amp: 0.14, period: 0.9 }]);
recomputeStats(provinceList, stateRaster);
cleanFragments(provinceList, stateRaster);
recomputeStats(provinceList, stateRaster);
provinceList = compact(provinceList, stateRaster);
provinceList.forEach((p, i) => {
  if (p.id !== i + 1) throw new Error(`Province id mismatch at index ${i}`);
});
if (provinceList.length > 65535) throw new Error('Too many provinces for 16-bit ids');
ids.set(stateRaster);
finalProvinces = provinceList;
splitCount += provinceSplits;



// 10) Seas: Natural Earth marine regions become named sea regions (like HOI4 strategic regions); every
// sea region is cut into sea provinces that are small near the coast and large in the open ocean.
const COAST_KM2 = 22000; // sea province size right next to land
const OPEN_KM2 = 200000; // sea province size far from land
const SCALE = 8; // integer cost scale for the geodesic distance transform

const hCost = new Int32Array(H);
const dCost = new Int32Array(H);
for (let y = 0; y < H; y++) {
  hCost[y] = Math.max(1, Math.round(SCALE * rowWeight[y]));
  dCost[y] = Math.max(1, Math.round(SCALE * Math.hypot(rowWeight[y], 1)));
}
const NDX = [1, -1, 0, 0, 1, 1, -1, -1];
const NDY = [0, 0, 1, -1, 1, -1, 1, -1];

// Multi-source distance transform with equal-area step costs (a bucket queue, like Dijkstra).
// labels (optional) receive the label of the nearest source; canEnter(v, u) limits where it may spread.
function geodesicFill(sources, labels, canEnter) {
  const INF = 0x3fffffff;
  const dist = new Int32Array(W * H).fill(INF);
  const buckets = [];
  for (const s of sources) {
    dist[s] = 0;
    (buckets[0] ??= []).push(s);
  }
  for (let d = 0; d < buckets.length; d++) {
    const list = buckets[d];
    if (!list) continue;
    for (let k = 0; k < list.length; k++) {
      const u = list[k];
      if (dist[u] !== d) continue;
      const ux = u % W;
      const uy = (u - ux) / W;
      const label = labels ? labels[u] : 0;
      for (let t = 0; t < 8; t++) {
        const vx = ux + NDX[t];
        const vy = uy + NDY[t];
        if (vx < 0 || vx >= W || vy < 0 || vy >= H) continue;
        const v = vy * W + vx;
        if (!canEnter(v, u)) continue;
        const nd = d + (t < 2 ? hCost[uy] : t < 4 ? SCALE : dCost[uy]);
        if (nd < dist[v]) {
          dist[v] = nd;
          if (labels) labels[v] = label;
          (buckets[nd] ??= []).push(v);
        }
      }
    }
  }
  return dist;
}

const landCount = finalProvinces.length;
{
  const marineGeo = await loadMarine();
  const niceName = (n) => (n === n.toUpperCase() ? n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : n);
  const marine = marineGeo.features
    .filter((f) => {
      const rank = f.properties.scalerank;
      const cls = f.properties.featurecla;
      return rank <= 3 || (['sea', 'gulf', 'bay'].includes(cls) && rank <= 5);
    })
    .map((f) => {
      const polys = polygonsOf(f.geometry);
      return { name: niceName(f.properties.name || f.properties.name_en), polys, area: polys.reduce((a, q) => a + Math.abs(ringArea(q[0])), 0) };
    })
    .sort((a, b) => b.area - a.area); // big first, small regions are painted over them

  // sea region raster
  const marineRaster = new Uint16Array(W * H);
  marine.forEach((m, i) => fillPolygons(marineRaster, i + 1, m.polys));
  // water that no region covers (but that touches one) joins the nearest region; lakes stay unlabeled
  {
    const edge = [];
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] !== 0 || marineRaster[i] === 0) continue;
      const x = i % W;
      const nb = [x > 0 ? i - 1 : -1, x + 1 < W ? i + 1 : -1, i - W, i + W];
      if (nb.some((v) => v >= 0 && v < W * H && ids[v] === 0 && marineRaster[v] === 0)) edge.push(i);
    }
    geodesicFill(edge, marineRaster, (v) => ids[v] === 0 && marineRaster[v] === 0);
  }

  // distance from the coast (in pixels) for every sea pixel
  const coast = [];
  for (let i = 0; i < ids.length; i++) {
    if (ids[i] === 0) continue;
    const x = i % W;
    const nb = [x > 0 ? i - 1 : -1, x + 1 < W ? i + 1 : -1, i - W, i + W];
    if (nb.some((v) => v >= 0 && v < W * H && ids[v] === 0)) coast.push(i);
  }
  const landDist = geodesicFill(coast, null, (v) => ids[v] === 0);
  const seaD = (i) => landDist[i] / SCALE; // pixels
  const radiusEq = (i) => {
    const t = Math.min(1, Math.max(0, (seaD(i) - 3) / 45));
    const area = COAST_KM2 + (OPEN_KM2 - COAST_KM2) * t * t * (3 - 2 * t);
    return Math.sqrt(area / (0.9 * KM2_PER_EQUATOR_PIXEL)); // minimum seed distance in equal-area pixels
  };

  // Poisson-disk seeds with a radius that grows with the distance from land (coast first)
  const near = [];
  const far = [];
  for (let y = 1; y < H - 1; y += 3) {
    for (let x = 1; x < W - 1; x += 3) {
      const jx = Math.min(W - 1, x + Math.floor(rnd() * 3) - 1);
      const jy = Math.min(H - 1, y + Math.floor(rnd() * 3) - 1);
      const i = jy * W + jx;
      if (ids[i] !== 0 || marineRaster[i] === 0) continue;
      (seaD(i) <= 50 ? near : far).push(i);
    }
  }
  for (const arr of [near, far]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  const BUCKET = 64;
  const bucketsX = Math.ceil(W / BUCKET);
  const bucketsY = Math.ceil(H / BUCKET);
  const seedBuckets = new Map();
  const seeds = []; // pixel indices
  const tryAdd = (i) => {
    const x = i % W;
    const y = (i - x) / W;
    const w = rowWeight[y];
    const d = radiusEq(i);
    const rx = Math.ceil(d / (w * BUCKET));
    const ry = Math.ceil(d / BUCKET);
    const bx = Math.floor(x / BUCKET);
    const by = Math.floor(y / BUCKET);
    for (let yy = Math.max(0, by - ry); yy <= Math.min(bucketsY - 1, by + ry); yy++) {
      for (let xx = Math.max(0, bx - rx); xx <= Math.min(bucketsX - 1, bx + rx); xx++) {
        const list = seedBuckets.get(yy * bucketsX + xx);
        if (!list) continue;
        for (const s of list) {
          const sx = s % W;
          const sy = (s - sx) / W;
          const ddx = (x - sx) * w;
          const ddy = y - sy;
          if (ddx * ddx + ddy * ddy < d * d) return;
        }
      }
    }
    const key = by * bucketsX + bx;
    if (!seedBuckets.has(key)) seedBuckets.set(key, []);
    seedBuckets.get(key).push(i);
    seeds.push(i);
  };
  for (const i of near) tryAdd(i);
  for (const i of far) tryAdd(i);

  // every connected piece of a sea region needs at least one seed
  const comp = new Int32Array(W * H);
  const compHasSeed = [0];
  const compFirst = [0];
  const compSize = [0];
  {
    const stack = [];
    for (let s = 0; s < ids.length; s++) {
      if (ids[s] !== 0 || marineRaster[s] === 0 || comp[s] !== 0) continue;
      const c = compFirst.length;
      compFirst.push(s);
      compSize.push(0);
      compHasSeed.push(0);
      const region = marineRaster[s];
      comp[s] = c;
      stack.push(s);
      while (stack.length) {
        const u = stack.pop();
        compSize[c]++;
        const x = u % W;
        for (const v of [x > 0 ? u - 1 : -1, x + 1 < W ? u + 1 : -1, u - W, u + W]) {
          if (v < 0 || v >= W * H || comp[v] !== 0 || ids[v] !== 0 || marineRaster[v] !== region) continue;
          comp[v] = c;
          stack.push(v);
        }
      }
    }
  }
  for (const i of seeds) compHasSeed[comp[i]] = 1;
  for (let c = 1; c < compFirst.length; c++) {
    if (!compHasSeed[c] && compSize[c] >= 60) seeds.push(compFirst[c]);
  }
  if (landCount + seeds.length > 65535) throw new Error('Too many provinces for 16-bit ids');

  // every sea pixel joins its nearest seed inside the same sea region
  const seaLabel = new Uint16Array(W * H);
  seeds.forEach((pix, i) => (seaLabel[pix] = i + 1));
  geodesicFill(seeds, seaLabel, (v, u) => ids[v] === 0 && marineRaster[v] === marineRaster[u]);

  // build the sea provinces and sea regions
  const regionState = new Map(); // marine region index -> state index
  const regionCounter = new Map();
  const seaProvinceOfLabel = new Int32Array(seeds.length + 1);
  seeds.forEach((pix, i) => {
    const region = marineRaster[pix];
    if (!regionState.has(region)) {
      regionState.set(region, states.length);
      states.push({ id: states.length, name: marine[region - 1].name, owner: 0 });
      regionCounter.set(region, 0);
    }
    const n = regionCounter.get(region) + 1;
    regionCounter.set(region, n);
    const id = finalProvinces.length + 1;
    seaProvinceOfLabel[i + 1] = id;
    finalProvinces.push({ id, name: `${marine[region - 1].name} ${n}`, admin: '', owner: 0, state: regionState.get(region), protected: false, count: 0, area: 0, nameArea: 0, sx: 0, sy: 0 });
  });
  for (let i = 0; i < ids.length; i++) {
    const l = seaLabel[i];
    if (ids[i] !== 0 || l === 0) continue;
    const id = seaProvinceOfLabel[l];
    ids[i] = id;
    const p = finalProvinces[id - 1];
    p.count++;
    p.sx += i % W;
    p.sy += Math.floor(i / W);
  }
  console.log(`Seas: ${marine.length} candidate regions, ${regionState.size} used, ${seeds.length} sea provinces`);
}
// a province that ended up without pixels (tiny leftovers) must not exist
{
  const newId = new Int32Array(finalProvinces.length + 1);
  const out = [];
  for (const p of finalProvinces) {
    if (p.count === 0) continue;
    out.push(p);
    newId[p.id] = out.length;
  }
  for (let i = 0; i < ids.length; i++) if (ids[i] !== 0) ids[i] = newId[ids[i]];
  out.forEach((p, i) => (p.id = i + 1));
  finalProvinces = out;
}

// neighbors from the final raster
const neighborSets = Array.from({ length: finalProvinces.length + 1 }, () => new Set());
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const a = ids[y * W + x];
    if (a === 0) continue;
    if (x + 1 < W) {
      const b = ids[y * W + x + 1];
      if (b !== 0 && b !== a) {
        neighborSets[a].add(b);
        neighborSets[b].add(a);
      }
    }
    if (y + 1 < H) {
      const b = ids[(y + 1) * W + x];
      if (b !== 0 && b !== a) {
        neighborSets[a].add(b);
        neighborSets[b].add(a);
      }
    }
  }
}

// ---------- countries, colors, outputs ----------

// Perceptual color distance (CIE76 in Lab) so neighboring countries get clearly different colors.
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
const labDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const ownerAdj = Array.from({ length: ownerNames.length }, () => new Set());
const ownerProvinceCount = new Array(ownerNames.length).fill(0);
for (let i = 0; i < finalProvinces.length; i++) ownerProvinceCount[finalProvinces[i].owner]++;

const neighborSetsEarly = Array.from({ length: finalProvinces.length + 1 }, () => new Set());
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const a = ids[y * W + x];
    if (a === 0) continue;
    for (const b of [x + 1 < W ? ids[y * W + x + 1] : 0, y + 1 < H ? ids[(y + 1) * W + x] : 0]) {
      if (b !== 0 && b !== a) {
        neighborSetsEarly[a].add(b);
        neighborSetsEarly[b].add(a);
      }
    }
  }
}
finalProvinces.forEach((p, i) => {
  for (const n of neighborSetsEarly[i + 1]) {
    const o = finalProvinces[n - 1].owner;
    if (o !== p.owner) ownerAdj[p.owner].add(o);
  }
});

const colors = new Array(ownerNames.length).fill(null);
colors[0] = [24, 52, 84];
ownerNames.forEach((name, id) => {
  if (name === 'Unclaimed') colors[id] = [120, 120, 120];
  else if (OWNER_INFO[name]?.color) colors[id] = OWNER_INFO[name].color;
});
const candidates = [];
for (let hue = 0; hue < 360; hue += 10) {
  for (const [s, l] of [[0.55, 0.5], [0.7, 0.4], [0.45, 0.65]]) {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + hue / 30) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    candidates.push([Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]);
  }
}
const candLab = candidates.map(toLab);
const order = ownerNames
  .map((_, id) => id)
  .filter((id) => colors[id] === null && !OWNER_INFO[ownerNames[id]]?.overlord)
  .sort((a, b) => ownerProvinceCount[b] - ownerProvinceCount[a]);
for (const id of order) {
  let bestIdx = 0;
  let bestScore = -1;
  candidates.forEach((_, ci) => {
    let nearAdj = Infinity;
    let nearAny = Infinity;
    colors.forEach((c, other) => {
      if (!c || other === id) return;
      const d = labDist(candLab[ci], toLab(c));
      nearAny = Math.min(nearAny, d);
      if (ownerAdj[id].has(other)) nearAdj = Math.min(nearAdj, d);
    });
    const score = Math.min(nearAdj, 100) + 0.3 * Math.min(nearAny, 100);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = ci;
    }
  });
  colors[id] = candidates[bestIdx];
}
// subjects: a lighter shade of their overlord
ownerNames.forEach((name, id) => {
  const info = OWNER_INFO[name];
  if (colors[id] === null && info?.overlord) colors[id] = lighten(colors[ownerIndex.get(info.overlord)] ?? [128, 128, 128], 0.35);
});
const outCountries = ownerNames.map((name, id) => ({
  id,
  name,
  color: colors[id],
  overlord: OWNER_INFO[name]?.overlord ? (ownerIndex.get(OWNER_INFO[name].overlord) ?? null) : null,
}));


fs.writeFileSync(
  'public/data/provinces.json',
  JSON.stringify({
    width: W,
    height: H,
    countries: outCountries,
    states,
    provinces: finalProvinces.map((p, i) => ({
      id: i + 1,
      name: p.name,
      owner: p.owner,
      state: p.state,
      x: Math.round(p.sx / p.count),
      y: Math.round(p.sy / p.count),
      neighbors: [...neighborSets[i + 1]],
    })),
  }),
);

const idPng = new PNG({ width: W, height: H });
for (let i = 0; i < ids.length; i++) {
  idPng.data[i * 4] = ids[i] & 255;
  idPng.data[i * 4 + 1] = ids[i] >> 8;
  idPng.data[i * 4 + 2] = 0;
  idPng.data[i * 4 + 3] = 255;
}
fs.writeFileSync('public/data/provinces.png', PNG.sync.write(idPng));

// Debug previews: whole world at 1/4 scale, plus Europe/Middle East and East Asia at 1/2 scale.
function writePreview(file, x0, y0, w, h, step, borders) {
  const pw = Math.floor(w / step);
  const ph = Math.floor(h / step);
  const png = new PNG({ width: pw, height: ph });
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const sx = Math.min(W - 2, x0 + x * step);
      const sy = Math.min(H - 2, y0 + y * step);
      const id = ids[sy * W + sx];
      const owner = id === 0 ? 0 : finalProvinces[id - 1].owner;
      const right = ids[sy * W + sx + 1];
      const down = ids[(sy + 1) * W + sx];
      const ownerBorder = id !== 0 && ((right !== 0 && finalProvinces[right - 1].owner !== owner) || (down !== 0 && finalProvinces[down - 1].owner !== owner));
      const provBorder = id !== 0 && (id !== right || id !== down);
      const k = ownerBorder ? 0.25 : provBorder && borders ? 0.7 : 1;
      const [r, g, b] = outCountries[owner].color;
      const o = (y * pw + x) * 4;
      png.data[o] = r * k;
      png.data[o + 1] = g * k;
      png.data[o + 2] = b * k;
      png.data[o + 3] = 255;
    }
  }
  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(png));
}
const px = (lon) => Math.round(((lon + 180) / 360) * W);
const py = (lat) => Math.round(((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * H);
writePreview('preview.png', 0, 0, W, H, 4, true);
writePreview('preview-europe.png', px(-12), py(72), px(62) - px(-12), py(25) - py(72), 2, true);
writePreview('preview-asia.png', px(60), py(55), px(150) - px(60), py(-12) - py(55), 2, true);

// ---------- report ----------

const perOwner = new Map();
for (const p of finalProvinces) perOwner.set(p.owner, (perOwner.get(p.owner) ?? 0) + 1);
console.log(`Provinces: ${finalProvinces.length} (stamped ${stamped} tiny regions, merged ${merged}, dissolved ${dissolved} transferred pixels, split ${splitCount} large ones), owners: ${outCountries.length - 1}`);
if (missingAdmin.size) console.warn('WARNING: no 1936 owner defined for:', [...missingAdmin].join(', '));
const unusedKeys = Object.keys(ADMIN1_OVERRIDES).filter((k) => !usedOverrideKeys.has(k));
if (unusedKeys.length) console.warn('WARNING: ADMIN1_OVERRIDES keys that matched no region:', unusedKeys.join(' ; '));
console.log('Owners by province count:');
[...perOwner.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([o, n]) => console.log(`  ${outCountries[o].name}: ${n}`));