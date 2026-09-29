// Gorrath, the Horned Tyrant — Legion Commander (flagship boss). Original design.
// ~7 m minotaur demon lord: bison-humped oxblood hide split by molten fissures, shaggy black mane, bull head with
// burning eyes and a gold nose-ring, colossal ringed horns (breakable, rune-banded), layered spiked pauldrons,
// bronze-studded bracers, skull-buckled war belt, tattered crimson war-cape, cloven hooves and a double-bitted
// greataxe with molten edges (a separate object: it can be thrown like a boomerang and caught, or dropped on death).
// Sculpted in units (≈2 tall); scale 3.5 → metres.
import * as THREE from 'three';
import { sweep, rigid, bez, leafGeo, blend2, taper } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addEye, lerp3 } from '../../kit/parts.js';
import { clamp01, mix, sstep, TAU } from '../../kit/rig.js';
import { BossAcc } from './acc.js';
import { bipedCarriage } from './boss.js';

const C = {
  skin: 0x2f1d19, skinD: 0x180d0b, skinL: 0x4a2c24, fur: 0x1f1410, furL: 0x3a2619, hoof: 0x141010,
  iron: 0x2f2c30, ironD: 0x19171a, ironL: 0x4d4850, bronze: 0x8e6431, gold: 0xc79a3a, leather: 0x3b2418, leatherD: 0x24150e,
  cape: 0x6a1111, capeD: 0x2c0808, capeTrim: 0xb08a3a, hornB: 0x2c2420, hornM: 0x9c8c74, hornT: 0xece0c6,
  glow: 0xff8424, eye: 0xffc84a, nose: 0x241412, mouth: 0x3a0c0a, tooth: 0xe8dcc0, claw: 0x121010, bone: 0x8e8068,
};
const DT = { skin: [0.04, 0.22, 0.3, 0], fur: [0.6, 0, 0.12, 0], metal: [0, 0.02, 0.32, 0.06], cloth: [0.05, 0, 0.25, 0.5], leather: [0, 0.08, 0.3, 0.3], horn: [0.3, 0, 0.2, 0.25], hoof: [0.1, 0, 0.25, 0.3] };

// axe: grip / haft frame at the rest pose of the right fist (units, model space)
const GRIP = [0.87, 0.905, -0.035], H0 = [0, 0, -1], B0 = [0, 1, 0];
const GRIP2 = [0.87, 0.905, 0.205];          // left-hand grip, toward the pommel (+Z at rest)
const GRIPL = [-0.87, 0.905, -0.035];        // left fist grip point at rest (mirror of the right)
const AX = (d) => [GRIP[0], GRIP[1], GRIP[2] - d]; // point along the haft (d > 0 toward the head)

const S3 = 3.5;
const _q0 = new THREE.Quaternion(), _e0 = new THREE.Euler();
const HEAD = [0, 1.8, -0.15], HS = 1.2;           // head pivot + head sculpt scale
const HPt = (x, y, z) => [HEAD[0] + HS * x, HEAD[1] + HS * y, HEAD[2] + HS * z];
const n3 = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
/** aim helper for keys: haft direction + blade (edge) direction */
const aim = (h, b) => { const H = n3(...h); let B = b; const d = B[0] * H[0] + B[1] * H[1] + B[2] * H[2]; B = n3(B[0] - H[0] * d, B[1] - H[1] * d, B[2] - H[2] * d); return [...H, ...B]; };

