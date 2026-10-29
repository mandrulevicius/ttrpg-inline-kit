// The device widget: a device the character is working (a trainer's cadet shell, a TriPad, a keypad, a lock), drawn
// inline and working. It mirrors the device: its screen in the blocks a screens.json holds (text, readouts, log,
// messages; GM.md "screens"), plus what its hands-on parts are: a shell line, whose Enter sends
// "(on <device>) $ <command>", and a keypad, whose enter key sends what was keyed. It never offers story choices or
// ways to go about something: no suggested commands, no buttons the device doesn't have. Payload:
//   <div class="tt-device">Trainer 03 · cadet shell<script type="application/json">{"on":"Three","name":"Trainer 03 · cadet shell","blocks":[{"kind":"text","text":"> diag thr --resp\nPORT resp 0.47 s"},{"kind":"shell","prompt":">"}]}</script></div>
//   <script type="module" src="<kit base>kit/device.js"></script>
// on: the device as the player would name it in a sentence; name: its screen's header; look: terminal (default),
// tripad, holo or neural (the pane's looks, pane/devices.js), else matched from the name. The element's own text
// shows if this module never loads.
import { addStyle } from './style.js';
import { DEVICES } from '../pane/devices.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const LOOKS = ['terminal', 'tripad', 'holo', 'neural'];

addStyle('tt-device-css', `
.tt-device{max-width:32rem;border-radius:10px;overflow:hidden;background:#07100b;color:#a8dcb0;font:13px/1.45 var(--font-mono,ui-monospace,monospace)}
.tt-device.tripad{background:#140c03;color:#ffb347;border:6px solid #2a2622;border-radius:14px}
.tt-device.holo{background:#03050b;color:#c9f4ff;border:.5px solid rgba(120,230,255,.4);border-radius:0}
.tt-device.neural{background:#02060a;color:#f2f7ff;border-left:2px solid #55e3ff;border-radius:0}
.tt-device .dh{padding:6px 12px;border-bottom:.5px solid currentColor;font-size:12px;opacity:.75}
.tt-device .db{padding:8px 12px}
.tt-device .db+.db{border-top:.5px dashed color-mix(in srgb,currentColor 35%,transparent)}
.tt-device .bt{font-size:11px;letter-spacing:.08em;opacity:.65;margin-bottom:4px}
.tt-device pre{margin:0;font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}
.tt-device .ro{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 16px}
.tt-device .ro .v{text-align:right;font-variant-numeric:tabular-nums}
.tt-device .ok{color:#7fdc8a}.tt-device .warn{color:#f2c14e}.tt-device .bad{color:#ff7a6e}
.tt-device .lg div{display:flex;gap:10px}.tt-device .lg .t{opacity:.6;flex:none}
.tt-device .msg{padding:4px 0}.tt-device .msg+.msg{border-top:.5px dashed color-mix(in srgb,currentColor 30%,transparent)}
.tt-device .msg .mh{opacity:.7}.tt-device .msg.unread .mh{opacity:1;font-weight:500}
.tt-device .sh{display:flex;gap:.6ch;align-items:baseline}
.tt-device input{all:unset;flex:1;min-width:0;font:inherit;color:inherit;caret-color:currentColor}
.tt-device input::placeholder{color:inherit;opacity:.55}.tt-device input:focus::placeholder{opacity:0}
.tt-device .sent{opacity:.6;font-size:11px;margin-top:4px}
.tt-device .kd{min-height:1.45em;padding:2px 8px;margin-bottom:8px;border:.5px solid color-mix(in srgb,currentColor 45%,transparent);border-radius:4px;letter-spacing:.3em;display:flex;justify-content:space-between}
.tt-device .kp{display:grid;grid-template-columns:repeat(3,3rem);gap:6px}
.tt-device .kp button{all:unset;text-align:center;padding:6px 0;border:.5px solid color-mix(in srgb,currentColor 45%,transparent);border-radius:6px;cursor:pointer;font:inherit;color:inherit}
.tt-device .kp button:hover{background:color-mix(in srgb,currentColor 12%,transparent)}
.tt-device .kp button:focus-visible,.tt-device input:focus-visible{outline:1px solid currentColor;outline-offset:2px}
.tt-device .kd button{all:unset;cursor:pointer;opacity:.6;letter-spacing:0}
`);

