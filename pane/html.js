// Escaping for the screens: everything that came from a file goes through esc(). Pure; no DOM.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const same = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

// A hover tip shows only what its element doesn't (architecture A16): `detail` is the tip, and is dropped when it would
// only repeat `shown`, the element's visible text, for tips built from data that can coincide with it. `clip` is the
// element's whole visible text, for an element the page truncates; app.js adds it to the tip only while the text is
// really cut off. Both empty: no attribute, so no tip and no dotted underline.
export const tip = (detail, { shown = '', clip = '' } = {}) =>
  `${detail && !same(detail, shown) ? ` data-tip="${esc(detail)}"` : ''}${clip ? ` data-clip="${esc(clip)}"` : ''}`;

// Portrait levels (html.12): each one's nominal art size and the CSS size it aims for (pane/faces.js turns them into
// --ap-<level>, a whole number of device pixels per art pixel).
export const FACE_LEVELS = { low: [32, 26], medium: [93, 80], small: [72, 56], high: [112, 104], full: [182, 182] };

// A portrait (html.12) as a window onto one of its images: `d` is what pane/faces.js describes for a level,
// { folder, src, x, y, w, h, W, H, smooth } in art pixels; the level's class sets how many CSS px an art pixel takes
// (style.css, --ap-*), always a whole number of device pixels, so pixel art stays crisp; a smooth (vector) face is
// scaled smoothly instead. The live player drops its canvas in here.
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const faceHtml = (d, level, cls = '') => `<span class="face ${level}${d.smooth ? ' smooth' : ''}${cls}" data-face="${esc(d.folder)}" style="--fw:${n(d.w)};--fh:${n(d.h)};--fx:${n(d.x)};--fy:${n(d.y)};--iw:${n(d.W)};--ih:${n(d.H)}" aria-hidden="true"><img alt="" src="${esc(d.src)}" draggable="false"></span>`;
// A player character's portrait: an empty black frame at a level's size, never a face (his character's face stays
// his to imagine).
export const blankFaceHtml = (level) => `<span class="face ${level} blank" style="--fw:${FACE_LEVELS[level][0]};--fh:${FACE_LEVELS[level][0]}" aria-hidden="true"></span>`;
