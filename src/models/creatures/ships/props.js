// Deck furniture and fittings: cannons (recoil anim), gunports, lanterns (flicker / sway), helm wheel (spins),
// windows, balustrades, ladders, hatches, cargo (barrels, crates, sacks), rope coils, capstan, bell.
import * as THREE from 'three';
import { V3, M, MY, MB, cyl, lathe, box, sphere, cone, torus, lerp, TU, TV } from './build.js';
import { linColor as lc } from '../../../engine/geom.js';

export const IRON = lc(0x1c1a19), DARK = lc(0x0c0908);
const GLASS_WARM = lc(0xffb45a);

// ------------------------------------------------------------------------------------------------ cannon
const BARREL = [[0.001, -0.7], [0.045, -0.7], [0.058, -0.66], [0.03, -0.6], [0.12, -0.57], [0.165, -0.5], [0.172, -0.43], [0.162, -0.4], [0.16, -0.1],
  [0.168, -0.08], [0.168, -0.02], [0.148, 0.0], [0.142, 0.34], [0.15, 0.36], [0.15, 0.4], [0.132, 0.42], [0.12, 0.84], [0.138, 0.88], [0.152, 0.96], [0.152, 1.0],
  [0.08, 1.0], [0.075, 0.9], [0.001, 0.9]];
/**
 * Cannon on a truck carriage. o: { x (trunnion x, sign = side), y (axis height), z, slot (0-based, recoil anim), barrel, wood,
 * metal, scale }. Barrel points outboard (±X). Returns the muzzle position (Vector3).
 */
export function cannon(wb, o) {
  const s = o.scale ?? 1, side = Math.sign(o.x) || 1, anim = o.slot + 1;
  const base = M(o.x, o.y, o.z, 0, side > 0 ? 0 : Math.PI, 0, s);
  const add = (g, m, opt) => wb.add(g, base.clone().multiply(m), { anim, ...opt });
  add(lathe(BARREL, 12), M(0, 0, 0, 0, 0, -Math.PI / 2), { uv: 'keep', color: o.barrel || IRON, metal: o.metal ?? 0.6, d: 0 });
  add(cyl(0.05, 0.05, 0.44, 6), M(0, 0, -0.22, Math.PI / 2), { uv: 'keep', color: o.barrel || IRON, metal: o.metal ?? 0.6, d: 0 });
  const wd = o.wood || lc(0x5a3a22);
  for (const zz of [-0.24, 0.24]) add(box(1.05, 0.34, 0.08), M(-0.3, -0.24, zz), { color: wd, d: 1 });
  add(box(1.0, 0.07, 0.5), M(-0.32, -0.36, 0), { color: wd, d: 1 });
  for (const xx of [0.08, -0.72]) for (const zz of [-0.27, 0.27]) {
    add(cyl(0.12, 0.12, 0.07, 10), M(xx, -0.4, zz + (zz > 0 ? -0.035 : -0.035), Math.PI / 2), { uv: 'box', color: wd, d: 0.6 });
  }
  return new THREE.Vector3(1.02 * s, 0, 0).applyMatrix4(base);
}

/** Gun port on the hull side: dark recess, frame, open lid (hinged at the top). */
export function gunport(wb, H, o) {
  const u = H.uAtZ(o.z, o.y);
  const f = H.frame(u, o.y, o.side);
  const m = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().makeBasis(f.X, f.U, f.N).setPosition(f.o).multiply(M(x, y, z, rx, ry, rz));
  const w = o.w ?? 0.52, h = o.h ?? 0.46;
  wb.add(box(w, h, 0.05), m(0, 0, 0.0), { color: DARK, d: 0 });
  const fr = o.frame || lc(0x3a2616), t = 0.07;
  wb.add(box(w + t * 2, t, 0.09), m(0, h / 2 + t / 2, 0.02), { color: fr, metal: o.frameMetal || 0, d: 0.6 });
  wb.add(box(w + t * 2, t, 0.09), m(0, -h / 2 - t / 2, 0.02), { color: fr, metal: o.frameMetal || 0, d: 0.6 });
  for (const sx of [-1, 1]) wb.add(box(t, h, 0.09), m(sx * (w / 2 + t / 2), 0, 0.02), { color: fr, metal: o.frameMetal || 0, d: 0.6 });
  // lid hinged at the top edge, swung outward/up
  const lid = o.lid ?? 1.15;
  const hinge = new THREE.Matrix4().makeBasis(f.X, f.U, f.N).setPosition(f.o).multiply(M(0, h / 2 + t, 0.06)).multiply(M(0, 0, 0, -lid)).multiply(M(0, -h / 2, 0.03));
  wb.add(box(w + 0.06, h + 0.06, 0.06), hinge, { color: o.lidColor || fr, d: 0.8 });
  if (o.lidInner) wb.add(box(w - 0.04, h - 0.04, 0.02), hinge.clone().multiply(M(0, 0, -0.035)), { color: o.lidInner, d: 0.2 });
}

