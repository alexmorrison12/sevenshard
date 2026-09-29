// Party frames (≤4, left side) and raid frames (5–8 → two parties of four).
//   party: [{ name, cls, hp, hpMax, shield, dead, you, support, level?, offline?, buffs? }]
import { h, setText, setCls, setStyle, setSrc, show, replay, clamp, fmtShort, Trail } from '../core/util.js';
import { iconUrl } from '../core/icon.js';
import { glyph } from '../core/glyphs.js';
import { cls as clsInfo } from '../core/data.js';

class Member {
  constructor(ui, parent, index) {
    this.ui = ui; this.index = index;
    const el = this.el = h('div', 'ss-pf ss-ptr', parent);
    el.setAttribute('role', 'button');
    this.ic = h('div', 'ss-pf-ic', el);
    const main = h('div', 'ss-pf-main', el);
    const top = h('div', 'ss-pf-top', main);
    this.name = h('span', 'ss-pf-name', top);
    this.role = h('span', 'ss-pf-role', top);
    this.role.innerHTML = glyph('cross');
    this.hpT = h('span', 'ss-pf-hpt', top);
    const bar = this.bar = h('div', 'ss-pf-bar', main);
    this.lag = h('i', 'ss-pf-lag', bar);
    this.fill = h('i', 'ss-pf-fill', bar);
    this.sh = h('i', 'ss-pf-sh', bar);
    this.trail = new Trail(this.lag);
    this.dead = h('div', 'ss-pf-dead', el);
    this.dead.innerHTML = glyph('skull') + '<span>Dead</span>';
    el.addEventListener('click', () => this.d && ui.emit('hud:party', { index: this.index, name: this.d.name }));
    el._tip = () => this.d && { title: this.d.name, lines: [`${clsInfo(this.d.cls).name}${this.d.level ? ' · Lv ' + this.d.level : ''}${this.d.support ? ' · Support' : ''}`, `HP ${fmtShort(this.d.hp)} / ${fmtShort(this.d.hpMax)}`, this.d.shield ? `Shield ${fmtShort(this.d.shield)}` : null] };
    this._f = -1; this._cls = null;
  }
  set(d) {
    this.d = d;
    if (d.cls !== this._cls) {
      this._cls = d.cls;
      setSrc(this.ic, iconUrl('class:' + d.cls, 30));
      setStyle(this.el, '--pc', clsInfo(d.cls).color);
    }
    setText(this.name, d.name || '');
    setCls(this.el, 'is-you', !!d.you);
    setCls(this.el, 'is-sup', !!d.support);
    show(this.role, !!d.support);
    const dead = !!d.dead;
    if (dead !== this._dead) { this._dead = dead; setCls(this.el, 'is-dead', dead); if (dead) replay(this.el, 'is-died'); }
    setCls(this.el, 'is-off', !!d.offline);
    const max = Math.max(1, d.hpMax || 1);
    const f = dead ? 0 : clamp((d.hp || 0) / max, 0, 1);
    if (f !== this._f) {
      if (this._f >= 0 && this._f - f > 0.12) replay(this.el, 'is-hit');
      this._f = f;
      setStyle(this.fill, 'transform', `scaleX(${f.toFixed(4)})`);
    }
    this.trail.set(f);
    const sh = clamp((d.shield || 0) / max, 0, 1);
    show(this.sh, sh > 0 && !dead);
    if (sh > 0) setStyle(this.sh, 'transform', `translateX(${((f + sh > 1 ? 1 - sh : f) * 100).toFixed(2)}%) scaleX(${sh.toFixed(4)})`);
    setCls(this.el, 'is-low', f > 0 && f < 0.3);
    setText(this.hpT, dead ? '' : Math.round(f * 100) + '%');
  }
}

export class PartyFrames {
  constructor(ui, parent) {
    this.ui = ui;
    this.el = h('div', 'ss-party', parent);
    this.groups = [0, 1].map(i => {
      const g = h('div', 'ss-pgroup', this.el);
      const hd = h('div', 'ss-pgroup-hd', g, `Party ${i + 1}`);
      return { el: g, hd, list: h('div', 'ss-pgroup-list', g), members: [] };
    });
    this._mode = '';
  }
  update(list) {
    const n = list ? list.length : 0;
    show(this.el, n > 1 || (n === 1 && !list[0].you));
    const raid = n > 4;
    const mode = raid ? 'raid' : 'party';
    if (mode !== this._mode) { this._mode = mode; setCls(this.el, 'is-raid', raid); }
    const per = raid ? 4 : 4;
    for (let g = 0; g < 2; g++) {
      const grp = this.groups[g];
      const from = g * per, cnt = Math.max(0, Math.min(per, n - from));
      show(grp.el, cnt > 0);
      show(grp.hd, raid);
      while (grp.members.length < cnt) grp.members.push(new Member(this.ui, grp.list, from + grp.members.length));
      for (let i = 0; i < grp.members.length; i++) {
        const m = grp.members[i];
        show(m.el, i < cnt);
        if (i < cnt) m.set(list[from + i]);
      }
    }
  }
}
