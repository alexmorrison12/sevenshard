// Awakenings — screen-filling mega effects (one per class) + the generic awakening activation.
// All are timed tasks: pos = caster feet, dir = facing, target = aim point (defaults ahead), color overrides the palette.
import * as THREE from 'three';
import { KEYS, ctx, tc, vec, groundSmash, skyBolt, along, risingRing, groundPulse, lightPillar, GEN, PHYS, FIRE, HOLY, STORM, DARK, ARC, CRIM, MUSIC, HEAL, TAU, UP, hue, shockwave, decal, hit, explosion, meteorImpact, slash, S, R, P, v3 } from './lib.js';

const K = {};
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const CONV = P({ sprite: S.twinkle, ramp: R.wInOut, life: [0.45, 0.6], size: [0.25, 0.4], end: 0.3, motion: 'orbit', rise: 0.6, rgrow: -6, spin: 3, i: [3, 5] });
const EMB_UP = P({ sprite: S.ember, ramp: R.wInOut, life: [0.8, 1.4], size: [0.07, 0.12], drag: 0.6, accY: 3, turb: 0.4, i: [5, 8] });
const FEATHER = P({ sprite: S.feather, ramp: R.wSolid, life: [2, 3], size: [0.26, 0.4], spin: [-1.5, 1.5], randSpin: true, drag: 1.4, accY: -0.6, turb: 0.8, color: [1.6, 1.45, 1.1], i: 1.1 });
const NOTE_SPIRAL = P({ sprite: [S.note1, S.note2], ramp: R.wInOut, life: [1.4, 1.9], size: [0.4, 0.6], end: 0.8, motion: 'orbit', rise: 2.6, rgrow: 0.6, rot: [-0.3, 0.3], i: [2.2, 3] });
const CUT = P({ sprite: S.slashmark, ramp: R.wFlash, life: [0.1, 0.16], size: [1.8, 3.2], end: 1.4, i: [3, 4.5], noGround: true });
const BIG_RAYS = P({ sprite: S.rays, ramp: R.wFlash, life: 0.9, size: 10, end: 1.6, ease: 2, spin: 0.4, i: 1.8, noGround: true });
const DARK_STREAM = P({ sprite: [S.flame1, S.flame2, S.wisp], ramp: R.demon, life: [0.6, 1.0], size: [0.8, 1.3], end: 0.6, rot: [-0.3, 0.3], drag: 1, accY: 1, turb: 0.3, i: [1.8, 2.6] });

/** caster position (Object3D unit/attach) if it differs from pos, else pos */
function casterPos(fx, p, c, out) { const u = p.unit ?? p.caster ?? p.attach; if (u?.isObject3D) return u.getWorldPosition(out); return out.set(c.x, c.y, c.z); }

// ------------------------------------------------------------------ generic activation
K.awaken_aura = (fx, p) => {
  const c = ctx(fx, p), s = c.s, col = tc(c.tint, 0xffd07a, 1.4), pos = vec(c.x, c.y, c.z), up = vec(c.x, c.y + 1.2, c.z);
  fx.at(GEN.bigFlash, up, 0.45 * s, col);
  fx.at(BIG_RAYS, up, 0.45 * s, col);
  decal(fx, { pos, radius: 3.2 * s, kind: 'arcane', dur: 1.6, color: [col[0] * 1.1, col[1] * 1.1, col[2] * 1.1], hot: 0.5 });
  lightPillar(fx, c.x, c.y, c.z, 0.75 * s, 12 * s, [col[0], col[1], col[2]], 0.9, 3);
  shockwave(fx, { pos, radius: 6 * s, color: [col[0] * 1.5, col[1] * 1.5, col[2] * 1.5], dur: 0.55, height: 2.6 });
  const o = fx.o(s, col);
  for (let i = 0; i < fx.n(50); i++) fx.spawn(CONV, c.x, c.y + fx.r(0.2, 2.2), c.z, fx.r(2.5, 4), fx.r(0, TAU), fx.r(3, 6), o);
  risingRing(fx, c.x, c.y, c.z, 1.4 * s, EMB_UP, 40, col, s, [3, 7]);
  fx.flash(0.12, col); fx.radialBlur(0.5, up); fx.shake(0.25, pos);
};
K.awakening = K.awaken_aura;

