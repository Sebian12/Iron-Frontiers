import { hash01 } from '../data/geopolitics';

// Procedural portraits: a stylised engraved bust rather than a photograph. The seed chooses the
// face shape, hair, uniform and tone, so every leader, general and advisor has a distinct portrait
// without shipping any image assets.

function pick<T>(list: T[], seed: string, salt: string): T {
  return list[Math.floor(hash01(`${seed}|${salt}`) * list.length) % list.length];
}

const SKIN = ['#c39a7b', '#b98d70', '#a97c5f', '#cfa587', '#9d7157', '#d5ab8c'];
const HAIR = ['#2c2722', '#3a2f26', '#4a3a2b', '#6a6157', '#8d8d8d', '#1f1c18'];
const UNIFORM = ['#2f3538', '#343b3a', '#3a3730', '#2b3239', '#3c3a3f'];

export function portraitSvg(seed: string, accent = '#c5a46a'): string {
  const skin = pick(SKIN, seed, 'skin');
  const hair = pick(HAIR, seed, 'hair');
  const uniform = pick(UNIFORM, seed, 'uniform');
  const style = Math.floor(hash01(`${seed}|style`) * 4);
  const side = hash01(`${seed}|side`) > 0.5 ? 1 : -1;
  const hat = style === 3;
  const brow = hair;

  const hatMarkup = hat
    ? `<path d="M24 31c0-11 10.5-18 24-18s24 7 24 18z" fill="${hair}"/>
       <path d="M21 31h54v4H21z" fill="#1b1a17"/>
       <path d="M31 35c6 6 26 6 34 0 4 6-1 12-18 12S26 42 31 35z" fill="#22211d"/>
       <path d="M48 15h4v4h-4z" fill="${accent}" opacity=".9"/>`
    : `<path d="M27 47c-2-14 7-24 21-24s23 10 21 24c-1-7-3-11-6-13-6 2-12 3-18 2-5-1-9-1-12 1-4 2-5 6-6 10z" fill="${hair}"/>`;

  return `<svg viewBox="0 0 96 120" class="if-portrait-svg" aria-hidden="true" focusable="false">
    <rect x="0" y="0" width="96" height="120" fill="#171a1d"/>
    <g opacity=".22" stroke="#f3e6c8" stroke-width=".5">
      <path d="M0 10h96M0 22h96M0 34h96M0 46h96M0 58h96M0 70h96M0 82h96M0 94h96M0 106h96"/>
    </g>
    <path d="M4 120V99c7-14 22-19 44-19s37 5 44 19v21z" fill="${uniform}"/>
    <path d="M4 120V99c7-14 22-19 44-19s37 5 44 19v21z" fill="none" stroke="${accent}" stroke-width=".7" opacity=".35"/>
    <path d="M38 79h20l-2 12-8 6-8-6z" fill="${skin}" opacity=".92"/>
    <ellipse cx="48" cy="54" rx="19" ry="24" fill="${skin}"/>
    <ellipse cx="${48 + side * 19}" cy="55" rx="3.4" ry="5.4" fill="${skin}"/>
    <ellipse cx="${48 - side * 19}" cy="55" rx="3.4" ry="5.4" fill="${skin}"/>
    ${hatMarkup}
    <path d="M37 52c2.4-2 5.4-2 7.4-.4M51.6 51.6c2-1.6 5-1.6 7.4.4" fill="none" stroke="${brow}" stroke-width="1.5" opacity=".9"/>
    <ellipse cx="40.6" cy="56" rx="2.1" ry="1.3" fill="#2a211c"/>
    <ellipse cx="55.4" cy="56" rx="2.1" ry="1.3" fill="#2a211c"/>
    <path d="M48 57v9l-2.4 1.8" fill="none" stroke="#00000055" stroke-width="1.1"/>
    <path d="M42.4 71.4c3.4 2 7.8 2 11.2 0" fill="none" stroke="#6d463a" stroke-width="1.5"/>
    <path d="M39 77l9 5-3 6-7-8zM57 77l-9 5 3 6 7-8z" fill="#1d1f21"/>
    <path d="M45.6 84h4.8l2 36h-8.8z" fill="#202324"/>
    <path d="M35 81l-5 9 4 2 6-8zM61 81l5 9-4 2-6-8z" fill="${accent}" opacity=".8"/>
    <circle cx="30" cy="92" r="2" fill="${accent}" opacity=".7"/>
    <path d="M33 96h6v1.6h-6zM28 99h11v1.6H28z" fill="${accent}" opacity=".55"/>
    <g opacity=".14" stroke="#000" stroke-width="1">
      <path d="M22 108h52M22 112h52M22 116h52"/>
    </g>
    <rect x="0" y="0" width="96" height="120" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="2"/>
  </svg>`;
}

export function createPortrait(seed: string, accent: string, className = 'if-portrait'): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = className;
  wrapper.style.setProperty('--portrait-accent', accent);
  wrapper.innerHTML = portraitSvg(seed, accent);
  return wrapper;
}
