// Honing polish on top of gear.js: the same rules (falling rates, +10%-of-base failure bonus, boosters, Artisan's
// Energy = 46.5% of each failed attempt's chance, 100% = guaranteed) plus weekly Honing Support events, research
// discounts, pity statistics and share-card data, expected-cost maths, quality upgrades, and the raid-vendor path
// from Vanguard to Horned Tyrant gear (transfer: horn shards + gold + sunshards).
import { SETS, GEAR_SLOTS, SLOT_NAMES } from '../../data/items.js';
import { honeCost, gearIlvl, gearStats, BOOSTER_CAP, HONE_RATES, transfer as gearTransfer, upgradeQuality as gearQuality, qualityCost } from './gear.js';
import { itemLevel } from './stats.js';
import { perks } from './stronghold.js';
import { ok, fail, pay, missing, costRows, discount, rngOf, seeded, emit, merge, itemInfo } from './common.js';
import { weekId, nextWeekly } from '../../core/util.js';

// ------------------------------------------------------------------------------------------------ weekly support
export const SUPPORT_EVENTS = [
  { id: 'artisans_week', name: 'Artisan’s Week', desc: 'Artisan’s Energy fills 50% faster.', energyMul: 1.5 },
  { id: 'lucky_forge', name: 'Lucky Forge', desc: 'Base honing chance ×1.2 on +1 … +15.', rateMul: 1.2, maxHone: 15 },
  { id: 'silver_lining', name: 'Silver Lining', desc: 'Honing silver cost −40%.', costMul: { silver: 0.6 } },
  { id: 'stonemason', name: 'Stonemason’s Discount', desc: 'Destruction and Guardian Stone costs −30%.', costMul: { destruction_stone: 0.7, guardian_stone: 0.7 } },
  { id: 'leap_of_faith', name: 'Leap of Faith', desc: 'Leapstone and Fusion Material costs −25%.', costMul: { leapstone: 0.75, fusion: 0.75 } },
  { id: 'shardstorm', name: 'Shardstorm', desc: 'Sunshard cost −50%.', costMul: { shards: 0.5 } },
];
/** This week's Honing Support event (rotates every Wednesday 10:00 UTC). */
export function supportEvent(now = Date.now()) {
  const n = SUPPORT_EVENTS.length, e = SUPPORT_EVENTS[((weekId(now) % n) + n) % n];
  return { ...e, ends: nextWeekly(now) };
}
const ENERGY_RATE = 0.465;
export const TRANSFER = {
  from: 'vanguard', to: 'horned', minHone: 12,
  cost: { weapon: { horn_shard: 10, gold: 200, shards: 4000 }, armor: { horn_shard: 6, gold: 100, shards: 2500 } },
};

