// Glue between the systems layer and the session (src/game/registry.js), imported once by src/game/plugins.js.
//  · window data providers + UI actions for the windows in src/ui/windows (their documented data contracts):
//    honing (hone:*), stone (stone:*), cards (cards:*), gems (gems:*), market (market:*), stronghold (sh:*),
//    compass (compass:*), tome (tome:* / collect:*), rapport (rapport:*), mail (mail:*), guild (guild:*),
//    leaderboards (lb:*), engravings (engr:*), vendor (vendor:buy for systems shops)
//  · NPC services & extra dialog choices (vendors, raid reforging, quality, songs, tasks board)
//  · session.bus → tasks.track (kills, clears, zone, sail, pvp…), rapport from songs/emotes, open-world drops
//  · item use from the inventory (card packs, gem pouches, books, food, potions, chests, maps)
//  · a 10-second tick (market sales, research, events going live), HUD badges & task quests
//  · contentRewards(session, c, r) / moreRewards(session, offer) for Session.contentDone (see README "Hook-in")
// Top level only declares and registers; work happens in init() and the handlers.
import { registerPlugin, registerWindow, registerAction, registerService } from '../registry.js';
import * as S from './index.js';
import { CITY_NPCS } from '../../data/npcs.js';
import { RAIDS } from '../../data/raids.js';
import { ITEMS, GEAR_SLOTS } from '../../data/items.js';
import { CARD_SETS } from '../../data/cards.js';
import { SONGS } from '../../data/rapport.js';
import { EVENTS } from '../../data/tasks.js';
import { gearStats, gearIlvl } from './gear.js';
import { itemInfo, bundleRows, HOUR, MIN, DAY } from './common.js';

// ------------------------------------------------------------------------------------------------ helpers
const ss = s => (s._sys ||= { hone: {}, stone: {}, market: { tab: 'browse', cat: 'honing' }, rapport: {}, tome: {}, lb: { board: 'legion_nm' }, tracked: [], shop: null, t: 0, welcomed: {} });
const cur = A => ({ silver: A.count('silver'), gold: A.count('gold'), crystals: A.count('crystals') });
const TOAST = { taskDone: 'success', weekly: 'success', rep: 'success', title: 'success', achievement: 'success', rapport: 'success', sold: 'success', research: 'success', board: 'info', expired: 'warn', event: 'info', guild: 'info' };
function notify(s, notes) { for (const n of notes || []) if (n?.text) s.ui?.toast?.(n.text, TOAST[n.kind] || 'info'); }
function res(s, r, okText, win) {
  if (!r) return r;
  if (!r.ok) s.ui?.toast?.(r.msg || 'Can’t do that.', 'error');
  else { if (okText) s.ui?.toast?.(typeof okText === 'function' ? okText(r) : okText, 'success'); notify(s, r.notes); }
  if (win) for (const w of [].concat(win)) s.refreshWindow?.(w);
  return r;
}
const rowsText = rows => (rows || []).map(r => `${r.count > 1 ? `${r.count.toLocaleString('en-US')} × ` : ''}${r.name}`).join(', ');
const asItem = r => r.item ? { ...r.item, count: r.item.count || 1 } : { id: r.id, uid: r.uid, name: r.name, grade: r.grade, icon: r.icon, kind: r.kind === 'currency' ? 'currency' : r.kind || 'material', count: r.count };
const firstRow = rows => { const r = rows?.[0] || { name: '', grade: 1, icon: 'item:chest', count: 1 }; return { name: rows?.length > 1 ? rows.map(x => x.name).join(' + ') : r.name, icon: r.icon, grade: r.grade, count: r.count, kind: r.kind }; };
const lootFeed = (s, rows) => { for (const r of rows || []) s.ui?.hud?.loot?.({ name: r.name, grade: r.grade, count: r.count, icon: r.icon, kind: r.kind }); };
const rapportId = npcDefId => CITY_NPCS.find(n => n.id === npcDefId)?.rapport || (S.rapport.RAPPORT_NPCS.some(n => n.id === npcDefId) ? npcDefId : null);
const FAMILY = { imp: 'demon', hellhound: 'demon', legionnaire: 'demon', brute: 'demon', abyss_caster: 'demon', gargoyle: 'demon', skeleton: 'undead', wraith: 'undead', wolf: 'beast', boar: 'beast', spider: 'beast', crab: 'beast', treant: 'beast', crystal_golem: 'construct', wisp: 'construct', pip: 'pip' };
const OPEN_WORLD = new Set(['city', 'field', 'island', 'stronghold']);
const pretty = id => String(id).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// ------------------------------------------------------------------------------------------------ content rewards (for Session.contentDone)
/**
 * Roll + grant the rewards of a finished content run. c = session content ({ kind: 'chaos'|'guardian'|'raid'|'inferno'|
 * 'fieldboss'|'chaosgate'|'island'|'ghostship', tier?, boss?, raid?, gate?, hard?, trial?, floor?, island? }), r = mode result.
 * → { loot: [results-screen item rows], currencies: { silver, gold… }, notes: [string], more: null | offer, result }
 */
export function contentRewards(s, c, r) {
  const A = s.account, ch = s.char, none = { loot: [], currencies: {}, notes: [], more: null, result: null };
  if (!ch || !r?.cleared || c?.trial) return none;
  let out = null;
  if (c.kind === 'chaos') out = S.loot.chaosReward(A, ch, { tier: c.tier || 1 });
  else if (c.kind === 'guardian') out = S.loot.guardianReward(A, ch, { guardian: c.boss });
  else if (c.kind === 'raid') { const R = RAIDS[c.raid]; out = R?.kind === 'abyss' ? S.loot.abyssReward(A, ch, { raid: c.raid, gate: c.gate || 0 }) : S.loot.raidReward(A, ch, { raid: c.raid, gate: c.gate || 0, mode: c.hard ? 'hard' : 'normal' }); }
  else if (c.kind === 'inferno') out = S.loot.infernoReward(A, ch, { floor: c.floor || r.floor || 1 });
  else if (['fieldboss', 'chaosgate', 'island', 'ghostship', 'treasure'].includes(c.kind)) out = S.loot.eventReward(A, ch, { kind: c.kind, island: c.island });
  if (!out?.ok) return none;
  const loot = out.rows.filter(x => x.kind !== 'currency').map(x => ({ id: x.id, uid: x.uid, name: x.name, count: x.count, icon: x.icon, grade: x.grade, kind: x.kind, ...(x.item ? { item: x.item } : {}) }));
  return { loot, currencies: out.currencies, notes: out.notes, more: out.more || null, result: out };
}
/** Offer the legion raid "More Rewards" chest (confirm dialog → pay gold → rewards toast). */
export async function moreRewards(s, offer) {
  if (!offer || !s.char) return null;
  const ok = await s.ui.confirm({ title: 'More Rewards', text: `Open the More Rewards chest for ${offer.cost.gold} gold? It holds Horns of the Tyrant, leapstones, fusion materials and a chance at a relic accessory or an engraving recipe.`, ok: `Open (${offer.cost.gold} gold)`, cancel: 'Leave it' });
  if (!ok) return null;
  const r = S.loot.buyMoreRewards(s.account, s.char, offer);
  if (!r.ok) { s.ui.toast(r.msg, 'error'); return r; }
  s.game?.audio?.sfx?.('chest_open', {});
  s.ui.toast(`More Rewards: ${rowsText(r.rows)}.`, 'loot'); lootFeed(s, r.rows);
  s.refreshWindow?.('inventory');
  return r;
}

