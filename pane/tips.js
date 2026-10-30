// Disclosure in levels for the dice gauge (ui-principles: "Disclose in levels"): pointing at, focusing or tapping a term
// shows a one-line tip; clicking one with more to say opens a non-modal popout anchored beside it, whose own terms are
// pointable in turn. Both are drawn inside the gauge's box (.tg), because the chat's widget frame clips anything past
// it. Shared by the chat's dice widget (kit/dice.js) and the pane's Story column (teller.js).
//
// A target is any element with data-tip="<glossary key>" (pane/glossary.js). Optional: data-why, the reason behind it in
// words (the flavour, shown first); data-line, a one-line summary in place of the glossary's; data-hl, the gauge cells
// it made (cells carry data-k), lit while its tip shows. A target that is itself an action (data-act) never opens a
// popout: its click is its action.
import { TERMS, icon, linkTerms } from './glossary.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const GAP = 6;
const EDGE = 4;
let seq = 0;
const wired = new WeakMap(); // container → its controls, so wiring twice adds no second set of listeners

// Places box inside root next to the target: above it if it fits (a popout: below), else the other side, else as near
// as the root allows.
function place(box, el, root, below) {
  const r = root.getBoundingClientRect();
  box.style.maxWidth = `${Math.max(160, Math.min(below ? 320 : 280, r.width - 2 * EDGE))}px`;
  box.style.left = '0px';
  box.style.top = '0px';
  const a = el.getBoundingClientRect();
  const w = box.offsetWidth;
  const h = box.offsetHeight;
  const up = a.top - r.top - h - GAP;
  const down = a.bottom - r.top + GAP;
  const fitsUp = up >= EDGE;
  const fitsDown = down + h <= r.height - EDGE;
  let top = below ? (fitsDown || !fitsUp ? down : up) : (fitsUp || !fitsDown ? up : down);
  top = Math.max(EDGE, Math.min(top, r.height - h - EDGE));
  const left = Math.max(EDGE, Math.min(a.left - r.left + a.width / 2 - w / 2, r.width - w - EDGE));
  box.style.left = `${Math.round(left)}px`;
  box.style.top = `${Math.round(top)}px`;
}

function tipHtml(el) {
  const term = TERMS[el.dataset.tip] ?? {};
  // an action's tip is one short line: its own preview (the gauge, the meter) is the explanation, and must stay in view
  if ('act' in el.dataset) return `<span class="tg-tip-h">${icon(term.icon)}<span>${esc(el.dataset.line ?? term.tip ?? '')}</span></span>`;
  const why = el.dataset.why;
  const line = el.dataset.line ?? term.tip ?? '';
  const head = why ? esc(why) : esc(term.name ?? '');
  const more = term.more && !('act' in el.dataset) ? '<span class="tg-tip-more">click for more</span>' : '';
  return `<span class="tg-tip-h">${icon(term.icon)}<span>${head}</span></span>${line && line !== head ? `<span class="tg-tip-l">${esc(line)}</span>` : ''}${more}`;
}

// Wires every target inside container (a widget, or the pane's story column) by delegation, so targets drawn later
// need nothing. Returns { hide }, which puts away whatever is showing (before the caller redraws).
export function wireTips(container) {
  if (wired.has(container)) return wired.get(container);
  let tip = null;
  let tipFor = null;
  let pop = null;
  let popFor = null;
  let timer = 0;
  let pointer = 'mouse';

  const targetOf = (e) => {
    const t = e.target instanceof Element ? e.target.closest('[data-tip]') : null;
    return t && container.contains(t) && t.closest('.tg') ? t : null;
  };
  const light = (el, on) => {
    const k = el?.dataset.hl;
    if (!k) return;
    for (const c of el.closest('.tg').querySelectorAll('[data-k]')) if (c.dataset.k.split(' ').includes(k)) c.classList.toggle('hl', on);
  };

  function hide() {
    clearTimeout(timer);
    light(tipFor, false);
    tip?.remove();
    tip = null;
    tipFor = null;
  }
  function show(el) {
    if (tipFor === el || !el.isConnected) return;
    hide();
    const root = el.closest('.tg');
    tip = document.createElement('div');
    tip.className = 'tg-tip';
    tip.setAttribute('role', 'tooltip');
    tip.innerHTML = tipHtml(el);
    root.append(tip);
    place(tip, el, root, false);
    tipFor = el;
    light(el, true);
  }
  function closePop() {
    popFor?.setAttribute('aria-expanded', 'false');
    pop?.remove();
    pop = null;
    popFor = null;
  }
  function openPop(el) {
    const key = el.dataset.tip;
    const term = TERMS[key];
    closePop();
    hide();
    const root = el.closest('.tg');
    pop = document.createElement('div');
    pop.className = 'tg-pop';
    pop.id = `tg-pop-${++seq}`;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', term.name);
    const why = el.dataset.why ? `<p class="tg-pop-why">${esc(el.dataset.why)}</p>` : '';
    pop.innerHTML = `<div class="tg-pop-h">${icon(term.icon)}<b>${esc(term.name)}</b><button type="button" class="tg-pop-x" aria-label="Close">×</button></div>${why}<p>${esc(term.tip)}</p><p>${linkTerms(term.more, esc)}</p>`;
    root.append(pop);
    place(pop, el, root, true);
    pop.querySelector('.tg-pop-x').addEventListener('click', () => { const back = popFor; closePop(); back?.focus(); });
    popFor = el;
    el.setAttribute('aria-expanded', 'true');
    el.setAttribute('aria-controls', pop.id);
  }

  container.addEventListener('pointerdown', (e) => { pointer = e.pointerType || 'mouse'; }, true);
  container.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const t = targetOf(e);
    if (!t || t === tipFor) return;
    clearTimeout(timer);
    timer = setTimeout(() => show(t), tip ? 0 : 80); // moving along a row of terms shows each at once
  });
  container.addEventListener('pointerout', (e) => {
    if (e.pointerType === 'touch') return;
    const t = targetOf(e);
    if (!t || (e.relatedTarget instanceof Node && t.contains(e.relatedTarget))) return;
    clearTimeout(timer);
    if (tipFor === t) hide();
  });
  container.addEventListener('focusin', (e) => { const t = targetOf(e); if (t && pointer !== 'touch') show(t); });
  container.addEventListener('focusout', (e) => { const t = targetOf(e); if (t && tipFor === t) hide(); });
  container.addEventListener('click', (e) => {
    const t = targetOf(e);
    if (!t) return;
    if ('act' in t.dataset) return; // its own action handles it (an offer button previews and sends)
    if (TERMS[t.dataset.tip]?.more) {
      e.preventDefault();
      if (popFor === t) closePop();
      else openPop(t);
    } else if (pointer === 'touch') {
      // a tap stands in for hover: it shows the tip, and a second tap (or one elsewhere) puts it away
      if (tipFor === t) hide();
      else show(t);
    }
  });
  // A click or tap anywhere else puts both away; so does Escape.
  document.addEventListener('pointerdown', (e) => {
    const inside = (box) => box && e.target instanceof Node && box.contains(e.target);
    if (pop && !inside(pop) && !inside(popFor)) closePop();
    if (tip && e.pointerType === 'touch' && !inside(tipFor)) hide();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (tip) hide();
    else if (pop) { const back = popFor; closePop(); back?.focus(); }
  });
  const controls = { hide: () => { hide(); closePop(); } };
  wired.set(container, controls);
  return controls;
}
