import type { Country, Province, State, World } from '../sim/world';

interface MapFile {
  width: number;
  height: number;
  countries: Country[];
  states: State[];
  provinces: Province[];
}

// Loads the map produced by `npm run build:map` (public/data/provinces.png + provinces.json).
export async function loadWorld(): Promise<World> {
  const base = import.meta.env.BASE_URL;
  const [meta, bitmap] = await Promise.all([
    fetch(`${base}data/provinces.json`, { cache: 'no-cache' }).then((r) => r.json() as Promise<MapFile>),
    fetch(`${base}data/provinces.png`, { cache: 'no-cache' })
      .then((r) => r.blob())
      .then((b) => createImageBitmap(b, { colorSpaceConversion: 'none' })),
  ]);

  // Decode the id image: R = low byte, G = high byte of the province id.
  const canvas = new OffscreenCanvas(meta.width, meta.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  const pixels = ctx.getImageData(0, 0, meta.width, meta.height).data;
  const ids = new Uint16Array(meta.width * meta.height);
  let maxId = 0;
  for (let i = 0; i < ids.length; i++) {
    ids[i] = pixels[i * 4] | (pixels[i * 4 + 1] << 8);
    if (ids[i] > maxId) maxId = ids[i];
  }

  // The two files must come from the same `npm run build:map` run, otherwise colors and names get mixed up.
  if (maxId !== meta.provinces.length) {
    throw new Error(
      `provinces.png (max id ${maxId}) and provinces.json (${meta.provinces.length} provinces) are from different builds. Copy both files again.`,
    );
  }

  // Province 0 is the sea so that province ids can be used as array indices.
  const provinces: Province[] = [{ id: 0, name: 'Sea', state: 0, x: 0, y: 0, owner: 0, neighbors: [] }, ...meta.provinces];

  return { width: meta.width, height: meta.height, ids, states: meta.states, provinces, countries: meta.countries };
}