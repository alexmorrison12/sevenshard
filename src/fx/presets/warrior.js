// Warrior presets — Reaver (crimson greatsword) and Oathkeeper (holy longsword + tome).
import * as THREE from 'three';
import { ctx, tc, vec, groundSmash, along, risingRing, groundPulse, lightPillar, GEN, PHYS, FIRE, HOLY, CRIM, HEAL, STORM, TAU, UP, hue, shockwave, decal, hit, slash, S, R, P } from './lib.js';

const K = {};
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const CRIMSON = 0xff2a3a, GOLD = 0xffcf6a;
const EMB = P({ sprite: S.ember, ramp: R.crimson, life: [0.6, 1.1], size: [0.06, 0.11], end: 0.5, drag: 1.2, accY: 1.2, turb: 0.4, i: [5, 8] });
const CRACK_SPARK = P({ sprite: S.spark, ramp: R.wHot, life: [0.3, 0.5], size: [0.05, 0.09], orient: 'stretch', stretch: 0.7, drag: 2, accY: -6, i: [5, 8] });
const FEATHER_RISE = P({ sprite: S.feather, ramp: R.wSolid, life: [1.4, 2.0], size: [0.2, 0.3], spin: [-1.5, 1.5], randSpin: true, drag: 1.5, accY: 0.6, turb: 0.5, color: [1.5, 1.35, 1.0], i: 1.1 });
const RAY = P({ sprite: S.beam, ramp: R.wInOut, life: [0.9, 1.4], size: [0.25, 0.45], orient: 'axisY', stretch: 10, color: [1, 0.85, 0.45], i: [1.4, 2.2] });

// ------------------------------------------------------------------ Reaver
K.greatsword_cleave = (fx, p) => {
  const c = ctx(fx, p, null, 4.2), s = c.s, col = tc(c.tint, CRIMSON, 2.4);
  const pos = vec(c.x, c.y, c.z);
  slash(fx, { pos, dir: c.f, radius: c.R, arc: p.arc ?? 3.0, color: col, intensity: 1, width: c.R * 0.46, style: 'h', dur: 0.34, flip: p.flip });
  slash(fx, { pos, dir: c.f, radius: c.R * 0.72, arc: 2.6, color: [col[0] * 0.8 + 0.5, col[1] * 0.8 + 0.35, col[2] * 0.8 + 0.3], intensity: 1, width: c.R * 0.18, style: 'h', dur: 0.26, glow: false, sparks: false, flip: p.flip, delay: 0.02 });
  // dust + sparks kicked up along the swept ground
  const o = fx.o(s * 0.9, null);
  for (let i = 0; i < fx.n(10); i++) {
    const a = (i / 9 - 0.5) * 2.6, r = c.R * fx.r(0.7, 1.05);
    const dx = c.f.x * Math.cos(a) + c.rt.x * Math.sin(a), dz = c.f.z * Math.cos(a) + c.rt.z * Math.sin(a);
    o.dt = 0.03 + (i / 9) * 0.1;
    fx.spawn(PHYS.dust, c.x + dx * r, c.y + 0.25, c.z + dz * r, dx * 2.5, 0.6, dz * 2.5, o);
  }
  fx.shake(0.12 * s, pos);
};
K.cleave = K.greatsword_cleave;

