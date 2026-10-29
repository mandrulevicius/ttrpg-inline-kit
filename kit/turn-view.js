// The turn widget's staging, pure (no DOM): the payload's attributes read, and the turn's markdown staged by the pane's
// own story view (pane/story.js), so the chat and the pane read the grammar one way. The TTRPG's tests run this.
import { castOf, turnView } from '../pane/story.js';

// A portrait folder under the kit's assets/ttrpg/: plain segments, none climbing out (as pane/model.js accepts).
const FOLDER = /^[a-z0-9][a-z0-9_.-]*(?:\/[a-z0-9][a-z0-9_.-]*)*$/i;

// data-cast: "<name as the party knows them>=<portrait folder>[ <ink>]", entries split by ";". The id the pane picks a
// default ink by comes from the folder (npc.<id>/…), so a speaker takes the same ink in both places. An empty folder:
// a speaker with an ink and no face.
export function readCast(attr) {
  const list = [];
  for (const part of String(attr ?? '').split(';')) {
    const m = /^\s*([^=]+?)\s*=\s*(\S*)(?:\s+(\S+))?\s*$/.exec(part);
    if (!m) continue;
    const [, name, folder, ink = ''] = m;
    const portrait = FOLDER.test(folder) ? folder : '';
    list.push({ id: /^npc\.([^/]+)\//.exec(portrait)?.[1] ?? name, name, ink, portrait, fields: [], known: [] });
  }
  return castOf({ people: { list } });
}

// data-tones: the turn's tones.json entries in order ("Fenn: cold .4"), split by "|".
export const readTones = (attr) => String(attr ?? '').split('|').map((t) => t.trim()).filter(Boolean);

// The turn's markdown as the payload holds it: one line break at each end of the element is the GM's layout, not
// the turn's.
export const turnText = (raw) => String(raw ?? '').replace(/\r\n?/g, '\n').replace(/^[ \t]*\n/, '').replace(/\s+$/, '');

// The staged HTML. face(folder, level) describes a portrait that has loaded, or null (pane/story.js turnView). A
// speaker's name is plain text here: the pane's button opens their People card, which the chat doesn't have.
export function stage({ text, cast, tones }, face = () => null) {
  const view = turnView({ who: 'gm', text, tones }, { cast, nameOf: () => '', you: '', face });
  if (!view) return '';
  return view.html.replace(/<button class="who"(?: data-[a-z]+="[^"]*")*( style="[^"]*")?>([^<]*)<\/button>/g, '<b class="who"$1>$2</b>');
}
