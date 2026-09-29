// Legionnaire: 2.2 m armoured demon soldier of the Abyssal Legion. Horned great-helm with a burning visor slit, spiked
// layered pauldrons, iron cuirass over crimson demon hide, digitigrade legs in greaves ending in cloven hooves, blood-red
// tabard, a long barbed spear (glowing runes) and a curved tower shield with a horned boss and a burning sigil.
// Variants: iron (default), bronze, obsidian (violet fire); elite: centurion (×1.2, gold trim, crest, cape).
import * as THREE from 'three';
import { BipedCtl, legsLocal, legsPlant } from '../ctl.js';
import { bHit, bKnockback, bKnockdown, bGetup, bDeath, bStun, bSpawn, bDrop, kf } from '../acts.js';
import { sweep, rigid, bez, taper, leafGeo, aim } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addHorn, lerp3 } from '../../kit/parts.js';
import { orb, posedFrame } from '../parts2.js';
import { sstep, clamp01, mix } from '../../kit/rig.js';

const PAL = {
  iron: { plate: 0x4a4a54, plate2: 0x2a2a32, trim: 0x8a5a3a, hide: 0x5e1618, hide2: 0x2e080c, cloth: 0x7a1216, cloth2: 0x3a0608, glow: 0xff5a14, eye: 0xffb040, horn: 0x1c1616, hornTip: 0xd8c4a0, wood: 0x3a2618, boss: 0x9a6a36 },
  bronze: { plate: 0x8a6232, plate2: 0x4a3218, trim: 0xc89a4a, hide: 0x3a1a1c, hide2: 0x1a0a0c, cloth: 0x1e3a4a, cloth2: 0x0c1a24, glow: 0xff7a1a, eye: 0xffd060, horn: 0x241a12, hornTip: 0xe8d8b0, wood: 0x4a3018, boss: 0x3a3a44 },
  obsidian: { plate: 0x24222e, plate2: 0x100e16, trim: 0x6a4a8a, hide: 0x3a1640, hide2: 0x1a0a20, cloth: 0x3a1450, cloth2: 0x180820, glow: 0xb050ff, eye: 0xe0b0ff, horn: 0x100c14, hornTip: 0xc0b0d8, wood: 0x1a1420, boss: 0x6a4a8a },
  centurion: { plate: 0x3a3a44, plate2: 0x1c1c24, trim: 0xe0b040, hide: 0x6a1418, hide2: 0x2e060a, cloth: 0x9a1418, cloth2: 0x4a0608, glow: 0xff7a20, eye: 0xfff0b0, horn: 0x140e0e, hornTip: 0xfff0d0, wood: 0x2a1a10, boss: 0xe0b040 },
};

// arm poses: [upper pitch, upper inward yaw, upper out-roll, elbow, wrist]
const HOLD_R = [0.3, 0.05, 0.1, 1.28, 0];      // spear upright at the side
const READY_R = [0.62, 0.1, 0.12, 0.95, -1.45]; // spear levelled forward (combat)
const GUARD_L = [0.38, 0.12, 0.14, 1.28, 0];   // shield carried on the left flank
const armSet = (P, arm, side, p, w) => { P.rot(arm[0], p[0] * w, side * p[1] * w, side * p[2] * w); P.rot(arm[1], p[3] * w, 0, 0); if (p[4]) P.rx(arm[2], p[4] * w); };

