// Horse: a handsome riding horse (withers 1.52 m, poll ~2.05 m). Deep chest, sloped shoulder, short back, round croup,
// arched crest into a refined wedge head with big dark eyes; clean legs with flat knees, fetlocks, sloped pasterns and
// hooves. Full tack: saddle pad, saddle (pommel horn + cantle), girth, stirrups, bridle (headstall, browband, noseband,
// bit) and reins. Mane locks, forelock and tail hair ride damped springs (secondary motion).
// Variants: brown (bay), white (grey), black, armoured (steel chanfron / crinet / peytral + heraldic caparison).
import * as THREE from 'three';
import { QuadCtl } from '../ctl.js';
import { leafGeo } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addEye, addHorn } from '../../kit/parts.js';
import { addG, lock, strap, ring, surfPath, smoothPath, pathSkin, mixSkin, rigidSkin, skinAt, marchOut, sdfNormal, wrapGrid, shell, linspace, Jiggle, lerp3, sstep, clamp01, mix, TAU } from './common.js';
import { saddleSet, sunEmblem, surfFrame } from './tack.js';
import { mRear, mJump, mGraze, mShake, mPaw, mSwish, mWhinny, mHit, mDeath, mSpawn } from './mountacts.js';

const V3 = THREE.Vector3;
const PAL = {
  brown: { coat: 0x7e4526, coat2: 0x5a2d16, belly: 0xa06a44, points: 0x1c1411, mane: 0x18110e, maneTip: 0x46301f, muzzle: 0x2e2320, hoof: 0x35302c, eye: 0x3a1c0a, sock: 0xeee8de,
    star: 1, blaze: 0, socks: [0, 0, 0.27, 0],
    t: { leather: 0x6a3a1c, seat: 0x7c4626, stitch: 0xd8b070, pad: 0x8e1d24, trim: 0xe0b048, trim2: 0x5a1218, strap: 0x3a2214, metal: 0xd4d4dc } },
  white: { coat: 0xe6e1d8, coat2: 0xcac2b6, belly: 0xf2eee8, points: 0xa89e94, mane: 0xf4f0e8, maneTip: 0xc9bfb2, muzzle: 0x5a4e4e, hoof: 0x8e857c, eye: 0x2a1a10, sock: 0xf4f0e8, dapple: 0xb4aca2,
    star: 0, blaze: 0, socks: [0, 0, 0, 0],
    t: { leather: 0x8a5a30, seat: 0x9c6a3a, stitch: 0xf0d8a0, pad: 0x21428e, trim: 0xe8ecf4, trim2: 0x142a66, strap: 0x5a3a20, metal: 0xeceef4 } },
  black: { coat: 0x201e25, coat2: 0x131217, belly: 0x2c2a33, points: 0x131216, mane: 0x0e0d11, maneTip: 0x2e2a36, muzzle: 0x1a1719, hoof: 0x2a2622, eye: 0x1a0e08, sock: 0xece8e0, sheen: 0x565a70,
    star: 1, blaze: 1, socks: [0, 0, 0.3, 0.3],
    t: { leather: 0x1e1613, seat: 0x2c211b, stitch: 0xc8a048, pad: 0x4c1858, trim: 0xe4b444, trim2: 0x2a0c32, strap: 0x151113, metal: 0xe4b444 } },
  armoured: { coat: 0x3e2b22, coat2: 0x2a1c16, belly: 0x4c3628, points: 0x161113, mane: 0x121010, maneTip: 0x2e2422, muzzle: 0x201918, hoof: 0x2c2826, eye: 0x2a1408, sock: 0xeee8de,
    star: 0, blaze: 0, socks: [0, 0, 0, 0], armour: true,
    t: { leather: 0x3a2014, seat: 0x4c2c1a, stitch: 0xd8a848, pad: 0x9a1a20, trim: 0xe8b840, trim2: 0x6a0e14, strap: 0x2a1810, metal: 0xc8ced6, steel: 0xaab4be, steelDark: 0x5e6670, gold: 0xe6b442, cloth: 0xa01c24, cloth2: 0xf2e8d2, plume: 0xc81e28 } },
};

