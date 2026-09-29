// The auction house: order books for every tradable item (gold per bundle), SimPlayer listings (named with
// social/names.js simName) that relist every 10 minutes, reference prices that drift with deterministic supply/demand
// noise over real time plus the impact of your own trades, buying cheapest-first, listing with a 5% sales fee and a
// 24 h expiry, your listings selling over time (proceeds and returns arrive by mail), unique accessory listings, a
// price history for charts, and the Crystal ↔ Gold exchange with a drifting rate. State: roster.market.
import { ITEMS, SILVER_PER_GOLD } from '../../data/items.js';
import { ENGRAVINGS, COMBAT_ENGRAVINGS } from '../../data/engravings.js';
import { ENGRAVING_DEMAND } from '../../data/loot.js';
import { makeBook, makeGem, makeAccessory } from './gear.js';
import { simName } from '../social/names.js';
import { RNG, Simplex, hashStr } from '../../core/noise.js';
import { econMods } from './mods.js';
import { send as sendMail } from './mail.js';
import { ok, fail, pay, grantBundle, bundleRows, itemInfo, iconFor, seeded, emit, hash01, clamp, MIN, HOUR, DAY } from './common.js';
import { uid } from '../../core/util.js';

export const FEE = 0.05, EXPIRY = 24 * HOUR, STEP = 10 * MIN, MAX_LISTINGS = 20;
const WEEK = 7 * DAY, TAU = 6 * HOUR;

// ------------------------------------------------------------------------------------------------ catalog
const HONING = ['destruction_stone', 'guardian_stone', 'leapstone', 'fusion', 'solar_grace', 'solar_blessing', 'solar_protection'];
const FOOD = ['food1', 'food2', 'food3', 'food4'];
const catOf = (id, t) => HONING.includes(id) ? 'honing' : t.kind === 'battle' ? 'battle' : FOOD.includes(id) ? 'food' : 'trade';
const px = v => v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
const VOL = { honing: 0.08, battle: 0.05, trade: 0.06, food: 0.05, book: 0.12, gem: 0.1 };
const DAILY = { honing: 5000, battle: 2000, trade: 3000, food: 800 };
export const ITEMS_MARKET = {};
for (const [id, t] of Object.entries(ITEMS)) {
  if (!t.tradable && !FOOD.includes(id)) continue;
  const g = t.gold ?? (t.value || 1) / SILVER_PER_GOLD, unit = g >= 1 ? 1 : g >= 0.1 ? 10 : 100, cat = catOf(id, t);
  ITEMS_MARKET[id] = { id, name: t.name, grade: t.grade ?? 1, icon: iconFor(id), cat, unit, base: px(g * unit), vol: VOL[cat], daily: DAILY[cat] };
}
for (const e of COMBAT_ENGRAVINGS) {
  const d = ENGRAVING_DEMAND[e] || 1, id = `book:${e}`;
  ITEMS_MARKET[id] = { id, name: `${ENGRAVINGS[e].name} Engraving Recipe`, grade: 4, icon: iconFor(id), cat: 'book', unit: 1, base: Math.round(12 + d * d * 4), vol: VOL.book, daily: Math.round(20 + d * d * 3), engr: e };
}
for (const type of ['ruin', 'swift']) for (let lv = 1; lv <= 10; lv++) {
  const id = `gem:${type}:${lv}`;
  ITEMS_MARKET[id] = { id, name: `Lv.${lv} ${type === 'ruin' ? 'Ruinstone' : 'Swiftstone'}`, grade: Math.min(7, 2 + Math.floor(lv / 2)), icon: iconFor(id), cat: 'gem', unit: 1, base: px(2.5 * Math.pow(3, lv - 1) * (type === 'ruin' ? 1 : 0.8)), vol: VOL.gem, daily: Math.max(4, Math.round(400 / lv / lv)), gem: type, level: lv };
}
const CATS = [['honing', 'Honing Materials'], ['battle', 'Battle Items'], ['trade', 'Trade Goods'], ['food', 'Cooking'], ['book', 'Engraving Recipes'], ['gem', 'Gems'], ['accessory', 'Accessories']];
export function categories() { return CATS.map(([id, name]) => ({ id, name, items: id === 'accessory' ? [] : Object.values(ITEMS_MARKET).filter(m => m.cat === id).map(m => m.id) })); }

