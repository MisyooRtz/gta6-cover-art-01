// Vice Sunset Cover Studio — the cover engine.
//
// Draws a multi-panel GTA-style cover onto a canvas: panel photos with a
// per-panel "look-up" crop, one of four colour grades, grain and vignette,
// then a badge ribbon, a big condensed title and a script subtitle across
// the foot of the cover. Pure canvas 2D, no network, no library.
//
// The crop model: every panel shows one photo through a window. The window
// is described by a centre point (cx, cy) in photo fractions and a zoom.
// `oy` is the look-up of the default window: how far up the photo the crop
// looks. A portrait photo keeps its face near the top, so a short wide
// panel must look high up the photo to catch the face at all — its default
// cy is (1 - oy). The window is clamped so the photo always covers the
// whole panel; a panel can never go empty, whatever the user drags.

export const COVER_SIZES = {
  square: { w: 1080, h: 1080, label: '1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 × 1350' },
  wide: { w: 1920, h: 1080, label: '1920 × 1080' },
};

export const LAYOUTS = {
  quad: { name: 'Quad Grid', hint: 'Four equal panels' },
  hero: { name: 'Hero + Side Strip', hint: 'One hero, three sides' },
  bleed: { name: 'Full Bleed', hint: 'One photo, three snapshots' },
  collage: { name: 'Snapshot Collage', hint: 'Four tilted snapshots' },
};

export const GRADES = {
  sunset: {
    name: 'Vice Sunset',
    filter: 'saturate(1.38) contrast(1.12) brightness(1.04) sepia(0.16)',
    overlay: ['rgba(255, 94, 98, 0.20)', 'rgba(255, 150, 60, 0.22)', 'rgba(120, 30, 140, 0.16)'],
    blend: 'soft-light',
    grain: 0.10,
    vignette: 0.34,
    titleFrom: '#ffe9a8',
    titleTo: '#ff7a3d',
    titleStroke: '#2a0a2e',
    accent: '#ff5e62',
    scrim: 'rgba(20, 4, 28, 0.88)',
  },
  neon: {
    name: 'Neon Night',
    filter: 'saturate(1.55) contrast(1.22) brightness(0.96) hue-rotate(-14deg)',
    overlay: ['rgba(0, 240, 255, 0.16)', 'rgba(190, 60, 255, 0.20)', 'rgba(255, 0, 128, 0.10)'],
    blend: 'screen',
    grain: 0.12,
    vignette: 0.42,
    titleFrom: '#aef7ff',
    titleTo: '#ff5ad2',
    titleStroke: '#0a0618',
    accent: '#00e5ff',
    scrim: 'rgba(4, 6, 26, 0.88)',
  },
  dusk: {
    name: 'Palm Dusk',
    filter: 'saturate(1.22) contrast(1.06) brightness(1.01) sepia(0.30)',
    overlay: ['rgba(255, 190, 90, 0.20)', 'rgba(200, 90, 40, 0.14)', 'rgba(60, 20, 60, 0.14)'],
    blend: 'soft-light',
    grain: 0.09,
    vignette: 0.30,
    titleFrom: '#fff3c4',
    titleTo: '#e8a04c',
    titleStroke: '#241207',
    accent: '#ffb347',
    scrim: 'rgba(26, 10, 4, 0.88)',
  },
  noir: {
    name: 'Noir',
    filter: 'grayscale(1) contrast(1.28) brightness(1.06)',
    overlay: ['rgba(255, 255, 255, 0.08)', 'rgba(0, 0, 0, 0.12)', 'rgba(255, 255, 255, 0.05)'],
    blend: 'overlay',
    grain: 0.17,
    vignette: 0.46,
    titleFrom: '#ffffff',
    titleTo: '#c9c9c9',
    titleStroke: '#000000',
    accent: '#f5f5f5',
    scrim: 'rgba(0, 0, 0, 0.88)',
  },
};

/** The title band: the foot of the cover where ribbon, title and subtitle live. */
export function titleBand(h) {
  return { y: h * 0.78, h: h * 0.22 };
}

/**
 * Panel geometry for a layout in a cover of w x h. Each panel carries its
 * default look-up `oy`, its slot role (hero / side / bottom / snap) and an
 * optional tilt in degrees. Slots are listed in draw order.
 */
