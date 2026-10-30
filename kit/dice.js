// The dice widget: the player throws his own character's dice. The GM shows who, what they attempt, the modifier,
// what it needs and any advantage; one click throws (crypto-random), shows the dice, locks, and sends the faces back
// through sendPrompt in a line the GM can't misread, carrying the roll's id. The GM passes them to
// `tt roll … --dice <faces> --id <id>`, which refuses a second result for an id: a widget drawn again after a chat
// reload offers the button again, and only the first throw counts. Payload:
//   <div class="tt-dice" data-id="3.2" data-who="Andrew" data-what="climb the wet ladder fast" data-mod="1" data-needed="9" data-mode="adv">Andrew: climb the wet ladder fast</div>
//   <script type="module" src="<kit base>kit/dice.js"></script>
// data-mode: "adv" or "dis" (three dice, the best or worst two count), or absent. The element's text shows if this
// module never loads.
import { addStyle } from './style.js';

const ROLL_MS = 650;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const PIPS = { 1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [3, 1], [1, 3], [3, 3]], 5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], 6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]] };
const MODE = { adv: 'advantage: three dice, the best two count', dis: 'disadvantage: three dice, the worst two count' };

addStyle('tt-dice-css', `
.tt-dice{background:var(--surface-2,transparent);border:.5px solid var(--border);border-radius:12px;padding:1rem 1.25rem;color:var(--text-primary);font:16px/1.5 var(--font-sans,system-ui,sans-serif)}
.tt-dice .what b{font-weight:500}
.tt-dice .terms{margin:2px 0 0;font-size:14px;color:var(--text-secondary)}
.tt-dice .row{display:flex;align-items:center;flex-wrap:wrap;gap:12px 16px;margin-top:14px}
.tt-dice .dice{display:flex;gap:8px}
.tt-dice svg{width:40px;height:40px;transition:opacity .3s}
.tt-dice svg rect{fill:var(--surface-1,#eee);stroke:var(--border-strong,#999);stroke-width:1}
.tt-dice svg circle{fill:var(--text-primary)}
.tt-dice svg.shown rect{fill:var(--text-primary);stroke:none}.tt-dice svg.shown circle{fill:var(--surface-2,#fff)}
.tt-dice svg.dropped{opacity:.3}
.tt-dice .sum{font-size:15px;font-variant-numeric:tabular-nums}
.tt-dice .sum.made{color:var(--text-success)}.tt-dice .sum.short{color:var(--text-danger)}
.tt-dice .note{font-size:13px;color:var(--text-secondary)}
`);

const die = (n, cls = '') => `<svg viewBox="0 0 26 26" class="${cls}" aria-hidden="true"><rect x=".5" y=".5" width="25" height="25" rx="5"/>${(PIPS[n] ?? []).map(([x, y]) => `<circle cx="${x * 6.5}" cy="${y * 6.5}" r="2.3"/>`).join('')}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '');

// A fair d6 from the browser's crypto source (a byte of 252 or more is thrown again, so no face is favoured).
function d6() {
  const b = new Uint8Array(1);
  do crypto.getRandomValues(b); while (b[0] >= 252);
  return (b[0] % 6) + 1;
}

// The two that count, as src/dice.mjs keeps them: advantage drops the lowest, disadvantage the highest.
function keep(dice, mode) {
  if (!mode) return { kept: dice, dropped: -1 };
  const dropped = mode === 'adv' ? dice.indexOf(Math.min(...dice)) : dice.indexOf(Math.max(...dice));
  return { kept: dice.filter((_, i) => i !== dropped), dropped };
}

function setUp(el) {
  el.dataset.ready = '';
  const d = el.dataset;
  const mode = MODE[d.mode] ? d.mode : '';
  const mod = Number.parseInt(d.mod ?? '0', 10) || 0;
  const needed = Number.parseInt(d.needed ?? '', 10);
  const count = mode ? 3 : 2;
  const memo = `tt-dice|${d.id}|${d.who}|${d.what}`;
  const terms = [signed(mod), Number.isFinite(needed) && `needs ${needed}`, MODE[mode]].filter(Boolean).join(' · ');
  el.innerHTML = `<div class="what"><b>${esc(d.who)}</b>${d.what ? `: ${esc(d.what)}` : ''}</div>${terms ? `<p class="terms">${esc(terms)}</p>` : ''}
<div class="row"><div class="dice">${Array.from({ length: count }, () => die(0)).join('')}</div><button type="button">Roll ${count} dice</button><span class="sum" aria-live="polite"></span></div>`;
  const [diceBox, button, sum] = [el.querySelector('.dice'), el.querySelector('button'), el.querySelector('.sum')];

  function show(dice, note) {
    const { kept, dropped } = keep(dice, mode);
    diceBox.innerHTML = dice.map((n, i) => die(n, i === dropped ? 'shown dropped' : 'shown')).join('');
    const total = kept[0] + kept[1] + mod;
    sum.className = `sum${Number.isFinite(needed) ? (total >= needed ? ' made' : ' short') : ''}`;
    // Dice in brackets, as the 🎲 line has them, so the modifier never reads as another die (md.6).
    sum.textContent = `${kept.map((n) => `[${n}]`).join(' ')}${mod ? ` ${signed(mod)}` : ''} = ${total}${Number.isFinite(needed) ? `, needed ${needed}` : ''}`;
    button.remove();
    sum.after(Object.assign(document.createElement('span'), { className: 'note', textContent: note }));
  }

  let before = null;
  try { before = JSON.parse(localStorage.getItem(memo) ?? 'null'); } catch { /* no storage: tt's id check still holds */ }
  if (Array.isArray(before) && before.length === count) return show(before, 'Rolled earlier; that result stands.');

  button.addEventListener('click', async () => {
    button.disabled = true;
    const dice = Array.from({ length: count }, d6);
    if (!reduced.matches) {
      for (const t0 = performance.now(); performance.now() - t0 < ROLL_MS;) {
        diceBox.innerHTML = Array.from({ length: count }, () => die(d6(), 'shown')).join('');
        await new Promise((r) => setTimeout(r, 70));
      }
    }
    try { localStorage.setItem(memo, JSON.stringify(dice)); } catch { /* as above */ }
    const line = `[roll ${d.id}] ${d.who}${d.what ? `: ${d.what}` : ''}. I rolled ${dice.join(', ')}. (tt roll … --dice ${dice.join(',')} --id ${d.id})`;
    try {
      sendPrompt(`${line}\n`); // the break keeps it apart from another widget's text in the same reply
      show(dice, 'Sent');
    } catch {
      show(dice, `Couldn't send. Type: rolled ${dice.join(', ')} for roll ${d.id}`);
    }
  });
}

for (const el of document.querySelectorAll('.tt-dice:not([data-ready])')) setUp(el);
