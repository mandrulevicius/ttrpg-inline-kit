// The dice widget's staging (kit/dice.js), pure so it can be tested without a page. The data is what `tt roll --ask`
// prints (src/roll.mjs widgetData): every term with its reason, the proof's two numbers (`mod`, the net modifier
// against the whole line, in quarters; `needed`, the whole line), the dice by source and the forecast. The widget
// computes nothing about the rules beyond adding the dice to `mod`; tt settles the roll.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

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
const KIND = { expert: 'expertise', gear: 'gear he carries', prep: 'what he did to set it up', wound: 'a wound', called: 'a called shot' };

// The payload's JSON, or null when it isn't a roll this module can draw.
export function readData(text) {
  let d;
  try { d = JSON.parse(text); } catch { return null; }
  const ok = d && typeof d.id === 'string' && typeof d.who === 'string' && Number.isFinite(d.mod) && Number.isInteger(d.needed)
    && Number.isInteger(d.you) && d.you >= 1 && d.moment && Number.isInteger(d.moment.dice) && d.moment.dice >= 1;
  if (!ok) return null;
  return { bar: [], load: [], ...d, bar: Array.isArray(d.bar) ? d.bar : [], load: Array.isArray(d.load) ? d.load : [] };
}

// One term: its size and reason, its kind behind a tooltip.
const term = (t) => `<span class="t"${KIND[t.kind] ? ` title="${esc(KIND[t.kind])}"` : ''}>${esc(quarters(t.n))} ${esc(t.why)}</span>`;

// What he brings, what it's against, and luck's second try. A person's line shows no number until the throw: he's
// reading a person, not a table (v2 §5).
export function termsHtml(d, { thrown = false } = {}) {
  const line = d.line ?? {};
  const against = line.vs
    ? `<span class="t">${esc(line.vs)}${thrown ? ` ${line.n}` : ''}</span>`
    : `<span class="t">${esc([`${line.rung ?? 'line'} ${line.n}`, line.why].filter(Boolean).join(', '))}</span>`;
  const rows = [
    ['brings', [d.stat ? `<span class="t"><b>${esc(statText(d.stat))}</b></span>` : '', ...d.bar.map(term)].filter(Boolean)],
    ['against', [against, ...d.load.map(term)]],
  ];
  if (d.moment.dice > 1) {
    const word = d.moment.keep === 'worse' ? 'disadvantage' : 'advantage';
    rows.push(['luck', [`<span class="t">${word}${d.moment.why ? `, ${esc(d.moment.why)}` : ''}: ${d.moment.dice} moment dice, the ${esc(d.moment.keep ?? 'better')} counts</span>`]]);
  }
  return rows.filter(([, ts]) => ts.length).map(([k, ts]) => `<div class="tr"><span class="k">${k}</span><span class="v">${ts.join('<span class="dot"> · </span>')}</span></div>`).join('');
}

// The dice that count: the worst you die (strain will throw more than one), and the better or worse moment die.
export function keep(d, faces) {
  const you = faces.slice(0, d.you);
  const moment = faces.slice(d.you);
  const youAt = you.indexOf(Math.min(...you));
  const pick = d.moment.dice > 1 ? (d.moment.keep === 'worse' ? Math.min(...moment) : Math.max(...moment)) : moment[0];
  const momentAt = d.you + moment.indexOf(pick);
  return { kept: [faces[youAt], faces[momentAt]], counted: new Set([youAt, momentAt]) };
}

// The proof after the throw, as the roll line will have it. With a fraction left, whether he makes the line can ride
// on it: tt draws that chance when it settles the roll.
export function sumOf(d, faces) {
  const { kept, counted } = keep(d, faces);
  const total = kept[0] + kept[1] + d.mod;
  const low = Math.floor(total);
  const status = low >= d.needed ? 'made' : Math.ceil(total) < d.needed ? 'short' : 'quarter';
  const text = `${kept.map((n) => `[${n}]`).join(' ')}${d.mod ? ` ${quarters(d.mod)}` : ''} = ${quarters(total).replace(/^\+/, '')}, needed ${d.needed}${status === 'quarter' ? ` · the ${quarters(d.mod - Math.floor(d.mod)).slice(1)} decides` : ''}`;
  return { counted, total, status, text };
}

// What the click sends: a line the GM can't misread, carrying the id and the exact resolution command.
export function sentLine(d, faces) {
  const you = faces.slice(0, d.you);
  const moment = faces.slice(d.you);
  const and = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : `${xs[0]}`);
  return `[roll ${d.id}] ${d.who}${d.what ? `: ${d.what}` : ''}. I rolled you ${and(you)}, moment ${and(moment)}. (tt roll ${d.world ?? '<world>'} --id ${d.id} --dice ${faces.join(',')})`;
}
