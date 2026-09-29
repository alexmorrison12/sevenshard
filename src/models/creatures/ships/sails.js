// Sail geometry (one merged mesh per ship, animated in the vertex shader — see mats.js for the attribute layout).
//   squareSail(sb, …)   hangs from a braced yard, bellies toward the bow (−Z), reefs up to the yard
//   foreAft(sb, …)      jib / lateen / gaff / spanker from 3–4 corners, bellies to leeward, furls to its luff/yard
//   flag(sb, …)         rectangular flag / tapering pennant / swallowtail (cut in the texture), streams aft
//   sheet(sb, corner, to)  rope from a sail corner to the rail that follows the corner as the sail billows / reefs
import * as THREE from 'three';
import { V3, lerp, clamp01 } from './build.js';

const UP = new THREE.Vector3(0, 1, 0);

export class SailBuilder {
  constructor() { this.P = []; this.N = []; this.UV = []; this.C = []; this.BO = []; this.BN = []; this.AN = []; this.SA = []; this.I = []; }
  get count() { return this.P.length / 3; }
  v(p, n, uv, c, bo, bn, an, sa) {
    this.P.push(p.x, p.y, p.z); this.N.push(n.x, n.y, n.z); this.UV.push(uv[0], uv[1]); this.C.push(c[0], c[1], c[2]);
    this.BO.push(bo.x, bo.y, bo.z); this.BN.push(bn.x, bn.y, bn.z); this.AN.push(an.x, an.y, an.z); this.SA.push(sa[0], sa[1], sa[2], sa[3]);
  }
  /**
   * Generic cloth grid. o: { na, nb, pos(a,b) → V3 (a across 0..1, b down 0..1), n0 (V3 rest normal = belly side),
   *   bdir (V3), depth, belly(a,b), lift, pinch, across (V3 for the leech pinch), anchor(a,b) → V3, free(a,b), uv(a,b) → [u,v], color }
   * Returns corner info { a, b, pos, off, anc } for sheets via o.corners [[a, b], …].
   */
  cloth(o) {
    const na = o.na, nb = o.nb, base = this.count, W = na + 1;
    const R = [], S = [], OFF = [];
    for (let j = 0; j <= nb; j++) for (let i = 0; i <= na; i++) {
      const a = i / na, b = j / nb, p = o.pos(a, b), bl = o.belly(a, b);
      const off = o.bdir.clone().multiplyScalar(bl * o.depth);
      if (o.lift) off.y += o.lift * bl * o.depth * b;
      if (o.pinch && o.across) off.addScaledVector(o.across, -(a - 0.5) * 2 * bl * o.depth * o.pinch);
      R.push(p); OFF.push(off); S.push(p.clone().add(off));
    }
    const dA = V3(), dB = V3(), nB = V3();
    const col = o.color || [1, 1, 1];
    for (let j = 0; j <= nb; j++) for (let i = 0; i <= na; i++) {
      const k = j * W + i;
      dA.subVectors(S[j * W + Math.min(na, i + 1)], S[j * W + Math.max(0, i - 1)]);
      dB.subVectors(S[Math.min(nb, j + 1) * W + i], S[Math.max(0, j - 1) * W + i]);
      nB.crossVectors(dA, dB);
      if (nB.lengthSq() < 1e-10) nB.copy(o.n0); else { nB.normalize(); if (nB.dot(o.n0) < 0) nB.negate(); }
      const a = i / na, b = j / nb;
      this.v(R[k], o.n0, o.uv(a, b), typeof col === 'function' ? col(a, b) : col, OFF[k], nB, o.anchor(a, b), [o.free(a, b), a, 0, b]);
    }
    // winding so the front face's geometric normal matches n0 (DoubleSide flips lighting on back faces)
    let flip = false;
    {
      const p0 = R[0], p1 = R[1], p2 = R[W];
      const g = V3().subVectors(p1, p0).cross(V3().subVectors(p2, p0));
      if (g.lengthSq() < 1e-12) { const q0 = R[W], q1 = R[W + 1], q2 = R[2 * W]; g.subVectors(q1, q0).cross(V3().subVectors(q2, q0)); }
      flip = g.dot(o.n0) < 0;
    }
    for (let j = 0; j < nb; j++) for (let i = 0; i < na; i++) {
      const a = base + j * W + i, b = a + 1, c = a + W, d = c + 1;
      if (!flip) this.I.push(a, b, c, b, d, c); else this.I.push(a, c, b, b, c, d);
    }
    const corners = {};
    for (const [name, a, b] of o.corners || []) {
      const i = Math.round(a * na), j = Math.round(b * nb), k = j * W + i;
      corners[name] = { pos: R[k].clone(), off: OFF[k].clone(), anc: o.anchor(i / na, j / nb) };
    }
    return corners;
  }
  /** Rope tube from a sail corner to a fixed point; vertices blend from following the corner to fixed. */
  sheet(corner, to, r, uv, color = [1, 1, 1], radial = 4, segs = 5) {
    const a = corner.pos, pts = [];
    for (let i = 0; i <= segs; i++) pts.push(V3().lerpVectors(a, to, i / segs));
    const T = V3().subVectors(to, a).normalize(), N = V3(0, 1, 0);
    if (Math.abs(T.y) > 0.9) N.set(1, 0, 0);
    N.addScaledVector(T, -T.dot(N)).normalize();
    const Bn = V3().crossVectors(T, N), base = this.count;
    for (let i = 0; i <= segs; i++) {
      const w = 1 - i / segs, p = pts[i];
      for (let k = 0; k <= radial; k++) {
        const ang = k / radial * Math.PI * 2, n = V3().addScaledVector(N, Math.cos(ang)).addScaledVector(Bn, Math.sin(ang));
        this.v(p.clone().addScaledVector(n, r), n, uv, color, corner.off, corner.pos, corner.anc, [w, 0, 2, 0]);
      }
    }
    for (let i = 0; i < segs; i++) for (let k = 0; k < radial; k++) {
      const a = base + i * (radial + 1) + k, b = a + radial + 1;
      this.I.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.UV, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('bOff', new THREE.Float32BufferAttribute(this.BO, 3));
    g.setAttribute('bNrm', new THREE.Float32BufferAttribute(this.BN, 3));
    g.setAttribute('anc', new THREE.Float32BufferAttribute(this.AN, 3));
    g.setAttribute('sa', new THREE.Float32BufferAttribute(this.SA, 4));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.I, 1) : new THREE.Uint16BufferAttribute(this.I, 1));
    g.computeBoundingSphere(); g.boundingSphere.radius += 2.5; g.computeBoundingBox();
    return g;
  }
}

