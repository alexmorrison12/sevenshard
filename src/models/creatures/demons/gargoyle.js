// Gargoyle: stone-skinned winged demon (~1.9 m, hunched). Granite hide split by glowing fissures, heavy horned head with
// a fanged beak-snout, long clawed arms, digitigrade legs, a spiked tail and great stone bat wings. It flies (fly: true).
// spawn = a statue awakening: frozen crouch with wings wrapped, fissures ignite, stone dust shaken off, wings flare.
// Variants: granite (default, ember glow), basalt (azure glow), mossy (lichen, green glow); elite: sentinel (×1.3, obsidian).
import * as THREE from 'three';
import { BipedCtl, armRot, legsLocal, legsPlant } from '../ctl.js';
import { bHit, bKnockback, bKnockdown, bGetup, bDeath, bStun, bDrop, bRoar, kf } from '../acts.js';
import { sweep, rigid, bez, taper, leafGeo } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addEye, addHorn, lerp3 } from '../../kit/parts.js';
import { wingLayout, batWing, orb } from '../parts2.js';
import { sstep, clamp01, mix } from '../../kit/rig.js';

const PAL = {
  granite: { stone: 0x76726e, dark: 0x3e3b3a, light: 0xa8a29a, moss: 0x6a7048, glow: 0xff6a1a, eye: 0xffb040, wing: 0x55504c, wing2: 0x8a8278, claw: 0x2a2624 },
  basalt: { stone: 0x3e4148, dark: 0x1c1e24, light: 0x6a6e78, moss: 0x3a4a4a, glow: 0x3ab0ff, eye: 0x9ae4ff, wing: 0x2c2e34, wing2: 0x4e525c, claw: 0x121418 },
  mossy: { stone: 0x7a7c6a, dark: 0x3e4234, light: 0xa0a488, moss: 0x5a7a2a, glow: 0x9aff3a, eye: 0xe0ff70, wing: 0x565a48, wing2: 0x7e8468, claw: 0x2a2c22 },
  sentinel: { stone: 0x2a2630, dark: 0x0e0c12, light: 0x5a5466, moss: 0x2a2630, glow: 0xff2a3a, eye: 0xffd0d0, wing: 0x1e1a24, wing2: 0x3a3444, claw: 0x08060a },
};

const WING = { S: [0.13, 1.36, 0.18], out: [1, 0.22, 0.5], up: [-0.15, 1, 0.35], wrist: [0.48, 0.24], tips: [[1.12, 0.55], [1.22, 0.06], [0.98, -0.38], [0.55, -0.6]], body: [0.04, -0.45], cup: 0.12 };
const wl = (s) => wingLayout(s, WING);

