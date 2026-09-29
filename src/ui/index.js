// SEVENSHARD UI — entry point. DOM + CSS, driven by plain data, emits actions through one callback.
//
//   import { createUI } from './ui/index.js';
//   const ui = createUI(document.body, { onAction(type, payload) { … } });
//   ui.screen('title', { … });   ui.screen('game');   ui.hud.update(hudState);
//
// Full API and every data shape / action type: src/ui/README.md.
import { h, clamp, show, setCls, store } from './core/util.js';
import { setIconScale, iconUrl, placeholderIcon } from './core/icon.js';
import { glyph } from './core/glyphs.js';
import { Tooltip } from './core/tooltip.js';
import { WindowManager, Win } from './core/windows.js';
import { Modals } from './core/modal.js';
import { initDrag } from './core/drag.js';
import * as data from './core/data.js';
import { Hud } from './hud/hud.js';
import { Banners, Toasts } from './hud/center.js';
import { MENU } from './hud/menu.js';
import { SCREENS } from './screens/index.js';
import { WINDOWS } from './windows/index.js';
import { NpcDialog } from './windows/dialog.js';
import { TouchLayer } from './hud/touch.js';

export { Win, glyph, iconUrl, placeholderIcon, data, MENU };

/** Default window hotkeys (KeyboardEvent.code), matching src/engine/input.js DEFAULT_BINDS. The game owns
 *  QWER ASDF Z X V C G T Space 1-4 Alt; Enter focuses chat, Esc closes / opens the game menu, F12 or Ctrl+Z = photo mode. */
export const HOTKEYS = {
  character: 'KeyP', inventory: 'KeyI', skills: 'KeyK', engravings: 'KeyN', map: 'KeyM', guild: 'KeyU', partyfinder: 'KeyO',
  tome: 'KeyL', quests: 'KeyJ', compass: 'KeyH', meter: 'KeyY', songs: 'KeyB', emotes: 'Period',
};

class UI {
  constructor(root, opts) {
    this.opts = opts;
    this.onAction = opts.onAction || (() => {});
    this._ls = new Map();
    this.userScale = store.get('ss.ui.scale', 1) || 1;
    this.touch = false;
    this.typing = false;
    this.current = null;         // active screen instance (null = game)
    this.currentName = 'game';

    const el = this.root = h('div', 'ss-ui', root || document.body);
    el.setAttribute('data-ss', '');
    const v = this.v = h('div', 'ss-v', el);
    const L = n => h('div', 'ss-layer ss-l-' + n, v);
    this.layers = { hud: L('hud'), center: L('center'), win: L('win'), screen: L('screen'), modal: L('modal'), top: L('top') };

    this.hud = new Hud(this, this.layers.hud);
    this.chat = this.hud.chat;
    this.banners = new Banners(this.layers.center, { warn: this.hud.warnSlot });
    this.screenToasts = new Toasts(this.layers.top); // used while a full screen hides the HUD
    this.screenToasts.el.classList.add('ss-toasts--screen');
    this.windows = new WindowManager(this, this.layers.win);
    this.windows.register(...WINDOWS);
    this.modals = new Modals(this, this.layers.modal);
    this.npc = new NpcDialog(this, this.layers.modal);
    this.tip = new Tooltip(this, this.layers.top);
    initDrag(this);
    this.touchLayer = new TouchLayer(this, this.layers.hud);
    this.screens = new Map();
    this.hotkeys = opts.hotkeys === false ? null : { ...HOTKEYS, ...(typeof opts.hotkeys === 'object' ? opts.hotkeys : {}) };

    this._bindPointer();
    this._onKey = e => this._key(e);
    addEventListener('keydown', this._onKey);
    this._onResize = () => this._resize();
    addEventListener('resize', this._onResize);
    this._tipTimer = setInterval(() => { if (this.tip.anchor) this.tip.refresh(); }, 400);
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
    if (opts.touch === true || (opts.touch !== false && coarse)) this.setTouch(true);
    this._resize();
    this.screen(opts.screen || 'game');
  }

  // ------------------------------------------------------------------ events
  /** Everything the UI does is reported here: onAction(type, payload) + ui.on(type, fn) listeners. */
  emit(type, payload = {}) {
    try { this.onAction(type, payload); } catch (e) { console.error('[ui] onAction', type, e); }
    const s = this._ls.get(type); if (s) for (const fn of s) try { fn(payload); } catch (e) { console.error(e); }
    const a = this._ls.get('*'); if (a) for (const fn of a) try { fn(type, payload); } catch (e) { console.error(e); }
  }
  on(type, fn) { let s = this._ls.get(type); if (!s) this._ls.set(type, s = new Set()); s.add(fn); return () => s.delete(fn); }
  off(type, fn) { this._ls.get(type)?.delete(fn); }

