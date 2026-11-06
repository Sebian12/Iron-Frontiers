import type { ContentBundle } from './content';
import { GameState } from './gameState';

export interface PoliticalTestResult {
  name: string;
  ok: boolean;
  detail: string;
}

// Lightweight in-browser verification of the political simulation. It runs against fresh state
// instances so a player's campaign is never modified.
export function runPoliticalSelfTests(world: GameState['world'], content: ContentBundle, countryId: number): PoliticalTestResult[] {
  const results: PoliticalTestResult[] = [];
  const test = (name: string, fn: () => string | true) => {
    try {
      const detail = fn();
      results.push({ name, ok: true, detail: detail === true ? 'passed' : detail });
    } catch (error) {
      results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
    }
  };
  const fresh = () => new GameState(world, content, countryId);
  const prefix = `pol_${content.def.tag.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const nationalRoot = content.tree.focuses.find((focus) => focus.branch === 'national'
    && !(focus.prerequisites?.length) && !(focus.prerequisitesAny?.length))?.id;

  test('four political directions with mutual exclusion', () => {
    const politicalFocuses = content.tree.focuses.filter((focus) => focus.id.startsWith(`${prefix}_`) && focus.branch && focus.branch !== 'settlement');
    const branches = new Set(politicalFocuses.map((focus) => focus.branch));
    if (branches.size < 4) throw new Error(`Only ${branches.size} political directions found`);
    const entries = politicalFocuses.filter((focus) => {
      const parents = [...(focus.prerequisites ?? []), ...(focus.prerequisitesAny ?? [])];
      return parents.length === 0 || Boolean(nationalRoot && parents.includes(nationalRoot));
    });
    if (entries.length < 4) throw new Error('Missing entry focuses');
    if (nationalRoot && entries.some((focus) => !(focus.prerequisites ?? []).includes(nationalRoot))) {
      throw new Error('Political entry focuses do not share the national root');
    }
    if (!entries[0].mutuallyExclusive?.includes(entries[1].id)) throw new Error('Entry focuses are not mutually exclusive');
    return `${branches.size} directions, ${entries[0].mutuallyExclusive?.length ?? 0} exclusions on the first entry${nationalRoot ? `, common root ${nationalRoot}` : ''}`;
  });

  test('political focus rewards apply exactly once', () => {
    const state = fresh();
    const focus = content.tree.focuses.find((entry) => entry.id === `${prefix}_democratic_1`);
    if (!focus) throw new Error('Democratic entry focus missing');
    if (nationalRoot) state.completedFocuses.add(nationalRoot);
    const ppBefore = state.politicalPower;
    const start = state.startFocus(focus.id);
    if (!start.ok) throw new Error(start.message);
    state.advance(focus.days);
    if (!state.completedFocuses.has(focus.id)) throw new Error('Focus did not complete');
    if (!state.politics.hasFlag('democratic_movement')) throw new Error('Political flag not applied');
    const ppAfter = state.politicalPower;
    state.advance(10);
    if (!state.completedFocuses.has(focus.id)) throw new Error('Completion lost');
    if (state.startFocus(focus.id).ok) throw new Error('Completed focus started again');
    return `PP ${Math.round(ppBefore)} -> ${Math.round(ppAfter)}; duplicate start rejected`;
  });

  test('peaceful constitutional transition', () => {
    const state = fresh();
    state.politicalPower = 1000;
    state.political.legitimacy = 0.8;
    state.stability = 0.6;
    const transition = state.politicalTransitions().find((entry) => entry.id === 'parliamentary_republic');
    if (!transition) throw new Error('No parliamentary transition configured');
    const before = state.politicalHistory.length;
    const result = state.executeTransition(transition.id);
    if (!result.ok) throw new Error(result.message);
    if (state.political.systemId !== 'parliamentary_republic') throw new Error('System did not change');
    if (state.politicalHistory.length <= before) throw new Error('Transition not recorded in history');
    const oldInstitution = content.tree.focuses.find((focus) => focus.id === `${prefix}_institution_authoritarian`);
    if (oldInstitution && state.focusState(oldInstitution.id) !== 'invalidated') throw new Error('Old constitution focus not invalidated');
    return `System now ${state.political.systemId}; legitimacy ${Math.round(state.political.legitimacy * 100)}%`;
  });

  test('successful revolution changes government', () => {
    const state = fresh();
    state.political.revolutionSupport = 55;
    state.political.revolutionOrganization = 45;
    state.political.governmentLoyalty = 20;
    state.political.legitimacy = 0.3;
    state.stability = 0.28;
    const status = state.revolutionStatus();
    if (!status.ready) throw new Error(`Revolution not ready: ${status.missing.join(', ')}`);
    const result = state.launchRevolution();
    if (!result.ok) throw new Error(result.message);
    if (state.political.systemId !== 'revolutionary_state') throw new Error('Revolutionary state not established');
    if (!state.politicalHistory.some((entry) => entry.type === 'revolution')) throw new Error('Revolution absent from history');
    return `Revolutionary state, leader ${state.political.leaderName}`;
  });

  test('coup attempt resolves and is recorded', () => {
    const state = fresh();
    const target = [...state.political.groups].filter((group) => !group.inGovernment).sort((a, b) => b.influence - a.influence)[0];
    if (!target) throw new Error('No coup target');
    target.influence = 85;
    state.stability = 0.2;
    state.political.tension = 60;
    const result = state.attemptCoup(target.name);
    if (!state.politicalHistory.some((entry) => entry.type === 'coup' || entry.type === 'crisis')) throw new Error('Coup outcome not recorded');
    return `${result.ok ? 'coup succeeded' : 'coup failed'}: ${result.message}`;
  });

  test('political save and load round-trip', () => {
    const state = fresh();
    state.political.legitimacy = 0.42;
    state.political.flags.push('test_persistence');
    const key = state.saveKey();
    const previous = localStorage.getItem(key);
    if (!state.saveGame()) throw new Error('saveGame returned false');
    state.political.legitimacy = 0.99;
    state.politics.state.flags = [];
    if (!state.loadGame()) throw new Error('loadGame returned false');
    if (Math.abs(state.political.legitimacy - 0.42) > 0.001) throw new Error('Legitimacy not restored');
    if (!state.politics.hasFlag('test_persistence')) throw new Error('Political flag not restored');
    if (previous === null) localStorage.removeItem(key);
    else localStorage.setItem(key, previous);
    return 'political state, history and flags restored';
  });

  return results;
}
