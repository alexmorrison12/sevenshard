// Fighter presets — Stormfist (gauntlets: chi, lightning, a little fire).
import * as THREE from 'three';
import { ctx, tc, vec, groundSmash, skyBolt, along, risingRing, GEN, PHYS, FIRE, STORM, CHI, TAU, UP, hue, shockwave, decal, hit, slash, S, R, P } from './lib.js';

const K = {};
const LIGHT = 0x7fb0ff, CHIC = 0x7fe0ff, FIREC = 0xff7a1e;
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const PALM = P({ sprite: S.flash, ramp: R.wFlash, life: 0.22, size: 2.6, end: 1.9, ease: 2, i: 2.6, noGround: true });
const PALM_RING = P({ sprite: S.ring, ramp: R.wFade, life: 0.3, size: 0.6, end: 6, ease: 2.2, i: 2.6, noGround: true });
const CONE_SPARK = P({ sprite: S.spark, ramp: R.chi, life: [0.25, 0.45], size: [0.06, 0.1], orient: 'stretch', stretch: 1.4, drag: 3, i: [5, 8] });
const CHI_WISP = P({ sprite: [S.wisp, S.swirl], ramp: R.chi, life: [0.35, 0.6], size: [0.6, 1.0], end: 1.5, spin: [-5, 5], randSpin: true, drag: 3, i: [1.8, 2.6] });
const FIST = P({ sprite: S.star, ramp: R.wFlash, life: 0.12, size: 1.0, end: 1.6, i: 3, noGround: true });

/** forward blast cone of particles from (x,y,z) along f */
function coneBlast(fx, x, y, z, f, pr, n, sp, spread, s, tint) {
  const o = fx.o(s, tint);
  for (let i = 0; i < fx.n(n); i++) {
    fx.rdir(_a, f, spread);
    const v = fx.r(0.5, 1) * sp * s;
    fx.spawn(pr, x, y, z, _a.x * v, _a.y * v * 0.5, _a.z * v, o);
  }
}

