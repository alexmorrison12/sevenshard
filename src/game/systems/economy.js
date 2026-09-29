// simulateEconomy(): plays a dedicated player from a Powerpass character (Vanguard +10, iLvl 1200) to legion-raid ready
// (Horned Tyrant +8, iLvl 1420) in a sandbox account (never the real save) and reports how long it takes and what flows
// through the economy. Uses the real loot tables, honing, tasks, mail and market prices.
import { ITEMS, GEAR_SLOTS } from '../../data/items.js';
import { CHAOS_LOOT, GUARDIAN_LOOT, ABYSS_LOOT, FIELD_LOOT, ISLAND_LOOT, infernoFloorLoot, ENGRAVING_DEMAND } from '../../data/loot.js';
import { makeGear } from './gear.js';
import { itemLevel } from './stats.js';
import { RNG } from '../../core/noise.js';
import { dayId, weekId } from '../../core/util.js';
import * as loot from './loot.js';
import * as honing from './honing.js';
import * as tasks from './tasks.js';
import * as mail from './mail.js';
import * as gems from './gems.js';
import { price as marketPrice, accessoryPrice, ITEMS_MARKET, FEE } from './market.js';
import { expectTable } from './rolls.js';
import { missing, merge, SEC, MIN, HOUR, DAY } from './common.js';

const WALLET = ['silver', 'gold', 'crystals', 'royal', 'shards', 'pirate', 'bloodstone', 'pvp', 'tokens'];
const TRACK = ['silver', 'gold', 'leapstone', 'fusion', 'shards', 'horn_shard', 'destruction_stone', 'guardian_stone'];
const TARGET = 1420, ENTRY = 1415;

// ------------------------------------------------------------------------------------------------ sandbox account
/** A minimal Account look-alike on a simulated clock (same wallet/mats semantics as src/game/account.js; no persistence). */
export class SimAccount {
  constructor(clock) {
    this.clock = clock;
    this.data = { v: 1, created: 1, settings: {}, chars: [], lastChar: null, roster: {
      name: 'Simulant', level: 1, xp: 0, wallet: Object.fromEntries(WALLET.map(k => [k, k === 'silver' ? 25000 : 0])), mats: {}, bank: [],
      collect: { seeds: [], souls: [], hearts: [], masterpieces: [], stars: [], bounties: [], leaves: [], vistas: [] }, claimed: {}, tome: {}, cards: {}, deck: [],
      rapport: {}, stronghold: null, life: null, guild: null, pvp: { rating: 1000, wins: 0, losses: 0 }, mail: [], songs: ['homeward'], emotes: ['wave', 'bow', 'cheer', 'dance', 'sit', 'clap'],
      mounts: [], pets: [], titles: [], activeTitle: null, daily: { day: dayId(clock.t), rest: {} }, weekly: { week: weekId(clock.t) }, records: {}, unlocked: {}, flags: {},
      market: { listings: [], sold: [] }, stats: { kills: 0, deaths: 0, honeTaps: 0, honeWins: 0, bestStone: null, playSecs: 0 } } };
  }
  get roster() { return this.data.roster; }
  get chars() { return this.data.chars; }
  save() {} flush() {}
  count(id) { return WALLET.includes(id) ? this.roster.wallet[id] || 0 : this.roster.mats[id] || 0; }
  has(id, n = 1) { return this.count(id) >= n; }
  take(id, n = 1) { if (!this.has(id, n)) return false; if (WALLET.includes(id)) this.roster.wallet[id] -= n; else { this.roster.mats[id] -= n; if (this.roster.mats[id] <= 0) delete this.roster.mats[id]; } return true; }
  give(id, n = 1) { if (!n) return; if (WALLET.includes(id)) this.roster.wallet[id] = (this.roster.wallet[id] || 0) + n; else this.roster.mats[id] = (this.roster.mats[id] || 0) + n; }
  grant(char, b) { for (const [k, v] of Object.entries(b || {})) if (k === 'items') for (const it of v) this.addItem(char, it); else if (typeof v === 'number') this.give(k, v); }
  addItem(char, it) { if (ITEMS[it.id] && !it.uid) { this.give(it.id, it.count || 1); return; } char.inv.push(it); }
  removeItem(char, u) { const i = char.inv.findIndex(x => x.uid === u); return i < 0 ? null : char.inv.splice(i, 1)[0]; }
  addXp() { return []; }
  addRosterXp(n) { this.roster.xp += n; }
  resets() {
    const r = this.roster, d = dayId(this.clock.t), w = weekId(this.clock.t);
    if (r.daily.day !== d) {
      for (const c of this.chars) { c.daily ||= { chaos: 0, guardian: 0 }; const rest = c.rest ||= { chaos: 0, guardian: 0 }; rest.chaos = Math.min(100, rest.chaos + Math.max(0, 2 - (c.daily.chaos || 0)) * 10); rest.guardian = Math.min(100, rest.guardian + Math.max(0, 2 - (c.daily.guardian || 0)) * 10); c.daily = { chaos: 0, guardian: 0, tasks: 0 }; }
      r.daily = { day: d, rest: {} };
    }
    if (r.weekly.week !== w) { r.weekly = { week: w }; for (const c of this.chars) c.weekly = {}; }
  }
  /** a Powerpass character: level 60, Vanguard +10 (quality 60) */
  powerpass(cls = 'reaver') {
    const c = { id: 'sim', name: 'Simulant', cls, sex: 'm', level: 60, xp: 0, skills: {}, equip: {}, inv: [], books: [], gems: [], items: [], powerpass: true, daily: { chaos: 0, guardian: 0, tasks: 0 }, rest: { chaos: 0, guardian: 0 }, weekly: {} };
    for (const sl of GEAR_SLOTS) c.equip[sl] = makeGear('vanguard', sl, cls, { hone: 10, quality: 60 });
    c.ilvl = itemLevel(c); this.chars.push(c); return c;
  }
}

