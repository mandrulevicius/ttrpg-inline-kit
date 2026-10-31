// The Margin gauge (docs/designs/dice/system-v2.md §1, §7, §9; critique.md "Margin, to exquisite"): a roll drawn as a
// load test on a dark instrument screen. The bar is what the roller brings, the line what the moment demands, and the
// margin, how far past it he held or how far short he fell, is the brightest thing on it. Shared by the chat's dice
// widget (kit/dice.js) and the pane's Story column (story.js), so a roll reads one way in both. Staging is pure (no
// DOM) and works from the payload `tt roll` prints (src/roll.mjs widgetData); only fitZones() touches a page.
//
// Mechanics are drawn, words are flavour (ui-principles): the line, the strain meter, which die counts and what each
// term adds are pictures; each term's reason and its rule sit one level down, behind the tips (tips.js) that read
// data-term (a key of glossary.js), data-why (the reason, in words) and data-hl (the cells it made, data-k).
import { icon, keepSvg, TERMS } from './glossary.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---- the rules the picture needs, as tt settles them (src/dice.mjs); test/kit-dice.test.mjs holds them together

// Bands by margin (core.5), each with its word, a short form for a narrow screen, and its key for colour.
export const BANDS = [
  { key: 'disaster', tt: 'disaster', word: 'Disaster', zone: 'disaster', short: 'disaster', min: -Infinity, max: -5 },
  { key: 'failure', tt: 'failure', word: 'Failure', zone: 'failure', short: 'fail', min: -4, max: -3 },
  { key: 'near', tt: 'near miss', word: 'Near miss', zone: 'near miss', short: 'near', min: -2, max: -1 },
  { key: 'cost', tt: 'success at a cost', word: 'Success at a cost', zone: 'at a cost', short: 'cost', min: 0, max: 1 },
  { key: 'solid', tt: 'solid', word: 'Solid success', zone: 'solid', short: 'solid', min: 2, max: 4 },
  { key: 'exceptional', tt: 'exceptional', word: 'Exceptional', zone: 'exceptional', short: 'best', min: 5, max: Infinity },
];
// Past the line on a called shot, the margin is severity (core.6): 0–1 graze, 2–3 wound, 4 maimed, 5+ destroyed.
export const SEVERITY = [
  { key: 'graze', word: 'grazed', zone: 'graze', short: 'graze', min: 0, max: 1 },
  { key: 'wound', word: 'wounded', zone: 'wound', short: 'wound', min: 2, max: 3 },
  { key: 'maimed', word: 'maimed', zone: 'maimed', short: 'maim', min: 4, max: 4 },
  { key: 'destroyed', word: 'destroyed', zone: 'destroyed', short: 'lost', min: 5, max: Infinity },
];
const MISS = { key: 'miss', word: 'Missed', zone: 'miss', short: 'miss', min: -Infinity, max: -1 };
// Short of the line on a defence roll, the shortfall is how he's hurt (core.6): −1 to −2 graze, −3 to −4 wound, −5 maimed.
export const SHORTFALL = [
  { key: 'maimed', word: 'maimed', zone: 'maimed', short: 'maim', min: -Infinity, max: -5, band: 'disaster' },
  { key: 'wound', word: 'wounded', zone: 'wound', short: 'wound', min: -4, max: -3, band: 'failure' },
  { key: 'graze', word: 'grazed', zone: 'graze', short: 'graze', min: -2, max: -1, band: 'near miss' },
];
export const bandOf = (m) => BANDS.find((b) => m >= b.min && m <= b.max);
export const severityOf = (m) => SEVERITY.find((s) => m >= s.min && m <= s.max);
const shortfallOf = (m) => SHORTFALL.find((s) => m >= s.min && m <= s.max);
const HURTS = [...SEVERITY, ...SHORTFALL];
// An attack: a called shot, an uncalled hit at a location, or one at a named target. A defence roll is never one.
export const attackOf = (d) => !d.defend && Boolean(d.called || d.hit || d.target);
// Whose body a hurt lands on is his (the loss palette): his defence that fell short, or someone's attack on him.
const onHim = (d) => Boolean(d.target?.pc || (d.defend && d.pc !== false));

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const word = (n) => WORDS[n] ?? String(n);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const GLYPH = ['', '¼', '½', '¾'];
// "+2½", "−¼", "+3"; zero as `zero`. A true minus: this is read, not typed.
export function quarters(n, zero = '0') {
  if (!n) return zero;
  const a = Math.abs(n);
  const whole = Math.floor(a);
  const q = Math.round((a - whole) * 4);
  return `${n < 0 ? '−' : '+'}${whole || !q ? whole : ''}${GLYPH[q]}`;
}
const statText = (s) => `${s.name} ${s.n < 0 ? `−${-s.n}` : `+${s.n}`}`;

// The dice that count: the worst you die (strain will throw more than one), and the better or worse moment die. On a
// tie the later die is set aside, so help that changed nothing reads as nothing.
export function keep(d, faces) {
  const you = faces.slice(0, d.you);
  const moment = faces.slice(d.you);
  const youAt = you.indexOf(Math.min(...you));
  const pick = d.moment.dice > 1 ? (d.moment.keep === 'worse' ? Math.min(...moment) : Math.max(...moment)) : moment[0];
  const momentAt = d.you + moment.indexOf(pick);
  return { kept: [faces[youAt], faces[momentAt]], counted: new Set([youAt, momentAt]) };
}

// A throw, settled as tt settles it: the kept dice plus the net modifier against the whole line, its quarter landing
// when the draw (0..99) is under the fraction, then his push. `landed` given (an old record) wins over the draw.
export function resultOf(d, faces, frac = null, landed = null, push = 0) {
  const { kept, counted } = keep(d, faces);
  const whole = Math.floor(d.mod);
  const f = d.mod - whole;
  const q = f ? (landed ?? (Number.isInteger(frac) ? frac < Math.round(f * 100) : null)) : null;
  const mod = whole + (q ? 1 : 0);
  const total = kept[0] + kept[1] + mod + push;
  const margin = total - d.needed;
  const band = bandOf(margin);
  const severity = attackOf(d) && margin >= 0 ? severityOf(margin) : d.defend && margin < 0 ? shortfallOf(margin) : null;
  return { faces, kept, counted, frac, landed: f ? Boolean(q) : null, mod, total, margin, band, severity, push, from: push ? bandOf(margin - push) : null };
}

// ---- the picture's geometry

// Everything the gauge draws before and after the throw. Cell k is the bar reaching k. What he brings fills first (the
// stat, then his gear and preparation); anything that makes the moment heavier (the world's load, a called shot's aim,
// his own negatives) pushes the line right as hatched load, so the bar never runs backwards. The line's fraction moves
// to the bar's side, as tt does, and rides at the bar's end as the quarter's chance: E is the line that counts, `whole`
// the bar's rated whole cells (below zero when a fraction left him a cell in debt), `q` the chance cell.
export function geometry(d) {
  const stat = d.stat ?? null;
  const pos = [];
  if (stat && stat.n > 0) pos.push({ role: 'stat', n: stat.n, why: statText(stat), k: 'stat' });
  d.bar.forEach((t, i) => { if (t.n > 0) pos.push({ role: 'mod', n: t.n, why: t.why, kind: t.kind, k: `b${i}` }); });
  const P = pos.reduce((a, p) => a + p.n, 0);
  // load: the world's first, then his own negatives (a wound, a negative stat), each with whose it is
  const load = [
    ...d.load.map((t) => ({ n: t.n, why: t.why, kind: t.kind ?? 'world', mine: false })),
    ...(stat && stat.n < 0 ? [{ n: -stat.n, why: statText(stat), kind: 'stat', mine: true }] : []),
    ...d.bar.filter((t) => t.n < 0).map((t) => ({ n: -t.n, why: t.why, kind: t.kind, mine: true })),
  ];
  const base = d.line.n;
  const Lfull = base + load.reduce((a, t) => a + t.n, 0);
  const E = Math.floor(Lfull);
  const Pbar = P - (Lfull - E);
  const whole = Math.floor(Pbar);
  const q = Pbar - whole;
  // room past the best throw for a push (+4) on a roll that offers one or was pushed
  const N = Math.max(E + 7, whole + 13 + (q ? 1 : 0) + (d.push?.length || d.result?.push ? 4 : 0), 12);
  return { pos, P, load, base, Lfull, E, Pbar, whole, q, N };
}

// The zone a bar ending in cell k lands in: a band, a severity past the line on a called shot, or, when the shot is
// at him, "miss" for every shortfall (the shooter's bands are not his).
function zoneAt(d, g, k) {
  return zoneOf(d, k - g.E);
}
export function zoneOf(d, m) {
  if (d.target?.pc && m < 0) return MISS;
  if (attackOf(d) && m >= 0) return severityOf(m);
  if (d.defend && m < 0) return shortfallOf(m);
  return bandOf(m);
}
// Past the top zone (exceptional, or destroyed on an attack), every 2 more margin is an extra (v2 §6).
export const extrasOf = (m) => (m >= 5 ? Math.floor((m - 5) / 2) : 0);