// ------------------------------------------------------------------------------------------------ lanterns
/** Ornate lantern standing at pos (or hanging from `hang` point: pendulum anim). o: { s, glow, frame, glass, metal } */
export function lantern(wb, pos, o = {}) {
  const s = o.s ?? 1, e = o.glow ?? 3.2, fr = o.frame || lc(0xc89a3a), metal = o.metal ?? 0.9;
  const piv = o.hang ? [o.hang.x, o.hang.y, o.hang.z] : [pos.x, pos.y, pos.z];
  const anim = o.hang ? -3 : 0;
  const at = (x, y, z, rx, ry, rz) => M(pos.x + x * s, pos.y + y * s, pos.z + z * s, rx, ry, rz, s);
  wb.add(lathe([[0.001, 0], [0.12, 0], [0.15, 0.04], [0.11, 0.08], [0.13, 0.1], [0.001, 0.1]], 8), at(0, 0, 0), { uv: 'keep', color: fr, metal, d: 0, anim, piv });
  wb.add(cyl(0.12, 0.155, 0.36, 6), at(0, 0.1, 0), { uv: 'keep', color: o.glass || GLASS_WARM, e, d: 0, anim, piv });
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + Math.PI / 6;
    wb.add(box(0.025, 0.38, 0.025), at(Math.cos(a) * 0.14, 0.28, Math.sin(a) * 0.14, 0, -a, 0.08 * 0), { color: fr, metal, d: 0, anim, piv });
  }
  wb.add(lathe([[0.001, 0.46], [0.2, 0.46], [0.18, 0.5], [0.08, 0.64], [0.05, 0.68], [0.07, 0.74], [0.001, 0.8]], 8), at(0, 0, 0), { uv: 'keep', color: fr, metal, d: 0, anim, piv });
  if (o.hang) wb.rope(V3(pos.x, pos.y + 0.8 * s, pos.z), o.hang, 0.015, IRON, 0, { anim, piv, radial: 3 });
  if (o.bracket) { // iron bracket arm from the lantern base back to a mount point
    wb.rope(V3(pos.x, pos.y + 0.02, pos.z), o.bracket, 0.025, fr, 0, { metal, radial: 4 });
  }
}

/** Small hanging / deck lamp (cheaper). */
export function lamp(wb, pos, o = {}) {
  const s = o.s ?? 1, e = o.glow ?? 3, fr = o.frame || IRON;
  const piv = o.hang ? [o.hang.x, o.hang.y, o.hang.z] : [pos.x, pos.y, pos.z], anim = o.hang ? -3 : 0;
  wb.add(cyl(0.09 * s, 0.09 * s, 0.2 * s, 6), M(pos.x, pos.y, pos.z), { uv: 'keep', color: o.glass || GLASS_WARM, e, d: 0, anim, piv });
  wb.add(cone(0.13 * s, 0.12 * s, 6), M(pos.x, pos.y + 0.2 * s, pos.z), { uv: 'box', color: fr, metal: 0.5, d: 0, anim, piv });
  wb.add(cyl(0.1 * s, 0.1 * s, 0.03 * s, 6), M(pos.x, pos.y - 0.03 * s, pos.z), { uv: 'box', color: fr, metal: 0.5, d: 0, anim, piv });
  if (o.hang) wb.rope(V3(pos.x, pos.y + 0.3 * s, pos.z), o.hang, 0.012, IRON, 0, { anim, piv, radial: 3 });
}

