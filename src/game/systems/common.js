// Shared helpers for the progression & economy layer (src/game/systems/*): RNG normalisation, deterministic wrappers
// around gear.js factories, result objects, reward bundles (grant + display rows), costs, lazy state, time, and the
// tiny event hub that routes system actions (hone, facet, trade, craft…) into tasks/titles/guild tracking.
// Pure logic: no DOM, no three.js.
import { RNG, hashStr } from '../../core/noise.js';
import { ITEMS, SILVER_PER_GOLD } from '../../data/items.js';
import { ENGRAVINGS } from '../../data/engravings.js';
import { CARDS, cardIcon } from '../../data/cards.js';

export const SEC = 1000, MIN = 60e3, HOUR = 3600e3, DAY = 86400e3;
export { SILVER_PER_GOLD };

/** Wallet currencies (account.roster.wallet keys) with display info. */
export const CURRENCIES = {
  silver: { name: 'Silver', icon: 'currency:silver', grade: 1 },
  gold: { name: 'Gold', icon: 'currency:gold', grade: 4 },
  crystals: { name: 'Crystals', icon: 'currency:crystal', grade: 3 },
  royal: { name: 'Royal Crystals', icon: 'currency:royal', grade: 5 },
  shards: { name: 'Sunshards', icon: 'currency:shards', grade: 2 },
  pirate: { name: 'Pirate Coins', icon: 'currency:pirate', grade: 2 },
  bloodstone: { name: 'Bloodstones', icon: 'currency:bloodstone', grade: 3 },
  pvp: { name: 'Proving Tokens', icon: 'currency:pvp', grade: 3 },
  tokens: { name: 'Glass Sea Tokens', icon: 'currency:token', grade: 3 },
};
export const isCurrency = id => !!CURRENCIES[id];

// ------------------------------------------------------------------------------------------------ RNG
function wrapFn(f) {
  const o = {
    next: () => f(),
    range: (a, b) => a + (b - a) * f(),
    int: (a, b) => Math.floor(a + (b + 1 - a) * f()),
    pick: arr => arr[Math.floor(f() * arr.length)],
    chance: p => f() < p,
    weighted(items, k = 'w') { let t = 0; for (const it of items) t += it[k]; let r = f() * t; for (const it of items) { r -= it[k]; if (r <= 0) return it; } return items[items.length - 1]; },
    shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
  };
  return o;
}
/**
 * Normalise an rng argument: an RNG instance (src/core/noise.js), any object with next(), a () => [0,1) function,
 * a numeric/string seed, or nothing (Math.random). Returns an object with next/range/int/pick/chance/weighted/shuffle.
 */
export function rngOf(r) {
  if (r && typeof r.next === 'function') return r.int && r.pick && r.weighted ? r : wrapFn(() => r.next());
  if (typeof r === 'function') return wrapFn(r);
  if (typeof r === 'number' || typeof r === 'string') return new RNG(r);
  return wrapFn(Math.random);
}
/** Run fn with Math.random temporarily driven by rng, so gear.js factories (makeAccessory, makeStone…) are deterministic. */
export function seeded(rng, fn) {
  if (rng == null) return fn();
  const r = rngOf(rng), orig = Math.random;
  Math.random = () => r.next();
  try { return fn(); } finally { Math.random = orig; }
}
/** Deterministic [0,1) from any key parts (stable across sessions). */
export function hash01(...parts) { return hashStr(parts.join('|')) / 4294967296; }
/** Stable per-roster seed (for daily offers, AI guilds, SimPlayer listings…). */
export function rosterSeed(account) { const d = account.data || {}; return hashStr(`${d.created || 0}:${d.roster?.name || ''}`); }

// ------------------------------------------------------------------------------------------------ results
export const ok = (o = {}) => ({ ok: true, ...o });
export const fail = (why, msg, o = {}) => ({ ok: false, why, msg: msg || why, ...o });

