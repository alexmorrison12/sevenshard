// Shade presets — Bladedancer (twin blades: afterimages, surges, blade storms) and Demonbound (glaive, blood, demonform).
import * as THREE from 'three';
import { ctx, tc, vec, groundSmash, along, GEN, PHYS, DARK, CRIM, TAU, UP, hue, shockwave, decal, hit, slash, S, R, P, v3 } from './lib.js';

const K = {};
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const BLADE = 0xb07aff, DEMON = 0xd0204a;
const AFTER = P({ sprite: S.silhouette, ramp: R.wFade, life: 0.45, size: 2.1, end: 1.05, rot: 0, i: 1.4, noGround: true });
const BLADE_SPR = P({ sprite: S.slashmark, ramp: R.wFlash, life: [0.12, 0.2], size: [1.4, 2.2], end: 1.3, i: [2.6, 3.6], noGround: true });
const ORBIT_BLADE = P({ sprite: S.blade, ramp: R.wInOut, life: [0.5, 0.8], size: [0.5, 0.7], motion: 'orbit', rise: 0.4, rgrow: 0.3, spin: 14, randSpin: true, i: [2, 3] });
const BLOOD_SPIKE_C = [0.32, 0.02, 0.04], BLOOD_GLOW = [1.6, 0.08, 0.1];
const SKULL = P({ sprite: S.skull, ramp: R.wInOut, life: [0.8, 1.1], size: [0.7, 1.0], end: 1.5, ease: 2, rot: [-0.2, 0.2], drag: 1.5, accY: 0.8, i: 1.5 });
const WING = P({ sprite: S.wing, ramp: R.wInOut, life: 0.9, size: 3.6, end: 1.35, ease: 2, rot: 0, i: 1.8, noGround: true });
const DSMOKE = P({ pool: 'alpha', sprite: [S.smoke1, S.smoke2, S.smoke3], ramp: R.void, life: [0.7, 1.1], size: [0.6, 0.9], end: [2.2, 3], ease: 2, spin: [-1, 1], drag: 2.5, accY: 1.2, turb: 0.2 });

