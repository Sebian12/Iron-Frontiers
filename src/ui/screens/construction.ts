import type { CountryResources } from '../../sim/content';
import { BUILDINGS, buildingById } from '../../data/production';
import { RESOURCE_INFO, resourceName } from '../format';
import { button, div, icon, panel, sectionLabel, span, tag } from '../components';
import type { Screen, ScreenContext } from '../screen';
import { screenFrame } from '../screen';
import { fmt } from '../format';
import { terrainDef } from '../../sim/terrain';

// Economy and construction: the national balance sheet, resources and trade, plus province-based
// building orders. A building is always attached to a province; terrain decides the base slots,
// the industrial cost and the construction speed.

export function mountConstruction(ctx: ScreenContext): Screen {
  const { state, country } = { state: ctx.state, country: ctx.state.country };
  const owned = state.ownedProvinces().sort((a, b) => a.name.localeCompare(b.name));
  let selectedProvinceId = owned.some((province) => province.id === state.selectedProvinceId)
    ? state.selectedProvinceId
    : owned[0]?.id ?? 0;
  state.selectedProvinceId = selectedProvinceId;

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
  const totalSlots = () => owned.reduce((sum, province) => sum + state.provinceBuildingSlots(province.id), 0);
  const reservedSlots = () => owned.reduce((sum, province) => sum + state.provinceUsedSlots(province.id) + state.provinceQueuedSlots(province.id), 0);
  const slotsValue = `${reservedSlots()} / ${totalSlots()}`;
  summaryBar.append(
    summary(String(state.civilianFactories), 'Civilian factories'),
    summary(String(state.militaryFactories), 'Military factories'),
    summary(String(state.dockyards), 'Dockyards'),
    summary(String(state.infrastructure), 'Infrastructure'),
    summary(`${state.income - state.expenses >= 0 ? '+' : ''}${fmt(state.income - state.expenses)}`, 'Daily balance'),
    summary(slotsValue, 'Slots reserved'),
  );
  mainCol.append(summaryBar);

  // ---------------------------------------------------------------- province picker
  const provincePanel = panel('Construction Province', 'map', { subtitle: 'Orders are placed in a province, not an anonymous national pool' });
  const provinceHost = div('if-provincepick');
  provincePanel.body.append(provinceHost);
  mainCol.append(provincePanel.element);

  let provinceSlotsRef: HTMLElement | null = null;

  function paintProvince(): void {
    provinceHost.replaceChildren();
    if (!selectedProvinceId || owned.length === 0) {
      provinceHost.append(div('if-empty', div('if-hint', 'You do not own a province in this campaign.')));
      return;
    }
    const province = state.world.provinces[selectedProvinceId];
    if (!province) return;
    const terrain = terrainDef(province.terrain);
    const development = state.provinceDevelopment(selectedProvinceId);
    const used = state.provinceUsedSlots(selectedProvinceId);
    const slots = state.provinceBuildingSlots(selectedProvinceId);
    const queued = state.provinceQueuedSlots(selectedProvinceId);

    const select = document.createElement('select');
    select.className = 'if-select';
    select.setAttribute('aria-label', 'Construction province');
    for (const entry of owned) {
      const entryTerrain = terrainDef(entry.terrain);
      const option = document.createElement('option');
      option.value = String(entry.id);
      option.textContent = `${entry.name} — ${entryTerrain.name} · ${state.provinceUsedSlots(entry.id)}/${state.provinceBuildingSlots(entry.id)} slots`;
      select.append(option);
    }
    select.value = String(selectedProvinceId);
    select.addEventListener('change', () => {
      selectedProvinceId = Number(select.value);
      state.selectedProvinceId = selectedProvinceId;
      ctx.rerender();
    });
    provinceHost.append(select);

    const info = div('if-provincepick__info');
    const head = div('if-provincepick__head');
    head.append(icon(terrain.icon, 'if-ico if-ico--lg'));
    const title = div('');
    title.append(
      span('if-provincepick__name', province.name),
      span('if-provincepick__terrain', `${terrain.name} · ${state.world.states[province.state]?.name ?? 'Unknown state'}`),
    );
    head.append(title);
    info.append(head);

    const facts = div('if-provincepick__facts');
    provinceSlotsRef = tag(`${used} / ${slots} slots`, used + queued >= slots ? 'red' : 'green');
    facts.append(
      provinceSlotsRef,
      tag(`${queued} queued`, queued > 0 ? 'gold' : 'grey'),
      tag(`Infrastructure ${development.infrastructure} / 5`, 'grey'),
      tag(`Cost ×${terrain.buildCost.toFixed(2)}`, terrain.buildCost > 1 ? 'gold' : 'green'),
      tag(`Defence ${terrain.defence > 0 ? '+' : ''}${terrain.defence}%`, terrain.defence >= 0 ? 'green' : 'red'),
      tag(`Supply ${terrain.supply > 0 ? '+' : ''}${terrain.supply}%`, terrain.supply >= 0 ? 'green' : 'red'),
    );
    info.append(facts, div('if-hint', terrain.description));

    const actions = div('if-row if-row--wrap');
    actions.style.marginTop = '8px';
    actions.append(
      button('Province sheet', 'if-btn if-btn--sm if-btn--gold', () => ctx.openProvince(selectedProvinceId)),
      button('Centre map', 'if-btn if-btn--sm if-btn--ghost', () => ctx.map.focusProvince(selectedProvinceId)),
    );
    info.append(actions);
    provinceHost.append(info);
  }

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
    const available = state.resourceAvailable(info.id);
    const short = (needs[info.id] ?? 0) > available;
    const row = div(`if-res${short ? ' is-short' : ''}`);
    row.append(icon(info.icon, 'if-ico'), span('', info.name), span('if-res__value', fmt(available)));
    row.title = `Output ${fmt(state.resources[info.id])} · exported ${fmt(state.resourceExported(info.id))} · imported ${fmt(state.resourceImports()[info.id] ?? 0)}`;
    resGrid.append(row);
  }
  economy.body.append(sectionLabel('Resource Production', `${Math.round(state.tradeLawDef.exportShare * 100)}% exported · ${state.tradeLawDef.shortName}`), resGrid);
  economy.body.append(div('if-hint', 'Availability is what remains after exports and market imports. Open the Trade screen to change the law.'));
  economy.body.append(button('Open Trade', 'if-btn if-btn--sm if-btn--ghost if-btn--block', () => ctx.open('trade')));

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

  // ---------------------------------------------------------------- catalogue
  const catalog = panel('Construction Catalogue', 'crane', { subtitle: 'Click a project to queue it in the selected province' });
  const buildingGrid = div('if-buildinggrid');
  catalog.body.append(buildingGrid);
  catalog.body.append(div('if-hint', 'Terrain sets the base slots and cost. Infrastructure adds slots and speeds up further construction in that province. The first item in the national queue receives all construction output.'));
  mainCol.append(catalog.element);

  function paintCatalogue(): void {
    buildingGrid.replaceChildren();
    if (!selectedProvinceId) {
      buildingGrid.append(div('if-hint', 'Select a province first.'));
      return;
    }
    const used = state.provinceUsedSlots(selectedProvinceId);
    const slots = state.provinceBuildingSlots(selectedProvinceId);
    for (const building of BUILDINGS) {
      const check = state.provinceCanBuild(building.id, selectedProvinceId);
      const cost = state.provinceConstructionCost(building.id, selectedProvinceId);
      const count = state.provinceBuildingCount(selectedProvinceId, building.id);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `if-building${check.ok ? '' : ' is-blocked'}`;
      card.title = check.message;
      card.innerHTML = `<span class="if-building__head">${icon(building.icon, 'if-ico').outerHTML}<span>${building.name}</span>${count > 0 ? `<span class="if-building__count">×${count}</span>` : ''}</span><span class="if-hint">${building.description}</span><span class="if-building__meta"><span>${fmt(cost)} CIC</span><span>${building.effect}</span></span><span class="if-building__status">${check.ok ? `${used} / ${slots} slots used` : check.message}</span>`;
      card.addEventListener('click', () => {
        if (!check.ok) {
          ctx.toast(check.message, 'bad');
          return;
        }
        const result = state.addConstruction(building.id, selectedProvinceId);
        ctx.toast(result.message, result.ok ? 'good' : 'bad');
        if (result.ok) ctx.rerender();
      });
      buildingGrid.append(card);
    }
  }

  // ---------------------------------------------------------------- queue
  const queue = panel('Construction Queue', 'helmet', { subtitle: 'Top item is under construction' });
  const queueHost = div('');
  queue.body.append(queueHost);
  sideCol.append(queue.element);

  const orders = panel('Standing Orders', 'scroll');
  orders.body.append(
    div('if-hint', 'Priorities: expand civilian industry first, then military plants. Dockyards are needed for naval programmes.'),
    div('if-hint', 'A province can only hold as many buildings as its terrain and infrastructure allow. Mountains and marshes are expensive; farmland and plains are cheap.'),
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
  let queueSignature = '';

  function renderQueue(): void {
    queueHost.replaceChildren();
    queueRefs = [];
    queueSignature = state.construction.map((item) => item.id).join(',');
    if (state.construction.length === 0) {
      queueHost.append(div('if-empty', div('if-hint', 'The queue is empty. Add a building from the catalogue.')));
      return;
    }
    state.construction.forEach((item, index) => {
      const building = buildingById(item.buildingId);
      if (!building) return;
      const province = state.world.provinces[item.provinceId];
      const row = div('if-queueitem');
      const iconBox = div('if-queueitem__icon');
      iconBox.innerHTML = icon(building.icon, 'if-ico').outerHTML;
      const body = div('');
      body.append(div('if-queueitem__name', building.name));
      const meta = div('if-queueitem__meta');
      const daysEl = span('', `${state.constructionDaysLeft(item)} days`);
      const pctEl = span('', `${Math.min(100, Math.round((item.progress / item.cost) * 100))}%`);
      meta.append(span('if-queueitem__province', province?.name ?? 'National reserve'), span('', ' · '), pctEl, span('', ' · '), daysEl);
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
    summaryRefs[5].textContent = `${reservedSlots()} / ${totalSlots()}`;
    balanceValue.textContent = `${balance >= 0 ? '+' : ''}${fmt(balance)}`;
    balanceValue.className = `if-kv__value ${balance >= 0 ? 'if-num--pos' : 'if-num--neg'}`;
    treasuryValue.textContent = `${fmt(state.treasury)} M`;
    incomeRow.lastElementChild!.textContent = `+${fmt(state.income)}`;
    expenseRow.lastElementChild!.textContent = `−${fmt(state.expenses)}`;
    if (provinceSlotsRef && selectedProvinceId) {
      provinceSlotsRef.textContent = `${state.provinceUsedSlots(selectedProvinceId)} / ${state.provinceBuildingSlots(selectedProvinceId)} slots`;
    }
    const nextSignature = state.construction.map((item) => item.id).join(',');
    if (nextSignature !== queueSignature) renderQueue();
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
      row?.classList.toggle('is-short', (needsNow[info.id] ?? 0) > state.resourceAvailable(info.id));
    });
  }

  paintProvince();
  paintCatalogue();
  renderQueue();
  return { element: frame.element, refresh };
}

// Local helper so TypeScript keeps the resource key type meaningful in the trade table.
export type EconomyResourceKey = keyof CountryResources;