export const legionnaire = {
  name: 'Legionnaire',
  variants: ['iron', 'bronze', 'obsidian', 'centurion'],
  config(variant, opts) {
    const v = PAL[variant] ? variant : (opts.elite ? 'centurion' : 'iron');
    const elite = v === 'centurion' || !!opts.elite;
    return { variant: v, pal: PAL[v === 'iron' && elite ? 'centurion' : v], elite, shapeKey: elite ? 'elite' : 'base', scale: elite ? 1.2 : 1, h: 0.054, hg: { 1: 0.034, 2: 0.032 }, mat: { dfreq: 2.2, furAxis: 1, rim: 0.3, rimColor: 0xffc8a0, spec: 0.28, shine: 22 }, aoScale: 1.4, grad: { top: 0.2, bottom: 0.3, y0: 0, y1: 1.0, low: 0.25 } };
  },
  rig(R) {
    R.add('hips', null, [0, 1.02, 0.03]);
    R.add('spine', 'hips', [0, 1.22, 0.02]);
    R.add('chest', 'spine', [0, 1.45, 0.0]);
    R.add('neck', 'chest', [0, 1.66, -0.03]);
    R.add('head', 'neck', [0, 1.78, -0.05]);
    R.add('tabF', 'hips', [0, 0.97, -0.17]); R.add('tabB', 'hips', [0, 0.99, 0.2]);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('armU' + n, 'chest', [s * 0.3, 1.6, 0.02]); R.add('armL' + n, 'armU' + n, [s * 0.43, 1.29, 0.06]); R.add('hand' + n, 'armL' + n, [s * 0.47, 1.02, -0.02]);
      R.add('thigh' + n, 'hips', [s * 0.14, 0.98, 0.03]); R.add('shin' + n, 'thigh' + n, [s * 0.18, 0.6, -0.15]); R.add('meta' + n, 'shin' + n, [s * 0.18, 0.27, 0.1]); R.add('foot' + n, 'meta' + n, [s * 0.18, 0.07, 0.0]);
    }
  },
  sculpt(S, cfg) {
    const c = cfg.pal, E = cfg.elite;
    const met = [0, 0.05, 0.22, 0.08], hide = [0.04, 0.2, 0.2, 0], cloth = [0, 0, 0.2, 0.5];
    // ---- torso: cuirass over a demon-hide belly, fauld skirt
    S.ell('chest', [0, 1.47, -0.01], [0.27, 0.2, 0.19], { k: 0.06, col: c.plate, tag: 'plate', dtl: met });
    S.ell('chest', [0, 1.52, -0.1], [0.2, 0.12, 0.12], { k: 0.06, col: c.plate, tag: 'plate', dtl: met });
    S.ell('spine', [0, 1.24, 0.01], [0.19, 0.14, 0.15], { k: 0.06, col: c.hide, tag: 'hide', dtl: hide });
    S.ell('hips', [0, 1.04, 0.03], [0.21, 0.11, 0.17], { k: 0.05, col: c.plate2, tag: 'plate', dtl: met });
    // ---- pauldrons: stacked plates, flared out
    for (const s of [-1, 1]) {
      S.ell('chest', [s * 0.33, 1.63, 0.01], [0.15, 0.1, 0.16], { k: 0.05, col: c.plate, tag: 'pauldron', rot: [0, 0, -s * 0.35], dtl: met });
      S.ell('chest', [s * 0.38, 1.55, 0.01], [0.12, 0.07, 0.14], { k: 0.04, col: c.plate2, tag: 'pauldron', rot: [0, 0, -s * 0.5], dtl: met });
    }
    // ---- neck + great helm (own finer group)
    S.cone('neck', [0, 1.58, -0.02], [0, 1.76, -0.05], 0.095, 0.08, { k: 0.05, col: c.hide2, dtl: hide });
    S.ell('head', [0, 1.87, -0.06], [0.135, 0.155, 0.155], { group: 1, k: 0.04, col: c.plate, tag: 'helm', dtl: met });
    S.ell('head', [0, 1.81, -0.17], [0.105, 0.1, 0.06], { group: 1, k: 0.04, col: c.plate2, tag: 'visor', dtl: met });
    S.cone('head', [0, 1.95, -0.2], [0, 1.74, -0.225], 0.022, 0.018, { group: 1, k: 0.02, col: c.plate, tag: 'nasal', dtl: met });
    S.ell('head', [0, 1.855, -0.215], [0.095, 0.014, 0.06], { group: 1, k: 0.01, sub: true, col: c.glow, tag: 'slit' });
    S.ell('head', [0, 1.99, -0.03], [0.03, 0.05, 0.15], { group: 1, k: 0.03, col: c.plate2, tag: 'ridge', dtl: met });
    for (const s of [-1, 1]) S.ell('head', [s * 0.12, 1.76, -0.08], [0.04, 0.08, 0.08], { group: 1, k: 0.03, col: c.plate2, tag: 'cheekguard', dtl: met });
    // ---- arms: hide upper arms, iron vambraces, gauntlets (finer group)
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      S.cone('armU' + n, [s * 0.3, 1.6, 0.02], [s * 0.43, 1.29, 0.06], 0.085, 0.07, { k: 0.05, col: c.hide, tag: 'hide', b2: 'armL' + n, t0: 0.8, t1: 1, dtl: hide });
      S.cone('armL' + n, [s * 0.43, 1.29, 0.06], [s * 0.47, 1.04, -0.01], 0.075, 0.06, { k: 0.04, col: c.plate, tag: 'vambrace', b2: 'hand' + n, t0: 0.9, t1: 1, dtl: met });
      S.ell('hand' + n, [s * 0.475, 0.96, -0.03], [0.055, 0.075, 0.06], { group: 2, k: 0.025, col: c.plate2, tag: 'gauntlet', dtl: met });
      // legs: armoured thighs, knee cops, greaves, hide hocks, hooves
      S.cone('thigh' + n, [s * 0.14, 0.98, 0.03], [s * 0.18, 0.6, -0.15], 0.11, 0.08, { k: 0.05, col: c.hide, tag: 'hide', b2: 'shin' + n, t0: 0.8, t1: 1, dtl: hide });
      S.ell('thigh' + n, [s * 0.16, 0.84, -0.06], [0.1, 0.13, 0.07], { k: 0.04, col: c.plate, tag: 'tasset', rot: [0.3, 0, 0], dtl: met });
      S.sph('shin' + n, [s * 0.185, 0.6, -0.17], 0.075, { k: 0.03, col: c.plate2, tag: 'knee', dtl: met });
      S.cone('shin' + n, [s * 0.18, 0.6, -0.15], [s * 0.18, 0.27, 0.1], 0.075, 0.05, { k: 0.04, col: c.plate, tag: 'greave', b2: 'meta' + n, t0: 0.85, t1: 1, dtl: met });
      S.cone('meta' + n, [s * 0.18, 0.27, 0.1], [s * 0.18, 0.07, 0.0], 0.05, 0.045, { k: 0.03, col: c.hide2, tag: 'hide', b2: 'foot' + n, t0: 0.8, t1: 1, dtl: hide });
      S.box('foot' + n, [s * 0.18, 0.045, -0.05], [0.06, 0.045, 0.085], 0.025, { k: 0.02, col: 0x141012, tag: 'hoof', rot: [-0.15, 0, 0], dtl: met });
    }
    if (E) for (const s of [-1, 1]) S.ell('chest', [s * 0.36, 1.7, 0.0], [0.13, 0.06, 0.14], { k: 0.04, col: c.trim, tag: 'pauldron', rot: [0, 0, -s * 0.3], dtl: met });
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, y, z] = v.p, [nx, ny, nz] = v.n;
    const plate = v.t('plate') + v.t('pauldron') + v.t('helm') + v.t('vambrace') + v.t('greave') + v.t('tasset') + v.t('knee');
    // plate edges: trim bands + rivets; hide: dark ridges and ember veins
    if (plate > 0.4) {
      const band = sstep(0.8, 0.95, Math.abs(Math.sin(y * 16 + 0.6)));
      v.mix(c.trim, band * 0.35 * (v.t('pauldron') + v.t('greave')));
      const riv = (1 - sstep(0.004, 0.012, Math.hypot(((x * 30 + 50) % 1) - 0.5, ((y * 30 + 50) % 1) - 0.5) * 0.06)) * v.t('pauldron');
      v.mix(0xd8c8a8, riv * 0.4);
      v.mix(0x000000, sstep(0.2, -0.6, ny) * 0.25);
      if (cfg.elite) v.mix(c.trim, sstep(0.9, 0.97, Math.abs(Math.sin(y * 9))) * 0.8 * v.t('plate'));
    }
    const hide = v.t('hide');
    if (hide > 0.3) {
      // abdominal plates + ember seams
      const abs = sstep(0.75, 0.92, Math.abs(Math.sin(y * 34))) * sstep(0.3, 0.8, -nz) * (y > 1.12 && y < 1.36 ? 1 : 0);
      v.mix(c.hide2, abs * 0.6);
      const seam = 1 - sstep(0.0, 0.05, Math.abs(Math.sin(y * 21 + Math.sin(x * 17 + z * 13) * 1.8)));
      const g = seam * hide * sstep(0.2, 0.6, Math.abs(nx) + 0.3 * -nz);
      if (g > 0.05) { v.mix(c.glow, g * 0.8); v.emis = Math.max(v.emis, g * 1.2); }
    }
    // visor slit glows from within
    if (v.t('slit') > 0.25) { v.mix(c.glow, 1); v.emis = Math.max(v.emis, 3.2 * v.t('slit')); }
    v.mix(0x000000, v.t('visor') * sstep(0.2, -0.5, ny) * 0.3);
    v.mul(1 + Math.sin(x * 11 + z * 7) * Math.sin(y * 9) * 0.04);
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n), E = cfg.elite;
    // eyes deep in the slit
    for (const s of [-1, 1]) orb(acc, [s * 0.045, 1.855, -0.185], 0.02, rigid(b('head')), c.eye, E ? 5 : 4, 0);
    // helm horns: great bull horns sweeping out, then up & forward
    const hk = E ? 1.2 : 1;
    for (const s of [-1, 1]) {
      addHorn(acc, b('head'), [s * 0.12, 1.92, -0.06], [s * 0.36 * hk, 1.93, -0.02], [s * 0.34 * hk, 2.18 * (E ? 1.02 : 1), -0.16], 0.055, 0.004, { base: c.horn, tip: c.hornTip, radial: 6, n: 6, gpow: 1.5 });
      // pauldron spikes
      for (let i = 0; i < 3; i++) {
        const x = s * (0.26 + i * 0.07), z = -0.06 + i * 0.05;
        addHorn(acc, b('chest'), [x, 1.68 - i * 0.02, z], [x + s * 0.03, 1.8 - i * 0.02, z + 0.02], [x + s * 0.07, 1.86 - i * 0.03, z + 0.06], 0.028, 0.002, { base: c.plate2, tip: c.hornTip, radial: 5, n: 4, gpow: 2 });
      }
    }
    if (E) { // crest of blades along the helm ridge + a crimson plume
      for (let i = 0; i < 4; i++) addHorn(acc, b('head'), [0, 2.0 - i * 0.01, -0.1 + i * 0.07], [0, 2.1 - i * 0.02, -0.07 + i * 0.08], [0, 2.14 - i * 0.03, 0.0 + i * 0.09], 0.02, 0.002, { base: c.trim, tip: 0xfff0c0, radial: 4, n: 4 });
    }
    // belt with a skull buckle
    const belt = new THREE.TorusGeometry(0.2, 0.025, 4, 16);
    acc.add(belt, { matrix: new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 1.1, 0.03), skin: rigid(b('hips')), color: c.trim, dtl: [0, 0, 0.2, 0.1] });
    orb(acc, [0, 1.1, -0.17], 0.035, rigid(b('hips')), c.boss, 0, 0);
    // tabards (front & back cloth flaps)
    for (const [bone, z, dir] of [['tabF', -0.17, 1], ['tabB', 0.2, -1]]) {
      const g = leafGeo(0.13, 0.52, 0.02, 0.2, 0.05 * dir, { nu: 5, nv: 5, pw: 0.35, tipW: 0.07 });
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI + (dir > 0 ? 0.12 : -0.12), dir > 0 ? 0 : Math.PI, 0, 'YXZ')); m.setPosition(0, 1.02, z);
      const c1 = col(c.cloth), c2 = col(c.cloth2), cg = col(c.trim);
      acc.add(g, { matrix: m, skin: rigid(b(bone)), dtl: [0, 0, 0.2, 0.6], color: (p, n, uv) => { const u = (uv[0] % 1) * 2, t = uv[1]; const edge = sstep(0.8, 0.95, u) + sstep(0.9, 0.98, t); const sig = (1 - sstep(0.05, 0.09, Math.abs(u - 0.35 * Math.sin(t * 9)))) * (t > 0.2 && t < 0.7 ? 1 : 0) * 0; return lerp3(lerp3(c1, c2, t * 0.6), cg, Math.min(1, edge) * 0.8 + sig); } });
    }
    // ---- weapons, authored in the idle grip pose
    const { M, P } = posedFrame(R, (Pp, bb) => {
      armSet(Pp, [bb.armUR, bb.armLR, bb.handR], 1, HOLD_R, 1);
      armSet(Pp, [bb.armUL, bb.armLL, bb.handL], -1, GUARD_L, 1);
    });
    // spear: upright, gripped in the right fist
    {
      const hi = b('handR'), wr = P.wp[hi], el = P.wp[b('armLR')];
      const fa = wr.clone().sub(el).normalize();
      const fist = wr.clone().addScaledVector(fa, 0.07);
      const d = new THREE.Vector3(0.02, 1, -0.1).normalize();
      const L = 2.45 * (E ? 1.05 : 1), butt = fist.clone().addScaledVector(d, -0.95), top = fist.clone().addScaledVector(d, L - 0.95);
      const Mh = M(hi);
      const wood = col(c.wood), band = col(c.plate2);
      const shaft = sweep([butt, fist, top], [0.024, 0.026, 0.022], { radial: 6, capStart: true });
      acc.add(shaft, { matrix: Mh, skin: rigid(hi), dtl: [0, 0, 0.1, 0.6], color: (p, n, uv) => lerp3(wood, band, sstep(0.85, 0.9, Math.abs(Math.sin(uv[1] * 40)))) });
      // butt spike
      acc.add(sweep([butt, butt.clone().addScaledVector(d, -0.14)], [0.03, 0.002], { radial: 5 }), { matrix: Mh, skin: rigid(hi), color: c.plate2, dtl: [0, 0, 0.2, 0] });
      // socket + barbed blade (flat, broad face toward the sides), glowing rune channel
      const s0 = top.clone(), sock = sweep([s0.clone().addScaledVector(d, -0.08), s0], [0.04, 0.034], { radial: 6 });
      acc.add(sock, { matrix: Mh, skin: rigid(hi), color: c.trim, dtl: [0, 0, 0.2, 0] });
      const bl = [0, 0.08, 0.2, 0.34, 0.46, 0.55].map(t => s0.clone().addScaledVector(d, t));
      const blade = sweep(bl, [0.035, 0.085, 0.09, 0.06, 0.028, 0.002], { radial: 8, flat: 0.16, up: [0, 0, 1] });
      const bc = col(c.plate), bg = col(c.glow);
      acc.add(blade, { matrix: Mh, skin: rigid(hi), dtl: [0, 0, 0.15, 0], color: (p, n, uv) => { const mid = Math.abs(Math.cos(uv[0] * Math.PI * 2)); return lerp3(bc, bg, sstep(0.9, 0.99, mid) * sstep(0.1, 0.25, uv[1]) * (1 - sstep(0.75, 0.9, uv[1]))); }, emis: (p, uv) => { const mid = Math.abs(Math.cos(uv[0] * Math.PI * 2)); return 2.6 * sstep(0.9, 0.99, mid) * sstep(0.1, 0.25, uv[1]) * (1 - sstep(0.75, 0.9, uv[1])); } });
      // side barbs
      for (const s of [-1, 1]) {
        const a = s0.clone().addScaledVector(d, 0.06).add(new THREE.Vector3(s * 0.05, 0, 0));
        addHorn(acc, rigid(hi), a.clone().applyMatrix4(Mh).toArray(), a.clone().add(new THREE.Vector3(s * 0.09, -0.03, 0)).applyMatrix4(Mh).toArray(), a.clone().add(new THREE.Vector3(s * 0.1, -0.1, 0)).applyMatrix4(Mh).toArray(), 0.02, 0.002, { base: c.plate2, tip: c.plate, radial: 4, n: 4 });
      }
      // crimson tassel under the blade
      const tq = s0.clone().addScaledVector(d, -0.1);
      acc.add(sweep([tq, tq.clone().add(new THREE.Vector3(0.02, -0.1, 0.03)), tq.clone().add(new THREE.Vector3(0.03, -0.24, 0.07))], [0.03, 0.035, 0.005], { radial: 5 }), { matrix: Mh, skin: rigid(hi), color: c.cloth, dtl: [0, 0, 0.2, 0.5] });
    }
    // tower shield on the left forearm: curved, horned boss, burning sigil
    {
      const hi = b('handL'), wr = P.wp[hi];
      const fwd = new THREE.Vector3(-0.38, 0.02, -1).normalize();
      const ctr = wr.clone().addScaledVector(fwd, 0.07).add(new THREE.Vector3(-0.03, 0.06, 0));
      const Ms = M(hi).multiply(aim(ctr.toArray(), fwd.toArray(), [0, 1, 0.1]));
      const W = 0.27 * (E ? 1.08 : 1), H = 0.44 * (E ? 1.08 : 1);
      const g = new THREE.BoxGeometry(2, 2, 1, 6, 8, 1);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), zz = p.getZ(i);
        const taper = y < 0 ? 1 - Math.pow(-y, 2.2) * 0.55 : 1 - Math.pow(y, 6) * 0.08;
        x *= taper;
        const X = x * W, Y = y * H + (y < 0 ? -Math.pow(-y, 3) * 0.06 : 0);
        const Z = zz * 0.022 - (x * x) * 0.08;
        p.setXYZ(i, X, Y, Z);
      }
      g.computeVertexNormals();
      const cp = col(c.plate2), cr = col(c.plate), cf = col(c.cloth), cg = col(c.glow), ct = col(c.trim);
      acc.add(g, {
        matrix: Ms, skin: rigid(hi), dtl: [0, 0.05, 0.25, 0.05],
        color: (pp, n, uv, i) => {
          const x = g.attributes.position.getX(i) / W, y = g.attributes.position.getY(i) / H, front = g.attributes.position.getZ(i) > -((x * W) ** 2) * 0.08 + 0.005;
          if (!front) return cp;
          const rim = Math.max(sstep(0.82, 0.9, Math.abs(x) / (y < 0 ? 1 - Math.pow(-y, 2.2) * 0.55 : 1)), sstep(0.9, 0.97, Math.abs(y)));
          const ring = 1 - sstep(0.02, 0.04, Math.abs(Math.hypot(x * 0.9, y * 0.75) - 0.52));
          const bar = (1 - sstep(0.03, 0.05, Math.abs(x))) * (y < 0.1 ? 1 : 0) * (y > -0.85 ? 1 : 0);
          return lerp3(lerp3(lerp3(cf, cg, Math.max(ring, bar) * 0.9), ct, rim * 0.8), cr, rim * 0.3);
        },
      });
      // sigil glow as an emissive inlay (separate thin geometry so it can bloom)
      const ringG = new THREE.TorusGeometry(0.135, 0.009, 3, 20);
      acc.add(ringG, { matrix: Ms.clone().multiply(new THREE.Matrix4().makeScale(1.05, 1.35, 1).setPosition(0, 0.03, 0.03)), skin: rigid(hi), color: c.glow, emis: 2.6, dtl: [0, 0, 0, 0] });
      // horned boss
      const bossM = Ms.clone().multiply(new THREE.Matrix4().makeScale(1, 1, 0.7).setPosition(0, 0.06, 0.04));
      acc.add(new THREE.SphereGeometry(0.06, 8, 5), { matrix: bossM, skin: rigid(hi), color: c.boss, dtl: [0, 0, 0.2, 0] });
      for (const s of [-1, 1]) {
        const a = new THREE.Vector3(s * 0.04, 0.08, 0.06).applyMatrix4(Ms), m2 = new THREE.Vector3(s * 0.1, 0.12, 0.08).applyMatrix4(Ms), e = new THREE.Vector3(s * 0.09, 0.21, 0.07).applyMatrix4(Ms);
        addHorn(acc, rigid(hi), a.toArray(), m2.toArray(), e.toArray(), 0.018, 0.002, { base: c.horn, tip: c.hornTip, radial: 4, n: 4 });
      }
      for (const s of [0]) { // bottom rim spike
        const a = new THREE.Vector3(s * 0.1, -H * 0.95, 0.0).applyMatrix4(Ms), e = new THREE.Vector3(s * 0.12, -H * 1.14, 0.02).applyMatrix4(Ms);
        acc.add(sweep([a, e], [0.022, 0.001], { radial: 4 }), { skin: rigid(hi), color: c.plate2, dtl: [0, 0, 0.2, 0] });
      }
    }
    if (E) { // cape
      const g = leafGeo(0.3, 1.1, 0.03, 0.3, -0.25, { nu: 6, nv: 6, pw: 0.15, tipW: 0.25 });
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI + 0.15, Math.PI, 0, 'YXZ')); m.setPosition(0, 1.62, 0.2);
      const c1 = col(c.cloth), c2 = col(c.cloth2), cg = col(c.trim);
      acc.add(g, { matrix: m, skin: (pp) => ({ si: [b('chest'), b('tabB'), 0, 0], sw: [clamp01((pp.y - 0.8) / 0.8), 1 - clamp01((pp.y - 0.8) / 0.8), 0, 0] }), dtl: [0, 0, 0.2, 0.6], color: (p, n, uv) => lerp3(lerp3(c1, c2, uv[1] * 0.7), cg, sstep(0.9, 0.97, (uv[0] % 1) * 2) * 0.7) });
    }
  },
  sockets: {
    head: ['head', [0, 2.08, -0.05]], mouth: ['head', [0, 1.8, -0.24]], center: ['chest', [0, 1.35, -0.05]], chest: ['chest', [0, 1.45, -0.22]],
    back: ['chest', [0, 1.5, 0.22]], handR: ['handR', [0.49, 0.95, -0.06]], handL: ['handL', [-0.49, 0.95, -0.06]],
  },
  height: 2.2, radius: 0.55,
  controller(inst) { return new BipedCtl(inst, LEG_SPEC); },
  get actionList() { return ACTIONS; },
};

