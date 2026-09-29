// Boss attacks (guardians + legion): breaths, spikes, gusts, lava, burrows, fox-fire, siren, kraken, eye beams,
// axe shockwaves, the 8-wedge rift carve, horn charges, roars, ghost phase — plus the generic monster hit names.
import * as THREE from 'three';
import { KEYS, ctx, tc, vec, groundSmash, along, GEN, PHYS, FIRE, FROST, HOLY, STORM, DARK, ARC, WATER, CRIM, AMB, TAU, UP, hue, shockwave, decal, hit, explosion, slash, S, R, P, v3 } from './lib.js';

const K = {};
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion();
const BREATH = {
  frost: {
    body: P({ pool: 'add', add: 0.55, sprite: [S.blob, S.smoke1, S.smoke3], ramp: R.frost, life: [0.62, 0.85], size: [0.5, 0.8], end: [5, 7], ease: 1.6, spin: [-2, 2], drag: 1.3, accY: -0.4, turb: 0.3, i: [1.3, 1.8] }),
    core: P({ sprite: [S.blob, S.glow], ramp: R.frostCore, life: [0.3, 0.42], size: [0.35, 0.5], end: [3, 3.8], ease: 1.4, spin: [-3, 3], drag: 1.1, i: [1.0, 1.4] }),
    smoke: P({ pool: 'alpha', sprite: [S.smoke1, S.smoke2, S.smoke3], ramp: R.frostMist, life: [1.3, 1.9], size: [1.2, 1.6], end: [3, 4], ease: 1.8, spin: [-0.5, 0.5], drag: 1.8, accY: -0.6, turb: 0.4 }),
    bits: FROST.shard, extra: FROST.flake, glow: [0.4, 0.75, 1], decal: 'frost',
  },
  fire: {
    body: P({ pool: 'add', add: 0.5, sprite: [S.blob, S.blob, S.smoke1], ramp: R.fire, life: [0.62, 0.85], size: [0.5, 0.8], end: [5.5, 7.5], ease: 1.6, spin: [-2.5, 2.5], drag: 1.3, accY: 1.6, turb: 0.35, i: [1.5, 2.1] }),
    core: P({ sprite: [S.blob, S.glow], ramp: R.fireCore, life: [0.3, 0.42], size: [0.35, 0.5], end: [3, 3.8], ease: 1.4, spin: [-3, 3], drag: 1.1, i: [1.1, 1.5] }),
    smoke: P({ pool: 'alpha', sprite: [S.smoke1, S.smoke2, S.plume], ramp: R.fireSmokeWarm, life: [1.3, 1.9], size: [1.2, 1.6], end: [3, 4], ease: 1.8, spin: [-0.5, 0.5], drag: 1.6, accY: 2.2, turb: 0.5 }),
    bits: FIRE.ember, extra: FIRE.ember, glow: [1, 0.5, 0.15], decal: 'scorch',
  },
  dark: {
    body: P({ pool: 'alpha', sprite: [S.smoke1, S.smoke2, S.blob], ramp: R.void, life: [0.62, 0.85], size: [0.5, 0.8], end: [5.5, 7.5], ease: 1.6, spin: [-2, 2], drag: 1.3, accY: 0.5, turb: 0.35, alpha: 1.1 }),
    core: P({ sprite: [S.blob, S.glow], ramp: R.shadow, life: [0.45, 0.65], size: [0.45, 0.65], end: [4.5, 5.5], ease: 1.4, spin: [-4, 4], drag: 1.2, turb: 0.25, i: [0.9, 1.3] }),
    smoke: P({ pool: 'alpha', sprite: [S.smoke1, S.smoke2, S.smoke3], ramp: R.void, life: [1.3, 1.8], size: [1.3, 1.7], end: [3, 4], ease: 1.8, spin: [-0.5, 0.5], drag: 1.7, accY: 0.8, turb: 0.5 }),
    bits: DARK.spark, extra: DARK.wisp, glow: [0.6, 0.2, 1], decal: 'void',
  },
};
const MOUTH = P({ sprite: S.glow, ramp: R.wPulse, life: 0.14, size: 2.6, i: 2.4, pingpong: true, noGround: true });
const WIND = P({ sprite: S.spark, ramp: R.wInOut, life: [0.35, 0.55], size: [0.08, 0.12], orient: 'stretch', stretch: 0.25, drag: 0.5, color: [0.9, 0.95, 1], i: 1.5, alpha: 0.8 });
const SONIC = P({ sprite: S.ring, ramp: R.wFade, life: 0.7, size: 1.2, end: 6, ease: 1.3, rot: 0, color: [0.4, 0.9, 1], i: 1.8, noGround: true });
const FOXORB = P({ sprite: [S.flame1, S.flame2], ramp: R.foxfire, life: [0.3, 0.5], size: [0.5, 0.8], end: 0.4, rot: [-0.3, 0.3], drag: 2, accY: 3, i: [2, 3] });
const GHOSTMIST = P({ pool: 'alpha', sprite: [S.smoke1, S.smoke2, S.smoke3], ramp: R.frostMist, life: [3, 5], size: [2.5, 4], end: 1.6, ease: 2, spin: [-0.2, 0.2], drag: 0.8, accY: 0.1, turb: 0.8, color: [0.75, 0.9, 1.2], alpha: 0.7 });