// ------------------------------------------------------------------ Reaver — Worldsplitter
K.awk_world_split = {
  name: 'awk_world_split', fade: 0.2, group: 'Awakenings',
  init(T) {
    const fx = T.fx, p = T.p, c = ctx(fx, p, T.v.c = {}, 3, 15, 15);
    const col = T.v.col = tc(c.tint, 0xff2a3a, 1.6);
    const start = casterPos(fx, p, c, _a);
    T.v.o = vec(start.x, fx.gy(start.x, start.z, start.y), start.z);
    // line from the caster toward pos / target
    const tx = p.target ? c.tx : c.x, tz = p.target ? c.tz : c.z;
    let dx = tx - T.v.o.x, dz = tz - T.v.o.z, d = Math.hypot(dx, dz);
    if (d < 1) { dx = c.f.x; dz = c.f.z; d = 1; }
    T.v.f = vec(dx / d, 0, dz / d); T.v.rt = vec(-T.v.f.z, 0, T.v.f.x);
    T.v.L = p.len ?? p.length ?? Math.max(c.L, 12);
    T.dur = 2.2;
    const o = fx.o(c.s, col);
    for (let i = 0; i < fx.n(60); i++) { o.dt = fx.r(0, 0.3); fx.spawn(CONV, T.v.o.x, T.v.o.y + fx.r(0.2, 3), T.v.o.z, fx.r(2.5, 5), fx.r(0, TAU), fx.r(3, 6), o); }
    decal(fx, { pos: T.v.o, radius: 3.5 * c.s, kind: 'demon', dur: 2, color: [col[0] * 0.9, col[1] * 0.9, col[2] * 0.9], hot: 0.3 });
    fx.telegraph({ shape: 'rect', pos: T.v.o, dir: T.v.f, length: T.v.L, width: 3.6 * c.s, color: 'red', dur: 0.4, detonate: false, intensity: 0.7 });
    fx.radialBlur(0.45);
  },
  tick(T) {
    const fx = T.fx, v = T.v, c = v.c, o0 = v.o, s = c.s, col = v.col;
    if (T.once('slash', 0.32)) {
      slash(fx, { pos: o0, dir: v.f, style: 'v', radius: 7 * s, width: 3.2 * s, color: [col[0] * 1.8, col[1] * 1.8, col[2] * 1.8], intensity: 1, dur: 0.5, arc: 2.5, height: 0.5, forward: 1.5 });
      slash(fx, { pos: o0, dir: v.f, style: 'v', radius: 6.2 * s, width: 0.9 * s, color: [2.6, 2.3, 2.1], intensity: 1, dur: 0.38, arc: 2.4, height: 0.5, forward: 1.5, glow: false, sparks: false });
      fx.flash(0.16, col); fx.aberr(0.6); fx.shake(0.5, o0);
    }
    if (T.once('split', 0.42)) {
      decal(fx, { pos: o0, dir: v.f, radius: 2.4 * s, length: v.L, kind: 'fissure', dur: 7, color: [col[0] * 1.3, col[1] * 1.3, col[2] * 1.3], hot: 2.2 });
      fx.meshes.spikeLine(o0.x + v.f.x * 1.5, o0.y, o0.z + v.f.z * 1.5, v.f.x, v.f.z, v.L - 1.5, Math.round(v.L * 2), 1.6 * s, { color: [0.25, 0.2, 0.19], glow: [col[0] * 0.9, col[1] * 0.9, col[2] * 0.9], fres: 0.25, speed: 30, life: 1.8, spread: 1.2 });
    }
    // eruptions race along the fissure
    const n = 10;
    for (let i = 0; i < n; i++) if (T.once(KEYS[i], 0.45 + i * 0.05)) {
      const u = (i + 0.5) / n, x = o0.x + v.f.x * v.L * u, z = o0.z + v.f.z * v.L * u, y = fx.gy(x, z, o0.y);
      fx.meshes.pillars.spawn(x, y, z, 0.8 * s, 6 * s, 0.7, 3, [col[0], col[1], col[2]], 0.05);
      fx.at(GEN.flash, _a.set(x, y + 1, z), 1.6 * s, col);
      fx.meshes.debris(x, y + 0.3, z, 5, s, 7, { gy: y, glow: [col[0] * 1.2, col[1] * 1.2, col[2] * 1.2] });
      fx.sphere(GEN.spark, 16, _a, 4, 12, s, hue(col, [0, 0, 0]), UP, 0.9);
      fx.radial(PHYS.dustBig, 5, _a.set(x, y, z), 2, 5, 0.3, 1.2, s, null, 0.4, 0.3);
      shockwave(fx, { pos: _a, radius: 3 * s, color: col, dur: 0.35, wall: false, dustCount: 4 });
      fx.shake(0.12, _a);
    }
    if (T.once('end', 1.0)) {
      const x = o0.x + v.f.x * v.L, z = o0.z + v.f.z * v.L;
      groundSmash(fx, x, fx.gy(x, z, o0.y), z, 4 * s, col, { decal: 'crater', shake: 0.9, rocks: 18 });
      fx.flash(0.14, col);
    }
  },
};
K.worldsplitter = K.awk_world_split;