// ------------------------------------------------------------------------------------------------ honing
function honingData(s) {
  const A = s.account, c = s.char, H = ss(s).hone, v = S.honing.view(A, c);
  const pieces = v.pieces.filter(p => p.why !== 'story');
  const items = pieces.map(p => c.equip[p.slot]);
  const sel = pieces.find(p => p.uid === H.uid) || pieces[0];
  if (!sel) return { items: [], item: null, currencies: cur(A), support: v.support };
  const it = c.equip[sel.slot], maxed = sel.hone >= sel.max;
  const next = maxed ? it : { ...it, hone: it.hone + 1 }; next.iLvl = gearIlvl(next); const ns = gearStats(next), os = it.stats || {};
  const gains = it.slot === 'weapon' ? [{ label: 'Weapon Power', from: os.wpn || 0, to: ns.wpn }, { label: 'Might', from: os.might || 0, to: ns.might }] : [{ label: 'Might', from: os.might || 0, to: ns.might }, { label: 'Max HP', from: os.hp || 0, to: ns.hp }];
  const mats = Object.entries(sel.cost).filter(([k]) => k !== 'silver' && k !== 'gold').map(([k, n]) => { const i = itemInfo(k); return { id: k, name: i.name, icon: i.icon, grade: i.grade, need: n, have: A.count(k), desc: i.desc }; });
  return {
    items, item: it, iLvlFrom: sel.iLvl, iLvlTo: sel.nextILvl, gains,
    chance: { base: sel.chance.base, bonus: sel.chance.failBonus, boosters: 0, total: sel.chance.total }, maxBonus: sel.chance.base,
    energy: sel.energy, mats, cost: { silver: sel.cost.silver || 0, gold: sel.cost.gold || 0 }, currencies: cur(A),
    boosters: Object.entries(sel.boosters).map(([id, b]) => { const i = itemInfo(id); return { id, name: i.name, icon: i.icon, grade: i.grade, have: b.have, max: b.max, add: b.add }; }),
    maxed, result: H.result || null, resultKey: H.key || 0,
    // extras (not required by the window): weekly Honing Support, expected taps, reforge path, pity stats
    support: v.support, expected: sel.expected, transfer: sel.transfer, stats: v.stats,
  };
}
function honeTap(s, p) {
  const A = s.account, c = s.char, H = ss(s).hone;
  const slot = GEAR_SLOTS.find(sl => c.equip[sl]?.uid === p.uid); if (!slot) return true;
  const r = S.honing.hone(A, c, slot, { boosters: p.boosters || {} });
  if (!r.ok) { s.ui.toast(r.msg, 'error'); s.refreshWindow('honing'); return true; }
  H.result = r.success ? 'success' : 'fail'; H.key = (H.key || 0) + 1; H.uid = c.equip[slot].uid;
  s.game?.audio?.sfx?.('honing_hammer', {});
  setTimeout(() => s.game?.audio?.sfx?.(r.success ? 'honing_success' : 'honing_fail', {}), 900);
  if (r.success && r.share) setTimeout(() => s.ui.toast(`+${r.to} after ${r.taps} ${r.taps > 1 ? 'taps' : 'tap'} — ${r.share.label}${r.share.guaranteed ? '' : ` (luckier than ${Math.round(r.share.luck * 100)}% of Shardbearers)`}`, 'success'), 1000);
  s.bus?.emit?.('hone', { success: r.success, item: c.equip[slot], chance: r.chance, energy: r.energy, sys: true });
  notify(s, r.notes);
  s.refreshChar?.(); s.refreshWindow('honing');
  return true;
}

// ------------------------------------------------------------------------------------------------ ability stones
function stoneList(c) { const l = []; if (c.equip?.stone) l.push(c.equip.stone); for (const it of c.inv || []) if (it.kind === 'stone') l.push(it); return l; }
const uiStone = x => ({ ...x, engr: [{ id: x.lines[0] }, { id: x.lines[1] }], neg: { id: x.lines[2] }, facets: x.facets.map(l => l.map(v => v === 1 ? 1 : v === -1 ? 0 : null)) });
function stoneData(s) {
  const A = s.account, c = s.char, st = ss(s).stone, list = stoneList(c);
  const stone = list.find(x => x.uid === st.uid) || list.find(x => x.facets.some(l => l.includes(0))) || list[0] || null;
  return { stones: list.map(uiStone), stone: stone ? uiStone(stone) : null, chance: stone?.chance ?? 0.75, cost: stone ? S.engravings.stoneView(stone).cost : null, currencies: cur(A),
    last: st.last || null, lastKey: st.key || 0, view: stone ? S.engravings.stoneView(stone, stone === c.equip?.stone) : null, best: S.engravings.bestStone(A) };
}

// ------------------------------------------------------------------------------------------------ cards
function cardsData(s) {
  const v = S.cards.view(s.account);
  return {
    deck: v.deck,
    cards: v.collection.filter(x => x.owned).map(x => ({ id: x.id, name: x.name, grade: x.grade, awaken: x.awaken, count: x.dupes, icon: x.icon, desc: x.flavor, set: x.sets.map(id => CARD_SETS[id]?.name).filter(Boolean).join(', ') || null })),
    sets: Object.values(CARD_SETS).map(X => ({ id: X.id, name: X.name, cards: X.cards, bonuses: X.bonuses.map(b => ({ need: b.n, awaken: b.awk || undefined, text: b.desc })) })),
    packs: v.packs, choice: v.choice, active: v.active, owned: v.owned, total: v.total,
  };
}
async function openCardPack(s, packId) {
  const A = s.account, r = S.cards.openPack(A, packId);
  if (!r.ok) { s.ui.toast(r.msg, 'error'); return; }
  if (r.choose) return chooseCard(s);
  const c = r.cards[0]; s.ui.toast(`${c.isNew ? 'New card' : 'Card'}: ${c.name}${c.isNew ? '!' : ` (duplicate ×${c.dupes})`}`, c.isNew ? 'loot' : 'info');
  notify(s, r.notes); s.refreshWindow('cards'); s.refreshWindow('inventory');
}
async function chooseCard(s) {
  const ch = s.account.roster.cardChoice; if (!ch) return;
  const v = S.cards.view(s.account);
  const pick = await s.ui.dialog({ name: 'Legendary Card Selector', title: 'Choose one' }, [{ text: 'Three cards shimmer in the pack. Keep one:', choices: v.choice.options.map((o, i) => ({ id: String(i), text: `${o.name} (${['', '', 'Rare', 'Epic', 'Legendary', 'Relic'][o.grade] || ''})`, kind: 'quest' })) }]);
  if (pick == null) return;
  const r = S.cards.choose(s.account, +pick);
  if (r.ok) s.ui.toast(`Card: ${r.card.name}`, 'loot');
  s.refreshWindow('cards');
}

// ------------------------------------------------------------------------------------------------ gems
function gemsData(s) {
  const c = s.char, v = S.gems.view(s.account, c);
  const sk = id => ({ id, name: v.skills.find(x => x.id === id)?.name || pretty(id), icon: `skill:${c.cls}:${id}` });
  return { sockets: v.sockets.map(x => ({ gem: x.gem ? { ...x.gem, desc: x.desc } : null, skill: x.skill ? sk(x.skill) : null })), gems: v.bag,
    skills: v.skills.map(x => ({ id: x.id, name: x.name, icon: `skill:${c.cls}:${x.id}`, ruin: x.ruin, swift: x.swift })), fuseCost: { silver: 2000 }, fuseCosts: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => [l, S.gems.fuseCost(l)])),
    currencies: cur(s.account), fusable: v.fusable, mods: v.mods };
}
function gemSocket(s, p) {
  const c = s.char, S2 = S.gems.sockets(c), gem = (c.inv || []).find(x => x.uid === p.uid);
  if (!gem) return true;
  let skill = S2[p.slot]?.skill;
  const taken = id => S2.some((g, i) => i !== p.slot && g && g.skill === id && g.gem === gem.gem);
  if (!skill || taken(skill)) skill = S.gems.skillList(c).map(x => x.id).find(id => !taken(id));
  res(s, S.gems.socket(s.account, c, p.uid, p.slot, skill), null, ['gems', 'inventory']);
  s.refreshChar?.();
  return true;
}

