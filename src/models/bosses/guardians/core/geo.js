// Hard-surface generators for guardian parts (adapted from Everdawn's dragon parts): lofted horns / spikes / claws /
// teeth / tentacle tips, faceted crystals, eyeballs, fins, parametric grids (membranes, ribbons).
// All generators return raw meshes { pos, nrm, uv, idx, count, t } in model space (t = 0 base → 1 tip).

export const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const addS = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
export const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const mirror = (p) => [-p[0], p[1], p[2]];

export function rotate(v, axis, a) {
  const c = Math.cos(a), s = Math.sin(a), k = axis;
  const kv = cross(k, v), kd = dot(k, v);
  return [v[0] * c + kv[0] * s + k[0] * kd * (1 - c), v[1] * c + kv[1] * s + k[1] * kd * (1 - c), v[2] * c + kv[2] * s + k[2] * kd * (1 - c)];
}

/** Quadratic / cubic Bezier sampled into n+1 points. */
export function bezier(ctrl, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    let p;
    if (ctrl.length === 2) p = lerp3(ctrl[0], ctrl[1], t);
    else if (ctrl.length === 3) { const a = u * u, b = 2 * u * t, c = t * t; p = [0, 1, 2].map(k => a * ctrl[0][k] + b * ctrl[1][k] + c * ctrl[2][k]); }
    else { const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t; p = [0, 1, 2].map(k => a * ctrl[0][k] + b * ctrl[1][k] + c * ctrl[2][k] + d * ctrl[3][k]); }
    out.push(p);
  }
  return out;
}

/** Catmull-Rom through points → dense polyline (n samples per segment). */
export function spline(pts, n = 6) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < n; s++) {
      const t = s / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1, 2].map(k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

/** Curved path from base along dir, bending about bendAxis by `bend` radians over its length. */
export function hornPath(base, dir, length, bendAxis, bend, segs = 8, extra = null) {
  const pts = [];
  let d = norm(dir), p = base.slice();
  const ax = norm(bendAxis);
  const ds = length / segs;
  for (let i = 0; i <= segs; i++) {
    pts.push(extra ? addS(p, extra(i / segs), 1) : p.slice());
    p = addS(p, d, ds);
    d = rotate(d, ax, bend / segs);
  }
  return pts;
}

/** Tapered section: r0 at base → 0 at tip. flat scales the side radius. */
export function taper(r0, { pow = 0.85, flat = 1, bulge = 0, ridges = 0, ridgeAmp = 0.06, end = 0 } = {}) {
  return (t) => {
    let r = (r0 - end) * Math.pow(1 - t, pow) * (1 + bulge * Math.sin(t * Math.PI)) + end * (1 - t);
    if (ridges) r *= 1 + ridgeAmp * Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * ridges)), 4);
    return [r * flat, r];
  };
}

/** Build typed arrays + smooth normals (flat: unwelded, faceted). */
export function finish(pos, uv, idx, tt, flat = false) {
  if (flat) {
    const P = [], U = [], T = [], I = [];
    for (let i = 0; i < idx.length; i++) { const v = idx[i]; P.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); U.push(uv[v * 2], uv[v * 2 + 1]); T.push(tt[v]); I.push(i); }
    pos = P; uv = U; tt = T; idx = I;
  }
  const count = pos.length / 3;
  const nrm = new Float32Array(count * 3);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    nrm[a * 3] += nx; nrm[a * 3 + 1] += ny; nrm[a * 3 + 2] += nz;
    nrm[b * 3] += nx; nrm[b * 3 + 1] += ny; nrm[b * 3 + 2] += nz;
    nrm[c * 3] += nx; nrm[c * 3 + 1] += ny; nrm[c * 3 + 2] += nz;
  }
  for (let i = 0; i < count; i++) {
    const l = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1;
    nrm[i * 3] /= l; nrm[i * 3 + 1] /= l; nrm[i * 3 + 2] /= l;
  }
  return { pos: new Float32Array(pos), nrm, uv: new Float32Array(uv), idx: new Uint32Array(idx), count, t: new Float32Array(tt) };
}

