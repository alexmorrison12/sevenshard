// Imp: small winged fodder demon (~1 m). Big horned head with bat ears and a wide glowing grin, ember eyes, pot belly,
// long arms with hooked claws, short digitigrade legs, spade tail, bat wings. Scampers, flies when asked.
// Variants: red (default), ash, violet; elite: overseer (×1.35, four horns, gold bands, white-hot eyes).
import * as THREE from 'three';
import { BipedCtl, armRot, legsLocal, legsPlant } from '../ctl.js';
import { bHit, bKnockback, bKnockdown, bGetup, bDeath, bStun, bSpawn, bDrop, bRoar } from '../acts.js';
import { sweep, rigid, bez, taper, leafGeo } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addEye, addHorn, lerp3 } from '../../kit/parts.js';
import { wingLayout, batWing, orb } from '../parts2.js';
import { sstep, clamp01, mix } from '../../kit/rig.js';

const PAL = {
  red: { skin: 0xa8262c, dark: 0x3a0a14, belly: 0xd8654a, horn: 0x241414, hornTip: 0xe8d4b0, claw: 0x1c1010, wing: 0x8a1a22, wing2: 0xe0502a, eye: 0xffc83a, glow: 0xff6a10, mouth: 0xff5a10, ear: 0xd86050 },
  ash: { skin: 0x4e4644, dark: 0x191517, belly: 0x8a7a6e, horn: 0x100c0c, hornTip: 0xd8c4a0, claw: 0x0c0808, wing: 0x3a2222, wing2: 0x9a4028, eye: 0xffa020, glow: 0xff5a10, mouth: 0xff6010, ear: 0x8a5048 },
  violet: { skin: 0x62308a, dark: 0x1e0c34, belly: 0xa06abc, horn: 0x160c1e, hornTip: 0xe0d0f0, claw: 0x120a18, wing: 0x4a1a6a, wing2: 0xb050e8, eye: 0x8af4ff, glow: 0xb040ff, mouth: 0xd040ff, ear: 0xb070c8 },
  overseer: { skin: 0x7c1420, dark: 0x2a060c, belly: 0xc04a3a, horn: 0x140a0a, hornTip: 0xfff0c8, claw: 0x100808, wing: 0x5a0a12, wing2: 0xd8402a, eye: 0xfff0b0, glow: 0xff8a2a, mouth: 0xff7a1a, ear: 0xc05048, gold: 0xf0b83a },
};

const DY = -0.065; // upper body offset (short legs)
const U = (x, y, z) => [x, y + DY, z];
const WING = { S: U(0.055, 0.7, 0.075), out: [1, 0.55, 0.55], up: [-0.1, 1, 0.25], wrist: [0.2, 0.1], tips: [[0.46, 0.2], [0.5, -0.02], [0.4, -0.2], [0.22, -0.3]], body: [0.02, -0.2], cup: 0.07 };
const wl = (s) => wingLayout(s, WING);

