// Shared helpers for the wild creatures (sea monsters + critters): thin rigid limbs, leaf ears, analytic chain skinning
// (quadratic B-spline weights along a bone chain), lofted bodies (elliptical rings along Z → smooth skinned tubes for
// serpents, tentacles, fish and birds), wing / fin sheets, leg overrides and a mini-FK for bones posed after direct
// world placement. Everything here runs at build time except fkBones / ov (allocation-free, used per frame).
import * as THREE from 'three';
import { sweep, rigid, leafGeo } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { lerp3 } from '../../kit/parts.js';
import { sstep, clamp01, mix } from '../../kit/rig.js';

export const V3 = THREE.Vector3;
export const hs = (i) => { const q = Math.sin(i * 78.233 + 12.9898) * 43758.5453; return q - Math.floor(q); };
export const L2 = (s, n) => n + (s < 0 ? 'L' : 'R');
export { lerp3, col, rigid, sstep, clamp01, mix };

/** thin rigid limb segment a→b (rest model space) */
export function limb(acc, bone, a, b, r0, r1, c0, c1 = c0, radial = 5, dtl = [0.15, 0, 0.15, 0]) {
  const ca = col(c0), cb = col(c1);
  acc.add(sweep([a, b], [r0, r1], { radial, capStart: true }), { skin: typeof bone === 'number' ? rigid(bone) : bone, dtl, color: (p, n, uv) => lerp3(ca, cb, uv[1]) });
}
/** jointed leg: consecutive joints pts[i] carried by bones[i]; knob spheres hide the joints */
export function jleg(acc, bones, pts, radii, cols, knobs = true) {
  for (let i = 0; i < bones.length; i++) {
    limb(acc, bones[i], pts[i], pts[i + 1], radii[i], radii[i + 1], cols[i], cols[i + 1]);
    if (i > 0 && knobs) acc.add(new THREE.SphereGeometry(radii[i] * 1.1, 6, 3), { matrix: new THREE.Matrix4().makeTranslation(...pts[i]), skin: rigid(bones[i]), color: cols[i], dtl: [0.15, 0, 0.15, 0] });
  }
}
/** leaf-shaped ear (kit leafGeo) at pos with euler rot (YXZ); inner face tinted */
export function ear(acc, bone, pos, rot, W, H, T, outer, inner, cup = 0.6, o = {}) {
  const g = leafGeo(W, H, T, cup, o.bend ?? 0.15, { nu: o.nu ?? 5, nv: o.nv ?? 5, pw: o.pw ?? 0.8 });
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')); m.setPosition(...pos);
  const co = col(outer), ci = col(inner), ct = col(o.tip ?? outer);
  acc.add(g, { matrix: m, skin: rigid(bone), dtl: [0.2, 0, 0.1, 0], color: (p, n, uv) => lerp3(uv[0] >= 1 ? co : lerp3(ci, co, sstep(0.6, 0.9, (uv[0] % 1) * 2)), ct, sstep(o.tipFrom ?? 0.75, 1, uv[1])) });
}
/** leg override (gait2 legs): target (x,y,z) in body-local (local=true) or model space, weight w, paw pitch */
export function ov(L, x, y, z, w, local = true, paw = -0.4) {
  if (!L.override) L.override = new V3();
  L.override.set(x, y, z); L.overrideLocal = local; L.overridePaw = paw;
  if (w > L.overrideW) L.overrideW = w;
}

// ------------------------------------------------------------------------------------------------ chain skinning
/**
 * Quadratic B-spline skin weights along a chain. S: rest coordinates of the chain bones (ascending), idx: their bone
 * indices, s: the vertex's rest coordinate. Every vertex is influenced by ≤ 3 neighbouring bones with C¹-smooth
 * weights (partition of unity), so a long tube bends smoothly even at 30–40° per joint.
 */
