// An animated portrait for any game's dialogue window: a standalone ES module, no dependencies, no game code.
// A Portrait plays a line's tone on a canvas: the expression held, talk while the line is spoken, natural blinks, a gaze
// shift, and motion by intensity (soft and flowing when low, rough and fast when high). It moves only while played and
// returns to the still neutral; with prefers-reduced-motion it shows stills.
//
// What it draws comes from a source. A frame set (assets/<consumer>/<npc>/<pipeline>/) is the first kind; a live set
// (a renderer that blends continuously and turns the head, such as sources/vector.js) is the other, behind the same
// interface; loadPortrait picks by the set's meta.json:
//   source = { width, height, frames: [names it can show], draw(g, state),
//              live?, scale?, smooth?, settled?, onFrame? }
// draw() gets the 2D context of the canvas and one state of timeline().at() (see tone.js), whose numeric fields (mix,
// blink, open, dx, dy, emotion, intensity) a live source reads directly; `playing` is true while a line plays. A live
// source is drawn every frame while it plays and, after, until it is `settled`; it calls onFrame when it has a new
// frame to paint. Its canvas holds `scale` px per art px, drawn smooth when `smooth` (pixel art stays pixelated).
// Display effects (a CRT look, the emotion tint, motion) are playback's, on top of any source and switchable per game:
// `effects` run after each draw. See README.md.
import { EMOTIONS, emotionOf, headBox, motionOf, pixelScale, timeline } from './tone.js';

export { EMOTIONS, emotionOf, headBox, motionOf, pixelScale, timeline };

const reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
const OVERLAYS = { blink_half: 'eyes', blink_closed: 'eyes', talk_a: 'mouth', talk_b: 'mouth' };
const MOTION_MARGIN = 2; // art px a frame set's picture may move inside its window, so motion never shows an edge

const metas = new Map();
// Live sets by meta.renderer: the module that makes their source (load(url, meta, { crop }) -> source).
const RENDERERS = { vector: () => import('./sources/vector.js') };

// The frame set's meta.json (cached). `url` is the folder, with or without a trailing slash.
export function loadMeta(url) {
  const base = url.endsWith('/') ? url : `${url}/`;
  if (!metas.has(base)) {
    metas.set(base, fetch(`${base}meta.json`).then((r) => {
      if (!r.ok) throw new Error(`${base}meta.json: HTTP ${r.status}`);
      return r.json();
    }).catch((e) => { metas.delete(base); throw e; }));
  }
  return metas.get(base);
}

// The URL of an icon level ('low', 'medium') or a frame of a loaded meta, or null when the set has none.
export function fileUrl(url, meta, which) {
  const base = url.endsWith('/') ? url : `${url}/`;
  const file = meta.icons?.[which]?.file ?? meta.frames?.[which];
  return file ? base + file : null;
}

export const colourOf = (emotion) => emotionOf(emotion).colour;

// What a host shows of a set without playing it, from its loaded meta: an icon ('low', 'medium'), a close-up of the
// head ({ head: side in art px }, see headBox), or the whole picture ('whole'; a frame set's less its motion margin).
// { src, x, y, w, h, W, H, smooth }: the window [x, y, w, h] onto an image of W x H art px; smooth means it is not
// pixel art (scale it smoothly; the PNG may hold meta.scale px per art px). Null when the set has no such image.
// [x, y, w, h] is also the crop to give loadPortrait for the same window, alive.
export function stillView(url, meta, which) {
  const base = url.endsWith('/') ? url : `${url}/`;
  const smooth = !!meta?.smooth;
  if (!Array.isArray(meta?.size) || !meta.frames?.neutral) return null;
  if (which === 'low' || which === 'medium') {
    const icon = meta.icons?.[which];
    if (!icon?.file || !Array.isArray(icon.size)) return null;
    const [w, h] = icon.size;
    return { src: base + icon.file, x: 0, y: 0, w, h, W: w, H: h, smooth };
  }
  const [W, H] = meta.size;
  const m = meta.kind === 'live' ? 0 : MOTION_MARGIN;
  const [x, y, w, h] = which?.head ? headBox(meta, which.head) : [m, m, W - 2 * m, H - 2 * m];
  return { src: base + meta.frames.neutral, x, y, w, h, W, H, smooth };
}

function image(src) {
  const im = new Image();
  im.decoding = 'async';
  im.src = src;
  return im.decode().then(() => im);
}

