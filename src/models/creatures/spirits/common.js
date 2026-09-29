// Shared helpers for the undead & elemental family (skeleton, wraith, wisp, crystal golem):
//   - postHook: per-instance hook that runs after FK/IK, right before the pose is written to the bones
//     (world-space overrides: scattering bone piles / crumbling rocks, two-handed grips, bow strings)
//   - boneStats: per-bone centroid + extents of the rigid geometry (built once per entry)
//   - Pile: plans a heap of loose pieces on the ground and blends every bone into it (death) or out of it (spawn)
//   - small geometry builders (bone shafts with knobbly ends, knobs, hexagonal crystals, lathe discs)
import * as THREE from 'three';
import { sweep } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { mix, clamp01, sstep, TAU } from '../../kit/rig.js';

const V3 = THREE.Vector3;
export const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const hash = (i, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7 + 17.3) * 43758.5453; return x - Math.floor(x); };
export const easeOut = (x) => 1 - (1 - clamp01(x)) * (1 - clamp01(x));
export const easeIO = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

/** Run fn(ctl) after the controller's FK / leg IK, right before the pose reaches the bones (allocation-free). */
export function postHook(ctl, fn) {
  const P = ctl.pose, apply = P.apply;
  P.apply = function (bones) { fn(ctl); apply.call(P, bones); };
}

/** Per-bone centroid & half extents (model space, rest) of the vertices each bone dominates. */
export function boneStats(acc, nb) {
  const out = Array.from({ length: nb }, () => ({ n: 0, c: [0, 0, 0], lo: [1e9, 1e9, 1e9], hi: [-1e9, -1e9, -1e9], h: [0, 0, 0] }));
  const P = acc.P, SI = acc.SI, SW = acc.SW, n = acc.count;
  for (let i = 0; i < n; i++) {
    let b = SI[i * 4], w = SW[i * 4];
    for (let k = 1; k < 4; k++) if (SW[i * 4 + k] > w) { w = SW[i * 4 + k]; b = SI[i * 4 + k]; }
    const s = out[b];
    s.n++;
    for (let k = 0; k < 3; k++) { const v = P[i * 3 + k]; s.c[k] += v; if (v < s.lo[k]) s.lo[k] = v; if (v > s.hi[k]) s.hi[k] = v; }
  }
  for (const s of out) if (s.n) for (let k = 0; k < 3; k++) { s.c[k] = (s.lo[k] + s.hi[k]) / 2; s.h[k] = (s.hi[k] - s.lo[k]) / 2; }
  return out;
}

// ================================================================================================ pile (scatter / assemble)
const _a = new V3(), _b = new V3(), _c = new V3(), _ax = new V3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
const Y = new V3(0, 1, 0);
/**
 * A heap of loose rigid pieces (one per bone). plan() picks a resting pose on the ground for every bone that owns
 * geometry; blend() moves the posed bones into it (falling with gravity, tumbling, a small bounce, optional roll).
 * Everything is preallocated: plan() and blend() allocate nothing.
 */