/** mouth/origin point: explicit `from`, a socket, or pos lifted by `height` */
function origin(fx, p, c, out, h = 3) {
  if (p.from) return v3(p.from, out);
  if (p.mouth) return v3(p.mouth, out);
  return out.set(c.x + c.f.x * 1.5, c.y + (p.height ?? h), c.z + c.f.z * 1.5);
}

// ------------------------------------------------------------------ breath cones
function breath(el) {
  return {
    name: el + '_breath', fade: 0.4, group: 'Bosses',
    init(T) {
      const fx = T.fx, p = T.p, c = ctx(fx, p, T.v.c = {}, 12, 12);
      T.v.pal = BREATH[el]; T.v.len = p.len ?? p.length ?? c.R; T.v.ang = (p.angle ?? 0.9) / 2;
      T.v.o = origin(fx, p, c, vec(0, 0, 0), 3.2);
      T.dur = p.dur ?? 2;
      if (p.telegraph !== false) T.v.tele = fx.telegraph({ shape: 'cone', pos: vec(c.x, c.y, c.z), dir: c.f, radius: T.v.len, angle: T.v.ang * 2, color: 'orange', dur: 0.01, fill: false, intensity: 0.5 });
      T.v.dec = fx.decal({ pos: vec(c.x + c.f.x * T.v.len * 0.55, c.y, c.z + c.f.z * T.v.len * 0.55), radius: T.v.len * 0.45, kind: T.v.pal.decal, dur: T.dur + 3, fadeIn: 0.8 });
    },
    tick(T) {
      const fx = T.fx, v = T.v, c = v.c, pal = v.pal, o = v.o, s = c.s;
      if (T.stopping) return;
      if (T.p.mouth?.isObject3D) v3(T.p.mouth, o);
      const sp = v.len * 1.6;
      const oo = fx.o(s, T.p.color !== undefined ? T.tint : null);
      let n = T.rate('b', 110);
      for (let i = 0; i < n; i++) { fx.rdir(_a, c.f, v.ang * 0.8); _a.y -= 0.12; fx.spawn(pal.body, o.x, o.y, o.z, _a.x * sp, _a.y * sp, _a.z * sp, oo); }
      n = T.rate('c', 70);
      for (let i = 0; i < n; i++) { fx.rdir(_a, c.f, v.ang * 0.5); _a.y -= 0.1; fx.spawn(pal.core, o.x, o.y, o.z, _a.x * sp * 1.1, _a.y * sp, _a.z * sp * 1.1, oo); }
      n = T.rate('s', 25);
      for (let i = 0; i < n; i++) { fx.rdir(_a, c.f, v.ang); fx.spawn(pal.smoke, o.x + _a.x * v.len * 0.6, o.y - 1.5, o.z + _a.z * v.len * 0.6, _a.x * 3, 0.5, _a.z * 3, oo); }
      n = T.rate('k', 60);
      for (let i = 0; i < n; i++) { fx.rdir(_a, c.f, v.ang); fx.spawn(pal.bits, o.x, o.y, o.z, _a.x * sp * 1.2, _a.y * sp - 2, _a.z * sp * 1.2, oo); }
      if (T.rate('m', 12)) fx.at(MOUTH, o, s, pal.glow);
      if (el === 'frost' && T.rate('i', 5)) { fx.rdir(_a, c.f, v.ang * 0.8); const d = fx.r(0.4, 1) * v.len; const x = c.x + _a.x * d, z = c.z + _a.z * d; fx.meshes.crystals.spawn(0, x, c.y - 0.05, z, 0, 0, 0, fx.r(1.2, 1.8), fx.r(0.2, 0.5), fx.r(0, TAU), 0, 0, fx.r(0.6, 1.2), 1, 0, [0.62, 0.85, 1], [0.4, 0.75, 1.5], 0.9, c.y); }
    },
    stop(T) { T.v.tele?.stop(); T.v.dec.stop(); },
    end(T) { T.v.tele?.stop(); },
  };
}
K.frost_breath = breath('frost');
K.fire_breath = breath('fire');
K.dark_breath = breath('dark');

