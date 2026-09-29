// Shared helpers for boss scripts: geometry, timing that stays in sync with telegraphs, animation/impact sync,
// lingering hazards the AI party can see, buffs, visual projectiles, add plumbing.
//
// Timing: BossBrain.wait() runs faster in hard mode / enrage, but B.tele() draws the telegraph for the raw duration —
// so a telegraph would still be filling when its hit lands. Use tele()/wait()/strike() from here: they apply the same
// factor to both (and the per-fight haste in B.flags.haste, e.g. Gorrath's fury or ghost phase).
import { applyStatus, removeStatus, kill } from '../../game/combat.js';

export const DEG = Math.PI / 180;
export const rot = (d, a) => { const c = Math.cos(a), s = Math.sin(a); return { x: d.x * c - d.z * s, z: d.x * s + d.z * c }; };
export const norm = (x, z) => { const l = Math.hypot(x, z) || 1; return { x: x / l, z: z / l }; };
export const dirTo = (B, p) => norm(p.x - B.u.pos.x, p.z - B.u.pos.z);
export const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const back = B => ({ x: -B.u.fx, z: -B.u.fz });
export const fwd = B => ({ x: B.u.fx, z: B.u.fz });
export const angDir = a => ({ x: Math.cos(a), z: Math.sin(a) });
export const rnd = (B, a = 0, b = 1) => a + B.level.rng() * (b - a);
export const pick = (B, arr) => arr[Math.floor(B.level.rng() * arr.length)];
export const shuffle = (B, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(B.level.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** real-time factor of B.wait (hard mode and enrage speed scripts up) */
export const tf = B => 1 / ((B.enraged ? 1.3 : 1) * (B.mods.hard ? 1.12 : 1));
/** per-fight haste (fury buffs, ghost phase…) — multiplies every script duration */
export const haste = B => B.flags.haste || 1;
export const wait = (B, s) => B.wait(s * haste(B));
/** telegraph whose drawn duration matches wait(B, dur) */
export const tele = (B, shape, o = {}) => B.tele(shape, { ...o, dur: (o.dur ?? 1) * haste(B) * tf(B) });
/** telegraph → wait → hit (all in sync) */
export async function strike(B, shape, o = {}) {
  const tg = tele(B, shape, o);
  try { await wait(B, o.dur ?? 1); } finally { tg.alive = false; }
  return B.hit(shape, o);
}
/** several telegraphs that all resolve together: list = [[shape, o], …]; o.dur of the first is used */
export async function volley(B, list, dur, common = {}) {
  const tgs = list.map(([shape, o]) => tele(B, shape, { ...common, ...o, dur }));
  try { await wait(B, dur); } finally { for (const t of tgs) t.alive = false; }
  const out = [];
  list.forEach(([shape, o], i) => out.push(...B.hit(shape, { ...common, ...o, fx: i < (common.fxMax ?? 12) ? (o.fx ?? common.fx) : null, sfx: i === 0 ? (o.sfx ?? common.sfx) : null, shake: i === 0 ? (o.shake ?? common.shake) : 0 })));
  return out;
}

/**
 * Play a model action so that its (first) impact lands `at` seconds from now; returns `at`.
 * Uses the model's own timing metadata when it exposes it, else the boss def's `anims` table, else a generic ratio.
 */
export function act(B, name, at, hitIndex = 0) {
  const m = B.u.model;
  let meta = m?.info?.actions?.[name] || B.def.anims?.[name];
  if (!meta && m?.entry?.actions?.[name]) { const e = m.entry.actions[name]; meta = { dur: e.D, hits: e.hits }; }
  const k = haste(B) * tf(B);
  if (meta && meta.hits && meta.hits.length > hitIndex && meta.hits[hitIndex] > 0 && !meta.loop) B.anim(name, meta.dur * at / meta.hits[hitIndex] * k);
  else if (meta && meta.loop) B.anim(name, at * k);
  else B.anim(name, (at / 0.55) * k);
  return at;
}
/** blue counter window lasting `dur` script-seconds (kept in sync with telegraphs/haste) */
export const counter = (B, dur, groggy = 4) => B.counterWindow(dur * haste(B) * tf(B), groggy);
/** loop/hold an action for `dur` seconds (channels, groggy-like holds) */
export const hold = (B, name, dur) => B.anim(name, dur * haste(B) * tf(B));

/** an AI-only danger marker (not drawn): the party treats the area as about to detonate while it lives */
export function marker(B, shape, o) {
  const L = B.level;
  const tg = { shape, r: o.r, inner: o.inner, angle: o.deg ? o.deg * DEG : o.angle, len: o.len, width: o.width, x: o.x, z: o.z, dx: o.dir?.x ?? 0, dz: o.dir?.z ?? -1, dur: 1e6, t: 1e6 - 0.4, color: 'red', owner: null, team: B.u.team, alive: true, hidden: true };
  L.telegraphs.push(tg);
  const tm = L.every(0.1, () => { if (!tg.alive) { L.cancelTimer(tm); return; } tg.t = tg.dur - 0.4; });
  return tg;
}

/**
 * Lingering ground hazard (lava, void, quicksand…): ticks damage, draws its zone FX, and carries an invisible danger
 * marker so the AI party steps out of it. o: { x, z, r, dur, tick, coef, status, kind, first, dir, shape }
 */
export function pool(B, o) {
  const hz = B.hazard({ x: o.x, z: o.z, r: o.r, dur: o.dur, tick: o.tick ?? 0.5, first: o.first ?? 0.4, kind: o.kind || 'lava', shape: o.shape, dx: o.dir?.x, dz: o.dir?.z,
    color: o.color, hit: { coef: (o.coef ?? 0.15) * (B.mods.hard ? 1.25 : 1), status: o.status, knock: o.knock, kb: o.kb, len: o.len, width: o.width, inner: o.inner } });
  const mk = marker(B, o.shape || 'circle', { ...o, r: o.r });
  const L = B.level;
  const tm = L.every(0.25, () => { if (!hz.alive || B.u.dead) { mk.alive = false; hz.alive = false; L.cancelTimer(tm); } });
  hz.marker = mk;
  return hz;
}

/** a hit whose `fear` status makes heroes run away from the boss */
export function fearHit(B, shape, o) {
  const evs = B.hit(shape, { ...o, status: [...(o.status || []), { id: 'fear', dur: o.fear ?? 2 }] });
  for (const ev of evs) ev.tgt.data.fearFrom = { x: B.u.pos.x, z: B.u.pos.z };
  return evs;
}

/** timed buff/debuff on the boss (bosses ignore CC, not buffs); returns the status record */
export function buff(B, id, dur, mods, name) { return applyStatus(B.level, B.u, id, { dur, force: true, mods, name: name || id }); }
export function unbuff(B, id) { removeStatus(B.level, B.u, id); }
export { applyStatus, removeStatus };

/** how far the boss can travel along dir before leaving the walkable arena (≤ max) */
export function reachAlong(B, dir, max, from = B.u.pos, margin = 1.2) {
  const nav = B.level.nav;
  let d = 0;
  for (let s = 0.5; s <= max; s += 0.5) { if (!nav.ok(from.x + dir.x * (s + margin), from.z + dir.z * (s + margin))) break; d = s; }
  return d;
}
/** arena centre (zone bounds when known) */
export function center(B) { const b = B.level.zone?.bounds; return b ? { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 } : { x: 0, z: 0 }; }
/** clamp a point into the walkable arena */
export function onNav(B, p, r = 1) { const q = B.level.nav.nearest(p.x, p.z, 12, r); return q || p; }

/** heroes behind the boss within r (back-attack punishers) */
export const behind = (B, r = 9, cos = -0.3) => B.heroes().filter(h => { const u = B.u, dx = h.pos.x - u.pos.x, dz = h.pos.z - u.pos.z, d = Math.hypot(dx, dz) || 1; return d < r + u.radius && (dx * u.fx + dz * u.fz) / d < cos; });
export const near = (B, r) => B.heroes().filter(h => Math.hypot(h.pos.x - B.u.pos.x, h.pos.z - B.u.pos.z) < r + B.u.radius);
export const farthest = B => { let best = null, bd = -1; for (const h of B.heroes()) { const d = Math.hypot(h.pos.x - B.u.pos.x, h.pos.z - B.u.pos.z); if (d > bd) { bd = d; best = h; } } return best; };
export const someHeroes = (B, n) => shuffle(B, B.heroes()).slice(0, n);

/** purely visual projectile (the presenter draws it); returns the record */
export function visual(B, from, to, { speed = 18, kind = 'orb', color = 'orange', radius = 0.6, y = 1.4, arc = 0 } = {}) {
  const d = norm(to.x - from.x, to.z - from.z), len = Math.hypot(to.x - from.x, to.z - from.z);
  return B.level.projectile({ src: B.u, x: from.x, z: from.z, y, dx: d.x, dz: d.z, speed, range: Math.max(0.5, len), radius, noHit: true, flies: true, kind, color, arc });
}
export const fx = (B, preset, x, z, o = {}) => B.level.emit('fx', { unit: B.u, preset, x, z, dx: o.dir?.x ?? B.u.fx, dz: o.dir?.z ?? B.u.fz, ev: { r: o.r, len: o.len, width: o.width, color: o.color } });
export const sfx = (B, name, p = B.u.pos) => B.level.emit('sfx', { unit: B.u, name, pos: { x: p.x, y: B.u.pos.y, z: p.z } });
export const shake = (B, v) => B.level.emit('shake', { unit: B.u, v });

/** spawn adds and optionally replace their brain (o.brain(unit) → controller) */
export function adds(B, type, n, o = {}) {
  const us = B.spawnAdds(type, n, o.r ?? 8, { name: o.name, hpMul: o.hpMul, atkMul: o.atkMul, scale: o.scale, elite: o.elite });
  us.forEach((u, i) => {
    if (o.at) { const p = typeof o.at === 'function' ? o.at(i, n) : o.at; u.pos.x = p.x; u.pos.z = p.z; }
    if (o.brain) u.ctrl = o.brain(u, i);
    if (o.tag) u.data[o.tag] = true;
  });
  return us;
}
/** kill everything a boss spawned (phase end / boss death) */
export function clearAdds(B, pred = u => u.kind === 'mob') {
  for (const u of B.level.units.slice()) if (!u.dead && u.team === B.u.team && pred(u) && u !== B.u) kill(B.level, u, null);
}

/** other boss units of the same encounter (twins) */
export const partners = B => (B.u.data.encounter?.bosses || []).filter(b => b !== B.u);
/**
 * Make another boss brain run a one-off script now (interrupting what it does). The interrupted script's cleanup
 * would clear the brain's busy flag a frame later, so busy is re-asserted every tick until the new script ends.
 */
export function command(unit, script, recover = 0.8) {
  const br = unit?.ctrl; if (!br || unit.dead) return false;
  const L = unit.level;
  br.interrupt(0);
  unit.data.groggy = false;
  const keep = L.every(0.02, () => { if (!unit.dead) br.busy = true; }, 0);
  br.run({ recover, run: async (B2, t) => { try { await script(B2, t); } finally { L.cancelTimer(keep); } } });
  return true;
}

/** scale a boss unit's max HP (hard mode, twin tuning) keeping bars consistent */
export function scaleHp(u, k) {
  u.hpMax = u.st.hpMax = Math.round(u.hpMax * k); u.hp = u.hpMax; u.data.barHp = u.hpMax / (u.data.bars || 100);
}
