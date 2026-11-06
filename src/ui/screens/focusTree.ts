import type { FocusCategory } from '../../sim/content';
import { FOCUS_CATEGORIES } from '../../sim/content';
import type { FocusDef } from '../../sim/content';
import { button, div, effectList, icon, sectionLabel, span, tag, withTip } from '../components';
import { iconSvg } from '../icons';
import type { Screen, ScreenContext } from '../screen';
import { screenFrame } from '../screen';
import { days } from '../format';

// Interactive national focus tree. Nodes are absolutely positioned DOM tiles over an SVG link
// layer; pan and zoom transform the whole world, so tooltips and hit-testing stay native DOM.

const COL = 200;
const ROW = 150;
const PAD_X = 150;
const PAD_Y = 120;
const TILE = 84;

interface TreeUiState {
  x: number;
  y: number;
  scale: number;
  selectedId: string | null;
  query: string;
  categories: Set<FocusCategory>;
  fitted: boolean;
}

const uiStates = new Map<string, TreeUiState>();

function stateFor(key: string, focus?: FocusDef): TreeUiState {
  let existing = uiStates.get(key);
  if (!existing) {
    existing = {
      x: 0,
      y: 0,
      scale: 0.75,
      selectedId: focus?.id ?? null,
      query: '',
      categories: new Set(FOCUS_CATEGORIES.map((entry) => entry.id)),
      fitted: false,
    };
    uiStates.set(key, existing);
  }
  return existing;
}

const STATUS_LABEL: Record<string, string> = {
  completed: 'Completed',
  active: 'In progress',
  available: 'Available',
  locked: 'Locked',
  exclusive: 'Unavailable',
};