// ------------------------------------------------------------------ spikes / ice
K.ice_spike_eruption = (fx, p) => {  // spikes burst from the ground at pos (or each of p.points)
  const pts = p.points || [p.pos];
  for (const q of pts) {
    const c = ctx(fx, { ...p, pos: q }, null, 2.6), s = c.R / 2.6, pos = vec(c.x, c.y, c.z);
    fx.meshes.spikeRings(c.x, c.y, c.z, [[0.2, 4, 2.0], [0.9, 8, 1.5], [1.8, 11, 1.0]], s, { speed: 30, life: [1.4, 1.9] });
    fx.at(FROST.flash, pos, 2.2 * s, null, null, 0, 1, 0);
    fx.radial(FROST.mist, 12, pos, 2, 4, 0.2, 1, s, null, 0.4, 0.3);
    fx.sphere(FROST.shard, 18, vec(c.x, c.y + 0.5, c.z), 3, 8, s, null, UP, 1.0);
    decal(fx, { pos, radius: c.R * 1.1, kind: 'frost', dur: 5 });
    shockwave(fx, { pos, radius: c.R * 1.3, color: [0.6, 1.1, 2], dur: 0.3, wall: false, dustCount: 4 });
  }
  fx.shake(0.25, pts[0]);
};
K.ice_spike = K.ice_spike_eruption;
K.ice_shatter = (fx, p) => { const c = ctx(fx, p, null, 2), pos = vec(c.x, c.y + 1, c.z); fx.meshes.shards(pos.x, pos.y, pos.z, 18, c.s * 1.2, { speed: 7 }); fx.at(FROST.flash, pos, 2 * c.s, null); fx.sphere(FROST.sparkle, 24, pos, 2, 6, c.s, null); fx.sphere(FROST.mist, 8, pos, 1, 3, c.s, null); };
K.crystal_shatter = (fx, p) => { const c = ctx(fx, p, null, 2), pos = vec(c.x, c.y + 1, c.z), col = tc(c.tint, 0xb8f0ff, 1); fx.meshes.shards(pos.x, pos.y, pos.z, 24, c.s * 1.3, { speed: 8, color: [col[0] * 0.7, col[1] * 0.7, col[2] * 0.7], glow: col }); fx.at(GEN.flash, pos, 2.2 * c.s, col); fx.sphere(GEN.star, 26, pos, 3, 7, c.s, col); };
K.frost_burst = (fx, p) => { const c = ctx(fx, p, null, 3); fx.play('frost_nova', { ...p, radius: c.R }); };
K.absolute_zero = (fx, p) => {       // arena-wide freeze burst
  const c = ctx(fx, p, null, 16), pos = vec(c.x, c.y, c.z), s = c.R / 16;
  fx.meshes.spikeRings(c.x, c.y, c.z, [[3, 14, 1.6], [6, 22, 1.4], [9, 30, 1.2], [12, 38, 1.0], [15, 44, 0.8]], s, { speed: 22, life: [2, 2.6] });
  for (let k = 0; k < 3; k++) shockwave(fx, { pos, radius: c.R * (1 + k * 0.15), color: [0.7, 1.3, 2.4], dur: 0.9, delay: k * 0.12, height: 3 });
  decal(fx, { pos, radius: c.R, kind: 'ice', dur: 8, fadeIn: 0.3 });
  fx.at(GEN.bigFlash, vec(c.x, c.y + 3, c.z), 3 * s, [0.7, 0.9, 1.4]);
  fx.radial(FROST.mist, 60, pos, 8, 16, 0.2, 1.5, 2 * s, null, 2, 0.4);
  fx.flash(0.5, [0.7, 0.85, 1.2]); fx.shake(0.9, pos);
};

// ------------------------------------------------------------------ gusts, breath-less cones
K.wing_gust = (fx, p) => {           // wings beat: cone of wind, dust wave, streaks
  const c = ctx(fx, p, null, 10, 10), s = c.s, ang = (p.angle ?? 1.4) / 2;
  const o = vec(c.x, c.y + 1.2, c.z);
  const ow = fx.o(s, null);
  for (let i = 0; i < fx.n(90); i++) { fx.rdir(_a, c.f, ang); _a.y *= 0.2; const v = fx.r(14, 24); ow.dt = fx.r(0, 0.25); fx.spawn(WIND, o.x + fx.r(-1, 1), o.y + fx.r(-1, 1.5), o.z + fx.r(-1, 1), _a.x * v, _a.y * v, _a.z * v, ow); }
  const od = fx.o(s * 1.3, null);
  for (let i = 0; i < fx.n(26); i++) { fx.rdir(_a, c.f, ang); const d = fx.r(1, 3); od.dt = fx.r(0, 0.2); fx.spawn(PHYS.dustBig, c.x + _a.x * d, c.y + 0.3, c.z + _a.z * d, _a.x * c.R * 0.9, 0.5, _a.z * c.R * 0.9, od); }
  shockwave(fx, { pos: vec(c.x, c.y, c.z), radius: c.R * 0.6, color: [1, 1.05, 1.1], dur: 0.5, wall: false, dust: false });
  fx.shake(0.2, o);
};
K.wind_burst = (fx, p) => { const c = ctx(fx, p, null, 3.5), pos = vec(c.x, c.y, c.z); fx.radial(WIND, 50, vec(c.x, c.y + 1, c.z), 8, 14, 0.5, 2, c.s, null, 0.5); fx.radial(PHYS.dustBig, 16, pos, 4, 8, 0.2, 1, c.s, null, 0.5, 0.3); shockwave(fx, { pos, radius: c.R * 1.4, color: [1.1, 1.2, 1.3], dur: 0.45, dust: false }); fx.at(GEN.swirl, vec(c.x, c.y + 1, c.z), 2.5 * c.s, [0.9, 1, 1.1]); };
K.whoosh_big = K.wind_burst;
K.siren_scream = (fx, p) => {        // Nerissa: sonic cone of rings (aqua) with distortion
  const c = ctx(fx, p, null, 12, 12), s = c.s, o = origin(fx, p, c, _b, 2.6).clone();
  for (let k = 0; k < 7; k++) {
    const d = 1 + k * c.R / 8;
    const oo = fx.o(s * (0.7 + k * 0.35), tc(c.tint, 0x6ae8ff, 1.2)); oo.dt = k * 0.07; oo.rot = 0;
    fx.spawn(SONIC, o.x + c.f.x * d, o.y - k * 0.2, o.z + c.f.z * d, c.f.x * 4, 0, c.f.z * 4, oo);
  }
  fx.telegraph({ shape: 'cone', pos: vec(c.x, c.y, c.z), dir: c.f, radius: c.R, angle: p.angle ?? 1.2, color: 'purple', dur: 0.2, detonate: true, intensity: 0.6 });
  fx.sphere(WATER.mist, 12, o, 3, 8, s, null, c.f, 0.5);
  fx.radialBlur(0.3, o); fx.shake(0.3, o);
};
K.boss_roar = (fx, p) => K.roar_ring(fx, p);
K.roar_ring = (fx, p) => {           // expanding roar shock rings + dust + screen shake
  const c = ctx(fx, p, null, 9), s = c.R / 9, pos = vec(c.x, c.y, c.z), col = tc(c.tint, 0xffe8c8, 1.2);
  for (let k = 0; k < 3; k++) shockwave(fx, { pos, radius: c.R * (0.8 + k * 0.3), color: col, dur: 0.6 + k * 0.1, delay: k * 0.12, height: 2.2 - k * 0.5, dust: k === 0, dustCount: 26 });
  const o = origin(fx, p, c, _b, 4).clone();
  for (let k = 0; k < 4; k++) fx.at(SONIC, o, s * (1 + k * 0.6), col, { dt: k * 0.06, life: 0.6 });
  fx.radialBlur(0.4, o); fx.shake(0.5, pos);
};

