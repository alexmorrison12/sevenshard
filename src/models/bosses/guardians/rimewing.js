// Rimewing — ice wyvern guardian (~10.3 m wingspan, head ~4 m). Walks on its hind legs and the knuckles of its folded
// wings (the wing arms are its front legs), flies, dives, breathes a frost cone from a glowing throat sac.
// Slate-blue hide, pale frosted belly, crystalline frost spines along the back, crystal crown (breakable 'crest'),
// crystal tail blade (breakable 'tail'), dark membranes with frosted trailing edges and glowing veins.
import * as THREE from 'three';
import { sstep, clamp01, mix, TAU } from '../../kit/rig.js';
import { K, rigid, skinMap } from './core/acc.js';
import { norm, cross, dot, add, sub, mul, addS, lerp3, dist, bezier, hornPath, taper, loft, crystal, eyeball, grid } from './core/geo.js';
import { rimewingSpec } from './rimewing_anim.js';

const C = {
  back: 0x142440, flank: 0x3a6292, belly: 0xd4e8f6, stripe: 0x0a1226, pale: 0xe6f3fb, face: 0x2a456c,
  horn: 0xcfe2f0, hornTip: 0xffffff, claw: 0x16202e, clawTip: 0xb8d4e6,
  crystal: 0x1f5c9a, crystalTip: 0xa8ecff, membrane: 0x1a3160, memEdge: 0xb4e2ff, mouth: 0x0e1c30, tongue: 0x2d557a,
  tooth: 0xf0f8ff, toothBase: 0x9ab4c8, eye: 0xc8f6ff, throat: 0x2a6fa8,
};

// ---------------------------------------------------------------- rig (metres, facing -Z, spread-wing rest pose)
export const J = {
  body: [0, 2.2, 0.15], hips: [0, 2.1, 1.15], chest: [0, 2.35, -0.75],
  neck1: [0, 2.62, -1.5], neck2: [0, 2.97, -2.0], neck3: [0, 3.32, -2.45], neck4: [0, 3.62, -2.9], head: [0, 3.84, -3.3],
  jaw: [0, 3.68, -3.46], crest: [0, 4.1, -3.3], snout: [0, 3.62, -4.62],
  tail: [[0, 2.05, 1.8], [0, 1.92, 2.42], [0, 1.8, 3.02], [0, 1.69, 3.58], [0, 1.6, 4.1], [0, 1.53, 4.58], [0, 1.48, 5.02], [0, 1.45, 5.42]],
  blade: [0, 1.43, 5.8], tailEnd: [0, 1.42, 6.15],
  hip: [0.62, 2.0, 1.15], knee: [0.78, 1.22, 0.52], hock: [0.74, 0.62, 1.2], ball: [0.74, 0.14, 0.86], toe: [0.74, 0, 0.3],
  sh: [0.62, 2.64, -0.95], el: [1.95, 2.9, -0.55], wr: [3.8, 3.0, -0.95], kn: [4.35, 3.0, -0.78],
  fm: [[5.25, 2.95, -0.95], [5.2, 2.92, -0.1], [4.75, 2.92, 0.46]],   // finger mid joints
  ft: [[6.0, 2.85, -0.75], [5.8, 2.78, 0.85], [4.86, 2.75, 1.86]],   // finger tips
};
const X = (p, s) => [p[0] * s, p[1], p[2]];
const SIDES = [[-1, 'L'], [1, 'R']];

function rig(R) {
  R.add('body', null, J.body);
  R.add('hips', 'body', J.hips);
  R.add('chest', 'body', J.chest);
  R.add('neck1', 'chest', J.neck1); R.add('neck2', 'neck1', J.neck2); R.add('neck3', 'neck2', J.neck3); R.add('neck4', 'neck3', J.neck4);
  R.add('head', 'neck4', J.head); R.add('jaw', 'head', J.jaw); R.add('crest', 'head', J.crest);
  for (let i = 0; i < 8; i++) R.add('tail' + (i + 1), i ? 'tail' + i : 'hips', J.tail[i]);
  R.add('blade', 'tail8', J.blade);
  for (const [s, n] of SIDES) {
    R.add('thigh' + n, 'hips', X(J.hip, s)); R.add('shin' + n, 'thigh' + n, X(J.knee, s));
    R.add('meta' + n, 'shin' + n, X(J.hock, s)); R.add('foot' + n, 'meta' + n, X(J.ball, s));
    R.add('wing0' + n, 'chest', X(J.sh, s)); R.add('wing1' + n, 'wing0' + n, X(J.el, s)); R.add('wing2' + n, 'wing1' + n, X(J.wr, s));
    for (let f = 0; f < 3; f++) { R.add(`f${f}a${n}`, 'wing2' + n, X(J.kn, s)); R.add(`f${f}b${n}`, `f${f}a${n}`, X(J.fm[f], s)); }
  }
}