function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// The pixels where `frame` differs from neutral, alone on a transparent layer, so a blink or a talk flap can sit on
// any expression without bringing neutral's brows or mouth corners with it. If the pixels can't be read (an image from
// another origin without CORS), the frame's whole region box is used instead.
function overlayOf(frame, neutral, region, W, H) {
  const out = canvasOf(W, H);
  const g = out.getContext('2d');
  try {
    const a = canvasOf(W, H).getContext('2d', { willReadFrequently: true });
    a.drawImage(frame, 0, 0);
    const b = canvasOf(W, H).getContext('2d', { willReadFrequently: true });
    b.drawImage(neutral, 0, 0);
    const fa = a.getImageData(0, 0, W, H);
    const fb = b.getImageData(0, 0, W, H).data;
    const d = fa.data;
    for (let k = 0; k < d.length; k += 4) {
      if (d[k] === fb[k] && d[k + 1] === fb[k + 1] && d[k + 2] === fb[k + 2]) d[k + 3] = 0;
    }
    g.putImageData(fa, 0, 0);
  } catch {
    if (region) g.drawImage(frame, region.x, region.y, region.w, region.h, region.x, region.y, region.w, region.h);
  }
  return out;
}

// A frame set as a source. crop: [x, y, w, h] in art px, the window shown (default the whole frame less a 2 px margin
// for motion; headBox(meta) gives a close-up). Rejects when meta.json or a frame won't load.
export async function loadFrameSet(url, { crop } = {}) {
  const meta = await loadMeta(url);
  const names = Object.keys(meta.frames ?? {});
  if (!names.includes('neutral')) throw new Error(`${url}: no neutral frame`);
  const imgs = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await image(fileUrl(url, meta, n))])));
  const [W, H] = meta.size;
  const layers = {};
  for (const [n, zone] of Object.entries(OVERLAYS)) if (imgs[n]) layers[n] = overlayOf(imgs[n], imgs.neutral, meta.regions?.[zone], W, H);
  const [x, y, w, h] = crop ?? [MOTION_MARGIN, MOTION_MARGIN, W - 2 * MOTION_MARGIN, H - 2 * MOTION_MARGIN];
  return {
    kind: 'frames', url, meta, width: w, height: h, frames: names,
    // The previous expression under the current one at `mix`, then the blink and talk layers; motion moves the window.
    draw(g, s) {
      const at = (src) => g.drawImage(src, x - s.dx, y - s.dy, w, h, 0, 0, w, h);
      g.globalAlpha = 1;
      g.clearRect(0, 0, w, h);
      if (s.mix < 1) at(imgs[s.prev] ?? imgs.neutral);
      g.globalAlpha = s.mix;
      at(imgs[s.expression] ?? imgs.neutral);
      g.globalAlpha = 1;
      if (s.eyes && layers[s.eyes]) at(layers[s.eyes]);
      if (s.mouth && layers[s.mouth]) at(layers[s.mouth]);
    },
  };
}

const STILL = { prev: 'neutral', mix: 1, eyes: null, mouth: null, blink: 0, open: 0, dx: 0, dy: 0, speaking: false };

export class Portrait {
  // source: a frame set (loadFrameSet) or a live renderer with the same shape. effects: functions (g, state, portrait)
  // run after each draw, for a game's own display look.
  constructor(source, { effects = [] } = {}) {
    this.source = source;
    this.meta = source.meta ?? null;
    this.frames = source.frames ?? ['neutral'];
    this.effects = effects;
    const k = source.scale ?? 1;
    this.canvas = canvasOf(Math.round(source.width * k), Math.round(source.height * k));
    this.canvas.className = 'portrait';
    if (!source.smooth) this.canvas.style.imageRendering = 'pixelated';
    this.g = this.canvas.getContext('2d');
    this.g.imageSmoothingEnabled = !!source.smooth;
    this.raf = 0;
    this.again = 0; // a live source's next redraw outside play
    if (source.live) source.onFrame = () => this.refresh();
    this.key = '';
    this.state = null;
    this.timeline = null;
    this.still();
  }

  draw(s) {
    const key = `${s.prev}|${s.expression}|${s.mix.toFixed(2)}|${s.eyes}|${s.mouth}|${s.dx}|${s.dy}`;
    if (key === this.key && !this.source.live) return;
    this.key = key;
    this.state = s;
    this.canvas.dataset.frame = key; // what is showing, for a host or a test to read
    this.source.draw(this.g, s);
    for (const fx of this.effects) fx(this.g, s, this);
    if (this.source.live && !this.source.settled) this.refresh();
  }

  // A live source keeps being drawn until it settles; while a line plays, play's own loop draws it.
  refresh() {
    if (this.again) return;
    this.again = requestAnimationFrame(() => {
      this.again = 0;
      if (!this.raf && this.state) this.draw(this.state);
    });
  }

  // A still: the emotion's expression (default neutral), nothing moving (a live source eases into it and stops).
  still(emotion = 'neutral') {
    this.halt();
    const e = emotionOf(emotion, this.frames);
    this.draw({ ...STILL, expression: e.frame, emotion: e.name });
  }

