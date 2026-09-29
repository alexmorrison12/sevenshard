// Game menu (Esc).
//   data: { items?: [{ id, label, glyph }] }            Actions: gamemenu { id }
import { h, btn, esc, clear } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { Win } from '../core/windows.js';

const GM = [
  { id: 'resume', label: 'Resume', g: 'right' }, { id: 'settings', label: 'Settings', g: 'settings' }, { id: 'keys', label: 'Keybinds', g: 'keyboard' },
  { id: 'partyfinder', label: 'Party Finder', g: 'finder' }, { id: 'photo', label: 'Photo Mode', g: 'camera' }, { id: 'help', label: 'Help', g: 'info' },
  { id: 'charselect', label: 'Character Select', g: 'users' }, { id: 'title', label: 'Exit to Title', g: 'exit' },
];

export class GameMenuWin extends Win {
  static id = 'gamemenu'; static title = 'Game Menu'; static glyph = 'menu'; static width = 300;
  build() { this.body.classList.add('ss-gm'); }
  render(d) {
    clear(this.body);
    for (const m of d.items || GM) {
      const b = btn('ss-gm-b', this.body, null, () => this.pick(m.id), m.label);
      b.innerHTML = glyph(m.glyph || m.g || 'right') + `<span>${esc(m.label)}</span>`;
      if (m.id === 'title' || m.id === 'charselect') b.classList.add('is-sep');
    }
  }
  shown() { this.body.querySelector('button')?.focus(); }
  pick(id) {
    this.mgr.close(this.id);
    if (id === 'resume') return;
    if (id === 'settings' || id === 'keys') { const w = this.ui.open('settings'); if (id === 'keys' && w) { w.tab = 'keys'; w.tabs.set('keys'); w.fill(); } }
    if (id === 'photo') this.ui.setHudVisible(false);
    this.ui.emit('gamemenu', { id });
  }
}