export function layoutPanels(layout, w, h) {
  const gap = Math.round(Math.min(w, h) * 0.011);
  const margin = Math.round(Math.min(w, h) * 0.013);
  const band = titleBand(h);
  if (layout === 'quad') {
    const cw = (w - margin * 2 - gap) / 2;
    const ch = (h - margin * 2 - gap) / 2;
    return [
      { id: 'p0', role: 'hero', x: margin, y: margin, w: cw, h: ch, rot: 0, oy: 0.45 },
      { id: 'p1', role: 'side', x: margin + cw + gap, y: margin, w: cw, h: ch, rot: 0, oy: 0.72 },
      { id: 'p2', role: 'side', x: margin, y: margin + ch + gap, w: cw, h: ch, rot: 0, oy: 0.75 },
      { id: 'p3', role: 'bottom', x: margin + cw + gap, y: margin + ch + gap, w: cw, h: ch, rot: 0, oy: 0.6 },
    ];
  }
  if (layout === 'hero') {
    const heroW = (w - margin * 2 - gap) * 0.62;
    const sideX = margin + heroW + gap;
    const sideW = w - sideX - margin;
    const sideH = (h - margin * 2 - gap * 2) / 3;
    return [
      { id: 'p0', role: 'hero', x: margin, y: margin, w: heroW, h: h - margin * 2, rot: 0, oy: 0.45 },
      { id: 'p1', role: 'side', x: sideX, y: margin, w: sideW, h: sideH, rot: 0, oy: 0.72 },
      { id: 'p2', role: 'side', x: sideX, y: margin + sideH + gap, w: sideW, h: sideH, rot: 0, oy: 0.75 },
      { id: 'p3', role: 'bottom', x: sideX, y: margin + (sideH + gap) * 2, w: sideW, h: sideH, rot: 0, oy: 0.6 },
    ];
  }
  if (layout === 'bleed') {
    const snapW = w * 0.27;
    const snapH = h * 0.185;
    const snapY = band.y - snapH - Math.round(h * 0.02);
    return [
      { id: 'p0', role: 'hero', x: 0, y: 0, w, h, rot: 0, oy: 0.45 },
      { id: 'p1', role: 'snap', x: w * 0.045, y: snapY, w: snapW, h: snapH, rot: -3.5, oy: 0.72 },
      { id: 'p2', role: 'snap', x: w * 0.365, y: snapY - h * 0.012, w: snapW, h: snapH, rot: 2.5, oy: 0.75 },
      { id: 'p3', role: 'snap', x: w * 0.685, y: snapY, w: snapW, h: snapH, rot: -2, oy: 0.6 },
    ];
  }
  // collage: four tilted polaroids on a coloured field.
  const cw = w * 0.44;
  const ch = h * 0.335;
  return [
    { id: 'p0', role: 'snap', x: w * 0.045, y: h * 0.03, w: cw, h: ch, rot: -4, oy: 0.45 },
    { id: 'p1', role: 'snap', x: w * 0.515, y: h * 0.055, w: cw, h: ch, rot: 3, oy: 0.72 },
    { id: 'p2', role: 'snap', x: w * 0.06, y: h * 0.40, w: cw, h: ch, rot: 2.5, oy: 0.75 },
    { id: 'p3', role: 'snap', x: w * 0.50, y: h * 0.425, w: cw, h: ch, rot: -3, oy: 0.6 },
  ];
}

// ---------------------------------------------------------------------------
// Crop math
// ---------------------------------------------------------------------------

/** Default crop centre for a panel slot: centred horizontally, looked up by oy. */
export function defaultCrop(panel) {
  return { cx: 0.5, cy: 1 - panel.oy, zoom: 1, mode: 'fill' };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Where a photo lands inside a panel. Returns the drawImage destination rect
 * (dx, dy, dw, dh). The photo point (cx, cy) sits at the panel centre; the
 * rect is clamped so the photo always covers the panel — when the photo is
 * smaller than the panel on an axis it is centred on that axis instead.
 */
export function cropRect(panel, img, crop) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = crop.mode === 'fit'
    ? Math.min(panel.w / iw, panel.h / ih)
    : Math.max(panel.w / iw, panel.h / ih);
  const scale = base * Math.max(1, crop.zoom);
  const dw = iw * scale;
  const dh = ih * scale;
  let dx = panel.x + panel.w / 2 - crop.cx * dw;
  let dy = panel.y + panel.h / 2 - crop.cy * dh;
  dx = dw <= panel.w ? panel.x + (panel.w - dw) / 2 : clamp(dx, panel.x + panel.w - dw, panel.x);
  dy = dh <= panel.h ? panel.y + (panel.h - dh) / 2 : clamp(dy, panel.y + panel.h - dh, panel.y);
  return { dx, dy, dw, dh };
}

