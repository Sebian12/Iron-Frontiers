// Player-facing options, persisted in this browser. Every entry here is consumed somewhere in the
// game (menu/HUD scale, map hover tooltips, event auto-pause); nothing is stored just for show.

export interface GameSettings {
  /** Scale applied to the whole interface: menus, HUD, panels, dialogs, tooltips and toasts. */
  uiScale: number;
  /** Province hover tooltips on the map. */
  mapTooltips: boolean;
  /** Stop the campaign clock when a national event needs a decision. */
  autoPauseEvents: boolean;
}

export const UI_SCALE_MIN = 0.85;
export const UI_SCALE_MAX = 1.25;
export const UI_SCALE_STEP = 0.05;

const STORAGE_KEY = 'iron-frontiers-settings';

const DEFAULTS: GameSettings = {
  uiScale: 1,
  mapTooltips: true,
  autoPauseEvents: true,
};

let current: GameSettings = { ...DEFAULTS };

/** Snaps to the 5% steps offered in the menu and keeps the value inside the supported range. */
function clampScale(value: number): number {
  const snapped = Math.round(value / UI_SCALE_STEP) * UI_SCALE_STEP;
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Number(snapped.toFixed(2))));
}

function normalize(raw: Partial<GameSettings> | null | undefined): GameSettings {
  return {
    uiScale: typeof raw?.uiScale === 'number' && Number.isFinite(raw.uiScale) ? clampScale(raw.uiScale) : DEFAULTS.uiScale,
    mapTooltips: typeof raw?.mapTooltips === 'boolean' ? raw.mapTooltips : DEFAULTS.mapTooltips,
    autoPauseEvents: typeof raw?.autoPauseEvents === 'boolean' ? raw.autoPauseEvents : DEFAULTS.autoPauseEvents,
  };
}

function read(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw) as Partial<GameSettings>) : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function write(settings: GameSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be blocked (private mode, quota). The options still apply for this session.
  }
}

export function getSettings(): GameSettings {
  return current;
}

/** Pushes the CSS-driven options to the document. Safe to call before any menu or HUD exists. */
export function applySettings(): void {
  document.documentElement.style.setProperty('--if-ui-scale', String(current.uiScale));
}

export function setSetting<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void {
  const next: GameSettings = { ...current };
  next[key] = value;
  current = normalize(next);
  write(current);
  applySettings();
}

export function resetSettings(): void {
  current = { ...DEFAULTS };
  write(current);
  applySettings();
}

current = read();
applySettings();
