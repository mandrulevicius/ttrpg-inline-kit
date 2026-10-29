// Generated from pipelines/vector-faces/src/faces.js by pipelines/vector-faces/bin/export.mjs: edit the source, then re-run it.
// Procedural portraits. face(desc, level, opts) turns a face descriptor (face-parse.js makes one from an NPC's
// `appearance`) into an SVG string at one of three levels: low (map and list icons, 24-32 px), medium (sheet icon,
// about 96 px), high (dialogue and hover, about 320 px, with expressions). face-clay.js renders the research
// level on a canvas from the same rig.
//
// One rig serves every level: rig(desc, expr) places the head, features and lids in a 200 x 250 portrait space, and
// each level draws what reads at its size. Expressions are vectors of muscle-like controls (FACS-style), so two
// blend by mixing numbers and animate by tweening them. Everything random is seeded by the NPC id: the same
// descriptor always draws the same face.
//
// Light and pose: each NPC gets a seeded light setup (a coloured key from the upper left, a different-coloured fill
// in the shadows, a room behind; LIGHTS, or a scene's own through opts.light) and a seeded pose (a turn, a tilt,
// whether the eyes meet the viewer). The high level takes the whole pose and paints the light in bands with a dark
// contour on the shadow side; medium takes half the pose; the low level stays frontal so icons read at 24 px.
// The flat pass (opts.flat, the clay renderer's albedo) is unlit, and frontal unless opts.pose turns it.
//
// The turn: the head is a solid (solid()), so the outline, features, ears, hair, beard and headwear turn as one.
// Features are placed on its surface; hair, beard and headwear are designed frontal and bent round it as they are
// written (P() consults the bender while bent() runs); what lies round the side of the head (a sideburn, the edge
// over the ear, a bald man's fringe) is given in angle and height on the surface. Check a change with
// `node bin/faces-sheet.mjs --turns=-1,-0.5,0,0.5,1`.

import { HAIR, NOSE } from './face-parts.js';

// ---------------------------------------------------------------- expressions

/** Controls, each about -1..1. Named expressions are points in this space; intensity scales from neutral. */
export const CONTROLS = ['browInner', 'browOuter', 'browDown', 'lidUp', 'squint', 'smile', 'mouthOpen', 'lipPress',
  'stretch', 'sneer', 'asym', 'gazeX', 'gazeY', 'tilt', 'nod', 'turn', 'blink'];

export const EXPRESSIONS = {
  neutral: {},
  warm: { smile: .7, squint: .45, browInner: .18, mouthOpen: .05, tilt: 3, lidUp: -.05, turn: .1 },
  amused: { smile: .55, asym: .75, squint: .35, browOuter: .45, gazeX: .3, tilt: -3, lidUp: -.12, turn: .2 },
  irritated: { browDown: .6, lipPress: .8, smile: -.2, squint: .3, lidUp: -.28, gazeX: .55, asym: -.3, nod: .2, turn: -.3 },
  angry: { browDown: 1, lidUp: .35, squint: .25, sneer: .75, mouthOpen: .38, smile: -.3, stretch: .35, nod: .45 },
  afraid: { browInner: 1, browOuter: .65, lidUp: 1, stretch: .85, mouthOpen: .35, smile: -.25, nod: -.35, gazeX: -.25, turn: -.15 },
  sad: { browInner: .95, browDown: .15, lidUp: -.45, smile: -.65, gazeY: .6, nod: .4, lipPress: .25, tilt: -4, turn: -.1 },
  thinking: { browDown: .4, browOuter: .45, asym: -.6, gazeX: -.6, gazeY: -.6, lipPress: .45, smile: -.06, tilt: 5, turn: -.35 },
};

/** A named expression at an intensity (0 neutral, 1 full, up to about 1.3 for extremes). */
export function expression(name, intensity = 1) {
  const src = EXPRESSIONS[name] || {};
  const out = {};
  for (const k of CONTROLS) out[k] = (src[k] || 0) * intensity;
  return out;
}

/** Mix two expression vectors: t=0 is a, t=1 is b. */
export function blend(a, b, t) {
  const out = {};
  for (const k of CONTROLS) out[k] = (a[k] || 0) * (1 - t) + (b[k] || 0) * t;
  return out;
}

// ---------------------------------------------------------------- small helpers

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const f = n => (Math.round(n * 10) / 10).toString();
/** A point in a path. While a bender is set (bent()), absolute points go through it: frontal art drawn round a turned head. */
let MAP = null;
const P = (x, y) => (MAP ? f(MAP(x, y)) : f(x)) + ' ' + f(y);
/** A relative step in a path ('l', 'q'): never bent. */
const Q = (x, y) => f(x) + ' ' + f(y);

export function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
/** An independent random stream per feature, so adding a feature never reshuffles another. */
const stream = (d, key) => rng(hash(String(d.seed) + ':' + key));

// colours
function hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
function rgb2hex([r, g, b]) { return '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join(''); }
function rgb2hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l * 100];
  const dd = mx - mn, s = l > .5 ? dd / (2 - mx - mn) : dd / (mx + mn);
  let h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
  return [h * 60, s * 100, l * 100];
}
function hsl2rgb([h, s, l]) {
  h = ((h % 360) + 360) % 360 / 360; s = clamp(s / 100); l = clamp(l / 100);
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const t = x => { x = (x + 1) % 1; return x < 1 / 6 ? p + (q - p) * 6 * x : x < .5 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p; };
  return [t(h + 1 / 3) * 255, t(h) * 255, t(h - 1 / 3) * 255];
}
/** Shift a colour in HSL: dh degrees, ds and dl in percentage points. */
export function shade(hex, dl = 0, ds = 0, dh = 0) { const [h, s, l] = rgb2hsl(hex2rgb(hex)); return rgb2hex(hsl2rgb([h + dh, s + ds, l + dl])); }
export function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v + (B[i] - v) * t)); }
const lum = hex => rgb2hsl(hex2rgb(hex))[2];