// ------------------------------------------------------------------------------------------------ animation
function arms(ctl, pr, pl, w) { const b = ctl.b; if (pr) armSet(ctl.pose, b.armR, 1, pr, w); if (pl) armSet(ctl.pose, b.armL, -1, pl, w); }
const lerpA = (out, a, b2, t) => { for (let i = 0; i < 5; i++) out[i] = a[i] + (b2[i] - a[i]) * t; return out; };
const _a = [0, 0, 0, 0, 0], _b = [0, 0, 0, 0, 0];
// keyed arm poses
const THRUST_BACK = [0.25, -0.25, 0.25, 1.5, -1.45], THRUST_OUT = [1.3, 0.05, 0.05, 0.12, -1.35];
const BASH_OUT = [1.25, 0.2, 0.1, 0.55, 0], BLOCK_L = [1.0, 0.5, 0.0, 1.25, 0];
const LIFT_R = [2.65, -0.05, 0.2, 0.9, -4.1], SLAM_R = [0.85, 0.05, 0.1, 0.1, -2.05];   // spear over the shoulder point-down → stabbed into the ground
const LIFT_L = [0.9, -0.3, 0.85, 0.7, 0], SLAM_L = [0.55, 0.1, 0.45, 0.9, 0];
const RAISE_R = [2.6, 0, 0.35, 0.3, -0.2];

