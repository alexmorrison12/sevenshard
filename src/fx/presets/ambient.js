// Ambient loops (torch, brazier, campfire, fountain, forge sparks) and combat utility presets (counter hit, stagger
// break, part break, level up, revive, spawn puff, footstep dust, spike line, ground zones zone_<kind>).
import * as THREE from 'three';
import { ctx, tc, vec, groundSmash, along, risingRing, groundPulse, lightPillar, GEN, PHYS, FIRE, FROST, HOLY, STORM, DARK, ARC, HEAL, WATER, POI, CRIM, AMB, MUSIC, TAU, UP, hue, shockwave, decal, hit, explosion, S, R, P, v3 } from './lib.js';

const K = {};
const _a = new THREE.Vector3();
const TORCH = P({ sprite: [S.flame1, S.flame2], ramp: R.fire, life: [0.28, 0.45], size: [0.22, 0.32], end: [0.3, 0.5], rot: [-0.15, 0.15], drag: 2, accY: 3, turb: 0.05, i: [1.8, 2.4] });
const TORCH_GLOW = P({ sprite: S.glow, ramp: R.wPulse, life: 0.35, size: 1.1, color: [1, 0.5, 0.15], i: 1.2, pingpong: true, noGround: true });
const CAMP_FLAME = P({ sprite: [S.flame1, S.flame2], ramp: R.fire, life: [0.55, 0.9], size: [0.6, 0.95], end: [0.25, 0.45], ease: 1.3, rot: [-0.2, 0.2], drag: 1.5, accY: 3.2, turb: 0.1, i: [1.5, 2.1] });
const CAMP_BASE = P({ sprite: [S.blob, S.flame2], ramp: R.fireCore, life: [0.3, 0.5], size: [0.5, 0.7], end: 0.6, spin: [-2, 2], drag: 2, accY: 1.5, i: [1.2, 1.6] });
const CAMP_GLOW = P({ sprite: S.glow, ramp: R.wPulse, life: 0.5, size: 1.5, color: [1, 0.55, 0.18], i: 1.5, pingpong: true });
const CAMP_GROUND = P({ sprite: S.glow, ramp: R.wPulse, life: 0.7, size: 5, orient: 'flat', color: [1, 0.45, 0.12], i: 0.55, pingpong: true });
const SPRAY = P({ pool: 'alpha', sprite: S.drop, ramp: R.water, life: [0.7, 1.0], size: [0.05, 0.09], orient: 'stretch', stretch: 0.3, drag: 0.4, accY: -9, color: [0.95, 1, 1.05] });
const FORGE = P({ sprite: S.spark, ramp: R.ember, life: [0.5, 0.9], size: [0.04, 0.07], orient: 'stretch', stretch: 1.2, drag: 0.8, accY: -9, i: [5, 8] });
const STAR_BIG = P({ sprite: S.star, ramp: R.wFlash, life: 0.5, size: 5, end: 1.4, spin: 1, i: 3, noGround: true });
const SHARD_SPR = P({ sprite: S.shard, ramp: R.wFade, life: [0.6, 1.0], size: [0.3, 0.55], spin: [-10, 10], randSpin: true, drag: 0.8, accY: -12, i: [1.8, 2.6] });
const LV_RING = P({ sprite: S.ring, ramp: R.holy, life: 0.8, size: 0.8, end: 6, ease: 2.2, orient: 'flat', i: 2.6 });

