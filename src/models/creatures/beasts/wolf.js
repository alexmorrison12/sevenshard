// Goldmeadow timber wolf (adapted from Everdawn's wolf). Deep-chested, big ruffed mane, wedge head with a heavy brow,
// bushy low-carried tail. Variants grey (default) / brown / black; elite "Duskfang" — the pack alpha (×1.4): charcoal
// coat under a silver-white lion mane, scarred muzzle, torn ear, glowing amber eyes and a broken arrow in the shoulder.
import * as THREE from 'three';
import { QuadCtl } from '../ctl.js';
import { qHit, qKnockback, qKnockdown, qGetup, qDeath, qStun, qSpawn } from '../acts.js';
import { sweep, eyeGeo, rigid, bez, taper, leafGeo, eyeMatrix } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { lerp3 } from '../../kit/parts.js';
import { sstep, clamp01, mix, bell } from '../../kit/rig.js';
import { hsh, ov, cancelRestOnMove, prepLegs, sidePair } from './util.js';

const PAL = {
  grey: { base: 0x66696f, dark: 0x2b2c31, belly: 0xcdc6ba, mane: 0x8b8e95, maneTip: 0x34353b, muzzle: 0xdad3c6, mask: 0x3a3b40, leg: 0xa7a6a6, nose: 0x121012, eye: 0xf0b020, earIn: 0xb49a8e, tail: 0x5e6168, glow: 0xff4a1a },
  brown: { base: 0x80593a, dark: 0x3a2517, belly: 0xe0c092, mane: 0xa27a4e, maneTip: 0x3a2416, muzzle: 0xe8d0a6, mask: 0x4a2f1c, leg: 0xc09a6c, nose: 0x1a1210, eye: 0xf6c830, earIn: 0xc09078, tail: 0x72502f, glow: 0xff4a1a },
  black: { base: 0x2c2b30, dark: 0x121114, belly: 0x5e5a60, mane: 0x3c3b42, maneTip: 0x0e0d10, muzzle: 0x77717a, mask: 0x131215, leg: 0x45434a, nose: 0x080708, eye: 0xffd23a, earIn: 0x5a4648, tail: 0x232226, glow: 0xff4a1a },
  duskfang: { base: 0x34302f, dark: 0x151213, belly: 0x77706a, mane: 0xcfcac2, maneTip: 0x6a6664, muzzle: 0x8a827a, mask: 0x1a1718, leg: 0x4a4546, nose: 0x080606, eye: 0xffb830, earIn: 0x6a4c4a, tail: 0x2e2a2a, scar: 0xc88a84, glow: 0xff7a18 },
};

const HP = [0, 1.02, -0.62], HS = 1.14; // head pivot & head scale (chunky heroic heads)
const hx = (p) => [HP[0] + (p[0] - HP[0]) * HS, HP[1] + (p[1] - HP[1]) * HS, HP[2] + (p[2] - HP[2]) * HS];

