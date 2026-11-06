import type {
  AdvisorDef,
  ArmyDef,
  CountryDef,
  CountryIndustry,
  DecisionDef,
  IdeologyId,
  LeaderDef,
  ModifierDef,
  PartyDef,
} from '../sim/content';
import { factionOf, hash01, ideologyOf } from './geopolitics';

// Builds a complete country definition for nations without an authored JSON file. Values are
// deterministic and scale with the number of land provinces the country holds, so all 81 playable
// countries work with the same UI and simulation.

const FIRST_NAMES = ['Adrian', 'Béla', 'Carlos', 'Dmitri', 'Elias', 'Ferenc', 'Gustav', 'Hassan', 'Ivo', 'Jan', 'Karel', 'Luis', 'Marek', 'Nikola', 'Osman', 'Pavel', 'Quentin', 'Rafael', 'Stefan', 'Tomas', 'Ulf', 'Viktor', 'Willem', 'Yusuf', 'Zoltán'];
const LAST_NAMES = ['Adler', 'Bauer', 'Costa', 'Dvořák', 'Eriksen', 'Fischer', 'Grant', 'Hansen', 'Ivanov', 'Jansen', 'Kowalski', 'Lindqvist', 'Moreau', 'Novak', 'Olsen', 'Petrov', 'Quist', 'Reyes', 'Silva', 'Tóth', 'Ulrich', 'Varga', 'Weber', 'Yilmaz', 'Zeman'];

const PARTY_BY_IDEOLOGY: Record<IdeologyId, string> = {
  fascism: 'National Front',
  communism: 'Workers’ Party',
  democratic: 'Liberal Coalition',
  neutrality: 'Union of Independents',
  monarchist: 'Crown Loyalists',
  authoritarian: 'National Assembly',
};

const OPPOSITION: IdeologyId[] = ['democratic', 'communism', 'neutrality'];

const TITLE_BY_IDEOLOGY: Record<IdeologyId, string> = {
  fascism: 'Head of Government',
  communism: 'General Secretary',
  democratic: 'Prime Minister',
  neutrality: 'President of the Council',
  monarchist: 'Prime Minister',
  authoritarian: 'President',
};

