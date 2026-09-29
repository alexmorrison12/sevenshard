// Skeleton: 1.8 m undead warrior. Oversized skull (SDF: cranium, brow, cheekbones, carved eye sockets & nose, separate
// mandible) with glowing ember eyes and flickering soul-flames, rigid bones everywhere else (ribcage, spine column,
// SDF pelvis, long bones with knobbly epiphyses, bony fists), a ragged loincloth. Rattly, jerky gait with jaw chatter.
// Variants (weapon sets): sword (rusty sword + dented round shield), axe (two-handed axe, left hand IK'd onto the haft),
// archer (recurve bow with a skinned string that the right hand draws back, nocked arrow, quiver);
// elite bone_knight (×1.22, horned helm, pauldrons, broken cuirass, tattered cape, rune greatsword, blue soul-fire eyes).
// Death: the bones come apart and clatter into a scattered pile (holds). Spawn: claws its way out of the ground.
import * as THREE from 'three';
import { BipedCtl, armRot, legsLocal, legsPlant } from '../ctl.js';
import { bHit, bKnockback, bKnockdown, bGetup, bStun, bSpawn, bDrop, kf } from '../acts.js';
import { sweep, rigid, bez, taper, leafGeo } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addHorn } from '../../kit/parts.js';
import { flame, orb } from '../parts2.js';
import { sstep, clamp01, mix, TAU, makeChain, solveIK } from '../../kit/rig.js';
import { postHook, boneStats, Pile, longBone, knob, lathe, lerp3, hash } from './common.js';

const V3 = THREE.Vector3;
const PAL = {
  sword: { bone: 0xd8ceb2, dark: 0x5e5240, stain: 0x9c8a60, socket: 0x0c0806, eye: 0xff9a30, eyeCore: 0xfff2c0, eyeTip: 0xc03808, glow: 0xff7a20, cloth: 0x52261f, cloth2: 0x2c1411, metal: 0x86827a, rust: 0x7a3a18, wood: 0x6e4a2a, leather: 0x3e2a1c },
  axe: { bone: 0xd2c8aa, dark: 0x564c3c, stain: 0x8e8458, socket: 0x0a0806, eye: 0xffb338, eyeCore: 0xfff4c8, eyeTip: 0xc84a08, glow: 0xff8a20, cloth: 0x3c4a34, cloth2: 0x222a1e, metal: 0x7c7a76, rust: 0x70381a, wood: 0x5a3e24, leather: 0x3a2618 },
  archer: { bone: 0xdcd2b6, dark: 0x5a4e3e, stain: 0xa08c62, socket: 0x0c0806, eye: 0xffa040, eyeCore: 0xfff0c0, eyeTip: 0xc04010, glow: 0xff8028, cloth: 0x4c3a26, cloth2: 0x2a1e14, metal: 0x807c74, rust: 0x74381a, wood: 0x7a5230, leather: 0x46301e },
  bone_knight: { bone: 0xcfc5aa, dark: 0x4c4436, stain: 0x8a7c58, socket: 0x06080c, eye: 0x4ab4ff, eyeCore: 0xe6f8ff, eyeTip: 0x1830c8, glow: 0x3a8cff, cloth: 0x1c2234, cloth2: 0x2e3c66, metal: 0x3c3f48, rust: 0x5a3a2a, wood: 0x4a3222, leather: 0x2a1e18, trim: 0xb8984a, rune: 0x5ac8ff, horn: 0xe0d6bc },
};
const WEAPON = { sword: 'sword', axe: 'axe', archer: 'bow', bone_knight: 'great' };

// ------------------------------------------------------------------------------------------------ layout (right side; mirror x)
const J = {
  hips: [0, 0.98, 0.02], spine: [0, 1.12, 0.055], chest: [0, 1.28, 0.06], neck: [0, 1.515, 0.035], head: [0, 1.585, 0.012], jaw: [0, 1.628, -0.004],
  sho: [0.205, 1.465, 0.045], elb: [0.245, 1.175, 0.075], wri: [0.262, 0.93, 0.035],
  hip: [0.098, 0.955, 0.02], knee: [0.112, 0.53, -0.014], ank: [0.118, 0.095, 0.035],
};
const mx = (p, s) => [p[0] * s, p[1], p[2]];
const add = (p, d, k = 1) => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];
const nrm = (d) => { const l = Math.hypot(d[0], d[1], d[2]); return [d[0] / l, d[1] / l, d[2] / l]; };
const FIST = (s) => [0.266 * s, 0.86, 0.022];
const DIR = { sword: nrm([0, -0.42, -1]), axe: nrm([0, 0.12, -1]), great: nrm([0, -0.16, -1]) };
const SHIELD_N = nrm([-0.25, 0, -1]), SHIELD_C = [-0.271, 1.05, -0.008]; // strapped on the forearm, facing forward at rest
const BOW_Y = (z) => { const u = Math.min(1, Math.abs(z) / 0.62); return 0.11 * Math.pow(u, 1.8) - 0.04 * sstep(0.78, 1, u); };
const NOCK = [-0.266, 0.86 + BOW_Y(0.61), 0.022]; // bow string centre at rest (limbs along the fist's grip axis, string up)