export const wolf = {
  name: 'Wolf',
  variants: ['grey', 'brown', 'black', 'duskfang'],
  config(variant, opts = {}) {
    const v = PAL[variant] ? variant : (opts.elite ? 'duskfang' : 'grey');
    const elite = v === 'duskfang' || !!opts.elite;
    const pal = PAL[elite ? 'duskfang' : v];
    return { variant: elite ? 'duskfang' : v, pal, elite, shapeKey: elite ? 'elite' : 'base', scale: elite ? 1.4 : 1, h: elite ? 0.043 : 0.048, hg: elite ? { 1: 0.03, 2: 0.028 } : { 1: 0.034, 2: 0.032 }, mat: { dfreq: 2.4, rim: 0.3, rimColor: 0xfff0dc }, aoScale: 1 };
  },
  rig(R) {
    R.add('body', null, [0, 0.80, 0.02]);
    R.add('hips', 'body', [0, 0.80, 0.34]);
    R.add('chest', 'body', [0, 0.80, -0.22]);
    R.add('neck', 'chest', [0, 0.92, -0.42]);
    R.add('head', 'neck', HP);
    R.add('jaw', 'head', hx([0, 0.975, -0.67]));
    R.add('earL', 'head', hx([-0.064, 1.112, -0.63])); R.add('earR', 'head', hx([0.064, 1.112, -0.63]));
    R.add('tail1', 'hips', [0, 0.85, 0.46]); R.add('tail2', 'tail1', [0, 0.8, 0.59]); R.add('tail3', 'tail2', [0, 0.71, 0.73]);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('fU' + n, 'chest', [0.14 * s, 0.72, -0.32]); R.add('fL' + n, 'fU' + n, [0.15 * s, 0.44, -0.20]); R.add('fP' + n, 'fL' + n, [0.15 * s, 0.12, -0.28]);
      R.add('rT' + n, 'hips', [0.13 * s, 0.76, 0.38]); R.add('rS' + n, 'rT' + n, [0.15 * s, 0.49, 0.25]); R.add('rM' + n, 'rS' + n, [0.15 * s, 0.24, 0.49]); R.add('rP' + n, 'rM' + n, [0.15 * s, 0.075, 0.45]);
    }
  },
  sculpt(S, cfg) {
    const c = cfg.pal, E = cfg.elite ? 1.2 : 1;
    const fur = [0.4, 0, 0.12, 0], furS = [0.26, 0, 0.1, 0], skin = [0, 0, 0.1, 0];
    // ---- torso: deep ribcage, broad shoulders, tucked waist, compact rump
    S.ell('chest', [0, 0.745, -0.2], [0.18, 0.235, 0.26], { k: 0.07, col: c.base, tag: 'body', dtl: fur });
    S.ell('chest', [0, 0.6, -0.33], [0.13, 0.12, 0.115], { k: 0.07, col: c.belly, tag: 'brisket', dtl: fur });
    for (const s of [-1, 1]) S.ell('chest', [s * 0.1, 0.865, -0.25], [0.08, 0.12, 0.13], { k: 0.06, col: c.dark, tag: 'back', rot: [-0.35, 0, s * 0.2], dtl: fur });
    S.ell('body', [0, 0.815, 0.05], [0.12, 0.115, 0.22], { k: 0.08, col: c.base, tag: 'body', dtl: fur });
    S.ell('body', [0, 0.86, 0.12], [0.105, 0.06, 0.2], { k: 0.06, col: c.dark, tag: 'back', dtl: fur });
    S.ell('hips', [0, 0.815, 0.33], [0.14, 0.135, 0.15], { k: 0.07, col: c.base, tag: 'body', dtl: fur });
    // ---- neck + mane: a big fluffy mass; short blended clumps break the silhouette into jagged tufts
    S.cone('neck', [0, 0.82, -0.36], [0, 0.99, -0.6], 0.125, 0.09, { k: 0.07, col: c.mane, b2: 'head', t0: 0.6, t1: 1, dtl: fur });
    S.ell('neck', [0, 0.935, -0.47], [0.2 * (E > 1 ? 1.08 : 1), 0.22, 0.19], { k: 0.08, col: c.mane, tag: 'mane', dtl: fur });
    S.ell('chest', [0, 0.93, -0.32], [0.17, 0.18, 0.15], { k: 0.08, col: c.mane, tag: 'mane', dtl: fur });
    S.ell('chest', [0, 0.72, -0.43], [0.13, 0.15, 0.1], { k: 0.06, col: c.belly, tag: 'bib', dtl: fur });
    let hi = 0;
    const clump = (bone, base, dir, L, r0, tipc, tag = 'spike') => {
      const dl = Math.hypot(dir[0], dir[1], dir[2]);
      const tip = [base[0] + dir[0] / dl * L, base[1] + dir[1] / dl * L, base[2] + dir[2] / dl * L];
      const tc = col(tipc), mc = col(c.mane);
      S.cone(bone, base, tip, r0, 0.007, { k: 0.035, col: c.mane, tip: { col: [mix(mc[0], tc[0], 0.65), mix(mc[1], tc[1], 0.65), mix(mc[2], tc[2], 0.65)], from: 0.5 }, tag, dtl: fur });
    };
    // rings of tufts around the mane mass (bases sit on its surface, tips flare back & out)
    const rings = [
      { z: -0.56, yc: 0.95, r: [0.17, 0.19], a: [-2.3, 2.3], n: 9, len: 0.14, back: 0.55 },
      { z: -0.44, yc: 0.94, r: [0.2, 0.21], a: [-2.1, 2.1], n: 8, len: 0.15, back: 0.62, off: 0.5 },
      { z: -0.31, yc: 0.93, r: [0.17, 0.18], a: [-1.7, 1.7], n: 6, len: 0.14, back: 0.72 },
      { z: -0.19, yc: 0.92, r: [0.12, 0.12], a: [-1.0, 1.0], n: 3, len: 0.11, back: 0.85, off: 0.5 },
    ];
    for (const R of rings) for (let i = 0; i < R.n; i++) {
      const f = (i + (R.off ?? 0) * 0.5) / (R.n - 1 + (R.off ?? 0) * 0.5);
      const a = R.a[0] + (R.a[1] - R.a[0]) * f + (hsh(hi) - 0.5) * 0.2;
      const sx = Math.sin(a), cy = Math.cos(a);
      const base = [sx * R.r[0] * 0.92, R.yc + cy * R.r[1] * 0.92, R.z];
      const dir = [sx * (1 - R.back) * 1.2, cy * (1 - R.back) - 0.12 * Math.max(0, -cy) - 0.05, R.back];
      const bone = R.z > -0.4 && Math.abs(a) < 1.3 ? 'chest' : 'neck';
      clump(bone, base, dir, R.len * (0.75 + 0.5 * hsh(hi++)) * E * (cy < -0.3 ? 1.25 : 1), 0.056, c.maneTip);
    }
    // throat / bib ruff hanging down
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 0.045;
      clump('neck', [x, 0.8 - Math.abs(x) * 0.3, -0.5 + Math.abs(x) * 0.4], [x * 0.8, -1, 0.35], (0.12 + 0.04 * hsh(hi++)) * E, 0.045, c.belly, 'ruff');
    }
    // ---- head (scaled around the head pivot): wedge skull, heavy brow, deep snout, flared cheeks
    const hr = (r) => r * HS;
    S.ell('head', hx([0, 1.07, -0.69]), [hr(0.108), hr(0.092), hr(0.11)], { group: 2, k: 0.05, col: c.base, tag: 'head', dtl: furS });
    S.ell('head', hx([0, 1.115, -0.725]), [hr(0.072), hr(0.045), hr(0.08)], { group: 2, k: 0.04, col: c.mask, tag: 'mask', dtl: furS });
    for (const s of [-1, 1]) {
      S.ell('head', hx([s * 0.05, 1.11, -0.77]), [hr(0.047), hr(0.023), hr(0.036)], { group: 2, k: 0.02, col: c.mask, tag: 'brow', rot: [0.15, s * 0.45, -s * 0.4], dtl: furS });
      S.ell('head', hx([s * 0.078, 1.0, -0.66]), [hr(0.05), hr(0.056), hr(0.072)], { group: 2, k: 0.035, col: c.base, tag: 'cheek', dtl: fur });
      S.cone('head', hx([s * 0.095, 0.99, -0.645]), hx([s * 0.2, 0.93, -0.56]), hr(0.048), 0.008, { group: 2, k: 0.03, col: c.muzzle, tip: { col: c.base, from: 0.3 }, tag: 'cheek', dtl: fur });
      S.cone('head', hx([s * 0.095, 1.045, -0.63]), hx([s * 0.19, 1.04, -0.52]), hr(0.046), 0.008, { group: 2, k: 0.03, col: c.base, tip: { col: c.maneTip, from: 0.45 }, tag: 'cheek', dtl: fur });
      S.cone('head', hx([s * 0.03, 1.0, -0.77]), hx([s * 0.022, 0.998, -0.925]), hr(0.047), hr(0.031), { group: 2, k: 0.03, col: c.muzzle, tag: 'lip', dtl: furS });
      S.cone('head', hx([s * 0.017, 1.058, -0.79]), hx([s * 0.013, 1.04, -0.935]), hr(0.043), hr(0.03), { group: 2, k: 0.03, col: c.mask, tag: 'snout', dtl: furS });
    }
    S.ell('head', hx([0, 1.042, -0.955]), [hr(0.032), hr(0.026), hr(0.024)], { group: 2, k: 0.014, col: c.nose, tag: 'nose', dtl: skin, soft: 0.004 });
    S.cone('head', hx([0, 0.968, -0.745]), hx([0, 0.972, -0.94]), hr(0.019), hr(0.011), { group: 2, k: 0.012, sub: true, col: 0x2a1414, tag: 'mouth' });
    // lower jaw (own surface so the mouth can open)
    S.cone('jaw', hx([0, 0.963, -0.7]), hx([0, 0.958, -0.915]), hr(0.052), hr(0.03), { group: 1, k: 0.03, col: c.muzzle, tag: 'jaw', dtl: furS });
    S.ell('jaw', hx([0, 0.944, -0.75]), [hr(0.055), hr(0.033), hr(0.075)], { group: 1, k: 0.03, col: c.muzzle, tag: 'jaw', dtl: furS });
    // ---- legs: slim with knobbly joints, neat paws
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      S.ell('fU' + n, [s * 0.12, 0.66, -0.3], [0.068, 0.12, 0.085], { k: 0.06, col: c.base, tag: 'shoulder', rot: [-0.2, 0, 0], dtl: fur });
      S.cone('fU' + n, [s * 0.14, 0.72, -0.32], [s * 0.15, 0.44, -0.2], 0.06, 0.045, { k: 0.05, col: c.base, b2: 'fL' + n, t0: 0.75, t1: 1, dtl: fur });
      S.cone('fL' + n, [s * 0.15, 0.44, -0.2], [s * 0.15, 0.13, -0.28], 0.042, 0.029, { k: 0.035, col: c.leg, tag: 'leg', b2: 'fP' + n, t0: 0.85, t1: 1, dtl: furS });
      S.cone('fL' + n, [s * 0.15, 0.45, -0.18], [s * 0.155, 0.36, -0.1], 0.03, 0.008, { k: 0.022, col: c.base, tag: 'tuft', dtl: fur });
      S.sph('fP' + n, [s * 0.15, 0.13, -0.275], 0.03, { k: 0.02, col: c.leg, tag: 'leg', dtl: furS });
      S.cone('fP' + n, [s * 0.15, 0.13, -0.28], [s * 0.15, 0.05, -0.32], 0.028, 0.035, { k: 0.03, col: c.leg, tag: 'leg', dtl: furS });
      S.ell('fP' + n, [s * 0.15, 0.04, -0.34], [0.044, 0.038, 0.06], { k: 0.035, col: c.leg, tag: 'paw', dtl: furS });
      S.ell('rT' + n, [s * 0.115, 0.67, 0.34], [0.08, 0.155, 0.118], { k: 0.07, col: c.base, tag: 'haunch', rot: [0.25, 0, 0], dtl: fur });
      S.cone('rT' + n, [s * 0.13, 0.76, 0.38], [s * 0.15, 0.49, 0.25], 0.07, 0.048, { k: 0.05, col: c.base, b2: 'rS' + n, t0: 0.8, t1: 1, dtl: fur });
      S.cone('rS' + n, [s * 0.15, 0.49, 0.25], [s * 0.15, 0.24, 0.49], 0.046, 0.028, { k: 0.035, col: c.leg, tag: 'leg', b2: 'rM' + n, t0: 0.85, t1: 1, dtl: furS });
      S.cone('rS' + n, [s * 0.15, 0.5, 0.27], [s * 0.155, 0.41, 0.37], 0.032, 0.008, { k: 0.022, col: c.base, tag: 'tuft', dtl: fur });
      S.sph('rM' + n, [s * 0.15, 0.245, 0.51], 0.027, { k: 0.02, col: c.leg, tag: 'leg', dtl: furS });
      S.cone('rM' + n, [s * 0.15, 0.24, 0.49], [s * 0.15, 0.075, 0.45], 0.027, 0.025, { k: 0.025, col: c.leg, tag: 'leg', b2: 'rP' + n, t0: 0.8, t1: 1, dtl: furS });
      S.cone('rP' + n, [s * 0.15, 0.075, 0.45], [s * 0.15, 0.045, 0.41], 0.026, 0.034, { k: 0.03, col: c.leg, tag: 'leg', dtl: furS });
      S.ell('rP' + n, [s * 0.15, 0.04, 0.395], [0.043, 0.037, 0.058], { k: 0.035, col: c.leg, tag: 'paw', dtl: furS });
    }
    // ---- tail: plume carried low, smooth taper, fluffy clumps, dark tip
    S.cone('tail1', [0, 0.85, 0.43], [0, 0.8, 0.58], 0.045, 0.065, { k: 0.05, col: c.tail, tag: 'tail', b2: 'tail2', t0: 0.5, t1: 1, dtl: fur });
    S.seg('tail2', [0, 0.815, 0.56], [0, 0.7, 0.75], 0.09, 0.095, { k: 0.06, col: c.tail, tag: 'tail', zs: 1.1, b2: 'tail3', t0: 0.7, t1: 1, dtl: fur });
    S.cone('tail3', [0, 0.72, 0.72], [0, 0.46, 0.95], 0.085, 0.012, { k: 0.05, col: c.tail, tip: { col: c.dark, from: 0.45 }, tag: 'tail', dtl: fur });
    for (let i = 0; i < 5; i++) {
      const t = i / 4, y = 0.8 - t * 0.26, z = 0.6 + t * 0.26, a = (i % 2 ? 1 : -1) * (1.0 + 0.6 * hsh(i + 40));
      const sx = Math.sin(a), cy = Math.cos(a) * 0.5 - 0.5;
      S.cone(i < 2 ? 'tail2' : 'tail3', [sx * 0.05, y, z], [sx * 0.13, y + cy * 0.13 - 0.04, z + 0.11], 0.042, 0.006, { k: 0.022, col: c.tail, tip: { col: c.dark, from: 0.5 }, tag: 'tail', dtl: fur });
    }
    // ---- hackle ridge along the back
    for (let i = 0; i < 4; i++) {
      const z = -0.14 + i * 0.12, y = 0.95 - i * 0.025;
      S.cone(i < 2 ? 'chest' : 'body', [0, y, z], [0, y + 0.03 * E, z + 0.13 * E], 0.05, 0.01, { k: 0.04, col: c.dark, tip: { col: c.maneTip, from: 0.5 }, tag: 'ridge', dtl: fur });
    }
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, y, z] = v.p, [nx, ny, nz] = v.n;
    const ax = Math.abs(x);
    const jag = Math.sin(z * 38 + x * 12) * 0.5 + Math.sin(z * 71 - y * 20) * 0.3;
    const head = v.t('head') + v.t('mask') + v.t('snout') + v.t('lip') + v.t('brow') + v.t('cheek');
    // dark saddle along the back and over the scruff
    const saddle = sstep(0.0, 0.5, ny + jag * 0.14) * sstep(-0.62, -0.4, z) * (1 - sstep(0.52, 0.62, z)) * sstep(0.74, 0.86, y) * (1 - head) * (1 - v.t('mane') * (cfg.elite ? 0.85 : 0));
    v.mix(c.dark, saddle * 0.8);
    // pale underside, bib, inner legs
    const under = sstep(-0.05, -0.55, ny + jag * 0.1) * (1 - head) * (1 - v.t('tail'));
    v.mix(c.belly, under * 0.85);
    const innerLeg = sstep(0.2, 0.8, -Math.sign(x) * nx) * sstep(0.62, 0.2, y) * (1 - v.t('paw'));
    v.mix(c.belly, innerLeg * 0.55);
    // foreleg front stripe
    const fore = v.t('leg') * sstep(0.3, 0.8, -nz) * sstep(0.05, 0.4, y) * (z < 0 ? 1 : 0);
    v.mix(c.dark, fore * 0.45);
    // face mask: dark bridge from nose to forehead, pale eyebrow spots
    const bridge = sstep(0.35, 0.85, ny) * (1 - sstep(0.02, 0.05, ax)) * (z < -0.72 ? 1 : 0) * (1 - v.t('nose'));
    v.mix(c.mask, bridge * 0.55);
    for (const s of [-1, 1]) { const e = hx([s * 0.062, 1.118, -0.752]); const d = Math.hypot(x - e[0], y - e[1], z - e[2]); v.mix(c.muzzle, (1 - sstep(0.008, 0.02, d)) * 0.7); }
    for (const s of [-1, 1]) { const e = hx([s * 0.062, 1.088, -0.776]); const d = Math.hypot(x - e[0], y - e[1], z - e[2]); v.mix(0x141012, (1 - sstep(0.026, 0.04, d)) * 0.85); } // eyeliner
    // mouth interior (upper palate / jaw top) and lip line
    if (v.t('mouth') > 0.3 || (v.group === 1 && ny > 0.45 && z < -0.72)) v.mix(0x5a2020, 0.85);
    if (v.group === 0 && ny < -0.5 && z < -0.74 && y < 1.0 && y > 0.93) v.mix(0x4a1a1a, 0.8);
    v.mix(c.nose, v.t('mouth') * 0.5);
    // paw pads/toes darker
    v.mix(c.dark, v.t('paw') * sstep(0.025, 0.0, y) * 0.8);
    if (cfg.elite) {
      // three claw scars raked across the left eye and muzzle, a long flank scar, frosted muzzle
      for (let i = 0; i < 3; i++) {
        const d = Math.abs((y - 1.07) * 0.8 + (z + 0.82) * 0.5 - (i - 1) * 0.026);
        v.mix(c.scar, (1 - sstep(0.004, 0.011, d)) * (x < -0.015 ? 1 : 0) * (z < -0.66 ? 1 : 0) * (y > 0.97 ? 1 : 0) * 0.9);
      }
      const fs = Math.abs((y - 0.78) - (z - 0.05) * 0.6);
      v.mix(c.scar, (1 - sstep(0.006, 0.014, fs)) * (x > 0.1 ? 1 : 0) * sstep(-0.15, -0.05, z) * (1 - sstep(0.15, 0.25, z)) * 0.85);
      v.mix(c.mane, v.t('lip') * 0.35 + v.t('jaw') * 0.3);
    }
    v.mul(1 + Math.sin(x * 9 + z * 5) * Math.sin(y * 7) * 0.05);
    if (v.t('nose') > 0.5) v.dtl[0] = 0;
    // hackles: ridge + upper mane clumps rise in combat
    v.fx = Math.min(1, v.t('ridge') + v.t('spike') * sstep(0.2, 0.7, ny) * 0.8) * sstep(0.85, 0.95, y);
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n), E = cfg.elite;
    // eyes (amber; Duskfang's burn)
    for (const s of [-1, 1]) {
      const g = eyeGeo(0.023 * HS, [{ a: 0.36, c: 0 }, { a: 0.8, c: 1 }], 12, 1.7);
      const ecol = col(c.eye), dark = col(E ? 0x3a1a04 : 0x0c0808), rim = col(0x1a1414);
      acc.add(g, {
        matrix: eyeMatrix(S, hx([s * 0.058, 1.088, -0.772]), [s * 0.7, 0.08, -1], 0.023 * HS, 0.5, 2, 0.72), skin: rigid(b('head')),
        color: (p, n, uv) => uv[0] === 0 ? dark : uv[0] === 1 ? ecol : rim,
        emis: (p, uv) => E ? (uv[0] === 1 ? 4.2 : uv[0] === 0 ? 1.6 : 0) : (uv[0] === 1 ? 0.12 : 0), dtl: [0, 0, 0, 0],
      });
    }
    // ears: leaf plates, concave pale inner face, tilted back & out (Duskfang's right ear is torn)
    for (const s of [-1, 1]) {
      const torn = E && s > 0;
      const g = leafGeo(0.06 * HS, (torn ? 0.12 : 0.165) * HS, 0.03, 0.6, 0.12, { nu: 6, nv: 5, tipW: torn ? 0.02 : 0.002 });
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.28, s * 0.35, -s * 0.22, 'YXZ'));
      m.setPosition(...hx([s * 0.064, 1.112, -0.63]));
      const outer = col(c.mane), tipc = lerp3(col(c.mane), col(c.dark), 0.6), inner = col(c.earIn), rimc = col(c.mane);
      acc.add(g, {
        matrix: m, skin: rigid(b(s < 0 ? 'earL' : 'earR')), dtl: [0.28, 0, 0.1, 0],
        color: (p, n, uv) => {
          const back = uv[0] >= 1, u = (uv[0] % 1) * 2, t = uv[1];
          if (back) { const f = sstep(0.45, 0.9, t); return [mix(outer[0], tipc[0], f), mix(outer[1], tipc[1], f), mix(outer[2], tipc[2], f)]; }
          const f = Math.max(sstep(0.55, 0.85, u), sstep(0.7, 0.95, t));
          return [mix(inner[0], rimc[0], f), mix(inner[1], rimc[1], f), mix(inner[2], rimc[2], f)];
        },
      });
    }
    // teeth: fangs + small incisors
    const tooth = col(0xf2ead8), toothB = col(0xb8a888);
    const toothCol = (p, n, uv) => lerp3(toothB, tooth, uv[1]);
    for (const s of [-1, 1]) {
      acc.add(sweep(bez(hx([s * 0.028, 0.985, -0.885]), hx([s * 0.03, 0.96, -0.89]), hx([s * 0.029, 0.928, -0.88]), 4), taper(4, 0.012, 0.002), { radial: 6 }), { skin: rigid(b('head')), color: toothCol, dtl: [0, 0, 0, 0] });
      acc.add(sweep(bez(hx([s * 0.025, 0.95, -0.858]), hx([s * 0.026, 0.97, -0.861]), hx([s * 0.025, 0.99, -0.855]), 4), taper(4, 0.01, 0.002), { radial: 6 }), { skin: rigid(b('jaw')), color: toothCol, dtl: [0, 0, 0, 0] });
      for (let i = 0; i < 2; i++) {
        const z = -0.84 + i * 0.05;
        acc.add(sweep([hx([s * 0.045, 0.975, z]), hx([s * 0.046, 0.955, z])], [0.007, 0.002], { radial: 5 }), { skin: rigid(b('head')), color: toothCol, dtl: [0, 0, 0, 0] });
      }
    }
    // claws
    const claw = col(0x1e1a18);
    for (const [paw, z0] of [['fP', -0.4], ['rP', 0.335]]) for (const s of [-1, 1]) for (let i = -1; i <= 1; i++) {
      const x = s * 0.15 + i * 0.024;
      acc.add(sweep([[x, 0.03, z0 + 0.02], [x, 0.016, z0 - 0.015]], [0.009, 0.002], { radial: 5 }), { skin: rigid(b(paw + (s < 0 ? 'L' : 'R'))), color: claw, dtl: [0, 0, 0, 0] });
    }
    if (E) {
      // a broken hunter's arrow lodged in the left shoulder: splintered shaft + torn fletching
      const base = [-0.17, 0.83, -0.24], tip = [-0.33, 1.02, -0.13];
      acc.add(sweep([base, [mix(base[0], tip[0], 0.5), mix(base[1], tip[1], 0.5), mix(base[2], tip[2], 0.5)], tip], [0.011, 0.01, 0.009], { radial: 5, capStart: true }), { skin: rigid(b('chest')), color: (p, n, uv) => lerp3(col(0x3a2616), col(0x8a6a44), uv[1]), dtl: [0, 0, 0.2, 0.3] });
      for (let i = 0; i < 3; i++) {
        const g = leafGeo(0.022, 0.07, 0.004, 0.2, 0.05, { nu: 3, nv: 3, pw: 0.6 });
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(tip[0] - base[0], tip[1] - base[1], tip[2] - base[2]).normalize());
        q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 2.1));
        const m = new THREE.Matrix4().makeRotationFromQuaternion(q).setPosition(mix(base[0], tip[0], 0.72), mix(base[1], tip[1], 0.72), mix(base[2], tip[2], 0.72));
        acc.add(g, { matrix: m, skin: rigid(b('chest')), color: i === 1 ? 0x8a2a1a : 0xd8d0c0, dtl: [0, 0, 0.2, 0] });
      }
    }
  },
  sockets: {
    mouth: ['jaw', hx([0, 0.97, -0.91])], head: ['head', hx([0, 1.2, -0.66])], center: ['chest', [0, 0.78, -0.12]], chest: ['chest', [0, 0.72, -0.3]],
    back: ['body', [0, 0.98, 0.0]], tail: ['tail3', [0, 0.46, 0.98]],
  },
  height: 1.25, radius: 0.5,
  controller(inst) { const c = new QuadCtl(inst, WOLF_SPEC); prepLegs(c.gait); return c; },
  get actionList() { return ACTIONS; },
};

