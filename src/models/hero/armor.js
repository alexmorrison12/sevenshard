// Sculpted armour shells: the body surface offset outward, clipped to a region, with raised bevelled trim along every
// edge (the shell thickens near the clip boundary) and sculpted features (pectoral plates, sternum ridge, lame grooves,
// muscle-cuirass relief, rivets). Meshed with surface nets, decimated, skinned to the body, coloured per zone.
// Also: layered tassets and hard-surface greaves / vambraces built from the same machinery.
import * as THREE from 'three';
import { surfaceNets, refineVerts, sdfAO, smin, smax } from './sdf.js';
import { simplify } from './simplify.js';
import { makePiece, weightsAt } from './body.js';
import { PB, cached, tubeGeo, topLit } from './pieces.js';
import { B } from './rig.js';
import { SLOT } from './palette.js';
import { clamp, lerp, smoothstep, Simplex } from '../../core/noise.js';

const NZ = new Simplex(313);
const ell = (x, y, z, c, r) => { // approximate ellipsoid distance
  const px = (x - c[0]) / r[0], py = (y - c[1]) / r[1], pz = (z - c[2]) / r[2];
  const k0 = Math.hypot(px, py, pz), k1 = Math.hypot(px / r[0], py / r[1], pz / r[2]);
  return k1 < 1e-9 ? -Math.min(...r) : k0 * (k0 - 1) / k1;
};
const seg = (x, y, z, a, b, r) => { // capsule distance
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const t = clamp(((x - a[0]) * bx + (y - a[1]) * by + (z - a[2]) * bz) / (bx * bx + by * by + bz * bz), 0, 1);
  return Math.hypot(x - a[0] - bx * t, y - a[1] - by * t, z - a[2] - bz * t) - r;
};

/**
 * Generic shell. o: { sdf (body region SDF with eval), clip(x,y,z) → signed (<0 inside), t (thickness), rimW, rimH,
 *   bevel, features: [{ fn(x,y,z)→d, op: 'add'|'sub', k, slot }], bbox: [min, max], cell, target, slotFn, mulFn }
 */
