// Raw input: keys, mouse buttons, pointer position, wheel, gamepad. Game code reads state and per-frame edges.
// Typing in a text field suspends game keys. Right-click context menus are suppressed over the game canvas.
export const DEFAULT_BINDS = {
  skill0: 'KeyQ', skill1: 'KeyW', skill2: 'KeyE', skill3: 'KeyR', skill4: 'KeyA', skill5: 'KeyS', skill6: 'KeyD', skill7: 'KeyF',
  dash: 'Space', idZ: 'KeyZ', idX: 'KeyX', awaken: 'KeyV', basic: 'KeyC',
  item0: 'Digit1', item1: 'Digit2', item2: 'Digit3', item3: 'Digit4',
  interact: 'KeyG', mount: 'KeyT', map: 'KeyM', overlay: 'Tab', inventory: 'KeyI', character: 'KeyP', skills: 'KeyK',
  quests: 'KeyJ', guild: 'KeyU', social: 'KeyO', engravings: 'KeyN', tome: 'KeyL', compass: 'KeyH', songs: 'KeyB', emotes: 'Period',
  chat: 'Enter', menu: 'Escape', photo: 'F12', meter: 'KeyY', pet: 'KeyL',
};

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
    addEventListener('keyup', e => { this.keys.delete(e.code); this.released.add(e.code); });
    addEventListener('blur', () => { for (const k of this.keys) this.released.add(k); this.keys.clear(); this.mouse.buttons = 0; });
    const onUI = e => e.target !== el;
    addEventListener('pointermove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.over = !onUI(e); });
    addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') return;
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (onUI(e)) return;
      this.mouse.buttons |= 1 << e.button; this.mdown.add(e.button);
      el.focus?.();
    });
    addEventListener('pointerup', e => { if (e.pointerType === 'touch') return; if (this.mouse.buttons & (1 << e.button)) this.mup.add(e.button); this.mouse.buttons &= ~(1 << e.button); });
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('wheel', e => { this.wheel += e.deltaY; e.preventDefault(); }, { passive: false });
  }
  isGameKey(code) { return Object.values(this.binds).includes(code) && code !== 'F12'; }
  down(action) { return this.keys.has(this.binds[action]); }
  hit(action) { return this.pressed.has(this.binds[action]); }
  up(action) { return this.released.has(this.binds[action]); }
  btn(b) { return !!(this.mouse.buttons & (1 << b)); }
  clicked(b) { return this.mdown.has(b); }
  /** call at the end of every frame */
  endFrame() { this.pressed.clear(); this.released.clear(); this.mdown.clear(); this.mup.clear(); this.wheel = 0; }
  /** first connected gamepad (standard mapping) or null */
  pad() { const ps = navigator.getGamepads?.(); if (!ps) return null; for (const p of ps) if (p && p.connected) return p; return null; }
}