// ------------------------------------------------------------------------------------------------ prices
const NOISE = new Simplex(0x5eed42);
const lane = id => (hashStr(id) % 997) + 0.5;
const WEEK0 = 6 * DAY + 10 * HOUR; // weekly reset offset (Wednesday 10:00 UTC)
/** reference price per bundle without the impact of your trades (deterministic in time) */
export function price(id, now = Date.now()) {
  const M = ITEMS_MARKET[id]; if (!M) return 0;
  const d = now / DAY, L = lane(id);
  const n = 0.6 * NOISE.noise2(d / 3, L) + 0.3 * NOISE.noise2(d * 1.3, L + 101) + 0.1 * NOISE.noise2(d * 8, L + 211);
  const phase = (((now - WEEK0) % WEEK) + WEEK) % WEEK / WEEK;
  const cycle = (M.cat === 'honing' || M.cat === 'book' ? 0.05 : 0.02) * Math.cos(phase * Math.PI * 2);
  return px(M.base * Math.exp(M.vol * 2.2 * n + cycle));
}
function st(account, now = Date.now()) {
  const r = account.roster, m = r.market ||= {};
  if (!Array.isArray(m.listings)) m.listings = [];
  if (!Array.isArray(m.sold)) m.sold = [];
  m.impact ||= {}; m.taken ||= {}; m.accTaken ||= {}; m.t ??= now;
  return m;
}
function impactOf(m, id, now) {
  const list = m.impact[id]; if (!list) return 0;
  let s = 0; for (const [t, v] of list) if (now >= t) s += v * Math.exp(-(now - t) / TAU);
  return clamp(s, -0.4, 0.6);
}
function addImpact(m, id, v, now) {
  const list = (m.impact[id] ||= []).filter(([t]) => now - t < 3 * TAU);
  list.push([now, clamp(v, -0.3, 0.3)]); m.impact[id] = list.slice(-20);
}
/** reference price including your recent trades */
export function refPrice(account, id, now = Date.now()) { const m = st(account, now); return px(price(id, now) * (1 + impactOf(m, id, now))); }

