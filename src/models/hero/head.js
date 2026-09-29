// Head sculpt definitions as SDF primitives in head-local space (origin = head bone, +Y up, -Z forward), plus the
// orthographic face-texture mapping shared with the face painter. One base definition per sex; face presets (0..5)
// vary jaw / chin / cheekbones / brow ridge / nose / lips / eye shape. The cranium never changes so hair and helmets
// fit every face. Eyes are real geometry (eyeball + upper-lid shell, see eyes.js) sitting in carved sockets.
import { rotEuler, rotAlign, mulR, SUB } from './sdf.js';
import { B } from './rig.js';

// Tags: 1 lips, 2 nose, 3 cheek, 4 ear, 5 eye socket, 6 brow ridge
const HM = {
  s: 0.99,
  cranium: { c: [0, 0.104, 0.016], r: [0.096, 0.112, 0.116] },
  back: { c: [0, 0.07, 0.05], r: [0.085, 0.085, 0.08] },
  mid: { c: [0, 0.058, -0.043], r: [0.07, 0.064, 0.068] },
  jaw: { c: [0, 0.004, -0.045], h: [0.057, 0.03, 0.05], rd: 0.024 },
  jawAngle: { c: [0.055, 0.002, -0.008], r: [0.016, 0.024, 0.024] },
  chin: { c: [0, -0.027, -0.088], r: [0.027, 0.023, 0.023] },
  cheek: { c: [0.048, 0.07, -0.078], r: [0.023, 0.014, 0.018] },
  zyg: { c: [0.074, 0.07, -0.042], r: [0.012, 0.011, 0.03] },
  brow: { c: [0, 0.1, -0.098], r: [0.066, 0.015, 0.02], k: 0.018 },
  browBone: { x: 0.033, y: 0.099, z: -0.101, r: [0.028, 0.012, 0.015] },
  eye: { x: 0.0345, y: 0.077, z: -0.1, sock: [0.021, 0.0108, 0.016], r: 0.0122, tilt: 0.0 },
  noseA: [0, 0.094, -0.106], noseB: [0, 0.051, -0.126], noseR: [0.0068, 0.0098], tip: 0.0108, tipY: 0.046, tipZ: -0.126, ala: [0.0084, 0.0072, 0.0078], alaX: 0.0098,
  lipU: { c: [0, 0.0165, -0.1], r: [0.0235, 0.0068, 0.0086] }, lipL: { c: [0, 0.0045, -0.097], r: [0.0195, 0.0074, 0.0088] },
  mouthW: 0.0225,
  ear: 'round', earC: [0.096, 0.068, 0.006],
  mouthY: 0.0105, browY: 0.1, lipTint: 0.65, scm: 1,
};
const HF = {
  ...HM, s: 0.96, vjaw: true, scm: 0.4,
  cranium: { c: [0, 0.104, 0.012], r: [0.094, 0.11, 0.113] },
  mid: { c: [0, 0.06, -0.042], r: [0.066, 0.062, 0.064] },
  jaw: { c: [0, 0.01, -0.042], h: [0.045, 0.026, 0.044], rd: 0.028 },
  jawAngle: { c: [0.045, 0.012, -0.012], r: [0.012, 0.018, 0.02] },
  chin: { c: [0, -0.02, -0.083], r: [0.021, 0.019, 0.019] },
  cheek: { c: [0.047, 0.071, -0.076], r: [0.025, 0.017, 0.021] },
  zyg: { c: [0.07, 0.072, -0.04], r: [0.01, 0.009, 0.026] },
  brow: { c: [0, 0.101, -0.095], r: [0.058, 0.011, 0.013], k: 0.02 },
  browBone: { x: 0.032, y: 0.1, z: -0.097, r: [0.024, 0.008, 0.01] },
  eye: { x: 0.034, y: 0.0775, z: -0.0975, sock: [0.0218, 0.0118, 0.0155], r: 0.0124, tilt: 0.06 },
  noseA: [0, 0.092, -0.103], noseB: [0, 0.052, -0.119], noseR: [0.0058, 0.0084], tip: 0.0102, tipY: 0.049, tipZ: -0.119, ala: [0.0078, 0.0068, 0.007], alaX: 0.0088,
  lipU: { c: [0, 0.0195, -0.094], r: [0.0205, 0.0074, 0.0086] }, lipL: { c: [0, 0.0075, -0.0915], r: [0.0185, 0.0088, 0.0092] },
  mouthW: 0.0195,
  lipTint: 1.3, mouthY: 0.0135, earC: [0.093, 0.068, 0.006],
};