// ------------------------------------------------------------------------------------------------ helm
/** Ship's wheel at hub position (spins about Z, anim −1) on a pedestal standing on the deck (deckY). */
export function wheel(wb, hub, deckY, o = {}) {
  const wd = o.wood || lc(0x6a4022), gold = o.gold || lc(0xd0a040), R = o.R ?? 0.52;
  const piv = [hub.x, hub.y, hub.z], an = { anim: -1, piv };
  wb.add(torus(R, 0.04, 6, 24), M(hub.x, hub.y, hub.z), { uv: 'box', color: wd, d: 0.6, ...an });
  wb.add(torus(R * 0.42, 0.03, 5, 16), M(hub.x, hub.y, hub.z), { uv: 'box', color: wd, d: 0.6, ...an });
  wb.add(cyl(0.09, 0.09, 0.16, 10), M(hub.x, hub.y, hub.z - 0.08, Math.PI / 2), { uv: 'keep', color: gold, metal: 0.9, d: 0, ...an });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
    const p0 = V3(hub.x, hub.y, hub.z), p1 = V3(hub.x + dx * (R + 0.2), hub.y + dy * (R + 0.2), hub.z);
    wb.add(lathe([[0.001, 0], [0.026, 0], [0.026, R + 0.02], [0.036, R + 0.06], [0.03, R + 0.12], [0.038, R + 0.16], [0.02, R + 0.2], [0.001, R + 0.2]], 6), MY(p0, p1), { uv: 'keep', color: wd, d: 0.5, ...an });
  }
  // pedestal (two posts + axle box)
  const h = hub.y - deckY;
  wb.add(box(0.18, h + 0.05, 0.22), M(hub.x, deckY + (h + 0.05) / 2, hub.z + 0.2), { color: wd, d: 1 });
  wb.add(box(0.34, 0.12, 0.34), M(hub.x, deckY + 0.06, hub.z + 0.2), { color: wd, d: 1 });
  wb.add(cyl(0.05, 0.05, 0.22, 8), M(hub.x, hub.y, hub.z, Math.PI / 2), { uv: 'keep', color: gold, metal: 0.8, d: 0 });
}

// ------------------------------------------------------------------------------------------------ carpentry
/** Window with frame, mullion cross and glowing pane. m: placement matrix (local z = outward). */
export function windowAt(wb, m, w, h, o = {}) {
  const fr = o.frame || lc(0xc89a3a), t = o.t ?? 0.06;
  wb.add(box(w, h, 0.03), m.clone().multiply(M(0, 0, 0.0)), { color: o.glass || lc(0xffc070), e: o.glow ?? 1.25, d: 0, piv: o.piv });
  wb.add(box(w + t * 2, t, 0.07), m.clone().multiply(M(0, h / 2 + t / 2, 0.02)), { color: fr, metal: o.metal ?? 0.8, d: 0.2 });
  wb.add(box(w + t * 2, t, 0.07), m.clone().multiply(M(0, -h / 2 - t / 2, 0.02)), { color: fr, metal: o.metal ?? 0.8, d: 0.2 });
  for (const s of [-1, 1]) wb.add(box(t, h, 0.07), m.clone().multiply(M(s * (w / 2 + t / 2), 0, 0.02)), { color: fr, metal: o.metal ?? 0.8, d: 0.2 });
  if (o.cross !== false) {
    wb.add(box(0.025, h, 0.05), m.clone().multiply(M(0, 0, 0.02)), { color: o.mullion || DARK, d: 0 });
    wb.add(box(w, 0.025, 0.05), m.clone().multiply(M(0, 0, 0.02)), { color: o.mullion || DARK, d: 0 });
  }
  if (o.arch) wb.add(cyl(w / 2 + t, w / 2 + t, 0.07, 10, false).rotateX(Math.PI / 2).scale(1, 0.55, 1), m.clone().multiply(M(0, h / 2 + t, 0.02)), { uv: 'box', color: fr, metal: o.metal ?? 0.8, d: 0.2 });
}

/** Balustrade from a to b (same y): cap rail, bottom rail, turned balusters. */
export function balustrade(wb, a, b, o = {}) {
  const h = o.h ?? 0.85, wd = o.wood || lc(0x5a3a22), cap = o.cap || wd, gap = o.gap ?? 0.26;
  const len = a.distanceTo(b), dir = V3().subVectors(b, a).normalize();
  const ang = Math.atan2(-dir.z, dir.x);
  const mid = V3().lerpVectors(a, b, 0.5);
  wb.add(box(len + 0.06, 0.07, 0.12), M(mid.x, mid.y + h, mid.z, 0, ang), { color: cap, metal: o.capMetal || 0, d: 0.8 });
  wb.add(box(len, 0.06, 0.1), M(mid.x, mid.y + 0.08, mid.z, 0, ang), { color: wd, d: 0.8 });
  const n = Math.max(1, Math.round(len / gap));
  const prof = [[0.001, 0], [0.035, 0], [0.035, 0.05], [0.025, 0.1], [0.045, h * 0.35], [0.028, h * 0.62], [0.034, h - 0.08], [0.03, h - 0.03], [0.001, h - 0.03]];
  const bal = lathe(prof, 6);
  for (let i = 0; i <= n; i++) {
    const p = V3().lerpVectors(a, b, i / n);
    if (o.skip && o.skip(p)) continue;
    const post = i === 0 || i === n || (o.posts && i % o.posts === 0);
    if (post) wb.add(box(0.1, h + 0.1, 0.1), M(p.x, p.y + (h + 0.1) / 2, p.z, 0, ang), { color: cap, metal: o.capMetal || 0, d: 0.6 });
    else wb.add(bal, M(p.x, p.y + 0.05, p.z), { uv: 'keep', color: wd, d: 0.4 });
  }
}

