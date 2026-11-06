import type { DecisionDef } from '../../sim/content';
import { ADVISOR_SLOTS, type AdvisorSlot } from '../../sim/gameState';
import { button, div, icon, meter, meterBlock, modal, panel, portrait, span, tag, withTip } from '../components';
import type { Screen, ScreenContext } from '../screen';
import { ideologyName, screenFrame } from '../screen';
import { fmt, pct } from '../format';

// Political management: government, parties, advisors, national modifiers and political decisions.

export function mountPolitics(ctx: ScreenContext): Screen {
  const { state, content } = ctx;
  const country = content.def;
  const ppBadge = span('if-tag if-tag--gold', `PP ${fmt(state.politicalPower)}`);
  const frame = screenFrame('gov', 'Politics', `${country.name} · cabinet, parties and national policy`, [ppBadge]);
  const grid = div('if-politics-grid');
  frame.body.append(grid);

  let expandedParty: string | null = null;
  const decisionRefs: { decision: DecisionDef; button: HTMLButtonElement; cooldown: HTMLElement }[] = [];

  // ---------------------------------------------------------------- government
  const government = panel('Government', 'crown');
  const ruler = div('if-ruler');
  ruler.append(portrait(country.leader.portrait, country.accent, 'lg'));
  const rulerInfo = div('if-ruler__info');
  const rulerName = document.createElement('div');
  rulerName.className = 'if-ruler__name';
  rulerName.textContent = state.political.leaderName;
  const rulerTitle = div('if-ruler__title', state.political.leaderTitle);
  const ideologyTag = tag(ideologyName(state, state.political.ideology), 'gold');
  ideologyTag.style.marginBottom = '6px';
  const bio = div('if-ruler__bio', country.leader.biography);
  const traits = div('if-traitlist');
  for (const trait of country.leader.traits) {
    const chip = tag(trait.name, 'blue');
    withTip(chip, `<span class="if-tip__title">${trait.name}</span>${trait.description}`);
    traits.append(chip);
  }
  rulerInfo.append(rulerName, rulerTitle, ideologyTag, bio, traits);
  ruler.append(rulerInfo);

  const govBody = government.body;
  govBody.append(ruler);
  const govDetails = div('');
  govDetails.append(
    div('if-kv', span('if-kv__label', 'Ruling coalition'), span('if-kv__value', country.coalition ?? '—')),
    div('if-kv', span('if-kv__label', 'Constitution'), span('if-kv__value', state.politicalSystem?.name ?? state.political.systemId)),
    meterBlock(state.political.legitimacy, state.political.legitimacy < 0.4 ? 'red' : 'blue', state.politicalSystem?.legitimacyLabel ?? 'Government legitimacy'),
    div('', meterBlock(state.stability, state.stability < 0.4 ? 'red' : 'green', 'Stability')),
    div('', meterBlock(state.warSupport, 'gold', 'War support')),
  );
  govDetails.style.display = 'flex';
  govDetails.style.flexDirection = 'column';
  govDetails.style.gap = '8px';
  govDetails.style.marginTop = '10px';
  govBody.append(govDetails);

  // ---------------------------------------------------------------- parties
  const parties = panel('Political Parties', 'ballot');
  const partyList = div('');
  for (const party of country.parties) {
    const row = button('', `if-party${party.inGovernment ? ' is-ruling' : ''}`, () => {
      expandedParty = expandedParty === party.name ? null : party.name;
      ctx.rerender();
    });
    const iconWrap = div('if-party__icon');
    iconWrap.append(icon(content.ideologies[party.ideology]?.icon ?? 'ballot', 'if-ico'));
    const nameWrap = div('');
    nameWrap.append(span('if-party__name', party.name), span('if-party__sub', ideologyName(state, party.ideology)));
    const pctEl = span('if-party__pct', pct(party.popularity));
    const bar = div('if-party__bar');
    bar.append(meter(party.popularity, party.inGovernment ? 'gold' : 'blue'));
    row.append(iconWrap, nameWrap, pctEl, bar);
    partyList.append(row);
    if (expandedParty === party.name) {
      const details = div('if-party__details');
      details.append(span('', party.description ?? 'No further information on file.'));
      if (party.inGovernment) {
        const badge = tag('In government', 'green');
        badge.style.marginLeft = '8px';
        details.append(badge);
      }
      partyList.append(details);
    }
  }
  parties.body.append(partyList, div('if-hint', 'Select a party to review its position. Popularity shifts as the political situation changes.'));

  // ---------------------------------------------------------------- advisors
  const advisors = panel('Advisor Slots', 'people', { subtitle: 'Costs political power' });
  const advisorGrid = div('if-advisors');
  for (const slot of ADVISOR_SLOTS) {
    const hired = state.hiredAdvisor(slot.id);
    if (hired) {
      const card = div('if-advisor is-filled');
      card.append(portrait(hired.portrait, country.accent, 'sm'));
      const body = div('if-advisor__body');
      body.append(
        span('if-advisor__slot', slot.name),
        span('if-advisor__name', hired.name),
        span('if-advisor__bonus', hired.bonus),
        span('if-advisor__desc', hired.description),
      );
      const foot = div('if-advisor__foot');
      foot.append(tag('In office', 'green'));
      foot.append(
        button('Dismiss', 'if-btn if-btn--sm if-btn--danger', () => {
          const confirmBody = div('');
          confirmBody.append(
            span('if-muted', `${hired.name} will leave the government. Passive bonuses are removed; the appointment cost is not refunded.`),
          );
          modal({
            title: 'Dismiss advisor',
            iconName: 'people',
            body: confirmBody,
            width: 440,
            actions: [
              { label: 'Keep in office', className: 'if-btn--ghost' },
              {
                label: 'Dismiss',
                className: 'if-btn--danger',
                onClick: () => {
                  state.dismissAdvisor(slot.id);
                  ctx.toast(`${hired.name} dismissed.`, 'warn');
                  ctx.rerender();
                },
              },
            ],
          });
        }),
      );
      body.append(foot);
      card.append(body);
      advisorGrid.append(card);
    } else {
      const candidates = state.advisorCandidates(slot.id);
      const empty = div('if-advisor if-advisor--empty');
      empty.append(icon(slot.icon, 'if-ico if-ico--xl'), span('', slot.name), span('if-hint', candidates.length ? 'Vacant — click to appoint' : 'No candidates available'));
      if (candidates.length > 0) {
        empty.addEventListener('click', () => openAdvisorPicker(slot.id, slot.name));
        empty.style.cursor = 'pointer';
      }
      advisorGrid.append(empty);
    }
  }
  advisors.body.append(advisorGrid);

  // ---------------------------------------------------------------- national modifiers
  const modifiers = panel('National Modifiers', 'scroll');
  for (const modifier of country.modifiers) {
    const row = div('if-modifier');
    const iconBox = div('if-modifier__icon');
    iconBox.append(icon(modifier.icon, 'if-ico'));
    const body = div('');
    body.append(span('if-modifier__name', modifier.name), span('if-modifier__effect', modifier.effect), div('if-modifier__desc', modifier.description));
    row.append(iconBox, body);
    if (modifier.rates) {
      const rates = Object.entries(modifier.rates)
        .map(([key, value]) => `${key}: ${(value as number) > 0 ? '+' : ''}${Math.round((value as number) * 100)}%`)
        .join(' · ');
      withTip(row, `<span class="if-tip__title">${modifier.name}</span>${modifier.description}<span class="if-tip__note">${rates}</span>`);
    }
    modifiers.body.append(row);
  }
  modifiers.body.append(div('if-hint', 'Modifiers are permanent national conditions. Advisors and completed focuses add further bonuses.'));

  // ---------------------------------------------------------------- decisions
  const decisions = panel('Political Decisions', 'scroll', { subtitle: 'One action at a time' });
  const decisionList = div('');
  for (const decision of country.decisions) {
    decisionList.append(buildDecisionCard(decision));
  }
  decisions.body.append(decisionList);

  // ---------------------------------------------------------------- political system and mechanic
  const systemPanel = panel('Constitutional Order', state.politicalSystem?.icon ?? 'gov');
  systemPanel.body.append(
    div('if-pol-system__name', state.politicalSystem?.name ?? state.political.systemId),
    div('if-muted', state.politicalSystem?.description ?? ''),
    div('if-metricgrid',
      div('', meterBlock(state.political.legitimacy, 'blue', state.politicalSystem?.legitimacyLabel ?? 'Legitimacy')),
      div('', meterBlock(state.political.tension / 100, state.political.tension > 40 ? 'red' : 'gold', 'Political tension')),
      div('', meterBlock(state.political.revolutionSupport / 100, state.political.revolutionSupport > 40 ? 'red' : 'grey', 'Revolutionary support')),
      div('', meterBlock(state.political.governmentLoyalty / 100, 'green', 'Government loyalty')),
    ),
  );
  const mechanic = state.politics.mechanic();
  if (mechanic) {
    const mechBox = div('if-mechanic');
    const mechHead = div('if-mechanic__head');
    mechHead.append(icon(mechanic.icon, 'if-ico'), span('if-mechanic__name', mechanic.name), tag(`${Math.round(state.political.mechanicValue)} / 100`, 'gold'));
    mechBox.append(mechHead, div('if-muted', mechanic.description), meterBlock(state.political.mechanicValue / 100, 'gold', mechanic.valueLabel));
    const actions = div('if-mechanic__actions');
    for (const action of mechanic.actions) {
      const btn = button(`${action.name} · ${action.cost} PP`, 'if-btn if-btn--sm', () => {
        const result = state.useMechanicAction(action.id);
        ctx.toast(result.message, result.ok ? 'good' : 'bad');
        if (result.ok) ctx.rerender();
      });
      btn.disabled = state.politicalPower < action.cost;
      withTip(btn, `<span class="if-tip__title">${action.name}</span>${action.description}<span class="if-tip__note">${action.cost} political power</span>`);
      actions.append(btn);
    }
    mechBox.append(actions);
    systemPanel.body.append(mechBox);
  }

  const revolution = state.revolutionStatus();
  const revolutionBox = div('if-revolution');
  revolutionBox.append(
    div('if-sectionlabel', span('if-sectionlabel__text', 'Revolutionary Pressure')),
    div('if-hint', `Organisation ${Math.round(state.political.revolutionOrganization)} / 100 · estimated strength ${revolution.strength}`),
  );
  const revolutionBtn = button('Proclaim Revolution', 'if-btn if-btn--danger if-btn--block', () => {
    modal({
      title: 'Proclaim the Revolution',
      iconName: 'flame',
      body: div('', `The revolutionary movement will attempt to seize power. Current strength: ${revolution.strength}. Success depends on support, organisation, stability and government loyalty. A failed rising will weaken the movement.`),
      actions: [
        { label: 'Not yet', className: 'if-btn--ghost' },
        { label: 'Launch the rising', className: 'if-btn--danger', onClick: () => {
          const result = state.launchRevolution();
          ctx.toast(result.message, result.ok ? 'good' : 'bad');
          ctx.rerender();
        } },
      ],
    });
  });
  revolutionBtn.disabled = !revolution.ready;
  if (!revolution.ready) withTip(revolutionBtn, `Requirements: ${revolution.missing.join(' · ')}`);
  revolutionBox.append(revolutionBtn);
  if (!revolution.ready) revolutionBox.append(div('if-hint', revolution.missing.join(' · ')));

  const coupTargets = state.coupTargets();
  if (coupTargets.length > 0) {
    revolutionBox.append(div('if-sectionlabel', span('if-sectionlabel__text', 'Coup Risk')), div('if-hint', 'Groups with enough influence and a hostile agenda may attempt to seize power.'));
    for (const group of coupTargets) {
      const btn = button(`${group.name} · ${state.coupChance(group.name)}%`, 'if-btn if-btn--sm if-btn--danger', () => {
        modal({
          title: 'A Coup Attempt',
          iconName: 'swords',
          body: div('', `${group.leader} and ${group.name} are preparing to seize the government. Estimated success chance: ${state.coupChance(group.name)}%. Failure will damage the group and raise political tension.`),
          actions: [
            { label: 'Stand down', className: 'if-btn--ghost' },
            { label: 'Proceed', className: 'if-btn--danger', onClick: () => {
              const result = state.attemptCoup(group.name);
              ctx.toast(result.message, result.ok ? 'good' : 'bad');
              ctx.rerender();
            } },
          ],
        });
      });
      revolutionBox.append(btn);
    }
  }
  systemPanel.body.append(revolutionBox);

  // ---------------------------------------------------------------- movements
  const movements = panel('Movements & Influence', 'people', { subtitle: 'Popularity is public support; influence is actual power' });
  const movementList = div('if-movements');
  for (const group of [...state.political.groups].sort((a, b) => b.influence - a.influence)) {
    const row = div(`if-movement${group.inGovernment ? ' is-ruling' : ''}`);
    const head = div('if-movement__head');
    head.append(
      icon(content.ideologies[group.ideology]?.icon ?? 'ballot', 'if-ico'),
      span('if-movement__name', group.name),
      tag(group.inGovernment ? 'In government' : 'Opposition', group.inGovernment ? 'green' : 'grey'),
    );
    const meta = div('if-movement__meta', `${group.leader} · ${group.objective}`);
    const bars = div('if-movement__bars');
    bars.append(
      div('if-movement__bar', span('', `Popularity ${pct(group.popularity)}`), meter(group.popularity, group.inGovernment ? 'gold' : 'blue')),
      div('if-movement__bar', span('', `Influence ${Math.round(group.influence)} / 100`), meter(group.influence / 100, 'green')),
    );
    const actions = div('if-movement__actions');
    const campaign = button('Campaign · 15 PP', 'if-btn if-btn--sm', () => {
      const result = state.campaignGroup(group.name);
      ctx.toast(result.message, result.ok ? 'good' : 'bad');
      if (result.ok) ctx.rerender();
    });
    campaign.disabled = state.politicalPower < 15;
    const suppress = button('Suppress · 20 PP', 'if-btn if-btn--sm if-btn--danger', () => {
      const result = state.suppressGroup(group.name);
      ctx.toast(result.message, result.ok ? 'good' : 'bad');
      if (result.ok) ctx.rerender();
    });
    suppress.disabled = state.politicalPower < 20 || group.inGovernment;
    actions.append(campaign, suppress);
    row.append(head, meta, bars, actions);
    movementList.append(row);
  }
  movements.body.append(movementList);

  // ---------------------------------------------------------------- transitions
  const transitions = panel('Constitutional Change', 'scroll', { subtitle: 'Requirements are checked against the living state' });
  for (const transition of state.politicalTransitions()) {
    const missing = state.transitionMissing(transition.id);
    const card = div(`if-transition${missing.length ? ' is-locked' : ''}`);
    const head = div('if-transition__head');
    head.append(icon(transition.icon, 'if-ico'), span('if-transition__name', transition.name), tag(transition.kind, 'blue'));
    const body = div('if-transition__body');
    body.append(div('if-muted', transition.description));
    if (transition.cost) body.append(div('if-hint', `${transition.cost} political power`));
    if (missing.length) {
      const reqs = div('if-transition__req');
      for (const item of missing) reqs.append(div('is-missing', `✕ ${item}`));
      body.append(reqs);
    } else {
      body.append(div('if-transition__ready', '✓ All requirements met'));
    }
    const btn = button(missing.length ? 'Requirements not met' : 'Enact Transition', 'if-btn if-btn--sm if-btn--gold', () => {
      modal({
        title: transition.name,
        iconName: transition.icon,
        body: div('', `${transition.description} This will replace the current constitution, change the political system and may cancel a focus whose path is closed. Completed focuses and political history are preserved.`),
        actions: [
          { label: 'Cancel', className: 'if-btn--ghost' },
          { label: 'Enact', className: 'if-btn--gold', onClick: () => {
            const result = state.executeTransition(transition.id);
            ctx.toast(result.message, result.ok ? 'good' : 'bad');
            if (result.ok) ctx.rerender();
          } },
        ],
      });
    });
    btn.disabled = missing.length > 0;
    card.append(head, body, btn);
    transitions.body.append(card);
  }

  const leftCol = div('if-col');
  leftCol.append(government.element, parties.element);
  const centerCol = div('if-col');
  centerCol.append(systemPanel.element, movements.element, advisors.element);
  const rightCol = div('if-col');
  rightCol.append(transitions.element, modifiers.element, decisions.element);
  grid.append(leftCol, centerCol, rightCol);

  // ---------------------------------------------------------------- helpers
  function buildDecisionCard(decision: DecisionDef): HTMLElement {
    const card = div('if-decision');
    const head = div('if-decision__head');
    head.append(icon(decision.icon, 'if-ico'), span('if-decision__name', decision.name), tag(decision.category, 'blue'));
    const cooldown = span('if-tag if-tag--grey', '');
    head.append(cooldown);
    const body = div('if-decision__body');
    body.append(div('', decision.description));

    if (decision.requirements.length > 0) {
      const reqs = div('if-decision__req');
      for (const check of state.requirementChecks(decision.requirements)) {
        const row = div(check.met ? 'is-met' : 'is-missing', `${check.met ? '✓' : '✕'} ${check.text}`);
        reqs.append(row);
      }
      body.append(reqs);
    }

    const effects = div('if-decision__effects');
    effects.append(...decision.effects.map((effect) => {
      const row = div(`if-effect if-effect--${effect.kind ?? 'neutral'}`);
      row.append(span('if-effect__mark', effect.kind === 'negative' ? '−' : '+'), span('if-effect__text', effect.text));
      return row;
    }));
    body.append(effects);

    const foot = div('if-decision__foot');
    const cost = span('if-cost');
    cost.append(icon('coin', 'if-ico'), document.createTextNode(`${decision.cost}`));
    const btn = button('Enact', 'if-btn if-btn--sm if-btn--gold', () => {
      const result = state.takeDecision(decision.id);
      ctx.toast(result.message, result.ok ? 'good' : 'bad');
      if (result.ok) ctx.rerender();
      else refresh();
    });
    foot.append(cost, btn);
    foot.append(span('if-hint', decision.cooldown > 0 ? `${decision.cooldown} day cooldown` : ''));
    card.append(head, body, foot);
    decisionRefs.push({ decision, button: btn, cooldown });
    return card;
  }

  function openAdvisorPicker(slot: AdvisorSlot, slotName: string): void {
    const candidates = state.advisorCandidates(slot);
    const list = div('if-col');
    for (const candidate of candidates) {
      const card = div('if-advisor');
      card.append(portrait(candidate.portrait, country.accent, 'sm'));
      const body = div('if-advisor__body');
      body.append(
        span('if-advisor__slot', candidate.position),
        span('if-advisor__name', candidate.name),
        span('if-advisor__bonus', candidate.bonus),
        span('if-advisor__desc', candidate.description),
      );
      const foot = div('if-advisor__foot');
      foot.append(tag(`${candidate.cost} PP`, state.politicalPower >= candidate.cost ? 'gold' : 'red'));
      const hireBtn = button('Appoint', 'if-btn if-btn--sm if-btn--gold', () => {
        const result = state.hireAdvisor(candidate.id);
        if (!result.ok) {
          ctx.toast(result.message, 'bad');
          return;
        }
        ctx.toast(`${candidate.name} appointed as ${slotName}.`, 'good');
        handle.close();
        ctx.rerender();
      });
      hireBtn.disabled = state.politicalPower < candidate.cost;
      foot.append(hireBtn);
      body.append(foot);
      card.append(body);
      list.append(card);
    }
    const handle = modal({
      title: `Appoint ${slotName}`,
      subtitle: `${fmt(state.politicalPower)} political power available`,
      iconName: 'people',
      body: list,
      width: 560,
      actions: [{ label: 'Cancel', className: 'if-btn--ghost' }],
    });
  }

  function refresh(): void {
    ppBadge.textContent = `PP ${fmt(state.politicalPower)}`;
    for (const entry of decisionRefs) {
      const cooldown = state.decisionCooldown(entry.decision);
      const ready = state.decisionReady(entry.decision);
      entry.button.disabled = !ready;
      entry.cooldown.textContent = cooldown > 0 ? `${cooldown}d` : ready ? 'Ready' : 'Locked';
      entry.cooldown.className = `if-tag ${cooldown > 0 ? 'if-tag--grey' : ready ? 'if-tag--green' : 'if-tag--red'}`;
    }
    const bars = govDetails.querySelectorAll<HTMLElement>('.if-meter__fill');
    if (bars.length >= 3) {
      bars[1].style.width = `${state.stability * 100}%`;
      bars[2].style.width = `${state.warSupport * 100}%`;
    }
    const values = govDetails.querySelectorAll<HTMLElement>('.if-meterblock__value');
    if (values.length >= 3) {
      values[1].textContent = pct(state.stability);
      values[2].textContent = pct(state.warSupport);
    }
  }

  // Keep the flag gradient honest for generic countries.
  frame.element.style.setProperty('--accent', country.accent);

  return { element: frame.element, refresh };
}
