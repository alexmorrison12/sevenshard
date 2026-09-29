// Presets named by the game's class kits (src/data/classes/*) and bosses (src/data/bosses/*) that are not covered by
// the per-class files: each is a real composite tuned for how the kit calls it (params r, len, width, arc, dur, big,
// follow, at-point positions).
import * as THREE from 'three';
import { ctx, tc, vec, groundSmash, skyBolt, along, risingRing, groundPulse, lightPillar, GEN, PHYS, FIRE, FROST, HOLY, STORM, CHI, DARK, ARC, HEAL, MUSIC, WATER, CRIM, AMB, TAU, UP, hue, shockwave, decal, hit, explosion, slash, S, R, P, v3 } from './lib.js';
import { WARRIOR } from './warrior.js';
import { MYSTIC } from './mystic.js';
import { SHADE } from './shade.js';
import { GUNNER } from './gunner.js';
import { BOSS } from './boss.js';
import { AWAKEN } from './awaken.js';
import { AMBIENT, KEYS } from './ambient.js';

const K = {};
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const HOLYC = 0xffd07a, MUSICC = 0xff8ad8, BLOODC = 0xb0101a, DEMONC = 0xd0204a, BLADEC = 0xb07aff, GHOST = 0x6ad8ff, SOUL = 0x6a8aff;
const SPIRIT_UP = P({ sprite: S.wisp, ramp: R.ghost, life: [0.8, 1.2], size: [0.6, 1.0], end: 1.5, drag: 1, accY: 2, turb: 0.3, i: [1.6, 2.4] });
const SOUL_IN = P({ sprite: S.wisp, ramp: R.shadow, life: [0.7, 0.9], size: [0.4, 0.6], end: 0.5, motion: 'orbit', rise: 0.8, rgrow: -4.5, spin: 2, i: [1.8, 2.6] });
const STAR_FALL = P({ sprite: S.star, ramp: R.wFade, life: [0.5, 0.7], size: [0.5, 0.8], orient: 'stretch', stretch: 0.04, spin: 2, i: [3, 4] });
const GHOST_FLAME = P({ sprite: [S.flame1, S.flame2, S.wisp], ramp: R.foxfire, life: [0.5, 0.8], size: [0.5, 0.9], end: 0.5, rot: [-0.3, 0.3], drag: 1.5, accY: 3, turb: 0.2, i: [1.8, 2.6] });
const CROSSHAIR = P({ sprite: S.rune, ramp: R.wInOut, life: 0.9, size: 2.4, end: 0.85, ease: 2, orient: 'flat', spin: 2.5, i: 2.6 });