// ---------------------------------------------------------------- SDF body
const hide = [0, 0.32, 0.22, 0], hideS = [0, 0.22, 0.18, 0], soft = [0, 0.1, 0.25, 0];
function sculpt(S) {
  // torso: deep keeled chest, lean belly, strong pelvis
  S.ell('chest', [0, 2.3, -0.72], [0.74, 0.8, 1.02], { k: 0.3, col: C.flank, tag: 'body', dtl: hide });
  S.ell('chest', [0, 1.95, -0.85], [0.5, 0.5, 0.7], { k: 0.3, col: C.belly, tag: 'breast', dtl: soft });
  S.ell('body', [0, 2.12, 0.25], [0.64, 0.66, 0.95], { k: 0.3, col: C.flank, tag: 'body', dtl: hide });
  S.ell('hips', [0, 2.12, 1.18], [0.6, 0.58, 0.74], { k: 0.3, col: C.flank, tag: 'body', dtl: hide });
  // dorsal keel (spine ridge the crystals grow from)
  const keel = [[0, 3.02, -1.55], [0, 2.95, -0.7], [0, 2.8, 0.2], [0, 2.66, 1.1], [0, 2.44, 1.9]];
  const kb = ['neck1', 'chest', 'body', 'hips', 'tail1'];
  for (let i = 0; i < keel.length - 1; i++) S.cone(kb[i + 1], keel[i], keel[i + 1], 0.2, 0.18, { k: 0.32, col: C.back, tag: 'keel', dtl: hide });
  // shoulders / wing roots (deform with the humerus)
  for (const [s, n] of SIDES) {
    S.seg('chest', X([0.35, 2.55, -0.88], s), X([0.95, 2.72, -0.85], s), 0.38, 0.4, { k: 0.26, col: C.flank, tag: 'shoulder', b2: 'wing0' + n, t0: 0.45, t1: 1, dtl: hide });
    S.ell('hips', X([0.5, 2.05, 1.12], s), [0.38, 0.52, 0.55], { k: 0.25, col: C.flank, tag: 'haunch', b2: 'thigh' + n, t0: 0.3, t1: 0.9, dtl: hide });
  }
  // neck: tapering cones + pale throat keel (glowing sac)
  const np = [J.neck1, J.neck2, J.neck3, J.neck4, J.head], nr = [0.56, 0.46, 0.39, 0.33, 0.29];
  S.ell('neck1', [0, 2.62, -1.45], [0.6, 0.62, 0.6], { k: 0.3, col: C.flank, tag: 'neck', dtl: hide });
  for (let i = 0; i < 4; i++) {
    const bn = 'neck' + (i + 1);
    S.cone(bn, np[i], np[i + 1], nr[i], nr[i + 1], { k: 0.2, col: C.flank, tag: 'neck', b2: i < 3 ? 'neck' + (i + 2) : 'head', t0: 0.6, t1: 1, dtl: hide });
    S.cone(bn, add(np[i], [0, -nr[i] * 0.42, 0.05]), add(np[i + 1], [0, -nr[i + 1] * 0.4, 0.05]), nr[i] * 0.66, nr[i + 1] * 0.66, { k: 0.16, col: C.belly, tag: 'throat', dtl: soft });
  }
  // head: long wedge skull, flat brow, heavy cheek plates, tapering snout
  S.ell('head', [0, 3.86, -3.42], [0.36, 0.3, 0.46], { k: 0.14, col: C.face, tag: 'head', dtl: hideS });
  S.cone('head', [0, 3.82, -3.7], [0, 3.66, -4.55], 0.27, 0.13, { k: 0.12, col: C.face, tag: 'snout', dtl: hideS });
  S.cone('head', [0, 3.93, -3.55], [0, 3.76, -4.45], 0.16, 0.08, { k: 0.12, col: C.back, tag: 'ridge', dtl: hideS });
  for (const s of [-1, 1]) {
    S.ell('head', [0.24 * s, 3.74, -3.52], [0.17, 0.2, 0.36], { k: 0.1, col: C.face, tag: 'cheek', rot: [0.1, 0.18 * s, 0], dtl: hideS });
    S.ell('head', [0.22 * s, 3.97, -3.72], [0.12, 0.07, 0.24], { k: 0.07, col: C.back, tag: 'brow', rot: [0.2, -0.25 * s, 0.2 * s], dtl: hideS });
    S.cone('head', [0.19 * s, 3.66, -3.65], [0.1 * s, 3.6, -4.5], 0.075, 0.05, { k: 0.06, col: C.face, tag: 'lip', dtl: hideS });
    S.ell('head', [0.26 * s, 3.86, -3.83], [0.06, 0.055, 0.075], { k: 0.03, sub: true, col: 0x05080e, tag: 'socket' }); // eye socket
  }
  S.cone('head', [0, 3.6, -3.6], [0, 3.58, -4.5], 0.11, 0.05, { k: 0.05, sub: true, col: C.mouth, tag: 'mouthroof' });
  // lower jaw (own surface → the mouth opens)
  S.cone('jaw', [0, 3.6, -3.45], [0, 3.5, -4.42], 0.2, 0.09, { group: 1, k: 0.1, col: C.face, tag: 'jaw', dtl: hideS });
  S.ell('jaw', [0, 3.52, -3.62], [0.22, 0.12, 0.34], { group: 1, k: 0.1, col: C.belly, tag: 'chin', dtl: soft });
  S.cone('jaw', [0, 3.66, -3.6], [0, 3.6, -4.35], 0.1, 0.04, { group: 1, k: 0.05, sub: true, col: C.mouth, tag: 'mouth' });
  // tail: long tapering whip, slightly flattened, ends in the blade socket
  const tp = [...J.tail, J.blade], tr = [0.5, 0.42, 0.35, 0.29, 0.23, 0.18, 0.14, 0.1, 0.075];
  S.cone('hips', [0, 2.1, 1.5], J.tail[1], 0.52, 0.44, { k: 0.26, col: C.flank, tag: 'tail', b2: 'tail1', t0: 0.3, t1: 0.9, dtl: hide });
  for (let i = 0; i < 8; i++) S.cone('tail' + (i + 1), tp[i], tp[i + 1], tr[i], tr[i + 1], { k: 0.14, col: C.flank, tag: 'tail', b2: i < 7 ? 'tail' + (i + 2) : undefined, t0: 0.65, t1: 1, dtl: hide });
  // hind legs: huge drumstick thighs, sinewy shins, long metatarsus, three-toed feet
  for (const [s, n] of SIDES) {
    const hip = X(J.hip, s), kn = X(J.knee, s), ho = X(J.hock, s), ba = X(J.ball, s);
    S.seg('thigh' + n, add(hip, [0.02 * s, 0.1, 0.1]), lerp3(hip, kn, 0.78), 0.4, 0.46, { k: 0.2, col: C.flank, tag: 'thigh', dtl: hide });
    S.cone('shin' + n, kn, ho, 0.24, 0.14, { k: 0.12, col: C.flank, tag: 'leg', b2: 'meta' + n, t0: 0.85, t1: 1, dtl: hide });
    S.ell('shin' + n, lerp3(kn, ho, 0.25), [0.2, 0.22, 0.3], { k: 0.12, col: C.flank, tag: 'calf', dtl: hide });
    S.cone('meta' + n, ho, ba, 0.14, 0.12, { k: 0.08, col: C.back, tag: 'leg', b2: 'foot' + n, t0: 0.85, t1: 1, dtl: hideS });
    S.ell('foot' + n, add(ba, [0, -0.02, -0.12]), [0.2, 0.12, 0.26], { k: 0.08, col: C.back, tag: 'foot', dtl: hideS });
    for (const dx of [-0.13, 0, 0.13]) S.cone('foot' + n, add(ba, [dx * s * 0.6, 0, -0.1]), add(ba, [dx * s * 1.4, -0.06, dx === 0 ? -0.58 : -0.46]), 0.085, 0.055, { k: 0.05, col: C.back, tag: 'toe', dtl: hideS });
    // wing arms: humerus, forearm, hand (fingers are lofted bones)
    const sh = X(J.sh, s), el = X(J.el, s), wr = X(J.wr, s), kk = X(J.kn, s);
    S.cone('wing0' + n, lerp3(sh, el, 0.12), el, 0.26, 0.17, { k: 0.12, col: C.back, tag: 'arm', b2: 'wing1' + n, t0: 0.88, t1: 1, dtl: hide });
    S.ell('wing0' + n, lerp3(sh, el, 0.4), [0.2, 0.22, 0.3], { k: 0.12, col: C.back, tag: 'arm', rot: [0, s * 1.2, 0], dtl: hide });
    S.cone('wing1' + n, el, wr, 0.17, 0.11, { k: 0.08, col: C.back, tag: 'arm', b2: 'wing2' + n, t0: 0.9, t1: 1, dtl: hideS });
    S.sph('wing2' + n, wr, 0.13, { k: 0.06, col: C.back, tag: 'wrist', dtl: hideS });
    S.cone('wing2' + n, wr, kk, 0.12, 0.1, { k: 0.06, col: C.back, tag: 'hand', dtl: hideS });
    S.sph('wing2' + n, kk, 0.12, { k: 0.05, col: C.stripe, tag: 'knuckle', dtl: hideS });
  }
}

