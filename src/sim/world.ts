// Game logic types. This folder must not depend on Pixi or the DOM,
// so the same code can later run on a server for multiplayer.

import type { TerrainType } from './terrain';

export interface Country {
  id: number;
  name: string;
  color: [number, number, number];
  overlord: number | null; // country id this one is a colony/puppet of, if any
  /** Bundled 1936 flag filename, assigned by the map loader. */
  flag?: string;
}

// A state groups several provinces (like in Hearts of Iron IV). Ownership is per province for now.
export interface State {
  id: number;
  name: string;
  owner: number; // country id
}

export interface Province {
  id: number;
  name: string;
  state: number; // index into World.states
  x: number; // representative point (map pixels)
  y: number;
  owner: number; // country id
  neighbors: number[]; // ids of land provinces that touch this one
  /** True when the province touches the sea; dockyards require a coastline. */
  coastal: boolean;
  /** Assigned by the map loader; drives building slots, cost and combat modifiers. */
  terrain: TerrainType;
}

export interface World {
  width: number;
  height: number;
  ids: Uint16Array; // province id for every map pixel (0 = sea)
  states: State[]; // indexed by state id
  provinces: Province[]; // indexed by province id; index 0 is the sea pseudo-province
  countries: Country[]; // indexed by country id; index 0 is "Sea"
}