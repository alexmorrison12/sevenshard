// Goldmeadow boar (adapted from Everdawn's bristleback): barrel body under a hunched bristle-maned hump, wedge head with
// a pink snout, big up-curving tusks, stubby legs, curly tail, faint piglet stripes. Variants bristleback (default) /
// dusky; elite "Gnarltusk" — the old tusker (×1.5): frost-grey mane, one massive notched tusk and one snapped stump,
// scar-latticed hide, burning ember eyes and a hunter's broken spears still stuck in its hump.
import * as THREE from 'three';
import { QuadCtl } from '../ctl.js';
import { qHit, qKnockback, qKnockdown, qGetup, qDeath, qStun, qSpawn, retime } from '../acts.js';
import { leafGeo, rigid, sweep } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addEye, addSpikes, addHorn, lerp3 } from '../../kit/parts.js';
import { sstep, clamp01, mix, bell } from '../../kit/rig.js';
import { ov, cancelRestOnMove, prepLegs, surfaceCrack } from './util.js';

const PAL = {
  bristleback: { base: 0x7c4a30, dark: 0x3a1f14, belly: 0xc08e70, stripe: 0xd2a476, snout: 0xc98676, nose: 0xe0a092, hoof: 0x2a1e1a, mane: 0x22120c, maneTip: 0x5e3a26, tusk: 0xf4e8cc, eye: 0x1a0c08, glow: 0xff5a1a },
  dusky: { base: 0x5c5450, dark: 0x262220, belly: 0x9a8c84, stripe: 0xb4a698, snout: 0xa88480, nose: 0xc89a94, hoof: 0x1e1a18, mane: 0x1a1614, maneTip: 0x6a625c, tusk: 0xeee4cc, eye: 0x100808, glow: 0xff5a1a },
  gnarltusk: { base: 0x4e3426, dark: 0x1e120c, belly: 0x8a6a56, stripe: 0x9a7a5a, snout: 0xa46e62, nose: 0xc0887c, hoof: 0x141010, mane: 0x2a2624, maneTip: 0xd8d4cc, tusk: 0xfff2d6, eye: 0xff7a1a, scar: 0xc0908a, glow: 0xff6a1a },
};