export const gorrath = {
  meta: { name: 'Gorrath', title: 'the Horned Tyrant', height: 7.0, radius: 2.3, walkSpeed: 2.6, runSpeed: 9 },
  scale: S3,
  h: 0.0285, hg: { 1: 0.029, 2: 0.0165, 3: 0.016, 4: 0.019 },
  ao: { dist: 0.04, str: 0.85 },
  grad: { top: 0.16, bottom: 0.34, y0: 0.0, y1: 0.7, low: 0.25 },
  mat: { glow: C.glow, glowK: 3.4, crackFreq: 8.5, crackK: 0.9, dfreq: 4.5, rim: 0.22, rimColor: 0xffd0a8, spec: 0.45, shine: 22, ghostCol: 0x6f63ff, sil: 0.38, silCol: 0x9ab0ff },
  stepFx: { n: 5, scale: 1.4 },
  particles: { add: 700, alpha: 300 },

  rig(R) {
    R.add('hips', null, [0, 0.95, 0.03]);
    R.add('spine', 'hips', [0, 1.14, 0.03]);
    R.add('chest', 'spine', [0, 1.38, 0.02]);
    R.add('neck', 'chest', [0, 1.66, -0.04]);
    R.add('head', 'neck', [0, 1.8, -0.15]);
    R.add('jaw', 'head', HPt(0, -0.07, -0.06));
    R.add('earL', 'head', HPt(-0.15, 0.04, 0.0)); R.add('earR', 'head', HPt(0.15, 0.04, 0.0));
    R.add('ring', 'head', HPt(0, -0.085, -0.39));
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('clav' + n, 'chest', [s * 0.15, 1.6, 0.0]);
      R.add('armU' + n, 'clav' + n, [s * 0.47, 1.6, 0.02]);
      R.add('armL' + n, 'armU' + n, [s * 0.69, 1.27, 0.06]);
      R.add('hand' + n, 'armL' + n, [s * 0.83, 0.97, 0.0]);
      R.add('fing' + n, 'hand' + n, [s * 0.88, 0.88, -0.04]);
      R.add('thigh' + n, 'hips', [s * 0.19, 0.93, 0.03]);
      R.add('shin' + n, 'thigh' + n, [s * 0.22, 0.56, -0.1]);
      R.add('meta' + n, 'shin' + n, [s * 0.22, 0.25, 0.1]);
      R.add('hoof' + n, 'meta' + n, [s * 0.22, 0.07, 0.03]);
    }
    R.add('tail1', 'hips', [0, 0.99, 0.2]); R.add('tail2', 'tail1', [0, 0.82, 0.3]); R.add('tail3', 'tail2', [0, 0.62, 0.35]);
    for (const [c, x] of [['L', -0.36], ['C', 0], ['R', 0.36]]) {
      const w = c === 'C' ? 1 : 1.0;
      R.add('cape' + c + '1', 'chest', [x * 0.95, 1.7, 0.3 + (c === 'C' ? 0.03 : 0)]);
      R.add('cape' + c + '2', 'cape' + c + '1', [x * 1.05 * w, 1.3, 0.4]);
      R.add('cape' + c + '3', 'cape' + c + '2', [x * 1.15 * w, 0.9, 0.46]);
      R.add('cape' + c + '4', 'cape' + c + '3', [x * 1.25 * w, 0.5, 0.5]);
    }
    R.add('loin1', 'hips', [0, 0.86, -0.22]); R.add('loin2', 'loin1', [0, 0.58, -0.25]);
  },

  sculpt(S) {
    const sk = { col: C.skin, tag: 'skin', dtl: DT.skin }, fu = { col: C.fur, tag: 'fur', dtl: DT.fur };
    const E = (bn, c, r, o) => S.ell(bn, c, r, o), K = (bn, a, c2, ra, rb, o) => S.cone(bn, a, c2, ra, rb, o), G = (bn, a, c2, rx, ry, o) => S.seg(bn, a, c2, rx, ry, o);
    // ---------------- torso: barrel chest, V-taper, broad pecs, traps rising into a bison hump
    E('hips', [0, 0.975, 0.04], [0.25, 0.16, 0.19], { k: 0.09, ...sk });
    G('hips', [-0.13, 0.95, 0.1], [0.13, 0.95, 0.1], 0.12, 0.13, { k: 0.08, ...sk, zs: 1.3 });              // glutes (one mass)
    E('spine', [0, 1.14, -0.0], [0.23, 0.2, 0.19], { k: 0.12, ...sk });
    E('spine', [0, 1.12, -0.12], [0.16, 0.17, 0.09], { k: 0.08, ...sk, tag: 'abs' });                       // abdominal wall
    K('spine', [0, 1.02, -0.215], [0, 1.3, -0.235], 0.012, 0.012, { k: 0.03, sub: true, ...sk, tag: 'abs' });   // linea alba
    for (let i = 0; i < 3; i++) K('spine', [-0.13, 1.07 + i * 0.075, -0.2], [0.13, 1.07 + i * 0.075, -0.2], 0.01, 0.01, { k: 0.03, sub: true, ...sk, tag: 'abs' });
    E('chest', [0, 1.4, 0.0], [0.36, 0.27, 0.26], { k: 0.12, ...sk });
    for (const s of [-1, 1]) {
      G('chest', [s * 0.05, 1.46, -0.2], [s * 0.31, 1.54, -0.11], 0.125, 0.105, { k: 0.04, ...sk, zs: 1.1 });  // pec
      K('chest', [s * 0.02, 1.37, -0.235], [s * 0.3, 1.42, -0.17], 0.012, 0.012, { k: 0.03, sub: true, ...sk });   // under-pec line
      E('chest', [s * 0.27, 1.34, 0.09], [0.14, 0.24, 0.16], { k: 0.09, ...sk });                          // lats
      G('chest', [s * 0.06, 1.7, 0.06], [s * 0.4, 1.63, 0.03], 0.1, 0.08, { k: 0.08, ...sk });               // traps
      E('spine', [s * 0.2, 1.2, -0.09], [0.07, 0.11, 0.07], { k: 0.06, ...sk, rot: [0.1, 0, s * 0.3] });  // obliques
    }
    E('chest', [0, 1.62, 0.12], [0.3, 0.2, 0.22], { k: 0.1, ...sk });                                        // hump base
    E('chest', [0, 1.65, 0.2], [0.27, 0.17, 0.16], { k: 0.09, ...fu });                                      // mane over the hump
    E('neck', [0, 1.76, 0.05], [0.21, 0.15, 0.19], { k: 0.1, ...fu });
    E('neck', [0, 1.69, -0.1], [0.17, 0.14, 0.13], { k: 0.08, ...fu });                                      // throat ruff
    K('neck', [0, 1.6, -0.0], [0, 1.78, -0.14], 0.18, 0.15, { k: 0.08, ...sk, b2: 'head', t0: 0.6, t1: 1 });
    // ---------------- arms: long, heavy, big forearms
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      E('armU' + n, [s * 0.48, 1.61, 0.02], [0.16, 0.15, 0.16], { k: 0.09, ...sk });                       // deltoid
      K('armU' + n, [s * 0.47, 1.6, 0.02], [s * 0.69, 1.27, 0.06], 0.14, 0.11, { k: 0.06, ...sk, b2: 'armL' + n, t0: 0.82, t1: 1 });
      G('armU' + n, [s * 0.535, 1.52, -0.045], [s * 0.645, 1.36, -0.02], 0.095, 0.09, { k: 0.05, ...sk, zs: 1.15 });   // biceps
      G('armU' + n, [s * 0.555, 1.53, 0.1], [s * 0.665, 1.35, 0.11], 0.09, 0.088, { k: 0.05, ...sk, zs: 1.15 });      // triceps
      K('armL' + n, [s * 0.69, 1.27, 0.06], [s * 0.83, 0.97, 0.0], 0.112, 0.082, { k: 0.05, ...sk, b2: 'hand' + n, t0: 0.85, t1: 1 });
      G('armL' + n, [s * 0.7, 1.25, 0.03], [s * 0.78, 1.07, 0.0], 0.108, 0.095, { k: 0.05, ...sk, zs: 1.15 });        // forearm mass
    }
    // ---------------- hands (group 4)
    { // right fist wrapped around the haft (haft runs along Z through GRIP)
      const [gx, gy, gz] = GRIP;
      E('handR', [gx - 0.01, gy + 0.03, gz + 0.01], [0.08, 0.09, 0.1], { group: 4, k: 0.03, ...sk, tag: 'hand' });
      K('fingR', [gx + 0.055, gy - 0.03, gz - 0.075], [gx + 0.055, gy - 0.03, gz + 0.07], 0.042, 0.04, { group: 4, k: 0.03, ...sk, tag: 'hand' }); // curled fingers
      K('fingR', [gx + 0.02, gy - 0.07, gz - 0.07], [gx + 0.02, gy - 0.07, gz + 0.06], 0.034, 0.032, { group: 4, k: 0.03, ...sk, tag: 'hand' });
      K('handR', [gx - 0.06, gy + 0.05, gz - 0.07], [gx - 0.02, gy + 0.06, gz - 0.13], 0.034, 0.028, { group: 4, k: 0.02, ...sk, tag: 'hand' }); // thumb
    }
    { // left: open claw
      const hx = -0.875, hy = 0.89, hz = -0.03;
      E('handL', [hx, hy + 0.04, hz], [0.085, 0.105, 0.1], { group: 4, k: 0.03, ...sk, tag: 'hand' });
      for (let f = 0; f < 4; f++) {
        const z = hz - 0.07 + f * 0.046;
        K('fingL', [hx - 0.01, hy - 0.03, z], [hx - 0.035, hy - 0.135, z - 0.04], 0.036, 0.03, { group: 4, k: 0.018, ...sk, tag: 'hand' });
        K('fingL', [hx - 0.035, hy - 0.135, z - 0.04], [hx - 0.012, hy - 0.215, z - 0.075], 0.03, 0.022, { group: 4, k: 0.014, ...sk, tag: 'hand' });
      }
      K('handL', [hx + 0.05, hy + 0.02, hz - 0.07], [hx + 0.06, hy - 0.06, hz - 0.13], 0.03, 0.024, { group: 4, k: 0.016, ...sk, tag: 'hand' });
    }
    // ---------------- legs: powerful thighs, bull hocks, feathered fetlocks
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      K('thigh' + n, [s * 0.19, 0.95, 0.03], [s * 0.22, 0.56, -0.1], 0.17, 0.11, { k: 0.08, ...sk, b2: 'shin' + n, t0: 0.8, t1: 1 });
      G('thigh' + n, [s * 0.22, 0.88, -0.07], [s * 0.225, 0.63, -0.13], 0.11, 0.1, { k: 0.07, ...sk, zs: 1.2 });       // quads
      K('shin' + n, [s * 0.22, 0.56, -0.1], [s * 0.22, 0.25, 0.1], 0.1, 0.06, { k: 0.05, ...sk, b2: 'meta' + n, t0: 0.85, t1: 1 });
      G('shin' + n, [s * 0.22, 0.52, -0.03], [s * 0.22, 0.33, 0.1], 0.08, 0.08, { k: 0.06, ...sk, zs: 1.1 });         // bull calf
      K('meta' + n, [s * 0.22, 0.25, 0.1], [s * 0.22, 0.07, 0.03], 0.055, 0.048, { k: 0.03, ...sk, b2: 'hoof' + n, t0: 0.85, t1: 1 });
      E('meta' + n, [s * 0.22, 0.13, 0.055], [0.085, 0.085, 0.09], { k: 0.04, ...fu });                         // fetlock feathering
      E('shin' + n, [s * 0.22, 0.29, 0.11], [0.075, 0.07, 0.075], { k: 0.04, ...fu });
      for (const d of [-1, 1]) E('hoof' + n, [s * 0.22 + d * 0.037, 0.036, -0.025], [0.042, 0.038, 0.072], { group: 4, k: 0.012, col: C.hoof, tag: 'hoof', dtl: DT.hoof, rot: [0, d * 0.12, 0] });
      E('hoof' + n, [s * 0.22, 0.06, 0.03], [0.075, 0.035, 0.065], { group: 4, k: 0.02, col: C.hoof, tag: 'hoof', dtl: DT.hoof });
    }
    // tail
    K('tail1', [0, 0.99, 0.2], [0, 0.82, 0.3], 0.045, 0.035, { k: 0.03, ...sk, b2: 'tail2', t0: 0.6, t1: 1 });
    K('tail2', [0, 0.82, 0.3], [0, 0.62, 0.35], 0.035, 0.025, { k: 0.02, ...sk, b2: 'tail3', t0: 0.6, t1: 1 });
    E('tail3', [0, 0.52, 0.37], [0.05, 0.12, 0.05], { k: 0.03, ...fu });
    // ---------------- head (group 2) + jaw (group 3): bull skull scaled up, heavy brow, square muzzle
    const hd = { group: 2, ...sk, tag: 'head' };
    const HP = (x, y, z) => [HEAD[0] + HS * x, HEAD[1] + HS * y, HEAD[2] + HS * z];
    const HR = (r) => r.map(v => v * HS);
    E('head', HP(0, 0.055, 0.0), HR([0.14, 0.12, 0.14]), { k: 0.05, ...hd });
    E('head', HP(0, 0.12, -0.03), HR([0.18, 0.06, 0.09]), { k: 0.05, ...hd });                      // poll: horn base ridge
    for (const s of [-1, 1]) {
      E('head', HP(s * 0.088, 0.07, -0.155), HR([0.085, 0.042, 0.07]), { k: 0.03, ...hd, rot: [0.4, s * 0.25, s * 0.5] });   // heavy brow (angry V, overhangs the eyes)
      E('head', HP(s * 0.075, -0.1, -0.29), HR([0.058, 0.062, 0.1]), { k: 0.035, ...hd });                                   // jowls / flews
      E('head', HP(s * 0.1, -0.01, -0.1), HR([0.075, 0.08, 0.11]), { k: 0.05, ...hd });                                // cheeks
    }
    S.box('head', HP(0, -0.035, -0.225), HR([0.1, 0.075, 0.115]), 0.07, { k: 0.045, ...hd, rot: [0.22, 0, 0] });   // muzzle (squarer, tilted nose-down)
    S.box('head', HP(0, -0.064, -0.322), HR([0.112, 0.058, 0.034]), 0.034, { k: 0.035, ...hd, col: C.nose, tag: 'nose' });   // broad flat nose pad
    E('head', HP(0, -0.11, -0.27), HR([0.105, 0.045, 0.1]), { k: 0.04, ...hd });                      // upper lip
    for (const s of [-1, 1]) K('head', HP(s * 0.02, -0.13, -0.35), HP(s * 0.11, -0.125, -0.17), 0.009 * HS, 0.007 * HS, { group: 2, k: 0.012, sub: true, col: C.mouth, tag: 'mouth' });  // mouth line
    K('neck', [0, 1.7, -0.02], HP(0, 0.0, 0.02), 0.15, 0.14, { group: 2, k: 0.06, ...sk, b2: 'head', t0: 0.3, t1: 0.9 });
    for (const s of [-1, 1]) {
      E('head', HP(s * 0.07, -0.086, -0.355), HR([0.03, 0.012, 0.022]), { group: 2, k: 0.008, sub: true, col: 0x0a0404, tag: 'nostril', rot: [0.2, s * 0.45, -s * 0.45] });   // flared slit nostrils
      E('head', HP(s * 0.1, 0.045, -0.17), HR([0.045, 0.02, 0.035]), { group: 2, k: 0.016, sub: true, col: 0x100404, tag: 'socket', rot: [0, 0, s * 0.35] });
    }
    E('head', HP(0, -0.14, -0.22), HR([0.085, 0.03, 0.13]), { group: 2, k: 0.02, sub: true, col: C.mouth, tag: 'mouth' });
    const jw = { group: 3, ...sk, tag: 'jaw' };
    E('jaw', HP(0, -0.145, -0.19), HR([0.092, 0.045, 0.13]), { k: 0.04, ...jw });
    E('jaw', HP(0, -0.155, -0.29), HR([0.06, 0.04, 0.05]), { k: 0.03, ...jw });
    for (const s of [-1, 1]) E('jaw', HP(s * 0.085, -0.1, -0.06), HR([0.04, 0.06, 0.06]), { k: 0.03, ...jw });
    E('jaw', HP(0, -0.12, -0.21), HR([0.07, 0.02, 0.11]), { group: 3, k: 0.015, sub: true, col: C.mouth, tag: 'mouth' });
    K('jaw', HP(0, -0.17, -0.23), HP(0, -0.33, -0.2), 0.055 * HS, 0.012 * HS, { group: 3, k: 0.04, ...fu });          // braided beard under the chin
    for (let i = 0; i < 3; i++) K('jaw', HP(-0.06, -0.21 - i * 0.035, -0.235 + i * 0.012), HP(0.06, -0.21 - i * 0.035, -0.235 + i * 0.012), 0.006 * HS, 0.006 * HS, { group: 3, k: 0.01, sub: true, ...fu });
    // ---------------- armour (group 1): tiered angular pauldrons, bracers, knee plates, tassets, belt
    const ar = { group: 1, col: C.iron, tag: 'metal', dtl: DT.metal };
    const cut = (y0) => (x, y, z, d) => Math.max(d, y0 - y);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      // three curved lames (hollow ellipsoid shells) stacked down the shoulder, bronze rims, raised ridge + boss
      const shell = (t, y0) => (x, y, z, d) => Math.max(d, y0 - y);   // solid cap (the inside is body anyway)
      E('clav' + n, [s * 0.47, 1.64, 0.03], [0.28, 0.16, 0.28], { ...ar, k: 0.006, rot: [0, 0, s * 0.28], mod: shell(0.02, 1.705), tag: 'pauldron' });
      E('armU' + n, [s * 0.555, 1.565, 0.035], [0.27, 0.15, 0.27], { ...ar, k: 0.006, rot: [0, 0, s * 0.45], mod: shell(0.019, 1.615), tag: 'pauldron' });
      E('armU' + n, [s * 0.625, 1.485, 0.04], [0.24, 0.135, 0.245], { ...ar, k: 0.006, rot: [0, 0, s * 0.62], mod: shell(0.018, 1.53), tag: 'pauldron' });
      K('clav' + n, [s * 0.3, 1.8, 0.03], [s * 0.66, 1.66, 0.03], 0.035, 0.022, { ...ar, k: 0.02, tag: 'pauldron' });   // ridge
      E('clav' + n, [s * 0.44, 1.79, 0.03], [0.085, 0.04, 0.095], { ...ar, k: 0.02, col: C.bronze, tag: 'bronze' });   // boss
      // bracer
      K('armL' + n, [s * 0.715, 1.215, 0.045], [s * 0.815, 1.015, 0.005], 0.122, 0.1, { ...ar, k: 0.012 });
      K('armL' + n, [s * 0.708, 1.228, 0.047], [s * 0.716, 1.212, 0.044], 0.132, 0.13, { ...ar, k: 0.01, col: C.bronze, tag: 'bronze' });
      K('armL' + n, [s * 0.812, 1.022, 0.007], [s * 0.82, 1.006, 0.004], 0.11, 0.108, { ...ar, k: 0.01, col: C.bronze, tag: 'bronze' });
      // knee plate (angular)
      S.box('shin' + n, [s * 0.222, 0.58, -0.17], [0.085, 0.09, 0.03], 0.025, { ...ar, k: 0.015, rot: [0.35, 0, 0] });
      // war skirt: overlapping iron plates hanging from the belt over the hips/thighs (follow the thighs)
      S.box('thigh' + n, [s * 0.27, 0.85, -0.06], [0.1, 0.13, 0.012], 0.012, { ...ar, k: 0.006, rot: [0.15, s * 0.85, s * 0.18], tag: 'plate' });
      S.box('thigh' + n, [s * 0.27, 0.85, 0.12], [0.1, 0.13, 0.012], 0.012, { ...ar, k: 0.006, rot: [-0.15, -s * 0.75, s * 0.18], tag: 'plate' });
      S.box('hips', [s * 0.12, 0.84, 0.2], [0.09, 0.12, 0.012], 0.012, { ...ar, k: 0.006, rot: [-0.25, 0, 0], tag: 'plate' });
    }
    E('hips', [0, 1.0, 0.03], [0.275, 0.07, 0.215], { group: 1, k: 0.02, col: C.leather, tag: 'leather', dtl: DT.leather });   // war belt
    S.box('hips', [0, 0.93, -0.18], [0.12, 0.09, 0.03], 0.025, { ...ar, k: 0.015, rot: [-0.15, 0, 0] });                    // codpiece plate
  },

  paint(v, X) {
    const [x, y, z] = v.p, ny = v.n[1];
    const skin = v.t('skin') + v.t('head') + v.t('jaw') + v.t('abs') + v.t('hand');
    const fur = v.t('fur'), metal = v.t('metal') + v.t('pauldron'), bronze = v.t('bronze'), hoof = v.t('hoof');
    // skin: darker extremities and recesses, warmer muscle tops, charcoal belly scars
    if (skin > 0.2) {
      const ext = sstep(0.75, 0.3, y) * 0.5 + sstep(0.7, 0.9, Math.abs(x)) * 0.4;
      v.mix(C.skinD, ext * skin);
      v.mix(C.skinL, sstep(0.2, 0.9, ny) * 0.3 * skin * sstep(0.9, 1.3, y));
      v.mul(1 + Math.sin(x * 23 + z * 17) * Math.sin(y * 19 + x * 7) * 0.06);
      X[0] = 0.015;
      // molten fissures: chest, abs, arms, thighs, back; fading toward the face/hands
      let cr = 0.5;
      if (y > 1.74) cr = 0.22 * sstep(-0.36, -0.46, -z) * sstep(2.1, 1.95, y);   // head: none on the face front / brow
      if (v.group === 4) cr = 0.15;              // hands / hooves
      if (y < 0.35) cr *= 0.4;
      X[2] = cr * Math.min(1, skin);
    }
    if (v.t('nose') > 0.4) { X[0] = 0.12; X[2] = 0; }
    if (v.t('mouth') > 0.3 || v.t('nostril') > 0.3) { v.mix(C.mouth, 0.8); X[2] = 0; X[0] = 0.4; }
    if (v.t('socket') > 0.3) { v.mix(0x3a0802, 0.8); v.emis = 1.4; X[3] = 1; X[2] = 0; }
    if (fur > 0.3) {
      v.mix(C.furL, sstep(0.3, 1, ny) * 0.35 * fur);
      X[0] = 0; X[2] = 0;
    }
    const plate = v.t('plate');
    if (plate > 0.3) { X[0] = 0.3; X[2] = 0; v.mix(C.bronze, sstep(-0.3, -0.7, ny) * 0.9); v.mix(C.ironL, sstep(0.3, 0.9, ny) * 0.2); }
    if (metal > 0.3) {
      // hammered iron: bright bevel near plate edges (normal facing down/out), bronze trim at the lower rim
      X[0] = 0.32; X[2] = 0;
      v.mix(C.ironL, sstep(0.2, 0.9, ny) * 0.25);
      if (v.t('pauldron') > 0.3) { v.mix(C.bronze, sstep(-0.3, -0.7, ny) * 0.95); if (ny < -0.5) X[0] = 0.5; }
    }
    if (bronze > 0.3) { X[0] = 0.55; X[2] = 0; }
    if (v.t('leather') > 0.3) { X[0] = 0.08; X[2] = 0; }
    if (hoof > 0.3) { X[0] = 0.15; X[2] = 0; v.mix(0x3a3230, sstep(0.05, 0.0, y) * 0.3); }
  },

  parts(acc, S, R, out) {
    const b = (n) => R.index(n);
    const X = acc.X;
    const skinAt = (p) => { const s = S.sampleAt(p[0], p[1], p[2]); return { si: s.si, sw: s.sw }; };
    // ---------------- eyes: burning slits deep under the brow (hot white core → orange rim)
    for (const s of [-1, 1]) {
      const c = HPt(s * 0.1, 0.043, -0.165);
      const eg = new THREE.SphereGeometry(0.026, 10, 6);
      const m = new THREE.Matrix4().compose(new THREE.Vector3(...c), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s * 0.35, s * 0.35, 'YXZ')), new THREE.Vector3(1.35, 0.38, 0.7));
      const hot = col(0xffd070), rim = col(0xff4a08);
      acc.add(eg, { matrix: m, skin: rigid(b('head')), dtl: [0, 0, 0, 0], color: (p, n) => lerp3(rim, hot, sstep(0.3, 0.95, -n.z * 0.8 + 0.2)), emis: 3.6, ext: [0, 0, 0, 1] });
    }
    // ---------------- horns (ringed, sweeping out → forward → up); stump stays, the rest breaks off
    const hornPath = (s) => bez(HPt(s * 0.12, 0.12, -0.03), [s * 0.56, 1.99, -0.07], [s * 0.8, 2.26, -0.46], 22);
    const cHB = col(C.hornB), cHM = col(C.hornM), cHT = col(C.hornT), glowC = col(0xff7a2a);
    for (const s of [-1, 1]) {
      const pts = hornPath(s);
      const N = pts.length;
      const radii = pts.map((p, i) => { const u = i / (N - 1); return (0.078 * (1 - u) ** 0.9 + 0.006) * (1 + 0.1 * Math.sin(u * 60) * (1 - u) ** 2); });
      const split = 6;
      const partId = s < 0 ? 1 : 2;
      const hb = rigid(b('head'));
      // stump (with jagged break rim) and the breakable horn
      const g1 = sweep(pts.slice(0, split + 1), radii.slice(0, split + 1), { radial: 12, capStart: true, capEnd: true });
      const g2 = sweep(pts.slice(split), radii.slice(split), { radial: 12 });
      const hornCol = (u) => (u < 0.35 ? lerp3(cHB, cHM, u / 0.35) : lerp3(cHM, cHT, (u - 0.35) / 0.65));
      acc.add(g1, { skin: hb, dtl: DT.horn, color: (p, n, uv) => lerp3(hornCol(uv[1] * split / (N - 1)), col(0x6a5040), uv[1] > 0.97 ? 0.6 : 0), ext: [0.25, 0, 0, 0] });
      acc.add(g2, {
        skin: hb, dtl: DT.horn,
        color: (p, n, uv) => { const u = (split + uv[1] * (N - 1 - split)) / (N - 1); const ring = Math.abs(u - 0.42) < 0.018 || Math.abs(u - 0.52) < 0.012 || Math.abs(u - 0.61) < 0.009; return ring ? glowC : hornCol(u); },
        emis: (p, uv) => { const u = (split + uv[1] * (N - 1 - split)) / (N - 1); return (Math.abs(u - 0.42) < 0.018 || Math.abs(u - 0.52) < 0.012 || Math.abs(u - 0.61) < 0.009) ? 2.6 : 0; },
        ext: (p, uv) => { const u = (split + uv[1] * (N - 1 - split)) / (N - 1); const ring = Math.abs(u - 0.42) < 0.018 || Math.abs(u - 0.52) < 0.012 || Math.abs(u - 0.61) < 0.009; return [0.3, partId, 0, ring ? 4 : 0]; },
      });
      // bronze horn ring at the stump
      const ringG = new THREE.TorusGeometry(radii[split - 2] * 1.02, 0.013, 6, 18);
      const p0 = pts[split - 2], p1 = pts[split - 1];
      const dir = new THREE.Vector3().subVectors(p1, p0).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      acc.add(ringG, { matrix: new THREE.Matrix4().compose(p0, q, new THREE.Vector3(1, 1, 1)), skin: hb, color: C.bronze, dtl: DT.metal, ext: [1, 0, 0, 0] });
    }
    // ---------------- ears (below the horns, drooping out)
    for (const s of [-1, 1]) {
      const g = leafGeo(0.05, 0.12, 0.016, 0.8, 0.08, { nu: 6, nv: 5, pw: 0.6 });
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.2, 0, s * -1.9, 'YXZ')); m.setPosition(...HPt(s * 0.15, 0.04, 0.0));
      const outer = col(C.skin), inner = col(0x6a2a22);
      acc.add(g, { matrix: m, skin: rigid(b(s < 0 ? 'earL' : 'earR')), dtl: DT.skin, color: (p, n, uv) => (uv[0] >= 1 ? outer : inner), ext: [0.1, 0, 0, 0] });
    }
    // ---------------- teeth / tusks
    for (const s of [-1, 1]) {
      acc.add(sweep(bez(HPt(s * 0.08, -0.145, -0.26), HPt(s * 0.15, -0.075, -0.31), HPt(s * 0.19, 0.015, -0.265), 7), taper(7, 0.03, 0.004, 0.8), { radial: 8 }), { skin: rigid(b('jaw')), color: (p, n, uv) => lerp3(col(0x8a7458), col(C.tooth), uv[1]), dtl: [0, 0, 0.1, 0], ext: [0.12, 0, 0, 0] });
      for (let i = 0; i < 3; i++) acc.add(sweep([HPt(s * (0.035 + i * 0.022), -0.13, -0.3 + i * 0.025), HPt(s * (0.035 + i * 0.022), -0.155, -0.302 + i * 0.025)], [0.01, 0.001], { radial: 4 }), { skin: rigid(b('head')), color: C.tooth, dtl: [0, 0, 0.1, 0] });
    }
    // ---------------- nose ring (gold) through the septum
    {
      const g = new THREE.TorusGeometry(0.058, 0.013, 7, 20);
      acc.add(g, { matrix: new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(...HPt(0, -0.125, -0.395)), skin: rigid(b('ring')), color: C.gold, dtl: DT.metal, ext: [0.6, 0, 0, 0] });
    }
    // ---------------- iron chanfron: a war plate down the brow and nose bridge, angry brow wings over the eyes
    {
      const hb = rigid(b('head'));
      const nrm = [0, 0, 0];
      const surf = (x, y) => {                  // HP front-view (x, y) → head surface point + normal (ray along +Z)
        const p = HPt(x, y, -0.62);
        for (let k = 0; k < 64; k++) { const d = S.sdf(p[0], p[1], p[2], 2); if (d < 0.0008) break; p[2] += Math.max(0.002, d * 0.85); }
        S.normal(p[0], p[1], p[2], nrm, 2);
        return { p, n: nrm.slice() };
      };
      const cI2 = col(0x3e3a3d), cE = col(0x161416), cB2 = col(C.bronze);
      const strip = (fn, nu, nv, thick, keel = 0) => {
        const P = [], UV = [], I = [], NS = [], ED = [];
        for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
          const u = i / (nu - 1) * 2 - 1, v = j / (nv - 1);
          const [x, y] = fn(u, v);
          const { p, n } = surf(x, y);
          const edge = i === 0 || i === nu - 1 || j === 0 || j === nv - 1;
          const off = edge ? 0.004 : thick * (1 - Math.abs(u) ** 6) + keel * (1 - Math.abs(u)) ** 2;
          P.push(p[0] + n[0] * off, p[1] + n[1] * off, p[2] + n[2] * off); UV.push((u + 1) / 2, v); NS.push(n); ED.push(edge);
        }
        // wind the quads so they face out along the surface normal
        const mid = surf(...fn(0, 0.5)).n, q = (k) => new THREE.Vector3(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]);
        const i0 = Math.floor(nu / 2) - 1 + Math.floor(nv / 2) * nu, fnrm = new THREE.Vector3().subVectors(q(i0 + nu), q(i0)).cross(new THREE.Vector3().subVectors(q(i0 + 1), q(i0)));
        const flip = fnrm.x * mid[0] + fnrm.y * mid[1] + fnrm.z * mid[2] < 0;
        for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) { const a = j * nu + i; if (flip) I.push(a, a + 1, a + nu, a + 1, a + nu + 1, a + nu); else I.push(a, a + nu, a + 1, a + 1, a + nu, a + nu + 1); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
        { // smooth the plate face with the head's own normals; keep the geometric bevel at the rim
          const na = g.attributes.normal;
          for (let k = 0; k < na.count; k++) { if (ED[k]) continue; const n = NS[k]; const x = n[0] * 0.75 + na.getX(k) * 0.25, y = n[1] * 0.75 + na.getY(k) * 0.25, z = n[2] * 0.75 + na.getZ(k) * 0.25, l = Math.hypot(x, y, z); na.setXYZ(k, x / l, y / l, z / l); }
        }
        acc.add(g, { skin: hb, dtl: DT.metal, color: (pp, nn, uv) => { const e = Math.min(uv[0], 1 - uv[0], uv[1], 1 - uv[1]); return e < 0.02 ? cE : lerp3(cI2, cB2, sstep(0.3, 0.9, nn.y) * 0.25); }, ext: [0.5, 0, 0, 0] });
        return P;
      };
      // bridge: pointed arch between the horn roots → tapering down the nose
      strip((u, v) => { const w = mix(0.07, 0.04, v) * Math.min(1, 0.3 + v * 4.5); return [u * w, mix(0.125, -0.025, v) - (1 - v) * 0.03 * Math.abs(u)]; }, 7, 12, 0.026, 0.014);
      // brow wings (inner end low, outer end high)
      for (const s of [-1, 1]) {
        const a = [s * 0.02, 0.05], c = [s * 0.16, 0.108];
        const d = n3(c[0] - a[0], c[1] - a[1], 0), pn = [-d[1] * s, d[0] * s];
        strip((u, v) => { const hw = mix(0.034, 0.012, v); const x = mix(a[0], c[0], v), y = mix(a[1], c[1], v) + 0.01 * Math.sin(v * Math.PI); return [x + pn[0] * u * hw * s, y + pn[1] * u * hw * s]; }, 5, 8, 0.026);
      }
      // rivets: along the bridge + wing tips
      const rv = (x, y) => { const { p, n } = surf(x, y); acc.add(new THREE.SphereGeometry(0.012, 6, 3), { matrix: new THREE.Matrix4().setPosition(p[0] + n[0] * 0.03, p[1] + n[1] * 0.03, p[2] + n[2] * 0.03), skin: hb, color: C.bronze, dtl: DT.metal, ext: [0.7, 0, 0, 0] }); };
      for (const y of [0.098, 0.02]) rv(0, y);
      for (const s of [-1, 1]) rv(s * 0.12, 0.094);
    }
    // ---------------- mane spikes (shaggy silhouette) + goatee
    const cF = col(C.fur), cFL = col(C.furL);
    const tuft = (p, d, L, r, g = 0) => {
      const { p: q } = S.project(p.slice(), g, 3);
      const D = new THREE.Vector3(...d).normalize();
      const a = new THREE.Vector3(...q).addScaledVector(D, -r * 1.2);
      const m = a.clone().addScaledVector(D, L * 0.55).add(new THREE.Vector3(0, -L * 0.08, 0));
      const t = a.clone().addScaledVector(D, L).add(new THREE.Vector3(0, -L * 0.22, 0));
      acc.add(sweep([a, m, t], [r, r * 0.55, r * 0.05], { radial: 4 }), { skin: skinAt(q), dtl: DT.fur, color: (pp, n, uv) => lerp3(cF, cFL, uv[1] * 0.8), ext: [0, 0, 0, 0] });
    };
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 64; i++) {
      const a = (rnd() - 0.5) * 2.6, yy = 1.6 + rnd() * 0.3;
      const p = [Math.sin(a) * 0.23, yy, 0.02 + Math.cos(a) * 0.2];
      tuft(p, [Math.sin(a) * 0.55, 0.1 + rnd() * 0.25 - (yy - 1.6) * 0.3, 0.9], 0.1 + rnd() * 0.1, 0.02 + rnd() * 0.012);
    }
    for (let i = 0; i < 18; i++) { // shaggy poll between the horns, behind the chanfron
      const x = (rnd() - 0.5) * 0.2;
      tuft(HPt(x, 0.165, -0.02 + rnd() * 0.07), [x * 2.5, 0.5 + rnd() * 0.4, -0.6], 0.06 + rnd() * 0.05, 0.017, 2);
    }
    // ---------------- pauldron rivets along the lame rims
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      for (const [bone, cy, cx, y0, rx, rz] of [['clav' + n, 1.64, 0.47, 1.715, 0.26, 0.26], ['armU' + n, 1.565, 0.555, 1.625, 0.25, 0.25], ['armU' + n, 1.485, 0.625, 1.54, 0.22, 0.225]]) {
        for (let k = 0; k < 6; k++) {
          const a = -1.15 + k * 0.46;
          const p0 = [s * (cx + Math.sin(a) * rx * 0.55), y0 - 0.004, 0.035 - Math.cos(a) * rz * 0.9];
          const pr = S.project(p0.slice(), 1, 3).p;
          acc.add(new THREE.SphereGeometry(0.013, 5, 3), { matrix: new THREE.Matrix4().setPosition(pr[0], pr[1], pr[2]), skin: rigid(b(bone)), color: C.bronze, dtl: DT.metal, ext: [0.6, 0, 0, 0] });
        }
      }
    }
    // ---------------- pauldron spikes (iron, glowing tips) + bracer studs
    const cI = col(C.iron), cIL = col(C.ironL), cG = col(0xff8a3a);
    const spike = (bone, p, d, L, r, glowTip = true) => {
      const D = new THREE.Vector3(...d).normalize();
      const a = new THREE.Vector3(...p), m = a.clone().addScaledVector(D, L * 0.5), t = a.clone().addScaledVector(D, L);
      acc.add(sweep([a, m, t], [r, r * 0.55, r * 0.04], { radial: 7, capStart: true }), {
        skin: typeof bone === 'string' ? rigid(b(bone)) : bone, dtl: DT.metal,
        color: (pp, n, uv) => (glowTip && uv[1] > 0.8 ? cG : lerp3(cI, cIL, uv[1] * 0.6)),
        emis: (pp, uv) => (glowTip && uv[1] > 0.8 ? 2.2 : 0), ext: (pp, uv) => [0.9, 0, 0, glowTip && uv[1] > 0.8 ? 4 : 0],
      });
    };
    const cspike = (bone, a, m, t, r) => {
      const pts = bez(a, m, t, 8);
      acc.add(sweep(pts, taper(8, r, r * 0.04, 1.1), { radial: 8, capStart: true }), {
        skin: rigid(b(bone)), dtl: DT.metal,
        color: (pp, nn, uv) => (uv[1] > 0.89 ? cG : lerp3(cI, cIL, uv[1] * 0.7)),
        emis: (pp, uv) => (uv[1] > 0.89 ? 1.6 : 0), ext: (pp, uv) => [0.9, 0, 0, uv[1] > 0.89 ? 4 : 0],
      });
    };
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      cspike('clav' + n, [s * 0.5, 1.82, -0.02], [s * 0.66, 2.0, 0.05], [s * 0.66, 2.2, 0.2], 0.06);
      cspike('clav' + n, [s * 0.66, 1.75, 0.06], [s * 0.86, 1.86, 0.12], [s * 0.95, 2.0, 0.28], 0.048);
      cspike('clav' + n, [s * 0.37, 1.83, 0.1], [s * 0.42, 1.98, 0.2], [s * 0.4, 2.08, 0.34], 0.04);
      for (let i = 0; i < 3; i++) spike('armL' + n, [s * (0.79 - i * 0.035), 1.07 + i * 0.07, 0.07], [s * 0.5, 0.2, 0.85], 0.07, 0.022, false);
      spike('shin' + n, [s * 0.222, 0.59, -0.22], [0, 0.35, -1], 0.09, 0.03, false);
    }
    // ---------------- belt: skull buckle with glowing sockets, bronze studs
    {
      const hb = rigid(b('hips'));
      const cB = col(C.bone);
      const skull = new THREE.SphereGeometry(0.075, 14, 10);
      acc.add(skull, { matrix: new THREE.Matrix4().makeScale(1, 0.95, 0.7).setPosition(0, 1.0, -0.245), skin: hb, color: cB, dtl: [0, 0, 0.25, 0.1], ext: [0.3, 0, 0, 0] });
      const jawG = new THREE.BoxGeometry(0.08, 0.04, 0.05);
      acc.add(jawG, { matrix: new THREE.Matrix4().setPosition(0, 0.94, -0.25), skin: hb, color: cB, dtl: [0, 0, 0.25, 0.1] });
      for (const s of [-1, 1]) {
        const sock = new THREE.SphereGeometry(0.02, 8, 6);
        acc.add(sock, { matrix: new THREE.Matrix4().setPosition(s * 0.028, 1.005, -0.29), skin: hb, color: 0xff7020, emis: 1.3, dtl: [0, 0, 0, 0], ext: [0, 0, 0, 1] });
        spike(hb, [s * 0.05, 1.05, -0.26], [s * 0.6, 1, -0.3], 0.09, 0.018, false);
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const st = new THREE.SphereGeometry(0.014, 5, 3);
        acc.add(st, { matrix: new THREE.Matrix4().setPosition(Math.sin(a) * 0.29, 1.0, 0.03 - Math.cos(a) * 0.232), skin: hb, color: 0x6a4a26, dtl: DT.metal, ext: [0.35, 0, 0, 0] });
      }
    }
    // ---------------- loincloth (front, tattered; skinned to loin1/2 springs)
    {
      const nu = 9, nv = 8, P = [], I = [], UV = [];
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const u = i / (nu - 1), v = j / (nv - 1);
        const hem = (i % 2 ? 0.07 : 0) + Math.sin(i * 2.3) * 0.025 + (Math.abs(u - 0.5) < 0.1 ? -0.04 : 0);
        const yy = 0.93 - v * (0.44 - hem * v);
        const w = 0.14 + v * 0.02;
        const fold = Math.sin(u * Math.PI * 4 + 0.5) * 0.011 * v;                     // vertical folds deepen toward the hem
        P.push((u - 0.5) * 2 * w, yy, -0.265 - v * 0.02 - Math.cos((u - 0.5) * 2.5) * 0.02 + fold); UV.push(u, v);
      }
      for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) { const a = j * nu + i; I.push(a, a + 1, a + nu, a + 1, a + nu + 1, a + nu); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
      const back = g.clone(); { const ix = back.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 1]; ix[i + 1] = t; } const pa = back.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, pa.getZ(i) + 0.012); back.computeVertexNormals(); }
      const cc = col(C.cape), cd = col(C.capeD), ct = col(C.capeTrim);
      for (const gg of [g, back]) acc.add(gg, {
        skin: (p) => { const v = clamp01((0.93 - p.y) / 0.42); return v < 0.5 ? blend2(b('hips'), b('loin1'), v * 2) : blend2(b('loin1'), b('loin2'), (v - 0.5) * 2); },
        dtl: DT.cloth, color: (p, n, uv) => (uv[1] < 0.07 ? ct : lerp3(lerp3(cc, cd, 0.35), col(0x120505), sstep(0.35, 1.0, uv[1]) * 0.9)),
        emis: (p, uv) => sstep(0.9, 1.0, uv[1]) * 0.3, ext: [0.05, 0, 0, 0],
      });
      // the Legion's horned ring, burned into the cloth
      const lp = [0, 0.93 - 0.3 * 0.44, -0.29], sk = blend2(b('hips'), b('loin1'), 0.6);
      acc.add(new THREE.TorusGeometry(0.045, 0.008, 4, 16), { matrix: new THREE.Matrix4().setPosition(lp[0], lp[1], lp[2]), skin: sk, color: 0xff6a22, emis: 1.8, dtl: [0, 0, 0, 0], ext: [0, 0, 0, 4] });
      for (const s of [-1, 1]) acc.add(sweep(bez([s * 0.035, lp[1] + 0.03, lp[2] - 0.002], [s * 0.075, lp[1] + 0.055, lp[2] - 0.002], [s * 0.065, lp[1] + 0.1, lp[2] - 0.002], 5), taper(5, 0.009, 0.0015), { radial: 3 }), { skin: sk, color: 0xff6a22, emis: 1.8, dtl: [0, 0, 0, 0], ext: [0, 0, 0, 4] });
    }
    // ---------------- war-cape (tattered), draped over the back from the pauldrons
    {
      const nu = 13, nv = 16;
      const cols = ['L', 'C', 'R'].map(c => [1, 2, 3, 4].map(k => b('cape' + c + k)));
      const pos = [], uvs = [], skins = [];
      // drape: z = max over rows above of the back surface (+ offset) so the cape hangs, doesn't hug the lower back
      const zb = new Array(nu).fill(-1e9);
      let rs = 3; const rr = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
      const len = Array.from({ length: nu }, (_, i) => (i % 2 ? 0.8 + 0.08 * rr() : 0.93 + 0.07 * rr()) - (i % 4 === 1 ? 0.1 * rr() : 0));
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const u = i / (nu - 1), v = j / (nv - 1);
        const w = 0.4 + 0.3 * v;
        const x = (u - 0.5) * 2 * w;
        const yTop = 1.71 - Math.abs(u - 0.5) * 0.12;
        const y = yTop - v * (yTop - 0.22) * len[i];
        // back surface: march from behind along -Z
        let zs = 0.62;
        for (let k = 0; k < 40; k++) { if (S.sdf(x, y, zs, 0) < 0.035 || S.sdf(x, y, zs, 1) < 0.03) break; zs -= 0.015; }
        zs += 0.028;
        zb[i] = Math.max(j === 0 ? zs : zb[i] - 0.028, zs);
        const fold = Math.sin(u * TAU * 2.5 + 0.6) * 0.022 * (0.3 + v);
        pos.push(new THREE.Vector3(x, y, zb[i] + fold));
        uvs.push([u, v]);
        // bilinear skin: column blend × chain blend
        const cu = u * 2, ci = Math.min(1, Math.floor(cu)), cf = cu - ci;
        const chainY = [1.7, 1.3, 0.9, 0.5];
        let k = 0; while (k < 2 && y < chainY[k + 1]) k++;
        const kf = clamp01((chainY[k] - y) / (chainY[k] - chainY[k + 1]));
        const wts = [[cols[ci][k], (1 - cf) * (1 - kf)], [cols[ci][k + 1], (1 - cf) * kf], [cols[ci + 1][k], cf * (1 - kf)], [cols[ci + 1][k + 1], cf * kf]];
        if (j === 0) { skins.push({ si: [b('chest'), cols[ci][0], cols[ci + 1][0], 0], sw: [0.6, 0.4 * (1 - cf), 0.4 * cf, 0] }); }
        else skins.push({ si: wts.map(w2 => w2[0]), sw: wts.map(w2 => w2[1]) });
      }
      const I = [];
      for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) {
        const a = j * nu + i;
        // tatters: drop some quads near the hem
        I.push(a, a + nu, a + 1, a + 1, a + nu, a + nu + 1);
      }
      const P = []; for (const p of pos) P.push(p.x, p.y, p.z);
      const UV = []; for (const q of uvs) UV.push(q[0], q[1]);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
      const inner = g.clone(); { const ix = inner.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 1]; ix[i + 1] = t; } const pa = inner.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, pa.getZ(i) - 0.01); inner.computeVertexNormals(); }
      const cc = col(C.cape), cd = col(C.capeD), ct = col(C.capeTrim), ci2 = col(0x2a0a08);
      let vi = 0;
      for (const [gg, isInner] of [[g, false], [inner, true]]) {
        vi = 0;
        acc.add(gg, {
          skin: () => skins[vi++ % skins.length], dtl: DT.cloth,
          color: (p, n, uv) => {
            if (isInner) return lerp3(ci2, cd, uv[1] * 0.5);
            const trim = uv[1] < 0.05 || (uv[1] > 0.08 && uv[1] < 0.1);
            const burn = sstep(0.62, 1.0, uv[1]);
            return trim ? ct : lerp3(cc, cd, burn * 0.85 + Math.abs(uv[0] - 0.5) * 0.3);
          },
          emis: (p, uv) => (isInner ? 0 : sstep(0.9, 1.0, uv[1]) * 0.35), ext: [0.04, 0, 0, 0],
        });
      }
      // legion sigil on the cape: a glowing horned ring
      const sig = new THREE.TorusGeometry(0.09, 0.012, 6, 24);
      const cp = pos[4 * nu + 6];
      acc.add(sig, { matrix: new THREE.Matrix4().setPosition(cp.x, cp.y, cp.z + 0.012), skin: skins[4 * nu + 6], color: 0xff6a22, emis: 2.2, dtl: [0, 0, 0, 0], ext: [0, 0, 0, 4] });
      for (const s of [-1, 1]) acc.add(sweep(bez([cp.x + s * 0.07, cp.y + 0.06, cp.z + 0.013], [cp.x + s * 0.14, cp.y + 0.1, cp.z + 0.013], [cp.x + s * 0.12, cp.y + 0.19, cp.z + 0.013], 6), taper(6, 0.014, 0.002), { radial: 4 }), { skin: skins[3 * nu + 6], color: 0xff6a22, emis: 2.2, dtl: [0, 0, 0, 0], ext: [0, 0, 0, 4] });
    }
    // ---------------- the greataxe (separate rigid object attached to handR)
    out.weapons.axe = { acc: buildAxe(), bone: 'handR' };
  },

  // right fist grips the axe; left fist can grab the haft end (GRIP2)
  weapon: { grip: GRIP, h0: H0, b0: B0, grip2: GRIP2, gripL: GRIPL, hL0: [0, 0, -1], bL0: [0, 1, 0], leftFlip: 1 },
  arms: { R: ['armUR', 'armLR', 'handR'], L: ['armUL', 'armLL', 'handL'] },
  bones: { hips: 'hips', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head', jaw: 'jaw', armL: ['armUL', 'armLL', 'handL'], armR: ['armUR', 'armLR', 'handR'], clavL: 'clavL', clavR: 'clavR', fingL: 'fingL', fingR: 'fingR', tail: ['tail1', 'tail2', 'tail3'] },
  sockets: {
    head: ['head', HPt(0, 0.2, -0.05)], mouth: ['jaw', HPt(0, -0.14, -0.3)], chest: ['chest', [0, 1.42, -0.25]],
    handR: ['handR', GRIP], handL: ['handL', [-0.87, 0.86, -0.05]], nose: ['head', HPt(0, -0.07, -0.42)],
    weapon: ['handR', AX(0.88), 'axe'], weaponTip: ['handR', [GRIP[0], GRIP[1] + 0.4, GRIP[2] - 0.88], 'axe'], weaponTip2: ['handR', [GRIP[0], GRIP[1] - 0.4, GRIP[2] - 0.88], 'axe'],
    back: ['chest', [0, 1.6, 0.3]], feetL: ['hoofL', [-0.22, 0.0, -0.02]], feetR: ['hoofR', [0.22, 0.0, -0.02]],
  },
  breakable: {
    hornL: { id: 1, bone: 'head', pos: [-0.58, 2.06, -0.2], dir: [-1, 0.4, -0.3], shards: 10, shardSize: 0.09 },
    hornR: { id: 2, bone: 'head', pos: [0.58, 2.06, -0.2], dir: [1, 0.4, -0.3], shards: 10, shardSize: 0.09 },
  },
  debris: { geo: hornShard },

  gait: {
    legs: [
      { id: 'L', chain: ['thighL', 'shinL', 'metaL', 'hoofL'], toe: [-0.22, 0, -0.07], body: 'hips', scap: 0.15, lift: 0.1, flex: 0.6, heel: 0.15, out: 0.08, metaK: 0.8, metaBase: 0 },
      { id: 'R', chain: ['thighR', 'shinR', 'metaR', 'hoofR'], toe: [0.22, 0, -0.07], body: 'hips', scap: 0.15, lift: 0.1, flex: 0.6, heel: 0.15, out: 0.08, metaK: 0.8, metaBase: 0 },
    ],
    maxStride: 0.95, fMin: 0.6, settleDist: 0.05, actV: 0.2,
    gaits: [
      { v: 0.75, f: 0.9, duty: 0.62, lift: 1, off: { L: 0, R: 0.5 }, bob: 0.022, bobF: 2, bobPh: 0.12, roll: 0.04, rollF: 1, rollPh: 0.25, sway: 0.03, swayF: 1, swayPh: 0.25, nod: 0.035, nodF: 2, pitch: 0.012, pitchF: 2 },
      { v: 2.6, f: 1.45, duty: 0.4, lift: 1.5, off: { L: 0, R: 0.5 }, bob: 0.05, bobF: 2, bobPh: 0.3, roll: 0.03, rollF: 1, rollPh: 0.25, sway: 0.02, swayF: 1, swayPh: 0.25, nod: 0.05, nodF: 2, pitch: 0.035, pitchF: 2 },
    ],
  },
  airPaw: -0.5,
  springs: [
    { bones: ['capeL1', 'capeL2', 'capeL3', 'capeL4'], tip: [-0.52, 0.12, 0.54], k: 26, d: 5.5, g: 1, coll: [{ bone: 'hips', c: [-0.14, 0.92, 0.1], r: 0.3 }, { bone: 'thighL', c: [-0.2, 0.75, 0.06], r: 0.2 }, { bone: 'chest', c: [-0.15, 1.35, 0.1], r: 0.3 }] },
    { bones: ['capeC1', 'capeC2', 'capeC3', 'capeC4'], tip: [0, 0.1, 0.56], k: 26, d: 5.5, g: 1, coll: [{ bone: 'hips', c: [0, 0.92, 0.12], r: 0.3 }, { bone: 'chest', c: [0, 1.35, 0.12], r: 0.32 }, { bone: 'spine', c: [0, 1.12, 0.1], r: 0.26 }] },
    { bones: ['capeR1', 'capeR2', 'capeR3', 'capeR4'], tip: [0.52, 0.12, 0.54], k: 26, d: 5.5, g: 1, coll: [{ bone: 'hips', c: [0.14, 0.92, 0.1], r: 0.3 }, { bone: 'thighR', c: [0.2, 0.75, 0.06], r: 0.2 }, { bone: 'chest', c: [0.15, 1.35, 0.1], r: 0.3 }] },
    { bones: ['loin1', 'loin2'], tip: [0, 0.4, -0.27], k: 40, d: 7, g: 1, coll: [{ bone: 'thighL', c: [-0.2, 0.75, -0.06], r: 0.16 }, { bone: 'thighR', c: [0.2, 0.75, -0.06], r: 0.16 }] },
    { bones: ['tail1', 'tail2', 'tail3'], tip: [0, 0.42, 0.38], k: 30, d: 4, g: 0.6 },
    { bones: ['ring'], tip: [0, 1.62, -0.52], k: 90, d: 6, g: 1 },
    { bones: ['earL'], tip: [-0.3, 1.78, -0.12], k: 120, d: 9, g: 0.4 },
    { bones: ['earR'], tip: [0.3, 1.78, -0.12], k: 120, d: 9, g: 0.4 },
  ],
  trails: [
    { weapon: 'axe', a: [GRIP[0], GRIP[1] + 0.12, GRIP[2] - 0.88], b: [GRIP[0], GRIP[1] + 0.36, GRIP[2] - 0.88], vMin: 7, vMax: 18 },
    { weapon: 'axe', a: [GRIP[0], GRIP[1] - 0.12, GRIP[2] - 0.88], b: [GRIP[0], GRIP[1] - 0.36, GRIP[2] - 0.88], vMin: 7, vMax: 18 },
  ],
  emitters: [
    // burning eyes: ember wisps trailing up
    { bone: 'head', p: HPt(-0.1, 0.05, -0.19), kind: 'ember', rate: 7, opts: { scale: 0.45, col: [5, 2.2, 0.5] }, when: b => b.glow.eyes * (b.dead ? 0 : 1) },
    { bone: 'head', p: HPt(0.1, 0.05, -0.19), kind: 'ember', rate: 7, opts: { scale: 0.45, col: [5, 2.2, 0.5] }, when: b => b.glow.eyes * (b.dead ? 0 : 1) },
    // molten axe edges
    { weapon: 'axe', p: [GRIP[0], GRIP[1] + 0.4, GRIP[2] - 0.88], jitter: 0.1, span: [0, 0, 0.18], kind: 'ember', rate: 10, opts: { scale: 1.1 }, when: b => 0.5 + b.glow.charge * 3 + b.glow.enrage },
    { weapon: 'axe', p: [GRIP[0], GRIP[1] - 0.4, GRIP[2] - 0.88], jitter: 0.1, span: [0, 0, 0.18], kind: 'ember', rate: 10, opts: { scale: 1.1 }, when: b => 0.5 + b.glow.charge * 3 + b.glow.enrage },
    { weapon: 'axe', p: [GRIP[0], GRIP[1], GRIP[2] - 0.88], jitter: 0.2, span: [0, 0.35, 0.2], kind: 'flame', rate: 30, opts: { scale: 1.3 }, when: b => b.glow.charge * 1.5 },
    // body embers from the fissures; heavier when enraged / channeling
    { bone: 'chest', p: [0, 1.4, -0.1], span: [0.3, 0.2, 0.2], kind: 'ember', rate: 6, opts: { scale: 1.2 }, when: b => 0.4 + b.glow.enrage * 2.5 + b.glow.body * 4 },
    { bone: 'chest', p: [0, 1.62, 0.1], span: [0.3, 0.05, 0.15], kind: 'smoke', rate: 2, opts: { scale: 2.2, a: 0.22 }, when: b => b.glow.enrage + b.glow.body * 1.5 },
    // ghost wisps
    { bone: 'chest', p: [0, 1.3, 0], span: [0.35, 0.4, 0.25], kind: 'ghost', rate: 30, opts: { scale: 2.2 }, when: b => b.glow.ghost },
    { bone: 'hips', p: [0, 0.6, 0], span: [0.3, 0.45, 0.2], kind: 'ghost', rate: 16, opts: { scale: 1.6 }, when: b => b.glow.ghost },
  ],

  carriage(ctl, dt) {
    const P = ctl.pose, B = ctl.B, t = ctl.t;
    const r = bipedCarriage(ctl, dt, { lean: { walk: 0.12, run: 0.42 }, twist: 0.07, crouch: 0.03, breathe: 0.014, look: 0.5, arm: { swing: 0.28, runSwing: 0.6, out: -0.16, runOut: 0.05, elbow: 0.35, runElbow: 0.9, weaponSwing: 0.2 }, neckPitch: -0.12, headPitch: 0.05 });
    const walkK = clamp01(Math.abs(ctl.speedSm) / 0.75), run = ctl.run, en = ctl.glow.enrage;
    // hulking bull posture: hunched shoulders, head thrust forward, breathing heaves the shoulders
    P.rot(B.chest, 0.06 - 0.04 * run, 0, 0);
    P.rot(B.clavL, 0, 0, -0.06 - 0.03 * r.breath); P.rot(B.clavR, 0, 0, 0.06 + 0.03 * r.breath);
    P.rot(B.neck, -0.08 - 0.1 * run - 0.05 * en, 0, 0);
    // snort fidget: head toss + steam (event handled below)
    const sn = ctl._snort || (ctl._snort = { t: 3, a: 0 });
    if (dt > 0) {
      sn.t -= dt * (1 + en * 1.5);
      if (sn.t <= 0 && !ctl.playing() && !ctl.dead) { sn.t = 3.5 + Math.random() * 3; sn.a = 0.001; }
      if (sn.a > 0) { sn.a += dt; if (sn.a > 0.3 && !sn.fired) { sn.fired = true; snort(ctl); } if (sn.a > 1.1) { sn.a = 0; sn.fired = false; } }
    }
    if (sn.a > 0) { const k = Math.sin(clamp01(sn.a / 1.1) * Math.PI); P.rot(B.head, 0.18 * k * (sn.a < 0.35 ? 1 : -0.6), 0, 0); }
    // left arm: heavy claw hangs, fingers half curled
    P.rot(B.fingL, 0.35, 0, 0);
    P.rot(B.fingR, 0.2, 0, 0);
    // axe (right hand IK): idle = leaning on it, head down beside the right hoof; walk/run = dragged behind
    const ik = ctl.ik.R;
    ik.w = 1; ik.hasAim = true; ik.hasPole = true;
    const wk = Math.max(walkK, run);
    const bob = Math.sin(r.ph * 2) * 0.01 * wk;
    ik.p.set(mix(0.78, 0.8, wk), mix(0.98, 0.92, wk) + bob + 0.012 * r.breath, mix(-0.22, 0.12, wk));
    const hx = mix(0.22, 0.14, wk), hy = mix(-0.66, -0.58, wk), hz = mix(-0.72, 0.8, wk);
    const l = Math.hypot(hx, hy, hz);
    ik.h.set(hx / l, hy / l, hz / l);
    ik.b.set(mix(0.25, 0.9, wk), mix(0.9, 0.15, wk), mix(-0.2, 0.2, wk)).normalize();
    ik.pole.set(1, -0.3, 0.9);
    // drag sparks when walking
    if (dt > 0 && wk > 0.5 && !ctl.playing() && Math.random() < dt * 14 * wk) {
      const tip = ctl.sockets.weaponTip2; const p = new THREE.Vector3(); ctl._socketWorld(tip, p);
      if (p.y - ctl.root.position.y < 0.9) ctl.fx('spark', p, 2, { scale: 0.6 });
    }
  },

  post(ctl) {
    // dazed head loll while groggy (after IK so it layers on top)
    const a = ctl.acts.find(x => x.name === 'groggy' && !x.out);
    if (a && a.td > 0.8 && a.td < 4.0) {
      const P = ctl.pose, t = ctl.t, k = a.w;
      _q0.setFromEuler(_e0.set(Math.sin(t * 1.3) * 0.12 * k, Math.sin(t * 0.9) * 0.25 * k, Math.sin(t * 1.1 + 1) * 0.15 * k, 'YXZ'));
      P.wq[ctl.B.head].multiply(_q0); P.fkChildren(ctl.B.head);
      if (ctl.dt > 0 && Math.random() < ctl.dt * 3) { const p = new THREE.Vector3(); ctl._socketWorld(ctl.sockets.head, p); p.y += 0.6; ctl.fx('spark', p, 1, { scale: 0.5, col: [4, 4, 1.5] }); }
    }
  },
  events: {
    snort(ctl) { snort(ctl); },
    charge(ctl) { snort(ctl, 1.5); },
    skid(ctl, a, pos) { if (pos) { const g = pos.clone(); g.y = ctl.root.position.y + 0.05; ctl.fx('dust', g, 20, { scale: 2.6 }); } },
    jump(ctl, a, pos) { if (pos) { const g = pos.clone(); g.y = ctl.root.position.y + 0.05; ctl.fx('dust', g, 18, { scale: 2.6 }); } },
    ghost(ctl, a, pos) { if (pos) for (let i = 0; i < 40; i++) ctl.fx('ghost', pos, 1, { scale: 3 }); },
    hit(ctl, a, pos, arg, idx) {
      if (!pos || ctl.opts.impactFx === false) return;
      const gy = ctl.root.position.y;
      if (pos.y - gy < 1.6) { const g = pos.clone(); g.y = gy + 0.05; ctl.fx('dust', g, 14, { scale: 2.2 }); ctl.fx('spark', pos, 26, { scale: 1.4 }); }
      else ctl.fx('spark', pos, 16, { scale: 1.2 });
    },
    stomp(ctl, a, pos) { if (pos) { const g = pos.clone(); g.y = ctl.root.position.y + 0.05; ctl.fx('dust', g, 22, { scale: 2.8 }); ctl.fx('spark', g, 18, { scale: 1.3 }); } },
    land(ctl, a, pos) { if (pos) { const g = pos.clone(); g.y = ctl.root.position.y + 0.05; ctl.fx('dust', g, 34, { scale: 3.6 }); ctl.fx('spark', g, 30, { scale: 1.6 }); } },
    roar(ctl) { snort(ctl, 2.2); },
    release(ctl, a) {
      const C = a.C, W = a.W;
      const rel = W.toReal(C.def.throwT[0]), cat = W.toReal(C.def.throwT[1]);
      ctl.launch('axe', { T: cat - rel, dist: (a.opts.dist ?? 15) / 1, side: 0.3, spin: 2.2, height: ctl.root.position.y + 3.2 });
    },
    catch(ctl) { const w = ctl.weapons.axe; if (w) ctl.catch(w); },
    drop(ctl) { ctl.drop('axe', { T: 0.75 }); },
    kneel(ctl, a, pos) { if (pos) { const g = pos.clone(); g.y = ctl.root.position.y + 0.05; ctl.fx('dust', g, 16, { scale: 2.4 }); } },
    fall(ctl, a, pos) { if (pos) { const g = pos.clone(); g.y = ctl.root.position.y + 0.05; ctl.fx('dust', g, 40, { scale: 4 }); } },
    burst(ctl, a, pos) { if (pos) { ctl.fx('spark', pos, 40, { scale: 2 }); ctl.fx('flame', pos, 30, { scale: 2.5 }); } },
    rift(ctl, a, pos) { if (pos) { const g = pos.clone(); g.y = ctl.root.position.y + 0.05; ctl.fx('dust', g, 30, { scale: 3.2 }); ctl.fx('spark', g, 40, { scale: 1.8 }); for (let i = 0; i < 20; i++) ctl.fx('flame', g, 1, { scale: 2 }); } },
  },

  actions: {}, // filled below
};

