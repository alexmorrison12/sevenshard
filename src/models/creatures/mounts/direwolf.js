// Direwolf: a great saddled wolf (head ~1.9 m) — deep keel chest, a heavy shaggy ruff & mane, long legs, bushy tail,
// broad wedge head with amber eyes and fangs: fierce but noble. Sculpted in "wolf space" (Everdawn's proven timber-wolf
// proportions) and scaled ×K. Tack: fur-pelt pad, studded war saddle, breast collar with a medallion, girth, stirrups,
// snout harness & reins. Variants: grey (default), snow, black.
import * as THREE from 'three';
import { QuadCtl } from '../ctl.js';
import { qKnockback, qStun } from '../acts.js';
import { sweep, bez, taper, leafGeo, eyeGeo, eyeMatrix } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addHorn } from '../../kit/parts.js';
import { addG, lock, strap, ribbon, surfAim, ring, smoothPath, pathSkin, mixSkin, rigidSkin, skinAt, marchOut, sdfNormal, Jiggle, lerp3, sstep, clamp01, mix, TAU, legTo } from './common.js';
import { saddleSet } from './tack.js';
import { mRear, mJump, mShake, mHit, mDeath, mSpawn, mPick, mountPose, counterScaleRider } from './mountacts.js';

const K = 1.5; // wolf space → metres
const k3 = (p) => [p[0] * K, p[1] * K, p[2] * K];
const PAL = {
  grey: { base: 0x676a72, dark: 0x2b2c32, belly: 0xd2cbbe, mane: 0x9ca0a8, maneTip: 0x3a3b42, muzzle: 0xdcd5c8, mask: 0x393a40, leg: 0xa9a8a8, nose: 0x121012, eye: 0xe8a820, eyeGlow: 0.22, earIn: 0xb49a8e, tail: 0x5f626a,
    t: { leather: 0x3e2616, seat: 0x4e301c, stitch: 0xb08a58, pelt: 0x7a5a3c, peltTip: 0xd8c4a0, trim: 0xd8ccb0, metal: 0x8a8e96, strap: 0x2e1c10 } },
  snow: { base: 0xd6dbe2, dark: 0x96a0ae, belly: 0xf4f4f2, mane: 0xf2f4f6, maneTip: 0xa4b0c2, muzzle: 0xf4f2ee, mask: 0xaab4c2, leg: 0xe6e8ec, nose: 0x2a2a32, eye: 0x7ad4ff, eyeGlow: 0.6, earIn: 0xd8b8b8, tail: 0xdce1e8,
    t: { leather: 0x4a3222, seat: 0x5a3c28, stitch: 0xd8e4f0, pelt: 0x2c4a6e, peltTip: 0x9ac0e8, trim: 0xe8eef6, metal: 0xc8d4e2, strap: 0x3a2618 } },
  black: { base: 0x2a292f, dark: 0x111014, belly: 0x5a5660, mane: 0x3b3a42, maneTip: 0x0e0d10, muzzle: 0x6e6872, mask: 0x131215, leg: 0x46444b, nose: 0x080708, eye: 0xffc22a, eyeGlow: 0.9, earIn: 0x5a4648, tail: 0x222127,
    t: { leather: 0x241612, seat: 0x301e16, stitch: 0xc89a3a, pelt: 0x6a1418, peltTip: 0xd8a040, trim: 0xe0b040, metal: 0xd4a640, strap: 0x1a100c } },
};