// ------------------------------------------------------------------------------------------------ valuation
const GRADE_ACC = { 4: 10, 5: 60, 6: 400 };
const BOOK_AVG = (() => { let s = 0, w = 0; for (const [id, d] of Object.entries(ENGRAVING_DEMAND)) { s += d * (ITEMS_MARKET[`book:${id}`]?.base || 0); w += d; } return s / w; })();
function unitValue(id, phase) {
  if (id === 'silver') return 1 / 90;
  if (id === 'gold') return 1;
  if (id === 'shards') return 0.02;
  if (id === 'horn_shard') return phase === 'horned' ? 7 : 3;
  const M = ITEMS_MARKET[id]; return M ? M.base / M.unit : 0;
}
function genValue(id) {
  let m;
  if ((m = /^acc:(\d)$/.exec(id))) return GRADE_ACC[m[1]] || 0;
  if ((m = /^book:(\d)$/.exec(id))) return +m[1] >= 4 ? BOOK_AVG : 5;
  if ((m = /^gem:(\d+)-(\d+)$/.exec(id))) return 2.3 * Math.pow(3, +m[1] - 1) * 1.6;
  if ((m = /^stone:(\d)$/.exec(id))) return +m[1] >= 5 ? 20 : 5;
  return 0;
}
function tableValue(table, phase, mul = 1) {
  let v = 0; const ex = expectTable(table, mul);
  for (const [k, n] of Object.entries(ex)) v += n * unitValue(k, phase);
  for (const e of table || []) if (/[:@]/.test(e.id)) v += (e.p ?? 1) * (e.n[0] + e.n[1]) / 2 * genValue(e.id);
  return v;
}

