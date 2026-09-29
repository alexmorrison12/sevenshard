// Beach crab (~0.8 m across the legs): wide knobbly carapace with a toothed front margin, eyes on stalks, fluttering
// mouthparts that blow froth, six jointed walking legs and two pincers — the right "crusher" much bigger than the left
// "cutter". Variants sand (default) / reef; elite "barnaclaw" (×2): an old giant whose shell is crusted with barnacles,
// weed and a starfish, with glowing sea-green eyes.
//
// Sideways scuttle: the rig is authored with the crab's front along rig −X, so the gait's forward axis (rig −Z) is the
// crab's right side. CrabCtl yaws the creature's pivot: 0 (or π) while travelling → it scuttles sideways along the
// game's facing; −π/2 when idle / fighting → claws face the game's −Z (the target). Stance feet stay planted through the
// pivot turn (the gait gets the pivot's yaw rate as extra turn). Actions are written in crab space (front −Z) and
// converted with C() / crot() / cmove().
import * as THREE from 'three';
import { BaseCtl } from '../ctl.js';
import { Gait } from '../gait2.js';
import { kf } from '../acts.js';
import { sweep, rigid, bez, taper, leafGeo } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { lerp3 } from '../../kit/parts.js';
import { sstep, clamp01, mix, TAU } from '../../kit/rig.js';
import { hsh, prepLegs, cancelRestOnMove } from './util.js';

const PAL = {
  sand: { shell: 0xd0783c, dark: 0x7a2e16, spot: 0x9a3a1c, rim: 0xf0c890, belly: 0xf2e0c0, leg: 0xe09658, joint: 0xf4d0a0, tip: 0x2a1410, eye: 0x0a0808, stalk: 0xc86a38, mouth: 0x8a3020, glow: 0xff4a1a },
  reef: { shell: 0x2e6ab0, dark: 0x14305e, spot: 0xe0602a, rim: 0x9ad0f0, belly: 0xe8eef2, leg: 0x3a7ac0, joint: 0xb8d8f0, tip: 0x0c1018, eye: 0x080a0c, stalk: 0x2a5a98, mouth: 0x6a2a4a, glow: 0x40c0ff },
  barnaclaw: { shell: 0x4a5a52, dark: 0x1e2824, spot: 0x6a4a3a, rim: 0x8a9a88, belly: 0xc8c0a8, leg: 0x55665c, joint: 0x9aa890, tip: 0x0c0e0c, eye: 0x9affd8, stalk: 0x3e4c44, mouth: 0x4a2a2a, barn: 0xd8d2c0, weed: 0x3a5a2a, star: 0xe06a30, glow: 0x40ffc0 },
};

// crab space (front −Z, right +X) → rig space (front −X): rotate +90° about Y
const C = (p) => [p[2], p[1], -p[0]];
const FACE = -Math.PI / 2;
const BODY = [0, 0.25, 0];
// leg layout (crab space): coxa on the carapace side, knee arched high, ankle, toe
function legPts(i, s) {
  const z = -0.075 + i * 0.085, sp = (i - 1);
  return {
    coxa: [s * 0.19, 0.23, z], knee: [s * 0.35, 0.36, z + sp * 0.05],
    ank: [s * 0.46, 0.17, z + sp * 0.09], toe: [s * 0.5, 0, z + sp * 0.11],
  };
}
// claw arm layout (crab space, before per-side size): shoulder → wrist → hand → finger hinge → tips
function clawPts(s, k) {
  return {
    sh: [s * 0.15, 0.225, -0.12], wr: [s * 0.27, 0.27, -0.2], hand: [s * 0.23, 0.285, -0.3],
    hinge: [s * (0.23 - 0.04 * k), 0.3 + 0.025 * k, -0.3 - 0.13 * k], tipF: [s * (0.15 - 0.03 * k), 0.27, -0.3 - 0.24 * k], tipD: [s * (0.16 - 0.03 * k), 0.305 + 0.01 * k, -0.3 - 0.24 * k],
  };
}
const CS = (s) => (s > 0 ? 1.3 : 0.88); // right crusher / left cutter

