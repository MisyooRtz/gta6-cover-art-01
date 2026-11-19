// Vice Sunset Cover Studio — cover rendering engine.
//
// One draw path serves the live preview and the full-resolution export:
// given a canvas, the panel photos with their crops, a layout, a grade and
// the title words, it paints the panels, the grade, grain, vignette and
// type. Nothing here touches the network or the page; the editor in
// main.js owns all input, and shots.js owns the screenshot scenes.
//
// A panel crop is { zoom, ox, oy, fit }: zoom multiplies the base scale,
// (ox, oy) is how far up the photo the crop looks — 0 shows the bottom
// of the photo, 1 the top — so a larger oy frames higher up: the side
// panels use 0.72/0.75 to keep a full face in frame while the hero sits
// slightly high at 0.45. fit is 'fill' (cover the panel, crop the
// overflow) or 'fit' (whole photo, letterbox).

export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    filter: 'saturate(1.35) contrast(1.08) brightness(1.04)',
    top: 'rgba(255, 190, 90, 0.10)',
    bottom: 'rgba(214, 48, 120, 0.38)',
    blend: 'overlay',
    grain: 0.05,
  },
  neon: {
    label: 'Neon Night',
    filter: 'saturate(1.55) contrast(1.12) brightness(0.98) hue-rotate(-8deg)',
    top: 'rgba(64, 224, 255, 0.12)',
    bottom: 'rgba(255, 0, 128, 0.42)',
    blend: 'overlay',
    grain: 0.07,
  },
  dusk: {
    label: 'Palm Dusk',
    filter: 'saturate(1.12) contrast(1.05) brightness(0.94)',
    top: 'rgba(120, 90, 220, 0.14)',
    bottom: 'rgba(20, 60, 90, 0.40)',
    blend: 'soft-light',
    grain: 0.05,
  },
  noir: {
    label: 'Noir',
    filter: 'grayscale(1) contrast(1.18) brightness(0.96)',
    top: 'rgba(220, 220, 220, 0.08)',
    bottom: 'rgba(0, 0, 0, 0.34)',
    blend: 'overlay',
    grain: 0.09,
  },
};

// Panel counts: quad 4, hero 3, bleed 1, collage 3. Rects are fractions of
// the canvas (x, y, w, h) so one layout works at any export size.
export const LAYOUTS = {
  quad: {
    label: 'Quad Grid',
    panels: 4,
    tilt: [0, 0, 0, 0],
    rects: [
      [0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5],
      [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5],
    ],
    titleZone: [0, 0.74, 1, 0.26],
  },
  hero: {
    label: 'Hero + Side Strip',
    panels: 3,
    tilt: [0, 0, 0],
    rects: [
      [0, 0, 0.62, 1],
      [0.62, 0, 0.38, 0.5],
      [0.62, 0.5, 0.38, 0.5],
    ],
    titleZone: [0, 0.74, 1, 0.26],
  },
  bleed: {
    label: 'Full Bleed',
    panels: 1,
    tilt: [0],
    rects: [[0, 0, 1, 1]],
    titleZone: [0, 0.68, 1, 0.32],
  },
  collage: {
    label: 'Snapshot Collage',
    panels: 3,
    tilt: [-0.06, 0.05, -0.03],
    rects: [
      [0.06, 0.05, 0.42, 0.56],
      [0.52, 0.10, 0.42, 0.56],
      [0.28, 0.48, 0.46, 0.48],
    ],
    titleZone: [0, 0.82, 1, 0.18],
  },
};

// Framing that keeps faces in shot for the bundled samples: the hero crop
// sits slightly high, the side strips look further up the photo so a full
// face shows, and the bottom wide panel keeps hat, eyes and nose above
// the title band instead of cropping to chin and mouth.
export function defaultCrops(layout) {
  const byLayout = {
    quad: [
      { zoom: 1, ox: 0.5, oy: 0.45, fit: 'fill' },
      { zoom: 1, ox: 0.5, oy: 0.72, fit: 'fill' },
      { zoom: 1, ox: 0.5, oy: 0.75, fit: 'fill' },
      { zoom: 1, ox: 0.5, oy: 0.6, fit: 'fill' },
    ],
    hero: [
      { zoom: 1, ox: 0.5, oy: 0.45, fit: 'fill' },
      { zoom: 1, ox: 0.5, oy: 0.72, fit: 'fill' },
      { zoom: 1, ox: 0.5, oy: 0.75, fit: 'fill' },
    ],
    bleed: [{ zoom: 1, ox: 0.5, oy: 0.45, fit: 'fill' }],
    collage: [
      { zoom: 1, ox: 0.5, oy: 0.45, fit: 'fill' },
      { zoom: 1, ox: 0.5, oy: 0.72, fit: 'fill' },
      { zoom: 1, ox: 0.5, oy: 0.6, fit: 'fill' },
    ],
  };
  return (byLayout[layout] ?? byLayout.quad).map((c) => ({ ...c }));
}

