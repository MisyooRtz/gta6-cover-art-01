// Vice Sunset Cover Studio — the editor.
//
// Wires the page: the cover canvas, the layout and grade pickers, the title
// words, per-panel photo loading (file picker, drag and drop, samples), the
// crop tools (drag to pan, wheel to zoom, slider, fill/fit, reset, shuffle,
// one photo in every panel) and the PNG export. `?shot=` scenes live in
// shots.js; this file only runs the editor itself.

import { COVER_SIZES, GRADES, LAYOUTS, cropFromRect, cropRect, defaultCrop, drawCover, layoutPanels } from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const statusEl = $('status');

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
  layout: 'hero',
  grade: 'sunset',
  size: 'square',
  title: 'Sunset Heist',
  subtitle: 'one last ride down Ocean Drive',
  badge: 'Vice City',
  panels: [0, 1, 2, 3].map(() => ({ photo: null, crop: null })),
  selected: 0,
  compare: false,
};

function panelsFor(w, h) {
  return layoutPanels(state.layout, w, h);
}

function currentPanels() {
  return panelsFor(canvas.width, canvas.height);
}

function selectedPanel() {
  return currentPanels()[state.selected];
}

function selectedSlot() {
  return state.panels[state.selected];
}

function ensureCrop(panel) {
  const slot = selectedSlot();
  if (!slot.crop) slot.crop = defaultCrop(panel);
  return slot.crop;
}

function redraw() {
  const view = {
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    badge: state.badge,
    panels: currentPanels().map((panel, i) => ({
      photo: state.panels[i].photo,
      crop: state.panels[i].crop ?? defaultCrop(panel),
    })),
  };
  drawCover(canvas, view, state.compare);
  updatePanelReadout();
}

function setStatus(text) {
  statusEl.textContent = text;
}

// ---------------------------------------------------------------------------
// Image loading
// ---------------------------------------------------------------------------

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function loadIntoPanel(index, source, label) {
  try {
    const img = typeof source === 'string' ? await loadImage(source) : source;
    const slot = state.panels[index];
    slot.photo = img;
    slot.crop = defaultCrop(currentPanels()[index]);
    state.selected = index;
    redraw();
    syncPanelControls();
    setStatus(`${label} is in panel ${index + 1}. Drag to pan, scroll to zoom.`);
  } catch {
    setStatus(`Could not load ${label}. Try another image.`);
  }
}

function loadSample(name, index) {
  return loadIntoPanel(index, `samples/${name}.jpg`, name);
}

// ---------------------------------------------------------------------------
// Export — the one path the button and the ?shot=export-test scene share
// ---------------------------------------------------------------------------

/** Renders the cover at an export size and resolves to a PNG blob. */
export function exportCover(sizeKey) {
  const size = COVER_SIZES[sizeKey] ?? COVER_SIZES.square;
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  const view = {
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    badge: state.badge,
    panels: layoutPanels(state.layout, size.w, size.h).map((panel, i) => ({
      photo: state.panels[i].photo,
      crop: state.panels[i].crop ?? defaultCrop(panel),
    })),
  };
  drawCover(off, view, false);
  return new Promise((resolve, reject) => {
    off.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('export produced no PNG'))), 'image/png');
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function doExport() {
  setStatus('Exporting…');
  try {
    const blob = await exportCover(state.size);
    const size = COVER_SIZES[state.size];
    downloadBlob(blob, `vice-sunset-cover-${size.w}x${size.h}.png`);
    setStatus(`Saved vice-sunset-cover-${size.w}x${size.h}.png (${(blob.size / 1024).toFixed(0)} KB).`);
  } catch {
    setStatus('Export failed — try again.');
  }
}

// ---------------------------------------------------------------------------
// Panel tools
// ---------------------------------------------------------------------------

function updatePanelReadout() {
  const panel = selectedPanel();
  const slot = selectedSlot();
  const crop = slot.crop ?? defaultCrop(panel);
  $('panel-name').textContent = `Panel ${state.selected + 1} — ${panel.role}`;
  $('zoom').value = String(Math.round(crop.zoom * 100));
  $('zoom-val').textContent = `${Math.round(crop.zoom * 100)}%`;
  $('fill-fit').textContent = crop.mode === 'fill' ? 'Fit whole photo' : 'Fill panel';
}

function syncPanelControls() {
  document.querySelectorAll('#layout-pick button').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
    b.setAttribute('aria-pressed', String(b.dataset.layout === state.layout));
  });
  document.querySelectorAll('#grade-pick button').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
    b.setAttribute('aria-pressed', String(b.dataset.grade === state.grade));
  });
  document.querySelectorAll('#size-pick button').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === state.size);
    b.setAttribute('aria-pressed', String(b.dataset.size === state.size));
  });
  updatePanelReadout();
}

function applySize() {
  const size = COVER_SIZES[state.size];
  canvas.width = size.w;
  canvas.height = size.h;
  redraw();
}

function resetPanel(index) {
  const slot = state.panels[index];
  slot.crop = defaultCrop(currentPanels()[index]);
  redraw();
  updatePanelReadout();
  setStatus(`Panel ${index + 1} crop reset.`);
}