// ------------------------------------------------------------------ Oathkeeper — Radiant Judgment (sword from heaven)
K.awk_radiant_sword = {
  name: 'awk_radiant_sword', fade: 0.3, group: 'Awakenings',
  init(T) {
    const fx = T.fx, p = T.p, c = ctx(fx, p, T.v.c = {}, 7, 8, 5);
    const x = p.target ? c.tx : c.x, z = p.target ? c.tz : c.z, y = fx.gy(x, z, c.y);
    T.v.g = vec(x, y, z); T.v.col = tc(c.tint, 0xffd07a, 1.8);
    T.v.sword = { pos: vec(x, y + 26, z), quat: new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(-c.f.x, -c.f.z)), scale: 11 * c.s, alive: true, tint: [2.2, 1.9, 1.2], alpha: 0 };
    fx.meshes.props.add('sword', T.v.sword);
    T.v.dec = fx.decal({ pos: T.v.g, radius: c.R, kind: 'holy', dur: Infinity, color: [T.v.col[0] * 0.75, T.v.col[1] * 0.75, T.v.col[2] * 0.75], hot: 0.2 });
    T.v.tele = fx.telegraph({ shape: 'circle', pos: T.v.g, radius: c.R, color: 'yellow', intensity: 0.45, fill: false });
    T.v.trail = fx.ribbons.trail({ attach: T.v.sword.pos, color: [2.4, 2.1, 1.4], width: 2.6 * c.s, life: 0.35, kind: 'energy' });
    T.dur = 2.6;
    lightPillar(fx, x, y, z, 0.7 * c.s, 24, [0.9, 0.75, 0.4], 0.8, 0);
  },
  tick(T, dt) {
    const fx = T.fx, v = T.v, c = v.c, g = v.g, s = c.s;
    const fall = 0.55;
    if (T.age < fall + 0.02) {
      const u = Math.min(1, T.age / fall), e = u * u;
      v.sword.pos.set(g.x, g.y + 26 - e * (26 - 2.2 * s), g.z);
      v.sword.alpha = Math.min(1, T.age / 0.2) * 1.2;
      const n = T.rate('m', 90);
      for (let i = 0; i < n; i++) fx.spawn(HOLY.star, v.sword.pos.x + fx.r(-1, 1), v.sword.pos.y + fx.r(0, 8) * s, v.sword.pos.z + fx.r(-1, 1), 0, fx.r(1, 3), 0, fx.o(s, v.col));
    }
    if (T.once('impact', fall)) {
      v.trail.stopped = true;
      const up = _a.set(g.x, g.y + 1.5, g.z);
      fx.at(GEN.bigFlash, up, 0.65 * s, [1.2, 1.05, 0.75]);
      fx.at(BIG_RAYS, up, 0.65 * s, v.col);
      shockwave(fx, { pos: g, radius: c.R * 1.6, color: v.col, dur: 0.7, height: 3 * s });
      shockwave(fx, { pos: g, radius: c.R * 1.1, color: [1.6, 1.5, 1.2], dur: 0.5, wall: false, dust: false, delay: 0.06 });
      decal(fx, { pos: g, radius: c.R * 0.9, kind: 'sun', dur: 4, color: [v.col[0] * 0.8, v.col[1] * 0.8, v.col[2] * 0.8] });
      decal(fx, { pos: g, radius: 2.4 * s, kind: 'crater', dur: 7, color: [1.6, 1.3, 0.6] });
      lightPillar(fx, g.x, g.y, g.z, 1.3 * s, 26, [1.4, 1.2, 0.75], 1.2, 0);
      fx.sphere(HOLY.spark, 80, up, 6, 18, s, v.col);
      fx.sphere(FEATHER, 40, _b.set(g.x, g.y + 3, g.z), 2, 6, s, null, UP, 1.3);
      fx.radial(HOLY.mote, 60, g, 3, 9, 0.5, 3, s, v.col, 0.5, 0.2);
      fx.meshes.debris(g.x, g.y + 0.5, g.z, 16, s, 9, { gy: g.y, glow: [2, 1.6, 0.7] });
      fx.flash(0.2, [1.2, 1.05, 0.8]); fx.shake(0.9, g); fx.radialBlur(0.55, up);
      v.tele.stop();
    }
    if (T.age > fall && T.age < 2.2) {
      const n = T.rate('r', 40);
      for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = fx.r(0, c.R); fx.spawn(HOLY.riseSpark, g.x + Math.cos(a) * r, g.y + 0.1, g.z + Math.sin(a) * r, 0, fx.r(2, 5), 0, fx.o(s, v.col)); }
    }
    if (T.age > 1.8) v.sword.alpha = Math.max(0, 1.2 - (T.age - 1.8) / 0.6 * 1.2);
  },
  stop(T) { T.v.dec.stop(); T.v.tele.stop(); },
  end(T) { T.v.sword.alive = false; T.v.trail.stopped = true; T.v.dec.stop(); T.v.tele.stop(); },
};
K.radiant_judgment = K.awk_radiant_sword;