// paths
/** A Catmull-Rom spline through points as cubic Beziers. */
function spline(pts, closed = false, k = 1) {
  const n = pts.length;
  const at = i => closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
  let d = 'M' + P(pts[0][0], pts[0][1]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6 * k, p1[1] + (p2[1] - p0[1]) / 6 * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6 * k, p2[1] - (p3[1] - p1[1]) / 6 * k];
    d += 'C' + P(c1[0], c1[1]) + ' ' + P(c2[0], c2[1]) + ' ' + P(p2[0], p2[1]);
  }
  return d + (closed ? 'Z' : '');
}
/** Points along a spline (for placing strands on an outline). */
function sampleSpline(pts, closed, per = 8) {
  const n = pts.length, out = [];
  const at = i => closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(c => .5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}
const mirror = (pts, cx) => pts.map(([x, y]) => [2 * cx - x, y]);
const el = (tag, attrs, inner) => {
  let s = '<' + tag;
  for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== false) s += ' ' + k + '="' + String(attrs[k]).replace(/"/g, '&quot;') + '"';
  return inner === undefined ? s + '/>' : s + '>' + inner + '</' + tag + '>';
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------------------------------------------------------------- descriptor defaults

/** Fill every field a renderer reads, so a partial descriptor still draws. Fields it doesn't know pass through. */
export function normalize(d) {
  const r = stream(d, 'defaults');
  const pick = arr => arr[Math.floor(r() * arr.length)];
  const n = (v, def) => (typeof v === 'number' && isFinite(v)) ? v : def;
  const o = { ...d };
  o.v = 1; o.kind = d.kind || 'human'; o.seed = d.seed ?? 'anon';
  o.sex = d.sex || 'x';
  o.age = n(d.age, 35) + (d.lookOlder ? 6 : 0);
  o.build = { ...d.build, mass: n(d.build?.mass, .5), soft: n(d.build?.soft, 0) };
  o.face = { ...d.face, shape: d.face?.shape || 'oval', width: n(d.face?.width, .5), length: n(d.face?.length, .5), jaw: n(d.face?.jaw, o.sex === 'm' ? .62 : o.sex === 'f' ? .38 : .5), chin: n(d.face?.chin, .5), cheekbones: n(d.face?.cheekbones, .5), hollow: n(d.face?.hollow, 0), cleft: !!d.face?.cleft };
  o.skin = { ...d.skin, tone: d.skin?.tone || '#c99a78', weathered: n(d.skin?.weathered, 0), freckles: n(d.skin?.freckles, 0), pocked: n(d.skin?.pocked, 0), flush: n(d.skin?.flush, 0), spots: n(d.skin?.spots, 0) };
  if (d.skin?.cast) o.skin.tone = mix(o.skin.tone, d.skin.cast, .3);
  o.lines = { forehead: 0, crows: 0, smile: 0, frown: 0, ...d.lines };
  o.eyes = { ...d.eyes, color: d.eyes?.color || '#5a3d2a', size: n(d.eyes?.size, .5), set: n(d.eyes?.set, .5), tilt: n(d.eyes?.tilt, 0), hooded: n(d.eyes?.hooded, 0), deep: n(d.eyes?.deep, .3), bags: n(d.eyes?.bags, 0), fold: n(d.eyes?.fold, 0) };
  o.brows = { ...d.brows, thick: n(d.brows?.thick, o.sex === 'm' ? .6 : o.sex === 'f' ? .3 : .45), arch: n(d.brows?.arch, o.sex === 'm' ? .4 : o.sex === 'f' ? .68 : .5), color: d.brows?.color || null };
  o.nose = { ...d.nose, length: n(d.nose?.length, .5), width: n(d.nose?.width, o.sex === 'm' ? .58 : o.sex === 'f' ? .36 : .48), bridge: d.nose?.bridge || 'straight', tip: n(d.nose?.tip, .5) };
  o.mouth = { ...d.mouth, width: n(d.mouth?.width, .5), lips: n(d.mouth?.lips, o.sex === 'f' ? .6 : .45), down: n(d.mouth?.down, 0), set: n(d.mouth?.set, 0) };
  o.ears = { ...d.ears, size: n(d.ears?.size, .5), out: n(d.ears?.out, .3), notch: d.ears?.notch || null };
  o.hair = { ...d.hair, style: d.hair?.style || 'short', color: d.hair?.color || '#3b2a20', grey: n(d.hair?.grey, 0), part: n(d.hair?.part, (r() - .5) * 1.4), volume: n(d.hair?.volume, .5), recede: n(d.hair?.recede, 0), curl: n(d.hair?.curl, 0), messy: n(d.hair?.messy, .3), dye: d.hair?.dye || null };
  if (!o.hair.cut || !HAIR[o.hair.cut]) {
    // a designed cut for the style (face-parts.js), by the seed's own stream and the cut's weight for the sex
    const fits = Object.entries(HAIR).filter(([, c]) => c.for.includes(o.hair.style) && (c.sex?.[o.sex] || 0) > 0);
    const tot = fits.reduce((a, [, c]) => a + c.sex[o.sex], 0);
    let u = stream(d, 'cut')() * tot;
    o.hair.cut = null;
    for (const [k, c] of fits) { u -= c.sex[o.sex]; if (u <= 0) { o.hair.cut = k; break; } }
  }
  o.beard = { ...d.beard, style: d.beard?.style || 'none', color: d.beard?.color || null, length: n(d.beard?.length, .5) };
  o.marks = Array.isArray(d.marks) ? d.marks : [];
  o.wear = { ...d.wear, kind: d.wear?.kind || 'shirt', color: d.wear?.color || '#4a4f57', accent: d.wear?.accent || null, collar: d.wear?.collar || null, head: d.wear?.head || 'none', headColor: d.wear?.headColor || null, glasses: d.wear?.glasses || null, neck: d.wear?.neck || [] };
  o.backdrop = d.backdrop || pick(['#3c5a66', '#5b4a3a', '#4b4060', '#3d5446', '#62483e', '#424c5e']);
  o.machine = d.machine || null;
  // pose, seeded on its own stream: a portrait sits a little turned and tilted, and most meet the viewer's eye
  // what is on one side only and the far side would hide (a streak at a temple, rings in one ear) turns toward the
  // viewer; a mark on the face shows from either side at these turns
  const rp = stream(d, 'pose'), seeded = rp() < .5 ? -1 : 1;
  const one = d.hair?.streak?.side || (o.marks.find(m => m.kind === 'earring' && m.side) || {}).side;
  const side = one ? -sideX(one) : seeded;
  o.bearing = { tilt: n(d.bearing?.tilt, (rp() - .5) * 7), nod: n(d.bearing?.nod, 0), turn: n(d.bearing?.turn, side * (.3 + rp() * .3)), look: n(d.bearing?.look, rp() < .75 ? 1 : .35) };
  o.light = lightOf(d.light, stream(d, 'light'));
  return o;
}

// ---------------------------------------------------------------- light

/**
 * Light setups: a coloured key from the upper left, a different-coloured fill in the shadows, and the room behind.
 * A scene can pass one by name or as {key, fill, back} (face(d, level, {light})); otherwise each NPC gets a seeded one.
 */
export const LIGHTS = {
  lamp: { key: '#ffc68c', fill: '#5d4ca6', back: '#3a2d4c' },       // warm lamp in a violet room
  dusk: { key: '#ffae74', fill: '#3a62b0', back: '#28365a' },       // low sun, blue shadow
  console: { key: '#b4dcff', fill: '#683a7c', back: '#1e2c40' },    // screen light, magenta shadow
  sodium: { key: '#ffaa55', fill: '#2c7276', back: '#22383a' },     // street lamp, teal shadow
  daylight: { key: '#ffe6c2', fill: '#5672c4', back: '#3c4e70' },   // window light, cool fill
  ember: { key: '#ff9060', fill: '#3a3c96', back: '#2c1f34' },      // firelight, deep blue night
};
function lightOf(spec, r) {
  if (spec && typeof spec === 'object' && spec.key && spec.fill) return { back: mix(spec.fill, '#101018', .55), ...spec };
  if (typeof spec === 'string' && LIGHTS[spec]) return { name: spec, ...LIGHTS[spec] };
  const names = Object.keys(LIGHTS), name = names[Math.floor(r() * names.length)];
  return { name, ...LIGHTS[name] };
}
/** A surface colour under the light: t=0 lit only by the fill, t=1 full key, above 1 a highlight. */
function lit(hex, t, Lt) {
  const a = hex2rgb(hex), k = hex2rgb(Lt.key), fl = hex2rgb(Lt.fill), u = Math.min(t, 1);
  return rgb2hex(a.map((v, i) => v * (.1 + fl[i] / 255 * .9 * (1 - u) + k[i] / 255 * 1.16 * t)));
}

// ---------------------------------------------------------------- the rig

/**
 * Geometry of the head and features for one expression, in portrait space (200 x 250, head centred at x=100).
 * pose (0..1) scales the NPC's own turn and tilt: icons stay frontal, the dialogue portrait takes all of it.
 */
export function rig(d, e = {}, pose = 1) {
  const E = k => e[k] || 0;
  const cx = 100;
  const m = d.build.mass, soft = d.build.soft;
  const young = clamp((22 - d.age) / 10), old = clamp((d.age - 30) / 45);
  const fw = d.face.width, fl = d.face.length;
  const shape = d.face.shape;

  let W = 35.5 + fw * 7 + (m - .5) * 5 + soft * 2 + young * 1;
  if (shape === 'long') W -= 2; if (shape === 'round') W += 1.5;
  const top = 45 - fl * 4 + young * 2;
  const eyeY = 104 + fl * 1.5 + young * 2;
  const nod = E('nod') + d.bearing.nod;
  const browBase = eyeY - 10 - d.brows.arch * .5 + young * .5;
  const noseTip = eyeY + 18.5 + d.nose.length * 5 + fl * 2.5 - young * 2;
  const mouthY = noseTip + 10.5 + fl * 2 - young * 1 + old * 1;
  const jawDrop = E('mouthOpen') * 7.5 + E('stretch') * 1.2;
  const chinY = mouthY + 16 + d.face.chin * 4 + fl * 4 + jawDrop - young * 2;

  // the frontal outline, right half (viewer's right): a crown, the temple, the cheekbone (the widest), a plane falling
  // in under it, a hard jaw corner, a squared chin
  const jaw = d.face.jaw;
  let cheekW = W * (.98 + d.face.cheekbones * .07);
  let jawW = W * (.72 + jaw * .2 + m * .06 + soft * .08);
  let chinW = 6.5 + jaw * 5 + d.face.chin * 2 + m * 2;
  let templeW = W * .93, jawY = mouthY + 3 + jaw * 3 + jawDrop * .5;
  if (shape === 'round') { cheekW = W * 1.03; jawW = W * .88; chinW += 2; jawY += 3; }
  if (shape === 'square') { jawW = Math.max(jawW, W * .92); chinW += 3; jawY = mouthY + 5 + jawDrop * .5; }
  if (shape === 'heart') { jawW = W * .68; chinW = 5.5; cheekW = W * 1.02; }
  if (shape === 'diamond') { templeW = W * .86; cheekW = W * 1.05; jawW = W * .7; chinW = 6; }
  if (shape === 'long') { jawW = W * (.74 + jaw * .16); }
  if (shape === 'triangle') { templeW = W * .88; jawW = W * .98; chinW += 4; }
  const hollowIn = (d.face.hollow + (1 - m) * .3 + old * .2) * 2.2 - soft * 2;
  const R = [
    [cx, top],
    [cx + W * .6, top + 4],
    [cx + W * .88, top + 19],
    [cx + templeW, eyeY - 13],
    [cx + cheekW, eyeY + 7],
    [cx + lerp(cheekW, jawW, .5) - hollowIn, lerp(eyeY + 7, jawY, .55)],
    [cx + jawW, jawY],
    [cx + chinW + 1.5, chinY - 4.5 - soft],
    [cx + chinW * .45, chinY - .5],
    [cx, chinY],
  ];
  const front = [...R.slice(0, -1), ...mirror(R.slice(1), cx).reverse()];

  // the turn: the head is a solid, built from horizontal sections, and rotates round the neck's axis
  const turn = clamp(E('turn') + d.bearing.turn * pose, -1.15, 1.15), phi = turn * .72;
  const nosePart = NOSE[d.nose.part] || NOSE[d.nose.bridge] || (d.nose.tip > .7 ? NOSE.button : NOSE.straight);
  const so = solid({ coarse: !pose, d, cx, W, R, top, browBase, eyeY, noseTip, mouthY, jawY, chinY, phi, n: { top: browBase + 5, tip: noseTip, len: 6 + d.nose.length * 4, w: (4.8 + d.nose.width * 3.4) * nosePart.w, profile: nosePart.profile } });
  const shiftX = so.shiftX;
  // a point on the face given where it sits seen from the front: on the surface (plus z0 out of it), turned. Stored
  // relative to the face's centre, which moves by `shift`.
  const proj = (x, z0 = 0, y = eyeY) => so.on(x, y, z0) - shiftX;
  const pr = ([x, y], z0) => [proj(x, z0, y), y];
  const head = so.outline;

  // eyes
  const eyeDx = 16.2 + d.eyes.set * 3.5 + (W - 39) * .25;
  const ew = 7.9 + d.eyes.size * 2 + young * .8;
  const oh = 3.9 + d.eyes.size * 1.2 + young * .6 - d.eyes.fold * .5;
  const sq = E('squint');
  const blink = clamp(E('blink'));
  // what the lids do with the face: a cheek raise (smile, squint) pushes the lower lid up into a crescent; a lowered
  // brow presses the upper lid's inner half down and straightens the lower lid; grief lifts the upper lid's inner end
  const cheek = clamp(Math.max(0, E('smile')) * .8 + sq * .5);
  const tense = clamp(E('browDown'));
  const grief = clamp(E('browInner') * (1 - tense));
  const look = d.bearing.look ?? 1;
  const eyes = [-1, 1].map(s => {
    const side = s < 0 ? 1 - E('asym') * .25 : 1 + E('asym') * .25;   // amused smirk: one eye narrows more
    const up = clamp(1 + .75 * E('lidUp') - .32 * sq * side - d.eyes.hooded * .22 - old * .08, .04, 1.8) * (1 - blink * .96);
    const low = clamp(1 - .45 * sq * side + .12 * E('lidUp') - d.eyes.bags * .05, .25, 1.35);
    const ex = cx + s * eyeDx, ey = eyeY;
    const inner = [ex - s * ew, ey + .7], outer = [ex + s * ew, ey - d.eyes.tilt * 1.8 + old * .5 + grief * .9];
    const topY = k => ey - oh * up * k;
    const u1 = [ex - s * ew * .45, Math.min(ey, topY(1.22) + tense * 1.7 * up - grief * 1.5 * up)], u2 = [ex + s * ew * .45, Math.min(ey, topY(1.1) + grief * 1.1 * up - tense * .3)];
    const lowY = (k, c) => Math.max(ey - oh * .35, ey + oh * low * k - cheek * side * oh * c - tense * .8);
    const l1 = [ex + s * ew * .4, lowY(.92, .95)], l2 = [ex - s * ew * .5, lowY(.82, .7)];
    const gx = clamp(E('gazeX'), -1, 1), gy = clamp(E('gazeY'), -1, 1);
    const ir = ew * .5;
    // the iris sits on the eyeball in front of the lids: with look=1 it meets the viewer whatever the head does
    const izx = ex + gx * ew * .46;
    const iris = [proj(izx, (1 - look) * 4.5), ey + gy * oh * .5 - .25 + tense * .3];
    const fore = clamp((proj(izx + 1, 0) - proj(izx - 1, 0)) / 2, .5, 1);
    return { s, ex: proj(ex), ey, inner: pr(inner, -.5), outer: pr(outer, -1.5), u1: pr(u1, .5), u2: pr(u2, 0), l1: pr(l1, 0), l2: pr(l2, .5), ir, fore, iris, up, low, cheek: cheek * side, tense, grief,
      pupil: ir * (.4 + E('lidUp') * .05 - tense * .08 + Math.max(0, E('smile')) * .05) };
  });

  // brows: inner, peak, outer
  const brows = [-1, 1].map(s => {
    const a = s > 0 ? 1 + E('asym') * .9 : 1 - E('asym') * .4;     // asymmetry lifts the subject's left brow
    const ex = cx + s * eyeDx;
    const bi = E('browInner'), bo = E('browOuter') * a, bd = E('browDown');
    const sadTilt = bi * (1 - bo * .5);
    return {
      s,
      inner: pr([ex - s * (ew + 1.5) + s * bd * 2.4, browBase + 1.5 - bi * 6.5 + bd * 5.5 - d.brows.arch * .3], 1),
      peak: pr([ex + s * ew * (.2 - sadTilt * .25), browBase - 1.8 - d.brows.arch * 2 - bi * 3.2 - bo * 4.2 + bd * 3 + sadTilt * 2 + sq * .9], 1),
      outer: pr([ex + s * (ew + 3.5), browBase + 1.2 - bo * 4.8 + bd * .8 + sadTilt * 3.2 - d.brows.arch * .6 + old * .6], -.5),
      thick: 1.3 + d.brows.thick * 2.6,
    };
  });

  // nose
  const noseW = 4.8 + d.nose.width * 3.4 + m * .6 + (d.nose.bridge === 'flat' ? 1.3 : 0) + E('sneer') * .8;
  const nose = { top: browBase + 5, tip: noseTip - E('sneer') * 1.2, w: noseW, bridge: d.nose.bridge, tipUp: d.nose.tip,
    xTop: proj(cx, 2, browBase + 5), xTip: proj(cx, 6 + d.nose.length * 4, noseTip) };

  // mouth
  const smile = E('smile'), asym = E('asym');
  const mw = 8.6 + d.mouth.width * 3.6 + (smile > 0 ? smile * 2.6 : smile * .8) + E('stretch') * 4.2 - E('lipPress') * .9 + m * .5;
  const press = clamp(E('lipPress') + d.mouth.set * .55);
  const lipK = (1 - press * .6) * (1 - old * .3);
  const ut = (1.7 + d.mouth.lips * 1.6) * lipK;
  const lt = (2.4 + d.mouth.lips * 2.2) * lipK;
  const gap = clamp(E('mouthOpen')) * 9 + E('stretch') * 1.2 + E('sneer') * .8 + Math.max(0, smile - .35) * 2.4;   // a broad smile parts the lips
  const cornerY = s => mouthY - smile * (4.6 + (s > 0 ? asym : -asym) * 2.6) * (smile < 0 ? .9 : 1) + d.mouth.down * 1.4 + E('stretch') * 1;
  const mouth = {
    y: mouthY, mw, ut, lt, gap, cx: proj(cx, 3, mouthY),
    L: pr([cx - mw, cornerY(-1)], 0), R: pr([cx + mw + (asym > 0 ? asym * 1.2 : 0), cornerY(1)], 0),
    upLift: E('sneer') * 2.6,
  };

  const earTop = eyeY - 6, earBot = noseTip + 2;
  const neckW = W * (.56 + m * .14 + soft * .05) + (d.sex === 'm' ? 1.5 : 0);
  const pivot = [cx, chinY + 14];
  const tilt = E('tilt') + d.bearing.tilt * pose;
  // a nod moves the features up or down the head
  const shift = [shiftX, clamp(nod, -1, 1) * 3.2];
  const nb = chinY + 19;   // where the neck meets the collar: a short neck, shoulders up under the jaw
  return { turn, phi, proj, so, shift, nb, cx, W, top, eyeY, browBase, noseTip, mouthY, chinY, jawY, jawW, cheekW, chinW, templeW, head, front, eyes, brows, nose, mouth, earTop, earBot, neckW, pivot, tilt, nod, old, young, ew, oh, eyeDx, E };
}

/**
 * The head as a solid, so everything on it turns as one. Each horizontal section is a superellipse: half-width a(y)
 * from the frontal outline, a front, a widest point and a back at depths (z, toward the viewer, round the neck's
 * axis) from a side profile; bumps raise the brow ridge, cheekbones, chin and lips and sink the eye sockets and the
 * cheek under the bone. Turned by phi round the vertical axis:
 *   outline  the silhouette: each section's extreme left and right, so the far cheekbone, brow and nose break the
 *            profile and the near side shows the skull behind the face
 *   on(x,y)  a point drawn on the frontal face, carried round the surface (a point past the far edge stays on it)
 *   wrap(x,y) the same for anything designed frontal around the head (hair, beard, headwear): beyond the face's edge
 *            it follows the silhouette out, so a hair mass's outside edge stays the hair's outside edge
 */
function solid(o) {
  const { d, cx, W, R, top, browBase, eyeY, noseTip, mouthY, jawY, chinY, phi, n } = o;
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const at = (rows, y, k) => {
    if (y <= rows[0][0]) return rows[0][k];
    for (let i = 1; i < rows.length; i++) if (y <= rows[i][0]) { const y0 = rows[i - 1][0], t = (y - y0) / (rows[i][0] - y0 || 1); return lerp(rows[i - 1][k], rows[i][k], t); }
    return rows[rows.length - 1][k];
  };
  // a(y): the frontal half-width, from the outline's spline
  const half = sampleSpline(R, false, o.coarse ? 2 : 4).filter((q, i, a) => !i || q[1] > a[i - 1][1]);
  const aRows = half.map(([x, y]) => [y, Math.max(.01, x - cx)]);
  // the side profile in W: front, widest, back. The crown sits over the axis; the face's front is about 1.2 W ahead
  // of it; the jaw's sides come forward to the chin
  const ZR = [[top, -.1, -.1, -.1], [top + 6, .55, -.12, -.85], [top + 19, .92, -.14, -1.2], [browBase - 6, 1.12, -.14, -1.36], [eyeY, 1.18, -.12, -1.36],
    [noseTip, 1.2, -.06, -1.0], [mouthY, 1.17, .02, -.5], [jawY, 1.08, .1, -.2], [chinY - 4, 1.0, .55, .3], [chinY, .9, .8, .7]].map(([y, ...z]) => [y, ...z.map(v => v * W)]);
  const NF = 2.6, NB = 2.1, EF = 2 / NF, EB = 2 / NB, EU = NF / 2;
  const g = (v, s) => Math.exp(-v * v / (2 * s * s));
  const male = d.sex === 'm' ? 1 : d.sex === 'f' ? 0 : .5;
  // bumps: [theta centre (abs), theta spread, y centre, y spread, amount in W]
  const BUMPS = [
    [.5, .3, browBase + 1, 3.5, .03 + male * .03],                      // brow ridge
    [.4, .2, eyeY, 4.5, -(.03 + d.eyes.deep * .05)],                    // eye socket
    [.95, .3, eyeY + 7, 6, .03 + d.face.cheekbones * .05],             // cheekbone
    [.85, .35, mouthY - 6, 6, -(.015 + (d.face.hollow + (1 - d.build.mass) * .3) * .05)],   // under it
    [0, .35, chinY - 5, 4, .03 + d.face.chin * .03],                    // chin
  ];
  // everything that varies with height, tabled at 1 px: the hot paths below only look up
  const y0 = Math.floor(top) - 1, NY = Math.ceil(chinY) + 3 - y0;
  const TA = new Float64Array(NY), TF = new Float64Array(NY), TS = new Float64Array(NY), TB = new Float64Array(NY), TG = BUMPS.map(() => new Float64Array(NY));
  for (let i = 0; i < NY; i++) {
    const y = y0 + i;
    TA[i] = at(aRows, y, 1); TF[i] = at(ZR, y, 1); TS[i] = at(ZR, y, 2); TB[i] = at(ZR, y, 3);
    BUMPS.forEach((bb, k) => { TG[k][i] = g(y - bb[2], bb[3]) * bb[4] * W; });
  }
  const look = (T, y) => { let t = y - y0; if (t <= 0) return T[0]; if (t >= NY - 1) return T[NY - 1]; const i = t | 0; t -= i; return T[i] + (T[i + 1] - T[i]) * t; };
  const bumpAt = (th, y) => { let b = 0; const a2 = Math.abs(th); for (let k = 0; k < BUMPS.length; k++) { const gy = look(TG[k], y); if (gy > .02 || gy < -.02) b += gy * g(a2 - BUMPS[k][0], BUMPS[k][1]); } return b; };
  // the nose and lips only shape the outline: the drawn features carry their own relief
  const relief = (th, y) => {
    let z = 0;
    const t = (y - n.top) / (n.tip - n.top), pr = n.profile, end = pr[pr.length - 1][0];
    if (t > 0 && t < end) z += n.len * at(pr, t, 1) * g(th * W, n.w * .55);
    return z + W * .05 * g(th, .28) * g(y - mouthY, 3.2);
  };
  const spow = (v, e) => v < 0 ? -Math.pow(-v, e) : Math.pow(v, e);
  /** A point on the section at height y, angle th round it (0 the front, +/-pi/2 the sides), out of the surface by out. */
  const pt = (y, th, out = 0, shape = true) => {
    const s = Math.sin(th), c = Math.cos(th), a = look(TA, y), zs = look(TS, y);
    let x = (a + out) * spow(s, EF), z = zs + (c >= 0 ? (look(TF, y) - zs + out) * spow(c, EF) : (zs - look(TB, y) + out) * spow(c, EB));
    if (shape) { const b = bumpAt(th, y); x += b * s; z += b * c; }
    return [x, z];
  };
  // sections down the head: the outline's own samples plus the nose, lips and chin. The limbs (where the surface turns
  // away) ignore the nose: a nose on the silhouette does not hide the cheek behind it
  const ys = [...new Set([...half.map(q => q[1]), n.tip - 4, n.tip - 1.5, n.tip + 1, n.tip + 3.5, mouthY - 2, mouthY + 2, chinY - 6]
    .filter(y => y >= top && y <= chinY).map(y => Math.round(y * 10) / 10))].sort((a, b) => a - b);
  const K = o.coarse ? 28 : 48, TH = Array.from({ length: K }, (_, i) => -Math.PI + 2 * Math.PI * i / K);
  const rows = !phi ? ys.map(y => { const w = pt(y, Math.PI / 2)[0]; return [y, w, -w, Math.PI / 2, -Math.PI / 2]; }) : ys.map(y => {
    let hi = -1e9, lo = 1e9, lh = -1e9, ll = 1e9, thHi = 0, thLo = 0;
    const scan = th => {
      const [x, z] = pt(y, th), v = x * cp + z * sp, vr = v + relief(th, y) * sp;
      if (vr > hi) hi = vr; if (vr < lo) lo = vr;
      if (v > lh) { lh = v; thHi = th; } if (v < ll) { ll = v; thLo = th; }
    };
    for (const th of TH) scan(th);
    for (let k = -6; k <= 6; k++) scan(k * .03);   // the nose and lips are narrow: sample the front finely
    return [y, hi, lo, thHi, thLo];
  });
  const R2 = rows.map(([y, hi]) => [cx + hi, y]), L2 = rows.map(([y, , lo]) => [cx + lo, y]);
  const outline = [...R2, ...L2.slice(1, -1).reverse()];
  const THI = new Float64Array(NY), TLO = new Float64Array(NY), SHI = new Float64Array(NY), SLO = new Float64Array(NY);
  for (let i = 0; i < NY; i++) { const y = y0 + i; SHI[i] = at(rows, y, 1); SLO[i] = at(rows, y, 2); THI[i] = at(rows, y, 3); TLO[i] = at(rows, y, 4); }
  const thetaOf = (x, y) => { const u = clamp((x - cx) / look(TA, y), -1, 1); return u < 0 ? -Math.asin(Math.pow(-u, EU)) : Math.asin(Math.pow(u, EU)); };
  // where a point drawn on the frontal face lands, turned; past the far limb it stays on the limb
  const on = (x, y, z0 = 0, shape = true) => {
    const X = x - cx, a = look(TA, y);
    let th = thetaOf(x, y);
    if (phi > 0) th = Math.min(th, look(THI, y)); else if (phi < 0) th = Math.max(th, look(TLO, y));
    const [px, pz] = pt(y, th, 0, shape);
    const xx = Math.abs(px - X) < 2 && Math.abs(X) <= a ? X : px;
    return cx + xx * cp + (pz + z0) * sp;
  };
  // hair hangs: below the temples it keeps the temples' section, as a curtain; a beard (hangs false) keeps to the jaw
  const hang = eyeY - 8;
  const level = (y, hangs) => hangs && y > hang ? hang : clamp(y, top + 1, chinY - 1);
  const silAt = (y, sd, out = 0, hangs = true) => { const yy = level(y, hangs); return cx + look(sd > 0 ? SHI : SLO, yy) + sd * out; };
  // the same for something designed frontal round the head: beyond the face's edge, out along the silhouette
  const wrap = (x, y, hangs = true) => {
    const yy = level(y, hangs), X = x - cx, e = Math.abs(X) - look(TA, yy);
    if (e <= 0) return on(x, yy, 0, false);
    const sd = X < 0 ? -1 : 1, edge = on(cx + sd * look(TA, yy), yy, 0, false);
    return lerp(edge, silAt(yy, sd, e, false), clamp(e / 1.5));
  };
  /** A point given on the surface (th, y), out of it by out: its image x and whether it faces the viewer (margin >= 0). */
  const place = (th, y, out = 0, hangs = true) => {
    const yy = level(y, hangs), [x, z] = pt(yy, th, out, !out);
    return { x: cx + x * cp + z * sp, y, th, margin: Math.min(look(THI, yy) - th, th - look(TLO, yy)) };
  };
  return { outline, on, wrap, place, silAt, thetaOf, hang, shiftX: look(TF, eyeY) * sp, phi, earZ: y => look(TS, y) - W * .1, a: y => look(TA, y) };
}

/**
 * Draw body() with every absolute path point bent through fn(x, y) -> x (P consults it), then carry the circles' and
 * ellipses' centres, which are attributes, the same way.
 */
function bent(fn, body) {
  const prev = MAP;
  MAP = fn;
  try {
    return body().replace(/<(circle|ellipse)([^>]*?) cx="([-\d.]+)" cy="([-\d.]+)"/g, (all, tag, pre, x, y) => '<' + tag + pre + ' cx="' + f(fn(+x, +y)) + '" cy="' + y + '"');
  } finally { MAP = prev; }
}

// ---------------------------------------------------------------- palette

function palette(d, Lt) {
  const skin = d.skin.tone;
  const [, , L] = rgb2hsl(hex2rgb(skin));
  const darkSkin = L < 40;
  const p = {
    skin,
    skinLight: shade(skin, darkSkin ? 9 : 7, -4, 4),
    skinHi: shade(skin, darkSkin ? 20 : 15, -10, 6),
    // shadows go darker and a little cooler, not more orange
    skinShadow: mix(shade(skin, darkSkin ? -10 : -13, darkSkin ? 2 : -6, -6), darkSkin ? '#24161c' : '#6c4c5c', darkSkin ? .1 : .14),
    skinDeep: mix(shade(skin, darkSkin ? -19 : -27, darkSkin ? 0 : -10, -9), darkSkin ? '#1c1018' : '#4a3046', darkSkin ? .14 : .2),
    blush: mix(skin, '#c4505a', .35 + d.skin.flush * .25),
    lip: shade(mix(skin, '#a3474f', (darkSkin ? .25 : .38) + (d.sex === 'f' ? .1 : 0)), darkSkin ? -6 : -6),
    eye: d.eyes.color,
    hair: d.hair.dye || d.hair.color,
  };
  if (d.mouth.paint) p.lip = mix(d.mouth.paint, skin, .12);
  p.lipRaw = p.lip;
  p.lipDark = shade(p.lip, -16, 4, -4);
  p.lipHi = shade(p.lip, 14, -10, 5);
  if (d.hair.grey > 0) p.hair = mix(p.hair, '#b9b6b0', d.hair.grey * .85);
  const hl = lum(p.hair);
  p.hairLight = shade(p.hair, hl < 20 ? 17 : hl > 60 ? 6 : 9, -6, 8);
  p.hairDark = shade(p.hair, hl < 20 ? -8 : hl > 60 ? -22 : -16, 4, -6);
  p.grey = '#c9c6c0';
  // brows keep more of the hair's old colour than the head does: grey hair, greying brows
  p.brow = d.brows.color || mix(mix(d.hair.color, '#b9b6b0', d.hair.grey * .6), '#2a2118', d.hair.dye ? .7 : d.hair.grey >= .8 ? .55 : lum(p.hair) > 55 ? .6 : .15);
  p.beard = d.beard.color || mix(d.hair.color, '#b9b6b0', clamp(d.hair.grey * 1.1));
  p.lash = mix(shade(skin, -45), '#1a120e', .6);
  p.sclera = mix('#efe9df', skin, .14);
  p.wear = d.wear.color; p.accent = d.wear.accent || shade(d.wear.color, 18, 10, 20);
  p.back = d.backdrop;
  p.backLight = shade(d.backdrop, 16, 6, 8);
  p.backDark = shade(d.backdrop, -20, -6, -4);
  p.key = '#ffe4bd';
  p.rim = shade(d.backdrop, 34, 22, 12);
  if (Lt) relight(p, d, Lt);
  return p;
}

/** The palette under a coloured key and fill: every surface takes the key where lit and the fill in shadow. */
function relight(p, d, Lt) {
  const skin = d.skin.tone;
  p.skinHi = lit(skin, 1.22, Lt);
  p.skinLight = lit(skin, .96, Lt);
  p.skin = lit(skin, .72, Lt);
  p.skinShadow = lit(skin, .16, Lt);
  p.skinDeep = shade(lit(skin, 0, Lt), -4, 8);
  p.contour = mix(lit(skin, 0, Lt), '#0a0612', .62);
  p.blush = mix(p.skin, '#c4505a', .3 + d.skin.flush * .25);
  p.lip = lit(p.lipRaw, .7, Lt);
  p.lipDark = lit(shade(p.lipRaw, -14, 4, -4), .5, Lt);
  p.lipHi = lit(shade(p.lipRaw, 16, -8, 5), 1.15, Lt);
  // hair: like the eyes, it keeps its own colour under a coloured light (black stays black, silver stays silver);
  // dark hair takes only a touch of the fill so it doesn't go flat; strong highlights take the key
  const hr = p.hair, dark = lum(hr) < 22, own = .38;
  const base = dark ? mix(hr, Lt.fill, .1) : hr;
  p.hair = mix(shade(lit(base, .58, Lt), dark ? 4 : 0, 4), shade(hr, dark ? 3 : 0), own);
  p.hairLight = dark ? mix(shade(lit(base, .8, Lt), 6, 4), shade(hr, 10), .5) : mix(shade(lit(base, 1.05, Lt), 4, 4), shade(hr, 8), own);
  p.hairDark = mix(shade(lit(base, .14, Lt), -2, 6), shade(hr, dark ? -4 : -14), own * .6);
  p.hairHi = dark ? mix(lit(shade(base, 14), 1, Lt), shade(hr, 16), .5) : mix(mix(shade(lit(shade(base, 14), 1.3, Lt), 4), Lt.key, .25), shade(hr, 18, -10), own);
  p.brow = lit(p.brow, .45, Lt);
  p.beard = mix(lit(p.beard, .6, Lt), p.beard, own);
  p.lash = mix(p.contour, '#07040a', .5);
  p.sclera = lit(mix('#f2ece4', skin, .12), .8, Lt);
  p.eye = shade(mix(d.eyes.color, lit(d.eyes.color, .9, Lt), .45), 3, 12);   // eyes keep their own colour: they are what people remember
  p.wear = lit(d.wear.color, .66, Lt);
  p.accent = lit(d.wear.accent || shade(d.wear.color, 18, 10, 20), .7, Lt);
  p.back = shade(mix(d.backdrop, Lt.back, .8), -4, 10);
  p.backLight = mix(p.back, Lt.key, .2);
  p.backDark = shade(p.back, -12, -4);
  p.key = Lt.key;
  p.fill = Lt.fill;
  p.rim = mix(Lt.fill, '#ffffff', .35);
}

// ---------------------------------------------------------------- render

let uidN = 0;
/** Crops of the 200 x 250 portrait space per level: icons are square, the high level is 4:5. opts.view overrides it
 * (a close-up of a live portrait); the size then follows the view's aspect. */
export const VIEW = { low: [38, 30, 124, 124], medium: [34, 30, 132, 132], high: [32, 31, 136, 170] };
/** The portrait as an SVG string. level: 'low' | 'medium' | 'high'. opts: {expr, size, uid, title, view, light, fast}. */
export function face(desc, level = 'high', opts = {}) {
  const d = desc.v ? desc : normalize(desc);
  const e = opts.expr || {};
  const id = opts.uid || ('fc' + (++uidN).toString(36));
  if (d.kind === 'machine') return machine(d, level, e, id, opts);
  // the albedo pass (flat) is unlit and frontal unless opts.pose turns it; otherwise the scene's light or the NPC's
  // own, and the pose by level
  const Lt = opts.flat ? null : opts.light ? lightOf(opts.light) : d.light;
  const pose = opts.flat ? opts.pose ?? 0 : opts.pose ?? { low: 0, medium: .5, high: 1 }[level];
  const ctx = { d, e, id, level, Lt, p: palette(d, Lt), r: rig(d, e, pose), L: level === 'low' ? 0 : level === 'medium' ? 1 : 2, flat: !!opts.flat, fast: !!opts.fast };
  // hair, beard, headwear and marks are designed frontal, then bent round the turned head
  const r = ctx.r, turned = Math.abs(r.phi) > .002;
  ctx.bendHair = body => turned ? bent((x, y) => r.so.wrap(x, y, true), body) : body();
  ctx.bendFace = (body, dx) => turned ? bent((x, y) => r.so.wrap(x, y, false) - dx, body) : body();
  const vb = opts.view || VIEW[level];
  const size = opts.size || { low: 32, medium: 96, high: 320 }[level];
  const w = size, h = Math.round(size * vb[3] / vb[2]);
  const body = level === 'low' ? lowFace(ctx) : richFace(ctx);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.join(' ') + '" width="' + w + '" height="' + h + '" role="img" class="face face-' + level + '"' +
    (opts.title ? ' aria-label="' + esc(opts.title) + '"' : ' aria-hidden="true"') + '>' + body + '</svg>';
}

// ------------------------------------------------ low: silhouette, colour and the one or two things that identify

function lowFace(c) {
  const { d, r, p, id } = c;
  const cx = r.cx;
  c.blurred = (n, inner) => '<g>' + inner + '</g>';   // no soft shading at this size
  c.headD = spline(r.head, true);
  let s = '';
  const [lx, ly, lw] = VIEW.low, lc = [lx + lw / 2, ly + lw / 2], lr = lw / 2 - .5;
  s += el('defs', {}, el('clipPath', { id: id + 'c' }, el('circle', { cx: lc[0], cy: lc[1], r: lr })));
  s += el('circle', { cx: lc[0], cy: lc[1], r: lr + .5, fill: c.Lt ? mix(p.back, p.key, .3) : p.back });   // an icon needs its silhouette: a lighter ground under the light
  s += '<g clip-path="url(#' + id + 'c)">';
  s += el('circle', { cx: lc[0] - lw * .17, cy: lc[1] - lw * .17, r: lw * .42, fill: p.backLight, opacity: .45 });
  if (hairBehind(d)) s += c.bendHair(() => el('path', { d: hairBackPath(c), fill: p.hairDark }));
  s += el('path', { d: torsoPath(c), fill: p.wear });
  s += el('path', { d: torsoPath(c), fill: '#000', opacity: .25, 'clip-path': 'url(#' + id + 'c)', transform: 'translate(14 0)' });
  s += el('rect', { x: cx - r.neckW, y: r.chinY - 18, width: r.neckW * 2, height: 40, fill: p.skinShadow });
  s += '<g transform="rotate(' + f(r.tilt) + ' ' + P(...r.pivot) + ')">';
  s += tail(c);
  s += ears(c, 'back');
  const headD = spline(r.head, true);
  s += el('path', { d: headD, fill: p.skin });
  s += ears(c, 'front');
  s += el('path', { d: headD, fill: p.skinDeep, opacity: .35, transform: 'translate(' + f(r.W * .55) + ' 0)', 'clip-path': 'url(#' + id + 'h)' });
  s += el('clipPath', { id: id + 'h' }, el('path', { d: headD }));
  if (d.beard.style !== 'none' && d.beard.style !== 'stubble') s += c.bendFace(() => el('path', { d: beardPath(c), fill: p.beard, opacity: d.beard.sparse ? .4 : 1 }), 0);
  if (d.beard.style === 'stubble') s += c.bendFace(() => el('path', { d: beardPath(c), fill: p.beard, opacity: .3 }), 0);
  // eyes as dark marks, a touch oversized so they survive 24 px
  for (const eye of r.eyes) {
    const mk = eyeMark(d, eye);
    if (mk === 'patch') { s += el('ellipse', { cx: eye.ex, cy: eye.ey, rx: 6.5, ry: 5.5, fill: '#1c1714' }); continue; }
    if (mk === 'cyber') { s += el('circle', { cx: eye.ex, cy: eye.ey, r: 3.6, fill: markColor(d, 'cyber') }); continue; }
    s += el('ellipse', { cx: eye.ex + (eye.s < 0 ? .3 : -.3), cy: eye.ey + .3, rx: 3.6, ry: clamp(2.6 * eye.up, .6, 3.4), fill: p.lash });
  }
  for (const b of r.brows) s += el('path', { d: spline([b.inner, b.peak, b.outer]), stroke: p.brow, 'stroke-width': 1.5 + d.brows.thick * 2.4, fill: 'none', 'stroke-linecap': 'round', opacity: lum(p.brow) > 60 && lum(p.skin) > 60 ? .5 : .9 });
  // glasses identify as much as hair does: worn on the eyes or pushed up, they show in the icon too
  s += glasses(c);
  const mo = r.mouth;
  s += el('path', { d: 'M' + P(...mo.L) + 'Q' + P(r.cx, mo.y + 1 + mo.gap * .5) + ' ' + P(...mo.R), stroke: p.lipDark, 'stroke-width': 1.8, fill: 'none', 'stroke-linecap': 'round', opacity: .8 });
  s += c.bendHair(() => hairFront(c));
  s += c.bendFace(() => marks(c), 0);
  s += c.bendHair(() => headwear(c));
  s += '</g></g>';
  s += el('circle', { cx: lc[0], cy: lc[1], r: lr, fill: 'none', stroke: '#000', 'stroke-opacity': .35, 'stroke-width': 2 });
  return s;
}

// ------------------------------------------------ medium and high

function richFace(c) {
  const { d, r, p, id, L } = c;
  const cx = r.cx;
  const headD = spline(r.head, true);
  c.headD = headD;
  let defs = '';
  const blur = (n, sd) => el('filter', { id: id + n, x: '-50%', y: '-50%', width: '200%', height: '200%' }, el('feGaussianBlur', { stdDeviation: sd }));
  defs += blur('b1', L === 2 ? .45 : .6) + blur('b2', 1.3) + blur('b3', 3) + blur('b4', 6) + blur('b5', 11);
  defs += el('clipPath', { id: id + 'h' }, el('path', { d: headD }));
  defs += el('mask', { id: id + 'rm' }, el('path', { d: headD, fill: '#fff' }) + el('path', { d: headD, fill: '#000', transform: 'translate(-2.6 1.2)' }));
  defs += el('linearGradient', { id: id + 'sh', gradientUnits: 'userSpaceOnUse', x1: r.cx - r.W, x2: r.cx + r.W, y1: 0, y2: 12 },
    el('stop', { offset: 0, 'stop-color': p.skinHi, 'stop-opacity': .28 }) + el('stop', { offset: .4, 'stop-color': p.skin, 'stop-opacity': 0 }) + el('stop', { offset: .64, 'stop-color': p.skinShadow, 'stop-opacity': .55 }) + el('stop', { offset: 1, 'stop-color': p.skinDeep, 'stop-opacity': .9 }));
  defs += el('radialGradient', { id: id + 'bg', cx: '.32', cy: '.3', r: '.95' },
    el('stop', { offset: 0, 'stop-color': p.backLight }) + el('stop', { offset: .55, 'stop-color': p.back }) + el('stop', { offset: 1, 'stop-color': p.backDark }));
  defs += el('radialGradient', { id: id + 'sk', cx: '.38', cy: '.36', r: '.75' },
    el('stop', { offset: 0, 'stop-color': p.skinLight }) + el('stop', { offset: .55, 'stop-color': p.skin }) + el('stop', { offset: 1, 'stop-color': p.skinShadow }));
  defs += c.Lt
    // cloth under the light: key-lit on the near shoulder, falling off into the fill in bands
    ? el('linearGradient', { id: id + 'wr', x1: 0, x2: 1, y1: 0, y2: .3 },
      el('stop', { offset: .1, 'stop-color': lit(d.wear.color, 1, c.Lt) }) + el('stop', { offset: .38, 'stop-color': p.wear }) + el('stop', { offset: .62, 'stop-color': p.wear }) + el('stop', { offset: .66, 'stop-color': lit(d.wear.color, .22, c.Lt) }) + el('stop', { offset: 1, 'stop-color': lit(d.wear.color, .05, c.Lt) }))
    : el('linearGradient', { id: id + 'wr', x1: 0, x2: 1, y1: 0, y2: .3 },
      el('stop', { offset: 0, 'stop-color': shade(p.wear, 8, -4, 4) }) + el('stop', { offset: .6, 'stop-color': p.wear }) + el('stop', { offset: 1, 'stop-color': shade(p.wear, -16, 0, -4) }));
  defs += el('linearGradient', { id: id + 'nk', x1: 0, x2: 0, y1: 0, y2: 1 },
    el('stop', { offset: 0, 'stop-color': p.skinDeep }) + el('stop', { offset: .45, 'stop-color': p.skinShadow }) + el('stop', { offset: 1, 'stop-color': c.Lt ? mix(p.skinShadow, p.skin, .55) : p.skin }));
  defs += el('linearGradient', { id: id + 'hr', x1: 0, x2: 1, y1: 0, y2: 1 },
    el('stop', { offset: 0, 'stop-color': p.hair }) + el('stop', { offset: .5, 'stop-color': mix(p.hair, p.hairDark, .55) }) + el('stop', { offset: 1, 'stop-color': p.hairDark }));
  if (c.Lt) defs += el('linearGradient', { id: id + 'ct', gradientUnits: 'userSpaceOnUse', x1: r.cx - r.W, x2: r.cx + r.W, y1: 0, y2: 0 },
    el('stop', { offset: .45, 'stop-color': p.contour, 'stop-opacity': 0 }) + el('stop', { offset: .72, 'stop-color': p.contour, 'stop-opacity': .7 }) + el('stop', { offset: 1, 'stop-color': p.contour, 'stop-opacity': 1 }));
  if (L === 2) {
    // skin grain: fine speckle and a broad blotch, both seeded so a face's texture never shifts
    const sd = hash(String(d.seed)) % 997;
    defs += el('filter', { id: id + 'tx', x: 0, y: 0, width: '100%', height: '100%' },
      el('feTurbulence', { type: 'fractalNoise', baseFrequency: 1.1, numOctaves: 2, seed: sd, result: 'n' }) +
      el('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 .85' }));
    defs += el('filter', { id: id + 'bl', x: 0, y: 0, width: '100%', height: '100%' },
      el('feTurbulence', { type: 'fractalNoise', baseFrequency: .045, numOctaves: 3, seed: sd + 7 }) +
      el('feColorMatrix', { type: 'matrix', values: '0 0 0 0 .55  0 0 0 0 .26  0 0 0 0 .3  0 0 0 -2.4 1.3' }));
  }
  let s = el('defs', {}, defs);
  const blurred = (n, inner, extra = {}) => el('g', { filter: 'url(#' + id + n + ')', ...extra }, inner);
  c.blurred = blurred;

  // backdrop: a lit wall, the key light falling from the upper left
  s += el('rect', { x: -10, y: -10, width: 220, height: 270, fill: 'url(#' + id + 'bg)' });
  if (L === 2 && !c.flat) s += blurred('b5', el('ellipse', { cx: 52, cy: 80, rx: 40, ry: 80, fill: p.key, opacity: c.Lt ? .2 : .12 }));

  if (hairBehind(d)) s += c.bendHair(() => el('path', { d: hairBackPath(c), fill: 'url(#' + id + 'hr)' }) + (L === 2 ? hairBackStrands(c) : ''));

  // body
  s += neck(c);
  s += clothes(c);
  s += neckwear(c);

  s += '<g transform="rotate(' + f(r.tilt) + ' ' + P(...r.pivot) + ')">';
  s += tail(c);
  const earsAt = layer => '<g transform="translate(0 ' + f(-r.shift[1] * .4) + ')">' + ears(c, layer) + '</g>';
  s += earsAt('back');
  s += el('path', { d: headD, fill: 'url(#' + id + 'sk)' });
  s += '<g clip-path="url(#' + id + 'h)">' + (c.flat ? '' : form(c)) + (L === 2 && !c.fast ? texture(c) : '') + '</g>';
  // the dark contour that edges the shadow side
  if (c.Lt) s += el('path', { d: headD, fill: 'none', stroke: 'url(#' + id + 'ct)', 'stroke-width': L === 2 ? 1.5 : 2 });
  s += earsAt('front');
  // skin lines are frontal and ride the face: kept to the head
  s += '<g clip-path="url(#' + id + 'h)"><g transform="translate(' + P(...r.shift) + ')">' + wrinkles(c) + '</g></g>';
  s += '<g transform="translate(' + P(...r.shift) + ')">';
  s += nose(c);
  for (const eye of r.eyes) s += drawEye(c, eye);
  s += mouth(c);
  s += c.bendFace(() => beard(c), r.shift[0]);
  for (const b of r.brows) s += brow(c, b);
  s += c.bendFace(() => marks(c), r.shift[0]);
  s += glasses(c);
  s += '</g>';
  // rim light on the shadow side, the cool back light of the room, then the dark contour that edges it
  if (!c.flat) s += blurred('b1', el('rect', { x: 0, y: 0, width: 200, height: 250, fill: mix(p.rim, p.skin, .4), mask: 'url(#' + id + 'rm)', opacity: L === 2 ? .45 : .4 }));
  s += c.bendHair(() => hairFront(c));
  s += c.bendHair(() => headwear(c));
  s += '</g>';
  if (L === 2 && !c.flat) {
    // grade: warm key from the left, cool from the right, then a vignette
    s += el('rect', { x: 0, y: 0, width: 200, height: 250, fill: p.key, opacity: .07, style: 'mix-blend-mode:soft-light' });
    s += blurred('b5', el('rect', { x: -30, y: -30, width: 260, height: 310, fill: 'none', stroke: '#000', 'stroke-width': 50, opacity: .35 }));
    // the painter's hand: every edge roughened a little, the way a brush or a pastel leaves it (skipped mid-motion)
    const cut = c.fast ? -1 : s.indexOf('</defs>') + 7;
    if (cut > 0)
    s = s.slice(0, cut) + el('filter', { id: id + 'pt', x: '-5%', y: '-5%', width: '110%', height: '110%' }, el('feTurbulence', { type: 'fractalNoise', baseFrequency: .45, numOctaves: 2, seed: hash(String(d.seed)) % 97, result: 't' }) + el('feDisplacementMap', { in: 'SourceGraphic', in2: 't', scale: 1.4, xChannelSelector: 'R', yChannelSelector: 'G' })) + '<g filter="url(#' + id + 'pt)">' + s.slice(cut) + '</g>';
  }
  return s;
}

// ------------------------------------------------ parts

function torsoPath(c) {
  const { d, r } = c;
  const cx = r.cx, m = d.build.mass;
  const sh = 64 + m * 18 + (d.sex === 'm' ? 5 : 0);
  const nb = r.nb;
  const n = r.neckW + 3;
  return 'M' + P(cx - n, nb - 6) + 'C' + P(cx - n - 12, nb + 2) + ' ' + P(cx - sh + 10, nb + 6) + ' ' + P(cx - sh, nb + 22) +
    'L' + P(cx - sh - 16, 262) + 'L' + P(cx + sh + 16, 262) + 'L' + P(cx + sh, nb + 22) +
    'C' + P(cx + sh - 10, nb + 6) + ' ' + P(cx + n + 12, nb + 2) + ' ' + P(cx + n, nb - 6) + 'Z';
}

function neck(c) {
  const { d, r, p, id, L } = c;
  const cx = r.cx, w = r.neckW;
  const y0 = r.chinY - 22, y1 = r.nb + 16;
  const neckD = 'M' + P(cx - w, y0) + 'C' + P(cx - w + 1, y0 + 25) + ' ' + P(cx - w - 2, y1 - 14) + ' ' + P(cx - w - 8, y1) + 'L' + P(cx + w + 8, y1) + 'C' + P(cx + w + 2, y1 - 14) + ' ' + P(cx + w - 1, y0 + 25) + ' ' + P(cx + w, y0) + 'Z';
  let s = el('path', { d: neckD, fill: 'url(#' + id + 'nk)' });
  // shadow side of the neck and the jaw's cast shadow
  s += c.blurred('b3', el('path', { d: 'M' + P(cx + w * .25, y0) + 'L' + P(cx + w + 2, y0) + 'L' + P(cx + w + 6, y1) + 'L' + P(cx + w * .4, y1) + 'Z', fill: p.skinDeep, opacity: c.Lt ? .7 : .45 }));
  if (c.Lt) s += el('clipPath', { id: id + 'nc' }, el('path', { d: neckD })) + el('g', { 'clip-path': 'url(#' + id + 'nc)' }, c.blurred('b2', el('path', { d: 'M' + P(cx - w - 6, r.chinY - 20) + 'L' + P(cx - w - 6, r.chinY - 4) + 'Q' + P(cx - w * .2 + r.shift[0] * .5, r.chinY + 15) + ' ' + P(cx + w + 8, r.chinY + 4) + 'L' + P(cx + w + 8, r.chinY - 20) + 'Z', fill: p.skinDeep, opacity: .8 })));
  if (L === 2) {
    const a = r.old;
    if (d.sex === 'm') s += c.blurred('b2', el('ellipse', { cx: cx + 1, cy: r.chinY + 17, rx: 3.2, ry: 4.5, fill: p.skinLight, opacity: .35 }));
    s += c.blurred('b1', el('path', { d: 'M' + P(cx - w * .7, r.chinY + 8) + 'Q' + P(cx - w * .45, r.chinY + 24) + ' ' + P(cx - w * .2, r.chinY + 38) + 'M' + P(cx + w * .7, r.chinY + 8) + 'Q' + P(cx + w * .45, r.chinY + 24) + ' ' + P(cx + w * .2, r.chinY + 38), stroke: p.skinDeep, 'stroke-width': 1.2, fill: 'none', opacity: .15 + a * .35 + (1 - d.build.mass) * .1 }));
    if (a > .4) s += c.blurred('b1', el('path', { d: 'M' + P(cx - w * .6, r.chinY + 20) + 'Q' + P(cx, r.chinY + 24) + ' ' + P(cx + w * .6, r.chinY + 20), stroke: p.skinDeep, 'stroke-width': .8, fill: 'none', opacity: (a - .4) * .6 }));
  }
  return s;
}

/** What the inner layer looks like where an open garment shows it. */
function innerLayer(d) {
  const k = d.wear.inner;
  const col = d.wear.innerColor || (k === 'shirt' ? '#d8d4ca' : k === 'jumpsuit' ? '#4d5866' : k === 'cardigan' ? '#6a6e74' : null);
  return { kind: k || 'shirt', color: col || mix(d.wear.color, '#d8d2c6', .55) };
}

function clothes(c) {
  const { d, r, p, id, L } = c;
  const cx = r.cx, k = d.wear.kind, nb = r.nb, w = r.neckW;
  const rr = stream(d, 'wear');
  const torso = torsoPath(c);
  let s = el('path', { d: torso, fill: 'url(#' + id + 'wr)' });
  const line = (dd, col, sw, op = 1) => el('path', { d: dd, stroke: col, 'stroke-width': sw, fill: 'none', opacity: op, 'stroke-linecap': 'round' });
  const dark = c.Lt ? lit(d.wear.color, .2, c.Lt) : shade(p.wear, -16), darker = shade(dark, -12), light = c.Lt ? lit(d.wear.color, .95, c.Lt) : shade(p.wear, 12, -6);
  const fold = (x0, y0, x1, y1, op) => c.blurred('b2', line('M' + P(x0, y0) + 'Q' + P((x0 + x1) / 2 + 4, (y0 + y1) / 2) + ' ' + P(x1, y1), darker, 2.2, op));
  const inner = innerLayer(d);
  if (c.Lt) inner.color = lit(inner.color, .62, c.Lt);
  const innerDark = shade(inner.color, -14);
  // the V of an open front, filled with what is underneath
  const vee = (depth, wide = 0) => {
    let v = el('path', { d: 'M' + P(cx - w - 3 - wide, nb - 7) + 'L' + P(cx, nb + depth) + 'L' + P(cx + w + 3 + wide, nb - 7) + 'Z', fill: inner.color });
    if (inner.kind === 'shirt' && L >= 1) v += el('path', { d: 'M' + P(cx - w - 1, nb - 8) + 'L' + P(cx - 2, nb + 6) + 'L' + P(cx - w + 4, nb + 8) + 'Z' + 'M' + P(cx + w + 1, nb - 8) + 'L' + P(cx + 2, nb + 6) + 'L' + P(cx + w - 4, nb + 8) + 'Z', fill: shade(inner.color, 6), stroke: innerDark, 'stroke-width': .5 });
    if (inner.kind === 'jumpsuit') v += line('M' + P(cx + 1, nb - 2) + 'L' + P(cx + 1, nb + depth), shade(inner.color, -22), 1.2) + el('path', { d: 'M' + P(cx - w - 2, nb - 7) + 'L' + P(cx - 2, nb + 6) + 'L' + P(cx - w - 8, nb + 4) + 'Z', fill: innerDark });
    if (inner.kind === 'cardigan' || inner.kind === 'shirt' && d.wear.collar === 'high') v += el('path', { d: 'M' + P(cx - w - 1, nb - 12) + 'L' + P(cx + w + 1, nb - 12) + 'L' + P(cx + w + 3, nb - 2) + 'L' + P(cx - w - 3, nb - 2) + 'Z', fill: inner.color, stroke: innerDark, 'stroke-width': .5 });
    return v;
  };
  // lapels or plain fronts falling from the neck, light on the left and turned from it on the right
  const fronts = (depth, lapel) => {
    const lw = lapel ? 12 : 4;
    return el('path', { d: 'M' + P(cx - w - 6, nb - 8) + 'L' + P(cx - 3, nb + depth) + 'L' + P(cx - 12, 252) + 'L' + P(cx - 30, 252) + 'L' + P(cx - 3 - lw, nb + depth - 4) + 'L' + P(cx - w - 6 - lw * .9, nb + 4) + 'Z', fill: light }) +
      el('path', { d: 'M' + P(cx + w + 6, nb - 8) + 'L' + P(cx + 3, nb + depth) + 'L' + P(cx + 12, 252) + 'L' + P(cx + 30, 252) + 'L' + P(cx + 3 + lw, nb + depth - 4) + 'L' + P(cx + w + 6 + lw * .9, nb + 4) + 'Z', fill: dark });
  };
  if (L >= 1) for (let i = 0; i < 3; i++) {
    const sx = (i % 2 ? 1 : -1);
    const x0 = cx + sx * (30 + rr() * 25), y0 = nb + 14 + rr() * 6;
    s += fold(x0, y0, x0 + sx * (-4 + rr() * 8), 250, .3 + rr() * .2);
  }
  const collar = d.wear.collar;
  if (k === 'vacsuit') {
    // a hard neck ring: the suit's helmet seal
    s += el('ellipse', { cx, cy: nb + 2, rx: w + 13, ry: 8, fill: '#8d949c' });
    s += el('ellipse', { cx, cy: nb + 1, rx: w + 13, ry: 8, fill: 'none', stroke: '#c9d0d6', 'stroke-width': 1.2, opacity: .8 });
    s += el('ellipse', { cx, cy: nb - .5, rx: w + 6, ry: 5, fill: shade('#5d636a', -10) });
    if (L >= 1) for (let i = -2; i <= 2; i++) s += el('circle', { cx: cx + i * (w + 10) / 2.4, cy: nb + 6 + Math.abs(i) * -.8, r: .9, fill: '#3a3f45' });
    s += line('M' + P(cx - 52, nb + 24) + 'L' + P(cx - 40, 250), p.accent, 3, .8) + line('M' + P(cx + 52, nb + 24) + 'L' + P(cx + 40, 250), p.accent, 3, .8);
  } else if (k === 'jumpsuit') {
    if (collar === 'high') s += el('path', { d: 'M' + P(cx - w - 2, nb - 13) + 'L' + P(cx + w + 2, nb - 13) + 'L' + P(cx + w + 6, nb + 2) + 'L' + P(cx - w - 6, nb + 2) + 'Z', fill: dark }) + line('M' + P(cx + 1.5, nb - 13) + 'L' + P(cx + 2, nb + 2), darker, 1);
    else {
      s += el('path', { d: 'M' + P(cx - w - 3, nb - 6) + 'L' + P(cx, nb + 12) + 'L' + P(cx + w + 3, nb - 6) + 'Z', fill: shade(p.wear, -6) });
      s += el('path', { d: 'M' + P(cx - w - 4, nb - 5) + 'L' + P(cx - 2, nb + 14) + 'L' + P(cx - w - 15, nb + 9) + 'Z', fill: light }) + el('path', { d: 'M' + P(cx + w + 4, nb - 5) + 'L' + P(cx + 2, nb + 14) + 'L' + P(cx + w + 15, nb + 9) + 'Z', fill: darker });
    }
    s += line('M' + P(cx + 2, nb + (collar === 'high' ? 2 : 12)) + 'L' + P(cx + 4, 252), darker, 1.4) + (L >= 1 ? line('M' + P(cx + 1.4, nb + 12) + 'L' + P(cx + 3.4, 252), light, .5, .6) : '');
    if (L >= 1) s += el('rect', { x: cx - 44, y: nb + 26, width: 14, height: 10, rx: 1.5, fill: 'none', stroke: darker, 'stroke-width': 1 }) + el('rect', { x: cx + 30, y: nb + 28, width: 10, height: 4, fill: p.accent, opacity: .9 });
  } else if (k === 'coat' || k === 'labcoat' || k === 'suit') {
    s += vee(k === 'suit' ? 36 : 30, k === 'coat' ? 2 : 0);
    s += fronts(k === 'suit' ? 40 : 34, true);
    if (k === 'coat' && (collar === 'high' || rr() < .35)) s += el('path', { d: 'M' + P(cx - w - 7, nb - 8) + 'Q' + P(cx - w - 10, nb - 22) + ' ' + P(cx - w - 2, nb - 25) + 'L' + P(cx - w + 2, nb - 6) + 'Z' + 'M' + P(cx + w + 7, nb - 8) + 'Q' + P(cx + w + 10, nb - 22) + ' ' + P(cx + w + 2, nb - 25) + 'L' + P(cx + w - 2, nb - 6) + 'Z', fill: dark });
    if (L >= 1 && k !== 'labcoat') s += line('M' + P(cx - 44, nb + 30) + 'L' + P(cx - 30, nb + 30), darker, 1, .6);   // a chest pocket
  } else if (k === 'cardigan') {
    s += vee(30, 0);
    s += fronts(32, false);
    if (L >= 1) for (let i = 0; i < 3; i++) s += el('circle', { cx: cx - 5 - i * 1.6, cy: nb + 38 + i * 10, r: 1.1, fill: darker });
    if (L >= 1) s += line('M' + P(cx - 4, nb + 34) + 'L' + P(cx - 10, 252), darker, .6, .6) + line('M' + P(cx + 4, nb + 34) + 'L' + P(cx + 10, 252), darker, .6, .6);
  } else if (k === 'vest') {
    // a work vest over what's underneath: the torso is the inner layer, the vest panels cover the chest
    s = el('path', { d: torso, fill: inner.color }) + el('path', { d: torso, fill: '#000', opacity: .15 });
    s += el('path', { d: 'M' + P(cx - w - 4, nb - 6) + 'L' + P(cx - w, nb - 9) + 'L' + P(cx + w, nb - 9) + 'L' + P(cx + w + 4, nb - 6) + 'Z', fill: innerDark });
    const panel = sd => 'M' + P(cx + sd * (w + 2), nb - 6) + 'L' + P(cx + sd * 6, nb + 22) + 'L' + P(cx + sd * 6, 252) + 'L' + P(cx + sd * 60, 252) + 'L' + P(cx + sd * 50, nb + 14) + 'Q' + P(cx + sd * (w + 12), nb + 2) + ' ' + P(cx + sd * (w + 2), nb - 6) + 'Z';
    s += el('path', { d: panel(-1), fill: light }) + el('path', { d: panel(1), fill: dark });
    if (L >= 1) for (const y of [nb + 34, nb + 46]) for (const sd of [-1, 1]) s += el('path', { d: 'M' + P(cx + sd * 7, y) + 'L' + P(cx + sd * 54, y + 2) + 'L' + P(cx + sd * 54, y + 5) + 'L' + P(cx + sd * 7, y + 3) + 'Z', fill: '#d8dadc', opacity: .85 });
  } else if (k === 'dress') {
    s += el('path', { d: 'M' + P(cx - w - 1, nb - 14) + 'L' + P(cx + w + 1, nb - 14) + 'L' + P(cx + w + 5, nb + 1) + 'L' + P(cx - w - 5, nb + 1) + 'Z', fill: dark }) + line('M' + P(cx - w - 2, nb - 6) + 'L' + P(cx + w + 2, nb - 6), darker, .5, .5);
    if (L >= 1) for (let i = 0; i < 4; i++) s += el('circle', { cx, cy: nb + 6 + i * 9, r: 1, fill: darker });
    if (d.wear.inner === 'cardigan') {
      // a cardigan over the dress
      const cc = d.wear.innerColor || '#5a5e64';
      s += el('path', { d: 'M' + P(cx - w - 6, nb - 2) + 'Q' + P(cx - 16, nb + 20) + ' ' + P(cx - 14, 252) + 'L' + P(cx - 90, 252) + 'L' + P(cx - 70, nb + 18) + 'Z', fill: shade(cc, 6) }) + el('path', { d: 'M' + P(cx + w + 6, nb - 2) + 'Q' + P(cx + 16, nb + 20) + ' ' + P(cx + 14, 252) + 'L' + P(cx + 90, 252) + 'L' + P(cx + 70, nb + 18) + 'Z', fill: shade(cc, -10) });
    }
  } else if (k === 'robe') {
    s += el('path', { d: 'M' + P(cx - w - 6, nb - 8) + 'Q' + P(cx - 8, nb + 26) + ' ' + P(cx + 22, 252) + 'L' + P(cx + 8, 252) + 'Q' + P(cx - 14, nb + 30) + ' ' + P(cx - w - 14, nb + 2) + 'Z', fill: dark });
    s += el('path', { d: 'M' + P(cx + w + 6, nb - 8) + 'Q' + P(cx + 10, nb + 18) + ' ' + P(cx - 2, nb + 34) + 'L' + P(cx - 6, nb + 28) + 'Q' + P(cx + 4, nb + 14) + ' ' + P(cx + w - 2, nb - 6) + 'Z', fill: light, opacity: .7 });
    if (L >= 1) s += line('M' + P(cx - w - 8, nb - 6) + 'Q' + P(cx - 6, nb + 28) + ' ' + P(cx + 18, 252), p.accent, 1.6, .8);
  } else if (k === 'uniform') {
    s += el('path', { d: 'M' + P(cx - w - 3, nb - 14) + 'L' + P(cx + w + 3, nb - 14) + 'L' + P(cx + w + 6, nb + 2) + 'L' + P(cx - w - 6, nb + 2) + 'Z', fill: dark });
    s += line('M' + P(cx - w - 5, nb + 1) + 'L' + P(cx + w + 5, nb + 1), p.accent, 1.4);
    s += line('M' + P(cx, nb + 2) + 'L' + P(cx, 252), darker, 1.2);
    for (let i = 0; i < 4; i++) s += el('circle', { cx: cx + 3.5, cy: nb + 14 + i * 12, r: 1.4, fill: p.accent });
    s += el('path', { d: 'M' + P(cx - 74, nb + 22) + 'L' + P(cx - 50, nb + 16) + 'L' + P(cx - 48, nb + 22) + 'L' + P(cx - 72, nb + 28) + 'Z' + 'M' + P(cx + 74, nb + 22) + 'L' + P(cx + 50, nb + 16) + 'L' + P(cx + 48, nb + 22) + 'L' + P(cx + 72, nb + 28) + 'Z', fill: p.accent, opacity: .85 });
  } else if (k === 'armor') {
    const plate = (x, y, wdt, hgt, col) => el('path', { d: 'M' + P(x, y) + 'l' + Q(wdt, -3) + 'l' + Q(2, hgt) + 'l' + Q(-wdt - 4, 3) + 'Z', fill: col, stroke: shade(col, 20), 'stroke-width': .8 });
    s += plate(cx - 84, nb + 18, 36, 26, light) + plate(cx + 48, nb + 15, 36, 26, dark);
    s += el('path', { d: 'M' + P(cx - 40, nb + 8) + 'L' + P(cx + 40, nb + 8) + 'L' + P(cx + 34, 250) + 'L' + P(cx - 34, 250) + 'Z', fill: p.wear, stroke: light, 'stroke-width': 1 });
    s += el('path', { d: 'M' + P(cx - w - 6, nb - 8) + 'L' + P(cx + w + 6, nb - 8) + 'L' + P(cx + w + 10, nb + 8) + 'L' + P(cx - w - 10, nb + 8) + 'Z', fill: darker });
  } else if (k === 'hood' || k === 'cloak') {
    s += el('path', { d: 'M' + P(cx - w - 16, nb - 14) + 'Q' + P(cx, nb + 14) + ' ' + P(cx + w + 16, nb - 14) + 'Q' + P(cx + w + 30, nb + 4) + ' ' + P(cx + 60, nb + 26) + 'Q' + P(cx, nb + 40) + ' ' + P(cx - 60, nb + 26) + 'Q' + P(cx - w - 30, nb + 4) + ' ' + P(cx - w - 16, nb - 14) + 'Z', fill: dark });
  } else if (k === 'apron') {
    s += el('path', { d: 'M' + P(cx - 30, nb + 16) + 'L' + P(cx + 30, nb + 16) + 'L' + P(cx + 34, 252) + 'L' + P(cx - 34, 252) + 'Z', fill: p.accent }) + line('M' + P(cx - 30, nb + 16) + 'L' + P(cx - w, nb - 4) + 'M' + P(cx + 30, nb + 16) + 'L' + P(cx + w, nb - 4), p.accent, 3);
  } else {
    // a shirt: crew neck, open, or high
    if (collar === 'high' || collar === 'turtle') s += el('path', { d: 'M' + P(cx - w - 2, nb - 16) + 'L' + P(cx + w + 2, nb - 16) + 'L' + P(cx + w + 6, nb + 4) + 'L' + P(cx - w - 6, nb + 4) + 'Z', fill: dark });
    else if (collar === 'open') s += el('path', { d: 'M' + P(cx - w - 1, nb - 7) + 'L' + P(cx, nb + 16) + 'L' + P(cx + w + 1, nb - 7) + 'Z', fill: shade(p.skin, -8) }) + line('M' + P(cx - w - 2, nb - 7) + 'L' + P(cx, nb + 17) + 'L' + P(cx + w + 2, nb - 7), darker, 1.4);
    else s += el('path', { d: 'M' + P(cx - w - 3, nb - 7) + 'Q' + P(cx, nb + 7) + ' ' + P(cx + w + 3, nb - 7) + 'L' + P(cx + w + 1, nb - 9) + 'Q' + P(cx, nb + 3) + ' ' + P(cx - w - 1, nb - 9) + 'Z', fill: shade(p.skin, -10) }) + line('M' + P(cx - w - 3, nb - 7) + 'Q' + P(cx, nb + 7) + ' ' + P(cx + w + 3, nb - 7), darker, 2);
  }
  // light on the left shoulder, shadow on the right
  if (L >= 1) s += el('clipPath', { id: id + 'tc' }, el('path', { d: torso })) + el('g', { 'clip-path': 'url(#' + id + 'tc)' }, c.blurred('b4', el('path', { d: torso, fill: '#000', opacity: .3, transform: 'translate(52 6)' })));
  return s;
}

/**
 * Ears sit on the solid's sides just behind its widest point, angled out from the head (BETA): turned, the near one
 * opens out over the side of the head (layer 'front', drawn on it) and the far one closes behind it ('back').
 */
const BETA = .42;
function ears(c, layer) {
  const { d, r, p, L } = c;
  const cx = r.cx, sz = .8 + d.ears.size * .4, out = d.ears.out;
  let s = '';
  for (const sd of [-1, 1]) {
    if ((layer === 'front') !== (r.phi * sd < -.02)) continue;
    const t = r.earTop, b = r.earBot, ym = (t + b) / 2;
    const x0 = cx + sd * r.so.a(ym) * .96 * Math.cos(r.phi) + r.so.earZ(ym) * Math.sin(r.phi);
    const k = Math.sin(BETA - sd * r.phi) / Math.sin(BETA);
    if (k < .15) continue;
    const h = (b - t) * sz, tt = b - h;
    const wd = (5.5 + out * 4) * sz * k;
    const dd = 'M' + P(x0, tt + 2) + 'C' + P(x0 + sd * wd * .9, tt - 3) + ' ' + P(x0 + sd * wd * 1.3, tt + h * .35) + ' ' + P(x0 + sd * wd * .8, tt + h * .7) + 'C' + P(x0 + sd * wd * .55, tt + h * .95) + ' ' + P(x0 + sd * 2, b + 2) + ' ' + P(x0 - sd * 1, b - 2) + 'Z';
    const col = sd < 0 ? p.skin : p.skinShadow;
    s += el('path', { d: dd, fill: col });
    if (L >= 1) {
      s += el('path', { d: 'M' + P(x0 + sd * wd * .2, tt + 3) + 'C' + P(x0 + sd * wd * .85, tt + 1) + ' ' + P(x0 + sd * wd * .95, tt + h * .45) + ' ' + P(x0 + sd * wd * .5, tt + h * .72), stroke: p.skinDeep, 'stroke-width': L === 2 ? .9 : 1.2, fill: 'none', opacity: .55 });
      s += el('ellipse', { cx: x0 + sd * wd * .32, cy: tt + h * .5, rx: wd * .22, ry: h * .16, fill: p.skinDeep, opacity: .45 });
    }
    const side = sd > 0 ? 'left' : 'right';
    if (d.ears.notch === side || d.ears.notch === 'both') s += el('path', { d: 'M' + P(x0 + sd * wd * 1.25, tt + h * .3) + 'l' + Q(-sd * 3, 2) + 'l' + Q(sd * 3, 2) + 'Z', fill: p.back });
    // earrings: hoops hang from the lobe, rings and studs climb the rim
    for (const m of d.marks) {
      if (m.kind !== 'earring' || (m.side && m.side !== side)) continue;
      const n = Math.max(1, Math.min(5, m.count || 1)), col2 = m.color || '#d9b45a';
      for (let k = 0; k < n; k++) {
        const lx = x0 + sd * (wd * (.45 + k * .22)), ly = b - k * (h * .2);
        if (m.type === 'stud') s += el('circle', { cx: f(lx), cy: f(ly), r: L === 0 ? 1.6 : 1.1, fill: col2 }) + (L === 2 ? el('circle', { cx: f(lx - .3), cy: f(ly - .3), r: .4, fill: '#fff', opacity: .9 }) : '');
        else if (m.type === 'hoop' && k === 0) s += el('circle', { cx: f(lx), cy: f(ly + 3), r: L === 0 ? 2.8 : 2.6, fill: 'none', stroke: col2, 'stroke-width': L === 0 ? 1.4 : .8 });
        else s += el('circle', { cx: f(lx + sd * .6), cy: f(ly + (m.type === 'hoop' ? 1.6 : .8)), r: m.type === 'hoop' ? 1.8 : 1.3, fill: 'none', stroke: col2, 'stroke-width': L === 0 ? 1.2 : .7 });
      }
    }
  }
  return s;
}
/** Big forms: sockets, cheekbones, the jaw's shadow side, the forehead's light. Painted soft and clipped to the head. */
/**
 * The light as a painter blocks it in: a shadow shape whose edge (the terminator) follows the face's planes, in by
 * the brow and under the cheekbone, out over the cheekbone and the jaw; a deeper core band along the far contour;
 * the lit planes laid on as flat-edged shapes. Each is one fill with a slight soft edge, so the shading reads in
 * bands, not as an airbrushed gradient. The terminator rides the turn with the features.
 */
function bands(c) {
  const { d, r, p, id, L } = c;
  const cx = r.cx, W = r.W, B = c.blurred, sx = r.shift[0];
  // turned toward the key, less of the face is in shadow; turned away, more
  const X = (fx, z0 = 0) => r.proj(cx + (fx - r.turn * .36) * W, z0) + sx;
  const smileUp = r.E('smile') * 2.5 + r.E('squint') * 1.5;
  const mw = r.mouth.mw;
  let s = '', soft = '';   // the hard-edged shapes share one soft-edge filter
  // terminator, top to bottom, then round the far side
  const T = [
    [X(.42), r.top - 12], [X(.46), lerp(r.top, r.browBase, .45)], [X(.3), r.browBase - 1],
    [X(.24, 2), r.eyeY + r.oh * 1.6], [X(.38, 1), r.eyeY + 6], [X(.7), r.eyeY + 12 - smileUp],
    [X(mw / W + .2), r.mouthY - 6], [X(mw / W + .14), r.mouthY + 4], [X(r.chinW / W + .2), r.chinY - 8], [X(.2), r.chinY + 6],
    [cx + W + 24, r.chinY + 12], [cx + W + 24, r.top - 14],
  ];
  s += B(L === 2 ? 'b2' : 'b1', el('path', { d: spline(T, true, .8), fill: p.skinShadow, opacity: .9 }));
  // core: a deeper band inside the far contour and under the jaw, the reflected light left at the very edge by the rim
  const core = r.head.map(([x, y]) => [x - W * .2 - 1.5, y - 3]);
  soft += el('path', { d: spline(r.head, true) + spline(core, true), fill: p.skinDeep, 'fill-rule': 'evenodd', opacity: .62 });
  // the nose's shadow falls across the near cheek's inner edge, toward the shadow side
  soft += el('path', { d: 'M' + P(X(.05, 4), r.nose.top + 6) + 'L' + P(X(.2, 3), r.noseTip - 2) + 'L' + P(X(.24, 2), r.noseTip + 4) + 'L' + P(X(.06, 4), r.noseTip + 3) + 'Z', fill: p.skinDeep, opacity: .35 });
  // lit planes: forehead, the near cheekbone, the bridge's flat, the chin
  soft += el('path', { d: spline([[X(-.62), r.browBase - 8], [X(-.45), r.top + 9], [X(.05), r.top + 6], [X(.12), lerp(r.top, r.browBase, .55)], [X(-.05), r.browBase - 5], [X(-.4), r.browBase - 4]], true, .9), fill: p.skinLight, opacity: .55 });
  soft += el('path', { d: spline([[X(-.78), r.eyeY + 5 - smileUp], [X(-.5), r.eyeY + 4 - smileUp], [X(-.25, 1), r.eyeY + 9 - smileUp], [X(-.42), r.eyeY + 15 - smileUp], [X(-.72), r.eyeY + 14 - smileUp]], true, .9), fill: p.skinHi, opacity: .32 });
  soft += el('path', { d: spline([[X(-.86), r.eyeY + 18], [X(-.6), r.mouthY - 4], [X(-.55), r.jawY], [X(-.78), r.jawY - 6]], true, .9), fill: p.skinLight, opacity: .3 });
  return s + B('b1', soft);
}

function form(c) {
  const { d, r, p, L } = c;
  const cx = r.cx, B = c.blurred;
  let s = '';
  const deep = d.eyes.deep;
  if (c.Lt) s += bands(c);
  else {
    // shadow side of the face
    s += el('rect', { x: 0, y: 0, width: 200, height: 250, fill: 'url(#' + c.id + 'sh)' });
    s += B('b4', el('path', { d: c.headD, fill: p.skinDeep, opacity: .35, transform: 'translate(' + f(r.W * .9) + ' 6)' }));
  }
  // eye sockets and the brow ridge above them
  for (const eye of r.eyes) {
    s += B('b3', el('ellipse', { cx: eye.ex - eye.s * 1.5, cy: eye.ey - 1.5, rx: r.ew * 1.25, ry: r.oh * 2.1, fill: p.skinDeep, opacity: .28 + deep * .3 + r.old * .1 }));
    s += B('b2', el('ellipse', { cx: eye.ex - eye.s * (r.ew * .9), cy: eye.ey - 2.5, rx: 3, ry: 3.5, fill: p.skinDeep, opacity: .25 + deep * .25 }));
  }
  // forehead and brow-ridge light
  s += B('b4', el('ellipse', { cx: cx - 6, cy: r.top + (r.browBase - r.top) * .55, rx: r.W * .55, ry: (r.browBase - r.top) * .35, fill: p.skinHi, opacity: .45 }));
  s += B('b2', el('path', { d: 'M' + P(cx - r.eyeDx - r.ew, r.browBase - 3) + 'Q' + P(cx - r.eyeDx, r.browBase - 6) + ' ' + P(cx - 3, r.browBase - 1.5), stroke: p.skinHi, 'stroke-width': 2.4, fill: 'none', opacity: .4 }));
  // cheekbones: light on the lit one, a hollow beneath both
  const smileUp = r.E('smile') * 2.5 + r.E('squint') * 1.5;
  s += B('b3', el('ellipse', { cx: cx - r.eyeDx - 2, cy: r.eyeY + 11 - smileUp, rx: 9, ry: 5.5, fill: p.skinHi, opacity: .45 + d.face.cheekbones * .15 }));
  s += B('b3', el('ellipse', { cx: cx + r.eyeDx + 4, cy: r.eyeY + 11 - smileUp, rx: 7, ry: 4.5, fill: p.skinLight, opacity: .25 }));
  const hollow = d.face.hollow + (1 - d.build.mass) * .25 + r.old * .15;
  for (const sd of [-1, 1]) s += B('b3', el('path', { d: 'M' + P(cx + sd * (r.cheekW - 3), r.eyeY + 14 - smileUp) + 'Q' + P(cx + sd * (r.eyeDx + 3), r.eyeY + 22 - smileUp) + ' ' + P(cx + sd * (r.mouth.mw + 6), r.mouthY - 2), stroke: p.skinDeep, 'stroke-width': 4 + hollow * 4, fill: 'none', opacity: (sd > 0 ? .3 : .16) + hollow * .35 }));
  // blush
  s += B('b4', el('ellipse', { cx: cx - r.eyeDx - 1, cy: r.eyeY + 15 - smileUp, rx: 8, ry: 5, fill: p.blush, opacity: .2 + d.skin.flush * .16 + r.E('smile') * .1 }));
  s += B('b4', el('ellipse', { cx: cx + r.eyeDx + 1, cy: r.eyeY + 15 - smileUp, rx: 8, ry: 5, fill: p.blush, opacity: .16 + d.skin.flush * .16 }));
  // jaw underside and chin
  s += B('b3', el('path', { d: 'M' + P(cx - r.jawW, r.jawY) + 'Q' + P(cx, r.chinY + 6) + ' ' + P(cx + r.jawW, r.jawY), stroke: p.skinDeep, 'stroke-width': 7, fill: 'none', opacity: .4 }));
  s += B('b3', el('ellipse', { cx: cx - 2, cy: r.chinY - 6, rx: r.chinW * .9, ry: 3.5, fill: p.skinHi, opacity: .35 }));
  if (d.face.cleft && L === 2) s += B('b1', el('path', { d: 'M' + P(cx, r.chinY - 7) + 'L' + P(cx, r.chinY - 2), stroke: p.skinDeep, 'stroke-width': 1.2, opacity: .5 }));
  // heavy builds: a fold under the chin
  if (d.build.soft > .3 || d.build.mass > .8) s += B('b2', el('path', { d: 'M' + P(cx - r.chinW - 6, r.chinY - 1) + 'Q' + P(cx, r.chinY + 4) + ' ' + P(cx + r.chinW + 6, r.chinY - 1), stroke: p.skinDeep, 'stroke-width': 1.6, fill: 'none', opacity: .35 }));
  // temple shadow
  s += B('b4', el('ellipse', { cx: cx + r.templeW - 2, cy: r.eyeY - 14, rx: 6, ry: 12, fill: p.skinDeep, opacity: .35 }));
  return s;
}

function texture(c) {
  const { d, r, p, id } = c;
  let s = '';
  s += el('rect', { x: 40, y: 30, width: 120, height: 160, filter: 'url(#' + id + 'tx)', opacity: .05 + d.skin.weathered * .07 + r.old * .04 + d.skin.pocked * .08, fill: '#000' });
  s += el('rect', { x: 40, y: 30, width: 120, height: 160, filter: 'url(#' + id + 'bl)', opacity: .07 + d.skin.weathered * .12 + d.skin.flush * .1 });
  if (d.skin.freckles > 0) {
    const rr = stream(d, 'freckles');
    const n = Math.round(30 + d.skin.freckles * 110);
    let dots = '';
    for (let i = 0; i < n; i++) {
      // concentrated over the nose and upper cheeks
      const a = rr() * Math.PI * 2, rad = Math.sqrt(rr()) * 22;
      const x = r.cx + Math.cos(a) * rad * 1.5, y = r.eyeY + 13 + Math.sin(a) * rad * .5;
      dots += el('circle', { cx: f(x), cy: f(y), r: f(.25 + rr() * .4), fill: shade(p.skin, -18, 2, -2), opacity: f(.2 + rr() * .35) });
    }
    s += dots;
  }
  if (d.skin.spots > 0) {
    // age spots: a few soft brown patches on the cheeks and temples
    const rr = stream(d, 'spots');
    for (let i = 0; i < 9; i++) {
      const sd = rr() < .5 ? -1 : 1, x = r.cx + sd * (r.eyeDx + (rr() - .2) * 12), y = r.eyeY + (rr() < .3 ? -14 : 8 + rr() * 10);
      s += c.blurred('b1', el('ellipse', { cx: f(x), cy: f(y), rx: f(.8 + rr() * 1.4), ry: f(.7 + rr()), fill: shade(p.skin, -16, 12, 2), opacity: f(.35 * d.skin.spots) }));
    }
  }
  if (d.skin.pocked > 0) {
    const rr = stream(d, 'pocks');
    for (let i = 0; i < 40 * d.skin.pocked; i++) {
      const sd = rr() < .5 ? -1 : 1;
      const x = r.cx + sd * (r.eyeDx + (rr() - .3) * 14), y = r.eyeY + 12 + rr() * 16;
      s += el('circle', { cx: f(x), cy: f(y), r: f(.5 + rr() * .6), fill: p.skinDeep, opacity: .25 });
      s += el('circle', { cx: f(x - .3), cy: f(y - .3), r: f(.3), fill: p.skinHi, opacity: .25 });
    }
  }
  return s;
}

/** Lines that age and expression put in the skin. Each fades in with age and with the muscle that makes it. */
function wrinkles(c) {
  const { d, r, p, L } = c;
  if (L === 0) return '';
  const cx = r.cx, E = r.E, a = r.old;
  const w = d.skin.weathered;
  const parts = [];
  const ln = (dd, op, sw = .8) => { if (op > .03) parts.push(el('path', { d: dd, stroke: p.skinDeep, 'stroke-width': sw, fill: 'none', opacity: f(clamp(op, 0, .85)), 'stroke-linecap': 'round' })); };
  const hl = (dd, op, sw = .8) => { if (op > .03) parts.push(el('path', { d: dd, stroke: p.skinHi, 'stroke-width': sw, fill: 'none', opacity: f(clamp(op, 0, .7)), 'stroke-linecap': 'round' })); };
  const raise = E('browInner') + E('browOuter') * .7;
  // forehead
  const fy0 = r.browBase - 7;
  const lines = d.lines || {};
  for (let i = 0; i < (L === 2 ? 3 : 2); i++) {
    const y = fy0 - i * 4.6, k = (1 - i * .22);
    const lift = E('browInner') * 2.5 * (1 - i * .2);
    const op = (Math.max(0, a - .3) * .55 + w * .1 + (lines.forehead || 0) * .45 + raise * .45) * k - (L === 1 ? .12 : 0);
    ln('M' + P(cx - 18 + i * 2, y + 1.5) + 'Q' + P(cx - 8, y - .5 - lift) + ' ' + P(cx, y - lift * .8) + 'Q' + P(cx + 8, y - .5 - lift) + ' ' + P(cx + 18 - i * 2, y + 1.5), op, L === 2 ? .9 : 1.1);
    if (L === 2) hl('M' + P(cx - 16 + i * 2, y + 2.6) + 'Q' + P(cx, y + 1.6 - lift * .8) + ' ' + P(cx + 16 - i * 2, y + 2.6), op * .6, .7);
  }
  // frown lines between the brows
  const bd = E('browDown');
  ln('M' + P(cx - 3, r.browBase - 5) + 'Q' + P(cx - 2, r.browBase) + ' ' + P(cx - 2.4, r.browBase + 3), bd * .7 + a * .2 + E('lipPress') * .1 + lines.frown * .45, 1);
  ln('M' + P(cx + 3, r.browBase - 5) + 'Q' + P(cx + 2, r.browBase) + ' ' + P(cx + 2.6, r.browBase + 3), bd * .7 + a * .2 + lines.frown * .35, 1);
  if (bd > .3) ln('M' + P(cx - 6, r.browBase - 1) + 'Q' + P(cx, r.browBase + 1.5) + ' ' + P(cx + 6, r.browBase - 1), (bd - .3) * .5, 1);
  // sad brows push a horseshoe into the forehead centre
  if (E('browInner') > .3) ln('M' + P(cx - 6, r.browBase - 2) + 'Q' + P(cx, r.browBase - 9) + ' ' + P(cx + 6, r.browBase - 2), (E('browInner') - .3) * .6, .9);
  // crow's feet
  for (const eye of r.eyes) {
    const o = eye.outer, s = eye.s;
    const op = a * .45 + E('squint') * .45 + Math.max(0, E('smile')) * .3 + w * .2 + lines.crows * .4;
    for (let i = -1; i <= 1; i++) ln('M' + P(o[0] + s * 1.5, o[1] + i * 1.6) + 'q' + Q(s * 2.5, i * 1.2) + ' ' + Q(s * 5, i * 2.6 - .5), op * (i ? .8 : 1), .7);
    // under-eye: bag and the fold beneath it
    const by = eye.ey + r.oh * eye.low + 2;
    ln('M' + P(eye.ex - s * r.ew * .7, by) + 'Q' + P(eye.ex, by + 2.2 + d.eyes.bags * 1.5) + ' ' + P(eye.ex + s * r.ew * .9, by - .8), a * .45 + d.eyes.bags * .45 + E('squint') * .3, .8);
    if (L === 2) hl('M' + P(eye.ex - s * r.ew * .6, by + 1.2) + 'Q' + P(eye.ex, by + 3.6 + d.eyes.bags * 1.5) + ' ' + P(eye.ex + s * r.ew * .8, by + .4), a * .3 + d.eyes.bags * .3, .8);
    if (a > .55) ln('M' + P(eye.ex - s * r.ew * .9, by + 3) + 'Q' + P(eye.ex + s * 1, by + 6) + ' ' + P(eye.ex + s * r.ew * 1.2, by + 2.5), (a - .55) * .8, .7);
  }
  // nasolabial folds: from the nose wing past the mouth corner; a smile pushes them out and deepens them
  const sm = E('smile');
  for (const s of [-1, 1]) {
    const corner = s < 0 ? r.mouth.L : r.mouth.R;
    const x0 = cx + s * (r.nose.w + 1.5), y0 = r.noseTip - 2.5;
    const x2 = corner[0] + s * (2.6 + Math.max(0, sm) * 1.8), y2 = corner[1] + 3.5 + a * 2;
    const op = .16 + a * .35 + Math.max(0, sm) * .45 + E('sneer') * .4 + w * .1 + lines.smile * .3 - r.young * .15;
    ln('M' + P(x0, y0) + 'Q' + P(x0 + s * (4.5 + Math.max(0, sm) * 3), (y0 + y2) / 2 - Math.max(0, sm) * 1.5) + ' ' + P(x2, y2), op * (s > 0 ? 1.1 : .9), L === 2 ? 1.1 : 1.2);
    if (L === 2) hl('M' + P(x0 - s * 1.4, y0 + 1) + 'Q' + P(x0 + s * (3 + Math.max(0, sm) * 3), (y0 + y2) / 2) + ' ' + P(x2 - s * 1.6, y2 - .5), op * .55, 1);
    // marionette lines from the mouth corners down
    ln('M' + P(corner[0] + s * .8, corner[1] + 1.5) + 'Q' + P(corner[0] + s * 1.6, corner[1] + 5) + ' ' + P(corner[0] + s * 1, corner[1] + 9), (a - .45) * .8 + Math.max(0, -sm) * .4, .9);
  }
  // nose wrinkles from a sneer
  if (E('sneer') > .1) for (let i = 0; i < 3; i++) ln('M' + P(cx - 3.5, r.eyeY + 1 + i * 2) + 'Q' + P(cx, r.eyeY - .5 + i * 2) + ' ' + P(cx + 3.5, r.eyeY + 1 + i * 2), E('sneer') * .55, .7);
  // chin dimpling from pressed lips or sorrow
  const chinPress = E('lipPress') * .5 + Math.max(0, -sm) * .4;
  if (chinPress > .15 && L === 2) {
    const rr = stream(d, 'chin');
    for (let i = 0; i < 6; i++) parts.push(el('circle', { cx: f(cx + (rr() - .5) * r.chinW * 1.4), cy: f(r.chinY - 7 + rr() * 4), r: .6, fill: p.skinDeep, opacity: f(chinPress * .5) }));
  }
  return c.blurred('b1', parts.join(''));
}

function nose(c) {
  const { d, r, p, L } = c;
  const cx = r.cx, n = r.nose, B = c.blurred, t = n.tip, w = n.w;
  let s = '';
  const sh = p.skinDeep;
  // the shadow side of the bridge, and its lit ridge
  const bump = n.bridge === 'hooked' ? 2.2 : n.bridge === 'broken' ? 1.5 : 0;
  const lean = (n.bridge === 'broken' ? (sideX(d.nose.lean) || 1) * 1.2 : 0) + (n.xTip - n.xTop);   // a turned head swings the tip further than the bridge
  const kink = n.bridge === 'broken' ? 1.8 : 0;
  const midY = (n.top + t) / 2;
  // the nose's side plane, turned from the key: a clear band from the bridge down to the wing
  if (c.Lt) s += B('b1', el('path', { d: 'M' + P(cx + 1.4, n.top + 3) + 'Q' + P(cx + 2.8 + bump + kink, midY) + ' ' + P(cx + w * .45, t - 3.6) + 'L' + P(cx + w + 1.2, t + .6) + 'L' + P(cx + w + 2.6, t - 4.5) + 'Q' + P(cx + 6.5 + bump, midY) + ' ' + P(cx + 5.5, n.top + 3) + 'Z', fill: p.skinShadow, opacity: .8 }));
  s += B('b2', el('path', { d: 'M' + P(cx + 2.5, n.top + 2) + 'Q' + P(cx + 4.5 + bump + kink, midY) + ' ' + P(cx + w * .55, t - 2) + 'L' + P(cx + w * .9, t + 1) + 'L' + P(cx + 4, t - 1) + 'Q' + P(cx + 2, midY) + ' ' + P(cx + 1, n.top + 2) + 'Z', fill: sh, opacity: .5 }));
  s += B('b2', el('path', { d: 'M' + P(cx - 1.6, n.top + 4) + 'Q' + P(cx - 1.8 - bump * .5 + kink, midY) + ' ' + P(cx - 1.2, t - 2.5), stroke: p.skinHi, 'stroke-width': L === 2 ? 1.7 : 2.2, fill: 'none', opacity: .65 }));
  if (n.bridge === 'hooked') s += B('b1', el('ellipse', { cx: cx - 1.2, cy: midY, rx: 1.4, ry: 2.4, fill: p.skinHi, opacity: .6 }));
  if (n.bridge === 'broken') s += B('b1', el('path', { d: 'M' + P(cx - 2.2, midY - 1) + 'l' + Q(2.8, 1.5), stroke: sh, 'stroke-width': 1, opacity: .5 }));
  // tip, wings, nostrils, and the shadow the nose casts on the upper lip
  const tipR = 2.4 + d.nose.width * .9 + (d.nose.bridge === 'bulbous' ? 1.4 : 0);
  s += B('b2', el('circle', { cx: cx - .5, cy: t - 1.8, r: tipR + 1.5, fill: p.skinLight, opacity: .55 }));
  s += B('b1', el('circle', { cx: cx - 1.2, cy: t - 2.5, r: tipR * .45, fill: p.skinHi, opacity: .8 }));
  for (const sd of [-1, 1]) {
    const wx = cx + sd * w;
    s += el('path', { d: 'M' + P(wx - sd * .5, t - 4.8) + 'C' + P(wx + sd * 1.6, t - 3.6) + ' ' + P(wx + sd * 1.4, t + .4) + ' ' + P(wx - sd * 1.2, t + 1.4), stroke: sh, 'stroke-width': L === 2 ? .9 : 1.2, fill: 'none', opacity: sd > 0 ? .75 : .5, 'stroke-linecap': 'round' });
    const up = d.nose.tip > .65 ? 1.3 : 1;
    s += el('ellipse', { cx: cx + sd * w * .48, cy: t + 1.1, rx: 1.75 + d.nose.width * .5, ry: .95 * up, fill: shade(p.skinDeep, -14), opacity: .85, transform: 'rotate(' + f(sd * -12) + ' ' + P(cx + sd * w * .48, t + 1.1) + ')' });
  }
  s += B('b2', el('ellipse', { cx: cx + 1.8, cy: t + 3.6, rx: w * .9, ry: 1.9, fill: sh, opacity: .5 }));
  // philtrum
  if (L === 2) s += B('b1', el('path', { d: 'M' + P(cx - 1.6, t + 2.5) + 'L' + P(cx - 2.6, r.mouth.y - r.mouth.ut - .5) + 'M' + P(cx + 1.6, t + 2.5) + 'L' + P(cx + 2.6, r.mouth.y - r.mouth.ut - .5), stroke: sh, 'stroke-width': .8, opacity: .3 }) + el('path', { d: 'M' + P(cx - .7, t + 3) + 'L' + P(cx - 1, r.mouth.y - r.mouth.ut - 1), stroke: p.skinHi, 'stroke-width': 1, opacity: .35 }));
  // a broken nose set crooked: the bridge stays, the tip leans
  const k = lean / (t - n.top), dx = n.xTop - cx;
  if (Math.abs(k) > .001 || Math.abs(dx) > .05) return '<g transform="matrix(1 0 ' + k.toFixed(4) + ' 1 ' + f(dx - k * n.top) + ' 0)">' + s + '</g>';
  return s;
}

/** What a mark does to an eye: a patch, an optic, a milky blind eye, or nothing. */
function eyeMark(d, eye) {
  const side = eye.s > 0 ? 'left' : 'right';   // the subject's left is the viewer's right
  for (const m of d.marks) {
    if (m.side && m.side !== side) continue;
    if (m.kind === 'eyepatch') return 'patch';
    if (m.kind === 'cybereye') return 'cyber';
    if (m.kind === 'blind') return 'blind';
  }
  return null;
}
function markColor(d, kind) { return (d.marks.find(m => m.kind === kind) || {}).color || '#ff6a3a'; }

function drawEye(c, eye) {
  const { d, r, p, id, L } = c;
  const mk = eyeMark(d, eye);
  const s0 = eye.s, B = c.blurred;
  const open = 'M' + P(...eye.inner) + 'C' + P(...eye.u1) + ' ' + P(...eye.u2) + ' ' + P(...eye.outer) + 'C' + P(...eye.l1) + ' ' + P(...eye.l2) + ' ' + P(...eye.inner) + 'Z';
  const upper = 'M' + P(...eye.inner) + 'C' + P(...eye.u1) + ' ' + P(...eye.u2) + ' ' + P(...eye.outer);
  const lower = 'M' + P(...eye.outer) + 'C' + P(...eye.l1) + ' ' + P(...eye.l2) + ' ' + P(...eye.inner);
  const cid = id + 'e' + (s0 > 0 ? 'l' : 'r');
  let s = '';
  if (mk === 'patch') {
    const ex = eye.ex, ey = eye.ey;
    s += el('path', { d: 'M' + P(ex - 11, r.browBase - 6) + 'L' + P(ex + 11 * s0, ey - 7 - (s0 > 0 ? 0 : 0)) + 'M' + P(ex - s0 * 30, ey - 22) + 'L' + P(ex + s0 * 30, ey + 6), stroke: '#1a1512', 'stroke-width': 1.4, fill: 'none' });
    s += el('path', { d: 'M' + P(ex - 8.5, ey - 6) + 'Q' + P(ex, ey - 9) + ' ' + P(ex + 8.5, ey - 6) + 'Q' + P(ex + 9.5, ey + 4) + ' ' + P(ex, ey + 7.5) + 'Q' + P(ex - 9.5, ey + 4) + ' ' + P(ex - 8.5, ey - 6) + 'Z', fill: '#221c18', stroke: '#3c332c', 'stroke-width': .8 });
    if (L === 2) s += el('path', { d: 'M' + P(ex - 6, ey - 5) + 'Q' + P(ex - 3, ey - 6.8) + ' ' + P(ex + 1, ey - 6.4), stroke: '#6a5c50', 'stroke-width': .8, fill: 'none' });
    return s;
  }
  s += el('clipPath', { id: cid }, el('path', { d: open }));
  // eyeball: sclera shaded under the lid, iris, pupil
  const sclera = mk === 'blind' ? mix(p.sclera, '#b8c4c8', .4) : p.sclera;
  s += el('path', { d: open, fill: sclera });
  let ball = '';
  ball += el('ellipse', { cx: eye.ex, cy: eye.ey - r.oh * 1.2, rx: r.ew * 1.2, ry: r.oh * 1.2, fill: p.skinDeep, opacity: c.Lt ? .6 + eye.tense * .2 : .45, filter: 'url(#' + id + 'b2)' });
  ball += el('ellipse', { cx: eye.ex + s0 * r.ew * .9, cy: eye.ey, rx: r.ew * .4, ry: r.oh * 1.4, fill: p.skinDeep, opacity: c.Lt ? .45 : .25, filter: 'url(#' + id + 'b2)' });
  if (c.Lt) ball += el('ellipse', { cx: eye.ex - s0 * r.ew * .95, cy: eye.ey, rx: r.ew * .3, ry: r.oh * 1.2, fill: p.skinDeep, opacity: .3, filter: 'url(#' + id + 'b2)' });
  const [ix, iy] = eye.iris, ir = eye.ir, irx = ir * (eye.fore || 1);
  if (mk === 'cyber') {
    const col = markColor(d, 'cyber');
    ball += el('circle', { cx: ix, cy: iy, r: ir * 1.15, fill: '#1d2328' }) + el('circle', { cx: ix, cy: iy, r: ir * .78, fill: col, opacity: .9 }) +
      el('circle', { cx: ix, cy: iy, r: ir * .35, fill: '#fff6e0' }) + el('circle', { cx: ix, cy: iy, r: ir * 1.15, fill: 'none', stroke: '#9aa3ab', 'stroke-width': .6 });
    if (L === 2) for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; ball += el('line', { x1: f(ix + Math.cos(a) * ir * .8), y1: f(iy + Math.sin(a) * ir * .8), x2: f(ix + Math.cos(a) * ir * 1.1), y2: f(iy + Math.sin(a) * ir * 1.1), stroke: '#6b747c', 'stroke-width': .5 }); }
  } else if (mk === 'blind') {
    ball += el('circle', { cx: ix, cy: iy, r: ir, fill: mix(p.eye, '#c8d2d6', .7) });
  } else {
    const irisDark = shade(p.eye, -24, 6), irisLight = shade(p.eye, 16, -4, 8);
    if (L === 2) {
      ball += el('radialGradient', { id: cid + 'i' }, el('stop', { offset: .3, 'stop-color': irisLight }) + el('stop', { offset: .72, 'stop-color': p.eye }) + el('stop', { offset: 1, 'stop-color': irisDark }));
      ball += el('ellipse', { cx: ix, cy: iy, rx: irx, ry: ir, fill: 'url(#' + cid + 'i)' });
      // light through the iris: the lower half, opposite the catchlight, glows
      if (c.Lt) ball += el('ellipse', { cx: ix + irx * .2, cy: iy + ir * .38, rx: irx * .6, ry: ir * .42, fill: shade(p.eye, 22, 10), opacity: .6, filter: 'url(#' + id + 'b1)' });
      // iris fibres
      const rr = stream(d, 'iris' + s0);
      let fib = '';
      for (let k = 0; k < 22; k++) {
        const a = k / 22 * Math.PI * 2 + rr() * .2, r0 = ir * (.45 + rr() * .1), r1 = ir * (.8 + rr() * .18);
        fib += el('line', { x1: f(ix + Math.cos(a) * r0), y1: f(iy + Math.sin(a) * r0), x2: f(ix + Math.cos(a) * r1), y2: f(iy + Math.sin(a) * r1), stroke: rr() < .5 ? irisLight : irisDark, 'stroke-width': .28, opacity: .7 });
      }
      ball += fib;
      ball += el('ellipse', { cx: ix, cy: iy, rx: irx, ry: ir, fill: 'none', stroke: shade(p.eye, -38), 'stroke-width': c.Lt ? .9 : .7, opacity: .85 });
    } else {
      ball += el('circle', { cx: ix, cy: iy, r: ir, fill: p.eye }) + el('circle', { cx: ix, cy: iy, r: ir, fill: 'none', stroke: irisDark, 'stroke-width': .8 });
    }
    ball += el('ellipse', { cx: ix, cy: iy, rx: eye.pupil * (eye.fore || 1), ry: eye.pupil, fill: '#0d0a09' });
    if (d.eyes.ring && sideX(d.eyes.ring) === s0 && L >= 1) ball += el('circle', { cx: ix, cy: iy, r: ir * .82, fill: 'none', stroke: '#d8d2c4', 'stroke-width': L === 2 ? .7 : 1, opacity: .7 });
  }
  // lid's shadow across the top of the eye, then catchlights from the key light
  ball += el('path', { d: upper, stroke: '#000', 'stroke-width': 2.6, fill: 'none', opacity: .28, filter: 'url(#' + id + 'b1)' });
  s += el('g', { 'clip-path': 'url(#' + cid + ')' }, ball);
  if (mk !== 'blind') {
    // catchlights: the key's window in the wet of the eye, bigger the wider the eye; the lit eye is the glossier
    const wide = .8 + clamp(eye.up) * .3, glint = c.Lt ? mix('#ffffff', p.key, .3) : '#fff', near = s0 < 0 ? 1 : .8;
    s += el('ellipse', { cx: ix - irx * .38, cy: iy - ir * .4, rx: (L === 2 ? ir * .24 : ir * .26) * wide * near, ry: (L === 2 ? ir * .2 : ir * .25) * wide * near, fill: glint, opacity: eye.up > .2 ? .95 : 0 });
    if (L === 2) s += el('circle', { cx: ix + irx * .35, cy: iy + ir * .32, r: ir * .09, fill: glint, opacity: eye.up > .2 ? .55 : 0 });
  }
  // tear duct
  if (L === 2) s += el('ellipse', { cx: eye.inner[0] + s0 * 1, cy: eye.inner[1] - .2, rx: 1, ry: .7, fill: mix(p.blush, '#e08080', .3), opacity: .8 });
  // lids: lash line, crease, lower lid
  const lashW = (L === 2 ? 1.25 + (d.sex === 'f' ? .3 : 0) : 1.4) + (c.Lt ? .35 + eye.tense * .5 : 0);
  s += el('path', { d: upper, stroke: p.lash, 'stroke-width': lashW, fill: 'none', 'stroke-linecap': 'round' });
  // the lash line thickens to the outer corner, the way a painter flicks it
  if (c.Lt) s += el('path', { d: 'M' + P(...eye.u2) + 'Q' + P(eye.outer[0] - s0 * .5, eye.outer[1] - .8) + ' ' + P(eye.outer[0] + s0 * .9, eye.outer[1] + .2), stroke: p.lash, 'stroke-width': lashW * 1.25, fill: 'none', 'stroke-linecap': 'round', opacity: .85 });
  if (L === 2 && d.sex === 'f') {
    // lashes at the outer half
    let lash = '';
    for (let k = 0; k < 6; k++) {
      const t = .55 + k * .08, x = bez(eye.inner[0], eye.u1[0], eye.u2[0], eye.outer[0], t), y = bez(eye.inner[1], eye.u1[1], eye.u2[1], eye.outer[1], t);
      lash += 'M' + P(x, y) + 'l' + Q(s0 * (.8 + k * .15), -1.2 + k * .1);
    }
    s += el('path', { d: lash, stroke: p.lash, 'stroke-width': .5, fill: 'none', 'stroke-linecap': 'round' });
  }
  const crease = 2.6 + (1 - d.eyes.hooded) * 1.5 - d.eyes.fold * 1.8;
  const cr = 'M' + P(eye.inner[0] + s0 * 1, eye.inner[1] - 1.5) + 'C' + P(eye.u1[0], eye.u1[1] - crease - eye.up * .6) + ' ' + P(eye.u2[0], eye.u2[1] - crease - eye.up * .5) + ' ' + P(eye.outer[0] + s0 * 1.5, eye.outer[1] - .8);
  if (d.eyes.fold < .7) s += el('path', { d: cr, stroke: p.skinDeep, 'stroke-width': L === 2 ? .8 : 1, fill: 'none', opacity: .55, filter: L === 2 ? 'url(#' + id + 'b1)' : undefined });
  if (d.eyes.hooded > .3 && L === 2) s += B('b1', el('path', { d: cr, stroke: p.skinLight, 'stroke-width': 2, fill: 'none', opacity: d.eyes.hooded * .6, transform: 'translate(0 1.4)' }));
  // the lid skin between crease and lashes, a touch lighter on the lit side
  if (L === 2) s += B('b1', el('path', { d: upper, stroke: s0 < 0 ? p.skinHi : p.skinLight, 'stroke-width': 1.6, fill: 'none', opacity: .35, transform: 'translate(0 -1.8)' }));
  s += el('path', { d: lower, stroke: p.skinDeep, 'stroke-width': L === 2 ? .7 : .9, fill: 'none', opacity: .6 });
  if (L === 2) s += el('path', { d: lower, stroke: p.skinHi, 'stroke-width': .6, fill: 'none', opacity: .4 + (eye.grief || 0) * .4, transform: 'translate(0 .9)' });
  // a smile's raised cheek: the lower lid bunches into a crescent with a fold under it
  if (L >= 1 && eye.cheek > .15) {
    const ly = Math.max(eye.l1[1], eye.l2[1]) + 2.6;
    s += B('b1', el('path', { d: 'M' + P(eye.inner[0] + s0 * .5, ly - 1.2) + 'Q' + P(eye.ex, ly + 1.6) + ' ' + P(eye.outer[0] + s0 * 1.5, ly - 2.4), stroke: p.skinDeep, 'stroke-width': .9, fill: 'none', opacity: f(clamp(eye.cheek) * .65) }));
    if (L === 2) s += B('b1', el('path', { d: 'M' + P(eye.inner[0] + s0 * 1, ly - 2.4) + 'Q' + P(eye.ex, ly) + ' ' + P(eye.outer[0], ly - 3.2), stroke: p.skinHi, 'stroke-width': 1.3, fill: 'none', opacity: f(clamp(eye.cheek) * .4) }));
  }
  // grief: the eye wells; a wet glint along the lower lid
  if (L === 2 && eye.grief > .3) s += el('path', { d: lower, stroke: '#fff', 'stroke-width': .5, fill: 'none', opacity: f((eye.grief - .3) * .7), transform: 'translate(0 -.5)' });
  return s;
}
const bez = (a, b, cc, dd, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * cc + t * t * t * dd; };