export const skeleton = {
  name: 'Skeleton',
  variants: ['sword', 'axe', 'archer', 'bone_knight'],
  config(variant, opts) {
    const v = PAL[variant] ? variant : (opts.elite ? 'bone_knight' : 'sword');
    const elite = v === 'bone_knight' || !!opts.elite;
    const pal = elite && v !== 'bone_knight' ? { ...PAL[v], eye: PAL.bone_knight.eye, eyeCore: PAL.bone_knight.eyeCore, eyeTip: PAL.bone_knight.eyeTip, glow: PAL.bone_knight.glow } : PAL[v];
    return {
      variant: v, pal, elite, knight: v === 'bone_knight', weapon: WEAPON[v], shapeKey: 'base', scale: elite ? 1.22 : 1,
      h: 0.02, hg: { 1: 0.018, 2: 0.0135 }, aoScale: 0.6,
      mat: { dfreq: 5.5, furAxis: 1, rim: 0.55, rimColor: elite ? 0xb8dcff : 0xfff0dc, dissolveCol: elite ? 0x3a9cff : 0xff7a20, wrap: 0.55 },
    };
  },
  rig(R, cfg) {
    R.add('hips', null, J.hips); R.add('spine', 'hips', J.spine); R.add('chest', 'spine', J.chest);
    R.add('neck', 'chest', J.neck); R.add('head', 'neck', J.head); R.add('jaw', 'head', J.jaw);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('armU' + n, 'chest', mx(J.sho, s)); R.add('armL' + n, 'armU' + n, mx(J.elb, s)); R.add('hand' + n, 'armL' + n, mx(J.wri, s));
      R.add('thigh' + n, 'hips', mx(J.hip, s)); R.add('shin' + n, 'thigh' + n, mx(J.knee, s)); R.add('foot' + n, 'shin' + n, mx(J.ank, s));
    }
    R.add('clothF', 'hips', [0, 0.975, -0.08]); R.add('clothB', 'hips', [0, 0.99, 0.085]);
    // ---- variant bones last: the shared SDF shape (skull / jaw / pelvis) keeps identical bone indices
    const W = cfg.weapon;
    if (W !== 'bow') R.add('weaponR', 'handR', FIST(1));
    if (W === 'sword') R.add('shieldL', 'armLL', SHIELD_C);
    if (W === 'bow') {
      R.add('weaponL', 'handL', FIST(-1));
      R.add('limbT', 'weaponL', add(FIST(-1), [0, 0.012, -0.1])); R.add('limbB', 'weaponL', add(FIST(-1), [0, 0.012, 0.1]));
      R.add('nock', 'weaponL', NOCK); R.add('arrow', 'nock', NOCK);
    }
    if (cfg.knight) for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('cape1' + n, 'chest', [s * 0.1, 1.44, 0.14]); R.add('cape2' + n, 'cape1' + n, [s * 0.14, 1.12, 0.2]); R.add('cape3' + n, 'cape2' + n, [s * 0.17, 0.8, 0.24]);
    }
  },
  sculpt(S, cfg) {
    const c = cfg.pal, bd = [0, 0.08, 0.38, 0.12];
    // ---- skull (group 1): oversized for readability; cranium, face, brow, cheekbones, deep sockets
    const g1 = { group: 1 };
    S.ell('head', [0, 1.702, 0.022], [0.098, 0.1, 0.116], { ...g1, k: 0.03, col: c.bone, tag: 'cranium', dtl: bd });
    S.ell('head', [0, 1.626, -0.066], [0.063, 0.05, 0.054], { ...g1, k: 0.04, col: c.bone, tag: 'face', dtl: bd });
    S.ell('head', [0, 1.689, -0.084], [0.086, 0.022, 0.03], { ...g1, k: 0.025, col: c.bone, tag: 'brow', dtl: bd });
    for (const s of [-1, 1]) S.ell('head', [s * 0.067, 1.643, -0.052], [0.026, 0.019, 0.044], { ...g1, k: 0.02, col: c.bone, tag: 'cheek', rot: [0, s * 0.3, 0], dtl: bd });
    for (const s of [-1, 1]) S.ell('head', [s * 0.039, 1.66, -0.104], [0.032, 0.034, 0.052], { ...g1, sub: true, k: 0.013, col: c.socket, tag: 'socket', rot: [0, s * 0.22, 0] });
    S.ell('head', [0, 1.624, -0.122], [0.012, 0.021, 0.035], { ...g1, sub: true, k: 0.008, col: c.socket, tag: 'nose' });
    for (const s of [-1, 1]) S.ell('head', [s * 0.1, 1.668, -0.026], [0.022, 0.032, 0.036], { ...g1, sub: true, k: 0.02, col: c.bone, tag: 'temple' });
    // ---- mandible (group 2)
    const g2 = { group: 2 };
    for (const s of [-1, 1]) {
      S.cone('jaw', [s * 0.066, 1.628, -0.004], [s * 0.062, 1.56, -0.02], 0.014, 0.017, { ...g2, k: 0.012, col: c.bone, tag: 'jaw', dtl: bd });
      S.cone('jaw', [s * 0.062, 1.558, -0.02], [s * 0.022, 1.549, -0.098], 0.016, 0.014, { ...g2, k: 0.012, col: c.bone, tag: 'jaw', dtl: bd });
    }
    S.ell('jaw', [0, 1.552, -0.097], [0.03, 0.02, 0.018], { ...g2, k: 0.014, col: c.bone, tag: 'chin', dtl: bd });
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, y, z] = v.p, ny = v.n[1];
    const st = Math.sin(x * 37 + z * 23 + 1.3) * Math.sin(y * 41 - x * 13) * 0.5 + 0.5;
    v.mix(c.stain, sstep(0.5, 0.95, st) * 0.5);
    v.mix(c.dark, sstep(-0.2, -0.85, ny) * 0.3);
    if (v.group === 1) {
      v.mix(c.socket, sstep(0.25, 0.7, v.t('socket')) * 0.97); v.mix(c.socket, sstep(0.25, 0.7, v.t('nose')) * 0.95);
      // hairline crack over the crown, dark suture seam
      const cr = Math.abs(x - 0.025 * Math.sin(z * 55) - 0.03);
      if (y > 1.72 && z < 0.06) v.mix(c.dark, (1 - sstep(0.002, 0.006, cr)) * 0.9);
      if (y > 1.77) v.mix(c.dark, (1 - sstep(0.002, 0.005, Math.abs(z - 0.04 - 0.008 * Math.sin(x * 90)))) * 0.6);
      v.mix(c.dark, v.t('temple') * 0.25);
    }
    v.mul(1 + Math.sin(x * 29 + z * 17) * Math.sin(y * 23) * 0.05);
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n), W = cfg.weapon, E = cfg.elite, K = cfg.knight;
    const cB = col(c.bone), cS = col(c.stain), cD = col(c.dark);
    const boneCol = (p) => { const st = Math.sin(p.x * 37 + p.z * 23 + 1.3) * Math.sin(p.y * 41 - p.x * 13) * 0.5 + 0.5; return lerp3(cB, cS, sstep(0.45, 0.95, st) * 0.6); };
    const bc = (p, n, uv) => { const q = boneCol(p); return uv[1] < 0.06 || uv[1] > 0.94 ? lerp3(q, cD, 0.18) : q; };
    const R0 = (n) => rigid(b(n));
    // ---------------- eyes: bright cores deep in the sockets, soul-flames licking up out of them
    const fc = { core: c.eyeCore, mid: c.eye, tip: c.eyeTip };
    for (const s of [-1, 1]) {
      knob(acc, R0('head'), [s * 0.038, 1.659, -0.083], 0.028, c.eye, { emis: E ? 0.7 : 1.4, dtl: [0, 0, 0, 0], ws: 6, hs: 3 });
      orb(acc, [s * 0.037, 1.66, -0.102], E ? 0.02 : 0.018, R0('head'), c.eyeCore, E ? 3.0 : 5, 0);
      flame(acc, [s * 0.037, 1.668, -0.106], [s * 0.2, 1, -0.05], E ? 0.19 : 0.13, E ? 0.022 : 0.018, R0('head'), fc, { emis: E ? 2.1 : 2.8, n: 5, radial: 4, bend: [s * 0.15, 0, 0.55] });
    }
    // ---------------- teeth
    const tcol = (p, n, uv) => lerp3(col(0xb8a880), col(0xf0e8d0), uv[1]);
    for (let i = 0; i < 6; i++) {
      const a = -0.95 + i * (1.9 / 5), x = Math.sin(a) * 0.046, z = -0.074 - Math.cos(a) * 0.036;
      acc.add(sweep([[x, 1.592, z], [x, 1.573, z - 0.002]], [0.009, 0.006], { radial: 3 }), { skin: R0('head'), color: tcol, dtl: [0, 0, 0, 0] });
      const zl = -0.07 - Math.cos(a) * 0.03, xl = Math.sin(a) * 0.04;
      acc.add(sweep([[xl, 1.556, zl], [xl, 1.574, zl - 0.002]], [0.0085, 0.0055], { radial: 3 }), { skin: R0('jaw'), color: tcol, dtl: [0, 0, 0, 0] });
    }
    // ---------------- spine column: cervical (neck), thoracic (chest), lumbar (spine)
    const col3 = (bone, y0, y1, z0, z1, r, n) => { // bumpy vertebral column + spinous spikes
      const pts = [], rad = [];
      for (let i = 0; i <= n * 2; i++) { const t = i / (n * 2); pts.push(new V3(0, mix(y0, y1, t), mix(z0, z1, t))); rad.push(i % 2 ? r * 0.72 : r); }
      acc.add(sweep(pts, rad, { radial: bone === 'chest' ? 4 : 5, capStart: true }), { skin: R0(bone), color: bc, dtl: [0, 0.1, 0.3, 0.1] });
      if (bone !== 'chest') for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, y = mix(y0, y1, t), z = mix(z0, z1, t); acc.add(sweep([[0, y, z + r * 0.7], [0, y - r * 0.6, z + r * 0.7 + 0.028]], [r * 0.42, r * 0.12], { radial: 3 }), { skin: R0(bone), color: cB, dtl: [0, 0.1, 0.3, 0] }); }
    };
    col3('neck', 1.5, 1.592, 0.028, 0.02, 0.019, 3);
    col3('chest', 1.24, 1.49, 0.094, 0.082, 0.02, 3);
    col3('spine', 1.05, 1.235, 0.066, 0.078, 0.027, 4);
    // lumbar transverse processes (wide, reads as vertebrae from the front)
    for (let i = 0; i < 4; i++) { const y = 1.075 + i * 0.045; acc.add(sweep([[-0.045, y, 0.07], [0.045, y, 0.07]], [0.009, 0.009], { radial: 3 }), { skin: R0('spine'), color: cB, dtl: [0, 0.1, 0.3, 0] }); }
    // ---------------- pelvis: iliac wings, sacrum, pubic ring (rigid; mostly under the loincloth)
    for (const s of [-1, 1]) knob(acc, R0('hips'), [s * 0.09, 1.025, 0.035], 1, cB, { sx: 0.068, sy: 0.056, sz: 0.016, rot: [-0.3, s * 0.95, s * 0.35], ws: 8, hs: 5, dtl: [0, 0.1, 0.3, 0.1] });
    knob(acc, R0('hips'), [0, 1.0, 0.075], 1, cB, { sx: 0.042, sy: 0.066, sz: 0.024, rot: [0.35, 0, 0], ws: 6, hs: 4 });
    acc.add(new THREE.TorusGeometry(0.078, 0.019, 4, 10, Math.PI), { matrix: new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI / 2 + 0.35, 0, Math.PI, 'YXZ')).setPosition(0, 0.945, 0.012), skin: R0('hips'), color: cB, dtl: [0, 0.1, 0.3, 0.1] });
    // ---------------- ribcage: 6 rib pairs (the last two floating), sternum, clavicles, shoulder blades
    const RIB = [[1.462, 0.1, 0.004], [1.418, 0.128, 0.0], [1.372, 0.146, -0.004], [1.326, 0.155, -0.006], [1.28, 0.152, -0.004], [1.238, 0.138, 0]];
    for (let i = 0; i < RIB.length; i++) {
      const [y0, wx] = RIB[i], fl = i >= 4;
      for (const s of [-1, 1]) {
        const pts = [[s * 0.018, y0, 0.098], [s * wx * 0.7, y0 + 0.006, 0.108], [s * wx, y0 - 0.02, 0.02], [s * wx * 0.88, y0 - 0.046, -0.07]];
        if (!fl) pts.push([s * 0.03, y0 - 0.068, -0.118]); else pts.push([s * wx * 0.6, y0 - 0.06, -0.1]);
        const curve = new THREE.CatmullRomCurve3(pts.map(p => new V3(...p)), false, 'centripetal');
        const pp = curve.getPoints(fl ? 4 : 6);
        const rr = pp.map((_, j) => 0.0072 * (1 - 0.35 * (j / (pp.length - 1)) * (fl ? 1 : 0)));
        acc.add(sweep(pp, rr, { radial: 4, flat: 2.0, up: [0, 1, 0] }), { skin: R0('chest'), color: bc, dtl: [0, 0.08, 0.3, 0.1] });
      }
    }
    acc.add(sweep([[0, 1.468, -0.118], [0, 1.39, -0.126], [0, 1.3, -0.12]], [0.021, 0.018, 0.012], { radial: 4, flat: 0.4, up: [0, 0, 1] }), { skin: R0('chest'), color: bc, dtl: [0, 0.08, 0.3, 0.1] });
    for (const s of [-1, 1]) {
      acc.add(sweep(bez([s * 0.024, 1.47, -0.112], [s * 0.12, 1.49, -0.06], [s * 0.19, 1.482, 0.03], 5), [0.011, 0.01, 0.009, 0.01, 0.012], { radial: 5 }), { skin: R0('chest'), color: bc, dtl: [0, 0.08, 0.3, 0.1] });
      // scapula: thin triangular plate on the back
      const tri = new THREE.BufferGeometry();
      const A = [s * 0.18, 1.475, 0.08], B = [s * 0.07, 1.455, 0.125], C = [s * 0.105, 1.29, 0.128];
      const th = 0.006, P = [];
      for (const d of [-th, th]) for (const q of [A, B, C]) P.push(q[0], q[1], q[2] + d);
      tri.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      tri.setIndex(s > 0 ? [0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 2, 0, 3, 2, 3, 5] : [0, 1, 2, 3, 5, 4, 0, 4, 1, 0, 3, 4, 1, 5, 2, 1, 4, 5, 2, 3, 0, 2, 5, 3]);
      tri.computeVertexNormals();
      acc.add(tri, { skin: R0('chest'), color: boneCol(new V3(...B)), dtl: [0, 0.08, 0.3, 0.1] });
      acc.add(sweep([[s * 0.1, 1.44, 0.13], [s * 0.19, 1.47, 0.09]], [0.008, 0.006], { radial: 3 }), { skin: R0('chest'), color: cB, dtl: [0, 0.08, 0.3, 0] });
    }
    // ---------------- limbs
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      const sho = mx(J.sho, s), elb = mx(J.elb, s), wri = mx(J.wri, s), hip = mx(J.hip, s), kn = mx(J.knee, s), an = mx(J.ank, s);
      // humerus: ball head + shaft + wide distal condyles
      longBone(acc, R0('armU' + n), add(sho, [0, -0.012, 0]), add(elb, [0, 0.01, 0]), 0.019, 0.034, 0.032, bc, { flat: 0.8, up: [0, 0, 1], bow: [0, 0, -0.008], lo: true, radial: 5 });
      knob(acc, R0('armU' + n), add(sho, [-s * 0.006, 0.004, 0]), 0.036, boneCol(new V3(...sho)));
      // radius & ulna, olecranon knob at the elbow
      longBone(acc, R0('armL' + n), add(elb, [s * 0.006, -0.012, -0.014]), add(wri, [s * 0.006, 0.012, -0.012]), 0.011, 0.02, 0.022, bc, { radial: 4, lo: true });
      longBone(acc, R0('armL' + n), add(elb, [-s * 0.004, -0.004, 0.016]), add(wri, [-s * 0.006, 0.014, 0.014]), 0.011, 0.024, 0.016, bc, { radial: 4, lo: true });
      knob(acc, R0('armL' + n), add(elb, [0, 0.004, 0.022]), 0.022, boneCol(new V3(...elb)), { sz: 1.2 , ws: 5, hs: 3 });
      // femur: head, trochanter, shaft, twin condyles; kneecap
      longBone(acc, R0('thigh' + n), add(hip, [s * 0.012, -0.02, 0]), add(kn, [0, 0.03, 0.004]), 0.023, 0.034, 0.036, bc, { bow: [0, 0, -0.018], lo: true, radial: 5 });
      knob(acc, R0('thigh' + n), add(hip, [-s * 0.004, 0.004, 0]), 0.033, boneCol(new V3(...hip)));
      knob(acc, R0('thigh' + n), add(kn, [0, 0.02, 0.008]), 0.03, boneCol(new V3(...kn)), { sx: 1.7, sz: 1.1, ws: 6, hs: 3 });
      knob(acc, R0('shin' + n), add(kn, [0, 0.012, -0.036]), 0.024, boneCol(new V3(...kn)), { sz: 0.7 , ws: 5, hs: 3 });
      // tibia + fibula
      longBone(acc, R0('shin' + n), add(kn, [0, -0.014, 0.004]), add(an, [-s * 0.004, 0.02, 0]), 0.019, 0.04, 0.027, bc, { flat: 0.85, up: [0, 0, 1], lo: true, radial: 5 });
      longBone(acc, R0('shin' + n), add(kn, [s * 0.03, -0.03, 0.02]), add(an, [s * 0.026, 0.012, 0.018]), 0.008, 0.014, 0.017, bc, { radial: 3, lo: true });
      // foot: heel block, talus, metatarsals, toes
      acc.add(new THREE.BoxGeometry(0.052, 0.05, 0.075), { matrix: new THREE.Matrix4().makeRotationX(-0.25).setPosition(an[0], 0.05, an[2] + 0.028), skin: R0('foot' + n), color: boneCol(new V3(...an)), dtl: [0, 0.08, 0.3, 0] });
      knob(acc, R0('foot' + n), add(an, [0, -0.005, 0.0]), 0.028, boneCol(new V3(...an)), { sx: 1.1 , ws: 5, hs: 3 });
      for (let t = -1; t <= 1; t++) {
        const x0 = an[0] + t * 0.017 + s * 0.004;
        const p0 = [x0, 0.058, an[2] - 0.02], p1 = [x0 + t * 0.008, 0.024, an[2] - 0.12], p2 = [x0 + t * 0.012, 0.012, an[2] - 0.172];
        acc.add(sweep([p0, [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + 0.006, (p0[2] + p1[2]) / 2], p1, [p2[0], p2[1] + 0.006, (p1[2] + p2[2]) / 2], p2], [0.012, 0.0085, 0.011, 0.008, 0.004], { radial: 3, capStart: true }), { skin: R0('foot' + n), color: bc, dtl: [0, 0.08, 0.3, 0] });
      }
      // hands
      const grip = s > 0 ? W !== 'bow' : (W === 'bow' || W === 'sword' || W === 'axe' || W === 'great');
      const d = s > 0 ? (DIR[W] ?? [0, -1, 0]) : (W === 'bow' ? [0, 1, 0] : (DIR[W] ?? [0, 1, 0]));
      hand(acc, R0('hand' + n), s, wri, grip ? FIST(s) : null, d, bc, boneCol);
    }
    // ---------------- cloth: rope belt + ragged loincloth flaps (skinned to swinging cloth bones)
    const cc = col(c.cloth), cc2 = col(c.cloth2);
    const belt = new THREE.TorusGeometry(0.125, 0.012, 4, 12);
    acc.add(belt, { matrix: new THREE.Matrix4().makeRotationX(Math.PI / 2 - 0.12).setPosition(0, 1.0, 0.018), skin: R0('hips'), color: K ? c.leather : c.cloth2, dtl: [0, 0, 0.2, 0.5] });
    const flap = (bone, z, w, h, back) => {
      const g = leafGeo(w, h, 0.012, 0.3, back ? -0.15 : 0.15, { nu: 5, nv: 4, pw: 0.25, tipW: w * 0.55 });
      const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) { const yy = pa.getY(i), xx = pa.getX(i); pa.setY(i, yy - (yy / h > 0.7 ? 0.05 * Math.abs(Math.sin(xx * 90)) * (yy / h) : 0)); }
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI + (back ? 0.12 : -0.08), back ? Math.PI : 0, 0, 'YXZ')).setPosition(0, 1.0, z);
      acc.add(g, { matrix: m, skin: (p) => { const t = sstep(0.97, 0.8, p.y); return { si: [b('hips'), b(bone), 0, 0], sw: [1 - t, t, 0, 0] }; }, color: (p, n, uv) => lerp3(cc, cc2, 0.35 * sstep(0.3, 1, uv[1]) + 0.25 * (Math.sin(p.x * 70) * 0.5 + 0.5) * sstep(0.5, 1, uv[1])), dtl: [0, 0, 0.3, 0.45] });
    };
    flap('clothF', -0.085, 0.085, K ? 0.34 : 0.28, false);
    flap('clothB', 0.09, 0.1, K ? 0.4 : 0.3, true);
    // ---------------- weapons
    if (W === 'sword') { sword(acc, R0('weaponR'), FIST(1), DIR.sword, c, false); shield(acc, R0('shieldL'), c); }
    if (W === 'axe') axe(acc, R0('weaponR'), FIST(1), DIR.axe, c);
    if (W === 'great') sword(acc, R0('weaponR'), FIST(1), DIR.great, c, true);
    if (W === 'bow') bow(acc, b, c);
    if (K) knightArmour(acc, b, c, cB);
    cfg.boneStats = boneStats(acc, R.bones.length);
  },
  sockets(cfg) {
    const s = {
      head: ['head', [0, 1.84, 0.0]], mouth: ['jaw', [0, 1.56, -0.11]], center: ['chest', [0, 1.3, 0.0]], chest: ['chest', [0, 1.36, -0.12]],
      back: ['chest', [0, 1.38, 0.16]], handR: ['handR', FIST(1)], handL: ['handL', FIST(-1)],
      eyes: ['head', [0, 1.66, -0.11]],
    };
    if (cfg.weapon === 'sword') { s.weapon = ['weaponR', FIST(1)]; s.weaponTip = ['weaponR', add(FIST(1), DIR.sword, 0.8)]; s.shield = ['shieldL', SHIELD_C]; }
    if (cfg.weapon === 'axe') { s.weapon = ['weaponR', FIST(1)]; s.weaponTip = ['weaponR', add(FIST(1), DIR.axe, 0.98)]; }
    if (cfg.weapon === 'great') { s.weapon = ['weaponR', FIST(1)]; s.weaponTip = ['weaponR', add(FIST(1), DIR.great, 1.3)]; }
    if (cfg.weapon === 'bow') { s.weapon = ['weaponL', FIST(-1)]; s.arrow = ['arrow', add(NOCK, [0, 0, -0.72])]; }
    return s;
  },
  height: 1.82, radius: 0.36,
  controller(inst) { return new SkelCtl(inst, specFor(inst.entry.cfg)); },
  get actionList() { return ACTION_NAMES; },
};

