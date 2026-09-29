// Move library core: keyed curves, weapon / fist / gun placement in the pose frame, footwork helpers and the move registry.
// Move files (moves_*.js) import from here and register with def() / v(); moves.js resolves them per weapon family.
import { B } from './rig.js';
import { setArm, setFingers, setClav, stance } from './pose.js';

export const sin = Math.sin, cos = Math.cos, PI = Math.PI, DEG = PI / 180;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** smoothstep keyed curve (zero velocity at every key): K(u, u0, v0, u1, v1, ...) */
export function K(u, ...kv) {
  if (u <= kv[0]) return kv[1];
  for (let i = 2; i < kv.length; i += 2) {
    if (u <= kv[i]) { const t = (u - kv[i - 2]) / (kv[i] - kv[i - 2] || 1); const s = t * t * (3 - 2 * t); return kv[i - 1] + (kv[i + 1] - kv[i - 1]) * s; }
  }
  return kv[kv.length - 1];
}
/** flowing keyed curve (Catmull-Rom tangents through inner keys, eased ends): KC(u, u0, v0, u1, v1, ...) */
export function KC(u, ...k) {
  const n = k.length >> 1;
  if (u <= k[0]) return k[1];
  if (u >= k[(n - 1) * 2]) return k[(n - 1) * 2 + 1];
  let i = 0; while (i < n - 2 && u > k[(i + 1) * 2]) i++;
  const t0 = k[i * 2], t1 = k[i * 2 + 2], v0 = k[i * 2 + 1], v1 = k[i * 2 + 3];
  const h = t1 - t0 || 1, s = (u - t0) / h;
  const m0 = i > 0 ? (v1 - k[i * 2 - 1]) / (t1 - k[i * 2 - 2]) * h : 0;
  const m1 = i < n - 2 ? (k[i * 2 + 5] - v0) / (k[i * 2 + 4] - t0) * h : 0;
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * v1 + (s3 - s2) * m1;
}
/** multi-channel track: keys = [[t, c0, c1, ...], ...]; a key with .e = true has zero velocity (hold / apex) */
const _tr = new Float32Array(16);
export function track(u, keys, out = _tr) {
  const n = keys.length, nc = keys[0].length - 1;
  if (u <= keys[0][0]) { for (let c = 0; c < nc; c++) out[c] = keys[0][c + 1]; return out; }
  if (u >= keys[n - 1][0]) { for (let c = 0; c < nc; c++) out[c] = keys[n - 1][c + 1]; return out; }
  let i = 0; while (i < n - 2 && u > keys[i + 1][0]) i++;
  const A = keys[i], Bk = keys[i + 1], h = Bk[0] - A[0] || 1, s = (u - A[0]) / h;
  const s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  const P0 = i > 0 ? keys[i - 1] : null, P3 = i < n - 2 ? keys[i + 2] : null;
  for (let c = 1; c <= nc; c++) {
    const m0 = P0 && !A.e ? (Bk[c] - P0[c]) / (Bk[0] - P0[0]) * h : 0;
    const m1 = P3 && !Bk.e ? (P3[c] - A[c]) / (P3[0] - A[0]) * h : 0;
    out[c - 1] = h00 * A[c] + h10 * m0 + h01 * Bk[c] + h11 * m1;
  }
  return out;
}
export const E = (k) => { k.e = true; return k; }; // mark a key as an apex/hold