function brow(c, b) {
  const { d, r, p, L } = c;
  const pts = sampleSpline([b.inner, b.peak, b.outer], false, 10);
  const col = p.brow;
  if (L < 2) {
    // a tapered filled stroke
    const top = [], bot = [];
    pts.forEach(([x, y], i) => { const t = i / (pts.length - 1), th = b.thick * (1 - t * .55); top.push([x, y - th * .55]); bot.push([x, y + th * .45]); });
    return el('path', { d: spline([...top, ...bot.reverse()], true), fill: col, opacity: .92 });
  }
  // hair by hair: inner hairs rise, the rest lie along the arch
  const rr = stream(d, 'brow' + b.s);
  const n = Math.round(34 + d.brows.thick * 50);
  let s = '';
  const base = [];
  pts.forEach(([x, y], i) => { const t = i / (pts.length - 1), th = b.thick * (1 - t * .55); base.push([x, y - th * .5], [x, y + th * .5]); });
  const top = base.filter((_, i) => i % 2 === 0), bot = base.filter((_, i) => i % 2 === 1).reverse();
  s += c.blurred('b1', el('path', { d: spline([...top, ...bot], true), fill: col, opacity: .45 }));
  let dd = '';
  for (let i = 0; i < n; i++) {
    const t = Math.pow(rr(), .85), idx = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
    const [x0, y0] = pts[idx], [x1, y1] = pts[idx + 1];
    const tx = x1 - x0, ty = y1 - y0, tl = Math.hypot(tx, ty) || 1;
    const th = b.thick * (1 - t * .55);
    const off = (rr() - .5) * th;
    const px = x0 - ty / tl * off, py = y0 + tx / tl * off;
    const along = t < .18 ? .3 : 1;   // inner hairs point up
    const len = 1.6 + rr() * 1.8;
    const dx = tx / tl * along * len, dy = ty / tl * along * len - (t < .18 ? len * .9 : len * .25);
    dd += 'M' + P(px, py) + 'q' + Q(dx * .5, dy * .5 - .2) + ' ' + Q(dx, dy);
  }
  s += el('path', { d: dd, stroke: col, 'stroke-width': .45, fill: 'none', 'stroke-linecap': 'round', opacity: .9 });
  return s;
}

