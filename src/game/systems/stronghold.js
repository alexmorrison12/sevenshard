// Brightwater Isle — the stronghold. Stronghold level/xp, buildings, a research tree of roster-wide perks, a workshop
// crafting queue, crew & dispatch missions, garden and pet ranch passive yields, and action energy — all on real-time
// timers (Date.now(), or an injected `now`). State lives in account.roster.stronghold.
import { BUILDINGS, buildingReq, RESEARCH, RESEARCH_BY_ID, RECIPES, RECIPE_BY_ID, MISSIONS, MISSION_BY_ID, CREW_ROLES, RANCH_FORAGE, ACTION_ENERGY, STRONGHOLD_MAX, strongholdXpFor } from '../../data/stronghold.js';
import { simName } from '../social/names.js';
import { RNG } from '../../core/noise.js';
import { rollTable } from './rolls.js';
import { ok, fail, pay, canPay, missing, costRows, grantBundle, bundleRows, rosterSeed, rngOf, clamp, emit, MIN, HOUR, merge, discount } from './common.js';
import { uid } from '../../core/util.js';

// ------------------------------------------------------------------------------------------------ state
/** Normalised stronghold state (lazily migrates older saves), with action energy brought up to `now`. */
export function state(account, now = Date.now()) {
  const r = account.roster;
  const s = r.stronghold ||= {};
  s.level ??= 1; s.xp ??= 0;
  s.buildings = { manor: 1, ...(s.buildings || {}) };
  if (!s.research || Array.isArray(s.research)) s.research = {};
  s.researching ??= null;
  if (!Array.isArray(s.craft)) s.craft = [];
  if (!Array.isArray(s.dispatch)) s.dispatch = [];
  if (!Array.isArray(s.crew) || !s.crew.length) s.crew = starterCrew(account);
  s.garden ||= { t: now };
  s.ranch ||= { pets: [], t: now };
  s.energy ??= ACTION_ENERGY.max; s.energyT ??= now;
  // action energy regen
  const cap = ACTION_ENERGY.max, gain = Math.max(0, now - s.energyT) / HOUR * ACTION_ENERGY.perHour * (1 + (perksOf(s).energyRegen || 0));
  s.energy = Math.min(cap, s.energy + gain); s.energyT = now;
  return s;
}
function starterCrew(account) {
  const rng = new RNG(rosterSeed(account) ^ 0xc4e1);
  return [
    { id: 'crew1', name: simName(rng), role: 'Sailor', power: 34, xp: 0 },
    { id: 'crew2', name: simName(rng), role: 'Scout', power: 30, xp: 0 },
    { id: 'crew3', name: simName(rng), role: 'Brawler', power: 38, xp: 0 },
  ];
}
const perksOf = s => { const o = {}; for (const id in s.research || {}) { const p = RESEARCH_BY_ID[id]?.perk; if (p && s.research[id]) for (const k in p) o[k] = (o[k] || 0) + p[k]; } return o; };
/** Summed perks of completed research: { chaosLoot, honeSilver, craftSpeedBattle, lifeEnergy, dispatchSlots, atk, hp, guardianLoot, marketFee, dispatchChance, foodYield, fusionCost, craftSlots } */
export function perks(account) { return perksOf(account.roster.stronghold || {}); }
export const effect = (id, lv) => BUILDINGS[id].effect(lv);
const bl = (s, id) => s.buildings[id] || 0;

/** Add stronghold xp; returns levels gained. */
export function addXp(account, n, now = Date.now()) {
  const s = state(account, now); s.xp += Math.max(0, Math.round(n)); const ups = [];
  while (s.level < STRONGHOLD_MAX && s.xp >= strongholdXpFor(s.level)) { s.xp -= strongholdXpFor(s.level); s.level++; ups.push(s.level); }
  if (s.level >= STRONGHOLD_MAX) s.xp = Math.min(s.xp, strongholdXpFor(s.level));
  account.save(); return ups;
}
export function energy(account, now = Date.now()) { const s = state(account, now); return { now: Math.floor(s.energy), max: ACTION_ENERGY.max, perHour: ACTION_ENERGY.perHour }; }
function spendEnergy(s, n) { if (s.energy < n) return false; s.energy -= n; return true; }

