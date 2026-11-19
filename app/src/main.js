// Vice Sunset Cover Studio — the editor.
//
// Wires the page: pick photos per panel (file picker or drag-and-drop),
// click a panel to select it, drag to pan its photo, scroll to zoom, and
// retitle / regrade / relayout / export. All drawing goes through the
// engine in cover.js; this file only owns state and input. The preview
// canvas is a fixed square on the page and the export path reuses the
// same state at full resolution, so the preview never lies about the file.
//
// State is deliberately plain data (photos are Image objects, crops are
// numbers) so a screenshot scene can rebuild it from a query string.

import { GRADES, LAYOUTS, defaultCrops, panelCount, panelRects, drawCover, exportCover, EXPORT_SIZES } from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const statusEl = $('status');
const previewSize = 720;
canvas.width = previewSize;
canvas.height = previewSize;

const state = {
  layout: 'quad',
  grade: 'sunset',
  title: 'NEON SHORE',
  subtitle: 'a vice city story',
  badge: 'VICE CITY',
  photos: [null, null, null, null],
  crops: defaultCrops('quad'),
};

let selected = 0;
let comparing = false;
let dragging = null;

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load('400 80px Anton'),
      document.fonts.load('400 40px Pacifico'),
    ]);
    await document.fonts.ready;
  } catch {
    // Anton / Pacifico are vendored, but the studio still works with the
    // fallback stacks in cover.js if a font fails to load.
  }
}

function say(message) {
  statusEl.textContent = message;
}

function redraw() {
  drawCover(canvas, state, { compare: comparing });
  renderPanelList();
  syncControls();
}

// The strip of panel buttons under the preview: one per panel of the
// current layout, showing which panel is selected and whether it has a
// photo yet. Rebuilt only when the layout, selection or photo presence
// changes — redraw also fires on every drag-pan move, and rebuilding the
// buttons there would churn the DOM for nothing.
let panelListKey = '';
function renderPanelList() {
  const count = panelCount(state.layout);
  const key = [
    state.layout,
    selected,
    ...Array.from({ length: count }, (_, i) => (state.photos[i] ? '1' : '0')),
  ].join('|');
  if (key === panelListKey) return;
  panelListKey = key;
  const list = $('panels');
  list.innerHTML = '';
  for (let i = 0; i < count; i += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `panel-chip${i === selected ? ' selected' : ''}`;
    button.textContent = state.photos[i] ? `Panel ${i + 1} · photo` : `Panel ${i + 1} · empty`;
    button.addEventListener('click', () => {
      selected = i;
      redraw();
    });
    list.appendChild(button);
  }
}

