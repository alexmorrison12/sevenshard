// Sunstag: LEGENDARY stag mount — tall and elegant (withers 1.55 m, antler crown ~2.8 m): long slender legs with gilded
// hooves, deep chest, tucked belly, a long neck with a golden throat ruff, a fine head with big dark eyes and large
// ears. Glowing golden antlers (emissive, bloom) crowned by orbiting light motes; a golden-white coat flecked with light;
// an ornate ivory-and-gold saddle, sun-embroidered saddle cloth, gold stirrups and a gilded bridle.
// Variants: dawn (golden-white, default), dusk (rose-gold), moon (silver-white, pale-blue light).
import * as THREE from 'three';
import { QuadCtl } from '../ctl.js';
import { leafGeo, sweep, bez, taper } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addEye } from '../../kit/parts.js';
import { addG, lock, strap, ribbon, surfAim, ring, smoothPath, pathSkin, mixSkin, rigidSkin, skinAt, marchOut, sdfNormal, Jiggle, lerp3, sstep, clamp01, mix, TAU } from './common.js';
import { saddleSet, sunEmblem } from './tack.js';
import { mRear, mJump, mGraze, mShake, mHit, mDeath, mSpawn, mBow, mWhinny, mPick, mountPose, counterScaleRider } from './mountacts.js';

const V3 = THREE.Vector3;
const PAL = {
  dawn: { coat: 0xf2dfb2, coat2: 0xd9b774, belly: 0xfffaf0, leg: 0xfff6e6, muzzle: 0xfff8ee, nose: 0x3a2a24, eye: 0x6a3a14, ruff: 0xfff4dc, ruffTip: 0xf0c060,
    antler: 0xffd46a, antlerBase: 0xc8963a, light: 0xffd88a, lightE: 1.7, fleck: 0xfff0b0, hoof: 0xe8b848,
    t: { leather: 0xf4ead8, seat: 0xe8dcc4, stitch: 0xd8a840, gold: 0xe8b848, cloth: 0xfaf6ec, cloth2: 0x2f7f8a, strap: 0xd8c8a8 } },
  dusk: { coat: 0xe9c3a6, coat2: 0xc98a6c, belly: 0xfff0e6, leg: 0xfbe8dc, muzzle: 0xfff2ea, nose: 0x3a2224, eye: 0x5a2014, ruff: 0xffe6da, ruffTip: 0xf08a70,
    antler: 0xffb08a, antlerBase: 0xb86a4a, light: 0xffa27a, lightE: 1.6, fleck: 0xffd8c0, hoof: 0xe89a6a,
    t: { leather: 0xf6e4dc, seat: 0xecd2c6, stitch: 0xd88a60, gold: 0xe8a060, cloth: 0xfaf0ea, cloth2: 0x7a2a4a, strap: 0xd8b8a8 } },
  moon: { coat: 0xe4e8f0, coat2: 0xaeb8cc, belly: 0xfafcff, leg: 0xf4f6fa, muzzle: 0xf8faff, nose: 0x2a2a34, eye: 0x1e2a44, ruff: 0xf6f8ff, ruffTip: 0x9ac4ff,
    antler: 0xcfe6ff, antlerBase: 0x8aa0c0, light: 0xa8d4ff, lightE: 1.8, fleck: 0xd8ecff, hoof: 0xc8d4e8,
    t: { leather: 0xeef0f6, seat: 0xdde2ec, stitch: 0x9ab4d8, gold: 0xc8d8f0, cloth: 0xf4f6fb, cloth2: 0x2a3a7a, strap: 0xc8ccd8 } },
};

const HP = [0, 2.1, -1.0], D = [0, -0.55, -0.835], NN = [0, 0.835, -0.55];
const H = (u, v, x = 0) => [HP[0] + x, HP[1] + u * D[1] + v * NN[1], HP[2] + u * D[2] + v * NN[2]];
const hsh = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const MOTES = 6;
const CROWN = [0, 2.62, -0.86]; // antler crown centre (rest)

