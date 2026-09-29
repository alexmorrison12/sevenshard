// Shared helpers for SEVENSHARD mounts & pets (own folder; the framework files stay untouched):
//   - addG: GeoAcc.add with uv-aware skin / colour callbacks
//   - marchOut / shell / wrapGrid: conforming thin shells (blankets, saddles, caparisons, armour plates) marched onto the
//     SDF surface and skinned exactly like the flesh beneath them (Sculpt.sampleAt)
//   - lock / strap: hair locks (manes, tails, ruffs) and flat leather straps (bridle, reins, girths)
//   - Jiggle: allocation-free damped springs driven by the anchor bone's real acceleration + ground speed / turning / wind
//     (manes, tails, forelocks, cloth, floating motes)
//   - mount actions (rear, jump, graze, shake, paw, hit, death, spawn…) parameterised by body proportions
import * as THREE from 'three';
import { sweep } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { lerp3 } from '../../kit/parts.js';
import { sstep, clamp01, mix, TAU } from '../../kit/rig.js';
import { ease } from '../ctl.js';

const V3 = THREE.Vector3;
const _v = new V3(), _n = new V3(), _m3 = new THREE.Matrix3();
export { lerp3 };

// ================================================================================================ geometry emit
/** GeoAcc.add with uv-aware callbacks: color(p, n, uv) → hex|[r,g,b], skin(p, uv, i) → {si, sw}, emis(p, uv), fx(p, uv), dtl */
export function addG(acc, geo, o = {}) {
  const p = geo.attributes.position, na = geo.attributes.normal, uva = geo.attributes.uv;
  const m = o.matrix || null; if (m) _m3.getNormalMatrix(m);
  const base = acc.count;
  const colr = typeof o.color === 'function' ? null : col(o.color ?? 0xffffff);
  const d = o.dtl ?? [0, 0, 0.15, 0];
  const uv = [0, 0];
  const skinF = typeof o.skin === 'function' ? o.skin : null; let skin = skinF ? null : o.skin;
  for (let i = 0; i < p.count; i++) {
    _v.fromBufferAttribute(p, i); if (m) _v.applyMatrix4(m);
    if (na) { _n.fromBufferAttribute(na, i); if (m) _n.applyMatrix3(_m3).normalize(); } else _n.set(0, 1, 0);
    if (uva) { uv[0] = uva.getX(i); uv[1] = uva.getY(i); } else uv[0] = uv[1] = 0;
    const c = colr || col(o.color(_v, _n, uv, i));
    if (skinF) skin = skinF(_v, uv, i);
    const em = typeof o.emis === 'function' ? o.emis(_v, uv) : (o.emis ?? 0);
    const fx = typeof o.fx === 'function' ? o.fx(_v, uv) : (o.fx ?? 0);
    const dd = typeof o.dtl === 'function' ? o.dtl(_v, uv) : d;
    acc.vert(_v.x, _v.y, _v.z, _n.x, _n.y, _n.z, c[0], c[1], c[2], skin.si, skin.sw, dd[0], dd[1], dd[2], dd[3], em, fx);
  }
  if (geo.index) { const ix = geo.index.array; for (let i = 0; i < ix.length; i++) acc.I.push(base + ix[i]); }
  else for (let i = 0; i < p.count; i++) acc.I.push(base + i);
}

