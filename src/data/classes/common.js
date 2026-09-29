// Shared helpers for class kits: engraving checks, party effects that also cover the caster (buffs, heals, shields,
// invulnerability, cleanses), and small event-list utilities used by unique tripods.
import { applyStatus, removeStatus, heal, addShield, eff } from '../../game/combat.js';
import { C, Z } from '../../game/skills/dsl.js';

/** Does this hero have class engraving `id`? (char.engr / char.classEngr as ids or { id }) */
export function hasEngr(kit, id) {
  const c = kit?.char; if (!c) return false;
  const has = l => Array.isArray(l) && l.some(e => e === id || e?.id === id);
  return has(c.engr) || has(c.classEngr);
}
/** event condition: only when the caster has engraving `id` (use as `if: withEngr('x')`) */
export const withEngr = id => run => hasEngr(run.u.kit, id);
export const withoutEngr = id => run => !hasEngr(run.u.kit, id);

// ------------------------------------------------------------------ party effects (caster included)
/** allies (heroes of the caster's team, caster included) within r of (x, z) */
export const allies = (L, u, x = u.pos.x, z = u.pos.z, r = 14) => L.alliesOf(u, x, z, r);

/** C() event: party-wide invulnerability (real i-frames + the status icon). */
export const partyInvuln = (t, dur, r = 16, o = {}) => C(t, (run, L) => {
  for (const a of allies(L, run.u, run.u.pos.x, run.u.pos.z, r)) { a.invuln = Math.max(a.invuln, dur); applyStatus(L, a, 'invuln', { dur, src: run.u, name: o.name || 'Invulnerable', icon: o.icon }); }
});
/** C() event: remove debuffs (not crowd control on bosses' terms, just statuses) from the party. */
export const partyCleanse = (t, r = 14) => C(t, (run, L) => {
  for (const a of allies(L, run.u, run.u.pos.x, run.u.pos.z, r)) for (const s of a.statuses.slice()) if (s.def.debuff) removeStatus(L, a, s.id);
});
/** C() event: party buff whose duration scales with a function of the run (e.g. identity orbs spent). */
export const partyBuffScaled = (t, o) => C(t, (run, L) => {
  const k = o.scale ? o.scale(run) : 1;
  const mods = typeof o.mods === 'function' ? o.mods(run) : o.mods;
  for (const a of allies(L, run.u, run.u.pos.x, run.u.pos.z, o.r || 16)) {
    applyStatus(L, a, o.id, { dur: o.dur * k, src: run.u, mods, name: o.name, icon: o.icon });
    if (o.shield) addShield(L, run.u, a, eff(run.u).atk * o.shield * (o.shieldScale ? k : 1), o.shieldDur || o.dur * k, o.shieldId);
    if (o.healPct) heal(L, run.u, a, a.hpMax * o.healPct * (o.healScale ? k : 1));
  }
  L.emit('buffCast', { unit: run.u, ev: o, targets: [] });
});
/**
 * Z() event for a support zone: each tick heals / buffs / shields allies standing in it (caster included).
 * o: { r, dur, tick, at, kind, follow, healPct (× target max HP), healAtk (× caster atk), buff: { id, dur, mods, name, icon },
 *      shield (× atk), shieldDur, shieldId, hit (optional damage to enemies), scaleByMult (heal × run multiplier) }
 */
export const allyZone = (t, o) => Z(t, {
  r: o.r, dur: o.dur, tick: o.tick, first: o.first ?? 0, at: o.at, kind: o.kind, follow: o.follow, hit: o.hit,
  onTick: (z, L) => {
    const src = z.src; if (!src || src.dead) return;
    const m = o.scaleByMult ? (z.ctx?.mult || 1) : 1;
    for (const a of allies(L, src, z.x, z.z, z.r)) {
      if (o.healPct) heal(L, src, a, a.hpMax * o.healPct * m);
      if (o.healAtk) heal(L, src, a, eff(src).atk * o.healAtk * m);
      if (o.buff) applyStatus(L, a, o.buff.id, { dur: o.buff.dur, src, mods: o.buff.mods, name: o.buff.name, icon: o.buff.icon });
      if (o.shield) addShield(L, src, a, eff(src).atk * o.shield * m, o.shieldDur || 4, o.shieldId);
    }
  },
});

// ------------------------------------------------------------------ event-list utilities (for unique tripods)
/** every timeline list of a skill def */
export const lists = d => [d.events, d.end, d.loop?.events, ...(d.stages || []).map(s => s.events)].filter(Boolean);
/** hit specs of a def (direct hits, projectile hits, zone hits), optionally filtered */
export function hitsOf(d, pred = null) {
  const out = [];
  for (const l of lists(d)) for (const e of l) {
    const h = e.a === 'hit' ? e : (e.a === 'proj' || e.a === 'zone') && e.hit ? e.hit : null;
    if (h && (!pred || pred(h, e))) out.push(h);
  }
  return out;
}
/** multiply the damage of (some) hits */
export const mulHits = (d, k, pred) => { for (const h of hitsOf(d, pred)) h.coef = (h.coef || 0) * k; };
/** events of a list, by kind */
export const evs = (l, a) => l.filter(e => e.a === a);
/** append events to a list and keep it sorted by time (the runner walks timelines in order) */
export function addEv(list, ...e) { list.push(...e); list.sort((a, b) => a.t - b.t); return list; }
/** the main timeline a tripod should extend: last combo stage, holding `end`, else `events` */
export const mainList = d => d.stages ? d.stages[d.stages.length - 1].events : d.type === 'holding' ? (d.end ||= []) : d.events;
/** run multiplier from identity orbs: perOrbMul 1 → spent orbs */
export const orbsSpent = run => Math.max(1, Math.round(run.mult));

/** Sort every timeline of a kit by time (the runner walks timelines in order; an early event listed after a later one
 *  would be delayed until the later one fires). Covers skills, basic, awakening, identity skills and demon skills. */
export function finalize(kit) {
  const sortDef = d => { if (!d) return; for (const l of lists(d)) l.sort((a, b) => a.t - b.t); };
  for (const s of kit.skills) sortDef(s);
  sortDef(kit.awakening);
  const I = kit.identity || {};
  for (const k of ['z', 'x']) if (I[k] && !I[k].mode) sortDef(I[k]);
  for (const s of I.demonSkills || []) sortDef(s);
  return kit;
}

/** C() event: phase through units for `dur` seconds (dash-through skills pass the enemy instead of bumping into it).
 *  Timed on the level clock, so a cancelled skill can never leave the hero intangible. */
export const phase = (t, dur) => C(t, (run, L) => {
  const u = run.u; u.data.ghostWalk = true; u.data.ghostUntil = Math.max(u.data.ghostUntil || 0, L.time + dur);
  L.after(dur, () => { if (L.time >= (u.data.ghostUntil || 0) - 1e-4) u.data.ghostWalk = false; });
});

/** C() event: re-aim the running skill at the nearest enemy (after a blink behind the target, the runner turns the
 *  unit but keeps the old aim direction, so follow-up hits would point away). */
export const reaim = (t, r = 8) => C(t, (run, L) => {
  const e = L.nearestEnemy(run.u, r); if (!e) return;
  run.setAim(e.pos.x, e.pos.z); run.u.facing = run.facing;
});
