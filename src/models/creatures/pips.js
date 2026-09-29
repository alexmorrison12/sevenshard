// Pips — the game's mascot: tiny round sprout-folk of Pipsprout Hollow (~0.6 m). A soft bean body with a cream tummy,
// big sparkly eyes (they blink, squint when happy, widen when surprised), rosy cheeks, a mouth that opens to cheer/talk,
// stubby arms & feet, a petal collar and a springy two-leaf sprout on top that bounces with every hop.
// Locomotion: waddle when walking, bouncy two-footed hops when running — with squash & stretch.
//   pip       variants: sprout (default), elder (Bramblebeard-style: moss beard, brows, twig staff, flowering sprout),
//             child (small), merchant (straw hat + big pack), guard (acorn helm + twig spear + leaf shield),
//             farmer (leaf sun-hat + little hoe)
//   pip_seed  the collectible: a glowing baby sprout in a split seed pod, bobbing & turning. play('collect') pops it.
//   pip_pet   a pocket Pip that follows the player: hops, happy spins, sits, naps, picks up loot.
import * as THREE from 'three';
import { BipedCtl, BaseCtl, armRot, legsLocal, legsPlant } from './ctl.js';
import { sweep, rigid, bez, taper, leafGeo, eyeGeo, eyeMatrix } from '../kit/geo.js';
import { col } from '../kit/sdf.js';
import { lerp3 } from '../kit/parts.js';
import { orb } from './parts2.js';
import { sstep, clamp01, mix, bell, TAU } from '../kit/rig.js';

const PAL = {
  sprout: { body: 0x96d468, body2: 0x6aaa4a, belly: 0xf4f0c8, leaf: 0x4eb03a, leaf2: 0x9ae05a, stem: 0x5a9a3a, petal: 0xffd24a, petal2: 0xff9a3a, cheek: 0xff8f8f, iris: 0x4a2a14 },
  elder: { body: 0x7aa664, body2: 0x547a44, belly: 0xe4dcb4, leaf: 0x6a9a3a, leaf2: 0xa8c870, stem: 0x6a5230, petal: 0xc8a8ff, petal2: 0x8a6ad8, cheek: 0xf08a8a, iris: 0x3a2a1a, moss: 0x8a9e62, moss2: 0x5e7a3e, wood: 0x6a4a2c, bud: 0xff8ab0 },
  child: { body: 0xb4ec84, body2: 0x80c460, belly: 0xfaf6d8, leaf: 0x62c848, leaf2: 0xb0f070, stem: 0x6ab84a, petal: 0xffb0cc, petal2: 0xff7aa8, cheek: 0xff8a9a, iris: 0x4a2a14 },
  merchant: { body: 0x96d468, body2: 0x6aaa4a, belly: 0xf4f0c8, leaf: 0x4eb03a, leaf2: 0x9ae05a, stem: 0x5a9a3a, petal: 0x7ad0ff, petal2: 0x3a8ae0, cheek: 0xff8f8f, iris: 0x4a2a14, straw: 0xe8c878, band: 0xc83a2a, pack: 0x8a5a36, roll: 0x3a7ac8, coin: 0xf0c040 },
  guard: { body: 0x8ac65e, body2: 0x5e9a44, belly: 0xf0ecc4, leaf: 0x4eb03a, leaf2: 0x9ae05a, stem: 0x5a9a3a, petal: 0xff6a4a, petal2: 0xc83a2a, cheek: 0xff8f8f, iris: 0x3a2414, acorn: 0x8a5a2a, acorn2: 0xc08a4a, wood: 0x7a5a36, thorn: 0xe0d8b0 },
  farmer: { body: 0xa2d670, body2: 0x72aa4e, belly: 0xf6f0c4, leaf: 0x4eb03a, leaf2: 0x9ae05a, stem: 0x5a9a3a, petal: 0xfff080, petal2: 0xffc040, cheek: 0xff8f8f, iris: 0x4a2a14, hat: 0x5aa83a, hat2: 0x8ad05a, cloth: 0xd84a3a, wood: 0x8a6a42, stone: 0x9a9a92 },
};