// The colour key of a zone: bands by name; a called shot's severity in the shooter's success colours, or in the loss
// palette when it lands on him (critique.md, "the defending state").
export const toneOf = (d, m) => tone(d, zoneOf(d, m));
// A zone's glossary key: a wound on the body is not the wound a bar term names.
const zoneTerm = (z) => (z.key === 'wound' ? 'hurt-wound' : z.key);
function tone(d, z) {
  if (z === MISS) return 'clear';
  if (!HURTS.includes(z)) return z.key;
  if (onHim(d)) return `hurt-${z.key}`;
  // someone else hurt: his attack landing, or their defence failing, in his success colours
  return { graze: 'cost', wound: 'solid', maimed: 'solid', destroyed: 'exceptional' }[z.key];
}

// The band word as the headline, and how good or bad in words. A called hit names the location and the hurt; on him,
// a miss is his.
export function verdict(d, r) {
  const m = r.margin;
  const where = m > 0 ? `${word(m)} past the line` : m === 0 ? 'right on the line' : `${word(-m)} short of the line`;
  const pushed = r.push ? ` · pushed +${r.push} from ${fromText(zoneOf(d, m - r.push))}` : '';
  if (attackOf(d) && m >= 0) {
    const up = SEVERITY[SEVERITY.indexOf(r.severity) + 1];
    const next = up && up.min - m <= 2 ? ` · ${word(up.min - m)} ${d.target?.pc ? 'from' : 'short of'} ${up.key === 'wound' ? 'a wound' : up.key}` : '';
    return { head: hurtHead(d, r.severity), sub: where + next + pushed, tone: tone(d, r.severity) };
  }
  if (d.target?.pc) return { head: 'Missed', sub: where, tone: 'clear' };
  if (d.defend && m < 0) {
    // how far from the next lesser hurt, or from avoiding it
    const down = SHORTFALL[SHORTFALL.indexOf(r.severity) + 1];
    const to = down ? down.min - m : -m;
    const next = to <= 2 ? ` · ${word(to)} from ${down ? (down.key === 'graze' ? 'a graze' : `a ${down.key}`) : 'avoiding it'}` : '';
    return { head: hurtHead(d, r.severity), sub: where + next + pushed, tone: tone(d, r.severity) };
  }
  const up = BANDS[BANDS.indexOf(r.band) + 1];
  const next = m >= 0 && up && up.min - m <= 2 ? ` · ${word(up.min - m)} short of ${up.zone}` : '';
  return { head: r.band.word, sub: (d.defend ? 'avoided · ' : '') + where + next + pushed, tone: r.band.key };
}

// What a push lifted him from, as the 🎲 line names it (src/dice.mjs pushedFrom).
const fromText = (z) => (HURTS.includes(z) ? { graze: 'a graze', wound: 'a wound', maimed: 'maimed', destroyed: 'destroyed' }[z.key] : z === MISS ? 'a miss' : z.word.toLowerCase());

// "Left arm wounded" where the blow lands; "Teo wounded" on a target with no location yet; "Wounded" on him.
function hurtHead(d, s) {
  const where = d.called ?? d.hit;
  if (where) return `${cap(bareLocation(where))} ${s.word}`;
  if (!onHim(d) && d.target?.name) return `${d.target.name} ${s.word}`;
  return cap(s.word);
}

// What a push to margin `m` buys, in a few words, for the widget's offer: the zone it reaches, and past the top one,
// its extras.
export function buysText(d, m) {
  const { head, extras } = buysParts(d, m);
  return head + (extras ? ` + ${extras === 1 ? 'an extra' : `${word(extras)} extras`}` : '');
}
// The same, apart: the zone's words, how many extras (the offer draws them as stars), and the zone's colour key.
export function buysParts(d, m) {
  const z = zoneOf(d, m);
  const extras = !d.defend || m >= 0 ? extrasOf(m) : 0;
  const head = HURTS.includes(z) ? hurtHead(d, z) : d.defend ? `Avoided${z.key === 'cost' ? ', at a cost' : z.key === 'solid' ? ' cleanly' : ''}` : z.word;
  return { head, extras, tone: tone(d, z) };
}

// ---- the body a called shot aims at (rules/core.md: head, torso, arms, legs)

const PARTS = ['head', 'torso', 'left arm', 'right arm', 'left leg', 'right leg'];
const ALIAS = { chest: 'torso', gut: 'torso', belly: 'torso', back: 'torso', body: 'torso', face: 'head', eyes: 'head', jaw: 'head', 'left hand': 'left arm', 'right hand': 'right arm', 'left foot': 'left leg', 'right foot': 'right leg', 'left shoulder': 'left arm', 'right shoulder': 'right arm', 'left knee': 'left leg', 'right knee': 'right leg' };
const bareLocation = (where) => String(where).trim().replace(/^(the|a|an|his|her|its|their|my|your|our)\s+/i, '');
export function partOf(where) {
  const w = bareLocation(where).toLowerCase();
  return PARTS.includes(w) ? w : ALIAS[w] ?? null;
}

// A person's outline, six locations. His own body is seen from behind (his left is on the left, as he'd feel it); a
// target he aims at faces him, so its left arm is on the right.
const OUTLINE = {
  head: ['circle', 'cx="24" cy="9" r="7"'],
  torso: ['path', 'd="M15 19h18l2 4-1 21H14l-1-21z"'],
  left: { arm: ['path', 'd="M13 21l-6 3-3 20 4 1 5-17z"'], leg: ['path', 'd="M14 46h9l-1 30h-6z"'] },
  right: { arm: ['path', 'd="M35 21l6 3 3 20-4 1-5-17z"'], leg: ['path', 'd="M25 46h9l-2 30h-6z"'] },
};
function bodySvg(d, r) {
  const part = partOf(d.called ?? d.hit ?? '');
  if (!part) return '';
  const mine = onHim(d);
  const shapeOf = (p) => {
    if (!p.includes(' ')) return OUTLINE[p];
    const [side, limb] = p.split(' ');
    return OUTLINE[mine === (side === 'left') ? 'left' : 'right'][limb]; // facing him, the target's left is on the right
  };
  const state = r ? (r.severity ? `hit tone-${tone(d, r.severity)}` : 'missed') : 'aim';
  const body = PARTS.map((p) => {
    const [tag, attrs] = shapeOf(p);
    return `<${tag} ${attrs} class="loc${p === part ? ` ${state}` : ''}" data-part="${p}"/>`;
  }).join('');
  const label = mine ? `your ${part}` : `${d.target?.name ? `${d.target.name}: ` : ''}${part}`;
  return `<figure class="tg-body${mine ? ' mine' : ''}" aria-hidden="true"><svg viewBox="0 0 48 78">${body}</svg><figcaption>${esc(label)}</figcaption></figure>`;
}

// ---- staging

const PIPS = { 1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [3, 1], [1, 3], [3, 3]], 5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], 6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]] };
export const dieFace = (n) => `<rect x="1" y="1" width="24" height="24" rx="5"/>${(PIPS[n] ?? []).map(([x, y]) => `<circle cx="${x * 6.5}" cy="${y * 6.5}" r="2.3"/>`).join('')}`;

// Who each die is: the you die (the roller on the day; his is "you", an NPC's carries their name), then the moment,
// and luck's second try named by its source.
export function dieRoles(d) {
  const roller = d.pc === false ? shortName(d.who) : 'you';
  // worn or spent, his dice carry his state: he throws two or three, and the worst counts
  const state = d.condition && d.condition.state !== 'steady' ? d.condition.state : '';
  const out = [];
  for (let i = 0; i < d.you; i++) out.push({ role: 'you', caption: i ? `${state || roller}, again` : state ? `${roller} · ${state}` : roller });
  for (let i = 0; i < d.moment.dice; i++) out.push({ role: i ? 'luck' : 'moment', caption: i ? `${d.moment.keep === 'worse' ? '−' : '+'} ${d.moment.why || 'the moment, again'}` : 'the moment' });
  return out;
}
// "Teo" for "Teo Rask" or "Teo, a cadet"; "the raider" whole.
const shortName = (name) => (/^(the|a|an)\s/i.test(name) ? name : String(name).split(/[\s,]+/)[0]);

/// A tip target's attributes (tips.js): its glossary key, its reason in words, the cells it made.
const tipAttrs = (key, why = '', hl = '') => ` data-term="${key}"${why ? ` data-why="${esc(why)}"` : ''}${hl ? ` data-hl="${hl}"` : ''}`;
// A focusable one: a button whose label says in words what the picture shows.
const tipButton = (cls, key, label, inner, why = '', hl = '') => `<button type="button" class="tg-tb ${cls}"${tipAttrs(key, why, hl)} aria-label="${esc(label)}">${inner}</button>`;

