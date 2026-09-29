// Raid auctions (Lost Ark style): when a legion raid gate drops something special, the party bids gold for it.
// The winner pays; the pot is split evenly among everyone else. AI raiders bid with personality.
import { registerPlugin, registerWindow, registerAction } from '../registry.js';
import { makeBook } from '../systems/gear.js';
import { COMBAT_ENGRAVINGS } from '../../data/engravings.js';

class Auction {
  constructor() { this.id = 'bidding'; this.cur = null; }
  init(s) {
    this.s = s;
    s.bus.on('clear', ({ content, result }) => {
      if (!result?.cleared || content.kind !== 'raid' || content.trial || s.guestMode) return;
      if (Math.random() < 0.6) setTimeout(() => this.start(content, result), 900);
    });
  }
  start(content, result) {
    const s = this.s;
    const book = makeBook(COMBAT_ENGRAVINGS[Math.floor(Math.random() * COMBAT_ENGRAVINGS.length)], 4);
    const bidders = (result.meter || []).filter(m => !m.you).map(m => ({ name: m.name, cls: m.cls, max: 300 + Math.random() * 2600, eager: Math.random() }));
    const size = Math.max(2, (result.meter || []).length);
    this.cur = { item: book, min: 100, step: 100, amount: 0, by: null, left: 15, bidders, size, content, history: [] };
    s.game.audio?.sfx?.('loot_rare', {});
    s.ui.open('bid', this.view());
    s.ui.chat.add({ channel: 'raid', from: 'Loot', text: `Auction started: ${book.name}. Bid with gold — the pot is shared by everyone else.` });
  }
  view() { const a = this.cur; if (!a) return null; return { item: a.item, min: a.min, step: a.step, current: a.amount ? { amount: a.amount, by: a.by } : null, left: a.left, split: Math.floor(a.amount / (a.size - 1)), gold: this.s.account.count('gold'), you: this.s.char?.name, history: a.history.slice(-6) }; }
  bid(amount) {
    const a = this.cur; if (!a) return;
    amount = Math.max(amount, (a.amount || a.min - a.step) + a.step);
    if (this.s.account.count('gold') < amount) { this.s.ui.toast('Not enough gold for that bid.', 'error'); return; }
    a.amount = amount; a.by = this.s.char.name; a.left = Math.max(a.left, 5); a.history.push({ by: a.by, amount });
    this.push();
  }
  update(dt) {
    const a = this.cur; if (!a) return;
    a.left -= dt;
    // AI raiders outbid now and then (not against themselves)
    for (const b of a.bidders) {
      const next = (a.amount || a.min - a.step) + a.step * (1 + Math.floor(Math.random() * 3));
      if (a.by !== b.name && next <= b.max && Math.random() < dt * (0.25 + b.eager * 0.5)) { a.amount = next; a.by = b.name; a.left = Math.max(a.left, 4); a.history.push({ by: b.name, amount: next }); this.push(); break; }
    }
    this.tick = (this.tick || 0) + dt; if (this.tick > 0.25) { this.tick = 0; this.push(); }
    if (a.left <= 0) this.finish();
  }
  push() { if (this.s.ui.isOpen?.('bid')) this.s.ui.update('bid', this.view()); }
  finish() {
    const a = this.cur, s = this.s; this.cur = null;
    s.ui.close?.('bid');
    if (!a.by) { s.ui.chat.add({ channel: 'raid', from: 'Loot', text: `Nobody bid on ${a.item.name}; it goes to a random raider.` }); return; }
    if (a.by === s.char.name) {
      s.account.take('gold', a.amount); s.account.addItem(s.char, a.item);
      s.ui.toast(`You won ${a.item.name} for ${a.amount.toLocaleString()} gold.`, 'loot'); s.game.audio?.sfx?.('loot_legendary', {});
    } else {
      const share = Math.floor(a.amount / (a.size - 1));
      s.account.give('gold', share);
      s.ui.toast(`${a.by} won ${a.item.name} for ${a.amount.toLocaleString()} gold — your share: ${share.toLocaleString()} gold.`, 'success');
    }
  }
}
const auction = registerPlugin(new Auction());
registerWindow('bid', () => auction.view());
registerAction('bid:', (s, type, p) => {
  if (type === 'bid:place') { auction.bid(p.amount || 0); return true; }
  if (type === 'bid:raise') { auction.bid((auction.cur?.amount || 0) + (p.step || auction.cur?.step || 100)); return true; }
  if (type === 'bid:pass') { s.ui.close?.('bid'); return true; }
  return false;
});
