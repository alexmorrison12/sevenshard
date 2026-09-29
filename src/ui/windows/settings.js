// Settings: Graphics · Audio · Gameplay · Interface · Keybinds. Every change emits 'settings:change' with the key,
// the new value and the full values object (the game persists and applies them). UI-owned settings (uiScale,
// touch layout) are also applied immediately by the UI itself.
//   data: { values: { quality, renderScale, shadows, bloom, fps, master, music, sfx, ambience, moveButton,
//                     damageNumbers, cameraShake, othersFx (0 | 0.35 | 1), telegraphs, quickCast, uiScale, chatOpacity, touch },
//           keybinds: [{ action, keys: [] }] }
// Actions: settings:change { key, value, values } · settings:rebind { action } · settings:reset {}
import { h, btn, clear, esc } from '../core/util.js';
import { tabs, toggle, range, seg, select } from '../core/kit.js';
import { Win } from '../core/windows.js';

export const DEFAULT_SETTINGS = {
  quality: 'high', renderScale: 1, shadows: true, bloom: true, fps: 'vsync',
  master: 0.8, music: 0.6, sfx: 0.8, ambience: 0.5, mute: false,
  moveButton: 'right', damageNumbers: true, cameraShake: 1, othersFx: 0.35, telegraphs: true, quickCast: false, autoLoot: true,
  uiScale: 1, chatOpacity: 0.5, buffTimers: true, touch: false,
};
export const DEFAULT_KEYBINDS = [
  { action: 'Skills', keys: ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F'] }, { action: 'Identity', keys: ['Z', 'X'] }, { action: 'Awakening', keys: ['V'] },
  { action: 'Dash / Stand Up', keys: ['Space'] }, { action: 'Basic Attack', keys: ['C'] }, { action: 'Battle Items', keys: ['1', '2', '3', '4'] },
  { action: 'Interact', keys: ['G'] }, { action: 'Mount', keys: ['T'] }, { action: 'Ping', keys: ['Alt', 'Click'] },
  { action: 'Character Profile', keys: ['P'] }, { action: 'Inventory', keys: ['I'] }, { action: 'Skills Window', keys: ['K'] },
  { action: 'Engravings', keys: ['N'] }, { action: 'World Map', keys: ['M'] }, { action: 'Guild', keys: ['U'] }, { action: 'Party Finder', keys: ['O'] },
  { action: 'Chat', keys: ['Enter'] }, { action: 'Hide HUD (photo mode)', keys: ['Ctrl', 'Z'] }, { action: 'Game Menu / Close', keys: ['Esc'] },
];
// engine bind ids (src/engine/input.js DEFAULT_BINDS) and KeyboardEvent codes → readable labels
const ACTION_NAMES = { dash: 'Dash / Stand Up', idZ: 'Identity (Z)', idX: 'Identity (X)', awaken: 'Awakening', basic: 'Basic Attack',
  interact: 'Interact', mount: 'Mount', songs: 'Songs', emotes: 'Emotes', compass: 'Event Compass', meter: 'Damage Meter', chat: 'Chat',
  menu: 'Game Menu / Close', photo: 'Photo Mode' };
export const actionLabel = a => ACTION_NAMES[a] || (/^skill\d$/.test(a) ? `Skill ${+a.slice(5) + 1}` : /^item\d$/.test(a) ? `Battle Item ${+a.slice(4) + 1}` : a);
const KEY_NAMES = { Space: 'Space', Enter: 'Enter', Escape: 'Esc', Backquote: '`', Comma: ',', Period: '.', Semicolon: ';', Quote: "'", Slash: '/', Backslash: '\\',
  BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Tab: 'Tab', ShiftLeft: 'Shift', ControlLeft: 'Ctrl', AltLeft: 'Alt', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
export const keyLabel = k => KEY_NAMES[k] || String(k).replace(/^Key([A-Z])$/, '$1').replace(/^Digit(\d)$/, '$1').replace(/^Numpad(\d)$/, 'Num $1');
const OTHERS_FX = [{ id: 'off', label: 'Off', v: 0 }, { id: 'low', label: 'Low', v: 0.35 }, { id: 'full', label: 'Full', v: 1 }];
const TABS = [{ id: 'graphics', label: 'Graphics' }, { id: 'audio', label: 'Audio' }, { id: 'gameplay', label: 'Gameplay' }, { id: 'interface', label: 'Interface' }, { id: 'keys', label: 'Keybinds' }];

export class SettingsWin extends Win {
  static id = 'settings'; static title = 'Settings'; static glyph = 'settings'; static width = 640; static layer = 'modal'; // reachable from the title screen too
  build() {
    const b = this.body;
    b.classList.add('ss-set');
    this.tab = 'graphics';
    this.tabs = tabs(b, TABS, this.tab, id => { this.tab = id; this.fill(); });
    this.pane = h('div', 'ss-set-pane ss-scroll', b);
    const ft = h('div', 'ss-set-ft', b);
    btn('ss-btn ss-btn--ghost ss-btn--sm', ft, 'Restore Defaults', () => { this.v = { ...DEFAULT_SETTINGS }; this.ui.emit('settings:reset', { values: { ...this.v } }); this.apply('uiScale', this.v.uiScale); this.fill(); });
    h('i', 'ss-rs-sp', ft);
    btn('ss-btn ss-btn--primary', ft, 'Done', () => this.mgr.close(this.id));
  }
  render(d) { this.v = { ...DEFAULT_SETTINGS, ...(d.values || {}) }; this.keybinds = d.keybinds || DEFAULT_KEYBINDS; this.fill(); }
  set(key, value) {
    this.v[key] = value;
    this.apply(key, value);
    this.ui.emit('settings:change', { key, value, values: { ...this.v } });
  }
  apply(key, value) {
    if (key === 'uiScale') this.ui.setScale(value);
    if (key === 'touch') this.ui.setTouch(!!value);
    if (key === 'chatOpacity') this.ui.root.style.setProperty('--ss-chat-a', value);
  }
  fill() {
    const p = this.pane, v = this.v;
    clear(p);
    const row = (label, hint) => { const r = h('div', 'ss-set-row', p); const l = h('div', 'ss-set-l', r); h('b', '', l, label); if (hint) h('span', '', l, hint); return h('div', 'ss-set-c', r); };
    const head = t => h('div', 'ss-h ss-set-h', p, t);
    const pct = x => Math.round(x * 100) + '%';
    if (this.tab === 'graphics') {
      head('Display');
      seg(row('Quality', 'Shadows, bloom, crowd detail'), [{ id: 'low', label: 'Low' }, { id: 'medium', label: 'Medium' }, { id: 'high', label: 'High' }, { id: 'ultra', label: 'Ultra' }], v.quality, x => this.set('quality', x));
      range(row('Render Scale', 'Lower = faster on weak GPUs'), { min: 0.5, max: 1, step: 0.05, value: v.renderScale, fmt: pct, onChange: x => this.set('renderScale', x) });
      select(row('Frame Rate'), [{ id: 'vsync', label: 'V-Sync' }, { id: '30', label: '30 fps' }, { id: '60', label: '60 fps' }, { id: '120', label: '120 fps' }, { id: 'unlimited', label: 'Unlimited' }], v.fps, x => this.set('fps', x));
      head('Effects');
      toggle(row('Shadows'), null, v.shadows, x => this.set('shadows', x));
      toggle(row('Bloom & Glow'), null, v.bloom, x => this.set('bloom', x));
    } else if (this.tab === 'audio') {
      head('Volume');
      for (const [k, l] of [['master', 'Master'], ['music', 'Music'], ['sfx', 'Effects'], ['ambience', 'Ambience']]) range(row(l), { min: 0, max: 1, step: 0.01, value: v[k], fmt: pct, onChange: x => this.set(k, x) });
      toggle(row('Mute All'), null, v.mute, x => this.set('mute', x));
    } else if (this.tab === 'gameplay') {
      head('Controls');
      seg(row('Movement Button', 'Click to move with'), [{ id: 'left', label: 'Left Click' }, { id: 'right', label: 'Right Click' }], v.moveButton, x => this.set('moveButton', x));
      toggle(row('Quick Cast', 'Point skills cast instantly at the cursor'), null, v.quickCast, x => this.set('quickCast', x));
      toggle(row('Auto-Loot', 'Pick up nearby loot automatically'), null, v.autoLoot, x => this.set('autoLoot', x));
      head('Combat');
      toggle(row('Damage Numbers'), null, v.damageNumbers, x => this.set('damageNumbers', x));
      range(row('Camera Shake'), { min: 0, max: 1, step: 0.05, value: v.cameraShake, fmt: x => x === 0 ? 'Off' : pct(x), onChange: x => this.set('cameraShake', x) });
      { // other players' skill effects: Off / Low / Full → 0 / 0.35 / 1
        const cur = v.othersFx ?? 0.35, near = OTHERS_FX.reduce((a, b) => Math.abs(b.v - cur) < Math.abs(a.v - cur) ? b : a);
        seg(row("Other Players' Effects", 'Skill effects cast by party members and other players'), OTHERS_FX, near.id, id => this.set('othersFx', OTHERS_FX.find(o => o.id === id).v));
      }
      toggle(row('Enemy Telegraphs', 'Show danger zones on the ground'), null, v.telegraphs, x => this.set('telegraphs', x));
    } else if (this.tab === 'interface') {
      head('Interface');
      range(row('UI Scale'), { min: 0.7, max: 1.4, step: 0.05, value: v.uiScale, fmt: pct, onChange: x => this.set('uiScale', x) });
      range(row('Chat Background'), { min: 0, max: 1, step: 0.05, value: v.chatOpacity, fmt: pct, onChange: x => this.set('chatOpacity', x) });
      toggle(row('Buff Timers'), null, v.buffTimers, x => this.set('buffTimers', x));
      toggle(row('Touch Layout', 'Large targets for phones and tablets'), null, v.touch, x => this.set('touch', x));
      const r = row('Window Positions');
      btn('ss-btn ss-btn--sm', r, 'Reset', () => this.mgr.resetPositions());
    } else {
      head('Keybinds');
      const list = h('div', 'ss-set-keys', p);
      for (const k of this.keybinds) {
        const r = h('div', 'ss-set-key', list);
        h('span', '', r, actionLabel(k.action));
        const ks = h('div', '', r);
        ks.innerHTML = (k.keys || []).map(x => `<span class="ss-kbd">${esc(keyLabel(x))}</span>`).join('');
        r.addEventListener('dblclick', () => this.ui.emit('settings:rebind', { action: k.action }));
      }
      h('div', 'ss-set-note', p, 'Double-click a binding to change it.');
    }
  }
}