// ------------------------------------------------------------------------------------------------ market
const MK_SUBS = { gem: [{ id: 'ruin', label: 'Ruinstones' }, { id: 'swift', label: 'Swiftstones' }], accessory: [{ id: 'necklace', label: 'Necklaces' }, { id: 'earring', label: 'Earrings' }, { id: 'ring', label: 'Rings' }] };
function marketData(s) {
  const A = s.account, c = s.char, M = ss(s).market, now = Date.now();
  const cats = S.market.categories().map(x => ({ id: x.id, label: x.name, ...(MK_SUBS[x.id] ? { subs: MK_SUBS[x.id] } : {}) }));
  let results;
  if (M.cat === 'accessory' && !M.q) {
    results = S.market.accessories(A, { slot: M.sub, now }).slice(0, 60).map(x => ({ id: `acc#${x.key}`, name: x.item.name + (x.you ? ' (yours)' : ''), icon: x.item.icon, grade: x.item.grade, kind: 'accessory', bundle: 1, lowest: x.price, stock: 1, history: [], item: x.item, seller: x.seller, you: x.you }));
  } else {
    results = S.market.browse(A, { cat: M.q ? undefined : M.cat, q: M.q, now, char: c })
      .filter(r => M.cat !== 'gem' || !M.sub || M.q || r.id.startsWith(`gem:${M.sub}:`))
      .map(r => ({ id: r.id, name: r.name, icon: r.icon, grade: r.grade, kind: r.cat, bundle: r.unit, lowest: r.price, avg: r.ref, history: S.market.history(r.id, { now, hours: 168, step: 12 * HOUR }).map(p => p.price), trend: Math.round(r.change24 * 1000) / 10, have: r.have }));
  }
  const selId = M.selected && results.some(r => r.id === M.selected) ? M.selected : results[0]?.id;
  const sel = results.find(r => r.id === selId);
  if (sel && !sel.id.startsWith('acc#')) { const b = S.market.book(A, sel.id, now, c); if (b) { sel.stock = b.asks.filter(a => !a.you).reduce((t, a) => t + a.qty, 0); sel.recent = b.history.length ? b.history[b.history.length - 1].price : null; sel.history = S.market.history(sel.id, { now, hours: 168, step: 6 * HOUR }).map(p => p.price); sel.asks = b.asks; } }
  const sellable = [];
  for (const [id, n] of Object.entries(A.roster.mats || {})) { const MI = S.market.ITEMS_MARKET[id]; if (!MI || MI.cat === 'book' || MI.cat === 'gem') continue; const bundles = Math.floor(n / MI.unit); if (bundles < 1) continue; const b = S.market.book(A, id, now, c); sellable.push({ uid: `mat:${id}`, id, name: MI.unit > 1 ? `${MI.name} ×${MI.unit}` : MI.name, grade: MI.grade, icon: MI.icon, kind: 'material', count: bundles, suggested: b?.suggest }); }
  for (const it of c.inv || []) {
    if (it.bound) continue;
    let sug = null;
    if (it.kind === 'book') sug = S.market.book(A, `book:${it.engr}`, now, c)?.suggest;
    else if (it.kind === 'gem') sug = S.market.book(A, `gem:${it.gem}:${it.level}`, now, c)?.suggest;
    else if (it.kind === 'accessory') sug = S.market.accessoryPrice(it);
    else continue;
    sellable.push({ ...it, count: 1, suggested: sug });
  }
  const listings = S.market.listings(A, now).filter(l => l.status === 'active').map(l => ({ id: l.id, item: { ...(l.item || {}), name: l.name + (l.unit > 1 ? ` ×${l.unit}` : ''), grade: l.grade, icon: l.icon }, price: l.price, qty: l.qty, sold: l.sold, left: Math.round(l.left / 1000) }));
  const ex = S.market.exchange(now);
  return { tab: M.tab, cats, cat: M.cat, sub: M.sub, q: M.q || '', results, selected: selId, sellable, listings, fee: S.market.fee(A), exchange: { rate: ex.buy, sell: ex.sell, history: ex.history.map(h => h.buy) }, currencies: cur(A) };
}
function marketAction(s, type, p) {
  const A = s.account, c = s.char, M = ss(s).market;
  if (type === 'market:search') { M.q = p.q || ''; if (p.cat) M.cat = p.cat; M.sub = p.sub; M.selected = null; M.tab = 'browse'; }
  else if (type === 'market:select') M.selected = p.id;
  else if (type === 'market:buy') {
    if (String(p.id).startsWith('acc#')) res(s, S.market.buyAccessory(A, c, p.id.slice(4)), r => `Bought ${r.item.name} for ${r.spent} gold.`, 'inventory');
    else res(s, S.market.buy(A, c, p.id, p.qty || 1), r => `Bought ${rowsText(r.rows)} for ${r.spent.toLocaleString('en-US')} gold.`, 'inventory');
  } else if (type === 'market:list') {
    const u = String(p.uid || '');
    const r = u.startsWith('mat:') ? S.market.list(A, c, u.slice(4), p.qty || 1, p.price) : S.market.list(A, c, null, 1, p.price, { uid: u });
    res(s, r, x => `Listed ${x.listing.name}${x.listing.qty > 1 ? ` ×${x.listing.qty}` : ''} for ${x.listing.price} gold each.`, 'inventory');
    if (r.ok) M.tab = 'listings';
  } else if (type === 'market:cancel') res(s, S.market.cancel(A, c, p.id), 'Listing cancelled — goods returned.', 'inventory');
  else if (type === 'market:exchange') {
    const ex = S.market.exchange(Date.now(), { hours: 0 });
    if (p.dir === 'crystalsToGold') res(s, S.market.sellCrystals(A, Math.floor((p.amount || 0) / 100)), r => `Sold ${r.crystals} crystals for ${r.gold} gold.`);
    else res(s, S.market.buyCrystals(A, Math.floor((p.amount || 0) / Math.max(1, ex.buy))), r => `Bought ${r.crystals} crystals for ${r.gold} gold.`);
  } else return false;
  s.ui.update('market', marketData(s));
  return true;
}

