// Songs (B) and Emotes (.) wheels: radial pickers. Click / tap an entry (or press its number) to play it; Esc or a
// click outside closes. Songs show cooldowns and locked state.
//   songs data:  { items?: [{ id, name, desc?, glyph?, icon?, cd?, cdLeft?, locked? }] }   Actions: songs:play { id }
//   emotes data: { items?: [{ id, name, glyph? }] }                                        Actions: emotes:play { id }
import { h, btn, esc, fmtCD, clear } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { iconUrl } from '../core/icon.js';
import { Win } from '../core/windows.js';

export const SONGS = [
  { id: 'homeward', name: 'Hymn of Homeward', desc: 'Return to the last city you visited.', glyph: 'anchor', cd: 1800 },
  { id: 'tides', name: 'Serenade of Tides', desc: 'Summon the Dawnrunner to the nearest shore.', glyph: 'ship', cd: 600 },
  { id: 'rest', name: 'Lullaby of Rest', desc: 'Soothe nearby creatures to sleep.', glyph: 'leaf', cd: 300 },
  { id: 'valor', name: 'Ballad of Valor', desc: 'Your party deals more damage for a while.', glyph: 'sword', cd: 900 },
  { id: 'sunrise', name: 'Song of Sunrise', desc: 'Rapport: warms hearts in Solhaven.', glyph: 'sparkle', cd: 60 },
];
export const EMOTES = ['wave', 'bow', 'dance', 'cheer', 'clap', 'laugh', 'cry', 'salute', 'point', 'flex', 'sit', 'sleep', 'shrug', 'facepalm', 'kneel', 'think', 'heart', 'angry', 'yes', 'no']
  .map(id => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) }));
const EG = { wave: 'users', bow: 'down', dance: 'music', cheer: 'star', clap: 'sparkle', laugh: 'sparkle', cry: 'info', salute: 'shield', point: 'right', flex: 'bolt', sit: 'down', sleep: 'clock', shrug: 'swap', facepalm: 'character', kneel: 'crown', think: 'info', heart: 'heart', angry: 'flame', yes: 'check', no: 'close' };

class WheelWin extends Win {
  static width = 460; static bare = true;
  build() {
    this.el.classList.add('ss-wheel');
    this.hd.style.display = 'none';
    this.ring = h('div', 'ss-wh-ring', this.body);
    this.center = h('div', 'ss-wh-c', this.body);
    this.el.addEventListener('keydown', e => { const n = +e.key; if (n >= 1 && n <= 9 && this.items[n - 1]) { e.stopPropagation(); this.pick(this.items[n - 1]); } });
  }
  shown() {
    this.mgr.front(this);
    const W = this.ui.vw, H = this.ui.vh;
    this.moveTo((W - 460) / 2, (H - 460) / 2 - 20);
    this._out = e => { if (!this.el.contains(e.target)) this.mgr.close(this.id); };
    setTimeout(() => addEventListener('pointerdown', this._out, true), 0);
  }
  hidden() { removeEventListener('pointerdown', this._out, true); }
  render(d) {
    const items = this.items = d.items || this.constructor.DEF;
    clear(this.ring);
    const n = items.length, rings = n > 12 ? [Math.min(8, Math.ceil(n * 0.4)), 0] : [n];
    if (rings.length > 1) rings[1] = n - rings[0];
    let k = 0;
    rings.forEach((cnt, ri) => {
      const R = rings.length > 1 ? (ri ? 182 : 102) : 150;
      for (let i = 0; i < cnt; i++, k++) {
        const it = items[k], a = (i / cnt) * Math.PI * 2 - Math.PI / 2 + (ri ? Math.PI / cnt : 0);
        const b = btn('ss-wh-i' + (it.locked ? ' is-locked' : '') + (rings.length > 1 ? ' is-sm' : ''), this.ring, null, () => this.pick(it), it.name);
        b.style.left = (230 + Math.cos(a) * R) + 'px'; b.style.top = (230 + Math.sin(a) * R) + 'px';
        const cdl = it.cdLeft > 0;
        b.innerHTML = (it.icon ? `<i style="background-image:url('${iconUrl(it.icon, 36)}')"></i>` : glyph(it.glyph || EG[it.id] || 'music')) + `<span>${esc(it.name)}</span>` + (cdl ? `<em>${fmtCD(it.cdLeft)}</em>` : '') + (k < 9 ? `<small>${k + 1}</small>` : '');
        b.disabled = !!it.locked || cdl;
        b.addEventListener('pointerenter', () => this.hover(it));
        b.addEventListener('focus', () => this.hover(it));
      }
    });
    this.hover(null);
  }
  hover(it) {
    this.center.innerHTML = it ? `<b>${esc(it.name)}</b>${it.desc ? `<span>${esc(it.desc)}</span>` : ''}${it.locked ? '<em>Not learned yet</em>' : ''}` : `<b>${esc(this.constructor.title)}</b><span>${this.constructor.hint}</span>`;
  }
  pick(it) {
    if (it.locked || it.cdLeft > 0) return;
    this.ui.emit(this.constructor.action, { id: it.id });
    this.mgr.close(this.id);
  }
}
export class SongsWin extends WheelWin { static id = 'songs'; static title = 'Songs'; static glyph = 'music'; static action = 'songs:play'; static DEF = SONGS; static hint = 'Play a song on your instrument'; }
export class EmotesWin extends WheelWin { static id = 'emotes'; static title = 'Emotes'; static glyph = 'heart'; static action = 'emotes:play'; static DEF = EMOTES; static hint = 'Express yourself'; }
