// "Play Together": host a world (room code + invite link) or join a friend's. Self-contained dialog + in-world badge,
// styled to match the SEVENSHARD UI tokens.
import { cleanCode, canNetwork } from './peer.js';

const CSS = `
.ss-lobby{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;background:rgba(3,5,10,.72);backdrop-filter:blur(3px);font:400 14px/1.45 "Segoe UI",Roboto,system-ui,sans-serif;color:#e7e3d8}
.ss-lobby .box{position:relative;width:min(760px,100%);max-height:100%;overflow:auto;padding:28px 28px 22px;box-sizing:border-box;border:1px solid #3a4560;border-radius:6px;background:linear-gradient(180deg,rgba(18,24,40,.97),rgba(9,12,22,.97));box-shadow:0 24px 80px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.05)}
.ss-lobby h2{margin:0 0 4px;font:400 26px/1.1 Georgia,"Times New Roman",serif;letter-spacing:.28em;text-transform:uppercase;text-align:center;color:#f1dca6}
.ss-lobby .sub{margin:0 0 22px;text-align:center;color:#a9b1c6}
.ss-lobby .cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media (max-width:640px){.ss-lobby .cols{grid-template-columns:1fr}}
.ss-lobby .col{display:flex;flex-direction:column;gap:10px;padding:18px;border:1px solid #2a3350;border-radius:4px;background:rgba(255,255,255,.02)}
.ss-lobby h3{margin:0;font:400 15px Georgia,serif;letter-spacing:.2em;text-transform:uppercase;color:#c9a45a}
.ss-lobby p{margin:0;color:#b8bfd0;font-size:13.5px}
.ss-lobby input{font:700 26px/1 ui-monospace,Menlo,monospace;letter-spacing:.32em;text-align:center;text-transform:uppercase;padding:10px 6px;border-radius:3px;border:1px solid #3a4560;background:#070a12;color:#f1dca6;width:100%;box-sizing:border-box}
.ss-lobby button{font:600 13px "Segoe UI",Roboto,sans-serif;letter-spacing:.14em;text-transform:uppercase;padding:12px 16px;border-radius:3px;cursor:pointer;color:#1a1206;border:1px solid #e8c77a;background:linear-gradient(#f3d58a,#c79a3e);box-shadow:0 2px 10px rgba(0,0,0,.4)}
.ss-lobby button.ghost{color:#e7e3d8;background:transparent;border-color:#3a4560}
.ss-lobby button:disabled{opacity:.5;cursor:default}
.ss-lobby input:focus-visible,.ss-lobby button:focus-visible{outline:2px solid #f1dca6;outline-offset:2px}
.ss-lobby .status{min-height:20px;margin-top:12px;text-align:center;color:#f1dca6}
.ss-lobby .status.err{color:#ff7a5a}
.ss-lobby .foot{margin-top:14px;text-align:center;font-size:12px;color:#7d86a0}
.ss-lobby .x{position:absolute;right:10px;top:8px;background:none;border:0;box-shadow:none;color:#a9b1c6;font:20px/1 sans-serif;padding:6px 10px;letter-spacing:0}
.ss-netbadge{position:fixed;left:50%;transform:translateX(-50%);top:max(8px,env(safe-area-inset-top,0px));z-index:30;display:flex;align-items:center;gap:10px;padding:6px 8px 6px 12px;border-radius:4px;font:600 12.5px "Segoe UI",Roboto,sans-serif;color:#e7e3d8;background:rgba(9,12,22,.9);border:1px solid #3a4560;box-shadow:0 4px 16px rgba(0,0,0,.5);white-space:nowrap;pointer-events:auto}
.ss-netbadge b{color:#62e38a;letter-spacing:.14em;text-transform:uppercase;font-size:11px}
.ss-netbadge b::before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:#62e38a;box-shadow:0 0 8px #62e38a;margin-right:6px;vertical-align:1px}
.ss-netbadge .code{font:700 14px ui-monospace,Menlo,monospace;letter-spacing:.18em;color:#f1dca6}
.ss-netbadge button{font:600 11.5px "Segoe UI",Roboto,sans-serif;padding:4px 9px;border-radius:3px;border:1px solid #3a4560;background:#141b2e;color:#e7e3d8;cursor:pointer}
@media (max-width:700px){.ss-netbadge .who{display:none}}
`;
let styled = false;
const style = () => { if (styled) return; styled = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); };

