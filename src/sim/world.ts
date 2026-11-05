// Game logic types. This folder must not depend on Pixi or the DOM,
// so the same code can later run on a server for multiplayer.

export interface Country {
  id: number;
  name: string;
  color: [number, number, number];
  overlord: number | null; // country id this one is a colony/puppet of, if any
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
}

export interface World {
  width: number;
  height: number;
  ids: Uint16Array; // province id for every map pixel (0 = sea)
  states: State[]; // indexed by state id
  provinces: Province[]; // indexed by province id; index 0 is the sea pseudo-province
  countries: Country[]; // indexed by country id; index 0 is "Sea"
}