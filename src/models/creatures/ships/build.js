// Geometry builders for ships: one merged "wood" mesh (hull, deck, spars, ropes, guns, lanterns, props) with
// vertex paint + aux (emissive, plank detail, metal, anim code) + pivot attributes. See mats.js for the attribute meaning.
import * as THREE from 'three';

export const TU = 2.0, TV = 1.6;          // plank texture tile in metres (u along the planks, v across: 8 planks of 0.2 m)
export const GV0 = 0.016, GV1 = 0.104;    // v band of the joint-free plank row (plain grain: spars, rails, trims)

const _p = new THREE.Vector3(), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const WHITE = [1, 1, 1];

export class WoodBuilder {
  constructor() { this.P = []; this.N = []; this.C = []; this.UV = []; this.A = []; this.V = []; this.I = []; this.marks = []; this._m = 0; }
  get count() { return this.P.length / 3; }
  /** Triangle accounting: mark('section') after each section; report() → { section: tris } */
  mark(name) { const n = this.I.length / 3; this.marks.push([name, n - this._m]); this._m = n; }
  report() { const o = {}; for (const [k, v] of this.marks) o[k] = (o[k] || 0) + v; return o; }
  /**
   * Append a geometry. o: { color: [r,g,b] (linear) | fn(p, n) → [r,g,b], uv: 'box' (planar in metres by normal) |
   * 'keep' | fn(p, n, u, v) → [u, v], e: emissive, d: plank detail (default 1), metal, anim, piv: [x,y,z] }
   */
  add(geo, m = null, o = {}) {
    const pa = geo.attributes.position, na = geo.attributes.normal, ua = geo.attributes.uv;
    const base = this.count;
    if (m) _m3.getNormalMatrix(m);
    const col = o.color || WHITE, cf = typeof col === 'function';
    const uvm = o.uv || 'box', uf = typeof uvm === 'function';
    const e = o.e || 0, d = o.d ?? 1, mt = o.metal || 0, w = o.anim || 0, pv = o.piv || null;
    for (let i = 0; i < pa.count; i++) {
      _p.fromBufferAttribute(pa, i); if (m) _p.applyMatrix4(m);
      if (na) { _n.fromBufferAttribute(na, i); if (m) _n.applyMatrix3(_m3).normalize(); } else _n.set(0, 1, 0);
      this.P.push(_p.x, _p.y, _p.z); this.N.push(_n.x, _n.y, _n.z);
      const c = cf ? col(_p, _n, i) : col; this.C.push(c[0], c[1], c[2]);
      if (uf) { const t = uvm(_p, _n, ua ? ua.getX(i) : 0, ua ? ua.getY(i) : 0); this.UV.push(t[0], t[1]); }
      else if (uvm === 'keep' && ua) this.UV.push(ua.getX(i), ua.getY(i));
      else {
        const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
        if (ay >= ax && ay >= az) this.UV.push(_p.z / TU, _p.x / TV);
        else if (ax >= az) this.UV.push(_p.z / TU, _p.y / TV);
        else this.UV.push(_p.x / TU, _p.y / TV);
      }
      this.A.push(e, typeof d === 'function' ? d(_p) : d, mt, w);
      if (pv) this.V.push(pv[0], pv[1], pv[2]); else this.V.push(_p.x, _p.y, _p.z);
    }
    if (geo.index) { const ix = geo.index.array; for (let i = 0; i < ix.length; i++) this.I.push(base + ix[i]); }
    else for (let i = 0; i < pa.count; i++) this.I.push(base + i);
    return this;
  }
  /** Raw push of one vertex (used by ropes / sweeps). */
  vert(x, y, z, nx, ny, nz, c, u, v, o) {
    this.P.push(x, y, z); this.N.push(nx, ny, nz); this.C.push(c[0], c[1], c[2]); this.UV.push(u, v);
    this.A.push(o.e || 0, o.d ?? 1, o.metal || 0, o.anim || 0);
    const pv = o.piv; if (pv) this.V.push(pv[0], pv[1], pv[2]); else this.V.push(x, y, z);
  }
  /** Tube through points (array of Vector3), radius r (number or array), radial segments. Grain UV along. */
  tube(pts, r, color, o = {}) {
    const n = pts.length, rad = o.radial ?? 4, base = this.count;
    if (n < 2) return;
    let len = 0;
    const T = _a, N = _b, Bn = _c, prevN = _d.set(0, 0, 0);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      if (i < n - 1) T.subVectors(pts[i + 1], p); else T.subVectors(p, pts[i - 1]);
      T.normalize();
      if (i === 0) { N.set(0, 1, 0); if (Math.abs(T.y) > 0.9) N.set(1, 0, 0); N.addScaledVector(T, -T.dot(N)).normalize(); }
      else { N.copy(prevN).addScaledVector(T, -T.dot(prevN)).normalize(); }
      prevN.copy(N);
      Bn.crossVectors(T, N);
      if (i) len += p.distanceTo(pts[i - 1]);
      const rr = Array.isArray(r) ? r[i] : r;
      for (let k = 0; k <= rad; k++) {
        const ang = k / rad * Math.PI * 2 + (o.twist || 0), cx = Math.cos(ang), cy = Math.sin(ang);
        const nx = N.x * cx + Bn.x * cy, ny = N.y * cx + Bn.y * cy, nz = N.z * cx + Bn.z * cy;
        this.vert(p.x + nx * rr, p.y + ny * rr, p.z + nz * rr, nx, ny, nz, color, len / TU, GV0 + k / rad * (GV1 - GV0), o);
      }
    }
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < rad; k++) {
      const a = base + i * (rad + 1) + k, b = a + rad + 1;
      this.I.push(a, b, a + 1, a + 1, b, b + 1);
    }
    if (o.caps) {
      for (const end of [0, n - 1]) {
        const c = this.count, p = pts[end];
        T.subVectors(pts[end ? n - 1 : 1], pts[end ? n - 2 : 0]).normalize(); if (!end) T.negate();
        this.vert(p.x, p.y, p.z, T.x, T.y, T.z, color, 0, GV0, o);
        const ring = base + end * (rad + 1);
        for (let k = 0; k < rad; k++) { if (end) this.I.push(ring + k, c, ring + k + 1); else this.I.push(ring + k + 1, c, ring + k); }
      }
    }
  }
  /** Straight or sagging rope between a and b. sag in metres (down). */
  rope(a, b, r, color, sag = 0, o = {}) {
    const segs = sag > 0.001 ? (o.segs ?? 6) : 1, pts = [];
    for (let i = 0; i <= segs; i++) { const t = i / segs; pts.push(V3().lerpVectors(a, b, t).setY(a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t))); }
    this.tube(pts, r, color, { d: 0.35, radial: o.radial ?? 4, ...o });
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.UV, 2));
    g.setAttribute('aux', new THREE.Float32BufferAttribute(this.A, 4));
    g.setAttribute('piv', new THREE.Float32BufferAttribute(this.V, 3));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.I, 1) : new THREE.Uint16BufferAttribute(this.I, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// ------------------------------------------------------------------------------------------------ matrices
/** Matrix: translate (x,y,z), Euler (rx, ry, rz) in 'YXZ' order, scale s (number or [sx,sy,sz]). */
export function M(x, y, z, rx = 0, ry = 0, rz = 0, s = 1) {
  const m = new THREE.Matrix4();
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
  const sc = typeof s === 'number' ? _p.set(s, s, s) : _p.set(s[0], s[1], s[2]);
  return m.compose(_a.set(x, y, z), _q, sc.clone());
}
/** Matrix mapping local +Y onto the segment a→b (origin at a). Local geometry should span y ∈ [0, len]. */
export function MY(a, b, spin = 0) {
  const dir = _a.subVectors(b, a).normalize();
  _q.setFromUnitVectors(_c.set(0, 1, 0), dir);
  if (spin) _q.multiply(new THREE.Quaternion().setFromAxisAngle(_c.set(0, 1, 0), spin));
  return new THREE.Matrix4().compose(a.clone(), _q, _d.set(1, 1, 1));
}
/** Frame matrix from basis vectors (columns) + origin. */
export function MB(o, x, y, z) { return new THREE.Matrix4().makeBasis(x, y, z).setPosition(o); }

// ------------------------------------------------------------------------------------------------ primitives (UVs in plank tiles)
export function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
/** Cylinder along +Y from 0..h (grain UV along the axis). */
export function cyl(r0, r1, h, seg = 8, open = false, y0 = 0) {
  const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1, open);
  g.translate(0, h / 2 + y0, 0);
  const uv = g.attributes.uv, pa = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pa.getY(i) / TU, GV0 + uv.getX(i) * (GV1 - GV0));
  return g;
}
/** Lathe along +Y: profile [[r, y], …]; UV: along = y, around = grain band (or staves when staves > 0). */
export function lathe(profile, seg = 10, staves = 0) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg);
  const uv = g.attributes.uv, pa = g.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const a = uv.getX(i);
    uv.setXY(i, pa.getY(i) / TU, staves ? a * staves / 8 : GV0 + a * (GV1 - GV0));
  }
  return g;
}
export function sphere(r, ws = 8, hs = 6) { return new THREE.SphereGeometry(r, ws, hs); }
export function cone(r, h, seg = 8) { const g = new THREE.ConeGeometry(r, h, seg); g.translate(0, h / 2, 0); return g; }
export function torus(R, r, rs = 6, ts = 16, arc = Math.PI * 2) { return new THREE.TorusGeometry(R, r, rs, ts, arc); }

/** Grid surface: fn(i, j) → [x, y, z, u, v]; (nu+1)×(nv+1) vertices; flip reverses winding. Smooth normals. */
export function gridGeo(nu, nv, fn, flip = false) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const r = fn(i, j); pos.push(r[0], r[1], r[2]); uv.push(r[3] ?? 0, r[4] ?? 0); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** Flat polygon (convex or star-ish, fan from centroid) in the XY plane facing +Z, extruded by depth (box sides). */
export function slab(pts2, depth, bevel = 0) {
  const shape = new THREE.Shape(pts2.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Sample a sagging line a→b into n+1 points. */
export function sagPts(a, b, sag, n = 6) {
  const out = [];
  for (let i = 0; i <= n; i++) { const t = i / n; out.push(V3().lerpVectors(a, b, t).setY(a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t))); }
  return out;
}
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
export const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