/** Ladder from foot (on the lower deck) to top (edge of the upper deck). */
export function ladder(wb, foot, top, w = 0.6, o = {}) {
  const wd = o.wood || lc(0x5a3a22), right = V3(w / 2, 0, 0);
  for (const s of [-1, 1]) {
    const a = foot.clone().addScaledVector(right, s), b = top.clone().addScaledVector(right, s);
    wb.add(box(0.06, a.distanceTo(b), 0.12), MY(a, b).multiply(M(0, a.distanceTo(b) / 2, 0)), { color: wd, d: 0.8 });
  }
  const n = Math.round((top.y - foot.y) / 0.28);
  for (let i = 1; i <= n; i++) {
    const p = V3().lerpVectors(foot, top, i / (n + 0.4));
    wb.add(box(w, 0.04, 0.16), M(p.x, p.y, p.z), { color: o.step || wd, d: 1 });
  }
}

/** Hatch: raised coaming + grating. */
export function hatch(wb, x, y, z, w, d, o = {}) {
  const wd = o.wood || lc(0x6a4424), dk = o.dark || lc(0x1a120c), h = 0.18;
  wb.add(box(w + 0.16, h, 0.08), M(x, y + h / 2, z - d / 2 - 0.04), { color: wd, d: 1 });
  wb.add(box(w + 0.16, h, 0.08), M(x, y + h / 2, z + d / 2 + 0.04), { color: wd, d: 1 });
  wb.add(box(0.08, h, d), M(x - w / 2 - 0.04, y + h / 2, z), { color: wd, d: 1 });
  wb.add(box(0.08, h, d), M(x + w / 2 + 0.04, y + h / 2, z), { color: wd, d: 1 });
  wb.add(box(w, 0.02, d), M(x, y + h - 0.06, z), { color: dk, d: 0 });
  const nx = Math.round(w / 0.12), nz = Math.round(d / 0.12);
  for (let i = 1; i < nx; i++) wb.add(box(0.035, 0.05, d), M(x - w / 2 + i * w / nx, y + h - 0.03, z), { color: wd, d: 0.5 });
  for (let i = 1; i < nz; i++) wb.add(box(w, 0.035, 0.035), M(x, y + h - 0.02, z - d / 2 + i * d / nz), { color: wd, d: 0.5 });
}