const HP = [0, 1.02, -0.62], HS = 1.2; // head pivot & head scale (wolf space) — a broad, heavy direwolf head
const hx = (p) => [HP[0] + (p[0] - HP[0]) * HS, HP[1] + (p[1] - HP[1]) * HS, HP[2] + (p[2] - HP[2]) * HS];
const hsh = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export const direwolf = {
  name: 'Direwolf',
  variants: ['grey', 'snow', 'black'],
  mount: true,
  config(variant) {
    const v = PAL[variant] ? variant : 'grey';
    return { variant: v, pal: PAL[v], shapeKey: 'base', scale: 1, h: 0.068, hg: { 1: 0.05, 2: 0.047 }, aoScale: 1.4,
      grad: { top: 0.16, bottom: 0.3, y0: 0.1, y1: 0.9, low: 0.2 }, mat: { dfreq: 1.7, rim: 0.34, rimColor: 0xf0f4ff } };
  },
  rig(R) {
    const A = (n, p, pos) => R.add(n, p, k3(pos));
    A('body', null, [0, 0.8, 0.02]);
    A('hips', 'body', [0, 0.8, 0.34]);
    A('chest', 'body', [0, 0.8, -0.22]);
    A('seat', 'body', [0, 0.95, -0.02]);
    A('neck', 'chest', [0, 0.92, -0.42]);
    A('head', 'neck', HP);
    A('jaw', 'head', hx([0, 0.975, -0.67]));
    A('earL', 'head', hx([-0.064, 1.12, -0.66])); A('earR', 'head', hx([0.064, 1.12, -0.66]));
    A('ruffL', 'neck', [-0.12, 0.9, -0.44]); A('ruffR', 'neck', [0.12, 0.9, -0.44]);
    A('tail1', 'hips', [0, 0.85, 0.46]); A('tail2', 'tail1', [0, 0.8, 0.59]); A('tail3', 'tail2', [0, 0.71, 0.73]);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      A('fU' + n, 'chest', [0.14 * s, 0.72, -0.32]); A('fL' + n, 'fU' + n, [0.15 * s, 0.44, -0.2]); A('fP' + n, 'fL' + n, [0.15 * s, 0.12, -0.28]);
      A('rT' + n, 'hips', [0.13 * s, 0.76, 0.38]); A('rS' + n, 'rT' + n, [0.15 * s, 0.49, 0.25]); A('rM' + n, 'rS' + n, [0.15 * s, 0.24, 0.49]); A('rP' + n, 'rM' + n, [0.15 * s, 0.075, 0.45]);
    }
  },
  sculpt(S, cfg) {
    const c = cfg.pal;
    const so = (o) => ({ ...o, k: (o.k ?? 0.03) * K });
    const ell = (b, p, r, o = {}) => S.ell(b, k3(p), r.map(v => v * K), so(o));
    const sph = (b, p, r, o = {}) => S.sph(b, k3(p), r * K, so(o));
    const cone = (b, a, e, ra, rb, o = {}) => S.cone(b, k3(a), k3(e), ra * K, rb * K, so(o));
    const seg = (b, a, e, rx, ry, o = {}) => S.seg(b, k3(a), k3(e), rx * K, ry * K, so(o));
    const fur = [0.45, 0, 0.12, 0], furS = [0.28, 0, 0.1, 0], skin = [0, 0, 0.1, 0];
    // ---- torso: deep keel chest, broad shoulders, tucked waist, compact rump
    ell('chest', [0, 0.745, -0.2], [0.19, 0.24, 0.26], { k: 0.07, col: c.base, tag: 'body', dtl: fur });
    ell('chest', [0, 0.6, -0.33], [0.14, 0.12, 0.115], { k: 0.07, col: c.belly, tag: 'brisket', dtl: fur });
    for (const s of [-1, 1]) ell('chest', [s * 0.1, 0.865, -0.25], [0.085, 0.12, 0.13], { k: 0.06, col: c.dark, tag: 'back', rot: [-0.35, 0, s * 0.2], dtl: fur });
    ell('body', [0, 0.815, 0.05], [0.13, 0.12, 0.22], { k: 0.08, col: c.base, tag: 'body', dtl: fur });
    ell('body', [0, 0.87, 0.12], [0.11, 0.06, 0.2], { k: 0.06, col: c.dark, tag: 'back', dtl: fur });
    ell('hips', [0, 0.815, 0.33], [0.145, 0.14, 0.15], { k: 0.07, col: c.base, tag: 'body', dtl: fur });
    // ---- neck + a heavy mane: a fluffy mass broken into jagged tufts (the ruff tufts ride the ruff bones)
    cone('neck', [0, 0.82, -0.36], [0, 0.99, -0.6], 0.13, 0.095, { k: 0.07, col: c.mane, b2: 'head', t0: 0.6, t1: 1, dtl: fur });
    ell('neck', [0, 0.94, -0.47], [0.22, 0.24, 0.2], { k: 0.08, col: c.mane, tag: 'mane', dtl: fur });
    ell('chest', [0, 0.935, -0.32], [0.19, 0.2, 0.16], { k: 0.08, col: c.mane, tag: 'mane', dtl: fur });
    ell('chest', [0, 0.72, -0.43], [0.14, 0.16, 0.11], { k: 0.06, col: c.belly, tag: 'bib', dtl: fur });
    let hi = 0;
    const clump = (bone, base, dir, L, r0, tipc, tag = 'spike') => {
      const dl = Math.hypot(dir[0], dir[1], dir[2]);
      const tip = [base[0] + dir[0] / dl * L, base[1] + dir[1] / dl * L, base[2] + dir[2] / dl * L];
      const tc = col(tipc), mc = col(c.mane);
      cone(bone, base, tip, r0, 0.012, { k: 0.04, col: c.mane, tip: { col: [mix(mc[0], tc[0], 0.65), mix(mc[1], tc[1], 0.65), mix(mc[2], tc[2], 0.65)], from: 0.5 }, tag, dtl: fur });
    };
    const rings = [
      { z: -0.57, yc: 0.96, r: [0.18, 0.2], a: [-2.3, 2.3], n: 8, len: 0.15, back: 0.55 },
      { z: -0.44, yc: 0.95, r: [0.22, 0.23], a: [-2.2, 2.2], n: 8, len: 0.17, back: 0.62, off: 0.5 },
      { z: -0.31, yc: 0.94, r: [0.19, 0.2], a: [-1.8, 1.8], n: 6, len: 0.15, back: 0.72 },
    ];
    for (const Rg of rings) for (let i = 0; i < Rg.n; i++) {
      const f = (i + (Rg.off ?? 0) * 0.5) / (Rg.n - 1 + (Rg.off ?? 0) * 0.5);
      const a = Rg.a[0] + (Rg.a[1] - Rg.a[0]) * f + (hsh(hi) - 0.5) * 0.2;
      const sx = Math.sin(a), cy = Math.cos(a);
      const base = [sx * Rg.r[0] * 0.92, Rg.yc + cy * Rg.r[1] * 0.92, Rg.z];
      const dir = [sx * (1 - Rg.back) * 1.2, cy * (1 - Rg.back) - 0.12 * Math.max(0, -cy) - 0.05, Rg.back];
      const bone = Math.abs(a) > 0.5 && Rg.z < -0.3 ? (sx < 0 ? 'ruffL' : 'ruffR') : (Rg.z > -0.4 && Math.abs(a) < 1.3 ? 'chest' : 'neck');
      clump(bone, base, dir, Rg.len * (0.75 + 0.5 * hsh(hi++)) * (cy < -0.3 ? 1.3 : 1), 0.068, c.maneTip);
    }
    for (let i = 0; i < 5; i++) { // throat ruff hanging down
      const x = (i - 2) * 0.05;
      clump('neck', [x, 0.8 - Math.abs(x) * 0.3, -0.5 + Math.abs(x) * 0.4], [x * 0.8, -1, 0.35], 0.14 + 0.05 * hsh(hi++), 0.05, c.belly, 'ruff');
    }
    // ---- head (group 2): wedge skull, heavy brow, deep snout, flared cheeks
    const hr = (r) => r * HS, g2 = { group: 2 };
    ell('head', hx([0, 1.07, -0.69]), [hr(0.112), hr(0.094), hr(0.11)], { ...g2, k: 0.05, col: c.base, tag: 'head', dtl: furS });
    ell('head', hx([0, 1.115, -0.725]), [hr(0.074), hr(0.046), hr(0.08)], { ...g2, k: 0.04, col: c.mask, tag: 'mask', dtl: furS });
    for (const s of [-1, 1]) {
      ell('head', hx([s * 0.05, 1.112, -0.77]), [hr(0.05), hr(0.025), hr(0.036)], { ...g2, k: 0.02, col: c.mask, tag: 'brow', rot: [0.15, s * 0.45, -s * 0.4], dtl: furS });
      ell('head', hx([s * 0.08, 1.0, -0.66]), [hr(0.052), hr(0.058), hr(0.072)], { ...g2, k: 0.035, col: c.base, tag: 'cheek', dtl: fur });
      cone('head', hx([s * 0.095, 0.99, -0.645]), hx([s * 0.21, 0.93, -0.55]), hr(0.05), 0.008, { ...g2, k: 0.03, col: c.muzzle, tip: { col: c.base, from: 0.3 }, tag: 'cheek', dtl: fur });
      cone('head', hx([s * 0.095, 1.045, -0.63]), hx([s * 0.2, 1.045, -0.51]), hr(0.048), 0.008, { ...g2, k: 0.03, col: c.base, tip: { col: c.maneTip, from: 0.45 }, tag: 'cheek', dtl: fur });
      cone('head', hx([s * 0.03, 1.0, -0.77]), hx([s * 0.022, 0.998, -0.925]), hr(0.048), hr(0.032), { ...g2, k: 0.03, col: c.muzzle, tag: 'lip', dtl: furS });
      cone('head', hx([s * 0.017, 1.058, -0.79]), hx([s * 0.013, 1.04, -0.935]), hr(0.044), hr(0.031), { ...g2, k: 0.03, col: c.mask, tag: 'snout', dtl: furS });
    }
    ell('head', hx([0, 1.042, -0.955]), [hr(0.033), hr(0.027), hr(0.025)], { ...g2, k: 0.014, col: c.nose, tag: 'nose', dtl: skin, soft: 0.004 });
    cone('head', hx([0, 0.968, -0.745]), hx([0, 0.972, -0.94]), hr(0.02), hr(0.012), { ...g2, k: 0.012, sub: true, col: 0x2a1414, tag: 'mouth' });
    // lower jaw (group 1: own surface so the mouth can open)
    cone('jaw', hx([0, 0.963, -0.7]), hx([0, 0.958, -0.915]), hr(0.054), hr(0.031), { group: 1, k: 0.03, col: c.muzzle, tag: 'jaw', dtl: furS });
    ell('jaw', hx([0, 0.944, -0.75]), [hr(0.057), hr(0.034), hr(0.075)], { group: 1, k: 0.03, col: c.muzzle, tag: 'jaw', dtl: furS });
    // ---- legs: long, strong, knobbly joints, big paws
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      ell('fU' + n, [s * 0.12, 0.66, -0.3], [0.075, 0.13, 0.09], { k: 0.06, col: c.base, tag: 'shoulder', rot: [-0.2, 0, 0], dtl: fur });
      cone('fU' + n, [s * 0.14, 0.72, -0.32], [s * 0.15, 0.44, -0.2], 0.066, 0.048, { k: 0.05, col: c.base, b2: 'fL' + n, t0: 0.75, t1: 1, dtl: fur });
      cone('fL' + n, [s * 0.15, 0.44, -0.2], [s * 0.15, 0.13, -0.28], 0.046, 0.032, { k: 0.035, col: c.leg, tag: 'leg', b2: 'fP' + n, t0: 0.85, t1: 1, dtl: furS });
      cone('fL' + n, [s * 0.15, 0.45, -0.18], [s * 0.155, 0.35, -0.09], 0.034, 0.008, { k: 0.022, col: c.base, tag: 'tuft', dtl: fur });
      sph('fP' + n, [s * 0.15, 0.13, -0.275], 0.033, { k: 0.02, col: c.leg, tag: 'leg', dtl: furS });
      cone('fP' + n, [s * 0.15, 0.13, -0.28], [s * 0.15, 0.05, -0.32], 0.031, 0.038, { k: 0.03, col: c.leg, tag: 'leg', dtl: furS });
      ell('fP' + n, [s * 0.15, 0.042, -0.345], [0.048, 0.042, 0.064], { k: 0.035, col: c.leg, tag: 'paw', dtl: furS });
      ell('rT' + n, [s * 0.115, 0.67, 0.34], [0.085, 0.16, 0.122], { k: 0.07, col: c.base, tag: 'haunch', rot: [0.25, 0, 0], dtl: fur });
      cone('rT' + n, [s * 0.13, 0.76, 0.38], [s * 0.15, 0.49, 0.25], 0.074, 0.05, { k: 0.05, col: c.base, b2: 'rS' + n, t0: 0.8, t1: 1, dtl: fur });
      cone('rS' + n, [s * 0.15, 0.49, 0.25], [s * 0.15, 0.24, 0.49], 0.05, 0.03, { k: 0.035, col: c.leg, tag: 'leg', b2: 'rM' + n, t0: 0.85, t1: 1, dtl: furS });
      cone('rS' + n, [s * 0.15, 0.5, 0.27], [s * 0.155, 0.4, 0.38], 0.036, 0.008, { k: 0.022, col: c.base, tag: 'tuft', dtl: fur });
      sph('rM' + n, [s * 0.15, 0.245, 0.51], 0.03, { k: 0.02, col: c.leg, tag: 'leg', dtl: furS });
      cone('rM' + n, [s * 0.15, 0.24, 0.49], [s * 0.15, 0.075, 0.45], 0.03, 0.028, { k: 0.025, col: c.leg, tag: 'leg', b2: 'rP' + n, t0: 0.8, t1: 1, dtl: furS });
      cone('rP' + n, [s * 0.15, 0.075, 0.45], [s * 0.15, 0.045, 0.41], 0.028, 0.036, { k: 0.03, col: c.leg, tag: 'leg', dtl: furS });
      ell('rP' + n, [s * 0.15, 0.04, 0.395], [0.046, 0.04, 0.062], { k: 0.035, col: c.leg, tag: 'paw', dtl: furS });
    }
    // ---- tail: thick plume carried low, fluffy clumps, dark tip
    cone('tail1', [0, 0.85, 0.43], [0, 0.8, 0.58], 0.05, 0.07, { k: 0.05, col: c.tail, tag: 'tail', b2: 'tail2', t0: 0.5, t1: 1, dtl: fur });
    seg('tail2', [0, 0.815, 0.56], [0, 0.7, 0.75], 0.1, 0.105, { k: 0.06, col: c.tail, tag: 'tail', zs: 1.1, b2: 'tail3', t0: 0.7, t1: 1, dtl: fur });
    cone('tail3', [0, 0.72, 0.72], [0, 0.47, 0.95], 0.1, 0.03, { k: 0.06, col: c.tail, tip: { col: c.dark, from: 0.5 }, tag: 'tail', dtl: fur });
    for (let i = 0; i < 7; i++) {
      const t = i / 6, y = 0.8 - t * 0.26, z = 0.6 + t * 0.26, a = (i % 2 ? 1 : -1) * (1.0 + 0.6 * hsh(i + 40));
      const sx = Math.sin(a), cy = Math.cos(a) * 0.5 - 0.5;
      cone(i < 3 ? 'tail2' : 'tail3', [sx * 0.055, y, z], [sx * 0.13, y + cy * 0.13 - 0.04, z + 0.1], 0.04, 0.007, { k: 0.022, col: c.tail, tip: { col: c.dark, from: 0.5 }, tag: 'tail', dtl: fur });
    }
    // ---- hackle ridge along the back (behind the saddle)
    for (let i = 2; i < 4; i++) {
      const z = -0.14 + i * 0.12, y = 0.95 - i * 0.025;
      cone('body', [0, y, z], [0, y + 0.03, z + 0.13], 0.05, 0.01, { k: 0.04, col: c.dark, tip: { col: c.maneTip, from: 0.5 }, tag: 'ridge', dtl: fur });
    }
  },
  paint(v, cfg) {
    const c = cfg.pal, x = v.p[0] / K, y = v.p[1] / K, z = v.p[2] / K, [nx, ny, nz] = v.n;
    const ax = Math.abs(x);
    const jag = Math.sin(z * 38 + x * 12) * 0.5 + Math.sin(z * 71 - y * 20) * 0.3;
    const head = v.t('head') + v.t('mask') + v.t('snout') + v.t('lip') + v.t('brow') + v.t('cheek');
    const saddle = sstep(0.0, 0.5, ny + jag * 0.14) * sstep(-0.62, -0.4, z) * (1 - sstep(0.52, 0.62, z)) * sstep(0.74, 0.86, y) * (1 - head);
    v.mix(c.dark, saddle * 0.8);
    const under = sstep(-0.05, -0.55, ny + jag * 0.1) * (1 - head) * (1 - v.t('tail'));
    v.mix(c.belly, under * 0.85);
    const innerLeg = sstep(0.2, 0.8, -Math.sign(x) * nx) * sstep(0.62, 0.2, y) * (1 - v.t('paw'));
    v.mix(c.belly, innerLeg * 0.55);
    v.mix(c.dark, v.t('leg') * sstep(0.3, 0.8, -nz) * sstep(0.05, 0.4, y) * (z < 0 ? 1 : 0) * 0.45);
    const bridge = sstep(0.35, 0.85, ny) * (1 - sstep(0.02, 0.05, ax)) * (z < -0.72 ? 1 : 0) * (1 - v.t('nose'));
    v.mix(c.mask, bridge * 0.55);
    for (const s of [-1, 1]) { const e = hx([s * 0.062, 1.118, -0.752]); const d = Math.hypot(x - e[0], y - e[1], z - e[2]); v.mix(c.muzzle, (1 - sstep(0.008, 0.02, d)) * 0.7); }
    for (const s of [-1, 1]) { const e = hx([s * 0.062, 1.088, -0.776]); const d = Math.hypot(x - e[0], y - e[1], z - e[2]); v.mix(0x141012, (1 - sstep(0.026, 0.04, d)) * 0.85); }
    if (v.t('mouth') > 0.3 || (v.group === 1 && ny > 0.45 && z < -0.72)) v.mix(0x5a2020, 0.85);
    if (v.group === 2 && ny < -0.5 && z < -0.74 && y < 1.0 && y > 0.93) v.mix(0x4a1a1a, 0.8);
    v.mix(c.nose, v.t('mouth') * 0.5);
    v.mix(c.dark, v.t('paw') * sstep(0.025, 0.0, y) * 0.8);
    v.mul(1 + Math.sin(x * 9 + z * 5) * Math.sin(y * 7) * 0.05);
    if (v.t('nose') > 0.5) v.dtl[0] = 0;
    v.fx = Math.min(1, v.t('ridge') + v.t('spike') * sstep(0.2, 0.7, ny) * 0.8) * sstep(0.85, 0.95, y);
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, T = c.t, b = (n) => R.index(n);
    // eyes: amber (snow: ice blue), a faint inner glow — fierce but noble
    for (const s of [-1, 1]) {
      const g = eyeGeo(0.024 * HS * K, [{ a: 0.34, c: 0 }, { a: 0.8, c: 1 }], 10, 1.7);
      const ecol = col(c.eye), dark = col(0x0c0808), rim = col(0x1a1414);
      addG(acc, g, {
        matrix: eyeMatrix(S, k3(hx([s * 0.058, 1.088, -0.772])), [s * 0.7, 0.08, -1], 0.024 * HS * K, 0.5, 2, 0.7), skin: rigidSkin(b('head')),
        color: (p, n, uv) => uv[0] === 0 ? dark : uv[0] === 1 ? ecol : rim,
        emis: (p, uv) => (uv[0] === 1 ? c.eyeGlow : uv[0] === 0 ? 0.1 : 0), dtl: [0, 0, 0, 0],
      });
      const gp = new THREE.SphereGeometry(0.006 * K, 4, 3);
      const q = k3(hx([s * 0.066, 1.098, -0.79]));
      addG(acc, gp, { matrix: new THREE.Matrix4().makeTranslation(q[0], q[1], q[2]), skin: rigidSkin(b('head')), color: 0xffffff, emis: 0.4, dtl: [0, 0, 0, 0] });
    }
    // ears: leaf plates, pale inner face, tilted back & out
    for (const s of [-1, 1]) {
      const g = leafGeo(0.06 * K, 0.17 * K, 0.06 * K, 0.55, 0.08, { nu: 5, nv: 4 });
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.12, s * 0.35, -s * 0.2, 'YXZ')); m.setPosition(...k3(hx([s * 0.064, 1.12, -0.66])));
      const outer = col(c.mane), tipc = col(c.mask), inner = col(c.earIn), rimc = col(c.mane);
      addG(acc, g, {
        matrix: m, skin: rigidSkin(b(s < 0 ? 'earL' : 'earR')), dtl: [0.28, 0, 0.1, 0],
        color: (p, n, uv) => {
          const back = uv[0] >= 1, u = (uv[0] % 1) * 2, t = uv[1];
          if (back) return lerp3(outer, tipc, sstep(0.45, 0.9, t));
          return lerp3(inner, rimc, Math.max(sstep(0.55, 0.85, u), sstep(0.7, 0.95, t)));
        },
      });
    }
    // fangs & incisors
    const tooth = col(0xf2ead8), toothB = col(0xb8a888), tcol = (p, n, uv) => lerp3(toothB, tooth, uv[1]);
    for (const s of [-1, 1]) {
      addG(acc, sweep(bez(k3(hx([s * 0.028, 0.985, -0.885])), k3(hx([s * 0.03, 0.955, -0.89])), k3(hx([s * 0.029, 0.918, -0.88])), 4), taper(4, 0.013 * K, 0.002), { radial: 5 }), { skin: rigidSkin(b('head')), color: tcol, dtl: [0, 0, 0, 0] });
      addG(acc, sweep(bez(k3(hx([s * 0.025, 0.95, -0.858])), k3(hx([s * 0.026, 0.97, -0.861])), k3(hx([s * 0.025, 0.995, -0.855])), 4), taper(4, 0.011 * K, 0.002), { radial: 5 }), { skin: rigidSkin(b('jaw')), color: tcol, dtl: [0, 0, 0, 0] });
    }
    // claws
    for (const [paw, z0] of [['fP', -0.41], ['rP', 0.335]]) for (const s of [-1, 1]) for (let i = -1; i <= 1; i++) {
      const x = s * 0.15 + i * 0.026;
      addHorn(acc, b(paw + (s < 0 ? 'L' : 'R')), k3([x, 0.03, z0 + 0.02]), k3([x + i * 0.004, 0.025, z0 - 0.02]), k3([x + i * 0.006, 0.002, z0 - 0.034]), 0.011 * K, 0.002, { base: 0x2a2624, tip: 0x0c0a0a, radial: 4, n: 3 });
    }
    // ---- tack: pelt pad, studded war saddle, girth, stirrups
    const axis = () => [0, 1.2];
    const pelt = col(T.pelt), peltT = col(T.peltTip);
    const ss = saddleSet(acc, S, {
      group: 0, axis,
      pad: { z0: -0.33, z1: 0.36, th: (v) => 1.15 - 0.25 * Math.pow(Math.abs(v * 2 - 1), 3), main: T.pelt, trim: T.peltTip, trim2: T.pelt, hide: 0.2,
        pattern: (u, v) => lerp3(pelt, peltT, 0.25 * (0.5 + 0.5 * Math.sin(u * 40 + v * 13) * Math.sin(v * 31 - u * 7))) },
      seat: { z0: -0.24, z1: 0.26, th: (v) => 0.85 - 0.3 * Math.pow(Math.abs(v * 2 - 1), 2.2), nu: 9, nv: 9, off: 0.022, seatH: 0.018, thick: 0.026, pommel: 0.075, cantle: 0.085, leather: T.leather, seatCol: T.seat, stitch: T.stitch, trimMetal: T.metal, horn: true, hornTip: T.metal },
      girth: { z: -0.12, w: 0.07, color: T.strap, from: 1.0 },
      stirrup: { x: 0.28, y: 0.74, z: 0.0, r: 0.048, top: [0.19, 1.3, 0.0], metal: T.metal, leather: T.strap, skin: rigidSkin(b('body')) },
    });
    cfg.seat = ss.seat || k3([0, 0.97, 0.0]);
    // breast collar: strap from the saddle front, around the chest below the ruff, medallion in the middle
    {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const a = mix(-1.35, 1.35, i / 10), o = k3([0, 0.66, -0.28]), d = [Math.sin(a), 0.1, -Math.cos(a)];
        const p = marchOut(S, o, d, 0, 1); if (!p) continue;
        const n = sdfNormal(S, p, 0); const q = new THREE.Vector3(p[0] + n[0] * 0.012, p[1] + n[1] * 0.012, p[2] + n[2] * 0.012); pts.push(q);
        (pts.normals || (pts.normals = [])).push(new THREE.Vector3(...n));
      }
      if (pts.length > 2) ribbon(acc, pts, 0.05, { skin: (p) => skinAt(S, [p.x, p.y, p.z]), color: T.strap });
      const f = marchOut(S, k3([0, 0.66, -0.28]), [0, 0.1, -1], 0, 1);
      if (f) ring(acc, [f[0], f[1], f[2] - 0.02], [0, 0.1, -1], 0.045, 0.012, skinAt(S, f), T.metal, { rs: 3, ts: 10, emis: cfg.variant === 'black' ? 0.3 : 0 });
    }
    // snout harness: noseband + cheek straps to a ring at the jaw corner; reins over the ruff to the horn
    const hs = rigidSkin(b('head')), ho = k3(hx([0, 1.03, -0.76]));
    const nb = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * TAU; nb.push(k3(hx([Math.sin(a) * 0.12, 1.02 + Math.cos(a) * 0.12, -0.84]))); }
    const nbp = surfAim(S, 2, k3(hx([0, 1.02, -0.84])), nb, 0.008); if (nbp.length > 3) ribbon(acc, nbp, 0.035, { skin: hs, color: T.strap });
    for (const s of [-1, 1]) {
      const cp = surfAim(S, 2, ho, [k3(hx([s * 0.1, 1.03, -0.84])), k3(hx([s * 0.12, 1.06, -0.72])), k3(hx([s * 0.12, 1.08, -0.64])), k3(hx([s * 0.09, 1.12, -0.6]))], 0.008);
      if (cp.length > 1) ribbon(acc, cp, 0.03, { skin: hs, color: T.strap });
      ring(acc, k3(hx([s * 0.072, 0.975, -0.83])), [1, 0, 0], 0.028, 0.006, hs, T.metal, { rs: 3, ts: 8 });
    }
    const horn = ss.horn || k3([0, 1.02, -0.18]);
    const rstops = pathSkin([[0, hs], [0.2, hs], [0.45, rigidSkin(b('neck'))], [0.75, rigidSkin(b('chest'))], [1, rigidSkin(b('body'))]]);
    for (const s of [-1, 1]) {
      const pts = smoothPath([k3(hx([s * 0.075, 0.975, -0.83])), k3([s * 0.2, 0.98, -0.8]), k3([s * 0.3, 1.02, -0.58]), k3([s * 0.24, 1.08, -0.36]), [s * 0.06, horn[1] - 0.01, horn[2] - 0.01]], 10);
      strap(acc, pts, 0.025, 0.007, { up: [s, 0, 0], skin: (p, uv) => rstops(uv[1]), color: T.strap });
    }
  },
  sockets(cfg) {
    return {
      mouth: ['jaw', k3(hx([0, 0.97, -0.91]))], head: ['head', k3(hx([0, 1.2, -0.66]))], center: ['body', k3([0, 0.8, 0])], chest: ['chest', k3([0, 0.72, -0.35])],
      back: ['body', k3([0, 1.0, 0.18])], rider: ['seat', cfg.seat || k3([0, 0.97, 0])], tail: ['tail3', k3([0, 0.46, 0.98])],
    };
  },
  height: 1.9, radius: 0.62,
  controller(inst) {
    const c = new QuadCtl(inst, SPEC);
    c.jig = new Jiggle(c, JIG);
    counterScaleRider(inst);
    return c;
  },
  get actionList() { return ACTIONS; },
};

