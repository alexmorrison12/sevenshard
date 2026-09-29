// Primitive effects behind the FX API: slash, burst, shockwave, hit, death, pickup, decal (+ handle), and the task
// recipes for projectile, beam/lightning, meteor, aura, trail, telegraph, portal, loot beam, counter window, weather.
import * as THREE from 'three';
import { S, R } from './textures.js';
import { P } from './particles.js';
import { GEN, PHYS, FIRE, FROST, HOLY, STORM, CHI, DARK, ARC, HEAL, MUSIC, WATER, POI, CRIM, AMB, FAM } from './ptypes.js';
import { col, v3, TELE, GRADES, gradeOf, elemOf, TAU, DEG, lin, hue, UP, hasCol } from './util.js';
import { SHAPE, DECAL, DECAL_DEF, TSTRIDE } from './ground.js';
import { NOOP } from './tasks.js';

const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3();
const _A = new THREE.Vector3(), _B = new THREE.Vector3(), _C = new THREE.Vector3(), _t = new THREE.Vector3(), _u = new THREE.Vector3(0, 1, 0);
const _c0 = [0, 0, 0], _c1 = [0, 0, 0], _c2 = [0, 0, 0], _h = [0, 0, 0];
const _qt = new THREE.Quaternion();

export const angRad = a => a > 6.3 ? a * DEG : a;

// ------------------------------------------------------------------ slash
function rotAbout(v, axis, ang) { _qt.setFromAxisAngle(axis, ang); return v.applyQuaternion(_qt); }
const SLASH_STYLES = ['h', 'v', 'up', 'd', 'x', 'spin', 'thrust', 'claw', 'wave'];
const STYLE_ALIAS = { horizontal: 'h', sword: 'h', slash: 'h', vertical: 'v', down: 'v', overhead: 'v', diagonal: 'd', cross: 'x', uppercut: 'up', rising: 'up', stab: 'thrust', spinning: 'spin', whirl: 'spin' };
export function slash(fx, p) {
  const style = STYLE_ALIAS[p.style] || p.style || 'h';
  v3(p.pos, _C); fx._dir(p.dir, _f); _r.set(-_f.z, 0, _f.x);
  // pos may be the feet (we lift by `height`) or already the arc pivot (clearly above the ground → no lift)
  const aboveGround = _C.y - fx.gy(_C.x, _C.z, 0) > 0.45;
  const R0 = p.radius ?? 3;
  let arc = angRad(p.arc ?? (style === 'spin' ? TAU : style === 'v' || style === 'up' ? 2.3 : style === 'thrust' ? 1 : 2.6));
  const W0 = R0 * (style === 'thrust' ? 0.16 : 0.4);
  const W = p.width == null ? W0 : (p.width <= 2 && !p.absWidth ? W0 * p.width : p.width);
  const c = col(p.color ?? 0xffe6b0, p.intensity ?? 2.2, _c0);
  const dur = p.dur ?? (style === 'spin' ? 0.5 : style === 'wave' ? 0.9 : 0.34);
  const cw = (p.cw === false || p.cw === -1 ? -1 : 1) * (p.flip ? -1 : 1);
  const delay = p.delay ?? 0;
  const vertical = style === 'v' || style === 'up';
  const hgt = p.height ?? (aboveGround ? 0 : vertical ? 1.15 : 1.0);
  const flags = (p.dark ? 2 : 0) | (p.flat ? 4 : 0) | (style === 'thrust' ? 1 : 0) | ((p.speed || style === 'wave') ? 8 : 0);
  const sweep = p.sweep ?? (style === 'spin' ? 0.55 : style === 'wave' ? 0.04 : 0.3);
  const grow = p.grow ?? (style === 'wave' ? 0.35 : 0.12);
  _p.copy(_C).addScaledVector(UP, hgt);
  if (vertical) _p.addScaledVector(_f, p.forward ?? 0.25);
  if (style === 'x') {
    slash(fx, { ...p, style: 'd', tilt: 0.7, cw: 1, delay });
    slash(fx, { ...p, style: 'd', tilt: -0.7, cw: -1, delay: delay + 0.08 });
    return;
  }
  if (style === 'claw') {
    for (let k = -1; k <= 1; k++) slash(fx, { ...p, style: 'd', tilt: 0.9, radius: R0 * (1 - Math.abs(k) * 0.12), width: W * 0.35, arc: 1.6, height: hgt + k * 0.35, delay: delay + (k + 1) * 0.03, glow: false, sparks: false, grow: 0.05 });
    return;
  }
  if (style === 'thrust') { _A.copy(_f); _B.copy(_r); arc = 1; }
  else if (style === 'wave') { _A.copy(_r).negate(); _B.copy(UP); if (p.arc == null) arc = Math.PI; _p.copy(_C); _p.y = fx.gy(_C.x, _C.z, _C.y) + (p.height ?? 0.1); }
  else if (style === 'v') {
    const f0 = p.from ?? 1.95;
    _A.copy(_f).multiplyScalar(Math.cos(f0)).addScaledVector(UP, Math.sin(f0));
    _B.copy(_f).multiplyScalar(Math.sin(f0)).addScaledVector(UP, -Math.cos(f0));
  } else if (style === 'up') {
    const f0 = p.from ?? -0.75;
    _A.copy(_f).multiplyScalar(Math.cos(f0)).addScaledVector(UP, Math.sin(f0));
    _B.copy(_f).multiplyScalar(-Math.sin(f0)).addScaledVector(UP, Math.cos(f0));
  } else {
    const h = arc / 2;
    _A.copy(_f).multiplyScalar(Math.cos(h)).addScaledVector(_r, Math.sin(h) * cw);
    _B.copy(_f).multiplyScalar(Math.sin(h)).addScaledVector(_r, -Math.cos(h) * cw);
    const tilt = p.tilt ?? (style === 'd' ? 0.6 * cw : 0);
    if (tilt) { rotAbout(_A, _f, tilt); rotAbout(_B, _f, tilt); }
  }
  if (vertical && p.tilt) { rotAbout(_A, _f, p.tilt); rotAbout(_B, _f, p.tilt); }
  const vel = (p.speed || style === 'wave') ? _e.copy(_f).multiplyScalar(p.speed ?? 20) : null;
  const len = style === 'thrust' ? (p.length ?? R0) : R0;
  fx.slashes.spawn(_p, _A, _B, len, arc, W, c, dur, sweep, grow, vel, flags, delay);
  if (p.glow !== false) {
    const g = hue(c, _c1); const k = p.dark ? 0.7 : 0.26;
    g[0] *= k; g[1] *= k; g[2] *= k;
    fx.slashes.spawn(_p, _A, _B, len * 1.04, arc, W * 1.5, g, dur * 1.15, sweep, grow * 1.2, vel, p.dark ? flags : flags & 5, delay);
  }
  // sparks flung off the blade edge
  if (p.sparks !== false && style !== 'thrust') {
    const n = fx.n(p.sparkCount ?? Math.round(8 + R0 * 3));
    const tint = hue(c, _c2);
    const o = fx.o(1, tint);
    for (let i = 0; i < n; i++) {
      const u = Math.random(), th = u * arc;
      _d.copy(_A).multiplyScalar(Math.cos(th)).addScaledVector(_B, Math.sin(th));        // radial
      _t.copy(_A).multiplyScalar(-Math.sin(th)).addScaledVector(_B, Math.cos(th));       // tangent
      const sp = fx.r(4, 10) * Math.min(1.6, 0.6 + R0 * 0.15);
      o.dt = delay + u * sweep * dur;
      fx.spawn(GEN.spark, _p.x + _d.x * len + (vel ? vel.x * o.dt : 0), _p.y + _d.y * len, _p.z + _d.z * len + (vel ? vel.z * o.dt : 0), _t.x * sp + _d.x * sp * 0.5, _t.y * sp + _d.y * sp * 0.5 + 1.5, _t.z * sp + _d.z * sp * 0.5, o);
    }
  }
}
slash.STYLES = SLASH_STYLES;

// ------------------------------------------------------------------ burst
const BK = {
  spark: [GEN.spark, GEN.flash, null], fire: [FIRE.burst, FIRE.flash, FIRE.ember], frost: [FROST.shard, FROST.flash, FROST.sparkle],
  holy: [HOLY.star, HOLY.flash, HOLY.spark], dark: [DARK.burst, DARK.flash, DARK.spark], arcane: [ARC.star, ARC.flash, ARC.spark],
  lightning: [STORM.spark, STORM.flash, STORM.bolt], blood: [PHYS.blood, null, PHYS.bloodMist], water: [WATER.spray, null, WATER.foam],
  poison: [POI.bubble, null, POI.mist], dust: [PHYS.dust, null, PHYS.pebble], smoke: [PHYS.smoke, null, null], star: [GEN.star, GEN.flash, null],
  feather: [HOLY.feather, null, HOLY.star], note: [MUSIC.note, null, MUSIC.sparkle], leaf: [HEAL.leaf, null, HEAL.mote], petal: [HEAL.petal, null, HEAL.mote],
  ember: [FIRE.emberFloat, null, null], heal: [HEAL.plus, HEAL.glow, HEAL.mote], crimson: [CRIM.burst, CRIM.flash, CRIM.spark], chi: [CHI.spark, CHI.palm, CHI.wisp],
  sand: [PHYS.sand, null, PHYS.sandGrain], confetti: [GEN.star, GEN.flash, GEN.spark], coin: [null, null, null], shard: [null, null, null], debris: [null, null, null],
};
const BURST_COL = { spark: 0xffd8a0, holy: 0xffd97a, heal: 0x6aff8a, confetti: 0xffd060, star: 0xffffff, chi: 0x7fe0ff };
export function burst(fx, p) {
  const kind = p.kind || 'spark';
  const pos = v3(p.pos, _C);
  const s = p.scale ?? (p.size != null ? Math.max(0.3, Math.min(4, p.size / 0.3)) : 1), n = p.count ?? 24, sp = p.speed ?? 6;
  const tint = p.color !== undefined ? col(p.color, 1, _c0) : (BURST_COL[kind] ? col(BURST_COL[kind], 1, _c0) : null);
  const dir = p.dir ? fx.dir3(p.dir, _d) : null, spread = p.spread ?? (dir ? 0.9 : Math.PI);
  const [main, flash, extra] = BK[kind] || BK.spark;
  const life = p.life != null ? Math.max(0.3, Math.min(4, p.life / 0.5)) : 1;
  const ex = { life };
  if (flash && p.flash !== false) fx.at(flash, pos, s * Math.min(1.3, 0.45 + n / 60), tint);
  if (kind === 'coin') {
    const o = fx.o(s, null); o.life = life;
    const m = fx.n(n);
    for (let i = 0; i < m; i++) { fx.rdir(_e, _u, 0.8); const v = fx.r(0.5, 1) * sp; fx.spawn(COIN, pos.x, pos.y, pos.z, _e.x * v, _e.y * v + 3, _e.z * v, o); }
    return;
  }
  if (kind === 'shard') { fx.meshes.shards(pos.x, pos.y, pos.z, Math.min(40, n), s, { color: tint || [0.62, 0.85, 1], glow: tint ? hue(tint, _c1) : [0.4, 0.75, 1.5], speed: sp, dir }); fx.sphere(FROST.sparkle, n * 0.6, pos, 1, sp * 0.6, s, tint); return; }
  if (kind === 'debris') { fx.meshes.debris(pos.x, pos.y, pos.z, Math.min(40, n), s, sp, { gy: fx.gy(pos.x, pos.z, pos.y) }); fx.radial(PHYS.dust, n * 0.4, pos, 1, 3, 0.2, 1, s); return; }
  if (kind === 'dust' || kind === 'sand') { fx.radial(main, n * 0.6, pos, sp * 0.2, sp * 0.5, 0.2, 1.2, s, tint, 0.3, 0.2, ex); if (extra) fx.radial(extra, n * 0.4, pos, sp * 0.3, sp * 0.7, 2, 5, s); return; }
  if (main) {
    if (dir) fx.sphere(main, n, pos, sp * 0.5, sp, s, tint, dir, spread, 0, ex);
    else {
      const m = fx.n(n), up = p.up ?? 0.25;
      const o = fx.o(s, tint); o.life = life;
      for (let i = 0; i < m; i++) { fx.rdir(_e); const v = fx.r(0.5, 1) * sp; fx.spawn(main, pos.x, pos.y, pos.z, _e.x * v, _e.y * v + up * sp, _e.z * v, o); }
    }
  }
  if (extra) fx.sphere(extra, n * 0.4, pos, sp * 0.3, sp * 0.8, s, tint, dir, spread, 0, ex);
}
const COIN = P({ sprite: S.coin, ramp: R.wSolid, life: [0.7, 1.0], size: [0.18, 0.24], spin: [-8, 8], randSpin: true, drag: 0.6, accY: -14, color: [1.5, 1.1, 0.35], i: 1.1 });