function personName(seed: string): string {
  const first = FIRST_NAMES[Math.floor(hash01(`${seed}-first`) * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(hash01(`${seed}-last`) * LAST_NAMES.length)];
  return `${first} ${last}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function tagOf(name: string): string {
  const letters = name.replace(/[^A-Za-z]/g, '').toUpperCase();
  return (letters.slice(0, 3) || 'GEN').padEnd(3, 'X');
}

function accentOf(color: [number, number, number]): string {
  const [r, g, b] = color;
  return `rgb(${Math.round(r * 0.72)}, ${Math.round(g * 0.72)}, ${Math.round(b * 0.72)})`;
}

export function createGenericCountry(country: { id: number; name: string; color: [number, number, number] }, provinceCount: number, overlordName?: string): CountryDef {
  const ideology = ideologyOf(country.name);
  const seed = country.name;
  const leaderName = personName(seed);
  const provinces = Math.max(1, provinceCount);
  const scale = clamp(provinces, 2, 900);

  const civilianFactories = Math.round(clamp(3 + scale / 11, 3, 34));
  const militaryFactories = Math.round(clamp(1 + scale / 32, 1, 16));
  const dockyards = Math.round(clamp(scale / 90, 0, 10));
  const manpower = Math.round(40000 + scale * 5200);
  const stability = clamp(0.42 + hash01(`${seed}-stability`) * 0.3, 0.25, 0.82);
  const warSupport = clamp(0.18 + hash01(`${seed}-war`) * 0.35, 0.1, 0.7);

  const governing: PartyDef = {
    name: PARTY_BY_IDEOLOGY[ideology],
    ideology,
    popularity: 0.5,
    inGovernment: true,
    description: 'The governing organisation, drawing support from the state administration and the officer corps.',
  };
  const others: PartyDef[] = OPPOSITION.filter((entry) => entry !== ideology)
    .slice(0, 3)
    .map((entry, index) => ({
      name: PARTY_BY_IDEOLOGY[entry],
      ideology: entry,
      popularity: index === 0 ? 0.24 : index === 1 ? 0.16 : 0.1,
      inGovernment: false,
      description: 'An opposition grouping with a parliamentary or clandestine presence, depending on the season.',
    }));
  const total = governing.popularity + others.reduce((sum, party) => sum + party.popularity, 0);
  const parties = [governing, ...others].map((party) => ({ ...party, popularity: party.popularity / total }));

  const leader: LeaderDef = {
    name: leaderName,
    title: TITLE_BY_IDEOLOGY[ideology],
    portrait: seed,
    biography: `${leaderName} has led the government since the early 1930s, balancing a small industrial base, an exposed frontier and the demands of the great powers.`,
    traits: [
      { name: 'Careful Financier', description: '+4% construction speed.', icon: 'coin' },
      { name: 'Regional Player', description: 'Diplomatic options are limited to the immediate neighbourhood.', icon: 'map' },
    ],
  };

  const advisors: AdvisorDef[] = [
    {
      id: `${tagOf(seed)}_adv_political`.toLowerCase(),
      name: personName(`${seed}-political`),
      position: 'Political Advisor',
      slot: 'political',
      ideology,
      portrait: `${seed}-political`,
      description: 'A veteran of the governing party with a talent for keeping the cabinet together.',
      bonus: '+0.1 political power per day',
      cost: 80,
      rates: { ppPerDay: 0.1 },
    },
    {
      id: `${tagOf(seed)}_adv_staff`.toLowerCase(),
      name: personName(`${seed}-staff`),
      position: 'Chief of the General Staff',
      slot: 'staff',
      ideology,
      portrait: `${seed}-staff`,
      description: 'A staff officer focused on mobilisation schedules and frontier defence.',
      bonus: '+8% construction speed',
      cost: 100,
      rates: { constructionSpeed: 0.08 },
    },
    {
      id: `${tagOf(seed)}_adv_intel`.toLowerCase(),
      name: personName(`${seed}-intel`),
      position: 'Head of Intelligence',
      slot: 'intelligence',
      ideology: 'authoritarian',
      portrait: `${seed}-intel`,
      description: 'Runs a small but effective foreign intelligence section from the capital.',
      bonus: '+1 operative slot, +5% decryption',
      cost: 85,
      rates: { researchSpeed: 0.02 },
    },
    {
      id: `${tagOf(seed)}_adv_theorist`.toLowerCase(),
      name: personName(`${seed}-theorist`),
      position: 'Military Theorist',
      slot: 'theorist',
      ideology,
      portrait: `${seed}-theorist`,
      description: 'A lecturer at the war academy who writes on supply, terrain and the lessons of the last war.',
      bonus: '+5% research speed',
      cost: 70,
      rates: { researchSpeed: 0.05 },
    },
  ];

  const modifiers: ModifierDef[] = [
    {
      id: `${tagOf(seed)}_mod_industry`.toLowerCase(),
      name: 'Limited Industrial Base',
      icon: 'factory',
      description: 'A handful of plants supply the whole army. Every expansion must be imported or built from scratch.',
      effect: '-3% factory output',
      kind: 'negative',
      rates: { factoryOutput: -0.03 },
    },
    {
      id: `${tagOf(seed)}_mod_frontier`.toLowerCase(),
      name: 'Exposed Frontier',
      icon: 'shield',
      description: 'The most valuable provinces sit within a day’s march of a foreign army.',
      effect: '+0.01 stability per day',
      kind: 'neutral',
      rates: { stabilityDrift: 0.01 },
    },
  ];

  const decisions: DecisionDef[] = [
    {
      id: `${tagOf(seed)}_dec_industry`.toLowerCase(),
      name: 'National Development Fund',
      icon: 'coin',
      category: 'economic',
      description: 'Use the state treasury to finance a round of industrial expansion in the capital region.',
      cost: 70,
      cooldown: 260,
      requirements: ['Treasury above 200'],
      effects: [
        { text: 'Civilian factory +1', kind: 'positive', bundle: { civilianFactories: 1 } },
        { text: 'Treasury -120', kind: 'negative', bundle: { treasury: -120 } },
      ],
    },
    {
      id: `${tagOf(seed)}_dec_army`.toLowerCase(),
      name: 'Call Up the Reserve',
      icon: 'helmet',
      category: 'military',
      description: 'Bring the first-line reserve onto active duty for a training cycle.',
      cost: 50,
      cooldown: 180,
      requirements: ['War support above 20%'],
      effects: [
        { text: 'Manpower +35,000', kind: 'positive', bundle: { manpower: 35000 } },
        { text: 'War support +2%', kind: 'positive', bundle: { warSupport: 0.02 } },
      ],
    },
    {
      id: `${tagOf(seed)}_dec_goodwill`.toLowerCase(),
      name: 'Regional Goodwill Tour',
      icon: 'handshake',
      category: 'foreign',
      description: 'A tour of the neighbouring capitals, with trade offers and cultural attachés in tow.',
      cost: 45,
      cooldown: 240,
      requirements: ['Political power 45'],
      effects: [
        { text: 'Political power +20', kind: 'positive', bundle: { politicalPower: 20 } },
        { text: 'Stability +2%', kind: 'positive', bundle: { stability: 0.02 } },
      ],
    },
  ];

  const industry: CountryIndustry = {
    civilianFactories,
    militaryFactories,
    dockyards,
    infrastructure: Math.round(clamp(2 + scale / 120, 2, 8)),
    resources: {
      steel: Math.round(20 + scale * 1.4),
      oil: Math.round(2 + hash01(`${seed}-oil`) * 60),
      rubber: Math.round(4 + hash01(`${seed}-rubber`) * 40),
      aluminium: Math.round(8 + hash01(`${seed}-alu`) * 28),
      tungsten: Math.round(2 + hash01(`${seed}-tung`) * 16),
      chromium: Math.round(hash01(`${seed}-chrome`) * 12),
    },
    trade: [],
  };

  const templates: { type: ArmyDef['divisions'][number]['type']; name: string; template: string }[] = [
    { type: 'infantry', name: 'Infantry Division', template: 'Infantry Division' },
    { type: 'infantry', name: 'Infantry Division', template: 'Infantry Division' },
    { type: 'infantry', name: 'Infantry Division', template: 'Infantry Division' },
    { type: 'cavalry', name: 'Cavalry Brigade', template: 'Cavalry Brigade' },
    { type: 'motorized', name: 'Motorised Brigade', template: 'Motorised Brigade' },
  ];
  const divisionCount = Math.round(clamp(2 + scale / 70, 2, 10));
  const divisions: ArmyDef['divisions'] = Array.from({ length: divisionCount }, (_, index) => {
    const template = templates[index % templates.length];
    return {
      name: `${index + 1}. ${template.name}`,
      template: template.template,
      type: template.type,
      experience: Math.round((0.08 + hash01(`${seed}-${index}-xp`) * 0.2) * 100) / 100,
      strength: Math.round((0.78 + hash01(`${seed}-${index}-str`) * 0.18) * 100) / 100,
      location: country.name,
    };
  });

  const army: ArmyDef = {
    commanders: [
      {
        name: `General ${personName(`${seed}-general`)}`,
        rank: 'General',
        trait: 'Infantry Leader',
        attack: 3,
        defense: 4,
        planning: 3,
        logistics: 3,
        portrait: `${seed}-general`,
      },
      {
        name: `Colonel ${personName(`${seed}-colonel`)}`,
        rank: 'Colonel',
        trait: 'Organiser',
        attack: 2,
        defense: 3,
        planning: 3,
        logistics: 4,
        portrait: `${seed}-colonel`,
      },
    ],
    divisions,
  };

  const faction = factionOf(country.name);

  return {
    tag: tagOf(country.name),
    name: country.name,
    mapNames: [country.name],
    accent: accentOf(country.color),
    ideology,
    faction,
    leader,
    coalition: overlordName ? `Government in exile of the ${overlordName} administration` : PARTY_BY_IDEOLOGY[ideology],
    legitimacy: clamp(0.52 + hash01(`${seed}-legit`) * 0.3, 0.4, 0.85),
    parties,
    advisors,
    modifiers,
    decisions,
    stats: {
      politicalPower: 65,
      stability,
      warSupport,
      manpower,
      treasury: Math.round(320 + scale * 18),
      income: Math.round(12 + civilianFactories * 1.7),
      expenses: Math.round(9 + militaryFactories * 2.4 + dockyards * 1.8),
    },
    industry,
    army,
    researchSlots: scale > 120 ? 3 : 2,
    focusTree: 'generic',
    agency: {
      name: `${country.name} Intelligence Bureau`,
      description: 'A compact foreign intelligence service with stations in the neighbouring capitals.',
    },
  };
}