// ------------------------------------------------------------------ Bladedancer
K.blade_storm = {                    // Maelstrom / blade storm: a storm of flashing cuts over an area
  name: 'blade_storm', fade: 0.2, group: 'Bladedancer',
  init(T) {
    const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 3.5, 8, 5);
    T.v.col = tc(c.tint, BLADE, 2.2);
    if (T.p.target && !T.attach && !T.follow) T.pos.set(c.tx, c.ty, c.tz);
    T.dur = T.p.dur ?? 1.6;
    shockwave(fx, { pos: T.pos, radius: c.R * 1.2, color: T.v.col, dur: 0.4, dust: false });
  },
  tick(T) {
    const fx = T.fx, v = T.v, c = v.c, p = T.pos, gy = fx.gy(p.x, p.z, p.y);
    if (T.stopping) return;
    const n = T.rate('s', 16);
    for (let i = 0; i < n; i++) {
      const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * c.R * 0.8;
      _a.set(p.x + Math.cos(a) * r, gy, p.z + Math.sin(a) * r); _b.set(Math.cos(fx.r(0, TAU)), 0, Math.sin(fx.r(0, TAU)));
      slash(fx, { pos: _a, dir: _b, radius: fx.r(1.2, 2.1) * c.s, style: 'd', tilt: fx.r(-1.3, 1.3), color: v.col, intensity: 1, dur: 0.18, sweep: 0.35, height: fx.r(0.6, 1.6), sparks: false, glow: false, width: 0.45 * c.s });
    }
    const m = T.rate('b', 50);
    const o = fx.o(c.s, hue(v.col, [0, 0, 0]));
    for (let i = 0; i < m; i++) { o.rot = fx.r(0, TAU); fx.spawn(BLADE_SPR, p.x + fx.r(-1, 1) * c.R * 0.8, gy + fx.r(0.4, 2), p.z + fx.r(-1, 1) * c.R * 0.8, 0, 0, 0, o); }
    const q = T.rate('o', 30);
    for (let i = 0; i < q; i++) fx.spawn(ORBIT_BLADE, p.x, gy + fx.r(0.3, 1.8), p.z, fx.r(0.5, c.R), fx.r(0, TAU), fx.r(5, 9) * (Math.random() < 0.5 ? -1 : 1), fx.o(c.s, hue(v.col, [0, 0, 0])));
    if (T.rate('d', 20)) fx.spawn(PHYS.dust, p.x + fx.r(-1, 1) * c.R, gy + 0.2, p.z + fx.r(-1, 1) * c.R, 0, 0.5, 0, fx.o(c.s, null));
  },
};
K.maelstrom = K.blade_storm;
K.blade_dance = K.blade_storm;
K.blade_dash = (fx, p) => {          // dash with afterimages + a bright cut along the path
  const c = ctx(fx, p, null, 1, 7, 7), s = c.s, col = tc(c.tint, BLADE, 1.8);
  const to = vec(c.tx, c.ty, c.tz), L = Math.hypot(to.x - c.x, to.z - c.z) || c.L;
  const fdir = vec(to.x - c.x, 0, to.z - c.z).normalize();
  // afterimages: mirrored when the dash goes screen-left
  const camR = fx.camera ? _a.set(1, 0, 0).applyQuaternion(fx.camera.quaternion) : _a.set(1, 0, 0);
  const mirror = fdir.dot(camR) < 0;
  const o = fx.o(s, hue(col, [0, 0, 0])); o.mirror = mirror;
  for (let i = 0; i < 6; i++) { const u = i / 5; o.dt = u * 0.12; o.alpha = 0.35 + u * 0.5; fx.spawn(AFTER, c.x + fdir.x * L * u, c.y + 1.05 * s, c.z + fdir.z * L * u, 0, 0, 0, o); }
  slash(fx, { pos: vec(c.x, c.y, c.z), dir: fdir, style: 'thrust', radius: 1, length: L, width: 0.5 * s, color: col, intensity: 1, dur: 0.3, height: 1.0 });
  const od = fx.o(s, null);
  along(c.x, c.z, fdir, L, fx.n(8), (x, z, u) => { od.dt = u * 0.12; fx.spawn(PHYS.dust, x, c.y + 0.2, z, fdir.x * 2, 0.5, fdir.z * 2, od); });
  const end = vec(to.x, c.y, to.z);
  slash(fx, { pos: end, dir: fdir, style: 'x', radius: 2.2 * s, color: col, intensity: 1, delay: 0.12 });
};
K.blitz_rush = K.blade_dash;
K.shadow_step = (fx, p) => {         // vanish in dark smoke, reappear behind the target
  const c = ctx(fx, p, null, 1, 5, 5), s = c.s, col = tc(c.tint, BLADE, 1.2);
  for (const q of [vec(c.x, c.y, c.z), vec(c.tx, c.ty, c.tz)]) {
    fx.radial(DSMOKE, 12, q, 0.8, 2, 0.4, 1.2, s, null, 0.3, 0.6);
    fx.at(DARK.flash, q, 1.4 * s, col, null, 0, 1, 0);
    fx.sphere(DARK.spark, 16, vec(q.x, q.y + 1, q.z), 2, 6, s, null);
  }
};
K.surge_dash = {                     // Surge: dash-through leaves a blade line that detonates in sequence
  name: 'surge_dash', fade: 0.1, group: 'Bladedancer',
  init(T) {
    const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 2, 9, 9), col = tc(c.tint, BLADE, 2.2);
    T.v.col = col; T.v.L = Math.hypot(c.tx - c.x, c.tz - c.z) || c.L; T.v.f = vec(c.tx - c.x, 0, c.tz - c.z).normalize();
    T.v.orbs = T.p.orbs ?? 3;
    slash(fx, { pos: vec(c.x, c.y, c.z), dir: T.v.f, style: 'thrust', radius: 1, length: T.v.L, width: 0.28 * c.s, color: [2.4, 2.4, 2.8], intensity: 1, dur: 0.5, height: 1.0, glow: true });
    fx.sphere(GEN.sparkLong, 20, vec(c.tx, c.ty + 1, c.tz), 4, 10, c.s, hue(col, [0, 0, 0]), T.v.f, 0.6);
    T.dur = 0.9;
  },
  tick(T) {
    const fx = T.fx, v = T.v, c = v.c, n = 3 + v.orbs;
    for (let i = 0; i < n; i++) if (T.once('x' + i, 0.3 + i * 0.05)) {
      const u = (i + 0.5) / n, x = c.x + v.f.x * v.L * u, z = c.z + v.f.z * v.L * u;
      slash(fx, { pos: vec(x, c.y, z), dir: v.f, style: i % 2 ? 'x' : 'd', tilt: 0.8, radius: fx.r(1.6, 2.2) * c.s, color: v.col, intensity: 1, dur: 0.24, glow: true, sparkCount: 6 });
      fx.at(GEN.starFlash, vec(x, c.y + 1, z), 1.3 * c.s, hue(v.col, [0, 0, 0]));
    }
    if (T.once('end', 0.3 + n * 0.05)) { shockwave(fx, { pos: vec(c.x + v.f.x * v.L, c.y, c.z + v.f.z * v.L), radius: 3.5 * c.s, color: v.col, dur: 0.35 }); fx.shake(0.3, T.pos); }
  },
};
K.surge = K.surge_dash;
K.void_strike = (fx, p) => {         // dark implosion then an exploding X
  const c = ctx(fx, p, null, 3, 3, 2.5), s = c.s, col = tc(c.tint, BLADE, 2);
  const g = vec(c.x + c.f.x * 2, c.y, c.z + c.f.z * 2), up = vec(g.x, g.y + 1.1, g.z);
  for (let i = 0; i < fx.n(40); i++) fx.spawn(GEN.converge, g.x, g.y + fx.r(0.3, 2), g.z, fx.r(1.5, 2.8) * s, fx.r(0, TAU), fx.r(3, 6), fx.o(s, hue(col, [0, 0, 0])));
  fx.at(DARK.orb, up, 1.4 * s, null);
  slash(fx, { pos: g, dir: c.f, style: 'x', radius: c.R, color: col, intensity: 1, delay: 0.25, dur: 0.3 });
  shockwave(fx, { pos: g, radius: c.R * 1.4, color: col, dur: 0.4, delay: 0.3 });
  fx.at(DARK.flash, up, 2.4 * s, col, { dt: 0.28 });
};
K.spincutter = (fx, p) => { const c = ctx(fx, p, null, 2.8), col = tc(c.tint, BLADE, 2); slash(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, style: 'spin', radius: c.R, color: col, intensity: 1, dur: 0.4 }); slash(fx, { pos: vec(c.x, c.y, c.z), dir: c.rt, style: 'spin', radius: c.R * 0.85, color: col, intensity: 1, dur: 0.4, delay: 0.15, flip: true, height: 1.3 }); };
K.moonlight_sonic = (fx, p) => { const c = ctx(fx, p, null, 2.5, 7), col = tc(c.tint, 0xbfe0ff, 2.2); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; fx.projectile({ from: vec(c.x, c.y + 1.0, c.z), dir: vec(Math.sin(a), 0, Math.cos(a)), kind: 'crescent', color: col, range: c.L, speed: 20, scale: 0.8 * c.s }); } slash(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, style: 'spin', radius: 2.2 * c.s, color: col, intensity: 1 }); };
K.dark_order = (fx, p) => {          // thrown blades fly out and return
  const c = ctx(fx, p, null, 1, 7, 7);
  for (let i = 0; i < 3; i++) {
    const a = (i - 1) * 0.35, d = vec(c.f.x * Math.cos(a) - c.f.z * Math.sin(a), 0, c.f.z * Math.cos(a) + c.f.x * Math.sin(a));
    const from = vec(c.x + d.x * 0.6, c.y + 1.1, c.z + d.z * 0.6), out = vec(c.x + d.x * c.L, c.y + 1.1, c.z + d.z * c.L);
    fx.projectile({ from, to: out, kind: 'glaive', color: tc(c.tint, BLADE, 2), scale: 0.6 * c.s, speed: 26, impact: true, onHit: pos => fx.projectile({ from: pos, to: from, kind: 'glaive', color: tc(c.tint, BLADE, 2), scale: 0.6 * c.s, speed: 26, impact: false }) });
  }
};

