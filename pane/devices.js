// The devices the pane can look like (core.22): what the screen is, which layout suits it, and which sheet says so.
// Pure: no DOM. The styles are body[data-device=<id>] blocks in style.css; a new device is an entry here and a block there.
// `held`: the sheet's free-text device.held that calls for it. Aboard a ship the console wins over anything held.
// `labels`: what the device calls each tab (a key of TABS in views.js); a tab it names none of keeps its own name.
export const DEVICES = {
  none: { name: 'Plain', layout: 'tabs' },
  mfd: { name: 'Ship console', layout: 'rail', labels: { overview: 'SYS', character: 'CREW', codex: 'DATA', people: 'COMMS', map: 'NAV', screens: 'MFD', log: 'EVT' } },
  // The held screens (TriPad, holopad) lay their tabs out as a row (F-keys, a bar), hence tabs, not the rail.
  tripad: { name: 'TriPad', layout: 'tabs', held: /tri[- ]?pad/i, labels: { overview: 'MAIN', character: 'SELF', codex: 'PRIV', people: 'PPL', map: 'NAV', screens: 'APPS', log: 'LOG' } },
  holo: { name: 'Holopad', layout: 'tabs', held: /holo[- ]?pad/i, labels: { overview: 'Now', character: 'Biometrics', codex: 'Codex', people: 'Contacts', map: 'Starmap', screens: 'Displays', log: 'Trace' } },
  // The lace has no screen: its tabs are a column of icons at the edge of the view, so the rail. Matched at a word
  // start, so "place" and "palace" are not a lace.
  neural: { name: 'Neural lace', layout: 'rail', held: /\b(?:neural|lace\b|implant)/i, labels: { overview: 'view', character: 'vitals', codex: 'codex', people: 'tagged', map: 'nav', screens: 'feeds', log: 'trace' } },
};

// What `dev` calls a tab, or null where it gives none.
export const tabLabel = (dev, tabId) => DEVICES[dev]?.labels?.[tabId] ?? null;

// The device in effect: the player's pin (S.pin: a device id, or 'auto'), else what the sheet calls for: aboard a
// ship -> its console; otherwise the device held, if the pane has a style for it; otherwise none.
export function deviceOf(c, pin = 'auto') {
  if (Object.hasOwn(DEVICES, pin)) return pin;
  if (c?.aboard) return 'mfd';
  const held = c?.device?.held ?? '';
  return Object.keys(DEVICES).find((id) => DEVICES[id].held?.test(held)) ?? 'none';
}

// The settings to change when the device shown changes: the layout it suits (core.22). The player may change the layout
// afterwards; it is only reset when the device does. null while the device is the one `shown` already records.
export function followDevice(S, dev) {
  if (S.shown === dev) return null;
  return { shown: dev, layout: DEVICES[dev]?.layout ?? S.layout };
}