function hsh(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

function paint(v) {
  const [x, y, z] = v.p, [nx, ny, nz] = v.n;
  const head = v.t('head') + v.t('snout') + v.t('cheek') + v.t('ridge') + v.t('brow') + v.t('lip');
  // dorsal dark saddle, pale belly
  const up = ny + Math.sin(z * 3.1 + x * 1.3) * 0.08;
  v.mix(C.back, sstep(0.05, 0.6, up) * (1 - head * 0.5) * (1 - v.t('throat')));
  v.mix(C.belly, sstep(-0.25, -0.7, up) * (1 - v.t('toe') - v.t('foot')));
  // dark tiger stripes across the back & tail (tapering down the flanks)
  const band = Math.abs(((z * 0.95 + Math.sin(x * 2.2) * 0.15) % 1 + 1) % 1 - 0.5) * 2;
  const stripeW = 0.34 * sstep(-0.35, 0.6, ny);
  const stripe = (1 - sstep(stripeW * 0.6, stripeW, band)) * (stripeW > 0.02 ? 1 : 0) * (v.t('body') + v.t('tail') + v.t('keel') + v.t('haunch') + v.t('thigh'));
  v.mix(C.stripe, Math.min(1, stripe) * 0.85);
  // frosted pale limb ends and wing arms (hoarfrost)
  v.mix(C.pale, (v.t('wrist') + v.t('knuckle')) * 0.25 + v.t('hand') * 0.2);
  // face: dark mask around the eyes, pale lips
  v.mix(C.stripe, v.t('socket') * 0.9 + v.t('brow') * 0.3);
  v.mix(C.pale, v.t('lip') * 0.55 + v.t('chin') * 0.4);
  // mouth interior
  if ((v.group === 1 && ny > 0.45 && z < -3.55) || v.t('mouth') > 0.4 || v.t('mouthroof') > 0.4) { v.mix(C.mouth, 0.9); v.kind = K.mouth; v.emis = 0.45 * sstep(-3.7, -4.3, -z); v.gm = 1; }
  // throat sac: glowing cracks between frosty scales, fading up the neck
  const thr = v.t('throat') * sstep(-0.1, -0.55, ny);
  if (thr > 0.05) {
    const cz = z * 5.2 + Math.sin(y * 7.0) * 0.4, cx = x * 6.0;
    const crack = 1 - sstep(0.04, 0.16, Math.abs(Math.sin(cz) * Math.cos(cx * 0.7 + cz * 0.3)));
    v.kind = K.mouth; v.gm = 1;
    v.emis = Math.max(v.emis, (0.25 + crack * 1.4) * thr);
    v.mix(C.throat, thr * 0.35);
  }
  // chest glow: faint veins over the breast (the frost heart)
  const brs = v.t('breast') * sstep(-0.2, -0.7, ny);
  if (brs > 0.05) { const n = Math.abs(Math.sin(x * 9 + z * 4) * Math.sin(z * 7 - y * 3)); v.emis = Math.max(v.emis, (1 - sstep(0.02, 0.1, n)) * brs * 0.7); v.kind = K.mouth; v.gm = 1; }
  v.mul(1 + Math.sin(x * 7 + z * 5) * Math.sin(y * 6) * 0.04);
}

// ---------------------------------------------------------------- rigid parts, crystals, membranes
function raycastOut(S, c, d, maxT = 4) {
  let t = 0, f = S.sdf(c[0], c[1], c[2], 0);
  if (f > 0) return 0;
  for (let i = 0; i < 80 && t < maxT; i++) {
    const tp = t; t += Math.max(Math.abs(f) * 0.8, 0.01);
    f = S.sdf(c[0] + d[0] * t, c[1] + d[1] * t, c[2] + d[2] * t, 0);
    if (f > 0) { let a = tp, b = t; for (let k = 0; k < 10; k++) { const m = (a + b) / 2; if (S.sdf(c[0] + d[0] * m, c[1] + d[1] * m, c[2] + d[2] * m, 0) > 0) b = m; else a = m; } return (a + b) / 2; }
  }
  return -1;
}

function parts({ acc, macc, S, rig: R, b }) {
  const lc = (a, bb, t) => { const A = new THREE.Color(a), B = new THREE.Color(bb); return [mix(A.r, B.r, t), mix(A.g, B.g, t), mix(A.b, B.b, t)]; };
  const skinAt = (p) => { const s = S.sampleAt(p[0], p[1], p[2]); return { si: s.si, sw: s.sw }; };
  // ---- crystal spines along the back (neck → tail): primary row + flanking shards
  const spinePts = [J.neck4, J.neck3, J.neck2, J.neck1, [0, 2.9, -0.9], [0, 2.8, 0.1], [0, 2.7, 1.0], ...J.tail.slice(0, 7)];
  const line = [];
  for (let i = 0; i < 16; i++) { const x = i / 15 * (spinePts.length - 1), k = Math.min(spinePts.length - 2, Math.floor(x)); line.push(lerp3(spinePts[k], spinePts[k + 1], x - k)); }
  const size = (i) => { const f = i / (line.length - 1); return f < 0.2 ? 0.55 + f * 2.2 : f < 0.55 ? 1.0 + 0.15 * Math.sin((f - 0.2) / 0.35 * Math.PI) : Math.max(0.3, 1.0 - (f - 0.55) * 1.5); };
  let seed = 3;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const hit = raycastOut(S, [c[0], c[1] - 0.1, c[2]], [0, 1, 0], 2.5);
    if (hit < 0) continue;
    const base = [c[0], c[1] - 0.1 + hit - 0.08, c[2]];
    const sz = size(i) * (0.9 + 0.2 * hsh(seed++));
    const lean = norm([0, 1, 0.55 + i * 0.02]);
    const sk = skinAt([base[0], base[1] - 0.15, base[2]]);
    const L = 0.75 * sz;
    acc.addRaw(crystal(base, lean, L, 0.12 * sz, 5, hsh(seed++) * 6), { skin: sk, kind: K.crystal, color: (t) => lc(C.crystal, C.crystalTip, Math.pow(t, 1.4)), emis: (t) => 0.05 + 0.6 * t * t * t, gm: 0.85, dtl: [0, 0, 0, 0] });
    if (sz > 0.6) for (const s of [-1, 1]) {
      const d2 = norm([0.55 * s, 0.85, 0.45]);
      const b2 = addS(base, [s, 0, 0], 0.1 * sz);
      acc.addRaw(crystal(b2, d2, L * 0.55, 0.075 * sz, 5, hsh(seed++) * 6), { skin: sk, kind: K.crystal, color: (t) => lc(C.crystal, C.crystalTip, t), emis: (t) => 0.04 + 0.5 * t * t * t, gm: 0.85, dtl: [0, 0, 0, 0] });
    }
  }
  // shoulder frost shards
  for (const [s, n] of SIDES) for (let k = 0; k < 3; k++) {
    const base = X([0.62 + k * 0.1, 2.95 - k * 0.05, -0.95 + k * 0.28], s);
    acc.addRaw(crystal(base, norm(X([0.6, 0.9, 0.45 + k * 0.2], s)), 0.5 - k * 0.1, 0.07, 5, k), { skin: skinAt(base), kind: K.crystal, color: (t) => lc(C.crystal, C.crystalTip, t), emis: (t) => 0.04 + 0.5 * t * t * t, gm: 0.85, dtl: [0, 0, 0, 0] });
  }
  // ---- crystal crown (breakable 'crest'): swept-back horns of ice from the brow + central crest
  const crest = b('crest'), head = b('head');
  for (const s of [-1, 1]) {
    const hb = [0.22 * s, 4.0, -3.55];
    const path = bezier([hb, [0.36 * s, 4.25, -3.2], [0.52 * s, 4.4, -2.45]], 10);
    acc.addRaw(loft(path, 7, taper(0.11, { pow: 1.1, flat: 0.75 }), [0, 1, 0]), { skin: rigid(crest), kind: K.crystal, color: (t) => lc(C.horn, C.crystalTip, t), emis: (t) => 0.1 + 0.8 * Math.pow(t, 3), gm: 0.9, dtl: [0, 0, 0.1, 0] });
    const p2 = bezier([[0.28 * s, 3.92, -3.4], [0.5 * s, 3.98, -3.15], [0.72 * s, 3.9, -2.75]], 7);
    acc.addRaw(loft(p2, 6, taper(0.07, { flat: 0.7 }), [0, 1, 0]), { skin: rigid(crest), kind: K.crystal, color: (t) => lc(C.horn, C.crystalTip, t), emis: (t) => 0.1 + 0.7 * t * t * t, gm: 0.9, dtl: [0, 0, 0, 0] });
    // jaw / cheek frills of ice
    for (let k = 0; k < 3; k++) {
      const cb = [0.3 * s, 3.72 - k * 0.08, -3.4 + k * 0.12];
      acc.addRaw(crystal(cb, norm([0.7 * s, -0.1 - k * 0.15, 0.7]), 0.36 - k * 0.07, 0.045, 5, k), { skin: rigid(head), kind: K.crystal, color: (t) => lc(C.crystal, C.crystalTip, t), emis: (t) => 0.05 + 0.6 * t * t, gm: 0.85, dtl: [0, 0, 0, 0] });
    }
  }
  for (let k = 0; k < 4; k++) {
    const cb = [0, 4.08 - k * 0.04, -3.62 + k * 0.2];
    acc.addRaw(crystal(cb, norm([0, 0.9, 0.7 + k * 0.1]), 0.55 - k * 0.07, 0.07, 5, k * 1.3), { skin: rigid(crest), kind: K.crystal, color: (t) => lc(C.crystal, C.crystalTip, t), emis: (t) => 0.12 + 0.9 * t * t * t, gm: 0.85, dtl: [0, 0, 0, 0] });
  }
  // nose horn
  acc.addRaw(loft(hornPath([0, 3.77, -4.25], [0, 1, -0.35], 0.22, [1, 0, 0], 0.6, 5), 6, taper(0.05, { flat: 0.7 }), [0, 0, -1]), { skin: rigid(head), kind: K.hard, color: (t) => lc(C.horn, C.hornTip, t), dtl: [0, 0, 0.1, 0] });
  // ---- eyes: glowing ice-white
  for (const s of [-1, 1]) {
    const e = eyeball([0.265 * s, 3.865, -3.84], 0.058, [0.8 * s, 0.1, -0.6], [0, 1, 0], 10);
    acc.addRaw(e, { skin: rigid(head), kind: K.eye, color: (t, p, n, uv) => { const d = Math.hypot(uv[0] - 0.5, uv[1] - 0.5); return d < 0.12 ? 0x06101c : d < 0.33 ? C.eye : 0x0a1422; }, emis: (t, p, uv) => { const d = Math.hypot(uv[0] - 0.5, uv[1] - 0.5); return t > 0 ? (d < 0.12 ? 0.3 : d < 0.33 ? 2.6 : 0) : 0; }, gm: 0.55, dtl: [0, 0, 0, 0] });
  }
  // ---- teeth
  const tooth = (base, dir, L, r, bone) => acc.addRaw(loft(hornPath(base, dir, L, [1, 0, 0], 0.2, 3), 5, taper(r, { pow: 0.9 }), [0, 0, -1]), { skin: rigid(bone), kind: K.hard, color: (t) => lc(C.toothBase, C.tooth, Math.min(1, t * 2)), dtl: [0, 0, 0, 0] });
  for (const s of [-1, 1]) for (let k = 0; k < 7; k++) {
    const f = k / 6, z = -3.66 - f * 0.82, xw = (0.17 - f * 0.08) * s;
    tooth([xw, 3.62, z], [0.05 * s, -1, 0.05], (k === 5 ? 0.16 : 0.08) + 0.02 * Math.sin(k * 2.1), 0.024, head);
    tooth([xw * 0.95, 3.6, z + 0.08], [0.04 * s, 1, 0.05], 0.07 + 0.02 * Math.sin(k * 1.7), 0.021, b('jaw'));
  }
  // ---- claws: feet, wrist thumbs, knuckle spurs
  const claw = (base, dir, L, r, bone, curl = -1.1) => acc.addRaw(loft(hornPath(base, dir, L, [1, 0, 0], curl, 5), 6, taper(r, { flat: 0.75, pow: 0.9 }), [0, 1, 0]), { skin: typeof bone === 'number' ? rigid(bone) : bone, kind: K.hard, color: (t) => lc(C.claw, C.clawTip, Math.pow(t, 1.6)), dtl: [0, 0, 0.1, 0] });
  for (const [s, n] of SIDES) {
    const ba = X(J.ball, s);
    for (const dx of [-0.13, 0, 0.13]) claw(add(ba, [dx * s * 1.45, -0.02, dx === 0 ? -0.58 : -0.46]), [dx * s, -0.25, -1], 0.26, 0.05, b('foot' + n));
    claw(add(X(J.hock, s), [0, 0.02, 0.12]), [0, 0.2, 1], 0.28, 0.05, b('meta' + n), 0.8); // dew spur
    const wr = X(J.wr, s), kk = X(J.kn, s);
    claw(add(wr, [0, 0.04, -0.1]), [0.1 * s, 0.1, -1], 0.42, 0.06, b('wing2' + n), -1.2); // thumb
    claw(add(kk, [0.05 * s, -0.05, 0]), [0.3 * s, -1, -0.1], 0.3, 0.06, b('wing2' + n), -0.6); // knuckle hook (ground contact)
    acc.addRaw(crystal(add(X(J.el, s), [0, 0.1, 0.1]), norm(X([0.4, 0.5, 0.8], s)), 0.5, 0.07, 5, 1), { skin: rigid(b('wing1' + n)), kind: K.crystal, color: (t) => lc(C.crystal, C.crystalTip, t), emis: (t) => 0.05 + 0.6 * t * t, gm: 0.85, dtl: [0, 0, 0, 0] });
  }
  // ---- tail blade (breakable 'tail'): a fan of crystal blades
  const blade = b('blade');
  const e = J.blade;
  for (let k = -2; k <= 2; k++) {
    const d = norm([k * 0.38, 0.12 + Math.abs(k) * 0.05, 1]);
    acc.addRaw(crystal(add(e, [k * 0.04, 0, -0.1]), d, 1.25 - Math.abs(k) * 0.22, 0.13 - Math.abs(k) * 0.02, 4, Math.PI / 4), { skin: rigid(blade), kind: K.crystal, color: (t) => lc(C.crystal, C.crystalTip, t), emis: (t) => 0.1 + 0.9 * t * t * t, gm: 0.85, dtl: [0, 0, 0, 0] });
  }
  acc.addRaw(crystal(add(e, [0, 0.1, 0]), norm([0, 1, 0.6]), 0.55, 0.08, 4, 0.3), { skin: rigid(blade), kind: K.crystal, color: (t) => lc(C.crystal, C.crystalTip, t), emis: (t) => 0.1 + 0.9 * t * t, gm: 0.85, dtl: [0, 0, 0, 0] });
  // tail frost fins (sides)
  for (let i = 3; i < 8; i++) for (const s of [-1, 1]) {
    const p = J.tail[i], r = [0.33, 0.28, 0.22, 0.17, 0.13, 0.1, 0.08, 0.06][i];
    const base = [s * r * 0.8, p[1] + 0.05, p[2] + 0.2];
    acc.addRaw(crystal(base, norm([s, 0.25, 0.9]), 0.3 - i * 0.02, 0.05, 4, 0), { skin: rigid(b('tail' + (i + 1))), kind: K.crystal, color: (t) => lc(C.crystal, C.crystalTip, t), emis: (t) => 0.03 + 0.4 * t * t, gm: 0.85, dtl: [0, 0, 0, 0] });
  }
  // ---- wing fingers (lofted, skinned across the two phalanges) + membranes
  for (const [s, n] of SIDES) {
    const kk = X(J.kn, s);
    const fa = [0, 1, 2].map(f => b(`f${f}a${n}`)), fb = [0, 1, 2].map(f => b(`f${f}b${n}`));
    const tips = J.ft.map(p => X(p, s)), mids = J.fm.map(p => X(p, s));
    const fingerPath = (f) => { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(t < 0.5 ? lerp3(kk, mids[f], t * 2) : lerp3(mids[f], tips[f], (t - 0.5) * 2)); } return pts; };
    const fW = (f, t) => { const k = sstep(0.42, 0.58, t); return skinMap({ [fa[f]]: 1 - k, [fb[f]]: k }); };
    for (let f = 0; f < 3; f++) {
      const r0 = 0.085 - f * 0.01;
      acc.addRaw(loft(fingerPath(f), 6, (t) => { const r = r0 * (1 - t * 0.8) * (1 + 0.35 * Math.exp(-((t - 0.5) ** 2) / 0.003)); return [r, r * 0.8]; }, [0, 1, 0]), {
        skin: (p, t) => fW(f, t), kind: K.skin, color: (t) => lc(C.back, C.pale, t * 0.5), dtl: [0, 0.2, 0.1, 0],
      });
      // tip talon of ice
      const tip = tips[f], d = norm(sub(tips[f], mids[f]));
      acc.addRaw(crystal(tip, d, 0.35, 0.04, 4, 0), { skin: rigid(fb[f]), kind: K.crystal, color: (t) => lc(C.crystal, C.crystalTip, t), emis: (t) => 0.1 + 0.9 * t * t, gm: 0.85, dtl: [0, 0, 0, 0] });
    }
    // finger panels (0-1, 1-2): scalloped trailing edge
    const poly = (f) => fingerPath(f);
    const at = (pts, t) => { const x = t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(x)); return lerp3(pts[i], pts[i + 1], x - i); };
    const up = [0, 1, 0];
    for (let f = 0; f < 2; f++) {
      const A = poly(f), B = poly(f + 1);
      const gap = dist(tips[f], tips[f + 1]);
      const scal = Math.min(0.32, 0.26 * gap / 2.2);
      const m = grid(8, 10, (u, v) => {
        const vv = v * (1 - scal * Math.sin(Math.PI * u));
        const p = lerp3(at(A, vv), at(B, vv), u);
        const sag = 0.1 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
        return addS(p, up, -sag);
      });
      macc.addRaw(m, {
        skin: (p, t, i) => { const u = m.uv[i * 2], v = m.uv[i * 2 + 1] * (1 - scal * Math.sin(Math.PI * m.uv[i * 2])); const wa = fW(f, v), wb = fW(f + 1, v); const mm = {}; wa.si.forEach((bi, k) => { mm[bi] = (mm[bi] || 0) + wa.sw[k] * (1 - u); }); wb.si.forEach((bi, k) => { mm[bi] = (mm[bi] || 0) + wb.sw[k] * u; }); return skinMap(mm); },
        kind: K.membrane, color: (t, p, nn, uv) => lc(C.membrane, C.memEdge, sstep(0.7, 1.0, uv[1]) * 0.85), emis: (t, p, uv) => sstep(0.88, 1.0, uv[1]) * 0.35, gm: 0.9, dtl: [0, 0, 0.15, 0],
      });
    }
    // body panel (Coons patch): arm (shoulder→elbow→wrist→knuckle) · finger 2 · trailing edge · flank
    const arm = [X(J.sh, s), X(J.el, s), X(J.wr, s), kk];
    const armPts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12 * 3, k = Math.min(2, Math.floor(t)); armPts.push(lerp3(arm[k], arm[k + 1], t - k)); }
    const flank = [];
    for (let k = 0; k <= 5; k++) {
      const f = k / 5, z = -0.8 + f * 2.1, y = 2.55 - f * 0.4;
      const c = [0, y, z], d = norm([s, 0.35, 0]);
      const h = raycastOut(S, c, d, 3);
      flank.push(k === 0 ? X(J.sh, s) : addS(c, d, (h > 0 ? h : 0.6) - 0.05));
    }
    const F2 = poly(2), Hp = flank[5], T2 = tips[2];
    const trailIn = norm(sub(lerp3(X(J.el, s), X(J.wr, s), 0.5), lerp3(Hp, T2, 0.5)));
    const tl = dist(T2, Hp);
    const C1 = (u) => addS(lerp3(Hp, T2, u), trailIn, 0.2 * tl * Math.sin(Math.PI * u));
    const flankW = flank.map(p => { const w = skinAt(p); const o = {}; w.si.forEach((bi, k) => { if (w.sw[k] > 0) o[bi] = (o[bi] || 0) + w.sw[k]; }); return o; });
    const armB = [b('wing0' + n), b('wing1' + n), b('wing2' + n)];
    const wAdd = (m, w, k) => { for (const key in w) m[key] = (m[key] || 0) + w[key] * k; return m; };
    const armW = (u) => { const t = u * 3, k = Math.min(2, Math.floor(t)), f = t - k; const o = {}; o[armB[k]] = 1 - f * 0.5; o[armB[Math.min(2, k + 1)]] = (o[armB[Math.min(2, k + 1)]] || 0) + f * 0.5; return o; };
    const flankAt = (v) => { const x = v * 5, i = Math.min(4, Math.floor(x)), f = x - i; return wAdd(wAdd({}, flankW[i], 1 - f), flankW[i + 1], f); };
    const f2W = (v) => { const w = fW(2, v); const o = {}; w.si.forEach((bi, k) => { o[bi] = (o[bi] || 0) + w.sw[k]; }); return o; };
    const S0 = armPts[0], W1 = armPts[12];
    const NU = 14, NV = 12;
    const mb = grid(NU, NV, (u, v) => {
      // u: flank (0) → finger 2 (1) ; v: arm (0) → trailing edge (1)
      const c0 = at(armPts, u), c1 = C1(u), d0 = at(flank, v), d1 = at(F2, v);
      const p = [0, 1, 2].map(k => (1 - v) * c0[k] + v * c1[k] + (1 - u) * d0[k] + u * d1[k] - ((1 - u) * (1 - v) * S0[k] + u * (1 - v) * W1[k] + (1 - u) * v * Hp[k] + u * v * T2[k]));
      const sag = 0.16 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
      return addS(p, up, -sag);
    });
    macc.addRaw(mb, {
      skin: (p, t, i) => {
        const u = mb.uv[i * 2], v = mb.uv[i * 2 + 1], e = 0.06;
        const wf = 1 / (v + e) ** 2, wb = 1 / (1 - v + e) ** 2, wl = 1 / (u + e) ** 2, wr = 1 / (1 - u + e) ** 2;
        const trail = wAdd(wAdd({}, flankAt(1), 1 - u), f2W(1), u);
        const m = {};
        wAdd(m, armW(u), wf); wAdd(m, trail, wb); wAdd(m, flankAt(v), wl); wAdd(m, f2W(v), wr);
        return skinMap(m);
      },
      kind: K.membrane, color: (t, p, nn, uv) => lc(C.membrane, C.memEdge, sstep(0.75, 1.0, uv[1]) * 0.85), emis: (t, p, uv) => sstep(0.9, 1.0, uv[1]) * 0.3, gm: 0.9, dtl: [0, 0, 0.15, 0],
      uv: (uv) => [uv[0], uv[1]],
    });
  }
}