export const imp = {
  name: 'Imp',
  variants: ['red', 'ash', 'violet', 'overseer'],
  canFly: true,
  config(variant, opts) {
    const v = PAL[variant] ? variant : (opts.elite ? 'overseer' : 'red');
    const elite = v === 'overseer' || !!opts.elite;
    return { variant: v, pal: PAL[v === 'red' && elite ? 'overseer' : v], elite, shapeKey: elite ? 'elite' : 'base', scale: elite ? 1.35 : 1, h: 0.025, hg: { 1: 0.019 }, mat: { dfreq: 4.5, furAxis: 1, rim: 0.35, rimColor: 0xffb080 } };
  },
  rig(R) {
    R.add('hips', null, [0, 0.39, 0.03]);
    R.add('spine', 'hips', U(0, 0.54, 0.02));
    R.add('chest', 'spine', U(0, 0.64, -0.01));
    R.add('neck', 'chest', U(0, 0.71, -0.04));
    R.add('head', 'neck', U(0, 0.78, -0.07));
    R.add('jaw', 'head', U(0, 0.765, -0.1));
    R.add('earL', 'head', U(-0.1, 0.855, -0.06)); R.add('earR', 'head', U(0.1, 0.855, -0.06));
    R.add('tail1', 'hips', [0, 0.37, 0.1]); R.add('tail2', 'tail1', [0, 0.31, 0.24]); R.add('tail3', 'tail2', [0, 0.27, 0.38]); R.add('tail4', 'tail3', [0, 0.26, 0.52]);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('armU' + n, 'chest', U(s * 0.115, 0.685, -0.02)); R.add('armL' + n, 'armU' + n, U(s * 0.2, 0.52, 0.0)); R.add('hand' + n, 'armL' + n, U(s * 0.235, 0.37, -0.07));
      R.add('thigh' + n, 'hips', [s * 0.075, 0.375, 0.03]); R.add('shin' + n, 'thigh' + n, [s * 0.1, 0.235, -0.06]); R.add('meta' + n, 'shin' + n, [s * 0.1, 0.105, 0.045]); R.add('foot' + n, 'meta' + n, [s * 0.1, 0.035, -0.01]);
      const L = wl(s);
      R.add('wing1' + n, 'chest', L.S.toArray()); R.add('wing2' + n, 'wing1' + n, L.W.toArray());
    }
  },
  sculpt(S, cfg) {
    const c = cfg.pal, E = cfg.elite;
    const sk = [0.05, 0.22, 0.2, 0], skS = [0.02, 0.14, 0.16, 0];
    // torso: narrow ribcage, pot belly, small pelvis
    S.ell('chest', U(0, 0.645, -0.01), [0.112, 0.092, 0.088], { k: 0.05, col: c.skin, tag: 'body', dtl: sk });
    for (const s of [-1, 1]) S.ell('chest', U(s * 0.095, 0.675, -0.005), [0.045, 0.04, 0.05], { k: 0.04, col: c.skin, tag: 'shoulder', dtl: sk });
    S.ell('spine', U(0, 0.55, -0.04), [0.105, 0.095, 0.1], { k: 0.05, col: c.belly, tag: 'belly', dtl: skS });
    S.ell('hips', [0, 0.405, 0.03], [0.09, 0.065, 0.072], { k: 0.045, col: c.skin, tag: 'body', dtl: sk });
    S.cone('chest', U(0, 0.67, 0.06), U(0, 0.52, 0.08), 0.03, 0.02, { k: 0.04, col: c.dark, tag: 'ridge', dtl: sk });
    // neck + big head
    S.cone('neck', U(0, 0.68, -0.025), U(0, 0.78, -0.07), 0.048, 0.045, { k: 0.04, col: c.skin, b2: 'head', t0: 0.5, t1: 1, dtl: sk });
    S.ell('head', U(0, 0.845, -0.075), [0.115, 0.1, 0.108], { k: 0.05, col: c.skin, tag: 'head', dtl: sk });
    S.ell('head', U(0, 0.875, -0.02), [0.095, 0.085, 0.08], { k: 0.05, col: c.dark, tag: 'skull', dtl: sk });
    S.ell('head', U(0, 0.872, -0.152), [0.09, 0.03, 0.04], { k: 0.025, col: c.dark, tag: 'brow', rot: [-0.25, 0, 0], dtl: skS });
    for (const s of [-1, 1]) {
      S.ell('head', U(s * 0.066, 0.8, -0.13), [0.044, 0.038, 0.042], { k: 0.03, col: c.skin, tag: 'cheek', dtl: skS });
      S.cone('head', U(s * 0.07, 0.8, -0.1), U(s * 0.13, 0.79, -0.04), 0.03, 0.01, { k: 0.02, col: c.skin, tag: 'cheek', dtl: skS });
    }
    S.cone('head', U(0, 0.818, -0.15), U(0, 0.8, -0.205), 0.046, 0.032, { k: 0.03, col: c.skin, tag: 'snout', dtl: skS });
    S.ell('head', U(0, 0.806, -0.21), [0.03, 0.022, 0.018], { k: 0.012, col: c.dark, tag: 'nose', dtl: skS });
    for (const s of [-1, 1]) S.sph('head', U(s * 0.012, 0.803, -0.226), 0.008, { k: 0.006, sub: true, col: 0x200808, tag: 'nostril' });
    // wide grin carved into the head (lower jaw is its own surface)
    S.ell('head', U(0, 0.77, -0.15), [0.085, 0.02, 0.07], { k: 0.012, sub: true, col: c.mouth, tag: 'mouth' });
    S.ell('jaw', U(0, 0.746, -0.13), [0.08, 0.03, 0.07], { group: 1, k: 0.025, col: c.skin, tag: 'jaw', dtl: skS });
    S.cone('jaw', U(0, 0.74, -0.16), U(0, 0.716, -0.2), 0.03, 0.012, { group: 1, k: 0.02, col: c.skin, tag: 'chin', dtl: skS });
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      // arms: long, sinewy, dark forearms and hands
      S.cone('armU' + n, U(s * 0.115, 0.685, -0.02), U(s * 0.2, 0.52, 0.0), 0.036, 0.027, { k: 0.025, col: c.skin, b2: 'armL' + n, t0: 0.8, t1: 1, dtl: sk });
      S.cone('armL' + n, U(s * 0.2, 0.52, 0.0), U(s * 0.235, 0.375, -0.065), 0.028, 0.023, { k: 0.02, col: c.skin, tag: 'fore', tip: { col: c.dark, from: 0.45 }, b2: 'hand' + n, t0: 0.85, t1: 1, dtl: sk });
      S.ell('hand' + n, U(s * 0.238, 0.35, -0.08), [0.03, 0.036, 0.028], { k: 0.014, col: c.dark, tag: 'hand', dtl: skS });
      // legs: chunky thighs, short digitigrade shins, big clawed feet
      S.cone('thigh' + n, [s * 0.075, 0.375, 0.03], [s * 0.1, 0.235, -0.06], 0.052, 0.036, { k: 0.035, col: c.skin, b2: 'shin' + n, t0: 0.8, t1: 1, dtl: sk });
      S.cone('shin' + n, [s * 0.1, 0.235, -0.06], [s * 0.1, 0.105, 0.045], 0.031, 0.021, { k: 0.02, col: c.skin, tag: 'leg', tip: { col: c.dark, from: 0.4 }, b2: 'meta' + n, t0: 0.85, t1: 1, dtl: sk });
      S.cone('meta' + n, [s * 0.1, 0.105, 0.045], [s * 0.1, 0.035, -0.01], 0.021, 0.019, { k: 0.015, col: c.dark, tag: 'leg', b2: 'foot' + n, t0: 0.8, t1: 1, dtl: skS });
      S.ell('foot' + n, [s * 0.1, 0.024, -0.045], [0.032, 0.023, 0.056], { k: 0.015, col: c.dark, tag: 'foot', dtl: skS });
    }
    // tail
    S.cone('tail1', [0, 0.37, 0.08], [0, 0.31, 0.24], 0.026, 0.02, { k: 0.02, col: c.skin, tag: 'tail', b2: 'tail2', t0: 0.6, t1: 1, dtl: sk });
    S.cone('tail2', [0, 0.31, 0.24], [0, 0.27, 0.38], 0.02, 0.015, { k: 0.015, col: c.skin, tag: 'tail', b2: 'tail3', t0: 0.6, t1: 1, dtl: sk });
    S.cone('tail3', [0, 0.27, 0.38], [0, 0.26, 0.52], 0.015, 0.011, { k: 0.012, col: c.dark, tag: 'tail', b2: 'tail4', t0: 0.6, t1: 1, dtl: sk });
    if (E) for (const s of [-1, 1]) S.ell('chest', U(s * 0.1, 0.7, 0.0), [0.055, 0.045, 0.06], { k: 0.04, col: c.dark, tag: 'shoulder', dtl: sk });
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, y0, z] = v.p, [nx, ny, nz] = v.n;
    const y = y0 - DY; // paint in pre-offset coordinates for the upper body
    if (v.group === 0) {
      // darker back / skull, lighter throat & belly
      v.mix(c.dark, sstep(0.25, 0.85, nz) * sstep(0.45, 0.62, y) * 0.55 * (1 - v.t('belly')));
      v.mix(c.belly, sstep(-0.1, -0.7, nz) * sstep(0.62, 0.75, y) * (1 - sstep(0.76, 0.8, y)) * 0.5);
      // ember veins: branching cracks on the forearms, flanks and thighs
      const n1 = Math.sin(y * 70 + Math.sin(x * 40 + z * 30) * 2.2) * Math.sin(x * 55 - z * 48 + y * 12);
      const crack = 1 - sstep(0.0, 0.12, Math.abs(n1));
      const where = Math.max(v.t('fore') * sstep(0.46 + DY, 0.4 + DY, y0), sstep(0.55, 0.9, Math.abs(nx)) * v.t('body') * sstep(0.55, 0.6, y) * (1 - sstep(0.68, 0.72, y)), v.t('leg') * 0.8);
      const glow = crack * where;
      if (glow > 0.02) { v.mix(c.glow, glow * 0.9); v.emis = Math.max(v.emis, glow * 1.3); }
      if (v.t('mouth') > 0.25) { v.mix(c.mouth, 0.95); v.emis = Math.max(v.emis, 2.2 * v.t('mouth')); }
      v.mix(0x100404, v.t('nostril') * 0.9);
      for (const s of [-1, 1]) { const d = Math.hypot(x - s * 0.05, y - 0.835, z + 0.17); v.mix(c.dark, (1 - sstep(0.028, 0.048, d)) * 0.85); }
    }
    if (v.group === 1 && ny > 0.35 && z < -0.08) { v.mix(c.mouth, 0.9); v.emis = 1.8; }
    v.mul(1 + Math.sin(x * 23 + z * 17) * Math.sin(y * 19) * 0.05);
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n), E = cfg.elite;
    for (const s of [-1, 1]) addEye(acc, S, b('head'), U(s * 0.05, 0.832, -0.17), [s * 0.45, 0.08, -1], 0.024, { iris: c.eye, pupil: 0x2a0800, rim: 0x1a0606, pupilA: 0.25, irisA: 1.2, glow: E ? 4.5 : 3.0, sink: 0.45, seg: 10 });
    // bat ears
    for (const s of [-1, 1]) {
      const g = leafGeo(0.052, 0.14, 0.02, 0.8, -0.1, { nu: 5, nv: 5, pw: 1.2, tipW: 0.003 });
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.25, s * 0.45, -s * 1.2, 'YXZ')); m.setPosition(...U(s * 0.095, 0.85, -0.055));
      const outer = col(c.skin), inner = col(c.ear), rim = col(c.dark);
      acc.add(g, { matrix: m, skin: rigid(b(s < 0 ? 'earL' : 'earR')), dtl: [0, 0.15, 0.15, 0], color: (p, n, uv) => uv[0] >= 1 ? lerp3(outer, rim, sstep(0.4, 1, uv[1])) : lerp3(inner, rim, Math.max(sstep(0.6, 0.95, (uv[0] % 1) * 2), sstep(0.7, 1, uv[1]))) });
      if (E) { const ring = new THREE.TorusGeometry(0.016, 0.005, 4, 10); const m2 = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(...U(s * 0.16, 0.822, -0.05)); acc.add(ring, { matrix: m2, skin: rigid(b(s < 0 ? 'earL' : 'earR')), color: c.gold, dtl: [0, 0, 0.1, 0] }); }
    }
    const hs = E ? 1.25 : 1;
    for (const s of [-1, 1]) {
      addHorn(acc, b('head'), U(s * 0.05, 0.915, -0.115), U(s * 0.11 * hs, 1.0, -0.1), U(s * 0.13 * hs, 1.03 + 0.05 * (hs - 1), 0.02), 0.025 * hs, 0.003, { base: c.horn, tip: c.hornTip, radial: 6, n: 6, gpow: 1.6 });
      if (E) addHorn(acc, b('head'), U(s * 0.085, 0.88, -0.05), U(s * 0.16, 0.9, -0.02), U(s * 0.2, 0.96, 0.06), 0.018, 0.003, { base: c.horn, tip: c.hornTip, radial: 5, n: 5, gpow: 1.6 });
    }
    const tc = col(0xf4ead0), tb = col(0xc0a880);
    for (let i = 0; i < 6; i++) {
      const a = -0.95 + i * 0.38, x = Math.sin(a) * 0.07, z = -0.15 - Math.cos(a) * 0.058;
      acc.add(sweep([U(x, 0.786, z), U(x * 1.02, 0.758, z - 0.004)], [0.008, 0.001], { radial: 4 }), { skin: rigid(b('head')), color: (p, n, uv) => lerp3(tb, tc, uv[1]), dtl: [0, 0, 0, 0] });
    }
    for (const s of [-1, 1]) acc.add(sweep(bez(U(s * 0.052, 0.746, -0.178), U(s * 0.058, 0.77, -0.183), U(s * 0.054, 0.792, -0.175), 3), taper(3, 0.011, 0.002), { radial: 4 }), { skin: rigid(b('jaw')), color: (p, n, uv) => lerp3(tb, tc, uv[1]), dtl: [0, 0, 0, 0] });
    // hooked talons
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R', hx = s * 0.238;
      for (let f = -1; f <= 1; f++) {
        const x0 = hx + f * 0.017, z0 = -0.095;
        addHorn(acc, b('hand' + n), U(x0, 0.33, z0), U(x0 + f * 0.012, 0.27, z0 - 0.045), U(x0 + f * 0.018, 0.24, z0 - 0.012), 0.012, 0.001, { base: c.dark, tip: c.claw, radial: 4, n: 4 });
      }
      addHorn(acc, b('hand' + n), U(hx - s * 0.02, 0.345, -0.09), U(hx - s * 0.035, 0.315, -0.125), U(hx - s * 0.03, 0.3, -0.115), 0.009, 0.001, { base: c.dark, tip: c.claw, radial: 4, n: 3 });
      for (let f = -1; f <= 1; f++) addHorn(acc, b('foot' + n), [s * 0.1 + f * 0.019, 0.018, -0.09], [s * 0.1 + f * 0.025, 0.012, -0.116], [s * 0.1 + f * 0.027, 0.002, -0.121], 0.01, 0.001, { base: c.dark, tip: c.claw, radial: 4, n: 3 });
    }
    // spade tail tip with a glowing notch
    {
      const g = leafGeo(0.048, 0.085, 0.012, 0.1, 0, { nu: 5, nv: 4, pw: 0.6, tipW: 0.001 });
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI / 2 + 0.25, 0, 0, 'YXZ')); m.setPosition(0, 0.26, 0.51);
      acc.add(g, { matrix: m, skin: rigid(b('tail4')), color: c.dark, dtl: [0, 0.2, 0.1, 0] });
      orb(acc, [0, 0.255, 0.545], 0.01, rigid(b('tail4')), c.glow, 3, 0);
    }
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      batWing(acc, wl(s), { chest: b('chest'), w1: b('wing1' + n), w2: b('wing2' + n) }, { bone: c.dark, membrane: c.wing, membrane2: c.wing2, claw: c.claw, emis: 0.16 }, { armR: 0.013, fingR: 0.0065, scallop: 0.25, rings: 3, nsc: 3 });
    }
    if (E) {
      for (const s of [-1, 1]) {
        const ring = new THREE.TorusGeometry(0.031, 0.007, 4, 12);
        const m = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0.035, -0.145, -0.065).normalize())).setPosition(...U(s * 0.222, 0.44, -0.035));
        acc.add(ring, { matrix: m, skin: rigid(b('armL' + (s < 0 ? 'L' : 'R'))), color: c.gold, dtl: [0, 0, 0.1, 0] });
      }
      const belt = new THREE.TorusGeometry(0.094, 0.008, 4, 20);
      acc.add(belt, { matrix: new THREE.Matrix4().makeRotationX(Math.PI / 2 - 0.1).setPosition(0, 0.43, 0.0), skin: rigid(b('hips')), color: c.gold, dtl: [0, 0, 0.1, 0] });
      orb(acc, [0, 0.43, -0.094], 0.018, rigid(b('hips')), c.glow, 3.5, 1);
    }
  },
  sockets: {
    head: ['head', U(0, 1.0, -0.07)], mouth: ['jaw', U(0, 0.76, -0.2)], center: ['chest', U(0, 0.6, -0.03)], chest: ['chest', U(0, 0.62, -0.1)],
    back: ['chest', U(0, 0.68, 0.1)], handR: ['handR', U(0.238, 0.33, -0.1)], handL: ['handL', U(-0.238, 0.33, -0.1)],
  },
  height: 0.98, radius: 0.33,
  controller(inst) { return new BipedCtl(inst, IMP_SPEC); },
  get actionList() { return ACTIONS; },
};

