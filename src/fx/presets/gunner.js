// Gunner presets — Pistoleer (twin pistols / shotgun / rifle): muzzle flashes, tracers, sniper rounds, grenades.
import * as THREE from 'three';
import { ctx, tc, vec, GEN, PHYS, FIRE, TAU, UP, hue, shockwave, decal, hit, explosion, S, R, P, v3 } from './lib.js';

const K = {};
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const MUZ_STAR = P({ sprite: S.star, ramp: R.wFlash, life: 0.07, size: 0.9, end: 1.3, i: 3.4, noGround: true });
const MUZ_CONE = P({ sprite: S.flame1, ramp: R.wFlash, life: 0.07, size: 0.8, end: 1.4, i: 3, noGround: true });
const MUZ_GLOW = P({ sprite: S.glow, ramp: R.wFlash, life: 0.1, size: 1.6, end: 1.2, i: 1.8, noGround: true });
const MUZ_SMOKE = P({ pool: 'alpha', sprite: [S.smoke1, S.smoke2, S.smoke3], ramp: R.smokeLight, life: [0.5, 0.8], size: [0.25, 0.35], end: [2.5, 3.5], ease: 2, drag: 4, accY: 0.8, alpha: 0.55, color: [0.9, 0.88, 0.85] });
const SHELL = P({ sprite: S.spark, ramp: R.wSolid, life: [0.45, 0.6], size: [0.03, 0.045], orient: 'stretch', stretch: 0.06, drag: 0.4, accY: -14, color: [1.3, 0.9, 0.35], i: 1.1 });
const PELLET = P({ sprite: S.spark, ramp: R.wHot, life: [0.1, 0.16], size: [0.05, 0.07], orient: 'stretch', stretch: 0.2, drag: 1, i: [4, 6] });
const SNIPE_RING = P({ sprite: S.ring, ramp: R.wFade, life: 0.35, size: 0.4, end: 5, ease: 2.5, i: 2.4, noGround: true });
const CROSS = P({ sprite: S.rune, ramp: R.wInOut, life: 0.8, size: 2.6, end: 0.9, orient: 'flat', spin: 2, i: 2.4 });

/** muzzle point: explicit muzzle / socket, else pos (feet) + 1.25 m up + 0.8 m forward */
function muzzle(fx, p, c, out) {
  const m = p.muzzle ?? p.sockets?.weaponTip ?? p.sockets?.handR;
  if (m) return v3(m, out);
  if (p.pos && (p.pos.y ?? 0) - c.y > 0.6) return out.set(c.x, c.y0, c.z);
  return out.set(c.x + c.f.x * 0.8 + c.rt.x * 0.25, c.y + 1.25, c.z + c.f.z * 0.8 + c.rt.z * 0.25);
}