// ------------------------------------------------------------------ lava / fire
K.lava_pool = {                      // Cinderhorn: spreading lava pool (loop)
  name: 'lava_pool', fade: 0.8, group: 'Bosses',
  init(T) { const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 3.5); T.v.R = c.R; T.dur = T.p.dur ?? 8; T.v.dec = fx.decal({ pos: vec(c.x, c.y, c.z), radius: c.R, kind: 'lava', dur: Infinity, fadeIn: 0.5 }); fx.at(FIRE.flash, vec(c.x, c.y + 0.5, c.z), c.R, null); },
  moved(T) { T.v.dec.setPos(T.pos); },
  tick(T) {
    const fx = T.fx, v = T.v, p = T.pos, gy = fx.gy(p.x, p.z, p.y), R0 = v.R, rate = R0 * R0;
    let n = T.rate('f', rate * 2.2);
    for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * R0 * 0.85; fx.spawn(FIRE.lick, p.x + Math.cos(a) * r, gy + 0.1, p.z + Math.sin(a) * r, 0, fx.r(0.4, 1), 0, fx.o(1, null)); }
    n = T.rate('e', rate * 0.8);
    for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * R0 * 0.85; fx.spawn(FIRE.emberFloat, p.x + Math.cos(a) * r, gy + 0.2, p.z + Math.sin(a) * r, 0, fx.r(0.8, 2), 0, fx.o(1, null)); }
    n = T.rate('s', rate * 0.12);
    for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * R0 * 0.8; fx.spawn(FIRE.smokeWarm, p.x + Math.cos(a) * r, gy + 0.5, p.z + Math.sin(a) * r, 0, fx.r(0.4, 1), 0, fx.o(1.2, null)); }
    if (T.rate('b', rate * 0.08)) { const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * R0 * 0.7; fx.sphere(FIRE.lava, 6, _a.set(p.x + Math.cos(a) * r, gy + 0.1, p.z + Math.sin(a) * r), 1, 3, 1, null, UP, 0.5); }
  },
  stop(T) { T.v.dec.stop(); }, end(T) { T.v.dec.stop(); },
};
K.zone_lava = K.lava_pool;
K.lava_spit = (fx, p) => {           // lobbed lava glob → splash + small pool
  const c = ctx(fx, p, null, 2, 10, 9), o = origin(fx, p, c, _b, 3).clone();
  fx.projectile({ from: o, to: vec(c.tx, c.ty, c.tz), kind: 'lava', arc: p.arc ?? 3.5, speed: p.speed ?? 16, scale: c.s * 1.2, onHit: pos => { if (p.pool !== false) fx.play('lava_pool', { pos: vec(pos.x, pos.y, pos.z), radius: 1.8 * c.s, dur: p.poolDur ?? 4 }); } });
};
K.fire_burst = (fx, p) => { const c = ctx(fx, p, null, 2.5); explosion(fx, vec(c.x, c.y + 0.5, c.z), c.R / 2.5, 'fire', { color: p.color }); };
K.tail_flame_whip = (fx, p) => {     // Kurai: a flaming tail sweeps an arc
  const c = ctx(fx, p, null, 6), s = c.R / 6, col = tc(c.tint, 0x7a8aff, 2.2), pos = vec(c.x, c.y, c.z);
  slash(fx, { pos, dir: c.f, radius: c.R, style: 'h', arc: p.arc ?? 3.4, color: col, intensity: 1, width: c.R * 0.35, dur: 0.45, height: 0.6, flip: p.flip });
  const o = fx.o(s, null);
  for (let i = 0; i < fx.n(40); i++) {
    const u = i / 39, a = (u - 0.5) * (p.arc ?? 3.4) * (p.flip ? -1 : 1), r = c.R * fx.r(0.75, 1.02);
    o.dt = u * 0.16;
    fx.spawn(FOXORB, c.x + (c.f.x * Math.cos(a) + c.rt.x * Math.sin(a)) * r, c.y + fx.r(0.3, 1), c.z + (c.f.z * Math.cos(a) + c.rt.z * Math.sin(a)) * r, 0, fx.r(1, 3), 0, o);
  }
};
K.tail_sweep = (fx, p) => { const c = ctx(fx, p, null, 7); slash(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, radius: c.R, style: 'h', arc: p.arc ?? 3.6, color: tc(c.tint, 0xe8f0ff, 1.6), intensity: 1, width: c.R * 0.25, dur: 0.42, height: 0.5, flip: p.flip }); fx.radial(PHYS.dust, 14, vec(c.x, c.y, c.z), c.R * 0.8, c.R * 1.3, 0.2, 1, c.s, null, c.R * 0.3, 0.2); };
K.foxfire_orbs = {                   // Kurai: blue fox-fire orbs circle the boss, then fly out (loop until dur)
  name: 'foxfire_orbs', fade: 0.3, group: 'Bosses',
  init(T) {
    const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 3);
    T.v.n = T.p.count ?? 6; T.v.orbs = [];
    for (let i = 0; i < T.v.n; i++) { const o = { pos: new THREE.Vector3(), alive: true, scale: 0.55 * c.s, tint: [0.5, 0.7, 1.8] }; fx.meshes.props.add('orb', o); T.v.orbs.push(o); }
    T.dur = T.p.dur ?? 2.5; T.v.launch = T.p.launch ?? T.dur - 0.4;
  },
  tick(T, dt) {
    const fx = T.fx, v = T.v, c = v.c, p = T.pos;
    const launched = T.age > v.launch;
    for (let i = 0; i < v.n; i++) {
      const o = v.orbs[i];
      if (!launched) { const a = T.age * 2.2 + i / v.n * TAU; o.pos.set(p.x + Math.cos(a) * c.R, fx.gy(p.x, p.z, p.y) + 2.2 + Math.sin(T.age * 3 + i) * 0.3, p.z + Math.sin(a) * c.R); }
      else { const a = i / v.n * TAU + v.launch * 2.2; o.pos.x += Math.cos(a) * 16 * dt; o.pos.z += Math.sin(a) * 16 * dt; }
      if (T.rate(KEYS[i], 30)) fx.spawn(FOXORB, o.pos.x, o.pos.y, o.pos.z, 0, 0.5, 0, fx.o(c.s, null));
    }
  },
  stop(T) { for (const o of T.v.orbs) { o.alive = false; hit(T.fx, { pos: o.pos, element: 'arcane', scale: 1.2 }); } },
  end(T) { for (const o of T.v.orbs) o.alive = false; },
};

