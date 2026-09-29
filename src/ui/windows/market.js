// Market (auction house): Browse (categories, search, results with trend sparklines, price-history chart, buy),
// Sell (tradable items → price, fee), My Listings (cancel), Crystal Exchange (royal crystals ↔ gold).
//   data: { tab?, cats: [{ id, label, subs?: [{ id, label }] }], cat?, sub?, q?,
//           results: [{ id, name, icon, grade, kind, bundle?, lowest, avg?, recent?, stock?, history?: [prices], trend? }],
//           selected?, sellable?: [Item + { suggested }], listings?: [{ id, item: Item, price, qty, left?: s }], fee?: 0..1,
//           exchange?: { rate (gold per 100 crystals), history?: [rates] }, currencies: { silver, gold, crystals } }
// Actions: market:search { q, cat, sub } · market:select { id } · market:buy { id, qty, price } · market:list { uid, price, qty } ·
//          market:cancel { id } · market:exchange { dir: 'crystalsToGold'|'goldToCrystals', amount }
import { h, btn, esc, fmtInt, fmtClock, clear, clamp } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { iconUrl } from '../core/icon.js';
import { slot, tabs, money, price } from '../core/kit.js';
import { grade } from '../core/data.js';
import { Win } from '../core/windows.js';

export function sparkline(values, w = 72, hh = 22, cls = '') {
  const v = (values || []).filter(x => x != null);
  if (v.length < 2) return `<svg class="ss-spark ${cls}" width="${w}" height="${hh}"></svg>`;
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const pts = v.map((x, i) => `${(i / (v.length - 1) * (w - 2) + 1).toFixed(1)},${(hh - 2 - (x - lo) / span * (hh - 4)).toFixed(1)}`).join(' ');
  const up = v[v.length - 1] >= v[0];
  return `<svg class="ss-spark ${cls} ${up ? 'is-up' : 'is-down'}" width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}"><polyline points="${pts}" fill="none" stroke-width="1.5"/></svg>`;
}
function chart(values, w = 330, hh = 120) {
  const v = (values || []).filter(x => x != null);
  if (v.length < 2) return '<div class="ss-empty">No price history yet.</div>';
  const lo = Math.min(...v) * 0.97, hi = Math.max(...v) * 1.03, span = hi - lo || 1;
  const P = v.map((x, i) => [i / (v.length - 1) * w, hh - (x - lo) / span * hh]);
  const line = P.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ');
  const area = `0,${hh} ${line} ${w},${hh}`;
  const grid = [0.25, 0.5, 0.75].map(f => `<line x1="0" x2="${w}" y1="${(hh * f).toFixed(1)}" y2="${(hh * f).toFixed(1)}"/>`).join('');
  const last = P[P.length - 1];
  return `<svg class="ss-mk-chart" width="${w}" height="${hh + 18}" viewBox="0 -4 ${w} ${hh + 22}"><defs><linearGradient id="ssmkg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f3c46a" stop-opacity=".45"/><stop offset="1" stop-color="#f3c46a" stop-opacity="0"/></linearGradient></defs>
    <g class="ss-mk-grid">${grid}</g><polygon points="${area}" fill="url(#ssmkg)"/><polyline points="${line}" fill="none" stroke="#f3c46a" stroke-width="2"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.5" fill="#fff4d0"/>
    <text x="0" y="${hh + 16}">${fmtInt(Math.min(...v))}</text><text x="${w}" y="${hh + 16}" text-anchor="end">${fmtInt(Math.max(...v))}</text></svg>`;
}

