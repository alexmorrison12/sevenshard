// Raw input: keys, mouse buttons, pointer position, wheel, gamepad. Game code reads state and per-frame edges.
// Typing in a text field suspends game keys. Right-click context menus are suppressed over the game canvas.
export const DEFAULT_BINDS = {
  skill0: 'KeyQ', skill1: 'KeyW', skill2: 'KeyE', skill3: 'KeyR', skill4: 'KeyA', skill5: 'KeyS', skill6: 'KeyD', skill7: 'KeyF',
  dash: 'Space', idZ: 'KeyZ', idX: 'KeyX', awaken: 'KeyV', basic: 'KeyC',
  item0: 'Digit1', item1: 'Digit2', item2: 'Digit3', item3: 'Digit4',
  interact: 'KeyG', mount: 'KeyT', songs: 'Comma', emotes: 'Period', compass: 'Semicolon', meter: 'Backquote',
  chat: 'Enter', menu: 'Escape', photo: 'F12',
};

/** PointerEvent.buttons (left 1, right 2, middle 4) → our bits (1 << button: left 1, middle 2, right 4) */
const fromButtons = b => (b & 1) | (b & 4 ? 2 : 0) | (b & 2 ? 4 : 0);

export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set(); this.pressed = new Set(); this.released = new Set();
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2, buttons: 0, over: true };
    this.mdown = new Set(); this.mup = new Set(); this.wheel = 0;
    this.binds = { ...DEFAULT_BINDS };
    this.enabled = true;
    const typing = e => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); };
    addEventListener('keydown', e => {
      if (typing(e)) return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (this.enabled && this.isGameKey(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => {
      this.keys.delete(e.code); this.released.add(e.code);
      // macOS never sends keyup for keys pressed while Cmd was down: drop everything when Cmd lifts
      if (e.code === 'MetaLeft' || e.code === 'MetaRight') this.releaseAll();
    });
    addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.releaseAll(); });
    const onUI = e => e.target !== el;
    // held buttons only ever come from presses on the game canvas, but any pointer event can tell us they were let go
    // (a pointerup can be lost to a native drag, a context menu or a release outside the window)
    const sync = e => { if (e.pointerType !== 'touch' && typeof e.buttons === 'number') this.mouse.buttons &= fromButtons(e.buttons); };
    addEventListener('pointermove', e => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.over = !onUI(e);
      // a second button pressed or released while another is held arrives as a pointermove (e.button ≥ 0),
      // never as pointerdown / pointerup — e.g. letting go of attack while still holding move
      if (e.pointerType !== 'touch' && e.button >= 0) {
        const bit = 1 << e.button, down = fromButtons(e.buttons) & bit;
        if (down && !onUI(e) && !(this.mouse.buttons & bit)) { this.mouse.buttons |= bit; this.mdown.add(e.button); }
        else if (!down && (this.mouse.buttons & bit)) this.mup.add(e.button);
      }
      sync(e);
    });
    addEventListener('pointerover', sync);
    addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') return;
      sync(e);
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (onUI(e)) return;
      this.mouse.buttons |= 1 << e.button; this.mdown.add(e.button);
      el.focus?.();
    });
    addEventListener('pointerup', e => { if (e.pointerType === 'touch') return; if (this.mouse.buttons & (1 << e.button)) this.mup.add(e.button); this.mouse.buttons &= ~(1 << e.button); sync(e); });
    addEventListener('pointercancel', () => { this.mouse.buttons = 0; });
    addEventListener('dragstart', () => { this.mouse.buttons = 0; });
    addEventListener('contextmenu', e => { if (e.target !== el) this.mouse.buttons = 0; });
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('dragstart', e => e.preventDefault());
    el.addEventListener('wheel', e => { this.wheel += e.deltaY; e.preventDefault(); }, { passive: false });
  }
  /** forget every held key and button (focus lost, tab hidden, Cmd released) */
  releaseAll() { for (const k of this.keys) this.released.add(k); this.keys.clear(); this.mouse.buttons = 0; }
  isGameKey(code) { return Object.values(this.binds).includes(code) && code !== 'F12'; }
  down(action) { return this.keys.has(this.binds[action]); }
  hit(action) { return this.pressed.has(this.binds[action]); }
  up(action) { return this.released.has(this.binds[action]); }
  btn(b) { return !!(this.mouse.buttons & (1 << b)); }
  clicked(b) { return this.mdown.has(b); }
  /** call at the end of every frame */
  endFrame() { this.pressed.clear(); this.released.clear(); this.mdown.clear(); this.mup.clear(); this.wheel = 0; }
  /** first connected gamepad with the standard layout that has actually been used (stops idle or odd devices —
   *  wheels, flight sticks, virtual pads — from holding a stick or trigger down) */
  pad() {
    const ps = navigator.getGamepads?.(); if (!ps) return null;
    for (const p of ps) {
      if (!p || !p.connected || p.mapping !== 'standard') continue;
      if (!this.padLive?.has(p.index)) {
        if (!p.buttons.some(b => b.pressed) && !p.axes.some(a => Math.abs(a) > 0.6)) continue;
        (this.padLive ||= new Set()).add(p.index);
      }
      return p;
    }
    return null;
  }
}