// ------------------------------------------------------------------ sand / earth
K.charge_dust = {                    // dust clouds + scrapes behind a charging boss (attach/follow)
  name: 'charge_dust', fade: 0.4, group: 'Bosses',
  init(T) { ctx(T.fx, T.p, T.v.c = {}, 2); T.dur = T.p.dur ?? 1.5; T.v.last = T.pos.clone(); },
  tick(T) {
    const fx = T.fx, v = T.v, c = v.c, p = T.pos, gy = fx.gy(p.x, p.z, p.y);
    if (T.stopping) return;
    const n = T.rate('d', 40);
    for (let i = 0; i < n; i++) fx.spawn(PHYS.dustBig, p.x + fx.r(-1, 1) * c.R, gy + 0.3, p.z + fx.r(-1, 1) * c.R, fx.r(-2, 2), fx.r(0.5, 1.5), fx.r(-2, 2), fx.o(c.s * 1.2, T.p.color !== undefined ? T.tint : null));
    const m = T.rate('p', 30);
    for (let i = 0; i < m; i++) fx.spawn(PHYS.pebble, p.x + fx.r(-1, 1) * c.R, gy + 0.2, p.z + fx.r(-1, 1) * c.R, fx.r(-3, 3), fx.r(3, 6), fx.r(-3, 3), fx.o(c.s, null));
    if (v.last.distanceToSquared(p) > 2.5) { decal(fx, { pos: v.last.clone(), dir: vec(p.x - v.last.x, 0, p.z - v.last.z), radius: 0.9 * c.s, length: v.last.distanceTo(p), kind: 'fissure', dur: 3, color: [0.4, 0.25, 0.15], hot: 0 }); v.last.copy(p); }
  },
};
K.horn_charge = K.charge_dust;
K.dust_burst = (fx, p) => { const c = ctx(fx, p, null, 2.5), pos = vec(c.x, c.y, c.z); fx.radial(PHYS.dustBig, 18, pos, 2, 5, 0.3, 1.5, c.s, null, 0.3, 0.3); fx.radial(PHYS.pebble, 12, pos, 2, 4, 3, 6, c.s); shockwave(fx, { pos, radius: c.R * 1.2, color: [1.2, 1.05, 0.85], dur: 0.35, wall: false }); };
K.burrow_plume = (fx, p) => {        // Sandmaw emerges: sand column, ring, debris
  const c = ctx(fx, p, null, 4.5), s = c.R / 4.5, pos = vec(c.x, c.y, c.z), col = tc(c.tint, 0xd8b070, 1);
  const o = fx.o(s * 1.6, null);
  for (let i = 0; i < fx.n(60); i++) { fx.rdir(_a, UP, 0.5); const v = fx.r(6, 16) * s; o.dt = fx.r(0, 0.3); fx.spawn(PHYS.sand, c.x + fx.r(-1, 1) * c.R * 0.3, c.y + 0.3, c.z + fx.r(-1, 1) * c.R * 0.3, _a.x * v * 0.4, _a.y * v, _a.z * v * 0.4, o); }
  fx.sphere(PHYS.sandGrain, 80, vec(c.x, c.y + 1, c.z), 5, 14, s, null, UP, 0.8);
  fx.meshes.debris(c.x, c.y + 0.5, c.z, 16, s, 10, { gy: c.y, color: [0.5, 0.4, 0.28], glow: [0, 0, 0] });
  shockwave(fx, { pos, radius: c.R * 2, color: [col[0] * 1.2, col[1] * 1.1, col[2]], dur: 0.6, height: 2, dustColor: 0xe0c090, dustCount: 30 });
  decal(fx, { pos, radius: c.R, kind: 'quake', dur: 6, color: [0.6, 0.45, 0.25], hot: 0 });
  fx.shake(0.6 * s, pos);
};
K.sandstorm = (fx, p) => fx.weather('dust', { intensity: 2, color: 0xd8b070, dur: p.dur ?? 6 });

