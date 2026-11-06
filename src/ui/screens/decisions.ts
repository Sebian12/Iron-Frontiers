import type { DecisionDef } from '../../sim/content';
import { button, div, effectList, icon, panel, sectionLabel, span, tag } from '../components';
import type { Screen, ScreenContext } from '../screen';
import { screenFrame } from '../screen';
import { fmt } from '../format';

// National decisions: a filterable cabinet agenda, each entry with real requirements, costs,
// cooldowns and effects.

const CATEGORY_LABEL: Record<DecisionDef['category'], string> = {
  political: 'Political',
  economic: 'Economic',
  military: 'Military',
  foreign: 'Foreign',
};

export function mountDecisions(ctx: ScreenContext): Screen {
  const { state, content } = ctx;
  let category: DecisionDef['category'] | 'all' = 'all';
  let selected: DecisionDef | null = content.def.decisions[0] ?? null;

  const ppBadge = span('if-tag if-tag--gold', `PP ${fmt(state.politicalPower)}`);
  const frame = screenFrame('scroll', 'National Decisions', `${state.country.name} · cabinet agenda and emergency measures`, [ppBadge], 'if-screen__body--flush');
  const layout = div('if-decisions-layout');
  frame.body.append(layout);

  const main = div('if-decisions-main');
  const aside = div('if-decisions-aside');
  layout.append(main, aside);

  const filterBar = div('if-filterbar');
  const categoryChips = new Map<string, HTMLButtonElement>();
  const filters: (DecisionDef['category'] | 'all')[] = ['all', 'political', 'economic', 'military', 'foreign'];
  for (const filter of filters) {
    const chip = button(filter === 'all' ? 'All' : CATEGORY_LABEL[filter], 'if-filterchip', () => {
      category = filter;
      syncChips();
      renderGrid();
    });
    categoryChips.set(filter, chip);
    filterBar.append(chip);
  }
  const grid = div('if-decisiongrid');
  main.append(filterBar, grid);

  const briefing = panel('Cabinet Briefing', 'scroll');
  const briefingHost = div('');
  briefing.body.append(briefingHost);
  aside.append(briefing.element);

  const detail = panel('Decision Detail', 'scroll');
  const detailHost = div('');
  detail.body.append(detailHost);
  aside.append(detail.element);

  function syncChips(): void {
    for (const [filter, chip] of categoryChips) chip.classList.toggle('is-on', filter === category);
  }

  function cardFor(decision: DecisionDef): HTMLElement {
    const ready = state.decisionReady(decision);
    const cooldown = state.decisionCooldown(decision);
    const card = div(`if-decision${selected?.id === decision.id ? ' is-selected' : ''}`);
    const head = div('if-decision__head');
    head.append(icon(decision.icon, 'if-ico'), span('if-decision__name', decision.name), tag(CATEGORY_LABEL[decision.category], 'blue'));
    head.append(tag(cooldown > 0 ? `${cooldown}d cooldown` : ready ? 'Ready' : 'Blocked', cooldown > 0 ? 'grey' : ready ? 'green' : 'red'));
    const body = div('if-decision__body');
    body.append(div('', decision.description.length > 150 ? `${decision.description.slice(0, 147)}…` : decision.description));
    if (decision.requirements.length > 0) {
      const reqs = div('if-decision__req');
      for (const check of state.requirementChecks(decision.requirements)) {
        reqs.append(div(check.met ? 'is-met' : 'is-missing', `${check.met ? '✓' : '✕'} ${check.text}`));
      }
      body.append(reqs);
    }
    const foot = div('if-decision__foot');
    const cost = span('if-cost');
    cost.append(icon('coin', 'if-ico'), document.createTextNode(`${decision.cost}`));
    const enact = button('Enact', 'if-btn if-btn--sm if-btn--gold', () => {
      const result = state.takeDecision(decision.id);
      ctx.toast(result.message, result.ok ? 'good' : 'bad');
      if (result.ok) {
        selected = decision;
        refresh();
      }
    });
    enact.disabled = !ready;
    foot.append(cost, enact, span('if-hint', decision.cooldown > 0 ? `${decision.cooldown} day cooldown` : 'No cooldown'));
    card.append(head, body, foot);
    card.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('button')) return;
      selected = decision;
      renderGrid();
      renderDetail();
    });
    return card;
  }

  function renderGrid(): void {
    grid.replaceChildren();
    const list = content.def.decisions.filter((decision) => category === 'all' || decision.category === category);
    if (list.length === 0) {
      grid.append(div('if-hint', 'No decisions are available in this category.'));
      return;
    }
    for (const decision of list) grid.append(cardFor(decision));
  }

  function renderBriefing(): void {
    briefingHost.replaceChildren();
    const ready = content.def.decisions.filter((decision) => state.decisionReady(decision));
    const blocked = content.def.decisions.filter((decision) => !state.decisionReady(decision));
    briefingHost.append(
      div('if-kv', span('if-kv__label', 'Political power'), span('if-kv__value', fmt(state.politicalPower))),
      div('if-kv', span('if-kv__label', 'Decisions ready'), span('if-kv__value', `${ready.length} / ${content.def.decisions.length}`)),
      div('if-kv', span('if-kv__label', 'Blocked'), span('if-kv__value', String(blocked.length))),
      div('if-kv', span('if-kv__label', 'Cooldowns running'), span('if-kv__value', String(content.def.decisions.filter((decision) => state.decisionCooldown(decision) > 0).length))),
    );
    if (ready.length > 0) {
      briefingHost.append(sectionLabel('Available now'));
      for (const decision of ready.slice(0, 4)) briefingHost.append(div('if-hint', `• ${decision.name}`));
    }
    briefingHost.append(div('if-hint', 'Decisions spend political power and enter a cooldown after being enacted. Requirements are enforced by the cabinet.'));
  }

  function renderDetail(): void {
    detailHost.replaceChildren();
    if (!selected) {
      detailHost.append(div('if-hint', 'Select a decision to read its full text.'));
      return;
    }
    const decision = selected;
    const head = div('if-focus-details__head');
    const iconBox = div('if-tech-detailicon');
    iconBox.innerHTML = icon(decision.icon, 'if-ico').outerHTML;
    const info = div('');
    const title = document.createElement('h3');
    title.className = 'if-focus-details__title';
    title.textContent = decision.name;
    const meta = div('if-focus-details__meta');
    meta.append(tag(CATEGORY_LABEL[decision.category], 'blue'), tag(`${decision.cost} PP`, 'gold'), tag(`${decision.cooldown} day cooldown`, 'grey'));
    info.append(title, meta);
    head.append(iconBox, info);
    detailHost.append(head, div('if-focus-details__desc', decision.description));

    if (decision.requirements.length > 0) {
      detailHost.append(sectionLabel('Conditions'));
      const reqs = div('if-prereqlist');
      for (const check of state.requirementChecks(decision.requirements)) {
        const row = div(`if-prereq${check.met ? ' is-met' : ''}`);
        row.append(span('if-prereq__dot'), span('', check.text), span('if-prereq__state', check.met ? 'Met' : 'Missing'));
        reqs.append(row);
      }
      detailHost.append(reqs);
    }

    detailHost.append(sectionLabel('Effects'));
    detailHost.append(effectList(decision.effects));

    const cooldown = state.decisionCooldown(decision);
    if (cooldown > 0) detailHost.append(div('if-hint', `On cooldown for ${cooldown} more days.`));

    const enact = button('Enact decision', 'if-btn if-btn--gold if-btn--block', () => {
      const result = state.takeDecision(decision.id);
      ctx.toast(result.message, result.ok ? 'good' : 'bad');
      if (result.ok) refresh();
    });
    enact.disabled = !state.decisionReady(decision);
    enact.style.marginTop = '10px';
    detailHost.append(enact);
  }

  function refresh(): void {
    ppBadge.textContent = `PP ${fmt(state.politicalPower)}`;
    renderGrid();
    renderBriefing();
    renderDetail();
  }

  syncChips();
  renderGrid();
  renderBriefing();
  renderDetail();

  return { element: frame.element, refresh };
}
