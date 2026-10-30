// The story view (html.3, html.6, html.9): each turn's chat text read by the chat's layout grammar (md.1,
// docs/designs/markdown-medium.md) and staged as HTML. Pure: no DOM. Everything that came from a file goes through
// esc(); the chat's words are staged, never added to (html.1), and text in a form it doesn't know is shown plainly.
import { DEVICES } from './devices.js';
import { gaugeHtml, resultOf } from './gauge.js';
import { esc, faceHtml, tip } from './html.js';

// ---- voices (html.6): an ink per speaker, legible on the pane's dark ground

// The named inks a people.json `voice: {ink}` may use; each is at least 4.5:1 against the story's background.
export const INKS = { amber: '#e8b04a', coral: '#f0907a', rose: '#ec8fb8', violet: '#b8a2f2', sky: '#82b8f2', jade: '#6fd6a0', moss: '#b4cc72', sand: '#dcc08e' };
const PALETTE = Object.values(INKS);
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const TEXT_RGB = [214, 221, 230]; // --text

const rgbOf = (hex) => {
  const h = hex.length === 4 ? [...hex.slice(1)].map((c) => c + c).join('') : hex.slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
export const luminance = (hex) => {
  const f = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = rgbOf(hex);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const hexOf = (rgb) => `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;

// A colour the GM chose, lightened towards the text colour until it reads on the dark ground (luminance 0.2 is about
// 4.5:1 against it), so a dark ink can't make speech vanish.
export function legible(hex) {
  let rgb = rgbOf(hex);
  for (let k = 0; k < 12 && luminance(hexOf(rgb)) < 0.2; k++) rgb = rgb.map((c, i) => Math.round(c + (TEXT_RGB[i] - c) * 0.25));
  return hexOf(rgb);
}

// FNV-1a: the same id always picks the same ink, so voices work with no GM change.
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// A person's ink: their `voice.ink` when it is a named ink or a #rgb/#rrggbb colour, else one picked by their id.
export function inkOf(p) {
  const v = String(p?.ink ?? '').trim();
  if (Object.hasOwn(INKS, v.toLowerCase())) return INKS[v.toLowerCase()];
  if (HEX.test(v)) return legible(v.toLowerCase());
  return PALETTE[hash(String(p?.id ?? p?.name ?? '')) % PALETTE.length];
}

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The people the story can name: the party's People list, by the names it knows (never ids, so a disguise holds; A1).
// Each is matched by full name in any case, or by any capitalised word of a longer name (three letters or more, not
// "The") as written: "Bert" for Bert Achebe-Lowe, but never "hope" in prose for Hope Okoro. A word two people's names
// share names neither. `tip`: what the party knows of them, for their speaker tag (A16: detail behind the element,
// never the name it shows).
export function castOf(m) {
  const people = (m?.people?.list ?? []).filter((p) => p.name);
  const wordsOf = (p) => {
    const all = p.name.split(/\s+/).filter(Boolean);
    return all.length > 1 ? all.filter((w) => w.length >= 3 && w !== 'The' && /^\p{Lu}/u.test(w)) : [];
  };
  const uses = new Map(); // how many people each word could name; a one-word name counts as its word
  for (const p of people) {
    const words = wordsOf(p);
    for (const w of new Set((words.length ? words : [p.name]).map((x) => x.toLowerCase()))) uses.set(w, (uses.get(w) ?? 0) + 1);
  }
  return people.map((p) => {
    const words = wordsOf(p).filter((w) => uses.get(w.toLowerCase()) === 1);
    const alts = [`(?i:${reEsc(p.name)})`, ...words.map(reEsc)].join('|');
    const lines = [...p.fields.map(([k, v]) => `${k}: ${v}`), ...p.known.map((k) => k.text)];
    return { id: p.id, name: p.name, ink: inkOf(p), portrait: p.portrait ?? '', tip: lines.join('\n'), re: new RegExp(`(?<![\\w'.-])(?:${alts})(?![\\w])`, 'g') };
  });
}

// The person a script tag names: the whole tag is their full name or last word.
const castFor = (cast, tag) => cast.find((c) => { c.re.lastIndex = 0; return [...tag.matchAll(c.re)].some((x) => x[0].length === tag.trim().length); });

// ---- tones (html.12): how each spoken line is said, for the portrait and the bubble on hover

// A tones.json entry, "[<speaker>: ]<emotion> <intensity>" ("angry .8", "Fenn: angry .8"; the intensity 0..1, default
// .5), as { emotion, intensity[, who] }, or null for anything else. `who` is the speaker as the party knows them, for a
// line whose paragraph names no one (told by speech). The emotion word is the player module's to interpret; an unknown
// one plays neutral there.
export function toneOf(entry) {
  const m = /^\s*(?:(\p{L}[\p{L}\p{M}'. -]*?)\s*:\s*)?([a-z][a-z' -]*?)\s*(\d*\.?\d+)?\s*$/iu.exec(String(entry ?? ''));
  if (!m) return null;
  const i = m[3] === undefined ? 0.5 : Number(m[3]);
  return { emotion: m[2].toLowerCase(), intensity: Math.min(1, Math.max(0, i)), ...(m[1] && { who: m[1] }) };
}

// A line with no tone from the GM: neutral at a mild intensity, nudged by how it is written.
export function defaultTone(words) {
  const w = String(words ?? '');
  let i = 0.3;
  if (w.includes('!')) i += 0.3;
  if (w.includes('?')) i += 0.08;
  if (/\b[A-Z]{2,}\b/.test(w.replace(/\b(?:OK|AI)\b/g, ''))) i += 0.25;
  if (/(?:—|--)\s*$/.test(w)) i += 0.15;
  if (/(?:…|\.\.\.)/.test(w)) i -= 0.1;
  return { emotion: 'neutral', intensity: Math.round(Math.min(1, Math.max(0.1, i)) * 100) / 100 };
}

// A turn's voice: its spoken lines numbered in order (each quote, said in the room or through a device, and each
// cross-talk line), the tone each takes, and the portraits that speak. `face(folder, level)` describes a portrait the
// pane can show (pane/faces.js), or null: none known, no staging.
const voiceOf = (turn, ctx) => ({ next: 0, tones: (turn.tones ?? []).map(toneOf), faces: [], face: ctx.face ?? (() => null) });

// The person the turn's tones name for the next spoken line, if any (a paragraph with no name in it).
const toldSpeaker = (voice, cast) => { const who = voice?.tones[voice.next]?.who; return who ? castFor(cast, who) : undefined; };

// Numbers a spoken line; when its speaker has a portrait the pane can show, its attributes: the number, the tone and
// the portrait (nothing otherwise: a line with no face is staged as before).
function lineAttrs(voice, c, words) {
  if (!voice) return '';
  const k = voice.next++;
  if (!c?.portrait || !voice.face(c.portrait, 'high')) return '';
  const t = voice.tones[k] ?? defaultTone(words);
  voice.faces.push(c.portrait);
  return ` data-line="${k}" data-emo="${esc(t.emotion)}" data-int="${t.intensity}" data-face="${esc(c.portrait)}"`;
}

// ---- inline forms

// **bold**, *italic*, ~~strike~~ in text already free of code spans and speech. The markers survive escaping.
const emph = (s) => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*\s](?:[^*]*[^*\s])?)\*/g, '<em>$1</em>')
  .replace(/~~(.+?)~~/g, '<s>$1</s>');

