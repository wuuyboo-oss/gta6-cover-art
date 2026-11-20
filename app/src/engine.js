// Neon Coast cover engine: draws a multi-panel GTA-style poster onto a 2D canvas.
// Everything here is computed from a plain state object, so the editor, the export
// buttons and the screenshot scenes all render through the same function.

export const LAYOUTS = {
  grid: {
    label: 'Four-panel grid',
    hint: '2 × 2',
    panels: (w, h, g) => [
      { x: 0, y: 0, w: (w - g) / 2, h: (h - g) / 2 },
      { x: (w + g) / 2, y: 0, w: (w - g) / 2, h: (h - g) / 2 },
      { x: 0, y: (h + g) / 2, w: (w - g) / 2, h: (h - g) / 2 },
      { x: (w + g) / 2, y: (h + g) / 2, w: (w - g) / 2, h: (h - g) / 2 },
    ],
  },
  hero: {
    label: 'Hero + three',
    hint: 'Big left, 3 right',
    panels: (w, h, g) => {
      const heroW = w * 0.62;
      const sideX = heroW + g;
      const sideW = w - sideX;
      const rowH = (h - 2 * g) / 3;
      return [
        { x: 0, y: 0, w: heroW, h },
        { x: sideX, y: 0, w: sideW, h: rowH },
        { x: sideX, y: rowH + g, w: sideW, h: rowH },
        { x: sideX, y: 2 * (rowH + g), w: sideW, h: rowH },
      ];
    },
  },
  full: {
    label: 'Full bleed',
    hint: 'One photo',
    panels: (w, h) => [{ x: 0, y: 0, w, h }],
  },
  strip: {
    label: 'Three-panel strip',
    hint: 'Vertical',
    panels: (w, h, g) => {
      const colW = (w - 2 * g) / 3;
      return [0, 1, 2].map((i) => ({
        x: i * (colW + g), y: 0, w: colW, h,
      }));
    },
  },
};

export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    hint: 'Pink-orange dusk',
    swatch: 'linear-gradient(135deg,#ff5e8a,#ff9a3d,#ffd23d)',
  },
  neon: {
    label: 'Neon Night',
    hint: 'Magenta-teal',
    swatch: 'linear-gradient(135deg,#ff2fb3,#7b2fff,#00e5c7)',
  },
  tealorange: {
    label: 'Teal & Orange',
    hint: 'Blockbuster warm',
    swatch: 'linear-gradient(135deg,#0e7d8c,#ff8a3d)',
  },
  noir: {
    label: 'Mono Noir',
    hint: 'Black & white',
    swatch: 'linear-gradient(135deg,#111,#888,#fff)',
  },
};

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: '1080 × 1080' },
  '1080x1350': { w: 1080, h: 1350, label: '1080 × 1350' },
  '1920x1080': { w: 1920, h: 1080, label: '1920 × 1080' },
};

// A fresh cover state. Panel crops live per layout so switching layouts keeps your work.
export function freshState() {
  const perLayout = {};
  for (const id of Object.keys(LAYOUTS)) {
    const count = id === 'full' ? 1 : id === 'strip' ? 3 : 4;
    perLayout[id] = Array.from({ length: count }, (_, i) => ({
      photo: i === 0 ? 0 : null, zoom: 1, ox: 0, oy: 0,
    }));
  }
  return {
    layout: 'grid',
    grade: 'sunset',
    grain: true,
    vignette: true,
    title: 'NEON COAST',
    subtitle: 'vice nights, golden days',
    titleSize: 1,
    titlePos: 'bottom',
    outline: true,
    showSubtitle: true,
    photos: [null, null, null],
    selected: 0,
    perLayout,
  };
}

export function panelCount(state) {
  return state.perLayout[state.layout].length;
}

export function panelRects(state, w, h) {
  const gap = Math.max(6, Math.round(Math.min(w, h) * 0.012));
  return LAYOUTS[state.layout].panels(w, h, gap);
}

// --- photo drawing -----------------------------------------------------------

