// Reward rolls for every content source: chaos dungeons (tiers 1–4, daily resonance, rest bonus ×2), guardian hunts,
// the abyssal dungeon (weekly first clears), legion raid gates (weekly gate gold, More Rewards chest), field mobs,
// world events (field boss, chaos gate, Adventure Island, ghost ship, treasure), Inferno Descent floors.
// Each function rolls, grants (unless grant: false) and returns a LootResult (see README).
import { CHAOS_LOOT, GUARDIAN_LOOT, ABYSS_LOOT, RAID_LOOT, FIELD_LOOT, ISLAND_LOOT, infernoFloorLoot, INFERNO_FLOORS, CHAOS_RESONANCE_RUNS, GUARDIAN_RESONANCE_RUNS, REST_COST } from '../../data/loot.js';
import { CARDS } from '../../data/cards.js';
import { ISLANDS } from '../../data/collectibles.js';
import { rollTable, isGenerator } from './rolls.js';
import { econMods } from './mods.js';
import { collect } from './collectibles.js';
import { ok, fail, grantBundle, bundleRows, rngOf, itemInfo, CURRENCIES, pay, HOUR, DAY } from './common.js';
import { weekId } from '../../core/util.js';
export { simulateEconomy } from './economy.js';

const HONING_MATS = ['guardian_stone', 'destruction_stone', 'leapstone', 'fusion', 'shards', 'horn_shard', 'solar_grace', 'solar_blessing', 'solar_protection'];
function mulBy(account, { mats = 1, leap = 1 } = {}) {
  const e = econMods(account), m = { silver: 1 + (e.silverGain || 0) };
  for (const id of HONING_MATS) m[id] = mats;
  m.leapstone = mats * leap;
  return m;
}
function daily(char) { char.daily ||= { chaos: 0, guardian: 0, tasks: 0 }; char.rest ||= { chaos: 0, guardian: 0 }; return char.daily; }
/** per-character weekly sub-state (self-stamped with the week id) */
function wk(char, key, now) { char.weekly ||= {}; const w = weekId(now); let s = char.weekly[key]; if (!s || s.week !== w) s = char.weekly[key] = { week: w }; return s; }
function finish(account, char, grant, o) {
  const b = o.bundle || {};
  for (const k of Object.keys(b)) if (typeof b[k] === 'number' && b[k] <= 0) delete b[k];
  const rows = grant ? grantBundle(account, char, b) : bundleRows(b, { cards: CARDS });
  const currencies = {}; for (const k of Object.keys(CURRENCIES)) if (b[k]) currencies[k] = b[k];
  if (grant) account.save();
  return ok({ source: o.source, title: o.title, rows: rows.map(r => r.kind === 'card' ? { ...r, name: CARDS[r.id.slice(5)]?.name || r.name, grade: CARDS[r.id.slice(5)]?.grade ?? r.grade } : r), bundle: b, currencies,
    resonance: !!o.resonance, rested: !!o.rested, first: !!o.first, gold: b.gold || 0, notes: o.notes || [], ...(o.more ? { more: o.more } : {}) });
}
const none = (source, title, notes) => ok({ source, title, rows: [], bundle: {}, currencies: {}, resonance: false, rested: false, first: false, gold: 0, notes });

