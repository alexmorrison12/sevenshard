// Top-centre boss frame: name + title, layered HP bars (×N in cycling colours, the next colour shows underneath),
// damage trail, stagger bar (purple), destruction bar, enrage timer, counter hint, boss buff row.
//   boss: { name, title, hp, hpMax, barHp, stagger: {v,max}|null, destruction: {v,max}|null, enrageLeft, counter, buffs,
//           grade?: 'boss'|'guardian'|'legion' , phase?: string }
// Also the small elite/named target frame shown when no boss is up:
//   target: { name, level?, hp, hpMax, kind?: 'mob'|'elite'|'named'|'npc'|'player', title? }
import { h, setText, setCls, setStyle, show, replay, clamp, fmtClock, fmtShort, Trail } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { BuffRow } from './buffs.js';

// the last bar (×1) is red; colours climb from there
export const BAR_COLORS = ['#d8363a', '#e8702e', '#e0b43a', '#5fb84a', '#2fa5c9', '#3d6fe0', '#8a52e0', '#d04aa6'];

export class BossFrame {
  constructor(ui, parent) {
    const el = this.el = h('div', 'ss-boss', parent);
    const top = h('div', 'ss-boss-top', el);
    const nm = h('div', 'ss-boss-nm', top);
    this.name = h('b', '', nm);
    this.title = h('span', '', nm);
    const bar = this.bar = h('div', 'ss-boss-bar', el);
    this.under = h('i', 'ss-boss-under', bar);
    this.lag = h('i', 'ss-boss-lag', bar);
    this.fill = h('i', 'ss-boss-fill', bar);
    this.trail = new Trail(this.lag, 0.3);
    h('i', 'ss-boss-gloss', bar);
    this.flash = h('i', 'ss-boss-flash', bar);
    this.pct = h('span', 'ss-boss-pct', bar);
    this.x = h('div', 'ss-boss-x', el);
    this.xT = h('span', '', this.x);
    const sub = h('div', 'ss-boss-sub', el);
    this.stag = h('div', 'ss-boss-stag', sub);
    this.stagFill = h('i', '', this.stag);
    this.stagL = h('span', '', this.stag, 'Stagger');
    this.destr = h('div', 'ss-boss-destr', sub);
    this.destrFill = h('i', '', this.destr);
    this.destrL = h('span', '', this.destr, 'Destruction');
    this.enrage = h('div', 'ss-boss-enrage', sub);
    this.enrage.innerHTML = glyph('clock');
    this.enrageT = h('span', '', this.enrage);
    this.enrage._tip = { title: 'Enrage', lines: ['When the timer runs out the boss enrages and wipes the party.'] };
    this.enrage.classList.add('ss-ptr');
    this.counter = h('div', 'ss-boss-counter', el);
    this.counter.innerHTML = '<i></i><b>COUNTER</b><i></i>';
    this.buffs = new BuffRow(ui, el, { size: 22, max: 12, cls: 'ss-boss-buffs' });
    this.othersEl = h('div', 'ss-boss-others', el);
    this.others = [];
    this._bars = -1; this._f = -1; this._counter = false; this._key = '';
    show(el, false);
  }
  update(b) {
    show(this.el, !!b);
    if (!b) { this._key = ''; return; }
    const key = b.name + '|' + (b.title || '');
    if (key !== this._key) { this._key = key; this._bars = -1; this._f = -1; replay(this.el, 'is-in'); }
    setText(this.name, b.name || '');
    setText(this.title, b.title || '');
    const hp = Math.max(0, b.hp || 0), max = Math.max(1, b.hpMax || 1);
    const per = b.barHp > 0 ? b.barHp : b.bars > 0 ? max / b.bars : max;
    const bars = hp <= 0 ? 0 : Math.ceil(hp / per - 1e-9);
    const cur = hp <= 0 ? 0 : (hp - (bars - 1) * per) / per;
    if (bars !== this._bars) {
      const broke = this._bars > bars && this._bars > 0;
      this._bars = bars;
      const c = BAR_COLORS[Math.max(0, bars - 1) % BAR_COLORS.length];
      const u = bars > 1 ? BAR_COLORS[(bars - 2) % BAR_COLORS.length] : null;
      setStyle(this.bar, '--bc', c);
      setStyle(this.bar, '--uc', u || 'transparent');
      setCls(this.bar, 'is-last', bars <= 1);
      setText(this.xT, bars > 1 ? '×' + bars : bars === 1 ? '×1' : '');
      if (broke) { replay(this.flash, 'is-on'); replay(this.x, 'is-tick'); this.trail.set(1, true); } // new bar: trail restarts full
    }
    if (cur !== this._f) { this._f = cur; setStyle(this.fill, 'transform', `scaleX(${cur.toFixed(4)})`); }
    this.trail.set(cur);
    setText(this.pct, b.showHp ? `${fmtShort(hp)} / ${fmtShort(max)}` : (hp / max * 100).toFixed(1) + '%');
    // enrage
    const el = b.enrageLeft;
    show(this.enrage, el != null && el >= 0);
    if (el != null) { setText(this.enrageT, fmtClock(el)); setCls(this.enrage, 'is-urgent', el < 60); }
    // stagger / destruction
    const st = b.stagger;
    show(this.stag, !!st);
    if (st) {
      const f = clamp(st.v / Math.max(1, st.max), 0, 1);
      setStyle(this.stagFill, 'transform', `scaleX(${f.toFixed(4)})`);
      setCls(this.stag, 'is-low', f < 0.25);
      setText(this.stagL, st.left != null ? `Stagger · ${Math.max(0, st.left).toFixed(1)}s` : 'Stagger');
      setCls(this.stag, 'is-check', st.left != null);
    }
    const de = b.destruction;
    show(this.destr, !!de);
    if (de) setStyle(this.destrFill, 'transform', `scaleX(${clamp(de.v / Math.max(1, de.max), 0, 1).toFixed(4)})`);
    // counter window
    const c = !!b.counter;
    if (c !== this._counter) { this._counter = c; setCls(this.el, 'is-counter', c); if (c) replay(this.counter, 'is-on'); }
    setCls(this.el, 'is-groggy', !!b.groggy);
    setCls(this.el, 'is-enraged', !!b.enraged);
    this.buffs.update(b.buffs);
    // twin / add bosses: small bars under the main one
    const o = b.others || [];
    while (this.others.length < o.length) {
      const r = h('div', 'ss-boss-o', this.othersEl);
      r._n = h('span', '', r); const bar = h('div', 'ss-boss-ob', r); r._f = h('i', '', bar); r._p = h('b', '', r);
      this.others.push(r);
    }
    this.others.forEach((r, i) => {
      const x = o[i]; show(r, !!x); if (!x) return;
      setText(r._n, x.name || ''); const f = x.dead ? 0 : clamp((x.hp || 0) / Math.max(1, x.hpMax || 1), 0, 1);
      setStyle(r._f, 'transform', `scaleX(${f.toFixed(4)})`); setText(r._p, x.dead ? 'Defeated' : (f * 100).toFixed(1) + '%');
      setCls(r, 'is-dead', !!x.dead);
    });
  }
}

