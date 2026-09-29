// Trade skills: levels 1–30 with xp curves, Life Energy (10,000 cap, regenerates in real time), node yields by skill
// level and tool (rare drops), the fishing minigame (bite timing window) and the archaeology dig meter, tools & food.
// State: roster.life = { energy, t, skills: { forage: lv, … }, xp: { forage: n, … }, tools: { forage: { tier, dur } }, cast, dig }.
import { LIFE, xpToNext, LIFE_SKILLS, SKILL_IDS, TOOLS, TOOL_NAMES, TOOL_PRICES, FOOD_ENERGY } from '../../data/lifeskills.js';
import { econMods } from './mods.js';
import { ok, fail, pay, grantBundle, itemInfo, rngOf, emit, clamp, HOUR } from './common.js';
import { uid } from '../../core/util.js';

export { LIFE_SKILLS, TOOLS, TOOL_NAMES };
const cap = account => Math.round(LIFE.maxEnergy * (1 + (econMods(account).lifeEnergy || 0)));
const regen = account => LIFE.perHour * (1 + (econMods(account).lifeEnergy || 0));
export function state(account, now = Date.now()) {
  const r = account.roster, L = r.life ||= {};
  L.skills = { forage: 1, log: 1, mine: 1, hunt: 1, fish: 1, dig: 1, ...(L.skills || {}) };
  L.xp ||= {}; L.tools ||= {};
  for (const s of SKILL_IDS) L.tools[s] ||= { tier: 1, dur: TOOLS[1].dur };
  L.energy ??= LIFE.maxEnergy; L.t ??= now;
  const c = cap(account);
  if (L.energy < c) L.energy = Math.min(c, L.energy + Math.max(0, now - L.t) / HOUR * regen(account));
  L.t = now;
  return L;
}
export function energy(account, now = Date.now()) { const L = state(account, now); return { now: Math.floor(L.energy), max: cap(account), perHour: regen(account) }; }
function spend(account, L, skill) {
  const t = L.tools[skill], mult = t && t.dur > 0 ? TOOLS[t.tier].energy : 1;
  const e = Math.round(LIFE_SKILLS[skill].energy * mult);
  if (L.energy < e) return -1;
  L.energy -= e; return e;
}
function addXp(account, L, skill, n) {
  const g = 1 + (econMods(account).lifeXp || 0);
  L.xp[skill] = (L.xp[skill] || 0) + Math.round(n * g);
  let up = false;
  while (L.skills[skill] < LIFE.maxLevel && L.xp[skill] >= xpToNext(L.skills[skill])) { L.xp[skill] -= xpToNext(L.skills[skill]); L.skills[skill]++; up = true; }
  if (L.skills[skill] >= LIFE.maxLevel) L.xp[skill] = 0;
  return up;
}
/** roll a node's drop for skill at level with tool; quality: yield multiplier, rareMul: rare weight multiplier */
function roll(L, skill, r, { quality = 1, rareMul = 1, forceRare = false } = {}) {
  const S = LIFE_SKILLS[skill], lv = L.skills[skill], t = L.tools[skill], T = t && t.dur > 0 ? TOOLS[t.tier] : { yield: -0.25, rare: 0.5 };
  const pool = S.drops.filter(x => lv >= x.level).map(x => ({ ...x, w: x.rare ? x.w * T.rare * (1 + lv * 0.05) * rareMul : x.w }));
  const pick = forceRare ? (pool.find(x => x.rare) || r.weighted(pool)) : r.weighted(pool);
  const n = Math.max(1, Math.round(r.int(pick.n[0], pick.n[1]) * (1 + T.yield + (lv - 1) * 0.02) * (pick.rare ? 1 : quality)));
  const b = { [pick.id]: n };
  if (!pick.rare && r.chance(0.25)) { const c = S.drops[0]; b[c.id] = (b[c.id] || 0) + 1 + Math.floor(lv / 10); }
  if (t && t.dur > 0) t.dur--;
  return { bundle: b, rare: pick.rare };
}
function finishGather(account, char, L, skill, bundle, rare, xpMul = 1, extra = {}) {
  const up = addXp(account, L, skill, LIFE_SKILLS[skill].xp * (rare ? 3 : 1) * xpMul);
  const rows = grantBundle(account, char, bundle);
  account.save();
  const notes = emit(account, char, 'gather', { skill, count: 1, rare, items: Object.keys(bundle) });
  return ok({ rows, xp: Math.round(LIFE_SKILLS[skill].xp * (rare ? 3 : 1) * xpMul), level: L.skills[skill], levelUp: up, energy: Math.floor(L.energy), rare, notes, ...extra });
}
/** One gathering action at a node (fishing & digging resolve as an average catch; use the minigames for better yields). */
export function gather(account, char, skill, { rng, now = Date.now() } = {}) {
  if (!LIFE_SKILLS[skill]) return fail('skill', 'Unknown trade skill.');
  const L = state(account, now), e = spend(account, L, skill);
  if (e < 0) return fail('energy', 'Not enough Life Energy.');
  const { bundle, rare } = roll(L, skill, rngOf(rng));
  return finishGather(account, char, L, skill, bundle, rare);
}