const inkStyle = (c) => (c ? ` style="--ink:${c.ink}"` : '');
// A speaker's name as a button: the A16 tip says what the party knows of them; a click opens them in the People tab.
const who = (c, shown) => `<button class="who" data-npc="${esc(c.id)}"${tip(c.tip, { shown })}${inkStyle(c)}>${esc(shown)}</button>`;

// `inline mono` is a machine speaking aloud; *"…"* a voice through a device; "…" speech in the room.
const SPEECH = /`([^`]+)`|\*["“]([^*]*?)["”]\*|["“]([^"”\n]+)["”]/g;

// Inline text with no speech staging (papers, tables, the ooc note): emphasis, and code as a mono chip.
export function plainInline(text) {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(/`([^`]+)`/g)) {
    out += emph(text.slice(last, m.index)) + `<code>${esc(m[1])}</code>`;
    last = m.index + m[0].length;
  }
  return out + emph(text.slice(last));
}

// A quote the player's character says, told in the second person: "you say" (ask, tell…) right after it, or right
// before it in the same sentence ("you ask Fenn, …").
const SAYS = 'say|ask|tell|reply|answer|add|shout|call|whisper|mutter|murmur|snap|offer|repeat';
const YOURS_AFTER = new RegExp(`^[\\s,]*you\\s+(?:\\w+\\s+)?(?:${SAYS})\\b`, 'i');
const YOURS_BEFORE = new RegExp(`\\byou\\s+(?:\\w+\\s+)?(?:${SAYS})\\b[^.!?"“”]*$`, 'i');

