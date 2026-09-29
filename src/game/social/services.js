// Solhaven services that had no home yet: the Stablemaster (buy and choose mounts) and Roster Storage (gear shared
// by every character on the roster — materials, silver and gold are roster-wide already).
import { registerService } from '../registry.js';
import { CREATURES } from '../../models/creatures/index.js';

// ------------------------------------------------------------------------------------------------ Stablemaster
const STABLE = [
  { type: 'horse', variant: 'brown', name: 'Bay Horse', price: null },
  { type: 'horse', variant: 'white', name: 'Silvermane', price: { silver: 20000 } },
  { type: 'horse', variant: 'black', name: 'Nightrunner', price: { silver: 20000 } },
  { type: 'horse', variant: 'armoured', name: 'Barded Warhorse', price: { gold: 300 } },
  { type: 'direwolf', variant: 'grey', name: 'Grey Direwolf', price: { gold: 800 } },
  { type: 'direwolf', variant: 'snow', name: 'Frostfang', price: { gold: 800 } },
  { type: 'direwolf', variant: 'black', name: 'Shadowpelt', price: { gold: 800 } },
  { type: 'sunstag', variant: 'dawn', name: 'Dawn Sunstag', price: { gold: 2500 }, note: 'free after clearing Gorrath' },
  { type: 'sunstag', variant: 'dusk', name: 'Dusk Sunstag', price: { gold: 2500 } },
  { type: 'sunstag', variant: 'moon', name: 'Moon Sunstag', price: { gold: 2500 } },
];
const key = m => `${m.type}:${m.variant}`;
const priceText = p => p.gold ? `${p.gold.toLocaleString('en-US')} gold` : `${p.silver.toLocaleString('en-US')} silver`;

async function stable(s, n) {
  const A = s.account, c = s.char; if (!c) return;
  const R = A.roster; R.mounts ||= [];
  // Gorrath's legion raid rewards the Dawn Sunstag
  if (!R.mounts.includes('sunstag:dawn') && (R.records?.pb && Object.keys(R.records.pb).some(k => /gorrath/.test(k)))) R.mounts.push('sunstag:dawn');
  const owned = m => !m.price || R.mounts.includes(key(m));
  const current = `${c.mount || 'horse'}:${c.mountVariant || 'brown'}`;
  const list = STABLE.filter(m => CREATURES[m.type]);
  const choices = list.map((m, i) => ({ id: `m${i}`, kind: owned(m) ? 'talk' : 'quest',
    text: owned(m) ? `${key(m) === current ? '✓ ' : ''}Ride the ${m.name}` : `Buy the ${m.name} — ${priceText(m.price)}${m.note ? ` (${m.note})` : ''}` }));
  choices.push({ id: 'bye', text: 'Just looking.', kind: 'leave' });
  const pick = await s.ui.dialog({ id: n?.id, name: n?.name || 'Gregor Hay', title: n?.title || 'Stablemaster', portrait: n?.portrait },
    [{ text: 'Every beast here is fed, brushed and battle-steady. Press T in the open world to mount up — they bolt the moment you draw steel.', choices }]);
  const m = list[+String(pick || '').slice(1)]; if (!m || pick === 'bye') return;
  if (!owned(m)) {
    const cur = m.price.gold ? 'gold' : 'silver', amt = m.price[cur];
    if (!A.take(cur, amt)) { s.ui.toast(`Not enough ${cur}.`, 'error'); s.game.audio?.sfx?.('ui_error', {}); return; }
    R.mounts.push(key(m)); s.ui.toast(`${m.name} joins your stable.`, 'success'); s.game.audio?.sfx?.('purchase', {});
  }
  c.mount = m.type; c.mountVariant = m.variant; A.save();
  s.ui.toast(`You'll ride the ${m.name}. Press T to mount up.`, 'info');
}

// ------------------------------------------------------------------------------------------------ Roster Storage
const STORABLE = new Set(['weapon', 'armor', 'accessory', 'stone', 'bracelet', 'gem', 'book', 'cosmetic']);
const itemLabel = it => `${it.name || it.id}${it.hone ? ` +${it.hone}` : ''}${it.iLvl ? ` · iLvl ${Math.floor(it.iLvl)}` : ''}`;

async function storage(s, n) {
  const A = s.account, c = s.char; if (!c) return;
  const box = A.roster.storage ||= [];
  const who = { id: n?.id, name: n?.name || 'Petra Coin', title: n?.title || 'Roster Storage', portrait: n?.portrait };
  for (;;) {
    const bag = (c.inv || []).filter(it => it.uid && STORABLE.has(it.kind));
    const pick = await s.ui.dialog(who, [{ text: `Materials, silver and gold already belong to your whole roster. Gear you leave with me can be collected by any of your characters. I'm holding ${box.length} item${box.length === 1 ? '' : 's'} for you.`,
      choices: [
        { id: 'dep', text: `Store gear from ${c.name}'s bag (${bag.length})`, kind: bag.length ? 'talk' : 'leave' },
        { id: 'wd', text: `Take gear out (${box.length})`, kind: box.length ? 'talk' : 'leave' },
        { id: 'bye', text: 'That’s all.', kind: 'leave' },
      ] }]);
    if (pick === 'dep') {
      if (!bag.length) { s.ui.toast('Nothing in your bag can be stored.', 'info'); continue; }
      const page = bag.slice(0, 10);
      const p2 = await s.ui.dialog(who, [{ text: 'What should I keep for you?', choices: [...page.map((it, i) => ({ id: `i${i}`, text: itemLabel(it), kind: 'talk' })), { id: 'back', text: 'Back', kind: 'leave' }] }]);
      const it = page[+String(p2 || '').slice(1)];
      if (it && p2 !== 'back') { const moved = A.removeItem(c, it.uid); if (moved) { box.push(moved); A.save(); s.ui.toast(`${itemLabel(moved)} stored for your roster.`, 'success'); s.refreshWindow?.('inventory'); } }
    } else if (pick === 'wd') {
      if (!box.length) { s.ui.toast('Your roster storage is empty.', 'info'); continue; }
      if ((c.inv || []).length >= 60) { s.ui.toast('Your bag is full.', 'warn'); continue; }
      const page = box.slice(0, 10);
      const p2 = await s.ui.dialog(who, [{ text: 'Which piece do you need?', choices: [...page.map((it, i) => ({ id: `i${i}`, text: itemLabel(it), kind: 'talk' })), { id: 'back', text: 'Back', kind: 'leave' }] }]);
      const it = page[+String(p2 || '').slice(1)];
      if (it && p2 !== 'back') { box.splice(box.indexOf(it), 1); c.inv.push(it); A.save(); s.ui.toast(`${itemLabel(it)} is in ${c.name}'s bag.`, 'success'); s.refreshWindow?.('inventory'); }
    } else return;
  }
}

registerService('mounts', (s, n) => stable(s, n));
registerService('storage', (s, n) => storage(s, n));
