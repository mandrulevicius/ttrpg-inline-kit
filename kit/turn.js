// The turn widget: the GM's story turn, in the chat's markdown grammar, staged as the pane's Story column stages it
// (inks, speech beside the speaker's face, the roll as dice, screens as screens), with each spoken line's tone
// playing on the face and the words. The payload is the turn's markdown as the element's own text, readable while it
// streams and if this module never loads; this only ever restyles text already on screen, so motion never delays
// reading. Payload:
//   <div class="tt-turn" style="white-space:pre-wrap" data-cast="Fenn=npc.odile-fenn/painted-pixel" data-tones="Fenn: cold .4|warm .5">
//   …the turn's markdown, with & and < written &amp; and &lt;…
//   </div><script type="module" src="<kit base>kit/turn.js"></script>
// data-cast: only the turn's speakers with a face (kit/turn-view.js readCast); data-tones: its tones.json entries.
import { readCast, readTones, stage, turnText } from './turn-view.js';
import { addStyle, inked } from './style.js';
import { FACE_LEVELS } from '../pane/html.js';
import { loadMeta, pixelScale, stillView } from '../player/portrait.js';
import { linePlayer, portraitCache } from '../player/dialogue.js';

const ASSETS = new URL('../assets/ttrpg/', import.meta.url);
const folderUrl = (folder) => new URL(`${folder.split('/').map(encodeURIComponent).join('/')}/`, ASSETS).href;
const WHICH = { small: { head: FACE_LEVELS.small[0] }, high: { head: FACE_LEVELS.high[0] } };
const META_WAIT_MS = 1500; // the plain text is on screen meanwhile; past this the turn is staged without faces
const AUTOPLAY_WINDOW_MS = 4000; // a turn seen this soon after it lands plays its lines once, in order
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// How long a line holds the stage when the turn reads itself through: about a reader's pace.
const holdOf = (line) => Math.min(9000, Math.max(1800, 700 + 270 * line.textContent.trim().split(/\s+/).length));