// ------------------------------------------------------------------ Oathkeeper / holy
K.holy_aura = (fx, p) => {           // Aegis of Dawn: party-wide golden aura pulse
  const c = ctx(fx, p, null, 8), s = c.R / 8, col = tc(c.tint, HOLYC, 1.5), pos = vec(c.x, c.y, c.z);
  decal(fx, { pos, radius: c.R * 0.75, kind: 'holy', dur: 2.2, color: col, hot: 0.6 });
  shockwave(fx, { pos, radius: c.R, color: col, dur: 0.7, height: 2.2 * s, dust: false });
  lightPillar(fx, c.x, c.y, c.z, 1.6 * s, 14 * s, [col[0] * 1.3, col[1] * 1.3, col[2] * 1.3], 1.2, 0);
  risingRing(fx, c.x, c.y, c.z, c.R * 0.6, HOLY.riseSpark, 50, col, s, [2, 5]);
  fx.sphere(HOLY.feather, 16, vec(c.x, c.y + 2, c.z), 1.5, 4, s, null, UP, 1.2);
  fx.at(GEN.rays, vec(c.x, c.y + 1.4, c.z), 1.6 * s, col);
  fx.flash(0.1, col);
};
K.holy_blessing = (fx, p) => { const c = ctx(fx, p, null, 6); fx.play('music_buff_ring', { ...p, color: p.color ?? HOLYC }); fx.play('holy_nova', { ...p, radius: c.R * 0.8, color: p.color ?? HOLYC }); };
K.holy_circle = { ...WARRIOR.sanctuary_zone, name: 'holy_circle' };
K.holy_pillars = {                   // many pillars of light slam down across the area
  name: 'holy_pillars', fade: 0.1, group: 'Oathkeeper',
  init(T) { const c = ctx(T.fx, T.p, T.v.c = {}, 7); T.v.n = Math.round(5 + c.R); T.dur = 0.3 + T.v.n * 0.07; T.v.col = tc(c.tint, HOLYC, 1.6); decal(T.fx, { pos: vec(c.x, c.y, c.z), radius: c.R, kind: 'holy', dur: 2.5, color: T.v.col }); },
  tick(T) {
    const fx = T.fx, v = T.v, c = v.c;
    for (let i = 0; i < v.n; i++) if (T.once(KEYS[i % 32], 0.05 + i * 0.07)) {
      const a = fx.r(0, TAU), r = i === 0 ? 0 : Math.sqrt(Math.random()) * c.R * 0.85, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      WARRIOR.light_pillar(fx, { pos: vec(x, c.y, z), radius: fx.r(1.4, 2.2) * c.s, color: v.col });
    }
  },
};
K.holy_ray = (fx, p) => {            // a ray of judgment sweeps down the lane
  const c = ctx(fx, p, null, 2, 7), s = c.s, col = tc(c.tint, HOLYC, 2), W = (c.W ?? 3) * s;
  const from = vec(c.x + c.f.x * 0.6, c.y + 1.3, c.z + c.f.z * 0.6), to = vec(c.x + c.f.x * c.L, c.y + 0.4, c.z + c.f.z * c.L);
  fx.beam({ from, to, kind: 'holy', color: col, width: W * 0.5, dur: 0.45 });
  fx.beam({ from, to, kind: 'glow', color: [2.4, 2.2, 1.8], width: W * 0.18, dur: 0.35 });
  decal(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, radius: W * 0.4, length: c.L, kind: 'fissure', dur: 2, color: col });
  const o = fx.o(s, col);
  along(c.x, c.z, c.f, c.L, fx.n(20), (x, z, u) => { o.dt = u * 0.12; fx.spawn(HOLY.spark, x, c.y + 0.3, z, fx.r(-2, 2), fx.r(2, 6), fx.r(-2, 2), o); });
  fx.at(HOLY.flash, to, 2.4 * s, null);
};
K.holy_shield = (fx, p) => fx.play('shield_bubble', { ...p, color: p.color ?? HOLYC, dur: p.dur ?? 4 });
K.holy_sword = {                     // a sword of light plunges into the point (small Radiant Judgment)
  name: 'holy_sword', fade: 0.3, group: 'Oathkeeper',
  init(T) {
    const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 3.8);
    T.v.g = vec(c.x, c.y, c.z); T.v.col = tc(c.tint, HOLYC, 1.8);
    T.v.sword = { pos: vec(c.x, c.y + 14, c.z), quat: new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(-c.f.x, -c.f.z)), scale: 4.2 * c.s, alive: true, tint: [2.2, 1.9, 1.2], alpha: 1.2 };
    fx.meshes.props.add('sword', T.v.sword);
    T.v.trail = fx.ribbons.trail({ attach: T.v.sword.pos, color: [2.2, 1.9, 1.3], width: 1.1 * c.s, life: 0.2, kind: 'energy' });
    fx.telegraph({ shape: 'circle', pos: T.v.g, radius: c.R, color: 'yellow', dur: 0.25, detonate: false, intensity: 0.7 });
    T.dur = (T.p.dur ?? 0.5) + 0.9;
  },
  tick(T) {
    const fx = T.fx, v = T.v, c = v.c, g = v.g;
    const u = Math.min(1, T.age / 0.25);
    v.sword.pos.set(g.x, g.y + 14 - u * u * (14 - 0.8 * c.s), g.z);
    if (T.once('hit', 0.25)) {
      v.trail.stopped = true;
      WARRIOR.holy_explosion(fx, { pos: g, radius: c.R, color: T.p.color ?? HOLYC });
      lightPillar(fx, g.x, g.y, g.z, c.R * 0.35, 12, [2, 1.7, 1.1], 0.6, 0);
      fx.meshes.debris(g.x, g.y + 0.3, g.z, 8, c.s, 7, { gy: g.y, glow: [2, 1.6, 0.7] });
    }
    if (T.age > T.dur - 0.5) v.sword.alpha = Math.max(0, (T.dur - T.age) / 0.5) * 1.2;
  },
  end(T) { T.v.sword.alive = false; T.v.trail.stopped = true; },
};
K.holy_thrust = (fx, p) => { const c = ctx(fx, p, null, 1, 4); slash(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, style: 'thrust', radius: 1, length: c.L, width: 0.7 * c.s, color: tc(c.tint, HOLYC, 2.4), intensity: 1, dur: 0.3 }); fx.at(HOLY.flash, vec(c.x + c.f.x * c.L, c.y + 1, c.z + c.f.z * c.L), 1.6 * c.s, null); fx.sphere(HOLY.spark, 18, vec(c.x + c.f.x * c.L, c.y + 1, c.z + c.f.z * c.L), 3, 8, c.s, null, c.f, 0.7); };
K.holy_wave = (fx, p) => { const c = ctx(fx, p, null, 2, 6); slash(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, style: 'wave', radius: 1.9 * c.s, width: 1.1 * c.s, color: tc(c.tint, HOLYC, 2.4), intensity: 1, speed: 20, dur: c.L / 20 + 0.1 }); const o = fx.o(c.s, tc(c.tint, HOLYC, 1)); along(c.x, c.z, c.f, c.L, fx.n(14), (x, z, u) => { o.dt = u * c.L / 20; fx.spawn(HOLY.mote, x + fx.r(-1, 1), c.y + 0.2, z + fx.r(-1, 1), 0, fx.r(1, 3), 0, o); }); };

// ------------------------------------------------------------------ Songweaver / music
K.music_burst = (fx, p) => {         // anthem burst: notes erupt over the party
  const c = ctx(fx, p, null, 8), s = c.R / 8, col = tc(c.tint, MUSICC, 1.5), pos = vec(c.x, c.y, c.z), up = vec(c.x, c.y + 1.5, c.z);
  MYSTIC.music_buff_ring(fx, { ...p, color: p.color ?? MUSICC });
  fx.sphere(MUSIC.note, 40, up, 3, 9, s, col, UP, 1.3);
  fx.at(GEN.bigFlash, up, 0.6 * s, col);
  shockwave(fx, { pos, radius: c.R * 1.2, color: col, dur: 0.6, height: 2, delay: 0.05, dust: false });
};
K.music_circle = { ...MYSTIC.heal_zone, name: 'music_circle', init(T) { T.p = { kind: 'music', ...T.p }; MYSTIC.heal_zone.init(T); T.v.dec.stop(); T.v.dec = T.fx.decal({ pos: T.pos, radius: T.v.R, kind: 'music', dur: Infinity, color: tc(T.v.c.tint, MUSICC, 1.3), hot: 0.4 }); } };
K.music_shield = (fx, p) => fx.play('shield_bubble', { ...p, color: p.color ?? 0x8ae8ff });
K.music_wind = (fx, p) => MYSTIC.wind_of_music(fx, { ...p, color: p.color ?? 0xc8f0ff });
K.sound_wave = (fx, p) => { const c = ctx(fx, p, null, 5); MYSTIC.harp_note_wave(fx, { ...p, len: c.R }); const o = fx.o(c.s, tc(c.tint, MUSICC, 1.2)); for (let k = 0; k < 4; k++) { o.dt = k * 0.06; o.rot = 0; fx.spawn(SONIC_RING, c.x + c.f.x * (1 + k * c.R / 4.5), c.y + 1.1, c.z + c.f.z * (1 + k * c.R / 4.5), c.f.x * 3, 0, c.f.z * 3, o); } };
const SONIC_RING = P({ sprite: S.ring, ramp: R.wFade, life: 0.45, size: 1.2, end: 4, ease: 1.5, rot: 0, i: 2, noGround: true });
K.sound_ring = (fx, p) => { const c = ctx(fx, p, null, 4.2), col = tc(c.tint, MUSICC, 1.6), pos = vec(c.x, c.y, c.z); for (let k = 0; k < 3; k++) shockwave(fx, { pos, radius: c.R * (0.8 + k * 0.3), color: col, dur: 0.4, delay: k * 0.07, wall: k === 0, dust: false, height: 1.4 }); fx.sphere(MUSIC.note, 14, vec(c.x, c.y + 1, c.z), 2, 5, c.s, col, UP, 1.2); fx.at(GEN.flash, vec(c.x, c.y + 1, c.z), 2 * c.s, col); };
K.sound_bomb = (fx, p) => { const c = ctx(fx, p, null, 1.5), col = tc(c.tint, MUSICC, 1.6); fx.at(GEN.flash, vec(c.x, c.y + 1, c.z), 1.6 * c.s, col); fx.sphere(MUSIC.sparkle, 16, vec(c.x, c.y + 1, c.z), 2, 6, c.s, col); fx.at(GEN.ringThin, vec(c.x, c.y + 0.06, c.z), 0.25, col, { life: 0.4 }); };
K.sound_shockwave = (fx, p) => MYSTIC.sonic_vibration(fx, p);