// ------------------------------------------------------------------------------------------------ buildings
export function buildingInfo(account, id, now = Date.now()) {
  const s = state(account, now), B = BUILDINGS[id]; if (!B) return null;
  const lv = bl(s, id), nl = lv + 1;
  const next = lv >= B.max ? null : (() => {
    const cost = B.cost(nl), reqSh = buildingReq(nl), capByManor = id === 'manor' ? B.max : bl(s, 'manor');
    const why = s.level < reqSh ? `Requires stronghold level ${reqSh}.` : id !== 'manor' && nl > capByManor ? `Upgrade the Manor to Lv.${nl} first.` : !canPay(account, cost) ? 'Not enough materials.' : null;
    return { level: nl, cost, costRows: costRows(cost), reqStronghold: reqSh, can: !why, why, effect: B.effect(nl) };
  })();
  return { id, name: B.name, desc: B.desc, level: lv, max: B.max, effect: lv ? B.effect(lv) : null, next };
}
export function upgradeBuilding(account, id, now = Date.now()) {
  const info = buildingInfo(account, id, now);
  if (!info) return fail('unknown', 'No such building.');
  if (!info.next) return fail('max', `${info.name} is at its maximum level.`);
  if (!info.next.can) return fail('locked', info.next.why, { missing: missing(account, info.next.cost) });
  if (!pay(account, info.next.cost)) return fail('materials', 'Not enough materials.');
  const s = state(account, now); s.buildings[id] = info.next.level;
  const ups = addXp(account, 150 * info.next.level, now);
  emit(account, null, 'build', { building: id, level: info.next.level });
  account.save();
  return ok({ building: id, level: info.next.level, levelUps: ups });
}

// ------------------------------------------------------------------------------------------------ research
export function researchList(account, now = Date.now()) {
  const s = state(account, now); tick(account, now);
  const tier = bl(s, 'research_hall') ? effect('research_hall', bl(s, 'research_hall')).tier : 0;
  return RESEARCH.map(p => {
    const done = !!s.research[p.id], active = s.researching?.id === p.id;
    const reqMissing = (p.req || []).filter(x => !s.research[x]);
    const locked = done ? null : tier < p.tier ? `Research Hall tier ${p.tier} required.` : reqMissing.length ? `Requires ${reqMissing.map(x => RESEARCH_BY_ID[x].name).join(', ')}.` : null;
    return { id: p.id, name: p.name, tier: p.tier, desc: p.desc, perk: p.perk, cost: p.cost, costRows: costRows(p.cost), energy: p.energy, mins: researchMins(s, p), done, active, locked,
      available: !done && !active && !locked && !s.researching, left: active ? Math.max(0, s.researching.t1 - now) : 0 };
  });
}
const researchMins = (s, p) => Math.max(1, Math.round(p.mins * (1 - (bl(s, 'research_hall') ? effect('research_hall', bl(s, 'research_hall')).speed : 0))));
export function startResearch(account, id, now = Date.now()) {
  const s = state(account, now); tick(account, now);
  const row = researchList(account, now).find(x => x.id === id);
  if (!row) return fail('unknown', 'No such research.');
  if (row.done) return fail('done', 'Already researched.');
  if (s.researching) return fail('busy', 'Another project is being researched.');
  if (row.locked) return fail('locked', row.locked);
  if (s.energy < row.energy) return fail('energy', 'Not enough action energy.');
  if (!pay(account, row.cost)) return fail('materials', 'Not enough materials.', { missing: missing(account, row.cost) });
  spendEnergy(s, row.energy);
  s.researching = { id, t0: now, t1: now + row.mins * MIN };
  account.save();
  return ok({ research: id, t1: s.researching.t1 });
}

