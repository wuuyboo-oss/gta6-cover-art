// Fixed scenes for screenshots. ?shot=cover draws the cover full-bleed at the size
// the query asks for; ?shot=editor shows the editor with a sample photo loaded.
// Query knobs: photo (boulevard|pier), caption, subtitle, layout, grade, w, h, size.
// window.__shotReady is set once the scene has painted.
import { SIZES } from './engine.js';

function setCoverSize(canvas, params) {
  const key = params.get('size');
  if (key && SIZES[key]) {
    canvas.width = SIZES[key].w;
    canvas.height = SIZES[key].h;
    return;
  }
  const w = Number(params.get('w'));
  const h = Number(params.get('h'));
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    canvas.width = w;
    canvas.height = h;
  }
}

export async function runShot(shot, params, state, loadImage, redraw, say, sync) {
  const canvas = document.getElementById('cover');
  const photoName = params.get('photo') ?? 'pier';
  const caption = params.get('caption') ?? 'Sunset Heist';
  const subtitle = params.get('subtitle');
  const layout = params.get('layout');
  const grade = params.get('grade');

  if (layout) state.layout = layout;
  if (grade) state.grade = grade;
  if (caption !== null) state.title = caption;
  if (subtitle !== null) state.subtitle = subtitle;
  state.selected = 0;

  try {
    const first = await loadImage(`samples/${photoName}.jpg`);
    state.photos[0] = first;
    const other = photoName === 'pier' ? 'boulevard' : 'pier';
    state.photos[1] = await loadImage(`samples/${other}.jpg`);
    // Spread the two samples across the panels so the cover shows variety, and
    // give each panel its own crop — a photo reused in two panels reads as a
    // different shot, not a copy.
    //
    // Crops are per layout: the same panel index frames a different rect in
    // each layout, so a shift that fixes a face in one layout would break a
    // panel in another. The base crops below are the originals; only the two
    // face fixes differ from them.
    // - grid panel 0 (pier photo): oy 0 -> 0.38 shifts the photo down so the
    //   man's whole hat and full face are in frame instead of being cut at
    //   the eyes. (At zoom 1.0 the image is 953px tall in a 533px panel, so
    //   the centred view starts 22% down the photo; 0.38 puts the top of
    //   the frame ~1% down the photo, just above the hat, with no gap.)
    // - strip panel 1 (boulevard photo): oy -0.04 -> 0.16 shifts the photo
    //   down so the woman's hair top, forehead, sunglasses and whole face
    //   are in frame. (At zoom 1.35 the image is 1458px tall in a 1080px
    //   panel; 0.16 puts the top of the frame ~1% down the photo, just
    //   above her hair, with no gap.)
    const baseCrops = [
      { zoom: 1.0, ox: 0, oy: 0 },
      { zoom: 1.35, ox: 0.06, oy: -0.04 },
      { zoom: 1.2, ox: -0.08, oy: 0.12 },
      { zoom: 1.5, ox: 0.1, oy: -0.08 },
    ];
    const cropsByLayout = {
      grid: [
        { zoom: 1.0, ox: 0, oy: 0.38 },
        baseCrops[1],
        baseCrops[2],
        baseCrops[3],
      ],
      strip: [
        baseCrops[0],
        { zoom: 1.35, ox: 0.06, oy: 0.16 },
        baseCrops[2],
      ],
    };
    const crops = cropsByLayout[state.layout] ?? baseCrops;
    const panels = state.perLayout[state.layout];
    panels.forEach((p, i) => {
      p.photo = i % 2 === 0 ? 0 : 1;
      p.zoom = crops[i].zoom;
      p.ox = crops[i].ox;
      p.oy = crops[i].oy;
    });
  } catch {
    say('Sample photo failed to load for the shot.');
  }

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    setCoverSize(canvas, params);
  } else {
    // Editor scene: keep the square preview the editor shows by default, and
    // make the sidebar agree with the scene (slots filled, pickers active).
    const sizeSel = document.getElementById('canvasSize');
    if (sizeSel) sizeSel.value = '1080x1080';
    document.getElementById('title').value = state.title;
    document.getElementById('subtitle').value = state.subtitle;
    if (typeof sync === 'function') sync();
    say('Sample photos loaded — drag a panel to position it, then export.');
  }
  redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}
