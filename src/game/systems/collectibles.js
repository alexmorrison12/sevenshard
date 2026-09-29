// Collectibles (Pip Seeds, Island Souls, Giant's Hearts, Masterpieces, Omnium Stars, Sea Bounties, World Tree Leaves,
// Vistas) with reward tiers, and the Adventure Tome per region (bosses, NPCs, seeds, vistas, lore, cuisine).
// State: roster.collect[type] = [ids], roster.claimed['<type>:<n>' | 'tome:<region>:<pct>'], roster.tome[region][kind] = [ids].
import { COLLECTIBLES, COLLECT_TYPES, ZONES, ZONE_NAMES, TOME, TOME_TIERS, ISLANDS, ISLAND_LIST, UNLOCK_NAMES } from '../../data/collectibles.js';
import { TITLES } from '../../data/titles.js';
import { CARDS } from '../../data/cards.js';
import { ok, fail, grantBundle, bundleRows, emit } from './common.js';

export { COLLECTIBLES, TOME, ISLANDS, ISLAND_LIST, ZONES, ZONE_NAMES };
const CATALOG = { titles: TITLES, cards: CARDS, ...UNLOCK_NAMES };
const rows = b => bundleRows(b, CATALOG);
const TOME_KINDS = ['bosses', 'npcs', 'lore', 'cuisine'];
const KIND_NAMES = { bosses: 'Bosses', npcs: 'People', seeds: 'Pip Seeds', vistas: 'Vistas', lore: 'Lore', cuisine: 'Cuisine' };

function st(account) {
  const r = account.roster;
  r.collect ||= {}; for (const t of COLLECT_TYPES) if (!Array.isArray(r.collect[t])) r.collect[t] = [];
  r.claimed ||= {}; r.tome ||= {};
  return r;
}
const byId = {}; for (const t of COLLECT_TYPES) for (const it of COLLECTIBLES[t].items) byId[it.id] = { ...it, type: t };
export const find = id => byId[id] || null;

function ready(r, type) { const have = r.collect[type].length; return COLLECTIBLES[type].tiers.filter(t => t.n <= have && !r.claimed[`${type}:${t.n}`]).map(t => t.n); }
/** Record a found collectible (also feeds the Adventure Tome for seeds & vistas). */
export function collect(account, char, type, id) {
  const r = st(account), C = COLLECTIBLES[type];
  if (!C) return fail('type', 'Unknown collectible type.');
  const it = C.items.find(x => x.id === id); if (!it) return fail('unknown', 'Unknown collectible.');
  const list = r.collect[type], isNew = !list.includes(id);
  let zoneDone = null;
  if (isNew) {
    list.push(id);
    if (type === 'seeds') { const zone = it.zone; if (C.items.filter(x => x.zone === zone).every(x => list.includes(x.id))) zoneDone = zone; }
    account.save();
  }
  const notes = isNew ? emit(account, char, 'collect', { type, id, have: list.length, total: C.items.length, zoneDone }) : [];
  if (isNew && (type === 'seeds' || type === 'vistas')) { const reg = regionOf(it.zone); if (reg) notes.push(...emit(account, char, 'tome', { region: reg, pct: tomePct(account, reg) })); }
  return ok({ isNew, type, id, name: it.name, have: list.length, total: C.items.length, ready: ready(r, type), zoneDone, notes });
}
export function claim(account, char, type, n) {
  const r = st(account), C = COLLECTIBLES[type]; if (!C) return fail('type', 'Unknown collectible type.');
  const tier = C.tiers.find(t => t.n === n); if (!tier) return fail('tier', 'No reward at that count.');
  if (r.claimed[`${type}:${n}`]) return fail('claimed', 'Already claimed.');
  if (r.collect[type].length < n) return fail('progress', `Collect ${n} first.`);
  r.claimed[`${type}:${n}`] = true;
  return ok({ rows: grantBundle(account, char, tier.bundle).map(x => ({ ...x, ...(nameOf(x) || {}) })) });
}
function nameOf(row) { const [list, id] = String(row.id).split(':'); const c = CATALOG[list]?.[id]; return c ? { name: c.name, grade: c.grade ?? row.grade } : null; }

