// The dice's terms: for each, its icon, its name, a one-line summary and, where there is more to say, the fuller text.
// The one source for both the chat's dice widget (kit/dice.js) and the pane's gauge (gauge.js draws the icons, tips.js
// shows the summaries and the fuller text). The rules they summarise are rules/core.md (core.5, core.6) and the numbers
// src/strain.mjs STRAIN; a change there changes the words here. Pure: no DOM.

// Icons on a 16-unit grid, drawn in the gauge's instrument style: 1.5 strokes in the current colour, distinct by shape
// alone so they read without colour. Inner SVG only; icon() wraps them.
const F = 'fill="currentColor" stroke="none"';
export const ICONS = {
  // condition, as his face: alert, heavy-lidded, gone
  steady: `<circle cx="8" cy="8" r="6.5"/><circle cx="5.7" cy="7" r="1.15" ${F}/><circle cx="10.3" cy="7" r="1.15" ${F}/><path d="M4.4 4.6l2.4-.5M11.6 4.6l-2.4-.5M5.6 10.3q2.4 1.5 4.8 0"/>`,
  worn: `<circle cx="8" cy="8" r="6.5"/><path d="M4.1 7.5l3.3-.7M11.9 7.5l-3.3-.7" stroke-width="1.9"/><path d="M4.85 7.35a1.05 1.05 0 0 0 2.05-.3zM11.15 7.35a1.05 1.05 0 0 1-2.05-.3z" ${F}/><path d="M4.6 9.6q1.2.6 2.4 0M9 9.6q1.2.6 2.4 0M6 11.7h4"/>`,
  spent: `<g transform="rotate(-12 8 8)"><circle cx="8" cy="8" r="6.5"/><path d="M4.3 5.8l2.2 2.2M6.5 5.8L4.3 8"/><circle cx="10.6" cy="7.2" r="1.5"/><ellipse cx="8.2" cy="11.3" rx="1.7" ry="1.2"/><path d="M9.1 12.4v2"/></g>`,
  strain: '<path d="M1 8h2.2l1.4-4 2 8 2-8 2 8 1.4-4H15"/>',
  mark: '<path d="M3 13L13 3M4 10l2 2M7 7l2 2M10 4l2 2"/>',
  push: `<rect x="1.5" y="4.5" width="6" height="7" rx="1.2" ${F}/><path d="M10 8h5M12.5 5.5v5"/>`,
  line: '<path d="M4 1.5v13M4 2.5h8l-2 2.5 2 2.5H4"/>',
  person: '<path d="M1.2 8s2.5-4.4 6.8-4.4S14.8 8 14.8 8s-2.5 4.4-6.8 4.4S1.2 8 1.2 8z"/><circle cx="8" cy="8" r="1.9"/>',
  you: '<circle cx="8" cy="4.8" r="2.6"/><path d="M3 14.5c0-3 2.2-5 5-5s5 2 5 5"/>',
  moment: '<path d="M8 1.5l1.5 5 5 1.5-5 1.5-1.5 5-1.5-5-5-1.5 5-1.5z"/>',
  adv: `<g opacity=".4"><rect x=".75" y="4.5" width="6.5" height="6.5" rx="1.3"/><circle cx="4" cy="7.75" r=".8" ${F}/></g><path d="M.5 11.5l7-7.5"/><rect x="8.75" y="4.5" width="6.5" height="6.5" rx="1.3"/><path d="M10.9 6.3v0M13.1 6.3v0M10.9 7.75v0M13.1 7.75v0M10.9 9.2v0M13.1 9.2v0" stroke-width="1.4"/>`,
  dis: `<rect x=".75" y="4.5" width="6.5" height="6.5" rx="1.3"/><circle cx="4" cy="7.75" r=".9" ${F}/><g opacity=".4"><rect x="8.75" y="4.5" width="6.5" height="6.5" rx="1.3"/><path d="M10.9 6.3v0M13.1 6.3v0M10.9 7.75v0M13.1 7.75v0M10.9 9.2v0M13.1 9.2v0" stroke-width="1.4"/></g><path d="M8.5 11.5l7-7.5"/>`,
  stat: `<rect x="1.5" y="5" width="4.5" height="6" rx="1" ${F}/><rect x="7" y="5" width="4.5" height="6" rx="1" ${F}/><path d="M13 5.5l2 2.5-2 2.5"/>`,
  expert: '<path d="M8 1.5L14.5 8 8 14.5 1.5 8z"/><circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none"/>',
  gear: '<path d="M2.6 13.4l5.6-5.6"/><path d="M8.2 7.8a3.6 3.6 0 0 1 4.6-5.1l-2.1 2.1.4 1.9 1.9.4 2.1-2.1a3.6 3.6 0 0 1-5.1 4.6"/>',
  prep: '<rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M4.8 8.2l2.2 2.2 4.2-4.6"/>',
  wound: '<path d="M6 1.8h4V6h4.2v4H10v4.2H6V10H1.8V6H6z"/>',
  called: '<circle cx="8" cy="8" r="5"/><path d="M8 1v4M8 11v4M1 8h4M11 8h4"/>',
  load: '<path d="M4.8 6.5h6.4l2.3 7.5H2.5z"/><path d="M6.2 6.5V5a1.8 1.8 0 0 1 3.6 0v1.5"/>',
  forecast: '<path d="M2 14.5V10M6 14.5V3.5M10 14.5V6.5M14 14.5V11"/>',
  extra: `<path d="M8 1.5l1.9 4.1 4.5.5-3.3 3.1.9 4.4L8 11.4l-4 2.2.9-4.4-3.3-3.1 4.5-.5z" ${F}/>`,
  quarter: `<rect x="2.5" y="2.5" width="11" height="11" rx="1.5" stroke-dasharray="2.2 1.6"/><rect x="2.5" y="2.5" width="5.5" height="11" rx="1" ${F}/>`,
  take: '<path d="M3 8.5l3.2 3.2L13 4.5"/>',
};