// ------------------------------------------------------------------------------------------------ shared Pip body
function pipRig(R) {
  R.add('hips', null, [0, 0.12, 0]);
  R.add('spine', 'hips', [0, 0.22, 0]);
  R.add('chest', 'spine', [0, 0.32, 0]);
  R.add('head', 'chest', [0, 0.4, -0.01]);
  R.add('sprout1', 'head', [0, 0.565, 0.01]); R.add('sprout2', 'sprout1', [0, 0.63, 0.015]);
  R.add('eyeL', 'head', [-0.078, 0.392, -0.19]); R.add('eyeR', 'head', [0.078, 0.392, -0.19]);
  R.add('mouth', 'head', [0, 0.322, -0.207]);
  R.add('mouthO', 'head', [0, 0.318, -0.205]);
  for (const s of [-1, 1]) {
    const n = s < 0 ? 'L' : 'R';
    R.add('armU' + n, 'chest', [s * 0.185, 0.3, -0.01]); R.add('armL' + n, 'armU' + n, [s * 0.225, 0.245, -0.02]); R.add('hand' + n, 'armL' + n, [s * 0.25, 0.195, -0.03]);
    R.add('thigh' + n, 'hips', [s * 0.085, 0.11, 0]); R.add('shin' + n, 'thigh' + n, [s * 0.095, 0.066, -0.004]); R.add('foot' + n, 'shin' + n, [s * 0.1, 0.03, -0.01]);
  }
}
function pipSculpt(S, cfg) {
  const c = cfg.pal;
  const soft = [0.03, 0.02, 0.18, 0], softS = [0.02, 0.0, 0.14, 0];
  // soft bean: bottom bulge + upper head bulge, smooth-unioned
  S.ell('hips', [0, 0.19, 0.0], [0.205, 0.16, 0.19], { k: 0.12, col: c.body, tag: 'body', dtl: soft });
  S.ell('spine', [0, 0.28, 0.0], [0.2, 0.2, 0.185], { k: 0.12, col: c.body, tag: 'body', dtl: soft });
  S.ell('head', [0, 0.41, -0.01], [0.195, 0.165, 0.185], { k: 0.12, col: c.body, tag: 'head', dtl: soft });
  // stubby arms & round hands (hands: finer group)
  for (const s of [-1, 1]) {
    const n = s < 0 ? 'L' : 'R';
    S.cone('armU' + n, [s * 0.17, 0.3, -0.01], [s * 0.225, 0.245, -0.02], 0.045, 0.04, { k: 0.04, col: c.body, b2: 'armL' + n, t0: 0.6, t1: 1, dtl: soft });
    S.cone('armL' + n, [s * 0.225, 0.245, -0.02], [s * 0.25, 0.2, -0.03], 0.04, 0.038, { k: 0.03, col: c.body, b2: 'hand' + n, t0: 0.7, t1: 1, dtl: soft });
    S.sph('hand' + n, [s * 0.255, 0.185, -0.035], 0.043, { group: 2, k: 0.02, col: c.body2, tag: 'hand', dtl: softS });
    S.cone('thigh' + n, [s * 0.085, 0.11, 0], [s * 0.095, 0.06, -0.005], 0.05, 0.045, { k: 0.04, col: c.body, b2: 'shin' + n, t0: 0.5, t1: 1, dtl: soft });
    S.ell('foot' + n, [s * 0.1, 0.03, -0.035], [0.058, 0.036, 0.072], { group: 3, k: 0.02, col: c.body2, tag: 'foot', dtl: softS });
  }
}
function pipPaint(v, cfg) {
  const c = cfg.pal, [x, y, z] = v.p, [nx, ny, nz] = v.n;
  if (v.group === 0) {
    // cream tummy: a soft oval on the front-lower body
    const bx = x / 0.15, by = (y - 0.2) / 0.12;
    const tum = (1 - sstep(0.75, 1.0, Math.hypot(bx, by))) * sstep(0.1, 0.5, -nz);
    v.mix(c.belly, tum * 0.95);
    // darker back & top shading tint, lighter under the face
    v.mix(c.body2, sstep(0.3, 0.9, nz) * 0.35);
    // rosy cheeks
    for (const s of [-1, 1]) { const d = Math.hypot((x - s * 0.125) / 1.3, y - 0.338, (z + 0.165) * 0.8); v.mix(c.cheek, (1 - sstep(0.018, 0.04, d)) * 0.8); }
    // tiny freckles on the cheeks
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const d = Math.hypot(x - s * (0.11 + i * 0.018), y - (0.36 - (i % 2) * 0.012), z + 0.17); v.mix(c.body2, (1 - sstep(0.003, 0.006, d)) * 0.7); }
  }
  v.mul(1 + Math.sin(x * 31 + z * 23) * Math.sin(y * 27) * 0.02);
}
// big sparkly eye on its own bone (blink = scale y). dome + iris ring + 2 glints
function pipEye(acc, S, bone, p, dir, r, c) {
  const g = eyeGeo(r, [{ a: 0.55, c: 0 }, { a: 1.0, c: 1 }], 16, 1.6);
  const M = eyeMatrix(S, p, dir, r, 0.42, 0, 1.12);
  const cp = col(0x0c0806), ci = col(c.iris), cr = col(0x201410);
  acc.add(g, { matrix: M, skin: rigid(bone), dtl: [0, 0, 0, 0], color: (q, n, uv) => uv[0] === 0 ? cp : uv[0] === 1 ? ci : cr, emis: (q, uv) => uv[0] === 1 ? 0.12 : 0 });
  for (const [gx, gy, gr, e] of [[-0.36, 0.38, 0.3, 1.4], [0.3, -0.34, 0.14, 1.0]]) {
    const gp = new THREE.Vector3(gx * r, gy * r, r * 0.97).applyMatrix4(M);
    acc.add(new THREE.SphereGeometry(r * gr, 7, 5), { matrix: new THREE.Matrix4().makeTranslation(gp.x, gp.y, gp.z).multiply(new THREE.Matrix4().makeScale(1, 1, 0.5)), skin: rigid(bone), color: 0xffffff, emis: e, dtl: [0, 0, 0, 0] });
  }
}
function pipParts(acc, S, R, cfg) {
  const c = cfg.pal, b = (n) => R.index(n), V = cfg.variant;
  // eyes
  for (const s of [-1, 1]) pipEye(acc, S, b(s < 0 ? 'eyeL' : 'eyeR'), [s * 0.078, 0.392, -0.17], [s * 0.18, 0.02, -1], 0.056, c);
  // mouth: a little smile line + an open mouth (scaled from zero when cheering / talking)
  {
    const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6 - 0.5; pts.push([t * 0.06, 0.322 - 0.012 * (1 - 4 * t * t) + 0.004, -0.206 + Math.abs(t) * 0.012]); }
    const sm = sweep(pts.map(p => S.project(p.slice(), 0, 3).p), taper(7, 0.0045, 0.0045), { radial: 4 });
    acc.add(sm, { skin: rigid(b('mouth')), color: 0x4a2014, dtl: [0, 0, 0, 0] });
    const mo = new THREE.SphereGeometry(0.03, 10, 6, 0, TAU, 0, Math.PI / 2);
    const m = new THREE.Matrix4().makeRotationX(-Math.PI / 2).premultiply(new THREE.Matrix4().makeScale(1, 0.8, 0.45)).setPosition(0, 0.318, -0.2);
    const dk = col(0x5a1414), tg = col(0xff7a8a);
    acc.add(mo, { matrix: m, skin: rigid(b('mouthO')), dtl: [0, 0, 0, 0], color: (p) => (p.y < 0.306 ? tg : dk) });
  }
  // sprout: curved stem + two leaves (child: one leaf; elder: woody stem with a flower bud)
  {
    const stem = sweep(bez([0, 0.545, 0.01], [0, 0.6, 0.0], [0.004, 0.64, 0.015], 5), taper(5, V === 'elder' ? 0.016 : 0.012, 0.008), { radial: 6 });
    const s0 = col(c.stem), s1 = col(c.leaf);
    acc.add(stem, { skin: (p) => ({ si: [b('sprout1'), b('sprout2'), 0, 0], sw: [1 - sstep(0.58, 0.64, p.y), sstep(0.58, 0.64, p.y), 0, 0] }), color: (p, n, uv) => lerp3(s0, s1, uv[1] * 0.5), dtl: [0, 0, 0.1, 0] });
    const leaves = V === 'child' ? [[1, 1.0]] : [[-1, 1.0], [1, 0.85]];
    const lc = col(c.leaf), lc2 = col(c.leaf2), lv = col(c.stem);
    for (const [s, k] of leaves) {
      const L = (V === 'elder' ? 0.13 : 0.12) * k * (V === 'child' ? 1.15 : 1);
      const g = leafGeo(0.05 * k, L, 0.012, 0.45, 0.25, { nu: 6, nv: 6, pw: 0.7, tipW: 0.003, bendX: 0 });
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.15, 0, -s * 1.05, 'YXZ')); m.setPosition(0.004, 0.635, 0.015);
      acc.add(g, { matrix: m, skin: rigid(b('sprout2')), dtl: [0, 0, 0.12, 0], color: (p, n, uv) => { const u = (uv[0] % 1) * 2, t = uv[1]; const vein = 1 - sstep(0.04, 0.1, u); return lerp3(lerp3(lc, lc2, t * 0.7 + (uv[0] >= 1 ? 0.15 : 0)), lv, vein * 0.5 * (1 - t)); } });
    }
    if (V === 'elder') { // flower bud
      orb(acc, [0.004, 0.668, 0.015], 0.02, rigid(b('sprout2')), c.bud, 0.3, 1);
      for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4; const g = leafGeo(0.012, 0.025, 0.005, 0.3, 0.1, { nu: 3, nv: 3 }); acc.add(g, { matrix: new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.9, a, 0, 'YXZ')).setPosition(0.004, 0.655, 0.015), skin: rigid(b('sprout2')), color: c.leaf, dtl: [0, 0, 0, 0] }); }
    }
  }
  // petal collar around the neck line
  {
    const n = 10, pc = col(c.petal), pc2 = col(c.petal2);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + 0.3;
      const g = leafGeo(0.036, 0.055, 0.008, 0.3, 0.3, { nu: 4, nv: 4, pw: 0.5, tipW: 0.012 });
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-2.0, a + Math.PI, 0, 'YXZ'));
      const r = 0.175;
      m.setPosition(Math.sin(a) * r, 0.305, Math.cos(a) * r - 0.005);
      acc.add(g, { matrix: m, skin: (p) => ({ si: [b('chest'), b('head'), 0, 0], sw: [0.6, 0.4, 0, 0] }), dtl: [0, 0, 0.1, 0], color: (p, nn, uv) => lerp3(pc, pc2, sstep(0.3, 1, uv[1]) * 0.6) });
    }
  }
  // ---- variant props
  if (V === 'elder') {
    const mc = col(c.moss), mc2 = col(c.moss2);
    // moss beard: hanging tufts from the chin line
    for (let i = 0; i < 9; i++) {
      const t = i / 8 - 0.5, x = t * 0.2, z = -0.18 + Math.abs(t) * 0.1;
      const L = 0.13 - Math.abs(t) * 0.1 + (i % 2) * 0.02;
      const p0 = [x, 0.31, z];
      const g = sweep([p0, [x * 1.05, 0.31 - L * 0.5, z - 0.03], [x * 1.1, 0.31 - L, z - 0.02]], [0.028, 0.022, 0.006], { radial: 5 });
      acc.add(g, { skin: (p) => ({ si: [b('head'), b('chest'), 0, 0], sw: [0.7, 0.3, 0, 0] }), color: (p, n, uv) => lerp3(mc, mc2, uv[1] * 0.8), dtl: [0.5, 0, 0.2, 0] });
    }
    // bushy brows
    for (const s of [-1, 1]) acc.add(sweep([[s * 0.045, 0.45, -0.19], [s * 0.08, 0.462, -0.185], [s * 0.12, 0.45, -0.165]], [0.012, 0.018, 0.008], { radial: 5 }), { skin: rigid(b('head')), color: c.moss, dtl: [0.5, 0, 0.2, 0] });
    // twig staff in the right hand: gnarled, with a leaf and a glowing seed at the top
    const st = sweep(bez([0.262, 0.0, -0.05], [0.25, 0.4, -0.08], [0.275, 0.78, -0.06], 7), taper(7, 0.014, 0.011), { radial: 5, capStart: true });
    acc.add(st, { skin: rigid(b('handR')), color: c.wood, dtl: [0, 0, 0.2, 0.5] });
    orb(acc, [0.278, 0.8, -0.06], 0.022, rigid(b('handR')), 0xc8ff70, 1.6, 1);
    const lg = leafGeo(0.025, 0.06, 0.006, 0.3, 0.2, { nu: 4, nv: 4 });
    acc.add(lg, { matrix: new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, 0.4, -0.9, 'YXZ')).setPosition(0.27, 0.72, -0.06), skin: rigid(b('handR')), color: c.leaf, dtl: [0, 0, 0, 0] });
  }
  if (V === 'merchant') {
    // straw hat: wide brim + crown (sprout pokes through)
    const brim = new THREE.CylinderGeometry(0.25, 0.26, 0.012, 20, 1, false);
    const sc = col(c.straw), sc2 = col(0xc8a458);
    acc.add(brim, { matrix: new THREE.Matrix4().makeRotationX(0.12).setPosition(0, 0.53, -0.01), skin: rigid(b('head')), dtl: [0, 0, 0.2, 0.8], color: (p) => lerp3(sc, sc2, sstep(0.8, 0.95, Math.abs(Math.sin(Math.atan2(p.x, p.z) * 12)))) });
    const crown = new THREE.CylinderGeometry(0.1, 0.13, 0.08, 16, 1, true);
    acc.add(crown, { matrix: new THREE.Matrix4().makeRotationX(0.12).setPosition(0, 0.575, -0.005), skin: rigid(b('head')), dtl: [0, 0, 0.2, 0.8], color: sc });
    const band = new THREE.CylinderGeometry(0.12, 0.128, 0.025, 16, 1, true);
    acc.add(band, { matrix: new THREE.Matrix4().makeRotationX(0.12).setPosition(0, 0.55, -0.008), skin: rigid(b('head')), color: c.band, dtl: [0, 0, 0.1, 0.3] });
    // big pack with a rolled blanket and a pan
    const pack = new THREE.BoxGeometry(0.26, 0.26, 0.14, 2, 2, 1);
    acc.add(pack, { matrix: new THREE.Matrix4().setPosition(0, 0.3, 0.22), skin: rigid(b('chest')), color: c.pack, dtl: [0, 0, 0.3, 0.5] });
    const roll = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10);
    acc.add(roll, { matrix: new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(0, 0.46, 0.22), skin: rigid(b('chest')), color: c.roll, dtl: [0, 0, 0.2, 0.6] });
    acc.add(new THREE.CylinderGeometry(0.055, 0.05, 0.02, 10), { matrix: new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0.12, 0.26, 0.3), skin: rigid(b('chest')), color: 0x3a3a40, dtl: [0, 0, 0.2, 0] });
    for (const s of [-1, 1]) acc.add(sweep([[s * 0.09, 0.42, 0.16], [s * 0.12, 0.34, -0.12], [s * 0.1, 0.2, -0.15]], [0.012, 0.012, 0.012], { radial: 4 }), { skin: rigid(b('chest')), color: 0x5a3a22, dtl: [0, 0, 0.2, 0.3] });
    orb(acc, [-0.16, 0.16, -0.1], 0.04, rigid(b('hips')), c.coin, 0.2, 1);
  }
  if (V === 'guard') {
    // acorn helm: scaly cap on the head + stem nub, the sprout pokes out through the top
    const cap = new THREE.SphereGeometry(0.2, 18, 8, 0, TAU, 0, Math.PI * 0.42);
    const a1 = col(c.acorn), a2 = col(c.acorn2);
    acc.add(cap, { matrix: new THREE.Matrix4().makeScale(1.04, 0.95, 1.02).setPosition(0, 0.43, -0.01), skin: rigid(b('head')), dtl: [0, 0.45, 0.2, 0], color: (p) => lerp3(a1, a2, sstep(0.8, 0.95, Math.abs(Math.sin(p.x * 60) * Math.sin(p.z * 60 + p.y * 40)))) });
    const rim = new THREE.TorusGeometry(0.18, 0.018, 5, 22);
    acc.add(rim, { matrix: new THREE.Matrix4().makeRotationX(Math.PI / 2 + 0.05).setPosition(0, 0.495, -0.012), skin: rigid(b('head')), color: c.acorn, dtl: [0, 0.3, 0.2, 0] });
    // twig spear with a thorn tip
    acc.add(sweep([[0.262, 0.02, -0.06], [0.266, 0.4, -0.08], [0.27, 0.82, -0.1]], [0.012, 0.012, 0.01], { radial: 5, capStart: true }), { skin: rigid(b('handR')), color: c.wood, dtl: [0, 0, 0.2, 0.5] });
    acc.add(sweep([[0.27, 0.82, -0.1], [0.271, 0.86, -0.1], [0.272, 0.93, -0.1]], [0.022, 0.018, 0.001], { radial: 5, flat: 0.5 }), { skin: rigid(b('handR')), color: c.thorn, dtl: [0, 0, 0.1, 0] });
    // leaf shield on the left arm
    const lg = leafGeo(0.1, 0.22, 0.02, 0.6, 0.05, { nu: 5, nv: 5, pw: 0.6 });
    const lc = col(c.leaf), lc2 = col(c.leaf2);
    acc.add(lg, { matrix: new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI + 0.2, -0.5, 0, 'YXZ')).setPosition(-0.3, 0.33, -0.06), skin: rigid(b('armLL')), dtl: [0, 0, 0.1, 0], color: (p, n, uv) => lerp3(lc, lc2, uv[1] * 0.6) });
  }
  if (V === 'farmer') {
    // a broad leaf worn as a sun-hat, stem at the back
    const g = leafGeo(0.2, 0.36, 0.02, 0.9, -0.35, { nu: 7, nv: 6, pw: 0.5, tipW: 0.02 });
    const hc = col(c.hat), hc2 = col(c.hat2), hv = col(c.stem);
    acc.add(g, { matrix: new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-Math.PI / 2 - 0.25, Math.PI, 0, 'YXZ')).setPosition(0, 0.55, 0.16), skin: rigid(b('head')), dtl: [0, 0, 0.12, 0], color: (p, n, uv) => { const u = (uv[0] % 1) * 2; return lerp3(lerp3(hc, hc2, uv[1] * 0.5), hv, (1 - sstep(0.03, 0.08, u)) * 0.6); } });
    // neckerchief
    for (let i = 0; i < 7; i++) { const a = -1.3 + i * 0.43; acc.add(new THREE.SphereGeometry(0.03, 6, 4), { matrix: new THREE.Matrix4().makeTranslation(Math.sin(a) * 0.17, 0.3, -Math.cos(a) * 0.16), skin: rigid(b('chest')), color: c.cloth, dtl: [0, 0, 0.1, 0.5] }); }
    // little hoe: twig handle + flat stone blade
    acc.add(sweep([[0.262, 0.05, -0.05], [0.268, 0.38, -0.07], [0.275, 0.66, -0.09]], [0.011, 0.011, 0.01], { radial: 5, capStart: true }), { skin: rigid(b('handR')), color: c.wood, dtl: [0, 0, 0.2, 0.5] });
    acc.add(new THREE.BoxGeometry(0.02, 0.05, 0.1), { matrix: new THREE.Matrix4().setPosition(0.275, 0.64, -0.14), skin: rigid(b('handR')), color: c.stone, dtl: [0, 0, 0.3, 0] });
  }
}
const PIP_SOCKETS = {
  head: ['head', [0, 0.72, 0]], mouth: ['mouth', [0, 0.32, -0.22]], center: ['spine', [0, 0.28, -0.05]], chest: ['chest', [0, 0.3, -0.18]],
  back: ['chest', [0, 0.32, 0.2]], handR: ['handR', [0.255, 0.18, -0.04]], handL: ['handL', [-0.255, 0.18, -0.04]], sprout: ['sprout2', [0, 0.68, 0.015]],
};