function shuffleCrops() {
  currentPanels().forEach((panel, i) => {
    const slot = state.panels[i];
    if (!slot.photo) return;
    slot.crop = {
      cx: 0.3 + Math.random() * 0.4,
      cy: 0.25 + Math.random() * 0.45,
      zoom: 1 + Math.random() * 0.9,
      mode: slot.crop?.mode ?? 'fill',
    };
  });
  redraw();
  setStatus('Crops shuffled — drag any panel to fine-tune it.');
}

function onePhotoEverywhere() {
  const source = state.panels[state.selected];
  if (!source.photo) {
    setStatus('Load a photo into the selected panel first.');
    return;
  }
  currentPanels().forEach((panel, i) => {
    state.panels[i].photo = source.photo;
    // Same photo, but each panel keeps its own look-up so faces stay in frame.
    state.panels[i].crop = { ...defaultCrop(panel), mode: source.crop?.mode ?? 'fill' };
  });
  redraw();
  setStatus('One photo in all four panels, each cropped on its own.');
}

// ---------------------------------------------------------------------------
// Pointer interaction on the preview canvas: click to select, drag to pan,
// wheel to zoom. Coordinates are mapped from CSS pixels to canvas pixels.
// ---------------------------------------------------------------------------

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function hitPanel(point) {
  const panels = currentPanels();
  for (let i = panels.length - 1; i >= 0; i -= 1) {
    const p = panels[i];
    let lx = point.x;
    let ly = point.y;
    if (p.rot) {
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      const rad = (-p.rot * Math.PI) / 180;
      const dx = point.x - cx;
      const dy = point.y - cy;
      lx = cx + dx * Math.cos(rad) - dy * Math.sin(rad);
      ly = cy + dx * Math.sin(rad) + dy * Math.cos(rad);
    }
    if (lx >= p.x && lx <= p.x + p.w && ly >= p.y && ly <= p.y + p.h) return i;
  }
  return -1;
}

let drag = null;

canvas.addEventListener('pointerdown', (event) => {
  const point = canvasPoint(event);
  const index = hitPanel(point);
  if (index === -1) return;
  state.selected = index;
  syncPanelControls();
  const slot = state.panels[index];
  if (!slot.photo) return;
  const panel = currentPanels()[index];
  const crop = ensureCrop(panel);
  const rect = cropRect(panel, slot.photo, crop);
  drag = { index, startX: point.x, startY: point.y, rect, moved: false };
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const point = canvasPoint(event);
  const movedX = point.x - drag.startX;
  const movedY = point.y - drag.startY;
  if (Math.abs(movedX) + Math.abs(movedY) > 3) drag.moved = true;
  const panel = currentPanels()[drag.index];
  const slot = state.panels[drag.index];
  const rect = { ...drag.rect, dx: drag.rect.dx + movedX, dy: drag.rect.dy + movedY };
  const { cx, cy } = cropFromRect(panel, slot.photo, rect);
  const crop = ensureCrop(panel);
  crop.cx = cx;
  crop.cy = cy;
  redraw();
});

canvas.addEventListener('pointerup', () => {
  if (drag?.moved) setStatus(`Panel ${drag.index + 1} panned.`);
  drag = null;
});

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const slot = selectedSlot();
  if (!slot.photo) return;
  const panel = selectedPanel();
  const crop = ensureCrop(panel);
  crop.zoom = Math.min(4, Math.max(1, crop.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
  redraw();
  updatePanelReadout();
}, { passive: false });

// Drag and drop a file onto a panel to fill it.
canvas.addEventListener('dragover', (event) => event.preventDefault());
canvas.addEventListener('drop', (event) => {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (!file || !file.type.startsWith('image/')) return;
  const index = hitPanel(canvasPoint(event));
  loadIntoPanel(index === -1 ? state.selected : index, URL.createObjectURL(file), file.name);
});

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