export function panelCount(layout) {
  return (LAYOUTS[layout] ?? LAYOUTS.quad).panels;
}

// Absolute pixel rects for a layout on a canvas of w x h, with a gutter
// between panels (gutter scales with the canvas so exports match preview).
export function panelRects(layout, w, h) {
  const def = LAYOUTS[layout] ?? LAYOUTS.quad;
  const g = Math.max(2, Math.round(Math.min(w, h) * 0.008));
  return def.rects.map(([fx, fy, fw, fh]) => ({
    x: Math.round(fx * w) + (fx > 0 ? g / 2 : 0),
    y: Math.round(fy * h) + (fy > 0 ? g / 2 : 0),
    w: Math.round(fw * w) - (fx > 0 ? g / 2 : 0) - (fx + fw < 1 ? g / 2 : 0),
    h: Math.round(fh * h) - (fy > 0 ? g / 2 : 0) - (fy + fh < 1 ? g / 2 : 0),
  }));
}

// A small deterministic noise tile, built once and stamped as a pattern so
// the grain is identical on every export of the same size.
let noiseTile = null;
function grainPattern(ctx) {
  if (noiseTile) return noiseTile;
  const tile = document.createElement('canvas');
  tile.width = 128;
  tile.height = 128;
  const tctx = tile.getContext('2d');
  const data = tctx.createImageData(128, 128);
  let seed = 1234567;
  for (let i = 0; i < data.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const v = seed % 256;
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  tctx.putImageData(data, 0, 0);
  noiseTile = ctx.createPattern(tile, 'repeat');
  return noiseTile;
}

// Paints one photo into one panel rect honouring its crop. Fill scales to
// cover and clamps the pan so no gap opens at the edges; fit scales to
// show the whole photo and centres it on the panel background.
export function drawPanel(ctx, photo, rect, crop, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.fillStyle = '#241530';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  if (!photo) {
    // Empty panel: a faint hint so the editor shows which panels still
    // need a photo instead of a flat dark rectangle.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y);
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
    ctx.moveTo(rect.x + rect.w, rect.y);
    ctx.lineTo(rect.x, rect.y + rect.h);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = `600 ${Math.max(11, Math.round(Math.min(rect.w, rect.h) * 0.06))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NO PHOTO YET', rect.x + rect.w / 2, rect.y + rect.h / 2);
  }
  if (photo) {
    const iw = photo.naturalWidth;
    const ih = photo.naturalHeight;
    const base = crop.fit === 'fit'
      ? Math.min(rect.w / iw, rect.h / ih)
      : Math.max(rect.w / iw, rect.h / ih);
    const s = base * (crop.zoom || 1);
    const dw = iw * s;
    const dh = ih * s;
    // Look-up crop: oy 1 shows the top of the photo, oy 0 the bottom.
    // A larger oy therefore frames higher up — that is why the side
    // panels use 0.72/0.75 to keep a full face in frame while the hero
    // sits slightly high at 0.45.
    let dx = rect.x + (rect.w - dw) / 2;
    let dy = rect.y + (rect.h - dh) / 2;
    if (crop.fit !== 'fit') {
      dx = dw > rect.w ? rect.x - (dw - rect.w) * (1 - (crop.ox ?? 0.5)) : rect.x + (rect.w - dw) / 2;
      dy = dh > rect.h ? rect.y - (dh - rect.h) * (1 - (crop.oy ?? 0.5)) : rect.y + (rect.h - dh) / 2;
    }
    ctx.filter = grade?.filter ?? 'none';
    ctx.drawImage(photo, dx, dy, dw, dh);
    ctx.filter = 'none';
  }
  ctx.restore();
}

function fitFont(ctx, text, family, weight, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 12 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

// The title block: gradient-filled condensed capitals with a dark outline
// and a drop shadow, the script subtitle under it, and a small badge
// ribbon. Drawn inside the layout's title zone over a darkening band so
// the words stay readable over any photo.
function drawTitle(ctx, w, h, zone, title, subtitle, badge) {
  const [zx, zy, zw, zh] = zone;
  const bx = zx * w;
  const by = zy * h;
  const bw = zw * w;
  const bh = zh * h;
  const band = ctx.createLinearGradient(0, by - bh * 0.4, 0, by + bh);
  band.addColorStop(0, 'rgba(10, 4, 20, 0)');
  band.addColorStop(0.45, 'rgba(10, 4, 20, 0.55)');
  band.addColorStop(1, 'rgba(10, 4, 20, 0.88)');
  ctx.fillStyle = band;
  ctx.fillRect(bx, by - bh * 0.4, bw, bh * 1.4);

  const words = (title || '').trim().toUpperCase();
  if (words) {
    const size = fitFont(ctx, words, 'Anton, "Arial Narrow", sans-serif', 400, bw * 0.92, bh * 0.52);
    const grad = ctx.createLinearGradient(0, by + bh * 0.08, 0, by + bh * 0.62);
    grad.addColorStop(0, '#fff7d6');
    grad.addColorStop(0.55, '#ffd76a');
    grad.addColorStop(1, '#ff5e8a');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#160a24';
    ctx.lineWidth = Math.max(2, size * 0.07);
    ctx.shadowColor = 'rgba(255, 60, 140, 0.55)';
    ctx.shadowBlur = size * 0.16;
    ctx.shadowOffsetY = size * 0.04;
    const ty = by + bh * 0.34;
    ctx.strokeText(words, bx + bw / 2, ty);
    ctx.fillStyle = grad;
    ctx.fillText(words, bx + bw / 2, ty);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  const sub = (subtitle || '').trim();
  if (sub) {
    const size = fitFont(ctx, sub, 'Pacifico, cursive', 400, bw * 0.7, bh * 0.24);
    ctx.font = `${size}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe9f3';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = size * 0.2;
    ctx.fillText(sub, bx + bw / 2, by + bh * 0.72);
    ctx.shadowBlur = 0;
  }

  const tag = (badge || '').trim().toUpperCase();
  if (tag) {
    const size = Math.max(11, Math.round(bh * 0.13));
    ctx.font = `700 ${size}px system-ui, sans-serif`;
    const tw = ctx.measureText(tag).width + size * 1.6;
    // The badge floats just above the title, on the photo, so it never
    // covers the first letter of a wide title.
    const rx = bx + bw * 0.04;
    const ry = by - bh * 0.22;
    ctx.save();
    ctx.translate(rx + tw / 2, ry + size * 0.8);
    ctx.rotate(-0.05);
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath();
    ctx.roundRect(-tw / 2, -size * 0.8, tw, size * 1.6, size * 0.8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tag, 0, 1);
    ctx.restore();
  }
}

// The single shared draw: panels, grade wash, grain, vignette, title.
// opts.compare skips the grade, grain and vignette so the editor's
// hold-to-compare button shows the raw photos underneath.
export function drawCover(canvas, state, opts = {}) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const layout = LAYOUTS[state.layout] ?? LAYOUTS.quad;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const compare = !!opts.compare;
  // Defensive clamp: a malformed crop (from a hand-edited state or a bad
  // query param) must never paint a photo outside its panel.
  for (const crop of state.crops ?? []) {
    crop.zoom = Math.min(4, Math.max(0.5, crop.zoom || 1));
    crop.ox = Math.min(1, Math.max(0, crop.ox ?? 0.5));
    crop.oy = Math.min(1, Math.max(0, crop.oy ?? 0.5));
  }

  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#1b0f2a';
  ctx.fillRect(0, 0, w, h);

  const rects = panelRects(state.layout, w, h);
  const count = layout.panels;
  if (state.layout === 'collage') {
    ctx.fillStyle = '#f4ead9';
    ctx.fillRect(0, 0, w, h);
  }
  for (let i = 0; i < count; i += 1) {
    const rect = rects[i];
    const crop = state.crops[i] ?? { zoom: 1, ox: 0.5, oy: 0.5, fit: 'fill' };
    const photo = state.photos[i] ?? null;
    if (state.layout === 'collage') {
      ctx.save();
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(layout.tilt[i] ?? 0);
      const border = Math.round(Math.min(w, h) * 0.012);
      ctx.fillStyle = '#fdf8ef';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = Math.round(Math.min(w, h) * 0.02);
      ctx.shadowOffsetY = Math.round(Math.min(w, h) * 0.006);
      ctx.fillRect(-rect.w / 2 - border, -rect.h / 2 - border, rect.w + border * 2, rect.h + border * 2);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      drawPanel(ctx, photo, { x: -rect.w / 2, y: -rect.h / 2, w: rect.w, h: rect.h }, crop, compare ? null : grade);
      ctx.restore();
    } else {
      drawPanel(ctx, photo, rect, crop, compare ? null : grade);
    }
  }

  if (!compare) {
    const wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, grade.top);
    wash.addColorStop(1, grade.bottom);
    ctx.globalCompositeOperation = grade.blend;
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    const pattern = grainPattern(ctx);
    if (pattern) {
      ctx.save();
      ctx.globalAlpha = grade.grain;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.32)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  drawTitle(ctx, w, h, layout.titleZone, state.title, state.subtitle, state.badge);
  ctx.restore();
}

// Full-resolution export on an offscreen canvas, through the same draw
// path as the preview so what you see is what the file holds.
export function exportCover(state, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  drawCover(canvas, state);
  return canvas;
}

export const EXPORT_SIZES = [
  { label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  { label: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  { label: 'Wide 1920 x 1080', w: 1920, h: 1080 },
];
