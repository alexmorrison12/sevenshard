// Skills: skill list with levels (+/−), skill points, tripod picker (3 tiers, unlock at Lv 4/7/10), and the 8-slot
// bar (drag a skill from the list onto a slot, or click a skill then a slot).
//   data: { cls, points, pointsTotal?, skills: [Skill + { learned, lvlReq }], bar: [skillId|null ×8] (Q W E R A S D F),
//           selected? }
// Actions: skills:level { id, delta } · skills:tripod { id, tier, index } · skills:assign { id, key, slot } ·
//          skills:reset { id } · skills:select { id }
import { h, btn, esc, fmtInt, clear } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { iconUrl } from '../core/icon.js';
import { SKILL_KEYS, SKILL_TYPES, STAGGER } from '../core/data.js';
import { draggable } from '../core/drag.js';
import { Win } from '../core/windows.js';

const UNLOCK = [4, 7, 10];

export class SkillsWin extends Win {
  static id = 'skills'; static title = 'Skills'; static glyph = 'skills'; static width = 1000;
  build() {
    const b = this.body;
    b.classList.add('ss-skw');
    const top = h('div', 'ss-skw-top', b);
    this.pts = h('div', 'ss-skw-pts', top);
    this.hint = h('div', 'ss-skw-hint', top, 'Drag a skill onto the bar · Right-click a bar slot to clear it');
    const main = h('div', 'ss-skw-main', b);
    this.list = h('div', 'ss-skw-list ss-scroll', main);
    this.det = h('div', 'ss-skw-det ss-scroll', main);
    const barWrap = h('div', 'ss-skw-barwrap', b);
    h('div', 'ss-label', barWrap, 'Skill Bar');
    this.bar = h('div', 'ss-skw-bar', barWrap);
    this.sel = null; this.pick = null;
  }
  render(d) {
    this.d = d;
    const skills = d.skills || [];
    if (!this.sel || !skills.find(s => s.id === this.sel)) this.sel = d.selected || skills[0]?.id;
    this.pts.innerHTML = `<span>Skill Points</span><b>${fmtInt(d.points ?? 0)}</b>${d.pointsTotal ? `<em>/ ${fmtInt(d.pointsTotal)}</em>` : ''}`;
    // list
    clear(this.list);
    for (const s of skills) {
      const row = h('div', 'ss-skw-row ss-ptr' + (s.id === this.sel ? ' is-sel' : '') + (s.learned === false ? ' is-locked' : ''), this.list);
      row.setAttribute('role', 'button'); row.tabIndex = 0;
      const ic = h('div', 'ss-skw-ic', row);
      ic.style.backgroundImage = `url("${iconUrl(s.icon, 44)}")`;
      if (s.learned !== false) draggable(ic, () => ({ type: 'skill', skill: s, icon: s.icon }));
      const onBar = (d.bar || []).indexOf(s.id);
      if (onBar >= 0) h('span', 'ss-skw-key', ic, SKILL_KEYS[onBar]);
      const tx = h('div', 'ss-skw-tx', row);
      tx.innerHTML = `<b>${esc(s.name)}</b><span>${esc(SKILL_TYPES[s.type] || s.type || '')}${s.learned === false ? ` · Learn at Lv ${esc(s.lvlReq ?? '?')}` : ''}</span>`;
      const tri = h('div', 'ss-skw-tri', row);
      (s.tripods || []).forEach((tier, i) => { const p = (tier || []).some(t => t.picked); h('i', `ss-tri${i + 1}` + (p ? ' on' : (s.level || 0) >= UNLOCK[i] ? ' open' : ''), tri); });
      const lv = h('div', 'ss-skw-lv', row);
      const minus = btn('ss-btn ss-btn--sm ss-btn--icon', lv, null, e => { e.stopPropagation(); this.ui.emit('skills:level', { id: s.id, delta: -1 }); }, `Lower ${s.name}`);
      minus.innerHTML = glyph('minus'); minus.disabled = !(s.level > 1);
      h('b', '', lv, s.learned === false ? '–' : `${s.level ?? 1}`);
      const plus = btn('ss-btn ss-btn--sm ss-btn--icon', lv, null, e => { e.stopPropagation(); this.ui.emit('skills:level', { id: s.id, delta: 1 }); }, `Raise ${s.name}`);
      plus.innerHTML = glyph('plus'); plus.disabled = s.learned === false || (s.level ?? 1) >= (s.maxLevel || 12) || !(d.points > 0);
      row.addEventListener('click', () => { this.sel = s.id; this.pick = s.learned === false ? null : s.id; this.ui.emit('skills:select', { id: s.id }); this.render(this.d); });
      row.addEventListener('keydown', e => { if (e.key === 'Enter') row.click(); });
      row._tip = () => ({ kind: 'skill', skill: s });
    }
    // detail
    const s = skills.find(x => x.id === this.sel);
    clear(this.det);
    if (s) this.detail(s);
    // bar
    clear(this.bar);
    SKILL_KEYS.forEach((k, i) => {
      const id = (d.bar || [])[i];
      const sk = skills.find(x => x.id === id);
      const c = h('div', 'ss-skw-slot ss-ptr' + (this.pick ? ' is-pick' : ''), this.bar);
      c.setAttribute('role', 'button');
      if (sk) c.style.backgroundImage = `url("${iconUrl(sk.icon, 46)}")`;
      h('span', 'ss-skw-k', c, k);
      c._tip = sk ? () => ({ kind: 'skill', skill: { ...sk, key: k } }) : { title: `Slot ${k}`, lines: ['Drag a skill here.'] };
      c._drop = p => p.type === 'skill' ? () => this.ui.emit('skills:assign', { id: p.skill.id, key: k, slot: i }) : null;
      c.addEventListener('click', () => { if (this.pick) { this.ui.emit('skills:assign', { id: this.pick, key: k, slot: i }); this.pick = null; } });
      c.addEventListener('contextmenu', e => { e.preventDefault(); if (sk) this.ui.emit('skills:assign', { id: null, key: k, slot: i }); });
      if (sk) draggable(c, () => ({ type: 'skill', skill: sk, icon: sk.icon, from: i }));
    });
  }
  detail(s) {
    const D = this.det;
    const hd = h('div', 'ss-skw-dhd', D);
    hd.innerHTML = `<div class="ss-skw-dic" style="background-image:url('${iconUrl(s.icon, 64)}')"></div>
      <div><div class="ss-skw-dname">${esc(s.name)}</div><div class="ss-skw-dtype">${esc(SKILL_TYPES[s.type] || '')} · Lv ${esc(s.level ?? 1)} / ${esc(s.maxLevel || 12)}</div>
      <div class="ss-skw-dmeta">${s.cd ? `<span>${glyph('clock')} ${s.cd}s</span>` : ''}${s.mana ? `<span class="ss-mp">◆ ${fmtInt(s.mana)} MP</span>` : ''}${s.stagger ? `<span>Stagger <b>${esc(STAGGER[String(s.stagger).toLowerCase()] || s.stagger)}</b></span>` : ''}${s.weakPoint ? `<span>Weak Point <b>${s.weakPoint}</b></span>` : ''}${s.counter ? '<span class="ss-ctr">★ Counter</span>' : ''}${s.attack ? `<span class="ss-atk">${esc(s.attack)} Attack</span>` : ''}</div></div>`;
    if (s.desc) h('p', 'ss-skw-desc', D, s.desc);
    h('div', 'ss-h', D, 'Tripods');
    const tiers = h('div', 'ss-skw-tiers', D);
    (s.tripods || [[], [], []]).forEach((tier, i) => {
      const open = (s.level || 0) >= UNLOCK[i];
      const row = h('div', `ss-skw-tier ss-tri${i + 1}` + (open ? '' : ' is-locked'), tiers);
      const lab = h('div', 'ss-skw-tl', row);
      lab.innerHTML = `<b>${['I', 'II', 'III'][i]}</b><span>${open ? `Tier ${i + 1}` : `Lv ${UNLOCK[i]}`}</span>`;
      const opts = h('div', 'ss-skw-topts', row);
      (tier || []).forEach((t, j) => {
        const o = btn('ss-skw-trip' + (t.picked ? ' is-on' : ''), opts, null, () => { if (open) this.ui.emit('skills:tripod', { id: s.id, tier: i, index: j }); }, t.name);
        o.disabled = !open;
        o.setAttribute('aria-pressed', !!t.picked);
        o.innerHTML = `<i style="background-image:url('${iconUrl(t.icon || 'tripod:' + t.id, 30)}')"></i><div><b>${esc(t.name)}</b><span>${esc(t.desc || '')}</span></div>`;
      });
      if (!open) h('div', 'ss-skw-lockmsg', row, `Reach skill level ${UNLOCK[i]} to unlock`);
    });
    const ft = h('div', 'ss-skw-dft', D);
    const r = btn('ss-btn ss-btn--sm ss-btn--ghost', ft, null, () => this.ui.emit('skills:reset', { id: s.id }), 'Reset skill');
    r.innerHTML = glyph('refresh') + '<span>Reset skill points</span>';
  }
}