// ------------------------------------------------------------------------------------------------ Pip actions
const happy = (ctl, v) => { ctl.happy = Math.max(ctl.happy, v); };
const openMouth = (ctl, v) => { ctl.mouthOpen = Math.max(ctl.mouthOpen, v); };
const PIP_ACTIONS = {
  hop: { dur: 0.62, a: 0.02, d: 0.95, fn(ctl, a, w) { // anticipation squash → stretch in the air → land squash
    const P = ctl.pose, b = ctl.b, k = a.k, H = ctl.H;
    const h = Math.sin(clamp01((k - 0.2) / 0.55) * Math.PI);
    P.move(b.hips, 0, 0.22 * H * h * w, 0);
    ctl.squash += (-0.16 * bell(clamp01(k / 0.22)) + 0.14 * h * (k < 0.5 ? 1 : 0.4) - 0.18 * bell(clamp01((k - 0.74) / 0.22))) * w;
    armRot(ctl, -1, 0.5 * h, 0.3, w, 0.6 * h); armRot(ctl, 1, 0.5 * h, 0.3, w, 0.6 * h);
    legsLocal(ctl, h * w, 0.1, 1.0);
    happy(ctl, 0.4 * h * w); ctl.sproutKick += (k < 0.25 ? -1 : k > 0.72 ? 1.2 : 0) * w * 0.6;
  } },
  wave: { dur: 1.5, a: 0.12, d: 0.85, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, t = a.t;
    const wv = Math.sin(t * 11);
    armRot(ctl, 1, 2.6, 0.5 + 0.35 * wv, w, 0.35 + 0.15 * wv);
    P.rot(b.chest, 0, 0, -0.08 * w); P.rot(b.head, 0.08 * w, 0.1 * w, -0.14 * w);
    happy(ctl, 0.8 * w); openMouth(ctl, 0.35 * w); ctl.squash += 0.03 * Math.sin(t * 11) * w;
  } },
  cheer: { dur: 1.3, a: 0.03, d: 0.9, fn(ctl, a, w) { // jump with both arms up
    const P = ctl.pose, b = ctl.b, k = a.k, H = ctl.H, t = a.t;
    const h = Math.sin(clamp01((k - 0.18) / 0.5) * Math.PI);
    P.move(b.hips, 0, 0.3 * H * h * w, 0);
    ctl.squash += (-0.18 * bell(clamp01(k / 0.2)) + 0.18 * h - 0.14 * bell(clamp01((k - 0.66) / 0.2))) * w;
    const up = sstep(0.1, 0.3, k) * (1 - sstep(0.8, 1, k));
    armRot(ctl, -1, 2.8 * up + Math.sin(t * 20) * 0.15 * up, 0.2, w, 0.4 * up); armRot(ctl, 1, 2.8 * up + Math.sin(t * 20 + 1) * 0.15 * up, 0.2, w, 0.4 * up);
    P.rot(b.head, 0.2 * up * w, 0, 0);
    legsLocal(ctl, h * w, 0.15, 1.1);
    happy(ctl, up * w); openMouth(ctl, up * w); ctl.sproutKick += (k < 0.2 ? -1 : k > 0.66 ? 1.4 : 0) * w * 0.7;
  } },
  dance: { dur: 1.6, loop: true, fadeIn: 0.2, fadeOut: 0.3, fn(ctl, a, w) { // bouncy side-steps, arms swinging, twirl on the last beat
    const P = ctl.pose, b = ctl.b, t = a.t, H = ctl.H, ph = a.t / 1.6 * TAU;
    const beat = Math.abs(Math.sin(ph * 2));
    const side = Math.sin(ph);
    P.move(b.hips, side * 0.06 * H * w, 0.07 * H * beat * w, 0);
    P.rot(b.hips, 0, 0.35 * side * w + (a.t % 3.2 > 2.4 ? sstep(2.4, 3.2, a.t % 3.2) * TAU : 0) * w, -0.18 * side * w);
    P.rot(b.head, 0.1 * w, -0.2 * side * w, 0.2 * side * w);
    armRot(ctl, -1, 1.6 + 1.0 * Math.sin(ph * 2), 0.4, w, 0.5 + 0.3 * side); armRot(ctl, 1, 1.6 - 1.0 * Math.sin(ph * 2), 0.4, w, 0.5 - 0.3 * side);
    ctl.squash += (0.1 * beat - 0.05) * w;
    happy(ctl, 0.9 * w); openMouth(ctl, 0.5 * beat * w); ctl.sproutKick += Math.cos(ph * 2) * 0.3 * w;
    legsPlant(ctl, w * 0.4, 1.4, 0);
  } },
  bow: { dur: 1.4, a: 0.2, d: 0.8, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k;
    const d = bell(clamp01((k - 0.1) / 0.8));
    P.rot(b.hips, -0.45 * d * w, 0, 0); P.rx(b.head, -0.2 * d * w);
    armRot(ctl, -1, 0.6 * d, 1.2 * d, w, -0.3 * d); armRot(ctl, 1, 0.6 * d, 1.2 * d, w, -0.3 * d);
    happy(ctl, 0.7 * d * w); ctl.sproutKick += 0.4 * d * w;
  } },
  talk: { dur: 1.2, loop: true, fadeIn: 0.15, fadeOut: 0.25, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, t = a.t;
    const g = Math.sin(t * 5.2);
    armRot(ctl, 1, 1.1 + 0.3 * g, 0.9, w, 0.5 + 0.2 * g); armRot(ctl, -1, 0.5 - 0.2 * g, 0.7, w, 0.4);
    P.rot(b.head, 0.06 * Math.sin(t * 7) * w, 0.12 * Math.sin(t * 2.3) * w, 0.08 * g * w);
    openMouth(ctl, (0.3 + 0.35 * Math.max(0, Math.sin(t * 17))) * w); ctl.squash += 0.02 * Math.sin(t * 10) * w;
  } },
  surprised: { dur: 1.1, a: 0.02, d: 0.85, fn(ctl, a, w) { // jolt back, arms up, eyes wide, "o" mouth
    const P = ctl.pose, b = ctl.b, k = a.k, H = ctl.H;
    const j = sstep(0, 0.1, k) * (1 - sstep(0.6, 1, k)), hop = Math.sin(clamp01(k / 0.3) * Math.PI);
    P.move(b.hips, 0, 0.12 * H * hop * w, 0.06 * H * j * w);
    P.rot(b.hips, 0.2 * j * w, 0, 0);
    armRot(ctl, -1, 2.2 * j, 0.5, w, 0.7 * j); armRot(ctl, 1, 2.2 * j, 0.5, w, 0.7 * j);
    ctl.eyeWide = Math.max(ctl.eyeWide, j * w); openMouth(ctl, 0.7 * j * w); ctl.squash += 0.14 * hop * w; ctl.sproutKick += 1.5 * (k < 0.15 ? 1 : 0) * w;
  } },
  laugh: { dur: 1.5, a: 0.1, d: 0.85, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, t = a.t;
    const sh = Math.sin(t * 24);
    P.rot(b.hips, 0.1 * w, 0, 0.05 * sh * w); P.rot(b.head, 0.2 * w + 0.03 * sh * w, 0, 0);
    armRot(ctl, -1, 0.8, 1.6, w, -0.2); armRot(ctl, 1, 0.8, 1.6, w, -0.2);
    happy(ctl, w); openMouth(ctl, (0.6 + 0.3 * sh) * w); ctl.squash += 0.04 * sh * w;
  } },
  shy: { dur: 1.8, a: 0.15, d: 0.8, fn(ctl, a, w) { // hands over the face, twisting
    const P = ctl.pose, b = ctl.b, t = a.t;
    armRot(ctl, -1, 1.9, 1.9, w, -0.35); armRot(ctl, 1, 1.9, 1.9, w, -0.35);
    P.rot(b.hips, 0, 0.3 * Math.sin(t * 3) * w, 0); P.rot(b.head, -0.15 * w, 0, 0.12 * w);
    happy(ctl, 0.6 * w);
  } },
  think: { dur: 2.2, a: 0.15, d: 0.85, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, t = a.t;
    armRot(ctl, 1, 1.4, 2.1, w, -0.35); armRot(ctl, -1, 0.9, 1.5, w, -0.3);
    P.rot(b.head, 0.2 * w, 0.15 * w, 0.2 * w + 0.05 * Math.sin(t * 2) * w);
    ctl.lookUp = Math.max(ctl.lookUp, w);
  } },
  spin: { dur: 1.0, a: 0.05, d: 0.9, fn(ctl, a, w) { // happy pirouette
    const P = ctl.pose, b = ctl.b, k = a.k, H = ctl.H;
    const h = Math.sin(clamp01(k) * Math.PI);
    P.move(b.hips, 0, 0.12 * H * h * w, 0);
    P.rot(b.hips, 0, ease(k) * TAU * w, 0);
    armRot(ctl, -1, 1.2 * h, 0.2, w, 1.2 * h); armRot(ctl, 1, 1.2 * h, 0.2, w, 1.2 * h);
    happy(ctl, h * w); openMouth(ctl, 0.4 * h * w); ctl.squash += 0.1 * h * w; ctl.sproutKick += 0.8 * h * w;
    legsLocal(ctl, h * w, 0.1, 1.0);
  } },
  sit: { dur: 0.6, hold: true, rest: true, fadeIn: 0.35, fadeOut: 0.3, fn(ctl, a, w) { // plop down
    const P = ctl.pose, b = ctl.b, H = ctl.H;
    P.move(b.hips, 0, -0.1 * H * w, 0.02 * H * w); P.rx(b.hips, 0.12 * w);
    ctl.squash += -0.08 * w;
    armRot(ctl, -1, 0.3, 0.5, w, 0.25); armRot(ctl, 1, 0.3, 0.5, w, 0.25);
    for (const L of ctl.gait.legs) { L.override = L.override || new THREE.Vector3(); L.override.set(L.toe.x * 1.3, 0.02, L.toe.z - 0.09); L.overrideLocal = false; L.overridePaw = 0.5; if (w > L.overrideW) L.overrideW = w; }
  } },
  sleep: { dur: 1.0, hold: true, rest: true, fadeIn: 0.8, fadeOut: 0.4, fn(ctl, a, w) { // sit, head drooping, eyes shut, slow breathing
    const P = ctl.pose, b = ctl.b, H = ctl.H, t = a.t;
    const br = Math.sin(t * 1.6);
    P.move(b.hips, 0, -0.1 * H * w, 0.02 * H * w); P.rot(b.hips, 0.12 * w, 0, 0.08 * w);
    P.rot(b.head, -0.3 * w, 0, 0.25 * w);
    ctl.squash += (-0.08 + 0.025 * br) * w;
    armRot(ctl, -1, 0.1, 0.3, w, 0.15); armRot(ctl, 1, 0.1, 0.3, w, 0.15);
    ctl.eyeClose = Math.max(ctl.eyeClose, w); ctl.sproutKick += 0.15 * w;
    for (const L of ctl.gait.legs) { L.override = L.override || new THREE.Vector3(); L.override.set(L.toe.x * 1.3, 0.02, L.toe.z - 0.09); L.overrideLocal = false; L.overridePaw = 0.5; if (w > L.overrideW) L.overrideW = w; }
  } },
  pickup: { dur: 1.0, a: 0.1, d: 0.85, fn(ctl, a, w) { // dip down & scoop something up
    const P = ctl.pose, b = ctl.b, k = a.k, H = ctl.H;
    const dip = bell(clamp01(k / 0.6)), lift = sstep(0.5, 0.75, k) * (1 - sstep(0.85, 1, k));
    P.move(b.hips, 0, -0.08 * H * dip * w, 0); P.rx(b.hips, -0.4 * dip * w);
    armRot(ctl, -1, 1.0 * dip + 1.5 * lift, 0.3, w, 0.1); armRot(ctl, 1, 1.0 * dip + 1.5 * lift, 0.3, w, 0.1);
    ctl.squash += -0.08 * dip * w + 0.08 * lift * w; happy(ctl, lift * w); openMouth(ctl, 0.5 * lift * w);
  } },
  attack: { dur: 0.7, a: 0.08, d: 0.85, hit: 0.45, fn(ctl, a, w) { // guard: spear poke (others: a brave little bonk)
    const P = ctl.pose, b = ctl.b, k = a.k, H = ctl.H;
    const back = sstep(0, 0.35, k) * (1 - sstep(0.38, 0.48, k)), jab = sstep(0.38, 0.5, k) * (1 - sstep(0.62, 1, k));
    P.move(b.hips, 0, 0.03 * H * jab * w, (0.04 * back - 0.12 * jab) * H * w);
    P.rot(b.hips, (0.1 * back - 0.25 * jab) * w, (0.3 * back - 0.2 * jab) * w, 0);
    armRot(ctl, 1, 0.6 * back + 1.5 * jab, 1.2 * back, w, 0.3 * back);
    ctl.squash += (-0.06 * back + 0.08 * jab) * w; ctl.eyeWide = Math.max(ctl.eyeWide, 0.4 * jab * w); openMouth(ctl, 0.5 * jab * w);
  } },
  hit: { dur: 0.45, a: 0.05, d: 0.5, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k;
    const j = sstep(0, 0.12, k) * (1 - sstep(0.3, 1, k)) * w;
    P.rot(b.hips, 0.25 * j, 0, 0.12 * j * Math.sign(Math.sin(a.seed))); P.move(b.hips, 0, 0, 0.03 * j);
    ctl.squash -= 0.1 * j; ctl.eyeClose = Math.max(ctl.eyeClose, j); openMouth(ctl, 0.5 * j); ctl.sproutKick += j;
  } },
  death: { dur: 1.3, hold: true, excl: true, state: true, fadeIn: 0.02, fn(ctl, a, w) { // faint: wobble, topple backwards, eyes shut
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t, H = ctl.H;
    const wob = Math.sin(t * 16) * 0.15 * (1 - sstep(0.1, 0.4, k));
    const fall = sstep(0.3, 0.7, k), bounce = Math.sin(clamp01((k - 0.7) / 0.2) * Math.PI) * 0.03 * H;
    P.move(b.hips, 0, (-0.1 * H * fall + bounce) * w, 0.08 * H * fall * w);
    P.rot(b.hips, 1.35 * fall * w, 0, wob * w);
    armRot(ctl, -1, 1.2 * fall, 0.3, w, 1.0 * fall); armRot(ctl, 1, 1.2 * fall, 0.3, w, 1.0 * fall);
    ctl.eyeClose = Math.max(ctl.eyeClose, sstep(0.2, 0.4, k) * w); openMouth(ctl, 0.4 * fall * w);
    ctl.squash += -0.1 * bell(clamp01((k - 0.68) / 0.2)) * w; ctl.sproutKick += (k > 0.68 && k < 0.75 ? 2 : 0) * w;
    legsLocal(ctl, fall * w, 0.1, 1.1);
  } },
  spawn: { dur: 1.3, a: 0.001, d: 0.9, state: true, excl: true, fn(ctl, a, w) { // pop out of the ground like a sprout
    const P = ctl.pose, b = ctl.b, k = a.k, H = ctl.H;
    const up = sstep(0.15, 0.45, k), hop = Math.sin(clamp01((k - 0.35) / 0.35) * Math.PI) * (k > 0.35 ? 1 : 0);
    P.move(b.hips, 0, (-H * 0.95 * (1 - up) + 0.25 * H * hop) * w, 0);
    ctl.squash += (0.25 * sstep(0.25, 0.45, k) * (1 - sstep(0.45, 0.6, k)) - 0.2 * bell(clamp01((k - 0.68) / 0.18))) * w;
    armRot(ctl, -1, 2.5 * hop, 0.3, w, 0.6 * hop); armRot(ctl, 1, 2.5 * hop, 0.3, w, 0.6 * hop);
    happy(ctl, sstep(0.6, 0.8, k) * w); openMouth(ctl, sstep(0.6, 0.75, k) * (1 - sstep(0.9, 1, k)) * w);
    ctl.eyeClose = Math.max(ctl.eyeClose, (1 - sstep(0.4, 0.5, k)) * w); ctl.sproutKick += (k > 0.66 && k < 0.72 ? 2 : 0) * w;
    legsLocal(ctl, (1 - sstep(0.6, 0.7, k)) * w, 0.1, 1.0);
  } },
  idle_alt: { dur: 2.2, a: 0.15, d: 0.85, fn(ctl, a, w) { // look around curiously, wiggle the sprout
    const P = ctl.pose, b = ctl.b, t = a.t;
    P.rot(b.head, 0.12 * Math.sin(t * 2.2) * w, 0.45 * Math.sin(t * 1.6) * w, 0.2 * Math.sin(t * 3.1) * w);
    ctl.sproutKick += Math.sin(t * 9) * 0.5 * w; ctl.squash += 0.02 * Math.sin(t * 6) * w;
  } },
  stun: { dur: 1.6, loop: true, state: true, fadeIn: 0.2, fadeOut: 0.3, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, ph = a.t / 1.6 * TAU;
    P.rot(b.hips, 0.1 * Math.sin(ph) * w, 0, 0.15 * Math.cos(ph) * w);
    ctl.eyeClose = Math.max(ctl.eyeClose, 0.6 * w); openMouth(ctl, 0.3 * w); ctl.sproutKick += Math.sin(ph * 2) * 0.4 * w;
  } },
  knockdown: { dur: 0.7, hold: true, excl: true, state: true, fadeIn: 0.02, fadeOut: 0.05, fn(ctl, a, w) { // tumble onto its back
    const P = ctl.pose, b = ctl.b, k = a.k, H = ctl.H, t = a.t;
    const fall = sstep(0, 0.5, k), kick = Math.sin(t * 9) * 0.3 * sstep(0.8, 1, k);
    P.move(b.hips, 0, -0.1 * H * fall * w, 0.1 * H * fall * w); P.rot(b.hips, 1.4 * fall * w, 0, 0);
    armRot(ctl, -1, 1.5 * fall + kick, 0.3, w, 0.8); armRot(ctl, 1, 1.5 * fall - kick, 0.3, w, 0.8);
    ctl.eyeClose = Math.max(ctl.eyeClose, 0.5 * w); legsLocal(ctl, w, 0.15 + 0.1 * Math.max(0, kick), 1.1);
  } },
  getup: { dur: 0.8, a: 0.001, d: 0.8, state: true, fn(ctl, a, w) { // roll back up with a bounce
    const P = ctl.pose, b = ctl.b, k = a.k, H = ctl.H;
    const f = 1 - sstep(0, 0.6, k), hop = Math.sin(clamp01((k - 0.5) / 0.4) * Math.PI);
    P.move(b.hips, 0, (-0.1 * H * f + 0.1 * H * hop) * w, 0.1 * H * f * w); P.rot(b.hips, 1.4 * f * w, 0, 0);
    ctl.squash += 0.1 * hop * w; legsLocal(ctl, f * w, 0.15, 1.1);
  } },
  knockback: { dur: 0.7, a: 0.02, d: 0.7, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k, H = ctl.H;
    const j = sstep(0, 0.1, k) * (1 - sstep(0.4, 1, k));
    P.move(b.hips, 0, 0.05 * H * j * w, 0.08 * H * j * w); P.rot(b.hips, 0.4 * j * w, 0, 0);
    armRot(ctl, -1, 1.8 * j, 0.3, w, 0.8 * j); armRot(ctl, 1, 1.8 * j, 0.3, w, 0.8 * j);
    ctl.eyeWide = Math.max(ctl.eyeWide, j * w); openMouth(ctl, 0.6 * j * w); ctl.sproutKick += 1.2 * j * w;
  } },
};
const ease = (x) => x * x * (3 - 2 * x);