export function shellMesh(base, o) { return shell(base, o); }
function shell(base, o) {
  const f = o.sdf;
  const T = o.t ?? 0.018, RW = o.rimW ?? 0.022, RH = o.rimH ?? 0.007, BV = o.bevel ?? 0.006;
  const feats = o.features || [];
  const TIN = o.tin ?? 0.003;
  const field = (x, y, z) => {
    const db = f.eval(x, y, z);
    const c = o.clip(x, y, z);
    const rim = smoothstep(-RW, -RW * 0.25, c);
    const Tt = o.tFn ? o.tFn(x, y, z) : T;
    let d = smax(db - (Tt + RH * rim), TIN - db, 0.002);   // hollow: between just-outside-the-skin and the outer offset
    d = smax(d, c, BV);
    for (const ft of feats) {
      const v = ft.fn(x, y, z, db);
      d = ft.op === 'sub' ? smax(d, -v, ft.k ?? 0.004) : smin(d, v, ft.k ?? 0.008);
    }
    return d;
  };
  const near = (cx, cy, cz, R) => field;
  let m = surfaceNets(field, o.bbox[0], o.bbox[1], o.cell ?? 0.0075, { refine: -1 });
  if (!m.pos.length) return null;
  if (m.pos.length / 3 > o.target) m = simplify(m.pos, m.nrm, m.idx, o.target);
  refineVerts(field, m.pos, m.nrm, o.cell ?? 0.0075, 1);
  // cull the hidden inner surface (keep it near the edges where the thickness shows)
  {
    const nv = m.pos.length / 3, inner = new Uint8Array(nv);
    for (let v = 0; v < nv; v++) { const x = m.pos[v * 3], y = m.pos[v * 3 + 1], z = m.pos[v * 3 + 2]; inner[v] = f.eval(x, y, z) < TIN + 0.005 && o.clip(x, y, z) < -0.022 ? 1 : 0; }
    const keep = [];
    for (let t = 0; t < m.idx.length; t += 3) { const a = m.idx[t], b = m.idx[t + 1], c = m.idx[t + 2]; if (!(inner[a] && inner[b] && inner[c])) keep.push(a, b, c); }
    m.idx = new Uint32Array(keep);
  }
  const n = m.pos.length / 3;
  const pc = makePiece(n, m.idx.length);
  pc.pos.set(m.pos); pc.nrm.set(m.nrm); pc.idx.set(m.idx);
  if (o.rune) pc.rune = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    const x = m.pos[v * 3], y = m.pos[v * 3 + 1], z = m.pos[v * 3 + 2];
    const nx = m.nrm[v * 3], ny = m.nrm[v * 3 + 1], nz = m.nrm[v * 3 + 2];
    const wo = o.weights ? o.weights(x, y, z) : null;
    if (wo) { let sw = 0; for (const [, ww] of wo) sw += ww; for (let k = 0; k < 4; k++) { pc.bi[v * 4 + k] = k < wo.length ? wo[k][0] : 0; pc.bw[v * 4 + k] = k < wo.length ? wo[k][1] / sw : 0; } }
    else weightsAt(base.master, x, y, z, pc.bi, pc.bw, v * 4, 0.014);
    const c = o.clip(x, y, z);
    const onRim = c > -RW * 0.8;
    let slot = onRim ? (o.rimSlot ?? SLOT.TRIM) : (o.slot ?? SLOT.ARMOR1);
    let fz = 1;
    for (const ft of feats) {
      if (!ft.slot && !ft.mul) continue;
      const dv = ft.fn(x, y, z, f.eval(x, y, z));
      if (ft.op === 'sub' ? dv < 0.004 : dv < 0.003) { if (ft.slot != null) slot = ft.slot; if (ft.mul) fz *= ft.mul; if (ft.rune && pc.rune) pc.rune[v] = 1; }
    }
    if (o.slotFn) slot = o.slotFn(x, y, z, slot, onRim) ?? slot;
    const ao = sdfAO(field, x, y, z, nx, ny, nz, 0.012, 1);
    let sh = (0.55 + 0.45 * ao) * (0.84 + 0.22 * Math.max(0, ny)) * fz;
    if (onRim) sh *= 1.08;
    sh *= 1 + 0.05 * NZ.noise2(x * 13 + z * 7, y * 11);
    pc.mul[v * 3] = sh; pc.mul[v * 3 + 1] = sh; pc.mul[v * 3 + 2] = sh;
    pc.slot[v] = slot;
    if (o.rune && onRim && o.runeRim) pc.rune[v] = 1;
  }
  return pc;
}

// ---------------------------------------------------------------------------------------------------
/**
 * Cuirass (breast + back plate). sp: { style: 'plate'|'muscle'|'leather'|'corset', neck: 'round'|'v'|'high', low (waist
 *  offset), lames (count), ridge, rivets, runes, t }
 */