/** The lips' outlines for an expression: shared by the drawing and the research renderer's relief. */
function lipGeom(r) {
  const m = r.mouth, cx = m.cx;
  const [Lx, Ly] = m.L, [Rx, Ry] = m.R;
  const y = m.y, g = m.gap, up = m.upLift;
  const cornersY = (Ly + Ry) / 2;
  const curve = (y - cornersY);                     // positive when smiling: the line bows down in the middle
  const stTop = y - g * .38 - up * .6, stBot = y + g * .62;
  // upper lip: top edge with a cupid's bow, bottom edge along the stomion
  const ut = m.ut, lt = m.lt;
  const bowY = stTop - ut;
  const upperTop = 'M' + P(Lx, Ly) + 'C' + P(Lx + 4, Ly - ut * .5 - curve * .2) + ' ' + P(cx - 5, bowY - .3) + ' ' + P(cx - 2.6, bowY - .4) + 'Q' + P(cx, bowY + .9) + ' ' + P(cx + 2.6, bowY - .4) + 'C' + P(cx + 5, bowY - .3) + ' ' + P(Rx - 4, Ry - ut * .5 - curve * .2) + ' ' + P(Rx, Ry);
  const stomU = 'C' + P(Rx - 5, Ry + curve * .3 + g * .2) + ' ' + P(cx + 5, stTop + curve * .25) + ' ' + P(cx, stTop + curve * .3) + 'C' + P(cx - 5, stTop + curve * .25) + ' ' + P(Lx + 5, Ly + curve * .3 + g * .2) + ' ' + P(Lx, Ly) + 'Z';
  const lowerTopPts = 'M' + P(Lx, Ly) + 'C' + P(Lx + 5, Ly + curve * .3 + g * .5) + ' ' + P(cx - 5, stBot + curve * .25) + ' ' + P(cx, stBot + curve * .3) + 'C' + P(cx + 5, stBot + curve * .25) + ' ' + P(Rx - 5, Ry + curve * .3 + g * .5) + ' ' + P(Rx, Ry);
  const lowBot = stBot + curve * .3 + lt;
  const lowerBot = 'C' + P(Rx - 3, Ry + lt * .7 + curve * .1) + ' ' + P(cx + 6, lowBot + .2) + ' ' + P(cx, lowBot + .2) + 'C' + P(cx - 6, lowBot + .2) + ' ' + P(Lx + 3, Ly + lt * .7 + curve * .1) + ' ' + P(Lx, Ly) + 'Z';
  return { Lx, Ly, Rx, Ry, y, g, up, curve, stTop, stBot, ut, lt, bowY, upperTop, stomU, lowerTopPts, lowBot, lowerBot, upper: upperTop + stomU, lower: lowerTopPts + lowerBot };
}