const items = (b, list) => (Array.isArray(b[list]) ? b[list] : []);
const stateOf = (x) => (['ok', 'warn', 'bad'].includes(x?.state) ? ` ${x.state}` : '');
const state = (x) => (stateOf(x) ? ` class="${stateOf(x).trim()}"` : '');
const titled = (b, html) => `<div class="db">${b.title ? `<div class="bt">${esc(b.title)}</div>` : ''}${html}</div>`;

// The screen's own blocks, as the pane's Screens tab shows them.
function blockHtml(b) {
  switch (b?.kind) {
    case 'text': return titled(b, `<pre>${esc(b.text)}</pre>`);
    case 'readouts': return titled(b, `<div class="ro">${items(b, 'items').map((x) => `<span>${esc(x.label)}</span><span class="v${stateOf(x)}">${esc(x.value)}</span>`).join('')}</div>`);
    case 'log': return titled(b, `<div class="lg">${items(b, 'entries').map((x) => (typeof x === 'string' ? `<div><span>${esc(x)}</span></div>` : `<div${state(x)}>${x.time ? `<span class="t">${esc(x.time)}</span>` : ''}<span>${esc(x.text)}</span></div>`)).join('')}</div>`);
    case 'messages': return titled(b, items(b, 'items').map((x) => `<div class="msg${x.unread ? ' unread' : ''}"><div class="mh">${esc([x.from, x.time].filter(Boolean).join(' · '))}${x.subject ? ` · ${esc(x.subject)}` : ''}</div>${x.text ? `<div>${esc(x.text)}</div>` : ''}</div>`).join(''));
    case 'shell': return titled(b, `<label class="sh"><span>${esc(b.prompt ?? '$')}</span><input type="text" autocomplete="off" spellcheck="false" enterkeyhint="send" placeholder="▌"></label>`);
    case 'keypad': {
      const keys = [...String(b.keys ?? '123456789*0#')];
      const enter = String(b.enter ?? 'OK');
      return titled(b, `<div class="kd"><span class="kv"></span><button type="button" aria-label="Clear">×</button></div><div class="kp">${[...keys, enter].map((k) => `<button type="button" data-k="${esc(k)}">${esc(k)}</button>`).join('')}</div>`);
    }
    default: return '';
  }
}

function send(el, text, note) {
  // The line break keeps two widgets' texts apart when both land in one reply.
  try { sendPrompt(`${text}\n`); note.textContent = 'sent'; } catch { note.textContent = `couldn't send: type ${text}`; }
  el.querySelectorAll('input,.kp button,.kd button').forEach((x) => { x.disabled = true; x.tabIndex = -1; });
}

function setUp(el) {
  el.dataset.ready = '';
  let d;
  try { d = JSON.parse(el.querySelector('script[type="application/json"]')?.textContent ?? ''); } catch { return; }
  const blocks = Array.isArray(d?.blocks) ? d.blocks : [];
  const on = String(d.on || d.name || 'the device');
  const look = LOOKS.includes(d.look) ? d.look : Object.keys(DEVICES).find((id) => DEVICES[id].held?.test(String(d.name ?? ''))) ?? 'terminal';
  el.className = `tt-device ${LOOKS.includes(look) ? look : 'terminal'}`;
  el.innerHTML = `${d.name ? `<div class="dh">${esc(d.name)}</div>` : ''}${blocks.map(blockHtml).join('')}`;

  for (const input of el.querySelectorAll('.sh input')) {
    input.setAttribute('aria-label', `Command on ${on}`);
    const note = Object.assign(document.createElement('div'), { className: 'sent' });
    input.closest('.db').append(note);
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !input.value.trim()) return;
      e.preventDefault();
      input.readOnly = true;
      send(el, `(on ${on}) $ ${input.value.trim()}`, note);
    });
  }
  for (const pad of el.querySelectorAll('.kp')) {
    const box = pad.closest('.db');
    const shown = box.querySelector('.kv');
    const enter = pad.lastElementChild.dataset.k;
    const note = Object.assign(document.createElement('div'), { className: 'sent' });
    box.append(note);
    box.querySelector('.kd button').addEventListener('click', () => { shown.textContent = ''; });
    pad.addEventListener('click', (e) => {
      const key = e.target.closest('button');
      if (!key || key.disabled) return;
      if (key === pad.lastElementChild) {
        if (shown.textContent) send(el, `(on ${on}) keys ${shown.textContent} then ${enter}`, note);
        return;
      }
      shown.textContent += key.dataset.k;
    });
  }
}

for (const el of document.querySelectorAll('.tt-device:not([data-ready])')) setUp(el);
