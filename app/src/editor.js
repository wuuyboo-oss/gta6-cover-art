// Neon Coast editor: binds the controls in index.html to the cover engine and keeps
// the live preview in sync. All state lives in one object from engine.freshState().

import {
  LAYOUTS, GRADES, SIZES, freshState, panelCount, panelRects, renderCover, panelAt,
} from './engine.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const state = freshState();

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function say(text) {
  status.textContent = text;
}

function redraw() {
  renderCover(canvas, state);
  refreshPanelThumbs();
}

// --- photo slots ---------------------------------------------------------------

const slotBox = document.getElementById('photoSlots');
const slotLabels = ['Photo 1', 'Photo 2', 'Photo 3'];
const slotInputs = [];
const slotThumbs = [];
const slotNames = [];

// Marks a slot as filled in the sidebar (thumbnail + file name).
export function markSlot(i, label, objectUrl) {
  if (slotThumbs[i]) {
    slotThumbs[i].textContent = '';
    slotThumbs[i].style.backgroundImage = `url(${objectUrl})`;
  }
  if (slotNames[i]) slotNames[i].textContent = `${slotLabels[i]} — ${label}`;
}

slotLabels.forEach((label, i) => {
  const wrap = document.createElement('div');
  wrap.className = 'photo-slot';
  const thumb = document.createElement('div');
  thumb.className = 'slot-thumb';
  thumb.textContent = '＋';
  const name = document.createElement('span');
  name.className = 'slot-name';
  name.textContent = `${label} — empty`;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.setAttribute('aria-label', `Choose ${label}`);
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const objectUrl = URL.createObjectURL(file);
      state.photos[i] = await loadImage(objectUrl);
      markSlot(i, file.name, objectUrl);
      // First loaded photo fills any empty panel.
      state.perLayout[state.layout].forEach((p) => {
        if (p.photo === null) p.photo = i;
      });
      redraw();
      say(`${file.name} loaded — drag it on the cover to position it.`);
    } catch {
      say('That file could not be read as an image.');
    }
  });
  wrap.append(thumb, name, input);
  slotBox.append(wrap);
  slotInputs.push(input);
  slotThumbs.push(thumb);
  slotNames.push(name);
});

document.getElementById('useSamples').addEventListener('click', async () => {
  try {
    const [a, b] = await Promise.all([
      loadImage('samples/boulevard.jpg'),
      loadImage('samples/pier.jpg'),
    ]);
    state.photos[0] = a;
    state.photos[1] = b;
    markSlot(0, 'boulevard.jpg (sample)', 'samples/boulevard.jpg');
    markSlot(1, 'pier.jpg (sample)', 'samples/pier.jpg');
    state.perLayout[state.layout].forEach((p) => {
      if (p.photo === null) p.photo = 0;
    });
    redraw();
    say('Sample photos loaded: boulevard in panel 1, pier in panel 2.');
  } catch {
    say('Sample photos could not be loaded.');
  }
});

// --- pickers -------------------------------------------------------------------

function buildPicker(box, entries, current, onPick) {
  box.innerHTML = '';
  Object.entries(entries).forEach(([id, def]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pick';
    btn.dataset.id = id;
    if (def.swatch) {
      const dot = document.createElement('span');
      dot.className = 'swatch';
      dot.style.background = def.swatch;
      btn.append(dot);
    }
    const text = document.createElement('span');
    text.innerHTML = `<b>${def.label}</b><small>${def.hint}</small>`;
    btn.append(text);
    btn.addEventListener('click', () => {
      onPick(id);
      box.querySelectorAll('.pick').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
    });
    if (id === current) btn.classList.add('active');
    box.append(btn);
  });
}

const layoutBox = document.getElementById('layoutPicker');
const gradeBox = document.getElementById('gradePicker');

// Re-marks the active layout / grade buttons from state (used after a shot scene
// sets the state directly, so the sidebar never disagrees with the preview).
export function syncPickers() {
  for (const [box, id] of [[layoutBox, state.layout], [gradeBox, state.grade]]) {
    box.querySelectorAll('.pick').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
  }
}

buildPicker(layoutBox, LAYOUTS, state.layout, (id) => {
  state.layout = id;
  state.selected = 0;
  redraw();
  say(`Layout: ${LAYOUTS[id].label}.`);
});
buildPicker(gradeBox, GRADES, state.grade, (id) => {
  state.grade = id;
  redraw();
  say(`Grade: ${GRADES[id].label}.`);
});

// --- panel controls --------------------------------------------------------------

const panelThumbs = document.getElementById('panelThumbs');
const panelPhoto = document.getElementById('panelPhoto');
const panelZoom = document.getElementById('panelZoom');
const zoomValue = document.getElementById('zoomValue');

function refreshPanelThumbs() {
  panelThumbs.innerHTML = '';
  const count = panelCount(state);
  for (let i = 0; i < count; i += 1) {
    const p = state.perLayout[state.layout][i];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `thumb${i === state.selected ? ' active' : ''}`;
    btn.textContent = `Panel ${i + 1} · ${p.photo === null ? 'empty' : `Photo ${p.photo + 1}`}`;
    btn.addEventListener('click', () => {
      state.selected = i;
      syncPanelControls();
      redraw();
    });
    panelThumbs.append(btn);
  }
  syncPanelControls();
}

