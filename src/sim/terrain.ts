// Terrain is a province property, not a map decoration. It sets the base number of building
// slots, makes construction more or less expensive and gives the defending division a set of
// combat modifiers. The map file has no terrain layer, so the type is assigned deterministically
// from the province name/id and the country it belongs to.

export type TerrainType =
  | 'plains'
  | 'farmland'
  | 'forest'
  | 'hills'
  | 'mountains'
  | 'marsh'
  | 'desert'
  | 'jungle'
  | 'tundra'
  | 'urban';

export interface TerrainDef {
  id: TerrainType;
  name: string;
  icon: string;
  description: string;
  /** Building slots before infrastructure is added. */
  baseSlots: number;
  /** Multiplier applied to a building's industrial cost. */
  buildCost: number;
  /** Percentage modifier to a division fighting in this terrain. */
  defence: number;
  attack: number;
  supply: number;
}

export const TERRAIN_TYPES: TerrainDef[] = [
  {
    id: 'plains',
    name: 'Plains',
    icon: 'map',
    description: 'Open ground with room for industry, roads and large formations.',
    baseSlots: 6,
    buildCost: 1,
    defence: -10,
    attack: 5,
    supply: 10,
  },
  {
    id: 'farmland',
    name: 'Farmland',
    icon: 'wheat',
    description: 'Settled and cultivated country; good supply, but little natural cover.',
    baseSlots: 6,
    buildCost: 1,
    defence: -5,
    attack: 0,
    supply: 15,
  },
  {
    id: 'forest',
    name: 'Forest',
    icon: 'tree',
    description: 'Dense woodland that shelters defenders and slows large-scale construction.',
    baseSlots: 4,
    buildCost: 1.15,
    defence: 15,
    attack: -10,
    supply: -10,
  },
  {
    id: 'hills',
    name: 'Hills',
    icon: 'mountain',
    description: 'Rising ground that favours defence and complicates logistics.',
    baseSlots: 4,
    buildCost: 1.25,
    defence: 20,
    attack: -5,
    supply: -5,
  },
  {
    id: 'mountains',
    name: 'Mountains',
    icon: 'mountain',
    description: 'A hard country to build in, and an even harder one to attack.',
    baseSlots: 2,
    buildCost: 1.5,
    defence: 35,
    attack: -20,
    supply: -25,
  },
  {
    id: 'marsh',
    name: 'Marsh',
    icon: 'water',
    description: 'Waterlogged ground; roads and foundations are expensive and supply is poor.',
    baseSlots: 3,
    buildCost: 1.35,
    defence: 10,
    attack: -25,
    supply: -20,
  },
  {
    id: 'desert',
    name: 'Desert',
    icon: 'sun',
    description: 'Sparse, exposed country where water and transport are the real limits.',
    baseSlots: 3,
    buildCost: 1.2,
    defence: -5,
    attack: -10,
    supply: -25,
  },
  {
    id: 'jungle',
    name: 'Jungle',
    icon: 'palm',
    description: 'Close, humid terrain that swallows supply columns and artillery.',
    baseSlots: 3,
    buildCost: 1.4,
    defence: 10,
    attack: -15,
    supply: -20,
  },
  {
    id: 'tundra',
    name: 'Tundra',
    icon: 'snow',
    description: 'Frozen ground with a short building season and thin infrastructure.',
    baseSlots: 3,
    buildCost: 1.2,
    defence: 5,
    attack: -5,
    supply: -20,
  },
  {
    id: 'urban',
    name: 'Urban',
    icon: 'city',
    description: 'Dense cities offer factories, labour and cover, but little room to expand.',
    baseSlots: 7,
    buildCost: 1.1,
    defence: 25,
    attack: -5,
    supply: 20,
  },
];

export const TERRAIN_BY_ID: Record<TerrainType, TerrainDef> = Object.fromEntries(
  TERRAIN_TYPES.map((terrain) => [terrain.id, terrain]),
) as Record<TerrainType, TerrainDef>;

export function terrainDef(id: TerrainType | undefined): TerrainDef {
  return (id && TERRAIN_BY_ID[id]) || TERRAIN_BY_ID.plains;
}