addStyle('tt-turn-css', `
.tt-turn{white-space:normal;color:var(--text-primary);font:16px/1.7 var(--font-sans,system-ui,sans-serif);padding:.25rem 0}
.tt-turn .blk{margin:0 0 .85em}
.tt-turn .p,.tt-turn .breath{text-wrap:pretty;overflow-wrap:anywhere}
.tt-turn .bl{display:block}
.tt-turn .say,.tt-turn .who{color:${inked('var(--ink,var(--text-primary))')}}
.tt-turn .who{font-weight:500}
.tt-turn .say.dev{font-style:italic}
.tt-turn .machine{font:500 .8em/1 var(--font-mono,monospace);letter-spacing:.06em;color:var(--text-secondary)}
.tt-turn code{font:.88em var(--font-mono,monospace);background:var(--surface-1);padding:0 .25em;border-radius:4px}
.tt-turn .slate{display:flex;gap:10px;align-items:center;margin:1.2em 0 .9em;font-size:13px;line-height:1.3;color:var(--text-secondary)}
.tt-turn .slate .t{color:var(--text-muted);font-variant-numeric:tabular-nums}
.tt-turn .slate::after,.tt-turn .sess::before,.tt-turn .sess::after{content:"";flex:1;border-top:.5px solid var(--border)}
.tt-turn .sess{display:flex;gap:12px;align-items:center;margin:.6em 0 1.2em;font-size:13px;letter-spacing:.06em;color:var(--text-secondary)}
.tt-turn .scr{max-width:30rem;border-radius:8px;overflow:hidden;background:#07100b;color:#a8dcb0}
.tt-turn .scr .sh{padding:5px 10px;border-bottom:.5px solid currentColor;font:12px/1.3 var(--font-mono,monospace);opacity:.75}
.tt-turn .scr pre{margin:0;padding:8px 10px 10px;font:13px/1.45 var(--font-mono,monospace);white-space:pre-wrap;overflow-wrap:anywhere}
.tt-turn .scr .ln{display:block}
.tt-turn .scr.tripad{background:#140c03;color:#ffb347;border:6px solid #2a2622;border-radius:14px}
.tt-turn .scr.holo{background:#03050b;color:#c9f4ff;border:.5px solid rgba(120,230,255,.4);border-radius:0}
.tt-turn .scr.neural{background:#02060a;color:#f2f7ff;border-left:2px solid #55e3ff;border-radius:0}
.tt-turn .paper{max-width:32rem;padding:12px 16px;background:#ece7d8;color:#24221d;border:.5px solid rgba(0,0,0,.15);border-radius:2px;font-size:14px;line-height:1.5}
.tt-turn .paper>div{padding:2px 0}
.tt-turn .paper strong{font-weight:500;letter-spacing:.04em}
.tt-turn .paper em{font-family:var(--font-voice,Georgia,serif);color:#2f3b63}
.tt-turn .paper s{opacity:.55}
.tt-turn .tbl td,.tt-turn .tbl th{padding:4px 10px 4px 0;text-align:left}
.tt-turn .tbl th{font-weight:500;color:var(--text-secondary);border-bottom:.5px solid var(--border)}
.tt-turn .rv{display:flex;flex-direction:column;gap:6px;padding:8px 12px;border:.5px solid var(--border);border-radius:8px;background:var(--surface-1)}
.tt-turn .rlead b{font-weight:500}
.tt-turn .rband{font-weight:500}
.tt-turn .rband.good{color:var(--text-success)}.tt-turn .rband.warn{color:var(--text-warning)}.tt-turn .rband.bad{color:var(--text-danger)}
.tt-turn .rsev{color:var(--text-warning)}
.tt-turn .rproof{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;font-size:13px;color:var(--text-secondary)}
.tt-turn .dice{display:flex;gap:5px}
.tt-turn .die{width:22px;height:22px;flex:none}
.tt-turn .die rect{fill:var(--text-primary)}.tt-turn .die circle{fill:var(--surface-2,#fff)}
.tt-turn .dropped{display:flex;opacity:.35}
.tt-turn .sum{font-variant-numeric:tabular-nums}
.tt-turn .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.tt-turn .ooc{padding:4px 12px;border-left:2px solid var(--border-strong);border-radius:0;font-size:14px;color:var(--text-secondary)}
.tt-turn .ooc b{display:block;font-size:12px;font-weight:500}
.tt-turn .rule{border:0;border-top:.5px solid var(--border)}
.tt-turn .plain{font-size:14px;color:var(--text-secondary);overflow-wrap:anywhere}
.tt-turn .reply{display:none}
.tt-turn .face{--ap:var(--ap-high);position:relative;display:inline-block;flex:none;overflow:hidden;width:calc(var(--fw) * var(--ap));height:calc(var(--fh) * var(--ap));background:#05070a;line-height:0;border-radius:8px;transition:box-shadow .3s}
.tt-turn .face.small{--ap:var(--ap-small);border-radius:6px}
.tt-turn .face img{position:absolute;max-width:none;left:calc(var(--fx) * var(--ap) * -1);top:calc(var(--fy) * var(--ap) * -1);width:calc(var(--iw) * var(--ap));height:calc(var(--ih) * var(--ap));image-rendering:pixelated;user-select:none}
.tt-turn .face canvas{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated}
.tt-turn .face.smooth img,.tt-turn .face.smooth canvas{image-rendering:auto}
.tt-turn .face.lit{box-shadow:0 0 0 2px var(--emo)}
.tt-turn .voiced{display:flex;gap:14px;align-items:flex-start}
.tt-turn .bubble{position:relative;flex:1;min-width:0;border:.5px solid var(--border-strong);border-radius:12px;background:var(--surface-2,transparent);transition:border-color .3s,background-color .3s}
.tt-turn .voiced>.bubble{margin:0;padding:.45em .85em .5em}
.tt-turn .voiced>.bubble::before{content:"";position:absolute;left:-6px;top:16px;width:10px;height:10px;background:inherit;border-left:inherit;border-bottom:inherit;transform:rotate(45deg)}
.tt-turn .xt{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:4px 12px}
.tt-turn .xtag{font-size:13px;line-height:1;font-weight:500;color:var(--text-secondary);padding-top:.6em;text-align:right}
.tt-turn .xv{display:flex;gap:8px;align-items:flex-start}
.tt-turn .xv>.bubble{padding:.15em .6em .2em}
.tt-turn .bubble.lit{border-color:var(--emo);background-color:color-mix(in srgb,var(--emo) 10%,var(--surface-2,transparent))}
.tt-turn [data-voiced]{cursor:default}
@media (max-width:480px){.tt-turn .voiced{gap:10px}.tt-turn .xt{grid-template-columns:minmax(0,1fr)}.tt-turn .xtag{text-align:left;padding-top:.3em}}
`);