// ------------------------------------------------------------------------------------------------ square sail
/**
 * o: { x=0, z (mast), y (yard height), Wt, Wb, H, brace (rad, + swings the starboard yardarm forward), fwd (offset of the
 *      sail plane ahead of the mast), depth (belly at full), roach (foot curve), region (atlas), na, nb, color }
 * Returns { corners: { clewL, clewR }, yardDir, top } for rigging.
 */
export function squareSail(sb, o) {
  const cr = Math.cos(o.roll || 0);
  const yd = V3(Math.cos(o.brace || 0) * cr, Math.sin(o.roll || 0), -Math.sin(o.brace || 0) * cr);
  const fwd = V3().crossVectors(UP, yd).normalize();        // −Z when unbraced
  const top = V3(o.x || 0, o.y, o.z).addScaledVector(fwd, o.fwd ?? 0.32);
  const Wt = o.Wt, Wb = o.Wb ?? o.Wt, Hh = o.H, roach = o.roach ?? 0.25;
  const pos = (a, b) => {
    const w = lerp(Wt, Wb, b);
    return top.clone().addScaledVector(yd, (a - 0.5) * w).addScaledVector(UP, -b * Hh + roach * Math.sin(Math.PI * a) * Math.pow(b, 6)).addScaledVector(fwd, (o.tilt || 0) * b);
  };
  const corners = sb.cloth({
    na: o.na ?? 12, nb: o.nb ?? 10, pos, n0: fwd, bdir: fwd, depth: o.depth ?? Wt * 0.15, lift: 0.35, pinch: 0.12, across: yd,
    belly: (a, b) => Math.pow(Math.sin(Math.PI * a), 0.8) * Math.sin(Math.PI * 0.62 * b),
    anchor: (a) => top.clone().addScaledVector(yd, (a - 0.5) * Wt).addScaledVector(UP, -0.2).addScaledVector(fwd, 0.1),
    free: (a, b) => Math.pow(clamp01(b * 1.15), 1.2) * (0.35 + 0.65 * Math.max(Math.pow(Math.abs(2 * a - 1), 2), b * b * b)),
    uv: (a, b) => o.region.uv(a, b), color: o.color,
    corners: [['clewL', 0, 1], ['clewR', 1, 1]],
  });
  return { corners, yd, fwd, top };
}

