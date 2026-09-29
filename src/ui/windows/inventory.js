// Inventory: tabbed grid with grade frames, stack counts, search, sort, currencies.
//   data: { items: [Item], slots?: 60, currencies: { silver, gold, crystals }, tab? }
// Items may carry `pos` (grid index) to keep a player's arrangement; otherwise they fill in order.
// Interactions: right-click = use / equip (or sell while a vendor window is open) · Shift+click = link in chat ·
// drag onto a character slot = equip, onto another cell = move, onto the vendor = sell.
// Actions: inv:use { uid } · inv:equip { uid, slot? } · inv:sell { uid } · inv:move { uid, to } · inv:sort { tab } ·
//          inv:link { uid } · inv:select { uid }
import { h, btn, setText, clear } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { slot, tabs, money } from '../core/kit.js';
import { draggable } from '../core/drag.js';
import { Win } from '../core/windows.js';

export const INV_TABS = [
  { id: 'all', label: 'All', kinds: null },
  { id: 'gear', label: 'Gear', kinds: ['weapon', 'armor', 'accessory', 'stone', 'bracelet'] },
  { id: 'battle', label: 'Battle', kinds: ['battle', 'consumable', 'food'] },
  { id: 'mats', label: 'Materials', kinds: ['material', 'gem', 'card', 'book'] },
  { id: 'misc', label: 'Misc', kinds: ['quest', 'collectible', 'cosmetic', 'mount', 'pet', 'gift', 'currency'] },
];
const COLS = 9;

export class InventoryWin extends Win {
  static id = 'inventory'; static title = 'Inventory'; static glyph = 'inventory'; static width = 520; static pos = 'right';
  build() {
    const b = this.body;
    b.classList.add('ss-inv');
    this.tab = 'all'; this.q = '';
    this.tabs = tabs(b, INV_TABS.map(t => ({ id: t.id, label: t.label })), 'all', id => { this.tab = id; this.fill(); });
    const tools = h('div', 'ss-inv-tools', b);
    const search = this.search = h('input', 'ss-input ss-inv-search', tools);
    search.type = 'search'; search.placeholder = 'Search items'; search.setAttribute('aria-label', 'Search items');
    search.addEventListener('input', () => { this.q = search.value.trim().toLowerCase(); this.fill(); });
    search.addEventListener('keydown', e => e.stopPropagation());
    const sort = btn('ss-btn ss-btn--sm', tools, null, () => { this.ui.emit('inv:sort', { tab: this.tab }); this.localSort = !this.localSort; this.fill(); }, 'Sort items');
    sort.innerHTML = glyph('sort') + '<span>Sort</span>';
    this.grid = h('div', 'ss-inv-grid', b);
    this.grid.style.setProperty('--cols', COLS);
    const ft = h('div', 'ss-inv-ft', b);
    this.moneyEl = h('div', '', ft);
    this.count = h('div', 'ss-inv-count', ft);
  }
  render(d) {
    this.d = d;
    const items = d.items || [];
    for (const t of INV_TABS) { const b = this.tabs.map[t.id]; const n = t.kinds ? items.filter(i => t.kinds.includes(i.kind)).length : items.length; b.querySelector('.ss-count')?.remove(); if (t.id !== 'all') b.insertAdjacentHTML('beforeend', `<span class="ss-count">${n}</span>`); }
    clear(this.moneyEl); money(this.moneyEl, d.currencies || {});
    this.fill();
  }
  fill() {
    const d = this.d || {}, items = d.items || [], cap = d.slots || 60;
    const t = INV_TABS.find(x => x.id === this.tab);
    let list = items.filter(i => (!t.kinds || t.kinds.includes(i.kind)) && (!this.q || String(i.name).toLowerCase().includes(this.q)));
    if (this.localSort) list = [...list].sort((a, b) => (b.grade || 0) - (a.grade || 0) || String(a.kind).localeCompare(b.kind) || String(a.name).localeCompare(b.name));
    const filtered = t.kinds || this.q || this.localSort;
    const cells = new Array(filtered ? Math.max(list.length, 0) : cap).fill(null);
    if (!filtered) {
      const free = [];
      for (const it of list) { if (it.pos != null && it.pos < cap && !cells[it.pos]) cells[it.pos] = it; else free.push(it); }
      let k = 0; for (const it of free) { while (k < cap && cells[k]) k++; if (k < cap) cells[k++] = it; }
    } else list.forEach((it, i) => { cells[i] = it; });
    const rows = Math.max(Math.ceil(cells.length / COLS), filtered ? 1 : Math.ceil(cap / COLS));
    while (cells.length < rows * COLS) cells.push(undefined);
    clear(this.grid);
    const vendorOpen = this.ui.isOpen('vendor');
    cells.forEach((it, i) => {
      const locked = !filtered && i >= cap;
      const s = slot(it || null, {
        size: 48, dim: locked,
        hint: it ? (vendorOpen ? 'Right-click to sell · Shift+click to link' : ['weapon', 'armor', 'accessory', 'stone', 'bracelet'].includes(it.kind) ? 'Right-click to equip · Shift+click to link' : it.use ? 'Right-click to use · Shift+click to link' : 'Shift+click to link') : null,
        onClick: it ? (x, e) => { if (e.shiftKey) this.ui.emit('inv:link', { uid: it.uid }); else this.ui.emit('inv:select', { uid: it.uid }); } : null,
        onContext: it ? () => this.use(it) : null,
      });
      if (it) draggable(s, () => ({ type: 'item', item: it }));
      if (!filtered && !locked) s._drop = p => p.type === 'item' && p.item.uid !== it?.uid ? () => this.ui.emit('inv:move', { uid: p.item.uid, to: i }) : null;
      this.grid.appendChild(s);
    });
    setText(this.count, `${items.length} / ${cap}`);
    this.count.classList.toggle('is-full', items.length >= cap);
  }
  use(it) {
    if (this.ui.isOpen('vendor')) return this.ui.emit('inv:sell', { uid: it.uid });
    if (['weapon', 'armor', 'accessory', 'stone', 'bracelet'].includes(it.kind)) return this.ui.emit('inv:equip', { uid: it.uid, slot: it.slot });
    this.ui.emit('inv:use', { uid: it.uid });
  }
}