// ------------------------------------------------------------------ Starcaller / arcane
K.arcane_burst = (fx, p) => { const c = ctx(fx, p, null, 3.3), s = c.R / 3.3, col = tc(c.tint, 0xc070ff, 1.6), pos = vec(c.x, c.y, c.z), up = vec(c.x, c.y + 1, c.z); fx.at(ARC.flash, up, 2.4 * s, col); fx.sphere(ARC.star, 40, up, 3, 10, s, null); fx.sphere(ARC.spark, 30, up, 4, 11, s, null); for (let i = 0; i < 7; i++) fx.spawn(ARC.glyphOut, c.x, c.y + 0.5, c.z, 0.3 * s, i / 7 * TAU, 1.2, fx.o(s * 1.3, null)); shockwave(fx, { pos, radius: c.R * 1.4, color: col, dur: 0.4, height: 1.6 }); decal(fx, { pos, radius: c.R * 0.8, kind: 'arcane', dur: 1.5, color: col }); };
K.arcane_spark = (fx, p) => { const c = ctx(fx, p, null, 1), col = tc(c.tint, 0xc070ff, 1.5); fx.at(ARC.flash, vec(c.x, c.y + 1.2, c.z), 1.1 * c.s, col); fx.sphere(ARC.star, 12, vec(c.x, c.y + 1.2, c.z), 1, 4, c.s, null); };
K.star_mote = (fx, p) => { const c = ctx(fx, p, null, 1), col = tc(c.tint, 0xc070ff, 1.5); fx.at(GEN.starFlash, vec(c.x, c.y + 0.8, c.z), 1.2 * c.s, col); fx.sphere(GEN.star, 10, vec(c.x, c.y + 0.8, c.z), 1, 3, c.s, col); };
K.staff_glow = (fx, p) => { const c = ctx(fx, p, null, 1.2), col = tc(c.tint, 0xff9a40, 1.5); const h = p.sockets?.weaponTip ? v3(p.sockets.weaponTip, _a) : _a.set(c.x + c.rt.x * 0.4 + c.f.x * 0.4, c.y + 1.9, c.z + c.rt.z * 0.4 + c.f.z * 0.4); fx.at(GEN.flash, h, 1.2 * c.s, col); fx.sphere(GEN.star, 10, h, 0.5, 2, c.s, col); for (let i = 0; i < fx.n(16); i++) fx.spawn(GEN.converge, h.x, h.y, h.z, fx.r(0.6, 1.2), fx.r(0, TAU), 5, fx.o(c.s * 0.6, col)); };
K.starfire_burst = (fx, p) => { const c = ctx(fx, p, null, 3.4), col = tc(c.tint, 0xc070ff, 1.5); explosion(fx, vec(c.x, c.y + 0.4, c.z), c.R / 3, 'fire', { color: col }); K.arcane_burst(fx, { ...p, radius: c.R * 0.8 }); };
K.falling_star = {                   // stars shower over the area (dur), each a bright arcane impact
  name: 'falling_star', fade: 0.2, group: 'Starcaller',
  init(T) { const fx = T.fx, c = ctx(fx, T.p, T.v.c = {}, 6); T.v.col = tc(c.tint, 0xc070ff, 1.6); T.dur = T.p.dur ?? 1.6; T.v.next = 0; T.v.tele = fx.telegraph({ shape: 'circle', pos: vec(c.x, c.y, c.z), radius: c.R, color: [0.5, 0.15, 1], fill: false, intensity: 0.5 }); },
  tick(T, dt) {
    const fx = T.fx, v = T.v, c = v.c;
    if (T.stopping) return;
    v.next -= dt;
    while (v.next <= 0) {
      v.next += 0.07;
      const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * c.R, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      const o = fx.o(c.s * 1.2, v.col); fx.spawn(STAR_FALL, x - 3, c.y + 12, z - 1.5, 3 / 0.6 * 1.0, -12 / 0.6, 1.5 / 0.6, o);
      fx.task(STAR_HIT, { pos: vec(x, c.y, z), delay: 0.6, color: v.col, s: c.s });
    }
  },
  stop(T) { T.v.tele.stop(); }, end(T) { T.v.tele.stop(); },
};
const STAR_HIT = { name: 'starHit', init(T) { T.dur = T.p.delay; }, stop(T) { const fx = T.fx, p = T.pos, col = T.p.color, s = T.p.s; fx.at(GEN.starFlash, vec(p.x, p.y + 0.4, p.z), 1.8 * s, col); fx.sphere(ARC.star, 10, vec(p.x, p.y + 0.3, p.z), 2, 6, s, null, UP, 1.2); fx.rings.ground(p, 1.6 * s, 0.3, col, { ew: 0.12, trail: 0.4, flags: 0 }); } };
K.meteor_strike = (fx, p) => { const c = ctx(fx, p, null, 5); return fx.meteor({ target: vec(c.x, c.y, c.z), radius: c.R, delay: p.delay ?? 0.9, scale: c.R / 3, dir: c.f, color: p.color }); };
K.ice_spears = {                     // ice spears rain down over the point and burst up from the ground
  name: 'ice_spears', fade: 0.2, group: 'Starcaller',
  init(T) { ctx(T.fx, T.p, T.v.c = {}, 3.6); T.dur = T.p.dur ?? 1; T.v.next = 0; decal(T.fx, { pos: vec(T.v.c.x, T.v.c.y, T.v.c.z), radius: T.v.c.R * 1.1, kind: 'frost', dur: 4 }); },
  tick(T, dt) {
    const fx = T.fx, v = T.v, c = v.c;
    if (T.stopping) return;
    v.next -= dt;
    while (v.next <= 0) {
      v.next += 0.08;
      const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * c.R, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      fx.projectile({ from: vec(x - 2, c.y + 9, z - 1), to: vec(x, c.y + 0.2, z), kind: 'lance', speed: 30, scale: 0.8 * c.s, impact: false, onHit: q => { fx.meshes.spikeRings(q.x, c.y, q.z, [[0.1, 3, 1.2], [0.5, 5, 0.8]], c.s, { speed: 40, life: [1.0, 1.3] }); fx.at(FROST.flash, q, 1.2 * c.s, null); fx.sphere(FROST.shard, 8, q, 2, 5, c.s, null, UP, 1.2); } });
    }
  },
};
K.rune_circle = { ...MYSTIC.rune_detonation, name: 'rune_circle', init(T) { if (T.p.dur != null) T.p = { ...T.p, delay: T.p.dur * 0.6 }; MYSTIC.rune_detonation.init(T); } };
K.void_implosion = { ...MYSTIC.black_hole, name: 'void_implosion', init(T) { T.p = { ...T.p, dur: T.p.dur ?? 0.9 }; MYSTIC.black_hole.init(T); } };
K.giant_lightning = (fx, p) => MYSTIC.punishing_bolt(fx, p);
K.overload = (fx, p) => { const c = ctx(fx, p); fx.play('awaken_aura', { ...p, color: p.color ?? 0xc070ff, scale: 0.7 * c.s }); const att = p.attach ?? p.follow ?? p.unit; if (att?.isObject3D) fx.aura({ attach: att, kind: 'overload', dur: p.dur ?? 6 }); };

