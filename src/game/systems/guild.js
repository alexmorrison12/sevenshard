// Guilds: 12 AI guilds (deterministic), join / leave / create, daily donations (silver/gold → bloodstones + guild xp),
// research perks by guild level, weekly missions (AI members contribute over the week; your tracked events add to it).
// State: roster.guild (null when guildless), roster.guildLeft (re-join cooldown). Guild shop: shops.js 'guild'.
import { AI_GUILDS, GUILD_MAX_LEVEL, guildXpFor, memberCap, CREATE_COST, DONATIONS, GUILD_RESEARCH, GUILD_MISSIONS } from '../../data/guilds.js';
import { simName } from '../social/names.js';
import { RNG, hashStr } from '../../core/noise.js';
import { dayId, weekId } from '../../core/util.js';
import { ok, fail, pay, grantBundle, bundleRows, emit, HOUR, DAY, clamp } from './common.js';

export { AI_GUILDS, GUILD_RESEARCH, GUILD_MISSIONS };
const CLS = ['reaver', 'oathkeeper', 'stormfist', 'pistoleer', 'starcaller', 'songweaver', 'bladedancer', 'demonbound'];
const WEEK = 7 * DAY;
const weekStart = now => (weekId(now) * 7 + 6) * DAY + 10 * HOUR;

