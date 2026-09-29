// Abyssal Brute: 3 m elite ogre-demon. Hulking hunched torso with a trapezius hump that swallows the neck, tiny horned
// head with a tusked underbite and furnace eyes, gorilla forearms, knuckle-dragging fist, stumpy elephantine legs,
// bone spikes erupting from the shoulders and spine, lava veins, broken shackles, and a huge iron-banded spiked club
// carried on the shoulder. Variants: crimson (default), ashen, bile; elite: warlord (×1.15, plate & skull trophies).
import * as THREE from 'three';
import { BipedCtl, legsLocal, legsPlant, armRot } from '../ctl.js';
import { bHit, bKnockback, bKnockdown, bGetup, bDeath, bStun, bSpawn, kf } from '../acts.js';
import { sweep, rigid, bez, taper, leafGeo, aim } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addEye, addHorn, lerp3 } from '../../kit/parts.js';
import { orb, posedFrame } from '../parts2.js';
import { sstep, clamp01, mix } from '../../kit/rig.js';

const PAL = {
  crimson: { skin: 0x7a2420, dark: 0x3a0e0e, belly: 0x9a4a3a, glow: 0xff5a10, eye: 0xffc040, horn: 0x241816, hornTip: 0xe0cca8, bone: 0xd8c8a4, wood: 0x4a3020, iron: 0x3a3a40, cloth: 0x4a3424, mouth: 0xff6a18 },
  ashen: { skin: 0x5a5250, dark: 0x201c1c, belly: 0x7a6e66, glow: 0xff7a1a, eye: 0xffd070, horn: 0x181414, hornTip: 0xd8c8b0, bone: 0xd0c4a8, wood: 0x3a2a1e, iron: 0x2e2e34, cloth: 0x3a2a22, mouth: 0xff7a20 },
  bile: { skin: 0x4a5a2a, dark: 0x1a2410, belly: 0x6a7a3a, glow: 0x8aff30, eye: 0xd8ff60, horn: 0x1a1a10, hornTip: 0xd8d8a0, bone: 0xd8d0a0, wood: 0x3a3018, iron: 0x33362a, cloth: 0x3a3020, mouth: 0x9aff40 },
  warlord: { skin: 0x5a1418, dark: 0x240608, belly: 0x7a3028, glow: 0xff8a20, eye: 0xfff0b0, horn: 0x140c0c, hornTip: 0xfff0d0, bone: 0xe8dcc0, wood: 0x2a1a10, iron: 0x44444c, cloth: 0x6a1010, mouth: 0xffa030, gold: 0xe0b040 },
};

// arm poses [upper pitch, inward yaw, out roll, elbow, wrist]; the club's rest direction is "forward from a hanging fist"
const SHOULDER_R = [0.45, 0.35, 0.1, 2.05, 0];   // club resting on the right shoulder
const HANG_L = [0.15, 0, 0.2, 0.45, 0];
const armSet = (P, arm, side, p, w) => { P.rot(arm[0], p[0] * w, side * p[1] * w, side * p[2] * w); P.rot(arm[1], p[3] * w, 0, 0); if (p[4]) P.rx(arm[2], p[4] * w); };