// ------------------------------------------------------------------ Pistoleer
K.barrage = { ...GUNNER.catastrophe, name: 'barrage', init(T) { GUNNER.catastrophe.init(T); const d = T.p.dur ?? 1.6; T.v.count = Math.round(6 + d * 8); T.dur = 0.5 + d + 0.3; T.v.dt = d / T.v.count; }, tick(T) {
  const fx = T.fx, c = T.v.c;
  while (T.v.i < T.v.count && T.age > 0.5 + T.v.i * T.v.dt) {
    const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * c.R, x = c.tx + Math.cos(a) * r, z = c.tz + Math.sin(a) * r;
    fx.beam({ from: vec(x - c.f.x * 4, c.ty + 18, z - c.f.z * 4), to: vec(x, c.ty, z), kind: 'tracer', color: [2.6, 1.6, 0.8], width: 0.2, speed: 120, length: 6, dur: 0.3 });
    fx.task(DELAY_EXPL, { pos: vec(x, c.ty, z), delay: 0.15, s: 0.8 * c.s });
    T.v.i++;
  }
} };
const DELAY_EXPL = { name: 'dExpl', init(T) { T.dur = T.p.delay; }, stop(T) { explosion(T.fx, T.pos, T.p.s, 'fire'); } };
K.bullet_impact = (fx, p) => { const c = ctx(fx, p, null, 2.4), s = c.R / 2.4; for (let i = 0; i < 6; i++) { const a = fx.r(0, TAU), r = Math.sqrt(Math.random()) * c.R * 0.7; hit(fx, { pos: vec(c.x + Math.cos(a) * r, c.y + fx.r(0.4, 1.4), c.z + Math.sin(a) * r), dir: c.f, scale: 0.7 * s }); } fx.radial(PHYS.dust, 8, vec(c.x, c.y, c.z), 1, 3, 0.2, 1, s, null, 0.4, 0.2); decal(fx, { pos: vec(c.x, c.y, c.z), radius: c.R * 0.5, kind: 'scorch', dur: 4 }); };
K.crosshair = (fx, p) => { const c = ctx(fx, p, null, 2.4); fx.at(CROSSHAIR, vec(c.x, c.y + 0.07, c.z), c.R / 2.4, tc(c.tint, 0xff3a2a, 1.4)); fx.telegraph({ shape: 'circle', pos: vec(c.x, c.y, c.z), radius: c.R * 0.5, color: 'red', dur: 0.4, detonate: false, intensity: 0.6 }); };
K.flare_shot = (fx, p) => { const c = ctx(fx, p, null, 1); GUNNER.muzzle_flash(fx, { ...p, weapon: 'pistol', color: p.color ?? 0xff4a2a }); fx.projectile({ from: vec(c.x + c.f.x * 0.8, c.y + 1.3, c.z + c.f.z * 0.8), dir: vec(c.f.x * 0.4, 1, c.f.z * 0.4), kind: 'bolt', color: tc(c.tint, 0xff4a2a, 2), speed: 18, range: 9, scale: 0.8, impact: false, onHit: q => { fx.at(GEN.bigFlash, q, 0.3, [1, 0.3, 0.2]); fx.sphere(GEN.sparkLong, 30, q, 2, 6, 1, [1, 0.4, 0.2]); } }); };
K.gun_spin = { ...AWAKEN.awk_bullet_hell, name: 'gun_spin', init(T) { AWAKEN.awk_bullet_hell.init(T); T.dur = 0.9; } };
K.shotgun_blast = (fx, p) => { const c = ctx(fx, p, null, 5.2), s = c.s; GUNNER.muzzle_flash(fx, { ...p, weapon: 'shotgun' }); const arc = (p.arc ?? 60) > 6.3 ? (p.arc ?? 60) * Math.PI / 180 : p.arc; const o = fx.o(s, [1, 0.8, 0.5]); for (let i = 0; i < fx.n(18); i++) { const a = (Math.random() - 0.5) * arc, d = fx.r(0.5, 1) * c.R; const x = c.x + (c.f.x * Math.cos(a) + c.rt.x * Math.sin(a)) * d, z = c.z + (c.f.z * Math.cos(a) + c.rt.z * Math.sin(a)) * d; o.dt = d / 90; fx.spawn(GEN.flash, x, c.y + fx.r(0.4, 1.4), z, 0, 0, 0, o); } fx.telegraph({ shape: 'cone', pos: vec(c.x, c.y, c.z), dir: c.f, radius: c.R, angle: arc, color: [1, 0.55, 0.15], dur: 0.12, detonate: true, intensity: 0.5 }); };
K.sniper = GUNNER.sniper_round;

