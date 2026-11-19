// Vice Sunset Cover Studio — cover engine.
// One pure draw path used by the live preview AND by every export: drawCover()
// paints the whole cover onto any 2D context at any pixel size, so what you see
// is exactly what the PNG contains. No network, no libraries, canvas only.

export const GRADES = {
  sunset: { label: 'Vice Sunset', sat: 1.35, con: 1.08, bright: 1.04, tint: ['#ff7a18', '#ff2e63', '#7b2ff7'], tintAlpha: 0.42, warm: 0.10 },
  neon:   { label: 'Neon Night',  sat: 1.55, con: 1.12, bright: 0.98, tint: ['#ff2ea6', '#2ee6ff', '#7b2ff7'], tintAlpha: 0.38, warm: 0.00 },
  dusk:   { label: 'Palm Dusk',   sat: 1.25, con: 1.06, bright: 1.02, tint: ['#ffd166', '#ff5e78', '#5b2a86'], tintAlpha: 0.30, warm: 0.06 },
  noir:   { label: 'Noir',        sat: 0.05, con: 1.22, bright: 1.00, tint: ['#ffffff', '#8a8a8a', '#000000'], tintAlpha: 0.12, warm: 0.00 },
};

export const LAYOUTS = {
  quad:    { label: 'Quad Grid',    panels: 4 },
  strip:   { label: 'Hero + Strip', panels: 4 },
  full:    { label: 'Full Bleed',   panels: 1 },
  collage: { label: 'Snapshot Collage', panels: 4 },
};

export const SIZES = {
  square: { label: '1080 × 1080', w: 1080, h: 1080 },
  portrait: { label: '1080 × 1350', w: 1080, h: 1350 },
  wide: { label: '1920 × 1080', w: 1920, h: 1080 },
};

export function defaultState() {
  return {
    layout: 'quad',
    grade: 'sunset',
    size: 'square',
    title: 'NEON SHORE',
    subtitle: 'chasing the last light',
    badge: 'EST. 2026 • SUNSET STRIP',
    gradientTitle: true,
    grain: true,
    vignette: true,
    showGrade: true, // false = before/after compare (grade off)
    panels: [0, 1, 2, 3].map(() => ({
      img: null, zoom: 1, ox: 0, oy: 0, fit: 'fill',
    })),
    selected: 0,
  };
}

// Panel rectangles for a layout, in cover coordinates. Gutter g is the white
// frame between panels; collage panels overlap on purpose and are rotated.
export function layoutRects(layout, W, H) {
  const g = Math.round(Math.min(W, H) * 0.014);
  const pad = Math.round(Math.min(W, H) * 0.022);
  const inner = { x: pad, y: pad, w: W - pad * 2, h: H - pad * 2 };
  if (layout === 'full') return [{ ...inner, rot: 0 }];
  if (layout === 'strip') {
    const heroW = Math.round(inner.w * 0.62);
    const stripX = inner.x + heroW + g;
    const stripW = inner.w - heroW - g;
    const sh = Math.round((inner.h - g * 2) / 3);
    return [
      { x: inner.x, y: inner.y, w: heroW, h: inner.h, rot: 0 },
      { x: stripX, y: inner.y, w: stripW, h: sh, rot: 0 },
      { x: stripX, y: inner.y + sh + g, w: stripW, h: sh, rot: 0 },
      { x: stripX, y: inner.y + sh * 2 + g * 2, w: stripW, h: sh, rot: 0 },
    ];
  }
  if (layout === 'collage') {
    const cw = Math.round(inner.w * 0.52), ch = Math.round(inner.h * 0.42);
    return [
      { x: inner.x + inner.w * 0.03, y: inner.y + inner.h * 0.04, w: cw, h: ch, rot: -4 },
      { x: inner.x + inner.w * 0.45, y: inner.y + inner.h * 0.02, w: cw, h: ch, rot: 3 },
      { x: inner.x + inner.w * 0.06, y: inner.y + inner.h * 0.52, w: cw, h: ch, rot: 3.5 },
      { x: inner.x + inner.w * 0.44, y: inner.y + inner.h * 0.54, w: cw, h: ch, rot: -3 },
    ];
  }
  // quad: big hero top-left, three small panels around it
  const heroW = Math.round(inner.w * 0.62);
  const heroH = Math.round(inner.h * 0.62);
  const sideW = inner.w - heroW - g;
  const botH = inner.h - heroH - g;
  const bw = Math.round((inner.w - g * 2) / 3);
  return [
    { x: inner.x, y: inner.y, w: heroW, h: heroH, rot: 0 },
    { x: inner.x + heroW + g, y: inner.y, w: sideW, h: Math.round((heroH - g) / 2), rot: 0 },
    { x: inner.x + heroW + g, y: inner.y + Math.round((heroH - g) / 2) + g, w: sideW, h: Math.round((heroH - g) / 2), rot: 0 },
    { x: inner.x, y: inner.y + heroH + g, w: inner.w, h: botH, rot: 0 },
  ];
}