export const sunstag = {
  name: 'Sunstag',
  variants: ['dawn', 'dusk', 'moon'],
  mount: true,
  config(variant) {
    const v = PAL[variant] ? variant : 'dawn';
    return { variant: v, pal: PAL[v], shapeKey: 'base', scale: 1, h: 0.062, hg: { 1: 0.036, 2: 0.034 }, aoScale: 1.2,
      grad: { top: 0.12, bottom: 0.22, y0: 0.1, y1: 1.0, low: 0.12 }, mat: { dfreq: 2.6, rim: 0.55, rimColor: 0xfff0c8, spec: 0.12, shine: 20 } };
  },
  rig(R) {
    R.add('body', null, [0, 1.2, 0.0]);
    R.add('chest', 'body', [0, 1.22, -0.4]);
    R.add('hips', 'body', [0, 1.24, 0.46]);
    R.add('seat', 'body', [0, 1.6, -0.1]);
    R.add('neck1', 'chest', [0, 1.46, -0.64]);
    R.add('neck2', 'neck1', [0, 1.8, -0.86]);
    R.add('head', 'neck2', HP);
    R.add('jaw', 'head', H(0.2, -0.08));
    R.add('earL', 'head', H(0.02, 0.02, -0.07)); R.add('earR', 'head', H(0.02, 0.02, 0.07));
    R.add('tail1', 'hips', [0, 1.42, 0.74]); R.add('tail2', 'tail1', [0, 1.34, 0.82]);
    for (let i = 0; i < MOTES; i++) { const a = i / MOTES * TAU; R.add('mote' + i, 'head', [CROWN[0] + Math.cos(a) * 0.36, CROWN[1] + (i % 2 ? 0.1 : -0.08), CROWN[2] + Math.sin(a) * 0.3]); }
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('fU' + n, 'chest', [0.14 * s, 1.2, -0.64]); R.add('fL' + n, 'fU' + n, [0.16 * s, 1.0, -0.47]); R.add('fM' + n, 'fL' + n, [0.15 * s, 0.52, -0.46]); R.add('fP' + n, 'fM' + n, [0.15 * s, 0.17, -0.49]);
      R.add('rT' + n, 'hips', [0.17 * s, 1.28, 0.5]); R.add('rS' + n, 'rT' + n, [0.19 * s, 0.98, 0.33]); R.add('rM' + n, 'rS' + n, [0.17 * s, 0.58, 0.68]); R.add('rP' + n, 'rM' + n, [0.16 * s, 0.17, 0.62]);
    }
  },
  sculpt(S, cfg) {
    const c = cfg.pal;
    const coat = [0.2, 0, 0.1, 0], coatS = [0.12, 0, 0.08, 0], hoof = [0, 0, 0.05, 0.2];
    // ---- torso: deep chest, tucked belly, round rump — lighter and finer than the horse
    S.ell('body', [0, 1.21, 0.0], [0.235, 0.25, 0.52], { k: 0.1, col: c.coat, tag: 'barrel', dtl: coat });
    S.ell('chest', [0, 1.19, -0.36], [0.245, 0.32, 0.29], { k: 0.1, col: c.coat, tag: 'barrel', dtl: coat });
    S.ell('chest', [0, 1.13, -0.58], [0.17, 0.22, 0.14], { k: 0.08, col: c.belly, tag: 'breast', dtl: coat });
    for (const s of [-1, 1]) S.ell('chest', [s * 0.15, 1.3, -0.48], [0.06, 0.24, 0.13], { k: 0.08, col: c.coat, tag: 'shoulder', rot: [0.55, 0, 0], dtl: coat });
    S.ell('chest', [0, 1.46, -0.4], [0.09, 0.09, 0.22], { k: 0.08, col: c.coat, tag: 'withers', dtl: coat });
    S.ell('body', [0, 1.38, 0.02], [0.16, 0.08, 0.38], { k: 0.1, col: c.coat, tag: 'back', dtl: coat });
    S.ell('hips', [0, 1.34, 0.44], [0.22, 0.17, 0.27], { k: 0.1, col: c.coat, tag: 'croup', dtl: coat });
    for (const s of [-1, 1]) S.ell('hips', [s * 0.13, 1.21, 0.52], [0.13, 0.25, 0.22], { k: 0.08, col: c.coat, tag: 'haunch', rot: [0.25, 0, 0], dtl: coat });
    S.ell('hips', [0, 1.25, 0.66], [0.17, 0.19, 0.12], { k: 0.08, col: c.coat, tag: 'buttock', dtl: coat });
    // short tail flag
    S.cone('tail1', [0, 1.42, 0.72], [0, 1.32, 0.86], 0.06, 0.05, { k: 0.04, col: c.coat, tag: 'tail', b2: 'tail2', t0: 0.4, t1: 1, dtl: coat });
    // ---- neck: long & slender, a golden throat ruff
    S.ell('neck1', [0, 1.46, -0.66], [0.145, 0.24, 0.17], { k: 0.1, col: c.coat, tag: 'neck', rot: [-0.8, 0, 0], dtl: coat });
    S.ell('neck2', [0, 1.8, -0.86], [0.098, 0.22, 0.12], { k: 0.08, col: c.coat, tag: 'neck', rot: [-0.42, 0, 0], dtl: coat });
    S.ell('neck2', [0, 2.02, -0.96], [0.075, 0.1, 0.085], { k: 0.06, col: c.coat, tag: 'neck', dtl: coat });
    for (let i = 0; i < 7; i++) { // throat ruff tufts
      const f = i / 6, z = mix(-0.98, -0.72, f), y = mix(1.9, 1.5, f), x = (i % 2 ? 1 : -1) * 0.035;
      S.cone(f < 0.5 ? 'neck2' : 'neck1', [x, y, z], [x * 2.4, y - 0.13 - 0.03 * Math.sin(f * 3), z + 0.02], 0.052, 0.01, { k: 0.04, col: c.ruff, tip: { col: c.ruffTip, from: 0.55 }, tag: 'ruff', dtl: [0.45, 0, 0.1, 0] });
    }
    // ---- upper legs (group 0)
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      S.ell('fU' + n, [s * 0.155, 1.09, -0.56], [0.075, 0.13, 0.095], { k: 0.07, col: c.coat, tag: 'arm', rot: [-0.7, 0, 0], dtl: coat });
      S.cone('fL' + n, [s * 0.16, 1.0, -0.48], [s * 0.15, 0.56, -0.46], 0.07, 0.04, { k: 0.05, col: c.coat, tag: 'forearm', b2: 'fM' + n, t0: 0.85, t1: 1, dtl: coat });
      S.ell('rT' + n, [s * 0.16, 1.1, 0.44], [0.1, 0.19, 0.15], { k: 0.08, col: c.coat, tag: 'thigh', rot: [-0.4, 0, 0], dtl: coat });
      S.cone('rS' + n, [s * 0.18, 0.95, 0.38], [s * 0.17, 0.62, 0.66], 0.085, 0.045, { k: 0.06, col: c.coat, tag: 'gaskin', b2: 'rM' + n, t0: 0.85, t1: 1, dtl: coat });
    }
    // ---- lower legs (group 1): fine cannons, neat fetlocks, small gilded cloven hooves
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R', g1 = { group: 1 };
      S.ell('fM' + n, [s * 0.15, 0.53, -0.46], [0.042, 0.06, 0.045], { ...g1, k: 0.025, col: c.leg, tag: 'knee', dtl: coatS });
      S.cone('fM' + n, [s * 0.15, 0.52, -0.46], [s * 0.15, 0.19, -0.485], 0.035, 0.029, { ...g1, k: 0.02, col: c.leg, tag: 'cannon', b2: 'fP' + n, t0: 0.85, t1: 1, dtl: coatS });
      S.ell('fP' + n, [s * 0.15, 0.165, -0.485], [0.036, 0.04, 0.042], { ...g1, k: 0.02, col: c.leg, tag: 'fetlock', dtl: coatS });
      S.cone('fP' + n, [s * 0.15, 0.16, -0.495], [s * 0.15, 0.07, -0.53], 0.026, 0.03, { ...g1, k: 0.02, col: c.leg, tag: 'pastern', dtl: coatS });
      S.cone('fP' + n, [s * 0.15, 0.065, -0.53], [s * 0.15, 0.0, -0.565], 0.034, 0.03, { ...g1, k: 0.01, col: c.hoof, tag: 'hoof', dtl: hoof });
      S.ell('rM' + n, [s * 0.17, 0.59, 0.68], [0.038, 0.06, 0.055], { ...g1, k: 0.025, col: c.leg, tag: 'hock', dtl: coatS });
      S.cone('rM' + n, [s * 0.17, 0.58, 0.67], [s * 0.16, 0.19, 0.62], 0.036, 0.029, { ...g1, k: 0.02, col: c.leg, tag: 'cannon', b2: 'rP' + n, t0: 0.85, t1: 1, dtl: coatS });
      S.ell('rP' + n, [s * 0.16, 0.165, 0.62], [0.036, 0.04, 0.042], { ...g1, k: 0.02, col: c.leg, tag: 'fetlock', dtl: coatS });
      S.cone('rP' + n, [s * 0.16, 0.16, 0.61], [s * 0.16, 0.07, 0.575], 0.026, 0.03, { ...g1, k: 0.02, col: c.leg, tag: 'pastern', dtl: coatS });
      S.cone('rP' + n, [s * 0.16, 0.065, 0.575], [s * 0.16, 0.0, 0.545], 0.034, 0.03, { ...g1, k: 0.01, col: c.hoof, tag: 'hoof', dtl: hoof });
    }
    S.box('fPL', [0, -0.06, 0], [0.6, 0.058, 1.2], 0, { group: 1, sub: true, k: 0.004, wmul: 0, col: c.hoof, tag: 'sole', cw: 0.2 });
    // ---- head (group 2): fine tapered head, big ears, soft muzzle
    const g2 = { group: 2 };
    const e = (u, v, x, r, o2) => S.ell('head', H(u, v, x), r, { ...g2, dir: D, ...o2 });
    e(0.07, 0, 0, [0.078, 0.08, 0.1], { k: 0.04, col: c.coat, tag: 'skull', dtl: coatS });
    for (const s of [-1, 1]) e(0.15, -0.045, s * 0.045, [0.04, 0.07, 0.08], { k: 0.035, col: c.coat, tag: 'jowl', dtl: coatS });
    S.cone('head', H(0.1, 0.02, 0), H(0.38, 0.0, 0), 0.058, 0.04, { ...g2, k: 0.04, col: c.coat, tag: 'face', dtl: coatS });
    e(0.41, -0.02, 0, [0.043, 0.048, 0.055], { k: 0.03, col: c.muzzle, tag: 'muzzle', dtl: coatS });
    S.sph('head', H(0.45, 0.005, 0), 0.026, { ...g2, k: 0.012, col: c.nose, tag: 'nose' });
    S.ell('jaw', H(0.38, -0.07, 0), [0.032, 0.026, 0.05], { group: 2, dir: D, k: 0.02, col: c.muzzle, tag: 'chin', dtl: coatS });
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, y, z] = v.p, [nx, ny, nz] = v.n, g = v.group;
    if (g === 0) {
      v.mix(c.coat2, sstep(0.5, 0.95, ny) * 0.28 * (1 - v.t('ruff')));
      v.mix(c.belly, sstep(-0.3, -0.8, ny) * 0.75 * (1 - v.t('ruff')));
      v.mix(c.belly, v.t('tail') * sstep(0.1, -0.5, ny + nz * 0.5) * 0.9);
      v.mix(c.leg, sstep(0.85, 0.62, y) * Math.min(1, v.t('forearm') + v.t('gaskin')) * 0.8);
      // light flecks: sparse glowing specks over the back & flanks
      // soft golden sheen on the back (the sparkles are separate tiny flecks, see parts)
      v.mix(c.fleck, sstep(0.75, 1, ny) * 0.25);
      if (v.t('ruff') > 0.3) v.emis = Math.max(v.emis, 0.25 * sstep(0.3, 0.9, v.t('ruff')));
    } else if (g === 1) {
      const ht = v.t('hoof') + v.t('sole');
      if (ht > 0.4) { v.emis = Math.max(v.emis, 0.35); v.mul(0.95 + 0.1 * Math.sin(y * 300)); }
    } else {
      const rx = x - HP[0], ry = y - HP[1], rz = z - HP[2];
      const hu = ry * D[1] + rz * D[2];
      const front = ny * NN[1] + nz * NN[2];
      v.mix(c.coat2, sstep(0.3, 0.9, front) * sstep(0.02, 0.3, hu) * 0.3);
      v.mix(c.muzzle, sstep(0.3, 0.4, hu) * 0.85);
      for (const s of [-1, 1]) { const e = H(0.14, 0.03, s * 0.068); const d = Math.hypot(x - e[0], y - e[1], z - e[2]); v.mix(0x2a1a14, (1 - sstep(0.026, 0.05, d)) * 0.55); }
      // sun mark on the brow
      const sm = 1 - sstep(0.018, 0.03, Math.hypot(rx, hu - 0.1) * (front > 0.3 ? 1 : 9));
      if (sm > 0.02) { v.mix(c.light, sm); v.emis = Math.max(v.emis, sm * 2.2); }
    }
    v.mul(1 + Math.sin(x * 9 + z * 5) * Math.sin(y * 7) * 0.03);
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, T = c.t, b = (n) => R.index(n), hs = rigidSkin(b('head'));
    // ---- eyes: large, dark and gentle with warm glints
    for (const s of [-1, 1]) addEye(acc, S, b('head'), H(0.14, 0.03, s * 0.066), [s, 0.05, -0.45], 0.027, { iris: c.eye, pupil: 0x080404, rim: 0x140c08, pupilA: 0.55, irisA: 0.95, sink: 0.4, group: 2, seg: 8, irisEmis: 0.3 });
    // ---- ears: big, leaf-shaped, pale inside
    for (const s of [-1, 1]) {
      const g = leafGeo(0.055, 0.17, 0.03, 0.8, 0.05, { nu: 4, nv: 5, pw: 0.8, tipW: 0.004 });
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.05, -s * 0.5, -s * 0.95, 'YXZ')); m.setPosition(...H(0.02, 0.02, s * 0.07));
      const co = col(c.coat), ci = col(c.belly), ct = col(c.coat2);
      addG(acc, g, { matrix: m, skin: rigidSkin(b(s < 0 ? 'earL' : 'earR')), dtl: [0.2, 0, 0.1, 0], color: (p, n, uv) => uv[0] >= 1 ? lerp3(co, ct, sstep(0.6, 1, uv[1])) : lerp3(ci, co, sstep(0.6, 0.95, (uv[0] % 1) * 2)) });
    }
    // ---- antlers: golden beams sweeping up & back with forward tines; emissive toward the tips (bloom)
    const ca = col(c.antler), cb = col(c.antlerBase), E = c.lightE;
    for (const s of [-1, 1]) {
      const base = H(-0.01, 0.05, s * 0.045);
      const beam = smoothPath([base, [s * 0.14, base[1] + 0.2, base[2] + 0.02], [s * 0.3, base[1] + 0.42, base[2] + 0.1], [s * 0.36, base[1] + 0.62, base[2] + 0.26], [s * 0.3, base[1] + 0.8, base[2] + 0.36]], 8);
      const rad = beam.map((_, i) => mix(0.03, 0.009, i / 7));
      addG(acc, sweep(beam, rad, { radial: 5, capStart: true }), { skin: hs, dtl: [0, 0, 0.1, 0.2], color: (p, n, uv) => lerp3(cb, ca, sstep(0, 0.5, uv[1])), emis: (p, uv) => E * (0.08 + 0.7 * sstep(0.35, 1, uv[1])) });
      const tines = [[0.18, [0.02, 0.14, -0.14], 0.14], [0.36, [0.05, 0.2, -0.12], 0.18], [0.55, [0.02, 0.2, -0.08], 0.16], [0.72, [0.08, 0.14, 0.02], 0.12], [0.88, [-0.02, 0.16, -0.02], 0.1]];
      for (const [t, d, L] of tines) {
        const k = t * 7, i0 = Math.floor(k), p0 = beam[i0].clone().lerp(beam[Math.min(7, i0 + 1)], k - i0);
        const dir = new V3(d[0] * s, d[1], d[2]).normalize();
        const tip = p0.clone().addScaledVector(dir, L), mid = p0.clone().addScaledVector(dir, L * 0.5).add(new V3(0, L * 0.12, 0));
        const r0 = mix(0.022, 0.01, t);
        addG(acc, sweep(bez(p0.toArray(), mid.toArray(), tip.toArray(), 4), taper(4, r0, 0.004), { radial: 4 }), { skin: hs, dtl: [0, 0, 0.1, 0.2], color: (p, n, uv) => lerp3(ca, col(0xffffff), 0.3 * uv[1]), emis: (p, uv) => E * (0.35 + 0.85 * uv[1] * uv[1]) });
      }
    }
    // ---- light motes (own bones, orbit the crown in pose())
    for (let i = 0; i < MOTES; i++) {
      const r = R.bones[b('mote' + i)].rest, g = new THREE.IcosahedronGeometry(0.022 + 0.008 * (i % 3), 0);
      addG(acc, g, { matrix: new THREE.Matrix4().makeTranslation(r.x, r.y, r.z), skin: rigidSkin(b('mote' + i)), color: c.light, emis: E * 2.2, dtl: [0, 0, 0, 0] });
    }
    // ---- flecks of light: tiny emissive diamonds scattered over the back, flanks & haunches
    {
      const dg = new THREE.BufferGeometry();
      const P0 = [], I0 = [];
      let n = 0;
      for (let i = 0; i < 44; i++) {
        const z = mix(-0.55, 0.62, hsh(i * 3 + 1)), a = mix(-1.35, 1.35, hsh(i * 3 + 2)), yc = z < -0.2 ? 1.2 : 1.22;
        const p = marchOut(S, [0, yc, z], [Math.sin(a), Math.cos(a), 0], 0, 1); if (!p) continue;
        if (Math.abs(a) < 0.95 && z > -0.5 && z < 0.2) continue; // under the saddle
        const nn = new V3(...sdfNormal(S, p, 0)), t1 = new V3().crossVectors(nn, new V3(0, 0, 1)).normalize(), t2 = new V3().crossVectors(nn, t1);
        const r = 0.011 + 0.01 * hsh(i * 7), q = new V3(...p).addScaledVector(nn, 0.004);
        const sk = skinAt(S, p), base = acc.count, cf = col(c.fleck), e = 1.6 + 1.6 * hsh(i * 11);
        for (const [du, dv] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
          const w = q.clone().addScaledVector(t1, du * r).addScaledVector(t2, dv * r * 0.6);
          acc.vert(w.x, w.y, w.z, nn.x, nn.y, nn.z, cf[0], cf[1], cf[2], sk.si, sk.sw, 0, 0, 0, 0, e, 0);
        }
        const A = acc.P, g = (k) => new V3(A[k * 3], A[k * 3 + 1], A[k * 3 + 2]);
        const fl = g(base + 1).sub(g(base)).cross(g(base + 2).sub(g(base))).dot(nn) < 0;
        if (!fl) { acc.tri(base, base + 1, base + 2); acc.tri(base, base + 2, base + 3); } else { acc.tri(base, base + 2, base + 1); acc.tri(base, base + 3, base + 2); }
        n++;
      }
      void dg; void P0; void I0; void n;
    }
    // ---- throat ruff & tail flag locks (soft light)
    const tb = rigidSkin(b('tail2')), tbs = rigidSkin(b('tail1'));
    for (let i = 0; i < 3; i++) lock(acc, smoothPath([[(i - 1) * 0.025, 1.42, 0.8], [(i - 1) * 0.04, 1.37, 0.9], [(i - 1) * 0.05, 1.27, 0.95]], 4), { r0: 0.03, r1: 0.008, bulge: 0.5, flat: 0.5, radial: 4, up: [0, 0, 1], c0: c.belly, c1: c.ruffTip, from: 0.6, skin: (tt) => mixSkin(tbs, tb, tt) });
    // ---- tack: sun-embroidered saddle cloth, ivory & gold saddle, gold girth / stirrups
    const clothM = col(T.cloth), clothA = col(T.cloth2), gold = col(T.gold);
    const ss = saddleSet(acc, S, {
      group: 0, axis: (z) => [0, z < -0.2 ? 1.22 : 1.2],
      pad: { z0: -0.5, z1: 0.18, th: (v) => 1.25 - 0.32 * Math.pow(Math.abs(v * 2 - 1), 3), main: T.cloth, trim: T.gold, trim2: T.cloth2, emisTrim: 0.35, hide: 0.22,
        pattern: (u, v) => { const ds = Math.abs(((u * 7) % 1) - 0.5) + Math.abs(((v * 5) % 1) - 0.5); return ds < 0.18 ? gold : lerp3(clothM, clothA, 0.04); } },
      seat: { z0: -0.42, z1: 0.1, th: (v) => 0.86 - 0.34 * Math.pow(Math.abs(v * 2 - 1), 2.2), nu: 9, nv: 9, off: 0.024, seatH: 0.018, thick: 0.026, pommel: 0.08, cantle: 0.09, leather: T.leather, seatCol: T.seat, stitch: T.gold, trimMetal: T.gold, emisTrim: 0.4, horn: true, hornTip: T.gold },
      girth: { z: -0.28, w: 0.06, color: T.gold },
      stirrup: { x: 0.28, y: 0.86, z: -0.16, r: 0.05, top: [0.22, 1.4, -0.16], metal: T.gold, leather: T.strap, skin: rigidSkin(b('body')) },
    });
    cfg.seat = ss.seat || [0, 1.6, -0.14];
    // ---- gilded bridle & reins
    const org = H(0.16, -0.02, 0);
    const brid = (pts, w = 0.02, o2 = org) => { const sp = surfAim(S, 2, o2, pts, 0.006); if (sp.length > 1) ribbon(acc, sp, w, { skin: hs, color: T.gold, emis: 0.3 }); };
    for (const s of [-1, 1]) brid([H(0.0, 0.0, s * 0.09), H(0.1, -0.02, s * 0.09), H(0.22, -0.02, s * 0.08), H(0.33, -0.03, s * 0.06), H(0.38, -0.05, s * 0.05)]);
    brid([H(0.04, 0.0, -0.09), H(0.05, 0.06, -0.05), H(0.05, 0.08, 0), H(0.05, 0.06, 0.05), H(0.04, 0.0, 0.09)], 0.022);
    { const nb = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * TAU; nb.push(H(0.3, Math.cos(a) * 0.12, Math.sin(a) * 0.12)); } brid(nb, 0.024, H(0.3, -0.02, 0)); }
    for (const s of [-1, 1]) ring(acc, H(0.38, -0.05, s * 0.048), [1, 0, 0], 0.018, 0.004, hs, T.gold, { rs: 3, ts: 8, emis: 0.4 });
    const horn = ss.horn || [0, 1.68, -0.4];
    const rstops = pathSkin([[0, hs], [0.16, hs], [0.36, rigidSkin(b('neck2'))], [0.66, rigidSkin(b('neck1'))], [0.88, rigidSkin(b('chest'))], [1, rigidSkin(b('body'))]]);
    for (const s of [-1, 1]) {
      const pts = smoothPath([H(0.38, -0.05, s * 0.05), H(0.3, -0.14, s * 0.07), [s * 0.1, 1.74, -0.98], [s * 0.15, 1.62, -0.78], [s * 0.14, 1.62, -0.56], [s * 0.06, horn[1] - 0.01, horn[2] - 0.01]], 10);
      strap(acc, pts, 0.018, 0.005, { up: [s, 0, 0], skin: (p, uv) => rstops(uv[1]), color: T.gold });
    }
    // sun medallion on the breast (bridle martingale)
    const mp = marchOut(S, [0, 1.16, -0.4], [0, 0.05, -1], 0, 1);
    if (mp) sunEmblem(acc, { p: [mp[0], mp[1], mp[2] - 0.012], n: [0, 0.05, -1], u: [1, 0, 0], v: [0, 1, 0] }, 0.07, skinAt(S, mp), T.gold, T.gold, { lift: 0, emis: 0.8 });
  },
  sockets(cfg) {
    return {
      head: ['head', CROWN], mouth: ['jaw', H(0.46, -0.05)], center: ['body', [0, 1.2, 0]], chest: ['chest', [0, 1.1, -0.7]],
      back: ['body', [0, 1.5, 0.14]], rider: ['seat', cfg.seat || [0, 1.6, -0.14]], tail: ['tail2', [0, 1.3, 0.9]], crown: ['head', CROWN],
    };
  },
  height: 2.8, radius: 0.55,
  controller(inst) {
    const c = new QuadCtl(inst, SPEC);
    c.jig = new Jiggle(c, JIG);
    counterScaleRider(inst);
    return c;
  },
  get actionList() { return ACTIONS; },
};

