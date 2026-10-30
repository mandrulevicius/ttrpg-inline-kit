// The Margin gauge (docs/designs/dice/system-v2.md §1, §7, §9; critique.md "Margin, to exquisite"): a roll drawn as a
// load test on a dark instrument screen. The bar is what the roller brings, the line what the moment demands, and the
// margin, how far past it he held or how far short he fell, is the brightest thing on it. Shared by the chat's dice
// widget (kit/dice.js) and the pane's Story column (story.js), so a roll reads one way in both. Staging is pure (no
// DOM) and works from the payload `tt roll` prints (src/roll.mjs widgetData); only fitZones() touches a page.

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
  if (stat && stat.n > 0) pos.push({ role: 'stat', n: stat.n, why: statText(stat) });
  for (const t of d.bar) if (t.n > 0) pos.push({ role: 'mod', n: t.n, why: t.why, kind: t.kind });
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
  const z = zoneOf(d, m);
  const extras = !d.defend || m >= 0 ? extrasOf(m) : 0;
  const more = extras ? ` + ${extras === 1 ? 'an extra' : `${word(extras)} extras`}` : '';
  if (HURTS.includes(z)) return hurtHead(d, z) + more;
  if (d.defend) return `Avoided${z.key === 'cost' ? ', at a cost' : z.key === 'solid' ? ' cleanly' : ''}${more}`;
  return z.word + more;
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
    return `<${tag} ${attrs} class="loc${p === part ? ` ${state}` : ''}"><title>${p}</title></${tag}>`;
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

// The line as its flag names it: the rung (or the person) and the load on it. A person has no number before the throw.
function lineFlag(d, g, thrown) {
  const load = g.Lfull - g.base;
  const net = load ? ` ${quarters(load)}` : '';
  if (d.line.vs) return thrown ? `${d.line.vs} ${d.line.n}${net}` : d.line.vs;
  return `${d.line.rung ?? 'line'} ${d.line.n}${net}`;
}

// The terms in words, each where it lives: his side, the line's, luck's.
function chips(d, thrown) {
  const kind = { expert: 'expertise', gear: 'gear he carries', prep: 'what he did to set it up', wound: 'a wound', called: 'a called shot', stat: 'his stat' };
  const out = [];
  const c = d.condition;
  if (c && c.state !== 'steady') {
    const die = c.state === 'spent' ? 'the worst of three you dice counts' : 'the worse of two you dice counts';
    out.push(`<span class="c cond" title="${esc(`his condition: ${die}`)}">${esc(c.state)}${c.why ? ` · ${esc(c.why)}` : ''}</span>`);
  }
  for (const t of d.bar) out.push(`<span class="c ${t.n < 0 ? 'mine-load' : 'mine'}" title="${esc(kind[t.kind] ?? 'his side')}">${esc(quarters(t.n))} ${esc(t.why)}</span>`);
  const why = d.line.vs ? `${d.line.vs}${thrown ? ` ${d.line.n}` : ''}` : [`${d.line.rung ?? 'line'} ${d.line.n}`, d.line.why].filter(Boolean).join(', ');
  out.push(`<span class="c line" title="the line">${esc(why)}</span>`);
  for (const t of d.load) out.push(`<span class="c load" title="${esc(t.kind === 'called' ? 'the aim: a called shot' : t.n < 0 ? 'the world, in his favour' : 'the world, on the line')}">${esc(quarters(t.n))} ${esc(t.why)}</span>`);
  if (d.moment.dice > 1) out.push(`<span class="c luck" title="${d.moment.keep === 'worse' ? 'disadvantage: the worse moment die counts' : 'advantage: the better moment die counts'}">${d.moment.keep === 'worse' ? '−' : '+'} ${esc(d.moment.why || 'luck')}</span>`);
  return out.join('');
}