/** Merge two skins (a·(1−t) + b·t) → top-4 {si, sw}. Build time only. */
export function mixSkin(a, b, t) {
  const W = new Map();
  for (let k = 0; k < 4; k++) {
    if (a.sw[k] > 0) W.set(a.si[k], (W.get(a.si[k]) || 0) + a.sw[k] * (1 - t));
    if (b.sw[k] > 0) W.set(b.si[k], (W.get(b.si[k]) || 0) + b.sw[k] * t);
  }
  const arr = [...W.entries()].filter(e => e[1] > 1e-4).sort((x, y) => y[1] - x[1]).slice(0, 4);
  const tot = arr.reduce((s, e) => s + e[1], 0) || 1;
  const si = [0, 0, 0, 0], sw = [0, 0, 0, 0];
  arr.forEach((e, i) => { si[i] = e[0]; sw[i] = e[1] / tot; });
  if (!arr.length) sw[0] = 1;
  return { si, sw };
}
export const rigidSkin = (bone) => ({ si: [bone, 0, 0, 0], sw: [1, 0, 0, 0] });
/** skin blended along a bone chain by t 0..1 */
export function chainSkin(bones, t) {
  const n = bones.length; if (n === 1) return rigidSkin(bones[0]);
  const f = clamp01(t) * (n - 1), i = Math.min(n - 2, Math.floor(f)), u = f - i;
  return { si: [bones[i], bones[i + 1], 0, 0], sw: [1 - u, u, 0, 0] };
}
/** skin of the flesh at a surface point (cached per sculpt on a 1 cm grid) */
export function skinAt(S, p) {
  const key = Math.round(p[0] * 100) + ',' + Math.round(p[1] * 100) + ',' + Math.round(p[2] * 100);
  const C = S._skinCache || (S._skinCache = new Map());
  let s = C.get(key);
  if (!s) { const r = S.sampleAt(p[0], p[1], p[2]); s = { si: r.si.slice(), sw: r.sw.slice() }; C.set(key, s); }
  return s;
}

// ================================================================================================ surface marching
/** March from o (inside the group's surface) along unit dir d; returns the surface point [x,y,z] or null. */
export function marchOut(S, o, d, group = 0, maxT = 2) {
  const f = (t) => S.sdf(o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t, group);
  let t = 0, s = f(0);
  if (s > 0) return null;
  let a = 0, b = -1;
  for (let i = 0; i < 80 && t < maxT; i++) {
    const t2 = t + Math.max(Math.abs(s) * 0.85, 0.004);
    const s2 = f(t2);
    if (s2 > 0) { a = t; b = t2; break; }
    t = t2; s = s2;
  }
  if (b < 0) return null;
  for (let i = 0; i < 16; i++) { const m = (a + b) / 2; if (f(m) < 0) a = m; else b = m; }
  const tt = (a + b) / 2;
  return [o[0] + d[0] * tt, o[1] + d[1] * tt, o[2] + d[2] * tt];
}
export function sdfNormal(S, p, group = 0) { const n = [0, 0, 0]; S.normal(p[0], p[1], p[2], n, group, 0.006); return n; }

/**
 * Grid of surface points around a horizontal axis (barrel / neck wraps): rows along z (zs[]), columns by angle θ from the
 * top (θ = 0 up, +θ toward +X). axis(z) → [cx, cy]. place(u, v, p, n) may return a replaced position (hanging cloth).
 * → { P: [[x,y,z]…][], N: [...][], S: skin sample points }
 */
export function wrapGrid(S, group, zs, ths, axis, place) {
  const P = [], N = [], SK = [], U = [], V = [];
  const z0 = zs[0], z1 = zs[zs.length - 1];
  for (let j = 0; j < zs.length; j++) {
    const z = zs[j], [cx, cy] = axis(z), v = zs.length > 1 ? (z - z0) / (z1 - z0) : 0;
    const T = typeof ths === 'function' ? ths(v, z) : ths;
    const row = [], nrow = [], srow = [], urow = [];
    let last = null, lastN = null;
    for (let i = 0; i < T.length; i++) {
      const th = T[i], d = [Math.sin(th), Math.cos(th), 0];
      let p = marchOut(S, [cx, cy, z], d, group, 1.5);
      let n = p ? sdfNormal(S, p, group) : null;
      if (!p) { p = last ? last.slice() : [cx, cy, z]; n = lastN ? lastN.slice() : d.slice(); }
      const u = T.length > 1 ? (th - T[0]) / (T[T.length - 1] - T[0]) : 0;
      const sp = p.slice();
      if (place) { const r = place(u, v, p, n, th, z); if (r) { p = r.p || p; n = r.n || n; } }
      row.push(p); nrow.push(n); srow.push(sp); urow.push(u);
      last = p; lastN = n;
    }
    P.push(row); N.push(nrow); SK.push(srow); U.push(urow); V.push(v);
  }
  return { P, N, SK, U, V };
}
export const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
/** n params in [a, b] with extra samples hugging both ends (crisp trims / hems): e = first step as a fraction */
export function edgespace(a, b, n, e = 0.05) {
  const inner = linspace(e * 2.4, 1 - e * 2.4, Math.max(2, n - 4));
  return [0, e, ...inner, 1 - e, 1].map(t => a + (b - a) * t);
}

