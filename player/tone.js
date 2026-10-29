// The player's pure side: what a tone means (emotion -> frame and colour, intensity -> motion) and the frame schedule
// a played line follows. No DOM, so node tests cover it; portrait.js draws what timeline() says.

// The emotions a host may name. Each family plays one expression frame and gives the host one colour; the words are
// what a host or writer might say instead. An expression lives in the eyes, so the families stay few and the motion
// (from intensity) carries the rest. A family whose frame an asset lacks falls back to neutral.
export const EMOTIONS = {
  neutral: { frame: 'neutral', colour: '#9aa7b8', words: ['flat', 'plain', 'matter-of-fact', 'even'] },
  warm: { frame: 'warm', colour: '#f0b45c', words: ['happy', 'kind', 'fond', 'amused', 'glad', 'relieved', 'gentle', 'friendly', 'pleased', 'teasing', 'grateful'] },
  angry: { frame: 'angry', colour: '#e5553f', words: ['furious', 'irritated', 'annoyed', 'harsh', 'hostile', 'stern', 'contempt', 'scornful', 'impatient', 'snapping'] },
  afraid: { frame: 'afraid', colour: '#a993f2', words: ['scared', 'fearful', 'nervous', 'anxious', 'worried', 'shocked', 'startled', 'alarmed', 'panicked', 'tense'] },
  sad: { frame: 'neutral', colour: '#6f9edb', words: ['grieving', 'tired', 'weary', 'resigned', 'sorry', 'hurt', 'quiet', 'regretful'] },
  cold: { frame: 'neutral', colour: '#86c6d8', words: ['guarded', 'wary', 'suspicious', 'distant', 'formal', 'curt', 'icy'] },
  curious: { frame: 'look', colour: '#7fd3ae', words: ['interested', 'intrigued', 'sly', 'probing', 'puzzled', 'questioning'] },
};

const WORD = new Map(Object.entries(EMOTIONS).flatMap(([name, e]) => [[name, name], ...e.words.map((w) => [w, name])]));

// { name, frame, colour } for any word: a family name, one of its words, else neutral. `frames`: the asset's frame
// names; a frame it lacks plays neutral.
export function emotionOf(word, frames = null) {
  const name = WORD.get(String(word ?? '').trim().toLowerCase()) ?? 'neutral';
  const e = EMOTIONS[name];
  const frame = !frames || frames.includes(e.frame) ? e.frame : 'neutral';
  return { name, frame, colour: e.colour };
}

const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.3);
const lerp = (a, b, t) => a + (b - a) * t;

// Intensity 0..1 -> how the portrait and the text move. Low is soft, slow and flowing: long crossfades, slow flaps,
// a breathing sway. High is rough and fast: hard cuts, quick flaps, a small shake. Lengths in ms, offsets in art px.
export function motionOf(intensity) {
  const i = clamp01(intensity);
  const rough = Math.max(0, (i - 0.5) / 0.5);
  return {
    intensity: i,
    fadeMs: i < 0.6 ? Math.round(lerp(560, 140, i / 0.6)) : 0,
    flapMs: Math.round(lerp(200, 75, i)),
    charMs: Math.round(lerp(68, 36, i)),
    pauseMs: Math.round(lerp(1500, 650, i)),
    blinkMs: [Math.round(lerp(3200, 1500, i)), Math.round(lerp(6500, 3400, i))],
    closedMs: Math.round(lerp(120, 70, i)),
    swayPx: Math.max(0, 1 - i * 1.7),
    swayMs: Math.round(lerp(2800, 1700, i)),
    shakePx: rough * 2,
    shakeMs: Math.round(lerp(150, 55, rough)),
    // the text helper: soft words float on a slow wave, rough ones jitter on a fast step
    text: i < 0.5
      ? { kind: 'wave', px: lerp(2, 1, i * 2), ms: Math.round(lerp(2000, 1300, i * 2)), staggerMs: 110 }
      : { kind: 'shake', px: lerp(0.8, 2, rough), ms: Math.round(lerp(260, 110, rough)), staggerMs: 0 },
  };
}

// mulberry32: the same seed always gives the same blinks and flaps, so a line plays alike each time and tests can pin it.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// A line's beats: one slot per character, the mouth open on letters and shut on spaces, longer shut on punctuation.
export function beatsOf(text) {
  const out = [];
  for (const ch of String(text ?? '')) {
    if (/[.!?…]/.test(ch)) out.push(0, 0, 0, 0, 0);
    else if (/[,;:—–]/.test(ch)) out.push(0, 0, 0);
    else out.push(/[\p{L}\p{N}]/u.test(ch) ? 1 : 0);
  }
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
}

