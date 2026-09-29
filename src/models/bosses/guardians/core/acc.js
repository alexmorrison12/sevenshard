// Skinned-geometry accumulator for guardian meshes.
// Same `vert(...)` signature as kit/geo.js GeoAcc (so kit Sculpt.mesh can emit into it) plus extra per-vertex data:
//   aux  = (emis, glowMix, kind, part)   uv = free 2D param (membrane / flame / plate coordinates)
// `cur` holds the values for vertices emitted by Sculpt (the boss paint callback sets them per vertex).
import * as THREE from 'three';
import { col } from '../../../kit/sdf.js';

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3();

// surface kinds understood by the guardian material (aux.z)
export const K = { skin: 0, hard: 1, crystal: 2, membrane: 3, flame: 4, eye: 5, mouth: 6, lava: 7, hair: 8, water: 9, bolt: 10 };

export class BossAcc {
  constructor() {
    this.P = []; this.N = []; this.C = []; this.SI = []; this.SW = []; this.D = []; this.A = []; this.U = []; this.I = [];
    this.cur = { gm: 1, kind: 0, part: 0, u: 0, v: 0 };
  }
  get count() { return this.P.length / 3; }
  vert(x, y, z, nx, ny, nz, r, g, b, si, sw, d0, d1, d2, d3, emis, fx) {
    const c = this.cur;
    this.P.push(x, y, z); this.N.push(nx, ny, nz); this.C.push(r, g, b);
    this.SI.push(si[0], si[1], si[2], si[3]); this.SW.push(sw[0], sw[1], sw[2], sw[3]);
    this.D.push(d0, d1, d2, d3); this.A.push(emis, c.gm, c.kind, c.part); this.U.push(c.u, c.v);
    return this.count - 1;
  }
  /** full vertex with explicit extras */
  v(x, y, z, nx, ny, nz, c3, si, sw, dtl, emis, gm, kind, part, u, v) {
    this.P.push(x, y, z); this.N.push(nx, ny, nz); this.C.push(c3[0], c3[1], c3[2]);
    this.SI.push(si[0], si[1], si[2], si[3]); this.SW.push(sw[0], sw[1], sw[2], sw[3]);
    this.D.push(dtl[0], dtl[1], dtl[2], dtl[3]); this.A.push(emis, gm, kind, part); this.U.push(u, v);
    return this.count - 1;
  }
  tri(a, b, c) { this.I.push(a, b, c); }
  /**
   * Append a THREE geometry. o: matrix, color (hex | [r,g,b] | fn(p, n, uv, i) → hex|[r,g,b]), skin ({si, sw} | fn(p) → {si, sw}),
   * dtl [4], emis (num | fn(p, uv)), gm (glow mix num | fn), kind, part, uv (fn(uv, p) → [u, v]) , flip (reverse winding)
   */
  add(geo, o = {}) {
    const p = geo.attributes.position, na = geo.attributes.normal, uva = geo.attributes.uv;
    const m = o.matrix || null;
    if (m) _m3.getNormalMatrix(m);
    const base = this.count;
    const colr = typeof o.color === 'function' ? null : col(o.color ?? 0xffffff);
    const d = o.dtl ?? [0, 0, 0.15, 0];
    const uv = [0, 0];
    let skin = typeof o.skin === 'function' ? null : o.skin;
    const kind = o.kind ?? 0, part = o.part ?? 0;
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i); if (m) _v.applyMatrix4(m);
      if (na) { _n.fromBufferAttribute(na, i); if (m) _n.applyMatrix3(_m3).normalize(); } else _n.set(0, 1, 0);
      if (uva) { uv[0] = uva.getX(i); uv[1] = uva.getY(i); } else { uv[0] = uv[1] = 0; }
      if (o.normalFn) o.normalFn(_v, _n, uv);
      const c = colr || col(o.color(_v, _n, uv, i));
      if (typeof o.skin === 'function') skin = o.skin(_v);
      const em = typeof o.emis === 'function' ? o.emis(_v, uv) : (o.emis ?? 0);
      const gm = typeof o.gm === 'function' ? o.gm(_v, uv) : (o.gm ?? 1);
      const uu = o.uv ? o.uv(uv, _v) : uv;
      this.v(_v.x, _v.y, _v.z, _n.x, _n.y, _n.z, c, skin.si, skin.sw, d, em, gm, kind, part, uu[0], uu[1]);
    }
    if (geo.index) {
      const ix = geo.index.array;
      if (o.flip) for (let i = 0; i < ix.length; i += 3) this.I.push(base + ix[i], base + ix[i + 2], base + ix[i + 1]);
      else for (let i = 0; i < ix.length; i++) this.I.push(base + ix[i]);
    } else for (let i = 0; i < p.count; i++) this.I.push(base + i);
    return this;
  }
  /**
   * Append a raw mesh {pos, nrm, uv, idx, count, t} (core/geo.js). o: skin ({si,sw} | fn(p, t, i)), color (hex | rgb |
   * fn(t, p, n, uv, i)), emis (num | fn(t, p, uv)), gm, kind, part, dtl, uv (fn(uv, t, i) → [u, v]), shade (fn(p, n) → mul)
   */
  addRaw(m, o = {}) {
    const base = this.count;
    const colr = typeof o.color === 'function' ? null : col(o.color ?? 0xffffff);
    const d = o.dtl ?? [0, 0, 0.1, 0];
    const kind = o.kind ?? 0, part = o.part ?? 0;
    let skin = typeof o.skin === 'function' ? null : o.skin;
    const p = [0, 0, 0], n = [0, 0, 0], uv = [0, 0], c3 = [0, 0, 0];
    for (let i = 0; i < m.count; i++) {
      p[0] = m.pos[i * 3]; p[1] = m.pos[i * 3 + 1]; p[2] = m.pos[i * 3 + 2];
      n[0] = m.nrm[i * 3]; n[1] = m.nrm[i * 3 + 1]; n[2] = m.nrm[i * 3 + 2];
      uv[0] = m.uv[i * 2]; uv[1] = m.uv[i * 2 + 1];
      const t = m.t[i];
      const c = colr || col(o.color(t, p, n, uv, i));
      let f = 1; if (o.shade) f = o.shade(p, n, t);
      c3[0] = c[0] * f; c3[1] = c[1] * f; c3[2] = c[2] * f;
      if (typeof o.skin === 'function') skin = o.skin(p, t, i);
      const em = typeof o.emis === 'function' ? o.emis(t, p, uv) : (o.emis ?? 0);
      const gm = typeof o.gm === 'function' ? o.gm(t, p, uv) : (o.gm ?? 1);
      const uu = o.uv ? o.uv(uv, t, i) : uv;
      this.v(p[0], p[1], p[2], n[0], n[1], n[2], c3, skin.si, skin.sw, d, em, gm, kind, part, uu[0], uu[1]);
    }
    const I = m.idx;
    if (o.flip) for (let i = 0; i < I.length; i += 3) this.I.push(base + I[i], base + I[i + 2], base + I[i + 1]);
    else for (let i = 0; i < I.length; i++) this.I.push(base + I[i]);
    return base;
  }
  build() {
    // sanitise: degenerate / zero normals (SDF saddle points, collapsed tips) would turn into NaN in the shader
    const N = this.N;
    for (let i = 0; i < N.length; i += 3) {
      const l = Math.hypot(N[i], N[i + 1], N[i + 2]);
      if (!(l > 0.2)) { N[i] = 0; N[i + 1] = 1; N[i + 2] = 0; } else if (Math.abs(l - 1) > 1e-3) { N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
    }
    for (let i = 0; i < this.P.length; i++) if (!isFinite(this.P[i])) this.P[i] = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.SI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.SW, 4));
    g.setAttribute('dtl', new THREE.Float32BufferAttribute(this.D, 4));
    g.setAttribute('aux', new THREE.Float32BufferAttribute(this.A, 4));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.I, 1) : new THREE.Uint16BufferAttribute(this.I, 1));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}

export const rigid = (bone) => ({ si: [bone, 0, 0, 0], sw: [1, 0, 0, 0] });
export const blend2 = (b0, b1, t) => ({ si: [b0, b1, 0, 0], sw: [1 - t, t, 0, 0] });
/** skin from a {bone: weight} map → top-4 normalised */
export function skinMap(m) {
  const e = Object.entries(m).map(([k, v]) => [+k, v]).filter(x => x[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const t = e.reduce((a, b) => a + b[1], 0) || 1;
  const si = [0, 0, 0, 0], sw = [0, 0, 0, 0];
  e.forEach((x, i) => { si[i] = x[0]; sw[i] = x[1] / t; });
  if (!e.length) sw[0] = 1;
  return { si, sw };
}