// ------------------------------------------------------------------------------------------------ animation
const kl = (L) => ({ ...L, toe: k3(L.toe), lift: L.lift * K });
const legs = [
  kl({ id: 'FL', chain: ['fUL', 'fLL', 'fPL'], toe: [-0.15, 0, -0.39], body: 'chest', scap: 0.35, lift: 0.13, flex: 1.5, out: 0.05, heel: 0.5 }),
  kl({ id: 'FR', chain: ['fUR', 'fLR', 'fPR'], toe: [0.15, 0, -0.39], body: 'chest', scap: 0.35, lift: 0.13, flex: 1.5, out: 0.05, heel: 0.5 }),
  kl({ id: 'RL', chain: ['rTL', 'rSL', 'rML', 'rPL'], toe: [-0.15, 0, 0.37], body: 'hips', scap: 0.3, lift: 0.12, flex: 0.9, out: 0.1, metaK: 1.1, heel: 0.35 }),
  kl({ id: 'RR', chain: ['rTR', 'rSR', 'rMR', 'rPR'], toe: [0.15, 0, 0.37], body: 'hips', scap: 0.3, lift: 0.12, flex: 0.9, out: 0.1, metaK: 1.1, heel: 0.35 }),
];
const ACTIONS = {
  attack: { dur: 0.75, a: 0.12, d: 0.75, hit: 0.45, fn(ctl, a, w) { // lunge bite
    const P = ctl.pose, b = ctl.b, k = a.k;
    const wind = sstep(0, 0.3, k) * (1 - sstep(0.3, 0.45, k)), lunge = sstep(0.28, 0.45, k) * (1 - sstep(0.6, 1, k));
    P.move(b.body, 0, (-0.05 * wind - 0.05 * lunge) * w, (0.1 * wind - 0.32 * lunge) * w);
    P.rx(b.body, (0.06 * wind - 0.08 * lunge) * w);
    P.rx(b.neck, (0.25 * wind - 0.22 * lunge) * w);
    P.rot(b.head, (0.2 * wind - 0.15 * lunge) * w, 0, 0.25 * lunge * Math.sin(k * 30) * w);
    ctl.jaw = Math.max(ctl.jaw, 0.8 * sstep(0.1, 0.4, k) * (1 - sstep(0.46, 0.52, k)) * w);
    ctl.ear = mix(ctl.ear, 1, w); ctl.hackle = Math.max(ctl.hackle, w);
    P.rx(b.seat, (-0.04 * wind + 0.05 * lunge) * w);
  } },
  attack2: { dur: 0.9, a: 0.1, d: 0.8, hit: 0.5, fn(ctl, a, w) { // rise & rake with the right fore paw
    const P = ctl.pose, b = ctl.b, k = a.k;
    const rise = sstep(0, 0.35, k) * (1 - sstep(0.55, 0.9, k)), sw = sstep(0.38, 0.55, k);
    P.move(b.body, 0, 0.14 * rise * w, 0.06 * rise * w); P.rot(b.body, 0.24 * rise * w, (0.15 * rise - 0.3 * sw * rise) * w, 0);
    P.rot(b.head, -0.1 * rise * w, -0.3 * sw * rise * w, 0);
    ctl.jaw = Math.max(ctl.jaw, 0.6 * rise * w); ctl.hackle = Math.max(ctl.hackle, w);
    legTo(ctl.gait.legs[1], 0.3 + 0.18 * rise - 0.5 * sw, 0.6 * rise + 0.15, -0.95 - 0.3 * sw, rise * w, true, -0.7);
    P.rx(b.seat, -0.1 * rise * w);
  } },
  howl: { dur: 3.2, a: 0.1, d: 0.88, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, t = a.t;
    const up = sstep(0, 0.6, t) * (1 - sstep(2.7, 3.2, t)) * w;
    P.move(b.body, 0, 0.03 * up, 0.05 * up);
    P.rx(b.body, 0.12 * up); P.rx(b.chest, 0.08 * up);
    P.rx(b.neck, 0.6 * up); P.rx(b.head, 0.55 * up + Math.sin(t * 5) * 0.03 * up);
    ctl.jaw = Math.max(ctl.jaw, (0.3 + 0.06 * Math.sin(t * 7) + 0.04 * Math.sin(t * 2.3)) * up * sstep(0.4, 0.7, t));
    ctl.ear = mix(ctl.ear, 0.9, up);
    if (b.tail) for (let i = 0; i < b.tail.length; i++) P.rx(b.tail[i], 0.1 * up);
    P.rx(b.seat, -0.1 * up);
  } },
  rear: mRear({ dur: 2.2, ang: 0.72, sit: 0.2, neck: 0.3, lift: 0.3, reach: 0.25, jaw: 1.6 }),
  sniff: { dur: 2.4, a: 0.2, d: 0.8, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, t = a.t;
    P.rx(b.neck, -0.55 * w); P.rot(b.head, -0.25 * w + Math.sin(t * 18) * 0.02 * w, Math.sin(t * 1.3) * 0.25 * w, 0);
    P.rx(b.chest, -0.06 * w);
  } },
  shake: mShake({ dur: 1.9, amp: 1.2 }),
  jump: mJump({ dur: 1.0, h: 0.55, pitch: 0.28, tuck: 0.4, tuckH: 0.3 }),
  hit: mHit({ jaw: 1.4 }),
  knockback: qKnockback(),
  stun: qStun(),
  death: mDeath({ dur: 2.0, lieY: 0.36, roll: 1.4 }),
  spawn: mSpawn({ dur: 1.5, h: 0.7, jaw: 2 }),
};
ACTIONS.idle_alt = mPick([ACTIONS.sniff, ACTIONS.shake, { dur: 2.2, fn: ACTIONS.howl.fn }], 2.6);