// ---- weapon placement ---------------------------------------------------------------------------
// Weapon local frame: grip at origin, blade along +Y, cutting edge along +X, flat faces ±Z.
export function quatFromBasis(W, X, Y, Z) { // columns X Y Z → quaternion into W[4..7]
  const m00 = X[0], m10 = X[1], m20 = X[2], m01 = Y[0], m11 = Y[1], m21 = Y[2], m02 = Z[0], m12 = Z[1], m22 = Z[2];
  const tr = m00 + m11 + m22; let x, y, z, w;
  if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); w = 0.25 / s; x = (m21 - m12) * s; y = (m02 - m20) * s; z = (m10 - m01) * s; }
  else if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s; }
  else if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s; }
  else { const s = 2 * Math.sqrt(1 + m22 - m00 - m11); w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s; }
  W[4] = x; W[5] = y; W[6] = z; W[7] = w;
}
const _D = [0, 0, 0], _X = [0, 0, 0], _Z = [0, 0, 0];
export const dirOf = (out, yaw, pitch) => { out[0] = sin(yaw) * cos(pitch); out[1] = sin(pitch); out[2] = -cos(yaw) * cos(pitch); return out; };
/**
 * Polar weapon placement (degrees): grip at pivot + r·dir(yaw, pitch); blade along dir(yaw+bdy, pitch+bdp);
 * edge = horizontal tangent toward decreasing yaw (a right→left sweep leads with it), rolled by `roll`.
 * yaw 0 = forward (−Z), +90 = right (+X); pitch + = up. pivot = [x, y, z] in the pose frame.
 */
export function wield(W, w, pivot, yaw, pitch, r, roll = 0, bdy = 0, bdp = 0) {
  const ya = yaw * DEG, pa = pitch * DEG, by = (yaw + bdy) * DEG, bp = (pitch + bdp) * DEG;
  dirOf(_D, ya, pa);
  W[0] = w; W[1] = pivot[0] + _D[0] * r; W[2] = pivot[1] + _D[1] * r; W[3] = pivot[2] + _D[2] * r;
  dirOf(_D, by, bp);
  let tx = -cos(by), tz = -sin(by), ty = 0;
  const d = tx * _D[0] + ty * _D[1] + tz * _D[2];
  tx -= _D[0] * d; ty -= _D[1] * d; tz -= _D[2] * d;
  let l = Math.hypot(tx, ty, tz); if (l < 1e-5) { tx = -1; ty = 0; tz = 0; l = 1; }
  tx /= l; ty /= l; tz /= l;
  const ro = roll * DEG, cr = cos(ro), sr = sin(ro);
  const cx = _D[1] * tz - _D[2] * ty, cy = _D[2] * tx - _D[0] * tz, cz = _D[0] * ty - _D[1] * tx; // D × T
  _X[0] = tx * cr + cx * sr; _X[1] = ty * cr + cy * sr; _X[2] = tz * cr + cz * sr;
  _Z[0] = _X[1] * _D[2] - _X[2] * _D[1]; _Z[1] = _X[2] * _D[0] - _X[0] * _D[2]; _Z[2] = _X[0] * _D[1] - _X[1] * _D[0];
  quatFromBasis(W, _X, _D, _Z);
  return W;
}
/** place a weapon from a track sample [yaw, pitch, r, dy, roll, bdy, bdp] relative to the rig pivot (+hip offset) */
export function wieldT(p, side, w, tr, rig, px = 0, pz = 0) {
  const piv = [px + p.hip[0], rig.chestY + 0.14 + tr[3] + p.hip[1], pz + p.hip[2]];
  wield(side === 'R' ? p.wR : p.wL, w, piv, tr[0], tr[1], tr[2], tr[4] ?? 0, tr[5] ?? 0, tr[6] ?? 0);
}

// ---- footwork helpers ------------------------------------------------------------------------------
/** foot `side` (0 L, 1 R) steps by (dx, dz) during [t0, t1], stays until t2, returns by t3 */
export function step(p, side, u, dx, dz, t0, t1, t2 = 2, t3 = 2, lift = 0.07) {
  const k = K(u, t0, 0, t1, 1, t2, 1, t3, 0);
  const o = side * 5;
  p.feet[o] += dx * k; p.feet[o + 2] += dz * k;
  const inStep = u > t0 && u < t1 ? sin((u - t0) / (t1 - t0) * PI) : u > t2 && u < t3 ? sin((u - t2) / (t3 - t2) * PI) : 0;
  p.feet[o + 1] += lift * inStep;
  p.feet[o + 3] += 0.35 * inStep;
}
export function crouch(p, amt, rig) { p.hip[1] -= amt * rig.legLen / 0.87; }
/** twist the torso (yaw) distributed over hips / spine / chest, with a matching counter on the head */
export function twist(p, a, hipsShare = 0.3) {
  p.add(B.hips, 0, a * hipsShare, 0); p.add(B.spine, 0, a * (1 - hipsShare) * 0.45, 0); p.add(B.chest, 0, a * (1 - hipsShare) * 0.55, 0);
  p.add(B.head, 0, -a * 0.35, 0);
}
export function bend(p, a) { p.add(B.spine, a * 0.45, 0, 0); p.add(B.chest, a * 0.4, 0, 0); p.add(B.head, -a * 0.3, 0, 0); }
/** wide fighting base: feet apart, left forward */
export function base(p, ctx, wid = 0.1, fwd = 0.16, back = 0.14, yawOut = 0.35) { stance(p, ctx, wid, fwd, -back, yawOut); }
export function fist(p, s, c = 1.35) { setFingers(p, s, c, c, c * 0.8); }