// ------------------------------------------------------------------------------------------------ order books
const bucket = now => Math.floor(now / STEP);
function simAsks(id, now, ref, names = true) {
  const M = ITEMS_MARKET[id], b = bucket(now);
  const r = new RNG((hashStr(id) ^ Math.imul(b, 2654435761)) >>> 0), rn = names ? new RNG((hashStr(id + '#n') ^ Math.imul(b, 40503)) >>> 0) : null;
  const n = r.int(6, 9), out = [];
  let p = ref * (0.985 + r.range(0, 0.012));
  const [q0, q1] = M.cat === 'book' ? [1, 4] : M.cat === 'gem' ? [1, Math.max(1, 6 - Math.floor(M.level / 2))] : M.cat === 'food' ? [5, 60] : [40, 900];
  for (let i = 0; i < n; i++) {
    out.push({ key: `${b}:${i}`, seller: rn ? simName(rn) : '', price: Math.max(0.1, px(p)), qty: r.int(q0, q1), you: false });
    p *= 1.012 + r.range(0, 0.02);
  }
  return out;
}
function asksFor(account, id, now) {
  const m = st(account, now), ref = refPrice(account, id, now), b = bucket(now);
  const tk = m.taken[id]?.b === b ? m.taken[id].q : {};
  const asks = simAsks(id, now, ref).map(a => ({ ...a, qty: a.qty - (tk[a.key] || 0) })).filter(a => a.qty > 0);
  for (const l of m.listings) if (l.itemId === id && l.qty > 0 && l.status === 'active') asks.push({ key: l.id, seller: account.roster.name || 'You', price: l.price, qty: l.qty, you: true });
  return asks.sort((a, b2) => a.price - b2.price || (a.you ? 1 : -1));
}
function haveOf(account, char, id) {
  const M = ITEMS_MARKET[id]; if (!M) return 0;
  if (M.cat === 'book') return (char?.inv || []).filter(it => it.kind === 'book' && it.engr === M.engr).length;
  if (M.cat === 'gem') return (char?.inv || []).filter(it => it.kind === 'gem' && it.gem === M.gem && it.level === M.level).length;
  return Math.floor(account.count(id) / M.unit);
}
function change24(id, now) { const a = price(id, now - DAY); return a ? price(id, now) / a - 1 : 0; }
export function browse(account, { cat, q, now = Date.now(), char = null } = {}) {
  tick(account, now);
  const needle = q ? String(q).toLowerCase() : null;
  return Object.values(ITEMS_MARKET).filter(M => (!cat || M.cat === cat) && (!needle || M.name.toLowerCase().includes(needle))).map(M => {
    const ref = refPrice(account, M.id, now), asks = simAsks(M.id, now, ref, false);
    return { id: M.id, name: M.name, grade: M.grade, icon: M.icon, cat: M.cat, unit: M.unit, price: asks[0].price, ref, change24: change24(M.id, now), volume24: Math.round(M.daily * (0.8 + 0.4 * hash01(M.id, Math.floor(now / DAY)))), have: haveOf(account, char, M.id) };
  });
}
export function history(id, { now = Date.now(), hours = 168, step = HOUR } = {}) {
  const M = ITEMS_MARKET[id]; if (!M) return [];
  const out = [], t0 = Math.floor(now / step) * step - hours * HOUR;
  for (let t = t0; t <= now; t += step) out.push({ t, price: price(id, t), vol: Math.round(M.daily * step / DAY * (0.6 + 0.8 * hash01(id, Math.floor(t / step)))) });
  return out;
}
export function book(account, id, now = Date.now(), char = null) {
  const M = ITEMS_MARKET[id]; if (!M) return null;
  tick(account, now);
  const asks = asksFor(account, id, now), ref = refPrice(account, id, now), cheapest = asks.find(a => !a.you) || asks[0];
  const step = cheapest.price < 10 ? 0.1 : 1;
  return { id, name: M.name, grade: M.grade, icon: M.icon, cat: M.cat, unit: M.unit, ref, price: cheapest.price, change24: change24(id, now), have: haveOf(account, char, id), asks, history: history(id, { now, hours: 24 }), suggest: Math.max(0.1, px(cheapest.price - step)) };
}
/** Cost of buying `qty` bundles cheapest-first (no side effects). */
export function quote(account, id, qty, now = Date.now()) {
  if (!ITEMS_MARKET[id]) return fail('unknown', 'That item is not traded.');
  const fills = []; let need = Math.max(1, qty | 0), cost = 0;
  for (const a of asksFor(account, id, now)) { if (a.you || need <= 0) continue; const q = Math.min(need, a.qty); fills.push({ key: a.key, seller: a.seller, price: a.price, qty: q }); cost += q * a.price; need -= q; }
  const got = Math.max(1, qty | 0) - need;
  return { ok: got > 0, qty: got, cost: Math.ceil(cost - 1e-9), avg: got ? cost / got : 0, fills };
}
function deliver(account, char, id, qty) {
  const M = ITEMS_MARKET[id];
  if (M.cat === 'book') { const items = Array.from({ length: qty }, () => makeBook(M.engr, 4)); return { items }; }
  if (M.cat === 'gem') { const items = Array.from({ length: qty }, () => makeGem(M.gem, M.level)); return { items }; }
  return { [id]: qty * M.unit };
}
export function buy(account, char, id, qty, { now = Date.now(), maxPrice = Infinity } = {}) {
  const M = ITEMS_MARKET[id]; if (!M) return fail('unknown', 'That item is not traded.');
  tick(account, now);
  const q = quote(account, id, qty, now);
  if (!q.ok) return fail('supply', 'Nobody is selling that right now.');
  const fills = q.fills.filter(f => f.price <= maxPrice);
  const got = fills.reduce((a, f) => a + f.qty, 0); if (!got) return fail('price', 'No listing at or below your price.');
  const spent = Math.ceil(fills.reduce((a, f) => a + f.price * f.qty, 0) - 1e-9);
  if (!pay(account, { gold: spent })) return fail('gold', 'Not enough gold.', { cost: spent });
  const m = st(account, now), b = bucket(now);
  if (m.taken[id]?.b !== b) m.taken[id] = { b, q: {} };
  for (const f of fills) m.taken[id].q[f.key] = (m.taken[id].q[f.key] || 0) + f.qty;
  addImpact(m, id, 0.5 * got / M.daily, now);
  const rows = grantBundle(account, char, deliver(account, char, id, got));
  account.save();
  const notes = emit(account, char, 'buy', { id, qty: got, gold: spent });
  return ok({ bought: got, spent, avg: spent / got, fills, rows, notes });
}

