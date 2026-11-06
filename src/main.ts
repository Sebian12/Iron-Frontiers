import { Application } from 'pixi.js';
import { loadWorld } from './data/loadWorld';
import { MapRenderer } from './render/mapRenderer';
import { createStartMenu, showLoadingScreen } from './ui/menu';

async function start() {
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  // Sea color, so whatever part of the window the map does not cover looks like open ocean.
  document.body.style.background = '#183454';
  const finishLoading = showLoadingScreen();

  const world = await loadWorld();

  const app = new Application();
  await app.init({ resizeTo: window, background: '#183454', preference: 'webgl', antialias: false });
  document.body.appendChild(app.canvas);

  const map = new MapRenderer(world);
  app.stage.addChild(map.view);

  // Camera: pan and zoom by moving and scaling the map container. It is clamped to the map bounds,
  // so the map can never be dragged off screen: when it is larger than the window it always covers
  // the window, when it is smaller it stays centered.
  const fitScale = () => Math.min(window.innerWidth / world.width, window.innerHeight / world.height);

  function clampCamera() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = world.width * map.view.scale.x;
    const h = world.height * map.view.scale.y;
    map.view.x = w <= vw ? (vw - w) / 2 : Math.min(0, Math.max(vw - w, map.view.x));
    map.view.y = h <= vh ? (vh - h) / 2 : Math.min(0, Math.max(vh - h, map.view.y));
  }

  const fit = fitScale();
  map.view.scale.set(fit);
  map.setZoom(fit);
  clampCamera();
  window.addEventListener('resize', clampCamera);

  // Info panel for the selected province; it only appears once the player picked a country.
  const info = document.createElement('div');
  info.style.cssText =
    'position:fixed;left:12px;top:12px;padding:8px 12px;background:#000a;color:#fff;font:14px sans-serif;border-radius:6px;pointer-events:none;display:none';
  info.textContent = 'Click a province. Mouse wheel = zoom, drag = pan.';
  document.body.appendChild(info);

  // Small badge with the country the player controls.
  const badge = document.createElement('div');
  badge.style.cssText =
    'position:fixed;right:12px;top:12px;padding:8px 12px;background:#000a;color:#fff;font:14px sans-serif;border-radius:6px;display:none;align-items:center;gap:8px;pointer-events:none';
  const badgeSwatch = document.createElement('span');
  badgeSwatch.style.cssText = 'width:12px;height:12px;border:1px solid #0008;box-shadow:0 0 0 1px #ffffff55';
  const badgeName = document.createElement('span');
  badge.append(badgeSwatch, badgeName);
  document.body.appendChild(badge);

  /**
   * Frames the player's country: centred on its outline in the free part of the window, zoomed so it
   * fills a good part of it. `insetLeft` is the width of the menu panel covering the left side.
   */
  function focusCountry(countryId: number, insetLeft = 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const province of world.provinces) {
      if (province.owner !== countryId) continue;
      if (province.x < minX) minX = province.x;
      if (province.x > maxX) maxX = province.x;
      if (province.y < minY) minY = province.y;
      if (province.y > maxY) maxY = province.y;
    }
    if (!Number.isFinite(minX)) return;

    // Leave some room around the country, but never zoom out past the fitted view or in past 2 px/texel.
    const viewWidth = Math.max(window.innerWidth - insetLeft, 1);
    const centerX = insetLeft + viewWidth / 2;
    const padding = 1.8;
    const scale = Math.min(
      Math.max(
        Math.min(
          viewWidth / Math.max(maxX - minX, 1) / padding,
          window.innerHeight / Math.max(maxY - minY, 1) / padding,
        ),
        fitScale(),
      ),
      2,
    );
    map.view.scale.set(scale);
    map.view.position.set(
      centerX - ((minX + maxX) / 2) * scale,
      window.innerHeight / 2 - ((minY + maxY) / 2) * scale,
    );
    map.setZoom(scale);
    clampCamera();
  }

  const menu = createStartMenu(world, {
    // Picking a country zooms the map to it; the panel on the left stays out of the frame.
    onSelect: (countryId) => {
      const panel = document.querySelector('.if-pick');
      focusCountry(countryId, panel instanceof HTMLElement ? panel.getBoundingClientRect().width : 0);
    },
    onStart: (countryId) => {
      const country = world.countries[countryId];
      badgeName.textContent = `Playing as: ${country.name}`;
      badgeSwatch.style.background = `rgb(${country.color.join(', ')})`;
      badge.style.display = 'flex';
      info.style.display = '';
      focusCountry(countryId);
    },
  });

  // Draw the map once before the loading cover goes away, so the menu sits on a finished picture.
  app.render();
  finishLoading();

  const canvas = app.canvas as HTMLCanvasElement;

  // Zoom with the mouse wheel around the cursor.
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      // Zooming out stops at the fitted view, so the map always covers the window and no empty
      // margin can appear around it.
      const newScale = Math.min(Math.max(map.view.scale.x * factor, fitScale()), fitScale() * 40);
      const k = newScale / map.view.scale.x;
      map.view.position.set(
        e.clientX - (e.clientX - map.view.x) * k,
        e.clientY - (e.clientY - map.view.y) * k,
      );
      map.view.scale.set(newScale);
      map.setZoom(newScale);
      clampCamera();
    },
    { passive: false },
  );

  // Drag to pan; a short click selects a province.
  let dragging = false;
  let moved = 0;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    moved = 0;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    map.view.x += dx;
    map.view.y += dy;
    clampCamera();
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    if (moved > 4) return;
    const local = map.view.toLocal({ x: e.clientX, y: e.clientY });
    const id = map.provinceAt(local.x, local.y);
    // While the menu is open a click picks a country instead of a province.
    if (menu.handleMapClick(id > 0 ? world.provinces[id].owner : 0)) return;
    map.setSelected(id);
    if (id <= 0) {
      info.textContent = id === 0 ? 'Sea' : 'Outside the map';
      return;
    }
    const p = world.provinces[id];
    const owner = world.countries[p.owner];
    const overlord = owner.overlord !== null ? ` (subject of ${world.countries[owner.overlord].name})` : '';
    const state = world.states[p.state];
    if (owner.id === 0) {
      info.textContent = `${state.name} (sea) | sea province #${id} | neighbours: ${p.neighbors.length}`;
      return;
    }
    info.textContent = `${state.name} | province #${id} | owner: ${owner.name}${overlord} | neighbours: ${p.neighbors.length}`;
  });
}

start();