// ------------------------------------------------------------------ Bladedancer
K.blade_merge = (fx, p) => { const c = ctx(fx, p, null, 1.5), col = tc(c.tint, BLADEC, 1.8), h = vec(c.x, c.y + 1.2, c.z); for (let i = 0; i < fx.n(30); i++) fx.spawn(GEN.converge, h.x, h.y, h.z, fx.r(1, 1.8) * c.s, fx.r(0, TAU), 6, fx.o(c.s, col)); fx.at(GEN.starFlash, h, 1.6 * c.s, col, { dt: 0.2 }); fx.at(GEN.flare, h, 2 * c.s, col, { dt: 0.2, rot: 0 }); };
K.blade_return = (fx, p) => { const c = ctx(fx, p, null, 1, 9), col = tc(c.tint, BLADEC, 2); for (let k = -1; k <= 1; k++) { const from = vec(c.x + c.f.x * c.L + c.rt.x * k * 1.2, c.y + 1.1, c.z + c.f.z * c.L + c.rt.z * k * 1.2); fx.projectile({ from, to: vec(c.x + c.rt.x * k * 0.3, c.y + 1.1, c.z + c.rt.z * k * 0.3), kind: 'glaive', color: col, scale: 0.6 * c.s, speed: 30, impact: false }); } };
K.blade_vortex = { ...WARRIOR.whirlwind, name: 'blade_vortex', init(T) { WARRIOR.whirlwind.init(T); T.v.col = tc(T.v.c.tint, BLADEC, 2.2); } };
K.shadow_burst = (fx, p) => { const c = ctx(fx, p, null, 1.2), up = vec(c.x, c.y + 1, c.z); fx.at(DARK.flash, up, 1.6 * c.R / 1.2, tc(c.tint, BLADEC, 1)); fx.radial(DARK.smoke, 10, vec(c.x, c.y, c.z), 1, 2.5, 0.4, 1.2, c.s, null, 0.2, 0.5); fx.sphere(DARK.spark, 14, up, 2, 6, c.s, null); };
K.shadow_dash = (fx, p) => { const c = ctx(fx, p, null, 1, 7); SHADE.blade_dash(fx, { ...p, target: vec(c.x + c.f.x * c.L, c.y, c.z + c.f.z * c.L), color: p.color ?? BLADEC }); };
K.surge_slash = (fx, p) => { const c = ctx(fx, p, null, 1, 7), col = tc(c.tint, BLADEC, 2.4); slash(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, style: 'thrust', radius: 1, length: c.L, width: 0.35 * c.s, color: [2.4, 2.4, 2.8], intensity: 1, dur: 0.35, height: 1.0 }); slash(fx, { pos: vec(c.x + c.f.x * c.L * 0.5, c.y, c.z + c.f.z * c.L * 0.5), dir: c.f, style: 'x', radius: 2 * c.s, color: col, intensity: 1, delay: 0.1 }); };
K.surge_burst = (fx, p) => { const c = ctx(fx, p, null, 3.4), s = c.R / 3.4, col = tc(c.tint, BLADEC, 2), pos = vec(c.x, c.y, c.z); slash(fx, { pos, dir: c.f, style: 'x', radius: c.R, color: col, intensity: 1 }); slash(fx, { pos, dir: c.rt, style: 'x', radius: c.R * 0.8, color: [2.2, 2.2, 2.6], intensity: 1, delay: 0.06, glow: false }); shockwave(fx, { pos, radius: c.R * 1.5, color: col, dur: 0.45, height: 2 * s }); fx.at(GEN.bigFlash, vec(c.x, c.y + 1.2, c.z), 0.5 * s, col); fx.shake(0.3 * s, pos); };
K.moon_ring = (fx, p) => { const c = ctx(fx, p, null, 4.6), col = tc(c.tint, 0xd8e0f0, 2.2); slash(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, style: 'spin', radius: c.R, color: col, intensity: 1, width: c.R * 0.3, dur: 0.45 }); shockwave(fx, { pos: vec(c.x, c.y, c.z), radius: c.R * 1.2, color: col, dur: 0.4, wall: false, dust: false }); fx.radial(GEN.star, 20, vec(c.x, c.y + 1, c.z), c.R, c.R * 1.6, 0.2, 1, c.s, col); };

