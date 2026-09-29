// Hero bodies: heroic stylised-realistic proportions (≈7.5 heads), sculpted as smooth-unioned SDF primitives and
// meshed with surface nets. Cached per sex + build bucket + LOD ("base"); heads are cached separately per
// sex + face preset + LOD (the cranium is shared, so hair and helmets fit every face).
// Output: bind joints, neutral-frame rotations and skinned "pieces" (see makePiece).
import { SDF, ADD, SUB, rotEuler, rotAlign, mulR, surfaceNets, sdfAO, norm3, refineVerts } from './sdf.js';
import { BONES, B, NB, PARENTS, BONE_CHAIN, CH_TORSO, CH_ARM_L, CH_ARM_R, CH_LEG_L, CH_LEG_R, CH_HEAD, CH_HAND_L, CH_HAND_R } from './rig.js';
import { buildHeadPrims, headDef, faceMapping, eyeCenter } from './head.js';
import { eyePiece } from './eyes.js';
import { SLOT } from './palette.js';
import { simplify } from './simplify.js';

// ------------------------------------------------------------------------------------------------
// Parameters (metres). Girth arrays are ellipsoid radii [x, y, z] or cone radii [start, end].
// Male ≈ 1.86 m to the crown, female ≈ 1.76 m. Long legs, broad shoulders / narrow waist (m), strong and elegant (f).
const HERO_M = {
  ankleH: 0.09, shin: 0.435, thigh: 0.445, hipW: 0.098, legS: 0.065,
  pelvisUp: 0.052, spine: 0.125, chest: 0.155, neckBase: 0.245, neckLen: 0.085, headFwd: 0.0, hunch: 0,
  shX: 0.245, shY: 0.205, shZ: 0.012, clavX: 0.03, clavY: 0.215, clavZ: -0.025,
  uarm: 0.295, farm: 0.27, armA: 0.66,
  core: [0.138, 0.2, 0.7],
  pelvis: [0.144, 0.098, 0.106], glute: [0.078, 0.088, 0.074], belly: [0.116, 0.114, 0.098], ribs: [0.19, 0.19, 0.132],
  pec: [0.098, 0.07, 0.054], bust: null, lat: [0.094, 0.15, 0.08], back: [0.17, 0.11, 0.066],
  trap: 0.066, neckR: 0.057, delt: [0.084, 0.092, 0.084],
  uarmR: [0.066, 0.052], bicep: [0.057, 0.108, 0.056], farmR: [0.058, 0.041], farmBulge: [0.066, 0.108, 0.057],
  thighR: [0.099, 0.063], quad: [0.077, 0.168, 0.069], calf: [0.063, 0.118, 0.063], shinR: [0.055, 0.043],
  foot: [0.057, 0.047, 0.132], hand: 1.13, tk: 0.08, radius: 0.45,
  abs: 1,
};
const HERO_F = {
  ...HERO_M, ankleH: 0.085, shin: 0.425, thigh: 0.435, hipW: 0.094, legS: 0.055, pelvisUp: 0.048, spine: 0.115, chest: 0.135,
  neckBase: 0.222, neckLen: 0.088, shX: 0.186, shY: 0.19, clavX: 0.025, clavY: 0.195, uarm: 0.268, farm: 0.243, armA: 0.6,
  core: [0.132, 0.138, 0.72],
  pelvis: [0.156, 0.104, 0.108], glute: [0.089, 0.097, 0.085], belly: [0.103, 0.108, 0.086], ribs: [0.132, 0.156, 0.104],
  pec: null, bust: [0.064, 0.06, 0.058], lat: [0.056, 0.108, 0.06], back: [0.116, 0.08, 0.05],
  trap: 0.04, neckR: 0.043, delt: [0.05, 0.057, 0.05],
  uarmR: [0.045, 0.035], bicep: [0.036, 0.098, 0.036], farmR: [0.039, 0.028], farmBulge: [0.043, 0.098, 0.038],
  thighR: [0.095, 0.054], quad: [0.069, 0.162, 0.061], calf: [0.053, 0.108, 0.053], shinR: [0.045, 0.034],
  foot: [0.047, 0.039, 0.116], hand: 0.98, tk: 0.08, radius: 0.38,
  abs: 0,
};
const RAW = { m: HERO_M, f: HERO_F };

// LOD mesh budgets (vertex targets before assembly)
export const LOD = {
  full: { body: 2600, head: 2000, hand: 340, hBody: 0.019, hHead: 0.0046, hHand: 0.0066, ring: 1, hair: 1 },
  crowd: { body: 950, head: 320, hand: 90, hBody: 0.03, hHead: 0.011, hHand: 0.011, ring: 0.5, hair: 0.4 },
};

// ------------------------------------------------------------------------------------------------
const v3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const rot = (R, p) => [R[0] * p[0] + R[1] * p[1] + R[2] * p[2], R[3] * p[0] + R[4] * p[1] + R[5] * p[2], R[6] * p[0] + R[7] * p[1] + R[8] * p[2]];
function quatFromR(m) {
  const [m11, m12, m13, m21, m22, m23, m31, m32, m33] = m;
  const tr = m11 + m22 + m33; let x, y, z, w;
  if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); w = 0.25 / s; x = (m32 - m23) * s; y = (m13 - m31) * s; z = (m21 - m12) * s; }
  else if (m11 > m22 && m11 > m33) { const s = 2 * Math.sqrt(1 + m11 - m22 - m33); w = (m32 - m23) / s; x = 0.25 * s; y = (m12 + m21) / s; z = (m13 + m31) / s; }
  else if (m22 > m33) { const s = 2 * Math.sqrt(1 + m22 - m11 - m33); w = (m13 - m31) / s; x = (m12 + m21) / s; y = 0.25 * s; z = (m23 + m32) / s; }
  else { const s = 2 * Math.sqrt(1 + m33 - m11 - m22); w = (m21 - m12) / s; x = (m13 + m31) / s; y = (m23 + m32) / s; z = 0.25 * s; }
  return [x, y, z, w];
}
const RT = R => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];

