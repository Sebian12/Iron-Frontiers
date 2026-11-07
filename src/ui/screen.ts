import type { ContentBundle } from '../sim/content';
import type { GameState } from '../sim/gameState';
import type { ToastKind } from './components';
import { div, icon, span } from './components';

// Shared contract between the game shell and every screen. Screens only receive this context; they
// never import the shell, so they can be mounted independently and stay free of navigation state.

export type ScreenId =
  | 'overview'
  | 'politics'
  | 'focus'
  | 'research'
  | 'production'
  | 'construction'
  | 'trade'
  | 'military'
  | 'diplomacy'
  | 'intelligence'
  | 'decisions'
  | 'history';

export interface MapBridge {
  /** Frames a country's provinces in the camera. */
  focusCountry(id: number): void;
  /** Frames a single province. */
  focusProvince(id: number): void;
  /** Tints all provinces of the given country, or clears the tint with null. */
  highlightCountry(id: number | null): void;
  /** Sets the province highlight in the map shader. */
  selectProvince(id: number): void;
}

export interface ScreenContext {
  state: GameState;
  content: ContentBundle;
  map: MapBridge;
  open(id: ScreenId): void;
  rerender(): void;
  toast(message: string, kind?: ToastKind): void;
  openDiplomacy(countryId: number): void;
  /** Opens the province sheet for a map province. */
  openProvince(provinceId: number): void;
}

export interface Screen {
  element: HTMLElement;
  refresh?: () => void;
  destroy?: () => void;
}

export interface ScreenFrame {
  element: HTMLDivElement;
  head: HTMLDivElement;
  body: HTMLDivElement;
  actions: HTMLDivElement;
}

/** Standard screen chassis: title strip with icon, subtitle and a right-aligned action slot. */
export function screenFrame(
  iconName: string,
  title: string,
  subtitle: string,
  actions: HTMLElement[] = [],
  bodyClass = '',
): ScreenFrame {
  const element = div('if-screen');
  const head = div('if-screen__head');
  const titleWrap = div('if-screen__title');
  titleWrap.append(icon(iconName, 'if-ico'));
  const text = div('');
  const heading = document.createElement('h2');
  heading.textContent = title;
  const small = document.createElement('small');
  small.textContent = subtitle;
  text.append(heading, small);
  titleWrap.append(text);
  head.append(titleWrap);
  const actionWrap = div('if-screen__actions');
  actionWrap.append(...actions);
  head.append(actionWrap);
  const body = div(`if-screen__body ${bodyClass}`.trim());
  element.append(head, body);
  return { element, head, body, actions: actionWrap };
}

export function rgb(color: [number, number, number]): string {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

export function flagBackground(color: [number, number, number], accent: string): string {
  return `linear-gradient(135deg, ${rgb(color)} 0 54%, ${accent} 54% 100%)`;
}

export function countryColor(state: GameState, countryId: number): string {
  const country = state.world.countries[countryId];
  return country ? rgb(country.color) : '#5b636b';
}

export function ideologyName(state: GameState, id: string): string {
  return state.content.ideologies[id]?.name ?? id;
}

export function ideologyColor(state: GameState, id: string): string {
  return state.content.ideologies[id]?.color ?? '#6d7566';
}

/** Small flag block used in lists and headers. */
export function flag(color: [number, number, number], accent: string, className = 'if-flag'): HTMLSpanElement {
  const node = span(className);
  node.style.background = flagBackground(color, accent);
  return node;
}
