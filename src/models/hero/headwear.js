// Cloth headwear fitted to the sculpted head: a face mask over nose and mouth, and a draped hood with a cowl.
// Both are SDF shells (armor.js machinery) around the head / neck with fold grooves, so they hug the face presets.
import * as THREE from 'three';
import { PB, cached, topLit } from './pieces.js';
import { shellMesh } from './armor.js';
import { B } from './rig.js';
import { SLOT } from './palette.js';
import { clamp, lerp, smoothstep } from '../../core/noise.js';
import { ribbon } from './extras.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** cloth mask covering the nose bridge down to the chin, wrapping back to the ears; knot tails at the back */
export function maskPiece(base, sp = {}) {
  return cached(`${base.headKey}|${base.key}|mask2|${JSON.stringify(sp)}`, () => {
    const d = base.P.headDef, s = d.s, H = base.JJ.J.head, J = base.JJ.J;
    const head = base.sdfHead;
    const neckR = base.P.neckR;
    const neckSdf = { eval: (x, y, z) => { const dx = x - J.neck[0], dz = z - J.neck[2] + 0.004; return Math.hypot(dx, dz * 1.05) - neckR * 1.02 + Math.max(0, y - H[1] - 0.02) * 2; } };
    const sdf = { eval: (x, y, z) => Math.min(head.eval(x, y, z), neckSdf.eval(x, y, z)) };
    const bridgeY = H[1] + (d.eye.y - d.eye.sock[1] - 0.004) * s;
    const clip = (x, y, z) => {
      const ax = Math.abs(x - H[0]);
      const top = bridgeY - ax * 0.28;
      const bot = J.neck[1] - 0.04;
      const back = z - (H[2] + 0.02 * s);
      return Math.max(y - top, bot - y, back);
    };
    const feats = [];
    for (let i = 0; i < 4; i++) { const y0 = bridgeY - 0.03 - i * 0.028; feats.push({ fn: (x, y, z, db) => Math.max(Math.abs(y - y0 + Math.abs(x - H[0]) * 0.15) - 0.0022, -(db - 0.008)), op: 'sub', k: 0.003, mul: 0.75 }); }
    const lo = [H[0] - 0.14, J.neck[1] - 0.08, H[2] - 0.16], hi = [H[0] + 0.14, bridgeY + 0.03, H[2] + 0.1];
    const pc = shellMesh(base, { sdf, clip, t: 0.011, rimW: 0.012, rimH: 0.003, bevel: 0.003, features: feats, bbox: [lo, hi], cell: base.L?.ring < 1 ? 0.009 : 0.0034, target: base.L?.ring < 1 ? 160 : 800, slot: SLOT.HOOD, rimSlot: sp.trim ? SLOT.TRIM : SLOT.HOOD, weights: () => [[B.head, 1]], tin: 0.0015 });
    const pb = new PB(base); pb.ao = false;
    // knot + tails at the back of the head
    const kz = H[2] + 0.1 * s, ky = bridgeY - 0.02;
    for (const sg of [-1, 1]) {
      const pts = [], wid = [], sides = [];
      for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(V(H[0] + sg * (0.012 + t * 0.03), ky - t * 0.16, kz + 0.01 + t * 0.05)); wid.push(0.03 * (1 - t * 0.3)); sides.push(V(1, 0, sg * 0.3)); }
      ribbon(pb, pts, wid, sides, (i, t) => t < 0.15 ? [[B.head, 1]] : [[B.head, 1 - t * 0.6], [B.neck, t * 0.6]], { slot: SLOT.HOOD, th: 0.004 });
    }
    const tails = pb.build();
    return mergeTwo(pc, tails);
  });
}

