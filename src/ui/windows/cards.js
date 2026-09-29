// Cards: a deck of 6, set bonuses (by count and total awakening), and the collection with awakening (0–5 ★).
//   data: { deck: [cardId|null ×6], cards: [{ id, name, grade, awaken, count (spare copies), icon, desc?, set? }],
//           sets: [{ id, name, cards: [ids], bonuses: [{ need, awaken?, text }] }],
//           packs?: [{ id, name, count }], owned?, total?, choice?: { pack, options: [{ id, name, grade, icon? }] } }
//   Awakening n → n+1 costs `awakenCost[n]` copies (default [1, 2, 3, 4, 5]).
// Actions: cards:equip { id, slot } · cards:unequip { slot } · cards:awaken { id } · cards:auto {} ·
//          cards:open { pack } · cards:choose { index } (pick from a pending Legendary Card Selector)
import { h, btn, esc, clear, fmtInt } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { iconUrl, itemIcon } from '../core/icon.js';
import { tabs } from '../core/kit.js';
import { grade } from '../core/data.js';
import { draggable } from '../core/drag.js';
import { Win } from '../core/windows.js';

const COST = [1, 2, 3, 4, 5];
export class CardsWin extends Win {
  static id = 'cards'; static title = 'Cards'; static glyph = 'cards'; static width = 980;
  build() {
    const b = this.body; b.classList.add('ss-cd');
    const top = h('div', 'ss-cd-top', b);
    this.deck = h('div', 'ss-cd-deck', top);
    this.sets = h('div', 'ss-cd-sets', top);
    this.filter = 'all';
    this.bar = h('div', 'ss-cd-bar', b);
    this.choice = h('div', 'ss-cd-choice', b);
    this.tabsWrap = h('div', '', b);
    this.coll = h('div', 'ss-cd-coll ss-scroll', b);
  }
  card(c, size, o = {}) {
    const g = grade(c ? c.grade : 0);
    const el = h('div', `ss-card ss-g${c ? c.grade | 0 : 0}${c ? '' : ' is-empty'}${size === 'sm' ? ' is-sm' : ''}`);
    if (!c) { el.innerHTML = `<span>${o.label || 'Empty'}</span>`; return el; }
    el.innerHTML = `<i class="ss-card-art" style="background-image:url('${iconUrl(c.icon || 'npc:merchant', size === 'sm' ? 64 : 110)}')"></i>
      <div class="ss-card-stars">${Array.from({ length: 5 }, (_, i) => `<s class="${i < (c.awaken || 0) ? 'on' : ''}"></s>`).join('')}</div>
      <div class="ss-card-name" style="color:${g.c}">${esc(c.name)}</div>${c.count > 0 && size === 'sm' ? `<em>+${c.count}</em>` : ''}`;
    el._tip = { title: c.name, color: g.c, lines: [`${g.name} Card · Awakening ${c.awaken || 0}/5`, c.desc, c.set ? `Set: ${c.set}` : null, c.count > 0 ? `${c.count} spare cop${c.count > 1 ? 'ies' : 'y'}` : null] };
    return el;
  }
  render(d) {
    this.d = d;
    const cards = d.cards || [], byId = Object.fromEntries(cards.map(c => [c.id, c]));
    const deck = d.deck || [];
    clear(this.deck);
    for (let i = 0; i < 6; i++) {
      const c = byId[deck[i]];
      const el = this.card(c, 'lg', { label: `Slot ${i + 1}` });
      el.classList.add('ss-ptr');
      el._drop = p => p.type === 'card' ? () => this.ui.emit('cards:equip', { id: p.card.id, slot: i }) : null;
      if (c) { el.addEventListener('contextmenu', e => { e.preventDefault(); this.ui.emit('cards:unequip', { slot: i }); }); el._tip.lines.push('Right-click to remove'); }
      this.deck.appendChild(el);
    }
    // set bonuses for the deck
    clear(this.sets);
    h('div', 'ss-h', this.sets, 'Set Bonuses');
    const inDeck = deck.filter(Boolean);
    const relevant = (d.sets || []).map(s => { const have = s.cards.filter(id => inDeck.includes(id)); return { s, have: have.length, aw: have.reduce((a, id) => a + (byId[id]?.awaken || 0), 0) }; }).filter(x => x.have > 0).sort((a, b) => b.have - a.have);
    if (!relevant.length) h('div', 'ss-empty', this.sets, 'Equip cards from the same set to activate bonuses.');
    for (const { s, have, aw } of relevant) {
      const box = h('div', 'ss-cd-set', this.sets);
      box.innerHTML = `<div class="ss-cd-sh"><b>${esc(s.name)}</b><span>${have}/${s.cards.length} cards · ${aw} awakening</span></div>` +
        (s.bonuses || []).map(b => { const on = have >= b.need && (b.awaken == null || aw >= b.awaken); return `<div class="ss-cd-b${on ? ' is-on' : ''}"><em>${b.need}-set${b.awaken != null ? ` (${b.awaken}★)` : ''}</em>${esc(b.text)}</div>`; }).join('');
    }
    // toolbar: collection progress, auto-deck, card packs to open
    clear(this.bar);
    h('div', 'ss-cd-own', this.bar).innerHTML = `<span>Collection</span><b>${fmtInt(d.owned ?? cards.length)}</b>${d.total ? `<em>/ ${fmtInt(d.total)}</em>` : ''}`;
    const auto = btn('ss-btn ss-btn--sm', this.bar, null, () => this.ui.emit('cards:auto', {}), 'Build the best deck automatically');
    auto.innerHTML = glyph('sparkle') + '<span>Auto-Deck</span>'; auto.disabled = !cards.length;
    h('i', 'ss-cd-sp', this.bar);
    for (const p of (d.packs || []).filter(p => p.count > 0)) {
      const b = btn('ss-btn ss-btn--sm ss-cd-pack', this.bar, null, () => this.ui.emit('cards:open', { pack: p.id }), `Open ${p.name}`);
      b.innerHTML = `<i style="background-image:url('${itemIcon('item:' + p.id, 22)}')"></i><span>${esc(p.name)}</span><em>×${fmtInt(p.count)}</em><b>Open</b>`;
      b.disabled = !!d.choice;
    }
    // a pending Legendary Card Selector: pick one inline
    clear(this.choice);
    this.choice.hidden = !d.choice;
    if (d.choice) {
      h('div', 'ss-cd-ch', this.choice).innerHTML = `${glyph('crown')}<b>Card Selector</b><span>Choose one card to keep.</span>`;
      const row = h('div', 'ss-cd-chrow', this.choice);
      (d.choice.options || []).forEach((o, i) => {
        const c = { ...o, icon: o.icon || byId[o.id]?.icon || 'npc:' + o.id, awaken: 0 };
        const el = this.card(c, 'sm'); el.classList.add('ss-ptr', 'ss-cd-pick');
        el.addEventListener('click', () => this.ui.emit('cards:choose', { index: i }));
        el._tip.lines.push(byId[o.id] ? 'You own this card: a pick adds a copy' : 'New card');
        row.appendChild(el);
      });
    }
    // collection
    clear(this.tabsWrap);
    const counts = g => cards.filter(c => g === 'all' || c.grade === g).length;
    tabs(this.tabsWrap, [{ id: 'all', label: 'All', count: cards.length }, { id: 4, label: 'Legendary', count: counts(4) }, { id: 3, label: 'Epic', count: counts(3) }, { id: 2, label: 'Rare', count: counts(2) }, { id: 1, label: 'Uncommon', count: counts(1) }], this.filter, id => { this.filter = id; this.render(this.d); });
    clear(this.coll);
    const list = cards.filter(c => this.filter === 'all' || c.grade === +this.filter).sort((a, b) => (b.grade || 0) - (a.grade || 0) || (b.awaken || 0) - (a.awaken || 0));
    for (const c of list) {
      const w = h('div', 'ss-cd-cell' + (deck.includes(c.id) ? ' is-in' : ''), this.coll);
      const el = this.card(c, 'sm'); w.appendChild(el);
      el.classList.add('ss-ptr');
      draggable(el, () => ({ type: 'card', card: c, icon: c.icon }));
      el.addEventListener('click', () => { if (!deck.includes(c.id)) { const free = [0, 1, 2, 3, 4, 5].find(i => !deck[i]); this.ui.emit('cards:equip', { id: c.id, slot: free ?? 5 }); } });
      const need = COST[c.awaken || 0];
      if ((c.awaken || 0) < 5) {
        const b = btn('ss-btn ss-btn--sm ss-cd-aw', w, `Awaken ${c.count || 0}/${need}`, () => this.ui.emit('cards:awaken', { id: c.id }), `Awaken ${c.name}`);
        b.disabled = (c.count || 0) < need;
      } else h('span', 'ss-cd-max', w, 'Max');
    }
    if (!list.length) h('div', 'ss-empty', this.coll, 'No cards of this grade yet.');
  }
}
