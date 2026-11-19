// Fixed scenes for screenshots: ?shot=cover shows the cover alone,
// ?shot=editor shows the page with a sample photo loaded, and
// ?shot=export-test proves the full-resolution export path works.
// Query params: photo / photo1..photo4 (sample names), caption, subtitle,
// badge, layout, grade, size (WxH). window.__shotReady is set once the
// scene has painted, so a screenshot runner knows when to capture.
// A scene error is reported on window.__shotError instead of leaving the
// runner waiting on a flag that never comes.

import { exportCover } from './cover.js';

window.addEventListener('error', (event) => {
  window.__shotError = String(event.message ?? event.error ?? 'unknown error');
});

function ready() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}

function parseSize(query) {
  const raw = query.get('size') ?? '';
  const match = raw.match(/^(\d+)x(\d+)$/);
  if (match) return { w: Number(match[1]), h: Number(match[2]) };
  return { w: 1080, h: 1080 };
}

async function applyScene(query, api) {
  const layout = query.get('layout');
  if (layout) api.setLayout(layout);
  const grade = query.get('grade');
  if (grade) api.setGrade(grade);
  const caption = query.get('caption');
  if (caption !== null) api.state.title = caption;
  const subtitle = query.get('subtitle');
  if (subtitle !== null) api.state.subtitle = subtitle;
  const badge = query.get('badge');
  if (badge !== null) api.state.badge = badge;
  const first = query.get('photo');
  if (query.get('photo1')) {
    for (let i = 1; i <= 4; i += 1) {
      const name = query.get(`photo${i}`);
      if (name) await api.setPhoto(i - 1, `samples/${name}.jpg`);
    }
  } else if (first) {
    await api.useOnePhotoEverywhere(`samples/${first}.jpg`);
  }
}

export async function runShot(shot, query, api) {
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const { w, h } = parseSize(query);
    api.canvas.width = w;
    api.canvas.height = h;
    await applyScene(query, api);
    if (!query.get('photo') && !query.get('photo1')) {
      // A bare ?shot=cover still shows a real cover, not empty panels.
      await api.useOnePhotoEverywhere('samples/pier.jpg');
    }
    api.redraw();
    ready();
    return;
  }
  if (shot === 'editor') {
    await applyScene(query, api);
    api.redraw();
    ready();
    return;
  }
  if (shot === 'export-test') {
    await applyScene(query, api);
    api.redraw();
    // Run the exact export the Export buttons call, at full resolution,
    // and report the resulting file size on the window so a headless
    // check can confirm the path produced real bytes.
    const out = exportCover(api.state, 1080, 1080);
    const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/png'));
    window.__exportBytes = blob ? blob.size : 0;
    window.__exportSize = '1080x1080';
    ready();
    return;
  }
  // Unknown shot name: fall back to the plain editor with a sample photo.
  await api.setPhoto(0, 'samples/pier.jpg');
  api.redraw();
  ready();
}
