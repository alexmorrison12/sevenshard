// Vendors: prices in one currency each, daily / weekly / total purchase limits, requirements, and special entries
// (Horned Tyrant transfer at the raid vendor, unlocks, cards, collectibles, trade tools). State: roster.shops.
import { SHOPS, SHOP_UNLOCKS } from '../../data/shops.js';
import { UNLOCK_NAMES } from '../../data/collectibles.js';
import { CARDS } from '../../data/cards.js';
import { TOOLS, TOOL_NAMES, TOOL_PRICES } from '../../data/lifeskills.js';
import { SLOT_NAMES } from '../../data/items.js';
import { transferPreview, transfer } from './honing.js';
import { collect } from './collectibles.js';
import { buyTool } from './lifeskills.js';
import { econMods } from './mods.js';
import { ok, fail, pay, grantBundle, bundleRows, itemInfo, CURRENCIES, emit } from './common.js';
import { dayId, weekId } from '../../core/util.js';

export { SHOPS };
const CATALOG = { cards: CARDS, mounts: { ...UNLOCK_NAMES.mounts, ...SHOP_UNLOCKS.mounts }, pets: UNLOCK_NAMES.pets, emotes: { ...UNLOCK_NAMES.emotes, ...SHOP_UNLOCKS.emotes }, unlocks: { ...UNLOCK_NAMES.unlocks, ...SHOP_UNLOCKS.unlocks } };
function st(account, now = Date.now()) {
  const r = account.roster, s = r.shops ||= {};
  const d = dayId(now), w = weekId(now);
  if (s.day !== d) { s.day = d; s.daily = {}; }
  if (s.week !== w) { s.week = w; s.weekly = {}; }
  s.daily ||= {}; s.weekly ||= {}; s.total ||= {};
  return s;
}
export function list() { return Object.entries(SHOPS).map(([id, S]) => ({ id, name: S.name, npc: S.npc, currency: S.currency })); }
function bought(s, shopId, e) { const k = `${shopId}:${e.key}`; if (!e.limit) return 0; return (e.limit[0] === 'daily' ? s.daily : e.limit[0] === 'weekly' ? s.weekly : s.total)[k] || 0; }
function priceOf(account, S, e) { const d = S.guild ? econMods(account).shopDiscount || 0 : 0; return Math.max(1, Math.round(e.price[1] * (1 - d))); }
function entryInfo(e) {
  if (e.kind === 'unlock') { const [list, ...rest] = e.unlock.split(':'); const id = rest.join(':'); return { id: e.unlock, name: e.name || CATALOG[list]?.[id]?.name || id, grade: e.grade ?? 4, icon: list === 'mounts' ? 'item:mount_whistle' : list === 'pets' ? 'item:pet_charm' : list === 'emotes' ? 'ui:emotes' : 'ui:wardrobe', kind: 'unlock', desc: '' }; }
  if (e.kind === 'card') { const c = CARDS[e.card]; return { id: `card:${e.card}`, name: `Card: ${c?.name || e.card}`, grade: c?.grade ?? 3, icon: `card:${e.card}`, kind: 'card', desc: c?.flavor || '' }; }
  if (e.kind === 'collect') return { id: e.collect[1], name: e.name, grade: e.grade ?? 4, icon: `item:${e.collect[0] === 'masterpieces' ? 'masterpiece' : 'omnium_star'}`, kind: 'collectible', desc: 'Adds to your collection.' };
  if (e.kind === 'transfer') return { id: `transfer:${e.slot}`, name: `Horned Tyrant ${SLOT_NAMES[e.slot]} (reforge)`, grade: 5, icon: e.slot === 'weapon' ? 'item:weapon:reaver:t2' : `item:${e.slot}:t2`, kind: 'transfer', desc: 'Reforges your equipped Vanguard piece (+12 or higher) into Horned Tyrant gear at half its honing level.' };
  if (e.kind === 'tool') { const [sk, t] = e.tool; return { id: `tool:${sk}:${t}`, name: `${TOOLS[t].name} ${TOOL_NAMES[sk]}`, grade: t + 1, icon: 'item:scroll', kind: 'tool', desc: `Yield +${Math.round(TOOLS[t].yield * 100)}%, rare finds ×${TOOLS[t].rare}, ${TOOLS[t].dur} uses.` }; }
  const i = itemInfo(e.id); return { id: e.id, name: e.qty > 1 ? `${i.name} ×${e.qty}` : i.name, grade: i.grade, icon: i.icon, kind: i.kind, desc: i.desc };
}
function check(account, char, S, shopId, e, n, s) {
  const req = e.req || {};
  if (S.guild && !account.roster.guild) return 'Join a guild to trade here.';
  if (req.guildLevel && (account.roster.guild?.level || 0) < req.guildLevel) return `Requires guild level ${req.guildLevel}.`;
  if (req.ilvl && (char?.ilvl || 0) < req.ilvl) return `Requires item level ${req.ilvl}.`;
  if (e.limit && bought(s, shopId, e) + n > e.limit[1]) return e.limit[0] === 'total' ? 'Already purchased.' : `Limit reached (${e.limit[1]} ${e.limit[0]}).`;
  if (e.kind === 'unlock') { const [list, ...rest] = e.unlock.split(':'); const id = rest.join(':'); const have = list === 'unlocks' ? account.roster.unlocked?.[id] : account.roster[list]?.includes(id); if (have) return 'Already owned.'; }
  if (e.kind === 'transfer') { if (!char) return 'Select a character.'; const p = transferPreview(account, char, e.slot); if (!p.ok) return p.msg; }
  if (!account.has(e.price[0], priceOf(account, S, e) * n)) return `Not enough ${CURRENCIES[e.price[0]]?.name || itemInfo(e.price[0]).name}.`;
  return null;
}
export function view(account, char, shopId, now = Date.now()) {
  const S = SHOPS[shopId]; if (!S) return null;
  const s = st(account, now), curs = new Set([S.currency, ...S.items.map(e => e.price[0])]);
  return {
    id: shopId, name: S.name, npc: S.npc, desc: S.desc, currency: S.currency,
    currencies: Object.fromEntries([...curs].map(c => [c, account.count(c)])),
    items: S.items.map(e => {
      const info = entryInfo(e), why = check(account, char, S, shopId, e, 1, s);
      const tp = e.kind === 'transfer' && char ? transferPreview(account, char, e.slot) : null;
      return { key: e.key, ...info, qty: e.qty, price: { currency: e.price[0], amount: priceOf(account, S, e) }, ...(tp ? { cost: tp.cost, costRows: tp.costRows } : {}),
        limit: e.limit ? { period: e.limit[0], max: e.limit[1], left: Math.max(0, e.limit[1] - bought(s, shopId, e)) } : null, can: !why, why, ...(e.req ? { req: e.req } : {}), ...(e.bound ? { bound: true } : {}) };
    }),
  };
}
export function buy(account, char, shopId, key, n = 1, now = Date.now()) {
  const S = SHOPS[shopId]; if (!S) return fail('unknown', 'No such shop.');
  const e = S.items.find(x => x.key === key); if (!e) return fail('unknown', 'Not sold here.');
  n = Math.max(1, n | 0); if (e.kind && e.kind !== 'item') n = 1;
  const s = st(account, now), why = check(account, char, S, shopId, e, n, s);
  if (why) return fail(/Limit|purchased/.test(why) ? 'limit' : /Not enough/.test(why) ? 'materials' : 'locked', why);
  let rows = [];
  if (e.kind === 'transfer') {
    const r = transfer(account, char, e.slot); if (!r.ok) return r;
    rows = [{ id: r.item.id, uid: r.item.uid, name: r.item.name, count: 1, grade: r.item.grade, icon: r.item.icon, kind: r.item.kind, item: r.item }];
    const spent = r.cost; count(s, shopId, e, 1); account.save();
    return ok({ rows, spent, left: e.limit ? e.limit[1] - bought(s, shopId, e) : null });
  }
  const amount = priceOf(account, S, e) * n, spent = { [e.price[0]]: amount };
  if (e.kind === 'tool') { const r = buyTool(account, e.tool[0], e.tool[1]); if (!r.ok) return r; count(s, shopId, e, 1); account.save(); return ok({ rows: [{ id: `tool:${e.tool.join(':')}`, name: r.tool.name, count: 1, grade: e.tool[1] + 1, icon: 'item:scroll', kind: 'tool' }], spent: { silver: TOOL_PRICES[e.tool[1]] }, left: null }); }
  if (!pay(account, spent)) return fail('materials', 'Not enough currency.');
  if (e.kind === 'unlock') { const [list, ...rest] = e.unlock.split(':'); rows = grantBundle(account, char, { [list]: [rest.join(':')] }).map(r => ({ ...r, name: entryInfo(e).name })); }
  else if (e.kind === 'card') rows = grantBundle(account, char, { cards: { [e.card]: 1 } }).map(r => ({ ...r, name: entryInfo(e).name }));
  else if (e.kind === 'collect') { const c = collect(account, char, e.collect[0], e.collect[1]); rows = [{ id: e.collect[1], name: c.name || e.name, count: 1, grade: e.grade ?? 4, icon: entryInfo(e).icon, kind: 'collectible' }]; }
  else rows = grantBundle(account, char, { [e.id]: e.qty * n });
  count(s, shopId, e, n); account.save();
  const notes = emit(account, char, 'shop', { shop: shopId, key, n });
  return ok({ rows, spent, left: e.limit ? e.limit[1] - bought(s, shopId, e) : null, notes });
}
function count(s, shopId, e, n) { if (!e.limit) return; const k = `${shopId}:${e.key}`, bag = e.limit[0] === 'daily' ? s.daily : e.limit[0] === 'weekly' ? s.weekly : s.total; bag[k] = (bag[k] || 0) + n; }