// ------------------------------------------------------------------ shockwave
export function shockwave(fx, p) {
  const pos = v3(p.pos, _C);
  const Rr = p.radius ?? 6, dur = p.dur ?? (0.35 + Rr * 0.04), delay = p.delay ?? 0;
  const c = col(p.color ?? [1.5, 1.25, 0.9], p.intensity ?? 1, _c0);
  const gy = fx.gy(pos.x, pos.z, pos.y); _p.set(pos.x, gy, pos.z);
  fx.rings.ground(_p, Rr, dur, c, { ew: p.width ?? (0.14 + Rr * 0.025), trail: Rr * 0.4, ease: p.ease ?? 3, flags: p.pressure === false ? 0 : 1, delay, r0: p.from ?? 0 });
  if (p.wall ?? Rr >= 4) {
    const k = p.wallIntensity ?? 0.42;
    _c1[0] = c[0] * k; _c1[1] = c[1] * k; _c1[2] = c[2] * k;
    fx.rings.walls(_p, Rr * 0.96, dur * 0.95, _c1, { h: p.height ?? Math.min(2.4, 0.5 + Rr * 0.16), delay, ease: p.ease ?? 3, r0: p.from ?? 0 });
  }
  if (p.dust ?? true) {
    const n = fx.n(p.dustCount ?? Math.round(8 + Rr * 2.5));
    const o = fx.o(Math.min(2, 0.7 + Rr * 0.08), p.dustColor ? col(p.dustColor, 1, _c2) : null);
    const v = Rr / dur * 0.42;
    for (let i = 0; i < n; i++) {
      const a = (i + Math.random()) / n * TAU;
      o.dt = delay + Math.random() * 0.05;
      fx.spawn(PHYS.dustRing, _p.x + Math.cos(a) * Rr * 0.15, gy + 0.25, _p.z + Math.sin(a) * Rr * 0.15, Math.cos(a) * v * fx.r(0.8, 1.2), fx.r(0.2, 1.2), Math.sin(a) * v * fx.r(0.8, 1.2), o);
    }
  }
}

// ------------------------------------------------------------------ hit
const HIT_CUT = P({ sprite: S.flare, ramp: R.wFlash, life: 0.1, size: 1.6, end: 1.2, ease: 2, i: 2.2, noGround: true });
const HIT_FLASH = P({ sprite: S.flash, ramp: R.wFlash, life: 0.09, size: 1.0, end: 1.3, ease: 2, i: 2.2, noGround: true });
const HIT_STAR = P({ sprite: S.star, ramp: R.wFlash, life: 0.11, size: 0.9, end: 1.35, i: 2.6, noGround: true });
const HIT_RING = P({ sprite: S.ring, ramp: R.wFade, life: 0.22, size: 0.3, end: 5, ease: 2.5, i: 2.2, noGround: true });
export function hit(fx, p) {
  const s = p.scale ?? 1, crit = !!p.crit;
  const E = elemOf(p.element), F = FAM[E.fam];
  v3(p.pos, _C);
  // pull the impact out of the body toward the camera so it is never hidden
  _d.subVectors(fx.camPos, _C); const L = _d.length(); if (L > 1e-3) _C.addScaledVector(_d, Math.min(0.4 * s, L * 0.5) / L);
  const dir = p.dir ? fx.dir3(p.dir, _e) : _d.normalize();
  const k = crit ? 1.45 : 1;
  fx.at(HIT_FLASH, _C, s * k, E.c);
  fx.at(HIT_STAR, _C, s * k, E.core, { rot: Math.random() * 3 });
  fx.at(HIT_CUT, _C, s * k * 0.8, E.c, { rot: Math.random() * 3.14 });
  fx.sphere(F.spark, crit ? 22 : 12, _C, 4, crit ? 12 : 8, s, E.c, dir, 1.1);
  if (F.chunk && F.chunk !== HOLY.cross) fx.sphere(F.chunk, crit ? 6 : 3, _C, 1.5, 4, s * (F.chunk === PHYS.pebble ? 1 : 0.7), E.c, dir, 1.3);
  else if (F.chunk === HOLY.cross) fx.sphere(HOLY.star, crit ? 8 : 4, _C, 1.5, 4, s * 0.8, E.c, dir, 1.3);
  if (F.smoke && E.fam !== 'spark') fx.sphere(F.smoke, 2, _C, 0.4, 1.2, s * 0.6, E.c);
  if (crit) {
    fx.at(GEN.starFlash, _C, s * 0.95, E.core, { rot: Math.random(), life: 0.8 });
    fx.at(HIT_RING, _C, s, E.c);
    fx.shake(0.08 * s, _C);
  }
  if (p.back) fx.at(GEN.starFlash, _C, s * 1.2, lin(0xff9a30, 1.2), { rot: 0.4 });
}

// ------------------------------------------------------------------ death
const SOUL = P({ sprite: S.wisp, ramp: R.spirit, life: [1.2, 1.6], size: [0.5, 0.8], end: 1.4, motion: 'orbit', rise: 1.6, rgrow: 0.05, spin: [-0.5, 0.5], i: [1.8, 2.6] });
const DSMOKE = P({ pool: 'alpha', sprite: [S.smoke1, S.smoke2, S.smoke3], ramp: R.void, life: [0.8, 1.3], size: [0.6, 0.9], end: [2.2, 3], ease: 2, spin: [-1, 1], drag: 2.5, accY: 1.2, turb: 0.2 });
export function death(fx, p) {
  const kind = p.kind || 'mob', s = p.scale ?? 1;
  const pos = v3(p.pos, _C), gy = fx.gy(pos.x, pos.z, pos.y); _p.set(pos.x, gy, pos.z);
  const tint = p.color !== undefined ? col(p.color, 1, _c0) : null;
  const up = _q.set(pos.x, gy + 0.9 * s, pos.z);
  if (kind === 'boss') {
    fx.at(GEN.bigFlash, up, s * 1.6, tint || [1, 0.8, 0.6]);
    fx.at(GEN.rays, up, s * 2, tint || [1, 0.85, 0.6], { dt: 0.05 });
    shockwave(fx, { pos: _p, radius: 9 * s, color: tint || [1.5, 1.2, 0.9], dur: 0.8 });
    fx.sphere(FIRE.bigSmoke, 18, up, 1, 4, s * 1.4, null, _u, 1.2);
    fx.sphere(DARK.ember, 60, up, 2, 8, s, tint, _u, 1.3);
    fx.meshes.debris(up.x, up.y, up.z, 18, s * 1.2, 9, { gy });
    fx.shake(0.7, pos); fx.flash(0.35, tint || [1, 0.9, 0.8]);
    decal(fx, { pos: _p, radius: 5 * s, kind: 'crater', dur: 14 });
    return NOOP;
  }
  if (kind === 'player') {
    fx.radial(AMB.spiritGlow, 8, up, 0.2, 0.6, 0.6, 1.2, s * 0.6, tint);
    for (let i = 0; i < fx.n(10); i++) fx.spawn(SOUL, pos.x, gy + fx.r(0.3, 1.4) * s, pos.z, fx.r(0.1, 0.5) * s, fx.r(0, TAU), fx.r(-2, 2), fx.o(s, tint));
    fx.at(PHYS.hitFlash, up, s * 2, tint || [0.6, 0.85, 1]);
    return NOOP;
  }
  if (kind === 'beast') {
    fx.sphere(PHYS.blood, 16, up, 1.5, 4, s, null, _u, 1.2);
    fx.radial(PHYS.dust, 10, _p, 0.8, 2.2, 0.2, 0.8, s, null, 0.3, 0.2);
    decal(fx, { pos: _p, radius: 0.9 * s, kind: 'blood', dur: 9 });
    return NOOP;
  }
  if (kind === 'undead') {
    fx.radial(PHYS.dust, 12, _p, 0.8, 2.5, 0.2, 1.0, s, null, 0.3, 0.3);
    fx.sphere(PHYS.pebble, 12, up, 2, 5, s, [0.8, 0.78, 0.7], _u, 1.2);
    for (let i = 0; i < fx.n(6); i++) fx.spawn(SOUL, pos.x, gy + fx.r(0.3, 1.2) * s, pos.z, fx.r(0.1, 0.4) * s, fx.r(0, TAU), fx.r(-2, 2), fx.o(s, [0.5, 1, 0.8]));
    return NOOP;
  }
  // mob / demon: dark dissolve puff + soul wisps + embers
  const demon = kind === 'demon';
  const t = tint || (demon ? [0.9, 0.2, 1] : [0.7, 0.4, 1]);
  fx.at(PHYS.hitFlash, up, s * 1.8, t);
  fx.radial(DSMOKE, 14, _p, 0.6, 1.8, 0.6, 1.8, s, null, 0.25, 0.4);
  fx.sphere(demon ? DARK.flame : DARK.wisp, 10, up, 1, 3, s, t, _u, 1.1);
  fx.sphere(DARK.ember, demon ? 30 : 16, up, 1.5, 4.5, s, demon ? null : t, _u, 1.3);
  for (let i = 0; i < fx.n(4); i++) fx.spawn(SOUL, pos.x, gy + fx.r(0.4, 1.2) * s, pos.z, fx.r(0.1, 0.4) * s, fx.r(0, TAU), fx.r(-2, 2), fx.o(s, t));
  if (demon) { fx.at(DARK.ring, _p, s * 0.25, t, null, 0, 0.05, 0); decal(fx, { pos: _p, radius: 1.1 * s, kind: 'scorch', dur: 6, color: [0.8, 0.2, 1] }); }
  return NOOP;
}

// ------------------------------------------------------------------ pickup
const PICK = {
  gold: { c: 0xffc84a, pr: COIN }, silver: { c: 0xdfe6f0, pr: COIN }, item: { c: 0xfff0c0, pr: null }, hp: { c: 0x5aff7a, pr: null },
  mp: { c: 0x4aa8ff, pr: null }, seed: { c: 0x9aff6a, pr: HEAL.leaf }, shard: { c: 0xb8f0ff, pr: null }, xp: { c: 0xd8a0ff, pr: null },
};
const PICK_RISE = P({ sprite: S.twinkle, ramp: R.wInOut, life: [0.5, 0.8], size: [0.16, 0.28], end: 0.2, drag: 1.5, accY: 3, i: [3, 5], spin: [-3, 3] });
export function pickup(fx, p) {
  const k = PICK[p.kind] || PICK.item, pos = v3(p.pos, _C);
  const c = col(p.color ?? k.c, 1, _c0);
  fx.at(GEN.flash, pos, 0.8, c, null, 0, 0.3, 0);
  fx.at(GEN.ringThin, _p.set(pos.x, fx.gy(pos.x, pos.z, pos.y) + 0.05, pos.z), 0.18, c, { life: 0.5 });
  fx.radial(PICK_RISE, 14, pos, 0.4, 1.2, 1.5, 3.5, 1, c, 0.2, 0.2);
  if (k.pr) fx.radial(k.pr, 6, pos, 0.5, 1.4, 3, 5, 1, k.pr === COIN ? null : c);
  if (p.to) { // streak toward the collector
    const to = v3(p.to, _q);
    for (let i = 0; i < fx.n(8); i++) { _d.subVectors(to, pos); const L = _d.length() || 1; const sp = L / 0.35; _d.multiplyScalar(sp / L); fx.spawn(GEN.spark, pos.x + fx.r(-0.2, 0.2), pos.y + 0.4, pos.z + fx.r(-0.2, 0.2), _d.x, _d.y + 2, _d.z, fx.o(1, c)); }
  }
}

// ------------------------------------------------------------------ decal (task-owned slot)
const DECAL_TASK = {
  name: 'decal', fade: 0.4,
  init(T) {
    const fx = T.fx, p = T.p, L = fx.ground.decal;
    const kindName = DECAL[p.kind] !== undefined ? p.kind : 'scorch';
    const def = DECAL_DEF[kindName] || DECAL_DEF.scorch;
    const s = L.alloc(); if (s < 0) { T.end(); return; }
    T.own(L, s); T.v.s = s;
    const dur = p.dur ?? def.dur;
    T.dur = isFinite(dur) ? dur + 0.05 : Infinity;
    const yaw = p.dir != null ? Math.atan2(-T.dir.x, -T.dir.z) : (p.rot ?? Math.random() * TAU);
    const c = p.color !== undefined ? col(p.color, p.intensity ?? 1, _c0) : def.c;
    const o = DW; o.x = T.pos.x; o.z = T.pos.z; o.y = fx.gy(T.pos.x, T.pos.z, T.pos.y);
    o.R = p.radius ?? 2; o.len = p.length ?? 0; o.yaw = yaw; o.dur = isFinite(dur) ? dur : 0; o.c = c; o.kind = DECAL[kindName];
    o.fin = p.fadeIn ?? def.fin; o.seed = Math.random() * 50; o.inten = p.intensity ?? 1; o.hot = p.hot ?? def.hot; o.t0 = fx.time + (p.delay ?? 0);
    fx.ground.decalWrite(s, o);
    T.v.t0 = o.t0;
  },
  moved(T) { const fx = T.fx, L = fx.ground.decal, b = T.v.s * 16; L.data[b] = T.pos.x; L.data[b + 1] = fx.gy(T.pos.x, T.pos.z, T.pos.y); L.data[b + 2] = T.pos.z; L.touch(T.v.s); },
  stop(T) {  // quick fade: rewrite t0/dur so the shader's fade-out starts now (≈0.35 s)
    const L = T.fx.ground.decal, b = T.v.s * 16, d = L.data, now = T.fx.time;
    const nd = 0.55; d[b + 7] = nd; d[b + 3] = Math.min(now - 0.65 * nd, d[b + 3]); L.touch(T.v.s);
    T.fadeT = 0.4;
  },
};
const DW = {};
export function decal(fx, p) { return fx.task(DECAL_TASK, p); }