  // ------------------------------------------------------------------ screens
  /** 'title' | 'charselect' | 'create' | 'loading' | 'game' | 'results' | 'death'. Same name again = update in place. */
  screen(name, d) {
    if (name === this.currentName && this.current) { this.current.render(d || {}); return this.current; }
    if (name === this.currentName && name === 'game') return null;
    const prev = this.current;
    let next = null;
    if (name !== 'game') {
      next = this.screens.get(name);
      if (!next) {
        const C = SCREENS[name];
        if (!C) { console.warn('[ui] unknown screen', name); return null; }
        next = new C(this, this.layers.screen);
        this.screens.set(name, next);
      }
    }
    if (prev) prev._hide();
    this.current = next; this.currentName = name;
    if (next) next._show(d || {});
    const overlay = !next || next.constructor.overlay;
    show(this.layers.hud, overlay && this._hudOn !== false);
    show(this.layers.center, overlay);
    show(this.layers.win, !next);
    setCls(this.root, 'ss-in-game', !next);
    setCls(this.root, 'ss-in-overlay', !!next && !!next.constructor.overlay);
    if (next) { this.tip.hide(); }
    this.emit('screen', { name });
    return next;
  }
  // ------------------------------------------------------------------ HUD helpers
  banner(text, opts) { this.banners.show(text, opts); }
  toast(text, kind = 'info', dur) { const onScreen = this.current && !this.current.constructor.overlay; return (onScreen ? this.screenToasts : this.hud.toasts).add(text, kind, dur); }
  /** Show/hide the whole HUD (photo mode). */
  setHudVisible(on) {
    this._hudOn = !!on;
    show(this.layers.hud, this._hudOn && (!this.current || this.current.constructor.overlay));
    show(this.layers.center, this._hudOn || !!this.current);
    this.emit('hud:visible', { visible: this._hudOn });
  }
  get hudVisible() { return this._hudOn !== false; }

  // ------------------------------------------------------------------ windows
  open(id, d) { return this.windows.open(id, d); }
  close(id) { return this.windows.close(id); }
  toggle(id, d) { return this.windows.toggle(id, d); }
  update(id, d) { return this.windows.update(id, d); }
  isOpen(id) { return this.windows.isOpen(id); }
  /** The live window instance (e.g. ui.get('character').portrait to mount a 3D portrait canvas). */
  get(id) { return this.windows.get(id); }
  /** Menu button / hotkey: tell the game first; if its handler didn't open/close/update that window, toggle it here. */
  _menu(id, extra) {
    const before = this.windows.stamp(id);
    this.emit('hud:menu', { id, ...extra });
    if (this.windows.has(id) && this.windows.stamp(id) === before) this.toggle(id);
  }
  _winChanged(id, on) { this.hud.menu.setOpen(id, on); }

  // ------------------------------------------------------------------ modals & dialog
  confirm(o) { return this.modals.confirm(o); }
  prompt(o) { return this.modals.prompt(o); }
  /** NPC dialogue: resolves with the chosen choice id (or null when closed / finished without choices). */
  dialog(npc, script) { return this.npc.run(npc, script); }

  // ------------------------------------------------------------------ layout
  get scale() { return this.s; }
  /** User UI scale multiplier (0.7–1.4), persisted. */
  setScale(m) { this.userScale = clamp(+m || 1, 0.6, 1.6); store.set('ss.ui.scale', this.userScale); this._resize(); }
  /** Touch-friendly HUD (bigger targets, collapsed chat/menu, joystick + skill-button areas kept clear). */
  setTouch(on, o = {}) {
    this.touch = !!on;
    setCls(this.root, 'ss-touch', this.touch);
    this.touchLayer.set(this.touch, o);
    this._resize();
    this.emit('touch', { on: this.touch });
  }
  _resize() {
    const W = innerWidth || 1280, H = innerHeight || 720;
    const baseH = this.touch ? 540 : 900, minW = this.touch ? 880 : 1280;
    let s = Math.min(H / baseH, W / minW);
    s = clamp(s, 0.4, 4) * this.userScale;
    this.s = s; this.vw = W / s; this.vh = H / s;
    const v = this.v.style;
    v.width = this.vw + 'px'; v.height = this.vh + 'px';
    if (CSS.supports && CSS.supports('zoom', '2')) v.zoom = s;
    else { v.transform = `scale(${s})`; v.transformOrigin = '0 0'; }
    this.root.style.setProperty('--ss-s', s.toFixed(4));
    setCls(this.root, 'ss-narrow', this.vw < 1500);
    setIconScale(s);
    this.hud.minimap.resize(s);
    this.windows.reflow();
    this.current?.resize?.();
    this.emit('resize', { scale: s, width: this.vw, height: this.vh });
  }