// The line's flag: its icon and its rung (or the person); the rung's number, its reason and the load on it one level
// down. A person's line has no number before the throw.
function lineFlag(d, g, thrown) {
  const load = g.Lfull - g.base;
  const net = load ? `; ${quarters(load)} load` : '';
  if (d.line.vs) return { key: 'person', text: d.line.vs, why: `${d.line.vs}${thrown ? ` ${d.line.n}${net}` : ''}` };
  const rung = d.line.rung ?? 'line';
  return { key: 'line', text: rung, why: `${rung} ${d.line.n}${d.line.why ? `: ${d.line.why}` : ''}${net}` };
}

// A term's size drawn as the gauge draws it: a cell per whole point and a part-cell for a fraction, filled when it adds
// to his bar, hatched when it loads the line (his own hurts in his colour), dotted when the world is in his favour.
function miniCells(n, cls) {
  const a = Math.abs(n);
  const whole = Math.floor(a);
  const f = a - whole;
  return `<span class="mc ${cls}">${'<i></i>'.repeat(whole)}${f ? `<i class="p" style="--f:${f}"></i>` : ''}</span>`;
}

// What bears on the roll, each where it lives: his side (gear, preparation, expertise, his hurts), then the line's load.
// Each is its kind's icon and its size in cells; its reason is one level down. Luck's second die and his condition are
// drawn on the dice, the line's rung on its flag.
function terms(d) {
  const mine = d.bar.map((t, i) => {
    const key = ['expert', 'gear', 'prep', 'wound'].includes(t.kind) ? t.kind : t.n < 0 ? 'wound' : 'prep';
    const cls = t.n < 0 ? 'mine-load' : 'mine';
    const size = quarters(t.n);
    return tipButton(`tg-t ${cls}`, key, `${TERMS[key].name} ${size}: ${t.why}`, icon(TERMS[key].icon) + miniCells(t.n, cls), `${size} ${t.why}`, t.n < 0 ? 'lm' : `b${i}`);
  });
  const world = d.load.map((t) => {
    const key = t.kind === 'called' ? 'called' : 'load';
    const cls = t.n < 0 ? 'relief' : 'load';
    const size = quarters(t.n);
    return tipButton(`tg-t ${cls}`, key, `${t.n < 0 ? 'the world in your favour' : TERMS[key].name} ${size}: ${t.why}`, icon(TERMS[key].icon) + miniCells(t.n, cls), `${size} ${t.why}`, 'lw');
  });
  if (!mine.length && !world.length) return '';
  return `<div class="tg-terms">${mine.length ? `<span class="tg-tgrp">${mine.join('')}</span>` : ''}${world.length ? `<span class="tg-tgrp line">${world.join('')}</span>` : ''}</div>`;
}

// His strain (system-v2 §6), drawn: his face for his state (alert, heavy-lidded, gone), six cells, and under them each
// zone marked by the you dice it throws (one, two, three). A push on offer previews in outline; a push he made fills in
// its own colour; each point past the end is a mark.
const STRAIN_MAX = 6;
const STRAIN_ZONES = [{ state: 'steady', from: 1, to: 2, dice: 1 }, { state: 'worn', from: 3, to: 5, dice: 2 }, { state: 'spent', from: 6, to: 6, dice: 3 }];
const strainState = (n) => (n >= 6 ? 'spent' : n >= 3 ? 'worn' : 'steady');
const diceGlyph = (n) => `<svg viewBox="0 0 ${n * 6 - 1} 5" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<rect x="${i * 6}" width="5" height="5" rx="1"/>`).join('')}</svg>`;
// The push he made: its strain after and its marks, from the offer's costs or, for a roll tt recorded, the result's.
function strainMade(d, r) {
  if (!r?.push || !d.condition) return null;
  const cost = d.push?.find((p) => p.n === r.push)?.cost ?? d.result?.pushCost;
  if (!Number.isInteger(cost)) return null;
  const total = d.condition.n + cost;
  return { after: Math.min(STRAIN_MAX, total), marks: Math.max(0, total - STRAIN_MAX) };
}
function strainHtml(d, r, preview) {
  const c = d.condition;
  if (!c || d.pc === false || !Number.isFinite(c.n)) return '';
  const now = Math.max(0, Math.min(STRAIN_MAX, c.n));
  const made = strainMade(d, r);
  const next = made ?? (preview && Number.isInteger(preview.after) ? { after: preview.after, marks: preview.marks ?? 0, ghost: true } : null);
  const to = next ? next.after : now;
  const state = strainState(to);
  const cells = Array.from({ length: STRAIN_MAX }, (_, j) => {
    const k = j + 1;
    const cls = [k <= now ? 'f' : k <= to ? (next.ghost ? 'g' : 'p') : '', STRAIN_ZONES.some((z) => z.from === k && k > 1) ? 'z' : ''].filter(Boolean).join(' ');
    return `<i${cls ? ` class="${cls}"` : ''}></i>`;
  }).join('');
  const marks = next?.marks ? `<span class="tg-marks${next.ghost ? ' g' : ''}">${icon('mark').repeat(next.marks)}</span>` : '';
  const zones = STRAIN_ZONES.map((z) => `<span${z.state === state ? ' class="on"' : ''} style="grid-column:${z.from}/${z.to + 1}">${diceGlyph(z.dice)}</span>`).join('');
  const marked = (n) => (n ? `, and ${n === 1 ? 'a mark' : `${n} marks`}` : '');
  const label = `Strain ${now} of ${STRAIN_MAX}, ${strainState(now)}${c.why ? ` (${c.why})` : ''}`
    + (next ? `; ${next.ghost ? 'this push would make it' : 'the push made it'} ${to}, ${state}${marked(next.marks)}` : '');
  return tipButton(`tg-strain${next ? (next.ghost ? ' ghosting' : ' pushed') : ''}${state !== strainState(now) ? ' turns' : ''}`, 'strain', label,
    `${icon(state, 'face')}<span class="tg-meter"><span class="tg-mc">${cells}</span><span class="tg-mz">${zones}</span></span>${marks}`, c.why ?? '');
}

// The dice in their groups: his you dice (with his strain beside them, which sets how many), then the moment's. Under
// each group its rule: whose they are and, when there are more than one, which counts, drawn from dice (keepSvg: the
// one that counts plain, the rest dim and struck). Thrown, the dice that count stand lit and the ones set aside lie dim, tipped and struck.
function diceHtml(d, r, roles, strain) {
  const thrown = Boolean(r);
  const order = thrown ? [...r.counted].sort((a, b) => a - b) : [];
  const die = (i) => {
    const x = roles[i];
    const n = thrown ? r.faces[i] : 0;
    const counted = thrown ? r.counted.has(i) : true;
    // each die points at its own cells on the bar; luck's second die names its source
    const luck = x.role === 'luck' ? tipAttrs(d.moment.keep === 'worse' ? 'dis' : 'adv', d.moment.why, `d${i}`) : tipAttrs(x.role, '', `d${i}`);
    return `<figure class="tg-die ${x.role}${thrown ? (counted ? ' kept' : ' dropped') : ''}${n ? '' : ' blank'}"${thrown && counted ? ` style="--i:${order.indexOf(i)}"` : ''}${luck}>`
      + `<svg viewBox="0 0 26 26" role="img" aria-label="${esc(`${x.caption}: ${n || 'not thrown'}${thrown && !counted ? ', set aside' : ''}`)}">${dieFace(n)}</svg></figure>`;
  };
  const idx = (pick) => roles.map((_, i) => i).filter((i) => pick(roles[i]));
  const npc = d.pc === false ? shortName(d.who) : '';
  const who = npc ? `<span class="nm">${esc(npc)}</span>` : icon('you');
  const state = d.condition?.state && d.condition.state !== 'steady' ? d.condition.state : 'worn';
  const youRule = d.you > 1
    ? tipButton('tg-rule many', state, `${d.you} you dice, the lowest counts`, `${who}${keepSvg(d.you, true)}`, d.condition?.why ?? '')
    : tipButton('tg-rule', 'you', npc ? `${npc}'s die` : 'the you die', who);
  const keep = d.moment.keep === 'worse' ? 'dis' : 'adv';
  const momentRule = d.moment.dice > 1
    ? tipButton('tg-rule many', keep, `two moment dice, the ${keep === 'dis' ? 'lower' : 'higher'} counts${d.moment.why ? `: ${d.moment.why}` : ''}`, `${icon('moment')}${keepSvg(2, keep === 'dis')}`, d.moment.why ?? '')
    : tipButton('tg-rule', 'moment', 'the moment die', icon('moment'));
  return `<div class="tg-dice">${strain}<div class="tg-grp you"><div class="tg-row">${idx((x) => x.role === 'you').map(die).join('')}</div>${youRule}</div>`
    + `<div class="tg-grp moment"><div class="tg-row">${idx((x) => x.role !== 'you').map(die).join('')}</div>${momentRule}</div></div>`;
}

// The sum, as the 🎲 line has it (one level down, in the verdict's tip): the kept dice, the net modifier (its quarter's
// rounding once thrown), the total, the line.
export function proofText(d, r) {
  const dice = r.kept.map((n) => `[${n}]`).join(' ');
  const mod = r.landed === null ? (d.mod ? ` ${quarters(d.mod)}` : '') : ` ${quarters(d.mod)}→${quarters(r.mod, '0')}`;
  return `${dice}${mod}${r.push ? ` push +${r.push}` : ''} = ${r.total}, line ${d.needed}`;
}