// ------------------------------------------------------------------------------------------------ animation
const legs = [
  { id: 'FL', chain: ['fUL', 'fLL', 'fML', 'fPL'], toe: [-0.15, 0, -0.55], body: 'chest', scap: 0.3, lift: 0.2, flex: 1.9, out: 0.02, metaK: 0.95, heel: 0.55 },
  { id: 'FR', chain: ['fUR', 'fLR', 'fMR', 'fPR'], toe: [0.15, 0, -0.55], body: 'chest', scap: 0.3, lift: 0.2, flex: 1.9, out: 0.02, metaK: 0.95, heel: 0.55 },
  { id: 'RL', chain: ['rTL', 'rSL', 'rML', 'rPL'], toe: [-0.16, 0, 0.555], body: 'hips', scap: 0.14, lift: 0.18, flex: 1.3, out: 0.06, metaK: 0.8, heel: 0.45 },
  { id: 'RR', chain: ['rTR', 'rSR', 'rMR', 'rPR'], toe: [0.16, 0, 0.555], body: 'hips', scap: 0.14, lift: 0.18, flex: 1.3, out: 0.06, metaK: 0.8, heel: 0.45 },
];
/** glow flare: antlers & motes blaze (rear / call / spawn) */
const flare = (ctl, k) => { ctl.glow = Math.max(ctl.glow, 1 + k); ctl.mote = Math.max(ctl.mote || 0, k); };
const REAR = mRear({ dur: 2.6, ang: 0.95, sit: 0.3, neck: 0.3, lift: 0.46, reach: 0.34, jaw: 0.8 });
const CALL = mWhinny({ dur: 2.0, jaw: 0.45 });
const SPAWN = mSpawn({ dur: 1.8, h: 1.1, glow: 3 });
const ACTIONS = {
  rear: { ...REAR, fn(ctl, a, w) { REAR.fn(ctl, a, w); flare(ctl, 1.6 * sstep(0.2, 0.4, a.k) * (1 - sstep(0.7, 0.95, a.k)) * w); } },
  call: { ...CALL, fn(ctl, a, w) { CALL.fn(ctl, a, w); flare(ctl, 1.2 * sstep(0.15, 0.3, a.k) * (1 - sstep(0.7, 0.9, a.k)) * w); } },
  bow: mBow({ dur: 2.8, pitch: 0.24 }),
  graze: mGraze({ dur: 4.6, neck: -1.72, neck2: -0.34, head: 1.08, chest: -0.2, drop: -0.07 }),
  shake: mShake({ dur: 1.6, amp: 0.8 }),
  jump: mJump({ dur: 1.3, h: 0.9, pitch: 0.35, tuck: 0.5, tuckH: 0.36 }),
  hit: mHit(),
  death: mDeath({ dur: 2.4, lieY: 0.36 }),
  spawn: { ...SPAWN, fn(ctl, a, w) { SPAWN.fn(ctl, a, w); flare(ctl, 2.5 * (1 - sstep(0.2, 0.9, a.k)) * w); } },
};
ACTIONS.idle_alt = mPick([ACTIONS.graze, ACTIONS.shake, { dur: 2.0, fn: ACTIONS.call.fn }], 3.2);

