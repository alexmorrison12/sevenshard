// Treant (~4.2 m ELITE walking tree of the Thornwood): a hunched, broad-shouldered trunk fluted with twisting bark
// ridges, two stout root legs whose feet splay into roots, long branch arms that reach its knees and end in twig
// fingers, a gnarled face low in the trunk (heavy brow, knot-hole eyes burning amber, a hollow mouth glowing from within,
// a beard of hanging moss), boughs rising off its shoulders into a heaving lobed canopy of big leaves with bare branches
// poking out, shelf fungi and red toadstools, moss on every upward surface and amber heartwood glow leaking from cracks.
// Variants: oak (default), autumn (flame-leaved), blighted (Abyss-corrupted: dead bark, violet glow). All are elite.
// Heavy BipedCtl gait; canopy & finger secondary motion in spec.post; actions: branch sweep, stomp, double-arm slam,
// roar, root call, spore burst, rigid timber-fall death, tear-out-of-the-ground spawn, dormant disguise.
import * as THREE from 'three';
import { BipedCtl, armRot, legsLocal, legsPlant } from '../ctl.js';
import { kf } from '../acts.js';
import { sweep, rigid, bez, taper, leafGeo } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { lerp3 } from '../../kit/parts.js';
import { sstep, clamp01, mix, TAU } from '../../kit/rig.js';
import { hsh, ov, cancelRestOnMove, prepLegs } from './util.js';

const PAL = {
  oak: { bark: 0x4c3c2e, dark: 0x160f0a, ridge: 0x7e6c56, face: 0x6e5a46, moss: 0x587a2a, moss2: 0x8aa83e, leaf: 0x1c3612, leaf2: 0x3c6a20, leaf3: 0x86ac38, glow: 0xffa02a, core: 0xfff0b0, eye: 0xffc040, cap: 0xc03a24, spot: 0xf4ecd8, shelf: 0xd6a060, twig: 0x4a3c2e, bloom: 0xf4e8a8 },
  autumn: { bark: 0x524638, dark: 0x1a140e, ridge: 0x8e7e66, face: 0x76624e, moss: 0x7a7430, moss2: 0xa89c48, leaf: 0x6a2410, leaf2: 0xc8541a, leaf3: 0xffb838, glow: 0xffa02a, core: 0xfff0b0, eye: 0xffd050, cap: 0xa83020, spot: 0xf0e0c0, shelf: 0xe0a860, twig: 0x54463a, bloom: 0xffe070 },
  blighted: { bark: 0x3a3438, dark: 0x100c10, ridge: 0x5e5660, face: 0x4a4250, moss: 0x3e3a4e, moss2: 0x5a4a6e, leaf: 0x221628, leaf2: 0x4a2a52, leaf3: 0x7a4a86, glow: 0xc040ff, core: 0xf4d8ff, eye: 0xe070ff, cap: 0x6a2a7a, spot: 0xd8c0f0, shelf: 0x8a7a90, twig: 0x2a2428, bloom: 0xd070ff },
};

// ---- rig layout (model space, faces −Z)
const J = {
  hips: [0, 1.45, 0.05], spine: [0, 1.95, 0.02], chest: [0, 2.5, 0.0], neck: [0, 2.92, -0.02], head: [0, 3.08, -0.16], jaw: [0, 2.84, -0.38],
  crown: [0, 3.35, 0.12], lobeL: [-0.66, 3.4, 0.2], lobeR: [0.66, 3.38, 0.16],
};
const ARM = (s) => ({ sh: [s * 0.66, 2.72, 0.04], el: [s * 0.94, 2.02, 0.12], wr: [s * 1.02, 1.36, 0.02], kn: [s * 1.04, 1.18, -0.02] });
const LEG = (s) => ({ hip: [s * 0.36, 1.4, 0.05], knee: [s * 0.42, 0.8, -0.12], ank: [s * 0.44, 0.24, 0.02], toe: [s * 0.44, 0, -0.18] });
// canopy lobes: [bone, centre, radius]
const LOBES = [
  ['crown', [0, 3.7, 0.22], 0.56], ['crown', [0.05, 4.08, 0.1], 0.38], ['crown', [0, 3.58, 0.7], 0.44], ['crown', [0, 3.5, -0.28], 0.34],
  ['crown', [-0.34, 3.98, 0.48], 0.32], ['crown', [0.38, 3.95, 0.5], 0.31], ['crown', [-0.3, 4.1, -0.08], 0.28], ['crown', [0.32, 3.84, -0.2], 0.3],
  ['lobeL', [-0.66, 3.56, 0.22], 0.42], ['lobeL', [-0.98, 3.34, 0.3], 0.27], ['lobeL', [-0.7, 3.84, 0.4], 0.28], ['lobeL', [-0.55, 3.34, -0.12], 0.26],
  ['lobeR', [0.66, 3.53, 0.18], 0.42], ['lobeR', [0.95, 3.3, 0.22], 0.26], ['lobeR', [0.72, 3.8, 0.36], 0.27], ['lobeR', [0.56, 3.32, -0.14], 0.25],
];

