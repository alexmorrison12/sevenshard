// Forest & dark-magic props for Thornwood (merged into a FieldKit; local +Z = front).
//   web, cocoon, eggSacs, owl, thornArch, rootArch, fallenGiant (walkable trunk), hollowMouth, glowShrooms,
//   moonflowers, candles, altar, cauldron, stiltHut, sawpit, bonePile, runeStone
import * as THREE from 'three';
import { RNG, Simplex, clamp } from '../../core/noise.js';
import { blob, tube, linColor } from '../../engine/geom.js';
import { box, cyl, cone, sphere, gableRoof, M, Frame } from '../kit.js';
import * as S from '../shapes.js';
import * as F from './props.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** spider web: radial spokes + spiral threads, as a disc of radius r centred at (x, y, z), facing rot (tilt tx) */
export function web(kit, x, y, z, rot = 0, { r = 2.2, spokes = 11, rings = 9, tilt = 0, tint = 0xc8d4dc, seed = 1, torn = 0.15, glow = 0.55 } = {}) {
  const rng = new RNG(seed), F0 = new Frame(x, y, z, rot);
  const base = F0.m.clone().multiply(M(0, 0, 0, 0, 1, 1, 1, tilt));
  const ang = []; for (let i = 0; i < spokes; i++) ang.push(i / spokes * TAU + rng.range(-0.12, 0.12));
  const R = ang.map(() => r * rng.range(0.8, 1.05));
  const thread = (g) => kit.glow(g, base, tint, glow);
  for (let i = 0; i < spokes; i++) thread(tube([V(0, 0, 0), V(Math.cos(ang[i]) * R[i], Math.sin(ang[i]) * R[i], 0)], [0.02, 0.02], 3, false));
  for (let k = 1; k <= rings; k++) {
    const f = k / (rings + 0.6);
    for (let i = 0; i < spokes; i++) {
      if (rng.chance(torn * f)) continue;
      const j = (i + 1) % spokes, a0 = ang[i], a1 = ang[j] + (j === 0 ? TAU : 0);
      const p0 = V(Math.cos(a0) * R[i] * f, Math.sin(a0) * R[i] * f, 0), p1 = V(Math.cos(a1) * R[j] * f, Math.sin(a1) * R[j] * f, 0);
      const mid = p0.clone().lerp(p1, 0.5).multiplyScalar(0.96);
      thread(tube([p0, mid, p1], [0.014, 0.014, 0.014], 3, false));
    }
  }
  // anchor threads to the ground
  for (const a of [-2.2, -0.9]) thread(tube([V(Math.cos(a) * r, Math.sin(a) * r, 0), V(Math.cos(a) * r * 1.5, Math.sin(a) * r - 1.2, 0)], [0.014, 0.014], 3, false));
}
export function cocoon(kit, x, y, z, { s = 1, hang = 1.5, tint = 0xdcd8cc } = {}) {
  kit.add('cloth', blob(0.3 * s, 1, d => 1 + Math.sin(d.y * 12) * 0.05, [1, 2.2, 1]), M(x, y - hang - 0.66 * s, z, x), { tint, ao: false });
  kit.add('paint', tube([V(x, y, z), V(x, y - hang, z)], [0.012, 0.012], 3, false), null, { tint: 0xe8ecf0, ao: false, cast: false, chunkAt: [x, z] });
}
export function eggSacs(kit, x, y, z, { n = 7, seed = 1 } = {}) {
  const r = new RNG(seed);
  for (let i = 0; i < n; i++) { const a = r.range(0, TAU), d = r.range(0, 0.9), s = r.range(0.18, 0.34); kit.add('paint', blob(s, 1, null, [1, 0.8, 1]), M(x + Math.cos(a) * d, y + s * 0.6, z + Math.sin(a) * d), { tint: r.pick([0xe8e4d0, 0xd8d4b8, 0xc8d0b0]), ao: false, cast: false }); }
  kit.add('paint', blob(1.1, 1, null, [1, 0.12, 1]), M(x, y + 0.05, z), { tint: 0xd8dcd8, ao: false, cast: false });
}
/** a perched owl (~0.5 m), facing rot */
export function owl(kit, x, y, z, rot = 0, { tint = 0x7a5a3a, s = 1 } = {}) {
  const F0 = new Frame(x, y, z, rot);
  kit.add('paint', blob(0.2 * s, 1, d => 1 + Math.max(0, -d.y) * 0.2, [1, 1.35, 0.95]), F0.at(0, 0.26 * s, 0), { tint, ao: false });
  kit.add('paint', blob(0.16 * s, 1, null, [1.1, 0.95, 1]), F0.at(0, 0.56 * s, 0.02), { tint: new THREE.Color(tint).multiplyScalar(1.15).getHex(), ao: false });
  kit.add('paint', blob(0.1 * s, 0, null, [1, 1.25, 0.4]), F0.at(0, 0.2 * s, 0.16 * s), { tint: 0xd8c8a8, ao: false, cast: false });
  for (const sd of [-1, 1]) {
    kit.glow(sphere(0.045 * s, 6, 4), F0.at(sd * 0.065 * s, 0.58 * s, 0.14 * s), 0xffc030, 2.2);
    kit.add('paint', cone(0.04 * s, 0.12 * s, 4, 1), F0.at(sd * 0.1 * s, 0.72 * s, 0.0, 0, 1, 1, 1, 0, -sd * 0.3), { tint, ao: false, cast: false });
  }
  kit.add('paint', cone(0.025 * s, 0.06 * s, 4, 1), F0.at(0, 0.52 * s, 0.16 * s, 0, 1, 1, 1, Math.PI / 2 + 0.4), { tint: 0xc8a040, ao: false, cast: false });
}
/** an arch of thorny bramble vines over a path; a→b are the two feet */
export function thornArch(kit, ax, az, bx, bz, H, { h = 5, seed = 1, tint = 0x3a2e24, thorn = 0x5a4a3a, leaf = 0x3a5a2a } = {}) {
  const rng = new RNG(seed), nz = new Simplex(seed);
  for (let v = 0; v < 5; v++) {
    const off = rng.range(-0.7, 0.7), pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, x = ax + (bx - ax) * t + off * Math.sin(t * Math.PI * 2 + v), z = az + (bz - az) * t + rng.range(-0.3, 0.3);
      const y = (H(ax, az) * (1 - t) + H(bx, bz) * t) + Math.sin(t * Math.PI) * h * (0.85 + v * 0.05) + nz.noise2(t * 4, v) * 0.35 - 0.2;
      pts.push(V(x, y, z));
    }
    kit.add('timber', tube(pts, pts.map((_, i) => 0.11 - 0.03 * Math.abs(i / 14 - 0.5)), 5, false), null, { tint, ao: false, chunkAt: [(ax + bx) / 2, (az + bz) / 2] });
    for (let i = 1; i < 14; i++) {
      const p = pts[i];
      for (let k = 0; k < 2; k++) { const d = V(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize(); kit.add('paint', cone(0.035, 0.22, 4, 1), new THREE.Matrix4().compose(p.clone().addScaledVector(d, 0.1), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d), V(1, 1, 1)), { tint: thorn, ao: false, cast: false, chunkAt: [(ax + bx) / 2, (az + bz) / 2] }); }
      if (rng.chance(0.4)) kit.add('paint', blob(0.18, 0, null, [1.3, 0.5, 1]), M(p.x, p.y + 0.08, p.z, rng.range(0, 6)), { tint: leaf, ao: false, cast: false, chunkAt: [(ax + bx) / 2, (az + bz) / 2] });
    }
  }
  kit.block(S.circle(ax, az, 0.9), 0.3); kit.block(S.circle(bx, bz, 0.9), 0.3);
}
/** a giant root arching out of the ground between two points (path-crossing roots) */
export function rootArch(kit, ax, az, bx, bz, H, { h = 2.6, r = 0.55, tint = 0x5a4a38, moss = 0x4a6a2a, block = true } = {}) {
  const pts = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(V(ax + (bx - ax) * t, H(ax + (bx - ax) * t, az + (bz - az) * t) + Math.sin(t * Math.PI) * h - 0.4 + Math.sin(t * 9) * 0.08, az + (bz - az) * t)); }
  kit.add('timber', tube(pts, pts.map((_, i) => r * (1.25 - 0.5 * Math.sin(i / 10 * Math.PI))), 8, false), null, { tint, ao: false, chunkAt: [(ax + bx) / 2, (az + bz) / 2] });
  const top = pts[5]; kit.add('paint', blob(r * 1.1, 1, null, [1.6, 0.35, 1]), M(top.x, top.y + r * 0.7, top.z), { tint: moss, ao: false, cast: false });
  if (block) { kit.block(S.circle(ax, az, r * 1.4), 0.25); kit.block(S.circle(bx, bz, r * 1.4), 0.25); }
}
/**
 * The fallen giant: a colossal horizontal trunk from its root plate at (ax, az) to a splintered end at (bx, bz), top at
 * absolute height yTop (walkable: returns the deck shape). Branch stubs, moss, shelf fungi.
 */
