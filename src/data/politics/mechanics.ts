import type { PoliticalMechanicDef } from '../../sim/content';

// Optional national mechanics. A country only gets the mechanic named in its political definition,
// so a monarchy is not forced to manage parliamentary factions and a federation is not given a crown.

export const MECHANICS: PoliticalMechanicDef[] = [
  {
    id: 'parliamentary_influence',
    name: 'Parliamentary Influence',
    description: 'The government\'s ability to carry votes, hold a coalition together and survive confidence motions.',
    icon: 'ballot',
    valueLabel: 'Parliamentary influence',
    actions: [
      {
        id: 'convene_parliament',
        name: 'Convene Parliament',
        description: 'Open a special session, trade committee seats for support and force the chamber to register its mood.',
        cost: 10,
        effects: [
          { text: 'Parliamentary influence +5', kind: 'positive', political: { mechanicValue: 5 } },
          { text: 'Legitimacy +1%', kind: 'positive', political: { legitimacy: 0.01 } },
        ],
      },
      {
        id: 'coalition_talks',
        name: 'Coalition Talks',
        description: 'Buy off a wavering parliamentary group with offices and a programme review.',
        cost: 15,
        effects: [
          { text: 'Parliamentary influence +3', kind: 'positive', political: { mechanicValue: 3 } },
          { text: 'Stability +2%', kind: 'positive', bundle: { stability: 0.02 } },
          { text: 'Political tension +2', kind: 'negative', political: { tension: 2 } },
        ],
      },
      {
        id: 'snap_election',
        name: 'Prepare a Snap Election',
        description: 'Put the government\'s record before the electorate and hope the chamber is not listening to the street.',
        cost: 25,
        effects: [
          { text: 'Legitimacy +4% when the result is respected', kind: 'positive', political: { legitimacy: 0.04, flags: ['election_mandate'] } },
          { text: 'Stability -1%', kind: 'negative', bundle: { stability: -0.01 } },
          { text: 'Parliamentary influence -4', kind: 'negative', political: { mechanicValue: -4 } },
        ],
      },
    ],
  },
  {
    id: 'royal_legitimacy',
    name: 'Royal Legitimacy',
    description: 'The crown\'s standing with the army, the church, the court and the public. It buys obedience, but cannot be replenished by decree alone.',
    icon: 'crown',
    valueLabel: 'Royal legitimacy',
    actions: [
      {
        id: 'royal_tour',
        name: 'Royal Tour',
        description: 'A progress through the provinces: ribbons, receptions and carefully staged crowds.',
        cost: 10,
        effects: [
          { text: 'Royal legitimacy +5', kind: 'positive', political: { mechanicValue: 5 } },
          { text: 'Stability +1%', kind: 'positive', bundle: { stability: 0.01 } },
        ],
      },
      {
        id: 'court_the_officers',
        name: 'Court the Officers',
        description: 'Promote loyal commanders and remind the general staff where its commissions come from.',
        cost: 15,
        effects: [
          { text: 'Royal legitimacy +4', kind: 'positive', political: { mechanicValue: 4 } },
          { text: 'Government loyalty +4', kind: 'positive', political: { governmentLoyalty: 4 } },
          { text: 'Political tension +2', kind: 'negative', political: { tension: 2 } },
        ],
      },
      {
        id: 'royal_dissolution',
        name: 'Dissolve the Chamber',
        description: 'Gold, ermine and a royal decree. The chamber is sent home before it can vote on its own survival.',
        cost: 20,
        effects: [
          { text: 'Royal legitimacy +6', kind: 'positive', political: { mechanicValue: 6 } },
          { text: 'Legitimacy -5%', kind: 'negative', political: { legitimacy: -0.05 } },
          { text: 'Political tension +6', kind: 'negative', political: { tension: 6 } },
        ],
      },
    ],
  },
  {
    id: 'regional_autonomy',
    name: 'Regional Autonomy',
    description: 'The centre\'s ability to make regional governments carry out national policy without provoking a federal crisis.',
    icon: 'map',
    valueLabel: 'Federal authority',
    actions: [
      {
        id: 'regional_grants',
        name: 'Regional Development Grants',
        description: 'Money for roads, schools and regional patronage, distributed through the federal chamber.',
        cost: 10,
        effects: [
          { text: 'Federal authority +5', kind: 'positive', political: { mechanicValue: 5 } },
          { text: 'Treasury -40', kind: 'negative', bundle: { treasury: -40 } },
        ],
      },
      {
        id: 'federal_conference',
        name: 'Federal Conference',
        description: 'Bring the regional premiers to the capital and negotiate a common programme.',
        cost: 12,
        effects: [
          { text: 'Federal authority +3', kind: 'positive', political: { mechanicValue: 3 } },
          { text: 'Stability +2%', kind: 'positive', bundle: { stability: 0.02 } },
        ],
      },
      {
        id: 'centralise_administration',
        name: 'Centralise Administration',
        description: 'Replace regional commissioners with officials appointed from the capital.',
        cost: 18,
        effects: [
          { text: 'Federal authority +4', kind: 'positive', political: { mechanicValue: 4 } },
          { text: 'Stability -2%', kind: 'negative', bundle: { stability: -0.02 } },
          { text: 'Political tension +5', kind: 'negative', political: { tension: 5 } },
        ],
      },
    ],
  },
  {
    id: 'revolutionary_support',
    name: 'Revolutionary Support',
    description: 'The breadth of the movement beyond the party: factory committees, soldiers\' councils, rural networks and the streets.',
    icon: 'flame',
    valueLabel: 'Revolutionary support',
    actions: [
      {
        id: 'mobilise_cells',
        name: 'Mobilise Factory Cells',
        description: 'Send organisers into the great plants and put the movement\'s case to the night shift.',
        cost: 10,
        effects: [
          { text: 'Revolutionary support +5', kind: 'positive', political: { revolutionSupport: 5 } },
          { text: 'Revolutionary organisation +2', kind: 'positive', political: { revolutionOrganization: 2 } },
        ],
      },
      {
        id: 'revolutionary_press',
        name: 'Distribute the Revolutionary Press',
        description: 'Print more than the censors can count and let the pamphlets do the recruiting.',
        cost: 12,
        effects: [
          { text: 'Revolutionary support +3', kind: 'positive', political: { revolutionSupport: 3 } },
          { text: 'Political tension +3', kind: 'negative', political: { tension: 3 } },
        ],
      },
      {
        id: 'internal_purge',
        name: 'Purge the Apparatus',
        description: 'Expel the waverers before they can bargain with the government.',
        cost: 18,
        effects: [
          { text: 'Government loyalty +6', kind: 'positive', political: { governmentLoyalty: 6 } },
          { text: 'Revolutionary support -4', kind: 'negative', political: { revolutionSupport: -4 } },
          { text: 'Political tension +4', kind: 'negative', political: { tension: 4 } },
        ],
      },
    ],
  },
  {
    id: 'council_authority',
    name: 'Council Authority',
    description: 'The executive\'s grip on the security services, the officer corps and the machinery of government.',
    icon: 'gov',
    valueLabel: 'Council authority',
    actions: [
      {
        id: 'convene_council',
        name: 'Convene the National Council',
        description: 'Summon the loyal notables, ratify the programme and demonstrate that the regime still commands a majority.',
        cost: 10,
        effects: [
          { text: 'Council authority +5', kind: 'positive', political: { mechanicValue: 5 } },
          { text: 'Stability +1%', kind: 'positive', bundle: { stability: 0.01 } },
        ],
      },
      {
        id: 'emergency_decree',
        name: 'Emergency Decree',
        description: 'Rule by decree for a season. Efficient, legal enough, and a gift to every opponent of the regime.',
        cost: 15,
        effects: [
          { text: 'Council authority +6', kind: 'positive', political: { mechanicValue: 6 } },
          { text: 'Legitimacy -2%', kind: 'negative', political: { legitimacy: -0.02 } },
          { text: 'Political tension +3', kind: 'negative', political: { tension: 3 } },
        ],
      },
      {
        id: 'security_sweep',
        name: 'Security Sweep',
        description: 'Close the opposition clubs, arrest the organisers and publicise the evidence.',
        cost: 20,
        effects: [
          { text: 'Council authority +4', kind: 'positive', political: { mechanicValue: 4 } },
          { text: 'Government loyalty +4', kind: 'positive', political: { governmentLoyalty: 4 } },
          { text: 'Stability -1%', kind: 'negative', bundle: { stability: -0.01 } },
          { text: 'Political tension +5', kind: 'negative', political: { tension: 5 } },
        ],
      },
    ],
  },
];
