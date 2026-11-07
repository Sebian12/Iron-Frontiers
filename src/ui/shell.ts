import type { ContentBundle } from '../sim/content';
import type { GameState } from '../sim/gameState';
import { isTextField, button, div, icon, modal, span, toast, withTip, type ModalHandle } from './components';
import { installIcons } from './icons';
import { compact, fmt, pct } from './format';
import type { MapBridge, Screen, ScreenContext, ScreenId } from './screen';
import { flagImage } from './flags';
import { mountOverview } from './screens/overview';
import { mountPolitics } from './screens/politics';
import { mountFocusTree } from './screens/focusTree';
import { mountResearch } from './screens/research';
import { mountProduction } from './screens/production';
import { mountConstruction } from './screens/construction';
import { mountMilitary } from './screens/military';
import { mountDiplomacy } from './screens/diplomacy';
import { mountIntelligence } from './screens/intelligence';
import { mountDecisions } from './screens/decisions';
import { mountHistory } from './screens/history';
import { mountTrade } from './screens/trade';
import { getSettings } from './settings';
import { openProvincePanel } from './provincePanel';
import { hideTipNow } from './tooltip';

// Game shell: top bar, navigation, bottom clock, screen router, simulation clock and the shared
// event modal. Screens are mounted into the stage and rebuilt through the ScreenContext.

interface NavEntry {
  id: ScreenId;
  label: string;
  icon: string;
  hotkey: string;
}

const NAV: NavEntry[] = [
  { id: 'overview', label: 'Map', icon: 'map', hotkey: '1' },
  { id: 'politics', label: 'Politics', icon: 'gov', hotkey: '2' },
  { id: 'focus', label: 'Focus', icon: 'star', hotkey: '3' },
  { id: 'research', label: 'Research', icon: 'flask', hotkey: '4' },
  { id: 'production', label: 'Industry', icon: 'gear', hotkey: '5' },
  { id: 'construction', label: 'Economy', icon: 'crane', hotkey: '6' },
  { id: 'trade', label: 'Trade', icon: 'exchange', hotkey: 'T' },
  { id: 'military', label: 'Army', icon: 'helmet', hotkey: '7' },
  { id: 'diplomacy', label: 'Diplomacy', icon: 'handshake', hotkey: '8' },
  { id: 'intelligence', label: 'Intel', icon: 'eye', hotkey: '9' },
  { id: 'decisions', label: 'Decisions', icon: 'scroll', hotkey: '0' },
  { id: 'history', label: 'History', icon: 'book', hotkey: 'H' },
];

const MOUNTS: Record<ScreenId, (ctx: ScreenContext) => Screen> = {
  overview: mountOverview,
  politics: mountPolitics,
  focus: mountFocusTree,
  research: mountResearch,
  production: mountProduction,
  construction: mountConstruction,
  trade: mountTrade,
  military: mountMilitary,
  diplomacy: mountDiplomacy,
  intelligence: mountIntelligence,
  decisions: mountDecisions,
  history: mountHistory,
};

const SPEEDS = [0, 0.12, 0.3, 0.65, 1.3, 2.6];

export interface GameShell {
  element: HTMLDivElement;
  open(id: ScreenId): void;
  refresh(): void;
  dispose(): void;
  currentScreen(): ScreenId;
  /** Selects a province without opening a modal. */
  selectProvince(id: number): void;
  /** Opens (or closes, with 0) the province sheet and selects the province on the map. */
  showProvince(id: number): void;
}

