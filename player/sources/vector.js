// The live source for vector faces (pipelines/vector-faces): it draws the renderer's high level each frame from the
// player's state, so expressions blend continuously and the head turns, where a frame set can only cut or fade.
// ./vector/ holds the renderer, copied there by the pipeline's bin/export.mjs (edit it in the pipeline, not here).
//
// The player's timeline says what the line is (emotion and intensity, when the mouth is open, when the speaker faces
// the listener, the sway and shake); the motion is this source's own: expressions ease towards the tone (soft lines
// flow, rough ones snap with a little overshoot), blinks, saccades, a glance and a turn of the head away in the pauses,
// the mouth following the talk. A still (no line playing) settles and stops; with prefers-reduced-motion it snaps.
import { CONTROLS, expression, face, normalize } from './vector/faces.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const add = (a, b, k = 1) => { const o = { ...a }; for (const c of CONTROLS) if (b[c]) o[c] = (o[c] || 0) + b[c] * k; return o; };

// The player's emotion families as the renderer's controls at full strength. Cold and curious have no named
// expression in the renderer, so they are mixed here.
export const LOOKS = {
  neutral: {},
  warm: expression('warm'),
  angry: expression('angry'),
  afraid: expression('afraid'),
  sad: expression('sad'),
  cold: { browDown: 0.3, lidUp: -0.25, squint: 0.15, lipPress: 0.6, smile: -0.12, nod: -0.15 },
  curious: { browOuter: 0.55, browInner: 0.15, asym: 0.5, lidUp: 0.15, smile: 0.1, tilt: 4 },
};
// The frame names the player's timeline should schedule for this source: talk, blinks, the look at the listener.
export const FRAMES = ['neutral', 'look', 'warm', 'angry', 'afraid', 'blink_half', 'blink_closed', 'talk_a', 'talk_b'];

const reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

// The motion, apart from drawing: step(state, now) advances it and returns the controls to draw. Pure but for its own
// randomness (rand), so node tests drive it with a fixed clock.
export class Motion {
  constructor({ rand = Math.random } = {}) {
    this.rand = rand;
    this.cur = {};
    this.vel = {};
    this.mouth = 0;
    this.t = null;
    this.blinkAt = null;
    this.sacc = [0, 0];
    this.saccAt = 0;
    this.away = [0, 0];
    this.facing = true;
    this.moving = false;
    this.settled = false;
  }

  // What the state asks for, before easing: the emotion's look at the tone's strength, the head turned away and the
  // eyes off the listener in a soft line's pause, the sway and shake as small turns and nods.
  target(s) {
    const i = Number.isFinite(s.intensity) ? s.intensity : 0.3;
    const look = LOOKS[s.emotion] ?? LOOKS.neutral;
    let e = add({}, look, lerp(0.55, 1.15, i));
    if (this.playing && !this.facing && i < 0.7 && s.emotion !== 'angry') e = add(e, { turn: this.away[0], gazeX: this.away[0] * 1.6, gazeY: this.away[1] });
    if (s.dx || s.dy) e = add(e, { turn: (s.dx || 0) * 0.04, tilt: (s.dx || 0) * 0.9, nod: (s.dy || 0) * 0.06 });
    return e;
  }