// ------------------------------------------------------------------------------------------------ chaos & guardians
export function restInfo(char) {
  const d = daily(char), r = char.rest;
  return {
    chaos: { rest: r.chaos || 0, rested: (r.chaos || 0) >= REST_COST, resonanceLeft: Math.max(0, CHAOS_RESONANCE_RUNS - (d.chaos || 0)) },
    guardian: { rest: r.guardian || 0, rested: (r.guardian || 0) >= REST_COST, resonanceLeft: Math.max(0, GUARDIAN_RESONANCE_RUNS - (d.guardian || 0)) },
  };
}
function dailyRun(account, char, kind, L, { cleared = true, rng, grant = true }, extraMul = {}) {
  const source = `${kind}:${kind === 'chaos' ? L.id.split(':')[1] : L.id}`;
  if (!cleared) return none(source, L.name, ['No rewards for an unfinished run.']);
  if (typeof account.resets === 'function') account.resets();
  const d = daily(char), rest = char.rest, runs = kind === 'chaos' ? CHAOS_RESONANCE_RUNS : GUARDIAN_RESONANCE_RUNS;
  const r = rngOf(rng), m = mulBy(account, extraMul);
  const resonance = (d[kind] || 0) < runs, rested = resonance && (rest[kind] || 0) >= REST_COST;
  const b = rollTable(L.base, r, { mulBy: m });
  const notes = [];
  if (resonance) {
    rollTable(L.resonance, r, { into: b, mul: rested ? 2 : 1, mulBy: m });
    rollTable(L.extras, r, { into: b, times: rested ? 2 : 1 });
    notes.push(rested ? 'Resonance Chest — Rest bonus ×2' : 'Resonance Chest');
  } else notes.push('Daily resonance used — base rewards only');
  d[kind] = (d[kind] || 0) + 1;
  if (rested) rest[kind] = Math.max(0, rest[kind] - REST_COST);
  return finish(account, char, grant, { source, title: L.name, bundle: b, resonance, rested, notes });
}
export function chaosReward(account, char, { tier = 1, ...o } = {}) {
  const L = CHAOS_LOOT[tier]; if (!L) return fail('unknown', 'Unknown chaos dungeon tier.');
  return dailyRun(account, char, 'chaos', L, o, { mats: 1 + (econMods(account).chaosLoot || 0) });
}
export function guardianReward(account, char, { guardian = 'rimewing', ...o } = {}) {
  const L = GUARDIAN_LOOT[guardian]; if (!L) return fail('unknown', 'Unknown guardian.');
  return dailyRun(account, char, 'guardian', L, o, { leap: 1 + (econMods(account).guardianLoot || 0) });
}

// ------------------------------------------------------------------------------------------------ abyss & legion
export function abyssReward(account, char, { raid = 'oratory', gate = 0, cleared = true, rng, now = Date.now(), grant = true } = {}) {
  const R = ABYSS_LOOT[raid], G = R?.gates[gate]; if (!G) return fail('unknown', 'Unknown abyssal dungeon gate.');
  const source = `abyss:${raid}:${gate}`;
  if (!cleared) return none(source, G.name, ['No rewards for an unfinished gate.']);
  const ws = wk(char, 'abyss', now), key = `${raid}:${gate}`, first = !ws[key], r = rngOf(rng), m = mulBy(account);
  let b;
  if (first) { b = rollTable(G.first, r, { mulBy: m }); rollTable(G.extras, r, { into: b }); ws[key] = true; }
  else b = rollTable(G.repeat, r, { mulBy: m });
  return finish(account, char, grant, { source, title: `${R.name} — ${G.name}`, bundle: b, first, notes: first ? ['Weekly first clear'] : ['Weekly chest already claimed — repeat rewards'] });
}
export function raidReward(account, char, { raid = 'gorrath', gate = 0, mode = 'normal', cleared = true, rng, now = Date.now(), grant = true } = {}) {
  const R = RAID_LOOT[raid], G = R?.[mode]?.gates[gate]; if (!G) return fail('unknown', 'Unknown legion raid gate.');
  const source = `raid:${raid}:${mode}:${gate}`, title = `${R.name} — ${G.name}${mode === 'hard' ? ' (Hard)' : ''}`;
  if (!cleared) return none(source, title, ['No rewards for an unfinished gate.']);
  const ws = wk(char, 'raid', now), key = `${raid}:${gate}`, r = rngOf(rng);
  if (ws[key]) return finish(account, char, grant, { source, title, bundle: { silver: 10000 }, notes: [`Weekly rewards for this gate were already claimed (${ws[key]}).`] });
  const b = { gold: G.gold };
  rollTable(G.chest, r, { into: b, mulBy: mulBy(account) });
  rollTable(G.extras, r, { into: b });
  ws[key] = mode; (ws.more ||= {})[key] = 'offer';
  return finish(account, char, grant, { source, title, bundle: b, first: true, notes: ['Weekly gate gold'], more: { cost: { gold: G.moreCost }, raid, gate, mode } });
}
export function buyMoreRewards(account, char, { raid = 'gorrath', gate = 0, mode = 'normal', rng, now = Date.now(), grant = true } = {}) {
  const R = RAID_LOOT[raid], G = R?.[mode]?.gates[gate]; if (!G) return fail('unknown', 'Unknown legion raid gate.');
  const ws = wk(char, 'raid', now), key = `${raid}:${gate}`;
  if (ws.more?.[key] !== 'offer') return fail('none', ws.more?.[key] === 'bought' ? 'You already opened this chest.' : 'Clear the gate first.');
  if (ws[key] !== mode) return fail('mode', 'The offer belongs to the other difficulty.');
  if (!pay(account, { gold: G.moreCost })) return fail('materials', 'Not enough gold.');
  ws.more[key] = 'bought';
  const b = rollTable(G.more, rngOf(rng), { mulBy: mulBy(account) });
  return finish(account, char, grant, { source: `more:${raid}:${mode}:${gate}`, title: `More Rewards — ${G.name}`, bundle: b, notes: [`Paid ${G.moreCost} gold`] });
}

