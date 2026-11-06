import type { Country, World } from '../sim/world';
import './menu.css';

// Start menu: title screen, then a country picker over the live map. It only talks to the game
// through its handlers: `onSelect` when a country is picked (the map zooms to it) and `onStart`
// when the player commits to it.

const SEA = 0;

interface CountryInfo {
  provinces: number;
  states: Set<number>;
  neighbours: Set<number>;
}

export interface StartMenuHandlers {
  /** A country was picked in the list or on the map (before the game starts). */
  onSelect(countryId: number): void;
  /** The player pressed Play. The menu has already closed itself. */
  onStart(countryId: number): void;
}

export interface StartMenu {
  /**
   * Called from the map click handler. Returns true when the menu is open, so the click never falls
   * through to province selection behind the menu; while picking, it also selects the clicked country.
   */
  handleMapClick(owner: number): boolean;
  close(): void;
}

/** Full-screen "loading the 1936 map" cover. Returns a function that removes it. */
export function showLoadingScreen(): () => void {
  const cover = document.createElement('div');
  cover.className = 'if-loading';
  const title = document.createElement('div');
  title.className = 'if-loading-title';
  title.textContent = 'Iron Frontiers';
  const note = document.createElement('div');
  note.textContent = 'Loading the 1936 map…';
  cover.append(title, note);
  document.body.appendChild(cover);
  return () => cover.remove();
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Province/state counts and land neighbours per country, computed once from the map data. */
function collectCountries(world: World): Map<number, CountryInfo> {
  const info = new Map<number, CountryInfo>();
  const infoOf = (id: number): CountryInfo => {
    let entry = info.get(id);
    if (!entry) {
      entry = { provinces: 0, states: new Set(), neighbours: new Set() };
      info.set(id, entry);
    }
    return entry;
  };

  for (const province of world.provinces) {
    if (province.id === SEA || province.owner === SEA) continue;
    const entry = infoOf(province.owner);
    entry.provinces += 1;
    entry.states.add(province.state);
    for (const neighbourId of province.neighbors) {
      const owner = world.provinces[neighbourId]?.owner ?? SEA;
      if (owner !== SEA && owner !== province.owner) entry.neighbours.add(owner);
    }
  }

  return info;
}

export function createStartMenu(world: World, handlers: StartMenuHandlers): StartMenu {
  const info = collectCountries(world);
  const playable: Country[] = world.countries
    .filter((country) => country.id !== SEA && (info.get(country.id)?.provinces ?? 0) > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const root = document.createElement('div');
  root.className = 'if-menu';
  document.body.appendChild(root);

  let mode: 'main' | 'pick' | 'closed' = 'main';
  let selected = SEA;
  let query = '';

  // Rebuilt every time the picker is shown; null while the title screen is up.
  let listEl: HTMLDivElement | null = null;
  let playBtn: HTMLButtonElement | null = null;
  let swatchEl: HTMLSpanElement | null = null;
  let titleEl: HTMLSpanElement | null = null;
  let metaEl: HTMLDivElement | null = null;

  const nameOf = (id: number) => world.countries[id]?.name ?? `Country #${id}`;
  const colorOf = (id: number) => `rgb(${world.countries[id].color.join(', ')})`;

  function summaryOf(id: number): string {
    const entry = info.get(id);
    const country = world.countries[id];
    if (!entry || !country) return '';

    const parts = [count(entry.provinces, 'province', 'provinces'), count(entry.states.size, 'state', 'states')];
    if (country.overlord !== null) parts.push(`subject of: ${nameOf(country.overlord)}`);

    const neighbours = [...entry.neighbours].map(nameOf).sort((a, b) => a.localeCompare(b));
    if (neighbours.length === 0) {
      parts.push('no land neighbours');
    } else {
      const shown = neighbours.slice(0, 6).join(', ');
      parts.push(`neighbours: ${shown}${neighbours.length > 6 ? ', …' : ''}`);
    }
    return parts.join(' · ');
  }

  function fillList() {
    if (!listEl) return;
    const needle = query.trim().toLowerCase();
    const rows = playable.filter((country) => needle === '' || country.name.toLowerCase().includes(needle));
    listEl.replaceChildren();

    for (const country of rows) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'if-row';
      row.dataset.id = String(country.id);
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(country.id === selected));
      if (country.id === selected) row.classList.add('is-selected');

      const swatch = document.createElement('span');
      swatch.className = 'if-swatch';
      swatch.style.background = colorOf(country.id);

      const name = document.createElement('span');
      name.className = 'if-name';
      name.textContent = country.name;

      const countEl = document.createElement('span');
      countEl.className = 'if-count';
      countEl.textContent = String(info.get(country.id)?.provinces ?? 0);

      row.append(swatch, name, countEl);
      row.addEventListener('click', () => select(country.id));
      listEl.append(row);
    }

    if (rows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'if-empty';
      empty.textContent = 'No countries match your search.';
      listEl.append(empty);
    }
  }

  function select(id: number) {
    if (!world.countries[id] || (info.get(id)?.provinces ?? 0) === 0) return;
    const changed = id !== selected;
    selected = id;

    if (listEl) {
      for (const row of listEl.querySelectorAll<HTMLButtonElement>('.if-row')) {
        const isSelected = row.dataset.id === String(id);
        row.classList.toggle('is-selected', isSelected);
        row.setAttribute('aria-selected', String(isSelected));
      }
      listEl.querySelector('.if-row.is-selected')?.scrollIntoView({ block: 'nearest' });
    }

    if (swatchEl && titleEl && metaEl) {
      swatchEl.style.background = colorOf(id);
      swatchEl.style.display = '';
      titleEl.textContent = nameOf(id);
      metaEl.textContent = summaryOf(id);
    }
    if (playBtn) playBtn.disabled = false;

    // Only re-frame the map when the pick actually changes, so clicking the same country (or
    // zooming by hand) does not yank the camera back.
    if (changed) handlers.onSelect(id);
  }

  function renderMain() {
    listEl = null;
    playBtn = null;
    swatchEl = null;
    titleEl = null;
    metaEl = null;
    mode = 'main';

    root.innerHTML = `
      <div class="if-dim"></div>
      <div class="if-main">
        <div class="if-panel">
          <h1>Iron Frontiers</h1>
          <div class="if-sub">1936 · the world on the brink of war</div>
          <button class="if-btn if-btn-primary" data-act="new" type="button">New game</button>
          <button class="if-btn" type="button" disabled>Load game</button>
          <div class="if-hint">${count(playable.length, 'country', 'countries')} · ${count(world.provinces.length - 1, 'province', 'provinces')}</div>
        </div>
      </div>`;
    root.querySelector<HTMLButtonElement>('[data-act="new"]')!.addEventListener('click', renderPick);
  }

  function renderPick() {
    mode = 'pick';
    selected = SEA;
    query = '';

    root.innerHTML = `
      <div class="if-pick">
        <div class="if-pick-head">
          <h2>Choose a country</h2>
          <input class="if-search" type="search" placeholder="Search for a country…" autocomplete="off" spellcheck="false">
        </div>
        <div class="if-list" role="listbox" aria-label="Countries"></div>
      </div>
      <div class="if-bottom">
        <div class="if-sel">
          <div class="if-sel-name"><span class="if-swatch" style="display: none"></span><span class="if-sel-title">Select a country</span></div>
          <div class="if-sel-meta">Click a country in the list or on the map.</div>
        </div>
        <div class="if-actions">
          <button class="if-btn" data-act="back" type="button">Back</button>
          <button class="if-btn if-btn-primary" data-act="play" type="button" disabled>Play</button>
        </div>
      </div>`;

    listEl = root.querySelector<HTMLDivElement>('.if-list');
    playBtn = root.querySelector<HTMLButtonElement>('[data-act="play"]');
    swatchEl = root.querySelector<HTMLSpanElement>('.if-sel-name .if-swatch');
    titleEl = root.querySelector<HTMLSpanElement>('.if-sel-title');
    metaEl = root.querySelector<HTMLDivElement>('.if-sel-meta');

    const search = root.querySelector<HTMLInputElement>('.if-search')!;
    search.addEventListener('input', () => {
      query = search.value;
      fillList();
    });

    playBtn!.addEventListener('click', play);
    root.querySelector<HTMLButtonElement>('[data-act="back"]')!.addEventListener('click', renderMain);

    fillList();
    search.focus();
  }

  function play() {
    if (selected === SEA) return;
    const countryId = selected;
    close();
    handlers.onStart(countryId);
  }

  function close() {
    mode = 'closed';
    window.removeEventListener('keydown', onKey);
    root.remove();
  }

  function onKey(event: KeyboardEvent) {
    if (mode !== 'pick') return;
    if (event.key === 'Escape') {
      renderMain();
    } else if (event.key === 'Enter' && selected !== SEA) {
      play();
    }
  }

  window.addEventListener('keydown', onKey);
  renderMain();

  return {
    handleMapClick(owner: number): boolean {
      if (mode === 'main') return true;
      if (mode === 'pick') {
        if (owner !== SEA) select(owner);
        return true;
      }
      return false;
    },
    close,
  };
}