  // ------------------------------------------------------------------ input
  _typing(on) { this.typing = on; }
  /** True if a UI text field has focus (the game should ignore key presses). */
  get wantsKeyboard() {
    const a = document.activeElement;
    return !!(a && this.root.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable));
  }
  /** True if a pointer event hit an interactive UI element (the game should not move/attack on it). */
  isOverUI(e) {
    const t = e && e.target;
    if (!t || !t.closest || !this.root.contains(t)) return false;
    if (this.current && !this.current.constructor.overlay) return true;
    return getComputedStyle(t).pointerEvents !== 'none';
  }
  _key(e) {
    // Note: the game's input layer preventDefault()s every bound key (to stop browser scrolling etc.), so
    // defaultPrevented is not a "handled" signal here. Text fields and modal/dialog/screen states gate instead.
    const t = e.target;
    const field = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (this.modals.open) { if (e.key === 'Escape') { this.modals.closeTop(); e.preventDefault(); } return; }
    if (field) return;
    if (this.npc.active) { if (this.npc.key(e)) e.preventDefault(); return; }
    if (this.current) {
      if (this.windows.hasOpenModal()) { // e.g. settings over the title, the raid auction over results
        if (e.key === 'Escape' && this.windows.closeTop()) e.preventDefault();
        return;
      }
      if (this.current.key && this.current.key(e)) { e.preventDefault(); return; }
      if (!this.current.constructor.overlay) return;
    }
    if (!this.hotkeys) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.tip.anchor) this.tip.hide();
      if (this.windows.closeTop()) return;
      const before = this.windows.stamp('gamemenu');
      this.emit('hud:escape', {});
      if (this.windows.has('gamemenu') && this.windows.stamp('gamemenu') === before) this.toggle('gamemenu');
      return;
    }
    if (((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') || e.code === 'F12') { e.preventDefault(); this.setHudVisible(!this.hudVisible); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (e.key === 'Enter') { e.preventDefault(); this.chat.focus(); return; }
    if (e.key === '/') { e.preventDefault(); this.chat.focus('/'); return; }
    for (const id in this.hotkeys) if (this.hotkeys[id] === e.code) {
      e.preventDefault();
      this._menu(id, { key: true });
      return;
    }
  }
  _bindPointer() {
    const root = this.root;
    const findTip = n => { while (n && n !== root) { if (n._tip) return n; n = n.parentElement; } return null; };
    root.addEventListener('pointerover', e => {
      if (e.pointerType === 'touch') return;
      const t = findTip(e.target);
      if (t === this._tipEl) return;
      this._tipEl = t;
      if (!t) return this.tip.hide();
      const d = typeof t._tip === 'function' ? t._tip() : t._tip;
      if (d) this.tip.showFor(t, d); else this.tip.hide();
    });
    root.addEventListener('pointerout', e => {
      if (this._tipEl && (!e.relatedTarget || !this._tipEl.contains(e.relatedTarget))) { this._tipEl = null; this.tip.hide(); }
    });
    // touch: long-press shows the tooltip, the next tap anywhere hides it
    let lp = null;
    root.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch') { if (this.tip.anchor && !findTip(e.target)) this.tip.hide(); return; }
      if (this.tip.anchor) { this.tip.hide(); }
      const t = findTip(e.target);
      if (!t) return;
      clearTimeout(lp);
      lp = setTimeout(() => { const d = typeof t._tip === 'function' ? t._tip() : t._tip; if (d) this.tip.showFor(t, d); }, 450);
    });
    const cancel = () => clearTimeout(lp);
    root.addEventListener('pointerup', cancel); root.addEventListener('pointercancel', cancel);
    root.addEventListener('contextmenu', e => { if (e.target !== root && e.target.closest && e.target.closest('.ss-ptr, .ss-win, .ss-panel, .ss-scr')) e.preventDefault(); });
    root.addEventListener('wheel', e => { if (e.target.closest && e.target.closest('.ss-scroll, .ss-win, .ss-scr')) e.stopPropagation(); }, { passive: true });
  }
  /** Remove every DOM node and listener. */
  dispose() {
    removeEventListener('keydown', this._onKey); removeEventListener('resize', this._onResize);
    clearInterval(this._tipTimer);
    this.root.remove();
  }
}

/**
 * Create the UI. root: element to mount into (usually document.body).
 * opts: { onAction(type, payload), hotkeys?: false | { windowId: 'KeyCode' }, touch?: true|false|'auto', screen?: name }
 */
export function createUI(root = document.body, opts = {}) {
  return new UI(root, opts);
}
