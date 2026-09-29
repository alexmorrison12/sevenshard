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
import { addG, lock, strap, ribbon, surfAim, ring, surfPath, smoothPath, pathSkin, mixSkin, rigidSkin, skinAt, marchOut, sdfNormal, wrapGrid, shell, linspace, edgespace, Jiggle, lerp3, sstep, clamp01, mix, TAU } from './common.js';
import { saddleSet, sunEmblem, surfFrame } from './tack.js';
import { mRear, mJump, mGraze, mShake, mPaw, mSwish, mWhinny, mHit, mDeath, mSpawn, mPick, mountPose, counterScaleRider } from './mountacts.js';

const V3 = THREE.Vector3;
const PAL = {
  brown: { coat: 0x7e4526, coat2: 0x5a2d16, belly: 0xa06a44, points: 0x1c1411, mane: 0x18110e, maneTip: 0x46301f, muzzle: 0x2e2320, hoof: 0x35302c, eye: 0x3a1c0a, sock: 0xeee8de,
    star: 1, blaze: 0, socks: [0, 0, 0.27, 0],
    t: { leather: 0x4a2612, seat: 0x5a2e16, stitch: 0xc89a5a, pad: 0x8e1d24, trim: 0xe0b048, trim2: 0x5a1218, strap: 0x3a2214, metal: 0xa8acb4 } },
  white: { coat: 0xe6e1d8, coat2: 0xcac2b6, belly: 0xf2eee8, points: 0xa89e94, mane: 0xf4f0e8, maneTip: 0xc9bfb2, muzzle: 0x5a4e4e, hoof: 0x8e857c, eye: 0x2a1a10, sock: 0xf4f0e8, dapple: 0xb4aca2,
    star: 0, blaze: 0, socks: [0, 0, 0, 0],
    t: { leather: 0x6a3e1e, seat: 0x7a4826, stitch: 0xe8d0a0, pad: 0x21428e, trim: 0xe8ecf4, trim2: 0x142a66, strap: 0x5a3a20, metal: 0xc4c8d0 } },
  black: { coat: 0x201e25, coat2: 0x131217, belly: 0x2c2a33, points: 0x131216, mane: 0x0e0d11, maneTip: 0x2e2a36, muzzle: 0x1a1719, hoof: 0x2a2622, eye: 0x1a0e08, sock: 0xece8e0, sheen: 0x565a70,
    star: 1, blaze: 1, socks: [0, 0, 0.3, 0.3],
    t: { leather: 0x1e1613, seat: 0x2c211b, stitch: 0xc8a048, pad: 0x4c1858, trim: 0xe4b444, trim2: 0x2a0c32, strap: 0x151113, metal: 0xe4b444 } },
  armoured: { coat: 0x3e2b22, coat2: 0x2a1c16, belly: 0x4c3628, points: 0x161113, mane: 0x121010, maneTip: 0x2e2422, muzzle: 0x201918, hoof: 0x2c2826, eye: 0x2a1408, sock: 0xeee8de,
    star: 0, blaze: 0, socks: [0, 0, 0, 0], armour: true,
    t: { leather: 0x3a2014, seat: 0x4c2c1a, stitch: 0xd8a848, pad: 0x9a1a20, trim: 0xe8b840, trim2: 0x6a0e14, strap: 0x2a1810, metal: 0xc8ced6, steel: 0x8c96a2, steelDark: 0x464e58, gold: 0xe6b442, cloth: 0xa01c24, cloth2: 0xf2e8d2, plume: 0xc81e28 } },
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
    return { variant: v, pal: PAL[v], shapeKey: 'base', scale: 1, h: 0.068, hg: { 1: 0.044, 2: 0.038, 3: 0.04 }, aoScale: 1.3,
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
    R.add('tail1', 'hips', [0, 1.45, 0.8]); R.add('tail2', 'tail1', [0, 1.41, 0.97]); R.add('tail3', 'tail2', [0, 1.2, 1.11]); R.add('tail4', 'tail3', [0, 0.92, 1.15]);
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
    S.ell('body', [0, 1.17, 0.02], [0.265, 0.27, 0.57], { k: 0.1, col: c.coat, tag: 'barrel', dtl: coat });
    S.ell('chest', [0, 1.0, -0.26], [0.23, 0.15, 0.27], { k: 0.1, col: c.coat, tag: 'girth', dtl: coat });
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
    S.cone('tail1', [0, 1.46, 0.76], [0, 1.4, 0.95], 0.07, 0.05, { k: 0.05, col: c.mane, tag: 'dock', b2: 'tail2', t0: 0.3, t1: 1, dtl: coat });
    // ---- neck: deep base, arched crest, clean throat
    S.ell('neck1', [0, 1.37, -0.69], [0.155, 0.26, 0.2], { k: 0.1, col: c.coat, tag: 'neck', rot: [-0.75, 0, 0], dtl: coat });
    S.ell('neck2', [0, 1.71, -0.92], [0.108, 0.22, 0.14], { k: 0.08, col: c.coat, tag: 'neck', rot: [-0.55, 0, 0], dtl: coat });
    S.ell('neck2', [0, 1.92, -1.04], [0.092, 0.12, 0.1], { k: 0.06, col: c.coat, tag: 'neck', rot: [-0.3, 0, 0], dtl: coat });
    S.ell('neck2', [0, 1.8, -0.86], [0.07, 0.2, 0.09], { k: 0.06, col: c.coat, tag: 'crest', rot: [-0.65, 0, 0], dtl: coat });
    S.cone('neck1', [0, 1.24, -0.8], [0, 1.72, -1.1], 0.085, 0.07, { k: 0.08, col: c.coat, tag: 'throat', b2: 'neck2', t0: 0.4, t1: 0.9, dtl: coat });
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
    for (const s of [-1, 1]) addEye(acc, S, b('head'), H(0.17, 0.02, s * 0.086), [s * 1, -0.05, -0.32], 0.03, { iris: c.eye, pupil: 0x080404, rim: 0x120c0a, pupilA: 0.5, irisA: 0.95, sink: 0.42, group: 2, seg: 8 });
    globalThis.__mark?.('eyes');
    // ---- ears: pricked, concave, dark tips
    for (const s of [-1, 1]) {
      const g = leafGeo(0.042, 0.15, 0.03, 0.7, -0.04, { nu: 4, nv: 5, pw: 0.9, tipW: 0.004 });
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.2, -s * 0.45, -s * 0.12, 'YXZ')); m.setPosition(...H(-0.02, 0.035, s * 0.055));
      const co = col(c.coat), ci = col(c.coat2), ct = col(c.points || c.coat2);
      addG(acc, g, { matrix: m, skin: rigidSkin(b(s < 0 ? 'earL' : 'earR')), dtl: [0.25, 0, 0.1, 0], color: (p, n, uv) => uv[0] >= 1 ? lerp3(co, ct, sstep(0.65, 0.95, uv[1])) : lerp3(lerp3(ci, [0.02, 0.015, 0.012], 0.4), co, sstep(0.55, 0.9, (uv[0] % 1) * 2)) });
    }
    globalThis.__mark?.('ears');
    // ---- mane: a hair sheet over each side of the crest (parted, falling mostly right) with a jagged jiggling hem,
    //      plus a few loose locks on top for texture
    const A0 = new V3(0, 1.84, -1.08), A1 = new V3(0, 1.34, -0.7), ax = A1.clone().sub(A0).normalize();
    const U = new V3().crossVectors(new V3(1, 0, 0), ax).negate().normalize();
    const cM = col(c.mane), cT = col(c.maneTip);
    for (const s of [1, -1]) {
      const long = (s > 0 ? 1 : 0.6) * (c.armour ? 0.55 : 1);
      const rows = 11, cols = 5, P = [], N = [], SK = [], UU = [], VV = [];
      for (let j = 0; j < rows; j++) {
        const t = j / (rows - 1), jag = j % 2 ? 0.55 : 1;
        const phEnd = (0.45 + 0.85 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.92)), 0.6) * jag) * long;
        const row = [], nrow = [], srow = [], urow = [];
        for (let i = 0; i < cols; i++) {
          const f = i / (cols - 1), ph = s * mix(-0.22, phEnd, f);
          const base = A0.clone().lerp(A1, Math.min(1, t * 0.98 + 0.01 + 0.06 * f * f));
          const d = U.clone().multiplyScalar(Math.cos(ph)).add(new V3(Math.sin(ph), 0, 0));
          const p = marchOut(S, base.toArray(), d.toArray(), 0, 1) || base.toArray();
          const n = sdfNormal(S, p, 0);
          row.push([p[0], p[1] - 0.02 * f * f, p[2] + 0.02 * f]); nrow.push(n); srow.push(p); urow.push(f);
        }
        P.push(row); N.push(nrow); SK.push(srow); UU.push(urow); VV.push(t);
      }
      const bA = rigidSkin(b('maneA' + (s < 0 ? 'L' : 'R'))), bB = rigidSkin(b('maneB' + (s < 0 ? 'L' : 'R')));
      shell(acc, S, { P, N, SK, U: UU, V: VV }, {
        off: (u) => 0.02 + 0.03 * Math.sin(Math.PI * Math.min(1, u * 1.2)), thick: 0.016, recalcN: 0.6,
        skin: (u, v, sp) => mixSkin(skinAt(S, sp), mixSkin(bB, bA, sstep(0.35, 0.6, v)), sstep(0.05, 0.9, u) * 0.92),
        color: (u, v) => { const r = Math.round(v * (rows - 1)), k = 0.78 + 0.4 * hsh(r * 3 + (s > 0 ? 0 : 40)); const q = lerp3(cM, cT, sstep(0.5, 1, u) * 0.85); return [q[0] * k, q[1] * k, q[2] * k]; }, dtl: [0.8, 0, 0.15, 0],
      });
    }
    for (let i = 0; i < (c.armour ? 0 : 7); i++) { // loose locks breaking the silhouette
      const t = 0.08 + i * 0.14, s = i % 3 === 1 ? -1 : 1, arc = [];
      for (let k = 0; k <= 8; k++) {
        const f = k / 8, ph = s * mix(0.05, 1.35 + 0.3 * hsh(i + 5), f);
        const base = A0.clone().lerp(A1, Math.min(1, t + 0.08 * f));
        const p = marchOut(S, base.toArray(), U.clone().multiplyScalar(Math.cos(ph)).add(new V3(Math.sin(ph), 0, 0)).toArray(), 0, 1);
        if (p) { const n = sdfNormal(S, p, 0), o2 = 0.05 + 0.02 * Math.sin(f * Math.PI); arc.push(new V3(p[0] + n[0] * o2, p[1] + n[1] * o2 - 0.03 * f, p[2] + n[2] * o2 + 0.03 * f)); }
      }
      if (arc.length < 4) continue;
      const rs = skinAt(S, arc[0].toArray()), mb = rigidSkin(b((t < 0.45 ? 'maneB' : 'maneA') + (s < 0 ? 'L' : 'R')));
      lock(acc, smoothPath(arc, 5), { r0: 0.04, r1: 0.008, bulge: 0.3, flat: 0.35, radial: 4, up: U.toArray(), c0: c.mane, c1: c.maneTip, from: 0.5, skin: (tt) => mixSkin(rs, mb, sstep(0.0, 0.8, tt) * 0.9), dtl: [0.55, 0, 0.1, 0] });
    }
    // forelock: three locks from between the ears down over the brow
    const fo = H(0.14, -0.03, 0);
    if (!c.armour) for (let i = -1; i <= 1; i++) {
      const ctrl = [H(-0.035, 0.07, i * 0.02), H(0.03, 0.1, i * 0.03), H(0.1, 0.1, i * 0.04), H(0.17, 0.09, i * 0.045)];
      const pts = surfPath(S, 2, fo, ctrl.map(q => [q[0] - fo[0], q[1] - fo[1], q[2] - fo[2]]), 0.02);
      if (pts.length < 3) continue;
      const hs0 = rigidSkin(b('head')), ms = rigidSkin(b('maneC'));
      lock(acc, smoothPath(pts, 5), { r0: 0.03, r1: 0.006, bulge: 0.3, flat: 0.4, radial: 4, up: NN, c0: c.mane, c1: c.maneTip, from: 0.4, skin: (tt) => mixSkin(hs0, ms, sstep(0.1, 0.8, tt) * 0.9) });
    }
    globalThis.__mark?.('forelock');
    // ---- tail: long hair from the dock, fanning slightly toward the hocks
    const tb = ['tail1', 'tail2', 'tail3', 'tail4'].map(b);
    const tskin = pathSkin([[0, rigidSkin(tb[0])], [0.18, rigidSkin(tb[1])], [0.45, rigidSkin(tb[2])], [0.72, rigidSkin(tb[3])], [1, rigidSkin(tb[3])]]);
    const tc = smoothPath([[0, 1.48, 0.8], [0, 1.45, 0.98], [0, 1.24, 1.13], [0, 0.95, 1.17], [0, 0.64, 1.13]], 17);
    const along = (tt) => { const f = clamp01(tt) * 16, k = Math.min(15, Math.floor(f)); return tc[k].clone().lerp(tc[k + 1], f - k); };
    const nT = c.armour ? 7 : 8;
    for (let i = 0; i < nT; i++) {
      const a = (i / (nT - 1) - 0.5) * 2, t0 = 0.05 + 0.12 * hsh(i + 7), t1 = 1 - 0.06 * hsh(i + 3);
      const pts = [];
      for (let k = 0; k < 8; k++) {
        const tt = mix(t0, t1, k / 7), q = along(tt);
        q.x += a * (0.03 + 0.09 * Math.pow(tt, 1.4)); q.z += (0.025 * Math.cos(a * 2) - 0.01) * (0.4 + tt) + 0.012 * Math.sin(tt * 7 + i);
        q.y += 0.02 * (1 - tt);
        pts.push(q);
      }
      lock(acc, pts, { r0: 0.05, r1: 0.014, bulge: 0.35, flat: 0.42, radial: 4, up: [0, 0, 1], c0: c.mane, c1: c.maneTip, from: 0.5, skin: (tt) => tskin(mix(t0, t1, tt)), dtl: [0.55, 0, 0.1, 0] });
    }
    globalThis.__mark?.('tail');
    // ---- tack
    const barrel = (z) => [0, z < -0.2 ? 1.2 : 1.15];
    const armour = !!c.armour;
    const ss = saddleSet(acc, S, {
      group: 0, axis: barrel,
      pad: armour ? null : { z0: -0.52, z1: 0.16, th: (v) => 1.22 - 0.3 * Math.pow(Math.abs(v * 2 - 1), 3), nu: 11, nv: 7, main: T.pad, trim: T.trim, trim2: T.trim2 },
      seat: { z0: -0.44, z1: 0.08, th: (v) => 0.92 - 0.36 * Math.pow(Math.abs(v * 2 - 1), 2.2), nu: 9, nv: 9, off: armour ? 0.02 : 0.024, seatH: 0.018, thick: 0.024, pommel: 0.065, cantle: armour ? 0.11 : 0.07, leather: T.leather, seatCol: T.seat, stitch: T.stitch, trimMetal: armour ? T.gold : null, horn: !armour, hornTip: T.metal },
      girth: armour ? null : { z: -0.3, w: 0.07, color: T.strap },
      stirrup: { x: 0.33, y: 0.86, z: -0.2, r: 0.05, top: [0.27, 1.42, -0.2], metal: T.metal, leather: T.strap, skin: rigidSkin(b('body')) },
    });
    globalThis.__mark?.('saddleSet');
    cfg.seat = ss.seat || [0, 1.58, -0.16];
    // ---- bridle: headstall (crown, cheeks), browband, noseband, bit rings; reins to the pommel
    const hs = rigidSkin(b('head')), org = H(0.2, -0.02, 0);
    const brid = (pts, w = 0.026, o2 = org) => { const sp = surfAim(S, 2, o2, pts, 0.006); if (sp.length > 1) ribbon(acc, sp, w, { skin: hs, color: T.strap }); };
    for (const s of [-1, 1]) brid([H(-0.02, 0.0, s * 0.11), H(0.08, -0.03, s * 0.11), H(0.18, -0.035, s * 0.11), H(0.3, -0.03, s * 0.11), H(0.41, -0.045, s * 0.1), H(0.5, -0.06, s * 0.09)]);
    brid([H(0.0, -0.02, -0.12), H(-0.03, 0.03, -0.08), H(-0.045, 0.06, -0.035), H(-0.045, 0.07, 0), H(-0.045, 0.06, 0.035), H(-0.03, 0.03, 0.08), H(0.0, -0.02, 0.12)]);
    brid([H(0.04, 0.0, -0.11), H(0.055, 0.05, -0.08), H(0.065, 0.09, -0.04), H(0.068, 0.1, 0), H(0.065, 0.09, 0.04), H(0.055, 0.05, 0.08), H(0.04, 0.0, 0.11)], 0.022);
    { const nb = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * TAU; nb.push(H(0.38, Math.cos(a) * 0.15, Math.sin(a) * 0.15)); } brid(nb, 0.03, H(0.38, -0.02, 0)); }
    for (const s of [-1, 1]) ring(acc, H(0.5, -0.065, s * 0.078), [1, 0, 0], 0.022, 0.0045, hs, T.metal, { rs: 3, ts: 8 });
    // reins: bit → loop under the jowl → neck sides → pommel horn
    const horn = ss.horn || [0, 1.66, -0.44];
    const rstops = pathSkin([[0, hs], [0.16, hs], [0.36, rigidSkin(b('neck2'))], [0.66, rigidSkin(b('neck1'))], [0.88, rigidSkin(b('chest'))], [1, rigidSkin(b('body'))]]);
    for (const s of [-1, 1]) {
      const pts = smoothPath([H(0.5, -0.065, s * 0.08), H(0.4, -0.16, s * 0.1), [s * 0.13, 1.6, -1.02], [s * 0.19, 1.52, -0.8], [s * 0.17, 1.56, -0.58], [s * 0.07, horn[1] - 0.01, horn[2] - 0.01]], 10);
      strap(acc, pts, 0.02, 0.006, { up: [s, 0, 0], skin: (p, uv) => rstops(uv[1]), color: T.strap });
    }
    globalThis.__mark?.('reins');
    if (armour) armourParts(acc, S, R, cfg);
    globalThis.__mark?.('armour');
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
    // plume between the ears: a fluffy crest arcing back over the poll
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.026;
      lock(acc, smoothPath([H(-0.03, 0.09, x * 0.5), [x, 2.2, -1.12], [x * 1.4, 2.3, -1.02], [x * 1.8, 2.28, -0.88 + 0.02 * i]], 7),
        { r0: 0.03, r1: 0.012, bulge: 0.9, flat: 0.55, radial: 4, up: [1, 0, 0], c0: T.plume, c1: 0xffd0c8, from: 0.55, skin: (tt) => mixSkin(hs, rigidSkin(b('maneC')), sstep(0.3, 1, tt) * 0.7) });
    }
  }
  // crinet: overlapping lames along the crest (neck1 / neck2)
  const A0 = new V3(0, 1.84, -1.08), A1 = new V3(0, 1.34, -0.7), ax = A1.clone().sub(A0).normalize(), U = new V3().crossVectors(new V3(1, 0, 0), ax).negate().normalize();
  const lames = 4;
  for (let l = 0; l < lames; l++) {
    const t0 = 0.06 + l * 0.22, t1 = t0 + 0.27, nu = 5, nv = 3, P = [], N = [], SK = [];
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
  globalThis.__mark?.('crinet');
  // peytral: chest plate with a boss
  {
    const nu = 7, nv = 4, P = [], N = [], SK = [];
    for (let j = 0; j < nv; j++) {
      const y = mix(1.3, 1.0, j / (nv - 1)), row = [], nrow = [], srow = [];
      for (let i = 0; i < nu; i++) {
        const a = mix(-0.72, 0.72, i / (nu - 1)), o = [0, y, -0.45], d = [Math.sin(a), 0, -Math.cos(a)];
        const p = marchOut(S, o, d, 0, 1) || o; row.push(p); nrow.push(sdfNormal(S, p, 0)); srow.push(p);
      }
      P.push(row); N.push(nrow); SK.push(srow);
    }
    shell(acc, S, { P, N, SK }, { off: 0.03, thick: 0.014, recalcN: true, color: (u, v) => plateCol(u, v, Math.min(u, 1 - u, v * 2, (1 - v) * 2)), dtl: [0, 0, 0.1, 0] });
  }
  globalThis.__mark?.('peytral');
  // caparison: heraldic cloth from the saddle to the croup, hanging down both flanks with a rounded, dagged hem
  {
    const zs = edgespace(-0.46, 0.8, 11, 0.03), nWrap = 9, nHang = 3, eqA = 1.45, NU0 = nWrap + nHang * 2;
    const P = [], N = [], SK = [], UU = [], VV = [];
    for (let j = 0; j < zs.length; j++) {
      const z = zs[j], v = (z + 0.46) / 1.26, ax2 = [0, z < -0.2 ? 1.2 : z > 0.45 ? 1.24 : 1.15, z];
      const wrap = [];
      for (let i = 0; i < nWrap; i++) {
        const a = mix(-eqA, eqA, i / (nWrap - 1)), d = [Math.sin(a), Math.cos(a), 0];
        const p = marchOut(S, ax2, d, 0, 1) || ax2; wrap.push([p, sdfNormal(S, p, 0)]);
      }
      const row = [], nrow = [], srow = [], urow = [];
      const dag = j % 2 ? 0.045 : 0;
      const hem = 0.8 + 0.34 * Math.pow(Math.abs(v * 2 - 1), 3.5) + dag;
      const hang = (side) => {
        const [pe] = side < 0 ? wrap[0] : wrap[nWrap - 1];
        const out = [];
        for (let k = 1; k <= nHang; k++) {
          const f = k / nHang, y = mix(pe[1], Math.min(hem, pe[1] - 0.02), f), x = pe[0] + side * (0.03 + 0.04 * f);
          out.push([[x, y, pe[2] + 0.015 * f], [side, 0.08, 0], pe]);
        }
        return out;
      };
      const L = hang(-1).reverse(), Rr = hang(1);
      L.forEach(([p, n, sp], k) => { row.push(p); nrow.push(n); srow.push(sp); urow.push(k / (NU0 - 1)); });
      wrap.forEach(([p, n], k) => { row.push(p); nrow.push(n); srow.push(p); urow.push((nHang + k) / (NU0 - 1)); });
      Rr.forEach(([p, n, sp], k) => { row.push(p); nrow.push(n); srow.push(sp); urow.push((nHang + nWrap + k) / (NU0 - 1)); });
      P.push(row); N.push(nrow); SK.push(srow); UU.push(urow); VV.push(v);
    }
    const nu = nWrap + nHang * 2;
    const cc = col(T.cloth), c2 = col(T.cloth2), cg = col(T.gold), cin = lerp3(col(T.cloth), [0, 0, 0], 0.55);
    shell(acc, S, { P, N, SK, U: UU, V: VV }, {
      off: 0.03, thick: 0.01, inner: true, innerGap: 0.008, recalcN: 0.7,
      innerMask: (u) => u < (nHang + 0.5) / (nu - 1) || u > 1 - (nHang + 0.5) / (nu - 1),
      color: (u, v, side) => {
        if (side < 0) return cin;
        const hang = Math.min(u, 1 - u) * (nu - 1), e = Math.min(hang / 3.2, v * 4, (1 - v) * 4);
        if (e < 0.12) return cg;
        if (e < 0.3) return c2;
        return Math.abs(u - 0.5) < 0.04 ? cg : cc;
      },
      dtl: [0, 0, 0.12, 0.55],
    });
    // sun emblems on both flanks
    for (const s of [-1, 1]) {
      const pe = marchOut(S, [0, 1.15, 0.18], [s * Math.sin(1.45), Math.cos(1.45), 0], 0, 1);
      if (pe) sunEmblem(acc, { p: [pe[0] + s * 0.1, 1.0, 0.18], n: [s, 0.08, 0], u: [0, 0, -s], v: [0, 1, 0] }, 0.14, skinAt(S, pe), T.gold, T.gold, { lift: 0 });
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
const GRAZE = mGraze({ dur: 5.2 }), SHAKE = mShake({ dur: 1.7 }), PAW = mPaw({ dur: 2.2, leg: 1 });
const ACTIONS = {
  rear: mRear({ dur: 2.4, ang: 0.95, sit: 0.3 }),
  whinny: mWhinny({ dur: 1.8 }),
  idle_alt: mPick([mGraze({ dur: 3.4 }), SHAKE, PAW], 3.4),
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
      { v: 1.6, f: 1.1, duty: 0.62, lift: 0.8, off: { RL: 0, FL: 0.25, RR: 0.5, FR: 0.75 }, bob: 0.012, bobF: 2, bobPh: 0.1, roll: 0.016, rollF: 1, sway: 0.01, swayF: 1, nod: 0.03, nodF: 2, nodPh: 0.3, pitch: 0.006, pitchF: 2 },
      { v: 4.0, f: 1.72, duty: 0.4, lift: 1.05, off: { FL: 0, RR: 0, FR: 0.5, RL: 0.5 }, bob: 0.02, bobF: 2, bobPh: 0.3, roll: 0.01, rollF: 1, nod: 0.015, nodF: 2, pitch: 0.008, pitchF: 2 },
      { v: 6.5, f: 2.0, duty: 0.32, lift: 1.15, off: { RL: 0, RR: 0.3, FL: 0.32, FR: 0.58 }, bob: 0.05, bobF: 1, bobPh: 0.55, pitch: 0.07, pitchF: 1, pitchPh: 0.1, flex: 0.04, flexF: 1, nod: 0.04, nodF: 1, nodPh: 0.6, lean: 0.03 },
      { v: 9.5, f: 2.35, duty: 0.26, lift: 1.2, off: { RL: 0, RR: 0.1, FL: 0.46, FR: 0.56 }, bob: 0.045, bobF: 1, bobPh: 0.62, pitch: 0.06, pitchF: 1, pitchPh: 0.05, flex: 0.08, flexF: 1, flexPh: 0.2, nod: 0.05, nodF: 1, nodPh: 0.8, lean: 0.05 },
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