function mouth(c) {
  const { d, r, p, id, L } = c;
  const m = r.mouth, cx = m.cx, E = r.E, B = c.blurred;
  const { Lx, Ly, Rx, Ry, y, g, curve, stTop, stBot, ut, lt, bowY, upperTop, stomU, lowerTopPts, lowBot, lowerBot } = lipGeom(r);
  let s = '';
  // under-lip shadow and chin light
  s += B('b2', el('ellipse', { cx: cx + 1.5, cy: lowBot + 2.6, rx: m.mw * .55, ry: 2, fill: p.skinDeep, opacity: .45 }));
  // mouth interior when open
  if (g > .5) {
    const mouthHole = 'M' + P(Lx, Ly) + 'C' + P(Lx + 5, Ly + curve * .3 + g * .2) + ' ' + P(cx - 5, stTop + curve * .25) + ' ' + P(cx, stTop + curve * .3) + 'C' + P(cx + 5, stTop + curve * .25) + ' ' + P(Rx - 5, Ry + curve * .3 + g * .2) + ' ' + P(Rx, Ry) +
      'C' + P(Rx - 5, Ry + curve * .3 + g * .5) + ' ' + P(cx + 5, stBot + curve * .25) + ' ' + P(cx, stBot + curve * .3) + 'C' + P(cx - 5, stBot + curve * .25) + ' ' + P(Lx + 5, Ly + curve * .3 + g * .5) + ' ' + P(Lx, Ly) + 'Z';
    const mid = id + 'mo';
    s += el('clipPath', { id: mid }, el('path', { d: mouthHole }));
    let inside = el('rect', { x: Lx - 2, y: stTop - 4, width: Rx - Lx + 4, height: g + 12, fill: '#2a1214' });
    // teeth: upper row shows as the lip lifts, lower row with a wide open or stretched mouth
    const teeth = mix('#e8e0cf', p.skin, .1);
    const tw = m.mw * .82;
    if (L >= 1) {
      inside += el('path', { d: 'M' + P(cx - tw, stTop - 2) + 'L' + P(cx + tw, stTop - 2) + 'L' + P(cx + tw * .9, stTop + 2.6 + curve * .25) + 'Q' + P(cx, stTop + 3.4 + curve * .3) + ' ' + P(cx - tw * .9, stTop + 2.6 + curve * .25) + 'Z', fill: teeth });
      if (d.mouth.gap) inside += el('rect', { x: cx - .55, y: stTop - 2, width: 1.1, height: 4.5, fill: '#2a1214' });
      if (L === 2) for (let k = -3; k <= 3; k++) inside += el('line', { x1: f(cx + k * tw / 3.6), y1: f(stTop - 1), x2: f(cx + k * tw / 3.6), y2: f(stTop + 2.8 + curve * .25), stroke: shade(teeth, -25), 'stroke-width': .35, opacity: .6 });
      if (g > 3 || E('stretch') > .3) inside += el('path', { d: 'M' + P(cx - tw * .8, stBot + 2) + 'L' + P(cx + tw * .8, stBot + 2) + 'L' + P(cx + tw * .7, stBot - 1.6 + curve * .1) + 'Q' + P(cx, stBot - 2.4 + curve * .2) + ' ' + P(cx - tw * .7, stBot - 1.6 + curve * .1) + 'Z', fill: shade(teeth, -12) });
      if (g > 4) inside += el('ellipse', { cx, cy: stBot - 1, rx: tw * .55, ry: 2, fill: '#8a3a40', opacity: .7 });
      if (d.marks.some(mm => mm.kind === 'goldtooth')) inside += el('rect', { x: cx + tw * .35, y: stTop - 1.5, width: tw * .28, height: 4, fill: '#d8b24a' });
      if (d.marks.some(mm => mm.kind === 'missingtooth')) inside += el('rect', { x: cx - tw * .55, y: stTop - 1.5, width: tw * .25, height: 4.5, fill: '#2a1214' });
    }
    inside += el('path', { d: 'M' + P(Lx, stTop - 1) + 'L' + P(Rx, stTop - 1), stroke: '#000', 'stroke-width': 2, opacity: .35, filter: 'url(#' + id + 'b1)' });
    s += el('g', { 'clip-path': 'url(#' + mid + ')' }, inside);
  }
  // lips
  s += el('path', { d: upperTop + stomU, fill: p.lipDark });
  s += el('path', { d: lowerTopPts + lowerBot, fill: p.lip });
  if (L === 2) {
    s += B('b1', el('ellipse', { cx: cx - 2, cy: stBot + curve * .3 + lt * .45, rx: m.mw * .38, ry: lt * .22, fill: p.lipHi, opacity: .55 }));
    s += B('b1', el('path', { d: 'M' + P(cx - 4.5, bowY - .7) + 'Q' + P(cx - 1.5, bowY - 1.1) + ' ' + P(cx - .5, bowY), stroke: p.skinHi, 'stroke-width': .9, fill: 'none', opacity: .55 }));
    s += B('b1', el('path', { d: lowerTopPts + lowerBot, fill: 'none', stroke: p.lipDark, 'stroke-width': .6, opacity: .35 }));
    // vertical lip creases
    const rr = stream(d, 'lips');
    let cr = '';
    for (let k = 0; k < 7; k++) { const x = cx + (rr() - .5) * m.mw * 1.3, yy = stBot + curve * .3 + .6; cr += 'M' + P(x, yy) + 'l' + Q((rr() - .5) * .6, lt * (.45 + rr() * .3)); }
    s += el('path', { d: cr, stroke: p.lipDark, 'stroke-width': .3, opacity: .35 + r.old * .3 });
  }
  // the line where the lips meet, darkest at the corners
  const stom = 'M' + P(Lx, Ly) + 'C' + P(Lx + 5, Ly + curve * .3 + g * .2) + ' ' + P(cx - 5, stTop + curve * .25) + ' ' + P(cx, stTop + curve * .3) + 'C' + P(cx + 5, stTop + curve * .25) + ' ' + P(Rx - 5, Ry + curve * .3 + g * .2) + ' ' + P(Rx, Ry);
  if (g <= .5) s += el('path', { d: stom, stroke: shade(p.lipDark, -25), 'stroke-width': L === 2 ? .9 : 1.2, fill: 'none', 'stroke-linecap': 'round' });
  for (const [x, yy, sd] of [[Lx, Ly, -1], [Rx, Ry, 1]]) s += B('b1', el('circle', { cx: x + sd * .4, cy: yy + .2, r: 1.1 + E('lipPress') * .5 + Math.max(0, E('smile')) * .4, fill: p.skinDeep, opacity: .55 }));
  return s;
}

// ------------------------------------------------ hair

const LONG = new Set(['long', 'locs', 'afro-long']);
// hair over the ears only (len under .2) has nothing hanging behind the neck
function hairBehind(d) { return !d.hair.tied && (LONG.has(d.hair.style) || (d.hair.style === 'medium' && d.hair.volume > .3 && !(d.hair.len < .2))); }
/** The side of the image a subject's side falls on: their left is the viewer's right. */
const sideX = side => side === 'left' ? 1 : side === 'right' ? -1 : 0;

/** The part of the hair that hangs behind the head and shoulders. */
function hairBackPath(c) {
  const { d, r } = c;
  const cx = r.cx, W = r.W, v = 3 + d.hair.volume * 6 + d.hair.curl * 6;
  const len = d.hair.style === 'medium' ? r.chinY + 4 : 235;
  const sw = d.hair.style === 'medium' ? W + v + 2 : W + v + 10 + d.hair.curl * 8;
  return spline([[cx, r.top - v], [cx + W * .8 + v, r.top + 6], [cx + W + v, r.eyeY - 6], [cx + sw, (r.eyeY + len) / 2 + 10], [cx + sw - 6, len], [cx + 12, len + 6], [cx - 12, len + 6], [cx - sw + 6, len], [cx - sw, (r.eyeY + len) / 2 + 10], [cx - W - v, r.eyeY - 6], [cx - W * .8 - v, r.top + 6]], true, .9);
}
function hairBackStrands(c) {
  const { d, r, p } = c;
  const rr = stream(d, 'hairback');
  let dd = '', dd2 = '';
  const cx = r.cx;
  for (let i = 0; i < 70; i++) {
    const sd = rr() < .5 ? -1 : 1, x0 = cx + sd * (r.W * (.7 + rr() * .4)), y0 = r.eyeY - 10 + rr() * 30;
    const x1 = x0 + sd * (rr() * 14), y1 = (d.hair.style === 'medium' ? r.chinY : 225) - rr() * 20;
    const seg = 'M' + P(x0, y0) + 'Q' + P(x0 + sd * 10, (y0 + y1) / 2) + ' ' + P(x1, y1);
    if (rr() < .5) dd += seg; else dd2 += seg;
  }
  return el('path', { d: dd, stroke: p.hairDark, 'stroke-width': .7, fill: 'none', opacity: .7 }) + el('path', { d: dd2, stroke: p.hairLight, 'stroke-width': .5, fill: 'none', opacity: .4 });
}

/** The scalp's outline above the hairline: where a shaved or buzzed head shows its stubble. */
function scalpShape(c, sidesOnly) {
  const { d, r } = c;
  const cx = r.cx, W = r.W;
  const hl = r.top + (r.browBase - r.top) * (.42 + d.hair.recede * .3);
  const outer = [[cx - W - .6, r.eyeY - 4], [cx - W - .8, r.eyeY - 12], [cx - W * .92, r.top + 18], [cx - W * .62, r.top + 3.5], [cx, r.top - .6], [cx + W * .62, r.top + 3.5], [cx + W * .92, r.top + 18], [cx + W + .8, r.eyeY - 12], [cx + W + .6, r.eyeY - 4]];
  const tempY = hl + 6 + d.hair.recede * 12;
  const inner = sidesOnly
    ? [[cx + W * .9, r.eyeY - 4], [cx + W * .9, r.top + 20], [cx + W * .62, r.top + 12], [cx, r.top + 8], [cx - W * .62, r.top + 12], [cx - W * .9, r.top + 20], [cx - W * .9, r.eyeY - 4]]
    : [[cx + W * .9, r.eyeY - 4], [cx + W * .93, r.eyeY - 12], [cx + W * .78, tempY], [cx + W * .45, hl + 1.5], [cx, hl], [cx - W * .45, hl + 1.5], [cx - W * .78, tempY], [cx - W * .93, r.eyeY - 12], [cx - W * .9, r.eyeY - 4]];
  return { outer, inner, hl };
}

/**
 * A designed cut (face-parts.js) as outline points: its right half placed on this head's landmarks at this
 * hair's volume, mirrored, the parting moved, the far side of a combed-across cut fuller; then what the text adds
 * (tucked behind an ear, falling forward, tied).
 */
function partShape(c, cut) {
  const { d, r } = c;
  const h = d.hair, cx = r.cx, W = r.W;
  const v = cut.vol * (.6 + h.volume * .8);
  const hl = r.top + (r.browBase - r.top) * (.42 + h.recede * .3);
  const sideLen0 = h.len < .2 ? lerp(r.earBot - 2, r.mouthY, h.len / .2) : lerp(r.mouthY, r.chinY + 20, h.len ?? .55);
  const at = { top: r.top, hl, brow: r.browBase, eye: r.eyeY, earTop: r.earTop, earBot: r.earBot, mouth: r.mouthY, chin: r.chinY, shoulder: r.chinY + 18, len: sideLen0 };
  let pv = h.part ?? 0;
  if (cut.partAt) pv = (pv < 0 ? -1 : 1) * Math.max(Math.abs(pv), cut.partAt);
  const part = cx + pv * 10, heavy = pv > 0 ? -1 : 1;
  const place = ([x, a, dy = 0, xv = 0, yv = 0, rec = 0], sd) => {
    const k = cut.swoop ? (sd === heavy ? 1 + cut.swoop : 1 - cut.swoop * .5) : 1;
    return [cx + sd * (x * W + xv * v * k), at[a] + dy + yv * v * k + rec * h.recede];
  };
  const R = cut.outer.map(q => place(q, 1)), Lf = cut.outer.map(q => place(q, -1));
  const outer = [...Lf.slice(1).reverse(), R[0], ...R.slice(1)];
  const iR = cut.hairline.slice(0, -1).map(q => place(q, 1)), iL = cut.hairline.slice(0, -1).map(q => place(q, -1));
  const centre = place(cut.hairline[cut.hairline.length - 1], 1);
  const inner = [...iR, [part, centre[1]], ...iL.reverse()];
  const sideLen = outer[outer.length - 1][1];
  // tucked behind an ear the hair runs behind it; falling forward it hangs over the cheek
  for (const sd of [-1, 1]) {
    const side = sd > 0 ? 'left' : 'right';
    const [a, b] = sd > 0 ? [0, 1] : [inner.length - 1, inner.length - 2], [oa, ob] = sd > 0 ? [outer.length - 1, outer.length - 2] : [0, 1];
    if (cut.side === 'hang' && (h.tuck === side || h.tuck === 'both')) { inner[a] = [cx + sd * (W + 7.5), inner[a][1]]; inner[b] = [cx + sd * (W + 6), r.earTop - 4]; outer[oa] = [cx + sd * (W + 12), outer[oa][1]]; outer[ob] = [cx + sd * (W + 11), Math.min(outer[ob][1], r.eyeY + 4)]; }
    if (cut.side === 'hang' && h.fall === side) { inner[a] = [cx + sd * W * .64, inner[a][1]]; inner[b] = [cx + sd * W * .7, r.eyeY + 2]; }
  }
  return { outer, inner, hl, part, v, sideLen, side: cut.side, flow: cut.flow };
}

/** The hair mass on and around the head, as outline points. Null for heads with no mass (bald, shaved, buzzed). */
function hairShape(c) {
  const { d, r } = c;
  const h = d.hair, cx = r.cx, W = r.W, st = h.style;
  if (st === 'bald' || st === 'shaved' || st === 'buzz') return null;
  const cut = HAIR[h.cut];
  if (cut && cut.for.includes(st)) return partShape(c, cut);
  const top = st === 'undercut' ? (h.top || 'short') : null;
  const vol = { short: 2.4, medium: 3.5, long: 3.5, tied: 1.4, bun: 1.6, braid: 1.8, curly: 5.5, afro: 13, locs: 4.5, mohawk: 1, 'afro-long': 8 }[top ? (top === 'curly' ? 'curly' : top === 'tied' ? 'tied' : top === 'long' ? 'medium' : 'short') : st] ?? 2.5;
  const v = vol * (.6 + h.volume * .8) * (top === 'curly' ? .9 : 1);
  const rec = h.recede;
  const hl = r.top + (r.browBase - r.top) * (.42 + rec * .3);       // hairline height at the centre
  const part = cx + (h.part ?? 0) * 10;
  if (top) {
    // an undercut: the mass sits on top, the sides are shaved (drawn by the scalp layer)
    const sy = r.top + 17;
    const vv = top === 'curly' ? v * 1.5 + 2 : v;
    const outer = [[cx - W * .72, sy], [cx - W * .7 - vv * .3, r.top + 3 - vv * .45], [cx - W * .45, r.top - vv * .85], [cx, r.top - vv], [cx + W * .45, r.top - vv * .85], [cx + W * .7 + vv * .3, r.top + 3 - vv * .45], [cx + W * .72, sy]];
    const inner = [[cx + W * .62, sy + 1], [cx + W * .45, hl + 1.5], [part, hl], [cx - W * .45, hl + 1.5], [cx - W * .62, sy + 1]];
    return { outer, inner, hl, part, v, sideLen: sy, top };
  }
  const sideLen = h.tied ? r.eyeY - 4 : st === 'long' || st === 'locs' || st === 'afro-long' ? r.chinY + 18 : st === 'medium' || st === 'curly' ? (h.len < .2 ? lerp(r.earBot - 2, r.mouthY, h.len / .2) : lerp(r.mouthY, r.chinY + 20, h.len ?? .35)) : st === 'afro' ? r.mouthY - 6 : r.eyeY - 4;
  const outer = [
    [cx - W - v * .7, sideLen], [cx - W - v * .9, r.eyeY - 10], [cx - W * .9 - v, r.top + 18 - v * .3], [cx - W * .6 - v * .4, r.top + 2 - v * .8],
    [cx, r.top - v - (st === 'mohawk' ? 6 : 0)],
    [cx + W * .6 + v * .4, r.top + 2 - v * .8], [cx + W * .9 + v, r.top + 18 - v * .3], [cx + W + v * .9, r.eyeY - 10], [cx + W + v * .7, sideLen],
  ];
  // hairline: temples recede first (an M), then the crown
  const tempY = hl + 6 + rec * 12;
  const inner = [
    [cx + W * .9, sideLen - (sideLen > r.eyeY ? 0 : 2)],
    [cx + W * .93, r.eyeY - 12],
    [cx + W * .78, tempY],
    [cx + W * .45, hl + 3.6 + rec * 4],
    [part, hl - (st === 'medium' || st === 'long' ? 1 : 0)],
    [cx - W * .45, hl + 3.6 + rec * 4],
    [cx - W * .78, tempY],
    [cx - W * .93, r.eyeY - 12],
    [cx - W * .9, sideLen - (sideLen > r.eyeY ? 0 : 2)],
  ];
  if (st === 'long' || st === 'medium' || st === 'curly') {
    // hair that frames the face: the inner edge runs down past the cheeks
    inner[0] = [cx + W * .84, sideLen]; inner[1] = [cx + W * .88, r.eyeY]; inner[8] = [cx - W * .84, sideLen]; inner[7] = [cx - W * .88, r.eyeY];
    // tucked behind an ear: that side's hair runs behind it, so the ear shows
    for (const sd of [-1, 1]) {
      const side = sd > 0 ? 'left' : 'right';
      const [a, b] = sd > 0 ? [0, 1] : [8, 7];
      if (h.tuck === side || h.tuck === 'both') { inner[a] = [cx + sd * (W + 7.5), sideLen]; inner[b] = [cx + sd * (W + 6), r.earTop - 4]; outer[sd > 0 ? 8 : 0] = [cx + sd * (W + 12), sideLen]; outer[sd > 0 ? 7 : 1] = [cx + sd * (W + 11), r.eyeY - 10]; }
      if (h.fall === side) { inner[a] = [cx + sd * W * .64, sideLen]; inner[b] = [cx + sd * W * .7, r.eyeY + 2]; }
    }
  }
  if (st === 'tied' || st === 'bun' || st === 'braid' || h.tied) { inner[0][1] = outer[0][1] = r.eyeY - 2; inner[8][1] = outer[8][1] = r.eyeY - 2; }
  return { outer, inner, hl, part, v, sideLen };
}

/** Short hair standing on a scalp: shaved, buzzed, an undercut's sides, a bald man's ring. */
function scalpHair(c, sh, density, mask) {
  if (sh.image) return unbent(() => scalpHair(c, { outer: sh.image, inner: [] }, density, mask));
  const { d, r, p, id, L } = c;
  const path = spline([...sh.outer, ...sh.inner], true, .8);
  // light stubble on darker skin reads by its specks, not by a fill
  const lighter = lum(p.hair) > lum(p.skin) + 8;
  let s = el('path', { d: path, fill: p.hair, opacity: density * (L === 0 ? 1.1 : L === 1 ? (lighter ? .6 : .85) : lighter ? .25 : .75) });
  if (L === 2) {
    const rr = stream(d, 'scalp' + mask);
    const poly = sampleSpline([...sh.outer, ...sh.inner], true, 5);
    const pick = scanSampler(poly);
    let dd = '';
    for (let i = 0; i < 700 * density + 100; i++) {
      const q = pick(rr);
      if (!q) break;
      // stubble lies down and back from the hairline
      dd += 'M' + P(q[0], q[1]) + 'l' + Q((q[0] - r.cx) * .012, -.55);
    }
    s += el('path', { d: dd, stroke: lighter ? p.hairLight : p.hairDark, 'stroke-width': .42, opacity: .45 + density * .3, 'stroke-linecap': 'round' });
    // grey or a streak shows on stubble too
    if (d.hair.temples) s += c.blurred('b2', el('ellipse', { cx: r.cx - r.W * .9, cy: r.eyeY - 10, rx: 3.5, ry: 9, fill: '#d8d4cc', opacity: .45 }) + el('ellipse', { cx: r.cx + r.W * .9, cy: r.eyeY - 10, rx: 3.5, ry: 9, fill: '#d8d4cc', opacity: .45 }));
  }
  return s;
}

/** Draw body() unbent, inside a bent drawing: for what is already placed on the turned head. */
function unbent(body) { const prev = MAP; MAP = null; try { return body(); } finally { MAP = prev; } }

/**
 * A patch of the head's surface, given as a loop of (angle, height) points on one side (sd), as seen: the points
 * that face the viewer, and where the loop goes out of sight, the silhouette between where it leaves and returns.
 */