// ================================================================================================ part builders
function hand(acc, skin, s, wri, F, d, bc, boneCol) {
  const cB = boneCol(new V3(...wri));
  // carpal block
  acc.add(new THREE.BoxGeometry(0.04, 0.03, 0.05), { matrix: new THREE.Matrix4().makeTranslation(wri[0] + s * 0.004, wri[1] - 0.022, wri[2] - 0.006), skin, color: cB, dtl: [0, 0.08, 0.3, 0] });
  if (F) { // fist wrapped around the grip axis d through F
    const D = new V3(...d).normalize();
    const e1 = new V3(s, 0, 0).addScaledVector(D, -D.x * s).normalize(); // back of the hand (outward)
    const e2 = new V3().crossVectors(D, e1).multiplyScalar(-1).normalize();
    const Fv = new V3(...F);
    for (let f = 0; f < 4; f++) {
      const o = (f - 1.5) * 0.02;
      const C = Fv.clone().addScaledVector(D, o);
      const pts = [];
      for (let j = 0; j < 4; j++) {
        const a = -0.35 + j * 0.8;
        pts.push(C.clone().addScaledVector(e1, Math.cos(a) * 0.026).addScaledVector(e2, Math.sin(a) * 0.026));
      }
      // metacarpal from the wrist to the knuckle
      const kn = pts[0];
      acc.add(sweep([new V3(wri[0] + s * 0.006, wri[1] - 0.03, wri[2] - 0.006 + o * 0.5), ...pts], [0.0085, 0.011, 0.0095, 0.009, 0.006], { radial: 3 }), { skin, color: bc, dtl: [0, 0.08, 0.3, 0] });
    }
    const tb = Fv.clone().addScaledVector(D, -0.035).addScaledVector(e1, -0.02).addScaledVector(e2, -0.012);
    acc.add(sweep([new V3(wri[0] - s * 0.012, wri[1] - 0.03, wri[2] - 0.01), tb, Fv.clone().addScaledVector(D, -0.01).addScaledVector(e2, -0.028)], [0.009, 0.009, 0.006], { radial: 3 }), { skin, color: bc, dtl: [0, 0.08, 0.3, 0] });
  } else { // open clawed hand: long bony fingers, slightly curled
    for (let f = 0; f < 4; f++) {
      const o = (f - 1.5) * 0.017;
      const k0 = [wri[0] + s * 0.004, wri[1] - 0.075, wri[2] + o - 0.012];
      const L = 0.075 - Math.abs(f - 1.5) * 0.01;
      acc.add(sweep([new V3(wri[0] + s * 0.004, wri[1] - 0.03, wri[2] + o * 0.6 - 0.006), ...bez(k0, [k0[0] - s * 0.012, k0[1] - L * 0.6, k0[2] - 0.008], [k0[0] - s * 0.032, k0[1] - L * 0.9, k0[2] - 0.02], 4)], [0.008, 0.0095, 0.008, 0.006, 0.003], { radial: 3 }), { skin, color: bc, dtl: [0, 0.08, 0.3, 0] });
    }
    acc.add(sweep(bez([wri[0] - s * 0.012, wri[1] - 0.032, wri[2] - 0.02], [wri[0] - s * 0.022, wri[1] - 0.06, wri[2] - 0.04], [wri[0] - s * 0.03, wri[1] - 0.085, wri[2] - 0.035], 4), [0.009, 0.008, 0.006, 0.003], { radial: 4 }), { skin, color: bc, dtl: [0, 0.08, 0.3, 0] });
  }
}

/** rusty sword (great: rune greatsword) along d from the fist F */
function sword(acc, skin, F, d, c, great) {
  const D = new V3(...d).normalize(), Fv = new V3(...F), X = new V3(1, 0, 0);
  const at = (t) => Fv.clone().addScaledVector(D, t);
  const cM = col(c.metal), cR = col(c.rust), cL = col(c.leather), cDk = col(0x2a2622), cT = col(c.trim ?? c.metal), cRune = col(c.rune ?? c.eye);
  const gL = great ? 0.26 : 0.1, bl = great ? 1.12 : 0.74, bw = great ? 0.062 : 0.043;
  // grip (leather wrap) + pommel
  acc.add(sweep([at(-gL - 0.005), at(0.05)], [0.0155, 0.0155], { radial: 6, capStart: true }), { skin, color: (p, n, uv) => lerp3(cL, cDk, (Math.sin(uv[1] * 60) * 0.5 + 0.5) * 0.4), dtl: [0, 0, 0.2, 0.4] });
  knob(acc, skin, at(-gL - 0.02).toArray(), great ? 0.032 : 0.024, great ? c.trim : c.metal, { dtl: [0, 0, 0.25, 0] });
  // crossguard: curved quillons
  const gw = great ? 0.17 : 0.1;
  acc.add(sweep(bez(at(0.06).addScaledVector(X, -gw).addScaledVector(D, 0.03).toArray(), at(0.052).toArray(), at(0.06).addScaledVector(X, gw).addScaledVector(D, 0.03).toArray(), 7), [0.009, 0.014, 0.017, 0.018, 0.017, 0.014, 0.009], { radial: 5 }), { skin, color: great ? cT : cM, dtl: [0, 0, 0.25, 0] });
  // blade: diamond section, nicked edges, rust patches (great: dark steel with a glowing rune fuller)
  const n = great ? 14 : 11, pts = [], rad = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    pts.push(at(0.065 + t * bl));
    const nick = !great && (i === 4 || i === 7) ? 0.72 : 1;
    rad.push((bw * (1 - Math.pow(t, 3.2)) + 0.002) * nick * (t > 0.93 ? (1 - (t - 0.93) * 12) : 1));
  }
  const E = [0, 0, 0];
  acc.add(sweep(pts, rad, { radial: 4, flat: great ? 0.14 : 0.17, up: [0, 1, 0] }), {
    skin, dtl: [0, 0, 0.3, 0.15],
    color: (p, nn, uv) => {
      const edge = Math.abs(Math.cos(uv[0] * TAU));
      const rust = sstep(0.35, 0.8, Math.sin(p.x * 61 + p.y * 47) * Math.sin(p.z * 53 - p.y * 31) * 0.5 + 0.5 + (1 - uv[1]) * 0.25);
      const base = great ? lerp3(col(0x34363e), col(0x9a9ea8), edge) : lerp3(col(0x8e8a82), col(0xc8c4ba), edge * 0.9);
      return great ? base : lerp3(base, cR, rust * (1 - edge * 0.7) * 0.6);
    },
  });
  if (great) { // glowing rune inlay along the fuller (pokes through both flats), dashed
    const ip = [], ir = [];
    for (let i = 0; i < 12; i++) { const t = i / 11; ip.push(at(0.14 + t * bl * 0.72)); ir.push(0.0105 * (1 - t * 0.4)); }
    acc.add(sweep(ip, ir, { radial: 4, flat: 1, up: [0, 1, 0] }), { skin, color: (p, nn, uv) => lerp3(cRune, col(0xe8f8ff), 0.3), emis: (p, uv) => (Math.sin(uv[1] * 44) > -0.2 ? 2.6 : 0.35), dtl: [0, 0, 0, 0] });
  }
}

