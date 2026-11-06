// Data schema for the configuration files under src/data.
// This module is shared by the simulation and the UI and must stay free of DOM and Pixi imports,
// so a scenario can also be loaded and simulated outside the browser.

export type IdeologyId = 'fascism' | 'communism' | 'democratic' | 'neutrality' | 'monarchist' | 'authoritarian';

export type FocusCategory = 'political' | 'economic' | 'military' | 'diplomatic' | 'social' | 'unique';

export const FOCUS_CATEGORIES: { id: FocusCategory; name: string; icon: string }[] = [
  { id: 'political', name: 'Political', icon: 'gov' },
  { id: 'economic', name: 'Economic', icon: 'factory' },
  { id: 'military', name: 'Military', icon: 'swords' },
  { id: 'diplomatic', name: 'Diplomatic', icon: 'handshake' },
  { id: 'social', name: 'Social', icon: 'people' },
  { id: 'unique', name: 'National', icon: 'star' },
];

/** One-off changes applied instantly to the running totals. */
export interface EffectBundle {
  politicalPower?: number;
  stability?: number;
  warSupport?: number;
  manpower?: number;
  civilianFactories?: number;
  militaryFactories?: number;
  dockyards?: number;
  infrastructure?: number;
  treasury?: number;
}

/** Passive modifiers that feed the daily simulation. */
export interface RateBundle {
  ppPerDay?: number;
  researchSpeed?: number;
  constructionSpeed?: number;
  productionEfficiency?: number;
  factoryOutput?: number;
  manpowerPerDay?: number;
  warSupportDrift?: number;
  stabilityDrift?: number;
}

export type EffectKind = 'positive' | 'negative' | 'neutral';

export interface Effect {
  text: string;
  kind?: EffectKind;
  bundle?: EffectBundle;
  rates?: RateBundle;
}

export interface FocusDef {
  id: string;
  name: string;
  icon: string;
  category: FocusCategory;
  description: string;
  history?: string;
  days: number;
  cost?: number; // political power required to start
  requirements?: string[];
  prerequisites?: string[];
  mutuallyExclusive?: string[];
  effects: Effect[];
  consequences?: Effect[];
  x: number;
  y: number;
}

export interface FocusTreeDef {
  country: string;
  focuses: FocusDef[];
}

export interface IdeologyDef {
  id: IdeologyId;
  name: string;
  color: string;
  icon: string;
  description: string;
}

export interface TraitDef {
  name: string;
  description: string;
  icon?: string;
}

export interface LeaderDef {
  name: string;
  title: string;
  portrait: string; // seed for the procedurally drawn portrait
  biography: string;
  traits: TraitDef[];
}

export interface PartyDef {
  name: string;
  ideology: IdeologyId;
  popularity: number; // 0..1
  inGovernment: boolean;
  description?: string;
}

export interface AdvisorDef {
  id: string;
  name: string;
  position: string;
  slot: 'political' | 'staff' | 'intelligence' | 'theorist';
  ideology: IdeologyId;
  portrait: string;
  description: string;
  bonus: string;
  cost: number;
  bundle?: EffectBundle;
  rates?: RateBundle;
}

export interface ModifierDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  effect: string;
  kind: EffectKind;
  rates?: RateBundle;
}

export interface DecisionDef {
  id: string;
  name: string;
  icon: string;
  category: 'political' | 'economic' | 'military' | 'foreign';
  description: string;
  cost: number;
  cooldown: number; // days
  requirements: string[];
  effects: Effect[];
}

export interface TechDef {
  id: string;
  name: string;
  category: TechCategory;
  year: number;
  days: number;
  icon: string;
  description: string;
  requires: string[];
  bonuses: string[];
  unlocks: string[];
  x: number;
  y: number;
  rates?: RateBundle;
}

export type TechCategory =
  | 'infantry'
  | 'artillery'
  | 'armor'
  | 'aviation'
  | 'naval'
  | 'industry'
  | 'electronics'
  | 'doctrine';

export interface CountryResources {
  steel: number;
  oil: number;
  rubber: number;
  aluminium: number;
  tungsten: number;
  chromium: number;
}

export interface TradeDeal {
  country: string;
  resource: keyof CountryResources;
  amount: number;
  direction: 'import' | 'export';
}

export interface CommanderDef {
  name: string;
  rank: string;
  trait: string;
  attack: number;
  defense: number;
  planning: number;
  logistics: number;
  portrait: string;
}

export interface DivisionDef {
  name: string;
  template: string;
  type: 'infantry' | 'motorized' | 'armor' | 'cavalry' | 'marine' | 'mountaineer';
  experience: number;
  strength: number; // 0..1
  location: string;
}

export interface ArmyDef {
  commanders: CommanderDef[];
  divisions: DivisionDef[];
}

export interface CountryIndustry {
  civilianFactories: number;
  militaryFactories: number;
  dockyards: number;
  infrastructure: number; // 0..10 national average
  resources: CountryResources;
  trade: TradeDeal[];
}

export interface CountryStats {
  politicalPower: number;
  stability: number;
  warSupport: number;
  manpower: number;
  treasury: number;
  income: number;
  expenses: number;
}

export interface ArmyGroupDef {
  name: string;
  army: string;
}

export interface CountryDef {
  tag: string;
  name: string;
  mapNames: string[];
  accent: string;
  ideology: IdeologyId;
  faction?: string;
  leader: LeaderDef;
  coalition?: string;
  legitimacy?: number;
  parties: PartyDef[];
  advisors: AdvisorDef[];
  modifiers: ModifierDef[];
  decisions: DecisionDef[];
  stats: CountryStats;
  industry: CountryIndustry;
  army: ArmyDef;
  researchSlots: number;
  focusTree: string;
  agency?: { name: string; description: string };
}

export interface GameEventOption {
  label: string;
  detail?: string;
  bundle?: EffectBundle;
  rates?: RateBundle;
  stabilityRisk?: number;
}

export interface GameEventDef {
  id: string;
  date: string; // YYYY-MM-DD
  tag?: string; // only fires for this country tag, empty for world events
  title: string;
  category: string;
  body: string;
  options: GameEventOption[];
}

export interface ContentBundle {
  def: CountryDef;
  tree: FocusTreeDef;
  ideologies: Record<string, IdeologyDef>;
  technologies: TechDef[];
  events: GameEventDef[];
}