// ------------------------------------------------------------------ telegraph
export const TELEGRAPH = {
  name: 'telegraph', fade: 0.26,
  init(T) {
    const fx = T.fx, p = T.p, L = fx.ground.tele;
    const s = L.alloc(); if (s < 0) { T.end(); return; }
    T.own(L, s); T.v.s = s;
    const shape = SHAPE[p.shape] ?? 0;
    const pal = TELE[p.color ?? 'red'];
    let fill, rim;
    if (pal) { fill = pal.fill; rim = pal.rim; }
    else { fill = col(p.color, 1, [0, 0, 0]); rim = [fill[0] * 3.2 + 0.2, fill[1] * 3.2 + 0.2, fill[2] * 3.2 + 0.2]; }
    const timed = p.dur != null && isFinite(p.dur) && p.dur > 0;
    const o = TW;
    o.x = T.pos.x; o.z = T.pos.z; o.y = fx.gy(T.pos.x, T.pos.z, T.pos.y); o.dx = T.dir.x; o.dz = T.dir.z; o.shape = shape;
    if (shape === SHAPE.rect) { o.R = p.length ?? 10; o.W = p.width ?? (p.shape === 'line' ? 1.8 : 4); }
    else if (shape === SHAPE.donut) { o.R = p.radius ?? p.outer ?? 8; o.W = p.inner ?? o.R * 0.45; }
    else { o.R = p.radius ?? p.length ?? 5; o.W = 0; }
    o.halfA = shape === SHAPE.cone ? angRad(p.angle ?? 1.57) / 2 : 0;
    o.n = shape === SHAPE.wedges ? (p.count ?? 8) : 0; o.phase = p.phase ?? 0;
    o.fill = fill; o.rim = rim;
    o.t0 = fx.time + (p.delay ?? 0); o.dur = timed ? p.dur : 0;
    o.flags = (timed && p.detonate !== false ? 1 : 0) | (!timed ? 2 : 0) | (p.fill === false ? 4 : 0) | (p.reverse ? 8 : 0);
    o.seed = Math.random(); o.inten = p.intensity ?? 1;
    fx.ground.teleWrite(s, o);
    T.v.t0 = o.t0; T.v.det = timed ? o.t0 + p.dur : Infinity;
    T.dur = timed ? (p.delay ?? 0) + p.dur + 0.42 : Infinity;
    T.fadeT = timed ? 0.01 : 0.26;
  },
  tick(T) {
    if (T.v.det <= T.fx.time && !T.v.fired) {
      T.v.fired = true;
      try { T.p.onDetonate?.(T.pos); } catch (e) { console.error(e); }
    }
  },
  stop(T) {
    const fx = T.fx;
    if (fx.time < T.v.det + 0.3) { fx.ground.teleSet(T.v.s, 15, fx.time); T.fadeT = 0.25; }
  },
  setFill(T, v) { T.fx.ground.teleSet(T.v.s, 19, Math.max(0, Math.min(1, v))); },
  detonate(T) {
    const fx = T.fx, age = fx.time - T.v.t0;
    fx.ground.teleSet(T.v.s, 7, Math.max(0.01, age));
    fx.ground.teleSet(T.v.s, 21, fx.ground.teleGet(T.v.s, 21) | 1);
    T.v.det = fx.time; T.dur = T.age + 0.42; T.fadeT = 0.01;
  },
  moved(T) {
    const fx = T.fx, s = T.v.s;
    fx.ground.teleSet(s, 0, T.pos.x); fx.ground.teleSet(s, 1, fx.gy(T.pos.x, T.pos.z, T.pos.y)); fx.ground.teleSet(s, 2, T.pos.z);
    fx.ground.teleSet(s, 4, T.dir.x); fx.ground.teleSet(s, 5, T.dir.z);
  },
};
const TW = {};
void TSTRIDE;