/** build 0..1 → one of 5 cached buckets */
export const buildBucket = (b) => Math.round(Math.max(0, Math.min(1, b ?? 0.5)) * 4) / 4;

export function bodyParams(sex, build = 0.5, lod = 'full') {
  const b = buildBucket(build);
  const P = { ...RAW[sex === 'f' ? 'f' : 'm'] };
  P.sex = sex === 'f' ? 'f' : 'm'; P.race = 'hero'; P.build = b; P.lod = lod;
  P.key = `${P.sex}_${b}_${lod}`; P.headKey = `${P.sex}_${lod}`;
  // build: lean (0) … athletic (0.5) … massive (1). Only girths change; heights and the head are shared.
  const m = (lo, hi) => lo + (hi - lo) * b;
  const k = m(0.86, 1.16), kc = m(0.94, 1.07), kw = m(0.95, 1.07);
  const mul = (a, s) => a && a.map(v => v * s);
  for (const n of ['delt', 'bicep', 'farmBulge', 'quad', 'calf', 'lat']) P[n] = mul(P[n], k);
  if (P.pec) P.pec = mul(P.pec, k);
  P.trap *= m(0.8, 1.3); P.ribs = mul(P.ribs, kc); P.back = mul(P.back, kc); P.belly = mul(P.belly, kw);
  P.uarmR = mul(P.uarmR, m(0.9, 1.12)); P.farmR = mul(P.farmR, m(0.92, 1.1)); P.thighR = mul(P.thighR, m(0.93, 1.08));
  P.core = [P.core[0] * kw, P.core[1] * kc, P.core[2]];
  P.shX += m(-0.01, 0.014) * (P.sex === 'm' ? 1 : 0.5);
  P.radius *= m(0.94, 1.08);
  P.headDef = headDef(P.sex, 0);
  return P;
}

/** Bind joint positions + neutral frames. */
export function buildJoints(P) {
  const J = {};
  const legLen = P.shin + P.thigh;
  const yHipJ = P.ankleH + legLen * Math.cos(P.legS);
  J.hips = [0, yHipJ + P.pelvisUp, 0];
  J.spine = v3(J.hips, [0, P.spine, 0.004]);
  J.chest = v3(J.spine, [0, P.chest, 0.004]);
  const Rh = rotEuler(-P.hunch, 0, 0), Rh2 = rotEuler(-P.hunch * 0.5, 0, 0);
  J.neck = v3(J.chest, rot(Rh, [0, P.neckBase, 0.01]));
  J.head = v3(J.neck, [0, P.neckLen, -P.headFwd]);
  const A = {};
  for (const s of ['L', 'R']) {
    const sg = s === 'R' ? 1 : -1;
    J['clav' + s] = v3(J.chest, rot(Rh2, [sg * P.clavX, P.clavY, P.clavZ]));
    const S = v3(J.chest, rot(Rh2, [sg * P.shX, P.shY, P.shZ]));
    const RA = rotEuler(0, 0, sg * P.armA);
    const tf = p => v3(S, rot(RA, sub3(p, S)));  // neutral -> bind
    const hs = P.hand;
    const E = v3(S, [0, -P.uarm, 0]), W = v3(E, [0, -P.farm, 0]);
    const K = v3(W, [0, -0.1 * hs, 0]);
    const n = { S, E, W, K,
      idx1: v3(K, [0, 0, -0.03 * hs]), idx2: v3(K, [0, -0.045 * hs, -0.032 * hs]),
      fng1: v3(K, [0, 0, 0.012 * hs]), fng2: v3(K, [0, -0.045 * hs, 0.012 * hs]),
      thb1: v3(W, [-sg * 0.012 * hs, -0.028 * hs, -0.032 * hs]), thb2: v3(W, [-sg * 0.022 * hs, -0.065 * hs, -0.058 * hs]) };
    A[s] = { RA, tf, n, S, sg };
    J['uarm' + s] = tf(S); J['farm' + s] = tf(E); J['hand' + s] = tf(W);
    J['idx' + s + '1'] = tf(n.idx1); J['idx' + s + '2'] = tf(n.idx2);
    J['fng' + s + '1'] = tf(n.fng1); J['fng' + s + '2'] = tf(n.fng2);
    J['thb' + s + '1'] = tf(n.thb1); J['thb' + s + '2'] = tf(n.thb2);
    const H = [sg * P.hipW, yHipJ, 0];
    const RS = rotEuler(0, 0, sg * P.legS);
    const tl = p => v3(H, rot(RS, sub3(p, H)));
    const Kn = v3(H, [0, -P.thigh, 0]), An = v3(Kn, [0, -P.shin, 0]);
    const fl = P.foot[2];
    const ball = v3(An, [0, -P.ankleH + 0.028, -fl * 0.95]);
    J['thigh' + s] = tl(H); J['shin' + s] = tl(Kn); J['foot' + s] = tl(An); J['toe' + s] = tl(ball);
    A[s].RS = RS; A[s].tl = tl; A[s].H = H; A[s].Kn = Kn; A[s].An = An; A[s].ball = ball;
  }
  const hd = P.headDef, hs = hd.s;
  J.cape0 = v3(J.chest, rot(Rh2, [0, P.shY + 0.005, P.ribs[2] + 0.035]));
  J.cape1 = v3(J.cape0, [0, -0.3 * (legLen / 0.87), 0.03]);
  J.cape2 = v3(J.cape1, [0, -0.3 * (legLen / 0.87), 0.02]);
  J.cape3 = v3(J.cape2, [0, -0.28 * (legLen / 0.87), 0.01]);
  J.hairA = v3(J.head, [0, 0.12 * hs, 0.1 * hs]);
  J.hairB = v3(J.hairA, [0, -0.12 * hs, 0.03 * hs]);
  J.hairC = v3(J.hairB, [0, -0.13 * hs, 0.01 * hs]);
  J.braidL1 = v3(J.head, [-0.085 * hs, 0.02 * hs, -0.02 * hs]); J.braidL2 = v3(J.braidL1, [0, -0.13 * hs, 0]);
  J.braidR1 = v3(J.head, [0.085 * hs, 0.02 * hs, -0.02 * hs]); J.braidR2 = v3(J.braidR1, [0, -0.13 * hs, 0]);
  J.beard1 = v3(J.head, [0, -0.04 * hs, -0.09 * hs]); J.beard2 = v3(J.beard1, [0, -0.1 * hs, -0.02 * hs]);
  // eyelid bones at the eyeball centres (shared by every face preset of the sex)
  for (const sg of [-1, 1]) { const e = eyeCenter(hd, sg); J[sg < 0 ? 'lidL' : 'lidR'] = [J.head[0] + e[0] * hs, J.head[1] + e[1] * hs, J.head[2] + e[2] * hs]; }
  // front flaps / sash tails (hang from the belt, front and back): skirt bones
  J.skirtF = v3(J.hips, [0, -0.02, -0.12]); J.skirtF2 = v3(J.skirtF, [0, -0.22, -0.01]);
  J.skirtB = v3(J.hips, [0, -0.02, 0.12]); J.skirtB2 = v3(J.skirtB, [0, -0.22, 0.01]);

  const joints = new Float32Array(NB * 3);
  BONES.forEach((n, i) => { joints.set(J[n], i * 3); });
  const N = new Float32Array(NB * 4);
  BONES.forEach((n, i) => {
    let R = null;
    const side = /L\d?$/.test(n) ? 'L' : /R\d?$/.test(n) ? 'R' : null;
    if (side && /^(uarm|farm|hand|idx|fng|thb)/.test(n)) R = RT(A[side].RA);
    else if (side && /^(thigh|shin|foot|toe)/.test(n)) R = RT(A[side].RS);
    const q = R ? quatFromR(R) : [0, 0, 0, 1];
    N.set(q, i * 4);
  });
  const legLenL = Math.hypot(...sub3(J.thighL, J.shinL)), shinLenL = Math.hypot(...sub3(J.shinL, J.footL));
  return { J, joints, N, A, yHipJ, legLen, thighLen: legLenL, shinLen: shinLenL };
}

