import type { CountryDef, CountryPoliticalDef, FocusTreeDef, PoliticsContent } from '../../sim/content';
import { GOVERNMENTS } from './governments';
import { MECHANICS } from './mechanics';
import { TRANSITIONS } from './transitions';
import { POLITICAL_EVENTS } from './events';
import { COUNTRY_POLITICS, politicalConfigFor } from './countryPolitics';
import { augmentFocusTree } from './branches';

export { politicalConfigFor, COUNTRY_POLITICS };

export const POLITICS_CONTENT: PoliticsContent = {
  governments: GOVERNMENTS,
  mechanics: MECHANICS,
  transitions: TRANSITIONS,
  events: POLITICAL_EVENTS,
};

/** Attaches a country's political identity and its branch pack to the loaded focus tree. */
export function prepareCountryPolitics(def: CountryDef, tree: FocusTreeDef): { def: CountryDef; tree: FocusTreeDef; political: CountryPoliticalDef } {
  const political = politicalConfigFor(def);
  return {
    def: { ...def, political },
    tree: augmentFocusTree(tree, def, political),
    political,
  };
}