// head frame: poll pivot, axis D (poll → muzzle), N = forehead normal, X lateral
const HP = [0, 2.0, -1.1], D = [0, -0.8, -0.6], NN = [0, 0.6, -0.8];
const H = (u, v, x = 0) => [HP[0] + x, HP[1] + u * D[1] + v * NN[1], HP[2] + u * D[2] + v * NN[2]];
const hsh = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export const horse = {
  name: 'Horse',
  variants: ['brown', 'white', 'black', 'armoured'],
  mount: true,
  config(variant) {
    const v = PAL[variant] ? variant : 'brown';
    return { variant: v, pal: PAL[v], shapeKey: 'base', scale: 1, h: 0.056, hg: { 1: 0.032, 2: 0.03, 3: 0.03 }, aoScale: 1.3,
      grad: { top: 0.14, bottom: 0.3, y0: 0.1, y1: 1.0, low: 0.18 }, mat: { dfreq: 2.2, rim: 0.3, rimColor: 0xfff0dc, spec: v === 'black' ? 0.18 : 0.08, shine: 18 } };
  },
  rig(R) {
    R.add('body', null, [0, 1.16, 0.0]);
    R.add('chest', 'body', [0, 1.18, -0.42]);
    R.add('hips', 'body', [0, 1.22, 0.48]);
    R.add('seat', 'body', [0, 1.58, -0.16]);
    R.add('neck1', 'chest', [0, 1.4, -0.7]);
    R.add('neck2', 'neck1', [0, 1.7, -0.93]);
    R.add('head', 'neck2', HP);
    R.add('jaw', 'head', H(0.24, -0.1));
    R.add('earL', 'head', H(-0.02, 0.035, -0.055)); R.add('earR', 'head', H(-0.02, 0.035, 0.055));
    R.add('maneAL', 'neck1', [-0.02, 1.64, -0.64]); R.add('maneAR', 'neck1', [0.02, 1.64, -0.64]);
    R.add('maneBL', 'neck2', [-0.02, 1.88, -0.88]); R.add('maneBR', 'neck2', [0.02, 1.88, -0.88]);
    R.add('maneC', 'head', H(0.0, 0.08));
    R.add('tail1', 'hips', [0, 1.45, 0.8]); R.add('tail2', 'tail1', [0, 1.36, 0.95]); R.add('tail3', 'tail2', [0, 1.13, 1.05]); R.add('tail4', 'tail3', [0, 0.86, 1.09]);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('fU' + n, 'chest', [0.16 * s, 1.16, -0.7]); R.add('fL' + n, 'fU' + n, [0.19 * s, 0.95, -0.5]); R.add('fM' + n, 'fL' + n, [0.18 * s, 0.5, -0.5]); R.add('fP' + n, 'fM' + n, [0.18 * s, 0.19, -0.52]);
      R.add('rT' + n, 'hips', [0.2 * s, 1.24, 0.54]); R.add('rS' + n, 'rT' + n, [0.22 * s, 0.93, 0.36]); R.add('rM' + n, 'rS' + n, [0.2 * s, 0.56, 0.72]); R.add('rP' + n, 'rM' + n, [0.19 * s, 0.19, 0.66]);
    }
  },
  sculpt(S, cfg) {
    const c = cfg.pal;
    const coat = [0.16, 0, 0.12, 0], coatS = [0.1, 0, 0.1, 0], hoof = [0, 0, 0.12, 0.3];
    // ---- torso: deep ribcage, sloped shoulders, withers, short back, round croup & hindquarters
    S.ell('body', [0, 1.15, 0.02], [0.27, 0.3, 0.6], { k: 0.1, col: c.coat, tag: 'barrel', dtl: coat });
    S.ell('chest', [0, 1.17, -0.38], [0.28, 0.34, 0.32], { k: 0.1, col: c.coat, tag: 'barrel', dtl: coat });
    S.ell('chest', [0, 1.1, -0.64], [0.22, 0.25, 0.16], { k: 0.08, col: c.coat, tag: 'breast', dtl: coat });
    for (const s of [-1, 1]) {
      S.ell('chest', [s * 0.12, 1.07, -0.72], [0.11, 0.16, 0.1], { k: 0.06, col: c.coat, tag: 'breast', dtl: coat });
      S.ell('chest', [s * 0.19, 1.27, -0.52], [0.075, 0.26, 0.15], { k: 0.08, col: c.coat, tag: 'shoulder', rot: [0.55, 0, 0], dtl: coat });
    }
    S.ell('chest', [0, 1.43, -0.4], [0.11, 0.1, 0.24], { k: 0.08, col: c.coat, tag: 'withers', dtl: coat });
    S.ell('body', [0, 1.36, 0.02], [0.2, 0.1, 0.42], { k: 0.1, col: c.coat, tag: 'back', dtl: coat });
    S.ell('hips', [0, 1.33, 0.46], [0.25, 0.18, 0.3], { k: 0.1, col: c.coat, tag: 'croup', dtl: coat });
    for (const s of [-1, 1]) S.ell('hips', [s * 0.15, 1.19, 0.56], [0.14, 0.27, 0.25], { k: 0.08, col: c.coat, tag: 'haunch', rot: [0.25, 0, 0], dtl: coat });
    S.ell('hips', [0, 1.2, 0.72], [0.21, 0.22, 0.13], { k: 0.08, col: c.coat, tag: 'buttock', dtl: coat });
    S.cone('tail1', [0, 1.46, 0.76], [0, 1.35, 0.95], 0.07, 0.048, { k: 0.05, col: c.mane, tag: 'dock', b2: 'tail2', t0: 0.3, t1: 1, dtl: coat });
    // ---- neck: deep base, arched crest, clean throat
    S.ell('neck1', [0, 1.36, -0.7], [0.18, 0.27, 0.21], { k: 0.1, col: c.coat, tag: 'neck', rot: [-0.75, 0, 0], dtl: coat });
    S.ell('neck2', [0, 1.7, -0.93], [0.125, 0.22, 0.14], { k: 0.08, col: c.coat, tag: 'neck', rot: [-0.55, 0, 0], dtl: coat });
    S.ell('neck2', [0, 1.92, -1.04], [0.092, 0.12, 0.1], { k: 0.06, col: c.coat, tag: 'neck', rot: [-0.3, 0, 0], dtl: coat });
    S.ell('neck2', [0, 1.8, -0.86], [0.07, 0.2, 0.09], { k: 0.06, col: c.coat, tag: 'crest', rot: [-0.65, 0, 0], dtl: coat });
    S.cone('neck1', [0, 1.22, -0.8], [0, 1.72, -1.1], 0.1, 0.075, { k: 0.08, col: c.coat, tag: 'throat', b2: 'neck2', t0: 0.4, t1: 0.9, dtl: coat });
    S.cone('neck2', [0, 1.97, -1.05], [0, 1.55, -0.47], 0.03, 0.03, { k: 0.05, col: c.mane, tag: 'maneBase', cw: 1.5, b2: 'neck1', t0: 0.4, t1: 0.8, dtl: coat });
    // ---- upper legs (group 0, blend into the body)
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      S.ell('fU' + n, [s * 0.17, 1.06, -0.6], [0.09, 0.14, 0.11], { k: 0.07, col: c.coat, tag: 'arm', rot: [-0.7, 0, 0], dtl: coat });
      S.cone('fL' + n, [s * 0.185, 0.96, -0.52], [s * 0.18, 0.56, -0.5], 0.09, 0.055, { k: 0.05, col: c.coat, tag: 'forearm', b2: 'fM' + n, t0: 0.82, t1: 1, dtl: coat });
      S.ell('fL' + n, [s * 0.19, 0.95, -0.46], [0.065, 0.07, 0.07], { k: 0.04, col: c.coat, tag: 'elbow', dtl: coat });
      S.ell('rT' + n, [s * 0.19, 1.08, 0.48], [0.12, 0.2, 0.16], { k: 0.08, col: c.coat, tag: 'thigh', rot: [-0.4, 0, 0], dtl: coat });
      S.ell('rS' + n, [s * 0.215, 0.93, 0.38], [0.08, 0.09, 0.09], { k: 0.05, col: c.coat, tag: 'stifle', dtl: coat });
      S.cone('rS' + n, [s * 0.21, 0.9, 0.42], [s * 0.2, 0.6, 0.69], 0.105, 0.058, { k: 0.06, col: c.coat, tag: 'gaskin', b2: 'rM' + n, t0: 0.82, t1: 1, dtl: coat });
    }
    // ---- lower legs (group 1, finer voxels): knees, cannons with tendons, fetlocks, pasterns, hooves
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R', g1 = { group: 1 };
      S.ell('fM' + n, [s * 0.18, 0.51, -0.5], [0.056, 0.075, 0.058], { ...g1, k: 0.03, col: c.coat, tag: 'knee', dtl: coatS });
      S.cone('fM' + n, [s * 0.18, 0.5, -0.5], [s * 0.18, 0.21, -0.515], 0.042, 0.037, { ...g1, k: 0.03, col: c.coat, tag: 'cannon', b2: 'fP' + n, t0: 0.85, t1: 1, dtl: coatS });
      S.ell('fM' + n, [s * 0.18, 0.35, -0.475], [0.028, 0.13, 0.03], { ...g1, k: 0.03, col: c.coat, tag: 'cannon', dtl: coatS });
      S.ell('fP' + n, [s * 0.18, 0.18, -0.51], [0.05, 0.055, 0.058], { ...g1, k: 0.03, col: c.coat, tag: 'fetlock', dtl: coatS });
      S.cone('fP' + n, [s * 0.18, 0.17, -0.525], [s * 0.18, 0.085, -0.57], 0.036, 0.042, { ...g1, k: 0.025, col: c.coat, tag: 'pastern', dtl: coatS });
      S.cone('fP' + n, [s * 0.18, 0.08, -0.575], [s * 0.18, 0.0, -0.6], 0.046, 0.062, { ...g1, k: 0.012, col: c.hoof, tag: 'hoof', dtl: hoof });
      S.ell('rM' + n, [s * 0.2, 0.575, 0.715], [0.05, 0.075, 0.07], { ...g1, k: 0.03, col: c.coat, tag: 'hock', dtl: coatS });
      S.ell('rM' + n, [s * 0.2, 0.61, 0.775], [0.032, 0.05, 0.04], { ...g1, k: 0.025, col: c.coat, tag: 'hock', dtl: coatS });
      S.cone('rM' + n, [s * 0.2, 0.57, 0.71], [s * 0.19, 0.21, 0.66], 0.044, 0.038, { ...g1, k: 0.03, col: c.coat, tag: 'cannon', b2: 'rP' + n, t0: 0.85, t1: 1, dtl: coatS });
      S.ell('rM' + n, [s * 0.195, 0.38, 0.71], [0.028, 0.14, 0.03], { ...g1, k: 0.03, col: c.coat, tag: 'cannon', dtl: coatS });
      S.ell('rP' + n, [s * 0.19, 0.18, 0.66], [0.05, 0.055, 0.058], { ...g1, k: 0.03, col: c.coat, tag: 'fetlock', dtl: coatS });
      S.cone('rP' + n, [s * 0.19, 0.17, 0.645], [s * 0.19, 0.085, 0.6], 0.036, 0.042, { ...g1, k: 0.025, col: c.coat, tag: 'pastern', dtl: coatS });
      S.cone('rP' + n, [s * 0.19, 0.08, 0.595], [s * 0.19, 0.0, 0.575], 0.046, 0.06, { ...g1, k: 0.012, col: c.hoof, tag: 'hoof', dtl: hoof });
    }
    S.box('fPL', [0, -0.06, 0], [0.6, 0.057, 1.2], 0, { group: 1, sub: true, k: 0.004, wmul: 0, col: c.hoof, tag: 'sole', cw: 0.2 });
    // ---- head (group 2): cranium, flat forehead, big jowls, straight face, soft muzzle, flared nostrils
    const g2 = { group: 2 };
    const e = (u, v, x, r, o2) => S.ell('head', H(u, v, x), r, { ...g2, dir: D, ...o2 });
    e(0.1, 0, 0, [0.095, 0.1, 0.13], { k: 0.05, col: c.coat, tag: 'skull', dtl: coatS });
    e(0.14, 0.035, 0, [0.088, 0.05, 0.12], { k: 0.04, col: c.coat, tag: 'forehead', dtl: coatS });
    for (const s of [-1, 1]) {
      e(0.2, -0.07, s * 0.055, [0.05, 0.09, 0.1], { k: 0.04, col: c.coat, tag: 'jowl', dtl: coatS });
      e(0.15, 0.04, s * 0.07, [0.03, 0.028, 0.045], { k: 0.025, col: c.coat, tag: 'brow', dtl: coatS });
      S.cone('head', H(0.2, 0.0, s * 0.075), H(0.36, 0.01, s * 0.058), 0.03, 0.02, { ...g2, k: 0.03, col: c.coat, tag: 'cheekbone', dtl: coatS });
    }
    S.cone('head', H(0.12, 0.03, 0), H(0.47, 0.015, 0), 0.08, 0.066, { ...g2, k: 0.05, col: c.coat, tag: 'face', dtl: coatS });
    e(0.52, -0.015, 0, [0.078, 0.08, 0.095], { k: 0.04, col: c.muzzle, tag: 'muzzle', dtl: coatS });
    e(0.585, -0.035, 0, [0.066, 0.05, 0.05], { k: 0.03, col: c.muzzle, tag: 'lip', dtl: coatS });
    for (const s of [-1, 1]) e(0.555, 0.035, s * 0.043, [0.017, 0.012, 0.03], { k: 0.012, sub: true, col: 0x0c0707, tag: 'nostril' });
    // ---- lower jaw (group 3): chin & lower lip (opens for a whinny)
    const g3 = { group: 3 };
    S.ell('jaw', H(0.47, -0.095, 0), [0.05, 0.04, 0.07], { ...g3, dir: D, k: 0.03, col: c.muzzle, tag: 'chin', dtl: coatS });
    S.ell('jaw', H(0.56, -0.085, 0), [0.055, 0.034, 0.05], { ...g3, dir: D, k: 0.025, col: c.muzzle, tag: 'lowlip', dtl: coatS });
    S.cone('jaw', H(0.3, -0.1, 0), H(0.46, -0.1, 0), 0.04, 0.045, { ...g3, k: 0.03, col: c.coat, tag: 'jawline', dtl: coatS });
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, y, z] = v.p, [nx, ny, nz] = v.n, g = v.group;
    if (g === 0) {
      const mb = v.t('maneBase') + v.t('dock');
      v.mix(c.coat2, sstep(0.5, 0.95, ny) * 0.3 * (1 - mb));
      v.mix(c.belly, sstep(-0.35, -0.85, ny) * 0.5 * sstep(1.25, 1.0, y) * (1 - mb));
      if (c.points) v.mix(c.points, sstep(0.8, 0.6, y) * Math.min(1, v.t('forearm') + v.t('gaskin') + v.t('elbow') + v.t('stifle') * 0.5) * 0.9);
      if (c.dapple) {
        const dp = Math.sin(x * 23 + Math.sin(z * 11) * 2) * Math.sin(z * 21 + Math.sin(y * 13) * 2) * Math.sin(y * 19 + x * 7);
        v.mix(c.dapple, sstep(0.18, 0.42, dp) * 0.5 * sstep(0.9, 1.2, y) * (1 - v.t('neck') * 0.5) * (1 - mb));
        v.mix(c.points, sstep(0.9, 0.7, y) * Math.min(1, v.t('forearm') + v.t('gaskin')) * 0.35);
      }
      if (c.sheen) v.mix(c.sheen, sstep(0.6, 0.98, ny) * 0.4 * (1 - mb) + Math.pow(Math.max(0, nx * 0.5 + ny * 0.7 - nz * 0.3), 6) * 0.35);
      // muscle definition: soft light on the bulges, shade in the creases (baked, helps the silhouette read)
      v.mul(1 + 0.06 * Math.max(v.t('shoulder'), v.t('haunch')) - 0.05 * v.t('elbow'));
      v.mix(c.mane, v.t('maneBase') * 0.9 + v.t('dock') * 0.9);
    } else if (g === 1) {
      const leg = (z < 0 ? 0 : 2) + (x < 0 ? 0 : 1);
      const hoofT = v.t('hoof') + v.t('sole');
      if (c.points) v.mix(c.points, 0.9 * (1 - hoofT));
      const sk = c.socks[leg];
      if (sk > 0) v.mix(c.sock, sstep(sk + 0.02, sk - 0.03, y) * (1 - hoofT) * sstep(0.06, 0.1, y));
      if (hoofT > 0.4) { v.mul(0.85 + 0.12 * Math.sin(y * 260 + x * 40)); if (sk > 0) v.mix(0x8a7e6c, 0.5); }
      v.mix(c.points ? 0x0c0a0a : c.coat2, sstep(0.1, 0.075, y) * (1 - hoofT) * 0.5); // coronet
    } else {
      // head frame coords
      const rx = x - HP[0], ry = y - HP[1], rz = z - HP[2];
      const hu = ry * D[1] + rz * D[2], hv = ry * NN[1] + rz * NN[2];
      const front = nx * 0 + ny * NN[1] + nz * NN[2];
      v.mix(c.coat2, sstep(0.3, 0.9, front) * 0.15);
      v.mix(c.muzzle, sstep(0.36, 0.5, hu) * 0.85);
      if (g === 2) { // dark soft eye patch & mouth interior
        for (const s of [-1, 1]) { const e = H(0.17, 0.02, s * 0.085); const d = Math.hypot(x - e[0], y - e[1], z - e[2]); v.mix(c.coat2, (1 - sstep(0.03, 0.06, d)) * 0.5); }
        if (hu > 0.4 && hv < -0.05 && front < -0.3) v.mix(0x4a2226, 0.85);
      } else if (hu > 0.42 && hv > -0.075 && front > 0.2) v.mix(0x4a2226, 0.8);
      if (c.star) v.mix(c.sock, (1 - sstep(0.022, 0.034, Math.abs(rx) * 1.2 + Math.abs(hu - 0.12) * 0.55)) * sstep(0.4, 0.7, front));
      if (c.blaze) v.mix(c.sock, (1 - sstep(0.015, 0.024, Math.abs(rx) - hu * 0.02)) * sstep(0.14, 0.2, hu) * (1 - sstep(0.5, 0.56, hu)) * sstep(0.45, 0.7, front));
      if (c.dapple) v.mix(c.coat2, sstep(0.2, 0.4, hu) * 0.25);
      v.mix(0x080505, v.t('nostril') * 0.9);
    }
    v.mul(1 + Math.sin(x * 9 + z * 5) * Math.sin(y * 7) * 0.035);
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, T = c.t, b = (n) => R.index(n);
    // ---- eyes: large, dark, soft lashes line
    for (const s of [-1, 1]) addEye(acc, S, b('head'), H(0.17, 0.02, s * 0.086), [s * 1, -0.05, -0.32], 0.03, { iris: c.eye, pupil: 0x080404, rim: 0x120c0a, pupilA: 0.5, irisA: 0.95, sink: 0.42, group: 2, seg: 10 });
    // ---- ears: pricked, concave, dark tips
    for (const s of [-1, 1]) {
      const g = leafGeo(0.042, 0.15, 0.03, 0.7, -0.04, { nu: 5, nv: 5, pw: 0.9, tipW: 0.004 });
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.2, -s * 0.45, -s * 0.12, 'YXZ')); m.setPosition(...H(-0.02, 0.035, s * 0.055));
      const co = col(c.coat), ci = col(c.coat2), ct = col(c.points || c.coat2);
      addG(acc, g, { matrix: m, skin: rigidSkin(b(s < 0 ? 'earL' : 'earR')), dtl: [0.25, 0, 0.1, 0], color: (p, n, uv) => uv[0] >= 1 ? lerp3(co, ct, sstep(0.65, 0.95, uv[1])) : lerp3(lerp3(ci, [0.02, 0.015, 0.012], 0.4), co, sstep(0.55, 0.9, (uv[0] % 1) * 2)) });
    }
    // ---- mane: locks from the crest falling mostly to the right side, forelock over the brow
    const A0 = new V3(0, 1.84, -1.0), A1 = new V3(0, 1.38, -0.58), ax = A1.clone().sub(A0).normalize();
    const U = new V3().crossVectors(new V3(1, 0, 0), ax).negate().normalize();
    const nL = 13, mt = cfg.armour ? 0.55 : 1;
    for (let i = 0; i < nL; i++) {
      const t = (i + 0.5) / nL, s = (i % 3 === 1) ? -1 : 1;
      const phMax = (0.65 + 0.6 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.7)) * mt, K = 6;
      const pts = [];
      for (let k = 0; k < K; k++) {
        const f = k / (K - 1), ph = mix(-0.25 * s, s * phMax, f);
        const base = A0.clone().lerp(A1, Math.min(1, t + 0.07 * f));
        const d = U.clone().multiplyScalar(Math.cos(ph)).add(new V3(Math.sin(ph), 0, 0));
        const p = marchOut(S, base.toArray(), d.toArray(), 0, 1);
        if (!p) continue;
        const n = sdfNormal(S, p, 0), off = 0.018 + 0.03 * Math.sin(Math.PI * Math.min(1, f * 1.3)) + (k === 0 ? 0.02 : 0);
        pts.push(new V3(p[0] + n[0] * off, p[1] + n[1] * off - 0.02 * f, p[2] + n[2] * off + 0.03 * f));
      }
      if (pts.length < 3) continue;
      const root = marchOut(S, A0.clone().lerp(A1, t).toArray(), U.toArray(), 0, 1) || pts[0].toArray();
      const rs = skinAt(S, root), mb = rigidSkin(b((t < 0.45 ? 'maneB' : 'maneA') + (s < 0 ? 'L' : 'R')));
      const sm = smoothPath(pts, 6);
      lock(acc, sm, { r0: 0.036, r1: 0.007, bulge: 0.35, flat: 0.4, radial: 4, up: U.toArray(), c0: c.mane, c1: c.maneTip, from: 0.4, skin: (tt) => mixSkin(rs, mb, sstep(0.0, 0.75, tt) * 0.9), dtl: [0.55, 0, 0.1, 0] });
    }
    // forelock: three locks from between the ears down over the brow
    const fo = H(0.14, -0.03, 0);
    for (let i = -1; i <= 1; i++) {
      const ctrl = [H(-0.035, 0.07, i * 0.02), H(0.03, 0.1, i * 0.03), H(0.1, 0.1, i * 0.04), H(0.17, 0.09, i * 0.045)];
      const pts = surfPath(S, 2, fo, ctrl.map(q => [q[0] - fo[0], q[1] - fo[1], q[2] - fo[2]]), 0.02);
      if (pts.length < 3) continue;
      const hs0 = rigidSkin(b('head')), ms = rigidSkin(b('maneC'));
      lock(acc, smoothPath(pts, 5), { r0: 0.03, r1: 0.006, bulge: 0.3, flat: 0.4, radial: 4, up: NN, c0: c.mane, c1: c.maneTip, from: 0.4, skin: (tt) => mixSkin(hs0, ms, sstep(0.1, 0.8, tt) * 0.9) });
    }
    // ---- tail: long hair from the dock, fanning slightly toward the hocks
    const tb = ['tail1', 'tail2', 'tail3', 'tail4'].map(b);
    const tskin = pathSkin([[0, rigidSkin(tb[0])], [0.18, rigidSkin(tb[1])], [0.45, rigidSkin(tb[2])], [0.72, rigidSkin(tb[3])], [1, rigidSkin(tb[3])]]);
    const tc = smoothPath([[0, 1.47, 0.8], [0, 1.39, 0.95], [0, 1.15, 1.06], [0, 0.87, 1.1], [0, 0.6, 1.08]], 17);
    const along = (tt) => { const f = clamp01(tt) * 16, k = Math.min(15, Math.floor(f)); return tc[k].clone().lerp(tc[k + 1], f - k); };
    const nT = 9;
    for (let i = 0; i < nT; i++) {
      const a = (i / (nT - 1) - 0.5) * 2, t0 = 0.05 + 0.12 * hsh(i + 7), t1 = 1 - 0.06 * hsh(i + 3);
      const pts = [];
      for (let k = 0; k < 8; k++) {
        const tt = mix(t0, t1, k / 7), q = along(tt);
        q.x += a * (0.03 + 0.09 * Math.pow(tt, 1.4)); q.z += (0.025 * Math.cos(a * 2) - 0.01) * (0.4 + tt) + 0.012 * Math.sin(tt * 7 + i);
        q.y += 0.02 * (1 - tt);
        pts.push(q);
      }
      lock(acc, pts, { r0: 0.042, r1: 0.012, bulge: 0.2, flat: 0.45, radial: 4, up: [0, 0, 1], c0: c.mane, c1: c.maneTip, from: 0.45, skin: (tt) => tskin(mix(t0, t1, tt)), dtl: [0.55, 0, 0.1, 0] });
    }
    // ---- tack
    const barrel = (z) => [0, z < -0.2 ? 1.2 : 1.15];
    const armour = !!c.armour;
    const ss = saddleSet(acc, S, {
      group: 0, axis: barrel,
      pad: armour ? null : { z0: -0.52, z1: 0.16, th: (v) => 1.22 - 0.3 * Math.pow(Math.abs(v * 2 - 1), 3), nu: 11, nv: 7, main: T.pad, trim: T.trim, trim2: T.trim2 },
      seat: { z0: -0.44, z1: 0.08, th: (v) => 0.95 - 0.35 * Math.pow(Math.abs(v * 2 - 1), 2.2), nu: 9, nv: 9, off: armour ? 0.022 : 0.03, pommel: 0.1, cantle: armour ? 0.13 : 0.09, leather: T.leather, seatCol: T.seat, stitch: T.stitch, trimMetal: armour ? T.gold : null, horn: true, hornTip: T.metal },
      girth: { z: -0.3, w: 0.07, color: T.strap },
      stirrup: { x: 0.33, y: 0.86, z: -0.2, r: 0.05, top: [0.27, 1.42, -0.2], metal: T.metal, leather: T.strap, skin: rigidSkin(b('body')) },
    });
    cfg.seat = ss.seat || [0, 1.58, -0.16];
    // ---- bridle: headstall (crown, cheeks), browband, noseband, bit rings; reins to the pommel
    const hs = rigidSkin(b('head')), org = H(0.2, -0.02, 0);
    const toDirs = (pts, o) => pts.map(p => [p[0] - o[0], p[1] - o[1], p[2] - o[2]]);
    const brid = (pts, w = 0.024) => { const sp = surfPath(S, 2, org, toDirs(pts, org), 0.007); if (sp.length > 1) strap(acc, smoothPath(sp, Math.max(4, sp.length * 2)), w, 0.007, { up: [0, 1, 0], skin: hs, color: T.strap }); };
    for (const s of [-1, 1]) brid([H(-0.02, 0.0, s * 0.11), H(0.12, -0.03, s * 0.11), H(0.3, -0.03, s * 0.11), H(0.45, -0.05, s * 0.1), H(0.5, -0.06, s * 0.09)]);
    brid([H(0.0, -0.02, -0.12), H(-0.03, 0.05, -0.06), H(-0.04, 0.07, 0), H(-0.03, 0.05, 0.06), H(0.0, -0.02, 0.12)]);
    brid([H(0.04, 0.0, -0.11), H(0.06, 0.07, -0.06), H(0.065, 0.1, 0), H(0.06, 0.07, 0.06), H(0.04, 0.0, 0.11)], 0.02);
    { const ring0 = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * TAU; ring0.push(H(0.38, 0.0 + Math.cos(a) * 0.15, Math.sin(a) * 0.15)); }
      const sp = surfPath(S, 2, H(0.38, -0.02, 0), toDirs(ring0, H(0.38, -0.02, 0)), 0.007); if (sp.length > 4) strap(acc, sp, 0.026, 0.007, { up: D, skin: hs, color: T.strap }); }
    for (const s of [-1, 1]) ring(acc, H(0.5, -0.065, s * 0.078), [1, 0, 0], 0.022, 0.0045, hs, T.metal, { rs: 4, ts: 10 });
    // reins: bit → loop under the jowl → neck sides → pommel horn
    const horn = ss.horn || [0, 1.66, -0.44];
    const rstops = pathSkin([[0, hs], [0.16, hs], [0.36, rigidSkin(b('neck2'))], [0.66, rigidSkin(b('neck1'))], [0.88, rigidSkin(b('chest'))], [1, rigidSkin(b('body'))]]);
    for (const s of [-1, 1]) {
      const pts = smoothPath([H(0.5, -0.065, s * 0.08), H(0.4, -0.16, s * 0.1), [s * 0.13, 1.6, -1.02], [s * 0.19, 1.52, -0.8], [s * 0.17, 1.56, -0.58], [s * 0.07, horn[1] - 0.01, horn[2] - 0.01]], 12);
      strap(acc, pts, 0.02, 0.006, { up: [s, 0, 0], skin: (p, uv) => rstops(uv[1]), color: T.strap });
    }
    if (armour) armourParts(acc, S, R, cfg);
  },
  sockets(cfg) {
    return {
      head: ['head', H(0.02, 0.14)], mouth: ['jaw', H(0.6, -0.07)], center: ['body', [0, 1.15, 0]], chest: ['chest', [0, 1.1, -0.76]],
      back: ['body', [0, 1.52, 0.12]], rider: ['seat', cfg.seat || [0, 1.58, -0.16]], tail: ['tail4', [0, 0.62, 1.08]],
    };
  },
  height: 2.1, radius: 0.6,
  controller(inst) {
    const c = new QuadCtl(inst, SPEC);
    c.jig = new Jiggle(c, JIG);
    counterScaleRider(inst);
    return c;
  },
  get actionList() { return ACTIONS; },
};