export function cuirassPiece(base, sp = {}) {
  return cached(`${base.key}|cuirass|${JSON.stringify(sp)}`, () => {
    const J = base.JJ.J, P = base.P, fem = P.sex === 'f';
    const tor = base.chainSDF.torso;
    const neckY = J.neck[1], chestY = J.chest[1], spineY = J.spine[1];
    const waist = J.hips[1] + (sp.low ?? (J.spine[1] - J.hips[1] - 0.035));
    const SL = base.JJ.A.L.S, SR = base.JJ.A.R.S;
    const armR = (sp.armhole ?? 0.105) * (fem ? 0.9 : 1);
    const vDepth = sp.neck === 'v' ? 0.12 : sp.neck === 'deepv' ? 0.2 : sp.neck === 'high' ? -0.03 : 0.035;
    const clip = (x, y, z) => {
      const front = z < 0 ? Math.max(0, 1 - Math.abs(x) / 0.12) : 0;
      const nl = neckY - 0.02 - vDepth * front * front - (z < 0 ? 0.012 : -0.01);
      const cTop = y - nl;
      const cBot = waist - y;
      const cL = armR - Math.hypot(x - SL[0], (y - SL[1]) * 1.1, z - SL[2]);
      const cR = armR - Math.hypot(x - SR[0], (y - SR[1]) * 1.1, z - SR[2]);
      return Math.max(cTop, cBot, cL, cR);
    };
    const feats = [];
    const T = sp.t ?? (sp.style === 'leather' || sp.style === 'corset' ? 0.012 : sp.style === 'gi' || sp.style === 'cloth' ? 0.012 : 0.02);
    if (sp.style === 'plate' || sp.style === 'muscle') {
      // pectoral plates (or a sculpted bust plate)
      const Rh = 0;
      for (const sg of [-1, 1]) {
        if (!fem) {
          const pc = [sg * P.pec[0] * 0.9, chestY + P.shY - 0.075, -P.ribs[2] * 0.6 - 0.01];
          feats.push({ fn: (x, y, z) => ell(x, y, z, pc, [P.pec[0] * 1.05, P.pec[1] * 1.05, P.pec[2] * 1.3]) - T * 0.9, op: 'add', k: 0.016 });
        } else {
          const bc = [sg * P.bust[0] * 0.95, chestY + P.shY - 0.1, -P.ribs[2] * 0.62 - 0.004];
          feats.push({ fn: (x, y, z) => ell(x, y, z, bc, [P.bust[0] * 1.12, P.bust[1] * 1.1, P.bust[2] * 1.15]) - T * 0.85, op: 'add', k: 0.02 });
        }
      }
      void Rh;
      // sternum ridge (raised keel) running down the breastplate
      if (sp.ridge !== false) {
        const a = [0, neckY - 0.05, -P.ribs[2] - 0.02], b = [0, spineY + 0.05, -P.belly[2] - 0.024];
        const rz = (y) => { const r = marchFront(tor, y); return r; };
        const a2 = [0, a[1], rz(a[1]) - T - 0.006], b2 = [0, b[1], rz(b[1]) - T - 0.004];
        feats.push({ fn: (x, y, z) => seg(x, y, z, a2, b2, 0.009), op: 'add', k: 0.01, slot: sp.ridgeSlot ?? SLOT.TRIM });
      }
      // abdominal lames: horizontal grooves cutting the outer skin of the shell (below the chest)
      const nl = sp.lames ?? 3;
      for (let i = 0; i < nl; i++) {
        const y = spineY + 0.07 - i * 0.045;
        feats.push({ fn: (x, yy, z, db) => Math.max(Math.abs(yy - y) - 0.0035, -(db - T + 0.006)), op: 'sub', k: 0.003, mul: 0.55 });
      }
      if (sp.style === 'muscle') { // abdominal relief (heroic muscle cuirass)
        for (const sg of [-1, 1]) for (let i = 0; i < 3; i++) {
          const c = [sg * 0.032, spineY + 0.075 - i * 0.05, -P.belly[2] - T - 0.004];
          feats.push({ fn: (x, y, z) => ell(x, y, z, c, [0.026, 0.02, 0.01]), op: 'add', k: 0.012 });
        }
      }
    } else if (sp.style === 'gi' || sp.style === 'cloth') {
      // soft cloth top: diagonal fold wrinkles; gi: crossed lapel band (left over right), open V for heroes
      for (let i = 0; i < 5; i++) {
        const y0 = spineY + 0.02 + i * 0.045, sgn = i % 2 ? 1 : -1;
        feats.push({ fn: (x, y, z, db) => Math.max(Math.abs((y - y0) - sgn * x * 0.35) - 0.003, -(db - T + 0.003), -z - 0.02 + Math.abs(x) * 0.2), op: 'sub', k: 0.004, mul: 0.8 });
      }
      if (sp.style === 'gi') {
        const yV = chestY - 0.03;
        const lap = (x, y) => y > yV ? Math.abs(Math.abs(x) - (y - yV) * 0.55) : Math.abs(x - (yV - y) * 0.75) + (x < -0.03 ? 1 : 0);
        feats.push({ fn: (x, y, z, db) => Math.max(lap(x, y) - 0.014, -(db - T - 0.0045), z > 0 ? 1 : -1), op: 'add', k: 0.003, slot: SLOT.CLOTH2 });
      }
    } else if (sp.style === 'leather' || sp.style === 'corset') {
      // stitched leather: vertical seams + laced front (corset) or crossing straps
      for (const sg of [-1, 1]) {
        const x0 = sg * 0.075;
        feats.push({ fn: (x, y, z, db) => Math.max(Math.abs(x - x0) - 0.003, -(db - T + 0.004), z > 0 ? 1 : -1), op: 'sub', k: 0.002, mul: 0.6 });
      }
      if (sp.style === 'corset') for (let i = 0; i < 6; i++) {
        const y = waist + 0.03 + i * 0.035;
        const rz = marchFront(tor, y);
        feats.push({ fn: (x, yy, z) => seg(x, yy, z, [-0.018, y, rz - T - 0.004], [0.018, y + 0.012, rz - T - 0.004], 0.003), op: 'add', k: 0.002, slot: SLOT.LEATHER });
      }
    }
    // rivets along the upper chest edge
    if (sp.rivets) for (let i = -3; i <= 3; i++) {
      const x = i * 0.045, y = neckY - 0.07 - Math.abs(i) * 0.012;
      const rz = marchFront(tor, y);
      feats.push({ fn: (xx, yy, z) => Math.hypot(xx - x, yy - y, z - (rz - T - 0.002)) - 0.0055, op: 'add', k: 0.002, slot: SLOT.TRIM });
    }
    const bb = [[-0.36, waist - 0.05, -0.3], [0.36, neckY + 0.05, 0.3]];
    const pc = shell(base, { sdf: tor, clip, t: T, rimW: sp.rimW ?? 0.022, rimH: sp.rimH ?? (sp.style === 'leather' ? 0.004 : 0.008), bevel: 0.006, features: feats, bbox: bb, cell: base.L?.ring < 1 ? 0.014 : 0.0072, target: base.L?.ring < 1 ? 600 : 2300,
      slot: sp.slot ?? (sp.style === 'gi' || sp.style === 'cloth' ? SLOT.CLOTH1 : SLOT.ARMOR1), rimSlot: sp.runes ? SLOT.RUNE : (sp.rimSlot ?? SLOT.TRIM), rune: sp.runes, runeRim: sp.runes });
    return pc;
  });
}
function marchFront(tor, y) { // front surface z of the torso at height y (x = 0)
  let z = -0.4;
  for (let i = 0; i < 40; i++) { const d = tor.eval(0, y, z); if (d < 0.001) break; z += Math.max(d * 0.9, 0.001); }
  return z;
}