// ------------------------------------------------------------------------------------------------ chance & cost
/** Chance breakdown for the next attempt with boosters and the weekly event. */
export function chanceOf(it, boosters = {}, now = Date.now()) {
  const S = SETS[it.set], ev = supportEvent(now);
  const raw = HONE_RATES[S?.tier]?.[it.hone] ?? 0;
  const rateMul = ev.rateMul && it.hone < (ev.maxHone ?? 99) ? ev.rateMul : 1;
  const base = Math.min(1, raw * rateMul);
  const st = it.honeState || { fails: 0, energy: 0 };
  const failBonus = Math.min(base, base * 0.1 * st.fails);
  const boost = Math.min(base, (boosters.solar_grace || 0) * base * 0.0835 + (boosters.solar_blessing || 0) * base * 0.167 + (boosters.solar_protection || 0) * base * 0.5);
  const total = Math.min(1, base + failBonus + boost);
  return { base, raw, event: base - raw, failBonus, boost, total, energy: st.energy || 0, guaranteed: (st.energy || 0) >= 1, fails: st.fails || 0 };
}
/** Material cost of one attempt after the weekly event and research discounts. */
export function costOf(account, it, now = Date.now()) {
  const ev = supportEvent(now), p = account ? perks(account) : {};
  const mul = { ...(ev.costMul || {}) };
  if (p.honeSilver) mul.silver = (mul.silver ?? 1) * (1 - p.honeSilver);
  return discount(honeCost(it), mul);
}
/** Distribution of attempts needed from the current state. */
export function expected(it, { boosters = {}, now = Date.now(), account = null } = {}) {
  const S = SETS[it.set]; if (!S || it.set === 'story' || it.hone >= S.max) return { taps: 0, p50: 0, p90: 0, perTap: {}, cost: {}, chances: [] };
  const ev = supportEvent(now), em = ev.energyMul || 1;
  const c0 = chanceOf(it, boosters, now);
  let fails = c0.fails, energy = c0.energy, alive = 1, mean = 0, cdf = 0, p50 = 0, p90 = 0;
  const chances = [];
  for (let k = 1; k <= 400 && alive > 1e-9; k++) {
    const failBonus = Math.min(c0.base, c0.base * 0.1 * fails);
    const p = energy >= 1 ? 1 : Math.min(1, c0.base + failBonus + c0.boost);
    chances.push(p);
    const succ = alive * p; mean += k * succ; cdf += succ; alive -= succ;
    if (!p50 && cdf >= 0.5) p50 = k; if (!p90 && cdf >= 0.9) p90 = k;
    fails++; energy = Math.min(1, energy + p * ENERGY_RATE * em);
    if (p >= 1) break;
  }
  const perTap = account ? costOf(account, it, now) : honeCost(it);
  const cost = {}; for (const [k, v] of Object.entries(perTap)) cost[k] = Math.round(v * mean);
  for (const [k, v] of Object.entries(boosters)) if (v) cost[k] = (cost[k] || 0) + Math.round(v * mean);
  return { taps: Math.round(mean * 100) / 100, p50, p90, perTap, cost, chances };
}
/** P(needing more than `taps` attempts) for a fresh piece at this level without boosters — the share-card luck. */
function luckOf(it, taps, now) {
  const probe = { ...it, hone: it.hone, honeState: { fails: 0, energy: 0 } };
  const e = expected(probe, { now });
  let alive = 1; for (let i = 0; i < taps && i < e.chances.length; i++) alive *= 1 - e.chances[i];
  return Math.max(0, Math.min(1, alive));
}

// ------------------------------------------------------------------------------------------------ stats
function hstats(account) {
  const st = account.roster.stats ||= {};
  const h = st.honing ||= { taps: 0, wins: 0, fails: 0, guaranteed: 0, luckiest: null, unluckiest: null, history: [] };
  return h;
}
export function stats(account) { const h = hstats(account); return { taps: h.taps, wins: h.wins, fails: h.fails, guaranteed: h.guaranteed, luckiest: h.luckiest, unluckiest: h.unluckiest, history: h.history.slice() }; }