/** the rider socket keeps world scale 1 on any mount scale / seed (the hero stays 1.85 m) */
export function counterScaleRider(inst) { const r = inst.sockets.rider; if (r && inst.scale) r.scale.setScalar(1 / inst.scale); }

// ------------------------------------------------------------------------------------------------ armoured barding
function armourParts(acc, S, R, cfg) {
  const T = cfg.pal.t, b = (n) => R.index(n), hs = rigidSkin(b('head'));
  const steel = col(T.steel), dark = col(T.steelDark), gold = col(T.gold);
  const plateCol = (u, v, edge) => (edge < 0.06 ? gold : lerp3(steel, dark, 0.15 + 0.25 * Math.pow(Math.abs(u - 0.5) * 2, 2)));
  // chanfron: face plate from the brow to above the nostrils, with a gold ridge and a small horn spike
  {
    const nu = 7, nv = 8, P = [], N = [], SK = [];
    for (let j = 0; j < nv; j++) {
      const u = mix(-0.02, 0.44, j / (nv - 1)), half = mix(1.15, 0.85, j / (nv - 1));
      const row = [], nrow = [], srow = [];
      for (let i = 0; i < nu; i++) {
        const a = mix(-half, half, i / (nu - 1)), o = H(u, -0.03, 0);
        const d = [Math.sin(a), Math.cos(a) * NN[1], Math.cos(a) * NN[2]];
        const p = marchOut(S, o, d, 2, 1) || o;
        row.push(p); nrow.push(sdfNormal(S, p, 2)); srow.push(p);
      }
      P.push(row); N.push(nrow); SK.push(srow);
    }
    shell(acc, S, { P, N, SK }, { off: (u, v) => 0.014 + 0.012 * Math.exp(-(((u - 0.5) / 0.12) ** 2)), thick: 0.012, recalcN: true, skin: () => hs,
      color: (u, v) => plateCol(u, v, Math.min(u, 1 - u, v * 1.5, 1 - v)), dtl: [0, 0, 0.1, 0] });
    addHorn(acc, b('head'), H(0.1, 0.1, 0), H(0.05, 0.2, 0), H(-0.04, 0.26, 0), 0.02, 0.003, { base: T.steel, tip: T.gold, radial: 5, n: 5 });
    // plume between the ears
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.22;
      lock(acc, smoothPath([H(-0.05, 0.08, 0), H(-0.12, 0.2, Math.sin(a) * 0.05), H(-0.12, 0.34, Math.sin(a) * 0.12), [Math.sin(a) * 0.14, 2.38, -0.92]], 6), { r0: 0.025, r1: 0.006, bulge: 0.8, flat: 0.5, radial: 4, up: [0, 0, 1], c0: T.plume, c1: 0xffe0d0, from: 0.6, skin: (tt) => mixSkin(hs, rigidSkin(b('maneC')), sstep(0.2, 1, tt) * 0.7) });
    }
  }
  // crinet: overlapping lames along the crest (neck1 / neck2)
  const A0 = new V3(0, 1.84, -1.0), A1 = new V3(0, 1.38, -0.58), ax = A1.clone().sub(A0).normalize(), U = new V3().crossVectors(new V3(1, 0, 0), ax).negate().normalize();
  const lames = 5;
  for (let l = 0; l < lames; l++) {
    const t0 = 0.08 + l * 0.18, t1 = t0 + 0.22, nu = 7, nv = 3, P = [], N = [], SK = [];
    for (let j = 0; j < nv; j++) {
      const t = mix(t0, t1, j / (nv - 1)), base = A0.clone().lerp(A1, t).toArray(), row = [], nrow = [], srow = [];
      for (let i = 0; i < nu; i++) {
        const ph = mix(-1.1, 1.1, i / (nu - 1)), d = U.clone().multiplyScalar(Math.cos(ph)).add(new V3(Math.sin(ph), 0, 0)).toArray();
        const p = marchOut(S, base, d, 0, 1) || base; row.push(p); nrow.push(sdfNormal(S, p, 0)); srow.push(p);
      }
      P.push(row); N.push(nrow); SK.push(srow);
    }
    const bone = rigidSkin(b(l < 2 ? 'neck2' : 'neck1'));
    shell(acc, S, { P, N, SK }, { off: (u, v) => 0.05 + 0.015 * v + 0.01 * l * 0.2, thick: 0.012, recalcN: true, skin: () => bone, color: (u, v) => plateCol(u, v, Math.min(u, 1 - u, v * 3, (1 - v) * 3)), dtl: [0, 0, 0.1, 0] });
  }
  // peytral: chest plate with a boss
  {
    const nu = 9, nv = 5, P = [], N = [], SK = [];
    for (let j = 0; j < nv; j++) {
      const y = mix(1.3, 0.92, j / (nv - 1)), row = [], nrow = [], srow = [];
      for (let i = 0; i < nu; i++) {
        const a = mix(-1.0, 1.0, i / (nu - 1)), o = [0, y, -0.45], d = [Math.sin(a), 0, -Math.cos(a)];
        const p = marchOut(S, o, d, 0, 1) || o; row.push(p); nrow.push(sdfNormal(S, p, 0)); srow.push(p);
      }
      P.push(row); N.push(nrow); SK.push(srow);
    }
    shell(acc, S, { P, N, SK }, { off: 0.03, thick: 0.014, recalcN: true, color: (u, v) => plateCol(u, v, Math.min(u, 1 - u, v * 2, (1 - v) * 2)), dtl: [0, 0, 0.1, 0] });
    const fr = surfFrame(S, 0, [0, 1.12, -0.45], [0, 0, -1]);
    if (fr) sunEmblem(acc, { ...fr, p: fr.p.map((q, i) => q + fr.n[i] * 0.044) }, 0.085, skinAt(S, fr.p), T.gold, T.gold, { lift: 0 });
  }
  // caparison: heraldic cloth from the saddle to the croup, hanging down both flanks with a dagged hem
  {
    const zs = linspace(-0.46, 0.8, 12), nWrap = 11, nHang = 4, eqA = 1.45;
    const P = [], N = [], SK = [];
    for (let j = 0; j < zs.length; j++) {
      const z = zs[j], ax2 = [0, z < -0.2 ? 1.2 : z > 0.45 ? 1.24 : 1.15, z];
      const wrap = [];
      for (let i = 0; i < nWrap; i++) {
        const a = mix(-eqA, eqA, i / (nWrap - 1)), d = [Math.sin(a), Math.cos(a), 0];
        const p = marchOut(S, ax2, d, 0, 1) || ax2; wrap.push([p, sdfNormal(S, p, 0)]);
      }
      const row = [], nrow = [], srow = [];
      const hem = 0.78 + 0.1 * sstep(0.55, 1, j / (zs.length - 1));
      const hang = (side) => {
        const [pe, ne] = side < 0 ? wrap[0] : wrap[nWrap - 1];
        const out = [];
        for (let k = 1; k <= nHang; k++) {
          const f = k / nHang, y = mix(pe[1], hem, f), x = pe[0] + side * (0.03 + 0.045 * f);
          out.push([[x, y, pe[2] + 0.02 * f], [side, 0.05, 0.02 * (j / zs.length - 0.5)], pe]);
        }
        return out;
      };
      const L = hang(-1).reverse(), Rr = hang(1);
      for (const [p, n, sp] of L) { row.push(p); nrow.push(n); srow.push(sp); }
      for (const [p, n] of wrap) { row.push(p); nrow.push(n); srow.push(p); }
      for (const [p, n, sp] of Rr) { row.push(p); nrow.push(n); srow.push(sp); }
      P.push(row); N.push(nrow); SK.push(srow);
    }
    const nu = nWrap + nHang * 2;
    const cc = col(T.cloth), c2 = col(T.cloth2), cg = col(T.gold), cin = lerp3(col(T.cloth), [0, 0, 0], 0.55);
    shell(acc, S, { P, N, SK }, {
      off: (u, v) => 0.03, thick: 0.01, inner: true, innerGap: 0.008, recalcN: 0.7,
      innerMask: (u) => u < (nHang + 0.5) / (nu - 1) || u > 1 - (nHang + 0.5) / (nu - 1),
      color: (u, v, side) => {
        if (side < 0) return cin;
        const hang = Math.min(u, 1 - u) * (nu - 1);
        const hemEdge = hang < 0.6, top = Math.abs(u - 0.5) < 0.12;
        if (hemEdge || v < 0.04 || v > 0.96) return cg;
        const quarter = (v < 0.5) !== (u < 0.5);
        const stripe = Math.abs(u - 0.5) < 0.035;
        return stripe ? cg : top ? lerp3(cc, [0, 0, 0], 0.2) : quarter ? cc : c2;
      },
      dtl: [0, 0, 0.12, 0.55],
    });
    // sun emblems on both flanks
    for (const s of [-1, 1]) {
      const fr = surfFrame(S, 0, [0, 1.15, 0.2], [s, 0.05, 0]);
      if (fr) sunEmblem(acc, { ...fr, p: [fr.p[0] + s * 0.045, fr.p[1] - 0.08, fr.p[2]] }, 0.13, skinAt(S, fr.p), T.gold, T.gold, { lift: 0 });
    }
  }
}