// ------------------------------------------------------------------------------------------------ stronghold
const costUI = (A, cost) => Object.entries(cost || {}).filter(([, n]) => n > 0).map(([id, n]) => { const i = itemInfo(id); return { id, name: i.name, icon: i.icon, grade: i.grade, need: n, have: A.count(id) }; });
const ROLE_TAG = { Sailor: 'sea', Scout: 'land', Scholar: 'lore', Brawler: 'fight', Trader: 'trade' };
/** strongest free crew for a mission (role matching the mission tag counts ×1.25), or null if too few are free */
function pickCrew(v, m, tag) {
  const pw = c => c.power * (ROLE_TAG[c.role] === tag ? 1.25 : 1);
  const free = v.crew.filter(c => !c.busy).sort((a, b) => pw(b) - pw(a));
  return free.length >= m.crew ? free.slice(0, m.crew).map(c => c.id) : null;
}
function shData(s) {
  const A = s.account, v = S.stronghold.view(A), now = Date.now();
  const active = v.dispatch.length;
  return {
    level: v.level, xp: v.xp, xpMax: v.xpNext, energy: { now: v.energy, max: v.energyMax, perHour: S.stronghold.energy(A).perHour },
    buildings: v.buildings.map(b => ({ id: b.id, name: b.name, level: b.level, max: b.max, desc: b.desc, effect: b.effect?.text || (b.next ? `Build it: ${b.next.effect.text}` : ''),
      next: b.next ? { cost: costUI(A, b.next.cost), time: 0, req: b.next.why || null, can: b.next.can } : null })),
    research: v.research.map(r => ({ id: r.id, name: r.name, desc: r.desc, tier: r.tier, time: r.mins * 60, cost: costUI(A, r.cost), state: r.done ? 'done' : r.active ? 'active' : r.locked ? 'locked' : 'available',
      left: Math.round(r.left / 1000), total: r.mins * 60, req: r.locked || (!r.done && !r.active && v.researching ? 'Another project is underway.' : null) })),
    craft: { slots: v.craftSlots,
      queue: v.crafts.map(j => { const o = j.out[0] || {}; return { id: j.id, name: j.name, icon: o.icon, grade: o.grade, qty: j.qty, left: Math.round(j.left / 1000), total: Math.round((j.t1 - j.t0) / 1000) }; }),
      recipes: S.stronghold.recipes(A, now).map(q => ({ id: q.recipe, name: q.name, icon: q.outRows[0]?.icon, grade: q.outRows[0]?.grade, time: q.mins * 60, out: q.outRows, cost: costUI(A, q.cost), can: q.can && !q.locked && v.crafts.length < v.craftSlots, req: q.locked })) },
    dispatch: { slots: v.dispatchSlots, crew: v.crew.map(c => ({ id: c.id, name: c.name, role: c.role, power: c.power, busy: c.busy })),
      missions: S.stronghold.missions(A, now).map(m => { const crew = pickCrew(v, m, m.tag); return { id: m.id, name: m.name, time: m.mins * 60, chance: crew ? S.stronghold.dispatchChance(A, m.id, crew, now) : 0, power: m.power,
        rewards: m.rewards.map(r => { const i = itemInfo(r.id); return { name: i.name, icon: i.icon, grade: i.grade, count: r.max }; }), can: !!crew && active < v.dispatchSlots }; }),
      active: v.dispatch.map(d => ({ id: d.id, name: d.name, left: Math.round(d.left / 1000), total: Math.round((d.t1 - d.t0) / 1000), done: d.done })) },
    garden: v.garden, ranch: v.ranch, perks: v.perks,
  };
}
function shAction(s, type, p) {
  const A = s.account, c = s.char, SH = S.stronghold;
  if (type === 'sh:upgrade') res(s, SH.upgradeBuilding(A, p.id), r => `Upgraded to Lv.${r.level}.`);
  else if (type === 'sh:research') res(s, SH.startResearch(A, p.id), 'Research started.');
  else if (type === 'sh:craft') res(s, SH.craft(A, p.id, p.qty || 1), 'Crafting started.');
  else if (type === 'sh:cancel') res(s, SH.cancelCraft(A, p.id), 'Crafting cancelled — materials refunded.');
  else if (type === 'sh:collect') { const r = SH.collectCrafts(A, c); if (r.ok && r.rows.length) { s.ui.toast(`Collected ${rowsText(r.rows)}.`, 'loot'); lootFeed(s, r.rows); } }
  else if (type === 'sh:dispatch') { const v = SH.view(A), M = SH.MISSIONS.find(m => m.id === p.id); const crew = M && pickCrew(v, M, M.tag); res(s, crew ? SH.dispatch(A, p.id, crew) : { ok: false, msg: 'Not enough free crew.' }, 'The crew sets out.'); }
  else if (type === 'sh:claim') { const r = SH.collectDispatch(A, c, p.id); if (!r.ok) s.ui.toast(r.msg, 'error'); else { s.ui.toast(`${r.mission}: ${r.success ? 'success' : 'partial success'} — ${rowsText(r.rows) || 'nothing'}.`, r.success ? 'loot' : 'warn'); lootFeed(s, r.rows); } }
  else if (type === 'sh:garden') res(s, SH.collectGarden(A), r => `Harvested ${rowsText(r.rows)}.`);
  else if (type === 'sh:ranch') res(s, SH.collectRanch(A), r => `Your pets brought back ${rowsText(r.rows)}.`);
  else if (type === 'sh:recruit') res(s, SH.recruitCrew(A, { pay: p.pay || 'contract' }), r => `${r.crew.name} (${r.crew.role}) joined your crew.`);
  else if (type === 'sh:rush') res(s, SH.rush(A, p.kind, p.id), r => `Finished early for ${r.cost.crystals} crystals.`);
  else return false;
  s.refreshWindow('stronghold'); s.refreshWindow('inventory');
  return true;
}

// ------------------------------------------------------------------------------------------------ compass
const UI_KIND = { fieldboss: 'field_boss', chaosgate: 'chaos_gate', island: 'adventure_island', ghostship: 'ghost_ship' };
function compassData(s) {
  const now = Date.now(), d = new Date(now), mid = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const day = S.tasks.calendar(mid, { hours: 24 });
  const events = Object.keys(EVENTS).map(kind => {
    const occ = day.filter(e => e.kind === kind && e.start >= mid && e.start < mid + DAY);
    const w = S.tasks.eventWindow(kind, now);
    const pv = S.loot.preview(kind === 'island' ? `island:${w?.island?.focus || 'gold'}` : kind);
    return { id: kind, name: kind === 'island' ? `Adventure Island${w?.island ? `: ${w.island.name}` : ''}` : EVENTS[kind].name, kind: UI_KIND[kind], where: w?.where || '', iLvl: kind === 'chaosgate' ? 1100 : undefined,
      times: occ.map(e => Math.round((e.start - mid) / MIN)), dur: EVENTS[kind].dur, active: !!w?.live, left: w?.live ? Math.round(w.left / 1000) : undefined, next: w && !w.live ? Math.round(w.left / 1000) : undefined,
      rewards: (pv?.sections[0]?.rows || []).slice(0, 5).map(r => ({ name: r.name, icon: r.icon, grade: r.grade, count: r.max })) };
  }).filter(e => e.times.length || e.active || e.next != null);
  return { events, tracked: ss(s).tracked.slice() };
}

// ------------------------------------------------------------------------------------------------ tome & collectibles
function tomeData(s) {
  const v = S.collectibles.view(s.account), T = ss(s).tome;
  return {
    tab: T.tab, selected: T.region,
    regions: v.tome.map(r => ({ id: r.id, name: r.name, pct: Math.round(r.pct * 1000) / 10, cats: r.sections.map(x => ({ id: x.kind, label: x.name, have: x.have, total: x.total })),
      rewards: r.rewards.map(w => ({ pct: Math.round(w.pct * 100), ...firstRow(w.rows), claimed: w.claimed })), sections: r.sections })),
    collectibles: v.types.map(t => ({ id: t.id, name: t.name, icon: t.icon, have: t.have, total: t.total, tiers: t.tiers.map(x => ({ n: x.n, ...firstRow(x.rows), claimed: x.claimed })), items: t.items })),
    seedsByZone: v.seedsByZone,
  };
}

// ------------------------------------------------------------------------------------------------ rapport
function rapportData(s) {
  const A = s.account, v = S.rapport.view(A), learned = A.roster.songs || [];
  const gifts = ['gift1', 'gift2', 'gift3', 'gift4'].filter(id => A.count(id) > 0).map(id => { const i = itemInfo(id); return { uid: `mat:${id}`, id, name: i.name, grade: i.grade, icon: i.icon, kind: 'gift', count: A.count(id), desc: i.desc }; });
  return {
    selected: ss(s).rapport.sel,
    npcs: v.map(n => ({ id: n.id, name: n.name, title: n.title, icon: n.icon, stage: n.stage.idx, points: n.pts, max: n.stage.next ?? n.pts,
      daily: { songs: n.today.songs, songsMax: n.today.songsMax, emotes: n.today.emotes, emotesMax: n.today.emotesMax },
      songs: Object.keys(SONGS).map(id => ({ id, name: SONGS[id].name, locked: !learned.includes(id) })),
      emotes: (A.roster.emotes || []).map(id => ({ id, name: pretty(id) })), gifts,
      rewards: n.rewards.map(r => ({ stage: r.stage, ...firstRow(r.rows), claimed: r.claimed })),
      likes: n.likes, line: n.line, personality: n.personality, zone: n.zone })),
  };
}
function rapportResult(s, r, npcName) {
  if (!r.ok) { s.ui.toast(r.msg, 'error'); return; }
  s.ui.toast(`${npcName}: +${r.gain} rapport${r.stageUp ? ` — now ${r.stageName}!` : ''}`, r.stageUp ? 'success' : 'info');
  if (r.stageUp) s.ui.banner?.(r.stageName, { kind: 'success', sub: `${npcName} — “${r.line}”` });
  notify(s, r.notes);
}

