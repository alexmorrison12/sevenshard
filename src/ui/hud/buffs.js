// Buff / debuff icon rows with timers and stacks. Nodes are pooled per index and every field is diffed, so a
// 30-buff list pushed at 15 Hz only rewrites the timer text that actually changed.
//   buffs: [{ id, icon, name, left, dur?, stacks, debuff, desc? }]
import { h, setText, setCls, setSrc, show, setStyle, fmtLeft } from '../core/util.js';
import { iconUrl } from '../core/icon.js';

class BuffIcon {
  constructor(parent, size) {
    const el = this.el = h('div', 'ss-buff ss-ptr', parent);
    this.ic = h('div', 'ss-buff-ic', el);
    this.sw = h('i', 'ss-buff-sw', el);
    this.st = h('span', 'ss-buff-st', el);
    this.t = h('span', 'ss-buff-t', el);
    this.size = size; this.d = null;
    el._tip = () => this.d && { title: this.d.name || this.d.id, color: this.d.debuff ? '#ff8a7a' : '#9fe08a', lines: [this.d.desc, this.d.left != null && this.d.left < 1e6 ? `${fmtLeft(this.d.left)} remaining` : null, this.d.stacks > 1 ? `${this.d.stacks} stacks` : null] };
  }
  set(d) {
    this.d = d;
    setSrc(this.ic, iconUrl(d.icon || 'status:' + d.id, this.size));
    setCls(this.el, 'is-debuff', !!d.debuff);
    setText(this.st, d.stacks > 1 ? d.stacks : '');
    const left = d.left;
    setText(this.t, left != null && left < 1e6 ? fmtLeft(left) : '');
    setCls(this.el, 'is-ending', left != null && left < 5);
    // remaining-time shade (only when a duration is known)
    if (d.dur > 0 && left != null) setStyle(this.sw, 'transform', `scaleY(${Math.max(0, Math.min(1, 1 - left / d.dur)).toFixed(3)})`);
    else setStyle(this.sw, 'transform', 'scaleY(0)');
  }
}

export class BuffRow {
  /** max: icons per side before the row stops adding (the rest are counted in a "+N" chip). */
  constructor(ui, parent, { size = 26, max = 24, cls = '' } = {}) {
    this.el = h('div', 'ss-buffs ' + cls, parent);
    this.good = h('div', 'ss-buffs-g', this.el);
    this.bad = h('div', 'ss-buffs-b', this.el);
    this.moreG = h('span', 'ss-buffs-more', this.good); show(this.moreG, false);
    this.moreB = h('span', 'ss-buffs-more', this.bad); show(this.moreB, false);
    this.pg = []; this.pb = []; this.size = size; this.max = max;
    this._g = []; this._b = [];
  }
  _fill(pool, parent, list, more) {
    const n = Math.min(list.length, this.max);
    while (pool.length < n) { const b = new BuffIcon(parent, this.size); parent.insertBefore(b.el, more); pool.push(b); }
    for (let i = 0; i < pool.length; i++) {
      const on = i < n;
      show(pool[i].el, on);
      if (on) pool[i].set(list[i]);
    }
    show(more, list.length > n);
    if (list.length > n) setText(more, '+' + (list.length - n));
  }
  update(list) {
    const g = this._g, b = this._b;
    g.length = 0; b.length = 0;
    if (list) for (const x of list) (x.debuff ? b : g).push(x);
    this._fill(this.pg, this.good, g, this.moreG);
    this._fill(this.pb, this.bad, b, this.moreB);
  }
}