// ------------------------------------------------------------------------------------------------
// Primitive construction. Each prim is added to the master SDF (weights) and zone SDFs (meshing).
function buildPrims(P, JJ) {
  const { J, A } = JJ;
  const master = new SDF(), body = new SDF(), hand = new SDF();
  const both = (fn) => { fn(master); fn(body); };
  const Rh2 = rotEuler(-P.hunch * 0.55, 0, 0);
  const inC = (p) => v3(J.chest, rot(Rh2, p));
  const kT = P.tk, kL = 0.032;
  const male = P.sex === 'm';
  // --- smooth torso core: elliptical round cones hips -> waist -> upper chest (V-taper)
  const coreTop = inC([0, 0.12, 0.004]);
  const waist = (P.core[0] + P.core[1]) * 0.5 * (male ? 0.9 : 0.86);
  both(s => s.cone(v3(J.hips, [0, -0.01, 0.004]), v3(J.spine, [0, 0.02, 0.004]), P.core[0], waist, { bone: B.spine, k: kT, sq: [1, 1, P.core[2]] }));
  both(s => s.cone(v3(J.spine, [0, 0.02, 0.004]), coreTop, waist, P.core[1], { bone: B.chest, k: kT, sq: [1, 1, P.core[2]] }));
  // --- pelvis / hips / glutes
  both(s => s.ell(v3(J.hips, [0, -0.025, 0.004]), P.pelvis, { bone: B.hips, k: kT }));
  for (const sg of [-1, 1]) both(s => s.ell(v3(J.hips, [sg * P.glute[0] * 0.82, -0.06, 0.05]), P.glute, { bone: B.hips, k: kT, rot: rotEuler(0.2, 0, 0) }));
  both(s => s.ell(v3(J.hips, [0, -0.085, -0.015]), [P.pelvis[0] * 0.42, 0.06, 0.065], { bone: B.hips, k: 0.03 }));
  // --- abdomen (slight six-pack relief on athletic males)
  both(s => s.ell(v3(J.spine, [0, -0.005, -0.004]), P.belly, { bone: B.spine, k: kT }));
  if (P.abs) for (const sg of [-1, 1]) for (let i = 0; i < 3; i++) {
    both(s => s.ell(v3(J.spine, [sg * 0.03, 0.075 - i * 0.052, -P.belly[2] * 0.93]), [0.028, 0.022, 0.012], { bone: i < 1 ? B.chest : B.spine, k: 0.02 }));
  }
  // --- ribcage & chest
  const ribC = inC([0, 0.095, 0.004]);
  both(s => s.ell(ribC, P.ribs, { bone: B.chest, k: kT, rot: Rh2 }));
  both(s => s.ell(inC([0, P.shY - 0.03, P.ribs[2] * 0.45]), P.back, { bone: B.chest, k: 0.05, rot: Rh2 }));
  for (const sg of [-1, 1]) {
    if (P.pec) both(s => s.ell(inC([sg * P.pec[0] * 0.88, P.shY - 0.07, -P.ribs[2] * 0.58]), P.pec, { bone: B.chest, k: 0.035, rot: mulR(Rh2, rotEuler(0.15, sg * 0.25, sg * -0.15)) }));
    if (P.bust) both(s => s.ell(inC([sg * P.bust[0] * 0.95, P.shY - 0.1, -P.ribs[2] * 0.62]), P.bust, { bone: B.chest, k: 0.035, rot: mulR(Rh2, rotEuler(0.25, sg * 0.3, 0)) }));
    both(s => s.ell(inC([sg * (P.ribs[0] * 0.62), P.shY - 0.1, P.ribs[2] * 0.2]), P.lat, { bone: B.chest, k: 0.05, rot: mulR(Rh2, rotEuler(0, 0, sg * 0.25)) }));
    const S = A[sg > 0 ? 'R' : 'L'].S;
    both(s => s.cone(v3(J.neck, [sg * 0.01, -0.02, 0.02]), v3(S, [-sg * 0.045, 0.028, 0.02]), P.trap, P.trap * 0.72, { bone: B.chest, k: 0.04 }));
  }
  // --- neck (body zone slightly inset so the head zone covers it)
  const neckA = v3(J.neck, [0, -0.04, 0.012]), neckB = v3(J.head, [0, 0.03, 0.01]);
  master.cone(neckA, neckB, P.neckR * 1.02, P.neckR * 0.92, { bone: B.neck, k: 0.035 });
  body.cone(neckA, v3(J.head, [0, -0.01, 0.01]), P.neckR * 0.95, P.neckR * 0.82, { bone: B.neck, k: 0.035 });
  // --- arms
  for (const s of ['L', 'R']) {
    const a = A[s], sg = a.sg, n = a.n;
    const X = { R: a.RA, t: sub3(a.S, rot(a.RA, a.S)) };
    master.setXform(X); body.setXform(X);
    const bu = B['uarm' + s], bf = B['farm' + s];
    both(sd => sd.ell(v3(n.S, [sg * 0.012, 0.004, 0.004]), P.delt, { bone: bu, k: 0.04, sig: 1.35 }));
    both(sd => sd.cone(n.S, n.E, P.uarmR[0], P.uarmR[1], { bone: bu, k: kL }));
    both(sd => sd.ell(v3(n.S, [0, -P.uarm * 0.45, -P.uarmR[1] * 0.4]), P.bicep, { bone: bu, k: 0.03 }));
    both(sd => sd.ell(v3(n.S, [sg * 0.004, -P.uarm * 0.38, P.uarmR[1] * 0.35]), [P.bicep[0] * 0.95, P.bicep[1], P.bicep[2] * 0.95], { bone: bu, k: 0.03 }));
    both(sd => sd.cone(n.E, n.W, P.farmR[0], P.farmR[1], { bone: bf, k: kL }));
    both(sd => sd.ell(v3(n.E, [sg * 0.004, -P.farm * 0.3, -0.004]), P.farmBulge, { bone: bf, k: 0.03 }));
    master.cone(v3(n.W, [0, 0.04, 0]), v3(n.W, [0, -0.01, 0]), P.farmR[1] * 1.03, P.farmR[1] * 1.0, { bone: bf, k: 0.02 });
    addHand(master, P, n, sg, s);
    if (s === 'R') {
      hand.setXform(X);
      hand.cone(v3(n.W, [0, 0.06, 0]), v3(n.W, [0, -0.01, 0]), P.farmR[1] * 1.03, P.farmR[1] * 1.0, { bone: bf, k: 0.02 });
      addHand(hand, P, n, sg, s);
      hand.setXform(null);
    }
    master.setXform(null); body.setXform(null);
  }
  // --- legs
  for (const s of ['L', 'R']) {
    const a = A[s], sg = a.sg;
    const X = { R: a.RS, t: sub3(a.H, rot(a.RS, a.H)) };
    master.setXform(X); body.setXform(X);
    const bt = B['thigh' + s], bs = B['shin' + s], bfo = B['foot' + s], bto = B['toe' + s];
    const H = a.H, K = a.Kn, An = a.An;
    both(sd => sd.cone(v3(H, [0, 0.01, 0]), K, P.thighR[0], P.thighR[1], { bone: bt, k: kL }));
    both(sd => sd.ell(v3(H, [sg * 0.004, -P.thigh * 0.45, -P.thighR[1] * 0.35]), P.quad, { bone: bt, k: 0.03 }));
    both(sd => sd.ell(v3(H, [sg * 0.018, -P.thigh * 0.3, P.thighR[1] * 0.25]), [P.quad[0] * 0.95, P.quad[1] * 0.95, P.quad[2]], { bone: bt, k: 0.035 }));
    both(sd => sd.sphere(v3(K, [0, 0, -0.01]), P.thighR[1] * 0.92, { bone: bs, k: 0.025, sig: 0.8 }));
    both(sd => sd.cone(K, v3(An, [0, 0.01, 0]), P.shinR[0], P.shinR[1], { bone: bs, k: kL }));
    both(sd => sd.ell(v3(K, [sg * 0.003, -P.shin * 0.3, P.shinR[0] * 0.35]), P.calf, { bone: bs, k: 0.03 }));
    const fw = P.foot[0], fh = P.foot[1], fl = P.foot[2];
    both(sd => sd.sphere(An, P.shinR[1] * 1.05, { bone: bfo, k: 0.03 }));
    both(sd => sd.box(v3(An, [0, -P.ankleH * 0.62, -fl * 0.4]), [fw * 0.92, fh * 0.9, fl * 0.62], Math.min(fw, fh) * 0.8, { bone: bfo, k: 0.03, rot: rotEuler(0.06, 0, 0) }));
    both(sd => sd.box(v3(An, [0, -P.ankleH + fh * 0.62, -fl * 1.18]), [fw * 0.95, fh * 0.62, fl * 0.36], fh * 0.6, { bone: bto, k: 0.028 }));
    master.setXform(null); body.setXform(null);
  }
  // head primitives of face 0 (weights only; the head mesh is built per face in getHead)
  buildHeadPrims(master, null, P, J, P.headDef);
  master.build(); body.build(); hand.build();
  return { master, body, hand };
}

