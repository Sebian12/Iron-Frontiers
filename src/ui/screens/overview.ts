import { button, countStat, div, icon, meterBlock, span, tag, withTip } from '../components';
import type { Screen, ScreenContext } from '../screen';
import { flag, flagBackground, ideologyName } from '../screen';
import { compact, fmt, pct } from '../format';

// Strategic overview: floating command cards over the live Pixi map. Everything here is read from
// the running GameState, so the numbers match the other screens and update as time passes.

export function mountOverview(ctx: ScreenContext): Screen {
  const { state, content } = ctx;
  const element = div('if-screen if-screen--map');
  const refs: Record<string, HTMLElement> = {};

  const country = content.def;

  // ---------------------------------------------------------------- country card
  const countryCard = div('if-mapcard if-mapcard--tl if-mapcard--w360');
  const countryHeadCard = div('if-mapcard__head');
  countryHeadCard.append(span('if-mapcard__title', 'National Command'));
  const countryBody = div('if-mapcard__body if-countryhead');

  const portraitWrap = div('');
  const flagEl = flag(state.world.countries[state.countryId].color, country.accent, 'if-flag');
  flagEl.style.width = '100%';
  flagEl.style.height = '4px';
  portraitWrap.style.width = '100%';
  portraitWrap.append(flagEl);
  portraitWrap.style.marginBottom = '8px';

  const meta = div('if-countryhead__meta');
  const nameEl = document.createElement('h3');
  nameEl.className = 'if-countryhead__name';
  nameEl.textContent = country.name;
  const tagLine = div('if-countryhead__tag');
  tagLine.append(tag(country.tag, 'gold'), document.createTextNode(' '), tag(ideologyName(state, country.ideology), 'grey'));
  const leaderRow = div('if-countryhead__leader');
  const leaderIcon = div('if-modifier__icon');
  leaderIcon.append(icon('crown', 'if-ico'));
  const leaderText = div('');
  leaderText.append(
    span('if-countryhead__leadername', country.leader.name),
    span('if-countryhead__leadertitle', country.leader.title),
  );
  leaderRow.append(leaderIcon, leaderText);
  withTip(leaderRow, `<span class="if-tip__title">${country.leader.name}</span>${country.leader.biography}`);

  meta.append(nameEl, tagLine, div('if-kv', span('if-kv__label', 'Coalition'), span('if-kv__value', country.coalition ?? '—')), leaderRow);

  countryBody.append(portraitWrap, meta);

  const statsBody = div('if-mapcard__body');
  statsBody.style.paddingTop = '0';
  statsBody.style.borderTop = '1px solid var(--border-soft)';
  const meters = div('if-grid2');
  meters.append(
    meterBlock(state.stability, state.stability < 0.4 ? 'red' : 'green', 'Stability'),
    meterBlock(state.warSupport, 'gold', 'War Support'),
  );
  const statRow = div('if-grid2');
  statRow.style.marginTop = '9px';
  const ppStat = countStat('coin', '', 'Political Power', 'Political power is spent on focuses, advisors, decisions and diplomacy. It grows by about 1 per day.');
  const mpStat = countStat('people', '', 'Manpower', 'Available recruits. Fielding divisions and reinforcing them consumes manpower.');
  ppStat.querySelector('.if-statcard__value')!.textContent = compact(state.politicalPower);
  refs.pp = ppStat.querySelector('.if-statcard__value') as HTMLElement;
  mpStat.querySelector('.if-statcard__value')!.textContent = compact(state.manpower);
  refs.mp = mpStat.querySelector('.if-statcard__value') as HTMLElement;
  statRow.append(ppStat, mpStat);

  const jumpRow = div('if-row');
  jumpRow.style.marginTop = '10px';
  jumpRow.append(
    button('Politics', 'if-btn if-btn--sm', () => ctx.open('politics')),
    button('Focus Tree', 'if-btn if-btn--sm if-btn--gold', () => ctx.open('focus')),
    button('Economy', 'if-btn if-btn--sm if-btn--ghost', () => ctx.open('construction')),
  );
  statsBody.append(meters, statRow, jumpRow);
  countryCard.append(countryHeadCard, countryBody, statsBody);

  // ---------------------------------------------------------------- focus / industry card
  const focusCard = div('if-mapcard if-mapcard--tr if-mapcard--w320');
  const focusHead = div('if-mapcard__head');
  focusHead.append(span('if-mapcard__title', 'National Focus'));
  const focusBody = div('if-mapcard__body');
  const focusHost = div('');
  focusBody.append(focusHost);

  const industryHead = div('if-mapcard__head');
  industryHead.append(span('if-mapcard__title', 'Industry & Forces'));
  const industryBody = div('if-mapcard__body');
  const industryRows = div('');
  const industryData: [string, string, () => string][] = [
    ['Civilian factories', 'factory', () => fmt(state.civilianFactories)],
    ['Military factories', 'gear', () => fmt(state.militaryFactories)],
    ['Dockyards', 'anchor', () => fmt(state.dockyards)],
    ['Divisions', 'helmet', () => fmt(state.divisions.length)],
  ];
  const industryRefs: HTMLElement[] = [];
  for (const [label, iconName, value] of industryData) {
    const row = div('if-kv');
    const left = span('if-kv__label');
    left.append(icon(iconName, 'if-ico if-ico--sm'), document.createTextNode(` ${label}`));
    const val = span('if-kv__value', value());
    industryRefs.push(val);
    row.append(left, val);
    industryRows.append(row);
  }
  const econLine = div('if-kv');
  econLine.style.borderTop = '1px solid var(--border-soft)';
  econLine.style.marginTop = '4px';
  econLine.append(span('if-kv__label', 'Treasury'));
  const treasuryValue = span('if-kv__value', `${fmt(state.treasury)} M`);
  refs.treasury = treasuryValue;
  econLine.append(treasuryValue);
  industryRows.append(econLine);
  const incomeLine = div('if-kv');
  incomeLine.append(span('if-kv__label', 'Daily balance'));
  const incomeValue = span(`if-kv__value ${state.income - state.expenses >= 0 ? 'if-num--pos' : 'if-num--neg'}`, `${state.income - state.expenses >= 0 ? '+' : ''}${fmt(state.income - state.expenses)}`);
  refs.balance = incomeValue;
  incomeLine.append(incomeValue);
  industryRows.append(incomeLine);
  industryBody.append(industryRows);

  const alertsHead = div('if-mapcard__head');
  alertsHead.append(span('if-mapcard__title', 'Situation Room'));
  const alertsBody = div('if-mapcard__body');
  alertsBody.style.maxHeight = '196px';
  const alertsHost = div('if-alertlist');
  alertsBody.append(alertsHost);

  focusCard.append(focusHead, focusBody, industryHead, industryBody, alertsHead, alertsBody);

  // ---------------------------------------------------------------- selected province
  const provinceCard = div('if-mapcard if-mapcard--bl if-mapcard--w320');
  function buildProvince(): void {
    provinceCard.replaceChildren();
    const provinceId = state.selectedProvinceId;
    if (!provinceId || provinceId <= 0) {
      provinceCard.style.display = 'none';
      return;
    }
    provinceCard.style.display = '';
    const province = state.world.provinces[provinceId];
    if (!province) {
      provinceCard.style.display = 'none';
      return;
    }
    const head = div('if-mapcard__head');
    head.append(span('if-mapcard__title', 'Province'));
    const close = button('×', 'if-iconbtn if-modal__close', () => {
      state.selectedProvinceId = 0;
      ctx.map.selectProvince(0);
      buildProvince();
    });
    close.setAttribute('aria-label', 'Clear province selection');
    head.append(close);

    const body = div('if-mapcard__body if-province');
    const st = state.world.states[province.state];
    body.append(span('if-province__name', st?.name ?? province.name));
    const owner = state.world.countries[province.owner];
    const ownerRow = div('if-province__owner');
    if (owner && owner.id !== 0) {
      const swatch = span('if-flagmini');
      swatch.style.background = flagBackground(owner.color, content.ideologies[state.country.ideology]?.color ?? '#555');
      ownerRow.append(swatch, span('', owner.name));
    } else {
      ownerRow.append(span('', 'Open sea'));
    }
    body.append(ownerRow);
    body.append(div('if-kv', span('if-kv__label', 'Province'), span('if-kv__value', `#${province.id}`)));
    body.append(div('if-kv', span('if-kv__label', 'State'), span('if-kv__value', st?.name ?? '—')));
    body.append(div('if-kv', span('if-kv__label', 'Neighbours'), span('if-kv__value', fmt(province.neighbors.length))));
    if (owner && owner.id !== 0) {
      const actions = div('if-row');
      actions.style.marginTop = '8px';
      actions.append(
        button('Diplomacy', 'if-btn if-btn--sm', () => {
          state.selectedCountryId = owner.id;
          ctx.map.highlightCountry(owner.id);
          ctx.openDiplomacy(owner.id);
        }),
        button('Centre', 'if-btn if-btn--sm if-btn--ghost', () => {
          ctx.map.focusProvince(province.id);
        }),
      );
      body.append(actions);
    }
    provinceCard.append(head, body);
  }

  element.append(countryCard, focusCard, provinceCard);

  // ---------------------------------------------------------------- painting
  function paintFocus(): void {
    focusHost.replaceChildren();
    const active = state.focus;
    if (active) {
      const focus = state.focusById(active.id);
      if (focus) {
        const banner = div('if-focusbanner');
        const titleRow = div('if-row');
        titleRow.append(icon(focus.icon, 'if-ico if-ico--gold'), span('if-focusbanner__name', focus.name));
        const metaRow = div('if-focusbanner__meta');
        metaRow.append(span('', `In progress · ${state.focusDaysLeft()} days left`), span('', `${Math.round(state.focusProgress() * 100)}%`));
        banner.append(titleRow, metaRow, meterBlock(state.focusProgress(), 'gold', 'Progress'));
        const openBtn = button('Open focus tree', 'if-btn if-btn--sm if-btn--block', () => ctx.open('focus'));
        banner.append(openBtn);
        focusHost.append(banner);
        return;
      }
    }
    const available = state.availableFocuses();
    const box = div('if-focusbanner');
    box.append(span('if-focusbanner__name', available.length ? 'No focus in progress' : 'All focuses locked'));
    box.append(
      span(
        'if-muted',
        available.length
          ? `${available.length} focus${available.length === 1 ? '' : 'es'} ready to begin. A national focus is the main way to shape the country.`
          : 'Complete a prerequisite focus to unlock the next branch.',
      ),
    );
    for (const focus of available.slice(0, 3)) {
      const row = button('', 'if-alertrow', () => ctx.open('focus'));
      row.append(icon(focus.icon, 'if-ico'), span('', focus.name), span('if-alertrow__arrow', '›'));
      box.append(row);
    }
    box.append(button('Open focus tree', 'if-btn if-btn--sm if-btn--gold if-btn--block', () => ctx.open('focus')));
    focusHost.append(box);
  }

  function paintAlerts(): void {
    const alerts = state.alerts();
    alertsHost.replaceChildren();
    if (alerts.length === 0) {
      const quiet = div('if-hint');
      quiet.style.padding = '6px 2px';
      quiet.textContent = 'Nothing demands the cabinet’s attention. Advance the campaign or open a management screen.';
      alertsHost.append(quiet);
      return;
    }
    for (const alert of alerts.slice(0, 6)) {
      const row = button('', `if-alertrow if-alertrow--${alert.kind}`, () => ctx.open(alert.screen as never));
      row.append(icon(alert.kind === 'bad' ? 'target' : alert.kind === 'warn' ? 'thunder' : 'scroll', 'if-ico'));
      row.append(span('', alert.text));
      row.append(span('if-alertrow__arrow', '›'));
      alertsHost.append(row);
    }
  }

  function refresh(): void {
    refs.pp.textContent = compact(state.politicalPower);
    refs.mp.textContent = compact(state.manpower);
    refs.treasury.textContent = `${fmt(state.treasury)} M`;
    const balance = state.income - state.expenses;
    refs.balance.textContent = `${balance >= 0 ? '+' : ''}${fmt(balance)}`;
    refs.balance.className = `if-kv__value ${balance >= 0 ? 'if-num--pos' : 'if-num--neg'}`;
    const meterBars = meters.querySelectorAll<HTMLElement>('.if-meter__fill');
    meterBars[0].style.width = `${state.stability * 100}%`;
    meterBars[1].style.width = `${state.warSupport * 100}%`;
    meters.querySelectorAll<HTMLElement>('.if-meterblock__value')[0].textContent = pct(state.stability);
    meters.querySelectorAll<HTMLElement>('.if-meterblock__value')[1].textContent = pct(state.warSupport);
    const values: string[] = [fmt(state.civilianFactories), fmt(state.militaryFactories), fmt(state.dockyards), fmt(state.divisions.length)];
    industryRefs.forEach((node, index) => (node.textContent = values[index]));
    paintFocus();
    paintAlerts();
    buildProvince();
  }

  buildProvince();
  paintFocus();
  paintAlerts();

  return { element, refresh };
}