// Each level's CSS px per art px: a whole number of device pixels, so pixel art stays crisp (as the pane does).
function setScales(el) {
  const dpr = globalThis.devicePixelRatio || 1;
  for (const [level, [art, css]] of Object.entries(FACE_LEVELS)) el.style.setProperty(`--ap-${level}`, `${pixelScale(art, css, dpr).css}px`);
}

async function setUp(el) {
  el.dataset.staged = '';
  const text = turnText(el.textContent);
  const cast = readCast(el.dataset.cast);
  const metas = new Map();
  const folders = [...new Set(cast.map((c) => c.portrait).filter(Boolean))];
  await Promise.race([Promise.allSettled(folders.map(async (f) => metas.set(f, await loadMeta(folderUrl(f))))), sleep(META_WAIT_MS)]);
  const face = (folder, level) => {
    const meta = metas.get(folder);
    const d = meta && WHICH[level] && stillView(folderUrl(folder), meta, WHICH[level]);
    return d ? { folder, ...d } : null;
  };
  const html = stage({ text, cast, tones: readTones(el.dataset.tones) }, face);
  if (!html) return;
  setScales(el);
  el.innerHTML = html;
  el.style.whiteSpace = 'normal';
  voice(el, face);
}

// The spoken lines' tones: once through in order when the turn is seen as it lands, then any line again on hover.
function voice(el, face) {
  const said = [...el.querySelectorAll('.say[data-face]')];
  if (!said.length) return;
  const cache = portraitCache();
  const lines = linePlayer();
  let reading = false;

  function play(line) {
    const unit = line.closest('[data-voiced]');
    const span = unit?.querySelector(`.face[data-face="${CSS.escape(line.dataset.face)}"]`);
    const d = span && face(line.dataset.face, span.classList.contains('small') ? 'small' : 'high');
    const tone = { emotion: line.dataset.emo, intensity: Number(line.dataset.int), text: line.textContent.replace(/^[“"]|[”"]$/g, '') };
    lines.play({ line, tone, face: d ? cache.get(folderUrl(d.folder), [d.x, d.y, d.w, d.h]) : null, host: span, tint: [unit?.querySelector('.bubble'), span] });
  }

  async function readThrough() {
    reading = true;
    for (const line of said) {
      if (!reading) return;
      play(line);
      await sleep(holdOf(line));
    }
    if (reading) lines.stop();
    reading = false;
  }

  el.addEventListener('mouseover', (e) => {
    const unit = e.target.closest?.('[data-voiced]');
    if (!unit) return;
    const line = e.target.closest('.say[data-face]') ?? (unit.contains(lines.line) ? lines.line : unit.querySelector('.say[data-face]'));
    if (!line || (line === lines.line && !reading)) return;
    reading = false;
    play(line);
  });
  el.addEventListener('mouseleave', () => { reading = false; lines.stop(); });

  if (reduced.matches) return;
  const landed = performance.now();
  const seen = new IntersectionObserver(([e]) => {
    if (!e?.isIntersecting) return;
    seen.disconnect();
    if (performance.now() - landed < AUTOPLAY_WINDOW_MS) readThrough();
  });
  seen.observe(el);
  setTimeout(() => seen.disconnect(), AUTOPLAY_WINDOW_MS);
}

for (const el of document.querySelectorAll('.tt-turn:not([data-staged])')) setUp(el).catch(() => { /* the plain text stays */ });
