// Wayfarer's Tasks (daily), weekly tasks, Wayfarer reputation, the `track` hub every event flows through (tasks →
// titles/achievements → guild missions), and the world event calendar ("compass"): Field Boss hourly at :00, Chaos
// Gate at :30, Adventure Island every 2 h at :00 (UTC), Ghost Ship on Thursdays & Sundays.
// State: roster.tasks = { day, week, daily: TaskSet, weekly: TaskSet, rep: { pts, claimed: [lv] }, done }.
import { DAILY_TASKS, WEEKLY_TASKS, DAILY_OFFER, DAILY_PICK, WEEKLY_OFFER, WEEKLY_PICK, REP_LEVELS, REP_REWARDS, EVENTS } from '../../data/tasks.js';
import { ISLANDS, ADVENTURE_ISLANDS } from '../../data/collectibles.js';
import { ISLAND_LOOT } from '../../data/loot.js';
import { RNG } from '../../core/noise.js';
import { dayId, weekId, nextDaily, nextWeekly } from '../../core/util.js';
import { track as titlesTrack } from './titles.js';
import { guildTrack } from './guild.js';
import { ok, fail, grantBundle, bundleRows, rosterSeed, onTrack, itemInfo, MIN, HOUR, DAY } from './common.js';

const TPL = Object.fromEntries([...DAILY_TASKS, ...WEEKLY_TASKS].map(t => [t.id, t]));
const freshSet = () => ({ offered: [], accepted: [], progress: {}, claimed: [] });

/** Normalised task state with daily/weekly offers rolled for `now`. */
export function state(account, now = Date.now()) {
  const r = account.roster, T = r.tasks ||= {};
  T.rep ||= { pts: 0, claimed: [] }; T.done ??= 0;
  const d = dayId(now), w = weekId(now), seed = rosterSeed(account);
  if (T.day !== d || !T.daily) {
    const rng = new RNG(seed ^ (d * 2654435761 >>> 0));
    T.day = d; T.daily = { ...freshSet(), offered: rng.shuffle(DAILY_TASKS.map(t => t.id)).slice(0, DAILY_OFFER) };
  }
  if (T.week !== w || !T.weekly) {
    const rng = new RNG(seed ^ (w * 40503 + 7));
    T.week = w; T.weekly = { ...freshSet(), offered: rng.shuffle(WEEKLY_TASKS.map(t => t.id)).slice(0, WEEKLY_OFFER) };
  }
  return T;
}
const setOf = (T, id) => DAILY_TASKS.some(t => t.id === id) ? { set: T.daily, max: DAILY_PICK, kind: 'daily' } : { set: T.weekly, max: WEEKLY_PICK, kind: 'weekly' };
const taskRow = (T, id, set) => { const t = TPL[id]; const n = Math.min(t.need, set.progress[id] || 0); return { id, tpl: id, name: t.name, desc: t.desc.replace('{n}', t.need.toLocaleString('en-US')), event: t.events.join('|'), need: t.need, n, done: n >= t.need, claimed: set.claimed.includes(id), accepted: set.accepted.includes(id), rows: bundleRows(t.reward), rep: t.rep }; };
const repLevel = pts => { let lv = 1; for (let i = 0; i < REP_LEVELS.length; i++) if (pts >= REP_LEVELS[i]) lv = i + 1; return lv; };

export function accept(account, taskId, now = Date.now()) {
  const T = state(account, now); if (!TPL[taskId]) return fail('unknown', 'Unknown task.');
  const { set, max } = setOf(T, taskId);
  if (!set.offered.includes(taskId)) return fail('offer', 'That task is not on the board today.');
  if (set.accepted.includes(taskId)) return fail('accepted', 'Already accepted.');
  if (set.accepted.length >= max) return fail('limit', `You can take ${max} tasks at a time.`);
  set.accepted.push(taskId); account.save();
  return ok({});
}
export function abandon(account, taskId, now = Date.now()) {
  const T = state(account, now); const { set } = setOf(T, taskId);
  if (!set.accepted.includes(taskId)) return fail('none', 'You have not accepted that task.');
  if (set.claimed.includes(taskId)) return fail('claimed', 'Already completed.');
  set.accepted = set.accepted.filter(x => x !== taskId); delete set.progress[taskId]; account.save();
  return ok({});
}
export function claim(account, char, taskId, now = Date.now()) {
  const T = state(account, now); const t = TPL[taskId]; if (!t) return fail('unknown', 'Unknown task.');
  const { set, kind } = setOf(T, taskId);
  if (!set.accepted.includes(taskId)) return fail('none', 'You have not accepted that task.');
  if (set.claimed.includes(taskId)) return fail('claimed', 'Already claimed.');
  if ((set.progress[taskId] || 0) < t.need) return fail('progress', 'The task is not complete yet.');
  set.claimed.push(taskId); T.done++;
  const before = repLevel(T.rep.pts); T.rep.pts += t.rep;
  const rows = grantBundle(account, char, t.reward);
  const notes = [];
  if (repLevel(T.rep.pts) > before) notes.push({ kind: 'rep', text: `Wayfarer reputation level ${repLevel(T.rep.pts)}!` });
  if (kind === 'daily') notes.push(...track(account, char, 'taskDone', { task: taskId, now }));
  account.save();
  return ok({ rows, rep: t.rep, notes });
}
export function claimRep(account, char, level) {
  const T = state(account); const lv = repLevel(T.rep.pts);
  if (!REP_REWARDS[level]) return fail('unknown', 'No reward at that level.');
  if (level > lv) return fail('level', `Reach reputation level ${level} first.`);
  if (T.rep.claimed.includes(level)) return fail('claimed', 'Already claimed.');
  T.rep.claimed.push(level);
  return ok({ rows: grantBundle(account, char, REP_REWARDS[level]) });
}
function matches(t, event, data) {
  if (!t.events.includes(event)) return false;
  for (const [k, v] of Object.entries(t.match)) { const x = data[k]; if (Array.isArray(v) ? !v.includes(x) : x !== v) return false; }
  return true;
}
const amountOf = (t, data) => t.amount === 'dist' ? Math.max(0, data.dist || 0) : t.amount === 'count' ? Math.max(1, data.count || 1) : 1;

