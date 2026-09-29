// Kurai the Pyrefox — nine-tailed fire fox guardian (~5 m to the ear tips, 6 m nose to rump). Elegant and agile:
// ivory-gold fur, charcoal "socks" and ear backs, a white kitsune face with crimson mask markings and a glowing flame
// sigil on the brow, and nine tails that turn from fur into living flame (opaque emissive core + additive flame
// shell). createBoss('kurai', { clone: true }) builds the translucent flame copy used by the 'clone' mechanic.
import * as THREE from 'three';
import { sstep, mix } from '../../kit/rig.js';
import { K, rigid, skinMap } from './core/acc.js';
import { col } from '../../kit/sdf.js';
import { norm, add, sub, addS, lerp3, bezier, hornPath, taper, loft, eyeball, dist } from './core/geo.js';
import { leafGeo } from '../../kit/geo.js';
import { kuraiSpec } from './kurai_anim.js';

const C = {
  fur: 0xf0dcc0, gold: 0xe0a456, cream: 0xfff4e4, sock: 0x241616, dark: 0x3a2420, earIn: 0xd04a3a,
  mask: 0xfaf4ec, red: 0xc0142c, eye: 0xffd070, nose: 0x140c0c, mouth: 0x5a1010, claw: 0x1a1210, clawTip: 0x6a5048,
  tailFur: 0xfff0dc,
};

// the head is modelled at fox proportions and scaled up around its pivot (noble, readable face at iso distance)
const HP = [0, 4.1, -2.4], HS = 1.22;
const hx = (p) => [HP[0] + (p[0] - HP[0]) * HS, HP[1] + (p[1] - HP[1]) * HS, HP[2] + (p[2] - HP[2]) * HS];
const hr = (r) => r * HS;
const hinv = (p) => [HP[0] + (p[0] - HP[0]) / HS, HP[1] + (p[1] - HP[1]) / HS, HP[2] + (p[2] - HP[2]) / HS];
export const J = {
  body: [0, 2.7, 0.1], chest: [0, 2.8, -0.9], hips: [0, 2.75, 1.15],
  neck1: [0, 3.15, -1.55], neck2: [0, 3.72, -2.0], head: [0, 4.12, -2.36], jaw: hx([0, 3.9, -2.55]),
  ear: hx([0.34, 4.38, -2.22]), earTip: hx([0.62, 5.25, -2.02]),
  fU: [0.46, 2.55, -1.05], fL: [0.5, 1.52, -0.82], fP: [0.5, 0.4, -1.08], fToe: [0.5, 0, -1.42],
  rT: [0.48, 2.6, 1.3], rS: [0.55, 1.72, 0.72], rM: [0.52, 0.78, 1.55], rP: [0.52, 0.24, 1.36], rToe: [0.52, 0, 1.02],
  tailRoot: [0, 2.95, 1.75],
};
export const NT = 9, TB = 4;
const X = (p, s) => [p[0] * s, p[1], p[2]];
const SIDES = [[-1, 'L'], [1, 'R']];