// Which die of a group counts, drawn from dice rather than a sign: the one that counts plain, the rest dim and struck as
// a die set aside is. The lowest: the kept die shows a 1, first, the others a 6; the highest the other way round, the
// kept die last. n dice, each 10 units.
const PIPS = { 1: [[5, 5]], 6: [[2.8, 2.6], [7.2, 2.6], [2.8, 5], [7.2, 5], [2.8, 7.4], [7.2, 7.4]] };
export function keepSvg(n, low) {
  const die = (x, face, kept) => `<g transform="translate(${x} .75)"${kept ? '' : ' opacity=".4"'}><rect x=".5" y=".5" width="9.5" height="9.5" rx="2"/>`
    + `${PIPS[face].map(([cx, cy]) => `<circle cx="${cx + 0.25}" cy="${cy + 0.25}" r="${face === 1 ? 1.2 : 0.95}" fill="currentColor" stroke="none"/>`).join('')}</g>`
    + (kept ? '' : `<path d="M${x} 10.5L${x + 10.5} 1"/>`);
  const dice = Array.from({ length: n }, (_, i) => {
    const kept = low ? i === 0 : i === n - 1;
    return die(i * 13, kept === low ? 1 : 6, kept);
  }).join('');
  return `<svg class="keep" viewBox="0 0 ${n * 13 - 2.5} 12" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">${dice}</svg>`;
}

// An icon, sized by the surrounding text (1em) unless the CSS says otherwise; hidden from screen readers, which get the
// words from the element it sits in.
export const icon = (key, cls = '') => (ICONS[key]
  ? `<svg class="ti${cls ? ` ${cls}` : ''}" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[key]}</svg>`
  : '');

