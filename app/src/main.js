// Entry point: starts the editor, then (only when a ?shot= query is present) sets
// up a fixed scene for a screenshot instead of the interactive editor.
import {
  state, redraw, say, loadImage, syncPickers, markSlot,
} from './editor.js';
import { runShot } from './shots.js';

// After a shot scene loads the sample photos, bring the sidebar up to date so
// the editor screenshot shows the photos as loaded, not as empty slots.
function syncSidebar() {
  syncPickers();
  markSlot(0, 'boulevard.jpg (sample)', 'samples/boulevard.jpg');
  markSlot(1, 'pier.jpg (sample)', 'samples/pier.jpg');
}

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  document.fonts.ready.then(() => runShot(shot, params, state, loadImage, redraw, say, syncSidebar));
} else {
  document.fonts.ready.then(() => redraw());
}