/**
 * Thin shell from a surface grid G ({P, N, SK}): outer face pushed out by off(u, v), optional inner face (for hanging
 * cloth) and an edge rim of thickness `thick`. Skin from the flesh under each vertex (or o.skin(u, v, sp)).
 * o: { off (num | fn), thick, color(u, v, side) → hex|[r,g,b], inner (bool), dtl, emis(u, v), mask(u, v) → bool (drop quads) }
 */
export function shell(acc, S, G, o = {}) {
  const { P, N, SK } = G, nv = P.length, nu = P[0].length;
  const UU = (j, i) => (G.U ? G.U[j][i] : i / (nu - 1)), VV = (j) => (G.V ? G.V[j] : j / (nv - 1));
  const offF = typeof o.off === 'function' ? o.off : () => (o.off ?? 0.01);
  const thick = o.thick ?? 0.012;
  const dtl = o.dtl ?? [0, 0, 0.2, 0.25];
  const colF = (u, v, side) => { const c = o.color ? o.color(u, v, side) : 0x808080; return col(c); };
  const skinF = (j, i) => o.skin ? o.skin(UU(j, i), VV(j), SK[j][i]) : skinAt(S, SK[j][i]);
  const mask = o.mask || (() => true), innerMask = o.innerMask || (() => true);
  // orientation: du × dv vs N
  const pa = P[0][0], pb = P[0][Math.min(1, nu - 1)], pc = P[Math.min(1, nv - 1)][0];
  const du = new V3(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]), dv = new V3(pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]);
  const flip = du.cross(dv).dot(new V3(...N[0][0])) < 0;
  // displaced outer positions, then (optionally) normals recomputed from the displaced grid
  const O = [], ON = [];
  for (let j = 0; j < nv; j++) {
    O.push([]); ON.push([]);
    for (let i = 0; i < nu; i++) { const p = P[j][i], n = N[j][i], of = offF(UU(j, i), VV(j)); O[j].push([p[0] + n[0] * of, p[1] + n[1] * of, p[2] + n[2] * of]); ON[j].push(n); }
  }
  if (o.recalcN) {
    const a = new V3(), b = new V3(), c = new V3();
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(nu - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(nv - 1, j + 1);
      a.set(O[j][i1][0] - O[j][i0][0], O[j][i1][1] - O[j][i0][1], O[j][i1][2] - O[j][i0][2]);
      b.set(O[j1][i][0] - O[j0][i][0], O[j1][i][1] - O[j0][i][1], O[j1][i][2] - O[j0][i][2]);
      c.crossVectors(a, b).normalize(); if (flip) c.negate();
      const n0 = N[j][i], k = o.recalcN === true ? 1 : o.recalcN;
      ON[j][i] = [mix(n0[0], c.x, k), mix(n0[1], c.y, k), mix(n0[2], c.z, k)];
      const l = Math.hypot(...ON[j][i]) || 1; ON[j][i] = ON[j][i].map(x => x / l);
    }
  }
  const outer = [], inner = [];
  for (let j = 0; j < nv; j++) {
    outer.push([]); inner.push([]);
    for (let i = 0; i < nu; i++) {
      const u = UU(j, i), v = VV(j), p = O[j][i], n = ON[j][i], n0 = N[j][i];
      const sk = skinF(j, i), c = colF(u, v, 1), em = o.emis ? o.emis(u, v) : 0;
      outer[j].push(acc.count);
      acc.vert(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], sk.si, sk.sw, dtl[0], dtl[1], dtl[2], dtl[3], em, 0);
      if (o.inner || thick > 0) {
        const ci = o.inner ? colF(u, v, -1) : c, t = o.inner ? (o.innerGap ?? thick) : thick;
        inner[j].push(acc.count);
        acc.vert(p[0] - n0[0] * t, p[1] - n0[1] * t, p[2] - n0[2] * t, -n[0], -n[1], -n[2], ci[0], ci[1], ci[2], sk.si, sk.sw, dtl[0], dtl[1], dtl[2], dtl[3], 0, 0);
      }
    }
  }
  for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) {
    const mu = (UU(j, i) + UU(j, i + 1)) / 2, mv = (VV(j) + VV(j + 1)) / 2;
    if (!mask(mu, mv)) continue;
    const a = outer[j][i], b = outer[j][i + 1], c = outer[j + 1][i], d = outer[j + 1][i + 1];
    if (!flip) { acc.tri(a, b, c); acc.tri(b, d, c); } else { acc.tri(a, c, b); acc.tri(b, c, d); }
    if (o.inner && innerMask(mu, mv)) {
      const a2 = inner[j][i], b2 = inner[j][i + 1], c2 = inner[j + 1][i], d2 = inner[j + 1][i + 1];
      if (!flip) { acc.tri(a2, c2, b2); acc.tri(b2, c2, d2); } else { acc.tri(a2, b2, c2); acc.tri(b2, d2, c2); }
    }
  }
  // rim along the borders (edge thickness), as quads outer→inner facing outward
  if (thick > 0 && o.rim !== false) {
    const rimEdge = (ja, ia, jb, ib, ox, oy, oz) => {
      const a = outer[ja][ia], b = outer[jb][ib], c = inner[ja][ia], d = inner[jb][ib];
      // winding: face normal along (ox, oy, oz)
      const A = acc.P, g = (k) => new V3(A[k * 3], A[k * 3 + 1], A[k * 3 + 2]);
      const e1 = g(b).sub(g(a)), e2 = g(c).sub(g(a));
      if (e1.cross(e2).dot(_v.set(ox, oy, oz)) > 0) { acc.tri(a, b, c); acc.tri(b, d, c); } else { acc.tri(a, c, b); acc.tri(b, c, d); }
    };
    const outDir = (j, i, dj, di) => { // outward in-surface direction at a border vertex
      const p = P[j][i], q = P[Math.max(0, Math.min(nv - 1, j - dj))][Math.max(0, Math.min(nu - 1, i - di))];
      return [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
    };
    for (let i = 0; i < nu - 1; i++) {
      if (mask((UU(0, i) + UU(0, i + 1)) / 2, VV(1) / 2)) { const d = outDir(0, i, -1, 0); rimEdge(0, i, 0, i + 1, d[0], d[1], d[2]); }
      if (mask((UU(nv - 1, i) + UU(nv - 1, i + 1)) / 2, (1 + VV(nv - 2)) / 2)) { const d = outDir(nv - 1, i, 1, 0); rimEdge(nv - 1, i, nv - 1, i + 1, d[0], d[1], d[2]); }
    }
    for (let j = 0; j < nv - 1; j++) {
      if (mask(UU(j, 1) / 2, (VV(j) + VV(j + 1)) / 2)) { const d = outDir(j, 0, 0, -1); rimEdge(j, 0, j + 1, 0, d[0], d[1], d[2]); }
      if (mask((1 + UU(j, nu - 2)) / 2, (VV(j) + VV(j + 1)) / 2)) { const d = outDir(j, nu - 1, 0, 1); rimEdge(j, nu - 1, j + 1, nu - 1, d[0], d[1], d[2]); }
    }
  }
  return { outer, inner };
}