// ------------------------------------------------------------------------------------------------ animation
const ACTIONS = {
  attack: { dur: 0.62, a: 0.06, d: 0.82, hit: 0.45, fn(ctl, a, w) { // right-claw diagonal rake
    const P = ctl.pose, b = ctl.b, k = a.k;
    const wind = sstep(0, 0.38, k) * (1 - sstep(0.38, 0.5, k)), sw = sstep(0.38, 0.52, k), rec = sstep(0.62, 1, k);
    const u = (1 - rec);
    P.move(b.hips, 0, -0.02 * wind * w, (0.03 * wind - 0.08 * sw * u) * w);
    P.rot(b.spine, (0.1 * wind - 0.25 * sw * u) * w, (0.45 * wind - 0.5 * sw * u) * w, 0);
    P.rot(b.chest, -0.1 * sw * u * w, (0.25 * wind - 0.35 * sw * u) * w, 0);
    P.rot(b.head, (0.15 * wind - 0.1 * sw * u) * w, (-0.3 * wind + 0.3 * sw * u) * w, 0);
    armRot(ctl, 1, mix(2.4 * wind, 0.6, sw) * u + 0.2 * rec, mix(0.9 * wind, 0.1, sw) * u, w, mix(0.8 * wind, -0.5, sw) * u, 0);
    armRot(ctl, -1, 0.5 * wind + 0.3 * sw * u, 0.8, w, 0.4);
    ctl.jaw = Math.max(ctl.jaw, (0.3 * wind + 0.6 * sw * u) * w); ctl.ear = mix(ctl.ear, 1.2, w);
    ctl.wingSpread = mix(ctl.wingSpread, 0.8 * wind + 0.4 * sw * u, w);
  } },
  attack2: { dur: 0.85, a: 0.05, d: 0.85, hit: 0.5, fn(ctl, a, w) { // pounce: crouch, hop forward, double downward slash
    const P = ctl.pose, b = ctl.b, k = a.k, H = ctl.H;
    const crouch = sstep(0, 0.25, k) * (1 - sstep(0.25, 0.35, k)) + sstep(0.55, 0.62, k) * (1 - sstep(0.7, 0.95, k)) * 0.8;
    const hop = Math.sin(clamp01((k - 0.28) / 0.28) * Math.PI);
    const fwd = sstep(0.28, 0.56, k) * (1 - sstep(0.75, 1, k));
    const slash = sstep(0.4, 0.52, k) * (1 - sstep(0.75, 1, k)), up = sstep(0.15, 0.35, k) * (1 - sstep(0.4, 0.5, k));
    P.move(b.hips, 0, (-0.12 * crouch + 0.22 * hop) * H * w, -0.35 * fwd * H * w);
    P.rx(b.hips, (-0.2 * crouch - 0.3 * hop) * w);
    P.rx(b.spine, (-0.2 * slash + 0.2 * up) * w);
    for (let s = -1; s <= 1; s += 2) armRot(ctl, s, 2.6 * up + 0.5 * slash, 0.6 * up + 0.2 * slash, w, 0.5 * up + 0.1 * slash);
    ctl.jaw = Math.max(ctl.jaw, 0.7 * (up + slash) * w);
    ctl.wingSpread = mix(ctl.wingSpread, 1.1 * hop, w); ctl.flap = Math.max(ctl.flap, hop * w);
    legsLocal(ctl, hop * w, 0.35, 1.1);
  } },
  attack_big: { dur: 1.7, a: 0.06, d: 0.9, hit: 0.72, fn(ctl, a, w) { // conjure a fireball overhead (long, readable windup) → hurl
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t, H = ctl.H;
    const wind = sstep(0, 0.35, k) * (1 - sstep(0.66, 0.72, k));
    const tremble = sstep(0.4, 0.66, k) * (1 - sstep(0.66, 0.7, k)) * Math.sin(t * 60) * 0.04;
    const hurl = sstep(0.66, 0.74, k) * (1 - sstep(0.82, 1, k));
    P.move(b.hips, 0, -0.03 * H * wind * w, (0.05 * wind - 0.1 * hurl) * H * w);
    P.rot(b.spine, (0.3 * wind - 0.45 * hurl + tremble) * w, 0, tremble * w);
    P.rx(b.chest, (0.15 * wind - 0.2 * hurl) * w);
    P.rot(b.head, (0.35 * wind - 0.2 * hurl) * w, 0, 0);
    for (let s = -1; s <= 1; s += 2) armRot(ctl, s, 2.9 * wind + 1.3 * hurl + tremble * 3, 0.5 * wind + 0.1 * hurl, w, 0.25 * wind - 0.1 * hurl);
    ctl.jaw = Math.max(ctl.jaw, (0.4 * wind + 0.9 * hurl) * w);
    ctl.glow = mix(ctl.glow, 1 + 2.5 * sstep(0.1, 0.66, k) * (1 - sstep(0.7, 0.8, k)), w);
    ctl.charge = Math.max(ctl.charge, sstep(0.1, 0.66, k) * (1 - sstep(0.68, 0.76, k)) * w);
    ctl.wingSpread = mix(ctl.wingSpread, 1.2 * wind + 0.6 * hurl, w); ctl.flap = Math.max(ctl.flap, 0.4 * wind * w);
    legsPlant(ctl, wind * w * 0.6, 1.35, 0);
  } },
  cast: { dur: 1.1, a: 0.1, d: 0.85, hit: 0.55, fn(ctl, a, w) { // both claws thrust forward, fingers splayed, crackling
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const up = sstep(0, 0.4, k) * (1 - sstep(0.8, 1, k)), push = sstep(0.45, 0.55, k) * (1 - sstep(0.75, 1, k));
    const jit = Math.sin(t * 50) * 0.04 * up;
    P.rot(b.spine, (0.15 * up - 0.25 * push) * w, 0, 0);
    for (let s = -1; s <= 1; s += 2) armRot(ctl, s, 1.4 * up + 0.2 * push + jit, 0.9 * up - 0.7 * push, w, 0.35 * up - 0.3 * push);
    ctl.glow = mix(ctl.glow, 1 + 2 * up, w); ctl.jaw = Math.max(ctl.jaw, 0.4 * up * w);
    ctl.wingSpread = mix(ctl.wingSpread, 0.7 * up, w);
  } },
  spit: { dur: 0.75, a: 0.08, d: 0.8, hit: 0.48, fn(ctl, a, w) { // rear the head back, then spit fire
    const P = ctl.pose, b = ctl.b, k = a.k;
    const back = sstep(0, 0.4, k) * (1 - sstep(0.42, 0.52, k)), fwd = sstep(0.42, 0.52, k) * (1 - sstep(0.7, 1, k));
    P.rx(b.spine, (0.25 * back - 0.3 * fwd) * w); P.rx(b.chest, (0.15 * back - 0.15 * fwd) * w);
    P.rot(b.head, (0.45 * back - 0.3 * fwd) * w, 0, 0);
    ctl.jaw = Math.max(ctl.jaw, (0.3 * back + 1.0 * fwd) * w);
    armRot(ctl, -1, 0.6 * back, 0.9, w, 0.5 * back); armRot(ctl, 1, 0.6 * back, 0.9, w, 0.5 * back);
    ctl.glow = mix(ctl.glow, 1 + 1.5 * fwd, w);
  } },
  roar: bRoar({ dur: 1.3 }),
  idle_alt: { dur: 2.2, a: 0.12, d: 0.85, fn(ctl, a, w) { // wicked cackle: shoulders shake, rubs claws together
    const P = ctl.pose, b = ctl.b, t = a.t;
    const sh = Math.sin(t * 22) * 0.05;
    P.rot(b.chest, (0.08 + sh) * w, 0, sh * 0.5 * w); P.rot(b.head, (0.25 + sh * 1.5) * w, 0.2 * Math.sin(t * 2) * w, 0.15 * w);
    const rub = Math.sin(t * 14) * 0.15;
    armRot(ctl, -1, 1.0 + rub, 1.5, w, -0.3); armRot(ctl, 1, 1.0 - rub, 1.5, w, -0.3);
    ctl.jaw = Math.max(ctl.jaw, (0.35 + 0.25 * Math.sin(t * 22)) * w);
    ctl.wingSpread = mix(ctl.wingSpread, 0.3 + sh * 3, w);
  } },
  scratch: { dur: 1.6, a: 0.15, d: 0.8, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, t = a.t;
    armRot(ctl, -1, 2.5, 2.1 + Math.sin(t * 24) * 0.15, w, 0.6);
    P.rot(b.head, -0.1 * w, -0.3 * w, 0.35 * w); ctl.ear = mix(ctl.ear, 0.2, w);
  } },
  hit: bHit(),
  knockback: bKnockback(),
  knockdown: bKnockdown({ lieY: 0.1 }),
  getup: bGetup({ lieY: 0.1 }),
  death: bDeath({ dist: 1.9, peak: 0.55, spin: 0.5, lieY: 0.1 }),
  stun: bStun(),
  spawn: bSpawn({ depth: 1.05 }),
  spawn_drop: bDrop({ height: 3 }),
};

