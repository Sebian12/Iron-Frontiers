import type {
  CountryDef,
  Effect,
  GovernmentDef,
  IdeologyId,
  PoliticalEffect,
  PoliticalGroupSeed,
  PoliticalMechanicDef,
  PoliticalTransitionDef,
  PoliticsContent,
  RateBundle,
  TransitionRequirementDef,
} from './content';

// Political engine: group influence, constitutional transitions, revolutions and coups. Everything
// here is deterministic so the same save state always resolves the same way.

export interface PoliticalGroupState extends PoliticalGroupSeed {
  id: string;
}

export type PoliticalHistoryType = 'system' | 'election' | 'reform' | 'revolution' | 'coup' | 'crisis' | 'focus' | 'war';

export interface PoliticalHistoryEntry {
  id: number;
  day: number;
  date: string;
  type: PoliticalHistoryType;
  title: string;
  description: string;
  icon: string;
  systemId?: string;
  leader?: string;
}

export interface PoliticalState {
  systemId: string;
  mechanicId: string;
  ideology: IdeologyId;
  leaderName: string;
  leaderTitle: string;
  legitimacy: number;
  tension: number;
  revolutionSupport: number;
  revolutionOrganization: number;
  governmentLoyalty: number;
  mechanicValue: number;
  groups: PoliticalGroupState[];
  flags: string[];
  lastCoupDay: number;
  lastRevolutionDay: number;
}

export interface PoliticalContext {
  stability: number;
  politicalPower: number;
  day: number;
}

