// Vice Sunset Cover Studio — editor wiring.
//
// Owns the cover state, the preview canvas, panel picking / dragging /
// zooming, uploads and drag-drop, the export buttons, and the ?shot= scenes
// (see shots.js). The cover itself is painted by cover.js; exports redraw
// it at full resolution on an offscreen canvas.
import { drawCover, panelAt, LAYOUTS, GRADES, EXPORT_SIZES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const PREVIEW = { w: 1080, h: 1080 };

const state = {
  layout: 'quad',
  grade: 'sunset',
  title: 'NEON SHORE',
  subtitle: 'Sunset Heist',
  badge: 'EST. 2026 • SUNSET STRIP',
  grain: true,
  vignette: true,
  gradientTitle: true,
  gradeOn: true,
  selected: 0,
  panels: [
    { img: null, zoom: 1, ox: 0, oy: 0, fit: 'fill' },
    { img: null, zoom: 1, ox: 0, oy: 0, fit: 'fill' },
    { img: null, zoom: 1, ox: 0, oy: 0, fit: 'fill' },
    { img: null, zoom: 1, ox: 0, oy: 0, fit: 'fill' },
  ],
};

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load image'));
    img.src = url;
  });
}

function redraw() {
  canvas.width = PREVIEW.w;
  canvas.height = PREVIEW.h;
  drawCover(ctx, PREVIEW.w, PREVIEW.h, state);
  syncPanelControls();
}

function setStatus(text) { statusEl.textContent = text; }

function selectedPanel() { return state.panels[state.selected]; }

function syncPanelControls() {
  const p = selectedPanel();
  document.getElementById('zoom').value = p.zoom;
  document.getElementById('panX').value = p.ox;
  document.getElementById('panY').value = p.oy;
  document.getElementById('fit').value = p.fit || 'fill';
  document.querySelectorAll('#panelTabs button').forEach((b, i) => {
    b.setAttribute('aria-pressed', String(i === state.selected));
  });
}

function selectPanel(i) {
  state.selected = i;
  syncPanelControls();
  setStatus(`Panel ${i + 1} selected — drag to pan, scroll to zoom.`);
}

// --- segmented controls -------------------------------------------------
function buildSeg(container, items, current, onPick) {
  const el = document.getElementById(container);
  el.innerHTML = '';
  for (const item of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = item.label;
    b.title = item.hint || '';
    b.setAttribute('aria-pressed', String(item.id === current));
    b.addEventListener('click', () => {
      onPick(item.id);
      el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
    });
    el.appendChild(b);
  }
}

buildSeg('layouts', LAYOUTS, state.layout, (id) => { state.layout = id; redraw(); });
buildSeg('grades', GRADES, state.grade, (id) => { state.grade = id; redraw(); });

// Panel tabs: one button per panel (full-bleed shows one).
const tabsEl = document.getElementById('panelTabs');
function buildTabs() {
  tabsEl.innerHTML = '';
  const count = state.layout === 'full' ? 1 : 4;
  for (let i = 0; i < count; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = state.layout === 'full' ? 'Photo' : `Panel ${i + 1}${i === 0 ? ' (hero)' : ''}`;
    b.addEventListener('click', () => selectPanel(i));
    tabsEl.appendChild(b);
  }
  syncPanelControls();
}
buildTabs();

// --- text + finish controls ---------------------------------------------
const bindText = (id, key) => {
  document.getElementById(id).addEventListener('input', (e) => { state[key] = e.target.value; redraw(); });
};
bindText('title', 'title');
bindText('subtitle', 'subtitle');
bindText('badge', 'badge');

const bindCheck = (id, key) => {
  document.getElementById(id).addEventListener('change', (e) => { state[key] = e.target.checked; redraw(); });
};
bindCheck('grain', 'grain');
bindCheck('vignette', 'vignette');
bindCheck('gradientTitle', 'gradientTitle');

// Hold-to-compare: while held, the grade is off.
const compareBtn = document.getElementById('compare');
const compareOn = () => { state.gradeOn = false; redraw(); };
const compareOff = () => { state.gradeOn = true; redraw(); };
compareBtn.addEventListener('pointerdown', compareOn);
compareBtn.addEventListener('pointerup', compareOff);
compareBtn.addEventListener('pointerleave', compareOff);

// --- panel crop controls -------------------------------------------------
document.getElementById('zoom').addEventListener('input', (e) => { selectedPanel().zoom = Number(e.target.value); redraw(); });
document.getElementById('panX').addEventListener('input', (e) => { selectedPanel().ox = Number(e.target.value); redraw(); });
document.getElementById('panY').addEventListener('input', (e) => { selectedPanel().oy = Number(e.target.value); redraw(); });
document.getElementById('fit').addEventListener('change', (e) => { selectedPanel().fit = e.target.value; redraw(); });
document.getElementById('resetPanel').addEventListener('click', () => {
  const p = selectedPanel();
  p.zoom = 1; p.ox = 0; p.oy = 0; p.fit = 'fill';
  redraw();
  setStatus(`Panel ${state.selected + 1} crop reset.`);
});

// --- photos ---------------------------------------------------------------
async function setPanelPhoto(i, img) {
  state.panels[i].img = img;
  selectPanel(i);
  redraw();
}

