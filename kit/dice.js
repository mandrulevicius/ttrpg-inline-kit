// The dice widget: he throws his own character's dice, and the roll is drawn as the Margin gauge (pane/gauge.js) on a
// dark instrument screen. `tt roll --ask` records the roll and prints this widget whole; the GM passes it to
// show_widget unchanged:
//   <div class="tt-dice" style="…">Andrew: climb the wet ladder fast<br><small>…</small><script type="application/json">{…}</script></div>
//   <script type="module" src="<kit base>kit/dice.js"></script>
// One click throws the you die(s), the moment die(s) and the quarter's chance (crypto-random), so the dice are final at
// the throw: they tumble and pour into the bar, the line ticks when crossed, the band word rises last. Then the push
// offer (v2 §6): "Take it", or a push that buys something new, previewed on the gauge as he points at it. His choice
// goes back through sendPrompt with the exact `tt roll --id … --dice … --frac … --push …`; a throw with nothing to
// buy goes at once. tt refuses a second result for an id: a widget drawn again after a chat reload would offer the
// button again, so this one remembers its throw (and whether its choice went) where it can. A roll tt threw itself (`tt roll … --show`) arrives landed, with no button. The
// element's own text, on the same dark screen, shows until this module runs, or if it never loads.
import { addStyle } from './style.js';
import { GAUGE_CSS, dieFace, fitZones } from '../pane/gauge.js';
import { esc, fair, gaugeHtml, needsFrac, offerHtml, pushOffers, readData, resultOf, sendStatus, sentLine } from './dice-view.js';

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

  const statusHtml = (kind, text) => `<span class="tg-status ${kind}" role="status">${esc(text)}</span>`;
  // The copy button: the clipboard where the sandbox allows it, else the line is selected for him to copy.
  const wireCopy = (line) => {
    const b = el.querySelector('[data-copy]');
    if (!b) return;
    b.addEventListener('click', () => {
      const pick = () => { getSelection()?.selectAllChildren(b.previousElementSibling); b.textContent = 'selected: copy it'; };
      if (!navigator.clipboard?.writeText) return pick();
      navigator.clipboard.writeText(line).then(() => { b.textContent = 'copied'; }, pick);
    });
  };
  // the result as tt settles it (resultOf), drawn landed
  const landed = (faces, frac, act, anim, was = null, push = 0) => render(draw(d, resultOf(d, faces, frac, was, push), { anim, act }));
  const remember = (v) => { try { localStorage.setItem(memo, JSON.stringify(v)); } catch { /* no storage: tt's id check still holds */ } };

  // His choice, sent: the throw and its push, drawn with the push in place, and the line always there to copy.
  const send = (faces, frac, push, anim) => {
    remember({ faces, frac, push, sent: true });
    const line = sentLine(d, faces, frac, push);
    const failed = () => { const s = el.querySelector('.tg-send'); if (s) { s.outerHTML = sendStatus('failed', line); wireCopy(line); } };
    let how = 'sent';
    try {
      // the break keeps it apart from another widget's text in the same reply; a host that answers with a promise
      // may still refuse it later
      const p = sendPrompt(`${line}\n`);
      if (p && typeof p.then === 'function') p.then(null, failed);
    } catch {
      how = 'failed';
    }
    landed(faces, frac, sendStatus(how, line), reduced.matches ? 'none' : anim, null, push);
    wireCopy(line);
  };

  // The offer: each push previews as outlined cells past the bar's end while he points at it or tabs to it.
  const offer = (faces, frac, offers, anim) => {
    const r = resultOf(d, faces, frac);
    landed(faces, frac, offerHtml(offers), reduced.matches ? 'none' : anim);
    const ghost = (n) => {
      const t = document.createElement('template');
      t.innerHTML = draw(d, r, { ghost: n });
      const now = el.querySelector('.tg-gauge');
      const next = t.content.querySelector('.tg-gauge');
      if (now && next) now.replaceWith(next);
      el.querySelector('.tg')?.classList.remove('pour'); // the arrival has played; a swapped gauge must not replay it
      refit();
    };
    for (const b of el.querySelectorAll('.tg-offer button')) {
      const n = Number(b.dataset.push);
      if (n) {
        b.addEventListener('pointerenter', () => ghost(n));
        b.addEventListener('focus', () => ghost(n));
        b.addEventListener('pointerleave', () => ghost(0));
        b.addEventListener('blur', () => ghost(0));
      }
      b.addEventListener('click', () => send(faces, frac, n, n ? 'push' : 'none'));
    }
  };

  // A roll tt threw: no button, already landed (the pour plays once, unless motion is reduced).
  if (d.result) {
    landed(d.result.dice, d.result.frac ?? null, statusHtml('', 'Thrown by the GM, as it fell'), reduced.matches ? 'none' : 'pour', d.result.landed ?? null, d.result.push ?? 0);
    return open();
  }

  let before = null;
  try { before = JSON.parse(localStorage.getItem(memo) ?? 'null'); } catch { /* no storage: tt's id check still holds */ }
  if (Array.isArray(before)) before = { faces: before, frac: null }; // remembered before the quarter was thrown here
  if (before && Array.isArray(before.faces) && before.faces.length === count) {
    const frac = before.frac ?? null;
    // thrown, but the choice never made (the chat reloaded on the offer): offer it again
    if (before.sent === false) offer(before.faces, frac, pushOffers(d, before.faces, frac), 'none');
    else {
      const push = Number.isInteger(before.push) ? before.push : 0;
      const line = sentLine(d, before.faces, frac, push);
      landed(before.faces, frac, sendStatus('earlier', line), 'none', null, push);
      wireCopy(line);
    }
    return open();
  }

  const counts = [d.you > 1 && 'the worst you die counts', d.moment.dice > 1 && `the ${d.moment.keep ?? 'better'} moment counts`].filter(Boolean);
  const throwLabel = `Throw<small>${[`${count}d6`, ...counts].join(' · ')}</small>`;
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
    const offers = pushOffers(d, faces, frac);
    if (!offers.length) return send(faces, frac, 0, 'pour'); // nothing a push could buy: no choice to make
    remember({ faces, frac, sent: false });
    offer(faces, frac, offers, 'pour');
  });
}

for (const el of document.querySelectorAll('.tt-dice:not([data-ready])')) setUp(el);
