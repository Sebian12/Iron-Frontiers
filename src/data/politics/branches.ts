import type {
  CountryDef,
  Effect,
  FocusDef,
  FocusTreeDef,
  IdeologyId,
} from '../../sim/content';
import type { CountryPoliticalDef } from '../../sim/content';

// Four political directions per country. Shared structure, country-specific language and leaders;
// the shared capstone reconnects the branches without erasing which one brought the country there.

interface BranchSpec {
  key: 'democratic' | 'monarchist' | 'authoritarian' | 'revolutionary';
  name: string;
  icon: string;
  systemId: string;
  ideology: IdeologyId;
  leaderName: string;
  leaderTitle: string;
  titles: [string, string, string, string];
  goal: string;
}

interface BranchFlavour {
  democratic: BranchSpec;
  monarchist: BranchSpec;
  authoritarian: BranchSpec;
  revolutionary: BranchSpec;
}

const GERMANY: BranchFlavour = {
  democratic: {
    key: 'democratic', name: 'Re-establish Free Elections', icon: 'ballot', systemId: 'parliamentary_republic', ideology: 'democratic',
    leaderName: 'August Reinhardt', leaderTitle: 'Chancellor',
    titles: ['Re-establish Free Elections', 'Rebuild the Nation', 'The European Alliance', 'A New German Republic'],
    goal: 'A federal republic anchored in parliament, trade unions and the rule of law.',
  },
  monarchist: {
    key: 'monarchist', name: 'Monarchist Sentiment', icon: 'crown', systemId: 'constitutional_monarchy', ideology: 'monarchist',
    leaderName: 'Friedrich Wilhelm III', leaderTitle: 'Kaiser',
    titles: ['Revive the Kaiserreich', 'Return of the Kaiser', 'Rebuild the Nation', 'Restoration of the Crown'],
    goal: 'A restored Hohenzollern crown bound by a negotiated constitution.',
  },
  authoritarian: {
    key: 'authoritarian', name: 'Rally the Wehrmacht', icon: 'gov', systemId: 'authoritarian_republic', ideology: 'authoritarian',
    leaderName: 'Konrad Voss', leaderTitle: 'Reichspräsident',
    titles: ['Rally the Wehrmacht', 'Reject the Locarno Treaty', 'Mitteleuropa', 'The Enduring Authority'],
    goal: 'A disciplined executive ruling through a national council and a loyal officer corps.',
  },
  revolutionary: {
    key: 'revolutionary', name: 'The Proletarian Revolution', icon: 'flame', systemId: 'revolutionary_state', ideology: 'communism',
    leaderName: 'Klara Niemann', leaderTitle: 'Chairwoman of the Revolutionary Council',
    titles: ['Start The Proletarian Revolution', 'Legacy of the Spartacus League', 'Sign the Second Treaty of Berlin', 'The German Revolution'],
    goal: 'A workers\' state built from factory committees and the ruins of the old Reich.',
  },
};

const SOVIET: BranchFlavour = {
  democratic: {
    key: 'democratic', name: 'The Constitutional Opening', icon: 'ballot', systemId: 'parliamentary_republic', ideology: 'democratic',
    leaderName: 'Nikolai Sokolov', leaderTitle: 'President of the Constituent Assembly',
    titles: ['A Charter of Rights', 'The Exile Returns', 'The Constituent Assembly', 'The Russian Republic'],
    goal: 'Replace party dictatorship with a constitutional republic and an elected assembly.',
  },
  monarchist: {
    key: 'monarchist', name: 'The Romanov Legacy', icon: 'crown', systemId: 'constitutional_monarchy', ideology: 'monarchist',
    leaderName: 'Grand Duke Alexei', leaderTitle: 'Tsar',
    titles: ['The Legitimist Circles', 'A Crown in Exile', 'The Succession Question', 'The Restoration'],
    goal: 'A constitutional Romanov restoration supported by the churches and the old officer families.',
  },
  authoritarian: {
    key: 'authoritarian', name: 'The Iron Commissariat', icon: 'shield', systemId: 'one_party_state', ideology: 'authoritarian',
    leaderName: 'Viktor Krasnov', leaderTitle: 'General Secretary',
    titles: ['The Loyalty Review', 'The Security Commissariat', 'The Party Constitution', 'The Iron Century'],
    goal: 'A single party fused with the security services and the command economy.',
  },
  revolutionary: {
    key: 'revolutionary', name: 'The Second Revolution', icon: 'flame', systemId: 'revolutionary_state', ideology: 'communism',
    leaderName: 'Anya Volkova', leaderTitle: 'Chairwoman of the Workers\' Council',
    titles: ['The Factory Committees', 'Against the Apparatus', 'The Second Congress', 'The Workers\' State'],
    goal: 'Renew the revolution from below and strip the old apparatus of its monopoly on power.',
  },
};

