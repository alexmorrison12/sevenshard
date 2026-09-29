// Engravings: active engravings with 15 node pips (5 / 10 / 15 = Lv 1 / 2 / 3), negatives in red, two equipped
// engraving books and the learned library.
//   data: { active: [{ id, nodes, neg?, sources?: [{ name, v }] }], equipped: [{ id, nodes } | null, …2],
//           books: [{ id, nodes }], maxBook?: 12 }
// Actions: engr:equip { slot, id } · engr:unequip { slot }
import { h, btn, esc, clear } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { iconUrl } from '../core/icon.js';
import { engr, engrLevel, engrIcon } from '../core/data.js';
import { Win } from '../core/windows.js';

export class EngravingsWin extends Win {
  static id = 'engravings'; static title = 'Engravings'; static glyph = 'engravings'; static width = 780;
  build() {
    const b = this.body;
    b.classList.add('ss-eg');
    const L = h('section', 'ss-eg-l', b);
    h('div', 'ss-h', L, 'Active Engravings');
    this.act = h('div', 'ss-eg-act ss-scroll', L);
    const R = h('section', 'ss-eg-r', b);
    h('div', 'ss-h', R, 'Equipped Books');
    this.eq = h('div', 'ss-eg-eq', R);
    h('div', 'ss-h ss-eg-libh', R, 'Library');
    this.lib = h('div', 'ss-eg-lib ss-scroll', R);
  }
  render(d) {
    const max = d.maxBook || 12;
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
    const books = d.books || [];
    if (!books.length) h('div', 'ss-empty', this.lib, 'Read engraving recipes to learn books.');
    for (const bk of books) {
      const E = engr(bk.id);
      const r = h('div', 'ss-eg-lrow', this.lib);
      const on = equipped.findIndex(e => e && e.id === bk.id);
      r.innerHTML = `<i class="ss-eg-ic sm" style="background-image:url('${iconUrl(engrIcon(bk.id), 26)}')"></i><div class="ss-eg-ltx"><b>${esc(E.name)}</b><span><u style="width:${Math.min(100, (bk.nodes || 0) / 20 * 100)}%"></u></span><em>${bk.nodes || 0}/20</em></div>`;
      if (on >= 0) h('span', 'ss-eg-on', r, `Slot ${on + 1}`);
      else for (let i = 0; i < 2; i++) { const b = btn('ss-btn ss-btn--sm', r, `${i + 1}`, () => this.ui.emit('engr:equip', { slot: i, id: bk.id }), `Equip ${E.name} in slot ${i + 1}`); b.disabled = !(bk.nodes > 0); }
    }
  }
}
