// Mystic presets — Starcaller (meteors, fire, frost, lightning, runes, void) and Songweaver (harp: notes, heals, buffs).
import * as THREE from 'three';
import { KEYS, ctx, tc, vec, groundSmash, skyBolt, along, risingRing, groundPulse, lightPillar, GEN, PHYS, FIRE, FROST, HOLY, STORM, DARK, ARC, HEAL, MUSIC, TAU, UP, hue, shockwave, decal, hit, explosion, S, R, P } from './lib.js';

const K = {};
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const ARCANE = 0xc070ff, FROSTC = 0x8fd8ff, MUSICC = 0xff8ad8;
const HAIL = P({ sprite: S.shard, ramp: R.frostCore, life: [0.5, 0.7], size: [0.25, 0.4], orient: 'stretch', stretch: 0.02, drag: 0, accY: -10, i: [1.6, 2.4] });
const VOID_IN = P({ sprite: S.ember, ramp: R.shadowCore, life: [0.8, 1.2], size: [0.08, 0.14], end: 0.3, motion: 'orbit', rise: 0.2, rgrow: -3.2, i: [3, 5] });
const VOID_DUST = P({ pool: 'alpha', sprite: [S.smoke1, S.smoke3], ramp: R.void, life: [0.9, 1.3], size: [0.6, 0.9], end: 0.3, motion: 'orbit', rise: 0.3, rgrow: -3, alpha: 0.8 });
const DISK = P({ sprite: S.swirl, ramp: R.wConst, life: 1, size: 5, orient: 'flat', spin: 3, i: 1.2, noGround: true });
const NOTE_WAVE = P({ sprite: [S.note1, S.note2], ramp: R.music, life: [0.8, 1.1], size: [0.34, 0.48], end: 0.8, rot: [-0.3, 0.3], drag: 1.2, accY: 0.4, i: [2.2, 3] });
const HOLE = P({ sprite: S.swirl, ramp: R.wConst, life: 1, size: 2.2, spin: -6, i: 2, noGround: true });
const STAFF = P({ sprite: S.ring, ramp: R.wFade, life: 0.7, size: 1, end: 9, ease: 2, orient: 'flat', i: 2 });