const BRITAIN: BranchFlavour = {
  democratic: {
    key: 'democratic', name: 'Parliamentary Renewal', icon: 'ballot', systemId: 'parliamentary_republic', ideology: 'democratic',
    leaderName: 'Margaret Ellison', leaderTitle: 'Prime Minister',
    titles: ['The Reform Programme', 'A New Electoral Settlement', 'The Commons Majority', 'The People\'s Constitution'],
    goal: 'A modern parliamentary republic with a reformed franchise, a written constitution and a ceremonial crown.',
  },
  monarchist: {
    key: 'monarchist', name: 'The Crown Resurgent', icon: 'crown', systemId: 'absolute_monarchy', ideology: 'monarchist',
    leaderName: 'King Edmund I', leaderTitle: 'King-Emperor',
    titles: ['The Court Network', 'The Imperial League', 'The Royal Prerogative', 'The Crown Assumes Power'],
    goal: 'An assertive crown governing through the prerogative, the church and the imperial officer corps.',
  },
  authoritarian: {
    key: 'authoritarian', name: 'The Emergency Powers', icon: 'shield', systemId: 'authoritarian_republic', ideology: 'authoritarian',
    leaderName: 'Sir Roland Ashby', leaderTitle: 'Lord Protector',
    titles: ['The Defence of the Realm', 'The Emergency Cabinet', 'A National Government', 'The Ordered State'],
    goal: 'A permanent emergency executive justified by rearmament and imperial defence.',
  },
  revolutionary: {
    key: 'revolutionary', name: 'The Popular Front', icon: 'flame', systemId: 'revolutionary_state', ideology: 'communism',
    leaderName: 'Martha Greaves', leaderTitle: 'Chair of the Popular Front',
    titles: ['The Industrial Committees', 'The Popular Front', 'The General Election', 'The Social Commonwealth'],
    goal: 'A social republic built on unions, cooperatives and the mobilised working class.',
  },
};

const GENERIC: BranchFlavour = {
  democratic: {
    key: 'democratic', name: 'The Reform Bloc', icon: 'ballot', systemId: 'parliamentary_republic', ideology: 'democratic',
    leaderName: '', leaderTitle: 'Prime Minister',
    titles: ['A Petition for Reform', 'The Constitutional Club', 'The Electoral Campaign', 'A Government of Laws'],
    goal: 'A parliamentary republic with an elected executive and protected civil liberties.',
  },
  monarchist: {
    key: 'monarchist', name: 'The Crown\'s Friends', icon: 'crown', systemId: 'constitutional_monarchy', ideology: 'monarchist',
    leaderName: '', leaderTitle: 'Sovereign',
    titles: ['The Court Circle', 'The Legitimist League', 'The Succession Compact', 'A Crown Restored'],
    goal: 'A constitutional monarchy capable of arbitrating between the parties and the army.',
  },
  authoritarian: {
    key: 'authoritarian', name: 'The Order Faction', icon: 'shield', systemId: 'authoritarian_republic', ideology: 'authoritarian',
    leaderName: '', leaderTitle: 'President',
    titles: ['The Emergency Committee', 'The Loyalty Purge', 'The Corporate Chamber', 'The Ordered Republic'],
    goal: 'A strong executive ruling through emergency powers and a managed public sphere.',
  },
  revolutionary: {
    key: 'revolutionary', name: 'The Revolutionary Committee', icon: 'flame', systemId: 'revolutionary_state', ideology: 'communism',
    leaderName: '', leaderTitle: 'Chair of the Revolutionary Committee',
    titles: ['The First Cells', 'The Underground Network', 'The General Strike', 'The New Order'],
    goal: 'A revolutionary government of workers\' councils and people\'s committees.',
  },
};