export const brute = {
  name: 'Abyssal Brute',
  variants: ['crimson', 'ashen', 'bile', 'warlord'],
  config(variant, opts) {
    const v = PAL[variant] ? variant : (opts.elite ? 'warlord' : 'crimson');
    const elite = v === 'warlord' || !!opts.elite;
    return { variant: v, pal: PAL[v === 'crimson' && elite ? 'warlord' : v], elite, shapeKey: elite ? 'elite' : 'base', scale: elite ? 1.15 : 1, h: 0.1, hg: { 1: 0.05, 2: 0.06 }, mat: { dfreq: 1.6, furAxis: 1, rim: 0.3, rimColor: 0xffb080, spec: 0.12, shine: 14 }, aoScale: 2.2, grad: { top: 0.18, bottom: 0.32, y0: 0, y1: 1.2, low: 0.25 } };
  },
  rig(R) {
    R.add('hips', null, [0, 1.2, 0.1]);
    R.add('spine', 'hips', [0, 1.55, 0.05]);
    R.add('chest', 'spine', [0, 1.95, -0.02]);
    R.add('neck', 'chest', [0, 2.28, -0.22]);
    R.add('head', 'neck', [0, 2.38, -0.36]);
    R.add('jaw', 'head', [0, 2.3, -0.42]);
    R.add('loin', 'hips', [0, 1.08, -0.3]);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('armU' + n, 'chest', [s * 0.62, 2.22, 0.0]); R.add('armL' + n, 'armU' + n, [s * 0.84, 1.6, 0.06]); R.add('hand' + n, 'armL' + n, [s * 0.9, 0.98, -0.1]);
      R.add('thigh' + n, 'hips', [s * 0.3, 1.12, 0.1]); R.add('shin' + n, 'thigh' + n, [s * 0.36, 0.62, -0.06]); R.add('foot' + n, 'shin' + n, [s * 0.38, 0.16, 0.05]);
    }
  },
  sculpt(S, cfg) {
    const c = cfg.pal, E = cfg.elite;
    const sk = [0.05, 0.25, 0.25, 0], skS = [0.03, 0.18, 0.2, 0];
    // ---- hulking torso: barrel chest, trapezius hump, huge gut, heavy pelvis
    S.ell('chest', [0, 1.97, -0.02], [0.6, 0.44, 0.45], { k: 0.14, col: c.skin, tag: 'chest', dtl: sk });
    S.ell('chest', [0, 2.2, 0.14], [0.42, 0.26, 0.32], { k: 0.14, col: c.dark, tag: 'hump', dtl: sk });
    for (const s of [-1, 1]) S.ell('chest', [s * 0.56, 2.2, 0.0], [0.3, 0.27, 0.32], { k: 0.12, col: c.skin, tag: 'shoulder', dtl: sk });
    S.ell('spine', [0, 1.46, -0.14], [0.46, 0.42, 0.42], { k: 0.14, col: c.belly, tag: 'belly', dtl: skS });
    S.ell('hips', [0, 1.17, 0.08], [0.4, 0.22, 0.3], { k: 0.12, col: c.skin, tag: 'body', dtl: sk });
    // ---- neck & small head sunk forward between the shoulders (finer group)
    S.cone('neck', [0, 2.12, -0.12], [0, 2.36, -0.34], 0.2, 0.15, { k: 0.1, col: c.skin, b2: 'head', t0: 0.7, t1: 1, dtl: sk });
    S.ell('head', [0, 2.44, -0.4], [0.19, 0.17, 0.19], { group: 1, k: 0.06, col: c.skin, tag: 'head', dtl: skS });
    S.ell('head', [0, 2.5, -0.53], [0.17, 0.045, 0.07], { group: 1, k: 0.04, col: c.dark, tag: 'brow', rot: [-0.25, 0, 0], dtl: skS });
    S.cone('head', [0, 2.42, -0.52], [0, 2.38, -0.62], 0.075, 0.06, { group: 1, k: 0.04, col: c.skin, tag: 'nose', dtl: skS });
    for (const s of [-1, 1]) S.sph('head', [s * 0.035, 2.36, -0.64], 0.02, { group: 1, k: 0.015, sub: true, col: 0x100404, tag: 'nostril' });
    S.ell('head', [0, 2.335, -0.54], [0.14, 0.03, 0.08], { group: 1, k: 0.02, sub: true, col: c.mouth, tag: 'mouth' });
    // underbite jaw
    S.ell('jaw', [0, 2.28, -0.48], [0.17, 0.08, 0.14], { group: 1, k: 0.05, col: c.skin, tag: 'jaw', dtl: skS });
    // ---- arms: huge shoulders, gorilla forearms, big fists (fists: own group)
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      S.cone('armU' + n, [s * 0.62, 2.22, 0.0], [s * 0.84, 1.6, 0.06], 0.24, 0.19, { k: 0.1, col: c.skin, b2: 'armL' + n, t0: 0.8, t1: 1, dtl: sk });
      S.cone('armL' + n, [s * 0.84, 1.6, 0.06], [s * 0.9, 1.08, -0.08], 0.2, 0.24, { k: 0.08, col: c.skin, tag: 'fore', tip: { col: c.dark, from: 0.6 }, b2: 'hand' + n, t0: 0.9, t1: 1, dtl: sk });
      S.ell('hand' + n, [s * 0.91, 0.9, -0.14], [0.19, 0.17, 0.19], { group: 2, k: 0.06, col: c.dark, tag: 'fist', dtl: skS });
      // legs: thick, short; elephantine feet with toe knuckles
      S.cone('thigh' + n, [s * 0.3, 1.12, 0.1], [s * 0.36, 0.62, -0.06], 0.3, 0.22, { k: 0.1, col: c.skin, b2: 'shin' + n, t0: 0.8, t1: 1, dtl: sk });
      S.cone('shin' + n, [s * 0.36, 0.62, -0.06], [s * 0.38, 0.18, 0.04], 0.22, 0.2, { k: 0.08, col: c.skin, tag: 'shin', tip: { col: c.dark, from: 0.5 }, b2: 'foot' + n, t0: 0.85, t1: 1, dtl: sk });
      S.ell('foot' + n, [s * 0.39, 0.1, -0.06], [0.2, 0.11, 0.27], { k: 0.06, col: c.dark, tag: 'foot', dtl: skS });
    }
    if (E) {
      S.ell('chest', [0, 2.05, -0.36], [0.4, 0.3, 0.12], { k: 0.05, col: c.iron, tag: 'plate', dtl: [0, 0.05, 0.25, 0.1] });
      for (const s of [-1, 1]) S.ell('chest', [s * 0.62, 2.36, 0.02], [0.3, 0.14, 0.3], { k: 0.05, col: c.iron, tag: 'plate', rot: [0, 0, -s * 0.35], dtl: [0, 0.05, 0.25, 0.1] });
    }
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, y, z] = v.p, [nx, ny, nz] = v.n;
    if (v.group === 0 || v.group === 2) {
      v.mix(c.dark, sstep(0.3, 0.9, ny + nz * 0.4) * sstep(1.9, 2.2, y) * 0.5);
      // lava veins: branching glowing cracks over chest, arms, gut and legs
      const n1 = Math.sin(x * 15 + Math.sin(y * 11 + z * 9) * 2.2) * Math.sin(y * 17 - z * 13 + Math.sin(x * 10) * 1.7);
      const crack = (1 - sstep(0.0, 0.04, Math.abs(n1))) * sstep(0.0, 0.45, Math.sin(x * 3.1 + y * 2.3 + z * 2.7 + 0.8));
      const where = (1 - v.t('fist') - v.t('foot') - v.t('plate')) * (1 - sstep(0.6, 0.95, ny));
      const g = crack * Math.max(0, where);
      if (g > 0.03) { v.mix(c.glow, g * 0.9); v.emis = Math.max(v.emis, g * 1.5); }
      // belly: pale stretched hide with folds
      v.mix(c.dark, v.t('belly') * sstep(0.85, 0.95, Math.abs(Math.sin(y * 18 + x * 2))) * 0.3);
      if (v.t('plate') > 0.4) { v.mix(c.gold ?? c.iron, sstep(0.88, 0.96, Math.abs(Math.sin(y * 14))) * 0.8); }
    }
    if (v.t('mouth') > 0.25) { v.mix(c.mouth, 0.95); v.emis = Math.max(v.emis, 2.0 * v.t('mouth')); }
    if (v.group === 1) {
      for (const s of [-1, 1]) { const d = Math.hypot(x - s * 0.085, y - 2.46, z + 0.55); v.mix(0x080202, (1 - sstep(0.035, 0.06, d)) * 0.85); }
      v.mix(0x100404, v.t('nostril') * 0.9);
    }
    v.mul(1 + Math.sin(x * 5 + z * 4) * Math.sin(y * 4.5) * 0.05);
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n), E = cfg.elite;
    // furnace eyes under the brow
    for (const s of [-1, 1]) orb(acc, [s * 0.085, 2.46, -0.545], 0.03, rigid(b('head')), c.eye, E ? 5 : 4, 1);
    // horns: curling ram-demon horns from the temples
    const hk = E ? 1.3 : 1;
    for (const s of [-1, 1]) {
      addHorn(acc, b('head'), [s * 0.14, 2.56, -0.36], [s * 0.34 * hk, 2.72 * (E ? 1.02 : 1), -0.3], [s * 0.36 * hk, 2.62, -0.56], 0.07, 0.006, { base: c.horn, tip: c.hornTip, radial: 6, n: 6, gpow: 1.5 });
      // tusks jutting up from the underbite
      addHorn(acc, b('jaw'), [s * 0.1, 2.3, -0.58], [s * 0.13, 2.4, -0.62], [s * 0.1, 2.48, -0.6], 0.035, 0.004, { base: 0xa89878, tip: c.bone, radial: 5, n: 4 });
    }
    // bone spikes erupting from shoulders and spine
    const spikes = [[0, 2.42, 0.2, 0, 1, 0.5, 0.3], [0, 2.3, 0.4, 0, 0.8, 0.7, 0.26], [0, 2.05, 0.46, 0, 0.5, 1, 0.22], [0, 1.75, 0.42, 0, 0.3, 1, 0.18]];
    for (const s of [-1, 1]) spikes.push([s * 0.55, 2.42, 0.02, s * 0.5, 1, 0.3, 0.32], [s * 0.72, 2.3, 0.1, s * 0.8, 0.7, 0.5, 0.24]);
    for (const [x, y, z, dx, dy, dz, L0] of spikes) {
      const L = L0 * (E ? 1.2 : 1), d = Math.hypot(dx, dy, dz);
      const bone = y > 2.1 ? 'chest' : 'spine';
      addHorn(acc, b(bone), [x, y, z], [x + dx / d * L * 0.5, y + dy / d * L * 0.55, z + dz / d * L * 0.5], [x + dx / d * L, y + dy / d * L * 0.9 + 0.03, z + dz / d * L * 1.05], 0.07, 0.004, { base: c.dark, tip: c.bone, radial: 5, n: 4, gpow: 2 });
    }
    // loincloth + belt of rope
    const g = leafGeo(0.3, 0.62, 0.03, 0.2, 0.05, { nu: 5, nv: 5, pw: 0.25, tipW: 0.18 });
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI + 0.2, 0, 0, 'YXZ')); m.setPosition(0, 1.2, -0.28);
    const cc = col(c.cloth), cd = col(c.dark);
    acc.add(g, { matrix: m, skin: rigid(b('loin')), dtl: [0, 0, 0.3, 0.5], color: (p, n, uv) => lerp3(cc, cd, sstep(0.5, 1, uv[1]) * 0.6) });
    const belt = new THREE.TorusGeometry(0.42, 0.045, 4, 18);
    acc.add(belt, { matrix: new THREE.Matrix4().makeRotationX(Math.PI / 2 - 0.12).setPosition(0, 1.25, 0.02), skin: rigid(b('hips')), color: c.cloth, dtl: [0, 0, 0.2, 0.6] });
    // broken shackles on both wrists
    for (const s of [-1, 1]) {
      const cuff = new THREE.TorusGeometry(0.2, 0.05, 4, 12);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0.06, -0.52, -0.14).normalize());
      acc.add(cuff, { matrix: new THREE.Matrix4().makeRotationFromQuaternion(q).setPosition(s * 0.885, 1.14, -0.05), skin: rigid(b('armL' + (s < 0 ? 'L' : 'R'))), color: c.iron, dtl: [0, 0, 0.3, 0] });
      for (let i = 0; i < 2; i++) { // dangling links
        const link = new THREE.TorusGeometry(0.05, 0.016, 3, 8);
        acc.add(link, { matrix: new THREE.Matrix4().makeRotationY(i * 1.57).setPosition(s * (0.95 + i * 0.02), 1.02 - i * 0.09, 0.06), skin: rigid(b('armL' + (s < 0 ? 'L' : 'R'))), color: c.iron, dtl: [0, 0, 0.3, 0] });
      }
    }
    // knuckle claws on the fists
    for (const s of [-1, 1]) for (let f = -1; f <= 1; f++) {
      const x = s * 0.91 + f * 0.08;
      addHorn(acc, b('hand' + (s < 0 ? 'L' : 'R')), [x, 0.86, -0.3], [x, 0.8, -0.36], [x, 0.72, -0.35], 0.03, 0.003, { base: c.dark, tip: c.bone, radial: 4, n: 3 });
    }
    if (E) { // skull trophies on the belt
      for (let i = 0; i < 3; i++) { const a = -0.7 + i * 0.7; orb(acc, [Math.sin(a) * 0.44, 1.18, -Math.cos(a) * 0.32], 0.07, rigid(b('hips')), c.bone, 0, 1); }
    }
    // ---- the club, authored resting on the right shoulder
    const { M, P } = posedFrame(R, (Pp, bb) => { armSet(Pp, [bb.armUR, bb.armLR, bb.handR], 1, SHOULDER_R, 1); });
    {
      const hi = b('handR'), wr = P.wp[hi], el = P.wp[b('armLR')];
      const fa = wr.clone().sub(el).normalize();
      const fist = wr.clone().addScaledVector(fa, 0.14);
      const d = new THREE.Vector3(0.2, 0.3, 0.93).normalize(); // back over the shoulder
      const L = 1.9 * (E ? 1.1 : 1);
      const Mh = M(hi);
      const a0 = fist.clone().addScaledVector(d, -0.18), a1 = fist.clone().addScaledVector(d, L);
      const pts = [], rad = [];
      for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(a0.clone().lerp(a1, t)); rad.push(mix(0.075, 0.26, Math.pow(t, 1.6)) * (1 + 0.12 * Math.sin(t * 17)) + (i === 8 ? -0.06 : 0)); }
      const wood = col(c.wood), dk = col(c.dark);
      acc.add(sweep(pts, rad, { radial: 7, capStart: true }), { matrix: Mh, skin: rigid(hi), dtl: [0, 0, 0.2, 0.8], color: (p, n, uv) => lerp3(wood, dk, sstep(0.6, 0.95, Math.abs(Math.sin(uv[0] * 18 + uv[1] * 3))) * 0.5) });
      // iron bands
      for (const t of [0.5, 0.78, 0.95]) {
        const pc = a0.clone().lerp(a1, t), r = mix(0.075, 0.26, Math.pow(t, 1.6)) + 0.02;
        const band = new THREE.TorusGeometry(r, 0.03, 3, 12);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
        acc.add(band, { matrix: Mh.clone().multiply(new THREE.Matrix4().makeRotationFromQuaternion(q).setPosition(pc.x, pc.y, pc.z)), skin: rigid(hi), color: c.iron, dtl: [0, 0, 0.3, 0] });
      }
      // iron spikes around the head
      const side = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize(), up2 = new THREE.Vector3().crossVectors(side, d).normalize();
      for (let i = 0; i < 7; i++) {
        const t = 0.66 + (i % 2) * 0.14 + (i === 6 ? 0.2 : 0), an = i * 2.4;
        const r = mix(0.075, 0.26, Math.pow(Math.min(1, t), 1.6));
        const dir = side.clone().multiplyScalar(Math.cos(an)).addScaledVector(up2, Math.sin(an));
        if (i === 6) dir.copy(d);
        const base = a0.clone().lerp(a1, Math.min(0.98, t)).addScaledVector(dir, r * 0.8);
        const tip = base.clone().addScaledVector(dir, 0.16);
        acc.add(sweep([base, tip], [0.045, 0.002], { radial: 4 }), { matrix: Mh, skin: rigid(hi), color: c.iron, dtl: [0, 0, 0.3, 0] });
      }
      // glowing rune gouged into the club head
      const rp = a0.clone().lerp(a1, 0.85).addScaledVector(up2, 0.24);
      orb(acc, rp.applyMatrix4(Mh).toArray(), 0.04, rigid(hi), c.glow, 3, 0);
    }
  },
  sockets: {
    head: ['head', [0, 2.78, -0.38]], mouth: ['jaw', [0, 2.3, -0.62]], center: ['chest', [0, 1.8, -0.1]], chest: ['chest', [0, 1.95, -0.48]],
    back: ['chest', [0, 2.3, 0.4]], handR: ['handR', [0.91, 0.9, -0.14]], handL: ['handL', [-0.91, 0.9, -0.14]],
  },
  height: 3.0, radius: 1.0,
  controller(inst) { return new BipedCtl(inst, BRUTE_SPEC); },
  get actionList() { return ACTIONS; },
};

