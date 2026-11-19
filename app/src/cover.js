// Vice Sunset Cover Studio — the cover engine.
//
// Draws a multi-panel poster cover onto any 2D canvas context, at any size.
// The same function paints the live preview and the full-resolution export,
// so what you see is exactly what the PNG holds. All lettering uses fonts
// vendored under app/fonts (Anton + Pacifico, SIL Open Font License).

export const LAYOUTS = [
  { id: 'quad', label: 'Quad grid', hint: 'Big hero + 3 panels' },
  { id: 'strip', label: 'Hero + strip', hint: 'Hero + 3 vertical panels' },
  { id: 'full', label: 'Full bleed', hint: 'One photo, title block' },
  { id: 'tilt', label: 'Snapshot collage', hint: 'Tilted snapshots' },
];

export const GRADES = [
  { id: 'sunset', label: 'Vice Sunset', hint: 'Orange-pink golden hour' },
  { id: 'neon', label: 'Neon Night', hint: 'Magenta + teal after dark' },
  { id: 'dusk', label: 'Palm Dusk', hint: 'Purple + gold evening' },
  { id: 'noir', label: 'Noir', hint: 'Black & white, high contrast' },
];

export const EXPORT_SIZES = [
  { id: 'square', label: '1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: '1080 × 1350', w: 1080, h: 1350 },
  { id: 'wide', label: '1920 × 1080', w: 1920, h: 1080 },
];

// Per-grade look: a CSS filter applied while the photos are drawn, then
// colour overlays blended over the whole cover.
const GRADE_STYLE = {
  sunset: {
    filter: 'saturate(1.35) contrast(1.08) brightness(1.03)',
    overlays: [
      { blend: 'overlay', stops: [[0, 'rgba(255,122,26,0.34)'], [0.55, 'rgba(255,80,120,0.20)'], [1, 'rgba(120,40,160,0.30)']] },
      { blend: 'soft-light', stops: [[0, 'rgba(255,200,90,0.25)'], [1, 'rgba(255,60,140,0.10)']] },
    ],
    sky: ['#ff9a3d', '#ff5e7a', '#7b2f8e'],
  },
  neon: {
    filter: 'saturate(1.5) contrast(1.12) brightness(0.98)',
    overlays: [
      { blend: 'overlay', stops: [[0, 'rgba(255,0,170,0.30)'], [0.5, 'rgba(120,0,200,0.22)'], [1, 'rgba(0,220,255,0.28)']] },
      { blend: 'screen', stops: [[0, 'rgba(255,0,200,0.10)'], [1, 'rgba(0,180,255,0.14)']] },
    ],
    sky: ['#ff2ea6', '#7a1fa2', '#0b2a4a'],
  },
  dusk: {
    filter: 'saturate(1.3) contrast(1.06) brightness(1.0)',
    overlays: [
      { blend: 'overlay', stops: [[0, 'rgba(150,80,255,0.28)'], [0.6, 'rgba(255,170,60,0.16)'], [1, 'rgba(60,20,90,0.30)']] },
      { blend: 'soft-light', stops: [[0, 'rgba(255,210,120,0.20)'], [1, 'rgba(120,60,200,0.12)']] },
    ],
    sky: ['#b06cff', '#ff9e4f', '#2a1150'],
  },
  noir: {
    filter: 'grayscale(1) contrast(1.25) brightness(1.02)',
    overlays: [
      { blend: 'overlay', stops: [[0, 'rgba(255,255,255,0.10)'], [1, 'rgba(0,0,0,0.28)']] },
    ],
    sky: ['#e8e8e8', '#8a8a8a', '#161616'],
  },
};

// Panel rectangles, as fractions of the cover, for each layout. The title
// band occupies the bottom of the cover; `panels` sit above it (except in
// full-bleed, where the single photo runs under the title block).
export function layoutGeometry(layout, w, h) {
  const bandH = layout === 'full' ? h * 0.30 : h * 0.235;
  const area = { x: 0, y: 0, w, h: h - bandH };
  const g = Math.max(6, w * 0.008); // white gutter between panels
  const P = [];
  if (layout === 'quad') {
    const heroW = area.w * 0.62;
    P.push({ x: area.x, y: area.y, w: heroW - g, h: area.h });
    const colX = area.x + heroW + g;
    const colW = area.w - heroW - g;
    const sh = (area.h - 2 * g) / 3;
    for (let i = 0; i < 3; i++) P.push({ x: colX, y: area.y + i * (sh + g), w: colW, h: sh });
  } else if (layout === 'strip') {
    const heroW = area.w * 0.58;
    P.push({ x: area.x, y: area.y, w: heroW - g, h: area.h });
    const sx = area.x + heroW + g;
    const sw = (area.w - heroW - 3 * g) / 3;
    for (let i = 0; i < 3; i++) P.push({ x: sx + i * (sw + g), y: area.y, w: sw, h: area.h });
  } else if (layout === 'full') {
    P.push({ x: 0, y: 0, w, h });
  } else {
    // Tilted snapshots: four overlapping prints on a sunset backdrop.
    const pw = area.w * 0.46, ph = area.h * 0.52;
    P.push({ x: area.w * 0.03, y: area.h * 0.04, w: pw, h: ph, rot: -0.055 });
    P.push({ x: area.w * 0.51, y: area.h * 0.02, w: pw, h: ph, rot: 0.045 });
    P.push({ x: area.w * 0.07, y: area.h * 0.46, w: pw, h: ph, rot: 0.04 });
    P.push({ x: area.w * 0.50, y: area.h * 0.47, w: pw, h: ph, rot: -0.05 });
  }
  return { band: { x: 0, y: h - bandH, w, h: bandH }, panels: P, area, gutter: g };
}

function drawPhotoInto(ctx, img, rect, panel) {
  if (!img || !img.naturalWidth) return false;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const zoom = panel.zoom || 1;
  let dw, dh;
  if (panel.fit === 'fit') {
    const s = Math.min(rect.w / iw, rect.h / ih) * zoom;
    dw = iw * s; dh = ih * s;
  } else {
    const s = Math.max(rect.w / iw, rect.h / ih) * zoom;
    dw = iw * s; dh = ih * s;
  }
  let cx = rect.x + rect.w / 2 + (panel.ox || 0) * rect.w * 0.45;
  let cy = rect.y + rect.h / 2 + (panel.oy || 0) * rect.h * 0.45;
  if (panel.fit !== 'fit') {
    // Fill mode must always cover the panel: clamp the pan so no backdrop
    // ever shows through at an edge (this also bounds dragging).
    cx = Math.max(rect.x + rect.w - dw / 2, Math.min(rect.x + dw / 2, cx));
    cy = Math.max(rect.y + rect.h - dh / 2, Math.min(rect.y + dh / 2, cy));
  }
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  return true;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

let grainTile = null;
function grainPattern(ctx) {
  if (grainTile) return grainTile;
  const t = document.createElement('canvas');
  t.width = 140; t.height = 140;
  const c = t.getContext('2d');
  const data = c.createImageData(140, 140);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 100 + Math.floor(Math.random() * 110);
    data.data[i] = v; data.data[i + 1] = v; data.data[i + 2] = v; data.data[i + 3] = 255;
  }
  c.putImageData(data, 0, 0);
  grainTile = ctx.createPattern(t, 'repeat');
  return grainTile;
}

function paintGradeOverlays(ctx, w, h, grade, strength) {
  const style = GRADE_STYLE[grade] || GRADE_STYLE.sunset;
  for (const ov of style.overlays) {
    const grad = ctx.createLinearGradient(0, 0, w * 0.25, h);
    for (const [stop, color] of ov.stops) grad.addColorStop(stop, color);
    ctx.save();
    ctx.globalCompositeOperation = ov.blend;
    ctx.globalAlpha = strength;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

function paintSunDisc(ctx, x, y, r, grade) {
  const style = GRADE_STYLE[grade] || GRADE_STYLE.sunset;
  const grad = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  grad.addColorStop(0, '#fff3c4');
  grad.addColorStop(0.45, style.sky[0]);
  grad.addColorStop(1, style.sky[1]);
  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function paintTitleBlock(ctx, w, h, band, state) {
  const { title, subtitle, badge } = state;
  const grade = state.grade || 'sunset';
  const style = GRADE_STYLE[grade] || GRADE_STYLE.sunset;

  // Dark band with a neon top edge.
  ctx.save();
  ctx.fillStyle = '#140a1e';
  ctx.fillRect(band.x, band.y, band.w, band.h);
  const edge = ctx.createLinearGradient(band.x, 0, band.x + band.w, 0);
  edge.addColorStop(0, style.sky[0]);
  edge.addColorStop(0.5, '#ff2e88');
  edge.addColorStop(1, style.sky[2]);
  ctx.fillStyle = edge;
  ctx.fillRect(band.x, band.y, Math.max(3, h * 0.006), band.w);
  ctx.restore();

  // Sun disc peeking over the band's top edge, left of the title.
  paintSunDisc(ctx, band.w * 0.085, band.y + band.h * 0.08, band.h * 0.42, grade);

  // Main title in Anton, white or sunset gradient, dark outline + shadow.
  const text = (title || '').trim().toUpperCase();
  let size = band.h * 0.52;
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const setFont = (s) => { ctx.font = `${s}px Anton, 'Arial Black', sans-serif`; try { ctx.letterSpacing = `${Math.max(1, s * 0.03)}px`; } catch { /* older canvas */ } };
  setFont(size);
  // measureText may not count letter-spacing, so budget it in by hand.
  const titleWidth = () => ctx.measureText(text).width + text.length * Math.max(1, size * 0.03);
  const maxW = band.w * 0.82;
  while (titleWidth() > maxW && size > 16) { size -= 2; setFont(size); }
  const tx = band.w * 0.17, ty = band.y + band.h * 0.46;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(10,4,18,0.9)';
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.strokeText(text, tx, ty);
  if (state.gradientTitle) {
    const fill = ctx.createLinearGradient(tx, ty - size * 0.5, tx, ty + size * 0.55);
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(0.55, '#ffe9a8');
    fill.addColorStop(1, style.sky[0]);
    ctx.fillStyle = fill;
  } else {
    ctx.fillStyle = '#ffffff';
  }
  ctx.shadowColor = 'rgba(255,46,136,0.55)';
  ctx.shadowBlur = size * 0.16;
  ctx.shadowOffsetY = size * 0.03;
  ctx.fillText(text, tx, ty);
  ctx.restore();

  // Script subtitle in Pacifico, tilted, neon glow, right-aligned so it
  // never runs off the cover's right edge.
  if ((subtitle || '').trim()) {
    ctx.save();
    ctx.translate(band.w * 0.97, band.y + band.h * 0.76);
    ctx.rotate(-0.045);
    let subSize = band.h * 0.27;
    const setSubFont = (s) => { ctx.font = `${s}px Pacifico, cursive`; };
    setSubFont(subSize);
    while (ctx.measureText(subtitle.trim()).width > band.w * 0.52 && subSize > 12) {
      subSize -= 2;
      setSubFont(subSize);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff5da2';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = band.h * 0.12;
    ctx.fillText(subtitle.trim(), 0, 0);
    ctx.restore();
  }
}

/** Badge ribbon as a sticker in the cover's top-right corner, clear of the
 *  title block so a long title can never collide with it. */
function paintBadgeSticker(ctx, w, h, badge) {
  if (!(badge || '').trim()) return;
  const label = badge.trim().toUpperCase();
  const fontSize = Math.max(11, Math.min(w, h) * 0.024);
  ctx.save();
  ctx.translate(w * 0.975, h * 0.038);
  ctx.rotate(0.03);
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
  const tw = ctx.measureText(label).width;
  const bw = tw + fontSize * 2.4, bh = fontSize * 2.1;
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = fontSize * 0.5;
  ctx.shadowOffsetY = fontSize * 0.12;
  ctx.fillStyle = '#ffc53d';
  ctx.strokeStyle = '#140a1e';
  ctx.lineWidth = Math.max(1, fontSize * 0.12);
  roundRectPath(ctx, -bw, -bh / 2, bw, bh, bh / 2);
  ctx.fill(); ctx.stroke();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#140a1e';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, -bw / 2, 1);
  ctx.restore();
}

/** Paints the whole cover. `state` holds layout, grade, title, subtitle,
 *  badge, grain, vignette, gradientTitle, gradeOn and panels[]. */
export function drawCover(ctx, w, h, state) {
  const layout = state.layout || 'quad';
  const grade = state.grade || 'sunset';
  const style = GRADE_STYLE[grade] || GRADE_STYLE.sunset;
  const geo = layoutGeometry(layout, w, h);

  // Backdrop: deep plum, or a sunset sky for the tilted collage.
  ctx.save();
  if (layout === 'tilt') {
    const sky = ctx.createLinearGradient(0, 0, 0, geo.area.h);
    sky.addColorStop(0, style.sky[2]);
    sky.addColorStop(0.55, style.sky[1]);
    sky.addColorStop(1, style.sky[0]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, geo.area.h + 2);
    paintSunDisc(ctx, w * 0.5, geo.area.h * 0.42, Math.min(w, h) * 0.16, grade);
  } else {
    ctx.fillStyle = '#140a1e';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();

  // Panels.
  const graded = state.gradeOn !== false;
  geo.panels.forEach((rect, i) => {
    const panel = (state.panels && state.panels[i]) || {};
    const img = panel.img || null;
    ctx.save();
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot);
      ctx.translate(-rect.w / 2, -rect.h / 2);
    } else {
      // Every panel paints in its own local space: origin at its top-left.
      ctx.translate(rect.x, rect.y);
    }
    // Snapshot print: white border + soft shadow.
    if (layout === 'tilt') {
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = w * 0.02;
      ctx.shadowOffsetY = h * 0.008;
      ctx.fillStyle = '#fdf8ef';
      const bw = Math.max(4, w * 0.008);
      roundRectPath(ctx, -bw, -bw, rect.w + 2 * bw, rect.h + 2 * bw + rect.h * 0.14, Math.max(2, w * 0.004));
      ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    }
    const clipR = layout === 'tilt' ? Math.max(2, w * 0.003) : Math.max(2, w * 0.004);
    roundRectPath(ctx, 0, 0, rect.w, rect.h, clipR);
    ctx.clip();
    if (img) {
      ctx.filter = graded ? style.filter : 'none';
      const ok = drawPhotoInto(ctx, img, { x: 0, y: 0, w: rect.w, h: rect.h }, panel);
      ctx.filter = 'none';
      if (!ok) { ctx.fillStyle = '#3a2340'; ctx.fillRect(0, 0, rect.w, rect.h); }
    } else {
      ctx.fillStyle = '#3a2340';
      ctx.fillRect(0, 0, rect.w, rect.h);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = `bold ${Math.max(12, rect.w * 0.045)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Drop a photo here', rect.w / 2, rect.h / 2);
    }
    // Thin keyline inside each panel edge.
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = Math.max(1, w * 0.0015);
    roundRectPath(ctx, 0, 0, rect.w, rect.h, clipR);
    ctx.stroke();
    ctx.restore();
  });

  // Grade overlays across the whole cover (photos + band alike).
  if (graded) paintGradeOverlays(ctx, w, h, grade, 1);

  // Full-bleed: darken the photo behind the title block so it reads.
  if (layout === 'full') {
    const scrim = ctx.createLinearGradient(0, geo.band.y - h * 0.12, 0, h);
    scrim.addColorStop(0, 'rgba(20,10,30,0)');
    scrim.addColorStop(1, 'rgba(20,10,30,0.82)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, geo.band.y - h * 0.12, w, h - geo.band.y + h * 0.12);
  }

  paintTitleBlock(ctx, w, h, geo.band, state);
  paintBadgeSticker(ctx, w, h, state.badge);

  // Vignette + grain finish.
  if (state.vignette) {
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(10,4,18,0.38)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // Outer white poster frame.
  ctx.save();
  ctx.strokeStyle = '#fdf8ef';
  ctx.lineWidth = Math.max(3, w * 0.008);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.restore();
}

/** Hit-test: which panel index contains point (x, y) in a cover of size w×h. */
export function panelAt(layout, w, h, x, y) {
  const geo = layoutGeometry(layout, w, h);
  for (let i = geo.panels.length - 1; i >= 0; i--) {
    const r = geo.panels[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}