K.crimson_wave = (fx, p) => {        // Red Dust: a crimson wave rolls forward + self-buff flare
  const c = ctx(fx, p, null, 2.2, 9), s = c.s, col = tc(c.tint, CRIMSON, 2.6);
  const pos = vec(c.x, c.y, c.z), L = c.L, W = (c.W ?? 3) * 0.55;
  const speed = p.speed ?? 22, dur = L / speed;
  slash(fx, { pos, dir: c.f, style: 'wave', radius: W * 1.05, width: W * 0.75, arc: Math.PI, color: col, intensity: 1, speed, dur: dur + 0.2, sweep: 0.03, grow: 0.3, sparks: false });
  slash(fx, { pos, dir: c.f, style: 'wave', radius: W * 0.8, width: W * 0.3, arc: Math.PI * 0.9, color: [2.2, 1.2, 1.1], intensity: 1, speed, dur: dur + 0.15, sweep: 0.03, grow: 0.25, sparks: false, glow: false, delay: 0.03 });
  // ground cracks + sparks + embers along the path
  decal(fx, { pos, dir: c.f, radius: W * 0.4, length: L, kind: 'fissure', dur: 3.5, color: [col[0] * 0.55, col[1] * 0.55, col[2] * 0.55], delay: 0.02 });
  const o = fx.o(s, hue(col, [0, 0, 0]));
  along(c.x, c.z, c.f, L, fx.n(22), (x, z, u) => {
    o.dt = u * dur;
    const side = fx.r(-1, 1) * W;
    fx.spawn(CRACK_SPARK, x + c.rt.x * side, c.y + 0.1, z + c.rt.z * side, c.f.x * 6 + fx.r(-2, 2), fx.r(3, 7), c.f.z * 6 + fx.r(-2, 2), o);
    fx.spawn(EMB, x + c.rt.x * side, c.y + 0.3, z + c.rt.z * side, 0, fx.r(1, 3), 0, o);
  });
  const o2 = fx.o(s * 1.1, null);
  along(c.x, c.z, c.f, L, fx.n(10), (x, z, u) => { o2.dt = u * dur; fx.spawn(PHYS.dust, x, c.y + 0.2, z, fx.r(-1, 1), 0.8, fx.r(-1, 1), o2); });
  if (p.buff !== false) K.aura_burst(fx, { ...p, scale: s * 0.8 });
};
K.wave = K.crimson_wave;
K.red_dust = K.crimson_wave;

K.aura_burst = (fx, p) => {          // quick self-buff flare (crimson by default)
  const c = ctx(fx, p), s = c.s, col = tc(c.tint, CRIMSON, 1);
  const pos = vec(c.x, c.y, c.z);
  fx.at(GEN.flash, pos, 1.8 * s, col, null, 0, 1.1, 0);
  fx.at(GEN.ringThin, pos, 0.4 * s, col, { life: 0.5 }, 0, 0.06, 0);
  shockwave(fx, { pos, radius: 2.6 * s, color: [col[0] * 1.6, col[1] * 1.6, col[2] * 1.6], dur: 0.35, wall: true, height: 1.8, dust: false });
  const o = fx.o(s, col);
  for (let i = 0; i < fx.n(26); i++) { const a = fx.r(0, TAU), r = fx.r(0.3, 0.7) * s; fx.spawn(CRIM.flame, c.x + Math.cos(a) * r, c.y + fx.r(0, 1.2), c.z + Math.sin(a) * r, Math.cos(a) * 0.8, fx.r(2, 4), Math.sin(a) * 0.8, o); }
  fx.sphere(EMB, 20, vec(c.x, c.y + 1, c.z), 1, 4, s, col, UP, 1.2);
};

K.whirlwind = {                      // looping spin (handle.stop()); follows attach/follow
  name: 'whirlwind', fade: 0.25, group: 'Reaver',
  init(T) { const c = ctx(T.fx, T.p, T.v.c = {}, 3.2); T.v.col = tc(c.tint, CRIMSON, 2.2); T.v.R = c.R; T.v.s = c.s; T.v.next = 0; T.v.a = 0; if (T.p.dur == null) T.dur = Infinity; },
  tick(T, dt) {
    const fx = T.fx, v = T.v, p = T.pos, s = v.s;
    const gy = fx.gy(p.x, p.z, p.y);
    v.next -= dt;
    if (v.next <= 0 && !T.stopping) {
      v.next = 0.11; v.a += 2.4;
      _a.set(p.x, gy, p.z);
      _b.set(Math.sin(v.a), 0, Math.cos(v.a));
      slash(fx, { pos: _a, dir: _b, radius: v.R, arc: 3.4, color: v.col, intensity: 1, width: v.R * 0.38, style: 'h', dur: 0.24, sweep: 0.5, height: 0.9 + Math.sin(v.a * 1.7) * 0.25, sparks: true, sparkCount: 6, grow: 0.05 });
      fx.rings.ground(_a, v.R * 1.05, 0.3, [v.col[0] * 0.5, v.col[1] * 0.5, v.col[2] * 0.5], { ew: 0.25, trail: 0.8, r0: v.R * 0.7, flags: 0 });
    }
    const n = T.rate('d', 40 * s);
    const o = fx.o(s, null);
    for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = v.R * fx.r(0.6, 1.0); fx.spawn(PHYS.dust, p.x + Math.cos(a) * r, gy + 0.2, p.z + Math.sin(a) * r, -Math.sin(a) * 5, fx.r(0.3, 1), Math.cos(a) * 5, o); }
    const m = T.rate('w', 50);
    const ow = fx.o(s, v.hue || (v.hue = hue(v.col, [0, 0, 0])));
    for (let i = 0; i < m; i++) { const a = fx.r(0, TAU), r = v.R * fx.r(0.4, 1.0); fx.spawn(GEN.streak, p.x + Math.cos(a) * r, gy + fx.r(0.3, 1.8), p.z + Math.sin(a) * r, -Math.sin(a) * 9, 0.3, Math.cos(a) * 9, ow); }
  },
};
K.whirl = K.whirlwind;
K.sword_storm = K.whirlwind;