// rest layout of the nine tails: a fan behind and above the rump, centre tails highest and longest
export function tailCurve(i) {
  const a = (i - 4) / 4 * 1.2, e = 0.42 + 0.3 * (1 - Math.abs(i - 4) / 4);
  const L = 4.3 - Math.abs(i - 4) * 0.12;
  const d = [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
  const R = add(J.tailRoot, [Math.sin(a) * 0.12, 0, 0.1]);
  const P1 = addS(R, d, L * 0.55);
  const P2 = add(addS(R, d, L * 0.72), [Math.sin(a) * 0.35 * L * 0.2, L * 0.34, 0]);
  return { pts: bezier([R, P1, P2], 24), L, a, e };
}
const TAILS = Array.from({ length: NT }, (_, i) => tailCurve(i));
const tailAt = (i, s) => { const P = TAILS[i].pts, x = s * (P.length - 1), k = Math.min(P.length - 2, Math.floor(x)); return lerp3(P[k], P[k + 1], x - k); };
export const TS = [0, 0.26, 0.52, 0.76]; // bone joints along each tail (arc fraction)

function rig(R) {
  R.add('body', null, J.body);
  R.add('chest', 'body', J.chest); R.add('hips', 'body', J.hips);
  R.add('neck1', 'chest', J.neck1); R.add('neck2', 'neck1', J.neck2); R.add('head', 'neck2', J.head); R.add('jaw', 'head', J.jaw);
  R.add('earL', 'head', X(J.ear, -1)); R.add('earR', 'head', X(J.ear, 1));
  for (const [s, n] of SIDES) {
    R.add('fU' + n, 'chest', X(J.fU, s)); R.add('fL' + n, 'fU' + n, X(J.fL, s)); R.add('fP' + n, 'fL' + n, X(J.fP, s));
    R.add('rT' + n, 'hips', X(J.rT, s)); R.add('rS' + n, 'rT' + n, X(J.rS, s)); R.add('rM' + n, 'rS' + n, X(J.rM, s)); R.add('rP' + n, 'rM' + n, X(J.rP, s));
  }
  R.add('tailRoot', 'hips', J.tailRoot);
  for (let i = 0; i < NT; i++) for (let j = 0; j < TB; j++) R.add(`t${i}_${j}`, j ? `t${i}_${j - 1}` : 'tailRoot', tailAt(i, TS[j]));
}

const fur = [0.42, 0, 0.12, 0], furS = [0.28, 0, 0.1, 0], skinD = [0, 0, 0.1, 0];
function sculpt(S) {
  // torso: deep narrow chest, tucked waist, compact haunches
  S.ell('chest', [0, 2.72, -0.85], [0.56, 0.72, 0.85], { k: 0.25, col: C.fur, tag: 'body', dtl: fur });
  S.ell('chest', [0, 2.35, -1.2], [0.42, 0.45, 0.42], { k: 0.25, col: C.cream, tag: 'ruff', dtl: fur });
  S.ell('body', [0, 2.82, 0.1], [0.44, 0.5, 0.8], { k: 0.25, col: C.fur, tag: 'body', dtl: fur });
  S.ell('hips', [0, 2.82, 1.12], [0.52, 0.55, 0.6], { k: 0.25, col: C.fur, tag: 'body', dtl: fur });
  S.ell('body', [0, 3.2, 0.05], [0.3, 0.16, 0.9], { k: 0.2, col: C.gold, tag: 'back', dtl: fur });
  // neck + fluffy ruff
  S.cone('neck1', [0, 3.0, -1.35], J.neck2, 0.52, 0.36, { k: 0.2, col: C.fur, tag: 'neck', b2: 'neck2', t0: 0.5, t1: 1, dtl: fur });
  S.cone('neck2', J.neck2, [0, 4.0, -2.3], 0.36, 0.3, { k: 0.16, col: C.fur, tag: 'neck', b2: 'head', t0: 0.5, t1: 1, dtl: fur });
  S.ell('neck1', [0, 2.95, -1.55], [0.58, 0.62, 0.5], { k: 0.2, col: C.cream, tag: 'ruff', dtl: fur });
  const hs = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < 12; i++) { // ruff tufts
    const a = -1.9 + i / 11 * 3.8, sx = Math.sin(a), cy = Math.cos(a);
    const base = [sx * 0.46, 3.0 + cy * 0.42, -1.5 + Math.abs(sx) * 0.1];
    const tip = add(base, [sx * 0.35, cy * 0.12 - 0.22 - 0.15 * hs(i), 0.3 + 0.2 * hs(i + 3)]);
    S.cone(i > 2 && i < 9 ? 'neck1' : 'chest', base, tip, 0.2, 0.03, { k: 0.1, col: C.cream, tag: 'ruff', dtl: fur });
  }
  // head: wedge skull, pointed muzzle, flared cheek tufts (scaled up around the skull pivot for a noble, readable face)
  S.ell('head', hx([0, 4.14, -2.46]), [hr(0.36), hr(0.31), hr(0.38)], { k: 0.12, col: C.mask, tag: 'head', dtl: furS });
  S.cone('head', hx([0, 4.06, -2.7]), hx([0, 3.93, -3.36]), hr(0.25), hr(0.085), { k: 0.12, col: C.mask, tag: 'muzzle', dtl: furS });
  S.cone('head', hx([0, 4.18, -2.6]), hx([0, 4.0, -3.28]), hr(0.13), hr(0.05), { k: 0.1, col: C.mask, tag: 'bridge', dtl: furS });
  for (const s of [-1, 1]) {
    S.ell('head', hx([0.27 * s, 3.99, -2.42]), [hr(0.21), hr(0.21), hr(0.26)], { k: 0.1, col: C.mask, tag: 'cheek', dtl: fur });
    S.cone('head', hx([0.3 * s, 3.95, -2.35]), hx([0.66 * s, 3.78, -2.12]), hr(0.17), 0.02, { k: 0.08, col: C.mask, tag: 'cheek', dtl: fur });
    S.cone('head', hx([0.3 * s, 4.07, -2.3]), hx([0.62 * s, 4.02, -2.0]), hr(0.15), 0.02, { k: 0.08, col: C.cream, tag: 'cheek', dtl: fur });
    S.ell('head', hx([0.19 * s, 4.19, -2.72]), [hr(0.075), hr(0.06), hr(0.08)], { k: 0.03, sub: true, col: 0x100808, tag: 'socket' });
  }
  S.ell('head', hx([0, 3.96, -3.38]), [hr(0.07), hr(0.06), hr(0.06)], { k: 0.03, col: C.nose, tag: 'nose', dtl: skinD });
  S.cone('head', hx([0, 3.91, -2.75]), hx([0, 3.9, -3.32]), hr(0.06), hr(0.035), { k: 0.03, sub: true, col: C.mouth, tag: 'mouth' });
  S.cone('jaw', hx([0, 3.88, -2.62]), hx([0, 3.84, -3.28]), hr(0.13), hr(0.06), { group: 1, k: 0.06, col: C.cream, tag: 'jaw', dtl: furS });
  S.ell('jaw', hx([0, 3.83, -2.75]), [hr(0.15), hr(0.08), hr(0.22)], { group: 1, k: 0.06, col: C.cream, tag: 'jaw', dtl: furS });
  // legs: slim, long, black-socked
  for (const [s, n] of SIDES) {
    const u = X(J.fU, s), l = X(J.fL, s), p = X(J.fP, s);
    S.ell('fU' + n, add(u, [0, -0.2, 0.05]), [0.28, 0.5, 0.36], { k: 0.2, col: C.fur, tag: 'shoulder', dtl: fur });
    S.cone('fU' + n, u, l, 0.24, 0.15, { k: 0.12, col: C.fur, tag: 'leg', b2: 'fL' + n, t0: 0.8, t1: 1, dtl: fur });
    S.cone('fL' + n, l, p, 0.14, 0.09, { k: 0.08, col: C.fur, tag: 'shin', b2: 'fP' + n, t0: 0.85, t1: 1, dtl: furS });
    S.cone('fP' + n, p, add(X(J.fToe, s), [0, 0.1, 0.05]), 0.1, 0.13, { k: 0.08, col: C.sock, tag: 'paw', dtl: furS });
    S.ell('fP' + n, add(X(J.fToe, s), [0, 0.08, 0.12]), [0.15, 0.1, 0.2], { k: 0.06, col: C.sock, tag: 'paw', dtl: furS });
    const t = X(J.rT, s), sh = X(J.rS, s), m = X(J.rM, s), rp = X(J.rP, s);
    S.ell('rT' + n, add(lerp3(t, sh, 0.35), [0.04 * s, 0.1, 0.06]), [0.34, 0.62, 0.5], { k: 0.2, col: C.fur, tag: 'haunch', rot: [0.35, 0, 0], dtl: fur });
    S.cone('rS' + n, sh, m, 0.18, 0.1, { k: 0.1, col: C.fur, tag: 'shin', b2: 'rM' + n, t0: 0.85, t1: 1, dtl: furS });
    S.cone('rM' + n, m, rp, 0.1, 0.09, { k: 0.06, col: C.sock, tag: 'meta', b2: 'rP' + n, t0: 0.8, t1: 1, dtl: furS });
    S.ell('rP' + n, add(X(J.rToe, s), [0, 0.08, 0.12]), [0.15, 0.1, 0.22], { k: 0.06, col: C.sock, tag: 'paw', dtl: furS });
  }
  // tail roots: a fluffy fan base the fur tails grow out of
  S.ell('tailRoot', add(J.tailRoot, [0, -0.05, -0.1]), [0.5, 0.42, 0.45], { k: 0.2, col: C.fur, tag: 'tailbase', dtl: fur });
}

