// Head sculpt definitions as SDF primitives in head-local space (origin = head bone, +Y up, -Z forward), plus the
// orthographic face-texture mapping shared with the face painter. One base definition per sex; face presets (0..5)
// vary jaw / chin / cheekbones / brow / nose / lips / eye placement. The cranium never changes so hair and helmets fit
// every face.
import { rotEuler, rotAlign, SUB } from './sdf.js';
import { B } from './rig.js';

// Tags: 1 lips, 2 nose, 3 cheek, 4 ear, 5 eye socket
const HM = {
  s: 0.99,
  cranium: { c: [0, 0.104, 0.016], r: [0.096, 0.112, 0.116] },
  back: { c: [0, 0.07, 0.05], r: [0.085, 0.085, 0.08] },
  mid: { c: [0, 0.058, -0.046], r: [0.079, 0.068, 0.07] },
  jaw: { c: [0, 0.004, -0.045], h: [0.059, 0.031, 0.05], rd: 0.026 },
  chin: { c: [0, -0.026, -0.089], r: [0.028, 0.024, 0.024] },
  cheek: { c: [0.05, 0.066, -0.078], r: [0.028, 0.019, 0.023] },
  brow: { c: [0, 0.1, -0.098], r: [0.066, 0.017, 0.021], k: 0.02 },
  eye: { x: 0.035, y: 0.076, z: -0.1, sock: [0.021, 0.014, 0.016], ball: 0.0155 },
  noseA: [0, 0.095, -0.108], noseB: [0, 0.047, -0.127], noseR: [0.0082, 0.0115], tip: 0.013, tipY: 0.044, tipZ: -0.126, ala: [0.0102, 0.0088, 0.0092], alaX: 0.0112,
  lipU: { c: [0, 0.016, -0.1], r: [0.024, 0.0072, 0.0088] }, lipL: { c: [0, 0.004, -0.097], r: [0.02, 0.0076, 0.0088] },
  ear: 'round', earC: [0.096, 0.068, 0.006],
  mouthY: 0.009, browY: 0.1, lipTint: 0.75,
};
const HF = {
  ...HM, s: 0.96, vjaw: true,
  cranium: { c: [0, 0.104, 0.012], r: [0.094, 0.11, 0.113] },
  mid: { c: [0, 0.06, -0.044], r: [0.073, 0.064, 0.066] },
  jaw: { c: [0, 0.01, -0.042], h: [0.045, 0.026, 0.044], rd: 0.028 },
  chin: { c: [0, -0.02, -0.083], r: [0.022, 0.02, 0.02] },
  cheek: { c: [0.047, 0.07, -0.075], r: [0.026, 0.018, 0.022] },
  brow: { c: [0, 0.1, -0.095], r: [0.06, 0.012, 0.014], k: 0.02 },
  eye: { x: 0.034, y: 0.077, z: -0.098, sock: [0.021, 0.014, 0.015], ball: 0.0155 },
  noseA: [0, 0.092, -0.104], noseB: [0, 0.05, -0.12], noseR: [0.0066, 0.009], tip: 0.0105, tipY: 0.048, tipZ: -0.119, ala: [0.0082, 0.0072, 0.0072], alaX: 0.0092,
  lipU: { c: [0, 0.019, -0.094], r: [0.021, 0.0075, 0.0082] }, lipL: { c: [0, 0.007, -0.092], r: [0.019, 0.0085, 0.0085] },
  lipTint: 1.35, mouthY: 0.012, earC: [0.093, 0.068, 0.006],
};

// Face presets: small structural deltas (multipliers / offsets on the base definition)
const FACES_M = [
  { name: 'Valiant' },
  { name: 'Rugged', jawW: 1.1, jawH: 1.08, chin: 1.15, brow: 1.25, nose: 1.15, cheek: 1.05 },
  { name: 'Youthful', jawW: 0.92, chin: 0.88, brow: 0.8, nose: 0.9, eyes: 1.06, vjaw: true },
  { name: 'Noble', jawW: 0.96, chin: 1.05, cheek: 1.12, cheekY: 0.006, nose: 1.05, noseLen: 1.08, vjaw: true },
  { name: 'Veteran', jawW: 1.06, chin: 1.08, brow: 1.35, nose: 1.2, noseBend: 0.004, eyes: 0.95 },
  { name: 'Fierce', jawW: 1.02, chin: 1.12, cheek: 1.18, cheekY: 0.004, brow: 1.15, nose: 1.0, vjaw: true },
];
const FACES_F = [
  { name: 'Radiant' },
  { name: 'Gentle', cheek: 1.12, chin: 0.92, nose: 0.9, lips: 1.12, eyes: 1.04 },
  { name: 'Keen', cheek: 1.16, cheekY: 0.006, jawW: 0.94, chin: 0.9, nose: 0.96, noseLen: 1.05 },
  { name: 'Regal', jawW: 1.02, chin: 1.04, nose: 1.06, noseLen: 1.1, brow: 1.1 },
  { name: 'Valkyrie', jawW: 1.08, jawH: 1.05, chin: 1.08, brow: 1.2, cheek: 1.05, lips: 0.94 },
  { name: 'Sprite', jawW: 0.92, chin: 0.85, nose: 0.86, eyes: 1.1, lips: 1.05 },
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
  d.chin.r = d.chin.r.map(v => v * ch); d.chin.c = [0, d.chin.c[1] - (ch - 1) * 0.02, d.chin.c[2] - (ch - 1) * 0.012];
  d.brow.r = [d.brow.r[0], d.brow.r[1] * br, d.brow.r[2] * br];
  d.noseR = d.noseR.map(v => v * no); d.tip *= no; d.ala = d.ala.map(v => v * no);
  if (V.noseLen) { d.noseB = [0, d.noseB[1] - (V.noseLen - 1) * 0.03, d.noseB[2] - (V.noseLen - 1) * 0.01]; d.tipY -= (V.noseLen - 1) * 0.03; d.tipZ -= (V.noseLen - 1) * 0.008; }
  if (V.noseBend) d.noseB = [V.noseBend, d.noseB[1], d.noseB[2]];
  d.cheek.r = d.cheek.r.map(v => v * cheek); d.cheek.c = [d.cheek.c[0], d.cheek.c[1] + (V.cheekY ?? 0), d.cheek.c[2]];
  d.lipU.r = d.lipU.r.map(v => v * lips); d.lipL.r = d.lipL.r.map(v => v * lips);
  if (V.eyes) d.eye.sock = d.eye.sock.map(v => v * V.eyes);
  if (V.vjaw) d.vjaw = true;
  d.face = face; d.preset = V.name;
  HEAD_DEF_CACHE.set(key, d);
  return d;
}

