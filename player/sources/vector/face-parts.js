// Generated from pipelines/vector-faces/src/face-parts.js by pipelines/vector-faces/bin/export.mjs: edit the source, then re-run it.
// The parts library for faces.js: hand-designed shapes that make faces differ by design, not only by sliders.
// Plain data; faces.js interprets it. face-parse.js picks a part when the appearance text names it (`match`; the
// first cut in this order whose match fits wins, so a cut named by length comes before one named by texture);
// otherwise normalize() picks one by the NPC's seed from those that fit its parsed style and sex.
//
// HAIR: a cut, drawn on the viewer's right half and mirrored. A point is [x, at, dy, xv, yv, rec]:
//   x   across, in head half-widths from the centre line (1 is the face's edge seen from the front)
//   at  a height on the face: top (crown of the skull), hl (hairline), brow, eye, earTop, earBot, mouth, chin,
//       shoulder (below the chin), len (the hair's own length: between mouth and shoulder by the NPC's `len`)
//   dy  px below that height
//   xv, yv  how far the point moves per px of hair volume (the NPC's volume times the cut's `vol`): xv out, yv down
//           (so a crown that rises with volume has a negative yv)
//   rec how far it moves down as the hairline recedes (temples recede first)
// Fields:
//   for       the parsed styles (face-parse's hair.style) the cut can serve
//   match     appearance text that names it (tested against the lower-cased text)
//   sex       pick weights when nothing names a cut: { m, f, x }; missing is 0
//   vol       hair thickness in px at volume .5
//   outer     the mass's outside, from the crown down the side to its lowest point
//   hairline  the inside edge, from that lowest point up to the centre; the last point is where the parting sits
//   side      the edge round the side of the head: 'short' (sideburn, over the ear, down to the nape) or 'hang'
//             (along the bottom of hanging hair)
//   flow      the strands: 'part' (from the parting), 'back' (combed back from the hairline), 'locs', 'coils'
//   swoop     extra volume on the side away from the parting (0..1), for a cut combed across
//   partAt    the least a parting sits off-centre (|part|, in tenths of W), for a cut that has one
//
// To add a cut: copy the nearest one, give it a new key, change its points, and render it with
//   node bin/faces-sheet.mjs --levels low,medium,high --turns=-0.8,0,0.8 <npc-id-part>
// To try it on an NPC, give the NPC file `"face": { "hair": { "cut": "<key>" } }` (face-parse merges it over the parse).
// Keep the outline's points few (five to seven): the spline rounds them, and each is bent round the turned head.
//
// NOSE: the nose's side profile, which is what shows on the outline of a turned head. A point is [t, z]: t runs from
// the top of the bridge (0) to the tip (1) and on under it to where it meets the lip (about 1.3); z is how far it
// stands out, as a share of the nose's length. `w` scales its width. Picked by face-parse's nose.bridge.