function snort(ctl, k = 1) {
  const p = new THREE.Vector3(); ctl._socketWorld(ctl.sockets.nose, p);
  const d = new THREE.Vector3(0, -0.45, -1).applyQuaternion(ctl.pose.wq[ctl.B.head]).transformDirection(ctl.pivotW);
  const side = new THREE.Vector3(1, 0, 0).applyQuaternion(ctl.pose.wq[ctl.B.head]).transformDirection(ctl.pivotW);
  for (const s of [-1, 1]) {
    const q = p.clone().addScaledVector(side, s * 0.18);
    for (let i = 0; i < Math.round(7 * k); i++) ctl.fx('steam', q, 1, { dir: [d.x + side.x * s * 0.25, d.y, d.z + side.z * s * 0.25], scale: 0.85 * Math.sqrt(k) });
  }
  ctl._emitEvent('snort', p);
}

// ------------------------------------------------------------------------------------------------ axe geometry
function buildAxe() {
  const acc = new BossAcc();
  const sk = rigid(0);
  const G = new THREE.Vector3(...GRIP), h = new THREE.Vector3(...H0), bl = new THREE.Vector3(...B0), n = new THREE.Vector3().crossVectors(h, bl);
  const at = (d) => G.clone().addScaledVector(h, d);
  const cW = col(0x2a1a12), cWL = col(0x4a3020), cL = col(C.leather), cBr = col(C.bronze), cI = col(C.iron), cIL = col(0x6a6468), cEdge = col(0xff6a1a);
  // haft: pommel spike → head
  acc.add(sweep([at(-0.46), at(-0.36)], [0.004, 0.042], { radial: 8, capStart: true }), { skin: sk, color: cI, dtl: DT.metal, ext: [0.9, 0, 0, 0] });
  acc.add(sweep([at(-0.36), at(-0.3), at(0.2), at(0.7), at(1.06)], [0.044, 0.038, 0.038, 0.04, 0.038], { radial: 10 }), {
    skin: sk, dtl: [0, 0, 0.2, 0.6],
    color: (p, nn, uv) => { const d = -0.36 + uv[1] * 1.42; const wrap = (d > -0.3 && d < 0.08) ? (Math.sin(d * 140) > 0 ? 1 : 0.6) : 0; return wrap ? lerp3(cL, col(C.leatherD), 1 - wrap) : lerp3(cW, cWL, Math.sin(uv[0] * TAU * 3) * 0.5 + 0.5); },
    ext: [0.15, 0, 0, 0],
  });
  for (const d of [-0.33, 0.1, 0.62, 1.04]) acc.add(new THREE.CylinderGeometry(0.052, 0.052, 0.04, 12), { matrix: new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(at(d)), skin: sk, color: cBr, dtl: DT.metal, ext: [1, 0, 0, 0] });
  // head socket + top spike
  acc.add(new THREE.BoxGeometry(0.12, 0.11, 0.34), { matrix: new THREE.Matrix4().setPosition(at(0.88)), skin: sk, color: cI, dtl: DT.metal, ext: [0.85, 0, 0, 0] });
  for (const s of [1, -1]) acc.add(new THREE.BoxGeometry(0.02, 0.125, 0.3), { matrix: new THREE.Matrix4().setPosition(at(0.88).addScaledVector(n, s * 0.058)), skin: sk, color: cBr, dtl: DT.metal, ext: [1, 0, 0, 0] });
  acc.add(sweep([at(1.03), at(1.12), at(1.24)], [0.05, 0.032, 0.002], { radial: 8, capStart: true }), { skin: sk, color: (p, nn, uv) => lerp3(cI, cEdge, sstep(0.75, 1, uv[1])), emis: (p, uv) => sstep(0.8, 1, uv[1]) * 2.2, dtl: DT.metal, ext: (p, uv) => [0.9, 0, 0, uv[1] > 0.8 ? 2 : 0] });
  // two crescent bits: parametric grid (u outward from the socket to the edge, v along the haft), tapering to a
  // molten edge band; faces + rims built separately for crisp normals
  const blade = crescentGeo();
  for (const s of [1, -1]) {
    // blade local: x → ±bl (outward), y → h (along the haft), z → n (thickness)
    const m = new THREE.Matrix4().makeBasis(bl.clone().multiplyScalar(s), h, n.clone().multiplyScalar(s)).setPosition(at(0.88));
    acc.add(blade, {
      matrix: m, skin: sk, dtl: DT.metal,
      color: (p, nn, uv) => (uv[0] > 0.86 ? cEdge : lerp3(cI, cIL, sstep(0.45, 0.85, uv[0]) * 0.9)),
      emis: (p, uv) => sstep(0.84, 0.93, uv[0]) * 3.4,
      ext: (p, uv) => [0.95, 0, 0, uv[0] > 0.86 ? 2 : 0],
    });
    // rune ring + glyph strokes on each blade face
    for (const f of [1, -1]) {
      const c = at(0.88).addScaledVector(bl, s * 0.17).addScaledVector(n, f * s * 0.021);
      const rg = new THREE.TorusGeometry(0.055, 0.007, 5, 22);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n.clone().multiplyScalar(f * s));
      acc.add(rg, { matrix: new THREE.Matrix4().compose(c, q, new THREE.Vector3(1, 1, 1)), skin: sk, color: 0xff5a14, emis: 2.4, dtl: [0, 0, 0, 0], ext: [0, 0, 0, 4] });
      for (let k = 0; k < 3; k++) {
        const a = k / 3 * TAU + 0.3;
        const p0 = c.clone().addScaledVector(bl, Math.cos(a) * 0.025 * s).addScaledVector(h, Math.sin(a) * 0.025);
        const p1 = c.clone().addScaledVector(bl, Math.cos(a) * 0.08 * s).addScaledVector(h, Math.sin(a) * 0.08);
        acc.add(sweep([p0, p1], [0.005, 0.005], { radial: 4 }), { skin: sk, color: 0xff5a14, emis: 2.4, dtl: [0, 0, 0, 0], ext: [0, 0, 0, 4] });
      }
    }
  }
  // bronze langets along the haft below the head
  for (const s of [1, -1]) acc.add(new THREE.BoxGeometry(0.012, 0.012, 0.22), { matrix: new THREE.Matrix4().setPosition(at(0.62).addScaledVector(bl, s * 0.036)), skin: sk, color: cBr, dtl: DT.metal, ext: [1, 0, 0, 0] });
  return acc;
}