// ------------------------------------------------------------------------------------------------ animation
const legs = [
  { id: 'FL', chain: ['fUL', 'fLL', 'fML', 'fPL'], toe: [-0.18, 0, -0.6], body: 'chest', scap: 0.3, lift: 0.17, flex: 1.7, out: 0.02, metaK: 0.95, heel: 0.55 },
  { id: 'FR', chain: ['fUR', 'fLR', 'fMR', 'fPR'], toe: [0.18, 0, -0.6], body: 'chest', scap: 0.3, lift: 0.17, flex: 1.7, out: 0.02, metaK: 0.95, heel: 0.55 },
  { id: 'RL', chain: ['rTL', 'rSL', 'rML', 'rPL'], toe: [-0.19, 0, 0.585], body: 'hips', scap: 0.14, lift: 0.15, flex: 1.2, out: 0.06, metaK: 0.8, heel: 0.45 },
  { id: 'RR', chain: ['rTR', 'rSR', 'rMR', 'rPR'], toe: [0.19, 0, 0.585], body: 'hips', scap: 0.14, lift: 0.15, flex: 1.2, out: 0.06, metaK: 0.8, heel: 0.45 },
];
// idle_alt: one of several fidgets, picked when played
function pick(list, dur) {
  return { dur, a: 0.05, d: 0.92,
    start(ctl, a) { a.u.i = Math.floor(Math.random() * list.length); a.u.p = a.u.p || { k: 0, t: 0, seed: 0, u: {} }; },
    fn(ctl, a, w) { const d = list[a.u.i], p = a.u.p; p.t = a.t; p.k = Math.min(1, a.t / (d.dur ?? 1)); p.seed = a.seed; d.fn(ctl, p, w); } };
}
const GRAZE = mGraze({ dur: 5.2 }), SHAKE = mShake({ dur: 1.7 }), PAW = mPaw({ dur: 2.2, leg: 1 });
const ACTIONS = {
  rear: mRear({ dur: 2.4, ang: 0.95, sit: 0.3 }),
  whinny: mWhinny({ dur: 1.8 }),
  idle_alt: pick([mGraze({ dur: 3.4 }), SHAKE, PAW], 3.4),
  graze: GRAZE, shake: SHAKE, paw: PAW, swish: mSwish(),
  jump: mJump({ dur: 1.15, h: 0.6 }),
  hit: mHit(),
  death: mDeath({ dur: 2.3, lieY: 0.4 }),
  spawn: mSpawn({ dur: 1.6, h: 0.75 }),
};