const JIG = [
  { bones: ['tail1', 'tail2', 'tail3'], anchor: 'tail1', k: 45, c: 6, g: 0.014, gi: 0.35, wind: 0.02, idle: 0.03, idleF: 1.0, max: 0.8 },
  { bones: ['ruffL'], tipDir: [-0.6, -0.5, 0.6], k: 80, c: 8, g: 0.01, wind: 0.012, idle: 0.01, max: 0.35 },
  { bones: ['ruffR'], tipDir: [0.6, -0.5, 0.6], k: 80, c: 8, g: 0.01, wind: 0.012, idle: 0.01, max: 0.35, ph: 1.7 },
];

const SPEC = {
  bones: { body: 'body', hips: 'hips', chest: 'chest', neck: 'neck', head: 'head', jaw: 'jaw', seat: 'seat', tail: ['tail1', 'tail2', 'tail3'], ears: ['earL', 'earR'] },
  gait: {
    legs, maxStride: 1.3, actV: 0.3,
    gaits: [
      { v: 1.8, f: 1.25, duty: 0.62, lift: 0.8, off: { RL: 0, FL: 0.25, RR: 0.5, FR: 0.75 }, bob: 0.014, bobF: 2, bobPh: 0.1, roll: 0.03, rollF: 1, sway: 0.012, swayF: 1, nod: 0.035, nodF: 2, nodPh: 0.3 },
      { v: 4.2, f: 1.85, duty: 0.42, lift: 1, off: { FL: 0, RR: 0, FR: 0.5, RL: 0.5 }, bob: 0.022, bobF: 2, bobPh: 0.35, roll: 0.02, rollF: 1, nod: 0.03, nodF: 2, nodPh: 0.5, pitch: 0.012, pitchF: 2 },
      { v: 7, f: 2.1, duty: 0.32, lift: 1.15, off: { RL: 0, RR: 0.12, FL: 0.4, FR: 0.52 }, bob: 0.045, bobF: 1, bobPh: 0.6, pitch: 0.08, pitchF: 1, pitchPh: 0.05, flex: 0.12, flexF: 1, flexPh: 0.2, nod: 0.05, nodF: 1, nodPh: 0.8, lean: 0.04 },
      { v: 10, f: 2.5, duty: 0.26, lift: 1.25, off: { RL: 0, RR: 0.1, FR: 0.42, FL: 0.52 }, bob: 0.055, bobF: 1, bobPh: 0.62, pitch: 0.09, pitchF: 1, pitchPh: 0.05, flex: 0.18, flexF: 1, flexPh: 0.2, nod: 0.06, nodF: 1, nodPh: 0.8, lean: 0.06 },
    ],
  },
  neck: { pitch: 0.2, run: -0.3, combat: -0.38, walk: -0.08, headCombat: 0.2, comp: 0.45 },
  tail: { wag: 0.12, wagF: 0.5, run: 0.5, combat: 0.35 },
  combatCrouch: 0.06, combatPitch: -0.05, runDrop: 0.05, breathe: 0.012,
  fidgets: [{ name: 'sniff', w: 3 }, { name: 'shake', w: 1 }],
  fidgetGap: 5,
  pose(ctl, dt) {
    // pant when running / fighting; snarl stance in combat (feet wider); saddle-steady rider
    ctl.jaw += (0.1 + 0.05 * Math.sin(ctl.t * 14)) * ctl.run + ctl.combat * (0.12 + 0.03 * Math.sin(ctl.t * 9));
    const G = ctl.gait.legs; for (let i = 0; i < G.length; i++) { const L = G[i]; L.homeOff.set(L.side * 0.045 * ctl.combat, 0, (L.id[0] === 'F' ? -0.07 : 0.03) * ctl.combat); }
    mountPose(ctl, dt, POSE);
    ctl.ear = ctl.run * 0.4 + ctl.combat * 0.6 + Math.pow(Math.max(0, Math.sin(ctl.t * 0.8 + 2)), 30) * 0.3;
  },
  actions: ACTIONS,
};
const POSE = { nodWalk: 0.02, swing: 0.05, earBase: 0, seatK: 0.6, rollK: 0.55, bobK: 0.35, pant: 0 };