// ------------------------------------------------------------------------------------------------ your listings
export function fee(account) { return Math.max(0.01, FEE - (econMods(account).marketFee || 0)); }
function uniqueToId(it) {
  if (it.kind === 'book') return `book:${it.engr}`;
  if (it.kind === 'gem') return `gem:${it.gem}:${it.level}`;
  if (it.kind === 'accessory') return `acc:${it.slot}`;
  return null;
}
export function list(account, char, id, qty, price, { now = Date.now(), uid: itemUid } = {}) {
  const m = st(account, now); tick(account, now);
  if (m.listings.filter(l => l.status === 'active').length >= MAX_LISTINGS) return fail('limit', `You can have ${MAX_LISTINGS} listings at once.`);
  price = Number(price); if (!(price > 0)) return fail('price', 'Set a price.');
  let listing;
  if (itemUid) {
    const i = (char?.inv || []).findIndex(it => it.uid === itemUid); if (i < 0) return fail('unknown', 'That item is not in your bag.');
    const it = char.inv[i], iid = uniqueToId(it);
    if (!iid) return fail('untradable', 'That item cannot be sold on the market.');
    if (it.bound) return fail('bound', 'That item is bound.');
    char.inv.splice(i, 1);
    listing = { id: uid('ls'), itemId: iid, qty: 1, sold: 0, price: px(price), t: now, tp: now, expires: now + EXPIRY, item: it, status: 'active', proceeds: 0 };
  } else {
    const M = ITEMS_MARKET[id]; if (!M) return fail('unknown', 'That item is not traded.');
    if (M.cat === 'book' || M.cat === 'gem') return fail('uid', 'List books and gems from your bag (uid).');
    qty = Math.max(1, qty | 0);
    if (!account.take(id, qty * M.unit)) return fail('materials', `You need ${qty * M.unit} ${M.name}.`);
    listing = { id: uid('ls'), itemId: id, qty, sold: 0, price: px(price), t: now, tp: now, expires: now + EXPIRY, status: 'active', proceeds: 0 };
  }
  m.listings.push(listing); account.save();
  const notes = emit(account, char, 'sell', { id: listing.itemId, qty: listing.qty });
  return ok({ listing: listingView(listing, now), notes });
}
function listingView(l, now) {
  const M = ITEMS_MARKET[l.itemId], it = l.item;
  return { id: l.id, itemId: l.itemId, name: it?.name || M?.name || l.itemId, grade: it?.grade ?? M?.grade ?? 1, icon: it?.icon || M?.icon || iconFor(l.itemId), unit: M?.unit || 1,
    qty: l.qty, sold: l.sold, price: l.price, t: l.t, expires: l.expires, left: Math.max(0, l.expires - now), status: l.status, proceeds: l.proceeds || 0, ...(it ? { item: it } : {}) };
}
function returnGoods(l) { return l.item ? { items: [l.item] } : { [l.itemId]: l.qty * (ITEMS_MARKET[l.itemId]?.unit || 1) }; }
/** Process your listings up to `now`: sales (proceeds by mail, 5% fee) and expiries (goods back by mail). */
export function tick(account, now = Date.now()) {
  const m = st(account, now), out = [], f = fee(account);
  for (const l of m.listings) {
    if (l.status !== 'active') continue;
    const end = Math.min(now, l.expires); let soldNow = 0, gold = 0;
    const M = ITEMS_MARKET[l.itemId];
    for (let t = Math.max(l.tp, l.t) + STEP; t <= end && l.qty > 0; t += STEP) {
      const ref = l.item && l.item.kind === 'accessory' ? accessoryPrice(l.item) : price(l.itemId, t);
      const ratio = l.price / Math.max(0.1, ref * 0.99);
      const p = clamp(0.45 * Math.exp(-9 * Math.max(0, ratio - 1)) + (ratio < 0.9 ? 0.4 : 0), 0.004, 0.95);
      if (hash01(l.id, t) < p) {
        const n = l.item ? 1 : Math.max(1, Math.min(l.qty, Math.ceil(l.qty * (0.25 + 0.5 * hash01(l.id, 'q', t)) * Math.min(1, (M?.daily || 100) / 400 + 0.2))));
        l.qty -= n; l.sold += n; soldNow += n; gold += l.price * n;
        if (M) addImpact(m, l.itemId, -0.5 * n / (M.daily || 100), t);
      }
      l.tp = t;
    }
    if (soldNow) {
      const net = Math.floor(gold * (1 - f));
      l.proceeds = (l.proceeds || 0) + net;
      const name = l.item?.name || M?.name || l.itemId;
      sendMail(account, { from: 'Solhaven Market', subject: `Sold: ${name} ×${soldNow}`, kind: 'market', t: Math.min(now, l.tp), bundle: { gold: net },
        body: `Your listing of ${name} sold ${soldNow} × ${l.price} gold. After the ${Math.round(f * 100)}% market fee you receive ${net} gold.` });
      out.push({ kind: 'sold', text: `Sold ${name} ×${soldNow} for ${net} gold (after fee).`, gold: net, id: l.id });
      out.push(...emit(account, null, 'sold', { id: l.itemId, qty: soldNow, gold: net }));
    }
    if (l.qty <= 0) { l.status = 'sold'; l.done = l.tp; }
    else if (now >= l.expires) {
      l.status = 'expired'; l.done = l.expires;
      const name = l.item?.name || M?.name || l.itemId;
      sendMail(account, { from: 'Solhaven Market', subject: `Expired: ${name}`, kind: 'market', t: l.expires, bundle: returnGoods(l), body: `Your listing of ${name} expired unsold. The goods are attached.` });
      out.push({ kind: 'expired', text: `Your listing of ${name} expired — returned by mail.`, id: l.id });
      l.qty = 0;
    }
  }
  const done = m.listings.filter(l => l.status !== 'active');
  if (done.length) { m.listings = m.listings.filter(l => l.status === 'active'); m.sold = [...done, ...m.sold].slice(0, 30); }
  m.t = now;
  if (out.length || done.length) account.save();
  return out;
}
export function listings(account, now = Date.now()) {
  tick(account, now); const m = st(account, now);
  return [...m.listings, ...m.sold].map(l => listingView(l, now));
}
export function cancel(account, char, listingId, now = Date.now()) {
  tick(account, now); const m = st(account, now);
  const i = m.listings.findIndex(l => l.id === listingId && l.status === 'active');
  if (i < 0) return fail('unknown', 'No such active listing.');
  const l = m.listings[i]; m.listings.splice(i, 1);
  l.status = 'cancelled'; const back = returnGoods(l); l.qty = 0; m.sold.unshift(l); m.sold = m.sold.slice(0, 30);
  const returned = grantBundle(account, char, back);
  return ok({ returned });
}

