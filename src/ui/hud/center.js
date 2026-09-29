// Centre-screen messaging and small HUD widgets:
//   Banners  ui.banner(text, { kind, sub, title, dur, level })  — zone / boss / warn / counter / stagger / levelup / quest /
//            clear / defeat / gate / info. Major banners queue; warnings and counter/stagger pops replace instantly.
//   Toasts   ui.toast(text, kind)  — info / success / warn / error / loot / system / party
//   Loot     ui.hud.loot(item)     — right-side pickup feed with grade colours
//   Cast bar HudState.cast        — { label, t: 0..1, kind: 'cast'|'channel'|'charge'|'hold', perfect: [a,b], icon }
//   Prompt   HudState.interact    — { key: 'G', label: 'Talk', name?, hold?: 0..1 }
//   Progress HudState.progress    — { label, pct }            (chaos dungeon %)
//   Timer    HudState.timer       — { label, left, urgent? }  (raid enrage / event)
import { h, setText, setCls, setStyle, setSrc, show, replay, clamp, fmtClock, fmtInt, esc } from '../core/util.js';
import { iconUrl, itemIcon } from '../core/icon.js';
import { glyph } from '../core/glyphs.js';
import { grade } from '../core/data.js';

const MAJOR = new Set(['zone', 'boss', 'levelup', 'quest', 'clear', 'defeat', 'gate', 'info', 'success', 'fail']);
const DUR = { zone: 3.6, boss: 4.2, warn: 3, counter: 1.3, stagger: 1.8, levelup: 3.4, quest: 3.2, clear: 4, defeat: 4, gate: 3, info: 2.8, success: 2.6, fail: 2.6 };

export class Banners {
  constructor(layer) {
    this.el = h('div', 'ss-banners', layer);
    this.main = h('div', 'ss-bn-slot ss-bn-main', this.el);
    this.warn = h('div', 'ss-bn-slot ss-bn-warn', this.el);
    this.pop = h('div', 'ss-bn-slot ss-bn-pop', this.el);
    this.queue = []; this.busy = false;
  }
  show(text, o = {}) {
    if (typeof o === 'string') o = { kind: o };
    const kind = o.kind || 'info';
    const item = { text: String(text ?? ''), kind, sub: o.sub, title: o.title, level: o.level, dur: o.dur || DUR[kind] || 3 };
    if (MAJOR.has(kind)) {
      this.queue.push(item);
      if (this.queue.length > 3) this.queue.shift();
      if (!this.busy) this.next();
    } else this.render(kind === 'warn' ? this.warn : this.pop, item);
  }
  next() {
    const it = this.queue.shift();
    if (!it) { this.busy = false; return; }
    this.busy = true;
    this.render(this.main, it, () => this.next());
  }
  render(slot, it, done) {
    clearTimeout(slot._t); clearTimeout(slot._t2);
    slot.textContent = '';
    const b = h('div', `ss-bn ss-bn--${it.kind}`, slot);
    b.style.setProperty('--dur', it.dur + 's');
    const k = it.kind;
    if (k === 'zone') {
      h('i', 'ss-bn-band', b);
      if (it.sub) h('div', 'ss-bn-over', b, it.sub);
      h('div', 'ss-bn-t', b, it.text);
      h('i', 'ss-bn-rule', b);
    } else if (k === 'boss') {
      h('i', 'ss-bn-band', b);
      if (it.title || it.sub) h('div', 'ss-bn-over', b, it.title || it.sub);
      h('div', 'ss-bn-t', b, it.text);
      h('i', 'ss-bn-rule', b);
    } else if (k === 'levelup') {
      h('i', 'ss-bn-band', b);
      h('i', 'ss-bn-rays', b);
      h('div', 'ss-bn-over', b, it.sub || 'Level Up');
      h('div', 'ss-bn-t', b, it.level != null ? String(it.level) : it.text);
      if (it.level != null && it.text) h('div', 'ss-bn-sub', b, it.text);
    } else if (k === 'quest' || k === 'clear' || k === 'defeat' || k === 'gate' || k === 'success' || k === 'fail') {
      h('i', 'ss-bn-band', b);
      h('div', 'ss-bn-over', b, it.sub || { quest: 'Quest Complete', clear: 'Cleared', defeat: 'Defeated', gate: 'Legion Raid', success: '', fail: '' }[k]);
      h('div', 'ss-bn-t', b, it.text);
    } else if (k === 'counter' || k === 'stagger') {
      h('i', 'ss-bn-burst', b);
      h('div', 'ss-bn-t', b, it.text || (k === 'counter' ? 'COUNTER!' : 'STAGGER BREAK'));
    } else if (k === 'warn') {
      h('i', 'ss-bn-band', b);
      const t = h('div', 'ss-bn-t', b);
      t.innerHTML = glyph('warn') + '<span>' + esc(it.text) + '</span>';
      if (it.sub) h('div', 'ss-bn-sub', b, it.sub);
    } else {
      h('div', 'ss-bn-t', b, it.text);
      if (it.sub) h('div', 'ss-bn-sub', b, it.sub);
    }
    slot._t = setTimeout(() => { b.classList.add('is-out'); slot._t2 = setTimeout(() => { b.remove(); done && done(); }, 520); }, it.dur * 1000);
  }
  clear() { this.queue.length = 0; for (const s of [this.main, this.warn, this.pop]) { clearTimeout(s._t); clearTimeout(s._t2); s.textContent = ''; } this.busy = false; }
}