export function fallenGiant(kit, ax, az, bx, bz, yTop, { r = 1.5, tint = 0x6a5440, moss = 0x4a6a2a, seed = 1 } = {}) {
  const rng = new RNG(seed), nz = new Simplex(seed);
  const len = Math.hypot(bx - ax, bz - az), rot = Math.atan2(-(bz - az), bx - ax);
  const F0 = new Frame((ax + bx) / 2, yTop - r, (az + bz) / 2, rot);
  const bark = (p) => { const k = 0.62 + nz.noise3(p.x * 0.6, p.y * 0.6, p.z * 0.6) * 0.15; return [k * 0.95, k * 0.86, k * 0.72]; };
  const tube0 = []; for (let i = 0; i <= 12; i++) { const t = i / 12; tube0.push(V(-len / 2 + t * len, Math.sin(t * 5 + seed) * 0.08, 0)); }
  kit.add('timber', tube(tube0, tube0.map((_, i) => r * (1.15 - 0.3 * i / 12)), 14, false), F0.m, { tint: bark, ao: false, chunkAt: [(ax + bx) / 2, (az + bz) / 2] });
  // root plate: a ring of thick roots + a soil disc at the root end
  const Fr = new Frame(ax, yTop - r, az, rot);
  kit.add('paint', cyl(r * 2.3, r * 2.1, 0.8, 14, 1), Fr.at(-0.5, 0, 0, 0, 1, 1, 1, 0, Math.PI / 2), { tint: 0x3a2c1e, ao: false });
  for (let i = 0; i < 11; i++) { const a = i / 11 * TAU; const d = V(0, Math.sin(a), Math.cos(a)); kit.add('timber', tube([V(-0.3, d.y * r * 0.8, d.z * r * 0.8), V(-1.0, d.y * r * 2.0, d.z * r * 2.0), V(-1.3 - rng.range(0, 0.8), d.y * r * 2.8, d.z * r * 2.8)], [r * 0.3, r * 0.2, 0.05], 6, true), Fr.m, { tint: bark, ao: false, chunkAt: [ax, az] }); }
  // splintered end
  const Fe = new Frame(bx, yTop - r, bz, rot);
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; kit.add('planks', cone(r * 0.3, rng.range(0.8, 1.8), 4, 1), Fe.at(0.4, Math.sin(a) * r * 0.7, Math.cos(a) * r * 0.7, 0, 1, 1, 1, 0, -Math.PI / 2 + rng.range(-0.3, 0.3)), { tint: 0xc0a078, ao: false }); }
  // moss along the top, shelf fungi on the flanks, branch stubs
  for (let i = 0; i < 7; i++) { const u = -len / 2 + (i + 0.5) / 7 * len + rng.range(-0.8, 0.8); kit.add('rock', blob(r * 0.45, 1, d => 1 + Math.sin(d.x * 6 + d.z * 4) * 0.15, [1.8, 0.22, 1.0]), F0.at(u, r * 0.96, rng.range(-0.4, 0.4)), { tint: new THREE.Color(moss).multiplyScalar(0.8).getHex(), ao: false, cast: false }); }
  for (let i = 0; i < 10; i++) { const u = -len / 2 + rng.range(0.1, 0.9) * len, sd = rng.sign(); kit.add('paint', cyl(0.36, 0.3, 0.07, 10, 1, false), F0.at(u, rng.range(-0.3, 0.5), sd * r * 1.02), { tint: rng.pick([0xc89a60, 0xe0c090, 0xb07a4a]), ao: false, cast: false }); }
  for (let i = 0; i < 4; i++) { const u = -len / 2 + rng.range(0.2, 0.8) * len, sd = rng.sign(); kit.add('timber', tube([V(u, 0.2, sd * r * 0.8), V(u + 0.4, 1.4, sd * (r + 1.2)), V(u + 0.5, 2.2, sd * (r + 1.8))], [0.3, 0.2, 0.06], 6, true), F0.m, { tint: bark, ao: false, chunkAt: [(ax + bx) / 2, (az + bz) / 2] }); }
  return { deck: S.rect((ax + bx) / 2, (az + bz) / 2, len + 1.5, r * 0.9, rot), y: yTop, rot, len };
}
/** dark hollow opening at a trunk foot (the hollow oak) */
export function hollowMouth(kit, x, y, z, rot = 0, { w = 1.3, h = 1.8 } = {}) {
  const F0 = new Frame(x, y, z, rot);
  kit.add('paint', blob(1, 1, null, [w * 0.5, h * 0.5, 0.35]), F0.at(0, h * 0.45, 0), { tint: 0x0a0806, ao: false, cast: false });
  kit.add('timber', new THREE.TorusGeometry(w * 0.5, 0.16, 5, 14, Math.PI), F0.at(0, h * 0.45, 0.12, 0, 1, h / w, 1), { tint: 0x5a4a38, ao: false });
}
/** a cluster of small glowing mushrooms (HDR caps → bloom in the dark forest) */
export function glowShrooms(kit, x, y, z, { n = 7, color = 0x60e0ff, seed = 1, s = 1, light = true } = {}) {
  const r = new RNG(seed);
  for (let i = 0; i < n; i++) {
    const a = r.range(0, TAU), d = r.range(0, 0.7) * s, h = r.range(0.12, 0.34) * s, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    kit.add('paint', cyl(0.02 * s, 0.03 * s, h, 5, 1), M(px, y + h / 2, pz), { tint: 0xd8e8e0, ao: false, cast: false });
    kit.glow(sphere(r.range(0.06, 0.12) * s, 8, 4, TAU, Math.PI / 2), M(px, y + h, pz, 0, 1, 0.6, 1), color, r.range(1.8, 2.8));
  }
  if (light) kit.light(x, y + 0.6, z, color, 2.2 * s, 5 * s, 0.05);
}
/** glowing moonflowers: pale stems with bright petal cups (bloom) */
export function moonflowers(kit, x, y, z, { n = 5, color = 0xd8f0ff, seed = 1 } = {}) {
  const r = new RNG(seed);
  for (let i = 0; i < n; i++) {
    const a = r.range(0, TAU), d = r.range(0, 0.5), h = r.range(0.3, 0.55), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    kit.add('paint', cyl(0.012, 0.016, h, 4, 1), M(px, y + h / 2, pz), { tint: 0x4a7a4a, ao: false, cast: false });
    kit.glow(cone(0.08, 0.1, 6, 1), M(px, y + h + 0.03, pz, 0, 1, -1, 1), color, r.range(1.6, 2.4));
  }
}
export function candles(kit, x, y, z, { n = 5, seed = 1, r = 0.4, color = 0xffc060 } = {}) {
  const rng = new RNG(seed);
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), d = rng.range(0.05, r), h = rng.range(0.12, 0.34), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    kit.add('paint', cyl(0.04, 0.045, h, 6, 1), M(px, y + h / 2, pz), { tint: 0xf0e6d0, ao: false, cast: false });
    kit.flame(px, y + h + 0.04, pz, 0.06, color);
  }
  kit.light(x, y + 0.5, z, color, 2.2, 4.5, 0.2);
}
/** cult altar: stone block, draped cloth, a skull, candles, a glowing sigil above */
export function altar(kit, x, y, z, rot = 0, { cloth = 0x4a1a4a, glow = 0xb040ff } = {}) {
  const F0 = new Frame(x, y, z, rot);
  kit.add('stone', box(2.2, 1.0, 1.2, 1), F0.at(0, 0.5, 0), { tint: 0x6a6660, yGround: y });
  kit.add('stone', box(2.4, 0.14, 1.4, 1), F0.at(0, 1.05, 0), { tint: 0x7a7670, ao: false });
  kit.add('cloth', box(1.0, 0.02, 1.46, 1), F0.at(0, 1.13, 0), { tint: cloth, ao: false });
  kit.add('cloth', box(1.0, 0.8, 0.02, 1), F0.at(0, 0.72, 0.72), { tint: cloth, ao: false });
  kit.add('bone', blob(0.14, 1, d => 1 + Math.max(0, d.y) * 0.2, [1, 0.9, 1.1]), F0.at(0.6, 1.25, 0.1), { tint: 0xe8e0c8, ao: false });
  kit.glow(new THREE.TorusGeometry(0.45, 0.03, 4, 24), F0.at(0, 2.2, 0, 0, 1, 1, 1, Math.PI / 2 * 0), glow, 2.6);
  kit.glow(new THREE.OctahedronGeometry(0.16, 0), F0.at(0, 2.2, 0), glow, 3.2);
  const [cx, cz] = F0.world(-0.7, 0.2); candles(kit, cx, y + 1.12, cz, { n: 3, r: 0.2, color: 0xc070ff });
  kit.light(x, y + 2.2, z, glow, 4, 8, 0.15);
  kit.block(S.rect(x, z, 2.4, 1.4, rot), 0.3);
}
export function cauldron(kit, x, y, z, { liquid = 0x60ff90 } = {}) {
  kit.add('metal', sphere(0.55, 12, 8, TAU, Math.PI * 0.62), M(x, y + 0.62, z, 0, 1, -1, 1), { tint: 0x2a2826, ao: false });
  kit.glow(cyl(0.44, 0.44, 0.03, 14, 1), M(x, y + 0.6, z), liquid, 1.8);
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; kit.add('metal', cyl(0.04, 0.03, 0.4, 5, 1), M(x + Math.cos(a) * 0.4, y + 0.15, z + Math.sin(a) * 0.4), { tint: 0x2a2826, ao: false }); }
  kit.glow(blob(0.25, 0, null, [1, 0.3, 1]), M(x, y + 0.05, z), 0xff6a20, 2.2); kit.flame(x, y + 0.1, z, 0.25, 0xff9a40);
  kit.light(x, y + 1.0, z, liquid, 3.5, 6, 0.2);
  kit.block(S.circle(x, z, 0.65), 0.2);
}
/** crooked hut on stilts over a marsh (witch / hermit) */
export function stiltHut(kit, x, y, z, rot = 0, { w = 4.2, d = 3.6, h = 2.6, legs = 1.4, seed = 1 } = {}) {
  const F0 = new Frame(x, y, z, rot);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add('timber', cyl(0.12, 0.14, legs + 0.6, 6, 1), F0.at(sx * (w / 2 - 0.2), (legs + 0.6) / 2 - 0.4, sz * (d / 2 - 0.2), 0, 1, 1, 1, sx * 0.05, sz * 0.05), { tint: 0x4a3a2a });
  kit.add('planks', box(w + 0.8, 0.16, d + 0.8, 1), F0.at(0, legs, 0), { tint: 0x5a4a38 });
  const c = F.cottage(kit, ...F0.world(0, 0).flatMap((v, i) => i === 0 ? [v, y + legs + 0.1] : [v]), rot + 0.04, { w, d, h, seed, roof: 'thatch', roofTint: 0x5a5a3a, plaster: 0x8a7a64, beam: 0x2a2018, shutter: 0x3a4a3a, chimney: true, pitch: 0.8 });
  // ladder
  const [lx, lz] = F0.world(0.6, d / 2 + 1.3);
  kit.add('timber', box(0.5, legs + 0.4, 0.08, 1), M(lx, y + legs / 2, lz, rot, 1, 1, 1, 0.45), { tint: 0x5a4028 });
  return c;
}
/** sawpit with a trestle, a half-sawn log and sawdust */
export function sawpit(kit, x, y, z, rot = 0) {
  const F0 = new Frame(x, y, z, rot);
  for (const sx of [-1.4, 1.4]) { kit.add('timber', box(0.16, 1.2, 1.6, 1), F0.at(sx, 0.6, 0), { tint: 0x6a4a30 }); }
  kit.add('timber', cyl(0.38, 0.4, 4.4, 10, 1), F0.at(0, 1.45, 0, 0, 1, 1, 1, 0, Math.PI / 2), { tint: 0x8a6440 });
  kit.add('planks', box(4.4, 0.06, 0.7, 1), F0.at(0, 1.86, 0), { tint: 0xd8b080, ao: false });
  kit.add('metal', box(0.04, 1.6, 0.3, 1), F0.at(0.6, 1.5, 0.1, 0, 1, 1, 1, 0, 0.1), { tint: 0xa0a4a8, ao: false });
  kit.add('paint', blob(1.0, 1, null, [1.4, 0.12, 1]), F0.at(0, 0.03, 0), { tint: 0xd8b888, ao: false, cast: false });
  kit.block(S.rect(x, z, 4.6, 1.8, rot), 0.25);
}
export function bonePile(kit, x, y, z, { n = 8, seed = 1, s = 1 } = {}) {
  const r = new RNG(seed);
  for (let i = 0; i < n; i++) { const a = r.range(0, TAU), d = r.range(0, 0.6) * s; kit.add('bone', blob(0.08 * s, 0, null, [3.6, 0.6, 0.7]), M(x + Math.cos(a) * d, y + 0.05, z + Math.sin(a) * d, r.range(0, 6)), { tint: 0xe0d6bc, ao: false, cast: false }); }
  kit.add('bone', blob(0.13 * s, 1, d => 1 + Math.max(0, d.y) * 0.25, [1, 0.9, 1.15]), M(x, y + 0.12 * s, z, r.range(0, 6)), { tint: 0xe8e0c8, ao: false });
}
/** carved rune stone (lore stele) */
export function runeStone(kit, x, y, z, rot = 0, { h = 2.2, tint = 0x8a8a80, glyph = 0x60e0c0 } = {}) {
  const F0 = new Frame(x, y, z, rot);
  kit.add('stone', box(1.0, h, 0.4, 1), F0.at(0, h / 2 - 0.1, 0), { tint, yGround: y, aoH: 1.5 });
  kit.add('stone', cyl(0.5, 0.5, 0.4, 10, 1, false, 0, Math.PI), F0.at(0, h - 0.1, 0, 0, 1, 1, 1, Math.PI / 2), { tint, ao: false });
  for (let i = 0; i < 4; i++) kit.glow(box(0.5 - i * 0.08, 0.05, 0.02, 1), F0.at(0, h * 0.35 + i * 0.25, 0.21), glyph, 1.8);
  kit.add('stone', box(1.4, 0.3, 0.8, 1), F0.at(0, 0.1, 0), { tint: 0x7a7a70 });
  kit.block(S.rect(x, z, 1.4, 0.8, rot), 0.25);
}
