import type { Country } from '../sim/world';
import { flagFileName } from '../data/countryFlags';

// Bundled 1936-era flags. Every country gets the same visual treatment: a framed image with the
// old gradient as a colour-coded fallback if an asset is unavailable.
const BASE = import.meta.env.BASE_URL;

export function flagUrlForFile(file: string | undefined): string | null {
  return file ? `${BASE}flags/${file}` : null;
}

export function flagUrlForName(name: string): string {
  return `${BASE}flags/${flagFileName(name)}`;
}

export function flagImage(country: Country | string, className = 'if-flag'): HTMLSpanElement {
  const wrap = document.createElement('span');
  wrap.className = className;
  if (typeof country !== 'string') {
    wrap.style.backgroundColor = `rgb(${country.color.join(',')})`;
  }
  const src = typeof country === 'string' ? flagUrlForName(country) : flagUrlForFile(country.flag) ?? flagUrlForName(country.name);
  const img = document.createElement('img');
  img.className = 'if-flagimg__img';
  img.src = src;
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.addEventListener('error', () => img.remove());
  wrap.append(img);
  return wrap;
}