export const gargoyle = {
  name: 'Gargoyle',
  variants: ['granite', 'basalt', 'mossy', 'sentinel'],
  canFly: true,
  config(variant, opts) {
    const v = PAL[variant] ? variant : (opts.elite ? 'sentinel' : 'granite');
    const elite = v === 'sentinel' || !!opts.elite;
    return { variant: v, pal: PAL[v === 'granite' && elite ? 'sentinel' : v], elite, shapeKey: elite ? 'elite' : 'base', scale: elite ? 1.3 : 1, h: 0.048, hg: { 1: 0.032 }, mat: { dfreq: 2.6, furAxis: 1, rim: 0.22, rimColor: 0xe0e8ff, spec: elite ? 0.3 : 0.05, shine: 30 }, aoScale: 1.3, grad: { top: 0.25, bottom: 0.35, y0: 0, y1: 0.9, low: 0.2 } };
  },
  rig(R) {
    R.add('hips', null, [0, 0.8, 0.05]);
    R.add('spine', 'hips', [0, 1.0, 0.02]);
    R.add('chest', 'spine', [0, 1.22, -0.04]);
    R.add('neck', 'chest', [0, 1.4, -0.12]);
    R.add('head', 'neck', [0, 1.5, -0.2]);
    R.add('jaw', 'head', [0, 1.44, -0.26]);
    R.add('tail1', 'hips', [0, 0.78, 0.2]); R.add('tail2', 'tail1', [0, 0.64, 0.45]); R.add('tail3', 'tail2', [0, 0.52, 0.7]); R.add('tail4', 'tail3', [0, 0.46, 0.95]);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('armU' + n, 'chest', [s * 0.28, 1.36, -0.02]); R.add('armL' + n, 'armU' + n, [s * 0.44, 1.02, 0.02]); R.add('hand' + n, 'armL' + n, [s * 0.5, 0.7, -0.08]);
      R.add('thigh' + n, 'hips', [s * 0.16, 0.78, 0.05]); R.add('shin' + n, 'thigh' + n, [s * 0.2, 0.46, -0.14]); R.add('meta' + n, 'shin' + n, [s * 0.2, 0.2, 0.08]); R.add('foot' + n, 'meta' + n, [s * 0.2, 0.06, -0.02]);
      const L = wl(s); R.add('wing1' + n, 'chest', L.S.toArray()); R.add('wing2' + n, 'wing1' + n, L.W.toArray());
    }
  },
  sculpt(S, cfg) {
    const c = cfg.pal, E = cfg.elite;
    const rock = [0.0, 0.1, 0.55, 0.05], rockS = [0.0, 0.08, 0.45, 0.05];
    // heavy torso: deep chest, stony pecs, gaunt waist, powerful haunches
    S.ell('chest', [0, 1.23, -0.04], [0.31, 0.24, 0.23], { k: 0.07, col: c.stone, tag: 'body', dtl: rock });
    for (const s of [-1, 1]) S.ell('chest', [s * 0.14, 1.21, -0.18], [0.14, 0.11, 0.08], { k: 0.05, col: c.light, tag: 'pec', dtl: rockS });
    S.ell('chest', [0, 1.3, 0.12], [0.2, 0.15, 0.12], { k: 0.06, col: c.dark, tag: 'back', dtl: rock });
    S.ell('spine', [0, 1.0, 0.0], [0.17, 0.15, 0.14], { k: 0.06, col: c.stone, tag: 'body', dtl: rock });
    S.ell('hips', [0, 0.82, 0.05], [0.19, 0.12, 0.15], { k: 0.06, col: c.stone, tag: 'body', dtl: rock });
    for (const s of [-1, 1]) S.ell('chest', [s * 0.3, 1.39, 0.0], [0.15, 0.13, 0.15], { k: 0.06, col: c.stone, tag: 'shoulder', dtl: rock });
    // neck & head (finer group): heavy brow, beak-like snout, horned crown
    S.cone('neck', [0, 1.32, -0.06], [0, 1.48, -0.18], 0.1, 0.085, { k: 0.05, col: c.stone, b2: 'head', t0: 0.6, t1: 1, dtl: rock });
    S.ell('head', [0, 1.54, -0.22], [0.14, 0.125, 0.145], { group: 1, k: 0.04, col: c.stone, tag: 'head', dtl: rockS });
    S.ell('head', [0, 1.58, -0.33], [0.11, 0.04, 0.05], { group: 1, k: 0.03, col: c.dark, tag: 'brow', rot: [-0.3, 0, 0], dtl: rockS });
    S.cone('head', [0, 1.52, -0.3], [0, 1.47, -0.43], 0.07, 0.035, { group: 1, k: 0.03, col: c.stone, tag: 'snout', dtl: rockS });
    S.cone('head', [0, 1.49, -0.42], [0, 1.43, -0.47], 0.035, 0.012, { group: 1, k: 0.02, col: c.dark, tag: 'beak', dtl: rockS });
    S.ell('head', [0, 1.455, -0.33], [0.075, 0.016, 0.08], { group: 1, k: 0.012, sub: true, col: c.glow, tag: 'mouth' });
    S.ell('jaw', [0, 1.43, -0.32], [0.07, 0.03, 0.09], { group: 1, k: 0.025, col: c.stone, tag: 'jaw', dtl: rockS });
    for (const s of [-1, 1]) S.ell('head', [s * 0.1, 1.5, -0.24], [0.045, 0.06, 0.06], { group: 1, k: 0.03, col: c.stone, tag: 'cheek', dtl: rockS });
    // long clawed arms; digitigrade legs
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      S.cone('armU' + n, [s * 0.3, 1.36, -0.02], [s * 0.44, 1.02, 0.02], 0.1, 0.075, { k: 0.04, col: c.stone, b2: 'armL' + n, t0: 0.8, t1: 1, dtl: rock });
      S.cone('armL' + n, [s * 0.44, 1.02, 0.02], [s * 0.5, 0.74, -0.06], 0.08, 0.065, { k: 0.035, col: c.stone, tag: 'fore', b2: 'hand' + n, t0: 0.88, t1: 1, dtl: rock });
      S.ell('hand' + n, [s * 0.505, 0.68, -0.09], [0.065, 0.075, 0.065], { k: 0.025, col: c.dark, tag: 'hand', dtl: rockS });
      S.cone('thigh' + n, [s * 0.16, 0.78, 0.05], [s * 0.2, 0.46, -0.14], 0.12, 0.08, { k: 0.05, col: c.stone, b2: 'shin' + n, t0: 0.8, t1: 1, dtl: rock });
      S.cone('shin' + n, [s * 0.2, 0.46, -0.14], [s * 0.2, 0.2, 0.08], 0.06, 0.042, { k: 0.035, col: c.stone, tag: 'leg', b2: 'meta' + n, t0: 0.85, t1: 1, dtl: rock });
      S.cone('meta' + n, [s * 0.2, 0.2, 0.08], [s * 0.2, 0.06, -0.02], 0.042, 0.038, { k: 0.03, col: c.dark, tag: 'leg', b2: 'foot' + n, t0: 0.8, t1: 1, dtl: rockS });
      S.ell('foot' + n, [s * 0.2, 0.04, -0.07], [0.055, 0.04, 0.09], { k: 0.025, col: c.dark, tag: 'foot', dtl: rockS });
    }
    S.cone('tail1', [0, 0.8, 0.16], [0, 0.64, 0.45], 0.075, 0.055, { k: 0.04, col: c.stone, tag: 'tail', b2: 'tail2', t0: 0.6, t1: 1, dtl: rock });
    S.cone('tail2', [0, 0.64, 0.45], [0, 0.52, 0.7], 0.055, 0.04, { k: 0.03, col: c.stone, tag: 'tail', b2: 'tail3', t0: 0.6, t1: 1, dtl: rock });
    S.cone('tail3', [0, 0.52, 0.7], [0, 0.46, 0.95], 0.04, 0.025, { k: 0.02, col: c.dark, tag: 'tail', b2: 'tail4', t0: 0.6, t1: 1, dtl: rock });
    if (E) for (const s of [-1, 1]) S.ell('chest', [s * 0.3, 1.44, 0.02], [0.12, 0.07, 0.13], { k: 0.04, col: c.dark, tag: 'shoulder', dtl: rock });
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, y, z] = v.p, [nx, ny, nz] = v.n;
    // weathering: light on top surfaces, lichen/moss patches, dark crevices (AO does most of it)
    v.mix(c.light, sstep(0.4, 0.95, ny) * 0.35);
    const lich = Math.sin(x * 23 + Math.sin(z * 17) * 2) * Math.sin(y * 19 + x * 7) * Math.sin(z * 29 + y * 5);
    v.mix(c.moss, sstep(0.2, 0.45, lich) * sstep(0.1, 0.6, ny) * (cfg.variant === 'mossy' ? 0.85 : 0.35));
    v.mul(0.85 + 0.3 * v.ao);
    // glowing fissures across chest, arms and thighs
    const n1 = Math.sin(x * 26 + Math.sin(y * 21 + z * 17) * 2.3) * Math.sin(y * 31 - z * 23 + Math.sin(x * 19) * 1.8);
    const crack = (1 - sstep(0.0, 0.05, Math.abs(n1))) * sstep(0.0, 0.5, Math.sin(x * 5 + y * 4 + z * 3.3));
    const where = (1 - v.t('hand') - v.t('foot')) * (v.group === 0 ? 1 : 0.5);
    const g = crack * Math.max(0, where);
    if (g > 0.03) { v.mix(c.glow, g * 0.9); v.emis = Math.max(v.emis, g * 1.8); }
    if (v.t('mouth') > 0.25) { v.mix(c.glow, 0.95); v.emis = Math.max(v.emis, 2.4 * v.t('mouth')); }
    if (v.group === 1) for (const s of [-1, 1]) { const d = Math.hypot(x - s * 0.06, y - 1.545, z + 0.33); v.mix(0x050404, (1 - sstep(0.025, 0.045, d)) * 0.9); }
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n), E = cfg.elite;
    for (const s of [-1, 1]) orb(acc, [s * 0.058, 1.545, -0.315], 0.022, rigid(b('head')), c.eye, E ? 5.5 : 4, 1);
    // horns: two big swept-back horns + small brow spikes
    const hk = E ? 1.6 : 1.25;
    for (const s of [-1, 1]) {
      addHorn(acc, b('head'), [s * 0.08, 1.63, -0.24], [s * 0.2 * hk, 1.8 * (E ? 1.03 : 1), -0.14], [s * 0.22 * hk, 1.84, 0.08], 0.05, 0.004, { base: c.dark, tip: c.light, radial: 6, n: 6, gpow: 1.5 });
      addHorn(acc, b('head'), [s * 0.1, 1.58, -0.3], [s * 0.15, 1.64, -0.3], [s * 0.19, 1.66, -0.26], 0.018, 0.002, { base: c.dark, tip: c.light, radial: 4, n: 3 });
      // bat-ish pointed ears
      const g = leafGeo(0.045, 0.12, 0.025, 0.5, 0.1, { nu: 4, nv: 4, pw: 1.2 });
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.3, s * 0.4, -s * 1.1, 'YXZ')); m.setPosition(s * 0.11, 1.56, -0.18);
      acc.add(g, { matrix: m, skin: rigid(b('head')), dtl: [0, 0.3, 0.3, 0], color: c.stone });
    }
    // fangs
    const tc = col(0xd8d0c0), tb = col(0x8a8478);
    for (const s of [-1, 1]) acc.add(sweep(bez([s * 0.045, 1.46, -0.37], [s * 0.05, 1.43, -0.38], [s * 0.046, 1.41, -0.37], 3), taper(3, 0.012, 0.002), { radial: 4 }), { skin: rigid(b('head')), color: (p, n, uv) => lerp3(tb, tc, uv[1]), dtl: [0, 0, 0, 0] });
    // spine ridge + tail spikes
    for (let i = 0; i < 5; i++) {
      const y = 1.36 - i * 0.12, z = 0.2 + i * 0.03, L = 0.12 - i * 0.012, bone = i < 2 ? 'chest' : i < 4 ? 'spine' : 'hips';
      addHorn(acc, b(bone), [0, y, z - 0.03], [0, y + L * 0.6, z + L * 0.3], [0, y + L * 0.8, z + L * 0.9], 0.03, 0.002, { base: c.dark, tip: c.light, radial: 4, n: 4 });
    }
    for (let i = 0; i < 2; i++) addHorn(acc, b(i ? 'tail3' : 'tail2'), [0, i ? 0.54 : 0.66, i ? 0.66 : 0.42], [0, i ? 0.6 : 0.74, i ? 0.7 : 0.46], [0, i ? 0.62 : 0.78, i ? 0.78 : 0.53], 0.025, 0.002, { base: c.dark, tip: c.light, radial: 4, n: 3 });
    // tail blade
    const tg = leafGeo(0.06, 0.12, 0.02, 0.1, 0, { nu: 4, nv: 4, pw: 0.7, tipW: 0.002 });
    acc.add(tg, { matrix: new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI / 2 + 0.2, 0, 0, 'YXZ')).setPosition(0, 0.46, 0.94), skin: rigid(b('tail4')), color: c.dark, dtl: [0, 0.3, 0.2, 0] });
    // claws
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R', hx = s * 0.505;
      for (let f = -1; f <= 1; f++) addHorn(acc, b('hand' + n), [hx + f * 0.028, 0.63, -0.12], [hx + f * 0.036, 0.56, -0.17], [hx + f * 0.04, 0.52, -0.13], 0.017, 0.002, { base: c.dark, tip: c.claw, radial: 4, n: 4 });
      for (let f = -1; f <= 1; f++) addHorn(acc, b('foot' + n), [s * 0.2 + f * 0.03, 0.03, -0.14], [s * 0.2 + f * 0.04, 0.02, -0.18], [s * 0.2 + f * 0.042, 0.0, -0.19], 0.014, 0.002, { base: c.dark, tip: c.claw, radial: 4, n: 3 });
    }
    // great stone wings
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      batWing(acc, wl(s), { chest: b('chest'), w1: b('wing1' + n), w2: b('wing2' + n) }, { bone: c.dark, membrane: c.wing, membrane2: c.wing2, claw: c.claw, emis: 0 }, { armR: 0.038, fingR: 0.017, scallop: 0.2, rings: 3, nsc: 3, thick: 0.012 });
    }
    if (E) for (let i = -1; i <= 1; i++) addHorn(acc, b('head'), [i * 0.04, 1.64, -0.2], [i * 0.07, 1.78, -0.16], [i * 0.1, 1.86, -0.08], 0.022, 0.002, { base: c.dark, tip: c.glow, radial: 4, n: 4 });
  },
  sockets: {
    head: ['head', [0, 1.72, -0.2]], mouth: ['jaw', [0, 1.42, -0.42]], center: ['chest', [0, 1.1, -0.05]], chest: ['chest', [0, 1.2, -0.24]],
    back: ['chest', [0, 1.32, 0.22]], handR: ['handR', [0.505, 0.6, -0.12]], handL: ['handL', [-0.505, 0.6, -0.12]],
  },
  height: 1.85, radius: 0.55,
  controller(inst) { return new BipedCtl(inst, GARG_SPEC); },
  get actionList() { return ACTIONS; },
};

