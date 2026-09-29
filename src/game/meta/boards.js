// Leaderboards. The weekly Legion Race (resets Wednesday 10:00 UTC): World First, fastest clears (full raid and each
// gate, Normal / Hard), top DPS per class, top support, deathless clears. The Daily Guardian (today's guardian, fastest
// kill). Inferno Descent (deepest floor, fastest 100). PvP rating. Fun boards: best ability stone, luckiest honing,
// most Pip Seeds.
//
// Rows come from four places, merged per board / variant / period (one row per name, best value):
//   · your entries (this browser's rosters) — store.js (localStorage)
//   · friends' entries shared in co-op — addFriendEntries()
//   · the realm's SimPlayers — a seeded "raider pool" per period (everyone sees the same names; the elite of the week
//     tops several boards), posting plausible runs that appear as the period goes on
//   · the global board (Supabase, remote.js) when it is configured
import { makeSim } from '../social/names.js';
import { RNG, hashStr } from '../../core/noise.js';
import { dayId, weekId } from '../../core/util.js';
import { GUARDIANS } from '../../data/raids.js';
import { BOSS_DEFS } from '../../data/bosses/index.js';
import { CLASSES } from '../../data/classes/index.js';
import { ENGRAVINGS, COMBAT_ENGRAVINGS } from '../../data/engravings.js';
import { SEEDS } from '../../data/collectibles.js';
import { db, saveDb, rid } from './store.js';
import { makeRemote } from './remote.js';
import { clock, dur, short, int, pct, stoneLabel, pvpTier } from './fmt.js';

const H = 3600e3, D = 24 * H, W = 7 * D;
const CLASS_IDS = Object.keys(CLASSES);
const isSupport = c => CLASSES[c]?.role === 'support';
export const DPS_CLASSES = CLASS_IDS.filter(c => !isSupport(c));
export const SUPPORT_CLASSES = CLASS_IDS.filter(isSupport);
export const SEED_TOTAL = SEEDS?.length || 120;
export const GATE_VARIANTS = [{ id: 'full', label: 'Full Raid' }, { id: 'g1', label: 'Gate 1' }, { id: 'g2', label: 'Gate 2' }];

export const BOARDS = [
  { id: 'legion_first', group: 'Weekly Legion Race', label: 'World First', period: 'week', unit: 'after', better: 'lower', sims: 46,
    desc: 'The first full clears of Gorrath, the Horned Tyrant, since the weekly reset — both gates, any difficulty.' },
  { id: 'legion_nm', group: 'Weekly Legion Race', label: 'Fastest · Normal', period: 'week', unit: 'time', better: 'lower', sims: 64, variants: GATE_VARIANTS,
    desc: 'Fastest Gorrath Normal clears this week. Full Raid adds your Gate 1 and Gate 2 times.' },
  { id: 'legion_hm', group: 'Weekly Legion Race', label: 'Fastest · Hard', period: 'week', unit: 'time', better: 'lower', sims: 40, variants: GATE_VARIANTS,
    desc: 'Fastest Gorrath Hard clears this week. Full Raid adds your Gate 1 and Gate 2 times.' },
  { id: 'legion_dps', group: 'Weekly Legion Race', label: 'Top DPS', period: 'week', unit: 'dps', better: 'higher', sims: 18, classVariants: true,
    variants: DPS_CLASSES.map(c => ({ id: c, label: CLASSES[c].name, cls: c })),
    desc: 'Highest damage per second in a Gorrath gate this week, class by class.' },
  { id: 'legion_support', group: 'Weekly Legion Race', label: 'Top Support', period: 'week', unit: 'score', better: 'higher', sims: 40,
    desc: 'Support score (0–100): buff uptime on the raid, plus shields and healing against the damage it took.' },
  { id: 'legion_deathless', group: 'Weekly Legion Race', label: 'Deathless', period: 'week', unit: 'time', better: 'lower', sims: 36,
    desc: 'Fastest Gorrath gates cleared without a single death in the raid.' },
  { id: 'guardian', group: 'Daily', label: 'Daily Guardian', period: 'day', unit: 'time', better: 'lower', sims: 40,
    desc: 'Fastest kill of today’s featured guardian. A new guardian every day at 10:00 UTC.' },
  { id: 'inferno', group: 'Challenges', label: 'Inferno Descent', period: 'week', unit: 'floor', better: 'higher', sims: 50,
    variants: [{ id: 'deepest', label: 'Deepest Floor' }, { id: 'fastest100', label: 'Fastest to 100', unit: 'time', better: 'lower', sims: 9 }],
    desc: 'How deep you went into the Inferno this week — and how fast the bravest reached the bottom.' },
  { id: 'pvp', group: 'Challenges', label: 'Proving Grounds', period: 'all', unit: 'rating', better: 'higher', sims: 50,
    desc: 'Proving Grounds rating. Bronze → Grandmaster.' },
  { id: 'stone', group: 'Just for Fun', label: 'Best Ability Stone', period: 'week', unit: 'stone', better: 'higher', sims: 40,
    desc: 'The best stones faceted this week. 9/7 is the dream; 10/10 is a legend.' },
  { id: 'honing', group: 'Just for Fun', label: 'Luckiest Honing', period: 'week', unit: 'luck', better: 'lower', sims: 40,
    desc: 'The least likely honing successes this week: high levels in very few taps.' },
  { id: 'seeds', group: 'Just for Fun', label: 'Most Pip Seeds', period: 'all', unit: 'count', better: 'higher', sims: 50,
    desc: `Pip Seeds found across Solmara (${SEED_TOTAL} hidden).` },
];
export const BOARD = Object.fromEntries(BOARDS.map(b => [b.id, b]));