function syncPanelControls() {
  const p = state.perLayout[state.layout][state.selected];
  panelPhoto.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'Empty';
  panelPhoto.append(none);
  state.photos.forEach((img, i) => {
    if (!img) return;
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `Photo ${i + 1}`;
    panelPhoto.append(opt);
  });
  panelPhoto.value = p.photo === null ? '' : String(p.photo);
  panelZoom.value = Math.round(p.zoom * 100);
  zoomValue.textContent = `${Math.round(p.zoom * 100)}%`;
}

panelPhoto.addEventListener('change', () => {
  const p = state.perLayout[state.layout][state.selected];
  p.photo = panelPhoto.value === '' ? null : Number(panelPhoto.value);
  redraw();
});
panelZoom.addEventListener('input', () => {
  const p = state.perLayout[state.layout][state.selected];
  p.zoom = Number(panelZoom.value) / 100;
  zoomValue.textContent = `${panelZoom.value}%`;
  redraw();
});
document.getElementById('zoomIn').addEventListener('click', () => {
  const p = state.perLayout[state.layout][state.selected];
  p.zoom = Math.min(3, p.zoom + 0.1);
  syncPanelControls();
  redraw();
});
document.getElementById('zoomOut').addEventListener('click', () => {
  const p = state.perLayout[state.layout][state.selected];
  p.zoom = Math.max(1, p.zoom - 0.1);
  syncPanelControls();
  redraw();
});
document.getElementById('resetPanel').addEventListener('click', () => {
  const p = state.perLayout[state.layout][state.selected];
  p.zoom = 1;
  p.ox = 0;
  p.oy = 0;
  syncPanelControls();
  redraw();
  say('Panel reset.');
});

// --- drag to pan / wheel to zoom on the preview ----------------------------------

let drag = null;
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}
canvas.addEventListener('pointerdown', (e) => {
  const pt = canvasPoint(e);
  const hit = panelAt(state, pt.x, pt.y, canvas.width, canvas.height);
  if (hit === -1) return;
  state.selected = hit;
  syncPanelControls();
  refreshPanelThumbs();
  drag = { panel: hit, x: pt.x, y: pt.y };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const pt = canvasPoint(e);
  const rects = panelRects(state, canvas.width, canvas.height);
  const rect = rects[drag.panel];
  const p = state.perLayout[state.layout][drag.panel];
  p.ox += (pt.x - drag.x) / rect.w;
  p.oy += (pt.y - drag.y) / rect.h;
  drag.x = pt.x;
  drag.y = pt.y;
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const pt = canvasPoint(e);
  const hit = panelAt(state, pt.x, pt.y, canvas.width, canvas.height);
  if (hit === -1) return;
  const p = state.perLayout[state.layout][hit];
  p.zoom = Math.min(3, Math.max(1, p.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  state.selected = hit;
  syncPanelControls();
  redraw();
}, { passive: false });

// --- grades, lettering, size ------------------------------------------------------

document.getElementById('grain').addEventListener('change', (e) => {
  state.grain = e.target.checked;
  redraw();
});
document.getElementById('vignette').addEventListener('change', (e) => {
  state.vignette = e.target.checked;
  redraw();
});
document.getElementById('title').addEventListener('input', (e) => {
  state.title = e.target.value;
  redraw();
});
document.getElementById('subtitle').addEventListener('input', (e) => {
  state.subtitle = e.target.value;
  redraw();
});
const titleSize = document.getElementById('titleSize');
titleSize.addEventListener('input', () => {
  state.titleSize = Number(titleSize.value) / 100;
  document.getElementById('titleSizeValue').textContent = `${titleSize.value}%`;
  redraw();
});
document.getElementById('titlePos').addEventListener('change', (e) => {
  state.titlePos = e.target.value;
  redraw();
});
document.getElementById('outline').addEventListener('change', (e) => {
  state.outline = e.target.checked;
  redraw();
});
document.getElementById('showSubtitle').addEventListener('change', (e) => {
  state.showSubtitle = e.target.checked;
  redraw();
});

// --- export -------------------------------------------------------------------------

const sizeSelect = document.getElementById('canvasSize');
sizeSelect.addEventListener('change', () => {
  const size = SIZES[sizeSelect.value];
  canvas.width = size.w;
  canvas.height = size.h;
  redraw();
  say(`Preview set to ${size.label}.`);
});

function downloadPNG(w, h, filename) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  renderCover(off, state);
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve();
    }, 'image/png');
  });
}

async function exportOne(key) {
  const size = SIZES[key];
  await downloadPNG(size.w, size.h, `neon-coast-${key}.png`);
  say(`Saved neon-coast-${key}.png (${size.label}).`);
}
document.getElementById('exportSquare').addEventListener('click', () => exportOne('1080x1080'));
document.getElementById('exportPortrait').addEventListener('click', () => exportOne('1080x1350'));
document.getElementById('exportWide').addEventListener('click', () => exportOne('1920x1080'));
document.getElementById('exportAll').addEventListener('click', async () => {
  for (const key of Object.keys(SIZES)) await exportOne(key);
  say('Saved all three sizes.');
});

// --- shot scenes ----------------------------------------------------------------------

export { state, redraw, say };