// ------------------------------------------------------------------ ambient loops (attach or pos; handle.stop())
function loop(name, tick, init) { return { name, fade: 0.4, group: 'Ambient', init(T) { T.dur = T.p.dur ?? Infinity; T.v.s = T.p.scale ?? 1; init?.(T); }, tick }; }
K.torch = loop('torch', T => {
  const fx = T.fx, p = T.pos, s = T.v.s;
  const n = T.rate('f', 36 * s); for (let i = 0; i < n; i++) fx.spawn(TORCH, p.x + fx.r(-0.06, 0.06) * s, p.y, p.z + fx.r(-0.06, 0.06) * s, 0, fx.r(0.3, 0.8) * s, 0, fx.o(s, null));
  const m = T.rate('e', 5); for (let i = 0; i < m; i++) fx.spawn(FIRE.emberFloat, p.x, p.y + 0.2, p.z, fx.r(-0.3, 0.3), fx.r(0.5, 1.5), fx.r(-0.3, 0.3), fx.o(s * 0.7, null));
  const k = T.rate('s', 3); for (let i = 0; i < k; i++) fx.spawn(FIRE.smoke, p.x, p.y + 0.5 * s, p.z, 0, 0.6, 0, fx.o(s * 0.5, null));
}, T => T.hold(TORCH_GLOW, 0, 0.15, 0, { scale: T.v.s }));
K.brazier = loop('brazier', T => {
  const fx = T.fx, p = T.pos, s = T.v.s;
  const n = T.rate('f', 60 * s); for (let i = 0; i < n; i++) fx.spawn(CAMP_FLAME, p.x + fx.r(-0.3, 0.3) * s, p.y, p.z + fx.r(-0.3, 0.3) * s, 0, fx.r(0.4, 1) * s, 0, fx.o(s * 0.8, null));
  const m = T.rate('e', 10); for (let i = 0; i < m; i++) fx.spawn(FIRE.emberFloat, p.x, p.y + 0.4, p.z, fx.r(-0.4, 0.4), fx.r(0.8, 2), fx.r(-0.4, 0.4), fx.o(s, null));
  const k = T.rate('s', 4); for (let i = 0; i < k; i++) fx.spawn(FIRE.smoke, p.x, p.y + 1.2 * s, p.z, 0, 0.8, 0, fx.o(s * 0.8, null));
}, T => T.hold(CAMP_GLOW, 0, 0.5, 0, { scale: T.v.s * 1.2 }));
K.campfire = loop('campfire', T => {
  const fx = T.fx, p = T.pos, s = T.v.s;
  const n = T.rate('f', 45 * s); for (let i = 0; i < n; i++) fx.spawn(CAMP_FLAME, p.x + fx.r(-0.25, 0.25) * s, p.y + 0.1, p.z + fx.r(-0.25, 0.25) * s, 0, fx.r(0.3, 0.8) * s, 0, fx.o(s, null));
  const b = T.rate('b', 14); for (let i = 0; i < b; i++) fx.spawn(CAMP_BASE, p.x + fx.r(-0.2, 0.2) * s, p.y + 0.1, p.z + fx.r(-0.2, 0.2) * s, 0, 0.3, 0, fx.o(s, null));
  const m = T.rate('e', 8); for (let i = 0; i < m; i++) fx.spawn(FIRE.emberFloat, p.x, p.y + 0.4, p.z, fx.r(-0.4, 0.4), fx.r(0.8, 2), fx.r(-0.4, 0.4), fx.o(s, null));
  const k = T.rate('s', 4); for (let i = 0; i < k; i++) fx.spawn(FIRE.smoke, p.x, p.y + 1.1 * s, p.z, 0, 0.7, 0, fx.o(s * 0.8, null));
}, T => { T.hold(CAMP_GLOW, 0, 0.6, 0, { scale: T.v.s }); T.hold(CAMP_GROUND, 0, 0.05, 0, { scale: T.v.s }); });
K.fountain = loop('fountain', T => {
  const fx = T.fx, p = T.pos, s = T.v.s;
  const n = T.rate('w', 90 * s); for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = fx.r(0.4, 1.4) * s; fx.spawn(SPRAY, p.x + fx.r(-0.05, 0.05), p.y, p.z + fx.r(-0.05, 0.05), Math.cos(a) * r, fx.r(4.5, 5.5) * s, Math.sin(a) * r, fx.o(s, null)); }
  const m = T.rate('m', 3); for (let i = 0; i < m; i++) fx.spawn(PHYS.mist, p.x + fx.r(-1, 1) * s, p.y - 0.5, p.z + fx.r(-1, 1) * s, 0, 0.3, 0, fx.o(s, null));
  if (T.rate('r', 2.5)) fx.spawn(WATER.ring, p.x + fx.r(-1, 1) * s, p.y - (T.p.basin ?? 0.9), p.z + fx.r(-1, 1) * s, 0, 0, 0, fx.o(s * 0.4, null));
});
K.forge_sparks = loop('forge_sparks', T => {
  const fx = T.fx, p = T.pos, s = T.v.s;
  if (T.rate('h', T.p.rate ?? 0.8)) {           // hammer strike: a burst of sparks + flash
    fx.at(GEN.flash, p, 0.7 * s, [1, 0.6, 0.25]);
    const o = fx.o(s, null);
    for (let i = 0; i < fx.n(30); i++) { fx.rdir(_a, UP, 1.3); const v = fx.r(3, 7); fx.spawn(FORGE, p.x, p.y, p.z, _a.x * v, _a.y * v + 1, _a.z * v, o); }
  }
  const n = T.rate('e', 6); for (let i = 0; i < n; i++) fx.spawn(FIRE.emberFloat, p.x + fx.r(-0.3, 0.3), p.y, p.z + fx.r(-0.3, 0.3), 0, fx.r(0.5, 1.5), 0, fx.o(s * 0.8, null));
}, T => T.hold(TORCH_GLOW, 0, 0, 0, { scale: T.v.s * 1.3 }));