/**
 * Loft a cross-section along a path with parallel-transport frames.
 * sec(t, i) → [rx, ry] half sizes (side, up); shape(a, t) → [cx, cy] unit profile (default circle); twist(t) → radians.
 */
export function loft(path, radial, sec, up0 = [0, 1, 0], shape = null, twist = null) {
  const n = path.length;
  const pos = [], uv = [], tt = [], idx = [];
  let up = null;
  const L = [0];
  for (let i = 1; i < n; i++) L.push(L[i - 1] + dist(path[i], path[i - 1]));
  const total = L[n - 1] || 1;
  const rings = [];
  for (let i = 0; i < n; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)];
    const T = norm(sub(b, a));
    if (!up) { up = norm(addS(up0, T, -dot(up0, T))); if (!isFinite(up[0]) || len(addS(up0, T, -dot(up0, T))) < 1e-6) up = norm(cross(T, [1, 0, 0])); }
    else up = norm(addS(up, T, -dot(up, T)));
    let side = cross(up, T), u2 = up;
    const t = L[i] / total;
    if (twist) { const ang = twist(t), c = Math.cos(ang), s = Math.sin(ang); const s2 = addS(mul(side, c), up, s); u2 = addS(mul(up, c), side, -s); side = s2; }
    const [rx, ry] = sec(t, i);
    const tip = i === n - 1 && rx < 1e-4 && ry < 1e-4;
    rings.push(pos.length / 3);
    if (tip) { pos.push(path[i][0], path[i][1], path[i][2]); uv.push(0.5, 1); tt.push(1); continue; }
    for (let r = 0; r <= radial; r++) {
      const ang = r / radial * Math.PI * 2;
      let cx = Math.cos(ang), cy = Math.sin(ang);
      if (shape) [cx, cy] = shape(ang, t);
      const p = path[i];
      pos.push(p[0] + side[0] * cx * rx + u2[0] * cy * ry, p[1] + side[1] * cx * rx + u2[1] * cy * ry, p[2] + side[2] * cx * rx + u2[2] * cy * ry);
      uv.push(r / radial, t); tt.push(t);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    const a0 = rings[i], b0 = rings[i + 1];
    const tipNext = (i + 1 === n - 1) && (pos.length / 3 - b0 === 1);
    for (let r = 0; r < radial; r++) {
      if (tipNext) { idx.push(a0 + r, a0 + r + 1, b0); continue; }
      idx.push(a0 + r, a0 + r + 1, b0 + r, a0 + r + 1, b0 + r + 1, b0 + r);
    }
  }
  const m = finish(pos, uv, idx, tt);
  // weld the seam normals
  for (const r0 of rings) {
    const a = r0, b = r0 + radial;
    if (b * 3 + 2 >= m.nrm.length) continue;
    for (let k = 0; k < 3; k++) { const v = (m.nrm[a * 3 + k] + m.nrm[b * 3 + k]) * 0.5; m.nrm[a * 3 + k] = v; m.nrm[b * 3 + k] = v; }
  }
  return m;
}

