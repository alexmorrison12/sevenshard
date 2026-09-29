// Varkhul the Ravager — demon general of the prologue (razes Brighthold) and of Ashen Ridge. Original design.
// ~3.5 m demon knight: blackened plate with burning crimson seams, a horned great-helm with a glowing T-visor and a
// crown of spikes, a ragged mantle of embers over spiked pauldrons, crimson tabards, clawed gauntlets, and a colossal
// burning greatsword (separate object: it can be dropped on death). Idle: both hands resting on the pommel of the
// planted blade. Sculpted in units (≈2 tall), scale 1.75 → metres.
import * as THREE from 'three';
import { sweep, rigid, bez, taper, blend2 } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { lerp3 } from '../../kit/parts.js';
import { clamp01, mix, sstep, TAU } from '../../kit/rig.js';
import { BossAcc } from './acc.js';
import { bipedCarriage } from './boss.js';

const C = {
  under: 0x1f1b1d, iron: 0x35313a, ironL: 0x6c6672, ironD: 0x141216, trim: 0x9a6a34, cloth: 0x5e0c0c, clothD: 0x220404,
  mantle: 0x1c1416, mantleEdge: 0x3a0e08, glow: 0xff4418, eye: 0xff7a22, horn: 0x1a1414, hornT: 0x8a6a5a, blade: 0x2a2528, bladeL: 0x5a5258,
};
const DT = { under: [0.05, 0.15, 0.3, 0.2], metal: [0, 0.02, 0.32, 0.06], cloth: [0.05, 0, 0.25, 0.5], horn: [0.3, 0, 0.2, 0.25] };

// greatsword frame at the rest pose of the right fist (units, model space): blade points forward (−Z), edges ±Y
const GRIP = [0.72, 0.99, -0.04], H0 = [0, 0, -1], B0 = [0, 1, 0];
const GRIP2 = [0.72, 0.99, 0.1];     // left hand: below the right, toward the pommel
const GRIPL = [-0.72, 0.99, -0.04];
const AX = (d) => [GRIP[0], GRIP[1], GRIP[2] - d];
const BLADE0 = 0.14, BLADE1 = 1.42;  // blade span along the axis from the grip

const n3 = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
const aim = (h, b) => { const H = n3(...h); let B = b; const d = B[0] * H[0] + B[1] * H[1] + B[2] * H[2]; B = n3(B[0] - H[0] * d, B[1] - H[1] * d, B[2] - H[2] * d); return [...H, ...B]; };
const SW = (deg, y = 1.25, dir = 1, rad = 0.5, tilt = -0.1) => {
  const t = deg * Math.PI / 180, r = [-Math.sin(t), 0, -Math.cos(t)], tg = [-Math.cos(t) * dir, 0, Math.sin(t) * dir];
  return { $handR: [0.05 + r[0] * rad, y, -0.02 + r[2] * rad], $aimR: aim([r[0], tilt, r[2]], tg) };
};
const TW = (a, b = a * 1.3) => ({ 'spine+': [0, a, 0], 'chest+': [0, b, 0] });
const K2 = (...o) => Object.assign({}, ...o);
const KNEEL_R = { $footR: [0.15, 0.03, 0.34, 0.5, 0], $footL: [-0.14, 0, -0.22] };
const PLANT = { $handR: [0.1, 1.24, -0.36], $aimR: aim([0, -1, -0.08], [1, 0, 0]) };   // resting on the planted blade

