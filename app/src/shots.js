// Fixed scenes for screenshots: ?shot=cover shows the exported cover alone,
// ?shot=editor shows the editor with a sample photo, ?shot=export-test draws a
// full-resolution 1080x1080 export and reports its byte size so the export
// code path can be verified without a download. Params: photo (boulevard|pier),
// caption (title), layout, grade, size (square|portrait|wide).
// Scenes are framed face-safe: the sample crops in main.js (defaultCrops)
// keep faces in frame, so screenshots show the subject, not a cropped-out top.
// window.__shotReady is set once the scene has painted (double rAF).
import { SIZES } from './cover.js';

export async function runShot(shot, query, api) {
  const { loadSample, setPanelImage, st, redraw, sizeForPreview, exportSize } = api;
  const photo = query.get('photo') ?? 'pier';
  const caption = query.get('caption');
  const layout = query.get('layout');
  const grade = query.get('grade');
  const size = query.get('size');

  if (caption) { st.title = caption; document.getElementById('title').value = caption; }
  if (layout) { st.layout = layout; document.getElementById('layout').value = layout; }
  if (grade) {
    st.grade = grade;
    document.querySelectorAll('#grades button').forEach((b) => b.classList.toggle('active', b.dataset.grade === grade));
  }
  if (size && SIZES[size]) { st.size = size; document.getElementById('size').value = size; }

  sizeForPreview();
  if (shot === 'cover') document.body.classList.add('shot-cover');

  // Wait for the display fonts so the lettering paints in Anton/Pacifico.
  try {
    await Promise.race([
      document.fonts.load('16px Anton'),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
    await Promise.race([
      document.fonts.load('16px Pacifico'),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch { /* fall back to system fonts */ }

  await loadSample(photo);
  if (shot === 'export-test') {
    const bytes = await exportSize('square');
    window.__exportBytes = bytes;
    document.title = `export-bytes:${bytes}`;
  }
  redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
    document.body.setAttribute('data-shot-ready', 'true');
  }));
}