function addHand(sd, P, n, sg, s) {
  const hs = P.hand, W = n.W;
  const bh = B['hand' + s];
  sd.box(v3(W, [0, -0.052 * hs, -0.004 * hs]), [0.02 * hs, 0.05 * hs, 0.045 * hs], 0.018 * hs, { bone: bh, k: 0.02 });
  sd.ell(v3(W, [-sg * 0.012 * hs, -0.04 * hs, -0.03 * hs]), [0.019 * hs, 0.034 * hs, 0.021 * hs], { bone: bh, k: 0.015 });
  const fingers = [
    { z: -0.031, len: [0.045, 0.029, 0.024], r: 0.0108, b1: 'idx', b2: 'idx' },
    { z: -0.0105, len: [0.048, 0.031, 0.025], r: 0.0112, b1: 'fng', b2: 'fng' },
    { z: 0.0105, len: [0.045, 0.029, 0.024], r: 0.0106, b1: 'fng', b2: 'fng' },
    { z: 0.03, len: [0.036, 0.023, 0.02], r: 0.0095, b1: 'fng', b2: 'fng' },
  ];
  for (const f of fingers) {
    const k0 = v3(n.K, [0, 0.004 * hs, f.z * hs]);
    const k1 = v3(k0, [0, -f.len[0] * hs, 0]);
    const k2 = v3(k1, [0, -f.len[1] * hs, 0]);
    const k3 = v3(k2, [0, -f.len[2] * hs, 0]);
    const b1 = B[f.b1 + s + '1'], b2 = B[f.b2 + s + '2'];
    sd.cone(k0, k1, f.r * 1.1 * hs, f.r * hs, { bone: b1, k: 0.006 });
    sd.cone(k1, k2, f.r * hs, f.r * 0.92 * hs, { bone: b2, k: 0.005 });
    sd.cone(k2, k3, f.r * 0.92 * hs, f.r * 0.8 * hs, { bone: b2, k: 0.005 });
  }
  const t0 = v3(W, [-sg * 0.006 * hs, -0.022 * hs, -0.03 * hs]);
  const t1 = n.thb2;
  const t2 = v3(t1, [-sg * 0.012 * hs, -0.03 * hs, -0.02 * hs]);
  sd.cone(t0, t1, 0.016 * hs, 0.0128 * hs, { bone: B['thb' + s + '1'], k: 0.012 });
  sd.cone(t1, t2, 0.0128 * hs, 0.011 * hs, { bone: B['thb' + s + '2'], k: 0.006 });
}

