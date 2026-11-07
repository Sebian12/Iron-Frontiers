import type { CountryResources } from '../../sim/content';
import { EQUIPMENT, type EquipmentDef } from '../../data/production';
import { RESOURCE_INFO } from '../format';
import { button, div, icon, panel, span } from '../components';
import type { Screen, ScreenContext } from '../screen';
import { screenFrame } from '../screen';
import { fmt } from '../format';

// Production: military factory allocation, efficiency, output and the equipment stockpile.

interface LineRefs {
  id: number;
  output: HTMLElement;
  efficiency: HTMLElement;
  efficiencyFill: HTMLElement;
  progress: HTMLElement;
  produced: HTMLElement;
}

export function mountProduction(ctx: ScreenContext): Screen {
  const { state } = ctx;
  const usedBadge = span('if-tag if-tag--gold', `${state.totalFactoriesUsed} / ${state.militaryFactories} factories`);
  const frame = screenFrame('gear', 'Production', `${state.country.name} · military industry and equipment stocks`, [usedBadge], 'if-screen__body--flush if-production-screen');
  const layout = div('if-prod-layout');
  frame.body.append(layout);

  const mainCol = div('if-prod-main');
  const sideCol = div('if-col');
  layout.append(mainCol, sideCol);

  const summaries = div('if-summarybar');
  const summaryRefs: HTMLElement[] = [];
  function summary(value: string, label: string): HTMLElement {
    const box = div('if-summary');
    const val = span('if-summary__value', value);
    box.append(val, span('if-summary__label', label));
    summaryRefs.push(val);
    return box;
  }
  summaries.append(
    summary(String(state.militaryFactories), 'Military factories'),
    summary(String(state.availableMilitaryFactories), 'Unassigned'),
    summary(`${Math.round((state.lines.reduce((sum, line) => sum + line.efficiency, 0) / Math.max(1, state.lines.length)) * 100)}%`, 'Average efficiency'),
    summary(`+${Math.round(state.factoryOutput * 100)}%`, 'Output bonus'),
  );
  mainCol.append(summaries);

  const linesPanel = panel('Production Lines', 'gear', { subtitle: 'Factories, efficiency and output' });
  const linesHost = div('');
  linesPanel.body.append(linesHost);
  mainCol.append(linesPanel.element);

  const catalogPanel = panel('Equipment Catalogue', 'factory', { subtitle: 'Click to add a line' });
  const catalog = div('if-equipgrid');
  catalogPanel.body.append(catalog);
  mainCol.append(catalogPanel.element);

  const stockPanel = panel('Stockpile', 'steel');
  const stockHost = div('');
  stockPanel.body.append(stockHost);
  sideCol.append(stockPanel.element);

  const resourcePanel = panel('Resources', 'oil');
  const resourceHost = div('');
  resourcePanel.body.append(resourceHost);
  sideCol.append(resourcePanel.element);

  const hintPanel = panel('Directorate Notes', 'scroll');
  hintPanel.body.append(
    div('if-hint', 'Each line needs factories from the military industry. Efficiency grows while a line runs; switching lines restarts it.'),
    div('if-hint', 'Lines consume steel, oil, rubber, aluminium, tungsten and chromium. The list order is the supply priority: top lines are filled first, and a starved line runs at 60% output.'),
    div('if-hint', 'Use ▲ / ▼ to move a line. The Trade screen sets how much raw output is exported instead of feeding these lines.'),
    button('Open trade law', 'if-btn if-btn--sm if-btn--block', () => ctx.open('trade')),
  );
  sideCol.append(hintPanel.element);

  let lineRefs: LineRefs[] = [];
  let stockRefs = new Map<string, HTMLElement>();
  let resourceRefs = new Map<keyof CountryResources, HTMLElement>();

  function needsMarkup(equipment: EquipmentDef): string {
    const entries = Object.entries(equipment.needs) as [keyof CountryResources, number][];
    return entries
      .map(([id, amount]) => {
        const info = RESOURCE_INFO.find((entry) => entry.id === id);
        return `<span>${iconMarkup(info?.icon ?? 'steel')}${amount}</span>`;
      })
      .join('');
  }

  function iconMarkup(name: string): string {
    return icon(name, 'if-ico').outerHTML;
  }

  function renderLines(): void {
    linesHost.replaceChildren();
    lineRefs = [];
    if (state.lines.length === 0) {
      linesHost.append(div('if-empty', div('if-hint', 'No production lines. Add equipment from the catalogue below.')));
      return;
    }
    for (const [lineIndex, line] of state.lines.entries()) {
      const equipment = state.equipmentOf(line);
      if (!equipment) continue;
      const row = div('if-line');

      const iconBox = div('if-line__icon');
      iconBox.innerHTML = iconMarkup(equipment.icon);
      const body = div('');
      body.append(span('if-line__name', equipment.name));
      const meta = div('if-line__meta');
      meta.append(span('if-line__priority', `Priority ${lineIndex + 1}`));
      meta.append(span('', line.paused ? 'Paused' : `${line.factories} factories`));
      meta.append(span('', `${line.efficiency.toFixed(2)} efficiency`));
      meta.append(span('', `${Math.round(state.lineSupplyMultiplier(line) * 100)}% supplied`));
      body.append(meta);

      const effWrap = div('');
      const effHead = div('if-row');
      effHead.append(span('if-hint', 'Efficiency'), span('if-hint', `${Math.round(line.efficiency * 100)}%`));
      const effLine = div('if-progressline');
      const effFill = span('');
      effFill.style.width = `${line.efficiency * 100}%`;
      effLine.append(effFill);
      effWrap.append(effHead, effLine);
      effWrap.style.minWidth = '90px';

      const controls = div('if-factoryctl');
      const up = button('▲', '', () => {
        state.moveLine(line.id, -1);
        ctx.rerender();
      });
      up.title = 'Raise production priority';
      up.disabled = lineIndex === 0;
      const down = button('▼', '', () => {
        state.moveLine(line.id, 1);
        ctx.rerender();
      });
      down.title = 'Lower production priority';
      down.disabled = lineIndex === state.lines.length - 1;
      const minus = button('−', '', () => {
        state.setLineFactories(line.id, line.factories - 1);
        ctx.rerender();
      });
      minus.disabled = line.factories <= 0;
      const value = span('if-factoryctl__value', String(line.factories));
      const plus = button('+', '', () => {
        state.setLineFactories(line.id, line.factories + 1);
        ctx.rerender();
      });
      plus.disabled = state.availableMilitaryFactories <= 0;
      const pause = button(line.paused ? '▶' : '❚❚', '', () => {
        state.toggleLine(line.id);
        ctx.rerender();
      });
      pause.title = line.paused ? 'Resume line' : 'Pause line';
      const remove = button('×', '', () => {
        state.removeLine(line.id);
        ctx.toast(`${equipment.name} line removed.`, 'warn');
        ctx.rerender();
      });
      remove.title = 'Remove line';
      controls.append(up, down, minus, value, plus, pause, remove);

      const out = div('if-line__out');
      const outValue = document.createElement('strong');
      outValue.textContent = `${state.lineOutput(line).toFixed(1)}/day`;
      const produced = document.createElement('small');
      produced.textContent = `${line.produced} built`;
      out.append(outValue, produced);

      const progressWrap = div('');
      progressWrap.style.gridColumn = '2 / -1';
      const progress = div('if-progressline');
      const progressFill = span('');
      progressFill.style.width = `${Math.min(100, (line.progress / Math.max(0.1, equipment.cost)) * 100)}%`;
      progress.append(progressFill);
      progressWrap.append(progress);
      row.append(iconBox, body, effWrap, controls, out, progressWrap);
      linesHost.append(row);

      lineRefs.push({ id: line.id, output: outValue, efficiency: effHead.lastElementChild as HTMLElement, efficiencyFill: effFill, progress: progressFill, produced });
    }
  }

  function renderCatalog(): void {
    catalog.replaceChildren();
    for (const equipment of EQUIPMENT) {
      const active = state.lines.some((line) => line.equipmentId === equipment.id);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'if-equip';
      card.innerHTML = `<span class="if-equip__head">${iconMarkup(equipment.icon)}<span class="if-equip__name">${equipment.name}</span></span><span class="if-equip__meta"><span>${equipment.cost.toFixed(1)} IC</span><span>${equipment.category}</span></span><span class="if-needs">${needsMarkup(equipment)}</span>`;
      card.disabled = active;
      card.title = active ? 'Already in production' : `Add ${equipment.name} to production`;
      card.addEventListener('click', () => {
        const result = state.addProductionLine(equipment.id);
        ctx.toast(result.message, result.ok ? 'good' : 'bad');
        if (result.ok) ctx.rerender();
      });
      catalog.append(card);
    }
  }

  function renderStock(): void {
    stockHost.replaceChildren();
    stockRefs = new Map();
    for (const equipment of EQUIPMENT) {
      const row = div('if-kv');
      row.style.fontSize = '11px';
      const left = span('if-kv__label');
      left.append(icon(equipment.icon, 'if-ico if-ico--sm'), document.createTextNode(` ${equipment.name}`));
      const value = span('if-kv__value', fmt(state.stockpileOf(equipment.id)));
      stockRefs.set(equipment.id, value);
      row.append(left, value);
      stockHost.append(row);
    }
  }

  function renderResources(): void {
    resourceHost.replaceChildren();
    resourceRefs = new Map();
    const needs = state.resourceNeeds();
    for (const info of RESOURCE_INFO) {
      const needed = needs[info.id] ?? 0;
      const available = state.resourceAvailable(info.id);
      const short = needed > available;
      const row = div(`if-res${short ? ' is-short' : ''}`);
      row.append(icon(info.icon, 'if-ico'), span('', info.name), span('if-res__value', `${fmt(available)} / ${needed > 0 ? `−${fmt(needed)}` : '—'}`));
      row.title = `Output ${fmt(state.resources[info.id])} · exported ${fmt(state.resourceExported(info.id))} · imported ${fmt(state.resourceImports()[info.id] ?? 0)}`;
      const value = row.querySelector<HTMLElement>('.if-res__value')!;
      resourceRefs.set(info.id, value);
      resourceHost.append(row);
    }
    resourceHost.append(div('if-hint', 'Available after exports and market imports / daily draw. Trade law controls the split.'));
    resourceHost.append(button(`Trade law: ${state.tradeLawDef.name}`, 'if-btn if-btn--sm if-btn--ghost if-btn--block', () => ctx.open('trade')));
  }

  function renderAll(): void {
    usedBadge.textContent = `${state.totalFactoriesUsed} / ${state.militaryFactories} factories`;
    renderLines();
    renderCatalog();
    renderStock();
    renderResources();
    summaryRefs[0].textContent = String(state.militaryFactories);
    summaryRefs[1].textContent = String(state.availableMilitaryFactories);
    summaryRefs[2].textContent = `${Math.round((state.lines.reduce((sum, line) => sum + line.efficiency, 0) / Math.max(1, state.lines.length)) * 100)}%`;
    summaryRefs[3].textContent = `+${Math.round(state.factoryOutput * 100)}%`;
  }

  function refresh(): void {
    for (const refs of lineRefs) {
      const line = state.lines.find((entry) => entry.id === refs.id);
      if (!line) continue;
      const equipment = state.equipmentOf(line);
      if (!equipment) continue;
      refs.output.textContent = `${state.lineOutput(line).toFixed(1)}/day`;
      refs.efficiency.textContent = `${Math.round(line.efficiency * 100)}%`;
      refs.efficiencyFill.style.width = `${line.efficiency * 100}%`;
      refs.progress.style.width = `${Math.min(100, (line.progress / Math.max(0.1, equipment.cost)) * 100)}%`;
      refs.produced.textContent = `${line.produced} built`;
    }
    for (const equipment of EQUIPMENT) stockRefs.get(equipment.id)?.replaceChildren(document.createTextNode(fmt(state.stockpileOf(equipment.id))));
    const needs = state.resourceNeeds();
    for (const info of RESOURCE_INFO) {
      const needed = needs[info.id] ?? 0;
      const available = state.resourceAvailable(info.id);
      const ref = resourceRefs.get(info.id);
      if (ref) ref.textContent = `${fmt(available)} / ${needed > 0 ? `−${fmt(needed)}` : '—'}`;
      ref?.parentElement?.classList.toggle('is-short', needed > available);
    }
    summaryRefs[1].textContent = String(state.availableMilitaryFactories);
    summaryRefs[2].textContent = `${Math.round((state.lines.reduce((sum, line) => sum + line.efficiency, 0) / Math.max(1, state.lines.length)) * 100)}%`;
    usedBadge.textContent = `${state.totalFactoriesUsed} / ${state.militaryFactories} factories`;
  }

  renderAll();
  return { element: frame.element, refresh };
}
