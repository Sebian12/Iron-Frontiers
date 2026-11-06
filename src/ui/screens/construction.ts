import type { CountryResources } from '../../sim/content';
import { BUILDINGS, buildingById } from '../../data/production';
import { RESOURCE_INFO, resourceName } from '../format';
import { button, div, icon, panel, sectionLabel, span } from '../components';
import type { Screen, ScreenContext } from '../screen';
import { screenFrame } from '../screen';
import { fmt } from '../format';

// Economy and construction: the national balance sheet, resources and trade, plus the building queue.

export function mountConstruction(ctx: ScreenContext): Screen {
  const { state, country } = { state: ctx.state, country: ctx.state.country };
  const rateBadge = span('if-tag if-tag--gold', `${Math.round(state.constructionPerDay)} construction/day`);
  const frame = screenFrame('crane', 'Construction & Economy', `${country.name} · industry, resources and public works`, [rateBadge], 'if-screen__body--flush');
  const layout = div('if-econ-layout');
  frame.body.append(layout);

  const mainCol = div('if-econ-col');
  const sideCol = div('if-econ-col');
  layout.append(mainCol, sideCol);

  const summaryBar = div('if-summarybar');
  const summaryRefs: HTMLElement[] = [];
  function summary(value: string, label: string): HTMLElement {
    const box = div('if-summary');
    const val = span('if-summary__value', value);
    box.append(val, span('if-summary__label', label));
    summaryRefs.push(val);
    return box;
  }
  summaryBar.append(
    summary(String(state.civilianFactories), 'Civilian factories'),
    summary(String(state.militaryFactories), 'Military factories'),
    summary(String(state.dockyards), 'Dockyards'),
    summary(String(state.infrastructure), 'Infrastructure'),
    summary(`${state.income - state.expenses >= 0 ? '+' : ''}${fmt(state.income - state.expenses)}`, 'Daily balance'),
  );
  mainCol.append(summaryBar);

  // ---------------------------------------------------------------- economy
  const economy = panel('National Economy', 'factory');
  const industry = div('');
  for (const [label, value] of [
    ['Civilian industry', state.civilianFactories],
    ['Military industry', state.militaryFactories],
    ['Dockyards', state.dockyards],
    ['Infrastructure', state.infrastructure],
  ] as const) {
    industry.append(div('if-kv', span('if-kv__label', label), span('if-kv__value', fmt(value))));
  }
  economy.body.append(sectionLabel('Industry'), industry);

  const budget = div('');
  const incomeRow = div('if-kv');
  incomeRow.append(span('if-kv__label', 'National income'), span('if-kv__value if-num--pos', `+${fmt(state.income)}`));
  const expenseRow = div('if-kv');
  expenseRow.append(span('if-kv__label', 'Expenditure'), span('if-kv__value if-num--neg', `−${fmt(state.expenses)}`));
  const balanceRow = div('if-kv');
  const balanceValue = span(`if-kv__value ${state.income - state.expenses >= 0 ? 'if-num--pos' : 'if-num--neg'}`, `${state.income - state.expenses >= 0 ? '+' : ''}${fmt(state.income - state.expenses)}`);
  balanceRow.append(span('if-kv__label', 'Daily balance'), balanceValue);
  const treasuryRow = div('if-kv');
  const treasuryValue = span('if-kv__value', `${fmt(state.treasury)} M`);
  treasuryRow.append(span('if-kv__label', 'Treasury'), treasuryValue);
  budget.append(incomeRow, expenseRow, balanceRow, treasuryRow);
  economy.body.append(sectionLabel('National Budget'), budget);
  economy.body.append(div('if-hint', 'Income and expenditure scale with the factory base. A negative treasury drains stability every day.'));

  const resGrid = div('if-resgrid');
  resGrid.style.marginTop = '8px';
  const needs = state.resourceNeeds();
  for (const info of RESOURCE_INFO) {
    const short = (needs[info.id] ?? 0) > state.resources[info.id];
    const row = div(`if-res${short ? ' is-short' : ''}`);
    row.append(icon(info.icon, 'if-ico'), span('', info.name), span('if-res__value', fmt(state.resources[info.id])));
    resGrid.append(row);
  }
  economy.body.append(sectionLabel('Resource Production'), resGrid);
  economy.body.append(div('if-hint', 'Resources are produced domestically and supplemented by trade agreements.'));

  const tradeTable = document.createElement('table');
  tradeTable.className = 'if-table';
  tradeTable.innerHTML = '<thead><tr><th>Partner</th><th>Commodity</th><th class="is-right">Amount</th><th>Direction</th></tr></thead>';
  const tradeBody = document.createElement('tbody');
  const trades = country.industry.trade;
  if (trades.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.className = 'if-muted';
    cell.textContent = 'No standing trade agreements.';
    row.append(cell);
    tradeBody.append(row);
  }
  for (const trade of trades) {
    const row = document.createElement('tr');
    const partner = document.createElement('td');
    partner.textContent = trade.country;
    const commodity = document.createElement('td');
    const iconBox = span('');
    iconBox.innerHTML = icon(RESOURCE_INFO.find((entry) => entry.id === trade.resource)?.icon ?? 'steel', 'if-ico if-ico--sm').outerHTML;
    commodity.append(iconBox, document.createTextNode(` ${resourceName(trade.resource)}`));
    const amount = document.createElement('td');
    amount.className = 'is-right';
    amount.textContent = fmt(trade.amount);
    const direction = document.createElement('td');
    direction.append(span(`if-tag ${trade.direction === 'import' ? 'if-tag--blue' : 'if-tag--gold'}`, trade.direction));
    row.append(partner, commodity, amount, direction);
    tradeBody.append(row);
  }
  tradeTable.append(tradeBody);
  economy.body.append(sectionLabel('Trade'), tradeTable);
  mainCol.append(economy.element);

  // ---------------------------------------------------------------- buildings
  const catalog = panel('Construction Catalogue', 'crane', { subtitle: 'Add to the queue' });
  const buildingGrid = div('if-buildinggrid');
  for (const building of BUILDINGS) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'if-building';
    card.innerHTML = `<span class="if-building__head">${icon(building.icon, 'if-ico').outerHTML}<span>${building.name}</span></span><span class="if-hint">${building.description}</span><span class="if-building__meta"><span>${fmt(building.cost)} CIC</span><span>${building.effect}</span></span>`;
    card.addEventListener('click', () => {
      const result = state.addConstruction(building.id);
      ctx.toast(result.message, result.ok ? 'good' : 'bad');
      if (result.ok) ctx.rerender();
    });
    buildingGrid.append(card);
  }
  catalog.body.append(buildingGrid);
  catalog.body.append(div('if-hint', 'Construction is worked by civilian factories. The first item in the queue receives all construction output.'));
  mainCol.append(catalog.element);

  // ---------------------------------------------------------------- queue
  const queue = panel('Construction Queue', 'helmet', { subtitle: 'Top item is under construction' });
  const queueHost = div('');
  queue.body.append(queueHost);
  sideCol.append(queue.element);

  const orders = panel('Standing Orders', 'scroll');
  orders.body.append(
    div('if-hint', 'Priorities: expand civilian industry first, then military plants. Dockyards are needed for naval programmes.'),
    div('if-hint', 'Infrastructure improves supply throughput and construction speed in the affected region.'),
    div('if-hint', `${state.civilianFactories} civilian factories produce ${Math.round(state.constructionPerDay)} construction points per day.`),
  );
  sideCol.append(orders.element);

  interface QueueRefs {
    id: number;
    fill: HTMLElement;
    days: HTMLElement;
    percent: HTMLElement;
  }
  let queueRefs: QueueRefs[] = [];

  function renderQueue(): void {
    queueHost.replaceChildren();
    queueRefs = [];
    if (state.construction.length === 0) {
      queueHost.append(div('if-empty', div('if-hint', 'The queue is empty. Add a building from the catalogue.')));
      return;
    }
    state.construction.forEach((item, index) => {
      const building = buildingById(item.buildingId);
      if (!building) return;
      const row = div('if-queueitem');
      const iconBox = div('if-queueitem__icon');
      iconBox.innerHTML = icon(building.icon, 'if-ico').outerHTML;
      const body = div('');
      body.append(div('if-queueitem__name', building.name));
      const meta = div('if-queueitem__meta');
      const daysEl = span('', `${state.constructionDaysLeft(item)} days`);
      const pctEl = span('', `${Math.min(100, Math.round((item.progress / item.cost) * 100))}%`);
      meta.append(span('', building.effect), span('', ' · '), pctEl, span('', ' · '), daysEl);
      body.append(meta);
      const progress = div('if-progressline');
      const fill = span('');
      fill.style.width = `${Math.min(100, (item.progress / item.cost) * 100)}%`;
      progress.append(fill);
      const actions = div('if-queueitem__actions');
      const up = button('▲', '', () => {
        state.moveConstruction(item.id, -1);
        ctx.rerender();
      });
      up.disabled = index === 0;
      const down = button('▼', '', () => {
        state.moveConstruction(item.id, 1);
        ctx.rerender();
      });
      down.disabled = index === state.construction.length - 1;
      const cancel = button('×', '', () => {
        state.cancelConstruction(item.id);
        ctx.toast(`${building.name} cancelled.`, 'warn');
        ctx.rerender();
      });
      cancel.title = 'Cancel construction';
      actions.append(up, down, cancel);
      row.append(iconBox, body, progress, actions);
      queueHost.append(row);
      queueRefs.push({ id: item.id, fill, days: daysEl, percent: pctEl });
    });
  }

  function refresh(): void {
    rateBadge.textContent = `${Math.round(state.constructionPerDay)} construction/day`;
    summaryRefs[0].textContent = String(state.civilianFactories);
    summaryRefs[1].textContent = String(state.militaryFactories);
    summaryRefs[2].textContent = String(state.dockyards);
    summaryRefs[3].textContent = String(state.infrastructure);
    const balance = state.income - state.expenses;
    summaryRefs[4].textContent = `${balance >= 0 ? '+' : ''}${fmt(balance)}`;
    balanceValue.textContent = `${balance >= 0 ? '+' : ''}${fmt(balance)}`;
    balanceValue.className = `if-kv__value ${balance >= 0 ? 'if-num--pos' : 'if-num--neg'}`;
    treasuryValue.textContent = `${fmt(state.treasury)} M`;
    incomeRow.lastElementChild!.textContent = `+${fmt(state.income)}`;
    expenseRow.lastElementChild!.textContent = `−${fmt(state.expenses)}`;
    for (const ref of queueRefs) {
      const item = state.construction.find((entry) => entry.id === ref.id);
      if (!item) continue;
      const percent = Math.min(100, Math.round((item.progress / item.cost) * 100));
      ref.fill.style.width = `${percent}%`;
      ref.percent.textContent = `${percent}%`;
      ref.days.textContent = `${state.constructionDaysLeft(item)} days`;
    }
    const needsNow = state.resourceNeeds();
    RESOURCE_INFO.forEach((info, index) => {
      const row = resGrid.children[index] as HTMLElement | undefined;
      row?.classList.toggle('is-short', (needsNow[info.id] ?? 0) > state.resources[info.id]);
    });
  }

  renderQueue();
  return { element: frame.element, refresh };
}

// Local helper so TypeScript keeps the resource key type meaningful in the trade table.
export type EconomyResourceKey = keyof CountryResources;