export class Pile {
  constructor(n) {
    this.n = n; this.on = new Uint8Array(n);
    this.d = new Float32Array(n); this.f = new Float32Array(n); this.hop = new Float32Array(n);
    this.roll = new Float32Array(n); this.rad = new Float32Array(n);
    this.p = Array.from({ length: n }, () => new V3()); this.q = Array.from({ length: n }, () => new THREE.Quaternion());
    this.rdir = Array.from({ length: n }, () => new V3());
    this.planned = false;
  }
  /**
   * stats: boneStats; o: { cx, cz (heap centre, model space), pull (0..1 toward the centre), spread (m), delay: [min, max] s,
   *   fall (s per √m of drop), hop, skip: Set(bone), per: { [bone]: { tilt: [x,y,z] euler, dx, dz, delay, roll, hop } }, seed }
   */
  plan(ctl, stats, o) {
    const P = ctl.pose, seed = o.seed ?? 0;
    for (let i = 0; i < this.n; i++) {
      const s = stats[i];
      if (!s || s.n < 3 || (o.skip && o.skip.has(i))) { this.on[i] = 0; continue; }
      this.on[i] = 1;
      const per = o.per && o.per[i];
      const hx = s.h[0], hy = s.h[1], hz = s.h[2];
      const q = this.q[i];
      if (per && per.tilt) q.setFromEuler(_e.set(per.tilt[0], per.tilt[1] + (per.yawRand ?? 1) * (hash(i * 13 + 1, seed) - 0.5) * 2.4, per.tilt[2], 'YXZ'));
      else { // lie the piece on its broad side: thinnest axis → vertical (random side up), random yaw, slight tilt
        const sg = hash(i * 13 + 4, seed) < 0.5 ? -1 : 1;
        if (hx <= hy && hx <= hz) _b.set(sg, 0, 0); else if (hz <= hy) _b.set(0, 0, sg); else _b.set(0, sg, 0);
        q.setFromUnitVectors(_b, Y);
        q.premultiply(_q.setFromAxisAngle(Y, hash(i * 13 + 6, seed) * TAU));
        q.premultiply(_q.setFromAxisAngle(_ax.set(1, 0, 0), (hash(i * 13 + 7, seed) - 0.5) * 0.35));
      }
      // lowest point of the rotated box → rest on the ground
      let minY = 1e9;
      for (let c = 0; c < 8; c++) { _c.set(c & 1 ? hx : -hx, c & 2 ? hy : -hy, c & 4 ? hz : -hz).applyQuaternion(q); if (_c.y < minY) minY = _c.y; }
      // current centroid (model space) → pulled toward the heap centre + scatter
      P.carry(i, _a.set(s.c[0], s.c[1], s.c[2]), _b);
      const spread = o.spread ?? 0.3;
      let tx = mix(_b.x, o.cx ?? 0, o.pull ?? 0.35) + (hash(i * 13 + 8, seed) - 0.5) * spread + (per?.dx ?? 0);
      let tz = mix(_b.z, o.cz ?? 0, o.pull ?? 0.35) + (hash(i * 13 + 9, seed) - 0.5) * spread + (per?.dz ?? 0);
      const ty = -minY * (per?.sink ?? 1) + (per?.lift ?? hash(i * 13 + 10, seed) * (o.stack ?? 0.03)) + (o.bury ? minY * 2 * o.bury : 0);
      // pivot = target centroid − q·(centroid − rest pivot)
      _c.set(s.c[0], s.c[1], s.c[2]).sub(P.rest[i]).applyQuaternion(q);
      this.p[i].set(tx, ty, tz).sub(_c);
      const drop = Math.max(0, _b.y - ty);
      const dl = o.delay ?? [0.2, 0.45];
      this.d[i] = per?.delay ?? (o.order === 'height' ? mix(dl[0], dl[1], clamp01(s.c[1] / (o.H ?? 2)) * 0.85 + hash(i * 13 + 11, seed) * 0.15) : mix(dl[0], dl[1], hash(i * 13 + 11, seed)));
      this.f[i] = 0.12 + (o.fall ?? 0.32) * Math.sqrt(drop);
      this.hop[i] = (per?.hop ?? o.hop ?? 0.05) * (0.5 + hash(i * 13 + 12, seed));
      this.roll[i] = per?.roll ?? 0;
      this.rad[i] = Math.max(0.02, Math.min(hx, hy, hz) * 1.2);
      if (this.roll[i]) { const ang = hash(i * 13 + 14, seed) * TAU; this.rdir[i].set(Math.cos(ang), 0, Math.sin(ang)); }
    }
    this.planned = true;
  }
  /** t: seconds since the collapse started; w: blend weight. rev = true plays it backwards-in-spirit (assemble): u = 1 - s */
  blend(ctl, t, w) {
    const P = ctl.pose;
    for (let i = 0; i < this.n; i++) {
      if (!this.on[i]) continue;
      const s = clamp01((t - this.d[i]) / this.f[i]);
      if (s <= 0) continue;
      const wp = P.wp[i], tgt = this.p[i];
      let bx = tgt.x, by = tgt.y, bz = tgt.z;
      let spin = 0;
      if (s >= 1) {
        const u = t - this.d[i] - this.f[i];
        by += this.hop[i] * Math.max(0, Math.sin(u * 17)) * Math.exp(-u * 6);
        if (this.roll[i]) { const rr = this.roll[i] * easeOut(u / 0.7); bx += this.rdir[i].x * rr; bz += this.rdir[i].z * rr; spin = rr / this.rad[i]; }
      }
      const e = s * s, eo = easeOut(s);
      wp.x += (bx - wp.x) * eo * w; wp.z += (bz - wp.z) * eo * w; wp.y += (by - wp.y) * e * w;
      _q2.copy(this.q[i]);
      if (spin) { _ax.crossVectors(Y, this.rdir[i]).normalize(); _q2.premultiply(_q.setFromAxisAngle(_ax, spin)); }
      P.wq[i].slerp(_q2, easeIO(s) * w);
    }
  }
  /** reverse blend (spawn: pieces rise out of the heap into the posed body). s per bone from t with the same delays. */
  assemble(ctl, t, w, dur = 1) {
    const P = ctl.pose;
    for (let i = 0; i < this.n; i++) {
      if (!this.on[i]) continue;
      // pieces leave the heap bottom-up: bones with a long fall assemble last
      const s = clamp01((t - this.d[i]) / (this.f[i] * dur));
      if (s >= 1) continue;
      const u = 1 - s, wp = P.wp[i], tgt = this.p[i];
      const e = u * u * (3 - 2 * u);
      const lift = Math.sin(s * Math.PI) * 0.12 * (1 - u);
      wp.x += (tgt.x - wp.x) * e * w; wp.z += (tgt.z - wp.z) * e * w; wp.y += (tgt.y - wp.y) * e * w + lift * w;
      P.wq[i].slerp(this.q[i], e * w);
    }
  }
}