// Draws an image to cover `rect`, scaled by zoom and shifted by the pan offsets
// (fractions of the rect size). Falls back to a painted placeholder when no photo.
function paintPhoto(ctx, img, rect, zoom, ox, oy) {
  if (!img) {
    const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    grad.addColorStop(0, '#3a2350');
    grad.addColorStop(0.55, '#7a2b63');
    grad.addColorStop(1, '#c94b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    // Sun disc + palm-ish silhouette so an empty panel still reads as a poster.
    const cx = rect.x + rect.w * 0.5;
    const cy = rect.y + rect.h * 0.42;
    const r = Math.min(rect.w, rect.h) * 0.2;
    const sun = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    sun.addColorStop(0, 'rgba(255, 224, 130, 0.95)');
    sun.addColorStop(1, 'rgba(255, 120, 80, 0)');
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(20, 8, 30, 0.55)';
    ctx.fillRect(rect.x, rect.y + rect.h * 0.78, rect.w, rect.h * 0.22);
    return;
  }
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const pw = img.naturalWidth * base;
  const ph = img.naturalHeight * base;
  const dx = rect.x + (rect.w - pw) / 2 + ox * rect.w;
  const dy = rect.y + (rect.h - ph) / 2 + oy * rect.h;
  ctx.drawImage(img, dx, dy, pw, ph);
}

// --- colour grades -----------------------------------------------------------

function gradeOverlay(ctx, rect, grade) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (grade === 'noir') {
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#808080';
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'overlay';
    const c = ctx.createLinearGradient(x, y, x + w, y + h);
    c.addColorStop(0, 'rgba(255,255,255,0.22)');
    c.addColorStop(0.5, 'rgba(128,128,128,0)');
    c.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  } else if (grade === 'sunset') {
    ctx.globalCompositeOperation = 'overlay';
    const sky = ctx.createLinearGradient(x, y, x, y + h);
    sky.addColorStop(0, 'rgba(255, 94, 138, 0.62)');
    sky.addColorStop(0.55, 'rgba(255, 140, 60, 0.42)');
    sky.addColorStop(1, 'rgba(255, 190, 60, 0.52)');
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'multiply';
    const deep = ctx.createLinearGradient(x, y + h * 0.5, x, y + h);
    deep.addColorStop(0, 'rgba(90, 20, 90, 0)');
    deep.addColorStop(1, 'rgba(70, 10, 70, 0.4)');
    ctx.fillStyle = deep;
    ctx.fillRect(x, y, w, h);
  } else if (grade === 'neon') {
    ctx.globalCompositeOperation = 'overlay';
    const glow = ctx.createLinearGradient(x, y, x + w, y + h);
    glow.addColorStop(0, 'rgba(255, 47, 179, 0.55)');
    glow.addColorStop(0.5, 'rgba(123, 47, 255, 0.3)');
    glow.addColorStop(1, 'rgba(0, 229, 199, 0.5)');
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(10, 0, 40, 0.55)';
    ctx.fillRect(x, y, w, h);
  } else {
    // teal & orange
    ctx.globalCompositeOperation = 'overlay';
    const warm = ctx.createLinearGradient(x, y, x + w, y + h);
    warm.addColorStop(0, 'rgba(255, 138, 61, 0.58)');
    warm.addColorStop(1, 'rgba(14, 125, 140, 0.58)');
    ctx.fillStyle = warm;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(0, 40, 50, 0.35)';
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

// --- grain & vignette --------------------------------------------------------

let noiseTile = null;
function grainTile() {
  if (noiseTile) return noiseTile;
  const t = document.createElement('canvas');
  t.width = 180;
  t.height = 180;
  const c = t.getContext('2d');
  const data = c.createImageData(180, 180);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 96 + Math.floor(Math.random() * 64);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  c.putImageData(data, 0, 0);
  noiseTile = t;
  return t;
}

function finishFrame(ctx, w, h, state) {
  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.globalCompositeOperation = 'overlay';
    const tile = grainTile();
    const pattern = ctx.createPattern(tile, 'repeat');
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (state.vignette) {
    const v = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.42,
      w / 2, h / 2, Math.max(w, h) * 0.75,
    );
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(5,0,15,0.42)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
}

// --- lettering ---------------------------------------------------------------

function fitTitleFont(ctx, text, maxWidth, baseSize) {
  let size = baseSize;
  ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  while (size > 18 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  }
  return size;
}

function drawLettering(ctx, w, h, state) {
  const title = state.title.trim().toUpperCase();
  const subtitle = state.subtitle.trim();
  if (!title && !subtitle) return;
  const bottom = state.titlePos === 'bottom';
  const bandH = h * 0.16;
  const bandY = bottom ? h - bandH : 0;

  // A soft dark shelf so the words stay readable over any photo.
  const shelf = ctx.createLinearGradient(0, bandY, 0, bottom ? h : bandH);
  shelf.addColorStop(0, 'rgba(8, 2, 18, 0)');
  shelf.addColorStop(1, 'rgba(8, 2, 18, 0.62)');
  ctx.fillStyle = shelf;
  ctx.fillRect(0, bandY, w, bandH);

  const cx = w / 2;
  if (title) {
    const base = Math.round(h * 0.115 * state.titleSize);
    const size = fitTitleFont(ctx, title, w * 0.94, base);
    const y = bottom
      ? h - h * 0.045 - (subtitle && state.showSubtitle ? h * 0.052 : 0)
      : bandH * 0.62;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const grad = ctx.createLinearGradient(0, y - size, 0, y);
    grad.addColorStop(0, '#fff7d6');
    grad.addColorStop(0.45, '#ffd23d');
    grad.addColorStop(0.75, '#ff7a3d');
    grad.addColorStop(1, '#ff2f92');
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(255, 47, 146, 0.55)';
    ctx.shadowBlur = size * 0.18;
    ctx.shadowOffsetY = size * 0.03;
    if (state.outline) {
      ctx.lineWidth = Math.max(2, size * 0.09);
      ctx.strokeStyle = '#14041f';
      ctx.lineJoin = 'round';
      ctx.strokeText(title, cx, y);
    }
    ctx.fillText(title, cx, y);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  if (subtitle && state.showSubtitle) {
    const size = Math.round(h * 0.038);
    ctx.font = `${size}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const y = bottom ? h - h * 0.028 : bandH * 0.92;
    ctx.shadowColor = '#00e5c7';
    ctx.shadowBlur = size * 0.7;
    ctx.fillStyle = '#eafffb';
    if (state.outline) {
      ctx.lineWidth = Math.max(1.5, size * 0.08);
      ctx.strokeStyle = 'rgba(10, 0, 30, 0.85)';
      ctx.lineJoin = 'round';
      ctx.strokeText(subtitle, cx, y);
    }
    ctx.fillText(subtitle, cx, y);
    ctx.shadowBlur = 0;
  }
}

// --- main render -------------------------------------------------------------

export function renderCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0d0218';
  ctx.fillRect(0, 0, w, h);

  const rects = panelRects(state, w, h);
  const panels = state.perLayout[state.layout];
  rects.forEach((rect, i) => {
    const p = panels[i];
    const img = p && p.photo !== null && p.photo !== undefined
      ? state.photos[p.photo] : null;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    paintPhoto(ctx, img, rect, p ? p.zoom : 1, p ? p.ox : 0, p ? p.oy : 0);
    gradeOverlay(ctx, rect, state.grade);
    ctx.restore();
    // Thin poster frame around each panel.
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.004);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  });

  finishFrame(ctx, w, h, state);
  drawLettering(ctx, w, h, state);
}

// Which panel (if any) contains a point in canvas pixels.
export function panelAt(state, px, py, w, h) {
  const rects = panelRects(state, w, h);
  for (let i = rects.length - 1; i >= 0; i -= 1) {
    const r = rects[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
  }
  return -1;
}