// The summary a screen reader gets in place of the picture.
function spoken(d, g, r) {
  const brings = [d.stat ? statText(d.stat) : '', ...d.bar.map((t) => `${quarters(t.n)} ${t.why}`)].filter(Boolean).join(', ');
  const against = [d.line.vs ? d.line.vs : `${d.line.rung ?? 'line'} ${d.line.n}${d.line.why ? `, ${d.line.why}` : ''}`, ...d.load.map((t) => `${quarters(t.n)} ${t.why}`)].join(', ');
  const head = `${d.who}: ${d.what}. ${brings ? `${brings}, against ` : 'Against '}${against}.`;
  if (!r) return `${head} Forecast: ${d.forecast?.word ?? 'unknown'}.`;
  const v = verdict(d, r);
  return `${head} ${v.head}: the bar stops ${v.sub}. Dice: ${dieRoles(d).map((x, i) => `${x.caption} ${r.faces[i]}${r.counted.has(i) ? '' : ' (set aside)'}`).join(', ')}.`;
}

// The gauge's HTML. `r` is the throw's result (resultOf), or null before it. opts:
//   anim: 'pour' (dice pour into the bar, the line ticks, the word rises last) | 'push' (only his push arrives) | 'none'
//   roomy: the pane's Story column
//   act: the foot's right side (the widget's button, offer or status)
//   ghost: a push on offer ({ n, after, marks }, or its n), previewed as outlined cells past the bar's end, the zone
//     they reach, and the strain it would leave (the offer's hover, focus or first tap)
//   sr: false leaves out the summary for screen readers (the pane's Story column reads the roll line instead)
export function gaugeHtml(d, r = null, { anim = 'none', roomy = false, act = '', ghost = 0, sr = true } = {}) {
  const preview = typeof ghost === 'number' ? { n: ghost } : ghost ?? { n: 0 };
  const g = geometry(d);
  const thrown = Boolean(r);
  const roles = dieRoles(d);
  const N = g.N;
  const cells = Array.from({ length: N + 1 }, () => ({ cls: [], i: null, k: [] }));
  const put = (k, cls, i = null) => { if (k >= 1 && k <= N) { cells[k].cls.push(cls); if (i !== null) cells[k].i = i; } };
  const key = (k, id) => { if (k >= 1 && k <= N) cells[k].k.push(id); }; // which term made the cell (a term's tip lights them)

  // rated cells: the stat, then his gear and preparation
  for (let k = 1; k <= g.whole; k++) {
    let at = 0;
    const piece = g.pos.find((p) => { at += p.n; return k - 0.5 < at; });
    if (piece) { put(k, piece.role); key(k, piece.k); }
  }
  // after the throw: the kept dice pour in, you then the moment, and the quarter's chance rides at the end
  let end = g.whole;
  let order = 0;
  let cross = null;
  if (thrown) {
    for (const i of [...r.counted].sort((a, b) => a - b)) {
      for (let k = 1; k <= r.faces[i]; k++) {
        const c = end + k;
        if (cross === null && c >= g.E) cross = order;
        put(c, `${roles[i].role} pour`, order++);
        key(c, `d${i}`); // the die that poured it (its tip lights them)
      }
      end += r.faces[i];
    }
  }
  let qcell = null;
  if (g.q) {
    qcell = end + 1;
    put(qcell, thrown ? (r.landed ? 'q in' : 'q out') : 'q', thrown ? order : null);
    for (const p of g.pos) if (p.n % 1) key(qcell, p.k); // a fraction he brought rides here as its chance
    if (thrown && r.landed) { end += 1; if (cross === null && end >= g.E) cross = order; }
  }
  // his push: past the dice and the quarter, in its own colour, so what he bought reads apart from what he brought
  if (thrown && r.push) {
    for (let k = 1; k <= r.push; k++) {
      put(end + k, 'push', order++);
      if (cross === null && end + k >= g.E) cross = order - 1;
    }
    end += r.push;
  }
  const total = end; // the gauge's bar end; its margin is tt's (resultOf), checked in the tests
  if (thrown && preview.n) for (let k = 1; k <= preview.n; k++) put(total + k, 'ghost');
  // load between the nominal line and the one that counts: the world's net (hatched, or dotted relief when it's in his
  // favour), then his own negatives (hatched in his colour). Each term is in the terms row, whose tips light these cells.
  const W = g.load.filter((t) => !t.mine).reduce((a, t) => a + t.n, 0);
  const M = g.load.filter((t) => t.mine).reduce((a, t) => a + t.n, 0);
  const loadSpans = [];
  if (W) loadSpans.push({ a: Math.min(g.base, g.base + W), b: Math.max(g.base, g.base + W), cls: W < 0 ? 'relief' : 'ld', k: 'lw' });
  if (M) loadSpans.push({ a: g.base + W, b: g.base + W + M, cls: 'ld mine', k: 'lm' });
  for (const s of loadSpans) {
    for (let k = 1; k <= N; k++) if (k - 0.5 > s.a && k - 0.5 < s.b) { put(k, s.cls); key(k, s.k); }
  }
  // the line's own cell, the gate, just left of the line: the bar fills it flush to make the line exactly
  if (!(d.line.vs && !thrown)) put(g.E, 'gate'); // a person's line has no exact place before the throw
  // the margin: past the line lit in the band's colour, the shortfall a full-height hatch, the end bracketed
  if (thrown) {
    for (let k = 1; k <= N; k++) {
      if (k === g.E && total >= g.E) put(k, 'rim');
      else if (k > g.E && k <= total) put(k, 'head');
      else if (k > total && k <= g.E) put(k, 'short');
    }
    if (total >= 1) put(Math.min(total, N), 'end');
  }

  // zones along the track
  const zones = [];
  for (let k = 1; k <= N; k++) {
    const z = zoneAt(d, g, k);
    const last = zones.at(-1);
    if (last && last.z === z) last.n++;
    else zones.push({ z, from: k, n: 1 });
  }
  const lit = thrown ? zoneAt(d, g, Math.max(1, total)) : null;
  // before the throw, the zone just past the line is the one in focus (a narrow screen names it and its neighbours)
  const focusAt = zones.findIndex((z) => (lit ? z.z === lit : z.from + z.n - 1 >= g.E));
  const span = (from, n) => `grid-column:${from}/span ${n}`; // in a row of cells (a subgrid of the cell columns)
  const across = (from, n) => `grid-column:${from + 1}/span ${n}`; // straight on the gauge, past the stat cap's column
  const fuzzy = !thrown && Boolean(d.line.vs);

  // the forecast's shape: each band's chance spread over its zone's cells, a word above it (never a number)
  const fb = d.forecast?.bands ?? null;
  const chance = (z) => {
    if (!fb) return 0;
    if (SEVERITY.includes(z) || z === MISS) return 0;
    return fb[z.tt ?? z.band] ?? 0; // a defence's shortfall is the band it stands for
  };
  let shape = '';
  if (fb) {
    const dens = zones.map((z) => {
      if (SEVERITY.includes(z.z)) return null;
      if (z.z === MISS) return null;
      return chance(z.z) / z.n;
    });
    // a called shot spreads its success over the severities, which the forecast holds as at-a-cost and up
    const hit = (['success at a cost', 'solid', 'exceptional']).reduce((a, b) => a + (fb[b] ?? 0), 0);
    const sev = zones.filter((z) => SEVERITY.includes(z.z));
    const sevCells = sev.reduce((a, z) => a + z.n, 0);
    const missCells = zones.filter((z) => z.z === MISS).reduce((a, z) => a + z.n, 0);
    const miss = (['near miss', 'failure', 'disaster']).reduce((a, b) => a + (fb[b] ?? 0), 0);
    zones.forEach((z, j) => {
      if (SEVERITY.includes(z.z)) dens[j] = sevCells ? hit / sevCells : 0;
      if (z.z === MISS) dens[j] = missCells ? miss / missCells : 0;
    });
    const top = Math.max(...dens, 0.0001);
    shape = zones.map((z, j) => `<i class="tone-${tone(d, z.z)}" style="${span(z.from, z.n)};--h:${Math.max(dens[j] / top, dens[j] > 0 ? 0.06 : 0).toFixed(3)}"></i>`).join('')
      + (thrown && total >= 1 ? `<b class="land tone-${verdict(d, r).tone}" style="${span(Math.min(total, N), 1)}"></b>` : '');
  }

  const flag = lineFlag(d, g, thrown);
  const flagRight = g.E / N > (flag.text.length > 14 ? 0.4 : 0.6);
  const capHtml = d.stat
    ? tipButton('tg-cap', 'stat', `${statText(d.stat)}, your stat`, `<b>${esc(d.stat.name)}</b><span>${esc(d.stat.n < 0 ? `−${-d.stat.n}` : `+${d.stat.n}`)} ▸</span>`, statText(d.stat), 'stat')
    : '<div class="tg-cap"><b>roll</b><span>▸</span></div>';
  const cellHtml = cells.slice(1).map((c, j) => `<i class="${c.cls.join(' ')}"${c.k.length ? ` data-k="${c.k.join(' ')}"` : ''}${c.i !== null ? ` style="--i:${c.i}"` : ''}`
    + `${j + 1 === qcell ? tipAttrs('quarter', `the ${quarters(g.q).slice(1)}: lands as one more ${Math.round(g.q * 100)} times in 100`) : ''}></i>`).join('');
  const ghostZone = thrown && preview.n ? zoneAt(d, g, Math.max(1, total + preview.n)) : null;
  const zoneRow = zones.map((z, j) => {
    const near = focusAt >= 0 && Math.abs(j - focusAt) <= 1;
    const cls = [`tone-${tone(d, z.z)}`, z.z === lit ? 'on' : '', z.z === ghostZone && z.z !== lit ? 'ghost' : '', j === focusAt ? 'focus' : near ? 'nb' : 'far', HURTS.includes(z.z) || !attackOf(d) || d.target?.pc ? '' : 'miss'].filter(Boolean).join(' ');
    return `<div class="${cls}" style="${span(z.from, z.n)}"${tipAttrs(zoneTerm(z.z))}><span class="lg">${esc(z.z.zone)}</span><span class="sm">${esc(z.z.short)}</span></div>`;
  }).join('');
  const lineAt = `--at:${g.E}`;
  const lineHtml = fuzzy
    ? `<div class="tg-line fuzzy" style="${across(Math.max(1, g.E - 1), Math.min(4, N - Math.max(1, g.E - 1) + 1))}"></div>`
    : `<div class="tg-line${cross !== null && anim === 'pour' ? ' tick' : ''}" style="${lineAt}${cross !== null ? `;--x:${cross}` : ''}"></div>${g.Lfull !== g.base && !d.line.vs ? `<div class="tg-line nominal" style="--at:${g.base}"></div>` : ''}`;

  const gauge = `<div class="tg-gauge" style="--n:${N}">
<div class="tg-flag${flagRight ? ' r' : ''}" style="--at:${g.E}">${tipButton('tg-fl', flag.key, `the line: ${flag.why}`, `${icon(TERMS[flag.key].icon)}<span>${esc(flag.text)}</span>`, flag.why, 'lw')}</div>
${fb ? `<div class="tg-shape${thrown ? ' hollow' : ''}" aria-hidden="true">${shape}</div>` : ''}
${capHtml}<div class="tg-cells" aria-hidden="true">${cellHtml}</div>
<div class="tg-zones${fuzzy ? ' fuzzy' : ''}" aria-hidden="true">${zoneRow}</div>
${lineHtml}
</div>`;

  // readout: before the throw, his read of the odds in a word; after it, the outcome. How far past or short, and the
  // sum, are one level down (the gauge draws them).
  let readout = '';
  const body = d.called || d.hit ? bodySvg(d, r) : '';
  if (!thrown) {
    if (d.forecast?.word) readout = tipButton('tg-sol', 'forecast', `your read: ${d.forecast.word}`, `${icon('forecast')}<b>${esc(d.forecast.word)}</b>`);
  } else {
    const v = verdict(d, r);
    const sum = `${proofText(d, r)}${r.landed === null ? '' : ` (the ${quarters(d.mod - Math.floor(d.mod)).slice(1)} ${r.landed ? 'came in' : 'stayed out'})`}`;
    readout = tipButton(`tg-verdict tone-${v.tone}`, zoneTerm(zoneOf(d, r.margin)), `${v.head}: ${v.sub}`, `<span class="tg-band">${esc(v.head)}</span>`, `${v.sub}. ${sum}`);
  }

  const bandKey = thrown ? verdict(d, r).tone : '';
  const steps = order + (g.q ? 1 : 0);
  return `<div class="tg${roomy ? ' roomy' : ''}${anim === 'pour' && thrown ? ' pour' : ''}${anim === 'push' && thrown ? ' pushing' : ''}${onHim(d) ? ' defend' : ''}" data-phase="${thrown ? 'result' : 'before'}" data-line="${g.E}"${thrown ? ` data-end="${total}"` : ''}${bandKey ? ` data-tone="${bandKey}"` : ''} style="--steps:${steps}">
${sr ? `<p class="tg-sr">${esc(spoken(d, g, r))}</p>` : ''}
<div class="tg-head" aria-hidden="true"><span class="tg-who">${esc(d.who)}</span><span class="tg-what">${esc(d.what)}</span></div>
<div class="tg-read"><div class="tg-readl">${readout}</div>${body}</div>
${terms(d)}
${gauge}
<div class="tg-foot">${diceHtml(d, r, roles, strainHtml(d, r, preview))}<div class="tg-act">${act}</div></div>
</div>`;
}