// ------------------------------------------------------------------------------------------------ animation
const legs = (fz, rz) => [
  { id: 'FL', chain: ['fUL', 'fLL', 'fPL'], toe: [-0.15, 0, fz], body: 'chest', scap: 0.35, lift: 0.13, flex: 1.5, out: 0.05, heel: 0.5 },
  { id: 'FR', chain: ['fUR', 'fLR', 'fPR'], toe: [0.15, 0, fz], body: 'chest', scap: 0.35, lift: 0.13, flex: 1.5, out: 0.05, heel: 0.5 },
  { id: 'RL', chain: ['rTL', 'rSL', 'rML', 'rPL'], toe: [-0.15, 0, rz], body: 'hips', scap: 0.3, lift: 0.12, flex: 0.9, out: 0.1, metaK: 1.1, heel: 0.35 },
  { id: 'RR', chain: ['rTR', 'rSR', 'rMR', 'rPR'], toe: [0.15, 0, rz], body: 'hips', scap: 0.3, lift: 0.12, flex: 0.9, out: 0.1, metaK: 1.1, heel: 0.35 },
];

const HOWL = { dur: 3.4, a: 0.12, d: 0.88, fn(ctl, a, w) { // head thrown back, long wavering howl
  const P = ctl.pose, b = ctl.b, t = a.t;
  const up = sstep(0, 0.6, t) * (1 - sstep(2.9, 3.4, t)) * w;
  P.move(b.body, 0, 0.02 * up, 0.04 * up);
  P.rx(b.body, 0.12 * up); P.rx(b.chest, 0.08 * up);
  P.rx(b.neck, 0.55 * up); P.rx(b.head, 0.5 * up + Math.sin(t * 5) * 0.03 * up);
  ctl.jaw = Math.max(ctl.jaw, (0.28 + 0.06 * Math.sin(t * 7) + 0.04 * Math.sin(t * 2.3)) * up * sstep(0.4, 0.7, t));
  ctl.ear = mix(ctl.ear, 0.9, up);
  for (let i = 0; i < b.tail.length; i++) P.rx(b.tail[i], 0.1 * up);
  ctl.glow = mix(ctl.glow, 1.6, up);
} };