// Draw one photo into a rect, honouring the panel's crop (pan offsets ox/oy
// in fractions of the rect, zoom multiplier) and fit/fill mode.
// Crop contract: oy shifts the visible window toward the top of the photo —
// positive oy favours the face/top — and wide panels need a larger oy to
// keep a face in frame (see the defaultCrops table in main.js).
function drawPanelPhoto(ctx, img, rect, panel) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  let scale;
  if (panel.fit === 'fit') scale = Math.min(w / iw, h / ih);
  else scale = Math.max(w / iw, h / ih);
  scale *= panel.zoom || 1;
  const dw = iw * scale, dh = ih * scale;
  let dx = x + (w - dw) / 2 + (panel.ox || 0) * w;
  let dy = y + (h - dh) / 2 + (panel.oy || 0) * h;
  // Clamp the pan so the photo always covers the whole panel (no gaps).
  if (dw >= w) dx = Math.min(x, Math.max(x + w - dw, dx)); else dx = x + (w - dw) / 2;
  if (dh >= h) dy = Math.min(y, Math.max(y + h - dh, dy)); else dy = y + (h - dh) / 2;
  if (panel.fit === 'fit') { ctx.fillStyle = '#14101c'; ctx.fillRect(x, y, w, h); }
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

// Sunset / neon colour grade: a warm wash + a diagonal two-stop tint blended
// over the photo, plus a dark foot the lettering sits on.
function gradeOverlay(ctx, rect, grade, W, H) {
  const g = GRADES[grade] || GRADES.sunset;
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const tint = ctx.createLinearGradient(x, y + h * 0.1, x + w, y + h);
  tint.addColorStop(0, g.tint[0]); tint.addColorStop(0.55, g.tint[1]); tint.addColorStop(1, g.tint[2]);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = g.tintAlpha;
  ctx.fillStyle = tint; ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = g.warm;
  ctx.fillStyle = '#ff8c42'; ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

let grainPattern = null;
function getGrain(ctx) {
  if (grainPattern) return grainPattern;
  const c = document.createElement('canvas');
  c.width = 140; c.height = 140;
  const g = c.getContext('2d');
  const d = g.createImageData(140, 140);
  let seed = 1234567;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v; d.data[i + 3] = 22;
  }
  g.putImageData(d, 0, 0);
  grainPattern = ctx.createPattern(c, 'repeat');
  return grainPattern;
}

function fitFont(ctx, text, fontFamily, startSize, maxWidth, weight = '') {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${fontFamily}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${fontFamily}`;
  }
  return size;
}

// The title block: script subtitle, big Anton title, badge ribbon.
function drawLettering(ctx, st, W, H) {
  const pad = Math.round(Math.min(W, H) * 0.045);
  const bandH = Math.round(H * 0.235);
  const bandY = H - bandH;
  // Dark foot band so white lettering reads on any photo.
  const band = ctx.createLinearGradient(0, bandY - H * 0.06, 0, H);
  band.addColorStop(0, 'rgba(10,6,20,0)');
  band.addColorStop(0.35, 'rgba(10,6,20,0.72)');
  band.addColorStop(1, 'rgba(10,6,20,0.88)');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY - H * 0.06, W, H - bandY + H * 0.06);

  const cx = W / 2;
  const title = (st.title || '').trim().toUpperCase();
  const sub = (st.subtitle || '').trim();
  const badge = (st.badge || '').trim().toUpperCase();

  // Badge ribbon, top-centre, slightly rotated — the one spot that never
  // sits over a panel's main subject in any layout.
  if (badge) {
    const bs = fitFont(ctx, badge, 'Anton, sans-serif', Math.round(H * 0.024), W * 0.5);
    const bw = ctx.measureText(badge).width + bs * 1.6;
    const bh = bs * 1.9;
    ctx.save();
    ctx.translate(W / 2, pad + bh / 2);
    ctx.rotate(-0.012);
    ctx.fillStyle = '#ff2e63';
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1, H * 0.0012);
    ctx.strokeRect(-bw / 2 + 3, -bh / 2 + 3, bw - 6, bh - 6);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(badge, 0, 1);
    ctx.restore();
  }

  // Script subtitle, centred just above the title.
  let titleY = H - pad - Math.round(H * 0.02);
  if (sub) {
    const ss = fitFont(ctx, sub, 'Pacifico, cursive', Math.round(H * 0.042), W * 0.86);
    ctx.font = `${ss}px Pacifico, cursive`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = ss * 0.25; ctx.shadowOffsetY = 2;
    const subY = bandY + Math.round(H * 0.055);
    ctx.fillText(sub, cx, subY);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    titleY = H - pad - Math.round(H * 0.01);
  }

  if (title) {
    const ts = fitFont(ctx, title, 'Anton, sans-serif', Math.round(H * 0.115), W * 0.92);
    ctx.font = `${ts}px Anton, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = ts * 0.16; ctx.shadowOffsetY = ts * 0.05;
    if (st.gradientTitle) {
      const grad = ctx.createLinearGradient(0, titleY - ts, 0, titleY);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.45, '#ffe29a');
      grad.addColorStop(0.75, '#ff7a18');
      grad.addColorStop(1, '#ff2e63');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = '#ffffff';
    }
    ctx.strokeStyle = 'rgba(20,8,30,0.9)';
    ctx.lineWidth = Math.max(2, ts * 0.07);
    ctx.strokeText(title, cx, titleY);
    ctx.fillText(title, cx, titleY);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }
}