const PIP_SPEC = {
  bones: { hips: 'hips', spine: 'spine', chest: 'chest', head: 'head', armL: ['armUL', 'armLL', 'handL'], armR: ['armUR', 'armLR', 'handR'] },
  gait: {
    legs: [
      { id: 'L', chain: ['thighL', 'shinL', 'footL'], toe: [-0.1, 0, -0.04], body: 'hips', scap: 0.2, lift: 0.04, flex: 0.4, heel: 0.2, out: 0.3 },
      { id: 'R', chain: ['thighR', 'shinR', 'footR'], toe: [0.1, 0, -0.04], body: 'hips', scap: 0.2, lift: 0.04, flex: 0.4, heel: 0.2, out: 0.3 },
    ],
    maxStride: 0.2, fMin: 0.8, actV: 0.12,
    gaits: [
      { v: 0.7, f: 3.2, duty: 0.6, lift: 0.9, off: { L: 0, R: 0.5 }, bob: 0.012, bobF: 2, bobPh: 0.1, roll: 0.12, rollF: 1, rollPh: 0.25, sway: 0.012, swayF: 1, swayPh: 0.25 },
      { v: 3.2, f: 3.4, duty: 0.35, lift: 1.4, off: { L: 0, R: 0.04 }, bob: 0.07, bobF: 1, bobPh: 0.62, pitch: 0.06, pitchF: 1, pitchPh: 0.2 },
    ],
  },
  arm: { swing: 0.5, out: 0.35, elbow: 0.2, runSwing: 0.6, runOut: 0.6, runElbow: 0.3, combatUp: 0.3, combatElbow: 0.3, combatOut: 0.2 },
  lean: { walk: 0.05, run: 0.15, combat: 0.05 }, twist: 0.1, waddle: 0.14, crouch: 0.02, breathe: 0.03, airPaw: 0,
  fidgets: [{ name: 'hop', w: 3 }, { name: 'idle_alt', w: 3 }, { name: 'wave', w: 1 }, { name: 'spin', w: 1 }],
  fidgetGap: 3.2,
  pose(ctl, dt) {
    ctl.squash = 0; ctl.happy = 0; ctl.mouthOpen = 0; ctl.eyeWide = 0; ctl.eyeClose = 0; ctl.lookUp = 0; ctl.sproutKick = 0;
    // running = bouncy hop: squash on contact, stretch in the air (driven by the gait phase)
    const G = ctl.gait, hopK = ctl.run * G.act;
    if (hopK > 0.01) { const ph = (G.phase * TAU); ctl.squash += (0.1 * Math.sin(ph - 0.6) - 0.02) * hopK; ctl.sproutKick += Math.cos(ph) * 0.6 * hopK; }
    ctl.squash += 0.015 * Math.sin(ctl.t * 2.2); // breathing
  },
  post(ctl, dt) { pipFace(ctl, dt); },
  actions: PIP_ACTIONS,
};
// expressions + sprout spring + squash & stretch (applied after actions)
function pipFace(ctl, dt) {
  const P = ctl.pose, B = P.b;
  // blink every few seconds (skipped while eyes are forced shut / wide)
  ctl.blinkT = (ctl.blinkT ?? 2 + Math.random() * 3) - dt;
  if (ctl.blinkT < 0) ctl.blinkT = 2.2 + Math.random() * 3.5;
  const blink = ctl.blinkT < 0.13 ? Math.sin(ctl.blinkT / 0.13 * Math.PI) : 0;
  const shut = Math.max(ctl.eyeClose, blink * (1 - ctl.eyeWide));
  const sy = mix(mix(1, 0.32, ctl.happy), 0.08, shut) * (1 + 0.25 * ctl.eyeWide), sx = 1 + 0.18 * ctl.eyeWide;
  for (const e of [B.eyeL, B.eyeR]) { P.sc[e].set(sx, sy, 1); P.move(e, 0, 0.012 * ctl.happy + 0.006 * ctl.lookUp, 0); }
  // mouth: smile line shrinks as the open mouth grows
  const mo = clamp01(ctl.mouthOpen);
  P.sc[B.mouth].set(1 + 0.2 * ctl.happy - 0.3 * mo, 1, 1).multiplyScalar(mo > 0.6 ? 0.001 : 1);
  P.sc[B.mouthO].set(0.6 + 0.4 * mo, mo, mo);
  // sprout spring (lags body motion, bounces on landings)
  const k = ctl.sproutKick ?? 0;
  ctl.spV = (ctl.spV ?? 0) + ((k * 0.25 - (ctl.spA ?? 0)) * 60 - (ctl.spV ?? 0) * 6) * dt;
  ctl.spA = (ctl.spA ?? 0) + ctl.spV * dt;
  const sway = Math.sin(ctl.t * 1.7) * 0.06 + ctl.turnSm * 0.1;
  const lean = -ctl.speedSm * 0.05;
  P.rot(B.sprout1, ctl.spA * 0.6 + lean * 0.6, 0, sway * 0.5);
  P.rot(B.sprout2, ctl.spA + lean, Math.sin(ctl.t * 2.3) * 0.08, sway - ctl.spA * 0.3);
  // squash & stretch the whole Pip about its feet (volume-preserving-ish)
  const q = Math.max(-0.35, Math.min(0.35, ctl.squash)), s = ctl.inst.scale;
  ctl.inst.pivot.scale.set(s * (1 - q * 0.5), s * (1 + q), s * (1 - q * 0.5));
}

