// Geometry accumulator for boss meshes: the kit's GeoAcc layout (position, normal, linear colour, skin, detail
// weights, aux = [emissive, unused]) plus one extra vec4 attribute `ext` read by the boss material:
//   ext.x  specular strength (0 skin … 1 polished metal)
//   ext.y  breakable part id (0 = none; the material collapses hidden parts, see Boss.breakPart)
//   ext.z  molten-crack mask (0..1): shader-side Voronoi fissures that glow in the boss glow colour
//   ext.w  glow class: 0 none · 1 eyes/core · 2 weapon edge · 3 flame (vertex flicker) · 4 rune (pulses)
// Sculpt.mesh() calls vert() right after the paint callback of the same vertex, so paint code writes the extra
// channel into `acc.X` (shared array) and vert() copies it. Rigid parts pass `ext` (array or fn(p, uv) → array).
import * as THREE from 'three';
import { col } from '../../kit/sdf.js';

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3();
const Z4 = [0, 0, 0, 0];

export class BossAcc {
  constructor() { this.P = []; this.N = []; this.C = []; this.SI = []; this.SW = []; this.D = []; this.A = []; this.E = []; this.I = []; this.X = [0, 0, 0, 0]; }
  get count() { return this.P.length / 3; }
  vert(x, y, z, nx, ny, nz, r, g, b, si, sw, d0, d1, d2, d3, emis, fx) {
    this.P.push(x, y, z); this.N.push(nx, ny, nz); this.C.push(r, g, b);
    this.SI.push(si[0], si[1], si[2], si[3]); this.SW.push(sw[0], sw[1], sw[2], sw[3]);
    this.D.push(d0, d1, d2, d3); this.A.push(emis, fx || 0);
    const X = this.X; this.E.push(X[0], X[1], X[2], X[3]);
  }
  tri(a, b, c) { this.I.push(a, b, c); }
  /**
   * Append a geometry. o: matrix, color (hex | [r,g,b] | fn(p,n,uv,i)), skin ({si,sw} | fn(p) → {si,sw}),
   * dtl [4], emis (num | fn(p,uv)), fx (num | fn(p,uv): flame flicker amplitude, glow class 3), ext ([4] | fn(p,uv) → [4]), normalFn(p, n, uv)
   */
  add(geo, o = {}) {
    const p = geo.attributes.position, na = geo.attributes.normal, uva = geo.attributes.uv;
    const m = o.matrix || null;
    if (m) _m3.getNormalMatrix(m);
    const base = this.count;
    const colr = typeof o.color === 'function' ? null : col(o.color ?? 0xffffff);
    const d = o.dtl ?? [0, 0, 0.2, 0];
    const uv = [0, 0];
    let skin = typeof o.skin === 'function' ? null : o.skin;
    const extFn = typeof o.ext === 'function' ? o.ext : null;
    const ext0 = extFn ? null : (o.ext ?? Z4);
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i); if (m) _v.applyMatrix4(m);
      if (na) { _n.fromBufferAttribute(na, i); if (m) _n.applyMatrix3(_m3).normalize(); } else _n.set(0, 1, 0);
      if (uva) { uv[0] = uva.getX(i); uv[1] = uva.getY(i); }
      if (o.normalFn) o.normalFn(_v, _n, uv);
      const c = colr || col(o.color(_v, _n, uv, i));
      if (typeof o.skin === 'function') skin = o.skin(_v);
      const em = typeof o.emis === 'function' ? o.emis(_v, uv) : (o.emis ?? 0);
      const e = extFn ? extFn(_v, uv) : ext0;
      const fx = typeof o.fx === 'function' ? o.fx(_v, uv) : (o.fx ?? 0);
      this.X[0] = e[0]; this.X[1] = e[1]; this.X[2] = e[2]; this.X[3] = e[3];
      this.vert(_v.x, _v.y, _v.z, _n.x, _n.y, _n.z, c[0], c[1], c[2], skin.si, skin.sw, d[0], d[1], d[2], d[3], em, fx);
    }
    this.X[0] = this.X[1] = this.X[2] = this.X[3] = 0;
    if (geo.index) { const ix = geo.index.array; for (let i = 0; i < ix.length; i++) this.I.push(base + ix[i]); }
    else for (let i = 0; i < p.count; i++) this.I.push(base + i);
    return this;
  }
  build(scale = 1) {
    const g = new THREE.BufferGeometry();
    const P = scale === 1 ? this.P : this.P.map(v => v * scale);
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.SI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.SW, 4));
    g.setAttribute('dtl', new THREE.Float32BufferAttribute(this.D, 4));
    g.setAttribute('aux', new THREE.Float32BufferAttribute(this.A, 2));
    g.setAttribute('ext', new THREE.Float32BufferAttribute(this.E, 4));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.I, 1) : new THREE.Uint16BufferAttribute(this.I, 1));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}