// ---------------------------------------------------------------- definition
export const rimewing = {
  info: {
    name: 'Rimewing', title: 'Tyrant of the Frozen Sky', height: 4.4, radius: 3.2, flyHeight: 5.5, wingspan: 12,
    parts: ['wings', 'crest', 'tail'],
    actions: {
      idle: { dur: 4, hits: [], loop: true },
      walk: { dur: 1.35, hits: [], loop: true, speed: 3 },
      run: { dur: 0.95, hits: [], loop: true, speed: 7.5 },
      turn: { dur: 1.6, hits: [], loop: true, turn: 1.0 },
      intro: { dur: 6.0, hits: [3.35] },
      bite: { dur: 1.35, hits: [0.62] },
      claw: { dur: 1.6, hits: [0.86], counter: [0.25, 0.7] },
      tail_sweep: { dur: 2.1, hits: [1.0] },
      breath: { dur: 3.8, hits: [1.35, 1.75, 2.15, 2.55, 2.95] },
      takeoff: { dur: 2.4, hits: [0.8] },
      fly: { dur: 1.25, hits: [], loop: true },
      dive: { dur: 2.2, hits: [0.9], move: { dist: 16, t0: 0.35, t1: 1.3 } },
      pounce: { dur: 2.2, hits: [1.6], counter: [0.1, 1.05], move: { dist: 8, t0: 1.05, t1: 1.55 } },
      roar: { dur: 2.2, hits: [0.9] },
      channel: { dur: 2.0, hits: [1.0], loop: true },
      land: { dur: 2.0, hits: [1.15] },
      ice_spikes: { dur: 3.1, hits: [1.6, 2.15] },
      wing_gust: { dur: 2.5, hits: [1.2, 1.6] },
      groggy: { dur: 3.0, hits: [], loop: true },
      death: { dur: 3.6, hits: [], hold: true },
    },
  },
  config() { return { h: 0.068, ao: { dist: 0.1, str: 0.85 }, grad: { top: 0.12, bottom: 0.32, y0: 0, y1: 2.2, low: 0.2 }, dtl: [0, 0.3, 0.2, 0] }; },
  rig, sculpt, paint, dress: parts,
  look: { glow: 0x3cc8ff, glowI: 1.8, glow2: 0x9ff0ff, glow2I: 1.6, pulse: 1.8, dfreq: 1.15, memGlow: 0.3, enrage: 0xff4a2a },
  mat: { body: { rim: 0.35, rimColor: 0xcfeeff, spec: 0.5, shine: 30 }, membrane: { rim: 0.25, trans: 0.7 } },
  sockets: {
    head: ['head', [0, 4.05, -3.6]], mouth: ['head', [0, 3.6, -4.55]], chest: ['chest', [0, 2.2, -1.2]], back: ['body', [0, 3.0, 0]],
    handL: ['wing2L', [-4.0, 3.0, -1.0]], handR: ['wing2R', [4.0, 3.0, -1.0]], wingL: ['f1bL', [-5.8, 2.78, 0.85]], wingR: ['f1bR', [5.8, 2.78, 0.85]],
    weapon: ['tail8', [0, 1.45, 5.42]], weaponTip: ['blade', [0, 1.45, 6.95]], tail: ['blade', [0, 1.45, 6.4]],
    footL: ['footL', [-0.74, 0.05, 0.6]], footR: ['footR', [0.74, 0.05, 0.6]], crest: ['crest', [0, 4.3, -3.2]], throat: ['neck3', [0, 3.0, -2.5]],
  },
};
rimewing.breakable = {
  wings: { socket: 'wingL' },   // membranes tear (uTatter) — the game grounds her
  crest: { bone: 'crest', socket: 'crest' },
  tail: { bone: 'blade', socket: 'tail' },
};
rimewing.spec = rimewingSpec(J);