function syncControls() {
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('badge').value = state.badge;
  $('layout').value = state.layout;
  $('grade').value = state.grade;
  const crop = state.crops[selected] ?? { zoom: 1, fit: 'fill' };
  $('zoom').value = String(crop.zoom ?? 1);
  $('zoom-label').textContent = `${Math.round((crop.zoom ?? 1) * 100)}%`;
  $('fill').checked = (crop.fit ?? 'fill') === 'fill';
  $('fit').checked = (crop.fit ?? 'fill') === 'fit';
  document.querySelectorAll('#layout-list button').forEach((b) => {
    b.classList.toggle('selected', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('#grade-list button').forEach((b) => {
    b.classList.toggle('selected', b.dataset.grade === state.grade);
  });
}

function setLayout(layout) {
  if (!LAYOUTS[layout]) return;
  state.layout = layout;
  state.crops = defaultCrops(layout);
  if (selected >= panelCount(layout)) selected = 0;
  redraw();
}

function setGrade(grade) {
  if (!GRADES[grade]) return;
  state.grade = grade;
  redraw();
}

async function setPhoto(index, fileOrUrl) {
  try {
    const img = typeof fileOrUrl === 'string'
      ? await loadImage(fileOrUrl)
      : await loadImage(URL.createObjectURL(fileOrUrl));
    state.photos[index] = img;
    selected = index;
    say(`Photo loaded into panel ${index + 1}.`);
    redraw();
  } catch {
    say('That file could not be read as an image.');
  }
}

// One photo in every panel, each keeping its own crop, so a single portrait
// can fill a quad or a strip with independent framing per panel.
async function useOnePhotoEverywhere(fileOrUrl) {
  try {
    const img = typeof fileOrUrl === 'string'
      ? await loadImage(fileOrUrl)
      : await loadImage(URL.createObjectURL(fileOrUrl));
    const count = panelCount(state.layout);
    for (let i = 0; i < count; i += 1) state.photos[i] = img;
    say('Same photo in every panel — crops stay independent.');
    redraw();
  } catch {
    say('That file could not be read as an image.');
  }
}

// Pointer math: the preview canvas is displayed scaled, so translate the
// pointer into canvas pixels, find the panel under it, and pan that
// panel's photo by moving its focal point against the drag.
function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function panelAt(x, y) {
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  for (let i = rects.length - 1; i >= 0; i -= 1) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

canvas.addEventListener('pointerdown', (event) => {
  const point = canvasPoint(event);
  const hit = panelAt(point.x, point.y);
  if (hit < 0) return;
  selected = hit;
  const crop = state.crops[hit];
  dragging = { index: hit, x: point.x, y: point.y, ox: crop.ox, oy: crop.oy };
  canvas.setPointerCapture(event.pointerId);
  redraw();
});

canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const point = canvasPoint(event);
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  const rect = rects[dragging.index];
  const photo = state.photos[dragging.index];
  if (!photo || !rect) return;
  const crop = state.crops[dragging.index];
  const base = crop.fit === 'fit'
    ? Math.min(rect.w / photo.naturalWidth, rect.h / photo.naturalHeight)
    : Math.max(rect.w / photo.naturalWidth, rect.h / photo.naturalHeight);
  const s = base * (crop.zoom || 1);
  // Dragging moves the photo with the pointer; in look-up terms a
  // rightward drag raises ox (dx = rect.x - overflow * (1 - ox)).
  const overX = photo.naturalWidth * s - rect.w;
  const overY = photo.naturalHeight * s - rect.h;
  if (overX > 0) crop.ox = dragging.ox + (point.x - dragging.x) / overX;
  if (overY > 0) crop.oy = dragging.oy + (point.y - dragging.y) / overY;
  crop.ox = Math.min(1, Math.max(0, crop.ox));
  crop.oy = Math.min(1, Math.max(0, crop.oy));
  redraw();
});

canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('pointercancel', () => { dragging = null; });

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const point = canvasPoint(event);
  const hit = panelAt(point.x, point.y);
  if (hit < 0) return;
  selected = hit;
  const crop = state.crops[hit];
  const next = (crop.zoom || 1) * (event.deltaY < 0 ? 1.12 : 1 / 1.12);
  crop.zoom = Math.min(4, Math.max(0.5, next));
  redraw();
}, { passive: false });

// Drag-and-drop onto the canvas drops the photo into the panel under the
// pointer; dropping with no panel under it fills the selected panel.
canvas.addEventListener('dragover', (event) => event.preventDefault());
canvas.addEventListener('drop', (event) => {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  const point = canvasPoint(event);
  const hit = panelAt(point.x, point.y);
  setPhoto(hit >= 0 ? hit : selected, file);
});

// Shuffle re-rolls every crop: a random zoom and a random focal point, so
// one click gives a fresh framing for every panel at once.
function shuffleCrops() {
  for (const crop of state.crops) {
    crop.zoom = 1 + Math.random() * 0.9;
    crop.ox = 0.3 + Math.random() * 0.4;
    crop.oy = 0.35 + Math.random() * 0.45;
  }
  say('Crops shuffled — drag a panel to fine-tune it.');
  redraw();
}

function resetCrops() {
  state.crops = defaultCrops(state.layout);
  say('Crops reset to the default framing.');
  redraw();
}