export const treant = {
  name: 'Treant',
  variants: ['oak', 'autumn', 'blighted'],
  config(variant, opts = {}) {
    const v = PAL[variant] ? variant : 'oak';
    return { variant: v, pal: PAL[v], elite: true, shapeKey: 'base', scale: 1, h: 0.12, hg: { 1: 0.075, 2: 0.07, 3: 0.2 }, mat: { dfreq: 1.3, furAxis: 1, rim: 0.3, rimColor: v === 'blighted' ? 0xe8c8ff : 0xfff0d0 }, aoScale: 2.4, grad: { top: 0.2, bottom: 0.35, y0: 0, y1: 1.2, low: 0.25 }, sphereMul: 1.3 };
  },
  rig(R) {
    R.add('hips', null, J.hips);
    R.add('spine', 'hips', J.spine);
    R.add('chest', 'spine', J.chest);
    R.add('neck', 'chest', J.neck);
    R.add('head', 'neck', J.head);
    R.add('jaw', 'head', J.jaw);
    R.add('crown', 'neck', J.crown); R.add('lobeL', 'crown', J.lobeL); R.add('lobeR', 'crown', J.lobeR);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R', A = ARM(s), L = LEG(s);
      R.add('armU' + n, 'chest', A.sh); R.add('armL' + n, 'armU' + n, A.el); R.add('hand' + n, 'armL' + n, A.wr); R.add('fing' + n, 'hand' + n, A.kn);
      R.add('thigh' + n, 'hips', L.hip); R.add('shin' + n, 'thigh' + n, L.knee); R.add('foot' + n, 'shin' + n, L.ank);
    }
  },
  sculpt(S, cfg) {
    const c = cfg.pal;
    const bark = [0.0, 0.1, 0.35, 0.5], barkS = [0.0, 0.08, 0.3, 0.35], leafD = [0.05, 0, 0.45, 0];
    // ---- trunk: rooty hips, thick waist, massive shoulders, hunched upper back
    S.ell('hips', [0, 1.5, 0.06], [0.46, 0.34, 0.38], { k: 0.14, col: c.bark, tag: 'trunk', dtl: bark });
    S.ell('spine', [0, 1.98, 0.02], [0.47, 0.44, 0.39], { k: 0.16, col: c.bark, tag: 'trunk', dtl: bark });
    S.ell('chest', [0, 2.5, 0.04], [0.62, 0.48, 0.48], { k: 0.16, col: c.bark, tag: 'trunk', dtl: bark });
    S.ell('neck', [0, 2.92, 0.16], [0.5, 0.34, 0.4], { k: 0.16, col: c.bark, tag: 'hump', dtl: bark });
    S.ell('head', [0, 3.0, -0.04], [0.34, 0.3, 0.28], { k: 0.12, col: c.bark, tag: 'hump', dtl: bark }); // back of the head (coarse)
    for (const s of [-1, 1]) S.sph('chest', [s * 0.6, 2.74, 0.06], 0.26, { k: 0.12, col: c.ridge, tag: 'shoulder', dtl: bark });
    // fluted bark: ridges twisting up around the trunk, flaring into the hips
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.3, a2 = a + 0.45, r0 = 0.45, r1 = 0.58;
      S.cone('hips', [Math.sin(a) * r0, 1.2, Math.cos(a) * r0 * 0.85 + 0.05], [Math.sin(a2) * r1, 2.62, Math.cos(a2) * r1 * 0.85 + 0.04], 0.13, 0.1, { k: 0.04, col: c.ridge, tag: 'rib', b2: 'chest', t0: 0.3, t1: 0.9, dtl: bark });
    }
    // hip roots flaring down into the thighs
    for (const s of [-1, 1]) S.cone('hips', [s * 0.3, 1.5, -0.05], [s * 0.45, 1.05, -0.12], 0.14, 0.08, { k: 0.1, col: c.bark, tag: 'root', dtl: bark });
    // ---- face (own finer surface): heavy brow, deep sockets, knot nose, hollow mouth, cheekbones
    const f = { group: 2 };
    S.ell('head', [0, 3.0, -0.34], [0.35, 0.33, 0.2], { ...f, k: 0.1, col: c.face, tag: 'face', dtl: barkS });
    S.ell('head', [0, 3.14, -0.52], [0.36, 0.08, 0.1], { ...f, k: 0.07, col: c.ridge, tag: 'brow', rot: [0.2, 0, 0], dtl: bark });
    for (const s of [-1, 1]) {
      S.sph('head', [s * 0.14, 3.02, -0.54], 0.09, { ...f, k: 0.04, sub: true, col: c.dark, tag: 'socket' });
      S.ell('head', [s * 0.22, 2.88, -0.46], [0.12, 0.1, 0.1], { ...f, k: 0.06, col: c.face, tag: 'cheek', dtl: barkS });
      S.cone('head', [s * 0.3, 3.17, -0.44], [s * 0.5, 3.36, -0.32], 0.075, 0.02, { ...f, k: 0.05, col: c.ridge, tag: 'brow', dtl: bark }); // brow horns
    }
    S.ell('head', [0, 2.93, -0.57], [0.07, 0.11, 0.08], { ...f, k: 0.05, col: c.ridge, tag: 'nose', rot: [-0.3, 0, 0], dtl: barkS });
    S.ell('head', [0, 2.78, -0.52], [0.21, 0.065, 0.13], { ...f, k: 0.04, sub: true, col: c.dark, tag: 'mouth' });
    // lower lip / jaw plate
    S.ell('jaw', [0, 2.7, -0.47], [0.22, 0.085, 0.14], { group: 1, k: 0.06, col: c.face, tag: 'jaw', dtl: barkS });
    // ---- arms: thick branch limbs with knotted elbows, gnarled fists
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R', A = ARM(s);
      S.cone('armU' + n, A.sh, A.el, 0.23, 0.16, { k: 0.1, col: c.bark, tag: 'arm', b2: 'armL' + n, t0: 0.75, t1: 1, dtl: bark });
      S.sph('armL' + n, A.el, 0.18, { k: 0.08, col: c.ridge, tag: 'knot', dtl: bark });
      S.cone('armL' + n, A.el, A.wr, 0.16, 0.13, { k: 0.08, col: c.bark, tag: 'arm', b2: 'hand' + n, t0: 0.8, t1: 1, dtl: bark });
      S.ell('hand' + n, [s * 1.04, 1.28, 0.0], [0.15, 0.17, 0.15], { k: 0.07, col: c.bark, tag: 'hand', dtl: bark });
      S.cone('armL' + n, [s * 0.97, 1.8, 0.1], [s * 1.18, 1.92, 0.24], 0.075, 0.035, { k: 0.05, col: c.bark, tag: 'arm', dtl: bark }); // broken branch stub
    }
    // ---- legs: stout root legs, knotty knees, flared root feet (the root toes are rigid parts)
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R', L = LEG(s);
      S.cone('thigh' + n, L.hip, L.knee, 0.27, 0.2, { k: 0.12, col: c.bark, tag: 'leg', b2: 'shin' + n, t0: 0.75, t1: 1, dtl: bark });
      S.sph('shin' + n, L.knee, 0.2, { k: 0.08, col: c.ridge, tag: 'knot', dtl: bark });
      S.cone('shin' + n, L.knee, L.ank, 0.19, 0.24, { k: 0.1, col: c.bark, tag: 'leg', b2: 'foot' + n, t0: 0.8, t1: 1, dtl: bark });
      S.ell('foot' + n, [L.ank[0], 0.13, L.ank[2] - 0.06], [0.25, 0.13, 0.3], { k: 0.1, col: c.bark, tag: 'foot', dtl: bark });
    }
    // ---- canopy core (own coarse surface): distinct lobes, dark inside; the leaf cards dress it
    for (let i = 0; i < LOBES.length; i++) { const [bone, p, r] = LOBES[i]; S.sph(bone, p, r * 0.9, { group: 3, k: 0.1, col: c.leaf, tag: 'leaf', dtl: leafD }); }
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, y, z] = v.p, [nx, ny, nz] = v.n;
    const g = v.group;
    if (g === 3) {
      // canopy: sunlit tops, shaded undersides & crevices, a few blossoms (per-pixel leaf clumps come from the atlas)
      const n1 = Math.sin(x * 5.3 + Math.sin(z * 4.1) * 2) * Math.sin(z * 4.7 + Math.sin(y * 3.3) * 2) * Math.sin(y * 5.9 + x * 2.3);
      v.mix(c.leaf2, sstep(0.2, 0.9, ny) * (0.3 + 0.2 * n1));
      v.mul(0.75);
      const bl = sstep(0.9, 0.99, Math.sin(x * 23 + y * 7) * Math.sin(z * 19 - y * 11)) * sstep(0.2, 0.6, ny);
      v.mix(c.bloom, bl * 0.8);
      if (cfg.variant === 'blighted') v.emis = Math.max(v.emis, bl * 1.6);
      v.aoMul = 1.4;
      return;
    }
    // bark: vertical grooves around the trunk & along limbs, lighter ridges, darker low down
    const ang = Math.atan2(x, z);
    const gr = Math.sin(ang * 6 + Math.sin(y * 2.1 + x * 1.5) * 1.2 + y * 0.6) * 0.7 + Math.sin(y * 5 + ang * 3) * 0.3;
    const groove = sstep(0.25, 0.75, gr);
    v.mix(c.dark, groove * 0.75 * (1 - v.t('face') * 0.6));
    v.mix(c.ridge, (sstep(-0.3, -0.8, gr) * 0.4 + v.t('rib') * 0.35) * (1 - groove));
    v.aoMul = 1.25;
    // moss: upward-facing surfaces, a collar on the feet, patches low on the trunk
    const mn = Math.sin(x * 9 + z * 7) * Math.sin(y * 8 - x * 5) * 0.5 + 0.5;
    const moss = Math.max(sstep(0.45, 0.85, ny) * sstep(0.3, 0.65, mn), v.t('foot') * sstep(0.5, 0.9, ny) * 0.8, sstep(0.5, 0.2, y) * sstep(0.2, 0.7, ny) * 0.6 * mn) * (1 - v.t('mouth'));
    v.mix(lerp3(col(c.moss), col(c.moss2), mn), moss * 0.85);
    // heartwood glow: fissures on the chest / belly / arms + a lens-shaped split over the heart
    const f1 = Math.abs(Math.sin(ang * 3.2 + y * 2.3 + Math.sin(y * 6.1) * 0.7));
    const fis = (1 - sstep(0.0, 0.05, f1)) * (v.t('trunk') + v.t('rib') * 0.6 + v.t('arm') * 0.5) * sstep(-0.1, 0.4, -nz) * (y > 1.2 && y < 2.8 ? 1 : 0);
    const hy = (y - 2.3) / 0.38, lens = Math.abs(x) < 0.075 * Math.max(0, 1 - hy * hy) && z < -0.3 ? 1 - sstep(0.4, 1, Math.abs(hy)) : 0;
    const glow = Math.max(fis * 0.9, lens);
    if (glow > 0.02) { v.mix(lerp3(col(c.glow), col(c.core), lens * 0.6), glow * 0.95); v.emis = Math.max(v.emis, glow * (1.3 + lens * 1.8)); }
    // face: sockets & mouth glow from within
    if (v.t('mouth') > 0.2) { const d = sstep(0.2, 0.8, v.t('mouth')) * sstep(0.1, 0.6, -nz * 0 + ny * -1 + 0.5); v.mix(c.dark, 0.85); v.mix(c.glow, d * 0.9); v.emis = Math.max(v.emis, 2.2 * d); }
    if (v.t('socket') > 0.3) v.mix(c.dark, 0.9);
    if (g === 1 && ny > 0.45 && z < -0.36) { v.mix(c.glow, 0.85); v.emis = 1.5; }
    v.mul(1 + Math.sin(x * 5 + z * 4) * Math.sin(y * 3.3) * 0.07);
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n);
    const tw = col(c.twig), tk = col(c.dark), lf = col(c.leaf), lf2 = col(c.leaf2), lf3 = col(c.leaf3), mo = col(c.moss), mo2 = col(c.moss2);
    const twigCol = (p, nn, uv) => lerp3(tw, tk, sstep(0.5, 1, uv[1]) * 0.5 + sstep(0.4, 0.9, Math.sin(uv[1] * 30)) * 0.15);
    // ---- burning knot-hole eyes
    for (const s of [-1, 1]) {
      acc.add(new THREE.SphereGeometry(0.07, 8, 6), { matrix: new THREE.Matrix4().makeTranslation(s * 0.14, 3.025, -0.5), skin: rigid(b('head')), color: c.eye, emis: 4.5, dtl: [0, 0, 0, 0] });
      acc.add(new THREE.IcosahedronGeometry(0.032, 0), { matrix: new THREE.Matrix4().makeTranslation(s * 0.135, 3.03, -0.565), skin: rigid(b('head')), color: c.core, emis: 7, dtl: [0, 0, 0, 0] });
    }
    // ---- twig fingers (4 + thumb) on the finger bone: knobbly, tapering, hooked tips
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R', A = ARM(s), k0 = A.kn;
      const fingers = [[-0.6, 0.72], [-0.2, 0.8], [0.2, 0.76], [0.58, 0.64], [1.4, 0.5]];
      for (let i = 0; i < fingers.length; i++) {
        const [a, L] = fingers[i], th = i === 4;
        const d = [s * (0.28 + 0.34 * Math.sin(a)) * (th ? -1.2 : 1), -0.85, -0.45 * Math.cos(a) - (th ? 0.35 : 0.1)];
        const dl = Math.hypot(d[0], d[1], d[2]);
        const base = [k0[0] + d[0] / dl * 0.05, k0[1], k0[2] + d[2] / dl * 0.05];
        const mid = [base[0] + d[0] / dl * L * 0.55, base[1] + d[1] / dl * L * 0.55, base[2] + d[2] / dl * L * 0.55];
        const tip = [mid[0] + d[0] / dl * L * 0.4 + (th ? 0 : s * 0.02), mid[1] + d[1] / dl * L * 0.3 + 0.06, mid[2] + d[2] / dl * L * 0.45 - 0.14];
        acc.add(sweep(bez(base, mid, tip, 5), taper(5, th ? 0.06 : 0.055, 0.008, 1.2), { radial: 4 }), { skin: rigid(b('fing' + n)), dtl: [0, 0.1, 0.3, 0.5], color: twigCol });
      }
      // a leafy sprig on the forearm
      const sp0 = [s * 1.0, 1.62, 0.12], sp1 = [s * 1.22, 1.78, 0.2], sp2 = [s * 1.34, 1.98, 0.14];
      acc.add(sweep(bez(sp0, sp1, sp2, 4), taper(4, 0.035, 0.008), { radial: 4 }), { skin: rigid(b('armL' + n)), dtl: [0, 0.1, 0.3, 0.5], color: twigCol });
      for (let i = 0; i < 3; i++) {
        const gl = leafGeo(0.07, 0.17, 0.012, 0.5, 0.3, { nu: 3, nv: 3 });
        const p = i === 0 ? sp2 : i === 1 ? sp1 : [mix(sp0[0], sp1[0], 0.5), mix(sp0[1], sp1[1], 0.5), mix(sp0[2], sp1[2], 0.5)];
        const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.3 * i - 0.4, s * (0.8 + i), s * (0.5 - i * 0.6), 'YXZ')).setPosition(p[0], p[1], p[2]);
        acc.add(gl, { matrix: m, skin: rigid(b('armL' + n)), dtl: [0.05, 0.3, 0.4, 0], color: (pp, nn, uv) => lerp3(lf2, lf3, uv[1] * 0.6) });
      }
      // hanging moss strands off the forearm
      for (let i = 0; i < 2; i++) {
        const t = 0.3 + i * 0.35, p = [mix(A.el[0], A.wr[0], t) + s * 0.05, mix(A.el[1], A.wr[1], t) - 0.1, mix(A.el[2], A.wr[2], t) + 0.1];
        const gm = leafGeo(0.055, 0.34 + 0.12 * hsh(i + 7 * s), 0.01, 0.4, 0.15, { nu: 3, nv: 4, pw: 0.4 });
        const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI, s * 1.2 + (i - 0.5) * 0.6, 0, 'YXZ')).setPosition(p[0], p[1], p[2]);
        acc.add(gm, { matrix: m, skin: rigid(b('armL' + n)), color: (pp, nn, uv) => lerp3(mo, mo2, uv[1] * 0.6), dtl: [0.3, 0, 0.3, 0] });
      }
      // root toes: splaying out from the foot, curling down into the earth
      const L = LEG(s), roots = [[-0.25, 0.62], [s * 0.5, 0.58], [s * 1.25, 0.5], [Math.PI - s * 0.4, 0.46]];
      for (let i = 0; i < roots.length; i++) {
        const [a, len] = roots[i], sa = Math.sin(a), ca = -Math.cos(a);
        const p0 = [L.ank[0] + sa * 0.14, 0.2, L.ank[2] - 0.06 + ca * 0.16], p1 = [L.ank[0] + sa * len * 0.6, 0.14, L.ank[2] - 0.06 + ca * len * 0.6], p2 = [L.ank[0] + sa * len, -0.02, L.ank[2] - 0.06 + ca * len];
        acc.add(sweep(bez(p0, p1, p2, 5), taper(5, 0.1, 0.018, 0.9), { radial: 4, capStart: true }), { skin: rigid(b('foot' + n)), dtl: [0, 0.1, 0.3, 0.8], color: (pp, nn, uv) => lerp3(lerp3(col(c.bark), tk, uv[1] * 0.5), mo, sstep(0.75, 0.95, nn.y) * 0.5 * (1 - uv[1])) });
      }
    }
    // ---- moss beard hanging from the chin
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 0.085, L = 0.38 + 0.18 * hsh(i + 30) - Math.abs(i - 2) * 0.06;
      const gm = leafGeo(0.07, L, 0.012, 0.3, 0.12, { nu: 3, nv: 4, pw: 0.35 });
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI - 0.12, (i - 2) * 0.35, 0, 'YXZ')).setPosition(x, 2.66, -0.5 + Math.abs(i - 2) * 0.04);
      acc.add(gm, { matrix: m, skin: rigid(b('jaw')), color: (pp, nn, uv) => lerp3(mo2, mo, uv[1]), dtl: [0.3, 0, 0.3, 0] });
    }
    // ---- boughs rising off the shoulders into the canopy + bare branches poking out of it
    const branch = (bone, pts, r0, r1 = 0.012) => acc.add(sweep(bez(pts[0], pts[1], pts[2], 5), taper(5, r0, r1, 1.1), { radial: 4 }), { skin: rigid(b(bone)), dtl: [0, 0.1, 0.3, 0.55], color: twigCol });
    for (const s of [-1, 1]) branch('chest', [[s * 0.52, 2.88, 0.14], [s * 0.78, 3.2, 0.24], [s * 0.86, 3.5, 0.3]], 0.13, 0.05);
    branch('lobeL', [[-0.85, 3.6, 0.25], [-1.25, 3.98, 0.12], [-1.38, 4.36, 0.2]], 0.07);
    branch('lobeR', [[0.84, 3.62, 0.14], [1.22, 3.84, -0.08], [1.46, 4.08, -0.04]], 0.065);
    branch('crown', [[0.12, 4.15, 0.22], [0.22, 4.48, 0.36], [0.06, 4.72, 0.5]], 0.06);
    // ---- foliage: ~140 small two-sided leaves dressing the dark canopy core, tilted out of the surface (fluffy rim)
    let li = 0;
    const leaf = leafGeo(1, 1, 0.02, 0, 0.2, { nu: 2, nv: 3, pw: 0.6, tipW: 0.02 }); // unit diamond leaf, 8 tris
    let area = 0; for (let i = 0; i < LOBES.length; i++) area += LOBES[i][2] * LOBES[i][2];
    const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < LOBES.length; i++) {
      const [bone, C0, r] = LOBES[i];
      const n = Math.round(150 * r * r / area);
      for (let j = 0; j < n; j++, li++) {
        const u = hsh(li * 3 + 1) * TAU, vv = Math.asin(-0.45 + hsh(li * 3 + 2) * 1.45);
        const dir = new THREE.Vector3(Math.cos(u) * Math.cos(vv), Math.sin(vv), Math.sin(u) * Math.cos(vv));
        const pos = new THREE.Vector3(C0[0], C0[1], C0[2]).addScaledVector(dir, r * 0.86);
        if (S.sdf(pos.x, pos.y, pos.z, 3) < -0.09) continue; // buried inside a neighbouring lobe
        const size = 0.2 + 0.1 * hsh(li + 70);
        // leaf axes: Y along the leaf (down-slope, lifted out of the surface), Z = −front = into the lobe
        Y.set(Math.cos(hsh(li + 5) * TAU), 0, Math.sin(hsh(li + 5) * TAU)).addScaledVector(UP, -1.2).addScaledVector(dir, -dir.dot(Y)).normalize();
        const lift = 0.3 + 0.7 * hsh(li + 33);
        Y.multiplyScalar(Math.cos(lift)).addScaledVector(dir, Math.sin(lift)).normalize();
        Z.copy(dir).negate().addScaledVector(Y, dir.dot(Y)).normalize();
        X.crossVectors(Y, Z).normalize();
        _m.makeBasis(X, Y, Z).scale(new THREE.Vector3(size * 0.55, size, size)).setPosition(pos.x, pos.y, pos.z);
        const tone = hsh(li + 9), sun = sstep(-0.3, 0.9, dir.y);
        const cA = lerp3(lf, lf2, 0.3 + 0.6 * tone * (0.5 + 0.5 * sun)), cB = lerp3(cA, lf3, (0.25 + 0.55 * sun) * tone);
        acc.add(leaf, { matrix: _m.clone(), skin: rigid(b(bone)), dtl: [0.05, 0.1, 0.35, 0], color: (p, nn, uv) => lerp3(cA, cB, uv[1]) });
      }
    }
    // ---- shelf fungi on the left flank + the right thigh; red toadstools on the right shoulder
    const shelf = (bone, p, r, yaw) => {
      const gg = new THREE.SphereGeometry(r, 8, 3, 0, Math.PI, 0, Math.PI / 2);
      gg.scale(1, 0.32, 1);
      const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(p[0], p[1], p[2]);
      acc.add(gg, { matrix: m, skin: rigid(b(bone)), dtl: [0, 0.2, 0.3, 0.2], color: (pp, nn) => nn.y > 0.3 ? lerp3(col(c.shelf), col(0xf0e0c0), 0.3) : col(0x6a5040) });
    };
    shelf('spine', [-0.47, 2.05, 0.12], 0.2, Math.PI / 2 + 0.2);
    shelf('spine', [-0.46, 1.85, 0.04], 0.15, Math.PI / 2 + 0.1);
    shelf('spine', [-0.44, 2.22, 0.2], 0.12, Math.PI / 2 + 0.3);
    shelf('thighR', [0.62, 1.05, 0.0], 0.13, -Math.PI / 2);
    const stool = (p, h, r) => {
      acc.add(sweep([[p[0], p[1] - 0.05, p[2]], [p[0], p[1] + h, p[2]]], [r * 0.3, r * 0.25], { radial: 5 }), { skin: rigid(b('chest')), color: 0xf0e6d0, dtl: [0, 0, 0.2, 0] });
      const cap = new THREE.SphereGeometry(r, 8, 4, 0, TAU, 0, Math.PI / 2); cap.scale(1, 0.6, 1);
      acc.add(cap, { matrix: new THREE.Matrix4().makeTranslation(p[0], p[1] + h, p[2]), skin: rigid(b('chest')), dtl: [0, 0.2, 0.2, 0], color: (pp) => { const sp = Math.sin(pp.x * 90) * Math.sin(pp.z * 90 + pp.y * 40); return sp > 0.6 ? col(c.spot) : col(c.cap); } });
    };
    stool([0.62, 2.96, 0.1], 0.12, 0.1);
    stool([0.78, 2.9, 0.02], 0.08, 0.07);
    stool([0.5, 2.98, 0.22], 0.06, 0.055);
  },
  sockets: {
    head: ['head', [0, 3.35, -0.4]], mouth: ['jaw', [0, 2.8, -0.55]], center: ['chest', [0, 2.2, -0.1]], back: ['neck', [0, 2.9, 0.5]],
    chest: ['chest', [0, 2.3, -0.52]], handR: ['handR', [1.05, 1.14, -0.04]], handL: ['handL', [-1.05, 1.14, -0.04]], crown: ['crown', [0, 4.0, 0.2]],
  },
  height: 4.2, radius: 1.1,
  controller(inst) { const c = new BipedCtl(inst, SPEC); prepLegs(c.gait); c.crownV = 0; c.crownA = 0; c.crownZ = 0; c.crownZV = 0; c.shake = 0; c.grip = 0; c.dormant = 0; return c; },
  get actionList() { return ACTIONS; },
};

