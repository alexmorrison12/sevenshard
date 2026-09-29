// Prop library. Every function merges geometry into a Kit (see kit.js) and, where it matters, registers a nav
// obstacle (kit.block), a light (kit.light) or a flame (kit.flame). Coordinates are world metres; y is the ground
// height at the prop (pass zone.heightAt(x, z)). rot = rotation about +Y; a prop's local +Z is its front.
import * as THREE from 'three';
import { RNG } from '../core/noise.js';
import { blob, tube } from '../engine/geom.js';
import { box, cyl, cone, sphere, gableRoof, M, Frame, extrude } from './kit.js';
import { circle, rect, line } from './shapes.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- containers
export function barrel(kit, x, y, z, s = 1, ry = 0, { block = true, tint = 0xa87850 } = {}) {
  const F = new Frame(x, y, z, ry);
  const bulge = new THREE.LatheGeometry([0, 0.1, 0.25, 0.45, 0.65, 0.8, 0.9].map((t, i, a) => new THREE.Vector2(0.3 + Math.sin(t / 0.9 * Math.PI) * 0.06, t)), 12);
  const uv = bulge.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.0, uv.getY(i) * 0.9);
  kit.add('planks', bulge, F.at(0, 0, 0, 0, s, s * 1.05, s), { tint, yGround: y });
  for (const hy of [0.14, 0.76]) kit.add('metal', cyl(0.345, 0.345, 0.07, 12, 1, true), F.at(0, hy * s, 0, 0, s, s, s), { tint: 0x3a3a3a, ao: false });
  kit.add('planks', cyl(0.3, 0.3, 0.02, 12, 1), F.at(0, 0.9 * s, 0, 0, s, s, s), { tint: 0x8a6040, ao: false });
  if (block) kit.block(circle(x, z, 0.36 * s));
}
export function crate(kit, x, y, z, s = 0.8, ry = 0, { block = true, tint = 0xc09060 } = {}) {
  const F = new Frame(x, y, z, ry);
  kit.add('planks', box(s, s, s, 0.9), F.at(0, s / 2, 0), { tint, yGround: y });
  const t = 0.07;
  for (const yy of [0.04, s - 0.04]) for (const [dx, dz, w, d] of [[0, s / 2, s + 0.02, t], [0, -s / 2, s + 0.02, t], [s / 2, 0, t, s], [-s / 2, 0, t, s]]) kit.add('timber', box(w, 0.08, d, 1), F.at(dx, yy, dz), { ao: false });
  for (const [dx, dz] of [[s / 2, s / 2], [-s / 2, s / 2], [s / 2, -s / 2], [-s / 2, -s / 2]]) kit.add('timber', box(0.08, s, 0.08, 1), F.at(dx, s / 2, dz), { ao: false });
  if (block) kit.block(rect(x, z, s, s, ry));
}
export function crateStack(kit, x, y, z, ry = 0, seed = 1) {
  const r = new RNG(seed);
  crate(kit, x, y, z, 0.9, ry);
  crate(kit, x + Math.cos(ry) * 1.0, y, z - Math.sin(ry) * 1.0, 0.8, ry + r.range(-0.2, 0.2));
  if (r.chance(0.7)) crate(kit, x + Math.cos(ry) * 0.4, y + 0.9, z - Math.sin(ry) * 0.4, 0.7, ry + r.range(-0.4, 0.4), { block: false });
  if (r.chance(0.6)) barrel(kit, x - Math.sin(ry) * 1.0, y, z - Math.cos(ry) * 1.0, 0.95, r.range(0, TAU));
}
export function sack(kit, x, y, z, s = 1, ry = 0, tint = 0xd8c49a) {
  kit.add('cloth', blob(0.3, 1, d => 1 + Math.max(0, d.y) * 0.25, [1, 1.1, 0.85]), M(x, y + 0.3 * s, z, ry, s, s, s), { tint, cast: true });
  kit.add('cloth', cyl(0.07, 0.12, 0.14, 8, 0.5), M(x, y + 0.66 * s, z, ry, s, s, s), { tint, ao: false });
}
export function pot(kit, x, y, z, s = 1, tint = 0xb8683a) {
  const pts = [[0.0, 0], [0.16, 0.02], [0.22, 0.12], [0.24, 0.26], [0.18, 0.4], [0.12, 0.46], [0.14, 0.5]].map(([r, h]) => new THREE.Vector2(r, h));
  const g = new THREE.LatheGeometry(pts, 12);
  kit.add('paint', g, M(x, y, z, 0, s, s, s), { tint });
}