// The proof, as the 🎲 line has it: the kept dice, the net modifier (its quarter's rounding once thrown), the total,
// what it needed.
export function proofText(d, r) {
  const dice = r.kept.map((n) => `[${n}]`).join(' ');
  const mod = r.landed === null ? (d.mod ? ` ${quarters(d.mod)}` : '') : ` ${quarters(d.mod)}→${quarters(r.mod, '0')}`;
  return `${dice}${mod}${r.push ? ` push +${r.push}` : ''} = ${r.total}, needed ${d.needed}`;
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
//   ghost: a push on offer, previewed as outlined cells past the bar's end (the offer's hover or focus)
export function gaugeHtml(d, r = null, { anim = 'none', roomy = false, act = '', ghost = 0 } = {}) {
  const g = geometry(d);
  const thrown = Boolean(r);
  const roles = dieRoles(d);
  const N = g.N;
  const cells = Array.from({ length: N + 1 }, () => ({ cls: [], i: null }));
  const put = (k, cls, i = null) => { if (k >= 1 && k <= N) { cells[k].cls.push(cls); if (i !== null) cells[k].i = i; } };

  // rated cells: the stat, then his gear and preparation
  for (let k = 1; k <= g.whole; k++) {
    let at = 0;
    const piece = g.pos.find((p) => { at += p.n; return k - 0.5 < at; });
    if (piece) put(k, piece.role);
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
      }
      end += r.faces[i];
    }
  }
  let qcell = null;
  if (g.q) {
    qcell = end + 1;
    put(qcell, thrown ? (r.landed ? 'q in' : 'q out') : 'q', thrown ? order : null);
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
  if (thrown && ghost) for (let k = 1; k <= ghost; k++) put(total + k, 'ghost');
  // load between the nominal line and the one that counts: the world's net (hatched, or dotted relief when it's in his
  // favour), then his own negatives (hatched in his colour), each labelled by its size; the terms are in the chips
  const world = g.load.filter((t) => !t.mine);
  const mine = g.load.filter((t) => t.mine);
  const W = world.reduce((a, t) => a + t.n, 0);
  const M = mine.reduce((a, t) => a + t.n, 0);
  const loadSpans = [];
  if (W) loadSpans.push({ a: Math.min(g.base, g.base + W), b: Math.max(g.base, g.base + W), cls: W < 0 ? 'relief' : 'ld', terms: world,
    text: world.length === 1 && world[0].kind === 'called' ? `${quarters(W)} aim` : quarters(W) });
  if (M) loadSpans.push({ a: g.base + W, b: g.base + W + M, cls: 'ld mine', terms: mine, text: quarters(-M) });
  for (const s of loadSpans) {
    s.cells = [];
    for (let k = 1; k <= N; k++) if (k - 0.5 > s.a && k - 0.5 < s.b) { put(k, s.cls); s.cells.push(k); }
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
  const flagRight = g.E / N > (flag.length > 14 ? 0.4 : 0.6);
  const capHtml = `<div class="tg-cap" title="${esc(d.stat ? `${statText(d.stat)}: his stat, the bar's start` : 'no stat')}"><b>${esc(d.stat ? d.stat.name : 'roll')}</b><span>${d.stat ? esc(d.stat.n < 0 ? `−${-d.stat.n}` : `+${d.stat.n}`) : ''} ▸</span></div>`;
  const cellHtml = cells.slice(1).map((c, j) => `<i class="${c.cls.join(' ')}"${c.i !== null ? ` style="--i:${c.i}"` : ''}${j + 1 === qcell ? ` title="${esc(`the ${quarters(g.q).slice(1)}: a ${Math.round(g.q * 100)} in 100 chance of one more`)}"` : ''}></i>`).join('');
  const labelled = loadSpans.filter((s) => s.cells.length);
  const loadRow = labelled.length ? `<div class="tg-loadl">${labelled.map((s) => `<span class="${s.cls.replace('ld', '').trim()}" style="${span(s.cells[0], s.cells.length)}" title="${esc(s.terms.map((t) => `${quarters(t.mine ? -t.n : t.n)} ${t.why}`).join(' · '))}">${esc(s.text)}</span>`).join('')}</div>` : '';
  const zoneRow = zones.map((z, j) => {
    const near = focusAt >= 0 && Math.abs(j - focusAt) <= 1;
    const cls = [`tone-${tone(d, z.z)}`, z.z === lit ? 'on' : '', j === focusAt ? 'focus' : near ? 'nb' : 'far', HURTS.includes(z.z) || !attackOf(d) || d.target?.pc ? '' : 'miss'].filter(Boolean).join(' ');
    return `<div class="${cls}" style="${span(z.from, z.n)}" title="${esc(cap(z.z.zone))}"><span class="lg">${esc(z.z.zone)}</span><span class="sm">${esc(z.z.short)}</span></div>`;
  }).join('');
  const lineAt = `--at:${g.E}`;
  const lineHtml = fuzzy
    ? `<div class="tg-line fuzzy" style="${across(Math.max(1, g.E - 1), Math.min(4, N - Math.max(1, g.E - 1) + 1))}"></div>`
    : `<div class="tg-line${cross !== null && anim === 'pour' ? ' tick' : ''}" style="${lineAt}${cross !== null ? `;--x:${cross}` : ''}"></div>${g.Lfull !== g.base && !d.line.vs ? `<div class="tg-line nominal" style="--at:${g.base}"></div>` : ''}`;

  const gauge = `<div class="tg-gauge" style="--n:${N}">
<div class="tg-flag${flagRight ? ' r' : ''}" style="--at:${g.E}"><span title="${esc(d.line.why || d.line.vs || '')}">${esc(flag)}</span></div>
${fb ? `<div class="tg-shape${thrown ? ' hollow' : ''}" aria-hidden="true">${shape}</div>` : ''}
${capHtml}<div class="tg-cells" aria-hidden="true">${cellHtml}</div>
${loadRow}
<div class="tg-zones${fuzzy ? ' fuzzy' : ''}" aria-hidden="true">${zoneRow}</div>
${lineHtml}
</div>`;

  // readout: before the throw the stat against the line and the forecast's word; after it, the band word and how far
  let readout;
  let body = d.called || d.hit ? bodySvg(d, r) : '';
  if (!thrown) {
    readout = `<div class="tg-terms"><span class="st">${esc(d.stat ? statText(d.stat) : d.who)}</span><span class="vs">against</span><span class="ln">${esc(d.line.vs ?? `${d.line.rung ?? 'line'} ${d.line.n}`)}</span></div>`
      + (d.forecast?.word ? `<div class="tg-sol"><span>solution</span><b>${esc(d.forecast.word)}</b></div>` : '');
  } else {
    const v = verdict(d, r);
    readout = `<div class="tg-verdict tone-${v.tone}"><div class="tg-band">${esc(v.head)}</div><div class="tg-margin">${esc(v.sub)}</div></div>`;
  }

  const dice = roles.map((x, i) => {
    const n = thrown ? r.faces[i] : 0;
    const counted = thrown ? r.counted.has(i) : true;
    return `<figure class="tg-die ${x.role}${thrown && !counted ? ' dropped' : ''}${n ? '' : ' blank'}"${thrown && counted ? ` style="--i:${[...r.counted].sort((a, b) => a - b).indexOf(i)}"` : ''}><svg viewBox="0 0 26 26" role="img" aria-label="${esc(`${x.caption}: ${n || 'not thrown'}`)}">${dieFace(n)}</svg><figcaption>${esc(x.caption)}${thrown && !counted ? '<em> · set aside</em>' : ''}</figcaption></figure>`;
  }).join('');
  const proof = thrown ? `<div class="tg-proof">${esc(proofText(d, r))}${r.landed === null ? '' : `<span class="${r.landed ? 'in' : 'out'}"> · the ${esc(quarters(d.mod - Math.floor(d.mod)).slice(1))} ${r.landed ? 'came in' : 'stayed out'}</span>`}</div>` : '';

  const bandKey = thrown ? verdict(d, r).tone : '';
  const steps = order + (g.q ? 1 : 0);
  return `<div class="tg${roomy ? ' roomy' : ''}${anim === 'pour' && thrown ? ' pour' : ''}${anim === 'push' && thrown ? ' pushing' : ''}${onHim(d) ? ' defend' : ''}" data-phase="${thrown ? 'result' : 'before'}" data-line="${g.E}"${thrown ? ` data-end="${total}"` : ''}${bandKey ? ` data-tone="${bandKey}"` : ''} style="--steps:${steps}">
<p class="tg-sr">${esc(spoken(d, g, r))}</p>
<div class="tg-head" aria-hidden="true"><span class="tg-who">${esc(d.who)}</span><span class="tg-what">${esc(d.what)}</span><span class="tg-id">load test${d.id ? ` · ${esc(d.id)}` : ''}</span></div>
<div class="tg-read" aria-hidden="true"><div class="tg-readl">${readout}</div>${body}</div>
<div class="tg-chips" aria-hidden="true">${chips(d, thrown)}</div>
${gauge}
<div class="tg-foot"><div class="tg-dice" aria-hidden="true">${dice}</div>${proof}<div class="tg-act">${act}</div></div>
</div>`;
}

// A narrow screen names the zone in focus and its neighbours only, in their short forms when the full word won't fit;
// a word that still doesn't fit is left out rather than cut ("maime"). Run after layout, and again on resize.
// The lit zone is always named, spilling over its neighbours (whose words then give way) when even its short form is
// wider than its cells.
export function fitZones(root) {
  const zones = [...root.querySelectorAll('.tg-zones > div')];
  const over = (z) => z.scrollWidth > z.clientWidth + 1;
  const spill = [];
  zones.forEach((z, j) => {
    z.classList.remove('use-sm', 'hide');
    if (!over(z)) return;
    z.classList.add('use-sm');
    if (!over(z)) return;
    if (z.classList.contains('on')) spill.push(j);
    else z.classList.add('hide');
  });
  for (const j of spill) for (const n of [zones[j - 1], zones[j + 1]]) n?.classList.add('hide');
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
.tg-sr{position:absolute;width:1px;height:1px;margin:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}

.tg-head{display:flex;align-items:baseline;gap:4px 10px;flex-wrap:wrap}
.tg-who{font:600 11px/1.2 var(--disp);letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.tg-what{flex:1 1 50%;min-width:0;font-size:15px;color:var(--ink)}
.tg-id{margin-left:auto;font:500 11px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--faint);padding:3px 6px;border:1px solid var(--edge);border-radius:3px}

.tg-read{display:flex;align-items:flex-end;gap:8px 16px;margin:10px 0 4px;min-height:46px}
.tg-readl{flex:1;min-width:0;display:flex;align-items:flex-end;flex-wrap:wrap;gap:6px 18px}
.tg-terms{font:600 22px/1.15 var(--disp);letter-spacing:.01em}
.tg-terms .st{color:var(--stat)}.tg-terms .vs{font:400 14px var(--font-sans,system-ui);color:var(--dim);margin:0 7px}.tg-terms .ln{color:var(--ink)}
.tg-sol{margin-left:auto;text-align:right;line-height:1}
.tg-sol span{display:block;font:600 11px/1 var(--disp);letter-spacing:.16em;text-transform:uppercase;color:var(--faint);margin-bottom:5px}
.tg-sol b{font:600 20px/1 var(--disp);color:var(--ink);letter-spacing:.02em}
.tg-verdict{--tone:var(--band)}
.tg-band{font:700 28px/1.05 var(--disp);color:var(--tone);letter-spacing:.005em;text-shadow:0 0 14px color-mix(in srgb,var(--tone) 45%,transparent)}
.tg-margin{margin-top:3px;font-size:14px;color:var(--ink);opacity:.86}

.tg-body{margin:0;display:flex;flex-direction:column;align-items:center;gap:2px;flex:none}
.tg-body svg{width:34px;height:56px;overflow:visible}
.tg-body .loc{fill:var(--cell);stroke:var(--faint);stroke-width:1}
.tg-body .aim{fill:none;stroke:var(--ink);stroke-width:1.4;stroke-dasharray:2 2}
.tg-body .hit{fill:var(--tone);stroke:var(--tone);filter:drop-shadow(0 0 4px var(--tone))}
.tg-body .missed{fill:none;stroke:var(--clear);stroke-dasharray:1.5 2}
.tg-body figcaption{font-size:11px;color:var(--dim);white-space:nowrap}
.tg.defend .tg-body svg{width:40px;height:66px}

.tg-chips{display:flex;flex-wrap:wrap;gap:4px 6px;margin:4px 0 0;font-size:12.5px;line-height:1.5;color:var(--dim)}
.tg-chips .c{padding:0 7px;border:1px solid var(--edge);border-radius:4px;max-width:100%;overflow-wrap:anywhere}
.tg-chips .mine{border-left:3px solid var(--mod)}
.tg-chips .mine-load{border-left:3px solid var(--mod);background:repeating-linear-gradient(135deg,rgba(124,195,236,.12) 0 2px,transparent 2px 6px)}
.tg-chips .line{color:var(--ink);border-color:color-mix(in srgb,var(--ink) 30%,var(--edge))}
.tg-chips .load{border-style:dashed}
.tg-chips .luck{border-color:color-mix(in srgb,var(--luck) 60%,var(--edge));color:var(--ink)}
.tg-chips .cond{border-color:color-mix(in srgb,var(--you-cell) 70%,var(--edge));color:var(--you)}
.tg-chips [title]{cursor:help}

/* the gauge: one grid, the stat cap in its own column, then a column per cell */
.tg-gauge{position:relative;margin:14px 0 2px;display:grid;grid-template-columns:auto repeat(var(--n),minmax(0,1fr));column-gap:2px}
.tg-gauge>*{grid-column:2/-1}
.tg-flag{position:relative;height:16px;grid-row:1}
.tg-flag span{position:absolute;bottom:2px;left:calc(var(--at) * (100% + 2px) / var(--n) - 2px);white-space:nowrap;font:600 11px/1 var(--disp);letter-spacing:.1em;text-transform:uppercase;color:var(--ink);padding:0 5px}
.tg-flag.r span{transform:translateX(-100%)}
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
.tg-cells i.you{background:color-mix(in srgb,var(--you-cell) 46%,var(--cell));border-color:transparent}
.tg-cells i.moment,.tg-cells i.luck{background:color-mix(in srgb,var(--moment-cell) 40%,var(--cell));border-color:transparent}
.tg-cells i.q{background:linear-gradient(90deg,color-mix(in srgb,var(--quarter) 55%,var(--cell)) 0 50%,var(--cell) 50%);border:1px dashed color-mix(in srgb,var(--quarter) 70%,transparent)}
.tg-cells i.q.in{background:color-mix(in srgb,var(--quarter) 70%,var(--cell));border:1px solid transparent}
.tg-cells i.q.out{background:var(--cell);border:1px dashed color-mix(in srgb,var(--quarter) 40%,transparent)}
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
.tg-cells i.end::before{content:"";position:absolute;inset:-6px -5px;z-index:2;pointer-events:none;--c:var(--band);
background:linear-gradient(var(--c),var(--c)) 0 0/7px 2px,linear-gradient(var(--c),var(--c)) 0 0/2px 7px,linear-gradient(var(--c),var(--c)) 100% 0/7px 2px,linear-gradient(var(--c),var(--c)) 100% 0/2px 7px,
linear-gradient(var(--c),var(--c)) 0 100%/7px 2px,linear-gradient(var(--c),var(--c)) 0 100%/2px 7px,linear-gradient(var(--c),var(--c)) 100% 100%/7px 2px,linear-gradient(var(--c),var(--c)) 100% 100%/2px 7px;background-repeat:no-repeat;filter:drop-shadow(0 0 3px var(--c))}
.tg-loadl{grid-row:4;display:grid;grid-template-columns:subgrid;margin-top:3px;height:16px}
.tg-loadl span{font:500 11px/15px var(--mono);text-align:center;white-space:nowrap;overflow:visible;color:var(--dim);padding:0;border:1px solid currentColor;border-top:none;border-radius:0 0 3px 3px;opacity:.9;min-width:0;cursor:help}
.tg-loadl span.mine{color:var(--mod)}.tg-loadl span.relief{border-style:dotted}
.tg-zones{grid-row:5;display:grid;grid-template-columns:subgrid;margin-top:5px}
.tg-zones div{position:relative;border-top:3px solid color-mix(in srgb,var(--tone) 50%,transparent);padding:3px 1px 0;font-size:11px;line-height:1.2;color:var(--dim);text-align:center;white-space:nowrap;min-width:0;overflow:hidden}
.tg-zones .sm{display:none}.tg-zones .use-sm .lg{display:none}.tg-zones .use-sm .sm{display:inline}.tg-zones .hide span{visibility:hidden}
.tg-zones div.on{border-top-color:var(--tone);color:var(--tone);font-weight:600;z-index:1;overflow:visible}
.tg-zones .miss{border-top-style:dotted}
.tg[data-phase=result] .tg-zones div:not(.on){color:var(--faint)}
.tg-zones.fuzzy div{border-top-color:transparent;background:linear-gradient(color-mix(in srgb,var(--tone) 40%,transparent),color-mix(in srgb,var(--tone) 40%,transparent)) top/100% 3px no-repeat;filter:blur(.4px)}
.tg-line{grid-column:2/-1;grid-row:2/4;align-self:stretch;width:0;margin-left:calc(var(--at) * (100% + 2px) / var(--n) - 2px);border-left:2px solid var(--ink);pointer-events:none;z-index:3;box-shadow:0 0 6px rgba(219,227,236,.35)}
.tg-line.nominal{border-left:1px dashed var(--faint);box-shadow:none;z-index:2}
.tg-line.fuzzy{margin-left:0;border:0;width:auto;background:linear-gradient(90deg,transparent,rgba(219,227,236,.22) 35%,rgba(219,227,236,.32) 50%,rgba(219,227,236,.22) 65%,transparent);box-shadow:none}

.tg-foot{display:flex;align-items:center;gap:10px 16px;flex-wrap:wrap;margin-top:12px;padding-top:10px;border-top:1px solid var(--edge)}
.tg-dice{display:flex;gap:12px;align-items:flex-start}
.tg-die{margin:0;display:flex;flex-direction:column;align-items:center;gap:4px;width:56px;transition:opacity .3s}
.tg-die svg{width:38px;height:38px;overflow:visible}
.tg-die rect{fill:var(--cell);stroke:var(--faint);stroke-width:1}
.tg-die circle{fill:var(--glass)}
.tg-die.you rect{fill:var(--you);stroke:none}
.tg-die.moment rect,.tg-die.luck rect{fill:var(--moment);stroke:none}
.tg-die.luck rect{fill:color-mix(in srgb,var(--luck) 70%,var(--moment))}
.tg-die.blank rect{fill:transparent;stroke:var(--faint);stroke-dasharray:3 2}
.tg-die.you.blank rect{stroke:var(--you)}.tg-die.moment.blank rect{stroke:var(--moment)}.tg-die.luck.blank rect{stroke:var(--luck)}
.tg-die figcaption{font-size:11px;line-height:1.2;color:var(--dim);text-align:center;max-width:96px}
.tg-die.luck{width:auto;max-width:104px}
.tg-die.dropped{opacity:.45}.tg-die.dropped svg{transform:translateY(4px) rotate(-9deg)}
.tg-die em{font-style:normal;color:var(--faint)}
.tg-die.tumble svg{animation:tg-tumble .24s linear infinite}
.tg-proof{font:500 12.5px/1.4 var(--mono);color:var(--dim);font-variant-numeric:tabular-nums}
.tg-proof .in{color:var(--quarter)}.tg-proof .out{color:var(--faint)}
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
.tg-offer>p{flex-basis:100%;margin:0 0 2px;font-size:12.5px;color:var(--dim)}
.tg-offer button{font:inherit;text-align:left;cursor:pointer;border-radius:6px;padding:7px 12px;line-height:1.25;min-width:0}
.tg-offer .tg-take{font:700 12px/1 var(--disp);letter-spacing:.16em;text-transform:uppercase;color:var(--glass);background:var(--ink);border:0;padding:10px 16px}
.tg-offer .tg-push{background:none;color:var(--ink);border:1px solid color-mix(in srgb,var(--push) 55%,var(--edge))}
.tg-offer .tg-push:hover,.tg-offer .tg-push:focus-visible{background:color-mix(in srgb,var(--push) 12%,transparent);border-color:var(--push)}
.tg-offer .tg-push b{font:700 14px/1 var(--disp);color:var(--push);margin-right:6px}
.tg-offer .tg-push small{display:block;margin-top:3px;font-size:11.5px;color:var(--dim)}.tg-offer .tg-push small.mark{color:var(--near)}
.tg-offer button:focus-visible{outline:2px solid var(--stat);outline-offset:2px}
.tg-send{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px}.tg-send code{display:block;margin:4px 0 6px;line-height:1.45}
.tg-send.bad>span{flex-basis:100%}.tg-send details{font-size:12px;color:var(--faint)}.tg-send details[open]{flex-basis:100%}.tg-send summary{cursor:pointer;color:var(--dim)}.tg-send summary:focus-visible{outline:2px solid var(--stat);outline-offset:2px}
.tg-status button{font:inherit;font-size:11px;background:none;border:1px solid var(--edge);border-radius:4px;color:var(--dim);padding:2px 8px;cursor:pointer}

/* the arrival: dice pour into the bar, the line ticks when crossed, the margin locks on, the band word rises last */
.tg.pour .tg-cells i.pour{animation:tg-fill .16s both;animation-delay:calc(var(--i) * 45ms + 120ms)}
.tg.pour .tg-cells i.q.in,.tg.pour .tg-cells i.q.out{animation:tg-q .45s both;animation-delay:calc(var(--i) * 45ms + 220ms)}
.tg.pour .tg-line.tick{animation:tg-tick .5s both;animation-delay:calc(var(--x) * 45ms + 160ms)}
.tg.pour .tg-cells i.head,.tg.pour .tg-cells i.rim,.tg.pour .tg-cells i.short::after{animation:tg-lock .35s both;animation-delay:calc(var(--steps) * 45ms + 380ms)}
.tg.pour .tg-cells i.end::before{animation:tg-bracket .45s cubic-bezier(.2,.8,.3,1.2) both;animation-delay:calc(var(--steps) * 45ms + 420ms)}
.tg.pour .tg-shape .land{animation:tg-fade .4s both;animation-delay:calc(var(--steps) * 45ms + 420ms)}
.tg.pour .tg-verdict,.tg.pour .tg-body .hit{animation:tg-rise .5s both;animation-delay:calc(var(--steps) * 45ms + 560ms)}
.tg.pour .tg-proof{animation:tg-fade .3s both;animation-delay:calc(var(--steps) * 45ms + 700ms)}
.tg.pour .tg-die:not(.dropped) svg{animation:tg-pulse .5s both;animation-delay:calc(var(--i) * 300ms + 60ms)}
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
  .tg-terms{font-size:19px}.tg-band{font-size:24px}.tg-sol b{font-size:17px}
  .tg-gauge{column-gap:1px}
  .tg-line{margin-left:calc(var(--at) * (100% + 1px) / var(--n) - 1.5px)}
  .tg-flag span{left:calc(var(--at) * (100% + 1px) / var(--n) - 1.5px)}
  .tg-zones div.far span{visibility:hidden}
  .tg-loadl{visibility:hidden;height:4px}
  .tg-act{margin-left:0;width:100%}
  .tg-throw{flex:1}
  .tg-offer button{flex:1 1 100%}
  .tg-die{width:48px}
  .tg-id{margin-left:0}
}
`;