// ------------------------------------------------------------------------------------------------
// Skin weights from primitive proximity (soft-min over primitive distances, grouped per bone).
const _pd = new Float32Array(1024);
const _acc = new Float32Array(NB);
export function weightsAt(master, x, y, z, outI, outW, o, sigma, boneFilter = null) {
  const n = master.n;
  master.evalPrims(x, y, z, _pd);
  const acc = _acc; acc.fill(0);
  let dmin = 1e9;
  for (let i = 0; i < n; i++) if (master.opOf(i) === ADD && master.boneOf(i) >= 0) { if (_pd[i] < dmin) dmin = _pd[i]; }
  for (let i = 0; i < n; i++) {
    if (master.opOf(i) !== ADD) continue;
    const b = master.boneOf(i); if (b < 0) continue;
    if (boneFilter && !boneFilter[b]) continue;
    const s = sigma * master.sig[i];
    const w = Math.exp(-(Math.max(_pd[i], dmin) - dmin) / s);
    if (w > acc[b]) acc[b] = w;
  }
  const top = [];
  for (let b = 0; b < NB; b++) if (acc[b] > 0.004) top.push(b);
  top.sort((a, b) => acc[b] - acc[a]);
  let sum = 0; for (let k = 0; k < 4 && k < top.length; k++) sum += acc[top[k]];
  for (let k = 0; k < 4; k++) {
    if (k < top.length && sum > 0) { outI[o + k] = top[k]; outW[o + k] = acc[top[k]] / sum; }
    else { outI[o + k] = 0; outW[o + k] = 0; }
  }
  if (sum === 0) { outI[o] = B.hips; outW[o] = 1; }
}

// ------------------------------------------------------------------------------------------------
// Piece: a skinned, cacheable chunk of geometry with slot-based colouring.
export function makePiece(n, nIdx) {
  return {
    n, pos: new Float32Array(n * 3), nrm: new Float32Array(n * 3), idx: new Uint32Array(nIdx),
    bi: new Uint8Array(n * 4), bw: new Float32Array(n * 4), slot: new Uint8Array(n), mul: new Float32Array(n * 3).fill(1),
    face: null, chain: null, coord: null, ang: null, emis: null, det: null,
  };
}

