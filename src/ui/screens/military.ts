import { DIVISION_TEMPLATES, divisionTemplate } from '../../data/divisions';
import { button, div, icon, meterBlock, panel, sectionLabel, span, tag, withTip } from '../components';
import type { Screen, ScreenContext } from '../screen';
import { screenFrame } from '../screen';
import { fmt, pct } from '../format';

// Military management: army hierarchy, division detail, recruitment and equipment.

interface MilitaryUi {
  commander: number;
  divisionId: number | null;
  template: string;
}

const uiStates = new Map<string, MilitaryUi>();

const TYPE_ICON: Record<string, string> = {
  infantry: 'rifle',
  motorized: 'truck',
  armor: 'tank',
  cavalry: 'helmet',
  mountaineer: 'mountain',
  marine: 'anchor',
};

export function mountMilitary(ctx: ScreenContext): Screen {
  const { state } = ctx;
  let ui = uiStates.get(state.country.tag);
  if (!ui) {
    ui = { commander: 0, divisionId: state.divisions[0]?.id ?? null, template: 'infantry' };
    uiStates.set(state.country.tag, ui);
  }
  if (ui.divisionId !== null && !state.divisions.some((division) => division.id === ui!.divisionId)) ui.divisionId = state.divisions[0]?.id ?? null;

  const strengthBadge = span('if-tag if-tag--gold', `${state.divisions.length} divisions · ${Math.round(state.armyStrength * 100)}% strength`);
  const frame = screenFrame('helmet', 'Armed Forces', `${state.country.name} · army organisation and recruitment`, [strengthBadge], 'if-screen__body--flush');
  const layout = div('if-mil-layout');
  frame.body.append(layout);

  const left = div('if-mil-col');
  const center = div('if-mil-col');
  const right = div('if-mil-col');
  layout.append(left, center, right);

  const armyPanel = panel('Army Groups', 'helmet', { flush: true });
  const armyHost = div('');
  armyPanel.body.append(armyHost);
  left.append(armyPanel.element);

  const compositionPanel = panel('Army Composition', 'shield');
  const compositionHost = div('');
  compositionPanel.body.append(compositionHost);
  left.append(compositionPanel.element);

  const unitPanel = panel('Unit Detail', 'flag');
  const unitHost = div('');
  unitPanel.body.append(unitHost);
  center.append(unitPanel.element);

  const stockPanel = panel('Equipment Stocks', 'steel');
  const stockHost = div('');
  stockPanel.body.append(stockHost);
  center.append(stockPanel.element);

  const recruitPanel = panel('Recruitment', 'people', { subtitle: 'Costs manpower and equipment' });
  const recruitHost = div('');
  recruitPanel.body.append(recruitHost);
  right.append(recruitPanel.element);

  const doctrinePanel = panel('Command Notes', 'book', { flush: true });
  const doctrineHost = div('');
  doctrineHost.style.padding = '10px';
  doctrinePanel.body.append(doctrineHost);
  right.append(doctrinePanel.element);

  let stockRefs = new Map<string, HTMLElement>();
  let strengthRefs: { value: HTMLElement; fill: HTMLElement; expFill: HTMLElement } | null = null;

  function renderArmy(): void {
    armyHost.replaceChildren();
    state.commanders.forEach((commander, index) => {
      const divisions = state.divisionsOfCommander(index);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `if-commander${ui!.commander === index ? ' is-active' : ''}`;
      row.innerHTML = `<span class="if-modifier__icon">${icon('crown', 'if-ico').outerHTML}</span><span><span class="if-commander__name">${commander.name}</span><span class="if-commander__meta">${commander.rank} · ${divisions.length} divisions</span></span>`;
      row.addEventListener('click', () => {
        ui!.commander = index;
        ui!.divisionId = state.divisionsOfCommander(index)[0]?.id ?? null;
        renderArmy();
        renderUnit();
        renderComposition();
      });
      armyHost.append(row);
      if (ui!.commander === index) {
        for (const division of divisions) {
          const divRow = document.createElement('button');
          divRow.type = 'button';
          divRow.className = `if-divrow${ui!.divisionId === division.id ? ' is-active' : ''}`;
          divRow.innerHTML = `${icon(TYPE_ICON[division.type] ?? 'helmet', 'if-ico').outerHTML}<span class="if-divrow__name">${division.name}</span><span class="if-divrow__str" style="color:${division.strength > 0.85 ? 'var(--green-bright)' : division.strength > 0.65 ? 'var(--gold-bright)' : 'var(--red-bright)'}">${Math.round(division.strength * 100)}%</span>`;
          divRow.addEventListener('click', () => {
            ui!.divisionId = division.id;
            renderArmy();
            renderUnit();
          });
          armyHost.append(divRow);
        }
      }
    });
  }

  function renderComposition(): void {
    compositionHost.replaceChildren();
    const avg = state.armyStrength;
    compositionHost.append(
      div('if-kv', span('if-kv__label', 'Divisions'), span('if-kv__value', fmt(state.divisions.length))),
      div('if-kv', span('if-kv__label', 'Commanders'), span('if-kv__value', fmt(state.commanders.length))),
      div('if-kv', span('if-kv__label', 'Manpower'), span('if-kv__value', fmt(state.manpower))),
      div('if-kv', span('if-kv__label', 'Mean strength'), span('if-kv__value', pct(avg))),
    );
    compositionHost.append(meterBlock(avg, avg > 0.8 ? 'green' : 'red', 'Readiness'));
    const counts = new Map<string, number>();
    for (const division of state.divisions) counts.set(division.template, (counts.get(division.template) ?? 0) + 1);
    compositionHost.append(sectionLabel('Order of battle'));
    for (const [template, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
      compositionHost.append(div('if-kv', span('if-kv__label', template), span('if-kv__value', String(count))));
    }
  }

  function renderUnit(): void {
    unitHost.replaceChildren();
    const division = state.divisions.find((entry) => entry.id === ui!.divisionId);
    if (!division) {
      unitHost.append(div('if-empty', div('if-hint', 'Select a division to inspect its staff, strength and equipment.')));
      strengthRefs = null;
      return;
    }
    const template = divisionTemplate(division.templateId) ?? DIVISION_TEMPLATES[0];
    const head = div('if-focus-details__head');
    const iconBox = div('if-tech-detailicon');
    iconBox.innerHTML = icon(TYPE_ICON[division.type] ?? 'helmet', 'if-ico').outerHTML;
    const info = div('');
    const title = document.createElement('h3');
    title.className = 'if-focus-details__title';
    title.textContent = division.name;
    const meta = div('if-focus-details__meta');
    meta.append(tag(division.template, 'blue'), tag(division.type, 'grey'), tag(`Experience ${pct(division.experience)}`, division.experience > 0.25 ? 'green' : 'gold'));
    info.append(title, meta);
    head.append(iconBox, info);
    unitHost.append(head);

    const strength = div('if-grid2');
    strength.style.marginTop = '10px';
    strength.append(meterBlock(division.strength, division.strength > 0.8 ? 'green' : 'red', 'Strength'), meterBlock(division.experience, 'gold', 'Experience'));
    unitHost.append(strength);

    const stats = div('if-unitstats');
    stats.style.marginTop = '10px';
    for (const [value, label] of [
      [String(template.attack), 'Soft attack'],
      [String(template.defense), 'Defence'],
      [String(template.breakthrough), 'Breakthrough'],
      [String(template.speed), 'Speed km/h'],
    ]) {
      const stat = div('if-unitstat');
      stat.append(span('if-unitstat__value', value), span('if-unitstat__label', label));
      stats.append(stat);
    }
    unitHost.append(stats);

    unitHost.append(sectionLabel('Formation'));
    unitHost.append(
      div('if-kv', span('if-kv__label', 'Commander'), span('if-kv__value', state.commanderName(division.commander))),
      div('if-kv', span('if-kv__label', 'Location'), span('if-kv__value', division.location)),
      div('if-kv', span('if-kv__label', 'Manpower'), span('if-kv__value', fmt(template.manpower))),
    );
    const needs = div('if-needs');
    needs.style.marginTop = '6px';
    for (const [equipmentId, amount] of Object.entries(template.equipment)) {
      const dot = span('');
      dot.innerHTML = icon('steel', 'if-ico').outerHTML;
      needs.append(span('', `${equipmentId.replace(/_/g, ' ')} ×${amount}`));
    }
    unitHost.append(sectionLabel('Equipment requirement'), needs);

    const actions = div('if-row');
    actions.style.marginTop = '10px';
    const reinforce = button('Reinforce', 'if-btn if-btn--sm if-btn--gold', () => {
      const result = state.reinforceDivision(division.id);
      ctx.toast(result.message, result.ok ? 'good' : 'bad');
      if (result.ok) {
        renderUnit();
        renderArmy();
        renderComposition();
      }
    });
    reinforce.disabled = division.strength >= 1;
    withTip(reinforce, 'Costs 2,000 manpower and 200 infantry equipment. Restores 10% strength.');
    actions.append(reinforce, button(location('Show in map'), 'if-btn if-btn--sm if-btn--ghost', () => ctx.map.focusCountry(state.countryId)));
    unitHost.append(actions);

    strengthRefs = {
      value: unitHost.querySelector<HTMLElement>('.if-meterblock__value') as HTMLElement,
      fill: unitHost.querySelector<HTMLElement>('.if-meter__fill') as HTMLElement,
      expFill: unitHost.querySelectorAll<HTMLElement>('.if-meter__fill')[1] as HTMLElement,
    };
  }

  function location(text: string): string {
    return text;
  }

  function renderRecruit(): void {
    recruitHost.replaceChildren();
    const list = div('if-templategrid');
    for (const template of DIVISION_TEMPLATES) {
      const active = ui!.template === template.id;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `if-template${active ? ' is-active' : ''}`;
      card.innerHTML = `<span class="if-template__icon">${icon(template.icon, 'if-ico').outerHTML}</span><span><span class="if-template__name">${template.name}</span><span class="if-template__meta">${fmt(template.manpower)} men · ${Object.values(template.equipment).reduce((a, b) => a + b, 0)} equipment</span></span>`;
      card.addEventListener('click', () => {
        ui!.template = template.id;
        renderRecruit();
      });
      list.append(card);
    }
    recruitHost.append(list);
    const template = divisionTemplate(ui!.template) ?? DIVISION_TEMPLATES[0];
    recruitHost.append(div('if-hint', template.description));

    const equipmentRows = div('');
    equipmentRows.style.margin = '8px 0';
    for (const [equipmentId, amount] of Object.entries(template.equipment)) {
      const have = state.stockpileOf(equipmentId);
      equipmentRows.append(div('if-kv', span('if-kv__label', equipmentId.replace(/_/g, ' ')), span(`if-kv__value ${have >= amount ? 'if-num--pos' : 'if-num--neg'}`, `${fmt(have)} / ${amount}`)));
    }
    recruitHost.append(equipmentRows);

    const recruitBtn = button('Raise division', 'if-btn if-btn--gold if-btn--block', () => {
      const result = state.recruitDivision(template.id, ui!.commander);
      ctx.toast(result.message, result.ok ? 'good' : 'bad');
      if (!result.ok) return;
      ui!.divisionId = state.divisions[state.divisions.length - 1]?.id ?? null;
      renderArmy();
      renderUnit();
      renderComposition();
      renderRecruit();
    });
    const canRaise = state.manpower >= template.manpower && Object.entries(template.equipment).every(([id, amount]) => state.stockpileOf(id) >= amount);
    recruitBtn.disabled = !canRaise;
    recruitHost.append(recruitBtn);
    if (!canRaise) recruitHost.append(div('if-hint', 'Not enough manpower or equipment in stock.'));
  }

  function renderStock(): void {
    stockHost.replaceChildren();
    stockRefs = new Map();
    const rows: [string, string][] = [
      ['infantry_equipment', 'Infantry equipment'],
      ['support_equipment', 'Support equipment'],
      ['artillery', 'Artillery'],
      ['medium_tank', 'Medium tanks'],
      ['truck', 'Motor transport'],
      ['fighter', 'Fighters'],
    ];
    for (const [id, label] of rows) {
      const row = div('if-kv');
      row.append(span('if-kv__label', label));
      const value = span('if-kv__value', fmt(state.stockpileOf(id)));
      stockRefs.set(id, value);
      row.append(value);
      stockHost.append(row);
    }
    stockHost.append(div('if-hint', 'Raised divisions draw their equipment from these stocks. Production replenishes them.'));
  }

  function renderDoctrine(): void {
    doctrineHost.replaceChildren();
    doctrineHost.append(
      div('if-hint', `Command style: ${state.country.leader.traits[0]?.name ?? 'Standard staff work'}.`),
      div('if-hint', `Mean experience across the army is ${pct(state.divisions.reduce((sum, division) => sum + division.experience, 0) / Math.max(1, state.divisions.length))}.`),
      div('if-hint', 'Divisions are organised under commanders. Selecting a commander filters the order of battle below it.'),
    );
  }

  function refresh(): void {
    strengthBadge.textContent = `${state.divisions.length} divisions · ${Math.round(state.armyStrength * 100)}% strength`;
    for (const [id, ref] of stockRefs) ref.textContent = fmt(state.stockpileOf(id));
    if (strengthRefs) {
      const division = state.divisions.find((entry) => entry.id === ui!.divisionId);
      if (division) {
        strengthRefs.value.textContent = `${Math.round(division.strength * 100)}%`;
        strengthRefs.fill.style.width = `${division.strength * 100}%`;
        strengthRefs.expFill.style.width = `${division.experience * 100}%`;
      }
    }
    compositionHost.querySelectorAll<HTMLElement>('.if-kv__value')[2]?.replaceChildren(document.createTextNode(fmt(state.manpower)));
  }

  renderArmy();
  renderComposition();
  renderUnit();
  renderRecruit();
  renderStock();
  renderDoctrine();

  return { element: frame.element, refresh };
}