// ---------------------------------------------------------------------------------------------------
/** layered tasset plates hanging from the belt over the hips / front of the thighs */
export function tassetsPiece(base, sp = {}) {
  return cached(`${base.key}|tassets|${JSON.stringify(sp)}`, () => {
    const pb = new PB(base);
    const J = base.JJ.J, P = base.P;
    const fn = base.chainSDF.torsoLegs;
    const y0 = J.spine[1] + (sp.top ?? -0.07);
    const rows = sp.rows ?? 3, h = (sp.h ?? 0.075), over = 0.018;
    const sides = sp.sides ?? [[-1.05, -0.35], [0.35, 1.05]]; // angle ranges around the hips (0 = front)
    for (const [a0, a1] of sides) {
      const sgSide = (a0 + a1) > 0 ? 1 : -1;
      const thigh = sgSide > 0 ? B.thighR : B.thighL;
      for (let r = 0; r < rows; r++) {
        const yt = y0 - r * (h - over), yb = yt - h;
        const n = 10, prof = [];
        const ids = [[], []];
        for (let j = 0; j <= n; j++) {
          const a = lerp(a0, a1, j / n), dx = Math.sin(a), dz = -Math.cos(a);
          for (const [k, yy] of [[0, yt], [1, yb]]) {
            let rr = marchR(fn, 0, yy, J.hips[2], dx, dz) + 0.022 + r * 0.008 + k * 0.03;
            const x = dx * rr, z = J.hips[2] + dz * rr;
            const bw = [[B.hips, 1 - k * 0.6 - r * 0.15], [thigh, k * 0.6 + r * 0.15 + 0.001]];
            const edge = j === 0 || j === n || k === 1;
            const f = (0.82 + 0.25 * (1 - k)) * (0.9 + 0.1 * Math.cos(a - (a0 + a1) / 2));
            ids[k].push(pb.v(x, yy, z, dx, 0.25, dz, SLOT.ARMOR1, [f, f, f], 0, bw));
          }
        }
        for (let j = 0; j < n; j++) { const a = ids[0][j], b = ids[0][j + 1], c = ids[1][j + 1], d = ids[1][j]; pb.tri(a, d, c); pb.tri(a, c, b); pb.tri(a, c, d); pb.tri(a, b, c); }
        // trim along the bottom edge (a tube following the lower row)
        const pts = [], rad = [];
        for (let j = 0; j <= n; j++) { const i = ids[1][j]; pts.push(new THREE.Vector3(pb.P[i * 3], pb.P[i * 3 + 1] + 0.003, pb.P[i * 3 + 2])); rad.push(0.0055); }
        pb.add(tubeGeo(pts, rad, 5), { slot: sp.runes ? SLOT.RUNE : SLOT.TRIM, bw: [[B.hips, 0.35], [thigh, 0.65]], mulFn: topLit(0.3, 0.95), rune: sp.runes ? 1 : 0 });
        if (sp.spikes && r === 0) {
          const mid = ids[0][n >> 1];
          const c = new THREE.Vector3(pb.P[mid * 3], pb.P[mid * 3 + 1] - h * 0.4, pb.P[mid * 3 + 2]);
          const dir = new THREE.Vector3(c.x, 0, c.z - J.hips[2]).normalize();
          const sp2 = new THREE.ConeGeometry(0.012, 0.05, 5); sp2.translate(0, 0.025, 0);
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          pb.add(sp2, { m: new THREE.Matrix4().compose(c, q, new THREE.Vector3(1, 1, 1)), slot: SLOT.METAL, bw: [[B.hips, 0.5], [thigh, 0.5]] });
        }
      }
    }
    return pb.build();
  });
}
function marchR(fn, x0, y, z0, dx, dz) { // radius of the body cross-section at height y along (dx, dz)
  let r = 0.5;
  for (let i = 0; i < 48; i++) { const d = fn.eval(x0 + dx * r, y, z0 + dz * r); if (d < 0.001) return r; r -= Math.max(d * 0.9, 0.0015); if (r <= 0) return 0.02; }
  return r;
}

