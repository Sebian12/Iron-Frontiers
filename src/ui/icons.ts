// Hand-drawn glyph set for the interface. One inline SVG sprite is injected once at start-up, so
// every icon is a cheap <use> reference and inherits the current text colour.

const ICONS: Record<string, string> = {
  gov: '<path d="M3 9h18v2H3z"/><path d="M4 11h2v8H4zM9 11h2v8H9zM13 11h2v8h-2zM18 11h2v8h-2z"/><path d="M2 19h20v2H2z"/><path d="M12 2l9 5v1H3V7z"/>',
  factory: '<path d="M3 21V10l5 3V10l5 3V6l4 2v13z"/><path d="M16 2h4v4h-4z"/><path d="M6 16h2v3H6zM11 16h2v3h-2zM16 16h2v3h-2z" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".55"/>',
  swords: '<g><g transform="rotate(45 12 12)"><rect x="11" y="2" width="2" height="14"/><rect x="7" y="16" width="10" height="2"/><rect x="11" y="18" width="2" height="4"/></g><g transform="rotate(-45 12 12)"><rect x="11" y="2" width="2" height="14"/><rect x="7" y="16" width="10" height="2"/><rect x="11" y="18" width="2" height="4"/></g></g>',
  handshake: '<path d="M2 12.5l3.2-4.6 4.2 1.7L12 7.6l2.6 2 4.2-1.7L22 12.5l-4 5.5-3.2-1.4L12 19l-2.8-2.4L6 18z"/>',
  exchange: '<path d="M3 7h12.5l-3-3 1.5-1.5L20 8l-5.5 5.5L13 12l3-3H3z"/><path d="M21 17H8.5l3 3-1.5 1.5L4 16l5.5-5.5L11 12l-3 3h13z"/>',
  people: '<circle cx="12" cy="7" r="3"/><circle cx="5" cy="9" r="2.2"/><circle cx="19" cy="9" r="2.2"/><path d="M6.4 20c0-3.2 2.5-5.4 5.6-5.4s5.6 2.2 5.6 5.4z"/><path d="M1 19c0-2.5 1.7-4.2 4-4.2.9 0 1.7.2 2.3.7-.9 1-1.4 2.2-1.4 3.5zM23 19c0-2.5-1.7-4.2-4-4.2-.9 0-1.7.2-2.3.7.9 1 1.4 2.2 1.4 3.5z"/>',
  star: '<path d="M12 1.8l3 6.4 7 .9-5.1 4.8 1.3 6.9L12 17.5l-6.2 3.3 1.3-6.9L2 9.1l7-.9z"/>',
  flag: '<path d="M5 2h2v20H5z"/><path d="M8 4h11.5l-2 4 2 4H8z"/>',
  map: '<path d="M2 5.5L8 3l8 3 6-2v15l-6 2-8-3-6 2z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 3.3v14.9M16 6v14.5" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".7"/>',
  shield: '<path d="M12 2l8 3v7c0 5.1-3.4 8.8-8 10-4.6-1.2-8-4.9-8-10V5z"/><path d="M12 6v10M8 10h8" fill="none" stroke="#14161a" stroke-width="1.6" opacity=".5"/>',
  scales: '<path d="M11.2 2h1.6v19h-1.6zM7 21h10v1.6H7zM3 6h18v1.6H3z" /><path d="M4.4 6L1.5 13h5.8zM19.6 6l-2.9 7h5.8z"/><path d="M1.5 13a3 3 0 006 0zM16.5 13a3 3 0 006 0z"/>',
  torch: '<path d="M10.8 10h2.4v12h-2.4zM7 21h10v2H7z"/><path d="M12 1.5c2.8 2.4 4.4 4.7 4.4 6.9a4.4 4.4 0 01-8.8 0c0-2.2 1.6-4.5 4.4-6.9z"/>',
  hammer: '<path d="M14.3 2.4l7.2 7.2-2.6 2.6-7.2-7.2zM11.2 6.9l1.6 1.6-4 4-1.6-1.6zM8.6 11.1L2 17.7 3.9 19.6 10.5 13z"/>',
  ballot: '<rect x="3" y="8" width="18" height="13" rx="1"/><path d="M8 8V4.5h8V8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 12.5h7v2h-7z" fill="#14161a" opacity=".55"/>',
  crown: '<path d="M2 8l4.4 3.2L12 4.5l5.6 6.7L22 8v10H2z"/><path d="M2 19h20v2H2z"/>',
  rifle: '<path d="M2 13.6l6-2.3 9.4-7.4 2.8 2-3 5.2-3.3 1.2-3.3 4.2-4.1 1.2 1.2-3.2-5.2 1z"/>',
  artillery: '<circle cx="7" cy="17" r="4.4"/><path d="M9.4 15.2L19 3.4l4 3.2-9.6 11.4zM2 21.4h13v1.8H2z"/>',
  tank: '<rect x="3" y="10.5" width="18" height="7" rx="1"/><rect x="7" y="6.6" width="9" height="4.2"/><path d="M16 8.4h6v2h-6z"/><circle cx="6" cy="19.4" r="2"/><circle cx="12" cy="19.4" r="2"/><circle cx="18" cy="19.4" r="2"/>',
  fighter: '<path d="M12 1.8l2 7.2 8 4v2.2l-8-1v3.9l3.2 2.2V22L12 20.4 6.8 22v-1.7L10 18.1v-3.9l-8 1v-2.2l8-4z"/>',
  bomber: '<path d="M12 2.5l1.6 6.6 7.4 3.2v2l-7.4-.6v3.4l3 2v1.4L12 19l-4.6 1.5v-1.4l3-2v-3.4L3 14.3v-2l7.4-3.2z"/><circle cx="6.2" cy="10.4" r="1.5"/><circle cx="17.8" cy="10.4" r="1.5"/>',
  parachute: '<path d="M12 1.8C6 1.8 1.8 6 1.8 11.4h20.4C22.2 6 18 1.8 12 1.8z"/><path d="M11 11.4v7.4l-3.4 4.4h8.8L13 18.8v-7.4z"/>',
  anchor: '<circle cx="12" cy="4" r="2.6" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M11 7h2v13.4h-2z"/><path d="M6.6 10.6h10.8v1.8H6.6z"/><path d="M3.6 13.2c0 5 3.6 8 8.4 9 4.8-1 8.4-4 8.4-9l-3 1.2c0 3-2.2 5-5.4 5.8-3.2-.8-5.4-2.8-5.4-5.8z"/>',
  warship: '<path d="M2.5 15.4h19l-3.2 5H5.7zM8 8.4h9l1.4 5.4H6.6zM10.8 4h2.4v4.4h-2.4zM18 6h3.6v4.4H18z"/>',
  submarine: '<path d="M1.6 16.4c3.2-3.2 6.4-4.4 10.4-4.4h6.6l3.8 2.2-3.8 2.2H7.8l-4 2z"/><rect x="10" y="7.4" width="4.2" height="5"/><path d="M14.2 8.4h2.4v3h-2.4z"/>',
  gear: '<path d="M11 1.8h2l.4 2.4 1.7.7 2-1.4 1.4 1.4-1.4 2 .7 1.7 2.2.4v2l-2.2.4-.7 1.7 1.4 2-1.4 1.4-2-1.4-1.7.7-.4 2.4h-2l-.4-2.4-1.7-.7-2 1.4-1.4-1.4 1.4-2-.7-1.7L4 10.6v-2l2.2-.4.7-1.7-1.4-2 1.4-1.4 2 1.4 1.7-.7z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="9.6" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  crane: '<path d="M4 22V2h2.2v20zM6.2 3.4h14.4v2H6.2z"/><path d="M17.4 5.4l3.4 4.4h-4.4z"/><path d="M17.2 10h2v4.6h-2z"/><rect x="13.4" y="14.6" width="9" height="7"/><path d="M14.4 16.4h7v1.4h-7z" opacity=".4" fill="#14161a"/>',
  oil: '<path d="M12 1.6l4.6 20.4h-2.4L12 11.6 9.8 22H7.4zM5.6 21.8h12.8v1.8H5.6zM8.4 8.6h7.2v1.6H8.4zM9.4 13.4h5.2v1.6H9.4z"/>',
  rubber: '<circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="3.4"/><circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  steel: '<path d="M2.4 14.8l4.2-3.2h14.2l-4.2 3.2zM2.4 20l4.2-3.2h14.2L16.6 20zM7.6 9.6l4.2-3.2h10l-4.2 3.2z"/>',
  aluminium: '<path d="M12 2.4l9 5.2v8.8l-9 5.2-9-5.2V7.6z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 7.6l9 5.2 9-5.2M12 12.8v9.2" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".75"/>',
  tungsten: '<path d="M3.4 20.4L15.2 8.6l2.4 2.4L5.8 22.8z"/><path d="M11.6 2.4c4.4 0 8 2.2 9.4 5.4l-3.4 2.2c-1-2.2-3.4-3.6-6-3.6z"/>',
  chromium: '<path d="M8.2 2.4h7.6l4.4 6.4-8 12.8L4.2 8.8z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4.6 8.8h15M8.4 2.8L12 21.2M15.6 2.8L12 21.2" fill="none" stroke="currentColor" stroke-width="1" opacity=".7"/>',
  coin: '<circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 5.4v13.2M9 8.6c0-1.2 1.4-2 3-2s3 .8 3 2-1.4 2-3 2-3 .9-3 2 1.4 2 3 2 3-.8 3-2" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18M8 2.4v5M16 2.4v5"/><path d="M7 13h3v3H7z" opacity=".6"/>',
  radio: '<rect x="2" y="8" width="20" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="7" cy="14.4" r="2.6"/><path d="M12.6 12.2h6.6M12.6 16.2h6.6M6 5.4l12-4" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  radar: '<circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".8"/><path d="M12 12L19.4 6.4" stroke="currentColor" stroke-width="1.9"/><circle cx="12" cy="12" r="1.5"/>',
  lock: '<rect x="4" y="10" width="16" height="12" rx="1"/><path d="M8 10V6.8a4 4 0 018 0V10" fill="none" stroke="currentColor" stroke-width="2"/>',
  eye: '<path d="M1.2 12S5.4 4.8 12 4.8 22.8 12 22.8 12 18.6 19.2 12 19.2 1.2 12 1.2 12z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.2"/>',
  book: '<path d="M4 2.6h7.2v18.8H4zM12.8 2.6H20v18.8h-7.2z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M11.2 3.4v17M12.8 3.4v17" stroke="currentColor" stroke-width="1"/>',
  helmet: '<path d="M2.8 16.6C2.8 10.2 7 5.4 12 5.4s9.2 4.8 9.2 11.2v1.6H2.8zM1.6 18.4h20.8v3.2H1.6z"/>',
  medical: '<path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z"/>',
  truck: '<path d="M2 5.6h11v9H2zM13 9h5l4 4v1.6h-9z"/><circle cx="6" cy="18.4" r="2.2"/><circle cx="18" cy="18.4" r="2.2"/>',
  mountain: '<path d="M1.6 21.4L9 8.4l4 7 3-4.4 6.4 10.4zM7.6 10.4l1.4-2.6 1.4 2.6z"/>',
  tree: '<path d="M12 2L5.4 13h3.1l-4 7h15l-4-7h3.1z"/><path d="M11 18h2v4h-2z"/>',
  water: '<path d="M2 7.4c2.2 0 2.2 2 4.4 2s2.2-2 4.4-2 2.2 2 4.4 2 2.2-2 4.4-2v3c-2.2 0-2.2 2-4.4 2s-2.2-2-4.4-2-2.2 2-4.4 2-2.2-2-4.4-2zM2 14.4c2.2 0 2.2 2 4.4 2s2.2-2 4.4-2 2.2 2 4.4 2 2.2-2 4.4-2v3c-2.2 0-2.2 2-4.4 2s-2.2-2-4.4-2-2.2 2-4.4 2-2.2-2-4.4-2z"/>',
  sun: '<circle cx="12" cy="12" r="4.4"/><path d="M11 1h2v3h-2zM11 20h2v3h-2zM1 11h3v2H1zM20 11h3v2h-3zM4.2 3l2.1 2.1-1.4 1.4L2.8 4.4zM17.7 16.5l2.1 2.1-1.4 1.4-2.1-2.1zM17.7 7.5l2.1-2.1 1.4 1.4-2.1 2.1zM4.2 21l2.1-2.1 1.4 1.4-2.1 2.1z"/>',
  palm: '<path d="M11 9h2v13h-2z"/><path d="M12 9C9 9 6.6 7.4 5.4 4.8c2.9-.6 5.2.8 6.6 3.2 1.4-2.4 3.7-3.8 6.6-3.2C17.4 7.4 15 9 12 9zM12 5.2C10.4 3.8 10.4 1.8 12 .6c1.6 1.2 1.6 3.2 0 4.6z"/>',
  city: '<path d="M3 21V9h5v12zM10 21V3h5v18zM17 21V12h4v9z"/><path d="M5 12h1v2H5zM12 6h1v2h-1zM12 10h1v2h-1zM19 15h1v2h-1z" fill="#14161a" opacity=".55"/>',
  snow: '<path d="M11 2h2v20h-2zM2.6 7l1.8-1 16 10-1 1.8zM21.4 7l-1-1.8-16 10 1 1.8zM7.4 4.6l1.8.8L4.2 16l-1.8-.8zM19.8 8l-1.8.8L13 20.4l1.8.8z"/>',
  scroll: '<path d="M4 3h13v16H6.4A2.4 2.4 0 014 16.6V5z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7.4 7.4h7M7.4 11.4h7M7.4 15.4h5" stroke="currentColor" stroke-width="1.3"/><path d="M17 3h3v3h-3z"/>',
  target: '<circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="12" r="1.8"/>',
  spy: '<path d="M3.6 12.4h16.8l-1-3.2-7.4-5-7.4 5zM8.6 12.4v4.4h6.8v-4.4zM6.6 20c0-2.2 2.4-3.2 5.4-3.2s5.4 1 5.4 3.2z"/>',
  wheat: '<path d="M11 22V7.4h2V22z"/><path d="M11.6 10.4c-3.2 0-4.2-3.2-4.2-5.4 3.2 0 4.2 3.2 4.2 5.4zM12.4 10.4c3.2 0 4.2-3.2 4.2-5.4-3.2 0-4.2 3.2-4.2 5.4zM11.6 15.6c-3.2 0-4.2-3.2-4.2-5.4 3.2 0 4.2 3.2 4.2 5.4zM12.4 15.6c3.2 0 4.2-3.2 4.2-5.4-3.2 0-4.2 3.2-4.2 5.4z"/>',
  wrench: '<path d="M14.4 2a6.2 6.2 0 00-5.2 9.4L2 18.6 5.4 22l7.2-7.2A6.2 6.2 0 0022 9.2l-4 2.2-2.6-2.6z"/>',
  thunder: '<path d="M13.4 2L4 14.4h6L9 22l9.4-12.4h-6z"/>',
  medal: '<circle cx="12" cy="15.2" r="6.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7.4 2.4l4.6 7.4 4.6-7.4z"/><path d="M12 12.4l1 2 2.2.3-1.6 1.6.4 2.2-2-1-2 1 .4-2.2-1.6-1.6 2.2-.3z"/>',
  flask: '<path d="M9 2.4h6v1.8h-1v5l5.4 10.4a2.2 2.2 0 01-2 3.2H6.6a2.2 2.2 0 01-2-3.2L10 8.2v-5H9z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8.4 15.4h7.2v1.8H8.4z" opacity=".6"/>',
};

export const ICON_NAMES = Object.keys(ICONS);

let injected = false;

/** Adds the sprite to the document once. Safe to call from every module. */
export function installIcons(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sprite.setAttribute('aria-hidden', 'true');
  sprite.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  sprite.innerHTML = `<defs>${Object.entries(ICONS)
    .map(([name, body]) => `<symbol id="ico-${name}" viewBox="0 0 24 24">${body}</symbol>`)
    .join('')}</defs>`;
  document.body.appendChild(sprite);
}

export function iconSvg(name: string, className = 'if-ico'): string {
  const safe = name in ICONS ? name : 'star';
  return `<svg class="${className}" aria-hidden="true" focusable="false"><use href="#ico-${safe}"></use></svg>`;
}