function paint(v) {
  const face = v.t('head') + v.t('muzzle') + v.t('bridge') + v.t('cheek') + v.t('jaw');
  const [x, y, z] = face > 0.2 ? hinv(v.p) : v.p, [, ny] = v.n;
  // warm golden back fading into ivory flanks and a cream belly
  v.mix(C.gold, sstep(0.15, 0.75, ny + Math.sin(z * 3 + x * 2) * 0.1) * (1 - face) * (1 - v.t('ruff')) * 0.8);
  v.mix(C.cream, sstep(-0.2, -0.7, ny) * (1 - face) * 0.8);
  // black socks rising up the legs with a soft edge
  const sock = (v.t('leg') + v.t('shin') + v.t('meta') + v.t('paw')) * sstep(1.25 + Math.sin(x * 9 + z * 7) * 0.08, 0.55, y);
  v.mix(C.sock, Math.min(1, sock));
  // kitsune mask: crimson brush-strokes from the eyes to the ears, lower-lid flicks, brow flame, dark lips
  if (face > 0.2 && y > 3.7) {
    const ax = Math.abs(x);
    const eyeLine = Math.abs((y - 4.2) - (ax - 0.19) * 0.9 - (z + 2.72) * -0.35);
    const stroke = (1 - sstep(0.025, 0.05, eyeLine)) * sstep(0.12, 0.2, ax) * (1 - sstep(0.46, 0.55, ax)) * sstep(-2.95, -2.6, -z) * (1 - sstep(-2.2, -2.05, -z));
    const flick = (1 - sstep(0.02, 0.045, Math.abs((y - 4.1) + (ax - 0.26) * 1.4))) * sstep(0.18, 0.24, ax) * (1 - sstep(0.36, 0.42, ax)) * (z < -2.5 ? 1 : 0);
    const brow = (1 - sstep(0.03, 0.06, ax)) * sstep(4.2, 4.3, y) * (z < -2.35 && z > -2.85 ? 1 : 0);
    const lip = (y < 3.97 && z < -2.7 && v.group === 0 && ny < 0.2) ? 0.9 : 0;
    v.mix(C.red, Math.min(1, stroke + flick) * 0.95);
    v.mix(C.red, brow * 0.9);
    if (brow > 0.3) { v.emis = 1.4 * brow; v.gm = 0.2; v.kind = K.eye; }
    v.mix(C.dark, lip * 0.7);
    // eyeliner around the sockets
    for (const s of [-1, 1]) { const d = Math.hypot(x - 0.19 * s, y - 4.19, z + 2.72); v.mix(0x100808, (1 - sstep(0.09, 0.12, d)) * 0.9); }
  }
  v.mix(C.dark, v.t('socket'));
  v.mix(C.nose, v.t('nose'));
  if ((v.group === 1 && ny > 0.4) || v.t('mouth') > 0.4) { v.mix(C.mouth, 0.9); v.kind = K.mouth; v.emis = 0.5; v.gm = 0.6; }
  v.mul(1 + Math.sin(x * 11 + z * 7) * Math.sin(y * 9) * 0.035);
}