K.leap_slam = {                      // jump arc trail from pos → target, crater on landing
  name: 'leap_slam', fade: 0.1, group: 'Reaver',
  init(T) {
    const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 3.4, 8, 6);
    T.v.col = tc(c.tint, CRIMSON, 1.6); T.v.land = T.p.delay ?? 0.45; T.dur = T.v.land + 0.1;
    T.v.from = vec(c.x, c.y, c.z); T.v.to = vec(c.tx, c.ty, c.tz);
    T.v.trail = fx.ribbons.trail({ attach: T, color: T.v.col, intensity: 1.2, width: 0.9 * c.s, life: 0.25 });
    fx.radial(PHYS.dust, 10, T.v.from, 1, 3, 0.2, 1, c.s, null, 0.3, 0.2);
    fx.telegraph({ shape: 'circle', pos: T.v.to, radius: c.R, color: 'white', dur: T.v.land, detonate: false, fill: true, intensity: 0.5 });
  },
  tick(T) {
    const v = T.v, u = Math.min(1, T.age / v.land);
    T.pos.lerpVectors(v.from, v.to, u); T.pos.y += Math.sin(u * Math.PI) * 3.5 * v.c.s + 1;
    if (u >= 1 && !v.done) {
      v.done = true; v.trail.stopped = true;
      K.crater(T.fx, { pos: v.to, r: v.c.R, color: T.p.color ?? CRIMSON, dir: v.c.f });
    }
  },
  end(T) { if (T.v.trail) T.v.trail.stopped = true; },
};
K.crater = (fx, p) => {              // heavy landing / ground slam crater
  const c = ctx(fx, p, null, 3.4), col = tc(c.tint, CRIMSON, 1.4);
  groundSmash(fx, c.x, c.y, c.z, c.R, col, { decal: 'crater' });
  slash(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, radius: c.R * 0.8, style: 'v', color: [col[0] * 1.4, col[1] * 1.4, col[2] * 1.4], intensity: 1, dur: 0.22, sweep: 0.3, sparks: false, height: 0.3 });
};
K.ground_slam = K.crater;

K.ground_crack = (fx, p) => {        // a crack racing forward along the ground (len)
  const c = ctx(fx, p, null, 1.2, 6), s = c.s, col = tc(c.tint, CRIMSON, 1.5);
  const L = c.L, speed = 24, pos = vec(c.x, c.y, c.z);
  decal(fx, { pos, dir: c.f, radius: 0.9 * s, length: L, kind: 'fissure', dur: 4, color: col });
  const o = fx.o(s, hue(col, [0, 0, 0])), od = fx.o2(s * 0.9, null);
  along(c.x, c.z, c.f, L, fx.n(Math.round(L * 2.5)), (x, z, u) => {
    o.dt = u * L / speed; od.dt = o.dt;
    fx.spawn(CRACK_SPARK, x, c.y + 0.1, z, fx.r(-2, 2), fx.r(3, 8), fx.r(-2, 2), o);
    fx.spawn(PHYS.pebble, x, c.y + 0.1, z, fx.r(-1.5, 1.5), fx.r(3, 6), fx.r(-1.5, 1.5), od);
    if (Math.random() < 0.5) fx.spawn(PHYS.dust, x, c.y + 0.2, z, fx.r(-1, 1), 0.8, fx.r(-1, 1), od);
  });
  fx.meshes.spikeLine(c.x + c.f.x, c.y, c.z + c.f.z, c.f.x, c.f.z, L - 1, Math.round(L * 1.2), 0.55 * s, { color: [0.28, 0.22, 0.2], glow: [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8], fres: 0.2, speed, life: 1.1, spread: 0.35 });
  fx.shake(0.18 * s, pos);
};