/** Faceted crystal: n-gon prism with pyramidal tip (flat shaded). */
export function crystal(base, dir, length, radius, sides = 6, rot = 0, tipFrac = 0.32) {
  const T = norm(dir);
  const U = norm(cross(T, Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const Sd = cross(T, U);
  const pos = [], uv = [], idx = [], tt = [];
  const ring = (h, r) => {
    const o = pos.length / 3;
    for (let i = 0; i < sides; i++) {
      const a = rot + i / sides * Math.PI * 2;
      const q = addS(addS(addS(base, T, h), U, Math.cos(a) * r), Sd, Math.sin(a) * r);
      pos.push(q[0], q[1], q[2]); uv.push(i / sides, h / length); tt.push(Math.max(0, h / length));
    }
    return o;
  };
  const r0 = ring(-radius * 0.4, radius * 0.85), r1 = ring(length * (1 - tipFrac), radius);
  const tip = pos.length / 3; const tp = addS(base, T, length); pos.push(tp[0], tp[1], tp[2]); uv.push(0.5, 1); tt.push(1);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    idx.push(r0 + i, r0 + j, r1 + i, r0 + j, r1 + j, r1 + i);
    idx.push(r1 + i, r1 + j, tip);
  }
  return finish(pos, uv, idx, tt, true);
}

/** UV sphere (eye) centred at c, "front" pole along look. uv = planar projection facing look, t = cos(angle from front). */
export function eyeball(c, r, look, up = [0, 1, 0], seg = 12, squash = 1) {
  const L = norm(look), R = norm(cross(up, L)), U = cross(L, R);
  const pos = [], uv = [], idx = [], tt = [];
  for (let i = 0; i <= seg; i++) {
    const th = i / seg * Math.PI;
    for (let j = 0; j <= seg; j++) {
      const ph = j / seg * Math.PI * 2;
      const lx = Math.sin(th) * Math.cos(ph), ly = Math.sin(th) * Math.sin(ph) * squash, lz = Math.cos(th);
      pos.push(c[0] + (R[0] * lx + U[0] * ly + L[0] * lz) * r, c[1] + (R[1] * lx + U[1] * ly + L[1] * lz) * r, c[2] + (R[2] * lx + U[2] * ly + L[2] * lz) * r);
      uv.push(lx * 0.5 + 0.5, ly / squash * 0.5 + 0.5); tt.push(lz);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + seg + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return finish(pos, uv, idx, tt);
}

/**
 * Parametric grid surface: posFn(u, v) → [x,y,z], nu × nv cells. uv = (u, v), t = v. Optional thickness (closed shell).
 * double: emit a second, reversed layer offset by `thick` along the normal (for solid fins).
 */
export function grid(nu, nv, posFn, o = {}) {
  const pos = [], uv = [], idx = [], tt = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv, p = posFn(u, v);
    pos.push(p[0], p[1], p[2]); uv.push(u, v); tt.push(v);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + nu + 1;
    if (o.flip) idx.push(a, a + 1, b, a + 1, b + 1, b); else idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return finish(pos, uv, idx, tt);
}

/** Thin solid fin between a base polyline and a tip polyline (two offset layers + rim). */
export function fin(basePts, tipPts, thick, normalHint, cols = 4) {
  const nI = basePts.length, pos = [], uv = [], idx = [], tt = [];
  const N = norm(normalHint);
  for (const sgn of [1, -1]) {
    const o = pos.length / 3;
    for (let i = 0; i < nI; i++) for (let j = 0; j <= cols; j++) {
      const t = j / cols;
      const p = lerp3(basePts[i], tipPts[i], t);
      const th = thick * (1 - t * 0.85) * sgn;
      pos.push(p[0] + N[0] * th, p[1] + N[1] * th, p[2] + N[2] * th); uv.push(i / (nI - 1), t); tt.push(t);
    }
    for (let i = 0; i < nI - 1; i++) for (let j = 0; j < cols; j++) {
      const a = o + i * (cols + 1) + j, b = a + cols + 1;
      if (sgn > 0) idx.push(a, b, a + 1, a + 1, b, b + 1); else idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  return finish(pos, uv, idx, tt);
}

/** Merge raw meshes. */
export function merge(list) {
  const pos = [], uv = [], idx = [], tt = [], nrm = [];
  let base = 0;
  for (const m of list) {
    for (let i = 0; i < m.count * 3; i++) { pos.push(m.pos[i]); nrm.push(m.nrm[i]); }
    for (let i = 0; i < m.count * 2; i++) uv.push(m.uv[i]);
    for (let i = 0; i < m.count; i++) tt.push(m.t[i]);
    for (let i = 0; i < m.idx.length; i++) idx.push(m.idx[i] + base);
    base += m.count;
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(uv), idx: new Uint32Array(idx), count: base, t: new Float32Array(tt) };
}