// ================================================================================================ hair & straps
/**
 * Hair lock / ribbon along pts ([x,y,z][] | Vector3[]). o: { r0, r1, pow, bulge, flat, radial, up:[x,y,z], c0, c1, cmid,
 * skin(t, p) → {si, sw}, dtl, emis }
 */
export function lock(acc, pts, o) {
  const n = pts.length;
  const radii = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1); radii.push(Math.max(0.0015, mix(o.r0, o.r1, Math.pow(t, o.pow ?? 1)) * (1 + (o.bulge ?? 0) * Math.sin(t * Math.PI)))); }
  const g = sweep(pts, radii, { radial: o.radial ?? 5, flat: o.flat ?? 0.35, up: o.up, capStart: false });
  const c0 = col(o.c0), c1 = col(o.c1 ?? o.c0);
  addG(acc, g, {
    skin: (p, uv) => o.skin(uv[1], p),
    color: (p, nn, uv) => o.color ? o.color(uv[1], uv[0]) : lerp3(c0, c1, sstep(o.from ?? 0.25, 1, uv[1])),
    dtl: o.dtl ?? [0.45, 0, 0.1, 0], emis: o.emis,
  });
}
/** Flat strap (rectangular section) along pts; w width, th thickness; up = surface normal hint */
export function strap(acc, pts, w, th, o) {
  const g = sweep(pts, pts.map(() => w * 0.5), { radial: 4, flat: th / w, up: o.up, twist: Math.PI / 4, capStart: true });
  addG(acc, g, { skin: o.skin, color: o.color ?? 0x4a2c18, dtl: o.dtl ?? [0, 0, 0.2, 0.35], emis: o.emis });
}
/** points on a surface path: rays from `o` through each direction (marched to group surface) pushed out by off.
 *  The returned array carries .normals (surface normals per point). */
