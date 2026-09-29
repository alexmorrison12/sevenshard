// Touch layout support (ui.setTouch(on, opts)). In touch mode the HUD compacts, keeps the bottom-left (virtual
// joystick) and bottom-right (skill buttons) zones clear, and moves chat / menu / quests behind buttons.
// opts.skills = true additionally renders a touch skill cluster (8 skills in an arc, awakening, dash, Z/X, items)
// with the same cooldown sweeps as the desktop bar. It emits:
//   touch:skill { key, phase: 'down'|'up' }    key: 'Q'…'F' | 'V' | 'Space' | 'Z' | 'X' | '1'…'4'
//   hud:interact {}                            the interaction prompt ("G Talk") becomes a tappable button
import { h, btn, setCls, setText } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { Slot } from './skillbar.js';
import { SKILL_KEYS, ITEM_KEYS } from '../core/data.js';

export class TouchLayer {
  constructor(ui, layer) {
    this.ui = ui; this.on = false; this.skillsOn = false;
    const el = this.el = h('div', 'ss-tl', layer);
    const bar = h('div', 'ss-tl-btns', el);
    const mk = (g, label, fn) => { const b = btn('ss-tl-b', bar, null, fn, label); b.innerHTML = glyph(g) + `<span>${label}</span>`; return b; };
    this.bMenu = mk('menu', 'Menu', () => this.toggle('menu'));
    this.bChat = mk('chat', 'Chat', () => this.toggle('chat'));
    this.bQuest = mk('quest', 'Quests', () => this.toggle('quests'));
    this.scrim = h('div', 'ss-tl-scrim', el);
    this.scrim.addEventListener('click', () => this.toggle(null));
    this.open = null;
    this.skills = null;
  }
  set(on, o = {}) {
    this.on = on;
    this.el.style.display = on ? '' : 'none';
    if (!on) this.toggle(null);
    this.skillsOn = on && !!o.skills;
    if (this.skillsOn && !this.skills) this.buildSkills();
    if (this.skills) this.skills.el.style.display = this.skillsOn ? '' : 'none';
    setCls(this.ui.root, 'ss-touch-skills', this.skillsOn);
    // quests start collapsed on small screens
    if (on) this.ui.hud?.quests?.collapse(true);
  }
  /** Open one of the touch sheets ('menu' | 'chat' | 'quests') or close all (null). */
  toggle(which) {
    this.open = this.open === which ? null : which;
    const r = this.ui.root;
    setCls(r, 'ss-tl-menu', this.open === 'menu');
    setCls(r, 'ss-tl-chat', this.open === 'chat');
    setCls(this.bMenu, 'is-on', this.open === 'menu');
    setCls(this.bChat, 'is-on', this.open === 'chat');
    setCls(this.bQuest, 'is-on', this.open === 'quests');
    setCls(this.scrim, 'is-on', this.open === 'menu' || this.open === 'chat');
    if (this.ui.hud) this.ui.hud.quests.collapse(this.open !== 'quests');
    if (this.open === 'chat') setTimeout(() => this.ui.chat?.input?.focus(), 50);
  }
  buildSkills() {
    const el = h('div', 'ss-tsk', this.el);
    const press = (key, phase) => this.ui.emit('touch:skill', { key, phase });
    const bind = (slot, key) => {
      const e = slot.el;
      e.addEventListener('pointerdown', ev => { ev.preventDefault(); e.setPointerCapture?.(ev.pointerId); slot.press(); press(key, 'down'); });
      const up = () => press(key, 'up');
      e.addEventListener('pointerup', up); e.addEventListener('pointercancel', up);
      e.addEventListener('contextmenu', ev => ev.preventDefault());
    };
    // arc of 8 skills around the dash/basic anchor
    const skills = SKILL_KEYS.map((k, i) => {
      const s = new Slot(el, 'skill', k, 62);
      s.el.classList.add('ss-tsk-s', 'ss-tsk-s' + i);
      bind(s, k); return s;
    });
    const awaken = new Slot(el, 'awaken', 'V', 62); awaken.el.classList.add('ss-tsk-v'); bind(awaken, 'V');
    const dash = new Slot(el, 'dash', 'Space', 76); dash.el.classList.add('ss-tsk-dash'); dash.set({ icon: 'skill:any:dash' }); bind(dash, 'Space');
    const z = btn('ss-tsk-id', el, 'Z'); const x = btn('ss-tsk-id ss-tsk-x', el, 'X');
    for (const [b, k] of [[z, 'Z'], [x, 'X']]) { b.addEventListener('pointerdown', e => { e.preventDefault(); press(k, 'down'); }); b.addEventListener('pointerup', () => press(k, 'up')); }
    const items = ITEM_KEYS.map((k, i) => { const s = new Slot(el, 'item', k, 44); s.el.classList.add('ss-tsk-i', 'ss-tsk-i' + i); bind(s, k); return s; });
    this.skills = { el, skills, awaken, dash, z, x, items };
  }
  update(s) {
    if (!this.skillsOn || !this.skills || !s) return;
    const T = this.skills, mp = s.mp ?? 1e9;
    for (let i = 0; i < 8; i++) {
      const d = (s.skills || [])[i] || null, sl = T.skills[i];
      sl.set(d);
      if (d) { sl.cool(d.cd || 0, d.cdLeft || 0); setCls(sl.el, 'is-nomana', (d.mana || 0) > mp); }
    }
    const aw = s.awaken || null; T.awaken.set(aw); if (aw) T.awaken.cool(aw.cd || 0, aw.cdLeft || 0);
    if (s.dash) T.dash.cool(s.dash.cd || 0, s.dash.cdLeft || 0);
    for (let i = 0; i < 4; i++) {
      const d = (s.items || [])[i] || null, sl = T.items[i];
      sl.set(d, d && (d.icon || 'item:' + d.id), d ? d.grade ?? 1 : undefined);
      if (d) { sl.cool(d.cd || 0, d.cdLeft || 0); setText(sl.n, d.count ?? ''); }
    }
    const id = s.identity;
    const full = id && (id.value >= (id.max || 100) || (id.orbs || 0) > 0);
    setCls(T.z, 'is-ready', !!full);
    setCls(T.x, 'is-ready', !!(id && ((id.orbs || 0) >= 2 || (id.kind === 'stance' && id.value >= (id.max || 100)))));
  }
}