const ACTIONS = {
  attack: { dur: 0.7, a: 0.12, d: 0.75, hit: 0.45, fn(ctl, a, w) { // lunge bite
    const P = ctl.pose, b = ctl.b, k = a.k;
    const wind = sstep(0, 0.3, k) * (1 - sstep(0.3, 0.45, k));
    const lunge = sstep(0.28, 0.45, k) * (1 - sstep(0.6, 1, k));
    P.move(b.body, 0, (-0.03 * wind - 0.04 * lunge) * w, (0.06 * wind - 0.24 * lunge) * w);
    P.rx(b.body, (0.06 * wind - 0.08 * lunge) * w);
    P.rx(b.neck, (0.25 * wind - 0.22 * lunge) * w);
    P.rot(b.head, (0.2 * wind - 0.15 * lunge) * w, 0, 0.25 * lunge * Math.sin(k * 30) * w);
    const open = sstep(0.1, 0.4, k) * (1 - sstep(0.46, 0.52, k));
    ctl.jaw = Math.max(ctl.jaw, 0.7 * open * w);
    ctl.ear = mix(ctl.ear, 1, w); ctl.hackle = Math.max(ctl.hackle, w);
  } },
  attack2: { dur: 0.95, a: 0.08, d: 0.8, hit: 0.36, fn(ctl, a, w) { // snap + savage tearing head-shake
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const wind = sstep(0, 0.22, k) * (1 - sstep(0.24, 0.36, k));
    const bite = sstep(0.24, 0.36, k) * (1 - sstep(0.75, 1, k));
    const shake = sstep(0.36, 0.42, k) * (1 - sstep(0.66, 0.78, k));
    const pull = sstep(0.45, 0.7, k) * (1 - sstep(0.8, 1, k));
    const f = Math.sin(t * 34);
    P.move(b.body, 0, (-0.03 * wind - 0.05 * bite) * w, (0.05 * wind - 0.2 * bite + 0.12 * pull) * w);
    P.rot(b.body, (0.05 * wind - 0.1 * bite) * w, 0.08 * f * shake * w, 0.06 * f * shake * w);
    P.rot(b.neck, (0.2 * wind - 0.25 * bite + 0.1 * pull) * w, 0.35 * f * shake * w, 0);
    P.rot(b.head, (0.15 * wind - 0.1 * bite) * w, 0.25 * f * shake * w, 0.4 * f * shake * w);
    ctl.jaw = Math.max(ctl.jaw, (0.75 * wind * sstep(0.05, 0.2, k) + 0.12 * bite) * w);
    ctl.ear = mix(ctl.ear, 1.1, w); ctl.hackle = Math.max(ctl.hackle, w);
    for (let i = 0; i < b.tail.length; i++) P.ry(b.tail[i], 0.15 * f * shake * w);
  } },
  attack_big: { dur: 1.6, a: 0.05, d: 0.88, hit: 0.62, fn(ctl, a, w) { // stalk-crouch + butt-wiggle (telegraph) → leaping maul
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const crouch = sstep(0, 0.22, k) * (1 - sstep(0.44, 0.5, k));
    const wig = sstep(0.18, 0.28, k) * (1 - sstep(0.4, 0.46, k)) * Math.sin(t * 26);
    const air = clamp01((k - 0.46) / 0.16), inAir = k > 0.46 && k < 0.64 ? 1 : 0;
    const h = Math.sin(air * Math.PI) * inAir;
    const fwd = sstep(0.46, 0.62, k) * (1 - sstep(0.72, 1, k));
    const land = sstep(0.6, 0.64, k) * (1 - sstep(0.7, 0.85, k));
    P.move(b.body, 0, (-0.2 * crouch + 0.3 * h - 0.07 * land) * w, (0.1 * crouch - 0.62 * fwd) * w);
    P.rot(b.body, (-0.1 * crouch + 0.25 * h - 0.12 * land) * w, 0, 0);
    P.rot(b.hips, 0, 0.12 * wig * w, 0.06 * wig * w);
    P.rot(b.neck, (-0.3 * crouch - 0.05 * h + 0.2 * land) * w, 0, 0);
    P.rx(b.head, (0.3 * crouch + 0.05 * h - 0.15 * land) * w);
    ctl.jaw = Math.max(ctl.jaw, (0.3 * crouch + 0.85 * sstep(0.46, 0.56, k) * (1 - sstep(0.62, 0.68, k))) * w);
    ctl.hackle = Math.max(ctl.hackle, w); ctl.ear = mix(ctl.ear, 1.3, w);
    ctl.charge = Math.max(ctl.charge, sstep(0.05, 0.4, k) * (1 - sstep(0.46, 0.52, k)) * w);
    for (let i = 0; i < b.tail.length; i++) P.rot(b.tail[i], (0.12 * crouch - 0.15 * h) * w, 0.2 * wig * w, 0);
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) {
      const L = G[i];
      if (L.id[0] === 'F') ov(L, L.toe.x, 0.28 * h, L.toe.z - 0.22 * h, h * w, true, -0.5);
      else ov(L, L.toe.x, 0.12 * h, L.toe.z + 0.15 * h, h * 0.85 * w, true, -0.3);
    }
  } },
  roar: { dur: 1.3, a: 0.1, d: 0.85, fn(ctl, a, w) { // snarl: head low, lips peeled back, two sharp barks
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const snarl = sstep(0, 0.2, k) * (1 - sstep(0.85, 1, k));
    const bark = Math.pow(Math.max(0, Math.sin(clamp01((k - 0.3) / 0.5) * Math.PI * 2)), 3) * (k > 0.3 && k < 0.8 ? 1 : 0);
    P.move(b.body, 0, -0.04 * snarl * w, (0.04 * snarl - 0.05 * bark) * w);
    P.rx(b.body, -0.04 * snarl * w);
    P.rx(b.neck, (-0.28 * snarl + 0.25 * bark) * w); P.rot(b.head, (0.3 * snarl - 0.2 * bark + Math.sin(t * 40) * 0.015 * snarl) * w, 0, 0);
    ctl.jaw = Math.max(ctl.jaw, (0.3 * snarl + 0.45 * bark) * w);
    ctl.hackle = Math.max(ctl.hackle, snarl * w); ctl.ear = mix(ctl.ear, 1.4, snarl * w);
  } },
  howl: HOWL,
  cast: HOWL, // pack call
  idle_alt: { dur: 2.4, a: 0.2, d: 0.8, fn(ctl, a, w) { // sniff the ground
    const P = ctl.pose, b = ctl.b, t = a.t;
    P.rx(b.neck, -0.55 * w); P.rot(b.head, -0.25 * w + Math.sin(t * 18) * 0.02 * w, Math.sin(t * 1.3) * 0.25 * w, 0);
    P.rx(b.chest, -0.06 * w);
  } },
  yawn: { dur: 2.0, a: 0.25, d: 0.75, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k;
    const o = bell(clamp01((k - 0.15) / 0.7));
    P.rx(b.neck, 0.2 * o * w); P.rot(b.head, 0.35 * o * w, 0, 0.1 * o * w);
    ctl.jaw = Math.max(ctl.jaw, 0.7 * o * w); ctl.ear = mix(ctl.ear, 0.8, o * w);
  } },
  scratch: { dur: 2.6, a: 0.18, d: 0.82, fn(ctl, a, w) { // sit back on the haunches and scratch behind the ear with a hind paw
    const P = ctl.pose, b = ctl.b, t = a.t;
    P.move(b.body, 0, -0.16 * w, 0.06 * w); P.rot(b.body, 0.42 * w, 0, -0.12 * w); P.rx(b.hips, 0.2 * w);
    P.rot(b.neck, -0.15 * w, -0.35 * w, 0.35 * w); P.rot(b.head, 0.1 * w, -0.3 * w, 0.5 * w);
    ctl.ear = mix(ctl.ear, 0.3, w); ctl.jaw = Math.max(ctl.jaw, 0.12 * w);
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) {
      const L = G[i];
      if (L.id === 'RR') { const f = Math.sin(t * 26) * 0.035; ov(L, 0.2, 0.86 + f, -0.3 + f * 0.8, w, true, -0.8, 0.6); }
      else if (L.id === 'RL') ov(L, L.toe.x * 1.2, 0, 0.14, w, false, 0, 1.3);
    }
  } },
  shake: { dur: 2.2, a: 0.15, d: 0.85, fn(ctl, a, w) { // shake-off: whole-body shiver from head to tail
    const P = ctl.pose, b = ctl.b, t = a.t, k = a.k;
    const s = bell(clamp01((k - 0.1) / 0.8)) * w;
    const f = Math.sin(t * 28);
    P.rot(b.chest, 0, 0, f * 0.12 * s); P.rot(b.neck, 0, f * 0.25 * s, f * 0.2 * s); P.rot(b.head, 0, f * 0.3 * s, f * 0.3 * s);
    P.rot(b.hips, 0, 0, -Math.sin(t * 28 - 1) * 0.1 * s);
    ctl.ear = mix(ctl.ear, 0.6 + f * 0.4, s);
  } },
  sit: { dur: 1, hold: true, rest: true, fadeIn: 0.6, fadeOut: 0.4, fn(ctl, a, w) { // haunches down, chest up, front legs straight
    const P = ctl.pose, b = ctl.b;
    P.move(b.body, 0, -0.3 * w, 0.1 * w);
    P.rx(b.body, 0.72 * w); P.rx(b.hips, 0.25 * w); P.rx(b.chest, -0.1 * w);
    P.rx(b.neck, -0.45 * w); P.rx(b.head, -0.2 * w);
    P.rot(b.tail[0], 0.9 * w, 0.3 * w, 0); P.rot(b.tail[1], -0.4 * w, 0.5 * w, 0); P.rot(b.tail[2], -0.3 * w, 0.5 * w, 0);
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) {
      const L = G[i];
      if (L.id[0] === 'R') ov(L, L.toe.x * 1.25, 0, 0.1, w, false, 0, 1.35);
      else ov(L, L.toe.x * 0.9, 0, -0.28, w, false, 0);
    }
  } },
  sleep: { dur: 1, hold: true, rest: true, fadeIn: 1.2, fadeOut: 0.6, fn(ctl, a, w) { // sphinx curl: belly down, head on paws, tail wrapped
    const P = ctl.pose, b = ctl.b, t = a.t;
    const br = Math.sin(t * 1.4) * 0.01;
    P.move(b.body, 0, (-0.5 + br) * w, 0.02 * w);
    P.rot(b.body, 0.02 * w, 0.12 * w, 0.18 * w);
    P.rot(b.neck, -0.55 * w, 0.35 * w, 0.1 * w); P.rot(b.head, 0.15 * w, 0.25 * w, 0.15 * w);
    for (let i = 0; i < b.tail.length; i++) P.rot(b.tail[i], 0.25 * w, -0.55 * w, 0);
    ctl.ear = mix(ctl.ear, 0.6, w); ctl.hackle *= 1 - w;
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) {
      const L = G[i], s = L.side;
      if (L.id[0] === 'F') ov(L, s * 0.1 - 0.06, 0, -0.62 + (s > 0 ? 0.05 : 0), w, false, 0);
      else ov(L, s * 0.26 + 0.05, 0, 0.12, w, false, -0.4, 1.4);
    }
  } },
  hit: qHit(),
  knockback: qKnockback(),
  ...sidePair(qKnockdown({ lieY: 0.24 }), qGetup({ lieY: 0.24 }), qDeath({ lieY: 0.22, dist: 1.2, peak: 0.4 })),
  stun: qStun(),
  spawn: qSpawn({ depth: 1.15 }),
};

