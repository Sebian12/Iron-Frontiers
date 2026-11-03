import { Application } from 'pixi.js';
import { generateWorld } from './sim/world';
import { MapRenderer } from './render/mapRenderer';

async function start() {
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.style.background = '#101820';

  const world = generateWorld(1);

  const app = new Application();
  await app.init({ resizeTo: window, background: '#101820', preference: 'webgl', antialias: false });
  document.body.appendChild(app.canvas);

  const map = new MapRenderer(world);
  app.stage.addChild(map.view);

  // Camera: We move and scale container with map
  const fit = Math.min(window.innerWidth / world.width, window.innerHeight / world.height);
  map.view.scale.set(fit);
  map.view.position.set(
    (window.innerWidth - world.width * fit) / 2,
    (window.innerHeight - world.height * fit) / 2,
  );

  // Panel with information about the selected province.
  const info = document.createElement('div');
  info.style.cssText =
    'position:fixed;left:12px;top:12px;padding:8px 12px;background:#000a;color:#fff;font:14px sans-serif;border-radius:6px;pointer-events:none';
  info.textContent = 'Click on a province. Wheel = zoom, drag = pan.';
  document.body.appendChild(info);

  const canvas = app.canvas as HTMLCanvasElement;

  // Zooming with mouse wheel, keeping the point under the cursor fixed.
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newScale = Math.min(Math.max(map.view.scale.x * factor, fit * 0.8), fit * 40);
      const k = newScale / map.view.scale.x;
      map.view.position.set(
        e.clientX - (e.clientX - map.view.x) * k,
        e.clientY - (e.clientY - map.view.y) * k,
      );
      map.view.scale.set(newScale);
    },
    { passive: false },
  );

  // Mouse move + click: dragging the map, or clicking on a province to select it.
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
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    if (moved > 4) return;
    const local = map.view.toLocal({ x: e.clientX, y: e.clientY });
    const id = map.provinceAt(local.x, local.y);
    map.setSelected(id);
    if (id < 0) {
      info.textContent = 'Outside the map';
      return;
    }
    const p = world.provinces[id];
    info.textContent = `Province #${id} | owner: ${world.countries[p.owner].name} | neighbors: ${p.neighbors.length}`;
  });
}

start();