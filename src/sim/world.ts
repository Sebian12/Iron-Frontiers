// Game logic: no dependencies on Pixi or the DOM. The same code can later run on a server.

export interface Country {
  id: number;
  name: string;
  color: [number, number, number];
}

export interface Province {
  id: number;
  x: number; // Province center (map pixels)
  y: number;
  owner: number; // Country ID
  neighbors: number[];
}

export interface World {
  width: number;
  height: number;
  ids: Uint16Array; // Province ID for each map pixel
  provinces: Province[];
  countries: Country[];
}

// Deterministic random generator: the same seed produces the same map for every player.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

const COUNTRY_NAMES = ['Alfa', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];

export function generateWorld(seed = 1): World {
  const rnd = mulberry32(seed);
  const width = 2048;
  const height = 1024;
  const cell = 64;
  const cols = width / cell;
  const rows = height / cell;

  // One random province in each grid cell creates an even Voronoi distribution.
  const seedsX = new Float32Array(cols * rows);
  const seedsY = new Float32Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const i = cy * cols + cx;
      seedsX[i] = (cx + 0.15 + rnd() * 0.7) * cell;
      seedsY[i] = (cy + 0.15 + rnd() * 0.7) * cell;
    }
  }

  // For each pixel, find the nearest seed among the surrounding 5x5 grid cells.
  const ids = new Uint16Array(width * height);
  for (let py = 0; py < height; py++) {
    const cy = Math.floor(py / cell);
    for (let px = 0; px < width; px++) {
      const cx = Math.floor(px / cell);
      let best = 0;
      let bestD = Infinity;
      for (let dy = -2; dy <= 2; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= rows) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const nx = cx + dx;
          if (nx < 0 || nx >= cols) continue;
          const i = ny * cols + nx;
          const ddx = seedsX[i] - px;
          const ddy = seedsY[i] - py;
          const d = ddx * ddx + ddy * ddy;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
      }
      ids[py * width + px] = best;
    }
  }

  // Provinces are neighbors if they share pixels along an edge.
  const neighborSets: Set<number>[] = Array.from({ length: cols * rows }, () => new Set());
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const a = ids[y * width + x];
      const r = ids[y * width + x + 1];
      const d = ids[(y + 1) * width + x];
      if (a !== r) {
        neighborSets[a].add(r);
        neighborSets[r].add(a);
      }
      if (a !== d) {
        neighborSets[a].add(d);
        neighborSets[d].add(a);
      }
    }
  }

  const provinces: Province[] = [];
  for (let i = 0; i < cols * rows; i++) {
    provinces.push({
      id: i,
      x: seedsX[i],
      y: seedsY[i],
      owner: 0,
      neighbors: [...neighborSets[i]],
    });
  }

  // Choose capitals for the countries and assign each province to its nearest capital.
  const countries: Country[] = COUNTRY_NAMES.map((name, id) => ({
    id,
    name,
    color: hslToRgb((id * 360) / COUNTRY_NAMES.length, 0.55, 0.55),
  }));
  const capitals = countries.map(() => provinces[Math.floor(rnd() * provinces.length)]);
  for (const p of provinces) {
    let best = 0;
    let bestD = Infinity;
    capitals.forEach((c, i) => {
      const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    p.owner = best;
  }

  return { width, height, ids, provinces, countries };
}