// Every zone keeps its name at any width. When a word is wider than its zone, the names stagger on two rows, so each
// may spread over its neighbours, which sit on the other row; each is nudged inside the gauge's ends. Two names on a
// row that still meet: the one farther from the zone in focus takes its short form, then gives way (a word is left out
// rather than cut). The lit zone is always named. Run after layout, and again on resize.
export function fitZones(root) {
  const row = root.querySelector('.tg-zones');
  if (!row) return;
  const zones = [...row.children];
  row.classList.remove('stagger');
  for (const z of zones) {
    z.classList.remove('use-sm', 'hide');
    for (const s of z.children) s.style.translate = '';
  }
  const label = (z) => z.querySelector(z.classList.contains('use-sm') ? '.sm' : '.lg');
  const width = (el) => el.getBoundingClientRect().width;
  if (!zones.some((z) => width(label(z)) > width(z) + 1)) return;
  row.classList.add('stagger');
  const ends = row.getBoundingClientRect();
  const keepIn = (z) => {
    const s = label(z);
    s.style.translate = '';
    const r = s.getBoundingClientRect();
    const dx = r.left < ends.left ? ends.left - r.left : r.right > ends.right ? ends.right - r.right : 0;
    if (dx) s.style.translate = `${dx}px 0`;
  };
  zones.forEach(keepIn);
  const focus = Math.max(0, zones.findIndex((z) => z.classList.contains('on') || z.classList.contains('focus')));
  const meet = (a, b) => !a.classList.contains('hide') && !b.classList.contains('hide') && label(a).getBoundingClientRect().right + 4 > label(b).getBoundingClientRect().left;
  for (let j = 2; j < zones.length; j++) {
    const [a, b] = [zones[j - 2], zones[j]];
    if (!meet(a, b)) continue;
    const far = b.classList.contains('on') || (!a.classList.contains('on') && Math.abs(j - 2 - focus) > Math.abs(j - focus)) ? a : b;
    far.classList.add('use-sm');
    keepIn(far);
    if (meet(a, b)) far.classList.add('hide');
  }
}

// ---- the look: a dark instrument screen in both chat themes, set in a bezel that follows the chat's own surface. The
// display faces (Oxanium, JetBrains Mono) are loaded by the chat widget; the pane, whose CSP loads nothing remote, falls
// back to its system faces.

