// The dice widget's staging (kit/dice.js), pure so it can be tested without a page. The data is what `tt roll`
// prints (src/roll.mjs widgetData): every term with its reason, the proof's two numbers (`mod`, the net modifier
// against the whole line, in quarters; `needed`, the whole line), the dice by source, the forecast, and for a roll tt
// threw itself (`--show`), the result. The picture is the Margin gauge (pane/gauge.js), shared with the pane's story.
import { esc, gaugeHtml, quarters, resultOf } from '../pane/gauge.js';

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
  return {
    ...d, view: d.view ?? 'gauge', pc: d.pc ?? true,
    bar: Array.isArray(d.bar) ? d.bar : [], load: Array.isArray(d.load) ? d.load : [], result,
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

// What the click sends: the dice by source, the quarter and the result he saw, and the exact resolution command, so
// the GM can't misread it.
export function sentLine(d, faces, frac = null) {
  const r = resultOf(d, faces, frac);
  const you = faces.slice(0, d.you);
  const moment = faces.slice(d.you);
  const and = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : `${xs[0]}`);
  const q = r.landed === null ? '' : `; the ${quarters(d.mod - Math.floor(d.mod)).slice(1)} ${r.landed ? 'came in' : 'stayed out'}`;
  const head = r.severity ? `${r.band.word}, ${r.severity.word}` : r.band.word;
  return `[roll ${d.id}] ${d.who}${d.what ? `: ${d.what}` : ''}. I rolled you ${and(you)}, moment ${and(moment)}${q} → ${head}. `
    + `(tt roll ${d.world ?? '<world>'} --id ${d.id} --dice ${faces.join(',')}${r.landed === null ? '' : ` --frac ${frac}`})`;
}