/** The crop centre that a drag ending at (dx, dy) implies, clamped to the photo. */
export function cropFromRect(panel, img, rect) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const cx = clamp((panel.x + panel.w / 2 - rect.dx) / rect.dw, 0, 1);
  const cy = clamp((panel.y + panel.h / 2 - rect.dy) / rect.dh, 0, 1);
  return { cx, cy };
}

// ---------------------------------------------------------------------------
// Grain (deterministic: one seeded noise tile, reused for every cover)
// ---------------------------------------------------------------------------

let noiseTile = null;
function grainTile() {
  if (noiseTile) return noiseTile;
  const size = 128;
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const tctx = tile.getContext('2d');
  const data = tctx.createImageData(size, size);
  let seed = 20261119;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(next() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  tctx.putImageData(data, 0, 0);
  noiseTile = tile;
  return tile;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function drawPhotoPanel(ctx, panel, img, crop, grade, compare) {
  const rect = cropRect(panel, img, crop);
  ctx.save();
  ctx.beginPath();
  ctx.rect(panel.x, panel.y, panel.w, panel.h);
  ctx.clip();
  if (crop.mode === 'fit') {
    ctx.fillStyle = '#160a1c';
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  }
  if (!compare) ctx.filter = grade.filter;
  ctx.drawImage(img, rect.dx, rect.dy, rect.dw, rect.dh);
  ctx.filter = 'none';
  if (!compare) {
    const overlay = ctx.createLinearGradient(panel.x, panel.y, panel.x + panel.w, panel.y + panel.h);
    overlay.addColorStop(0, grade.overlay[0]);
    overlay.addColorStop(0.55, grade.overlay[1]);
    overlay.addColorStop(1, grade.overlay[2]);
    ctx.globalCompositeOperation = grade.blend;
    ctx.fillStyle = overlay;
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

/**
 * Polaroid-style frame for tilted snapshot panels, drawn in the caller's
 * current transform at the panel's own (possibly already rotated) coords:
 * a white border with a soft drop shadow around the photo.
 */
function drawSnapFrame(ctx, panel, w, h) {
  const pad = Math.round(Math.min(panel.w, panel.h) * 0.045);
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = Math.round(Math.min(w, h) * 0.02);
  ctx.shadowOffsetY = Math.round(Math.min(w, h) * 0.008);
  ctx.fillStyle = '#fdf8ef';
  ctx.fillRect(panel.x - pad, panel.y - pad, panel.w + pad * 2, panel.h + pad * 2);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = Math.max(2, Math.round(Math.min(w, h) * 0.004));
  ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
  ctx.restore();
}

function drawPanel(ctx, panel, img, crop, grade, compare, w, h) {
  ctx.save();
  if (panel.rot) {
    ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
    ctx.rotate((panel.rot * Math.PI) / 180);
    ctx.translate(-panel.w / 2, -panel.h / 2);
    panel = { ...panel, x: 0, y: 0 };
  }
  if (panel.role === 'snap') drawSnapFrame(ctx, panel, w, h);
  if (img) {
    drawPhotoPanel(ctx, panel, img, crop, grade, compare);
  } else {
    ctx.fillStyle = '#3a1c44';
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = `600 ${Math.round(Math.min(panel.w, panel.h) * 0.09)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Drop a photo here', panel.x + panel.w / 2, panel.y + panel.h / 2);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}

function drawGrainAndVignette(ctx, w, h, grade) {
  const tile = grainTile();
  const pattern = ctx.createPattern(tile, 'repeat');
  ctx.save();
  ctx.globalAlpha = grade.grain;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  const vig = ctx.createRadialGradient(
    w / 2, h * 0.45, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.78,
  );
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, `rgba(0, 0, 0, ${grade.vignette})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

function fitFont(ctx, text, fontFamily, weight, startSize, maxWidth) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${fontFamily}`;
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${fontFamily}`;
  }
  return size;
}

function drawTitleBlock(ctx, w, h, grade, title, subtitle, badge) {
  const band = titleBand(h);
  // Scrim so the letters read over any photo.
  const scrim = ctx.createLinearGradient(0, band.y - h * 0.06, 0, h);
  scrim.addColorStop(0, 'rgba(0, 0, 0, 0)');
  scrim.addColorStop(0.45, grade.scrim.replace(/[\d.]+\)$/, '0.55)'));
  scrim.addColorStop(1, grade.scrim);
  ctx.fillStyle = scrim;
  ctx.fillRect(0, band.y - h * 0.06, w, h - band.y + h * 0.06);

  const cx = w / 2;
  // Title baseline first: the badge ribbon is then placed ABOVE it, its
  // bottom clear of the title's cap height, so the two can never collide.
  const text = (title || '').trim().toUpperCase() || 'VICE SUNSET';
  const titleSize = fitFont(ctx, text, 'Anton, "Arial Narrow", sans-serif', 400, Math.round(h * 0.105), w * 0.92);
  const titleY = band.y + band.h * 0.62;
  const badgeText = (badge || '').trim().toUpperCase();
  if (badgeText) {
    const badgeSize = Math.round(h * 0.026);
    ctx.font = `700 ${badgeSize}px system-ui, sans-serif`;
    const tw = ctx.measureText(`★ ${badgeText} ★`).width;
    const bw = tw + badgeSize * 1.6;
    const bh = badgeSize * 1.9;
    const bx = cx - bw / 2;
    const by = titleY - titleSize * 0.85 - 6 - bh;
    ctx.save();
    ctx.fillStyle = grade.accent;
    ctx.beginPath();
    ctx.moveTo(bx + bh / 2, by);
    ctx.lineTo(bx + bw - bh / 2, by);
    ctx.lineTo(bx + bw, by + bh / 2);
    ctx.lineTo(bx + bw - bh / 2, by + bh);
    ctx.lineTo(bx + bh / 2, by + bh);
    ctx.lineTo(bx, by + bh / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = grade.titleStroke;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`★ ${badgeText} ★`, cx, by + bh / 2 + 1);
    ctx.restore();
  }

  const grad = ctx.createLinearGradient(0, titleY - titleSize, 0, titleY + titleSize * 0.2);
  grad.addColorStop(0, grade.titleFrom);
  grad.addColorStop(1, grade.titleTo);
  ctx.save();
  ctx.font = `400 ${titleSize}px Anton, "Arial Narrow", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = Math.round(titleSize * 0.16);
  ctx.shadowOffsetY = Math.round(titleSize * 0.05);
  ctx.strokeStyle = grade.titleStroke;
  ctx.lineWidth = Math.max(2, Math.round(titleSize * 0.055));
  ctx.strokeText(text, cx, titleY);
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, titleY);
  ctx.restore();

  const sub = (subtitle || '').trim();
  if (sub) {
    const subSize = fitFont(ctx, sub, 'Pacifico, cursive', 400, Math.round(h * 0.042), w * 0.8);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = Math.round(subSize * 0.3);
    ctx.fillText(sub, cx, titleY + subSize * 1.7);
    ctx.restore();
  }
}

/**
 * Draws the whole cover. `state` is { layout, grade, title, subtitle, badge,
 * panels: [{ photo, crop }] } where photo is an image or null and crop is
 * { cx, cy, zoom, mode }. `compare` draws the photos without the grade.
 */
export function drawCover(canvas, state, compare = false) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  ctx.clearRect(0, 0, w, h);
  if (state.layout === 'collage') {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#2b0f3a');
    bg.addColorStop(1, '#12041f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  } else if (state.layout === 'bleed') {
    ctx.fillStyle = '#1c0a24';
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = '#12041a';
    ctx.fillRect(0, 0, w, h);
  }
  const panels = layoutPanels(state.layout, w, h);
  panels.forEach((panel, i) => {
    const slot = state.panels[i] ?? {};
    const crop = slot.crop ?? defaultCrop(panel);
    drawPanel(ctx, panel, slot.photo ?? null, crop, grade, compare, w, h);
  });
  if (!compare) drawGrainAndVignette(ctx, w, h, grade);
  drawTitleBlock(ctx, w, h, grade, state.title, state.subtitle, state.badge);
}