// ------------------------------------------------------------------------------------------------ crafting
export function craftSlots(account, now = Date.now()) { const s = state(account, now); const w = bl(s, 'workshop'); return w ? effect('workshop', w).slots + (perks(account).craftSlots || 0) : 0; }
/** recipe cost & time after perks for qty batches */
export function recipeQuote(account, recipeId, qty = 1, now = Date.now()) {
  const s = state(account, now), R = RECIPE_BY_ID[recipeId]; if (!R) return null;
  const p = perks(account), w = bl(s, 'workshop');
  let cost = {}; for (const [k, v] of Object.entries(R.cost)) cost[k] = v * qty;
  if (R.cat === 'fusion' && p.fusionCost) cost = discount(cost, { silver: 1, '*': 1 - p.fusionCost });
  const speed = (w ? effect('workshop', w).speed : 0) + (R.cat === 'battle' ? p.craftSpeedBattle || 0 : 0);
  const mins = Math.max(1, Math.round(R.mins * qty * (1 - Math.min(0.8, speed))));
  const out = {}; for (const [k, v] of Object.entries(R.out)) out[k] = Math.round(v * qty * (R.cat === 'food' ? 1 + (p.foodYield || 0) : 1));
  const why = !w ? 'Build the Workshop first.' : w < R.ws ? `Workshop Lv.${R.ws} required.` : null;
  return { recipe: R.id, name: R.name, cat: R.cat, qty, cost, costRows: costRows(cost), energy: R.energy * qty, mins, out, outRows: bundleRows(out), locked: why };
}
export function recipes(account, now = Date.now()) { return RECIPES.map(R => ({ ...recipeQuote(account, R.id, 1, now), can: canPay(account, recipeQuote(account, R.id, 1, now).cost) })); }
export function craft(account, recipeId, qty = 1, now = Date.now()) {
  const s = state(account, now); tick(account, now);
  const q = recipeQuote(account, recipeId, Math.max(1, qty | 0), now);
  if (!q) return fail('unknown', 'No such recipe.');
  if (q.locked) return fail('locked', q.locked);
  const busy = s.craft.filter(j => !j.collected).length;
  if (busy >= craftSlots(account, now)) return fail('slots', 'Every workshop slot is busy.');
  if (s.energy < q.energy) return fail('energy', 'Not enough action energy.');
  if (!pay(account, q.cost)) return fail('materials', 'Not enough materials.', { missing: missing(account, q.cost) });
  spendEnergy(s, q.energy);
  const job = { id: uid('cr'), recipe: recipeId, qty: q.qty, out: q.out, cost: q.cost, t0: now, t1: now + q.mins * MIN, collected: false };
  s.craft.push(job); account.save();
  return ok({ job });
}
export function cancelCraft(account, jobId, now = Date.now()) {
  const s = state(account, now); const i = s.craft.findIndex(j => j.id === jobId);
  if (i < 0) return fail('unknown', 'No such job.');
  const j = s.craft[i]; if (now >= j.t1) return fail('done', 'Already finished — collect it instead.');
  s.craft.splice(i, 1); grantBundle(account, null, j.cost); account.save();
  return ok({ refunded: bundleRows(j.cost) });
}
/** Grant every finished craft job. → { ok, rows, jobs } */
export function collectCrafts(account, char, now = Date.now()) {
  const s = state(account, now); const got = {}; const jobs = [];
  for (const j of s.craft) if (!j.collected && now >= j.t1) { j.collected = true; merge(got, j.out); jobs.push(j); addXp(account, (RECIPE_BY_ID[j.recipe]?.energy || 20) * j.qty / 2, now); emit(account, char, 'craft', { recipe: j.recipe, qty: j.qty }); }
  s.craft = s.craft.filter(j => !j.collected);
  const rows = grantBundle(account, char, got);
  return ok({ rows, jobs: jobs.length });
}