function shield(acc, skin, c) {
  const prof = [[0.0, 0.05], [0.05, 0.044], [0.075, 0.024], [0.2, 0.014], [0.27, 0.006], [0.3, -0.004], [0.286, -0.02], [0.15, -0.014], [0.0, -0.014]];
  const dents = [[0.14, 0.9], [0.2, 3.4], [0.09, 4.9], [0.23, 5.6]];
  const { g, m } = lathe(prof, 16, SHIELD_C, SHIELD_N, 0.4, (p) => {
    if (p.y < 0.004) return;
    const r = Math.hypot(p.x, p.z), a = Math.atan2(p.z, p.x);
    for (const [dr, da] of dents) { const dx = r * Math.cos(a) - dr * Math.cos(da), dz = r * Math.sin(a) - dr * Math.sin(da); p.y -= 0.014 * Math.exp(-(dx * dx + dz * dz) / 0.0012); }
  });
  const cW = col(0x7c5a36), cW2 = col(0x3a2616), cM = col(c.metal), cR = col(c.rust);
  const N = new V3(...SHIELD_N), U = new V3(0, 1, 0).addScaledVector(N, -N.y).normalize(), Cv = new V3(...SHIELD_C), Xs = new V3().crossVectors(N, U), cP = col(0x8a8062);
  acc.add(g, {
    matrix: m, skin, dtl: [0, 0, 0.35, 0.5],
    color: (p, n, uv) => {
      const q = p.clone().sub(Cv), r = q.clone().addScaledVector(N, -q.dot(N)).length();
      const iron = r < 0.082 || r > 0.262 || Math.abs(q.dot(U)) < 0.012;
      if (iron) return lerp3(cM, cR, 0.3 + 0.3 * Math.sin(p.x * 80 + p.y * 60));
      const px = q.dot(Xs), py = q.dot(U);
      const plank = Math.abs(Math.sin(px * 30));
      let cc = lerp3(cW, cW2, (plank < 0.1 ? 0.85 : 0) + 0.15 * Math.sin(py * 140 + px * 9));
      const chev = Math.abs(py + Math.abs(px) * 0.9 - 0.02) < 0.045 && r < 0.25;       // faded painted chevron
      if (chev) cc = lerp3(cc, cP, 0.55 + 0.25 * Math.sin(px * 60) * Math.sin(py * 70));
      return cc;
    },
  });
  // rivets on the rim
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + 0.3, X = new V3().crossVectors(N, U);
    const p = Cv.clone().addScaledVector(U, Math.cos(a) * 0.272).addScaledVector(X, Math.sin(a) * 0.272).addScaledVector(N, 0.01);
    knob(acc, skin, p.toArray(), 0.012, c.metal, { ws: 4, hs: 2 });
  }
}

function axe(acc, skin, F, d, c) {
  const D = new V3(...d).normalize(), Fv = new V3(...F), X = new V3(1, 0, 0);
  const Eg = new V3().crossVectors(D, X).normalize(); // edge direction: down for the rest pose
  const at = (t) => Fv.clone().addScaledVector(D, t);
  const cWd = col(c.wood), cWd2 = col(0x2e1e10), cL = col(c.leather);
  acc.add(sweep([at(-0.2), at(0.2), at(0.6), at(1.1)], [0.017, 0.018, 0.018, 0.016], { radial: 6, capStart: true }), {
    skin, dtl: [0, 0, 0.2, 0.6],
    color: (p, n, uv) => { const t = uv[1]; const wrap = (t < 0.22 || (t > 0.45 && t < 0.58)) ? 1 : 0; return wrap ? lerp3(cL, cWd2, (Math.sin(t * 300) * 0.5 + 0.5) * 0.5) : lerp3(cWd, cWd2, 0.3 * Math.sin(t * 40 + uv[0] * 6) + 0.2); },
  });
  knob(acc, skin, at(-0.21).toArray(), 0.024, c.metal);
  // head: crescent bit (extruded), back spike, socket collar
  const sh = new THREE.Shape();
  sh.moveTo(-0.07, 0.0); sh.lineTo(0.07, 0.0); sh.lineTo(0.09, -0.06);
  sh.quadraticCurveTo(0.16, -0.14, 0.19, -0.29); sh.quadraticCurveTo(0.02, -0.24, -0.15, -0.3);
  sh.quadraticCurveTo(-0.12, -0.14, -0.06, -0.06); sh.lineTo(-0.07, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.024, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 5 });
  g.translate(0, 0, -0.012);
  const hc = at(0.92);
  const m = new THREE.Matrix4().makeBasis(D, Eg.clone().negate(), X).setPosition(hc.x, hc.y, hc.z);
  const cM = col(c.metal), cR = col(c.rust), cEd = col(0xc8c4bc);
  acc.add(g, { matrix: m, skin, dtl: [0, 0, 0.3, 0.1], color: (p) => { const q = p.clone().sub(hc); const out = q.dot(Eg); return out > 0.24 ? cEd : lerp3(cM, cR, sstep(0.3, 0.9, Math.sin(p.x * 70 + p.z * 50) * 0.5 + 0.5) * 0.8); } });
  acc.add(sweep([hc.clone().addScaledVector(Eg, -0.02), hc.clone().addScaledVector(Eg, -0.13).addScaledVector(D, 0.02)], [0.02, 0.002], { radial: 4 }), { skin, color: cM, dtl: [0, 0, 0.3, 0] });
  acc.add(sweep([at(0.86), at(0.98)], [0.026, 0.026], { radial: 6, capStart: true }), { skin, color: cM, dtl: [0, 0, 0.3, 0] });
}

function bow(acc, b, c) {
  const F = FIST(-1), cW = col(0x8a6238), cW2 = col(0x3a2412), cL = col(c.leather);
  for (const s of [-1, 1]) { // s = -1: front limb (limbT, toward −Z), +1: back limb (limbB)
    const pts = [], rad = [];
    for (let i = 0; i <= 8; i++) { const z = s * i / 8 * 0.62; pts.push(new V3(F[0], F[1] + BOW_Y(z), F[2] + z)); rad.push(i < 2 ? 0.021 : 0.021 - (i - 1) / 7 * 0.012); }
    const limb = b(s < 0 ? 'limbT' : 'limbB'), grip = b('weaponL');
    acc.add(sweep(pts, rad, { radial: 5, flat: 0.55, up: [0, 1, 0], capStart: true }), {
      skin: (p) => { const t = sstep(0.12, 0.35, Math.abs(p.z - F[2])); return { si: [grip, limb, 0, 0], sw: [1 - t, t, 0, 0] }; },
      color: (p, n, uv) => uv[1] < 0.14 ? lerp3(cL, cW2, 0.3 * Math.sin(uv[1] * 200)) : lerp3(cW, cW2, 0.2 + 0.2 * Math.sin(uv[1] * 30 + uv[0] * 5)), dtl: [0, 0, 0.2, 0.5],
    });
    knob(acc, rigid(limb), [F[0], F[1] + BOW_Y(0.62) + 0.004, F[2] + s * 0.62], 0.012, 0xd8ccb0, { sz: 1.6 }); // horn nocks
  }
  // string: tip → nock → tip, skinned limb tip ↔ nock bone
  for (const [s, limb] of [[-1, 'limbT'], [1, 'limbB']]) {
    const tip = [F[0], F[1] + BOW_Y(0.61), F[2] + s * 0.61];
    const pts = []; for (let i = 0; i <= 4; i++) pts.push(new V3(...tip).lerp(new V3(...NOCK), i / 4));
    acc.add(sweep(pts, [0.0035, 0.0035, 0.0035, 0.0035, 0.0035], { radial: 3 }), { skin: (p) => { const t = clamp01(1 - Math.abs(p.z - NOCK[2]) / 0.61); return { si: [b(limb), b('nock'), 0, 0], sw: [1 - t, t, 0, 0] }; }, color: 0xd8d0b8, dtl: [0, 0, 0, 0] });
  }
  // nocked arrow (hidden unless drawing): rest points from the nock down through the grip
  arrowGeo(acc, rigid(b('arrow')), new V3(...NOCK), new V3(0, -1, 0), c, 0.74);
  // quiver on the back (right shoulder), with arrow fletchings
  const q0 = new V3(0.1, 1.08, 0.17), q1 = new V3(-0.06, 1.46, 0.2);
  acc.add(sweep([q0, q1], [0.045, 0.05], { radial: 7, capStart: true, capEnd: false }), { skin: rigid(b('chest')), color: (p, n, uv) => lerp3(cL, cW2, uv[1] > 0.85 ? 0.6 : 0.15), dtl: [0, 0, 0.25, 0.4] });
  acc.add(sweep([new V3(0.1, 1.3, 0.1), new V3(0.2, 1.46, 0.02)], [0.009, 0.009], { radial: 3 }), { skin: rigid(b('chest')), color: cL, dtl: [0, 0, 0.2, 0.4] });
  const qd = q1.clone().sub(q0).normalize();
  for (let i = 0; i < 5; i++) {
    const o = new V3((hash(i, 3) - 0.5) * 0.05, 0, (hash(i, 4) - 0.5) * 0.05);
    const base = q1.clone().add(o).addScaledVector(qd, -0.05);
    arrowGeo(acc, rigid(b('chest')), base.clone().addScaledVector(qd, 0.12), qd.clone().negate(), c, 0.12, true);
  }
}
function arrowGeo(acc, skin, nock, fw, c, len, stub = false) {
  const cS = col(0x8a6a44), cF = col(0x9a3224);
  const tip = nock.clone().addScaledVector(fw, len);
  acc.add(sweep([nock, tip], [0.0055, 0.0055], { radial: 4 }), { skin, color: cS, dtl: [0, 0, 0.1, 0.3] });
  if (!stub) acc.add(sweep([tip.clone().addScaledVector(fw, -0.005), tip.clone().addScaledVector(fw, 0.06)], [0.013, 0.0005], { radial: 4 }), { skin, color: c.metal, dtl: [0, 0, 0.2, 0] });
  // fletching: 3 vanes
  const up = Math.abs(fw.y) > 0.9 ? new V3(1, 0, 0) : new V3(0, 1, 0), u = new V3().crossVectors(fw, up).normalize(), v = new V3().crossVectors(fw, u);
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * TAU, dir = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
    const f0 = nock.clone().addScaledVector(fw, 0.02), f1 = nock.clone().addScaledVector(fw, 0.12);
    const gq = new THREE.BufferGeometry();
    const P = [f0, f1, f1.clone().addScaledVector(dir, 0.004), f0.clone().addScaledVector(dir, 0.026)];
    gq.setAttribute('position', new THREE.Float32BufferAttribute(P.flatMap(q => [q.x, q.y, q.z]), 3));
    gq.setIndex([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]); gq.computeVertexNormals();
    acc.add(gq, { skin, color: cF, dtl: [0, 0, 0.1, 0] });
  }
}

