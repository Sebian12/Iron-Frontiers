import type { IdeologyId, RateBundle } from '../sim/content';

// Defaults for the countries that do not have an authored configuration file. Everything here is
// derived deterministically from the map data, so any of the 81 playable countries behaves
// consistently and the same UI works without hand-written content.

const IDEOLOGY_BY_NAME: Record<string, IdeologyId> = {
  Germany: 'fascism',
  Italy: 'fascism',
  Japan: 'fascism',
  Spain: 'authoritarian',
  Portugal: 'authoritarian',
  Hungary: 'authoritarian',
  Romania: 'authoritarian',
  Bulgaria: 'authoritarian',
  Austria: 'authoritarian',
  Greece: 'authoritarian',
  Poland: 'authoritarian',
  Yugoslavia: 'authoritarian',
  Albania: 'authoritarian',
  Turkey: 'neutrality',
  Switzerland: 'neutrality',
  Sweden: 'democratic',
  Norway: 'democratic',
  Denmark: 'democratic',
  Netherlands: 'democratic',
  Belgium: 'democratic',
  Luxembourg: 'democratic',
  Ireland: 'democratic',
  Finland: 'democratic',
  Czechoslovakia: 'democratic',
  France: 'democratic',
  'United Kingdom': 'democratic',
  'United States': 'democratic',
  Canada: 'democratic',
  Australia: 'democratic',
  'New Zealand': 'democratic',
  'South Africa': 'democratic',
  Mexico: 'authoritarian',
  Brazil: 'authoritarian',
  Argentina: 'authoritarian',
  Chile: 'authoritarian',
  Peru: 'authoritarian',
  Bolivia: 'authoritarian',
  Colombia: 'democratic',
  Venezuela: 'authoritarian',
  Cuba: 'authoritarian',
  'Soviet Union': 'communism',
  Mongolia: 'communism',
  'Xibei San Ma': 'authoritarian',
  Xinjiang: 'authoritarian',
  Tibet: 'monarchist',
  China: 'authoritarian',
  Yunnan: 'authoritarian',
  Guangxi: 'authoritarian',
  Shanxi: 'authoritarian',
  Mengjiang: 'authoritarian',
  Manchukuo: 'fascism',
  Siam: 'authoritarian',
  Iran: 'monarchist',
  Iraq: 'monarchist',
  Afghanistan: 'monarchist',
  Egypt: 'monarchist',
  Yemen: 'monarchist',
  'Saudi Arabia': 'monarchist',
  Ethiopia: 'monarchist',
  Liberia: 'democratic',
  Nepal: 'monarchist',
  Bhutan: 'monarchist',
  Oman: 'monarchist',
  Philippines: 'democratic',
  Iceland: 'democratic',
  'Dominican Republic': 'authoritarian',
  Haiti: 'authoritarian',
  Guatemala: 'authoritarian',
  Honduras: 'authoritarian',
  'El Salvador': 'authoritarian',
  Nicaragua: 'authoritarian',
  'Costa Rica': 'democratic',
  Panama: 'democratic',
  Ecuador: 'authoritarian',
  Paraguay: 'authoritarian',
  Uruguay: 'democratic',
  Lithuania: 'authoritarian',
  Latvia: 'authoritarian',
  Estonia: 'authoritarian',
  'Dutch East Indies': 'democratic',
};

const FACTION_BY_NAME: Record<string, string> = {
  Germany: 'Axis',
  Italy: 'Axis',
  Japan: 'Axis',
  Hungary: 'Axis',
  Romania: 'Axis',
  Bulgaria: 'Axis',
  Finland: 'Axis',
  Manchukuo: 'Axis',
  'United Kingdom': 'Allies',
  France: 'Allies',
  Poland: 'Allies',
  Australia: 'Allies',
  Canada: 'Allies',
  'New Zealand': 'Allies',
  'South Africa': 'Allies',
  'Soviet Union': 'Comintern',
  Mongolia: 'Comintern',
  'United States': 'Neutral Bloc',
};

/** Stable pseudo-random number in [0, 1) derived from a string. */
export function hash01(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

export function ideologyOf(name: string): IdeologyId {
  return IDEOLOGY_BY_NAME[name] ?? 'authoritarian';
}

export function factionOf(name: string): string | undefined {
  return FACTION_BY_NAME[name];
}

/** Relation score in [-100, 100]; same ideology and shared faction pull it up. */
export function relationBetween(
  fromName: string,
  fromIdeology: IdeologyId,
  fromFaction: string | undefined,
  toName: string,
  toIdeology: IdeologyId,
  toFaction: string | undefined,
): number {
  const base = Math.round(hash01(`${fromName}|${toName}`) * 40 - 18);
  const ideology = fromIdeology === toIdeology ? 26 : -14;
  const faction = fromFaction && fromFaction === toFaction ? 34 : 0;
  const rivalry = fromName === 'Soviet Union' && toName === 'Germany' ? -30 : 0;
  return Math.max(-100, Math.min(100, base + ideology + faction + rivalry));
}

/** Passive national modifiers used by countries without an authored definition. */
export function genericModifiers(name: string, ideology: IdeologyId): RateBundle {
  const stabilityDrift = ideology === 'democratic' ? 0.004 : ideology === 'communism' ? 0.002 : 0.001;
  return {
    stabilityDrift,
    ppPerDay: 0.05,
    researchSpeed: 0,
    constructionSpeed: hash01(name) > 0.6 ? 0.05 : 0,
  };
}

/** Number of land provinces a country holds, used to scale its generic industry. */
export function provinceCounts(provinces: { owner: number }[], countryId: number): number {
  let count = 0;
  for (const province of provinces) if (province.owner === countryId) count++;
  return count;
}