/** concatenate pieces (same attribute layout) */
/** QEM-decimate a finished piece to ~targetVerts, carrying every per-vertex attribute over from the survivors */
export function decimatePiece(p, targetVerts) {
  if (!p || p.n <= targetVerts) return p;
  const m = simplify(p.pos, p.nrm, p.idx, targetVerts);
  const n = m.pos.length / 3, src = m.src;
  const pc = makePiece(n, m.idx.length);
  pc.pos.set(m.pos); pc.nrm.set(m.nrm); pc.idx.set(m.idx);
  for (let v = 0; v < n; v++) {
    const s = src[v];
    for (let k = 0; k < 4; k++) { pc.bi[v * 4 + k] = p.bi[s * 4 + k]; pc.bw[v * 4 + k] = p.bw[s * 4 + k]; }
    pc.slot[v] = p.slot[s]; pc.mul[v * 3] = p.mul[s * 3]; pc.mul[v * 3 + 1] = p.mul[s * 3 + 1]; pc.mul[v * 3 + 2] = p.mul[s * 3 + 2];
  }
  for (const key of ['emis', 'rune', 'cast', 'coord', 'ang', 'chain']) if (p[key]) { const A = new p[key].constructor(n); for (let v = 0; v < n; v++) A[v] = p[key][src[v]]; pc[key] = A; }
  if (p.face) { pc.face = new Float32Array(n * 2); for (let v = 0; v < n; v++) { pc.face[v * 2] = p.face[src[v] * 2]; pc.face[v * 2 + 1] = p.face[src[v] * 2 + 1]; } }
  if (p.det) { pc.det = new Float32Array(n * 4); for (let v = 0; v < n; v++) for (let k = 0; k < 4; k++) pc.det[v * 4 + k] = p.det[src[v] * 4 + k]; }
  pc.tag = p.tag;
  return pc;
}

export function mergePieces(list) {
  list = list.filter(Boolean);
  if (list.length === 1) return list[0];
  let n = 0, ni = 0; for (const p of list) { n += p.n; ni += p.idx.length; }
  const pc = makePiece(n, ni);
  const hasE = list.some(p => p.emis), hasR = list.some(p => p.rune), hasC = list.some(p => p.cast);
  if (hasE) pc.emis = new Float32Array(n);
  if (hasR) pc.rune = new Float32Array(n);
  if (hasC) pc.cast = new Float32Array(n);
  let vo = 0, io = 0;
  for (const p of list) {
    pc.pos.set(p.pos, vo * 3); pc.nrm.set(p.nrm, vo * 3); pc.bi.set(p.bi, vo * 4); pc.bw.set(p.bw, vo * 4); pc.slot.set(p.slot, vo); pc.mul.set(p.mul, vo * 3);
    if (hasE && p.emis) pc.emis.set(p.emis, vo);
    if (hasR && p.rune) pc.rune.set(p.rune, vo);
    if (hasC && p.cast) pc.cast.set(p.cast, vo);
    for (let i = 0; i < p.idx.length; i++) pc.idx[io + i] = p.idx[i] + vo;
    vo += p.n; io += p.idx.length;
  }
  return pc;
}

function meshZone(sdfZone, master, bmin, bmax, h, sigma, opts = {}) {
  const fn = (x, y, z) => sdfZone.eval(x, y, z);
  let m = surfaceNets(fn, bmin, bmax, h, { refine: -1, near: (x, y, z, R) => sdfZone.near(x, y, z, R) });
  const raw = m.pos.length / 3;
  if (opts.target) m = simplify(m.pos, m.nrm, m.idx, opts.target, opts.weight ? (v) => opts.weight(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]) : null);
  refineVerts(fn, m.pos, m.nrm, h, 1);
  const n = m.pos.length / 3;
  const pc = makePiece(n, m.idx.length);
  pc.pos.set(m.pos); pc.nrm.set(m.nrm); pc.idx.set(m.idx);
  for (let v = 0; v < n; v++) weightsAt(master, m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2], pc.bi, pc.bw, v * 4, sigma, opts.boneFilter);
  return { piece: pc, fn, raw };
}

function mirrorPiece(src, boneMap) {
  const pc = makePiece(src.n, src.idx.length);
  for (let v = 0; v < src.n; v++) {
    pc.pos[v * 3] = -src.pos[v * 3]; pc.pos[v * 3 + 1] = src.pos[v * 3 + 1]; pc.pos[v * 3 + 2] = src.pos[v * 3 + 2];
    pc.nrm[v * 3] = -src.nrm[v * 3]; pc.nrm[v * 3 + 1] = src.nrm[v * 3 + 1]; pc.nrm[v * 3 + 2] = src.nrm[v * 3 + 2];
    for (let k = 0; k < 4; k++) { pc.bi[v * 4 + k] = boneMap[src.bi[v * 4 + k]]; pc.bw[v * 4 + k] = src.bw[v * 4 + k]; }
    pc.slot[v] = src.slot[v];
    pc.mul[v * 3] = src.mul[v * 3]; pc.mul[v * 3 + 1] = src.mul[v * 3 + 1]; pc.mul[v * 3 + 2] = src.mul[v * 3 + 2];
  }
  for (let t = 0; t < src.idx.length; t += 3) { pc.idx[t] = src.idx[t]; pc.idx[t + 1] = src.idx[t + 2]; pc.idx[t + 2] = src.idx[t + 1]; }
  if (src.chain) { pc.chain = src.chain.map(c => c === CH_HAND_R ? CH_HAND_L : c === CH_ARM_R ? CH_ARM_L : c); pc.coord = src.coord.slice(); pc.ang = src.ang.slice(); }
  return pc;
}
export const LR_MAP = (() => { const m = new Uint8Array(NB); BONES.forEach((n, i) => { let o = n; if (/L(\d?)$/.test(n) && n !== 'hips') o = n.replace(/L(\d?)$/, 'R$1'); else if (/R(\d?)$/.test(n)) o = n.replace(/R(\d?)$/, 'L$1'); m[i] = B[o] ?? i; }); return m; })();