// A line of prose: speech in its speaker's ink. A quote takes the ink of the nearest known name before it in the
// line (outside quotes), else the first after; no name, the default ink. The player character's own quote takes no
// one's (no ink, no face), whatever names are near it. `named`: the people already shown as a button this turn; the
// name that attributes someone's first quote becomes one. `voice` (voiceOf) numbers the lines.
export function speech(text, cast = [], named = new Set(), voice = null) {
  const blanked = text.replace(SPEECH, (m) => ' '.repeat(m.length));
  const hits = [];
  for (const c of cast) { c.re.lastIndex = 0; for (const h of blanked.matchAll(c.re)) hits.push({ at: h.index, len: h[0].length, c }); }
  hits.sort((a, b) => a.at - b.at || b.len - a.len);
  const marks = [];
  let since = 0; // where the text after the previous quote starts
  for (const m of text.matchAll(SPEECH)) {
    const before = text.slice(since, m.index);
    since = m.index + m[0].length;
    if (m[1] !== undefined) { marks.push({ at: m.index, len: m[0].length, html: `<span class="machine">${esc(m[1])}</span>` }); continue; }
    const yours = YOURS_AFTER.test(text.slice(since)) || YOURS_BEFORE.test(before);
    const hit = yours ? null : hits.filter((h) => h.at < m.index).pop() ?? hits.find((h) => h.at > m.index);
    // the paragraph's own names first; the GM's tone entry only fills a gap
    const c = yours ? null : hit?.c ?? toldSpeaker(voice, cast);
    if (hit && !named.has(c.id) && !marks.some((k) => k.at === hit.at)) {
      named.add(c.id);
      marks.push({ at: hit.at, len: hit.len, html: who(c, text.substr(hit.at, hit.len)) });
    }
    const dev = m[2] !== undefined;
    const words = dev ? m[2] : m[3];
    marks.push({ at: m.index, len: m[0].length, html: `<span class="say${dev ? ' dev' : ''}"${inkStyle(c)}${lineAttrs(voice, c, words)}>“${emph(words)}”</span>` });
  }
  marks.sort((a, b) => a.at - b.at);
  let out = '';
  let last = 0;
  for (const k of marks) {
    if (k.at < last) continue; // a name inside a span already placed
    out += emph(text.slice(last, k.at)) + k.html;
    last = k.at + k.len;
  }
  return out + emph(text.slice(last));
}

// ---- the dice line (md.6): the sentence src/dice.mjs formatRoll prints, then its proof
//   🎲 <name>: <attempt>[, aimed at <location>] → <Outcome>[, <who or where> <hurt> | , avoided][, pushed from <band>] ([<Stat ±n> · ][<line> · ]<dice>[ <mod>][ push +n] = <total>, needed <n>[, advantage|disadvantage])
// <mod> is signed, in quarters, with its rounding when it had a fraction ("+2½→+3", "+½→0"). The stat and the line
// (with its reason) came with the recorded roll; lines printed before it have neither. The name is the one the party
// knows, as printed. A hidden roll prints without 🎲 and is never read as one.