export function surfPath(S, group, origin, dirs, off = 0.008) {
  const out = [], nrm = [];
  for (const d0 of dirs) {
    const l = Math.hypot(d0[0], d0[1], d0[2]), d = [d0[0] / l, d0[1] / l, d0[2] / l];
    const p = marchOut(S, origin, d, group, 1.5);
    if (!p) continue;
    const n = sdfNormal(S, p, group);
    out.push(new V3(p[0] + n[0] * off, p[1] + n[1] * off, p[2] + n[2] * off)); nrm.push(new V3(...n));
  }
  out.normals = nrm;
  return out;
}
/** Points toward targets from an interior origin, marched to the surface (targets are aim points, not directions). */
export function surfAim(S, group, origin, targets, off = 0.008) {
  return surfPath(S, group, origin, targets.map(q => [q[0] - origin[0], q[1] - origin[1], q[2] - origin[2]]), off);
}
/**
 * Flat ribbon lying on a surface (bridle straps, belts, harness): one quad strip facing the surface normals
 * (single-sided, 2 tris per segment). pts: Vector3[] with .normals (or o.normal fn). o: { skin, color, dtl, emis, doubleSided }
 */
export function ribbon(acc, pts, w, o = {}) {
  const n = pts.length, NR = pts.normals, base = acc.count;
  const c = col(o.color ?? 0x3a2414), d = o.dtl ?? [0, 0, 0.15, 0.35];
  const T = new V3(), B = new V3(), Nn = new V3();
  const sides = o.doubleSided ? [1, -1] : [1];
  for (const face of sides) {
    const b0 = acc.count;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      T.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      Nn.copy(NR ? NR[i] : new V3(0, 1, 0)); Nn.addScaledVector(T, -Nn.dot(T)).normalize();
      B.crossVectors(T, Nn).normalize();
      const sk = typeof o.skin === 'function' ? o.skin(p, [0, i / (n - 1)]) : o.skin;
      const hw = w * 0.5 * (o.taper ? mix(1, o.taper, i / (n - 1)) : 1);
      for (const sd of [-1, 1]) {
        acc.vert(p.x + B.x * hw * sd + Nn.x * 0.002 * face, p.y + B.y * hw * sd + Nn.y * 0.002 * face, p.z + B.z * hw * sd + Nn.z * 0.002 * face,
          Nn.x * face, Nn.y * face, Nn.z * face, c[0], c[1], c[2], sk.si, sk.sw, d[0], d[1], d[2], d[3], o.emis ?? 0, 0);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const a = b0 + i * 2, bq = a + 1, cq = a + 2, dq = a + 3;
      // (a: −B, b: +B) × next; winding so the face points along ±N
      if (face > 0) { acc.tri(a, bq, cq); acc.tri(bq, dq, cq); } else { acc.tri(a, cq, bq); acc.tri(bq, cq, dq); }
    }
  }
  void base;
}
/** Catmull-Rom resample of a polyline (smooth curves through control points) → n points */
export function smoothPath(ctrl, n) {
  const P = ctrl.map(p => Array.isArray(p) ? new V3(...p) : p), m = P.length, out = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1) * (m - 1), k = Math.min(m - 2, Math.floor(f)), t = f - k;
    const p0 = P[Math.max(0, k - 1)], p1 = P[k], p2 = P[k + 1], p3 = P[Math.min(m - 1, k + 2)];
    const t2 = t * t, t3 = t2 * t;
    out.push(new V3(
      0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)));
  }
  return out;
}
/** skin varying along a path by arc fraction: stops [[t, skin], …] ascending */
export function pathSkin(stops) {
  return (t) => {
    if (t <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const u = (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]); return mixSkin(stops[i - 1][1], stops[i][1], u * u * (3 - 2 * u)); }
    return stops[stops.length - 1][1];
  };
}
/** metal ring (torus) at pos, axis = ring normal */
export function ring(acc, pos, axis, R, r, skin, color, o = {}) {
  const g = new THREE.TorusGeometry(R, r, o.rs ?? 4, o.ts ?? 10);
  const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), new V3(...axis).normalize());
  const m = new THREE.Matrix4().makeRotationFromQuaternion(q).setPosition(pos[0], pos[1], pos[2]);
  if (o.scale) m.scale(new V3(...o.scale));
  addG(acc, g, { matrix: m, skin, color, dtl: [0, 0, 0.1, 0], emis: o.emis ?? 0 });
}