// ------------------------------------------------------------------------------------------------ accessories
const ACC_BASE = { 3: 5, 4: 15, 5: 60, 6: 400, 7: 1500 };
/** fair gold price of an accessory by grade, engravings (demand × nodes) and quality */
export function accessoryPrice(it) {
  const dem = (it.engr || []).reduce((a, e) => a + (ENGRAVING_DEMAND[e.id] || 1) * e.v, 0);
  return Math.max(1, Math.round((ACC_BASE[it.grade] || 5) * (0.4 + dem / 40) * (0.8 + (it.quality || 0) / 250)));
}
export function accessories(account, { slot, engr, now = Date.now() } = {}) {
  const m = st(account, now), b = bucket(now);
  const r = new RNG((0xacce55 ^ Math.imul(b, 2654435761)) >>> 0), rn = new RNG((0xbeef ^ Math.imul(b, 40503)) >>> 0);
  const taken = m.accTaken.b === b ? m.accTaken.keys : [];
  const out = [];
  for (let i = 0; i < 24; i++) {
    const g = r.next() < 0.1 ? 4 : r.next() < 0.93 ? 5 : 6, s = r.pick(['necklace', 'earring', 'earring', 'ring', 'ring']);
    const item = seeded(r, () => makeAccessory(s, g));
    const key = `${b}:${i}`, seller = simName(rn);
    if (taken.includes(key)) continue;
    out.push({ key, seller, price: Math.max(1, Math.round(accessoryPrice(item) * (0.85 + r.next() * 0.4))), item, you: false });
  }
  for (const l of m.listings) if (l.status === 'active' && l.item?.kind === 'accessory') out.push({ key: l.id, seller: account.roster.name || 'You', price: l.price, item: l.item, you: true });
  return out.filter(x => (!slot || x.item.slot === slot) && (!engr || (x.item.engr || []).some(e => e.id === engr))).sort((a, c) => a.price - c.price);
}
export function buyAccessory(account, char, key, now = Date.now()) {
  const row = accessories(account, { now }).find(x => x.key === key && !x.you);
  if (!row) return fail('gone', 'That listing is gone.');
  if (!pay(account, { gold: row.price })) return fail('gold', 'Not enough gold.', { cost: row.price });
  const m = st(account, now), b = bucket(now);
  if (m.accTaken.b !== b) m.accTaken = { b, keys: [] };
  m.accTaken.keys.push(key);
  (char.inv ||= []).push(row.item); account.save();
  const notes = emit(account, char, 'buy', { id: row.item.id, qty: 1, gold: row.price });
  return ok({ item: row.item, spent: row.price, notes });
}