// ---------------------------------------------------------------- street furniture
export function bench(kit, x, y, z, ry = 0, { w = 2.0 } = {}) {
  const F = new Frame(x, y, z, ry);
  kit.add('planks', box(w, 0.08, 0.5, 1), F.at(0, 0.46, 0), { tint: 0xb08050, ao: false });
  kit.add('planks', box(w, 0.35, 0.06, 1), F.at(0, 0.78, -0.24, 0, 1, 1, 1, -0.12), { tint: 0xb08050, ao: false });
  for (const s of [-1, 1]) {
    kit.add('metal', box(0.07, 0.45, 0.5), F.at(s * (w / 2 - 0.15), 0.22, 0), { tint: 0x2e2e34, ao: false });
    kit.add('metal', box(0.07, 0.5, 0.07), F.at(s * (w / 2 - 0.15), 0.72, -0.25, 0, 1, 1, 1, -0.12), { tint: 0x2e2e34, ao: false });
  }
  kit.block(rect(x, z, w, 0.55, ry), 0.25);
}
export function lampPost(kit, x, y, z, ry = 0, { h = 3.6, double = false, color = 0xffc070 } = {}) {
  const F = new Frame(x, y, z, ry);
  kit.add('stone', cyl(0.22, 0.26, 0.4, 8, 1), F.at(0, 0.2, 0), { tint: 0xd8d0c4 });
  kit.add('metal', cyl(0.06, 0.09, h, 8, 1), F.at(0, h / 2 + 0.2, 0), { tint: 0x26262c, ao: false });
  kit.add('metal', sphere(0.1, 8, 6), F.at(0, h + 0.25, 0), { tint: 0x26262c, ao: false });
  const arms = double ? [-1, 1] : [1];
  for (const s of arms) {
    kit.add('metal', tube([V(0, h - 0.1, 0), V(s * 0.25, h + 0.05, 0), V(s * 0.55, h - 0.02, 0)], [0.035, 0.03, 0.03], 5, false), F.m, { tint: 0x26262c, ao: false });
    // lantern: cap, glass box, base
    kit.add('metal', cone(0.2, 0.22, 4), F.at(s * 0.55, h - 0.02, 0, Math.PI / 4), { tint: 0x26262c, ao: false });
    kit.glow(box(0.22, 0.3, 0.22), F.at(s * 0.55, h - 0.3, 0), color, 2.6);
    kit.add('metal', box(0.28, 0.05, 0.28), F.at(s * 0.55, h - 0.47, 0), { tint: 0x26262c, ao: false });
    for (const [dx, dz] of [[0.12, 0.12], [-0.12, 0.12], [0.12, -0.12], [-0.12, -0.12]]) kit.add('metal', box(0.025, 0.32, 0.025), F.at(s * 0.55 + dx, h - 0.3, dz), { tint: 0x26262c, ao: false });
    const [lx, lz] = F.world(s * 0.55, 0);
    kit.light(lx, y + h - 0.35, lz, color, 5, 9, 0.06);
  }
  kit.block(circle(x, z, 0.26), 0.2);
}
export function wallTorch(kit, x, y, z, ry = 0) {
  // bracket on a wall face (local +Z out of the wall)
  const F = new Frame(x, y, z, ry);
  kit.add('metal', box(0.12, 0.3, 0.06), F.at(0, 0, 0.03), { tint: 0x2a2a2a, ao: false });
  kit.add('metal', tube([V(0, -0.05, 0.05), V(0, 0.05, 0.3), V(0, 0.25, 0.38)], [0.03, 0.03, 0.03], 5, false), F.m, { tint: 0x2a2a2a, ao: false });
  kit.add('timber', cyl(0.05, 0.035, 0.45, 6, 1), F.at(0, 0.38, 0.38, 0, 1, 1, 1, 0.2), { ao: false });
  kit.add('metal', cyl(0.09, 0.06, 0.12, 8, 1, true), F.at(0, 0.58, 0.42), { tint: 0x2a2a2a, ao: false });
  const [fx, fz] = F.world(0, 0.43);
  kit.flame(fx, y + 0.66, fz, 0.2);
  kit.light(fx, y + 0.9, fz, 0xff9a40, 5, 8, 0.3);
}
export function brazier(kit, x, y, z, { s = 1, color = 0xff9a40, glow = 0xffa050, legs = 3, base = 'metal' } = {}) {
  const F = new Frame(x, y, z, 0);
  const bowl = new THREE.LatheGeometry([[0.1, 0], [0.42, 0.06], [0.55, 0.22], [0.6, 0.34], [0.56, 0.36], [0.5, 0.26], [0.1, 0.14]].map(([r, h]) => new THREE.Vector2(r, h)), 14);
  kit.add(base, bowl, F.at(0, 0.95 * s, 0, 0, s, s, s), { tint: 0x3a3230, ao: false });
  for (let i = 0; i < legs; i++) {
    const a = i / legs * TAU;
    kit.add(base, tube([V(Math.cos(a) * 0.12, 1.0, Math.sin(a) * 0.12), V(Math.cos(a) * 0.4, 0.5, Math.sin(a) * 0.4), V(Math.cos(a) * 0.45, 0.0, Math.sin(a) * 0.45)], [0.05, 0.045, 0.06], 5, false), F.at(0, 0, 0, 0, s, s, s), { tint: 0x2e2826, ao: false });
  }
  kit.glow(cyl(0.48, 0.44, 0.08, 12), F.at(0, 1.26 * s, 0, 0, s, s, s), glow, 3.2);
  for (let i = 0; i < 5; i++) kit.add('dark', blob(0.12, 0), F.at(Math.cos(i * 1.3) * 0.25 * s, 1.3 * s, Math.sin(i * 1.3) * 0.25 * s), { tint: 0x201818, ao: false, cast: false });
  kit.flame(x, y + 1.3 * s, z, 0.55 * s, color);
  kit.light(x, y + 2.0 * s, z, glow, 9 * s, 12 * s, 0.3);
  kit.block(circle(x, z, 0.55 * s), 0.25);
}
export function planter(kit, x, y, z, { w = 1.6, d = 0.8, h = 0.6, ry = 0, flowers = [0xe04060, 0xf0d040, 0xffffff, 0xa060e0, 0xff8040], seed = 1, stone = true, block = true } = {}) {
  const F = new Frame(x, y, z, ry), r = new RNG(seed);
  kit.add(stone ? 'stone' : 'planks', box(w, h, d, 1), F.at(0, h / 2, 0), { tint: stone ? 0xe8e2d6 : 0xa07048, yGround: y });
  kit.add(stone ? 'stone' : 'timber', box(w + 0.1, 0.08, d + 0.1, 1), F.at(0, h + 0.02, 0), { tint: stone ? 0xf0ebe2 : 0x7a5030, ao: false });
  // foliage mound + flower heads
  kit.add('paint', blob(0.5, 1, dd => 1 + Math.sin(dd.x * 9) * 0.06, [w * 0.95, 0.5, d * 0.95]), F.at(0, h + 0.05, 0), { tint: 0x3a7a28, ao: false });
  const nf = Math.round(w * d * 14);
  for (let i = 0; i < nf; i++) {
    const c = r.pick(flowers);
    kit.add('paint', blob(r.range(0.06, 0.1), 0), F.at(r.range(-w / 2 + 0.1, w / 2 - 0.1), h + 0.18 + r.range(0, 0.18), r.range(-d / 2 + 0.08, d / 2 - 0.08)), { tint: c, ao: false, cast: false });
  }
  if (block) kit.block(rect(x, z, w, d, ry), 0.25);
}
export function flowerBox(kit, F, lx, ly, lz, w = 1.0, seed = 1) {
  const r = new RNG(seed);
  kit.add('planks', box(w, 0.22, 0.28, 1), F.at(lx, ly, lz), { tint: 0x8a5a38, ao: false });
  kit.add('paint', blob(0.2, 1, null, [w * 2.3, 0.6, 0.65]), F.at(lx, ly + 0.14, lz), { tint: 0x3f8030, ao: false, cast: false });
  for (let i = 0; i < Math.round(w * 7); i++) kit.add('paint', blob(r.range(0.05, 0.08), 0), F.at(lx + r.range(-w / 2 + 0.06, w / 2 - 0.06), ly + 0.2 + r.range(0, 0.1), lz + r.range(-0.1, 0.12)), { tint: r.pick([0xe03850, 0xf4d040, 0xffffff, 0xff7aa0, 0xa060e0]), ao: false, cast: false });
}
export function column(kit, x, y, z, h = 5, r = 0.4, { mat = 'marble', tint = 0xf2eee6, base = true, capital = true } = {}) {
  const F = new Frame(x, y, z, 0);
  if (base) { kit.add(mat, box(r * 2.6, 0.35, r * 2.6, 1), F.at(0, 0.175, 0), { tint, yGround: y }); kit.add(mat, cyl(r * 1.15, r * 1.25, 0.25, 16, 1), F.at(0, 0.47, 0), { tint }); }
  // fluted shaft (16 sides, alternating radius)
  const g = new THREE.CylinderGeometry(r, r * 1.06, h - 1.0, 24, 1, true);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const f = 1 - 0.05 * (0.5 + 0.5 * Math.cos(a * 12)); p.setXYZ(i, p.getX(i) * f, p.getY(i), p.getZ(i) * f); }
  g.computeVertexNormals();
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.5, uv.getY(i) * (h - 1) / 2);
  kit.add(mat, g, F.at(0, 0.6 + (h - 1.0) / 2, 0), { tint, yGround: y, aoH: 3 });
  if (capital) { kit.add(mat, cyl(r * 1.35, r * 1.02, 0.3, 16, 1), F.at(0, h - 0.25, 0), { tint }); kit.add(mat, box(r * 2.8, 0.25, r * 2.8, 1), F.at(0, h - 0.02, 0), { tint }); }
  kit.block(circle(x, z, r * 1.3), 0.25);
}
/** straight flight of steps rising along local -Z from (x,y,z): n steps of rise × run, width w */
export function stairs(kit, x, y, z, rot, { w = 4, n = 5, rise = 0.2, run = 0.4, mat = 'stone', tint = 0xe6e0d4, cheeks = true } = {}) {
  const F = new Frame(x, y, z, rot);
  for (let i = 0; i < n; i++) {
    const hh = (i + 1) * rise;
    kit.add(mat, box(w, hh, run, 1), F.at(0, hh / 2, -i * run - run / 2), { tint, ao: false });
    kit.add(mat, box(w + 0.02, 0.04, 0.06, 1), F.at(0, hh - 0.02, -i * run - 0.03), { tint: 0xffffff, ao: false });
  }
  if (cheeks) for (const s of [-1, 1]) {
    const len = n * run, top = n * rise;
    const outline = [[0, 0], [len, 0], [len, top + 0.35], [0, 0.45]];
    kit.add(mat, extrude(outline.map(([a, b]) => [a, b]), 0.4, 1), F.at(s * (w / 2 + 0.2), 0, 0, Math.PI / 2), { tint, yGround: y });
  }
}
/** crenellated wall between (ax,az)→(bx,bz); y fn gives ground height */
export function wall(kit, ax, az, bx, bz, hAt, { h = 5, t = 1.4, crenel = true, mat = 'stone', tint = 0xe8e2d6, walkway = false, buttress = 0 } = {}) {
  const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax);
  const n = Math.max(1, Math.ceil(len / 6));
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, tm = (t0 + t1) / 2;
    const x = ax + (bx - ax) * tm, z = az + (bz - az) * tm;
    const y = Math.min(hAt(ax + (bx - ax) * t0, az + (bz - az) * t0), hAt(x, z), hAt(ax + (bx - ax) * t1, az + (bz - az) * t1));
    const seg = len / n + 0.02;
    kit.add(mat, box(seg, h + 1, t, 2), M(x, y + (h - 1) / 2, z, ang), { tint, yGround: y, aoH: 3 });
    kit.add(mat, box(seg, 0.3, t + 0.25, 2), M(x, y + h + 0.05, z, ang), { tint: 0xf4f0e8, ao: false });
    if (crenel) {
      const m = Math.max(1, Math.round(seg / 1.3));
      for (let k = 0; k < m; k++) {
        const u = (k + 0.5) / m - 0.5;
        const cx = x + Math.cos(ang) * u * seg, cz = z - Math.sin(ang) * u * seg;
        kit.add(mat, box(seg / m * 0.55, 0.8, t * 0.45, 1), M(cx - Math.sin(ang) * t * 0.28, y + h + 0.6, cz - Math.cos(ang) * t * 0.28, ang), { tint, ao: false });
      }
    }
    if (buttress && i % buttress === 0) kit.add(mat, box(1.0, h * 0.7, 0.9, 2), M(x + Math.sin(ang) * (t / 2 + 0.35), y + h * 0.3, z + Math.cos(ang) * (t / 2 + 0.35), ang, 1, 1, 1, 0.08), { tint, yGround: y });
  }
  kit.block(line([[ax, az], [bx, bz]], t), 0.35);
}
export function tower(kit, x, y, z, { r = 3, h = 12, roof = 0x3a5a9a, roofH = 6, mat = 'stone', tint = 0xeae4d8, windows = true, flag = null, flags = null } = {}) {
  const F = new Frame(x, y, z, 0);
  kit.add(mat, cyl(r, r * 1.08, h, 20, 2), F.at(0, h / 2 - 0.5, 0), { tint, yGround: y, aoH: 5 });
  kit.add(mat, cyl(r * 1.12, r * 1.12, 0.5, 20, 2), F.at(0, h - 0.4, 0), { tint: 0xf6f2ea, ao: false });
  // corbels
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; kit.add(mat, box(0.3, 0.5, 0.3, 1), F.at(Math.cos(a) * r * 1.05, h - 0.9, Math.sin(a) * r * 1.05, -a), { tint, ao: false }); }
  if (roofH > 0) {
    kit.add('roof', cone(r * 1.25, roofH, 20, 2), F.at(0, h + roofH / 2 - 0.2, 0), { tint: roof, ao: false });
    kit.add('gold', cyl(0.05, 0.08, 1.4, 6, 1), F.at(0, h + roofH + 0.4, 0), { ao: false });
    kit.add('gold', sphere(0.14, 8, 6), F.at(0, h + roofH - 0.1, 0), { ao: false });
    if (flags) flags.add(F.at(0.05, h + roofH + 1.05, 0, 0), 1.2, 0.6, flag ?? 0x2a5aa8, { hang: 'left' });
  } else {
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; kit.add(mat, box(0.9, 0.9, 0.5, 1), F.at(Math.cos(a) * r * 1.05, h + 0.35, Math.sin(a) * r * 1.05, -a + Math.PI / 2), { tint, ao: false }); }
  }
  if (windows) for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.4, wy = h * (0.45 + i * 0.13);
    kit.add('window', box(0.6, 1.1, 0.12, 1), F.at(Math.cos(a) * r * 1.0, wy, Math.sin(a) * r * 1.0, -a + Math.PI / 2), { ao: false });
  }
  kit.block(circle(x, z, r * 1.08), 0.35);
}
export function stall(kit, x, y, z, ry = 0, { color = 0xc04040, goods = 'fruit', w = 2.8, seed = 1 } = {}) {
  const F = new Frame(x, y, z, ry), r = new RNG(seed);
  kit.add('planks', box(w, 0.9, 1.1, 1), F.at(0, 0.45, 0.1), { tint: 0xa87850, yGround: y });
  kit.add('planks', box(w + 0.1, 0.06, 1.25, 1), F.at(0, 0.93, 0.12), { tint: 0xc09060, ao: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add('timber', box(0.1, 2.6, 0.1, 1), F.at(sx * (w / 2 - 0.05), 1.3, sz * 0.6 - 0.05), { ao: false });
  // striped canopy, sloping to the front
  const stripes = Math.round(w / 0.4);
  for (let i = 0; i < stripes; i++) kit.add('cloth', box(w / stripes + 0.01, 0.03, 1.9, 1), F.at(-w / 2 + (i + 0.5) * w / stripes, 2.6, 0.25, 0, 1, 1, 1, 0.28), { tint: i % 2 ? color : 0xf2eadc, ao: false });
  // scalloped valance
  for (let i = 0; i < stripes * 2; i++) kit.add('cloth', cyl(0.11, 0.11, 0.03, 8, 1), F.at(-w / 2 + (i + 0.5) * w / stripes / 2, 2.3, 1.15, 0, 1, 1, 1, Math.PI / 2 - 0.28), { tint: i % 4 < 2 ? color : 0xf2eadc, ao: false, cast: false });
  // goods
  const pal = { fruit: [0xe03020, 0x60b030, 0xf0c030, 0xe07020, 0x9050c0], fish: [0x9ab0c0, 0xb0c0d0, 0x8aa0b0], cloth: [0xc04040, 0x4060c0, 0xe0c040, 0x40a060, 0xa050c0], pots: [0xb8683a, 0xa05030, 0xd08a50], potions: [0xe03030, 0x3070e0, 0x40c060, 0xc050e0] }[goods] || [0xe03020];
  for (let i = 0; i < 3; i++) kit.add('planks', box(w / 3 - 0.12, 0.12, 0.5, 1), F.at(-w / 3 + i * w / 3, 1.02, 0.25), { tint: 0x8a6040, ao: false });
  for (let i = 0; i < 16; i++) {
    const c = r.pick(pal), gx = r.range(-w / 2 + 0.2, w / 2 - 0.2), gz = r.range(0.05, 0.45);
    if (goods === 'cloth') kit.add('cloth', box(0.4, 0.1, 0.3, 1), F.at(gx, 1.05 + (i % 3) * 0.1, gz), { tint: c, ao: false, cast: false });
    else if (goods === 'potions') { kit.add('paint', cyl(0.05, 0.07, 0.18, 6, 1), F.at(gx, 1.18, gz), { tint: c, ao: false, cast: false }); }
    else if (goods === 'fish') kit.add('paint', blob(0.08, 0, null, [2.4, 0.5, 1]), F.at(gx, 1.12, gz, r.range(0, 3)), { tint: c, ao: false, cast: false });
    else if (goods === 'pots') { const [px, pz] = F.world(gx, gz); pot(kit, px, y + 1.08, pz, 0.5, c); }
    else kit.add('paint', blob(0.1, 0), F.at(gx, 1.14, gz), { tint: c, ao: false, cast: false });
  }
  // crates & baskets around
  { const [cx, cz] = F.world(w / 2 + 0.5, -0.2); crate(kit, cx, y, cz, 0.7, ry + 0.3); }
  { const [sx, sz] = F.world(-w / 2 - 0.45, 0.3); sack(kit, sx, y, sz, 1, r.range(0, 3)); }
  kit.block(rect(x, z, w + 0.3, 1.5, ry), 0.3);
}
export function cart(kit, x, y, z, ry = 0, { load = 0xd8c8a0 } = {}) {
  const F = new Frame(x, y, z, ry);
  kit.add('planks', box(1.6, 0.4, 2.6, 1), F.at(0, 0.95, 0), { tint: 0xa87850 });
  for (const s of [-1, 1]) {
    kit.add('planks', box(0.08, 0.45, 2.6, 1), F.at(s * 0.8, 1.35, 0), { tint: 0x9a6a40, ao: false });
    const wheel = new THREE.TorusGeometry(0.5, 0.07, 6, 16);
    kit.add('timber', wheel, F.at(s * 0.88, 0.55, -0.3, Math.PI / 2), { ao: false });
    for (let k = 0; k < 4; k++) kit.add('timber', box(0.05, 0.95, 0.05, 1), F.at(s * 0.88, 0.55, -0.3, 0, 1, 1, 1, k * Math.PI / 4), { ao: false });
    kit.add('timber', box(0.07, 0.07, 1.6, 1), F.at(s * 0.45, 0.85, 2.0), { ao: false });
  }
  for (let i = 0; i < 4; i++) { const [sx, sz] = F.world(-0.35 + (i % 2) * 0.7, -0.6 + Math.floor(i / 2) * 0.7); sack(kit, sx, y + 1.1, sz, 0.9, i, load); }
  kit.block(rect(x, z, 1.9, 3.2, ry), 0.3);
}
export function well(kit, x, y, z) {
  const F = new Frame(x, y, z, 0);
  kit.add('stone', cyl(1.2, 1.3, 1.0, 16, 1.4), F.at(0, 0.5, 0), { tint: 0xe0d8cc, yGround: y });
  kit.add('stone', cyl(1.3, 1.3, 0.14, 16, 1.4), F.at(0, 1.02, 0), { tint: 0xf0ebe2, ao: false });
  for (const s of [-1, 1]) kit.add('timber', box(0.18, 2.3, 0.18, 1), F.at(s * 1.05, 1.6, 0), {});
  kit.add('timber', box(2.4, 0.16, 0.16, 1), F.at(0, 2.5, 0), { ao: false });
  const { roof } = gableRoof(2.6, 2.0, 0.8, 0.2, 0.1, 2);
  kit.add('roof', roof, F.at(0, 2.65, 0), { tint: 0x3a5a9a, ao: false });
  kit.add('planks', cyl(0.2, 0.17, 0.32, 8, 1), F.at(0.2, 1.8, 0), { ao: false, tint: 0x9a7048 });
  kit.block(circle(x, z, 1.35), 0.3);
}
export function noticeBoard(kit, x, y, z, ry = 0) {
  const F = new Frame(x, y, z, ry);
  for (const s of [-1, 1]) kit.add('timber', box(0.16, 2.4, 0.16, 1), F.at(s * 1.0, 1.2, 0), {});
  kit.add('planks', box(2.3, 1.3, 0.1, 1), F.at(0, 1.55, 0.02), { tint: 0xa87850 });
  const { roof } = gableRoof(2.6, 0.7, 0.35, 0.12, 0.08, 2);
  kit.add('roof', roof, F.at(0, 2.35, 0.02), { tint: 0x9a3a2a, ao: false });
  const r = new RNG(Math.round(x * 13 + z));
  for (let i = 0; i < 7; i++) kit.add('paint', box(r.range(0.3, 0.45), r.range(0.3, 0.5), 0.02, 1), F.at(r.range(-0.85, 0.85), 1.55 + r.range(-0.4, 0.4), 0.09, 0, 1, 1, 1, 0, r.range(-0.12, 0.12)), { tint: r.pick([0xf0e6cc, 0xe8dcc0, 0xf4ecd8, 0xe0d0b0]), ao: false, cast: false });
  kit.block(rect(x, z, 2.4, 0.4, ry), 0.3);
}
export function mailbox(kit, x, y, z, ry = 0) {
  const F = new Frame(x, y, z, ry);
  kit.add('metal', cyl(0.06, 0.08, 1.0, 6, 1), F.at(0, 0.5, 0), { tint: 0x2a2a30, ao: false });
  kit.add('paint', box(0.6, 0.55, 0.45, 1), F.at(0, 1.25, 0), { tint: 0x2a4f9a });
  kit.add('paint', cyl(0.3, 0.3, 0.45, 12, 1), F.at(0, 1.52, 0, 0, 1, 1, 1, Math.PI / 2), { tint: 0x2a4f9a });
  kit.add('gold', box(0.32, 0.05, 0.03, 1), F.at(0, 1.35, 0.23), { ao: false });
  kit.add('gold', sphere(0.06, 6, 4), F.at(0, 1.85, 0), { ao: false });
  kit.block(circle(x, z, 0.4), 0.25);
}
export function anvil(kit, x, y, z, ry = 0, { hot = true } = {}) {
  const F = new Frame(x, y, z, ry);
  kit.add('timber', cyl(0.36, 0.42, 0.55, 10, 1), F.at(0, 0.27, 0), {});
  kit.add('metal', box(0.35, 0.3, 0.3, 1), F.at(0, 0.7, 0), { tint: 0x3a3a40 });
  kit.add('metal', box(0.8, 0.18, 0.34, 1), F.at(0, 0.92, 0), { tint: 0x3a3a40 });
  kit.add('metal', cone(0.17, 0.4, 8, 1), F.at(0.58, 0.93, 0, 0, 1, 1, 1, 0, -Math.PI / 2), { tint: 0x3a3a40 });
  if (hot) { kit.glow(box(0.5, 0.05, 0.08, 1), F.at(-0.05, 1.03, 0.02), 0xff6a20, 4); kit.light(x, y + 1.3, z, 0xff7a30, 3, 5, 0.4); }
  kit.block(circle(x, z, 0.55), 0.25);
}
export function weaponRack(kit, x, y, z, ry = 0) {
  const F = new Frame(x, y, z, ry);
  for (const s of [-1, 1]) kit.add('timber', box(0.12, 1.8, 0.12, 1), F.at(s * 1.0, 0.9, 0), {});
  kit.add('timber', box(2.2, 0.1, 0.12, 1), F.at(0, 1.6, 0), { ao: false });
  kit.add('timber', box(2.2, 0.1, 0.4, 1), F.at(0, 0.25, 0.1), { ao: false });
  for (let i = 0; i < 5; i++) {
    const lx = -0.8 + i * 0.4;
    kit.add('metal', box(0.07, 1.25, 0.02, 1), F.at(lx, 1.0, 0.08, 0, 1, 1, 1, 0.08), { tint: 0xc8d0dc, ao: false });
    kit.add('metal', box(0.26, 0.05, 0.06, 1), F.at(lx, 0.4, 0.08), { tint: 0x8a6a30, ao: false });
    kit.add('timber', box(0.05, 0.25, 0.05, 1), F.at(lx, 0.25, 0.08), { ao: false });
  }
  kit.block(rect(x, z, 2.3, 0.5, ry), 0.25);
}
export function hay(kit, x, y, z, s = 1, ry = 0) {
  kit.add('thatch', box(1.2, 0.6, 0.7, 1), M(x, y + 0.3 * s, z, ry, s, s, s), { tint: 0xf0d080 });
  kit.block(rect(x, z, 1.2 * s, 0.7 * s, ry), 0.25);
}
export function dummy(kit, x, y, z, ry = 0) {
  // training dummy: post, straw body, crossbar arms, sack head
  const F = new Frame(x, y, z, ry);
  kit.add('timber', cyl(0.07, 0.08, 1.9, 8, 1), F.at(0, 0.95, 0), {});
  kit.add('thatch', cyl(0.28, 0.24, 0.8, 10, 1), F.at(0, 1.25, 0), { tint: 0xf0d8a0 });
  kit.add('timber', box(1.3, 0.08, 0.08, 1), F.at(0, 1.5, 0), { ao: false });
  kit.add('cloth', sphere(0.2, 10, 8), F.at(0, 1.85, 0), { tint: 0xd8c49a });
  kit.add('metal', box(0.9, 0.05, 0.05, 1), F.at(0, 1.3, 0.26), { tint: 0x5a4a3a, ao: false });
  kit.add('planks', cyl(0.4, 0.45, 0.12, 10, 1), F.at(0, 0.06, 0), { tint: 0x8a6040 });
  kit.block(circle(x, z, 0.45), 0.25);
}
/** banner hanging from a wall bracket or pole (uses Flags for motion) */
export function banner(kit, flags, x, y, z, ry, { w = 1.2, h = 3.2, color = 0x2a5aa8, trim = 0xd8b060, pole = true } = {}) {
  const F = new Frame(x, y, z, ry);
  if (pole) {
    kit.add('metal', box(w + 0.4, 0.08, 0.08, 1), F.at(0, 0, 0.35), { tint: 0x2a2a2a, ao: false });
    for (const s of [-1, 1]) kit.add('gold', sphere(0.07, 6, 4), F.at(s * (w / 2 + 0.22), 0, 0.35), { ao: false });
    kit.add('metal', box(0.06, 0.06, 0.35, 1), F.at(0, 0, 0.18), { tint: 0x2a2a2a, ao: false });
  }
  flags.add(F.at(0, -0.02, 0.38), w, h, color, { hang: 'top', trim });
}
/** a string of glowing lanterns between two points (catenary), e.g. across a market street */
export function lanternString(kit, a, b, { sag = 1.2, n = 7, colors = [0xffc060, 0xff8a50, 0xffe090] } = {}) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    pts.push(V(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t));
  }
  kit.add('metal', tube(pts, pts.map(() => 0.015), 3, false), null, { tint: 0x2a2420, ao: false, chunkAt: [(a[0] + b[0]) / 2, (a[2] + b[2]) / 2] });
  for (let i = 1; i < n + 1; i++) {
    const t = i / (n + 1);
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, z = a[2] + (b[2] - a[2]) * t;
    const c = colors[i % colors.length];
    kit.glow(sphere(0.13, 8, 6), M(x, y - 0.18, z, 0, 1, 1.25, 1), c, 2.4);
    kit.add('metal', cyl(0.05, 0.08, 0.05, 6, 1), M(x, y - 0.03, z), { tint: 0x2a2420, ao: false });
  }
}
/** fountain: stacked basins with water surfaces (returns water rects for water.js) */
export function fountain(kit, x, y, z, { r = 5, tiers = 3, tint = 0xf2ede4 } = {}) {
  const F = new Frame(x, y, z, 0);
  const water = [];
  // outer basin: low wall with a rounded cap, 16-gon
  const seg = 24;
  kit.add('marble', cyl(r, r + 0.1, 0.75, seg, 2, true), F.at(0, 0.37, 0), { tint, yGround: y });
  kit.add('marble', cyl(r - 0.45, r - 0.45, 0.75, seg, 2, true), F.at(0, 0.37, 0), { tint: 0xd8d2c8, yGround: y - 0.4 });
  const capG = new THREE.TorusGeometry(r - 0.22, 0.3, 6, seg); capG.rotateX(Math.PI / 2);
  kit.add('marble', capG, F.at(0, 0.78, 0, 0, 1, 0.55, 1), { tint, ao: false });
  kit.add('stone', cyl(r - 0.4, r - 0.4, 0.1, seg, 2), F.at(0, 0.12, 0), { tint: 0x5a6a70, ao: false });
  water.push({ x, z, r: r - 0.45, y: y + 0.55 });
  // central tiers
  let tr = r * 0.42, th = 1.4;
  for (let t = 0; t < tiers - 1; t++) {
    const yb = 0.6 + t * 1.5;
    kit.add('marble', cyl(0.35 - t * 0.06, 0.55 - t * 0.08, th, 12, 1), F.at(0, yb + th / 2, 0), { tint });
    const bowl = new THREE.LatheGeometry([[0.2, 0], [tr * 0.6, 0.05], [tr, 0.3], [tr + 0.12, 0.45], [tr - 0.05, 0.42], [0.2, 0.25]].map(([a, b]) => new THREE.Vector2(a, b)), 20);
    kit.add('marble', bowl, F.at(0, yb + th - 0.05, 0), { tint, ao: false });
    water.push({ x, z, r: tr - 0.08, y: y + yb + th + 0.36 });
    tr *= 0.62;
  }
  kit.block(circle(x, z, r + 0.1), 0.3);
  return water;
}