export const boar = {
  name: 'Boar',
  variants: ['bristleback', 'dusky', 'gnarltusk'],
  config(variant, opts = {}) {
    const v = PAL[variant] ? variant : (opts.elite ? 'gnarltusk' : 'bristleback');
    const elite = v === 'gnarltusk' || !!opts.elite;
    return { variant: elite ? 'gnarltusk' : v, pal: PAL[elite ? 'gnarltusk' : v], elite, shapeKey: elite ? 'elite' : 'base', scale: elite ? 1.5 : 1, h: elite ? 0.037 : 0.044, hg: { 1: 0.03 }, mat: { dfreq: 3.2, rim: 0.3, rimColor: 0xffe8cc } };
  },
  rig(R) {
    R.add('body', null, [0, 0.6, 0.0]);
    R.add('hips', 'body', [0, 0.58, 0.34]);
    R.add('chest', 'body', [0, 0.62, -0.26]);
    R.add('neck', 'chest', [0, 0.64, -0.44]);
    R.add('head', 'neck', [0, 0.62, -0.55]);
    R.add('jaw', 'head', [0, 0.5, -0.6]);
    R.add('earL', 'head', [-0.1, 0.76, -0.56]); R.add('earR', 'head', [0.1, 0.76, -0.56]);
    R.add('tail1', 'hips', [0, 0.65, 0.45]); R.add('tail2', 'tail1', [0, 0.6, 0.54]);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('fU' + n, 'chest', [0.15 * s, 0.5, -0.3]); R.add('fL' + n, 'fU' + n, [0.155 * s, 0.31, -0.2]); R.add('fP' + n, 'fL' + n, [0.155 * s, 0.11, -0.29]);
      R.add('rT' + n, 'hips', [0.14 * s, 0.56, 0.36]); R.add('rS' + n, 'rT' + n, [0.15 * s, 0.36, 0.26]); R.add('rM' + n, 'rS' + n, [0.15 * s, 0.19, 0.38]); R.add('rP' + n, 'rM' + n, [0.15 * s, 0.07, 0.35]);
    }
  },
  sculpt(S, cfg) {
    const c = cfg.pal, E = cfg.elite;
    const hair = [0.5, 0, 0.2, 0], skin = [0.05, 0.05, 0.2, 0], hoofD = [0, 0, 0.15, 0.2];
    // front-heavy: big hunched shoulders, deep chest, a slimmer rump
    S.ell('body', [0, 0.53, 0.02], [0.25, 0.24, 0.36], { k: 0.1, col: c.base, tag: 'body', dtl: hair });
    S.ell('chest', [0, 0.76, -0.2], [0.24, 0.28 * (E ? 1.08 : 1), 0.27], { k: 0.1, col: c.base, tag: 'hump', dtl: hair });
    S.ell('chest', [0, 0.55, -0.32], [0.21, 0.23, 0.18], { k: 0.09, col: c.base, tag: 'body', dtl: hair });
    S.ell('hips', [0, 0.57, 0.28], [0.18, 0.18, 0.17], { k: 0.09, col: c.base, tag: 'body', dtl: hair });
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      S.ell('rT' + n, [s * 0.13, 0.48, 0.34], [0.1, 0.16, 0.13], { k: 0.08, col: c.base, tag: 'ham', rot: [0.2, 0, 0], dtl: hair });
      S.ell('fU' + n, [s * 0.15, 0.47, -0.28], [0.09, 0.14, 0.11], { k: 0.08, col: c.base, tag: 'shoulder', dtl: hair });
    }
    // neck + wedge head
    S.cone('neck', [0, 0.64, -0.34], [0, 0.63, -0.52], 0.2, 0.16, { k: 0.08, col: c.base, b2: 'head', t0: 0.5, t1: 1, dtl: hair });
    S.ell('head', [0, 0.63, -0.6], [0.16, 0.165, 0.18], { k: 0.07, col: c.base, tag: 'head', dtl: hair });
    S.ell('head', [0, 0.705, -0.65], [0.12, 0.07, 0.11], { k: 0.05, col: c.dark, tag: 'brow', dtl: hair });
    for (const s of [-1, 1]) S.ell('head', [s * 0.1, 0.53, -0.66], [0.072, 0.085, 0.1], { k: 0.05, col: c.base, tag: 'jowl', dtl: hair });
    S.cone('head', [0, 0.575, -0.7], [0, 0.505, -0.86], 0.115, 0.082, { k: 0.05, col: c.snout, tag: 'snout', dtl: skin });
    S.ell('head', [0, 0.495, -0.9], [0.088, 0.074, 0.034], { k: 0.028, col: c.nose, tag: 'nose', rot: [-0.4, 0, 0], dtl: skin, soft: 0.006 });
    for (const s of [-1, 1]) S.sph('head', [s * 0.03, 0.49, -0.93], 0.017, { k: 0.01, sub: true, col: 0x3a1a18, tag: 'nostril' });
    S.cone('head', [0, 0.5, -0.68], [0, 0.49, -0.86], 0.02, 0.012, { k: 0.012, sub: true, col: 0x2a1212, tag: 'mouth' });
    // lower jaw
    S.cone('jaw', [0, 0.49, -0.62], [0, 0.462, -0.83], 0.07, 0.045, { group: 1, k: 0.03, col: c.snout, tag: 'jaw', dtl: skin });
    // dorsal crest (SDF ridge; bristles added as parts)
    for (let i = 0; i < 7; i++) {
      const t = i / 6, z = -0.58 + t * 0.6, y = 0.8 + Math.sin(t * Math.PI) * 0.14 * (E ? 1.15 : 1) - t * 0.06;
      S.cone(i < 2 ? 'head' : i < 5 ? 'chest' : 'body', [0, y - 0.07, z], [0, y + 0.03, z + 0.1], 0.08, 0.03, { k: 0.05, col: c.mane, tag: 'mane', dtl: hair });
    }
    // legs: short, thick above, trim below, dark hooves
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      S.cone('fU' + n, [s * 0.15, 0.5, -0.3], [s * 0.155, 0.31, -0.2], 0.075, 0.055, { k: 0.05, col: c.base, b2: 'fL' + n, t0: 0.75, t1: 1, dtl: hair });
      S.cone('fL' + n, [s * 0.155, 0.31, -0.2], [s * 0.155, 0.11, -0.29], 0.05, 0.034, { k: 0.035, col: c.base, tag: 'leg', b2: 'fP' + n, t0: 0.85, t1: 1, dtl: hair });
      S.cone('fP' + n, [s * 0.155, 0.11, -0.29], [s * 0.155, 0.045, -0.32], 0.034, 0.036, { k: 0.025, col: c.dark, tag: 'leg', dtl: hair });
      S.box('fP' + n, [s * 0.155, 0.035, -0.325], [0.042, 0.035, 0.048], 0.016, { k: 0.015, col: c.hoof, tag: 'hoof', rot: [-0.25, 0, 0], dtl: hoofD, soft: 0.004 });
      S.cone('rT' + n, [s * 0.14, 0.56, 0.36], [s * 0.15, 0.36, 0.26], 0.085, 0.058, { k: 0.05, col: c.base, b2: 'rS' + n, t0: 0.8, t1: 1, dtl: hair });
      S.cone('rS' + n, [s * 0.15, 0.36, 0.26], [s * 0.15, 0.19, 0.38], 0.055, 0.036, { k: 0.035, col: c.base, tag: 'leg', b2: 'rM' + n, t0: 0.85, t1: 1, dtl: hair });
      S.cone('rM' + n, [s * 0.15, 0.19, 0.38], [s * 0.15, 0.07, 0.35], 0.035, 0.034, { k: 0.025, col: c.dark, tag: 'leg', b2: 'rP' + n, t0: 0.8, t1: 1, dtl: hair });
      S.box('rP' + n, [s * 0.15, 0.035, 0.325], [0.04, 0.035, 0.046], 0.016, { k: 0.015, col: c.hoof, tag: 'hoof', rot: [-0.25, 0, 0], dtl: hoofD, soft: 0.004 });
    }
    // curly tail
    S.cone('tail1', [0, 0.65, 0.4], [0, 0.63, 0.52], 0.028, 0.02, { k: 0.02, col: c.base, tag: 'tail', b2: 'tail2', dtl: hair });
    S.cone('tail2', [0, 0.63, 0.52], [0.03, 0.58, 0.56], 0.02, 0.013, { k: 0.015, col: c.base, tag: 'tail', dtl: hair });
    S.ell('tail2', [0.04, 0.55, 0.57], [0.028, 0.045, 0.028], { k: 0.015, col: c.dark, tag: 'tail', dtl: hair });
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, y, z] = v.p, [nx, ny, nz] = v.n;
    const jag = Math.sin(z * 40 + x * 10) * 0.5 + Math.sin(z * 67 + y * 30) * 0.3;
    // darker back, pale belly
    v.mix(c.dark, sstep(0.3, 0.8, ny + jag * 0.1) * sstep(0.6, 0.75, y) * 0.55 * (1 - v.t('snout') - v.t('nose')));
    v.mix(c.belly, sstep(-0.1, -0.6, ny + jag * 0.1) * (1 - v.t('snout') - v.t('jaw')) * 0.85);
    // faint stripes along the flanks
    const side = sstep(0.35, 0.75, Math.abs(nx));
    const band = sstep(0.62, 0.86, Math.sin(y * 58 + Math.sin(z * 9) * 0.8 + 1.3));
    const strip = side * band * sstep(0.42, 0.5, y) * (1 - sstep(0.76, 0.82, y)) * sstep(-0.45, -0.3, z) * (1 - sstep(0.3, 0.42, z));
    v.mix(c.stripe, strip * 0.32 * (1 - v.t('head') - v.t('snout')));
    // snout gradient to pink nose, dark mouth
    v.mix(c.nose, v.t('nose') * 0.9);
    v.mix(0x2a1010, Math.max(v.t('nostril'), v.t('mouth')) * 0.9);
    if (v.group === 1 && ny > 0.4) v.mix(0x6a2626, 0.7);
    // hoof tops darker, legs darker toward the bottom
    v.mix(c.dark, v.t('leg') * sstep(0.2, 0.05, y) * 0.5);
    if (cfg.elite) {
      // frosted jowls & brow (the scars are crisp ribbons, see parts)
      v.mix(0xb8aea4, v.t('jowl') * 0.4 + v.t('brow') * 0.25);
    }
    v.mul(1 + Math.sin(x * 11 + z * 7) * Math.sin(y * 9) * 0.05);
    v.fx = v.t('mane') * sstep(0.7, 0.9, y);
    if (v.t('hoof') > 0.5) v.dtl[0] = 0;
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n), E = cfg.elite;
    for (const s of [-1, 1]) {
      addEye(acc, S, b('head'), [s * 0.1, 0.64, -0.72], [s * 0.8, 0.12, -1], 0.018, { iris: c.eye, pupil: 0x050303, irisA: E ? 0.9 : 0, pupilA: 0.7, glow: E ? 3.2 : 0, seg: 10 });
      // ears: small leaf plates, pink inside
      const g = leafGeo(0.06, 0.11, 0.03, 0.5, 0.25, { nu: 5, nv: 4 });
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.5, s * 0.6, -s * 0.55, 'YXZ'));
      m.setPosition(s * 0.1, 0.74, -0.56);
      const outer = col(c.base), inner = col(c.nose);
      acc.add(g, { matrix: m, skin: rigid(b(s < 0 ? 'earL' : 'earR')), dtl: [0.2, 0, 0.1, 0], color: (p, n, uv) => uv[0] >= 1 ? outer : (uv[0] % 1) * 2 > 0.6 ? outer : inner });
      // tusks: big curving ivory from the lower jaw (the elite's right one is snapped off)
      const T = E ? (s < 0 ? 1.9 : 0.55) : 1.3;
      addHorn(acc, b('jaw'), [s * 0.05, 0.47, -0.76], [s * (0.07 + 0.06 * T), 0.47 + 0.02 * T, -0.8 - 0.05 * T], [s * (0.08 + 0.07 * T), 0.5 + 0.13 * T, -0.79 - 0.03 * T], 0.032 * Math.sqrt(Math.max(T, 1.3)), E && s > 0 ? 0.026 : 0.004, { base: 0x9a8062, tip: c.tusk, radial: 7, n: 6 });
    }
    // bristles along the crest (stand up when charging / in combat)
    const list = [];
    const n = E ? 36 : 30;
    const hs = (i) => { const q = Math.sin(i * 91.7 + 13.1) * 43758.5; return q - Math.floor(q); };
    for (let i = 0; i < n; i++) { // two rows of long bristles along the crest, longest over the shoulders
      const t = (i >> 1) / ((n >> 1) - 1), side = i & 1 ? 1 : -1;
      const z = -0.62 + t * 0.8, y = 0.88 + Math.sin(t * Math.PI) * 0.15 * (E ? 1.15 : 1);
      const x = side * (0.025 + 0.03 * hs(i));
      const L = (0.12 + 0.14 * Math.sin(Math.min(1, t * 1.3) * Math.PI)) * (0.8 + 0.4 * hs(i + 50)) * (E ? 1.3 : 1);
      list.push({ p: [x, y + 0.04, z], dir: [side * (0.35 + 0.3 * hs(i + 9)), 0.8 - t * 0.25 + (hs(i + 3) - 0.5) * 0.25, 0.55 + t * 0.35], len: L, r: 0.016 + 0.006 * hs(i + 7) });
    }
    addSpikes(acc, S, list, { base: c.mane, tip: c.maneTip, radial: 4, hackle: 1, bend: 0.3 });
    const tufts = []; // whiskery cheek tufts sweeping back off the jowls
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) tufts.push({ p: [s * 0.16, 0.56 - i * 0.035, -0.62 + i * 0.03], dir: [s * 0.7, -0.25 - i * 0.1, 0.65], len: 0.1 + 0.02 * i, r: 0.014 });
    addSpikes(acc, S, tufts, { base: c.base, tip: c.belly, radial: 3, bend: 0.2 });
    if (E) {
      // old gashes across both flanks and the right shoulder
      const sc = { core: c.scar, edge: 0x4a2a24, emis: 0, lift: 0.006, n: 8 };
      surfaceCrack(acc, S, [[0.26, 0.72, -0.34], [0.28, 0.62, -0.24], [0.27, 0.52, -0.12]], { ...sc, width: 0.02, seed: 1 });
      surfaceCrack(acc, S, [[0.25, 0.74, -0.22], [0.28, 0.64, -0.12], [0.27, 0.55, -0.02]], { ...sc, width: 0.016, seed: 2 });
      surfaceCrack(acc, S, [[-0.26, 0.68, -0.1], [-0.27, 0.6, 0.04], [-0.24, 0.52, 0.16]], { ...sc, width: 0.02, seed: 3 });
      surfaceCrack(acc, S, [[-0.2, 0.78, -0.4], [-0.25, 0.66, -0.36], [-0.25, 0.54, -0.3]], { ...sc, width: 0.014, seed: 4 });
      // broken hunters' spears stuck in the hump
      const spear = (p, d, L, bone) => {
        const q = [p[0] + d[0] * L, p[1] + d[1] * L, p[2] + d[2] * L];
        acc.add(sweep([p, q], [0.014, 0.012], { radial: 5, capStart: true }), { skin: rigid(b(bone)), color: (pp, nn, uv) => lerp3(col(0x3a2818), col(0x7a5a3a), uv[1]), dtl: [0, 0, 0.2, 0.35] });
        acc.add(sweep([q, [q[0] + d[0] * 0.03, q[1] + d[1] * 0.03 - 0.01, q[2] + d[2] * 0.03]], [0.016, 0.004], { radial: 4 }), { skin: rigid(b(bone)), color: 0xd8cfc0, dtl: [0, 0, 0.1, 0] });
      };
      spear([0.12, 0.84, -0.2], [0.55, 0.8, 0.25], 0.32, 'chest');
      spear([-0.1, 0.8, 0.02], [-0.6, 0.75, 0.3], 0.26, 'body');
    }
  },
  sockets: { mouth: ['jaw', [0, 0.45, -0.9]], head: ['head', [0, 0.8, -0.6]], center: ['body', [0, 0.6, -0.05]], chest: ['chest', [0, 0.55, -0.4]], back: ['body', [0, 0.85, 0]] },
  height: 0.95, radius: 0.5,
  controller(inst) { const c = new QuadCtl(inst, BOAR_SPEC); prepLegs(c.gait); return c; },
  get actionList() { return ACTIONS; },
};