// ------------------------------------------------------------------------------------------------ crew & dispatch
export function dispatchSlots(account, now = Date.now()) { const s = state(account, now); const b = bl(s, 'barracks'); return b ? effect('barracks', b).slots + (perks(account).dispatchSlots || 0) : 0; }
export function crewCap(account, now = Date.now()) { return effect('barracks', bl(state(account, now), 'barracks')).crew; }
const busyCrew = s => new Set(s.dispatch.filter(d => !d.collected).flatMap(d => d.crew));
/** Recruit a crew member (costs a Crew Contract, or 30,000 silver). */
export function recruitCrew(account, { rng, pay: payWith = 'contract', now = Date.now() } = {}) {
  const s = state(account, now);
  if (s.crew.length >= crewCap(account, now)) return fail('full', 'The barracks are full.');
  const cost = payWith === 'silver' ? { silver: 30000 } : { crew_contract: 1 };
  if (!pay(account, cost)) return fail('materials', payWith === 'silver' ? 'Not enough silver.' : 'You need a Crew Contract.');
  const r = rngOf(rng ?? (rosterSeed(account) + s.crew.length * 7919));
  const roles = Object.keys(CREW_ROLES);
  const c = { id: uid('crew'), name: simName(r), role: r.pick(roles), power: r.int(24, 48), xp: 0 };
  s.crew.push(c); account.save();
  return ok({ crew: c });
}
function crewPower(s, crewIds, mission) {
  let p = 0;
  for (const id of crewIds) { const c = s.crew.find(x => x.id === id); if (c) p += c.power * (CREW_ROLES[c.role] && CREW_ROLES[c.role] === mission.tag ? 1.25 : 1); }
  return Math.round(p);
}
export function dispatchChance(account, missionId, crewIds, now = Date.now()) {
  const s = state(account, now), M = MISSION_BY_ID[missionId]; if (!M) return 0;
  const p = crewPower(s, crewIds, M);
  return clamp(0.25 + 0.75 * (p / M.power), 0.1, 0.95) + (perks(account).dispatchChance || 0);
}
export function missions(account, now = Date.now()) {
  const s = state(account, now); const busy = busyCrew(s);
  return MISSIONS.map(M => ({ id: M.id, name: M.name, tag: M.tag, mins: M.mins, crew: M.crew, power: M.power, xp: M.xp, rewards: M.reward.map(e => ({ id: e.id, min: e.n[0], max: e.n[1], chance: e.p ?? 1 })),
    freeCrew: s.crew.filter(c => !busy.has(c.id)).length }));
}
export function dispatch(account, missionId, crewIds, now = Date.now()) {
  const s = state(account, now); tick(account, now);
  const M = MISSION_BY_ID[missionId]; if (!M) return fail('unknown', 'No such mission.');
  if (!Array.isArray(crewIds) || crewIds.length !== M.crew) return fail('crew', `This mission needs ${M.crew} crew.`);
  const busy = busyCrew(s);
  for (const id of crewIds) { if (!s.crew.some(c => c.id === id)) return fail('crew', 'Unknown crew member.'); if (busy.has(id)) return fail('busy', 'That crew member is already on a mission.'); }
  if (s.dispatch.filter(d => !d.collected).length >= dispatchSlots(account, now)) return fail('slots', 'No free dispatch slots.');
  const chance = Math.min(0.98, dispatchChance(account, missionId, crewIds, now));
  const job = { id: uid('dp'), mission: missionId, crew: crewIds.slice(), t0: now, t1: now + M.mins * MIN, chance, collected: false };
  s.dispatch.push(job); account.save();
  emit(account, null, 'dispatch', { mission: missionId });
  return ok({ job });
}
/** Resolve & grant a finished dispatch (success = full rewards; failure = 30% of the materials). */
export function collectDispatch(account, char, jobId, { rng, now = Date.now() } = {}) {
  const s = state(account, now); const j = s.dispatch.find(d => d.id === jobId && !d.collected);
  if (!j) return fail('unknown', 'No such mission.');
  if (now < j.t1) return fail('running', 'The crew has not returned yet.', { left: j.t1 - now });
  const M = MISSION_BY_ID[j.mission], r = rngOf(rng ?? `${jobId}`);
  const success = r.next() < j.chance;
  const bundle = rollTable(M.reward, r, { mul: success ? 1 : 0.3 });
  if (!success) { delete bundle.items; delete bundle.cards; for (const k of Object.keys(bundle)) if (!bundle[k]) delete bundle[k]; }
  j.collected = true; s.dispatch = s.dispatch.filter(d => !d.collected);
  for (const id of j.crew) { const c = s.crew.find(x => x.id === id); if (c) { c.xp += Math.round(M.xp / j.crew.length); while (c.xp >= 100) { c.xp -= 100; c.power += 3; } } }
  const ups = addXp(account, M.xp * (success ? 1 : 0.4), now);
  const rows = grantBundle(account, char, bundle);
  return ok({ success, rows, mission: M.name, levelUps: ups });
}

// ------------------------------------------------------------------------------------------------ garden & ranch
const gardenReady = (s, now) => { const g = bl(s, 'garden'); if (!g) return {}; const h = Math.min(24, Math.max(0, now - s.garden.t) / HOUR), e = effect('garden', g); return { herb: Math.floor(e.herb * h), flower: Math.floor(e.flower * h), sunbloom: Math.floor(e.sunbloom * h) }; };
export function collectGarden(account, now = Date.now()) {
  const s = state(account, now); const b = gardenReady(s, now);
  for (const k of Object.keys(b)) if (!b[k]) delete b[k];
  if (!Object.keys(b).length) return fail('empty', 'Nothing has grown yet.');
  s.garden.t = now; const rows = grantBundle(account, null, b);
  emit(account, null, 'gather', { skill: 'garden', count: rows.length });
  return ok({ rows });
}
export function stationPet(account, petId, now = Date.now()) {
  const s = state(account, now); const b = bl(s, 'ranch'); const slots = b ? effect('ranch', b).slots : 0;
  if (!account.roster.pets?.includes(petId)) return fail('unknown', 'You do not own that pet.');
  if (s.ranch.pets.includes(petId)) { s.ranch.pets = s.ranch.pets.filter(p => p !== petId); account.save(); return ok({ stationed: false }); }
  if (s.ranch.pets.length >= slots) return fail('full', 'No free berths at the Pet Ranch.');
  s.ranch.pets.push(petId); account.save(); return ok({ stationed: true });
}
export function collectRanch(account, { rng, now = Date.now() } = {}) {
  const s = state(account, now); const b = bl(s, 'ranch'); if (!b || !s.ranch.pets.length) return fail('empty', 'No pets are stationed.');
  const every = effect('ranch', b).every * HOUR, n = Math.min(8, Math.floor((now - s.ranch.t) / every));
  if (n <= 0) return fail('empty', 'The pets are still foraging.', { next: s.ranch.t + every });
  const r = rngOf(rng ?? `${s.ranch.t}`), bundle = {};
  for (let i = 0; i < n * s.ranch.pets.length; i++) rollTable(RANCH_FORAGE, r, { into: bundle });
  s.ranch.t += n * every;
  return ok({ rows: grantBundle(account, null, bundle) });
}