// ------------------------------------------------------------------ Stormfist — Heaven's Fury (heavenly lightning dragon)
K.awk_heavenly_dragon = {
  name: 'awk_heavenly_dragon', fade: 0.2, group: 'Awakenings',
  init(T) {
    const fx = T.fx, p = T.p, c = ctx(fx, p, T.v.c = {}, 6.5, 8, 5);
    const x = p.target ? c.tx : c.x, z = p.target ? c.tz : c.z;
    T.v.g = vec(x, fx.gy(x, z, c.y), z); T.v.col = tc(c.tint, 0x8ab8ff, 2.0);
    T.v.head = vec(x, 30, z);
    T.v.trail = fx.ribbons.trail({ attach: T.v.head, color: [T.v.col[0] * 0.55, T.v.col[1] * 0.55, T.v.col[2] * 0.55], width: 1.8 * c.s, life: 0.6, kind: 'energy' });
    T.v.trail2 = fx.ribbons.trail({ attach: T.v.head, color: [1.3, 1.5, 1.9], width: 0.4 * c.s, life: 0.7 });
    T.v.tele = fx.decal({ pos: T.v.g, radius: c.R, kind: 'electric', dur: 3, color: [0.5, 0.75, 1.8], hot: 0.4 });
    T.dur = 2.2;
  },
  tick(T) {
    const fx = T.fx, v = T.v, c = v.c, g = v.g, s = c.s;
    const dive = 1.1;
    if (T.age < dive) {
      const u = T.age / dive;
      const ang = u * TAU * 2.2, rad = c.R * 1.1 * (1 - u * 0.85);
      v.head.set(g.x + Math.cos(ang) * rad, g.y + 1 + (1 - u) * (1 - u) * 22, g.z + Math.sin(ang) * rad);
      const n = T.rate('s', 150);
      for (let i = 0; i < n; i++) { fx.rdir(_a); fx.spawn(STORM.spark, v.head.x, v.head.y, v.head.z, _a.x * 6, _a.y * 6, _a.z * 6, fx.o(s, null)); }
      if (T.rate('b', 30)) fx.spawn(STORM.bolt, v.head.x + fx.r(-1, 1), v.head.y + fx.r(-1, 1), v.head.z + fx.r(-1, 1), 0, 0, 0, fx.o(s * 2, null));
      if (T.rate('g', 20)) fx.at(STORM.glow, v.head, s * 2.2, null);
      if (T.rate('k', 6)) { const a = fx.r(0, TAU), r = fx.r(c.R * 0.5, c.R * 1.4); skyBolt(fx, g.x + Math.cos(a) * r, g.y, g.z + Math.sin(a) * r, 0.7 * s, v.col, { decal: false, shake: 0.08 }); }
    }
    if (T.once('crash', dive)) {
      v.trail.stopped = true; v.trail2.stopped = true;
      skyBolt(fx, g.x, g.y, g.z, 2.6 * s, v.col, { dur: 0.6, shake: 0.9 });
      fx.at(GEN.bigFlash, _a.set(g.x, g.y + 1.5, g.z), 0.7 * s, [0.8, 0.9, 1.4]);
      fx.at(BIG_RAYS, _a, 0.7 * s, v.col);
      shockwave(fx, { pos: g, radius: c.R * 1.7, color: v.col, dur: 0.7, height: 3 * s });
      shockwave(fx, { pos: g, radius: c.R * 1.2, color: [2, 2.3, 2.8], dur: 0.5, wall: false, dust: false, delay: 0.08 });
      decal(fx, { pos: g, radius: c.R, kind: 'electric', dur: 4, color: v.col, hot: 1.2 });
      decal(fx, { pos: g, radius: c.R * 0.5, kind: 'crater', dur: 7, color: [0.6, 0.8, 2.0] });
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; fx.lightning({ from: _b.set(g.x, g.y + 1, g.z).clone(), to: vec(g.x + Math.cos(a) * c.R, g.y + 0.2, g.z + Math.sin(a) * c.R), color: v.col, width: 0.5 * s, dur: 0.45, strands: 3 }); }
      fx.meshes.debris(g.x, g.y + 0.3, g.z, 16, s, 10, { gy: g.y, glow: [0.8, 1.2, 2.4] });
      fx.flash(0.2, [0.7, 0.8, 1.3]); fx.radialBlur(0.55); fx.aberr(0.8);
    }
    if (T.age > dive && T.age < 2) { if (T.rate('a', 7)) { const a = fx.r(0, TAU), r = fx.r(0, c.R); skyBolt(fx, g.x + Math.cos(a) * r, g.y, g.z + Math.sin(a) * r, 0.6 * s, v.col, { decal: false, shake: 0.06 }); } }
  },
  end(T) { T.v.trail.stopped = true; T.v.trail2.stopped = true; T.v.tele.stop(); },
};
K.heavens_fury = K.awk_heavenly_dragon;