// ------------------------------------------------------------------------------------------------ crystal exchange
/** gold per 100 crystals: buy (what 100 crystals cost you) and sell (what selling 100 crystals pays) */
export function exchange(now = Date.now(), { hours = 168 } = {}) {
  const rate = t => { const d = t / DAY; return Math.round(900 * Math.exp(0.18 * NOISE.noise2(d / 3, 777.5) + 0.06 * NOISE.noise2(d * 4, 778.5))); };
  const hist = []; for (let t = Math.floor(now / (6 * HOUR)) * 6 * HOUR - hours * HOUR; t <= now; t += 6 * HOUR) hist.push({ t, buy: rate(t) });
  const buyR = rate(now);
  return { buy: buyR, sell: Math.floor(buyR * 0.88), history: hist };
}
export function buyCrystals(account, hundreds = 1, now = Date.now()) {
  hundreds = Math.max(1, hundreds | 0);
  const gold = exchange(now, { hours: 0 }).buy * hundreds;
  if (!pay(account, { gold })) return fail('gold', 'Not enough gold.', { cost: gold });
  account.give('crystals', 100 * hundreds);
  return ok({ crystals: 100 * hundreds, gold });
}
export function sellCrystals(account, hundreds = 1, now = Date.now()) {
  hundreds = Math.max(1, hundreds | 0);
  if (!account.take('crystals', 100 * hundreds)) return fail('crystals', 'Not enough crystals.');
  const gold = exchange(now, { hours: 0 }).sell * hundreds;
  account.give('gold', gold);
  return ok({ crystals: 100 * hundreds, gold });
}