export class TargetFrame {
  constructor(ui, parent) {
    const el = this.el = h('div', 'ss-tgt', parent);
    const top = h('div', 'ss-tgt-top', el);
    this.lv = h('span', 'ss-tgt-lv', top);
    this.name = h('b', '', top);
    this.kind = h('span', 'ss-tgt-kind', top);
    const bar = h('div', 'ss-tgt-bar', el);
    this.lag = h('i', 'ss-tgt-lag', bar);
    this.fill = h('i', 'ss-tgt-fill', bar);
    this.t = h('span', 'ss-tgt-t', bar);
    this.trail = new Trail(this.lag);
    this._f = -1; this._n = '';
    show(el, false);
  }
  update(t) {
    show(this.el, !!t);
    if (!t) { this._n = ''; return; }
    if (t.name !== this._n) { this._n = t.name; this._f = -1; replay(this.el, 'is-in'); }
    setText(this.name, t.name || '');
    setText(this.lv, t.level != null ? 'Lv ' + t.level : '');
    const k = t.kind || 'mob';
    setText(this.kind, k === 'elite' ? 'Elite' : k === 'named' ? 'Named' : k === 'npc' ? (t.title || '') : '');
    this.el.dataset.kind = k;
    const f = clamp((t.hp || 0) / Math.max(1, t.hpMax || 1), 0, 1);
    if (f !== this._f) { this._f = f; setStyle(this.fill, 'transform', `scaleX(${f.toFixed(4)})`); }
    this.trail.set(f);
    setText(this.t, t.hpMax ? (f * 100).toFixed(0) + '%' : '');
  }
}