function dress({ acc, facc, S, b }) {
  const lc = (a, bb, t) => { const A = col(a), B = col(bb); return [mix(A[0], B[0], t), mix(A[1], B[1], t), mix(A[2], B[2], t)]; };
  const head = b('head');
  // eyes: golden, slit pupils, glowing
  for (const s of [-1, 1]) {
    const e = eyeball(hx([0.19 * s, 4.19, -2.72]), hr(0.075), [0.75 * s, 0.12, -0.65], [0, 1, 0], 10, 0.8);
    acc.addRaw(e, { skin: rigid(head), kind: K.eye, dtl: [0, 0, 0, 0], gm: 0.35,
      color: (t, p, n, uv) => { const dx = Math.abs(uv[0] - 0.5), dy = Math.abs(uv[1] - 0.5); return t < 0.2 ? 0x120606 : (dx < 0.05 && dy < 0.28) ? 0x080202 : C.eye; },
      emis: (t, p, uv) => { const dx = Math.abs(uv[0] - 0.5), dy = Math.abs(uv[1] - 0.5); return t < 0.2 ? 0 : (dx < 0.05 && dy < 0.28) ? 0.1 : 2.2; } });
  }
  // ears: tall cupped leaf plates — charcoal backs, crimson inner with pale fur rims
  for (const [s2, n] of SIDES) {
    const g = leafGeo(0.3, 0.98, 0.13, 0.7, 0.12, { nu: 9, nv: 8, pw: 0.9 });
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.12, s2 * 0.32, -s2 * 0.26, 'YXZ'));
    m.setPosition(...X(J.ear, s2));
    acc.add(g, { matrix: m, skin: rigid(b('ear' + n)), dtl: [0.3, 0, 0.1, 0],
      color: (p, nn, uv) => { const back = uv[0] >= 1, u = (uv[0] % 1) * 2, t = uv[1];
        if (back) return lc(C.gold, C.sock, sstep(0.05, 0.4, t));
        return lc(lc(C.earIn, C.red, t), C.cream, Math.max(sstep(0.62, 0.95, u), sstep(0.88, 1, t)) * 0.75); } });
  }
  // teeth
  for (const s of [-1, 1]) {
    acc.addRaw(loft(hornPath(hx([0.07 * s, 3.9, -3.2]), [0, -1, 0], 0.14, [1, 0, 0], 0.2, 3), 5, taper(0.026), [0, 0, -1]), { skin: rigid(head), kind: K.hard, color: 0xf8f0e0, dtl: [0, 0, 0, 0] });
    acc.addRaw(loft(hornPath(hx([0.07 * s, 3.86, -3.1]), [0, 1, 0], 0.12, [1, 0, 0], -0.2, 3), 5, taper(0.024), [0, 0, -1]), { skin: rigid(b('jaw')), kind: K.hard, color: 0xf8f0e0, dtl: [0, 0, 0, 0] });
  }
  // claws
  for (const [s, n] of SIDES) for (const [paw, toe] of [['fP', J.fToe], ['rP', J.rToe]]) for (let k = -1; k <= 1; k++) {
    const base = add(X(toe, s), [k * 0.07, 0.07, -0.02]);
    acc.addRaw(loft(hornPath(base, [k * 0.2, -0.3, -1], 0.18, [1, 0, 0], -1.0, 4), 5, taper(0.035, { flat: 0.7 }), [0, 1, 0]), { skin: rigid(b(paw + n)), kind: K.hard, color: (t) => lc(C.claw, C.clawTip, t), dtl: [0, 0, 0, 0] });
  }
  // nine tails: fur root → living flame (opaque emissive core in the body mesh + additive flame shell)
  for (let i = 0; i < NT; i++) {
    const P = TAILS[i].pts;
    const bones = TS.map((_, j) => b(`t${i}_${j}`));
    const wAt = (s) => {
      let j = 0; while (j < TB - 1 && s > TS[j + 1]) j++;
      const s0 = TS[j], s1 = j < TB - 1 ? TS[j + 1] : 1;
      const f = sstep(0.55, 1, (s - s0) / (s1 - s0));
      const m = {}; m[bones[j]] = 1 - (j < TB - 1 ? f : 0); if (j < TB - 1) m[bones[j + 1]] = f;
      return skinMap(m);
    };
    const core = loft(P, 10, (t) => { const r = 0.34 * (1 + 0.45 * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.9)) * Math.pow(1 - t, 0.55) + 0.02; return [r, r]; }, [0, 1, 0]);
    acc.addRaw(core, {
      skin: (p, t) => wAt(t), dtl: [0.45, 0, 0.1, 0], kind: K.flame,
      color: (t) => t < 0.28 ? lc(C.tailFur, C.gold, t / 0.28) : lc(0xffb040, 0xff6a20, (t - 0.28) / 0.72),
      emis: (t) => sstep(0.18, 0.45, t) * 0.85, gm: 1, uv: (uv, t) => [uv[0], t],
    });
    const shell = loft(bezier([P[3], P[12], addS(P[24], norm(sub(P[24], P[20])), 0.9)], 18), 9, (t) => { const r = 0.52 * (1 + 0.3 * Math.sin(t * Math.PI)) * Math.pow(1 - t, 0.5) + 0.03; return [r, r]; }, [0, 1, 0]);
    facc.addRaw(shell, { skin: (p, t) => wAt(Math.min(1, 0.12 + t * 0.95)), kind: K.flame, color: 0xff8a30, emis: (t) => 0.32 * sstep(0.0, 0.25, t), gm: 1, dtl: [0, 0, 0, 0], uv: (uv, t) => [uv[0], t] });
  }
}