export const crab = {
  name: 'Crab',
  variants: ['sand', 'reef', 'barnaclaw'],
  config(variant, opts = {}) {
    const v = PAL[variant] ? variant : (opts.elite ? 'barnaclaw' : 'sand');
    const elite = v === 'barnaclaw' || !!opts.elite;
    return { variant: elite ? 'barnaclaw' : v, pal: PAL[elite ? 'barnaclaw' : v], elite, shapeKey: elite ? 'elite' : 'base', scale: elite ? 2 : 1, h: elite ? 0.02 : 0.023, hg: { 1: elite ? 0.017 : 0.019, 2: 0.016 }, mat: { dfreq: 5, rim: 0.3, rimColor: 0xfff0e0, spec: 0.3, shine: 28 }, aoScale: 0.8 };
  },
  rig(R) {
    R.add('body', null, C(BODY));
    R.add('mouth', 'body', C([0, 0.2, -0.17]));
    R.add('foam', 'mouth', C([0, 0.19, -0.2]));
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R', k = CS(s), P = clawPts(s, k);
      R.add('eye' + n, 'body', C([s * 0.055, 0.3, -0.16]));
      R.add('cU' + n, 'body', C(P.sh)); R.add('cL' + n, 'cU' + n, C(P.wr)); R.add('cH' + n, 'cL' + n, C(P.hand)); R.add('cF' + n, 'cH' + n, C(P.hinge));
      for (let i = 0; i < 3; i++) {
        const L = legPts(i, s), nm = 'l' + i + n;
        R.add(nm + 'U', 'body', C(L.coxa)); R.add(nm + 'L', nm + 'U', C(L.knee)); R.add(nm + 'E', nm + 'L', C(L.ank));
      }
    }
  },
  sculpt(S, cfg) {
    const c = cfg.pal, E = cfg.elite;
    const shell = [0.04, 0.3, 0.25, 0], smooth = [0.02, 0.15, 0.2, 0];
    const e = (bone, p, r, o) => S.ell(bone, C(p), [r[2], r[1], r[0]], o); // crab-space radii [x,y,z] → rig [z,y,x]
    // ---- carapace: wide, domed, with raised regions and a toothed front margin
    e('body', [0, 0.26, 0.01], [0.235, 0.075, 0.18], { k: 0.05, col: c.shell, tag: 'shell', dtl: shell });
    e('body', [0, 0.285, -0.02], [0.15, 0.055, 0.12], { k: 0.05, col: c.shell, tag: 'shell', dtl: shell });
    for (const s of [-1, 1]) {
      e('body', [s * 0.11, 0.285, 0.05], [0.07, 0.04, 0.07], { k: 0.04, col: c.shell, tag: 'shell', dtl: shell });
      e('body', [s * 0.07, 0.29, -0.09], [0.05, 0.03, 0.045], { k: 0.03, col: c.shell, tag: 'shell', dtl: shell });
      // anterolateral teeth along the front-side margin
      for (let i = 0; i < 4; i++) {
        const bx = s * (0.12 + i * 0.035), bz = -0.14 + i * 0.045;
        S.cone('body', C([bx, 0.265, bz]), C([bx + s * 0.05, 0.27, bz - 0.035 + i * 0.012]), 0.022, 0.004, { k: 0.015, col: c.shell, tag: 'tooth', dtl: shell });
      }
    }
    // front brow between the eyes + mouth frame + underside plate
    e('body', [0, 0.265, -0.155], [0.08, 0.03, 0.03], { k: 0.025, col: c.shell, tag: 'brow', dtl: shell });
    e('body', [0, 0.195, -0.145], [0.075, 0.04, 0.035], { k: 0.02, col: c.mouth, tag: 'mouthf', dtl: smooth });
    e('body', [0, 0.19, 0.02], [0.17, 0.045, 0.14], { k: 0.04, col: c.belly, tag: 'belly', dtl: smooth });
    // ---- claws: merus + carpus (skinned), palms (own surface), movable fingers (own surface)
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R', k = CS(s), P = clawPts(s, k);
      S.cone('cU' + n, C(P.sh), C(P.wr), 0.032 * k, 0.03 * k, { k: 0.02, col: c.shell, tag: 'arm', b2: 'cL' + n, t0: 0.7, t1: 1, dtl: shell });
      S.sph('cL' + n, C(P.wr), 0.036 * k, { k: 0.02, col: c.shell, tag: 'arm', dtl: shell });
      S.cone('cL' + n, C(P.wr), C(P.hand), 0.034 * k, 0.04 * k, { k: 0.02, col: c.shell, tag: 'arm', b2: 'cH' + n, t0: 0.7, t1: 1, dtl: shell });
      // palm: bulbous, flattened, tapering into the fixed finger
      S.seg('cH' + n, C([s * 0.235, 0.29, -0.3 + 0.02]), C([s * (0.225 - 0.03 * k), 0.29, -0.3 - 0.13 * k]), 0.055 * k, 0.045 * k, { group: 1, k: 0.02, col: c.shell, tag: 'palm', dtl: shell });
      S.cone('cH' + n, C([s * (0.225 - 0.03 * k), 0.28, -0.3 - 0.11 * k]), C(P.tipF), 0.028 * k, 0.006, { group: 1, k: 0.02, col: c.shell, tip: { col: c.tip, from: 0.35 }, tag: 'finger', dtl: smooth });
      // movable finger (dactyl): hinged on top of the palm end, curving down to meet the fixed finger
      S.cone('cF' + n, C(P.hinge), C([mix(P.hinge[0], P.tipD[0], 0.55), P.hinge[1] + 0.012 * k, mix(P.hinge[2], P.tipD[2], 0.55)]), 0.026 * k, 0.018 * k, { group: 2, k: 0.015, col: c.shell, tag: 'dactyl', dtl: smooth });
      S.cone('cF' + n, C([mix(P.hinge[0], P.tipD[0], 0.55), P.hinge[1] + 0.012 * k, mix(P.hinge[2], P.tipD[2], 0.55)]), C(P.tipD), 0.018 * k, 0.005, { group: 2, k: 0.012, col: c.shell, tip: { col: c.tip, from: 0.1 }, tag: 'dactyl', dtl: smooth });
    }
    if (E) { // a crust of weed along the back margin
      e('body', [0, 0.27, 0.13], [0.2, 0.04, 0.06], { k: 0.04, col: c.weed, tag: 'weedpad', dtl: [0.3, 0, 0.35, 0] });
    }
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, y, z] = v.p, [nx, ny, nz] = v.n;
    // rig → crab space for patterning: crab x = −rig z, crab z = rig x
    const cx = -z, cz = x;
    const sh = v.t('shell') + v.t('brow') + v.t('tooth');
    // mottled spots on top of the shell and the palms
    const sp = Math.sin(cx * 47 + Math.sin(cz * 31) * 1.8) * Math.sin(cz * 43 - Math.sin(cx * 29) * 1.6);
    const spot = sstep(0.35, 0.6, sp) * sstep(0.2, 0.7, ny);
    v.mix(c.spot, spot * 0.75 * (sh + v.t('palm') * 0.8));
    // darker groove lines between the carapace regions (H-shaped)
    const groove = (1 - sstep(0.004, 0.012, Math.abs(Math.abs(cx) - 0.07 - 0.02 * Math.sin(cz * 20)))) * sstep(-0.06, 0.02, cz) * (1 - sstep(0.06, 0.1, cz)) * sstep(0.5, 0.8, ny);
    v.mix(c.dark, groove * 0.6 * sh);
    // pale rim along the shell margin & the underside, darker top centre
    v.mix(c.rim, sstep(0.45, 0.05, ny) * sstep(-0.3, 0.2, ny) * 0.55 * sh);
    v.mix(c.belly, sstep(-0.2, -0.7, ny) * 0.9 * (1 - v.t('finger') - v.t('dactyl')));
    v.mix(c.dark, sstep(0.75, 1, ny) * 0.2 * sh);
    // claw fingers: dark tips (from prim tip gradient) + pale tooth ridge on the inner edges
    if (v.group === 1 || v.group === 2) {
      const inner = v.group === 1 ? sstep(0.2, 0.7, ny) : sstep(0.2, 0.7, -ny);
      v.mix(c.joint, inner * 0.45 * (v.t('finger') + v.t('dactyl')) * (0.6 + 0.4 * Math.sin(cz * 160)));
    }
    v.mix(c.mouth, v.t('mouthf') * 0.8);
    if (cfg.elite) {
      // weathered, algae-streaked shell
      const alg = sstep(0.3, 0.7, Math.sin(cx * 23 + cz * 17) * 0.5 + Math.sin(cx * 51 - cz * 37) * 0.5) * sstep(0.3, 0.9, ny);
      v.mix(c.weed, alg * 0.45 * sh);
      v.mix(c.weed, v.t('weedpad') * 0.6);
    }
    v.mul(1 + Math.sin(x * 31 + z * 23) * Math.sin(y * 27) * 0.05);
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n), E = cfg.elite;
    const cl = col(c.leg), cj = col(c.joint), ct = col(c.tip), cd = col(c.dark);
    const V = (p) => new THREE.Vector3(...C(p));
    // ---- walking legs: flattened jointed segments, spiny dactyl tips
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const n = s < 0 ? 'L' : 'R', nm = 'l' + i + n, L = legPts(i, s);
      const seg = (bone, a, bb, r0, r1, flat) => {
        const A = V(a), B = V(bb);
        const g = sweep([A, A.clone().lerp(B, 0.5), B], [r0, (r0 + r1) * 0.55, r1], { radial: 5, flat, up: [0, 1, 0], capEnd: true, capStart: true });
        acc.add(g, { skin: rigid(b(bone)), dtl: [0.02, 0.25, 0.2, 0], color: (p, nn, uv) => lerp3(lerp3(cl, cj, sstep(0.8, 1, uv[1]) + sstep(0.15, 0, uv[1])), cd, sstep(0.3, 0.9, nn.y) * 0.25) });
      };
      seg(nm + 'U', L.coxa, L.knee, 0.024, 0.02, 0.7);
      seg(nm + 'L', L.knee, L.ank, 0.02, 0.014, 0.75);
      const A = V(L.ank), T = V(L.toe);
      acc.add(sweep([A, A.clone().lerp(T, 0.55), T], [0.013, 0.009, 0.001], { radial: 5, capStart: true }), { skin: rigid(b(nm + 'E')), dtl: [0, 0.2, 0.15, 0], color: (p, nn, uv) => lerp3(cl, ct, sstep(0.35, 0.9, uv[1])) });
      // knee knob + a couple of bristles on the lower segment
      acc.add(new THREE.IcosahedronGeometry(0.022, 0), { matrix: new THREE.Matrix4().makeTranslation(...C(L.knee)), skin: rigid(b(nm + 'L')), color: c.joint, dtl: [0, 0.2, 0.2, 0] });
    }
    // ---- eye stalks + glossy eyes (the elite's glow)
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R', bone = rigid(b('eye' + n));
      const p0 = [s * 0.055, 0.29, -0.16], p1 = [s * 0.062, 0.35, -0.172], p2 = [s * 0.07, 0.395, -0.175];
      acc.add(sweep(bez(C(p0), C(p1), C(p2), 4), taper(4, 0.012, 0.01), { radial: 5 }), { skin: bone, color: c.stalk, dtl: [0, 0.2, 0.15, 0] });
      const eg = new THREE.SphereGeometry(0.02, 8, 6);
      acc.add(eg, { matrix: new THREE.Matrix4().makeTranslation(...C([s * 0.072, 0.405, -0.178])), skin: bone, color: c.eye, emis: E ? 2.8 : 0, dtl: [0, 0, 0, 0] });
      const gl = new THREE.IcosahedronGeometry(0.006, 0);
      acc.add(gl, { matrix: new THREE.Matrix4().makeTranslation(...C([s * 0.066, 0.418, -0.19])), skin: bone, color: 0xffffff, emis: 0.8, dtl: [0, 0, 0, 0] });
    }
    // ---- mouthparts: two flat plates (maxillipeds) that flutter + a froth of bubbles (scaled by the foam bone)
    for (const s of [-1, 1]) {
      const g = leafGeo(0.028, 0.05, 0.006, 0.3, 0, { nu: 3, nv: 3, pw: 0.5 });
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI, Math.PI / 2 + s * 0.15, 0, 'YXZ')).setPosition(...C([s * 0.022, 0.22, -0.172]));
      acc.add(g, { matrix: m, skin: rigid(b('mouth')), color: c.mouth, dtl: [0, 0.2, 0.2, 0] });
    }
    for (let i = 0; i < 4; i++) {
      const g = new THREE.IcosahedronGeometry(0.011 + 0.006 * hsh(i + 3), 1);
      acc.add(g, { matrix: new THREE.Matrix4().makeTranslation(...C([(i - 1.5) * 0.017, 0.19 + 0.01 * hsh(i), -0.2 - 0.008 * hsh(i + 7)])), skin: rigid(b('foam')), color: 0xf4fbff, emis: 0.25, dtl: [0, 0, 0, 0] });
    }
    if (E) {
      // barnacles: little volcano cones with dark crater mouths, clustered on the shell
      const bc = col(c.barn), bd = col(0x3a3630);
      for (let i = 0; i < 16; i++) {
        const a = hsh(i * 3 + 1) * TAU, r = 0.04 + 0.16 * Math.sqrt(hsh(i * 3 + 2));
        const px = Math.cos(a) * r, pz = Math.sin(a) * r * 0.75 + 0.02;
        const top = S.project(C([px, 0.4, pz]), 0, 5).p;
        const n = [0, 1, 0]; S.normal(top[0], top[1], top[2], n, 0);
        const sz = 0.014 + 0.012 * hsh(i * 3 + 5);
        const base = new THREE.Vector3(...top).addScaledVector(new THREE.Vector3(...n), -sz * 0.3), tip = base.clone().addScaledVector(new THREE.Vector3(...n), sz * 1.6);
        acc.add(sweep([base, base.clone().lerp(tip, 0.6), tip], [sz * 1.25, sz * 0.95, sz * 0.55], { radial: 6, capEnd: true }), { skin: rigid(b('body')), dtl: [0, 0.5, 0.3, 0], color: (p, nn, uv) => uv[1] > 0.99 ? bd : lerp3(bc, lerp3(bc, bd, 0.4), 1 - uv[1]) });
      }
      // hanging weed ribbons off the back margin
      for (let i = 0; i < 6; i++) {
        const x = (i - 2.5) * 0.07, g = leafGeo(0.018, 0.12 + 0.05 * hsh(i + 20), 0.004, 0.2, 0.6, { nu: 3, nv: 4, pw: 0.3 });
        const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI - 0.5, Math.PI / 2 + (hsh(i) - 0.5) * 0.6, 0, 'YXZ')).setPosition(...C([x, 0.27, 0.17]));
        acc.add(g, { matrix: m, skin: rigid(b('body')), color: (p, nn, uv) => lerp3(col(c.weed), col(0x6a8a3a), uv[1]), dtl: [0.2, 0, 0.3, 0] });
      }
      // a starfish clinging to the shell
      const star = new THREE.Shape();
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, r = i % 2 ? 0.018 : 0.05; if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r); else star.moveTo(r, 0); }
      const sg = new THREE.ExtrudeGeometry(star, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1 });
      const sp = S.project(C([-0.1, 0.4, -0.03]), 0, 5).p;
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-Math.PI / 2 + 0.2, 0.4, 0.3, 'YXZ')).setPosition(sp[0], sp[1] - 0.004, sp[2]);
      acc.add(sg, { matrix: m, skin: rigid(b('body')), color: c.star, dtl: [0, 0.6, 0.3, 0] });
    }
  },
  sockets: {
    head: ['body', C([0, 0.42, -0.14])], mouth: ['mouth', C([0, 0.2, -0.2])], center: ['body', C([0, 0.25, 0])], back: ['body', C([0, 0.34, 0.02])],
    handR: ['cHR', C([0.2, 0.3, -0.52])], handL: ['cHL', C([-0.19, 0.29, -0.47])],
  },
  height: 0.45, radius: 0.45,
  controller(inst) { return new CrabCtl(inst, SPEC); },
  get actionList() { return ACTIONS; },
};