// Face presets: structural deltas (multipliers / offsets on the base definition)
const FACES_M = [
  { name: 'Valiant' },
  { name: 'Rugged', jawW: 1.12, jawH: 1.08, chin: 1.18, brow: 1.35, nose: 1.14, noseBump: 0.003, cheek: 1.06 },
  { name: 'Youthful', jawW: 0.9, chin: 0.88, brow: 0.75, nose: 0.9, eyes: 1.08, vjaw: true, lips: 1.05 },
  { name: 'Noble', jawW: 0.95, chin: 1.06, cheek: 1.14, cheekY: 0.005, nose: 1.02, noseLen: 1.1, vjaw: true, eyes: 0.96 },
  { name: 'Veteran', jawW: 1.07, chin: 1.1, brow: 1.45, nose: 1.22, noseBend: 0.004, eyes: 0.92, lips: 0.92 },
  { name: 'Fierce', jawW: 1.02, chin: 1.14, cheek: 1.22, cheekY: 0.004, brow: 1.2, nose: 1.0, vjaw: true, tilt: 0.1 },
];
const FACES_F = [
  { name: 'Radiant' },
  { name: 'Gentle', cheek: 1.14, chin: 0.9, nose: 0.88, lips: 1.14, eyes: 1.06, jawW: 1.03 },
  { name: 'Keen', cheek: 1.18, cheekY: 0.006, jawW: 0.93, chin: 0.9, nose: 0.96, noseLen: 1.06, tilt: 0.14 },
  { name: 'Regal', jawW: 1.02, chin: 1.05, nose: 1.06, noseLen: 1.1, brow: 1.1, lips: 0.96 },
  { name: 'Valkyrie', jawW: 1.1, jawH: 1.06, chin: 1.08, brow: 1.25, cheek: 1.06, lips: 0.94, eyes: 0.96 },
  { name: 'Sprite', jawW: 0.92, chin: 0.84, nose: 0.84, eyes: 1.1, lips: 1.06, tilt: 0.08 },
];
export const FACE_PRESETS = { m: FACES_M.map(f => f.name), f: FACES_F.map(f => f.name) };

const HEAD_DEF_CACHE = new Map();
export function headDef(sex, face = 0) {
  const key = sex + face;
  if (HEAD_DEF_CACHE.has(key)) return HEAD_DEF_CACHE.get(key);
  const base = sex === 'f' ? HF : HM;
  const V = (sex === 'f' ? FACES_F : FACES_M)[((face | 0) % 6 + 6) % 6];
  const d = JSON.parse(JSON.stringify(base));
  const jw = V.jawW ?? 1, jh = V.jawH ?? 1, ch = V.chin ?? 1, br = V.brow ?? 1, no = V.nose ?? 1, cheek = V.cheek ?? 1, lips = V.lips ?? 1;
  d.jaw.h = [d.jaw.h[0] * jw, d.jaw.h[1] * jh, d.jaw.h[2]];
  d.jawAngle.c = [d.jawAngle.c[0] * jw, d.jawAngle.c[1], d.jawAngle.c[2]];
  d.chin.r = d.chin.r.map(v => v * ch); d.chin.c = [0, d.chin.c[1] - (ch - 1) * 0.02, d.chin.c[2] - (ch - 1) * 0.012];
  d.brow.r = [d.brow.r[0], d.brow.r[1] * br, d.brow.r[2] * br];
  d.browBone.r = [d.browBone.r[0], d.browBone.r[1] * br, d.browBone.r[2] * Math.sqrt(br)];
  d.noseR = d.noseR.map(v => v * no); d.tip *= no; d.ala = d.ala.map(v => v * no);
  if (V.noseLen) { d.noseB = [0, d.noseB[1] - (V.noseLen - 1) * 0.03, d.noseB[2] - (V.noseLen - 1) * 0.01]; d.tipY -= (V.noseLen - 1) * 0.03; d.tipZ -= (V.noseLen - 1) * 0.008; }
  if (V.noseBend) d.noseB = [V.noseBend, d.noseB[1], d.noseB[2]];
  if (V.noseBump) d.noseBump = V.noseBump;
  d.cheek.r = d.cheek.r.map(v => v * cheek); d.cheek.c = [d.cheek.c[0], d.cheek.c[1] + (V.cheekY ?? 0), d.cheek.c[2]];
  d.lipU.r = d.lipU.r.map(v => v * lips); d.lipL.r = d.lipL.r.map(v => v * lips); d.mouthW *= Math.sqrt(lips);
  if (V.eyes) d.eye.sock = d.eye.sock.map(v => v * V.eyes);
  if (V.tilt != null) d.eye.tilt = V.tilt;
  if (V.vjaw) d.vjaw = true;
  d.face = face; d.preset = V.name;
  HEAD_DEF_CACHE.set(key, d);
  return d;
}