// ------------------------------------------------------------------------------------------------ one run
const best = (list, il) => list.filter(x => x.ilvl <= il).sort((a, b) => b.ilvl - a.ilvl)[0];
function simRun({ seed, strategy, start, maxHours, crate, verbose }) {
  const clock = { t: start }, r = new RNG(seed);
  const A = new SimAccount(clock), C = A.powerpass('reaver');
  const minHone = strategy === 'late' ? 15 : honing.TRANSFER.minHone;
  const st = { chaos: 0, guardian: 0, abyss: 0, events: 0, inferno: 0, taps: 0, fails: 0, transfers: 0, marketBuys: 0, marketSales: 0, salesGold: 0, buyGold: 0, stall: {} };
  const spent = Object.fromEntries(TRACK.map(k => [k, 0]));
  const init = Object.fromEntries(TRACK.map(k => [k, A.count(k)]));
  const timeline = [];
  const note = what => { timeline.push({ min: Math.round((clock.t - start) / MIN), ilvl: Math.floor(itemLevel(C) * 100) / 100, what }); };
  if (crate) { mail.welcome(A, C, clock.t); mail.claimAll(A, C); }
  let tEntry = null, tTransfer = null, tDone = null, infFloor = 0, lastDay = -1;
  const phase = () => GEAR_SLOTS.some(s => C.equip[s].set === 'horned') ? 'horned' : 'vanguard';
  const done = () => GEAR_SLOTS.every(s => C.equip[s].set === 'horned' && C.equip[s].hone >= 8);

  const acceptTasks = () => {
    const v = tasks.view(A, clock.t);
    for (const pref of ['chaos', 'guardian', 'event', 'hone', 'elites', 'slay_demons', 'inferno', 'trade']) if (v.daily.offered.some(t => t.id === pref) && v.daily.accepted.length < 3) { tasks.accept(A, pref, clock.t); v.daily.accepted.push(pref); }
    for (const pref of ['w_chaos', 'w_hone', 'w_guardian', 'w_abyss', 'w_events', 'w_daily', 'w_inferno']) if (v.weekly.offered.some(t => t.id === pref) && v.weekly.accepted.length < 3) { tasks.accept(A, pref, clock.t); v.weekly.accepted.push(pref); }
  };
  const claimTasks = () => { const v = tasks.view(A, clock.t); for (const set of [v.daily, v.weekly]) for (const t of set.offered) if (t.accepted && t.done && !t.claimed) tasks.claim(A, C, t.id, clock.t); };
  const track = (event, data) => tasks.track(A, C, event, { ...data, now: clock.t });

  const sellDrops = () => {
    let gold = 0, n = 0;
    for (const p of ['gem_pouch', 'gem_pouch_hi']) while (A.count(p) > 0) gems.openPouch(A, C, p, { rng: r });
    for (const it of C.inv.slice()) {
      let v = 0;
      if (it.kind === 'book') v = marketPrice(`book:${it.engr}`, clock.t);
      else if (it.kind === 'gem') v = marketPrice(`gem:${it.gem}:${it.level}`, clock.t);
      else if (it.kind === 'accessory') v = accessoryPrice(it);
      else if (it.kind === 'stone') v = it.grade >= 5 ? 20 : 5;
      else continue;
      C.inv.splice(C.inv.indexOf(it), 1);
      gold += Math.floor(v * (1 - FEE) * 0.9); n++;
    }
    if (n) { A.give('gold', gold); st.marketSales += n; st.salesGold += gold; clock.t += MIN; track('sell', {}); }
  };
  const buyShortfall = (need, reserve) => {
    let cost = 0;
    for (const [id, q] of Object.entries(need)) { const M = ITEMS_MARKET[id]; if (!M || M.cat !== 'honing') return false; cost += Math.ceil(q / M.unit) * marketPrice(id, clock.t) * 1.02; }
    cost = Math.ceil(cost);
    if (A.count('gold') - reserve < cost) return false;
    A.take('gold', cost); spent.gold += cost; st.buyGold += cost; st.marketBuys++;
    for (const [id, q] of Object.entries(need)) A.give(id, Math.ceil(q / ITEMS_MARKET[id].unit) * ITEMS_MARKET[id].unit);
    return true;
  };
  const transferReserve = () => GEAR_SLOTS.reduce((a, s) => a + (C.equip[s].set === 'vanguard' ? honing.TRANSFER.cost[s === 'weapon' ? 'weapon' : 'armor'].gold : 0), 0);
  const honeLoop = () => {
    for (let guard = 0; guard < 400; guard++) {
      for (const s of GEAR_SLOTS) {
        const it = C.equip[s];
        if (it.set === 'vanguard' && it.hone >= minHone) { const p = honing.transferPreview(A, C, s); if (!p.ok) for (const k of Object.keys(p.missing || {})) st.stall['transfer_' + k] = (st.stall['transfer_' + k] || 0) + 1; if (p.ok) { const res = honing.transfer(A, C, s); if (res.ok) { for (const [k, v] of Object.entries(res.cost)) if (k in spent) spent[k] += v; st.transfers++; clock.t += 30 * SEC; note(`reforged ${s} → Horned +${res.item.hone}`); if (!tTransfer && GEAR_SLOTS.every(x => C.equip[x].set === 'horned')) tTransfer = clock.t; } } }
      }
      const cands = GEAR_SLOTS.map(s => C.equip[s]).filter(it => it.set === 'vanguard' ? it.hone < minHone : it.hone < 8);
      if (!cands.length) break;
      cands.sort((a, b) => a.iLvl - b.iLvl || (a.slot === 'weapon' ? -1 : 1));
      const it = cands[0], slot = it.slot;
      const cost = honing.costOf(A, it, clock.t);
      const base = honing.chanceOf(it, {}, clock.t).base, boosters = {};
      if (base <= 0.35 && !(it.honeState?.energy >= 1)) for (const [k, cap] of [['solar_protection', 2], ['solar_blessing', 6], ['solar_grace', 12]]) { const n = Math.min(cap, A.count(k)); if (n) boosters[k] = n; }
      const all = merge({ ...cost }, boosters), need = missing(A, all);
      if (Object.keys(need).length) {
        const hard = Object.keys(need).filter(k => !ITEMS_MARKET[k] || ITEMS_MARKET[k].cat !== 'honing');
        if (hard.length) { for (const k of hard) st.stall[k] = (st.stall[k] || 0) + 1; break; }
        if (!buyShortfall(need, transferReserve() + (cost.gold || 0))) { st.stall.gold_for_mats = (st.stall.gold_for_mats || 0) + 1; break; }
      }
      const res = honing.hone(A, C, slot, { boosters, rng: r, now: clock.t });
      if (!res.ok) break;
      for (const [k, v] of Object.entries(res.cost)) if (k in spent) spent[k] += v;
      st.taps++; if (!res.success) st.fails++; else if (verbose) note(`${slot} +${res.to}`);
      clock.t += 5 * SEC;
    }
  };

  const end = start + maxHours * HOUR;
  while (clock.t < end) {
    A.resets();
    if (dayId(clock.t) !== lastDay) { lastDay = dayId(clock.t); acceptTasks(); }
    const il = itemLevel(C);
    if (il >= ENTRY && tEntry == null) { tEntry = clock.t; note('raid entry (1415)'); }
    if (done()) { tDone = clock.t; note('Horned Tyrant +8 — legion ready'); break; }
    // ---- choose an activity
    const m = Math.floor(clock.t / MIN) % 60, h = Math.floor(clock.t / HOUR) % 24;
    const evKey = k => `${k}:${Math.floor(clock.t / (k === 'island' ? 2 * HOUR : HOUR))}`;
    const claimed = k => !!C.events?.[evKey(k)];
    let act = null;
    if (m < 10 && !claimed('fieldboss')) act = { kind: 'fieldboss', mins: FIELD_LOOT.fieldboss.mins };
    else if (h % 2 === 0 && m < 15 && !claimed('island')) act = { kind: 'island', mins: ISLAND_LOOT.gold.mins };
    else if (m >= 30 && m < 40 && !claimed('chaosgate')) act = { kind: 'chaosgate', mins: FIELD_LOOT.chaosgate.mins };
    else if ((m >= 56 || (m >= 26 && m < 30)) ) act = { kind: 'wait', mins: (m >= 56 ? 60 : 30) - m };
    if (!act) {
      const abyss = ABYSS_LOOT.oratory, wk = loot.weeklyInfo(A, C, clock.t);
      const ri = loot.restInfo(C);
      if (il >= abyss.ilvl && !wk.abyss['oratory:0']) act = { kind: 'abyss', gate: 0, mins: abyss.gates[0].mins };
      else if (il >= abyss.ilvl && !wk.abyss['oratory:1']) act = { kind: 'abyss', gate: 1, mins: abyss.gates[1].mins };
      else if (ri.chaos.resonanceLeft) { const L = best(Object.values(CHAOS_LOOT), il); act = { kind: 'chaos', tier: +L.id.split(':')[1], mins: L.mins }; }
      else if (ri.guardian.resonanceLeft) { const L = best(Object.values(GUARDIAN_LOOT), il); act = { kind: 'guardian', id: L.id, mins: L.mins }; }
      else {
        const ph = phase(), opts = [];
        const Lc = best(Object.values(CHAOS_LOOT), il), Lg = best(Object.values(GUARDIAN_LOOT), il);
        opts.push({ kind: 'chaos', tier: +Lc.id.split(':')[1], mins: Lc.mins, v: tableValue(Lc.base, ph) / (Lc.mins + 1) });
        opts.push({ kind: 'guardian', id: Lg.id, mins: Lg.mins, v: tableValue(Lg.base, ph) / (Lg.mins + 1) });
        if (infFloor < 50) { let v = 0, mins = 0; for (let f = infFloor + 1; f <= infFloor + 5; f++) { const L = infernoFloorLoot(f); v += tableValue(L.base, ph) + tableValue(L.boon, ph) + tableValue(L.milestone, ph); mins += L.mins; } opts.push({ kind: 'inferno', mins, v: v / (mins + 1) }); }
        act = opts.sort((a, b) => b.v - a.v)[0];
      }
    }
    // ---- do it
    if (act.kind === 'wait') { clock.t += act.mins * MIN; continue; }
    clock.t += (act.mins + 1) * MIN;
    if (act.kind === 'chaos') { loot.chaosReward(A, C, { tier: act.tier, rng: r, now: clock.t }); st.chaos++; track('clear', { content: 'chaos', tier: act.tier }); track('kill', { family: 'demon', count: 180 }); track('kill', { family: 'demon', elite: true, count: 4 }); }
    else if (act.kind === 'guardian') { loot.guardianReward(A, C, { guardian: act.id, rng: r, now: clock.t }); st.guardian++; track('clear', { content: 'guardian', id: act.id }); }
    else if (act.kind === 'abyss') { loot.abyssReward(A, C, { raid: 'oratory', gate: act.gate, rng: r, now: clock.t }); st.abyss++; track('clear', { content: 'abyss', id: 'oratory', gate: act.gate }); }
    else if (act.kind === 'inferno') { for (let i = 0; i < 5; i++) { infFloor++; loot.infernoReward(A, C, { floor: infFloor, rng: r, now: clock.t }); track('clear', { content: 'inferno', floor: infFloor }); } st.inferno += 5; }
    else {
      const island = act.kind === 'island' ? tasks.eventWindow('island', clock.t - act.mins * MIN)?.island?.id : undefined;
      loot.eventReward(A, C, { kind: act.kind, island, rng: r, now: clock.t - (act.mins + 1) * MIN }); st.events++; track('clear', { content: act.kind });
    }
    claimTasks(); sellDrops(); honeLoop();
  }
  const final = Object.fromEntries(TRACK.map(k => [k, A.count(k)]));
  const earned = Object.fromEntries(TRACK.map(k => [k, final[k] + spent[k] - init[k]]));
  return { hours: tDone ? (tDone - start) / HOUR : null, entryHours: tEntry ? (tEntry - start) / HOUR : null, transferHours: tTransfer ? (tTransfer - start) / HOUR : null,
    st, spent, earned, final, timeline, ilvl: itemLevel(C), support: honing.supportEvent(start).name };
}