export const varkhul = {
  meta: { name: 'Varkhul', title: 'the Ravager', height: 3.6, radius: 1.3, walkSpeed: 2.4, runSpeed: 7 },
  scale: 1.75,
  h: 0.028, hg: { 1: 0.0195, 2: 0.0115, 3: 0.014 },
  ao: { dist: 0.03, str: 0.85 },
  grad: { top: 0.14, bottom: 0.3, y0: 0.0, y1: 0.7, low: 0.22 },
  mat: { glow: C.glow, glowK: 3.4, crackFreq: 11, crackK: 0.9, dfreq: 5.5, rim: 0.24, rimColor: 0xffc8a0, spec: 0.5, shine: 34, ghostCol: 0x6f63ff, enrageCol: 0xff1a08, sil: 0.34, silCol: 0x9ab0ff },
  stepFx: { n: 2, scale: 0.9 },
  particles: { add: 800, alpha: 260 },

  rig(R) {
    R.add('hips', null, [0, 1.02, 0.02]);
    R.add('spine', 'hips', [0, 1.2, 0.03]);
    R.add('chest', 'spine', [0, 1.42, 0.02]);
    R.add('neck', 'chest', [0, 1.66, 0.0]);
    R.add('head', 'neck', [0, 1.76, -0.02]);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('clav' + n, 'chest', [s * 0.1, 1.6, 0.0]);
      R.add('armU' + n, 'clav' + n, [s * 0.3, 1.6, 0.0]);
      R.add('armL' + n, 'armU' + n, [s * 0.54, 1.3, 0.03]);
      R.add('hand' + n, 'armL' + n, [s * 0.7, 1.05, -0.01]);
      R.add('fing' + n, 'hand' + n, [s * 0.74, 0.97, -0.03]);
      R.add('thigh' + n, 'hips', [s * 0.12, 1.0, 0.02]);
      R.add('shin' + n, 'thigh' + n, [s * 0.13, 0.56, -0.01]);
      R.add('foot' + n, 'shin' + n, [s * 0.14, 0.1, 0.03]);
    }
    for (const [c, x] of [['L', -0.26], ['C', 0], ['R', 0.26]]) {
      R.add('mant' + c + '1', 'chest', [x, 1.68, 0.15]);
      R.add('mant' + c + '2', 'mant' + c + '1', [x * 1.12, 1.38, 0.21]);
      R.add('mant' + c + '3', 'mant' + c + '2', [x * 1.2, 1.1, 0.25]);
    }
    R.add('tabF1', 'hips', [0, 0.95, -0.17]); R.add('tabF2', 'tabF1', [0, 0.62, -0.19]);
    R.add('tabB1', 'hips', [0, 0.95, 0.17]); R.add('tabB2', 'tabB1', [0, 0.62, 0.19]);
  },

  sculpt(S) {
    const un = { col: C.under, tag: 'under', dtl: DT.under };
    const ar = { group: 1, col: C.iron, tag: 'metal', dtl: DT.metal };
    const E = (b, c, r, o) => S.ell(b, c, r, o), K = (b, a, c2, ra, rb, o) => S.cone(b, a, c2, ra, rb, o), Q = (b, a, c2, rx, ry, o) => S.seg(b, a, c2, rx, ry, o);
    const cut = (y0) => (x, y, z, d) => Math.max(d, y0 - y);
    // ---------------- underlayer (dark mail / leather; mostly hidden)
    E('hips', [0, 1.0, 0.02], [0.19, 0.13, 0.14], { k: 0.06, ...un });
    E('spine', [0, 1.19, 0.02], [0.17, 0.15, 0.13], { k: 0.06, ...un });
    E('chest', [0, 1.42, 0.0], [0.24, 0.19, 0.16], { k: 0.06, ...un });
    K('neck', [0, 1.6, 0.0], [0, 1.76, -0.02], 0.08, 0.07, { k: 0.04, ...un, b2: 'head', t0: 0.6, t1: 1 });
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      K('armU' + n, [s * 0.3, 1.6, 0.0], [s * 0.54, 1.3, 0.03], 0.085, 0.07, { k: 0.04, ...un, b2: 'armL' + n, t0: 0.8, t1: 1 });
      K('armL' + n, [s * 0.54, 1.3, 0.03], [s * 0.7, 1.05, -0.01], 0.068, 0.055, { k: 0.035, ...un, b2: 'hand' + n, t0: 0.85, t1: 1 });
      K('thigh' + n, [s * 0.12, 1.0, 0.02], [s * 0.13, 0.56, -0.01], 0.11, 0.075, { k: 0.05, ...un, b2: 'shin' + n, t0: 0.8, t1: 1 });
      K('shin' + n, [s * 0.13, 0.56, -0.01], [s * 0.14, 0.12, 0.03], 0.07, 0.05, { k: 0.04, ...un, b2: 'foot' + n, t0: 0.85, t1: 1 });
    }
    // ---------------- plate armour (group 1)
    E('chest', [0, 1.43, -0.02], [0.27, 0.215, 0.2], { ...ar, k: 0.03, tag: 'plate' });                     // cuirass
    K('chest', [0, 1.6, -0.205], [0, 1.26, -0.19], 0.022, 0.018, { ...ar, k: 0.02, tag: 'plate' });          // keel ridge
    for (const s of [-1, 1]) Q('chest', [s * 0.03, 1.49, -0.18], [s * 0.21, 1.53, -0.13], 0.09, 0.075, { ...ar, k: 0.025, tag: 'plate', zs: 1.1 });  // pec plates
    for (let i = 0; i < 3; i++) E('spine', [0, 1.25 - i * 0.068, 0.0], [0.205 - i * 0.008, 0.046, 0.165], { ...ar, k: 0.008, tag: 'lame' });  // abdominal lames
    E('neck', [0, 1.63, 0.0], [0.13, 0.06, 0.12], { ...ar, k: 0.02, tag: 'plate' });                           // gorget
    E('hips', [0, 1.075, 0.02], [0.2, 0.04, 0.155], { group: 1, k: 0.01, col: 0x2a1c14, tag: 'belt', dtl: DT.under });  // belt
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R', big = s > 0 ? 1.12 : 1.0;
      // pauldrons: three stacked lames, the right one bigger (sword arm)
      E('clav' + n, [s * 0.3, 1.63, 0.0], [0.17 * big, 0.12 * big, 0.17 * big], { ...ar, k: 0.008, rot: [0, 0, s * 0.3], mod: cut(1.66), tag: 'pauldron' });
      E('armU' + n, [s * 0.35, 1.57, 0.0], [0.16 * big, 0.11 * big, 0.16 * big], { ...ar, k: 0.008, rot: [0, 0, s * 0.5], mod: cut(1.58), tag: 'pauldron' });
      E('armU' + n, [s * 0.4, 1.5, 0.01], [0.13 * big, 0.09 * big, 0.14 * big], { ...ar, k: 0.008, rot: [0, 0, s * 0.7], mod: cut(1.5), tag: 'pauldron' });
      K('armL' + n, [s * 0.555, 1.27, 0.03], [s * 0.685, 1.07, -0.005], 0.078, 0.064, { ...ar, k: 0.01, tag: 'plate' });   // vambrace
      E('armL' + n, [s * 0.535, 1.31, 0.05], [0.06, 0.06, 0.06], { ...ar, k: 0.02, tag: 'plate' });                          // couter
      // tassets (hang from the belt, follow the thighs), cuisses, poleyns, greaves
      S.box('thigh' + n, [s * 0.13, 0.88, -0.15], [0.095, 0.13, 0.014], 0.014, { ...ar, k: 0.006, rot: [0.2, s * 0.22, 0], tag: 'plate' });
      S.box('thigh' + n, [s * 0.225, 0.88, 0.0], [0.014, 0.13, 0.1], 0.014, { ...ar, k: 0.006, rot: [0, 0, s * 0.2], tag: 'plate' });
      E('thigh' + n, [s * 0.13, 0.74, -0.03], [0.118, 0.19, 0.108], { ...ar, k: 0.02, tag: 'plate' });
      E('shin' + n, [s * 0.13, 0.56, -0.075], [0.085, 0.085, 0.065], { ...ar, k: 0.02, tag: 'plate' });
      K('shin' + n, [s * 0.132, 0.5, -0.02], [s * 0.14, 0.16, 0.02], 0.09, 0.07, { ...ar, k: 0.012, tag: 'plate' });
      E('shin' + n, [s * 0.135, 0.36, 0.035], [0.075, 0.12, 0.07], { ...ar, k: 0.03, tag: 'plate' });
      // sabatons (group 3)
      E('foot' + n, [s * 0.14, 0.055, -0.05], [0.065, 0.05, 0.13], { ...ar, group: 3, k: 0.015, tag: 'plate' });
      K('foot' + n, [s * 0.14, 0.04, -0.12], [s * 0.14, 0.02, -0.22], 0.04, 0.008, { ...ar, group: 3, k: 0.01, tag: 'plate' });
    }
    // gauntlets (group 3): right fist around the grip, left clawed hand
    {
      const [gx, gy, gz] = GRIP;
      E('handR', [gx, gy + 0.03, gz + 0.01], [0.055, 0.065, 0.07], { ...ar, group: 3, k: 0.02, tag: 'plate' });
      K('fingR', [gx + 0.04, gy - 0.02, gz - 0.055], [gx + 0.04, gy - 0.02, gz + 0.05], 0.03, 0.028, { ...ar, group: 3, k: 0.02, tag: 'plate' });
      const hx = -0.72, hy = 0.99, hz = -0.03;
      E('handL', [hx, hy + 0.03, hz], [0.055, 0.07, 0.065], { ...ar, group: 3, k: 0.02, tag: 'plate' });
      for (let f = 0; f < 4; f++) {
        const z = hz - 0.05 + f * 0.033;
        K('fingL', [hx - 0.01, hy - 0.02, z], [hx - 0.02, hy - 0.1, z - 0.03], 0.022, 0.018, { ...ar, group: 3, k: 0.01, tag: 'plate' });
        K('fingL', [hx - 0.02, hy - 0.1, z - 0.03], [hx - 0.005, hy - 0.16, z - 0.06], 0.017, 0.006, { ...ar, group: 3, k: 0.008, tag: 'claw' });
      }
    }
    // ---------------- great-helm (group 2): dome, face plate, T-visor, cheek guards, crest
    const hm = { group: 2, col: C.iron, tag: 'helm', dtl: DT.metal };
    E('head', [0, 1.83, -0.02], [0.11, 0.12, 0.12], { ...hm, k: 0.02 });
    E('head', [0, 1.78, -0.085], [0.098, 0.1, 0.065], { ...hm, k: 0.02 });
    for (const s of [-1, 1]) E('head', [s * 0.075, 1.74, -0.07], [0.04, 0.07, 0.06], { ...hm, k: 0.02, rot: [0, s * 0.3, 0] });
    K('head', [0, 1.95, -0.1], [0, 1.93, 0.13], 0.022, 0.018, { ...hm, k: 0.015 });
    K('head', [0, 1.78, -0.145], [0, 1.69, -0.13], 0.024, 0.02, { ...hm, k: 0.015 });                            // nasal ridge
    S.box('head', [0, 1.805, -0.15], [0.075, 0.009, 0.05], 0.004, { group: 2, k: 0.006, sub: true, col: 0x100404, tag: 'visor' });
    S.box('head', [0, 1.75, -0.15], [0.012, 0.05, 0.05], 0.004, { group: 2, k: 0.006, sub: true, col: 0x100404, tag: 'visor' });
    for (let i = -2; i <= 2; i++) S.box('head', [i * 0.022, 1.705, -0.15], [0.004, 0.02, 0.05], 0.002, { group: 2, k: 0.004, sub: true, col: 0x100404, tag: 'visor' });  // mouth grille
  },

  paint(v, X) {
    const [x, y, z] = v.p, ny = v.n[1];
    const metal = v.t('metal') + v.t('plate') + v.t('lame') + v.t('pauldron') + v.t('helm');
    if (v.t('under') > 0.3) { X[0] = 0.05; v.mul(0.9); }
    if (metal > 0.3) {
      X[0] = 0.34;
      v.mix(C.ironL, sstep(0.3, 0.95, ny) * 0.22);
      // brass trim on plate rims (normals facing down/out)
      const rimK = (v.t('pauldron') > 0.3 || v.t('lame') > 0.3) ? sstep(-0.4, -0.8, ny) : sstep(-0.8, -0.95, ny);
      v.mix(C.trim, rimK * 0.9 * (v.group === 2 ? 0.3 : 1)); if (rimK > 0.5) X[0] = 0.6;
      // burning seams: sparse fissures in the plates (breastplate, thighs); pauldrons mostly clean
      X[2] = (y > 1.2 && y < 1.58 && Math.abs(x) < 0.24 ? 0.5 : y > 0.6 && y < 1.0 ? 0.3 : 0.1) * (v.group === 2 ? 0.3 : 1) * (v.t('pauldron') > 0.3 ? 0.35 : 1);
    }
    if (v.t('claw') > 0.3) { X[0] = 0.3; v.mix(0x0a0808, 0.6); }
    if (v.t('belt') > 0.3) X[0] = 0.08;
    if (v.t('visor') > 0.3) { v.mix(0x5a0c04, 0.9); v.emis = 1.8; X[3] = 1; X[2] = 0; }
  },

  parts(acc, S, R, out) {
    const b = (n) => R.index(n);
    const hb = rigid(b('head'));
    const cG = col(0xff6a22), cH = col(C.horn), cHT = col(C.hornT), cI = col(C.iron), cIL = col(C.ironL);
    // glowing eyes behind the visor slit
    for (const s of [-1, 1]) {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(s * 0.035, 1.806, -0.13), new THREE.Quaternion(), new THREE.Vector3(1.6, 0.45, 0.6));
      acc.add(new THREE.SphereGeometry(0.02, 10, 6), { matrix: m, skin: hb, color: 0xffb040, emis: 4, dtl: [0, 0, 0, 0], ext: [0, 0, 0, 1] });
    }
    // swept-back horns + crown of spikes
    for (const s of [-1, 1]) {
      const pts = bez([s * 0.095, 1.86, -0.03], [s * 0.2, 1.97, 0.1], [s * 0.2, 2.16, 0.34], 14);
      acc.add(sweep(pts, taper(14, 0.036, 0.004, 1.1), { radial: 8, capStart: true }), { skin: hb, dtl: DT.horn, color: (p, n, uv) => (uv[1] > 0.86 ? cG : lerp3(cH, cHT, uv[1] * 0.7)), emis: (p, uv) => (uv[1] > 0.86 ? 2.2 : 0), ext: (p, uv) => [0.25, 0, 0, uv[1] > 0.86 ? 4 : 0] });
    }
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.32;
      const p0 = new THREE.Vector3(Math.sin(a) * 0.1, 1.93, -0.04 + Math.cos(a) * -0.05);
      const d = new THREE.Vector3(Math.sin(a) * 0.5, 1, -0.15).normalize();
      const L = i === 2 ? 0.13 : 0.09;
      acc.add(sweep([p0, p0.clone().addScaledVector(d, L * 0.5), p0.clone().addScaledVector(d, L)], [0.018, 0.011, 0.002], { radial: 6, capStart: true }), { skin: hb, dtl: DT.metal, color: (p, n, uv) => (uv[1] > 0.75 ? cG : cI), emis: (p, uv) => (uv[1] > 0.75 ? 2 : 0), ext: (p, uv) => [0.4, 0, 0, uv[1] > 0.75 ? 4 : 0] });
    }
    // pauldron spikes, knee spikes, gauntlet studs
    const spike = (bone, p, d, L, r, glowTip = true) => {
      const D = new THREE.Vector3(...d).normalize(), a = new THREE.Vector3(...p);
      acc.add(sweep([a, a.clone().addScaledVector(D, L * 0.5), a.clone().addScaledVector(D, L)], [r, r * 0.55, r * 0.04], { radial: 7, capStart: true }), {
        skin: rigid(b(bone)), dtl: DT.metal, color: (pp, n, uv) => (glowTip && uv[1] > 0.8 ? cG : lerp3(cI, cIL, uv[1] * 0.6)),
        emis: (pp, uv) => (glowTip && uv[1] > 0.8 ? 2.2 : 0), ext: (pp, uv) => [0.4, 0, 0, glowTip && uv[1] > 0.8 ? 4 : 0],
      });
    };
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R', big = s > 0 ? 1.2 : 1;
      spike('clav' + n, [s * 0.32, 1.74, 0.0], [s * 0.3, 1, 0.15], 0.2 * big, 0.03 * big);
      spike('clav' + n, [s * 0.42, 1.68, -0.04], [s * 1, 0.55, -0.1], 0.15 * big, 0.026 * big);
      spike('clav' + n, [s * 0.38, 1.7, 0.1], [s * 0.6, 0.7, 0.7], 0.13 * big, 0.024 * big);
      spike('shin' + n, [s * 0.13, 0.57, -0.12], [0, 0.3, -1], 0.07, 0.018, false);
      spike('armL' + n, [s * 0.58, 1.24, 0.08], [s * 0.4, 0.2, 1], 0.07, 0.016, false);
    }
    // demon-face belt buckle (glowing)
    {
      const g = new THREE.SphereGeometry(0.045, 12, 8);
      acc.add(g, { matrix: new THREE.Matrix4().makeScale(1, 0.9, 0.55).setPosition(0, 1.075, -0.175), skin: rigid(b('hips')), color: C.trim, dtl: DT.metal, ext: [0.6, 0, 0, 0] });
      for (const s of [-1, 1]) acc.add(new THREE.SphereGeometry(0.011, 6, 4), { matrix: new THREE.Matrix4().setPosition(s * 0.016, 1.085, -0.198), skin: rigid(b('hips')), color: 0xff6a20, emis: 3, ext: [0, 0, 0, 1] });
      for (const s of [-1, 1]) acc.add(sweep(bez([s * 0.03, 1.1, -0.19], [s * 0.06, 1.14, -0.2], [s * 0.05, 1.18, -0.17], 5), taper(5, 0.009, 0.001), { radial: 5 }), { skin: rigid(b('hips')), color: C.trim, dtl: DT.metal, ext: [0.6, 0, 0, 0] });
    }
    // ---------------- tabards (front/back crimson panels with a burning sigil), skinned to tab springs
    const panel = (front) => {
      const nu = 6, nv = 7, P = [], I = [], UV = [];
      const z0 = front ? -0.19 : 0.19, sz = front ? -1 : 1;
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const u = i / (nu - 1), v = j / (nv - 1);
        const hem = (i % 2 ? 0.045 : 0) * v;
        P.push((u - 0.5) * 2 * (0.1 + v * 0.02), 1.02 - v * (0.52 - hem), z0 + sz * (0.01 + v * 0.02) + sz * Math.cos((u - 0.5) * 2.4) * 0.012);
        UV.push(u, v);
      }
      for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) { const a = j * nu + i; if (front) I.push(a, a + 1, a + nu, a + 1, a + nu + 1, a + nu); else I.push(a, a + nu, a + 1, a + 1, a + nu, a + nu + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
      const bk = g.clone(); { const ix = bk.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 1]; ix[i + 1] = t; } const pa = bk.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, pa.getZ(i) - sz * 0.01); bk.computeVertexNormals(); }
      const cc = col(C.cloth), cd = col(C.clothD), ct = col(C.trim), cg = col(0xff5a20);
      const b1 = b(front ? 'tabF1' : 'tabB1'), b2 = b(front ? 'tabF2' : 'tabB2');
      for (const gg of [g, bk]) acc.add(gg, {
        skin: (p) => { const v = clamp01((1.02 - p.y) / 0.52); return v < 0.5 ? blend2(b('hips'), b1, v * 2) : blend2(b1, b2, (v - 0.5) * 2); },
        dtl: DT.cloth,
        color: (p, n, uv) => { const sig = Math.abs(uv[0] - 0.5) < 0.12 && Math.abs(uv[1] - 0.35) < 0.14 && (Math.abs(uv[0] - 0.5) < 0.03 || Math.abs(uv[1] - 0.35) < 0.03); return uv[1] < 0.06 ? ct : sig ? cg : lerp3(cc, cd, sstep(0.55, 1, uv[1])); },
        emis: (p, uv) => { const sig = Math.abs(uv[0] - 0.5) < 0.12 && Math.abs(uv[1] - 0.35) < 0.14 && (Math.abs(uv[0] - 0.5) < 0.03 || Math.abs(uv[1] - 0.35) < 0.03); return sig ? 2 : sstep(0.9, 1, uv[1]) * 0.8; },
        ext: [0.04, 0, 0, 0],
      });
    };
    panel(true); panel(false);
    // ---------------- mantle of embers: ragged dark cloth over the shoulders/back, smouldering hem
    {
      const nu = 11, nv = 9;
      const cols = ['L', 'C', 'R'].map(c => [1, 2, 3].map(k => b('mant' + c + k)));
      const pos = [], uvs = [], skins = [];
      let rs = 11; const rr = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
      const len = Array.from({ length: nu }, (_, i) => (i % 2 ? 0.72 + 0.12 * rr() : 0.92 + 0.08 * rr()));
      const zb = new Array(nu).fill(-1e9);
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const u = i / (nu - 1), v = j / (nv - 1);
        const w = 0.34 + 0.14 * v;
        const x = (u - 0.5) * 2 * w;
        const yTop = 1.72 - Math.abs(u - 0.5) * 0.1;
        const y = yTop - v * (yTop - 1.02) * len[i];
        let zs = 0.4;
        for (let k = 0; k < 40; k++) { if (S.sdf(x, y, zs, 0) < 0.02 || S.sdf(x, y, zs, 1) < 0.018) break; zs -= 0.01; }
        zs += 0.022;
        zb[i] = Math.max(j === 0 ? zs : zb[i] - 0.02, zs);
        pos.push(new THREE.Vector3(x, y, zb[i] + Math.sin(u * TAU * 2 + 0.4) * 0.012 * (0.3 + v)));
        uvs.push([u, v]);
        const cu = u * 2, ci = Math.min(1, Math.floor(cu)), cf = cu - ci;
        const chainY = [1.68, 1.38, 1.1];
        let k = 0; while (k < 1 && y < chainY[k + 1]) k++;
        const kf = clamp01((chainY[k] - y) / (chainY[k] - chainY[k + 1]));
        if (j === 0) skins.push({ si: [b('chest'), cols[ci][0], cols[ci + 1][0], 0], sw: [0.6, 0.4 * (1 - cf), 0.4 * cf, 0] });
        else skins.push({ si: [cols[ci][k], cols[ci][k + 1], cols[ci + 1][k], cols[ci + 1][k + 1]], sw: [(1 - cf) * (1 - kf), (1 - cf) * kf, cf * (1 - kf), cf * kf] });
      }
      const I = [];
      for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) { const a = j * nu + i; I.push(a, a + nu, a + 1, a + 1, a + nu, a + nu + 1); }
      const P = []; for (const p of pos) P.push(p.x, p.y, p.z);
      const UV = []; for (const q of uvs) UV.push(q[0], q[1]);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
      const inner = g.clone(); { const ix = inner.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 1]; ix[i + 1] = t; } const pa = inner.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, pa.getZ(i) - 0.008); inner.computeVertexNormals(); }
      const cm = col(C.mantle), ce = col(C.mantleEdge), ch = col(0xff5a18);
      for (const [gg, isIn] of [[g, false], [inner, true]]) {
        let vi = 0;
        acc.add(gg, {
          skin: () => skins[vi++ % skins.length], dtl: DT.cloth,
          color: (p, n, uv) => (isIn ? lerp3(col(0x120a0a), ce, uv[1] * 0.4) : lerp3(lerp3(cm, ce, sstep(0.5, 0.9, uv[1])), ch, sstep(0.9, 1.0, uv[1]))),
          emis: (p, uv) => sstep(0.86, 1.0, uv[1]) * 2.4, ext: (p, uv) => [0.03, 0, 0, uv[1] > 0.86 ? 4 : 0],
        });
      }
    }
    out.weapons.sword = { acc: buildSword(), bone: 'handR' };
  },

  weapon: { grip: GRIP, h0: H0, b0: B0, grip2: GRIP2, gripL: GRIPL, hL0: [0, 0, -1], bL0: [0, 1, 0], leftFlip: 1 },
  arms: { R: ['armUR', 'armLR', 'handR'], L: ['armUL', 'armLL', 'handL'] },
  bones: { hips: 'hips', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head', armL: ['armUL', 'armLL', 'handL'], armR: ['armUR', 'armLR', 'handR'], clavL: 'clavL', clavR: 'clavR', fingL: 'fingL', fingR: 'fingR' },
  sockets: {
    head: ['head', [0, 1.98, -0.02]], mouth: ['head', [0, 1.72, -0.16]], chest: ['chest', [0, 1.45, -0.22]], back: ['chest', [0, 1.5, 0.25]],
    handR: ['handR', GRIP], handL: ['handL', [-0.72, 0.95, -0.05]],
    weapon: ['handR', AX(0.8), 'sword'], weaponTip: ['handR', AX(BLADE1), 'sword'],
    feetL: ['footL', [-0.14, 0.0, -0.05]], feetR: ['footR', [0.14, 0.0, -0.05]],
  },
  breakable: {},

  gait: {
    legs: [
      { id: 'L', chain: ['thighL', 'shinL', 'footL'], toe: [-0.14, 0, -0.1], body: 'hips', scap: 0.1, lift: 0.1, flex: 0.9, heel: 0.35, out: 0.06 },
      { id: 'R', chain: ['thighR', 'shinR', 'footR'], toe: [0.14, 0, -0.1], body: 'hips', scap: 0.1, lift: 0.1, flex: 0.9, heel: 0.35, out: 0.06 },
    ],
    maxStride: 0.85, fMin: 0.6, settleDist: 0.04, actV: 0.2,
    gaits: [
      { v: 0.75, f: 1.0, duty: 0.6, lift: 1, off: { L: 0, R: 0.5 }, bob: 0.018, bobF: 2, bobPh: 0.12, roll: 0.03, rollF: 1, rollPh: 0.25, sway: 0.02, swayF: 1, swayPh: 0.25, nod: 0.02, nodF: 2 },
      { v: 2.2, f: 1.5, duty: 0.4, lift: 1.5, off: { L: 0, R: 0.5 }, bob: 0.04, bobF: 2, bobPh: 0.3, roll: 0.025, rollF: 1, rollPh: 0.25, nod: 0.03, nodF: 2, pitch: 0.03, pitchF: 2 },
    ],
  },
  airPaw: -0.4,
  springs: [
    { bones: ['mantL1', 'mantL2', 'mantL3'], tip: [-0.34, 0.86, 0.29], k: 32, d: 6, g: 1, coll: [{ bone: 'chest', c: [-0.12, 1.4, 0.06], r: 0.22 }, { bone: 'spine', c: [-0.08, 1.2, 0.06], r: 0.18 }] },
    { bones: ['mantC1', 'mantC2', 'mantC3'], tip: [0, 0.84, 0.29], k: 32, d: 6, g: 1, coll: [{ bone: 'chest', c: [0, 1.4, 0.08], r: 0.22 }, { bone: 'spine', c: [0, 1.2, 0.08], r: 0.18 }] },
    { bones: ['mantR1', 'mantR2', 'mantR3'], tip: [0.34, 0.86, 0.29], k: 32, d: 6, g: 1, coll: [{ bone: 'chest', c: [0.12, 1.4, 0.06], r: 0.22 }, { bone: 'spine', c: [0.08, 1.2, 0.06], r: 0.18 }] },
    { bones: ['tabF1', 'tabF2'], tip: [0, 0.42, -0.2], k: 40, d: 7, g: 1, coll: [{ bone: 'thighL', c: [-0.12, 0.78, -0.06], r: 0.12 }, { bone: 'thighR', c: [0.12, 0.78, -0.06], r: 0.12 }] },
    { bones: ['tabB1', 'tabB2'], tip: [0, 0.42, 0.2], k: 40, d: 7, g: 1, coll: [{ bone: 'thighL', c: [-0.12, 0.78, 0.08], r: 0.12 }, { bone: 'thighR', c: [0.12, 0.78, 0.08], r: 0.12 }] },
  ],
  trails: [
    { weapon: 'sword', a: AX(BLADE0 + 0.3), b: AX(BLADE1), vMin: 6, vMax: 16, core: [6, 2.6, 0.8], edge: [2.4, 0.2, 0.04], life: 0.2 },
  ],
  emitters: [
    // burning greatsword: flames licking along the blade (hotter when charged / swinging)
    { weapon: 'sword', p: AX((BLADE0 + BLADE1) / 2), span: [0, 0, (BLADE1 - BLADE0) / 2], kind: 'flame', rate: 34, opts: { scale: 0.7, up: 1.2 }, when: b => (b.dead ? 0.1 : 1) * (0.6 + b.glow.charge * 2.5 + b.glow.enrage) },
    { weapon: 'sword', p: AX((BLADE0 + BLADE1) / 2), span: [0, 0, (BLADE1 - BLADE0) / 2], kind: 'ember', rate: 10, opts: { scale: 0.8 }, when: b => 1 + b.glow.charge * 2 },
    // mantle of embers: sparks and smoke streaming off the shoulders
    { bone: 'mantC2', p: [0, 1.25, 0.26], span: [0.34, 0.2, 0.04], kind: 'ember', rate: 18, opts: { scale: 0.9 }, when: b => (b.dead ? 0.2 : 1) * (1 + b.glow.body * 3 + b.glow.enrage * 2) },
    { bone: 'mantC3', p: [0, 1.05, 0.28], span: [0.36, 0.03, 0.04], kind: 'flame', rate: 14, opts: { scale: 0.55, up: 1.0 }, when: b => (b.dead ? 0 : 1) * (1 + b.glow.body * 2 + b.glow.enrage) },
    { bone: 'chest', p: [0, 1.62, 0.12], span: [0.25, 0.03, 0.08], kind: 'smoke', rate: 3, opts: { scale: 1.1, a: 0.2 }, when: b => 1 + b.glow.enrage },
    // visor: ember wisps
    { bone: 'head', p: [0, 1.806, -0.15], span: [0.04, 0, 0], kind: 'ember', rate: 5, opts: { scale: 0.35, col: [5, 2, 0.5] }, when: b => b.glow.eyes },
    { bone: 'chest', p: [0, 1.3, 0], span: [0.25, 0.3, 0.2], kind: 'ghost', rate: 24, opts: { scale: 1.3 }, when: b => b.glow.ghost },
  ],

  carriage(ctl, dt) {
    const P = ctl.pose, B = ctl.B;
    const r = bipedCarriage(ctl, dt, { lean: { walk: 0.08, run: 0.35 }, twist: 0.08, crouch: 0.02, breathe: 0.012, look: 0.6, arm: { swing: 0.25, runSwing: 0.6, out: -0.05, elbow: 0.3, runElbow: 0.9, weaponSwing: 0.15 }, neckPitch: -0.04, headPitch: 0.02 });
    const walkK = clamp01(Math.abs(ctl.speedSm) / 0.75), wk = Math.max(walkK, ctl.run);
    P.rot(B.fingL, 0.2 + 0.6 * (1 - wk), 0, 0); P.rot(B.fingR, 0.3, 0, 0);
    // greatsword: idle = both hands resting on the pommel, blade planted; walk/run = blade on the right shoulder
    const ik = ctl.ik.R;
    ik.w = 1; ik.hasAim = true; ik.hasPole = true;
    const bob = Math.sin(r.ph * 2) * 0.008 * wk;
    ik.p.set(mix(0.1, 0.36, wk), mix(1.24, 1.36, wk) + bob + 0.008 * r.breath, mix(-0.36, -0.18, wk));
    const hx = mix(0, 0.12, wk), hy = mix(-1, 0.55, wk), hz = mix(-0.08, 0.83, wk);
    const l = Math.hypot(hx, hy, hz); ik.h.set(hx / l, hy / l, hz / l);
    ik.b.set(mix(1, 0.2, wk), mix(0, 0.5, wk), mix(0, -0.4, wk)).normalize();
    ik.pole.set(1, -0.2, 0.9);
    ctl.ik.grip = Math.max(ctl.ik.grip, 1 - wk);
  },
  post(ctl) {
    const a = ctl.acts.find(x => x.name === 'groggy' && !x.out);
    if (a && a.td > 0.8 && a.td < 4.0) {
      const P = ctl.pose, t = ctl.t, k = a.w;
      _q0.setFromEuler(_e0.set(Math.sin(t * 1.3) * 0.1 * k, Math.sin(t * 0.9) * 0.2 * k, Math.sin(t * 1.1 + 1) * 0.12 * k, 'YXZ'));
      P.wq[ctl.B.head].multiply(_q0); P.fkChildren(ctl.B.head);
    }
  },
  events: {
    hit(ctl, a, pos) {
      if (!pos || ctl.opts.impactFx === false) return;
      const gy = ctl.root.position.y;
      if (pos.y - gy < 1.2) { const g = pos.clone(); g.y = gy + 0.05; ctl.fx('dust', g, 10, { scale: 1.5 }); ctl.fx('spark', pos, 20, { scale: 1.1 }); }
      else ctl.fx('spark', pos, 14, { scale: 1.0 });
    },
    wave(ctl, a, pos) { if (pos) { const g = pos.clone(); g.y = ctl.root.position.y + 0.05; for (let i = 0; i < 26; i++) ctl.fx('flame', g, 1, { scale: 1.8, up: 1.4 }); ctl.fx('spark', g, 24, { scale: 1.2 }); } },
    ignite(ctl, a, pos) { if (pos) for (let i = 0; i < 16; i++) ctl.fx('flame', pos, 1, { scale: 1.2 }); },
    summon(ctl, a, pos) { if (pos) { for (let i = 0; i < 30; i++) ctl.fx('flame', pos, 1, { scale: 1.6, up: 2.5 }); ctl.fx('spark', pos, 30, { scale: 1.3 }); } },
    roar(ctl, a, pos) { const p = new THREE.Vector3(); ctl._socketWorld(ctl.sockets.back, p); for (let i = 0; i < 30; i++) ctl.fx('ember', p, 1, { scale: 1.6 }); },
    land(ctl, a, pos) { if (pos) { const g = pos.clone(); g.y = ctl.root.position.y + 0.05; ctl.fx('dust', g, 20, { scale: 2 }); ctl.fx('spark', g, 20, { scale: 1.2 }); } },
    jump(ctl, a, pos) { if (pos) { const g = pos.clone(); g.y = ctl.root.position.y + 0.05; ctl.fx('dust', g, 10, { scale: 1.6 }); } },
    drop(ctl) { ctl.drop('sword', { T: 0.6, rest: 0.03 }); },
    kneel(ctl, a, pos) { if (pos) { const g = pos.clone(); g.y = ctl.root.position.y + 0.05; ctl.fx('dust', g, 10, { scale: 1.5 }); } },
    fall(ctl, a, pos) { if (pos) { const g = pos.clone(); g.y = ctl.root.position.y + 0.05; ctl.fx('dust', g, 24, { scale: 2.4 }); } },
  },
  actions: {},
};

