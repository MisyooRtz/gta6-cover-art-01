// Fixed scenes for screenshots and checks.
//   ?shot=cover&photo=boulevard|pier|both&caption=...&layout=quad|strip|full|tilt
//     &grade=sunset|neon|dusk|noir&size=1280x720 — the cover full-frame, no
//     editor chrome (body.shot-cover hides it).
//   ?shot=editor&photo=boulevard — the editor with a sample photo loaded.
//   ?export-test=1080x1080 — draws a full-resolution export offscreen and
//     reports its size in window.__exportInfo (used to verify the export
//     path without a download).
// window.__shotReady is set once the scene has painted (double rAF).
import { drawCover } from './cover.js';

async function fontsReady() {
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch { /* fonts are decorative; paint anyway */ }
}

function paintReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

export async function runShot(shot, query, state, loadSample, redraw) {
  await fontsReady();
  const canvas = document.getElementById('cover');

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const caption = query.get('caption');
    if (caption) state.title = caption;
    const layout = query.get('layout');
    if (layout) state.layout = layout;
    const grade = query.get('grade');
    if (grade) state.grade = grade;
    const subtitle = query.get('subtitle');
    if (subtitle !== null) state.subtitle = subtitle;
    const badge = query.get('badge');
    if (badge !== null) state.badge = badge;

    const photo = query.get('photo') ?? 'pier';
    const [bvd, pier] = await Promise.all([
      loadSample('boulevard').catch(() => null),
      loadSample('pier').catch(() => null),
    ]);
    const pick = (name) => (name === 'boulevard' ? bvd : pier);
    if (photo === 'both') {
      state.panels[0].img = bvd; state.panels[1].img = pier;
      state.panels[2].img = bvd; state.panels[3].img = pier;
      // The boulevard portrait is face-high: shift the hero down so the
      // face reads instead of the chin being cropped at the frame edge.
      state.panels[0].zoom = 1; state.panels[0].ox = 0; state.panels[0].oy = 0.3;
      state.panels[1].zoom = 1.25; state.panels[1].ox = 0.15;
      state.panels[2].zoom = 1.5; state.panels[2].ox = -0.25;
      state.panels[3].zoom = 1.15; state.panels[3].ox = 0.1;
    } else {
      const img = pick(photo);
      for (const p of state.panels) p.img = img;
      state.panels[0].zoom = 1; state.panels[0].oy = 0.3;
      state.panels[1].zoom = 1.3; state.panels[1].ox = 0.2;
      state.panels[2].zoom = 1.6; state.panels[2].ox = -0.3; state.panels[2].oy = 0.1;
      state.panels[3].zoom = 1.2; state.panels[3].ox = -0.15; state.panels[3].oy = -0.1;
    }

    // Size the canvas to the requested export size (default: the viewport).
    const size = query.get('size');
    if (size) {
      const [w, h] = size.split('x').map(Number);
      if (w > 0 && h > 0) { canvas.width = w; canvas.height = h; }
    }
    drawCover(canvas.getContext('2d'), canvas.width, canvas.height, state);
    paintReady();
    return;
  }

  if (shot === 'editor') {
    const photo = query.get('photo') ?? 'boulevard';
    const [bvd, pier] = await Promise.all([
      loadSample('boulevard').catch(() => null),
      loadSample('pier').catch(() => null),
    ]);
    state.panels[0].img = bvd; state.panels[1].img = pier;
    state.panels[2].img = bvd; state.panels[3].img = pier;
    state.panels[1].zoom = 1.25; state.panels[1].ox = 0.15;
    state.panels[2].zoom = 1.5; state.panels[2].ox = -0.25;
    const caption = query.get('caption');
    if (caption) {
      state.title = caption;
      const input = document.getElementById('title');
      if (input) input.value = caption;
    }
    void photo;
    redraw();
    const status = document.getElementById('status');
    if (status) status.textContent = 'Samples loaded — click any panel to re-crop it.';
    paintReady();
    return;
  }

  if (shot === 'export-test') {
    const size = (query.get('size') || '1080x1080').split('x').map(Number);
    const [bvd, pier] = await Promise.all([
      loadSample('boulevard').catch(() => null),
      loadSample('pier').catch(() => null),
    ]);
    state.panels[0].img = bvd; state.panels[1].img = pier;
    state.panels[2].img = bvd; state.panels[3].img = pier;
    const off = document.createElement('canvas');
    off.width = size[0]; off.height = size[1];
    drawCover(off.getContext('2d'), size[0], size[1], state);
    const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
    window.__exportInfo = { w: size[0], h: size[1], bytes: blob ? blob.size : 0, type: blob ? blob.type : '' };
    const status = document.getElementById('status');
    if (status) status.textContent = `EXPORT-TEST ${size[0]}x${size[1]} ${window.__exportInfo.bytes} bytes`;
    document.title = `EXPORT-TEST ${size[0]}x${size[1]} ${window.__exportInfo.bytes}`;
    paintReady();
    return;
  }

  redraw();
  paintReady();
}