// ------------------------------------------------------------------ Demonbound
K.claw_slash = (fx, p) => { const c = ctx(fx, p, null, 3.6); slash(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, style: 'claw', radius: c.R, arc: p.arc ?? 160, color: tc(c.tint, DEMONC, 2.4), intensity: 1, flip: p.flip }); };
K.dark_aura = (fx, p) => { const c = ctx(fx, p, null, 1.6), col = tc(c.tint, 0x8a3cff, 1.4); SHADE.dark_burst(fx, { ...p, radius: c.R * 1.2 }); const att = p.attach ?? p.follow ?? p.unit; if (att?.isObject3D) fx.aura({ attach: att, kind: 'demon', color: col, dur: p.dur ?? 2 }); };
K.demon_crater = (fx, p) => SHADE.demonic_slam(fx, p);
K.demon_eye = (fx, p) => { const c = ctx(fx, p, null, 1.6), col = tc(c.tint, DEMONC, 2.2), h = vec(c.x, c.y + 1.75, c.z); fx.at(GEN.flare, h, 2.4 * c.s, col, { rot: 0 }); fx.at(GEN.flash, h, 1.4 * c.s, col); fx.at(GEN.ringThin, vec(c.x, c.y + 0.06, c.z), c.R / 5, col, { life: 0.5 }); fx.sphere(DARK.ember, 16, h, 1, 3, c.s, null); };
K.demon_howl = (fx, p) => SHADE.fear_howl(fx, { ...p, color: p.color ?? DEMONC });
K.demon_spikes = (fx, p) => { const c = ctx(fx, p, null, 4), col = tc(c.tint, DEMONC, 1.4); fx.meshes.spikeRings(c.x, c.y, c.z, [[c.R * 0.25, 7, 1.4], [c.R * 0.55, 11, 1.2], [c.R * 0.85, 16, 1.0]], 1, { color: [0.3, 0.03, 0.06], glow: [col[0] * 1.2, col[1] * 1.2, col[2] * 1.2], fres: 0.5, life: [(p.dur ?? 1.2) * 0.8, (p.dur ?? 1.2)], speed: 22 }); decal(fx, { pos: vec(c.x, c.y, c.z), radius: c.R, kind: 'quake', dur: 3, color: col }); shockwave(fx, { pos: vec(c.x, c.y, c.z), radius: c.R * 1.2, color: col, dur: 0.4 }); fx.shake(0.3, vec(c.x, c.y, c.z)); };
K.demon_thrust = (fx, p) => { const c = ctx(fx, p, null, 1, 6.5), col = tc(c.tint, DEMONC, 2.4); slash(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, style: 'thrust', radius: 1, length: c.L, width: 0.8 * c.s, color: col, intensity: 1, dark: true, dur: 0.35 }); slash(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, style: 'thrust', radius: 1, length: c.L, width: 0.3 * c.s, color: col, intensity: 1, dur: 0.3, glow: false }); fx.meshes.spikeLine(c.x + c.f.x * 1.5, c.y, c.z + c.f.z * 1.5, c.f.x, c.f.z, c.L - 1, Math.round(c.L), 0.7 * c.s, { color: [0.3, 0.03, 0.06], glow: [col[0], col[1], col[2]], fres: 0.5, speed: 30, life: 0.9, spread: 0.4 }); };
K.demon_wings = (fx, p) => SHADE.hellfire_wings(fx, { ...p, len: p.len ?? (p.r ?? 5) * 1.3 });
K.abyss_eruption = (fx, p) => { const c = ctx(fx, p, null, 7), s = c.R / 7, g = vec(c.x, c.y, c.z), col = tc(c.tint, DEMONC, 1.6); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, r = i ? c.R * 0.55 : 0; fx.meshes.pillars.spawn(g.x + Math.cos(a) * r, g.y, g.z + Math.sin(a) * r, 1.1 * s, 9 * s, 1.1, 2, [2.2, 0.1, 0.3], 0.06, 1, i * 0.04); } fx.meshes.spikeRings(g.x, g.y, g.z, [[c.R * 0.35, 10, 2], [c.R * 0.7, 16, 1.5], [c.R, 22, 1.1]], 1, { color: [0.3, 0.02, 0.06], glow: [1.8, 0.1, 0.3], fres: 0.5, life: [1.3, 1.8], speed: 30 }); shockwave(fx, { pos: g, radius: c.R * 1.8, color: col, dur: 0.7, height: 3.2 * s }); fx.at(GEN.bigFlash, vec(g.x, g.y + 2, g.z), 1.6 * s, [1, 0.15, 0.4]); fx.sphere(DARK.flame, 80, vec(g.x, g.y + 2, g.z), 3, 10, s, null, UP, 1.2); decal(fx, { pos: g, radius: c.R * 0.8, kind: 'crater', dur: 9, color: [1.8, 0.2, 0.4] }); decal(fx, { pos: g, radius: c.R, kind: 'demon', dur: 3, color: col }); fx.flash(0.4, [0.9, 0.1, 0.3]); fx.shake(1, g); fx.aberr(0.8); };
K.blood_burst = (fx, p) => { const c = ctx(fx, p, null, 4.4), s = c.R / 4.4, pos = vec(c.x, c.y, c.z), up = vec(c.x, c.y + 1, c.z); fx.at(CRIM.flash, up, 2.6 * s, null); fx.sphere(PHYS.blood, 40, up, 3, 9, s, null, UP, 1.2); fx.sphere(CRIM.spark, 30, up, 4, 10, s, null); shockwave(fx, { pos, radius: c.R * 1.3, color: [1.8, 0.1, 0.15], dur: 0.45, height: 1.8 }); decal(fx, { pos, radius: c.R * 0.6, kind: 'blood', dur: 8 }); };
K.blood_pillar = (fx, p) => fx.play('blood_pillars', { ...p, count: p.count ?? 3, radius: p.radius ?? p.r ?? 3.2, target: undefined });
K.blood_whirl = { ...WARRIOR.whirlwind, name: 'blood_whirl', init(T) { WARRIOR.whirlwind.init(T); T.v.col = tc(T.v.c.tint, BLOODC, 2.4); } };
K.soul_drain = (fx, p) => { const c = ctx(fx, p, null, 4.4), s = c.R / 4.4, h = vec(c.x, c.y + 1.1, c.z); for (let i = 0; i < fx.n(50); i++) fx.spawn(SOUL_IN, h.x, c.y + fx.r(0.3, 1.8), h.z, fx.r(0.7, 1) * c.R, fx.r(0, TAU), fx.r(2, 4), fx.o(s, tc(c.tint, 0xa050ff, 1))); fx.at(DARK.flash, h, 1.8 * s, null, { dt: 0.5 }); decal(fx, { pos: vec(c.x, c.y, c.z), radius: c.R, kind: 'swirl', dur: 1.2, color: tc(c.tint, 0xa050ff, 1.2) }); };