const IMP_SPEC = {
  bones: {
    hips: 'hips', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head', jaw: 'jaw', tail: ['tail1', 'tail2', 'tail3', 'tail4'], ears: ['earL', 'earR'],
    armL: ['armUL', 'armLL', 'handL'], armR: ['armUR', 'armLR', 'handR'], wingL: ['wing1L', 'wing2L'], wingR: ['wing1R', 'wing2R'],
  },
  gait: {
    legs: [
      { id: 'L', chain: ['thighL', 'shinL', 'metaL', 'footL'], toe: [-0.11, 0, -0.085], body: 'hips', scap: 0.25, lift: 0.085, flex: 0.9, heel: 0.3, out: 0.15, metaK: 1.2, metaBase: 0 },
      { id: 'R', chain: ['thighR', 'shinR', 'metaR', 'footR'], toe: [0.11, 0, -0.085], body: 'hips', scap: 0.25, lift: 0.085, flex: 0.9, heel: 0.3, out: 0.15, metaK: 1.2, metaBase: 0 },
    ],
    maxStride: 0.38, fMin: 0.65,
    gaits: [
      { v: 1.1, f: 2.8, duty: 0.58, lift: 0.8, off: { L: 0, R: 0.5 }, bob: 0.018, bobF: 2, bobPh: 0.1, roll: 0.07, rollF: 1, rollPh: 0.25, sway: 0.015, swayF: 1, swayPh: 0.25, nod: 0.05, nodF: 2 },
      { v: 5.0, f: 5.0, duty: 0.36, lift: 1.3, off: { L: 0, R: 0.5 }, bob: 0.035, bobF: 2, bobPh: 0.3, roll: 0.05, rollF: 1, rollPh: 0.25, nod: 0.06, nodF: 2 },
    ],
  },
  arm: { swing: 0.6, out: 0.18, elbow: 0.45, runSwing: 0.9, runOut: 0.35, runElbow: 0.9, combatUp: 0.55, combatElbow: 0.9, combatOut: 0.2, flyOut: 0.2, flyUp: 0.3 },
  lean: { walk: 0.18, run: 0.55, combat: 0.22 }, twist: 0.15, waddle: 0.05, crouch: 0.05, breathe: 0.025, tailLift: 0.5, tailFly: 0.4,
  wings: { idleF: 0.35, flapF: 7, amp: 0.95, idleAmp: 0.05, fold: 0.35, fold2: 1.0, lift: 0.3, flySpread: 0.2 },
  flyH: 0.75, flyBob: 0.06, flyLean: 0.6,
  fidgets: [{ name: 'idle_alt', w: 2 }, { name: 'scratch', w: 1 }],
  fidgetGap: 3,
  pose(ctl) {
    // hunched stance; wings perk up when running / fighting; the grin opens
    const P = ctl.pose, b = ctl.b;
    P.rx(b.spine, -0.12); P.rx(b.neck, 0.08); P.rx(b.head, 0.06);
    ctl.wingSpread += 0.12 * ctl.run + 0.25 * ctl.combat;
    ctl.jaw += 0.1 + 0.12 * ctl.run + 0.08 * ctl.combat * (0.5 + 0.5 * Math.sin(ctl.t * 7));
  },
  actions: ACTIONS,
};
