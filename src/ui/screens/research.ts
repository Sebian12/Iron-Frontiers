import type { TechCategory, TechDef } from '../../sim/content';
import { TECH_CATEGORY_ICONS, TECH_CATEGORY_LABELS } from '../../data/events';
import { button, div, effectList, icon, panel, sectionLabel, span, tag, withTip } from '../components';
import { iconSvg } from '../icons';
import type { Screen, ScreenContext } from '../screen';
import { screenFrame } from '../screen';
import { days } from '../format';

// Research: eight technology trees, three live research slots and a details panel. Nodes and links
// are laid out from the x/y coordinates in technologies.json, so a different tech catalogue only
// needs new data.

const CATEGORIES: TechCategory[] = ['infantry', 'artillery', 'armor', 'aviation', 'naval', 'industry', 'electronics', 'doctrine'];

interface ResearchUi {
  category: TechCategory;
  selected: string | null;
}

const uiStates = new Map<string, ResearchUi>();

export function mountResearch(ctx: ScreenContext): Screen {
  const { state, content } = ctx;
  const allTechs = content.technologies;
  let ui = uiStates.get(state.country.tag);
  if (!ui) {
    ui = { category: 'infantry', selected: allTechs.find((tech) => tech.category === 'infantry')?.id ?? null };
    uiStates.set(state.country.tag, ui);
  }

  const speedBadge = span('if-tag if-tag--blue', `Research speed +${Math.round(state.researchSpeed * 100)}%`);
  const frame = screenFrame('flask', 'Research', `${state.country.name} · scientific and military development`, [speedBadge], 'if-screen__body--flush');
  const layout = div('if-research-layout');
  frame.body.append(layout);

  // ---------------------------------------------------------------- categories
  const catPanel = panel('Research Fields', 'flask', { flush: true });
  const catList = div('if-techcats');
  const catButtons = new Map<TechCategory, HTMLButtonElement>();
  for (const category of CATEGORIES) {
    const techs = allTechs.filter((tech) => tech.category === category);
    const done = techs.filter((tech) => state.completedTechs.has(tech.id)).length;
    const btn = button('', 'if-techcat', () => {
      ui!.category = category;
      if (!ui!.selected || allTechs.find((tech) => tech.id === ui!.selected)?.category !== category) {
        ui!.selected = techs[0]?.id ?? null;
      }
      syncCategory();
      renderTree();
      renderDetails();
    });
    btn.append(icon(TECH_CATEGORY_ICONS[category], 'if-ico'), document.createTextNode(TECH_CATEGORY_LABELS[category]), span('if-techcat__count', `${done}/${techs.length}`));
    catButtons.set(category, btn);
    catList.append(btn);
  }
  catPanel.body.append(catList);

  // ---------------------------------------------------------------- main tree panel
  const mainPanel = panel('Technology Tree', 'flask', { flush: true });
  mainPanel.element.classList.add('if-research-main');
  mainPanel.body.style.padding = '0';

  const slotsBar = div('if-slots');
  mainPanel.body.append(slotsBar);

  const viewport = div('if-techviewport');
  const techWorld = div('if-techworld');
  const techSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  techSvg.setAttribute('class', 'if-techlinks');
  const techLayer = div('');
  techWorld.append(techSvg, techLayer);
  viewport.append(techWorld);
  mainPanel.body.append(viewport);

  // ---------------------------------------------------------------- details panel
  const detailPanel = panel('Technology', 'book');
  detailPanel.element.classList.add('if-tech-details');
  layout.append(catPanel.element, mainPanel.element, detailPanel.element);

  let slotRefs: { fill: HTMLElement; days: HTMLElement }[] = [];
  let techNodes = new Map<string, HTMLButtonElement>();
  let techLinks = new Map<string, SVGPathElement>();
  let structural = '';

  function categoryTechs(): TechDef[] {
    return allTechs.filter((tech) => tech.category === ui!.category);
  }

  function position(tech: TechDef): { x: number; y: number } {
    return { x: 150 + tech.x * 232, y: 96 + tech.y * 116 };
  }

  function syncCategory(): void {
    for (const [category, btn] of catButtons) btn.classList.toggle('is-active', category === ui!.category);
  }

  // ---------------------------------------------------------------- slots
  function renderSlots(): void {
    slotsBar.replaceChildren();
    slotRefs = [];
    state.research.forEach((progress, index) => {
      const slot = div('if-slot');
      if (progress) {
        const tech = state.techById(progress.techId);
        slot.classList.add('is-active');
        const head = div('if-slot__head');
        head.append(icon(tech?.icon ?? 'flask', 'if-ico'), span('if-slot__name', tech?.name ?? 'Unknown project'));
        const meta = div('if-slot__meta');
        const daysLeft = span('', '');
        meta.append(span('', `Slot ${index + 1}`), daysLeft);
        const line = div('if-progressline');
        const fill = span('');
        fill.style.width = `${Math.min(100, ((progress.elapsed / (tech?.days ?? 1)) * 100))}%`;
        line.append(fill);
        const foot = div('if-row');
        foot.append(
          tag(`${Math.round(state.researchSpeed * 100)}% speed`, 'blue'),
          button('Cancel', 'if-btn if-btn--sm if-btn--ghost', () => {
            state.cancelResearch(index);
            ctx.toast('Research cancelled.', 'warn');
            renderSlots();
            renderTree();
            renderDetails();
          }),
        );
        slot.append(head, meta, line, foot);
        slotRefs.push({ fill, days: daysLeft });
      } else {
        const empty = div('if-slot__empty', `Slot ${index + 1} · idle`);
        const hint = div('if-hint', 'Select a technology and start research to occupy this slot.');
        slot.append(empty, hint);
      }
      slotsBar.append(slot);
    });
  }

  // ---------------------------------------------------------------- tree
  function renderTree(): void {
    const techs = categoryTechs();
    const maxX = Math.max(0, ...techs.map((tech) => tech.x));
    const maxY = Math.max(0, ...techs.map((tech) => tech.y));
    techWorld.style.width = `${Math.max(viewport.clientWidth, 150 + maxX * 232 + 240)}px`;
    techWorld.style.height = `${Math.max(viewport.clientHeight, 96 + maxY * 116 + 130)}px`;
    techSvg.setAttribute('width', techWorld.style.width);
    techSvg.setAttribute('height', techWorld.style.height);
    techSvg.replaceChildren();
    techLayer.replaceChildren();
    techNodes = new Map();
    techLinks = new Map();

    for (const tech of techs) {
      for (const reqId of tech.requires) {
        const parent = allTechs.find((entry) => entry.id === reqId && entry.category === tech.category);
        if (!parent) continue;
        const from = position(parent);
        const to = position(tech);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${from.x} ${from.y + 26} C ${from.x} ${from.y + 54}, ${to.x} ${to.y - 54}, ${to.x} ${to.y - 26}`);
        const techState = state.techState(tech.id);
        path.setAttribute('class', `if-link ${techState === 'completed' ? 'if-link--done' : techState === 'active' ? 'if-link--active' : techState === 'locked' ? 'if-link--dim' : ''}`);
        techSvg.append(path);
        techLinks.set(tech.id, path);
      }
    }

    for (const tech of techs) {
      const { x, y } = position(tech);
      const techState = state.techState(tech.id);
      const node = document.createElement('button');
      node.type = 'button';
      node.className = `if-tech-node is-${techState}${ui!.selected === tech.id ? ' is-selected' : ''}`;
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.innerHTML = `<span class="if-tech-node__icon">${iconSvg(tech.icon)}</span><span class="if-tech-node__body"><span class="if-tech-node__name">${tech.name}</span><span class="if-tech-node__meta">${tech.year} · ${tech.days}d${techState === 'completed' ? ' · ✓' : techState === 'active' ? ' · in progress' : ''}</span></span>`;
      node.addEventListener('click', () => {
        ui!.selected = tech.id;
        for (const [id, el] of techNodes) el.classList.toggle('is-selected', id === tech.id);
        renderDetails();
      });
      node.addEventListener('dblclick', () => {
        const result = state.startResearch(tech.id);
        if (!result.ok) {
          ctx.toast(result.message, 'bad');
          return;
        }
        ctx.toast(`${tech.name} research started.`, 'good');
        syncAll();
      });
      withTip(node, `<span class="if-tip__title">${tech.name}</span>${tech.description}<span class="if-tip__note">${tech.days} days · ${tech.bonuses.join(' · ')}</span>`);
      techLayer.append(node);
      techNodes.set(tech.id, node);
    }
    const heading = mainPanel.element.querySelector('.if-panel__titletext');
    if (heading) heading.textContent = TECH_CATEGORY_LABELS[ui!.category];
  }

  // ---------------------------------------------------------------- details
  function renderDetails(): void {
    const body = detailPanel.body;
    body.replaceChildren();
    const selected = allTechs.find((tech) => tech.id === ui!.selected);
    const heading = detailPanel.element.querySelector('.if-panel__titletext');
    if (heading) heading.textContent = selected ? selected.name : 'Technology';
    if (!selected) {
      body.append(sectionLabel('No technology selected'), div('if-hint', 'Choose a technology in the tree to review its requirements and rewards.'));
      return;
    }
    const techState = state.techState(selected.id);
    const head = div('if-focus-details__head');
    const iconBox = div('if-tech-detailicon');
    iconBox.innerHTML = iconSvg(selected.icon);
    const info = div('');
    const title = document.createElement('h3');
    title.className = 'if-focus-details__title';
    title.textContent = selected.name;
    const meta = div('if-focus-details__meta');
    meta.append(
      tag(TECH_CATEGORY_LABELS[selected.category], 'blue'),
      tag(techState === 'completed' ? 'Researched' : techState === 'active' ? 'In progress' : techState === 'available' ? 'Available' : 'Locked', techState === 'completed' ? 'green' : techState === 'active' ? 'gold' : techState === 'available' ? 'gold' : 'grey'),
      tag(`${selected.year}`, 'grey'),
    );
    info.append(title, meta);
    head.append(iconBox, info);
    body.append(head);
    body.append(div('if-focus-details__desc', selected.description));

    body.append(sectionLabel('Prerequisites'));
    if (selected.requires.length === 0) {
      body.append(div('if-hint', 'No prerequisite technologies.'));
    } else {
      const list = div('if-prereqlist');
      for (const reqId of selected.requires) {
        const parent = allTechs.find((tech) => tech.id === reqId);
        if (!parent) continue;
        const met = state.completedTechs.has(reqId);
        const row = div(`if-prereq${met ? ' is-met' : ''}`);
        row.append(span('if-prereq__dot'), span('', parent.name), span('if-prereq__state', met ? 'Researched' : 'Missing'));
        list.append(row);
      }
      body.append(list);
    }

    body.append(sectionLabel('Duration'));
    body.append(div('if-kv', span('if-kv__label', 'Research time'), span('if-kv__value', days(state.researchDaysFor(selected.id)))));
    body.append(div('if-kv', span('if-kv__label', 'Base time'), span('if-kv__value', days(selected.days))));

    body.append(sectionLabel('Bonuses'));
    const bonuses = selected.bonuses.map((text) => ({ text, kind: 'positive' as const }));
    body.append(effectList(bonuses));

    if (selected.unlocks.length > 0) {
      body.append(sectionLabel('Unlocks'));
      const chips = div('if-unlocklist');
      for (const unlock of selected.unlocks) chips.append(tag(unlock, 'gold'));
      body.append(chips);
    }

    const inProgress = state.research.find((slot) => slot?.techId === selected.id);
    if (inProgress) {
      const progress = Math.min(1, inProgress.elapsed / selected.days);
      body.append(sectionLabel('Progress'));
      const line = div('if-progressline');
      const fill = span('');
      fill.style.width = `${progress * 100}%`;
      line.append(fill);
      body.append(line, div('if-hint', `${Math.round(progress * 100)}% · ${days(state.techDaysLeft(selected.id))} of research remaining`));
    }

    const foot = div('if-focus-details__foot');
    foot.style.marginTop = 'auto';
    if (techState === 'completed') {
      foot.append(div('if-hint', 'This technology is already in service.'));
    } else if (techState === 'active') {
      foot.append(button('Cancel research', 'if-btn if-btn--sm if-btn--danger if-btn--block', () => {
        const slot = state.research.findIndex((entry) => entry?.techId === selected.id);
        if (slot >= 0) state.cancelResearch(slot);
        ctx.toast('Research cancelled.', 'warn');
        syncAll();
      }));
    } else if (techState === 'locked') {
      foot.append(div('if-hint', 'Research its prerequisites first.'), button('Start research', 'if-btn if-btn--block', () => undefined));
      (foot.lastElementChild as HTMLButtonElement).disabled = true;
    } else {
      const start = button('Start research', 'if-btn if-btn--gold if-btn--block', () => {
        const result = state.startResearch(selected.id);
        ctx.toast(result.message, result.ok ? 'good' : 'bad');
        if (result.ok) syncAll();
      });
      if (!state.research.some((slot) => slot === null)) {
        start.disabled = true;
        foot.append(start, div('if-hint', 'All research slots are occupied.'));
      } else {
        foot.append(start);
      }
    }
    body.append(foot);
  }

  function syncAll(): void {
    renderSlots();
    renderTree();
    renderDetails();
    structural = `${state.completedTechs.size}|${state.research.map((slot) => slot?.techId ?? '-').join(',')}|${state.selectedCountryId}`;
    syncCategory();
    updateCategoryCounts();
  }

  function updateCategoryCounts(): void {
    for (const category of CATEGORIES) {
      const techs = allTechs.filter((tech) => tech.category === category);
      const done = techs.filter((tech) => state.completedTechs.has(tech.id)).length;
      const counter = catButtons.get(category)?.querySelector('.if-techcat__count');
      if (counter) counter.textContent = `${done}/${techs.length}`;
    }
  }

  function refresh(): void {
    const activeSig = state.research.map((slot) => slot?.techId ?? '-').join(',');
    const next = `${state.completedTechs.size}|${activeSig}|${state.selectedCountryId}`;
    state.research.forEach((progress, index) => {
      if (!progress) return;
      const tech = state.techById(progress.techId);
      const refs = slotRefs[index];
      if (!tech || !refs) return;
      refs.fill.style.width = `${Math.min(100, (progress.elapsed / tech.days) * 100)}%`;
      refs.days.textContent = days(Math.max(0, Math.ceil(tech.days - progress.elapsed)));
    });
    if (next !== structural) {
      syncAll();
      return;
    }
    if (state.research.some((slot) => slot?.techId === ui!.selected)) {
      const progress = state.research.find((slot) => slot?.techId === ui!.selected);
      const tech = allTechs.find((entry) => entry.id === ui!.selected);
      if (progress && tech) {
        const fill = detailPanel.body.querySelector<HTMLElement>('.if-progressline > span');
        if (fill) fill.style.width = `${Math.min(100, (progress.elapsed / tech.days) * 100)}%`;
        const hint = detailPanel.body.querySelector<HTMLElement>('.if-focus-details__foot + .if-hint, .if-progressline + .if-hint');
        if (hint) hint.textContent = `${Math.round(Math.min(1, progress.elapsed / tech.days) * 100)}% · ${days(Math.max(0, Math.ceil(tech.days - progress.elapsed)))} of research remaining`;
      }
    }
  }

  syncAll();
  if (ui.selected) renderDetails();

  return { element: frame.element, refresh };
}