const JIG = [
  { bones: ['tail1', 'tail2'], anchor: 'tail1', k: 70, c: 8, g: 0.01, gi: 0.4, wind: 0.015, idle: 0.04, idleF: 2.2, max: 0.6 },
];

const SPEC = {
  bones: { body: 'body', hips: 'hips', chest: 'chest', neck: 'neck1', neck2: 'neck2', head: 'head', jaw: 'jaw', seat: 'seat', tail: ['tail1', 'tail2'], ears: ['earL', 'earR'],
    motes: Array.from({ length: MOTES }, (_, i) => 'mote' + i) },
  gait: {
    legs, maxStride: 1.5, actV: 0.3,
    gaits: [
      { v: 1.6, f: 1.15, duty: 0.62, lift: 0.85, off: { RL: 0, FL: 0.25, RR: 0.5, FR: 0.75 }, bob: 0.012, bobF: 2, bobPh: 0.1, roll: 0.014, rollF: 1, sway: 0.008, swayF: 1, nod: 0.03, nodF: 2, nodPh: 0.3 },
      { v: 4.0, f: 1.75, duty: 0.4, lift: 1.1, off: { FL: 0, RR: 0, FR: 0.5, RL: 0.5 }, bob: 0.02, bobF: 2, bobPh: 0.3, roll: 0.01, rollF: 1, nod: 0.015, nodF: 2, pitch: 0.008, pitchF: 2 },
      { v: 6.5, f: 2.0, duty: 0.3, lift: 1.25, off: { RL: 0, RR: 0.28, FL: 0.3, FR: 0.56 }, bob: 0.05, bobF: 1, bobPh: 0.55, pitch: 0.07, pitchF: 1, pitchPh: 0.1, flex: 0.05, flexF: 1, nod: 0.04, nodF: 1, nodPh: 0.6, lean: 0.03 },
      { v: 10, f: 2.35, duty: 0.24, lift: 1.4, off: { RL: 0, RR: 0.06, FL: 0.48, FR: 0.54 }, bob: 0.05, bobF: 1, bobPh: 0.62, pitch: 0.07, pitchF: 1, pitchPh: 0.05, flex: 0.08, flexF: 1, flexPh: 0.2, nod: 0.05, nodF: 1, nodPh: 0.8, lean: 0.05 },
    ],
  },
  neck: { pitch: 0.05, run: -0.12, combat: 0, walk: -0.03, headCombat: 0, comp: 0.5, stab: 0.8 },
  tail: { wag: 0.12, wagF: 1.1, run: 0.4, combat: 0, base: 0 },
  combatCrouch: 0, combatPitch: 0, runDrop: 0.03, breathe: 0.01,
  fidgets: [{ name: 'graze', w: 2 }, { name: 'shake', w: 1 }, { name: 'call', w: 0.6 }],
  fidgetGap: 5,
  pose(ctl, dt) {
    mountPose(ctl, dt, POSE);
    ctl.glow = 1 + 0.12 * Math.sin(ctl.t * 1.7) + 0.06 * Math.sin(ctl.t * 4.3);
    ctl.mote = 0;
  },
  post(ctl, dt) {
    // light motes orbit the antler crown (in the head frame); they swirl wider & faster when the stag flares or runs
    const P = ctl.pose, M = ctl.b.motes, t = ctl.t, fl = (ctl.mote || 0) + 0.4 * ctl.run;
    for (let i = 0; i < M.length; i++) {
      const sp = 0.6 + 0.25 * (i % 3) + fl * 0.8, ph = i * 1.9, a = t * sp + ph, r = 0.06 + 0.05 * Math.sin(t * 0.7 + i) + fl * 0.08;
      P.move(M[i], Math.cos(a) * r, Math.sin(t * (1.1 + 0.2 * i) + ph) * 0.07 + fl * 0.05, Math.sin(a) * r);
      P.sc[M[i]].setScalar(0.8 + 0.3 * Math.sin(t * 3 + i * 2) + fl * 0.4);
    }
    if (ctl.dead) for (let i = 0; i < M.length; i++) P.sc[M[i]].multiplyScalar(Math.max(0.05, 1 - ((ctl.acts.get('death')?.t) ?? 0) * 0.5));
  },
  actions: ACTIONS,
};
const POSE = { nodWalk: 0.04, swing: 0.1, earBase: -0.1, earRun: 0.25, seatK: 0.55, rollK: 0.5, bobK: 0.3, pant: 0.015 };