// ------------------------------------------------------------------------------------------------ controller
const LEG_IDS = [];
function crabLegs() {
  const legs = [];
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const n = s < 0 ? 'L' : 'R', nm = 'l' + i + n, L = legPts(i, s);
    LEG_IDS.push(nm);
    legs.push({ id: nm, chain: [nm + 'U', nm + 'L', nm + 'E'], toe: C(L.toe), body: 'body', lift: 0.07, flex: 0, heel: 0, out: 0 });
  }
  return legs;
}
// alternating tripods: R0 L1 R2 | L0 R1 L2
const tri = { l0R: 0, l1L: 0.04, l2R: 0.08, l0L: 0.5, l1R: 0.54, l2L: 0.58 };
const wave = { l0R: 0, l1R: 0.33, l2R: 0.66, l0L: 0.5, l1L: 0.83, l2L: 0.16 };
const CRAB_GAIT = {
  legs: crabLegs(), maxStride: 0.24, fMin: 0.8, actV: 0.15, actTurn: 1.4, settleDist: 0.05,
  gaits: [
    { v: 0.6, f: 2.6, duty: 0.62, lift: 0.9, off: wave, bob: 0.006, bobF: 3, roll: 0.02, rollF: 1 },
    { v: 1.8, f: 4.2, duty: 0.52, lift: 1, off: tri, bob: 0.008, bobF: 2, roll: 0.02, rollF: 2 },
    { v: 4.5, f: 6.0, duty: 0.45, lift: 1.1, off: tri, bob: 0.01, bobF: 2, roll: 0.03, rollF: 2 },
  ],
};