// ------------------------------------------------------------------------------------------------ animation
/** hoof scrape (front-right) at phase sc (0..1): quick forward lift, then a hard backward drag */
function scrape(ctl, sc, w) {
  const L = ctl.gait.legs[1];
  const up = sc < 0.35;
  const fwd = up ? sc / 0.35 : 1 - (sc - 0.35) / 0.65;
  ov(L, L.home.x, up ? Math.sin(sc / 0.35 * Math.PI) * 0.09 : 0.004, L.home.z - 0.13 * fwd + 0.09, w, false, up ? -0.6 : 0.2);
}

const ACTIONS = {
  attack: { dur: 0.9, a: 0.1, d: 0.78, hit: 0.5, fn(ctl, a, w) { // tusk gore: dip, then rip upward with a twist (hit = game windup 0.45 / 0.9 s)
    const P = ctl.pose, b = ctl.b, k = retime(a.k, 0.42, 0.5);
    const dip = sstep(0, 0.3, k) * (1 - sstep(0.3, 0.45, k));
    const rip = sstep(0.3, 0.48, k) * (1 - sstep(0.6, 1, k));
    P.move(b.body, 0, -0.04 * dip * w, (0.05 * dip - 0.2 * rip) * w);
    P.rx(b.body, (-0.08 * dip + 0.06 * rip) * w);
    P.rx(b.neck, (-0.3 * dip + 0.3 * rip) * w);
    P.rot(b.head, (-0.25 * dip + 0.45 * rip) * w, 0, 0.35 * rip * w);
    ctl.jaw = Math.max(ctl.jaw, 0.25 * rip * w);
    ctl.hackle = Math.max(ctl.hackle, w);
  } },
  attack2: { dur: 0.9, a: 0.08, d: 0.8, hit: 0.46, fn(ctl, a, w) { // tusk hook: cock the head right, rip across to the left
    const P = ctl.pose, b = ctl.b, k = a.k;
    const cock = sstep(0, 0.34, k) * (1 - sstep(0.36, 0.48, k));
    const hook = sstep(0.36, 0.5, k) * (1 - sstep(0.62, 1, k));
    P.move(b.body, 0.03 * (cock - hook) * w, -0.03 * cock * w, (0.03 * cock - 0.12 * hook) * w);
    P.rot(b.body, -0.05 * cock * w, (0.12 * cock - 0.18 * hook) * w, (0.05 * cock - 0.08 * hook) * w);
    P.rot(b.neck, (-0.2 * cock + 0.1 * hook) * w, (0.45 * cock - 0.6 * hook) * w, 0);
    P.rot(b.head, (-0.15 * cock + 0.25 * hook) * w, (0.2 * cock - 0.3 * hook) * w, (-0.35 * cock + 0.5 * hook) * w);
    ctl.jaw = Math.max(ctl.jaw, 0.3 * hook * w); ctl.hackle = Math.max(ctl.hackle, w);
  } },
  attack_big: { dur: 2.1, a: 0.06, d: 0.9, hit: 0.72, fn(ctl, a, w) { // CHARGE: two hoof scrapes + snort (telegraph) → explosive lunge & gore
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const low = sstep(0, 0.12, k) * (1 - sstep(0.62, 0.66, k));
    const coil = sstep(0.52, 0.64, k) * (1 - sstep(0.64, 0.68, k));
    const lunge = sstep(0.64, 0.72, k) * (1 - sstep(0.82, 1, k));
    const toss = sstep(0.69, 0.76, k) * (1 - sstep(0.84, 1, k));
    const shake = Math.sin(t * 22) * 0.04 * low * (1 - coil);
    P.move(b.body, 0, (-0.05 * low - 0.05 * coil - 0.02 * lunge) * w, (0.09 * coil - 0.55 * lunge) * w);
    P.rot(b.body, (-0.06 * low - 0.06 * coil - 0.05 * lunge + 0.08 * toss) * w, 0, 0);
    P.rx(b.neck, (-0.32 * low - 0.1 * lunge + 0.3 * toss) * w);
    P.rot(b.head, (-0.12 * low + shake + 0.55 * toss) * w, 0, 0.3 * toss * w);
    // scrape the ground twice with the right fore hoof
    const sc = k > 0.08 && k < 0.5 ? ((k - 0.08) % 0.21) / 0.21 : -1;
    if (sc >= 0) scrape(ctl, sc, w * low);
    // snort between the scrapes
    const sn = Math.pow(Math.max(0, Math.sin(clamp01((k - 0.28) / 0.08) * Math.PI)), 2) + Math.pow(Math.max(0, Math.sin(clamp01((k - 0.49) / 0.06) * Math.PI)), 2);
    P.rx(b.head, 0.12 * sn * w);
    ctl.jaw = Math.max(ctl.jaw, (0.12 * sn + 0.35 * toss) * w);
    ctl.hackle = Math.max(ctl.hackle, w); ctl.ear = mix(ctl.ear, 1.2, w);
    ctl.charge = Math.max(ctl.charge, sstep(0.05, 0.55, k) * (1 - sstep(0.64, 0.7, k)) * w);
    ctl.glow = mix(ctl.glow, 2.2, low * w);
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) { const L = G[i]; if (L.id[0] === 'R') ov(L, L.toe.x * 1.05, 0.02 * lunge, L.toe.z + 0.1 * coil - 0.05 * lunge, (coil + lunge) * 0.8 * w, true, -0.3); }
  } },
  charge: { dur: 1, loop: true, fadeIn: 0.15, fadeOut: 0.3, fn(ctl, a, w) { // head-down charge carriage (loop; pair with speed)
    const P = ctl.pose, b = ctl.b, t = a.t;
    P.rot(b.body, -0.06 * w, 0, 0); P.rx(b.neck, -0.35 * w); P.rot(b.head, (-0.15 + Math.sin(t * 25) * 0.03) * w, 0, 0);
    ctl.hackle = Math.max(ctl.hackle, w); ctl.ear = mix(ctl.ear, 1.3, w); ctl.jaw = Math.max(ctl.jaw, 0.15 * w);
  } },
  roar: { dur: 1.3, a: 0.1, d: 0.85, fn(ctl, a, w) { // squealing bellow: head up, tusks bared, forequarters bounce
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const up = sstep(0, 0.22, k) * (1 - sstep(0.8, 1, k));
    const hop = Math.max(0, Math.sin(clamp01((k - 0.1) / 0.3) * Math.PI));
    P.move(b.body, 0, 0.04 * hop * w, 0.03 * up * w);
    P.rot(b.body, (0.12 * up + 0.1 * hop) * w, 0, 0);
    P.rx(b.neck, 0.35 * up * w); P.rot(b.head, (0.4 * up + Math.sin(t * 34) * 0.03 * up) * w, 0, 0);
    ctl.jaw = Math.max(ctl.jaw, (0.55 + 0.1 * Math.sin(t * 20)) * up * w);
    ctl.hackle = Math.max(ctl.hackle, up * w); ctl.ear = mix(ctl.ear, 1.3, up * w);
    ctl.glow = mix(ctl.glow, 2, up * w);
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) { const L = G[i]; if (L.id[0] === 'F') ov(L, L.toe.x, 0.12 * hop, L.toe.z - 0.03 * hop, hop * w, true, -0.3); }
  } },
  idle_alt: { dur: 2.6, a: 0.2, d: 0.82, fn(ctl, a, w) { // root / snuffle in the dirt
    const P = ctl.pose, b = ctl.b, t = a.t;
    P.rx(b.neck, -0.35 * w); P.rot(b.head, (-0.35 + Math.sin(t * 9) * 0.06) * w, Math.sin(t * 3.1) * 0.25 * w, Math.sin(t * 5) * 0.08 * w);
    P.rx(b.chest, -0.05 * w);
  } },
  snort: { dur: 0.9, a: 0.1, d: 0.6, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k;
    const j = bell(clamp01(k / 0.4)) + 0.6 * bell(clamp01((k - 0.35) / 0.3));
    P.rot(b.head, 0.22 * j * w, 0, 0.1 * Math.sin(k * 25) * w); P.rx(b.neck, 0.08 * j * w);
    ctl.ear = mix(ctl.ear, 0.8, j * w); ctl.jaw = Math.max(ctl.jaw, 0.1 * j * w);
  } },
  scrape: { dur: 1.2, a: 0.1, d: 0.85, fn(ctl, a, w) { // restless hoof scrape (warning)
    const P = ctl.pose, b = ctl.b, k = a.k;
    P.rx(b.neck, -0.2 * w); P.rx(b.head, -0.1 * w);
    const sc = k > 0.1 && k < 0.9 ? ((k - 0.1) % 0.4) / 0.4 : -1;
    if (sc >= 0) scrape(ctl, sc, w);
    ctl.hackle = Math.max(ctl.hackle, 0.6 * w);
  } },
  hit: qHit(),
  knockback: qKnockback(),
  knockdown: qKnockdown({ lieY: 0.27, roll: 1.4 }),
  getup: qGetup({ lieY: 0.27, roll: 1.4 }),
  death: qDeath({ lieY: 0.27, dist: 1.0, peak: 0.3, roll: 1.4, spin: 0.3 }),
  stun: qStun(),
  spawn: qSpawn({ depth: 1.3 }),
};