export const HAIR = {
  // short and practical, close at the sides: flattened by a helmet, a working cut
  crop: {
    for: ['short'], match: /cut short|short and practical|practical|cropped|close-cropped|flattened by a helmet/, sex: { m: 1, f: 2, x: 1 },
    vol: 1.8, side: 'short', flow: 'part',
    outer: [[0, 'top', 0, 0, -1], [.6, 'top', 3, .35, -.8], [.9, 'top', 18, .9, -.3], [.99, 'eye', -12, .8, 0], [.97, 'eye', -5, .5, 0]],
    hairline: [[.92, 'eye', -6], [.94, 'eye', -13], [.8, 'hl', 5, 0, 0, 12], [.45, 'hl', 2.5, 0, 0, 4], [0, 'hl', 0]],
  },
  // swept back with product: lift over the forehead, tight at the sides, a slight widow's peak
  slick: {
    for: ['short', 'medium'], match: /swept back|slicked|with product|oiled (?:straight )?back|combed back|brushed back/, sex: { m: 2, f: .5, x: 1 },
    vol: 3.2, side: 'short', flow: 'back',
    outer: [[0, 'top', 0, 0, -1.1], [.38, 'top', 0, .3, -1.2], [.75, 'top', 6, .6, -.6], [.95, 'top', 20, .6, -.2], [.98, 'eye', -12, .4, 0], [.96, 'eye', -6, .3, 0]],
    hairline: [[.92, 'eye', -7], [.93, 'eye', -13], [.78, 'hl', 7, 0, 0, 12], [.42, 'hl', 2], [.14, 'hl', 1], [0, 'hl', 2.6]],
  },
  // a classic side parting, combed across: fuller on the far side of the parting
  'side-part': {
    for: ['short'], match: /side part|parted on the|neat side/, sex: { m: 3, f: 1, x: 1 },
    vol: 2.6, side: 'short', flow: 'part', swoop: .55, partAt: .55,
    outer: [[0, 'top', 0, 0, -1], [.55, 'top', 2, .4, -.9], [.88, 'top', 15, 1, -.45], [1, 'eye', -12, .9, 0], [.98, 'eye', -5, .6, 0]],
    hairline: [[.92, 'eye', -6], [.94, 'eye', -13], [.8, 'hl', 6, 0, 0, 12], [.45, 'hl', 3.5, 0, 0, 4], [0, 'hl', 0]],
  },
  // short and unkempt: an uneven outline that never sits like a helmet
  tousled: {
    for: ['short', 'curly'], match: /messy|unkempt|tousled|tangled|windblown|untidy|wild/, sex: { m: 2, f: 1, x: 1 },
    vol: 3, side: 'short', flow: 'part',
    outer: [[0, 'top', 0, 0, -1.25], [.3, 'top', 1, .2, -1.45], [.56, 'top', 2, .5, -1.05], [.76, 'top', 8, .95, -.95], [.94, 'top', 19, 1.15, -.4], [1.01, 'eye', -11, 1, 0], [.99, 'eye', -3, .75, 0]],
    hairline: [[.92, 'eye', -4], [.94, 'eye', -12], [.78, 'hl', 6, 0, 0, 12], [.5, 'hl', 5], [.2, 'hl', 3], [0, 'hl', 4]],
  },
  // a chin-length bob: full at the sides, its ends turned in under the jaw
  bob: {
    for: ['medium'], match: /\bbob\b|chin-?length|jaw-?length|at the jaw/, sex: { f: 3, m: .3, x: 1 },
    vol: 4, side: 'hang', flow: 'part',
    outer: [[0, 'top', 0, 0, -1], [.62, 'top', 2, .45, -.8], [.95, 'top', 18, 1.05, -.3], [1.04, 'eye', -4, 1, 0], [1.03, 'mouth', 0, .9, 0], [.9, 'chin', 2, .7, 0]],
    hairline: [[.78, 'chin', 0], [.86, 'mouth', -4], [.88, 'eye', -4], [.8, 'hl', 6, 0, 0, 12], [.45, 'hl', 3], [0, 'hl', -1]],
  },
  // straight to the shoulders, falling from the crown and framing the face
  'straight-long': {
    for: ['medium', 'long'], match: /straight [\w-]* ?hair|straight hair|to the shoulders|shoulder-?length|long, loose|long hair/, sex: { f: 3, m: .5, x: 1 },
    vol: 3, side: 'hang', flow: 'part',
    outer: [[0, 'top', 0, 0, -1], [.6, 'top', 2, .4, -.8], [.92, 'top', 18, 1, -.3], [1, 'eye', -8, .9, 0], [1.02, 'eye', 12, .8, 0], [1.04, 'len', 0, .7, 0]],
    hairline: [[.84, 'len', 0], [.86, 'eye', 8], [.88, 'eye', -4], [.8, 'hl', 6, 0, 0, 12], [.45, 'hl', 3], [0, 'hl', -1]],
  },
  // locs pulled back and tied at the crown: the mass close to the skull
  'locs-tied': {
    for: ['locs'], match: /locs tied|tied back|pulled back|tied up/, sex: { m: 1, f: 1, x: 1 },
    vol: 4.5, side: 'short', flow: 'locs',
    outer: [[0, 'top', 0, 0, -1], [.6, 'top', 2, .4, -.8], [.92, 'top', 18, .9, -.3], [.98, 'eye', -9, .7, 0], [.96, 'eye', -3, .5, 0]],
    hairline: [[.9, 'eye', -3], [.92, 'eye', -11], [.78, 'hl', 5, 0, 0, 12], [.45, 'hl', 3], [0, 'hl', 0]],
  },
};

export const NOSE = {
  straight: { w: 1, profile: [[0, .15], [.5, .55], [.9, .95], [1, 1], [1.15, .55], [1.3, 0]] },
  // a high bridge with a bump, the tip hanging
  hooked: { w: .95, profile: [[0, .2], [.35, .7], [.55, .82], [.8, .9], [1, 1], [1.12, .6], [1.3, 0]] },
  // set crooked: a kink below the bridge
  broken: { w: 1.05, profile: [[0, .15], [.35, .55], [.45, .5], [.75, .82], [1, 1], [1.15, .55], [1.3, 0]] },
  // broad and flat: a low bridge, the tip and wings carry it
  flat: { w: 1.25, profile: [[0, .05], [.4, .22], [.75, .55], [1, .82], [1.15, .5], [1.3, 0]] },
  // a round tip on a modest bridge
  bulbous: { w: 1.15, profile: [[0, .1], [.5, .45], [.8, .85], [1, 1], [1.2, .65], [1.35, 0]] },
  // short and turned up
  button: { w: .9, profile: [[0, .08], [.5, .35], [.85, .8], [1, .9], [1.1, .45], [1.25, 0]] },
};

/** The cut a text names for this style, or null. */
export function hairCutFor(text, style) {
  for (const [key, part] of Object.entries(HAIR)) if (part.for.includes(style) && part.match && part.match.test(text)) return key;
  return null;
}