// ------------------------------------------------------------------------------------------------ animation
// statue crouch (used by spawn and the idle 'freeze'): squat, arms folded in front, wings wrapped, head bowed
function statuePose(ctl, w) {
  const P = ctl.pose, b = ctl.b, H = ctl.H;
  P.move(b.hips, 0, -0.26 * H * w, 0.02 * w);
  P.rx(b.hips, -0.25 * w); P.rx(b.spine, -0.35 * w); P.rx(b.chest, -0.1 * w); P.rot(b.head, 0.35 * w, 0, 0);
  armRot(ctl, -1, 0.9, 1.5, w, -0.15); armRot(ctl, 1, 0.9, 1.5, w, -0.15);
  ctl.wingSpread = mix(ctl.wingSpread, -1.2, w);
  legsPlant(ctl, w, 1.35, -0.05);
}
const ACTIONS = {
  attack: { dur: 0.75, a: 0.06, d: 0.82, hit: 0.48, fn(ctl, a, w) { // raking claw
    const P = ctl.pose, b = ctl.b, k = a.k;
    const wind = sstep(0, 0.4, k) * (1 - sstep(0.42, 0.52, k)), sw = sstep(0.42, 0.55, k) * (1 - sstep(0.65, 1, k));
    P.rot(b.spine, (0.12 * wind - 0.3 * sw) * w, (0.45 * wind - 0.5 * sw) * w, 0);
    P.move(b.hips, 0, 0, (0.04 * wind - 0.12 * sw) * w);
    armRot(ctl, 1, 2.3 * wind + 0.7 * sw, 0.9 * wind + 0.1 * sw, w, 0.8 * wind - 0.4 * sw);
    armRot(ctl, -1, 0.4, 0.9, w, 0.4);
    ctl.jaw = Math.max(ctl.jaw, 0.6 * sw * w); ctl.wingSpread = mix(ctl.wingSpread, 0.8 * wind + 0.3 * sw, w);
  } },
  attack2: { dur: 1.0, a: 0.06, d: 0.85, hit: 0.5, fn(ctl, a, w) { // wing buffet: wings snap forward, blasting a gust
    const P = ctl.pose, b = ctl.b, k = a.k;
    const open = sstep(0, 0.35, k) * (1 - sstep(0.4, 0.5, k)), snap = sstep(0.42, 0.55, k) * (1 - sstep(0.7, 1, k));
    P.rx(b.spine, (0.2 * open - 0.25 * snap) * w); P.rx(b.chest, (0.15 * open - 0.1 * snap) * w);
    armRot(ctl, -1, 0.6 * open, 0.6, w, 0.9 * open); armRot(ctl, 1, 0.6 * open, 0.6, w, 0.9 * open);
    ctl.wingSpread = mix(ctl.wingSpread, 1.4 * open - 0.4 * snap, w); ctl.flap = Math.max(ctl.flap, snap * w);
    ctl.jaw = Math.max(ctl.jaw, 0.5 * open * w);
    legsPlant(ctl, (open + snap) * 0.6 * w, 1.35, 0);
  } },
  attack_big: { dur: 2.2, a: 0.04, d: 0.92, hit: 0.72, fn(ctl, a, w) { // crouch & glow (telegraph), launch into the air, dive-slam
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t, H = ctl.H;
    const crouch = sstep(0, 0.25, k) * (1 - sstep(0.36, 0.42, k));
    const air = sstep(0.38, 0.5, k) * (1 - sstep(0.62, 0.72, k));
    const dive = sstep(0.6, 0.72, k) * (1 - sstep(0.85, 1, k));
    const hgt = Math.sin(clamp01((k - 0.38) / 0.34) * Math.PI) * 0.95 * H;
    P.move(b.hips, 0, (-0.2 * H * crouch + hgt - 0.12 * H * dive) * w, -0.6 * H * sstep(0.45, 0.72, k) * (1 - sstep(0.85, 1, k)) * w);
    P.rx(b.hips, (-0.3 * crouch - 0.5 * dive + 0.2 * air) * w);
    P.rx(b.spine, (-0.2 * crouch - 0.2 * dive) * w);
    armRot(ctl, -1, 0.4 * crouch + 2.6 * air + 0.6 * dive, 0.4, w, 0.9 * air + 0.3 * dive);
    armRot(ctl, 1, 0.4 * crouch + 2.6 * air + 0.6 * dive, 0.4, w, 0.9 * air + 0.3 * dive);
    ctl.wingSpread = mix(ctl.wingSpread, 1.3 * (crouch + air) - 0.3 * dive, w); ctl.flap = Math.max(ctl.flap, air * w);
    ctl.glow = mix(ctl.glow, 1 + 2.5 * sstep(0.02, 0.36, k) * (1 - sstep(0.75, 0.9, k)), w);
    ctl.charge = Math.max(ctl.charge, sstep(0.02, 0.36, k) * (1 - sstep(0.42, 0.5, k)) * w);
    ctl.jaw = Math.max(ctl.jaw, (0.5 * crouch + 0.9 * dive) * w);
    legsLocal(ctl, air * w, 0.3, 1.1);
    legsPlant(ctl, (crouch + dive) * w, 1.45, -0.05);
  } },
  roar: bRoar({ dur: 1.6 }),
  idle_alt: { dur: 3.2, a: 0.25, d: 0.8, fn(ctl, a, w) { // freeze into a statue for a moment, then twitch awake
    const k = a.k, t = a.t;
    const hold = sstep(0.0, 0.2, k) * (1 - sstep(0.75, 0.95, k));
    statuePose(ctl, hold * w * 0.7);
    const tw = sstep(0.75, 0.8, k) * (1 - sstep(0.85, 0.95, k));
    ctl.pose.rot(ctl.b.head, 0, Math.sin(t * 30) * 0.15 * tw * w, 0);
    ctl.glow = mix(ctl.glow, 0.25, hold * w);
  } },
  hit: bHit({ dur: 0.45 }),
  knockback: bKnockback(),
  knockdown: bKnockdown({ lieY: 0.18 }),
  getup: bGetup({ lieY: 0.18 }),
  death: bDeath({ dist: 1.2, peak: 0.35, spin: 0.25, lieY: 0.18, dur: 1.6 }),
  stun: bStun(),
  spawn: { dur: 2.6, a: 0.001, d: 0.92, state: true, excl: true, fn(ctl, a, w) { // statue awakening
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const stat = 1 - sstep(0.45, 0.72, k);
    statuePose(ctl, stat * w);
    const ign = sstep(0.18, 0.5, k);                                    // fissures ignite
    const shake = sstep(0.3, 0.45, k) * (1 - sstep(0.5, 0.6, k)) * Math.sin(t * 60) * 0.03;
    P.rot(b.hips, 0, 0, shake * w); P.rot(b.chest, 0, shake * w, 0);
    const flare = sstep(0.62, 0.72, k) * (1 - sstep(0.88, 1, k));       // wings flare, roar
    ctl.wingSpread = mix(ctl.wingSpread, 1.4 * flare, flare * w); ctl.flap = Math.max(ctl.flap, 0.6 * flare * w);
    P.rot(b.head, 0.4 * flare * w, 0, 0); P.rx(b.chest, 0.15 * flare * w);
    armRot(ctl, -1, 1.0 * flare, 0.4, w, 1.0 * flare); armRot(ctl, 1, 1.0 * flare, 0.4, w, 1.0 * flare);
    ctl.jaw = Math.max(ctl.jaw, 0.9 * flare * w);
    ctl.glow = mix(ctl.glow, 0.05 + ign * (1 + 1.5 * flare), w);
    ctl.charge = Math.max(ctl.charge, ign * (1 - sstep(0.62, 0.8, k)) * 0.35 * w);
  } },
  spawn_drop: bDrop({ height: 4 }),
};

