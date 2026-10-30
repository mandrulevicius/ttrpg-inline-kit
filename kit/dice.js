// The dice widget: he throws his own character's dice, and the roll is drawn as the Margin gauge (pane/gauge.js) on a
// dark instrument screen. `tt roll --ask` records the roll and prints this widget whole; the GM passes it to
// show_widget unchanged:
//   <div class="tt-dice" style="…">Andrew: climb the wet ladder fast<br><small>…</small><script type="application/json">{…}</script></div>
//   <script type="module" src="<kit base>kit/dice.js"></script>
// One click throws the you die, the moment die(s) and the quarter's chance (crypto-random), so the result is final at
// the throw: the dice tumble and pour into the bar, the line ticks when crossed, the band word rises last. It then
// sends the faces and the draw back through sendPrompt with the exact `tt roll --id … --dice … --frac …`. tt refuses a
// second result for an id: a widget drawn again after a chat reload would offer the button again, so this one
// remembers its throw where it can. A roll tt threw itself (`tt roll … --show`) arrives landed, with no button. The
// element's own text, on the same dark screen, shows until this module runs, or if it never loads.
import { addStyle } from './style.js';
import { GAUGE_CSS, dieFace, fitZones } from '../pane/gauge.js';
import { esc, fair, gaugeHtml, needsFrac, readData, resultOf, sentLine } from './dice-view.js';

const TUMBLE_MS = 620;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const d6 = () => fair(6) + 1;

// The gauge's display faces: the chat's sandbox loads Google Fonts (an @import must open its stylesheet).
const FONTS = "@import url('https://fonts.googleapis.com/css2?family=Oxanium:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');";
addStyle('tt-gauge-css', `${FONTS}
${GAUGE_CSS}
.tt-dice[data-ready]{background:none!important;border:0!important;padding:0!important;color:inherit;font:inherit;overflow:hidden}`);

// The views party/settings.json can pick (tt roll --ask). Only the gauge is built; bones arrives in step 4.
const VIEWS = { gauge: gaugeHtml };

function setUp(el) {
  const d = readData(el.querySelector('script[type="application/json"]')?.textContent ?? '');
  if (!d) return; // not a roll this module can draw: the element's own text stays
  el.dataset.ready = '';
  const draw = VIEWS[d.view] ?? gaugeHtml;
  const count = d.you + d.moment.dice;
  const memo = `tt-dice|${d.world ?? ''}|${d.id}`;
  const fromHeight = el.offsetHeight;

  const render = (html) => {
    el.innerHTML = html;
    const g = el.querySelector('.tg');
    if (g) fitZones(g);
  };
  // The panel opens from the fallback's height rather than jumping.
  const open = () => {
    if (reduced.matches || !fromHeight) return;
    const to = el.scrollHeight;
    el.style.height = `${fromHeight}px`;
    el.getBoundingClientRect();
    el.style.transition = 'height .32s cubic-bezier(.2,.7,.3,1)';
    el.style.height = `${to}px`;
    const done = () => { el.style.height = ''; el.style.transition = ''; };
    el.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 420); // a page in the background may never end the transition; the panel must not stay clipped
  };
  // Zone words are fitted to the width they get: again on resize, and once the display font has loaded.
  const refit = () => { const g = el.querySelector('.tg'); if (g) fitZones(g); };
  new ResizeObserver(refit).observe(el);
  document.fonts?.ready.then(refit);

  const statusHtml = (kind, text, line = '') => `<span class="tg-status ${kind}" role="status">${esc(text)}${line ? ` <code>${esc(line)}</code> <button type="button" data-copy>copy</button>` : ''}</span>`;
  // the result as tt settles it (resultOf), drawn landed
  const landed = (faces, frac, act, anim, was = null) => render(draw(d, resultOf(d, faces, frac, was), { anim, act }));

  // A roll tt threw: no button, already landed (the pour plays once, unless motion is reduced).
  if (d.result) {
    landed(d.result.dice, d.result.frac ?? null, statusHtml('', 'Thrown by the GM, as it fell'), reduced.matches ? 'none' : 'pour', d.result.landed ?? null);
    return open();
  }

  let before = null;
  try { before = JSON.parse(localStorage.getItem(memo) ?? 'null'); } catch { /* no storage: tt's id check still holds */ }
  if (Array.isArray(before)) before = { faces: before, frac: null }; // remembered before the quarter was thrown here
  if (before && Array.isArray(before.faces) && before.faces.length === count) {
    landed(before.faces, before.frac ?? null, statusHtml('ok', 'Thrown earlier; that result stands'), 'none');
    return open();
  }

  const throwLabel = `Throw<small>${count}d6${d.moment.dice > 1 ? ` · the ${d.moment.keep ?? 'better'} moment counts` : ''}</small>`;
  render(draw(d, null, { act: `<button type="button" class="tg-throw">${throwLabel}</button>` }));
  open();
  const button = el.querySelector('.tg-throw');
  button.addEventListener('click', async () => {
    button.disabled = true;
    const faces = Array.from({ length: count }, d6);
    const frac = needsFrac(d) ? fair(100) : null;
    if (!reduced.matches) {
      const dice = [...el.querySelectorAll('.tg-die')];
      dice.forEach((f) => f.classList.add('tumble'));
      for (const t0 = performance.now(); performance.now() - t0 < TUMBLE_MS;) {
        dice.forEach((f) => { f.classList.remove('blank'); f.querySelector('svg').innerHTML = dieFace(d6()); });
        await new Promise((r) => setTimeout(r, 70));
      }
    }
    try { localStorage.setItem(memo, JSON.stringify({ faces, frac })); } catch { /* as above */ }
    const line = sentLine(d, faces, frac);
    let act;
    try {
      sendPrompt(`${line}\n`); // the break keeps it apart from another widget's text in the same reply
      act = statusHtml('ok', 'Sent');
    } catch {
      act = statusHtml('bad', "Couldn't send. Type:", line);
    }
    landed(faces, frac, act, reduced.matches ? 'none' : 'pour');
    el.querySelector('[data-copy]')?.addEventListener('click', () => navigator.clipboard?.writeText(line));
  });
}

for (const el of document.querySelectorAll('.tt-dice:not([data-ready])')) setUp(el);