function surfaceRegion(so, loop, sd, out) {
  const pts = loop.map(([th, y]) => so.place(th, y, out, false));
  const start = pts.findIndex(q => q.margin >= 0);
  if (start < 0) return [];
  const res = [];
  let exitY = null;
  for (let k = 0; k < pts.length; k++) {
    const a = pts[(start + k) % pts.length], b = pts[(start + k + 1) % pts.length];
    if (a.margin >= 0) res.push([a.x, a.y]);
    if ((a.margin >= 0) === (b.margin >= 0)) continue;
    const vis = a.margin >= 0 ? a : b, hid = a.margin >= 0 ? b : a;
    const y = lerp(vis.y, hid.y, vis.margin / (vis.margin - hid.margin));
    if (a.margin >= 0) { exitY = y; res.push([so.silAt(y, sd, out, false), y]); continue; }
    if (exitY != null) for (let k2 = 1; k2 < 4; k2++) { const yy = lerp(exitY, y, k2 / 4); res.push([so.silAt(yy, sd, out, false), yy]); }
    res.push([so.silAt(y, sd, out, false), y]);
  }
  return res;
}

/**
 * The hair mass's outline on the turned head. The frontal design gives the hairline and the outer shape; round the
 * side of the head the edge runs as a profile in angle and height (down the sideburn, over the ear, to the nape, or
 * along the bottom of hanging hair); where that edge goes out of sight the outline takes the design's outer shape
 * over the crown. Frontal, it is the design plus the sideburns.
 */
function hairOutline(c, hs) {
  const { r } = c, so = r.so, cx = r.cx;
  return unbent(() => {
    const hangs = hs.side ? hs.side === 'hang' : hs.sideLen > r.eyeY + 4, tb = r.earTop, bb = r.earBot;
    const outerOf = sd => hs.outer.filter(([x]) => (x - cx) * sd > 0).sort((a, b) => a[1] - b[1]);
    const volAt = (sd, y) => {
      const o = outerOf(sd);
      if (!o.length) return hs.v;
      let X = o[o.length - 1][0];
      for (let i = 1; i < o.length; i++) if (y <= o[i][1]) { X = lerp(o[i - 1][0], o[i][0], clamp((y - o[i - 1][1]) / (o[i][1] - o[i - 1][1] || 1))); break; }
      return Math.max(.5, Math.abs(X - cx) - so.a(hangs && y > so.hang ? so.hang : y));
    };
    const side = sd => {
      const i0 = sd > 0 ? hs.inner[0] : hs.inner[hs.inner.length - 1];
      const th0 = Math.abs(so.thetaOf(i0[0], Math.min(i0[1], so.hang)));
      const far = sd * r.phi > .05;   // the far sideburn would only squeeze against the contour
      const prof = hangs ? [[1.75, hs.sideLen + 1], [2.45, hs.sideLen + 2], [3.12, hs.sideLen + 2]]
        : [...(far ? [] : c.d.sex === 'f' ? [[th0, tb + 1], [th0 + .1, tb - 1]] : [[th0, lerp(tb, bb, .35)], [th0 + .13, lerp(tb, bb, .3)], [th0 + .17, tb - 1]]), [1.72, tb - 2.5], [2.02, tb - 3], [2.34, tb + 4], [2.72, bb + 4], [3.12, bb + 5]];
      const out = hangs ? volAt(sd, hs.sideLen) : .6;
      return prof.map(([th, y]) => Object.assign(so.place(sd * th, y, out, hangs), { out }));
    };
    const cross = (vis, hid, sd) => {
      const y = lerp(vis.y, hid.y, vis.margin / (vis.margin - hid.margin));
      return [so.silAt(y, sd, vis.out, hangs), y];
    };
    // right side, back to front; left side, front to back
    const Rs = side(1).reverse(), Ls = side(-1);
    const iR = Rs.findIndex(q => q.margin >= 0), iL = Ls.length - 1 - [...Ls].reverse().findIndex(q => q.margin >= 0);
    const cR = iR > 0 ? cross(Rs[iR], Rs[iR - 1], 1) : null, cL = iL >= 0 && iL < Ls.length - 1 ? cross(Ls[iL], Ls[iL + 1], -1) : null;
    const yR = cR ? Math.min(cR[1], hs.sideLen) : hs.sideLen, yL = cL ? Math.min(cL[1], hs.sideLen) : hs.sideLen;
    const outer = hs.outer.filter(([x, y]) => x < cx ? y <= yL + .01 : x > cx ? y <= yR + .01 : true).map(([x, y]) => [so.wrap(x, y, true), y]);
    const pts = [...outer, ...(cR ? [cR] : []), ...(iR < 0 ? [] : Rs.slice(iR).map(q => [q.x, q.y])),
      ...hs.inner.map(([x, y]) => [so.wrap(x, y, true), y]),
      ...(iL < 0 || iL >= Ls.length ? [] : Ls.slice(0, iL + 1).map(q => [q.x, q.y])), ...(cL ? [cL] : [])];
    c.hairSide = { hangs, Ls: Ls.filter(q => q.margin >= 0), Rs: Rs.filter(q => q.margin >= 0) };
    return spline(pts, true, .85);
  });
}

/** Strands down the side of the head the turn shows: from the crown to the hair's edge round the side, unbent. */
function sideStrands(c, hs, cols) {
  const { d, r, L } = c, sh = c.hairSide;
  if (!sh || L < 2 || sh.hangs || Math.abs(r.phi) < .1) return ['', '', ''];
  const near = r.phi > 0 ? sh.Ls : sh.Rs, sd = r.phi > 0 ? -1 : 1;
  if (near.length < 2) return ['', '', ''];
  const rr = stream(d, 'sides'), out = ['', '', ''];
  return unbent(() => {
    const crown = [r.so.wrap(r.cx + sd * r.W * .3, r.top + 2), r.top + 2 - hs.v * .5];
    for (let i = 0; i < (c.fast ? 40 : 90); i++) {
      const k = rr() * (near.length - 1), j = Math.floor(k), q = near[j], q2 = near[Math.min(near.length - 1, j + 1)];
      const x1 = lerp(q.x, q2.x, k - j) + (rr() - .5) * 2, y1 = lerp(q.y, q2.y, k - j) + rr() * 1.5;
      const x0 = lerp(crown[0], x1, rr() * .3) + (rr() - .5) * 6, y0 = crown[1] + rr() * 6;
      const bx = lerp(x0, x1, .5) + sd * (4 + rr() * 4), by = lerp(y0, y1, .45);
      out[Math.min(2, Math.floor(rr() * 2.2 + (sd < 0 ? .4 : 0)))] += 'M' + P(x0, y0) + 'Q' + P(bx, by) + ' ' + P(x1, y1);
    }
    return out;
  });
}

function hairFront(c) {
  const { d, r, p, id, L } = c;
  const h = d.hair, st = h.style, cx = r.cx;
  let s = '';
  const shine = op => { if (L >= 1) s += el('g', { 'clip-path': 'url(#' + id + 'h)' }, c.blurred('b3', el('ellipse', { cx: cx - 10, cy: r.top + 12, rx: 13, ry: 7, fill: p.skinHi, opacity: op }))); };
  if (st === 'bald') {
    shine(.6);
    // what is left: a ring round the back and over the ears
    if (h.recede > .5 || h.ring || r.old > .5) {
      // the fringe left round the back: a band on the skull from the temple, over the ear, to the nape
      const tb = r.earTop, bb = r.earBot, ey = r.eyeY;
      const band = [[1.25, ey - 11], [1.6, ey - 14], [2.2, ey - 16], [3.1, ey - 15], [3.1, bb + 5], [2.6, bb + 3], [2.25, tb + 5], [1.95, tb - 2], [1.62, tb - 2], [1.42, lerp(tb, bb, .45)], [1.3, lerp(tb, bb, .45)]];
      for (const sd of [-1, 1]) {
        const img = surfaceRegion(r.so, band.map(([th, y]) => [sd * th, y]), sd, 1.2);
        if (img.length > 2) s += scalpHair(c, { image: img }, .9, 'ring' + sd);
      }
    }
    return s;
  }
  if (st === 'shaved' || st === 'buzz') {
    shine(st === 'shaved' ? .45 : .3);
    s += scalpHair(c, scalpShape(c, false), st === 'buzz' ? .62 : .32, 'scalp');
    if (h.streak) s += streakOn(c, null);
    return s;
  }
  if (st === 'undercut') s += scalpHair(c, scalpShape(c, true), .4, 'sides');
  const hs = hairShape(c);
  const path = hs.top ? spline([...hs.outer, ...hs.inner], true, .85) : hairOutline(c, hs);
  // a longer top on an undercut falls to one side over the forehead
  const swept = h.fringe || hs.top === 'long';
  if (L === 0) return s + el('path', { d: path, fill: p.hair }) + (st === 'bun' ? el('circle', { cx, cy: r.top - hs.v - 4, r: 7.5, fill: p.hair }) : '') + (swept ? el('path', { d: fringePath(c, hs), fill: p.hair }) : '') + (h.streak ? streakOn(c, hs) : '');

  // cast shadow on the forehead along the hairline
  s += el('g', { 'clip-path': 'url(#' + id + 'h)' }, c.blurred('b2', el('path', { d: spline(hs.inner.slice(1, -1), false), stroke: p.skinDeep, 'stroke-width': 3, fill: 'none', opacity: .3, transform: 'translate(1 2)' })));
  if (st === 'bun') s += el('circle', { cx, cy: r.top - hs.v - 5, r: 9, fill: 'url(#' + id + 'hr)' }) + el('path', { d: 'M' + P(cx - 6, r.top - hs.v - 8) + 'Q' + P(cx, r.top - hs.v - 12) + ' ' + P(cx + 6, r.top - hs.v - 4), stroke: p.hairLight, 'stroke-width': .8, fill: 'none', opacity: .6 });
  s += el('path', { d: path, fill: 'url(#' + id + 'hr)' });
  const hc = id + 'hc';
  s += el('clipPath', { id: hc }, el('path', { d: path }));

  // strands
  const rr = stream(d, 'hair');
  const curly = st === 'curly' || st === 'afro' || st === 'afro-long' || hs.top === 'curly' || h.curl > .6 || hs.flow === 'coils';
  const n = Math.round((L === 2 ? (curly ? 520 : 400) : (curly ? 60 : 40)) * (c.fast ? .5 : 1));
  const outerS = sampleSpline(hs.outer, false, 10);
  const cols = [p.hairDark, p.hair, p.hairLight];
  const buckets = ['', '', '', ''];
  let tipD = '';
  if (st === 'locs' || hs.flow === 'locs') {
    // ropes, each with its twist marks
    const k = L === 2 ? 26 : 12;
    for (let i = 0; i < k; i++) {
      const t = i / (k - 1), q = outerS[Math.floor(t * (outerS.length - 1))];
      const x0 = lerp(hs.part - 6, hs.part + 6, t), y0 = r.top + 2;
      let seg = 'M' + P(x0, y0) + 'Q' + P((x0 + q[0]) / 2 + (q[0] - cx) * .3, (y0 + q[1]) / 2 - 8) + ' ' + P(q[0], q[1] + 2);
      if (h.tied) { const a = hs.inner[1 + (i % (hs.inner.length - 2))]; seg = 'M' + P(a[0] + (t - .5) * 3, a[1] + 1) + 'Q' + P(a[0] + (a[0] - cx) * .3, lerp(a[1], r.top, .6)) + ' ' + P(cx + (a[0] - cx) * .25, r.top - hs.v + 2); }
      buckets[0] += seg;
      buckets[3] += seg;
    }
    s += el('g', { 'clip-path': 'url(#' + hc + ')' }, el('path', { d: buckets[0], stroke: p.hairDark, 'stroke-width': L === 2 ? 4.2 : 5, fill: 'none', 'stroke-linecap': 'round' }) + el('path', { d: buckets[3], stroke: p.hair, 'stroke-width': L === 2 ? 2.6 : 3, fill: 'none', 'stroke-dasharray': '2 1.2', 'stroke-linecap': 'round' }) + (L === 2 ? el('path', { d: buckets[3], stroke: p.hairLight, 'stroke-width': .8, fill: 'none', 'stroke-dasharray': '1 2.2', opacity: .6, transform: 'translate(-.8 0)' }) : ''));
    if (h.grey > 0 && L === 2) s += el('g', { 'clip-path': 'url(#' + hc + ')' }, el('path', { d: buckets[3], stroke: '#cfcbc4', 'stroke-width': .5, fill: 'none', 'stroke-dasharray': '.6 3.4', opacity: .5 + h.grey }));
  } else if (curly) {
    // coils: small arcs scattered through the mass, lit from the upper left
    for (let i = 0; i < n; i++) {
      const q = outerS[Math.floor(rr() * outerS.length)];
      const tt = Math.sqrt(rr());
      const x = lerp(cx + (rr() - .5) * 10, q[0], tt), y = lerp(hs.top ? r.top + 4 : r.top + 10, q[1], tt);
      const rad = (L === 2 ? 1.1 : 2) + rr() * (L === 2 ? 1.8 : 2.5);
      const a0 = rr() * 6.28, a1 = a0 + 2.2 + rr() * 2.2;
      const seg = 'M' + P(x + Math.cos(a0) * rad, y + Math.sin(a0) * rad) + 'A' + f(rad) + ' ' + f(rad) + ' 0 0 1 ' + P(x + Math.cos(a1) * rad, y + Math.sin(a1) * rad);
      if (h.tips && tt > .62) { tipD += seg; continue; }
      const lit = (x - cx) / r.W < -.2 && y < r.eyeY ? 1 : 0;
      buckets[Math.min(2, Math.floor(rr() * 2.2) + lit)] += seg;
    }
    s += el('g', { 'clip-path': 'url(#' + hc + ')' }, buckets.slice(0, 3).map((b, i) => el('path', { d: b, stroke: cols[i], 'stroke-width': L === 2 ? .75 : 1.3, fill: 'none', opacity: i === 2 ? .8 : .9 })).join(''));
  } else {
    const back = st === 'tied' || st === 'bun' || st === 'braid' || hs.top === 'tied' || h.back || hs.flow === 'back';
    const messy = h.messy;
    const lineS = sampleSpline(hs.inner.slice(hs.top ? 0 : 1, hs.top ? undefined : -1), false, 12);
    const rh = stream(d, 'hairhi');
    let locks = '', his = '';
    for (let i = 0; i < n; i++) {
      // from the part toward a point on the outline; a combed-back style runs from the hairline up over the crown
      const t = rr();
      const q = outerS[Math.floor(t * (outerS.length - 1))];
      const sd = q[0] < hs.part ? -1 : 1;
      let x0, y0, x1, y1, cxp, cyp;
      if (back) {
        const a = lineS[Math.floor(rr() * lineS.length)];
        x0 = a[0] + (rr() - .5) * 4; y0 = a[1] + 1; x1 = cx + (x0 - cx) * (.15 + rr() * .3); y1 = r.top - hs.v + 1 + rr() * 3;
        cxp = x0 + (x0 - cx) * (.35 + rr() * .2) + (rr() - .5) * 3; cyp = lerp(y0, y1, .55);
      } else {
        x0 = hs.part + (rr() - .5) * 3; y0 = hs.hl - 2 + (rr()) * 8 - 10;
        x1 = q[0] + (rr() - .5) * 2; y1 = q[1] + (rr() - .5) * 2;
        cxp = (x0 + x1) / 2 + sd * (6 + rr() * 6) + (rr() - .5) * messy * 10; cyp = Math.min(y0, y1) - 6 - rr() * 6 + (rr() - .5) * messy * 8;
      }
      let seg = 'M' + P(x0, y0) + 'Q' + P(cxp, cyp) + ' ' + P(x1, y1);
      if (!back && q[1] > r.eyeY - 16) {
        // a side strand runs over the crown and down the side of the head, the way hair falls
        const sx = Math.sign(q[0] - cx) || 1;
        seg = 'M' + P(x0, y0) + 'C' + P(cx + sx * r.W * .55 + (rr() - .5) * 5, r.top - hs.v * .6 + rr() * 4) + ' ' + P(cx + sx * (r.W + hs.v * .8) + (rr() - .5) * 3, lerp(r.top + 20, q[1], .4)) + ' ' + P(x1, y1);
        cxp = cx + sx * (r.W + hs.v * .8); cyp = lerp(r.top + 20, q[1], .7);
      }
      if (h.tips && !back) tipD += 'M' + P(lerp(cxp, x1, .6), lerp(cyp, y1, .6)) + 'L' + P(x1, y1);
      // lit where the crown turns to the key light, upper left
      const lit = (x1 < cx + 4 && y1 < r.eyeY + 6 ? 1 : 0) + (x0 < cx && y0 < hs.hl ? .4 : 0);
      buckets[Math.min(2, Math.floor(rr() * 2.1 + lit))] += seg;
      // a few strands drawn bold: the gaps between locks, and on the lit side the strong highlights
      if (c.Lt && L === 2) { const q2 = rh(); if (q2 < .035) locks += seg; else if (lit >= 1 && q2 > .94) his += seg; }
    }
    const side = sideStrands(c, hs, cols);
    s += el('g', { 'clip-path': 'url(#' + hc + ')' }, buckets.slice(0, 3).map((b, i) => el('path', { d: b + side[i], stroke: cols[i], 'stroke-width': L === 2 ? (i === 2 ? .5 : .7) : 1.1, fill: 'none', opacity: i === 0 ? .9 : .8, 'stroke-linecap': 'round' })).join('') +
      (locks ? el('path', { d: locks, stroke: p.hairDark, 'stroke-width': 1.6, fill: 'none', opacity: .7, 'stroke-linecap': 'round' }) : '') +
      (his ? el('path', { d: his, stroke: p.hairHi, 'stroke-width': 1.3, fill: 'none', opacity: .85, 'stroke-linecap': 'round' }) : ''));
  }
  if (L >= 1 && !curly && st !== 'locs' && hs.sideLen > r.eyeY + 4) {
    const rp = stream(d, 'panels');
    const innerS = sampleSpline(hs.inner, false, 8);
    const xAt = (poly, y, sd) => { let best = null, bd = 1e9; for (const q of poly) if (Math.sign(q[0] - cx) === sd && Math.abs(q[1] - y) < bd) { bd = Math.abs(q[1] - y); best = q[0]; } return best ?? cx + sd * r.W; };
    const pb = ['', '', ''];
    for (let i = 0; i < (L === 2 ? (c.fast ? 120 : 240) : 30); i++) {
      const sd = rp() < .5 ? -1 : 1, y1 = lerp(r.eyeY - 10, hs.sideLen, Math.sqrt(rp()));
      const xi = xAt(innerS, y1, sd), xo = xAt(outerS, y1, sd), x1 = lerp(xi, xo, rp());
      const x0 = hs.part + (rp() - .5) * 4, y0 = hs.hl - 3;
      const seg = 'M' + P(x0, y0) + 'C' + P(cx + sd * r.W * .5 + (rp() - .5) * 6, r.top - hs.v * .5) + ' ' + P(lerp(x1, cx + sd * (r.W + hs.v * .7), .6), lerp(r.top + 20, y1, .35)) + ' ' + P(x1, y1);
      pb[Math.min(2, Math.floor(rp() * 2.1 + (sd < 0 ? .5 : 0)))] += seg;
    }
    s += el('g', { 'clip-path': 'url(#' + hc + ')' }, pb.map((b, i) => el('path', { d: b, stroke: cols[i], 'stroke-width': L === 2 ? (i === 2 ? .5 : .65) : 1.1, fill: 'none', opacity: .85, 'stroke-linecap': 'round' })).join(''));
  }
  if (tipD) s += el('g', { 'clip-path': 'url(#' + hc + ')' }, el('path', { d: tipD, stroke: h.tips, 'stroke-width': L === 2 ? .8 : 1.4, fill: 'none', opacity: .9, 'stroke-linecap': 'round' }));
  // grey at the temples, a streak at one temple
  if (h.temples && L >= 1) {
    const rg = stream(d, 'temples');
    let dd = '';
    for (const sd of [-1, 1]) for (let i = 0; i < (L === 2 ? 26 : 6); i++) { const x = cx + sd * (r.W * (.8 + rg() * .25)), y = r.eyeY - 22 + rg() * 16; dd += 'M' + P(x, y) + 'q' + Q(sd * 1, -4) + ' ' + Q(sd * .5, -9); }
    s += el('g', { 'clip-path': 'url(#' + hc + ')' }, el('path', { d: dd, stroke: '#d6d2ca', 'stroke-width': L === 2 ? .5 : 1, fill: 'none', opacity: .8 * h.temples }));
  }
  if (swept) s += fringe(c, hs);
  // strays: hairs that leave the mass at its edge and break the hairline, so it never reads as a helmet
  if (L === 2 && st !== 'locs' && !c.fast) {
    const rs = stream(d, 'strays');
    const hcx = cx, hcy = r.eyeY - 6;
    let dd = '', dl = '';
    const k = Math.round(46 + h.messy * 70);
    for (let i = 0; i < k; i++) {
      const q = outerS[Math.floor(rs() * outerS.length)];
      let nx = q[0] - hcx, ny = q[1] - hcy; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const out = (curly ? 1.5 : 1) * (1 + rs() * (2 + h.messy * 4));
      const x0 = q[0] - nx * 3, y0 = q[1] - ny * 3, x1 = q[0] + nx * out + (rs() - .5) * 2, y1 = q[1] + ny * out + rs() * 2;
      const seg = curly ? 'M' + P(x0, y0) + 'Q' + P(x1 + ny * 2, y1 - nx * 2) + ' ' + P(x1, y1) : 'M' + P(x0, y0) + 'Q' + P((x0 + x1) / 2 + ny * (rs() - .5) * 3, (y0 + y1) / 2) + ' ' + P(x1, y1);
      if (q[0] < cx) dl += seg; else dd += seg;
    }
    if (!h.back) {
      const inS = sampleSpline(hs.inner.slice(1, -1), false, 8);
      for (let i = 0; i < 90; i++) {
        const q = inS[Math.floor(rs() * inS.length)];
        const x1 = q[0] + (rs() - .5) * 2.5, y1 = q[1] + 1.5 + rs() * 2.5;
        dd += 'M' + P(q[0], q[1] - 2) + 'Q' + P((q[0] + x1) / 2 + (rs() - .5), (q[1] + y1) / 2) + ' ' + P(x1, y1);
      }
    }
    s += el('path', { d: dl, stroke: h.tips && curly ? h.tips : p.hairLight, 'stroke-width': .4, fill: 'none', opacity: .75, 'stroke-linecap': 'round' }) + el('path', { d: dd, stroke: h.tips && curly ? h.tips : p.hair, 'stroke-width': .42, fill: 'none', opacity: .8, 'stroke-linecap': 'round' });
  }
  // a tie at the crown: a strip of cloth round locs or a tail
  if (h.tie && L >= 1) s += el('path', { d: 'M' + P(cx - 7, r.top - hs.v + 2.5) + 'Q' + P(cx, r.top - hs.v - .5) + ' ' + P(cx + 7, r.top - hs.v + 2.5), stroke: h.tie, 'stroke-width': L === 2 ? 2.4 : 3, fill: 'none', 'stroke-linecap': 'round' });
  // sheen: a soft band of light across the crown
  if (L >= 1 && !curly) s += el('g', { 'clip-path': 'url(#' + hc + ')' }, c.blurred('b2', el('path', { d: 'M' + P(cx - r.W * .9, r.top + 18) + 'Q' + P(cx - r.W * .3, r.top - 4) + ' ' + P(cx + r.W * .3, r.top + 2), stroke: p.hairLight, 'stroke-width': 4, fill: 'none', opacity: .5 })));
  if (L >= 1 && curly) s += el('g', { 'clip-path': 'url(#' + hc + ')' }, c.blurred('b3', el('ellipse', { cx: cx - r.W * .4, cy: r.top + 6, rx: r.W * .6, ry: 8, fill: p.hairLight, opacity: .3 })));
  // the shadow side of the hair, and the room's back light on its edge
  if (L >= 1) s += el('g', { 'clip-path': 'url(#' + hc + ')' }, c.blurred(c.Lt ? 'b3' : 'b4', el('path', { d: path, fill: c.Lt ? p.hairDark : '#000', opacity: c.Lt ? .7 : .35, transform: 'translate(' + f(r.W * (c.Lt ? .75 : .9)) + ' 6)' })));
  if (c.Lt) s += el('path', { d: spline(hs.outer, false, .85), fill: 'none', stroke: 'url(#' + id + 'ct)', 'stroke-width': L === 2 ? 1.2 : 1.6 });
  if (L >= 1) s += el('mask', { id: id + 'hm' }, el('path', { d: path, fill: '#fff' }) + el('path', { d: path, fill: '#000', transform: 'translate(-3 1.5)' }) + el('rect', { x: 0, y: 0, width: cx + r.W * .55, height: 250, fill: '#000' })) + c.blurred('b1', el('rect', { x: 0, y: 0, width: 200, height: 250, fill: mix(p.rim, p.hair, .35), mask: 'url(#' + id + 'hm)', opacity: .3 }));
  // the streak last: a pale lock stays pale on the shadow side too
  if (h.streak) s += el('g', { 'clip-path': 'url(#' + hc + ')' }, streakOn(c, hs));
  return s;
}

/**
 * A streak of grey at one temple, laid over whatever hair is there: a lock from the hairline back over the crown, so
 * it reads at every size. On an undercut it starts where the top's hair does; on stubble (hs null), at the temple.
 */
function streakOn(c, hs) {
  const { d, r, L } = c;
  const sd = sideX(d.hair.streak.side) || 1, col = d.hair.streak.color;
  const rr = stream(d, 'streak');
  const [x0, y0] = hs && hs.top ? [r.cx + sd * r.W * .5, hs.hl + 2] : [r.cx + sd * r.W * .74, (hs ? hs.hl : scalpShape(c, false).hl) + 7];
  const x1 = r.cx + sd * r.W * .2, y1 = r.top + 1, bx = lerp(x0, x1, .35) + sd * 4, by = lerp(y0, y1, .5);
  const lock = 'M' + P(x0, y0) + 'Q' + P(bx, by) + ' ' + P(x1, y1);
  let s = el('path', { d: lock, stroke: col, 'stroke-width': L === 0 ? 4.5 : L === 1 ? 3.6 : 3.2, fill: 'none', opacity: L === 2 ? .55 : .85, 'stroke-linecap': 'round' });
  if (L === 2) {
    let dd = '';
    for (let i = 0; i < 16; i++) {
      const o = (rr() - .5) * 4;
      dd += 'M' + P(x0 + o, y0 + rr() * 1.5) + 'Q' + P(bx + o, by) + ' ' + P(x1 + o * .5 + (rr() - .5) * 2, y1 + rr() * 3);
    }
    s += el('path', { d: dd, stroke: col, 'stroke-width': .6, fill: 'none', opacity: .9, 'stroke-linecap': 'round' });
  }
  return s;
}

/**
 * What hangs at the back of tied hair (d.hair.tail, or the style's own): a short tail, a ponytail, a plait, a plait
 * pinned flat. Drawn behind the head on the side away from the viewer, peeking past the silhouette: geometrically a
 * tail at the back is hidden at these small turns, but the text names it, so it shows the way a painter would show it.
 * Each row is [height, how far out past the silhouette, half-width], top to tip.
 */