const OUTCOMES = ['Exceptional success', 'Solid success', 'Success at a cost', 'Near miss', 'Failure', 'Disaster'];
const ROLL = new RegExp(`^🎲 (?:(.+) )?→ (${OUTCOMES.join('|')})(?:, (.+ (?:grazed|wounded|maimed|destroyed or an organ hit)|avoided))?(?:, pushed from ([a-z ]+))? `
  + '\\((?:(\\p{Lu}[\\p{L}-]* [+-]\\d+) · )?(?:(.+?) · )?'
  + '((?:\\[[1-6]\\] )*\\[[1-6]\\])((?: ~~\\[[1-6]\\]~~)*)(?: ([+-]\\d*[¼½¾]?(?:→[+-]?\\d+)?))?(?: push \\+([1-4]))? = (-?\\d+), needed (-?\\d+)(?:, (advantage|disadvantage))?\\)$', 'u');
// The form before T34 (`🎲 kade +1 · [4][3] = 8 vs 8 → +0 success at a cost — why`), which older sessions hold.
const OLD_ROLL = /^🎲 (?:(\S+) )?([+-]\d+) · ((?:\[[1-6]\])+)(?: \(dropped \[([1-6])\]\))? = (-?\d+) vs (\d+)(?: \(called (.+?), line \+\d+\))? → [+-]\d+ ([a-z ]+?)(?: · (.+?) to (.+?))?(?: — (.+))?$/u;

const dieList = (s) => [...s.matchAll(/\d/g)].map(Number);

// { name, attempt, outcome, hurt, pushed, push, stat, line, kept, dropped, drops, mod, total, needed, mode, called, id }
// or null. `id`: the old form's roller id, for the view to name; the new form already names them. `kept` is the you
// die, then the moment die that counted (in lines before the recorded roll, simply the two dice kept); `drops` every
// die set aside (a worn or spent you die, luck's other moment die), `dropped` the first of them. `pushed`: the band
// the dice alone gave, when he pushed `push`.
export function rollOf(line) {
  const text = line.trim();
  const m = ROLL.exec(text);
  if (m) {
    const lead = m[1] ?? '';
    const cut = lead.indexOf(': ');
    const drops = dieList(m[8] ?? '');
    return {
      name: cut >= 0 ? lead.slice(0, cut) : '', attempt: cut >= 0 ? lead.slice(cut + 2) : lead, outcome: m[2], hurt: m[3] ?? '',
      pushed: m[4] ?? '', push: m[10] ? Number(m[10]) : 0, stat: m[5] ?? '', line: m[6] ?? '',
      kept: dieList(m[7]), dropped: drops[0] ?? null, drops, mod: m[9] ?? '', total: m[11], needed: m[12], mode: m[13] ?? '', called: '', id: '',
    };
  }
  const o = OLD_ROLL.exec(text);
  if (!o) return null;
  return {
    name: '', id: o[1] ?? '', attempt: o[11] ?? '', outcome: o[8].charAt(0).toUpperCase() + o[8].slice(1), hurt: o[9] ? `${o[9]} to ${o[10]}` : '',
    stat: '', line: '',
    kept: dieList(o[3]), dropped: o[4] ? Number(o[4]) : null, drops: o[4] ? [Number(o[4])] : [], mod: o[2] === '+0' ? '' : o[2], total: o[5], needed: o[6], mode: '', called: o[7] ?? '',
    pushed: '', push: 0,
  };
}

const PIPS = { 1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [3, 1], [1, 3], [3, 3]], 5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], 6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]] };
const die = (n) => `<svg class="die" viewBox="0 0 26 26" aria-hidden="true"><rect x=".5" y=".5" width="25" height="25" rx="5"/>${PIPS[n].map(([x, y]) => `<circle cx="${x * 6.5}" cy="${y * 6.5}" r="2.3"/>`).join('')}</svg>`;
const OUTCOME_CLASS = { 'exceptional success': 'good', 'solid success': 'good', 'success at a cost': 'good', 'near miss': 'warn', failure: 'bad', disaster: 'bad' };

// The recorded roll a 🎲 line printed, from the rolls the pane serves (ctx.rolls, each with its gauge payload): the
// same session, roller, attempt, total and need. Lines from before the record, or rolls past the served log, find none.
export function recordOf(r, rolls, session) {
  if (!r.name || !Array.isArray(rolls)) return null;
  return rolls.findLast((e) => e.gauge && e.session === session && e.name === r.name && String(e.total) === r.total && String(e.line) === r.needed
    && (e.why === r.attempt || r.attempt.startsWith(`${e.why}, aimed at `))) ?? null;
}