// Per-vertex region data used by garment rules: chain id, coordinate along the chain, angle around it.
function regionData(pc, JJ) {
  const { J } = JJ;
  pc.chain = new Uint8Array(pc.n); pc.coord = new Float32Array(pc.n); pc.ang = new Float32Array(pc.n);
  const chainSum = new Float32Array(8);
  const segs = {};
  for (const s of ['L', 'R']) {
    segs['arm' + s] = [J['uarm' + s], J['farm' + s], J['hand' + s], ext(J['farm' + s], J['hand' + s], 0.75)];
    segs['leg' + s] = [J['thigh' + s], J['shin' + s], J['foot' + s], J['toe' + s]];
  }
  for (let v = 0; v < pc.n; v++) {
    chainSum.fill(0);
    for (let k = 0; k < 4; k++) chainSum[BONE_CHAIN[pc.bi[v * 4 + k]]] += pc.bw[v * 4 + k];
    let best = 0; for (let c = 1; c < 8; c++) if (chainSum[c] > chainSum[best]) best = c;
    const x = pc.pos[v * 3], y = pc.pos[v * 3 + 1], z = pc.pos[v * 3 + 2];
    pc.chain[v] = best;
    if (best === CH_TORSO || best === CH_HEAD) { pc.coord[v] = y; pc.ang[v] = Math.atan2(x, -z); }
    else {
      const key = (best === CH_ARM_L || best === CH_HAND_L) ? 'armL' : (best === CH_ARM_R || best === CH_HAND_R) ? 'armR' : best === CH_LEG_L ? 'legL' : 'legR';
      const { t, ang } = polyCoord(segs[key], x, y, z);
      pc.coord[v] = t; pc.ang[v] = ang;
    }
  }
}
function ext(a, b, f) { return [b[0] + (b[0] - a[0]) * f, b[1] + (b[1] - a[1]) * f, b[2] + (b[2] - a[2]) * f]; }
function polyCoord(pts, x, y, z) {
  let best = 1e9, bt = 0, bang = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const l2 = dx * dx + dy * dy + dz * dz;
    const t = ((x - a[0]) * dx + (y - a[1]) * dy + (z - a[2]) * dz) / l2;
    const tc = Math.max(i === 0 ? -0.6 : 0, Math.min(i === pts.length - 2 ? 1.4 : 1, t));
    const px = a[0] + dx * tc, py = a[1] + dy * tc, pz = a[2] + dz * tc;
    const d = Math.hypot(x - px, y - py, z - pz);
    if (d < best) { best = d; bt = i + tc; bang = Math.atan2(x - px, -(z - pz)); }
  }
  return { t: bt, ang: bang };
}

// ------------------------------------------------------------------------------------------------
// Skin shading multipliers (AO, top light, warm crevices) baked per vertex.
function shadeSkin(pc, fn, scale, extra = null) {
  for (let v = 0; v < pc.n; v++) {
    const x = pc.pos[v * 3], y = pc.pos[v * 3 + 1], z = pc.pos[v * 3 + 2];
    const nx = pc.nrm[v * 3], ny = pc.nrm[v * 3 + 1], nz = pc.nrm[v * 3 + 2];
    const ao = sdfAO(fn, x, y, z, nx, ny, nz, 0.018 * scale, 1.0);
    const top = 0.9 + 0.16 * ny;
    const aoC = 0.36 + 0.64 * ao;
    let r = aoC * top, g = aoC * top, b = aoC * top;
    const warm = (1 - ao) * 0.35;
    r *= 1 + warm * 0.25; g *= 1 - warm * 0.1; b *= 1 - warm * 0.18;
    pc.mul[v * 3] = r; pc.mul[v * 3 + 1] = g; pc.mul[v * 3 + 2] = b;
    pc.slot[v] = SLOT.SKIN;
    if (extra) extra(v, x, y, z, nx, ny, nz, ao);
  }
}

// ------------------------------------------------------------------------------------------------
const CACHE = new Map();
/** Body base (no head mesh) per sex + build bucket + lod. */
export function getBase(sex = 'm', build = 0.5, lod = 'full') {
  const P = bodyParams(sex, build, lod);
  const key = P.key;
  if (CACHE.has(key)) return CACHE.get(key);
  const t0 = performance.now();
  const L = LOD[lod] || LOD.full;
  const JJ = buildJoints(P);
  const S = buildPrims(P, JJ);
  const J = JJ.J;
  const cr = P.headDef.cranium;
  const H = J.head[1] + (cr.c[1] + cr.r[1] + 0.028) * P.headDef.s;
  const scale = H / 1.86;
  const sigma = 0.013 * Math.max(0.8, scale);
  const bb = [-(P.shX + P.uarm + P.farm + 0.2), -0.02, -0.4], bt = [(P.shX + P.uarm + P.farm + 0.2), J.head[1] + 0.05, 0.4];
  const bodyZ = meshZone(S.body, S.master, bb, bt, L.hBody * Math.max(0.86, scale), sigma, { target: L.body });
  const W = J.handR, hsz = 0.17 * P.hand;
  const handZ = meshZone(S.hand, S.master, [W[0] - hsz, W[1] - hsz * 1.3, W[2] - hsz], [W[0] + hsz, W[1] + 0.08, W[2] + hsz], L.hHand * P.hand, 0.008, { target: L.hand });
  regionData(bodyZ.piece, JJ);
  regionData(handZ.piece, JJ);
  shadeSkin(bodyZ.piece, bodyZ.fn, scale);
  shadeSkin(handZ.piece, handZ.fn, scale * 0.5, (v) => { const m = handZ.piece.mul; m[v * 3] *= 1.03; m[v * 3 + 2] *= 0.97; });
  const handL = mirrorPiece(handZ.piece, LR_MAP);
  handL.chain = new Uint8Array(handL.n).fill(CH_HAND_L);
  handZ.piece.chain.fill(CH_HAND_R);
  const chainSDF = {};
  const bc = (it) => it.bone >= 0 ? BONE_CHAIN[it.bone] : -1;
  const notHead = (it) => it.bone !== B.head;
  chainSDF.torso = S.master.subset(it => it.op === ADD && notHead(it) && (bc(it) === CH_TORSO || ((bc(it) === CH_LEG_L || bc(it) === CH_LEG_R) && /^thigh/.test(BONES[it.bone]))));
  chainSDF.torsoLegs = S.master.subset(it => it.op === ADD && notHead(it) && (bc(it) === CH_TORSO || bc(it) === CH_LEG_L || bc(it) === CH_LEG_R));
  chainSDF.armL = S.master.subset(it => it.op === ADD && (bc(it) === CH_ARM_L || bc(it) === CH_HAND_L));
  chainSDF.armR = S.master.subset(it => it.op === ADD && (bc(it) === CH_ARM_R || bc(it) === CH_HAND_R));
  chainSDF.legL = S.master.subset(it => it.op === ADD && bc(it) === CH_LEG_L);
  chainSDF.legR = S.master.subset(it => it.op === ADD && bc(it) === CH_LEG_R);
  const base = {
    key, headKey: P.headKey, P, JJ, joints: JJ.joints, N: JJ.N, master: S.master, sdfBody: S.body, chainSDF, lod, L,
    pieces: { body: bodyZ.piece, handR: handZ.piece, handL },
    height: H, scale, ms: 0,
  };
  // canonical head (face 0): hair meshing / AO, helmet fitting
  const h0 = getHead(base, 0);
  base.sdfHead = h0.sdf; base.faceMap = h0.faceMap; chainSDF.head = h0.sdf;
  base.ms = performance.now() - t0;
  base.raw = { body: bodyZ.raw, hand: handZ.raw };
  CACHE.set(key, base);
  return base;
}