function knightArmour(acc, b, c, cB) {
  const cM = col(c.metal), cM2 = col(0x1e2026), cT = col(c.trim), cC = col(c.cloth), cC2 = col(c.cloth2);
  const iron = (p, n, uv) => lerp3(cM, cM2, 0.3 + 0.3 * Math.sin(p.x * 40 + p.y * 30) * Math.sin(p.z * 35));
  // ---- horned helm: dome over the cranium (open face), riveted brow band, nasal guard, cheek plates, great horns
  {
    const prof = [[0.0, 0.125], [0.05, 0.12], [0.085, 0.1], [0.108, 0.07], [0.12, 0.03], [0.124, 0.0], [0.128, -0.012], [0.118, -0.016]];
    const { g, m } = lathe(prof, 18, [0, 1.69, 0.022], [0, 1, 0.12], 0, (p) => { p.z *= 1.14; });
    acc.add(g, { matrix: m, skin: rigid(b('head')), color: (p, n, uv) => uv[1] > 0.7 ? cT : iron(p, n, uv), dtl: [0, 0, 0.35, 0.05] });
    acc.add(sweep([[0, 1.72, -0.122], [0, 1.66, -0.132], [0, 1.625, -0.128]], [0.013, 0.011, 0.008], { radial: 4, flat: 0.5, up: [0, 0, 1] }), { skin: rigid(b('head')), color: cT, dtl: [0, 0, 0.3, 0] });
    for (const s of [-1, 1]) {
      acc.add(new THREE.BoxGeometry(0.014, 0.075, 0.07), { matrix: new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.15, s * 0.25, -s * 0.12, 'YXZ')).setPosition(s * 0.112, 1.64, -0.03), skin: rigid(b('head')), color: iron(new V3(s, 1, 0)), dtl: [0, 0, 0.3, 0] });
      addHorn(acc, b('head'), [s * 0.1, 1.745, 0.0], [s * 0.25, 1.76, -0.02], [s * 0.27, 1.95, -0.1], 0.034, 0.003, { base: c.metal, tip: c.horn, radial: 7, n: 8, gpow: 0.7 });
    }
  }
  // ---- pauldrons: two layered plates per shoulder (upper arm), trimmed
  for (const s of [-1, 1]) {
    const n = s < 0 ? 'L' : 'R';
    for (let l = 0; l < 2; l++) {
      const prof = [[0.0, 0.07], [0.06, 0.062], [0.1, 0.035], [0.128, 0.0], [0.132, -0.01], [0.124, -0.012]].map(([r, y]) => [r * (1 - l * 0.22), y * (1 - l * 0.2)]);
      const { g, m } = lathe(prof, 14, [s * (0.228 + l * 0.03), 1.48 - l * 0.07, 0.035], [s * (0.55 + l * 0.25), 1, 0.05], 0, (p) => { p.z *= 0.92; });
      acc.add(g, { matrix: m, skin: rigid(b('armU' + n)), color: (p, nn, uv) => uv[1] > 0.72 ? cT : iron(p), dtl: [0, 0, 0.35, 0.05] });
    }
    // spike on the upper plate
    addHorn(acc, b('armU' + n), [s * 0.26, 1.53, 0.03], [s * 0.3, 1.6, 0.03], [s * 0.3, 1.66, 0.05], 0.018, 0.002, { base: c.metal, tip: c.trim, radial: 5, n: 4 });
  }
  // ---- broken cuirass over the upper ribcage (front arc), gorget
  {
    const prof = [[0.135, 1.5], [0.172, 1.46], [0.188, 1.4], [0.186, 1.34], [0.176, 1.28]].map(([r, y]) => [r, y - 1.29]); // top → bottom: outward-facing
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 10, Math.PI * 0.58, Math.PI * 0.84);
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i); if (y < 0.02 && x > 0.02) pa.setY(i, y + 0.06 * sstep(0.02, 0.14, x)); pa.setZ(i, pa.getZ(i) * 0.9); }
    g.computeVertexNormals();
    acc.add(g, { matrix: new THREE.Matrix4().makeTranslation(0, 1.29, 0.02), skin: rigid(b('chest')), color: (p, n, uv) => uv[1] < 0.15 ? cT : iron(p), dtl: [0, 0, 0.35, 0.05] });
  }
  // ---- faulds: three hanging plates at the belt
  for (let i = -1; i <= 1; i++) {
    const a = i * 0.55;
    acc.add(new THREE.BoxGeometry(0.1, 0.13, 0.012), { matrix: new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.18, a, 0, 'YXZ')).setPosition(Math.sin(a) * 0.14, 0.925, -Math.cos(a) * 0.12 + 0.02), skin: rigid(b('hips')), color: iron(new V3(i, 0, 0)), dtl: [0, 0, 0.3, 0] });
  }
  // ---- tattered cape: grid skinned across two 3-bone chains
  {
    const cols = 9, rows = 7, P = [], I = [], UV = [];
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const u = q / (cols - 1), v = r / (rows - 1);
      const w = mix(0.17, 0.3, v);
      let y = mix(1.45, 0.52, v);
      if (r === rows - 1) y += (hash(q, 7) * 0.16) + (q % 2 ? 0.06 : 0);
      const x = (u - 0.5) * 2 * w, zz = mix(0.13, 0.26, v) + 0.03 * Math.cos((u - 0.5) * Math.PI) - 0.02 * Math.cos((u - 0.5) * TAU) * 0;
      P.push(x, y, zz); UV.push(u, v);
    }
    for (let r = 0; r < rows - 1; r++) for (let q = 0; q < cols - 1; q++) { const a = r * cols + q, bb = a + 1, cI = a + cols, d = cI + 1; I.push(a, cI, bb, bb, cI, d); }
    for (const face of [1, -1]) {
      const g = new THREE.BufferGeometry();
      const PP = P.slice();
      if (face < 0) for (let i = 2; i < PP.length; i += 3) PP[i] -= 0.006;
      g.setAttribute('position', new THREE.Float32BufferAttribute(PP, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
      g.setIndex(face > 0 ? I : I.map((x, i) => i % 3 === 1 ? I[i + 1] : i % 3 === 2 ? I[i - 1] : x)); g.computeVertexNormals();
      const lv = [1.45, 1.12, 0.8];
      acc.add(g, {
        skin: (p) => {
          const tx = clamp01(p.x / 0.5 + 0.5);
          const fy = p.y > lv[1] ? 0 : 1, t = fy === 0 ? clamp01((lv[0] - p.y) / (lv[0] - lv[1])) : clamp01((lv[1] - p.y) / (lv[1] - lv[2]));
          const A = fy === 0 ? ['cape1', 'cape2'] : ['cape2', 'cape3'];
          return { si: [b(A[0] + 'L'), b(A[1] + 'L'), b(A[0] + 'R'), b(A[1] + 'R')], sw: [(1 - tx) * (1 - t), (1 - tx) * t, tx * (1 - t), tx * t] };
        },
        color: (p, n, uv) => lerp3(face > 0 ? cC : cC2, cM2, sstep(0.6, 1, uv[1]) * 0.45 + (Math.abs(uv[0] - 0.5) > 0.44 ? 0.3 : 0)),
        dtl: [0, 0, 0.3, 0.5],
      });
    }
  }
}

// ================================================================================================ controller
const _t = new V3(), _t2 = new V3(), _pole = new V3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _fw = new V3(0, -1, 0), _ax = new V3();
class SkelCtl extends BipedCtl {
  constructor(inst, spec) {
    super(inst, spec);
    const P = this.pose, cfg = inst.entry.cfg, has = (n) => P.b[n] !== undefined;
    this.cfg = cfg; this.W = cfg.weapon; this.stats = cfg.boneStats;
    this.pile = new Pile(P.n);
    this.x = {
      handL: P.b.handL, handR: P.b.handR, head: P.b.head, chest: P.b.chest, hips: P.b.hips, clothF: P.b.clothF, clothB: P.b.clothB,
      weaponR: has('weaponR') ? P.b.weaponR : -1, weaponL: has('weaponL') ? P.b.weaponL : -1, nock: has('nock') ? P.b.nock : -1,
      arrow: has('arrow') ? P.b.arrow : -1, limbT: has('limbT') ? P.b.limbT : -1, limbB: has('limbB') ? P.b.limbB : -1,
      cape: cfg.knight ? ['cape1L', 'cape2L', 'cape3L', 'cape1R', 'cape2R', 'cape3R'].map(n => P.b[n]) : null,
    };
    this.chainL = makeChain(P, P.b.armUL, P.b.armLL, P.b.handL);
    this.chainR = makeChain(P, P.b.armUR, P.b.armLR, P.b.handR);
    // two-handed grip point on the weapon (rest, model space) and the matching left-wrist offset
    const gp = this.W === 'axe' ? add(FIST(1), DIR.axe, 0.44) : this.W === 'great' ? add(FIST(1), DIR.great, -0.15) : null;
    this.gripL = gp ? new V3(...gp) : null;
    this.fistOffL = new V3(...FIST(1)).sub(new V3(...J.wri)); // wrist → fist (same frame as the weapon hand)
    this.gripW = 0; this.drawW = 0; this.draw = 0; this.arrowVis = 0; this.release = 0; this.aimUp = 0;
    this.clothF = 0; this.clothFv = 0; this.capeL = 0; this.capeV = 0;
    this.seed = (inst.seed || 0) + Math.random() * 100;
    this.pilePer = { [P.b.head]: { roll: 0.32, hop: 0.07 }, [P.b.jaw]: { hop: 0.05 } }; // the skull bounces and rolls away
    postHook(this, post);
  }
}

