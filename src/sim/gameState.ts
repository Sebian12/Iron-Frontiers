import type {
  CommanderDef,
  ContentBundle,
  CountryDef,
  CountryResources,
  DecisionDef,
  DivisionDef,
  Effect,
  EffectBundle,
  FocusDef,
  GameEventDef,
  ModifierDef,
  PoliticalEffect,
  PoliticalTransitionDef,
  RateBundle,
} from './content';
import type { PoliticalContext, PoliticalHistoryEntry, PoliticalHistoryType, PoliticalState } from './politics';
import { PoliticalManager, clamp100, createPoliticalState, systemById, transitionById } from './politics';
import type { World } from './world';
import type { ConstructionState, EquipmentDef, ProductionLineState } from '../data/production';
import { BUILDINGS, EQUIPMENT, buildingById, equipmentById } from '../data/production';
import { OPERATIONS, type IntelligenceOperation } from '../data/intelligence';
import { divisionTemplate } from '../data/divisions';
import { factionOf, ideologyOf, relationBetween } from '../data/geopolitics';

export type AdvisorSlot = 'political' | 'staff' | 'intelligence' | 'theorist';

export const ADVISOR_SLOTS: { id: AdvisorSlot; name: string; icon: string }[] = [
  { id: 'political', name: 'Political Advisor', icon: 'gov' },
  { id: 'staff', name: 'Chief of Staff', icon: 'helmet' },
  { id: 'intelligence', name: 'Head of Intelligence', icon: 'eye' },
  { id: 'theorist', name: 'Military Theorist', icon: 'book' },
];

export type NotificationKind = 'info' | 'good' | 'warn' | 'bad';

export interface NotificationEntry {
  id: number;
  date: string;
  title: string;
  text: string;
  kind: NotificationKind;
  screen?: string;
}

export interface FocusProgress {
  id: string;
  elapsed: number;
}

export interface ResearchProgress {
  techId: string;
  elapsed: number;
}

export interface MissionState {
  operationId: string;
  name: string;
  targetId: number;
  elapsed: number;
  days: number;
  reward: number;
}

export interface OperativeState {
  id: number;
  name: string;
  portrait: string;
  mission: MissionState | null;
}

export interface DivisionState extends DivisionDef {
  id: number;
  commander: number;
  templateId: string;
}

export interface GameAlert {
  id: string;
  text: string;
  kind: NotificationKind;
  screen: string;
}

export interface RequirementCheck {
  text: string;
  met: boolean;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

export type FocusState = 'completed' | 'bypassed' | 'active' | 'available' | 'locked' | 'exclusive' | 'invalidated';
export type TechState = 'completed' | 'active' | 'available' | 'locked';

const RESOURCE_KEYS: (keyof CountryResources)[] = ['steel', 'oil', 'rubber', 'aluminium', 'tungsten', 'chromium'];

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sumRates(target: RateBundle, extra: RateBundle | undefined): RateBundle {
  if (!extra) return target;
  const keys = Object.keys(extra) as (keyof RateBundle)[];
  for (const key of keys) {
    const value = extra[key];
    if (typeof value === 'number') target[key] = (target[key] ?? 0) + value;
  }
  return target;
}

export class GameState {
  readonly world: World;
  readonly content: ContentBundle;
  readonly country: CountryDef;
  readonly countryId: number;
  readonly treeFocuses: FocusDef[];

  date = new Date(1936, 0, 1);
  day = 0;
  paused = true;
  speed = 3;

  politicalPower: number;
  stability: number;
  warSupport: number;
  manpower: number;
  treasury: number;

  civilianFactories: number;
  militaryFactories: number;
  dockyards: number;
  infrastructure: number;
  resources: CountryResources;

  focus: FocusProgress | null = null;
  completedFocuses = new Set<string>();
  bypassedFocuses = new Set<string>();
  extraRates: RateBundle = {};

  political!: PoliticalState;
  politics!: PoliticalManager;
  politicalHistory: PoliticalHistoryEntry[] = [];

  research: (ResearchProgress | null)[];
  completedTechs = new Set<string>();

  lines: ProductionLineState[] = [];
  stockpile: Record<string, number> = {};
  construction: ConstructionState[] = [];
  private nextId = 1;

  advisors: Record<AdvisorSlot, string | null> = {
    political: null,
    staff: null,
    intelligence: null,
    theorist: null,
  };

  divisions: DivisionState[] = [];
  commanders: CommanderDef[] = [];

  notifications: NotificationEntry[] = [];
  unread = 0;
  firedEvents = new Set<string>();
  pendingEvent: GameEventDef | null = null;

  selectedCountryId: number;
  selectedProvinceId = 0;
  relationBonus = new Map<number, number>();
  tradeAgreements = new Set<number>();
  guarantees = new Set<number>();

  operatives: OperativeState[] = [];
  missionLog: NotificationEntry[] = [];

  lastDecisionDay = new Map<string, number>();

  constructor(world: World, content: ContentBundle, countryId: number) {
    this.world = world;
    this.content = content;
    this.country = content.def;
    this.countryId = countryId;
    this.treeFocuses = content.tree.focuses;

    const stats = content.def.stats;
    this.politicalPower = stats.politicalPower;
    this.stability = clamp(stats.stability);
    this.warSupport = clamp(stats.warSupport);
    this.manpower = stats.manpower;
    this.treasury = stats.treasury;

    const industry = content.def.industry;
    this.civilianFactories = industry.civilianFactories;
    this.militaryFactories = industry.militaryFactories;
    this.dockyards = industry.dockyards;
    this.infrastructure = industry.infrastructure;
    this.resources = { ...industry.resources };

    this.research = new Array(content.def.researchSlots).fill(null);
    this.selectedCountryId = countryId;
    this.commanders = content.def.army.commanders.slice();
    this.divisions = content.def.army.divisions.map((division, index) => ({
      ...division,
      id: this.takeId(),
      commander: index % Math.max(1, this.commanders.length),
      templateId: division.type,
    }));

    this.political = createPoliticalState(content.def, content.politics);
    this.politics = new PoliticalManager(this.political, content.politics);

    this.seedStockpile();
    this.seedProduction();
    this.seedOperatives();

    const system = this.politicalSystem;
    this.recordHistory('system', system?.name ?? 'Government formed', `${content.def.name} begins the campaign under the ${system?.name ?? 'existing constitution'}. ${content.def.leader.name} holds the office of ${content.def.leader.title}.`, system?.icon ?? 'gov');

    this.notify('info', 'Campaign begins', `${content.def.name} · 1 January 1936. The national focus tree is ready; choose a focus to set the country's course.`, 'focus');
    this.notify('info', 'Economy', 'Civilian factories are waiting for construction orders and military factories can be assigned to production lines.', 'production');
  }

  private takeId(): number {
    this.nextId += 1;
    return this.nextId;
  }

  // ---------------------------------------------------------------- derived rates

  get advisorRates(): RateBundle {
    const total: RateBundle = {};
    for (const slot of ADVISOR_SLOTS) {
      const advisorId = this.advisors[slot.id];
      if (!advisorId) continue;
      sumRates(total, this.country.advisors.find((advisor) => advisor.id === advisorId)?.rates);
    }
    return total;
  }

  get nationalRates(): RateBundle {
    const total: RateBundle = {};
    for (const modifier of this.nationalModifiers) sumRates(total, modifier.rates);
    sumRates(total, this.extraRates);
    sumRates(total, this.advisorRates);
    sumRates(total, this.politics.rates());
    return total;
  }

  get nationalModifiers(): ModifierDef[] {
    return this.country.modifiers;
  }

  get researchSpeed(): number {
    return this.nationalRates.researchSpeed ?? 0;
  }

  get constructionSpeed(): number {
    return this.nationalRates.constructionSpeed ?? 0;
  }

  get factoryOutput(): number {
    return this.nationalRates.factoryOutput ?? 0;
  }

  get ppPerDay(): number {
    return 1 + (this.nationalRates.ppPerDay ?? 0);
  }

  get income(): number {
    const base = this.country.stats.income;
    const factoryDelta = (this.civilianFactories - this.country.industry.civilianFactories) * 1.8;
    return Math.round(base + factoryDelta + this.tradeAgreements.size * 2);
  }