// ------------------------------------------------------------------------------------------------ timers
/** Speed up a running research / craft / dispatch with crystals (1 crystal per started 10 minutes). */
export function rush(account, kind, jobId, now = Date.now()) {
  const s = state(account, now);
  const job = kind === 'research' ? s.researching : (kind === 'craft' ? s.craft : s.dispatch).find(j => j.id === jobId && !j.collected);
  if (!job) return fail('unknown', 'Nothing to speed up.');
  const left = job.t1 - now; if (left <= 0) return fail('done', 'Already finished.');
  const cost = { crystals: Math.max(1, Math.ceil(left / (10 * MIN))) };
  if (!pay(account, cost)) return fail('crystals', 'Not enough crystals.', { cost });
  job.t1 = now; tick(account, now); account.save();
  return ok({ cost });
}
/** Resolve finished research (instant perks). → notifications [{ kind: 'research', id, name }] */
export function tick(account, now = Date.now()) {
  const s = account.roster.stronghold; if (!s) return [];
  const out = [];
  if (s.researching && now >= s.researching.t1) {
    const p = RESEARCH_BY_ID[s.researching.id];
    s.research[s.researching.id] = true; s.researching = null;
    addXp(account, (p?.mins || 30) * 3, now);
    out.push({ kind: 'research', id: p?.id, name: p?.name, text: `Research complete: ${p?.name}.` });
    emit(account, null, 'research', { id: p?.id });
    account.save();
  }
  return out;
}
/** Everything the Stronghold window needs. */
export function view(account, now = Date.now()) {
  const s = state(account, now); const notes = tick(account, now); const busy = busyCrew(s);
  return {
    level: s.level, xp: s.xp, xpNext: strongholdXpFor(s.level), max: STRONGHOLD_MAX,
    energy: Math.floor(s.energy), energyMax: ACTION_ENERGY.max,
    buildings: Object.keys(BUILDINGS).map(id => buildingInfo(account, id, now)),
    research: researchList(account, now),
    researching: s.researching ? { id: s.researching.id, name: RESEARCH_BY_ID[s.researching.id]?.name, t0: s.researching.t0, t1: s.researching.t1, left: Math.max(0, s.researching.t1 - now), pct: clamp((now - s.researching.t0) / (s.researching.t1 - s.researching.t0), 0, 1) } : null,
    perks: perks(account),
    crafts: s.craft.map(j => ({ id: j.id, recipe: j.recipe, name: RECIPE_BY_ID[j.recipe]?.name, qty: j.qty, t0: j.t0, t1: j.t1, left: Math.max(0, j.t1 - now), pct: clamp((now - j.t0) / (j.t1 - j.t0), 0, 1), done: now >= j.t1, out: bundleRows(j.out) })),
    craftSlots: craftSlots(account, now),
    dispatch: s.dispatch.map(d => ({ id: d.id, mission: d.mission, name: MISSION_BY_ID[d.mission]?.name, crew: d.crew, chance: d.chance, t0: d.t0, t1: d.t1, left: Math.max(0, d.t1 - now), done: now >= d.t1 })),
    dispatchSlots: dispatchSlots(account, now),
    crew: s.crew.map(c => ({ ...c, busy: busy.has(c.id) })), crewCap: crewCap(account, now),
    garden: { level: bl(s, 'garden'), ready: bundleRows(gardenReady(s, now)), since: s.garden.t },
    ranch: { level: bl(s, 'ranch'), pets: s.ranch.pets.slice(), slots: bl(s, 'ranch') ? effect('ranch', bl(s, 'ranch')).slots : 0 },
    notes,
  };
}
export { BUILDINGS, RESEARCH, RECIPES, MISSIONS };
