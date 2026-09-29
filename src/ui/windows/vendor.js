// Vendor / shop: tabs, item rows with price and stock, buy (Shift+click for a quantity), sell by right-clicking
// inventory items or dragging them onto this window, buyback.
//   data: { name, title?, npc?, tabs?: [{ id, label }], items: [{ id, item, price: { cur: 'silver'|'gold'|'crystals'|<id>, amount },
//           stock?, limit?, tab? }], buyback?: [Item + { price }], currencies }
// Actions: vendor:buy { id, qty } · vendor:sell { uid } (drop) · vendor:buyback { uid }
import { h, btn, esc, fmtInt, clear } from '../core/util.js';
import { slot, tabs, money, price } from '../core/kit.js';
import { grade } from '../core/data.js';
import { Win } from '../core/windows.js';

export class VendorWin extends Win {
  static id = 'vendor'; static title = 'Merchant'; static glyph = 'market'; static width = 540; static pos = 'left';
  build() {
    const b = this.body;
    b.classList.add('ss-vd');
    this.hdr = h('div', 'ss-vd-hdr', b);
    this.tabsWrap = h('div', '', b);
    this.list = h('div', 'ss-vd-list ss-scroll', b);
    const ft = h('div', 'ss-vd-ft', b);
    this.moneyEl = h('div', '', ft);
    h('div', 'ss-vd-hint', ft, 'Right-click items in your inventory to sell');
    this.el._drop = p => p.type === 'item' ? () => this.ui.emit('inv:sell', { uid: p.item.uid }) : null;
    this.tab = null;
  }
  shown() { if (this.ui.isOpen('inventory')) this.ui.update('inventory', this.ui.windows.data.get('inventory')); }
  hidden() { if (this.ui.isOpen('inventory')) this.ui.update('inventory', this.ui.windows.data.get('inventory')); }
  render(d) {
    this.d = d;
    this.setTitle(d.title || 'Merchant');
    this.hdr.innerHTML = `<b>${esc(d.name || 'Merchant')}</b>${d.greeting ? `<span>“${esc(d.greeting)}”</span>` : ''}`;
    const tl = [...(d.tabs || [{ id: 'buy', label: 'Buy' }])];
    if (d.buyback) tl.push({ id: '_buyback', label: 'Buyback' });
    if (!this.tab || !tl.find(t => t.id === this.tab)) this.tab = tl[0].id;
    clear(this.tabsWrap);
    tabs(this.tabsWrap, tl, this.tab, id => { this.tab = id; this.fill(); });
    clear(this.moneyEl); money(this.moneyEl, d.currencies || {});
    this.fill();
  }
  fill() {
    const d = this.d, cur = d.currencies || {};
    clear(this.list);
    if (this.tab === '_buyback') {
      for (const it of d.buyback || []) this.row({ id: it.uid, item: it, price: it.price || { cur: 'silver', amount: it.value || 0 } }, cur, true);
      if (!(d.buyback || []).length) h('div', 'ss-empty', this.list, 'Nothing to buy back.');
      return;
    }
    const tl = d.tabs || [{ id: 'buy' }];
    const list = (d.items || []).filter(x => !d.tabs || (x.tab || tl[0].id) === this.tab);
    for (const x of list) this.row(x, cur, false);
    if (!list.length) h('div', 'ss-empty', this.list, 'Sold out.');
  }
  row(x, cur, isBuyback) {
    const it = x.item, g = grade(it.grade);
    const r = h('div', 'ss-vd-row', this.list);
    r.appendChild(slot(it, { size: 44 }));
    const tx = h('div', 'ss-vd-tx', r);
    tx.innerHTML = `<b style="color:${g.c}">${esc(it.name)}${it.count > 1 ? ` <em>×${fmtInt(it.count)}</em>` : ''}</b><span>${x.limit ? `Limit ${x.limit}` : ''}${x.stock != null ? `${x.limit ? ' · ' : ''}Stock ${x.stock}` : ''}</span>`;
    const have = cur[x.price?.cur] ?? Infinity;
    const afford = have >= (x.price?.amount || 0);
    price(r, x.price?.cur, x.price?.amount || 0, afford);
    const b = btn('ss-btn ss-btn--sm', r, isBuyback ? 'Buy Back' : 'Buy', async e => {
      if (isBuyback) return this.ui.emit('vendor:buyback', { uid: it.uid });
      let qty = 1;
      if (e.shiftKey && (x.stock == null || x.stock > 1)) {
        const v = await this.ui.prompt({ title: `Buy ${it.name}`, text: `Price ${fmtInt(x.price?.amount || 0)} each.`, value: '1', ok: 'Buy', maxLength: 4, validate: s => /^\d+$/.test(s) && +s > 0 ? null : 'Enter a number' });
        if (v == null) return; qty = +v;
      }
      this.ui.emit('vendor:buy', { id: x.id, qty });
    }, `Buy ${it.name}`);
    b.disabled = !afford || x.stock === 0;
    if (x.stock === 0) r.classList.add('is-out');
  }
}