// The schedule of a played tone: at(t) gives what to draw t ms after play() began, looping.
//   { expression, prev, mix (0..1, expression over prev), eyes: null|'blink_half'|'blink_closed', mouth: null|'talk_a'|'talk_b',
//     blink (0 open .. 1 shut), open (0 shut .. 1 wide: the mouth), dx, dy (motion, art px), speaking, emotion (the
//     family's name), intensity }
// The frame names are what a frame set draws; the numbers say the same for a live source that blends continuously,
// and emotion lets it show the families a frame set plays as neutral (sad, cold) in their own way.
// tone: { emotion, intensity, text }; frames: the asset's frame names. The line is spoken (mouth flapping by its
// beats), held, and spoken again; a neutral speaker looks at the listener while speaking and away in the pause.
export function timeline(tone, frames) {
  const m = motionOf(tone?.intensity);
  const emo = emotionOf(tone?.emotion, frames);
  const has = (f) => frames.includes(f);
  const beats = beatsOf(tone?.text);
  // with no text the face only listens: it looks at the listener for a while, then away, and never opens its mouth
  const speakMs = beats.length ? beats.length * m.charMs : 1800;
  const lead = Math.round(m.fadeMs / 2);
  const cycle = speakMs + m.pauseMs;
  const seed = hash(`${emo.name}|${m.intensity}|${tone?.text ?? ''}`);
  const gaze = emo.frame === 'neutral' && has('look');

  // blinks: [start, end] pairs, extended as time goes on
  const blinks = [];
  const nextBlink = rng(seed ^ 0x9e3779b9);
  let horizon = 0;
  const blinkAt = (t) => {
    while (horizon <= t + 1000) {
      horizon += m.blinkMs[0] + nextBlink() * (m.blinkMs[1] - m.blinkMs[0]);
      blinks.push(horizon);
    }
    const len = 60 + m.closedMs + 60;
    const b = blinks.find((s) => t >= s && t < s + len);
    if (b === undefined) return null;
    const k = t - b;
    return k < 60 || k >= 60 + m.closedMs ? 'blink_half' : 'blink_closed';
  };

  const want = (t) => {
    const local = t < lead || !cycle ? -1 : (t - lead) % cycle;
    const facing = local < speakMs;
    return { speaking: local >= 0 && facing && beats.length > 0, local, expression: gaze ? (facing ? 'look' : 'neutral') : emo.frame };
  };
  // when the wanted expression last changed before t, and from what, for the crossfade
  // (play() fades in from the still neutral at 0; a neutral speaker's gaze then turns at each speak and pause)
  const lastChange = (t) => {
    if (!gaze || t < lead) return { since: 0, from: 'neutral' };
    const local = (t - lead) % cycle;
    if (local >= speakMs) return { since: t - (local - speakMs), from: 'look' };
    return { since: t - local === lead ? 0 : t - local, from: 'neutral' };
  };

  return {
    motion: m, emotion: emo, cycle, speakMs, lead,
    at(t) {
      const w = want(t);
      const ch = lastChange(t);
      const mix = m.fadeMs ? Math.min(1, (t - ch.since) / m.fadeMs) : 1;
      let mouth = null;
      if (w.speaking && has('talk_a')) {
        const slot = Math.floor(w.local / m.charMs);
        if (beats[slot]) {
          const flap = Math.floor(w.local / m.flapMs);
          const r = rng(seed + flap)();
          mouth = !has('talk_b') ? 'talk_a' : flap % 2 ? (r < 0.75 ? 'talk_b' : 'talk_a') : (r < 0.8 ? 'talk_a' : null);
        }
      }
      const eyes = has('blink_closed') ? blinkAt(t) : null;
      const sway = m.swayPx ? Math.round(Math.sin((2 * Math.PI * t) / m.swayMs) * m.swayPx) : 0;
      let dx = 0;
      let dy = sway;
      if (m.shakePx) {
        const step = Math.floor(t / m.shakeMs);
        const r = rng(seed ^ step);
        const amp = w.speaking ? m.shakePx : m.shakePx / 2;
        dx = Math.round((r() * 2 - 1) * amp);
        dy += Math.round((r() * 2 - 1) * amp);
      }
      const blink = eyes === 'blink_closed' ? 1 : eyes ? 0.5 : 0;
      const open = mouth === 'talk_b' ? 1 : mouth ? 0.5 : 0;
      return { expression: w.expression, prev: ch.from, mix, eyes, mouth, blink, open, dx, dy, speaking: w.speaking, emotion: emo.name, intensity: m.intensity };
    },
  };
}

// The head: a square around the eyes and mouth boxes (meta.regions), padded and kept inside the frame, for hosts that
// show a close-up (a dialogue line) rather than the whole portrait. [x, y, w, h] in art px.
export function headBox(meta, side = 112) {
  const [W, H] = meta.size;
  const e = meta.regions?.eyes;
  const mo = meta.regions?.mouth;
  if (!e || !mo) return [0, 0, W, H];
  const s = Math.min(side, W, H);
  const cx = (Math.min(e.x, mo.x) + Math.max(e.x + e.w, mo.x + mo.w)) / 2;
  const cy = (e.y + mo.y + mo.h) / 2;
  const x = Math.round(Math.min(Math.max(cx - s / 2, 0), W - s));
  const y = Math.round(Math.min(Math.max(cy - s / 2, 0), H - s));
  return [x, y, s, s];
}

// The whole-number scale that shows `artPx` art pixels nearest to `cssPx` CSS pixels on a screen of `dpr` device
// pixels per CSS pixel, never below one device pixel per art pixel: { k (device px per art px), css (CSS px per art px) }.
export function pixelScale(artPx, cssPx, dpr = 1) {
  const k = Math.max(1, Math.round((cssPx * dpr) / artPx));
  return { k, css: k / dpr };
}
