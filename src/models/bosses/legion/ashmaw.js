// Ashmaw, the Siege Behemoth — the prologue's wall-breaker (Brighthold burns; the heroes man the cannons).
// Original design: ~15 m knuckle-walking demon beast. Enormous fore-limbs ending in scarred fists, a towering hump
// crowned with rows of obsidian spikes, charred hide split by molten fissures, bone plates on shoulders and back,
// a low battering-ram skull with a bony crest and small burning eyes, a huge jaw that opens on a furnace maw,
// broken Legion shackles with chain ends on the wrists, and spent ballista bolts stuck in its hide.
// Sculpted in units (hump ≈ 2.5 tall), scale 6 → metres.
import * as THREE from 'three';
import { sweep, rigid, bez, taper } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { lerp3 } from '../../kit/parts.js';
import { clamp01, mix, sstep, TAU } from '../../kit/rig.js';
import { quadCarriage } from './boss.js';

const C = {
  hide: 0x1b1515, hideL: 0x3a2c28, belly: 0x2c1a14, bone: 0x8e7e68, boneT: 0xcab89a, obs: 0x151218, obsT: 0xff7a26,
  glow: 0xff7a22, maw: 0xff6a18, eye: 0xffd050, iron: 0x2a2628, ironL: 0x5a5458, wood: 0x4a3222,
};
const DT = { hide: [0.2, 0.35, 0.3, 0], bone: [0.2, 0.05, 0.3, 0.3], metal: [0, 0.02, 0.32, 0.06] };
const HP = [0, 1.45, -1.15], HS = 1.0;
const H = (x, y, z) => [HP[0] + x * HS, HP[1] + y * HS, HP[2] + z * HS];