// ------------------------------------------------------------------ projectiles
const PK = {};   // kind → { speed, color, size, init(T), tick(T), impact(fx, pos, dir, T) }
const K = {
  core: P({ sprite: S.flash, ramp: R.wPulse, life: 0.1, size: 0.45, i: 2.4, pingpong: true, noGround: true }),
  glow: P({ sprite: S.glow, ramp: R.wPulse, life: 0.16, size: 0.95, i: 1.25, pingpong: true, noGround: true }),
  halo: P({ sprite: S.glow, ramp: R.wPulse, life: 0.24, size: 1.6, i: 0.45, pingpong: true, noGround: true }),
  roil: P({ sprite: [S.blob], ramp: R.wPulse, life: 0.3, size: 0.85, spin: 11, i: 1.5, noGround: true }),
  swirl: P({ sprite: S.swirl, ramp: R.wConst, life: 1, size: 1.1, spin: -9, i: 1.9, noGround: true }),
  star: P({ sprite: S.star, ramp: R.wConst, life: 1, size: 0.85, spin: 7, i: 2.6, noGround: true }),
  dark: P({ pool: 'alpha', sprite: S.soft, ramp: R.wConst, life: 1, size: 0.8, color: [0.04, 0.0, 0.08], alpha: 0.95, noGround: true }),
  tail: P({ sprite: [S.blob, S.glow], ramp: R.wHot, life: [0.16, 0.24], size: [0.38, 0.52], end: 0.3, spin: [-4, 4], drag: 4, i: [0.9, 1.3] }),
  fireTail: P({ sprite: [S.blob, S.blob, S.flame1], ramp: R.fire, life: [0.18, 0.28], size: [0.5, 0.7], end: [0.35, 0.5], ease: 1.2, spin: [-5, 5], drag: 3.5, turb: 0.05, i: [1.3, 1.8] }),
  note: P({ sprite: [S.note1, S.note2], ramp: R.wConst, life: 1, size: 0.6, rot: 0, i: 2.2, noGround: true }),
  mote: P({ sprite: S.dot, ramp: R.wInOut, life: [0.3, 0.5], size: [0.06, 0.1], end: 0.4, drag: 2.5, turb: 0.12, i: [3, 4.5] }),
  smoke: P({ pool: 'alpha', sprite: [S.smoke1, S.smoke2, S.smoke3], ramp: R.smoke, life: [0.6, 0.9], size: [0.3, 0.45], end: [2.4, 3.2], ease: 2, spin: [-0.8, 0.8], drag: 2, accY: 1.2, turb: 0.15, alpha: 0.7 }),
  wave: P({ sprite: S.glow, ramp: R.wInOut, life: 0.25, size: 1.2, end: 1.4, orient: 'flat', i: 1.2 }),
};
function projDefaults(kind) {
  switch (kind) {
    case 'bullet': return { speed: 90, color: [2.4, 1.9, 1.1], size: 1, range: 26 };
    case 'fire': case 'fireball': return { speed: 26, color: [2.2, 0.8, 0.2], size: 1, range: 20 };
    case 'slug': return { speed: 55, color: [2.6, 1.0, 0.25], size: 1, range: 22 };
    case 'frost': case 'ice': case 'lance': return { speed: 34, color: [0.6, 1.2, 2.2], size: 1, range: 22 };
    case 'arcane': return { speed: 28, color: [1.6, 0.6, 2.4], size: 1, range: 20 };
    case 'holy': return { speed: 28, color: [2.2, 1.7, 0.8], size: 1, range: 20 };
    case 'dark': case 'shadow': return { speed: 24, color: [1.1, 0.3, 2.0], size: 1, range: 20 };
    case 'lightning': case 'lightning_bolt': return { speed: 40, color: [1.0, 1.4, 2.6], size: 1, range: 22 };
    case 'lightning_dragon': case 'dragon': return { speed: 24, color: [0.7, 1.0, 2.2], size: 1.4, range: 14 };
    case 'blade': case 'crescent': return { speed: 30, color: [2.4, 0.4, 0.4], size: 1, range: 10 };
    case 'chi': return { speed: 32, color: [0.8, 1.9, 2.4], size: 1, range: 18 };
    case 'glaive': return { speed: 22, color: [1.8, 0.2, 0.4], size: 1, range: 14 };
    case 'wave': return { speed: 24, color: [2.4, 0.25, 0.3], size: 1, range: 14 };
    case 'note': return { speed: 18, color: [2.0, 0.8, 1.7], size: 1, range: 16 };
    case 'water': case 'orb': return { speed: 16, color: [0.6, 1.3, 2.2], size: 1, range: 16 };
    case 'foxfire': return { speed: 14, color: [0.9, 1.1, 2.6], size: 1, range: 18 };
    case 'lava': return { speed: 16, color: [2.2, 0.7, 0.12], size: 1, range: 14, arc: 4 };
    case 'grenade': return { speed: 16, color: [2.2, 1.2, 0.4], size: 1, range: 12, arc: 3.5 };
    case 'rock': return { speed: 18, color: [1.6, 0.5, 0.1], size: 1, range: 16, arc: 3 };
    case 'blood': return { speed: 26, color: [1.8, 0.1, 0.15], size: 1, range: 18 };
    default: return { speed: 30, color: [1.6, 1.3, 0.9], size: 1, range: 20 };
  }
}
const PK_ALIAS = { wind_blade: 'blade', spinning_blade: 'glaive', glaive_disc: 'glaive', disc: 'glaive', tracer: 'bullet', flame_slug: 'slug', rifle_round: 'bullet', round: 'bullet', music_note: 'note', frost_lance: 'lance', ice_lance: 'lance', fire_wave: 'wave', holy_wave: 'wave', arrow: 'bullet' };
const PK_COLOR = { fire_wave: [2.6, 0.9, 0.2], holy_wave: [2.4, 1.9, 0.9], rifle_round: [2.6, 2.0, 1.2] };
export const PROJECTILE = {
  name: 'projectile', fade: 0.08,
  init(T) {
    const fx = T.fx, p = T.p, kind0 = p.kind || 'bolt', kind = PK_ALIAS[kind0] || kind0, D = projDefaults(kind);
    if (PK_COLOR[kind0] && !T.tint) D.color = PK_COLOR[kind0];
    if (kind0 === 'rifle_round') D.size = 1.6;
    const v = T.v;
    v.kind = kind; v.start = new THREE.Vector3().copy(T.pos); v.vel = new THREE.Vector3(); v.end = new THREE.Vector3();
    v.size = p.scale ?? (p.size != null ? Math.max(0.5, Math.min(3.5, p.size / 0.35)) : D.size); v.col = T.tint ? [T.tint[0] * (p.intensity ?? 1.8), T.tint[1] * (p.intensity ?? 1.8), T.tint[2] * (p.intensity ?? 1.8)] : D.color;
    if (!T.tint) T.tint = hue(D.color, [0, 0, 0]);
    v.speed = p.speed ?? D.speed; v.arc = p.arc ?? D.arc ?? 0;
    if (p.to) { v3(p.to, v.end); v.vel.subVectors(v.end, T.pos); v.range = v.vel.length(); v.vel.multiplyScalar(1 / Math.max(v.range, 1e-4)); }
    else {
      if (p.dir != null && typeof p.dir === 'object' && (p.dir.y || (Array.isArray(p.dir) && p.dir.length === 3))) fx.dir3(p.dir, v.vel); else v.vel.copy(T.dir);
      v.range = p.range ?? D.range; v.end.copy(T.pos).addScaledVector(v.vel, v.range);
    }
    T.dir.copy(v.vel);
    v.homing = p.homing?.isObject3D ? p.homing : null;
    v.dist = 0; v.done = false; v.pos3 = new THREE.Vector3();
    T.dur = Infinity;
    v.delay = p.delay ?? 0;
    const s = v.size;
    // visuals
    const c = v.col, h = T.tint;
    const glowO = { tint: h, scale: s };
    switch (kind) {
      case 'bullet':
        T.hold(K.core, 0, 0, 0, { tint: [1, 0.9, 0.7], scale: s * 0.35 });
        v.trail = fx.ribbons.trail({ attach: T, color: c, intensity: 1, width: 0.12 * s, life: 0.07, taper: 1 });
        break;
      case 'slug':
        T.hold(K.halo, 0, 0, 0, { tint: [1, 0.45, 0.1], scale: s * 0.7 }); T.hold(K.core, 0, 0, 0, { tint: [1, 0.85, 0.5], scale: s * 0.8 });
        T.hold(K.roil, 0, 0, 0, { tint: [1, 0.5, 0.15], scale: s * 0.8 });
        v.trail = fx.ribbons.trail({ attach: T, color: [2.6, 0.9, 0.2], intensity: 1, width: 0.5 * s, life: 0.16 });
        break;
      case 'fire': case 'fireball': case 'lava':
        T.hold(K.halo, 0, 0, 0, { tint: [1, 0.42, 0.1], scale: s }); T.hold(K.glow, 0, 0, 0, { tint: [1, 0.62, 0.25], scale: s }); T.hold(K.core, 0, 0, 0, { tint: [1, 0.9, 0.7], scale: s });
        T.hold(K.roil, 0, 0, 0, { tint: [1, 0.48, 0.12], scale: s, rot: 0 }); T.hold(K.roil, 0, 0, 0, { tint: [1, 0.48, 0.12], scale: s * 0.8, rot: 2, spin: -9 });
        if (kind === 'lava') fx.meshes.props.add('rock', v.prop = { pos: T.pos, dir: T.dir, alive: true, scale: s * 0.9, spin: 6, tint: [1.8, 0.5, 0.08] });
        v.trail = fx.ribbons.trail({ attach: T, color: [2.6, 0.95, 0.22], intensity: 1, width: 0.7 * s, life: 0.15 });
        break;
      case 'grenade': case 'rock':
        fx.meshes.props.add(kind === 'grenade' ? 'grenade' : 'rock', v.prop = { pos: T.pos, dir: T.dir, alive: true, scale: s * (kind === 'rock' ? 1.3 : 1), spin: 9, tint: kind === 'grenade' ? [1.6, 0.6, 0.15] : [1.2, 0.4, 0.08] });
        v.trail = fx.ribbons.trail({ attach: T, color: [0.9, 0.8, 0.7], intensity: 0.6, width: 0.16 * s, life: 0.2 });
        break;
      case 'frost': case 'ice': case 'lance':
        fx.meshes.props.add('lance', v.prop = { pos: T.pos, dir: T.dir, alive: true, scale: s * 0.9, spin: 10, tint: [0.5, 1.0, 1.8] });
        T.hold(K.glow, 0, 0, 0, { tint: [0.35, 0.7, 1], scale: s }); T.hold(K.core, 0, 0, 0, { tint: [0.8, 0.95, 1], scale: s * 0.8 });
        v.trail = fx.ribbons.trail({ attach: T, color: [0.5, 1.1, 2.2], intensity: 1, width: 0.55 * s, life: 0.22 });
        break;
      case 'dark': case 'shadow':
        T.hold(K.glow, 0, 0, 0, { tint: [0.6, 0.18, 1], scale: s * 1.1 }); T.hold(K.dark, 0, 0, 0, { scale: s });
        T.hold(K.swirl, 0, 0, 0, { tint: [0.75, 0.35, 1], scale: s, rot: 0 });
        v.trail = fx.ribbons.trail({ attach: T, color: [1.1, 0.3, 2.0], intensity: 1, width: 0.6 * s, life: 0.2 });
        break;
      case 'glaive':
        fx.meshes.props.add('glaive', v.prop = { pos: T.pos, dir: null, alive: true, scale: s * 0.8, spin: 22, spinAxis: 'y', tint: hue(c, [0, 0, 0]) });
        T.hold(K.halo, 0, 0, 0, { tint: h, scale: s * 0.8 });
        v.trail = fx.ribbons.trail({ attach: T, color: c, intensity: 1, width: 1.1 * s, life: 0.14 });
        break;
      case 'wave':
        v.slashT = 0;
        _p.copy(T.pos); _p.y = fx.gy(T.pos.x, T.pos.z, T.pos.y) + 0.15;
        fx.slashes.spawn(_p, _A.copy(T.right).negate(), _B.copy(UP), 1.9 * s, Math.PI, 1.1 * s, c, v.range / v.speed + 0.12, 0.04, 0.1, _e.copy(v.vel).multiplyScalar(v.speed), 8, v.delay);
        _c1[0] = c[0] * 0.35; _c1[1] = c[1] * 0.35; _c1[2] = c[2] * 0.35;
        fx.slashes.spawn(_p, _A, _B, 2.0 * s, Math.PI, 1.8 * s, _c1, v.range / v.speed + 0.18, 0.04, 0.12, _e, 8, v.delay);
        T.pos.y = _p.y + 1.2 * s;
        break;
      case 'blade': case 'crescent': {   // a flying crescent slash (sword beam)
        const Rb = 1.5 * s, arc = 2.3, hb = arc / 2;
        _f.copy(v.vel); _f.y = 0; _f.normalize(); _r.set(-_f.z, 0, _f.x);
        _A.copy(_f).multiplyScalar(Math.cos(hb)).addScaledVector(_r, Math.sin(hb)); _B.copy(_f).multiplyScalar(Math.sin(hb)).addScaledVector(_r, -Math.cos(hb));
        if (p.tilt) { rotAbout(_A, _f, p.tilt); rotAbout(_B, _f, p.tilt); }
        const life = v.range / v.speed + 0.08;
        _p.copy(T.pos).addScaledVector(_f, -Rb * 0.75);
        fx.slashes.spawn(_p, _A, _B, Rb, arc, 0.75 * s, c, life, 0.03, 0.05, _e.copy(v.vel).multiplyScalar(v.speed), 8, v.delay);
        _c1[0] = h[0] * 0.8; _c1[1] = h[1] * 0.8; _c1[2] = h[2] * 0.8;
        fx.slashes.spawn(_p, _A, _B, Rb * 1.05, arc, 1.5 * s, _c1, life + 0.05, 0.03, 0.08, _e, 8, v.delay);
        break;
      }
      case 'lightning_dragon': case 'dragon':
        v.path = new THREE.Vector3().copy(T.pos);
        T.hold(K.halo, 0, 0, 0, { tint: [0.4, 0.6, 1.2], scale: s * 0.9 }); T.hold(K.glow, 0, 0, 0, { tint: [0.5, 0.7, 1.3], scale: s * 0.8 }); T.hold(K.core, 0, 0, 0, { tint: [1, 1, 1], scale: s * 0.7 });
        v.trail = fx.ribbons.trail({ attach: T, color: [c[0] * 0.6, c[1] * 0.6, c[2] * 0.6], intensity: 1, width: 0.85 * s, life: 0.32, kind: 'energy' });
        v.trail2 = fx.ribbons.trail({ attach: T, color: [c[0] * 0.9, c[1] * 0.9, c[2] * 0.9], intensity: 1, width: 0.22 * s, life: 0.42 });
        break;
      case 'note':
        T.hold(K.note, 0, 0, 0, { tint: h, scale: s }); T.hold(K.glow, 0, 0, 0, { tint: h, scale: s * 0.8 });
        v.trail = fx.ribbons.trail({ attach: T, color: c, intensity: 1, width: 0.3 * s, life: 0.2 });
        break;
      case 'water': case 'orb': case 'foxfire':
        fx.meshes.props.add('orb', v.prop = { pos: T.pos, dir: null, alive: true, scale: s * 0.5, tint: kind === 'foxfire' ? [0.35, 0.5, 1.3] : [0.25, 0.6, 1.1] });
        T.hold(K.halo, 0, 0, 0, { tint: h, scale: s * 1.2 });
        v.trail = fx.ribbons.trail({ attach: T, color: c, intensity: 1, width: 0.6 * s, life: 0.25 });
        break;
      default: // bolt / arcane / holy / lightning / chi / blood
        T.hold(K.halo, 0, 0, 0, glowO); T.hold(K.glow, 0, 0, 0, { tint: h, scale: s }); T.hold(K.core, 0, 0, 0, { tint: [1, 1, 1], scale: s * 0.8 });
        if (kind === 'arcane' || kind === 'holy') T.hold(K.star, 0, 0, 0, { tint: h, scale: s, rot: 0 });
        v.trail = fx.ribbons.trail({ attach: T, color: c, intensity: 1, width: 0.45 * s, life: 0.16 });
    }
  },
  moved(T) { T.v.driven = true; },
  tick(T, dt) {
    const fx = T.fx, v = T.v, s = v.size;
    if (v.done) return;
    if (v.delay > 0) { v.delay -= dt; return; }
    const step = v.speed * dt;
    let hitNow = false;
    if (v.path) { if (v.driven) v.path.copy(T.pos); else T.pos.copy(v.path); }
    if (v.driven) {                       // position owned by the caller (h.pos / h.setPos every frame)
      _d.subVectors(T.pos, T.prev); if (_d.lengthSq() > 1e-8) T.dir.copy(_d).normalize();
    } else if (v.homing) {
      v.homing.getWorldPosition(_q);
      _d.subVectors(_q, T.pos); const L = _d.length();
      if (L < step + 0.3) { T.pos.copy(_q); hitNow = true; }
      else { _d.multiplyScalar(1 / L); v.vel.lerp(_d, Math.min(1, dt * 6)).normalize(); T.pos.addScaledVector(v.vel, step); }
      T.dir.copy(v.vel);
    } else if (v.arc > 0) {
      v.dist += step;
      const sN = Math.min(1, v.dist / Math.max(v.range, 0.01));
      _q.lerpVectors(v.start, v.end, sN); _q.y += v.arc * 4 * sN * (1 - sN);
      _d.subVectors(_q, T.pos); if (_d.lengthSq() > 1e-8) T.dir.copy(_d).normalize();
      T.pos.copy(_q);
      hitNow = sN >= 1;
    } else {
      v.dist += step;
      T.pos.addScaledVector(v.vel, step);
      hitNow = v.dist >= v.range;
      if (hitNow && T.p.to) T.pos.copy(v.end);
    }
    if (v.path) {                          // serpentine display offset around the true path
      v.path.copy(T.pos);
      const w = Math.sin(T.age * 9) * 0.9 * s, wy = Math.cos(T.age * 7) * 0.5 * s;
      T.pos.set(v.path.x - T.dir.z * w, v.path.y + wy, v.path.z + T.dir.x * w);
      if (T.rate('lb', 14)) { _q.copy(T.prev); fx.lightning({ from: _p.copy(T.pos), to: _q.addScaledVector(T.dir, -3 * s), width: 0.28 * s, dur: 0.1, impact: false, sparks: false, strands: 2, color: [0.6, 0.8, 1.8] }); }
    }
    // trail particles along the frame's path
    const kind = v.kind, d = T.dir, h = T.tint;
    const n1 = T.rate('a', kind === 'bullet' || kind === 'blade' || kind === 'crescent' ? 0 : kind === 'fire' || kind === 'fireball' || kind === 'lava' || kind === 'slug' ? 120 : 70);
    for (let i = 0; i < n1; i++) {
      const f = Math.random();
      _p.lerpVectors(T.pos, T.prev, f);
      if (kind === 'fire' || kind === 'fireball' || kind === 'lava' || kind === 'slug') fx.spawn(K.fireTail, _p.x + fx.r(-0.08, 0.08) * s, _p.y + fx.r(-0.08, 0.08) * s, _p.z + fx.r(-0.08, 0.08) * s, d.x * 4 + fx.r(-0.6, 0.6), fx.r(-0.3, 0.7), d.z * 4 + fx.r(-0.6, 0.6), fx.o(s * (kind === 'slug' ? 0.7 : 1)));
      else if (kind === 'frost' || kind === 'ice' || kind === 'lance') { if (Math.random() < 0.18) fx.spawn(FROST.mist, _p.x + fx.r(-0.2, 0.2), _p.y + fx.r(-0.2, 0.2), _p.z + fx.r(-0.2, 0.2), fx.r(-0.4, 0.4), fx.r(-0.2, 0.3), fx.r(-0.4, 0.4), fx.o(s * fx.r(0.35, 0.6))); else fx.spawn(K.tail, _p.x, _p.y, _p.z, d.x * 2 + fx.r(-0.3, 0.3), fx.r(-0.3, 0.3), d.z * 2 + fx.r(-0.3, 0.3), fx.o(s * 0.7, h)); }
      else if (kind === 'dark' || kind === 'shadow' || kind === 'glaive') { if (Math.random() < 0.25) fx.spawn(DARK.wisp, _p.x + fx.r(-0.15, 0.15), _p.y + fx.r(-0.15, 0.15), _p.z + fx.r(-0.15, 0.15), fx.r(-0.6, 0.6), fx.r(-0.2, 0.6), fx.r(-0.6, 0.6), fx.o(s * fx.r(0.5, 0.8), kind === 'glaive' ? h : null)); else fx.spawn(K.tail, _p.x, _p.y, _p.z, d.x * 2 + fx.r(-0.3, 0.3), fx.r(-0.3, 0.3), d.z * 2 + fx.r(-0.3, 0.3), fx.o(s * 0.7, h)); }
      else if (kind === 'wave') { if (i < 1) fx.spawn(CRIM.ember, _p.x + fx.r(-1.5, 1.5) * T.right.x, fx.gy(_p.x, _p.z, _p.y - 0.8) + 0.1, _p.z + fx.r(-1.5, 1.5) * T.right.z, 0, fx.r(1, 3), 0, fx.o(s, h)); }
      else if (kind === 'grenade' || kind === 'rock') fx.spawn(K.smoke, _p.x, _p.y, _p.z, 0, 0.3, 0, fx.o(s * 0.6));
      else fx.spawn(K.tail, _p.x, _p.y, _p.z, d.x * 3 + fx.r(-0.3, 0.3), fx.r(-0.3, 0.3), d.z * 3 + fx.r(-0.3, 0.3), fx.o(s * 0.8, h));
    }
    const n2 = T.rate('b', kind === 'bullet' || kind === 'wave' || kind === 'blade' || kind === 'crescent' ? 0 : 36);
    for (let i = 0; i < n2; i++) {
      _p.lerpVectors(T.pos, T.prev, Math.random());
      if (kind === 'fire' || kind === 'fireball' || kind === 'lava' || kind === 'slug') fx.spawn(FIRE.ember, _p.x, _p.y, _p.z, -d.x * 2 + fx.r(-2, 2), fx.r(-0.5, 2.2), -d.z * 2 + fx.r(-2, 2), fx.o(s));
      else if (kind === 'frost' || kind === 'ice' || kind === 'lance') fx.spawn(FROST.flake, _p.x, _p.y, _p.z, fx.r(-1, 1), fx.r(-0.5, 0.8), fx.r(-1, 1), fx.o(s));
      else if (kind === 'lightning' || kind === 'lightning_bolt' || kind === 'lightning_dragon' || kind === 'dragon') { if (i % 2 === 0) { const ob = fx.o(s * 0.55, null); ob.i = 0.4; fx.spawn(STORM.bolt, _p.x + fx.r(-0.4, 0.4) * s, _p.y + fx.r(-0.4, 0.4) * s, _p.z + fx.r(-0.4, 0.4) * s, 0, 0, 0, ob); } else fx.spawn(STORM.spark, _p.x, _p.y, _p.z, fx.r(-3, 3), fx.r(-2, 3), fx.r(-3, 3), fx.o(s, null)); }
      else if (kind === 'note') fx.spawn(MUSIC.sparkle, _p.x, _p.y, _p.z, fx.r(-1, 1), fx.r(0, 1), fx.r(-1, 1), fx.o(s, h));
      else fx.spawn(K.mote, _p.x, _p.y, _p.z, fx.r(-1.2, 1.2), fx.r(-1.2, 1.2), fx.r(-1.2, 1.2), fx.o(s, h));
    }
    if (kind === 'wave') { // wave drags sparks across the ground
      const n3 = T.rate('c', 40);
      for (let i = 0; i < n3; i++) { const side = fx.r(-1.6, 1.6) * s; _p.copy(T.pos).addScaledVector(T.right, side); fx.spawn(GEN.spark, _p.x, fx.gy(_p.x, _p.z, _p.y - 0.8) + 0.05, _p.z, d.x * 6 + fx.r(-1, 1), fx.r(2, 5), d.z * 6 + fx.r(-1, 1), fx.o(s, h)); }
    }
    T.prev.copy(T.pos);
    if (hitNow) {
      v.done = true;
      impactFor(fx, kind, T.pos, T.dir, s, T);
      try { T.p.onHit?.(T.pos); } catch (e) { console.error(e); }
      T.stop(0.02);
    }
  },
  stop(T) { if (T.v.trail) T.v.trail.stopped = true; if (T.v.trail2) T.v.trail2.stopped = true; if (T.v.prop) T.v.prop.alive = false; },
  end(T) { if (T.v.trail) T.v.trail.stopped = true; if (T.v.trail2) T.v.trail2.stopped = true; if (T.v.prop) T.v.prop.alive = false; },
};
function impactFor(fx, kind, pos, dir, s, T) {
  if (T.p.impact === false) return;
  const c = T.tint;
  switch (kind) {
    case 'bullet': hit(fx, { pos, dir, element: 'physical', scale: 0.6 * s }); break;
    case 'fire': case 'fireball': case 'slug': explosion(fx, pos, s * (kind === 'slug' ? 0.9 : 1), 'fire'); break;
    case 'lava': explosion(fx, pos, s * 0.9, 'fire'); decal(fx, { pos, radius: 1.8 * s, kind: 'lava', dur: 5 }); break;
    case 'grenade': explosion(fx, pos, s * 1.3, 'fire'); fx.shake(0.3, pos); break;
    case 'rock': fx.meshes.debris(pos.x, pos.y, pos.z, 8, s, 6, { gy: fx.gy(pos.x, pos.z, pos.y) }); burst(fx, { pos, kind: 'dust', count: 16, speed: 6 }); fx.shake(0.25, pos); break;
    case 'frost': case 'ice': case 'lance': hit(fx, { pos, dir, element: 'frost', scale: s * 1.2 }); fx.meshes.shards(pos.x, pos.y, pos.z, 10, s, {}); break;
    case 'dark': case 'shadow': hit(fx, { pos, dir, element: 'dark', scale: s * 1.2 }); fx.at(DARK.orb, pos, s); break;
    case 'lightning': case 'lightning_bolt': hit(fx, { pos, dir, element: 'lightning', scale: s * 1.2 }); break;
    case 'lightning_dragon': case 'dragon': hit(fx, { pos, dir, element: 'lightning', scale: s * 1.4, crit: true }); shockwave(fx, { pos, radius: 3.5 * s, color: [0.8, 1.1, 2.4], dur: 0.35, wall: false }); break;
    case 'blade': case 'crescent': hit(fx, { pos, dir, element: 'slash', scale: s }); break;
    case 'water': case 'orb': burst(fx, { pos, kind: 'water', count: 30, speed: 5, size: s }); fx.at(WATER.ring, _p.set(pos.x, fx.gy(pos.x, pos.z, pos.y) + 0.04, pos.z), s * 0.6); break;
    case 'foxfire': hit(fx, { pos, dir, element: 'arcane', scale: s * 1.3 }); break;
    case 'note': burst(fx, { pos, kind: 'note', count: 8, speed: 3, color: c }); fx.at(MUSIC.ring, _p.set(pos.x, fx.gy(pos.x, pos.z, pos.y) + 0.05, pos.z), 0.3); break;
    case 'glaive': case 'wave': case 'blood': hit(fx, { pos, dir, element: kind === 'blood' ? 'blood' : 'crimson', scale: s }); break;
    case 'holy': hit(fx, { pos, dir, element: 'holy', scale: s * 1.2 }); break;
    case 'arcane': hit(fx, { pos, dir, element: 'arcane', scale: s * 1.2 }); break;
    case 'chi': hit(fx, { pos, dir, element: 'chi', scale: s * 1.2 }); break;
    default: hit(fx, { pos, dir, element: 'physical', scale: s });
  }
}
/** fiery explosion (grenades, fireballs, meteors scale it up) */
export function explosion(fx, pos, s = 1, el = 'fire', o = {}) {
  const gy = fx.gy(pos.x, pos.z, pos.y);
  const g = _q.set(pos.x, Math.max(pos.y, gy + 0.3 * s), pos.z);
  const fire = el === 'fire';
  const tint = o.color ? col(o.color, 1, _c1) : null;
  fx.at(FIRE.flash, g, s * 1.6, tint);
  fx.at(GEN.flare, g, s * 1.3, tint || [1, 0.7, 0.35]);
  for (let i = 0; i < fx.n(5); i++) { fx.rdir(_d); fx.spawn(FIRE.core, g.x + _d.x * 0.2 * s, g.y + _d.y * 0.2 * s, g.z + _d.z * 0.2 * s, _d.x * s, _d.y * s + 0.5 * s, _d.z * s, fx.o(s, tint)); }
  fx.sphere(FIRE.burst, 20, g, 2.5, 6, s, tint, null, Math.PI, 0.15);
  fx.sphere(FIRE.ember, 36, g, 4, 11, s, tint);
  fx.sphere(fire ? FIRE.smokeWarm : PHYS.smoke, 8, g, 0.5, 1.6, s, null, _u, 1.2, 0, { dt: 0.1 });
  if (g.y - gy < 1.6 * s) {
    shockwave(fx, { pos: _p.set(pos.x, gy, pos.z), radius: 3.2 * s, color: tint || [1.8, 0.8, 0.3], dur: 0.4, wall: s > 1.2, dustCount: Math.round(8 * s) });
    decal(fx, { pos: _p, radius: 1.5 * s, kind: 'scorch', dur: 7 });
  }
}