function post(ctl) {
  const P = ctl.pose, x = ctl.x;
  // ---- two-handed weapons: left hand rides the haft (IK), orientation follows the weapon
  if (ctl.gripL && ctl.gripW > 0.01 && !ctl.dead) {
    const wr = x.weaponR;
    P.carry(wr, ctl.gripL, _t);                                     // grip point on the weapon (world)
    _q.copy(P.wq[wr]);                                               // left fist orientation = weapon's
    _t2.copy(ctl.fistOffL).applyQuaternion(_q); _t.sub(_t2);         // wrist target
    _t2.copy(P.wp[x.handL]).lerp(_t, ctl.gripW);
    _pole.set(-0.5, -0.7, 0.6).applyQuaternion(P.wq[x.chest]);
    solveIK(P, ctl.chainL, _t2, _pole);
    P.wq[x.handL].slerp(_q, ctl.gripW);
    P.fkChildren(x.handL);
  }
  // ---- bow: right hand draws the string to the anchor, nock follows, arrow spans nock → grip, limbs flex
  if (ctl.W === 'bow') {
    const wl = x.weaponL, dw = ctl.drawW, nk = x.nock;
    P.carry(wl, NOCK_V, _t2);                                        // nock at rest (world)
    if (dw > 0.01 && !ctl.dead) {
      // fingers travel from the string to the anchor beside the jaw; the wrist trails behind them
      P.carry(x.head, ANCHOR_V, _t);
      _ax.copy(_t).sub(_t2); const L = _ax.length(); if (L > 1e-4) _ax.divideScalar(L);
      _t.lerp(_t2, 1 - ctl.draw);                                    // fingers (world)
      P.wp[nk].copy(_t2).lerp(_t, dw);
      _t.addScaledVector(_ax, 0.065); _t.y += 0.03;                  // wrist target
      _t.lerp(P.wp[x.handR], 1 - dw);
      _pole.set(0.8, 0.5, 0.7).applyQuaternion(P.wq[x.chest]);
      solveIK(P, ctl.chainR, _t, _pole);
      P.wq[x.handR].slerp(P.wq[ctl.chainR.b], dw);                   // straight wrist
    } else P.wp[nk].copy(_t2);
    if (ctl.release > 0) { P.carry(wl, NOCK_V, _t); _t.addScaledVector(_t2.set(0, -0.035, 0).applyQuaternion(P.wq[wl]), Math.sin(ctl.release * 30) * ctl.release); P.wp[nk].copy(_t); }
    P.wq[nk].copy(P.wq[wl]);
    // limbs flex with the draw
    const flex = 0.22 * ctl.draw * dw;
    P.wq[x.limbT].copy(P.wq[wl]).multiply(_q.setFromAxisAngle(_ax.set(1, 0, 0), flex));
    P.wq[x.limbB].copy(P.wq[wl]).multiply(_q.setFromAxisAngle(_ax.set(1, 0, 0), -flex));
    // arrow: pivot at the nock, pointing through the bow grip
    const ar = x.arrow;
    P.wp[ar].copy(P.wp[nk]);
    _t.copy(P.wp[wl]).sub(P.wp[nk]);
    if (_t.lengthSq() > 1e-6) { _t.normalize(); P.wq[ar].setFromUnitVectors(_fw, _t); }
    P.sc[ar].setScalar(ctl.arrowVis > 0.5 && !ctl.dead ? 1 : 0.0001);
  }
  // ---- death: bones separate and clatter into a heap
  const da = ctl.acts.get('death');
  if (da) {
    if (!da.u.planned) {
      da.u.planned = true;
      const hp = P.wp[x.hips];
      ctl.pile.plan(ctl, ctl.stats, { cx: hp.x, cz: hp.z + 0.12, pull: da.u.fromDown ? 0.1 : 0.45, spread: 0.42, delay: da.u.fromDown ? [0.05, 0.3] : [0.22, 0.42], fall: 0.34, hop: 0.05, stack: 0.05, skip: ctl.pileSkip, per: ctl.pilePer, seed: ctl.seed + da.seed });
    }
    ctl.pile.blend(ctl, da.t, da.w);
  }
}
const NOCK_V = new V3(...NOCK), ANCHOR_V = new V3(0.07, 1.6, -0.02), FIST_R_V = new V3(0.262, 0.87, 0.0);

// ================================================================================================ animation
const GAIT = {
  legs: [
    { id: 'L', chain: ['thighL', 'shinL', 'footL'], toe: [-0.124, 0, -0.105], body: 'hips', lift: 0.1, flex: 0.55, heel: 0.35, out: 0.06 },
    { id: 'R', chain: ['thighR', 'shinR', 'footR'], toe: [0.124, 0, -0.105], body: 'hips', lift: 0.075, flex: 0.5, heel: 0.3, out: 0.06 },
  ],
  maxStride: 0.62, fMin: 0.6,
  gaits: [
    { v: 1.2, f: 1.75, duty: 0.6, lift: 1.0, off: { L: 0, R: 0.5 }, bob: 0.022, bobF: 2, bobPh: 0.1, roll: 0.06, rollF: 1, rollPh: 0.25, sway: 0.022, swayF: 1, swayPh: 0.25, nod: 0.05, nodF: 2 },
    { v: 4.4, f: 2.9, duty: 0.4, lift: 1.3, off: { L: 0, R: 0.5 }, bob: 0.04, bobF: 2, bobPh: 0.3, roll: 0.05, rollF: 1, rollPh: 0.25, nod: 0.06, nodF: 2 },
  ],
};

// hold poses per weapon (solved with an FK fit, then tuned by eye): [up, out, twist, elbow, forearm twist, wrist, wrist twist]
// [relaxed idle, combat, relaxed walking (optional)]. Two-handed weapons also IK the left fist onto the haft (post()).
export const HOLD = {
  sword: { R: [[0.04, 0.05, 0.08, 0.2, 0.26, -0.13, -0.45], [0.12, 0.53, 0.77, 0.68, -0.68, 0.02, -0.15]], L: [[-0.12, 0.05, 0.7, 0.18, 0.36, 0, 0], [-0.11, 0.45, -1.39, 1.77, 1.52, 0, 0]] },
  axe: { R: [[0.05, 0.1, 0.0, 0.25, 0, -0.35, 1.45], [0.23, 0.05, -0.06, 0.5, 1.6, 0.01, -1.14]], L: [[0.05, 0.1, 0, 0.3, 0, 0, 0], [0.5, 0, 0.3, 1.0, 0, 0, 0]] },
  bow: { R: [[0.08, 0.1, 0, 0.3, 0, 0, 0], [0.45, 0.15, 0, 0.8, 0, 0, 0]], L: [[0.11, -0.16, 0.56, 0.6, -1.83, 0.32, 0.24], [0.14, -0.7, 0.87, 0.82, -0.98, 0.34, -0.25]] },
  great: { R: [[0.47, 0.44, 1.26, 0, 1.2, -0.86, 1.0], [0.17, 0.2, 0.53, 0.81, 0.76, 0.03, -0.84], [0.31, -0.15, -0.7, 0, -1.07, 0.02, -1.32]], L: [[0.6, 0, 0.3, 1.2, 0, 0, 0], [0.6, 0, 0.3, 1.2, 0, 0, 0], [0.05, 0.12, 0, 0.3, 0, 0, 0]] },
};
const hv = (hp, i, mk, cb) => mix(mix(hp[0][i], (hp[2] || hp[0])[i], mk), hp[1][i], cb);
const ATTACKS = ['attack', 'attack2', 'attack_big', 'roar', 'idle_alt', 'death', 'knockdown', 'getup', 'spawn', 'spawn_drop', 'stun', 'knockback', 'hit'];

function poseFn(ctl, dt) {
  const P = ctl.pose, b = ctl.b, t = ctl.t, G = ctl.gait, W = ctl.W, x = ctl.x;
  ctl.flame = 1;
  // busy = weight of any action that owns the arms
  let busy = 0; for (let i = 0; i < ATTACKS.length; i++) { const w = ctl.acts.weight(ATTACKS[i]); if (w > busy) busy = w; }
  const H = HOLD[W], cb = ctl.combat, rel = 1 - busy, mk = clamp01(G.act * 1.5);
  for (let s = -1; s <= 1; s += 2) {
    const hp = s < 0 ? H.L : H.R, arm = s < 0 ? b.armL : b.armR;
    P.rot(arm[0], hv(hp, 0, mk, cb) * rel, hv(hp, 2, mk, cb) * rel, s * hv(hp, 1, mk, cb) * rel);
    P.rx(arm[1], hv(hp, 3, mk, cb) * rel); P.ry(arm[1], hv(hp, 4, mk, cb) * rel);
    P.rot(arm[2], hv(hp, 5, mk, cb) * rel, hv(hp, 6, mk, cb) * rel, 0);
  }
  // two-handed grip weight (axe / greatsword): on in combat & during attacks, off when relaxed (carried on the shoulder)
  if (ctl.gripL) ctl.gripW = clamp01(Math.max(cb, W === 'great' ? 1 - mk : 0, ctl.acts.weight('attack'), ctl.acts.weight('attack2'), ctl.acts.weight('attack_big')) * (1 - Math.max(ctl.acts.weight('death'), ctl.acts.weight('knockdown'), ctl.acts.weight('hit'), ctl.acts.weight('knockback'), ctl.acts.weight('stun'), ctl.acts.weight('getup'), ctl.acts.weight('spawn'), ctl.acts.weight('idle_alt'), ctl.acts.weight('roar'), ctl.acts.weight('spawn_drop'))));
  if (W === 'bow') { ctl.drawW = 0; ctl.draw = 0; ctl.arrowVis = 0; ctl.release = Math.max(0, ctl.release - dt * 3); }
  // ---- rattle & jerk: footfall shudder, twitchy quantised head, chattering jaw, cocked skull
  let jolt = 0; for (let i = 0; i < G.legs.length; i++) jolt = Math.max(jolt, G.legs[i].down);
  const q = Math.floor(t * 7), tw1 = hash(q, 1.7) - 0.5, tw2 = hash(q, 2.9) - 0.5, tq = sstep(0, 0.25, t * 7 - q);
  const pq = Math.floor(t * 7 - 1), pw1 = hash(pq, 1.7) - 0.5, pw2 = hash(pq, 2.9) - 0.5;
  const jy = mix(pw1, tw1, tq), jx = mix(pw2, tw2, tq);
  const sh = Math.sin(t * 57) * jolt;
  P.rot(b.head, 0.05 * jx + 0.06 * sh, 0.1 * jy, 0.13 + 0.05 * jy);
  P.rot(b.chest, 0.03 * sh, 0.03 * jy, 0.04 * sh);
  P.rx(b.spine, -0.06 - 0.03 * cb);
  ctl.jaw += 0.06 + 0.1 * jolt * Math.abs(Math.sin(t * 43)) + 0.06 * Math.max(0, Math.sin(t * 2.3)) * Math.abs(Math.sin(t * 31)) + 0.05 * cb * Math.abs(Math.sin(t * 20));
  for (let s = -1; s <= 1; s += 2) { const arm = s < 0 ? b.armL : b.armR; P.rz(arm[1], s * 0.05 * sh); }
  // ---- loincloth: pushed by the leading thigh, flutters with speed
  let fz = 0; for (let i = 0; i < G.legs.length; i++) fz = Math.min(fz, G.legs[i].F.z - G.legs[i].home.z);
  const tgt = clamp01(-fz * 3) * 0.55 + 0.12 * ctl.run;
  ctl.clothFv += ((tgt - ctl.clothF) * 60 - ctl.clothFv * 9) * dt; ctl.clothF += ctl.clothFv * dt;
  P.rx(x.clothF, ctl.clothF);
  P.rx(x.clothB, -0.25 * ctl.run - 0.08 * clamp01(Math.abs(ctl.speedSm)) + 0.04 * Math.sin(t * 3.1));
  // ---- knight cape: billows back with speed, sways
  if (x.cape) {
    const ct = -(0.3 * clamp01(Math.abs(ctl.speedSm) / 3) + 0.45 * ctl.run);
    ctl.capeV += ((ct - ctl.capeL) * 30 - ctl.capeV * 6) * dt; ctl.capeL += ctl.capeV * dt;
    for (let s = 0; s < 2; s++) for (let i = 0; i < 3; i++) {
      const bi = x.cape[s * 3 + i];
      P.rot(bi, ctl.capeL * (0.35 + i * 0.3) + 0.04 * Math.sin(t * 2.3 - i * 0.8 + s), 0, (s ? 1 : -1) * 0.03 * Math.sin(t * 1.9 - i + s * 2));
    }
  }
}

// ---- helper: sword arm swing keyed by phases
const up = (ctl, s, u, o, tw, e, wr, w) => { const arm = s < 0 ? ctl.b.armL : ctl.b.armR, P = ctl.pose; P.rot(arm[0], u * w, tw * w, s * o * w); P.rx(arm[1], e * w); if (wr) P.rx(arm[2], wr * w); };