async function loadSample(name) {
  const img = await loadImage(`./samples/${name}.jpg`);
  return img;
}

document.getElementById('loadSamples').addEventListener('click', async () => {
  try {
    const [bvd, pier] = await Promise.all([loadSample('boulevard'), loadSample('pier')]);
    state.panels[0].img = bvd;
    state.panels[1].img = pier;
    state.panels[2].img = bvd;
    state.panels[3].img = pier;
    // Vary the crops so the same photo reads differently per panel. The
    // boulevard portrait is face-high, so the hero shifts down to keep it.
    state.panels[0].zoom = 1; state.panels[0].ox = 0; state.panels[0].oy = 0.3;
    state.panels[1].zoom = 1.25; state.panels[1].ox = 0.15; state.panels[1].oy = -0.1;
    state.panels[2].zoom = 1.5; state.panels[2].ox = -0.25; state.panels[2].oy = 0.1;
    state.panels[3].zoom = 1.15; state.panels[3].ox = 0.1; state.panels[3].oy = 0.15;
    redraw();
    setStatus('Samples loaded — click any panel to re-crop it.');
  } catch {
    setStatus('Could not load the sample photos.');
  }
});

document.getElementById('useOne').addEventListener('click', () => {
  const img = selectedPanel().img;
  if (!img) { setStatus('Load a photo into the selected panel first.'); return; }
  for (const p of state.panels) p.img = img;
  redraw();
  setStatus('One photo in all panels — each keeps its own crop.');
});

document.getElementById('photo').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const img = await loadImage(URL.createObjectURL(file));
    await setPanelPhoto(state.selected, img);
    setStatus(`Photo loaded into panel ${state.selected + 1}.`);
  } catch {
    setStatus('That file could not be read as an image.');
  }
  e.target.value = '';
});

document.querySelectorAll('#thumbs button').forEach((b) => {
  b.addEventListener('click', async () => {
    try {
      const img = await loadSample(b.dataset.sample);
      await setPanelPhoto(state.selected, img);
      document.querySelectorAll('#thumbs button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      setStatus(`Sample “${b.dataset.sample}” in panel ${state.selected + 1}.`);
    } catch {
      setStatus('Could not load that sample.');
    }
  });
});

// Drop an image anywhere on the page: it lands in the selected panel.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'));
  if (!file) return;
  try {
    const img = await loadImage(URL.createObjectURL(file));
    await setPanelPhoto(state.selected, img);
    setStatus(`Dropped photo in panel ${state.selected + 1}.`);
  } catch {
    setStatus('That file could not be read as an image.');
  }
});

// --- canvas pointer: click to select, drag to pan, wheel to zoom --------
let dragging = null;
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const hit = panelAt(state.layout, canvas.width, canvas.height, p.x, p.y);
  if (hit >= 0) selectPanel(hit);
  dragging = { x: p.x, y: p.y, ox: selectedPanel().ox, oy: selectedPanel().oy };
  canvas.classList.add('dragging');
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const p = canvasPoint(e);
  const panel = selectedPanel();
  panel.ox = Math.max(-1, Math.min(1, dragging.ox + (p.x - dragging.x) / (canvas.width * 0.45)));
  panel.oy = Math.max(-1, Math.min(1, dragging.oy + (p.y - dragging.y) / (canvas.height * 0.45)));
  redraw();
});
const endDrag = () => { dragging = null; canvas.classList.remove('dragging'); };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = selectedPanel();
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  redraw();
}, { passive: false });

// --- export ----------------------------------------------------------------
export function exportCover(size) {
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off.getContext('2d'), size.w, size.h, state);
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `neon-shore-cover-${size.w}x${size.h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve({ w: size.w, h: size.h, bytes: blob ? blob.size : 0 });
    }, 'image/png');
  });
}

async function exportOne(size) {
  const info = await exportCover(size);
  setStatus(`Exported ${size.w} × ${size.h} PNG (${Math.round(info.bytes / 1024)} KiB).`);
  return info;
}

document.getElementById('exportSquare').addEventListener('click', () => exportOne(EXPORT_SIZES[0]));
document.getElementById('exportPortrait').addEventListener('click', () => exportOne(EXPORT_SIZES[1]));
document.getElementById('exportWide').addEventListener('click', () => exportOne(EXPORT_SIZES[2]));
document.getElementById('exportAll').addEventListener('click', async () => {
  for (const size of EXPORT_SIZES) await exportOne(size);
  setStatus('Exported all three sizes.');
});

// Keyboard shortcuts: 1–4 select a panel, arrows nudge the selected panel.
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  if (e.key >= '1' && e.key <= '4') { selectPanel(Number(e.key) - 1); return; }
  const step = e.shiftKey ? 0.1 : 0.03;
  const p = selectedPanel();
  if (e.key === 'ArrowLeft') { p.ox = Math.max(-1, p.ox - step); redraw(); }
  else if (e.key === 'ArrowRight') { p.ox = Math.min(1, p.ox + step); redraw(); }
  else if (e.key === 'ArrowUp') { p.oy = Math.max(-1, p.oy - step); redraw(); }
  else if (e.key === 'ArrowDown') { p.oy = Math.min(1, p.oy + step); redraw(); }
});

// --- shot scenes -----------------------------------------------------------
const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, state, async (name) => loadSample(name), redraw);
} else {
  redraw();
}