// ------------------------------------------------------------------ beams / lightning
const BEAM_KIND = { glow: 'glow', energy: 'energy', holy: 'energy', helix: 'energy', wave: 'energy', chain: 'chain', tracer: 'tracer', lightning: 'lightning', laser: 'energy' };
export const BEAM = {
  name: 'beam', fade: 0.12,
  init(T) {
    const fx = T.fx, p = T.p, kind = p.kind || 'glow';
    const rk = BEAM_KIND[kind] || 'glow';
    const o = { from: p.from, to: p.to, color: p.color, width: p.width, intensity: p.intensity, dur: Infinity, fade: p.fade ?? 0.15,
      wave: kind === 'wave' ? (p.wave ?? 0.18) : 0, helix: kind === 'helix' || kind === 'holy' ? 1 : 0, strands: p.strands ?? (kind === 'helix' || kind === 'holy' ? 3 : kind === 'wave' ? 2 : undefined),
      amp: p.amp, taper: p.taper, reach: p.reach ?? (kind === 'chain' ? 0.02 : 1), grow: p.grow ?? (kind === 'chain' ? 60 : 8), speed: p.speed, length: p.length, segments: p.segments };
    if (o.color === undefined) o.color = kind === 'holy' ? [2.2, 1.7, 0.8] : kind === 'lightning' ? [0.55, 0.75, 1.8] : undefined;
    T.v.b = fx.ribbons.beam(o, rk);
    T.v.kind = kind;
    T.dur = p.dur ?? (kind === 'lightning' ? 0.35 : kind === 'tracer' ? 0.25 : 1);
    T.tint = hue(T.v.b.color, [0, 0, 0]);
    if (kind === 'lightning' && p.impact !== false) {
      const B = T.v.b.B;
      fx.at(STORM.flash, B, 1.3 * (p.scale ?? 1), null);
      fx.sphere(STORM.spark, 20, B, 3, 9, 1, null);
      if (B.y - fx.gy(B.x, B.z, B.y) < 0.6) decal(fx, { pos: B, radius: 1.3 * (p.scale ?? 1), kind: 'electric', dur: 2.5 });
    }
  },
  tick(T) {
    const fx = T.fx, b = T.v.b, kind = T.v.kind;
    if (b.dead) { T.stop(0.01); return; }
    if (kind === 'lightning' && T.p.sparks !== false) {
      const n = T.rate('s', 70);
      for (let i = 0; i < n; i++) { fx.rdir(_d); fx.spawn(STORM.spark, b.B.x, b.B.y, b.B.z, _d.x * 6, _d.y * 6 + 2, _d.z * 6, fx.o(1, null)); }
      if (T.rate('g', 16)) fx.at(STORM.glow, b.B, 1.2, null);
    } else if (kind === 'holy' || kind === 'helix' || kind === 'energy' || kind === 'wave') {
      const n = T.rate('m', 40);
      _t.subVectors(b.B, b.A); const L = _t.length(); _t.multiplyScalar(1 / Math.max(L, 1e-3));
      for (let i = 0; i < n; i++) { const u = Math.random(); _p.copy(b.A).addScaledVector(_t, L * u); fx.spawn(K.mote, _p.x + fx.r(-0.1, 0.1), _p.y + fx.r(-0.1, 0.1), _p.z + fx.r(-0.1, 0.1), _t.x * 8, _t.y * 8, _t.z * 8, fx.o(1, T.tint)); }
      if (T.rate('h', 20)) fx.at(K.glow, b.B, 1, T.tint);
    }
  },
  stop(T) { if (T.v.b) T.v.b.stopped = true; },
  end(T) { if (T.v.b) T.v.b.stopped = true; },
};

// ------------------------------------------------------------------ trail
export const TRAIL = {
  name: 'trail', fade: 0.02,
  init(T) { const p = T.p; T.v.t = T.fx.ribbons.trail({ attach: p.attach, tip: p.tip, tipOffset: p.tipOffset, offset: p.offset, color: p.color, intensity: p.intensity, width: p.width, life: p.life, kind: p.kind }); T.dur = p.dur ?? Infinity; T.attach = null; },
  tick(T) { if (T.v.t.dead) T.stop(0.01); },
  stop(T) { T.v.t.stopped = true; T.fadeT = T.v.t.life + 0.05; },
  end(T) { T.v.t.stopped = true; },
};