export const ashmaw = {
  meta: { name: 'Ashmaw', title: 'the Siege Behemoth', height: 15, radius: 6, walkSpeed: 2.2, runSpeed: 3 },
  scale: 6,
  h: 0.046, hg: { 1: 0.04, 2: 0.029, 3: 0.032 },
  ao: { dist: 0.06, str: 0.9 },
  grad: { top: 0.14, bottom: 0.42, y0: 0.2, y1: 1.6, low: 0.3 },
  mat: { glow: C.glow, glowK: 3.4, crackFreq: 7, crackK: 1.0, dfreq: 2.6, rim: 0.2, rimColor: 0xffb080, spec: 0.4, shine: 18, enrageCol: 0xff2a08, ghostCol: 0x6f63ff, sil: 0.32, silCol: 0x9ab0ff },
  stepFx: { n: 8, scale: 3.2 },
  particles: { add: 900, alpha: 320 },

  rig(R) {
    R.add('body', null, [0, 1.55, 0.2]);
    R.add('chest', 'body', [0, 1.75, -0.35]);
    R.add('pelvis', 'body', [0, 1.3, 0.75]);
    R.add('neck', 'chest', [0, 1.65, -0.82]);
    R.add('head', 'neck', HP);
    R.add('jaw', 'head', H(0, -0.12, -0.08));
    R.add('tail1', 'pelvis', [0, 1.35, 1.05]); R.add('tail2', 'tail1', [0, 1.15, 1.35]); R.add('tail3', 'tail2', [0, 0.9, 1.55]);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('fU' + n, 'chest', [s * 0.58, 1.85, -0.55]); R.add('fL' + n, 'fU' + n, [s * 0.78, 1.05, -0.42]); R.add('fP' + n, 'fL' + n, [s * 0.74, 0.3, -0.72]);
      R.add('rT' + n, 'pelvis', [s * 0.36, 1.25, 0.8]); R.add('rS' + n, 'rT' + n, [s * 0.44, 0.72, 0.52]); R.add('rM' + n, 'rS' + n, [s * 0.44, 0.35, 0.95]); R.add('rP' + n, 'rM' + n, [s * 0.44, 0.1, 0.86]);
      R.add('chain' + n + '1', 'fL' + n, [s * 0.8, 0.52, -0.62]); R.add('chain' + n + '2', 'chain' + n + '1', [s * 0.86, 0.32, -0.6]);
    }
  },

  sculpt(S) {
    const hd = { col: C.hide, tag: 'hide', dtl: DT.hide };
    const E = (b, c, r, o) => S.ell(b, c, r, o), K = (b, a, c2, ra, rb, o) => S.cone(b, a, c2, ra, rb, o), Q = (b, a, c2, rx, ry, o) => S.seg(b, a, c2, rx, ry, o);
    // ---------------- torso: towering hump over the shoulders, sloping to small haunches
    E('chest', [0, 1.72, -0.4], [0.62, 0.62, 0.6], { k: 0.2, ...hd });
    E('chest', [0, 2.15, -0.3], [0.5, 0.42, 0.52], { k: 0.2, ...hd, tag: 'back' });          // hump
    E('chest', [0, 1.3, -0.62], [0.42, 0.34, 0.34], { k: 0.16, col: C.belly, tag: 'belly', dtl: DT.hide });
    E('body', [0, 1.6, 0.25], [0.46, 0.46, 0.55], { k: 0.2, ...hd });
    E('body', [0, 1.85, 0.2], [0.38, 0.3, 0.45], { k: 0.16, ...hd, tag: 'back' });
    E('pelvis', [0, 1.35, 0.8], [0.4, 0.36, 0.36], { k: 0.16, ...hd });
    // neck: short, thick, head hung low and forward
    K('neck', [0, 1.72, -0.6], [0, 1.52, -1.02], 0.5, 0.36, { k: 0.18, ...hd, b2: 'head', t0: 0.6, t1: 1 });
    E('neck', [0, 1.35, -0.85], [0.34, 0.3, 0.3], { k: 0.15, col: C.belly, tag: 'belly', dtl: DT.hide });
    // ---------------- fore-limbs: colossal arms, knuckle-walking fists
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      E('fU' + n, [s * 0.58, 1.95, -0.5], [0.42, 0.4, 0.42], { k: 0.16, ...hd });                                           // shoulder mass
      K('fU' + n, [s * 0.58, 1.85, -0.55], [s * 0.78, 1.05, -0.42], 0.36, 0.26, { k: 0.12, ...hd, b2: 'fL' + n, t0: 0.8, t1: 1 });
      Q('fU' + n, [s * 0.66, 1.65, -0.64], [s * 0.76, 1.2, -0.56], 0.25, 0.24, { k: 0.1, ...hd });                              // biceps
      K('fL' + n, [s * 0.78, 1.05, -0.42], [s * 0.74, 0.34, -0.7], 0.3, 0.22, { k: 0.1, ...hd, b2: 'fP' + n, t0: 0.85, t1: 1 });
      Q('fL' + n, [s * 0.8, 0.95, -0.44], [s * 0.77, 0.55, -0.58], 0.3, 0.27, { k: 0.1, ...hd });                                // forearm bulk
      // fist (group 3): knuckles down, fingers curled under
      E('fP' + n, [s * 0.74, 0.2, -0.8], [0.24, 0.2, 0.25], { group: 3, k: 0.06, ...hd, tag: 'fist' });
      for (let f = 0; f < 4; f++) E('fP' + n, [s * (0.6 + f * 0.09), 0.1, -0.96], [0.075, 0.1, 0.09], { group: 3, k: 0.04, ...hd, tag: 'fist' });
      E('fP' + n, [s * 0.58, 0.18, -0.82], [0.08, 0.1, 0.1], { group: 3, k: 0.04, ...hd, tag: 'fist' });                          // thumb
      // hind legs (smaller)
      E('rT' + n, [s * 0.36, 1.15, 0.82], [0.26, 0.4, 0.34], { k: 0.14, ...hd, rot: [0.3, 0, 0] });
      K('rT' + n, [s * 0.36, 1.25, 0.8], [s * 0.44, 0.72, 0.52], 0.26, 0.18, { k: 0.1, ...hd, b2: 'rS' + n, t0: 0.8, t1: 1 });
      K('rS' + n, [s * 0.44, 0.72, 0.52], [s * 0.44, 0.35, 0.95], 0.17, 0.12, { k: 0.08, ...hd, b2: 'rM' + n, t0: 0.85, t1: 1 });
      K('rM' + n, [s * 0.44, 0.35, 0.95], [s * 0.44, 0.1, 0.86], 0.12, 0.1, { k: 0.06, ...hd, b2: 'rP' + n, t0: 0.8, t1: 1 });
      E('rP' + n, [s * 0.44, 0.08, 0.76], [0.17, 0.1, 0.22], { group: 3, k: 0.05, ...hd, tag: 'fist' });
      // bone plates on the shoulders (group 1)
      E('fU' + n, [s * 0.62, 2.18, -0.5], [0.34, 0.14, 0.36], { group: 1, k: 0.03, col: C.bone, tag: 'bone', dtl: DT.bone, rot: [0, 0, s * 0.4] });
      E('fU' + n, [s * 0.74, 2.0, -0.48], [0.28, 0.12, 0.3], { group: 1, k: 0.03, col: C.bone, tag: 'bone', dtl: DT.bone, rot: [0, 0, s * 0.8] });
      // broken shackle cuffs on the wrists (group 1)
      K('fL' + n, [s * 0.76, 0.6, -0.6], [s * 0.755, 0.46, -0.66], 0.25, 0.24, { group: 1, k: 0.02, col: C.iron, tag: 'iron', dtl: DT.metal });
    }
    // back plates along the spine (group 1)
    for (let i = 0; i < 5; i++) {
      const z = -0.55 + i * 0.3, y = 2.5 - i * 0.14 - (i > 2 ? (i - 2) * 0.08 : 0);
      E(i < 2 ? 'chest' : 'body', [0, y - 0.06, z], [0.3 - i * 0.03, 0.12, 0.18], { group: 1, k: 0.03, col: C.bone, tag: 'bone', dtl: DT.bone });
    }
    // tail (short, heavy)
    K('tail1', [0, 1.35, 1.02], [0, 1.15, 1.35], 0.2, 0.15, { k: 0.08, ...hd, b2: 'tail2', t0: 0.6, t1: 1 });
    K('tail2', [0, 1.15, 1.35], [0, 0.9, 1.55], 0.15, 0.08, { k: 0.06, ...hd, b2: 'tail3', t0: 0.6, t1: 1 });
    // ---------------- head (group 2): flat battering-ram skull under a sloped bone crest plate, deep eyes, underbite
    const hh = { group: 2, ...hd, tag: 'head' };
    E('head', H(0, 0.03, -0.12), [0.31, 0.19, 0.4], { k: 0.08, ...hh });
    E('head', H(0, 0.15, -0.28), [0.3, 0.11, 0.3], { group: 2, k: 0.05, col: C.bone, tag: 'crest', dtl: DT.bone, rot: [0.4, 0, 0], mod: (x, y, z, d) => Math.max(d, H(0, 0.06, 0)[1] - y) });   // rounded ram plate
    E('head', H(0, 0.2, -0.12), [0.22, 0.08, 0.14], { group: 2, k: 0.04, col: C.bone, tag: 'crest', dtl: DT.bone });                                                                        // crest boss
    for (const s of [-1, 1]) {
      E('head', H(s * 0.21, 0.07, -0.42), [0.12, 0.06, 0.1], { group: 2, k: 0.04, col: C.bone, tag: 'crest', dtl: DT.bone, rot: [0.2, s * 0.3, s * 0.4] });  // brow plate
      E('head', H(s * 0.23, -0.07, -0.18), [0.13, 0.13, 0.2], { k: 0.06, ...hh });                                                                          // cheek / masseter
      E('head', H(s * 0.19, 0.02, -0.45), [0.045, 0.028, 0.035], { group: 2, k: 0.015, sub: true, col: 0x0a0404, tag: 'socket', rot: [0, 0, s * 0.3] });
      E('head', H(s * 0.09, -0.04, -0.74), [0.04, 0.03, 0.05], { group: 2, k: 0.015, sub: true, col: 0x0a0404, tag: 'mouth' });                             // nostrils
    }
    S.seg('head', H(0, 0.0, -0.3), H(0, -0.06, -0.72), 0.25, 0.14, { k: 0.07, ...hh });                                                                     // wedge snout
    E('head', H(0, -0.13, -0.42), [0.23, 0.05, 0.3], { group: 2, k: 0.03, sub: true, col: C.maw, tag: 'mouth' });
    // jaw (group 2): heavy, jutting underbite
    S.seg('jaw', H(0, -0.2, -0.08), H(0, -0.24, -0.66), 0.28, 0.13, { group: 2, k: 0.06, ...hd, tag: 'jaw' });
    E('jaw', H(0, -0.16, -0.38), [0.21, 0.05, 0.28], { group: 2, k: 0.03, sub: true, col: C.maw, tag: 'mouth' });
  },

  paint(v, X) {
    const [x, y, z] = v.p, ny = v.n[1];
    const hide = v.t('hide') + v.t('back') + v.t('head') + v.t('jaw') + v.t('fist');
    v.mix(C.hideL, sstep(0.3, 0.9, ny) * 0.2 * (1 - v.t('belly')));
    v.mix(0x050304, sstep(0.5, 0.1, y) * 0.4);
    X[0] = 0.03;
    let cr = 0.7 * (0.55 + 0.45 * sstep(0.2, 0.9, -ny + 0.4));
    if (v.group === 2) cr *= 0.35;
    if (v.group === 3) cr *= 0.3;
    X[2] = cr * Math.min(1, hide + v.t('belly'));
    if (v.t('belly') > 0.3) v.emis = 0.12 * v.t('belly');
    if (v.t('bone') > 0.3 || v.t('crest') > 0.3) { X[0] = 0.12; X[2] = 0.15; v.mix(C.boneT, sstep(0.4, 0.95, ny) * 0.35); v.mix(0x3a2a1e, sstep(-0.3, -0.8, ny) * 0.5); if (v.t('crest') > 0.3) v.mul(0.85 + 0.15 * Math.sign(Math.sin(z * 55 + y * 20))); }
    if (v.t('iron') > 0.3) { X[0] = 0.3; X[2] = 0; v.mix(C.ironL, sstep(0.3, 0.9, ny) * 0.3); }
    if (v.t('mouth') > 0.3) { const deep = sstep(-1.75, -1.35, z); v.mix(0x2a0604, 0.9); v.mix(C.maw, deep); v.mix(0xffd090, sstep(-1.45, -1.3, z) * 0.6); v.emis = 0.3 + 2.4 * deep; X[3] = 1; X[2] = 0; }
    if (v.t('socket') > 0.3) { v.mix(0x4a0c04, 0.8); v.emis = 1.0; X[3] = 1; X[2] = 0; }
  },

  parts(acc, S, R, out) {
    const b = (n) => R.index(n);
    const hb = rigid(b('head')), jb = rigid(b('jaw'));
    const skinAt = (p) => { const s = S.sampleAt(p[0], p[1], p[2]); return { si: s.si, sw: s.sw }; };
    // eyes: small, deep, burning
    for (const s of [-1, 1]) {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(...H(s * 0.19, 0.02, -0.43)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s * 0.45, s * 0.3, 'YXZ')), new THREE.Vector3(1.4, 0.5, 0.7));
      acc.add(new THREE.SphereGeometry(0.05, 12, 8), { matrix: m, skin: hb, color: C.eye, emis: 5, dtl: [0, 0, 0, 0], ext: [0, 0, 0, 1] });
    }
    // horns: two thick ram horns sweeping forward from the crest (battering ram), bone → dark tips
    const cB = col(C.bone), cBT = col(C.boneT), cO = col(C.obs), cOT = col(C.obsT);
    for (const s of [-1, 1]) {
      const a0 = new THREE.Vector3(...H(s * 0.27, 0.16, -0.12));
      const pts = [];
      for (let i = 0; i < 16; i++) { const u = i / 15, ang = u * 3.6; const r = 0.26 * (1 - u * 0.4); pts.push(new THREE.Vector3(a0.x + s * (0.08 + u * 0.2), a0.y + Math.sin(ang) * r * 0.8 - u * 0.12, a0.z - (1 - Math.cos(ang)) * r * 0.9 + 0.04)); }
      acc.add(sweep(pts, taper(16, 0.13, 0.015, 1.05), { radial: 12, capStart: true }), { skin: hb, dtl: DT.bone, color: (p, n, uv) => (Math.abs(Math.sin(uv[1] * 40)) < 0.25 ? lerp3(cB, col(0x3a2e24), 0.6) : lerp3(col(0x3a2e24), cBT, Math.pow(uv[1], 0.7))), ext: [0.15, 0, 0, 0] });
    }
    // tusks from the underbite + upper fangs
    for (const s of [-1, 1]) {
      acc.add(sweep(bez(H(s * 0.2, -0.24, -0.56), H(s * 0.26, -0.06, -0.64), H(s * 0.22, 0.1, -0.6), 7), taper(7, 0.06, 0.004), { radial: 9 }), { skin: jb, color: (p, n, uv) => lerp3(cB, cBT, uv[1]), dtl: DT.bone, ext: [0.2, 0, 0, 0] });
      for (let i = 0; i < 4; i++) {
        const zz = -0.62 + i * 0.08;
        acc.add(sweep([H(s * (0.09 + i * 0.035), -0.12, zz), H(s * (0.09 + i * 0.035), -0.21, zz)], [0.026, 0.003], { radial: 5 }), { skin: hb, color: cBT, dtl: DT.bone });
        acc.add(sweep([H(s * (0.1 + i * 0.035), -0.2, zz + 0.04), H(s * (0.1 + i * 0.035), -0.13, zz + 0.04)], [0.022, 0.003], { radial: 5 }), { skin: jb, color: cBT, dtl: DT.bone });
      }
    }
    // obsidian spikes: rows along the hump and spine (glowing tips)
    let seed = 5; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const spike = (p0, d, L, r) => {
      const { p: q } = S.project(p0.slice(), 0, 3);
      const D = new THREE.Vector3(...d).normalize(), a = new THREE.Vector3(...q).addScaledVector(D, -r * 0.8);
      acc.add(sweep([a, a.clone().addScaledVector(D, L * 0.5), a.clone().addScaledVector(D, L)], [r, r * 0.55, r * 0.04], { radial: 7, capStart: true }), {
        skin: skinAt(q), dtl: DT.bone, color: (pp, n, uv) => (uv[1] > 0.84 ? cOT : lerp3(cO, col(0x3a3040), uv[1] * 0.6)),
        emis: (pp, uv) => (uv[1] > 0.84 ? 2.4 : 0), ext: (pp, uv) => [0.35, 0, 0, uv[1] > 0.84 ? 4 : 0],
      });
    };
    for (let i = 0; i < 12; i++) {
      const u = i / 11, z = -0.6 + u * 1.55;
      const y = 2.6 - Math.max(0, u - 0.15) * 1.0 - (u > 0.6 ? (u - 0.6) * 0.4 : 0);
      const L = 0.55 * (1 - Math.abs(u - 0.25) * 1.1) + 0.12;
      spike([0, y, z], [0, 1, 0.45 + u * 0.3], L, 0.1 * (0.6 + L));
      if (i % 2 === 0 && u < 0.8) for (const s of [-1, 1]) spike([s * 0.3 * (1 - u * 0.4), y - 0.12, z + 0.05], [s * 0.6, 1, 0.4], L * 0.7, 0.07 * (0.6 + L));
    }
    // shoulder spikes
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) spike([s * (0.62 + i * 0.1), 2.26 - i * 0.12, -0.55 + i * 0.05], [s * 0.8, 1, -0.2], 0.4 - i * 0.08, 0.075);
    // ballista bolts stuck in the hide (siege scars)
    const cW = col(C.wood), cF = col(0x7a6a5a);
    const bolt = (p0, d) => {
      const { p: q } = S.project(p0.slice(), 0, 3);
      const D = new THREE.Vector3(...d).normalize(), a = new THREE.Vector3(...q).addScaledVector(D, -0.12);
      acc.add(sweep([a, a.clone().addScaledVector(D, 0.7)], [0.022, 0.022], { radial: 5, capStart: true }), { skin: skinAt(q), color: cW, dtl: [0, 0, 0.2, 0.6] });
      const fl = a.clone().addScaledVector(D, 0.62);
      for (let k = 0; k < 3; k++) { const ang = k * TAU / 3; const o = new THREE.Vector3(Math.cos(ang), 0.2, Math.sin(ang)).normalize().multiplyScalar(0.06); acc.add(sweep([fl, fl.clone().addScaledVector(D, 0.1).add(o)], [0.012, 0.004], { radial: 3 }), { skin: skinAt(q), color: cF, dtl: [0, 0, 0.2, 0] }); }
    };
    bolt([0.35, 1.95, 0.35], [0.5, 0.7, 0.3]); bolt([-0.42, 1.8, 0.1], [-0.7, 0.5, 0.2]); bolt([0.25, 2.3, -0.1], [0.3, 1, 0.5]);
    // broken chains hanging from the shackles (skinned to spring bones)
    const cI = col(C.iron);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      for (let k = 0; k < 5; k++) {
        const t = new THREE.TorusGeometry(0.045, 0.016, 5, 10);
        const y = 0.5 - k * 0.07;
        const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, k % 2 ? Math.PI / 2 : 0, Math.PI / 2)).setPosition(s * (0.8 + k * 0.012), y, -0.62);
        acc.add(t, { matrix: m, skin: rigid(b('chain' + n + (k < 2 ? '1' : '2'))), color: cI, dtl: DT.metal, ext: [0.4, 0, 0, 0] });
      }
    }
  },

  bones: { hips: 'body', pelvis: 'pelvis', chest: 'chest', neck: 'neck', head: 'head', jaw: 'jaw', tail: ['tail1', 'tail2', 'tail3'] },
  sockets: {
    head: ['head', H(0, 0.35, -0.2)], mouth: ['jaw', H(0, -0.14, -0.62)], chest: ['chest', [0, 1.4, -0.9]], back: ['chest', [0, 2.7, -0.3]],
    handR: ['fPR', [0.74, 0.1, -0.95]], handL: ['fPL', [-0.74, 0.1, -0.95]], weapon: ['fPR', [0.74, 0.1, -0.95]], weaponTip: ['fPL', [-0.74, 0.1, -0.95]],
    feetFL: ['fPL', [-0.74, 0, -0.85]], feetFR: ['fPR', [0.74, 0, -0.85]], feetRL: ['rPL', [-0.44, 0, 0.72]], feetRR: ['rPR', [0.44, 0, 0.72]],
  },
  gait: {
    legs: [
      { id: 'FL', chain: ['fUL', 'fLL', 'fPL'], toe: [-0.74, 0, -0.9], body: 'chest', scap: 0.2, lift: 0.22, flex: 0.6, out: 0.08, heel: 0.2 },
      { id: 'FR', chain: ['fUR', 'fLR', 'fPR'], toe: [0.74, 0, -0.9], body: 'chest', scap: 0.2, lift: 0.22, flex: 0.6, out: 0.08, heel: 0.2 },
      { id: 'RL', chain: ['rTL', 'rSL', 'rML', 'rPL'], toe: [-0.44, 0, 0.7], body: 'pelvis', scap: 0.15, lift: 0.14, flex: 0.7, out: 0.08, metaK: 0.8, heel: 0.3 },
      { id: 'RR', chain: ['rTR', 'rSR', 'rMR', 'rPR'], toe: [0.44, 0, 0.7], body: 'pelvis', scap: 0.15, lift: 0.14, flex: 0.7, out: 0.08, metaK: 0.8, heel: 0.3 },
    ],
    maxStride: 1.0, settleDist: 0.08, fMin: 0.5,
    gaits: [
      { v: 0.37, f: 0.42, duty: 0.66, lift: 1, off: { RL: 0, FL: 0.25, RR: 0.5, FR: 0.75 }, bob: 0.03, bobF: 2, bobPh: 0.1, roll: 0.035, rollF: 1, sway: 0.03, swayF: 1, nod: 0.03, nodF: 2, nodPh: 0.3 },
      { v: 0.6, f: 0.55, duty: 0.55, lift: 1.1, off: { RL: 0, FL: 0.25, RR: 0.5, FR: 0.75 }, bob: 0.045, bobF: 2, bobPh: 0.2, roll: 0.035, rollF: 1, sway: 0.03, swayF: 1, nod: 0.04, nodF: 2, nodPh: 0.4 },
    ],
  },
  airPaw: -0.3,
  springs: [
    { bones: ['tail1', 'tail2', 'tail3'], tip: [0, 0.7, 1.7], k: 22, d: 4, g: 0.5 },
    { bones: ['chainL1', 'chainL2'], tip: [-0.87, 0.14, -0.6], k: 30, d: 3, g: 1 },
    { bones: ['chainR1', 'chainR2'], tip: [0.87, 0.14, -0.6], k: 30, d: 3, g: 1 },
  ],
  trails: [
    { bone: 'fPR', a: [0.74, 0.35, -0.8], b: [0.74, 0.05, -1.0], vMin: 10, vMax: 24, life: 0.2 },
    { bone: 'fPL', a: [-0.74, 0.35, -0.8], b: [-0.74, 0.05, -1.0], vMin: 10, vMax: 24, life: 0.2 },
  ],
  emitters: [
    // furnace maw: embers + smoke drifting out of the mouth; breath jet
    { bone: 'jaw', p: H(0, -0.12, -0.55), span: [0.12, 0, 0.05], kind: 'ember', rate: 10, opts: { scale: 2.2 }, when: b => (b.dead ? 0 : 1) * (1 + b.glow.body * 2) },
    { bone: 'head', p: H(0, -0.05, -0.6), span: [0.1, 0, 0.02], kind: 'smoke', rate: 4, opts: { scale: 4, a: 0.25 }, when: b => (b.dead ? 0.3 : 1) },
    { bone: 'jaw', p: H(0, -0.13, -0.66), dir: [0, 0.05, -1], kind: 'breath', rate: 120, opts: { scale: 3.2 }, when: b => b.special.num.$breath || 0 },
    // molten hump: embers and heat smoke rising from the back
    { bone: 'chest', p: [0, 2.45, -0.3], span: [0.45, 0.1, 0.5], kind: 'ember', rate: 16, opts: { scale: 3 }, when: b => 1 + b.glow.enrage * 2 + b.glow.body * 2 },
    { bone: 'body', p: [0, 2.1, 0.3], span: [0.35, 0.05, 0.35], kind: 'smoke', rate: 3, opts: { scale: 5, a: 0.18 }, when: b => 1 },
    { bone: 'head', p: H(-0.19, 0.02, -0.46), kind: 'ember', rate: 4, opts: { scale: 1.1, col: [5, 2.4, 0.6] }, when: b => b.glow.eyes },
    { bone: 'head', p: H(0.19, 0.02, -0.46), kind: 'ember', rate: 4, opts: { scale: 1.1, col: [5, 2.4, 0.6] }, when: b => b.glow.eyes },
  ],

  carriage(ctl, dt) {
    quadCarriage(ctl, dt, { crouch: 0.03, runDrop: 0.02, combatPitch: -0.02, breathe: 0.018, look: 0.7, neck: { pitch: -0.05, run: -0.1, combat: -0.12, headCombat: 0.1, comp: 0.5 }, tail: { wag: 0.06, wagF: 0.25, run: 0.1 } });
    const P = ctl.pose, B = ctl.B;
    // heavy panting maw: the furnace glows through a half-open jaw
    P.rx(B.jaw, -(0.12 + 0.05 * Math.sin(ctl.t * 1.7)));
    // knuckle-walker: shoulders roll with each step
    const G = ctl.gait, ph = G.phase * TAU;
    P.rot(B.chest, 0, Math.sin(ph) * 0.05 * G.act, Math.sin(ph) * 0.04 * G.act);
  },
  events: {
    hit(ctl, a, pos) {
      if (!pos || ctl.opts.impactFx === false) return;
      const gy = ctl.root.position.y;
      if (pos.y - gy < 3) { const g = pos.clone(); g.y = gy + 0.1; ctl.fx('dust', g, 26, { scale: 5 }); ctl.fx('spark', g, 30, { scale: 2.5 }); }
      else ctl.fx('spark', pos, 20, { scale: 2 });
    },
    roar(ctl, a, pos) { if (pos) { for (let i = 0; i < 26; i++) ctl.fx('ember', pos, 1, { scale: 3 }); ctl.fx('smoke', pos, 6, { scale: 6, a: 0.3 }); } },
    flinch(ctl, a, pos) { if (pos) ctl.fx('spark', pos, 26, { scale: 2.4 }); },
    fall(ctl, a, pos) { if (pos) { const g = pos.clone(); g.y = ctl.root.position.y + 0.1; ctl.fx('dust', g, 50, { scale: 7 }); } },
  },
  actions: {},
};

