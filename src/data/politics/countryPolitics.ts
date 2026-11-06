import type { CountryDef, CountryPoliticalDef, IdeologyId, PoliticalGroupSeed } from '../../sim/content';

// Country political identities. These are merged onto the authored country data at load time, so
// adding a country's politics never requires touching the simulation or the UI.

function group(name: string, ideology: IdeologyId, popularity: number, influence: number, inGovernment: boolean, leader: string, objective: string): PoliticalGroupSeed {
  return { name, ideology, popularity, influence, inGovernment, leader, objective };
}

export const COUNTRY_POLITICS: Record<string, CountryPoliticalDef> = {
  GER: {
    systemId: 'authoritarian_republic',
    mechanicId: 'council_authority',
    mechanicValue: 54,
    tension: 14,
    branchFlavour: 'germany',
    transitions: ['parliamentary_republic', 'constitutional_monarchy', 'absolute_monarchy', 'executive_republic', 'one_party_state'],
    groups: [
      group('National Unity Front', 'fascism', 0.62, 72, true, 'Konrad Voss', 'Institutionalise the national revolution and bind the army to the party.'),
      group('Social Democratic Party', 'democratic', 0.18, 12, false, 'August Reinhardt', 'Restore the Reichstag and the rule of law.'),
      group('Communist Party', 'communism', 0.12, 6, false, 'Klara Niemann', 'Build a revolutionary front in the factories and the unemployed districts.'),
      group('Centre Party', 'neutrality', 0.08, 5, false, 'Matthias Feld', 'Defend federalism, the churches and the middle ground.'),
      group('Court Circle', 'monarchist', 0.03, 8, false, 'Friedrich Wilhelm von Hohenzollern', 'Restore the Hohenzollern crown under a negotiated constitution.'),
      group('Reichswehr Command', 'authoritarian', 0.0, 26, false, 'Feldmarschall Otto Reinecke', 'Preserve the army as the ultimate guarantor of the state.'),
    ],
  },
  SOV: {
    systemId: 'one_party_state',
    mechanicId: 'revolutionary_support',
    mechanicValue: 58,
    tension: 18,
    branchFlavour: 'soviet',
    transitions: ['parliamentary_republic', 'constitutional_monarchy', 'one_party_state', 'executive_republic'],
    groups: [
      group('All-Union Communist Party', 'communism', 0.76, 78, true, 'Mikhail Volkov', 'Defend the leading role of the party and the command economy.'),
      group('Left Socialist Revolutionaries', 'communism', 0.09, 10, false, 'Lev Antonov', 'Renew the revolution from below and end one-man rule.'),
      group('Constitutional Democrats', 'democratic', 0.05, 5, false, 'Nikolai Sokolov', 'Replace party dictatorship with a constitutional republic.'),
      group('Monarchist Union', 'monarchist', 0.1, 4, false, 'Grand Duke Alexei', 'Restore the Romanov succession under a constitutional settlement.'),
      group('Red Army Command', 'communism', 0.0, 28, false, 'Marshal Boris Yegorov', 'Keep the army loyal to the state, whoever governs it.'),
    ],
  },
  ENG: {
    systemId: 'constitutional_monarchy',
    mechanicId: 'parliamentary_influence',
    mechanicValue: 56,
    tension: 8,
    branchFlavour: 'britain',
    transitions: ['absolute_monarchy', 'executive_republic', 'federal_republic', 'social_republic', 'parliamentary_republic'],
    groups: [
      group('Conservative Union', 'democratic', 0.48, 46, true, 'Arthur Hale', 'Maintain the national government and rearm without breaking the budget.'),
      group('Labour Party', 'democratic', 0.34, 32, false, 'Margaret Ellison', 'Win the next election on housing, wages and collective security.'),
      group('Liberal Party', 'democratic', 0.12, 14, false, 'Thomas Wren', 'Hold the centre and protect parliamentary government.'),
      group('Communist Party', 'communism', 0.06, 5, false, 'Martha Greaves', 'Build a popular front against rearmament and empire.'),
      group('Crown Household', 'monarchist', 0.0, 12, false, 'King Edmund I', 'Protect the prerogative from an overmighty Commons.'),
      group('General Staff', 'authoritarian', 0.0, 18, false, 'General Edmund Carey', 'Insist that imperial defence outranks party politics.'),
    ],
  },
};

const DEFAULT_TRANSITIONS: Record<string, string[]> = {
  democratic: ['executive_republic', 'constitutional_monarchy', 'federal_republic', 'parliamentary_republic'],
  communism: ['parliamentary_republic', 'one_party_state', 'executive_republic'],
  fascism: ['parliamentary_republic', 'constitutional_monarchy', 'one_party_state'],
  authoritarian: ['parliamentary_republic', 'constitutional_monarchy', 'one_party_state'],
  monarchist: ['parliamentary_republic', 'absolute_monarchy', 'executive_republic'],
  neutrality: ['parliamentary_republic', 'federal_republic', 'constitutional_monarchy'],
};

const SYSTEM_BY_IDEOLOGY: Record<IdeologyId, string> = {
  democratic: 'parliamentary_republic',
  communism: 'one_party_state',
  fascism: 'authoritarian_republic',
  authoritarian: 'authoritarian_republic',
  monarchist: 'constitutional_monarchy',
  neutrality: 'parliamentary_republic',
};

/** Resolves a full political definition for any country, authored or generated. */
export function politicalConfigFor(def: CountryDef): CountryPoliticalDef {
  const authored = COUNTRY_POLITICS[def.tag];
  if (authored) return authored;
  if (def.political) return def.political;
  const systemId = SYSTEM_BY_IDEOLOGY[def.ideology] ?? 'parliamentary_republic';
  return {
    systemId,
    branchFlavour: 'generic',
    transitions: DEFAULT_TRANSITIONS[def.ideology] ?? DEFAULT_TRANSITIONS.democratic,
    groups: def.parties.map((party) => group(
      party.name,
      party.ideology,
      party.popularity,
      party.influence ?? Math.round(party.popularity * 70 + (party.inGovernment ? 20 : 0)),
      party.inGovernment,
      party.leader ?? def.leader.name,
      party.objective ?? (party.inGovernment ? 'Defend the governing programme.' : 'Prepare for the next opportunity to take power.'),
    )),
  };
}