export const GAUGE_CSS = `
.tg{--glass:#0c1218;--glass2:#111a23;--edge:#22303f;--ink:#dbe3ec;--dim:#9aa9ba;--faint:#7d8fa3;--cell:#16202b;--cell-edge:#1f2c3a;
--stat:#4aa8e0;--mod:#7cc3ec;--you:#eadfc4;--you-cell:#c9a66b;--moment:#8193a8;--moment-cell:#8796a6;--luck:#b89cff;--quarter:#f0c76a;--push:#ff6fb0;
--disaster:#ff5a5f;--failure:#f4805c;--near:#f2a446;--cost:#e0c95a;--solid:#4fd8a8;--exceptional:#9cf0ff;--clear:#7fb4d6;
--hurt-graze:#f2b354;--hurt-wound:#f47a4e;--hurt-maimed:#ff4d57;--hurt-destroyed:#ff2f7a;
--tone:var(--dim);--disp:Oxanium,'Bahnschrift','DIN Alternate','Segoe UI',system-ui,sans-serif;--mono:'JetBrains Mono',ui-monospace,Consolas,monospace;
container-type:inline-size;position:relative;box-sizing:border-box;background:var(--glass);color:var(--ink);
border:4px solid color-mix(in srgb,var(--text-primary,#888) 12%,var(--surface-1,#2a2a27));border-radius:14px;padding:12px 16px 12px;font:14px/1.45 var(--font-sans,system-ui,sans-serif);
box-shadow:inset 0 0 0 1px var(--edge),inset 0 1px 0 rgba(255,255,255,.04)}
.tg *{box-sizing:border-box}
.tg .tone-disaster{--tone:var(--disaster)}.tg .tone-failure{--tone:var(--failure)}.tg .tone-near{--tone:var(--near)}.tg .tone-cost{--tone:var(--cost)}
.tg .tone-solid{--tone:var(--solid)}.tg .tone-exceptional{--tone:var(--exceptional)}.tg .tone-clear{--tone:var(--clear)}
.tg .tone-hurt-graze{--tone:var(--hurt-graze)}.tg .tone-hurt-wound{--tone:var(--hurt-wound)}.tg .tone-hurt-maimed{--tone:var(--hurt-maimed)}.tg .tone-hurt-destroyed{--tone:var(--hurt-destroyed)}
.tg[data-tone=disaster]{--band:var(--disaster)}.tg[data-tone=failure]{--band:var(--failure)}.tg[data-tone=near]{--band:var(--near)}.tg[data-tone=cost]{--band:var(--cost)}
.tg[data-tone=solid]{--band:var(--solid)}.tg[data-tone=exceptional]{--band:var(--exceptional)}.tg[data-tone=clear]{--band:var(--clear)}
.tg[data-tone=hurt-graze]{--band:var(--hurt-graze)}.tg[data-tone=hurt-wound]{--band:var(--hurt-wound)}.tg[data-tone=hurt-maimed]{--band:var(--hurt-maimed)}.tg[data-tone=hurt-destroyed]{--band:var(--hurt-destroyed)}
.tg-tb{all:unset;box-sizing:border-box;cursor:help;-webkit-tap-highlight-color:transparent}
.tg-tb:focus-visible{outline:2px solid var(--stat);outline-offset:2px;border-radius:4px}
.tg .ti{display:block;flex:none;width:14px;height:14px}
.tg [data-term]{cursor:help}
.tg-sr{position:absolute;width:1px;height:1px;margin:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}

.tg-head{display:flex;align-items:baseline;gap:4px 10px;flex-wrap:wrap}
.tg-who{font:600 11px/1.2 var(--disp);letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.tg-what{flex:1 1 50%;min-width:0;font-size:15px;color:var(--ink)}

.tg-read{display:flex;align-items:flex-end;gap:8px 16px;margin:10px 0 4px;min-height:34px}
.tg-readl{flex:1;min-width:0;display:flex;align-items:flex-end;flex-wrap:wrap;gap:6px 18px}
.tg-sol{display:flex;align-items:center;gap:8px;color:var(--ink)}
.tg-sol .ti{width:18px;height:18px;color:var(--dim)}
.tg-sol b{display:block;font:600 22px/1.1 var(--disp);letter-spacing:.01em}.tg-sol b::first-letter{text-transform:uppercase}
.tg-verdict{--tone:var(--band);display:block}
.tg-band{font:700 28px/1.05 var(--disp);color:var(--tone);letter-spacing:.005em;text-shadow:0 0 14px color-mix(in srgb,var(--tone) 45%,transparent)}

.tg-body{margin:0;display:flex;flex-direction:column;align-items:center;gap:2px;flex:none}
.tg-body svg{width:34px;height:56px;overflow:visible}
.tg-body .loc{fill:var(--cell);stroke:var(--faint);stroke-width:1}
.tg-body .aim{fill:none;stroke:var(--ink);stroke-width:1.4;stroke-dasharray:2 2}
.tg-body .hit{fill:var(--tone);stroke:var(--tone);filter:drop-shadow(0 0 4px var(--tone))}
.tg-body .missed{fill:none;stroke:var(--clear);stroke-dasharray:1.5 2}
.tg-body figcaption{font-size:11px;color:var(--dim);white-space:nowrap}
.tg.defend .tg-body svg{width:40px;height:66px}


.tg-terms{display:flex;flex-wrap:wrap;gap:6px 12px;margin:6px 0 0}
.tg-tgrp{display:flex;flex-wrap:wrap;gap:6px}
.tg-tgrp.line{padding-left:12px;border-left:1px solid var(--edge)}
.tg-t{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 8px;border:1px solid var(--edge);border-radius:5px;color:var(--dim)}
.tg-t:hover,.tg-t:focus-visible{border-color:color-mix(in srgb,var(--ink) 45%,var(--edge));color:var(--ink)}
.tg-t.mine,.tg-t.mine-load{color:var(--mod)}
.mc{display:inline-flex;gap:2px}
.mc i{display:block;width:7px;height:12px;border-radius:1.5px;background-repeat:no-repeat}
.mc.mine i{background-image:linear-gradient(color-mix(in srgb,var(--mod) 75%,var(--cell)),color-mix(in srgb,var(--mod) 75%,var(--cell)))}
.mc.load i,.mc.mine-load i{background-image:repeating-linear-gradient(135deg,currentColor 0 1.5px,transparent 1.5px 4px);box-shadow:inset 0 0 0 1px currentColor}
.mc.relief i{outline:1px dotted currentColor;outline-offset:-1px}
.mc i.p{background-size:calc(var(--f) * 100%) 100%;box-shadow:inset 0 0 0 1px color-mix(in srgb,currentColor 60%,transparent)}

/* the gauge: one grid, the stat cap in its own column, then a column per cell */
.tg-gauge{position:relative;margin:14px 0 2px;display:grid;grid-template-columns:auto repeat(var(--n),minmax(0,1fr));column-gap:2px}
.tg-gauge>*{grid-column:2/-1}
.tg-flag{position:relative;height:18px;grid-row:1}
.tg-flag .tg-fl{position:absolute;bottom:3px;left:calc(var(--at) * (100% + 2px) / var(--n) - 2px);display:flex;align-items:center;gap:5px;white-space:nowrap;font:600 11px/1 var(--disp);letter-spacing:.1em;text-transform:uppercase;color:var(--ink);padding:0 5px 0 3px}
.tg-flag .tg-fl .ti{width:13px;height:13px}
.tg-flag.r .tg-fl{transform:translateX(-100%);padding:0 3px 0 5px}
.tg-shape{grid-row:2;display:grid;grid-template-columns:subgrid;height:24px;align-items:end}
.tg-shape i{height:calc(var(--h) * 100%);background:color-mix(in srgb,var(--tone) 30%,transparent);border-top:2px solid var(--tone);transition:background .4s,border-color .4s,opacity .4s}
.tg-shape.hollow i{background:transparent;border-top-color:color-mix(in srgb,var(--tone) 45%,transparent);border-left:1px solid color-mix(in srgb,var(--tone) 18%,transparent);border-right:1px solid color-mix(in srgb,var(--tone) 18%,transparent)}
.tg-shape .land{grid-row:1;align-self:stretch;background:var(--tone);box-shadow:0 0 10px var(--tone);border-radius:1px}
.tg-cap{grid-column:1;grid-row:3;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;padding-right:6px;line-height:1;font-family:var(--disp);color:var(--stat);white-space:nowrap}
.tg-cap b{font-weight:700;font-size:11px;letter-spacing:.14em;text-transform:uppercase}
.tg-cap span{font-weight:600;font-size:13px;letter-spacing:.04em;margin-top:2px}
.tg-cells{grid-row:3;display:grid;grid-template-columns:subgrid;height:26px}
.tg-cells i{position:relative;display:block;background:var(--cell);border:1px solid var(--cell-edge);border-radius:2px}
.tg-cells i.stat{background:color-mix(in srgb,var(--stat) 62%,var(--cell));border-color:transparent}
.tg-cells i.mod{background:color-mix(in srgb,var(--mod) 46%,var(--cell));border-color:transparent}
.tg-cells i.you{background:color-mix(in srgb,var(--you-cell) 62%,var(--cell));border-color:transparent}
.tg-cells i.moment,.tg-cells i.luck{background:color-mix(in srgb,var(--moment-cell) 72%,var(--cell));border-color:transparent}
.tg-cells i.q{background:linear-gradient(90deg,color-mix(in srgb,var(--quarter) 55%,var(--cell)) 0 50%,var(--cell) 50%);border:1px dashed color-mix(in srgb,var(--quarter) 70%,transparent)}
.tg-cells i.q.in{background:color-mix(in srgb,var(--quarter) 70%,var(--cell));border:1px solid transparent}
.tg-cells i.q.out{background:var(--cell);border:1px dashed color-mix(in srgb,var(--quarter) 40%,transparent);outline:1.5px dashed color-mix(in srgb,var(--quarter) 75%,transparent);outline-offset:-2px}
.tg-cells i.push{background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--push) 75%,var(--cell)) 0 3px,color-mix(in srgb,var(--push) 52%,var(--cell)) 3px 5px);border-color:transparent;box-shadow:inset 0 0 0 1px var(--push)}
.tg-cells i.ld::after,.tg-cells i.short::after,.tg-cells i.relief::after{content:"";position:absolute;inset:0;border-radius:1px}
.tg-cells i.ld::after{background:repeating-linear-gradient(135deg,rgba(219,227,236,.24) 0 2px,transparent 2px 6px)}
.tg-cells i.ld.mine::after{background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--mod) 45%,transparent) 0 2px,transparent 2px 6px)}
.tg-cells i.relief{border:1px dotted var(--faint)}
.tg-cells i.gate{border-color:color-mix(in srgb,var(--ink) 55%,transparent)}
.tg-cells i.rim{background:color-mix(in srgb,var(--band) 55%,var(--cell));border-color:color-mix(in srgb,var(--ink) 55%,transparent)}
.tg-cells i.head{background:var(--band);border-color:transparent;box-shadow:0 0 8px color-mix(in srgb,var(--band) 50%,transparent)}
.tg-cells i.push.head,.tg-cells i.push.rim{background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--push) 80%,var(--cell)) 0 3px,color-mix(in srgb,var(--push) 55%,var(--cell)) 3px 5px);box-shadow:inset 0 0 0 1px var(--band),0 0 8px color-mix(in srgb,var(--band) 50%,transparent)}
.tg-cells i.short{background:var(--cell);border-color:color-mix(in srgb,var(--band) 55%,transparent)}
.tg-cells i.short::after{background:repeating-linear-gradient(135deg,var(--band) 0 2px,transparent 2px 5px);opacity:.75}
.tg-cells i.ghost{background:color-mix(in srgb,var(--push) 30%,var(--cell));border:1px dashed var(--push);box-shadow:0 0 6px color-mix(in srgb,var(--push) 40%,transparent)}
.tg-cells i.ghost::after{opacity:.2}
.tg-cells i.hl{box-shadow:0 0 0 2px var(--ink);z-index:2}
.tg-cells i.end::before{content:"";position:absolute;inset:-6px -5px;z-index:2;pointer-events:none;--c:var(--band);
background:linear-gradient(var(--c),var(--c)) 0 0/7px 2px,linear-gradient(var(--c),var(--c)) 0 0/2px 7px,linear-gradient(var(--c),var(--c)) 100% 0/7px 2px,linear-gradient(var(--c),var(--c)) 100% 0/2px 7px,
linear-gradient(var(--c),var(--c)) 0 100%/7px 2px,linear-gradient(var(--c),var(--c)) 0 100%/2px 7px,linear-gradient(var(--c),var(--c)) 100% 100%/7px 2px,linear-gradient(var(--c),var(--c)) 100% 100%/2px 7px;background-repeat:no-repeat;filter:drop-shadow(0 0 3px var(--c))}
.tg-zones{grid-row:5;display:grid;grid-template-columns:subgrid;margin-top:5px}
.tg-zones div{position:relative;display:flex;justify-content:center;border-top:3px solid color-mix(in srgb,var(--tone) 50%,transparent);padding:3px 1px 0;font-size:11px;line-height:1.2;color:var(--dim);white-space:nowrap;min-width:0;overflow:hidden}
.tg-zones span{flex:none}
.tg-zones.stagger div{overflow:visible}.tg-zones.stagger div:nth-child(even){padding-top:17px}

.tg-zones .sm{display:none}.tg-zones .use-sm .lg{display:none}.tg-zones .use-sm .sm{display:inline}.tg-zones .hide span{visibility:hidden}
.tg-zones div.on{border-top-color:var(--tone);color:var(--tone);font-weight:600;z-index:1;overflow:visible}
.tg-zones .miss{border-top-style:dotted}
.tg-zones div.ghost{border-top:3px dashed var(--push);color:var(--push);z-index:1;overflow:visible}.tg-zones div.ghost span{visibility:visible}
.tg[data-phase=result] .tg-zones div:not(.on){color:var(--faint)}
.tg-zones.fuzzy div{border-top-color:transparent;background:linear-gradient(color-mix(in srgb,var(--tone) 40%,transparent),color-mix(in srgb,var(--tone) 40%,transparent)) top/100% 3px no-repeat;filter:blur(.4px)}
.tg-line{grid-column:2/-1;grid-row:2/4;align-self:stretch;width:0;margin-left:calc(var(--at) * (100% + 2px) / var(--n) - 2px);border-left:2px solid var(--ink);pointer-events:none;z-index:3;box-shadow:0 0 6px rgba(219,227,236,.35)}
.tg-line.nominal{border-left:1px dashed var(--faint);box-shadow:none;z-index:2}
.tg-line.fuzzy{margin-left:0;border:0;width:auto;background:linear-gradient(90deg,transparent,rgba(219,227,236,.22) 35%,rgba(219,227,236,.32) 50%,rgba(219,227,236,.22) 65%,transparent);box-shadow:none}

.tg-foot{display:flex;align-items:center;gap:10px 16px;flex-wrap:wrap;margin-top:12px;padding-top:10px;border-top:1px solid var(--edge)}
.tg-dice{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:flex-start}
.tg-grp{display:flex;flex-direction:column;align-items:center;gap:6px}
.tg-row{display:flex;gap:8px}
.tg-rule{position:relative;display:flex;align-items:center;justify-content:center;gap:3px;min-height:16px;align-self:stretch;color:var(--dim)}
.tg-grp.you .tg-rule{color:var(--you)}.tg-grp.moment .tg-rule{color:var(--moment)}
.tg-rule.many{border-top:1.5px solid currentColor;padding-top:3px;margin-top:2px}
.tg-rule.many::before,.tg-rule.many::after{content:"";position:absolute;top:-5px;width:1.5px;height:5px;background:currentColor}
.tg-rule.many::before{left:0}.tg-rule.many::after{right:0}
.tg-rule .keep{display:block;height:12px;width:auto;margin-left:3px}
.tg-rule .nm{font:600 11px/1 var(--disp);letter-spacing:.12em;text-transform:uppercase}
.tg-strain{display:flex;align-items:center;gap:7px;color:var(--you);align-self:center}
.tg-strain .face{width:26px;height:26px}
.tg-strain.ghosting.turns .face{color:var(--push)}
.tg-meter{display:flex;flex-direction:column;gap:3px}
.tg-mc,.tg-mz{display:grid;grid-template-columns:9px 9px 12px 9px 9px 12px;column-gap:2px}
.tg-mc i{height:14px;border-radius:2px;background:var(--cell);border:1px solid var(--cell-edge)}
.tg-mc i.z{margin-left:3px}
.tg-mc i.f{background:color-mix(in srgb,var(--you-cell) 80%,var(--cell));border-color:transparent}
.tg-mc i.p{background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--push) 75%,var(--cell)) 0 3px,color-mix(in srgb,var(--push) 52%,var(--cell)) 3px 5px);border-color:transparent}
.tg-mc i.g{background:color-mix(in srgb,var(--push) 28%,var(--cell));border:1px dashed var(--push)}
.tg-mz span{display:flex;justify-content:center;color:var(--faint)}
.tg-mz span.on{color:var(--you)}
.tg-strain.ghosting.turns .tg-mz span.on{color:var(--push)}
.tg-mz svg{display:block;height:5px;width:auto;fill:currentColor}
.tg-marks{display:flex;flex-wrap:wrap;max-width:66px;gap:1px;color:var(--near)}.tg-marks .ti{width:12px;height:12px}
.tg-marks.g{color:var(--push)}
.tg-die{position:relative;margin:0;display:flex;transition:opacity .3s}
.tg-die svg{width:36px;height:36px;overflow:visible}
.tg-die rect{fill:var(--cell);stroke:var(--faint);stroke-width:1}
.tg-die circle{fill:var(--glass)}
.tg-die.you rect{fill:var(--you);stroke:none}
.tg-die.moment rect,.tg-die.luck rect{fill:var(--moment);stroke:none}
.tg-die.luck rect{fill:color-mix(in srgb,var(--luck) 70%,var(--moment))}
.tg-die.blank rect{fill:transparent;stroke:var(--faint);stroke-dasharray:3 2}
.tg-die.you.blank rect{stroke:var(--you)}.tg-die.moment.blank rect{stroke:var(--moment)}.tg-die.luck.blank rect{stroke:var(--luck)}
.tg-die.dropped svg{opacity:.4;transform:translateY(5px) rotate(-12deg)}
.tg-die.dropped::after{content:"";position:absolute;left:-3px;right:-3px;top:58%;height:2px;border-radius:1px;background:var(--dim);transform:rotate(-38deg)}
.tg-die.kept svg{transform:translateY(-2px);filter:drop-shadow(0 2px 5px rgba(0,0,0,.5))}
.tg-die.tumble svg{animation:tg-tumble .24s linear infinite}
.tg-act{margin-left:auto;display:flex;align-items:center;gap:10px}
.tg-throw{font:700 12px/1 var(--disp);letter-spacing:.18em;text-transform:uppercase;color:var(--glass);background:var(--ink);border:0;border-radius:6px;padding:11px 18px;cursor:pointer;box-shadow:0 0 0 1px var(--ink),0 0 14px rgba(219,227,236,.18)}
.tg-throw small{display:block;margin-top:4px;font:500 11px/1 var(--mono);letter-spacing:.02em;text-transform:none;opacity:.7}
.tg-throw:hover{background:#fff}
.tg-throw:focus-visible{outline:2px solid var(--stat);outline-offset:3px}
.tg-throw[disabled]{opacity:.5;cursor:default}
.tg-status{font-size:12.5px;color:var(--dim);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.tg-status.ok::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--solid);box-shadow:0 0 6px var(--solid)}
.tg-status.bad{color:var(--near)}
.tg-status code{font:12px var(--mono);color:var(--ink);background:var(--cell);padding:2px 6px;border-radius:3px;user-select:all;overflow-wrap:anywhere}
.tg-act:has(.tg-send),.tg-act:has(.tg-offer){flex-basis:100%;margin-left:0}
.tg-offer{display:flex;flex-wrap:wrap;gap:8px;align-items:stretch;width:100%}
.tg-offer button{font:inherit;text-align:left;cursor:pointer;border-radius:6px;padding:7px 12px;line-height:1.25;min-width:0}
.tg-offer .tg-take{font:700 12px/1 var(--disp);letter-spacing:.16em;text-transform:uppercase;color:var(--glass);background:var(--ink);border:0;padding:10px 16px}
.tg-offer .tg-push{background:none;color:var(--ink);border:1px solid color-mix(in srgb,var(--push) 55%,var(--edge))}
.tg-offer .tg-push:hover,.tg-offer .tg-push:focus-visible{background:color-mix(in srgb,var(--push) 12%,transparent);border-color:var(--push)}
.tg-offer .tg-take{display:flex;align-items:center;gap:7px}.tg-offer .tg-take .ti{width:14px;height:14px}
.tg-push .gain{display:flex;flex-wrap:wrap;align-items:center;gap:2px 6px}
.tg-push .gain .ti{color:var(--push)}
.tg-push .gain b{font:700 15px/1 var(--disp);color:var(--push);margin-right:4px}
.tg-push .to{font-size:13.5px;color:var(--tone);display:flex;align-items:center;gap:3px}.tg-push .to .ti{color:var(--tone);width:11px;height:11px}
.tg-push .to .xs{display:flex;gap:1px;margin-left:3px}
.tg-push .cost{display:flex;align-items:center;gap:5px;margin-top:5px;font:600 12px/1 var(--mono);color:var(--you)}
.tg-push .cost .mk{display:flex;align-items:center;gap:3px;margin-left:6px;color:var(--near)}
.tg-push .again{display:none;margin-top:5px;font-size:11px;color:var(--push)}.tg-push.armed{border-color:var(--push);background:color-mix(in srgb,var(--push) 14%,transparent)}.tg-push.armed .again{display:block}
.tg-offer button:focus-visible{outline:2px solid var(--stat);outline-offset:2px}
.tg-send{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px}.tg-send code{display:block;margin:4px 0 6px;line-height:1.45}
.tg-send.bad>span{flex-basis:100%}.tg-send details{font-size:12px;color:var(--faint)}.tg-send details[open]{flex-basis:100%}.tg-send summary{cursor:pointer;color:var(--dim)}.tg-send summary:focus-visible{outline:2px solid var(--stat);outline-offset:2px}
.tg-status button{font:inherit;font-size:11px;background:none;border:1px solid var(--edge);border-radius:4px;color:var(--dim);padding:2px 8px;cursor:pointer}

/* the tips (tips.js): a line on hover, focus or tap; a popout on click; both inside the box, which the chat's frame clips */
.tg-tip,.tg-pop{position:absolute;z-index:30;box-sizing:border-box;width:max-content;background:#1a2531;color:var(--ink);border:1px solid #33475c;border-radius:6px;box-shadow:0 8px 22px rgba(0,0,0,.5);font:12.5px/1.4 var(--font-sans,system-ui,sans-serif);text-align:left;letter-spacing:normal;text-transform:none}
.tg-tip{padding:6px 9px;pointer-events:none;animation:tg-fade .12s both}
.tg-tip-h{display:flex;gap:6px;align-items:flex-start}.tg-tip-h .ti{margin-top:2px;color:var(--dim)}
.tg-tip-l{display:block;margin-top:2px;color:var(--dim)}
.tg-tip-more{display:block;margin-top:3px;font-size:11px;color:var(--faint)}
.tg-pop{padding:9px 12px 10px}
.tg-pop-h{display:flex;align-items:center;gap:7px}.tg-pop-h b{font:600 13px/1.2 var(--disp);letter-spacing:.04em;flex:1}
.tg-pop-x{all:unset;cursor:pointer;color:var(--dim);font-size:16px;line-height:1;padding:0 3px;border-radius:3px}.tg-pop-x:focus-visible{outline:2px solid var(--stat)}
.tg-pop p{margin:6px 0 0;color:var(--dim)}.tg-pop .tg-pop-why{color:var(--ink)}
.tg-term{display:inline-flex;align-items:center;gap:3px;color:var(--ink);border-bottom:1px dotted var(--faint);cursor:help}.tg-term .ti{width:12px;height:12px}
.tg-term:focus-visible{outline:2px solid var(--stat);outline-offset:1px}

/* the arrival: dice pour into the bar, the line ticks when crossed, the margin locks on, the band word rises last */
.tg.pour .tg-cells i.pour{animation:tg-fill .16s both;animation-delay:calc(var(--i) * 45ms + 120ms)}
.tg.pour .tg-cells i.q.in,.tg.pour .tg-cells i.q.out{animation:tg-q .45s both;animation-delay:calc(var(--i) * 45ms + 220ms)}
.tg.pour .tg-line.tick{animation:tg-tick .5s both;animation-delay:calc(var(--x) * 45ms + 160ms)}
.tg.pour .tg-cells i.head,.tg.pour .tg-cells i.rim,.tg.pour .tg-cells i.short::after{animation:tg-lock .35s both;animation-delay:calc(var(--steps) * 45ms + 380ms)}
.tg.pour .tg-cells i.end::before{animation:tg-bracket .45s cubic-bezier(.2,.8,.3,1.2) both;animation-delay:calc(var(--steps) * 45ms + 420ms)}
.tg.pour .tg-shape .land{animation:tg-fade .4s both;animation-delay:calc(var(--steps) * 45ms + 420ms)}
.tg.pour .tg-verdict,.tg.pour .tg-body .hit{animation:tg-rise .5s both;animation-delay:calc(var(--steps) * 45ms + 560ms)}
.tg.pour .tg-die.kept svg{animation:tg-pulse .5s both;animation-delay:calc(var(--i) * 300ms + 60ms)}
.tg.pour .tg-cells i.push{animation:tg-fill .16s both;animation-delay:calc(var(--i) * 45ms + 120ms)}
.tg.pushing .tg-cells i.push{animation:tg-fill .3s both}.tg.pushing .tg-verdict,.tg.pushing .tg-body .hit{animation:tg-rise .45s both .2s}
.tg.pushing .tg-cells i.head,.tg.pushing .tg-cells i.rim{animation:tg-lock .35s both .15s}
@keyframes tg-fill{from{opacity:0;transform:scaleY(.2)}to{opacity:1;transform:none}}
@keyframes tg-q{0%,40%,70%{opacity:.25}20%,55%,100%{opacity:1}}
@keyframes tg-tick{0%{box-shadow:0 0 0 rgba(219,227,236,0)}30%{box-shadow:0 0 14px 3px rgba(219,227,236,.8);border-left-color:#fff}100%{box-shadow:0 0 6px rgba(219,227,236,.35)}}
@keyframes tg-lock{from{opacity:.15;filter:brightness(2)}to{opacity:1;filter:none}}
@keyframes tg-bracket{from{opacity:0;transform:scale(1.8)}to{opacity:1;transform:none}}
@keyframes tg-fade{from{opacity:0}to{opacity:1}}
@keyframes tg-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes tg-pulse{0%{filter:none}35%{filter:drop-shadow(0 0 6px rgba(233,225,203,.8))}100%{filter:none}}
@keyframes tg-tumble{0%{transform:rotate(0) translateY(0)}25%{transform:rotate(16deg) translateY(-4px)}50%{transform:rotate(0) translateY(0)}75%{transform:rotate(-14deg) translateY(-2px)}100%{transform:rotate(0)}}
@media (prefers-reduced-motion:reduce){.tg *,.tg *::before,.tg *::after{animation:none!important;transition:none!important}}

/* the pane's Story column: roomier */
.tg.roomy{padding:14px 20px 14px}
.tg.roomy .tg-cells{height:30px}.tg.roomy .tg-shape{height:34px}

/* a narrow screen: the zone in focus and its neighbours only; the button full width */
@container (max-width:480px){
  .tg{padding:10px 12px}
  .tg-band{font-size:24px}.tg-sol b{font-size:19px}
  .tg-gauge{column-gap:1px}
  .tg-line{margin-left:calc(var(--at) * (100% + 1px) / var(--n) - 1.5px)}
  .tg-flag span{left:calc(var(--at) * (100% + 1px) / var(--n) - 1.5px)}
  .tg-act{margin-left:0;width:100%}
  .tg-throw{flex:1}
  .tg-offer .tg-take{flex:1 1 100%}.tg-offer .tg-push{flex:1 1 40%}
  .tg-dice{gap:12px 14px}.tg-row{gap:6px}.tg-die svg{width:32px;height:32px}
  .tg-tgrp.line{padding-left:0;border-left:0}
}
`;
