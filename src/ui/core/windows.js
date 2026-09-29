// Window system: draggable, closable (× / Esc), stackable (click brings to front), positions remembered in
// localStorage. Windows are created lazily on first open.
//
//   class MyWin extends Win {
//     static id = 'mywin'; static title = 'My Window'; static glyph = 'tome'; static width = 520;
//     build() { /* create DOM inside this.body once */ }
//     render(data) { /* (re)fill from data; called on open and on ui.update('mywin', data) */ }
//   }
//   ui.windows.register(MyWin);  ui.open('mywin', data)
import { h, btn, clamp, store } from './util.js';
import { glyph } from './glyphs.js';

const KEY = 'ss.ui.win.v1';

export class Win {
  static id = 'win'; static title = 'Window'; static glyph = null; static width = 420; static height = null; static bare = false;
  /** 'win' (default: hidden while a full screen is up) or 'modal' (stays above screens, e.g. the raid auction over results) */
  static layer = 'win';
  /** default position: 'center' | 'left' | 'right' | { x|right, y|bottom } (virtual px) */
  static pos = 'center';
  constructor(ui, mgr) {
    this.ui = ui; this.mgr = mgr;
    const C = this.constructor;
    this.id = C.id;
    const el = this.el = h('section', `ss-win ss-panel ss-orn ss-win--${C.id}`, C.layer === 'modal' ? ui.layers.modal : mgr.layer);
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', C.title);
    el.style.width = C.width + 'px';
    if (C.height) el.style.height = C.height + 'px';
    const hd = this.hd = h('header', 'ss-win-hd', el);
    this.titleEl = h('div', 'ss-win-t', hd);
    this.titleEl.innerHTML = (C.glyph ? glyph(C.glyph) : '') + '<span></span>';
    this.titleEl.lastChild.textContent = C.title;
    this.tools = h('div', 'ss-win-tools', hd);
    const x = btn('ss-close ss-win-x', hd, null, () => mgr.close(this.id), `Close ${C.title}`);
    x.innerHTML = glyph('close');
    this.body = h('div', 'ss-win-bd', el);
    this.data = null; this.isOpen = false;
    el.style.display = 'none';
    el.addEventListener('pointerdown', () => mgr.front(this), true);
    this._drag(hd);
    this.build();
  }
  setTitle(t) { this.titleEl.lastChild.textContent = t; this.el.setAttribute('aria-label', t); }
  /** Override: build DOM once. */
  build() {}
  /** Override: fill from data. */
  render() {}
  /** Called after the window became visible (measure, focus). */
  shown() {}
  /** Called when closed. */
  hidden() {}
  _drag(handle) {
    let sx = 0, sy = 0, ox = 0, oy = 0, id = null;
    handle.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button, input, select')) return;
      id = e.pointerId; handle.setPointerCapture(id);
      sx = e.clientX; sy = e.clientY; ox = this.x; oy = this.y;
      this.el.classList.add('is-drag');
      e.preventDefault();
    });
    handle.addEventListener('pointermove', e => {
      if (e.pointerId !== id) return;
      const s = this.ui.scale;
      this.moveTo(ox + (e.clientX - sx) / s, oy + (e.clientY - sy) / s);
    });
    const end = e => {
      if (e.pointerId !== id) return;
      id = null; this.el.classList.remove('is-drag');
      this.mgr.savePos(this);
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }
  moveTo(x, y) {
    const W = this.ui.vw, H = this.ui.vh;
    const w = this.el.offsetWidth || this.constructor.width, hh = this.el.offsetHeight || 200;
    this.x = Math.round(clamp(x, 40 - w, W - 40));
    this.y = Math.round(clamp(y, 0, H - 40));
    this.el.style.left = this.x + 'px'; this.el.style.top = this.y + 'px';
    void hh;
  }
}