/** draped hood: loose cloth around the head with a back peak, an opening that frames the face, and a cowl on the shoulders */
export function hood2Piece(base, sp = {}) {
  return cached(`${base.key}|hood2|${JSON.stringify(sp)}`, () => {
    const d = base.P.headDef, s = d.s, H = base.JJ.J.head, J = base.JJ.J, P = base.P;
    const head = base.sdfHead, tor = base.chainSDF.torso;
    const cr = d.cranium;
    const cc = [H[0] + cr.c[0] * s, H[1] + cr.c[1] * s, H[2] + cr.c[2] * s];
    const loose = sp.loose ?? 0.022;
    // soft volume: head + a back peak + the cowl mound over neck and shoulders
    const peak = (x, y, z) => { const a = [cc[0], cc[1] + cr.r[1] * 0.55 * s, cc[2] + 0.04 * s], b = [cc[0], cc[1] + (cr.r[1] + 0.03) * s, cc[2] + 0.12 * s]; const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2]; const t = clamp(((x - a[0]) * bx + (y - a[1]) * by + (z - a[2]) * bz) / (bx * bx + by * by + bz * bz), 0, 1); return Math.hypot(x - a[0] - bx * t, y - a[1] - by * t, z - a[2] - bz * t) - lerp(0.05, 0.012, t) * s; };
    const cowl = (x, y, z) => { const dy = (y - (J.neck[1] - 0.02)) / 0.07, dx = x / (P.shX * 0.85), dz = (z - J.neck[2] - 0.01) / (P.ribs[2] * 1.05); return (Math.hypot(dx, dy, dz) - 1) * 0.07; };
    const sdf = { eval: (x, y, z) => { let v = Math.min(head.eval(x, y, z) - loose, peak(x, y, z)); v = Math.min(v, cowl(x, y, z)); if (y < J.neck[1] + 0.04) v = Math.min(v, tor.eval(x, y, z) - 0.012); return v; } };
    const faceC = [H[0], H[1] + 0.05 * s, H[2] - 0.12 * s];
    const clip = (x, y, z) => {
      const fx = (x - faceC[0]) / (0.074 * s), fy = (y - faceC[1]) / (0.1 * s), fz = (z - faceC[2]) / (0.12 * s);
      const face = 1 - Math.hypot(fx, fy, fz);                  // > 0 inside the face opening
      const low = (J.chest[1] + 0.1) - y;                        // cowl ends on the upper chest
      const arm = Math.max(0.12 - Math.hypot(x - J.uarmL[0], y - J.uarmL[1]), 0.12 - Math.hypot(x - J.uarmR[0], y - J.uarmR[1]));
      return Math.max(face * 0.08, low, arm);
    };
    const feats = [];
    for (let i = 0; i < 9; i++) { // folds radiating down from the peak
      const a = (i / 8 - 0.5) * 2.6 + Math.PI;
      feats.push({ fn: (x, y, z, db) => { const ang = Math.atan2(x - cc[0], z - cc[2]); let da = Math.abs(((ang - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI); return Math.max(da * 0.12 - 0.003, -(db - 0.01), y - cc[1] - 0.05); }, op: 'sub', k: 0.004, mul: 0.72 });
    }
    const lo = [H[0] - 0.36, J.chest[1], H[2] - 0.22], hi = [H[0] + 0.36, H[1] + 0.34 * s, H[2] + 0.3 * s];
    const pc = shellMesh(base, { sdf, clip, t: 0.016, rimW: 0.018, rimH: 0.004, bevel: 0.004, features: feats, bbox: [lo, hi], cell: base.L?.ring < 1 ? 0.013 : 0.0055, target: base.L?.ring < 1 ? 300 : 1300, slot: SLOT.HOOD, rimSlot: sp.trim ? SLOT.TRIM : SLOT.HOOD, tin: 0.002,
      weights: (x, y, z) => y > J.neck[1] + 0.02 ? [[B.head, 1]] : null });
    return pc;
  });
}

function mergeTwo(a, b) {
  if (!a) return b; if (!b) return a;
  const n = a.n + b.n, ni = a.idx.length + b.idx.length;
  const out = { n, pos: new Float32Array(n * 3), nrm: new Float32Array(n * 3), idx: new Uint32Array(ni), bi: new Uint8Array(n * 4), bw: new Float32Array(n * 4), slot: new Uint8Array(n), mul: new Float32Array(n * 3), face: null, chain: null, coord: null, ang: null, emis: null, det: null };
  out.pos.set(a.pos); out.pos.set(b.pos, a.n * 3); out.nrm.set(a.nrm); out.nrm.set(b.nrm, a.n * 3);
  out.bi.set(a.bi); out.bi.set(b.bi, a.n * 4); out.bw.set(a.bw); out.bw.set(b.bw, a.n * 4);
  out.slot.set(a.slot); out.slot.set(b.slot, a.n); out.mul.set(a.mul); out.mul.set(b.mul, a.n * 3);
  out.idx.set(a.idx); for (let i = 0; i < b.idx.length; i++) out.idx[a.idx.length + i] = b.idx[i] + a.n;
  return out;
}