// ================================================================================================ geometry
/**
 * Long bone a→b: shaft of radius rs with knobbly ends ka / kb (epiphyses), slight bow. color: fn(p, n, uv) | hex.
 * o: { radial, flat, up, bow: [x,y,z] (mid offset), n }
 */
export function longBone(acc, skin, a, b, rs, ka, kb, color, o = {}) {
  const A = new V3(...a), B = new V3(...b), bow = new V3(...(o.bow ?? [0, 0, 0]));
  const T = o.lo ? [0, 0.05, 0.17, 0.5, 0.83, 0.95, 1] : [0, 0.035, 0.09, 0.2, 0.5, 0.8, 0.91, 0.965, 1];
  const R = o.lo ? [ka * 0.5, ka * 0.92, rs * 1.1, rs * 0.94, rs * 1.1, kb * 0.92, kb * 0.5] : [ka * 0.5, ka * 0.92, ka * 0.8, rs * 1.08, rs * 0.94, rs * 1.08, kb * 0.8, kb * 0.92, kb * 0.5];
  const pts = [], rad = [];
  for (let i = 0; i < T.length; i++) { pts.push(A.clone().lerp(B, T[i]).addScaledVector(bow, Math.sin(Math.PI * T[i]))); rad.push(R[i]); }
  const g = sweep(pts, rad, { radial: o.radial ?? 6, capStart: true, flat: o.flat ?? 1, up: o.up });
  acc.add(g, { skin, color, dtl: o.dtl ?? [0, 0.1, 0.3, 0.15] });
}
/** small smooth knob (joint condyle, kneecap, knuckle) */
export function knob(acc, skin, p, r, color, o = {}) {
  const g = new THREE.SphereGeometry(1, o.ws ?? 6, o.hs ?? 4);
  const m = new THREE.Matrix4().makeScale(r * (o.sx ?? 1), r * (o.sy ?? 1), r * (o.sz ?? 1));
  if (o.rot) m.premultiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(o.rot[0], o.rot[1], o.rot[2], 'YXZ')));
  m.setPosition(p[0], p[1], p[2]);
  acc.add(g, { matrix: m, skin, color, dtl: o.dtl ?? [0, 0.1, 0.3, 0], emis: o.emis ?? 0 });
}
/**
 * Hexagonal crystal: prism base→tip along dir, pyramid point. r = radius, len = total length, tipK = pyramid fraction.
 * c: { base, tip } hex; emis: [base, tip] emissive; skin.
 */
