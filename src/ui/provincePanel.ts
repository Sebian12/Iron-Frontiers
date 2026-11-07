import { BUILDINGS, buildingById } from '../data/production';
import { button, div, icon, meter, modal, panel, sectionLabel, span, tag, type ModalHandle } from './components';
import { fmt } from './format';
import { flagImage } from './flags';
import type { ScreenContext } from './screen';
import { terrainDef } from '../sim/terrain';

// Province sheet. This is the click target for a map tile: it explains the land, shows what is
// already built and lets the player queue a building in this exact province. Construction is
// deliberately province-based, not a national pile of anonymous factories.

export function openProvincePanel(ctx: ScreenContext, provinceId: number, onClose?: () => void): ModalHandle {
  const { state } = ctx;
  const province = state.world.provinces[provinceId];
  const host = div('if-provincepanel');

  const handle = modal({
    title: province?.name ?? 'Province',
    subtitle: province ? `${state.world.states[province.state]?.name ?? 'Unknown state'} · province #${province.id}` : 'Province details',
    iconName: 'map',
    body: host,
    width: 790,
    actions: [{ label: 'Close', className: 'if-btn--ghost' }],
    onClose,
  });

  function render(): void {
    const current = state.world.provinces[provinceId];
    host.replaceChildren();
    if (!current) return;

    const terrain = terrainDef(current.terrain);
    const owner = state.world.countries[current.owner];
    const development = state.provinceDevelopment(provinceId);
    const slots = state.provinceBuildingSlots(provinceId);
    const used = state.provinceUsedSlots(provinceId);
    const queued = state.provinceQueuedSlots(provinceId);
    const owned = current.owner === state.countryId;

    const left = div('if-provincepanel__col');
    const right = div('if-provincepanel__col');
    host.append(left, right);

    const overview = panel('Land & Capacity', terrain.icon);
    const head = div('if-provincepanel__head');
    const iconBox = div('if-provincepanel__terrainicon');
    iconBox.innerHTML = icon(terrain.icon, 'if-ico if-ico--xl').outerHTML;
    const title = div('');
    title.append(
      div('if-provincepanel__terrain', terrain.name),
      div('if-provincepanel__terrainhint', terrain.description),
    );
    head.append(iconBox, title);
    overview.body.append(head);

    const ownerRow = div('if-provincepanel__owner');
    if (owner && owner.id > 0) ownerRow.append(flagImage(owner, 'if-flagmini'));
    ownerRow.append(span('', owner && owner.id > 0 ? owner.name : 'Open sea'));
    overview.body.append(ownerRow);

    overview.body.append(
      div('if-kv', span('if-kv__label', 'Building slots'), span('if-kv__value', `${used} / ${slots}`)),
      div('if-kv', span('if-kv__label', 'Coast'), span('if-kv__value', current.coastal ? 'Coastal' : 'Landlocked')),
      div('if-kv', span('if-kv__label', 'Queued orders'), span('if-kv__value', String(queued))),
      div('if-kv', span('if-kv__label', 'Infrastructure'), span('if-kv__value', `${development.infrastructure} / 5`)),
      div('if-kv', span('if-kv__label', 'Construction cost'), span('if-kv__value', `×${terrain.buildCost.toFixed(2)}`)),
    );

    const slotMeter = meter(slots > 0 ? (used + queued) / slots : 0, used + queued >= slots ? 'red' : 'gold');
    overview.body.append(slotMeter);

    const terrainMods = div('if-terrainmods');
    const modifier = (label: string, value: number, suffix = '%') => {
      const tone = value > 0 ? 'green' : value < 0 ? 'red' : 'grey';
      terrainMods.append(tag(`${label} ${value > 0 ? '+' : ''}${value}${suffix}`, tone));
    };
    modifier('Defence', terrain.defence);
    modifier('Attack', terrain.attack);
    modifier('Supply', terrain.supply);
    overview.body.append(sectionLabel('Terrain modifiers'), terrainMods);
    overview.body.append(div('if-hint', 'The defence and attack values apply to a division stationed here. Construction cost and slots are enforced by the province.'));

    const actions = div('if-row if-row--wrap');
    actions.style.marginTop = '10px';
    actions.append(
      button('Centre map', 'if-btn if-btn--sm if-btn--ghost', () => ctx.map.focusProvince(provinceId)),
    );
    if (owned) {
      actions.append(button('Open economy', 'if-btn if-btn--sm if-btn--gold', () => ctx.open('construction')));
    }
    overview.body.append(actions);
    left.append(overview.element);

    const built = panel('What is built here', 'factory');
    let builtCount = 0;
    for (const building of BUILDINGS) {
      const count = state.provinceBuildingCount(provinceId, building.id);
      if (count <= 0) continue;
      builtCount += count;
      const row = div('if-builtrow');
      const iconBox = div('if-builtrow__icon');
      iconBox.innerHTML = icon(building.icon, 'if-ico').outerHTML;
      const body = div('');
      body.append(div('if-builtrow__name', building.name), div('if-hint', building.effect));
      row.append(iconBox, body, span('if-builtrow__count', `×${count}`));
      built.body.append(row);
    }
    if (development.infrastructure > 0) {
      const row = div('if-builtrow');
      const iconBox = div('if-builtrow__icon');
      iconBox.innerHTML = icon('crane', 'if-ico').outerHTML;
      row.append(iconBox, div('', div('if-builtrow__name', 'Infrastructure'), div('if-hint', '+1 building slot per level')), span('if-builtrow__count', `×${development.infrastructure}`));
      built.body.append(row);
      builtCount += development.infrastructure;
    }
    if (builtCount === 0) built.body.append(div('if-empty', div('if-hint', 'No buildings yet.')));
    left.append(built.element);

    const queueItems = state.construction.filter((item) => item.provinceId === provinceId);
    if (queueItems.length > 0) {
      const queue = panel('Province Queue', 'crane', { subtitle: `${queueItems.length} order${queueItems.length === 1 ? '' : 's'}` });
      for (const item of queueItems) {
        const building = buildingById(item.buildingId);
        if (!building) continue;
        const row = div('if-builtrow');
        const iconBox = div('if-builtrow__icon');
        iconBox.innerHTML = icon(building.icon, 'if-ico').outerHTML;
        const body = div('');
        body.append(div('if-builtrow__name', building.name), div('if-hint', `${state.constructionDaysLeft(item)} days · ${Math.round((item.progress / item.cost) * 100)}% complete`));
        const progress = div('if-progressline');
        const fill = span('');
        fill.style.width = `${Math.min(100, (item.progress / item.cost) * 100)}%`;
        progress.append(fill);
        body.append(progress);
        row.append(iconBox, body);
        queue.body.append(row);
      }
      left.append(queue.element);
    }

    if (!owned) {
      const foreign = panel('Foreign Territory', 'lock');
      foreign.body.append(
        div('if-hint', `This province belongs to ${owner?.name ?? 'another country'}. You can inspect it, but construction requires ownership.`),
      );
      right.append(foreign.element);
      return;
    }

    const catalogue = panel('Build in this province', 'crane', { subtitle: `${used} / ${slots} slots used` });
    const grid = div('if-buildoptions');
    for (const building of BUILDINGS) {
      const check = state.provinceCanBuild(building.id, provinceId);
      const cost = state.provinceConstructionCost(building.id, provinceId);
      const count = state.provinceBuildingCount(provinceId, building.id);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `if-buildoption${check.ok ? '' : ' is-blocked'}`;
      card.title = check.message;
      card.innerHTML = `
        <span class="if-buildoption__icon">${icon(building.icon, 'if-ico').outerHTML}</span>
        <span class="if-buildoption__body">
          <span class="if-buildoption__name">${building.name}${count > 0 ? ` <em>×${count}</em>` : ''}</span>
          <span class="if-buildoption__meta">${fmt(cost)} CIC · ${building.effect}</span>
          <span class="if-buildoption__state">${check.ok ? 'Available' : check.message}</span>
        </span>
        <span class="if-buildoption__action">${check.ok ? 'Build' : 'Blocked'}</span>`;
      card.addEventListener('click', () => {
        if (!check.ok) {
          ctx.toast(check.message, 'bad');
          return;
        }
        const result = state.addConstruction(building.id, provinceId);
        ctx.toast(result.message, result.ok ? 'good' : 'bad');
        if (result.ok) render();
      });
      grid.append(card);
    }
    catalogue.body.append(grid);
    catalogue.body.append(div('if-hint', 'Terrain sets the building cost and the base number of slots. Each infrastructure level adds one slot and speeds up further work here. Dockyards can only be built on the coast.'));
    right.append(catalogue.element);

    const tip = panel('Field note', 'scroll');
    tip.body.append(div('if-hint', 'Use the Economy screen to compare provinces, move the national queue and watch construction progress.'));
    right.append(tip.element);
  }

  render();
  return handle;
}