export function createGameShell(state: GameState, content: ContentBundle, map: MapBridge): GameShell {
  installIcons();
  const root = div('if-hud');
  const topbar = div('if-topbar');
  const main = div('if-main');
  const sidebar = div('if-sidebar');
  const stage = div('if-stage');
  const bottombar = div('if-bottombar');
  root.append(topbar, main, bottombar);
  main.append(sidebar, stage);

  // ---------------------------------------------------------------- top bar
  const countryButton = document.createElement('button');
  countryButton.type = 'button';
  countryButton.className = 'if-country-block';
  const mapCountry = state.world.countries[state.countryId];
  countryButton.append(flagImage(mapCountry));
  const countryName = div('if-country-name');
  const strong = document.createElement('strong');
  strong.textContent = content.def.name;
  const small = document.createElement('small');
  small.textContent = `${content.def.tag} · ${content.ideologies[content.def.ideology]?.name ?? content.def.ideology}`;
  countryName.append(strong, small);
  countryButton.append(countryName);
  withTip(countryButton, `<span class="if-tip__title">${content.def.name}</span>${content.def.leader.name} · ${content.def.leader.title}<span class="if-tip__note">Open the national overview</span>`);
  countryButton.addEventListener('click', () => open('overview'));

  const strip = div('if-statstrip');
  const statRefs = new Map<string, HTMLElement>();

  function stat(key: string, iconName: string, label: string, value: string, target: ScreenId, tooltip: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'if-stat';
    const valueEl = span('if-stat__value', value);
    const body = div('if-stat__body');
    body.append(valueEl, span('if-stat__label', label));
    btn.append(icon(iconName, 'if-ico'), body);
    btn.addEventListener('click', () => open(target));
    withTip(btn, tooltip);
    statRefs.set(key, valueEl);
    strip.append(btn);
    return btn;
  }

  stat('pp', 'coin', 'Pol. power', fmt(state.politicalPower), 'politics', 'Political power: spent on focuses, advisors and diplomacy. Grows over time.');
  stat('stability', 'scales', 'Stability', pct(state.stability), 'politics', 'Stability: low stability drains political power and can trigger unrest.');
  stat('war', 'swords', 'War support', pct(state.warSupport), 'politics', 'War support: affects mobilisation and the willingness to fight.');
  stat('manpower', 'people', 'Manpower', compact(state.manpower), 'military', 'Manpower available for new divisions and reinforcements.');
  stat('industry', 'factory', 'Industry', fmt(state.industrialCapacity), 'production', 'Civilian factories, military factories and dockyards combined.');

  const headright = div('if-headright');
  const treasuryWrap = div('if-headdate');
  const treasuryValue = document.createElement('strong');
  treasuryValue.textContent = `${fmt(state.treasury)} M`;
  treasuryWrap.append(treasuryValue, (() => {
    const label = document.createElement('small');
    label.textContent = 'Treasury';
    return label;
  })());
  withTip(treasuryWrap, 'National treasury. A negative balance drains stability each day.');
  const menuBtn = button('', 'if-iconbtn', () => openMenu());
  menuBtn.innerHTML = '<span class="if-hamburger"></span>';
  menuBtn.setAttribute('aria-label', 'Campaign menu');
  withTip(menuBtn, 'Campaign menu (Esc)');
  headright.append(treasuryWrap, menuBtn);
  topbar.append(countryButton, strip, headright);

  // ---------------------------------------------------------------- sidebar
  const navButtons = new Map<ScreenId, HTMLButtonElement>();
  const navBadges = new Map<ScreenId, HTMLElement>();
  for (const entry of NAV) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'if-nav';
    btn.dataset.screen = entry.id;
    btn.setAttribute('aria-label', entry.label);
    btn.append(icon(entry.icon, 'if-ico'), span('if-nav__label', entry.label));
    const badge = span('if-nav__badge');
    btn.append(badge);
    badge.style.display = 'none';
    navBadges.set(entry.id, badge);
    withTip(btn, `<span class="if-tip__title">${entry.label}</span>Open ${entry.label} <span class="if-tip__note">Hotkey ${entry.hotkey}</span>`);
    btn.addEventListener('click', () => open(entry.id));
    navButtons.set(entry.id, btn);
    sidebar.append(btn);
  }
  sidebar.append(div('if-sidebar__spacer'));

  // ---------------------------------------------------------------- bottom bar
  const bottomLeft = div('if-bottombar__left');
  const pauseBtn = document.createElement('button');
  pauseBtn.type = 'button';
  pauseBtn.className = 'if-pause';
  pauseBtn.setAttribute('aria-label', 'Pause or resume');
  pauseBtn.innerHTML = '<svg class="if-ico" aria-hidden="true"><use href="#ico-helmet"></use></svg>';
  withTip(pauseBtn, 'Pause / resume (Space)');
  pauseBtn.addEventListener('click', () => togglePause());

  const speedGroup = div('if-speed');
  const speedPips: HTMLButtonElement[] = [];
  for (let index = 1; index <= 5; index++) {
    const pip = button(String(index), 'if-speed__pip', () => {
      state.speed = index;
      syncSpeed();
    });
    pip.setAttribute('aria-label', `Game speed ${index}`);
    speedPips.push(pip);
    speedGroup.append(pip);
  }

  const clock = div('if-clock');
  const clockBody = div('if-clock__body');
  const dateEl = div('if-clock__date', state.dateLabel);
  const clockMeta = div('if-clock__meta', 'Campaign clock · paused');
  clockBody.append(dateEl, clockMeta);
  clock.append(icon('calendar', 'if-ico if-ico--lg'), clockBody);
  withTip(clock, 'The campaign advances one day per tick. Speed 1–5 controls the pace; Space pauses.');
  bottomLeft.append(pauseBtn, speedGroup, clock);

  const bottomCenter = div('if-bottombar__alerts');
  const alertsHost = div('if-alertstrip');
  bottomCenter.append(alertsHost);

  const bottomRight = div('if-bottombar__right');
  const notifyBtn = button('', 'if-notifybtn', () => openNotifications());
  const notifyCount = span('if-notifybtn__count', '0');
  notifyBtn.append(icon('scroll', 'if-ico'), notifyCount);
  notifyBtn.setAttribute('aria-label', 'Notifications');
  withTip(notifyBtn, 'National notifications');
  bottomRight.append(notifyBtn);
  bottombar.append(bottomLeft, bottomCenter, bottomRight);

  // ---------------------------------------------------------------- screen hosting
  let currentId: ScreenId = 'overview';
  let current: Screen | null = null;
  let provinceModal: ModalHandle | null = null;

  const ctx: ScreenContext = {
    state,
    content,
    map,
    open: (id) => open(id),
    rerender: () => open(currentId),
    toast: (message, kind) => toast(message, kind),
    openDiplomacy: (countryId) => {
      state.selectedCountryId = countryId;
      open('diplomacy');
    },
    openProvince: (provinceId) => showProvince(provinceId),
  };

  function selectProvince(provinceId: number): void {
    hideTipNow();
    state.selectedProvinceId = provinceId;
    map.selectProvince(provinceId);
    current?.refresh?.();
    updateHud();
  }

  function showProvince(provinceId: number): void {
    selectProvince(provinceId);
    if (provinceModal) {
      provinceModal.close();
      provinceModal = null;
    }
    if (provinceId > 0) {
      provinceModal = openProvincePanel(ctx, provinceId, () => {
        provinceModal = null;
      });
    }
    current?.refresh?.();
    updateHud();
  }

  function open(id: ScreenId): void {
    hideTipNow();
    if (provinceModal) {
      provinceModal.close();
      provinceModal = null;
    }
    if (current) {
      current.destroy?.();
      current.element.remove();
      current = null;
    }
    currentId = id;
    current = MOUNTS[id](ctx);
    stage.append(current.element);
    for (const [navId, btn] of navButtons) btn.classList.toggle('is-active', navId === id);
    updateAlerts();
    updateHud();
  }

  function syncSpeed(): void {
    speedPips.forEach((pip, index) => pip.classList.toggle('is-active', index + 1 === state.speed));
    clockMeta.textContent = state.paused ? 'Campaign clock · paused' : `Campaign clock · speed ${state.speed}`;
    pauseBtn.querySelector('use')?.setAttribute('href', state.paused ? '#ico-thunder' : '#ico-helmet');
  }

  function togglePause(): void {
    state.togglePause();
    syncSpeed();
  }

  // ---------------------------------------------------------------- HUD updates
  function updateHud(): void {
    statRefs.get('pp')!.textContent = fmt(state.politicalPower);
    statRefs.get('stability')!.textContent = pct(state.stability);
    statRefs.get('war')!.textContent = pct(state.warSupport);
    statRefs.get('manpower')!.textContent = compact(state.manpower);
    statRefs.get('industry')!.textContent = fmt(state.industrialCapacity);
    treasuryValue.textContent = `${fmt(state.treasury)} M`;
    dateEl.textContent = state.dateLabel;
    syncSpeed();
    notifyCount.textContent = String(state.unread);
    notifyCount.classList.toggle('is-zero', state.unread === 0);
    updateAlerts();
  }

  function updateAlerts(): void {
    const alerts = state.alerts();
    alertsHost.replaceChildren();
    if (alerts.length === 0) {
      alertsHost.append(span('if-bottombar__status', 'No outstanding alerts'));
    } else {
      for (const alert of alerts.slice(0, 2)) {
        const btn = button('', `if-alertchip if-alertchip--${alert.kind}`, () => open(alert.screen as ScreenId));
        btn.append(icon(alert.kind === 'bad' ? 'target' : alert.kind === 'warn' ? 'thunder' : 'scroll', 'if-ico'), span('', alert.text));
        alertsHost.append(btn);
      }
      if (alerts.length > 2) alertsHost.append(span('if-bottombar__status', `+${alerts.length - 2} more`));
    }
    const flagged: ScreenId[] = [];
    for (const alert of alerts) flagged.push(alert.screen as ScreenId);
    for (const [id, badge] of navBadges) badge.style.display = flagged.includes(id) ? '' : 'none';
  }

  // ---------------------------------------------------------------- notifications
  function openNotifications(): void {
    state.markNotificationsRead();
    updateHud();
    const list = div('if-notiflist');
    if (state.notifications.length === 0) {
      list.append(div('if-hint', 'No notifications yet.'));
    }
    for (const entry of state.notifications.slice(0, 40)) {
      const row = div(`if-notifitem if-notifitem--${entry.kind}`);
      const head = div('if-notifitem__head');
      head.append(span('if-notifitem__title', entry.title), span('if-notifitem__date', entry.date));
      row.append(head, div('if-notifitem__text', entry.text));
      if (entry.screen) {
        const link = button('Open', 'if-btn if-btn--sm if-btn--ghost', () => {
          handle.close();
          open(entry.screen as ScreenId);
        });
        row.append(link);
      }
      list.append(row);
    }
    const handle = modal({
      title: 'Notifications',
      subtitle: `${state.notifications.length} dispatches`,
      iconName: 'scroll',
      body: list,
      width: 620,
      actions: [{ label: 'Close', className: 'if-btn--ghost' }],
    });
  }

  // ---------------------------------------------------------------- event modal
  let eventOpen = false;

  function showPendingEvent(): void {
    const event = state.pendingEvent;
    if (!event || eventOpen) return;
    if (provinceModal) {
      provinceModal.close();
      provinceModal = null;
    }
    eventOpen = true;
    if (getSettings().autoPauseEvents) state.paused = true;
    syncSpeed();
    const body = div('if-eventbody');
    body.append(div('if-eventbody__category', event.category), div('if-eventbody__text', event.body));
    const options = div('if-eventoptions');
    const handle = modal({
      title: event.title,
      subtitle: state.longDateLabel,
      iconName: 'scroll',
      body,
      width: 700,
      actions: [],
      onClose: () => {
        eventOpen = false;
        if (state.pendingEvent) window.setTimeout(showPendingEvent, 60);
      },
    });
    event.options.forEach((option, index) => {
      const btn = button('', 'if-eventoption', () => {
        state.resolveEvent(index);
        handle.close();
        toast(`${event.title}: ${option.label}`, 'good');
        open(currentId);
        updateHud();
      });
      const label = span('if-eventoption__label', option.label);
      btn.append(label);
      if (option.detail) btn.append(span('if-eventoption__detail', option.detail));
      options.append(btn);
    });
    body.append(options);
  }

  // ---------------------------------------------------------------- campaign menu
  function openMenu(): void {
    const body = div('');
    body.append(div('if-hint', 'Campaign controls and keyboard shortcuts.'));
    const shortcuts = div('if-shortcuts');
    for (const entry of NAV) {
      const row = div('if-kv');
      row.append(span('if-kv__label', entry.label), span('if-kv__value', entry.hotkey));
      shortcuts.append(row);
    }
    const extras = div('if-shortcuts');
    for (const [label, key] of [
      ['Pause / resume', 'Space'],
      ['Speed up / down', '+ / −'],
      ['Close panels', 'Esc'],
    ] as const) {
      const row = div('if-kv');
      row.append(span('if-kv__label', label), span('if-kv__value', key));
      extras.append(row);
    }
    body.append(div('if-sectionlabel', span('if-sectionlabel__text', 'Screens')), shortcuts);
    body.append(div('if-sectionlabel', span('if-sectionlabel__text', 'Controls')), extras);
    modal({
      title: 'Campaign Menu',
      subtitle: `${content.def.name} · ${state.dateLabel}`,
      iconName: 'gov',
      body,
      width: 540,
      actions: [
        { label: 'Resume', className: 'if-btn--gold' },
        {
          label: 'Save campaign',
          className: 'if-btn--ghost',
          onClick: () => {
            const saved = state.saveGame();
            toast(saved ? 'Campaign saved to this browser.' : 'The campaign could not be saved.', saved ? 'good' : 'bad');
          },
        },
        {
          label: 'Load campaign',
          className: 'if-btn--ghost',
          onClick: () => {
            const loaded = state.loadGame();
            if (loaded) {
              open(currentId);
              updateHud();
              toast('Campaign loaded. Political history restored.', 'good');
            } else {
              toast('No compatible save was found.', 'bad');
            }
          },
        },
        {
          label: 'Return to title',
          className: 'if-btn--danger',
          onClick: () => window.location.reload(),
        },
      ],
    });
  }

  // ---------------------------------------------------------------- clock & keys
  let lastFrame = performance.now();
  let lastRefresh = 0;
  let accumulator = 0;
  let frameHandle = 0;

  function frame(now: number): void {
    const dt = Math.min(0.3, (now - lastFrame) / 1000);
    lastFrame = now;
    if (!state.paused && !state.pendingEvent) {
      accumulator += dt * SPEEDS[state.speed];
      const whole = Math.floor(accumulator);
      if (whole > 0) {
        accumulator -= whole;
        state.advance(whole);
      }
    }
    if (state.pendingEvent && !eventOpen) showPendingEvent();
    if (now - lastRefresh > 240) {
      lastRefresh = now;
      updateHud();
      current?.refresh?.();
    }
    frameHandle = requestAnimationFrame(frame);
  }
  frameHandle = requestAnimationFrame(frame);

  function onKey(event: KeyboardEvent): void {
    if (isTextField(event.target) || document.querySelector('.if-modal-backdrop')) return;
    const navEntry = NAV.find((entry) => entry.hotkey.toLowerCase() === event.key.toLowerCase());
    if (navEntry) {
      open(navEntry.id);
      event.preventDefault();
      return;
    }
    if (event.key === ' ') {
      togglePause();
      event.preventDefault();
    } else if (event.key === '+' || event.key === '=') {
      state.speed = Math.min(5, state.speed + 1);
      syncSpeed();
      event.preventDefault();
    } else if (event.key === '-') {
      state.speed = Math.max(1, state.speed - 1);
      syncSpeed();
      event.preventDefault();
    } else if (event.key === 'Escape') {
      openMenu();
      event.preventDefault();
    }
  }
  window.addEventListener('keydown', onKey);

  open('overview');
  updateHud();
  syncSpeed();
  if (state.pendingEvent) showPendingEvent();

  return {
    element: root,
    open,
    selectProvince,
    showProvince,
    refresh: () => {
      updateHud();
      current?.refresh?.();
    },
    currentScreen: () => currentId,
    dispose: () => {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(frameHandle);
      provinceModal?.close();
      current?.destroy?.();
      root.remove();
    },
  };
}

export type { ScreenId };