export interface PoliticalChangeLog {
  text: string;
  kind: 'positive' | 'negative' | 'neutral';
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function clamp100(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function groupId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

export function systemById(content: PoliticsContent, id: string): GovernmentDef | undefined {
  return content.governments.find((entry) => entry.id === id);
}

export function mechanicById(content: PoliticsContent, id: string): PoliticalMechanicDef | undefined {
  return content.mechanics.find((entry) => entry.id === id);
}

export function transitionById(content: PoliticsContent, id: string): PoliticalTransitionDef | undefined {
  return content.transitions.find((entry) => entry.id === id);
}

/** Builds the initial political state from the country configuration and its parties. */
export function createPoliticalState(def: CountryDef, content: PoliticsContent): PoliticalState {
  const config = def.political;
  const system = systemById(content, config?.systemId ?? '') ?? content.governments[0];
  let groups: PoliticalGroupState[] = [];
  if (config?.groups?.length) {
    groups = config.groups.map((group) => ({ ...group, id: groupId(group.name) }));
  } else {
    groups = def.parties.map((party) => ({
      name: party.name,
      ideology: party.ideology,
      popularity: party.popularity,
      influence: party.influence ?? Math.round(party.popularity * 70 + (party.inGovernment ? 22 : 0)),
      inGovernment: party.inGovernment,
      leader: party.leader ?? def.leader.name,
      objective: party.objective ?? (party.inGovernment ? 'Defend the governing programme.' : 'Replace the government at the next opportunity.'),
      id: groupId(party.name),
    }));
  }
  return {
    systemId: system?.id ?? 'parliamentary_republic',
    mechanicId: config?.mechanicId ?? system?.defaultMechanic ?? 'council_authority',
    ideology: config?.groups.find((group) => group.inGovernment)?.ideology ?? def.ideology,
    leaderName: def.leader.name,
    leaderTitle: def.leader.title,
    legitimacy: def.legitimacy ?? 0.65,
    tension: config?.tension ?? 8,
    revolutionSupport: 8,
    revolutionOrganization: 4,
    governmentLoyalty: 68,
    mechanicValue: config?.mechanicValue ?? 45,
    groups,
    flags: [...(config?.flags ?? [])],
    lastCoupDay: -999,
    lastRevolutionDay: -999,
  };
}

export class PoliticalManager {
  state: PoliticalState;
  private readonly content: PoliticsContent;

  constructor(state: PoliticalState, content: PoliticsContent) {
    this.state = state;
    this.content = content;
  }

  system(): GovernmentDef | undefined {
    return systemById(this.content, this.state.systemId);
  }

  mechanic(): PoliticalMechanicDef | undefined {
    return mechanicById(this.content, this.state.mechanicId);
  }

  group(name: string): PoliticalGroupState | undefined {
    return this.state.groups.find((group) => group.name === name || group.id === groupId(name));
  }

  rulingGroup(): PoliticalGroupState | undefined {
    return this.state.groups.find((group) => group.inGovernment) ?? this.state.groups[0];
  }

  strongestGroup(ideology?: IdeologyId): PoliticalGroupState | undefined {
    return [...this.state.groups]
      .filter((group) => (ideology ? group.ideology === ideology : true))
      .sort((a, b) => b.influence - a.influence)[0];
  }

  hasFlag(flag: string): boolean {
    return this.state.flags.includes(flag);
  }

  addFlag(flag: string): void {
    if (!this.state.flags.includes(flag)) this.state.flags.push(flag);
  }

  /** Applies every non-transition part of a political effect. */
  applyEffect(effect: PoliticalEffect): PoliticalChangeLog[] {
    const log: PoliticalChangeLog[] = [];
    if (effect.legitimacy) {
      this.state.legitimacy = clamp01(this.state.legitimacy + effect.legitimacy);
      log.push({ text: `Legitimacy ${effect.legitimacy > 0 ? '+' : ''}${Math.round(effect.legitimacy * 100)}%`, kind: effect.legitimacy > 0 ? 'positive' : 'negative' });
    }
    if (effect.tension) {
      this.state.tension = clamp100(this.state.tension + effect.tension);
      log.push({ text: `Political tension ${effect.tension > 0 ? '+' : ''}${Math.round(effect.tension)}`, kind: effect.tension > 0 ? 'negative' : 'positive' });
    }
    if (effect.revolutionSupport) {
      this.state.revolutionSupport = clamp100(this.state.revolutionSupport + effect.revolutionSupport);
      log.push({ text: `Revolutionary support ${effect.revolutionSupport > 0 ? '+' : ''}${Math.round(effect.revolutionSupport)}`, kind: effect.revolutionSupport > 0 ? 'negative' : 'positive' });
    }
    if (effect.revolutionOrganization) {
      this.state.revolutionOrganization = clamp100(this.state.revolutionOrganization + effect.revolutionOrganization);
      log.push({ text: `Revolutionary organisation ${effect.revolutionOrganization > 0 ? '+' : ''}${Math.round(effect.revolutionOrganization)}`, kind: 'neutral' });
    }
    if (effect.governmentLoyalty) {
      this.state.governmentLoyalty = clamp100(this.state.governmentLoyalty + effect.governmentLoyalty);
      log.push({ text: `Government loyalty ${effect.governmentLoyalty > 0 ? '+' : ''}${Math.round(effect.governmentLoyalty)}`, kind: effect.governmentLoyalty > 0 ? 'positive' : 'negative' });
    }
    if (effect.mechanicValue) {
      this.state.mechanicValue = clamp100(this.state.mechanicValue + effect.mechanicValue);
      log.push({ text: `${this.mechanic()?.valueLabel ?? 'Political capital'} ${effect.mechanicValue > 0 ? '+' : ''}${Math.round(effect.mechanicValue)}`, kind: effect.mechanicValue > 0 ? 'positive' : 'negative' });
    }
    if (effect.ideology) {
      this.state.ideology = effect.ideology;
      log.push({ text: `State ideology: ${effect.ideology}`, kind: 'neutral' });
    }
    if (effect.systemId) this.state.systemId = effect.systemId;
    if (effect.leaderName) this.state.leaderName = effect.leaderName;
    if (effect.leaderTitle) this.state.leaderTitle = effect.leaderTitle;
    for (const change of [effect.group, ...(effect.groups ?? [])].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))) {
      const group = this.group(change.name);
      if (!group) continue;
      if (typeof change.popularity === 'number') group.popularity = clamp01(group.popularity + change.popularity);
      if (typeof change.influence === 'number') group.influence = clamp100(group.influence + change.influence);
      if (typeof change.inGovernment === 'boolean') group.inGovernment = change.inGovernment;
    }
    for (const flag of effect.flags ?? []) this.addFlag(flag);
    if (effect.removeFlags?.length) this.state.flags = this.state.flags.filter((flag) => !effect.removeFlags!.includes(flag));
    return log;
  }

