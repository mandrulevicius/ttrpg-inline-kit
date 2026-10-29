# Portraits: frame sets, live sets and the player

The contract between the pipelines that make portraits and the games that show them. Every pipeline writes this format; `player/` reads it and plays it in any game's dialogue window.

## Frame sets

One NPC can have several frame sets, one per pipeline: `assets/<consumer>/<npc-id>/<pipeline>/` (e.g. `assets/ttrpg/npc.odile-fenn/painted-pixel/`). A game names the set it shows by that path below `assets/<consumer>/`, so choosing a look is choosing a folder.

A folder holds PNGs and a `meta.json`:

| Field | Meaning |
|---|---|
| `id`, `name`, `pipeline` | The NPC's id and name, and the pipeline that made the set |
| `size` | `[w, h]` of every frame, in art pixels |
| `frames` | `{name: file}`. `neutral` is required; the player uses `look` (eyes on the listener), `warm`, `angry`, `afraid`, `blink_half`, `blink_closed`, `talk_a`, `talk_b` when present. A missing expression plays neutral; missing blink or talk frames mean no blinks or flaps |
| `regions` | `eyes` and `mouth` as `{x, y, w, h}`: every pixel a blink or talk frame changes lies inside them. The player overlays only the pixels that differ from neutral, so a blink keeps the expression's brows |
| `icons` | `low` and `medium`: `{file, size, from}`, still icons for small places (a map token, a list; a card). `from` is the `[x, y, w, h]` of the frame they were reduced from |
| `palette`, `roles`, `source`, `base` | The pipeline's own (optional) |

Every frame is a whole picture at `size`, aligned with the others. Pixel art is shown only at whole-number scales with nearest-neighbour sampling.

**Baked or played.** Pixel reduction is the pipeline's: icons are drawn at their size there, where their crispness is judged, never scaled down at playback. Display effects are the opposite: a CRT look (scanlines, glow, curvature), the emotion tint and motion happen at playback, on top of any source, switchable per game, and are never baked into a set.

## Live sets

A set the player draws each frame instead of from pictures, so expressions blend continuously and the head turns: same folder layout (`assets/<consumer>/<npc-id>/<pipeline>/`, e.g. `npc.odile-fenn/vector-faces/`), and a game names it the same way. Its `meta.json` says so:

| Field | Meaning |
|---|---|
| `kind`, `renderer` | `"live"`, and which of the player's sources draws it (`"vector"`: `sources/vector.js`) |
| `size`, `scale`, `smooth` | `[w, h]` of the still in art px; its PNGs hold `scale` image px per art px; `smooth`: not pixel art, so scale it smoothly at any size |
| `frames` | `neutral` only: the still a host shows until the face plays (any crop of it, like a frame set's) |
| `regions`, `icons` | As for a frame set: eyes and mouth for `headBox`, the low and medium icons |
| `view`, `face` | The renderer's own: the portrait-space box the still shows, and the face descriptor it draws from (for vector, parsed from the NPC's `appearance`) |

The live source draws the renderer's high level at the canvas's resolution for the window asked for; the motion is its own (expressions easing to the tone, blinks, saccades, a turn away in a pause; see the header of `sources/vector.js`). The renderer's modules sit under `sources/vector/`, copied there by the vector pipeline's `bin/export.mjs`; edit them in `pipelines/vector-faces/src/`, and `player/test/live.test.js` fails while a copy differs. Measured in the TTRPG pane (one 112 px close-up at 1 device px per art px): the page holds 57-60 fps while a line plays, and the face renders 35 new frames a second on a soft line and 51 on a rough one, about 5 ms each to build and decode; a still settles and stops rendering.

## The player

`player/portrait.js` is a standalone ES module (no dependencies, no game code); `tone.js` is its pure logic, tested with `node --test "player/test/*.test.js"` from the Artroom root.

```js
import { loadPortrait, animateText, colourOf, headBox, loadMeta, stillView } from '/art/player/portrait.js';

const url = '/art/assets/ttrpg/npc.odile-fenn/painted-pixel/';  // or .../vector-faces/: loadPortrait reads which kind
const still = stillView(url, await loadMeta(url), { head: 112 }); // { src, x, y, w, h, W, H, smooth }: what to show unplayed
const p = await loadPortrait(url, { crop: [still.x, still.y, still.w, still.h], effects: [] });
box.append(p.canvas); p.fit(104);                     // canvas at art size; fit() picks the whole-number scale (any, if smooth)
p.play({ emotion: 'angry', intensity: 0.8, text: 'Get off my deck.' });   // loops until stop()
p.stop();                                              // eases back to the still neutral
const undo = animateText(lineEl, { intensity: 0.8 });  // the words move by the same tone; undo() restores them
bubble.style.borderColor = colourOf('angry');          // the emotion's colour, for the host's tint or glow
```

- **Tone.** `emotion` is a word: a family (`neutral`, `warm`, `angry`, `afraid`, `sad`, `cold`, `curious`) or one of its words (`furious` is angry); anything else is neutral. Each family has an expression frame and a colour (`EMOTIONS` in `tone.js`); sad and cold play the neutral frame in their own colour, curious plays `look`. `intensity` 0..1 sets the motion: low is soft and slow (long crossfades, slow flaps, a one-pixel breath), high is rough and fast (hard cuts, quick flaps, a small shake). `text` sets the talk rhythm: the mouth opens on letters and shuts on spaces and punctuation. No text: the face only listens (blinks, a glance at the listener and away).
- **Stills.** A portrait moves only while played; `still(emotion)` shows an expression without motion. With `prefers-reduced-motion` play shows the still and text does not move.
- **Sources.** A Portrait draws from a source: `{ width, height, frames, draw(g, state) }`, plus for a live one `live`, `scale` (canvas px per art px), `smooth`, `settled` and an `onFrame` the Portrait sets. `loadPortrait` makes either from a set's `meta.json`; `loadFrameSet(url, { crop })` makes a frame set's directly, and any live renderer can be passed to `new Portrait(source)` behind the same `play`/`stop`. Each `state` from `timeline().at(ms)` carries frame names for a frame set and the same as numbers for a live source: `mix` (the crossfade), `blink` and `open` (0..1), `dx`/`dy` (motion, art px), and `emotion` (the family) and `intensity`, so a live source can show sad and cold in their own way; `playing` is true while a line plays. A live source is drawn every frame while playing and afterwards until it reports `settled`.
- **Dialogue windows.** `dialogue.js` holds what a host needs around the player: `portraitCache()` (each set and window loaded once), `linePlayer()` (one line at a time: its words move, its face plays, the given elements take the emotion's colour as `--emo` and a class; a face that loads after its line ended never plays) and `placeBeside(box, rect)` for a pop-out. The host keeps only its own selectors.
- **Effects.** `effects: [(g, state, portrait) => ...]` run after every draw, for a game's own display look; none ship yet.
- **Loading.** Same-origin URLs, or CORS-enabled ones (jsDelivr is): frames are requested with CORS, because the blink and talk overlays read their pixels. A host that sends no CORS headers fails to load them at all. If pixels still can't be read, the overlays fall back to the region boxes.
