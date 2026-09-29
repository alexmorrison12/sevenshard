// Bottom-right menu strip. Clicking toggles the matching UI window (when the UI owns one) and always emits
// 'hud:menu' { id } so the game can open its own screens or push fresh data with ui.update(id, data).
import { h, setText, show, btn } from '../core/util.js';
import { glyph } from '../core/glyphs.js';

export const MENU = [
  { id: 'character', g: 'character', label: 'Character Profile', key: 'P' },
  { id: 'inventory', g: 'inventory', label: 'Inventory', key: 'I' },
  { id: 'skills', g: 'skills', label: 'Skills', key: 'K' },
  { id: 'engravings', g: 'engravings', label: 'Engravings', key: 'N' },
  { id: 'cards', g: 'cards', label: 'Cards', key: '' },
  { id: 'map', g: 'map', label: 'World Map', key: 'M' },
  { id: 'guild', g: 'guild', label: 'Guild', key: 'U' },
  { id: 'market', g: 'market', label: 'Market', key: '' },
  { id: 'mail', g: 'mail', label: 'Mail', key: '' },
  { id: 'stronghold', g: 'stronghold', label: 'Stronghold', key: '' },
  { id: 'tome', g: 'tome', label: 'Adventure Tome', key: 'L' },
  { id: 'partyfinder', g: 'finder', label: 'Party Finder', key: 'O' },
  { id: 'settings', g: 'settings', label: 'Settings', key: 'Esc' },
];

export class MenuStrip {
  constructor(ui, parent) {
    this.ui = ui;
    const el = this.el = h('nav', 'ss-menu', parent);
    el.setAttribute('aria-label', 'Game menu');
    this.btns = {}; this.badges = {};
    for (const m of MENU) {
      const b = btn('ss-menu-b', el, null, () => ui._menu(m.id), m.label);
      b.innerHTML = glyph(m.g);
      b._tip = { title: m.label, key: m.key };
      this.badges[m.id] = h('span', 'ss-badge ss-menu-badge', b);
      show(this.badges[m.id], false);
      this.btns[m.id] = b;
    }
  }
  /** Notification count on a menu button (0 hides it). */
  badge(id, n) {
    const b = this.badges[id]; if (!b) return;
    show(b, !!n);
    setText(b, n > 99 ? '99+' : n === true ? '!' : n || '');
  }
  setOpen(id, on) { const b = this.btns[id]; if (b) b.classList.toggle('is-open', !!on); }
}