// ------------------------------------------------------------------ Pistoleer — Last Rites (bullet-hell spin)
K.awk_bullet_hell = {
  name: 'awk_bullet_hell', fade: 0.1, group: 'Awakenings',
  init(T) { const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 12); T.v.col = tc(c.tint, 0xffd080, 2.4); T.v.a = 0; T.dur = 1.9; decal(fx, { pos: T.pos, radius: 3 * c.s, kind: 'arcane', dur: 2, color: [2, 1.4, 0.6] }); },
  tick(T, dt) {
    const fx = T.fx, v = T.v, c = v.c, p = T.pos, gy = fx.gy(p.x, p.z, p.y), s = c.s;
    if (T.age < 1.4) {
      v.a += dt * 11;
      const n = T.rate('b', 60);
      for (let i = 0; i < n; i++) {
        const a = v.a + i * 2.4 + fx.r(-0.2, 0.2), d = _a.set(Math.sin(a), 0, Math.cos(a));
        const from = _b.set(p.x + d.x * 0.8, gy + 1.2, p.z + d.z * 0.8);
        const L = c.R * fx.r(0.6, 1);
        fx.beam({ from: from.clone(), to: vec(from.x + d.x * L, gy + fx.r(0.4, 1.4), from.z + d.z * L), kind: 'tracer', color: v.col, width: 0.12 * s, speed: 150, length: 4, dur: 0.2 });
        const o = fx.o(s * 1.3, [1, 0.75, 0.4]); o.rot = fx.r(0, 3);
        fx.spawn(GEN.starFlash, from.x, from.y, from.z, 0, 0, 0, o);
        if (Math.random() < 0.5) { const q = fx.r(0.4, 1) * L; fx.spawn(GEN.spark, p.x + d.x * q, gy + 0.3, p.z + d.z * q, d.x * 3, fx.r(2, 5), d.z * 3, fx.o(s, [1, 0.8, 0.5])); }
      }
      const m = T.rate('sh', 30);
      for (let i = 0; i < m; i++) fx.spawn(PHYS.shell, p.x, gy + 1.2, p.z, fx.r(-3, 3), fx.r(2, 5), fx.r(-3, 3), fx.o(s, null));
      if (T.rate('r', 8)) fx.rings.ground(vec(p.x, gy, p.z), 3 * s, 0.3, v.col, { ew: 0.15, trail: 0.6, r0: 1, flags: 0 });
      if (T.rate('d', 25)) fx.spawn(PHYS.dust, p.x + fx.r(-3, 3), gy + 0.2, p.z + fx.r(-3, 3), 0, 0.5, 0, fx.o(s, null));
    }
    if (T.once('final', 1.45)) {
      shockwave(fx, { pos: vec(p.x, gy, p.z), radius: c.R, color: v.col, dur: 0.6, height: 2.4 });
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; explosionAt(fx, p.x + Math.sin(a) * c.R * 0.55, gy, p.z + Math.cos(a) * c.R * 0.55, 0.9 * s, i * 0.02); }
      fx.flash(0.12, [1, 0.8, 0.5]); fx.shake(0.7, p);
    }
  },
};
function explosionAt(fx, x, y, z, s, delay) { fx.task(DELAY_BOOM, { pos: vec(x, y, z), delay, s }); }
const DELAY_BOOM = { name: 'boomAt', init(T) { T.dur = Math.max(0.001, T.p.delay); }, stop(T) { explosion(T.fx, vec(T.pos.x, T.pos.y + 0.4, T.pos.z), T.p.s, 'fire'); } };
K.last_rites = K.awk_bullet_hell;