// ------------------------------------------------------------------------------------------------ mail, guild, leaderboards, engravings, vendors
function mailData(s) {
  const box = S.mail.inbox(s.account);
  return { mails: box.list.map(m => ({ id: m.id, from: m.from, subject: m.subject, body: m.body, date: m.t, read: m.read, kind: m.kind === 'compensation' || m.kind === 'market' || m.kind === 'gift' ? 'system' : m.kind, attachments: m.attachments.map(asItem), claimed: m.claimed, expires: `in ${Math.max(1, Math.ceil(m.left / DAY))} days` })), unread: box.unread };
}
function guildData(s) {
  const A = s.account, g = S.guild.view(A);
  return {
    guild: g ? { id: g.id, name: g.name, tag: g.tag, level: g.level, xp: g.xp, xpMax: g.xpNext, motto: g.motto, bloodstones: g.bloodstones, rank: g.rank, emblem: { color: '#c9a45a' },
      members: g.roster.map(m => ({ name: m.name, cls: m.cls, level: 60, iLvl: m.ilvl, rank: m.rank, online: m.online, weekly: m.contribution, you: m.you })),
      research: g.research.map(r => ({ id: r.id, name: r.name, level: r.level, max: r.max, desc: r.desc })),
      missions: g.missions.map(m => ({ id: m.id, name: m.name, n: m.progress, need: m.need, reward: `${rowsText(m.rows)}${m.claimed ? ' · claimed' : ''}`, claimed: m.claimed, desc: m.desc })),
      donations: g.donations } : null,
    browse: S.guild.list(A).filter(x => !x.joined).map(x => ({ id: x.id, name: x.name, tag: x.tag, level: x.level, members: x.members, max: x.max, motto: x.motto, req: x.recruiting ? null : 'Full', focus: x.focus, leader: x.leader })),
  };
}
function lbData(s) {
  const L = ss(s).lb, v = S.boards.view(s.account, L.board);
  return { board: L.board, boards: S.boards.list().map(b => ({ id: b.id, label: b.name })),
    rows: v.entries.slice(0, 50).map(e => ({ rank: e.rank, name: e.name, cls: e.cls, value: e.display, sub: e.guild || '', you: e.you })),
    you: v.you ? { rank: v.you.rank, value: v.you.display } : null, note: v.desc + (v.guardian ? ` Today: ${pretty(v.guardian)}.` : '') };
}
function engrData(s) {
  const v = S.engravings.view(s.account, s.char), sum = v.summary;
  return { active: sum.list.map(e => ({ id: e.id, nodes: e.nodes, neg: e.negative, sources: e.sources.map(x => ({ name: x.name, v: x.v })) })),
    equipped: v.slots.map(x => x ? { id: x.id, nodes: x.nodes } : null), books: v.learned.filter(l => l.equipMax > 0).map(l => ({ id: l.id, nodes: l.equipMax })), maxBook: 12,
    summary: { label: sum.label, threes: sum.threes, fiveByThree: sum.fiveByThree }, learned: v.learned, unread: v.books };
}
function vendorData(s, shopId) {
  const v = S.shops.view(s.account, s.char, shopId); if (!v) return null;
  return { name: v.name, title: v.desc, npc: v.npc, shop: shopId,
    items: v.items.map(x => ({ id: x.key, item: { id: x.id, name: x.name, grade: x.grade, icon: x.icon, kind: x.kind, desc: [x.desc, !x.can && x.why ? x.why : null].filter(Boolean).join('\n'), count: x.qty }, price: { cur: x.price.currency, amount: x.price.amount },
      limit: x.limit ? `${x.limit.left}/${x.limit.max} ${x.limit.period}` : undefined, stock: x.limit ? x.limit.left : undefined, can: x.can, why: x.why })),
    currencies: { ...cur(s.account), ...v.currencies } };
}
function openShop(s, shopId) { const d = vendorData(s, shopId); if (!d) return; ss(s).shop = shopId; s.ui.open('vendor', d); }
function syncBattleItems(s, id, n) { const c = s.char; if (!c || ITEMS[id]?.kind !== 'battle') return; const slot = c.items?.find(it => it.id === id); if (slot) slot.count += n; const hi = s.game?.hero?.items?.find(it => it.id === id); if (hi) hi.count += n; }

// ------------------------------------------------------------------------------------------------ dialogs (tasks board, songs, quality)
async function tasksBoard(s) {
  const A = s.account, c = s.char, v = S.tasks.view(A);
  const lines = [...v.daily.offered, ...v.weekly.offered];
  const choices = [];
  for (const t of lines) {
    const weekly = v.weekly.offered.includes(t);
    if (t.accepted && t.done && !t.claimed) choices.push({ id: `claim:${t.id}`, text: `Claim: ${t.name} (${rowsText(t.rows)})`, kind: 'quest' });
    else if (!t.accepted && (weekly ? v.weekly.accepted.length < v.weekly.max : v.daily.accepted.length < v.daily.max)) choices.push({ id: `accept:${t.id}`, text: `${weekly ? 'Weekly' : 'Daily'}: ${t.name} — ${t.desc}`, kind: 'talk' });
  }
  for (const r of v.rep.rewards) if (r.ready) choices.push({ id: `rep:${r.level}`, text: `Reputation level ${r.level} reward: ${rowsText(r.rows)}`, kind: 'quest' });
  choices.push({ id: 'bye', text: 'Leave the board.', kind: 'leave' });
  const acc = [...v.daily.offered, ...v.weekly.offered].filter(t => t.accepted).map(t => `${t.name} ${t.n}/${t.need}${t.claimed ? ' ✓' : ''}`).join(' · ');
  const pick = await s.ui.dialog({ name: 'Wayfarer’s Board', title: `Reputation ${v.rep.level} · ${v.rep.pts} pts` }, [{ text: `Daily tasks ${v.daily.accepted.length}/${v.daily.max}, weekly ${v.weekly.accepted.length}/${v.weekly.max}.${acc ? ` Accepted: ${acc}.` : ' Pick up to three of each.'}`, choices }]);
  if (!pick || pick === 'bye') return;
  const [k, id] = pick.split(':');
  if (k === 'accept') res(s, S.tasks.accept(A, id), 'Task accepted.');
  else if (k === 'claim') { const r = S.tasks.claim(A, c, id); res(s, r, x => `Task complete: ${rowsText(x.rows)} (+${x.rep} reputation).`); lootFeed(s, r.rows); }
  else if (k === 'rep') res(s, S.tasks.claimRep(A, c, +id), x => `Reputation reward: ${rowsText(x.rows)}.`);
  return tasksBoard(s);
}
const SONG_PRICES = { tides: 20000, rest: 30000, valor: 40000 };
async function songTeacher(s) {
  const A = s.account, have = A.roster.songs ||= ['homeward'];
  const offers = Object.entries(SONG_PRICES).filter(([id]) => !have.includes(id));
  const choices = offers.map(([id, p]) => ({ id, text: `Learn ${SONGS[id].name} — ${p.toLocaleString('en-US')} silver (${SONGS[id].desc})`, kind: 'shop' }));
  choices.push({ id: 'bye', text: 'Maybe later.', kind: 'leave' });
  const pick = await s.ui.dialog({ name: 'Lyra Songwind', title: 'Song Teacher' }, [{ text: offers.length ? 'Which melody shall I teach you?' : 'You know every song I can teach. The Song of Sunrise? Only Seraphine sings that one.', choices }]);
  if (!pick || pick === 'bye') return;
  if (!A.take('silver', SONG_PRICES[pick])) { s.ui.toast('Not enough silver.', 'error'); return; }
  have.push(pick); A.save(); s.ui.toast(`You learned ${SONGS[pick].name}!`, 'success');
}
async function qualityMenu(s) {
  const A = s.account, c = s.char;
  const slots = GEAR_SLOTS.filter(sl => c.equip[sl] && c.equip[sl].set !== 'story' && c.equip[sl].quality < 100);
  const choices = slots.map(sl => ({ id: sl, text: `${c.equip[sl].name}: quality ${c.equip[sl].quality}`, kind: 'shop' }));
  choices.push({ id: 'bye', text: 'Leave', kind: 'leave' });
  const pick = await s.ui.dialog({ name: 'Hilda Ironbrand', title: 'Quality Upgrade' }, [{ text: 'I can re-temper a piece. It never gets worse — only better, if the metal agrees. 20,000 silver plus a little gold.', choices }]);
  if (!pick || pick === 'bye') return;
  const r = S.honing.upgradeQuality(A, c, pick);
  if (!r.ok) s.ui.toast(r.msg, 'error'); else { s.ui.toast(r.now > r.old ? `Quality ${r.old} → ${r.now}!` : `Rolled ${r.rolled} — quality stays ${r.now}.`, r.now > r.old ? 'success' : 'info'); s.refreshChar?.(); }
}