// A recorded roll drawn roomy: the Margin gauge (gauge.js) as the chat's widget draws it, settled. The raw line is
// read aloud and the gauge leaves out its own summary, so nothing is said twice; its terms stay pointable (teller.js
// wires their tips).
function gaugeBlock(raw, d) {
  const r = resultOf(d, d.result.dice, d.result.frac ?? null, d.result.landed ?? null, d.result.push ?? 0);
  return `<div class="blk roll gauge"><span class="sr">${esc(raw)}</span>${gaugeHtml(d, r, { roomy: true, sr: false })}</div>`;
}

// The sentence on top (who, what, the outcome, where the eye lands), the proof beneath: the stat and the line, dice
// faces, the dropped die faded, the modifier, the total and what it needed. Only words the line holds; the raw line is
// read aloud.
function rollHtml(raw, r, nameOf) {
  const name = r.name || (r.id && nameOf(r.id));
  const lead = `${name ? `<b>${esc(name)}</b>${r.attempt ? ': ' : ''}` : ''}${esc(r.attempt)}`;
  const terms = [r.stat, r.line].filter(Boolean).join(' · ');
  const drops = r.drops ?? (r.dropped ? [r.dropped] : []);
  const dropped = drops.map((n) => `<span class="dropped"${tip('Not counted: a die set aside (advantage or disadvantage, or the better of his worn or spent you dice)')}>${die(n)}</span>`).join('');
  const proof = [r.mod, r.push ? `push +${r.push}` : '', `= ${r.total}`].filter(Boolean).join(' ') + `, needed ${r.needed}${r.mode ? `, ${r.mode}` : ''}${r.called ? `, called ${r.called}` : ''}`;
  return `<div class="blk roll"><span class="sr">${esc(raw)}</span><span class="rv" aria-hidden="true">`
    + `<span class="rlead">${lead}${lead ? ' → ' : ''}<span class="rband ${OUTCOME_CLASS[r.outcome.toLowerCase()] ?? ''}">${esc(r.outcome)}</span>${r.hurt ? `<span class="rsev">, ${esc(r.hurt)}</span>` : ''}${r.pushed ? `<span class="rsev">, pushed from ${esc(r.pushed)}</span>` : ''}</span>`
    + `<span class="rproof">${terms ? `<span class="rterms">${esc(terms)}</span>` : ''}<span class="dice">${r.kept.map(die).join('')}${dropped}</span><span class="sum">${esc(proof)}</span></span></span></div>`;
}

// ---- blocks: one turn's text, split by the grammar's forms