// ------------------------------------------------------------------------------------------------ public
const q = (arr, p) => { const a = arr.filter(x => x != null).sort((x, y) => x - y); if (!a.length) return null; const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };
const r2 = v => v == null ? null : Math.round(v * 100) / 100;
/**
 * opts: { runs = 24, seed = 1, strategy = 'early'|'late', start (ms; default Wed 2026-09-30 10:05 UTC), maxHours = 12,
 *         crate = true (claim the Powerpass Starter Crate), verbose = false }
 */
export function simulateEconomy(opts = {}) {
  const { runs = 24, seed = 1, strategy = 'early', start = Date.UTC(2026, 8, 30, 10, 5), maxHours = 12, crate = true, verbose = false } = opts;
  const res = [];
  for (let i = 0; i < runs; i++) res.push(simRun({ seed: seed + i * 7919, strategy, start: start + (i % 6) * 7 * DAY + ((i * 17) % 60) * MIN, maxHours, crate, verbose }));
  const hours = res.map(x => x.hours), mean = k => r2(res.reduce((a, x) => a + (x.st[k] || 0), 0) / runs);
  const avg = key => Object.fromEntries(TRACK.map(k => [k, Math.round(res.reduce((a, x) => a + x[key][k], 0) / runs)]));
  const med = q(hours, 0.5), medRun = res.slice().sort((a, b) => (a.hours ?? 99) - (b.hours ?? 99))[Math.floor(runs / 2)];
  const out = {
    runs, strategy, target: TARGET, entry: ENTRY, finished: hours.filter(h => h != null).length,
    hours: { median: r2(med), p10: r2(q(hours, 0.1)), p90: r2(q(hours, 0.9)), mean: r2(hours.filter(h => h != null).reduce((a, b) => a + b, 0) / Math.max(1, hours.filter(h => h != null).length)), min: r2(q(hours, 0)), max: r2(q(hours, 1)) },
    entryHours: { median: r2(q(res.map(x => x.entryHours), 0.5)), p10: r2(q(res.map(x => x.entryHours), 0.1)), p90: r2(q(res.map(x => x.entryHours), 0.9)) },
    transferHours: { median: r2(q(res.map(x => x.transferHours), 0.5)) },
    per: { chaos: mean('chaos'), guardian: mean('guardian'), abyss: mean('abyss'), events: mean('events'), inferno: mean('inferno'), taps: mean('taps'), fails: mean('fails'), transfers: mean('transfers'), marketBuys: mean('marketBuys'), marketSales: mean('marketSales'), salesGold: mean('salesGold'), buyGold: mean('buyGold') },
    spent: avg('spent'), earned: avg('earned'),
    timeline: medRun.timeline, supportEvents: [...new Set(res.map(x => x.support))],
    ...(opts.debug ? { results: res } : {}),
  };
  const f = n => Math.round(n).toLocaleString('en-US');
  out.text = [
    `simulateEconomy — ${runs} runs, strategy '${strategy}' (transfer at Vanguard +${strategy === 'late' ? 15 : honing.TRANSFER.minHone}), Powerpass crate ${crate ? 'on' : 'off'}`,
    `  legion ready (Horned +8, iLvl ${TARGET}): median ${out.hours.median} h · p10 ${out.hours.p10} h · p90 ${out.hours.p90} h · range ${out.hours.min}–${out.hours.max} h · finished ${out.finished}/${runs}`,
    `  raid entry (iLvl ${ENTRY}): median ${out.entryHours.median} h · all six pieces reforged: median ${out.transferHours.median} h`,
    `  per run: chaos ${out.per.chaos} · guardian ${out.per.guardian} · abyss gates ${out.per.abyss} · events ${out.per.events} · inferno floors ${out.per.inferno} · honing taps ${out.per.taps} (fails ${out.per.fails}) · market sales ${out.per.marketSales} (${f(out.per.salesGold)} g) · buys ${out.per.marketBuys} (${f(out.per.buyGold)} g)`,
    `  spent: ${TRACK.map(k => `${k} ${f(out.spent[k])}`).join(' · ')}`,
    `  earned: ${TRACK.map(k => `${k} ${f(out.earned[k])}`).join(' · ')}`,
  ].join('\n');
  return out;
}
