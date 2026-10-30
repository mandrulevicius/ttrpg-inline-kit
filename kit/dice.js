// The dice widget: he throws his own character's dice. `tt roll --ask` records the roll and prints this widget whole;
// the GM passes it to show_widget unchanged:
//   <div class="tt-dice">Andrew: climb the wet ladder fast<script type="application/json">{…}</script></div>
//   <script type="module" src="<kit base>kit/dice.js"></script>
// The data (src/roll.mjs widgetData; staged by dice-view.js) names the stat, what he brings, the line and its reason,
// the world's load and luck's second try. One click throws the you die and the moment die (crypto-random), shows them
// told apart, locks, and sends the faces back through sendPrompt with the roll's id and the exact `tt roll --id`
// command. tt refuses a second result for an id: a widget drawn again after a chat reload offers the button again,
// so this one remembers its throw where it can. The element's text shows if this module never loads.
import { addStyle } from './style.js';
import { esc, readData, sentLine, sumOf, termsHtml } from './dice-view.js';

const ROLL_MS = 650;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const PIPS = { 1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [3, 1], [1, 3], [3, 3]], 5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], 6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]] };

addStyle('tt-dice-css', `
.tt-dice{background:var(--surface-2,transparent);border:.5px solid var(--border);border-radius:12px;padding:1rem 1.25rem;color:var(--text-primary);font:16px/1.5 var(--font-sans,system-ui,sans-serif)}
.tt-dice .head{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.tt-dice .head b{font-weight:500}
.tt-dice .word{flex:none;font-size:13px;color:var(--text-secondary);font-style:italic}
.tt-dice .terms{margin:6px 0 0;font-size:14px;color:var(--text-secondary)}
.tt-dice .tr{display:grid;grid-template-columns:4.2rem minmax(0,1fr);gap:8px}
.tt-dice .k{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted,var(--text-secondary));padding-top:2px}
.tt-dice .v b{font-weight:500;color:var(--text-primary)}
.tt-dice .t[title]{text-decoration:underline dotted;text-decoration-color:var(--border-strong);text-underline-offset:3px;cursor:help}
.tt-dice .row{display:flex;align-items:center;flex-wrap:wrap;gap:12px 16px;margin-top:14px}
.tt-dice .dice{display:flex;gap:10px}
.tt-dice figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:2px;transition:opacity .3s}
.tt-dice figcaption{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-secondary)}
.tt-dice svg{width:40px;height:40px}
.tt-dice svg rect{fill:var(--surface-1,#eee);stroke:var(--border-strong,#999);stroke-width:1}
.tt-dice svg circle{fill:var(--text-primary)}
.tt-dice .you.shown rect{fill:var(--text-primary);stroke:none}.tt-dice .you.shown circle{fill:var(--surface-2,#fff)}
.tt-dice .moment.shown rect{fill:var(--bg-accent,#e6f1fb);stroke:var(--text-accent,#185fa5)}.tt-dice .moment.shown circle{fill:var(--text-accent,#185fa5)}
.tt-dice figure.dropped{opacity:.3}
.tt-dice .sum{font-size:15px;font-variant-numeric:tabular-nums}
.tt-dice .sum.made{color:var(--text-success)}.tt-dice .sum.short{color:var(--text-danger)}.tt-dice .sum.quarter{color:var(--text-warning)}
.tt-dice .note{font-size:13px;color:var(--text-secondary)}
`);

const face = (n, cls) => `<svg viewBox="0 0 26 26" class="${cls}" aria-hidden="true"><rect x=".5" y=".5" width="25" height="25" rx="5"/>${(PIPS[n] ?? []).map(([x, y]) => `<circle cx="${x * 6.5}" cy="${y * 6.5}" r="2.3"/>`).join('')}</svg>`;

// A fair d6 from the browser's crypto source (a byte of 252 or more is thrown again, so no face is favoured).
function d6() {
  const b = new Uint8Array(1);
  do crypto.getRandomValues(b); while (b[0] >= 252);
  return (b[0] % 6) + 1;
}

function setUp(el) {
  el.dataset.ready = '';
  const d = readData(el.querySelector('script[type="application/json"]')?.textContent ?? '');
  if (!d) return; // not a roll this module can draw: the element's own text stays
  const count = d.you + d.moment.dice;
  const source = (i) => (i < d.you ? 'you' : 'moment');
  // Before the throw every die is blank; its caption says whose it is.
  const diceHtml = (faces, counted) => faces.map((n, i) => `<figure class="${counted && !counted.has(i) ? 'dropped' : ''}">${face(n, `${source(i)}${n ? ' shown' : ''}`)}<figcaption>${source(i)}</figcaption></figure>`).join('');
  const memo = `tt-dice|${d.world ?? ''}|${d.id}`;
  el.innerHTML = `<div class="head"><span><b>${esc(d.who)}</b>${d.what ? `: ${esc(d.what)}` : ''}</span>${d.forecast?.word ? `<span class="word">${esc(d.forecast.word)}</span>` : ''}</div>
<div class="terms">${termsHtml(d)}</div>
<div class="row"><div class="dice">${diceHtml(Array(count).fill(0))}</div><button type="button">Throw</button><span class="sum" aria-live="polite"></span></div>`;
  const [terms, diceBox, button, sum] = ['.terms', '.dice', 'button', '.sum'].map((s) => el.querySelector(s));

  function show(faces, note) {
    const s = sumOf(d, faces);
    diceBox.innerHTML = diceHtml(faces, s.counted);
    terms.innerHTML = termsHtml(d, { thrown: true }); // a person's line shows its number now
    el.querySelector('.word')?.remove();
    sum.className = `sum ${s.status}`;
    sum.textContent = s.text;
    button.remove();
    sum.after(Object.assign(document.createElement('span'), { className: 'note', textContent: note }));
  }

  let before = null;
  try { before = JSON.parse(localStorage.getItem(memo) ?? 'null'); } catch { /* no storage: tt's id check still holds */ }
  if (Array.isArray(before) && before.length === count) return show(before, 'Thrown earlier; that result stands.');

  button.addEventListener('click', async () => {
    button.disabled = true;
    const faces = Array.from({ length: count }, d6);
    if (!reduced.matches) {
      for (const t0 = performance.now(); performance.now() - t0 < ROLL_MS;) {
        diceBox.innerHTML = diceHtml(Array.from({ length: count }, d6));
        await new Promise((r) => setTimeout(r, 70));
      }
    }
    try { localStorage.setItem(memo, JSON.stringify(faces)); } catch { /* as above */ }
    const line = sentLine(d, faces);
    try {
      sendPrompt(`${line}\n`); // the break keeps it apart from another widget's text in the same reply
      show(faces, 'Sent');
    } catch {
      show(faces, `Couldn't send. Type: ${line}`);
    }
  });
}

for (const el of document.querySelectorAll('.tt-dice:not([data-ready])')) setUp(el);
