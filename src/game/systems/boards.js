// Local leaderboards: weekly (or daily) boards with deterministic SimPlayer competitors plus your personal bests.
// boardsTrack() is fed by tasks.track (raid/guardian clears, inferno floors, pvp, honing luck, stones, seeds).
// State: roster.boards[boardId] = { period, value, t, char: { name, cls }, extra }.
import { makeSim } from '../social/names.js';
import { RNG, hashStr } from '../../core/noise.js';
import { dayId, weekId } from '../../core/util.js';
import { GUARDIANS } from '../../data/raids.js';
import { ok, fail } from './common.js';

export const BOARDS = [
  { id: 'legion_nm', name: 'Legion Race — Gorrath (Normal)', desc: 'Fastest full clear this week.', unit: 'time', better: 'lower' },
  { id: 'legion_hm', name: 'Legion Race — Gorrath (Hard)', desc: 'Fastest full clear this week.', unit: 'time', better: 'lower' },
  { id: 'guardian', name: 'Daily Guardian Hunt', desc: 'Fastest kill of today’s guardian.', unit: 'time', better: 'lower', daily: true },
  { id: 'inferno', name: 'Inferno Descent', desc: 'Deepest floor this week.', unit: 'floor', better: 'higher' },
  { id: 'pvp', name: 'Proving Grounds', desc: 'Highest rating.', unit: 'rating', better: 'higher' },
  { id: 'honing_luck', name: 'Luckiest Honing', desc: 'Lowest-chance first-try success this week.', unit: 'luck', better: 'lower' },
  { id: 'best_stone', name: 'Best Ability Stone', desc: 'Most positive nodes on one stone this week.', unit: 'stone', better: 'higher' },
  { id: 'seeds', name: 'Most Pip Seeds', desc: 'Pip Seeds found, ever.', unit: 'count', better: 'higher' },
];
const BY_ID = Object.fromEntries(BOARDS.map(b => [b.id, b]));
export const list = () => BOARDS.map(b => ({ ...b }));
/** today's featured guardian for the daily board */
export const todaysGuardian = (now = Date.now()) => GUARDIANS[((dayId(now) % GUARDIANS.length) + GUARDIANS.length) % GUARDIANS.length].id;
const period = (B, now) => B.daily ? `d${dayId(now)}` : B.id === 'seeds' ? 'all' : `w${weekId(now)}`;
const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
export function display(unit, v) {
  if (unit === 'time') return mmss(v);
  if (unit === 'floor') return `Floor ${v}`;
  if (unit === 'luck') return `${(v * 100).toFixed(1)}%`;
  if (unit === 'stone') { const a = Math.floor(v / 100), b = Math.floor(v % 100); return a >= 10 || b >= 10 ? `${a}/${b}` : `${a}${b}`; }
  return Math.round(v).toLocaleString('en-US');
}
function simValue(B, r) {
  switch (B.id) {
    case 'legion_nm': return Math.round(760 + r.next() * r.next() * 900);
    case 'legion_hm': return Math.round(1000 + r.next() * r.next() * 1100);
    case 'guardian': return Math.round(110 + r.next() * r.next() * 330);
    case 'inferno': return Math.round(15 + Math.pow(r.next(), 0.7) * 85);
    case 'pvp': return Math.round(1000 + Math.pow(r.next(), 1.6) * 1700);
    case 'honing_luck': return Math.round((0.03 + r.next() * r.next() * 0.2) * 1000) / 1000;
    case 'best_stone': { const a = r.int(6, 10), b = r.int(4, Math.min(10, a)); return a * 100 + b; }
    case 'seeds': return Math.round(10 + Math.pow(r.next(), 0.8) * 110);
    default: return 0;
  }
}
const better = (B, a, b) => b == null || (B.better === 'lower' ? a < b : a > b);
export function view(account, boardId, now = Date.now()) {
  const B = BY_ID[boardId]; if (!B) return null;
  const p = period(B, now), r = new RNG(hashStr(`${B.id}:${p}`));
  const rows = Array.from({ length: 30 }, (_, i) => { const s = makeSim(hashStr(`${B.id}:${p}:${i}`)); return { name: s.name, cls: s.cls, guild: s.guild, value: simValue(B, r), you: false, sim: true }; });
  const mine = account.roster.boards?.[boardId];
  if (mine && mine.period === p) rows.push({ name: mine.char?.name || account.roster.name || 'You', cls: mine.char?.cls || 'reaver', guild: account.roster.guild?.name || null, value: mine.value, you: true, sim: false });
  rows.sort((a, b) => B.better === 'lower' ? a.value - b.value : b.value - a.value);
  const entries = rows.map((x, i) => ({ rank: i + 1, ...x, display: display(B.unit, x.value) }));
  const you = entries.find(e => e.you) || null;
  return { id: B.id, name: B.name, desc: B.desc, unit: B.unit, week: weekId(now), period: p, entries, you: you ? { rank: you.rank, value: you.value, display: you.display } : null, ...(B.id === 'guardian' ? { guardian: todaysGuardian(now) } : {}) };
}
export function submit(account, char, boardId, value, now = Date.now()) {
  const B = BY_ID[boardId]; if (!B) return fail('unknown', 'Unknown board.');
  if (!(typeof value === 'number' && isFinite(value))) return fail('value', 'Invalid value.');
  const r = account.roster; r.boards ||= {};
  const p = period(B, now), cur = r.boards[boardId];
  const improved = !cur || cur.period !== p || better(B, value, cur.value);
  if (improved) { r.boards[boardId] = { period: p, value, t: now, char: char ? { name: char.name, cls: char.cls } : null }; account.save(); }
  const v = view(account, boardId, now);
  return ok({ improved, best: r.boards[boardId].value, rank: v.you?.rank ?? null });
}
/** tasks.track fan-out: auto-submit personal bests from events. */
export function boardsTrack(account, char, event, d = {}) {
  const now = d.now ?? Date.now(), out = [];
  const sub = (id, v) => { const res = submit(account, char, id, v, now); if (res.ok && res.improved && res.rank && res.rank <= 10) out.push({ kind: 'board', text: `New personal best on ${BY_ID[id].name}: rank ${res.rank}!` }); };
  if (event === 'clear' && d.content === 'raid' && d.time && (d.gate == null || d.gate >= 1)) sub(d.mode === 'hard' ? 'legion_hm' : 'legion_nm', d.time);
  if (event === 'clear' && d.content === 'guardian' && d.time && d.id === todaysGuardian(now)) sub('guardian', d.time);
  if (event === 'clear' && d.content === 'inferno' && (d.floor || d.tier)) sub('inferno', d.floor || d.tier);
  if (event === 'pvp' && account.roster.pvp?.rating) sub('pvp', account.roster.pvp.rating);
  if (event === 'hone' && d.success && !d.guaranteed && d.taps === 1) sub('honing_luck', Math.round(d.chance * 1000) / 1000);
  if (event === 'facet' && d.done && d.score) { const [a, b] = [d.score[0], d.score[1]].sort((x, y) => y - x); sub('best_stone', a * 100 + b); }
  if (event === 'collect' && d.type === 'seeds') sub('seeds', d.have);
  return out;
}