/** opts: { code, publicUrl, onHost(), onJoin(code, status{ok, fail}), onClose() } */
export function openLobby(opts) {
  style();
  const el = document.createElement('div');
  el.className = 'ss-lobby'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Play Together');
  const online = canNetwork();
  el.innerHTML = `<div class="box"><button class="x" type="button" aria-label="Close">✕</button>
    <h2>Play Together</h2><p class="sub">One of you hosts; up to seven friends join the same world — city, dungeons, guardians and the eight-player legion raid.</p>
    ${online ? `<div class="cols">
      <div class="col"><h3>Host a world</h3><p>Your browser runs the world: every demon, boss and AI adventurer. You get a six-letter room code to share.</p><button type="button" id="ss-host">Host a World</button></div>
      <div class="col"><h3>Join a friend</h3><p>Pick your character, then enter the code your friend sees at the top of their screen.</p><input id="ss-code" maxlength="6" autocomplete="off" spellcheck="false" placeholder="CODE" aria-label="Room code"><button type="button" id="ss-join">Join</button></div>
    </div><div class="status" role="status"></div><div class="foot">Browsers connect directly (WebRTC). Your characters stay saved in your own browser.</div>`
    : `<p class="sub">This view can’t open connections to other players.${opts.publicUrl ? ` Play Together works on the web version: <b>${opts.publicUrl.replace(/^https?:\/\//, '')}</b>` : ''}</p>`}
  </div>`;
  document.body.appendChild(el);
  const close = () => { el.remove(); removeEventListener('keydown', key, true); opts.onClose?.(); };
  const key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  addEventListener('keydown', key, true);
  el.querySelector('.x').addEventListener('click', close);
  el.addEventListener('click', e => { if (e.target === el) close(); });
  if (!online) return { close };
  const status = el.querySelector('.status'), input = el.querySelector('#ss-code'), join = el.querySelector('#ss-join'), host = el.querySelector('#ss-host');
  const say = (msg, err) => { status.textContent = msg || ''; status.classList.toggle('err', !!err); };
  if (opts.code) input.value = cleanCode(opts.code);
  input.addEventListener('input', () => { const v = cleanCode(input.value); if (v !== input.value) input.value = v; });
  input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') join.click(); });
  host.addEventListener('click', () => { el.remove(); removeEventListener('keydown', key, true); opts.onHost(); });
  join.addEventListener('click', () => {
    const code = cleanCode(input.value);
    if (code.length !== 6) { say('Room codes are six letters and numbers.', true); input.focus(); return; }
    join.disabled = host.disabled = true; say('Connecting to your friend…');
    opts.onJoin(code, { ok: () => { el.remove(); removeEventListener('keydown', key, true); }, fail: msg => { join.disabled = host.disabled = false; say(msg, true); } });
  });
  setTimeout(() => (opts.code ? join : host).focus(), 50);
  return { close };
}

/** top badge: room code + invite link (host) or whose world you're in (guest) */
export class NetBadge {
  constructor({ role, code, host, onLeave }) {
    style();
    const el = this.el = document.createElement('div');
    el.className = 'ss-netbadge';
    document.body.appendChild(el);
    this.role = role; this.code = code; this.host = host; this.n = 0; this.onLeave = onLeave;
    this.render();
  }
  invite() { const base = (location.origin + location.pathname).replace(/[?#].*$/, ''); return `${base}?join=${this.code}`; }
  render(note) {
    const el = this.el;
    if (this.role === 'host') el.innerHTML = `<b>Online</b><span class="who">Room</span><span class="code">${this.code || '······'}</span><span class="who">${this.n} friend${this.n === 1 ? '' : 's'}</span><button type="button" data-a="copy">Copy invite link</button><button type="button" data-a="leave">Close world</button>${note ? `<span class="who">${note}</span>` : ''}`;
    else el.innerHTML = `<b>Online</b><span class="who">In ${this.host || 'a friend'}’s world</span><button type="button" data-a="leave">Leave</button>${note ? `<span class="who">${note}</span>` : ''}`;
    el.querySelector('[data-a=copy]')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(this.invite()); this.render('Link copied!'); setTimeout(() => this.render(), 1800); } catch { prompt('Invite link', this.invite()); } });
    el.querySelector('[data-a=leave]')?.addEventListener('click', () => this.onLeave?.());
  }
  set(o) { Object.assign(this, o); this.render(); }
  remove() { this.el.remove(); }
}