/** stone balustrade from a→b at height y (absolute): rail, balusters, end posts */
export function balustrade(kit, ax, az, bx, bz, y, { h = 1.0, tint = 0xf4f0e8, block = true } = {}) {
  const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax);
  const cx = (ax + bx) / 2, cz = (az + bz) / 2;
  kit.add('stone', box(len, 0.16, 0.42, 1), M(cx, y + h, cz, ang), { tint, ao: false });
  kit.add('stone', box(len, 0.2, 0.38, 1), M(cx, y + 0.1, cz, ang), { tint, ao: false });
  const n = Math.round(len / 0.34);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    const lat = new THREE.LatheGeometry([[0.07, 0], [0.11, 0.1], [0.06, 0.3], [0.13, 0.5], [0.08, 0.72], [0.1, 0.8]].map(([r, hh]) => new THREE.Vector2(r, hh * (h - 0.2) / 0.8)), 6);
    kit.add('stone', lat, M(x, y + 0.18, z), { tint, ao: false });
  }
  for (const [px, pz] of [[ax, az], [bx, bz]]) { kit.add('stone', box(0.45, h + 0.25, 0.45, 1), M(px, y + (h + 0.25) / 2, pz, ang), { tint }); kit.add('stone', sphere(0.2, 8, 6), M(px, y + h + 0.42, pz), { tint, ao: false }); }
  if (block) kit.block(line([[ax, az], [bx, bz]], 0.45), 0.3);
}
/** retaining wall face along a→b from yLow up to yHigh (terrace edge), with a balustrade on top */
export function retaining(kit, ax, az, bx, bz, yLow, yHigh, { rail = true, tint = 0xe8e2d6 } = {}) {
  const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax);
  const cx = (ax + bx) / 2, cz = (az + bz) / 2, hh = yHigh - yLow + 1.2;
  kit.add('stone', box(len, hh, 1.2, 2), M(cx, yLow - 1.2 + hh / 2, cz, ang), { tint, yGround: yLow, aoH: 2.5 });
  kit.add('stone', box(len + 0.1, 0.25, 1.4, 1), M(cx, yHigh + 0.02, cz, ang), { tint: 0xf8f4ec, ao: false });
  const n = Math.max(1, Math.round(len / 5));
  for (let i = 0; i <= n; i++) { const t = i / n; kit.add('stone', box(0.7, hh - 0.2, 0.5, 1), M(ax + (bx - ax) * t + Math.sin(ang) * 0.7, yLow - 1.2 + (hh - 0.2) / 2, az + (bz - az) * t + Math.cos(ang) * 0.7, ang), { tint, yGround: yLow }); }
  if (rail) balustrade(kit, ax, az, bx, bz, yHigh, { block: true });
  else kit.block(line([[ax, az], [bx, bz]], 1.2), 0.3);
}
export function gazebo(kit, x, y, z, { r = 3.2, roof = 0x3d62a8 } = {}) {
  const F = new Frame(x, y, z, 0);
  kit.add('marble', cyl(r + 0.4, r + 0.5, 0.45, 8, 2), F.at(0, 0.22, 0), { tint: 0xf2eee6, yGround: y });
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + TAU / 16; const [cx, cz] = F.world(Math.cos(a) * r, Math.sin(a) * r); column(kit, cx, y + 0.45, cz, 3.2, 0.16, { base: false }); }
  kit.add('marble', cyl(r + 0.3, r + 0.3, 0.35, 8, 2), F.at(0, 3.8, 0), { tint: 0xfaf7f0, ao: false });
  kit.add('roof', cone(r + 0.9, 2.4, 8, 2), F.at(0, 5.15, 0, TAU / 16), { tint: roof, ao: false });
  kit.add('gold', sphere(0.2, 8, 6), F.at(0, 6.45, 0), { ao: false });
}
/** octagonal market kiosk (e.g. the Market Broker) */
export function kiosk(kit, x, y, z, rot, { color = 0x2f5fa8 } = {}) {
  const F = new Frame(x, y, z, rot);
  kit.add('planks', cyl(1.9, 2.0, 1.05, 8, 1), F.at(0, 0.52, 0), { tint: 0x9a6a40, yGround: y });
  kit.add('planks', cyl(2.1, 2.1, 0.08, 8, 1), F.at(0, 1.08, 0), { tint: 0xc09060, ao: false });
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; kit.add('timber', box(0.12, 2.6, 0.12, 1), F.at(Math.cos(a) * 1.85, 1.3, Math.sin(a) * 1.85), { ao: false }); }
  for (let i = 0; i < 8; i++) { const seg = new THREE.ConeGeometry(2.7, 1.4, 2, 1, true, i / 8 * TAU, TAU / 8); kit.add('cloth', seg, F.at(0, 3.25, 0), { tint: i % 2 ? color : 0xf2eadc, ao: false }); }
  for (let i = 0; i < 16; i++) { const a = (i + 0.5) / 16 * TAU; kit.add('cloth', cyl(0.3, 0.3, 0.03, 8, 1), F.at(Math.cos(a) * 2.62, 2.42, -Math.sin(a) * 2.62, a + Math.PI / 2, 1, 1, 1, Math.PI / 2 - 0.47), { tint: (i >> 1) % 2 ? color : 0xf2eadc, ao: false, cast: false }); }
  kit.add('gold', sphere(0.14, 6, 4), F.at(0, 4.05, 0), { ao: false });
  for (let i = 0; i < 10; i++) kit.add('paint', box(0.3, 0.1, 0.22, 1), F.at(Math.cos(i) * 1.5, 1.16 + (i % 2) * 0.1, Math.sin(i) * 1.5, i), { tint: [0xd0b060, 0x8a5a3a, 0xf0e8d0, 0x6a8ac0][i % 4], ao: false, cast: false });
  kit.block(circle(x, z, 2.1), 0.3);
}
export function fenceLine(kit, pts, hAt, { post = 2.2, tint = 0x9a7048 } = {}) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / post)), ang = Math.atan2(-(bz - az), bx - ax);
    for (let k = 0; k <= n; k++) { const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; kit.add('timber', box(0.14, 1.1, 0.14, 1), M(x, hAt(x, z) + 0.5, z, ang), { tint }); }
    for (const hy of [0.45, 0.85]) kit.add('planks', box(len, 0.1, 0.06, 1.5), M((ax + bx) / 2, hAt((ax + bx) / 2, (az + bz) / 2) + hy, (az + bz) / 2, ang), { tint, ao: false });
    kit.block(line([[ax, az], [bx, bz]], 0.2), 0.3);
  }
}