/** crab-space helpers: rotations (pitch nose-up about crab X, yaw about Y, roll about crab Z) and moves */
function crot(P, i, pitch, yaw, roll) { P.ry(i, yaw); P.rz(i, -pitch); P.rx(i, roll); }
function cmove(P, i, x, y, z) { P.move(i, z, y, -x); }

class CrabCtl extends BaseCtl {
  constructor(inst, spec) {
    super(inst, spec);
    this.gait = new Gait(this.pose, CRAB_GAIT);
    prepLegs(this.gait);
    this.pref = (inst.seed ? hsh(inst.seed * 1.7) : Math.random()) < 0.5 ? 1 : -1; // preferred scuttle direction
    this.theta = FACE; this.thetaV = 0; this.scut = 0; this.eyeLook = 0; this.eyeT = 0; this.foam = 0; this.foamT = Math.random() * 5;
    this.clawOpen = 0; this.clawOpenR = 0; this.clawOpenL = 0;
    inst.pivot.rotation.y = FACE;
    // terrain sampling happens in pivot space: rotate samples by the pivot yaw into root space
    let inner = null; const self = this;
    const wrapped = (lx, lz) => { const c = Math.cos(self.theta), s = Math.sin(self.theta); return inner(lx * c + lz * s, -lx * s + lz * c); };
    Object.defineProperty(this.gait, 'ground', { get() { return inner ? wrapped : null; }, set(fn) { inner = fn; }, configurable: true });
  }
  update(dt, state = {}) {
    dt = Math.min(dt, 0.1);
    const P = this.pose, b = this.b, G = this.gait;
    this.t += dt;
    this._state(state, dt);
    const lw = this.locoW;
    const sp = this._speed, tr = this._turn, st = this._strafe;
    // ---- scuttle vs face: travel sideways, turn to face for anything else
    cancelRestOnMove(this);
    let busy = 0;
    const A = this.acts.list;
    for (let i = 0; i < A.length; i++) { const a = A[i]; if (!a.d.rest && !a.out && a.w > busy) busy = a.w; }
    const travel = Math.hypot(sp, st) > 0.35 && busy < 0.3 && !this.dead && !this.isDown;
    if (travel && this.scut < 0.5) this.pref = tr > 0.3 ? -1 : tr < -0.3 ? 1 : this.pref; // lead with the side it is turning toward
    this.scut += ((travel ? 1 : 0) - this.scut) * (1 - Math.exp(-6 * dt));
    const target = travel ? (this.pref > 0 ? 0 : -Math.PI) : FACE;
    const k = this.dead || this.isDown ? 0 : 1;
    this.thetaV += ((target - this.theta) * 90 - this.thetaV * 17) * dt * k;
    if (!k) this.thetaV *= Math.exp(-10 * dt);
    this.thetaV = Math.max(-9, Math.min(9, this.thetaV));
    this.theta += this.thetaV * dt;
    this.inst.pivot.rotation.y = this.theta;
    // root-frame travel → pivot frame
    const c = Math.cos(this.theta), s = Math.sin(this.theta);
    const spG = -st * s + sp * c, stG = st * c + sp * s;
    this.speedSm += (Math.hypot(sp, st) - this.speedSm) * (1 - Math.exp(-6 * dt));
    this.turnSm += (tr - this.turnSm) * (1 - Math.exp(-4 * dt));
    this.run = clamp01((this.speedSm - 1.2) / 2.5);
    P.reset();
    G.update(dt, spG * lw, (tr + this.thetaV) * lw, stG * lw);
    const idle = 1 - clamp01(G.act * 1.5);
    const cb = this.combat;
    // ---- body: low, bobbing; leans into the scuttle; combat raises it on its legs
    G.adaptBody(dt);
    const lead = (this.pref > 0 ? 1 : -1) * this.scut; // +1 = moving toward crab right
    const breath = Math.sin(this.t * 1.7);
    cmove(P, b.body, 0, G.bob + 0.004 * breath * idle + 0.035 * cb - 0.015 * this.run + G.gOff, 0);
    crot(P, b.body, 0.06 * cb, 0, -0.07 * lead * clamp01(this.speedSm));
    P.rot(b.body, G.pitch + G.gPitch, 0, G.roll + G.gRoll); // gait wobble & terrain tilt are rig-space
    const legs = G.legs;
    for (let i = 0; i < legs.length; i++) { const L = legs[i]; L.homeOff.set(0, 0, L.toe.z * 0.08 * cb); }
    // ---- claws: guard pose (raised in combat), sway while scuttling
    const sw = Math.sin(G.phase * TAU) * 0.08 * G.act;
    for (let sd = -1; sd <= 1; sd += 2) {
      const cu = sd < 0 ? b.cUL : b.cUR, cl = sd < 0 ? b.cLL : b.cLR, ch = sd < 0 ? b.cHL : b.cHR;
      crot(P, cu, 0.15 + 0.45 * cb + sw * sd + 0.02 * breath, sd * (0.08 * this.scut), sd * (-0.1 - 0.15 * cb));
      crot(P, cl, 0.1 * cb, -sd * 0.15 * cb, 0);
      crot(P, ch, -0.2 * cb, 0, 0);
    }
    // ---- eyes: stalks look around, perk up in combat, fold when hit/down (actions may override eyeFold)
    this.eyeT -= dt;
    if (this.eyeT < 0) { this.eyeT = 0.6 + Math.random() * 2; this.eyeLook = (Math.random() - 0.5) * 1.2; }
    this.eyeFold = 0;
    this.jaw = 0; this.glow = 1; this.clawOpenR = 0.08 * cb; this.clawOpenL = 0.08 * cb;
    // froth: a few bubbles swell and pop every few seconds while idle
    this.foamT += dt;
    this.foam = idle * Math.max(0, Math.sin(this.foamT * 0.9)) ** 3;
    this._fidget(dt, idle);
    this.acts.apply();
    for (let sd = -1; sd <= 1; sd += 2) {
      const e = sd < 0 ? b.eyeL : b.eyeR;
      const fold = this.eyeFold;
      crot(P, e, -1.3 * fold + 0.15 * cb, this.eyeLook * 0.5 * (1 - fold), sd * (0.1 + 0.2 * fold));
      const cf = sd < 0 ? b.cFL : b.cFR;
      crot(P, cf, 0.6 * (sd < 0 ? this.clawOpenL : this.clawOpenR), 0, 0);
    }
    // mouthparts flutter (breathing), faster in combat
    crot(P, b.mouth, 0.12 * Math.max(0, Math.sin(this.t * (6 + 8 * cb))) + this.jaw * 0.6, 0, 0);
    P.sc[b.foam].setScalar(Math.max(0.0001, this.foam));
    P.fk();
    G.solve(P, { air: 0, airPaw: 0 });
    P.apply(this.inst.bones);
    this._uniforms();
  }
}