/** Board + variant definition (variants may override unit / better / sims). */
export function defOf(board, variant) {
  const B = BOARD[board]; if (!B) return null;
  const V = B.variants?.find(v => v.id === variant) || B.variants?.[0] || null;
  return { ...B, ...(V || {}), id: B.id, label: B.label, variant: V?.id || '', variantLabel: V?.label || '', cls: V?.cls || null };
}
export const defaultVariant = board => BOARD[board]?.variants?.[0]?.id || '';

// ---------------------------------------------------------------------------------------------- periods
export const periodOf = (B, t = Date.now()) => (B.period === 'day' ? 'd' + dayId(t) : B.period === 'week' ? 'w' + weekId(t) : 'all');
export const periodStart = (B, t = Date.now()) => (B.period === 'day' ? dayId(t) * D + 10 * H : B.period === 'week' ? (weekId(t) * 7 + 6) * D + 10 * H : 0);
export const periodEnd = (B, t = Date.now()) => (B.period === 'day' ? periodStart(B, t) + D : B.period === 'week' ? periodStart(B, t) + W : Infinity);
export const weekStart = (t = Date.now()) => (weekId(t) * 7 + 6) * D + 10 * H;
/** Today's featured guardian (same rotation as the systems boards: GUARDIANS[dayId % n]). */
export function todaysGuardian(now = Date.now()) { const n = GUARDIANS.length; return GUARDIANS[((dayId(now) % n) + n) % n].id; }
export const bossName = id => BOSS_DEFS[id]?.name || String(id || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// ---------------------------------------------------------------------------------------------- values
export function fmtValue(unit, v) {
  switch (unit) {
    case 'time': return clock(v);
    case 'after': return '+' + dur(v);
    case 'dps': return short(v);
    case 'score': return String(Math.round(v));
    case 'floor': return `Floor ${Math.round(v)}`;
    case 'rating': return int(v);
    case 'stone': { const a = Math.floor(v / 100), b = Math.floor(v % 100); return stoneLabel(a, b); }
    case 'luck': return v > 0 ? `1 in ${int(Math.max(1, 1 / v))}` : '—';
    case 'count': return int(v);
    default: return String(v);
  }
}
export const stoneValue = (a, b, neg = 0) => a * 100 + b + (10 - Math.min(10, neg)) / 100;
const better = (def, a, b) => (b == null ? true : def.better === 'lower' ? a < b : a > b);
const cmp = def => (a, b) => (def.better === 'lower' ? a.value - b.value : b.value - a.value) || (a.t || 0) - (b.t || 0);

// ---------------------------------------------------------------------------------------------- the realm (SimPlayers)
// One pool of raiders per period (week / day / all-time). Each has a latent skill s (0 = best); every board draws a
// per-board performance u around it, so the same elite names top several boards, like a real server.
const poolCache = new Map();
function pool(period) {
  let p = poolCache.get(period); if (p) return p;
  const r = new RNG(hashStr('pool|' + period)); p = [];
  for (let i = 0; i < 160; i++) {
    const s = makeSim(hashStr(`raider|${period}|${i}`));
    p.push({ name: s.name, cls: s.cls, guild: s.guild, title: s.title, skill: Math.pow(r.next(), 1.15), k: i });
  }
  if (poolCache.size > 24) poolCache.clear();
  poolCache.set(period, p);
  return p;
}
const spread = (best, median, u, p = 1.1) => best * Math.pow(median / best, Math.pow(Math.max(0, u), p) / Math.pow(0.5, p));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pickParty = (r, n, cls) => {
  const out = [cls]; let sup = isSupport(cls) ? 1 : 0; const need = n >= 8 ? 2 : 1;
  while (out.length < n) { const wantSup = sup < need && n - out.length <= need - sup + 1; const c = r.pick(wantSup ? SUPPORT_CLASSES : DPS_CLASSES); if (isSupport(c)) sup++; out.push(c); }
  return out;
};
const GATE_T = { g1: [330, 660], g2: [400, 800] };
const GUARD_T = { rimewing: 1, cinderhorn: 1.12, sandmaw: 1.22, kurai: 1.32 };
const DPS_K = { reaver: 1, stormfist: 1.04, pistoleer: 1.06, starcaller: 1.08, bladedancer: 1.02, demonbound: 1.03 };
const hp = n => (n <= 15 ? 0.45 - 0.02 * n : n <= 20 ? 0.3 - 0.01 * n : Math.max(0.03, 0.26 - 0.009 * n));

const simCache = new Map();
/** Every SimPlayer entry of a board / variant / period (visibility by `at` is applied by the caller). */
function simEntries(B, def, period) {
  const key = `${B.id}|${def.variant}|${period}`;
  let list = simCache.get(key); if (list) return list;
  const r = new RNG(hashStr('sim|' + key));
  const start = periodStart(B, B.period === 'all' ? 0 : periodT(period)), len = B.period === 'day' ? D : W;
  // the same realm plays the dailies: daily boards draw from that week's raider pool
  let cands = pool(B.period === 'day' ? 'w' + weekId(periodT(period)) : period);
  if (def.cls) cands = cands.filter(p => p.cls === def.cls);
  else if (B.id === 'legion_support') cands = cands.filter(p => isSupport(p.cls));
  else if (/^legion|guardian|inferno/.test(B.id)) cands = cands.filter(p => !isSupport(p.cls) || r.next() < 0.5);
  const n = Math.min(def.sims ?? B.sims ?? 40, cands.length);
  const chosen = r.shuffle(cands.slice()).slice(0, n);
  list = [];
  for (const p of chosen) {
    const u = clamp(p.skill * 0.75 + r.next() * 0.25 + (r.next() - 0.5) * 0.1, 0, 1);
    const e = { name: p.name, cls: p.cls, guild: p.guild, title: p.title, sim: true, value: 0, sub: '', party: null, at: 0 };
    const posted = (minDelay = 0) => start + Math.min(len - 60e3, minDelay + Math.pow(clamp(0.55 * u + 0.45 * r.next(), 0, 1), 1.7) * (len - minDelay));
    const hard = B.id === 'legion_hm', k = hard ? 1.18 : 1;
    switch (B.id) {
      case 'legion_first': {
        const full = spread(760, 1480, u) * (r.next() < 0.25 ? 1.18 : 1);
        e.value = Math.min(len - 120e3, spread(1.25 * H, 30 * H, u, 1.15) + full * 1000);
        e.at = start + e.value; e.sub = `${r.next() < 0.25 ? 'Hard' : 'Normal'} · ${clock(full)}`; e.party = pickParty(r, 8, p.cls); break;
      }
      case 'legion_nm': case 'legion_hm': {
        const g = def.variant || 'full';
        if (g === 'full') {
          const t1 = spread(...GATE_T.g1, u) * k, t2 = spread(...GATE_T.g2, clamp(u + (r.next() - 0.5) * 0.12, 0, 1)) * k;
          e.value = t1 + t2; e.sub = `G1 ${clock(t1)} + G2 ${clock(t2)}`;
        } else {
          e.value = spread(...GATE_T[g], u) * k * (1 + (r.next() - 0.5) * 0.04);
          const deaths = r.next() < 0.45 - u * 0.2 ? 0 : 1 + Math.floor(r.next() * r.next() * 6);
          e.sub = `${deaths ? `${deaths} death${deaths > 1 ? 's' : ''}` : 'Deathless'} · avg iLvl ${int((hard ? 1452 : 1424) + (1 - u) * 26 + r.next() * 8)}`;
        }
        e.at = posted(e.value * 1000 + 20 * 60e3); e.party = pickParty(r, 8, p.cls); break;
      }
      case 'legion_dps': {
        const g = r.next() < 0.5 ? 1 : 2, hardRun = r.next() < 0.3;
        e.value = spread(8.2e6, 3.9e6, u, 1.05) * (DPS_K[def.cls] || 1) * (hardRun ? 1.04 : 1); e.at = posted(25 * 60e3);
        e.sub = `Gate ${g} · ${hardRun ? 'Hard' : 'Normal'}`; e.party = pickParty(r, 8, p.cls); break;
      }
      case 'legion_support': {
        const up = clamp(0.97 - u * 0.42 + (r.next() - 0.5) * 0.06, 0.35, 0.99);
        e.value = clamp(Math.round(98 - 58 * Math.pow(u, 1.25)), 30, 99); e.at = posted(25 * 60e3);
        e.sub = `Uptime ${pct(up)} · ${short(spread(2.4e7, 9e6, u))} shields`; e.party = pickParty(r, 8, p.cls); break;
      }
      case 'legion_deathless': {
        const g = r.next() < 0.55 ? 'g1' : 'g2', hardRun = r.next() < 0.3;
        e.value = spread(...GATE_T[g], clamp(u + 0.08, 0, 1)) * (hardRun ? 1.18 : 1) * 1.04; e.at = posted(e.value * 1000 + 20 * 60e3);
        e.sub = `Gate ${g === 'g1' ? 1 : 2} · ${hardRun ? 'Hard' : 'Normal'}`; e.party = pickParty(r, 8, p.cls); break;
      }
      case 'guardian': {
        const gid = todaysGuardian(start + H), tk = GUARD_T[gid] || 1.15;
        e.value = spread(72, 170, u) * tk * (1 + (r.next() - 0.5) * 0.05); e.at = posted(e.value * 1000 + 10 * 60e3);
        e.sub = r.next() < 0.6 ? 'Deathless' : `${1 + Math.floor(r.next() * 3)} death${r.next() < 0.5 ? '' : 's'}`; e.party = pickParty(r, 4, p.cls); break;
      }
      case 'inferno': {
        if (def.variant === 'fastest100') { e.value = spread(44 * 60, 62 * 60, u); e.at = posted(e.value * 1000 + H); e.sub = `${r.int(8, 14)} boons · ${int(r.int(2600, 4200))} kills`; }
        else { e.value = clamp(Math.round(104 - 96 * Math.pow(u, 0.85)), 3, 100); e.at = posted(e.value * 36e3); e.sub = `in ${clockOf(e.value * (34 + r.next() * 16))}`; }
        e.party = null; break;
      }
      case 'pvp': { e.value = Math.round(clamp(spread(2950, 1480, u, 0.9), 900, 3100)); e.sub = pvpTier(e.value); break; }
      case 'stone': {
        const a = u < 0.035 ? 10 : clamp(Math.round(9.7 - 5.6 * Math.pow(u, 0.75) + r.gauss() * 0.45), 4, 10);
        const b = clamp(Math.round(a - 0.5 - 3.4 * Math.pow(r.next(), 1.4) - u * 1.3), 2, a), neg = clamp(Math.round(r.next() * 5 * (0.35 + u)), 0, 7);
        const [e1, e2] = r.shuffle(COMBAT_ENGRAVINGS.slice()).slice(0, 2);
        e.value = stoneValue(a, b, neg); e.at = posted(); e.sub = `${ENGRAVINGS[e1]?.name} ${a} · ${ENGRAVINGS[e2]?.name} ${b} · −${neg}`; break;
      }
      case 'honing': {
        const lvl = 12 + Math.floor(Math.pow(r.next(), 0.7) * 14), taps = 1 + Math.floor(-Math.log(1 - r.next() * 0.999) * 1.1);
        e.value = 1 - Math.pow(1 - hp(lvl), taps); e.at = posted(); e.sub = `+${lvl} in ${taps} tap${taps > 1 ? 's' : ''}`; break;
      }
      case 'seeds': { e.value = Math.round(clamp(spread(SEED_TOTAL + 4, SEED_TOTAL * 0.45, u, 1.1), 3, SEED_TOTAL)); e.sub = `${pct(e.value / SEED_TOTAL)} of Solmara`; break; }
    }
    if (B.period === 'all') e.at = 0;
    e.t = e.at;
    list.push(e);
  }
  if (simCache.size > 80) simCache.clear();
  simCache.set(key, list);
  return list;
}
const clockOf = s => clock(s).replace(/\.\d$/, '');
/** representative timestamp inside a period id ('w2912' / 'd20432'), for seeding and start times */
function periodT(period) {
  const n = +period.slice(1);
  return period[0] === 'd' ? n * D + 10 * H + H : period[0] === 'w' ? (n * 7 + 6) * D + 10 * H + H : 0;
}

// ---------------------------------------------------------------------------------------------- remote (Supabase)
let remote = null, remoteTried = false;
const remoteCache = new Map();            // `${board}|${variant}` → { t, rows, busy }
export const remoteState = { enabled: false, ok: null, error: null };
const listeners = new Set();
export const onBoardsChanged = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const changed = () => { for (const fn of listeners) { try { fn(); } catch (e) { console.warn('[meta boards]', e); } } };
function getRemote() {
  if (!remoteTried) { remoteTried = true; try { remote = makeRemote(); } catch { remote = null; } remoteState.enabled = !!remote; }
  return remote;
}
function remoteRows(board, variant) {
  const R = getRemote(); if (!R) return [];
  const key = `${board}|${variant}`, c = remoteCache.get(key) || { t: 0, rows: [] };
  if (!c.busy && Date.now() - c.t > 60e3) {
    c.busy = true; remoteCache.set(key, c);
    R.top(board, variant).then(rows => { c.rows = rows; c.t = Date.now(); remoteState.ok = true; remoteState.error = null; })
      .catch(e => { c.t = Date.now(); if (!(e.status >= 400 && e.status < 500)) { remoteState.ok = false; remoteState.error = e.message; } })
      .finally(() => { c.busy = false; changed(); });
  }
  return c.rows;
}

// ---------------------------------------------------------------------------------------------- views
/**
 * boardView(board, variant?, { now, limit }) → { def, period, start, end, rows: [Row], you: Row|null, total, online, guardian? }
 * Row = { rank, name, cls, guild, value, display, sub, party, you, friend, sim, remote, premade, trial, coop, t }
 */
export function boardView(board, variant, { now = Date.now(), limit = 50 } = {}) {
  const def = defOf(board, variant); if (!def) return null;
  const B = BOARD[board], period = periodOf(B, now);
  const all = [];
  for (const e of simEntries(B, def, period)) if (e.at <= now) all.push(e);
  for (const e of db().entries) if (e.board === board && (e.variant || '') === def.variant && e.period === period) all.push(e);
  for (const e of remoteRows(board, def.variant)) all.push(e);
  // one row per player (best value); your own entries win ties with the same name from the global board
  const best = new Map();
  for (const e of all) {
    const k = String(e.name).toLowerCase(), cur = best.get(k);
    if (!cur || better(def, e.value, cur.value) || (e.value === cur.value && e.you && !cur.you)) best.set(k, e);
  }
  const rows = [...best.values()].sort(cmp(def)).map((e, i) => ({ rank: i + 1, name: e.name, cls: e.cls, guild: e.guild || null, value: e.value, display: fmtValue(def.unit, e.value),
    sub: e.sub || '', party: e.party || null, you: !!e.you, friend: !!e.friend, sim: !!e.sim, remote: !!e.remote, premade: !!e.premade, trial: !!e.trial, coop: !!e.coop, t: e.t || 0 }));
  const mine = rows.filter(r => r.you), you = mine[0] || null;
  const shown = rows.slice(0, limit);
  for (const m of mine) if (m.rank > limit) shown.push(m);
  return { def, period, start: periodStart(B, now), end: periodEnd(B, now), rows: shown, you, total: rows.length, online: remoteState.enabled && remoteState.ok !== false,
    ...(board === 'guardian' ? { guardian: todaysGuardian(now), guardianName: bossName(todaysGuardian(now)) } : {}) };
}

/** Your best entry on a board this period (any of your characters), or a named character's. */
export function myBest(board, variant, name = null, now = Date.now()) {
  const def = defOf(board, variant); if (!def) return null;
  const period = periodOf(BOARD[board], now);
  let bestE = null;
  for (const e of db().entries) if (e.you && e.board === board && (e.variant || '') === def.variant && e.period === period && (!name || e.name === name)) if (!bestE || better(def, e.value, bestE.value)) bestE = e;
  return bestE;
}

// ---------------------------------------------------------------------------------------------- submitting
/**
 * submit({ board, variant, value, name, cls, guild?, title?, sub?, party?, premade?, trial?, coop?, extra?, t? })
 * → { entry, rank, total, improved, prev } | null. Stores locally, posts to the global board when configured.
 */
export function submit(e) {
  const def = defOf(e.board, e.variant); if (!def || !(typeof e.value === 'number' && isFinite(e.value)) || !e.name) return null;
  const B = BOARD[e.board], now = e.t || Date.now(), period = periodOf(B, now);
  const prev = myBest(e.board, def.variant, e.name, now);
  const entry = { id: rid(), board: e.board, variant: def.variant, period, t: now, name: String(e.name).slice(0, 16), cls: e.cls, guild: e.guild || null, title: e.title || null,
    value: e.value, sub: e.sub || '', party: e.party || null, premade: !!e.premade, trial: !!e.trial, coop: !!e.coop, extra: e.extra || null, you: true };
  const improved = !prev || better(def, entry.value, prev.value);
  const D0 = db();
  // keep only improvements (plus the first entry): the board shows bests, the store stays small
  if (improved) { D0.entries.push(entry); prune(D0, now); saveDb(); }
  const R = getRemote();
  if (R && improved) R.submit(entry).then(res => { entry.remoteRank = res?.rank ?? null; remoteState.ok = true; remoteCache.delete(`${e.board}|${def.variant}`); changed(); })
    .catch(err => { if (!(err.status >= 400 && err.status < 500)) { remoteState.ok = false; remoteState.error = err.message; changed(); } });   // 4xx = entry rejected (rate limit / validation), not an outage
  const v = boardView(e.board, def.variant, { now, limit: 1e9 });
  const row = v.rows.find(r => r.you && r.name === entry.name);
  changed();
  return { entry, rank: row?.rank ?? null, total: v.total, improved, prev: prev?.value ?? null, def };
}
/** Entries a co-op friend shared (their browser posted them): shown on your boards with a friend tag. */
export function addFriendEntries(list) {
  const D0 = db(); let n = 0;
  const have = new Set(D0.entries.map(x => `${x.board}|${x.variant}|${x.period}|${x.name}|${x.value}`));
  for (const x of list || []) {
    if (!x || !BOARD[x.board] || !x.name || !isFinite(x.value)) continue;
    const k = `${x.board}|${x.variant || ''}|${x.period}|${x.name}|${x.value}`; if (have.has(k)) continue;
    D0.entries.push({ ...x, variant: x.variant || '', id: rid('f'), you: false, friend: true }); have.add(k); n++;
  }
  if (n) { prune(D0, Date.now()); saveDb(); changed(); }
  return n;
}
/** Your entries for the current periods (what you share with friends in co-op). */
export function shareableEntries(now = Date.now()) {
  return db().entries.filter(e => e.you && e.period === periodOf(BOARD[e.board] || {}, now)).slice(-80).map(({ id, you, extra, ...x }) => x);
}
function prune(D0, now) {
  const keep = D0.entries.filter(e => {
    const B = BOARD[e.board]; if (!B) return false;
    if (B.period === 'all') return true;
    const cur = periodOf(B, now), prevP = periodOf(B, B.period === 'day' ? now - D : now - W);
    return e.period === cur || e.period === prevP;
  });
  // all-time boards: only each name's best survives
  const bestAll = new Map();
  for (const e of keep) if (BOARD[e.board].period === 'all') { const def = defOf(e.board, e.variant), k = `${e.board}|${e.variant}|${e.name}`; const c = bestAll.get(k); if (!c || better(def, e.value, c.value)) bestAll.set(k, e); }
  D0.entries = keep.filter(e => BOARD[e.board].period !== 'all' || bestAll.get(`${e.board}|${e.variant}|${e.name}`) === e).slice(-900);
}

// ---------------------------------------------------------------------------------------------- the UI window (src/ui/windows/social.js)
/** Flattened board list for the UI's leaderboards window: gate / inferno variants become their own tabs, classes stay subs. */
export function windowBoards() {
  const out = [];
  for (const B of BOARDS) {
    if (B.classVariants) out.push({ id: B.id, label: B.label, group: B.group, subs: B.variants.map(v => ({ id: v.id, label: v.label })) });
    else if (B.variants) for (const v of B.variants) out.push({ id: `${B.id}:${v.id}`, label: B.id.startsWith('legion_') ? `${B.label.replace('Fastest · ', '')} · ${v.label}` : v.label, group: B.group });
    else out.push({ id: B.id, label: B.id === 'guardian' ? `Daily: ${bossName(todaysGuardian())}` : B.label, group: B.group });
  }
  return out;
}
/** Parse a UI board id ('legion_nm:g1', 'legion_dps' + sub) into { board, variant }. */
export function parseBoardId(id, sub) {
  const [board, v] = String(id || '').split(':');
  if (!BOARD[board]) return { board: 'legion_first', variant: '' };
  return { board, variant: v || sub || defaultVariant(board) };
}
/** Data for ui.open('leaderboards', …) in the UI owner's window shape. */
export function windowData(board = 'legion_first', variant = '', now = Date.now()) {
  const v = boardView(board, variant, { now }); if (!v) return null;
  const B = BOARD[board];
  const id = B.classVariants || !B.variants ? board : `${board}:${v.def.variant}`;
  const left = v.end - now;
  const note = `${v.online ? 'Global' : 'Local realm'} · ${B.period === 'all' ? 'all time' : `resets in ${dur(left)}`} · ${int(v.total)} entries${board === 'guardian' ? ` · today: ${v.guardianName}` : ''}`;
  return {
    board: id, sub: B.classVariants ? v.def.variant : undefined, boards: windowBoards(), note,
    rows: v.rows.map(r => ({ rank: r.rank, name: r.name, cls: r.cls, value: r.display, sub: [r.sub, r.trial && 'Trial', r.premade && 'Premade', r.friend && 'Friend'].filter(Boolean).join(' · '), you: r.you, party: r.party || undefined, date: r.t || undefined })),
    you: v.you ? { rank: v.you.rank, value: v.you.display } : undefined,
  };
}