const JIG = [
  { bones: ['tail1', 'tail2', 'tail3', 'tail4'], anchor: 'tail1', k: 50, c: 7, g: 0.011, gi: 0.35, wind: 0.02, idle: 0.02, idleF: 1.1, max: 0.8 },
  { bones: ['maneAR'], tipDir: [0.6, -0.78, 0.15], k: 75, c: 7, g: 0.014, wind: 0.018, idle: 0.015, max: 0.55 },
  { bones: ['maneAL'], tipDir: [-0.6, -0.78, 0.15], k: 75, c: 7, g: 0.014, wind: 0.018, idle: 0.015, max: 0.55, ph: 1.3 },
  { bones: ['maneBR'], tipDir: [0.6, -0.78, 0.15], k: 70, c: 7, g: 0.016, wind: 0.02, idle: 0.015, max: 0.6, ph: 2.1 },
  { bones: ['maneBL'], tipDir: [-0.6, -0.78, 0.15], k: 70, c: 7, g: 0.016, wind: 0.02, idle: 0.015, max: 0.6, ph: 0.4 },
  { bones: ['maneC'], tipDir: [0, -0.8, -0.6], k: 90, c: 8, g: 0.01, wind: 0.012, idle: 0.01, max: 0.5 },
];

const SPEC = {
  bones: { body: 'body', hips: 'hips', chest: 'chest', neck: 'neck1', neck2: 'neck2', head: 'head', jaw: 'jaw', seat: 'seat', tail: ['tail1', 'tail2', 'tail3', 'tail4'], ears: ['earL', 'earR'] },
  gait: {
    legs, maxStride: 1.5, actV: 0.3,
    gaits: [
      { v: 1.6, f: 0.95, duty: 0.64, lift: 0.75, off: { RL: 0, FL: 0.25, RR: 0.5, FR: 0.75 }, bob: 0.012, bobF: 2, bobPh: 0.1, roll: 0.016, rollF: 1, sway: 0.01, swayF: 1, nod: 0.03, nodF: 2, nodPh: 0.3, pitch: 0.006, pitchF: 2 },
      { v: 4.0, f: 1.45, duty: 0.42, lift: 1.0, off: { FL: 0, RR: 0, FR: 0.5, RL: 0.5 }, bob: 0.028, bobF: 2, bobPh: 0.3, roll: 0.01, rollF: 1, nod: 0.015, nodF: 2, pitch: 0.008, pitchF: 2 },
      { v: 6.5, f: 1.7, duty: 0.34, lift: 1.15, off: { RL: 0, RR: 0.3, FL: 0.32, FR: 0.58 }, bob: 0.05, bobF: 1, bobPh: 0.55, pitch: 0.07, pitchF: 1, pitchPh: 0.1, flex: 0.04, flexF: 1, nod: 0.04, nodF: 1, nodPh: 0.6, lean: 0.03 },
      { v: 9.5, f: 2.05, duty: 0.27, lift: 1.25, off: { RL: 0, RR: 0.1, FL: 0.46, FR: 0.56 }, bob: 0.06, bobF: 1, bobPh: 0.62, pitch: 0.06, pitchF: 1, pitchPh: 0.05, flex: 0.08, flexF: 1, flexPh: 0.2, nod: 0.05, nodF: 1, nodPh: 0.8, lean: 0.05 },
    ],
  },
  neck: { pitch: 0, run: -0.14, combat: 0, walk: -0.03, headCombat: 0, comp: 0.5, stab: 0.75 },
  tail: { wag: 0.03, wagF: 0.4, run: 0.25, combat: 0, base: 0 },
  combatCrouch: 0, combatPitch: 0, runDrop: 0.04, breathe: 0.01,
  fidgets: [{ name: 'graze', w: 3 }, { name: 'shake', w: 1.5 }, { name: 'paw', w: 1 }, { name: 'swish', w: 2.5 }],
  fidgetGap: 4.5,
  pose(ctl, dt) { mountPose(ctl, dt, POSE); },
  actions: ACTIONS,
};
const POSE = { nodWalk: 0.045, swing: 0.12, earBase: -0.25, seatK: 0.55, rollK: 0.5 };

