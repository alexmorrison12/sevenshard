// Engravings: active engravings with 15 node pips (5 / 10 / 15 = Lv 1 / 2 / 3), negatives in red, two equipped
// engraving books and the learned library.
//   data: { active: [{ id, nodes, neg?, sources?: [{ name, v }] }], equipped: [{ id, nodes } | null, …2],
//           books: [{ id, nodes }] (learned, nodes = equippable), maxBook?: 12,
//           learned?: [{ id, name, points, max: 80, equipMax }], unread?: [{ uid, engr, name, grade, points }],
//           summary?: { label: '3 3 2 1' } }
// Actions: engr:equip { slot, id } · engr:unequip { slot } · inv:use { uid } (read an unread recipe)
import { h, btn, esc, clear, fmtInt } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { iconUrl, itemIcon } from '../core/icon.js';
import { engr, engrLevel, engrIcon, grade } from '../core/data.js';
import { Win } from '../core/windows.js';

export class EngravingsWin extends Win {
  static id = 'engravings'; static title = 'Engravings'; static glyph = 'engravings'; static width = 780;
  build() {
    const b = this.body;
    b.classList.add('ss-eg');
    const L = h('section', 'ss-eg-l', b);
    const ah = h('div', 'ss-h ss-eg-acth', L); ah.textContent = 'Active Engravings';
    this.build_ = h('em', 'ss-eg-build', ah);
    this.act = h('div', 'ss-eg-act ss-scroll', L);
    const R = h('section', 'ss-eg-r', b);
    h('div', 'ss-h', R, 'Equipped Books');
    this.eq = h('div', 'ss-eg-eq', R);
    h('div', 'ss-h ss-eg-libh', R, 'Library');
    this.lib = h('div', 'ss-eg-lib ss-scroll', R);
    this.unreadH = h('div', 'ss-h ss-eg-libh', R, 'Unread Recipes');
    this.unread = h('div', 'ss-eg-lib ss-eg-unread ss-scroll', R);
  }
  render(d) {
    const max = d.maxBook || 12;
    this.build_.textContent = d.summary?.label ? `Build ${d.summary.label}` : '';
    this.build_.hidden = !d.summary?.label;
    clear(this.act);
    const act = [...(d.active || [])].sort((a, b) => ((a.neg || engr(a.id).neg) ? 1 : 0) - ((b.neg || engr(b.id).neg) ? 1 : 0) || (b.nodes || 0) - (a.nodes || 0));
    if (!act.length) h('div', 'ss-empty', this.act, 'No active engravings. Equip books and accessories with engraving nodes.');
    for (const a of act) {
      const E = engr(a.id), neg = a.neg || E.neg, n = Math.min(15, a.nodes || 0), lv = engrLevel(n);
      const r = h('div', 'ss-eg-row ss-ptr' + (neg ? ' is-neg' : '') + (lv === 0 ? ' is-off' : ''), this.act);
      let pips = '';
      for (let g = 0; g < 3; g++) { pips += '<span>'; for (let k = 0; k < 5; k++) pips += `<i class="${g * 5 + k < n ? 'on' : ''}"></i>`; pips += '</span>'; }
      r.innerHTML = `<i class="ss-eg-ic" style="background-image:url('${iconUrl(engrIcon(a.id), 36)}')"></i>
        <div class="ss-eg-tx"><div class="ss-eg-name">${esc(E.name)}<em>Lv ${lv}</em></div><div class="ss-eg-pips">${pips}<b>${n}/15</b></div><div class="ss-eg-desc">${esc(E.desc || '')}</div></div>`;
      r._tip = { title: `${E.name} · Lv ${lv}`, color: neg ? '#ff8a7a' : null, lines: [E.desc, ...(a.sources || []).map(s => `${s.name}: +${s.v}`), lv < 3 ? `${(lv + 1) * 5 - n} more node${(lv + 1) * 5 - n > 1 ? 's' : ''} to Lv ${lv + 1}` : 'Maximum level'] };
    }
    clear(this.eq);
    const equipped = d.equipped || [null, null];
    for (let i = 0; i < 2; i++) {
      const e = equipped[i];
      const c = h('div', 'ss-eg-book' + (e ? '' : ' is-empty'), this.eq);
      if (e) {
        const E = engr(e.id);
        c.innerHTML = `<i class="ss-eg-ic" style="background-image:url('${iconUrl('item:book:' + e.id, 40, { bare: true })}')"></i><div><b>${esc(E.name)}</b><span>+${Math.min(max, e.nodes || 0)} nodes</span></div>`;
        const x = btn('ss-close', c, null, () => this.ui.emit('engr:unequip', { slot: i }), `Unequip ${E.name}`);
        x.innerHTML = glyph('close');
      } else c.innerHTML = `<i class="ss-eg-ic ss-eg-plus">${glyph('plus')}</i><div><b>Empty Slot ${i + 1}</b><span>Equip a learned book</span></div>`;
    }
    clear(this.lib);
    const books = d.books || [], learned = Object.fromEntries((d.learned || []).map(l => [l.id, l]));
    if (!books.length) h('div', 'ss-empty', this.lib, 'Read engraving recipes to learn books.');
    for (const bk of books) {
      const E = engr(bk.id), L = learned[bk.id];
      const r = h('div', 'ss-eg-lrow', this.lib);
      const on = equipped.findIndex(e => e && e.id === bk.id);
      // learned points (0–80, every 20 = +3 equippable nodes) when the game sends them, else equippable nodes (0–12)
      const f = L ? (L.points || 0) / (L.max || 80) : Math.min(1, (bk.nodes || 0) / max);
      const txt = L ? `${fmtInt(L.points || 0)}/${L.max || 80}` : `+${bk.nodes || 0}`;
      r.innerHTML = `<i class="ss-eg-ic sm" style="background-image:url('${iconUrl(engrIcon(bk.id), 26)}')"></i><div class="ss-eg-ltx"><b>${esc(E.name)}</b><span><u style="width:${(Math.min(1, f) * 100).toFixed(1)}%"></u></span><em>${txt}</em></div>`;
      r._tip = { title: E.name, lines: [E.desc, L ? `${L.points || 0} / ${L.max || 80} points learned` : null, `Equip up to +${bk.nodes || 0} nodes`, L && (L.points || 0) < (L.max || 80) ? 'Every 20 points raise the cap by +3 (max +12).' : null] };
      if (on >= 0) h('span', 'ss-eg-on', r, `Slot ${on + 1}`);
      else for (let i = 0; i < 2; i++) { const b = btn('ss-btn ss-btn--sm', r, `${i + 1}`, () => this.ui.emit('engr:equip', { slot: i, id: bk.id }), `Equip ${E.name} in slot ${i + 1}`); b.disabled = !(bk.nodes > 0); }
    }
    // recipes waiting to be read
    clear(this.unread);
    const un = d.unread || [];
    this.unreadH.hidden = this.unread.hidden = !un.length;
    for (const u of un) {
      const E = engr(u.engr), r = h('div', 'ss-eg-lrow ss-eg-urow', this.unread);
      r.innerHTML = `<i class="ss-slot ss-g${u.grade | 0}" style="--sz:30px"><i class="ss-slot-ic" style="background-image:url('${itemIcon('item:book:' + u.engr, 30)}')"></i></i><div class="ss-eg-ltx"><b style="color:${grade(u.grade | 0).c}">${esc(u.name || E.name)}</b><small>+${fmtInt(u.points || 0)} points of ${esc(E.name)}</small></div>`;
      btn('ss-btn ss-btn--sm ss-btn--primary', r, 'Read', () => this.ui.emit('inv:use', { uid: u.uid }), `Read ${u.name || E.name}`);
    }
  }
}