/**
 * The tracking hub. World events come from the game (kill, clear, sail, pvp, death, login, zone, boss_part);
 * systems functions emit their own (hone, facet, buy, sell, craft, dispatch, gather, song, emote, gift, …).
 * → notifications [{ kind, text, id? }]
 */
export function track(account, char, event, data = {}) {
  const now = data.now ?? Date.now();
  const T = state(account, now), out = [];
  for (const [set, kind] of [[T.daily, 'daily'], [T.weekly, 'weekly']]) {
    for (const id of set.accepted) {
      const t = TPL[id]; if (set.claimed.includes(id) || !matches(t, event, data)) continue;
      const was = set.progress[id] || 0; if (was >= t.need) continue;
      set.progress[id] = Math.min(t.need, was + amountOf(t, data));
      if (set.progress[id] >= t.need) out.push({ kind: kind === 'daily' ? 'taskDone' : 'weekly', id, text: `${kind === 'daily' ? 'Wayfarer’s Task' : 'Weekly task'} complete: ${t.name}` });
    }
  }
  out.push(...titlesTrack(account, char, event, data));
  out.push(...guildTrack(account, char, event, data));
  account.save();
  return out;
}
onTrack(track);

export function view(account, now = Date.now()) {
  const T = state(account, now), lv = repLevel(T.rep.pts);
  return {
    day: T.day, week: T.week,
    daily: { offered: T.daily.offered.map(id => taskRow(T, id, T.daily)), accepted: T.daily.accepted.slice(), max: DAILY_PICK, done: T.daily.claimed.length },
    weekly: { offered: T.weekly.offered.map(id => taskRow(T, id, T.weekly)), accepted: T.weekly.accepted.slice(), max: WEEKLY_PICK, done: T.weekly.claimed.length },
    rep: { level: lv, pts: T.rep.pts, next: REP_LEVELS[lv] ?? null, max: REP_LEVELS.length,
      rewards: Object.entries(REP_REWARDS).map(([l, b]) => ({ level: +l, rows: bundleRows(b), claimed: T.rep.claimed.includes(+l), ready: +l <= lv && !T.rep.claimed.includes(+l) })) },
  };
}

// ------------------------------------------------------------------------------------------------ calendar
const islandAt = start => { const slot = Math.floor(start / (2 * HOUR)); const id = ADVENTURE_ISLANDS[((slot % ADVENTURE_ISLANDS.length) + ADVENTURE_ISLANDS.length) % ADVENTURE_ISLANDS.length]; return { id, name: ISLANDS[id].name, focus: ISLANDS[id].focus }; };
function make(kind, start, now) {
  const E = EVENTS[kind], end = start + E.dur * MIN, live = now >= start && now < end;
  const h = Math.floor(start / HOUR);
  const ev = { id: `${kind}:${start}`, kind, name: E.name, where: E.where[h % E.where.length], start, end, live, left: live ? end - now : start - now, rows: E.rows.map(id => ({ id, name: itemInfo(id).name })) };
  if (kind === 'island') { ev.island = islandAt(start); ev.name = `Adventure Island: ${ev.island.name}`; ev.where = ev.island.name; ev.rows = [{ id: ev.island.focus, name: ISLAND_LOOT[ev.island.focus]?.name || ev.island.focus }, { id: 'tokens', name: itemInfo('tokens').name }]; }
  return ev;
}
function occurrences(kind, from, to) {
  const E = EVENTS[kind], out = [];
  if (E.every) {
    const step = E.every * MIN;
    let t = Math.floor((from - E.at * MIN) / step) * step + E.at * MIN;
    for (; t <= to; t += step) if (t + E.dur * MIN > from) out.push(t);
  } else {
    for (let d = Math.floor(from / DAY) - 1; d * DAY <= to; d++) {
      const dow = (d + 4) % 7; // 1970-01-01 was a Thursday (dow 4)
      if (!E.days.includes(dow)) continue;
      for (const h of E.hours) { const t = d * DAY + h * HOUR; if (t + E.dur * MIN > from && t <= to) out.push(t); }
    }
  }
  return out;
}
/** Upcoming + live events within the next `hours`, sorted by start. */
export function calendar(now = Date.now(), { hours = 6 } = {}) {
  const out = [];
  for (const kind of Object.keys(EVENTS)) for (const t of occurrences(kind, now, now + hours * HOUR)) out.push(make(kind, t, now));
  return out.sort((a, b) => a.start - b.start || a.kind.localeCompare(b.kind));
}
export function live(now = Date.now()) { return calendar(now, { hours: 0 }).filter(e => e.live); }
/** The live window of `kind` now, or the next one (within 8 days). */
export function eventWindow(kind, now = Date.now()) {
  const list = occurrences(kind, now, now + 8 * DAY).map(t => make(kind, t, now));
  return list.find(e => e.live) || list[0] || null;
}
export function compass(account, now = Date.now()) {
  const cal = calendar(now, { hours: 26 });
  return { now, live: cal.filter(e => e.live), next: cal.filter(e => !e.live).slice(0, 8), resets: { daily: nextDaily(now), weekly: nextWeekly(now) } };
}