const COMMON = {
  hit: bHit(),
  knockback: bKnockback(),
  knockdown: bKnockdown({ lieY: 0.13 }),
  getup: bGetup({ lieY: 0.13 }),
  stun: bStun(),
  spawn: bSpawn({ depth: 1.05 }),
  spawn_drop: bDrop({ height: 3 }),
  roar: { dur: 1.4, a: 0.1, d: 0.85, fn(ctl, a, w) { // shrieking rattle: jaw wide, head back, weapon raised
    const P = ctl.pose, b = ctl.b, t = a.t, k = a.k;
    const u = sstep(0, 0.22, k) * (1 - sstep(0.8, 1, k)), sh = Math.sin(t * 48) * 0.035 * u;
    P.move(b.hips, 0, -0.03 * u * w, 0);
    P.rx(b.spine, 0.12 * u * w); P.rx(b.chest, 0.12 * u * w);
    P.rot(b.head, (0.5 * u + sh) * w, sh * w, sh * w);
    up(ctl, 1, 2.3 * u, 0.5 * u, 0, 0.6 * u, -0.3 * u, w); up(ctl, -1, 1.2 * u, 0.9 * u, 0, 0.8 * u, 0, w);
    ctl.jaw = Math.max(ctl.jaw, (0.75 + 0.15 * Math.sin(t * 30)) * u * w);
    ctl.glow = mix(ctl.glow, 2.4, u * w); ctl.charge = Math.max(ctl.charge, 0.35 * u * w);
    legsPlant(ctl, u * w * 0.6, 1.3, 0);
  } },
  idle_alt: { dur: 2.4, a: 0.12, d: 0.85, fn(ctl, a, w) { // the jaw slips; it shoves it back in place with a clack
    const P = ctl.pose, b = ctl.b, k = a.k;
    const hang = sstep(0.05, 0.2, k) * (1 - sstep(0.62, 0.66, k)), reach = sstep(0.3, 0.5, k) * (1 - sstep(0.75, 0.9, k));
    const clack = sstep(0.62, 0.66, k) * (1 - sstep(0.7, 0.85, k));
    const hand = ctl.W === 'sword' ? 0 : 1, snap = (1 - hand) * sstep(0.5, 0.56, k) * (1 - sstep(0.62, 0.8, k));
    P.rot(b.head, (-0.15 * hang + 0.2 * clack - 0.35 * snap) * w, (0.25 * reach * hand + 0.3 * Math.sin(k * 40) * snap) * w, 0.2 * hang * w);
    const s = ctl.W === 'bow' ? 1 : -1;
    up(ctl, s, 1.7 * reach * hand, -0.2 * reach * hand, -s * 0.5 * reach * hand, 2.0 * reach * hand, 0, w);
    ctl.jaw = Math.max(ctl.jaw, 0.85 * hang * w);
  } },
  death: { dur: 1.5, hold: true, excl: true, state: true, fadeIn: 0.02, keep: true, fn(ctl, a, w) { // jolt → buckle; post() scatters the bones
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    ctl.glow = mix(ctl.glow, 0, sstep(0.05, 0.5, t) * w * (0.6 + 0.4 * Math.abs(Math.sin(t * 40))));
    ctl.flame = 1 - sstep(0.15, 0.55, t);
    if (a.u.fromDown) { P.move(b.hips, 0, -(ctl.pose.rest[b.hips].y - 0.13) * w, 0); P.rx(b.hips, 1.5 * w); legsLocal(ctl, w, 0.04, 1.2, 0, 0.28); return; }
    const jolt = sstep(0, 0.06, t) * (1 - sstep(0.1, 0.3, t)), buckle = sstep(0.08, 0.34, t);
    P.move(b.hips, 0, -0.28 * buckle * w, 0.05 * jolt * w);
    P.rot(b.hips, (0.15 * jolt - 0.2 * buckle) * w, 0, 0.08 * buckle * w);
    P.rot(b.spine, (0.25 * jolt + 0.3 * buckle) * w, 0, 0); P.rot(b.head, (0.5 * jolt - 0.5 * buckle) * w, 0, 0.3 * buckle * w);
    up(ctl, 1, 0.6 * jolt, 0.3, 0, 0.4, 0, w); up(ctl, -1, 0.5 * jolt, 0.3, 0, 0.4, 0, w);
    ctl.jaw = Math.max(ctl.jaw, 0.8 * w);
    legsLocal(ctl, buckle * w, 0.35, 1.25, 0, 0);
  } },
};

// ---- keyframed melee: arm key poses (FK-solved: [up, out, twist, elbow, forearm twist, wrist, wrist twist]) + torso keys
const KP = {
  sword_wind: [2.68, 1.24, -1.01, 1.01, 0.7, -0.76, 1.2], sword_end: [0.94, -0.07, 1.53, 0, -0.7, -0.95, -0.08],
  sword_over: [2.55, -0.08, 0.28, 0.52, -0.74, -0.4, 1.1], sword_slam: [0.54, 1.05, 1.6, 0, -1.52, -0.59, -0.05],
  axe_wind: [-0.16, 0.94, -1.6, 0.19, -1.6, -0.97, -0.59], axe_end: [0.93, -0.42, 1.6, 0, -0.4, -1, 0.07],
  axe_over: [2.18, -0.26, 0.17, 1.13, -0.05, -0.9, 0.58], axe_chop: [1.07, 0.64, 0.97, 0, 0.06, -1, -0.57],
  great_wind: [3.0, 1.4, -1.21, 1.01, 1.14, -0.78, 0.98], great_end: [0.91, -0.11, 1.6, 0, -0.74, -1, 0.14],
  great_over: [2.35, 0.16, 0.86, 0.76, 0.97, -0.5, -0.12], great_slam: [0.7, 1.04, 1.58, 0, -1.05, -0.79, -0.42],
  great_thrust_wind: [-0.6, 0.5, -1.55, 1.25, 1.02, 0.1, -0.18], great_thrust: [1.34, -0.23, 0.07, 0, 0.93, -0.83, -1.02],
};
/** a keyed track: T (normalised times), keys [[7 arm params, pitch, yaw, dy, dz]] — "hold" = the weapon's combat hold */
function track(W, T, keys) {
  const hold = HOLD[W].R[1];
  const rows = keys.map(k => { const [arm, pitch = 0, yaw = 0, dy = 0, dz = 0] = k; const a = arm === 'hold' ? hold : KP[arm]; return [...a, pitch, yaw, dy, dz]; });
  const V = []; for (let i = 0; i < 11; i++) V.push(rows.map(r => r[i]));
  return { T, V };
}
const _kv = new Float32Array(11);
function playTrack(ctl, tr, k, w, trem = 0) {
  for (let i = 0; i < 11; i++) _kv[i] = kf(k, tr.T, tr.V[i]);
  const P = ctl.pose, b = ctl.b, arm = b.armR, pitch = _kv[7] + trem, yaw = _kv[8];
  P.rot(arm[0], (_kv[0] + trem * 2) * w, _kv[2] * w, _kv[1] * w); P.rx(arm[1], _kv[3] * w); P.ry(arm[1], _kv[4] * w); P.rot(arm[2], _kv[5] * w, _kv[6] * w, 0);
  P.move(b.hips, 0, _kv[9] * w, _kv[10] * w);
  P.rot(b.hips, 0.2 * pitch * w, 0.3 * yaw * w, 0); P.rot(b.spine, 0.5 * pitch * w, 0.45 * yaw * w, 0); P.rot(b.chest, 0.3 * pitch * w, 0.25 * yaw * w, 0);
  P.rx(b.head, -0.45 * pitch * w); P.ry(b.head, -0.4 * yaw * w);
}
const TR = {
  sword_attack: track('sword', [0, 0.34, 0.41, 0.5, 0.64, 1], [['hold'], ['sword_wind', 0.1, 0.6, -0.02, 0.03], ['sword_wind', 0.12, 0.62, -0.03, 0.03], ['sword_end', -0.25, -0.85, -0.06, -0.08], ['sword_end', -0.22, -0.8, -0.05, -0.07], ['hold']]),
  sword_big: track('sword', [0, 0.38, 0.58, 0.66, 0.82, 1], [['hold'], ['sword_over', 0.28, 0.1, -0.02, 0.04], ['sword_over', 0.32, 0.12, -0.04, 0.05], ['sword_slam', -0.7, 0, -0.16, -0.14], ['sword_slam', -0.66, 0, -0.15, -0.13], ['hold']]),
  axe_attack: track('axe', [0, 0.4, 0.46, 0.57, 0.7, 1], [['hold'], ['axe_wind', 0.05, 0.9, -0.03, 0.03], ['axe_wind', 0.06, 0.92, -0.04, 0.03], ['axe_end', -0.15, -1.1, -0.06, -0.08], ['axe_end', -0.12, -1.0, -0.05, -0.06], ['hold']]),
  axe_chop: track('axe', [0, 0.42, 0.48, 0.58, 0.74, 1], [['hold'], ['axe_over', 0.3, 0.1, -0.02, 0.04], ['axe_over', 0.32, 0.1, -0.03, 0.04], ['axe_chop', -0.75, 0, -0.14, -0.12], ['axe_chop', -0.7, 0, -0.13, -0.1], ['hold']]),
  axe_big: track('axe', [0, 0.36, 0.56, 0.68, 0.84, 1], [['hold'], ['axe_over', 0.3, 0.05, -0.12, 0.06], ['axe_over', 0.34, 0.05, -0.14, 0.06], ['axe_chop', -0.8, 0, -0.18, -0.55], ['axe_chop', -0.75, 0, -0.16, -0.55], ['hold', 0, 0, 0, -0.3]]),
  great_attack: track('great', [0, 0.38, 0.45, 0.55, 0.68, 1], [['hold'], ['great_wind', 0.1, 0.7, -0.03, 0.03], ['great_wind', 0.12, 0.72, -0.04, 0.03], ['great_end', -0.25, -0.95, -0.07, -0.08], ['great_end', -0.22, -0.9, -0.06, -0.07], ['hold']]),
  great_thrust: track('great', [0, 0.38, 0.44, 0.52, 0.66, 1], [['hold'], ['great_thrust_wind', 0.05, 0.4, -0.05, 0.08], ['great_thrust_wind', 0.06, 0.42, -0.06, 0.08], ['great_thrust', -0.3, -0.1, -0.08, -0.25], ['great_thrust', -0.28, -0.1, -0.07, -0.22], ['hold']]),
  great_big: track('great', [0, 0.4, 0.58, 0.66, 0.82, 1], [['hold'], ['great_over', 0.3, 0.05, -0.02, 0.04], ['great_over', 0.34, 0.05, -0.04, 0.05], ['great_slam', -0.75, 0, -0.18, -0.15], ['great_slam', -0.7, 0, -0.17, -0.14], ['hold']]),
};
const tremble = (k, a, b, t) => sstep(a, b, k) * (1 - sstep(b, b + 0.03, k)) * Math.sin(t * 58) * 0.03;
const telegraph = (ctl, k, a, b, w) => { const g = sstep(a, b, k) * (1 - sstep(b + 0.03, b + 0.12, k)); ctl.glow = mix(ctl.glow, 1 + 2.8 * g, w); ctl.charge = Math.max(ctl.charge, g * w); };