export class Toasts {
  constructor(parent) { this.el = h('div', 'ss-toasts', parent); this.el.setAttribute('aria-live', 'polite'); }
  add(text, kind = 'info', dur = 4) {
    const t = h('div', `ss-toast ss-toast--${kind}`, this.el);
    const g = { success: 'check', warn: 'warn', error: 'warn', loot: 'sparkle', system: 'info', party: 'users', info: 'info' }[kind] || 'info';
    t.innerHTML = glyph(g) + `<span>${esc(text)}</span>`;
    while (this.el.childElementCount > 4) this.el.firstElementChild.remove();
    setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 400); }, dur * 1000);
    return t;
  }
}

export class LootFeed {
  constructor(parent) { this.el = h('div', 'ss-loot', parent); }
  /** item: Item-like { name, grade, count, icon, id, kind } */
  add(it) {
    const g = grade(it.grade || 0);
    const row = h('div', `ss-loot-r ss-g${it.grade | 0}`, this.el);
    const s = h('div', 'ss-slot', row); s.style.setProperty('--sz', '26px');
    const ic = h('div', 'ss-slot-ic', s); setSrc(ic, itemIcon(it.icon || 'item:' + (it.kind || 'material'), 26));
    const n = h('span', 'ss-loot-n', row, it.name || '');
    n.style.color = g.c;
    if (it.count > 1) h('span', 'ss-loot-c', row, '×' + fmtInt(it.count));
    row._tip = it.uid || it.kind ? { kind: 'item', item: it } : null;
    row.classList.add('ss-ptr');
    while (this.el.childElementCount > 7) this.el.firstElementChild.remove();
    setTimeout(() => { row.classList.add('is-out'); setTimeout(() => row.remove(), 500); }, 5200);
  }
}