// ------------------------------------------------------------------ Gorrath (legion boss) — axe, ghost phase, soulfire, rift
K.axe_cleave = (fx, p) => {          // giant axe falls along the lane (rect len × width)
  const c = ctx(fx, p, null, 3, 11), s = c.s, col = tc(c.tint, 0xff6a2a, 1.4), W = c.W ?? 3.6;
  slash(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, style: 'v', radius: Math.min(c.L * 0.55, 6.5), width: W * 0.8, color: [2.4, 1.6, 1.1], intensity: 1, dur: 0.4, forward: 1.2, height: 0.6 });
  BOSS.axe_shockwave(fx, { ...p, len: Math.max(1, c.L - 2.5), radius: W });
};
K.axe_sweep = (fx, p) => { const c = ctx(fx, p, null, 7.5), s = c.R / 7.5; slash(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, style: 'h', radius: c.R, arc: p.arc ?? p.angle ?? 190, color: tc(c.tint, 0xffc080, 2.2), intensity: 1, width: c.R * 0.3, dur: 0.45, height: 1.4, flip: p.flip }); fx.radial(PHYS.dustBig, 16, vec(c.x, c.y, c.z), c.R * 0.8, c.R * 1.3, 0.2, 1, s, null, c.R * 0.35, 0.2); fx.shake(0.25, vec(c.x, c.y, c.z)); };
K.axe_spin = (fx, p) => { const c = ctx(fx, p, null, 8.5), s = c.R / 8.5, pos = vec(c.x, c.y, c.z); slash(fx, { pos, dir: c.f, style: 'spin', radius: c.R, color: tc(c.tint, 0xffa060, 2.2), intensity: 1, width: c.R * 0.28, dur: 0.55, height: 1.3 }); slash(fx, { pos, dir: c.rt, style: 'spin', radius: c.R * 0.8, color: [2, 1.4, 1], intensity: 1, width: c.R * 0.15, dur: 0.5, delay: 0.1, glow: false, height: 1.1 }); shockwave(fx, { pos, radius: c.R * 1.15, color: [1.8, 1.1, 0.6], dur: 0.5, height: 1.6 * s }); fx.radial(PHYS.dustBig, 24, pos, c.R, c.R * 1.5, 0.2, 1, s, null, c.R * 0.5, 0.2); fx.shake(0.45, pos); };
K.stomp_quake = (fx, p) => { const c = ctx(fx, p, null, 4.5); groundSmash(fx, c.x, c.y, c.z, c.R, tc(c.tint, 0xff7a3a, 1.2), { decal: 'quake', decalR: 1.5, rocks: 16, shake: 0.5 }); };
K.tyrant_wrath = (fx, p) => {        // arena-wide wrath: horn flare, fire rings, eruptions everywhere
  const c = ctx(fx, p, null, 16), s = c.R / 16, g = vec(c.x, c.y, c.z), col = tc(c.tint, 0xff4a1a, 1.6);
  fx.at(GEN.bigFlash, vec(c.x, c.y + 5, c.z), 2.4 * s, [1.2, 0.5, 0.2]);
  for (let k = 0; k < 4; k++) shockwave(fx, { pos: g, radius: c.R * (0.6 + k * 0.25), color: col, dur: 0.8, delay: k * 0.12, height: 3.5 - k * 0.6 });
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + 0.2, r = c.R * (0.35 + (i % 3) * 0.22); fx.task(DELAY_EXPL, { pos: vec(c.x + Math.cos(a) * r, c.y, c.z + Math.sin(a) * r), delay: 0.1 + i * 0.05, s: 1.6 * s }); }
  decal(fx, { pos: g, radius: c.R * 0.6, kind: 'crater', dur: 10, color: col });
  fx.flash(0.5, [1.2, 0.5, 0.25]); fx.shake(1, g); fx.aberr(1); fx.radialBlur(0.6);
};
K.rift_eruption = (fx, p) => { const c = ctx(fx, p, null, 3.4), s = c.R / 3.4, col = tc(c.tint, 0xa040ff, 1.8), g = vec(c.x, c.y, c.z); fx.meshes.pillars.spawn(c.x, c.y, c.z, c.R * 0.45, 8 * s, 0.8, 3, [col[0] * 1.2, col[1] * 1.2, col[2] * 1.2], 0.04); fx.meshes.spikeRings(c.x, c.y, c.z, [[c.R * 0.3, 6, 1.4], [c.R * 0.7, 10, 1.0]], 1, { color: [0.2, 0.1, 0.26], glow: [1.4, 0.4, 2.2], fres: 0.5, life: [1.0, 1.3], speed: 30 }); fx.at(ARC.flash, vec(c.x, c.y + 1, c.z), 2.6 * s, null); fx.sphere(ARC.spark, 30, vec(c.x, c.y + 1, c.z), 4, 11, s, null, UP, 1.0); shockwave(fx, { pos: g, radius: c.R * 1.3, color: col, dur: 0.4 }); decal(fx, { pos: g, radius: c.R * 0.8, kind: 'quake', dur: 4, color: col }); };
K.spectral_axe = (fx, p) => {        // ghost phase: a translucent spectral axe slams the point
  const c = ctx(fx, p, null, 3), s = c.R / 3, col = tc(c.tint, GHOST, 1.8), g = vec(c.x, c.y, c.z);
  slash(fx, { pos: g, dir: c.f, style: 'v', radius: 3 * s, width: 1.2 * s, color: col, intensity: 1, dur: 0.35, height: 0.4, forward: -1.4 });
  fx.at(GEN.flash, vec(c.x, c.y + 0.8, c.z), 2.4 * s, col);
  shockwave(fx, { pos: g, radius: c.R * 1.3, color: col, dur: 0.4, wall: true, height: 1.2, dust: false });
  fx.sphere(SPIRIT_UP, 10, vec(c.x, c.y + 0.5, c.z), 1, 3, s, null, UP, 1.2);
  decal(fx, { pos: g, radius: c.R * 0.8, kind: 'crack', dur: 3, color: col });
};
K.ghost_slash = (fx, p) => { const c = ctx(fx, p, null, 6); slash(fx, { pos: vec(c.x, c.y, c.z), dir: c.f, style: 'h', radius: c.R, arc: p.arc ?? 120, color: tc(c.tint, GHOST, 2.2), intensity: 1, width: c.R * 0.35, dur: 0.4, height: 1.3 }); fx.sphere(SPIRIT_UP, 8, vec(c.x + c.f.x * c.R * 0.6, c.y + 1, c.z + c.f.z * c.R * 0.6), 1, 3, c.s, null); };
K.ghost_nova = (fx, p) => { const c = ctx(fx, p, null, 12), s = c.R / 12, g = vec(c.x, c.y, c.z), col = tc(c.tint, GHOST, 1.6); for (let k = 0; k < 3; k++) shockwave(fx, { pos: g, radius: c.R * (0.7 + k * 0.2), color: col, dur: 0.7, delay: k * 0.1, height: 2.6, dust: false }); fx.at(GEN.bigFlash, vec(c.x, c.y + 3, c.z), 1.4 * s, col); fx.radial(SPIRIT_UP, 30, vec(c.x, c.y + 0.5, c.z), 4, 10, 0.5, 2, 1.4 * s, null, 1); fx.radial(GHOST_FLAME, 40, vec(c.x, c.y + 0.3, c.z), 6, 14, 0.5, 2, s * 1.5, null, 1); fx.flash(0.2, [0.5, 0.8, 1.1]); fx.shake(0.5, g); };
K.ghost_ring = (fx, p) => { const c = ctx(fx, p, null, 12), g = vec(c.x, c.y, c.z), col = tc(c.tint, GHOST, 1.8); shockwave(fx, { pos: g, radius: c.R, from: c.R * 0.55, color: col, dur: 0.6, height: 2.4, ease: 2 }); fx.radial(GHOST_FLAME, 50, vec(c.x, c.y + 0.3, c.z), 1, 3, 0.5, 2, 1.4, null, c.R * 0.85); };
K.dread_pulse = (fx, p) => { const c = ctx(fx, p, null, 14), g = vec(c.x, c.y, c.z); shockwave(fx, { pos: g, radius: c.R, color: [0.6, 0.3, 1.2], dur: 0.9, height: 1.2, dust: false }); fx.radial(SPIRIT_UP, 16, vec(c.x, c.y + 1, c.z), 3, 7, 0.5, 1.5, 1.2, null, 1); fx.radialBlur(0.25); fx.flash(0.08, [0.5, 0.3, 0.9]); };
K.soulfire_pulse = (fx, p) => { const c = ctx(fx, p, null, 3.6), s = c.R / 3.6, g = vec(c.x, c.y, c.z), col = tc(c.tint, SOUL, 1.8); fx.meshes.pillars.spawn(c.x, c.y, c.z, c.R * 0.5, 6 * s, 0.7, 3, col, 0.05); fx.radial(GHOST_FLAME, 30, vec(c.x, c.y + 0.3, c.z), 2, 6, 1, 4, s, null, 0.3); shockwave(fx, { pos: g, radius: c.R * 1.2, color: col, dur: 0.4, wall: false }); decal(fx, { pos: g, radius: c.R * 0.8, kind: 'scorch', dur: 5, color: col }); };
K.soulfire_nova = (fx, p) => { const c = ctx(fx, p, null, 14), s = c.R / 14, g = vec(c.x, c.y, c.z), col = tc(c.tint, SOUL, 1.8); for (let k = 0; k < 3; k++) shockwave(fx, { pos: g, radius: c.R * (0.7 + k * 0.25), color: col, dur: 0.8, delay: k * 0.1, height: 3 }); fx.radial(GHOST_FLAME, 90, vec(c.x, c.y + 0.3, c.z), 6, 16, 1, 4, 1.4 * s, null, 1); fx.at(GEN.bigFlash, vec(c.x, c.y + 3, c.z), 2 * s, col); decal(fx, { pos: g, radius: c.R * 0.7, kind: 'scorch', dur: 8, color: col }); fx.flash(0.35, [0.5, 0.6, 1.2]); fx.shake(0.8, g); };