// ------------------------------------------------------------------------------------------------ animation
const lerpA = (out, a, b2, t) => { for (let i = 0; i < 5; i++) out[i] = a[i] + (b2[i] - a[i]) * t; return out; };
const _a = [0, 0, 0, 0, 0], _b = [0, 0, 0, 0, 0];
function arms(ctl, pr, pl, w) { const b = ctl.b; if (pr) armSet(ctl.pose, b.armR, 1, pr, w); if (pl) armSet(ctl.pose, b.armL, -1, pl, w); }
const READY_R = [1.1, 0.25, 0.25, 1.7, 0];                  // club up, ready to smash
const OVER_R = [2.75, -0.1, 0.15, 1.0, 0], SMASH_R = [0.75, 0.1, 0.05, 0.1, -1.35];
const SWEEP_R = [1.35, 0, 0.15, 0.2, -1.55];
const TWO_R = [2.9, 0.4, 0.05, 1.15, 0], TWO_L = [2.9, 0.55, 0.05, 1.3, 0], POUND_R = [0.95, 0.35, 0.0, 0.15, -1.45], POUND_L = [0.95, 0.6, 0.0, 0.3, 0];
const busyNames = ['attack', 'attack2', 'attack_big', 'roar', 'death', 'knockdown', 'getup', 'spawn', 'knockback', 'idle_alt', 'stun'];