export class WindowManager {
  constructor(ui, layer) {
    this.ui = ui; this.layer = layer;
    this.defs = new Map(); this.inst = new Map();
    this.z = 10; this.pos = store.get(KEY, {});
    this.data = new Map(); // last data per window (so menu clicks open instantly with what we had)
    this.ops = new Map();  // per-window change counter: lets the UI tell whether the game already handled a hotkey
  }
  register(...classes) { for (const C of classes) this.defs.set(C.id, C); }
  has(id) { return this.defs.has(id); }
  get(id) {
    let w = this.inst.get(id);
    if (!w) { const C = this.defs.get(id); if (!C) return null; w = new C(this.ui, this); this.inst.set(id, w); }
    return w;
  }
  isOpen(id) { const w = this.inst.get(id); return !!(w && w.isOpen); }
  stamp(id) { return this.ops.get(id) || 0; }
  _op(id) { this.ops.set(id, (this.ops.get(id) || 0) + 1); }
  open(id, data) {
    const w = this.get(id);
    if (!w) { console.warn('[ui] unknown window', id); return null; }
    this._op(id);
    if (data !== undefined) this.data.set(id, data);
    const d = this.data.get(id) ?? null;
    const was = w.isOpen;
    w.data = d;
    w.el.style.display = '';
    w.isOpen = true;
    try { w.render(d || {}); } catch (e) { console.error('[ui] render', id, e); }
    if (!was) { this.place(w); w.shown(); this.ui.emit('window:open', { id }); this.ui._winChanged(id, true); }
    this.front(w);
    return w;
  }
  update(id, data) {
    this._op(id);
    this.data.set(id, data);
    const w = this.inst.get(id);
    if (w && w.isOpen) { w.data = data; try { w.render(data || {}); } catch (e) { console.error('[ui] render', id, e); } }
  }
  close(id) {
    const w = this.inst.get(id);
    if (!w || !w.isOpen) return false;
    this._op(id);
    w.isOpen = false; w.el.style.display = 'none';
    w.hidden();
    this.ui.emit('window:close', { id });
    this.ui._winChanged(id, false);
    return true;
  }
  toggle(id, data) { return this.isOpen(id) ? (this.close(id), null) : this.open(id, data); }
  front(w) {
    if (w._z === this.z) return;
    w._z = ++this.z; w.el.style.zIndex = this.z;
    for (const o of this.inst.values()) o.el.classList.toggle('is-top', o === w);
  }
  /** Topmost open window id, or null. */
  top() {
    let best = null;
    for (const w of this.inst.values()) if (w.isOpen && (!best || w._z > best._z)) best = w;
    return best ? best.id : null;
  }
  closeTop() { const t = this.top(); return t ? this.close(t) : false; }
  /** A window living in the modal layer (e.g. the auction) is open: screens shouldn't take Enter/Esc. */
  hasOpenModal() { for (const w of this.inst.values()) if (w.isOpen && w.constructor.layer === 'modal') return true; return false; }
  closeAll() { for (const w of this.inst.values()) if (w.isOpen) this.close(w.id); }
  openList() { return [...this.inst.values()].filter(w => w.isOpen).map(w => w.id); }
  place(w) {
    const C = w.constructor, W = this.ui.vw, H = this.ui.vh;
    const saved = this.pos[w.id];
    const ww = w.el.offsetWidth || C.width, hh = w.el.offsetHeight || 400;
    if (saved) return w.moveTo(saved.x, saved.y);
    let x, y;
    const p = this.ui.touch ? 'center' : C.pos;
    if (p === 'left') { x = 150; y = Math.max(60, (H - hh) / 2 - 30); }
    else if (p === 'right') { x = W - ww - 240; y = Math.max(60, (H - hh) / 2 - 30); }
    else if (p && typeof p === 'object') { x = p.right != null ? W - ww - p.right : p.x; y = p.bottom != null ? H - hh - p.bottom : p.y; }
    else { x = (W - ww) / 2; y = Math.max(40, (H - hh) / 2 - 20); }
    // cascade over other open windows at the same spot
    for (const o of this.inst.values()) if (o !== w && o.isOpen && Math.abs(o.x - x) < 8 && Math.abs(o.y - y) < 8) { x += 28; y += 28; }
    w.moveTo(x, y);
  }
  savePos(w) { this.pos[w.id] = { x: w.x, y: w.y }; store.set(KEY, this.pos); }
  resetPositions() { this.pos = {}; store.set(KEY, this.pos); for (const w of this.inst.values()) if (w.isOpen) this.place(w); }
  /** Keep windows on screen after a resize. */
  reflow() { for (const w of this.inst.values()) if (w.isOpen) w.moveTo(w.x, w.y); }
}