// ------------------------------------------------------------------------------------------------ actions
/** crab-space leg override: carried by the body (local) or planted in model space */
function lo(L, x, y, z, w) { const q = C3(x, y, z); L.override.copy(q); L.overrideLocal = true; L.overridePaw = 0; if (w > L.overrideW) L.overrideW = w; }
function lp(L, x, y, z, w) { const q = C3(x, y, z); L.override.copy(q); L.overrideLocal = false; L.overridePaw = 0; if (w > L.overrideW) L.overrideW = w; }
const _c3 = new THREE.Vector3();
function C3(x, y, z) { return _c3.set(z, y, -x); }
const cx = (L) => -L.toe.z, cz = (L) => L.toe.x; // crab-space rest toe x / z
function arm(ctl, sd, up, out, elbow, wrist, w) { // crab-space claw arm pose delta
  const P = ctl.pose, b = ctl.b;
  crot(P, sd < 0 ? b.cUL : b.cUR, up * w, -sd * out * w, 0);
  crot(P, sd < 0 ? b.cLL : b.cLR, 0, -sd * elbow * w, 0);
  crot(P, sd < 0 ? b.cHL : b.cHR, wrist * w, 0, 0);
}
/** flipped on the back: roll π about the crab's front axis; legs up in the air */
function flip(ctl, w, f, side, lift, curl, flail, t) {
  const P = ctl.pose, b = ctl.b;
  cmove(P, b.body, 0, (lift + 0.03 * f) * w, 0);
  crot(P, b.body, 0, 0, side * Math.PI * f * w);
  const G = ctl.gait.legs;
  for (let i = 0; i < G.length; i++) {
    const L = G[i];
    const fl = Math.sin(t * (15 + i * 1.9) + i * 2.1) * flail;
    lo(L, cx(L) * mix(0.95, 0.5, curl) + 0.03 * fl, mix(0.05, 0.16, curl) + 0.05 * fl, cz(L) * mix(1, 0.6, curl), f * w);
  }
  arm(ctl, -1, -0.3 * f + 0.25 * flail * Math.sin(t * 11), 0.4 * f, -0.2 * f, 0, w);
  arm(ctl, 1, -0.3 * f + 0.25 * flail * Math.sin(t * 9 + 1), 0.4 * f, -0.2 * f, 0, w);
  ctl.eyeFold = Math.max(ctl.eyeFold, 0.8 * f * w);
}
const DE_T = [0, 0.1, 0.26, 0.36, 0.44, 1], DE_Y = [0, 0.16, 0.24, 0.06, 0.1, 0.06];