// ------------------------------------------------------------------ Starcaller — Stellar Collapse (colossal meteor)
K.awk_stellar_collapse = {
  name: 'awk_stellar_collapse', fade: 0.2, group: 'Awakenings',
  init(T) {
    const fx = T.fx, p = T.p, c = ctx(fx, p, T.v.c = {}, 8, 10, 8);
    const x = p.target ? c.tx : c.x, z = p.target ? c.tz : c.z, y = fx.gy(x, z, c.y);
    T.v.g = vec(x, y, z); T.v.col = c.tint;
    T.v.m = fx.meteor({ target: T.v.g, radius: c.R, delay: 1.5, scale: 2.4 * c.s, telegraph: false, dir: c.f, color: p.color, from: vec(x - c.f.x * 12, y + 26, z - c.f.z * 12) });
    T.v.tele = fx.telegraph({ shape: 'circle', pos: T.v.g, radius: c.R, color: 'orange', dur: 1.5 });
    decal(fx, { pos: T.v.g, radius: c.R * 0.9, kind: 'arcane', dur: 1.8, color: [2, 0.8, 0.3], hot: 0 });
    T.dur = 2.8;
    fx.radialBlur(0.3);
  },
  tick(T) {
    const fx = T.fx, v = T.v, c = v.c, g = v.g;
    if (T.age < 1.5) {
      const n = T.rate('e', 50);
      for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = fx.r(0, c.R); fx.spawn(FIRE.emberFloat, g.x + Math.cos(a) * r, g.y + 0.1, g.z + Math.sin(a) * r, 0, fx.r(1, 4), 0, fx.o(c.s, null)); }
    }
    if (T.once('boom', 1.52)) {
      for (let k = 0; k < 3; k++) shockwave(fx, { pos: g, radius: c.R * (1.8 + k * 0.6), color: [2.4, 1.0, 0.35], dur: 0.7 + k * 0.15, delay: k * 0.1, height: 3.2 - k });
      fx.at(BIG_RAYS, _a.set(g.x, g.y + 2, g.z), 0.8 * c.s, [1, 0.6, 0.3]);
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; explosionAt(fx, g.x + Math.cos(a) * c.R * 0.8, g.y, g.z + Math.sin(a) * c.R * 0.8, 1.3 * c.s, 0.08 + i * 0.03); }
      decal(fx, { pos: g, radius: c.R * 1.3, kind: 'scorch', dur: 12, hot: 2 });
      fx.flash(0.22, [1.2, 0.75, 0.45]); fx.shake(1, g); fx.aberr(1); fx.radialBlur(0.6);
    }
  },
  end(T) { T.v.tele.stop(); },
};
K.stellar_collapse = K.awk_stellar_collapse;

// ------------------------------------------------------------------ Songweaver — Grand Finale (light)
K.awk_grand_finale = {
  name: 'awk_grand_finale', fade: 0.4, group: 'Awakenings',
  init(T) {
    const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 8);
    T.v.col = tc(c.tint, 0xffd88a, 1.6); T.dur = 3;
    T.v.dec = fx.decal({ pos: T.pos, radius: c.R, kind: 'music', dur: Infinity, color: [T.v.col[0] * 0.45, T.v.col[1] * 0.45, T.v.col[2] * 0.45], hot: 0.3 });
    T.v.bub = fx.meshes.bubbles.alloc();
  },
  tick(T) {
    const fx = T.fx, v = T.v, c = v.c, p = T.pos, gy = fx.gy(p.x, p.z, p.y), s = c.s;
    if (T.age < 1.0) {
      const n = T.rate('n', 70);
      const o = fx.o(s, v.col);
      for (let i = 0; i < n; i++) fx.spawn(NOTE_SPIRAL, p.x, gy + 0.2, p.z, fx.r(1, 2.5) * s, fx.r(0, TAU), fx.r(3, 5), o);
      const m = T.rate('c', 50);
      for (let i = 0; i < m; i++) fx.spawn(CONV, p.x, gy + fx.r(0.5, 3), p.z, fx.r(3, 6) * s, fx.r(0, TAU), 4, fx.o(s, v.col));
    }
    if (T.once('burst', 1.0)) {
      const up = _a.set(p.x, gy + 2, p.z);
      fx.at(GEN.bigFlash, up, 0.7 * s, [1.2, 1.05, 0.8]);
      fx.at(BIG_RAYS, up, 0.8 * s, v.col);
      lightPillar(fx, p.x, gy, p.z, 0.7 * s, 30, [1.0, 0.85, 0.55], 0.9, 0);
      shockwave(fx, { pos: vec(p.x, gy, p.z), radius: c.R * 1.4, color: v.col, dur: 0.8, height: 3.2 });
      shockwave(fx, { pos: vec(p.x, gy, p.z), radius: c.R, color: [1.9, 0.9, 1.6], dur: 0.6, wall: false, delay: 0.1 });
      fx.sphere(MUSIC.noteGold, 60, up, 4, 11, s, null);
      fx.sphere(FEATHER, 30, up, 2, 6, s, null);
      fx.radial(HEAL.petal, 50, vec(p.x, gy + 3, p.z), 2, 7, 0, 2, s, null, 0.5);
      fx.flash(0.2, [1.2, 1.1, 0.85]); fx.radialBlur(0.5, up); fx.shake(0.4, p);
    }
    if (T.age > 1.0 && v.bub >= 0) {
      const k = Math.min(1, (T.age - 1) / 0.3) * T.k;
      fx.meshes.bubbles.set(v.bub, p.x, gy, p.z, c.R * 0.8, [v.col[0] * 0.5, v.col[1] * 0.5, v.col[2] * 0.5], k * 0.2, Math.max(0, 1 - (T.age - 1) / 0.5), 1);
      const n = T.rate('m', 60);
      for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * c.R * 0.8; fx.spawn(HOLY.mote, p.x + Math.cos(a) * r, gy + 0.1, p.z + Math.sin(a) * r, 0, fx.r(1, 3), 0, fx.o(s, v.col)); }
    }
  },
  stop(T) { T.v.dec.stop(); },
  end(T) { if (T.v.bub >= 0) T.fx.meshes.bubbles.free(T.v.bub); T.v.dec.stop(); },
};
K.grand_finale = K.awk_grand_finale;