// ================================================================================================ secondary motion
const _F = new V3(), _D = new V3(), _T = new V3();
/**
 * Damped springs on bone chains. Each bone i tilts toward (dir_i × F)·gain where F is the inertial force felt by the chain:
 * −(anchor acceleration measured from the last solved pose) − (frame acceleration from speed change & turning) + wind.
 * defs: [{ bones: [name…], anchor: name, k (stiffness), c (damping), g (gain rad per m/s²), gi (gain growth per link),
 *          wind (per m/s), idle (sway amp), idleF, max (rad), tipDir:[x,y,z], ph, axisMask:[x,y,z] }]
 */
export class Jiggle {
  constructor(ctl, defs) {
    const P = ctl.pose;
    this.ctl = ctl; this.items = []; this.on = 1; this.wind = 1; this.extra = new V3();
    const anchorIdx = [];
    for (const d of defs) {
      const bones = d.bones.map(n => P.b[n]);
      const anchor = P.b[d.anchor ?? d.bones[0]];
      let slot = anchorIdx.indexOf(anchor); if (slot < 0) { slot = anchorIdx.length; anchorIdx.push(anchor); }
      for (let i = 0; i < bones.length; i++) {
        const bi = bones[i];
        let dir;
        if (i < bones.length - 1) dir = P.rest[bones[i + 1]].clone().sub(P.rest[bi]);
        else if (d.tipDir) dir = new V3(...d.tipDir);
        else if (i > 0) dir = P.rest[bi].clone().sub(P.rest[bones[i - 1]]);
        else dir = new V3(0, -1, 0);
        dir.normalize();
        this.items.push({ bone: bi, slot, dir, k: d.k ?? 70, c: d.c ?? 9, g: (d.g ?? 0.02) * (1 + i * (d.gi ?? 0.25)), wind: d.wind ?? 0.05,
          idle: (d.idle ?? 0.02) * (1 + i * 0.4), idleF: d.idleF ?? 1.3, ph: (d.ph ?? 0) + i * 0.8, max: d.max ?? 0.9, mask: d.axisMask ?? [1, 1, 1] });
      }
    }
    this.anchors = anchorIdx;
    const na = anchorIdx.length, n = this.items.length;
    this.ap = new Float32Array(na * 3); this.av = new Float32Array(na * 3); this.aa = new Float32Array(na * 3);
    this.x = new Float32Array(n * 3); this.v = new Float32Array(n * 3);
    this.init = false; this.t = Math.random() * 10;
  }
  reset() { this.init = false; this.x.fill(0); this.v.fill(0); }
  update(dt) {
    const ctl = this.ctl, P = ctl.pose, A = this.anchors;
    if (dt > 0) {
      this.t += dt;
      if (!this.init) {
        for (let a = 0; a < A.length; a++) { const w = P.wp[A[a]]; this.ap[a * 3] = w.x; this.ap[a * 3 + 1] = w.y; this.ap[a * 3 + 2] = w.z; }
        this.av.fill(0); this.aa.fill(0); this.init = true;
      }
      const kf = 1 - Math.exp(-18 * dt);
      for (let a = 0; a < A.length; a++) {
        const w = P.wp[A[a]], i3 = a * 3;
        const vx = (w.x - this.ap[i3]) / dt, vy = (w.y - this.ap[i3 + 1]) / dt, vz = (w.z - this.ap[i3 + 2]) / dt;
        let ax = (vx - this.av[i3]) / dt, ay = (vy - this.av[i3 + 1]) / dt, az = (vz - this.av[i3 + 2]) / dt;
        const lim = 60; ax = Math.max(-lim, Math.min(lim, ax)); ay = Math.max(-lim, Math.min(lim, ay)); az = Math.max(-lim, Math.min(lim, az));
        this.aa[i3] += (ax - this.aa[i3]) * kf; this.aa[i3 + 1] += (ay - this.aa[i3 + 1]) * kf; this.aa[i3 + 2] += (az - this.aa[i3 + 2]) * kf;
        this.av[i3] = vx; this.av[i3 + 1] = vy; this.av[i3 + 2] = vz;
        this.ap[i3] = w.x; this.ap[i3 + 1] = w.y; this.ap[i3 + 2] = w.z;
      }
      const spd = ctl.speedSm || 0, turn = ctl.turnSm || 0;
      // frame (root) acceleration: forward accel along −Z, centripetal toward the turn centre (turn > 0 = left = −X)
      const fax = -spd * turn, faz = -(ctl.accel || 0);
      const X = this.x, Vv = this.v, its = this.items;
      for (let i = 0; i < its.length; i++) {
        const it = its[i], i3 = i * 3, a3 = it.slot * 3;
        _F.set(-(this.aa[a3] + fax) + this.extra.x, -this.aa[a3 + 1] + this.extra.y, -(this.aa[a3 + 2] + faz) + Math.abs(spd) * it.wind * 20 * this.wind + this.extra.z);
        _T.crossVectors(it.dir, _F).multiplyScalar(it.g * this.on);
        const id = Math.sin(this.t * it.idleF + it.ph) * it.idle, id2 = Math.sin(this.t * it.idleF * 0.7 + it.ph * 1.7) * it.idle;
        _T.x += id * 0.6; _T.y += id2; _T.z += id * 0.4;
        const m = _T.length(); if (m > it.max) _T.multiplyScalar(it.max / m);
        _T.x *= it.mask[0]; _T.y *= it.mask[1]; _T.z *= it.mask[2];
        for (let c = 0; c < 3; c++) {
          const tgt = c === 0 ? _T.x : c === 1 ? _T.y : _T.z;
          Vv[i3 + c] += (it.k * (tgt - X[i3 + c]) - it.c * Vv[i3 + c]) * dt;
          X[i3 + c] += Vv[i3 + c] * dt;
          if (X[i3 + c] > 1.4) { X[i3 + c] = 1.4; Vv[i3 + c] = 0; } else if (X[i3 + c] < -1.4) { X[i3 + c] = -1.4; Vv[i3 + c] = 0; }
        }
      }
    }
    const X = this.x, its = this.items;
    for (let i = 0; i < its.length; i++) { const i3 = i * 3; P.rot(its[i].bone, X[i3], X[i3 + 1], X[i3 + 2]); }
  }
}