export function barrel(wb, x, y, z, o = {}) {
  const r = o.r ?? 0.28, h = o.h ?? 0.72, wd = o.wood || lc(0x8a5a30), rot = o.lie ? M(x, y + r * 0.95, z, 0, o.ry || 0, Math.PI / 2).multiply(M(0, -h / 2, 0)) : M(x, y, z, 0, o.ry || 0, 0);
  wb.add(lathe([[0.001, 0], [r * 0.82, 0], [r * 0.86, 0.02], [r * 0.96, h * 0.25], [r, h * 0.5], [r * 0.96, h * 0.75], [r * 0.86, h - 0.02], [r * 0.82, h], [0.001, h]], 12, 11), rot, { uv: 'keep', color: wd, d: 1 });
  for (const t of [0.12, 0.34, 0.66, 0.88]) {
    const rr = r * (t < 0.2 || t > 0.8 ? 0.9 : 0.985) + 0.012;
    wb.add(torus(rr, 0.018, 4, 14), rot.clone().multiply(M(0, h * t, 0, Math.PI / 2)), { uv: 'box', color: o.hoop || IRON, metal: 0.4, d: 0 });
  }
}
export function crate(wb, x, y, z, s = 0.7, o = {}) {
  const wd = o.wood || lc(0x9a6a3a), dk = o.dark || lc(0x5a3a20), sy = o.sy ?? s, sz = o.sz ?? s, ry = o.ry || 0;
  const base = M(x, y + sy / 2, z, 0, ry, 0);
  wb.add(box(s, sy, sz), base, { color: wd, d: 1 });
  const b = 0.06;
  for (const [ax, ay] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    wb.add(box(b, sy + 0.01, b), base.clone().multiply(M(ax * (s / 2 - b / 2 + 0.01), 0, ay * (sz / 2 - b / 2 + 0.01))), { color: dk, d: 0.6 });
    wb.add(box(s + 0.01, b, b), base.clone().multiply(M(0, ax * (sy / 2 - b / 2 + 0.01), ay * (sz / 2 - b / 2 + 0.01))), { color: dk, d: 0.6 });
    wb.add(box(b, b, sz + 0.01), base.clone().multiply(M(ax * (s / 2 - b / 2 + 0.01), ay * (sy / 2 - b / 2 + 0.01), 0)), { color: dk, d: 0.6 });
  }
  if (o.mark) wb.add(box(s * 0.4, sy * 0.4, 0.01), base.clone().multiply(M(0, 0, sz / 2 + 0.006)), { color: o.mark, d: 0.3 });
}
export function sack(wb, x, y, z, o = {}) {
  const g = sphere(1, 10, 7), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
    const k = 1 + 0.08 * Math.sin(px * 5 + pz * 3) + (py > 0.6 ? -0.25 * (py - 0.6) : 0);
    p.setXYZ(i, px * k * 0.34, Math.max(py, -0.75) * 0.3, pz * k * 0.26);
  }
  g.computeVertexNormals();
  wb.add(g, M(x, y + 0.22, z, 0, o.ry || 0, o.rz || 0), { uv: 'box', color: o.color || lc(0xc8b088), d: 0.5 });
  wb.add(cyl(0.05, 0.07, 0.12, 6), M(x, y + 0.44, z, 0, o.ry || 0, o.rz || 0), { uv: 'keep', color: o.color || lc(0xc8b088), d: 0.3 });
}
export function coil(wb, x, y, z, r = 0.3, o = {}) {
  const c = o.color || lc(0x9a7a4a);
  for (let i = 0; i < 3; i++) wb.add(torus(r - i * 0.06, 0.035, 5, 16), M(x, y + 0.035 + i * 0.05, z, Math.PI / 2), { uv: 'box', color: c, d: 0.3 });
}
export function capstan(wb, x, y, z, o = {}) {
  const wd = o.wood || lc(0x6a4424);
  wb.add(lathe([[0.001, 0], [0.42, 0], [0.4, 0.1], [0.26, 0.2], [0.22, 0.6], [0.3, 0.7], [0.34, 0.85], [0.001, 0.86]], 12), M(x, y, z), { uv: 'keep', color: wd, d: 1 });
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI;
    wb.add(box(1.5, 0.06, 0.07), M(x, y + 0.78, z, 0, a), { color: o.bar || wd, d: 0.6 });
  }
}
export function bell(wb, x, y, z, o = {}) {
  const gold = o.gold || lc(0xd0a040), wd = o.wood || lc(0x5a3a22);
  for (const s of [-1, 1]) wb.add(box(0.07, 0.7, 0.07), M(x + s * 0.22, y + 0.35, z), { color: wd, d: 0.6 });
  wb.add(box(0.52, 0.08, 0.1), M(x, y + 0.72, z), { color: wd, d: 0.6 });
  wb.add(lathe([[0.001, 0.62], [0.05, 0.62], [0.08, 0.58], [0.1, 0.44], [0.14, 0.38], [0.001, 0.38]], 10), M(x, y, z), { uv: 'keep', color: gold, metal: 0.9, d: 0 });
}
/** A little rowing boat, upside down or upright (for the deck). */
export function boat(wb, x, y, z, o = {}) {
  const L = o.L ?? 3.0, B = o.B ?? 1.1, D = 0.45, wd = o.wood || lc(0x7a5a38), inner = o.inner || lc(0x5a3a22);
  const shell = (flip) => {
    const nu = 12, nv = 5, pos = [], idx = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv, zz = (u - 0.5) * L;
      const pw = Math.pow(Math.sin(Math.PI * u), 0.6) * (1 - 0.25 * (u > 0.5 ? (u - 0.5) * 2 : 0));
      const ang = v * Math.PI;
      pos.push(Math.cos(ang) * B / 2 * pw, -Math.sin(ang) * D * (0.4 + 0.6 * pw) + D, zz);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  };
  const m = M(x, y, z, 0, o.ry || 0, o.upside ? Math.PI : 0).multiply(M(0, o.upside ? -D - 0.1 : 0, 0));
  wb.add(shell(false), m, { uv: 'box', color: wd, d: 1 });
  wb.add(shell(true), m, { uv: 'box', color: inner, d: 1 });
  for (const t of [-0.25, 0.1]) wb.add(box(B * 0.8, 0.04, 0.2), m.clone().multiply(M(0, D * 0.75, t * L)), { color: inner, d: 1 });
}