const SWORD = {
  attack: { dur: 0.72, a: 0.05, d: 0.85, hit: 0.47, fn(ctl, a, w) { // diagonal slash: blade cocked high behind the right shoulder → cut across and down
    playTrack(ctl, TR.sword_attack, a.k, w);
    up(ctl, -1, 0.15 * sstep(0.3, 0.5, a.k) * (1 - sstep(0.6, 1, a.k)), 0.05, 0.3, 0.2, 0, w);
    ctl.jaw = Math.max(ctl.jaw, 0.55 * sstep(0.44, 0.5, a.k) * (1 - sstep(0.6, 0.9, a.k)) * w);
    legsPlant(ctl, sstep(0.2, 0.4, a.k) * (1 - sstep(0.7, 1, a.k)) * w * 0.6, 1.35, -0.05);
  } },
  attack2: { dur: 0.8, a: 0.06, d: 0.85, hit: 0.48, fn(ctl, a, w) { // shield bash + lunge
    const P = ctl.pose, b = ctl.b, k = a.k;
    const wind = sstep(0, 0.36, k) * (1 - sstep(0.36, 0.46, k)), bash = sstep(0.38, 0.5, k) * (1 - sstep(0.65, 1, k));
    P.move(b.hips, 0, -0.04 * (wind + bash) * w, (0.05 * wind - 0.16 * bash) * w);
    P.rot(b.spine, (0.1 * wind - 0.2 * bash) * w, (-0.45 * wind + 0.4 * bash) * w, 0);
    P.ry(b.armLL, 0);
    up(ctl, -1, 0.3 * wind + 0.9 * bash, 0.1 * wind + 0.25 * bash, -0.9 * wind - 0.6 * bash, 1.6 * wind + 0.9 * bash, 0, w);
    ctl.pose.ry(ctl.b.armL[1], (1.4 * wind + 1.3 * bash) * w);
    up(ctl, 1, 0.4 * wind, 0.3, 0, 0.9, 0, w);
    ctl.jaw = Math.max(ctl.jaw, 0.6 * bash * w);
    legsPlant(ctl, (wind + bash) * w * 0.6, 1.3, -0.06 * bash);
  } },
  attack_big: { dur: 1.6, a: 0.05, d: 0.9, hit: 0.64, fn(ctl, a, w) { // overhead cleave: long trembling windup (eyes flare) → slam
    const k = a.k;
    playTrack(ctl, TR.sword_big, k, w, tremble(k, 0.3, 0.58, a.t));
    up(ctl, -1, 0.3 * sstep(0.1, 0.4, k) * (1 - sstep(0.6, 0.9, k)), 0.2, 0.2, 0.3, 0, w);
    ctl.jaw = Math.max(ctl.jaw, (0.4 * sstep(0, 0.4, k) + 0.6 * sstep(0.58, 0.66, k)) * (1 - sstep(0.8, 1, k)) * w);
    telegraph(ctl, k, 0.08, 0.58, w);
    legsPlant(ctl, sstep(0.1, 0.4, k) * (1 - sstep(0.85, 1, k)) * w * 0.8, 1.45, -0.05 * sstep(0.58, 0.66, k));
  } },
};

const AXE = {
  attack: { dur: 0.95, a: 0.05, d: 0.86, hit: 0.54, fn(ctl, a, w) { // horizontal sweep right → left
    playTrack(ctl, TR.axe_attack, a.k, w);
    ctl.jaw = Math.max(ctl.jaw, 0.6 * sstep(0.5, 0.57, a.k) * (1 - sstep(0.7, 0.95, a.k)) * w);
    legsPlant(ctl, sstep(0.2, 0.4, a.k) * (1 - sstep(0.75, 1, a.k)) * w * 0.7, 1.4, -0.03);
  } },
  attack2: { dur: 1.05, a: 0.05, d: 0.86, hit: 0.56, fn(ctl, a, w) { // overhead chop into the ground
    playTrack(ctl, TR.axe_chop, a.k, w);
    ctl.jaw = Math.max(ctl.jaw, 0.7 * sstep(0.5, 0.58, a.k) * (1 - sstep(0.75, 1, a.k)) * w);
    legsPlant(ctl, sstep(0.2, 0.42, a.k) * (1 - sstep(0.8, 1, a.k)) * w * 0.8, 1.45, -0.05 * sstep(0.48, 0.58, a.k));
  } },
  attack_big: { dur: 1.9, a: 0.04, d: 0.9, hit: 0.68, fn(ctl, a, w) { // leaping cleave: crouch with the axe high (trembling, eyes flare) → leap → cleave
    const k = a.k, H = ctl.H;
    playTrack(ctl, TR.axe_big, k, w, tremble(k, 0.25, 0.54, a.t));
    const hop = Math.sin(clamp01((k - 0.54) / 0.14) * Math.PI);
    ctl.pose.move(ctl.b.hips, 0, 0.18 * hop * H * 0.6 * w, 0);
    ctl.jaw = Math.max(ctl.jaw, (0.4 * sstep(0, 0.36, k) + 0.6 * sstep(0.6, 0.68, k)) * (1 - sstep(0.84, 1, k)) * w);
    telegraph(ctl, k, 0.05, 0.54, w);
    legsPlant(ctl, sstep(0.05, 0.3, k) * (1 - sstep(0.52, 0.56, k)) * w, 1.5, 0);
    legsLocal(ctl, hop * w, 0.3, 1.2);
    legsPlant(ctl, sstep(0.64, 0.68, k) * (1 - sstep(0.9, 1, k)) * w, 1.5, -0.5);
  } },
};
// bow actions drive ctl.drawW / draw / arrowVis; post() IKs the drawing arm
function shoot(ctl, a, w, T, aimUp) {
  const P = ctl.pose, b = ctl.b, k = a.k;
  const raise = sstep(T[0], T[1], k) * (1 - sstep(T[4], 1, k));
  const draw = sstep(T[1], T[2], k) * (1 - sstep(T[3], T[3] + 0.02, k));
  const rel = sstep(T[3], T[3] + 0.02, k) * (1 - sstep(T[3] + 0.1, T[4], k));
  const aim = raise * (1 - rel * 0.3);
  // body turns side-on to aim along −Z with the left arm
  P.rot(b.hips, 0, -0.5 * aim * w, 0);
  P.rot(b.spine, -aimUp * 0.25 * aim * w, -0.35 * aim * w, 0);
  P.rot(b.chest, -aimUp * 0.3 * aim * w, -0.25 * aim * w, 0);
  P.rot(b.head, (-aimUp * 0.3) * aim * w, 0.75 * aim * w, -0.1 * aim * w);
  // bow arm: straight toward the target (compensating the body turn), bow held vertical
  up(ctl, -1, (1.5 + aimUp) * aim, 0.05 * aim, 0.95 * aim, 0.05 * aim, 0, w);
  up(ctl, 1, 1.2 * raise * (1 - draw) + 0.4 * rel, 0.5 * raise, 0, 1.2 * raise, 0, w);
  ctl.drawW = Math.max(ctl.drawW, Math.min(raise, 1 - rel) * w);
  ctl.draw = Math.max(ctl.draw, draw);
  ctl.arrowVis = Math.max(ctl.arrowVis, k > T[1] - 0.05 && k < T[3] ? 1 : 0);
  if (rel > 0.5 && ctl.release <= 0.01 && k < T[3] + 0.03) ctl.release = 1;
  ctl.jaw = Math.max(ctl.jaw, 0.2 * draw * w);
  legsPlant(ctl, aim * w * 0.8, 1.45, 0);
  SHOT.raise = raise; SHOT.draw = draw; SHOT.rel = rel;
  return SHOT;
}
const SHOT = { raise: 0, draw: 0, rel: 0 }; // scratch result (no per-frame allocation)
const BOW = {
  attack: { dur: 1.05, a: 0.06, d: 0.88, hit: 0.7, fn(ctl, a, w) { shoot(ctl, a, w, [0, 0.24, 0.6, 0.7, 0.86], 0.05); } },
  attack2: { dur: 0.62, a: 0.05, d: 0.86, hit: 0.5, fn(ctl, a, w) { shoot(ctl, a, w, [0, 0.14, 0.42, 0.5, 0.78], -0.05); } },
  attack_big: { dur: 2.0, a: 0.05, d: 0.9, hit: 0.76, fn(ctl, a, w) { // volley: aim high, long glowing draw (telegraph) → loose into the sky
    const r = shoot(ctl, a, w, [0, 0.2, 0.62, 0.76, 0.9], 1.0);
    const g = sstep(0.15, 0.7, a.k) * (1 - sstep(0.76, 0.84, a.k));
    ctl.glow = mix(ctl.glow, 1 + 3 * g, w); ctl.charge = Math.max(ctl.charge, g * w);
    ctl.pose.rx(ctl.b.hips, 0.16 * r.raise * w); ctl.pose.rx(ctl.b.spine, 0.12 * r.raise * w);
  } },
};

const GREAT = {
  attack: { dur: 0.85, a: 0.05, d: 0.86, hit: 0.52, fn(ctl, a, w) { // two-handed diagonal cut
    playTrack(ctl, TR.great_attack, a.k, w);
    ctl.jaw = Math.max(ctl.jaw, 0.5 * sstep(0.47, 0.55, a.k) * (1 - sstep(0.68, 0.95, a.k)) * w);
    legsPlant(ctl, sstep(0.2, 0.4, a.k) * (1 - sstep(0.75, 1, a.k)) * w * 0.7, 1.4, -0.04);
  } },
  attack2: { dur: 0.9, a: 0.05, d: 0.86, hit: 0.5, fn(ctl, a, w) { // lunging thrust
    playTrack(ctl, TR.great_thrust, a.k, w);
    ctl.jaw = Math.max(ctl.jaw, 0.5 * sstep(0.44, 0.52, a.k) * (1 - sstep(0.66, 0.9, a.k)) * w);
    legsPlant(ctl, sstep(0.2, 0.38, a.k) * (1 - sstep(0.75, 1, a.k)) * w * 0.8, 1.45, -0.12 * sstep(0.44, 0.52, a.k));
  } },
  attack_big: { dur: 1.8, a: 0.05, d: 0.9, hit: 0.66, fn(ctl, a, w) { // soul-fire flares, sword raised overhead → earth-splitting slam
    const k = a.k;
    playTrack(ctl, TR.great_big, k, w, tremble(k, 0.3, 0.58, a.t));
    ctl.jaw = Math.max(ctl.jaw, (0.5 * sstep(0, 0.4, k) + 0.5 * sstep(0.58, 0.66, k)) * (1 - sstep(0.82, 1, k)) * w);
    telegraph(ctl, k, 0.05, 0.58, w);
    legsPlant(ctl, sstep(0.1, 0.4, k) * (1 - sstep(0.85, 1, k)) * w * 0.85, 1.5, -0.06 * sstep(0.58, 0.66, k));
  } },
};

const SETS = { sword: SWORD, axe: AXE, bow: BOW, great: GREAT };
const ACTS = {}; for (const [k, v] of Object.entries(SETS)) ACTS[k] = { ...v, ...COMMON };
const ACTION_NAMES = { attack: 1, attack2: 1, attack_big: 1, roar: 1, hit: 1, knockback: 1, knockdown: 1, getup: 1, death: 1, spawn: 1, spawn_drop: 1, idle_alt: 1, stun: 1 };
const SPECS = {};
function specFor(cfg) {
  const W = cfg.weapon;
  return SPECS[W] || (SPECS[W] = {
    bones: { hips: 'hips', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head', jaw: 'jaw', armL: ['armUL', 'armLL', 'handL'], armR: ['armUR', 'armLR', 'handR'] },
    gait: GAIT,
    arm: { swing: 0.5, out: 0, elbow: 0, runSwing: 0.8, runOut: 0.1, runElbow: 0.9, combatUp: 0, combatElbow: 0, combatOut: 0, weaponSwing: W === 'axe' || W === 'great' ? 0.15 : 0.5 },
    lean: { walk: 0.08, run: 0.32, combat: 0.1 }, twist: 0.12, waddle: 0.03, crouch: 0.07, breathe: 0,
    fidgets: [{ name: 'idle_alt', w: 1 }], fidgetGap: 5,
    pose: poseFn,
    chargeK: 0.2,
    actions: ACTS[W],
  });
}