K.chain_throw = {                    // chain flies to the target, hooks, retracts (pull)
  name: 'chain_throw', fade: 0.15, group: 'Reaver',
  init(T) {
    const fx = T.fx, p = T.p, c = ctx(fx, p, T.v.c = {}, 1, 9, 9);
    const from = p.sockets?.handR || p.from || vec(c.x, c.y + 1.2, c.z);
    const L = c.L;
    T.v.end = vec(c.x + c.f.x * L, c.y + 1.0, c.z + c.f.z * L);
    if (p.target) T.v.end.set(c.tx, c.ty + 1.0, c.tz);
    T.v.from = from.isObject3D ? from : vec(c.x + c.rt.x * 0.4, c.y + 1.2, c.z + c.rt.z * 0.4);
    T.v.b = fx.ribbons.beam({ from: T.v.from, to: T.v.end, kind: 'chain', width: 0.36 * c.s, dur: Infinity, reach: 0.02, grow: 70, fade: 0.1, color: [0.7, 0.66, 0.62] }, 'chain');
    T.v.glow = fx.ribbons.beam({ from: T.v.from, to: T.v.end, width: 0.7 * c.s, dur: Infinity, reach: 0.02, grow: 70, fade: 0.1, color: tc(c.tint, CRIMSON, 0.35) }, 'energy');
    T.dur = p.dur ?? 0.75;
  },
  tick(T) {
    const fx = T.fx, v = T.v;
    if (T.once('hook', 0.13)) { fx.at(GEN.starFlash, v.end, 1.2, [1, 0.5, 0.4]); fx.sphere(GEN.spark, 16, v.end, 3, 8, 1, [1, 0.6, 0.4]); fx.shake(0.1, v.end); }
    if (T.age > 0.35) {   // retract: pull the far end back toward the caster
      const u = Math.min(1, (T.age - 0.35) / 0.3);
      if (!v.start) { v.start = v.end.clone(); v.fromW = new THREE.Vector3(); }
      if (v.from.isObject3D) v.from.getWorldPosition(v.fromW); else v.fromW.copy(v.from);
      v.end.lerpVectors(v.start, v.fromW, u * u);
    }
  },
  stop(T) { T.v.b.stopped = true; T.v.glow.stopped = true; },
  end(T) { T.v.b.stopped = true; T.v.glow.stopped = true; },
};
K.chain = K.chain_throw;
K.chain_sword = K.chain_throw;