// ------------------------------------------------------------------ meteor
const MET_TRAIL = P({ sprite: [S.blob, S.blob, S.flame1], ramp: R.blast, life: [0.3, 0.5], size: [0.9, 1.3], end: [1.8, 2.4], ease: 2, spin: [-2, 2], drag: 2.5, turb: 0.2, i: [1.1, 1.5] });
export const METEOR = {
  name: 'meteor', fade: 0.1,
  init(T) {
    const fx = T.fx, p = T.p, v = T.v;
    const s = v.s = p.scale ?? ((p.radius ?? 3.5) / 3.5);
    v.R = p.radius ?? 3.5; v.fall = p.delay ?? p.fall ?? 1.1;
    v.target = new THREE.Vector3();
    if (p.target !== undefined) v3(p.target, v.target); else v.target.copy(T.pos);
    v.target.y = fx.gy(v.target.x, v.target.z, v.target.y);
    v.from = new THREE.Vector3();
    if (p.from) v3(p.from, v.from); else v.from.copy(v.target).addScaledVector(T.dir, -7 * s).add(_q.set(fx.r(-3, 3), 17 * Math.max(0.8, Math.min(s, 1.6)), fx.r(-2, 2)));
    v.col = T.tint ? T.tint : [1, 0.45, 0.1];
    T.pos.copy(v.from); T.prev.copy(v.from);
    if (p.telegraph !== false) T.child(fx.telegraph({ shape: 'circle', pos: v.target, radius: v.R, color: p.teleColor ?? 'orange', dur: v.fall, detonate: true }));
    v.prop = { pos: T.pos, dir: new THREE.Vector3().subVectors(v.target, v.from).normalize(), alive: true, scale: 0.75 * s, spin: 3, tint: [1.8, 0.55, 0.1] };
    fx.meshes.props.add('meteor', v.prop);
    const ss = v.ss = Math.min(s, 1.3);
    T.hold(K.halo, 0, 0, 0, { tint: [1, 0.4, 0.1], scale: 2.0 * ss });
    T.hold(K.glow, 0, 0, 0, { tint: [1, 0.6, 0.25], scale: 1.4 * ss });
    v.trail = fx.ribbons.trail({ attach: T, color: [2.2, 0.7, 0.15], intensity: 1, width: 1.3 * ss, life: 0.35 });
    T.dur = v.fall + 2;
    v.boom = false;
  },
  tick(T, dt) {
    const fx = T.fx, v = T.v, s = v.s;
    if (!v.boom) {
      const u = Math.min(1, T.age / v.fall), e = u * u * (0.35 + 0.65 * u);
      T.prev.copy(T.pos); T.pos.lerpVectors(v.from, v.target, e);
      const ss = v.ss;
      const n = T.rate('t', 130 * ss);
      for (let i = 0; i < n; i++) { _p.lerpVectors(T.pos, T.prev, Math.random()); fx.spawn(MET_TRAIL, _p.x + fx.r(-0.3, 0.3) * s, _p.y + fx.r(-0.3, 0.3) * s, _p.z + fx.r(-0.3, 0.3) * s, fx.r(-1, 1), fx.r(0, 2), fx.r(-1, 1), fx.o(ss, T.p.color !== undefined ? T.tint : null)); }
      const n2 = T.rate('e', 60 * ss);
      for (let i = 0; i < n2; i++) { _p.lerpVectors(T.pos, T.prev, Math.random()); fx.spawn(FIRE.ember, _p.x, _p.y, _p.z, fx.r(-4, 4), fx.r(-1, 4), fx.r(-4, 4), fx.o(ss)); }
      const n3 = T.rate('s', 22 * ss);
      for (let i = 0; i < n3; i++) { _p.lerpVectors(T.pos, T.prev, Math.random()); fx.spawn(FIRE.smoke, _p.x, _p.y, _p.z, 0, 0.5, 0, fx.o(ss * 1.2)); }
      if (u >= 1) {
        v.boom = true; v.prop.alive = false; v.trail.stopped = true;
        meteorImpact(fx, v.target, v.R, T.p.color !== undefined ? T.tint : null);
        try { T.p.onHit?.(v.target); } catch (e) { console.error(e); }
        if (T.held) { for (let i = 0; i < T.held.length; i += 2) T.held[i].killHeld(T.held[i + 1]); T.held.length = 0; }
        T.dur = T.age + 0.3;
      }
    }
  },
  end(T) { if (T.v.prop) T.v.prop.alive = false; if (T.v.trail) T.v.trail.stopped = true; },
};
export function meteorImpact(fx, target, Rr = 3.5, tint = null) {
  const s = Rr / 3.5;
  const g = _C.set(target.x, fx.gy(target.x, target.z, target.y), target.z);
  const up = _q.set(g.x, g.y + 0.6 * s, g.z);
  fx.at(GEN.bigFlash, up, Math.min(s, 2) * 0.6, tint || [1, 0.65, 0.3], null, 0, 1, 0);
  fx.at(GEN.flare, up, Math.min(s, 2) * 1.6, tint || [1, 0.6, 0.3], { rot: 0 });
  shockwave(fx, { pos: g, radius: Rr * 2.4, color: tint ? [tint[0] * 2, tint[1] * 2, tint[2] * 2] : [2.2, 0.9, 0.3], dur: 0.6, height: 1.6 * s });
  for (let i = 0; i < fx.n(36); i++) {
    fx.rdir(_d, _u, 1.35); const sp = fx.r(3, 10) * s;
    fx.spawn(FIRE.column, up.x, up.y, up.z, _d.x * sp, _d.y * sp * 0.8 + 3 * s, _d.z * sp, fx.o(s * 1.5, tint));
  }
  for (let i = 0; i < fx.n(14); i++) {
    const a = fx.r(0, TAU), r = fx.r(0.5, 2.6) * s;
    const o = fx.o(s * 1.35, tint); o.life = 1.4; o.dt = fx.r(0.1, 0.35);
    fx.spawn(FIRE.column, up.x + Math.cos(a) * r, up.y, up.z + Math.sin(a) * r, Math.cos(a) * 2 * s, fx.r(3, 7) * s, Math.sin(a) * 2 * s, o);
  }
  fx.sphere(FIRE.lavaBlob, 20, up, 6, 13, s, tint, _u, 1.1);
  fx.sphere(FIRE.ember, 50, up, 8, 17, s, tint, _u, 1.4);
  fx.radial(PHYS.dustRing, 22, up, 8, 13, 0.2, 1.5, s * 1.3, null, 1.2);
  const sc = Math.min(s, 1.4);
  for (let i = 0; i < fx.n(10); i++) { const o = fx.o(sc, null); o.dt = fx.r(0.1, 0.5); o.alpha = 0.7; fx.spawn(FIRE.bigSmoke, up.x + fx.r(-2.5, 2.5) * s, up.y + fx.r(0, 2) * sc, up.z + fx.r(-2.5, 2.5) * s, fx.r(-1.5, 1.5) * sc, fx.r(3, 7) * sc, fx.r(-1.5, 1.5) * sc, o); }
  fx.meshes.debris(up.x, up.y, up.z, Math.round(14 * Math.min(2, s)), sc * 1.1, 9 * Math.sqrt(s / sc), { gy: g.y });
  decal(fx, { pos: g, radius: Rr * 1.15, kind: 'crater', dur: 10, color: tint ? [tint[0] * 1.6, tint[1] * 1.6, tint[2] * 1.6] : undefined });
  fx.shake(Math.min(1, 0.45 + 0.2 * s), g);
}