export function chainSkin(S, idx, s) {
  const n = S.length;
  // fractional bone index of s (piecewise linear between bone coordinates)
  let u;
  if (s <= S[0]) u = (s - S[0]) / (S[1] - S[0]);
  else if (s >= S[n - 1]) u = n - 1 + (s - S[n - 1]) / (S[n - 1] - S[n - 2]);
  else { let i = 0; while (i < n - 2 && s > S[i + 1]) i++; u = i + (s - S[i]) / (S[i + 1] - S[i]); }
  const w = new Array(n).fill(0);
  const c = Math.round(u);
  for (let j = c - 1; j <= c + 1; j++) {
    const x = Math.abs(u - j), b = x <= 0.5 ? 0.75 - x * x : x <= 1.5 ? 0.5 * (1.5 - x) * (1.5 - x) : 0;
    if (b > 1e-4) w[Math.max(0, Math.min(n - 1, j))] += b;
  }
  const e = [];
  for (let j = 0; j < n; j++) if (w[j] > 0) e.push([j, w[j]]);
  e.sort((a, b) => b[1] - a[1]); e.length = Math.min(e.length, 4);
  const tot = e.reduce((a, b) => a + b[1], 0) || 1;
  const si = [0, 0, 0, 0], sw = [0, 0, 0, 0];
  e.forEach(([j, wj], k) => { si[k] = idx[j]; sw[k] = wj / tot; });
  return { si, sw };
}

// ------------------------------------------------------------------------------------------------ lofted bodies
/**
 * Loft of elliptical rings along +Z (rest pose). rings: [{ z, y?, x?, rx, ry, ryB? (bottom radius), rxB? }] (ascending z;
 * a ring with rx = ry = 0 closes to a point). radial: segments around. Angle 0 = +X (right), π/2 = +Y (top).
 * o.flatTop / o.keel: optional per-angle shaping fn(a, ring) → radius multiplier.
 * Returns a BufferGeometry with uv.x = around (0..1, 0.25 = top), uv.y = ring index / (n-1), plus userData.ring (z per vertex).
 */
export function loftZ(rings, radial = 12, o = {}) {
  const pos = [], uv = [], idx = [];
  const n = rings.length;
  for (let i = 0; i < n; i++) {
    const R = rings[i];
    for (let k = 0; k <= radial; k++) {
      const a = k / radial * Math.PI * 2 + (o.phase ?? 0);
      const ca = Math.cos(a), sa = Math.sin(a);
      const rx = (sa < 0 && R.rxB !== undefined) ? mix(R.rx, R.rxB, -sa) : R.rx;
      const ry = sa >= 0 ? R.ry : (R.ryB ?? R.ry);
      const m = o.shape ? o.shape(a, R, i) : 1;
      pos.push((R.x ?? 0) + ca * rx * m, (R.y ?? 0) + sa * ry * m, R.z);
      uv.push(k / radial, i / (n - 1));
    }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < radial; k++) {
    const a = i * (radial + 1) + k, b = a + radial + 1;
    // outward winding for rings running along +Z with angle CCW from +X to +Y
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // weld the seam normals (k = 0 and k = radial are the same point) and point the tip normals along the axis
  const na = g.attributes.normal;
  for (let i = 0; i < n; i++) {
    const a = i * (radial + 1), b = a + radial;
    const x = na.getX(a) + na.getX(b), y = na.getY(a) + na.getY(b), z = na.getZ(a) + na.getZ(b), l = Math.hypot(x, y, z) || 1;
    na.setXYZ(a, x / l, y / l, z / l); na.setXYZ(b, x / l, y / l, z / l);
    const R = rings[i];
    if (R.rx < 1e-5 && R.ry < 1e-5) { const d = i === 0 ? -1 : 1; for (let k = 0; k <= radial; k++) na.setXYZ(a + k, 0, 0, d); }
  }
  return g;
}

/**
 * Flat sheet (fin / wing / feather fan) from a polygon outline in a local 2D plane, triangulated as a fan of rays from a
 * root point with `rings` subdivisions (so vertex colours can paint radial veins, bands and edges).
 * outline: [[u,v]…] (ordered along the edge), root: [u,v]. map(u, v, f, t) → [x,y,z] places the 2D point in rest model
 * space (f = 0 root → 1 edge, t = 0..1 along the outline). Single-sided: render with a DoubleSide material or add twice.
 * Returns { geo, f: Float32Array per vertex, t: Float32Array per vertex }.
 */
export function fanSheet(outline, root, map, rings = 3, o = {}) {
  const pos = [], F = [], T = [], idx = [];
  const m = outline.length;
  pos.push(...map(root[0], root[1], 0, 0.5)); F.push(0); T.push(0.5);
  if (o.fs) rings = o.fs.length;
  for (let r = 1; r <= rings; r++) {
    const f = o.fs ? o.fs[r - 1] : Math.pow(r / rings, o.pow ?? 1);
    for (let j = 0; j < m; j++) {
      const u = mix(root[0], outline[j][0], f), v = mix(root[1], outline[j][1], f);
      pos.push(...map(u, v, f, j / (m - 1))); F.push(f); T.push(j / (m - 1));
    }
  }
  const at = (r, j) => r === 0 ? 0 : 1 + (r - 1) * m + j;
  for (let j = 0; j < m - 1; j++) idx.push(0, at(1, j), at(1, j + 1));
  for (let r = 1; r < rings; r++) for (let j = 0; j < m - 1; j++) {
    const a = at(r, j), b = at(r, j + 1), c = at(r + 1, j), d = at(r + 1, j + 1);
    idx.push(a, c, b, b, c, d);
  }
  if (o.close) { idx.push(0, at(1, m - 1), at(1, 0)); for (let r = 1; r < rings; r++) { const a = at(r, m - 1), b = at(r, 0), c = at(r + 1, m - 1), d = at(r + 1, 0); idx.push(a, c, b, b, c, d); } }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(F.map((f, i) => [f, T[i]]).flat(), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Rectangular grid sheet: map(u, v) → [x,y,z] for u,v ∈ [0,1]; uv attribute = (u, v). */
export function gridSheet(nu, nv, map) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const u = i / nu, v = j / nv; pos.push(...map(u, v)); uv.push(u, v); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Duplicate a single-sided sheet into a two-sided one (back face offset by `thick` along -normal, reversed winding). */
export function twoSided(g, thick = 0.002) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, ix = g.index.array;
  const N = p.count, pos = new Float32Array(N * 6), nrm = new Float32Array(N * 6), uvs = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < 3; k++) {
      const pv = p.array[i * 3 + k], nv = n.array[i * 3 + k];
      pos[i * 3 + k] = pv + nv * thick * 0.5; nrm[i * 3 + k] = nv;
      pos[(N + i) * 3 + k] = pv - nv * thick * 0.5; nrm[(N + i) * 3 + k] = -nv;
    }
    uvs[i * 2] = uv.array[i * 2]; uvs[i * 2 + 1] = uv.array[i * 2 + 1]; uvs[(N + i) * 2] = uv.array[i * 2]; uvs[(N + i) * 2 + 1] = uv.array[i * 2 + 1];
  }
  const I = [];
  for (let t = 0; t < ix.length; t += 3) { I.push(ix[t], ix[t + 1], ix[t + 2]); I.push(N + ix[t], N + ix[t + 2], N + ix[t + 1]); }
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g2.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g2.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g2.setIndex(I);
  return g2;
}