const _q0 = new THREE.Quaternion(), _e0 = new THREE.Euler();

// ------------------------------------------------------------------------------------------------ greatsword
function buildSword() {
  const acc = new BossAcc();
  const sk = rigid(0);
  const G = new THREE.Vector3(...GRIP), h = new THREE.Vector3(...H0), bl = new THREE.Vector3(...B0), n = new THREE.Vector3().crossVectors(h, bl);
  const at = (d) => G.clone().addScaledVector(h, d);
  const cI = col(C.blade), cIL = col(C.bladeL), cE = col(0xff5a1a), cT = col(C.trim), cL = col(0x2a1a12);
  // grip (leather wrap) + skull pommel
  acc.add(sweep([at(-0.22), at(-0.18), at(0.08)], [0.03, 0.028, 0.028], { radial: 8 }), { skin: sk, dtl: [0, 0.1, 0.3, 0.5], color: (p, nn, uv) => (Math.sin(uv[1] * 60) > 0 ? cL : col(0x1a100a)), ext: [0.08, 0, 0, 0] });
  acc.add(new THREE.SphereGeometry(0.05, 12, 8), { matrix: new THREE.Matrix4().makeScale(0.8, 0.8, 1).setPosition(at(-0.25)), skin: sk, color: cT, dtl: DT.metal, ext: [0.6, 0, 0, 0] });
  for (const s of [-1, 1]) acc.add(new THREE.SphereGeometry(0.01, 6, 4), { matrix: new THREE.Matrix4().setPosition(at(-0.26).addScaledVector(bl, s * 0.018).addScaledVector(n, 0.04)), skin: sk, color: 0xff6a20, emis: 3, ext: [0, 0, 0, 1] });
  // crossguard: swept demon horns
  acc.add(new THREE.BoxGeometry(0.07, 0.06, 0.06), { matrix: new THREE.Matrix4().setPosition(at(0.1)), skin: sk, color: cI, dtl: DT.metal, ext: [0.5, 0, 0, 0] });
  for (const s of [-1, 1]) {
    const pts = bez(at(0.1).toArray(), at(0.1).addScaledVector(bl, s * 0.14).toArray(), at(0.2).addScaledVector(bl, s * 0.22).toArray(), 8);
    acc.add(sweep(pts, taper(8, 0.03, 0.004), { radial: 7, capStart: true }), { skin: sk, dtl: DT.metal, color: (p, nn, uv) => (uv[1] > 0.8 ? cE : cI), emis: (p, uv) => (uv[1] > 0.8 ? 2 : 0), ext: (p, uv) => [0.5, 0, 0, uv[1] > 0.8 ? 4 : 0] });
  }
  // blade: tapered, serrated near the guard, molten fuller down the middle and a burning edge band
  const NU = 7, NV = 16, P = [], UV = [], I = [];
  const half = (v) => 0.09 * (1 - v * 0.5) * (v > 0.9 ? (1 - v) / 0.1 : 1) + 0.004 + (v < 0.35 ? Math.max(0, Math.sin(v * 60)) * 0.012 : 0);
  const th = (u) => 0.022 * (1 - Math.abs(u) ** 1.5) + 0.002;
  const vert = (u, v, side) => { const d = BLADE0 + v * (BLADE1 - BLADE0); return at(d).addScaledVector(bl, u * half(v)).addScaledVector(n, side * th(u) * 0.5); };
  for (const side of [1, -1]) {
    const base = P.length / 3;
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const u = i / (NU - 1) * 2 - 1, v = j / (NV - 1); const p = vert(u, v, side); P.push(p.x, p.y, p.z); UV.push(Math.abs(u), v); }
    for (let j = 0; j < NV - 1; j++) for (let i = 0; i < NU - 1; i++) { const a = base + j * NU + i; if (side > 0) I.push(a, a + NU, a + 1, a + 1, a + NU, a + NU + 1); else I.push(a, a + 1, a + NU, a + 1, a + NU + 1, a + NU); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
  acc.add(g, {
    skin: sk, dtl: DT.metal,
    color: (p, nn, uv) => (uv[0] > 0.9 ? cE : uv[0] < 0.06 ? cE : lerp3(cI, cIL, sstep(0.45, 0.88, uv[0]) * 0.9)),
    emis: (p, uv) => (uv[0] > 0.9 ? 2.6 : uv[0] < 0.06 ? 2.0 * (0.5 + 0.5 * Math.sin(uv[1] * 40)) : 0),
    ext: (p, uv) => [0.6, 0, uv[0] < 0.45 ? 0.25 : 0, uv[0] > 0.9 ? 2 : uv[0] < 0.06 ? 4 : 0],
  });
  return acc;
}

// ------------------------------------------------------------------------------------------------ actions
const A = varkhul.actions;
const OVER = { $handR: [0.14, 1.9, 0.06], $aimR: aim([0.02, 0.4, 0.92], [0, 0.92, -0.4]) };
const CHOP = { $handR: [0.06, 1.0, -0.62], $aimR: aim([0, -0.45, -0.89], [0, -0.89, 0.45]) };

A.idle = { dur: 3, keys: [[0, {}]] };
A.walk = { dur: 1 / 1.0, hits: [0, 0.5], keys: [[0, {}]] };
A.run = { dur: 1 / 1.5, hits: [0, 0.5 / 1.5], keys: [[0, {}]] };
A.spawn = { dur: 0.9, hits: [], lock: 1, fadeIn: 0.02, keys: [[0, { $hips: [0, -0.1, 0], 'chest+': [-0.12, 0, 0] }], [0.9, {}]] };

A.slash_combo = {
  dur: 2.6, hits: [0.55, 1.15, 1.9], hitAt: ['weapon', 'weapon', 'weaponTip'], lock: 1, active: [[0.45, 0.65], [1.05, 1.25], [1.85, 2.0]],
  keys: [
    [0, {}],
    [0.32, K2(TW(-0.25), { $handR: [0.42, 1.72, 0.04], $aimR: aim([0.45, 0.72, 0.52], [-0.5, 0.1, -0.85]), $gripL: 1, $hips: [0, -0.04, 0.02], $charge: 0.4 }), 'o'],
    [0.55, K2(TW(0.22), { $handR: [-0.22, 1.0, -0.42], $aimR: aim([-0.55, -0.5, -0.66], [-0.3, -0.7, 0.65]), $gripL: 1, $hips: [0, -0.08, -0.05], $footL: [-0.16, 0, -0.3], $charge: 1 }), 'i'],
    [0.8, K2(TW(0.3), { $handR: [-0.42, 1.28, -0.12], $aimR: aim([-0.9, 0.1, 0.4], [0.35, 0, -0.95]), $gripL: 1, $hips: [0, -0.06, -0.03], $footL: [-0.16, 0, -0.3], $charge: 0.8 }), 'o'],
    [1.15, K2(SW(-40, 1.3, -1, 0.56), TW(-0.18), { $gripL: 1, $hips: [0, -0.07, -0.04], $footL: [-0.16, 0, -0.3], $charge: 1 }), 'i'],
    [1.3, K2(SW(-95, 1.32, -1, 0.5), TW(-0.3), { $gripL: 1, $hips: [0, -0.06, -0.03], $charge: 0.8 }), 'o'],
    [1.62, K2(OVER, { 'spine+': [0.12, -0.05, 0], 'chest+': [0.16, -0.05, 0], 'head+': [0.1, 0, 0], $gripL: 1, $hips: [0, -0.02, 0.02], $charge: 1 }), 'o'],
    [1.9, K2(CHOP, { 'spine+': [-0.2, 0, 0], 'chest+': [-0.26, 0, 0], 'head+': [-0.1, 0, 0], $gripL: 1, $hips: [0, -0.12, -0.08], $footR: [0.16, 0, -0.34], $charge: 1 }), 'i'],
    [2.2, K2(CHOP, { 'spine+': [-0.16, 0, 0], 'chest+': [-0.2, 0, 0], $gripL: 1, $hips: [0, -0.1, -0.07], $footR: [0.16, 0, -0.34], $charge: 0.4 }), 'o'],
    [2.6, { $gripL: 0, $charge: 0, $footL: null, $footR: null }],
  ],
};

A.overhead = {
  dur: 2.2, hits: [1.2], hitAt: ['weaponTip'], lock: 1,
  keys: [
    [0, {}],
    [0.45, { $handR: [0.36, 1.55, -0.1], $aimR: aim([0.05, 0.75, 0.66], [0, 0.66, -0.75]), $gripL: 1, 'spine+': [0.05, -0.1, 0], 'chest+': [0.08, -0.12, 0], $charge: 0.5 }, 'o'],
    [0.98, K2(OVER, { 'spine+': [0.16, -0.05, 0], 'chest+': [0.2, -0.05, 0], 'head+': [0.16, 0, 0], $gripL: 1, $hips: [0, -0.03, 0.03], $charge: 0.9 }), 'o'],
    [1.2, K2(CHOP, { 'spine+': [-0.22, 0, 0], 'chest+': [-0.3, 0, 0], 'head+': [-0.12, 0, 0], $gripL: 1, $hips: [0, -0.14, -0.08], $footL: [-0.16, 0, -0.34], $charge: 1, $shake: 0.4 }), 'i'],
    [1.65, K2(CHOP, { 'spine+': [-0.18, 0, 0], 'chest+': [-0.24, 0, 0], $gripL: 1, $hips: [0, -0.12, -0.07], $footL: [-0.16, 0, -0.34], $charge: 0.4 }), 'o'],
    [2.2, { $gripL: 0, $charge: 0, $footL: null }],
  ],
  ev: [[1.2, 'wave', 'weaponTip']],
};

A.fire_wave = {
  dur: 2.6, hits: [1.35], hitAt: ['weaponTip'], lock: 1, active: [[1.35, 2.2]],
  keys: [
    [0, {}],
    [0.8, K2(TW(-0.35), { $handR: [0.46, 0.86, 0.3], $aimR: aim([0.3, -0.62, 0.72], [0.1, 0.75, 0.62]), $gripL: 1, $hips: [0, -0.14, 0.06], 'head+': [0, -0.25, 0], $charge: 1, $body: 0.5 }), 'o'],
    [1.12, K2(TW(-0.15), { $handR: [0.32, 0.8, -0.12], $aimR: aim([0.2, -0.86, -0.3], [0, 0.3, -0.95]), $gripL: 1, $hips: [0, -0.16, -0.02], $charge: 1, $body: 0.6 }), 'l'],
    [1.35, K2(TW(0.15), { $handR: [0.08, 1.6, -0.5], $aimR: aim([0, 0.62, -0.78], [0, 0.78, 0.62]), $gripL: 1, $hips: [0, -0.02, -0.1], $footL: [-0.16, 0, -0.32], 'spine+': [0.1, 0, 0], 'chest+': [0.12, 0, 0], 'head+': [0.1, 0, 0], $charge: 1, $body: 0.8 }), 'i'],
    [1.75, K2(TW(0.22), { $handR: [-0.05, 1.9, -0.2], $aimR: aim([-0.1, 0.9, 0.35], [0, 0.35, -0.94]), $gripL: 1, $hips: [0, 0, -0.08], $footL: [-0.16, 0, -0.32], $charge: 0.6, $body: 0.4 }), 'o'],
    [2.6, { $gripL: 0, $charge: 0, $body: 0, $footL: null }],
  ],
  ev: [[0.75, 'ignite', 'weaponTip'], [1.35, 'wave', 'weaponTip']],
};

// game-driven leap (root arc by the encounter): crouch, airborne with the blade overhead, slam on landing
A.leap = {
  dur: 2.4, hits: [1.5], hitAt: ['weaponTip'], lock: 1, move: [{ t: [0.45, 1.5], dist: 'target', height: 4 }],
  keys: [
    [0, {}],
    [0.3, { $hips: [0, -0.18, 0.04], 'spine+': [-0.15, 0, 0], $handR: [0.4, 1.25, 0.18], $aimR: aim([0.08, 0.75, 0.66], [0, 0.66, -0.75]), $gripL: 1, $charge: 0.5 }, 'o'],
    [0.5, { $hips: [0, 0.05, 0], $air: 0.8, $handR: [0.22, 1.8, 0.05], $aimR: aim([0.02, 0.5, 0.86], [0, 0.86, -0.5]), $gripL: 1 }, 'o'],
    [0.95, K2(OVER, { $hips: [0, 0.1, 0], $air: 1, 'spine+': [0.16, 0, 0], 'chest+': [0.2, 0, 0], $gripL: 1, $charge: 1 }), 'o'],
    [1.36, K2(OVER, { $hips: [0, 0.04, 0], $air: 1, 'spine+': [0.1, 0, 0], $gripL: 1, $charge: 1 }), 'io'],
    [1.5, K2(CHOP, { $hips: [0, -0.18, -0.08], $air: 0, 'spine+': [-0.22, 0, 0], 'chest+': [-0.28, 0, 0], $gripL: 1, $charge: 1, $shake: 0.4 }), 'i'],
    [1.95, K2(CHOP, { $hips: [0, -0.15, -0.07], 'spine+': [-0.18, 0, 0], 'chest+': [-0.22, 0, 0], $gripL: 1, $charge: 0.4 }), 'o'],
    [2.4, { $gripL: 0, $charge: 0 }],
  ],
  ev: [[0.45, 'jump', 'feetL'], [1.5, 'land', 'weaponTip']],
};

A.summon = {
  dur: 3.0, hits: [1.8], hitAt: ['weaponTip'], lock: 1,
  keys: [
    [0, {}],
    [0.7, { $handR: [0.06, 1.72, -0.28], $aimR: aim([0, 1, 0.05], [1, 0, 0]), $gripL: 1, 'chest+': [0.08, 0, 0], 'head+': [0.2, 0, 0], $charge: 0.6, $body: 0.3 }, 'o'],
    [1.55, { $handR: [0.05, 1.98, -0.22], $aimR: aim([0, 1, 0.08], [1, 0, 0]), $gripL: 1, 'chest+': [0.18, 0, 0], 'spine+': [0.06, 0, 0], 'head+': [0.4, 0, 0], $hips: [0, 0.02, 0.03], $charge: 1, $body: 0.8, $shake: 0.4 }, 'io'],
    [1.8, { $handR: [0.05, 2.02, -0.2], $aimR: aim([0, 1, 0.06], [1, 0, 0]), $gripL: 1, 'chest+': [0.2, 0, 0], 'head+': [0.45, 0, 0], $charge: 1, $body: 1, $shake: 0.8 }, 'i'],
    [2.4, { $handR: [0.08, 1.4, -0.34], $aimR: aim([0, -1, -0.08], [1, 0, 0]), $gripL: 1, 'chest+': [0, 0, 0], 'head+': [0, 0, 0], $charge: 0.3, $body: 0.2 }, 'io'],
    [3.0, { $gripL: 0, $charge: 0, $body: 0 }],
  ],
  ev: [[1.8, 'summon', 'weaponTip']],
};

A.roar = {
  dur: 2.4, hits: [0.9], hitAt: ['chest'], lock: 1,
  keys: [
    [0, {}],
    [0.55, { $gripL: 0, 'spine+': [0.1, 0, 0], 'chest+': [0.18, 0, 0], 'head+': [0.35, 0, 0], armUL: [0.1, 0, -0.4], armLL: [0.9, 0, 0], fingL: [1.2, 0, 0], $handR: [0.62, 1.1, -0.2], $aimR: aim([0.2, -1, -0.1], [1, 0, 0]), $body: 0.4 }, 'o'],
    [0.9, { 'spine+': [-0.08, 0, 0], 'chest+': [-0.16, 0, 0], 'head+': [-0.2, 0, 0], armUL: [0.4, 0, -1.1], armLL: [1.3, 0, 0], fingL: [1.2, 0, 0], $hips: [0, -0.06, -0.02], $handR: [0.7, 1.2, -0.25], $aimR: aim([0.4, -0.9, -0.1], [1, 0, 0]), $shake: 1, $body: 1, $enrage: 0.4 }, 'i'],
    [1.9, { 'spine+': [-0.06, 0, 0], 'chest+': [-0.14, 0, 0], 'head+': [-0.18, 0, 0], armUL: [0.4, 0, -1.05], armLL: [1.25, 0, 0], $shake: 0.9, $body: 1 }],
    [2.4, { armUL: null, armLL: null, fingL: null, $body: 0, $enrage: 0 }],
  ],
  ev: [[0.9, 'roar', 'mouth']],
};

A.groggy = {
  dur: 5.0, hits: [], lock: 1, stretch: [1.0, 4.0], sustain: [1.2, 3.8],
  keys: [
    [0, {}],
    [0.25, { $gripL: 0, 'chest+': [0.2, 0, 0.1], 'head+': [0.3, 0.2, 0], $hips: [0, 0, 0.06], $eyes: 0.6 }, 'o'],
    [0.8, K2(KNEEL_R, { $hips: [0, -0.38, 0.05], $handR: [0.3, 0.9, -0.3], $aimR: aim([0.05, -1, -0.1], [1, 0, 0]), armUL: [0.2, 0, 0.25], armLL: [0.4, 0, 0], 'head+': [-0.5, 0.15, 0.1], 'chest+': [-0.25, 0, 0.06], $eyes: 0.3 }), 'i'],
    [4.0, K2(KNEEL_R, { $hips: [0, -0.38, 0.05], $handR: [0.3, 0.9, -0.3], $aimR: aim([0.05, -1, -0.1], [1, 0, 0]), armUL: [0.2, 0, 0.25], armLL: [0.4, 0, 0], 'head+': [-0.5, 0.15, 0.1], 'chest+': [-0.25, 0, 0.06], $eyes: 0.3 })],
    [4.4, K2(KNEEL_R, { $hips: [0, -0.34, 0.05], 'head+': [0.1, -0.3, 0], $eyes: 0.8 }), 'io'],
    [5.0, { $footR: null, $footL: null, armUL: null, armLL: null, $eyes: 1 }],
  ],
};

A.death = {
  dur: 4.0, hits: [1.5, 2.8], hitAt: ['feetR', 'chest'], hold: true, fadeIn: 0.1,
  keys: [
    [0, {}],
    [0.45, { $gripL: 0, 'spine+': [0.22, 0, 0], 'chest+': [0.28, 0, 0], 'head+': [0.45, 0, 0], armUL: [-0.2, 0, -0.8], armLL: [0.5, 0, 0], $hips: [0, 0.02, 0.06], $shake: 0.9, $freeR: 0 }, 'o'],
    [0.6, { $freeR: 1, armUR: [-0.2, 0, 0.9], armLR: [0.4, 0, 0] }],
    [1.5, { 'spine+': [-0.25, 0, 0.05], 'chest+': [-0.22, 0, 0], 'head+': [-0.45, 0.2, 0], armUL: [0.1, 0, -0.2], armLL: [0.3, 0, 0], armUR: [0.1, 0, 0.2], armLR: [0.3, 0, 0], $hips: [0, -0.46, 0.08], $footL: [-0.15, 0.03, 0.34, 0.6, 0], $footR: [0.15, 0.03, 0.32, 0.6, 0], $freeR: 1, $eyes: 0.7 }, 'i'],
    [2.1, { 'spine+': [-0.3, 0.05, 0.08], 'chest+': [-0.25, 0, 0.05], 'head+': [-0.5, 0.25, 0], $hips: [0, -0.48, 0.08], $freeR: 1, $eyes: 0.5 }, 'o'],
    [2.8, { hips: [-1.4, 0.1, 0.1], 'spine+': [-0.1, 0, 0], head: [0.35, 0.9, 0.2], armUL: [1.4, 0, -0.4], armLL: [0.3, 0, 0], armUR: [1.3, 0, 0.5], armLR: [0.3, 0, 0], $hips: [0, -0.8, -0.4], $footL: [-0.15, 0.04, 0.62, 0.9, 0], $footR: [0.15, 0.04, 0.6, 0.9, 0], $freeR: 1, $eyes: 0.25 }, 'i'],
    [4.0, { hips: [-1.42, 0.1, 0.1], 'spine+': [-0.08, 0, 0], head: [0.38, 0.9, 0.2], armUL: [1.4, 0, -0.45], armLL: [0.3, 0, 0], armUR: [1.3, 0, 0.55], armLR: [0.3, 0, 0], $hips: [0, -0.82, -0.4], $footL: [-0.15, 0.04, 0.62, 0.9, 0], $footR: [0.15, 0.04, 0.6, 0.9, 0], $freeR: 1, $eyes: 0 }],
  ],
  ev: [[0.55, 'drop'], [1.5, 'kneel', 'feetR'], [2.8, 'fall', 'chest']],
};

A.intro = {
  dur: 3.5, hits: [1.0, 2.3], hitAt: ['weaponTip', 'chest'], lock: 1, fadeIn: 0.01, stretch: [0.1, 0.6],
  keys: [
    [0, K2(KNEEL_R, { $hips: [0, -0.38, 0.05], $handR: [0.12, 1.12, -0.36], $aimR: aim([0, -1, -0.06], [1, 0, 0]), $gripL: 1, 'head+': [-0.45, 0, 0], 'chest+': [-0.2, 0, 0], $body: 0.3 })],
    [0.621, K2(KNEEL_R, { $hips: [0, -0.36, 0.05], $handR: [0.12, 1.14, -0.36], $aimR: aim([0, -1, -0.06], [1, 0, 0]), $gripL: 1, 'head+': [0.05, 0, 0], 'chest+': [0, 0, 0], $body: 0.6 }), 'io'],
    [1, { $footR: null, $footL: null, $hips: [0, -0.05, 0], $handR: [0.62, 1.28, -0.35], $aimR: aim([0.75, 0.3, -0.58], [0.5, -0.1, 0.85]), $gripL: 0, armUL: [0.1, 0, -0.5], 'head+': [0, -0.2, 0], $charge: 1, $body: 0.4 }, 'i'],
    [1.7, { $hips: [0, 0, 0], $handR: [0.66, 1.2, -0.2], $aimR: aim([0.65, -0.55, -0.3], [0.3, -0.3, 0.9]), armUL: [0.05, 0, -0.3], $charge: 0.6 }, 'io'],
    [2.3, { $handR: [0.36, 1.45, -0.62], $aimR: aim([0.2, 0.2, -0.96], [0, 1, 0.2]), armUL: [0.35, 0, -0.9], armLL: [1.2, 0, 0], fingL: [1.2, 0, 0], 'head+': [0.25, 0, 0], 'chest+': [0.08, 0, 0], $charge: 1, $shake: 0.6, $body: 0.8 }, 'i'],
    [2.975, { $handR: [0.36, 1.43, -0.6], $aimR: aim([0.2, 0.2, -0.96], [0, 1, 0.2]), armUL: [0.3, 0, -0.85], armLL: [1.2, 0, 0], $charge: 0.8, $shake: 0.3, $body: 0.6 }],
    [3.5, { armUL: null, armLL: null, fingL: null, $charge: 0, $body: 0 }],
  ],
  ev: [[1.0, 'wave', 'weaponTip'], [2.3, 'roar', 'mouth']],
};

A.hit = { dur: 0.5, hits: [], fadeIn: 0.04, keys: [[0, {}], [0.12, { 'chest+': [0.12, 0.08, 0.05], 'head+': [0.2, 0.1, 0], $hips: [0, -0.02, 0.03] }, 'o'], [0.5, {}]] };
