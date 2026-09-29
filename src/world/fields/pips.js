// Pipsprout Hollow props, authored at Pip scale (a Pip / the shrunk hero is ~0.65 m tall). Merged into a FieldKit.
//   acornHouse, logHall (hollow-log town hall), acornTower, thimbleWell, ladybug, caterpillar, snail, leafBridge,
//   petalTheatre, seedVaultDoor, berryStall, lantern (firefly jar), dewdrop (glass), pebble, clover, leafPad, button
import * as THREE from 'three';
import { RNG, Simplex, clamp } from '../../core/noise.js';
import { blob, tube, linColor } from '../../engine/geom.js';
import { lambert, G } from '../../engine/materials.js';
import { box, cyl, cone, sphere, M, Frame, kitMaterial } from '../kit.js';
import * as S from '../shapes.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const lerpC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

let DEW = null;
/** glassy dew material (transparent, strong spec + rim) */
export function dewMaterial() {
  if (DEW) return DEW;
  DEW = lambert({ color: 0xcfeeff, transparent: true, opacity: 0.5, depthWrite: false, vertexColors: true }, { wrap: 0.6, spec: 2.2, shine: 90, rim: 1.2, rimColor: 0xffffff, key: 'pip-dew' });
  DEW.userData.shared = true;
  return DEW;
}
export function dewdrop(kit, x, y, z, r = 0.3) {
  kit.addC(dewMaterial(), 'dew', blob(r, 2, null, [1, 0.82, 1]), M(x, y + r * 0.75, z), { tint: 0xffffff, ao: false, cast: false });
  kit.glow(sphere(r * 0.18, 6, 4), M(x - r * 0.35, y + r * 1.2, z + r * 0.35), 0xffffff, 3.0);
}
/** acorn house: round nut body with a door and windows, a textured cap roof with a stalk chimney */
export function acornHouse(kit, x, y, z, rot = 0, { s = 1, body = 0xc08040, cap = 0x7a5230, door = 0x5a3a24, seed = 1, lamp = true } = {}) {
  const F = new Frame(x, y, z, rot), r = new RNG(seed);
  const R = 1.35 * s;
  const shell = new THREE.LatheGeometry([[0.01, 0], [0.55, 0.05], [0.9, 0.35], [1.0, 0.8], [0.98, 1.25], [0.9, 1.6]].map(([a, b]) => new THREE.Vector2(a * R, b * R)), 20);
  kit.add('paint', shell, F.at(0, -0.05, 0), { tint: (p) => { const t = clamp((p.y - y) / (1.6 * R), 0, 1); const c = linColor(body); return lerpC(c.map(v => v * 0.8), c.map(v => Math.min(1, v * 1.12)), t); }, yGround: y, aoH: 1.2 });
  // cap: a squat dome with a scaly rim and stalk
  const capG = new THREE.SphereGeometry(R * 1.12, 20, 8, 0, TAU, 0, Math.PI * 0.55); capG.scale(1, 0.7, 1);
  kit.add('thatch', capG, F.at(0, 1.45 * R, 0), { tint: cap, ao: false });
  const rim = new THREE.TorusGeometry(R * 1.02, 0.14 * s, 6, 24); rim.rotateX(Math.PI / 2);
  kit.add('thatch', rim, F.at(0, 1.47 * R, 0), { tint: new THREE.Color(cap).multiplyScalar(0.8).getHex(), ao: false });
  kit.add('timber', tube([V(0, 0, 0), V(0.1 * s, 0.4 * s, 0), V(0.3 * s, 0.6 * s, 0.05)], [0.12 * s, 0.1 * s, 0.08 * s], 6, true), F.at(0, 1.45 * R + 0.72 * R, 0), { tint: 0x5a3a24, ao: false });
  // round door + frame (faces local +Z), windows
  kit.add('planks', cyl(0.42 * s, 0.42 * s, 0.1, 14, 0.6), F.at(0, 0.55 * s, R * 0.98, 0, 1, 1.25, 1, Math.PI / 2), { tint: door, ao: false });
  kit.add('timber', new THREE.TorusGeometry(0.44 * s, 0.07 * s, 5, 16), F.at(0, 0.55 * s, R * 0.99, 0, 1, 1.25, 1), { tint: 0x4a3020, ao: false });
  kit.add('metal', sphere(0.05 * s, 6, 4), F.at(0.22 * s, 0.5 * s, R * 1.04), { tint: 0xd8b040, ao: false });
  for (const sd of [-1, 1]) {
    const a = sd * 0.8, wx = Math.sin(a) * R * 0.98, wz = Math.cos(a) * R * 0.98;
    kit.add('window', cyl(0.22 * s, 0.22 * s, 0.06, 12, 1), F.at(wx, 1.25 * s, wz, a, 1, 1, 1, Math.PI / 2), { ao: false });
    kit.add('timber', new THREE.TorusGeometry(0.23 * s, 0.045 * s, 4, 14), F.at(wx, 1.25 * s, wz + 0.01, a), { tint: 0x4a3020, ao: false });
    kit.add('paint', box(0.46 * s, 0.05, 0.02, 1), F.at(wx, 1.25 * s, wz + 0.03, a), { tint: 0x4a3020, ao: false, cast: false });
  }
  // doorstep pebbles, a flower pot
  for (let i = 0; i < 3; i++) kit.add('rock', blob(0.16 * s, 0, null, [1.4, 0.35, 1]), F.at(-0.3 * s + i * 0.3 * s, 0.03, R + 0.35 * s + (i % 2) * 0.1), { tint: 0xb8b0a0, ao: false, cast: false });
  if (lamp) { const [lx, lz] = F.world(0.75 * s, R + 0.2); firefly(kit, lx, y + 1.2 * s, lz, 0.14 * s); }
  kit.block(S.circle(x, z, R * 1.02), 0.12);
  (kit.spots.roofs ||= []).push({ circle: [x, z, R * 1.1], color: '#' + new THREE.Color(cap).getHexString() });
}
/** firefly jar lantern hanging from a bent twig (warm glow) */
export function firefly(kit, x, y, z, s = 0.15) {
  kit.add('timber', tube([V(x, y - 1.1, z), V(x, y + 0.2, z), V(x + 0.25, y + 0.35, z)], [0.03, 0.025, 0.02], 4, false), null, { tint: 0x5a3a24, ao: false, chunkAt: [x, z] });
  kit.addC(dewMaterial(), 'dew', cyl(s, s * 0.9, s * 2, 10, 1), M(x + 0.25, y - 0.05, z), { tint: 0xffffff, ao: false, cast: false });
  kit.glow(sphere(s * 0.45, 8, 6), M(x + 0.25, y - 0.05, z), 0xffe070, 1.7);
  kit.light(x + 0.25, y, z, 0xffd070, 1.0, 3.0, 0.2);
}
/** the hollow-log town hall: a huge fallen log with a door, windows, a porch, a moss roof, mushrooms */
export function logHall(kit, x, y, z, rot = 0, { len = 14, r = 2.6, seed = 1 } = {}) {
  const F = new Frame(x, y, z, rot), rng = new RNG(seed), nz = new Simplex(seed);
  const bark = (p, n) => { const k = 0.62 + nz.noise3(p.x * 0.7, p.y * 0.7, p.z * 0.7) * 0.12; return [k * 1.0, k * 0.78, k * 0.55]; };
  kit.add('timber', cyl(r, r * 1.05, len, 20, 1.2, true), F.at(0, r * 0.92, 0, 0, 1, 1, 1, 0, Math.PI / 2), { tint: bark, yGround: y, aoH: 2 });
  // end faces: rings on the west end, the door face on the east end (open end → a wall with a round door)
  const ring = new THREE.CircleGeometry(r, 24);
  kit.add('planks', ring, F.at(-len / 2, r * 0.92, 0, -Math.PI / 2), { tint: 0xd8b888, ao: false });
  for (let k = 1; k < 5; k++) kit.add('paint', new THREE.TorusGeometry(r * k / 5, 0.03, 3, 30), F.at(-len / 2 - 0.02, r * 0.92, 0, -Math.PI / 2), { tint: 0xa88058, ao: false, cast: false });
  kit.add('planks', ring, F.at(len / 2, r * 0.92, 0, Math.PI / 2), { tint: 0xb89068, ao: false });
  // the front (+Z, facing the camera): arched door, round windows, a porch roof, sign
  kit.add('planks', cyl(0.75, 0.75, 0.14, 16, 0.6), F.at(0, 0.95, r * 0.98, 0, 1, 1.4, 1, Math.PI / 2), { tint: 0x6a4428, ao: false });
  kit.add('timber', new THREE.TorusGeometry(0.78, 0.1, 5, 18), F.at(0, 0.95, r * 1.0, 0, 1, 1.4, 1), { tint: 0x4a3020, ao: false });
  for (const sx of [-4.2, -2.2, 2.2, 4.2]) { kit.add('window', cyl(0.36, 0.36, 0.08, 14, 1), F.at(sx, r * 1.05, r * 0.88, 0, 1, 1, 1, Math.PI / 2 - 0.35), { ao: false }); kit.add('timber', new THREE.TorusGeometry(0.38, 0.06, 4, 16), F.at(sx, r * 1.05, r * 0.9, 0, 1, 1, 1, -0.35), { tint: 0x4a3020, ao: false }); }
  kit.add('thatch', box(3.6, 0.12, 1.8, 1), F.at(0, 2.35, r + 0.6, 0, 1, 1, 1, 0.3), { tint: 0x7a9a3a, ao: false });
  for (const sx of [-1.6, 1.6]) kit.add('timber', cyl(0.08, 0.1, 2.1, 6, 1), F.at(sx, 1.05, r + 1.3), { tint: 0x5a3a24 });
  kit.add('planks', box(1.6, 0.5, 0.08, 0.6), F.at(0, 2.9, r + 0.1, 0, 1, 1, 1, -0.2), { tint: 0xc8a068, ao: false });
  // moss blanket on top, mushrooms sprouting, a leaf-flag
  for (let i = 0; i < 6; i++) kit.add('paint', blob(r * 0.55, 1, d => 1 + Math.sin(d.x * 6 + d.z * 4) * 0.1, [1.6, 0.3, 1.1]), F.at(-len / 2 + (i + 0.5) * len / 6, r * 1.85, rng.range(-0.4, 0.4)), { tint: 0x5a8a2a, ao: false, cast: false });
  kit.block(S.rect(x, z, len + 0.2, r * 2.05, rot), 0.12);
  kit.block(S.circle(...F.world(-1.6, r + 1.3), 0.12), 0.1); kit.block(S.circle(...F.world(1.6, r + 1.3), 0.12), 0.1);
  (kit.spots.roofs ||= []).push({ rect: [x, z, len, r * 2, rot], color: '#6a8a3a' });
  return F;
}
/** acorn tower: three stacked acorn tiers with a ladder and a leaf flag on top */
export function acornTower(kit, flags, x, y, z, { s = 1.3 } = {}) {
  const tiers = [[0, 1.3], [2.5, 1.05], [4.6, 0.85]];
  for (const [dy, sc] of tiers) acornHouse(kit, x, y + dy * s, z, 0.2, { s: s * sc, lamp: false, seed: Math.round(dy * 10) });
  kit.colliders.splice(-2, 2);
  kit.add('timber', box(0.5 * s, 7 * s, 0.08, 1), M(x + 1.6 * s, y + 3.2 * s, z + 0.6 * s, 0.4, 1, 1, 1, 0.12), { tint: 0x6a4428 });
  if (flags) flags.add(M(x + 0.3, y + 9.2 * s, z), 1.4 * s, 0.8 * s, 0x6ac040, { hang: 'left' });
  kit.add('timber', cyl(0.05, 0.06, 1.5 * s, 5, 1), M(x + 0.25, y + 8.6 * s, z), { tint: 0x5a3a24, ao: false });
}
/** a silver sewing thimble set into the ground as a well, with a twig crank and a nut bucket */
export function thimbleWell(kit, x, y, z, { s = 1 } = {}) {
  const g = new THREE.LatheGeometry([[0.95, 0], [1.0, 0.5], [0.96, 1.1], [0.9, 1.3], [0.7, 1.35]].map(([a, b]) => new THREE.Vector2(a * s, b * s)), 24);
  const p = g.attributes.position, cols = [];
  kit.add('metal', g, M(x, y - 0.05, z), { tint: (pp) => { const a = Math.atan2(pp.z - z, pp.x - x), h = pp.y - y; const dimple = (Math.sin(a * 22) * Math.sin(h * 14) > 0.4) ? 0.72 : 1; return [0.82 * dimple, 0.84 * dimple, 0.88 * dimple]; } });
  void p; void cols;
  kit.add('paint', cyl(0.85 * s, 0.85 * s, 0.04, 20, 1), M(x, y + 1.0 * s, z), { tint: 0x2a6a8a, ao: false, cast: false });
  for (const sd of [-1, 1]) kit.add('timber', tube([V(x + sd * 0.9 * s, y + 1.2 * s, z), V(x + sd * 0.95 * s, y + 2.4 * s, z)], [0.06 * s, 0.05 * s], 5, true), null, { tint: 0x6a4428, ao: false, chunkAt: [x, z] });
  kit.add('timber', cyl(0.05 * s, 0.05 * s, 2.1 * s, 6, 1), M(x, y + 2.35 * s, z, 0, 1, 1, 1, 0, Math.PI / 2), { tint: 0x6a4428, ao: false });
  kit.add('paint', sphere(0.28 * s, 10, 6, TAU, Math.PI * 0.6), M(x + 0.2 * s, y + 1.6 * s, z, 0, 1, -0.9, 1), { tint: 0xa06a38, ao: false });
  kit.block(S.circle(x, z, 1.02 * s), 0.12);
}
/** a ladybug (bigger than a Pip): red spotted shell, black head */
export function ladybug(kit, x, y, z, rot = 0, { s = 1 } = {}) {
  const F = new Frame(x, y, z, rot);
  const sh = new THREE.SphereGeometry(0.62 * s, 18, 10, 0, TAU, 0, Math.PI / 2); sh.scale(1, 0.75, 1.2);
  const spots = [[0.3, 0.5, 0.3], [-0.3, 0.5, 0.3], [0.38, 0.35, -0.2], [-0.38, 0.35, -0.2], [0, 0.6, -0.4], [0.2, 0.55, 0.62], [-0.2, 0.55, 0.62]];
  kit.add('paint', sh, F.at(0, 0.18 * s, 0), { tint: (p) => { const lx = (p.x - x), ly = p.y - y, lz = p.z - z; for (const [a, b, c] of spots) if (Math.hypot(lx - a * s, lz - c * s) < 0.13 * s && ly > 0.25 * s) return [0.05, 0.04, 0.04]; if (Math.abs(lx) < 0.025 * s) return [0.05, 0.04, 0.04]; return [0.85, 0.08, 0.05]; }, ao: false });
  kit.add('paint', sphere(0.26 * s, 10, 8), F.at(0, 0.22 * s, -0.78 * s, 0, 1, 0.8, 1), { tint: 0x141214, ao: false });
  for (const sd of [-1, 1]) { kit.add('paint', sphere(0.07 * s, 6, 4), F.at(sd * 0.12 * s, 0.3 * s, -0.98 * s), { tint: 0xf0f0f0, ao: false, cast: false }); kit.add('paint', tube([V(sd * 0.1 * s, 0.4 * s, -0.9 * s), V(sd * 0.25 * s, 0.7 * s, -1.2 * s)], [0.02 * s, 0.015 * s], 3, true), F.m, { tint: 0x141214, ao: false, cast: false, chunkAt: [x, z] }); }
  for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) kit.add('paint', tube([V(sd * 0.45 * s, 0.15 * s, (-0.4 + i * 0.4) * s), V(sd * 0.75 * s, 0.05 * s, (-0.5 + i * 0.45) * s), V(sd * 0.85 * s, -0.05, (-0.45 + i * 0.45) * s)], [0.03 * s, 0.025 * s, 0.02 * s], 3, true), F.m, { tint: 0x141214, ao: false, cast: false, chunkAt: [x, z] });
  kit.block(S.circle(x, z, 0.75 * s), 0.1);
}
/** the sleepy caterpillar: a row of green segments curled on a leaf, with Zzz bubbles */
export function caterpillar(kit, x, y, z, rot = 0, { s = 1, n = 9 } = {}) {
  const F = new Frame(x, y, z, rot);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), a = t * Math.PI * 1.25, R = 2.2 * s, px = Math.cos(a) * R - R * 0.4, pz = Math.sin(a) * R * 0.7;
    const r = (i === 0 ? 0.62 : 0.55 - t * 0.12) * s;
    kit.add('paint', sphere(r, 12, 10), F.at(px, r * 0.9, pz), { tint: i === 0 ? 0x8ac838 : (i % 2 ? 0x6aa82a : 0x7ab830), ao: false });
    if (i > 0) kit.add('paint', sphere(0.12 * s, 6, 4), F.at(px, r * 1.75, pz), { tint: 0xf0d040, ao: false, cast: false });
  }
  const hx = Math.cos(0) * 2.2 * s - 0.88 * s;
  for (const sd of [-1, 1]) { kit.add('paint', box(0.16 * s, 0.03 * s, 0.02, 1), F.at(hx + 0.3 * s, 0.85 * s, sd * 0.2 * s, Math.PI / 2), { tint: 0x1a2a0a, ao: false, cast: false }); kit.add('paint', tube([V(hx, 1.0 * s, sd * 0.15 * s), V(hx + 0.2 * s, 1.5 * s, sd * 0.3 * s)], [0.03 * s, 0.02 * s], 3, true), F.m, { tint: 0x3a5a1a, ao: false, cast: false, chunkAt: [x, z] }); }
  for (let i = 0; i < 3; i++) kit.addC(dewMaterial(), 'dew', sphere((0.12 + i * 0.08) * s, 10, 8), F.at(hx + 0.5 * s + i * 0.35 * s, (1.5 + i * 0.45) * s, 0.2 * s), { tint: 0xffffff, ao: false, cast: false });
  kit.block(S.circle(...F.world(-0.2 * s, 0.9 * s), 2.1 * s), 0.1);
}
/** garden snail with a spiral shell (stable mount) */
export function snail(kit, x, y, z, rot = 0, { s = 1, shell = 0xc08a50 } = {}) {
  const F = new Frame(x, y, z, rot);
  const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(V(0, 0.18 * s, (-0.5 + t * 1.9) * s)); }
  kit.add('paint', tube(pts, pts.map((_, i) => (0.22 - Math.abs(i / 10 - 0.35) * 0.1) * s), 8, true), F.m, { tint: 0xa8b088, ao: false, chunkAt: [x, z] });
  for (const sd of [-1, 1]) { kit.add('paint', tube([V(sd * 0.08 * s, 0.3 * s, 1.3 * s), V(sd * 0.16 * s, 0.75 * s, 1.5 * s)], [0.03 * s, 0.025 * s], 4, false), F.m, { tint: 0xa8b088, ao: false, cast: false, chunkAt: [x, z] }); kit.add('paint', sphere(0.06 * s, 6, 4), F.at(sd * 0.16 * s, 0.78 * s, 1.5 * s), { tint: 0x2a2a20, ao: false, cast: false }); }
  // spiral shell
  const sp = []; for (let i = 0; i <= 30; i++) { const t = i / 30, a = t * TAU * 2.2, R = 0.62 * (1 - t * 0.85); sp.push(V(0, (0.75 + Math.sin(a) * R) * s, (0.1 + Math.cos(a) * R) * s)); }
  kit.add('paint', tube(sp, sp.map((_, i) => 0.36 * (1 - i / 30 * 0.8) * s), 10, true), F.m, { tint: (p, n) => { const c = linColor(shell); const b = 0.8 + 0.2 * Math.sin(Math.atan2(p.y - y, p.z - z) * 6); return c.map(v => v * b); }, ao: false, chunkAt: [x, z] });
  // saddle
  kit.add('cloth', box(0.5 * s, 0.08 * s, 0.6 * s, 1), F.at(0, 1.42 * s, 0.2 * s), { tint: 0x3a6ac0, ao: false });
  kit.block(S.circle(...F.world(0, 0.4 * s), 0.7 * s), 0.1);
}
/** twig-and-leaf bridge over a stream: deck of split twigs, rope rails, leaf canopy on the posts; returns deck */
export function leafBridge(kit, x, z, rot, { len = 8, w = 1.8, deckY = 0.5, seed = 1 } = {}) {
  const F = new Frame(x, deckY, z, rot), r = new RNG(seed);
  const n = Math.round(len / 0.32);
  for (let i = 0; i < n; i++) { const u = -len / 2 + (i + 0.5) * len / n, arch = Math.sin((i + 0.5) / n * Math.PI) * 0.35; kit.add('timber', cyl(0.13, 0.13, w, 6, 1), F.at(u, arch, 0, 0, 1, 1, 1, Math.PI / 2), { tint: new THREE.Color(0x9a7048).multiplyScalar(r.range(0.85, 1.1)).getHex(), ao: false }); }
  for (const sd of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(V(-len / 2 + t * len, 0.8 + Math.sin(t * Math.PI) * 0.35 - Math.sin(t * Math.PI * 4) * 0.06, sd * w / 2)); }
    kit.add('cloth', tube(pts, pts.map(() => 0.03), 4, false), F.m, { tint: 0xd8c898, ao: false, cast: false, chunkAt: [x, z] });
    for (const e of [-1, 1]) { kit.add('timber', cyl(0.07, 0.09, 1.3, 6, 1), F.at(e * len / 2, 0.45, sd * w / 2), { tint: 0x6a4428 }); const lf = new THREE.PlaneGeometry(0.5, 0.9); lf.translate(0, 0.45, 0); kit.add('paint', lf, F.at(e * len / 2, 1.05, sd * w / 2, e * 0.5, 1, 1, 1, -0.6), { tint: 0x6ab030, ao: false, cast: false }); }
  }
  for (const sd of [-1, 1]) kit.block(S.line([F.world(-len / 2 - 0.2, sd * (w / 2 + 0.05)), F.world(len / 2 + 0.2, sd * (w / 2 + 0.05))], 0.15), 0.1);
  return { deck: S.rect(x, z, len + 0.8, w - 0.3, rot), y: deckY + 0.28 };
}
/** the petal theatre: a stage disc and a half ring of giant petal seats facing it (the audience side south) */
export function petalTheatre(kit, x, y, z, { r = 7, rows = 3, stage = 0xf8e8b0, seed = 1 } = {}) {
  const rng = new RNG(seed);
  kit.add('planks', cyl(3.2, 3.4, 0.6, 24, 1), M(x, y + 0.2, z - 1), { tint: 0xc89868, yGround: y });
  kit.add('paint', cyl(3.3, 3.3, 0.08, 24, 1), M(x, y + 0.52, z - 1), { tint: 0xe0a860, ao: false });
  // backdrop: a curtain of three huge petals
  for (let i = 0; i < 3; i++) { const g = new THREE.SphereGeometry(2.2, 12, 8, 0, Math.PI * 0.6, 0, Math.PI * 0.8); g.scale(0.7, 1.6, 0.4); kit.add('paint', g, M(x - 2.6 + i * 2.6, y + 2.6, z - 3.8, -Math.PI * 0.3 + Math.PI, 1, 1, 1), { tint: [0xff8ab0, 0xffb0c8, 0xff8ab0][i], ao: false }); }
  for (let row = 0; row < rows; row++) {
    const R = r + row * 1.6, n = 7 + row * 2;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * 0.18 + (i / (n - 1)) * Math.PI * 0.64, px = x + Math.cos(a) * R, pz = z - 1 + Math.sin(a) * R;
      const pet = new THREE.SphereGeometry(0.8, 10, 6, 0, TAU, 0, Math.PI / 2); pet.scale(1.1, 0.35 + row * 0.12, 0.7);
      kit.add('paint', pet, M(px, y + 0.02, pz, -a + Math.PI / 2), { tint: rng.pick([0xf07aa8, 0xf0c040, 0x7aa8f0, 0xf09a60]), ao: false });
      kit.block(S.circle(px, pz, 0.6), 0.08);
    }
  }
  kit.block(S.circle(x, z - 1, 3.4), 0.1);
  for (const sd of [-1, 1]) firefly(kit, x + sd * 3.6, y + 1.6, z + 0.6, 0.16);
}
/** round seed-vault door set into a mossy mound (facing +Z) */
export function seedVaultDoor(kit, x, y, z, rot = 0) {
  const F = new Frame(x, y, z, rot);
  kit.add('rock', blob(1, 1, d => 1 + Math.sin(d.x * 5 + d.z * 3) * 0.06, [4.2, 2.6, 3.2]), F.at(0, 0.2, -2.4), { tint: 0x8a7a5a });
  kit.add('paint', blob(1, 1, null, [4.3, 0.9, 3.3]), F.at(0, 2.2, -2.5), { tint: 0x6a9a3a, ao: false, cast: false });
  kit.add('planks', cyl(1.2, 1.2, 0.3, 24, 0.8), F.at(0, 1.25, 0.6, 0, 1, 1, 1, Math.PI / 2), { tint: 0x8a6a3a, ao: false });
  kit.add('metal', new THREE.TorusGeometry(1.24, 0.1, 6, 28), F.at(0, 1.25, 0.76), { tint: 0xc8a040, ao: false });
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; kit.add('metal', box(0.08, 0.9, 0.05, 1), F.at(Math.cos(a) * 0.55, 1.25 + Math.sin(a) * 0.55, 0.78, 0, 1, 1, 1, 0, a + Math.PI / 2), { tint: 0xc8a040, ao: false }); }
  kit.glow(sphere(0.22, 10, 8), F.at(0, 1.25, 0.82), 0x9aff6a, 2.6);
  kit.light(...F.world(0, 1.3).flatMap((v, i) => i === 0 ? [v, y + 1.3] : [v]), 0x9aff6a, 2.5, 5, 0.1);
  kit.block(S.rect(...F.world(0, -2.2), 8, 5.6, rot), 0.12);
}
/** a berry market stall: acorn-cap bowls of giant berries under a leaf awning */
export function berryStall(kit, x, y, z, rot = 0, { seed = 1, color = 0xff5a6a } = {}) {
  const F = new Frame(x, y, z, rot), r = new RNG(seed);
  kit.add('planks', box(2.2, 0.7, 0.9, 0.8), F.at(0, 0.35, 0), { tint: 0xb08050 });
  for (const sx of [-1, 1]) kit.add('timber', cyl(0.05, 0.06, 1.9, 5, 1), F.at(sx * 1.05, 0.95, -0.35), { tint: 0x6a4428 });
  const awn = new THREE.PlaneGeometry(2.6, 1.4, 4, 2); const ap = awn.attributes.position; for (let i = 0; i < ap.count; i++) ap.setZ(i, Math.sin((ap.getX(i) / 2.6 + 0.5) * Math.PI * 3) * 0.08); awn.computeVertexNormals();
  kit.add('paint', awn, F.at(0, 1.85, 0.1, 0, 1, 1, 1, -1.1), { tint: 0x5aa830, ao: false });
  const berries = [[0xd8203a, 0.13], [0x3a4ab8, 0.11], [0xe8b020, 0.12], [0x8a2a8a, 0.12]];
  for (let b = 0; b < 3; b++) {
    const bx = -0.7 + b * 0.7;
    kit.add('thatch', sphere(0.3, 10, 6, TAU, Math.PI / 2), F.at(bx, 0.72, 0.05, 0, 1, -0.6, 1), { tint: 0x8a6a3a, ao: false });
    const [c, rr] = r.pick(berries);
    for (let i = 0; i < 6; i++) kit.add('paint', sphere(rr, 8, 6), F.at(bx + r.range(-0.15, 0.15), 0.8 + (i > 3 ? rr : 0), 0.05 + r.range(-0.12, 0.12)), { tint: c, ao: false, cast: false });
  }
  void color;
  kit.block(S.rect(x, z, 2.3, 1.0, rot), 0.1);
}
/** a pebble boulder (Pip-scale rock) */
export function pebble(kit, x, y, z, { s = 1, seed = 1, tint = 0xb8b0a4, block = true } = {}) {
  const nz = new Simplex(seed % 7 + 3);
  const g = blob(1, 1, d => 1 + nz.noise3(d.x * 1.2, d.y * 1.2, d.z * 1.2) * 0.12, [1.2, 0.72, 1]);
  const c = linColor(tint);
  kit.add('rock', g, M(x, y + 0.45 * s, z, seed, s, s, s), { tint: (p, n) => { const t = clamp(n.y * 0.5 + 0.5, 0, 1); return lerpC(c.map(v => v * 0.72), c.map(v => Math.min(1, v * 1.15)), t); } });
  if (block) kit.block(S.circle(x, z, s * 1.12), 0.1);
}
/** clover plant: three heart leaves on a stem (Pip-sized shrub) */
export function clover(kit, x, y, z, { s = 1, seed = 1, four = false } = {}) {
  const r = new RNG(seed), n = four ? 4 : 3;
  kit.add('paint', cyl(0.03 * s, 0.04 * s, 0.9 * s, 5, 1), M(x, y + 0.45 * s, z), { tint: 0x4a8a2a, ao: false, cast: false });
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + r.range(0, 0.4);
    const lf = new THREE.CircleGeometry(0.34 * s, 10); lf.scale(1, 0.85, 1); lf.rotateX(-Math.PI / 2 + 0.25);
    kit.add('paint', lf, M(x + Math.cos(a) * 0.3 * s, y + 0.92 * s, z + Math.sin(a) * 0.3 * s, -a + Math.PI / 2), { tint: four ? 0x7ad040 : 0x5aa830, ao: false, cast: false });
  }
}
/** a big fallen leaf lying on the ground (rot, size) */
export function leafPad(kit, x, y, z, rot = 0, { s = 1.6, tint = 0x9ab040 } = {}) {
  const g = new THREE.CircleGeometry(1, 16); g.scale(0.55 * s, s, 1); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, Math.abs(p.getX(i)) * 0.3 + Math.sin(p.getZ(i) * 2) * 0.05);
  g.computeVertexNormals();
  kit.add('paint', g, M(x, y + 0.04, z, rot), { tint, ao: false, cast: false });
  kit.add('paint', box(0.03, 0.02, s * 1.9, 1), M(x, y + 0.06, z, rot), { tint: new THREE.Color(tint).multiplyScalar(0.7).getHex(), ao: false, cast: false });
}
/** instanced clutter geometry (MeshBuilder with colours + sway, for FieldFlora.thing with the foliage materials) */
import { MeshBuilder } from '../../engine/geom.js';
export function acornGeo() {
  const b = new MeshBuilder([{ name: 'sway', size: 1 }]);
  const nut = new THREE.SphereGeometry(0.2, 10, 8); nut.scale(1, 1.3, 1); nut.translate(0, 0.24, 0);
  b.add(nut, null, (p) => lerpC(linColor(0x9a5a28), linColor(0xd89a50), clamp(p.y / 0.4, 0, 1)), { extra: { sway: 0 } });
  const cap = new THREE.SphereGeometry(0.23, 10, 6, 0, TAU, 0, Math.PI / 2); cap.scale(1, 0.6, 1); cap.translate(0, 0.4, 0);
  b.add(cap, null, linColor(0x6a4a2a), { extra: { sway: 0 } });
  const st = new THREE.CylinderGeometry(0.025, 0.03, 0.14, 5); st.translate(0, 0.58, 0);
  b.add(st, null, linColor(0x4a3020), { extra: { sway: 0 } });
  const g = b.build(); g.rotateZ(1.2); return g;
}
export function twigGeo() {
  const b = new MeshBuilder([{ name: 'sway', size: 1 }]);
  const main = tube([V(-0.8, 0.05, 0), V(0, 0.08, 0.05), V(0.8, 0.05, -0.05)], [0.06, 0.05, 0.035], 5, true);
  b.add(main, null, linColor(0x7a5434), { extra: { sway: 0 } });
  const br = tube([V(0.1, 0.07, 0.03), V(0.4, 0.12, 0.35), V(0.55, 0.14, 0.5)], [0.035, 0.025, 0.015], 4, true);
  b.add(br, null, linColor(0x7a5434), { extra: { sway: 0 } });
  const lf = new THREE.CircleGeometry(0.16, 8); lf.scale(0.6, 1, 1); lf.rotateX(-Math.PI / 2); lf.translate(0.58, 0.16, 0.56);
  b.add(lf, null, linColor(0x8ab038), { extra: { sway: 0 } });
  return b.build();
}