// ------------------------------------------------------------------------------------------------ animation
const ease3 = (x) => { x = clamp01(x); return x * x * x; };
const ACTIONS = {
  attack: { dur: 1.3, a: 0.08, d: 0.85, hit: 0.55, fn(ctl, a, w) { // BRANCH SWEEP: right arm swings out & back, then scythes across the front
    const P = ctl.pose, b = ctl.b, k = a.k;
    const wind = sstep(0, 0.4, k) * (1 - sstep(0.44, 0.56, k)), sweepK = sstep(0.42, 0.6, k), rec = sstep(0.68, 1, k);
    const u = 1 - rec;
    P.rot(b.hips, 0, (0.18 * wind - 0.25 * sweepK * u) * w, 0);
    P.rot(b.spine, (0.05 * wind - 0.12 * sweepK * u) * w, (0.3 * wind - 0.45 * sweepK * u) * w, (-0.1 * wind + 0.08 * sweepK * u) * w);
    P.rot(b.chest, 0, (0.2 * wind - 0.3 * sweepK * u) * w, 0);
    P.rot(b.head, 0.1 * wind * w, (-0.3 * wind + 0.35 * sweepK * u) * w, 0);
    armRot(ctl, 1, mix(0.7 * wind, 1.1, sweepK) * u, mix(0.6 * wind, 0.1, sweepK) * u, w, mix(1.2 * wind, -0.35, sweepK) * u, mix(-0.5 * wind, 0.6, sweepK) * u);
    armRot(ctl, -1, 0.3 * wind + 0.2 * sweepK * u, 0.4, w, 0.3);
    ctl.grip = Math.max(ctl.grip, (0.2 * wind + 0.5 * sweepK * u) * w);
    ctl.shake = Math.max(ctl.shake, sstep(0.45, 0.55, k) * (1 - sstep(0.6, 0.8, k)) * w);
    ctl.jaw = Math.max(ctl.jaw, 0.4 * sweepK * u * w);
    legsPlant(ctl, 0.8 * u * w, 1.1, 0);
  } },
  attack2: { dur: 1.4, a: 0.08, d: 0.85, hit: 0.6, fn(ctl, a, w) { // STOMP: hoist the right root-foot high, then drive it into the earth
    const P = ctl.pose, b = ctl.b, k = a.k;
    const lift = sstep(0.05, 0.48, k) * (1 - sstep(0.52, 0.6, k)), stomp = sstep(0.52, 0.6, k) * (1 - sstep(0.75, 1, k));
    P.move(b.hips, -0.12 * lift * w, (0.04 * lift - 0.08 * stomp) * w, 0.05 * lift * w);
    P.rot(b.hips, (-0.08 * lift + 0.05 * stomp) * w, 0, -0.08 * lift * w);
    P.rot(b.spine, (0.12 * lift - 0.15 * stomp) * w, 0, 0.06 * lift * w);
    P.rot(b.head, (0.15 * lift - 0.1 * stomp) * w, 0, 0);
    armRot(ctl, -1, 0.5 * lift + 0.2 * stomp, 0.6, w, 0.7 * lift);
    armRot(ctl, 1, 0.3 * lift, 0.5, w, 0.9 * lift + 0.3 * stomp);
    const L = ctl.gait.legs[1];
    ov(L, L.home.x + 0.05, 0.75 * lift, L.home.z - 0.28 * lift - 0.15 * stomp, (lift + stomp) * w, false, -0.3 * lift);
    const L0 = ctl.gait.legs[0]; ov(L0, L0.home.x - 0.05, 0, L0.home.z, w, false, 0);
    ctl.shake = Math.max(ctl.shake, stomp * w);
    ctl.jaw = Math.max(ctl.jaw, 0.5 * stomp * w);
  } },
  attack_big: { dur: 2.6, a: 0.05, d: 0.9, hit: 0.62, fn(ctl, a, w) { // HAMMERFALL: both arms raised high overhead (long glowing telegraph) → slam into the ground
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const raise = sstep(0.02, 0.4, k) * (1 - sstep(0.56, 0.62, k));
    const trem = raise * sstep(0.3, 0.55, k) * Math.sin(t * 38) * 0.03;
    const slam = sstep(0.56, 0.63, k) * (1 - sstep(0.78, 1, k));
    P.move(b.hips, 0, (0.06 * raise - 0.22 * slam) * w, (0.1 * raise - 0.12 * slam) * w);
    P.rot(b.hips, (-0.06 * raise + 0.22 * slam) * w, 0, 0);
    P.rot(b.spine, (-0.2 * raise + 0.45 * slam + trem) * w, 0, trem * w);
    P.rot(b.chest, (-0.15 * raise + 0.25 * slam) * w, 0, 0);
    P.rot(b.head, (-0.35 * raise + 0.2 * slam) * w, 0, 0);
    for (let s = -1; s <= 1; s += 2) armRot(ctl, s, 2.9 * raise + 1.1 * slam + trem * 4, 0.35 * raise + 0.1 * slam, w, 0.25 * raise - 0.2 * slam, 0);
    ctl.grip = Math.max(ctl.grip, (0.2 * raise + 1 * slam) * w);
    ctl.jaw = Math.max(ctl.jaw, (0.6 * raise + 0.8 * slam) * w);
    ctl.glow = mix(ctl.glow, 1 + 2.4 * sstep(0.05, 0.55, k) * (1 - sstep(0.62, 0.8, k)), w);
    ctl.charge = Math.max(ctl.charge, sstep(0.05, 0.5, k) * (1 - sstep(0.56, 0.62, k)) * w);
    ctl.shake = Math.max(ctl.shake, (0.4 * raise * sstep(0.3, 0.55, k) + slam) * w);
    legsPlant(ctl, w, 1.25, -0.05);
  } },
  roar: { dur: 2.0, a: 0.08, d: 0.85, fn(ctl, a, w) { // bellow: rear back, arms flung wide, mouth blazing, crown thrashing
    const P = ctl.pose, b = ctl.b, t = a.t, k = a.k;
    const up = sstep(0, 0.25, k) * (1 - sstep(0.82, 1, k)), sh = Math.sin(t * 30) * 0.02 * up;
    P.move(b.hips, 0, 0.03 * up * w, 0.06 * up * w);
    P.rot(b.spine, (-0.25 * up + sh) * w, 0, sh * w); P.rx(b.chest, -0.12 * up * w);
    P.rot(b.head, (-0.35 * up + sh * 2) * w, 0, 0);
    for (let s = -1; s <= 1; s += 2) armRot(ctl, s, 0.9 * up, 0.5 * up, w, 1.1 * up, 0);
    ctl.jaw = Math.max(ctl.jaw, (0.95 + 0.05 * Math.sin(t * 25)) * up * w);
    ctl.glow = mix(ctl.glow, 1 + 2 * up, w); ctl.grip = Math.max(ctl.grip, -0.4 * up * w);
    ctl.shake = Math.max(ctl.shake, 0.8 * up * w);
    legsPlant(ctl, up * w, 1.25, 0);
  } },
  cast: { dur: 1.8, a: 0.1, d: 0.85, hit: 0.6, fn(ctl, a, w) { // root call: plunge the right hand toward the ground, fingers splayed, heart blazing
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const up = sstep(0, 0.3, k) * (1 - sstep(0.4, 0.55, k)), down = sstep(0.45, 0.6, k) * (1 - sstep(0.85, 1, k));
    P.move(b.hips, 0, -0.18 * down * w, 0);
    P.rot(b.spine, (0.1 * up + 0.35 * down) * w, 0, 0.1 * down * w);
    armRot(ctl, 1, 1.6 * up + 0.2 * down, 0.4 * up + 0.2 * down, w, 0.3 * up + 0.15 * down);
    armRot(ctl, -1, 0.6 * up + 0.3 * down, 0.8, w, 0.6);
    ctl.grip = Math.max(ctl.grip, -0.6 * down * w);
    ctl.glow = mix(ctl.glow, 1 + 2.5 * (up + down) * (0.8 + 0.2 * Math.sin(t * 12)), w);
    ctl.charge = Math.max(ctl.charge, up * 0.7 * w);
    legsPlant(ctl, w, 1.2, 0);
  } },
  spit: { dur: 1.4, a: 0.1, d: 0.85, hit: 0.5, fn(ctl, a, w) { // spore burst: lurch forward and thrash the crown (spores from socket 'crown')
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const draw = sstep(0, 0.4, k) * (1 - sstep(0.42, 0.5, k)), burst = sstep(0.42, 0.5, k) * (1 - sstep(0.7, 1, k));
    P.rot(b.spine, (-0.15 * draw + 0.3 * burst) * w, 0, 0);
    P.rot(b.head, (-0.2 * draw + 0.25 * burst) * w, Math.sin(t * 20) * 0.08 * burst * w, 0);
    for (let s = -1; s <= 1; s += 2) armRot(ctl, s, 0.4 * draw, 0.4, w, 0.6 * draw + 0.3 * burst);
    ctl.shake = Math.max(ctl.shake, (0.3 * draw + 1.2 * burst) * w);
    ctl.jaw = Math.max(ctl.jaw, (0.3 * draw + 0.8 * burst) * w);
  } },
  hit: { dur: 0.6, a: 0.05, d: 0.5, hit: 0, fn(ctl, a, w) { // bark-creak flinch: rocks back, crown shudders
    const P = ctl.pose, b = ctl.b, k = a.k, s = Math.sin(a.seed * 7.13) > 0 ? 1 : -1;
    const j = sstep(0, 0.15, k) * (1 - sstep(0.3, 1, k)) * w;
    P.rot(b.spine, -0.12 * j, 0.1 * s * j, 0.06 * s * j); P.rot(b.head, -0.2 * j, 0.15 * s * j, 0);
    armRot(ctl, -1, 0.3, 0.3, j, 0.25); armRot(ctl, 1, 0.3, 0.3, j, 0.25);
    ctl.shake = Math.max(ctl.shake, 0.6 * j); ctl.jaw = Math.max(ctl.jaw, 0.4 * j);
  } },
  knockback: { dur: 1.1, a: 0.03, d: 0.75, hit: 0, fn(ctl, a, w) { // stagger back a heavy step, arms windmilling
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const j = sstep(0, 0.1, k) * (1 - sstep(0.45, 1, k)) * w;
    P.move(b.hips, 0, -0.06 * j, 0.15 * j);
    P.rot(b.hips, -0.12 * j, 0, 0); P.rot(b.spine, -0.2 * j, 0, 0.05 * Math.sin(t * 6) * j); P.rot(b.head, -0.25 * j, 0, 0);
    armRot(ctl, -1, 1.2 + 0.4 * Math.sin(t * 7), 0.3, j, 0.6); armRot(ctl, 1, 1.0 + 0.4 * Math.sin(t * 7 + 2), 0.3, j, 0.6);
    ctl.shake = Math.max(ctl.shake, j); ctl.jaw = Math.max(ctl.jaw, 0.5 * j);
    legsPlant(ctl, j, 1.3, 0.15);
  } },
  knockdown: { dur: 1.2, hold: true, excl: true, state: true, fadeIn: 0.03, fadeOut: 0.05, hit: 0, fn(ctl, a, w) { // topples onto its back like a log, arms flung
    const k = a.k, t = a.t;
    fall(ctl, w, ease3(clamp01((k - 0.05) / 0.6)) * 1.35, 1, t, 0.5);
    ctl.jaw = Math.max(ctl.jaw, 0.5 * w);
  } },
  getup: { dur: 2.0, a: 0.001, d: 0.9, state: true, fn(ctl, a, w) { // rolls forward, heaves itself up on its knuckles
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const f = kf(k, [0, 0.35, 0.75, 1], [1.35, 0.9, 0.2, 0]);
    fall(ctl, w, f, 1, t, 0);
    const push = sstep(0.2, 0.45, k) * (1 - sstep(0.7, 0.95, k));
    for (let s = -1; s <= 1; s += 2) armRot(ctl, s, -0.6 * push, 0.4, w, 0.4 * push);
    ctl.shake = Math.max(ctl.shake, push * 0.6 * w);
  } },
  death: { dur: 3.0, hold: true, excl: true, state: true, fadeIn: 0.03, keep: true, start(ctl, a) { a.u.side = Math.sin(a.seed * 7.13) > 0 ? 1 : -1; }, fn(ctl, a, w) { // TIMBER: creaks, wobbles, then topples rigidly like a felled tree
    const k = a.k, t = a.t;
    const down = a.u.fromDown ? 1.35 : 0;
    // wobble (0–0.6 s), then accelerating rigid fall (0.6–1.5 s), impact bounce, settle
    const tip = down || (0.05 * Math.sin(t * 9) * (1 - sstep(0.4, 0.6, t)) + ease3(clamp01((t - 0.55) / 0.95)) * 1.5);
    const bounce = Math.sin(clamp01((t - 1.5) / 0.35) * Math.PI) * 0.12 * (t > 1.5 ? 1 : 0) + Math.sin(clamp01((t - 1.85) / 0.25) * Math.PI) * 0.04 * (t > 1.85 ? 1 : 0);
    fall(ctl, w, Math.min(1.5, tip) - bounce, a.u.side * 0.25, t, sstep(1.5, 1.9, t));
    const P = ctl.pose, b = ctl.b;
    // arms: flung up by the fall, then flop
    const fl = sstep(0.6, 1.2, t) * (1 - sstep(1.5, 1.7, t));
    for (let s = -1; s <= 1; s += 2) armRot(ctl, s, 1.4 * fl, 0.3, w, 0.8 * fl + 0.4 * sstep(1.5, 1.8, t));
    ctl.jaw = Math.max(ctl.jaw, (0.6 * sstep(0.2, 0.6, t) * (1 - sstep(1.5, 2.2, t)) + 0.3) * w);
    ctl.shake = Math.max(ctl.shake, (0.3 * (1 - sstep(0.4, 0.6, t)) + 1.2 * sstep(1.45, 1.5, t) * (1 - sstep(1.6, 2.4, t))) * w);
    ctl.glow = mix(ctl.glow, 0.05, sstep(1.4, 2.8, t) * w);
    ctl.grip = Math.max(ctl.grip, -0.5 * sstep(1.5, 2.0, t) * w);
  } },
  stun: { dur: 2.2, loop: true, state: true, fadeIn: 0.3, fadeOut: 0.3, fn(ctl, a, w) { // dazed: head lolling, crown drooping, arms hanging slack
    const P = ctl.pose, b = ctl.b, ph = a.t / 2.2 * TAU;
    P.move(b.hips, Math.sin(ph) * 0.05 * w, -0.08 * w, 0);
    P.rot(b.hips, 0, 0, Math.sin(ph) * 0.05 * w);
    P.rot(b.spine, 0.18 * w, 0, -Math.sin(ph) * 0.06 * w);
    P.rot(b.head, (0.25 + 0.1 * Math.sin(ph)) * w, 0.3 * Math.cos(ph) * w, 0.15 * Math.sin(ph) * w);
    armRot(ctl, -1, 0.05, 0.1, w, -0.05); armRot(ctl, 1, 0.05, 0.1, w, -0.05);
    ctl.jaw = Math.max(ctl.jaw, 0.35 * w); ctl.glow = mix(ctl.glow, 0.5 + 0.3 * Math.sin(a.t * 3), w);
    ctl.grip = Math.max(ctl.grip, -0.3 * w);
    legsPlant(ctl, 0.6 * w, 1.25, 0);
  } },
  spawn: { dur: 3.2, a: 0.001, d: 0.92, state: true, excl: true, fn(ctl, a, w) { // TEARS ITSELF OUT OF THE EARTH: crown first, arms rip free, heaves up, roars
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    // three heaves up out of the ground
    const y = kf(k, [0, 0.12, 0.3, 0.36, 0.52, 0.58, 0.72, 0.8, 1], [-2.9, -2.6, -2.1, -2.15, -1.2, -1.3, -0.1, 0.05, 0]);
    const jolt = Math.sin(t * 24) * 0.04 * (1 - sstep(0.7, 0.8, k)) * sstep(0.05, 0.15, k);
    P.move(b.hips, jolt, y * w, 0);
    P.rot(b.hips, (0.35 * (1 - sstep(0.55, 0.8, k))) * w, 0, jolt * 1.5 * w);
    P.rot(b.spine, (0.2 * (1 - sstep(0.5, 0.75, k))) * w, 0, 0);
    const reach = sstep(0.1, 0.25, k) * (1 - sstep(0.5, 0.65, k)), pull = sstep(0.25, 0.5, k) * (1 - sstep(0.65, 0.78, k));
    const roar = sstep(0.8, 0.86, k) * (1 - sstep(0.94, 1, k));
    for (let s = -1; s <= 1; s += 2) {
      const cl = Math.sin(t * 7 + (s > 0 ? 1.6 : 0));
      armRot(ctl, s, 2.6 * reach + (1.6 + 0.4 * cl) * pull + 0.8 * roar, 0.3 * reach + 0.8 * pull + 0.4 * roar, w, 0.3 + 0.3 * pull + 1.0 * roar);
    }
    P.rot(b.head, (-0.3 * roar + 0.3 * (1 - sstep(0.4, 0.7, k))) * w, 0, 0);
    ctl.grip = Math.max(ctl.grip, (pull - 0.5 * roar) * w);
    ctl.jaw = Math.max(ctl.jaw, (0.9 * roar + 0.3 * pull) * w);
    ctl.glow = mix(ctl.glow, 0.2 + 2.6 * roar + 0.8 * sstep(0.1, 0.5, k), w);
    ctl.shake = Math.max(ctl.shake, (0.5 + 0.5 * roar) * w);
    legsLocal(ctl, (1 - sstep(0.7, 0.82, k)) * w, 0.15, 1.1);
  } },
  idle_alt: { dur: 3.2, a: 0.15, d: 0.8, fn(ctl, a, w) { // creaking stretch: arms rise like boughs, crown rustles, head rolls
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const s = sstep(0.05, 0.4, k) * (1 - sstep(0.65, 0.95, k));
    P.rot(b.spine, -0.12 * s * w, 0, 0.05 * Math.sin(t * 1.5) * s * w);
    P.rot(b.head, (-0.25 * s) * w, 0.4 * Math.sin(t * 1.2) * s * w, 0.1 * s * w);
    armRot(ctl, -1, 1.8 * s, 0.5 * s, w, 0.9 * s); armRot(ctl, 1, 1.6 * s, 0.6 * s, w, 1.0 * s);
    ctl.grip = Math.max(ctl.grip, -0.5 * s * w); ctl.shake = Math.max(ctl.shake, 0.35 * s * w);
    ctl.jaw = Math.max(ctl.jaw, 0.35 * s * w);
  } },
  dormant: { dur: 1, hold: true, rest: true, fadeIn: 1.5, fadeOut: 1.2, fn(ctl, a, w) { // disguised as an old tree: rooted, arms up as boughs, eyes dark
    const P = ctl.pose, b = ctl.b;
    P.move(b.hips, 0, -0.12 * w, 0);
    P.rot(b.spine, -0.05 * w, 0, 0.04 * w); P.rot(b.head, 0.3 * w, 0, 0.08 * w);
    armRot(ctl, -1, 1.1, 0.9, w, 1.2, 0.3); armRot(ctl, 1, 0.9, 1.1, w, 1.35, -0.2);
    ctl.grip = Math.max(ctl.grip, -0.4 * w);
    ctl.glow = mix(ctl.glow, 0.03, w); ctl.dormant = Math.max(ctl.dormant, w);
    legsPlant(ctl, w, 1.15, 0);
  } },
};
/** rigid "timber" fall onto the back: angle φ (rad) about a pivot near the heels, twist = sideways component */
function fall(ctl, w, phi, twist, t, limp) {
  const P = ctl.pose, b = ctl.b;
  const hy = ctl.pose.rest[b.hips].y, py = 0.42, pz = 0.3; // pivot (behind the heels, trunk-radius high)
  const dy = hy - py, dz = 0.05 - pz;
  const c = Math.cos(phi), s = Math.sin(phi);
  const ny = py + dy * c - dz * s, nz = pz + dy * s + dz * c;
  P.move(b.hips, 0, (ny - hy) * w, (nz - 0.05) * w);
  P.rot(b.hips, phi * w, 0, 0.3 * twist * Math.min(1, phi) * w);
  P.rot(b.spine, 0.06 * limp * w, 0, 0); P.rot(b.head, -0.25 * limp * w, 0.3 * twist * limp * w, 0);
  legsLocal(ctl, w * sstep(0.05, 0.4, phi), 0.05, 1.15, 0);
}