// ------------------------------------------------------------------ water (siren / kraken)
K.water_orb = (fx, p) => { const c = ctx(fx, p, null, 1, 12, 12); return fx.projectile({ from: origin(fx, p, c, _b, 2.5).clone(), to: p.target ? vec(c.tx, c.ty + 1, c.tz) : undefined, dir: c.f, kind: 'water', speed: 14, scale: 1.4 * c.s }); };
K.tentacle_slam = (fx, p) => {       // kraken tentacle: water splash column + ring + spray
  const c = ctx(fx, p, null, 3.5), s = c.R / 3.5, pos = vec(c.x, c.y, c.z);
  const o = fx.o(s * 1.4, null);
  for (let i = 0; i < fx.n(60); i++) { const a = fx.r(0, TAU), r = fx.r(0, 0.6) * s; o.dt = fx.r(0, 0.1); fx.spawn(PHYS.drop, c.x + Math.cos(a) * r, c.y + 0.2, c.z + Math.sin(a) * r, Math.cos(a) * fx.r(1, 4) * s, fx.r(6, 13) * s, Math.sin(a) * fx.r(1, 4) * s, o); }
  fx.radial(WATER.foam, 24, pos, 3, 7, 0.5, 2, s * 1.4, null, 0.5, 0.3);
  fx.at(WATER.ring, vec(c.x, c.y + 0.04, c.z), s * 0.8, null);
  fx.at(WATER.ring, vec(c.x, c.y + 0.04, c.z), s * 1.2, null, { dt: 0.2 });
  shockwave(fx, { pos, radius: c.R * 1.6, color: [0.6, 1.1, 1.6], dur: 0.5, dust: false });
  decal(fx, { pos, radius: c.R, kind: 'water', dur: 6 });
  fx.shake(0.4 * s, pos);
};