export const kurai = {
  info: {
    name: 'Kurai', title: 'the Pyrefox', height: 5.2, radius: 2.4,
    parts: [],
    actions: {
      idle: { dur: 4, hits: [], loop: true },
      walk: { dur: 1.6, hits: [], loop: true, speed: 3 },
      run: { dur: 0.8, hits: [], loop: true, speed: 10 },
      intro: { dur: 6.0, hits: [4.35] },
      claw: { dur: 1.2, hits: [0.55] },
      tail_whip: { dur: 1.9, hits: [0.9] },
      fire_orbs: { dur: 2.3, hits: [0.95, 1.3, 1.65] },
      pounce: { dur: 1.8, hits: [1.12], move: { dist: 12, t0: 0.5, t1: 1.1 }, counter: [0.05, 0.42] },
      clone: { dur: 1.9, hits: [0.95] },
      foxfire_breath: { dur: 3.3, hits: [1.05, 1.45, 1.85, 2.25, 2.65] },
      dash: { dur: 1.0, hits: [0.42], move: { dist: 14, t0: 0.18, t1: 0.56 } },
      howl: { dur: 2.7, hits: [1.2] },
      groggy: { dur: 3.0, hits: [], loop: true },
      death: { dur: 3.3, hits: [], hold: true },
    },
  },
  config() { return { h: 0.058, ao: { dist: 0.09, str: 0.8 }, grad: { top: 0.12, bottom: 0.28, y0: 0, y1: 2.5, low: 0.18 }, dtl: [0.35, 0, 0.15, 0] }; },
  rig, sculpt, paint, dress,
  look: { glow: 0xffa030, glowI: 1.25, glow2: 0xff3a0c, glow2I: 1.5, pulse: 3.0, dfreq: 1.4, enrage: 0xff2a10, ghost: 0xffa050, flash: 0xff8a30 },
  cloneLook: { ghost: 0xff7a24 },
  mat: { body: { rim: 0.3, rimColor: 0xffe8c8, spec: 0.25, shine: 18 }, flame: {} },
  sockets: {
    head: ['head', hx([0, 4.45, -2.5])], mouth: ['head', hx([0, 3.9, -3.3])], chest: ['chest', [0, 2.5, -1.3]], back: ['body', [0, 3.3, 0]],
    handL: ['fPL', [-0.5, 0.12, -1.3]], handR: ['fPR', [0.5, 0.12, -1.3]], weapon: ['tailRoot', J.tailRoot], weaponTip: ['t4_3', tailAt(4, 1)],
    brow: ['head', hx([0, 4.34, -2.62])],
    ...Object.fromEntries(Array.from({ length: NT }, (_, i) => ['tail' + i, [`t${i}_3`, tailAt(i, 1)]])),
  },
  cloneSetup(boss) {
    for (const m of boss.materials) { m.blending = THREE.AdditiveBlending; m.depthWrite = false; m.transparent = true; m.needsUpdate = true; }
    boss._transparent = true;
    for (const k in boss.meshes) boss.meshes[k].castShadow = false;
    boss.U.uGlowK.value = 1.2;
  },
};
kurai.spec = kuraiSpec(J, { NT, TB, TS, tailCurve });