const WOLF_SPEC = {
  bones: { body: 'body', hips: 'hips', chest: 'chest', neck: 'neck', head: 'head', jaw: 'jaw', tail: ['tail1', 'tail2', 'tail3'], ears: ['earL', 'earR'] },
  gait: {
    legs: legs(-0.39, 0.37),
    maxStride: 0.75,
    gaits: [
      { v: 1.3, f: 1.55, duty: 0.62, lift: 0.8, off: { RL: 0, FL: 0.25, RR: 0.5, FR: 0.75 }, bob: 0.012, bobF: 2, bobPh: 0.1, roll: 0.025, rollF: 1, sway: 0.01, swayF: 1, nod: 0.035, nodF: 2, nodPh: 0.3 },
      { v: 3.2, f: 2.3, duty: 0.44, lift: 1, off: { FL: 0, RR: 0, FR: 0.5, RL: 0.5 }, bob: 0.025, bobF: 2, bobPh: 0.35, roll: 0.02, rollF: 1, nod: 0.03, nodF: 2, nodPh: 0.5, pitch: 0.012, pitchF: 2 },
      { v: 7.5, f: 2.9, duty: 0.27, lift: 1.25, off: { RL: 0, RR: 0.1, FR: 0.42, FL: 0.52 }, bob: 0.06, bobF: 1, bobPh: 0.62, pitch: 0.11, pitchF: 1, pitchPh: 0.05, flex: 0.16, flexF: 1, flexPh: 0.2, nod: 0.05, nodF: 1, nodPh: 0.8, lean: 0.05 },
    ],
  },
  neck: { pitch: 0, run: -0.3, combat: -0.38, walk: -0.06, headCombat: 0.2, comp: 0.55 },
  tail: { wag: 0.22, wagF: 0.5, run: 0.55, combat: 0.35 },
  combatCrouch: 0.07, combatPitch: -0.06, runDrop: 0.05, chargeK: 0.35,
  fidgets: [{ name: 'idle_alt', w: 3 }, { name: 'yawn', w: 1 }, { name: 'scratch', w: 1 }, { name: 'shake', w: 1 }],
  fidgetGap: 5,
  pose(ctl) {
    cancelRestOnMove(ctl);
    // pant when running / fighting; combat: snarl stance, feet wider; the alpha's eyes smoulder
    ctl.jaw += (0.1 + 0.05 * Math.sin(ctl.t * 14)) * ctl.run + ctl.combat * (0.12 + 0.03 * Math.sin(ctl.t * 9));
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) { const L = G[i]; L.homeOff.set(L.side * 0.03 * ctl.combat, 0, (L.id[0] === 'F' ? -0.05 : 0.02) * ctl.combat); }
    ctl.glow *= 1 + 0.12 * Math.sin(ctl.t * 2.3) + 0.35 * ctl.combat;
  },
  actions: ACTIONS,
};