// ------------------------------------------------------------------------------------------------ fishing minigame
export function fishCast(account, { rng, now = Date.now() } = {}) {
  const L = state(account, now), e = spend(account, L, 'fish');
  if (e < 0) return fail('energy', 'Not enough Life Energy.');
  const r = rngOf(rng), lv = L.skills.fish, t = L.tools.fish, T = t && t.dur > 0 ? TOOLS[t.tier] : { rare: 0.5 };
  const rare = lv >= 10 && r.chance(clamp(0.012 * T.rare * (1 + lv * 0.05), 0, 0.2));
  const cast = { id: uid('cast'), biteAt: Math.round(r.range(1.5, 6) * 100) / 100, window: rare ? 0.55 : Math.round((0.8 + lv * 0.01) * 100) / 100, perfect: rare ? 0.18 : 0.3, rare, energy: e, t: now };
  L.cast = cast; account.save();
  return ok({ cast: { ...cast } });
}
/** reactAt: seconds after the cast when the player pulled */
export function fishReel(account, char, cast, reactAt, { rng } = {}) {
  const L = state(account);
  if (!L.cast || !cast || L.cast.id !== cast.id) return fail('cast', 'Cast your line first.');
  const c = L.cast; L.cast = null;
  const r = rngOf(rng);
  if (reactAt < c.biteAt) { account.save(); return ok({ result: 'early', rows: [], xp: 0, levelUp: false, notes: [] }); }
  if (reactAt > c.biteAt + c.window) { const up = addXp(account, L, 'fish', 2); account.save(); return ok({ result: 'late', rows: [], xp: 2, levelUp: up, notes: [] }); }
  const perfect = reactAt - c.biteAt <= c.perfect;
  const { bundle, rare } = roll(L, 'fish', r, { quality: perfect ? 1.5 : 1, rareMul: perfect ? 2 : 1, forceRare: c.rare });
  return finishGather(account, char, L, 'fish', bundle, rare, perfect ? 1.5 : 1, { result: perfect ? 'perfect' : 'good' });
}

// ------------------------------------------------------------------------------------------------ archaeology dig meter
export function digStart(account, { rng, now = Date.now() } = {}) {
  const L = state(account, now), e = spend(account, L, 'dig');
  if (e < 0) return fail('energy', 'Not enough Life Energy.');
  const r = rngOf(rng), lv = L.skills.dig;
  const w = 0.16 + lv * 0.004, a = Math.round(r.range(0.1, 0.9 - w) * 1000) / 1000, pw = 0.05 + lv * 0.001, c = Math.round((a + w / 2 - pw / 2) * 1000) / 1000;
  const dig = { id: uid('dig'), speed: Math.round(r.range(0.6, 1.2) * 100) / 100, zone: [a, Math.round((a + w) * 1000) / 1000], perfect: [c, Math.round((c + pw) * 1000) / 1000], energy: e, t: now };
  L.dig = dig; account.save();
  return ok({ dig: { ...dig } });
}
/** pos: where the meter was stopped, 0..1 */
export function digStop(account, char, dig, pos, { rng } = {}) {
  const L = state(account);
  if (!L.dig || !dig || L.dig.id !== dig.id) return fail('dig', 'Start digging first.');
  const g = L.dig; L.dig = null;
  const inP = pos >= g.perfect[0] && pos <= g.perfect[1], inZ = pos >= g.zone[0] && pos <= g.zone[1];
  const result = inP ? 'perfect' : inZ ? 'good' : 'poor';
  const { bundle, rare } = roll(L, 'dig', rngOf(rng), { quality: inP ? 1.6 : inZ ? 1 : 0.4, rareMul: inP ? 2.5 : inZ ? 1 : 0 });
  return finishGather(account, char, L, 'dig', bundle, rare, inP ? 1.5 : inZ ? 1 : 0.5, { result });
}

// ------------------------------------------------------------------------------------------------ tools & food
export function buyTool(account, skill, tier) {
  if (!LIFE_SKILLS[skill] || !TOOLS[tier]) return fail('unknown', 'Unknown tool.');
  const L = state(account);
  if (!pay(account, { silver: TOOL_PRICES[tier] })) return fail('materials', 'Not enough silver.');
  L.tools[skill] = { tier, dur: TOOLS[tier].dur }; account.save();
  return ok({ tool: toolView(skill, L.tools[skill]) });
}
const toolView = (skill, t) => t ? { tier: t.tier, name: `${TOOLS[t.tier].name} ${TOOL_NAMES[skill]}`, dur: t.dur, max: TOOLS[t.tier].dur } : null;
export function eat(account, foodId, now = Date.now()) {
  const gain = FOOD_ENERGY[foodId]; if (!gain) return fail('food', 'That does not restore Life Energy.');
  const L = state(account, now), c = cap(account);
  if (L.energy >= c) return fail('full', 'Your Life Energy is already full.');
  if (!account.take(foodId, 1)) return fail('none', `You have no ${itemInfo(foodId).name}.`);
  L.energy = Math.min(c, L.energy + gain); account.save();
  return ok({ energy: Math.floor(L.energy) });
}
export function view(account, now = Date.now()) {
  const L = state(account, now);
  return {
    energy: Math.floor(L.energy), energyMax: cap(account), perHour: regen(account),
    skills: SKILL_IDS.map(id => {
      const S = LIFE_SKILLS[id], lv = L.skills[id], t = L.tools[id];
      return { id, name: S.name, verb: S.verb, level: lv, xp: L.xp[id] || 0, xpNext: lv >= LIFE.maxLevel ? 0 : xpToNext(lv), energy: Math.round(S.energy * (t && t.dur > 0 ? TOOLS[t.tier].energy : 1)), anim: S.anim,
        tool: toolView(id, t), drops: S.drops.map(x => { const i = itemInfo(x.id); return { id: x.id, name: i.name, grade: i.grade, icon: i.icon, rare: x.rare, level: x.level, unlocked: lv >= x.level }; }) };
    }),
  };
}