  // Advances to `now` (ms) and returns the controls. s.playing: a line is on (blinks and saccades run, the head may
  // turn away in its pauses); otherwise the face settles on the state's look and stops.
  step(s, now) {
    const first = this.t == null; // the first state is shown as it is, not eased into
    const dt = first ? 0 : clamp(now - this.t, 0, 100);
    this.t = now;
    const playing = !!s.playing;
    if (playing !== this.playing) {
      this.playing = playing;
      this.blinkAt = now + 600 + this.rand() * 1800;
    }
    // each time the speaker stops facing the listener, a fresh side and depth to look away to
    const facing = !!(s.speaking || s.expression === 'look');
    if (facing !== this.facing && !facing) this.away = [(this.rand() < 0.5 ? -1 : 1) * (0.25 + this.rand() * 0.15), 0.1 + this.rand() * 0.2];
    this.facing = facing;
    const i = Number.isFinite(s.intensity) ? s.intensity : 0.3;
    const want = this.target(s);
    // a spring per control: critically damped when soft, under-damped (a small overshoot) when rough
    const w = lerp(9, 30, i);
    const z = i > 0.6 ? 0.55 : 1;
    let moving = false;
    for (const c of CONTROLS) {
      const goal = want[c] || 0;
      let x = this.cur[c] || 0;
      let v = this.vel[c] || 0;
      if (reduced.matches || first) { x = goal; v = 0; } else {
        for (let k = 0, n = Math.ceil(dt / 8), h = dt / 1000 / n; k < n; k++) { v += (w * w * (goal - x) - 2 * z * w * v) * h; x += v * h; }
      }
      if (Math.abs(goal - x) > 0.002 || Math.abs(v) > 0.01) moving = true; else { x = goal; v = 0; }
      this.cur[c] = x;
      this.vel[c] = v;
    }
    // the mouth follows the talk quickly, wider and more stretched when rough
    const open = s.open || 0;
    this.mouth = reduced.matches || first ? open : lerp(this.mouth, open, 1 - Math.exp(-dt / 35));
    if (Math.abs(this.mouth - open) > 0.01) moving = true;
    const out = { ...this.cur };
    out.mouthOpen = (out.mouthOpen || 0) + this.mouth * lerp(0.22, 0.45, i);
    out.stretch = (out.stretch || 0) + this.mouth * lerp(0.03, 0.15, i);
    if (playing && !reduced.matches) {
      // blinks: about every 2-6 s (sooner when tense), 160 ms, closing fast and opening slower
      const b = now - this.blinkAt;
      if (b >= 0 && b < 180) { out.blink = Math.max(out.blink || 0, b < 60 ? b / 60 : 1 - (b - 60) / 120); moving = true; }
      else if (b >= 180) this.blinkAt = now + lerp(3000, 1600, i) + this.rand() * lerp(3200, 1800, i);
      // saccades: the eyes jump to a nearby point now and then and hold it
      if (now >= this.saccAt) {
        this.sacc = this.rand() < 0.35 ? [0, 0] : [(this.rand() - 0.5) * 0.26, (this.rand() - 0.5) * 0.14];
        this.saccAt = now + 600 + this.rand() * 2000;
      }
      out.gazeX = (out.gazeX || 0) + this.sacc[0];
      out.gazeY = (out.gazeY || 0) + this.sacc[1];
    }
    this.moving = moving;
    this.settled = !moving && !playing;
    return out;
  }
}

const same = (a, b) => !!a && CONTROLS.every((c) => Math.abs((a[c] || 0) - (b[c] || 0)) < 0.002);

// A live source from a vector set's meta.json (assets/<consumer>/<npc>/vector-faces/): crop is [x, y, w, h] in the
// still's art px, as for a frame set. The canvas holds `scale` px per art px (default: the screen's device pixels).
// Resolves once the first frame is drawn.
export async function load(url, meta, { crop, scale } = {}) {
  const d = normalize(meta.face);
  const [W, H] = meta.size;
  const [vx, vy, vw] = meta.view;
  const k = W / vw; // art px per unit of the renderer's portrait space
  const [x, y, w, h] = crop ?? [0, 0, W, H];
  const view = [vx + x / k, vy + y / k, w / k, h / k];
  const res = scale ?? Math.max(1, Math.ceil(globalThis.devicePixelRatio || 1));
  const motion = new Motion();
  let ready = null; // the newest decoded frame
  let drawn = null; // the controls it shows, and whether in full detail
  let pending = null;
  let pumping = null; // the render loop, while frames are queued
  const source = {
    kind: 'live', url, meta, width: w, height: h, scale: res, smooth: true, live: true, frames: FRAMES,
    onFrame: null, // set by the Portrait: called when a new frame is ready to paint
    // nothing left to move or render: the Portrait stops redrawing
    get settled() { return motion.settled && !pumping; },
    draw(g, s) {
      const e = motion.step(s, performance.now());
      const full = !motion.moving;
      if (!drawn || !same(drawn.e, e) || (full && !drawn.full)) request(e, full);
      if (ready) {
        g.clearRect(0, 0, g.canvas.width, g.canvas.height);
        g.drawImage(ready, 0, 0, g.canvas.width, g.canvas.height);
      }
    },
  };
  // One frame renders at a time; requests made meanwhile collapse into the newest, so a slow screen drops frames
  // rather than falling behind. Mid-motion frames skip the costliest detail (opts.fast); the settled one has it all.
  function request(e, full) {
    pending = { e, full };
    drawn = pending;
    pumping ??= pump().finally(() => { pumping = null; });
  }
  async function pump() {
    while (pending) {
      const p = pending;
      pending = null;
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(face(d, 'high', { expr: p.e, view, size: Math.round(w * res), uid: 'v', fast: !p.full }))}`;
      try { await img.decode(); ready = img; } catch { /* a frame that fails to decode is skipped */ }
      source.onFrame?.();
    }
  }
  request(motion.step({ expression: 'neutral', emotion: 'neutral' }, performance.now()), true);
  await pumping;
  if (!ready) throw new Error(`${url}: the vector face did not render`);
  return source;
}