const SPEC = {
  bones: { hips: 'hips', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head', jaw: 'jaw', armL: ['armUL', 'armLL', 'handL'], armR: ['armUR', 'armLR', 'handR'], crown: 'crown', lobeL: 'lobeL', lobeR: 'lobeR', fingL: 'fingL', fingR: 'fingR' },
  gait: {
    legs: [
      { id: 'L', chain: ['thighL', 'shinL', 'footL'], toe: LEG(-1).toe, body: 'hips', scap: 0.15, lift: 0.22, flex: 0.35, heel: 0.2, out: 0.2 },
      { id: 'R', chain: ['thighR', 'shinR', 'footR'], toe: LEG(1).toe, body: 'hips', scap: 0.15, lift: 0.22, flex: 0.35, heel: 0.2, out: 0.2 },
    ],
    maxStride: 1.3, fMin: 0.7, actV: 0.3,
    gaits: [
      { v: 0.8, f: 0.55, duty: 0.66, lift: 0.8, off: { L: 0, R: 0.5 }, bob: 0.06, bobF: 2, bobPh: 0.1, roll: 0.06, rollF: 1, rollPh: 0.25, sway: 0.06, swayF: 1, swayPh: 0.25, nod: 0.03, nodF: 2 },
      { v: 2.4, f: 0.85, duty: 0.56, lift: 1.1, off: { L: 0, R: 0.5 }, bob: 0.1, bobF: 2, bobPh: 0.2, roll: 0.07, rollF: 1, rollPh: 0.25, sway: 0.07, swayF: 1, swayPh: 0.25, nod: 0.04, nodF: 2 },
    ],
  },
  arm: { swing: 0.22, out: 0.12, elbow: 0.25, runSwing: 0.45, runOut: 0.1, runElbow: 0.4, combatUp: 0.35, combatElbow: 0.35, combatOut: 0.15 },
  lean: { walk: 0.06, run: 0.14, combat: 0.1 }, twist: 0.1, waddle: 0.06, crouch: 0.06, breathe: 0.01,
  fidgets: [{ name: 'idle_alt', w: 1 }], fidgetGap: 7, chargeK: 0.3,
  pose(ctl) {
    cancelRestOnMove(ctl);
    const P = ctl.pose, b = ctl.b;
    // hunched carriage; heart glow breathes
    P.rx(b.spine, 0.06); P.rx(b.neck, 0.08); P.rx(b.head, -0.05);
    ctl.glow *= 1 + 0.15 * Math.sin(ctl.t * 1.7) + 0.3 * ctl.combat;
    ctl.shake = 0; ctl.grip = 0.15 + 0.25 * ctl.combat; ctl.dormant = 0;
  },
  post(ctl, dt) {
    const P = ctl.pose, b = ctl.b, t = ctl.t;
    // crown: damped spring driven by gait sway, turning, acceleration and action shake (+ a slow breeze)
    const G = ctl.gait;
    const drive = -G.sway * 3 - ctl.turnSm * 0.08 + Math.sin(t * 0.7) * 0.02 * (1 - ctl.dormant * 0.7);
    ctl.crownV += ((drive - ctl.crownA) * 30 - ctl.crownV * 5) * dt; ctl.crownA += ctl.crownV * dt;
    const driveZ = G.bob * 2 - ctl.speedSm * 0.02;
    ctl.crownZV += ((driveZ - ctl.crownZ) * 25 - ctl.crownZV * 4) * dt; ctl.crownZ += ctl.crownZV * dt;
    const sh = ctl.shake, f1 = Math.sin(t * 23) * 0.05 * sh, f2 = Math.sin(t * 19 + 1) * 0.06 * sh;
    P.rot(b.crown, ctl.crownZ + f1 * 0.5, f2 * 0.4, ctl.crownA + f1);
    P.rot(b.lobeL, f2 + ctl.crownA * 0.5, 0, 0.05 * Math.sin(t * 1.1) + f1);
    P.rot(b.lobeR, -f1 + ctl.crownA * 0.5, 0, -0.05 * Math.sin(t * 1.3 + 1) - f2);
    // twig fingers: curl (grip > 0) or splay (grip < 0)
    const gp = ctl.grip;
    P.rot(b.fingL, 0.6 * gp, 0, -0.5 * gp); P.rot(b.fingR, 0.6 * gp, 0, 0.5 * gp);
  },
  actions: ACTIONS,
};