export function crystal(acc, skin, base, dir, len, r, c, emis = [0.6, 2.4], o = {}) {
  const d = new V3(...dir).normalize(), b0 = new V3(...base);
  const sides = o.sides ?? 6, tipK = o.tipK ?? 0.3;
  const up = Math.abs(d.y) > 0.9 ? new V3(1, 0, 0) : new V3(0, 1, 0);
  const u = new V3().crossVectors(d, up).normalize(), v = new V3().crossVectors(d, u).normalize();
  const rot = o.rot ?? 0;
  const pos = [], idx = [], uvs = [];
  const ring = (t, rr, uvy) => {
    const s0 = pos.length / 3;
    const cp = b0.clone().addScaledVector(d, len * t);
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * TAU + rot;
      const p = cp.clone().addScaledVector(u, Math.cos(a) * rr).addScaledVector(v, Math.sin(a) * rr);
      pos.push(p.x, p.y, p.z); uvs.push(k / sides, uvy);
    }
    return s0;
  };
  // flat-shaded: every face gets its own vertices (crisp facets)
  const r0 = ring(0, r * (o.baseK ?? 0.85), 0), r1 = ring(1 - tipK, r, 1 - tipK);
  const tip = b0.clone().addScaledVector(d, len);
  const P = [], U = [];
  const push = (i) => { P.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); U.push(uvs[i * 2], uvs[i * 2 + 1]); };
  for (let k = 0; k < sides; k++) {
    const k1 = (k + 1) % sides;
    push(r0 + k); push(r1 + k); push(r1 + k1);
    push(r0 + k); push(r1 + k1); push(r0 + k1);
    push(r1 + k); P.push(tip.x, tip.y, tip.z); U.push(0.5, 1); push(r1 + k1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.computeVertexNormals();
  const cb = col(c.base), ct = col(c.tip);
  acc.add(g, { skin, color: (p, n, uv) => lerp3(cb, ct, sstep(0.1, 1, uv[1])), emis: (p, uv) => mix(emis[0], emis[1], sstep(0.05, 1, uv[1])), dtl: [0, 0, 0.05, 0] });
}
/** Lathe disc (shield / buckler / plate): profile [[r, y]…] revolved around local Y, then oriented so +Y → normal at pos. */
export function lathe(profile, seg, pos, normal, spin = 0, disp = null) {
  // authored top/centre → outward/down along the outer surface; LatheGeometry faces outward for upward profiles → reverse
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(1e-4, r), y)).reverse(), seg);
  if (disp) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { _a.fromBufferAttribute(p, i); disp(_a, i); p.setXYZ(i, _a.x, _a.y, _a.z); } g.computeVertexNormals(); }
  const m = new THREE.Matrix4().makeRotationY(spin);
  m.premultiply(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, new V3(...normal).normalize())));
  m.setPosition(pos[0], pos[1], pos[2]);
  return { g, m };
}

/**
 * Faceted boulder (flat shaded): icosphere displaced by position-hashed noise and chiselled by a few random planes, then
 * scaled by radii [x,y,z], rotated (euler YXZ) and moved to pos. Returns a non-indexed BufferGeometry in model space.
 */
export function rockGeo(pos, radii, rot, seed, detail = 1, o = {}) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const pa = g.attributes.position, v = new V3();
  const cuts = [];
  const nc = o.cuts ?? 5;
  for (let i = 0; i < nc; i++) {
    const u = hash(i * 3 + 1, seed) * 2 - 1, a = hash(i * 3 + 2, seed) * TAU, s = Math.sqrt(1 - u * u);
    cuts.push([new V3(s * Math.cos(a), u, s * Math.sin(a)), 0.72 + hash(i * 3 + 3, seed) * 0.2]);
  }
  const bump = o.bump ?? 0.12;
  for (let i = 0; i < pa.count; i++) {
    v.fromBufferAttribute(pa, i);
    const key = Math.round(v.x * 997) * 7 + Math.round(v.y * 991) * 13 + Math.round(v.z * 983) * 17;
    let r = 1 + (hash(key, seed) - 0.5) * 2 * bump;
    v.multiplyScalar(r);
    for (const [n, d] of cuts) { const k = v.dot(n); if (k > d) v.addScaledVector(n, d - k); }
    if (o.flatBottom !== undefined && v.y < -o.flatBottom) v.y = -o.flatBottom;
    pa.setXYZ(i, v.x * radii[0], v.y * radii[1], v.z * radii[2]);
  }
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')).setPosition(pos[0], pos[1], pos[2]);
  g.applyMatrix4(m);
  g.computeVertexNormals(); // non-indexed → flat facets
  return g;
}