// ------------------------------------------------------------------ Starcaller
K.meteor_rain = {                    // Doomfall: meteors rain over an area (loop until dur / stop)
  name: 'meteor_rain', fade: 0.3, group: 'Starcaller',
  init(T) {
    const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 5, 10, 8);
    T.v.cx = T.p.target ? c.tx : c.x; T.v.cz = T.p.target ? c.tz : c.z; T.v.cy = fx.gy(T.v.cx, T.v.cz, c.y);
    T.dur = T.p.dur ?? 3; T.v.next = 0.05; T.v.every = T.p.every ?? 0.22;
    T.v.tele = fx.telegraph({ shape: 'circle', pos: vec(T.v.cx, T.v.cy, T.v.cz), radius: c.R, color: T.p.teleColor ?? 'orange', fill: false, intensity: 0.6 });
  },
  tick(T, dt) {
    const fx = T.fx, v = T.v, c = v.c;
    if (T.stopping) return;
    v.next -= dt;
    if (v.next <= 0) {
      v.next = v.every * fx.r(0.7, 1.3);
      const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * c.R * 0.85;
      fx.meteor({ target: vec(v.cx + Math.cos(a) * r, v.cy, v.cz + Math.sin(a) * r), radius: fx.r(1.4, 2.2) * c.s, delay: fx.r(0.45, 0.65), telegraph: false, dir: c.f, color: T.p.color });
    }
  },
  stop(T) { T.v.tele.stop(); },
  end(T) { T.v.tele.stop(); },
};
K.doomfall = K.meteor_rain;
K.fire_nova = (fx, p) => {           // Blaze Nova: a ring of fire rushes outward
  const c = ctx(fx, p, null, 5.5), s = c.R / 5.5, pos = vec(c.x, c.y, c.z);
  fx.at(FIRE.flash, pos, 3 * s, null, null, 0, 1, 0);
  shockwave(fx, { pos, radius: c.R, color: [2.6, 0.9, 0.2], dur: 0.5, height: 1.8 * s, dust: false });
  const o = fx.o(s, null);
  for (let i = 0; i < fx.n(64); i++) {
    const a = i / 64 * TAU, sp = c.R / 0.5 * fx.r(0.8, 1.05);
    o.dt = fx.r(0, 0.05);
    fx.spawn(FIRE.column, c.x + Math.cos(a) * 0.6, c.y + 0.3, c.z + Math.sin(a) * 0.6, Math.cos(a) * sp * 0.55, fx.r(1, 3), Math.sin(a) * sp * 0.55, o);
  }
  fx.radial(FIRE.ember, 60, pos, 6, 14, 1, 5, s, null, 0.5, 0.4);
  fx.radial(FIRE.smokeWarm, 14, pos, 3, 6, 0.5, 1.5, s, null, 1, 0.5, { dt: 0.2 });
  decal(fx, { pos, radius: c.R * 0.9, kind: 'scorch', dur: 6, hot: 1.2 });
  fx.shake(0.25 * s, pos);
};
K.blaze_nova = K.fire_nova;
K.frost_lance = (fx, p) => {         // piercing ice lance + spikes erupting along its path
  const c = ctx(fx, p, null, 1, 14, 14), s = c.s;
  const from = p.sockets?.handR ? p.sockets.handR.getWorldPosition(new THREE.Vector3()) : vec(c.x + c.f.x * 0.8, c.y + 1.3, c.z + c.f.z * 0.8);
  fx.projectile({ from, dir: c.f, kind: 'lance', range: c.L, speed: 38, scale: s * 1.2, impact: true });
  fx.meshes.spikeLine(c.x + c.f.x * 1.5, c.y, c.z + c.f.z * 1.5, c.f.x, c.f.z, c.L - 1.5, Math.round(c.L * 1.3), 0.7 * s, { speed: 38, life: 1.4, spread: 0.45 });
  decal(fx, { pos: vec(c.x + c.f.x, c.y, c.z + c.f.z), dir: c.f, radius: 1.1 * s, length: c.L - 1, kind: 'ice', dur: 4, fadeIn: 0.2 });
  fx.at(FROST.flash, from, 1.6 * s, null);
};
K.frost_nova = (fx, p) => {          // ring of ice spikes + frozen ground
  const c = ctx(fx, p, null, 4.5), s = c.R / 4.5, pos = vec(c.x, c.y, c.z);
  fx.meshes.spikeRings(c.x, c.y, c.z, [[1.3, 8, 0.95], [2.3, 12, 1.2], [3.4, 16, 1.05], [4.5, 20, 0.8]], s);
  shockwave(fx, { pos, radius: c.R * 1.25, color: [0.7, 1.4, 2.4], dur: 0.45, height: 1.2, dust: false });
  decal(fx, { pos, radius: c.R * 1.1, kind: 'frost', dur: 5, fadeIn: 0.15 });
  fx.at(FROST.flash, pos, 2.6 * s, null, null, 0, 1, 0);
  fx.radial(FROST.mist, 24, pos, 5, 8, 0.1, 0.6, s, null, 0.6, 0.35);
  fx.radial(FROST.flake, 30, pos, 3, 7, 0.5, 3, s, null, 0.3, 0.5);
  fx.radial(FROST.sparkle, 26, pos, 4, 9, 0.2, 2, s, null, 0.5, 0.4);
  fx.shake(0.2 * s, pos);
};
K.blizzard = {                       // Seraphic Hail / blizzard: shards pelt an area, mist, frozen floor
  name: 'blizzard', fade: 0.6, group: 'Starcaller',
  init(T) {
    const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 5, 10, 8);
    T.v.cx = T.p.target ? c.tx : c.x; T.v.cz = T.p.target ? c.tz : c.z; T.v.cy = fx.gy(T.v.cx, T.v.cz, c.y);
    T.dur = T.p.dur ?? 3;
    T.v.dec = fx.decal({ pos: vec(T.v.cx, T.v.cy, T.v.cz), radius: c.R * 1.05, kind: 'ice', dur: Infinity, fadeIn: 0.6 });
  },
  tick(T) {
    const fx = T.fx, v = T.v, c = v.c, R0 = c.R;
    if (T.stopping) return;
    let n = T.rate('h', 26 * R0);
    const o = fx.o(c.s, null);
    for (let i = 0; i < n; i++) {
      const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * R0, x = v.cx + Math.cos(a) * r, z = v.cz + Math.sin(a) * r;
      fx.spawn(HAIL, x - 2, v.cy + 9, z - 1, 3.3, -14, 1.6, o);
    }
    n = T.rate('i', 3.5 * R0);
    for (let i = 0; i < n; i++) {
      const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * R0, x = v.cx + Math.cos(a) * r, z = v.cz + Math.sin(a) * r;
      const oo = fx.o(c.s, null); oo.dt = 0.62;
      fx.spawn(FROST.sparkle, x, v.cy + 0.2, z, 0, 0.5, 0, oo);
      fx.spawn(FROST.shard, x, v.cy + 0.2, z, fx.r(-2, 2), fx.r(2, 4), fx.r(-2, 2), oo);
    }
    n = T.rate('m', 2.2 * R0);
    for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * R0; fx.spawn(FROST.mist, v.cx + Math.cos(a) * r, v.cy + 0.4, v.cz + Math.sin(a) * r, fx.r(-1, 1), 0.1, fx.r(-1, 1), fx.o(c.s * 1.6, null)); }
  },
  stop(T) { T.v.dec.stop(); }, end(T) { T.v.dec.stop(); },
};
K.hail = K.blizzard;
K.seraphic_hail = K.blizzard;
K.punishing_bolt = (fx, p) => {      // giant lightning from the sky
  const c = ctx(fx, p, null, 3.5, 8, 7), s = c.R / 3.5;
  const x = p.target ? c.tx : c.x, z = p.target ? c.tz : c.z, y = fx.gy(x, z, c.y);
  skyBolt(fx, x, y, z, 1.8 * s, tc(c.tint, 0x9ab8ff, 1.8), { dur: 0.5, shake: 0.5 });
  fx.task(REBOLT, { pos: vec(x, y, z), s, color: tc(c.tint, 0x9ab8ff, 1.8) });
  fx.flash(0.15, [0.7, 0.8, 1.2]);
};
const REBOLT = { name: 'rebolt', init(T) { T.dur = 0.5; }, tick(T) { for (let k = 0; k < 3; k++) if (T.once(KEYS[k], 0.1 + k * 0.12)) skyBolt(T.fx, T.pos.x + T.fx.r(-1, 1), T.pos.y, T.pos.z + T.fx.r(-1, 1), T.p.s, T.p.color, { decal: false, shake: 0.12 }); } };
K.lightning_vortex = {               // holding: a spinning storm of bolts around the caster
  name: 'lightning_vortex', fade: 0.3, group: 'Starcaller',
  init(T) { const c = ctx(T.fx, T.p, T.v.c = {}, 4); T.v.col = tc(c.tint, 0x9ab8ff, 1.7); T.dur = T.p.dur ?? 2; },
  tick(T) {
    const fx = T.fx, c = T.v.c, p = T.pos, gy = fx.gy(p.x, p.z, p.y);
    if (T.stopping) return;
    if (T.rate('b', 9)) { const a = fx.r(0, TAU), r = fx.r(1.5, c.R); skyBolt(fx, p.x + Math.cos(a) * r, gy, p.z + Math.sin(a) * r, 0.55 * c.s, T.v.col, { decal: false, shake: 0.05 }); }
    const n = T.rate('s', 60);
    const vh = T.v.hue || (T.v.hue = hue(T.v.col, [0, 0, 0]));
    for (let i = 0; i < n; i++) fx.spawn(GEN.orbitMote, p.x, gy + fx.r(0.3, 2.5), p.z, fx.r(1, c.R), fx.r(0, TAU), 4, fx.o(c.s, vh));
  },
};
K.black_hole = {                     // Void Rift: dark sphere, accretion swirl, everything is pulled in, then it implodes
  name: 'black_hole', fade: 0.3, group: 'Starcaller',
  init(T) {
    const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 4.5, 10, 8);
    const x = T.p.target ? c.tx : c.x, z = T.p.target ? c.tz : c.z, y = fx.gy(x, z, c.y);
    T.place(x, y + 1.6 * c.s, z);
    T.v.col = tc(c.tint, 0x8a3cff, 1.4); T.v.gy = y;
    T.dur = T.p.dur ?? 2.2;
    T.v.bub = fx.meshes.bubbles.alloc();
    T.hold(DISK, 0, -0.6 * c.s, 0, { tint: T.v.col, scale: c.R / 4.5 * 1.3 });
    T.hold(HOLE, 0, 0, 0, { tint: T.v.col, scale: 1.2 * c.s });
    T.v.dec = fx.decal({ pos: vec(x, y, z), radius: c.R, kind: 'swirl', dur: Infinity, color: T.v.col });
    fx.at(DARK.flash, T.pos, 2 * c.s, null);
  },
  tick(T) {
    const fx = T.fx, v = T.v, c = v.c, P0 = T.pos, s = c.s;
    const grow = Math.min(1, T.age / 0.35);
    if (v.bub >= 0) fx.meshes.bubbles.set(v.bub, P0.x, P0.y, P0.z, 1.1 * s * grow * (1 + Math.sin(T.age * 14) * 0.03), v.col, T.k, 0, 2);
    let n = T.rate('v', 110 * s);
    const o = fx.o(s, v.col);
    for (let i = 0; i < n; i++) fx.spawn(VOID_IN, P0.x, v.gy + fx.r(0.1, 2.6) * s, P0.z, c.R * fx.r(0.7, 1.15), fx.r(0, TAU), fx.r(2.5, 4.5), o);
    n = T.rate('d', 16 * s);
    const od = fx.o(s, null);
    for (let i = 0; i < n; i++) fx.spawn(VOID_DUST, P0.x, v.gy + 0.3, P0.z, c.R * fx.r(0.8, 1.2), fx.r(0, TAU), fx.r(1.5, 2.5), od);
    if (T.rate('r', 3)) fx.rings.ground(vec(P0.x, v.gy, P0.z), c.R * 0.2, 0.5, [v.col[0] * 0.8, v.col[1] * 0.8, v.col[2] * 0.8], { r0: c.R * 1.1, ease: 1.5, ew: 0.3, trail: 0.4, flags: 0 });
  },
  stop(T) {
    const fx = T.fx, v = T.v, c = v.c, P0 = T.pos;
    fx.at(DARK.flash, P0, 3 * c.s, null);
    fx.at(GEN.bigFlash, P0, 0.8 * c.s, v.col);
    shockwave(fx, { pos: vec(P0.x, v.gy, P0.z), radius: c.R * 1.4, color: [v.col[0] * 1.6, v.col[1] * 1.6, v.col[2] * 1.6], dur: 0.45, height: 2 });
    fx.sphere(DARK.spark, 50, P0, 5, 13, c.s, null);
    fx.sphere(DARK.wisp, 16, P0, 2, 5, c.s, null);
    v.dec.stop(); fx.shake(0.35, P0);
  },
  end(T) { if (T.v.bub >= 0) T.fx.meshes.bubbles.free(T.v.bub); T.v.dec.stop(); },
};
K.void_rift = K.black_hole;
K.rune_detonation = {                // Esoteric Rune: a magic circle charges, then detonates in a column
  name: 'rune_detonation', fade: 0.1, group: 'Starcaller',
  init(T) {
    const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 3.5, 10, 7);
    const x = T.p.target ? c.tx : c.x, z = T.p.target ? c.tz : c.z, y = fx.gy(x, z, c.y);
    T.place(x, y, z); T.v.col = tc(c.tint, ARCANE, 1.5);
    T.v.delay = T.p.delay ?? 0.7; T.dur = T.v.delay + 0.2;
    T.v.dec = fx.decal({ pos: T.pos, radius: c.R, kind: 'arcane', dur: T.v.delay + 0.6, color: T.v.col, hot: 0 });
    fx.rings.ground(T.pos, c.R * 0.05, T.v.delay, T.v.col, { r0: c.R * 1.05, ease: 1.2, ew: 0.12, trail: 0.2, flags: 0 });
  },
  tick(T) {
    const fx = T.fx, v = T.v, c = v.c, P0 = T.pos;
    if (T.age < v.delay) {
      const n = T.rate('g', 30 * c.s);
      for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = c.R * fx.r(0.3, 1); fx.spawn(ARC.glyph, P0.x + Math.cos(a) * r, P0.y + 0.1, P0.z + Math.sin(a) * r, 0, fx.r(0.5, 2), 0, fx.o(c.s, null)); }
    }
    if (T.once('boom', v.delay)) {
      lightPillar(fx, P0.x, P0.y, P0.z, c.R * 0.45, 7 * c.s, [v.col[0] * 1.3, v.col[1] * 1.3, v.col[2] * 1.3], 0.6, 3);
      fx.at(ARC.flash, P0, 2.2 * c.s, null, null, 0, 1, 0);
      fx.at(GEN.rays, P0, 1.2 * c.s, v.col, null, 0, 1.2, 0);
      shockwave(fx, { pos: P0, radius: c.R * 1.6, color: v.col, dur: 0.45, height: 2 });
      fx.sphere(ARC.star, 40, vec(P0.x, P0.y + 1, P0.z), 4, 11, c.s, null);
      for (let i = 0; i < 7; i++) fx.spawn(ARC.glyphOut, P0.x, P0.y + 0.5, P0.z, 0.3 * c.s, i / 7 * TAU, 1.2, fx.o(c.s * 1.4, null));
      fx.shake(0.3, P0);
    }
  },
};
K.esoteric_rune = K.rune_detonation;
K.starfire_explosion = (fx, p) => { const c = ctx(fx, p, null, 3, 8, 7); const x = p.target ? c.tx : c.x, z = p.target ? c.tz : c.z; explosion(fx, vec(x, fx.gy(x, z, c.y) + 0.5, z), 1.4 * c.R / 3, 'fire', { color: p.color ?? 0xff9a50 }); fx.at(ARC.flash, vec(x, c.y + 1, z), 2.4, null); };
K.teleport_blink = (fx, p) => {      // Blink: implode at from, burst out at to, streak between
  const c = ctx(fx, p, null, 1, 7, 7), s = c.s, col = tc(c.tint, ARCANE, 1.4);
  const from = vec(c.x, c.y, c.z), to = p.to ? vec(0, 0, 0).copy(p.to) : vec(c.tx, c.ty, c.tz);
  const fu = vec(from.x, from.y + 1, from.z), tu = vec(to.x, to.y + 1, to.z);
  fx.at(ARC.flash, fu, 1.4 * s, col);
  fx.meshes.pillars.spawn(from.x, from.y, from.z, 0.5 * s, 3 * s, 0.35, 3, col, 0.02);
  fx.sphere(ARC.star, 26, fu, 2, 6, s, col);
  fx.at(GEN.rune, vec(from.x, from.y + 0.06, from.z), 0.8 * s, col, { life: 0.6 });
  fx.beam({ from: fu, to: tu, kind: 'energy', color: [col[0] * 1.5, col[1] * 1.5, col[2] * 1.5], width: 0.7 * s, dur: 0.12, fade: 0.2 });
  const o = fx.o(s, col); o.dt = 0.08;
  for (let i = 0; i < fx.n(30); i++) fx.spawn(GEN.converge, to.x, to.y + fx.r(0.2, 1.9) * s, to.z, fx.r(1.2, 1.9) * s, fx.r(0, TAU), fx.r(4, 8), o);
  fx.at(ARC.flash, tu, 1.4 * s, col, { dt: 0.28 });
  fx.at(GEN.rune, vec(to.x, to.y + 0.06, to.z), 0.8 * s, col, { life: 0.7, dt: 0.1 });
};
K.blink = K.teleport_blink;
K.inferno_wave = (fx, p) => {        // charged wave of flame rolling forward
  const c = ctx(fx, p, null, 3, 10), s = c.s, speed = 18, dur = c.L / speed;
  fx.slash({ pos: vec(c.x, c.y, c.z), dir: c.f, style: 'wave', radius: 2.2 * s, width: 1.5 * s, color: [2.6, 0.8, 0.15], speed, dur: dur + 0.1 });
  const o = fx.o(s, null);
  along(c.x, c.z, c.f, c.L, fx.n(30), (x, z, u) => { o.dt = u * dur; for (let k = 0; k < 2; k++) { const side = fx.r(-1.8, 1.8) * s; fx.spawn(FIRE.column, x + c.rt.x * side, c.y + 0.2, z + c.rt.z * side, 0, fx.r(3, 6), 0, o); } });
  decal(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, radius: 1.8 * s, length: c.L, kind: 'fissure', dur: 4, color: [2, 0.6, 0.1] });
};