function tailOf(h) { return h.tail || (h.style === 'braid' ? 'plait' : h.style === 'tied' || h.tied ? 'long' : h.top === 'tied' ? 'short' : null); }
function tail(c) {
  const { d, r, p, id, L } = c;
  const kind = tailOf(d.hair);
  if (!kind) return '';
  const sd = r.phi > .02 ? -1 : r.phi < -.02 ? 1 : (hash(String(d.seed) + ':tail') & 1 ? 1 : -1);
  const { top, earTop: et, earBot: eb, chinY: ch } = r;
  const rows = {
    short: [[top + 18, -6, 3], [top + 26, 2, 4.4], [et - 12, 6.5, 4], [et - 4, 8.5, 2.6], [et + 1, 9, .6]],
    long: [[top + 18, -6, 4], [top + 30, 3, 5.4], [et, 7.5, 6], [eb + 6, 7.5, 5], [ch + 10, 6, 3.6], [ch + 26, 5, 1]],
    plait: [[top + 22, -6, 4], [et - 6, 3, 4.4], [eb, 5, 4], [ch + 10, 5, 3.4], [ch + 30, 4.5, 2.6], [ch + 36, 4.5, 1.4]],
    pinned: [[et - 12, -5, 3.5], [et - 4, 4, 4.8], [eb - 6, 5.5, 5], [eb + 2, 3, 3.6], [eb + 7, -3, 1.5]],
  }[kind] || [];
  if (!rows.length) return '';
  const k = L === 0 ? 1.5 : 1;
  const at = (y, o) => [r.so.silAt(y, sd, 0, true) + sd * o * k, y];
  const outer = rows.map(([y, o, w]) => at(y, o + w)), inner = rows.map(([y, o, w]) => at(y, o - w)).reverse();
  const shape = spline([...outer, ...inner], true, .9);
  let s = el('path', { d: shape, fill: L === 0 ? p.hair : 'url(#' + id + 'hr)' });
  if (L === 0) return s;
  const mid = rows.map(([y, o]) => at(y, o));
  const tc = id + 'tl';
  let g = '';
  if (kind === 'plait' || kind === 'pinned') {
    // the plait's crossings: short arcs alternating side to side down the centre line
    const pts = sampleSpline(mid, false, 6);
    for (let i = 1; i < pts.length - 1; i += 2) {
      const [x, y] = pts[i], w = 3.6, alt = (i >> 1) % 2 ? 1 : -1;
      g += el('path', { d: 'M' + P(x - w, y - 2.5 * alt) + 'Q' + P(x, y + 2.5 * alt) + ' ' + P(x + w, y - 2.5 * alt), stroke: p.hairDark, 'stroke-width': L === 2 ? .9 : 1.2, fill: 'none', opacity: .8 });
    }
  } else {
    // strands along the tail, gathered at the root
    const rr = stream(d, 'tail');
    const cols = [p.hairDark, p.hair, p.hairLight];
    for (let i = 0; i < (L === 2 ? 24 : 6); i++) {
      const o = (rr() - .5) * 1.6;
      const q = rows.map(([y, oo, w]) => at(y, oo + w * o * (y > rows[0][0] + 6 ? 1 : .2)));
      g += el('path', { d: spline(q, false, .9), stroke: cols[i % 3], 'stroke-width': L === 2 ? .55 : 1, fill: 'none', opacity: .8 });
    }
  }
  if (d.hair.style === 'locs' || d.hair.tied) g = el('path', { d: spline(mid, false, .9), stroke: p.hair, 'stroke-width': 3, fill: 'none', 'stroke-dasharray': '2 1.2', opacity: .8 });
  // in the head's shadow where it leaves the skull
  g += c.blurred('b2', el('path', { d: shape, fill: p.hairDark, opacity: .55, transform: 'translate(' + f(-sd * 4) + ' 0)' }));
  s += el('clipPath', { id: tc }, el('path', { d: shape })) + el('g', { 'clip-path': 'url(#' + tc + ')' }, g);
  return s;
}

/** A fringe: hair falling over the forehead from the part, swept to one side. */
function fringePath(c, hs) {
  const { r } = c;
  const cx = r.cx, W = r.W, sd = (hs.part >= cx ? -1 : 1);
  const low = r.browBase - 1.5;
  return spline([[hs.part - sd * 4, hs.hl - 4], [cx + sd * W * .2, hs.hl + 2], [cx + sd * W * .55, low - 2], [cx + sd * W * .8, low - 6], [cx + sd * W * .9, hs.hl + 4], [cx + sd * W * .5, hs.hl - 6]], true, .9);
}
function fringe(c, hs) {
  const { d, r, p, id, L } = c;
  const dP = fringePath(c, hs);
  if (L === 0) return el('path', { d: dP, fill: p.hair });
  const rr = stream(d, 'fringe');
  let s = c.blurred('b2', el('path', { d: dP, fill: p.skinDeep, opacity: .45, transform: 'translate(1 2.5)' }), { 'clip-path': 'url(#' + id + 'h)' });
  s += el('path', { d: dP, fill: 'url(#' + id + 'hr)' });
  const sd = (hs.part >= r.cx ? -1 : 1);
  let dd = ['', '', ''];
  for (let i = 0; i < (L === 2 ? 90 : 14); i++) {
    const x0 = hs.part + (rr() - .5) * 4, y0 = hs.hl - 5;
    const x1 = r.cx + sd * r.W * (rr() * .85), y1 = r.browBase - 2 - rr() * 6 - Math.abs(x1 - r.cx) * .1;
    dd[Math.floor(rr() * 2.4) % 3] += 'M' + P(x0, y0) + 'Q' + P((x0 + x1) / 2 + sd * 3, y0 + 2) + ' ' + P(x1, y1);
  }
  const cols = [p.hairDark, p.hair, p.hairLight];
  s += dd.map((x, i) => el('path', { d: x, stroke: cols[i], 'stroke-width': L === 2 ? .5 : 1, fill: 'none', opacity: .85, 'stroke-linecap': 'round' })).join('');
  return s;
}

// ------------------------------------------------ beard

/** Uniform random points inside a polygon: its scanline spans tabled once, so each draw is a lookup. */
function scanSampler(poly, step = .5) {
  let y0 = 1e9, y1 = -1e9;
  for (const q of poly) { if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
  const spans = [], cum = [];
  let tot = 0;
  for (let y = y0 + step / 2; y < y1; y += step) {
    const xs = [];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y)) xs.push((xj - xi) * (y - yi) / (yj - yi) + xi);
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) { tot += xs[k + 1] - xs[k]; spans.push([y, xs[k], xs[k + 1]]); cum.push(tot); }
  }
  return rr => {
    if (!tot) return null;
    const t = rr() * tot;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < t) lo = m + 1; else hi = m; }
    const [y, a, b] = spans[lo];
    return [lerp(a, b, rr()), y + (rr() - .5) * step];
  };
}

/** Point-in-polygon by ray casting. */
function inside(pt, poly) {
  let inn = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) inn = !inn;
  }
  return inn;
}

/** The beard's outline points (closed) and the mouth it leaves bare. */
function beardShape(c) {
  const { d, r } = c;
  const cx = r.cx, st = d.beard.style === 'none' ? 'stubble' : d.beard.style, m = r.mouth;
  const len = (st === 'long' ? 20 : st === 'full' ? 8 : st === 'short' ? 3 : st === 'stubble' ? .5 : 1.5) * (.6 + d.beard.length * .8);
  const hole = { cx, cy: m.y + (m.gap + m.lt - m.ut * .6) / 2, rx: m.mw + 1.4, ry: (m.ut * .6 + m.lt + m.gap) / 2 + 1 };
  const under = r.noseTip + 3.2;
  let ring;
  if (st === 'moustache') {
    const sp = d.beard.sparse ? .55 : 1;
    ring = [[cx, under - .6], [cx + m.mw * .55, under], [m.R[0] + 2 * sp, m.R[1] + (2.5 + d.beard.length * 3) * sp], [m.R[0] - .5, m.R[1] + 1.2], [cx + m.mw * .45, m.y - m.ut * .4], [cx, m.y - m.ut * .6 - .3], [cx - m.mw * .45, m.y - m.ut * .4], [m.L[0] + .5, m.L[1] + 1.2], [m.L[0] - 2 * sp, m.L[1] + (2.5 + d.beard.length * 3) * sp], [cx - m.mw * .55, under]];
    return { ring, hole: null, len };
  }
  if (st === 'goatee') {
    ring = [[cx, under], [cx + m.mw * .6, under + .4], [m.R[0] + 2, m.R[1] + 1], [m.R[0] + 1.5, m.y + 6], [cx + r.chinW + 1.5, r.chinY - 3], [cx + r.chinW * .5, r.chinY + len * .8], [cx, r.chinY + len], [cx - r.chinW * .5, r.chinY + len * .8], [cx - r.chinW - 1.5, r.chinY - 3], [m.L[0] - 1.5, m.y + 6], [m.L[0] - 2, m.L[1] + 1], [cx - m.mw * .6, under + .4]];
    return { ring, hole, len };
  }
  // sideburns, jaw and chin outside; inside, the cheek line down to the moustache under the nose
  const H = r.front;   // 4 cheekbone, 5 under it, 6 jaw corner, 7 chin corner
  const out = .6 + len * .25;
  const R = [[cx + r.W * .95, r.eyeY - 3], [H[5][0] + out * .6, H[5][1]], [H[6][0] + out, H[6][1] + len * .3], [H[7][0] + out * .8, H[7][1] + len * .7]];
  // the cheek line: a full or long beard grows up the cheek; a short, trimmed one keeps to the jaw, and its sideburn
  // narrows to the ear
  const cheekDrop = st === 'stubble' ? 6 : st === 'short' ? 9 : 0;
  const Li = [[cx + r.W * (st === 'short' ? .9 : .84), r.eyeY + 2 + cheekDrop * .5], [cx + r.W * .62, r.eyeY + 16 + cheekDrop], [m.R[0] + 4, r.noseTip + 5], [cx + r.nose.w * .7, under - .4], [cx, under]];
  ring = [...R, [cx, r.chinY + len], ...mirror(R, cx).reverse(), ...mirror(Li, cx), ...Li.slice(0, 4).reverse()];
  return { ring, hole, len };
}
const holeD = h => h ? 'M' + P(h.cx - h.rx, h.cy) + 'A' + f(h.rx) + ' ' + f(h.ry) + ' 0 1 0 ' + P(h.cx + h.rx, h.cy) + 'A' + f(h.rx) + ' ' + f(h.ry) + ' 0 1 0 ' + P(h.cx - h.rx, h.cy) + 'Z' : '';
const inHole = (pt, h) => h && ((pt[0] - h.cx) / h.rx) ** 2 + ((pt[1] - h.cy) / h.ry) ** 2 < 1;
function beardPath(c) { const b = beardShape(c); return spline(b.ring, true, .9) + holeD(b.hole); }

function beard(c) {
  const { d, r, p, id, L } = c;
  const st = d.beard.style;
  if (st === 'none') {
    if (!d.beard.shadow || L === 0) return '';
    const dark = clamp((60 - lum(d.beard.color || d.hair.color)) / 40);
    return c.blurred('b2', el('path', { d: beardPath(c), 'fill-rule': 'evenodd', fill: mix(p.beard, p.skinDeep, .4), opacity: f(d.beard.shadow * (.08 + dark * .14)) }));
  }
  const bs = beardShape(c);
  const path = spline(bs.ring, true, .9) + holeD(bs.hole);
  const poly = sampleSpline(bs.ring, true, 6);
  const rr = stream(d, 'beard');
  const pick = scanSampler(poly);
  const sample = () => { for (let k = 0; k < 30; k++) { const q = pick(rr); if (q && !inHole(q, bs.hole)) return q; } return null; };
  const sparse = d.beard.sparse ? .45 : 1;
  let s = '';
  if (st === 'stubble') {
    s += c.blurred('b2', el('path', { d: path, 'fill-rule': 'evenodd', fill: p.beard, opacity: L === 2 ? .2 : L === 1 ? .28 : .3 }));
    if (L === 2) {
      let dd = '';
      for (let i = 0; i < 1100 * sparse; i++) { const q = sample(); if (q) dd += 'M' + P(q[0], q[1]) + 'l' + Q((q[0] - r.cx) * .004, .5); }
      s += el('path', { d: dd, stroke: shade(p.beard, -12), 'stroke-width': .38, opacity: .6, 'stroke-linecap': 'round' });
    }
    return s;
  }
  // the mass, soft-edged, then hairs that start inside and cross its edge
  s += L === 2 ? c.blurred('b1', el('path', { d: path, 'fill-rule': 'evenodd', fill: p.beard, opacity: sparse < 1 ? .1 : .92 })) : el('path', { d: path, 'fill-rule': 'evenodd', fill: p.beard, opacity: sparse < 1 ? .2 : 1 });
  if (L >= 1) {
    const n = Math.round((L === 2 ? 900 : 70) * (bs.len > 10 ? 1.4 : 1) * sparse * (d.beard.sparse ? .2 : 1) * (c.fast ? .5 : 1));
    const bk = ['', '', ''];
    const flow = bs.len > 10 ? 4 + rr() : st === 'moustache' ? 2.2 : st === 'short' ? 1.6 : 2.4;
    for (let i = 0; i < n; i++) {
      const q = sample(); if (!q) continue;
      const [x, y] = q;
      // moustache hairs fan out from the philtrum; the rest fall down and out, longer toward the chin
      const mo = y < r.mouthY - 1 && Math.abs(x - r.cx) < r.mouth.mw + 4;
      const k = clamp((y - r.eyeY) / (r.chinY - r.eyeY + bs.len));
      const len = (mo ? 2 : flow * (.6 + k)) * (.7 + rr() * .6);
      const dx = mo ? Math.sign(x - r.cx) * len * .7 : (x - r.cx) * .03 * len + (rr() - .5) * .9;
      const dy = mo ? len * .6 : len;
      const lit = x < r.cx - 4 ? 1 : 0;
      bk[Math.min(2, Math.floor(rr() * 2) + lit)] += 'M' + P(x, y) + 'q' + Q(dx * .5 + (rr() - .5) * .6, dy * .5) + ' ' + Q(dx, dy);
    }
    const bc = [shade(p.beard, -18), p.beard, shade(p.beard, 15, -6)];
    // a smoker's stain at one corner of the moustache
    if (d.beard.stain) s += c.blurred('b2', el('ellipse', { cx: r.mouth.R[0] - 2, cy: r.mouth.y - r.mouth.ut - 1, rx: 4, ry: 2.4, fill: d.beard.stain, opacity: .55 }));
    s += bk.map((b, i) => el('path', { d: b, stroke: bc[i], 'stroke-width': L === 2 ? (i === 2 ? .38 : .48) : .9, fill: 'none', opacity: (i === 2 ? .8 : .9) * (d.beard.sparse ? .55 : 1), 'stroke-linecap': 'round' })).join('');
    // the beard turns away from the light too
    const bid = id + 'bd';
    s += el('clipPath', { id: bid }, el('path', { d: path, 'clip-rule': 'evenodd' }));
    s += el('g', { 'clip-path': 'url(#' + bid + ')' }, c.blurred('b3', el('path', { d: c.headD, fill: '#000', opacity: .38, transform: 'translate(' + f(r.W * .75) + ' 5)' })) +
      c.blurred('b2', el('path', { d: 'M' + P(r.cx - r.mouth.mw, r.mouth.y + r.mouth.lt + 3) + 'Q' + P(r.cx, r.mouth.y + r.mouth.lt + 6) + ' ' + P(r.cx + r.mouth.mw, r.mouth.y + r.mouth.lt + 3), stroke: '#000', 'stroke-width': 2.5, fill: 'none', opacity: .3 })));
  }
  return s;
}

// ------------------------------------------------ marks, glasses, headwear

const SPOTS = {
  forehead: [0, -.62, 0], brow: [.62, -.24, 0], eyebrow: [.62, -.24, 0], eye: [.6, -.05, 0], temple: [.92, -.3, 0], cheek: [.6, .3, 0], cheekbone: [.68, .16, 0],
  nose: [0, .25, 0], lip: [.2, .62, 0], mouth: [.32, .62, 0], chin: [.1, .92, 0], jaw: [.75, .72, 0], jawline: [.75, .72, 0], neck: [.3, 1.35, 0], throat: [0, 1.3, 0], ear: [1.05, .08, 0], scalp: [.4, -.95, 0], face: [.55, .3, 0],
};
/** Where a named spot is on this face, in portrait space. y runs from the brow line (-) to the chin (+1). */
function spot(r, where, side) {
  const s = side === 'right' ? -1 : side === 'left' ? 1 : 0;
  const [ax, ay] = SPOTS[where] || SPOTS.cheek;
  const sx = s || (ax ? 1 : 0);
  const midY = r.eyeY, span = r.chinY - r.eyeY;
  return [r.cx + sx * ax * r.W, midY + ay * span, sx || 1];
}

function marks(c) {
  const { d, r, p, L } = c;
  let s = '';
  const rr = stream(d, 'marks');
  for (const m of d.marks) {
    const [x, y, sd] = spot(r, m.where || 'cheek', m.side);
    if (m.kind === 'scar') {
      const len = (m.len || 1) * (L === 0 ? 22 : 18) * (m.where === 'lip' || m.where === 'mouth' ? .45 : 1);   // a split lip is short
      const ang = (m.angle ?? (m.where === 'lip' || m.where === 'mouth' ? 80 : 60)) * Math.PI / 180;
      const dx = Math.cos(ang) * len / 2 * sd, dy = Math.sin(ang) * len / 2;
      const dd = 'M' + P(x - dx, y - dy) + 'Q' + P(x + dy * .15, y - dx * .15) + ' ' + P(x + dx, y + dy);
      if (L === 0) { s += el('path', { d: dd, stroke: mix(p.skin, '#ffffff', .45), 'stroke-width': 2.4, 'stroke-linecap': 'round' }); continue; }
      s += el('path', { d: dd, stroke: p.skinDeep, 'stroke-width': L === 2 ? 2.2 : 2.4, fill: 'none', opacity: .5, 'stroke-linecap': 'round', transform: 'translate(.6 .6)' });
      s += el('path', { d: dd, stroke: mix(p.skinLight, '#f0c8c0', .4), 'stroke-width': L === 2 ? 1.3 : 1.6, fill: 'none', 'stroke-linecap': 'round' });
      if (L === 2) {
        // stitch marks across an old cut
        const k = Math.round(len / 4);
        let st = '';
        for (let i = 1; i < k; i++) { const t = i / k, px = x - dx + 2 * dx * t, py = y - dy + 2 * dy * t; st += 'M' + P(px - dy / len * 2.4, py + dx / len * 2.4) + 'l' + Q(dy / len * 4.8, -dx / len * 4.8); }
        s += el('path', { d: st, stroke: mix(p.skinLight, '#f0c8c0', .3), 'stroke-width': .6, opacity: .6 });
        // a scar through a brow leaves a gap in it
        if (m.where === 'eyebrow' || m.where === 'brow') s += el('path', { d: 'M' + P(x - dx * .4, y - dy * .4 - 1) + 'L' + P(x + dx * .1, y + dy * .1 + 1), stroke: p.skin, 'stroke-width': 1.4 });
      }
    } else if (m.kind === 'burn') {
      const rad = (m.size || 1) * 10;
      const col = mix(p.skin, '#c86a5a', .4);
      s += c.blurred('b2', el('ellipse', { cx: x, cy: y, rx: rad, ry: rad * .8, fill: col, opacity: .75, transform: 'rotate(' + f(rr() * 40 - 20) + ' ' + P(x, y) + ')' }));
      if (L === 2) for (let i = 0; i < 14; i++) s += el('circle', { cx: f(x + (rr() - .5) * rad * 1.6), cy: f(y + (rr() - .5) * rad * 1.2), r: f(.8 + rr() * 1.6), fill: rr() < .5 ? mix(p.skin, '#f4c2b0', .5) : shade(col, -12), opacity: .55 });
    } else if (m.kind === 'tattoo') {
      const col = m.color || '#2d3f55';
      const dd = tattooPath(x, y, sd, m, rr);
      s += el('path', { d: dd, stroke: col, 'stroke-width': L === 0 ? 1.8 : L === 1 ? 1.1 : .8, fill: 'none', opacity: .8, 'stroke-linecap': 'round' });
    } else if (m.kind === 'mole') {
      // "above her lip": between the nose and the mouth, not on the lip
      const my = m.above && (m.where === 'lip' || m.where === 'mouth') ? lerp(r.noseTip, r.mouthY, .55) : y;
      s += el('circle', { cx: x, cy: my, r: L === 2 ? 1.3 : 1.5, fill: lum(p.skin) < 35 ? mix(p.skin, '#0c0604', .7) : shade(p.skin, -40, 10), opacity: .95 });
    } else if (m.kind === 'birthmark') {
      s += c.blurred('b2', el('ellipse', { cx: x, cy: y, rx: 8, ry: 6, fill: '#9a3c52', opacity: .35 }));
    } else if (m.kind === 'implant' || m.kind === 'port') {
      const col = m.color || '#9aa4ad';
      s += el('circle', { cx: x, cy: y, r: L === 0 ? 3 : 2.6, fill: '#2b3136', stroke: col, 'stroke-width': L === 0 ? 1.2 : .9 });
      if (L >= 1) s += el('circle', { cx: x, cy: y, r: 1, fill: m.glow || '#7fe0ff', opacity: .9 }) + el('path', { d: 'M' + P(x + sd * 2.6, y) + 'l' + Q(sd * 5, 2) + 'M' + P(x, y + 2.6) + 'l' + Q(sd * 2, 5), stroke: col, 'stroke-width': .6, opacity: .7 });
    } else if (m.kind === 'piercing') {
      s += el('circle', { cx: x, cy: y, r: L === 0 ? 1.4 : 1, fill: '#d9d4c8' });
    }
  }
  return s;
}
function tattooPath(x, y, sd, m, rr) {
  const shape = m.shape || ['lines', 'dots', 'glyph'][Math.floor(rr() * 3)];
  if (shape === 'dots') { let d = ''; for (let i = 0; i < 4; i++) d += 'M' + P(x + sd * i * 2.6, y + i * 1.2) + 'l.01 0'; return d; }
  if (shape === 'glyph') return 'M' + P(x - 3, y - 3) + 'L' + P(x + 3, y - 3) + 'L' + P(x, y + 3) + 'Z' + 'M' + P(x, y - 5) + 'L' + P(x, y + 5);
  let d = '';
  for (let i = 0; i < 3; i++) d += 'M' + P(x - sd * 4, y - 3 + i * 3) + 'Q' + P(x, y - 4 + i * 3) + ' ' + P(x + sd * 5, y - 2 + i * 3);
  return d;
}

function glasses(c) {
  const { d, r, L } = c;
  let g = d.wear.glasses;
  if (!g) return '';
  if (typeof g === 'string') g = { shape: g, pos: 'eyes' };
  if (g.pos === 'chain') return '';                    // drawn with the neck things
  const col = g.shape === 'goggles' ? '#3a3a36' : g.shape === 'wire' || g.shape === 'round' ? '#8a7a5a' : '#2a2420';
  const sw = (g.thick ? 1.8 : g.shape === 'wire' || g.shape === 'round' ? .7 : 1.1) * (L === 2 ? 1 : L === 1 ? 1.4 : 2);
  // pushed up on the forehead: the same frames, raised and tilted back (flattened)
  const up = g.pos === 'forehead' ? r.browBase - r.eyeY - 12 : 0;
  const k = g.pos === 'forehead' ? .6 : 1;
  let s = '';
  for (const eye of r.eyes) {
    const w = r.ew + (g.shape === 'rect' ? 3.5 : g.shape === 'round' ? 2 : 3), h = (g.shape === 'round' ? w * .9 : r.oh + (g.shape === 'rect' ? 2.8 : 3.6)) * k;
    const x = eye.ex - w, y = eye.ey + up - h + 1;
    if (g.shape === 'goggles') { s += el('rect', { x: eye.ex - w, y: eye.ey + up - h, width: w * 2, height: h * 2, rx: h, fill: '#7fa8a0', 'fill-opacity': .35, stroke: col, 'stroke-width': 2.4 }); continue; }
    const rx = g.shape === 'round' ? Math.min(w, h) : g.shape === 'wire' ? h * .7 : 1.6;
    const wf = w * (eye.fore || 1);
    s += el('rect', { x: f(eye.ex - wf), y: f(y), width: f(wf * 2), height: f(h * 2 - 1), rx: f(Math.min(rx, wf)), fill: '#cfe3e8', 'fill-opacity': g.pos === 'forehead' ? .3 : .1, stroke: col, 'stroke-width': f(sw) });
    if (L === 2) s += el('path', { d: 'M' + P(x + 2, y + 2.4) + 'l' + Q(4, 0), stroke: '#fff', 'stroke-width': .8, opacity: .45 });
    // arms toward the ears
    s += el('path', { d: 'M' + P(eye.ex + eye.s * wf, eye.ey + up - h * .4) + 'L' + P(r.proj(r.cx + eye.s * (r.W - .5), -2, eye.ey), eye.ey + up - 2), stroke: col, 'stroke-width': f(sw * .9), fill: 'none' });
    // a mend: silver tape wound round one arm, or wire at a hinge
    if (g.tape && L >= 1 && sideX(g.tapeSide || 'left') === eye.s) {
      const hx = eye.ex + eye.s * (w + 1.5), hy = eye.ey + up - h * .4;
      s += g.tape === 'tape' ? el('rect', { x: f(hx - 2), y: f(hy - 1.6), width: 4, height: 3.2, rx: .6, fill: '#c8ccd0', transform: 'rotate(' + (eye.s * 8) + ' ' + P(hx, hy) + ')' })
        : el('path', { d: 'M' + P(hx - 1.4, hy - 1.2) + 'l' + Q(2.8, 2.4) + 'M' + P(hx - 1.4, hy + 1.2) + 'l' + Q(2.8, -2.4), stroke: '#a8adb2', 'stroke-width': .5 });
    }
  }
  const [e0, e1] = r.eyes, b0 = e0.ex + (r.ew + 3) * e0.fore, b1 = e1.ex - (r.ew + 3) * e1.fore;
  s += el('path', { d: 'M' + P(b0, r.eyeY + up - 2) + 'Q' + P(r.proj(r.cx, 3, r.eyeY), r.eyeY + up - 4) + ' ' + P(b1, r.eyeY + up - 2), stroke: col, 'stroke-width': f(sw), fill: 'none' });
  return s;
}