const GARG_SPEC = {
  bones: {
    hips: 'hips', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head', jaw: 'jaw', tail: ['tail1', 'tail2', 'tail3', 'tail4'],
    armL: ['armUL', 'armLL', 'handL'], armR: ['armUR', 'armLR', 'handR'], wingL: ['wing1L', 'wing2L'], wingR: ['wing1R', 'wing2R'],
  },
  gait: {
    legs: [
      { id: 'L', chain: ['thighL', 'shinL', 'metaL', 'footL'], toe: [-0.21, 0, -0.13], body: 'hips', scap: 0.22, lift: 0.12, flex: 0.9, heel: 0.3, out: 0.15, metaK: 1.1, metaBase: 0 },
      { id: 'R', chain: ['thighR', 'shinR', 'metaR', 'footR'], toe: [0.21, 0, -0.13], body: 'hips', scap: 0.22, lift: 0.12, flex: 0.9, heel: 0.3, out: 0.15, metaK: 1.1, metaBase: 0 },
    ],
    maxStride: 0.7, fMin: 0.6,
    gaits: [
      { v: 1.2, f: 1.9, duty: 0.6, lift: 0.8, off: { L: 0, R: 0.5 }, bob: 0.03, bobF: 2, bobPh: 0.1, roll: 0.06, rollF: 1, rollPh: 0.25, sway: 0.03, swayF: 1, swayPh: 0.25, nod: 0.03, nodF: 2 },
      { v: 5.0, f: 3.4, duty: 0.38, lift: 1.3, off: { L: 0, R: 0.5 }, bob: 0.06, bobF: 2, bobPh: 0.3, roll: 0.05, rollF: 1, rollPh: 0.25, nod: 0.04, nodF: 2 },
    ],
  },
  arm: { swing: 0.4, out: 0.16, elbow: 0.45, runSwing: 0.7, runOut: 0.3, runElbow: 0.8, combatUp: 0.45, combatElbow: 0.8, combatOut: 0.25, flyOut: 0.3, flyUp: 0.4 },
  lean: { walk: 0.15, run: 0.5, combat: 0.2 }, twist: 0.12, waddle: 0.05, crouch: 0.07, breathe: 0.01, tailLift: 0.4, tailFly: 0.5,
  wings: { idleF: 0.25, flapF: 3.6, amp: 1.0, idleAmp: 0.03, fold: 0.3, fold2: 0.8, lift: 0.3, flySpread: 0.3, tilt: 0.05 },
  flyH: 1.1, flyBob: 0.12, flyLean: 0.5, chargeK: 0.25,
  fidgets: [{ name: 'idle_alt', w: 1 }], fidgetGap: 6,
  pose(ctl) {
    const P = ctl.pose, b = ctl.b;
    P.rx(b.hips, -0.06); P.rx(b.spine, -0.24); P.rx(b.chest, -0.08); P.rx(b.neck, 0.16); P.rx(b.head, 0.16);   // predatory hunch
    ctl.wingSpread += 0.2 * ctl.combat + 0.1 * ctl.run;
    ctl.jaw += 0.06 * ctl.combat;
    ctl.glow *= 0.85 + 0.2 * Math.sin(ctl.t * 1.7) + 0.4 * ctl.combat;
  },
  actions: ACTIONS,
};