const busyNames = ['attack', 'attack2', 'attack_big', 'roar', 'block', 'death', 'knockdown', 'getup', 'spawn', 'spawn_drop', 'knockback', 'idle_alt'];
const ACTIONS = {
  attack: { dur: 0.85, a: 0.08, d: 0.85, hit: 0.5, fn(ctl, a, w) { // spear thrust from the levelled guard
    const P = ctl.pose, b = ctl.b, k = a.k;
    const back = sstep(0.0, 0.38, k) * (1 - sstep(0.4, 0.5, k)), out = sstep(0.4, 0.52, k) * (1 - sstep(0.68, 1, k));
    lerpA(_a, READY_R, THRUST_BACK, back);
    lerpA(_b, _a, THRUST_OUT, out);
    arms(ctl, _b, GUARD_L, w);
    P.move(b.hips, 0, -0.04 * (back + out) * w, (0.06 * back - 0.2 * out) * w);
    P.rot(b.spine, (0.05 * back - 0.12 * out) * w, (0.3 * back - 0.3 * out) * w, 0);
    P.rot(b.chest, 0, (0.2 * back - 0.25 * out) * w, 0);
    legsPlant(ctl, (back + out) * 0.6 * w, 1.35, -0.08);
  } },
  attack2: { dur: 0.9, a: 0.08, d: 0.85, hit: 0.45, fn(ctl, a, w) { // shield bash
    const P = ctl.pose, b = ctl.b, k = a.k;
    const wind = sstep(0, 0.3, k) * (1 - sstep(0.32, 0.42, k)), bash = sstep(0.34, 0.46, k) * (1 - sstep(0.62, 1, k));
    lerpA(_a, GUARD_L, BASH_OUT, bash);
    arms(ctl, HOLD_R, _a, w);
    P.move(b.hips, 0, -0.05 * (wind + bash) * w, (0.05 * wind - 0.28 * bash) * w);
    P.rot(b.spine, (0.1 * wind - 0.15 * bash) * w, (-0.35 * wind + 0.3 * bash) * w, 0);
    legsPlant(ctl, (wind + bash) * 0.7 * w, 1.3, -0.1 * bash);
  } },
  attack_big: { dur: 2.1, a: 0.05, d: 0.9, hit: 0.64, fn(ctl, a, w) { // raise the spear overhead point-down (telegraph), leap & impale the ground
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t, H = ctl.H;
    const lift = sstep(0, 0.3, k) * (1 - sstep(0.56, 0.64, k));
    const trem = sstep(0.3, 0.55, k) * (1 - sstep(0.56, 0.6, k)) * Math.sin(t * 50) * 0.03;
    const jump = Math.sin(clamp01((k - 0.5) / 0.14) * Math.PI) * (k < 0.64 ? 1 : 0);
    const slam = sstep(0.58, 0.64, k) * (1 - sstep(0.8, 1, k));
    lerpA(_a, READY_R, LIFT_R, lift); lerpA(_a, _a, SLAM_R, slam);
    lerpA(_b, GUARD_L, LIFT_L, lift * 0.7); lerpA(_b, _b, SLAM_L, slam);
    arms(ctl, _a, _b, w);
    P.move(b.hips, 0, (-0.05 * lift + 0.2 * jump - 0.1 * slam) * H * w, -0.3 * sstep(0.5, 0.64, k) * (1 - sstep(0.85, 1, k)) * H * w);
    P.rot(b.hips, (0.08 * lift - 0.28 * slam) * w, (0.25 * lift - 0.1 * slam) * w, trem * w);
    P.rot(b.spine, (0.2 * lift - 0.25 * slam + trem) * w, 0, 0);
    P.rot(b.head, (0.25 * lift - 0.2 * slam) * w, 0, 0);
    ctl.glow = mix(ctl.glow, 1 + 2.5 * sstep(0.1, 0.55, k) * (1 - sstep(0.66, 0.8, k)), w);
    ctl.charge = Math.max(ctl.charge, sstep(0.1, 0.55, k) * (1 - sstep(0.6, 0.7, k)) * w);
    legsLocal(ctl, jump * w, 0.3, 1.1);
    legsPlant(ctl, (lift * (1 - jump) + slam) * 0.8 * w, 1.45, -0.05);
  } },
  roar: { dur: 1.8, a: 0.08, d: 0.85, fn(ctl, a, w) { // war cry: bang spear on shield twice, then raise the spear high
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const bang = k < 0.5 ? Math.pow(Math.abs(Math.sin(k * Math.PI * 4)), 3) : 0, raise = sstep(0.5, 0.62, k) * (1 - sstep(0.88, 1, k));
    lerpA(_a, READY_R, [0.6, -0.5, 0.1, 1.4, -1.2], bang); lerpA(_a, _a, RAISE_R, raise);
    arms(ctl, _a, GUARD_L, w);
    P.rot(b.spine, (0.1 * raise) * w, (-0.15 * bang) * w, 0);
    P.rot(b.head, (0.3 * raise + Math.sin(t * 35) * 0.02 * raise) * w, 0, 0);
    ctl.glow = mix(ctl.glow, 1 + 1.6 * raise, w);
    legsPlant(ctl, 0.5 * w, 1.35, 0);
  } },
  block: { dur: 0.3, hold: true, fadeIn: 0.12, fadeOut: 0.2, fn(ctl, a, w) { // shield up (hold until stop / next action)
    const P = ctl.pose, b = ctl.b;
    arms(ctl, READY_R, BLOCK_L, w);
    P.move(b.hips, 0, -0.08 * w, 0.03 * w); P.rx(b.spine, -0.1 * w); P.rx(b.head, -0.05 * w);
    legsPlant(ctl, w, 1.5, -0.05);
  } },
  idle_alt: { dur: 2.2, a: 0.15, d: 0.85, fn(ctl, a, w) { // shoulder the spear, crack the neck
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    arms(ctl, HOLD_R, GUARD_L, w);
    const cr = sstep(0.2, 0.35, k) * (1 - sstep(0.4, 0.55, k)), cr2 = sstep(0.55, 0.68, k) * (1 - sstep(0.72, 0.9, k));
    P.rot(b.head, 0.05 * w, 0, (0.35 * cr - 0.35 * cr2) * w); P.rot(b.chest, 0, 0.1 * Math.sin(t * 2) * w, 0);
  } },
  hit: bHit({ dur: 0.45 }),
  knockback: bKnockback({ dur: 0.95 }),
  knockdown: bKnockdown({ lieY: 0.2 }),
  getup: bGetup({ lieY: 0.2, dur: 1.2 }),
  death: bDeath({ dist: 0.8, peak: 0.22, spin: 0.08, lieY: 0.2, air: 0.42, dur: 1.7 }),
  stun: bStun({ dur: 1.8 }),
  spawn: bSpawn({ depth: 1.05, dur: 1.9 }),
  spawn_drop: bDrop({ height: 2.5 }),
};