function isTyping() {
  const tag = document.activeElement?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

document.addEventListener('keydown', (event) => {
  if (isTyping()) return;
  const key = event.key.toLowerCase();
  const layouts = Object.keys(LAYOUTS);
  if (['1', '2', '3', '4'].includes(key)) {
    state.layout = layouts[Number(key) - 1];
    applySize();
    syncPanelControls();
    setStatus(`Layout: ${LAYOUTS[state.layout].name}.`);
    return;
  }
  if (key === 'g') {
    const grades = Object.keys(GRADES);
    state.grade = grades[(grades.indexOf(state.grade) + 1) % grades.length];
    redraw();
    syncPanelControls();
    setStatus(`Grade: ${GRADES[state.grade].name}.`);
    return;
  }
  if (key === 'f') {
    const crop = ensureCrop(selectedPanel());
    crop.mode = crop.mode === 'fill' ? 'fit' : 'fill';
    redraw();
    updatePanelReadout();
    setStatus(crop.mode === 'fill' ? 'Panel fills its frame.' : 'Whole photo fits inside the frame.');
    return;
  }
  if (key === 'r') { resetPanel(state.selected); return; }
  if (key === 's') { shuffleCrops(); return; }
  if (key === 'e') { doExport(); return; }
  if (key === 'c') {
    if (!event.repeat) {
      state.compare = true;
      redraw();
      setStatus('Comparing: showing the photos without the grade. Release C to go back.');
    }
    return;
  }
  if (['+', '='].includes(key) || key === '-') {
    const slot = selectedSlot();
    if (!slot.photo) return;
    const crop = ensureCrop(selectedPanel());
    crop.zoom = Math.min(4, Math.max(1, crop.zoom * (key === '-' ? 1 / 1.15 : 1.15)));
    redraw();
    updatePanelReadout();
    return;
  }
  if (key.startsWith('arrow')) {
    const slot = selectedSlot();
    if (!slot.photo) return;
    event.preventDefault();
    const crop = ensureCrop(selectedPanel());
    const step = 0.02;
    if (key === 'arrowleft') crop.cx -= step;
    if (key === 'arrowright') crop.cx += step;
    if (key === 'arrowup') crop.cy -= step;
    if (key === 'arrowdown') crop.cy += step;
    crop.cx = Math.min(1, Math.max(0, crop.cx));
    crop.cy = Math.min(1, Math.max(0, crop.cy));
    redraw();
  }
});

document.addEventListener('keyup', (event) => {
  if (event.key.toLowerCase() === 'c' && state.compare) {
    state.compare = false;
    redraw();
    setStatus('Grade back on.');
  }
});

// ---------------------------------------------------------------------------
// Control wiring
// ---------------------------------------------------------------------------

function wirePicker(id, attr, apply) {
  document.querySelectorAll(`#${id} button`).forEach((button) => {
    button.addEventListener('click', () => {
      apply(button.dataset[attr]);
      syncPanelControls();
    });
  });
}

wirePicker('layout-pick', 'layout', (value) => {
  state.layout = value;
  applySize();
  setStatus(`Layout: ${LAYOUTS[value].name}.`);
});
wirePicker('grade-pick', 'grade', (value) => {
  state.grade = value;
  redraw();
  setStatus(`Grade: ${GRADES[value].name}.`);
});
wirePicker('size-pick', 'size', (value) => {
  state.size = value;
  applySize();
  setStatus(`Export size: ${COVER_SIZES[value].label}.`);
});

$('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
$('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
$('badge').addEventListener('input', (e) => { state.badge = e.target.value; redraw(); });
$('zoom').addEventListener('input', (e) => {
  const slot = selectedSlot();
  if (!slot.photo) return;
  ensureCrop(selectedPanel()).zoom = Math.min(4, Math.max(1, Number(e.target.value) / 100));
  redraw();
  updatePanelReadout();
});
$('fill-fit').addEventListener('click', () => {
  const crop = ensureCrop(selectedPanel());
  crop.mode = crop.mode === 'fill' ? 'fit' : 'fill';
  redraw();
  updatePanelReadout();
});
$('reset-panel').addEventListener('click', () => resetPanel(state.selected));
$('shuffle').addEventListener('click', shuffleCrops);
$('all-panels').addEventListener('click', onePhotoEverywhere);
$('compare').addEventListener('pointerdown', () => { state.compare = true; redraw(); });
$('compare').addEventListener('pointerup', () => { state.compare = false; redraw(); });
$('compare').addEventListener('pointerleave', () => { if (state.compare) { state.compare = false; redraw(); } });
$('export').addEventListener('click', doExport);
$('photo').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) loadIntoPanel(state.selected, URL.createObjectURL(file), file.name);
  e.target.value = '';
});
$('sample-boulevard').addEventListener('click', () => loadSample('boulevard', state.selected));
$('sample-pier').addEventListener('click', () => loadSample('pier', state.selected));
$('sample-all-boulevard').addEventListener('click', async () => {
  await loadSample('boulevard', 0);
  state.panels.forEach((slot, i) => { if (i > 0) { slot.photo = state.panels[0].photo; slot.crop = null; } });
  redraw();
  setStatus('Boulevard photo in all four panels.');
});
$('sample-all-pier').addEventListener('click', async () => {
  await loadSample('pier', 0);
  state.panels.forEach((slot, i) => { if (i > 0) { slot.photo = state.panels[0].photo; slot.crop = null; } });
  redraw();
  setStatus('Pier photo in all four panels.');
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function boot() {
  try {
    await Promise.all([
      document.fonts.load('400 80px Anton'),
      document.fonts.load('400 40px Pacifico'),
      document.fonts.ready,
    ]);
  } catch {
    // The bundled fonts failed to load; the canvas falls back to system fonts.
  }
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  applySize();
  syncPanelControls();
  if (shot) {
    await runShot(shot, params, {
      loadSample,
      loadIntoPanel,
      exportCover,
      redraw,
      setState: (patch) => Object.assign(state, patch),
      getState: () => state,
    });
  } else {
    redraw();
    setStatus('Pick a layout and a grade, drop photos in, export your cover.');
  }
}

boot();
