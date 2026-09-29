// Gems: 11 sockets (honeycomb), each holding a Ruinstone (damage) or Swiftstone (cooldown) bound to a skill;
// the gem bag; and fusion (3 gems of the same type and level → 1 of the next level).
//   data: { sockets: [{ gem: Gem|null, skill?: { id, name, icon } } ×11], gems: [Gem], skills: [{ id, name, icon }],
//           fuseCost?: { silver }, currencies? }
//   Gem = { uid, gem: 'ruin'|'swift', level, name, grade, icon, desc? }
// Actions: gems:socket { uid, slot } · gems:unsocket { slot } · gems:target { slot, skill } · gems:fuse { uids: [3] }
import { h, btn, fmtInt, clear } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { iconUrl, itemIcon } from '../core/icon.js';
import { slot, select } from '../core/kit.js';
import { draggable } from '../core/drag.js';
import { Win } from '../core/windows.js';

const LAYOUT = [[0, 0], [1, 0], [2, 0], [3, 0], [0.5, 1], [1.5, 1], [2.5, 1], [0, 2], [1, 2], [2, 2], [3, 2]];
export class GemsWin extends Win {
  static id = 'gems'; static title = 'Gems'; static glyph = 'gem'; static width = 900;
  build() {
    const b = this.body; b.classList.add('ss-gm2');
    const L = h('div', 'ss-gm2-l', b);
    h('div', 'ss-h', L, 'Sockets');
    this.comb = h('div', 'ss-gm2-comb', L);
    this.sum = h('div', 'ss-gm2-sum', L);
    const R = h('div', 'ss-gm2-r', b);
    h('div', 'ss-h', R, 'Gem Bag');
    this.bag = h('div', 'ss-gm2-bag ss-scroll', R);
    h('div', 'ss-h', R, 'Fusion');
    this.fuse = h('div', 'ss-gm2-fuse', R);
    this.pick = [];
  }
  render(d) {
    this.d = d;
    const sockets = d.sockets || [];
    clear(this.comb);
    LAYOUT.forEach(([cx, cy], i) => {
      const s = sockets[i] || {};
      const hx = h('div', 'ss-hex ss-ptr' + (s.gem ? ` is-full is-${s.gem.gem}` : ''), this.comb);
      hx.style.left = (cx * 104) + 'px'; hx.style.top = (cy * 92) + 'px';
      if (s.gem) {
        hx.innerHTML = `<i class="ss-hex-g" style="background-image:url('${itemIcon(s.gem.icon || `item:gem:${s.gem.gem}:${s.gem.level}`, 64)}')"></i><b>${s.gem.level}</b>${s.skill ? `<i class="ss-hex-s" style="background-image:url('${iconUrl(s.skill.icon, 26)}')"></i>` : ''}`;
        hx._tip = { kind: 'item', item: { ...s.gem, kind: 'gem', desc: s.gem.desc, hint: null } };
        hx.addEventListener('contextmenu', e => { e.preventDefault(); this.ui.emit('gems:unsocket', { slot: i }); });
      } else hx.innerHTML = `<span>${i + 1}</span>`;
      hx._drop = p => p.type === 'item' && p.item.kind === 'gem' ? () => this.ui.emit('gems:socket', { uid: p.item.uid, slot: i }) : null;
      hx.addEventListener('click', () => { this.sel = i; this.render(this.d); });
      if (this.sel === i) hx.classList.add('is-sel');
    });
    // selected socket: bind a skill
    clear(this.sum);
    const s = sockets[this.sel];
    if (this.sel != null && s && s.gem) {
      h('span', 'ss-label', this.sum, `Socket ${this.sel + 1} · ${s.gem.gem === 'ruin' ? 'Damage' : 'Cooldown'}`);
      select(this.sum, [{ id: '', label: 'Choose a skill…' }, ...(d.skills || []).map(k => ({ id: k.id, label: k.name }))], s.skill?.id || '', v => v && this.ui.emit('gems:target', { slot: this.sel, skill: v }));
      btn('ss-btn ss-btn--sm ss-btn--ghost', this.sum, 'Unsocket', () => this.ui.emit('gems:unsocket', { slot: this.sel }));
    } else {
      const ruin = sockets.filter(x => x.gem?.gem === 'ruin').length, swift = sockets.filter(x => x.gem?.gem === 'swift').length;
      this.sum.innerHTML = `<span class="ss-gm2-k is-ruin">${glyph('flame')} ${ruin} Ruinstones</span><span class="ss-gm2-k is-swift">${glyph('clock')} ${swift} Swiftstones</span><span class="ss-dim">Drag gems onto sockets · Right-click to unsocket</span>`;
    }
    // bag
    clear(this.bag);
    const gems = [...(d.gems || [])].sort((a, b) => (b.level - a.level) || String(a.gem).localeCompare(b.gem));
    for (const g of gems) {
      const sel = this.pick.includes(g.uid);
      const sl = slot(g, { size: 48, sel, onClick: () => this.toggle(g), hint: 'Click to add to fusion · Drag onto a socket' });
      h('span', 'ss-gm2-lv', sl, 'Lv ' + g.level);
      draggable(sl, () => ({ type: 'item', item: g }));
      this.bag.appendChild(sl);
    }
    if (!gems.length) h('div', 'ss-empty ss-gm2-none', this.bag, 'No spare gems. Chaos Dungeons and Guardian Raids drop Ruinstones and Swiftstones.');
    // fusion
    this.pick = this.pick.filter(u => gems.find(g => g.uid === u));
    clear(this.fuse);
    const ins = this.pick.map(u => gems.find(g => g.uid === u));
    const row = h('div', 'ss-gm2-frow', this.fuse);
    for (let i = 0; i < 3; i++) row.appendChild(slot(ins[i] || null, { size: 52, empty: { tip: 'Pick three gems of the same type and level' }, onClick: ins[i] ? () => this.toggle(ins[i]) : null }));
    h('span', 'ss-gm2-arrow', row).innerHTML = glyph('right');
    const ok = ins.length === 3 && ins.every(x => x.gem === ins[0].gem && x.level === ins[0].level) && ins[0].level < 10;
    const out = ok ? { name: `Lv.${ins[0].level + 1} ${ins[0].gem === 'ruin' ? 'Ruinstone' : 'Swiftstone'}`, gem: ins[0].gem, level: ins[0].level + 1, grade: Math.min(7, 2 + Math.floor((ins[0].level + 1) / 2)), icon: `item:gem:${ins[0].gem}:${ins[0].level + 1}`, kind: 'gem' } : null;
    row.appendChild(slot(out, { size: 60, empty: { tip: 'Result' } }));
    const ft = h('div', 'ss-gm2-fft', this.fuse);
    const c = d.fuseCost || {};
    h('span', 'ss-gm2-cost', ft).innerHTML = c.silver ? `<i style="background-image:url('${iconUrl('currency:silver', 16)}')"></i>${fmtInt(c.silver)}` : '';
    const f = btn('ss-btn ss-btn--primary', ft, 'Fuse', () => { this.ui.emit('gems:fuse', { uids: [...this.pick] }); this.pick = []; });
    f.disabled = !ok;
    if (ins.length === 3 && !ok) h('span', 'ss-gm2-warn', ft, 'Gems must share type and level');
  }
  toggle(g) {
    const i = this.pick.indexOf(g.uid);
    if (i >= 0) this.pick.splice(i, 1); else if (this.pick.length < 3) this.pick.push(g.uid);
    this.render(this.d);
  }
}