export const pip = {
  name: 'Pip',
  variants: ['sprout', 'elder', 'child', 'merchant', 'guard', 'farmer'],
  config(variant, opts) {
    const v = PAL[variant] ? variant : 'sprout';
    return { variant: v, pal: PAL[v], shapeKey: 'body', scale: v === 'child' ? 0.72 : v === 'elder' ? 1.04 : 1, h: 0.0165, hg: { 2: 0.012, 3: 0.012 }, mat: { dfreq: 5, furAxis: 1, rim: 0.45, rimColor: 0xfffbe0, spec: 0.18, shine: 16, wrap: 0.6 }, ao: { dist: 0.022, str: 0.6 }, grad: { top: 0.15, bottom: 0.25, y0: 0, y1: 0.3, low: 0.15 } };
  },
  rig: pipRig, sculpt: pipSculpt, paint: pipPaint, parts: pipParts,
  sockets: PIP_SOCKETS,
  height: 0.62, radius: 0.24,
  controller(inst) { return new BipedCtl(inst, PIP_SPEC); },
  get actionList() { return PIP_ACTIONS; },
};

// ------------------------------------------------------------------------------------------------ pip_pet
const PET_PAL = {
  sprout: { ...PAL.child, scarf: 0xe84a4a },
  bloom: { ...PAL.child, body: 0xf4c8e0, body2: 0xd898c0, belly: 0xfff4fa, petal: 0xfff080, petal2: 0xffc040, scarf: 0x4a8ae8 },
  sky: { ...PAL.child, body: 0xa8dcff, body2: 0x78b0e0, belly: 0xf4faff, petal: 0xffffff, petal2: 0xd8e8ff, scarf: 0xffc040 },
  ember: { ...PAL.child, body: 0xffb870, body2: 0xe08840, belly: 0xfff4e0, petal: 0xff6a4a, petal2: 0xc83a2a, scarf: 0x3a3a48 },
};
export const pip_pet = {
  name: 'Pipling', pet: true,
  variants: ['sprout', 'bloom', 'sky', 'ember'],
  config(variant) {
    const v = PET_PAL[variant] ? variant : 'sprout';
    return { variant: v, pal: { ...PET_PAL[v] }, petScarf: true, shapeKey: 'body', scale: 0.7, h: 0.0165, hg: { 2: 0.012, 3: 0.012 }, mat: { dfreq: 5, furAxis: 1, rim: 0.45, rimColor: 0xfffbe0, spec: 0.18, shine: 16, wrap: 0.6 }, ao: { dist: 0.022, str: 0.6 }, grad: { top: 0.15, bottom: 0.25, y0: 0, y1: 0.3, low: 0.15 } };
  },
  rig: pipRig, sculpt: pipSculpt, paint: pipPaint,
  parts(acc, S, R, cfg) {
    pipParts(acc, S, R, { ...cfg, variant: 'child' });
    // a little scarf with a knot and a tail (pet marker)
    const b = (n) => R.index(n), sc = col(cfg.pal.scarf);
    const ring = new THREE.TorusGeometry(0.17, 0.028, 5, 18);
    acc.add(ring, { matrix: new THREE.Matrix4().makeRotationX(Math.PI / 2 + 0.1).setPosition(0, 0.285, -0.005), skin: rigid(b('chest')), color: sc, dtl: [0, 0, 0.2, 0.6] });
    acc.add(sweep([[0.08, 0.29, -0.15], [0.12, 0.24, -0.17], [0.13, 0.18, -0.16]], [0.03, 0.028, 0.02], { radial: 5, flat: 0.5 }), { skin: rigid(b('chest')), color: sc, dtl: [0, 0, 0.2, 0.6] });
  },
  sockets: PIP_SOCKETS,
  height: 0.62, radius: 0.24,
  controller(inst) { return new BipedCtl(inst, PET_SPEC); },
  get actionList() { return PET_ACTIONS; },
};
const PET_ACTIONS = { ...PIP_ACTIONS, happy: PIP_ACTIONS.spin };
const PET_SPEC = { ...PIP_SPEC, actions: PET_ACTIONS, fidgets: [{ name: 'hop', w: 4 }, { name: 'idle_alt', w: 2 }, { name: 'spin', w: 1 }, { name: 'cheer', w: 1 }], fidgetGap: 2.4 };

