// Vice Sunset Cover Studio — editor wiring: panels, crops, grades, lettering,
// exports. The drawing itself lives in cover.js; this file only owns the UI
// state and the pointer gestures on the preview canvas.
import { GRADES, LAYOUTS, SIZES, defaultState, drawCover, panelAt } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const panelTag = document.getElementById('panel-tag');
const st = defaultState();
let redrawTimer = 0;

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function sizeForPreview() {
  const s = SIZES[st.size];
  canvas.width = s.w;
  canvas.height = s.h;
}

export function redraw() {
  drawCover(canvas, st);
  const tag = st.panels[st.selected] && st.panels[st.selected].img ? `Panel ${st.selected + 1}` : `Panel ${st.selected + 1} — empty`;
  panelTag.textContent = tag;
  panelTag.hidden = false;
  document.getElementById('zoom-val').textContent = `${Math.round((st.panels[st.selected].zoom || 1) * 100)}%`;
  document.getElementById('zoom').value = Math.round((st.panels[st.selected].zoom || 1) * 100);
}

function scheduleRedraw() {
  clearTimeout(redrawTimer);
  redrawTimer = setTimeout(redraw, 16);
}

function selectPanel(i) {
  if (i < 0) return;
  st.selected = i;
  redraw();
}

// ---- panel gestures: click to select, drag to pan, wheel to zoom ----
let drag = null;
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const i = panelAt(st, canvas.width, canvas.height, p.x, p.y);
  if (i < 0) return;
  selectPanel(i);
  drag = { x: p.x, y: p.y, moved: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const panel = st.panels[st.selected];
  if (!panel.img) return;
  const dx = (p.x - drag.x) / canvas.width;
  const dy = (p.y - drag.y) / canvas.height;
  if (Math.abs(dx) + Math.abs(dy) > 0.002) drag.moved = true;
  panel.ox = (panel.ox || 0) + dx;
  panel.oy = (panel.oy || 0) + dy;
  drag = { x: p.x, y: p.y, moved: drag.moved };
  scheduleRedraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = canvasPoint(e);
  const i = panelAt(st, canvas.width, canvas.height, p.x, p.y);
  if (i < 0) return;
  selectPanel(i);
  const panel = st.panels[i];
  panel.zoom = Math.min(3, Math.max(0.5, (panel.zoom || 1) * (e.deltaY < 0 ? 1.08 : 0.92)));
  scheduleRedraw();
}, { passive: false });

// Drag-and-drop a photo straight onto a panel.
canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', async (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const p = canvasPoint(e);
  const i = panelAt(st, canvas.width, canvas.height, p.x, p.y);
  if (i < 0) return;
  st.panels[i].img = await loadImage(URL.createObjectURL(file));
  st.panels[i].zoom = 1; st.panels[i].ox = 0; st.panels[i].oy = 0;
  selectPanel(i);
  status.textContent = `Photo dropped into panel ${i + 1}.`;
});

// ---- controls ----
const gradeRow = document.getElementById('grades');
Object.entries(GRADES).forEach(([key, g]) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = g.label;
  b.dataset.grade = key;
  b.classList.toggle('active', key === st.grade);
  b.addEventListener('click', () => {
    st.grade = key;
    gradeRow.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x.dataset.grade === key));
    redraw();
  });
  gradeRow.appendChild(b);
});

document.getElementById('layout').addEventListener('change', (e) => {
  st.layout = e.target.value;
  st.selected = 0;
  redraw();
});
document.getElementById('size').addEventListener('change', (e) => {
  st.size = e.target.value;
  sizeForPreview();
  redraw();
});
document.getElementById('grain').addEventListener('change', (e) => { st.grain = e.target.checked; redraw(); });
document.getElementById('vignette').addEventListener('change', (e) => { st.vignette = e.target.checked; redraw(); });
document.getElementById('grad-title').addEventListener('change', (e) => { st.gradientTitle = e.target.checked; redraw(); });
document.getElementById('title').addEventListener('input', (e) => { st.title = e.target.value; scheduleRedraw(); });
document.getElementById('subtitle').addEventListener('input', (e) => { st.subtitle = e.target.value; scheduleRedraw(); });
document.getElementById('badge').addEventListener('input', (e) => { st.badge = e.target.value; scheduleRedraw(); });
document.getElementById('zoom').addEventListener('input', (e) => {
  st.panels[st.selected].zoom = Number(e.target.value) / 100;
  scheduleRedraw();
});
document.getElementById('fit-fill').addEventListener('click', () => {
  const p = st.panels[st.selected];
  p.fit = p.fit === 'fill' ? 'fit' : 'fill';
  redraw();
  status.textContent = `Panel ${st.selected + 1}: ${p.fit === 'fill' ? 'fill (crop to panel)' : 'fit (whole photo)'}.`;
});
document.getElementById('reset-crop').addEventListener('click', () => {
  const p = st.panels[st.selected];
  p.zoom = 1; p.ox = 0; p.oy = 0; p.fit = 'fill';
  redraw();
});
document.getElementById('shuffle-crops').addEventListener('click', () => {
  // Random-ish but bounded crops per filled panel, so one photo reads as
  // four different shots. Deterministic-ish seed from the clock, no library.
  const t = Date.now() / 1000;
  st.panels.forEach((p, i) => {
    if (!p.img) return;
    p.zoom = 1.1 + ((Math.sin(t + i * 2.7) + 1) / 2) * 0.7;
    p.ox = Math.sin(t * 1.3 + i * 1.9) * 0.12;
    p.oy = Math.cos(t * 0.9 + i * 2.3) * 0.18;
  });
  redraw();
  status.textContent = 'Panel crops shuffled — drag any panel to fine-tune.';
});