export function drawCover(canvas, st) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const grade = GRADES[st.grade] || GRADES.sunset;
  ctx.clearRect(0, 0, W, H);
  // Base: deep plum backdrop (visible in gutters + collage gaps).
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1b0f2e'); bg.addColorStop(0.55, '#2b1038'); bg.addColorStop(1, '#12081f');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  const rects = layoutRects(st.layout, W, H);
  const frame = Math.max(2, Math.round(Math.min(W, H) * 0.006));
  rects.forEach((rect, i) => {
    const panel = st.panels[i] || { img: null, zoom: 1, ox: 0, oy: 0, fit: 'fill' };
    ctx.save();
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate((rect.rot * Math.PI) / 180);
      ctx.translate(-rect.w / 2, -rect.h / 2);
      // Snapshot white border.
      ctx.fillStyle = '#fdf8f0';
      ctx.fillRect(-frame * 2, -frame * 2, rect.w + frame * 4, rect.h + frame * 4);
    }
    const r0 = rect.rot ? { x: 0, y: 0, w: rect.w, h: rect.h } : rect;
    if (panel.img) {
      ctx.save();
      if (st.showGrade) {
        ctx.filter = `saturate(${grade.sat}) contrast(${grade.con}) brightness(${grade.bright})`;
      }
      drawPanelPhoto(ctx, panel.img, r0, panel);
      ctx.restore();
      if (st.showGrade) gradeOverlay(ctx, r0, st.grade, W, H);
    } else {
      // Empty panel placeholder: sunset gradient + hint.
      const ph = ctx.createLinearGradient(r0.x, r0.y, r0.x + r0.w, r0.y + r0.h);
      ph.addColorStop(0, '#ff7a18'); ph.addColorStop(0.5, '#ff2e63'); ph.addColorStop(1, '#7b2ff7');
      ctx.fillStyle = ph; ctx.fillRect(r0.x, r0.y, r0.w, r0.h);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const fs = Math.max(12, Math.round(Math.min(r0.w, r0.h) * 0.09));
      ctx.font = `${fs}px Anton, sans-serif`;
      ctx.fillText('DROP A PHOTO', r0.x + r0.w / 2, r0.y + r0.h / 2 - fs * 0.7);
      ctx.font = `${Math.round(fs * 0.62)}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(`Panel ${i + 1} — or load a sample`, r0.x + r0.w / 2, r0.y + r0.h / 2 + fs * 0.8);
    }
    // Thin frame around each panel.
    ctx.strokeStyle = st.layout === 'collage' ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0.9)';
    ctx.lineWidth = frame;
    ctx.strokeRect(r0.x, r0.y, r0.w, r0.h);
    ctx.restore();
  });

  // Collage gets a soft sunset wash behind the snapshots.
  if (st.layout === 'collage') {
    // (already painted as backdrop; snapshots sit on top)
  }

  drawLettering(ctx, st, W, H);

  if (st.vignette) {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  if (st.grain) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = getGrain(ctx);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  return rects;
}

// Hit-test: which panel rect contains a point in preview-canvas coordinates.
export function panelAt(st, W, H, px, py) {
  const rects = layoutRects(st.layout, W, H);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
  }
  return -1;
}