// ------------------------------------------------------------------------------------------------ adventure tome
const regionOf = zone => Object.keys(TOME).find(k => TOME[k].zone === zone) || null;
function tomeSections(account, region) {
  const r = st(account), T = TOME[region], rec = r.tome[region] ||= {};
  const secs = TOME_KINDS.filter(k => T[k].length).map(k => ({ kind: k, name: KIND_NAMES[k], entries: T[k].map(e => ({ id: e.id, name: e.name, found: (rec[k] || []).includes(e.id), hint: e.hint || '' })) }));
  const seeds = COLLECTIBLES.seeds.items.filter(s => s.zone === T.zone), vistas = COLLECTIBLES.vistas.items.filter(v => v.zone === T.zone);
  if (seeds.length) secs.splice(2, 0, { kind: 'seeds', name: KIND_NAMES.seeds, entries: seeds.map(s => ({ id: s.id, name: s.name, found: r.collect.seeds.includes(s.id), hint: s.hint })) });
  if (vistas.length) secs.splice(3, 0, { kind: 'vistas', name: KIND_NAMES.vistas, entries: vistas.map(v => ({ id: v.id, name: v.name, found: r.collect.vistas.includes(v.id), hint: v.hint })) });
  for (const s of secs) { s.have = s.entries.filter(e => e.found).length; s.total = s.entries.length; }
  return secs;
}
export function tomePct(account, region) { const secs = tomeSections(account, region); const t = secs.reduce((a, s) => a + s.total, 0); return t ? secs.reduce((a, s) => a + s.have, 0) / t : 0; }
export function tomeRecord(account, region, kind, id, char = null) {
  const r = st(account), T = TOME[region]; if (!T) return fail('region', 'Unknown region.');
  if (!TOME_KINDS.includes(kind)) return fail('kind', 'Seeds and vistas are recorded by collect().');
  if (!T[kind].some(e => e.id === id)) return fail('unknown', 'Not in this region’s tome.');
  const rec = r.tome[region] ||= {}, list = rec[kind] ||= [];
  const isNew = !list.includes(id);
  if (isNew) { list.push(id); account.save(); }
  const pct = tomePct(account, region);
  const notes = isNew ? emit(account, char, 'tome', { region, kind, id, pct }) : [];
  return ok({ isNew, pct, notes });
}
export function tomeClaim(account, char, region, pct) {
  const r = st(account); if (!TOME[region]) return fail('region', 'Unknown region.');
  const tier = TOME_TIERS.find(t => Math.abs(t.pct - pct) < 1e-9); if (!tier) return fail('tier', 'No reward at that completion.');
  if (r.claimed[`tome:${region}:${tier.pct}`]) return fail('claimed', 'Already claimed.');
  if (tomePct(account, region) + 1e-9 < tier.pct) return fail('progress', `Complete ${Math.round(tier.pct * 100)}% of the tome first.`);
  r.claimed[`tome:${region}:${tier.pct}`] = true;
  return ok({ rows: grantBundle(account, char, tier.bundle) });
}

// ------------------------------------------------------------------------------------------------ views
export function zoneList(zone) { return Object.values(byId).filter(x => x.zone === zone).map(x => ({ id: x.id, type: x.type, name: x.name, hint: x.hint })); }
export function view(account) {
  const r = st(account);
  const types = COLLECT_TYPES.map(t => {
    const C = COLLECTIBLES[t], have = r.collect[t].length;
    const tiers = C.tiers.map(x => ({ n: x.n, rows: rows(x.bundle), claimed: !!r.claimed[`${t}:${x.n}`], ready: x.n <= have && !r.claimed[`${t}:${x.n}`] }));
    const nx = C.tiers.find(x => x.n > have);
    return { id: t, name: C.name, icon: C.icon, have, total: C.items.length, pct: have / C.items.length, tiers, next: nx ? { n: nx.n, rows: rows(nx.bundle) } : null,
      items: C.items.map(it => ({ id: it.id, name: it.name, zone: it.zone, hint: it.hint, source: it.source, found: r.collect[t].includes(it.id) })) };
  });
  const tome = Object.keys(TOME).map(id => {
    const sections = tomeSections(account, id), pct = tomePct(account, id);
    return { id, name: TOME[id].name, pct, sections, rewards: TOME_TIERS.map(t => ({ pct: t.pct, rows: rows(t.bundle), claimed: !!r.claimed[`tome:${id}:${t.pct}`], ready: pct + 1e-9 >= t.pct && !r.claimed[`tome:${id}:${t.pct}`] })) };
  });
  const seedsByZone = Object.fromEntries(ZONES.map(z => { const all = COLLECTIBLES.seeds.items.filter(s => s.zone === z); return [z, { name: ZONE_NAMES[z], have: all.filter(s => r.collect.seeds.includes(s.id)).length, total: all.length }]; }));
  return { types, tome, seedsByZone };
}