// ------------------------------------------------------------------ Bladedancer — Thousand Cuts
K.awk_thousand_cuts = {
  name: 'awk_thousand_cuts', fade: 0.2, group: 'Awakenings',
  init(T) {
    const fx = T.fx, p = T.p, c = ctx(fx, p, T.v.c = {}, 6, 8, 4);
    const x = p.target ? c.tx : c.x, z = p.target ? c.tz : c.z;
    T.v.g = vec(x, fx.gy(x, z, c.y), z); T.v.col = tc(c.tint, 0xc08aff, 2.4); T.dur = 2.1;
    decal(fx, { pos: T.v.g, radius: c.R, kind: 'arcane', dur: 2.2, color: [0.6, 0.35, 1.1], hot: 0.1 });
    fx.telegraph({ shape: 'circle', pos: T.v.g, radius: c.R, color: 'purple', dur: 0.3, detonate: false, intensity: 0.6 });
  },
  tick(T) {
    const fx = T.fx, v = T.v, c = v.c, g = v.g, s = c.s;
    if (T.age > 0.2 && T.age < 1.5) {
      const n = T.rate('s', 40);
      for (let i = 0; i < n; i++) {
        const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * c.R * 0.85;
        _a.set(g.x + Math.cos(a) * r, g.y, g.z + Math.sin(a) * r); _b.set(Math.cos(fx.r(0, TAU)), 0, Math.sin(fx.r(0, TAU)));
        slash(fx, { pos: _a, dir: _b, radius: fx.r(1.8, 3.4) * s, style: 'd', tilt: fx.r(-1.4, 1.4), color: Math.random() < 0.35 ? [2.2, 2.2, 2.6] : v.col, intensity: 1, dur: 0.2, sweep: 0.3, height: fx.r(0.4, 2.4), sparks: Math.random() < 0.3, sparkCount: 4, glow: false, width: 0.5 * s });
      }
      const m = T.rate('c', 90);
      const o = fx.o(s, v.hue || (v.hue = hue(v.col, [0, 0, 0])));
      for (let i = 0; i < m; i++) { o.rot = fx.r(0, TAU); const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * c.R; fx.spawn(CUT, g.x + Math.cos(a) * r, g.y + fx.r(0.3, 3), g.z + Math.sin(a) * r, 0, 0, 0, o); }
      if (T.rate('k', 10)) fx.shake(0.08, g);
      if (T.rate('f', 12)) fx.at(GEN.starFlash, _a.set(g.x + fx.r(-1, 1) * c.R * 0.7, g.y + fx.r(0.5, 2.5), g.z + fx.r(-1, 1) * c.R * 0.7), 1.6 * s, [0.9, 0.7, 1]);
    }
    if (T.once('final', 1.55)) {
      slash(fx, { pos: g, dir: c.f, style: 'x', radius: c.R * 1.1, width: c.R * 0.4, color: [v.col[0] * 1.3, v.col[1] * 1.3, v.col[2] * 1.3], intensity: 1, dur: 0.45 });
      shockwave(fx, { pos: g, radius: c.R * 1.6, color: v.col, dur: 0.6, height: 2.6, delay: 0.1 });
      fx.at(GEN.bigFlash, _a.set(g.x, g.y + 1.5, g.z), 0.6 * s, [1, 0.8, 1.2], { dt: 0.1 });
      fx.flash(0.15, [0.9, 0.7, 1.1]); fx.shake(0.8, g); fx.aberr(0.6);
    }
  },
};
K.thousand_cuts = K.awk_thousand_cuts;