K.muzzle_flash = (fx, p) => {
  const c = ctx(fx, p), s = c.s, w = p.weapon || 'pistol';
  const m = muzzle(fx, p, c, _a), f = c.f;
  const col = tc(c.tint, 0xffc070, 1);
  const big = w === 'shotgun' ? 1.5 : w === 'rifle' ? 1.7 : 1;
  const o = fx.o(s * big, col);
  o.rot = Math.random() * 3; fx.spawn(MUZ_STAR, m.x, m.y, m.z, 0, 0, 0, o);
  fx.spawn(MUZ_GLOW, m.x, m.y, m.z, 0, 0, 0, fx.o(s * big, col));
  // forward flame tongues (billboards pushed along the barrel)
  for (let i = 0; i < 3; i++) { const k = 0.25 + i * 0.28; const oo = fx.o(s * big * (1 - i * 0.2), col); oo.rot = 0; fx.spawn(MUZ_CONE, m.x + f.x * k * big, m.y, m.z + f.z * k * big, f.x * 2, 0, f.z * 2, oo); }
  if (w === 'shotgun') {
    const op = fx.o(s, col);
    for (let i = 0; i < fx.n(24); i++) { fx.rdir(_b, f, 0.28); const v = fx.r(40, 70); fx.spawn(PELLET, m.x, m.y, m.z, _b.x * v, _b.y * v * 0.3, _b.z * v, op); }
    fx.sphere(GEN.spark, 16, m, 4, 10, s, col, f, 0.6);
  } else fx.sphere(GEN.spark, w === 'rifle' ? 10 : 5, m, 3, 8, s, col, f, 0.5);
  if (w === 'rifle') fx.at(SNIPE_RING, _b.copy(m).addScaledVector(f, 0.6), s, col);
  fx.sphere(MUZ_SMOKE, w === 'pistol' ? 2 : 5, m, 0.3, 1.2, s, null, f, 0.6);
  const os = fx.o(s, null);
  fx.spawn(SHELL, m.x - f.x * 0.5, m.y + 0.05, m.z - f.z * 0.5, c.rt.x * fx.r(1.5, 3), fx.r(2, 4), c.rt.z * fx.r(1.5, 3), os);
};
K.bullet_tracer = (fx, p) => {       // hitscan tracer from muzzle to target + tiny impact
  const c = ctx(fx, p, null, 1, 16, 16), m = muzzle(fx, p, c, _a);
  const to = p.to ? v3(p.to, _b) : _b.set(c.tx, c.ty + 1.1, c.tz);
  fx.beam({ from: m.clone(), to: to.clone(), kind: 'tracer', color: tc(c.tint, 0xffd890, 2.6), width: 0.09 * c.s, speed: p.speed ?? 180, length: 3.5, dur: 0.3 });
  if (p.impact !== false) setImpact(fx, to, c.f, 0.6);
  if (p.flash !== false) K.muzzle_flash(fx, { ...p, weapon: p.weapon ?? 'pistol' });
};
function setImpact(fx, to, f, s) { const T = fx.task(DELAYED, { pos: to, delay: 0.05, s, dir: f }); return T; }
const DELAYED = { name: 'delayedHit', init(T) { T.dur = T.p.delay; }, stop(T) { hit(T.fx, { pos: T.pos, dir: T.p.dir, element: 'physical', scale: T.p.s }); } };
K.sniper_round = (fx, p) => {        // heavy rifle round: thick tracer, muzzle shock, big impact
  const c = ctx(fx, p, null, 1, 24, 24), s = c.s, m = muzzle(fx, p, c, _a).clone();
  const to = p.to ? v3(p.to, _b).clone() : vec(c.tx, c.ty + 1.1, c.tz);
  const col = tc(c.tint, 0xffe0a0, 2.8);
  K.muzzle_flash(fx, { ...p, weapon: 'rifle' });
  fx.beam({ from: m, to, kind: 'tracer', color: col, width: 0.22 * s, speed: 260, length: 9, dur: 0.3 });
  fx.beam({ from: m, to, kind: 'glow', color: [col[0] * 0.25, col[1] * 0.25, col[2] * 0.25], width: 0.5 * s, dur: 0.12, fade: 0.25 });
  for (let i = 0; i < 4; i++) fx.at(SNIPE_RING, _c.lerpVectors(m, to, 0.12 + i * 0.08), s * (1 - i * 0.15), col, { dt: i * 0.012, rot: 0 });
  fx.task(SNIPE_IMPACT, { pos: to, delay: m.distanceTo(to) / 260, dir: c.f, scale: s, color: p.color });
};
const SNIPE_IMPACT = { name: 'sniper_impact', init(T) { T.dur = T.p.delay; }, stop(T) { K.sniper_impact(T.fx, T.p); } };
K.sniper_impact = (fx, p) => {
  const c = ctx(fx, p), s = c.s, pos = v3(p.pos, _c).clone();
  const col = tc(c.tint, 0xffd080, 1.6);
  hit(fx, { pos, dir: c.f, crit: true, element: 'physical', scale: 1.5 * s });
  fx.at(GEN.flare, pos, 3 * s, col, { rot: 0 });
  fx.at(GEN.ringThin, pos, 0.8 * s, col, { life: 0.35 });
  fx.sphere(GEN.sparkLong, 30, pos, 6, 16, s, col, c.f, 0.7);
  const g = vec(pos.x, fx.gy(pos.x, pos.z, pos.y), pos.z);
  if (pos.y - g.y < 2.5) shockwave(fx, { pos: g, radius: 3 * s, color: col, dur: 0.3, wall: false });
  fx.shake(0.18 * s, pos);
};
K.perfect_shot = K.sniper_round;
K.focused_shot = K.sniper_round;
K.grenade = (fx, p) => {             // lobbed grenade → fiery explosion
  const c = ctx(fx, p, null, 3, 8, 7), m = muzzle(fx, p, c, _a).clone();
  const to = vec(c.tx, c.ty, c.tz);
  fx.projectile({ from: m, to, kind: 'grenade', arc: p.arc ?? 3.2, speed: p.speed ?? 15, scale: c.s, impact: false, onHit: pos => { explosion(fx, pos, 1.3 * c.s, 'fire', { color: p.color }); fx.shake(0.3, pos); } });
};
K.explosion = (fx, p) => { const c = ctx(fx, p, null, 2.6); explosion(fx, vec(c.x, c.y + 0.3, c.z), c.R / 2.6, 'fire', { color: p.color }); fx.shake(0.25 * c.R / 2.6, vec(c.x, c.y, c.z)); };
K.explosion_big = (fx, p) => { const c = ctx(fx, p, null, 5); explosion(fx, vec(c.x, c.y + 0.3, c.z), c.R / 2.2, 'fire', { color: p.color }); fx.flash(0.15, [1, 0.7, 0.4]); fx.shake(0.6, vec(c.x, c.y, c.z)); };
K.dragon_shot = (fx, p) => {         // flame slug + fiery detonation
  const c = ctx(fx, p, null, 2, 16, 16), m = muzzle(fx, p, c, _a).clone();
  K.muzzle_flash(fx, { ...p, weapon: 'shotgun', color: p.color ?? 0xff8a3a });
  fx.projectile({ from: m, dir: c.f, kind: 'slug', range: c.L, speed: 55, scale: c.s * 1.2 });
};
K.dual_buckshot = (fx, p) => { K.muzzle_flash(fx, { ...p, weapon: 'shotgun' }); const c = ctx(fx, p, null, 2, 5); const g = vec(c.x + c.f.x * 3, c.y + 1.1, c.z + c.f.z * 3); for (let i = 0; i < 5; i++) fx.hit({ pos: _b.set(g.x + fx.r(-1, 1), g.y + fx.r(-0.4, 0.4), g.z + fx.r(-1, 1)), dir: c.f, scale: 0.6 }); };
K.last_request = (fx, p) => {        // kick then point-blank shotgun blast
  const c = ctx(fx, p, null, 2.4, 4); K.muzzle_flash(fx, { ...p, weapon: 'shotgun' });
  explosion(fx, vec(c.x + c.f.x * 2, c.y + 1, c.z + c.f.z * 2), 0.9 * c.s, 'fire');
};
K.spiral_tracker = (fx, p) => {      // homing pistol rounds
  const c = ctx(fx, p, null, 1, 10, 10);
  for (let i = 0; i < 4; i++) {
    const a = (i - 1.5) * 0.5, d = vec(c.f.x * Math.cos(a) - c.f.z * Math.sin(a), 0.1, c.f.z * Math.cos(a) + c.f.x * Math.sin(a));
    fx.projectile({ from: vec(c.x + c.f.x * 0.8, c.y + 1.25, c.z + c.f.z * 0.8), dir: d, kind: 'bolt', color: tc(c.tint, 0xffc070, 1), homing: p.homing, to: p.homing ? undefined : vec(c.tx + fx.r(-1, 1), c.ty + 1, c.tz + fx.r(-1, 1)), speed: 26, scale: 0.6, delay: i * 0.05 });
  }
  K.muzzle_flash(fx, p);
};
K.equilibrium = {                    // holding: rapid pistol fire in a sweeping arc
  name: 'equilibrium', fade: 0.05, group: 'Pistoleer',
  init(T) { ctx(T.fx, T.p, T.v.c = {}, 1, 12, 12); T.dur = T.p.dur ?? 1.2; T.v.k = 0; },
  tick(T) {
    const fx = T.fx, c = T.v.c;
    if (T.stopping) return;
    const n = T.rate('s', 14);
    for (let i = 0; i < n; i++) {
      const a = Math.sin(T.age * 7 + T.v.k++) * 0.5, d = _c.set(c.f.x * Math.cos(a) - c.f.z * Math.sin(a), 0, c.f.z * Math.cos(a) + c.f.x * Math.sin(a));
      const from = vec(c.x + d.x * 0.8 + c.rt.x * (T.v.k % 2 ? 0.3 : -0.3), c.y + 1.25, c.z + d.z * 0.8 + c.rt.z * (T.v.k % 2 ? 0.3 : -0.3));
      K.bullet_tracer(fx, { pos: vec(c.x, c.y, c.z), muzzle: from, to: vec(from.x + d.x * c.L, c.y + 1.0, from.z + d.z * c.L), color: T.p.color, dir: d });
    }
  },
};
K.shotgun_rapid = K.equilibrium;
K.target_down = {                    // rifle: crosshair decal + three precise heavy rounds
  name: 'target_down', fade: 0.1, group: 'Pistoleer',
  init(T) { const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 2.5, 12, 10); T.v.tgt = vec(c.tx, c.ty, c.tz); fx.at(CROSS, _a.set(c.tx, c.ty + 0.07, c.tz), c.R / 2.5, [1, 0.3, 0.2]); T.dur = 1.1; },
  tick(T) {
    const c = T.v.c;
    for (let k = 0; k < 3; k++) if (T.once('s' + k, 0.25 + k * 0.3)) K.sniper_round(T.fx, { pos: vec(c.x, c.y, c.z), to: vec(T.v.tgt.x + T.fx.r(-0.5, 0.5), T.v.tgt.y + 1, T.v.tgt.z + T.fx.r(-0.5, 0.5)), dir: c.f, color: T.p.color });
  },
};
K.catastrophe = {                    // artillery: shells rain over the area
  name: 'catastrophe', fade: 0.1, group: 'Pistoleer',
  init(T) { const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 5, 10, 8); T.v.i = 0; T.dur = 1.6; fx.telegraph({ shape: 'circle', pos: vec(c.tx, c.ty, c.tz), radius: c.R, color: 'orange', dur: 0.5, detonate: false }); },
  tick(T) {
    const fx = T.fx, c = T.v.c;
    while (T.v.i < 10 && T.age > 0.5 + T.v.i * 0.09) {
      const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * c.R;
      const x = c.tx + Math.cos(a) * r, z = c.tz + Math.sin(a) * r;
      fx.beam({ from: vec(x - c.f.x * 4, c.ty + 18, z - c.f.z * 4), to: vec(x, c.ty, z), kind: 'tracer', color: [2.6, 1.6, 0.8], width: 0.2, speed: 120, length: 6, dur: 0.3 });
      fx.task(BOOM, { pos: vec(x, c.ty, z), delay: 0.15, s: 0.9 * c.s });
      T.v.i++;
    }
  },
};
const BOOM = { name: 'boom', init(T) { T.dur = T.p.delay; }, stop(T) { explosion(T.fx, T.pos, T.p.s, 'fire'); T.fx.shake(0.15, T.pos); } };

for (const k in K) K[k].group = K[k].group || 'Pistoleer';
K.explosion.group = K.explosion_big.group = 'Utility';
export const GUNNER = K;