  // Plays a tone, looping until stop(): { emotion, intensity (0..1), text (the line, for its talk rhythm; omit for a
  // face that only listens) }. Reduced motion: the expression's still.
  play(tone = {}) {
    this.halt();
    if (reduced.matches) return this.still(tone.emotion);
    const tl = timeline(tone, this.frames);
    const from = this.state;
    const t0 = performance.now();
    const tick = (now) => {
      const s = tl.at(now - t0);
      // the first fade starts from whatever was showing, not always neutral
      if (from && s.prev === 'neutral' && s.mix < 1 && now - t0 < tl.lead + tl.motion.fadeMs) s.prev = from.expression;
      s.playing = true;
      this.draw(s);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    this.timeline = tl;
  }

  // Back to the still neutral, eased by the last tone's intensity (a soft line fades back, a harsh one cuts).
  stop() {
    const s = this.state;
    const fade = this.timeline?.motion.fadeMs ?? 0;
    this.halt();
    if (!s || reduced.matches || !fade || s.expression === 'neutral') return this.still();
    const t0 = performance.now();
    const tick = (now) => {
      const mix = Math.min(1, (now - t0) / fade);
      this.draw({ ...STILL, prev: s.expression, expression: 'neutral', mix });
      this.raf = mix < 1 ? requestAnimationFrame(tick) : 0;
    };
    this.raf = requestAnimationFrame(tick);
  }

  halt() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  get playing() { return this.raf !== 0; }

  // Sizes the canvas to the whole-number scale nearest `cssPx` wide on this screen (any scale for a smooth source);
  // returns CSS px per art px.
  fit(cssPx) {
    const { width: w, height: h } = this.source;
    const css = this.source.smooth ? cssPx / w : pixelScale(w, cssPx, globalThis.devicePixelRatio || 1).css;
    this.canvas.style.width = `${w * css}px`;
    this.canvas.style.height = `${h * css}px`;
    return css;
  }
}

// A set's portrait in one call, either kind: its meta.json says which (a live set names its renderer). crop: the
// window, as for loadFrameSet. Rejects when the set or its renderer does not load.
export async function loadPortrait(url, { crop, effects } = {}) {
  const meta = await loadMeta(url);
  if (meta.kind !== 'live') return new Portrait(await loadFrameSet(url, { crop }), { effects });
  const renderer = RENDERERS[meta.renderer];
  if (!renderer) throw new Error(`${url}: no renderer "${meta.renderer}"`);
  return new Portrait(await (await renderer()).load(url, meta, { crop }), { effects });
}

// Animates the words of `el` by a tone until the returned function is called, which puts the element back as it was:
// soft tones float the words on a slow wave, harsh ones jitter them on a fast step. Uses the Web Animations API, so it
// needs no stylesheet. Reduced motion: nothing moves.
export function animateText(el, tone = {}) {
  if (reduced.matches || typeof el?.animate !== 'function') return () => {};
  const saved = el.cloneNode(true);
  const words = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const texts = [];
  while (walk.nextNode()) texts.push(walk.currentNode);
  for (const t of texts) {
    const frag = document.createDocumentFragment();
    for (const part of t.data.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { frag.append(part); continue; }
      const w = document.createElement('span');
      w.style.display = 'inline-block';
      w.textContent = part;
      frag.append(w);
      words.push(w);
    }
    t.replaceWith(frag);
  }
  const { text: m } = motionOf(tone.intensity);
  const seed = Math.floor(Math.random() * 1e9);
  const anims = words.map((w, k) => {
    if (m.kind === 'wave') {
      return w.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-m.px}px)` }, { transform: 'translateY(0)' }, { transform: `translateY(${m.px * 0.6}px)` }, { transform: 'translateY(0)' }],
        { duration: m.ms, iterations: Infinity, delay: -((k * m.staggerMs) % m.ms), easing: 'ease-in-out' });
    }
    let r = (seed + k * 7919) >>> 0;
    const rand = () => { r = (Math.imul(r, 1103515245) + 12345) >>> 0; return (r / 4294967296) * 2 - 1; };
    // each keyframe holds until the next (a per-keyframe step easing): jumps, not glides
    const frames = Array.from({ length: 5 }, () => ({ transform: `translate(${(rand() * m.px).toFixed(2)}px, ${(rand() * m.px).toFixed(2)}px)`, easing: 'steps(1, end)' }));
    return w.animate([...frames, frames[0]], { duration: m.ms * 5, iterations: Infinity, delay: -((k * 37) % (m.ms * 5)) });
  });
  return () => {
    for (const a of anims) a.cancel();
    el.replaceChildren(...saved.childNodes);
  };
}