const LEG_SPEC = {
  bones: { hips: 'hips', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head', armL: ['armUL', 'armLL', 'handL'], armR: ['armUR', 'armLR', 'handR'] },
  gait: {
    legs: [
      { id: 'L', chain: ['thighL', 'shinL', 'metaL', 'footL'], toe: [-0.19, 0, -0.12], body: 'hips', scap: 0.2, lift: 0.14, flex: 0.9, heel: 0.3, out: 0.15, metaK: 1.0, metaBase: 0 },
      { id: 'R', chain: ['thighR', 'shinR', 'metaR', 'footR'], toe: [0.19, 0, -0.12], body: 'hips', scap: 0.2, lift: 0.14, flex: 0.9, heel: 0.3, out: 0.15, metaK: 1.0, metaBase: 0 },
    ],
    maxStride: 0.85, fMin: 0.6,
    gaits: [
      { v: 1.3, f: 1.7, duty: 0.6, lift: 0.8, off: { L: 0, R: 0.5 }, bob: 0.025, bobF: 2, bobPh: 0.1, roll: 0.035, rollF: 1, rollPh: 0.25, sway: 0.02, swayF: 1, swayPh: 0.25, nod: 0.02, nodF: 2 },
      { v: 4.5, f: 2.8, duty: 0.4, lift: 1.2, off: { L: 0, R: 0.5 }, bob: 0.05, bobF: 2, bobPh: 0.3, roll: 0.03, rollF: 1, rollPh: 0.25, nod: 0.03, nodF: 2 },
    ],
  },
  arm: { swing: 0.12, out: 0, elbow: 0, runSwing: 0.2, runOut: 0.05, runElbow: 0, combatUp: 0, combatElbow: 0, combatOut: 0, weaponSwing: 0.3 },
  lean: { walk: 0.06, run: 0.22, combat: 0.1 }, twist: 0.07, waddle: 0.03, crouch: 0.06, breathe: 0.012,
  fidgets: [{ name: 'idle_alt', w: 1 }],
  fidgetGap: 6,
  pose(ctl, dt) {
    const P = ctl.pose, b = ctl.b, B = P.b, A = ctl.acts;
    let busy = 0; for (const n of busyNames) { const x = A.weight(n); if (x > busy) busy = x; }
    const free = 1 - Math.min(1, busy);
    // weapon carriage: spear upright at rest, levelled in combat / when running
    const lev = Math.max(ctl.combat, ctl.run * 0.6);
    lerpA(_a, HOLD_R, READY_R, lev);
    arms(ctl, _a, GUARD_L, free);
    // tabards swing with the stride / lag behind motion
    const G = ctl.gait, ph = G.phase * Math.PI * 2;
    P.rx(B.tabF, (-0.25 * ctl.run - 0.1 * Math.abs(ctl.speedSm) * 0.1 + Math.sin(ph * 2) * 0.08 * G.act) + Math.sin(ctl.t * 1.7) * 0.02);
    P.rx(B.tabB, (0.35 * ctl.run + Math.sin(ph * 2 + 1) * 0.08 * G.act) + Math.sin(ctl.t * 1.5) * 0.02);
  },
  actions: ACTIONS,
};