const ACTIONS = {
  attack: { dur: 1.15, a: 0.06, d: 0.85, hit: 0.55, fn(ctl, a, w) { // overhead club smash
    const P = ctl.pose, b = ctl.b, k = a.k, H = ctl.H;
    const up = sstep(0, 0.42, k) * (1 - sstep(0.46, 0.55, k)), down = sstep(0.46, 0.56, k) * (1 - sstep(0.72, 1, k));
    lerpA(_a, READY_R, OVER_R, up); lerpA(_b, _a, SMASH_R, down);
    arms(ctl, _b, [0.5 * up + 0.3, 0, 0.5 * up, 0.8, 0], w);
    P.move(b.hips, 0, (0.03 * up - 0.1 * down) * H * w, (0.04 * up - 0.12 * down) * H * w);
    P.rot(b.spine, (0.22 * up - 0.4 * down) * w, (0.2 * up - 0.1 * down) * w, 0);
    P.rot(b.chest, (0.1 * up - 0.2 * down) * w, 0, 0);
    ctl.jaw = Math.max(ctl.jaw, (0.3 * up + 0.8 * down) * w);
    legsPlant(ctl, (up + down) * 0.7 * w, 1.25, -0.05);
  } },
  attack2: { dur: 1.05, a: 0.06, d: 0.85, hit: 0.5, fn(ctl, a, w) { // horizontal sweep: wind to the right, swing through to the left
    const P = ctl.pose, b = ctl.b, k = a.k;
    const tw = kf(k, [0, 0.38, 0.55, 0.75, 1], [0, 1, -0.9, -1, 0]);
    const lv = sstep(0, 0.3, k) * (1 - sstep(0.75, 1, k));
    lerpA(_a, READY_R, SWEEP_R, lv);
    arms(ctl, _a, HANG_L, w);
    P.rot(b.hips, 0, 0.35 * tw * w, 0); P.rot(b.spine, -0.1 * lv * w, 0.5 * tw * w, 0); P.rot(b.chest, 0, 0.45 * tw * w, 0.08 * tw * w);
    P.rot(b.head, 0, -0.5 * tw * w, 0);
    ctl.jaw = Math.max(ctl.jaw, 0.6 * sstep(0.4, 0.55, k) * (1 - sstep(0.7, 0.9, k)) * w);
    legsPlant(ctl, lv * 0.8 * w, 1.3, 0);
  } },
  attack_big: { dur: 2.5, a: 0.04, d: 0.9, hit: 0.62, fn(ctl, a, w) { // two-handed overhead ground pound — long, readable windup
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t, H = ctl.H;
    const lift = sstep(0, 0.3, k) * (1 - sstep(0.56, 0.62, k));
    const trem = sstep(0.3, 0.56, k) * (1 - sstep(0.56, 0.6, k)) * Math.sin(t * 45) * 0.025;
    const hop = Math.sin(clamp01((k - 0.5) / 0.12) * Math.PI) * (k < 0.62 ? 1 : 0);
    const slam = sstep(0.56, 0.62, k) * (1 - sstep(0.8, 1, k));
    lerpA(_a, READY_R, TWO_R, lift); lerpA(_a, _a, POUND_R, slam);
    lerpA(_b, HANG_L, TWO_L, lift); lerpA(_b, _b, POUND_L, slam);
    arms(ctl, _a, _b, w);
    P.move(b.hips, 0, (0.02 * lift + 0.08 * hop - 0.12 * slam) * H * w, (0.05 * lift - 0.12 * slam) * H * w);
    P.rot(b.hips, (0.1 * lift - 0.2 * slam) * w, 0, trem * w);
    P.rot(b.spine, (0.3 * lift - 0.45 * slam + trem) * w, 0, 0); P.rx(b.chest, (0.15 * lift - 0.2 * slam) * w);
    P.rot(b.head, (0.35 * lift - 0.2 * slam) * w, 0, 0);
    ctl.jaw = Math.max(ctl.jaw, (0.6 * lift + 0.9 * slam) * w);
    ctl.glow = mix(ctl.glow, 1 + 2.4 * sstep(0.05, 0.55, k) * (1 - sstep(0.62, 0.8, k)), w);
    ctl.charge = Math.max(ctl.charge, sstep(0.05, 0.55, k) * (1 - sstep(0.6, 0.7, k)) * w);
    legsPlant(ctl, (lift * (1 - hop) + slam) * w, 1.35, -0.05);
    legsLocal(ctl, hop * w * 0.6, 0.1, 1.2);
  } },
  roar: { dur: 2.2, a: 0.06, d: 0.88, fn(ctl, a, w) { // beat the chest, then roar with arms flung wide
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const beat = k < 0.45 ? 1 : 1 - sstep(0.45, 0.55, k), roar = sstep(0.5, 0.6, k) * (1 - sstep(0.88, 1, k));
    const bt = Math.pow(Math.abs(Math.sin(t * 9)), 2) * beat;
    arms(ctl, [1.2 * beat + 0.9 * roar, 0.7 * beat, (0.2 + 0.25 * bt) * beat + 1.2 * roar, 1.6 * beat + 0.5 * roar, 0], [1.2 * beat + 0.9 * roar, 0.7 * beat, (0.2 + 0.25 * Math.pow(Math.abs(Math.cos(t * 9)), 2)) * beat + 1.2 * roar, 1.6 * beat + 0.5 * roar, 0], w);
    P.rot(b.spine, (0.1 * beat + 0.25 * roar) * w, 0, 0); P.rx(b.chest, 0.15 * roar * w);
    P.rot(b.head, (0.45 * roar + Math.sin(t * 30) * 0.03 * roar) * w, 0, 0);
    ctl.jaw = Math.max(ctl.jaw, (0.2 * beat + 1.0 * roar) * w);
    ctl.glow = mix(ctl.glow, 1 + 1.8 * roar, w);
    legsPlant(ctl, w, 1.35, 0);
  } },
  idle_alt: { dur: 2.6, a: 0.12, d: 0.85, fn(ctl, a, w) { // scratch the gut, heave the club higher on the shoulder
    const P = ctl.pose, b = ctl.b, t = a.t, k = a.k;
    arms(ctl, SHOULDER_R, [0.7, 0.8, 0.1, 1.2 + Math.sin(t * 18) * 0.12, 0], w);
    const heave = Math.sin(clamp01((k - 0.6) / 0.3) * Math.PI);
    P.rot(b.chest, 0.05 * heave * w, 0, -0.08 * heave * w); P.rot(b.head, -0.1 * w, 0.2 * Math.sin(t * 1.5) * w, 0);
    ctl.jaw = Math.max(ctl.jaw, 0.15 * w);
  } },
  hit: bHit({ dur: 0.5 }),
  knockback: bKnockback({ dur: 1.0 }),
  knockdown: bKnockdown({ lieY: 0.4, dur: 1.0 }),
  getup: bGetup({ lieY: 0.4, dur: 1.4 }),
  death: bDeath({ dist: 0.35, peak: 0.1, spin: 0, lieY: 0.4, air: 0.55, dur: 2.0 }),
  stun: bStun({ dur: 2.0 }),
  spawn: bSpawn({ depth: 1.0, dur: 2.2 }),
};