const FLAVOURS: Record<string, BranchFlavour> = {
  germany: GERMANY,
  soviet: SOVIET,
  britain: BRITAIN,
  generic: GENERIC,
};

function branchGroup(def: CountryDef, political: CountryPoliticalDef, spec: BranchSpec): string {
  const preferred = political.groups.find((group) => group.ideology === spec.ideology && !group.inGovernment)
    ?? political.groups.find((group) => group.ideology === spec.ideology)
    ?? political.groups.find((group) => group.inGovernment)
    ?? political.groups[0];
  return preferred?.name ?? def.name;
}

function focusFor(
  def: CountryDef,
  political: CountryPoliticalDef,
  spec: BranchSpec,
  stage: number,
  prefix: string,
  x: number,
  y: number,
  entryIds: string[],
  previousId?: string,
): FocusDef {
  const id = `${prefix}_${spec.key}_${stage + 1}`;
  const group = branchGroup(def, political, spec);
  const isFinal = stage === 3;
  const effects: Effect[] = [];
  if (stage === 0) {
    effects.push(
      { text: '+20 political power', kind: 'positive', bundle: { politicalPower: 20 } },
      { text: `${group} popularity +2%`, kind: 'positive', political: { group: { name: group, popularity: 0.02 }, flags: [`${spec.key}_movement`] } },
    );
  } else if (stage === 1) {
    effects.push(
      { text: `${group} influence +7`, kind: 'positive', political: { group: { name: group, influence: 7 }, legitimacy: 0.01 } },
      { text: 'Political tension +2', kind: 'negative', political: { tension: 2 } },
    );
  } else if (stage === 2) {
    effects.push(
      { text: `${group} influence +7`, kind: 'positive', political: { group: { name: group, influence: 7 }, legitimacy: 0.02, flags: [`${spec.key}_ready`, ...(spec.key === 'monarchist' ? ['royal_mandate'] : [])] } },
      { text: isFinal ? 'The political settlement is ready' : 'A national campaign begins', kind: 'neutral' },
    );
  } else {
    effects.push(
      { text: `Constitution transformed: ${spec.name}`, kind: 'positive', political: {
        transitionId: spec.systemId === 'absolute_monarchy' ? 'absolute_monarchy' : spec.systemId === 'constitutional_monarchy' ? 'constitutional_monarchy' : spec.systemId === 'parliamentary_republic' ? 'parliamentary_republic' : spec.systemId === 'one_party_state' ? 'one_party_state' : spec.systemId === 'authoritarian_republic' ? 'executive_republic' : 'workers_revolution',
        leaderName: spec.leaderName || def.leader.name,
        leaderTitle: spec.leaderTitle,
        ideology: spec.ideology,
        legitimacy: 0.04,
        group: { name: group, popularity: 0.04, influence: 6, inGovernment: true },
        flags: [`${spec.key}_settlement`, 'political_transformation'],
        historyTitle: spec.titles[3],
        historyText: spec.goal,
        historyIcon: spec.icon,
      } },
      { text: `National modifier: ${spec.name}`, kind: 'positive', rates: spec.key === 'democratic' ? { stabilityDrift: 0.008 } : spec.key === 'monarchist' ? { ppPerDay: 0.1 } : spec.key === 'authoritarian' ? { factoryOutput: 0.03 } : { warSupportDrift: 0.005 } },
    );
  }
  return {
    id,
    name: spec.titles[stage],
    description: `${spec.titles[stage]} — ${spec.goal} This is stage ${stage + 1} of the ${spec.name} programme in ${def.name}.`,
    category: 'political',
    icon: stage === 3 ? spec.icon : stage === 0 ? 'flag' : stage === 1 ? 'gov' : 'scroll',
    cost: [0, 10, 20, 30][stage],
    days: [50, 70, 90, 120][stage],
    prerequisites: previousId ? [previousId] : [],
    mutuallyExclusive: stage === 0 ? entryIds.filter((entry) => entry !== id) : [],
    effects,
    branch: spec.key,
    branchName: spec.name,
    requiresFlag: stage > 0 ? `${spec.key}_movement` : undefined,
    x,
    y,
  };
}