export class MarketWin extends Win {
  static id = 'market'; static title = 'Market'; static glyph = 'market'; static width = 1060;
  build() {
    const b = this.body; b.classList.add('ss-mk');
    this.tab = 'browse';
    this.tabs = tabs(b, [{ id: 'browse', label: 'Browse' }, { id: 'sell', label: 'Sell' }, { id: 'listings', label: 'My Listings' }, { id: 'exchange', label: 'Crystal Exchange' }], this.tab, id => { this.tab = id; this.render(this.d); });
    this.pane = h('div', 'ss-mk-pane', b);
    const ft = h('div', 'ss-mk-ft', b);
    this.moneyEl = h('div', '', ft);
    h('span', 'ss-mk-note', ft, 'Listings expire after 3 days. A 5% fee is charged on sales.');
    this.qty = 1;
  }
  render(d) {
    this.d = d = d || {};
    if (d.tab && d.tab !== this._dt) { this._dt = d.tab; this.tab = d.tab; this.tabs.set(d.tab); }
    clear(this.moneyEl); money(this.moneyEl, d.currencies || {});
    clear(this.pane);
    this.pane.dataset.tab = this.tab;
    ({ browse: () => this.browse(d), sell: () => this.sell(d), listings: () => this.listings(d), exchange: () => this.exchange(d) })[this.tab]();
  }
  browse(d) {
    const P = this.pane;
    const side = h('div', 'ss-mk-cats ss-scroll', P);
    for (const c of d.cats || []) {
      btn('ss-mk-cat' + (d.cat === c.id && !d.sub ? ' is-on' : ''), side, c.label, () => this.ui.emit('market:search', { q: d.q || '', cat: c.id }));
      if (d.cat === c.id) for (const s of c.subs || []) btn('ss-mk-sub' + (d.sub === s.id ? ' is-on' : ''), side, s.label, () => this.ui.emit('market:search', { q: d.q || '', cat: c.id, sub: s.id }));
    }
    const mid = h('div', 'ss-mk-mid', P);
    const sb = h('div', 'ss-mk-search', mid);
    const q = h('input', 'ss-input', sb); q.type = 'search'; q.placeholder = 'Search the market'; q.value = d.q || '';
    q.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') this.ui.emit('market:search', { q: q.value.trim(), cat: d.cat, sub: d.sub }); });
    const go = btn('ss-btn', sb, null, () => this.ui.emit('market:search', { q: q.value.trim(), cat: d.cat, sub: d.sub }), 'Search'); go.innerHTML = glyph('finder') + '<span>Search</span>';
    const t = h('div', 'ss-mk-tbl ss-scroll', mid);
    t.innerHTML = `<div class="ss-mk-tr ss-mk-th"><span>Item</span><span>Lowest</span><span>Avg</span><span>7 days</span></div>`;
    const res = d.results || [];
    if (!this.sel || !res.find(r => r.id === this.sel)) this.sel = d.selected || res[0]?.id;
    for (const r of res) {
      const g = grade(r.grade), row = h('div', 'ss-mk-tr ss-ptr' + (r.id === this.sel ? ' is-sel' : ''), t);
      row.innerHTML = `<span class="ss-mk-it"><i class="ss-slot ss-g${r.grade | 0}" style="--sz:34px"><i class="ss-slot-ic" style="background-image:url('${iconUrl(r.icon, 34, { bare: true })}')"></i></i><b style="color:${g.c}">${esc(r.name)}</b>${r.bundle > 1 ? `<em>×${r.bundle}</em>` : ''}</span>
        <span class="ss-mk-p">${fmtInt(r.lowest)}</span><span>${r.avg != null ? fmtInt(r.avg) : '–'}</span><span>${sparkline(r.history, 60, 20)}${r.trend != null ? `<small class="${r.trend >= 0 ? 'ss-good' : 'ss-bad'}">${r.trend >= 0 ? '+' : ''}${r.trend.toFixed(1)}%</small>` : ''}</span>`;
      row.addEventListener('click', () => { this.sel = r.id; this.qty = 1; this.ui.emit('market:select', { id: r.id }); this.render(this.d); });
    }
    if (!res.length) h('div', 'ss-empty', t, 'Nothing matches. Try another category or search.');
    // detail
    const det = h('div', 'ss-mk-det', P);
    const r = res.find(x => x.id === this.sel);
    if (!r) return;
    const hd = h('div', 'ss-mk-dhd', det);
    hd.appendChild(slot({ ...r, count: r.bundle }, { size: 56 }));
    h('div', '', hd).innerHTML = `<b style="color:${grade(r.grade).c}">${esc(r.name)}</b><span>${r.stock != null ? `${fmtInt(r.stock)} listed` : ''}${r.bundle > 1 ? ` · sold in bundles of ${r.bundle}` : ''}</span>`;
    h('div', 'ss-mk-chartw', det).innerHTML = chart(r.history);
    const st = h('div', 'ss-mk-stats', det);
    st.innerHTML = `<div><span>Lowest</span><b>${fmtInt(r.lowest)}</b></div><div><span>Average</span><b>${r.avg != null ? fmtInt(r.avg) : '–'}</b></div><div><span>Last sale</span><b>${r.recent != null ? fmtInt(r.recent) : '–'}</b></div>`;
    const buy = h('div', 'ss-mk-buy', det);
    const qrow = h('div', 'ss-mk-qty', buy);
    h('span', 'ss-label', qrow, 'Quantity');
    const minus = btn('ss-btn ss-btn--sm ss-btn--icon', qrow, null, () => { this.qty = Math.max(1, this.qty - 1); this.render(this.d); }, 'Less'); minus.innerHTML = glyph('minus');
    const qi = h('input', 'ss-input', qrow); qi.value = this.qty; qi.inputMode = 'numeric'; qi.addEventListener('keydown', e => e.stopPropagation());
    qi.addEventListener('change', () => { this.qty = clamp(parseInt(qi.value) || 1, 1, r.stock || 999); this.render(this.d); });
    const plus = btn('ss-btn ss-btn--sm ss-btn--icon', qrow, null, () => { this.qty = Math.min(r.stock || 999, this.qty + 1); this.render(this.d); }, 'More'); plus.innerHTML = glyph('plus');
    const total = this.qty * r.lowest, gold = d.currencies?.gold ?? Infinity;
    const tr = h('div', 'ss-mk-total', buy); h('span', '', tr, 'Total'); price(tr, 'gold', total, gold >= total);
    const b = btn('ss-btn ss-btn--primary ss-mk-bb', buy, 'Buy', () => this.ui.emit('market:buy', { id: r.id, qty: this.qty, price: r.lowest }));
    b.disabled = gold < total || r.stock === 0;
  }
  sell(d) {
    const P = this.pane, items = d.sellable || [];
    const list = h('div', 'ss-mk-sl ss-scroll', P);
    if (!this.sellSel || !items.find(i => i.uid === this.sellSel)) this.sellSel = items[0]?.uid;
    for (const it of items) {
      const r = h('div', 'ss-mk-srow ss-ptr' + (it.uid === this.sellSel ? ' is-sel' : ''), list);
      r.appendChild(slot(it, { size: 40 }));
      h('div', '', r).innerHTML = `<b style="color:${grade(it.grade).c}">${esc(it.name)}</b><span>${it.count > 1 ? '×' + fmtInt(it.count) + ' · ' : ''}${it.suggested ? 'Market ~' + fmtInt(it.suggested) + 'g' : 'No recent sales'}</span>`;
      r.addEventListener('click', () => { this.sellSel = it.uid; this.render(this.d); });
    }
    if (!items.length) h('div', 'ss-empty', list, 'Nothing tradable in your inventory.');
    const it = items.find(i => i.uid === this.sellSel);
    const f = h('div', 'ss-mk-sf', P);
    if (!it) return;
    h('div', 'ss-h', f, 'List for Sale');
    const hd = h('div', 'ss-mk-dhd', f); hd.appendChild(slot(it, { size: 56 })); h('div', '', hd).innerHTML = `<b style="color:${grade(it.grade).c}">${esc(it.name)}</b><span>${it.suggested ? `Suggested price ${fmtInt(it.suggested)} gold` : ''}</span>`;
    const row = (l) => { const r = h('label', 'ss-mk-f', f); h('span', 'ss-label', r, l); return r; };
    const pr = h('input', 'ss-input', row('Price per unit (gold)')); pr.value = it.suggested || 1; pr.inputMode = 'numeric'; pr.addEventListener('keydown', e => e.stopPropagation());
    const qy = h('input', 'ss-input', row('Quantity')); qy.value = it.count || 1; qy.inputMode = 'numeric'; qy.addEventListener('keydown', e => e.stopPropagation());
    const sum = h('div', 'ss-mk-sum', f);
    const upd = () => { const p = Math.max(1, parseInt(pr.value) || 0), q = clamp(parseInt(qy.value) || 1, 1, it.count || 1), fee = Math.ceil(p * q * (d.fee ?? 0.05)); sum.innerHTML = `<span>Gross <b>${fmtInt(p * q)}</b></span><span>Fee <b class="ss-bad">−${fmtInt(fee)}</b></span><span>You receive <b class="ss-gold">${fmtInt(p * q - fee)}</b> gold</span>`; };
    pr.addEventListener('input', upd); qy.addEventListener('input', upd); upd();
    btn('ss-btn ss-btn--primary', f, 'List Item', () => this.ui.emit('market:list', { uid: it.uid, price: Math.max(1, parseInt(pr.value) || 0), qty: clamp(parseInt(qy.value) || 1, 1, it.count || 1) }));
  }
  listings(d) {
    const P = this.pane, L = d.listings || [];
    const t = h('div', 'ss-mk-tbl ss-mk-lt ss-scroll', P);
    t.innerHTML = `<div class="ss-mk-tr ss-mk-th"><span>Item</span><span>Price</span><span>Qty</span><span>Expires</span><span></span></div>`;
    for (const l of L) {
      const r = h('div', 'ss-mk-tr', t);
      r.innerHTML = `<span class="ss-mk-it"><i class="ss-slot ss-g${l.item.grade | 0}" style="--sz:34px"><i class="ss-slot-ic" style="background-image:url('${iconUrl(l.item.icon, 34, { bare: true })}')"></i></i><b style="color:${grade(l.item.grade).c}">${esc(l.item.name)}</b></span><span class="ss-mk-p">${fmtInt(l.price)}</span><span>${fmtInt(l.qty)}${l.sold ? ` <small class="ss-good">(${l.sold} sold)</small>` : ''}</span><span>${l.left != null ? fmtClock(l.left) : '—'}</span>`;
      btn('ss-btn ss-btn--sm', r, 'Cancel', () => this.ui.emit('market:cancel', { id: l.id }));
    }
    if (!L.length) h('div', 'ss-empty', t, 'You have no active listings.');
  }
  exchange(d) {
    const P = this.pane, x = d.exchange || { rate: 0 }, c = d.currencies || {};
    const top = h('div', 'ss-mk-ex', P);
    top.innerHTML = `<div class="ss-mk-rate"><span>Current rate</span><b>100 <i style="background-image:url('${iconUrl('currency:crystal', 20)}')"></i> = ${fmtInt(x.rate || 0)} <i style="background-image:url('${iconUrl('currency:gold', 20)}')"></i></b></div>`;
    h('div', 'ss-mk-chartw', top).innerHTML = chart(x.history, 520, 110);
    const panes = h('div', 'ss-mk-exp', P);
    for (const [dir, from, to, label] of [['crystalsToGold', 'crystals', 'gold', 'Sell Crystals'], ['goldToCrystals', 'gold', 'crystals', 'Buy Crystals']]) {
      const p = h('div', 'ss-mk-exc', panes);
      h('div', 'ss-h', p, label);
      const inp = h('input', 'ss-input', p); inp.value = from === 'crystals' ? 100 : Math.round((x.rate || 0)); inp.inputMode = 'numeric'; inp.addEventListener('keydown', e => e.stopPropagation());
      const out = h('div', 'ss-mk-exo', p);
      const upd = () => { const a = parseInt(inp.value) || 0; const r = from === 'crystals' ? Math.floor(a / 100 * (x.rate || 0)) : Math.floor(a / Math.max(1, x.rate || 1) * 100); out.innerHTML = `You get <b>${fmtInt(r)}</b> ${to === 'gold' ? 'gold' : 'crystals'} · you have ${fmtInt(c[from] || 0)} ${from}`; };
      inp.addEventListener('input', upd); upd();
      btn('ss-btn ss-btn--primary', p, 'Exchange', () => this.ui.emit('market:exchange', { dir, amount: parseInt(inp.value) || 0 }));
    }
  }
}