// ------------------------------------------------------------------ combat utility
K.counter_hit = (fx, p) => {         // successful counter: blue shatter star + COUNTER flash
  const c = ctx(fx, p, null, 3), s = c.s, up = vec(c.x, c.y + (p.height ?? 2.5) * s, c.z), col = tc(c.tint, 0x5aa8ff, 1.6);
  fx.at(STAR_BIG, up, s, col, { rot: 0.3 });
  fx.at(GEN.bigFlash, up, 0.8 * s, col);
  fx.at(GEN.flare, up, 3 * s, col, { rot: 0 });
  fx.sphere(GEN.sparkLong, 50, up, 6, 16, s, col);
  fx.sphere(SHARD_SPR, 20, up, 4, 9, s, col);
  shockwave(fx, { pos: vec(c.x, c.y, c.z), radius: 6 * s, color: [col[0] * 1.2, col[1] * 1.2, col[2] * 1.2], dur: 0.5, height: 2.4 });
  fx.flash(0.2, [0.5, 0.7, 1.2]); fx.shake(0.35, up); fx.aberr(0.5);
};
K.stagger_break = (fx, p) => {       // purple-white explosion with shattering bar shards
  const c = ctx(fx, p, null, 4), s = c.R / 4, up = vec(c.x, c.y + 2.2 * s, c.z), col = tc(c.tint, 0xb070ff, 1.5);
  fx.at(GEN.bigFlash, up, 1.1 * s, col);
  fx.at(STAR_BIG, up, 1.4 * s, [1.1, 0.9, 1.3], { rot: 0 });
  fx.at(GEN.rays, up, 1.6 * s, col);
  fx.meshes.shards(up.x, up.y, up.z, 26, 1.4 * s, { color: [0.5, 0.3, 0.8], glow: [col[0], col[1], col[2]], speed: 9, size: 0.4 });
  fx.sphere(GEN.sparkLong, 60, up, 6, 16, s, col);
  for (let k = 0; k < 2; k++) shockwave(fx, { pos: vec(c.x, c.y, c.z), radius: c.R * (1.6 + k * 0.6), color: col, dur: 0.6, delay: k * 0.1, height: 2.6 });
  decal(fx, { pos: vec(c.x, c.y, c.z), radius: c.R * 0.8, kind: 'arcane', dur: 1.5, color: col });
  fx.flash(0.25, [0.9, 0.7, 1.2]); fx.shake(0.5, up); fx.radialBlur(0.35, up);
};
K.part_break = (fx, p) => {          // a boss part shatters: shards + sparks + flash at the part
  const c = ctx(fx, p, null, 2), s = c.s, pos = p.part ? v3(p.part, _a).clone() : vec(c.x, c.y + (p.height ?? 4) * s, c.z), col = tc(c.tint, 0xffe0b0, 1.4);
  fx.at(GEN.bigFlash, pos, 0.6 * s, col);
  fx.at(GEN.starFlash, pos, 2.4 * s, col);
  fx.meshes.shards(pos.x, pos.y, pos.z, 18, 1.3 * s, { color: [0.75, 0.68, 0.6], glow: [col[0] * 0.6, col[1] * 0.6, col[2] * 0.6], fres: 0.3, speed: 8, size: 0.45 });
  fx.meshes.debris(pos.x, pos.y, pos.z, 8, s * 0.8, 7, { gy: c.y, color: [0.6, 0.55, 0.48], glow: [0.4, 0.2, 0.05] });
  fx.sphere(GEN.sparkLong, 40, pos, 5, 13, s, col);
  fx.sphere(PHYS.smoke, 8, pos, 1, 3, s, null);
  fx.shake(0.3, pos);
};
K.level_up = {                       // 2.5 s ding: gold pillar, rings, rising sparks
  name: 'level_up', fade: 0.4, group: 'Utility',
  init(T) {
    const fx = T.fx, s = T.v.s = T.p.scale ?? 1, P0 = T.pos, gy = fx.gy(P0.x, P0.z, P0.y);
    lightPillar(fx, P0.x, gy, P0.z, 0.9 * s, 10 * s, [1.8, 1.4, 0.6], 2.2, 0);
    fx.at(HOLY.flash, P0, 2 * s, null, null, 0, 1.2, 0);
    fx.at(GEN.starFlash, P0, 1.6 * s, [1, 0.85, 0.5], null, 0, 1.3, 0);
    for (let i = 0; i < 4; i++) fx.at(LV_RING, P0, s * (i % 2 ? 0.8 : 0.7), null, { dt: [0, 0.25, 0.6, 1.1][i] }, 0, 0.08, 0);
    fx.radial(HOLY.spark, 26, vec(P0.x, gy + 0.3, P0.z), 2, 5, 1, 5, s);
    T.dur = 2.5;
  },
  tick(T) {
    const fx = T.fx, s = T.v.s, P0 = T.pos, k = Math.max(0, 1 - T.age / 2.3);
    const n = T.rate('r', 70 * k); for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = fx.r(0.2, 1.2) * s; fx.spawn(HOLY.riseSpark, P0.x + Math.cos(a) * r, P0.y + fx.r(0, 0.5), P0.z + Math.sin(a) * r, 0, fx.r(2, 5) * s, 0, fx.o(s, null)); }
    const m = T.rate('o', 50 * k); for (let i = 0; i < m; i++) fx.spawn(GEN.orbitStar, P0.x, P0.y + fx.r(0, 0.5) * s, P0.z, fx.r(0.8, 1.3) * s, fx.r(0, TAU), fx.r(1.5, 3), fx.o(s, [1, 0.85, 0.45]));
  },
};
K.revive = {                         // light descends onto the fallen, then lifts them
  name: 'revive', fade: 0.4, group: 'Utility',
  init(T) {
    const fx = T.fx, s = T.v.s = T.p.scale ?? 1, P0 = T.pos, gy = fx.gy(P0.x, P0.z, P0.y);
    lightPillar(fx, P0.x, gy, P0.z, 0.8 * s, 12 * s, [1.6, 1.6, 1.4], 2, 0);
    fx.at(HOLY.flash, P0, 2 * s, null, { dt: 1 }, 0, 1.2, 0);
    fx.at(HOLY.cross, P0, 1.3 * s, null, { dt: 1, life: 1 }, 0, 1.4, 0);
    fx.at(HOLY.ring, P0, 0.6 * s, null, { dt: 1 }, 0, 0.08, 0);
    T.dur = 2.2;
  },
  tick(T) {
    const fx = T.fx, s = T.v.s, P0 = T.pos;
    if (T.age < 1) { const n = T.rate('d', 60); for (let i = 0; i < n; i++) fx.spawn(RES_DOWN, P0.x, P0.y + fx.r(2.5, 3.5) * s, P0.z, fx.r(0.8, 1.2) * s, fx.r(0, TAU), fx.r(2, 4), fx.o(s, null)); }
    else { const n = T.rate('u', 40); for (let i = 0; i < n; i++) fx.spawn(HOLY.riseSpark, P0.x + fx.r(-0.4, 0.4) * s, P0.y + fx.r(0, 1.5) * s, P0.z + fx.r(-0.4, 0.4) * s, 0, fx.r(1, 3) * s, 0, fx.o(s, null)); }
  },
};
const RES_DOWN = P({ sprite: S.twinkle, ramp: R.holyWarm, life: [0.9, 1.1], size: [0.16, 0.24], end: 0.5, motion: 'orbit', rise: -2.8, rgrow: -0.9, spin: 3, i: [3, 5] });
K.spawn_puff = (fx, p) => {          // mob spawn: purple-ish rift puff
  const c = ctx(fx, p), s = c.s, pos = vec(c.x, c.y, c.z), col = tc(c.tint, 0xa070ff, 1);
  fx.radial(PHYS.smoke, 14, pos, 1, 3.2, 0.4, 1.6, s, null, 0.2, 0.5);
  fx.at(GEN.ringThin, pos, 0.3 * s, col, { life: 0.5 }, 0, 0.06, 0);
  fx.sphere(ARC.star, 10, vec(c.x, c.y + 0.8, c.z), 1, 3, s, col);
  fx.at(PHYS.hitFlash, pos, 1.8 * s, col, null, 0, 0.8, 0);
  decal(fx, { pos, radius: 1.2 * s, kind: 'swirl', dur: 1.2, color: col });
};
K.footstep_dust = (fx, p) => { const c = ctx(fx, p); fx.radial(PHYS.dust, 4, vec(c.x, c.y, c.z), 0.3, 0.9, 0.1, 0.4, 0.5 * c.s, null, 0.1, 0.1); };
K.dust_puff = K.footstep_dust;
K.spike_line = {                     // boss special: a line of sequential circle telegraphs, each erupting in turn
  name: 'spike_line', fade: 0.1, group: 'Bosses',
  init(T) {
    const fx = T.fx, p = T.p, c = ctx(fx, p, T.v.c = {}, 1.6, 14);
    T.v.n = p.count ?? Math.max(3, Math.round(c.L / (c.R * 1.6))); T.v.step = p.step ?? 0.18; T.v.warn = p.warn ?? 0.9;
    T.v.kind = p.kind ?? 'ice';
    for (let i = 0; i < T.v.n; i++) {
      const u = (i + 0.5) / T.v.n;
      fx.telegraph({ shape: 'circle', pos: vec(c.x + c.f.x * c.L * u, c.y, c.z + c.f.z * c.L * u), radius: c.R, color: p.color ?? 'red', dur: T.v.warn, delay: i * T.v.step });
    }
    T.dur = T.v.warn + T.v.n * T.v.step + 0.3;
  },
  tick(T) {
    const fx = T.fx, v = T.v, c = v.c;
    for (let i = 0; i < v.n; i++) if (T.once(KEYS[i % KEYS.length], v.warn + i * v.step)) {
      const u = (i + 0.5) / v.n, x = c.x + c.f.x * c.L * u, z = c.z + c.f.z * c.L * u;
      if (v.kind === 'ice') fx.play('ice_spike_eruption', { pos: vec(x, c.y, z), radius: c.R });
      else if (v.kind === 'fire') fx.play('flame_pillar', { pos: vec(x, c.y, z), radius: c.R });
      else if (v.kind === 'blood') fx.meshes.pillars.spawn(x, c.y, z, c.R * 0.5, 5, 0.8, 2, [2, 0.1, 0.15]);
      else groundSmash(fx, x, c.y, z, c.R, [1.4, 0.7, 0.3], { rocks: 5, shake: 0.12, decal: 'crack' });
    }
  },
};
const KEYS = Array.from({ length: 32 }, (_, i) => 'k' + i);

