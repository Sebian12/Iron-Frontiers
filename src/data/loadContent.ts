import type { ContentBundle, CountryDef, FocusTreeDef, IdeologyDef, TechDef } from '../sim/content';
import type { World } from '../sim/world';
import germany from './countries/germany.json';
import sovietUnion from './countries/soviet-union.json';
import unitedKingdom from './countries/united-kingdom.json';
import germanyTree from './focus-trees/germany.json';
import sovietUnionTree from './focus-trees/soviet-union.json';
import unitedKingdomTree from './focus-trees/united-kingdom.json';
import genericTree from './focus-trees/generic.json';
import ideologyData from './ideologies.json';
import technologyData from './technologies.json';
import { EVENTS } from './events';
import { createGenericCountry } from './genericCountry';
import { ideologyOf } from './geopolitics';

// Loads a playable country: its authored configuration when one exists, otherwise a deterministic
// generic country. Every tree is validated so a typo in a configuration file cannot break the UI:
// unknown prerequisite/exclusivity ids are dropped with a warning, duplicate ids are removed.

const COUNTRY_DEFS = [germany, sovietUnion, unitedKingdom] as unknown as CountryDef[];
const TREES: Record<string, FocusTreeDef> = {
  germany: germanyTree as unknown as FocusTreeDef,
  'soviet-union': sovietUnionTree as unknown as FocusTreeDef,
  'united-kingdom': unitedKingdomTree as unknown as FocusTreeDef,
  generic: genericTree as unknown as FocusTreeDef,
};
const IDEOLOGIES = ideologyData as unknown as IdeologyDef[];
const TECHNOLOGIES = technologyData as unknown as TechDef[];

const ideologyIndex: Record<string, IdeologyDef> = Object.fromEntries(IDEOLOGIES.map((entry) => [entry.id, entry]));

export function ideologies(): IdeologyDef[] {
  return IDEOLOGIES;
}

export function technologies(): TechDef[] {
  return TECHNOLOGIES;
}

export function technologyIndex(): Map<string, TechDef> {
  return new Map(TECHNOLOGIES.map((tech) => [tech.id, tech]));
}

/** Country definitions authored as JSON files, used by the country picker for previews. */
export function authoredCountries(): CountryDef[] {
  return COUNTRY_DEFS;
}

function sanitiseTree(tree: FocusTreeDef, label: string): FocusTreeDef {
  const seen = new Set<string>();
  const focuses = tree.focuses.filter((focus) => {
    if (!focus.id || seen.has(focus.id)) {
      console.warn(`[focus:${label}] duplicate or empty focus id skipped:`, focus.id);
      return false;
    }
    seen.add(focus.id);
    return true;
  });
  for (const focus of focuses) {
    focus.prerequisites = (focus.prerequisites ?? []).filter((id) => seen.has(id));
    focus.mutuallyExclusive = (focus.mutuallyExclusive ?? []).filter((id) => seen.has(id));
    if (!Array.isArray(focus.effects)) focus.effects = [];
    if (!Array.isArray(focus.consequences)) focus.consequences = [];
  }
  return { country: tree.country, focuses };
}

function provincesOf(world: World, countryId: number): number {
  let count = 0;
  for (const province of world.provinces) if (province.owner === countryId) count++;
  return count;
}

export function loadContent(world: World, countryId: number): ContentBundle {
  const mapCountry = world.countries[countryId];
  if (!mapCountry) throw new Error(`Unknown country id ${countryId}`);

  const authored = COUNTRY_DEFS.find((def) => def.mapNames.includes(mapCountry.name));
  const overlordName = mapCountry.overlord !== null ? world.countries[mapCountry.overlord]?.name : undefined;
  const def = authored ?? createGenericCountry(mapCountry, provincesOf(world, countryId), overlordName);

  const treeKey = def.focusTree in TREES ? def.focusTree : 'generic';
  const tree = sanitiseTree(
    structuredClone(TREES[treeKey]),
    authored ? def.name : `${def.name} (generic)`,
  );

  // A country with no authored tree still gets a national identity through its ideology.
  if (!authored) {
    tree.country = def.name;
  }

  return {
    def,
    tree,
    ideologies: ideologyIndex,
    technologies: TECHNOLOGIES,
    events: [...EVENTS].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function ideologyLabel(id: string): string {
  return ideologyIndex[id]?.name ?? id;
}

export function findFocus(tree: FocusTreeDef, id: string) {
  return tree.focuses.find((focus) => focus.id === id);
}

export function treeBounds(tree: FocusTreeDef): { maxX: number; maxY: number } {
  let maxX = 0;
  let maxY = 0;
  for (const focus of tree.focuses) {
    if (focus.x > maxX) maxX = focus.x;
    if (focus.y > maxY) maxY = focus.y;
  }
  return { maxX, maxY };
}

export function defaultIdeology(): IdeologyDef {
  return ideologyIndex[ideologyOf('Unclaimed')] ?? IDEOLOGIES[0];
}