// ------------------------------------------------------------------ aura
const A = {
  flameC: P({ sprite: [S.flame1, S.flame2, S.wisp], ramp: R.crimson, life: [0.45, 0.7], size: [0.35, 0.6], end: 0.5, rot: [-0.25, 0.25], drag: 2, accY: 3.5, turb: 0.15, i: [1.8, 2.6] }),
  ground: P({ sprite: S.glow, ramp: R.wPulse, life: 1.4, size: 2.4, orient: 'flat', i: 1.1, pingpong: true }),
  ring: P({ sprite: S.ring, ramp: R.wPulse, life: 2, size: 2.2, orient: 'flat', i: 1.4, pingpong: true, spin: 0.8 }),
  rune: P({ sprite: S.rune, ramp: R.wPulse, life: 3, size: 2.4, orient: 'flat', i: 1.4, pingpong: true, spin: 0.6 }),
  body: P({ sprite: S.glow, ramp: R.wPulse, life: 0.8, size: 2.2, i: 0.6, pingpong: true, noGround: true }),
  spiral: P({ sprite: S.dot, ramp: R.wInOut, life: [1.2, 1.5], size: [0.06, 0.1], end: 0.6, motion: 'orbit', rise: 1.3, rgrow: 0, i: [3.5, 5.5] }),
  spiralStar: P({ sprite: S.twinkle, ramp: R.wInOut, life: [1.2, 1.5], size: [0.16, 0.22], end: 0.4, motion: 'orbit', rise: 1.3, spin: 2, i: [2.5, 3.5] }),
  burn: P({ sprite: [S.flame1, S.flame2], ramp: R.fire, life: [0.4, 0.7], size: [0.35, 0.55], end: [0.3, 0.5], rot: [-0.2, 0.2], drag: 1.8, accY: 3.5, turb: 0.1, i: [1.7, 2.4] }),
  frostAura: P({ pool: 'alpha', sprite: [S.smoke1, S.smoke3], ramp: R.frostMist, life: [1.2, 1.8], size: [0.5, 0.8], end: 2, ease: 2, drag: 2, accY: -0.2, turb: 0.2 }),
  wind: P({ sprite: S.spark, ramp: R.wInOut, life: [0.25, 0.4], size: [0.06, 0.1], orient: 'stretch', stretch: 0.3, i: 1.8, alpha: 0.8 }),
  stunStar: P({ sprite: S.star, ramp: R.wConst, life: 1, size: 0.3, motion: 'orbit', rise: 0, rgrow: 0, spin: 4, i: 2.4, noGround: true }),
  chiOrb: P({ sprite: S.glow, ramp: R.wConst, life: 1, size: 0.45, motion: 'orbit', rise: 0, rgrow: 0, i: 2.6, noGround: true }),
  chiCore: P({ sprite: S.flash, ramp: R.wConst, life: 1, size: 0.2, motion: 'orbit', rise: 0, rgrow: 0, i: 3.5, noGround: true }),
  orbitNote: P({ sprite: [S.note1, S.note2], ramp: R.wConst, life: 1, size: 0.42, motion: 'orbit', rise: 0, rgrow: 0, rot: 0, i: 2.2, noGround: true }),
  orbitGlyph: P({ sprite: [S.glyph1, S.glyph2, S.hex], ramp: R.wConst, life: 1, size: 0.36, motion: 'orbit', rise: 0, rgrow: 0, spin: 1, i: 2.4, noGround: true }),
  sigil: P({ sprite: S.rune, ramp: R.wPulse, life: 1.2, size: 0.9, i: 2.4, pingpong: true, spin: 1.5, noGround: true }),
  ghostWisp: P({ sprite: S.wisp, ramp: R.ghost, life: [1.0, 1.6], size: [0.5, 0.8], end: 1.4, drag: 1, accY: 1.2, turb: 0.3, i: [1.4, 2] }),
  drip: P({ pool: 'alpha', sprite: S.drop, ramp: R.blood, life: [0.5, 0.8], size: [0.07, 0.1], orient: 'stretch', stretch: 0.3, accY: -9 }),
};
const AURA_COL = {
  burst: 0xff2a3a, crimson: 0xff2a3a, holy: 0xffd97a, shield: 0xffd98a, demon: 0xc0204a, fire: 0xff7a1e, burn: 0xff7a1e, frost: 0x8fd8ff,
  freeze: 0x8fd8ff, poison: 0x8ae83a, shock: 0x9ab8ff, bleed: 0xb0101a, heal: 0x6aff8a, regen: 0x6aff8a, speed: 0xd8f0ff, haste: 0xd8f0ff,
  buff: 0xffa040, atk: 0xff7a3a, enrage: 0xff2010, ghost: 0x9fdcff, stun: 0xffe070, counter: 0x4aa0ff, overload: 0xc070ff, chi: 0x7fe0ff,
  music: 0xff8ad8, brand: 0xff60a0, dark: 0x8a3cff, sanctity: 0xffd97a, water: 0x4ab8ff,
};
export const AURA = {
  name: 'aura', fade: 0.35,
  init(T) {
    const fx = T.fx, p = T.p, kind = p.kind || 'buff';
    const s = T.v.s = p.scale ?? 1, H = T.v.h = p.height ?? 1.85 * s;
    if (!T.tint) T.tint = col(AURA_COL[kind] ?? 0xffa040, 1, [0, 0, 0]);
    T.v.kind = kind;
    T.dur = p.dur ?? Infinity;
    const t = T.tint;
    switch (kind) {
      case 'shield': case 'bubble': {
        const b = fx.meshes.bubbles.alloc(); T.v.bub = b;
        if (b >= 0) fx.meshes.bubbles.set(b, T.pos.x, T.pos.y + H * 0.52, T.pos.z, (p.radius ?? H * 0.62), t, 1, 1, 0);
        fx.at(GEN.flash, T.pos, 1.4 * s, t, null, 0, H * 0.5, 0);
        break;
      }
      case 'burst': case 'crimson': case 'enrage': case 'demon':
        T.hold(A.ground, 0, 0.05, 0, { tint: t, scale: s * 1.1 });
        T.hold(A.body, 0, H * 0.5, 0, { tint: t, scale: s * 1.1 });
        if (kind === 'burst' || kind === 'crimson') T.hold(A.ring, 0, 0.06, 0, { tint: t, scale: s * 0.8 });
        break;
      case 'shock': T.hold(A.body, 0, H * 0.5, 0, { tint: [0.4, 0.6, 1.4], scale: s * 0.8 }); break;
      case 'bleed': T.hold(A.body, 0, H * 0.5, 0, { tint: [1, 0.05, 0.05], scale: s * 0.7 }); break;
      case 'speed': case 'haste': T.hold(A.ring, 0, 0.06, 0, { tint: t, scale: s * 0.7 }); break;
      case 'holy': case 'sanctity': T.hold(A.rune, 0, 0.05, 0, { tint: t, scale: s * 1.2 }); T.hold(A.ground, 0, 0.04, 0, { tint: t, scale: s * 1.4 }); break;
      case 'heal': case 'regen': case 'buff': case 'atk': case 'water': T.hold(A.ring, 0, 0.05, 0, { tint: t, scale: s }); break;
      case 'freeze': case 'frozen': T.v.spikes = []; {
        const gy = fx.gy(T.pos.x, T.pos.z, T.pos.y);
        for (let i = 0; i < 9; i++) { const a = (i + Math.random() * 0.5) / 9 * TAU, rr = fx.r(0.35, 0.6) * s; T.v.spikes.push(fx.meshes.crystals.spawn(i * 0.015, T.pos.x + Math.cos(a) * rr, gy - 0.05, T.pos.z + Math.sin(a) * rr, 0, 0, 0, 1e5, fx.r(0.15, 0.4), Math.PI / 2 - a, fx.r(-0.15, 0.15), 0, fx.r(1.0, 1.45) * s, 1, 0, [0.62, 0.85, 1], [0.4, 0.75, 1.5], 0.9, gy)); }
        T.hold(A.body, 0, H * 0.45, 0, { tint: [0.4, 0.75, 1], scale: s });
      } break;
      case 'stun': for (let i = 0; i < 4; i++) T.hold(A.stunStar, 0, H + 0.25 * s, 0, { tint: t, scale: s, vx: 0.45 * s, vy: i / 4 * TAU, vz: 4.5 }); break;
      case 'chi': for (let i = 0; i < 3; i++) { T.hold(A.chiOrb, 0, H * 0.6, 0, { tint: t, scale: s, vx: 0.7 * s, vy: i / 3 * TAU, vz: 3 }); T.hold(A.chiCore, 0, H * 0.6, 0, { tint: [1, 1, 1], scale: s, vx: 0.7 * s, vy: i / 3 * TAU, vz: 3 }); } break;
      case 'music': for (let i = 0; i < 5; i++) T.hold(A.orbitNote, 0, H * 0.55 + (i % 2) * 0.3, 0, { tint: t, scale: s, vx: 0.95 * s, vy: i / 5 * TAU, vz: 2.2 }); T.hold(A.ring, 0, 0.05, 0, { tint: t, scale: s }); break;
      case 'overload': for (let i = 0; i < 6; i++) T.hold(A.orbitGlyph, 0, H * 0.5 + (i % 3) * 0.3, 0, { tint: t, scale: s, vx: 0.9 * s, vy: i / 6 * TAU, vz: i % 2 ? 2.5 : -2.5 }); T.hold(A.rune, 0, 0.05, 0, { tint: t, scale: s }); break;
      case 'brand': T.hold(A.sigil, 0, H + 0.55 * s, 0, { tint: t, scale: s * 1.1 }); T.v.dec = fx.decal({ attach: null, pos: T.pos, radius: 0.9 * s, kind: 'sigil', dur: Infinity, color: [t[0] * 1.6, t[1] * 1.6, t[2] * 1.6] }); break;
      case 'counter': T.hold(A.body, 0, H * 0.55, 0, { tint: [0.3, 0.6, 1], scale: s * 1.6 }); break;
      case 'ghost': T.hold(A.body, 0, H * 0.5, 0, { tint: t, scale: s * 1.2 }); break;
    }
  },
  tick(T) {
    const fx = T.fx, v = T.v, s = v.s, H = v.h, t = T.tint, P0 = T.pos, kind = v.kind;
    const x = P0.x, y = P0.y, z = P0.z;
    if (v.bub >= 0 && v.bub !== undefined) fx.meshes.bubbles.set(v.bub, x, y + H * 0.52, z, (T.p.radius ?? H * 0.62), t, T.k, Math.max(0, 1 - T.age / 0.4), 0);
    if (v.dec) v.dec.setPos(P0);
    let n;
    switch (kind) {
      case 'burst': case 'crimson': case 'enrage': case 'demon': {
        const fl = kind === 'demon' ? DARK.flame : kind === 'enrage' ? A.flameC : A.flameC;
        n = T.rate('f', (kind === 'enrage' ? 60 : kind === 'demon' ? 45 : 70) * s);
        for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = fx.r(0.3, 0.55) * s; fx.spawn(fl, x + Math.cos(a) * r, y + fx.r(0.05, H * 0.9), z + Math.sin(a) * r, Math.cos(a) * 0.3, fx.r(0.5, 1.4) * s, Math.sin(a) * 0.3, fx.o(s, kind === 'demon' ? null : t)); }
        n = T.rate('e', 16 * s);
        for (let i = 0; i < n; i++) { const a = fx.r(0, TAU); fx.spawn(kind === 'demon' ? DARK.ember : CRIM.ember, x + Math.cos(a) * 0.5 * s, y + fx.r(0.2, H), z + Math.sin(a) * 0.5 * s, 0, fx.r(1, 2.5), 0, fx.o(s, kind === 'demon' ? null : t)); }
        if (kind === 'demon') { n = T.rate('s', 8); for (let i = 0; i < n; i++) fx.spawn(DARK.smoke, x + fx.r(-0.4, 0.4) * s, y + fx.r(0.2, 1.2) * s, z + fx.r(-0.4, 0.4) * s, 0, fx.r(0.4, 1), 0, fx.o(s)); }
        break;
      }
      case 'holy': case 'sanctity':
        n = T.rate('m', 26 * s); for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = fx.r(0.2, 1.1) * s; fx.spawn(HOLY.mote, x + Math.cos(a) * r, y + 0.1, z + Math.sin(a) * r, 0, fx.r(0.6, 1.4), 0, fx.o(s, t)); }
        n = T.rate('r', 3); for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = fx.r(0, 0.8) * s; fx.spawn(HOLY.pillar, x + Math.cos(a) * r, y, z + Math.sin(a) * r, 0, 0, 0, fx.o(s * 0.45, t)); }
        break;
      case 'heal': case 'regen': case 'water':
        n = T.rate('p', 7); for (let i = 0; i < n; i++) fx.spawn(HEAL.plus, x + fx.r(-0.5, 0.5) * s, y + fx.r(0.3, H), z + fx.r(-0.5, 0.5) * s, 0, 0.6, 0, fx.o(s, kind === 'water' ? t : null));
        n = T.rate('s', 26); for (let i = 0; i < n; i++) { const arm = (Math.random() * 3) | 0; fx.spawn(A.spiral, x, y + 0.05, z, 0.62 * s, arm * TAU / 3 + fx.time * 0.8, 3.2, fx.o(s, t)); }
        break;
      case 'buff': case 'atk':
        n = T.rate('u', 22); for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = fx.r(0.4, 0.7) * s; fx.spawn(HOLY.riseSpark, x + Math.cos(a) * r, y + 0.1, z + Math.sin(a) * r, 0, fx.r(2, 4), 0, fx.o(s, t)); }
        break;
      case 'fire': case 'burn':
        n = T.rate('f', 50); for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = fx.r(0.3, 0.5) * s; fx.spawn(A.burn, x + Math.cos(a) * r, y + fx.r(0.1, H * 0.9), z + Math.sin(a) * r, Math.cos(a) * 0.3, fx.r(0.5, 1.2) * s, Math.sin(a) * 0.3, fx.o(s)); }
        n = T.rate('s', 6); for (let i = 0; i < n; i++) fx.spawn(FIRE.smoke, x, y + H * 1.1, z, 0, fx.r(0.5, 1), 0, fx.o(s * 0.8));
        break;
      case 'frost': case 'freeze': case 'frozen':
        n = T.rate('m', 6); for (let i = 0; i < n; i++) fx.spawn(A.frostAura, x + fx.r(-0.5, 0.5) * s, y + fx.r(0, 1.2) * s, z + fx.r(-0.5, 0.5) * s, 0, 0, 0, fx.o(s));
        n = T.rate('k', 8); for (let i = 0; i < n; i++) fx.spawn(FROST.sparkle, x + fx.r(-0.6, 0.6) * s, y + fx.r(0.2, H) , z + fx.r(-0.6, 0.6) * s, 0, 0, 0, fx.o(s));
        break;
      case 'poison':
        n = T.rate('b', 14); for (let i = 0; i < n; i++) fx.spawn(POI.bubble, x + fx.r(-0.4, 0.4) * s, y + fx.r(0.3, H), z + fx.r(-0.4, 0.4) * s, 0, 0.6, 0, fx.o(s));
        n = T.rate('m', 4); for (let i = 0; i < n; i++) fx.spawn(POI.mist, x, y + fx.r(0.2, 1), z, 0, 0.3, 0, fx.o(s));
        break;
      case 'shock':
        n = T.rate('b', 14); for (let i = 0; i < n; i++) { const ob = fx.o(s * 0.9, null); ob.i = 0.6; fx.spawn(STORM.bolt, x + fx.r(-0.45, 0.45) * s, y + fx.r(0.3, H), z + fx.r(-0.45, 0.45) * s, 0, 0, 0, ob); }
        n = T.rate('s', 40); for (let i = 0; i < n; i++) { fx.rdir(_d); fx.spawn(STORM.spark, x, y + fx.r(0.3, H), z, _d.x * 4, _d.y * 4, _d.z * 4, fx.o(s)); }
        break;
      case 'bleed':
        n = T.rate('d', 24); for (let i = 0; i < n; i++) fx.spawn(A.drip, x + fx.r(-0.3, 0.3) * s, y + fx.r(0.6, H * 0.8), z + fx.r(-0.3, 0.3) * s, 0, 0, 0, fx.o(s * 1.6));
        n = T.rate('m', 3); for (let i = 0; i < n; i++) fx.spawn(PHYS.bloodMist, x + fx.r(-0.3, 0.3) * s, y + fx.r(0.8, H * 0.8), z + fx.r(-0.3, 0.3) * s, 0, 0.2, 0, fx.o(s * 1.5));
        break;
      case 'speed': case 'haste':
        n = T.rate('w', 40); for (let i = 0; i < n; i++) { const a = fx.r(0, TAU); fx.spawn(A.wind, x + Math.cos(a) * 0.55 * s, y + fx.r(0.1, H), z + Math.sin(a) * 0.55 * s, 0, fx.r(3, 6), 0, fx.o(s * 1.8, t)); }
        if (T.rate('d', 8)) fx.spawn(PHYS.dust, x + fx.r(-0.3, 0.3), y + 0.15, z + fx.r(-0.3, 0.3), fx.r(-1, 1), 0.3, fx.r(-1, 1), fx.o(s * 0.6, null));
        break;
      case 'ghost':
        n = T.rate('w', 8); for (let i = 0; i < n; i++) fx.spawn(A.ghostWisp, x + fx.r(-0.5, 0.5) * s, y + fx.r(0.2, H), z + fx.r(-0.5, 0.5) * s, 0, 0.6, 0, fx.o(s));
        break;
      case 'counter':
        n = T.rate('c', 40); for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = fx.r(0.5, 1.0) * s; fx.spawn(GEN.star, x + Math.cos(a) * r, y + fx.r(0.2, H), z + Math.sin(a) * r, 0, fx.r(0.5, 2), 0, fx.o(s, [0.4, 0.7, 1])); }
        break;
      case 'stun': case 'chi': case 'music': case 'overload': case 'brand': case 'shield': case 'bubble':
        if (kind === 'overload') { n = T.rate('s', 20); for (let i = 0; i < n; i++) { fx.rdir(_d); fx.spawn(ARC.spark, x, y + H * 0.5, z, _d.x * 3, _d.y * 3, _d.z * 3, fx.o(s)); } }
        if (kind === 'shield' || kind === 'bubble') { n = T.rate('s', 5); for (let i = 0; i < n; i++) { fx.rdir(_d); fx.spawn(GEN.star, x + _d.x * H * 0.62, y + H * 0.52 + _d.y * H * 0.62, z + _d.z * H * 0.62, 0, 0.3, 0, fx.o(s, t)); } }
        break;
    }
  },
  stop(T) {
    const fx = T.fx, v = T.v;
    if (v.spikes) { for (const sl of v.spikes) fx.meshes.crystals.kill(sl); fx.meshes.shards(T.pos.x, T.pos.y + 0.8, T.pos.z, 10, v.s); v.spikes = null; }
    if (v.bub >= 0 && v.bub !== undefined) fx.at(GEN.ringThin, _p.copy(T.pos).addScaledVector(UP, v.h * 0.5), v.s * 0.3, T.tint, { life: 0.4 });
    if (v.dec) v.dec.stop();
  },
  end(T) { const v = T.v; if (v.bub >= 0 && v.bub !== undefined) { T.fx.meshes.bubbles.free(v.bub); v.bub = -1; } if (v.spikes) for (const sl of v.spikes) T.fx.meshes.crystals.kill(sl); if (v.dec) v.dec.stop(); },
};

// ------------------------------------------------------------------ counter window
const CW = {
  flare: P({ sprite: S.flare, ramp: R.wFlash, life: 0.45, size: 6, end: 1.2, ease: 2, rot: 0, i: 3, noGround: true }),
  star: P({ sprite: S.star, ramp: R.wFlash, life: 0.5, size: 3.2, end: 1.3, spin: 1.5, i: 3, noGround: true }),
  pulse: P({ sprite: S.glow, ramp: R.wPulse, life: 0.22, size: 3.4, i: 1.6, pingpong: true, noGround: true }),
  ring: P({ sprite: S.ring, ramp: R.wFade, life: 0.45, size: 1.2, end: 3.2, ease: 2, i: 2.6, noGround: true }),
  flat: P({ sprite: S.ring, ramp: R.wFade, life: 0.5, size: 1, end: 7, ease: 2.2, orient: 'flat', i: 2.2 }),
  shimmer: P({ sprite: S.twinkle, ramp: R.wInOut, life: [0.3, 0.55], size: [0.3, 0.55], end: 0.3, spin: [-4, 4], i: [4, 6], noGround: true }),
};
export const COUNTER = {
  name: 'counterWindow', fade: 0.2,
  init(T) {
    const fx = T.fx, p = T.p, v = T.v;
    v.s = p.scale ?? 1; v.h = p.height ?? 3; v.r = p.radius ?? 1.6 * v.s;
    T.dur = p.dur ?? 0.8;
    T.tint = T.tint || [0.35, 0.65, 1];
    const c = _p.copy(T.pos); c.y += v.h * 0.6;
    fx.at(CW.flare, c, v.s, [0.5, 0.8, 1.6]);
    fx.at(CW.star, c, v.s, [0.6, 0.85, 1.6], { rot: 0.3 });
    fx.at(GEN.flash, c, v.s * 2.4, [0.4, 0.7, 1.5]);
    T.hold(CW.pulse, 0, v.h * 0.6, 0, { tint: [0.3, 0.55, 1.2], scale: v.s * 0.75 });
  },
  tick(T) {
    const fx = T.fx, v = T.v, P0 = T.pos, s = v.s;
    if (T.rate('ring', 5)) {
      fx.at(CW.ring, _p.set(P0.x, P0.y + v.h * 0.6, P0.z), s * 0.7, [0.45, 0.75, 1.5]);
      fx.at(CW.flat, _p.set(P0.x, fx.gy(P0.x, P0.z, P0.y) + 0.08, P0.z), s * 0.7 * v.r / 1.6, [0.35, 0.65, 1.5]);
    }
    const n = T.rate('sh', 70 * s);
    for (let i = 0; i < n; i++) {
      const a = fx.r(0, TAU), r = fx.r(0.4, 1) * v.r;
      fx.spawn(CW.shimmer, P0.x + Math.cos(a) * r, P0.y + fx.r(0.2, 1.1) * v.h, P0.z + Math.sin(a) * r, 0, fx.r(0.5, 2), 0, fx.o(s, [0.45, 0.75, 1.3]));
    }
  },
};