// ------------------------------------------------------------------------------------------------ actions
const A = ashmaw.actions;
const FT = { FL: [-0.74, 0, -0.9], FR: [0.74, 0, -0.9], RL: [-0.44, 0, 0.7], RR: [0.44, 0, 0.7] };
const F = (id, dx = 0, dy = 0, dz = 0, paw) => { const t = FT[id]; const v = [t[0] + dx, t[1] + dy, t[2] + dz]; if (paw !== undefined) v.push(paw); return v; };

A.idle = { dur: 5, keys: [[0, {}]] };
A.walk = { dur: 1 / 0.42, hits: [0, 0.25 / 0.42, 0.5 / 0.42, 0.75 / 0.42], keys: [[0, {}]] };
A.spawn = { dur: 1.2, hits: [], lock: 1, fadeIn: 0.02, keys: [[0, { $hips: [0, -0.12, 0], chest: [0.1, 0, 0] }], [1.2, {}]] };

// rears up on the hind legs, both fists raised high, then hammers them down onto the wall in front
A.slam_wall = {
  dur: 4.2, hits: [2.3], hitAt: ['weapon'], lock: 1,
  keys: [
    [0, {}],
    [0.6, { $hips: [0, -0.1, 0.1], body: [0.05, 0, 0], neck: [-0.15, 0, 0], jaw: [-0.2, 0, 0] }, 'o'],
    [1.5, { $hips: [0, 0.35, 0.3], body: [0.5, 0, 0], chest: [0.15, 0, 0], neck: [0.1, 0, 0], head: [0.25, 0, 0], jaw: [-0.5, 0, 0], $footFL: [-0.7, 2.3, -0.5, -0.8], $footFR: [0.7, 2.3, -0.5, -0.8], $body: 0.5 }, 'o'],
    [2.0, { $hips: [0, 0.4, 0.32], body: [0.56, 0, 0], chest: [0.2, 0, 0], neck: [0.15, 0, 0], head: [0.3, 0, 0], jaw: [-0.6, 0, 0], $footFL: [-0.66, 2.55, -0.42, -1.0], $footFR: [0.66, 2.55, -0.42, -1.0], $body: 0.8, $shake: 0.4 }, 'io'],
    [2.3, { $hips: [0, -0.08, -0.25], body: [-0.12, 0, 0], chest: [-0.1, 0, 0], neck: [-0.25, 0, 0], head: [0, 0, 0], jaw: [-0.3, 0, 0], $footFL: [-0.6, 0.35, -1.75, 0.3], $footFR: [0.6, 0.35, -1.75, 0.3], $body: 1, $shake: 1 }, 'i'],
    [3.1, { $hips: [0, -0.06, -0.2], body: [-0.1, 0, 0], neck: [-0.2, 0, 0], jaw: [-0.2, 0, 0], $footFL: [-0.6, 0.3, -1.7], $footFR: [0.6, 0.3, -1.7], $body: 0.3 }, 'o'],
    [4.2, { body: null, chest: null, neck: null, head: null, jaw: null, $footFL: null, $footFR: null, $body: 0 }],
  ],
  ev: [[2.3, 'hit', 'weaponTip']],
};