// Before/after grade compare: hold the button to see the ungraded cover.
const compare = document.getElementById('compare');
const gradeOff = () => { st.showGrade = false; redraw(); };
const gradeOn = () => { st.showGrade = true; redraw(); };
compare.addEventListener('pointerdown', gradeOff);
compare.addEventListener('pointerup', gradeOn);
compare.addEventListener('pointerleave', gradeOn);

async function setPanelImage(i, url) {
  st.panels[i].img = await loadImage(url);
  st.panels[i].zoom = 1; st.panels[i].ox = 0; st.panels[i].oy = 0;
}

async function loadSample(name) {
  const url = `./samples/${name}.jpg`;
  const img = await loadImage(url);
  // Samples fill every empty panel so the cover looks complete at once;
  // panels the user already filled keep their own photo. Each panel gets a
  // different default crop so the same photo frames differently per panel.
  // The crops favour the face: in the pier sample the face sits in the top
  // third of the photo (roughly y 10-280 of 720), so wide/short panels get
  // a large positive oy to push the image down and keep eyes, smile and
  // hat brim in frame instead of cropping to chin/neck. The bottom wide
  // panel keeps zoom 1 (any less would leave uncovered strips at the
  // sides) and oy 0.6, which centres the face's eyes in the bright band
  // above the cover title; the title itself always covers the lower face
  // there, by design. (A larger oy would suit a 16:9-wide canvas, but the
  // square shot-1 render clamps it to the top of the photo instead.)
  const defaultCrops = [
    { zoom: 1.1, ox: 0, oy: 0.45 },
    { zoom: 1.15, ox: 0, oy: 0.72 },
    { zoom: 1.2, ox: 0, oy: 0.75 },
    { zoom: 1, ox: 0, oy: 0.6 },
  ];
  for (let i = 0; i < st.panels.length; i++) {
    if (!st.panels[i].img) {
      st.panels[i].img = img;
      st.panels[i].zoom = defaultCrops[i].zoom;
      st.panels[i].ox = defaultCrops[i].ox;
      st.panels[i].oy = defaultCrops[i].oy;
    }
  }
  redraw();
  status.textContent = `Sample “${name}” loaded.`;
}
document.getElementById('sample-boulevard').addEventListener('click', () => loadSample('boulevard'));
document.getElementById('sample-pier').addEventListener('click', () => loadSample('pier'));

document.getElementById('upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  await setPanelImage(st.selected, URL.createObjectURL(file));
  redraw();
  status.textContent = `Photo loaded into panel ${st.selected + 1}.`;
  e.target.value = '';
});

document.getElementById('use-one').addEventListener('click', async () => {
  const src = st.panels.find((p) => p.img);
  if (!src) { status.textContent = 'Load a photo first, then use it in all panels.'; return; }
  const keep = st.panels.map((p) => ({ zoom: p.zoom, ox: p.ox, oy: p.oy, fit: p.fit }));
  for (let i = 0; i < st.panels.length; i++) {
    st.panels[i].img = src.img;
    // Keep each panel's own crop so the same photo frames differently.
    st.panels[i].zoom = keep[i].zoom; st.panels[i].ox = keep[i].ox; st.panels[i].oy = keep[i].oy;
  }
  redraw();
  status.textContent = 'One photo in all panels — each keeps its own crop.';
});

// ---- export: redraw at full target resolution on an offscreen canvas ----
export async function exportSize(sizeKey) {
  const s = SIZES[sizeKey];
  const off = document.createElement('canvas');
  off.width = s.w; off.height = s.h;
  await document.fonts.ready;
  drawCover(off, { ...st, size: sizeKey });
  const blob = await new Promise((res) => off.toBlob(res, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cover-${s.w}x${s.h}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return blob.size;
}

document.getElementById('export').addEventListener('click', async () => {
  const bytes = await exportSize(st.size);
  status.textContent = `Saved cover-${SIZES[st.size].w}x${SIZES[st.size].h}.png (${Math.round(bytes / 1024)} KB).`;
});
async function exportAll() {
  let total = 0;
  for (const key of Object.keys(SIZES)) {
    total += await exportSize(key);
    await new Promise((r) => setTimeout(r, 250));
  }
  status.textContent = `Saved all three sizes (1080×1080, 1080×1350, 1920×1080).`;
  return total;
}
document.getElementById('export-all').addEventListener('click', exportAll);
document.getElementById('btn-all').addEventListener('click', exportAll);

// ---- boot: ?shot= scenes, otherwise the editor with a sample ready ----
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  runShot(shot, params, { loadSample, setPanelImage, st, redraw, sizeForPreview, exportSize });
} else {
  sizeForPreview();
  loadSample('pier').catch(() => redraw());
}