// ------------------------------------------------------------------------------------------------ item display
const pretty = s => String(s).replace(/[_:]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
export function iconFor(id) {
  const t = ITEMS[id];
  if (t?.icon) return t.icon;
  let m;
  if ((m = /^food(\d)$/.exec(id))) return `item:food:${m[1]}`;
  if ((m = /^gift(\d)$/.exec(id))) return `item:gift:${m[1]}`;
  if (CURRENCIES[id]) return CURRENCIES[id].icon;
  if ((m = /^book:(.+)$/.exec(id))) return `item:book:${m[1]}`;
  if ((m = /^gem:(ruin|swift):(\d+)$/.exec(id))) return `item:gem:${m[1]}:${m[2]}`;
  if (id === 'gem_pouch') return 'item:chest';
  return `item:${id}`;
}
/**
 * Display info for any reward/market id: currency, ITEMS id, 'book:<engr>', 'gem:<type>:<lv>', 'card:<id>'.
 * → { id, name, grade, icon, kind, desc, value, tradable, bound }
 */
export function itemInfo(id) {
  if (CURRENCIES[id]) return { id, ...CURRENCIES[id], kind: 'currency', desc: '', value: 0, tradable: false, bound: null };
  const t = ITEMS[id];
  if (t) return { id, name: t.name, grade: t.grade ?? 1, icon: iconFor(id), kind: t.kind, desc: t.desc || '', value: t.value || 0, tradable: !!t.tradable, bound: t.bound || null };
  let m;
  if ((m = /^book:(.+)$/.exec(id))) return { id, name: `${ENGRAVINGS[m[1]]?.name || pretty(m[1])} Engraving Recipe`, grade: 4, icon: iconFor(id), kind: 'book', desc: 'Read to learn engraving nodes.', value: 0, tradable: true, bound: null };
  if ((m = /^gem:(ruin|swift):(\d+)$/.exec(id))) return { id, name: `Lv.${m[2]} ${m[1] === 'ruin' ? 'Ruinstone' : 'Swiftstone'}`, grade: Math.min(7, 2 + Math.floor(+m[2] / 2)), icon: iconFor(id), kind: 'gem', desc: '', value: 0, tradable: true, bound: null };
  if ((m = /^card:(.+)$/.exec(id))) return { id, name: CARDS[m[1]]?.name || pretty(m[1]), grade: CARDS[m[1]]?.grade ?? 3, icon: cardIcon(m[1]), kind: 'card', desc: CARDS[m[1]]?.flavor || '', value: 0, tradable: false, bound: 'roster' };
  return { id, name: pretty(id), grade: 1, icon: `item:${id}`, kind: 'material', desc: '', value: 0, tradable: false, bound: null };
}

// ------------------------------------------------------------------------------------------------ bundles
// A reward bundle is a plain object: { <currency|ITEMS id>: count, items?: [Item], cards?: { cardId: n }, xp?, rosterXp?,
// skillPts?, titles?: [id], mounts?: [id], pets?: [id], emotes?: [id], songs?: [id], unlocks?: [id] }.
const LISTS = ['titles', 'mounts', 'pets', 'emotes', 'songs', 'unlocks'];
export function addTo(b, id, n) { if (!n) return b; b[id] = (b[id] || 0) + n; return b; }
/** merge bundle `b` into `into` (in place) and return `into` */
export function merge(into, b) {
  for (const [k, v] of Object.entries(b || {})) {
    if (v == null) continue;
    if (k === 'items') (into.items ||= []).push(...v);
    else if (k === 'cards') { into.cards ||= {}; for (const [c, n] of Object.entries(v)) into.cards[c] = (into.cards[c] || 0) + n; }
    else if (Array.isArray(v)) { into[k] ||= []; for (const x of v) if (!into[k].includes(x)) into[k].push(x); }
    else if (typeof v === 'number') into[k] = (into[k] || 0) + v;
  }
  return into;
}
/** numeric parts × m (rounded); lists/items/cards are copied once */
export function scale(b, m, round = true) {
  const o = {};
  for (const [k, v] of Object.entries(b || {})) {
    if (typeof v === 'number') o[k] = round ? Math.round(v * m) : v * m;
    else if (k === 'items') o.items = v.slice();
    else if (k === 'cards') o.cards = { ...v };
    else if (Array.isArray(v)) o[k] = v.slice();
  }
  return o;
}
export const isEmpty = b => !b || !Object.keys(b).some(k => (typeof b[k] === 'number' ? b[k] > 0 : Array.isArray(b[k]) ? b[k].length : k === 'cards' ? Object.keys(b[k]).length : false));

/** Card collection state helper (shared by cards.js and bundle grants): roster.cards[id] = { n: duplicates, awaken }. */
export function addCardRaw(account, id, n = 1) {
  const r = account.roster; r.cards ||= {};
  let isNew = false;
  if (!r.cards[id]) { r.cards[id] = { n: 0, awaken: 0, t: Date.now() }; isNew = true; n -= 1; }
  r.cards[id].n += Math.max(0, n);
  return { id, isNew, n: r.cards[id].n, awaken: r.cards[id].awaken };
}
/** Unlock helper for roster lists (titles, mounts, pets, emotes, songs) and roster.unlocked flags. */
export function unlock(account, list, id) {
  const r = account.roster;
  if (list === 'unlocks') { r.unlocked ||= {}; const had = !!r.unlocked[id]; r.unlocked[id] = true; return !had; }
  r[list] ||= [];
  if (r[list].includes(id)) return false;
  r[list].push(id); return true;
}

/**
 * Grant a bundle to the roster (+ a character for xp, skill points and unique items; unique items go to roster.bank
 * when no character is given). Returns display rows (see bundleRows).
 */
export function grantBundle(account, char, b) {
  if (!b) return [];
  const r = account.roster;
  for (const [k, v] of Object.entries(b)) {
    if (v == null) continue;
    if (k === 'items') { for (const it of v) { if (char) account.addItem(char, it); else if (ITEMS[it.id] && !it.uid) account.give(it.id, it.count || 1); else (r.bank ||= []).push(it); } }
    else if (k === 'xp') { if (char) account.addXp(char, v); }
    else if (k === 'rosterXp') account.addRosterXp(v);
    else if (k === 'cards') for (const [id, n] of Object.entries(v)) addCardRaw(account, id, n);
    else if (k === 'skillPts') { if (char) { char.bonusPts = (char.bonusPts || 0) + v; char.skillPts = (char.skillPts || 0) + v; } }
    else if (LISTS.includes(k)) for (const id of v) unlock(account, k, id);
    else if (typeof v === 'number' && v > 0) account.give(k, Math.round(v));
  }
  account.save();
  return bundleRows(b);
}

const UNLOCK_NAMES = { titles: 'Title', mounts: 'Mount', pets: 'Pet', emotes: 'Emote', songs: 'Song', unlocks: 'Unlock' };
/**
 * Display rows for a bundle: [{ id, name, count, grade, icon, kind, uid?, item?, unlock? }] — currencies first, then
 * materials by grade, then unique items, cards and unlocks. `catalog` lets callers name cards/titles (id → { name, grade }).
 */
export function bundleRows(b, catalog = {}) {
  const rows = [];
  if (!b) return rows;
  const cur = [], mats = [];
  for (const [k, v] of Object.entries(b)) {
    if (typeof v !== 'number' || !v) continue;
    if (k === 'xp') { rows.push({ id: 'xp', name: 'Experience', count: v, grade: 2, icon: 'ui:character', kind: 'xp' }); continue; }
    if (k === 'rosterXp') { rows.push({ id: 'rosterXp', name: 'Roster Experience', count: v, grade: 3, icon: 'ui:character', kind: 'xp' }); continue; }
    if (k === 'skillPts') { rows.push({ id: 'skillPts', name: 'Skill Points', count: v, grade: 4, icon: 'item:skill_potion', kind: 'skill' }); continue; }
    const inf = itemInfo(k);
    (CURRENCIES[k] ? cur : mats).push({ id: k, name: inf.name, count: v, grade: inf.grade, icon: inf.icon, kind: inf.kind });
  }
  const order = Object.keys(CURRENCIES);
  cur.sort((a, c) => order.indexOf(a.id) - order.indexOf(c.id));
  mats.sort((a, c) => c.grade - a.grade || a.name.localeCompare(c.name));
  rows.unshift(...cur); rows.push(...mats);
  for (const it of b.items || []) rows.push({ id: it.id, uid: it.uid, name: it.name || itemInfo(it.id).name, count: it.count || 1, grade: it.grade ?? itemInfo(it.id).grade, icon: it.icon || iconFor(it.id), kind: it.kind || itemInfo(it.id).kind, item: it });
  for (const [id, n] of Object.entries(b.cards || {})) { const c = CARDS[id]; rows.push({ id: `card:${id}`, name: c?.name || itemInfo(`card:${id}`).name, count: n, grade: c?.grade ?? 3, icon: cardIcon(id), kind: 'card' }); }
  for (const k of LISTS) for (const id of b[k] || []) { const c = catalog[k]?.[id]; rows.push({ id: `${k}:${id}`, name: c?.name || pretty(id), count: 1, grade: c?.grade ?? 4, icon: k === 'mounts' ? 'item:mount_whistle' : k === 'pets' ? 'item:pet_charm' : 'ui:' + (k === 'titles' ? 'character' : k === 'songs' ? 'songs' : k === 'emotes' ? 'emotes' : 'wardrobe'), kind: k.replace(/s$/, ''), unlock: UNLOCK_NAMES[k] }); }
  return rows;
}

// ------------------------------------------------------------------------------------------------ costs
/** { id: shortfall } for every part of `cost` the account cannot pay (empty object when affordable) */
export function missing(account, cost) {
  const m = {};
  for (const [k, v] of Object.entries(cost || {})) if (v > 0 && !account.has(k, v)) m[k] = v - account.count(k);
  return m;
}
export const canPay = (account, cost) => !Object.keys(missing(account, cost)).length;
/** Pay a cost atomically (nothing is taken unless everything is affordable). */
export function pay(account, cost) {
  if (!canPay(account, cost)) return false;
  for (const [k, v] of Object.entries(cost || {})) if (v > 0) account.take(k, v);
  return true;
}
export function costRows(cost) { return bundleRows(Object.fromEntries(Object.entries(cost || {}).filter(([, v]) => v > 0))); }
/** multiply parts of a cost: mul = { silver: 0.9, ... } (ceil, never below 1 for non-zero parts) */
export function discount(cost, mul = {}) {
  const o = {};
  for (const [k, v] of Object.entries(cost || {})) { const m = mul[k] ?? mul['*'] ?? 1; o[k] = v > 0 ? Math.max(1, Math.ceil(v * m)) : v; }
  return o;
}

// ------------------------------------------------------------------------------------------------ lazy state
/** obj[key] ??= init() */
export function sub(obj, key, init) { if (obj[key] == null || typeof obj[key] !== 'object') obj[key] = typeof init === 'function' ? init() : init; return obj[key]; }
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const round1 = v => Math.round(v * 10) / 10;
export const round2 = v => Math.round(v * 100) / 100;

// ------------------------------------------------------------------------------------------------ event hub
// System actions (hone, facet, market trades, crafting, songs…) emit events here; tasks.js registers `track`, which
// fans out to Wayfarer's Tasks, weekly tasks, guild missions and titles/achievements. The game's own event bus calls
// tasks.track() directly for world events (kill, clear, sail…).
const handlers = [];
export function onTrack(fn) { if (!handlers.includes(fn)) handlers.push(fn); }
/** → notifications [{ kind, text, … }] produced by the handlers */
export function emit(account, char, event, data = {}) {
  const out = [];
  for (const h of handlers) { try { const r = h(account, char, event, data); if (Array.isArray(r)) out.push(...r); } catch (e) { if (typeof console !== 'undefined') console.error('[systems] track', event, e); } }
  return out;
}