const BOAR_SPEC = {
  bones: { body: 'body', hips: 'hips', chest: 'chest', neck: 'neck', head: 'head', jaw: 'jaw', tail: ['tail1', 'tail2'], ears: ['earL', 'earR'] },
  gait: {
    legs: [
      { id: 'FL', chain: ['fUL', 'fLL', 'fPL'], toe: [-0.155, 0, -0.37], body: 'chest', scap: 0.35, lift: 0.09, flex: 1.1, out: 0.05, heel: 0.3 },
      { id: 'FR', chain: ['fUR', 'fLR', 'fPR'], toe: [0.155, 0, -0.37], body: 'chest', scap: 0.35, lift: 0.09, flex: 1.1, out: 0.05, heel: 0.3 },
      { id: 'RL', chain: ['rTL', 'rSL', 'rML', 'rPL'], toe: [-0.15, 0, 0.28], body: 'hips', scap: 0.3, lift: 0.08, flex: 0.8, out: 0.1, metaK: 0.9, heel: 0.25 },
      { id: 'RR', chain: ['rTR', 'rSR', 'rMR', 'rPR'], toe: [0.15, 0, 0.28], body: 'hips', scap: 0.3, lift: 0.08, flex: 0.8, out: 0.1, metaK: 0.9, heel: 0.25 },
    ],
    maxStride: 0.5,
    gaits: [
      { v: 1.1, f: 2.0, duty: 0.64, lift: 0.8, off: { RL: 0, FL: 0.25, RR: 0.5, FR: 0.75 }, bob: 0.012, bobF: 2, roll: 0.035, rollF: 1, nod: 0.04, nodF: 2, nodPh: 0.2 },
      { v: 2.6, f: 3.0, duty: 0.46, lift: 1, off: { FL: 0, RR: 0, FR: 0.5, RL: 0.5 }, bob: 0.022, bobF: 2, bobPh: 0.3, roll: 0.03, rollF: 1, nod: 0.03, nodF: 2 },
      { v: 6.5, f: 3.9, duty: 0.27, lift: 1.2, off: { RL: 0, RR: 0.08, FL: 0.45, FR: 0.55 }, bob: 0.05, bobF: 1, bobPh: 0.6, pitch: 0.09, pitchF: 1, pitchPh: 0.05, flex: 0.08, flexF: 1, flexPh: 0.2, nod: 0.04, nodF: 1, nodPh: 0.7 },
    ],
  },
  neck: { pitch: 0, run: -0.15, combat: -0.25, walk: -0.04, headCombat: 0.05, comp: 0.3, stab: 0.6 },
  tail: { wag: 0.5, wagF: 2.2, run: 0.3, combat: 0.2 },
  breathe: 0.018, combatCrouch: 0.04, combatPitch: -0.04, runDrop: 0.02, chargeK: 0.03,
  fidgets: [{ name: 'idle_alt', w: 3 }, { name: 'snort', w: 2 }],
  fidgetGap: 4,
  pose(ctl) {
    cancelRestOnMove(ctl);
    ctl.jaw += 0.05 * ctl.run;
    ctl.hackle = Math.max(ctl.hackle, ctl.acts.weight('charge'), ctl.run * 0.6);
    ctl.glow *= 1 + 0.4 * ctl.combat;
  },
  actions: ACTIONS,
};