// ------------------------------------------------------------------------------------------------ hone
export function hone(account, char, slot, { boosters = {}, rng, now = Date.now() } = {}) {
  const it = char.equip?.[slot];
  if (!it) return fail('empty', 'Nothing is equipped there.');
  const S = SETS[it.set];
  if (!S || it.set === 'story' || !S.max) return fail('story', 'Story gear can’t be honed. Reach level 50 or use a Powerpass to receive Vanguard gear.');
  if (it.hone >= S.max) return fail('max', 'This piece is fully honed.');
  for (const [k, v] of Object.entries(boosters || {})) {
    if (!v) continue;
    if (!(k in BOOSTER_CAP)) return fail('booster', 'Unknown booster.');
    if (v > BOOSTER_CAP[k]) return fail('booster', `At most ${BOOSTER_CAP[k]} per attempt.`);
  }
  const cost = costOf(account, it, now);
  const all = merge({ ...cost }, Object.fromEntries(Object.entries(boosters || {}).filter(([, v]) => v > 0)));
  const miss = missing(account, all);
  if (Object.keys(miss).length) { const need = Object.keys(miss)[0]; return fail('materials', `Not enough ${itemInfo(need).name} (need ${miss[need].toLocaleString('en-US')} more).`, { need, missing: miss }); }
  pay(account, all);
  const ev = supportEvent(now), ch = chanceOf(it, boosters, now);
  const r = rngOf(rng);
  const success = ch.guaranteed || r.next() < ch.total;
  const st = it.honeState ||= { fails: 0, energy: 0 };
  const from = it.hone, to = from + 1;
  let log = it.honeLog; if (!log || log.to !== to) log = it.honeLog = { to, taps: 0, fails: 0, spent: {} };
  log.taps++; merge(log.spent, all);
  const h = hstats(account); h.taps++;
  const rs = account.roster.stats; rs.honeTaps = (rs.honeTaps || 0) + 1;
  let share = null, energyGain = 0;
  if (success) {
    it.hone = to; it.honeState = { fails: 0, energy: 0 }; it.iLvl = gearIlvl(it); it.stats = gearStats(it);
    char.ilvl = itemLevel(char);
    const luck = ch.guaranteed ? 0 : luckOf({ ...it, hone: from }, log.taps, now);
    share = { kind: 'hone', name: it.name, slot, set: it.set, from, to, taps: log.taps, fails: log.fails, chance: ch.total, base: ch.base, energy: ch.energy, guaranteed: ch.guaranteed,
      luck, label: ch.guaranteed ? 'Artisan' : luck >= 0.5 ? 'Lucky' : luck >= 0.2 ? 'Average' : 'Unlucky', spent: { ...log.spent }, t: now, char: { name: char.name, cls: char.cls } };
    it.honeLog = null;
    h.wins++; rs.honeWins = (rs.honeWins || 0) + 1; if (ch.guaranteed) h.guaranteed++;
    h.history.unshift(share); if (h.history.length > 20) h.history.length = 20;
    if (!ch.guaranteed && (!h.luckiest || share.luck > h.luckiest.luck || (share.luck === h.luckiest.luck && share.chance < h.luckiest.chance))) h.luckiest = share;
    if (!h.unluckiest || share.fails > h.unluckiest.fails) h.unluckiest = share;
  } else {
    st.fails++; log.fails++; h.fails++;
    energyGain = Math.min(1 - st.energy, ch.total * ENERGY_RATE * (ev.energyMul || 1));
    st.energy = Math.min(1, st.energy + energyGain);
  }
  account.save();
  const notes = emit(account, char, 'hone', { success, slot, from, to: success ? to : from, target: to, set: it.set, chance: ch.total, guaranteed: ch.guaranteed, taps: log?.taps ?? share?.taps, fails: share?.fails ?? log?.fails });
  return ok({ success, guaranteed: ch.guaranteed, slot, name: it.name, from, to, hone: it.hone, iLvl: it.iLvl, chance: ch.total, base: ch.base,
    energy: it.honeState.energy, energyGain, fails: success ? share.fails : st.fails, taps: success ? share.taps : log.taps, cost: all, costRows: costRows(all), share, notes });
}

// ------------------------------------------------------------------------------------------------ transfer (raid vendor)
export function transferPreview(account, char, slot) {
  const it = char.equip?.[slot];
  if (!it) return fail('empty', 'Nothing is equipped there.');
  const cost = { ...TRANSFER.cost[slot === 'weapon' ? 'weapon' : 'armor'] };
  const nh = Math.round((it.hone || 0) / 2), H = SETS[TRANSFER.to];
  const base = { from: { set: it.set, hone: it.hone, iLvl: it.iLvl }, to: { set: TRANSFER.to, hone: nh, iLvl: H.base + nh * H.per }, cost, costRows: costRows(cost), missing: missing(account, cost) };
  if (it.set !== TRANSFER.from) return fail('set', it.set === TRANSFER.to ? 'Already Horned Tyrant gear.' : 'Only Vanguard gear can be reforged into Horned Tyrant gear.', base);
  if (it.hone < TRANSFER.minHone) return fail('hone', `Hone this piece to +${TRANSFER.minHone} first (it becomes Horned Tyrant +${Math.round(TRANSFER.minHone / 2)}).`, base);
  if (Object.keys(base.missing).length) return fail('materials', 'Not enough materials.', base);
  return ok(base);
}
export function transfer(account, char, slot) {
  const p = transferPreview(account, char, slot);
  if (!p.ok) return p;
  if (!pay(account, p.cost)) return fail('materials', 'Not enough materials.');
  const old = char.equip[slot];
  const item = gearTransfer(old, TRANSFER.to, char.cls);
  char.equip[slot] = item;
  char.ilvl = itemLevel(char);
  account.save();
  const notes = emit(account, char, 'transfer', { slot, hone: item.hone, iLvl: item.iLvl });
  return ok({ item, old, cost: p.cost, notes });
}