// ------------------------------------------------------------------ Demonbound — Abyssal Rupture (abyssal gate)
K.awk_abyssal_gate = {
  name: 'awk_abyssal_gate', fade: 0.3, group: 'Awakenings',
  init(T) {
    const fx = T.fx, p = T.p, c = ctx(fx, p, T.v.c = {}, 7, 8, 5);
    const x = p.target ? c.tx : c.x, z = p.target ? c.tz : c.z;
    T.v.g = vec(x, fx.gy(x, z, c.y), z); T.v.col = tc(c.tint, 0xd0204a, 1.6); T.dur = 2.6;
    T.v.gate = fx.portal({ pos: vec(x - c.f.x * 1.5, T.v.g.y, z - c.f.z * 1.5), dir: c.f, radius: 3.6 * c.s, color: [1.4, 0.15, 0.4], spin: 1.6 });
    T.v.dec = fx.decal({ pos: T.v.g, radius: c.R, kind: 'demon', dur: Infinity, color: T.v.col, hot: 0.4 });
    fx.telegraph({ shape: 'circle', pos: T.v.g, radius: c.R, color: 'purple', dur: 1.1, detonate: true });
  },
  tick(T) {
    const fx = T.fx, v = T.v, c = v.c, g = v.g, s = c.s;
    if (T.age < 1.1) {
      const n = T.rate('d', 60);
      const o = fx.o(s, null);
      for (let i = 0; i < n; i++) { fx.rdir(_a, c.f, 0.6); fx.spawn(DARK_STREAM, g.x - c.f.x * 1.5, g.y + fx.r(1, 5) * s, g.z - c.f.z * 1.5, _a.x * 7, _a.y * 2, _a.z * 7, o); }
      const m = T.rate('c', 30);
      for (let i = 0; i < m; i++) { const a = fx.r(0, TAU), r = fx.r(0, c.R); fx.spawn(DARK.ember, g.x + Math.cos(a) * r, g.y + 0.1, g.z + Math.sin(a) * r, 0, fx.r(1, 4), 0, fx.o(s, null)); }
    }
    if (T.once('erupt', 1.1)) {
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, r = i ? c.R * 0.55 : 0; const x = g.x + Math.cos(a) * r, z = g.z + Math.sin(a) * r; fx.meshes.pillars.spawn(x, g.y, z, 1.1 * s, 9 * s, 1.1, 2, [2.2, 0.1, 0.3], 0.06, 1, i * 0.04); }
      fx.meshes.spikeRings(g.x, g.y, g.z, [[c.R * 0.35, 10, 2], [c.R * 0.7, 16, 1.5], [c.R, 22, 1.1]], 1, { color: [0.3, 0.02, 0.06], glow: [1.8, 0.1, 0.3], fres: 0.5, life: [1.3, 1.8], speed: 30 });
      shockwave(fx, { pos: g, radius: c.R * 1.8, color: v.col, dur: 0.7, height: 3.2 * s });
      fx.at(GEN.bigFlash, _a.set(g.x, g.y + 2, g.z), 0.6 * s, [1, 0.15, 0.4]);
      fx.at(BIG_RAYS, _a, 0.7 * s, v.col);
      fx.sphere(DARK.flame, 80, _a, 3, 10, s, null, UP, 1.2);
      fx.sphere(PHYS.blood, 40, _a, 4, 9, s, null, UP, 1.0);
      decal(fx, { pos: g, radius: c.R * 0.8, kind: 'crater', dur: 9, color: [1.8, 0.2, 0.4] });
      fx.flash(0.16, [0.9, 0.1, 0.3]); fx.shake(1, g); fx.aberr(0.8); fx.radialBlur(0.5);
    }
    if (T.once('close', 1.8)) v.gate.stop();
  },
  stop(T) { T.v.dec.stop(); },
  end(T) { T.v.gate.stop(); T.v.dec.stop(); },
};
K.abyssal_rupture = K.awk_abyssal_gate;
K.time_stop = (fx, p) => { const c = ctx(fx, p, null, 10), pos = vec(c.x, c.y, c.z); shockwave(fx, { pos, radius: c.R, color: [0.8, 0.9, 1.6], dur: 0.9, height: 3 }); fx.at(BIG_RAYS, vec(c.x, c.y + 1.5, c.z), 1.2, [0.7, 0.8, 1.2]); decal(fx, { pos, radius: c.R * 0.5, kind: 'arcane', dur: 2, color: [0.7, 0.9, 2] }); fx.flash(0.25, [0.6, 0.7, 1]); fx.radialBlur(0.5); };

for (const k in K) K[k].group = 'Awakenings';
export const AWAKEN = K;