// ---------------------------------------------------------------------------------------------------
/** limb shell (greave / cuisse / vambrace) on a leg or arm chain between chain coordinates a0..a1 */
export function limbShellPiece(base, chain, a0, a1, sp = {}) {
  return cached(`${base.key}|limbshell|${chain}|${a0}|${a1}|${JSON.stringify(sp)}`, () => {
    const J = base.JJ.J;
    const s = chain.slice(-1), isArm = chain.startsWith('arm');
    const sdf = base.chainSDF[chain];
    const pts = isArm ? [J['uarm' + s], J['farm' + s], J['hand' + s]] : [J['thigh' + s], J['shin' + s], J['foot' + s], J['toe' + s]];
    const at = (u) => { const i = Math.min(pts.length - 2, Math.floor(u)), f = u - i; const a = pts[i], b = pts[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; };
    const A = at(a0), Bp = at(a1);
    const ax = [Bp[0] - A[0], Bp[1] - A[1], Bp[2] - A[2]], L = Math.hypot(...ax); ax[0] /= L; ax[1] /= L; ax[2] /= L;
    const clip = (x, y, z) => {
      const t = (x - A[0]) * ax[0] + (y - A[1]) * ax[1] + (z - A[2]) * ax[2];
      let c = Math.max(-t, t - L);
      if (sp.front) { // only the front half (open at the back), e.g. greaves
        const rx = x - (A[0] + ax[0] * t), rz = z - (A[2] + ax[2] * t);
        c = Math.max(c, rz + (sp.backCut ?? 0.01));
        void rx;
      }
      return c;
    };
    const feats = [];
    if (sp.ridge) feats.push({ fn: (x, y, z, db) => { const t = clamp((x - A[0]) * ax[0] + (y - A[1]) * ax[1] + (z - A[2]) * ax[2], 0, L); const px = A[0] + ax[0] * t, py = A[1] + ax[1] * t, pz = A[2] + ax[2] * t; const rz = z - pz, rx = x - px; return Math.abs(rx) - 0.006 + Math.max(0, rz + 0.02) * 2 + Math.max(0, -db + 0.0) ; }, op: 'add', k: 0.006, slot: SLOT.TRIM });
    const lo = [Math.min(A[0], Bp[0]) - 0.14, Math.min(A[1], Bp[1]) - 0.1, Math.min(A[2], Bp[2]) - 0.14], hi = [Math.max(A[0], Bp[0]) + 0.14, Math.max(A[1], Bp[1]) + 0.1, Math.max(A[2], Bp[2]) + 0.14];
    const tFn = sp.flare ? (x, y, z) => { const t = clamp(((x - A[0]) * ax[0] + (y - A[1]) * ax[1] + (z - A[2]) * ax[2]) / L, 0, 1); return (sp.t ?? 0.014) + sp.flare * t * t; } : null;
    return shell(base, { sdf, clip, t: sp.t ?? 0.014, tFn, rimW: 0.016, rimH: 0.006, bevel: 0.005, features: feats, bbox: [lo, hi], cell: base.L?.ring < 1 ? 0.013 : 0.0068, target: base.L?.ring < 1 ? 160 : (sp.target ?? 500),
      slot: sp.slot ?? SLOT.ARMOR1, rimSlot: sp.runes ? SLOT.RUNE : SLOT.TRIM, rune: sp.runes, runeRim: sp.runes });
  });
}

// ---------------------------------------------------------------------------------------------------
/** loose trousers: a cloth shell around each leg, full at the thigh, gathered at the knee or ankle wraps */
export function pantsPiece(base, sp = {}) {
  return cached(`${base.key}|pants|${JSON.stringify(sp)}`, () => {
    const J = base.JJ.J;
    const out = [];
    for (const s of ['L', 'R']) {
      const sdf = base.chainSDF['leg' + s];
      const H = J['thigh' + s], K = J['shin' + s], A = J['foot' + s];
      const yTop = J.hips[1] + 0.02, yBot = lerp(K[1], A[1], sp.to ?? 0.62);
      const full = sp.full ?? 0.03;
      const clip = (x, y, z) => Math.max(y - yTop, yBot - y, -(x * (s === 'R' ? 1 : -1)) - 0.004);
      const tFn = (x, y) => { const t = clamp((yTop - y) / (yTop - yBot), 0, 1); return 0.006 + full * Math.sin(Math.min(1, t * 1.25) * Math.PI) * (t < 0.9 ? 1 : 0.4); };
      const folds = [];
      for (let i = 0; i < 5; i++) { const y0 = lerp(yTop - 0.1, yBot + 0.04, i / 4); folds.push({ fn: (x, y, z, db) => Math.max(Math.abs(y - y0 - Math.sin(x * 40 + i) * 0.012) - 0.003, -(db - 0.012)), op: 'sub', k: 0.004, mul: 0.78 }); }
      const lo = [Math.min(H[0], A[0]) - 0.16, yBot - 0.04, Math.min(H[2], A[2]) - 0.18], hi = [Math.max(H[0], A[0]) + 0.16, yTop + 0.04, Math.max(H[2], A[2]) + 0.18];
      out.push(shellLeg(base, { sdf, clip, tFn, features: folds, bbox: [lo, hi], s }));
    }
    return out;
  });
}
function shellLeg(base, o) {
  return shell(base, { sdf: o.sdf, clip: o.clip, t: 0.02, tFn: o.tFn, rimW: 0.02, rimH: 0.003, bevel: 0.006, features: o.features, bbox: o.bbox, cell: base.L?.ring < 1 ? 0.014 : 0.008, target: base.L?.ring < 1 ? 220 : 700, slot: SLOT.PANTS, rimSlot: SLOT.PANTS });
}