// ------------------------------------------------------------------------------------------------ inventory use
function useItem(s, p) {
  const A = s.account, c = s.char, u = String(p.uid || '');
  if (!c) return false;
  if (u.startsWith('mat:')) {
    const id = u.slice(4);
    if (/^card_pack/.test(id)) { openCardPack(s, id); return true; }
    if (id === 'gem_pouch' || id === 'gem_pouch_hi') { const r = S.gems.openPouch(A, c, id); res(s, r, x => `The pouch held a ${x.gem.name}!`, ['inventory', 'gems']); return true; }
    if (/^food\d$/.test(id) || id === 'life_tonic') { res(s, S.lifeskills.eat(A, id), x => `Life Energy ${x.energy.toLocaleString('en-US')}.`, 'inventory'); return true; }
    if (id === 'skill_potion') { if (!A.take('skill_potion', 1)) return true; c.bonusPts = (c.bonusPts || 0) + 1; c.skillPts = (c.skillPts || 0) + 1; A.save(); s.ui.toast('You feel wiser: +1 skill point.', 'success'); s.refreshWindow('skills'); s.refreshWindow('inventory'); return true; }
    if (id === 'accessory_chest') { if (!A.take(id, 1)) return true; const g = S.rolls.generate('acc:5'); for (const it of g.items) A.addItem(c, it); s.ui.toast(`The chest held a ${g.items[0].name}.`, 'loot'); s.refreshWindow('inventory'); return true; }
    if (id === 'chest') { if (!A.take(id, 1)) return true; const rows = S.common.grantBundle(A, c, S.rolls.rollTable([{ id: 'leapstone', n: [8, 14] }, { id: 'guardian_stone', n: [300, 500] }, { id: 'destruction_stone', n: [100, 160] }, { id: 'fusion', n: [3, 6] }], null)); s.ui.toast(`Adventurer’s Chest: ${rowsText(rows)}.`, 'loot'); s.refreshWindow('inventory'); return true; }
    if (id === 'map') { if (!A.take(id, 1)) return true; const r = S.loot.eventReward(A, c, { kind: 'treasure' }); s.ui.toast(`You follow the map and dig up: ${rowsText(r.rows)}.`, 'loot'); lootFeed(s, r.rows); s.refreshWindow('inventory'); return true; }
    if (id === 'crew_contract') { res(s, S.stronghold.recruitCrew(A, { pay: 'contract' }), x => `${x.crew.name} (${x.crew.role}) joined your stronghold crew.`, 'inventory'); return true; }
    return false;
  }
  const it = (c.inv || []).find(x => x.uid === u);
  if (!it) return false;
  if (it.kind === 'book') { res(s, S.engravings.readBook(A, c, u), x => `Learned ${x.points} points of ${pretty(x.engr)} (${x.total}/80 · equip up to +${x.equipMax}).`, ['inventory', 'engravings']); return true; }
  if (it.kind === 'gem') { s.menu?.('gems'); return true; }
  return false;
}

