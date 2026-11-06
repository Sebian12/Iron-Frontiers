import { Application } from 'pixi.js';
import { loadWorld } from './data/loadWorld';
import { MapRenderer } from './render/mapRenderer';
import { createStartMenu, showLoadingScreen } from './ui/menu';
import { loadContent } from './data/loadContent';
import { GameState } from './sim/gameState';
import { runPoliticalSelfTests } from './sim/politicalTests';
import { createGameShell, type GameShell } from './ui/shell';
import { showTipAt, hideTipNow } from './ui/tooltip';
import type { MapBridge } from './ui/screen';
import './ui/theme.css';

async function start() {
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.style.background = '#183454';
  const finishLoading = showLoadingScreen();

  const world = await loadWorld();

  const app = new Application();
  await app.init({ resizeTo: window, background: '#183454', preference: 'webgl', antialias: false });
  const canvas = app.canvas as HTMLCanvasElement;
  canvas.className = 'if-canvas';
  document.body.appendChild(canvas);
  const vignette = document.createElement('div');
  vignette.className = 'if-map-vignette';
  document.body.appendChild(vignette);

  const map = new MapRenderer(world);
  app.stage.addChild(map.view);

  // Camera: the map is moved and scaled as one container and clamped to its bounds.
  const fitScale = () => Math.min(window.innerWidth / world.width, window.innerHeight / world.height);
  const HUD_LEFT = 66;
  const HUD_TOP = 50;
  const HUD_BOTTOM = 68;

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

  function countryBounds(countryId: number) {
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
    return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
  }

  function focusCountry(countryId: number, insetLeft = HUD_LEFT) {
    const bounds = countryBounds(countryId);
    if (!bounds) return;
    const viewWidth = Math.max(window.innerWidth - insetLeft, 1);
    const viewHeight = Math.max(window.innerHeight - HUD_TOP - HUD_BOTTOM, 1);
    const centerX = insetLeft + viewWidth / 2;
    const centerY = HUD_TOP + viewHeight / 2;
    const scale = Math.min(
      Math.max(
        Math.min(
          viewWidth / Math.max(bounds.maxX - bounds.minX, 1) / 1.9,
          viewHeight / Math.max(bounds.maxY - bounds.minY, 1) / 1.9,
        ),
        fitScale(),
      ),
      Math.min(3.2, fitScale() * 26),
    );
    map.view.scale.set(scale);
    map.view.position.set(
      centerX - ((bounds.minX + bounds.maxX) / 2) * scale,
      centerY - ((bounds.minY + bounds.maxY) / 2) * scale,
    );
    map.setZoom(scale);
    clampCamera();
  }

  function focusProvince(provinceId: number) {
    const province = world.provinces[provinceId];
    if (!province) return;
    const scale = Math.max(map.view.scale.x, fitScale() * 6);
    const centerX = HUD_LEFT + (window.innerWidth - HUD_LEFT) / 2;
    const centerY = HUD_TOP + (window.innerHeight - HUD_TOP - HUD_BOTTOM) / 2;
    map.view.scale.set(scale);
    map.view.position.set(centerX - province.x * scale, centerY - province.y * scale);
    map.setZoom(scale);
    clampCamera();
  }

  let shell: GameShell | null = null;
  let hoveredProvince = -1;

  const bridge: MapBridge = {
    focusCountry: (id) => focusCountry(id),
    focusProvince: (id) => focusProvince(id),
    highlightCountry: (id) => map.setHighlightCountry(id === null ? -1 : id),
    selectProvince: (id) => map.setSelected(id),
  };

  const menu = createStartMenu(world, {
    onSelect: (countryId) => {
      const panel = document.querySelector('.if-pick');
      focusCountry(countryId, panel instanceof HTMLElement ? 0 : HUD_LEFT);
    },
    onStart: (countryId) => {
      const content = loadContent(world, countryId);
      const state = new GameState(world, content, countryId);
      (window as unknown as { ironFrontiersDebug?: unknown }).ironFrontiersDebug = {
        state,
        content,
        runPoliticalSelfTests: () => runPoliticalSelfTests(world, content, countryId),
      };
      shell = createGameShell(state, content, bridge);
      document.body.appendChild(shell.element);
      map.setSelected(0);
      focusCountry(countryId);
    },
  });

  app.render();
  finishLoading();

  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      if (!shell) return;
      const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newScale = Math.min(Math.max(map.view.scale.x * factor, fitScale()), fitScale() * 40);
      const k = newScale / map.view.scale.x;
      map.view.position.set(
        event.clientX - (event.clientX - map.view.x) * k,
        event.clientY - (event.clientY - map.view.y) * k,
      );
      map.view.scale.set(newScale);
      map.setZoom(newScale);
      clampCamera();
    },
    { passive: false },
  );

  let dragging = false;
  let moved = 0;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    moved = 0;
    lastX = event.clientX;
    lastY = event.clientY;
  });

  window.addEventListener('pointermove', (event) => {
    if (event.target === canvas && shell) {
      const local = map.view.toLocal({ x: event.clientX, y: event.clientY });
      const id = map.provinceAt(local.x, local.y);
      if (id !== hoveredProvince) {
        hoveredProvince = id;
        map.setHover(id);
      }
      if (id > 0 && !dragging && shell.currentScreen() === 'overview') {
        const province = world.provinces[id];
        const owner = world.countries[province.owner];
        const provinceState = world.states[province.state];
        if (owner && owner.id !== 0) {
          showTipAt(
            `<span class="if-tip__title">${provinceState?.name ?? province.name}</span>Province #${province.id} · ${owner.name}<span class="if-tip__note">Click to select · drag to pan · wheel to zoom</span>`,
            event.clientX,
            event.clientY,
          );
        } else {
          hideTipNow();
        }
      } else {
        hideTipNow();
      }
    } else if (hoveredProvince !== -1 && !dragging) {
      hoveredProvince = -1;
      map.setHover(-1);
      hideTipNow();
    }
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    map.view.x += dx;
    map.view.y += dy;
    clampCamera();
    lastX = event.clientX;
    lastY = event.clientY;
  });

  window.addEventListener('pointerup', (event) => {
    if (!dragging) return;
    dragging = false;
    if (moved > 5) return;
    const local = map.view.toLocal({ x: event.clientX, y: event.clientY });
    const id = map.provinceAt(local.x, local.y);
    if (menu.handleMapClick(id > 0 ? world.provinces[id].owner : 0)) return;
    if (!shell) return;
    map.setSelected(id);
    shell.refresh();
  });
}

start();