/** eyeball centre in head-local space (front of the eyeball sits just behind the lid rim) */
export function eyeCenter(d, sg) { return [sg * d.eye.x, d.eye.y, d.eye.z + d.eye.r * 0.95]; }

const sc = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export function faceMapping(P, J) {
  const d = P.headDef, s = d.s;
  const w = 0.17 * s;
  const m = { x0: -0.085 * s, y0: -0.055 * s, w, zCut: -0.015 * s };
  const uv = (x, y) => [(x * s - m.x0) / w, (y * s - m.y0) / w];
  m.lm = {
    eyeL: uv(-d.eye.x, d.eye.y), eyeR: uv(d.eye.x, d.eye.y), eyeW: d.eye.sock[0] * s / w, eyeH: d.eye.sock[1] * s / w, tilt: d.eye.tilt,
    brow: uv(0, d.browY ?? 0.1)[1], nose: uv(0, d.tipY), mouth: uv(0, d.mouthY ?? 0.009), chin: uv(0, d.chin.c[1]),
    jawW: d.jaw.h[0] * s / w, mouthW: d.mouthW * s / w, lipU: uv(0, d.lipU.c[1])[1], lipL: uv(0, d.lipL.c[1])[1],
    lipTop: uv(0, d.lipU.c[1] + d.lipU.r[1] * 1.05)[1], lipBot: uv(0, d.lipL.c[1] - d.lipL.r[1] * 1.1)[1], lipMid: uv(0, (d.lipU.c[1] - d.lipU.r[1] * 0.8 + d.lipL.c[1] + d.lipL.r[1] * 0.8) * 0.5)[1],
    browLine: uv(0, d.eye.y + d.eye.sock[1] + 0.0085)[1],
  };
  return m;
}