// ------------------------------------------------------------------------------------------------ the plugin
class SystemsPlugin {
  constructor() { this.id = 'systems'; this.t = 0; this.offs = []; }
  init(s) {
    this.s = s;
    const on = (type, fn) => { const off = s.bus?.on?.(type, e => { try { fn(e || {}); } catch (err) { console.error('[systems]', type, err); } }); if (off) this.offs.push(off); };
    const T = (event, data) => { if (!s.char) return; notify(s, S.tasks.track(s.account, s.char, event, data)); };
    on('kill', e => {
      if (!e.mine || !s.char) return;
      const u = e.unit || {}, family = FAMILY[u.type] || (u.kind === 'boss' ? 'boss' : 'monster');
      T('kill', { mob: u.type, family, zone: e.zone, elite: !!u.data?.elite, boss: u.kind === 'boss', count: 1 });
      if (u.kind === 'mob' && OPEN_WORLD.has(s.game?.mode?.kind)) { const r = S.loot.fieldDrop(s.account, s.char, { kind: u.data?.elite ? 'elite' : u.data?.named ? 'named' : 'mob' }); lootFeed(s, r.rows?.filter(x => x.kind !== 'currency' || x.count >= 100)); }
    });
    on('clear', e => {
      const c = e.content || {}, r = e.result || {};
      if (!r.cleared) return;
      const content = c.kind === 'raid' ? (RAIDS[c.raid]?.kind === 'abyss' ? 'abyss' : 'raid') : c.kind;
      T('clear', { content, id: c.boss || c.raid || c.island, tier: c.tier, gate: c.gate, mode: c.hard ? 'hard' : 'normal', time: r.time, deaths: r.deaths, floor: c.floor || r.floor });
    });
    on('zone', e => {
      const A = s.account, c = s.char; if (!c) return;
      const st = ss(s);
      if (!st.welcomed[c.id]) { st.welcomed[c.id] = true; T('login', {}); const sent = S.mail.welcome(A, c); if (sent.length) s.ui.toast(`You have ${sent.length} new letter${sent.length > 1 ? 's' : ''}. (Mailbox)`, 'info'); }
      T('zone', { zone: e.id });
    });
    on('talk', e => { const tome = S.collectibles.TOME.solhaven; if (s.game?.zone?.id === 'solhaven' && tome.npcs.some(n => n.id === e.npc)) S.collectibles.tomeRecord(s.account, 'solhaven', 'npcs', e.npc, s.char); });
    on('song', e => { const rid = rapportId(e.npc); if (rid && s.char) { const r = S.rapport.song(s.account, s.char, rid, e.id === 'lullaby' ? 'rest' : e.id); if (r.ok) rapportResult(s, r, S.rapport.one(s.account, rid).name); else if (r.why === 'limit') s.ui.toast(r.msg, 'info'); } else T('song', { song: e.id }); });
    on('emote', e => { const rid = rapportId(e.npc); if (rid && s.char) { const r = S.rapport.emote(s.account, s.char, rid, e.id); if (r.ok) rapportResult(s, r, S.rapport.one(s.account, rid).name); } else T('emote', { emote: e.id }); });
    on('gather', e => { if (!s.char || e.sys) return; if (e.items) T('gather', { skill: e.skill, count: 1 }); else { const r = S.lifeskills.gather(s.account, s.char, e.skill); if (r.ok) lootFeed(s, r.rows); else s.ui.toast(r.msg, 'warn'); } });
    on('collect', e => { if (!s.char || e.sys) return; const f = S.collectibles.find(e.id); if (!f) return; const r = S.collectibles.collect(s.account, s.char, f.type, e.id); if (r.ok && r.isNew) { s.ui.toast(`${r.name} found! (${r.have}/${r.total})`, 'loot'); notify(s, r.notes); if (r.ready.length) s.ui.toast('A collection reward is ready in the Adventure Tome.', 'success'); } });
    on('hone', e => { if (e.sys) return; T('hone', { success: !!e.success, chance: e.chance, to: e.item?.hone, taps: 1 }); });
    on('facet', e => { if (e.sys) return; T('facet', { success: !!e.success }); });
    on('sail', e => T('sail', e));
    on('pvp', e => T('pvp', e));
    on('death', () => T('death', {}));
    on('boss_part', e => T('boss_part', e));
  }
  update(dt) {
    const s = this.s; if (!s?.char) return;
    this.t -= dt; if (this.t > 0) return; this.t = 10;
    notify(s, S.tick(s.account, s.char));
  }
  hud(h) {
    const s = this.s; if (!s?.char) return;
    const now = Date.now(), c = this.hc;
    if (!c || now - c.t > 500 || c.char !== s.char) {   // the HUD asks ~15×/s; tasks & mail change slowly
      const A = s.account, v = S.tasks.view(A, now);
      const q = [...v.daily.offered.filter(t => t.accepted && !t.claimed).map(t => ({ t, kind: 'daily' })), ...v.weekly.offered.filter(t => t.accepted && !t.claimed).map(t => ({ t, kind: 'weekly' }))];
      this.hc = { t: now, char: s.char, unread: (A.roster.mail || []).filter(m => !m.read).length,
        quests: q.map(({ t, kind }) => ({ id: `task:${t.id}`, title: t.name, kind, steps: [{ text: t.desc, n: t.n, need: t.need, done: t.done }] })) };
    }
    h.badges = { ...(h.badges || {}), mail: this.hc.unread };
    if (this.hc.quests.length) h.quests = [...(h.quests || []), ...this.hc.quests];
  }
  npcChoices(npcId) {
    const out = [];
    if (npcId === 'blacksmith') out.push({ id: 'sys:shop:raid', text: 'Reforge into Horned Tyrant gear (raid vendor)', kind: 'shop' }, { id: 'sys:quality', text: 'Upgrade gear quality', kind: 'shop' });
    if (npcId === 'cards') out.push({ id: 'sys:shop:card', text: 'Buy card packs', kind: 'shop' }, { id: 'sys:stone', text: 'Facet an ability stone', kind: 'shop' });
    if (npcId === 'pvp') out.push({ id: 'sys:shop:pvp', text: 'Proving Grounds rewards', kind: 'shop' });
    if (npcId === 'guild') out.push({ id: 'sys:shop:guild', text: 'Guild shop (bloodstones)', kind: 'shop' });
    if (npcId === 'harbor') out.push({ id: 'sys:shop:harbor', text: 'Harbor exchange (pirate coins)', kind: 'shop' }, { id: 'sys:shop:island', text: 'Glass Sea token exchange', kind: 'shop' });
    if (npcId === 'bank') out.push({ id: 'sys:shop:crystal', text: 'Crystal shop', kind: 'shop' });
    return out;
  }
  onNpcChoice(npcId, choice) {
    const s = this.s;
    if (choice === 'rapport') { const rid = rapportId(npcId); if (!rid) return false; ss(s).rapport.sel = rid; s.ui.open('rapport', { ...rapportData(s), selected: rid }); return true; }
    if (!String(choice || '').startsWith('sys:')) return false;
    const [, k, a] = choice.split(':');
    if (k === 'shop') openShop(s, a);
    else if (k === 'quality') qualityMenu(s);
    else if (k === 'stone') s.ui.open('stone', stoneData(s));
    return true;
  }
}

// ------------------------------------------------------------------------------------------------ registration
registerPlugin(new SystemsPlugin());
registerWindow('honing', s => honingData(s));
registerWindow('stone', s => stoneData(s));
registerWindow('cards', s => cardsData(s));
registerWindow('gems', s => gemsData(s));
registerWindow('market', s => marketData(s));
registerWindow('stronghold', s => shData(s));
registerWindow('compass', s => compassData(s));
registerWindow('tome', s => tomeData(s));
registerWindow('collectibles', s => ({ ...tomeData(s), tab: 'collectibles' }));
registerWindow('rapport', s => rapportData(s));
registerWindow('mail', s => mailData(s));
registerWindow('guild', s => guildData(s));
registerWindow('leaderboards', s => lbData(s));
registerWindow('engravings', s => engrData(s));

registerService('honing', s => s.ui.open('honing', honingData(s)));
registerService('market', s => s.ui.open('market', marketData(s)));
registerService('cards', s => s.ui.open('cards', cardsData(s)));
registerService('gems', s => s.ui.open('gems', gemsData(s)));
registerService('mail', s => s.ui.open('mail', mailData(s)));
registerService('guild', s => s.ui.open('guild', guildData(s)));
registerService('tasks', s => tasksBoard(s));
registerService('songs', s => songTeacher(s));
registerService('shop:general', s => openShop(s, 'general'));
registerService('rapport', (s, n) => { const rid = rapportId(n?.id); ss(s).rapport.sel = rid; s.ui.open('rapport', { ...rapportData(s), selected: rid }); });