/** What hangs at the neck: a scarf, a chain (with a ring, or glasses on it), a cord, a lanyard, a lapel pin. */
function neckwear(c) {
  const { d, r, p, L } = c;
  const items = d.wear.neck || [];
  if (!items.length && !(d.wear.glasses && d.wear.glasses.pos === 'chain')) return '';
  const cx = r.cx, nb = r.nb, w = r.neckW;
  let s = '';
  const line = (dd, col, sw2, op = 1) => el('path', { d: dd, stroke: col, 'stroke-width': sw2, fill: 'none', opacity: op, 'stroke-linecap': 'round' });
  for (const it of items) {
    if (it.kind === 'scarf') {
      const col = it.color, dk = shade(col, -16);
      s += el('path', { d: 'M' + P(cx - w - 3, nb - 10) + 'Q' + P(cx, nb + 2) + ' ' + P(cx + w + 3, nb - 10) + 'L' + P(cx + w + 5, nb - 3) + 'Q' + P(cx, nb + 10) + ' ' + P(cx - w - 5, nb - 3) + 'Z', fill: col });
      s += el('path', { d: 'M' + P(cx - 3, nb + 2) + 'L' + P(cx + 4, nb + 1) + 'L' + P(cx + 6, nb + 22) + 'L' + P(cx + 1, nb + 24) + 'Z', fill: dk });
      s += el('ellipse', { cx: cx + .5, cy: nb + 3, rx: 3.6, ry: 3, fill: col, stroke: dk, 'stroke-width': .6 });
      if (L >= 1) s += line('M' + P(cx - w, nb - 7) + 'Q' + P(cx, nb + 4) + ' ' + P(cx + w, nb - 7), dk, .7, .7);
    } else if (it.kind === 'chain') {
      s += line('M' + P(cx - w + 1, nb - 8) + 'Q' + P(cx, nb + 16) + ' ' + P(cx + w - 1, nb - 8), it.color, L === 2 ? .6 : 1, .9);
      if (it.ring) s += el('circle', { cx, cy: nb + 9, r: 1.8, fill: 'none', stroke: it.color, 'stroke-width': L === 2 ? 1 : 1.4 });
    } else if (it.kind === 'cord') {
      s += line('M' + P(cx - w + 2, nb - 8) + 'Q' + P(cx, nb + 12) + ' ' + P(cx + w - 2, nb - 8), '#3a3026', L === 2 ? .6 : 1, .9);
      s += el('circle', { cx, cy: nb + 6.5, r: 2, fill: it.color }) + (L === 2 ? el('circle', { cx: cx - .5, cy: nb + 6, r: .6, fill: '#fff', opacity: .5 }) : '');
    } else if (it.kind === 'lanyard') {
      s += line('M' + P(cx - w + 1, nb - 8) + 'L' + P(cx - 2, nb + 24) + 'M' + P(cx + w - 1, nb - 8) + 'L' + P(cx + 2, nb + 24), it.color, 1.6);
      s += el('rect', { x: cx - 5, y: nb + 24, width: 10, height: 13, rx: 1, fill: '#e8e6e0', stroke: '#9aa0a6', 'stroke-width': .5 });
      if (L >= 1) s += el('rect', { x: cx - 3.5, y: nb + 26, width: 4, height: 5, fill: '#8a9aa6' }) + el('rect', { x: cx + 1.5, y: nb + 27, width: 2.5, height: .8, fill: '#9aa0a6' }) + el('rect', { x: cx + 1.5, y: nb + 29, width: 2.5, height: .8, fill: '#9aa0a6' });
    } else if (it.kind === 'pin') {
      s += el('circle', { cx: cx - 22, cy: nb + 14, r: 1.8, fill: it.color, stroke: shade(it.color, -20), 'stroke-width': .5 });
    }
  }
  if (d.wear.glasses && d.wear.glasses.pos === 'chain') {
    // reading glasses on a chain, resting on the chest
    s += line('M' + P(cx - w, nb - 9) + 'Q' + P(cx - 8, nb + 20) + ' ' + P(cx - 4, nb + 21) + 'M' + P(cx + w, nb - 9) + 'Q' + P(cx + 8, nb + 20) + ' ' + P(cx + 4, nb + 21), '#c8ccd0', .5, .8);
    for (const sd of [-1, 1]) s += el('rect', { x: cx + sd * 6 - 4.5, y: nb + 19, width: 9, height: 5, rx: 1.5, fill: '#cfe3e8', 'fill-opacity': .2, stroke: '#2a2420', 'stroke-width': .8 });
  }
  return s;
}
function headwear(c) {
  const { d, r, p, L, id } = c;
  const h = d.wear.head, cx = r.cx, W = r.W;
  if (!h || h === 'none') return '';
  const col = d.wear.headColor || shade(p.wear, -6);
  const dark = shade(col, -18), light = shade(col, 14, -5);
  if (h === 'cap') {
    return el('path', { d: 'M' + P(cx - W - 3, r.top + 26) + 'Q' + P(cx - W, r.top - 6) + ' ' + P(cx, r.top - 5) + 'Q' + P(cx + W, r.top - 6) + ' ' + P(cx + W + 3, r.top + 26) + 'Z', fill: col }) +
      el('path', { d: 'M' + P(cx - W - 4, r.top + 26) + 'Q' + P(cx, r.top + 18) + ' ' + P(cx + W + 4, r.top + 26) + 'Q' + P(cx, r.top + 38) + ' ' + P(cx - W - 4, r.top + 26) + 'Z', fill: dark }) +
      (L >= 1 ? el('path', { d: 'M' + P(cx - W * .6, r.top + 4) + 'Q' + P(cx - W * .3, r.top - 2) + ' ' + P(cx, r.top - 2), stroke: light, 'stroke-width': 2, fill: 'none', opacity: .6 }) : '');
  }
  if (h === 'hood') {
    const o = W + 13;
    return el('path', { d: 'M' + P(cx - o + 4, r.chinY + 26) + 'Q' + P(cx - o - 4, r.top - 6) + ' ' + P(cx, r.top - 12) + 'Q' + P(cx + o + 4, r.top - 6) + ' ' + P(cx + o - 4, r.chinY + 26) + 'L' + P(cx + W * .95, r.chinY + 18) + 'Q' + P(cx + W + 2, r.top + 4) + ' ' + P(cx, r.top + 2) + 'Q' + P(cx - W - 2, r.top + 4) + ' ' + P(cx - W * .95, r.chinY + 18) + 'Z', fill: col }) +
      (L >= 1 ? c.blurred('b3', el('path', { d: 'M' + P(cx - W * .95, r.chinY + 10) + 'Q' + P(cx - W - 2, r.top + 4) + ' ' + P(cx, r.top + 2) + 'Q' + P(cx + W + 2, r.top + 4) + ' ' + P(cx + W * .95, r.chinY + 10), stroke: '#000', 'stroke-width': 5, fill: 'none', opacity: .45 }), { 'clip-path': 'url(#' + id + 'h)' }) : '');
  }
  if (h === 'helmet') {
    return el('path', { d: 'M' + P(cx - W - 6, r.eyeY - 6) + 'Q' + P(cx - W - 6, r.top - 10) + ' ' + P(cx, r.top - 10) + 'Q' + P(cx + W + 6, r.top - 10) + ' ' + P(cx + W + 6, r.eyeY - 6) + 'L' + P(cx + W + 2, r.browBase - 4) + 'L' + P(cx - W - 2, r.browBase - 4) + 'Z', fill: col, stroke: dark, 'stroke-width': 1 }) +
      (L >= 1 ? el('path', { d: 'M' + P(cx - W * .7, r.top + 4) + 'Q' + P(cx - W * .3, r.top - 6) + ' ' + P(cx + W * .1, r.top - 6), stroke: light, 'stroke-width': 2.5, fill: 'none', opacity: .7 }) : '');
  }
  if (h === 'scarf' || h === 'headscarf') {
    return el('path', { d: 'M' + P(cx - W - 5, r.eyeY + 4) + 'Q' + P(cx - W - 6, r.top - 8) + ' ' + P(cx, r.top - 8) + 'Q' + P(cx + W + 6, r.top - 8) + ' ' + P(cx + W + 5, r.eyeY + 4) + 'Q' + P(cx + W * .8, r.top + 18) + ' ' + P(cx, r.top + 14) + 'Q' + P(cx - W * .8, r.top + 18) + ' ' + P(cx - W - 5, r.eyeY + 4) + 'Z', fill: col }) +
      (L >= 1 ? el('path', { d: 'M' + P(cx - W * .5, r.top - 2) + 'Q' + P(cx, r.top + 6) + ' ' + P(cx + W * .6, r.top), stroke: dark, 'stroke-width': 1.2, fill: 'none', opacity: .6 }) : '');
  }
  if (h === 'goggles') {
    const y = r.top + 16;
    return el('path', { d: 'M' + P(cx - W - 1, y + 3) + 'Q' + P(cx, y - 4) + ' ' + P(cx + W + 1, y + 3), stroke: '#2c2a26', 'stroke-width': 3, fill: 'none' }) +
      [-1, 1].map(sd => el('circle', { cx: cx + sd * 13, cy: y, r: 7, fill: '#6f8f8a', stroke: '#3a3833', 'stroke-width': 2.4 }) + (L >= 1 ? el('circle', { cx: cx + sd * 13 - 2, cy: y - 2, r: 2, fill: '#fff', opacity: .5 }) : '')).join('');
  }
  if (h === 'headset') {
    return el('path', { d: 'M' + P(cx - W - 2, r.eyeY - 2) + 'Q' + P(cx - W, r.top - 6) + ' ' + P(cx, r.top - 6) + 'Q' + P(cx + W, r.top - 6) + ' ' + P(cx + W + 2, r.eyeY - 2), stroke: '#2b2f33', 'stroke-width': 2.2, fill: 'none' }) +
      el('rect', { x: cx - W - 6, y: r.eyeY - 4, width: 7, height: 12, rx: 2.5, fill: '#2b2f33' }) + el('path', { d: 'M' + P(cx - W - 2, r.eyeY + 7) + 'Q' + P(cx - W + 2, r.mouthY + 4) + ' ' + P(cx - r.mouth.mw - 3, r.mouthY), stroke: '#2b2f33', 'stroke-width': 1.2, fill: 'none' });
  }
  if (h === 'beret') {
    return el('path', { d: 'M' + P(cx - W - 3, r.top + 20) + 'Q' + P(cx - W - 8, r.top - 8) + ' ' + P(cx + 6, r.top - 9) + 'Q' + P(cx + W + 12, r.top - 6) + ' ' + P(cx + W + 4, r.top + 16) + 'Q' + P(cx, r.top + 10) + ' ' + P(cx - W - 3, r.top + 20) + 'Z', fill: col });
  }
  if (h === 'veil') {
    return el('path', { d: 'M' + P(cx - W - 4, r.top + 20) + 'Q' + P(cx, r.top - 10) + ' ' + P(cx + W + 4, r.top + 20) + 'L' + P(cx + W + 14, 230) + 'L' + P(cx - W - 14, 230) + 'Z', fill: col, opacity: .55 });
  }
  return '';
}

// ---------------------------------------------------------------- the machine face (an AI core: housing, never a human)

/**
 * An AI core in its rack. The face is abstract: the inspection window is the eye (its shutters close with the lids,
 * the light inside follows the gaze), the light's colour and strength carry the mood, the status lights and the
 * governor's seal lamp do what brows and colour do on a person.
 */
function machine(d, level, e, id, opts) {
  const L = level === 'low' ? 0 : level === 'medium' ? 1 : 2;
  const M = { casing: '#2a2c2f', glow: '#cfe6ff', window: 'slit', status: '#5ae08a', rack: '#d9d9d4', cradle: true, governor: false, seal: null, tape: null, code: '', slot: null, cables: true, scuffs: .2, plain: true, ...(d.machine || {}) };
  const vb = opts.view || VIEW[level];
  const size = opts.size || { low: 32, medium: 96, high: 320 }[level];
  const E = k => e[k] || 0;
  const cx = 100, cy = 112;
  const back = d.backdrop || '#24323a';
  // mood to light
  const warm = Math.max(0, E('smile')), hot = clamp(E('browDown') * .7 + E('sneer') * .5), sad = clamp(E('browInner') * (1 - E('browOuter') * .6) + Math.max(0, -E('smile')) * .4), fear = clamp(E('stretch') + Math.max(0, E('lidUp') - .4));
  let glow = M.glow;
  glow = mix(glow, '#fff1cf', warm * .55);
  glow = mix(glow, '#ffffff', hot * .5);
  glow = mix(glow, '#7f9cd8', sad * .45);
  const power = clamp(.78 + warm * .12 + hot * .2 + fear * .15 - sad * .35 - E('blink') * .5, .15, 1);
  const open = clamp(.62 + E('lidUp') * .35 - E('squint') * .32 - E('blink') * .9 - hot * .25 + fear * .2, .04, 1);
  const casing = M.casing, cLight = shade(casing, 12, -4), cDark = shade(casing, -9), cEdge = shade(casing, 22, -6);
  const tilt = E('tilt') * .4, nod = E('nod') * 1.6;
  let defs = '';
  const blurF = (n, sd) => el('filter', { id: id + n, x: '-50%', y: '-50%', width: '200%', height: '200%' }, el('feGaussianBlur', { stdDeviation: sd }));
  defs += blurF('b1', .6) + blurF('b2', 1.6) + blurF('b4', 5) + blurF('b6', 12);
  defs += el('radialGradient', { id: id + 'bg', cx: .45, cy: .4, r: .9 }, el('stop', { offset: 0, 'stop-color': shade(back, 8) }) + el('stop', { offset: 1, 'stop-color': shade(back, -16) }));
  defs += el('linearGradient', { id: id + 'cs', x1: 0, x2: 1, y1: 0, y2: 1 }, el('stop', { offset: 0, 'stop-color': cLight }) + el('stop', { offset: .5, 'stop-color': casing }) + el('stop', { offset: 1, 'stop-color': cDark }));
  defs += el('linearGradient', { id: id + 'rk', x1: 0, x2: 1 }, el('stop', { offset: 0, 'stop-color': shade(M.rack || '#d9d9d4', 4) }) + el('stop', { offset: 1, 'stop-color': shade(M.rack || '#d9d9d4', -18) }));
  defs += el('radialGradient', { id: id + 'gl' }, el('stop', { offset: 0, 'stop-color': glow, 'stop-opacity': .9 }) + el('stop', { offset: 1, 'stop-color': glow, 'stop-opacity': 0 }));
  let s = el('defs', {}, defs);
  const [lx, ly, lw] = VIEW.low, lc = [lx + lw / 2, ly + lw / 2], lr = lw / 2 - .5;
  if (L === 0) s += el('clipPath', { id: id + 'c' }, el('circle', { cx: lc[0], cy: lc[1], r: lr })) + '<g clip-path="url(#' + id + 'c)">';
  s += el('rect', { x: -10, y: -10, width: 220, height: 270, fill: 'url(#' + id + 'bg)' });

  // the rack: two white composite rails with slot numbers, the next slots dark
  const rk = M.rack || '#d9d9d4';
  if (L >= 1 && M.rack) {
    s += el('rect', { x: 18, y: 20, width: 12, height: 230, fill: 'url(#' + id + 'rk)' }) + el('rect', { x: 170, y: 20, width: 12, height: 230, fill: 'url(#' + id + 'rk)' });
    s += el('rect', { x: 30, y: 58, width: 140, height: 4, fill: shade(rk, -10) }) + el('rect', { x: 30, y: 176, width: 140, height: 4, fill: shade(rk, -10) });
    if (L === 2) {
      for (const [y, n] of [[40, M.slot ? +M.slot - 1 : 10], [118, M.slot || 11], [200, M.slot ? +M.slot + 1 : 12]]) s += el('text', { x: 24, y: y + 3, 'text-anchor': 'middle', 'font-family': 'ui-monospace,Consolas,monospace', 'font-size': 5.5, fill: shade(rk, -45) }, String(n));
      for (let y = 26; y < 250; y += 9) s += el('circle', { cx: 176, cy: y, r: .9, fill: shade(rk, -30) }) + el('circle', { cx: 24, cy: y + 4, r: .9, fill: shade(rk, -30) });
    }
    // the empty slots above and below, dark
    s += el('rect', { x: 34, y: 24, width: 132, height: 30, rx: 2, fill: '#15191c' }) + el('rect', { x: 34, y: 184, width: 132, height: 70, rx: 2, fill: '#15191c' });
  }
  // cable looms running down out of frame
  if (M.cables && L >= 1) {
    const rr = stream(d, 'cables');
    for (let i = 0; i < (L === 2 ? 7 : 3); i++) {
      const x0 = cx - 34 + i * 11 + rr() * 4, w = 2.5 + rr() * 2.5;
      const dd = 'M' + P(x0, cy + 40) + 'C' + P(x0 + (rr() - .5) * 20, 200) + ' ' + P(x0 + (rr() - .5) * 30, 225) + ' ' + P(x0 + (rr() - .5) * 50, 262);
      s += el('path', { d: dd, stroke: shade('#1b1e21', rr() * 8), 'stroke-width': w, fill: 'none' }) + (L === 2 ? el('path', { d: dd, stroke: '#5a6168', 'stroke-width': .5, fill: 'none', opacity: .5, transform: 'translate(-' + f(w * .25) + ' 0)' }) : '');
    }
  }
  s += '<g transform="rotate(' + f(tilt) + ' ' + P(cx, cy + 40) + ') translate(0 ' + f(nod) + ')">';
  // the core: a dense rounded block, its top face catching the room light
  const bw = 46, bh = 38;
  if (L === 2) s += el('ellipse', { cx, cy: cy + bh + 6, rx: bw + 8, ry: 6, fill: '#000', opacity: .45, filter: 'url(#' + id + 'b4)' });
  s += el('path', { d: 'M' + P(cx - bw + 6, cy - bh - 7) + 'L' + P(cx + bw - 6, cy - bh - 7) + 'L' + P(cx + bw, cy - bh) + 'L' + P(cx - bw, cy - bh) + 'Z', fill: cEdge });
  s += el('rect', { x: cx - bw, y: cy - bh, width: bw * 2, height: bh * 2, rx: L === 0 ? 8 : 6, fill: 'url(#' + id + 'cs)' });
  if (L >= 1) {
    // ceramic: a soft sheen across the upper left, and where a maker's plate would be, nothing
    s += el('rect', { x: cx - bw + 3, y: cy - bh + 3, width: bw * 1.2, height: 6, rx: 3, fill: '#fff', opacity: .06 });
    if (M.plain) s += el('rect', { x: cx + 12, y: cy + 16, width: 26, height: 12, rx: 1.5, fill: cDark, opacity: .6 }) + (L === 2 ? el('rect', { x: cx + 12.5, y: cy + 16.5, width: 25, height: 11, rx: 1.5, fill: 'none', stroke: cLight, 'stroke-width': .4, opacity: .5 }) : '');
  }
  if (L === 2) {
    const rr = stream(d, 'scuffs');
    let sc = '';
    for (let i = 0; i < 24 * M.scuffs + 4; i++) { const x = cx - bw + 4 + rr() * (bw * 2 - 8), y = cy - bh + 4 + rr() * (bh * 2 - 8); sc += 'M' + P(x, y) + 'l' + Q((rr() - .5) * 5, (rr() - .5) * 1.5); }
    s += el('path', { d: sc, stroke: cLight, 'stroke-width': .35, opacity: .45 });
  }
  // the inspection window: a narrow slit; shutters close over it like lids; the light moves inside like a gaze
  const ww = L === 0 ? 30 : 32, wh = L === 0 ? 9 : 8, wy = cy - 8;
  const half = wh * open / 2;
  s += el('rect', { x: cx - ww, y: wy - wh / 2 - 1.2, width: ww * 2, height: wh + 2.4, rx: 2.2, fill: '#0b0d0f' });
  const wcid = id + 'wc';
  s += el('clipPath', { id: wcid }, el('rect', { x: cx - ww + 1, y: wy - half, width: ww * 2 - 2, height: half * 2, rx: Math.min(1.8, half) }));
  const gx = cx + clamp(E('gazeX'), -1, 1) * ww * .55, gy = wy + clamp(E('gazeY'), -1, 1) * wh * .35;
  let win = el('rect', { x: cx - ww, y: wy - wh, width: ww * 2, height: wh * 2, fill: shade(glow, -55, -10), opacity: .9 });
  win += el('ellipse', { cx: gx, cy: gy, rx: ww * (.42 + warm * .15 - hot * .15), ry: wh * 1.2, fill: 'url(#' + id + 'gl)', opacity: power });
  win += el('ellipse', { cx: gx, cy: gy, rx: ww * .12, ry: wh * .5, fill: '#ffffff', opacity: power * .9 });
  if (L === 2) {
    // a faint scan line, and the slow pulse's bands
    for (let k = -3; k <= 3; k++) win += el('rect', { x: f(gx + k * 7 - .3), y: wy - wh, width: .6, height: wh * 2, fill: glow, opacity: f(.15 * power * (1 - Math.abs(k) / 4)) });
  }
  s += el('g', { 'clip-path': 'url(#' + wcid + ')' }, win);
  // shutter edges
  if (L >= 1) s += el('rect', { x: cx - ww + 1, y: wy - half - 1.4, width: ww * 2 - 2, height: 1.4, fill: cLight, opacity: .5 }) + el('rect', { x: cx - ww + 1, y: wy + half, width: ww * 2 - 2, height: 1, fill: '#000', opacity: .5 });
  // the window's light spilling on the casing below it and into the room
  if (L >= 1) s += el('ellipse', { cx: gx, cy: wy + 10, rx: ww * .9, ry: 9, fill: glow, opacity: .08 * power, filter: 'url(#' + id + 'b4)' });
  if (L === 2) s += el('ellipse', { cx, cy: wy, rx: 80, ry: 50, fill: glow, opacity: .07 * power, filter: 'url(#' + id + 'b6)' });

  // the cradle: clamps gripping the core from both sides, bolted to the rack
  if (M.cradle && L >= 1) {
    const cr = '#3a4046', crL = shade(cr, 12), crD = shade(cr, -10);
    for (const sd of [-1, 1]) {
      const x = cx + sd * (bw + 2);
      s += el('path', { d: 'M' + P(x - sd * 8, cy - 20) + 'L' + P(x + sd * 10, cy - 24) + 'L' + P(x + sd * 10, cy + 30) + 'L' + P(x - sd * 8, cy + 26) + 'Z', fill: sd < 0 ? crL : crD, stroke: crD, 'stroke-width': .6 });
      s += el('rect', { x: x + sd * 10 - (sd > 0 ? 0 : 8), y: cy - 8, width: 8, height: 14, fill: cr });
      for (const y of [cy - 14, cy + 18]) s += el('circle', { cx: x + sd * 2, cy: y, r: 1.6, fill: crD, stroke: crL, 'stroke-width': .5 });
      s += el('rect', { x: x - (sd > 0 ? 8 : 0) - sd * 0, y: cy - 2, width: 8, height: 2.4, fill: '#2a8a86', opacity: .9 });   // the maker's accent
    }
    s += el('rect', { x: cx - bw - 8, y: cy + bh - 4, width: (bw + 8) * 2, height: 10, rx: 1.5, fill: cr, stroke: crD, 'stroke-width': .6 });
    // the row of status lights along the cradle's base
    const nLit = clamp(Math.round(3 + warm * 3 + E('lidUp') * 1.5 - sad * 3 + fear * 2), 0, 7);
    const amber = hot > .45, flick = fear > .5;
    for (let k = 0; k < 7; k++) {
      const on = flick ? k % 2 === 0 : k < nLit;
      const col = amber && on ? '#ffb340' : M.status || '#5ae08a';
      s += el('circle', { cx: cx - 27 + k * 9, cy: cy + bh + 1, r: L === 2 ? 1.5 : 2, fill: on ? col : '#1d2a22' });
      if (on && L === 2) s += el('circle', { cx: cx - 27 + k * 9, cy: cy + bh + 1, r: 4, fill: col, opacity: .25, filter: 'url(#' + id + 'b2)' });
    }
    // masking tape with the name the lab gave it, in marker
    if (M.tape) {
      const tx = cx - 22, ty = cy + bh + 13;
      s += el('g', { transform: 'rotate(-4 ' + P(tx, ty) + ')' }, el('rect', { x: tx - 16, y: ty - 6, width: 32, height: 10, fill: '#d8c89a', opacity: .95 }) + (L === 2 ? el('path', { d: 'M' + P(tx - 16, ty - 6) + 'l1 1.4 1 -1.4 1 1.4M' + P(tx + 16, ty + 4) + 'l-1 -1.4 -1 1.4', stroke: '#b8a87a', 'stroke-width': .4, fill: 'none' }) : '') +
        el('text', { x: tx, y: ty + 1.6, 'text-anchor': 'middle', 'font-family': "'Segoe Print','Bradley Hand','Comic Sans MS',cursive", 'font-size': L === 2 ? 7 : 8, 'font-weight': 700, fill: '#1c2a52' }, esc(M.tape)));
    }
  }
  // the governor bolted on top under its audit seal; its lamp wakes when the core runs hot or scared
  if (M.governor && L >= 1) {
    const gy2 = cy - bh - 7;
    s += el('rect', { x: cx - 20, y: gy2 - 12, width: 40, height: 12, rx: 1.5, fill: '#4a4f55', stroke: '#2a2e32', 'stroke-width': .6 });
    for (const sd of [-1, 1]) s += el('circle', { cx: cx + sd * 16, cy: gy2 - 6, r: 1.4, fill: '#2a2e32', stroke: '#6a7076', 'stroke-width': .4 });
    if (M.seal) {
      const sealCol = { red: '#b8282a', amber: '#c88a2a', yellow: '#c8b02a', blue: '#2a5ab8', green: '#2a8a4a' }[M.seal] || '#b8282a';
      s += el('rect', { x: cx - 7, y: gy2 - 14, width: 14, height: 16, fill: sealCol, opacity: .92 }) + (L === 2 ? el('text', { x: cx, y: gy2 - 4.5, 'text-anchor': 'middle', 'font-family': 'ui-monospace,Consolas,monospace', 'font-size': 3.2, fill: '#f4d8d8' }, 'AUDIT') : '');
    }
    const lamp = clamp(hot * 1.3 + fear * .9);
    s += el('circle', { cx: cx + 11, cy: gy2 - 6, r: 1.3, fill: lamp > .35 ? '#ff3b30' : '#3a1a1a' });
    if (lamp > .35 && L === 2) s += el('circle', { cx: cx + 11, cy: gy2 - 6, r: 5, fill: '#ff3b30', opacity: .3 * lamp, filter: 'url(#' + id + 'b2)' });
  }
  if (M.code && L === 2) s += el('text', { x: cx - bw + 5, y: cy + bh - 8, 'font-family': 'ui-monospace,Consolas,monospace', 'font-size': 4.5, 'letter-spacing': .8, fill: cLight, opacity: .55 }, esc(M.code));
  s += '</g>';
  if (L === 0) s += '</g>' + el('circle', { cx: lc[0], cy: lc[1], r: lr, fill: 'none', stroke: '#000', 'stroke-opacity': .35, 'stroke-width': 2 });
  if (L === 2) s += el('rect', { x: -30, y: -30, width: 260, height: 310, fill: 'none', stroke: '#000', 'stroke-width': 50, opacity: .4, filter: 'url(#' + id + 'b4)' });
  const w = size, h = Math.round(size * vb[3] / vb[2]);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.join(' ') + '" width="' + w + '" height="' + h + '" role="img" class="face face-' + level + '"' + (opts.title ? ' aria-label="' + esc(opts.title) + '"' : ' aria-hidden="true"') + '>' + s + '</svg>';
}

// ---------------------------------------------------------------- outlines for other renderers

/**
 * The rig's outlines as SVG path strings, in portrait space: what face-clay.js sculpts its relief from. pose as in
 * rig(). Each comes in the frame face()
 * draws it in, so masks meet the albedo: `place` says which transform face() wraps it in ('body': none; 'head': the
 * tilt about `pivot`; 'face': the tilt, then the nod and turn `shift`). Hair and beard come bent round a turned head.
 */
export function shapes(desc, expr = {}, pose = 0) {
  const d = desc.v ? desc : normalize(desc);
  const c = { d, e: expr, id: 'sh', level: 'high', p: palette(d), r: rig(d, expr, pose), L: 2 };
  const r = c.r, st = d.hair.style, turned = Math.abs(r.phi) > .002;
  const bendHair = body => turned ? bent((x, y) => r.so.wrap(x, y, true), body) : body();
  const bendFace = (body, dx) => turned ? bent((x, y) => r.so.wrap(x, y, false) - dx, body) : body();
  c.headD = spline(r.head, true);
  const hs = d.kind === 'machine' ? null : hairShape(c);
  const eyePath = eye => 'M' + P(...eye.inner) + 'C' + P(...eye.u1) + ' ' + P(...eye.u2) + ' ' + P(...eye.outer) + 'C' + P(...eye.l1) + ' ' + P(...eye.l2) + ' ' + P(...eye.inner) + 'Z';
  return {
    d, r, view: VIEW.high, palette: c.p, tilt: r.tilt, pivot: r.pivot, shift: r.shift,
    place: { head: 'head', torso: 'body', hair: 'head', hairBack: 'body', scalp: 'head', beard: 'face', eyes: 'face', lips: 'face' },
    head: c.headD,
    torso: torsoPath(c),
    hair: hs ? bendHair(() => spline([...hs.outer, ...hs.inner], true, .85)) : null,
    hairShape: hs,
    hairBack: d.kind !== 'machine' && hairBehind(d) ? bendHair(() => hairBackPath(c)) : null,
    scalp: st === 'shaved' || st === 'buzz' || st === 'undercut' ? bendHair(() => (sh => spline([...sh.outer, ...sh.inner], true, .8))(scalpShape(c, st === 'undercut'))) : null,
    beard: d.beard.style !== 'none' ? bendFace(() => beardPath(c), r.shift[0]) : null,
    eyes: r.eyes.map(eyePath),
    lips: lipGeom(r),
  };
}

// ---------------------------------------------------------------- animation

/**
 * A live high-level portrait in `host`. set(expr, ms) tweens to a new expression; the face blinks and shifts its gaze
 * on its own (opts.blink, opts.saccades false to stop either).
 * Re-renders the SVG each frame (about 1-3 ms at 320 px), which keeps one code path for still and moving faces.
 */
export function mount(host, desc, opts = {}) {
  const d = desc.v ? desc : normalize(desc);
  const level = opts.level || 'high';
  const uid = opts.uid || ('fm' + (++uidN).toString(36));
  let cur = { ...(opts.expr || {}) }, from = cur, to = cur, t0 = 0, dur = 0, blinkAt = performance.now() + 1500, raf = 0, alive = true;
  let sacc = [0, 0], saccAt = performance.now() + 900;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let still = true;
  const draw = fast => { host.innerHTML = face(d, level, { ...opts, expr: cur, uid, fast }); still = !fast; };
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const tick = now => {
    if (!alive) return;
    let k = dur ? clamp((now - t0) / dur) : 1;
    const base = blend(from, to, ease(k));
    // blink: about every 3-6 s, 140 ms
    let b = 0;
    if (!reduce && opts.blink !== false) {
      const dt = now - blinkAt;
      if (dt > 0 && dt < 160) b = Math.sin(dt / 160 * Math.PI);
      else if (dt >= 160) blinkAt = now + 2600 + Math.random() * 3400;
    }
    // saccades: the eyes jump to a nearby point now and then and hold it, so a still face is never frozen
    if (!reduce && opts.saccades !== false && now >= saccAt) {
      sacc = Math.random() < .35 ? [0, 0] : [(Math.random() - .5) * .28, (Math.random() - .5) * .16];
      saccAt = now + 700 + Math.random() * 2200;
    }
    const next = { ...base, blink: Math.max(base.blink || 0, b), gazeX: (base.gazeX || 0) + sacc[0], gazeY: (base.gazeY || 0) + sacc[1] };
    const changed = CONTROLS.some(c => Math.abs((next[c] || 0) - (cur[c] || 0)) > .002);
    cur = next;
    // mid-motion frames skip the costliest detail (brush filter, skin grain, half the strands); the settled frame has it all
    if (changed) draw(true); else if (!still) draw(false);
    raf = requestAnimationFrame(tick);
  };
  draw(false);
  raf = requestAnimationFrame(tick);
  return {
    set(expr, ms = 380) { from = { ...cur, blink: 0, gazeX: (cur.gazeX || 0) - sacc[0], gazeY: (cur.gazeY || 0) - sacc[1] }; to = { ...expr }; t0 = performance.now(); dur = reduce ? 0 : ms; },
    get expr() { return cur; },
    stop() { alive = false; cancelAnimationFrame(raf); },
  };
}
