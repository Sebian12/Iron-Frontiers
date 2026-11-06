import type { Effect } from '../sim/content';
import { iconSvg } from './icons';
import { bindTip } from './tooltip';
import { createPortrait } from './portrait';
import { fmt } from './format';

export type Tone = 'gold' | 'green' | 'red' | 'blue' | 'grey';

let toastHost: HTMLDivElement | null = null;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function div(className = '', ...children: (Node | string)[]): HTMLDivElement {
  const node = el('div', className);
  if (children.length) node.append(...children);
  return node;
}

export function span(className = '', text?: string): HTMLSpanElement {
  return el('span', className, text);
}

export function button(label: string, className: string, onClick: (event: MouseEvent) => void): HTMLButtonElement {
  const node = el('button', className, label);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

export function icon(name: string, className = 'if-ico'): HTMLSpanElement {
  const node = el('span', className);
  node.innerHTML = iconSvg(name);
  return node;
}

export function withTip<T extends HTMLElement>(node: T, content: string | (() => string | HTMLElement)): T {
  bindTip(node, content);
  return node;
}

export function iconButton(name: string, label: string, onClick: (event: MouseEvent) => void, className = 'if-iconbtn'): HTMLButtonElement {
  const node = el('button', className);
  node.type = 'button';
  node.setAttribute('aria-label', label);
  node.innerHTML = iconSvg(name);
  node.addEventListener('click', onClick);
  withTip(node, label);
  return node;
}

export function meter(value: number, tone: Tone = 'gold', className = ''): HTMLDivElement {
  const node = div(`if-meter ${className} if-meter--${tone}`.trim());
  const fill = div('if-meter__fill');
  fill.style.width = `${Math.max(0, Math.min(1, value)) * 100}%`;
  node.append(fill);
  return node;
}

export function meterBlock(value: number, tone: Tone, caption: string, tooltip?: string): HTMLDivElement {
  const wrapper = div('if-meterblock');
  const head = div('if-meterblock__head');
  head.append(span('if-meterblock__label', caption), span('if-meterblock__value', `${Math.round(value * 100)}%`));
  wrapper.append(head, meter(value, tone));
  if (tooltip) withTip(wrapper, tooltip);
  return wrapper;
}

export function tag(text: string, tone: Tone = 'grey'): HTMLSpanElement {
  return span(`if-tag if-tag--${tone}`, text);
}

export interface PanelOptions {
  subtitle?: string;
  actions?: HTMLElement[];
  flush?: boolean;
  className?: string;
}

export function panel(title: string, iconName: string, options: PanelOptions = {}): { element: HTMLDivElement; body: HTMLDivElement } {
  const element = div(`if-panel ${options.className ?? ''}`.trim());
  const head = div('if-panel__head');
  const titleWrap = div('if-panel__title');
  titleWrap.append(icon(iconName, 'if-ico if-ico--gold'), span('if-panel__titletext', title));
  head.append(titleWrap);
  if (options.subtitle) head.append(span('if-panel__subtitle', options.subtitle));
  if (options.actions?.length) {
    const actions = div('if-panel__actions');
    actions.append(...options.actions);
    head.append(actions);
  }
  const body = div(`if-panel__body${options.flush ? ' if-panel__body--flush' : ''}`);
  element.append(head, body);
  return { element, body };
}

export function sectionLabel(text: string, right?: string): HTMLDivElement {
  const node = div('if-sectionlabel');
  node.append(span('if-sectionlabel__text', text));
  if (right) node.append(span('if-sectionlabel__meta', right));
  return node;
}

export function kv(label: string, value: string, tooltip?: string): HTMLDivElement {
  const node = div('if-kv');
  node.append(span('if-kv__label', label), span('if-kv__value', value));
  if (tooltip) withTip(node, tooltip);
  return node;
}

export function countStat(iconName: string, value: string, label: string, tooltip: string): HTMLDivElement {
  const node = div('if-statcard');
  node.append(icon(iconName, 'if-ico if-ico--lg'), span('if-statcard__value', value), span('if-statcard__label', label));
  withTip(node, tooltip);
  return node;
}

export function effectRow(effect: Effect): HTMLDivElement {
  const tone = effect.kind ?? 'neutral';
  const node = div(`if-effect if-effect--${tone}`);
  node.append(span('if-effect__mark', tone === 'negative' ? '−' : tone === 'positive' ? '+' : '·'));
  node.append(span('if-effect__text', effect.text));
  if (effect.rates) {
    const detail = Object.entries(effect.rates)
      .filter(([, value]) => typeof value === 'number')
      .map(([key, value]) => `${key} ${(value as number) > 0 ? '+' : ''}${Math.round((value as number) * 100)}%`)
      .join(' · ');
    if (detail) withTip(node, detail);
  }
  return node;
}

export function effectList(effects: Effect[], emptyText = 'No effects recorded.'): HTMLDivElement {
  const list = div('if-effectlist');
  if (effects.length === 0) list.append(span('if-muted', emptyText));
  for (const effect of effects) list.append(effectRow(effect));
  return list;
}

export function emptyState(text: string, iconName = 'scroll'): HTMLDivElement {
  const node = div('if-empty');
  node.append(icon(iconName, 'if-ico if-ico--xl'), span('if-empty__text', text));
  return node;
}

export function portrait(seed: string, accent: string, size: 'xs' | 'sm' | 'md' | 'lg' = 'md', className = ''): HTMLDivElement {
  return createPortrait(seed, accent, `if-portrait if-portrait--${size} ${className}`.trim());
}

export interface ModalOptions {
  title: string;
  subtitle?: string;
  iconName?: string;
  body: HTMLElement;
  actions?: { label: string; className?: string; onClick?: () => void; closeAfter?: boolean }[];
  width?: number;
  onClose?: () => void;
}

export interface ModalHandle {
  close: () => void;
  element: HTMLDivElement;
}

export function modal(options: ModalOptions): ModalHandle {
  const backdrop = div('if-modal-backdrop');
  const dialog = div('if-modal');
  if (options.width) dialog.style.width = `min(${options.width}px, 94vw)`;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', options.title);

  const head = div('if-modal__head');
  const titleWrap = div('if-modal__title');
  if (options.iconName) titleWrap.append(icon(options.iconName, 'if-ico if-ico--gold'));
  titleWrap.append(span('if-modal__titletext', options.title));
  head.append(titleWrap);
  if (options.subtitle) head.append(span('if-modal__subtitle', options.subtitle));

  const closeButton = iconButton('target', 'Close', () => close(), 'if-modal__close');
  closeButton.innerHTML = '×';
  head.append(closeButton);

  const body = div('if-modal__body');
  body.append(options.body);
  dialog.append(head, body);

  if (options.actions?.length) {
    const footer = div('if-modal__actions');
    for (const action of options.actions) {
      const btn = button(action.label, `if-btn ${action.className ?? ''}`.trim(), () => {
        action.onClick?.();
        if (action.closeAfter !== false) close();
      });
      footer.append(btn);
    }
    dialog.append(footer);
  }

  backdrop.append(dialog);
  document.body.append(backdrop);

  function close(): void {
    window.removeEventListener('keydown', onKey);
    backdrop.remove();
    options.onClose?.();
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  }

  window.addEventListener('keydown', onKey);
  backdrop.addEventListener('pointerdown', (event) => {
    if (event.target === backdrop) close();
  });
  window.setTimeout(() => {
    dialog.querySelector<HTMLButtonElement>('.if-btn, .if-iconbtn')?.focus();
  }, 20);

  return { close, element: backdrop };
}

export type ToastKind = 'info' | 'good' | 'warn' | 'bad' | 'gold';

export function toast(message: string, kind: ToastKind = 'info'): void {
  if (!toastHost) {
    toastHost = div('if-toasts');
    document.body.append(toastHost);
  }
  const node = div(`if-toast if-toast--${kind}`);
  node.append(span('if-toast__mark'), span('if-toast__text', message));
  toastHost.append(node);
  window.setTimeout(() => node.classList.add('is-leaving'), 3800);
  window.setTimeout(() => node.remove(), 4400);
}

/** True while focus is inside a text field, so global hotkeys do not steal typing. */
export function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function numberStat(value: number): string {
  return fmt(Math.round(value));
}