export function upgradeQuality(account, char, slot, { rng } = {}) {
  const it = char.equip?.[slot];
  if (!it || !GEAR_SLOTS.includes(slot)) return fail('empty', 'Nothing is equipped there.');
  if (it.quality >= 100) return fail('max', 'Quality is already 100.');
  const cost = qualityCost(it);
  if (!pay(account, cost)) return fail('materials', 'Not enough materials.', { cost, missing: missing(account, cost) });
  const res = seeded(rng, () => gearQuality(it));
  account.save();
  emit(account, char, 'quality', { slot, quality: res.now });
  return ok({ old: res.old, rolled: res.rolled, now: res.now, cost });
}

// ------------------------------------------------------------------------------------------------ window
export function view(account, char, now = Date.now()) {
  const pieces = GEAR_SLOTS.map(slot => {
    const it = char.equip?.[slot]; if (!it) return null;
    const S = SETS[it.set] || SETS.story, story = it.set === 'story' || !S.max, max = S.max || 0;
    const ch = story ? { base: 0, failBonus: 0, boost: 0, event: 0, total: 0, energy: 0, guaranteed: false, fails: 0 } : chanceOf(it, {}, now);
    const cost = story || it.hone >= max ? {} : costOf(account, it, now), miss = missing(account, cost);
    const why = story ? 'story' : it.hone >= max ? 'max' : Object.keys(miss).length ? 'materials' : null;
    const boosters = Object.fromEntries(Object.keys(BOOSTER_CAP).map(k => [k, { have: account.count(k), max: BOOSTER_CAP[k], add: ch.base * { solar_grace: 0.0835, solar_blessing: 0.167, solar_protection: 0.5 }[k] }]));
    const tp = it.set === TRANSFER.from ? transferPreview(account, char, slot) : null;
    return { slot, slotName: SLOT_NAMES[slot], uid: it.uid, name: it.name, set: it.set, setName: S.name, grade: it.grade, icon: it.icon, hone: it.hone || 0, max, iLvl: it.iLvl,
      nextILvl: story || it.hone >= max ? it.iLvl : gearIlvl({ ...it, hone: it.hone + 1 }), quality: it.quality,
      canHone: !why, why, msg: why === 'story' ? 'Story gear can’t be honed.' : why === 'max' ? 'Fully honed.' : why === 'materials' ? 'Not enough materials.' : '',
      chance: { base: ch.base, failBonus: ch.failBonus, boost: ch.boost, event: ch.event || 0, total: ch.total }, energy: ch.energy, guaranteed: ch.guaranteed, fails: ch.fails, taps: it.honeLog?.taps || 0,
      cost, costRows: costRows(cost), missing: miss, boosters,
      expected: story || it.hone >= max ? { taps: 0, cost: {} } : (({ taps, cost: c }) => ({ taps, cost: c }))(expected(it, { now, account })),
      transfer: tp ? { ok: tp.ok, why: tp.why || null, msg: tp.msg || '', from: tp.from, to: tp.to, cost: tp.cost, costRows: tp.costRows, missing: tp.missing, can: !!tp.ok } : null };
  }).filter(Boolean);
  return { iLvl: itemLevel(char), support: supportEvent(now), stats: stats(account), pieces };
}