const ACTIONS = {
  attack: { dur: 0.6, a: 0.08, d: 0.8, hit: 0.45, fn(ctl, a, w) { // crusher snip: cock back & open, lunge, snap shut
    const P = ctl.pose, b = ctl.b, k = a.k;
    const cock = sstep(0, 0.35, k) * (1 - sstep(0.38, 0.48, k)), lunge = sstep(0.36, 0.48, k) * (1 - sstep(0.62, 1, k));
    cmove(P, b.body, 0, 0.02 * cock * w, (0.03 * cock - 0.06 * lunge) * w);
    crot(P, b.body, (0.08 * cock - 0.06 * lunge) * w, (0.15 * cock - 0.12 * lunge) * w, 0);
    arm(ctl, 1, 0.55 * cock - 0.1 * lunge, 0.35 * cock - 0.3 * lunge, 0.4 * cock - 0.55 * lunge, -0.3 * cock + 0.2 * lunge, w);
    arm(ctl, -1, 0.2 * cock, 0.1, 0, 0, w);
    ctl.clawOpenR = Math.max(ctl.clawOpenR, sstep(0.05, 0.3, k) * (1 - sstep(0.42, 0.47, k)) * w);
  } },
  attack2: { dur: 0.9, a: 0.06, d: 0.82, hit: 0.38, hits: [0.38, 0.62], fn(ctl, a, w) { // double pinch: left, then right
    const P = ctl.pose, b = ctl.b, k = a.k;
    const on = sstep(0, 0.2, k) * (1 - sstep(0.8, 1, k));
    cmove(P, b.body, 0, 0.025 * on * w, 0);
    for (let sd = -1; sd <= 1; sd += 2) {
      const t0 = sd < 0 ? 0.26 : 0.5;
      const cock = sstep(t0 - 0.22, t0 - 0.04, k) * (1 - sstep(t0, t0 + 0.08, k)), jab = sstep(t0, t0 + 0.1, k) * (1 - sstep(t0 + 0.14, t0 + 0.34, k));
      arm(ctl, sd, 0.2 * on + 0.35 * cock - 0.15 * jab, 0.2 * cock - 0.25 * jab, 0.35 * cock - 0.6 * jab, -0.2 * cock + 0.15 * jab, w);
      const open = sstep(t0 - 0.2, t0 - 0.06, k) * (1 - sstep(t0 + 0.06, t0 + 0.1, k));
      if (sd < 0) ctl.clawOpenL = Math.max(ctl.clawOpenL, open * w); else ctl.clawOpenR = Math.max(ctl.clawOpenR, open * w);
      crot(P, b.body, 0, sd * 0.1 * jab * w, 0);
    }
  } },
  attack_big: { dur: 1.6, a: 0.05, d: 0.88, hit: 0.64, fn(ctl, a, w) { // raise both claws high & wide open (telegraph) → SLAM them into the ground
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const up = sstep(0, 0.42, k) * (1 - sstep(0.56, 0.63, k));
    const trem = up * sstep(0.3, 0.5, k) * Math.sin(t * 55) * 0.05;
    const slam = sstep(0.56, 0.64, k) * (1 - sstep(0.76, 1, k));
    cmove(P, b.body, 0, (0.08 * up - 0.06 * slam) * w, (0.03 * up - 0.04 * slam) * w);
    crot(P, b.body, (0.3 * up - 0.18 * slam) * w, 0, trem * 0.4 * w);
    for (let sd = -1; sd <= 1; sd += 2) arm(ctl, sd, 1.55 * up - 0.75 * slam + trem, 0.45 * up + 0.1 * slam, -0.3 * up + 0.2 * slam, 0.6 * up - 0.3 * slam, w);
    const open = sstep(0.1, 0.35, k) * (1 - sstep(0.58, 0.63, k));
    ctl.clawOpenL = Math.max(ctl.clawOpenL, open * w); ctl.clawOpenR = Math.max(ctl.clawOpenR, open * w);
    ctl.charge = Math.max(ctl.charge, sstep(0.05, 0.5, k) * (1 - sstep(0.56, 0.62, k)) * w);
    ctl.glow = mix(ctl.glow, 2, up * w);
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) { const L = G[i]; if (L.id[1] === '2') lp(L, L.home.x * 1.0, 0, L.home.z * 1.1, up * w); }
  } },
  spit: { dur: 0.8, a: 0.08, d: 0.8, hit: 0.5, fn(ctl, a, w) { // tilt up and blast a jet of froth
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const back = sstep(0, 0.42, k) * (1 - sstep(0.46, 0.52, k)), jet = sstep(0.46, 0.52, k) * (1 - sstep(0.7, 1, k));
    cmove(P, b.body, 0, (0.03 * back + 0.02 * jet) * w, (0.03 * back - 0.03 * jet) * w);
    crot(P, b.body, (0.22 * back + 0.08 * jet) * w, 0, 0);
    for (let sd = -1; sd <= 1; sd += 2) arm(ctl, sd, 0.3 * back, 0.35 * (back + jet), 0.2, 0, w);
    ctl.jaw = Math.max(ctl.jaw, (0.4 * back + 1 * jet) * w);
    ctl.foam = Math.max(ctl.foam, (0.6 * back + 1.6 * jet * (0.8 + 0.2 * Math.sin(t * 40))) * w);
  } },
  roar: { dur: 1.4, a: 0.1, d: 0.85, fn(ctl, a, w) { // threat display: stand tall, claws raised & spread, clack clack
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const up = sstep(0, 0.2, k) * (1 - sstep(0.82, 1, k));
    cmove(P, b.body, 0, 0.07 * up * w, 0);
    crot(P, b.body, 0.12 * up * w, 0, Math.sin(t * 7) * 0.04 * up * w);
    for (let sd = -1; sd <= 1; sd += 2) arm(ctl, sd, 1.05 * up, 0.75 * up, -0.45 * up, 0.35 * up, w);
    const clack = Math.max(0, Math.sin(t * 16)) * up;
    ctl.clawOpenL = Math.max(ctl.clawOpenL, clack * w); ctl.clawOpenR = Math.max(ctl.clawOpenR, Math.max(0, Math.sin(t * 16 + 1.5)) * up * w);
    ctl.glow = mix(ctl.glow, 1.8, up * w);
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) { const L = G[i]; lp(L, L.home.x * 1.12, 0, L.home.z * 1.12, up * w); }
  } },
  cast: { dur: 1.3, a: 0.1, d: 0.85, hit: 0.55, fn(ctl, a, w) { // claws hammer the sand twice (calls the tide)
    const P = ctl.pose, b = ctl.b, k = a.k;
    const on = sstep(0, 0.15, k) * (1 - sstep(0.85, 1, k));
    for (let sd = -1; sd <= 1; sd += 2) {
      const beat = Math.max(0, Math.sin((k * 2.2 + (sd > 0 ? 0.25 : 0)) * TAU));
      arm(ctl, sd, (0.6 * beat - 0.4 * (1 - beat)) * on, 0.2, 0.1, 0.2 * beat, w);
    }
    crot(P, b.body, 0.06 * on * w, 0, 0);
    ctl.glow = mix(ctl.glow, 2, on * w);
  } },
  idle_alt: { dur: 2.4, a: 0.12, d: 0.85, fn(ctl, a, w) { // feed: the small claw picks at the sand and brings morsels to the mouth
    const P = ctl.pose, b = ctl.b, t = a.t;
    const cyc = (t * 1.6) % 1, dig = sstep(0, 0.3, cyc) * (1 - sstep(0.35, 0.55, cyc)), eat = sstep(0.4, 0.6, cyc) * (1 - sstep(0.85, 1, cyc));
    arm(ctl, -1, -0.45 * dig + 0.35 * eat, 0.1 * dig - 0.2 * eat, 0.1 * dig + 0.55 * eat, 0.3 * dig - 0.5 * eat, w);
    ctl.clawOpenL = Math.max(ctl.clawOpenL, 0.6 * dig * w);
    crot(P, b.body, (0.04 - 0.04 * dig) * w, 0, 0);
    ctl.jaw = Math.max(ctl.jaw, 0.4 * eat * w);
  } },
  clack: { dur: 1.1, a: 0.1, d: 0.8, fn(ctl, a, w) { // taunt: crusher raised, clacking
    const t = a.t, on = sstep(0, 0.2, a.k) * (1 - sstep(0.8, 1, a.k));
    arm(ctl, 1, 0.9 * on, 0.3 * on, -0.2 * on, 0.3 * on, w);
    ctl.clawOpenR = Math.max(ctl.clawOpenR, Math.max(0, Math.sin(t * 20)) * on * w);
  } },
  eyewipe: { dur: 1.6, a: 0.15, d: 0.8, fn(ctl, a, w) { // the small claw wipes an eye stalk
    const t = a.t;
    arm(ctl, -1, 0.9, -0.35, 0.5 + 0.15 * Math.sin(t * 12), -0.8, w);
    ctl.eyeFold = Math.max(ctl.eyeFold, (0.3 + 0.15 * Math.sin(t * 12)) * w);
  } },
  burrow: { dur: 1, hold: true, rest: true, fadeIn: 0.8, fadeOut: 0.5, fn(ctl, a, w) { // dig in: only the eye stalks peek out of the sand
    const P = ctl.pose, b = ctl.b, t = a.t;
    cmove(P, b.body, 0, -0.27 * w + Math.sin(t * 20) * 0.005 * (1 - sstep(0.8, 1.2, t)) * w, 0);
    for (let sd = -1; sd <= 1; sd += 2) arm(ctl, sd, -0.3, 0.2, 0.3, 0, w);
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) { const L = G[i]; lo(L, cx(L) * 0.9, 0.12, cz(L), w); }
    ctl.eyeFold = Math.min(ctl.eyeFold, 0);
  } },
  hit: { dur: 0.42, a: 0.05, d: 0.45, hit: 0, fn(ctl, a, w) { // flinch: body jolts back, claws up, eyes fold
    const P = ctl.pose, b = ctl.b, j = sstep(0, 0.12, a.k) * (1 - sstep(0.25, 1, a.k)) * w, s = Math.sin(a.seed * 7.13) > 0 ? 1 : -1;
    cmove(P, b.body, 0, 0.02 * j, 0.04 * j);
    crot(P, b.body, 0.12 * j, 0, 0.1 * s * j);
    for (let sd = -1; sd <= 1; sd += 2) arm(ctl, sd, 0.4, 0.2, 0.3, 0, j);
    ctl.eyeFold = Math.max(ctl.eyeFold, 0.9 * j);
  } },
  knockback: { dur: 0.85, a: 0.02, d: 0.7, hit: 0, fn(ctl, a, w) { // shoved back, legs skid wide
    const P = ctl.pose, b = ctl.b, k = a.k;
    const j = sstep(0, 0.08, k) * (1 - sstep(0.4, 1, k)) * w, skid = sstep(0.05, 0.2, k) * (1 - sstep(0.55, 0.95, k)) * w;
    cmove(P, b.body, 0, 0.03 * j - 0.03 * skid, 0.06 * j);
    crot(P, b.body, 0.2 * j, 0, 0.06 * j * Math.sin(a.seed));
    for (let sd = -1; sd <= 1; sd += 2) arm(ctl, sd, 0.6, 0.4, 0.2, 0, j);
    ctl.eyeFold = Math.max(ctl.eyeFold, j);
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) { const L = G[i]; lp(L, L.home.x * 1.1, 0, L.home.z * 1.15, skid); }
  } },
  knockdown: { dur: 0.8, hold: true, excl: true, state: true, fadeIn: 0.02, fadeOut: 0.05, hit: 0, start(ctl, a) { ctl.flipSide = Math.sin(a.seed * 7.13) > 0 ? 1 : -1; }, fn(ctl, a, w) { // flipped on its back, legs wiggling
    const k = a.k, t = a.t;
    const f = sstep(0.05, 0.5, k), hop = Math.sin(clamp01(k / 0.5) * Math.PI) * 0.16;
    flip(ctl, w, f, ctl.flipSide, hop, 0.2, 1 - 0.5 * sstep(1.5, 3, t) + 0.5 * Math.pow(Math.max(0, Math.sin(t * 1.1)), 4), t);
  } },
  getup: { dur: 0.8, a: 0.001, d: 0.85, state: true, fn(ctl, a, w) { // rocks and flips back over
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const f = 1 - sstep(0.15, 0.7, k), hop = Math.sin(clamp01((k - 0.1) / 0.55) * Math.PI) * 0.14;
    flip(ctl, w * (1 - sstep(0.7, 1, k)), f, ctl.flipSide ?? 1, hop, 0.2 * f, 0.9 * f, t);
    crot(P, b.body, 0, 0, Math.sin(clamp01(k / 0.2) * Math.PI) * 0.25 * (ctl.flipSide ?? 1) * w);
  } },
  death: { dur: 1.5, hold: true, excl: true, state: true, fadeIn: 0.02, keep: true, start(ctl, a) { a.u.side = ctl.acts.weight('knockdown') > 0.3 && ctl.flipSide ? ctl.flipSide : (Math.sin(a.seed * 7.13) > 0 ? 1 : -1); }, fn(ctl, a, w) { // flung back, flips, legs curl up
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    if (a.u.fromDown) flip(ctl, w, 1, a.u.side, 0.05, sstep(0, 1, t), Math.sin(t * 30) * 0.3 * (1 - sstep(0.1, 0.8, t)), t);
    else {
      flip(ctl, w, sstep(0.04, 0.36, k), a.u.side, kf(k, DE_T, DE_Y), sstep(0.3, 0.8, k), (1 - sstep(0.35, 0.8, k)) * 1.3, t);
      cmove(P, b.body, 0, 0, 0.45 * sstep(0, 0.4, k) * w);
    }
    for (let sd = -1; sd <= 1; sd += 2) arm(ctl, sd, 0, 0.3 * sstep(0.4, 0.9, k), -0.2, 0.2, w);
    ctl.clawOpenL = Math.max(ctl.clawOpenL, 0.7 * sstep(0.4, 0.8, k) * w); ctl.clawOpenR = Math.max(ctl.clawOpenR, 0.5 * sstep(0.45, 0.85, k) * w);
    ctl.eyeFold = Math.max(ctl.eyeFold, sstep(0.3, 1.2, t) * w);
    ctl.glow = mix(ctl.glow, 0.1, sstep(0.3, 1.3, t) * w);
    ctl.foam = 0;
  } },
  stun: { dur: 1.6, loop: true, state: true, fadeIn: 0.25, fadeOut: 0.3, fn(ctl, a, w) { // dazed: body sags & sways, eyes circle, claws drop
    const P = ctl.pose, b = ctl.b, ph = a.t / 1.6 * TAU;
    cmove(P, b.body, Math.sin(ph) * 0.015 * w, -0.05 * w, 0);
    crot(P, b.body, -0.06 * w, Math.sin(ph) * 0.1 * w, Math.cos(ph) * 0.08 * w);
    for (let sd = -1; sd <= 1; sd += 2) arm(ctl, sd, -0.35, 0.3, -0.1, 0.2, w);
    ctl.eyeLook = Math.sin(a.t * 6) * 1.2; ctl.eyeFold = Math.max(ctl.eyeFold, (0.25 + 0.2 * Math.cos(a.t * 6)) * w);
    ctl.clawOpenL = Math.max(ctl.clawOpenL, 0.4 * w); ctl.clawOpenR = Math.max(ctl.clawOpenR, 0.4 * w);
  } },
  spawn: { dur: 1.6, a: 0.001, d: 0.9, state: true, excl: true, fn(ctl, a, w) { // bursts out of the sand: eye stalks pop up first, then the shell heaves out
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const rise = sstep(0.3, 0.72, k), shake = Math.sin(t * 38) * (1 - rise) * sstep(0.15, 0.3, k);
    cmove(P, b.body, shake * 0.01 * w, -0.34 * (1 - rise) * w + 0.03 * sstep(0.7, 0.78, k) * (1 - sstep(0.8, 0.95, k)) * w, 0);
    crot(P, b.body, (0.25 * (1 - rise) * sstep(0.2, 0.4, k)) * w, 0, shake * 0.12 * w);
    ctl.eyeFold = Math.max(ctl.eyeFold, (1 - sstep(0.08, 0.2, k)) * w);
    const pop = sstep(0.72, 0.82, k) * (1 - sstep(0.9, 1, k));
    for (let sd = -1; sd <= 1; sd += 2) arm(ctl, sd, -0.4 * (1 - rise) + 1.0 * pop, 0.2 + 0.5 * pop, 0.2 - 0.4 * pop, 0.3 * pop, w);
    ctl.clawOpenL = Math.max(ctl.clawOpenL, pop * w); ctl.clawOpenR = Math.max(ctl.clawOpenR, pop * w);
    ctl.glow = mix(ctl.glow, 2, pop * w);
    const G = ctl.gait.legs;
    for (let i = 0; i < G.length; i++) { const L = G[i]; lo(L, cx(L) * 0.85, 0.1 + Math.sin(t * 20 + i) * 0.03 * (1 - rise), cz(L), (1 - sstep(0.6, 0.8, k)) * w); }
  } },
};

const SPEC = {
  bones: {
    body: 'body', mouth: 'mouth', foam: 'foam', eyeL: 'eyeL', eyeR: 'eyeR',
    cUL: 'cUL', cLL: 'cLL', cHL: 'cHL', cFL: 'cFL', cUR: 'cUR', cLR: 'cLR', cHR: 'cHR', cFR: 'cFR',
  },
  fidgets: [{ name: 'idle_alt', w: 3 }, { name: 'eyewipe', w: 1.5 }, { name: 'clack', w: 1 }],
  fidgetGap: 3, chargeK: 0.35,
  actions: ACTIONS,
};