/** fist / hand placement: pos (pose frame), fwd = forearm → knuckles direction, thumb = thumb direction */
const _A = [0, 0, 0], _Bv = [0, 0, 0], _C = [0, 0, 0];
export function fistAt(W, w, pos, fwd, thumb) {
  let l = Math.hypot(fwd[0], fwd[1], fwd[2]) || 1;
  _A[0] = fwd[0] / l; _A[1] = fwd[1] / l; _A[2] = fwd[2] / l;
  const d = thumb[0] * _A[0] + thumb[1] * _A[1] + thumb[2] * _A[2];
  _Bv[0] = thumb[0] - _A[0] * d; _Bv[1] = thumb[1] - _A[1] * d; _Bv[2] = thumb[2] - _A[2] * d;
  l = Math.hypot(_Bv[0], _Bv[1], _Bv[2]) || 1; _Bv[0] /= l; _Bv[1] /= l; _Bv[2] /= l;
  _C[0] = _A[1] * _Bv[2] - _A[2] * _Bv[1]; _C[1] = _A[2] * _Bv[0] - _A[0] * _Bv[2]; _C[2] = _A[0] * _Bv[1] - _A[1] * _Bv[0];
  W[0] = w; W[1] = pos[0]; W[2] = pos[1]; W[3] = pos[2];
  quatFromBasis(W, _A, _Bv, _C);
  return W;
}
/** gun placement: grip at pos, barrel (weapon +X) along aim, weapon +Y toward up */
export function aimGun(W, w, pos, aim, up = [0, 1, 0]) { return fistAt(W, w, pos, aim, up); }
/** direction from yaw / pitch in degrees (0 = forward −Z, +yaw = right) */
export function dirDeg(yaw, pitch) { const y = yaw * DEG, p = pitch * DEG; return [Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)]; }
/** a point in the pose frame relative to the rig: side (+ right), up (from the chest joint), fwd (+ forward), plus hip offset */
export function at(p, rig, side, up, fwd) { return [side + p.hip[0], rig.chestY + up + p.hip[1], -fwd + p.hip[2]]; }

// ================================================================================================
// Registry
export const M = {};
/** def(name, d): base move (variants registered earlier with v() are kept) */
export function def(name, d) { const old = M[name]; M[name] = { ...d, v: { ...(old?.v || {}), ...(d.v || {}) } }; return M[name]; }
/** v(name, family, d): weapon-family variant, merged over the base move */
export function v(name, fam, d) { const e = (M[name] ||= { v: {} }); (e.v ||= {})[fam] = d; }
/** alias: register the same variant for several families */
export function vs(name, fams, d) { for (const f of fams) v(name, f, d); }
export function resolveMove(name, kind) {
  const d = M[name];
  if (!d || (!d.fn && !(d.v && (d.v[kind] || d.v._armed)))) return null;
  const vv = d.v && (d.v[kind] || (kind !== 'none' ? d.v._armed : null));
  const r = vv ? { ...d, ...vv, name } : { ...d, name };
  return r.fn ? r : null;
}
export const MOVE_NAMES = () => Object.keys(M).filter(n => M[n].fn || M[n].v);