A.roar = {
  dur: 4.0, hits: [1.4], hitAt: ['mouth'], lock: 1,
  keys: [
    [0, {}],
    [1.0, { $hips: [0, 0.1, 0.12], body: [0.25, 0, 0], chest: [0.1, 0, 0], neck: [0.35, 0, 0], head: [0.3, 0, 0], jaw: [-0.3, 0, 0], $body: 0.4 }, 'o'],
    [1.4, { $hips: [0, 0.12, 0.1], body: [0.28, 0, 0], chest: [0.1, 0, 0], neck: [0.2, 0, 0], head: [0.05, 0, 0], jaw: [-0.9, 0, 0], $shake: 1, $body: 1 }, 'i'],
    [3.2, { $hips: [0, 0.1, 0.1], body: [0.26, 0, 0], neck: [0.2, 0.15, 0], head: [0.05, 0.1, 0], jaw: [-0.85, 0, 0], $shake: 0.9, $body: 1 }],
    [4.0, { body: null, chest: null, neck: null, head: null, jaw: null, $body: 0 }],
  ],
  ev: [[1.4, 'roar', 'mouth']],
};

A.breath = {
  dur: 5.0, hits: [1.8, 2.6, 3.4], hitAt: ['mouth'], lock: 1, active: [[1.6, 4.0]],
  keys: [
    [0, {}],
    [1.3, { $hips: [0, 0.08, 0.15], body: [0.22, 0, 0], neck: [0.3, 0, 0], head: [0.25, 0, 0], jaw: [-0.2, 0, 0], $body: 0.8 }, 'o'],
    [1.6, { $hips: [0, -0.05, -0.05], body: [-0.05, 0, 0], neck: [-0.1, -0.3, 0], head: [0.1, -0.15, 0], jaw: [-0.85, 0, 0], $breath: 1, $body: 1 }, 'i'],
    [2.8, { neck: [-0.1, 0.3, 0], head: [0.1, 0.15, 0], jaw: [-0.9, 0, 0], $breath: 1, $body: 1 }, 'io'],
    [4.0, { neck: [-0.08, -0.2, 0], head: [0.1, -0.1, 0], jaw: [-0.85, 0, 0], $breath: 1, $body: 0.8 }, 'io'],
    [4.4, { jaw: [-0.2, 0, 0], $breath: 0, $body: 0.2 }],
    [5.0, { body: null, neck: null, head: null, jaw: null, $body: 0 }],
  ],
};