export interface TerrainInput {
  id: number;
  name: string;
  x: number;
  y: number;
}

/** Small deterministic hash used by the map loader and province growth simulation. */
export function hash01(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

const COUNTRY_TERRAIN: { match: RegExp; pool: TerrainType[] }[] = [
  {
    match: /switzerland|austria|nepal|bhutan|tibet|afghanistan|bolivia|peru|ecuador|chile|norway/i,
    pool: ['mountains', 'mountains', 'hills', 'forest'],
  },
  {
    match: /netherlands|belgium|denmark|bangladesh/i,
    pool: ['marsh', 'farmland', 'plains', 'farmland'],
  },
  {
    match: /egypt|libya|algeria|morocco|tunisia|saudi|iraq|iran|syria|jordan|israel/i,
    pool: ['desert', 'desert', 'plains', 'hills'],
  },
  {
    match: /brazil|colombia|venezuela|indonesia|malaya|burma|thailand|vietnam|congo|liberia/i,
    pool: ['jungle', 'jungle', 'forest', 'farmland'],
  },
  {
    match: /finland|sweden|iceland|greenland/i,
    pool: ['tundra', 'forest', 'tundra', 'plains'],
  },
  {
    match: /italy|greece|turkey|romania|bulgaria|yugoslavia|spain|portugal/i,
    pool: ['hills', 'farmland', 'mountains', 'forest', 'plains'],
  },
  {
    match: /united kingdom|ireland|france|germany|poland|czechoslovakia|hungary/i,
    pool: ['farmland', 'plains', 'forest', 'hills', 'urban'],
  },
  {
    match: /india|pakistan/i,
    pool: ['farmland', 'jungle', 'plains', 'hills'],
  },
  {
    match: /china|japan|korea|manchuria|mengjiang/i,
    pool: ['farmland', 'forest', 'hills', 'plains', 'urban'],
  },
  {
    match: /united states|usa/i,
    pool: ['plains', 'farmland', 'forest', 'hills', 'urban'],
  },
  {
    match: /australia|new zealand/i,
    pool: ['desert', 'plains', 'farmland', 'hills'],
  },
  {
    match: /mexico|argentina|uruguay|south africa/i,
    pool: ['plains', 'farmland', 'hills', 'desert'],
  },
  {
    match: /soviet union|russia/i,
    pool: ['plains', 'forest', 'farmland', 'tundra', 'marsh'],
  },
];

function pickTerrain(pool: TerrainType[], seed: string): TerrainType {
  return pool[Math.floor(hash01(seed) * pool.length)] ?? 'plains';
}

function latitudeTerrain(province: TerrainInput, seed: string): TerrainType {
  const latitude = Math.max(0, Math.min(1, province.y / 2222));
  if (latitude < 0.12) return pickTerrain(['tundra', 'forest', 'plains'], seed);
  if (latitude < 0.3) return pickTerrain(['forest', 'plains', 'farmland'], seed);
  if (latitude < 0.48) return pickTerrain(['farmland', 'plains', 'forest', 'hills'], seed);
  if (latitude < 0.62) return pickTerrain(['desert', 'plains', 'hills', 'farmland'], seed);
  if (latitude < 0.78) return pickTerrain(['jungle', 'forest', 'farmland', 'plains'], seed);
  return pickTerrain(['forest', 'plains', 'farmland', 'hills'], seed);
}

/** Assigns a stable terrain type without depending on the order provinces are loaded. */
export function terrainForProvince(province: TerrainInput, countryName: string): TerrainType {
  const seed = `${province.id}-${province.name}-${countryName}`;
  const profile = COUNTRY_TERRAIN.find((entry) => entry.match.test(countryName));
  let terrain = profile ? pickTerrain(profile.pool, seed) : latitudeTerrain(province, seed);

  // Cities are rare, but they make a province a natural industrial centre. Only countries with
  // an established urban tradition get them from the profile above.
  if (terrain === 'farmland' && hash01(`${seed}-city`) < 0.08) terrain = 'urban';
  return terrain;
}