// ------------------------------------------------------------------------------------------------ open world
export function fieldDrop(account, char, { kind = 'mob', rng, grant = true } = {}) {
  const F = FIELD_LOOT[kind]; if (!F || !['mob', 'elite', 'named'].includes(kind)) return fail('unknown', 'Unknown field drop kind.');
  return finish(account, char, grant, { source: `field:${kind}`, title: F.name, bundle: rollTable(F.table, rngOf(rng), { mulBy: mulBy(account) }) });
}
const WINDOW = { fieldboss: HOUR, chaosgate: HOUR, island: 2 * HOUR, ghostship: HOUR };
export function eventReward(account, char, { kind, island, focus, rng, now = Date.now(), grant = true } = {}) {
  const r = rngOf(rng);
  let table, title, source = kind, notes = [];
  if (kind === 'island') {
    const I = island ? ISLANDS[island] : null;
    focus = focus || I?.focus || 'gold';
    const L = ISLAND_LOOT[focus]; if (!L) return fail('unknown', 'Unknown island focus.');
    table = L.table; title = I ? `Adventure Island: ${I.name}` : L.name; source = `island:${focus}`;
  } else {
    const F = FIELD_LOOT[kind]; if (!F || !['fieldboss', 'chaosgate', 'ghostship', 'treasure'].includes(kind)) return fail('unknown', 'Unknown event.');
    table = F.table; title = F.name;
  }
  if (WINDOW[kind]) {
    const key = `${kind}:${Math.floor(now / WINDOW[kind])}`;
    char.events ||= {};
    for (const k of Object.keys(char.events)) if (now - char.events[k] > DAY) delete char.events[k];
    if (char.events[key]) return none(source, title, ['You already claimed this event’s rewards.']);
    char.events[key] = now;
  }
  const b = rollTable(table, r, { mulBy: mulBy(account) });
  const res = finish(account, char, grant, { source, title, bundle: b, notes });
  // rare collectibles
  if (grant) {
    if (kind === 'island' && island === 'gilded_atoll' && r.chance(0.02)) { const c = collect(account, char, 'souls', 'soul:gilded_atoll'); if (c.ok && c.isNew) res.notes.push('Island Soul of Gilded Atoll!'); }
    if (kind === 'ghostship' && r.chance(0.03)) { const c = collect(account, char, 'hearts', 'heart:tidebearer'); if (c.ok && c.isNew) res.notes.push('Heart of Tidebearer!'); }
  }
  return res;
}
export function infernoReward(account, char, { floor = 1, rng, now = Date.now(), grant = true } = {}) {
  floor = Math.max(1, Math.min(INFERNO_FLOORS, floor | 0));
  const L = infernoFloorLoot(floor), r = rngOf(rng), m = mulBy(account);
  const b = rollTable(L.base, r, { mulBy: m }), notes = [];
  if (L.boon.length) { rollTable(L.boon, r, { into: b, mulBy: m }); notes.push('Boon chest'); }
  const ws = wk(char, 'inferno', now); ws.best = Math.max(ws.best || 0, floor); ws.m ||= [];
  let first = false;
  if (L.milestone.length && !ws.m.includes(floor)) { rollTable(L.milestone, r, { into: b, mulBy: m }); ws.m.push(floor); first = true; notes.push('Weekly milestone chest'); }
  const res = finish(account, char, grant, { source: `inferno:${floor}`, title: `Inferno Descent — Floor ${floor}`, bundle: b, first, notes });
  if (grant && floor >= 50) { const c = collect(account, char, 'hearts', 'heart:ember_titan'); if (c.ok && c.isNew) res.notes.push('Heart of the Ember Titan!'); }
  return res;
}