// ------------------------------------------------------------------ ground zones (fx.play('zone_<kind>', { pos, r, dur }))
function zone(kind, decalKind, col, emit) {
  return {
    name: 'zone_' + kind, fade: 0.5, group: 'Zones',
    init(T) { const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 3); T.v.R = c.R; T.v.col = tc(c.tint, col, 1.3); T.dur = T.p.dur ?? 4; T.v.dec = fx.decal({ pos: vec(c.x, c.y, c.z), radius: c.R, kind: decalKind, dur: Infinity, color: T.v.col, fadeIn: 0.3, hot: 0.4 }); groundPulse(fx, c.x, c.y, c.z, c.R, T.v.col, 0.8); },
    moved(T) { T.v.dec.setPos(T.pos); },
    tick(T) { const fx = T.fx, v = T.v, p = T.pos, gy = fx.gy(p.x, p.z, p.y); emit(fx, T, v, p.x, gy, p.z, v.R); },
    stop(T) { T.v.dec.stop(); }, end(T) { T.v.dec.stop(); },
  };
}
const inDisc = (fx, R0) => { const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * R0; _a.set(Math.cos(a) * r, 0, Math.sin(a) * r); return _a; };
K.zone_fire = zone('fire', 'lava', 0xff6a1e, (fx, T, v, x, y, z, R0) => { let n = T.rate('f', R0 * R0 * 2.2); for (let i = 0; i < n; i++) { const d = inDisc(fx, R0 * 0.85); fx.spawn(FIRE.lick, x + d.x, y + 0.1, z + d.z, 0, fx.r(0.4, 1), 0, fx.o(1, null)); } n = T.rate('e', R0 * R0); for (let i = 0; i < n; i++) { const d = inDisc(fx, R0); fx.spawn(FIRE.emberFloat, x + d.x, y + 0.2, z + d.z, 0, fx.r(1, 2), 0, fx.o(1, null)); } });
K.zone_lightning = zone('lightning', 'electric', 0x7fb0ff, (fx, T, v, x, y, z, R0) => { if (T.rate('b', R0 * 1.2)) { const d = inDisc(fx, R0); fx.lightning({ from: vec(x + d.x, y + 5, z + d.z), to: vec(x + d.x * 0.8, y + 0.05, z + d.z * 0.8), color: v.col, width: 0.3, dur: 0.15, strands: 2 }); } const n = T.rate('s', R0 * R0 * 2); for (let i = 0; i < n; i++) { const d = inDisc(fx, R0); fx.spawn(STORM.spark, x + d.x, y + 0.1, z + d.z, fx.r(-2, 2), fx.r(2, 5), fx.r(-2, 2), fx.o(1, null)); } if (T.rate('k', R0)) { const d = inDisc(fx, R0); fx.spawn(STORM.bolt, x + d.x, y + 0.4, z + d.z, 0, 0, 0, fx.o(0.8, null)); } });
K.zone_holy = zone('holy', 'holy', 0xffd07a, (fx, T, v, x, y, z, R0) => { const n = T.rate('m', R0 * R0 * 1.5); for (let i = 0; i < n; i++) { const d = inDisc(fx, R0); fx.spawn(HOLY.mote, x + d.x, y + 0.1, z + d.z, 0, fx.r(0.6, 1.4), 0, fx.o(1, v.col)); } if (T.rate('r', R0 * 0.3)) { const d = inDisc(fx, R0 * 0.9); fx.spawn(HOLY.pillar, x + d.x, y, z + d.z, 0, 0, 0, fx.o(0.5, v.col)); } });
K.zone_heal = zone('heal', 'nature', 0x7aff9a, (fx, T, v, x, y, z, R0) => { let n = T.rate('m', R0 * R0 * 1.2); for (let i = 0; i < n; i++) { const d = inDisc(fx, R0); fx.spawn(HEAL.mote, x + d.x, y + 0.1, z + d.z, 0, fx.r(0.8, 1.6), 0, fx.o(1, v.col)); } n = T.rate('p', R0 * 0.5); for (let i = 0; i < n; i++) { const d = inDisc(fx, R0 * 0.8); fx.spawn(HEAL.plus, x + d.x, y + 0.3, z + d.z, 0, 0.8, 0, fx.o(1, null)); } });
K.zone_frost = zone('frost', 'ice', 0x8fd8ff, (fx, T, v, x, y, z, R0) => { let n = T.rate('m', R0 * R0 * 0.35); for (let i = 0; i < n; i++) { const d = inDisc(fx, R0 * 0.85); fx.spawn(FROST.mist, x + d.x, y + 0.3, z + d.z, fx.r(-0.2, 0.2), 0.05, fx.r(-0.2, 0.2), fx.o(1, null)); } n = T.rate('s', R0 * R0 * 0.8); for (let i = 0; i < n; i++) { const d = inDisc(fx, R0 * 0.9); fx.spawn(FROST.sparkle, x + d.x, y + fx.r(0.1, 0.6), z + d.z, 0, 0.1, 0, fx.o(1, null)); } });
K.zone_ice = K.zone_frost;
K.zone_poison = zone('poison', 'poison', 0x8ae83a, (fx, T, v, x, y, z, R0) => { let n = T.rate('b', R0 * R0 * 1.2); for (let i = 0; i < n; i++) { const d = inDisc(fx, R0 * 0.85); fx.spawn(POI.bubble, x + d.x, y + 0.08, z + d.z, 0, fx.r(0.1, 0.4), 0, fx.o(1, null)); } n = T.rate('m', R0 * R0 * 0.35); for (let i = 0; i < n; i++) { const d = inDisc(fx, R0 * 0.85); fx.spawn(POI.mist, x + d.x, y + 0.4, z + d.z, 0, fx.r(0.2, 0.5), 0, fx.o(1, null)); } });
K.zone_dark = zone('dark', 'void', 0x8a3cff, (fx, T, v, x, y, z, R0) => { let n = T.rate('m', R0 * R0 * 1.4); for (let i = 0; i < n; i++) fx.spawn(DARK.ember, x, y + 0.15, z, 0, 0, 0, fx.o(1, null)); n = T.rate('w', R0 * R0 * 0.4); for (let i = 0; i < n; i++) { const d = inDisc(fx, R0 * 0.7); fx.spawn(DARK.wisp, x + d.x, y + 0.3, z + d.z, 0, fx.r(0.3, 0.8), 0, fx.o(1, null)); } });
K.zone_void = K.zone_dark;
K.zone_music = zone('music', 'music', 0xff8ad8, (fx, T, v, x, y, z, R0) => { const n = T.rate('n', R0 * 2); for (let i = 0; i < n; i++) { const d = inDisc(fx, R0); fx.spawn(MUSIC.note, x + d.x, y + 0.2, z + d.z, 0, fx.r(0.5, 1.2), 0, fx.o(0.8, v.col)); } });
K.zone_generic = zone('generic', 'rune', 0xffb060, (fx, T, v, x, y, z, R0) => { const n = T.rate('m', R0 * R0); for (let i = 0; i < n; i++) { const d = inDisc(fx, R0); fx.spawn(GEN.mote, x + d.x, y + 0.1, z + d.z, 0, fx.r(0.5, 1.2), 0, fx.o(1, v.col)); } });
K.zone_water = zone('water', 'water', 0x4ab8ff, (fx, T, v, x, y, z, R0) => { if (T.rate('r', R0)) { const d = inDisc(fx, R0 * 0.9); fx.spawn(WATER.ring, x + d.x, y + 0.04, z + d.z, 0, 0, 0, fx.o(0.4, null)); } });

for (const k in K) K[k].group = K[k].group || 'Utility';
for (const k of ['torch', 'brazier', 'campfire', 'fountain', 'forge_sparks']) K[k].group = 'Ambient';
export const AMBIENT = K;
export { KEYS };