K.hell_blade = (fx, p) => {          // charged overhead mega-slash + fissure
  const c = ctx(fx, p, null, 5), s = c.s, col = tc(c.tint, CRIMSON, 2.8);
  const pos = vec(c.x, c.y, c.z);
  slash(fx, { pos, dir: c.f, radius: c.R, style: 'v', color: col, intensity: 1, width: c.R * 0.5, dur: 0.42, arc: 2.6 });
  fx.at(GEN.flare, vec(c.x + c.f.x * c.R * 0.8, c.y + 0.4, c.z + c.f.z * c.R * 0.8), s * 3, hue(col, [0, 0, 0]), { rot: 0, dt: 0.12 });
  K.ground_crack(fx, { pos: vec(c.x + c.f.x, c.y, c.z + c.f.z), dir: c.f, len: c.R * 1.8, color: p.color ?? CRIMSON, scale: s * 1.3 });
  fx.shake(0.4, pos);
};
K.mountain_cleave = (fx, p) => {     // vertical cleave that splits the ground ahead
  const c = ctx(fx, p, null, 4.4), s = c.s, col = tc(c.tint, CRIMSON, 2.4);
  const pos = vec(c.x, c.y, c.z);
  slash(fx, { pos, dir: c.f, radius: c.R, style: 'v', color: col, intensity: 1, width: c.R * 0.45, dur: 0.36 });
  const hitP = vec(c.x + c.f.x * c.R * 0.9, c.y, c.z + c.f.z * c.R * 0.9);
  groundSmash(fx, hitP.x, hitP.y, hitP.z, 2.2 * s, [col[0] * 0.6, col[1] * 0.6, col[2] * 0.6], { decal: 'crack', rocks: 8, shake: 0.3 });
};
K.wind_blade = (fx, p) => {          // two crossing crescent waves
  const c = ctx(fx, p, null, 2.4, 10), col = tc(c.tint, CRIMSON, 2.2);
  for (const k of [-1, 1]) {
    const d = vec(c.f.x + c.rt.x * 0.12 * k, 0, c.f.z + c.rt.z * 0.12 * k).normalize();
    fx.projectile({ from: vec(c.x, c.y + 1.1, c.z), dir: d, kind: 'blade', color: col, range: c.L, speed: 30, scale: c.s, tilt: k * 0.5 });
  }
};
K.strike_wave = (fx, p) => { const c = ctx(fx, p, null, 2.4, 12); fx.projectile({ from: vec(c.x, c.y, c.z), dir: c.f, kind: 'wave', color: p.color ?? CRIMSON, range: c.L, speed: 24, scale: c.s }); };
K.burst_mode = (fx, p) => {          // Reaver identity: crimson eruption (+ short aura on the caster)
  const c = ctx(fx, p), s = c.s, col = tc(c.tint, CRIMSON, 1.2);
  const pos = vec(c.x, c.y, c.z);
  fx.at(GEN.bigFlash, pos, 0.7 * s, col, null, 0, 1.2, 0);
  fx.at(GEN.rays, pos, 1.2 * s, col, null, 0, 1.2, 0);
  shockwave(fx, { pos, radius: 5 * s, color: [col[0] * 1.8, col[1] * 1.8, col[2] * 1.8], dur: 0.5, height: 2.4 });
  decal(fx, { pos, radius: 2.4 * s, kind: 'demon', dur: 1.6, color: [col[0] * 1.6, col[1] * 1.6, col[2] * 1.6] });
  fx.sphere(CRIM.flame, 40, vec(c.x, c.y + 0.6, c.z), 2, 6, s, col, UP, 1.0);
  fx.sphere(EMB, 50, vec(c.x, c.y + 1, c.z), 2, 8, s, col);
  const att = p.attach ?? p.follow ?? p.unit;
  if (att?.isObject3D) fx.aura({ attach: att, kind: 'burst', color: p.color ?? CRIMSON, dur: p.dur ?? 2.5 });
  fx.flash(0.12, col); fx.shake(0.3, pos);
};
K.crimson_finale = (fx, p) => {      // Burst Mode finisher: huge crimson spin explosion
  const c = ctx(fx, p, null, 5.5), s = c.s, col = tc(c.tint, CRIMSON, 2.6);
  const pos = vec(c.x, c.y, c.z);
  slash(fx, { pos, dir: c.f, radius: c.R, style: 'spin', color: col, intensity: 1, width: c.R * 0.42, dur: 0.5 });
  slash(fx, { pos, dir: c.rt, radius: c.R * 0.75, style: 'spin', color: [1.8, 0.9, 0.8], intensity: 1, width: c.R * 0.3, dur: 0.45, flip: true, delay: 0.08, glow: false });
  groundSmash(fx, c.x, c.y, c.z, c.R * 0.8, [col[0] * 0.6, col[1] * 0.6, col[2] * 0.6], { decal: 'crater', shake: 0.6 });
  fx.flash(0.2, col);
};
K.dash_trail = {                     // dash: afterimage streak following the unit + dust kick
  name: 'dash_trail', fade: 0.05, group: 'Utility',
  init(T) {
    const fx = T.fx, p = T.p, c = ctx(fx, p, T.v.c = {});
    const att = p.attach ?? p.follow ?? p.unit;
    T.v.col = tc(c.tint, 0xdfe8ff, 1.4);
    if (att?.isObject3D) { T.attach = att; T.offset = vec(0, 1.0, 0); T.readPos(T.pos); }
    else T.pos.set(c.x, c.y + 1, c.z);
    T.v.t = fx.ribbons.trail({ attach: T, color: T.v.col, intensity: 1, width: 1.1 * c.s, life: 0.22 });
    fx.radial(PHYS.dust, 10, vec(c.x, c.y, c.z), 1.5, 3.5, 0.2, 1, c.s, null, 0.2, 0.2);
    T.dur = p.dur ?? 0.3;
  },
  tick(T) {
    const fx = T.fx, n = T.rate('s', 60);
    const o = fx.o(1, T.v.hue || (T.v.hue = hue(T.v.col, [0, 0, 0])));
    for (let i = 0; i < n; i++) fx.spawn(GEN.streak, T.pos.x + fx.r(-0.3, 0.3), T.pos.y + fx.r(-0.8, 0.6), T.pos.z + fx.r(-0.3, 0.3), 0, 0.2, 0, o);
  },
  stop(T) { T.v.t.stopped = true; },
  end(T) { T.v.t.stopped = true; },
};