/** Appends the political branch pack below a country's existing tree. */
export function augmentFocusTree(tree: FocusTreeDef, def: CountryDef, political: CountryPoliticalDef): FocusTreeDef {
  const flavour = FLAVOURS[political.branchFlavour ?? 'generic'] ?? GENERIC;
  const specs: BranchSpec[] = [flavour.democratic, flavour.monarchist, flavour.authoritarian, flavour.revolutionary];
  const prefix = `pol_${def.tag.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const maxX = tree.focuses.reduce((max, focus) => Math.max(max, focus.x), 0);
  const maxY = tree.focuses.reduce((max, focus) => Math.max(max, focus.y), 0);
  // Germany has a deliberately authored central political column. Other countries keep the
  // historical packed layout below their tree, while the German paths hang from the common
  // national root in the centre and run down toward the Inner Circle panel.
  const nationalRoot = tree.focuses.find((focus) => focus.branch === 'national'
    && !(focus.prerequisites?.length) && !(focus.prerequisitesAny?.length))?.id;
  const startY = nationalRoot ? 3 : maxY + 2;
  const startX = nationalRoot ? 16 : Math.max(1, Math.floor(maxX / 2) - 3);
  const stepX = nationalRoot ? 4 : 2;
  const stepY = nationalRoot ? 3 : 1;
  const entries = specs.map((spec) => `${prefix}_${spec.key}_1`);
  const focuses: FocusDef[] = [];
  const finals: string[] = [];
  specs.forEach((spec, index) => {
    let previous: string | undefined;
    for (let stage = 0; stage < 4; stage += 1) {
      const parent = stage === 0 ? nationalRoot : previous;
      const focus = focusFor(def, political, spec, stage, prefix, startX + index * stepX, startY + stage * stepY, entries, parent);
      focuses.push(focus);
      previous = focus.id;
    }
    finals.push(previous!);
  });
  focuses.push({
    id: `${prefix}_settlement`,
    name: 'A National Settlement',
    description: `Whatever direction ${def.name} has taken, the country must now be governed. This capstone is open to any completed political path and converts its victory into a durable national settlement.`,
    category: 'political',
    icon: 'scroll',
    cost: 40,
    days: 100,
    prerequisites: [],
    prerequisitesAny: finals,
    mutuallyExclusive: [],
    effects: [
      { text: '+60 political power', kind: 'positive', bundle: { politicalPower: 60 } },
      { text: 'Stability +4%, legitimacy +4%', kind: 'positive', bundle: { stability: 0.04 }, political: { legitimacy: 0.04, tension: -6, flags: ['national_settlement'] } },
      { text: 'National modifier: Settled Constitution', kind: 'positive', rates: { stabilityDrift: 0.01, ppPerDay: 0.08 } },
    ],
    branch: 'settlement',
    branchName: 'National Settlement',
    x: startX + (nationalRoot ? 6 : 2),
    y: startY + (nationalRoot ? 11 : 4),
    bypassable: false,
  });
  // Institutional focuses are only valid under the constitution they belong to. A regime change
  // therefore invalidates the old set and unlocks the new one without deleting history.
  specs.forEach((spec, index) => {
    focuses.push({
      id: `${prefix}_institution_${spec.key}`,
      name: `${spec.name} in Power`,
      description: `Institutionalise the ${spec.name} settlement in ${def.name}: courts, appointments and the machinery of government are brought into line with its constitutional order.`,
      category: 'political',
      icon: spec.icon,
      cost: 30,
      days: 80,
      prerequisites: [`${prefix}_settlement`],
      mutuallyExclusive: [],
      requiresSystem: [spec.systemId],
      effects: [
        { text: '+30 political power', kind: 'positive', bundle: { politicalPower: 30 } },
        { text: `Legitimacy +3%, ${spec.name} supporters +5 influence`, kind: 'positive', political: { legitimacy: 0.03, group: { name: branchGroup(def, political, spec), influence: 5 }, flags: [`${spec.key}_institutionalised`] } },
        { text: 'Stability +2%', kind: 'positive', bundle: { stability: 0.02 } },
      ],
      branch: spec.key,
      branchName: spec.name,
      x: startX + index * stepX,
      y: startY + (nationalRoot ? 13 : 5),
    });
  });

  return { ...tree, focuses: [...tree.focuses, ...focuses] };
}