// ---------------------------------------------------------------- harbour & workshop clutter
export function ropeCoil(kit, x, y, z, s = 1) {
  const g = new THREE.TorusGeometry(0.32 * s, 0.07 * s, 6, 16); g.rotateX(Math.PI / 2);
  kit.add('cloth', g, M(x, y + 0.07 * s, z), { tint: 0xb89a68, ao: false });
  const g2 = new THREE.TorusGeometry(0.22 * s, 0.065 * s, 6, 14); g2.rotateX(Math.PI / 2);
  kit.add('cloth', g2, M(x, y + 0.19 * s, z), { tint: 0xa88a58, ao: false });
}
export function fishBasket(kit, x, y, z, ry = 0) {
  kit.add('thatch', cyl(0.36, 0.28, 0.42, 10, 1, true), M(x, y + 0.21, z, ry), { tint: 0xc8a060 });
  for (let i = 0; i < 5; i++) kit.add('paint', blob(0.07, 0, null, [2.6, 0.5, 1]), M(x + Math.cos(i * 1.3) * 0.16, y + 0.4, z + Math.sin(i * 1.3) * 0.16, i), { tint: i % 2 ? 0x9ab4c4 : 0xb8c8d0, ao: false, cast: false });
  kit.block(circle(x, z, 0.38), 0.2);
}
export function anchorProp(kit, x, y, z, ry = 0) {
  const F = new Frame(x, y, z, ry);
  kit.add('metal', box(0.12, 1.6, 0.12, 1), F.at(0, 0.3, 0, 0, 1, 1, 1, 1.25), { tint: 0x3a3a40, ao: false });
  const arc = new THREE.TorusGeometry(0.55, 0.07, 6, 12, Math.PI); arc.rotateY(Math.PI / 2);
  kit.add('metal', arc, F.at(0, 0.12, -0.6, 0, 1, 1, 1, Math.PI / 2 + 1.25), { tint: 0x3a3a40, ao: false });
  const ring = new THREE.TorusGeometry(0.16, 0.035, 6, 12);
  kit.add('metal', ring, F.at(0, 0.08, 0.78, 0, 1, 1, 1, Math.PI / 2), { tint: 0x3a3a40, ao: false });
}
export function net(kit, x, y, z, ry = 0, { w = 2.4, d = 1.6 } = {}) {
  const g = new THREE.PlaneGeometry(w, d, 8, 6); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, 0.05 + Math.sin(p.getX(i) * 3.1) * 0.04 + Math.cos(p.getZ(i) * 4.2) * 0.04);
  g.computeVertexNormals();
  kit.add('cloth', g, M(x, y, z, ry), { tint: 0x6a7a6a, ao: false, cast: false });
  for (let i = 0; i < 4; i++) kit.add('paint', sphere(0.08, 6, 4), M(x + Math.cos(ry) * (i - 1.5) * 0.5, y + 0.1, z - Math.sin(ry) * (i - 1.5) * 0.5 + 0.6), { tint: 0xd06030, ao: false, cast: false });
}
export function logPile(kit, x, y, z, ry = 0, { n = 3, len = 2.4 } = {}) {
  const F = new Frame(x, y, z, ry);
  let k = 0;
  for (let row = 0; row < n; row++) for (let i = 0; i < n - row; i++) {
    kit.add('timber', cyl(0.18, 0.18, len, 8, 1), F.at((i - (n - row - 1) / 2) * 0.38, 0.18 + row * 0.32, 0, 0, 1, 1, 1, Math.PI / 2), { tint: [0xa87850, 0x9a6a44, 0xb08058][k++ % 3] });
    for (const s of [-1, 1]) kit.add('planks', cyl(0.17, 0.17, 0.02, 8, 1), F.at((i - (n - row - 1) / 2) * 0.38, 0.18 + row * 0.32, s * len / 2, 0, 1, 1, 1, Math.PI / 2), { tint: 0xd8b888, ao: false, cast: false });
  }
  kit.block(rect(x, z, n * 0.4, len, ry), 0.25);
}
export function coalPile(kit, x, y, z, s = 1) {
  kit.add('dark', blob(0.6 * s, 1, d => 1 + Math.sin(d.x * 9 + d.z * 7) * 0.08, [1.2, 0.45, 1]), M(x, y, z), { tint: 0x1c1818, cast: false });
}
export function flowerPot(kit, x, y, z, { s = 1, color = 0xe04060 } = {}) {
  const pts = [[0.0, 0], [0.18, 0.0], [0.24, 0.36], [0.28, 0.42], [0.22, 0.42]].map(([r, h]) => new THREE.Vector2(r * s, h * s));
  kit.add('paint', new THREE.LatheGeometry(pts, 10), M(x, y, z), { tint: 0xb4603a });
  kit.add('paint', blob(0.26 * s, 1, null, [1, 0.8, 1]), M(x, y + 0.5 * s, z), { tint: 0x3a7a2a, ao: false });
  for (let i = 0; i < 6; i++) kit.add('paint', blob(0.06 * s, 0), M(x + Math.cos(i * 1.1) * 0.16 * s, y + 0.62 * s + (i % 2) * 0.05, z + Math.sin(i * 1.1) * 0.16 * s), { tint: color, ao: false, cast: false });
  kit.block(circle(x, z, 0.3 * s), 0.2);
}
export function bollard(kit, x, y, z) {
  kit.add('metal', cyl(0.14, 0.18, 0.6, 8, 1), M(x, y + 0.3, z), { tint: 0x2a2a30 });
  kit.add('metal', sphere(0.16, 8, 6, Math.PI * 2, Math.PI / 2), M(x, y + 0.6, z), { tint: 0x2a2a30, ao: false });
  kit.block(circle(x, z, 0.2), 0.2);
}
export function statue(kit, x, y, z, ry = 0, { s = 1, pose = 'sword' } = {}) {
  // a heroic knight on a plinth, carved from primitives
  const F = new Frame(x, y, z, ry);
  kit.add('stone', box(1.8 * s, 1.4 * s, 1.8 * s, 1), F.at(0, 0.7 * s, 0), { tint: 0xe6e0d4, yGround: y });
  kit.add('stone', box(2.0 * s, 0.2 * s, 2.0 * s, 1), F.at(0, 1.45 * s, 0), { tint: 0xf4f0e8, ao: false });
  const G = F.m.clone().multiply(M(0, 1.55 * s, 0, 0, s, s, s));
  const at = (...a) => G.clone().multiply(M(...a));
  kit.add('marble', cone(0.55, 1.6, 10, 1), at(0, 0.8, 0), { tint: 0xf2eee6 });                  // cloak / skirt
  kit.add('marble', cyl(0.3, 0.38, 0.8, 10, 1), at(0, 1.9, 0), { tint: 0xf2eee6 });              // torso
  kit.add('marble', sphere(0.44, 10, 6, Math.PI * 2, Math.PI / 2), at(0, 2.18, 0, 0, 1.2, 0.5, 0.9), { tint: 0xf2eee6 }); // pauldrons
  kit.add('marble', sphere(0.2, 10, 8), at(0, 2.55, 0), { tint: 0xf2eee6 });                     // head
  if (pose === 'sword') {
    kit.add('marble', tube([V(0.36, 2.15, 0), V(0.3, 2.7, 0.15), V(0.12, 3.2, 0.2)], [0.09, 0.08, 0.07], 6, true), G, { tint: 0xf2eee6, ao: false });
    kit.add('marble', box(0.08, 1.9, 0.02, 1), at(0.1, 4.1, 0.2), { tint: 0xfaf7f0, ao: false });
    kit.add('gold', box(0.5, 0.07, 0.08, 1), at(0.1, 3.2, 0.2), { ao: false });
  } else {
    kit.add('marble', tube([V(0.36, 2.15, 0), V(0.42, 1.7, 0.2), V(0.3, 1.3, 0.3)], [0.09, 0.08, 0.07], 6, true), G, { tint: 0xf2eee6, ao: false });
  }
  kit.add('marble', tube([V(-0.36, 2.15, 0), V(-0.45, 1.75, 0.15), V(-0.35, 1.35, 0.25)], [0.09, 0.08, 0.07], 6, true), G, { tint: 0xf2eee6, ao: false });
  kit.add('marble', cyl(0.42, 0.42, 0.06, 12, 1), at(-0.5, 1.6, 0.35, 0, 1, 1, 1, Math.PI / 2 - 0.3, 0.2), { tint: 0xece6dc, ao: false }); // shield
  kit.block(rect(x, z, 1.9 * s, 1.9 * s, ry), 0.3);
}