// ------------------------------------------------------------------ portal
const POR = {
  spiral: P({ sprite: S.ember, ramp: R.wInOut, life: [1.2, 1.8], size: [0.1, 0.18], end: 0.4, motion: 'orbitV', rise: 0, rgrow: -1.2, i: [3, 5] }),
  mist: P({ pool: 'alpha', sprite: [S.smoke1, S.smoke2], ramp: R.smokeLight, life: [1.4, 2.0], size: [0.6, 0.9], end: 2, ease: 2, drag: 1.5, accY: 0.2, turb: 0.2, alpha: 0.5 }),
  base: P({ sprite: S.glow, ramp: R.wPulse, life: 1.6, size: 4.5, orient: 'flat', i: 0.9, pingpong: true }),
};
export const PORTAL = {
  name: 'portal', fade: 0.7,
  init(T) {
    const fx = T.fx, p = T.p, v = T.v;
    v.R = p.radius ?? 1.6; v.flat = !!p.flat;
    if (!T.tint) T.tint = col(0x8a4aff, 1, [0, 0, 0]);
    v.c = [T.tint[0] * 1.3, T.tint[1] * 1.3, T.tint[2] * 1.3];
    v.slot = fx.meshes.portals.alloc();
    T.dur = p.dur ?? Infinity;
    T.hold(POR.base, 0, 0.05, 0, { tint: T.tint, scale: v.R / 1.6 });
    v.yaw = Math.atan2(-T.dir.x, -T.dir.z);
    if (v.slot >= 0) fx.meshes.portals.set(v.slot, T.pos.x, fx.gy(T.pos.x, T.pos.z, T.pos.y), T.pos.z, v.R, v.yaw, v.flat, p.spin ?? 1, v.c, 1);
    fx.at(GEN.flash, T.pos, v.R * 1.5, T.tint, null, 0, v.flat ? 0.3 : v.R, 0);
  },
  tick(T) {
    const fx = T.fx, v = T.v, P0 = T.pos;
    const gy = fx.gy(P0.x, P0.z, P0.y);
    if (v.slot >= 0 && !T.stopping) fx.meshes.portals.set(v.slot, P0.x, gy, P0.z, v.R, v.yaw, v.flat, T.p.spin ?? 1, v.c, 1);
    const n = T.rate('s', 40 * v.R);
    for (let i = 0; i < n; i++) {
      if (v.flat) fx.spawn(GEN.orbitMote, P0.x, gy + 0.1, P0.z, v.R * fx.r(0.8, 1.1), fx.r(0, TAU), 2, fx.o(1, T.tint));
      else { const o = fx.o(1, T.tint); o.yaw = v.yaw; fx.spawn(POR.spiral, P0.x, gy + v.R, P0.z, v.R * fx.r(0.9, 1.2), fx.r(0, TAU), fx.r(1.5, 3), o); }
    }
    const m = T.rate('m', 3); for (let i = 0; i < m; i++) fx.spawn(POR.mist, P0.x + fx.r(-1, 1) * v.R, gy + 0.2, P0.z + fx.r(-1, 1) * v.R, 0, 0.2, 0, fx.o(v.R / 1.6));
  },
  stop(T) { if (T.v.slot >= 0) T.fx.meshes.portals.kill(T.v.slot); },
  end(T) { if (T.v.slot >= 0) T.fx.meshes.portals.free(T.v.slot); },
};

// ------------------------------------------------------------------ loot beam
const LOOT = {
  base: P({ sprite: S.glow, ramp: R.wPulse, life: 1.4, size: 1.8, orient: 'flat', i: 1.6, pingpong: true }),
  ring: P({ sprite: S.ring, ramp: R.wPulse, life: 2, size: 1.3, orient: 'flat', i: 1.8, spin: 1, pingpong: true }),
  mote: P({ sprite: S.dot, ramp: R.wInOut, life: [1.2, 2], size: [0.05, 0.09], accY: 1.8, drag: 0.6, turb: 0.1, i: [3, 5] }),
  sparkle: P({ sprite: S.twinkle, ramp: R.wInOut, life: [0.5, 0.9], size: [0.2, 0.34], end: 0.3, spin: [-2, 2], i: [3, 5] }),
  flash: P({ sprite: S.flash, ramp: R.wFlash, life: 0.4, size: 3, end: 1.4, i: 2, noGround: true }),
};
export const LOOT_BEAM = {
  name: 'lootBeam', fade: 0.6,
  init(T) {
    const fx = T.fx, p = T.p, v = T.v;
    const gi = gradeOf(p.grade ?? 3), G0 = GRADES[gi];
    v.g = gi;
    v.c = col(p.color ?? G0.c, 1, [0, 0, 0]); v.c2 = G0.c2 ? col(G0.c2, 1, [0, 0, 0]) : null;
    const H = 3.5 + gi * 1.0, Rr = 0.15 + gi * 0.018, k = 1.15 + gi * 0.09;
    const gy = fx.gy(T.pos.x, T.pos.z, T.pos.y);
    v.pil = fx.meshes.pillars.spawn(T.pos.x, gy, T.pos.z, Rr, H, Infinity, 1, [v.c[0] * k, v.c[1] * k, v.c[2] * k], 0.3);
    if (v.c2) v.pil2 = fx.meshes.pillars.spawn(T.pos.x, gy, T.pos.z, Rr * 2.2, H * 0.7, Infinity, 1, [v.c2[0] * 0.7, v.c2[1] * 0.7, v.c2[2] * 0.7], 0.4);
    T.hold(LOOT.base, 0, 0.05, 0, { tint: v.c, scale: 0.8 + gi * 0.12 });
    if (gi >= 4) T.hold(LOOT.ring, 0, 0.06, 0, { tint: v.c2 || v.c, scale: 0.8 + gi * 0.1 });
    fx.at(LOOT.flash, T.pos, 1 + gi * 0.15, v.c, null, 0, 0.6, 0);
    T.dur = p.dur ?? Infinity;
  },
  tick(T) {
    const fx = T.fx, v = T.v, P0 = T.pos;
    let n = T.rate('m', 6 + v.g * 3);
    for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = fx.r(0, 0.45); fx.spawn(LOOT.mote, P0.x + Math.cos(a) * r, P0.y + fx.r(0, 0.4), P0.z + Math.sin(a) * r, 0, fx.r(0.5, 1.5), 0, fx.o(1, (v.c2 && Math.random() < 0.5) ? v.c2 : v.c)); }
    if (v.g >= 5) { n = T.rate('s', 5 + v.g); for (let i = 0; i < n; i++) fx.spawn(LOOT.sparkle, P0.x + fx.r(-0.5, 0.5), P0.y + fx.r(0.3, 3), P0.z + fx.r(-0.5, 0.5), 0, 0.2, 0, fx.o(1, v.c)); }
  },
  moved(T) { const fx = T.fx, gy = fx.gy(T.pos.x, T.pos.z, T.pos.y); fx.meshes.pillars.move(T.v.pil, T.pos.x, gy, T.pos.z); if (T.v.pil2 !== undefined) fx.meshes.pillars.move(T.v.pil2, T.pos.x, gy, T.pos.z); },
  stop(T) { T.fx.meshes.pillars.kill(T.v.pil); if (T.v.pil2 !== undefined) T.fx.meshes.pillars.kill(T.v.pil2); },
};
export { LOOT_BEAM as LOOT };

// ------------------------------------------------------------------ weather
const WX = {
  snow: P({ pool: 'alpha', sprite: [S.snow, S.dot, S.dot], ramp: R.wConst, life: [3, 5], size: [0.07, 0.13], spin: [-2, 2], turb: 0.6, color: [1.15, 1.18, 1.25], alpha: 0.9, wrap: true }),
  rain: P({ sprite: S.spark, ramp: R.wConst, life: [1, 2], size: [0.03, 0.045], orient: 'stretch', stretch: 0.045, color: [0.55, 0.62, 0.75], i: 0.6, alpha: 0.7, wrap: true }),
  ash: P({ pool: 'alpha', sprite: S.ash, ramp: R.wConst, life: [3, 5], size: [0.05, 0.1], spin: [-3, 3], turb: 0.8, color: [0.18, 0.16, 0.15], alpha: 0.85, wrap: true }),
  ember: P({ sprite: S.ember, ramp: R.wBlink, life: [2, 3.5], size: [0.05, 0.09], turb: 1.0, color: [1, 0.45, 0.1], i: [4, 6], wrap: true }),
  firefly: P({ sprite: S.glow, ramp: R.wBlink, life: [2.5, 4.5], size: [0.16, 0.24], turb: 1.4, color: [0.75, 1, 0.3], i: [3, 5], wrap: true }),
  mote: P({ sprite: S.dot, ramp: R.wPulse, life: [3, 6], size: [0.025, 0.045], turb: 0.7, color: [1, 0.95, 0.8], i: [1.5, 2.5], alpha: 0.8, wrap: true }),
  leaf: P({ pool: 'alpha', sprite: S.leaf, ramp: R.wConst, life: [4, 6], size: [0.14, 0.22], spin: [-2, 2], randSpin: true, turb: 1.2, color: [0.85, 0.5, 0.12], color2: [0.55, 0.62, 0.12], wrap: true }),
  petal: P({ pool: 'alpha', sprite: S.petal, ramp: R.wConst, life: [4, 6], size: [0.1, 0.16], spin: [-2, 2], randSpin: true, turb: 1.0, color: [1.2, 0.62, 0.85], color2: [1.25, 1.1, 1.05], wrap: true }),
  splash: P({ pool: 'alpha', sprite: S.ring, ramp: R.water, life: 0.35, size: 0.05, end: 5, ease: 2, orient: 'flat', color: [0.8, 0.85, 0.95], alpha: 0.6 }),
};
const WX_DEF = {
  snow: { pr: 'snow', n: 900, v: [0.3, -1.4, 0.15], h: 0 }, rain: { pr: 'rain', n: 1400, v: [1.2, -16, 0.4], h: 0 }, ash: { pr: 'ash', n: 700, v: [0.4, -0.7, 0.2], h: 0 },
  embers: { pr: 'ember', n: 300, v: [0.2, 0.9, 0.1], h: 8 }, fireflies: { pr: 'firefly', n: 140, v: [0, 0, 0], h: 3.2 }, dust: { pr: 'mote', n: 400, v: [0.15, 0.05, 0.05], h: 6 },
  leaves: { pr: 'leaf', n: 180, v: [0.8, -1.1, 0.3], h: 0 }, petals: { pr: 'petal', n: 220, v: [0.7, -0.9, 0.25], h: 0 },
};
export const WEATHER = {
  name: 'weather', fade: 1.2,
  init(T) {
    const fx = T.fx, p = T.p, def = WX_DEF[p.kind] || WX_DEF.snow, pr = WX[def.pr];
    const n = Math.round(def.n * (p.intensity ?? 1) * fx.q);
    const box = fx.u.uWrapBox.value, H = def.h || box.y;
    T.useAnchor();
    T.dur = p.dur ?? Infinity;
    const tint = p.color !== undefined ? col(p.color, 1, [0, 0, 0]) : null;
    const f = fx.focus;
    for (let i = 0; i < n; i++) {
      const o = { held: true, anchor: T.anchor, tint, yaw: def.h };
      const x = f.x + (Math.random() - 0.5) * box.x, y = f.y + Math.random() * H, z = f.z + (Math.random() - 0.5) * box.z;
      const w = 0.7 + Math.random() * 0.6;
      const slot = fx.ps.spawn(pr, x, y, z, def.v[0] * w, def.v[1] * w, def.v[2] * w, o);
      if (slot >= 0) { (T.held || (T.held = [])).push(fx.ps.pools[pr.pool], slot); const b = slot * 28; fx.ps.pools[pr.pool].data[b + 3] = fx.time - Math.random() * 5; fx.ps.pools[pr.pool].data[b + 8] = 0; fx.ps.pools[pr.pool].data[b + 9] = 0; }
    }
    T.v.kind = p.kind;
  },
  tick(T) {
    const fx = T.fx;
    if (T.v.kind === 'rain') {
      const n = T.rate('sp', 60 * (T.p.intensity ?? 1));
      const f = fx.focus, box = fx.u.uWrapBox.value;
      for (let i = 0; i < n; i++) { const x = f.x + (Math.random() - 0.5) * box.x * 0.8, z = f.z + (Math.random() - 0.5) * box.z * 0.8; fx.spawn(WX.splash, x, fx.gy(x, z, f.y) + 0.03, z, 0, 0, 0, fx.o(1)); }
    }
  },
};