registerAction('hone:', (s, type, p) => {
  if (!s.char) return false;
  if (type === 'hone:select') { ss(s).hone.uid = p.uid; ss(s).hone.result = null; s.refreshWindow('honing'); return true; }
  if (type === 'hone:booster') return true;
  if (type === 'hone:tap') return honeTap(s, p);
  return false;
});
registerAction('stone:', (s, type, p) => {
  if (!s.char) return false;
  const st = ss(s).stone;
  if (type === 'stone:select') st.uid = p.uid;
  else if (type === 'stone:facet') {
    const r = S.engravings.facet(s.account, s.char, p.uid, p.line);
    if (!r.ok) s.ui.toast(r.msg, 'error');
    else {
      st.uid = p.uid; st.last = { line: p.line, ok: r.success }; st.key = (st.key || 0) + 1; notify(s, r.notes);
      s.bus?.emit?.('facet', { success: r.success, stone: r.stone, sys: true });
      if (r.done) s.ui.toast(`Stone finished: ${r.stone.label}${r.stone.is97 ? ' — a 97 stone!' : ''}`, r.stone.is97 ? 'success' : 'info');
      if (r.done && r.stone.is97) s.ui.banner?.('97 STONE!', { kind: 'success', sub: r.stone.lines.slice(0, 2).map(l => `${l.name} ${l.nodes}`).join(' · ') });
      if (r.stone.equipped) s.refreshChar?.();
    }
  } else if (type === 'stone:share') { const v = stoneList(s.char).find(x => x.uid === p.uid); if (v) { s.shareCard = { kind: 'stone', ...S.engravings.stoneView(v) }; s.ui.toast(`Share card ready: ${s.shareCard.label} stone.`, 'info'); } }
  else return false;
  s.ui.update('stone', stoneData(s));
  return true;
});
registerAction('cards:', (s, type, p) => {
  const A = s.account;
  if (type === 'cards:equip') res(s, S.cards.setDeck(A, p.slot, p.id));
  else if (type === 'cards:unequip') res(s, S.cards.setDeck(A, p.slot, null));
  else if (type === 'cards:awaken') res(s, S.cards.awaken(A, p.id), r => `Awakened to ★${r.awaken}.`);
  else if (type === 'cards:open') { openCardPack(s, p.pack || 'card_pack'); return true; }
  else if (type === 'cards:auto') res(s, S.cards.autoDeck(A));
  else if (type === 'cards:choose') res(s, S.cards.choose(A, p.index | 0), r => `${r.card.name} joins your collection.`);
  else return false;
  s.refreshWindow('cards'); s.refreshChar?.();
  return true;
});
registerAction('gems:', (s, type, p) => {
  if (!s.char) return false;
  const A = s.account, c = s.char;
  if (type === 'gems:socket') return gemSocket(s, p);
  if (type === 'gems:unsocket') res(s, S.gems.unsocket(A, c, p.slot), null, 'inventory');
  else if (type === 'gems:target') res(s, S.gems.assign(A, c, p.slot, p.skill));
  else if (type === 'gems:fuse') res(s, S.gems.fuseUids(A, c, p.uids || []), r => `Fused: ${r.made[0].name}!`, 'inventory');
  else return false;
  s.refreshWindow('gems'); s.refreshChar?.();
  return true;
});
registerAction('market:', (s, type, p) => (s.char ? marketAction(s, type, p) : false));
registerAction('sh:', (s, type, p) => (s.char ? shAction(s, type, p) : false));
registerAction('compass:', (s, type, p) => {
  const st = ss(s);
  if (type === 'compass:track') { st.tracked = st.tracked.filter(x => x !== p.id); if (p.on) st.tracked.push(p.id); return true; }
  if (type === 'compass:go') { const w = S.tasks.eventWindow(p.id); if (w) s.ui.toast(w.live ? `${w.name} is live${w.where ? ` in ${w.where}` : ''} — hurry!` : `${w.name}${w.where ? ` (${w.where})` : ''} starts in ${Math.ceil(w.left / MIN)} min.`, 'info'); return true; }
  return false;
});
registerAction('tome:', (s, type, p) => {
  const T = ss(s).tome;
  if (type === 'tome:region') { T.region = p.id; return true; }
  if (type === 'tome:claim') { const r = S.collectibles.tomeClaim(s.account, s.char, p.region, (p.pct || 0) / 100); res(s, r, x => `Tome reward: ${rowsText(x.rows)}.`); if (r.ok) lootFeed(s, r.rows); s.refreshWindow('tome'); return true; }
  return false;
});
registerAction('collect:', (s, type, p) => {
  if (type !== 'collect:claim') return false;
  const r = S.collectibles.claim(s.account, s.char, p.id, p.n); res(s, r, x => `Collection reward: ${rowsText(x.rows)}.`); if (r.ok) lootFeed(s, r.rows);
  s.refreshWindow('tome'); s.refreshWindow('collectibles');
  return true;
});
registerAction('rapport:', (s, type, p) => {
  if (!s.char) return false;
  const A = s.account, name = id => S.rapport.one(A, id)?.name || id;
  if (type === 'rapport:select') { ss(s).rapport.sel = p.id; return true; }
  if (type === 'rapport:song') { const r = S.rapport.song(A, s.char, p.npc, p.id); if (r.ok) s.game?.audio?.song?.(p.id, {}); rapportResult(s, r, name(p.npc)); }
  else if (type === 'rapport:emote') { const r = S.rapport.emote(A, s.char, p.npc, p.id); if (r.ok) s.game?.hero?.u?.model?.play?.(p.id, { dur: 2.2 }); rapportResult(s, r, name(p.npc)); }
  else if (type === 'rapport:gift') rapportResult(s, S.rapport.gift(A, s.char, p.npc, String(p.uid || '').replace(/^mat:/, ''), 1), name(p.npc));
  else if (type === 'rapport:claim') { const r = S.rapport.claim(A, s.char, p.npc, p.stage); res(s, r, x => `${name(p.npc)} gave you ${rowsText(x.rows)}.`); if (r.ok) lootFeed(s, r.rows); }
  else return false;
  s.ui.update('rapport', { ...rapportData(s), selected: p.npc }); s.refreshWindow('inventory');
  return true;
});
registerAction('mail:', (s, type, p) => {
  const A = s.account;
  if (type === 'mail:open') S.mail.read(A, p.id);
  else if (type === 'mail:claim') { const r = S.mail.claim(A, s.char, p.id); res(s, r, x => `Claimed ${rowsText(x.rows)}.`); if (r.ok) { lootFeed(s, r.rows); for (const x of r.rows) syncBattleItems(s, x.id, x.count); } }
  else if (type === 'mail:claimAll') { const r = S.mail.claimAll(A, s.char); if (r.rows.length) { s.ui.toast(`Claimed ${rowsText(r.rows)}.`, 'success'); lootFeed(s, r.rows); for (const x of r.rows) syncBattleItems(s, x.id, x.count); } }
  else if (type === 'mail:delete') res(s, S.mail.remove(A, p.id));
  else return false;
  s.refreshWindow('mail'); s.refreshWindow('inventory');
  return true;
});
registerAction('guild:', (s, type, p) => {
  const A = s.account;
  if (type === 'guild:donate') res(s, S.guild.donate(A, s.char, p.kind, p.tier || 0), r => `Donated: +${r.bloodstones} bloodstones, +${r.xp} guild xp.`);
  else if (type === 'guild:join') res(s, S.guild.join(A, p.id), r => `Welcome to ${r.guild.name}!`);
  else if (type === 'guild:create') { const r = S.guild.create(A, { name: p.name, motto: p.motto || '' }); if (r.ok && p.tag) r.guild.tag = String(p.tag).slice(0, 4).toUpperCase(); res(s, r, x => `You founded ${x.guild.name}!`); }
  else if (type === 'guild:leave') res(s, S.guild.leave(A), r => `You left ${r.left}.`);
  else if (type === 'guild:research') res(s, S.guild.setResearch(A, p.id), 'Research focus set.');
  else if (type === 'guild:mission') { const g = S.guild.view(A), m = g?.missions.find(x => x.id === p.id); if (m?.done && !m.claimed) res(s, S.guild.claimMission(A, s.char, p.id), r => `Mission reward: ${rowsText(r.rows)}.`); else if (m) s.ui.toast(`${m.name}: ${m.progress}/${m.need} (you: ${m.mine}).`, 'info'); }
  else return false;
  s.refreshWindow('guild');
  return true;
});
registerAction('lb:', (s, type, p) => { if (type !== 'lb:board') return false; ss(s).lb.board = p.board; s.ui.update('leaderboards', lbData(s)); return true; });
registerAction('title:leaderboards', s => { s.ui.open('leaderboards', lbData(s)); return true; });
registerAction('engr:', (s, type, p) => {
  if (!s.char) return false;
  if (type === 'engr:equip') res(s, S.engravings.equip(s.account, s.char, p.slot, p.id));
  else if (type === 'engr:unequip') res(s, S.engravings.unequip(s.account, s.char, p.slot));
  else return false;
  s.refreshChar?.(); s.refreshWindow('engravings');
  return true;
});
registerAction('vendor:buy', (s, type, p) => {
  const shop = ss(s).shop; if (!shop || !s.char) return false;
  const r = S.shops.buy(s.account, s.char, shop, p.id, p.qty || 1);
  if (!r.ok) { s.ui.toast(r.msg, 'error'); s.game?.audio?.sfx?.('ui_error', {}); }
  else { s.game?.audio?.sfx?.('coin', {}); s.ui.toast(`Bought ${rowsText(r.rows)}.`, 'success'); for (const x of r.rows) syncBattleItems(s, x.id, x.count); if (String(p.id).startsWith('transfer_')) s.refreshChar?.(); }
  s.ui.update('vendor', vendorData(s, shop)); s.refreshWindow('inventory');
  return true;
});
registerAction('shop:open', (s, type, p) => { openShop(s, p.id); return true; });
registerAction('window:', (s, type, p) => { if (type === 'window:close' && p?.id === 'vendor') ss(s).shop = null; return false; });
registerAction('inv:use', (s, type, p) => useItem(s, p));
export { honingData, stoneData, cardsData, gemsData, marketData, shData, compassData, tomeData, rapportData, mailData, guildData, lbData, engrData, vendorData };
