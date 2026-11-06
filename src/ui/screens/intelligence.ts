import { OPERATIONS, type IntelligenceOperation } from '../../data/intelligence';
import { button, div, icon, panel, portrait, span, tag, withTip } from '../components';
import type { Screen, ScreenContext } from '../screen';
import { screenFrame } from '../screen';
import { days, fmt, pct } from '../format';

// Intelligence: operatives, missions against a chosen target, and the mission log.

const RISK_TONE = { low: 'green', moderate: 'gold', high: 'red' } as const;

export function mountIntelligence(ctx: ScreenContext): Screen {
  const { state } = ctx;
  const provinces = new Map<number, number>();
  for (const province of state.world.provinces) {
    if (province.owner !== 0) provinces.set(province.owner, (provinces.get(province.owner) ?? 0) + 1);
  }
  const targets = state.world.countries.filter((country) => country.id !== 0 && country.id !== state.countryId && (provinces.get(country.id) ?? 0) > 0);

  let targetId = targets.find((country) => country.id === state.selectedCountryId)?.id ?? targets[0]?.id ?? 0;

  const ppBadge = span('if-tag if-tag--gold', `PP ${fmt(state.politicalPower)}`);
  const capacityBadge = span('if-tag if-tag--blue', `${state.idleOperatives.length} / ${state.operativeCapacity} operatives idle`);
  const frame = screenFrame('eye', 'Intelligence', `${state.country.agency?.name ?? 'State Intelligence Service'} · operatives and covert action`, [capacityBadge, ppBadge], 'if-screen__body--flush');
  const layout = div('if-intel-layout');
  frame.body.append(layout);

  const left = div('if-intel-col');
  const center = div('if-intel-col');
  const right = div('if-intel-col');
  layout.append(left, center, right);

  const agentPanel = panel('Operatives', 'spy', { subtitle: 'One mission per agent' });
  const agentHost = div('');
  agentPanel.body.append(agentHost);
  left.append(agentPanel.element);

  const targetPanel = panel('Target Nation', 'target');
  const targetSelect = document.createElement('select');
  targetSelect.className = 'if-select';
  targetSelect.setAttribute('aria-label', 'Intelligence target');
  for (const country of targets) {
    const option = document.createElement('option');
    option.value = String(country.id);
    option.textContent = country.name;
    targetSelect.append(option);
  }
  targetSelect.value = String(targetId);
  targetSelect.addEventListener('change', () => {
    targetId = Number(targetSelect.value);
    state.selectedCountryId = targetId;
    ctx.map.highlightCountry(targetId);
    renderOperations();
  });
  targetPanel.body.append(targetSelect, div('if-hint', 'Select a foreign nation, then launch an operation from the list.'));
  left.append(targetPanel.element);

  const opPanel = panel('Covert Operations', 'lock', { subtitle: 'Costs political power' });
  const opHost = div('if-oplist');
  opPanel.body.append(opHost);
  center.append(opPanel.element);

  const logPanel = panel('Mission Log', 'scroll');
  const logHost = div('');
  logPanel.body.append(logHost);
  right.append(logPanel.element);

  const agencyPanel = panel('Agency', 'eye');
  agencyPanel.body.append(
    div('if-hint', state.country.agency?.description ?? 'A small intelligence service reporting directly to the cabinet.'),
    div('if-kv', span('if-kv__label', 'Operative capacity'), span('if-kv__value', String(state.operativeCapacity))),
    div('if-kv', span('if-kv__label', 'Agents in the field'), span('if-kv__value', String(state.operatives.length - state.idleOperatives.length))),
    div('if-kv', span('if-kv__label', 'Completed missions'), span('if-kv__value', String(state.missionLog.length))),
    div('if-hint', 'Operations resolve automatically after their duration and return political power. A free operative is required to launch.'),
  );
  right.append(agencyPanel.element);

  let agentRefs: { operativeId: number; fill?: HTMLElement; days?: HTMLElement; missionState?: HTMLElement }[] = [];

  function renderOperatives(): void {
    agentHost.replaceChildren();
    agentRefs = [];
    for (const operative of state.operatives) {
      const card = div(`if-operative${operative.mission ? ' is-busy' : ''}`);
      card.append(portrait(operative.portrait, state.country.accent, 'sm'));
      const body = div('if-operative__body');
      body.append(span('if-operative__name', operative.name));
      if (!operative.mission) {
        body.append(span('if-operative__state', 'Idle · available for a mission'));
        card.append(body);
        card.append(tag('Ready', 'green'));
      } else {
        const mission = operative.mission;
        const target = state.world.countries[mission.targetId];
        body.append(span('if-operative__state', `${mission.name} · ${target?.name ?? 'abroad'}`));
        const line = div('if-progressline');
        const fill = span('');
        fill.style.width = `${Math.min(100, (mission.elapsed / Math.max(1, mission.days)) * 100)}%`;
        line.append(fill);
        const foot = div('if-row');
        const daysLeft = span('if-hint', days(Math.max(0, mission.days - mission.elapsed)));
        const stateLabel = span('if-hint', `${pct(Math.min(1, mission.elapsed / Math.max(1, mission.days)))}`);
        foot.append(daysLeft, stateLabel);
        body.append(line, foot);
        card.append(body);
        agentRefs.push({ operativeId: operative.id, fill, days: daysLeft, missionState: stateLabel });
      }
      agentHost.append(card);
    }
    agentHost.append(div('if-hint', 'Agents are assigned to missions in order. Completing a mission frees the agent automatically.'));
  }

  function operationButton(op: IntelligenceOperation): HTMLButtonElement {
    const btn = button('Launch', 'if-btn if-btn--sm if-btn--gold', () => {
      const result = state.startOperation(op.id, targetId);
      ctx.toast(result.message, result.ok ? 'good' : 'bad');
      if (!result.ok) return;
      renderAll();
    });
    const idle = state.idleOperatives.length > 0;
    btn.disabled = !idle || state.politicalPower < op.cost;
    if (!idle) withTip(btn, 'No operative is available.');
    else if (state.politicalPower < op.cost) withTip(btn, `Requires ${op.cost} political power.`);
    return btn;
  }

  function renderOperations(): void {
    opHost.replaceChildren();
    for (const op of OPERATIONS) {
      const card = div('if-opcard');
      const head = div('if-opcard__head');
      const iconBox = div('if-queueitem__icon');
      iconBox.append(icon(op.icon, 'if-ico'));
      const titleWrap = div('');
      titleWrap.append(span('if-opcard__name', op.name));
      const meta = div('if-opcard__meta');
      meta.append(tag(op.risk, RISK_TONE[op.risk]), span('', `${op.days} days`), span('', `${op.cost} PP`), span('', `+${op.reward} PP on return`));
      titleWrap.append(meta);
      head.append(iconBox, titleWrap);
      card.append(head, div('if-opcard__desc', op.description));
      const foot = div('if-row');
      foot.append(span('if-hint', `Target: ${state.world.countries[targetId]?.name ?? '—'}`), operationButton(op));
      card.append(foot);
      opHost.append(card);
    }
  }

  function renderLog(): void {
    logHost.replaceChildren();
    if (state.missionLog.length === 0) {
      logHost.append(div('if-hint', 'No operations have been completed yet.'));
      return;
    }
    for (const entry of state.missionLog.slice(0, 8)) {
      const row = div('if-logrow');
      const head = div('if-row');
      head.append(span('if-logrow__title', entry.title), span('if-hint', entry.date));
      row.append(head, span('if-hint', entry.text));
      logHost.append(row);
    }
  }

  function renderAll(): void {
    ppBadge.textContent = `PP ${fmt(state.politicalPower)}`;
    capacityBadge.textContent = `${state.idleOperatives.length} / ${state.operativeCapacity} operatives idle`;
    renderOperatives();
    renderOperations();
    renderLog();
  }

  let structural = '';
  function signature(): string {
    return `${state.idleOperatives.length}|${state.missionLog.length}|${state.politicalPower < 35}|${state.politicalPower < 50}|${state.politicalPower < 65}|${state.politicalPower < 80}`;
  }

  function refresh(): void {
    ppBadge.textContent = `PP ${fmt(state.politicalPower)}`;
    capacityBadge.textContent = `${state.idleOperatives.length} / ${state.operativeCapacity} operatives idle`;
    for (const ref of agentRefs) {
      const operative = state.operatives.find((entry) => entry.id === ref.operativeId);
      if (!operative?.mission) continue;
      const fraction = Math.min(1, operative.mission.elapsed / Math.max(1, operative.mission.days));
      if (ref.fill) ref.fill.style.width = `${fraction * 100}%`;
      if (ref.days) ref.days.textContent = days(Math.max(0, operative.mission.days - operative.mission.elapsed));
      if (ref.missionState) ref.missionState.textContent = pct(fraction);
    }
    const next = signature();
    if (next !== structural) {
      structural = next;
      renderAll();
    }
  }

  renderAll();
  structural = signature();
  if (targetId) ctx.map.highlightCountry(targetId);

  return {
    element: frame.element,
    refresh,
    destroy: () => ctx.map.highlightCountry(null),
  };
}