/** shared mount pose: neck carriage by gait (walk nod, canter/gallop swing), look spread over neck2, ear play, seat
 *  stabiliser (rider soaks up part of the gait pitch/roll), jiggle springs. */
export function mountPose(ctl, dt, o) {
  const P = ctl.pose, b = ctl.b, G = ctl.gait, gw = G.gw, act = G.act * ctl.locoW;
  const ph = G.phase * TAU;
  const nod = ((gw[0] || 0) * o.nodWalk * Math.cos(2 * ph + 1.2) + (gw[1] || 0) * o.nodWalk * 0.3 * Math.cos(2 * ph + 0.5)) * act;
  const swing = ((gw[2] || 0) * o.swing + (gw[3] || 0) * o.swing * 1.1) * Math.cos(ph + 2.4) * act;
  P.rx(b.neck, nod * 0.6 + swing * 0.55);
  if (b.neck2 !== undefined) P.rot(b.neck2, nod * 0.4 + swing * 0.35, ctl.look.y * 0.25, 0);
  P.rx(b.head, -swing * 0.45 - nod * 0.25);
  const flick = Math.pow(Math.max(0, Math.sin(ctl.t * 0.9 + 1.3)), 24) + Math.pow(Math.max(0, Math.sin(ctl.t * 0.63 + 4)), 30);
  ctl.ear = (o.earBase ?? -0.25) + (o.earRun ?? 0.35) * ctl.run + 0.3 * flick + 0.6 * ctl.combat;
  if (b.seat !== undefined) P.rot(b.seat, -G.pitch * o.seatK, 0, -G.roll * o.rollK);
  ctl.jaw += (o.pant ?? 0.02) * ctl.run;
  if (ctl.jig) { ctl.jig.on = ctl.dead ? 0.4 : 1; ctl.jig.update(dt); }
}