const BRUTE_SPEC = {
  bones: { hips: 'hips', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head', jaw: 'jaw', armL: ['armUL', 'armLL', 'handL'], armR: ['armUR', 'armLR', 'handR'] },
  gait: {
    legs: [
      { id: 'L', chain: ['thighL', 'shinL', 'footL'], toe: [-0.4, 0, -0.14], body: 'hips', scap: 0.2, lift: 0.18, flex: 0.35, heel: 0.3, out: 0.3 },
      { id: 'R', chain: ['thighR', 'shinR', 'footR'], toe: [0.4, 0, -0.14], body: 'hips', scap: 0.2, lift: 0.18, flex: 0.35, heel: 0.3, out: 0.3 },
    ],
    maxStride: 1.1, fMin: 0.6,
    gaits: [
      { v: 1.2, f: 1.25, duty: 0.62, lift: 0.8, off: { L: 0, R: 0.5 }, bob: 0.05, bobF: 2, bobPh: 0.1, roll: 0.07, rollF: 1, rollPh: 0.25, sway: 0.06, swayF: 1, swayPh: 0.25, nod: 0.03, nodF: 2 },
      { v: 4.0, f: 2.0, duty: 0.44, lift: 1.1, off: { L: 0, R: 0.5 }, bob: 0.09, bobF: 2, bobPh: 0.3, roll: 0.06, rollF: 1, rollPh: 0.25, sway: 0.04, swayF: 1, swayPh: 0.25, nod: 0.04, nodF: 2 },
    ],
  },
  arm: { swing: 0.25, out: 0.05, elbow: 0, runSwing: 0.45, runOut: 0.1, runElbow: 0.3, combatUp: 0, combatElbow: 0, combatOut: 0, weaponSwing: 0.2 },
  lean: { walk: 0.08, run: 0.22, combat: 0.12 }, twist: 0.1, waddle: 0.06, crouch: 0.08, breathe: 0.02, chargeK: 0.16,
  fidgets: [{ name: 'idle_alt', w: 1 }],
  fidgetGap: 6,
  pose(ctl) {
    const A = ctl.acts;
    let busy = 0; for (let i = 0; i < busyNames.length; i++) { const x = A.weight(busyNames[i]); if (x > busy) busy = x; }
    const free = 1 - Math.min(1, busy);
    lerpA(_a, SHOULDER_R, READY_R, ctl.combat);
    arms(ctl, _a, HANG_L, free);
    const P = ctl.pose, b = ctl.b;
    // ogre hunch: torso pitched forward, head thrust out low between the shoulders
    P.rx(b.hips, -0.08); P.rx(b.spine, -0.3); P.rx(b.chest, -0.14); P.rx(b.neck, 0.2); P.rx(b.head, 0.3);
    ctl.jaw += 0.08 + 0.1 * ctl.combat + 0.1 * ctl.run;
    ctl.glow *= 1 + 0.12 * Math.sin(ctl.t * 2.3);
  },
  actions: ACTIONS,
};