// cannonball impact: jolt back and aside, head thrown up, pained roar
A.hit = {
  dur: 1.2, hits: [0.15], hitAt: ['chest'], lock: 0.6, fadeIn: 0.03,
  keys: [
    [0, {}],
    [0.15, { $hips: [0, 0.05, 0.22], body: [0.14, 0.12, 0.1], chest: [0.1, 0.1, 0.06], neck: [0.3, 0.2, 0], head: [0.25, 0.25, 0.1], jaw: [-0.55, 0, 0], $shake: 1 }, 'o3'],
    [0.5, { $hips: [0, 0.02, 0.12], body: [0.06, 0.06, 0.05], neck: [0.1, 0.1, 0], head: [0.05, 0.12, 0.05], jaw: [-0.4, 0, 0], $shake: 0.4 }, 'io'],
    [1.2, { body: null, chest: null, neck: null, head: null, jaw: null }],
  ],
  ev: [[0.05, 'flinch', 'chest']],
};

A.death = {
  dur: 6.0, hits: [2.2, 4.0], hitAt: ['feetFL', 'chest'], hold: true, fadeIn: 0.1,
  keys: [
    [0, {}],
    [0.8, { $hips: [0, 0.1, 0.1], body: [0.25, 0, 0.05], neck: [0.4, 0, 0], head: [0.35, 0, 0], jaw: [-0.9, 0, 0], $shake: 1 }, 'o'],
    [2.2, { $hips: [0, -0.35, -0.1], body: [-0.2, 0.1, 0.25], chest: [-0.1, 0, 0.1], neck: [-0.35, 0.2, 0], head: [-0.2, 0.2, 0.2], jaw: [-0.5, 0, 0], $footFL: F('FL', 0.25, 0, 0.35, 0), $eyes: 0.6 }, 'i'],
    [3.0, { $hips: [0, -0.5, -0.1], body: [-0.25, 0.12, 0.45], neck: [-0.3, 0.25, 0.1], head: [-0.1, 0.3, 0.3], jaw: [-0.4, 0, 0], $footFL: F('FL', 0.3, 0, 0.4, 0), $eyes: 0.4 }, 'io'],
    [4.0, { $hips: [0, -1.02, 0.0], body: [-0.1, 0.1, 1.2], neck: [-0.2, 0.3, 0.1], head: [0.1, 0.4, 0.2], jaw: [-0.35, 0, 0], $air: 1, $eyes: 0.2 }, 'i'],
    [6.0, { $hips: [0, -1.0, 0.0], body: [-0.1, 0.1, 1.18], neck: [-0.22, 0.32, 0.1], head: [0.12, 0.42, 0.2], jaw: [-0.3, 0, 0], $air: 1, $eyes: 0 }],
  ],
  ev: [[4.0, 'fall', 'chest']],
};