// ------------------------------------------------------------------------------------------------ pip_seed (collectible)
const SEED_PAL = {
  gold: { pod: 0x8a5a2a, pod2: 0xc89048, inner: 0xfff0b0, sprout: 0x7aff5a, glow: 0xffe070, mote: 0xfff4a0 },
  jade: { pod: 0x3a6a3a, pod2: 0x6aa05a, inner: 0xe0ffd0, sprout: 0x8affc0, glow: 0x8affc8, mote: 0xd0fff0 },
  rose: { pod: 0x7a3a4a, pod2: 0xb86a7a, inner: 0xffe0f0, sprout: 0xa8ff7a, glow: 0xff9ad8, mote: 0xffd8f0 },
};
export const pip_seed = {
  name: 'Pip Seed',
  variants: ['gold', 'jade', 'rose'],
  config(variant) { const v = SEED_PAL[variant] ? variant : 'gold'; return { variant: v, pal: SEED_PAL[v], h: 0.012, mat: { dfreq: 8, rim: 0.6, rimColor: 0xfff0c0, spec: 0.3, shine: 30 }, castShadow: true }; },
  rig(R) { R.add('base', null, [0, 0.0, 0]); R.add('float', 'base', [0, 0.32, 0]); R.add('sprout', 'float', [0, 0.36, 0]); R.add('motes', 'float', [0, 0.32, 0]); },
  sculpt(S, cfg) {
    const c = cfg.pal;
    // split seed pod: an egg with a big notch carved out of the front-top, revealing a glowing kernel
    S.ell('float', [0, 0.3, 0], [0.085, 0.1, 0.085], { k: 0.02, col: c.pod, tag: 'pod', dtl: [0, 0.2, 0.25, 0.3] });
    S.ell('float', [0, 0.38, -0.04], [0.07, 0.07, 0.08], { k: 0.015, sub: true, col: c.inner, tag: 'split' });
    S.sph('float', [0, 0.33, -0.01], 0.055, { k: 0.01, col: c.inner, tag: 'kernel', emis: 1.4, dtl: [0, 0, 0, 0] });
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, y, z] = v.p;
    if (v.t('pod') > 0.4) { v.mix(c.pod2, sstep(0.85, 0.97, Math.abs(Math.sin(Math.atan2(x, z) * 6))) * 0.7); v.mix(c.pod2, sstep(0.3, 0.9, v.n[1]) * 0.4); }
    if (v.t('split') > 0.3 || v.t('kernel') > 0.5) { v.mix(c.inner, 1); v.emis = Math.max(v.emis, 1.6); }
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n);
    // baby sprout rising from the kernel: stem + two round leaves, gently glowing
    acc.add(sweep(bez([0, 0.34, -0.01], [0, 0.38, -0.01], [0.004, 0.42, 0.0], 4), taper(4, 0.008, 0.006), { radial: 5 }), { skin: rigid(b('sprout')), color: c.sprout, emis: 0.8, dtl: [0, 0, 0, 0] });
    for (const s of [-1, 1]) {
      const g = leafGeo(0.028, 0.055, 0.006, 0.4, 0.2, { nu: 5, nv: 4, pw: 0.6 });
      acc.add(g, { matrix: new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.1, 0, -s * 1.1, 'YXZ')).setPosition(0.004, 0.418, 0.0), skin: rigid(b('sprout')), color: c.sprout, emis: 1.0, dtl: [0, 0, 0, 0] });
    }
    // halo of motes
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; orb(acc, [Math.cos(a) * 0.14, 0.32 + Math.sin(a * 2) * 0.03, Math.sin(a) * 0.14], 0.009, rigid(b('motes')), c.mote, 3.5, 0); }
    // soft ground glow disc under it (fake bounce light)
    const disc = new THREE.CircleGeometry(0.16, 16); disc.rotateX(-Math.PI / 2);
    acc.add(disc, { matrix: new THREE.Matrix4().makeTranslation(0, 0.005, 0), skin: rigid(b('base')), color: c.glow, emis: 0.9, dtl: [0, 0, 0, 0] });
  },
  sockets: { head: ['sprout', [0, 0.46, 0]], mouth: ['float', [0, 0.33, -0.06]], center: ['float', [0, 0.32, 0]], back: ['float', [0, 0.36, 0.05]] },
  height: 0.46, radius: 0.15,
  controller(inst) { return new SeedCtl(inst, SEED_SPEC); },
  get actionList() { return SEED_ACTIONS; },
};
const SEED_ACTIONS = {
  collect: { dur: 0.9, hold: true, excl: true, state: true, fadeIn: 0.01, fn(ctl, a, w) { // pop: jump up, spin, flash, shrink away
    const P = ctl.pose, b = ctl.b, k = a.k;
    P.move(b.float, 0, 0.35 * ease(clamp01(k / 0.6)) * w, 0);
    P.ry(b.float, 8 * ease(k) * w);
    const s = k < 0.35 ? 1 + 0.5 * sstep(0, 0.35, k) : Math.max(0.001, 1.5 * (1 - sstep(0.4, 1, k)));
    P.sc[b.float].setScalar(mix(1, s, w)); P.sc[b.sprout].setScalar(mix(1, s, w)); P.sc[b.motes].setScalar(mix(1, s * 1.6, w)); P.sc[b.base].setScalar(mix(1, 1 - sstep(0, 0.4, k), w) || 0.001);
    ctl.glow = mix(ctl.glow, 1 + 3 * bell(clamp01(k / 0.5)), w);
  } },
  spawn: { dur: 1.0, a: 0.001, d: 0.9, state: true, excl: true, fn(ctl, a, w) { // grow in with a little bounce
    const P = ctl.pose, b = ctl.b, k = a.k;
    const s = k < 0.7 ? ease(k / 0.7) * 1.15 : 1.15 - 0.15 * ease((k - 0.7) / 0.3);
    for (const bn of [b.float, b.sprout, b.motes, b.base]) P.sc[bn].setScalar(Math.max(0.001, mix(1, s, w)));
  } },
  hit: { dur: 0.4, fn(ctl, a, w) { ctl.pose.rot(ctl.b.float, 0, 0, 0.3 * Math.sin(a.k * Math.PI * 3) * w); } },
};
const SEED_SPEC = { bones: { base: 'base', float: 'float', sprout: 'sprout', motes: 'motes' }, actions: SEED_ACTIONS };
class SeedCtl extends BaseCtl {
  constructor(inst, spec) { super(inst, spec); this.gait = null; this.phase = Math.random() * TAU; }
  update(dt, state = {}) {
    dt = Math.min(dt, 0.1);
    const P = this.pose, b = this.b;
    this.t += dt;
    this._state(state, dt);
    P.reset();
    const t = this.t + this.phase;
    P.move(b.float, 0, Math.sin(t * 2.0) * 0.035, 0);
    P.rot(b.float, 0.08 * Math.sin(t * 1.3), t * 0.9, 0.06 * Math.sin(t * 1.7));
    P.rot(b.sprout, 0.15 * Math.sin(t * 2.6), 0, 0.12 * Math.sin(t * 2.1));
    P.ry(b.motes, t * 1.6);
    P.sc[b.base].setScalar(1 - 0.12 * Math.sin(t * 2.0));
    this.glow = 1 + 0.35 * Math.sin(t * 3.1) * Math.sin(t * 1.7);
    this.acts.apply();
    P.fk(); P.apply(this.inst.bones);
    this._uniforms();
  }
}