// ------------------------------------------------------------------ Oathkeeper
K.holy_nova = (fx, p) => {
  const c = ctx(fx, p, null, 6), s = c.R / 6, col = tc(c.tint, GOLD, 1.2);
  const pos = vec(c.x, c.y, c.z), up = vec(c.x, c.y + 1.2, c.z);
  fx.at(HOLY.flash, up, 1.3 * s, null);
  fx.at(GEN.rays, up, 0.9 * s, col, { i: 0.7 });
  fx.at(GEN.starFlash, up, 1.3 * s, col);
  shockwave(fx, { pos, radius: c.R, color: col, dur: 0.55, height: 1.8 * s, dust: false });
  shockwave(fx, { pos, radius: c.R * 0.7, color: [2, 1.9, 1.6], dur: 0.45, wall: false, dust: false, delay: 0.08 });
  decal(fx, { pos, radius: c.R * 0.8, kind: 'holy', dur: 1.8, color: col, hot: 0.4 });
  lightPillar(fx, c.x, c.y, c.z, 0.9 * s, 9 * s, [col[0] * 0.9, col[1] * 0.9, col[2] * 0.9], 0.7);
  const o = fx.o(s, col);
  for (let i = 0; i < fx.n(50); i++) { const a = fx.r(0, TAU), r = fx.r(0.5, c.R); o.dt = r / (c.R / 0.5) * 0.9; fx.spawn(HOLY.mote, c.x + Math.cos(a) * r, c.y + fx.r(0.1, 0.5), c.z + Math.sin(a) * r, 0, fx.r(1, 2.5), 0, o); }
  fx.radial(HOLY.star, 24, up, 5, 10, 0.5, 2.5, s, col, 0.3);
  fx.sphere(FEATHER_RISE, 14, up, 1.5, 4, s, null, UP, 1.2);
};
K.light_pillar = (fx, p) => {        // pillar of light slamming down on the target point
  const c = ctx(fx, p, null, 2.2, 8, 6), s = c.R / 2.2, col = tc(c.tint, GOLD, 1.3);
  const x = p.target ? c.tx : c.x, z = p.target ? c.tz : c.z, y = p.target ? c.ty : c.y;
  const pos = vec(x, y, z);
  decal(fx, { pos, radius: c.R * 1.2, kind: 'holy', dur: 2.2, color: col, hot: 0.4 });
  const H = p.height ?? 16 * s;
  lightPillar(fx, x, y, z, c.R * 0.6, H, [col[0], col[1], col[2]], 1.0, 0, 0.12);
  lightPillar(fx, x, y, z, c.R * 0.25, H * 1.12, [1.4, 1.3, 1.1], 0.8, 3, 0.12);
  fx.at(HOLY.flash, pos, 1.6 * s, null, { dt: 0.12 }, 0, 1, 0);
  shockwave(fx, { pos, radius: c.R * 2.2, color: col, dur: 0.45, delay: 0.12, dust: false });
  const o = fx.o(s, col); o.dt = 0.12;
  for (let i = 0; i < fx.n(30); i++) { const a = fx.r(0, TAU); fx.spawn(HOLY.spark, x + Math.cos(a) * 0.4, y + 0.3, z + Math.sin(a) * 0.4, Math.cos(a) * fx.r(3, 8), fx.r(2, 9), Math.sin(a) * fx.r(3, 8), o); }
  fx.shake(0.25 * s, pos);
};
K.wrath_of_heaven = K.light_pillar;
K.sanctuary_zone = {                 // persistent holy circle (heal / buff zone), handle.stop()
  name: 'sanctuary_zone', fade: 0.5, group: 'Oathkeeper',
  init(T) {
    const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 5);
    T.v.col = tc(c.tint, GOLD, 1.4); T.v.R = c.R;
    T.v.dec = fx.decal({ pos: vec(c.x, c.y, c.z), radius: c.R, kind: T.p.kind ?? 'holy', dur: Infinity, color: T.v.col, hot: 0.8 });
    T.dur = T.p.dur ?? 6;
    groundPulse(fx, c.x, c.y, c.z, c.R, T.v.col, 1.2);
    fx.rings.walls(vec(c.x, c.y, c.z), c.R, 0.6, T.v.col, { h: 1.2, r0: c.R * 0.95, ease: 1 });
  },
  moved(T) { T.v.dec.setPos(T.pos); },
  tick(T) {
    const fx = T.fx, v = T.v, p = T.pos, gy = fx.gy(p.x, p.z, p.y);
    const o = fx.o(1, v.col);
    let n = T.rate('m', 12 * v.R);
    for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * v.R; fx.spawn(HOLY.mote, p.x + Math.cos(a) * r, gy + 0.1, p.z + Math.sin(a) * r, 0, fx.r(0.6, 1.4), 0, o); }
    n = T.rate('r', 0.6 * v.R);
    for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * v.R * 0.9; fx.spawn(RAY, p.x + Math.cos(a) * r, gy, p.z + Math.sin(a) * r, 0, 0, 0, o); }
    n = T.rate('e', 10 * v.R);
    for (let i = 0; i < n; i++) { const a = fx.r(0, TAU); fx.spawn(HOLY.riseSpark, p.x + Math.cos(a) * v.R, gy + 0.05, p.z + Math.sin(a) * v.R, 0, fx.r(1.5, 3), 0, o); }
  },
  stop(T) { T.v.dec.stop(); },
  end(T) { T.v.dec.stop(); },
};
K.heavenly_blessing = K.sanctuary_zone;
K.shield_bubble = {                  // golden hex bubble on the attach target(s)
  name: 'shield_bubble', fade: 0.3, group: 'Oathkeeper',
  init(T) {
    const fx = T.fx, p = T.p;
    const targets = p.targets || [p.attach ?? p.follow ?? p.unit].filter(Boolean);
    T.v.h = [];
    for (const t of targets) T.v.h.push(fx.aura({ attach: t, kind: 'shield', color: p.color ?? GOLD, dur: p.dur ?? 4, scale: p.scale ?? 1 }));
    if (!targets.length) { const c = ctx(fx, p); T.v.h.push(fx.aura({ pos: vec(c.x, c.y, c.z), kind: 'shield', color: p.color ?? GOLD, dur: p.dur ?? 4 })); }
    T.dur = p.dur ?? 4;
  },
  stop(T) { for (const h of T.v.h) h.stop(); },
};
K.holy_bulwark = K.shield_bubble;
K.brand_mark = (fx, p) => fx.aura({ attach: p.attach ?? p.follow ?? p.unit, pos: p.pos, kind: 'brand', color: p.color ?? 0xff5ab0, dur: p.dur ?? 8, scale: p.scale ?? 1, height: p.height });
K.holy_explosion = (fx, p) => {
  const c = ctx(fx, p, null, 3.5, 8, 5), s = c.R / 3.5, col = tc(c.tint, GOLD, 1.25);
  const x = p.target ? c.tx : c.x, z = p.target ? c.tz : c.z, y = p.target ? c.ty : c.y, pos = vec(x, y, z), up = vec(x, y + 1, z);
  fx.at(HOLY.flash, up, 1.4 * s, null);
  fx.at(GEN.rays, up, 1.0 * s, col, { i: 0.6 });
  fx.sphere(HOLY.cross, 6, up, 1, 3, s, col);
  fx.sphere(HOLY.spark, 40, up, 4, 11, s, col);
  shockwave(fx, { pos, radius: c.R * 1.6, color: col, dur: 0.45, height: 1.6 * s, dust: false });
  decal(fx, { pos, radius: c.R, kind: 'sun', dur: 2.5, color: [col[0] * 0.6, col[1] * 0.6, col[2] * 0.6] });
  fx.shake(0.2 * s, pos);
};
K.heal_burst = (fx, p) => {          // party heal: green-gold swirl burst on the caster
  const c = ctx(fx, p, null, 4), s = c.s, col = tc(c.tint, 0x7aff8a, 1.3);
  const pos = vec(c.x, c.y, c.z);
  fx.at(HEAL.glow, pos, 3 * s, col, null, 0, 1, 0);
  groundPulse(fx, c.x, c.y, c.z, c.R, col, 1);
  shockwave(fx, { pos, radius: c.R * 1.5, color: col, dur: 0.6, height: 1.2, dust: false });
  const o = fx.o(s, col);
  for (let i = 0; i < fx.n(60); i++) { const arm = i % 4; fx.spawn(GEN.orbitStar, c.x, c.y + fx.r(0, 0.4), c.z, fx.r(0.5, 1.2) * s, arm * TAU / 4 + fx.r(-0.3, 0.3), 5.5, o); }
  fx.sphere(HEAL.plus, 14, vec(c.x, c.y + 1.2, c.z), 1, 3, s, null, UP, 1.2);
  risingRing(fx, c.x, c.y, c.z, c.R * 0.8, HEAL.leaf, 18, null, s, [1, 3]);
};
K.rite_of_mending = K.heal_burst;
K.cleanse = (fx, p) => {             // white-cyan purifying spiral
  const c = ctx(fx, p), s = c.s, col = tc(c.tint, 0xc8f4ff, 1.5);
  const pos = vec(c.x, c.y, c.z);
  fx.at(GEN.flash, pos, 2 * s, col, null, 0, 1, 0);
  const o = fx.o(s, col);
  for (let i = 0; i < fx.n(50); i++) fx.spawn(GEN.orbitStar, c.x, c.y + fx.r(0, 0.2), c.z, fx.r(0.5, 0.9) * s, (i % 3) * TAU / 3 + fx.r(-0.2, 0.2), 7, o);
  fx.at(GEN.ringThin, pos, 0.3 * s, col, { life: 0.6 }, 0, 0.05, 0);
};
K.identity_burst = (fx, p) => {      // generic identity activation (colour = class palette)
  const c = ctx(fx, p), s = c.s, col = tc(c.tint, GOLD, 1.1);
  const pos = vec(c.x, c.y, c.z), up = vec(c.x, c.y + 1.1, c.z);
  fx.at(GEN.bigFlash, up, 0.35 * s, col);
  fx.at(GEN.rays, up, 0.9 * s, col, { i: 0.7 });
  shockwave(fx, { pos, radius: 4.5 * s, color: [col[0] * 1.5, col[1] * 1.5, col[2] * 1.5], dur: 0.5, height: 2 });
  fx.sphere(GEN.sparkLong, 40, up, 4, 10, s, col);
  risingRing(fx, c.x, c.y, c.z, 1.2 * s, HOLY.riseSpark, 30, col, s, [2, 5]);
  fx.flash(0.1, col);
};
K.sacred_chain = (fx, p) => fx.play('chain_throw', { ...p, color: p.color ?? GOLD });

for (const k in K) if (typeof K[k] === 'object') K[k].group = K[k].group || (/holy|sanct|shield|brand|heal|cleanse|light_pillar|sacred|rite|bulwark|blessing|wrath/.test(k) ? 'Oathkeeper' : 'Reaver');
for (const k in K) if (typeof K[k] === 'function') K[k].group = /holy|sanct|shield|brand|heal|cleanse|light_pillar|sacred|rite|bulwark|blessing|wrath|identity/.test(k) ? 'Oathkeeper' : 'Reaver';
export const WARRIOR = K;
