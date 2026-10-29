// What a dialogue window needs around the player, beyond one portrait: live portraits loaded once each, one spoken
// line playing at a time while it is hovered, and a pop-out placed beside what it enlarges. No game code and no
// selectors: the host says which element is a line, whose face plays it and where that face sits.
import { animateText, colourOf, loadPortrait } from './portrait.js';

// Live portraits by set and window, each loaded once; a failed load is forgotten, so a later ask retries.
// get(url, crop) -> Promise<Portrait>.
export function portraitCache() {
  const live = new Map();
  return {
    get(url, crop) {
      const key = `${url}|${crop ?? ''}`;
      if (!live.has(key)) live.set(key, loadPortrait(url, { crop }).catch((e) => { live.delete(key); throw e; }));
      return live.get(key);
    },
  };
}

// One line playing at a time. play({ line, tone, face, host, tint }): `line` is the element whose words move by the
// tone ({ emotion, intensity, text }), `face` a Promise of the speaker's Portrait (or null: the words alone), `host`
// the element its canvas goes into, `tint` the elements that take the emotion's colour (as the CSS variable --emo and
// the class `lit`, or the name given). stop() puts it all back and eases the face to still. A face that finishes loading
// after its line was stopped or replaced never plays.
export function linePlayer({ lit = 'lit' } = {}) {
  let on = null;
  function stop() {
    if (!on) return;
    on.face?.stop();
    on.undo();
    for (const el of on.tint) { el.classList.remove(lit); el.style.removeProperty('--emo'); }
    on = null;
  }
  async function play({ line, tone, face = null, host = null, tint = [] }) {
    stop();
    const mine = { line, face: null, tint: tint.filter(Boolean), undo: animateText(line, tone) };
    on = mine;
    const colour = colourOf(tone.emotion);
    for (const el of mine.tint) { el.style.setProperty('--emo', colour); el.classList.add(lit); }
    if (!face || !host) return;
    let p;
    try { p = await face; } catch { return; }
    if (on !== mine) return;
    mine.face = p;
    if (p.canvas.parentElement !== host) host.append(p.canvas);
    p.play(tone);
  }
  return { play, stop, get line() { return on?.line ?? null; } };
}

// Places a position:fixed box beside an anchor's rect: to its right when it fits, else its left, kept `margin` px
// inside the viewport. The box must be shown (it is measured).
export function placeBeside(box, rect, { gap = 10, margin = 8 } = {}) {
  const w = box.offsetWidth;
  const h = box.offsetHeight;
  const x = rect.right + gap + w < innerWidth - margin ? rect.right + gap : Math.max(margin, rect.left - gap - w);
  box.style.left = `${Math.round(x)}px`;
  box.style.top = `${Math.round(Math.min(Math.max(margin, rect.top), innerHeight - h - margin))}px`;
}