// ------------------------------------------------------------------ Demonbound
K.demon_transform = (fx, p) => {     // Demonform: eruption of dark fire, wings unfold, sigil burns
  const c = ctx(fx, p, null, 5), s = c.s, col = tc(c.tint, DEMON, 1.4), pos = vec(c.x, c.y, c.z), up = vec(c.x, c.y + 1.4, c.z);
  fx.at(GEN.bigFlash, up, 0.8 * s, [0.9, 0.15, 0.4]);
  fx.at(GEN.rays, up, 1.8 * s, col);
  for (const m of [false, true]) { const o = fx.o(s, [0.9, 0.2, 0.5]); o.mirror = m; o.dt = 0.05; const side = m ? -1 : 1; fx.spawn(WING, c.x + c.rt.x * 1.3 * side * s, c.y + 2.2 * s, c.z + c.rt.z * 1.3 * side * s, c.rt.x * side * 0.6, 1.2, c.rt.z * side * 0.6, o); }
  shockwave(fx, { pos, radius: c.R * 1.4, color: [col[0] * 1.6, col[1] * 1.6, col[2] * 1.6], dur: 0.55, height: 2.6 * s });
  decal(fx, { pos, radius: c.R * 0.7, kind: 'demon', dur: 3, color: [col[0] * 1.5, col[1] * 1.5, col[2] * 1.5], hot: 0.8 });
  fx.sphere(DARK.flame, 50, vec(c.x, c.y + 0.5, c.z), 2, 7, s, null, UP, 1.0);
  fx.sphere(DARK.ember, 70, up, 3, 10, s, null);
  fx.radial(DSMOKE, 20, pos, 2, 5, 0.5, 2, s, null, 0.5, 0.4);
  fx.meshes.spikeRings(c.x, c.y, c.z, [[c.R * 0.45, 9, 0.9], [c.R * 0.75, 13, 0.7]], 1, { color: BLOOD_SPIKE_C, glow: BLOOD_GLOW, fres: 0.5, life: [1.2, 1.6] });
  const att = p.attach ?? p.follow ?? p.unit;
  if (att?.isObject3D) fx.aura({ attach: att, kind: 'demon', dur: p.dur ?? 3, scale: s });
  fx.flash(0.18, [0.8, 0.1, 0.3]); fx.shake(0.55, pos); fx.radialBlur(0.4, up);
};
K.demonform = K.demon_transform;
K.dark_slash = (fx, p) => {          // black crescent with a burning red edge
  const c = ctx(fx, p, null, 3.4), s = c.s, col = tc(c.tint, DEMON, 2.6), pos = vec(c.x, c.y, c.z);
  slash(fx, { pos, dir: c.f, radius: c.R, style: p.style ?? 'd', tilt: p.tilt ?? 0.35, color: col, intensity: 1, dark: true, width: c.R * 0.5, dur: 0.4, flip: p.flip });
  slash(fx, { pos, dir: c.f, radius: c.R * 1.02, style: p.style ?? 'd', tilt: p.tilt ?? 0.35, color: col, intensity: 1, width: c.R * 0.12, dur: 0.3, glow: false, sparks: false, flip: p.flip });
  const o = fx.o(s, null);
  for (let i = 0; i < fx.n(14); i++) { const a = (i / 13 - 0.5) * 2.4, r = c.R * 0.9; o.dt = 0.02 + i / 13 * 0.1; fx.spawn(DSMOKE, c.x + (c.f.x * Math.cos(a) + c.rt.x * Math.sin(a)) * r, c.y + 1.1, c.z + (c.f.z * Math.cos(a) + c.rt.z * Math.sin(a)) * r, 0, 0.6, 0, o); }
};
K.demonic_slash = K.dark_slash;
K.abyss_claw = (fx, p) => { const c = ctx(fx, p, null, 3); slash(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, style: 'claw', radius: c.R, color: tc(c.tint, DEMON, 2.4), intensity: 1 }); decal(fx, { pos: vec(c.x + c.f.x * 2, c.y, c.z + c.f.z * 2), dir: c.f, radius: 1.8 * c.s, kind: 'claw', dur: 3, color: tc(c.tint, DEMON, 1.5) }); };
K.rending_talons = K.abyss_claw;
K.claw_swipe = K.abyss_claw;
K.blood_pillars = {                  // pillars of blood erupt around the target point in sequence
  name: 'blood_pillars', fade: 0.1, group: 'Demonbound',
  init(T) {
    const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 3.5, 8, 6);
    T.v.cx = T.p.target ? c.tx : c.x; T.v.cz = T.p.target ? c.tz : c.z; T.v.cy = fx.gy(T.v.cx, T.v.cz, c.y);
    T.v.n = T.p.count ?? 5; T.dur = 0.2 + T.v.n * 0.1;
    fx.telegraph({ shape: 'circle', pos: vec(T.v.cx, T.v.cy, T.v.cz), radius: c.R, color: T.p.color ? T.p.color : [0.9, 0.05, 0.1], dur: 0.2, detonate: false, intensity: 0.8 });
  },
  tick(T) {
    const fx = T.fx, v = T.v, c = v.c;
    for (let i = 0; i < v.n; i++) if (T.once('p' + i, 0.12 + i * 0.09)) {
      const a = i / v.n * TAU + 0.4, r = i === 0 ? 0 : c.R * 0.6;
      const x = v.cx + Math.cos(a) * r, z = v.cz + Math.sin(a) * r, y = v.cy, s = c.s * (i === 0 ? 1.3 : 1);
      fx.meshes.pillars.spawn(x, y, z, 0.7 * s, 5.5 * s, 0.9, 2, [2.2, 0.08, 0.12], 0.05);
      fx.meshes.spikeRings(x, y, z, [[0.3, 5, 1.6], [0.8, 7, 1.1]], s, { color: BLOOD_SPIKE_C, glow: BLOOD_GLOW, fres: 0.6, life: [0.9, 1.2], speed: 30 });
      fx.sphere(PHYS.blood, 26, vec(x, y + 1.5, z), 3, 8, s, null, UP, 0.8);
      fx.sphere(CRIM.spark, 20, vec(x, y + 1, z), 4, 10, s, null, UP, 1.0);
      fx.at(CRIM.flash, vec(x, y + 1, z), 1.8 * s, null);
      decal(fx, { pos: vec(x, y, z), radius: 1.5 * s, kind: 'blood', dur: 8 });
      shockwave(fx, { pos: vec(x, y, z), radius: 2.2 * s, color: [1.8, 0.1, 0.15], dur: 0.3, wall: false, dustCount: 5 });
      fx.shake(0.12, T.pos);
    }
  },
};
K.demolition = (fx, p) => {          // a line of earth spikes bursting forward
  const c = ctx(fx, p, null, 2, 9), s = c.s, col = tc(c.tint, DEMON, 1.4);
  fx.meshes.spikeLine(c.x + c.f.x, c.y, c.z + c.f.z, c.f.x, c.f.z, c.L, Math.round(c.L * 1.6), 1.1 * s, { color: [0.26, 0.2, 0.19], glow: [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8], fres: 0.2, speed: 20, life: 1.4, spread: 0.6 });
  decal(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, radius: 1.3 * s, length: c.L + 1, kind: 'fissure', dur: 4, color: col });
  const o = fx.o(s, null);
  along(c.x, c.z, c.f, c.L, fx.n(12), (x, z, u) => { o.dt = u * c.L / 20; fx.spawn(PHYS.dust, x, c.y + 0.3, z, fx.r(-1, 1), 1, fx.r(-1, 1), o); fx.spawn(PHYS.rockBit, x, c.y + 0.3, z, fx.r(-2, 2), fx.r(4, 7), fx.r(-2, 2), o); });
  fx.shake(0.3, vec(c.x, c.y, c.z));
};
K.fear_howl = (fx, p) => {           // Howl: a wave of dread — dark ring, screaming skulls
  const c = ctx(fx, p, null, 7), s = c.R / 7, col = tc(c.tint, 0x8a3cff, 1.4), pos = vec(c.x, c.y, c.z), up = vec(c.x, c.y + 1.6, c.z);
  fx.at(DARK.flash, up, 3 * s, null);
  shockwave(fx, { pos, radius: c.R, color: col, dur: 0.6, height: 2.2 * s });
  shockwave(fx, { pos, radius: c.R * 0.7, color: [0.8, 0.1, 0.3], dur: 0.5, wall: false, dust: false, delay: 0.1 });
  const o = fx.o(s, [0.7, 0.3, 1]);
  for (let i = 0; i < fx.n(10); i++) { const a = i / 10 * TAU; o.dt = fx.r(0, 0.15); fx.spawn(SKULL, c.x + Math.cos(a) * 1.2, c.y + fx.r(1, 2.2), c.z + Math.sin(a) * 1.2, Math.cos(a) * 5, fx.r(0.5, 1.5), Math.sin(a) * 5, o); }
  fx.radial(DSMOKE, 18, pos, 4, 8, 0.3, 1, s, null, 0.8, 0.4);
  fx.radialBlur(0.35, up); fx.shake(0.35, pos);
};
K.howl = K.fear_howl;
K.cruel_cutter = (fx, p) => { const c = ctx(fx, p, null, 1, 12, 12); return fx.projectile({ from: vec(c.x + c.f.x * 0.6, c.y + 1.1, c.z + c.f.z * 0.6), dir: c.f, kind: 'glaive', color: tc(c.tint, DEMON, 2), range: c.L, speed: 22, scale: c.s }); };
K.hellfire_wings = (fx, p) => {      // demon wings beat: a cone of dark fire forward
  const c = ctx(fx, p, null, 6, 7), s = c.s, up = vec(c.x, c.y + 1.4, c.z);
  for (const m of [false, true]) { const o = fx.o(s, [0.9, 0.2, 0.4]); o.mirror = m; const side = m ? -1 : 1; fx.spawn(WING, c.x + c.rt.x * 1.4 * side, c.y + 2, c.z + c.rt.z * 1.4 * side, c.f.x * 2, 0.5, c.f.z * 2, o); }
  const o = fx.o(s, null);
  for (let i = 0; i < fx.n(50); i++) { fx.rdir(_a, c.f, 0.5); const v = fx.r(6, 13); fx.spawn(DARK.flame, up.x, up.y, up.z, _a.x * v, _a.y * v * 0.3, _a.z * v, o); }
  fx.telegraph({ shape: 'cone', pos: vec(c.x, c.y, c.z), dir: c.f, radius: c.L, angle: 1.3, color: [0.8, 0.05, 0.25], dur: 0.15, detonate: true, intensity: 0.7 });
};
K.demonic_slam = (fx, p) => { const c = ctx(fx, p, null, 4); groundSmash(fx, c.x, c.y, c.z, c.R, tc(c.tint, DEMON, 1.4), { decal: 'crater', shake: 0.6 }); decal(fx, { pos: vec(c.x, c.y, c.z), radius: c.R * 0.8, kind: 'demon', dur: 3, color: tc(c.tint, DEMON, 1.6) }); };
K.dark_burst = (fx, p) => { const c = ctx(fx, p, null, 2.5), s = c.R / 2.5, up = vec(c.x, c.y + 1, c.z); fx.at(DARK.flash, up, 2.5 * s, null); fx.sphere(DARK.burst, 20, up, 2, 6, s, null); fx.sphere(DARK.spark, 30, up, 4, 10, s, null); shockwave(fx, { pos: vec(c.x, c.y, c.z), radius: c.R * 1.4, color: tc(c.tint, 0x8a3cff, 1.6), dur: 0.4 }); };

for (const k in K) K[k].group = K[k].group || (/blade|surge|void_strike|spincutter|moonlight|dark_order|shadow|blitz|maelstrom/.test(k) ? 'Bladedancer' : 'Demonbound');
K.dark_burst.group = 'Utility';
export const SHADE = K;