const FENCE = /^\s*(```|~~~)/;
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const LIST = /^\s*(?:[-*+]|\d+[.)])\s+/;
const SCRIPT = /^\*\*([^*]+)\*\*\s*[—–-]+\s*(.+)$/;
const SCREEN_RULE = /^\s*[─━—=-]{3,}\s*$/;
const startsBlock = (l) => FENCE.test(l) || /^\s*[|>]/.test(l) || RULE.test(l) || HEADING.test(l);

const cellsOf = (row) => row.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

function tableBlock(rows) {
  const cells = rows.map(cellsOf);
  if (cells.length < 2 || !cells[1].every((c) => /^:?-+:?$/.test(c))) return { kind: 'plain', lines: rows };
  const [head, , ...body] = cells;
  if (head.length === 1 && !head[0]) return { kind: 'paper', rows: body.map((r) => r.join(' | ')) };
  return { kind: 'table', head: head.every((c) => !c) ? null : head, rows: body };
}

// A screen's header is the line or few above its `─` rule (device, time, sender); without a rule it has none.
function screenBlock(lines) {
  const rule = lines.findIndex((l, k) => k >= 1 && k <= 3 && SCREEN_RULE.test(l));
  const head = rule > 0 ? lines.slice(0, rule).map((l) => l.trim()).join('\n') : '';
  const look = head || lines.find((l) => l.trim()) || '';
  const device = Object.keys(DEVICES).find((id) => DEVICES[id].held?.test(look)) ?? 'terminal';
  return { kind: 'screen', head, lines: rule > 0 ? lines.slice(rule + 1) : lines, device };
}

function quoteBlock(lines) {
  const q = lines.map((l) => l.replace(/^\s*>\s?/, ''));
  const open = /^\s*\*\*ooc\*\*:?\s*/i.exec(q[0]);
  if (!open) return { kind: 'plain', lines };
  return { kind: 'ooc', lines: [q[0].slice(open[0].length), ...q.slice(1)].filter((l) => l.trim()) };
}

function headingBlock(level, text, raw) {
  if (level === 3) {
    const [where, ...when] = text.split(/\s+·\s+/);
    const [place, ...sub] = where.split(/,\s*/);
    return { kind: 'slate', text, place, sub: sub.join(', '), time: when.join(' · ') };
  }
  if (level === 2 && /^session\b/i.test(text)) return { kind: 'session', text };
  return { kind: 'plain', lines: [raw] };
}

// A paragraph's lines: 🎲 lines, list lines (shown plainly: narration has no lists), runs of script lines, and runs
// of prose. A prose run of one line is a paragraph; of several, breath lines (the grammar writes prose one paragraph
// per line, so a multi-line paragraph is a breath run, md.7).
function paragraph(run) {
  const out = [];
  const kindOf = (l) => (l.trimStart().startsWith('🎲') ? 'roll' : LIST.test(l) ? 'list' : SCRIPT.test(l) ? 'script' : 'prose');
  for (let k = 0; k < run.length;) {
    const kind = kindOf(run[k]);
    if (kind === 'roll') { out.push({ kind: 'roll', raw: run[k].trim(), roll: rollOf(run[k]) }); k++; continue; }
    const group = [];
    while (k < run.length && kindOf(run[k]) === kind) group.push(run[k++]);
    if (kind === 'list') out.push({ kind: 'plain', lines: group });
    else if (kind === 'script') out.push({ kind: 'script', lines: group.map((l) => { const [, tag, said] = SCRIPT.exec(l); return { tag: tag.trim(), said: said.trim() }; }) });
    else out.push(group.length > 1 ? { kind: 'breath', lines: group } : { kind: 'prose', text: group[0] });
  }
  return out;
}

export function blocksOf(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  for (let i = 0; i < lines.length;) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    const fence = FENCE.exec(l);
    if (fence) {
      const body = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith(fence[1]); i++) body.push(lines[i]);
      i++;
      out.push(screenBlock(body));
      continue;
    }
    if (/^\s*[|>]/.test(l)) {
      const mark = l.trim()[0];
      const group = [];
      while (i < lines.length && lines[i].trim().startsWith(mark)) group.push(lines[i++]);
      out.push(mark === '|' ? tableBlock(group) : quoteBlock(group));
      continue;
    }
    if (RULE.test(l)) { out.push({ kind: 'rule' }); i++; continue; }
    const h = HEADING.exec(l);
    if (h) { out.push(headingBlock(h[1].length, h[2].trim(), l)); i++; continue; }
    const run = [];
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) run.push(lines[i++]);
    out.push(...paragraph(run));
  }
  return out;
}

// ---- a turn: its blocks, its closing line (html.9) and its readout (md.8)

const PROSE = new Set(['prose', 'breath']);
const BETWEEN = new Set(['prose', 'breath', 'script']);
// A screen's header without its numbers (times, counts), so the same instrument matches from turn to turn.
const shape = (head) => head.split('\n')[0].replace(/[\d:]+/g, '#').trim().toLowerCase();

// The closing line is the last prose block of the fiction (before `---` or the ooc note). The readout is the last
// screen before it with only prose or talk in between, when it sits right before the closing line and is not the held
// device's (a message, not an instrument), or when its header repeats a screen of the previous GM turn: the grammar
// shows an instrument "in the same shape every turn" (md.8), and a sequence may end its turn with a line or two after it.
export function parseTurn(text, previous = null) {
  const blocks = blocksOf(text);
  const end = blocks.findIndex((b) => b.kind === 'rule' || b.kind === 'ooc');
  const fiction = end < 0 ? blocks.length : end;
  let closing = -1;
  for (let k = fiction - 1; k >= 0; k--) if (PROSE.has(blocks[k].kind)) { closing = k; break; }
  let readout = -1;
  for (let k = closing - 1; k >= 0; k--) {
    const b = blocks[k];
    if (b.kind === 'screen') {
      const before = new Set((previous?.blocks ?? []).filter((x) => x.kind === 'screen' && x.head).map((x) => shape(x.head)));
      const repeats = b.head && before.has(shape(b.head));
      if (repeats || (k === closing - 1 && b.device === 'terminal')) readout = k;
      break;
    }
    if (!BETWEEN.has(b.kind)) break;
  }
  return { blocks, closing, readout };
}

// ---- turns as HTML: every block a top-level `.blk` the reader paces; a screen's lines are `.ln`, breath lines `.bl`

export function screenHtml(b, cls = '') {
  return `<figure class="blk scr ${b.device}${cls}">${b.head ? `<figcaption class="sh">${b.head.split('\n').map(esc).join('<br>')}</figcaption>` : ''}<pre>${b.lines.map((l) => `<span class="ln">${esc(l) || ' '}</span>`).join('')}</pre></figure>`;
}

// A cross-talk line by someone with a portrait is a bubble beside a small close-up of them.
function scriptHtml(b, cast, named, voice = null) {
  return `<div class="blk xt">${b.lines.map(({ tag, said }) => {
    const c = castFor(cast, tag);
    const dev = /^\*["“].*["”]\*$/.test(said);
    const words = dev ? said.slice(2, -2) : /^["“](.*)["”]$/.exec(said)?.[1] ?? said;
    const name = c ? (named.add(c.id), who(c, tag)) : esc(tag);
    const before = voice?.faces.length ?? 0;
    const line = `<span class="say${dev ? ' dev' : ''}"${inkStyle(c)}${lineAttrs(voice, c, words)}>${dev || said !== words ? `“${emph(words)}”` : emph(words)}</span>`;
    const face = voice && voice.faces.length > before ? voice.face(voice.faces[before], 'small') : null;
    const cell = face ? `<span class="xv" data-voiced>${faceHtml(face, 'small')}<span class="bubble">${line}</span></span>` : line;
    return `<span class="xtag">${name}</span>${cell}`;
  }).join('')}</div>`;
}

// A prose or breath block whose quotes include someone with a portrait: staged as a speech bubble beside their face
// (the first such speaker's), still until hovered. `inner` is the block's own element, its class list not yet marked.
function voiced(voice, before, inner) {
  const folder = voice?.faces[before];
  const face = folder && voice.face(folder, 'high');
  if (!face) return inner.replace(/^<(\w+) class="/, '<$1 class="blk ');
  return `<div class="blk voiced" data-voiced>${faceHtml(face, 'high')}${inner.replace(/^<(\w+) class="/, '<$1 class="bubble ')}</div>`;
}

function tableHtml(b) {
  const row = (cells, tag) => `<tr>${cells.map((c) => `<${tag}>${plainInline(c)}</${tag}>`).join('')}</tr>`;
  return `<div class="blk tbl"><table>${b.head ? `<thead>${row(b.head, 'th')}</thead>` : ''}<tbody>${b.rows.map((r) => row(r, 'td')).join('')}</tbody></table></div>`;
}

function blockHtml(b, k, parsed, ctx, named) {
  const close = k === parsed.closing ? ' close' : '';
  const v = ctx.voice;
  const before = v?.faces.length ?? 0;
  switch (b.kind) {
    case 'session': return `<div class="blk sess">${esc(b.text)}</div>`;
    case 'slate': return `<div class="blk slate" data-place="${esc(b.place)}" data-sub="${esc(b.sub)}" data-time="${esc(b.time)}"><span>${esc([b.place, b.sub].filter(Boolean).join(', '))}</span>${b.time ? `<span class="t">${esc(b.time)}</span>` : ''}</div>`;
    case 'prose': return voiced(v, before, `<p class="p${close}">${speech(b.text, ctx.cast, named, v)}</p>`);
    case 'breath': return voiced(v, before, `<p class="breath${close}">${b.lines.map((l) => `<span class="bl">${speech(l, ctx.cast, named, v)}</span>`).join('')}</p>`);
    case 'script': return scriptHtml(b, ctx.cast, named, v);
    case 'screen': return screenHtml(b, k === parsed.readout ? ' readout' : '');
    case 'paper': return `<div class="blk paper">${b.rows.map((r) => `<div>${plainInline(r) || ' '}</div>`).join('')}</div>`;
    case 'table': return tableHtml(b);
    case 'roll': {
      if (!b.roll) return `<p class="blk p">${esc(b.raw)}</p>`;
      const rec = recordOf(b.roll, ctx.rolls, ctx.session);
      return rec ? gaugeBlock(b.raw, rec.gauge) : rollHtml(b.raw, b.roll, ctx.nameOf);
    }
    case 'ooc': return `<aside class="blk ooc"><b>Out of game</b>${b.lines.map(plainInline).join('<br>')}</aside>`;
    case 'rule': return parsed.blocks[k + 1]?.kind === 'ooc' ? '' : '<hr class="blk rule">';
    default: return `<div class="blk plain">${b.lines.map(esc).join('<br>')}</div>`;
  }
}

// A widget the GM drew in the chat (html.13), before the turn's text, as the chat had it (the call comes before the
// text after it). A frame on its own address, which the server answers with the widget's document and its own CSP (a
// srcdoc or data: frame would inherit the pane's, which runs no inline script). Isolation comes from that CSP's
// `sandbox allow-scripts`, which gives the document no origin, so nothing in it reaches the pane; the attribute must
// also allow same-origin, because the app's browser pane refuses to load a frame sandboxed without it
// (ERR_BLOCKED_BY_CLIENT). teller.js sizes it from the number the frame posts.
// One too big to keep says so, with its size; the chat has it.
export function widgetHtml(w, turn, k) {
  const title = w.title || 'Widget';
  if (!w.v) return `<p class="blk widget-skipped">${esc(title)}: a widget too big to show here (${Math.ceil(w.bytes / 1024)} KB). It is in the chat.</p>`;
  return `<figure class="blk widget"><iframe sandbox="allow-scripts allow-same-origin" title="${esc(title)}" src="/widget/${Number(turn.session)}/${Number(turn.i)}/${k}?v=${esc(w.v)}"></iframe></figure>`;
}

// A bare slash command (`/play w`) is the player driving the app, not playing: not shown.
const isCommand = (text) => /^\/[\w:-]+(?:[ \t][^\n]*)?$/.test(text.trim());

// A turn's view: { html, parsed } (parsed for a GM turn), or null for a turn that shows nothing.
// ctx: { cast (castOf), nameOf (id -> name), you (the player's character's name), face (folder, level -> a portrait the
// pane can show, or null; optional), rolls (the served log's rolls, for a 🎲 line's gauge; optional) }; `previous`:
// the last GM turn's parsed. turn.tones: the GM's tones (html.12).
export function turnView(turn, ctx, previous = null) {
  if (turn.who === 'player') {
    if (!turn.text.trim() || isCommand(turn.text)) return null;
    return { html: `<p class="blk yours"><b>${esc(ctx.you || 'You')}</b><span>${turn.text.trim().split('\n').map(esc).join('<br>')}</span></p>`, parsed: null };
  }
  const parsed = parseTurn(turn.text, previous);
  const widgets = (turn.widgets ?? []).map((w, k) => widgetHtml(w, turn, k)).join('');
  if (!parsed.blocks.length && !widgets) return null;
  const named = new Set();
  // A turn that draws a dice widget (a result tt showed with --show) already pictures its roll: its 🎲 line stays a line.
  const drawsDice = (turn.widgets ?? []).some((w) => /^dice/i.test(w.title ?? ''));
  const voiceCtx = { ...ctx, voice: voiceOf(turn, ctx), session: turn.session, rolls: drawsDice ? [] : ctx.rolls };
  const html = widgets + parsed.blocks.map((b, k) => blockHtml(b, k, parsed, voiceCtx, named)).join('')
    + (parsed.closing >= 0 ? '<p class="blk reply">Your reply goes in the chat.</p>' : '');
  return { html, parsed };
}

// The last slate a turn cuts to, or null.
export const slateOf = (parsed) => parsed?.blocks.filter((b) => b.kind === 'slate').pop() ?? null;