// ------------------------------------------------------------------ Songweaver
K.harp_note_wave = (fx, p) => {      // Sound Shock: a fan of notes and sound rings sweeps forward
  const c = ctx(fx, p, null, 2, 8), s = c.s, col = tc(c.tint, MUSICC, 1.5);
  const up = vec(c.x + c.f.x * 0.8, c.y + 1.2, c.z + c.f.z * 0.8);
  const o = fx.o(s, col);
  for (let i = 0; i < fx.n(26); i++) { fx.rdir(_a, c.f, 0.6); const v = fx.r(6, 11); o.dt = fx.r(0, 0.15); fx.spawn(NOTE_WAVE, up.x, up.y, up.z, _a.x * v, _a.y * v * 0.3 + 0.5, _a.z * v, o); }
  for (let k = 0; k < 3; k++) {
    const g = vec(c.x + c.f.x * (1.5 + k * 1.6) * s, c.y, c.z + c.f.z * (1.5 + k * 1.6) * s);
    fx.rings.ground(g, 1.6 * s, 0.4, col, { ew: 0.12, trail: 0.4, flags: 0, delay: k * 0.07 });
  }
  fx.at(GEN.flash, up, 1.4 * s, col);
  fx.sphere(MUSIC.sparkle, 20, up, 3, 8, s, col, c.f, 0.6);
};
K.sound_shock = K.harp_note_wave;
K.orbiting_notes = (fx, p) => fx.aura({ attach: p.attach ?? p.follow ?? p.unit, pos: p.pos, kind: 'music', color: p.color ?? MUSICC, dur: p.dur ?? 4, scale: p.scale ?? 1 });
K.harp_of_rhythm = K.orbiting_notes;
K.music_buff_ring = (fx, p) => {     // Heavenly Tune / Anthem: staff ring + rising notes over the party
  const c = ctx(fx, p, null, 6), s = c.R / 6, col = tc(c.tint, 0xffb04a, 1.4), pos = vec(c.x, c.y, c.z);
  decal(fx, { pos, radius: c.R * 0.9, kind: 'music', dur: 2.2, color: col, hot: 0.4 });
  fx.at(STAFF, vec(c.x, c.y + 0.07, c.z), s, col);
  shockwave(fx, { pos, radius: c.R, color: [col[0] * 0.7, col[1] * 0.7, col[2] * 0.7], dur: 0.6, height: 1.0, dust: false });
  risingRing(fx, c.x, c.y, c.z, c.R * 0.7, MUSIC.noteGold, 26, null, s * 1.2, [1.5, 3]);
  fx.at(GEN.rays, vec(c.x, c.y + 1.2, c.z), 1.4 * s, col);
};
K.heavenly_tune = K.music_buff_ring;
K.anthem_of_courage = K.music_buff_ring;
K.heal_zone = {                      // Hymn of Mending: soft green-gold zone with petals and rising motes (loop)
  name: 'heal_zone', fade: 0.5, group: 'Songweaver',
  init(T) {
    const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 5);
    T.v.col = tc(c.tint, 0x7aff9a, 1.3); T.v.R = c.R;
    T.v.dec = fx.decal({ pos: vec(c.x, c.y, c.z), radius: c.R, kind: 'nature', dur: Infinity, color: T.v.col, hot: 0.5 });
    T.dur = T.p.dur ?? 6;
    groundPulse(fx, c.x, c.y, c.z, c.R, T.v.col);
  },
  moved(T) { T.v.dec.setPos(T.pos); },
  tick(T) {
    const fx = T.fx, v = T.v, p = T.pos, gy = fx.gy(p.x, p.z, p.y);
    const o = fx.o(1, v.col);
    let n = T.rate('m', 10 * v.R);
    for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * v.R; fx.spawn(HEAL.mote, p.x + Math.cos(a) * r, gy + 0.1, p.z + Math.sin(a) * r, 0, fx.r(0.8, 1.6), 0, o); }
    n = T.rate('p', 2.2 * v.R);
    for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * v.R; fx.spawn(HEAL.petal, p.x + Math.cos(a) * r, gy + fx.r(1.5, 3), p.z + Math.sin(a) * r, 0, -0.2, 0, fx.o(1, null)); }
    n = T.rate('x', 1.2 * v.R);
    for (let i = 0; i < n; i++) { const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * v.R * 0.8; fx.spawn(HEAL.plus, p.x + Math.cos(a) * r, gy + 0.3, p.z + Math.sin(a) * r, 0, 0.8, 0, fx.o(1, null)); }
  },
  stop(T) { T.v.dec.stop(); }, end(T) { T.v.dec.stop(); },
};
K.hymn_of_mending = K.heal_zone;
K.sonic_vibration = (fx, p) => {     // big sonic detonation at the target: stacked sound rings + note burst
  const c = ctx(fx, p, null, 3.5, 8, 7), s = c.R / 3.5, col = tc(c.tint, MUSICC, 1.6);
  const x = p.target ? c.tx : c.x, z = p.target ? c.tz : c.z, y = fx.gy(x, z, c.y), pos = vec(x, y, z);
  for (let k = 0; k < 4; k++) shockwave(fx, { pos, radius: c.R * (1 + k * 0.35), color: col, dur: 0.45, delay: k * 0.08, wall: k === 0, dust: k === 0, height: 1.6 });
  fx.at(GEN.bigFlash, vec(x, y + 1, z), 0.6 * s, col);
  fx.sphere(NOTE_WAVE, 30, vec(x, y + 1, z), 3, 9, s, col, UP, 1.3);
  decal(fx, { pos, radius: c.R, kind: 'music', dur: 2, color: col });
  fx.shake(0.3 * s, pos);
};
K.soundholic = K.sonic_vibration;
K.rhapsody_of_light = (fx, p) => { K.light_pillar_notes(fx, p); };
K.light_pillar_notes = (fx, p) => {
  const c = ctx(fx, p, null, 2.5, 8, 6), s = c.R / 2.5, col = tc(c.tint, 0xffd88a, 1.6);
  const x = p.target ? c.tx : c.x, z = p.target ? c.tz : c.z, y = fx.gy(x, z, c.y);
  lightPillar(fx, x, y, z, c.R * 0.7, 14 * s, [col[0] * 1.4, col[1] * 1.4, col[2] * 1.4], 1.2);
  fx.sphere(MUSIC.noteGold, 20, vec(x, y + 1, z), 2, 5, s, null, UP, 1.2);
  shockwave(fx, { pos: vec(x, y, z), radius: c.R * 1.8, color: col, dur: 0.5, dust: false });
};
K.guardian_tune = (fx, p) => fx.play('shield_bubble', { ...p, color: p.color ?? 0x8ae8ff });
K.wind_of_music = (fx, p) => { const c = ctx(fx, p, null, 5); risingRing(fx, c.x, c.y, c.z, c.R * 0.6, PHYS.wind, 40, tc(c.tint, 0xc8f0ff, 1.2), c.s, [3, 6]); K.music_buff_ring(fx, { ...p, color: p.color ?? 0x9ae8ff }); };
K.stigma = (fx, p) => fx.play('brand_mark', { ...p, color: p.color ?? 0xff6ab8 });

for (const k in K) K[k].group = K[k].group || (/harp|note|music|heal_zone|sonic|sound|rhapsody|light_pillar_notes|tune|wind_of|stigma|hymn|anthem|soundholic/.test(k) ? 'Songweaver' : 'Starcaller');
export const MYSTIC = K;
