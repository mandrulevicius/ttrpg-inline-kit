// The dice widget's staging (kit/dice.js), pure so it can be tested without a page. The data is what `tt roll`
// prints (src/roll.mjs widgetData): every term with its reason, the proof's two numbers (`mod`, the net modifier
// against the whole line, in quarters; `needed`, the whole line), the dice by source, the forecast, and for a roll tt
// threw itself (`--show`), the result. The picture is the Margin gauge (pane/gauge.js), shared with the pane's story.
import { buysText, esc, extrasOf, gaugeHtml, quarters, resultOf, zoneOf } from '../pane/gauge.js';

export { esc, gaugeHtml, resultOf };

// The payload's JSON, or null when it isn't a roll this module can draw. An open roll has an id (the one result tt
// accepts for it); a shown result needs none. Payloads from before step 2 have no view or pc: the gauge, his roll.
export function readData(text) {
  let d;
  try { d = JSON.parse(text); } catch { return null; }
  const result = d?.result && Array.isArray(d.result.dice) ? d.result : null;
  const ok = d && (typeof d.id === 'string' || result) && typeof d.who === 'string' && Number.isFinite(d.mod) && Number.isInteger(d.needed)
    && Number.isInteger(d.you) && d.you >= 1 && d.moment && Number.isInteger(d.moment.dice) && d.moment.dice >= 1 && d.line && Number.isFinite(d.line.n);
  if (!ok) return null;
  if (result && (result.dice.length !== d.you + d.moment.dice || !result.dice.every((n) => Number.isInteger(n) && n >= 1 && n <= 6))) return null;
  if (result?.push !== undefined && !(Number.isInteger(result.push) && result.push >= 1 && result.push <= 4)) return null;
  // the pushes on offer: tt's costs, each well formed, or none (a payload from before step 3 sends at the throw)
  const push = Array.isArray(d.push) && !result
    ? d.push.filter((p) => p && Number.isInteger(p.n) && p.n >= 1 && p.n <= 4 && Number.isInteger(p.after) && typeof p.state === 'string' && Number.isInteger(p.marks)) : [];
  return {
    ...d, view: d.view ?? 'gauge', pc: d.pc ?? true,
    bar: Array.isArray(d.bar) ? d.bar : [], load: Array.isArray(d.load) ? d.load : [], result, push,
  };
}

// Whether the throw needs the quarter's draw: only when the net modifier has a fraction.
export const needsFrac = (d) => d.mod !== Math.floor(d.mod);

// A fair draw from the browser's crypto source: a byte at or past the last whole multiple of n is thrown again, so no
// value is favoured. d6: 1..6; the quarter's chance: 0..99.
export function fair(n, source = (b) => crypto.getRandomValues(b)) {
  const b = new Uint8Array(1);
  const limit = 256 - (256 % n);
  do source(b); while (b[0] >= limit);
  return b[0] % n;
}

// The pushes worth offering after a throw (v2 §6): for each new thing a push could buy (the next zone up, an extra past
// the top one, a lifted failure or a lesser hurt), the cheapest push that buys it, up to three. A push that buys
// nothing new isn't offered.
export function pushOffers(d, faces, frac = null) {
  if (!d.push?.length) return [];
  const base = resultOf(d, faces, frac);
  const tier = (m) => `${zoneOf(d, m).key}+${!d.defend || m >= 0 ? extrasOf(m) : 0}`;
  let last = tier(base.margin);
  const out = [];
  for (const p of d.push) {
    const m = base.margin + p.n;
    if (tier(m) === last) continue;
    last = tier(m);
    out.push({ ...p, buys: buysText(d, m) });
    if (out.length === 3) break;
  }
  return out;
}

// The offer, in the widget's foot: take the throw, or one of the pushes, each naming what it buys and the strain after.
export function offerHtml(offers) {
  const strain = (p) => `strain ${p.after} · ${p.state}${p.marks ? `, ${p.marks === 1 ? 'a mark' : `${p.marks} marks`}` : ''}`;
  return `<div class="tg-offer" role="group" aria-label="Take the throw, or push it"><p>Take it, or push: a push costs strain.</p>`
    + '<button type="button" class="tg-take" data-push="0">Take it</button>'
    + offers.map((p) => `<button type="button" class="tg-push" data-push="${p.n}"><b>+${p.n}</b>${esc(p.buys)}<small${p.marks ? ' class="mark"' : ''}>${esc(strain(p))}</small></button>`).join('')
    + '</div>';
}

// What the widget says about its line once thrown. The chat's sendPrompt sends it as his own message when the chat is
// idle; clicked while the GM is mid-turn, or with text in his message box, it has merged into his text or gone
// missing, and nothing here can see that. So the line is always kept to copy: tucked behind "didn't arrive?" after a
// send, in plain view when the send threw or was refused. `how`: 'sent', 'failed', 'earlier' (a throw remembered from
// before a reload).
const SEND_SAYS = { sent: 'Sent', failed: "Couldn't reach the chat. Copy this and send it:", earlier: 'Thrown earlier; that result stands' };
export function sendStatus(how, line) {
  const copy = `<code>${esc(line)}</code> <button type="button" data-copy>copy</button>`;
  if (how === 'failed') return `<span class="tg-status tg-send bad" role="status"><span>${esc(SEND_SAYS.failed)}</span> ${copy}</span>`;
  return `<span class="tg-status tg-send ${how === 'sent' ? 'ok' : ''}" role="status"><span>${esc(SEND_SAYS[how])}</span>`
    + `<details><summary>didn't arrive?</summary>Copy it and send it yourself: ${copy}</details></span>`;
}

// What the click sends: the dice by source, the quarter and the result he saw, and the exact resolution command, so
// the GM can't misread it.
export function sentLine(d, faces, frac = null, push = 0) {
  const r = resultOf(d, faces, frac, null, push);
  const you = faces.slice(0, d.you);
  const moment = faces.slice(d.you);
  const and = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : `${xs[0]}`);
  const q = r.landed === null ? '' : `; the ${quarters(d.mod - Math.floor(d.mod)).slice(1)} ${r.landed ? 'came in' : 'stayed out'}`;
  const word = (x) => (x.severity ? `${x.band.word}, ${x.severity.word}` : x.band.word);
  const head = push ? `${word(resultOf(d, faces, frac))}; pushed +${push} → ${word(r)}` : word(r);
  return `[roll ${d.id}] ${d.who}${d.what ? `: ${d.what}` : ''}. I rolled you ${and(you)}, moment ${and(moment)}${q} → ${head}. `
    + `(tt roll ${d.world ?? '<world>'} --id ${d.id} --dice ${faces.join(',')}${r.landed === null ? '' : ` --frac ${frac}`}${push ? ` --push ${push}` : ''})`;
}
