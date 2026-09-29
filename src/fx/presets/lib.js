// Building blocks shared by the preset library: parameter parsing (feet position, facing, target point, scale,
// colour), and composite helpers (ground smash, sky bolt, pillars, novas, lines of effects).
import * as THREE from 'three';
import { S, R } from '../textures.js';
import { P } from '../particles.js';
import { GEN, PHYS, FIRE, FROST, HOLY, STORM, CHI, DARK, ARC, HEAL, MUSIC, WATER, POI, CRIM, AMB } from '../ptypes.js';
import { col, v3, TAU, hue, UP, hasCol } from '../util.js';
import { shockwave, decal, explosion, meteorImpact, hit, burst, slash, angRad } from '../prims.js';

export { S, R, P, GEN, PHYS, FIRE, FROST, HOLY, STORM, CHI, DARK, ARC, HEAL, MUSIC, WATER, POI, CRIM, AMB, TAU, UP, col, hue, v3, shockwave, decal, explosion, meteorImpact, hit, burst, slash, angRad };

const _v = new THREE.Vector3(), _w = new THREE.Vector3();

/**
 * Parse common preset params into a context object (fields reused — copy what you keep).
 *   pos (feet) → x, y (ground), z · dir → f (unit), rt (right) · target → tx, tz (default pos + f·range)
 *   scale (× big) → s · color → tint (linear rgb or null) · radius|r → R · len|length → L · width → W · dur
 */
export function ctx(fx, p, o, defR = 3, defL = 8, range = 8) {
  o = o || {};
  v3(p.pos ?? p.from ?? p.target ?? p.attach ?? p.follow, _v);
  if (p.x !== undefined && p.pos === undefined) _v.set(p.x, p.y ?? 0, p.z ?? 0);
  o.x = _v.x; o.z = _v.z; o.y = fx.gy(_v.x, _v.z, _v.y); o.y0 = _v.y;
  o.f = o.f || new THREE.Vector3(); o.rt = o.rt || new THREE.Vector3();
  fx._dir(p.dir ?? p.facing, o.f); o.rt.set(-o.f.z, 0, o.f.x);
  o.s = (p.scale ?? 1) * (p.big ? 1.35 : 1);
  o.R = (p.radius ?? p.r ?? defR * o.s);
  o.L = (p.len ?? p.length ?? defL * o.s);
  o.W = p.width ?? null;
  o.tint = hasCol(p.color) ? col(p.color, 1, o.tintA || (o.tintA = [0, 0, 0])) : null;
  if (p.target !== undefined && p.target !== null) { v3(p.target, _w); o.tx = _w.x; o.tz = _w.z; }
  else { o.tx = o.x + o.f.x * range * o.s; o.tz = o.z + o.f.z * range * o.s; }
  o.ty = fx.gy(o.tx, o.tz, o.y);
  return o;
}
/** colour: user tint if given else default hex → linear rgb × k (new array) */
export function tc(c, def, k = 1) { const o = c ? [c[0], c[1], c[2]] : col(def, 1, [0, 0, 0]); o[0] *= k; o[1] *= k; o[2] *= k; return o; }
export const vec = (x, y, z) => new THREE.Vector3(x, y, z);

/** heavy ground impact: flash, shockwave + wall, radial crack/crater decal, rock debris, dust ring, shake */
export function groundSmash(fx, x, y, z, R, color, o = {}) {
  const s = R / 3.5, p = vec(x, y, z), c = color;
  fx.at(GEN.bigFlash, p, Math.min(s, 2) * 0.5, c, null, 0, 0.6, 0);
  fx.at(GEN.flare, p, Math.min(s, 2) * 1.4, c, { rot: 0 }, 0, 0.5, 0);
  shockwave(fx, { pos: p, radius: R * (o.ring ?? 1.9), color: [c[0] * 1.3, c[1] * 1.3, c[2] * 1.3], dur: 0.45 + R * 0.03, height: o.wallH ?? 1.2 * s });
  if (o.second !== false) shockwave(fx, { pos: p, radius: R * 1.2, color: [1.4, 1.25, 1.0], dur: 0.35, wall: false, dust: false, delay: 0.05 });
  decal(fx, { pos: p, radius: R * (o.decalR ?? 1.05), kind: o.decal ?? 'crater', dur: o.decalDur ?? 8, color: [c[0] * 1.5, c[1] * 1.5, c[2] * 1.5] });
  if (o.debris !== false) fx.meshes.debris(x, y + 0.2, z, Math.round((o.rocks ?? 12) * Math.min(1.6, s)), s, o.rockSpeed ?? 8, { gy: y, glow: [c[0] * 1.2, c[1] * 1.2, c[2] * 1.2] });
  fx.radial(PHYS.dustBig, 14 + R * 3, p, R * 1.2, R * 2.4, 0.3, 1.6, s, null, 0.3, 0.3);
  fx.radial(PHYS.rockBit, 10 + R * 2, p, 2, 6, 4, 9, s, null, 0.2, 0.3);
  fx.radial(GEN.spark, 16 + R * 4, p, 4, 12, 3, 8, s, hue(c, [0, 0, 0]), 0.3, 0.3);
  if (o.shake !== 0) fx.shake(o.shake ?? Math.min(0.9, 0.25 + R * 0.06), p);
}