export class CastBar {
  constructor(parent) {
    const el = this.el = h('div', 'ss-cast', parent);
    this.ic = h('div', 'ss-cast-ic', el);
    const bar = this.bar = h('div', 'ss-cast-bar', el);
    this.zone = h('i', 'ss-cast-zone', bar);
    this.fill = h('i', 'ss-cast-fill', bar);
    this.spark = h('i', 'ss-cast-spark', bar);
    this.lbl = h('span', 'ss-cast-l', bar);
    this.pct = h('span', 'ss-cast-p', bar);
    show(el, false); this._on = false;
  }
  update(c) {
    const on = !!c;
    if (on !== this._on) { this._on = on; show(this.el, on); if (on) replay(this.el, 'is-in'); }
    if (!c) return;
    const t = clamp(c.t ?? c.pct ?? (c.dur ? (c.elapsed || 0) / c.dur : 0), 0, 1);
    const kind = { casting: 'cast', holding: 'hold', channeling: 'channel' }[c.kind] || c.kind || 'cast';
    this.el.dataset.kind = kind;
    const f = kind === 'channel' ? 1 - t : t;
    setStyle(this.fill, 'transform', `scaleX(${f.toFixed(4)})`);
    setStyle(this.spark, 'left', (f * 100).toFixed(2) + '%');
    setText(this.lbl, c.label ?? c.name ?? '');
    setText(this.pct, c.left != null ? c.left.toFixed(1) + 's' : '');
    show(this.ic, !!c.icon);
    if (c.icon) setSrc(this.ic, iconUrl(c.icon, 28));
    let p = c.perfect;
    if (p != null && !Array.isArray(p)) p = typeof p === 'number' ? [Math.max(0, p - 0.08), Math.min(1, p + 0.08)] : [p.from ?? p.start ?? p.a ?? p[0], p.to ?? p.end ?? p.b ?? p[1]];
    if (p && (p[0] == null || p[1] == null)) p = null;
    show(this.zone, !!p);
    if (p) {
      setStyle(this.zone, 'left', (p[0] * 100).toFixed(2) + '%');
      setStyle(this.zone, 'width', ((p[1] - p[0]) * 100).toFixed(2) + '%');
      setCls(this.el, 'is-perfect', t >= p[0] && t <= p[1]);
    } else setCls(this.el, 'is-perfect', false);
  }
}

export class Prompt {
  constructor(parent) {
    const el = this.el = h('div', 'ss-prompt', parent);
    this.key = h('span', 'ss-kbd ss-kbd--lg ss-prompt-k', el);
    this.keyT = h('b', '', this.key);
    this.ring = h('i', 'ss-prompt-ring', this.key);
    const tx = h('div', 'ss-prompt-tx', el);
    this.label = h('b', '', tx);
    this.name = h('span', '', tx);
    show(el, false); this._on = '';
  }
  update(p) {
    const k = p ? (p.key || 'G') + p.label : '';
    if (k !== this._on) { this._on = k; show(this.el, !!p); if (p) replay(this.el, 'is-in'); }
    if (!p) return;
    setText(this.keyT, p.key || 'G');
    setText(this.label, p.label || 'Interact');
    setText(this.name, p.name || '');
    show(this.name, !!p.name);
    setStyle(this.ring, '--p', ((p.hold || 0) * 360).toFixed(1) + 'deg');
    setCls(this.el, 'is-hold', p.hold > 0);
  }
}

export class Progress {
  constructor(parent) {
    const el = this.el = h('div', 'ss-prog', parent);
    const top = h('div', 'ss-prog-top', el);
    this.label = h('span', 'ss-prog-l', top);
    this.pct = h('b', 'ss-prog-p', top);
    const bar = h('div', 'ss-prog-bar', el);
    this.fill = h('i', '', bar);
    for (const m of [0.25, 0.5, 0.75]) { const t = h('s', '', bar); t.style.left = m * 100 + '%'; }
    show(el, false); this._p = -1;
  }
  update(p) {
    show(this.el, !!p);
    if (!p) return;
    const v = clamp(p.pct || 0, 0, 100);
    setText(this.label, p.label || '');
    setText(this.pct, (v >= 100 ? 100 : Math.floor(v * 10) / 10).toFixed(v >= 100 ? 0 : 1) + '%');
    setStyle(this.fill, 'transform', `scaleX(${(v / 100).toFixed(4)})`);
    const done = v >= 100;
    if (done && this._p < 100) replay(this.el, 'is-done');
    setCls(this.el, 'is-complete', done);
    this._p = v;
  }
}

export class Timer {
  constructor(parent) {
    const el = this.el = h('div', 'ss-timer', parent);
    el.innerHTML = glyph('clock');
    this.label = h('span', 'ss-timer-l', el);
    this.t = h('b', 'ss-timer-t', el);
    show(el, false);
  }
  update(t) {
    show(this.el, !!t);
    if (!t) return;
    setText(this.label, t.label || '');
    setText(this.t, fmtClock(t.left || 0));
    setCls(this.el, 'is-urgent', t.urgent ?? (t.left < 60));
  }
}