function download(canvasEl, name) {
  canvasEl.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

async function exportAll() {
  for (const size of EXPORT_SIZES) {
    const out = exportCover(state, size.w, size.h);
    download(out, `cover-${size.w}x${size.h}.png`);
  }
  say('Exported all three sizes as PNG.');
}

function buildLayoutList() {
  const host = $('layout-list');
  for (const [key, def] of Object.entries(LAYOUTS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.layout = key;
    b.textContent = def.label;
    b.addEventListener('click', () => setLayout(key));
    host.appendChild(b);
  }
}

function buildGradeList() {
  const host = $('grade-list');
  for (const [key, def] of Object.entries(GRADES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.grade = key;
    b.textContent = def.label;
    b.addEventListener('click', () => setGrade(key));
    host.appendChild(b);
  }
}

function wireControls() {
  buildLayoutList();
  buildGradeList();
  $('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
  $('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
  $('badge').addEventListener('input', (e) => { state.badge = e.target.value; redraw(); });
  $('layout').addEventListener('change', (e) => setLayout(e.target.value));
  $('grade').addEventListener('change', (e) => setGrade(e.target.value));
  $('zoom').addEventListener('input', (e) => {
    state.crops[selected].zoom = Number(e.target.value);
    redraw();
  });
  $('fill').addEventListener('change', () => { state.crops[selected].fit = 'fill'; redraw(); });
  $('fit').addEventListener('change', () => { state.crops[selected].fit = 'fit'; redraw(); });
  $('photo').addEventListener('change', (e) => {
    if (e.target.files[0]) setPhoto(selected, e.target.files[0]);
    e.target.value = '';
  });
  $('photo-all').addEventListener('change', (e) => {
    if (e.target.files[0]) useOnePhotoEverywhere(e.target.files[0]);
    e.target.value = '';
  });
  $('sample-boulevard').addEventListener('click', () => setPhoto(selected, 'samples/boulevard.jpg'));
  $('sample-pier').addEventListener('click', () => setPhoto(selected, 'samples/pier.jpg'));
  $('sample-all').addEventListener('click', () => useOnePhotoEverywhere('samples/pier.jpg'));
  $('shuffle').addEventListener('click', shuffleCrops);
  $('reset-crops').addEventListener('click', resetCrops);
  $('export').addEventListener('click', exportAll);
  $('export-square').addEventListener('click', () => {
    download(exportCover(state, 1080, 1080), 'cover-1080x1080.png');
    say('Exported square 1080 x 1080 PNG.');
  });
  $('export-portrait').addEventListener('click', () => {
    download(exportCover(state, 1080, 1350), 'cover-1080x1350.png');
    say('Exported portrait 1080 x 1350 PNG.');
  });
  $('export-wide').addEventListener('click', () => {
    download(exportCover(state, 1920, 1080), 'cover-1920x1080.png');
    say('Exported wide 1920 x 1080 PNG.');
  });
  const compare = $('compare');
  const startCompare = (e) => { e.preventDefault(); comparing = true; redraw(); };
  const endCompare = () => { comparing = false; redraw(); };
  compare.addEventListener('pointerdown', startCompare);
  compare.addEventListener('pointerup', endCompare);
  compare.addEventListener('pointerleave', endCompare);
  // Keyboard: digits pick a panel, G cycles the grade, C holds compare.
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    const digit = Number(e.key);
    if (digit >= 1 && digit <= panelCount(state.layout)) {
      selected = digit - 1;
      redraw();
    } else if (e.key === 'g' || e.key === 'G') {
      const keys = Object.keys(GRADES);
      setGrade(keys[(keys.indexOf(state.grade) + 1) % keys.length]);
    }
  });
}

// A ?shot= query builds a fixed scene for a screenshot instead of the
// interactive editor; shots.js owns the scene, this file only hands it the
// state setters it needs.
async function boot() {
  wireControls();
  await loadFonts();
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (shot) {
    await runShot(shot, params, {
      state,
      setLayout,
      setGrade,
      setPhoto,
      useOnePhotoEverywhere,
      redraw,
      canvas,
    });
  } else {
    await setPhoto(0, 'samples/pier.jpg').catch(() => {});
    redraw();
  }
  say('Ready — pick a layout, load photos, export your cover.');
}

boot();
