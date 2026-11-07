import { TRADE_LAWS, TRADE_LAW_CHANGE_COST } from '../../sim/trade';
import { RESOURCE_INFO } from '../format';
import { fmt } from '../format';
import { button, div, icon, panel, span, tag } from '../components';
import { flagImage } from '../flags';
import type { Screen, ScreenContext } from '../screen';
import { screenFrame } from '../screen';

// Trade: the national market, the four trade laws and the agreements that move resources and
// foreign exchange. Resource availability here is exactly what production sees.

export function mountTrade(ctx: ScreenContext): Screen {
  const { state } = ctx;
  const lawBadge = span('if-tag if-tag--gold', state.tradeLawDef.name);
  const frame = screenFrame(
    'exchange',
    'Trade & Market',
    `${state.country.name} · export law, resource balances and foreign partners`,
    [lawBadge],
    'if-screen__body--flush',
  );
  const layout = div('if-trade-layout');
  const mainCol = div('if-col');
  const sideCol = div('if-col');
  layout.append(mainCol, sideCol);
  frame.body.append(layout);

  // ---------------------------------------------------------------- laws
  const lawPanel = panel('Trade Law', 'exchange', { subtitle: `Changing the law costs ${TRADE_LAW_CHANGE_COST} political power` });
  const lawGrid = div('if-lawgrid');
  for (const law of TRADE_LAWS) {
    const active = law.id === state.tradeLaw;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `if-lawcard${active ? ' is-active' : ''}`;
    card.innerHTML = `
      <span class="if-lawcard__head">
        <span class="if-lawcard__icon">${icon(law.icon, 'if-ico').outerHTML}</span>
        <span class="if-lawcard__name">${law.name}</span>
        ${active ? '<span class="if-lawcard__active">IN FORCE</span>' : ''}
      </span>
      <span class="if-lawcard__share">${Math.round(law.exportShare * 100)}% <small>exported</small></span>
      <span class="if-lawcard__desc">${law.description}</span>
      <span class="if-lawcard__highlights">${law.highlights.map((entry) => `<span>${entry}</span>`).join('')}</span>
      <span class="if-lawcard__action">${active ? 'Current law' : `Enact · ${TRADE_LAW_CHANGE_COST} PP`}</span>`;
    card.disabled = active;
    card.addEventListener('click', () => {
      const result = state.setTradeLaw(law.id);
      ctx.toast(result.message, result.ok ? 'good' : 'bad');
      if (result.ok) ctx.rerender();
    });
    lawGrid.append(card);
  }
  lawPanel.body.append(lawGrid);
  lawPanel.body.append(
    div('if-hint', 'Exports earn foreign exchange. The share left at home is the only supply available to factories, and later production lines receive resources only after earlier lines are supplied.'),
  );
  mainCol.append(lawPanel.element);

  // ---------------------------------------------------------------- market table
  const marketPanel = panel('National Market', 'steel', { subtitle: 'Daily raw-material balance' });
  const table = document.createElement('table');
  table.className = 'if-table if-market-table';
  table.innerHTML = `<thead><tr><th>Resource</th><th class="is-right">Output</th><th class="is-right">Exported</th><th class="is-right">Imported</th><th class="is-right">Available</th><th class="is-right">Demand</th><th>Status</th></tr></thead>`;
  const tbody = document.createElement('tbody');
  table.append(tbody);
  const marketWrap = div('if-market-wrap');
  marketWrap.append(table);
  marketPanel.body.append(marketWrap);
  mainCol.append(marketPanel.element);

  function renderMarket(): void {
    tbody.replaceChildren();
    const needs = state.resourceNeeds();
    const imports = state.resourceImports();
    for (const info of RESOURCE_INFO) {
      const needed = needs[info.id] ?? 0;
      const available = state.resourceAvailable(info.id);
      const exported = state.resourceExported(info.id);
      const imported = imports[info.id] ?? 0;
      const short = needed > available + 0.001;
      const row = document.createElement('tr');
      row.className = short ? 'is-short' : '';
      const name = document.createElement('td');
      const label = span('if-reslabel');
      label.innerHTML = `${icon(info.icon, 'if-ico if-ico--sm').outerHTML} <span>${info.name}</span>`;
      name.append(label);
      for (const value of [state.resources[info.id], exported, imported, available, needed]) {
        const cell = document.createElement('td');
        cell.className = `is-right${value > 0 && value !== state.resources[info.id] ? ' if-num--pos' : ''}`;
        cell.textContent = value > 0 ? fmt(value, value < 10 && value % 1 !== 0 ? 1 : 0) : '—';
        row.append(cell);
      }
      const status = document.createElement('td');
      status.append(tag(short ? 'Shortage' : needed > 0 ? 'Supplied' : 'Idle', short ? 'red' : needed > 0 ? 'green' : 'grey'));
      row.append(status);
      tbody.append(row);
    }
  }
  renderMarket();

  // ---------------------------------------------------------------- balance
  const balancePanel = panel('Trade Balance', 'coin', { subtitle: state.tradeLawDef.name });
  const balanceHost = div('');
  balancePanel.body.append(balanceHost);

  function renderBalance(): void {
    balanceHost.replaceChildren();
    const rows: [string, string, string][] = [
      ['Export earnings', `+${fmt(state.tradeIncome, 1)} M`, 'if-num--pos'],
      ['Import costs', state.tradeImportCost > 0 ? `−${fmt(state.tradeImportCost, 1)} M` : '—', state.tradeImportCost > 0 ? 'if-num--neg' : ''],
      ['Net trade balance', `${state.tradeBalance >= 0 ? '+' : ''}${fmt(state.tradeBalance, 1)} M`, state.tradeBalance >= 0 ? 'if-num--pos' : 'if-num--neg'],
      ['Market coverage', `${Math.round(state.tradeLawDef.importCoverage * 100)}% of a shortage`, ''],
      ['Agreements', String(state.tradeAgreements.size), ''],
    ];
    for (const [label, value, tone] of rows) {
      const row = div('if-kv');
      row.append(span('if-kv__label', label), span(`if-kv__value ${tone}`, value));
      balanceHost.append(row);
    }
    const exportedUnits = state.resources.steel + state.resources.oil + state.resources.rubber + state.resources.aluminium + state.resources.tungsten + state.resources.chromium;
    balanceHost.append(div('if-hint', `${fmt(exportedUnits * state.tradeLawDef.exportShare)} of ${fmt(exportedUnits)} raw units/day leave the country. Higher export laws pay more but leave less at home.`));
  }
  renderBalance();
  sideCol.append(balancePanel.element);

  // ---------------------------------------------------------------- partners
  const partnersPanel = panel('Trade Partners', 'handshake', { subtitle: 'Agreements add income and improve relations' });
  const partnersHost = div('if-traderlist');
  partnersPanel.body.append(partnersHost);

  function renderPartners(): void {
    partnersHost.replaceChildren();
    const playable = state.world.countries.filter((country) => (
      country.id > 0 &&
      country.id !== state.countryId &&
      state.world.provinces.some((province) => province.owner === country.id)
    ));
    const suggested = [...playable].sort((a, b) => state.relationWith(b.id) - state.relationWith(a.id)).slice(0, 6);
    const ids = [...new Set<number>([...state.tradeAgreements, ...suggested.map((country) => country.id)])].slice(0, 8);
    if (ids.length === 0) {
      partnersHost.append(div('if-hint', 'No foreign trade partners are reachable from this country.'));
      return;
    }
    for (const id of ids) {
      const country = state.world.countries[id];
      if (!country) continue;
      const active = state.tradeAgreements.has(id);
      const row = div('if-traderow');
      row.append(flagImage(country, 'if-flagmini'));
      const body = div('if-traderow__body');
      body.append(div('if-traderow__name', country.name));
      body.append(div('if-traderow__meta', `Relations ${state.relationWith(id) > 0 ? '+' : ''}${state.relationWith(id)}${active ? ' · +2 income/day' : ''}`));
      row.append(body);
      const toggle = button(active ? 'End' : 'Trade', `if-btn if-btn--sm ${active ? 'if-btn--ghost' : ''}`, () => {
        const result = state.toggleTrade(id);
        ctx.toast(result.message, result.ok ? 'good' : 'bad');
        if (result.ok) ctx.rerender();
      });
      toggle.disabled = !active && state.politicalPower < 15;
      row.append(toggle);
      partnersHost.append(row);
    }
  }
  renderPartners();
  sideCol.append(partnersPanel.element);

  const note = panel('Directorate Notes', 'scroll');
  note.body.append(
    div('if-hint', 'Every country begins on the Semi-Open Market: half of raw output is sold abroad and half stays for domestic industry.'),
    div('if-hint', 'Later production lines only receive what earlier lines leave behind. Move a line up in Production to protect it from shortages.'),
    div('if-hint', 'Closed markets have no export income and cannot import. Import-based markets export the least but cover the largest share of a shortfall.'),
  );
  sideCol.append(note.element);

  return { element: frame.element };
}