// ------------------------------------------------------------------------------------------------ info & previews
export function weeklyInfo(account, char, now = Date.now()) {
  const raid = wk(char, 'raid', now), abyss = wk(char, 'abyss', now), inf = wk(char, 'inferno', now);
  const o = { raid: {}, abyss: {}, inferno: { best: inf.best || 0, milestones: (inf.m || []).slice().sort((a, b) => a - b) }, more: { ...(raid.more || {}) } };
  for (const [rid, R] of Object.entries(RAID_LOOT)) R.normal.gates.forEach((_, g) => { o.raid[`${rid}:${g}`] = raid[`${rid}:${g}`] || null; });
  for (const [aid, A] of Object.entries(ABYSS_LOOT)) A.gates.forEach((_, g) => { o.abyss[`${aid}:${g}`] = !!abyss[`${aid}:${g}`]; });
  return o;
}
const GRADE_NAME = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Relic', 'Ancient', 'Primal'];
function previewRow(e) {
  const base = { min: e.n[0], max: e.n[1], chance: e.p ?? 1 };
  let m;
  if (!isGenerator(e.id)) { const i = itemInfo(e.id); return { id: e.id, name: i.name, grade: i.grade, icon: i.icon, ...base }; }
  if ((m = /^acc:(\d)$/.exec(e.id))) return { id: e.id, name: `${GRADE_NAME[m[1]]} Accessory`, grade: +m[1], icon: 'item:necklace', ...base };
  if ((m = /^stone:(\d)$/.exec(e.id))) return { id: e.id, name: `${GRADE_NAME[m[1]]} Ability Stone`, grade: +m[1], icon: 'item:stone', ...base };
  if ((m = /^bracelet:(\d)$/.exec(e.id))) return { id: e.id, name: `${GRADE_NAME[m[1]]} Bracelet`, grade: +m[1], icon: 'item:bracelet', ...base };
  if ((m = /^book:(\d)$/.exec(e.id))) return { id: e.id, name: `${GRADE_NAME[m[1]]} Engraving Recipe`, grade: +m[1], icon: 'item:book:vendetta', ...base };
  if ((m = /^gem:(\d+)-(\d+)$/.exec(e.id))) return { id: e.id, name: `Gem (Lv.${m[1]}–${m[2]})`, grade: Math.min(7, 2 + Math.floor(+m[2] / 2)), icon: `item:gem:ruin:${m[2]}`, ...base };
  if ((m = /^card:(.+)$/.exec(e.id))) return { id: e.id, name: `Card: ${CARDS[m[1]]?.name || m[1]}`, grade: CARDS[m[1]]?.grade ?? 3, icon: `card:${m[1]}`, ...base };
  if ((m = /^card@(\d)$/.exec(e.id))) return { id: e.id, name: `${GRADE_NAME[m[1]]} Card`, grade: +m[1], icon: 'item:card_pack', ...base };
  return { id: e.id, name: e.id, grade: 1, icon: 'item:chest', ...base };
}
const sec = (name, table) => ({ name, rows: (table || []).map(previewRow) });
/** Reward preview for a source id: 'chaos:3', 'guardian:kurai', 'abyss:oratory:1', 'raid:gorrath:hard:1', 'fieldboss', 'island:gold', 'inferno:40', 'elite'… */
export function preview(source) {
  const p = String(source).split(':');
  if (p[0] === 'chaos' && CHAOS_LOOT[p[1]]) { const L = CHAOS_LOOT[p[1]]; return { title: L.name, mins: L.mins, ilvl: L.ilvl, sections: [sec('Every clear', L.base), sec('Resonance Chest (first 2 clears a day, ×2 with rest bonus)', [...L.resonance, ...L.extras])] }; }
  if (p[0] === 'guardian' && GUARDIAN_LOOT[p[1]]) { const L = GUARDIAN_LOOT[p[1]]; return { title: L.name, mins: L.mins, ilvl: L.ilvl, sections: [sec('Every clear', L.base), sec('Resonance Chest (first 2 hunts a day, ×2 with rest bonus)', [...L.resonance, ...L.extras])] }; }
  if (p[0] === 'abyss' && ABYSS_LOOT[p[1]]?.gates[p[2] || 0]) { const R = ABYSS_LOOT[p[1]], G = R.gates[p[2] || 0]; return { title: `${R.name} — ${G.name}`, mins: G.mins, ilvl: R.ilvl, sections: [sec('Weekly first clear', [...G.first, ...G.extras]), sec('Repeat clears', G.repeat)] }; }
  if (p[0] === 'raid' && RAID_LOOT[p[1]]?.[p[2] || 'normal']?.gates[p[3] || 0]) {
    const R = RAID_LOOT[p[1]], M = R[p[2] || 'normal'], G = M.gates[p[3] || 0];
    return { title: `${R.name} — ${G.name}`, mins: G.mins, ilvl: M.ilvl, sections: [sec('Gate rewards (weekly)', [{ id: 'gold', n: [G.gold, G.gold] }, ...G.chest, ...G.extras]), sec(`More Rewards (${G.moreCost} gold)`, G.more)] };
  }
  if (p[0] === 'island') { const L = ISLAND_LOOT[p[1] || 'gold']; if (L) return { title: L.name, mins: L.mins, ilvl: 0, sections: [sec('Island chest', L.table)] }; }
  if (p[0] === 'inferno') { const f = Math.max(1, Math.min(INFERNO_FLOORS, +p[1] || 1)), L = infernoFloorLoot(f); return { title: `Inferno Descent — Floor ${f}`, mins: L.mins, ilvl: 0, sections: [sec('Floor', L.base), ...(L.boon.length ? [sec('Boon chest (every 5th floor)', L.boon)] : []), ...(L.milestone.length ? [sec('Milestone chest (weekly)', L.milestone)] : [])] }; }
  if (FIELD_LOOT[p[0]]) { const F = FIELD_LOOT[p[0]]; return { title: F.name, mins: F.mins || 0, ilvl: 0, sections: [sec('Rewards', F.table)] }; }
  return null;
}
/** Every content source (for menus and the economy model). */
export function sources() {
  const out = [];
  for (const L of Object.values(CHAOS_LOOT)) out.push({ id: L.id, title: L.name, ilvl: L.ilvl, mins: L.mins, kind: 'chaos' });
  for (const L of Object.values(GUARDIAN_LOOT)) out.push({ id: `guardian:${L.id}`, title: L.name, ilvl: L.ilvl, mins: L.mins, kind: 'guardian' });
  for (const R of Object.values(ABYSS_LOOT)) R.gates.forEach((G, i) => out.push({ id: `abyss:${R.id}:${i}`, title: `${R.name} — ${G.name}`, ilvl: R.ilvl, mins: G.mins, kind: 'abyss' }));
  for (const R of Object.values(RAID_LOOT)) for (const mode of ['normal', 'hard']) R[mode].gates.forEach((G, i) => out.push({ id: `raid:${R.id}:${mode}:${i}`, title: `${R.name} — ${G.name}${mode === 'hard' ? ' (Hard)' : ''}`, ilvl: R[mode].ilvl, mins: G.mins, kind: 'raid' }));
  for (const k of ['fieldboss', 'chaosgate', 'ghostship', 'treasure']) out.push({ id: k, title: FIELD_LOOT[k].name, ilvl: 0, mins: FIELD_LOOT[k].mins, kind: 'event' });
  for (const [k, L] of Object.entries(ISLAND_LOOT)) out.push({ id: `island:${k}`, title: L.name, ilvl: 0, mins: L.mins, kind: 'island' });
  out.push({ id: 'inferno:1', title: 'Inferno Descent', ilvl: 0, mins: 1.2, kind: 'inferno' });
  return out;
}