/** Crescent axe bit in blade-local space: x outward (0.06 → edge), y along the haft, z thickness; uv.x = u (0 socket → 1 edge). */
function crescentGeo() {
  const NU = 8, NV = 13, P = [], UV = [], I = [];
  const edgeX = (v) => 0.26 + 0.075 * (1 - v * v) + 0.02 * (1 - Math.abs(v));
  const half = (u) => 0.14 + 0.16 * Math.pow(u, 1.25);
  const thick = (u) => 0.036 * Math.pow(1 - u, 0.75) + 0.003;
  const pt = (u, v, side) => {
    const x = 0.055 + (edgeX(v) - 0.055) * u;
    const y = v * half(u) * (1 - 0.18 * u * (1 - Math.abs(v)));
    return [x, y, side * thick(u) * 0.5];
  };
  const grid = (side) => {
    const base = P.length / 3;
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const u = i / (NU - 1), v = j / (NV - 1) * 2 - 1; P.push(...pt(u, v, side)); UV.push(u, v * 0.5 + 0.5); }
    for (let j = 0; j < NV - 1; j++) for (let i = 0; i < NU - 1; i++) { const a = base + j * NU + i; if (side > 0) I.push(a, a + 1, a + NU, a + 1, a + NU + 1, a + NU); else I.push(a, a + NU, a + 1, a + 1, a + NU, a + NU + 1); }
  };
  grid(1); grid(-1);
  const strip = (list) => { // list of [u, v] along a rim; builds a quad strip between the two faces
    const base = P.length / 3;
    for (const [u, v] of list) { P.push(...pt(u, v, 1)); UV.push(u, v * 0.5 + 0.5); P.push(...pt(u, v, -1)); UV.push(u, v * 0.5 + 0.5); }
    for (let k = 0; k < list.length - 1; k++) { const a = base + k * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  };
  const top = [], bot = [], edge = [];
  for (let i = 0; i < NU; i++) { top.push([i / (NU - 1), 1]); bot.push([1 - i / (NU - 1), -1]); }
  for (let j = 0; j < NV; j++) edge.push([1, 1 - j / (NV - 1) * 2]);
  strip(top); strip(edge); strip(bot);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

function hornShard() {
  const acc = new BossAcc();
  const g = new THREE.TetrahedronGeometry(1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * 0.6, p.getY(i) * 1.4, p.getZ(i) * 0.5);
  g.computeVertexNormals();
  const a = col(C.hornM), t = col(C.hornT);
  acc.add(g, { skin: rigid(0), color: (q) => lerp3(a, t, clamp01(q.y * 0.5 + 0.5)), dtl: DT.horn, ext: [0.3, 0, 0, 0] });
  return acc.build();
}

// ------------------------------------------------------------------------------------------------ actions
// Axe keys use weapon IK: $handR = grip point (units, model space), $aimR = haft direction + leading blade direction.
const IDLE_AIM = aim([0.22, -0.66, -0.72], [0.25, 0.9, -0.2]);
const A = gorrath.actions;

A.idle = { dur: 4, keys: [[0, {}], [4, {}]] };
A.walk = { dur: 1 / 0.9, hits: [0, 0.5 / 0.9], keys: [[0, {}]] };
A.run = { dur: 1 / 1.45, hits: [0, 0.5 / 1.45], keys: [[0, {}]] };

A.turn = {
  dur: 1.2, hits: [0.6], hitAt: ['feetR'], lock: 0.3,
  keys: [
    [0, {}],
    [0.35, { 'chest+': [0.05, 0.3, 0], 'head+': [0, 0.25, 0], $hips: [0, 0.02, 0] }],
    [0.6, { 'chest+': [-0.04, 0.12, 0], 'head+': [0, 0.1, 0], $hips: [0, -0.05, 0] }, 'i'],
    [1.2, {}],
  ],
};

A.axe_cleave = {
  dur: 2.6, hits: [1.45], hitAt: ['weaponTip2'], lock: 1,
  keys: [
    [0, {}],
    [0.5, { $handR: [0.5, 1.5, -0.12], $aimR: aim([0.05, 0.75, 0.66], [0, 0.66, -0.75]), $gripL: 1, 'spine+': [0.06, -0.1, 0], 'chest+': [0.08, -0.15, 0], 'head+': [0.05, 0, 0] }, 'o'],
    [1.15, { $handR: [0.2, 2.02, 0.08], $aimR: aim([0.02, 0.35, 0.94], [0, 0.94, -0.35]), $gripL: 1, 'spine+': [0.16, -0.05, 0], 'chest+': [0.2, -0.05, 0], 'head+': [0.18, 0, 0], $hips: [0, -0.03, 0.03], $charge: 0.4 }, 'o'],
    [1.3, { $handR: [0.18, 2.04, 0.1], $aimR: aim([0.02, 0.3, 0.95], [0, 0.95, -0.3]), $gripL: 1, 'spine+': [0.18, -0.05, 0], 'chest+': [0.22, -0.05, 0], 'head+': [0.2, 0, 0], $hips: [0, -0.02, 0.04], $charge: 0.6, $footL: [-0.22, 0, -0.07] }, 'o'],
    [1.45, { $handR: [0.12, 0.82, -0.95], $aimR: aim([0, -0.5, -0.86], [0, -0.86, 0.5]), $gripL: 1, 'spine+': [-0.22, 0.02, 0], 'chest+': [-0.3, 0, 0], 'head+': [-0.15, 0, 0], $hips: [0, -0.16, -0.08], $charge: 1, $footL: [-0.25, 0, -0.34] }, 'i'],
    [1.95, { $handR: [0.12, 0.84, -0.93], $aimR: aim([0, -0.5, -0.86], [0, -0.86, 0.5]), $gripL: 1, 'spine+': [-0.2, 0.02, 0], 'chest+': [-0.26, 0, 0], 'head+': [-0.05, 0, 0], $hips: [0, -0.14, -0.07], $charge: 0.5, $footL: [-0.25, 0, -0.34] }, 'o'],
    [2.6, { $gripL: 0, $charge: 0 }],
  ],
  ev: [[1.45, 'slam', 'weaponTip2']],
};

A.stomp = {
  dur: 2.0, hits: [1.05], hitAt: ['feetR'], lock: 1,
  keys: [
    [0, {}],
    [0.75, { $footR: [0.26, 0.55, -0.28, -0.3], $hips: [0, 0.02, 0.03], 'spine+': [0.1, 0, 0.05], 'chest+': [0.08, 0.05, 0.04], armUL: [0.2, 0, -0.9], armLL: [0.6, 0, 0], 'head+': [0.15, 0, 0], $charge: 0.3 }, 'o'],
    [0.9, { $footR: [0.26, 0.62, -0.3, -0.35], $hips: [0, 0.03, 0.03], 'spine+': [0.12, 0, 0.06], 'chest+': [0.1, 0.05, 0.05], armUL: [0.25, 0, -1.0], armLL: [0.7, 0, 0], 'head+': [0.2, 0, 0] }, 'o'],
    [1.05, { $footR: [0.26, 0, -0.2, 0], $hips: [0, -0.12, -0.02], 'spine+': [-0.12, 0, -0.03], 'chest+': [-0.15, 0, 0], armUL: [0.1, 0, -0.5], armLL: [0.5, 0, 0], 'head+': [-0.2, 0, 0], $shake: 0.6 }, 'i'],
    [1.4, { $footR: [0.26, 0, -0.2, 0], $hips: [0, -0.09, -0.01], 'spine+': [-0.08, 0, 0], 'chest+': [-0.1, 0, 0], armUL: [0.05, 0, -0.3], 'head+': [-0.1, 0, 0] }, 'o'],
    [2.0, {}],
  ],
  ev: [[1.05, 'stomp', 'feetR']],
};

A.death = {
  dur: 5.0, hits: [1.6, 3.4], hitAt: ['feetR', 'chest'], hold: true, fadeIn: 0.12,
  keys: [
    [0, {}],
    [0.5, { 'spine+': [0.25, 0, 0], 'chest+': [0.3, 0, 0], 'head+': [0.5, 0, 0], jaw: [-0.5, 0, 0], armUL: [-0.2, 0, -0.9], armLL: [0.5, 0, 0], armUR: [-0.2, 0, 0.9], armLR: [0.5, 0, 0], $hips: [0, 0.02, 0.06], $shake: 0.8, $freeR: 0 }, 'o'],
    [0.7, { $freeR: 1 }],
    [1.6, { 'spine+': [-0.25, 0, 0.05], 'chest+': [-0.2, 0, 0], 'head+': [-0.5, 0.2, 0], jaw: [-0.2, 0, 0], armUL: [0.1, 0, -0.2], armLL: [0.3, 0, 0], $hips: [0, -0.46, 0.1], $footL: [-0.24, 0.02, 0.4, 0.6, 1.3], $footR: [0.24, 0.02, 0.38, 0.6, 1.3], $eyes: 0.8 }, 'i'],
    [2.4, { 'spine+': [-0.3, 0.05, 0.08], 'chest+': [-0.25, 0, 0.05], 'head+': [-0.55, 0.25, 0], armUL: [0.2, 0, -0.1], armLL: [0.4, 0, 0], $hips: [0, -0.48, 0.1], $footL: [-0.24, 0.02, 0.4, 0.6, 1.3], $footR: [0.24, 0.02, 0.38, 0.6, 1.3], $eyes: 0.6 }, 'o'],
    [3.4, { hips: [-1.35, 0.1, 0.12], 'spine+': [-0.1, 0, 0], 'chest+': [-0.05, 0, 0], head: [0.4, 0.9, 0.2], armUL: [1.4, 0, -0.4], armLL: [0.3, 0, 0], armUR: [1.3, 0, 0.5], armLR: [0.3, 0, 0], $hips: [0, -0.74, -0.35], $footL: [-0.26, 0.04, 0.72, 0.9, 1.5], $footR: [0.24, 0.04, 0.7, 0.9, 1.5], $eyes: 0.3 }, 'i'],
    [3.7, { hips: [-1.32, 0.1, 0.12], 'spine+': [-0.08, 0, 0], head: [0.42, 0.9, 0.2], armUL: [1.4, 0, -0.45], armLL: [0.3, 0, 0], armUR: [1.3, 0, 0.55], armLR: [0.3, 0, 0], $hips: [0, -0.72, -0.35], $footL: [-0.26, 0.04, 0.72, 0.9, 1.5], $footR: [0.24, 0.04, 0.7, 0.9, 1.5] }, 'o'],
    [5.0, { hips: [-1.35, 0.1, 0.12], 'spine+': [-0.08, 0, 0], head: [0.42, 0.9, 0.2], armUL: [1.4, 0, -0.45], armLL: [0.3, 0, 0], armUR: [1.3, 0, 0.55], armLR: [0.3, 0, 0], $hips: [0, -0.74, -0.35], $footL: [-0.26, 0.04, 0.72, 0.9, 1.5], $footR: [0.24, 0.04, 0.7, 0.9, 1.5], $eyes: 0 }],
  ],
  ev: [[0.55, 'drop'], [1.6, 'kneel', 'feetR'], [3.4, 'fall', 'chest']],
};


/** Sweep key: axe on a circle around the boss. deg: 0 = front (−Z), +90 = left (−X), −90 = right (+X).
 *  dir +1 sweeps right → front → left (counter-clockwise from above), −1 the other way. */
const SW = (deg, y = 1.2, dir = 1, rad = 0.62, tilt = -0.1) => {
  const t = deg * Math.PI / 180;
  const r = [-Math.sin(t), 0, -Math.cos(t)];
  const tg = [-Math.cos(t) * dir, 0, Math.sin(t) * dir];
  return { $handR: [0.06 + r[0] * rad, y, -0.02 + r[2] * rad], $aimR: aim([r[0], tilt, r[2]], tg) };
};
const TW = (a, b = a * 1.3) => ({ 'spine+': [0, a, 0], 'chest+': [0, b, 0] }); // torso twist (+ = left)
const K2 = (...o) => Object.assign({}, ...o);
const KNEEL_R = { $footR: [0.24, 0.02, 0.42, 0.6, 1.3], $footL: [-0.24, 0, -0.22] };
const SLAM = { $handR: [0.08, 0.8, -0.95], $aimR: aim([0, -0.55, -0.84], [0, -0.84, 0.55]) };
const OVERHEAD_BACK = { $handR: [0.18, 2.04, 0.1], $aimR: aim([0.02, 0.3, 0.95], [0, 0.95, -0.3]) };

A.axe_sweep = {
  dur: 2.4, hits: [1.25], hitAt: ['weapon'], lock: 1, active: [[1.1, 1.45]],
  keys: [
    [0, {}],
    [0.55, K2(SW(-120, 1.32, 1, 0.55), TW(-0.25), { $gripL: 1, $hips: [0, -0.06, 0.02], $charge: 0.3, 'head+': [0, -0.2, 0] }), 'o'],
    [0.95, K2(SW(-138, 1.28, 1, 0.55), TW(-0.32), { $gripL: 1, $hips: [0, -0.08, 0.03], $charge: 0.6, 'head+': [0, -0.25, 0] }), 'o'],
    [1.15, K2(SW(-50, 1.16, 1, 0.72), TW(-0.08), { $gripL: 1, $hips: [0, -0.1, 0], $charge: 1 }), 'i'],
    [1.25, K2(SW(0, 1.1, 1, 0.78), TW(0.08), { $gripL: 1, $hips: [0, -0.1, -0.03], $charge: 1, $footL: [-0.3, 0, -0.28] }), 'l'],
    [1.42, K2(SW(75, 1.15, 1, 0.66), TW(0.28), { $gripL: 1, $hips: [0, -0.09, -0.02], $charge: 0.8, $footL: [-0.3, 0, -0.28], 'head+': [0, 0.2, 0] }), 'o'],
    [1.7, K2(SW(118, 1.2, 1, 0.5), TW(0.34), { $gripL: 1, $hips: [0, -0.07, -0.01], $charge: 0.4, 'head+': [0, 0.25, 0] }), 'o'],
    [2.4, { $gripL: 0, $charge: 0 }],
  ],
};

/** SW rotated about the body axis by th (radians, + = counter-clockwise from above) — for spins */
const rotY = (v, th) => [v[0] * Math.cos(th) + v[2] * Math.sin(th), v[1], -v[0] * Math.sin(th) + v[2] * Math.cos(th)];
const SWR = (deg, th, y = 1.15, dir = 1, rad = 0.7) => {
  const k = SW(deg, y, dir, rad); const a = k.$aimR;
  return { $handR: rotY(k.$handR, th), $aimR: [...rotY(a.slice(0, 3), th), ...rotY(a.slice(3, 6), th)] };
};
const TOE = { L: [-0.22, 0, -0.07], R: [0.22, 0, -0.07] };
const SPIN = (th, rel, y = 1.12) => K2(SWR(rel, th, y, 1, 0.74), { hips: [0, th, 0], $footL: rotY(TOE.L, th), $footR: rotY(TOE.R, th), $gripL: 1, $hips: [0, -0.14, 0], $charge: 1 });

A.triple_sweep = {
  dur: 5.2, hits: [2.05, 2.9, 4.25], hitAt: ['weapon', 'weapon', 'weapon'], lock: 1, counter: [0.35, 1.8], active: [[1.95, 2.2], [2.8, 3.05], [3.75, 4.45]],
  keys: [
    [0, {}],
    [0.35, { $counter: 0 }],
    [0.6, { $handR: [0.28, 2.02, -0.12], $aimR: aim([-1, 0.05, 0], [0, 0, -1]), $gripL: 1, 'spine+': [0.1, 0, 0], 'chest+': [0.14, 0, 0], 'head+': [0.3, 0, 0], jaw: [-0.35, 0, 0], $counter: 1, $charge: 0.3 }, 'o'],
    [1.2, { $handR: [0.22, 2.1, -0.02], $aimR: aim([-0.7, 0.05, 0.7], [0.7, 0, 0.7]), $gripL: 1, 'spine+': [0.12, -0.1, 0], 'chest+': [0.16, -0.15, 0], 'head+': [0.25, 0, 0], jaw: [-0.5, 0, 0], $counter: 1, $charge: 0.6, $shake: 0.35 }, 'io'],
    [1.72, K2(SW(-128, 1.36, 1, 0.55), TW(-0.3), { $gripL: 1, $hips: [0, -0.08, 0.03], $counter: 1, $charge: 1, $shake: 0.2, 'head+': [0, -0.2, 0], jaw: [0, 0, 0] }), 'o'],
    [1.8, { $counter: 0 }],
    [2.05, K2(SW(0, 1.1, 1, 0.78), TW(0.08), { $gripL: 1, $hips: [0, -0.1, -0.02], $charge: 1 }), 'i'],
    [2.3, K2(SW(100, 1.18, 1, 0.56), TW(0.32), { $gripL: 1, $hips: [0, -0.08, 0], $charge: 0.9 }), 'o'],
    [2.6, K2(SW(118, 1.22, -1, 0.5), TW(0.36), { $gripL: 1, $hips: [0, -0.07, 0], $charge: 1 }), 'io'],
    [2.9, K2(SW(0, 1.1, -1, 0.78), TW(-0.06), { $gripL: 1, $hips: [0, -0.1, -0.02], $charge: 1 }), 'i'],
    [3.15, K2(SW(-100, 1.2, -1, 0.56), TW(-0.3), { $gripL: 1, $hips: [0, -0.08, 0], $charge: 0.9 }), 'o'],
    [3.6, K2(SW(-140, 1.25, 1, 0.52), TW(-0.36), { hips: [0, 0, 0], $footL: TOE.L, $footR: TOE.R, $gripL: 1, $hips: [0, -0.16, 0.04], $charge: 1, 'head+': [0, -0.3, 0] }), 'io'],
    // the Reaping Wheel: a full turn with the axe held out at waist height (cape flares)
    [3.8, K2(SPIN(0.6, -40), TW(-0.1, -0.1)), 'i'],
    [4.0, K2(SPIN(1.9, 10), TW(0, 0)), 'l'],
    [4.15, SPIN(3.3, 10), 'l'],
    [4.3, SPIN(4.7, 10), 'l'],
    [4.45, K2(SPIN(6.2832, 25), TW(0.15, 0.2)), 'o'],
    [4.75, K2(SW(70, 1.15, 1, 0.6), TW(0.25), { hips: [0, 6.2832, 0], $footL: TOE.L, $footR: TOE.R, $gripL: 1, $hips: [0, -0.1, 0], $charge: 0.5 }), 'o'],
    [5.2, { hips: null, $footL: null, $footR: null, $gripL: 0, $charge: 0 }],
  ],
};

A.horn_charge = {
  dur: 3.4, hits: [1.15], hitAt: ['head'], lock: 0, active: [[1.0, 2.5]], move: [{ t: [1.0, 2.5], dist: 18 }], gait: [[0.98, 2.5, 10]],
  keys: [
    [0, {}],
    [0.3, { neck: [-0.25, 0, 0], 'head+': [-0.5, 0, 0], 'chest+': [-0.18, 0, 0], $hips: [0, -0.05, 0], $handR: [0.72, 0.95, 0.25], $aimR: aim([0.15, -0.45, 0.88], [0.1, 0.88, 0.45]), $footR: [0.24, 0.04, 0.05] }, 'o'],
    [0.5, { $footR: [0.24, 0.0, -0.14] }, 'i'],
    [0.7, { $footR: [0.24, 0.06, 0.12] }, 'o'],
    [0.88, { $footR: [0.24, 0.0, -0.1], neck: [-0.3, 0, 0], 'head+': [-0.6, 0, 0], 'chest+': [-0.22, 0, 0] }, 'i'],
    [1.05, { $footR: null, neck: [-0.35, 0, 0], 'head+': [-0.45, 0, 0], 'chest+': [-0.3, 0, 0], hips: [-0.28, 0, 0], $hips: [0, -0.08, -0.05] }, 'o'],
    [2.4, { neck: [-0.35, 0, 0], 'head+': [-0.45, 0, 0], 'chest+': [-0.3, 0, 0], hips: [-0.28, 0, 0], $hips: [0, -0.08, -0.05] }],
    [2.65, { neck: [0.05, 0, 0], 'head+': [0.1, 0, 0], 'chest+': [0.12, 0, 0], hips: [0.18, 0, 0], $hips: [0, -0.1, 0.06], $footL: [-0.24, 0, -0.35], $footR: [0.24, 0, -0.25] }, 'o'],
    [3.4, { neck: null, hips: null }],
  ],
  ev: [[0.35, 'snort'], [0.85, 'snort'], [1.0, 'charge', 'head'], [2.55, 'skid', 'feetL']],
};

// leap onto a target and slam. The encounter moves the root along its own arc (B.leap), so the model only poses:
// crouch → push-off (~30% of the time to impact) → airborne tuck with the axe overhead → slam on landing.
A.leap_slam = {
  dur: 3.0, hits: [1.85], hitAt: ['weaponTip2'], lock: 1, move: [{ t: [0.55, 1.85], dist: 'target', height: 7 }],
  keys: [
    [0, {}],
    [0.45, { $hips: [0, -0.24, 0.04], 'spine+': [-0.2, 0, 0], 'chest+': [-0.12, 0, 0], $handR: [0.45, 1.32, 0.22], $aimR: aim([0.08, 0.78, 0.62], [0, 0.62, -0.78]), $gripL: 1, $charge: 0.4 }, 'o'],
    [0.62, { $hips: [0, 0.08, 0], $air: 0.9, 'spine+': [0.05, 0, 0], 'chest+': [0.1, 0, 0], $handR: [0.25, 1.95, 0.05], $aimR: aim([0.02, 0.5, 0.86], [0, 0.86, -0.5]), $gripL: 1 }, 'o'],
    [1.2, K2(OVERHEAD_BACK, { $hips: [0, 0.12, 0], $air: 1, 'spine+': [0.18, 0, 0], 'chest+': [0.22, 0, 0], 'head+': [0.15, 0, 0], $gripL: 1, $charge: 1 }), 'o'],
    [1.7, K2(OVERHEAD_BACK, { $hips: [0, 0.05, 0], $air: 1, 'spine+': [0.12, 0, 0], 'chest+': [0.15, 0, 0], $gripL: 1, $charge: 1 }), 'io'],
    [1.85, K2(SLAM, { $hips: [0, -0.2, -0.08], $air: 0, 'spine+': [-0.24, 0, 0], 'chest+': [-0.32, 0, 0], 'head+': [-0.12, 0, 0], $gripL: 1, $charge: 1, $shake: 0.5 }), 'i'],
    [2.35, K2(SLAM, { $hips: [0, -0.17, -0.07], 'spine+': [-0.2, 0, 0], 'chest+': [-0.26, 0, 0], $gripL: 1, $charge: 0.4 }), 'o'],
    [3.0, { $gripL: 0, $charge: 0 }],
  ],
  ev: [[0.55, 'jump', 'feetL'], [1.85, 'land', 'weaponTip2']],
};

A.axe_throw = {
  dur: 3.4, hits: [1.0, 2.7], hitAt: ['weapon', 'handR'], lock: 1, throwT: [1.0, 2.7], active: [[1.0, 2.7]],
  keys: [
    [0, {}],
    [0.7, K2(TW(-0.35), { $handR: [0.82, 1.42, 0.42], $aimR: aim([0.6, 0.05, 0.8], [0.8, 0, -0.6]), $hips: [0, -0.07, 0.03], armUL: [0.6, 0, -0.5], armLL: [0.4, 0, 0], $charge: 0.6 }), 'o'],
    [0.95, K2(TW(0.3), { $handR: [0.05, 1.36, -0.78], $aimR: aim([-0.3, 0, -0.95], [-0.95, 0, 0.3]), $hips: [0, -0.1, -0.05], $footL: [-0.28, 0, -0.3], $charge: 1 }), 'i'],
    [1.2, K2(TW(0.38), { $handR: [-0.3, 1.2, -0.55], $aimR: aim([-0.7, -0.1, -0.7], [-0.7, 0, 0.7]), $hips: [0, -0.1, -0.05], $footL: [-0.28, 0, -0.3], $freeR: 0 }), 'o'],
    [1.5, K2(TW(0.05), { $freeR: 1, armUR: [0.35, 0, 0.35], armLR: [0.6, 0, 0], fingR: [-0.3, 0, 0], $hips: [0, -0.05, 0], 'head+': [0.1, 0, 0] }), 'io'],
    [2.45, K2(TW(0), { $freeR: 1, armUR: [0.6, 0, 0.3], armLR: [0.5, 0, 0], fingR: [-0.35, 0, 0], 'head+': [0.12, 0, 0] }), 'io'],
    [2.68, K2(TW(0.05), { $freeR: 1, armUR: [1.25, 0, 0.25], armLR: [0.25, 0, 0], fingR: [-0.2, 0, 0], $hips: [0, -0.04, 0] }), 'o'],
    [2.75, { $freeR: 0.3, fingR: [0.3, 0, 0] }],
    [3.4, { $freeR: 0, armUR: null, armLR: null, fingR: null }],
  ],
  ev: [[1.0, 'release', 'weapon'], [2.7, 'catch', 'handR']],
};

A.roar = {
  dur: 2.8, hits: [1.0], hitAt: ['mouth'], lock: 1,
  keys: [
    [0, {}],
    [0.6, { 'spine+': [0.12, 0, 0], 'chest+': [0.2, 0, 0], 'head+': [0.35, 0, 0], armUL: [0.15, 0, -0.55], armLL: [0.8, 0, 0], $hips: [0, 0.02, 0.02], $handR: [0.95, 1.15, -0.2], $aimR: aim([0.55, 0.55, -0.3], [0.2, 0.3, -0.9]) }, 'o'],
    [0.95, { 'spine+': [-0.05, 0, 0], 'chest+': [-0.14, 0, 0], 'head+': [-0.2, 0, 0], jaw: [-0.55, 0, 0], armUL: [0.35, 0, -1.15], armLL: [1.25, 0, 0], fingL: [-0.35, 0, 0], $hips: [0, -0.06, -0.02], $handR: [1.0, 1.3, -0.3], $aimR: aim([0.6, 0.6, -0.4], [0.2, 0.4, -0.9]), $shake: 1 }, 'i'],
    [2.2, { 'spine+': [-0.05, 0, 0], 'chest+': [-0.12, 0, 0], 'head+': [-0.18, 0, 0], jaw: [-0.5, 0, 0], armUL: [0.35, 0, -1.1], armLL: [1.2, 0, 0], fingL: [-0.35, 0, 0], $hips: [0, -0.06, -0.02], $shake: 1 }],
    [2.8, { jaw: [0, 0, 0], armUL: null, armLL: null, fingL: null }],
  ],
  ev: [[1.0, 'roar', 'mouth']],
};

A.rift_carve = {
  dur: 4.2, hits: [2.55], hitAt: ['weaponTip2'], lock: 1,
  keys: [
    [0, {}],
    [0.55, { $handR: [0.12, 2.1, -0.04], $aimR: aim([0, 1, 0.12], [0, 0.12, -1]), $gripL: 1, $hips: [0, 0, 0.06], 'spine+': [0.08, 0, 0], 'chest+': [0.1, 0, 0], 'head+': [0.25, 0, 0], $charge: 0.3, $body: 0.3 }, 'o'],
    [1.4, { $handR: [0.12, 2.14, -0.03], $aimR: aim([0, 1, 0.1], [0, 0.1, -1]), $gripL: 1, $hips: [0, 0.02, 0.06], 'spine+': [0.1, 0, 0], 'chest+': [0.12, 0, 0], 'head+': [0.3, 0, 0], jaw: [-0.3, 0, 0], $charge: 0.8, $body: 0.6, $shake: 0.3 }, 'io'],
    [2.25, { $handR: [0.12, 2.16, 0.0], $aimR: aim([0, 0.97, 0.25], [0, 0.25, -0.97]), $gripL: 1, $hips: [0, 0.05, 0.07], 'spine+': [0.14, 0, 0], 'chest+': [0.16, 0, 0], 'head+': [0.2, 0, 0], jaw: [-0.45, 0, 0], $charge: 1, $body: 1, $shake: 0.6 }, 'io'],
    [2.38, { $hips: [0, 0.16, 0.05], $air: 0.35 }, 'o'],
    [2.55, K2(SLAM, { $hips: [0, -0.22, -0.08], $air: 0, 'spine+': [-0.26, 0, 0], 'chest+': [-0.34, 0, 0], 'head+': [-0.15, 0, 0], jaw: [-0.3, 0, 0], $gripL: 1, $charge: 1, $body: 1, $shake: 0.6 }), 'i'],
    [3.3, K2(SLAM, { $hips: [0, -0.2, -0.07], 'spine+': [-0.22, 0, 0], 'chest+': [-0.28, 0, 0], jaw: [0, 0, 0], $gripL: 1, $charge: 0.3, $body: 0.2 }), 'o'],
    [4.2, { $gripL: 0, $charge: 0, $body: 0 }],
  ],
  ev: [[2.55, 'rift', 'weaponTip2']],
};

A.channel = {
  dur: 6.0, hits: [5.5], hitAt: ['chest'], lock: 1, stretch: [1.2, 5.0],
  keys: [
    [0, {}],
    [0.9, K2(KNEEL_R, { $hips: [0, -0.42, 0.05], $handR: [0.6, 0.8, -0.34], $aimR: aim([0.1, -1, -0.1], [0, 0, -1]), armUL: [0.7, 0, 0.15], armLL: [0.9, 0, 0], neck: [-0.15, 0, 0], 'head+': [-0.45, 0, 0], 'chest+': [-0.18, 0, 0], $body: 0.3, $charge: 0.3 }), 'o'],
    [1.2, K2(KNEEL_R, { $hips: [0, -0.43, 0.05], $handR: [0.6, 0.8, -0.34], $aimR: aim([0.1, -1, -0.1], [0, 0, -1]), armUL: [0.7, 0, 0.15], armLL: [0.9, 0, 0], neck: [-0.15, 0, 0], 'head+': [-0.5, 0, 0], 'chest+': [-0.2, 0, 0], $body: 0.35, $charge: 0.35, $shake: 0.15 })],
    [5.0, K2(KNEEL_R, { $hips: [0, -0.4, 0.05], $handR: [0.6, 0.82, -0.34], $aimR: aim([0.1, -1, -0.1], [0, 0, -1]), armUL: [0.6, 0, 0.1], armLL: [1.0, 0, 0], fingL: [0.5, 0, 0], neck: [-0.05, 0, 0], 'head+': [-0.1, 0, 0], 'chest+': [-0.1, 0, 0], $body: 1, $charge: 0.9, $shake: 0.7 }), 'l'],
    [5.45, { $footR: null, $footL: null, $hips: [0, 0.04, 0], $handR: [0.95, 1.7, -0.15], $aimR: aim([0.3, 1, 0], [0, 0, -1]), armUL: [0.4, 0, -1.4], armLL: [0.4, 0, 0], fingL: [-0.4, 0, 0], neck: [0.1, 0, 0], 'head+': [0.45, 0, 0], 'chest+': [0.25, 0, 0], jaw: [-0.55, 0, 0], $body: 1, $charge: 1, $shake: 1 }, 'i'],
    [6.0, { $body: 0, $charge: 0, jaw: [0, 0, 0], armUL: null, armLL: null, fingL: null, neck: null }],
  ],
  ev: [[5.5, 'burst', 'chest']],
};

A.groggy = {
  dur: 5.0, hits: [], lock: 1, stretch: [1.0, 4.0], sustain: [1.2, 3.8],
  keys: [
    [0, {}],
    [0.25, { 'chest+': [0.2, 0, 0.1], 'head+': [0.35, 0.2, 0], $hips: [0, 0, 0.08], $eyes: 0.6 }, 'o'],
    [0.8, K2(KNEEL_R, { $hips: [0, -0.44, 0.06], $handR: [0.62, 0.72, -0.2], $aimR: aim([0.3, -0.8, -0.5], [0.3, -0.5, 0.8]), armUL: [0.15, 0, 0.3], armLL: [0.3, 0, 0], neck: [-0.2, 0, 0], 'head+': [-0.55, 0.15, 0.1], 'chest+': [-0.25, 0, 0.06], jaw: [-0.2, 0, 0], $eyes: 0.35 }), 'i'],
    [4.0, K2(KNEEL_R, { $hips: [0, -0.44, 0.06], $handR: [0.62, 0.72, -0.2], $aimR: aim([0.3, -0.8, -0.5], [0.3, -0.5, 0.8]), armUL: [0.15, 0, 0.3], armLL: [0.3, 0, 0], neck: [-0.2, 0, 0], 'head+': [-0.55, 0.15, 0.1], 'chest+': [-0.25, 0, 0.06], jaw: [-0.2, 0, 0], $eyes: 0.35 })],
    [4.35, K2(KNEEL_R, { $hips: [0, -0.4, 0.06], 'head+': [0.1, -0.3, 0], neck: [0, 0, 0], jaw: [0, 0, 0], $eyes: 0.8 }), 'io'],
    [5.0, { $footR: null, $footL: null, armUL: null, armLL: null, neck: null, jaw: null, $eyes: 1 }],
  ],
  fn(ctl, a) { // dazed head loll while down
    const k = Math.min(1, Math.max(0, (a.td - 0.8) / 0.4)) * (a.td < 4.0 ? 1 : 0);
    if (k > 0) { ctl._daze = ctl._daze || 0; }
  },
};

A.ghost_form = {
  dur: 3.2, hits: [2.2], hitAt: ['chest'], lock: 1,
  keys: [
    [0, {}],
    [0.6, { 'chest+': [-0.3, 0, 0], 'spine+': [-0.15, 0, 0], 'head+': [-0.3, 0, 0], armUL: [0.9, 0, 0.45], armLL: [1.6, 0, 0], $hips: [0, -0.12, 0], $shake: 0.9, $ghost: 0.1 }, 'o'],
    [1.0, { $ghost: 0.15 }],
    [1.7, { 'chest+': [0.3, 0, 0], 'spine+': [0.12, 0, 0], 'head+': [0.5, 0, 0], jaw: [-0.5, 0, 0], armUL: [0.2, 0, -1.35], armLL: [0.3, 0, 0], fingL: [-0.4, 0, 0], $hips: [0, 0.08, 0], $handR: [1.0, 1.55, -0.1], $aimR: aim([0.4, 0.9, 0], [0, 0, -1]), $shake: 0.6, $ghost: 0.8 }, 'o'],
    [2.3, { $ghost: 1, $shake: 1 }],
    [3.2, { jaw: [0, 0, 0], armUL: null, armLL: null, fingL: null, $ghost: 1 }],
  ],
  ev: [[2.2, 'ghost', 'chest']],
};

A.enrage = {
  dur: 3.2, hits: [1.35], hitAt: ['chest'], lock: 1,
  keys: [
    [0, {}],
    [0.55, { 'chest+': [-0.28, 0, 0], 'spine+': [-0.1, 0, 0], 'head+': [-0.3, 0, 0], clavL: [0, 0, 0.15], clavR: [0, 0, -0.15], armUL: [0.3, 0, 0.3], armLL: [1.4, 0, 0], fingL: [0.9, 0, 0], $hips: [0, -0.1, 0], $shake: 0.5, $enrage: 0.3 }, 'o'],
    [1.25, { 'chest+': [0.25, 0, 0], 'spine+': [0.1, 0, 0], 'head+': [0.45, 0, 0], jaw: [-0.55, 0, 0], armUL: [2.3, 0, -0.35], armLL: [0.5, 0, 0], fingL: [0.9, 0, 0], $hips: [0, 0.03, 0.02], $handR: [0.78, 2.08, -0.18], $aimR: aim([0.2, 1, 0.1], [0, 0.1, -1]), $shake: 1, $enrage: 1, $charge: 1 }, 'i'],
    [2.4, { 'chest+': [0.2, 0, 0], 'head+': [0.4, 0, 0], jaw: [-0.5, 0, 0], armUL: [2.2, 0, -0.35], armLL: [0.55, 0, 0], $handR: [0.78, 2.05, -0.18], $aimR: aim([0.2, 1, 0.1], [0, 0.1, -1]), $shake: 1, $enrage: 1, $charge: 1 }],
    [3.2, { jaw: [0, 0, 0], armUL: null, armLL: null, fingL: null, clavL: null, clavR: null, $enrage: 0, $charge: 0 }],
  ],
  ev: [[1.3, 'roar', 'mouth']],
};

// intro: drops from the sky into a crouched landing (fist on the ground, axe out), holds (stretchable), rises and
// roars with the axe raised. The encounter plays it at ~2.4 s; longer cinematics extend the crouch hold.
A.intro = {
  dur: 3.8, hits: [0.55, 2.6], hitAt: ['feetL', 'mouth'], lock: 1, fadeIn: 0.01, stretch: [0.8, 1.9],
  keys: [
    [0, { $hips: [0, 9, 0], $air: 1, 'chest+': [-0.2, 0, 0], armUL: [2.4, 0, -0.4], armLL: [0.4, 0, 0], $handR: [0.3, 2.08, 0.05], $aimR: aim([0.02, 0.4, 0.92], [0, 0.92, -0.4]) }],
    [0.45, { $hips: [0, 0.7, 0], $air: 1, 'chest+': [-0.25, 0, 0], armUL: [2.2, 0, -0.5] }, 'i'],
    [0.55, K2(KNEEL_R, { $hips: [0, -0.42, -0.02], $air: 0, 'chest+': [-0.38, 0, 0], 'spine+': [-0.15, 0, 0], 'head+': [-0.35, 0, 0], armUL: null, armLL: null, $handL: [-0.52, 0.12, -0.48], $handR: [0.98, 0.72, -0.22], $aimR: aim([0.5, -0.5, -0.7], [0.3, -0.7, 0.6]), $shake: 0.6 }), 'i'],
    [1.9, K2(KNEEL_R, { $hips: [0, -0.4, -0.02], 'chest+': [-0.32, 0, 0], 'spine+': [-0.12, 0, 0], 'head+': [-0.25, 0, 0], $handL: [-0.52, 0.12, -0.48], $handR: [0.98, 0.74, -0.22], $aimR: aim([0.5, -0.5, -0.7], [0.3, -0.7, 0.6]), $shake: 0.2 })],
    [2.3, { $footR: null, $footL: null, $hips: [0, 0, 0], 'chest+': [0.05, 0, 0], 'spine+': [0, 0, 0], 'head+': [0.1, 0, 0], $handL: null, $handR: [0.8, 1.0, -0.25], $aimR: aim([0.22, -0.66, -0.72], [0.25, 0.9, -0.2]) }, 'io'],
    [2.6, { 'chest+': [-0.1, 0, 0], 'head+': [-0.15, 0, 0], jaw: [-0.55, 0, 0], armUL: [0.35, 0, -1.2], armLL: [1.2, 0, 0], fingL: [-0.35, 0, 0], $hips: [0, -0.05, 0], $handR: [0.82, 2.06, -0.12], $aimR: aim([0.15, 1, 0.1], [0, 0.1, -1]), $shake: 1, $enrage: 0.5, $charge: 1 }, 'i'],
    [3.3, { 'chest+': [-0.08, 0, 0], jaw: [-0.5, 0, 0], armUL: [0.35, 0, -1.15], armLL: [1.2, 0, 0], $handR: [0.82, 2.04, -0.12], $aimR: aim([0.15, 1, 0.1], [0, 0.1, -1]), $shake: 0.8, $enrage: 0.4, $charge: 1 }],
    [3.8, { jaw: [0, 0, 0], armUL: null, armLL: null, fingL: null, $enrage: 0, $charge: 0 }],
  ],
  ev: [[0.55, 'land', 'feetL'], [1.1, 'snort'], [1.7, 'snort'], [2.6, 'roar', 'mouth']],
};

// game-driven leap (the encounter moves the root along an arc with B.leap): pose only — crouch, airborne tuck with
// the axe overhead, slam on landing (hits[0] = landing)
A.leap = {
  dur: 2.3, hits: [1.5], hitAt: ['weaponTip2'], lock: 1, move: [{ t: [0.45, 1.5], dist: 'target', height: 6 }],
  keys: [
    [0, {}],
    [0.3, { $hips: [0, -0.22, 0.04], 'spine+': [-0.18, 0, 0], 'chest+': [-0.1, 0, 0], $handR: [0.45, 1.32, 0.22], $aimR: aim([0.08, 0.78, 0.62], [0, 0.62, -0.78]), $gripL: 1, $charge: 0.4 }, 'o'],
    [0.5, { $hips: [0, 0.06, 0], $air: 0.8, 'spine+': [0.05, 0, 0], 'chest+': [0.08, 0, 0], $handR: [0.25, 1.95, 0.05], $aimR: aim([0.02, 0.5, 0.86], [0, 0.86, -0.5]), $gripL: 1 }, 'o'],
    [0.95, K2(OVERHEAD_BACK, { $hips: [0, 0.12, 0], $air: 1, 'spine+': [0.18, 0, 0], 'chest+': [0.22, 0, 0], 'head+': [0.12, 0, 0], $gripL: 1, $charge: 1 }), 'o'],
    [1.36, K2(OVERHEAD_BACK, { $hips: [0, 0.05, 0], $air: 1, 'spine+': [0.1, 0, 0], 'chest+': [0.14, 0, 0], $gripL: 1, $charge: 1 }), 'io'],
    [1.5, K2(SLAM, { $hips: [0, -0.2, -0.08], $air: 0, 'spine+': [-0.24, 0, 0], 'chest+': [-0.32, 0, 0], 'head+': [-0.12, 0, 0], $gripL: 1, $charge: 1, $shake: 0.5 }), 'i'],
    [1.95, K2(SLAM, { $hips: [0, -0.17, -0.07], 'spine+': [-0.2, 0, 0], 'chest+': [-0.26, 0, 0], $gripL: 1, $charge: 0.4 }), 'o'],
    [2.3, { $gripL: 0, $charge: 0 }],
  ],
  ev: [[0.45, 'jump', 'feetL'], [1.5, 'land', 'weaponTip2']],
};

// hoof back-kick at raiders behind him: weight forward, glance back over the shoulder, hoof driven back high
A.kick = {
  dur: 1.5, hits: [0.62], hitAt: ['feetR'], lock: 1,
  keys: [
    [0, {}],
    [0.36, { 'spine+': [-0.2, -0.15, 0], 'chest+': [-0.2, -0.2, 0], 'head+': [0.05, -0.55, 0], $hips: [0, -0.04, -0.06], $footR: [0.26, 0.42, 0.5, 0.4, 0.6], $footL: [-0.22, 0, -0.14], armUL: [0.4, 0, -0.5], armLL: [0.6, 0, 0] }, 'o'],
    [0.62, { 'spine+': [-0.32, -0.1, 0], 'chest+': [-0.34, -0.12, 0], 'head+': [0.1, -0.5, 0], $hips: [0, -0.02, -0.1], $footR: [0.28, 0.62, 1.3, -0.3, -0.4], $footL: [-0.22, 0, -0.14], armUL: [0.6, 0, -0.7], armLL: [0.4, 0, 0], $shake: 0.3 }, 'i'],
    [0.9, { 'spine+': [-0.12, 0, 0], 'chest+': [-0.1, 0, 0], 'head+': [0, -0.3, 0], $hips: [0, -0.02, -0.03], $footR: [0.25, 0.04, 0.32], armUL: [0.2, 0, -0.3] }, 'o'],
    [1.5, { $footR: null, $footL: null, armUL: null, armLL: null }],
  ],
};

// ghost phase: axe raised to the sky, open claw, spectral axes rain down (hits[0] = the call)
A.cast = {
  dur: 1.9, hits: [0.9], hitAt: ['weaponTip'], lock: 1,
  keys: [
    [0, {}],
    [0.55, { $handR: [0.72, 2.02, -0.1], $aimR: aim([0.15, 1, 0.05], [0, 0.05, -1]), armUL: [0.2, 0, -1.25], armLL: [0.5, 0, 0], fingL: [-0.45, 0, 0], 'chest+': [0.15, 0, 0], 'head+': [0.4, 0, 0], jaw: [-0.3, 0, 0], $charge: 0.6 }, 'o'],
    [0.9, { $handR: [0.74, 2.08, -0.12], $aimR: aim([0.12, 1, 0.08], [0, 0.08, -1]), armUL: [0.35, 0, -1.4], armLL: [0.3, 0, 0], fingL: [-0.5, 0, 0], 'chest+': [0.2, 0, 0], 'head+': [0.45, 0, 0], jaw: [-0.55, 0, 0], $charge: 1, $shake: 0.6 }, 'i'],
    [1.35, { $handR: [0.72, 2.0, -0.1], $aimR: aim([0.15, 1, 0.05], [0, 0.05, -1]), armUL: [0.3, 0, -1.3], 'head+': [0.35, 0, 0], jaw: [-0.4, 0, 0], $charge: 0.8, $shake: 0.4 }],
    [1.9, { armUL: null, armLL: null, fingL: null, jaw: [0, 0, 0], $charge: 0 }],
  ],
};

// ghost phase counter: long low wind-up (the game opens the blue counter window), then a lunging rising slash
// (the encounter drives the lunge distance with B.charge between hits[0] and hits[1])
A.spectral_lunge = {
  dur: 2.3, hits: [1.1, 1.42], hitAt: ['weapon', 'weapon'], lock: 1, active: [[1.1, 1.5]],
  keys: [
    [0, {}],
    [0.5, K2(SW(-150, 0.95, 1, 0.5, -0.35), TW(-0.3), { $gripL: 1, $hips: [0, -0.2, 0.08], 'spine+': [-0.1, 0, 0], 'head+': [0.1, 0.3, 0], $charge: 0.5 }), 'o'],
    [1.05, K2(SW(-158, 0.9, 1, 0.5, -0.38), TW(-0.34), { $gripL: 1, $hips: [0, -0.23, 0.1], 'spine+': [-0.12, 0, 0], 'head+': [0.12, 0.32, 0], $charge: 1, $shake: 0.35 }), 'io'],
    [1.12, K2(SW(-110, 1.0, 1, 0.55, -0.2), TW(-0.2), { $gripL: 1, $hips: [0, -0.18, -0.12], 'spine+': [-0.25, 0, 0], 'chest+': [-0.15, 0, 0], $footL: [-0.26, 0, -0.42], $charge: 1 }), 'i'],
    [1.42, K2(SW(25, 1.75, 1, 0.8, 0.45), TW(0.28), { $gripL: 1, $hips: [0, -0.06, -0.14], 'spine+': [0.05, 0, 0], 'chest+': [0.12, 0, 0], $footL: [-0.26, 0, -0.42], $charge: 1 }), 'i'],
    [1.75, K2(SW(80, 2.0, 1, 0.55, 0.7), TW(0.35), { $gripL: 1, $hips: [0, -0.04, -0.1], $footL: [-0.26, 0, -0.42], $charge: 0.5 }), 'o'],
    [2.3, { $gripL: 0, $charge: 0, $footL: null }],
  ],
};

// appears (attach): a heavy settle and a snort
A.spawn = { dur: 0.9, hits: [], lock: 1, fadeIn: 0.02, keys: [[0, { $hips: [0, -0.16, 0], 'chest+': [-0.15, 0, 0] }], [0.9, {}]], ev: [[0.35, 'snort']] };

A.hit = {
  dur: 0.6, hits: [], lock: 0, fadeIn: 0.04,
  keys: [[0, {}], [0.12, { 'chest+': [0.12, 0.08, 0.05], 'head+': [0.2, 0.1, 0], $hips: [0, -0.02, 0.03] }, 'o'], [0.6, {}]],
};

A.ghost_transform = A.ghost_form;   // the encounter's name for the ghost transition

export { aim, GRIP, IDLE_AIM };