/** iron wall lantern on a bracket (local +Z out of the wall), warm glow + pooled light */
export function wallLamp(kit, x, y, z, ry = 0, { color = 0xffc070 } = {}) {
  const F = new Frame(x, y, z, ry);
  kit.add('metal', box(0.1, 0.28, 0.05, 1), F.at(0, 0, 0.03), { tint: 0x26262c, ao: false });
  kit.add('metal', tube([V(0, 0.05, 0.05), V(0, 0.18, 0.3), V(0, 0.1, 0.42)], [0.022, 0.02, 0.02], 4, false), F.m, { tint: 0x26262c, ao: false });
  kit.add('metal', cone(0.13, 0.14, 4), F.at(0, 0.02, 0.42, Math.PI / 4), { tint: 0x26262c, ao: false });
  kit.glow(box(0.14, 0.2, 0.14, 1), F.at(0, -0.15, 0.42), color, 2.4);
  kit.add('metal', box(0.18, 0.03, 0.18, 1), F.at(0, -0.27, 0.42), { tint: 0x26262c, ao: false });
  const [lx, lz] = F.world(0, 0.5);
  kit.light(lx, y - 0.1, lz, color, 3.5, 7, 0.05);
}

/** a line of triangular pennants (bunting) strung between two points */
export function bunting(kit, a, b, { sag = 0.8, colors = [0xc03a3a, 0x2f5fa8, 0xe8b830, 0x2f8a5a, 0xf2eadc], size = 0.42 } = {}) {
  const pts = [], n = 16;
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(V(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t)); }
  kit.add('metal', tube(pts, pts.map(() => 0.012), 3, false), null, { tint: 0x3a3028, ao: false, chunkAt: [(a[0] + b[0]) / 2, (a[2] + b[2]) / 2] });
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]), m = Math.floor(len / (size * 1.25));
  const ang = Math.atan2(-(b[2] - a[2]), b[0] - a[0]);
  for (let i = 1; i < m; i++) {
    const t = i / m, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, z = a[2] + (b[2] - a[2]) * t;
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-size / 2, 0, 0, size / 2, 0, 0, 0, -size * 1.1, 0], 3));
    tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2));
    tri.setIndex([0, 2, 1]); tri.computeVertexNormals();
    kit.add('cloth', tri, M(x, y, z, ang, 1, 1, 1, 0.12 * Math.sin(i * 1.7)), { tint: colors[i % colors.length], ao: false, cast: false });
  }
}
/** round stone planter with a street tree socket (returns the tree spot); flowers ring the soil */
export function roundPlanter(kit, x, y, z, { r = 1.3, seed = 1, flowers = true } = {}) {
  const rng = new RNG(seed);
  kit.add('stone', cyl(r, r + 0.08, 0.55, 16, 1), M(x, y + 0.27, z), { tint: 0xe8e2d6, yGround: y });
  const rim = new THREE.TorusGeometry(r - 0.06, 0.1, 5, 20); rim.rotateX(Math.PI / 2);
  kit.add('stone', rim, M(x, y + 0.56, z), { tint: 0xf6f2ea, ao: false });
  kit.add('paint', cyl(r - 0.1, r - 0.1, 0.06, 16, 1), M(x, y + 0.5, z), { tint: 0x4a3424, ao: false, cast: false });
  if (flowers) for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + rng.range(-0.1, 0.1), rr = r - 0.3 + rng.range(-0.1, 0.1); kit.add('paint', blob(rng.range(0.1, 0.15), 0), M(x + Math.cos(a) * rr, y + 0.62, z + Math.sin(a) * rr), { tint: i % 3 ? 0x3e8030 : rng.pick([0xe04060, 0xf4d040, 0xffffff, 0xff8ab0]), ao: false, cast: false }); }
  kit.block(circle(x, z, r + 0.05), 0.3);
  return [x, y + 0.5, z];
}
/** tall flag pole with a gilded finial; the banner itself waves (Flags) */
export function flagPole(kit, flags, x, y, z, { h = 9, color = 0x2a5aa8, w = 1.4, len = 3.2 } = {}) {
  kit.add('stone', cyl(0.45, 0.55, 0.5, 10, 1), M(x, y + 0.25, z), { tint: 0xe6e0d4, yGround: y });
  kit.add('metal', cyl(0.06, 0.09, h, 8, 1), M(x, y + h / 2 + 0.4, z), { tint: 0x2a2a30, ao: false });
  kit.add('gold', sphere(0.14, 8, 6), M(x, y + h + 0.5, z), { ao: false });
  if (flags) flags.add(M(x + 0.06, y + h + 0.2, z), len, w, color, { hang: 'left', segs: 8 });
  kit.block(circle(x, z, 0.5), 0.25);
}
