import type { GameEventDef, TechCategory } from '../sim/content';

// Historical-flavoured world events. Dates are scenario dates; the first one fires a few months into
// the game so the player always sees the event system without looking for it.
export const EVENTS: GameEventDef[] = [
  {
    id: 'spanish_war',
    date: '1936-07-17',
    title: 'Civil War in Spain',
    category: 'World Affairs',
    body: 'A military rising against the Spanish Republic has succeeded in Morocco and is spreading to the mainland. Madrid appeals for volunteers and matériel; Rome and Berlin are already flying aircraft south. The peninsula is about to become a laboratory for the coming war.',
    options: [
      {
        label: 'Send volunteer formations',
        detail: 'Manpower -15,000 · War Support +3%',
        bundle: { manpower: -15000, warSupport: 0.03 },
      },
      {
        label: 'Offer medical and supply aid',
        detail: 'Treasury -60 · Stability +1%',
        bundle: { treasury: -60, stability: 0.01 },
      },
      {
        label: 'Stay out of it',
        detail: 'No cost · Stability +2%',
        bundle: { stability: 0.02 },
      },
    ],
  },
  {
    id: 'rhineland_crisis',
    date: '1936-03-07',
    title: 'The Rhineland Question',
    category: 'Europe',
    body: 'Columns of infantry have crossed the Rhine bridges into the demilitarised zone. Paris is demanding a response and London is counselling restraint. Whether this is a bluff or the opening move of a longer game is not yet clear.',
    options: [
      {
        label: 'Condemn and mobilise reserves',
        detail: 'War Support +4% · Stability -2%',
        bundle: { warSupport: 0.04, stability: -0.02 },
      },
      {
        label: 'Protest through diplomatic channels',
        detail: 'Political Power +20',
        bundle: { politicalPower: 20 },
      },
    ],
  },
  {
    id: 'olympic_games',
    date: '1936-08-01',
    title: 'The Berlin Olympics',
    category: 'Society',
    body: 'Athletes from forty-nine nations have assembled in Berlin. The games are a stage for prestige politics, and every foreign ministry is watching the stands as closely as the track.',
    options: [
      {
        label: 'Fund a lavish delegation',
        detail: 'Treasury -40 · Stability +2%',
        bundle: { treasury: -40, stability: 0.02 },
      },
      {
        label: 'Keep the delegation modest',
        detail: 'Treasury +15',
        bundle: { treasury: 15 },
      },
    ],
  },
  {
    id: 'rearmament_debate',
    date: '1936-11-12',
    title: 'The Rearmament Debate',
    category: 'Industry',
    body: 'The general staff has submitted a memorandum arguing that current procurement will not equip a modern field army before 1940. The finance ministry counters that the budget cannot absorb another expansion this year.',
    options: [
      {
        label: 'Approve emergency credits',
        detail: 'Military factories +2 · Treasury -240 · Stability -1%',
        bundle: { militaryFactories: 2, treasury: -240, stability: -0.01 },
      },
      {
        label: 'Hold the line on spending',
        detail: 'Treasury +120 · War Support -2%',
        bundle: { treasury: 120, warSupport: -0.02 },
      },
    ],
  },
  {
    id: 'saar_plebiscite',
    date: '1937-01-13',
    title: 'The Saar Settlement',
    category: 'Europe',
    body: 'The League of Nations has certified the result of the Saar basin settlement. Coal has changed hands, and with it a small but symbolically important piece of the post-war order.',
    options: [
      {
        label: 'Accept the settlement',
        detail: 'Stability +2% · Political Power +15',
        bundle: { stability: 0.02, politicalPower: 15 },
      },
    ],
  },
  {
    id: 'pacific_tension',
    date: '1937-07-07',
    title: 'Incident at the Marco Polo Bridge',
    category: 'Asia',
    body: 'A night skirmish outside Peking has escalated into a general engagement. Tokyo calls it a local matter; Nanking is ordering mobilisation. The Pacific has no room left for a diplomatic solution.',
    options: [
      {
        label: 'Reinforce the Asian station',
        detail: 'War Support +3% · Treasury -80',
        bundle: { warSupport: 0.03, treasury: -80 },
      },
      {
        label: 'Call for arbitration',
        detail: 'Stability +1% · Political Power +10',
        bundle: { stability: 0.01, politicalPower: 10 },
      },
    ],
  },
  {
    id: 'anschluss_crisis',
    date: '1938-03-12',
    title: 'The Austrian Crisis',
    category: 'Europe',
    body: 'Vienna has requested German assistance in restoring order. The constitutional question of Austrian sovereignty is now subordinate to the question of whether anyone will move troops to defend it.',
    options: [
      {
        label: 'Mobilise the frontier corps',
        detail: 'War Support +4% · Stability -3% · Manpower +20,000',
        bundle: { warSupport: 0.04, stability: -0.03, manpower: 20000 },
      },
      {
        label: 'Convene a great power conference',
        detail: 'Political Power +25 · Stability +2%',
        bundle: { politicalPower: 25, stability: 0.02 },
      },
    ],
  },
  {
    id: 'munich_conference',
    date: '1938-09-30',
    title: 'The Munich Conference',
    category: 'Europe',
    body: 'Four powers have signed an agreement on the transfer of the Sudeten districts. The Czech government was not invited. The word "peace in our time" is being used in London; the general staffs are using other words.',
    options: [
      {
        label: 'Honour the agreement',
        detail: 'Stability +3% · War Support -3%',
        bundle: { stability: 0.03, warSupport: -0.03 },
      },
      {
        label: 'Reject the settlement',
        detail: 'War Support +5% · Political Power -30',
        bundle: { warSupport: 0.05, politicalPower: -30 },
      },
    ],
  },
  {
    id: 'danzig_crisis',
    date: '1939-03-31',
    title: 'The Danzig Guarantee',
    category: 'Europe',
    body: 'London and Paris have issued a guarantee to Warsaw. The corridor question has become the hinge of European security, and every staff map now shows arrows pointing at the Vistula.',
    options: [
      {
        label: 'Stand by the guarantee',
        detail: 'War Support +5% · Treasury -100',
        bundle: { warSupport: 0.05, treasury: -100 },
      },
      {
        label: 'Seek a negotiated corridor settlement',
        detail: 'Political Power +30 · Stability +2%',
        bundle: { politicalPower: 30, stability: 0.02 },
      },
    ],
  },
  {
    id: 'steel_pact',
    date: '1939-05-22',
    title: 'The Pact of Steel',
    category: 'Diplomacy',
    body: 'Two governments have signed a formal military alliance pledging mutual support in the event of war. The signature has changed the arithmetic of every European general staff.',
    options: [
      {
        label: 'Ratify and publicise the alliance',
        detail: 'War Support +3% · Stability -1%',
        bundle: { warSupport: 0.03, stability: -0.01 },
      },
      {
        label: 'Ratify quietly',
        detail: 'Political Power +20',
        bundle: { politicalPower: 20 },
      },
    ],
  },
  {
    id: 'oil_embargo',
    date: '1940-07-26',
    title: 'The Export Control Act',
    category: 'Economy',
    body: 'A major supplier has placed aviation fuel, scrap steel and machine tools under licence. The ministry of economics is recalculating the industrial plan on the assumption that imports will fall by a third.',
    options: [
      {
        label: 'Ration industry and stockpile',
        detail: 'Stability -2% · Treasury +150',
        bundle: { stability: -0.02, treasury: 150 },
      },
      {
        label: 'Accelerate synthetic fuel plants',
        detail: 'Treasury -180 · Civilian factories -1',
        bundle: { treasury: -180, civilianFactories: -1 },
      },
    ],
  },
];

export const TECH_CATEGORY_LABELS: Record<TechCategory, string> = {
  infantry: 'Infantry',
  artillery: 'Artillery',
  armor: 'Armour',
  aviation: 'Aviation',
  naval: 'Naval',
  industry: 'Industry',
  electronics: 'Electronics',
  doctrine: 'Doctrines',
};

export const TECH_CATEGORY_ICONS: Record<TechCategory, string> = {
  infantry: 'rifle',
  artillery: 'artillery',
  armor: 'tank',
  aviation: 'fighter',
  naval: 'anchor',
  industry: 'factory',
  electronics: 'radio',
  doctrine: 'book',
};