  /** Textual reasons why a transition is currently blocked. */
  missingTransitionRequirements(def: PoliticalTransitionDef, context: PoliticalContext): string[] {
    const missing: string[] = [];
    if (context.politicalPower < def.cost) missing.push(`Requires ${def.cost} political power`);
    if (def.fromSystems?.length && !def.fromSystems.includes(this.state.systemId)) missing.push('The current constitution cannot take this route');
    missing.push(...this.missingRequirements(def.requirements, context));
    return missing;
  }

  missingRequirements(requirements: TransitionRequirementDef, context: PoliticalContext): string[] {
    const missing: string[] = [];
    if (typeof requirements.minStability === 'number' && context.stability < requirements.minStability) {
      missing.push(`Stability above ${Math.round(requirements.minStability * 100)}%`);
    }
    if (typeof requirements.minLegitimacy === 'number' && this.state.legitimacy < requirements.minLegitimacy) {
      missing.push(`Legitimacy above ${Math.round(requirements.minLegitimacy * 100)}%`);
    }
    if (typeof requirements.minMechanic === 'number' && this.state.mechanicValue < requirements.minMechanic) {
      missing.push(`${this.mechanic()?.valueLabel ?? 'Political capital'} above ${requirements.minMechanic}`);
    }
    if (requirements.minGroupInfluence) {
      const group = this.group(requirements.minGroupInfluence.group);
      if (!group || group.influence < requirements.minGroupInfluence.value) {
        missing.push(`${requirements.minGroupInfluence.group} influence above ${requirements.minGroupInfluence.value}`);
      }
    }
    for (const flag of requirements.requiredFlags ?? []) if (!this.hasFlag(flag)) missing.push(`Requires political flag: ${flag.replace(/_/g, ' ')}`);
    if (requirements.anyFlags?.length && !requirements.anyFlags.some((flag) => this.hasFlag(flag))) missing.push('A political precondition is missing');
    return missing;
  }

  /** Passive modifiers produced by the active national mechanic. */
  rates(): RateBundle {
    const value = this.state.mechanicValue / 100;
    const rates: RateBundle = {};
    switch (this.mechanic()?.id) {
      case 'parliamentary_influence':
        rates.ppPerDay = 0.12 * value;
        rates.stabilityDrift = 0.006 * value;
        break;
      case 'royal_legitimacy':
        rates.ppPerDay = 0.08 * value;
        rates.stabilityDrift = 0.008 * value;
        break;
      case 'revolutionary_support':
        rates.warSupportDrift = 0.004 * value;
        rates.ppPerDay = 0.05 * value;
        break;
      case 'regional_autonomy':
        rates.constructionSpeed = 0.03 * value;
        rates.stabilityDrift = 0.005 * value;
        break;
      case 'council_authority':
      default:
        rates.ppPerDay = 0.1 * value;
        rates.factoryOutput = 0.02 * value;
        break;
    }
    return rates;
  }

  revolutionStrength(context: PoliticalContext): number {
    return this.state.revolutionSupport * 0.55
      + this.state.revolutionOrganization * 0.3
      + (1 - context.stability) * 28
      + this.state.tension * 0.12
      - this.state.governmentLoyalty * 0.12;
  }

  coupStrength(groupName: string, context: PoliticalContext): number {
    const group = this.group(groupName);
    if (!group) return 0;
    const military = this.state.groups.filter((entry) => /army|staff|military|command/i.test(entry.name)).reduce((max, entry) => Math.max(max, entry.influence), 0);
    return group.influence * 0.5 + military * 0.25 + (1 - context.stability) * 32 + this.state.tension * 0.15;
  }
}


export function applyEffectsToPolitics(manager: PoliticalManager, effects: Effect[]): PoliticalChangeLog[] {
  const log: PoliticalChangeLog[] = [];
  for (const effect of effects) if (effect.political) log.push(...manager.applyEffect(effect.political));
  return log;
}