export function mountFocusTree(ctx: ScreenContext): Screen {
  const { state, content } = ctx;
  const tree = content.tree;
  const ui = stateFor(state.country.tag, tree.focuses.find((focus) => focus.id === state.focus?.id) ?? tree.focuses.find((focus) => state.focusState(focus.id) === 'available'));

  const positionOf = (focus: FocusDef) => ({ px: PAD_X + focus.x * COL, py: PAD_Y + focus.y * ROW });
  const treeWidth = () => PAD_X * 2 + Math.max(...tree.focuses.map((focus) => focus.x)) * COL;
  const treeHeight = () => PAD_Y * 2 + Math.max(...tree.focuses.map((focus) => focus.y)) * ROW;

  const completedCount = tree.focuses.filter((focus) => state.completedFocuses.has(focus.id)).length;

  const progressBadge = span('if-tag if-tag--gold', `${completedCount} / ${tree.focuses.length} completed`);
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search focuses…';
  searchInput.value = ui.query;
  searchInput.setAttribute('aria-label', 'Search national focuses');
  const searchBox = div('if-searchbox');
  searchBox.append(icon('eye', 'if-ico'), searchInput);
  const filterBar = div('if-filterbar');

  const frame = screenFrame('star', 'National Focus', `${tree.country} · national focus programme`, [progressBadge], 'if-screen__body--flush');
  const toolbar = div('if-treebar');
  toolbar.append(searchBox, filterBar);
  frame.element.insertBefore(toolbar, frame.body);

  const layout = div('if-focus-layout');
  const main = div('if-focus-main');
  main.tabIndex = 0;
  main.setAttribute('aria-label', 'National focus tree canvas');
  const world = div('if-focus-world');
  world.style.width = `${treeWidth()}px`;
  world.style.height = `${treeHeight()}px`;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'if-focus-links');
  svg.setAttribute('width', String(treeWidth()));
  svg.setAttribute('height', String(treeHeight()));
  const nodeLayer = div('');
  world.append(svg, nodeLayer);
  main.append(world);

  const zoomCtl = div('if-zoomctl');
  zoomCtl.append(
    button('+', 'if-iconbtn', () => zoomBy(1.18)),
    button('−', 'if-iconbtn', () => zoomBy(1 / 1.18)),
    button('□', 'if-iconbtn', () => fit()),
  );
  zoomCtl.children[0].setAttribute('aria-label', 'Zoom in');
  zoomCtl.children[1].setAttribute('aria-label', 'Zoom out');
  zoomCtl.children[2].setAttribute('aria-label', 'Fit tree');

  const legend = div('if-treelegend');
  for (const [label, color] of [
    ['Available', '#c5a46a'],
    ['In progress', '#e7d3a3'],
    ['Completed', '#6f9b63'],
    ['Locked', '#4a525c'],
    ['Unavailable', '#7a463d'],
  ] as const) {
    const row = span('');
    const box = span('if-swatchbox');
    box.style.background = color;
    row.append(box, document.createTextNode(label));
    legend.append(row);
  }
  main.append(zoomCtl, legend);
  layout.append(main);

  // ---------------------------------------------------------------- details panel
  const details = div('if-focus-details');
  const detailsHead = div('if-focus-details__head');
  const detailsBody = div('if-focus-details__body');
  const detailsFoot = div('if-focus-details__foot');
  details.append(detailsHead, detailsBody, detailsFoot);
  layout.append(details);
  frame.body.append(layout);

  const nodeElements = new Map<string, HTMLButtonElement>();
  const linkElements = new Map<string, SVGPathElement>();

  // ---------------------------------------------------------------- category chips
  const chips = new Map<FocusCategory, HTMLButtonElement>();
  for (const category of FOCUS_CATEGORIES) {
    const chip = button('', 'if-filterchip', () => {
      if (ui.categories.has(category.id)) {
        if (ui.categories.size === 1) return;
        ui.categories.delete(category.id);
      } else {
        ui.categories.add(category.id);
      }
      syncFilters();
    });
    chip.append(icon(category.icon, 'if-ico'), document.createTextNode(category.name));
    chips.set(category.id, chip);
    filterBar.append(chip);
  }

  function syncFilters(): void {
    for (const [id, chip] of chips) chip.classList.toggle('is-on', ui.categories.has(id));
    for (const focus of tree.focuses) {
      const element = nodeElements.get(focus.id);
      if (!element) continue;
      const needle = ui.query.trim().toLowerCase();
      const matchesQuery = needle === '' || `${focus.name} ${focus.description}`.toLowerCase().includes(needle);
      const matchesCategory = ui.categories.has(focus.category);
      element.classList.toggle('is-dimmed', !matchesQuery || !matchesCategory);
    }
    for (const focus of tree.focuses) {
      const path = linkElements.get(focus.id);
      if (!path) continue;
      const parentVisible = (focus.prerequisites ?? []).some((id) => {
        const parent = tree.focuses.find((entry) => entry.id === id);
        return parent ? ui.categories.has(parent.category) : false;
      });
      path.style.display = parentVisible && ui.categories.has(focus.category) ? '' : 'none';
    }
  }

  searchInput.addEventListener('input', () => {
    ui.query = searchInput.value;
    syncFilters();
  });
  searchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const needle = ui.query.trim().toLowerCase();
    if (!needle) return;
    const match = tree.focuses.find((focus) => focus.name.toLowerCase().includes(needle));
    if (match) {
      selectFocus(match.id);
      centerOn(positionOf(match).px, positionOf(match).py);
    }
  });

  // ---------------------------------------------------------------- links
  function linkPath(parent: FocusDef, child: FocusDef): string {
    const from = positionOf(parent);
    const to = positionOf(child);
    const x1 = from.px;
    const y1 = from.py + TILE + 22;
    const x2 = to.px;
    const y2 = to.py - 4;
    const bend = Math.max(30, Math.abs(y2 - y1) * 0.45);
    return `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`;
}
  for (const focus of tree.focuses) {
    for (const parentId of focus.prerequisites ?? []) {
      const parent = tree.focuses.find((entry) => entry.id === parentId);
      if (!parent) continue;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', linkPath(parent, focus));
      path.setAttribute('class', 'if-link');
      path.dataset.focus = focus.id;
      svg.append(path);
      linkElements.set(focus.id, path);
    }
  }

  // ---------------------------------------------------------------- nodes
  function tooltipFor(focus: FocusDef): string {
    const status = state.focusState(focus.id);
    const effects = focus.effects.slice(0, 3).map((effect) => `• ${effect.text}`).join('<br>');
    return `<span class="if-tip__title">${focus.name}</span>${focus.description}<span class="if-tip__note">${STATUS_LABEL[status]} · ${days(focus.days)}${focus.cost ? ` · ${focus.cost} PP` : ''}<br>${effects}</span>`;
  }

  for (const focus of tree.focuses) {
    const { px, py } = positionOf(focus);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `if-focus-node is-${state.focusState(focus.id)}${ui.selectedId === focus.id ? ' is-selected' : ''}`;
    button.style.left = `${px}px`;
    button.style.top = `${py}px`;
    button.dataset.focus = focus.id;
    const status = state.focusState(focus.id);
    const tile = document.createElement('span');
    tile.className = 'if-focus-node__tile';
    tile.innerHTML = `${iconSvg(focus.icon)}${status === 'completed' ? '<span class="if-focus-node__badge">✓</span>' : status === 'exclusive' ? '<span class="if-focus-node__badge">✕</span>' : ''}<span class="if-focus-node__days">${focus.days}d</span>`;
    if (status === 'active') {
      const progress = document.createElement('span');
      progress.className = 'if-focus-node__progress';
      const fill = document.createElement('span');
      fill.style.width = `${state.focusProgress() * 100}%`;
      progress.append(fill);
      tile.append(progress);
    }
    const name = document.createElement('span');
    name.className = 'if-focus-node__name';
    name.textContent = focus.name;
    button.append(tile, name);
    button.addEventListener('click', (event) => {
      if (dragged) {
        event.preventDefault();
        return;
      }
      selectFocus(focus.id);
    });
    button.addEventListener('dblclick', () => {
      if (state.canStartFocus(focus.id).ok) startSelected(focus.id);
    });
    withTip(button, () => tooltipFor(focus));
    nodeLayer.append(button);
    nodeElements.set(focus.id, button);
  }

  // ---------------------------------------------------------------- camera
  function applyTransform(): void {
    world.style.transform = `translate(${ui.x}px, ${ui.y}px) scale(${ui.scale})`;
  }

  function fit(): void {
    const width = main.clientWidth || 1000;
    const height = main.clientHeight || 700;
    const scale = Math.max(0.34, Math.min(1, Math.min((width - 60) / treeWidth(), (height - 60) / treeHeight())));
    ui.scale = scale;
    ui.x = (width - treeWidth() * scale) / 2;
    ui.y = (height - treeHeight() * scale) / 2;
    ui.fitted = true;
    applyTransform();
  }

  function centerOn(px: number, py: number): void {
    const width = main.clientWidth;
    const height = main.clientHeight;
    ui.x = width / 2 - px * ui.scale;
    ui.y = height / 2 - py * ui.scale;
    applyTransform();
  }

  function zoomBy(factor: number, cx = main.clientWidth / 2, cy = main.clientHeight / 2): void {
    const next = Math.max(0.32, Math.min(1.8, ui.scale * factor));
    const k = next / ui.scale;
    ui.x = cx - (cx - ui.x) * k;
    ui.y = cy - (cy - ui.y) * k;
    ui.scale = next;
    applyTransform();
  }

  main.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const rect = main.getBoundingClientRect();
      zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX - rect.left, event.clientY - rect.top);
    },
    { passive: false },
  );

  let dragging = false;
  let dragged = false;
  let lastX = 0;
  let lastY = 0;

  main.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    dragging = true;
    dragged = false;
    lastX = event.clientX;
    lastY = event.clientY;
    main.classList.add('is-panning');
    main.setPointerCapture(event.pointerId);
  });
  main.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true;
    ui.x += dx;
    ui.y += dy;
    lastX = event.clientX;
    lastY = event.clientY;
    applyTransform();
  });
  main.addEventListener('pointerup', (event) => {
    dragging = false;
    main.classList.remove('is-panning');
    window.setTimeout(() => (dragged = false), 0);
    if (main.hasPointerCapture(event.pointerId)) main.releasePointerCapture(event.pointerId);
  });
  main.addEventListener('pointercancel', () => {
    dragging = false;
    main.classList.remove('is-panning');
  });

  main.addEventListener('keydown', (event) => {
    const step = 60;
    if (event.key === '+' || event.key === '=') {
      zoomBy(1.15);
      event.preventDefault();
    } else if (event.key === '-') {
      zoomBy(1 / 1.15);
      event.preventDefault();
    } else if (event.key === 'ArrowLeft') {
      ui.x += step;
      applyTransform();
      event.preventDefault();
    } else if (event.key === 'ArrowRight') {
      ui.x -= step;
      applyTransform();
      event.preventDefault();
    } else if (event.key === 'ArrowUp') {
      ui.y += step;
      applyTransform();
      event.preventDefault();
    } else if (event.key === 'ArrowDown') {
      ui.y -= step;
      applyTransform();
      event.preventDefault();
    }
  });

  // ---------------------------------------------------------------- selection and details
  function selectFocus(id: string): void {
    ui.selectedId = id;
    for (const [nodeId, element] of nodeElements) element.classList.toggle('is-selected', nodeId === id);
    renderDetails();
  }

  function startSelected(id: string): void {
    const result = state.startFocus(id);
    ctx.toast(result.message, result.ok ? 'good' : 'bad');
    if (!result.ok) return;
    ctx.rerender();
  }

  function connectedFocuses(focus: FocusDef): FocusDef[] {
    const dependents = tree.focuses.filter((entry) => entry.prerequisites?.includes(focus.id));
    const exclusive = (focus.mutuallyExclusive ?? []).map((id) => tree.focuses.find((entry) => entry.id === id)).filter((entry): entry is FocusDef => Boolean(entry));
    return [...dependents, ...exclusive];
  }

  function renderDetails(): void {
    const focus = tree.focuses.find((entry) => entry.id === ui.selectedId) ?? null;
    detailsHead.replaceChildren();
    detailsBody.replaceChildren();
    detailsFoot.replaceChildren();
    if (!focus) {
      detailsBody.append(sectionLabel('No focus selected'), div('if-hint', 'Click a focus in the tree to review its requirements, duration and rewards.'));
      return;
    }

    const status = state.focusState(focus.id);
    const iconBox = div('if-focus-details__icon');
    iconBox.innerHTML = iconSvg(focus.icon);
    const headInfo = div('');
    const heading = document.createElement('h3');
    heading.className = 'if-focus-details__title';
    heading.textContent = focus.name;
    const meta = div('if-focus-details__meta');
    meta.append(
      tag(FOCUS_CATEGORIES.find((entry) => entry.id === focus.category)?.name ?? focus.category, 'blue'),
      tag(STATUS_LABEL[status], status === 'completed' ? 'green' : status === 'available' ? 'gold' : status === 'exclusive' ? 'red' : 'grey'),
      tag(`${focus.days} days`, 'grey'),
      focus.cost ? tag(`${focus.cost} PP`, 'gold') : tag('No PP cost', 'grey'),
    );
    headInfo.append(heading, meta);
    detailsHead.append(iconBox, headInfo);

    detailsBody.append(div('if-focus-details__desc', focus.description));
    if (focus.history) detailsBody.append(div('if-focus-details__history', focus.history));

    if ((focus.prerequisites ?? []).length > 0) {
      detailsBody.append(sectionLabel('Prerequisites'));
      const list = div('if-prereqlist');
      for (const id of focus.prerequisites ?? []) {
        const parent = tree.focuses.find((entry) => entry.id === id);
        if (!parent) continue;
        const met = state.completedFocuses.has(id);
        const row = button('', `if-prereq${met ? ' is-met' : ''}`, () => selectFocus(parent.id));
        const dot = span('if-prereq__dot');
        row.append(dot, span('', parent.name), span('if-prereq__state', met ? 'Completed' : 'Required'));
        list.append(row);
      }
      detailsBody.append(list);
    }

    if ((focus.requirements ?? []).length > 0) {
      detailsBody.append(sectionLabel('Conditions'));
      const list = div('if-prereqlist');
      for (const check of state.requirementChecks(focus.requirements)) {
        const row = div(`if-prereq${check.met ? ' is-met' : ''}`);
        row.append(span('if-prereq__dot'), span('', check.text), span('if-prereq__state', check.met ? 'Met' : 'Missing'));
        list.append(row);
      }
      detailsBody.append(list);
    }

    detailsBody.append(sectionLabel('Rewards'));
    detailsBody.append(effectList(focus.effects));

    if ((focus.consequences ?? []).length > 0) {
      detailsBody.append(sectionLabel('Possible consequences'));
      detailsBody.append(effectList(focus.consequences ?? []));
    }

    const connected = connectedFocuses(focus);
    if (connected.length > 0) {
      detailsBody.append(sectionLabel('Connected focuses'));
      const list = div('if-prereqlist');
      for (const other of connected) {
        const exclusive = (focus.mutuallyExclusive ?? []).includes(other.id);
        const row = button('', 'if-prereq', () => selectFocus(other.id));
        row.append(
          icon(exclusive ? 'swords' : 'star', 'if-ico if-ico--sm'),
          span('', `${other.name}${exclusive ? ' · mutually exclusive' : ''}`),
          span('if-prereq__state', STATUS_LABEL[state.focusState(other.id)]),
        );
        list.append(row);
      }
      detailsBody.append(list);
    }

    if (state.hiredAdvisor('political')) {
      const advisor = state.hiredAdvisor('political');
      if (advisor) detailsBody.append(div('if-hint', `Advisor: ${advisor.name} — ${advisor.bonus}.`));
    }

    // Footer action
    const check = state.canStartFocus(focus.id);
    const inProgress = state.focus?.id === focus.id;
    if (status === 'completed') {
      detailsFoot.append(div('if-hint', 'This focus is complete. Its rewards are already applied.'));
      detailsFoot.append(button('Next available focus', 'if-btn if-btn--sm if-btn--gold if-btn--block', () => {
        const next = tree.focuses.find((entry) => state.focusState(entry.id) === 'available');
        if (next) {
          selectFocus(next.id);
          centerOn(positionOf(next).px, positionOf(next).py);
        }
      }));
    } else if (inProgress) {
      const progress = state.focusProgress();
      const line = div('if-progressline');
      const fill = span('');
      fill.style.width = `${progress * 100}%`;
      line.append(fill);
      detailsFoot.append(div('if-hint', `${Math.round(progress * 100)}% · ${days(state.focusDaysLeft())} remaining`), line);
      detailsFoot.append(button('Abandon focus', 'if-btn if-btn--sm if-btn--danger if-btn--block', () => {
        state.abandonFocus();
        ctx.toast('Focus abandoned.', 'warn');
        ctx.rerender();
      }));
    } else {
      const startBtn = button(state.focus ? 'Another focus in progress' : 'Start Focus', 'if-btn if-btn--gold if-btn--block', () => startSelected(focus.id));
      startBtn.disabled = !check.ok;
      withTip(startBtn, check.ok ? `Begin ${focus.name}` : check.message);
      detailsFoot.append(startBtn);
      if (!check.ok) detailsFoot.append(div('if-hint', check.message));
      if (state.focusState(focus.id) === 'exclusive') detailsFoot.append(div('if-hint', `Blocked by ${state.focusBlockedBy(focus.id) ?? 'a mutually exclusive focus'}.`));
    }
  }

  // ---------------------------------------------------------------- live updates
  let structural = `${state.completedFocuses.size}|${state.focus?.id ?? ''}|${Math.floor(state.politicalPower / 10)}`;
  function refresh(): void {
    const next = `${state.completedFocuses.size}|${state.focus?.id ?? ''}|${Math.floor(state.politicalPower / 10)}`;
    const activeNode = state.focus ? nodeElements.get(state.focus.id) : null;
    if (activeNode) {
      const fill = activeNode.querySelector<HTMLElement>('.if-focus-node__progress > span');
      if (fill) fill.style.width = `${state.focusProgress() * 100}%`;
    }
    if (next !== structural) {
      structural = next;
      progressBadge.textContent = `${state.completedFocuses.size} / ${tree.focuses.length} completed`;
      for (const focus of tree.focuses) {
        const element = nodeElements.get(focus.id);
        if (!element) continue;
        const status = state.focusState(focus.id);
        element.className = `if-focus-node is-${status}${ui.selectedId === focus.id ? ' is-selected' : ''}${element.classList.contains('is-dimmed') ? ' is-dimmed' : ''}`;
        const badge = element.querySelector('.if-focus-node__badge');
        const tile = element.querySelector('.if-focus-node__tile');
        if (status === 'completed' && !badge) {
          const mark = span('if-focus-node__badge', '✓');
          tile?.append(mark);
        } else if (status === 'exclusive' && !badge) {
          const mark = span('if-focus-node__badge', '✕');
          tile?.append(mark);
        }
        if (status !== 'active') element.querySelector('.if-focus-node__progress')?.remove();
      }
      renderDetails();
    } else if (ui.selectedId === state.focus?.id) {
      const line = detailsFoot.querySelector<HTMLElement>('.if-progressline > span');
      if (line) line.style.width = `${state.focusProgress() * 100}%`;
      const note = detailsFoot.querySelector<HTMLElement>('.if-hint');
      if (note) note.textContent = `${Math.round(state.focusProgress() * 100)}% · ${days(state.focusDaysLeft())} remaining`;
    }
  }

  // Place the camera once the element is in the document.
  requestAnimationFrame(() => {
    if (!ui.fitted) fit();
    else applyTransform();
  });
  if (ui.selectedId) renderDetails();

  return { element: frame.element, refresh };
}