/** Overwrite the skin weights of acc vertices [v0, v1) with fn(x, y, z, i) → { si, sw } (e.g. analytic chain skinning of SDF verts). */
export function reskin(acc, v0, v1, fn) {
  for (let i = v0; i < v1; i++) {
    const r = fn(acc.P[i * 3], acc.P[i * 3 + 1], acc.P[i * 3 + 2], i);
    if (!r) continue;
    for (let k = 0; k < 4; k++) { acc.SI[i * 4 + k] = r.si[k]; acc.SW[i * 4 + k] = r.sw[k]; }
  }
}

/** Highest surface point of an SDF group straight above/below (x, z): marches down from y0, then bisects. */
export function topAt(S, x, z, group = 0, y0 = 1.5, y1 = -1.5, step = 0.01) {
  let prev = y0;
  for (let y = y0; y >= y1; y -= step) {
    if (S.sdf(x, y, z, group) < 0) { let a = y, b = prev; for (let i = 0; i < 20; i++) { const m = (a + b) / 2; if (S.sdf(x, m, z, group) < 0) a = m; else b = m; } return (a + b) / 2; }
    prev = y;
  }
  return y1;
}

// ------------------------------------------------------------------------------------------------ per-frame helpers
const _t = new V3();
/** Forward kinematics for `list` (parent-before-child order) from the parents' current world transforms. */
export function fkBones(P, list) {
  for (let n = 0; n < list.length; n++) {
    const i = list[n], p = P.par[i];
    if (p < 0) { P.wq[i].copy(P.lq[i]); P.wp[i].copy(P.rest[i]).add(P.lt[i]); continue; }
    P.wq[i].multiplyQuaternions(P.wq[p], P.lq[i]);
    _t.copy(P.off[i]).add(P.lt[i]).applyQuaternion(P.wq[p]);
    P.wp[i].copy(P.wp[p]).add(_t);
  }
}
/** smooth 1D value noise (deterministic, allocation-free) in [-1, 1] */
export function vnoise(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  const a = hs(i * 1.37 + seed * 17.1) * 2 - 1, b = hs((i + 1) * 1.37 + seed * 17.1) * 2 - 1;
  return a + (b - a) * u;
}