K.chi_palm = (fx, p) => {            // open-palm chi blast forward
  const c = ctx(fx, p, null, 2.2, 5), s = c.s, col = tc(c.tint, CHIC, 1.6);
  const hx = c.x + c.f.x * 0.9, hz = c.z + c.f.z * 0.9, hy = c.y + 1.2;
  const h = vec(hx, hy, hz);
  fx.at(PALM, h, s, col);
  fx.at(PALM_RING, h, s, col);
  fx.at(PALM_RING, h, s * 0.7, [1.2, 1.4, 1.5], { dt: 0.05 });
  coneBlast(fx, hx, hy, hz, c.f, CONE_SPARK, 40, 14, 0.45, s, null);
  coneBlast(fx, hx, hy, hz, c.f, CHI_WISP, 14, 7, 0.4, s, null);
  const g = vec(c.x + c.f.x * c.L * 0.5, c.y, c.z + c.f.z * c.L * 0.5);
  shockwave(fx, { pos: g, radius: c.R * 1.2, color: [col[0] * 1.3, col[1] * 1.3, col[2] * 1.3], dur: 0.3, wall: false, dustCount: 8 });
  fx.shake(0.15 * s, h);
};
K.thunder_palm = (fx, p) => {        // Thunder Palm: chi palm + forked lightning down the lane
  const c = ctx(fx, p, null, 2.4, 6.5), s = c.s, col = tc(c.tint, LIGHT, 1.8);
  K.chi_palm(fx, { ...p, color: p.color ?? LIGHT });
  const from = vec(c.x + c.f.x, c.y + 1.2, c.z + c.f.z);
  for (let i = 0; i < 3; i++) {
    const a = (i - 1) * 0.18;
    const d = vec(c.f.x * Math.cos(a) - c.f.z * Math.sin(a), 0, c.f.z * Math.cos(a) + c.f.x * Math.sin(a));
    fx.lightning({ from, to: vec(c.x + d.x * c.L, c.y + 0.4, c.z + d.z * c.L), color: col, width: 0.45 * s, dur: 0.3, strands: 3 });
  }
  decal(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, radius: 0.9 * s, length: c.L, kind: 'fissure', dur: 1.5, color: [0.5, 0.8, 2.2] });
};
K.chi_burst = (fx, p) => {           // chi aura explosion around the caster
  const c = ctx(fx, p, null, 2), s = c.R / 2, col = tc(c.tint, CHIC, 1.5);
  const pos = vec(c.x, c.y, c.z), up = vec(c.x, c.y + 1, c.z);
  fx.at(GEN.flash, up, 2.4 * s, col);
  fx.sphere(CHI_WISP, 18, up, 2, 5, s, null);
  fx.sphere(CONE_SPARK, 36, up, 5, 11, s, null);
  shockwave(fx, { pos, radius: c.R * 2, color: [col[0] * 1.4, col[1] * 1.4, col[2] * 1.4], dur: 0.35, height: 1.6, dustCount: 8 });
  fx.at(GEN.ringThin, pos, 0.3 * s, col, { life: 0.4 }, 0, 0.06, 0);
};
K.lightning_burst = (fx, p) => {     // radial crackle of lightning at a point
  const c = ctx(fx, p, null, 2.4), s = c.R / 2.4, col = tc(c.tint, LIGHT, 1.8);
  const pos = vec(c.x, c.y, c.z), up = vec(c.x, c.y + 1, c.z);
  fx.at(STORM.flash, up, 2.2 * s, null);
  fx.at(GEN.flare, up, 2.4 * s, hue(col, [0, 0, 0]), { rot: 0 });
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU + fx.r(-0.3, 0.3), r = c.R * fx.r(0.7, 1.1);
    fx.lightning({ from: up, to: vec(c.x + Math.cos(a) * r, c.y + fx.r(0.1, 0.8), c.z + Math.sin(a) * r), color: col, width: 0.3 * s, dur: 0.22, strands: 2, impact: false });
  }
  fx.sphere(STORM.spark, 40, up, 4, 11, s, null);
  shockwave(fx, { pos, radius: c.R * 1.4, color: col, dur: 0.3, wall: false, dustCount: 6 });
  decal(fx, { pos, radius: c.R * 0.8, kind: 'electric', dur: 2, color: col });
};
K.lightning_bolt = (fx, p) => {      // a bolt from the sky at pos
  const c = ctx(fx, p, null, 3), s = c.R / 3;
  skyBolt(fx, c.x, c.y, c.z, s, tc(c.tint, LIGHT, 1.6));
};
K.lightning_strike = {               // several sky bolts raining over radius r in quick succession
  name: 'lightning_strike', fade: 0.1, group: 'Stormfist',
  init(T) { const c = ctx(T.fx, T.p, T.v.c = {}, 4); T.v.col = tc(c.tint, LIGHT, 1.7); T.v.n = Math.round(3 + c.R * 0.8); T.v.i = 0; T.dur = 0.5; skyBolt(T.fx, c.x, c.y, c.z, c.R / 3.2, T.v.col, { shake: 0.35 }); decal(T.fx, { pos: vec(c.x, c.y, c.z), radius: c.R, kind: 'electric', dur: 3, color: T.v.col }); },
  tick(T) {
    const v = T.v, c = v.c;
    while (v.i < v.n && T.age > 0.05 + v.i * 0.06) {
      const a = T.fx.r(0, TAU), r = Math.sqrt(Math.random()) * c.R * 0.9;
      skyBolt(T.fx, c.x + Math.cos(a) * r, c.y, c.z + Math.sin(a) * r, 0.6 * c.s, v.col, { decal: false, shake: 0.1 });
      v.i++;
    }
  },
};
K.lightning_pillar = K.lightning_strike;
K.lightning_aura = (fx, p) => fx.aura({ attach: p.follow ?? p.attach ?? p.unit, pos: p.pos, kind: 'shock', color: p.color ?? LIGHT, dur: p.dur ?? 1.4, scale: p.scale ?? 1 });
K.lightning_trail = {                // electric dash streak following the unit (or along len)
  name: 'lightning_trail', fade: 0.05, group: 'Stormfist',
  init(T) {
    const fx = T.fx, p = T.p, c = ctx(fx, p, T.v.c = {}, 1, 4);
    T.v.col = tc(c.tint, LIGHT, 1.8);
    const att = p.attach ?? p.follow ?? p.unit;
    if (att?.isObject3D) { T.attach = att; T.offset = vec(0, 1, 0); T.readPos(T.pos); T.dur = p.dur ?? 0.35; }
    else { T.pos.set(c.x, c.y + 1, c.z); T.v.to = vec(c.x + c.f.x * c.L, c.y + 1, c.z + c.f.z * c.L); T.v.from = T.pos.clone(); T.dur = 0.25; }
    T.v.t = fx.ribbons.trail({ attach: T, color: T.v.col, intensity: 1, width: 0.8 * c.s, life: 0.25, kind: 'energy' });
  },
  tick(T) {
    const fx = T.fx, v = T.v;
    if (v.to) T.pos.lerpVectors(v.from, v.to, Math.min(1, T.age / 0.2));
    const n = T.rate('s', 70);
    for (let i = 0; i < n; i++) { fx.rdir(_a); fx.spawn(STORM.spark, T.pos.x, T.pos.y + fx.r(-0.6, 0.4), T.pos.z, _a.x * 4, _a.y * 4, _a.z * 4, fx.o(1, null)); }
    if (T.rate('b', 18)) fx.spawn(STORM.bolt, T.pos.x, T.pos.y, T.pos.z, 0, 0, 0, fx.o(0.8, null));
  },
  stop(T) { T.v.t.stopped = true; }, end(T) { T.v.t.stopped = true; },
};
K.lightning_dragon = {               // a dragon of lightning spirals up from the point, then crashes down
  name: 'lightning_dragon', fade: 0.2, group: 'Stormfist',
  init(T) {
    const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 3.6);
    T.v.col = tc(c.tint, LIGHT, 2.0); T.v.s = c.R / 3.6;
    T.v.head = vec(c.x, c.y, c.z);
    T.v.trail = fx.ribbons.trail({ attach: T.v.head, color: T.v.col, intensity: 1, width: 1.2 * T.v.s, life: 0.45, kind: 'energy' });
    T.v.trail2 = fx.ribbons.trail({ attach: T.v.head, color: [2.2, 2.4, 2.8], intensity: 1, width: 0.3 * T.v.s, life: 0.5 });
    T.dur = 0.9;
    fx.at(STORM.flash, vec(c.x, c.y + 0.5, c.z), 2 * T.v.s, null);
    shockwave(fx, { pos: vec(c.x, c.y, c.z), radius: c.R * 1.5, color: T.v.col, dur: 0.4, height: 2.2 * T.v.s });
    decal(fx, { pos: vec(c.x, c.y, c.z), radius: c.R, kind: 'electric', dur: 2.5, color: T.v.col });
  },
  tick(T) {
    const fx = T.fx, v = T.v, c = v.c, s = v.s;
    const u = Math.min(1, T.age / 0.75);
    const rise = u < 0.7 ? u / 0.7 : 1 - (u - 0.7) / 0.3 * 0.95;
    const ang = u * TAU * 1.6, rad = c.R * (0.5 + 0.3 * Math.sin(u * 6));
    v.head.set(c.x + Math.cos(ang) * rad, c.y + 0.3 + rise * 7 * s, c.z + Math.sin(ang) * rad);
    const o = fx.o(s, null);
    const n = T.rate('s', 120);
    for (let i = 0; i < n; i++) { fx.rdir(_a); fx.spawn(STORM.spark, v.head.x, v.head.y, v.head.z, _a.x * 5, _a.y * 5, _a.z * 5, o); }
    if (T.rate('b', 30)) fx.spawn(STORM.bolt, v.head.x + fx.r(-0.6, 0.6), v.head.y + fx.r(-0.6, 0.6), v.head.z + fx.r(-0.6, 0.6), 0, 0, 0, fx.o(s * 1.4, null));
    if (T.rate('g', 20)) fx.at(STORM.glow, v.head, s * 2.2, null);
    if (T.once('crash', 0.78)) { skyBolt(fx, c.x, c.y, c.z, 1.3 * s, v.col, { shake: 0.4 }); v.trail.stopped = true; v.trail2.stopped = true; }
  },
  stop(T) { T.v.trail.stopped = true; T.v.trail2.stopped = true; }, end(T) { T.v.trail.stopped = true; T.v.trail2.stopped = true; },
};
K.storm_dragon_upper = K.lightning_dragon;
K.tiger_dash = {                     // Thunder Tiger: electric charge down a lane, claw rakes at the end
  name: 'tiger_dash', fade: 0.1, group: 'Stormfist',
  init(T) {
    const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 2, 9);
    T.v.col = tc(c.tint, LIGHT, 1.9); T.v.W = (c.W ?? 3.4) * c.s;
    T.v.from = vec(c.x, c.y + 1, c.z); T.v.to = vec(c.x + c.f.x * c.L, c.y + 1, c.z + c.f.z * c.L);
    T.pos.copy(T.v.from);
    T.v.t = fx.ribbons.trail({ attach: T, color: T.v.col, intensity: 1, width: T.v.W * 0.6, life: 0.3, kind: 'energy' });
    T.v.t2 = fx.ribbons.trail({ attach: T, color: [2.2, 2.4, 2.8], intensity: 1, width: 0.3, life: 0.35 });
    T.dur = 0.55;
    decal(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, radius: 1.0 * c.s, length: c.L, kind: 'fissure', dur: 2, color: [0.5, 0.8, 2.2] });
  },
  tick(T) {
    const fx = T.fx, v = T.v, c = v.c;
    const u = Math.min(1, T.age / 0.22);
    T.pos.lerpVectors(v.from, v.to, 1 - (1 - u) * (1 - u));
    if (u < 1) {
      const n = T.rate('s', 160);
      for (let i = 0; i < n; i++) { const side = fx.r(-0.5, 0.5) * v.W; fx.spawn(STORM.spark, T.pos.x + c.rt.x * side, T.pos.y + fx.r(-0.8, 0.5), T.pos.z + c.rt.z * side, c.f.x * -3 + fx.r(-2, 2), fx.r(0, 4), c.f.z * -3 + fx.r(-2, 2), fx.o(c.s, null)); }
      if (T.rate('b', 40)) fx.spawn(STORM.bolt, T.pos.x + fx.r(-1, 1), T.pos.y + fx.r(-0.5, 0.5), T.pos.z + fx.r(-1, 1), 0, 0, 0, fx.o(c.s * 1.2, null));
      if (T.rate('d', 30)) fx.spawn(PHYS.dust, T.pos.x, c.y + 0.2, T.pos.z, fx.r(-1, 1), 0.6, fx.r(-1, 1), fx.o(c.s, null));
    }
    if (T.once('claw', 0.24)) {
      v.t.stopped = true; v.t2.stopped = true;
      const g = vec(v.to.x, c.y, v.to.z);
      slash(fx, { pos: g, dir: c.f, radius: 2.4 * c.s, style: 'claw', color: v.col, intensity: 1 });
      K.lightning_burst(fx, { pos: g, r: 2.6 * c.s, color: T.p.color ?? LIGHT });
      decal(fx, { pos: g, dir: c.f, radius: 1.8 * c.s, kind: 'claw', dur: 3, color: v.col });
      fx.shake(0.3, g);
    }
  },
  stop(T) { T.v.t.stopped = true; T.v.t2.stopped = true; }, end(T) { T.v.t.stopped = true; T.v.t2.stopped = true; },
};
K.thunder_tiger = K.tiger_dash;
K.soaring_tiger = K.tiger_dash;
K.flurry_sparks = {                  // rapid punch barrage: many small impacts ahead
  name: 'flurry_sparks', fade: 0.1, group: 'Stormfist',
  init(T) { const c = ctx(T.fx, T.p, T.v.c = {}, 1.6, 2.2); T.v.col = tc(c.tint, CHIC, 1.5); T.dur = T.p.dur ?? 0.7; },
  tick(T) {
    const fx = T.fx, c = T.v.c;
    if (T.stopping) return;
    const n = T.rate('h', 22);
    for (let i = 0; i < n; i++) {
      const fwd = fx.r(0.9, c.L), side = fx.r(-0.7, 0.7) * c.s;
      _a.set(c.x + c.f.x * fwd + c.rt.x * side, c.y + fx.r(0.8, 1.6), c.z + c.f.z * fwd + c.rt.z * side);
      fx.at(FIST, _a, c.s * fx.r(0.6, 1.1), T.v.col, { rot: fx.r(0, 3) });
      fx.sphere(CONE_SPARK, 6, _a, 3, 8, c.s * 0.8, null, c.f, 0.8);
    }
    if (T.rate('w', 10)) fx.at(PALM_RING, vec(c.x + c.f.x * 1.2, c.y + 1.2, c.z + c.f.z * 1.2), c.s * 0.5, T.v.col);
  },
};
K.tempest_barrage = K.flurry_sparks;
K.punch = (fx, p) => { const c = ctx(fx, p); fx.hit({ pos: vec(c.x + c.f.x * 1.2, c.y + 1.2, c.z + c.f.z * 1.2), dir: c.f, element: 'chi', scale: 1.2 * c.s }); fx.at(PALM_RING, vec(c.x + c.f.x * 1.1, c.y + 1.2, c.z + c.f.z * 1.1), c.s * 0.6, tc(c.tint, CHIC, 1.3)); };
K.kick = (fx, p) => { const c = ctx(fx, p); slash(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, radius: 1.8 * c.s, style: 'd', tilt: 1.1, color: tc(c.tint, CHIC, 2), intensity: 1, dur: 0.22 }); };
K.dragon_kick = (fx, p) => {         // rising dragon kick: upward lightning crescent + launch burst
  const c = ctx(fx, p, null, 2.8), s = c.s, col = tc(c.tint, LIGHT, 2.2);
  const pos = vec(c.x, c.y, c.z);
  slash(fx, { pos, dir: c.f, radius: c.R, style: 'up', color: col, intensity: 1, width: c.R * 0.45, dur: 0.34 });
  slash(fx, { pos, dir: c.f, radius: c.R * 0.8, style: 'up', color: [2, 2.2, 2.6], intensity: 1, width: c.R * 0.15, dur: 0.28, glow: false, delay: 0.03, sparks: false });
  const g = vec(c.x + c.f.x * 1.4, c.y, c.z + c.f.z * 1.4);
  fx.lightning({ from: vec(g.x, c.y + 0.1, g.z), to: vec(g.x + c.f.x, c.y + 5 * s, g.z + c.f.z), color: col, width: 0.5 * s, dur: 0.25, impact: false });
  shockwave(fx, { pos: g, radius: 3 * s, color: col, dur: 0.35, height: 1.6 });
  fx.sphere(STORM.spark, 40, vec(g.x, c.y + 1, g.z), 4, 12, s, null, UP, 0.9);
  fx.shake(0.2, g);
};
K.moonflash_kick = K.dragon_kick;
K.lightning_kick = K.dragon_kick;
K.ground_quake = (fx, p) => {        // Ground Quake: fist into the earth, rings of rock
  const c = ctx(fx, p, null, 4.5), col = tc(c.tint, LIGHT, 1.2);
  const g = vec(c.x + c.f.x * 1.2, c.y, c.z + c.f.z * 1.2);
  groundSmash(fx, g.x, g.y, g.z, c.R, col, { decal: 'quake', decalR: 1.6, rocks: 16, shake: 0.55 });
  fx.meshes.spikeRings(g.x, g.y, g.z, [[c.R * 0.5, 8, 0.8], [c.R * 0.85, 12, 0.65]], 1, { color: [0.3, 0.26, 0.22], glow: [col[0] * 0.6, col[1] * 0.6, col[2] * 0.6], fres: 0.15, life: [1.0, 1.4] });
  shockwave(fx, { pos: g, radius: c.R * 2.4, color: col, dur: 0.8, delay: 0.12, wall: false });
};
K.fire_palm = (fx, p) => {           // flame palm: cone of fire forward
  const c = ctx(fx, p, null, 2, 4.2), s = c.s, col = tc(c.tint, FIREC, 1.2);
  const hx = c.x + c.f.x * 0.9, hz = c.z + c.f.z * 0.9, hy = c.y + 1.2;
  fx.at(FIRE.flash, vec(hx, hy, hz), s * 1.6, null);
  fx.at(PALM_RING, vec(hx, hy, hz), s, [1, 0.5, 0.15]);
  coneBlast(fx, hx, hy, hz, c.f, FIRE.burst, 34, c.L * 2.6, 0.35, s * 1.1, null);
  coneBlast(fx, hx, hy, hz, c.f, FIRE.ember, 40, c.L * 4, 0.45, s, null);
  coneBlast(fx, hx, hy, hz, c.f, FIRE.smokeWarm, 8, c.L, 0.4, s, null);
  decal(fx, { pos: vec(c.x + c.f.x * c.L * 0.6, c.y, c.z + c.f.z * c.L * 0.6), radius: 1.6 * s, kind: 'scorch', dur: 5 });
  void col;
};
K.blazing_fist = K.fire_palm;
K.flame_pillar = (fx, p) => {        // a column of fire erupting at pos (r)
  const c = ctx(fx, p, null, 2.6), s = c.R / 2.6;
  const pos = vec(c.x, c.y, c.z);
  fx.at(FIRE.flash, pos, 2.5 * s, null, null, 0, 1, 0);
  fx.meshes.pillars.spawn(c.x, c.y, c.z, c.R * 0.55, 7 * s, 0.9, 3, [2.4, 0.8, 0.2], 0.06);
  const o = fx.o(s, null);
  for (let i = 0; i < fx.n(46); i++) { const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * c.R * 0.6; o.dt = fx.r(0, 0.3); fx.spawn(FIRE.column, c.x + Math.cos(a) * r, c.y + 0.2, c.z + Math.sin(a) * r, Math.cos(a) * 0.6, fx.r(6, 12) * s, Math.sin(a) * 0.6, o); }
  fx.sphere(FIRE.ember, 40, vec(c.x, c.y + 1, c.z), 3, 10, s, null, UP, 0.8);
  shockwave(fx, { pos, radius: c.R * 1.5, color: [2.2, 0.8, 0.25], dur: 0.35, wall: false });
  decal(fx, { pos, radius: c.R, kind: 'lava', dur: p.dur ?? 3, fadeIn: 0.2 });
  fx.shake(0.2 * s, pos);
};

for (const k in K) K[k].group = K[k].group || 'Stormfist';
export const FIGHTER = K;