const sc = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export function faceMapping(P, J) {
  const d = P.headDef, s = d.s;
  const w = 0.17 * s;
  const m = { x0: -0.085 * s, y0: -0.055 * s, w, zCut: -0.015 * s };
  const uv = (x, y) => [(x * s - m.x0) / w, (y * s - m.y0) / w];
  m.lm = {
    eyeL: uv(-d.eye.x, d.eye.y), eyeR: uv(d.eye.x, d.eye.y), eyeW: d.eye.sock[0] * s / w,
    brow: uv(0, d.browY ?? 0.1)[1], nose: uv(0, d.tipY), mouth: uv(0, d.mouthY ?? 0.009), chin: uv(0, d.chin.c[1]),
    jawW: d.jaw.h[0] * s / w,
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
  both(z => z.ell(hp(d.cranium.c), sc(d.cranium.r, s), { bone: bh, k: 0.03 }));
  both(z => z.ell(hp(d.back.c), sc(d.back.r, s), { bone: bh, k: 0.03 }));
  both(z => z.ell(hp(d.mid.c), sc(d.mid.r, s), { bone: bh, k: 0.03 }));
  if (d.vjaw) {
    const jc = d.jaw.c, jh = d.jaw.h;
    const chinP = [0, d.chin.c[1] + 0.014, d.chin.c[2] + 0.012];
    for (const sg of [-1, 1]) both(z => z.cone(hp([sg * jh[0], jc[1] + 0.012, jc[2] + jh[2] * 0.55]), hp(chinP), d.jaw.rd * s * 1.05, d.jaw.rd * s * 0.78, { bone: bh, k: 0.03 }));
    both(z => z.ell(hp([0, jc[1] + 0.004, jc[2] - 0.01]), sc([jh[0] * 0.8, jh[1] * 0.9, jh[2] * 0.85], s), { bone: bh, k: 0.03 }));
  } else both(z => z.box(hp(d.jaw.c), sc(d.jaw.h, s), d.jaw.rd * s, { bone: bh, k: 0.03, rot: rotEuler(-0.12, 0, 0) }));
  both(z => z.ell(hp(d.chin.c), sc(d.chin.r, s), { bone: bh, k: 0.02 }));
  for (const sg of [-1, 1]) both(z => z.ell(hp([sg * d.cheek.c[0], d.cheek.c[1], d.cheek.c[2]]), sc(d.cheek.r, s), { bone: bh, k: 0.02, tag: 3 }));
  both(z => z.ell(hp(d.brow.c), sc(d.brow.r, s), { bone: bh, k: d.brow.k * s, rot: rotEuler(-0.2, 0, 0) }));
  for (const sg of [-1, 1]) {
    const e = d.eye;
    hz(z => z.ell(hp([sg * e.x, e.y + 0.001, e.z - 0.012]), sc([e.sock[0], e.sock[1] * 0.9, 0.009], s), { op: SUB, k: 0.012 * s, tag: 5, bone: bh }));
    hz(z => z.ell(hp([sg * e.x, e.y - 0.001, e.z - 0.003]), sc([e.sock[0] * 0.8, e.sock[1] * 0.62, 0.006], s), { k: 0.008 * s, tag: 5, bone: bh }));
  }
  both(z => z.cone(hp(d.noseA), hp(d.noseB), d.noseR[0] * s, d.noseR[1] * s, { bone: bh, k: 0.012 * s, tag: 2 }));
  both(z => z.sphere(hp([d.noseB[0], d.tipY, d.tipZ]), d.tip * s, { bone: bh, k: 0.008 * s, tag: 2 }));
  for (const sg of [-1, 1]) both(z => z.ell(hp([d.noseB[0] + sg * d.alaX, d.tipY - 0.005, d.tipZ + 0.009]), sc(d.ala, s), { bone: bh, k: 0.006 * s, tag: 2 }));
  both(z => z.ell(hp(d.lipU.c), sc(d.lipU.r, s), { bone: bh, k: 0.007 * s, tag: 1 }));
  both(z => z.ell(hp(d.lipL.c), sc(d.lipL.r, s), { bone: bh, k: 0.007 * s, tag: 1 }));
  for (const sg of [-1, 1]) {
    const c = hp([sg * d.earC[0], d.earC[1], d.earC[2]]);
    both(z => z.ell(c, sc([0.012, 0.031, 0.02], s), { bone: bh, k: 0.008 * s, tag: 4, rot: rotEuler(-0.25, sg * 0.35, 0) }));
  }
  // clip the head zone at the neck base (cap hidden inside the torso)
  const t = 0.35, cutY = J.neck[1] - 0.034;
  hz(z => z.plane([0, -1, t], -cutY + t * J.neck[2]));
}