// ------------------------------------------------------------------ beams / legion
K.eye_beam = {                       // Deep Oracle: a beam sweeps from the eye across the ground, scorching it
  name: 'eye_beam', fade: 0.2, group: 'Bosses',
  init(T) {
    const fx = T.fx, p = T.p, c = ctx(fx, p, T.v.c = {}, 1, 14, 10);
    T.v.from = p.from?.isObject3D ? p.from : origin(fx, p, c, vec(0, 0, 0), 4);
    T.v.col = tc(c.tint, 0xc070ff, 2.2);
    T.v.a = vec(c.tx - c.rt.x * c.L * 0.4, c.ty, c.tz - c.rt.z * c.L * 0.4); T.v.b = vec(c.tx + c.rt.x * c.L * 0.4, c.ty, c.tz + c.rt.z * c.L * 0.4);
    if (p.sweepFrom) v3(p.sweepFrom, T.v.a); if (p.sweepTo) v3(p.sweepTo, T.v.b);
    T.v.hitP = T.v.a.clone();
    T.dur = p.dur ?? 1.6;
    T.v.beam = fx.beam({ from: T.v.from, to: T.v.hitP, kind: 'energy', color: T.v.col, width: 1.0 * c.s, dur: T.dur });
    T.v.beam2 = fx.beam({ from: T.v.from, to: T.v.hitP, kind: 'glow', color: [2.4, 2.2, 2.6], width: 0.3 * c.s, dur: T.dur });
    T.v.last = T.v.hitP.clone();
  },
  tick(T) {
    const fx = T.fx, v = T.v, c = v.c;
    v.hitP.lerpVectors(v.a, v.b, Math.min(1, T.age / T.dur));
    const n = T.rate('s', 60);
    const vh = v.hue || (v.hue = hue(v.col, [0, 0, 0]));
    for (let i = 0; i < n; i++) { fx.rdir(_a, UP, 1.2); fx.spawn(GEN.spark, v.hitP.x, v.hitP.y + 0.1, v.hitP.z, _a.x * 6, _a.y * 6, _a.z * 6, fx.o(c.s, vh)); }
    if (T.rate('f', 20)) fx.at(GEN.glowFade, _b.set(v.hitP.x, v.hitP.y + 0.3, v.hitP.z), 2 * c.s, vh);
    if (T.rate('m', 10)) fx.spawn(DARK.smoke, v.hitP.x, v.hitP.y + 0.3, v.hitP.z, 0, 1, 0, fx.o(c.s, null));
    if (v.last.distanceToSquared(v.hitP) > 1.2) { decal(fx, { pos: v.last.clone(), dir: vec(v.hitP.x - v.last.x, 0, v.hitP.z - v.last.z), radius: 0.8 * c.s, length: v.last.distanceTo(v.hitP) + 0.4, kind: 'fissure', dur: 4, color: [v.col[0] * 0.8, v.col[1] * 0.8, v.col[2] * 0.8] }); v.last.copy(v.hitP); }
  },
};
K.axe_shockwave = (fx, p) => {       // Gorrath: axe slam + a line shockwave racing forward
  const c = ctx(fx, p, null, 3.5, 16), s = c.s, col = tc(c.tint, 0xff5a2a, 1.4);
  const hitP = vec(c.x + c.f.x * 2.5 * s, c.y, c.z + c.f.z * 2.5 * s);
  groundSmash(fx, hitP.x, hitP.y, hitP.z, c.R, col, { decal: 'crater', shake: 0.7 });
  const speed = 26, L = c.L;
  fx.meshes.spikeLine(hitP.x + c.f.x, hitP.y, hitP.z + c.f.z, c.f.x, c.f.z, L, Math.round(L * 1.8), 1.2 * s, { color: [0.26, 0.2, 0.18], glow: [col[0], col[1], col[2]], fres: 0.2, speed, life: 1.4, spread: 0.9 });
  decal(fx, { pos: hitP, dir: c.f, radius: 1.6 * s, length: L, kind: 'fissure', dur: 5, color: col });
  const o = fx.o(s, null);
  along(hitP.x, hitP.z, c.f, L, fx.n(14), (x, z, u) => { o.dt = u * L / speed; fx.spawn(PHYS.dustBig, x, c.y + 0.3, z, fx.r(-2, 2), 1, fx.r(-2, 2), o); });
  for (let k = 0; k < 5; k++) fx.rings.ground(vec(hitP.x + c.f.x * L * k / 5, c.y, hitP.z + c.f.z * L * k / 5), 2.6 * s, 0.35, col, { ew: 0.2, trail: 1, flags: 1, delay: L * k / 5 / speed });
};
K.impact_heavy = (fx, p) => { const c = ctx(fx, p, null, 3); groundSmash(fx, c.x, c.y, c.z, c.R, tc(c.tint, 0xffc080, 1.1), { decal: 'crack', rocks: 8 }); };
K.slash_heavy = (fx, p) => { const c = ctx(fx, p, null, 5); slash(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, radius: c.R, style: p.style ?? 'h', color: tc(c.tint, 0xffe0c0, 2.2), intensity: 1, width: c.R * 0.4, dur: 0.4, flip: p.flip }); fx.shake(0.2, vec(c.x, c.y, c.z)); };
K.bite = (fx, p) => { const c = ctx(fx, p, null, 3), g = vec(c.x + c.f.x * c.R * 0.7, c.y + 1.2, c.z + c.f.z * c.R * 0.7); for (const k of [-1, 1]) slash(fx, { pos: vec(g.x, c.y, g.z), dir: c.f, radius: 1.2 * c.s, style: k > 0 ? 'v' : 'up', color: [2, 1.9, 1.8], intensity: 1, dur: 0.18, width: 0.3, glow: false, height: 0.9 }); fx.hit({ pos: g, dir: c.f, crit: true, scale: 1.4 }); };
K.monster_hit = (fx, p) => { const c = ctx(fx, p); fx.hit({ pos: vec(c.x, c.y + 1, c.z), dir: c.f, scale: 1.2 }); };
K.rift_carve = {                     // Gorrath: 8-wedge carve — alternating wedges telegraph, then erupt
  name: 'rift_carve', fade: 0.1, group: 'Bosses',
  init(T) {
    const fx = T.fx, p = T.p, c = ctx(fx, p, T.v.c = {}, 14);
    T.v.n = p.count ?? 8; T.v.phase = p.phase ?? 0; T.v.delay = p.delay ?? 2;
    T.v.tele = fx.telegraph({ shape: 'wedges', pos: vec(c.x, c.y, c.z), dir: c.f, radius: c.R, count: T.v.n, phase: T.v.phase, color: p.teleColor ?? 'purple', dur: T.v.delay });
    if (p.second !== false) T.v.tele2 = fx.telegraph({ shape: 'wedges', pos: vec(c.x, c.y, c.z), dir: c.f, radius: c.R, count: T.v.n, phase: 1 - T.v.phase, color: p.teleColor ?? 'purple', dur: T.v.delay, delay: T.v.delay + 0.4 });
    T.dur = T.v.delay * 2 + 1.2;
  },
  tick(T) {
    const fx = T.fx, v = T.v, c = v.c;
    for (let k = 0; k < 2; k++) {
      if (k === 1 && !v.tele2) break;
      if (T.once(KEYS[k], v.delay + k * (v.delay + 0.4))) {
        const ph = k ? 1 - v.phase : v.phase, sw = TAU / v.n;
        for (let i = 0; i < v.n; i++) {
          if (((i + ph) % 2) !== 0) continue;
          const a = -Math.PI + (i - ph + 0.5) * sw;   // wedge centre angle (from forward, matches the shader)
          const dx = c.f.x * Math.cos(a) + c.rt.x * Math.sin(a), dz = c.f.z * Math.cos(a) + c.rt.z * Math.sin(a);
          for (let j = 1; j <= 4; j++) {
            const r = c.R * j / 4.6, x = c.x + dx * r, z = c.z + dz * r;
            fx.meshes.pillars.spawn(x, c.y, z, 0.6 + j * 0.2, 4 + j, 0.6, 3, [1.6, 0.4, 2.4], 0.05, 1, j * 0.04);
            fx.sphere(ARC.spark, 8, vec(x, c.y + 1, z), 3, 8, 1, null, UP, 1.0);
          }
          fx.meshes.spikeLine(c.x + dx * 1.5, c.y, c.z + dz * 1.5, dx, dz, c.R - 1.5, Math.round(c.R * 0.9), 1.2, { color: [0.2, 0.1, 0.26], glow: [1.4, 0.4, 2.2], fres: 0.5, speed: 40, life: 1.2, spread: c.R * 0.08 });
        }
        fx.shake(0.6, T.pos); fx.flash(0.15, [0.8, 0.4, 1.2]);
      }
    }
  },
  end(T) { T.v.tele.stop(); T.v.tele2?.stop(); },
};
K.ghost_mist = {                     // ghost phase: pale blue mist + wisps over the arena (loop)
  name: 'ghost_mist', fade: 1.5, group: 'Bosses',
  init(T) { ctx(T.fx, T.p, T.v.c = {}, 16); T.dur = T.p.dur ?? Infinity; },
  tick(T) {
    const fx = T.fx, c = T.v.c, p = T.pos, gy = fx.gy(p.x, p.z, p.y);
    let n = T.rate('m', 4 + c.R * 0.6);
    for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * c.R; fx.spawn(GHOSTMIST, p.x + Math.cos(a) * r, gy + fx.r(0.3, 1.2), p.z + Math.sin(a) * r, fx.r(-0.3, 0.3), 0.05, fx.r(-0.3, 0.3), fx.o(1, null)); }
    n = T.rate('w', 1 + c.R * 0.4);
    for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * c.R; fx.spawn(AMB.wisp, p.x + Math.cos(a) * r, gy + fx.r(0.3, 2), p.z + Math.sin(a) * r, 0, 0.6, 0, fx.o(1.2, null)); }
  },
};
K.enrage = (fx, p) => {              // boss enrage burst (red) + aura if attached
  const c = ctx(fx, p, null, 6), s = c.s, pos = vec(c.x, c.y, c.z), up = vec(c.x, c.y + 2.5 * s, c.z);
  fx.at(CRIM.flash, up, 3 * s, null);
  for (let k = 0; k < 2; k++) shockwave(fx, { pos, radius: c.R * (1 + k * 0.4), color: [2.4, 0.2, 0.1], dur: 0.6, delay: k * 0.12, height: 2.4 });
  fx.sphere(CRIM.flame, 40, up, 2, 6, s, null, UP, 1.2);
  const att = p.attach ?? p.follow ?? p.unit;
  if (att?.isObject3D) fx.aura({ attach: att, kind: 'enrage', scale: s * 2, dur: p.dur ?? Infinity });
  fx.flash(0.2, [1, 0.2, 0.15]); fx.shake(0.4, pos);
};

for (const k in K) K[k].group = 'Bosses';
export const BOSS = K;