// ------------------------------------------------------------------ zones used by kits (Z(..., { kind }))
function zoneLike(base, name, color) { return { ...base, name, init(T) { T.p = { ...T.p, color: T.p.color ?? color }; base.init(T); } }; }
K.zone_blades = { ...SHADE.blade_storm, name: 'zone_blades', init(T) { SHADE.blade_storm.init(T); T.dur = T.p.dur ?? 3; } };
K.zone_hellfire = zoneLike(AMBIENT.zone_fire, 'zone_hellfire', 0xa020ff);
K.zone_blood = zoneLike(AMBIENT.zone_fire, 'zone_blood', 0xc0101a);
K.zone_barrage = { ...K.barrage, name: 'zone_barrage' };
K.zone_notes = AMBIENT.zone_music;
K.zone_meteor = { ...MYSTIC.meteor_rain, name: 'zone_meteor' };
K.zone_rune = zoneLike(AMBIENT.zone_generic, 'zone_rune', 0xc070ff);
K.zone_arcane = K.zone_rune;
K.blood = K.blood_burst; K.frost = MYSTIC.frost_nova; K.void = K.void_implosion;

for (const k in K) K[k].group = K[k].group || (/^zone_/.test(k) ? 'Zones' : /axe|ghost|spectral|soulfire|dread|tyrant|rift_erup|stomp/.test(k) ? 'Bosses' : 'Kits');
export const GAME = K;