/** lightning strike from the sky at (x, z): bolt beam + flash + ground ring + scorch */
export function skyBolt(fx, x, y, z, s = 1, c = [0.6, 0.8, 2.0], o = {}) {
  const top = vec(x + fx.r(-1.5, 1.5) * s, y + 16 * s, z + fx.r(-1.5, 1.5) * s), bot = vec(x, y + 0.05, z);
  fx.lightning({ from: top, to: bot, color: c, width: 0.55 * s, dur: o.dur ?? 0.32, strands: 5, impact: false });
  fx.at(STORM.flash, bot, s * 2.2, null, null, 0, 0.6, 0);
  fx.at(GEN.flare, bot, s * 2.6, hue(c, [0, 0, 0]), { rot: 0 }, 0, 0.5, 0);
  fx.meshes.pillars.spawn(x, y, z, 0.55 * s, 12 * s, 0.35, 3, [c[0] * 1.2, c[1] * 1.2, c[2] * 1.2], 0.05);
  shockwave(fx, { pos: bot, radius: 3.2 * s, color: [c[0] * 1.2, c[1] * 1.2, c[2] * 1.2], dur: 0.35, wall: false, dustCount: 6 });
  fx.radial(STORM.spark, 26, bot, 4, 10, 2, 7, s, null, 0.2, 0.2);
  if (o.decal !== false) decal(fx, { pos: bot, radius: 1.8 * s, kind: 'electric', dur: 2.5, color: [c[0] * 1.2, c[1] * 1.2, c[2] * 1.2] });
  if (o.shake !== 0) fx.shake(o.shake ?? 0.25 * s, bot);
}

/** iterate n points along a line from (x,z) in direction f over length L: fn(px, pz, u, i) */
export function along(x, z, f, L, n, fn) { for (let i = 0; i < n; i++) { const u = n > 1 ? i / (n - 1) : 0; fn(x + f.x * L * u, z + f.z * L * u, u, i); } }

/** ring of glowing motes rising (buff pulses, heals) */
export function risingRing(fx, x, y, z, R, pr, n, tint, s = 1, up = [1, 2.5]) {
  const o = fx.o(s, tint);
  for (let i = 0; i < fx.n(n); i++) { const a = (i + Math.random()) / n * TAU, r = R * (0.85 + Math.random() * 0.25); fx.spawn(pr, x + Math.cos(a) * r, y + 0.1, z + Math.sin(a) * r, 0, fx.r(up[0], up[1]), 0, o); }
}
/** flat glowing ground disc + thin ring pulse */
export function groundPulse(fx, x, y, z, R, tint, k = 1) {
  const p = vec(x, y + 0.06, z);
  fx.at(GEN.flatFlash, p, R / 3 * k, tint);
  fx.at(GEN.ringThin, p, R / 7, tint, { life: 0.55 });
}
/** a pillar of light / energy (cylinder mesh + base glow + particles) */
export function lightPillar(fx, x, y, z, R, H, c, dur = 0.9, style = 0, delay = 0) {
  fx.meshes.pillars.spawn(x, y, z, R, H, dur, style, c, 0.08, 1, delay);
  const p = vec(x, y, z);
  const o = fx.o(R / 0.8, hue(c, [0, 0, 0])); o.dt = delay;
  fx.spawn(GEN.flatGlow, x, y + 0.06, z, 0, 0, 0, o);
  fx.spawn(GEN.flash, x, y + 1, z, 0, 0, 0, o);
  return p;
}
export { _v as tmpV };