// ------------------------------------------------------------------------------------------------
// Heads: per sex + face preset + lod (joint positions do not depend on build, so any body base of the sex fits).
const HEAD_CACHE = new Map();
export function getHead(base, face = 0) {
  const key = `${base.headKey}|face${face}`;
  if (HEAD_CACHE.has(key)) return HEAD_CACHE.get(key);
  const t0 = performance.now();
  const P = base.P, J = base.JJ.J, L = base.L;
  const hd = headDef(P.sex, face);
  const Ph = { ...P, headDef: hd };
  const master = new SDF(); master.items = base.master.items.filter(it => it.bone !== B.head);
  const head = new SDF();
  buildHeadPrims(master, head, Ph, J, hd);
  master.build(); head.build();
  const hs = hd.s;
  const hmin = [J.head[0] - 0.24 * hs, J.neck[1] - 0.06, J.head[2] - 0.2 * hs], hmax = [J.head[0] + 0.24 * hs, J.head[1] + 0.3 * hs, J.head[2] + 0.22 * hs];
  const Jh = J.head;
  const sigma = 0.013 * Math.max(0.8, base.scale);
  const headZ = meshZone(head, master, hmin, hmax, L.hHead * hs, sigma * 0.8, {
    target: L.head,
    weight: (x, y, z) => {
      const lx = (x - Jh[0]) / hs, ly = (y - Jh[1]) / hs, lz = (z - Jh[2]) / hs;
      if (lz < -0.05 && Math.abs(lx) < 0.075 && ly > -0.06 && ly < 0.12) return 6;
      if (Math.abs(lx) > 0.085) return 2;
      return 1;
    },
  });
  const pc = headZ.piece;
  pc.chain = new Uint8Array(pc.n).fill(CH_HEAD);
  pc.coord = new Float32Array(pc.n); pc.ang = new Float32Array(pc.n);
  for (let v = 0; v < pc.n; v++) { pc.coord[v] = pc.pos[v * 3 + 1]; pc.ang[v] = Math.atan2(pc.pos[v * 3], -(pc.pos[v * 3 + 2] - J.head[2])); }
  const faceMap = faceMapping(Ph, J);
  headShading(pc, headZ.fn, head, Ph, J, faceMap);
  const eyes = eyePiece(base, hd, key);
  const out = { piece: pc, eyes, sdf: head, faceMap, def: hd, key, ms: performance.now() - t0 };
  HEAD_CACHE.set(key, out);
  return out;
}

// head colouring + face UVs
function headShading(pc, fn, sdfHead, P, J, fm) {
  const pd = new Float32Array(sdfHead.n);
  pc.face = new Float32Array(pc.n * 2).fill(-1);
  const hs = P.headDef.s;
  shadeSkin(pc, fn, 0.45 * hs, (v, x, y, z, nx, ny, nz, ao) => {
    sdfHead.evalPrims(x, y, z, pd);
    let lip = 0, nose = 0, cheek = 0, ear = 0, sock = 0;
    for (let i = 0; i < sdfHead.n; i++) {
      const tg = sdfHead.tagOf(i); if (!tg) continue;
      const w = Math.exp(-Math.max(0, pd[i]) / (0.006 * hs));
      if (tg === 1) lip = Math.max(lip, w); else if (tg === 2) nose = Math.max(nose, w); else if (tg === 3) cheek = Math.max(cheek, w);
      else if (tg === 4) ear = Math.max(ear, w); else if (tg === 5) sock = Math.max(sock, w);
    }
    const m = pc.mul;
    const red = lip * 0.28 * (P.headDef.lipTint ?? 1) + nose * 0.06 + cheek * 0.08 + ear * 0.12;
    m[v * 3] *= 1 + red * 0.2; m[v * 3 + 1] *= 1 - red * 0.55; m[v * 3 + 2] *= 1 - red * 0.5;
    const dk = 1 - sock * 0.1 - lip * 0.06;
    m[v * 3] *= dk; m[v * 3 + 1] *= dk; m[v * 3 + 2] *= dk * 1.02;
    const lx = x - J.head[0], ly = y - J.head[1], lz = z - J.head[2];
    if (lz < fm.zCut && Math.abs(lx) < fm.w * 0.62) {
      pc.face[v * 2] = (lx - fm.x0) / fm.w;
      pc.face[v * 2 + 1] = (ly - fm.y0) / fm.w;
    }
  });
}

export { RAW as BODY_RAW };