// ================================================================================================ legs & pose helpers
/** Override one gait leg: target in the body's rest space (local) or model space; paw pitch; meta pitch (hind) */
export function legTo(L, x, y, z, w, local = true, paw = 0, meta) {
  L.override = L.override || new V3();
  L.override.set(x, y, z); L.overrideLocal = local; L.overridePaw = paw;
  if (meta !== undefined) L.overrideMeta = meta;
  if (w > L.overrideW) L.overrideW = w;
}
/** body rotation about X with the pivot kept at a given rest point (e.g. the hips for a rear, the chest for a buck) */
export function pivotPitch(ctl, bone, pivot, th, w) {
  const P = ctl.pose, r = P.rest[bone];
  const hy = pivot[1] - r.y, hz = pivot[2] - r.z, c = Math.cos(th), s = Math.sin(th);
  P.move(bone, 0, (hy - (hy * c - hz * s)) * w, (hz - (hy * s + hz * c)) * w);
  P.rx(bone, th * w);
}
/** the same for a roll about Z around a pivot (lying on the side) */
export function pivotRoll(ctl, bone, pivot, th, w) {
  const P = ctl.pose, r = P.rest[bone];
  const hx = pivot[0] - r.x, hy = pivot[1] - r.y, c = Math.cos(th), s = Math.sin(th);
  P.move(bone, (hx - (hx * c - hy * s)) * w, (hy - (hx * s + hy * c)) * w, 0);
  P.rz(bone, th * w);
}
export { ease, sstep, clamp01, mix, TAU };
