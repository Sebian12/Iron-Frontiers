import type { CountryDef } from '../../sim/content';
import { authoredCountries } from '../../data/loadContent';
import { createGenericCountry } from '../../data/genericCountry';
import { factionOf } from '../../data/geopolitics';
import { button, div, icon, meter, panel, portrait, sectionLabel, span, tag, withTip } from '../components';
import type { Screen, ScreenContext } from '../screen';
import { flag, ideologyName, screenFrame } from '../screen';
import { fmt, pct, relationTone } from '../format';

// Diplomacy: a searchable country list beside a full dossier with relations, treaties and the
// diplomatic actions that actually change the simulation.

interface DiploUi {
  query: string;
  faction: string;
  sort: 'name' | 'relation';
  detailId: number;
}

const uiStates = new Map<string, DiploUi>();

export function mountDiplomacy(ctx: ScreenContext): Screen {
  const { state } = ctx;
  const provinces = new Map<number, number>();
  const states = new Map<number, number>();
  for (const province of state.world.provinces) {
    if (province.owner === 0) continue;
    provinces.set(province.owner, (provinces.get(province.owner) ?? 0) + 1);
    const seen = states.get(province.owner) ?? 0;
    states.set(province.owner, seen);
  }
  for (const province of state.world.provinces) {
    if (province.owner === 0) continue;
    const key = province.owner * 100000 + province.state;
    if (!provinces.has(key)) provinces.set(key, 1);
  }

  const defs = new Map<number, CountryDef>();
  function defOf(id: number): CountryDef {
    let def = defs.get(id);
    if (def) return def;
    const mapCountry = state.world.countries[id];
    const authored = authoredCountries().find((entry) => entry.mapNames.includes(mapCountry.name));
    const overlord = mapCountry.overlord !== null ? state.world.countries[mapCountry.overlord]?.name : undefined;
    def = authored ?? createGenericCountry(mapCountry, provinces.get(id) ?? 1, overlord);
    defs.set(id, def);
    return def;
  }

  const playable = state.world.countries.filter((country) => country.id !== 0 && country.id !== state.countryId && (provinces.get(country.id) ?? 0) > 0);
  const factions = [...new Set(playable.map((country) => factionOf(country.name) ?? 'Non-aligned'))];
  let ui = uiStates.get(state.country.tag);
  if (!ui) {
    ui = {
      query: '',
      faction: 'all',
      sort: 'name',
      detailId: state.selectedCountryId !== state.countryId ? state.selectedCountryId : playable[0]?.id ?? 0,
    };
    uiStates.set(state.country.tag, ui);
  }
  if (!playable.some((country) => country.id === ui!.detailId)) ui.detailId = playable[0]?.id ?? 0;

  const ppBadge = span('if-tag if-tag--gold', `PP ${fmt(state.politicalPower)}`);
  const frame = screenFrame('handshake', 'Diplomacy', `${state.country.name} · foreign relations and treaties`, [ppBadge], 'if-screen__body--flush');
  const layout = div('if-diplo-layout');
  frame.body.append(layout);

  const listPanel = panel('Nations', 'flag', { flush: true });
  const listTools = div('if-listtools');
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search nations…';
  search.value = ui.query;
  search.setAttribute('aria-label', 'Search nations');
  const searchBox = div('if-searchbox');
  searchBox.append(icon('eye', 'if-ico'), search);
  const filterChips = div('if-filterbar');
  const allChip = button('All', 'if-filterchip is-on', () => {
    ui!.faction = 'all';
    syncChips();
    renderList();
  });
  filterChips.append(allChip);
  for (const faction of factions) {
    const chip = button(faction, 'if-filterchip', () => {
      ui!.faction = faction;
      syncChips();
      renderList();
    });
    chip.dataset.faction = faction;
    filterChips.append(chip);
  }
  const sortBtn = button('Sort: A–Z', 'if-btn if-btn--sm if-btn--ghost', () => {
    ui!.sort = ui!.sort === 'name' ? 'relation' : 'name';
    sortBtn.textContent = ui!.sort === 'name' ? 'Sort: A–Z' : 'Sort: Relations';
    renderList();
  });
  listTools.append(searchBox, filterChips, sortBtn);
  const countryList = div('if-countrylist');
  listPanel.body.append(listTools, countryList);

  const detailPanel = panel('Country Dossier', 'scroll');
  detailPanel.element.classList.add('if-diplo-detail');
  layout.append(listPanel.element, detailPanel.element);

  search.addEventListener('input', () => {
    ui!.query = search.value;
    renderList();
  });

  function syncChips(): void {
    allChip.classList.toggle('is-on', ui!.faction === 'all');
    for (const chip of filterChips.querySelectorAll<HTMLElement>('.if-filterchip')) {
      if (chip.dataset.faction) chip.classList.toggle('is-on', ui!.faction === chip.dataset.faction);
    }
  }

  function relationToneFor(id: number): 'green' | 'blue' | 'gold' | 'red' {
    return relationTone(state.relationWith(id));
  }

  function renderList(): void {
    countryList.replaceChildren();
    const needle = ui!.query.trim().toLowerCase();
    let list = playable.filter((country) => needle === '' || country.name.toLowerCase().includes(needle));
    if (ui!.faction !== 'all') list = list.filter((country) => (factionOf(country.name) ?? 'Non-aligned') === ui!.faction);
    list.sort((a, b) => (ui!.sort === 'name' ? a.name.localeCompare(b.name) : state.relationWith(b.id) - state.relationWith(a.id)));
    if (list.length === 0) {
      countryList.append(div('if-empty', div('if-hint', 'No nation matches this filter.')));
      return;
    }
    for (const country of list) {
      const relation = state.relationWith(country.id);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `if-countryrow${ui!.detailId === country.id ? ' is-active' : ''}`;
      const def = defOf(country.id);
      const flagEl = flag(country.color, def.accent, 'if-flagmini');
      const body = div('');
      body.append(span('if-countryrow__name', country.name));
      const sub = div('if-countryrow__sub');
      sub.append(span('', `${ideologyName(state, def.ideology)} · ${factionOf(country.name) ?? 'Non-aligned'}`));
      body.append(sub);
      const score = span(`if-countryrow__rel if-num--${relation >= 0 ? 'pos' : 'neg'}`, `${relation > 0 ? '+' : ''}${relation}`);
      row.append(flagEl, body, score);
      const treaties = div('if-countryrow__flags');
      if (state.tradeAgreements.has(country.id)) treaties.append(tag('Trade', 'blue'));
      if (state.guarantees.has(country.id)) treaties.append(tag('Guaranteed', 'green'));
      if (country.overlord !== null) treaties.append(tag(`Subject`, 'grey'));
      if (treaties.childElementCount > 0) row.append(treaties);
      row.addEventListener('click', () => selectCountry(country.id));
      row.addEventListener('pointerenter', () => ctx.map.highlightCountry(country.id));
      row.addEventListener('pointerleave', () => ctx.map.highlightCountry(ui!.detailId));
      countryList.append(row);
    }
  }

  function selectCountry(id: number): void {
    ui!.detailId = id;
    state.selectedCountryId = id;
    ctx.map.highlightCountry(id);
    renderList();
    renderDetail();
  }

  function actionButton(label: string, _cost: number, tone: string, onClick: () => void, disabled = false, tip?: string): HTMLButtonElement {
    const btn = button(label, `if-btn if-btn--sm ${tone}`, onClick);
    btn.disabled = disabled;
    if (tip) withTip(btn, tip);
    return btn;
  }

  function renderDetail(): void {
    const body = detailPanel.body;
    body.replaceChildren();
    const country = state.world.countries[ui!.detailId];
    if (!country) {
      body.append(div('if-hint', 'Select a nation from the list.'));
      return;
    }
    const def = defOf(country.id);
    const relation = state.relationWith(country.id);
    const heading = detailPanel.element.querySelector('.if-panel__titletext');
    if (heading) heading.textContent = country.name;

    const head = div('if-dossier__head');
    head.append(flag(country.color, def.accent, 'if-flag if-flag--lg'));
    const headInfo = div('');
    const title = document.createElement('h3');
    title.className = 'if-dossier__name';
    title.textContent = country.name;
    const meta = div('if-focus-details__meta');
    meta.append(
      tag(ideologyName(state, def.ideology), 'gold'),
      tag(factionOf(country.name) ?? 'Non-aligned', 'blue'),
      country.overlord !== null ? tag(`Subject of ${state.world.countries[country.overlord]?.name ?? '—'}`, 'grey') : tag('Sovereign', 'grey'),
    );
    headInfo.append(title, meta);
    head.append(headInfo);
    body.append(head);

    const relationBox = div('if-relationbox');
    const relationHead = div('if-row');
    relationHead.append(span('if-hint', 'Bilateral relations'), tag(state.relationLabel(relation), relationToneFor(country.id)));
    const bar = meter((relation + 100) / 200, relation >= 40 ? 'green' : relation >= 0 ? 'blue' : relation > -40 ? 'gold' : 'red');
    const relationScore = span('if-relationbox__score', `${relation > 0 ? '+' : ''}${relation}`);
    relationHead.append(relationScore);
    relationBox.append(relationHead, bar);
    relationBox.append(div('if-hint', state.tradeAgreements.has(country.id) ? 'A trade agreement is in force (+12 relations).' : 'No trade agreement. A trade pact adds +12 relations.'));
    body.append(relationBox);

    // Treaties
    body.append(sectionLabel('Treaties & guarantees'));
    const treaties = div('if-treatylist');
    const tradeTag = tag(state.tradeAgreements.has(country.id) ? 'Trade agreement active' : 'No trade agreement', state.tradeAgreements.has(country.id) ? 'green' : 'grey');
    const guaranteeTag = tag(state.guarantees.has(country.id) ? 'Independence guaranteed' : 'No guarantee', state.guarantees.has(country.id) ? 'green' : 'grey');
    const faction = factionOf(country.name);
    const factionTag = tag(faction ? `Faction: ${faction}` : 'No faction', faction ? 'blue' : 'grey');
    treaties.append(tradeTag, guaranteeTag, factionTag);
    body.append(treaties);

    // Government estimate
    body.append(sectionLabel('Government (estimate)'));
    const gov = div('if-dossier__gov');
    gov.append(portrait(def.leader.portrait, def.accent, 'sm'));
    const govText = div('');
    govText.append(
      span('if-dossier__leadername', def.leader.name),
      span('if-dossier__leadertitle', def.leader.title),
      span('if-hint', def.coalition ? `${def.coalition} · legitimacy ${pct(def.legitimacy ?? 0.7)}` : `Legitimacy ${pct(def.legitimacy ?? 0.7)}`),
    );
    gov.append(govText);
    body.append(gov);

    const stats = div('if-grid2');
    stats.style.marginTop = '8px';
    stats.append(
      div('if-statmini', span('if-statmini__value', fmt(provinces.get(country.id) ?? 0)), span('if-statmini__label', 'Provinces')),
      div('if-statmini', span('if-statmini__value', fmt(states.get(country.id) ?? 0)), span('if-statmini__label', 'States')),
      div('if-statmini', span('if-statmini__value', fmt(def.industry.civilianFactories)), span('if-statmini__label', 'Civilian factories')),
      div('if-statmini', span('if-statmini__value', fmt(def.industry.militaryFactories)), span('if-statmini__label', 'Military factories')),
    );
    body.append(stats);

    body.append(sectionLabel('Diplomatic actions'));
    const actions = div('if-diploactions');
    actions.append(
      actionButton('Improve relations', 25, 'if-btn--gold', () => run(state.improveRelations(country.id)), state.politicalPower < 25, '25 political power · +8 relations'),
      actionButton(state.tradeAgreements.has(country.id) ? 'End trade agreement' : 'Trade agreement', state.tradeAgreements.has(country.id) ? 0 : 15, '', () => run(state.toggleTrade(country.id)), !state.tradeAgreements.has(country.id) && state.politicalPower < 15, '15 political power · +12 relations and +2 daily income'),
      actionButton(state.guarantees.has(country.id) ? 'Withdraw guarantee' : 'Guarantee independence', state.guarantees.has(country.id) ? 0 : 40, '', () => run(state.guarantee(country.id)), !state.guarantees.has(country.id) && state.politicalPower < 40, '40 political power · +15 relations'),
      actionButton('Publicly denounce', 20, 'if-btn--danger', () => run(state.denounce(country.id)), state.politicalPower < 20, '20 political power · −12 relations, +1% war support'),
    );
    body.append(actions);
    const mapRow = div('if-row');
    mapRow.style.marginTop = '8px';
    mapRow.append(button('Show on map', 'if-btn if-btn--sm if-btn--ghost', () => ctx.map.focusCountry(country.id)));
    body.append(mapRow);

    body.append(div('if-hint', 'Actions spend political power immediately. Trade pacts and guarantees can be revoked without refund.'));
  }

  function run(result: { ok: boolean; message: string }): void {
    ctx.toast(result.message, result.ok ? 'good' : 'bad');
    ppBadge.textContent = `PP ${fmt(state.politicalPower)}`;
    renderList();
    renderDetail();
  }

  renderList();
  renderDetail();
  if (ui.detailId) ctx.map.highlightCountry(ui.detailId);
  syncChips();

  return {
    element: frame.element,
    refresh: () => {
      ppBadge.textContent = `PP ${fmt(state.politicalPower)}`;
    },
    destroy: () => ctx.map.highlightCountry(null),
  };
}