/** Adds head primitives to master (weights) and headZone (meshing, may be null) SDFs, in bind space. */
export function buildHeadPrims(master, headZone, P, J, d = P.headDef) {
  const s = d.s, H = J.head;
  const hp = p => add(H, sc(p, s));
  const both = fn => { fn(master); if (headZone) fn(headZone); };
  const hz = fn => { if (headZone) fn(headZone); };
  const bh = B.head;
  const neckA = add(J.neck, [0, -0.045, 0.012]), neckB = add(J.head, [0, 0.03, 0.01]);
  hz(z => z.cone(neckA, neckB, P.neckR * 1.02, P.neckR * 0.92, { bone: B.neck, k: 0.035 }));
  // neck muscles (sternocleidomastoid): behind the ear → sternal notch
  if (d.scm) for (const sg of [-1, 1]) hz(z => z.cone(hp([sg * 0.055, 0.03, 0.03]), add(J.neck, [sg * 0.018, -0.03, -P.neckR * 0.72]), 0.013 * d.scm + 0.004, 0.009 * d.scm + 0.003, { bone: B.neck, k: 0.02 }));
  // cranium & face masses
  both(z => z.ell(hp(d.cranium.c), sc(d.cranium.r, s), { bone: bh, k: 0.03 }));
  both(z => z.ell(hp(d.back.c), sc(d.back.r, s), { bone: bh, k: 0.03 }));
  both(z => z.ell(hp(d.mid.c), sc(d.mid.r, s), { bone: bh, k: 0.03 }));
  if (d.vjaw) {
    const jc = d.jaw.c, jh = d.jaw.h;
    const chinP = [0, d.chin.c[1] + 0.014, d.chin.c[2] + 0.012];
    for (const sg of [-1, 1]) both(z => z.cone(hp([sg * jh[0], jc[1] + 0.012, jc[2] + jh[2] * 0.55]), hp(chinP), d.jaw.rd * s * 1.05, d.jaw.rd * s * 0.78, { bone: bh, k: 0.03 }));
    both(z => z.ell(hp([0, jc[1] + 0.004, jc[2] - 0.01]), sc([jh[0] * 0.8, jh[1] * 0.9, jh[2] * 0.85], s), { bone: bh, k: 0.03 }));
  } else both(z => z.box(hp(d.jaw.c), sc(d.jaw.h, s), d.jaw.rd * s, { bone: bh, k: 0.026, rot: rotEuler(-0.12, 0, 0) }));
  for (const sg of [-1, 1]) both(z => z.ell(hp([sg * d.jawAngle.c[0], d.jawAngle.c[1], d.jawAngle.c[2]]), sc(d.jawAngle.r, s), { bone: bh, k: 0.018 }));
  both(z => z.ell(hp(d.chin.c), sc(d.chin.r, s), { bone: bh, k: 0.018 }));
  for (const sg of [-1, 1]) {
    both(z => z.ell(hp([sg * d.cheek.c[0], d.cheek.c[1], d.cheek.c[2]]), sc(d.cheek.r, s), { bone: bh, k: 0.018, tag: 3 }));
    both(z => z.ell(hp([sg * d.zyg.c[0], d.zyg.c[1], d.zyg.c[2]]), sc(d.zyg.r, s), { bone: bh, k: 0.016, tag: 3, rot: rotEuler(0, -sg * 0.5, 0) }));
  }
  // brow: soft central band + two brow bones over the eyes, glabella dip between them
  both(z => z.ell(hp(d.brow.c), sc(d.brow.r, s), { bone: bh, k: d.brow.k * s, rot: rotEuler(-0.2, 0, 0) }));
  for (const sg of [-1, 1]) both(z => z.ell(hp([sg * d.browBone.x, d.browBone.y, d.browBone.z]), sc(d.browBone.r, s), { bone: bh, k: 0.012 * s, tag: 6, rot: mulR(rotEuler(-0.25, 0, 0), rotEuler(0, 0, -sg * 0.18)) }));
  // eyes: carve the socket (the eyeball fills it), then the upper-lid fold and a soft lower lid
  for (const sg of [-1, 1]) {
    const e = d.eye, ec = eyeCenter(d, sg);
    hz(z => z.ell(hp([sg * e.x, e.y + 0.0005, e.z - 0.006]), sc([e.sock[0], e.sock[1], 0.014], s), { op: SUB, k: 0.006 * s, tag: 5, bone: bh, rot: rotEuler(0, 0, -sg * e.tilt) }));
    hz(z => z.sphere(hp(ec), e.r * s * 0.9, { op: SUB, k: 0.003 * s, tag: 5, bone: bh }));
    hz(z => z.ell(hp([sg * e.x, e.y + e.sock[1] * 0.78, e.z + 0.0035]), sc([e.sock[0] * 0.95, 0.006, 0.0105], s), { k: 0.0055 * s, tag: 5, bone: bh, rot: rotEuler(0.25, 0, -sg * e.tilt) }));
    hz(z => z.ell(hp([sg * e.x, e.y - e.sock[1] * 0.9, e.z + 0.004]), sc([e.sock[0] * 0.82, 0.0045, 0.008], s), { k: 0.005 * s, tag: 5, bone: bh, rot: rotEuler(-0.3, 0, -sg * e.tilt) }));
  }
  // nose: bridge, tip, alae (nostril wings), optional bump
  both(z => z.cone(hp(d.noseA), hp(d.noseB), d.noseR[0] * s, d.noseR[1] * s, { bone: bh, k: 0.011 * s, tag: 2 }));
  if (d.noseBump) both(z => z.sphere(hp([d.noseB[0] * 0.5, (d.noseA[1] + d.noseB[1]) * 0.5 + 0.004, (d.noseA[2] + d.noseB[2]) * 0.5 - 0.004]), (d.noseR[0] + d.noseBump) * s, { bone: bh, k: 0.006 * s, tag: 2 }));
  both(z => z.sphere(hp([d.noseB[0], d.tipY, d.tipZ]), d.tip * s, { bone: bh, k: 0.008 * s, tag: 2 }));
  for (const sg of [-1, 1]) {
    both(z => z.ell(hp([d.noseB[0] + sg * d.alaX, d.tipY - 0.005, d.tipZ + 0.009]), sc(d.ala, s), { bone: bh, k: 0.005 * s, tag: 2 }));
    hz(z => z.sphere(hp([d.noseB[0] + sg * d.alaX * 0.62, d.tipY - 0.0105, d.tipZ + 0.005]), 0.0028 * s, { op: SUB, k: 0.003 * s, bone: bh, tag: 2 }));
  }
  // mouth: lips with a parting crease, philtrum groove, deep corners, nasolabial folds
  both(z => z.ell(hp(d.lipU.c), sc(d.lipU.r, s), { bone: bh, k: 0.006 * s, tag: 1 }));
  for (const sg of [-1, 1]) both(z => z.ell(hp([sg * d.lipU.r[0] * 0.42, d.lipU.c[1] + 0.001, d.lipU.c[2] - 0.001]), sc([d.lipU.r[0] * 0.5, d.lipU.r[1] * 0.95, d.lipU.r[2]], s), { bone: bh, k: 0.005 * s, tag: 1 }));
  both(z => z.ell(hp(d.lipL.c), sc(d.lipL.r, s), { bone: bh, k: 0.006 * s, tag: 1 }));
  const my = (d.lipU.c[1] - d.lipU.r[1] * 0.8 + d.lipL.c[1] + d.lipL.r[1] * 0.8) * 0.5;
  hz(z => z.ell(hp([0, my, d.lipU.c[2] - 0.006]), sc([d.mouthW, 0.0012, 0.009], s), { op: SUB, k: 0.0025 * s, bone: bh, tag: 1 }));
  hz(z => z.cone(hp([0, d.tipY - 0.012, d.tipZ + 0.012]), hp([0, d.lipU.c[1] + 0.006, d.lipU.c[2] - 0.006]), 0.0022 * s, 0.0026 * s, { op: SUB, k: 0.004 * s, bone: bh }));
  for (const sg of [-1, 1]) {
    hz(z => z.sphere(hp([sg * d.mouthW * 1.02, my, d.lipU.c[2] + 0.006]), 0.0036 * s, { op: SUB, k: 0.004 * s, bone: bh, tag: 1 }));
    both(z => z.ell(hp([sg * (d.alaX + 0.013), (d.tipY + my) * 0.5, d.lipU.c[2] + 0.004]), sc([0.006, 0.017, 0.007], s), { bone: bh, k: 0.008 * s, rot: rotEuler(0, 0, sg * 0.35) }));
  }
  // ears
  for (const sg of [-1, 1]) {
    const c = hp([sg * d.earC[0], d.earC[1], d.earC[2]]);
    both(z => z.ell(c, sc([0.012, 0.031, 0.02], s), { bone: bh, k: 0.008 * s, tag: 4, rot: rotEuler(-0.25, sg * 0.35, 0) }));
    hz(z => z.ell(add(c, sc([sg * 0.006, 0.002, -0.002], s)), sc([0.006, 0.02, 0.012], s), { op: SUB, k: 0.004 * s, bone: bh, tag: 4, rot: rotEuler(-0.25, sg * 0.35, 0) }));
  }
  // clip the head zone at the neck base (cap hidden inside the torso)
  const t = 0.35, cutY = J.neck[1] - 0.034;
  hz(z => z.plane([0, -1, t], -cutY + t * J.neck[2]));
}