// ------------------------------------------------------------------------------------------------ fore-and-aft sails
/**
 * Triangle: { head, tack, clew } — luff = head→tack (a = 0), leech = head→clew (a = 1), foot at b = 1. Furls onto the luff.
 * Lateen:   { tack, peak, clew, lateen: true } — top edge is the yard tack→peak (b = 0), hangs to the clew (b = 1). Furls to the yard.
 * Quad:     { throat, peak, tack, clew } — gaff on top (b = 0), boom/foot at b = 1, luff at a = 0. Furls to the gaff.
 * lee: ±1 side the belly goes to (x sign). Returns { corners: { clew } }.
 */
export function foreAft(sb, o) {
  let pos, anchor, belly;
  if (o.lateen) {
    pos = (a, b) => V3().lerpVectors(V3().lerpVectors(o.tack, o.peak, a), o.clew, b * 0.999);
    anchor = (a) => V3().lerpVectors(o.tack, o.peak, a).add(V3(0, -0.15, 0));
    belly = (a, b) => Math.pow(Math.sin(Math.PI * a), 0.8) * Math.pow(Math.sin(Math.PI * b), 0.8);
  } else if (o.throat) {
    pos = (a, b) => V3().lerpVectors(V3().lerpVectors(o.throat, o.peak, a), V3().lerpVectors(o.tack, o.clew, a), b);
    anchor = (a) => V3().lerpVectors(o.throat, o.peak, a).add(V3(0, -0.2, 0));
    belly = (a, b) => Math.pow(Math.sin(Math.PI * a), 0.8) * Math.sin(Math.PI * (0.1 + 0.8 * b));
  } else {
    pos = (a, b) => V3().lerpVectors(o.head, V3().lerpVectors(o.tack, o.clew, a), b);
    anchor = (a, b) => V3().lerpVectors(o.head, o.tack, b);
    belly = (a, b) => Math.pow(Math.sin(Math.PI * a), 0.8) * Math.sin(Math.PI * 0.6 * b);
  }
  const p00 = pos(0.02, 0.5), p10 = pos(0.98, 0.5), p01 = pos(0.5, 0.05), p11 = pos(0.5, 0.95);
  const n0 = V3().crossVectors(V3().subVectors(p10, p00), V3().subVectors(p11, p01)).normalize();
  if (Math.sign(n0.x || 1) !== Math.sign(o.lee ?? -1)) n0.negate();
  const corners = sb.cloth({
    na: o.na ?? 10, nb: o.nb ?? 10, pos, n0, bdir: n0, depth: o.depth ?? 0.8, belly, anchor,
    free: (a, b) => Math.pow(a, 1.3) * (0.4 + 0.6 * b),
    uv: (a, b) => o.region.uv(a, b), color: o.color,
    corners: [['clew', 1, 1]],
  });
  return { corners, n0 };
}

// ------------------------------------------------------------------------------------------------ flags
/**
 * o: { at (hoist top, V3), h (hoist height), len, dir (V3 streaming, default +Z), taper (0 rect … 1 point), region, n (segments) }
 * Flag lies in the plane of dir and up; b = 0 top edge. Flutter phase random per flag (o.phase).
 */
export function flag(sb, o) {
  const dir = (o.dir || V3(0, 0, 1)).clone().normalize();
  const n0 = V3().crossVectors(UP, dir).normalize();
  const nl = o.n ?? 14, nh = o.nh ?? 3, h = o.h, len = o.len, taper = o.taper ?? 0, base = sb.count;
  const mid = o.at.clone().addScaledVector(UP, -h / 2);
  const col = o.color || [1, 1, 1];
  for (let j = 0; j <= nh; j++) for (let i = 0; i <= nl; i++) {
    const a = i / nl, b = j / nh, hh = h * (1 - taper * a);
    const p = mid.clone().addScaledVector(dir, a * len).addScaledVector(UP, (0.5 - b) * hh);
    sb.v(p, n0, o.region.uv(a, b), col, dir, n0, p, [a, len, 1, o.phase ?? Math.random()]);
  }
  const W = nl + 1;
  // front face normal must match n0: quad (a,b,c) with a→b along dir, a→c downward → dir × (−UP) = −(dir × UP) = n0
  for (let j = 0; j < nh; j++) for (let i = 0; i < nl; i++) {
    const a = base + j * W + i, b = a + 1, c = a + W, d = c + 1;
    sb.I.push(a, b, c, b, d, c);
  }
}