  get expenses(): number {
    const base = this.country.stats.expenses;
    const militaryDelta = (this.militaryFactories - this.country.industry.militaryFactories) * 2.1;
    const dockDelta = (this.dockyards - this.country.industry.dockyards) * 1.7;
    return Math.round(base + militaryDelta + dockDelta);
  }

  get industrialCapacity(): number {
    return this.civilianFactories + this.militaryFactories + this.dockyards;
  }

  get armyStrength(): number {
    if (this.divisions.length === 0) return 0;
    return this.divisions.reduce((sum, division) => sum + division.strength, 0) / this.divisions.length;
  }

  get dateLabel(): string {
    return this.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  get longDateLabel(): string {
    return this.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  get isoDate(): string {
    const year = this.date.getFullYear();
    const month = String(this.date.getMonth() + 1).padStart(2, '0');
    const day = String(this.date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  get totalFactoriesUsed(): number {
    return this.lines.reduce((sum, line) => sum + line.factories, 0);
  }

  get availableMilitaryFactories(): number {
    return Math.max(0, this.militaryFactories - this.totalFactoriesUsed);
  }

  // ---------------------------------------------------------------- effects

  applyBundle(bundle: EffectBundle | undefined, sign = 1): void {
    if (!bundle) return;
    if (bundle.politicalPower) this.politicalPower = Math.max(0, this.politicalPower + bundle.politicalPower * sign);
    if (bundle.stability) this.stability = clamp(this.stability + bundle.stability * sign);
    if (bundle.warSupport) this.warSupport = clamp(this.warSupport + bundle.warSupport * sign);
    if (bundle.manpower) this.manpower = Math.max(0, this.manpower + bundle.manpower * sign);
    if (bundle.treasury) this.treasury = Math.max(-9999, this.treasury + bundle.treasury * sign);
    if (bundle.civilianFactories) this.civilianFactories = Math.max(1, this.civilianFactories + bundle.civilianFactories * sign);
    if (bundle.militaryFactories) this.militaryFactories = Math.max(0, this.militaryFactories + bundle.militaryFactories * sign);
    if (bundle.dockyards) this.dockyards = Math.max(0, this.dockyards + bundle.dockyards * sign);
    if (bundle.infrastructure) this.infrastructure = clamp(this.infrastructure + bundle.infrastructure * sign, 0, 10);
    if (bundle.researchSlots) {
      const slots = Math.max(1, this.research.length + bundle.researchSlots * sign);
      while (this.research.length < slots) this.research.push(null);
      if (slots < this.research.length) this.research.length = slots;
    }
  }

  applyEffects(effects: Effect[]): void {
    for (const effect of effects) {
      this.applyBundle(effect.bundle);
      sumRates(this.extraRates, effect.rates);
      if (effect.political) this.applyPoliticalEffect(effect.political);
    }
  }

  private applyPoliticalEffect(effect: PoliticalEffect): void {
    if (effect.politicalPower) this.politicalPower = Math.max(0, this.politicalPower + effect.politicalPower);
    if (effect.stability) this.stability = clamp(this.stability + effect.stability);
    if (effect.warSupport) this.warSupport = clamp(this.warSupport + effect.warSupport);
    this.politics.applyEffect(effect);
    if (effect.historyTitle && !effect.transitionId) {
      this.recordHistory('reform', effect.historyTitle, effect.historyText ?? effect.historyTitle, effect.historyIcon ?? 'scroll');
    }
    if (effect.transitionId) this.executeTransition(effect.transitionId, 'focus');
  }

  notify(kind: NotificationKind, title: string, text: string, screen?: string): void {
    const entry: NotificationEntry = {
      id: this.takeId(),
      date: this.dateLabel,
      title,
      text,
      kind,
      screen,
    };
    this.notifications.unshift(entry);
    if (this.notifications.length > 80) this.notifications.length = 80;
    this.unread += 1;
  }

  markNotificationsRead(): void {
    this.unread = 0;
  }

  // ---------------------------------------------------------------- requirements

  checkRequirement(text: string): RequirementCheck {
    const stability = /stability above (\d+)%/i.exec(text);
    if (stability) return { text, met: this.stability * 100 >= Number(stability[1]) };
    const war = /war support above (\d+)%/i.exec(text);
    if (war) return { text, met: this.warSupport * 100 >= Number(war[1]) };
    const pp = /political power (\d+)/i.exec(text);
    if (pp) return { text, met: this.politicalPower >= Number(pp[1]) };
    const treasury = /treasury above (\d+)/i.exec(text);
    if (treasury) return { text, met: this.treasury >= Number(treasury[1]) };
    const manpower = /manpower above ([\d,]+)/i.exec(text);
    if (manpower) return { text, met: this.manpower >= Number(manpower[1].replace(/,/g, '')) };
    const army = /army at (\d+)% strength/i.exec(text);
    if (army) return { text, met: this.armyStrength * 100 >= Number(army[1]) };
    return { text, met: true };
  }

  requirementChecks(requirements: string[] | undefined): RequirementCheck[] {
    return (requirements ?? []).map((text) => this.checkRequirement(text));
  }

  // ---------------------------------------------------------------- focus tree

  focusById(id: string): FocusDef | undefined {
    return this.treeFocuses.find((focus) => focus.id === id);
  }

  focusState(id: string): FocusState {
    if (this.completedFocuses.has(id)) return 'completed';
    if (this.bypassedFocuses.has(id)) return 'bypassed';
    if (this.focus?.id === id) return 'active';
    const focus = this.focusById(id);
    if (!focus) return 'locked';
    if (focus.requiresSystem?.length && !focus.requiresSystem.includes(this.political.systemId)) return 'invalidated';
    if (focus.requiresIdeology?.length && !focus.requiresIdeology.includes(this.political.ideology)) return 'invalidated';
    if (focus.requiresFlag && !this.politics.hasFlag(focus.requiresFlag)) return 'locked';
    const blockedBy = (focus.mutuallyExclusive ?? []).find((other) => this.completedFocuses.has(other) || this.bypassedFocuses.has(other));
    if (blockedBy) return 'exclusive';
    const prerequisitesReady = (focus.prerequisites ?? []).every((prereq) => this.completedFocuses.has(prereq) || this.bypassedFocuses.has(prereq));
    const anyReady = !focus.prerequisitesAny?.length || focus.prerequisitesAny.some((entry) => this.completedFocuses.has(entry));
    return prerequisitesReady && anyReady ? 'available' : 'locked';
  }

  focusInvalidReason(id: string): string | null {
    const focus = this.focusById(id);
    if (!focus) return null;
    if (focus.requiresSystem?.length && !focus.requiresSystem.includes(this.political.systemId)) {
      return `This path belongs to the ${focus.requiresSystem.map((id) => systemById(this.content.politics, id)?.name ?? id).join(' or ')}.`;
    }
    if (focus.requiresIdeology?.length && !focus.requiresIdeology.includes(this.political.ideology)) {
      return 'The current state ideology has closed this path.';
    }
    if (focus.requiresFlag && !this.politics.hasFlag(focus.requiresFlag)) return 'A political precondition has not been met.';
    return null;
  }

  focusBlockedBy(id: string): string | null {
    const focus = this.focusById(id);
    if (!focus) return null;
    const other = (focus.mutuallyExclusive ?? []).find((entry) => this.completedFocuses.has(entry));
    return other ? this.focusById(other)?.name ?? other : null;
  }

  missingFocusRequirements(id: string): RequirementCheck[] {
    const focus = this.focusById(id);
    if (!focus) return [];
    return this.requirementChecks(focus.requirements).filter((check) => !check.met);
  }

  canStartFocus(id: string): ActionResult {
    if (this.focus) return { ok: false, message: 'Another national focus is already in progress.' };
    if (this.focusState(id) === 'completed') return { ok: false, message: 'This focus is already completed.' };
    if (this.focusState(id) === 'bypassed') return { ok: false, message: 'This focus was bypassed.' };
    if (this.focusState(id) === 'invalidated') return { ok: false, message: this.focusInvalidReason(id) ?? 'The current constitution has invalidated this focus.' };
    if (this.focusState(id) === 'exclusive') {
      return { ok: false, message: `Blocked by ${this.focusBlockedBy(id) ?? 'a mutually exclusive focus'}.` };
    }
    if (this.focusState(id) === 'locked') return { ok: false, message: this.focusInvalidReason(id) ?? 'Its prerequisites are not completed.' };
    const focus = this.focusById(id);
    if (!focus) return { ok: false, message: 'Unknown focus.' };
    if (this.politicalPower < (focus.cost ?? 0)) {
      return { ok: false, message: `Requires ${focus.cost} political power.` };
    }
    const missing = this.missingFocusRequirements(id);
    if (missing.length > 0) return { ok: false, message: `Missing: ${missing.map((entry) => entry.text).join(', ')}.` };
    return { ok: true, message: 'Ready to start.' };
  }

  startFocus(id: string): ActionResult {
    const check = this.canStartFocus(id);
    if (!check.ok) return check;
    const focus = this.focusById(id)!;
    this.politicalPower -= focus.cost ?? 0;
    this.focus = { id, elapsed: 0 };
    this.notify('info', 'Focus started', `${focus.name} — expected completion in ${focus.days} days.`, 'focus');
    return { ok: true, message: 'Focus started.' };
  }

  abandonFocus(): void {
    if (!this.focus) return;
    const focus = this.focusById(this.focus.id);
    this.focus = null;
    this.notify('warn', 'Focus abandoned', `${focus?.name ?? 'The focus'} was cancelled. Its political power cost is not refunded.`, 'focus');
  }

  bypassFocus(id: string): ActionResult {
    const focus = this.focusById(id);
    if (!focus) return { ok: false, message: 'Unknown focus.' };
    if (!focus.bypassable) return { ok: false, message: 'This focus cannot be bypassed.' };
    if (this.focusState(id) !== 'available') return { ok: false, message: 'This focus is not available for bypass.' };
    this.bypassedFocuses.add(id);
    this.completedFocuses.add(id);
    this.notify('info', 'Focus bypassed', `${focus.name} was satisfied by existing conditions and bypassed without its rewards.`, 'focus');
    return { ok: true, message: 'Focus bypassed.' };
  }

  private completeFocus(): void {
    if (!this.focus) return;
    const focus = this.focusById(this.focus.id);
    if (!focus) {
      this.focus = null;
      return;
    }
    if (this.completedFocuses.has(focus.id) || this.bypassedFocuses.has(focus.id)) {
      this.focus = null;
      return;
    }
    this.completedFocuses.add(focus.id);
    this.focus = null;
    this.applyEffects(focus.effects);
    if (focus.branch && focus.branch !== 'settlement') {
      this.recordHistory('focus', focus.name, focus.description, focus.icon);
    }
    if (focus.events?.length) {
      const event = focus.events.map((id) => this.content.politics.events.find((entry) => entry.id === id)).find((entry) => entry && !this.firedEvents.has(entry.id));
      if (event) {
        this.firedEvents.add(event.id);
        this.pendingEvent = event;
        this.paused = true;
      }
    }
    const unlocks = this.treeFocuses.filter(
      (other) => (other.prerequisites?.includes(focus.id) || other.prerequisitesAny?.includes(focus.id)) && !this.completedFocuses.has(other.id),
    );
    const unlockText = unlocks.length > 0 ? ` Unlocked: ${unlocks.map((entry) => entry.name).join(', ')}.` : '';
    this.notify('good', 'Focus completed', `${focus.name} completed.${unlockText}`, 'focus');
  }

  focusProgress(): number {
    if (!this.focus) return 0;
    const focus = this.focusById(this.focus.id);
    return focus ? clamp(this.focus.elapsed / focus.days) : 0;
  }

  focusDaysLeft(): number {
    if (!this.focus) return 0;
    const focus = this.focusById(this.focus.id);
    return focus ? Math.max(0, Math.ceil(focus.days - this.focus.elapsed)) : 0;
  }

  availableFocuses(): FocusDef[] {
    return this.treeFocuses.filter((focus) => this.focusState(focus.id) === 'available');
  }

  // ---------------------------------------------------------------- research

  techById(id: string) {
    return this.content.technologies.find((tech) => tech.id === id);
  }

  techState(id: string): TechState {
    if (this.completedTechs.has(id)) return 'completed';
    if (this.research.some((slot) => slot?.techId === id)) return 'active';
    const tech = this.techById(id);
    if (!tech) return 'locked';
    return tech.requires.every((prereq) => this.completedTechs.has(prereq)) ? 'available' : 'locked';
  }

  techDaysLeft(id: string): number {
    const tech = this.techById(id);
    if (!tech) return 0;
    const progress = this.research.find((slot) => slot?.techId === id);
    if (!progress) return tech.days;
    return Math.max(0, Math.ceil(tech.days - progress.elapsed));
  }

  startResearch(id: string): ActionResult {
    const tech = this.techById(id);
    if (!tech) return { ok: false, message: 'Unknown technology.' };
    if (this.completedTechs.has(id)) return { ok: false, message: 'Already researched.' };
    if (this.research.some((slot) => slot?.techId === id)) return { ok: false, message: 'Already in progress.' };
    if (this.techState(id) === 'locked') return { ok: false, message: 'Prerequisite technologies are missing.' };
    const free = this.research.findIndex((slot) => slot === null);
    if (free === -1) return { ok: false, message: 'All research slots are occupied.' };
    this.research[free] = { techId: id, elapsed: 0 };
    this.notify('info', 'Research started', `${tech.name} — ${tech.days} days at current research speed.`, 'research');
    return { ok: true, message: 'Research started.' };
  }

  cancelResearch(slot: number): void {
    const current = this.research[slot];
    if (!current) return;
    const tech = this.techById(current.techId);
    this.research[slot] = null;
    this.notify('warn', 'Research cancelled', `${tech?.name ?? 'Project'} cancelled; progress is lost.`, 'research');
  }

  researchDaysFor(id: string): number {
    const tech = this.techById(id);
    if (!tech) return 0;
    return Math.ceil(tech.days / (1 + this.researchSpeed));
  }

  // ---------------------------------------------------------------- production

  private seedStockpile(): void {
    const seed: Record<string, number> = {
      infantry_equipment: 12000,
      support_equipment: 3000,
      artillery: 600,
      anti_tank: 150,
      light_tank: 140,
      medium_tank: 60,
      truck: 900,
      fighter: 180,
      cas: 70,
      submarine: 0,
      destroyer: 0,
    };
    for (const equipment of EQUIPMENT) this.stockpile[equipment.id] = seed[equipment.id] ?? 0;
  }

  private seedProduction(): void {
    const plan: { id: string; share: number }[] = [
      { id: 'infantry_equipment', share: 0.42 },
      { id: 'artillery', share: 0.2 },
      { id: 'fighter', share: 0.14 },
    ];
    let remaining = this.militaryFactories;
    for (const entry of plan) {
      const factories = Math.min(remaining, Math.max(0, Math.floor(this.militaryFactories * entry.share)));
      if (factories > 0) {
        this.lines.push({
          id: this.takeId(),
          equipmentId: entry.id,
          factories,
          efficiency: 0.32,
          progress: 0,
          produced: 0,
          paused: false,
        });
        remaining -= factories;
      }
    }
    if (remaining > 0 && this.lines.length === 0) {
      this.lines.push({
        id: this.takeId(),
        equipmentId: 'infantry_equipment',
        factories: this.militaryFactories,
        efficiency: 0.32,
        progress: 0,
        produced: 0,
        paused: false,
      });
    }
  }

  equipmentOf(line: ProductionLineState): EquipmentDef | undefined {
    return equipmentById(line.equipmentId);
  }

  lineOutput(line: ProductionLineState): number {
    const equipment = this.equipmentOf(line);
    if (!equipment || line.factories === 0 || line.paused) return 0;
    const ic = line.factories * 4.5 * line.efficiency * (1 + this.factoryOutput);
    return Math.max(0, ic / Math.max(0.1, equipment.cost));
  }

  resourceNeeds(): Partial<CountryResources> {
    const needs: Partial<CountryResources> = {};
    for (const line of this.lines) {
      if (line.paused || line.factories === 0) continue;
      const equipment = this.equipmentOf(line);
      if (!equipment) continue;
      for (const key of RESOURCE_KEYS) {
        const perFactory = equipment.needs[key];
        if (!perFactory) continue;
        needs[key] = (needs[key] ?? 0) + perFactory * line.factories;
      }
    }
    return needs;
  }

  resourceShortages(): { resource: keyof CountryResources; needed: number; available: number }[] {
    const needs = this.resourceNeeds();
    const shortages: { resource: keyof CountryResources; needed: number; available: number }[] = [];
    for (const key of RESOURCE_KEYS) {
      const needed = needs[key] ?? 0;
      if (needed > this.resources[key]) shortages.push({ resource: key, needed, available: this.resources[key] });
    }
    return shortages;
  }

  addProductionLine(equipmentId: string): ActionResult {
    const equipment = equipmentById(equipmentId);
    if (!equipment) return { ok: false, message: 'Unknown equipment.' };
    const existing = this.lines.find((line) => line.equipmentId === equipmentId);
    if (existing) return { ok: false, message: `${equipment.name} is already in production.` };
    const factories = this.availableMilitaryFactories > 0 ? 1 : 0;
    this.lines.push({
      id: this.takeId(),
      equipmentId,
      factories,
      efficiency: 0.1,
      progress: 0,
      produced: 0,
      paused: factories === 0,
    });
    this.notify('info', 'Production line added', `${equipment.name} ${factories > 0 ? 'assigned 1 factory.' : 'queued with no free factory.'}`, 'production');
    return { ok: true, message: 'Production line added.' };
  }

  setLineFactories(lineId: number, factories: number): void {
    const line = this.lines.find((entry) => entry.id === lineId);
    if (!line) return;
    const max = line.factories + this.availableMilitaryFactories;
    line.factories = Math.max(0, Math.min(max, Math.round(factories)));
    if (line.factories > 0 && line.paused) line.paused = false;
  }

  toggleLine(lineId: number): void {
    const line = this.lines.find((entry) => entry.id === lineId);
    if (line) line.paused = !line.paused;
  }

  removeLine(lineId: number): void {
    const index = this.lines.findIndex((entry) => entry.id === lineId);
    if (index === -1) return;
    const [line] = this.lines.splice(index, 1);
    const equipment = this.equipmentOf(line);
    this.notify('warn', 'Production line removed', `${equipment?.name ?? 'Line'} removed; ${line.factories} factories freed.`, 'production');
  }

  moveLine(lineId: number, direction: -1 | 1): void {
    const index = this.lines.findIndex((entry) => entry.id === lineId);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= this.lines.length) return;
    const [line] = this.lines.splice(index, 1);
    this.lines.splice(target, 0, line);
  }

  stockpileOf(equipmentId: string): number {
    return Math.floor(this.stockpile[equipmentId] ?? 0);
  }

  // ---------------------------------------------------------------- construction

  get constructionPerDay(): number {
    return this.civilianFactories * 5 * (1 + this.constructionSpeed);
  }

  buildingAvailable(buildingId: string): boolean {
    return BUILDINGS.some((building) => building.id === buildingId);
  }

  addConstruction(buildingId: string): ActionResult {
    const building = buildingById(buildingId);
    if (!building) return { ok: false, message: 'Unknown building.' };
    this.construction.push({
      id: this.takeId(),
      buildingId,
      cost: building.cost,
      progress: 0,
      count: 1,
    });
    this.notify('info', 'Construction queued', `${building.name} added to the construction queue.`, 'construction');
    return { ok: true, message: 'Construction queued.' };
  }

  cancelConstruction(id: number): void {
    const index = this.construction.findIndex((entry) => entry.id === id);
    if (index === -1) return;
    const [item] = this.construction.splice(index, 1);
    const building = buildingById(item.buildingId);
    this.notify('warn', 'Construction cancelled', `${building?.name ?? 'Project'} removed from the queue.`, 'construction');
  }

  moveConstruction(id: number, direction: -1 | 1): void {
    const index = this.construction.findIndex((entry) => entry.id === id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= this.construction.length) return;
    const [item] = this.construction.splice(index, 1);
    this.construction.splice(target, 0, item);
  }

  constructionDaysLeft(item: ConstructionState): number {
    return Math.max(0, Math.ceil((item.cost - item.progress) / Math.max(1, this.constructionPerDay)));
  }

  // ---------------------------------------------------------------- advisors

  advisorCandidates(slot: AdvisorSlot) {
    return this.country.advisors.filter((advisor) => advisor.slot === slot);
  }

  hiredAdvisor(slot: AdvisorSlot) {
    const id = this.advisors[slot];
    return id ? this.country.advisors.find((advisor) => advisor.id === id) ?? null : null;
  }

  hireAdvisor(id: string): ActionResult {
    const advisor = this.country.advisors.find((entry) => entry.id === id);
    if (!advisor) return { ok: false, message: 'Unknown advisor.' };
    if (this.advisors[advisor.slot]) return { ok: false, message: 'That position is already filled.' };
    if (this.politicalPower < advisor.cost) return { ok: false, message: `Requires ${advisor.cost} political power.` };
    this.politicalPower -= advisor.cost;
    this.advisors[advisor.slot] = advisor.id;
    this.applyBundle(advisor.bundle);
    this.notify('good', 'Advisor appointed', `${advisor.name} is now ${advisor.position}. ${advisor.bonus}.`, 'politics');
    return { ok: true, message: 'Advisor appointed.' };
  }

  dismissAdvisor(slot: AdvisorSlot): void {
    const advisor = this.hiredAdvisor(slot);
    if (!advisor) return;
    this.advisors[slot] = null;
    if (advisor.bundle) {
      const inverse: EffectBundle = {};
      for (const key of Object.keys(advisor.bundle) as (keyof EffectBundle)[]) {
        const value = advisor.bundle[key];
        if (typeof value === 'number') inverse[key] = -value;
      }
      this.applyBundle(inverse);
    }
    this.notify('warn', 'Advisor dismissed', `${advisor.name} has left the government.`, 'politics');
  }

  // ---------------------------------------------------------------- decisions

  decisionById(id: string): DecisionDef | undefined {
    return this.country.decisions.find((decision) => decision.id === id);
  }

  decisionCooldown(decision: DecisionDef): number {
    const last = this.lastDecisionDay.get(decision.id);
    if (last === undefined) return 0;
    return Math.max(0, decision.cooldown - (this.day - last));
  }

  decisionReady(decision: DecisionDef): boolean {
    return this.decisionCooldown(decision) === 0
      && this.politicalPower >= decision.cost
      && this.requirementChecks(decision.requirements).every((check) => check.met);
  }

  takeDecision(id: string): ActionResult {
    const decision = this.decisionById(id);
    if (!decision) return { ok: false, message: 'Unknown decision.' };
    if (this.politicalPower < decision.cost) return { ok: false, message: `Requires ${decision.cost} political power.` };
    if (this.decisionCooldown(decision) > 0) return { ok: false, message: 'Still on cooldown.' };
    const missing = this.requirementChecks(decision.requirements).filter((check) => !check.met);
    if (missing.length > 0) return { ok: false, message: `Missing: ${missing.map((entry) => entry.text).join(', ')}.` };
    this.politicalPower -= decision.cost;
    this.applyEffects(decision.effects);
    this.lastDecisionDay.set(decision.id, this.day);
    this.notify('good', 'Decision enacted', `${decision.name}. ${decision.effects.map((effect) => effect.text).join(' ')}`, 'decisions');
    return { ok: true, message: 'Decision enacted.' };
  }

  // ---------------------------------------------------------------- diplomacy

  relationWith(targetId: number): number {
    const target = this.world.countries[targetId];
    if (!target) return 0;
    const base = relationBetween(
      this.country.name,
      this.country.ideology,
      this.country.faction,
      target.name,
      ideologyOf(target.name),
      factionOf(target.name),
    );
    const bonus = this.relationBonus.get(targetId) ?? 0;
    const trade = this.tradeAgreements.has(targetId) ? 12 : 0;
    const guarantee = this.guarantees.has(targetId) ? 15 : 0;
    return Math.max(-100, Math.min(100, base + bonus + trade + guarantee));
  }

  improveRelations(targetId: number): ActionResult {
    if (targetId === this.countryId) return { ok: false, message: 'Cannot improve relations with yourself.' };
    if (this.politicalPower < 25) return { ok: false, message: 'Requires 25 political power.' };
    this.politicalPower -= 25;
    this.relationBonus.set(targetId, (this.relationBonus.get(targetId) ?? 0) + 8);
    const target = this.world.countries[targetId];
    this.notify('good', 'Diplomatic mission', `Relations with ${target.name} improved.`, 'diplomacy');
    return { ok: true, message: 'Relations improved.' };
  }

  toggleTrade(targetId: number): ActionResult {
    if (targetId === this.countryId) return { ok: false, message: 'Cannot trade with yourself.' };
    if (!this.tradeAgreements.has(targetId)) {
      if (this.politicalPower < 15) return { ok: false, message: 'Requires 15 political power.' };
      this.politicalPower -= 15;
      this.tradeAgreements.add(targetId);
      this.notify('info', 'Trade agreement', `A trade agreement with ${this.world.countries[targetId].name} has been signed.`, 'diplomacy');
      return { ok: true, message: 'Trade agreement signed.' };
    }
    this.tradeAgreements.delete(targetId);
    this.notify('warn', 'Trade agreement ended', `Trade with ${this.world.countries[targetId].name} has been suspended.`, 'diplomacy');
    return { ok: true, message: 'Trade agreement ended.' };
  }

  guarantee(targetId: number): ActionResult {
    if (targetId === this.countryId) return { ok: false, message: 'Cannot guarantee yourself.' };
    if (this.guarantees.has(targetId)) {
      this.guarantees.delete(targetId);
      return { ok: true, message: 'Guarantee withdrawn.' };
    }
    if (this.politicalPower < 40) return { ok: false, message: 'Requires 40 political power.' };
    this.politicalPower -= 40;
    this.guarantees.add(targetId);
    this.notify('info', 'Independence guaranteed', `${this.world.countries[targetId].name} is now under ${this.country.name}'s guarantee.`, 'diplomacy');
    return { ok: true, message: 'Guarantee issued.' };
  }

  denounce(targetId: number): ActionResult {
    if (targetId === this.countryId) return { ok: false, message: 'Cannot denounce yourself.' };
    if (this.politicalPower < 20) return { ok: false, message: 'Requires 20 political power.' };
    this.politicalPower -= 20;
    this.relationBonus.set(targetId, (this.relationBonus.get(targetId) ?? 0) - 12);
    this.warSupport = clamp(this.warSupport + 0.01);
    this.notify('warn', 'Public denunciation', `${this.world.countries[targetId].name} has been publicly denounced. Relations fall.`, 'diplomacy');
    return { ok: true, message: 'Relations worsened.' };
  }

  relationLabel(value: number): string {
    if (value >= 60) return 'Friendly';
    if (value >= 20) return 'Cordial';
    if (value > -20) return 'Neutral';
    if (value > -60) return 'Strained';
    return 'Hostile';
  }

  // ---------------------------------------------------------------- military

  commanderName(index: number): string {
    return this.commanders[index]?.name ?? 'Independent';
  }

  recruitDivision(templateId: string, commanderIndex: number): ActionResult {
    const template = divisionTemplate(templateId);
    if (!template) return { ok: false, message: 'Unknown division template.' };
    if (this.manpower < template.manpower) return { ok: false, message: `Requires ${template.manpower.toLocaleString('en-GB')} manpower.` };
    for (const [equipmentId, quantity] of Object.entries(template.equipment)) {
      if (this.stockpileOf(equipmentId) < quantity) {
        const equipment = equipmentById(equipmentId);
        return { ok: false, message: `Not enough ${equipment?.name ?? equipmentId} in the stockpile.` };
      }
    }
    this.manpower -= template.manpower;
    for (const [equipmentId, quantity] of Object.entries(template.equipment)) {
      this.stockpile[equipmentId] = Math.max(0, (this.stockpile[equipmentId] ?? 0) - quantity);
    }
    this.divisions.push({
      id: this.takeId(),
      name: `${this.divisions.length + 1}. ${template.name}`,
      template: template.name,
      type: template.type,
      experience: 0.05,
      strength: 0.85,
      location: this.country.name,
      commander: commanderIndex,
      templateId: template.id,
    });
    this.notify('good', 'Division raised', `${template.name} has joined ${this.commanderName(commanderIndex)}'s command.`, 'military');
    return { ok: true, message: 'Division raised.' };
  }

  reinforceDivision(id: number): ActionResult {
    const division = this.divisions.find((entry) => entry.id === id);
    if (!division) return { ok: false, message: 'Unknown division.' };
    if (division.strength >= 1) return { ok: false, message: 'Division is already at full strength.' };
    const manpower = 2000;
    const equipment = 200;
    if (this.manpower < manpower) return { ok: false, message: 'Not enough manpower.' };
    if (this.stockpileOf('infantry_equipment') < equipment) return { ok: false, message: 'Not enough infantry equipment.' };
    this.manpower -= manpower;
    this.stockpile.infantry_equipment -= equipment;
    division.strength = Math.min(1, round(division.strength + 0.1, 2));
    this.notify('info', 'Division reinforced', `${division.name} brought up to ${Math.round(division.strength * 100)}% strength.`, 'military');
    return { ok: true, message: 'Division reinforced.' };
  }

  divisionsOfCommander(index: number): DivisionState[] {
    return this.divisions.filter((division) => division.commander === index);
  }

  // ---------------------------------------------------------------- intelligence

  private seedOperatives(): void {
    const templates = ['Kestrel', 'Lantern', 'Sable'];
    this.operatives = templates.map((codename, index) => ({
      id: this.takeId(),
      name: `Agent ${codename}`,
      portrait: `${this.country.name}-agent-${index}`,
      mission: null,
    }));
  }

  get operativeCapacity(): number {
    return 2 + (this.hiredAdvisor('intelligence') ? 1 : 0);
  }

  get idleOperatives(): OperativeState[] {
    return this.operatives.filter((operative) => !operative.mission);
  }

  operation(id: string): IntelligenceOperation | undefined {
    return OPERATIONS.find((entry) => entry.id === id);
  }

  startOperation(operationId: string, targetId: number): ActionResult {
    const operation = this.operation(operationId);
    if (!operation) return { ok: false, message: 'Unknown operation.' };
    if (targetId === this.countryId) return { ok: false, message: 'Choose a foreign target.' };
    if (this.politicalPower < operation.cost) return { ok: false, message: `Requires ${operation.cost} political power.` };
    const operative = this.idleOperatives[0];
    if (!operative) return { ok: false, message: 'No operative is free for a new mission.' };
    this.politicalPower -= operation.cost;
    operative.mission = {
      operationId: operation.id,
      name: operation.name,
      targetId,
      elapsed: 0,
      days: operation.days,
      reward: operation.reward,
    };
    this.notify('info', 'Operation launched', `${operative.name} begins "${operation.name}" in ${this.world.countries[targetId].name}.`, 'intelligence');
    return { ok: true, message: 'Operation launched.' };
  }

  private advanceOperations(): void {
    for (const operative of this.operatives) {
      const mission = operative.mission;
      if (!mission) continue;
      mission.elapsed += 1;
      if (mission.elapsed < mission.days) continue;
      this.politicalPower += mission.reward;
      operative.mission = null;
      const target = this.world.countries[mission.targetId];
      const entry: NotificationEntry = {
        id: this.takeId(),
        date: this.dateLabel,
        title: 'Operation complete',
        text: `${operative.name} returned from ${target?.name ?? 'abroad'}. "${mission.name}" yielded ${mission.reward} political power.`,
        kind: 'good',
        screen: 'intelligence',
      };
      this.notifications.unshift(entry);
      this.missionLog.unshift(entry);
      if (this.notifications.length > 80) this.notifications.length = 80;
      this.unread += 1;
    }
  }

  // ---------------------------------------------------------------- events

  private eventConditionsMet(event: GameEventDef): boolean {
    const conditions = event.conditions;
    if (!conditions) return true;
    if (typeof conditions.minStability === 'number' && this.stability < conditions.minStability) return false;
    if (typeof conditions.maxStability === 'number' && this.stability > conditions.maxStability) return false;
    if (typeof conditions.minLegitimacy === 'number' && this.political.legitimacy < conditions.minLegitimacy) return false;
    if (typeof conditions.maxLegitimacy === 'number' && this.political.legitimacy > conditions.maxLegitimacy) return false;
    if (typeof conditions.minTension === 'number' && this.political.tension < conditions.minTension) return false;
    if (typeof conditions.maxTension === 'number' && this.political.tension > conditions.maxTension) return false;
    if (typeof conditions.minRevolutionSupport === 'number' && this.political.revolutionSupport < conditions.minRevolutionSupport) return false;
    if (conditions.systems?.length && !conditions.systems.includes(this.political.systemId)) return false;
    if (conditions.ideologies?.length && !conditions.ideologies.includes(this.political.ideology)) return false;
    if (conditions.flags?.some((flag) => !this.politics.hasFlag(flag))) return false;
    if (conditions.notFlags?.some((flag) => this.politics.hasFlag(flag))) return false;
    if (conditions.minInfluence) {
      const group = this.politics.group(conditions.minInfluence.group);
      if (!group || group.influence < conditions.minInfluence.value) return false;
    }
    return true;
  }

  private checkEvents(): void {
    if (this.pendingEvent) return;
    for (const event of [...this.content.events, ...this.content.politics.events]) {
      if (this.firedEvents.has(event.id)) continue;
      if (event.tag && event.tag !== this.country.tag) continue;
      if (this.isoDate < event.date) continue;
      if (!this.eventConditionsMet(event)) continue;
      this.firedEvents.add(event.id);
      this.pendingEvent = event;
      this.paused = true;
      return;
    }
  }

  resolveEvent(optionIndex: number): void {
    const event = this.pendingEvent;
    if (!event) return;
    const option = event.options[optionIndex] ?? event.options[0];
    this.applyBundle(option?.bundle);
    sumRates(this.extraRates, option?.rates);
    if (option?.political) this.applyPoliticalEffect(option.political);
    if (event.political) this.recordHistory('crisis', event.title, option?.detail ?? event.body, 'scroll');
    this.notify('info', event.title, `${event.category}: ${option?.label ?? 'Acknowledged'}.`, 'decisions');
    this.pendingEvent = null;
    if (option?.followUp) {
      const followUp = this.content.politics.events.find((entry) => entry.id === option.followUp);
      if (followUp && !this.firedEvents.has(followUp.id) && this.eventConditionsMet(followUp)) {
        this.firedEvents.add(followUp.id);
        this.pendingEvent = followUp;
        this.paused = true;
      }
    }
  }

  // ---------------------------------------------------------------- politics

  get politicalSystem() {
    return systemById(this.content.politics, this.political.systemId);
  }

  politicalContext(): PoliticalContext {
    return { stability: this.stability, politicalPower: this.politicalPower, day: this.day };
  }

  recordHistory(type: PoliticalHistoryType, title: string, description: string, icon = 'scroll'): void {
    this.politicalHistory.unshift({
      id: this.takeId(),
      day: this.day,
      date: this.dateLabel,
      type,
      title,
      description,
      icon,
      systemId: this.political.systemId,
      leader: this.political.leaderName,
    });
    if (this.politicalHistory.length > 120) this.politicalHistory.length = 120;
  }

  politicalTransitions(): PoliticalTransitionDef[] {
    const allowed = this.content.def.political?.transitions;
    return this.content.politics.transitions.filter((entry) =>
      !allowed || allowed.includes(entry.id),
    ).filter((entry) => entry.kind === 'peaceful' || entry.kind === 'constitutional' || entry.kind === 'postwar');
  }

  transitionMissing(id: string): string[] {
    const def = transitionById(this.content.politics, id);
    if (!def) return ['Unknown transition'];
    return this.politics.missingTransitionRequirements(def, this.politicalContext());
  }

  executeTransition(id: string, source: 'council' | 'focus' = 'council'): ActionResult {
    const def = transitionById(this.content.politics, id);
    if (!def) return { ok: false, message: 'Unknown transition.' };
    if (def.kind === 'coup' || (def.kind === 'revolution' && source !== 'focus')) return { ok: false, message: 'This transition must be resolved through its own political mechanism.' };
    const missing = this.politics.missingTransitionRequirements(def, this.politicalContext());
    if (source !== 'focus' && missing.length > 0) return { ok: false, message: `Missing: ${missing.join(', ')}.` };
    this.politicalPower = Math.max(0, this.politicalPower - def.cost);
    this.political.systemId = def.targetSystemId;
    if (def.targetIdeology) this.political.ideology = def.targetIdeology;
    if (def.targetLeaderName) this.political.leaderName = def.targetLeaderName;
    if (def.targetLeaderTitle) this.political.leaderTitle = def.targetLeaderTitle;
    if (typeof def.legitimacyAfter === 'number') this.political.legitimacy = clamp(def.legitimacyAfter);
    if (typeof def.stabilityAfter === 'number') this.stability = clamp(def.stabilityAfter);
    for (const change of def.groupChanges ?? []) {
      const group = this.politics.group(change.name);
      if (!group) continue;
      if (typeof change.popularity === 'number') group.popularity = clamp(group.popularity + change.popularity);
      if (typeof change.influence === 'number') group.influence = clamp100(group.influence + change.influence);
      if (change.inGovernment) {
        for (const entry of this.political.groups) entry.inGovernment = false;
        group.inGovernment = true;
      }
    }
    for (const flag of def.unlockFlags ?? []) this.politics.addFlag(flag);
    this.political.tension = clamp100(this.political.tension - 6);
    this.cancelInvalidFocus();
    this.recordHistory('system', def.historyTitle, def.historyText, def.icon);
    this.notify('good', def.historyTitle, def.historyText, 'politics');
    return { ok: true, message: def.historyTitle };
  }

  private cancelInvalidFocus(): void {
    if (!this.focus) return;
    const active = this.focusById(this.focus.id);
    if (!active) return;
    if (this.focusState(active.id) !== 'invalidated') return;
    this.focus = null;
    this.recordHistory('crisis', 'A Focus Was Cancelled', `${active.name} was abandoned because the new constitution closed its political path. Its political power cost was not refunded.`, 'scroll');
    this.notify('warn', 'Focus cancelled', `${active.name} was invalidated by the political transition.`, 'focus');
  }

  useMechanicAction(id: string): ActionResult {
    const action = this.politics.mechanic()?.actions.find((entry) => entry.id === id);
    if (!action) return { ok: false, message: 'Unknown political action.' };
    if (this.politicalPower < action.cost) return { ok: false, message: `Requires ${action.cost} political power.` };
    this.politicalPower -= action.cost;
    this.applyEffects(action.effects);
    this.notify('info', action.name, action.description, 'politics');
    return { ok: true, message: action.name };
  }

  campaignGroup(name: string): ActionResult {
    const group = this.politics.group(name);
    if (!group) return { ok: false, message: 'Unknown political group.' };
    const cost = 15;
    if (this.politicalPower < cost) return { ok: false, message: `Requires ${cost} political power.` };
    this.politicalPower -= cost;
    group.popularity = clamp(group.popularity + 0.02);
    group.influence = clamp100(group.influence + 3);
    this.political.tension = clamp100(this.political.tension + 1);
    this.notify('info', 'Campaign launched', `${group.name} gains public support in the constituencies.`, 'politics');
    return { ok: true, message: `${group.name} campaign launched.` };
  }

  suppressGroup(name: string): ActionResult {
    const group = this.politics.group(name);
    if (!group) return { ok: false, message: 'Unknown political group.' };
    const cost = 20;
    if (this.politicalPower < cost) return { ok: false, message: `Requires ${cost} political power.` };
    this.politicalPower -= cost;
    group.popularity = clamp(group.popularity - 0.02);
    group.influence = clamp100(group.influence - 2);
    this.political.tension = clamp100(this.political.tension + 3);
    this.stability = clamp(this.stability - 0.005);
    this.notify('warn', 'Opposition suppressed', `${group.name} loses influence, but the political temperature rises.`, 'politics');
    return { ok: true, message: `${group.name} suppressed.` };
  }

  revolutionStatus(): { ready: boolean; missing: string[]; strength: number } {
    const missing: string[] = [];
    if (this.political.revolutionSupport < 30) missing.push('Revolutionary support 30');
    if (this.political.revolutionOrganization < 20) missing.push('Revolutionary organisation 20');
    if (this.stability > 0.55 && this.political.legitimacy > 0.4) missing.push('Stability below 55% or legitimacy below 40%');
    if (this.day - this.political.lastRevolutionDay < 180) missing.push('A revolutionary attempt is still being reorganised');
    return { ready: missing.length === 0, missing, strength: Math.round(this.politics.revolutionStrength(this.politicalContext())) };
  }

  launchRevolution(): ActionResult {
    const status = this.revolutionStatus();
    if (!status.ready) return { ok: false, message: `Missing: ${status.missing.join(', ')}.` };
    const strength = this.politics.revolutionStrength(this.politicalContext());
    this.political.lastRevolutionDay = this.day;
    if (strength >= 45) {
      const leader = this.politics.strongestGroup('communism');
      this.political.systemId = 'revolutionary_state';
      this.political.mechanicId = 'revolutionary_support';
      this.political.ideology = 'communism';
      this.political.leaderName = leader?.leader ?? 'Revolutionary Council';
      this.political.leaderTitle = 'Chair of the Revolutionary Council';
      this.political.legitimacy = 0.5;
      this.political.tension = 35;
      this.political.revolutionSupport = clamp100(this.political.revolutionSupport + 10);
      if (leader) {
        for (const group of this.political.groups) group.inGovernment = false;
        leader.inGovernment = true;
      }
      this.politics.addFlag('workers_government');
      this.stability = 0.35;
      this.cancelInvalidFocus();
      this.recordHistory('revolution', 'The Revolution Triumphs', 'The old government has fallen. Workers\' councils and revolutionary committees have proclaimed a new state.', 'flame');
      this.notify('bad', 'Revolution', 'The revolutionary movement has taken power and proclaimed a new government.', 'politics');
      return { ok: true, message: 'The revolution has triumphed.' };
    }
    this.political.revolutionSupport = clamp100(this.political.revolutionSupport - 12);
    this.political.revolutionOrganization = clamp100(this.political.revolutionOrganization - 8);
    this.political.governmentLoyalty = clamp100(this.political.governmentLoyalty + 6);
    this.stability = clamp(this.stability - 0.08);
    this.political.tension = clamp100(this.political.tension + 10);
    this.recordHistory('crisis', 'The Revolution is Defeated', 'The uprising was isolated and broken. The government has survived, but its authority rests on repression rather than consent.', 'flame');
    this.notify('warn', 'Revolution defeated', 'The revolutionary attempt failed. The government remains in power, weakened and embittered.', 'politics');
    return { ok: false, message: 'The revolution was defeated.' };
  }

  coupTargets() {
    return this.political.groups.filter((group) => !group.inGovernment && group.influence >= 15);
  }

  coupChance(name: string): number {
    return Math.max(5, Math.min(95, Math.round(this.politics.coupStrength(name, this.politicalContext()))));
  }

  attemptCoup(name: string): ActionResult {
    const group = this.politics.group(name);
    if (!group) return { ok: false, message: 'Unknown political group.' };
    if (group.inGovernment) return { ok: false, message: 'A governing group cannot coup itself.' };
    if (this.day - this.political.lastCoupDay < 180) return { ok: false, message: 'The officer corps is still reorganising after the last attempt.' };
    const strength = this.politics.coupStrength(name, this.politicalContext());
    this.political.lastCoupDay = this.day;
    if (strength >= 48) {
      for (const entry of this.political.groups) entry.inGovernment = false;
      group.inGovernment = true;
      this.political.systemId = 'military_junta';
      this.political.mechanicId = 'council_authority';
      this.political.ideology = 'authoritarian';
      this.political.leaderName = group.leader;
      this.political.leaderTitle = 'Chairman of the Military Council';
      this.political.legitimacy = 0.46;
      this.stability = 0.34;
      this.political.tension = clamp100(this.political.tension + 12);
      this.politics.addFlag('military_rule');
      this.cancelInvalidFocus();
      this.recordHistory('coup', 'The Army Takes Power', `${group.name}, led by ${group.leader}, has seized the government. The constitution is suspended and the parties are dissolved.`, 'swords');
      this.notify('bad', 'Coup d\'état', `${group.leader} has seized power in the name of order.`, 'politics');
      return { ok: true, message: 'The coup succeeded.' };
    }
    group.influence = clamp100(group.influence - 9);
    this.political.governmentLoyalty = clamp100(this.political.governmentLoyalty + 5);
    this.stability = clamp(this.stability - 0.05);
    this.political.tension = clamp100(this.political.tension + 9);
    this.recordHistory('crisis', 'The Coup Fails', `An attempt by ${group.name} to seize power collapsed. Its leaders have been arrested or driven into exile.`, 'swords');
    this.notify('warn', 'Coup defeated', `${group.name} failed to seize power. The government has survived, at a price.`, 'politics');
    return { ok: false, message: 'The coup failed.' };
  }

  // ---------------------------------------------------------------- save / load

  saveKey(): string {
    return `iron-frontiers-save-${this.country.tag}`;
  }

  saveGame(): boolean {
    try {
      const data = {
        version: 1,
        tag: this.country.tag,
        date: this.date.toISOString(),
        day: this.day,
        paused: this.paused,
        speed: this.speed,
        politicalPower: this.politicalPower,
        stability: this.stability,
        warSupport: this.warSupport,
        manpower: this.manpower,
        treasury: this.treasury,
        civilianFactories: this.civilianFactories,
        militaryFactories: this.militaryFactories,
        dockyards: this.dockyards,
        infrastructure: this.infrastructure,
        resources: this.resources,
        focus: this.focus,
        completedFocuses: [...this.completedFocuses],
        bypassedFocuses: [...this.bypassedFocuses],
        extraRates: this.extraRates,
        research: this.research,
        completedTechs: [...this.completedTechs],
        lines: this.lines,
        stockpile: this.stockpile,
        construction: this.construction,
        nextId: this.nextId,
        advisors: this.advisors,
        divisions: this.divisions,
        commanders: this.commanders,
        notifications: this.notifications,
        unread: this.unread,
        firedEvents: [...this.firedEvents],
        selectedCountryId: this.selectedCountryId,
        selectedProvinceId: this.selectedProvinceId,
        relationBonus: [...this.relationBonus.entries()],
        tradeAgreements: [...this.tradeAgreements],
        guarantees: [...this.guarantees],
        operatives: this.operatives,
        missionLog: this.missionLog,
        lastDecisionDay: [...this.lastDecisionDay.entries()],
        political: this.political,
        politicalHistory: this.politicalHistory,
      };
      localStorage.setItem(this.saveKey(), JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  loadGame(): boolean {
    try {
      const raw = localStorage.getItem(this.saveKey());
      if (!raw) return false;
      return this.restoreSave(JSON.parse(raw));
    } catch {
      return false;
    }
  }

  restoreSave(data: Record<string, unknown>): boolean {
    if (!data || data.version !== 1 || data.tag !== this.country.tag) return false;
    this.date = new Date(String(data.date));
    this.day = Number(data.day ?? 0);
    this.paused = Boolean(data.paused);
    this.speed = Number(data.speed ?? 3);
    this.politicalPower = Number(data.politicalPower ?? 0);
    this.stability = clamp(Number(data.stability ?? 0.5));
    this.warSupport = clamp(Number(data.warSupport ?? 0.3));
    this.manpower = Number(data.manpower ?? 0);
    this.treasury = Number(data.treasury ?? 0);
    this.civilianFactories = Number(data.civilianFactories ?? 1);
    this.militaryFactories = Number(data.militaryFactories ?? 0);
    this.dockyards = Number(data.dockyards ?? 0);
    this.infrastructure = Number(data.infrastructure ?? 0);
    this.resources = { ...(data.resources as CountryResources) };
    this.focus = (data.focus as FocusProgress | null) ?? null;
    this.completedFocuses = new Set(data.completedFocuses as string[]);
    this.bypassedFocuses = new Set((data.bypassedFocuses as string[]) ?? []);
    this.extraRates = (data.extraRates as RateBundle) ?? {};
    this.research = (data.research as (ResearchProgress | null)[]) ?? [];
    this.completedTechs = new Set(data.completedTechs as string[]);
    this.lines = (data.lines as ProductionLineState[]) ?? [];
    this.stockpile = (data.stockpile as Record<string, number>) ?? {};
    this.construction = (data.construction as ConstructionState[]) ?? [];
    this.nextId = Number(data.nextId ?? 1);
    this.advisors = (data.advisors as Record<AdvisorSlot, string | null>) ?? this.advisors;
    this.divisions = (data.divisions as DivisionState[]) ?? [];
    this.commanders = (data.commanders as CommanderDef[]) ?? [];
    this.notifications = (data.notifications as NotificationEntry[]) ?? [];
    this.unread = Number(data.unread ?? 0);
    this.firedEvents = new Set(data.firedEvents as string[]);
    this.selectedCountryId = Number(data.selectedCountryId ?? this.countryId);
    this.selectedProvinceId = Number(data.selectedProvinceId ?? 0);
    this.relationBonus = new Map(data.relationBonus as [number, number][]);
    this.tradeAgreements = new Set(data.tradeAgreements as number[]);
    this.guarantees = new Set(data.guarantees as number[]);
    this.operatives = (data.operatives as OperativeState[]) ?? [];
    this.missionLog = (data.missionLog as NotificationEntry[]) ?? [];
    this.lastDecisionDay = new Map(data.lastDecisionDay as [string, number][]);
    this.political = data.political as PoliticalState;
    this.politics = new PoliticalManager(this.political, this.content.politics);
    this.politicalHistory = (data.politicalHistory as PoliticalHistoryEntry[]) ?? [];
    this.pendingEvent = null;
    return true;
  }

  // ---------------------------------------------------------------- alerts

  alerts(): GameAlert[] {
    const list: GameAlert[] = [];
    if (!this.focus && this.availableFocuses().length > 0) {
      list.push({ id: 'focus', text: 'No national focus selected', kind: 'info', screen: 'focus' });
    }
    if (this.research.some((slot) => slot === null) && this.content.technologies.length > 0) {
      list.push({ id: 'research', text: 'A research slot is idle', kind: 'info', screen: 'research' });
    }
    if (this.availableMilitaryFactories > 0) {
      list.push({ id: 'factories', text: `${this.availableMilitaryFactories} military factories are unassigned`, kind: 'warn', screen: 'production' });
    }
    if (this.treasury < 0) {
      list.push({ id: 'deficit', text: 'The treasury is in deficit', kind: 'bad', screen: 'construction' });
    }
    const shortages = this.resourceShortages();
    if (shortages.length > 0) {
      list.push({ id: 'resources', text: `Resource shortage: ${shortages.map((entry) => entry.resource).join(', ')}`, kind: 'warn', screen: 'production' });
    }
    if (this.construction.length === 0) {
      list.push({ id: 'construction', text: 'Construction queue is empty', kind: 'info', screen: 'construction' });
    }
    if (this.stability < 0.3) {
      list.push({ id: 'stability', text: 'Stability is critically low', kind: 'bad', screen: 'politics' });
    }
    const ready = this.country.decisions.filter((decision) => this.decisionReady(decision));
    if (ready.length > 0) {
      list.push({ id: 'decisions', text: `${ready.length} political decisions available`, kind: 'info', screen: 'decisions' });
    }
    for (const operative of this.operatives) {
      if (operative.mission && operative.mission.elapsed >= operative.mission.days - 1) {
        list.push({ id: `op-${operative.id}`, text: `${operative.name} is about to report back`, kind: 'info', screen: 'intelligence' });
      }
    }
    return list;
  }

  // ---------------------------------------------------------------- simulation

  togglePause(): void {
    this.paused = !this.paused;
    if (this.pendingEvent) this.paused = true;
  }

  advance(days: number): void {
    const whole = Math.max(0, Math.floor(days));
    for (let i = 0; i < whole; i++) this.advanceDay();
  }

  private advanceDay(): void {
    this.date.setDate(this.date.getDate() + 1);
    this.day += 1;

    const rates = this.nationalRates;
    this.politicalPower += this.ppPerDay;
    this.treasury += this.income - this.expenses;
    this.manpower = Math.max(0, this.manpower + Math.round(300 + this.militaryFactories * 6 + (rates.manpowerPerDay ?? 0)));
    const deficitPenalty = this.treasury < 0 ? 0.0008 : 0;
    this.stability = clamp(this.stability + (rates.stabilityDrift ?? 0) - deficitPenalty);
    this.warSupport = clamp(this.warSupport + (rates.warSupportDrift ?? 0));

    // Political temperature and revolutionary pressure evolve from the material situation.
    this.political.tension = clamp100(this.political.tension - 0.012);
    const pressure = (1 - this.stability) * 0.055 + (1 - this.political.legitimacy) * 0.04;
    this.political.revolutionSupport = clamp100(this.political.revolutionSupport + pressure - 0.025);
    this.political.revolutionOrganization = clamp100(this.political.revolutionOrganization + pressure * 0.45);
    this.political.governmentLoyalty = clamp100(this.political.governmentLoyalty + (this.stability > 0.5 ? 0.02 : -0.03));
    if (this.stability < 0.25) this.political.tension = clamp100(this.political.tension + 0.03);

    if (this.focus) {
      this.focus.elapsed += 1;
      const focus = this.focusById(this.focus.id);
      if (focus && this.focus.elapsed >= focus.days) this.completeFocus();
    }

    this.research.forEach((progress, index) => {
      if (!progress) return;
      progress.elapsed += 1 + this.researchSpeed;
      const tech = this.techById(progress.techId);
      if (tech && progress.elapsed >= tech.days) {
        this.completedTechs.add(tech.id);
        this.research[index] = null;
        sumRates(this.extraRates, tech.rates);
        this.notify('good', 'Research complete', `${tech.name} is available to the army. ${tech.bonuses.join(' · ')}`, 'research');
      }
    });

    this.advanceProduction();
    this.advanceConstruction();
    this.advanceOperations();
    this.checkEvents();
  }

  private advanceProduction(): void {
    const shortages = this.resourceShortages();
    const penalty = shortages.length > 0 ? 0.6 : 1;
    for (const line of this.lines) {
      if (line.paused || line.factories === 0) continue;
      const equipment = this.equipmentOf(line);
      if (!equipment) continue;
      const efficiencyCap = 0.55 + (this.nationalRates.productionEfficiency ?? 0);
      line.efficiency = Math.min(efficiencyCap, line.efficiency + 0.0018);
      line.progress += this.lineOutput(line) * equipment.cost * penalty;
      while (line.progress >= equipment.cost) {
        line.progress -= equipment.cost;
        line.produced += 1;
        this.stockpile[equipment.id] = (this.stockpile[equipment.id] ?? 0) + 1;
      }
    }
  }

  private advanceConstruction(): void {
    if (this.construction.length === 0) return;
    const item = this.construction[0];
    item.progress += this.constructionPerDay;
    if (item.progress < item.cost) return;
    const building = buildingById(item.buildingId);
    this.construction.shift();
    if (!building) return;
    if (building.id === 'anti_air') {
      this.stability = clamp(this.stability + 0.01);
    } else {
      const resource = building.resource;
      if (resource === 'infrastructure') this.infrastructure = clamp(this.infrastructure + 1, 0, 10);
      else if (resource === 'civilianFactories') this.civilianFactories += 1;
      else if (resource === 'militaryFactories') this.militaryFactories += 1;
      else if (resource === 'dockyards') this.dockyards += 1;
    }
    this.notify('good', 'Construction complete', `${building.name} finished. ${building.effect}.`, 'construction');
  }
}