function leaderOf(g) { return simName(new RNG(hashStr('guild:' + g.id))); }
export function list(account, now = Date.now()) {
  const mine = account.roster.guild;
  const rows = AI_GUILDS.map(g => ({ id: g.id, name: g.name, tag: g.tag, level: g.level, members: g.members, max: memberCap(g.level), motto: g.motto, focus: g.focus, leader: leaderOf(g), recruiting: g.members < memberCap(g.level), joined: mine?.id === g.id }));
  if (mine?.own) rows.unshift({ id: mine.id, name: mine.name, tag: mine.tag, level: mine.level, members: mine.members, max: memberCap(mine.level), motto: mine.motto, focus: 'social', leader: account.roster.name || 'You', recruiting: true, joined: true });
  return rows;
}
function addXp(g, n) {
  g.xp += Math.max(0, Math.round(n));
  while (g.level < GUILD_MAX_LEVEL && g.xp >= guildXpFor(g.level)) { g.xp -= guildXpFor(g.level); g.level++; }
  if (g.level >= GUILD_MAX_LEVEL) g.xp = Math.min(g.xp, guildXpFor(g.level));
}
/** Bring the guild up to `now`: AI members' xp, own-guild recruits, the weekly mission set. */
function sync(account, now) {
  const g = account.roster.guild; if (!g) return null;
  g.t ??= now;
  const hours = Math.max(0, now - g.t) / HOUR;
  if (hours > 0) { addXp(g, hours * Math.max(1, g.members - 1) * 25); if (g.own) g.members = Math.min(memberCap(g.level), g.members + Math.floor(hours / 12)); g.t = now; }
  const wk = weekId(now);
  if (!g.missions || g.missions.week !== wk) {
    const rng = new RNG(hashStr(`${g.id}:${wk}`)), pool = GUILD_MISSIONS.map(m => m.id);
    rng.shuffle(pool);
    g.missions = { week: wk, ids: pool.slice(0, 3), mine: {}, claimed: [] };
  }
  const d = dayId(now); if (!g.donated || g.donated.day !== d) g.donated = { day: d, silver: false, gold: false };
  return g;
}
const aiRate = g => clamp(g.members / 60, 0.25, 1.1) * (0.8 + g.level / 50);
function missionRows(g, now) {
  const frac = clamp((now - weekStart(now)) / WEEK, 0, 1);
  return g.missions.ids.map(id => {
    const M = GUILD_MISSIONS.find(m => m.id === id);
    const ai = Math.floor(M.need * frac * aiRate(g) * (0.85 + (hashStr(`${g.id}:${id}:${g.missions.week}`) % 30) / 100));
    const progress = Math.min(M.need, ai + (g.missions.mine[id] || 0));
    return { id, name: M.name, desc: M.desc.replace('{need}', M.need), progress, need: M.need, done: progress >= M.need, claimed: g.missions.claimed.includes(id), rows: bundleRows(M.reward), mine: g.missions.mine[id] || 0 };
  });
}
export function join(account, id, now = Date.now()) {
  const r = account.roster;
  if (r.guild) return fail('member', 'Leave your current guild first.');
  if (r.guildLeft && now - r.guildLeft < DAY) return fail('cooldown', 'You recently left a guild. Try again tomorrow.', { until: r.guildLeft + DAY });
  const G = AI_GUILDS.find(g => g.id === id); if (!G) return fail('unknown', 'No such guild.');
  if (G.members >= memberCap(G.level)) return fail('full', `${G.name} is full.`);
  r.guild = { id: G.id, name: G.name, tag: G.tag, motto: G.motto, own: false, joined: now, rank: 'Member', level: G.level, xp: Math.floor(guildXpFor(G.level) * ((hashStr(G.id) % 70) / 100)), members: G.members + 1, contribution: 0, t: now };
  sync(account, now); account.save();
  return ok({ guild: r.guild });
}
export function leave(account, now = Date.now()) {
  const r = account.roster; if (!r.guild) return fail('none', 'You are not in a guild.');
  const name = r.guild.name; r.guild = null; r.guildLeft = now; account.save();
  return ok({ left: name });
}
export function create(account, { name, motto = '' } = {}, now = Date.now()) {
  const r = account.roster;
  if (r.guild) return fail('member', 'Leave your current guild first.');
  name = String(name || '').trim();
  if (name.length < 3 || name.length > 24) return fail('name', 'Guild names are 3–24 characters.');
  if (AI_GUILDS.some(g => g.name.toLowerCase() === name.toLowerCase())) return fail('taken', 'That guild name is taken.');
  if (!pay(account, CREATE_COST)) return fail('materials', 'Founding a guild costs 20,000 silver.');
  const tag = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'GLD';
  r.guild = { id: 'own', name, tag, motto: String(motto).slice(0, 80), own: true, joined: now, rank: 'Master', level: 1, xp: 0, members: 1, contribution: 0, t: now, focus: 'blessing' };
  sync(account, now); account.save();
  return ok({ guild: r.guild });
}
export function donate(account, char, kind, tier = 0, now = Date.now()) {
  const g = sync(account, now); if (!g) return fail('none', 'Join a guild first.');
  const D = kind === 'silver' ? DONATIONS.silver : DONATIONS.gold[tier];
  if (!D || (kind !== 'silver' && kind !== 'gold')) return fail('kind', 'Unknown donation.');
  if (g.donated[kind]) return fail('limit', 'You already donated that today.');
  if (!pay(account, D.cost)) return fail('materials', `Not enough ${kind}.`);
  g.donated[kind] = true;
  account.give('bloodstone', D.bloodstones);
  addXp(g, D.xp); g.contribution += D.xp;
  account.save();
  const notes = emit(account, char, 'donate', { kind, tier });
  return ok({ bloodstones: D.bloodstones, xp: D.xp, notes });
}
export function claimMission(account, char, missionId, now = Date.now()) {
  const g = sync(account, now); if (!g) return fail('none', 'Join a guild first.');
  const row = missionRows(g, now).find(m => m.id === missionId);
  if (!row) return fail('unknown', 'That mission is not active this week.');
  if (row.claimed) return fail('claimed', 'Already claimed.');
  if (!row.done) return fail('progress', 'The mission is not complete yet.');
  const M = GUILD_MISSIONS.find(m => m.id === missionId);
  g.missions.claimed.push(missionId); addXp(g, M.xp);
  const rows = grantBundle(account, char, M.reward);
  return ok({ rows });
}
export function setResearch(account, id) {
  const g = account.roster.guild; if (!g) return fail('none', 'Join a guild first.');
  if (!g.own) return fail('rank', 'Only the guild master sets the research focus.');
  if (!GUILD_RESEARCH.some(x => x.id === id)) return fail('unknown', 'Unknown research.');
  g.focus = id; account.save(); return ok({ focus: id });
}
const researchLevel = (g, R) => Math.min(R.max, Math.floor(g.level / R.every) + (g.own && g.focus === R.id ? 1 : 0));
export function perks(account) {
  const g = account.roster.guild, o = { xpGain: 0, silverGain: 0, lifeXp: 0, shopDiscount: 0, restGain: 0 };
  if (!g) return o;
  for (const R of GUILD_RESEARCH) o[R.perk] += researchLevel(g, R) * R.per;
  return o;
}
/** Events → your mission contributions. → notifications */
export function guildTrack(account, char, event, data = {}) {
  const g = account.roster.guild; if (!g || !g.missions) return [];
  const out = [];
  for (const id of g.missions.ids) {
    const M = GUILD_MISSIONS.find(m => m.id === id); if (M.event !== event) continue;
    if (Object.entries(M.match).some(([k, v]) => data[k] !== v)) continue;
    g.missions.mine[id] = (g.missions.mine[id] || 0) + (data.count || 1);
  }
  return out;
}
export function view(account, now = Date.now()) {
  const g = sync(account, now); if (!g) return null;
  const rng = new RNG(hashStr('roster:' + g.id));
  const shown = Math.min(12, Math.max(0, g.members - 1));
  const roster = Array.from({ length: shown }, (_, i) => ({ name: simName(rng), cls: rng.pick(CLS), ilvl: Math.round(1300 + rng.next() * 220), rank: i === 0 && !g.own ? 'Master' : i < 3 ? 'Officer' : 'Member', online: rng.next() < 0.45, contribution: Math.round(rng.next() * 40000), you: false }));
  roster.push({ name: account.roster.name || 'You', cls: account.chars[0]?.cls || 'reaver', ilvl: Math.floor(account.chars[0]?.ilvl || 0), rank: g.rank, online: true, contribution: g.contribution, you: true });
  roster.sort((a, b) => b.contribution - a.contribution);
  return {
    id: g.id, name: g.name, tag: g.tag, level: g.level, xp: g.xp, xpNext: guildXpFor(g.level), members: g.members, max: memberCap(g.level), motto: g.motto, rank: g.rank, own: !!g.own,
    bloodstones: account.count('bloodstone'), contribution: g.contribution,
    donations: { silver: { cost: DONATIONS.silver.cost, bloodstones: DONATIONS.silver.bloodstones, xp: DONATIONS.silver.xp, done: g.donated.silver },
      gold: DONATIONS.gold.map((d, tier) => ({ tier, cost: d.cost, bloodstones: d.bloodstones, xp: d.xp, done: g.donated.gold })) },
    research: GUILD_RESEARCH.map(R => ({ id: R.id, name: R.name, desc: R.desc.replace('{v}', Math.round(researchLevel(g, R) * R.per * 100)), level: researchLevel(g, R), max: R.max, perk: R.perk, active: g.own ? g.focus === R.id : false })),
    missions: missionRows(g, now),
    roster,
  };
}
