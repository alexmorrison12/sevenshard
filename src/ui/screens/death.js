// Death overlay (HUD stays visible underneath, the world desaturates and reddens at the edges).
//   data: { reason?: 'Slain by Gorrath', by?: 'Rift Carve', revives: [{ id, label, sub?, wait?: s, count?, disabled?, key? }],
//           auto?: { label, left } }
// A revive with `wait` counts down locally and unlocks at 0. Actions: death:revive { id }
import { h, btn, esc, fmtClock, show } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { Screen } from './screen.js';

const DEF = [
  { id: 'gate', label: 'Revive at Gate Entrance', sub: 'Return to the start of this gate', wait: 5, key: 'R' },
  { id: 'feather', label: 'Resurrection Feather', sub: 'Revive where you fell', count: 0 },
];

export class DeathScreen extends Screen {
  static id = 'death';
  static overlay = true;
  build() {
    const el = this.el;
    h('div', 'ss-dt-bg', el);
    const c = h('div', 'ss-dt', el);
    this.sk = h('div', 'ss-dt-skull', c);
    this.sk.innerHTML = glyph('skull');
    h('div', 'ss-dt-title', c, 'You Have Fallen');
    this.reason = h('div', 'ss-dt-reason', c);
    this.opts = h('div', 'ss-dt-opts', c);
    this.auto = h('div', 'ss-dt-auto', c);
  }
  render(d) {
    this.d = d;
    this.reason.innerHTML = d.reason ? `${esc(d.reason)}${d.by ? ` <span>· ${esc(d.by)}</span>` : ''}` : '';
    const list = d.revives || DEF;
    this.t0 = performance.now();
    this.opts.textContent = '';
    this.btns = list.map(r => {
      const b = btn('ss-dt-b', this.opts, null, () => { if (!b.disabled) this.emit('death:revive', { id: r.id }); }, r.label);
      b.innerHTML = `${r.key ? `<span class="ss-kbd ss-kbd--lg">${esc(r.key)}</span>` : `<span class="ss-dt-g">${glyph(r.id === 'feather' ? 'feather' : r.id === 'wait' ? 'users' : 'refresh')}</span>`}<div><b>${esc(r.label)}${r.count != null ? ` <em>×${r.count}</em>` : ''}</b>${r.sub ? `<span>${esc(r.sub)}</span>` : ''}</div><i class="ss-dt-w"></i>`;
      b._r = r; b._w = b.querySelector('.ss-dt-w');
      return b;
    });
    clearInterval(this._iv);
    this.tick(); this._iv = setInterval(() => this.tick(), 200);
  }
  tick() {
    const el = (performance.now() - this.t0) / 1000;
    for (const b of this.btns) {
      const r = b._r, left = (r.wait || 0) - el;
      const waiting = left > 0;
      b.disabled = !!r.disabled || waiting || r.count === 0;
      b._w.textContent = waiting ? Math.ceil(left) + 's' : '';
      b.classList.toggle('is-wait', waiting);
    }
    const a = this.d.auto;
    show(this.auto, !!a);
    if (a) this.auto.textContent = `${a.label || 'Auto-revive at the entrance in'} ${fmtClock(Math.max(0, a.left - el))}`;
  }
  hidden() { clearInterval(this._iv); }
  key(e) {
    const b = this.btns && this.btns.find(x => x._r.key && x._r.key.toLowerCase() === e.key.toLowerCase());
    if (b && !b.disabled) { this.emit('death:revive', { id: b._r.id }); return true; }
    return false;
  }
}