// Each term: icon (a key of ICONS, or none for a zone, which the gauge draws), name, tip (one line, shown on hover, focus
// or tap) and more (the fuller text, opened by a click; [[key]] names another term, drawn as its icon and name and
// itself pointable).
export const TERMS = {
  line: { icon: 'line', name: 'the line', tip: 'What the moment demands. Reach it and you succeed; how far past or short decides how well.',
    more: 'It starts at the task\'s rung, easy 5 up to impossible 15, or against a person at 7 plus their stat. [[load]] pushes it right; help from the world pulls it left. Your bar fills from your [[stat]] and what you bring, then your dice.' },
  person: { icon: 'person', name: 'a person as the line', tip: 'You\'re up against someone: their stat sets the line, and you can\'t see exactly where it is until the throw.' },
  stat: { icon: 'stat', name: 'your stat', tip: 'Where your bar starts.' },
  expert: { icon: 'expert', name: 'expertise', tip: '+1 where your field applies.' },
  gear: { icon: 'gear', name: 'gear', tip: 'Something you carry that helps: it adds to your bar.' },
  prep: { icon: 'prep', name: 'preparation', tip: 'What you did or said to set it up: it adds to your bar.' },
  wound: { icon: 'wound', name: 'a hurt you carry', tip: 'A wound or a mark: it weighs on the rolls it touches, drawn as load in your colour.' },
  load: { icon: 'load', name: 'load', tip: 'The world on the line: it pushes the line right, or in your favour pulls it left.' },
  called: { icon: 'called', name: 'a called shot', tip: 'Aiming at one place puts 2 more on the line; past it, the margin is how badly they\'re hurt.' },
  quarter: { icon: 'quarter', name: 'a part-cell', tip: 'A fraction of a cell lands as a whole one by its share: a ½ lands one time in two.' },
  forecast: { icon: 'forecast', name: 'your read', tip: 'How you judge your odds: the shape over the zones is tallest where the throw most likely lands.' },
  you: { icon: 'you', name: 'the you die', tip: 'You on the day. Strain throws more of them, and the lowest counts.' },
  moment: { icon: 'moment', name: 'the moment die', tip: 'Luck. A second chance throws another, and the better counts.' },
  adv: { icon: 'adv', name: 'a second chance', tip: 'Another moment die: the higher counts.' },
  dis: { icon: 'dis', name: 'a bad break', tip: 'Another moment die: the lower counts.' },
  strain: { icon: 'strain', name: 'strain', tip: 'How hard you\'ve driven yourself. At 3 you throw two you dice, at 6 three, and the lowest counts.',
    more: 'Pushes fill it, and so do blows to body or nerve. It eases a cell an hour, and sleep clears it; but after 18 hours awake it can\'t ease below 3, after 24 not below 6. A [[push]] past 6 still lands, and each cell over leaves a [[mark]]: a lasting hurt named from the effort (a torn shoulder, a migraine for days), −1 to the rolls it touches until it heals, in about a week.' },
  steady: { icon: 'steady', name: 'steady', tip: 'One you die.' },
  worn: { icon: 'worn', name: 'worn', tip: 'Two you dice; the lower counts.' },
  spent: { icon: 'spent', name: 'spent', tip: 'Three you dice; the lowest counts.' },
  mark: { icon: 'mark', name: 'a mark', tip: 'Each point past 6 leaves one: a lasting hurt named from the effort, −1 to the rolls it touches, healing in about a week.' },
  push: { icon: 'push', name: 'a push', tip: 'Add to your total after the throw, paid in strain; each point costs more than the last.',
    more: '+1 costs 1 [[strain]], +2 costs 3, +3 costs 6, +4 costs 10. It buys the next zone up; past exceptional, an [[extra]] for every 2 more; on a failure, a lesser one.' },
  extra: { icon: 'extra', name: 'an extra', tip: 'Past exceptional, every 2 more buys one: time saved, a second effect, an edge on what follows.' },
  // the zones (drawn on the gauge; no icon of their own)
  disaster: { name: 'disaster', tip: 'No, and something worse happens.' },
  failure: { name: 'failure', tip: 'No, and the situation moves against you.' },
  near: { name: 'near miss', tip: 'Not quite: a way on at a price, or you see why.' },
  cost: { name: 'success at a cost', tip: 'You get it, and pay: noise, time, a graze, gear, a debt.' },
  solid: { name: 'solid success', tip: 'What you wanted, cleanly.' },
  exceptional: { name: 'exceptional', tip: 'What you wanted, and more.' },
  miss: { name: 'miss', tip: 'It misses you.' },
  graze: { name: 'graze', tip: 'Pain, nothing lasting.' },
  'hurt-wound': { name: 'wound', tip: '−1 to rolls that use the place; it bleeds until tended.' },
  maimed: { name: 'maimed', tip: 'The place is useless and bleeds badly; it needs care within hours.' },
  destroyed: { name: 'destroyed', tip: 'Gone, or dying unless saved now. Past it, an organ or a second place.' },
};

// [[key]] in a term's fuller text, as that term's icon and name, pointable for its own summary.
export const linkTerms = (text, esc) => esc(text).replace(/\[\[([a-z-]+)\]\]/g, (_, k) => (TERMS[k]
  ? `<span class="tg-term" data-term="${k}" tabindex="0">${icon(TERMS[k].icon)}${esc(TERMS[k].name)}</span>` : k));
